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

export class DerivativeFilter {
  private velocityPeriod: number;
  private accelerationPeriod: number;
  private significantMoveThreshold: number;

  constructor(
    velocityPeriod: number = 10,
    accelerationPeriod: number = 5,
    significantThreshold: number = 2.0
  ) {
    this.velocityPeriod = velocityPeriod;
    this.accelerationPeriod = accelerationPeriod;
    this.significantMoveThreshold = significantThreshold;
  }

  /**
   * 计算一阶导数 (速度)
   * velocity = price[i] - price[i-1]
   */
  private calculateVelocity(prices: number[]): number[] {
    const velocity: number[] = [];
    velocity.push(0); // 第一个点速度为0
    
    for (let i = 1; i < prices.length; i++) {
      velocity.push(prices[i] - prices[i - 1]);
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
      acceleration.push(velocity[i] - velocity[i - 1]);
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
        result.push(data[i]);
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
      
      result.push(std === 0 ? 0 : (data[i] - mean) / std);
    }
    
    return result;
  }

  /**
   * 计算导数过滤器
   */
  calculate(prices: number[]): DerivativeData[] {
    if (prices.length < this.velocityPeriod + this.accelerationPeriod) {
      return prices.map(price => ({
        price,
        velocity: 0,
        velocityMA: 0,
        acceleration: 0,
        accelerationMA: 0,
        trendState: 'neutral',
        strength: 0,
        isSignificantMove: false,
        reasoning: ['数据不足'],
      }));
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
      const v = normalizedVelocity[i];
      const a = normalizedAcceleration[i];
      const vMA = velocityMA[i];
      const aMA = accelerationMA[i];
      
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
        price: prices[i],
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
    const current = data[data.length - 1];
    
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
   * 获取交易建议
   */
  getTradingAdvice(prices: number[]): {
    action: 'buy' | 'sell' | 'hold' | 'exit';
    confidence: number;
    reasoning: string[];
  } {
    const data = this.calculate(prices);
    const current = data[data.length - 1];
    
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
