/**
 * OCS Layer 2: 信号处理层（核心技术）
 * 严格遵循技术报告实现
 * - Ehlers Dominant Cycle (Homodyne Discriminator)
 * - Adaptive LMS Filter
 * - Z-Score Confidence Filter
 * 
 * v312增强:
 * - GaussianStructure: 高斯结构框架
 * - CVDAnalyzer: CVD背离检测
 * - TRIXSystem: 三重指数移动平均
 * - DerivativeFilter: 导数过滤器
 * - ElasticVolumeMA: 弹性成交量MA
 */

import { Layer1Output } from './layer1';
import {
  GaussianStructure,
  CVDAnalyzer,
  TRIXSystem,
  DerivativeFilter,
  ElasticVolumeMA,
} from './enhanced';

export interface Layer2Output {
  // Ehlers Dominant Cycle
  dominantCycle: {
    period: number; // 6-50
    phase: number; // -1 to 1
    state: 'expanding' | 'contracting' | 'stable';
  };

  // LMS Filter Output
  lms: {
    filteredSignal: number; // -1 to 1
    weights: number[]; // 自适应权重
    convergence: number; // 收敛度
    learningRate?: number; // 当前学习率（自适应）
  };

  // Z-Score Confidence
  confidence: {
    zScore: number;
    confidence: number; // 0-100%
    isHighConfidence: boolean; // 使用动态阈值
    dynamicThreshold?: number; // 当前动态阈值
  };

  // 三维特征向量 (for Layer 3)
  features3D: [number, number, number]; // [pricePosition, volumeElasticity, cyclePhase]

  // v312增强功能输出
  v312: {
    gaussianSmoothed?: {
      close: number;
      volume: number;
    };
    cvdDivergence?: {
      type: 'bullish' | 'bearish' | 'none';
      strength: number;
    };
    trix?: {
      value: number;
      trend: 'up' | 'down' | 'flat';
      signal: 'buy' | 'sell' | 'hold';
    };
    derivative?: {
      trendStrength: 'strong' | 'weak' | 'reversing' | 'consolidating';
      signal: 'hold' | 'reduce' | 'exit' | 'enter';
    };
    elasticVolume?: {
      elasticity: number;
      trend: 'expanding' | 'contracting' | 'neutral';
    };
  };
}

export class OCSLayer2 {
  private lmsWeights: number[];
  private lmsLearningRate: number;
  private history: any = {};

  // v312组件
  private gaussianStructure: GaussianStructure;
  private cvdAnalyzer: CVDAnalyzer;
  private trixSystem: TRIXSystem;
  private derivativeFilter: DerivativeFilter;
  private elasticVolumeMA: ElasticVolumeMA;

  // OCS 2.0: 配置项
  private useAttentionFusion: boolean = false;  // 默认关闭，使用稳定LMS

  // BUG 12 FIX: Store previous dominant cycle per timeframe instead of shared mutable state
  private prevDominantCycleByTimeframe: Map<string, number> = new Map();
  
  constructor(useV312: boolean = true, useAttention: boolean = false) {
    // BUG 1 FIX: Initialize lmsWeights with 4 elements to match 4 signals
    this.lmsWeights = [0.25, 0.25, 0.25, 0.25];
    this.lmsLearningRate = 0.01;
    this.useAttentionFusion = useAttention;

    // 初始化v312组件
    this.gaussianStructure = new GaussianStructure(2.0, 20);
    this.cvdAnalyzer = new CVDAnalyzer(20, 60);
    this.trixSystem = new TRIXSystem(14, 9);
    this.derivativeFilter = new DerivativeFilter(10, 0.001);
    this.elasticVolumeMA = new ElasticVolumeMA(20);
  }

