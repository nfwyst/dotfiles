/**
 * OCS Layer 1: 时间序列处理层
 * 严格遵循技术报告实现 + v312增强
 * - Volume Price Mean (VPM)
 * - Kaufman Adaptive Moving Average (KAMA)
 * - Relative Strength Stochastics on Supertrend
 * - Gaussian Structure Framework (v312)
 */

import { GaussianStructure } from './enhanced/gaussianStructure';
import { OHLCV } from '../events/types';
import { type Layer1Config, DEFAULT_OCS_CONFIG } from '../config/ocsConfig';

export interface Layer1Output {
  // VPM
  vpm: {
    value: number;
    upperBand: number;
    lowerBand: number;
    position: number; // 0-1
  };
  
  // Kaufman AMA (KAMA)
  ama: {
    value: number;
    trend: 'up' | 'down' | 'flat';
    period: number;
  };
  
  // Supertrend + Stochastics
  supertrend: {
    value: number;
    direction: 'up' | 'down';
  };
  stochastics: {
    k: number;
    d: number;
    oversold: boolean;
    overbought: boolean;
  };
  
  // ATR for later layers
  atr14: number;
  
  // v312: Gaussian Structure
  gaussian: {
    smoothedClose: number;
    smoothedVolume: number;
    sigma: number;
    windowSize: number;
  };
}

export class OCSLayer1 {
  private gaussianStructure: GaussianStructure;
  private readonly config: Layer1Config;

  // BUG 17 FIX: Add state persistence for Supertrend
  private supertrendState: {
    direction: 'up' | 'down';
    prevUpperBand: number;
    prevLowerBand: number;
    prevClose: number;
  } | null = null;
  
  constructor(config?: Partial<Layer1Config>) {
    const mergedConfig: Layer1Config = { ...DEFAULT_OCS_CONFIG.layer1, ...config };
    this.config = mergedConfig;
    // Deep-merge nested objects
    if (config) {
      if (config.vpm) this.config.vpm = { ...DEFAULT_OCS_CONFIG.layer1.vpm, ...config.vpm };
      if (config.ama) this.config.ama = { ...DEFAULT_OCS_CONFIG.layer1.ama, ...config.ama };
      if (config.supertrend) this.config.supertrend = { ...DEFAULT_OCS_CONFIG.layer1.supertrend, ...config.supertrend };
      if (config.stochastics) this.config.stochastics = { ...DEFAULT_OCS_CONFIG.layer1.stochastics, ...config.stochastics };
      if (config.atr) this.config.atr = { ...DEFAULT_OCS_CONFIG.layer1.atr, ...config.atr };
      if (config.gaussian) this.config.gaussian = { ...DEFAULT_OCS_CONFIG.layer1.gaussian, ...config.gaussian };
    }
    this.gaussianStructure = new GaussianStructure(
      this.config.gaussian.sigma,
      this.config.gaussian.windowSize,
    );
  }

  process(data: OHLCV[]): Layer1Output {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);
    
    // 计算高斯平滑 (v312)
    const gaussianClose = this.gaussianStructure.smooth(closes);
    const gaussianVolume = this.gaussianStructure.smooth(volumes);
    
