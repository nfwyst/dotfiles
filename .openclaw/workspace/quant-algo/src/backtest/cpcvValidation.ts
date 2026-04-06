/**
 * Combinatorially Purged Cross-Validation (CPCV) & Probability of
 * Backtest Overfitting (PBO)
 *
 * References:
 *   - López de Prado, "Advances in Financial Machine Learning" (2018), Ch. 7
 *   - Bailey, Borwein, López de Prado & Zhu, "The Probability of Backtest
 *     Overfitting" (2017), Journal of Computational Finance
 *
 * Why standard k-fold fails for time-series strategies:
 *   1. Training folds can contain samples temporally adjacent to test folds,
 *      leaking serial-correlation information (purging solves this).
 *   2. A single train/test split gives one OOS estimate — not enough to
 *      judge whether good performance is skill or luck (combinatorial
 *      splitting + PBO solves this).
 *
 * This module provides three tools:
 *   - `combinatorialPurgedCV()` — CPCV with embargo-aware purging
 *   - `probabilityOfBacktestOverfitting()` — PBO from CPCV results
 *   - `walkForwardValidation()` — simpler anchored/rolling walk-forward
 *
 * FIX H5: Also integrates the Deflated Sharpe Ratio (DSR) from
 * deflatedSharpe.ts to correct for multiple-testing bias. The new
 * `validateBacktest()` function combines PBO + DSR into a single
 * comprehensive validation result.
 */

import { DeflatedSharpeCalculator, type DSRResult } from './deflatedSharpe';

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

// FIX: Crypto markets trade 365 days/year, not 252 (equity markets)
const CRYPTO_TRADING_DAYS = 365;

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

/** A single time-indexed return or metric observation. */
export interface TimeSeriesObservation {
  /** Unix-ms or bar index — must be monotonically increasing. */
  timestamp: number;
  /** The strategy return (or any scalar metric) for this bar. */
  value: number;
}

/** Configuration for CPCV. */
export interface CPCVConfig {
  /** Number of contiguous groups to split the series into (default 10). */
  nGroups?: number;
  /** Number of test groups per combination (default 2). */
  nTestGroups?: number;
  /** Number of observations purged at each train/test boundary. */
  embargoSize?: number;
  /** Scalar metric computed on an array of values (default: annualized Sharpe). */
  metricFn?: (values: number[]) => number;
}

/** Result of a single CPCV fold. */
export interface CPCVFoldResult {
  /** Indices of the groups used as the test set in this fold. */
  testGroupIndices: number[];
  /** Average in-sample metric (e.g., Sharpe) for the training set. */
  inSampleMetric: number;
  /** Average OOS metric for the test set. */
  outOfSampleMetric: number;
  /** Number of training observations after purging. */
  trainSize: number;
  /** Number of test observations. */
  testSize: number;
}

/** Full output of the CPCV procedure. */
export interface CPCVResult {
  folds: CPCVFoldResult[];
  /** Number of groups the series was split into (N). */
  nGroups: number;
  /** Number of test groups per combination (k). */
  nTestGroups: number;
  /** Embargo window (number of observations purged at each boundary). */
  embargoSize: number;
  /** Total number of combinatorial folds evaluated. */
  totalCombinations: number;
}

/** Output of the PBO calculation. */
export interface PBOResult {
  /** Probability of Backtest Overfitting ∈ [0, 1]. */
  pbo: number;
  /** Distribution of logit(λ) values across all CPCV folds. */
  logitLambdas: number[];
  /** Fraction of folds where the IS-best strategy under-performed OOS median. */
  degradationRate: number;
  /**
   * BUG 16 FIX: Whether the PBO estimate is reliable.
   * False when numStrategies < 3 (single-strategy shortcut is used).
   */
  isPBOReliable: boolean;
  /**
   * BUG 16 FIX: Warning message when PBO is not fully reliable.
   */
  warning?: string;
}

/** Configuration for walk-forward validation. */
export interface WalkForwardConfig {
  /** Minimum number of observations in the initial training window. */
  minTrainSize: number;
  /** Number of observations in each test step. */
  stepSize: number;
  /** If true, training window grows (anchored); if false, it rolls. */
  anchored: boolean;
  /** Embargo gap between train end and test start (number of observations). */
  embargoSize?: number;
}

/** Result of a single walk-forward step. */
export interface WalkForwardStepResult {
  /** Start index of the training window. */
  trainStart: number;
  /** End index (exclusive) of the training window. */
  trainEnd: number;
  /** Start index of the test window. */
  testStart: number;
  /** End index (exclusive) of the test window. */
  testEnd: number;
  /** Metric computed on the training window. */
  inSampleMetric: number;
  /** Metric computed on the test window. */
  outOfSampleMetric: number;
}