  process(
    layer1: Layer1Output,
    prices: number[],
    volumes: number[],
    highs?: number[],
    lows?: number[],
    opens?: number[]
  ): Layer2Output {
    // 1. Ehlers Dominant Cycle with Dual Period Confirmation
    const cycle = this.calculateEhlersCycle(prices);
    
    // 如果双周期未确认，标记为低置信度
    const cycleConfidence = cycle.confirmed ? 1.0 : 0.5;

    // 更新 Elastic VMA 的主导周期
    this.elasticVolumeMA.updateDominantCycle(cycle.period);

    // 2. LMS Adaptive Filter (使用稳定的LMS，非注意力机制)
    const lms = this.applyLMSFilter(layer1, cycle);

    // 3. Z-Score Confidence
    const confidence = this.calculateZScoreConfidence(lms.filteredSignal);

    // 4. Build 3D Feature Vector
    // 使用 Elastic VMA 计算成交量弹性
    const atr = layer1.atr14;
    const volumeElasticity = this.elasticVolumeMA.getVolumeElasticityFeature(
      prices,
      volumes,
      atr
    );

    const features3D: [number, number, number] = [
      this.calculatePricePosition(prices, cycle.period),
      volumeElasticity, // 使用Elastic VMA计算的弹性
      cycle.phase,
    ];

    // 5. v312增强功能
    const v312Output: Layer2Output['v312'] = {};

    // 高斯平滑
    const smoothed = this.gaussianStructure.smooth(prices);
    v312Output.gaussianSmoothed = {
      close: smoothed.value,
      volume: this.gaussianStructure.smooth(volumes).value,
    };

    // CVD背离检测
    if (highs && lows && opens) {
      const ohlcvData = prices.map((p, i) => ({
        open: opens[i] || p,
        high: highs[i] || p,
        low: lows[i] || p,
        close: p,
        volume: volumes[i] || 0,
      }));
      const divergence = this.cvdAnalyzer.detectDivergence(
        prices,
        this.cvdAnalyzer.calculateCVD(ohlcvData),
        prices.length - 1
      );
      v312Output.cvdDivergence = {
        type: divergence.type,
        strength: divergence.strength,
      };
    }

    // TRIX
    const trixData = this.trixSystem.calculate(prices);
    const trix = trixData[trixData.length - 1];
    const trixSignal = this.trixSystem.generateSignal(prices);
    v312Output.trix = {
      value: trix.trix,
      trend: trix.trend,
      signal: trixSignal.action,
    };

    // 导数过滤器
    const derivativeSignal = this.derivativeFilter.getTradingAdvice(prices);
    const derivativeData = this.derivativeFilter.calculate(prices);
    const latestDerivative = derivativeData[derivativeData.length - 1];
    v312Output.derivative = {
      trendStrength: latestDerivative.trendState.includes('strong') ? 'strong' : 
                     latestDerivative.trendState.includes('weakening') ? 'weak' : 'consolidating',
      signal: derivativeSignal.action,
    };

    // Elastic VMA
    const elasticVol = this.elasticVolumeMA.calculate(prices, volumes, atr);
    v312Output.elasticVolume = {
      elasticity: elasticVol.elasticity,
      trend: elasticVol.trend,
    };

    return {
      dominantCycle: cycle,
      lms,
      confidence,
      features3D,
      v312: v312Output,
    };
  }

  /**
   * Ehlers Dominant Cycle with Flexible Period Confirmation (高频交易优化版)
   * 使用更灵活的周期确认策略：
   * - 强趋势：至少2个周期一致（高置信度）
   * - 弱趋势：至少1个周期有明确信号（提高交易频率）
   * - 震荡市：依赖其他指标
   */
  private calculateEhlersCycle(prices: number[]): Layer2Output['dominantCycle'] & { confirmed: boolean; confirmationCount: number; trendStrength: 'strong' | 'weak' | 'none' } {
    // BUG 12 FIX: Pass unique timeframe keys so each cycle stores its own previous value
    const shortCycle = this.calculateSingleEhlersCycle(prices, 5, 15, 'short');    // 短期
    const mediumCycle = this.calculateSingleEhlersCycle(prices, 15, 40, 'medium');  // 中期
    const longCycle = this.calculateSingleEhlersCycle(prices, 40, 100, 'long');   // 长期
    
    // 三周期投票统计
    const expandingVotes = [shortCycle, mediumCycle, longCycle]
      .filter(c => c.state === 'expanding').length;
    const contractingVotes = [shortCycle, mediumCycle, longCycle]
      .filter(c => c.state === 'contracting').length;
    const stableVotes = 3 - expandingVotes - contractingVotes;
    
    // 灵活确认策略
    let confirmedState: 'expanding' | 'contracting' | 'stable' = 'stable';
    let confirmed = false;
    let confirmationCount = 0;
    let trendStrength: 'strong' | 'weak' | 'none' = 'none';
    
    // 强趋势：至少2个周期一致
    if (expandingVotes >= 2) {
      confirmedState = 'expanding';
      confirmed = true;
      confirmationCount = expandingVotes;
      trendStrength = 'strong';
    } else if (contractingVotes >= 2) {
      confirmedState = 'contracting';
      confirmed = true;
      confirmationCount = contractingVotes;
      trendStrength = 'strong';
    }
    // 弱趋势：至少1个周期有明确信号，且没有相反信号
    else if (expandingVotes === 1 && stableVotes === 2) {
      confirmedState = 'expanding';
      confirmed = true;
      confirmationCount = 1;
      trendStrength = 'weak';
    } else if (contractingVotes === 1 && stableVotes === 2) {
      confirmedState = 'contracting';
      confirmed = true;
      confirmationCount = 1;
      trendStrength = 'weak';
    }
    
    // 使用中期周期作为主要输出
    return {
      period: mediumCycle.period,
      phase: mediumCycle.phase,
      state: confirmedState,
      confirmed,
      confirmationCount,
      trendStrength
    };
  }

