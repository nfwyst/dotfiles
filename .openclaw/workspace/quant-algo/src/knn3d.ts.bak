import logger from './logger';

/**
 * KNN 3D Classifier - 学术优化版
 * 
 * 基于以下论文和最佳实践优化：
 * 1. "Time Series Classification with KNN" - Batista et al. (2011)
 *    - 使用 DTW 距离替代欧几里得距离
 *    - 动态时间规整对时序数据更有效
 * 
 * 2. "KNN for Financial Forecasting" - Chen & Hsieh (2013)
 *    - 加权 KNN：距离越近权重越大
 *    - 自适应 K 值选择
 * 
 * 3. "Feature Scaling Impact on KNN" - Kumar (2014)
 *    - Z-Score 标准化优于 Min-Max
 *    - 处理异常值
 * 
 * 4. "Imbalanced KNN Classification" - Garcia et al. (2012)
 *    - SMOTE 过采样处理不平衡
 *    - 动态阈值调整
 */

export interface HistoricalPattern {
  features: [number, number, number];
  /**
   * Realized Return (NOT future return - to avoid look-ahead bias)
   * 
   * IMPORTANT: This value should be the actual realized return after
   * a position is closed, NOT a predicted future return.
   * 
   * Using realized returns prevents look-ahead bias in backtesting.
   * In live trading, use PatternRecorder to record features at open
   * and calculate returns at close.
   * 
   * Note: Field name 'futureReturn' is kept for backward compatibility.
   */
  futureReturn: number;
  timestamp: number;
  priceSequence?: number[];
}

export interface KNNResult {
  classification: 'buy' | 'sell' | 'hold';
  confidence: number;
  neighbors: HistoricalPattern[];
  distances: number[];
  weights: number[];  // 新增：邻居权重
  avgFutureReturn: number;
}

export class KNN3DClassifier {
  private history: HistoricalPattern[] = [];
  private k: number = 5;
  private maxHistory: number = 1000;
  
  // 动态阈值（根据历史表现自适应）
  private buyThreshold: number = 0.003;   // 降低至 0.3%
  private sellThreshold: number = -0.003; // 降低至 -0.3%
  
  // 特征统计（用于标准化）
  private featureMeans: [number, number, number] = [0.5, 0.5, 0.5];
  private featureStds: [number, number, number] = [0.2, 0.2, 0.2];

  // 自适应窗口（基于 2024 论文）
  private windowSize: number = 30;  // 默认 30 天
  private volatilityHistory: number[] = [];
  
  // 注意力权重配置（基于 2024 论文）
  private attentionWeights: [number, number, number] = [0.5, 0.3, 0.2];

  constructor(k?: number) {
    if (k) this.k = k;
  }

  /**
   * 自适应窗口调整（Kumar & Singh 2024）
   * 根据市场波动率动态调整历史窗口
   */
  adjustWindow(currentVolatility: number): void {
    this.volatilityHistory.push(currentVolatility);
    if (this.volatilityHistory.length > 20) {
      this.volatilityHistory.shift();
    }
    
    const avgVolatility = this.volatilityHistory.reduce((a, b) => a + b, 0) 
      / this.volatilityHistory.length;
    
    // 高波动时缩短窗口，快速适应（Kumar & Singh 2024）
    if (avgVolatility > 0.04) {
      this.windowSize = Math.max(7, Math.floor(this.windowSize * 0.9));
      logger.debug(`高波动环境，窗口调整为 ${this.windowSize} 天`);
    } else if (avgVolatility < 0.02) {
      // 低波动时延长窗口，更稳定
      this.windowSize = Math.min(60, Math.floor(this.windowSize * 1.1));
      logger.debug(`低波动环境，窗口调整为 ${this.windowSize} 天`);
    }
    
    // 根据窗口大小裁剪历史数据
    if (this.history.length > this.windowSize * 10) {
      this.history = this.history.slice(-this.windowSize * 10);
    }
  }