    return {
      vpm: this.calculateVPM(closes, volumes),
      ama: this.calculateKaufmanAMA(closes),
      supertrend: this.calculateSupertrend(highs, lows, closes),
      stochastics: this.calculateStochastics(highs, lows, closes),
      atr14: this.calculateATR(highs, lows, closes, this.config.atr.period),
      gaussian: {
        smoothedClose: gaussianClose.value,
        smoothedVolume: gaussianVolume.value,
        sigma: gaussianClose.sigma,
        windowSize: gaussianClose.windowSize,
      },
    };
  }
  
  /**
   * Volume Price Mean (VPM)
   * 计算市场参与者的平均持仓成本
   * BUG 16 FIX: Guard against div-by-zero when totalVolume=0 or std=0
   */
  private calculateVPM(prices: number[], volumes: number[]): Layer1Output['vpm'] {
    const period = Math.min(this.config.vpm.lookback, prices.length);
    const recentPrices = prices.slice(-period);
    const recentVolumes = volumes.slice(-period);
    
    let totalVolume = 0;
    let weightedSum = 0;
    
    for (let i = 0; i < period; i++) {
      totalVolume += recentVolumes[i];
      weightedSum += recentPrices[i] * recentVolumes[i];
    }
    
    const bandMult = this.config.vpm.bandMultiplier;

    // BUG 16 FIX: Guard against totalVolume === 0
    if (totalVolume === 0) {
      const currentPrice = prices[prices.length - 1];
      return {
        value: currentPrice,
        upperBand: currentPrice,
        lowerBand: currentPrice,
        position: 0.5,
      };
    }
    
    const mean = weightedSum / totalVolume;
    
    // 计算标准差
    let variance = 0;
    for (let i = 0; i < period; i++) {
      variance += Math.pow(recentPrices[i] - mean, 2);
    }
    variance /= period;
    const std = Math.sqrt(variance);
    
    const currentPrice = prices[prices.length - 1];
    
    // BUG 16 FIX: Guard against std === 0
    if (std === 0) {
      return {
        value: mean,
        upperBand: mean,
        lowerBand: mean,
        position: 0.5,
      };
    }
    
    return {
      value: mean,
      upperBand: mean + bandMult * std,
      lowerBand: mean - bandMult * std,
      position: (currentPrice - (mean - bandMult * std)) / (2 * bandMult * std),
    };
  }
  
  /**
   * Kaufman Adaptive Moving Average (KAMA)
   * 使用效率比率(ER)动态调整平滑系数
   * BUG 6 FIX: Correct prevAMA formula
   * BUG 7 FIX: Recompute ER and sc inside the loop for each bar
   */
  private calculateKaufmanAMA(prices: number[]): Layer1Output['ama'] {
    const { fastLength, slowLength, erPeriod, trendThreshold } = this.config.ama;
    
    if (prices.length < erPeriod) {
      return { value: prices[prices.length - 1], trend: 'flat', period: 20 };
    }
    
    // BUG 7 FIX: Compute AMA iteratively with per-bar adaptive smoothing constant
    let ama = prices[0];
    let prevAma = ama;
    let lastSC = 0;
    
    for (let i = 1; i < prices.length; i++) {
      // Compute ER for this bar (need at least erPeriod bars of history)
      let sc: number;
      if (i >= erPeriod) {
        const change = Math.abs(prices[i] - prices[i - erPeriod]);
        let volatility = 0;
        for (let j = i - erPeriod + 1; j <= i; j++) {
          volatility += Math.abs(prices[j] - prices[j - 1]);
        }
        const er = volatility === 0 ? 0 : change / volatility;
        
        const fastSC = 2 / (fastLength + 1);
        const slowSC = 2 / (slowLength + 1);
        sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
      } else {
        // Not enough data for ER yet, use slow smoothing
        sc = Math.pow(2 / (slowLength + 1), 2);
      }
      
      prevAma = ama;
      ama = sc * prices[i] + (1 - sc) * ama;
      lastSC = sc;
    }
    
    // BUG 6 FIX: prevAMA is now correctly tracked as the AMA value from the previous bar
    const trend = ama > prevAma * (1 + trendThreshold) ? 'up' : ama < prevAma * (1 - trendThreshold) ? 'down' : 'flat';
    
    return {
      value: ama,
      trend,
      period: Math.round(2 / (lastSC || 0.01) - 1),
    };
  }
  
  /**
   * Supertrend - 基于ATR的趋势跟踪
   * BUG 17 FIX: Add state persistence for direction and previous bands
   */
  private calculateSupertrend(highs: number[], lows: number[], closes: number[]): Layer1Output['supertrend'] {
    const { period, multiplier } = this.config.supertrend;
    
    const atr = this.calculateATR(highs, lows, closes, period);
    const lastClose = closes[closes.length - 1];
    const lastHigh = highs[highs.length - 1];
    const lastLow = lows[lows.length - 1];
    
    const hl2 = (lastHigh + lastLow) / 2;
    let basicUpperBand = hl2 + multiplier * atr;
    let basicLowerBand = hl2 - multiplier * atr;
    
    let direction: 'up' | 'down';
    
    if (this.supertrendState) {
      // Carry forward bands: only tighten, never widen
      const finalUpperBand = (basicUpperBand < this.supertrendState.prevUpperBand || this.supertrendState.prevClose > this.supertrendState.prevUpperBand)
        ? basicUpperBand
        : this.supertrendState.prevUpperBand;
      
      const finalLowerBand = (basicLowerBand > this.supertrendState.prevLowerBand || this.supertrendState.prevClose < this.supertrendState.prevLowerBand)
        ? basicLowerBand
        : this.supertrendState.prevLowerBand;
      
      // Determine direction based on previous direction and current close vs bands
      if (this.supertrendState.direction === 'down') {
        // Was bearish — switch to bullish if close crosses above upper band
        direction = lastClose > finalUpperBand ? 'up' : 'down';
      } else {
        // Was bullish — switch to bearish if close crosses below lower band
        direction = lastClose < finalLowerBand ? 'down' : 'up';
      }
      
      // Update state
      this.supertrendState = {
        direction,
        prevUpperBand: finalUpperBand,
        prevLowerBand: finalLowerBand,
        prevClose: lastClose,
      };
      
      return {
        value: direction === 'up' ? finalLowerBand : finalUpperBand,
        direction,
      };
    } else {
      // First call — initialize state
      direction = lastClose > basicUpperBand ? 'up' : lastClose < basicLowerBand ? 'down' : 'up';
      
      this.supertrendState = {
        direction,
        prevUpperBand: basicUpperBand,
        prevLowerBand: basicLowerBand,
        prevClose: lastClose,
      };
      
      return {
        value: direction === 'up' ? basicLowerBand : basicUpperBand,
        direction,
      };
    }
  }
  
  /**
   * Stochastics - 动量振荡器
   * BUG 22 FIX: Guard against highestHigh === lowestLow
   */
  private calculateStochastics(highs: number[], lows: number[], closes: number[]): Layer1Output['stochastics'] {
    const { kPeriod, dPeriod, oversoldThreshold, overboughtThreshold } = this.config.stochastics;
    
    if (closes.length < kPeriod) {
      return { k: 50, d: 50, oversold: false, overbought: false };
    }
    
    const lowestLow = Math.min(...lows.slice(-kPeriod));
    const highestHigh = Math.max(...highs.slice(-kPeriod));
    const currentClose = closes[closes.length - 1];
    
    // BUG 22 FIX: Guard against highestHigh === lowestLow
    const k = highestHigh === lowestLow ? 50 : ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // 简化的D值（K的SMA）
    let d = k;
    if (closes.length >= kPeriod + dPeriod - 1) {
      let sumK = 0;
      for (let i = 0; i < dPeriod; i++) {
        const periodLowest = Math.min(...lows.slice(-kPeriod - i, -i || undefined));
        const periodHighest = Math.max(...highs.slice(-kPeriod - i, -i || undefined));
        const periodClose = closes[closes.length - 1 - i];
        // BUG 22 FIX: Also guard the inner stochastic computation
        const periodK = periodHighest === periodLowest ? 50 : ((periodClose - periodLowest) / (periodHighest - periodLowest)) * 100;
        sumK += periodK;
      }
      d = sumK / dPeriod;
    }
    
    return {
      k: Math.max(0, Math.min(100, k)),
      d: Math.max(0, Math.min(100, d)),
      oversold: k < oversoldThreshold,
      overbought: k > overboughtThreshold,
    };
  }
  
  /**
   * ATR - 平均真实波幅
   */
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (closes.length < 2) return 0;
    
    const trs: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
    }
    
    if (trs.length < period) {
      return trs.reduce((a, b) => a + b, 0) / trs.length;
    }
    
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }
}

export default OCSLayer1;
