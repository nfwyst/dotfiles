import logger from './logger';

export interface AdaptiveMA {
  value: number;
  period: number;
  trend: 'up' | 'down' | 'flat';
}

export interface EhlersCycle {
  dominantCycle: number;      // 主导周期
  smoothPeriod: number;       // 平滑周期
  phase: number;              // 相位
}

// FIX: M6 — Changed `filtered` from `number` to `number[]` so that callers needing
// the full filtered series (e.g., calculateEhlersCycle) can index into it, while callers
// needing only the final scalar value access `filtered[filtered.length - 1]`.
export interface GaussianSignal {
  value: number;
  filtered: number[];   // FIX: M6 — was `number`, now `number[]` (array of filtered values)
  noise: number;
  confidence: number;
}

/**
 * OCS AI Trader 技术分析模块
 * 
 * 实现 OCS AI Trader 的核心技术:
 * 1. 自适应移动平均线 (Ehlers AMA)
 * 2. 主导周期检测 (Ehlers Cycle)
 * 3. 高斯滤波 (Gaussian Filter)
 * 4. 成交量价格均值 (Volume Price Mean)
 * 5. 超级趋势估计 (Supertrend Estimates)
 * 6. TRIX 三重指数平滑
 * 7. Fisher 变换
 * 
 * 信号控制：添加冷却机制，避免过于频繁产生信号
 */
export class OCSAnalyzer {
  // 注意：信号冷却机制已移除，由 LLM 模块控制调用频率

  // FIX: M7 — Memoized state for incremental Ehlers AMA computation.
  // Stores the last computed AMA value and the number of prices processed,
  // so each new bar only requires O(1) work instead of O(n) recursive recomputation.
  private lastAmaValue: number | null = null;
  private lastAmaPricesLength: number = 0;
  private lastAmaFastLength: number = 0;
  private lastAmaSlowLength: number = 0;
  
  /**
   * 1. Ehlers 自适应移动平均线
   * 根据市场周期自动调整平滑系数
   *
   * FIX: M7 — Converted from recursive O(n^2) to iterative O(n) with memoization.
   * The old implementation called itself recursively via:
   *   `this.calculateEhlersAMA(prices.slice(0, -1), fastLength, slowLength).value`
   * to compute `prevAMA`, which caused every call to re-iterate the entire price history
   * from scratch, producing O(n^2) total work. The fix computes AMA iteratively in a
   * single forward pass, caching the previous AMA value for O(1) incremental updates
   * when only one new bar is appended.
   */
  calculateEhlersAMA(
    prices: number[],
    fastLength: number = 2,
    slowLength: number = 30
  ): AdaptiveMA {
    if (prices.length < slowLength) {
      return { value: prices[prices.length - 1], period: slowLength, trend: 'flat' };
    }
    
    // 计算价格变化
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(Math.abs(prices[i] - prices[i - 1]));
    }
    
    // 计算效率比 (ER)
    const erWindow = Math.min(10, changes.length);
    const recentChange = Math.abs(prices[prices.length - 1] - prices[prices.length - erWindow - 1]);
    const totalVolatility = changes.slice(-erWindow).reduce((a, b) => a + b, 0);
    
    const er = totalVolatility > 0 ? recentChange / totalVolatility : 0;
    
    // 计算平滑常数
    const fastSC = 2 / (fastLength + 1);
    const slowSC = 2 / (slowLength + 1);
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
    
    // FIX: M7 — Iterative AMA computation with memoization.
    // Check if we can do an incremental O(1) update (same params, one new bar appended).
    let ama: number;
    let prevAMA: number;

    const canIncrement =
      this.lastAmaValue !== null &&
      this.lastAmaFastLength === fastLength &&
      this.lastAmaSlowLength === slowLength &&
      prices.length === this.lastAmaPricesLength + 1;

    if (canIncrement) {
      // FIX: M7 — O(1) incremental update: apply AMA formula to just the new bar
      prevAMA = this.lastAmaValue!;
      ama = prevAMA + sc * (prices[prices.length - 1] - prevAMA);
    } else {
      // FIX: M7 — Full iterative pass (O(n)), replacing the old recursive approach.
      // Compute AMA across all bars in a single forward loop, tracking prevAMA.
      ama = prices[0];
      prevAMA = ama;
      for (let i = 1; i < prices.length; i++) {
        prevAMA = ama;
        ama = ama + sc * (prices[i] - ama);
      }
    }

