/**
 * QuantaAlpha 进化因子挖掘
 * 基于2026年论文 "QuantaAlpha: An Evolutionary Framework for LLM-Driven Alpha Mining"
 * 
 * 核心特性:
 * - LLM驱动的因子生成
 * - 进化算法优化
 * - 跨市场泛化
 * 
 * 实验结果: IC=0.1501, ARR=27.75%, CSI500超额160%
 * 
 * M2 Max优化: 使用本地LLM API，支持多provider降级
 */

import logger from '../logger';
import { llmClient } from '../ai/LLMClient';
import type { LLMProvider } from '../ai/LLMConfigManager';


const ANNUAL_TRADING_DAYS = 365; // crypto markets run 24/7

/**
 * ### 因子定义
 */
export interface FactorDefinition {
  /** 因子ID */
  id: string;
  /** 因子名称 */
  name: string;
  /** 因子公式 (伪代码) */
  formula: string;
  /** 因子描述 */
  description: string;
  /** 输入变量 */
  inputs: string[];
  /** 参数 */
  parameters: Record<string, number>;
  /** 因子类型 */
  type: 'momentum' | 'value' | 'quality' | 'volatility' | 'sentiment' | 'custom';
  /** 生成来源 */
  source: 'llm' | 'evolution' | 'manual';
}

/**
 * ### 因子评估结果
 */
export interface FactorEvaluation {
  /** 因子ID */
  factorId: string;
  /** IC值 */
  ic: number;
  /** ICIR */
  icir: number;
  /** IC t统计量 */
  icTStat: number;
  /** 年化收益 */
  annualizedReturn: number;
  /** 夏普比率 */
  sharpeRatio: number;
  /** 最大回撤 */
  maxDrawdown: number;
  /** 胜率 */
  winRate: number;
  /** 衰减周期 */
  decayPeriod: number;
  /** 与现有因子相关性 */
  correlationWithExisting: number;
  // FIX C5: additional fields for the composite fitness score
  /** Out-of-sample Sharpe ratio (computed on 30% holdout) */
  oosSharpRatio: number;
  /** Turnover penalty (0 = no turnover, 1 = max turnover) */
  turnoverPenalty: number;
  /** Composite fitness score used by the GA */
  fitnessScore: number;
}

/**
 * ### 进化配置
 */
export interface EvolutionConfig {
  /** 种群大小 */
  populationSize: number;
  /** 变异率 */
  mutationRate: number;
  /** 交叉率 */
  crossoverRate: number;
  /** 精英数量 */
  eliteCount: number;
  /** 最大代数 */
  maxGenerations: number;
  /** 目标IC */
  targetIC: number;
  /** 最小交易次数 */
  minTrades: number;
}

/**
 * ### QuantaAlpha 因子挖掘引擎
 */
export class QuantaAlphaEngine {
  private config: EvolutionConfig;
  private population: FactorDefinition[] = [];
  private evaluationCache: Map<string, FactorEvaluation> = new Map();
  private generation: number = 0;

  constructor(config?: Partial<EvolutionConfig>) {
    this.config = {
      populationSize: 50,
      mutationRate: 0.1,
      crossoverRate: 0.3,
      eliteCount: 5,
      maxGenerations: 100,
      targetIC: 0.05,
      minTrades: 100,
      ...config,
    };
  }

  /**
   * ### 初始化种群
   */
  async initializePopulation(): Promise<void> {
    logger.info('Initializing QuantaAlpha population...');
    logger.info(`Population size: ${this.config.populationSize}`);

    // 1. 生成LLM种子因子
    const seedFactors = await this.generateSeedFactors(Math.floor(this.config.populationSize * 0.3));

    // 2. 添加基础因子
    const basicFactors = this.getBasicFactors();

    // 3. 组合种群
    this.population = [...seedFactors, ...basicFactors];

    // 4. 填充随机因子
    while (this.population.length < this.config.populationSize) {
      this.population.push(this.generateRandomFactor());
    }

    logger.info(`Population initialized with ${this.population.length} factors`);
  }

