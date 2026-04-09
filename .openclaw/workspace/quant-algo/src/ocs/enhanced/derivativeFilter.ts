/**
 * OCS enhanced: 导数过滤器 (Derivative Filters)
 * 
 * 灵感: Elder博士的交易方法
 * 原理:
 * - 一阶导数: 价格变化速度
 * - 二阶导数: 价格变化加速度
 * 
 * 应用场景:
 * - 速度和加速度同向: 趋势强劲，持仓
 * - 速度和加速度反向: 趋势减弱，考虑离场
 * - 识别显著价格变动与市场噪音
 */

export interface DerivativeData {
  // 原始价格
  price: number;
  
  // 一阶导数 (速度)
  velocity: number;           // 当前价格变化速度
  velocityMA: number;         // 速度的移动平均
  
  // 二阶导数 (加速度)
  acceleration: number;       // 当前加速度
  accelerationMA: number;     // 加速度的移动平均
  
  // 趋势状态
  trendState: 'strong_up' | 'weakening_up' | 'strong_down' | 'weakening_down' | 'neutral';
  
  // 信号
  strength: number;           // 趋势强度 0-100
  isSignificantMove: boolean; // 是否为显著变动(非噪音)
  
  // 分析
  reasoning: string[];
}

/**
 * Fixed-size circular buffer with running sum/sumSq for O(1) z-score normalization
 */
class CircularZScoreBuffer {
  private buffer: number[];
  private head: number = 0;
  private count: number = 0;
  private capacity: number;
  private sum: number = 0;
  private sumSq: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(0);
  }

  push(value: number): void {
    if (this.count >= this.capacity) {
      // Remove outgoing value
      const outgoing = this.buffer[this.head]!;
      this.sum -= outgoing;
      this.sumSq -= outgoing * outgoing;
    } else {
      this.count++;
    }
    this.buffer[this.head] = value;
    this.sum += value;
    this.sumSq += value * value;
    this.head = (this.head + 1) % this.capacity;
  }

  /**
   * Compute z-score of the given value against the buffer's distribution
   */
  zScore(value: number): number {
    if (this.count === 0) return 0;
    const mean = this.sum / this.count;
    const variance = this.sumSq / this.count - mean * mean;
    const std = Math.sqrt(Math.max(0, variance));
    return std === 0 ? 0 : (value - mean) / std;
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.sum = 0;
    this.sumSq = 0;
    this.buffer.fill(0);
  }
}

/**
 * Fixed-size circular buffer with running sum for O(1) SMA
 */
class CircularSMABuffer {
  private buffer: number[];
  private head: number = 0;
  private count: number = 0;
  private capacity: number;
  private sum: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(0);
  }

  push(value: number): number {
    if (this.count >= this.capacity) {
      const outgoing = this.buffer[this.head]!;
      this.sum -= outgoing;
    } else {
      this.count++;
    }
    this.buffer[this.head] = value;
    this.sum += value;
    this.head = (this.head + 1) % this.capacity;
    return this.count > 0 ? this.sum / this.count : value;
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.sum = 0;
    this.buffer.fill(0);
  }
}

export class DerivativeFilter {
  private velocityPeriod: number;
  private accelerationPeriod: number;
  private significantMoveThreshold: number;

  // ── Incremental state ──
  private prevPrice: number = 0;
  private prevVelocity: number = 0;
  private incBarCount: number = 0;
  private velocityZBuffer: CircularZScoreBuffer;
  private accelZBuffer: CircularZScoreBuffer;
  private velocitySMABuffer: CircularSMABuffer;
  private accelSMABuffer: CircularSMABuffer;

  // ── Cached result for getTradingAdvice / calculate double-call fix ──
  private cachedPrices: number[] | null = null;
  private cachedResult: DerivativeData[] | null = null;

