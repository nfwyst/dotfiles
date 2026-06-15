/**
 * OCS enhanced: TRIX 系统 (Triple Exponential Moving Average)
 * 
 * 功能: 对价格进行三次指数平滑，计算变化率百分比
 * 优势: 极大减少短期噪音，更快检测趋势变化
 * 用途: 作为KNN分类的额外特征，确认其他指标信号
 */

export interface TRIXData {
  trix: number;           // TRIX值 (百分比变化)
  signal: number;         // 信号线 (TRIX的EMA)
  histogram: number;      // TRIX - Signal
  trend: 'up' | 'down' | 'neutral';
  strength: number;       // 趋势强度 0-100
  crossOver: boolean;     // 金叉 (TRIX上穿Signal)
  crossUnder: boolean;    // 死叉 (TRIX下穿Signal)
  zeroCross: boolean;     // 零轴穿越
}

export class TRIXSystem {
  private period: number;
  private signalPeriod: number;

  // ── Incremental state ──
  private alpha: number;
  private signalAlpha: number;
  private ema1Prev: number = 0;
  private ema2Prev: number = 0;
  private ema3Prev: number = 0;
  private ema3PrevPrev: number = 0; // ema3 from two bars ago, for trix calc
  private trixPrev: number = 0;
  private signalPrev: number = 0;
  private barCount: number = 0;

  // SMA seed accumulators for warmup
  private sma1Sum: number = 0;
  private sma2Sum: number = 0;
  private sma3Sum: number = 0;
  private ema1Buffer: number[] = [];
  private ema2Buffer: number[] = [];
  private ema3Buffer: number[] = [];
  private trixBuffer: number[] = [];
  private warmupComplete: boolean = false;

  constructor(period: number = 14, signalPeriod: number = 9) {
    this.period = period;
    this.signalPeriod = signalPeriod;
    this.alpha = 2 / (period + 1);
    this.signalAlpha = 2 / (signalPeriod + 1);
  }

  /**
   * Reset incremental state
   */
  reset(): void {
    this.ema1Prev = 0;
    this.ema2Prev = 0;
    this.ema3Prev = 0;
    this.ema3PrevPrev = 0;
    this.trixPrev = 0;
    this.signalPrev = 0;
    this.barCount = 0;
    this.sma1Sum = 0;
    this.sma2Sum = 0;
    this.sma3Sum = 0;
    this.ema1Buffer = [];
    this.ema2Buffer = [];
    this.ema3Buffer = [];
    this.trixBuffer = [];
    this.warmupComplete = false;
  }

  /**
   * Incremental O(1) update for a single new price bar.
   * 
   * Warmup strategy:
   * - The original calculate() seeds each EMA with data[0] and uses
   *   multiplier = 2/(period+1). To match this exactly, we do the same:
   *   first value seeds the EMA, subsequent values apply the EMA formula.
   *   This matches the original code's behavior (no SMA seed — it just
   *   starts ema = data[0]).
   */
  updateBar(price: number): TRIXData {
    this.barCount++;

    const alpha = this.alpha;
    const signalAlpha = this.signalAlpha;

    // ── EMA1 ──
    let ema1: number;
    if (this.barCount === 1) {
      ema1 = price; // seed
    } else {
      ema1 = (price - this.ema1Prev) * alpha + this.ema1Prev;
    }

    // ── EMA2 (of EMA1) ──
    let ema2: number;
    if (this.barCount === 1) {
      ema2 = ema1;
    } else {
      ema2 = (ema1 - this.ema2Prev) * alpha + this.ema2Prev;
    }

    // ── EMA3 (of EMA2) ──
    let ema3: number;
    if (this.barCount === 1) {
      ema3 = ema2;
    } else {
      ema3 = (ema2 - this.ema3Prev) * alpha + this.ema3Prev;
    }

    // ── TRIX = (ema3 - ema3_prev) / ema3_prev * 100 ──
    let trix: number;
    if (this.barCount <= 1) {
      trix = 0; // first bar: no previous ema3
    } else {
      trix = this.ema3Prev !== 0
        ? ((ema3 - this.ema3Prev) / this.ema3Prev) * 100
        : 0;
    }

    // ── Signal = EMA of trix ──
    let signal: number;
    if (this.barCount <= 1) {
      signal = trix; // seed signal with first trix
    } else {
      signal = (trix - this.signalPrev) * signalAlpha + this.signalPrev;
    }

    const histogram = trix - signal;

    // Trend
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (trix > 0.5) trend = 'up';
    else if (trix < -0.5) trend = 'down';

    // Strength
    const strength = Math.min(100, Math.abs(trix) * 20);

    // Crossovers
    let crossOver = false;
    let crossUnder = false;
    let zeroCross = false;

    if (this.barCount > 1) {
      crossOver = this.trixPrev < this.signalPrev && trix >= signal;
      crossUnder = this.trixPrev > this.signalPrev && trix <= signal;
      zeroCross = (this.trixPrev < 0 && trix >= 0) || (this.trixPrev > 0 && trix <= 0);
    }

    // Update state
    this.ema1Prev = ema1;
    this.ema2Prev = ema2;
    this.ema3PrevPrev = this.ema3Prev;
    this.ema3Prev = ema3;
    this.trixPrev = trix;
    this.signalPrev = signal;

    return {
      trix,
      signal,
      histogram,
      trend,
      strength,
      crossOver,
      crossUnder,
      zeroCross,
    };
  }

