/**
 * Parameter Sensitivity Analysis & Walk-Forward Validation
 *
 * Addresses audit issue M4: 70+ free parameters with no cross-validation
 * or sensitivity analysis. This module provides:
 *
 *   1. ParameterRegistry  — catalogs every tunable parameter with its range
 *   2. SensitivityAnalyzer — one-at-a-time (OAT) sensitivity sweeps
 *   3. WalkForwardValidator — rolling walk-forward optimization
 *
 * Methodology references:
 *   - López de Prado, "Advances in Financial Machine Learning" (2018), Ch. 8
 *     (backtest statistics, deflated Sharpe, walk-forward)
 *   - Saltelli et al., "Global Sensitivity Analysis" (2008)
 *     (OAT screening as a first-pass before Sobol indices)
 *
 * Design: framework-agnostic — receives a backtest runner callback,
 * does not depend on any specific backtest implementation.
 */

import type { OHLCV } from '../events/types';

// ────────────────────────────────────────────────────────────────
// Shared types
// ────────────────────────────────────────────────────────────────

/** Backtest performance metrics returned by the runner callback. */
export interface BacktestMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalReturn: number;
  totalTrades: number;
}

// ────────────────────────────────────────────────────────────────
// 1. Parameter Registry
// ────────────────────────────────────────────────────────────────

/** Descriptor for a single tunable parameter. */
export interface TunableParameter {
  name: string;            // dotted path, e.g. "knn.k"
  module: string;          // source module, e.g. "knn3d"
  currentValue: number;
  range: [number, number]; // [min, max]
  step: number;            // grid resolution
  type: 'integer' | 'float';
  description: string;
}

/**
 * Central catalog of every tunable parameter in the trading system.
 *
 * Pre-populated from the actual codebase audit (knn3d, OCS layers 1-4,
 * risk-config, bot config).  New parameters can be added at runtime
 * via `register()`.
 */
export class ParameterRegistry {
  private params: Map<string, TunableParameter> = new Map();

  constructor(autoPopulate = true) {
    if (autoPopulate) this.populateDefaults();
  }

  /** Register or overwrite a single parameter. */
  register(p: TunableParameter): void {
    this.params.set(p.name, p);
  }

  /** Retrieve a parameter by dotted name. */
  get(name: string): TunableParameter | undefined {
    return this.params.get(name);
  }

  /** All registered parameters. */
  all(): TunableParameter[] {
    return Array.from(this.params.values());
  }

  /** Parameters belonging to a specific module. */
  byModule(module: string): TunableParameter[] {
    return this.all().filter(p => p.module === module);
  }

  /** Unique module names. */
  modules(): string[] {
    return [...new Set(this.all().map(p => p.module))];
  }

  /** Build a flat param→value map from current defaults. */
  defaults(): Record<string, number> {
    const m: Record<string, number> = {};
    for (const p of this.params.values()) m[p.name] = p.currentValue;
    return m;
  }

  /** Number of registered parameters. */
  get size(): number {
    return this.params.size;
  }

  // ── pre-populated defaults from codebase audit ──────────────