  constructor(
    velocityPeriod: number = 10,
    accelerationPeriod: number = 5,
    significantThreshold: number = 2.0
  ) {
    this.velocityPeriod = velocityPeriod;
    this.accelerationPeriod = accelerationPeriod;
    this.significantMoveThreshold = significantThreshold;

    this.velocityZBuffer = new CircularZScoreBuffer(Math.max(1, Math.floor(velocityPeriod)));
    this.accelZBuffer = new CircularZScoreBuffer(Math.max(1, Math.floor(accelerationPeriod)));
    this.velocitySMABuffer = new CircularSMABuffer(Math.max(1, Math.floor(velocityPeriod)));
    this.accelSMABuffer = new CircularSMABuffer(Math.max(1, Math.floor(accelerationPeriod)));
  }

  /**
   * Reset incremental state
   */
  reset(): void {
    this.prevPrice = 0;
    this.prevVelocity = 0;
    this.incBarCount = 0;
    this.velocityZBuffer.reset();
    this.accelZBuffer.reset();
    this.velocitySMABuffer.reset();
    this.accelSMABuffer.reset();
    this.cachedPrices = null;
    this.cachedResult = null;
  }

  /**
   * Incremental O(1) update for a single new price bar.
   * Returns the DerivativeData for the latest bar.
   */
  updateBar(price: number): DerivativeData {
    this.incBarCount++;

    // ── Velocity (first derivative) ──
    let velocity: number;
    if (this.incBarCount === 1) {
      velocity = 0;
    } else {
      velocity = price - this.prevPrice;
    }

    // ── Acceleration (second derivative) ──
    let acceleration: number;
    if (this.incBarCount <= 2) {
      acceleration = 0;
    } else {
      acceleration = velocity - this.prevVelocity;
    }

    // ── Z-score normalization (O(1) via circular buffer) ──
    this.velocityZBuffer.push(velocity);
    this.accelZBuffer.push(acceleration);
    const v = this.velocityZBuffer.zScore(velocity);
    const a = this.accelZBuffer.zScore(acceleration);

    // ── SMA (O(1) via circular buffer) ──
    const vMA = this.velocitySMABuffer.push(v);
    const aMA = this.accelSMABuffer.push(a);

    // ── Trend state ──
    let trendState: DerivativeData['trendState'] = 'neutral';
    const reasoning: string[] = [];

    if (vMA > 0.5 && aMA > 0) {
      trendState = 'strong_up';
      reasoning.push(`强劲上涨趋势: 速度(${vMA.toFixed(2)})和加速度(${aMA.toFixed(2)})均为正`);
    } else if (vMA > 0.5 && aMA < 0) {
      trendState = 'weakening_up';
      reasoning.push(`上涨动能减弱: 速度为正但加速度转负`);
    } else if (vMA < -0.5 && aMA < 0) {
      trendState = 'strong_down';
      reasoning.push(`强劲下跌趋势: 速度和加速度均为负`);
    } else if (vMA < -0.5 && aMA > 0) {
      trendState = 'weakening_down';
      reasoning.push(`下跌动能减弱: 速度为负但加速度转正`);
    } else {
      reasoning.push(`趋势中性: 速度和加速度无明显方向`);
    }

    const isSignificantMove = Math.abs(v) > this.significantMoveThreshold;
    if (isSignificantMove) {
      reasoning.push(`显著价格变动: Z-Score = ${v.toFixed(2)}`);
    }

    const strength = Math.min(100, (Math.abs(vMA) + Math.abs(aMA)) * 25);

    // Update state
    this.prevPrice = price;
    this.prevVelocity = velocity;

    return {
      price,
      velocity: v,
      velocityMA: vMA,
      acceleration: a,
      accelerationMA: aMA,
      trendState,
      strength,
      isSignificantMove,
      reasoning,
    };
  }

