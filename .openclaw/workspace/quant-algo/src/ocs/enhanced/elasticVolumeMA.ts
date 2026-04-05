/**
 * OCS enhanced: Elastic Volume MA (弹性成交量移动平均)
 * 
 * 特征工程: Layer 2 第二维度
 * 
 * 功能: 使用主导周期作为动态长度，将成交量与价格行为收敛
 * 与普通Volume MA的区别: 动态调整周期，标准化后与价格维度可比
 */

export interface ElasticVMAData {
  value: number;           // 弹性VMA值
  normalized: number;      // 标准化到 -1 到 1
  elasticity: number;      // 弹性系数
  relativeStrength: number; // 相对强度 vs 历史平均
  trend: 'expanding' | 'contracting' | 'neutral';
}

export class ElasticVolumeMA {
  private lookbackPeriod: number;
  private dominantCycle: number = 20;

  constructor(lookbackPeriod: number = 50) {
    this.lookbackPeriod = lookbackPeriod;
  }

  /**
   * 更新主导周期 (由Layer 2调用)
   */
  updateDominantCycle(cycle: number) {
    this.dominantCycle = Math.max(6, Math.min(50, Math.round(cycle)));
  }

  /**
   * 获取成交量弹性特征 (用于3D特征向量)
   * 
   * @param prices 价格数组
   * @param volumes 成交量数组
   * @param atr ATR值
   * @returns 标准化后的成交量弹性 (-1 到 1)
   */
  getVolumeElasticityFeature(prices: number[], volumes: number[], atr: number): number {
    const data = this.calculate(prices, volumes, atr);
    return data.normalized;
  }

  /**
   * 计算弹性VMA
   * 
   * @param prices 价格数组
   * @param volumes 成交量数组
   * @param atr ATR值(未使用，为兼容接口保留)
   */
  calculate(prices: number[], volumes: number[], atr?: number): ElasticVMAData {
    const period = this.dominantCycle;
    
    if (volumes.length < period || prices.length < period) {
      return {
        value: volumes[volumes.length - 1] || 0,
        normalized: 0,
        elasticity: 0,
        relativeStrength: 0,
        trend: 'neutral',
      };
    }

    const i = volumes.length - 1;
    
    // 1. 计算弹性VMA (以dominantCycle为周期的加权移动平均)
    const volumeSlice = volumes.slice(-period);
    const priceSlice = prices.slice(-period);
    
    // 权重: 近期更高，使用价格趋势加权
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let j = 0; j < volumeSlice.length; j++) {
      // 时间衰减权重
      const timeWeight = (j + 1) / period;
      
      // 价格趋势权重
      let trendWeight = 1;
      if (j > 0) {
        const priceChange = (priceSlice[j] - priceSlice[j - 1]) / priceSlice[j - 1];
        trendWeight = 1 + priceChange * 5;
      }
      
      const weight = timeWeight * Math.max(0.5, trendWeight);
      weightedSum += volumeSlice[j] * weight;
      weightSum += weight;
    }
    
    const evma = weightedSum / weightSum;
    
    // 2. 计算历史统计用于标准化
    const historyStart = Math.max(0, i - this.lookbackPeriod);
    const historyVolumes = volumes.slice(historyStart, i + 1);
    const meanVolume = historyVolumes.reduce((a, b) => a + b, 0) / historyVolumes.length;
    const variance = historyVolumes.reduce((sum, v) => sum + Math.pow(v - meanVolume, 2), 0) / historyVolumes.length;
    const stdVolume = Math.sqrt(variance);
    
    // 3. 标准化到 -1 到 1
    const normalized = stdVolume === 0 
      ? 0 
      : Math.max(-1, Math.min(1, (volumes[i] - meanVolume) / (stdVolume * 2)));
    
    // 4. 计算弹性系数
    const elasticity = meanVolume === 0 ? 0 : (volumes[i] / meanVolume - 1);
    
    // 5. 相对强度
    const relativeStrength = elasticity * 100;
    
    // 6. 趋势判断
    let trend: ElasticVMAData['trend'] = 'neutral';
    if (i >= period) {
      const prevEVMA = this.calculatePrevEVMA(volumes.slice(0, -1), prices.slice(0, -1), period);
      if (evma > prevEVMA * 1.1) {
        trend = 'expanding';
      } else if (evma < prevEVMA * 0.9) {
        trend = 'contracting';
      }
    }
    
    return {
      value: evma,
      normalized,
      elasticity,
      relativeStrength,
      trend,
    };
  }

  /**
   * 计算前一个EVMA值
   */
  private calculatePrevEVMA(volumes: number[], prices: number[], period: number): number {
    if (volumes.length < period) return volumes[volumes.length - 1] || 0;
    
    const volumeSlice = volumes.slice(-period);
    const priceSlice = prices.slice(-period);
    
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let j = 0; j < volumeSlice.length; j++) {
      const timeWeight = (j + 1) / period;
      let trendWeight = 1;
      if (j > 0) {
        const priceChange = (priceSlice[j] - priceSlice[j - 1]) / priceSlice[j - 1];
        trendWeight = 1 + priceChange * 5;
      }
      const weight = timeWeight * Math.max(0.5, trendWeight);
      weightedSum += volumeSlice[j] * weight;
      weightSum += weight;
    }
    
    return weightedSum / weightSum;
  }

  /**
   * 计算最新值 (实时使用)
   */
  calculateLatest(prices: number[], volumes: number[], dominantCycle?: number): ElasticVMAData {
    if (dominantCycle) {
      this.updateDominantCycle(dominantCycle);
    }
    return this.calculate(prices, volumes);
  }

  /**
   * 生成特征描述 (用于KNN推理)
   */
  getFeatureDescription(data: ElasticVMAData): string[] {
    const descriptions: string[] = [];
    
    if (data.normalized > 0.5) {
      descriptions.push(`成交量显著放大: ${data.relativeStrength.toFixed(1)}% 高于均值`);
    } else if (data.normalized < -0.5) {
      descriptions.push(`成交量显著萎缩: ${data.relativeStrength.toFixed(1)}% 低于均值`);
    } else {
      descriptions.push(`成交量正常: ${data.relativeStrength.toFixed(1)}%`);
    }
    
    if (data.trend === 'expanding') {
      descriptions.push('成交量趋势: 放量中');
    } else if (data.trend === 'contracting') {
      descriptions.push('成交量趋势: 缩量中');
    }
    
    return descriptions;
  }
}

export default ElasticVolumeMA;
