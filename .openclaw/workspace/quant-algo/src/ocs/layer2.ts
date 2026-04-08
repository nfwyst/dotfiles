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
import { EhlersCycleDetector } from '../ehlersCycle';
import { type Layer2Config, DEFAULT_OCS_CONFIG } from '../config/ocsConfig';

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
  private readonly config: Layer2Config;

  // v312组件
  private gaussianStructure: GaussianStructure;
  private cvdAnalyzer: CVDAnalyzer;
  private trixSystem: TRIXSystem;
  private derivativeFilter: DerivativeFilter;
  private elasticVolumeMA: ElasticVolumeMA;

  // Ehlers Homodyne Discriminator instances (Fix 2)
  private ehlersCycleShort: EhlersCycleDetector;
  private ehlersCycleMedium: EhlersCycleDetector;
  private ehlersCycleLong: EhlersCycleDetector;

  // OCS 2.0: 配置项
  private useAttentionFusion: boolean = false;  // 默认关闭，使用稳定LMS

  // BUG 12 FIX: Store previous dominant cycle per timeframe instead of shared mutable state
  private prevDominantCycleByTimeframe: Map<string, number> = new Map();
  
  constructor(useV312: boolean = true, useAttention: boolean = false, config?: Partial<Layer2Config>) {
    // Deep-merge config with defaults
    this.config = { ...DEFAULT_OCS_CONFIG.layer2 } as Layer2Config;
    if (config) {
      if (config.ehlersCycle) {
        this.config.ehlersCycle = { ...this.config.ehlersCycle, ...config.ehlersCycle };
        if (config.ehlersCycle.short) this.config.ehlersCycle.short = { ...this.config.ehlersCycle.short, ...config.ehlersCycle.short };
        if (config.ehlersCycle.medium) this.config.ehlersCycle.medium = { ...this.config.ehlersCycle.medium, ...config.ehlersCycle.medium };
        if (config.ehlersCycle.long) this.config.ehlersCycle.long = { ...this.config.ehlersCycle.long, ...config.ehlersCycle.long };
      }
      if (config.lms) this.config.lms = { ...this.config.lms, ...config.lms };
      if (config.zScore) this.config.zScore = { ...this.config.zScore, ...config.zScore };
      if (config.v312) {
        this.config.v312 = { ...this.config.v312, ...config.v312 };
        if (config.v312.gaussian) this.config.v312.gaussian = { ...this.config.v312.gaussian, ...config.v312.gaussian };
        if (config.v312.cvd) this.config.v312.cvd = { ...this.config.v312.cvd, ...config.v312.cvd };
        if (config.v312.trix) this.config.v312.trix = { ...this.config.v312.trix, ...config.v312.trix };
        if (config.v312.derivative) this.config.v312.derivative = { ...this.config.v312.derivative, ...config.v312.derivative };
        if (config.v312.elasticVolume) this.config.v312.elasticVolume = { ...this.config.v312.elasticVolume, ...config.v312.elasticVolume };
      }
    }

    // BUG 1 FIX: Initialize lmsWeights with 4 elements to match 4 signals
    this.lmsWeights = [...this.config.lms.initialWeights];
    this.lmsLearningRate = this.config.lms.learningRate;
    this.useAttentionFusion = useAttention;

    // 初始化v312组件 — use config values
    this.gaussianStructure = new GaussianStructure(
      this.config.v312.gaussian.sigma,
      this.config.v312.gaussian.windowSize,
    );
    this.cvdAnalyzer = new CVDAnalyzer(
      this.config.v312.cvd.lookbackPeriod,
      this.config.v312.cvd.minStrength,
    );
    this.trixSystem = new TRIXSystem(
      this.config.v312.trix.period,
      this.config.v312.trix.signalPeriod,
    );
    this.derivativeFilter = new DerivativeFilter(
      this.config.v312.derivative.velocityPeriod,
      this.config.v312.derivative.accelerationPeriod,
    );
    this.elasticVolumeMA = new ElasticVolumeMA(
      this.config.v312.elasticVolume.lookbackPeriod,
    );

    // Initialize Ehlers Homodyne Discriminator instances (Fix 2)
    this.ehlersCycleShort = new EhlersCycleDetector();
    this.ehlersCycleMedium = new EhlersCycleDetector();
    this.ehlersCycleLong = new EhlersCycleDetector();
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
   */
  private calculateEhlersCycle(prices: number[]): Layer2Output['dominantCycle'] & { confirmed: boolean; confirmationCount: number; trendStrength: 'strong' | 'weak' | 'none' } {
    const cfg = this.config.ehlersCycle;
    // BUG 12 FIX: Pass unique timeframe keys so each cycle stores its own previous value
    const shortCycle = this.calculateSingleEhlersCycle(prices, cfg.short.minPeriod, cfg.short.maxPeriod, 'short');
    const mediumCycle = this.calculateSingleEhlersCycle(prices, cfg.medium.minPeriod, cfg.medium.maxPeriod, 'medium');
    const longCycle = this.calculateSingleEhlersCycle(prices, cfg.long.minPeriod, cfg.long.maxPeriod, 'long');
    
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
   * 计算单个 Ehlers 周期 — using Homodyne Discriminator (Fix 2)
   * BUG 12 FIX: Accept a timeframeKey so each cycle stores its own previous dominant period
   */
  private calculateSingleEhlersCycle(prices: number[], minPeriod: number, maxPeriod: number, timeframeKey: string = 'default'): Layer2Output['dominantCycle'] {
    if (prices.length < maxPeriod) {
      return { period: 20, phase: 0, state: 'stable' };
    }

    // Select the correct Ehlers detector for this timeframe
    let detector: EhlersCycleDetector;
    switch (timeframeKey) {
      case 'short': detector = this.ehlersCycleShort; break;
      case 'medium': detector = this.ehlersCycleMedium; break;
      case 'long': detector = this.ehlersCycleLong; break;
      default: detector = this.ehlersCycleMedium; break;
    }

    // Use the Homodyne Discriminator for cycle detection
    const result = detector.detectCycle(prices);
    
    // Clamp the detected period to this timeframe's valid range
    const period = Math.max(minPeriod, Math.min(maxPeriod, result.dominantCycle));

    // Compute phase from recent price position within the detected cycle
    const recentPrices = prices.slice(-period);
    const currentPrice = prices[prices.length - 1];
    const minPrice = Math.min(...recentPrices);
    const maxPrice = Math.max(...recentPrices);
    const phase = maxPrice === minPrice ? 0 : 2 * ((currentPrice - minPrice) / (maxPrice - minPrice)) - 1;

    // Determine cycle state using per-timeframe previous period tracking
    const prevPeriod = this.prevDominantCycleByTimeframe.get(timeframeKey) || period;
    const threshold = 1 + this.config.ehlersCycle.stateChangeThreshold;
    const state = period > prevPeriod * threshold ? 'expanding' :
                  period < prevPeriod * (2 - threshold) ? 'contracting' : 'stable';
    this.prevDominantCycleByTimeframe.set(timeframeKey, period);

    return { period, phase, state };
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

  /**
   * Normalized LMS (NLMS) Adaptive Filter
   * Per OCS spec: w(n+1) = w(n) + μ · e(n) · x(n) / (‖x‖² + ε)
   */
  private applyLMSFilter(
    layer1: Layer1Output,
    cycle: Layer2Output['dominantCycle']
  ): Layer2Output['lms'] {
    // Extract 4 input signals from Layer1 (normalized to [-1, 1])
    const signals = [
      (layer1.vpm.position - 0.5) * 2,            // Price position
      layer1.ama.trend === 'up' ? 1 : layer1.ama.trend === 'down' ? -1 : 0,  // AMA trend
      layer1.supertrend.direction === 'up' ? 1 : -1,  // Supertrend
      (layer1.stochastics.k - 50) / 50,            // Stochastics
    ];

    // Desired signal: consensus of strong signals weighted by cycle phase
    const desiredSignal = this.computeDesiredSignal(signals, cycle);

    // Current filter output: y(n) = w^T · x(n)
    const filterOutput = signals.reduce((sum, sig, i) => sum + sig * this.lmsWeights[i], 0);

    // Error signal: e(n) = d(n) - y(n)
    const error = desiredSignal - filterOutput;

    // Normalized LMS weight update: w(n+1) = w(n) + μ · e(n) · x(n) / (‖x‖² + ε)
    const normSq = signals.reduce((sum, s) => sum + s * s, 0);
    const epsilon = this.config.lms.epsilon;
    const mu = this.lmsLearningRate;

    for (let i = 0; i < signals.length; i++) {
      this.lmsWeights[i] += mu * error * signals[i] / (normSq + epsilon);
    }

    // Compute convergence metric (running average of squared error)
    if (!this.history.lmsErrors) this.history.lmsErrors = [];
    this.history.lmsErrors.push(error * error);
    if (this.history.lmsErrors.length > 50) this.history.lmsErrors.shift();
    
    const mse = this.history.lmsErrors.reduce((a: number, b: number) => a + b, 0) / this.history.lmsErrors.length;
    const convergence = Math.max(0, Math.min(1, 1 - Math.sqrt(mse)));

    // Clamp filtered signal to [-1, 1]
    const filteredSignal = Math.max(-1, Math.min(1, filterOutput));

    return {
      filteredSignal,
      weights: [...this.lmsWeights],
      convergence,
      learningRate: mu,
    };
  }

  /**
   * Compute desired/reference signal for NLMS adaptation.
   */
  private computeDesiredSignal(
    signals: number[],
    cycle: Layer2Output['dominantCycle']
  ): number {
    // Simple consensus: mean of all signals
    const consensus = signals.reduce((a, b) => a + b, 0) / signals.length;
    
    // Modulate by cycle phase: amplify when cycle confirms direction
    const cycleModulation = cycle.state === 'expanding' ? 1.2 :
                            cycle.state === 'contracting' ? 0.8 : 1.0;
    
    // Apply Fisher Transform for normalization to (-1, 1)
    const raw = consensus * cycleModulation;
    const clamped = Math.max(-0.999, Math.min(0.999, raw));
    
    return clamped;
  }

  /**
   * Fisher Transform: FT = 0.5 * ln((1+x)/(1-x))
   */
  private fisherTransform(value: number): number {
    const clamped = Math.max(-0.999, Math.min(0.999, value));
    return 0.5 * Math.log((1 + clamped) / (1 - clamped));
  }

  /**
   * Z-Score Confidence Filter with Dynamic Threshold
   */
  private calculateZScoreConfidence(signal: number): Layer2Output['confidence'] {
    const cfg = this.config.zScore;

    if (!this.history.zScores) this.history.zScores = [];
    this.history.zScores.push(signal);
    if (this.history.zScores.length > cfg.windowSize) this.history.zScores.shift();

    if (this.history.zScores.length < cfg.minSamples) {
      return { zScore: 0, confidence: 50, isHighConfidence: false, dynamicThreshold: cfg.defaultThreshold };
    }

    const mean = this.history.zScores.reduce((a: number, b: number) => a + b, 0) / this.history.zScores.length;
    const variance = this.history.zScores.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / this.history.zScores.length;
    const std = Math.sqrt(variance);

    const zScore = std === 0 ? 0 : (signal - mean) / std;

    // Apply Fisher Transform for better Gaussian normalization
    const fisherZ = this.fisherTransform(Math.max(-1, Math.min(1, zScore / 3)));
    
    // 动态阈值：使用配置的分位数
    const sortedScores = [...this.history.zScores].sort((a: number, b: number) => a - b);
    const percentileIndex = Math.floor(sortedScores.length * cfg.percentile);
    const dynamicThreshold = std === 0 ? cfg.defaultThreshold : Math.abs(sortedScores[percentileIndex] - mean) / std;
    
    // 使用动态阈值计算置信度
    const threshold = dynamicThreshold > 0 ? dynamicThreshold : cfg.defaultThreshold;
    const confidence = Math.min(100, Math.abs(fisherZ) / threshold * cfg.confidenceScale);

    return {
      zScore: fisherZ,
      confidence,
      isHighConfidence: Math.abs(fisherZ) > threshold,
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
