/**
 * OCS enhanced: CVD 背离信号 (Cumulative Volume Delta)
 * 
 * 功能: 检测价格与累积成交量差的背离
 * 原理: 
 * - CVD = 买入成交量 - 卖出成交量的累积值
 * - 看涨背离: 价格创新低但CVD创新高 (卖压减弱)
 * - 看跌背离: 价格创新高但CVD创新低 (买压减弱)
 */

export interface CVDData {
  cvd: number;                    // 累积成交量差
  delta: number;                  // 当前K线delta
  bullish: boolean;               // 是否看涨(买入占优)
  bearish: boolean;               // 是否看跌(卖出占优)
}

export interface CVDDivergence {
  type: 'bullish' | 'bearish' | 'none';
  strength: number;               // 背离强度 0-100
  priceExtreme: number;           // 价格极值
  cvdExtreme: number;             // CVD极值
  barIndex: number;               // 背离发生的K线索引
  confirmation: boolean;          // 是否已确认
  reasoning: string[];
}

export class CVDAnalyzer {
  private lookbackPeriod: number;
  private minDivergenceStrength: number;
  private cvdHistory: number[] = [];

  // ── Incremental state ──
  private cumulativeCVD: number = 0;
  private incBarCount: number = 0;
  // Circular buffer of last lookbackPeriod (price, delta) pairs
  private priceBuffer: number[];
  private deltaBuffer: number[];      // store per-bar delta, NOT absolute CVD
  private bufferHead: number = 0;
  private bufferCount: number = 0;
  private prevCVD: number = 0;

  constructor(lookbackPeriod: number = 20, minStrength: number = 60) {
    this.lookbackPeriod = lookbackPeriod;
    this.minDivergenceStrength = minStrength;
    this.priceBuffer = new Array(lookbackPeriod + 1).fill(0);
    this.deltaBuffer = new Array(lookbackPeriod + 1).fill(0);
  }

  /**
   * Reset incremental state
   */
  reset(): void {
    this.cumulativeCVD = 0;
    this.incBarCount = 0;
    this.bufferHead = 0;
    this.bufferCount = 0;
    this.prevCVD = 0;
    this.priceBuffer.fill(0);
    this.deltaBuffer.fill(0);
    this.cvdHistory = [];
  }

  /**
   * Incremental O(1) update for a single new candle.
   * Computes delta, updates running CVD, and detects divergence
   * using a circular buffer instead of rebuilding the full array.
   */
  updateBar(candle: { open: number; high: number; low: number; close: number; volume: number }): {
    cvdData: CVDData;
    divergence: CVDDivergence;
  } {
    this.incBarCount++;

    // Compute delta for this candle
    const delta = this.calculateDelta(candle.open, candle.high, candle.low, candle.close, candle.volume);
    this.prevCVD = this.cumulativeCVD;
    this.cumulativeCVD += delta;

    const cvdData: CVDData = {
      cvd: this.cumulativeCVD,
      delta,
      bullish: delta > 0,
      bearish: delta < 0,
    };

    // Push into circular buffer – store DELTA (not absolute CVD)
    const capacity = this.lookbackPeriod + 1;
    this.priceBuffer[this.bufferHead] = candle.close;
    this.deltaBuffer[this.bufferHead] = delta;
    this.bufferHead = (this.bufferHead + 1) % capacity;
    if (this.bufferCount < capacity) this.bufferCount++;

    // Detect divergence using circular buffer
    const divergence = this.detectDivergenceIncremental(candle.close, this.cumulativeCVD);

    return { cvdData, divergence };
  }

