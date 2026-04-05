/**
 * 门控层间融合模块
 * OCS 2.0 - P2.3
 * 
 * 根据每层历史表现动态调整融合权重
 * 基于: IncA-DES (2025)
 */

export interface LayerPerformance {
  layer: number;
  score: number;        // 近期表现评分
  accuracy: number;     // 准确率
  sharpe: number;       // 夏普比率
  trades: number;       // 交易次数
}

export class GatedLayerFusion {
  private layerWeights: number[];
  private performanceHistory: LayerPerformance[][];
  private readonly HISTORY_SIZE = 50;
  
  constructor() {
    // 初始权重
    this.layerWeights = [0.20, 0.30, 0.30, 0.20]; // L1, L2, L3, L4
    this.performanceHistory = [[], [], [], []];
  }
  
  /**
   * 记录层表现
   */
  recordPerformance(layer: number, performance: LayerPerformance) {
    this.performanceHistory[layer - 1].push(performance);
    if (this.performanceHistory[layer - 1].length > this.HISTORY_SIZE) {
      this.performanceHistory[layer - 1].shift();
    }
  }
  
  /**
   * 更新权重（基于近期表现）
   */
  updateWeights() {
    // 计算每层平均得分
    const avgScores = this.performanceHistory.map(history => {
      if (history.length === 0) return 1.0;
      const recent = history.slice(-10); // 最近10次
      return recent.reduce((sum, p) => sum + p.score, 0) / recent.length;
    });
    
    // Softmax归一化
    const expScores = avgScores.map(s => Math.exp(s));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    
    this.layerWeights = expScores.map(e => e / sumExp);
  }
  
  /**
   * 融合各层输出
   */
  fuse(signals: number[], confidences: number[]): number {
    if (signals.length !== this.layerWeights.length) {
      console.warn('信号数量与权重不匹配');
      return signals.reduce((a, b) => a + b, 0) / signals.length;
    }
    
    // 加权融合，考虑置信度
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < signals.length; i++) {
      const effectiveWeight = this.layerWeights[i] * confidences[i];
      weightedSum += signals[i] * effectiveWeight;
      totalWeight += effectiveWeight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * 获取当前权重
   */
  getWeights(): number[] {
    return [...this.layerWeights];
  }
  
  /**
   * 重置权重
   */
  resetWeights() {
    this.layerWeights = [0.20, 0.30, 0.30, 0.20];
    this.performanceHistory = [[], [], [], []];
  }
}

export const gatedLayerFusion = new GatedLayerFusion();