  private populateDefaults(): void {
    const reg = (p: TunableParameter) => this.register(p);

    // ── KNN (knn3d.ts) ──────────────────────────────────────
    reg({ name: 'knn.k',              module: 'knn3d', currentValue: 5,     range: [3, 15],    step: 2,     type: 'integer', description: 'Number of nearest neighbors' });
    reg({ name: 'knn.maxHistory',     module: 'knn3d', currentValue: 1000,  range: [200, 3000], step: 200,  type: 'integer', description: 'Max stored patterns' });
    reg({ name: 'knn.buyThreshold',   module: 'knn3d', currentValue: 0.003, range: [0.001, 0.01], step: 0.001, type: 'float', description: 'Min return to label buy' });
    reg({ name: 'knn.sellThreshold',  module: 'knn3d', currentValue: 0.003, range: [0.001, 0.01], step: 0.001, type: 'float', description: 'Min |return| to label sell (abs)' });
    reg({ name: 'knn.windowSize',     module: 'knn3d', currentValue: 30,    range: [7, 60],    step: 5,     type: 'integer', description: 'Adaptive window base (days)' });
    reg({ name: 'knn.featureW0',      module: 'knn3d', currentValue: 0.5,   range: [0.1, 0.8], step: 0.1,  type: 'float',   description: 'Price-position feature weight' });
    reg({ name: 'knn.featureW1',      module: 'knn3d', currentValue: 0.3,   range: [0.1, 0.6], step: 0.1,  type: 'float',   description: 'Volume-elasticity feature weight' });
    reg({ name: 'knn.featureW2',      module: 'knn3d', currentValue: 0.2,   range: [0.05, 0.5], step: 0.05, type: 'float',  description: 'Cycle-phase feature weight' });

    // ── OCS Layer 1 (layer1.ts) ─────────────────────────────
    reg({ name: 'layer1.vpmPeriod',         module: 'layer1', currentValue: 20,   range: [10, 50],   step: 5,    type: 'integer', description: 'VPM lookback period' });
    reg({ name: 'layer1.amaFast',           module: 'layer1', currentValue: 2,    range: [2, 5],     step: 1,    type: 'integer', description: 'Ehlers AMA fast length' });
    reg({ name: 'layer1.amaSlow',           module: 'layer1', currentValue: 30,   range: [15, 50],   step: 5,    type: 'integer', description: 'Ehlers AMA slow length' });
    reg({ name: 'layer1.supertrendPeriod',  module: 'layer1', currentValue: 10,   range: [5, 20],    step: 1,    type: 'integer', description: 'Supertrend ATR period' });
    reg({ name: 'layer1.supertrendMult',    module: 'layer1', currentValue: 3,    range: [1.5, 5],   step: 0.5,  type: 'float',   description: 'Supertrend ATR multiplier' });
    reg({ name: 'layer1.stochK',           module: 'layer1', currentValue: 14,   range: [5, 21],    step: 1,    type: 'integer', description: 'Stochastics %K period' });
    reg({ name: 'layer1.stochD',           module: 'layer1', currentValue: 3,    range: [2, 7],     step: 1,    type: 'integer', description: 'Stochastics %D smoothing' });
    reg({ name: 'layer1.atrPeriod',         module: 'layer1', currentValue: 14,   range: [7, 21],    step: 1,    type: 'integer', description: 'ATR period' });
    reg({ name: 'layer1.gaussianSigma',     module: 'layer1', currentValue: 2.0,  range: [0.5, 4.0], step: 0.5,  type: 'float',   description: 'Gaussian smoothing sigma' });
    reg({ name: 'layer1.gaussianWindow',    module: 'layer1', currentValue: 20,   range: [10, 40],   step: 5,    type: 'integer', description: 'Gaussian smoothing window' });

    // ── OCS Layer 2 (layer2.ts) ─────────────────────────────
    reg({ name: 'layer2.lmsLearningRate',   module: 'layer2', currentValue: 0.01, range: [0.001, 0.1], step: 0.005, type: 'float', description: 'LMS adaptive filter learning rate' });
    reg({ name: 'layer2.zScoreWindow',      module: 'layer2', currentValue: 100,  range: [30, 200],  step: 10,   type: 'integer', description: 'Z-score rolling window' });
    reg({ name: 'layer2.cycleShortMin',     module: 'layer2', currentValue: 5,    range: [3, 10],    step: 1,    type: 'integer', description: 'Short cycle min period' });
    reg({ name: 'layer2.cycleShortMax',     module: 'layer2', currentValue: 15,   range: [10, 25],   step: 5,    type: 'integer', description: 'Short cycle max period' });
    reg({ name: 'layer2.cycleMedMin',       module: 'layer2', currentValue: 15,   range: [10, 25],   step: 5,    type: 'integer', description: 'Medium cycle min period' });
    reg({ name: 'layer2.cycleMedMax',       module: 'layer2', currentValue: 40,   range: [30, 60],   step: 5,    type: 'integer', description: 'Medium cycle max period' });

    // ── OCS Layer 3 (layer3.ts) ─────────────────────────────
    reg({ name: 'layer3.embargoBars',       module: 'layer3', currentValue: 5,    range: [1, 15],    step: 1,    type: 'integer', description: 'Temporal embargo for KNN search' });
    reg({ name: 'layer3.labelLookback',     module: 'layer3', currentValue: 5,    range: [3, 15],    step: 1,    type: 'integer', description: 'Lookback for past-return labeling' });
    reg({ name: 'layer3.confidenceThresh',  module: 'layer3', currentValue: 50,   range: [40, 70],   step: 5,    type: 'float',   description: 'Min confidence to emit buy/sell' });

    // ── OCS Layer 4 (layer4.ts) ─────────────────────────────
    reg({ name: 'layer4.slAtrMult',         module: 'layer4', currentValue: 1.5,  range: [0.5, 3.0], step: 0.25, type: 'float',   description: 'Stop-loss ATR multiplier' });
    reg({ name: 'layer4.tp1Ratio',          module: 'layer4', currentValue: 1.5,  range: [0.5, 3.0], step: 0.25, type: 'float',   description: 'TP1 risk-reward ratio' });
    reg({ name: 'layer4.tp2Ratio',          module: 'layer4', currentValue: 2.5,  range: [1.5, 4.0], step: 0.5,  type: 'float',   description: 'TP2 risk-reward ratio' });
    reg({ name: 'layer4.tp3Ratio',          module: 'layer4', currentValue: 4.0,  range: [2.5, 6.0], step: 0.5,  type: 'float',   description: 'TP3 risk-reward ratio' });
    reg({ name: 'layer4.riskPerTrade',      module: 'layer4', currentValue: 0.02, range: [0.005, 0.05], step: 0.005, type: 'float', description: 'Fraction of balance risked per trade' });

    // ── Risk config (risk-config.json) ──────────────────────
    reg({ name: 'risk.slDefault',           module: 'riskConfig', currentValue: 0.015, range: [0.005, 0.05],  step: 0.005, type: 'float', description: 'Default stop-loss percent' });
    reg({ name: 'risk.slAtrMult',           module: 'riskConfig', currentValue: 1.5,   range: [0.5, 3.0],    step: 0.25,  type: 'float', description: 'Risk-config SL ATR multiplier' });
    reg({ name: 'risk.tpAtrMult',           module: 'riskConfig', currentValue: 3.0,   range: [1.5, 5.0],    step: 0.5,   type: 'float', description: 'Risk-config TP ATR multiplier' });
    reg({ name: 'risk.trailingActivation',  module: 'riskConfig', currentValue: 0.01,  range: [0.005, 0.03], step: 0.005, type: 'float', description: 'Trailing stop activation %' });
    reg({ name: 'risk.trailingPercent',     module: 'riskConfig', currentValue: 0.01,  range: [0.005, 0.03], step: 0.005, type: 'float', description: 'Trailing stop distance %' });
    reg({ name: 'risk.kellyFraction',       module: 'riskConfig', currentValue: 0.25,  range: [0.05, 0.5],   step: 0.05,  type: 'float', description: 'Kelly criterion fraction' });
    reg({ name: 'risk.maxDailyLoss',        module: 'riskConfig', currentValue: 0.10,  range: [0.03, 0.20],  step: 0.01,  type: 'float', description: 'Max daily loss limit' });
    reg({ name: 'risk.volMin',              module: 'riskConfig', currentValue: 0.002, range: [0.001, 0.005], step: 0.001, type: 'float', description: 'Volatility filter minimum' });
    reg({ name: 'risk.volMax',              module: 'riskConfig', currentValue: 0.02,  range: [0.01, 0.05],  step: 0.005, type: 'float', description: 'Volatility filter maximum' });
    reg({ name: 'risk.cooldownLoss',        module: 'riskConfig', currentValue: 10,    range: [5, 30],       step: 5,     type: 'integer', description: 'Post-loss cooldown (minutes)' });

    // ── Bot config (current.json) ───────────────────────────
    reg({ name: 'bot.rsiLongMin',           module: 'botConfig', currentValue: 30,   range: [20, 45],   step: 5,    type: 'integer', description: 'RSI long entry minimum' });
    reg({ name: 'bot.rsiLongMax',           module: 'botConfig', currentValue: 55,   range: [45, 70],   step: 5,    type: 'integer', description: 'RSI long entry maximum' });
    reg({ name: 'bot.rsiShortMin',          module: 'botConfig', currentValue: 85,   range: [70, 90],   step: 5,    type: 'integer', description: 'RSI short entry minimum' });
    reg({ name: 'bot.volumeMinRatio',       module: 'botConfig', currentValue: 1.2,  range: [0.8, 2.0], step: 0.1,  type: 'float',   description: 'Min volume ratio for entry' });
    reg({ name: 'bot.trendMinStrength',     module: 'botConfig', currentValue: 50,   range: [20, 80],   step: 10,   type: 'integer', description: 'Min trend strength for entry' });
    reg({ name: 'bot.maxPositionSize',      module: 'botConfig', currentValue: 0.08, range: [0.02, 0.15], step: 0.01, type: 'float', description: 'Max position size fraction' });
    reg({ name: 'bot.maxLeverage',          module: 'botConfig', currentValue: 20,   range: [5, 50],    step: 5,    type: 'integer', description: 'Max leverage' });
  }
}