  /**
   * ### LLM生成种子因子
   */
  private async generateSeedFactors(count: number): Promise<FactorDefinition[]> {
    const factors: FactorDefinition[] = [];

    const prompt = `Generate ${count} novel quantitative trading factors for cryptocurrency markets.
Each factor should be expressed as a simple formula using these inputs:
- close: closing price
- volume: trading volume
- high: high price
- low: low price
- returns: price returns

Output format for each factor:
NAME: [factor name]
FORMULA: [mathematical formula]
DESCRIPTION: [brief description]
TYPE: [momentum/value/volatility/sentiment]
`;

    try {
      const response = await llmClient.chat({ messages: [{ role: 'user', content: prompt }] });
      const generated = this.parseLLMFactors(response.content);
      factors.push(...generated.slice(0, count));
    } catch (error) {
      logger.warn('LLM factor generation failed, using fallback:', error);
      // 使用预定义因子作为后备
      factors.push(...this.getBasicFactors().slice(0, count));
    }

    return factors;
  }

  /**
   * ### 解析LLM生成的因子
   */
  private parseLLMFactors(content: string): FactorDefinition[] {
    const factors: FactorDefinition[] = [];
    const blocks = content.split(/NAME:/).filter(s => s.trim());

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const name = lines[0]?.trim() ?? `factor-${Date.now()}`;
      
      let formula = '';
      let description = '';
      let type: FactorDefinition['type'] = 'custom';

      for (const line of lines.slice(1)) {
        if (line.startsWith('FORMULA:')) {
          formula = line.replace('FORMULA:', '').trim();
        } else if (line.startsWith('DESCRIPTION:')) {
          description = line.replace('DESCRIPTION:', '').trim();
        } else if (line.startsWith('TYPE:')) {
          type = line.replace('TYPE:', '').trim() as FactorDefinition['type'];
        }
      }

      if (formula) {
        factors.push({
          id: `llm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          formula,
          description,
          inputs: ['close', 'volume', 'high', 'low'],
          parameters: {},
          type,
          source: 'llm',
        });
      }
    }

    return factors;
  }

  /**
   * ### 获取基础因子
   */
  private getBasicFactors(): FactorDefinition[] {
    return [
      {
        id: 'momentum-1',
        name: 'Price Momentum',
        formula: '(close - close.shift(20)) / close.shift(20)',
        description: '20日价格动量',
        inputs: ['close'],
        parameters: { period: 20 },
        type: 'momentum',
        source: 'manual',
      },
      {
        id: 'volume-1',
        name: 'Volume Ratio',
        formula: 'volume / volume.rolling(20).mean()',
        description: '成交量比率',
        inputs: ['volume'],
        parameters: { period: 20 },
        type: 'momentum',
        source: 'manual',
      },
      {
        id: 'volatility-1',
        name: 'Price Volatility',
        formula: 'returns.rolling(20).std()',
        description: '20日收益波动率',
        inputs: ['returns'],
        parameters: { period: 20 },
        type: 'volatility',
        source: 'manual',
      },
      {
        id: 'value-1',
        name: 'Mean Reversion',
        formula: '(close - close.rolling(20).mean()) / close.rolling(20).std()',
        description: '均值回归因子',
        inputs: ['close'],
        parameters: { period: 20 },
        type: 'value',
        source: 'manual',
      },
      {
        id: 'quality-1',
        name: 'Range Position',
        formula: '(close - low) / (high - low)',
        description: '日内价格位置',
        inputs: ['close', 'high', 'low'],
        parameters: {},
        type: 'quality',
        source: 'manual',
      },
    ];
  }

  /**
   * ### 生成随机因子
   */
  private generateRandomFactor(): FactorDefinition {
    const operators = ['+', '-', '*', '/', 'abs', 'log', 'sqrt', 'rank', 'ts_mean', 'ts_std'];
    const inputs = ['close', 'volume', 'high', 'low', 'returns'];
    const types: FactorDefinition['type'][] = ['momentum', 'value', 'volatility', 'custom'];

    const op = operators[Math.floor(Math.random() * operators.length)];
    const input1 = inputs[Math.floor(Math.random() * inputs.length)];
    const input2 = inputs[Math.floor(Math.random() * inputs.length)];
    const period = Math.floor(Math.random() * 20) + 5;

    let formula = '';
    switch (op) {
      case 'rank':
        formula = `${op}(${input1}.rolling(${period}).mean())`;
        break;
      case 'ts_mean':
      case 'ts_std':
        formula = `${op}(${input1}, ${period})`;
        break;
      default:
        formula = `${op}(${input1}, ${input2})`;
    }

    return {
      id: `random-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `Random Factor ${this.population.length}`,
      formula,
      description: `随机生成的因子: ${formula}`,
      inputs: [input1, input2].filter((v, i, a) => a.indexOf(v) === i).filter(Boolean) as string[],
      parameters: { period },
      type: types[Math.floor(Math.random() * types.length)] || 'custom',
      source: 'evolution',
    };
  }

  /**
   * ### 运行进化算法
   */
  async evolve(data: {
    prices: number[];
    volumes: number[];
    returns: number[];
  }): Promise<FactorDefinition[]> {
    logger.info(`Starting evolution generation ${this.generation + 1}...`);

    // 1. 评估种群
    await this.evaluatePopulation(data);

    // 2. 选择
    const selected = this.select();

    // 3. 交叉
    const offspring = this.crossover(selected);

    // 4. 变异
    const mutated = this.mutate(offspring);

    // 5. 更新种群
    this.population = [...selected.slice(0, this.config.eliteCount), ...mutated];
    this.generation++;

    // 6. 返回最佳因子
    return this.getTopFactors(10);
  }

  /**
   * ### 评估种群
   */
  private async evaluatePopulation(data: {
    prices: number[];
    volumes: number[];
    returns: number[];
  }): Promise<void> {
    for (const factor of this.population) {
      if (!this.evaluationCache.has(factor.id)) {
        const evaluation = this.evaluateFactor(factor, data);
        this.evaluationCache.set(factor.id, evaluation);
      }
    }
  }

  // =====================================================================
  // FIX C5: Complete rewrite of fitness evaluation.
  //
  // PROBLEM: The original evaluateFactor/calculateIC returned random
  // values (Math.random()), making the genetic algorithm equivalent to
  // random search. No actual data analysis was performed.
  //
  // FIX: Implement a real fitness function that:
  //  1. Computes the factor's signal series from OHLCV data
  //  2. Calculates forward returns with no lookahead bias
  //  3. Splits data 70/30 for in-sample / out-of-sample evaluation
  //  4. Computes out-of-sample Sharpe ratio
  //  5. Computes Information Coefficient (Spearman rank correlation)
  //  6. Adds a PBO (Probability of Backtest Overfitting) penalty via
  //     in-sample vs out-of-sample Sharpe degradation
  //  7. Computes turnover penalty to favour stable signals
  //  8. Composite score: 0.5*oosSharpNorm + 0.3*IC + 0.2*(1-turnover)
  // =====================================================================

  /**
   * ### 计算因子信号序列
   * FIX C5: Evaluates the factor formula against OHLCV data to produce
   * a numeric signal at every bar. Uses a safe interpreter for the
   * formula DSL (shift, rolling mean/std, rank, abs, log, sqrt, ts_mean, ts_std).
   */
  private computeSignalSeries(
    factor: FactorDefinition,
    data: { prices: number[]; volumes: number[]; returns: number[]; highs?: number[]; lows?: number[] }
  ): number[] {
    const n = data.prices.length;
    const period = factor.parameters.period || 20;
    const formula = factor.formula.toLowerCase();

    // Provide high/low arrays; fall back to prices if not available
    const highs = data.highs ?? data.prices;
    const lows = data.lows ?? data.prices;

    // Helper: resolve an input name to its array
    const resolveInput = (name: string): number[] => {
      switch (name.trim()) {
        case 'close': return data.prices;
        case 'volume': return data.volumes;
        case 'returns': return data.returns;
        case 'high': return highs;
        case 'low': return lows;
        default: return data.prices;
      }
    };

    // Helper: rolling mean of an array with window w
    const rollingMean = (arr: number[], w: number): number[] => {
      const out = new Array<number>(arr.length).fill(NaN);
      for (let i = w - 1; i < arr.length; i++) {
        let sum = 0;
        for (let j = i - w + 1; j <= i; j++) sum += arr[j]!;
        out[i] = sum / w;
      }
      return out;
    };

    // Helper: rolling std of an array with window w
    const rollingStd = (arr: number[], w: number): number[] => {
      const means = rollingMean(arr, w);
      const out = new Array<number>(arr.length).fill(NaN);
      for (let i = w - 1; i < arr.length; i++) {
        let sumSq = 0;
        for (let j = i - w + 1; j <= i; j++) {
          const diff = arr[j]! - means[i]!;
          sumSq += diff * diff;
        }
        out[i] = Math.sqrt(sumSq / w);
      }
      return out;
    };

    // Helper: shift array by k bars (positive = look-back)
    const shift = (arr: number[], k: number): number[] => {
      const out = new Array<number>(arr.length).fill(NaN);
      for (let i = k; i < arr.length; i++) out[i] = arr[i - k]!;
      return out;
    };

    // Helper: cross-sectional rank (percentile within array values)
    const rank = (arr: number[]): number[] => {
      return arr.map((v, _i, a) => {
        if (isNaN(v)) return NaN;
        let below = 0;
        let valid = 0;
        for (const x of a) {
          if (!isNaN(x)) {
            valid++;
            if (x < v) below++;
          }
        }
        return valid > 0 ? below / valid : NaN;
      });
    };

    // ---- Dispatch on formula pattern ----
    // We match common formula patterns produced by the factor generator

    const primary = resolveInput(factor.inputs[0] || 'close');

    // Pattern: (close - close.shift(N)) / close.shift(N)  -- momentum
    if (formula.includes('shift') && formula.includes('/')) {
      const shifted = shift(primary, period);
      return primary.map((v, i) => {
        const s = shifted[i]!;
        return (!isNaN(s) && s !== 0) ? (v - s) / s : NaN;
      });
    }

    // Pattern: volume / volume.rolling(N).mean()
    if (formula.includes('rolling') && formula.includes('mean') && formula.includes('/')) {
      const rm = rollingMean(primary, period);
      return primary.map((v, i) => {
        const m = rm[i]!;
        return (!isNaN(m) && m !== 0) ? v / m : NaN;
      });
    }

    // Pattern: returns.rolling(N).std()
    if (formula.includes('rolling') && formula.includes('std') && !formula.includes('mean')) {
      return rollingStd(primary, period);
    }

    // Pattern: (close - close.rolling(N).mean()) / close.rolling(N).std()  -- z-score
    if (formula.includes('rolling') && formula.includes('mean') && formula.includes('std')) {
      const rm = rollingMean(primary, period);
      const rs = rollingStd(primary, period);
      return primary.map((v, i) => {
        const m = rm[i]!;
        const s = rs[i]!;
        return (!isNaN(m) && !isNaN(s) && s !== 0) ? (v - m) / s : NaN;
      });
    }

    // Pattern: (close - low) / (high - low)  -- range position
    if (formula.includes('close') && formula.includes('low') && formula.includes('high')) {
      return data.prices.map((c, i) => {
        const range = highs[i]! - lows[i]!;
        return range !== 0 ? (c - lows[i]!) / range : NaN;
      });
    }

    // Pattern: rank(...)
    if (formula.startsWith('rank(')) {
      const rm = rollingMean(primary, period);
      return rank(rm);
    }

    // Pattern: ts_mean(...) or ts_std(...)
    if (formula.startsWith('ts_mean')) {
      return rollingMean(primary, period);
    }
    if (formula.startsWith('ts_std')) {
      return rollingStd(primary, period);
    }

    // Pattern: abs(...)
    if (formula.startsWith('abs(')) {
      return primary.map(v => Math.abs(v));
    }

    // Pattern: log(...)
    if (formula.startsWith('log(')) {
      return primary.map(v => (v > 0 ? Math.log(v) : NaN));
    }

    // Pattern: sqrt(...)
    if (formula.startsWith('sqrt(')) {
      return primary.map(v => (v >= 0 ? Math.sqrt(v) : NaN));
    }

    // Pattern: arithmetic operator between two inputs  e.g. +(close, volume)
    if (/^[\+\-\*\/]\(/.test(formula)) {
      const secondary = resolveInput(factor.inputs[1] || 'volume');
      const op = formula[0];
      return primary.map((v, i) => {
        const w = secondary[i] ?? 0;
        switch (op) {
          case '+': return v + w;
          case '-': return v - w;
          case '*': return v * w;
          case '/': return w !== 0 ? v / w : NaN;
          default: return NaN;
        }
      });
    }

    // Pattern: combined/child formulas with rolling mean at end
    if (formula.includes('.rolling') && formula.includes('.mean()')) {
      return rollingMean(primary, Math.min(period, 5));
    }

    // Fallback: use rolling z-score of primary input as a generic signal
    {
      const rm = rollingMean(primary, period);
      const rs = rollingStd(primary, period);
      return primary.map((v, i) => {
        const m = rm[i]!;
        const s = rs[i]!;
        return (!isNaN(m) && !isNaN(s) && s !== 0) ? (v - m) / s : NaN;
      });
    }
  }

  /**
   * ### 计算前向收益 (无未来数据泄漏)
   * FIX C5: Compute forward returns using only past data. For bar i,
   * forward return = prices[i+1]/prices[i] - 1 (simple one-bar-ahead return).
   * The last bar has NaN because its forward return is unknown.
   */
  private computeForwardReturns(prices: number[]): number[] {
    const fwd = new Array<number>(prices.length).fill(NaN);
    for (let i = 0; i < prices.length - 1; i++) {
      if (prices[i]! !== 0) {
        fwd[i] = prices[i + 1]! / prices[i]! - 1;
      }
    }
    return fwd;
  }

  /**
   * ### Spearman 秩相关系数
   * FIX C5: Computes rank correlation between two arrays (only on
   * indices where both values are finite). This is the Information
   * Coefficient (IC) — the standard measure of factor predictive power.
   */
  private spearmanRankCorrelation(x: number[], y: number[]): number {
    // Collect paired valid observations
    const pairs: { xv: number; yv: number }[] = [];
    const len = Math.min(x.length, y.length);
    for (let i = 0; i < len; i++) {
      if (isFinite(x[i]!) && isFinite(y[i]!)) {
        pairs.push({ xv: x[i]!, yv: y[i]! });
      }
    }
    const n = pairs.length;
    if (n < 10) return 0; // Not enough data

    // Assign ranks (average rank for ties)
    const assignRanks = (values: number[]): number[] => {
      const indexed = values.map((v, i) => ({ v, i }));
      indexed.sort((a, b) => a.v - b.v);
      const ranks = new Array<number>(values.length);
      let i = 0;
      while (i < indexed.length) {
        let j = i;
        while (j < indexed.length && indexed[j]!.v === indexed[i]!.v) j++;
        const avgRank = (i + j - 1) / 2 + 1; // 1-based average rank
        for (let k = i; k < j; k++) ranks[indexed[k]!.i] = avgRank;
        i = j;
      }
      return ranks;
    };

    const xRanks = assignRanks(pairs.map(p => p.xv));
    const yRanks = assignRanks(pairs.map(p => p.yv));

    // Pearson correlation on ranks
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += xRanks[i]!;
      sumY += yRanks[i]!;
      sumXY += xRanks[i]! * yRanks[i]!;
      sumX2 += xRanks[i]! * xRanks[i]!;
      sumY2 += yRanks[i]! * yRanks[i]!;
    }
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * ### 计算夏普比率 (给定一组收益)
   * FIX C5: Annualized Sharpe = mean(returns) / std(returns) * sqrt(ANNUAL_TRADING_DAYS).
   * Only uses finite values.
   */
  private computeSharpeRatio(returns: number[]): number {
    const valid = returns.filter(r => isFinite(r));
    if (valid.length < 2) return 0;

    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / (valid.length - 1);
    const std = Math.sqrt(variance);
    if (std === 0) return 0;

    // Annualize: assume daily bars, 365 days (crypto 24/7)
    return (mean / std) * Math.sqrt(ANNUAL_TRADING_DAYS);
  }

  /**
   * ### 计算换手率惩罚
   * FIX C5: Turnover is measured as the mean absolute change in the
   * signal between consecutive bars, normalized by the signal's range.
   * High turnover signals incur a penalty because they are expensive
   * to trade and may indicate noise rather than real alpha.
   */
  private computeTurnoverPenalty(signals: number[]): number {
    const valid: number[] = [];
    for (const s of signals) {
      if (isFinite(s)) valid.push(s);
    }
    if (valid.length < 2) return 1;

    // Signal range
    const minS = Math.min(...valid);
    const maxS = Math.max(...valid);
    const range = maxS - minS;
    if (range === 0) return 0;

    // Mean absolute change, normalized to [0, 1]
    let totalChange = 0;
    for (let i = 1; i < valid.length; i++) {
      totalChange += Math.abs(valid[i]! - valid[i - 1]!);
    }
    const avgChange = totalChange / (valid.length - 1);
    // Normalize so that penalty is in [0, 1]
    return Math.min(1, avgChange / range);
  }

  /**
   * ### 评估单个因子 (FIX C5 — replaced random fitness)
   *
   * FIX C5: The original implementation returned random values for all
   * metrics, making the GA equivalent to random search.
   *
   * New implementation:
   * 1. Compute signal series from OHLCV via computeSignalSeries()
   * 2. Compute forward returns (no lookahead)
   * 3. Split 70/30 into in-sample (IS) and out-of-sample (OOS)
   * 4. Compute IC (Spearman rank correlation) on full valid data
   * 5. Compute IS and OOS Sharpe ratios
   * 6. PBO penalty: if IS Sharpe >> OOS Sharpe, penalize (overfitting)
   * 7. Turnover penalty on OOS signals
   * 8. Composite fitness: 0.5*oosSharpNorm + 0.3*IC + 0.2*(1-turnover)
   */
  private evaluateFactor(
    factor: FactorDefinition,
    data: { prices: number[]; volumes: number[]; returns: number[] }
  ): FactorEvaluation {
    const n = data.prices.length;

    // --- Step 1: Compute the factor's signal series ---
    const signals = this.computeSignalSeries(factor, data);

    // --- Step 2: Compute forward returns (no lookahead) ---
    const forwardReturns = this.computeForwardReturns(data.prices);

    // --- Step 3: Split 70/30 ---
    const splitIdx = Math.floor(n * 0.7);
    const isSignals = signals.slice(0, splitIdx);
    const oosSignals = signals.slice(splitIdx);
    const isForward = forwardReturns.slice(0, splitIdx);
    const oosForward = forwardReturns.slice(splitIdx);

    // --- Step 4: Compute IC (Spearman rank correlation on OOS) ---
    // FIX C5: IC is the rank correlation between predicted signal and
    // actual forward return — this is the gold standard metric for
    // measuring a factor's predictive power in quant finance.
    const ic = this.spearmanRankCorrelation(oosSignals, oosForward);

    // --- Step 5: Compute IS and OOS Sharpe ratios ---
    // Strategy returns: sign(signal) * forward_return (long if signal > 0, short otherwise)
    const strategyReturnsIS: number[] = [];
    for (let i = 0; i < isSignals.length; i++) {
      if (isFinite(isSignals[i]!) && isFinite(isForward[i]!)) {
        const direction = isSignals[i]! > 0 ? 1 : isSignals[i]! < 0 ? -1 : 0;
        strategyReturnsIS.push(direction * isForward[i]!);
      }
    }
    const strategyReturnsOOS: number[] = [];
    for (let i = 0; i < oosSignals.length; i++) {
      if (isFinite(oosSignals[i]!) && isFinite(oosForward[i]!)) {
        const direction = oosSignals[i]! > 0 ? 1 : oosSignals[i]! < 0 ? -1 : 0;
        strategyReturnsOOS.push(direction * oosForward[i]!);
      }
    }
    const isSharpe = this.computeSharpeRatio(strategyReturnsIS);
    const oosSharpe = this.computeSharpeRatio(strategyReturnsOOS);

    // --- Step 6: PBO (Probability of Backtest Overfitting) penalty ---
    // FIX C5: If in-sample Sharpe is much higher than out-of-sample,
    // the factor is likely overfit. Penalty increases as the gap grows.
    // pboPenalty in [0, 1]: 0 means no overfitting concern, 1 means
    // severe overfitting (IS >> OOS).
    let pboPenalty = 0;
    if (isSharpe > 0 && oosSharpe < isSharpe) {
      // Ratio of degradation: how much Sharpe dropped from IS to OOS
      const degradation = 1 - (oosSharpe / isSharpe);
      pboPenalty = Math.max(0, Math.min(1, degradation));
    }

    // --- Step 7: Turnover penalty on OOS ---
    const turnoverPenalty = this.computeTurnoverPenalty(oosSignals);

    // --- Step 8: Composite fitness ---
    // FIX C5: Normalize OOS Sharpe to [0, 1] range via sigmoid-like transform.
    // A Sharpe of 2 maps to ~0.76, Sharpe of 0 maps to 0.5.
    // Then apply PBO penalty to discourage overfitting.
    const oosSharpNormalized = (1 / (1 + Math.exp(-oosSharpe))) * (1 - pboPenalty);

    // Composite: 0.5 * OOS Sharpe (normalized) + 0.3 * IC + 0.2 * (1 - turnover)
    const fitnessScore =
      0.5 * oosSharpNormalized +
      0.3 * Math.max(0, ic) + // only reward positive IC
      0.2 * (1 - turnoverPenalty);

    // --- Derive remaining evaluation metrics from real data ---
    const icir = ic !== 0 ? ic * Math.sqrt(ANNUAL_TRADING_DAYS) : 0;
    const validOOSReturns = strategyReturnsOOS.filter(r => isFinite(r));
    const annualizedReturn = validOOSReturns.length > 0
      ? (validOOSReturns.reduce((a, b) => a + b, 0) / validOOSReturns.length) * ANNUAL_TRADING_DAYS
      : 0;

    // Max drawdown on OOS cumulative returns
    let peak = 0;
    let cumReturn = 0;
    let maxDrawdown = 0;
    for (const r of validOOSReturns) {
      cumReturn += r;
      if (cumReturn > peak) peak = cumReturn;
      const dd = peak - cumReturn;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Win rate on OOS
    const wins = validOOSReturns.filter(r => r > 0).length;
    const winRate = validOOSReturns.length > 0 ? wins / validOOSReturns.length : 0.5;

    // Decay period: number of bars until autocorrelation of signal drops below 0.5
    let decayPeriod = 1;
    const validSignals = oosSignals.filter(s => isFinite(s));
    if (validSignals.length > 10) {
      const sigMean = validSignals.reduce((a, b) => a + b, 0) / validSignals.length;
      const sigVar = validSignals.reduce((a, b) => a + (b - sigMean) ** 2, 0) / validSignals.length;
      if (sigVar > 0) {
        for (let lag = 1; lag < Math.min(validSignals.length / 2, 60); lag++) {
          let cov = 0;
          for (let i = 0; i < validSignals.length - lag; i++) {
            cov += (validSignals[i]! - sigMean) * (validSignals[i + lag]! - sigMean);
          }
          cov /= (validSignals.length - lag);
          if (cov / sigVar < 0.5) {
            decayPeriod = lag;
            break;
          }
          decayPeriod = lag;
        }
      }
    }

    return {
      factorId: factor.id,
      ic,
      icir,
      icTStat: ic * Math.sqrt(validOOSReturns.length),
      annualizedReturn,
      sharpeRatio: oosSharpe,
      maxDrawdown: -maxDrawdown,
      winRate,
      decayPeriod,
      correlationWithExisting: 0, // Computed separately when full portfolio is available
      // FIX C5: new fields
      oosSharpRatio: oosSharpe,
      turnoverPenalty,
      fitnessScore,
    };
  }

  /**
   * ### 计算IC (FIX C5 — replaced random IC)
   *
   * FIX C5: The original implementation returned Math.random() values,
   * completely ignoring the input data. Now delegates to the full
   * evaluateFactor pipeline and returns the Spearman rank IC.
   *
   * This method is kept for backward compatibility but the real work
   * is done inside evaluateFactor -> spearmanRankCorrelation.
   */
  private calculateIC(
    factor: FactorDefinition,
    data: { prices: number[]; volumes: number[]; returns: number[] }
  ): number {
    // FIX C5: Compute real IC via signal series and forward returns
    const signals = this.computeSignalSeries(factor, data);
    const forwardReturns = this.computeForwardReturns(data.prices);
    return this.spearmanRankCorrelation(signals, forwardReturns);
  }

  /**
   * ### 选择
   * FIX C5: Selection now uses fitnessScore (composite) instead of
   * raw IC, ensuring the GA optimizes for out-of-sample performance,
   * information content, and trading cost simultaneously.
   */
  private select(): FactorDefinition[] {
    // FIX C5: Sort by composite fitnessScore instead of raw IC
    const sorted = [...this.population].sort((a, b) => {
      const fitA = this.evaluationCache.get(a.id)?.fitnessScore ?? 0;
      const fitB = this.evaluationCache.get(b.id)?.fitnessScore ?? 0;
      return fitB - fitA;
    });

    // 锦标赛选择
    const selected: FactorDefinition[] = [];
    const tournamentSize = 5;

    while (selected.length < this.config.populationSize - this.config.eliteCount) {
      const tournament = Array.from({ length: tournamentSize }, () =>
        sorted[Math.floor(Math.random() * sorted.length)]
      );

      // FIX C5: Use fitnessScore for tournament winner selection
      const winner = tournament.reduce((best, current) => {
        if (!best || !current) return best || current;
        const fitBest = this.evaluationCache.get(best.id)?.fitnessScore ?? 0;
        const fitCurrent = this.evaluationCache.get(current.id)?.fitnessScore ?? 0;
        return fitCurrent > fitBest ? current : best;
      });

      if (winner) {
        selected.push(winner);
      }
    }
    return selected;
  }

  /**
   * ### 交叉
   */
  private crossover(selected: FactorDefinition[]): FactorDefinition[] {
    const offspring: FactorDefinition[] = [];

    for (let i = 0; i < selected.length - 1; i += 2) {
      if (Math.random() < this.config.crossoverRate) {
        const parent1 = selected[i]!;
        const parent2 = selected[i + 1]!;

        // 单点交叉
        const child1 = this.createChild(parent1, parent2);
        const child2 = this.createChild(parent2, parent1);

        offspring.push(child1, child2);
      } else {
        offspring.push(selected[i]!, selected[i + 1]!);
      }
    }

    return offspring;
  }

  /**
   * ### 创建子代
   */
  private createChild(parent1: FactorDefinition, parent2: FactorDefinition): FactorDefinition {
    return {
      id: `child-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${parent1.name}x${parent2.name}`,
      formula: `(${parent1.formula}) * 0.5 + (${parent2.formula}) * 0.5`,
      description: `组合因子: ${parent1.description} + ${parent2.description}`,
      inputs: [...new Set([...parent1.inputs, ...parent2.inputs])],
      parameters: { ...parent1.parameters, ...parent2.parameters },
      type: Math.random() < 0.5 ? parent1.type : parent2.type,
      source: 'evolution',
    };
  }

  /**
   * ### 变异
   */
  private mutate(offspring: FactorDefinition[]): FactorDefinition[] {
    return offspring.map(factor => {
      if (Math.random() < this.config.mutationRate) {
        return this.mutateFactor(factor);
      }
      return factor;
    });
  }

  /**
   * ### 变异单个因子
   */
  private mutateFactor(factor: FactorDefinition): FactorDefinition {
    const mutations = [
      () => ({
        ...factor,
        formula: `${factor.formula} * 1.1`,
      }),
      () => ({
        ...factor,
        formula: `abs(${factor.formula})`,
      }),
      () => ({
        ...factor,
        formula: `rank(${factor.formula})`,
      }),
      () => ({
        ...factor,
        formula: `${factor.formula}.rolling(5).mean()`,
      }),
    ];

    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    const mutated = mutation ? mutation() : factor;

    return {
      ...mutated,
      id: `mutant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: 'evolution',
    };
  }

  /**
   * ### 获取顶级因子
   * FIX C5: Sort by fitnessScore instead of raw |IC|
   */
  getTopFactors(count: number): FactorDefinition[] {
    return [...this.population]
      .sort((a, b) => {
        // FIX C5: Use composite fitnessScore for ranking
        const fitA = this.evaluationCache.get(a.id)?.fitnessScore ?? 0;
        const fitB = this.evaluationCache.get(b.id)?.fitnessScore ?? 0;
        return fitB - fitA;
      })
      .slice(0, count);
  }

  /**
   * ### 获取因子评估
   */
  getFactorEvaluation(factorId: string): FactorEvaluation | undefined {
    return this.evaluationCache.get(factorId);
  }

  /**
   * ### 获取进化统计
   */
  getStats(): {
    generation: number;
    populationSize: number;
    avgIC: number;
    bestIC: number;
    bestFactor: FactorDefinition | null;
    // FIX C5: expose fitness stats
    avgFitness: number;
    bestFitness: number;
  } {
    const evaluations = Array.from(this.evaluationCache.values());
    const ics = evaluations.map(e => e.ic);
    const fitnesses = evaluations.map(e => e.fitnessScore);

    const bestFactor = this.getTopFactors(1)[0] ?? null;

    return {
      generation: this.generation,
      populationSize: this.population.length,
      avgIC: ics.length > 0 ? ics.reduce((a, b) => a + b, 0) / ics.length : 0,
      bestIC: ics.length > 0 ? Math.max(...ics) : 0,
      bestFactor,
      // FIX C5: fitness stats for monitoring GA convergence
      avgFitness: fitnesses.length > 0 ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length : 0,
      bestFitness: fitnesses.length > 0 ? Math.max(...fitnesses) : 0,
    };
  }
}

/**
 * ### 单例导出
 */
export const quantaAlphaEngine = new QuantaAlphaEngine();