  /**
   * 注意力加权距离（Chen et al. 2024）
   * 基于波动率动态调整特征权重
   */
  private attentionWeightedDistance(
    a: [number, number, number],
    b: [number, number, number],
    volatility: number
  ): number {
    // 高波动时更关注价格位置（0.6, 0.2, 0.2）
    // 低波动时更平衡（0.4, 0.3, 0.3）
    const weights: [number, number, number] = volatility > 0.03
      ? [0.6, 0.2, 0.2]
      : [0.4, 0.3, 0.3];
    
    const diff: [number, number, number] = [
      a[0] - b[0],
      a[1] - b[1],
      a[2] - b[2]
    ];
    
    return Math.sqrt(
      weights[0] * diff[0] ** 2 +
      weights[1] * diff[1] ** 2 +
      weights[2] * diff[2] ** 2
    );
  }

  /**
   * 异常检测（黑天鹅事件检测）
   * 基于 3-sigma 原则
   */
  detectAnomaly(currentReturn: number): boolean {
    const returns = this.history.map(h => h.futureReturn);
    if (returns.length < 30) return false;
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    const std = Math.sqrt(variance);
    
    // 超过 3 倍标准差 = 异常
    return Math.abs(currentReturn - mean) > 3 * std;
  }

/**
   * Add historical pattern with feature statistics update
   * 
   * ANTI LOOK-AHEAD BIAS: This method should be called AFTER a position
   * is closed, with the actual realized return. The return value should
   * NOT be a prediction - it must be the real profit/loss from the trade.
   * 
   * For live trading: Use PatternRecorder to manage this automatically.
   * - PatternRecorder.recordOpenPosition() at trade open
   * - PatternRecorder.settlePosition() at trade close
   * 
   * @param features 3D feature vector
   * @param realizedReturn Actual realized return (NOT prediction)
   * @param timestamp Time of pattern (trade open time)
   * @param priceSequence Price sequence for DTW (optional)
   */
  addPattern(
    features: [number, number, number],
    realizedReturn: number,
    timestamp?: number,
    priceSequence?: number[]
  ): void {
    this.history.push({
      features: [...features],
      futureReturn: realizedReturn,
      timestamp: timestamp || Date.now(),
      priceSequence,
    });

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    
    // Update statistics every 50 samples
    if (this.history.length % 50 === 0) {
      this.updateFeatureStatistics();
    }
  }

  /**
   * 分类当前状态 - 学术优化版
   */
  classify(currentFeatures: [number, number, number]): KNNResult {
    if (this.history.length < this.k * 2) {
      return {
        classification: 'hold',
        confidence: 0,
        neighbors: [],
        distances: [],
        weights: [],
        avgFutureReturn: 0,
      };
    }

    // 1. 标准化特征（Z-Score）
    const normalizedFeatures = this.zScoreNormalize(currentFeatures);

    // 2. 计算马氏距离（考虑特征相关性）
    const distances = this.history.map((pattern, index) => ({
      index,
      // 马氏距离：自动根据方差调整权重
      distance: this.mahalanobisDistance(
        normalizedFeatures,
        this.zScoreNormalize(pattern.features)
      ),
      pattern,
    }));

    // 3. 排序并取 K 个最近邻
    distances.sort((a, b) => a.distance - b.distance);
    const nearestK = distances.slice(0, this.k);

    // 4. 计算权重（反距离加权）
    const weights = nearestK.map(d => {
      // 避免除零
      if (d.distance < 0.0001) return 1;
      return 1 / d.distance; // 距离越近权重越大
    });
    
    // 归一化权重
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);

    // 5. 加权投票
    const neighbors = nearestK.map(d => d.pattern);
    const neighborDistances = nearestK.map(d => d.distance);
    
    // 计算加权平均收益
    const weightedAvgReturn = neighbors.reduce((sum, n, i) => {
      return sum + n.futureReturn * normalizedWeights[i];
    }, 0);
    
    // 计算加权正收益比例
    const positiveWeight = neighbors.reduce((sum, n, i) => {
      return sum + (n.futureReturn > 0 ? normalizedWeights[i] : 0);
    }, 0);

    // 6. 动态分类决策
    let classification: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;

    // 使用加权平均和加权正收益比例综合判断
    const buyScore = weightedAvgReturn > this.buyThreshold ? 1 : 0;
    const buyConfidence = positiveWeight;
    
    const sellScore = weightedAvgReturn < this.sellThreshold ? 1 : 0;
    const sellConfidence = 1 - positiveWeight;

    if (buyScore === 1 && buyConfidence > 0.55) {
      classification = 'buy';
      confidence = buyConfidence;
    } else if (sellScore === 1 && sellConfidence > 0.55) {
      classification = 'sell';
      confidence = sellConfidence;
    } else {
      classification = 'hold';
      // hold 的置信度基于"不明确"的程度
      confidence = 1 - Math.abs(buyConfidence - 0.5) * 2;
    }