  /**
   * Generate trading advice from incrementally-updated DerivativeData (O(1)).
   */
  getTradingAdviceFromData(current: DerivativeData): {
    action: 'buy' | 'sell' | 'hold' | 'exit';
    confidence: number;
    reasoning: string[];
  } {
    const reasoning = [...current.reasoning];

    if (current.trendState === 'strong_up') {
      reasoning.push('强劲上涨趋势，建议持仓或加仓');
      return { action: 'buy', confidence: current.strength, reasoning };
    }

    if (current.trendState === 'strong_down') {
      reasoning.push('强劲下跌趋势，建议空仓或做空');
      return { action: 'sell', confidence: current.strength, reasoning };
    }

    if (current.trendState === 'weakening_up') {
      reasoning.push('上涨动能减弱，考虑部分止盈');
      return { action: 'exit', confidence: 60, reasoning };
    }

    if (current.trendState === 'weakening_down') {
      reasoning.push('下跌动能减弱，可能即将反弹');
      return { action: 'hold', confidence: 50, reasoning };
    }

    return { action: 'hold', confidence: 30, reasoning: ['趋势不明确，建议观望'] };
  }

  /**
   * 计算一阶导数 (速度)
   * velocity = price[i] - price[i-1]
   */
  private calculateVelocity(prices: number[]): number[] {
    const velocity: number[] = [];
    velocity.push(0); // 第一个点速度为0
    
    for (let i = 1; i < prices.length; i++) {
      velocity.push(prices[i]! - prices[i - 1]!);
    }
    
    return velocity;
  }

  /**
   * 计算二阶导数 (加速度)
   * acceleration = velocity[i] - velocity[i-1]
   */
  private calculateAcceleration(velocity: number[]): number[] {
    const acceleration: number[] = [];
    acceleration.push(0); // 第一个点加速度为0
    
    for (let i = 1; i < velocity.length; i++) {
      acceleration.push(velocity[i]! - velocity[i - 1]!);
    }
    
    return acceleration;
  }

  /**
   * 简单移动平均
   */
  private sma(data: number[], period: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(data[i]!);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    
    return result;
  }

  /**
   * 标准化 (Z-Score)
   */
  private normalize(data: number[], period: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - period + 1);
      const slice = data.slice(start, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / slice.length;
      const std = Math.sqrt(variance);
      
      result.push(std === 0 ? 0 : (data[i]! - mean) / std);
    }
    