    // FIX: M7 — Cache the computed AMA for next incremental update
    this.lastAmaValue = ama;
    this.lastAmaPricesLength = prices.length;
    this.lastAmaFastLength = fastLength;
    this.lastAmaSlowLength = slowLength;
    
    // FIX: M7 — Determine trend using the iteratively tracked prevAMA instead of
    // a recursive call to this.calculateEhlersAMA(prices.slice(0, -1), ...).
    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (ama > prevAMA * 1.001) trend = 'up';
    else if (ama < prevAMA * 0.999) trend = 'down';
    
    // 动态周期
    const period = Math.round(slowLength - er * (slowLength - fastLength));
    
    return { value: ama, period, trend };
  }
  
  /**
   * 2. Ehlers 主导周期检测
   * 识别市场当前的主导周期
   */
  calculateEhlersCycle(prices: number[]): EhlersCycle {
    if (prices.length < 20) {
      return { dominantCycle: 20, smoothPeriod: 10, phase: 0 };
    }
    
    // FIX: M6 — calculateGaussian now returns filtered as number[].
    // Access the full filtered array for cycle period detection.
    const smooth = this.calculateGaussian(prices, 0.5).filtered;
    
    // 计算周期 (简化版 Ehlers 周期测量)
    let cyclePeriod = 0;
    let maxPower = 0;
    
    // 测试 10-50 周期范围
    for (let testPeriod = 10; testPeriod <= 50; testPeriod++) {
      let power = 0;
      let phaseSum = 0;
      
      for (let i = testPeriod; i < smooth.length; i++) {
        const real = smooth[i] - smooth[i - Math.floor(testPeriod / 2)];
        const imag = smooth[i] - smooth[i - testPeriod];
        power += Math.sqrt(real * real + imag * imag);
        phaseSum += Math.atan2(imag, real);
      }
      
      if (power > maxPower) {
        maxPower = power;
        cyclePeriod = testPeriod;
      }
    }
    
    // 默认周期
    if (cyclePeriod === 0) cyclePeriod = 20;
    
    return {
      dominantCycle: cyclePeriod,
      smoothPeriod: Math.round(cyclePeriod / 2),
      phase: 0, // 简化
    };
  }
  
  /**
   * 3. 高斯滤波
   * 平滑价格数据，减少噪音
   *
   * FIX: M6 — Changed return type so that `filtered` is a `number[]` (array of Gaussian-
   * filtered values, one per input price) instead of a single scalar. Previously, the
   * method returned a single filtered scalar, but `calculateEhlersCycle` accessed
   * `result.filtered[i]` as if it were an array, causing undefined values and broken
   * cycle detection. Now the method produces a full filtered series using a sliding
   * Gaussian kernel, and callers needing only the final value use
   * `filtered[filtered.length - 1]`.
   */
  calculateGaussian(prices: number[], sigma: number = 0.5): GaussianSignal {
    const n = prices.length;
    // FIX: M6 — Return empty array for filtered instead of scalar 0
    if (n === 0) return { value: 0, filtered: [], noise: 0, confidence: 0 };
    
    // FIX: M6 — Compute a Gaussian-filtered value for each position in the price array.
    // For each position, apply a Gaussian kernel centered at that position.
    // The kernel window size is adaptive based on sigma to avoid excessive computation.
    const kernelRadius = Math.max(1, Math.ceil(sigma * 3));
    const filteredArray: number[] = [];

    for (let center = 0; center < n; center++) {
      // Determine the window bounds for this center position
      const windowStart = Math.max(0, center - kernelRadius);
      const windowEnd = Math.min(n - 1, center + kernelRadius);

      let weightSum = 0;
      let filteredVal = 0;

      for (let j = windowStart; j <= windowEnd; j++) {
        const x = (j - center) / Math.max(sigma, 0.01);
        const w = Math.exp(-0.5 * x * x);
        filteredVal += prices[j] * w;
        weightSum += w;
      }

      filteredArray.push(weightSum > 0 ? filteredVal / weightSum : prices[center]);
    }

    // FIX: M6 — Compute noise and confidence using the last filtered value
    const lastFiltered = filteredArray[n - 1];
    const current = prices[n - 1];
    const noise = Math.abs(current - lastFiltered);
    const confidence = 1 - Math.min(1, noise / (current * 0.02));
    
    return {
      value: current,
      filtered: filteredArray,  // FIX: M6 — now an array
      noise,
      confidence,
    };
  }
  
  /**
   * 4. 成交量价格均值 (Volume Price Mean)
   * VWAP 风格的加权平均
   */
  calculateVolumePriceMean(
    prices: number[],
    volumes: number[]
  ): { mean: number; upper: number; lower: number } {
    if (prices.length !== volumes.length || prices.length === 0) {
      return { mean: prices[prices.length - 1] || 0, upper: 0, lower: 0 };
    }
    
    let sumPV = 0;
    let sumV = 0;
    
    for (let i = 0; i < prices.length; i++) {
      sumPV += prices[i] * volumes[i];
      sumV += volumes[i];
    }
    
    const mean = sumV > 0 ? sumPV / sumV : prices[prices.length - 1];
    
    // 计算标准差
    let sumSqDiff = 0;
    for (let i = 0; i < prices.length; i++) {
      sumSqDiff += Math.pow(prices[i] - mean, 2) * volumes[i];
    }
    const stdDev = Math.sqrt(sumSqDiff / sumV);
    
    return {
      mean,
      upper: mean + 2 * stdDev,
      lower: mean - 2 * stdDev,
    };
  }
  
  /**
   * 5. 超级趋势估计
   * 基于 ATR 的趋势跟踪
   */
  calculateSupertrend(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 10,
    multiplier: number = 3
  ): { trend: 'up' | 'down'; upper: number; lower: number; signal: number } {
    if (closes.length < period) {
      return { trend: 'up', upper: 0, lower: 0, signal: closes[closes.length - 1] || 0 };
    }
    
    // 计算 ATR
    const atr = this.calculateATR(highs, lows, closes, period);
    const currentClose = closes[closes.length - 1];
    
    // 计算基本上下轨
    const basicUpper = ((highs[highs.length - 1] + lows[lows.length - 1]) / 2) + multiplier * atr;
    const basicLower = ((highs[highs.length - 1] + lows[lows.length - 1]) / 2) - multiplier * atr;
    
    // 简化版超级趋势
    let trend: 'up' | 'down' = 'up';
    
    // 根据价格位置判断趋势
    if (currentClose > basicLower * 1.01) {
      trend = 'up';
    } else if (currentClose < basicUpper * 0.99) {
      trend = 'down';
    }
    
    return {
      trend,
      upper: basicUpper,
      lower: basicLower,
      signal: trend === 'up' ? basicLower : basicUpper,
    };
  }
  
  /**
   * 6. TRIX 三重指数平滑
   * 检测趋势变化
   */
  calculateTRIX(prices: number[], period: number = 15): number {
    if (prices.length < period * 3) return 0;
    
    // 第一次 EMA
    const ema1 = this.calculateEMA(prices, period);
    // 第二次 EMA
    const ema2 = this.calculateEMA(ema1, period);
    // 第三次 EMA
    const ema3 = this.calculateEMA(ema2, period);
    
    if (ema3.length < 2) return 0;
    
    // TRIX = (当前 - 前一期) / 前一期 * 100
    const current = ema3[ema3.length - 1];
    const previous = ema3[ema3.length - 2];
    
    return previous !== 0 ? (current - previous) / previous * 100 : 0;
  }
  
  /**
   * 7. Fisher 变换
   * 将价格转换为高斯分布
   */
  calculateFisher(prices: number[], period: number = 10): { fisher: number; trigger: number } {
    if (prices.length < period) return { fisher: 0, trigger: 0 };
    
    // 找到周期内的最高最低价
    const recent = prices.slice(-period);
    const highest = Math.max(...recent);
    const lowest = Math.min(...recent);
    
    // 计算当前价格在范围内的位置
    const current = prices[prices.length - 1];
    const value = highest !== lowest ? (current - lowest) / (highest - lowest) : 0.5;
    
    // Fisher 变换
    const transformed = 0.5 * Math.log((1 + value) / (1 - value));
    
    // 延迟一期的 Fisher 值 (简化)
    const prevValue = prices.length > period + 1
      ? (prices[prices.length - 2] - lowest) / (highest - lowest)
      : value;
    const prevTransformed = 0.5 * Math.log((1 + prevValue) / (1 - prevValue));
    
    return {
      fisher: isFinite(transformed) ? transformed : 0,
      trigger: isFinite(prevTransformed) ? prevTransformed : 0,
    };
  }
  
  /**
   * 8. Marubozu 异常检测
   * 检测实体极长的 K 线 (可能的趋势反转信号)
   */
  detectMarubozu(
    opens: number[],
    highs: number[],
    lows: number[],
    closes: number[]
  ): { isMarubozu: boolean; type: 'bullish' | 'bearish' | 'none'; strength: number } {
    const i = opens.length - 1;
    if (i < 0) return { isMarubozu: false, type: 'none', strength: 0 };
    
    const open = opens[i];
    const high = highs[i];
    const low = lows[i];
    const close = closes[i];
    
    const bodySize = Math.abs(close - open);
    const totalRange = high - low;
    
    if (totalRange === 0) return { isMarubozu: false, type: 'none', strength: 0 };
    
    // 实体占比 > 80%
    const bodyRatio = bodySize / totalRange;
    
    if (bodyRatio > 0.8) {
      const type = close > open ? 'bullish' : 'bearish';
      return { isMarubozu: true, type, strength: bodyRatio };
    }
    
    return { isMarubozu: false, type: 'none', strength: bodyRatio };
  }
  
  /**
   * 综合信号生成
   * 整合所有 OCS 指标生成交易信号
   */
  generateOCSSignal(data: {
    prices: number[];
    highs: number[];
    lows: number[];
    closes: number[];
    volumes: number[];
    opens?: number[];
  }): {
    type: 'buy' | 'sell' | 'hold';
    strength: number;
    confidence: number;
    targets: { t1: number; t2: number; t3: number };
    stopLoss: number;
    reasoning: string[];
  } {
    const { prices, highs, lows, closes, volumes, opens = closes } = data;
    const currentPrice = closes[closes.length - 1];
    const reasoning: string[] = [];
    
    // 1. Ehlers 自适应移动平均
    const ama = this.calculateEhlersAMA(closes);
    
    // 2. 主导周期
    const cycle = this.calculateEhlersCycle(closes);
    
    // 3. 高斯滤波
    const gaussian = this.calculateGaussian(closes.slice(-20), 0.5);
    
    // 4. 成交量价格均值
    const vpm = this.calculateVolumePriceMean(closes.slice(-20), volumes.slice(-20));
    
    // 5. 超级趋势
    const supertrend = this.calculateSupertrend(highs, lows, closes);
    
    // 6. TRIX
    const trix = this.calculateTRIX(closes, cycle.smoothPeriod);
    
    // 7. Fisher 变换
    const fisher = this.calculateFisher(closes);
    
    // 8. Marubozu 检测
    const marubozu = this.detectMarubozu(opens, highs, lows, closes);
    
    // 信号评分
    let buyScore = 0;
    let sellScore = 0;
    
    // AMA 趋势
    if (ama.trend === 'up') {
      buyScore += 20;
      reasoning.push(`AMA 上升 (周期: ${ama.period})`);
    } else if (ama.trend === 'down') {
      sellScore += 20;
      reasoning.push(`AMA 下降 (周期: ${ama.period})`);
    }
    
    // FIX: M6 — gaussian.filtered is now an array; use last element for scalar comparison
    const lastFilteredValue = gaussian.filtered.length > 0
      ? gaussian.filtered[gaussian.filtered.length - 1]
      : currentPrice;

    // 高斯滤波置信度
    if (gaussian.confidence > 0.7) {
      if (currentPrice > lastFilteredValue) {
        buyScore += 15;
        reasoning.push('高斯滤波确认上升');
      } else {
        sellScore += 15;
        reasoning.push('高斯滤波确认下降');
      }
    }
    
    // 超级趋势
    if (supertrend.trend === 'up') {
      buyScore += 25;
      reasoning.push('超级趋势看多');
    } else {
      sellScore += 25;
      reasoning.push('超级趋势看空');
    }
    
    // TRIX
    if (trix > 0) {
      buyScore += 15;
      reasoning.push(`TRIX 为正 (${trix.toFixed(2)})`);
    } else {
      sellScore += 15;
      reasoning.push(`TRIX 为负 (${trix.toFixed(2)})`);
    }
    
    // Fisher 变换
    if (fisher.fisher > fisher.trigger && fisher.fisher > 0) {
      buyScore += 15;
      reasoning.push('Fisher 上升');
    } else if (fisher.fisher < fisher.trigger && fisher.fisher < 0) {
      sellScore += 15;
      reasoning.push('Fisher 下降');
    }
    
    // Marubozu
    if (marubozu.isMarubozu) {
      if (marubozu.type === 'bullish') {
        buyScore += 10;
        reasoning.push(`看涨 Marubozu (强度: ${(marubozu.strength * 100).toFixed(0)}%)`);
      } else {
        sellScore += 10;
        reasoning.push(`看跌 Marubozu (强度: ${(marubozu.strength * 100).toFixed(0)}%)`);
      }
    }
    
    // 确定信号
    let type: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    
    if (buyScore >= 60 && buyScore > sellScore) {
      type = 'buy';
      strength = buyScore;
    } else if (sellScore >= 60 && sellScore > buyScore) {
      type = 'sell';
      strength = sellScore;
    }
    
    // 信号冷却机制已移除 - 由 LLM 模块控制频率
    // 策略自由产生信号，LLM 模块决定是否调用 API
    
    // 计算目标位
    const atr = this.calculateATR(highs, lows, closes, 14);
    const targets = {
      t1: type === 'buy' ? currentPrice + atr : currentPrice - atr,
      t2: type === 'buy' ? currentPrice + atr * 2 : currentPrice - atr * 2,
      t3: type === 'buy' ? currentPrice + atr * 3 : currentPrice - atr * 3,
    };
    
    const stopLoss = type === 'buy' ? currentPrice - atr * 1.5 : currentPrice + atr * 1.5;
    
    return {
      type,
      strength,
      confidence: gaussian.confidence * (strength / 100),
      targets,
      stopLoss,
      reasoning,
    };
  }
  
  // 辅助方法
  private calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result: number[] = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    
    return result;
  }

  /**
   * RSI 相对强弱指数
   * 基于 OCS 报告：用于识别超买超卖状态
   */
  calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * MACD 指标
   * 基于 OCS 报告：用于动量分析
   */
  calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateSingleEMA(prices, 12);
    const ema26 = this.calculateSingleEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // 简化 Signal 线计算
    const recentPrices = prices.slice(-9);
    const signal = this.calculateSingleEMA(recentPrices, 9);
    
    return {
      macd,
      signal,
      histogram: macd - signal,
    };
  }

  /**
   * 布林带
   * 基于 OCS 报告：用于波动性分析
   */
  calculateBollinger(prices: number[], period: number = 20): {
    upper: number;
    middle: number;
    lower: number;
    percentB: number;
  } {
    const sma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    const variance = prices.slice(-period).reduce((sum, p) => {
      return sum + Math.pow(p - sma, 2);
    }, 0) / period;
    const std = Math.sqrt(variance);
    
    const upper = sma + 2 * std;
    const lower = sma - 2 * std;
    const currentPrice = prices[prices.length - 1];
    
    // %B 指标：价格在布林带中的位置 (0-1)
    const percentB = (currentPrice - lower) / (upper - lower);
    
    return { upper, middle: sma, lower, percentB };
  }

  /**
   * ADX 平均趋向指数
   * 基于 OCS 报告：用于趋势强度分析
   */
  calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
  ): number {
    if (highs.length < period + 1) return 25;
    
    let plusDM = 0;
    let minusDM = 0;
    let trSum = 0;
    
    for (let i = highs.length - period; i < highs.length; i++) {
      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];
      
      if (highDiff > lowDiff && highDiff > 0) plusDM += highDiff;
      if (lowDiff > highDiff && lowDiff > 0) minusDM += lowDiff;
      
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trSum += tr;
    }
    
    const plusDI = (plusDM / trSum) * 100;
    const minusDI = (minusDM / trSum) * 100;
    
    if (plusDI + minusDI === 0) return 0;
    const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
    
    return dx;
  }

  /**
   * 计算单个 EMA 值（非数组）
   */
  private calculateSingleEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }
  
  private calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number {
    if (closes.length < period + 1) return 0;
    
    const trValues: number[] = [];
    for (let i = closes.length - period; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trValues.push(tr);
    }
    
    return trValues.reduce((a, b) => a + b, 0) / trValues.length;
  }
}

export default OCSAnalyzer;