// ────────────────────────────────────────────────────────────────
// 2. Sensitivity Analyzer — OAT screening
// ────────────────────────────────────────────────────────────────

/** Result of sweeping one parameter while holding all others at default. */
export interface SensitivityResult {
  parameter: string;
  values: number[];
  sharpeRatios: number[];
  maxDrawdowns: number[];
  winRates: number[];
  /** Normalized gradient magnitude: max |ΔSharpe/Δparam| across the sweep. */
  sensitivity: number;
  /** True when Sharpe doesn't change >20 % across the range (robust). */
  isRobust: boolean;
}

/**
 * One-at-a-time (OAT) sensitivity analyzer.
 *
 * OAT is a screening technique (Saltelli 2008): it sweeps each
 * parameter individually while holding all others at their default
 * values, measuring the gradient of the objective.  Parameters with
 * high sensitivity deserve tighter cross-validation; robust ones
 * can be left at defaults with less concern.
 *
 * Limitation: OAT ignores interaction effects.  For high-sensitivity
 * parameters, follow up with walk-forward or CPCV validation.
 */
export class SensitivityAnalyzer {
  constructor(
    private registry: ParameterRegistry,
    private backtestRunner: (params: Record<string, number>) => Promise<BacktestMetrics>,
  ) {}

  /**
   * Sweep a single parameter over its registered range.
   * @param paramName  Dotted parameter name, e.g. "knn.k"
   * @param steps      Number of grid points (default: inferred from range/step)
   */
  async analyzeParameter(paramName: string, steps?: number): Promise<SensitivityResult> {
    const param = this.registry.get(paramName);
    if (!param) throw new Error(`Unknown parameter: ${paramName}`);

    const baseParams = this.registry.defaults();
    const values = this.buildGrid(param, steps);

    const sharpeRatios: number[] = [];
    const maxDrawdowns: number[] = [];
    const winRates: number[] = [];

    for (const val of values) {
      const trialParams = { ...baseParams, [paramName]: val };
      const metrics = await this.backtestRunner(trialParams);
      sharpeRatios.push(metrics.sharpeRatio);
      maxDrawdowns.push(metrics.maxDrawdown);
      winRates.push(metrics.winRate);
    }

    const sensitivity = this.computeSensitivity(values, sharpeRatios, param.range);
    const isRobust = this.checkRobustness(sharpeRatios);

    return { parameter: paramName, values, sharpeRatios, maxDrawdowns, winRates, sensitivity, isRobust };
  }