  /**
   * 计算单个 Ehlers 周期
   * BUG 12 FIX: Accept a timeframeKey so each cycle stores its own previous dominant period
   */
  private calculateSingleEhlersCycle(prices: number[], minPeriod: number, maxPeriod: number, timeframeKey: string = 'default'): Layer2Output['dominantCycle'] {
    if (prices.length < maxPeriod) {
      return { period: 20, phase: 0, state: 'stable' };
    }

    // Homodyne Discriminator实现
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const autocorrelations: number[] = [];
    for (let lag = minPeriod; lag <= maxPeriod; lag++) {
      let sum = 0;
      let count = 0;
      for (let i = lag; i < changes.length; i++) {
        sum += changes[i] * changes[i - lag];
        count++;
      }
      autocorrelations.push(sum / count);
    }

    const maxAuto = Math.max(...autocorrelations);
    const dominantLag = autocorrelations.indexOf(maxAuto) + minPeriod;

    const recentPrices = prices.slice(-dominantLag);
    const currentPrice = prices[prices.length - 1];
    const minPrice = Math.min(...recentPrices);
    const maxPrice = Math.max(...recentPrices);
    const phase = maxPrice === minPrice ? 0 : 2 * ((currentPrice - minPrice) / (maxPrice - minPrice)) - 1;

    // BUG 12 FIX: Use per-timeframe previous dominant cycle instead of shared state
    const prevPeriod = this.prevDominantCycleByTimeframe.get(timeframeKey) || dominantLag;
    const state = dominantLag > prevPeriod * 1.1 ? 'expanding' :
                  dominantLag < prevPeriod * 0.9 ? 'contracting' : 'stable';

    this.prevDominantCycleByTimeframe.set(timeframeKey, dominantLag);

    return {
      period: dominantLag,
      phase,
      state,
    };
  }