export interface WalkForwardResult {
  steps: WalkForwardStepResult[];
  averageISMetric: number;
  averageOOSMetric: number;
  degradation: number; // (avgIS - avgOOS) / |avgIS|
}

// ────────────────────────────────────────────────────────────────
// FIX H5: Combined validation result with PBO + DSR
// ────────────────────────────────────────────────────────────────

/** Configuration for the combined validation procedure. */
export interface BacktestValidationConfig {
  /** CPCV configuration */
  cpcv?: CPCVConfig;
  /** Number of strategy variants / parameter combos tested (for DSR) */
  numTrials?: number;
  /** DSR significance level (default 0.05) */
  dsrSignificanceLevel?: number;
  /** Required DSR to pass (default 0.95) */
  dsrRequiredThreshold?: number;
}

/**
 * FIX H5: Comprehensive validation result combining PBO and DSR.
 *
 * This gives a single summary of whether a backtest is:
 *   1. Likely overfit (PBO)
 *   2. Statistically significant after correcting for multiple testing (DSR)
 *   3. Long enough to be trustworthy (MinBTL)
 */
export interface BacktestValidationResult {
  /** CPCV fold results */
  cpcv: CPCVResult;
  /** PBO result */
  pbo: PBOResult;
  /** Deflated Sharpe Ratio result */
  dsr: DSRResult;

  // ── Convenience summary fields ────────────────────────────
  /** Annualized Sharpe Ratio (same metric used for CPCV) */
  sharpeRatio: number;
  /** Deflated Sharpe Ratio [0, 1] */
  deflatedSharpe: number;
  /** Whether DSR passes the required threshold */
  isStatisticallySignificant: boolean;
  /** Minimum backtest length required for significance */
  minBacktestLength: number;
  /** Whether the actual data length meets the minimum */
  meetsMinLength: boolean;
  /** Overall pass: low PBO AND statistically significant AND meets min length */
  overallPass: boolean;
}

// ────────────────────────────────────────────────────────────────
// Metric helpers
// ────────────────────────────────────────────────────────────────

/**
 * Default metric: annualized Sharpe ratio for crypto markets.
 * FIX: Changed from 252 (equity) to CRYPTO_TRADING_DAYS (365).
 */
function defaultSharpe(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  // FIX: Use CRYPTO_TRADING_DAYS instead of hardcoded 252
  return (mean / std) * Math.sqrt(CRYPTO_TRADING_DAYS);
}

// ────────────────────────────────────────────────────────────────
// Combinatorics utilities
// ────────────────────────────────────────────────────────────────

/** Generate all k-combinations from [0 .. n-1]. */
function combinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const combo: number[] = [];

  function dfs(start: number) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      dfs(i + 1);
      combo.pop();
    }
  }
  dfs(0);
  return result;
}

// ────────────────────────────────────────────────────────────────
// CPCV — Combinatorially Purged Cross-Validation
// ────────────────────────────────────────────────────────────────

/**
 * Combinatorially Purged Cross-Validation (CPCV).
 *
 * Splits the time series into `nGroups` contiguous groups, then
 * evaluates every C(nGroups, nTestGroups) combination where the
 * selected groups form the test set and the rest form the training
 * set — after purging observations within `embargoSize` of the
 * test boundaries.
 */
export function combinatorialPurgedCV(
  data: TimeSeriesObservation[],
  nGroups: number = 10,
  nTestGroups: number = 2,
  embargoSize?: number,
  metricFn: (values: number[]) => number = defaultSharpe,
): CPCVResult {
  if (data.length < nGroups * 2) {
    throw new Error(
      `CPCV requires at least ${nGroups * 2} observations; got ${data.length}.`,
    );
  }
  if (nTestGroups >= nGroups) {
    throw new Error('nTestGroups must be < nGroups.');
  }

  const effectiveEmbargo =
    embargoSize ?? Math.max(1, Math.floor(data.length * 0.01));

  // 1. Split into N contiguous groups of roughly equal size.
  const groupSize = Math.floor(data.length / nGroups);
  const groups: { start: number; end: number }[] = [];
  for (let g = 0; g < nGroups; g++) {
    const start = g * groupSize;
    const end = g === nGroups - 1 ? data.length : (g + 1) * groupSize;
    groups.push({ start, end });
  }

  // 2. Enumerate all C(N, k) test-group combinations.
  const combos = combinations(nGroups, nTestGroups);
  const folds: CPCVFoldResult[] = [];

  for (const testGroupIndices of combos) {
    // Build test index set
    const testSet = new Set<number>();
    for (const gi of testGroupIndices) {
      for (let idx = groups[gi].start; idx < groups[gi].end; idx++) {
        testSet.add(idx);
      }
    }

    // Build purge zone
    const purgeSet = new Set<number>();
    for (const gi of testGroupIndices) {
      const { start, end } = groups[gi];
      for (let p = Math.max(0, start - effectiveEmbargo); p < start; p++) {
        if (!testSet.has(p)) purgeSet.add(p);
      }
      for (let p = end; p < Math.min(data.length, end + effectiveEmbargo); p++) {
        if (!testSet.has(p)) purgeSet.add(p);
      }
    }

    // Build training values (everything not in test or purge)
    const trainValues: number[] = [];
    const testValues: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (testSet.has(i)) {
        testValues.push(data[i].value);
      } else if (!purgeSet.has(i)) {
        trainValues.push(data[i].value);
      }
    }

    folds.push({
      testGroupIndices,
      inSampleMetric: metricFn(trainValues),
      outOfSampleMetric: metricFn(testValues),
      trainSize: trainValues.length,
      testSize: testValues.length,
    });
  }

  return {
    folds,
    nGroups,
    nTestGroups,
    embargoSize: effectiveEmbargo,
    totalCombinations: combos.length,
  };
}