  /**
   * Run OAT for every registered parameter, ranked by sensitivity (desc).
   */
  async analyzeAll(steps?: number): Promise<SensitivityResult[]> {
    const results: SensitivityResult[] = [];
    for (const param of this.registry.all()) {
      results.push(await this.analyzeParameter(param.name, steps));
    }
    results.sort((a, b) => b.sensitivity - a.sensitivity);
    return results;
  }

  /** Return the top-N most sensitive parameters. */
  getMostSensitive(results: SensitivityResult[], topN: number): SensitivityResult[] {
    return results.slice(0, topN);
  }

  // ── helpers ─────────────────────────────────────────────────

  /** Build an evenly-spaced grid respecting type (integer snapping). */
  private buildGrid(p: TunableParameter, requestedSteps?: number): number[] {
    const nSteps = requestedSteps ?? Math.max(2, Math.round((p.range[1] - p.range[0]) / p.step) + 1);
    const delta = (p.range[1] - p.range[0]) / (nSteps - 1);
    const grid: number[] = [];
    for (let i = 0; i < nSteps; i++) {
      let v = p.range[0] + i * delta;
      if (p.type === 'integer') v = Math.round(v);
      grid.push(parseFloat(v.toFixed(6)));
    }
    return grid;
  }

  /**
   * Normalized sensitivity: max |ΔSharpe / Δnorm_param| where the
   * parameter axis is rescaled to [0,1] so magnitudes are comparable
   * across different parameters.
   */
  private computeSensitivity(values: number[], sharpes: number[], range: [number, number]): number {
    if (values.length < 2) return 0;
    const span = range[1] - range[0] || 1;
    let maxGrad = 0;
    for (let i = 1; i < values.length; i++) {
      const dp = (values[i]! - values[i - 1]!) / span; // normalized param delta
      const ds = sharpes[i]! - sharpes[i - 1]!;
      const grad = dp !== 0 ? Math.abs(ds / dp) : 0;
      if (grad > maxGrad) maxGrad = grad;
    }
    return maxGrad;
  }