  /**
   * 指数移动平均 (EMA)
   */
  private ema(data: number[], period: number): number[] {
    const multiplier = 2 / (period + 1);
    const result: number[] = [];
    let ema = data[0]!;
    
    for (let i = 0; i < data.length; i++) {
      ema = (data[i]! - ema) * multiplier + ema;
      result.push(ema);
    }
    
    return result;
  }

  /**
   * 计算 TRIX
   * 
   * 步骤:
   * 1. 第一次EMA: price -> ema1
   * 2. 第二次EMA: ema1 -> ema2
   * 3. 第三次EMA: ema2 -> ema3 (三重EMA)
   * 4. TRIX = (ema3 - ema3[1]) / ema3[1] * 100
   */
  calculate(prices: number[]): TRIXData[] {
    if (prices.length < this.period * 3) {
      return prices.map(() => ({
        trix: 0,
        signal: 0,
        histogram: 0,
        trend: 'neutral',
        strength: 0,
        crossOver: false,
        crossUnder: false,
        zeroCross: false,
      }));
    }

    // 第一次EMA
    const ema1 = this.ema(prices, this.period);
    
    // 第二次EMA
    const ema2 = this.ema(ema1, this.period);
    
    // 第三次EMA
    const ema3 = this.ema(ema2, this.period);
    
    // 计算TRIX (百分比变化)
    const trixValues: number[] = [];
    trixValues.push(0); // 第一个值设为0
    
    for (let i = 1; i < ema3.length; i++) {
      const trix = ema3[i - 1]! !== 0 
        ? ((ema3[i]! - ema3[i - 1]!) / ema3[i - 1]!) * 100
        : 0;
      trixValues.push(trix);
    }
    
    // 计算信号线 (TRIX的EMA)
    const signalValues = this.ema(trixValues, this.signalPeriod);
    
    // 构建结果
    const result: TRIXData[] = [];
    
    for (let i = 0; i < trixValues.length; i++) {
      const trix = trixValues[i]!;
      const signal = signalValues[i]!;
      const histogram = trix - signal;
      
      // 判断趋势
      let trend: 'up' | 'down' | 'neutral' = 'neutral';
      if (trix > 0.5) trend = 'up';
      else if (trix < -0.5) trend = 'down';
      
      // 趋势强度
      const strength = Math.min(100, Math.abs(trix) * 20);
      
      // 检测交叉
      let crossOver = false;
      let crossUnder = false;
      let zeroCross = false;
      
      if (i > 0) {
        // 金叉: TRIX上穿Signal
        crossOver = trixValues[i - 1]! < signalValues[i - 1]! && trix >= signal;
        
        // 死叉: TRIX下穿Signal
        crossUnder = trixValues[i - 1]! > signalValues[i - 1]! && trix <= signal;
        
        // 零轴穿越
        zeroCross = (trixValues[i - 1]! < 0 && trix >= 0) || 
                    (trixValues[i - 1]! > 0 && trix <= 0);
      }
      
      result.push({
        trix,
        signal,
        histogram,
        trend,
        strength,
        crossOver,
        crossUnder,
        zeroCross,
      });
    }
    
    return result;
  }