// ────────────────────────────────────────────────────────────────
// PBO — Probability of Backtest Overfitting
// ────────────────────────────────────────────────────────────────

/**
 * Probability of Backtest Overfitting (PBO).
 */
export function probabilityOfBacktestOverfitting(
  variantResults: CPCVResult[],
): PBOResult {
  const S = variantResults.length;

  if (S === 0) {
    throw new Error('At least one CPCVResult is required.');
  }

  const nFolds = variantResults[0].totalCombinations;
  for (const vr of variantResults) {
    if (vr.totalCombinations !== nFolds) {
      throw new Error(
        'All variant CPCVResults must have the same number of folds.',
      );
    }
  }

  // BUG 16 FIX: Single-strategy shortcut is not real PBO.
  // When numStrategies < 3, we label the result as degradationRate (not real PBO)
  // and set isPBOReliable = false with a warning.
  if (S < 3) {
    const folds = variantResults[0].folds;
    let degradedCount = 0;
    const logitLambdas: number[] = [];

    for (const fold of folds) {
      const degraded = fold.outOfSampleMetric < fold.inSampleMetric;
      if (degraded) degradedCount++;
      const ratio = degraded ? 0.25 : 0.75;
      const logitVal = Math.log(ratio / (1 - ratio));
      logitLambdas.push(logitVal);
    }

    const degradationRate = degradedCount / folds.length;
    return {
      // BUG 16 FIX: Use degradationRate as the pbo value but flag it as unreliable
      pbo: degradationRate,
      logitLambdas,
      degradationRate,
      isPBOReliable: false,
      warning:
        `PBO computed with only ${S} strategy variant(s). ` +
        `True PBO requires >= 3 strategies for meaningful rank-based comparison. ` +
        `The reported value is a degradationRate (fraction of folds where OOS < IS), not a proper PBO.`,
    };
  }

  // Multi-strategy case (S >= 3) — real PBO
  const logitLambdas: number[] = [];
  let degradedCount = 0;

  for (let foldIdx = 0; foldIdx < nFolds; foldIdx++) {
    let bestIS = -Infinity;
    let bestStrategyIdx = 0;
    const oosMetrics: number[] = [];

    for (let s = 0; s < S; s++) {
      const fold = variantResults[s].folds[foldIdx];
      oosMetrics.push(fold.outOfSampleMetric);
      if (fold.inSampleMetric > bestIS) {
        bestIS = fold.inSampleMetric;
        bestStrategyIdx = s;
      }
    }

    const bestOOS = oosMetrics[bestStrategyIdx];
    const sortedOOS = [...oosMetrics].sort((a, b) => a - b);
    let rank = sortedOOS.findIndex((v) => v >= bestOOS);
    if (rank === -1) rank = S - 1;
    const lambda = (rank + 1) / S;

    const lambdaClamped = Math.max(0.001, Math.min(0.999, lambda));
    const logitLambda = Math.log(lambdaClamped / (1 - lambdaClamped));
    logitLambdas.push(logitLambda);

    if (lambda <= 0.5) {
      degradedCount++;
    }
  }

  const pbo = degradedCount / nFolds;
  return {
    pbo,
    logitLambdas,
    degradationRate: pbo,
    isPBOReliable: true,
  };
}

// ────────────────────────────────────────────────────────────────
// Walk-Forward Validation (simpler alternative)
// ────────────────────────────────────────────────────────────────

/**
 * Anchored or rolling walk-forward validation.
 */