  /**
   * Detect divergence using the circular buffer contents (O(lookbackPeriod)).
   * Recomputes LOCAL cumulative CVD over just the buffer entries so that the
   * divergence window matches the array version's behavior (CVD starting from 0
   * at the beginning of the window).
   */
  private detectDivergenceIncremental(currentPrice: number, currentCVD: number): CVDDivergence {
    if (this.bufferCount < 3) {
      return { type: 'none', strength: 0, priceExtreme: 0, cvdExtreme: 0, barIndex: this.incBarCount - 1, confirmation: false, reasoning: ['无背离信号'] };
    }

    const capacity = this.lookbackPeriod + 1;

    // Recompute local CVD from the buffer's delta entries
    let localCVD = 0;
    let priceMin = Infinity, priceMax = -Infinity;
    let cvdMin = Infinity, cvdMax = -Infinity;
    let localCurrentCVD = 0;
    let localPrevCVD = 0;

    const start = (this.bufferHead - this.bufferCount + capacity) % capacity;
    for (let k = 0; k < this.bufferCount; k++) {
      const idx = (start + k) % capacity;
      const p = this.priceBuffer[idx]!;
      const d = this.deltaBuffer[idx]!;
      localCVD += d;

      if (p < priceMin) priceMin = p;
      if (p > priceMax) priceMax = p;
      if (localCVD < cvdMin) cvdMin = localCVD;
      if (localCVD > cvdMax) cvdMax = localCVD;

      if (k === this.bufferCount - 1) {
        localCurrentCVD = localCVD;
      }
      if (k === this.bufferCount - 2) {
        localPrevCVD = localCVD;
      }
    }

    // Bullish divergence: price near low, CVD not near low
    let bullishDivergence = false;
    let bullishStrength = 0;

    if (currentPrice <= priceMin * 1.01 && localCurrentCVD > cvdMin * 1.1) {
      const priceDrop = (priceMax - currentPrice) / priceMax;
      const cvdRise = (localCurrentCVD - cvdMin) / Math.abs(cvdMin || 1);
      bullishStrength = Math.min(100, (cvdRise / Math.max(0.01, priceDrop)) * 50);
      bullishDivergence = bullishStrength >= this.minDivergenceStrength;
    }

    // Bearish divergence: price near high, CVD not near high
    let bearishDivergence = false;
    let bearishStrength = 0;

    if (currentPrice >= priceMax * 0.99 && localCurrentCVD < cvdMax * 0.9) {
      const priceRise = (currentPrice - priceMin) / (priceMin || 1);
      const cvdDrop = (cvdMax - localCurrentCVD) / Math.abs(cvdMax || 1);
      bearishStrength = Math.min(100, (cvdDrop / Math.max(0.01, priceRise)) * 50);
      bearishDivergence = bearishStrength >= this.minDivergenceStrength;
    }

    if (bullishDivergence && bullishStrength > bearishStrength) {
      return {
        type: 'bullish',
        strength: bullishStrength,
        priceExtreme: priceMin,
        cvdExtreme: cvdMin,
        barIndex: this.incBarCount - 1,
        confirmation: localCurrentCVD > localPrevCVD,
        reasoning: [
          `看涨背离: 价格接近低点 ${priceMin.toFixed(2)}`,
          `CVD未创新低: ${localCurrentCVD.toFixed(0)} > ${cvdMin.toFixed(0)}`,
          `背离强度: ${bullishStrength.toFixed(1)}%`,
          '卖压减弱，可能即将反弹'
        ],
      };
    } else if (bearishDivergence) {
      return {
        type: 'bearish',
        strength: bearishStrength,
        priceExtreme: priceMax,
        cvdExtreme: cvdMax,
        barIndex: this.incBarCount - 1,
        confirmation: localCurrentCVD < localPrevCVD,
        reasoning: [
          `看跌背离: 价格接近高点 ${priceMax.toFixed(2)}`,
          `CVD未创新高: ${localCurrentCVD.toFixed(0)} < ${cvdMax.toFixed(0)}`,
          `背离强度: ${bearishStrength.toFixed(1)}%`,
          '买压减弱，可能即将回调'
        ],
      };
    }

    return {
      type: 'none',
      strength: 0,
      priceExtreme: 0,
      cvdExtreme: 0,
      barIndex: this.incBarCount - 1,
      confirmation: false,
      reasoning: ['无背离信号'],
    };
  }

  /**
   * 计算单根K线的Delta
   * Delta = (Close - Open) / (High - Low) * Volume
   * 简化为根据收盘价位置估算
   */
  private calculateDelta(
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number
  ): number {
    if (high === low) return 0;
    
    // 根据K线实体和影线计算Delta
    const bodySize = Math.abs(close - open);
    const totalRange = high - low;
    
    // 收盘价在K线中的相对位置
    const closePosition = (close - low) / totalRange;
    
    // Delta估算: 假设买方卖方分布
    // 收盘在高位 -> 买方占优 (正Delta)
    // 收盘在低位 -> 卖方占优 (负Delta)
    const deltaPercent = (closePosition - 0.5) * 2; // -1 to 1
    
    return deltaPercent * volume;
  }

  /**
   * 计算累积成交量差 (CVD)
   */
  calculateCVD(
    data: { open: number; high: number; low: number; close: number; volume: number }[]
  ): CVDData[] {
    const result: CVDData[] = [];
    let cumulativeCVD = 0;
    
    for (let i = 0; i < data.length; i++) {
      const { open, high, low, close, volume } = data[i]!;
      const delta = this.calculateDelta(open, high, low, close, volume);
      cumulativeCVD += delta;
      
      result.push({
        cvd: cumulativeCVD,
        delta,
        bullish: delta > 0,
        bearish: delta < 0,
      });
    }
    
    // 更新历史
    this.cvdHistory = result.map(r => r.cvd);
    
    return result;
  }

