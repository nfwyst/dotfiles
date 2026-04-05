/**
 * OCS Layer 3: 机器学习层
 * KNN三维分类器
 * 特征: [价格位置, 成交量弹性, 周期相位]
 */

import { Layer2Output } from './layer2';

export interface HistoricalPattern {
  features: [number, number, number]; // 3D feature vector
  /**
   * Realized Return (NOT future prediction)
   * 
   * ANTI LOOK-AHEAD BIAS: This value represents the actual return
   * after a trade closed, calculated from real entry/exit prices.
   * 
   * For live trading, use PatternRecorder to manage the delayed update:
   * - Record features at trade open
   * - Calculate return and update this history at trade close
   */
  futureReturn: number;  // Kept for backward compatibility
  label: 'buy' | 'sell' | 'hold';
  timestamp: number;
}
export interface Layer3Output {
  signal: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-100%
  buyConfidence: number;
  sellConfidence: number;
  neighbors: HistoricalPattern[];
  reasoning: string[];
}

export class OCSLayer3 {
  private history: HistoricalPattern[];
  private readonly MAX_HISTORY: number;
  private currentK: number;
  
  constructor() {
    this.history = [];
    this.currentK = 5; // 默认 K 值
    this.MAX_HISTORY = 1000;
  }
  
  /**
   * 计算市场波动率 (基于ATR百分比)
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 20) return 0.02; // 默认中等波动
    
    // 计算 14 周期 ATR
    const atr = this.calculateATR(prices, 14);
    const currentPrice = prices[prices.length - 1];
    
    return atr / currentPrice; // ATR 百分比
  }
  
  /**
   * 计算 ATR
   */
  private calculateATR(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    
    let sum = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const high = Math.max(prices[i], prices[i - 1]);
      const low = Math.min(prices[i], prices[i - 1]);
      const tr = high - low;
      sum += tr;
    }
    
    return sum / period;
  }
  
  /**
   * 根据波动率自适应调整 K 值
   * 高波动: K=3 (减少噪声干扰)
   * 低波动: K=7 (提高稳定性)
   * 正常: K=5
   */
  private adaptK(volatility: number): number {
    if (volatility > 0.03) {
      return 3; // 高波动，使用小 K 减少噪声
    } else if (volatility < 0.01) {
      return 7; // 低波动，使用大 K 提高稳定性
    }
    return 5; // 正常波动
  }
  
  process(features3D: [number, number, number], prices: number[]): Layer3Output {
    // 1. 根据波动率自适应调整 K
    const volatility = this.calculateVolatility(prices);
    this.currentK = this.adaptK(volatility);
    
    // 2. 如果历史数据不足，返回hold
    if (this.history.length < this.currentK) {
      return {
        signal: 'hold',
        confidence: 0,
        buyConfidence: 0,
        sellConfidence: 0,
        neighbors: [],
        reasoning: [`历史数据不足 (K=${this.currentK}, 波动率=${(volatility * 100).toFixed(2)}%)`],
      };
    }
    
    // 2. KNN分类（带距离加权）
    const distances = this.findKNearestNeighborsWithDistance(features3D);
    const neighbors = distances.map(d => d.neighbor);
    
    // 3. 加权投票 - 距离越近的邻居权重越高
    const weightedVotes = { buy: 0, sell: 0, hold: 0 };
    
    for (const { neighbor, distance } of distances) {
      const weight = 1 / (distance + 0.001); // 避免除零
      weightedVotes[neighbor.label] += weight;
    }
    
    // 4. 计算加权置信度
    const totalWeight = weightedVotes.buy + weightedVotes.sell + weightedVotes.hold;
    const buyConfidence = (weightedVotes.buy / totalWeight) * 100;
    const sellConfidence = (weightedVotes.sell / totalWeight) * 100;
    
    // 5. 确定信号 (优化: 阈值45%，提高交易频率)
    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;
    
    // 降低阈值从50%到45%，提高信号频率
    if (buyConfidence >= 45 && buyConfidence > sellConfidence) {
      signal = 'buy';
      confidence = buyConfidence;
    } else if (sellConfidence >= 45 && sellConfidence > buyConfidence) {
      signal = 'sell';
      confidence = sellConfidence;
    }
    
    // 6. 生成推理说明
    const reasoning = this.generateReasoning(neighbors, features3D, volatility, this.currentK);
    
    return {
      signal,
      confidence,
      buyConfidence,
      sellConfidence,
      neighbors,
      reasoning,
    };
  }
  
  /**
   * 查找K个最近邻居（带距离）
   */
  private findKNearestNeighborsWithDistance(features: [number, number, number]): { neighbor: HistoricalPattern; distance: number }[] {
    const distances = this.history.map(pattern => ({
      neighbor: pattern,
      distance: this.euclideanDistance(features, pattern.features),
    }));
    
    // 按距离排序
    distances.sort((a, b) => a.distance - b.distance);
    
    // 返回前K个（使用自适应K）
    return distances.slice(0, this.currentK);
  }
  
  /**
   * 欧几里得距离
   */
  private euclideanDistance(a: [number, number, number], b: [number, number, number]): number {
    return Math.sqrt(
      Math.pow(a[0] - b[0], 2) +
      Math.pow(a[1] - b[1], 2) +
      Math.pow(a[2] - b[2], 2)
    );
  }
  
  /**
   * 生成推理说明
   */
  private generateReasoning(
    neighbors: HistoricalPattern[], 
    currentFeatures: [number, number, number],
    volatility: number,
    k: number
  ): string[] {
    const reasons: string[] = [];
    
    // 添加自适应K信息
    const volLevel = volatility > 0.03 ? '高' : volatility < 0.01 ? '低' : '正常';
    reasons.push(`自适应KNN: K=${k} (${volLevel}波动率 ${(volatility * 100).toFixed(2)}%)`);
    
    // 分析邻居特征
    const avgPricePos = neighbors.reduce((sum, n) => sum + n.features[0], 0) / neighbors.length;
    const avgVolElasticity = neighbors.reduce((sum, n) => sum + n.features[1], 0) / neighbors.length;
    const avgCyclePhase = neighbors.reduce((sum, n) => sum + n.features[2], 0) / neighbors.length;
    
    // 价格位置分析
    if (currentFeatures[0] < 0.3) {
      reasons.push('价格处于近期低位区间，可能存在反弹机会');
    } else if (currentFeatures[0] > 0.7) {
      reasons.push('价格处于近期高位区间，可能存在回调风险');
    }
    
    // 成交量分析
    if (currentFeatures[1] > 0.5) {
      reasons.push('成交量放大，资金活跃度提升');
    } else if (currentFeatures[1] < -0.5) {
      reasons.push('成交量萎缩，市场观望情绪浓厚');
    }
    
    // 周期相位分析
    if (Math.abs(currentFeatures[2]) > 0.7) {
      reasons.push('处于周期极端位置，可能即将转向');
    }
    
    // 邻居表现
    const positiveNeighbors = neighbors.filter(n => n.futureReturn > 0).length;
    reasons.push(`历史相似模式中${positiveNeighbors}/${neighbors.length}实现盈利`);
    
    return reasons;
  }
  