export function walkForwardValidation(
  data: TimeSeriesObservation[],
  config: WalkForwardConfig,
  metricFn: (values: number[]) => number = defaultSharpe,
): WalkForwardResult {
  const { minTrainSize, stepSize, anchored, embargoSize = 0 } = config;

  if (data.length < minTrainSize + embargoSize + stepSize) {
    throw new Error(
      `Not enough data for walk-forward: need at least ${
        minTrainSize + embargoSize + stepSize
      } observations, got ${data.length}.`,
    );
  }

  const steps: WalkForwardStepResult[] = [];
  let trainStart = 0;
  let trainEnd = minTrainSize;

  while (trainEnd + embargoSize + stepSize <= data.length) {
    const testStart = trainEnd + embargoSize;
    const testEnd = Math.min(testStart + stepSize, data.length);

    const trainValues = data
      .slice(trainStart, trainEnd)
      .map((d) => d.value);
    const testValues = data
      .slice(testStart, testEnd)
      .map((d) => d.value);

    const inSampleMetric = metricFn(trainValues);
    const outOfSampleMetric = metricFn(testValues);

    steps.push({
      trainStart,
      trainEnd,
      testStart,
      testEnd,
      inSampleMetric,
      outOfSampleMetric,
    });

    if (anchored) {
      trainEnd += stepSize;
    } else {
      trainStart += stepSize;
      trainEnd += stepSize;
    }
  }

  if (steps.length === 0) {
    return {
      steps: [],
      averageISMetric: 0,
      averageOOSMetric: 0,
      degradation: 0,
    };
  }

  const averageISMetric =
    steps.reduce((s, r) => s + r.inSampleMetric, 0) / steps.length;
  const averageOOSMetric =
    steps.reduce((s, r) => s + r.outOfSampleMetric, 0) / steps.length;
  const degradation =
    averageISMetric !== 0
      ? (averageISMetric - averageOOSMetric) / Math.abs(averageISMetric)
      : 0;

  return {
    steps,
    averageISMetric,
    averageOOSMetric,
    degradation,
  };
}

// ────────────────────────────────────────────────────────────────
// FIX H5: Combined Validation — PBO + DSR
// ────────────────────────────────────────────────────────────────

/**
 * Comprehensive backtest validation combining CPCV, PBO, and
 * Deflated Sharpe Ratio (DSR).
 *
 * This is the recommended entry point for validating a single
 * strategy's backtest results. It:
 *   1. Runs CPCV to get fold-level IS/OOS metrics
 *   2. Computes PBO to estimate overfitting probability
 *   3. Computes DSR to correct the Sharpe ratio for multiple testing
 *   4. Checks MinBTL (minimum backtest length)
 *
 * @param data          Ordered time-series of strategy returns.
 * @param config        Validation configuration.
 * @returns             Combined validation result.
 */
export function validateBacktest(
  data: TimeSeriesObservation[],
  config?: BacktestValidationConfig,
): BacktestValidationResult {
  const nGroups = config?.cpcv?.nGroups ?? 10;
  const nTestGroups = config?.cpcv?.nTestGroups ?? 2;
  const embargoSize = config?.cpcv?.embargoSize;
  const metricFn = config?.cpcv?.metricFn ?? defaultSharpe;
  const numTrials = config?.numTrials ?? 1;

  // 1. Run CPCV
  const cpcvResult = combinatorialPurgedCV(
    data,
    nGroups,
    nTestGroups,
    embargoSize,
    metricFn,
  );

  // 2. Compute PBO
  const pboResult = probabilityOfBacktestOverfitting([cpcvResult]);

  // 3. Extract all returns for DSR calculation
  const allReturns = data.map((d) => d.value);

  // 4. Compute DSR
  const dsrCalc = new DeflatedSharpeCalculator({
    significanceLevel: config?.dsrSignificanceLevel,
    requiredDSR: config?.dsrRequiredThreshold,
  });
  const dsrResult = dsrCalc.calculate(allReturns, numTrials);

  // 5. Compute overall Sharpe for convenience (annualized)
  const sharpeRatio = metricFn(allReturns);

  // 6. Determine overall pass:
  //    - PBO < 0.5 (less than 50% chance of overfitting)
  //    - DSR is statistically significant
  //    - Meets minimum backtest length
  const overallPass =
    pboResult.pbo < 0.5 &&
    dsrResult.isSignificant &&
    dsrResult.meetsMinLength;

  return {
    cpcv: cpcvResult,
    pbo: pboResult,
    dsr: dsrResult,

    sharpeRatio,
    deflatedSharpe: dsrResult.deflatedSharpe,
    isStatisticallySignificant: dsrResult.isSignificant,
    minBacktestLength: dsrResult.minBacktestLength,
    meetsMinLength: dsrResult.meetsMinLength,
    overallPass,
  };
}