  /**
   * A parameter is "robust" if its Sharpe ratio doesn't deviate
   * more than 20 % from the median across the sweep.
   * (López de Prado recommends flagging parameters where small
   * perturbations cause large metric changes.)
   */
  private checkRobustness(sharpes: number[]): boolean {
    if (sharpes.length < 2) return true;
    const sorted = [...sharpes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    if (median === 0) return sharpes.every(s => s === 0);
    return sharpes.every(s => Math.abs(s - median) / Math.abs(median) <= 0.2);
  }
}

// ────────────────────────────────────────────────────────────────
// 3. Walk-Forward Validator
// ────────────────────────────────────────────────────────────────

/** Configuration for rolling walk-forward optimization. */
export interface WalkForwardConfig {
  /** Training window length in bars (e.g. 8640 = 30 days of 5m bars). */
  trainWindowBars: number;
  /** Test window length in bars (e.g. 2880 = 10 days). */
  testWindowBars: number;
  /** Step size in bars for rolling the window forward. */
  stepBars: number;
  /** Which metric to maximize during in-sample optimization. */
  optimizeMetric: 'sharpe' | 'sortino' | 'calmar';
}

/** Result of a single walk-forward fold. */
export interface WalkForwardFold {
  trainPeriod: [number, number]; // [startIndex, endIndex)
  testPeriod: [number, number];
  optimizedParams: Record<string, number>;
  inSampleMetrics: BacktestMetrics;
  outOfSampleMetrics: BacktestMetrics;
}

/** Aggregated walk-forward result. */
export interface WalkForwardResult {
  folds: WalkForwardFold[];
  /** OOS efficiency: avg(OOS metric) / avg(IS metric).  >0.5 = robust. */
  efficiency: number;
  /** True when efficiency > 0.5 (López de Prado heuristic). */
  isRobust: boolean;
}

/**
 * Rolling walk-forward optimizer.
 *
 * For each fold the validator:
 *   1. Slices data into [train] | [test] windows.
 *   2. Runs a grid search over the supplied parameter space on [train].
 *   3. Evaluates the IS-optimal parameters on [test].
 *
 * The ratio avg(OOS) / avg(IS) (efficiency) measures overfitting.
 * An efficiency > 0.5 suggests the strategy generalises rather than
 * being overfit to a particular regime (López de Prado 2018, Ch. 8).
 */
export class WalkForwardValidator {
  constructor(private config: WalkForwardConfig) {}