/**
   * Update history with realized return (DELAYED UPDATE)
   * 
   * ANTI LOOK-AHEAD BIAS: This method should ONLY be called AFTER
   * a position is closed, using the actual entry and exit prices.
   * 
   * DO NOT call this method before or during a trade - that would
   * introduce look-ahead bias by using information not yet available.
   * 
   * Recommended: Use PatternRecorder in ExecutionLayer to automate this.
   * 
   * @param features Feature vector at trade open time
   * @param entryPrice Actual entry price
   * @param exitPrice Actual exit price (only known after close)
   * @param side Trade direction
   */
  updateHistory(
    features: [number, number, number],
    entryPrice: number,
    exitPrice: number,
    side: 'long' | 'short'
  ) {
    const realizedReturn = side === 'long'
      ? (exitPrice - entryPrice) / entryPrice
      : (entryPrice - exitPrice) / entryPrice;
    
    let label: 'buy' | 'sell' | 'hold' = 'hold';
    if (realizedReturn > 0.005) label = 'buy';
    else if (realizedReturn < -0.005) label = 'sell';
    
    this.history.push({
      features,
      futureReturn: realizedReturn,  // This is realized, not predicted
      label,
      timestamp: Date.now(),
    });
    
    // Limit history size
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY / 2);
    }
  }
  
/**
   * Initialize from historical data (BACKTEST ONLY)
   * 
   * WARNING: This method uses future price data (ohlcv[i + 5].close)
   * which is acceptable for BACKTESTING but would cause look-ahead
   * bias in LIVE TRADING.
   * 
   * For live trading initialization, use updateHistory() after each
   * trade closes, or use PatternRecorder for automated management.
   * 
   * @param ohlcv Historical OHLCV data
   * @param features3D Pre-computed 3D features
   */
  initializeFromHistory(ohlcv: any[], features3D: [number, number, number][]) {
    for (let i = 0; i < ohlcv.length - 5 && i < features3D.length; i++) {
      // Note: Using future price (i + 5) is OK for backtesting only
      const realizedReturn = (ohlcv[i + 5].close - ohlcv[i].close) / ohlcv[i].close;
      
      let label: 'buy' | 'sell' | 'hold' = 'hold';
      if (realizedReturn > 0.005) label = 'buy';
      else if (realizedReturn < -0.005) label = 'sell';
      
      this.history.push({
        features: features3D[i],
        futureReturn: realizedReturn,
        label,
        timestamp: ohlcv[i].timestamp,
      });
    }
  }
  
  getHistorySize(): number {
    return this.history.length;
  }
}

export default OCSLayer3;
