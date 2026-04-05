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

  constructor(period: number = 14, signalPeriod: number = 9) {
    this.period = period;
    this.signalPeriod = signalPeriod;
  }

  /**
   * 指数移动平均 (EMA)
   */
  private ema(data: number[], period: number): number[] {
    const multiplier = 2 / (period + 1);
    const result: number[] = [];
    let ema = data[0];
    
    for (let i = 0; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
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
      const trix = ema3[i - 1] !== 0 
        ? ((ema3[i] - ema3[i - 1]) / ema3[i - 1]) * 100
        : 0;
      trixValues.push(trix);
    }
    
    // 计算信号线 (TRIX的EMA)
    const signalValues = this.ema(trixValues, this.signalPeriod);
    
    // 构建结果
    const result: TRIXData[] = [];
    
    for (let i = 0; i < trixValues.length; i++) {
      const trix = trixValues[i];
      const signal = signalValues[i];
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
        crossOver = trixValues[i - 1] < signalValues[i - 1] && trix >= signal;
        
        // 死叉: TRIX下穿Signal
        crossUnder = trixValues[i - 1] > signalValues[i - 1] && trix <= signal;
        
        // 零轴穿越
        zeroCross = (trixValues[i - 1] < 0 && trix >= 0) || 
                    (trixValues[i - 1] > 0 && trix <= 0);
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
    return data[data.length - 1];
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
    const current = data[data.length - 1];
    const prev = data[data.length - 2];
    
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
}

export default TRIXSystem;