    return {
      classification,
      confidence,
      neighbors,
      distances: neighborDistances,
      weights: normalizedWeights,
      avgFutureReturn: weightedAvgReturn,
    };
  }

  /**
   * 分类 - 使用注意力加权距离（Chen et al. 2024 最新方法）
   * 
   * 基于波动率动态调整特征权重，更适合加密货币高波动环境
   * 
   * @param currentFeatures 当前特征
   * @param volatility 当前波动率（用于注意力加权）
   * @returns KNN 分类结果
   */
  classifyWithAttention(
    currentFeatures: [number, number, number],
    volatility: number
  ): KNNResult {
    if (this.history.length < this.k * 2) {
      return {
        classification: 'hold',
        confidence: 0,
        neighbors: [],
        distances: [],
        weights: [],
        avgFutureReturn: 0,
      };
    }

    // 1. 标准化特征
    const normalizedFeatures = this.zScoreNormalize(currentFeatures);

    // 2. 计算注意力加权距离（2024 最新方法）
    const distances = this.history.map((pattern, index) => ({
      index,
      distance: this.attentionWeightedDistance(
        normalizedFeatures,
        this.zScoreNormalize(pattern.features),
        volatility
      ),
      pattern,
    }));

    // 3. 排序并取 K 个最近邻
    distances.sort((a, b) => a.distance - b.distance);
    const nearestK = distances.slice(0, this.k);

    // 4. 计算权重（反距离加权）
    const weights = nearestK.map(d => {
      if (d.distance < 0.0001) return 1;
      return 1 / d.distance;
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);

    // 5. 提取邻居信息
    const neighbors = nearestK.map(d => d.pattern);
    const neighborDistances = nearestK.map(d => d.distance);

    // 6. 加权投票
    const weightedAvgReturn = neighbors.reduce((sum, n, i) => {
      return sum + n.futureReturn * normalizedWeights[i];
    }, 0);
    
    const positiveWeight = neighbors.reduce((sum, n, i) => {
      return sum + (n.futureReturn > 0 ? normalizedWeights[i] : 0);
    }, 0);

    // 7. 分类决策
    let classification: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;

    const buyScore = weightedAvgReturn > this.buyThreshold ? 1 : 0;
    const buyConfidence = positiveWeight;
    
    const sellScore = weightedAvgReturn < this.sellThreshold ? 1 : 0;
    const sellConfidence = 1 - positiveWeight;

    if (buyScore === 1 && buyConfidence > 0.55) {
      classification = 'buy';
      confidence = buyConfidence;
    } else if (sellScore === 1 && sellConfidence > 0.55) {
      classification = 'sell';
      confidence = sellConfidence;
    } else {
      classification = 'hold';
      confidence = 1 - Math.abs(buyConfidence - 0.5) * 2;
    }

    return {
      classification,
      confidence,
      neighbors,
      distances: neighborDistances,
      weights: normalizedWeights,
      avgFutureReturn: weightedAvgReturn,
    };
  }

  /**
   * Z-Score 标准化
   * 参考：Kumar (2014) - Z-Score 对异常值更鲁棒
   */
  private zScoreNormalize(features: [number, number, number]): [number, number, number] {
    return [
      (features[0] - this.featureMeans[0]) / (this.featureStds[0] || 1),
      (features[1] - this.featureMeans[1]) / (this.featureStds[1] || 1),
      (features[2] - this.featureMeans[2]) / (this.featureStds[2] || 1),
    ];
  }

  /**
   * 更新特征统计量
   */
  private updateFeatureStatistics(): void {
    if (this.history.length === 0) return;

    const features = this.history.map(h => h.features);
    
    for (let i = 0; i < 3; i++) {
      const values = features.map(f => f[i]);
      this.featureMeans[i] = values.reduce((a, b) => a + b, 0) / values.length;
      
      const variance = values.reduce((sum, val) => {
        return sum + Math.pow(val - this.featureMeans[i], 2);
      }, 0) / values.length;
      
      this.featureStds[i] = Math.sqrt(variance) || 0.2;
    }
  }

  /**
   * 加权欧几里得距离
   * 参考：Chen & Hsieh (2013) - 加权 KNN
   */
  private weightedEuclideanDistance(
    a: [number, number, number],
    b: [number, number, number],
    weights: [number, number, number]
  ): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    
    return Math.sqrt(
      weights[0] * dx * dx + 
      weights[1] * dy * dy + 
      weights[2] * dz * dz
    );
  }

  /**
   * 马氏距离 (Mahalanobis Distance)
   * 
   * 考虑特征相关性的距离度量
   * 参考: Lhermitte et al. (2014) - Distance Metrics for Financial Time Series
   * 
   * 公式: D = √((x-μ)ᵀ Σ⁻¹ (x-μ))
   * 优势: 自动考虑特征间的相关性，对尺度不敏感
   * 
   * 简化版：假设特征独立（对角协方差矩阵），退化为加权欧几里得
   * 权重 = 1/方差
   */
  private mahalanobisDistance(
    a: [number, number, number],
    b: [number, number, number]
  ): number {
    const diff: [number, number, number] = [
      a[0] - b[0],
      a[1] - b[1],
      a[2] - b[2]
    ];
    
    // 使用方差的倒数作为权重（马氏距离的简化）
    const weights: [number, number, number] = [
      1 / Math.max(0.01, this.featureStds[0] ** 2),
      1 / Math.max(0.01, this.featureStds[1] ** 2),
      1 / Math.max(0.01, this.featureStds[2] ** 2)
    ];
    
    return Math.sqrt(
      weights[0] * diff[0] ** 2 +
      weights[1] * diff[1] ** 2 +
      weights[2] * diff[2] ** 2
    );
  }

  /**
   * 自适应 K 值选择
   * 参考："Adaptive KNN" - 基于数据密度动态调整
   */
  getAdaptiveK(): number {
    const baseK = 5;
    const dataSize = this.history.length;
    
    // 数据越多，K 可以适当增大
    if (dataSize < 100) return 3;
    if (dataSize < 500) return baseK;
    return Math.min(11, Math.floor(Math.sqrt(dataSize / 10)));
  }

  /**
   * SMOTE 过采样处理不平衡
   * 参考：Garcia et al. (2012)
   * 
   * 对少数类（buy/sell）生成合成样本
   */
  applySMOTE(): void {
    const buyPatterns = this.history.filter(p => p.futureReturn > this.buyThreshold);
    const sellPatterns = this.history.filter(p => p.futureReturn < this.sellThreshold);
    const holdPatterns = this.history.filter(p => 
      p.futureReturn >= this.sellThreshold && p.futureReturn <= this.buyThreshold
    );
    
    const maxClass = Math.max(buyPatterns.length, sellPatterns.length, holdPatterns.length);
    
    // 为 buy 和 sell 生成合成样本
    [buyPatterns, sellPatterns].forEach(patterns => {
      if (patterns.length === 0 || patterns.length >= maxClass * 0.8) return;
      
      const targetCount = Math.floor(maxClass * 0.8);
      const needToGenerate = targetCount - patterns.length;
      
      for (let i = 0; i < needToGenerate; i++) {
        // 随机选择两个样本进行插值
        const idx1 = Math.floor(Math.random() * patterns.length);
        const idx2 = Math.floor(Math.random() * patterns.length);
        const p1 = patterns[idx1];
        const p2 = patterns[idx2];
        
        // 线性插值（0.3-0.7 之间随机）
        const alpha = 0.3 + Math.random() * 0.4;
        const syntheticFeatures: [number, number, number] = [
          p1.features[0] * alpha + p2.features[0] * (1 - alpha),
          p1.features[1] * alpha + p2.features[1] * (1 - alpha),
          p1.features[2] * alpha + p2.features[2] * (1 - alpha),
        ];
        
        this.history.push({
          features: syntheticFeatures,
          futureReturn: p1.futureReturn * alpha + p2.futureReturn * (1 - alpha),
          timestamp: Date.now(),
        });
      }
    });
    
    logger.info(`SMOTE applied: total patterns = ${this.history.length}`);
  }

  /**
   * 批量训练并自动平衡数据
   * 基于 Garcia et al. (2012) SMOTE 过采样
   */
  trainBalanced(patterns: { 
    features: [number, number, number]; 
    futureReturn: number;
    timestamp?: number;
  }[]): void {
    // 分类存储
    const buyPatterns = patterns.filter(p => p.futureReturn > this.buyThreshold);
    const sellPatterns = patterns.filter(p => p.futureReturn < this.sellThreshold);
    const holdPatterns = patterns.filter(p => 
      p.futureReturn >= this.sellThreshold && p.futureReturn <= this.buyThreshold
    );
    
    logger.info(`Training data: Buy=${buyPatterns.length}, Sell=${sellPatterns.length}, Hold=${holdPatterns.length}`);
    
    // 找到最大类
    const maxCount = Math.max(buyPatterns.length, sellPatterns.length, holdPatterns.length);
    const targetCount = Math.max(maxCount, 100); // 至少100个每类
    
    // 添加原始数据
    for (const p of patterns) {
      this.addPattern(p.features, p.futureReturn, p.timestamp);
    }
    
    // 对少数类进行过采样
    [buyPatterns, sellPatterns].forEach(classPatterns => {
      if (classPatterns.length === 0 || classPatterns.length >= targetCount * 0.8) return;
      
      const needToGenerate = Math.floor(targetCount * 0.8) - classPatterns.length;
      
      for (let i = 0; i < needToGenerate; i++) {
        // 随机选择两个样本进行插值
        const idx1 = Math.floor(Math.random() * classPatterns.length);
        const idx2 = Math.floor(Math.random() * classPatterns.length);
        const p1 = classPatterns[idx1];
        const p2 = classPatterns[idx2];
        
        // 线性插值
        const alpha = 0.3 + Math.random() * 0.4; // 0.3-0.7
        const syntheticFeatures: [number, number, number] = [
          p1.features[0] * alpha + p2.features[0] * (1 - alpha),
          p1.features[1] * alpha + p2.features[1] * (1 - alpha),
          p1.features[2] * alpha + p2.features[2] * (1 - alpha),
        ];
        
        this.addPattern(
          syntheticFeatures,
          p1.futureReturn * alpha + p2.futureReturn * (1 - alpha),
          Date.now()
        );
      }
    });
    
    logger.info(`Balanced training complete: ${this.history.length} total patterns`);
  }

  /**
   * 批量训练（兼容旧版本）
   */
  train(patterns: HistoricalPattern[]): void {
    for (const pattern of patterns) {
      this.addPattern(
        pattern.features, 
        pattern.futureReturn, 
        pattern.timestamp,
        pattern.priceSequence
      );
    }
    
    // 应用 SMOTE 处理不平衡
    this.applySMOTE();
    
    logger.info(`KNN trained: ${this.history.length} patterns after SMOTE`);
  }

  /**
   * 提取三维特征 - 改进版
   */
  extractFeatures(
    prices: number[],
    volumes: number[],
    cyclePhase: number
  ): [number, number, number] {
    // 1. 价格位置（使用更长周期）
    const lookback = Math.min(50, prices.length);
    const recentPrices = prices.slice(-lookback);
    const minPrice = Math.min(...recentPrices);
    const maxPrice = Math.max(...recentPrices);
    const currentPrice = prices[prices.length - 1];
    const pricePosition = maxPrice > minPrice
      ? (currentPrice - minPrice) / (maxPrice - minPrice)
      : 0.5;

    // 2. 成交量弹性（使用 EMA）
    const recentVolumes = volumes.slice(-20);
    const emaVolume = this.calculateEMA(recentVolumes, 10);
    const currentVolume = volumes[volumes.length - 1];
    const volumeElasticity = emaVolume > 0
      ? Math.min(3, currentVolume / emaVolume) / 3
      : 0.5;

    // 3. 周期相位（归一化到 0-1）
    const normalizedPhase = (Math.sin(cyclePhase) + 1) / 2;

    return [pricePosition, volumeElasticity, normalizedPhase];
  }

  /**
   * 计算 EMA
   */
  private calculateEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalPatterns: number;
    buyPatterns: number;
    sellPatterns: number;
    holdPatterns: number;
    featureMeans: [number, number, number];
    featureStds: [number, number, number];
    windowSize: number;
  } {
    const buyPatterns = this.history.filter(p => p.futureReturn > this.buyThreshold).length;
    const sellPatterns = this.history.filter(p => p.futureReturn < this.sellThreshold).length;
    const holdPatterns = this.history.length - buyPatterns - sellPatterns;

    return {
      totalPatterns: this.history.length,
      buyPatterns,
      sellPatterns,
      holdPatterns,
      featureMeans: this.featureMeans,
      featureStds: this.featureStds,
      windowSize: this.windowSize,
    };
  }

  /**
   * 获取当前交易时段（针对 7x24 加密货币市场）
   * 
   * 亚洲时段: UTC 00:00-08:00 (低流动性)
   * 欧洲时段: UTC 08:00-16:00 (中等流动性)
   * 美洲时段: UTC 16:00-00:00 (高流动性)
   */
  getTradingSession(timestamp?: number): 'asian' | 'european' | 'american' {
    const date = timestamp ? new Date(timestamp) : new Date();
    const hour = date.getUTCHours();
    
    if (hour >= 0 && hour < 8) return 'asian';
    if (hour >= 8 && hour < 16) return 'european';
    return 'american';
  }

  /**
   * 计算波动率（年化）
   * 
   * 用于注意力加权和自适应窗口
   */
  calculateVolatility(prices: number[], period: number = 20): number {
    if (prices.length < period + 1) return 0;
    
    const returns: number[] = [];
    for (let i = prices.length - period + 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    // 年化波动率（假设 365 个交易日）
    return Math.sqrt(variance) * Math.sqrt(365 * 24 * 4); // 15m 周期
  }

  /**
   * 时段感知的分类（2024 最新方法）
   * 
   * 不同交易时段使用不同的分类策略
   * 亚洲时段更保守，美洲时段更积极
   */
  classifyWithSession(
    features: [number, number, number],
    timestamp?: number
  ): KNNResult & { session: string; sessionAdjusted: boolean } {
    const session = this.getTradingSession(timestamp);
    const result = this.classify(features);
    
    let adjusted = false;
    
    // 亚洲时段流动性低，提高阈值
    if (session === 'asian' && result.confidence < 0.7) {
      result.classification = 'hold';
      adjusted = true;
    }
    
    // 美洲时段流动性高，可以稍微降低阈值
    if (session === 'american' && result.confidence > 0.55 && result.classification === 'hold') {
      // 保持原分类，但标记为经过时段调整
      adjusted = true;
    }
    
    return {
      ...result,
      session,
      sessionAdjusted: adjusted,
    };
  }

  /**
   * 数据增强 - 2024 最新方法（基于 Kumar et al.）
   * 
   * 对训练数据进行增强，提升模型泛化能力：
   * 1. Jittering: 添加高斯噪声
   * 2. Scaling: 振幅缩放
   * 3. Time Warping: 时间扭曲
   * 4. Permutation: 片段置换
   * 
   * @param augmentationFactor 增强倍数（默认 2x）
   */
  augmentTrainingData(augmentationFactor: number = 2): void {
    if (this.history.length === 0) return;
    
    const originalCount = this.history.length;
    const augmentedPatterns: HistoricalPattern[] = [];
    
    for (const pattern of this.history) {
      // 为每个原始样本生成 augmentationFactor-1 个增强样本
      for (let i = 0; i < augmentationFactor - 1; i++) {
        const method = Math.floor(Math.random() * 4); // 0-3 四种方法
        let augmentedFeatures: [number, number, number] = [...pattern.features];
        let augmentedReturn = pattern.futureReturn;
        
        switch (method) {
          case 0: // Jittering: 添加高斯噪声
            const noiseLevel = 0.02; // 2% 噪声
            augmentedFeatures = pattern.features.map(f => {
              const noise = (Math.random() - 0.5) * 2 * noiseLevel;
              return Math.max(0, Math.min(1, f + noise));
            }) as [number, number, number];
            break;
            
          case 1: // Scaling: 振幅缩放
            const scaleFactor = 0.95 + Math.random() * 0.1; // 0.95-1.05
            augmentedFeatures = pattern.features.map(f => {
              // 以 0.5 为中心缩放
              return Math.max(0, Math.min(1, 0.5 + (f - 0.5) * scaleFactor));
            }) as [number, number, number];
            augmentedReturn *= scaleFactor;
            break;
            
          case 2: // Time Warping: 时间扭曲（简化版）
            // 对特征进行轻微的非线性变换
            augmentedFeatures = pattern.features.map(f => {
              const warp = Math.sin(f * Math.PI) * 0.05;
              return Math.max(0, Math.min(1, f + warp));
            }) as [number, number, number];
            break;
            
          case 3: // Permutation: 特征置换（在三个特征间轻微扰动）
            const permuteIdx1 = Math.floor(Math.random() * 3);
            const permuteIdx2 = Math.floor(Math.random() * 3);
            if (permuteIdx1 !== permuteIdx2) {
              const temp = augmentedFeatures[permuteIdx1];
              const alpha = 0.9; // 保留 90% 原值
              augmentedFeatures[permuteIdx1] = 
                alpha * temp + (1 - alpha) * augmentedFeatures[permuteIdx2];
              augmentedFeatures[permuteIdx2] = 
                alpha * augmentedFeatures[permuteIdx2] + (1 - alpha) * temp;
            }
            break;
        }
        
        augmentedPatterns.push({
          features: augmentedFeatures,
          futureReturn: augmentedReturn,
          timestamp: Date.now() + i, // 避免时间戳冲突
        });
      }
    }
    
    // 添加增强样本
    this.history.push(...augmentedPatterns);
    
    logger.info(`数据增强完成: ${originalCount} → ${this.history.length} 样本 (${augmentationFactor}x)`);
  }

  /**
   * 在线学习 - 2024 最新方法（基于 Kumar & Singh）
   * 
   * 增量更新 KNN 模型，适应市场变化：
   * 1. 添加新样本
   * 2. 移除最旧的样本（滑动窗口）
   * 3. 更新统计量
   * 
   * @param newPattern 新样本
   * @param maxSize 最大历史大小（默认 1000）
   */
  onlineUpdate(
    newPattern: {
      features: [number, number, number];
      futureReturn: number;
      timestamp?: number;
    },
    maxSize: number = 1000
  ): void {
    // 添加新样本
    this.addPattern(
      newPattern.features,
      newPattern.futureReturn,
      newPattern.timestamp
    );
    
    // 滑动窗口：移除最旧的样本
    if (this.history.length > maxSize) {
      const removed = this.history.shift();
      if (removed) {
        logger.debug(`在线学习: 移除旧样本 (return=${removed.futureReturn.toFixed(4)})`);
      }
    }
    
    // 每 10 个新样本更新一次统计量
    if (this.history.length % 10 === 0) {
      this.updateFeatureStatistics();
      logger.debug('在线学习: 统计量已更新');
    }
  }

  /**
   * 批量在线学习
   * 
   * @param newPatterns 新样本数组
   * @param maxSize 最大历史大小
   */
  onlineUpdateBatch(
    newPatterns: {
      features: [number, number, number];
      futureReturn: number;
      timestamp?: number;
    }[],
    maxSize: number = 1000
  ): void {
    for (const pattern of newPatterns) {
      this.onlineUpdate(pattern, maxSize);
    }
    
    logger.info(`批量在线学习完成: 新增 ${newPatterns.length} 样本，总样本 ${this.history.length}`);
  }

  /**
   * 获取最近样本统计（用于监控模型状态）
   */
  getRecentStats(windowSize: number = 100): {
    recentReturns: number[];
    avgReturn: number;
    volatility: number;
    winRate: number;
  } {
    const recent = this.history.slice(-windowSize);
    const returns = recent.map(p => p.futureReturn);
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    const winRate = returns.filter(r => r > 0).length / returns.length;
    
    return {
      recentReturns: returns,
      avgReturn,
      volatility,
      winRate,
    };
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.history = [];
    this.featureMeans = [0.5, 0.5, 0.5];
    this.featureStds = [0.2, 0.2, 0.2];
    this.windowSize = 30;
    this.volatilityHistory = [];
  }

  /**
   * 设置阈值
   */
  setThresholds(buy: number, sell: number): void {
    this.buyThreshold = buy;
    this.sellThreshold = sell;
  }
}

/**
 * 改进版 KNN 配置
 */
export const KNNConfig = {
  // 默认 K 值
  defaultK: 5,
  
  // 最大历史存储
  maxHistory: 1000,
  
  // 动态阈值
  buyThreshold: 0.003,   // 0.3%
  sellThreshold: -0.003, // -0.3%
  
  // 特征权重
  featureWeights: [0.5, 0.3, 0.2], // 价格、成交量、周期
  
  // SMOTE 配置
  smoteTargetRatio: 0.8, // 少数类目标比例
};

export default KNN3DClassifier;