    return result;
  }

  /**
   * 计算导数过滤器 (with caching to avoid double-call)
   */
  calculate(prices: number[]): DerivativeData[] {
    // Cache check: if same prices array reference or same content, return cached
    if (this.cachedResult && this.cachedPrices === prices) {
      return this.cachedResult;
    }

    if (prices.length < this.velocityPeriod + this.accelerationPeriod) {
      const result = prices.map(price => ({
        price,
        velocity: 0,
        velocityMA: 0,
        acceleration: 0,
        accelerationMA: 0,
        trendState: 'neutral' as const,
        strength: 0,
        isSignificantMove: false,
        reasoning: ['数据不足'],
      }));
      this.cachedPrices = prices;
      this.cachedResult = result;
      return result;
    }

    // 1. 计算速度和加速度
    const velocity = this.calculateVelocity(prices);
    const acceleration = this.calculateAcceleration(velocity);
    
    // 2. 标准化处理
    const normalizedVelocity = this.normalize(velocity, this.velocityPeriod);
    const normalizedAcceleration = this.normalize(acceleration, this.accelerationPeriod);
    
    // 3. 计算移动平均
    const velocityMA = this.sma(normalizedVelocity, this.velocityPeriod);
    const accelerationMA = this.sma(normalizedAcceleration, this.accelerationPeriod);
    
    // 4. 构建结果
    const result: DerivativeData[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      const v = normalizedVelocity[i]!;
      const a = normalizedAcceleration[i]!;
      const vMA = velocityMA[i]!;
      const aMA = accelerationMA[i]!;
      
      // 判断趋势状态
      let trendState: DerivativeData['trendState'] = 'neutral';
      let reasoning: string[] = [];
      
      // 速度和加速度同向 = 趋势强劲
      if (vMA > 0.5 && aMA > 0) {
        trendState = 'strong_up';
        reasoning.push(`强劲上涨趋势: 速度(${vMA.toFixed(2)})和加速度(${aMA.toFixed(2)})均为正`);
      } else if (vMA > 0.5 && aMA < 0) {
        trendState = 'weakening_up';
        reasoning.push(`上涨动能减弱: 速度为正但加速度转负`);
      } else if (vMA < -0.5 && aMA < 0) {
        trendState = 'strong_down';
        reasoning.push(`强劲下跌趋势: 速度和加速度均为负`);
      } else if (vMA < -0.5 && aMA > 0) {
        trendState = 'weakening_down';
        reasoning.push(`下跌动能减弱: 速度为负但加速度转正`);
      } else {
        reasoning.push(`趋势中性: 速度和加速度无明显方向`);
      }
      
      // 判断是否为显著变动
      const isSignificantMove = Math.abs(v) > this.significantMoveThreshold;
      if (isSignificantMove) {
        reasoning.push(`显著价格变动: Z-Score = ${v.toFixed(2)}`);
      }
      
      // 趋势强度
      const strength = Math.min(100, (Math.abs(vMA) + Math.abs(aMA)) * 25);
      
      result.push({
        price: prices[i]!,
        velocity: v,
        velocityMA: vMA,
        acceleration: a,
        accelerationMA: aMA,
        trendState,
        strength,
        isSignificantMove,
        reasoning,
      });
    }
    
    this.cachedPrices = prices;
    this.cachedResult = result;
    return result;
  }

  /**
   * 分析价格数据 (Layer 2兼容接口)
   */
  analyze(prices: number[]): {
    trendStrength: 'strong' | 'weak' | 'reversing' | 'consolidating';
    signal: 'hold' | 'reduce' | 'exit' | 'enter';
  } {
    const data = this.calculate(prices);
    const current = data[data.length - 1]!;
    
    let trendStrength: 'strong' | 'weak' | 'reversing' | 'consolidating';
    switch (current.trendState) {
      case 'strong_up':
      case 'strong_down':
        trendStrength = 'strong';
        break;
      case 'weakening_up':
      case 'weakening_down':
        trendStrength = 'reversing';
        break;
      default:
        trendStrength = current.strength > 30 ? 'weak' : 'consolidating';
    }
    
    let signal: 'hold' | 'reduce' | 'exit' | 'enter';
    switch (current.trendState) {
      case 'strong_up':
        signal = 'enter';
        break;
      case 'strong_down':
        signal = 'exit';
        break;
      case 'weakening_up':
        signal = 'reduce';
        break;
      case 'weakening_down':
        signal = 'hold';
        break;
      default:
        signal = 'hold';
    }
    
    return { trendStrength, signal };
  }

  /**
   * 获取交易建议 (uses cache from calculate to avoid double computation)
   */
  getTradingAdvice(prices: number[]): {
    action: 'buy' | 'sell' | 'hold' | 'exit';
    confidence: number;
    reasoning: string[];
  } {
    const data = this.calculate(prices);
    const current = data[data.length - 1]!;
    
    const reasoning = [...current.reasoning];
    
    // 强劲趋势 - 持仓
    if (current.trendState === 'strong_up') {
      reasoning.push('强劲上涨趋势，建议持仓或加仓');
      return { action: 'buy', confidence: current.strength, reasoning };
    }
    
    if (current.trendState === 'strong_down') {
      reasoning.push('强劲下跌趋势，建议空仓或做空');
      return { action: 'sell', confidence: current.strength, reasoning };
    }
    
    // 动能减弱 - 考虑离场
    if (current.trendState === 'weakening_up') {
      reasoning.push('上涨动能减弱，考虑部分止盈');
      return { action: 'exit', confidence: 60, reasoning };
    }
    
    if (current.trendState === 'weakening_down') {
      reasoning.push('下跌动能减弱，可能即将反弹');
      return { action: 'hold', confidence: 50, reasoning };
    }
    
    return {
      action: 'hold',
      confidence: 30,
      reasoning: ['趋势不明确，建议观望'],
    };
  }
}

export default DerivativeFilter;
