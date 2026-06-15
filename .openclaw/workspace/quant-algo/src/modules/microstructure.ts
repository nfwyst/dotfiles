/**
 * 微观结构特征提取器（简化版）
 * 基于 OHLCV 数据估算微观结构特征
 * 参考: Bieganowski & Ślepaczuk (2026) "Explainable Patterns in Cryptocurrency Microstructure"
 */

import { OHLCV } from '../events/types';

export interface MicrostructureFeatures {
  // 买卖压力（基于影线）
  buyingPressure: number;  // -1 ~ 1, 正值表示买方压力
  
  // 成交量不平衡
  volumeImbalance: number;  // -1 ~ 1, 正值表示买方主导
  
  // 波动率聚集
  volatilityClustering: number;  // 0 ~ 1, 高值表示波动聚集
  
  // 价格冲击估算（基于量价关系）
  priceImpact: number;  // 0 ~ 1, 高值表示价格易受成交量影响
  
  // 订单流毒性（基于VPIN思想简化）
  flowToxicity: number;  // 0 ~ 1, 高值表示知情交易者可能活跃
  
  // 有效价差
  effectiveSpread: number;  // 百分比形式
}

export class MicrostructureFeatureExtractor {
  private history: OHLCV[] = [];
  private readonly windowSize: number = 20;
  
  /**
   * 提取微观结构特征
   */
  extract(ohlcv: OHLCV[]): MicrostructureFeatures {
    this.history = ohlcv.slice(-this.windowSize);
    
    if (this.history.length < 5) {
      return this.getDefaultFeatures();
    }
    
    return {
      buyingPressure: this.calculateBuyingPressure(),
      volumeImbalance: this.calculateVolumeImbalance(),
      volatilityClustering: this.detectVolatilityClustering(),
      priceImpact: this.estimatePriceImpact(),
      flowToxicity: this.calculateFlowToxicity(),
      effectiveSpread: this.calculateEffectiveSpread()
    };
  }
  
  /**
   * 计算买卖压力（基于影线分析）
   * 上影线长 = 卖方压力
   * 下影线长 = 买方压力
   */
  private calculateBuyingPressure(): number {
    const pressures = this.history.map(candle => {
      const bodySize = Math.abs(candle.close - candle.open);
      const upperShadow = candle.high - Math.max(candle.open, candle.close);
      const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
      
      if (bodySize === 0) return 0;
      
      // 下影线相对强度 - 上影线相对强度
      return (lowerShadow - upperShadow) / bodySize;
    });
    
    // 返回近期平均压力
    return this.average(pressures.slice(-5));
  }
  
  /**
   * 计算成交量不平衡
   * 基于价格位置估算主动买卖量
   */
  private calculateVolumeImbalance(): number {
    const imbalances = this.history.map(candle => {
      const pricePosition = (candle.close - candle.low) / (candle.high - candle.low || 1);
      
      // 收盘价靠近高点 = 买方主导
      // 收盘价靠近低点 = 卖方主导
      if (candle.close > candle.open) {
        return pricePosition * 2 - 1;  // 上涨时的不平衡
      } else {
        return pricePosition * 2 - 1;  // 下跌时的不平衡
      }
    });
    
    // 成交量加权
    const weights = this.history.map(c => c.volume);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    if (totalWeight === 0) return 0;
    
    return imbalances.reduce((sum, imb, i) => sum + imb * weights[i]!, 0) / totalWeight;
  }
  
  /**
   * 检测波动率聚集
   * 使用 GARCH 思想的简化版本
   */
  private detectVolatilityClustering(): number {
    if (this.history.length < 10) return 0.5;
    
    // 计算收益率
    const returns = [];
    for (let i = 1; i < this.history.length; i++) {
      returns.push(
        (this.history[i]!.close - this.history[i-1]!.close) / this.history[i-1]!.close
      );
    }
    
    // 计算波动率
    const volatilities = returns.map(r => Math.abs(r));
    
    // 检测波动率自相关（简化）
    const recentVol = this.average(volatilities.slice(-5));
    const prevVol = this.average(volatilities.slice(-10, -5));
    
    // 波动率聚集 = 近期波动率与前期波动率的相似度
    if (prevVol === 0) return 0.5;
    const ratio = recentVol / prevVol;
    return 1 - Math.min(Math.abs(ratio - 1), 1);  // 越接近1表示聚集越强
  }
  
  /**
   * 估算价格冲击系数
   * 基于成交量与价格变动的关系
   */
  private estimatePriceImpact(): number {
    if (this.history.length < 5) return 0.5;
    
    const impacts = [];
    for (let i = 1; i < this.history.length; i++) {
      const priceChange = Math.abs(
        (this.history[i]!.close - this.history[i-1]!.close) / this.history[i-1]!.close
      );
      const volume = this.history[i]!.volume;
      const avgVolume = this.average(this.history.slice(0, i).map(c => c.volume));
      
      if (avgVolume === 0) continue;
      
      // 价格变动 / 相对成交量
      const relativeVolume = volume / avgVolume;
      if (relativeVolume > 0) {
        impacts.push(priceChange / relativeVolume);
      }
    }
    
    // 归一化到 0-1 范围
    const avgImpact = this.average(impacts);
    return Math.min(avgImpact * 100, 1);  // 放大并截断
  }
  
  /**
   * 计算订单流毒性（VPIN思想简化）
   * 高毒性 = 知情交易者可能活跃
   */
  private calculateFlowToxicity(): number {
    if (this.history.length < 10) return 0.5;
    
    // 计算买卖失衡
    let buyVolume = 0;
    let sellVolume = 0;
    
    this.history.forEach(candle => {
      const pricePosition = (candle.close - candle.low) / (candle.high - candle.low || 1);
      
      // 估算主动买卖量
      if (candle.close >= candle.open) {
        buyVolume += candle.volume * pricePosition;
        sellVolume += candle.volume * (1 - pricePosition);
      } else {
        buyVolume += candle.volume * (1 - pricePosition);
        sellVolume += candle.volume * pricePosition;
      }
    });
    
    const totalVolume = buyVolume + sellVolume;
    if (totalVolume === 0) return 0.5;
    
    // 不平衡度
    const imbalance = Math.abs(buyVolume - sellVolume) / totalVolume;
    
    // 结合波动率
    const volatility = this.calculateCurrentVolatility();
    
    // 高不平衡 + 高波动 = 高毒性
    return Math.min((imbalance + volatility) / 2, 1);
  }
  
  /**
   * 计算有效价差
   * 基于高低价估算
   */
  private calculateEffectiveSpread(): number {
    const spreads = this.history.map(candle => {
      return (candle.high - candle.low) / ((candle.high + candle.low) / 2);
    });
    
    return this.average(spreads.slice(-5));
  }
  
  /**
   * 计算当前波动率
   */
  private calculateCurrentVolatility(): number {
    const returns = [];
    for (let i = 1; i < this.history.length; i++) {
      returns.push(
        (this.history[i]!.close - this.history[i-1]!.close) / this.history[i-1]!.close
      );
    }
    
    const avg = this.average(returns);
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(365 * 24 * 12);  // 年化
  }
  
  /**
   * 平均值计算
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  /**
   * 默认特征值
   */
  private getDefaultFeatures(): MicrostructureFeatures {
    return {
      buyingPressure: 0,
      volumeImbalance: 0,
      volatilityClustering: 0.5,
      priceImpact: 0.5,
      flowToxicity: 0.5,
      effectiveSpread: 0.001
    };
  }
}

// 导出单例
export const microstructureExtractor = new MicrostructureFeatureExtractor();