  /**
   * 获取最新TRIX信号
   */
  getLatestSignal(prices: number[]): TRIXData {
    const data = this.calculate(prices);
    return data[data.length - 1]!;
  }

  /**
   * 生成交易信号
   */
  generateSignal(prices: number[]): {
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string[];
  } {
    const data = this.calculate(prices);
    const current = data[data.length - 1]!;
    const prev = data[data.length - 2]!;
    
    const reasoning: string[] = [];
    
    // 金叉买入
    if (current.crossOver) {
      reasoning.push(`TRIX金叉: ${current.trix.toFixed(3)} 上穿 ${current.signal.toFixed(3)}`);
      reasoning.push('趋势转强信号');
      return {
        action: 'buy',
        confidence: 70,
        reasoning,
      };
    }
    
    // 死叉卖出
    if (current.crossUnder) {
      reasoning.push(`TRIX死叉: ${current.trix.toFixed(3)} 下穿 ${current.signal.toFixed(3)}`);
      reasoning.push('趋势转弱信号');
      return {
        action: 'sell',
        confidence: 70,
        reasoning,
      };
    }
    
    // 零轴上方 = 多头市场
    if (current.trix > 0 && prev.trix <= 0) {
      reasoning.push(`TRIX上穿零轴: ${current.trix.toFixed(3)}`);
      reasoning.push('进入多头市场');
      return {
        action: 'buy',
        confidence: 60,
        reasoning,
      };
    }
    
    // 零轴下方 = 空头市场
    if (current.trix < 0 && prev.trix >= 0) {
      reasoning.push(`TRIX下穿零轴: ${current.trix.toFixed(3)}`);
      reasoning.push('进入空头市场');
      return {
        action: 'sell',
        confidence: 60,
        reasoning,
      };
    }
    
    // 趋势延续
    if (current.trend === 'up') {
      reasoning.push(`TRIX上升趋势: ${current.trix.toFixed(3)}`);
      return { action: 'hold', confidence: 50, reasoning };
    }
    
    if (current.trend === 'down') {
      reasoning.push(`TRIX下降趋势: ${current.trix.toFixed(3)}`);
      return { action: 'hold', confidence: 50, reasoning };
    }
    
    return {
      action: 'hold',
      confidence: 30,
      reasoning: ['TRIX无明显信号'],
    };
  }

  /**
   * Generate signal from incrementally-updated TRIXData (O(1)).
   * Mirrors the logic in generateSignal() but works on the last two updateBar() results.
   */
  generateSignalFromData(current: TRIXData, prev: TRIXData): {
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];

    if (current.crossOver) {
      reasoning.push(`TRIX金叉: ${current.trix.toFixed(3)} 上穿 ${current.signal.toFixed(3)}`);
      reasoning.push('趋势转强信号');
      return { action: 'buy', confidence: 70, reasoning };
    }

    if (current.crossUnder) {
      reasoning.push(`TRIX死叉: ${current.trix.toFixed(3)} 下穿 ${current.signal.toFixed(3)}`);
      reasoning.push('趋势转弱信号');
      return { action: 'sell', confidence: 70, reasoning };
    }

    if (current.trix > 0 && prev.trix <= 0) {
      reasoning.push(`TRIX上穿零轴: ${current.trix.toFixed(3)}`);
      reasoning.push('进入多头市场');
      return { action: 'buy', confidence: 60, reasoning };
    }

    if (current.trix < 0 && prev.trix >= 0) {
      reasoning.push(`TRIX下穿零轴: ${current.trix.toFixed(3)}`);
      reasoning.push('进入空头市场');
      return { action: 'sell', confidence: 60, reasoning };
    }

    if (current.trend === 'up') {
      reasoning.push(`TRIX上升趋势: ${current.trix.toFixed(3)}`);
      return { action: 'hold', confidence: 50, reasoning };
    }

    if (current.trend === 'down') {
      reasoning.push(`TRIX下降趋势: ${current.trix.toFixed(3)}`);
      return { action: 'hold', confidence: 50, reasoning };
    }

    return { action: 'hold', confidence: 30, reasoning: ['TRIX无明显信号'] };
  }
}

export default TRIXSystem;