  /**
   * 检测背离
   */
  detectDivergence(
    prices: number[],
    cvdData: CVDData[],
    currentIndex: number
  ): CVDDivergence {
    const lookback = Math.min(this.lookbackPeriod, currentIndex);
    const recentPrices = prices.slice(currentIndex - lookback, currentIndex + 1);
    const recentCVD = cvdData.slice(currentIndex - lookback, currentIndex + 1).map(d => d.cvd);

    // Use local index within sliced arrays (not the global currentIndex)
    const lastIdx = recentPrices.length - 1;
    
    // 找价格极值
    const priceMin = Math.min(...recentPrices);
    const priceMax = Math.max(...recentPrices);
    const priceMinIndex = recentPrices.indexOf(priceMin);
    const priceMaxIndex = recentPrices.indexOf(priceMax);
    
    // 找CVD极值
    const cvdMin = Math.min(...recentCVD);
    const cvdMax = Math.max(...recentCVD);
    
    // 看涨背离检测: 价格创新低，但CVD没有创新低
    let bullishDivergence = false;
    let bullishStrength = 0;
    
    if (recentPrices[lastIdx]! <= priceMin * 1.01 && // 当前价格接近最低点
        recentCVD[lastIdx]! > cvdMin * 1.1) {           // 但CVD显著高于最低
      
      const priceDrop = (priceMax - recentPrices[lastIdx]!) / priceMax;
      const cvdRise = (recentCVD[lastIdx]! - cvdMin) / Math.abs(cvdMin || 1);
      
      bullishStrength = Math.min(100, (cvdRise / Math.max(0.01, priceDrop)) * 50);
      bullishDivergence = bullishStrength >= this.minDivergenceStrength;
    }
    
    // 看跌背离检测: 价格创新高，但CVD没有创新高
    let bearishDivergence = false;
    let bearishStrength = 0;
    
    if (recentPrices[lastIdx]! >= priceMax * 0.99 && // 当前价格接近最高点
        recentCVD[lastIdx]! < cvdMax * 0.9) {           // 但CVD显著低于最高
      
      const priceRise = (recentPrices[lastIdx]! - priceMin) / (priceMin || 1);
      const cvdDrop = (cvdMax - recentCVD[lastIdx]!) / Math.abs(cvdMax || 1);
      
      bearishStrength = Math.min(100, (cvdDrop / Math.max(0.01, priceRise)) * 50);
      bearishDivergence = bearishStrength >= this.minDivergenceStrength;
    }
    
    // 确定背离类型
    let divergence: CVDDivergence;
    
    if (bullishDivergence && bullishStrength > bearishStrength) {
      divergence = {
        type: 'bullish',
        strength: bullishStrength,
        priceExtreme: priceMin,
        cvdExtreme: cvdMin,
        barIndex: currentIndex,
        confirmation: lastIdx > 0 && recentCVD[lastIdx]! > recentCVD[lastIdx - 1]!,
        reasoning: [
          `看涨背离: 价格接近低点 ${priceMin.toFixed(2)}`,
          `CVD未创新低: ${recentCVD[lastIdx]!.toFixed(0)} > ${cvdMin.toFixed(0)}`,
          `背离强度: ${bullishStrength.toFixed(1)}%`,
          '卖压减弱，可能即将反弹'
        ],
      };
    } else if (bearishDivergence) {
      divergence = {
        type: 'bearish',
        strength: bearishStrength,
        priceExtreme: priceMax,
        cvdExtreme: cvdMax,
        barIndex: currentIndex,
        confirmation: lastIdx > 0 && recentCVD[lastIdx]! < recentCVD[lastIdx - 1]!,
        reasoning: [
          `看跌背离: 价格接近高点 ${priceMax.toFixed(2)}`,
          `CVD未创新高: ${recentCVD[lastIdx]!.toFixed(0)} < ${cvdMax.toFixed(0)}`,
          `背离强度: ${bearishStrength.toFixed(1)}%`,
          '买压减弱，可能即将回调'
        ],
      };
    } else {
      divergence = {
        type: 'none',
        strength: 0,
        priceExtreme: 0,
        cvdExtreme: 0,
        barIndex: currentIndex,
        confirmation: false,
        reasoning: ['无背离信号'],
      };
    }
    
    return divergence;
  }

  /**
   * 批量检测所有背离
   */
  detectAllDivergences(
    prices: number[],
    data: { open: number; high: number; low: number; close: number; volume: number }[]
  ): CVDDivergence[] {
    const cvdData = this.calculateCVD(data);
    const divergences: CVDDivergence[] = [];
    
    for (let i = this.lookbackPeriod; i < prices.length; i++) {
      const div = this.detectDivergence(prices, cvdData, i);
      if (div.type !== 'none') {
        divergences.push(div);
      }
    }
    
    return divergences;
  }
}

export default CVDAnalyzer;
