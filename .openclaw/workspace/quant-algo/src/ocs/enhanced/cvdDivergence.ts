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

  constructor(lookbackPeriod: number = 20, minStrength: number = 60) {
    this.lookbackPeriod = lookbackPeriod;
    this.minDivergenceStrength = minStrength;
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
      const { open, high, low, close, volume } = data[i];
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
    
    if (prices[currentIndex] <= priceMin * 1.01 && // 当前价格接近最低点
        recentCVD[currentIndex] > cvdMin * 1.1) {     // 但CVD显著高于最低
      
      const priceDrop = (priceMax - prices[currentIndex]) / priceMax;
      const cvdRise = (recentCVD[currentIndex] - cvdMin) / Math.abs(cvdMin);
      
      bullishStrength = Math.min(100, (cvdRise / Math.max(0.01, priceDrop)) * 50);
      bullishDivergence = bullishStrength >= this.minDivergenceStrength;
    }
    
    // 看跌背离检测: 价格创新高，但CVD没有创新高
    let bearishDivergence = false;
    let bearishStrength = 0;
    
    if (prices[currentIndex] >= priceMax * 0.99 && // 当前价格接近最高点
        recentCVD[currentIndex] < cvdMax * 0.9) {     // 但CVD显著低于最高
      
      const priceRise = (prices[currentIndex] - priceMin) / priceMin;
      const cvdDrop = (cvdMax - recentCVD[currentIndex]) / Math.abs(cvdMax);
      
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
        confirmation: recentCVD[currentIndex] > recentCVD[currentIndex - 1],
        reasoning: [
          `看涨背离: 价格接近低点 ${priceMin.toFixed(2)}`,
          `CVD未创新低: ${recentCVD[currentIndex].toFixed(0)} > ${cvdMin.toFixed(0)}`,
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
        confirmation: recentCVD[currentIndex] < recentCVD[currentIndex - 1],
        reasoning: [
          `看跌背离: 价格接近高点 ${priceMax.toFixed(2)}`,
          `CVD未创新高: ${recentCVD[currentIndex].toFixed(0)} < ${cvdMax.toFixed(0)}`,
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
