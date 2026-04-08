/**
 * 市场状态自适应参数调节器
 * OCS 2.0 - P1.5
 * 
 * 根据市场状态（趋势/震荡）自动调整策略参数
 */

export type MarketState = 'trending' | 'ranging' | 'unknown';

export interface AdaptedParams {
  // Layer 2 Z-Score阈值
  zScoreThreshold: number;
  
  // Layer 3 KNN阈值
  knnThreshold: number;
  
  // 止损倍数
  stopLossMultiplier: number;
  
  // 仓位调整
  positionSizeMultiplier: number;
  
  // 交易频率控制
  minConfidence: number;
}

export class MarketStateAdaptor {
  private adxCache: number[] = [];
  private readonly ADX_PERIOD = 14;
  private readonly TREND_THRESHOLD = 25;
  
  /**
   * 检测市场状态
   */
  detectState(prices: number[], highs: number[], lows: number[]): MarketState {
    if (prices.length < this.ADX_PERIOD * 2) {
      return 'unknown';
    }
    
    const adx = this.calculateADX(prices, highs, lows);
    this.adxCache.push(adx);
    if (this.adxCache.length > 10) this.adxCache.shift();
    
    // 使用平均ADX判断趋势强度
    const avgADX = this.adxCache.reduce((a, b) => a + b, 0) / this.adxCache.length;
    
    if (avgADX > this.TREND_THRESHOLD) {
      return 'trending';
    } else if (avgADX < 20) {
      return 'ranging';
    }
    
    // 使用价格行为辅助判断
    const volatility = this.calculateVolatility(prices);
    if (volatility > 0.03) return 'trending';
    if (volatility < 0.015) return 'ranging';
    
    return 'unknown';
  }
  
  /**
   * 根据市场状态获取适配参数
   */
  getAdaptedParams(state: MarketState): AdaptedParams {
    const paramsMap: Record<MarketState, AdaptedParams> = {
      trending: {
        zScoreThreshold: 1.2,        // 更敏感，更容易触发
        knnThreshold: 45,            // 降低投票门槛
        stopLossMultiplier: 1.8,     // 更宽止损，让趋势奔跑
        positionSizeMultiplier: 1.2, // 加大仓位
        minConfidence: 50            // 降低最低置信度
      },
      ranging: {
        zScoreThreshold: 1.8,        // 更严格，过滤假信号
        knnThreshold: 55,            // 提高投票门槛
        stopLossMultiplier: 1.2,     // 更窄止损，快速止损
        positionSizeMultiplier: 0.8, // 减小仓位
        minConfidence: 60            // 提高最低置信度
      },
      unknown: {
        zScoreThreshold: 1.5,        // 默认值
        knnThreshold: 50,
        stopLossMultiplier: 1.5,
        positionSizeMultiplier: 1.0,
        minConfidence: 55
      }
    };
    
    return paramsMap[state] || paramsMap.unknown;
  }
  
  /**
   * 计算ADX (Average Directional Index)
   */
  private calculateADX(prices: number[], highs: number[], lows: number[]): number {
    const period = this.ADX_PERIOD;
    if (prices.length < period * 2) return 25;
    
    // 简化版ADX计算
    let plusDM = 0, minusDM = 0, trSum = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];
      
      if (highDiff > lowDiff && highDiff > 0) plusDM += highDiff;
      if (lowDiff > highDiff && lowDiff > 0) minusDM += lowDiff;
      
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - prices[i - 1]),
        Math.abs(lows[i] - prices[i - 1])
      );
      trSum += tr;
    }
    
    const plusDI = (plusDM / trSum) * 100;
    const minusDI = (minusDM / trSum) * 100;
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    
    return dx;
  }
  
  /**
   * 计算波动率
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 20) return 0.02;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(365 * 24 * 12); // 年化
  }
}

export const marketStateAdaptor = new MarketStateAdaptor();