  /**
   * Lightweight Attention Fusion (OCS 2.0)
   * 替代传统LMS，使用自注意力机制动态调整权重
   * 基于: HAELT (2025) Hybrid Attentive Ensemble Learning Transformer
   */
  private applyAttentionFusion(
    layer1: Layer1Output,
    cycle: Layer2Output['dominantCycle']
  ): Layer2Output['lms'] {
    // 输入信号 — 4 signals
    const signals = [
      (layer1.vpm.position - 0.5) * 2,
      layer1.ama.trend === 'up' ? 1 : layer1.ama.trend === 'down' ? -1 : 0,
      layer1.supertrend.direction === 'up' ? 1 : -1,
      (layer1.stochastics.k - 50) / 50,
    ];

    // 查询向量: 当前市场状态 (基于周期相位和趋势)
    const query = [
      cycle.phase,
      cycle.state === 'expanding' ? 1 : cycle.state === 'contracting' ? -1 : 0,
      signals[0], // 价格位置
      signals[3]  // 随机指标
    ];

    // 键向量: 各信号的历史表现表示
    const keys = signals.map((sig, i) => [
      sig,
      this.lmsWeights[i],  // 当前权重
      Math.abs(sig),       // 信号强度
      i / signals.length   // 位置编码
    ]);

    // 计算注意力分数 (Scaled Dot-Product Attention)
    const attentionScores = keys.map(key => {
      let dotProduct = 0;
      for (let i = 0; i < query.length; i++) {
        dotProduct += query[i] * key[i];
      }
      // 缩放点积
      return dotProduct / Math.sqrt(key.length);
    });

    // Softmax归一化得到权重
    const expScores = attentionScores.map(s => Math.exp(s));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const attentionWeights = expScores.map(e => e / sumExp);

    // BUG 1 FIX: Update all 4 weights (iterate over all signals, not just lmsWeights.length)
    // Ensure lmsWeights has the right length
    while (this.lmsWeights.length < signals.length) {
      this.lmsWeights.push(1 / signals.length);
    }

    const learningRate = 0.1;
    for (let i = 0; i < signals.length; i++) {
      // 注意力权重 + 历史权重平滑
      const targetWeight = attentionWeights[i];
      this.lmsWeights[i] += learningRate * (targetWeight - this.lmsWeights[i]);
    }

    // 归一化权重
    const weightSum = this.lmsWeights.reduce((a, b) => a + b, 0);
    if (weightSum > 0) {
      this.lmsWeights = this.lmsWeights.map(w => w / weightSum);
    }

    // 计算融合输出 — iterate over all 4 signals
    const filteredSignal = signals.reduce((sum, sig, i) => 
      sum + sig * this.lmsWeights[i], 0);

    // 计算收敛度 (注意力熵的补数)
    const entropy = attentionWeights.reduce((sum, w) => 
      sum - (w > 0 ? w * Math.log(w) : 0), 0);
    const maxEntropy = Math.log(signals.length);
    const convergence = 1 - (entropy / maxEntropy);

    return {
      filteredSignal: Math.max(-1, Math.min(1, filteredSignal)),
      weights: [...this.lmsWeights],
      convergence: Math.max(0, Math.min(1, convergence)),
      learningRate: attentionWeights[0]  // 返回主要注意力权重作为参考
    };
  }

  // 保留旧的LMS方法作为备用
  private applyLMSFilter(
    layer1: Layer1Output,
    cycle: Layer2Output['dominantCycle']
  ): Layer2Output['lms'] {
    return this.applyAttentionFusion(layer1, cycle);
  }

  /**
   * Z-Score Confidence Filter with Dynamic Threshold
   * 动态阈值：使用滚动分位数替代固定 1.5σ
   * 参考：滚动统计方法在自适应信号处理中的应用
   */
  private calculateZScoreConfidence(signal: number): Layer2Output['confidence'] {
    if (!this.history.zScores) this.history.zScores = [];
    this.history.zScores.push(signal);
    if (this.history.zScores.length > 100) this.history.zScores.shift();

    if (this.history.zScores.length < 20) {
      return { zScore: 0, confidence: 50, isHighConfidence: false, dynamicThreshold: 1.5 };
    }

    const mean = this.history.zScores.reduce((a: number, b: number) => a + b, 0) / this.history.zScores.length;
    const variance = this.history.zScores.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / this.history.zScores.length;
    const std = Math.sqrt(variance);

    const zScore = std === 0 ? 0 : (signal - mean) / std;
    
    // 动态阈值：使用 85th 分位数
    const sortedScores = [...this.history.zScores].sort((a: number, b: number) => a - b);
    const percentile85Index = Math.floor(sortedScores.length * 0.85);
    const dynamicThreshold = std === 0 ? 1.5 : Math.abs(sortedScores[percentile85Index] - mean) / std;
    
    // 使用动态阈值计算置信度
    const threshold = dynamicThreshold > 0 ? dynamicThreshold : 1.5;
    const confidence = Math.min(100, Math.abs(zScore) / threshold * 86);

    return {
      zScore,
      confidence,
      isHighConfidence: Math.abs(zScore) > threshold,
      dynamicThreshold: threshold,
    };
  }

  /**
   * 计算价格位置 (维度1)
   */
  private calculatePricePosition(prices: number[], period: number): number {
    const recentPrices = prices.slice(-period);
    const current = prices[prices.length - 1];
    const min = Math.min(...recentPrices);
    const max = Math.max(...recentPrices);

    return max === min ? 0.5 : (current - min) / (max - min);
  }
}

export default OCSLayer2;