  async validate(
    data: OHLCV[],
    parameterSpace: TunableParameter[],
    backtestRunner: (params: Record<string, number>, data: OHLCV[]) => Promise<BacktestMetrics>,
  ): Promise<WalkForwardResult> {
    const { trainWindowBars, testWindowBars, stepBars, optimizeMetric } = this.config;
    const folds: WalkForwardFold[] = [];
    let cursor = 0;

    while (cursor + trainWindowBars + testWindowBars <= data.length) {
      const trainSlice = data.slice(cursor, cursor + trainWindowBars);
      const testSlice = data.slice(cursor + trainWindowBars, cursor + trainWindowBars + testWindowBars);

      // Grid search over parameter space on the training window
      const { bestParams, bestMetrics } = await this.gridSearch(
        parameterSpace, trainSlice, backtestRunner, optimizeMetric,
      );

      // Evaluate IS-optimal params on the test window
      const oosMetrics = await backtestRunner(bestParams, testSlice);

      folds.push({
        trainPeriod: [cursor, cursor + trainWindowBars],
        testPeriod: [cursor + trainWindowBars, cursor + trainWindowBars + testWindowBars],
        optimizedParams: bestParams,
        inSampleMetrics: bestMetrics,
        outOfSampleMetrics: oosMetrics,
      });

      cursor += stepBars;
    }

    const efficiency = this.computeEfficiency(folds, optimizeMetric);

    return { folds, efficiency, isRobust: efficiency > 0.5 };
  }

  // ── helpers ─────────────────────────────────────────────────

  /**
   * Simple grid search over the Cartesian product of parameter grids.
   *
   * For large spaces this is prohibitive; callers should pre-filter to
   * the most sensitive parameters (via SensitivityAnalyzer.getMostSensitive)
   * and keep the grid coarse (3-5 points per dimension).
   */
  private async gridSearch(
    space: TunableParameter[],
    trainData: OHLCV[],
    runner: (params: Record<string, number>, data: OHLCV[]) => Promise<BacktestMetrics>,
    metric: 'sharpe' | 'sortino' | 'calmar',
  ): Promise<{ bestParams: Record<string, number>; bestMetrics: BacktestMetrics }> {
    const grids = space.map(p => this.buildCoarseGrid(p));
    const combos = cartesianProduct(grids);

    let bestScore = -Infinity;
    let bestParams: Record<string, number> = {};
    let bestMetrics: BacktestMetrics = emptyMetrics();

    for (const combo of combos) {
      const params: Record<string, number> = {};
      space.forEach((p, i) => { params[p.name]! = combo[i]!; });

      const m = await runner(params, trainData);
      const score = metricValue(m, metric);

      if (score > bestScore) {
        bestScore = score;
        bestParams = { ...params };
        bestMetrics = m;
      }
    }

    return { bestParams, bestMetrics };
  }

  /** 5-point coarse grid for walk-forward (keeps combinatorial cost low). */
  private buildCoarseGrid(p: TunableParameter, points = 5): number[] {
    const n = Math.max(2, points);
    const delta = (p.range[1] - p.range[0]) / (n - 1);
    const grid: number[] = [];
    for (let i = 0; i < n; i++) {
      let v = p.range[0] + i * delta;
      if (p.type === 'integer') v = Math.round(v);
      grid.push(parseFloat(v.toFixed(6)));
    }
    return grid;
  }

  /** Efficiency = avg(OOS metric) / avg(IS metric). */
  private computeEfficiency(
    folds: WalkForwardFold[],
    metric: 'sharpe' | 'sortino' | 'calmar',
  ): number {
    if (folds.length === 0) return 0;
    const avgIS = folds.reduce((s, f) => s + metricValue(f.inSampleMetrics, metric), 0) / folds.length;
    const avgOOS = folds.reduce((s, f) => s + metricValue(f.outOfSampleMetrics, metric), 0) / folds.length;
    if (avgIS === 0) return 0;
    return avgOOS / avgIS;
  }
}

// ────────────────────────────────────────────────────────────────
// Utility functions
// ────────────────────────────────────────────────────────────────

function metricValue(m: BacktestMetrics, key: 'sharpe' | 'sortino' | 'calmar'): number {
  switch (key) {
    case 'sharpe':  return m.sharpeRatio;
    case 'sortino': return m.sortinoRatio;
    case 'calmar':  return m.calmarRatio;
  }
}

function emptyMetrics(): BacktestMetrics {
  return { sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, maxDrawdown: 0, winRate: 0, totalReturn: 0, totalTrades: 0 };
}

/** Cartesian product of arrays, e.g. [[1,2],[3,4]] → [[1,3],[1,4],[2,3],[2,4]]. */
function cartesianProduct(arrays: number[][]): number[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<number[][]>(
    (acc, cur) => acc.flatMap(prev => cur.map(v => [...prev, v])),
    [[]],
  );
}
