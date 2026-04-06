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
 */

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
// Metric helpers
// ────────────────────────────────────────────────────────────────

/**
 * Default metric: annualized Sharpe ratio (assuming daily returns,
 * 252 trading days).  Callers can supply their own `metricFn`.
 */
function defaultSharpe(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(252);
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
 *
 * @param data        Ordered time-series observations.
 * @param nGroups     N — number of contiguous groups (default 10).
 * @param nTestGroups k — groups held out per fold (default 2).
 * @param embargoSize Number of observations purged at each
 *                    train/test boundary (default 1% of data length,
 *                    minimum 1).
 * @param metricFn    Scalar metric computed on an array of values
 *                    (default: annualized Sharpe).
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

    // Build purge zone: indices within `effectiveEmbargo` of each
    // test-group boundary that fall OUTSIDE the test set.
    const purgeSet = new Set<number>();
    for (const gi of testGroupIndices) {
      const { start, end } = groups[gi];
      // Before the test group
      for (let p = Math.max(0, start - effectiveEmbargo); p < start; p++) {
        if (!testSet.has(p)) purgeSet.add(p);
      }
      // After the test group
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
      // else: purged — excluded from both
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
 *
 * For each CPCV fold the procedure checks whether the strategy
 * configuration that looked best in-sample also performs above
 * the OOS median.  PBO is the fraction of folds where it does NOT.
 *
 * When multiple strategy variants are evaluated, pass their CPCV
 * results as columns of a matrix (one CPCVResult per variant).
 * For the single-strategy case this simplifies to checking
 * IS vs. OOS degradation across folds.
 *
 * Implements the logit(λ) distribution from Bailey & López de Prado:
 *   λ_c = rank_OOS(s*_IS) / S
 *   where s*_IS is the IS-best strategy in fold c, S is strategy count.
 *   PBO = Pr[ logit(λ) <= 0 ]
 *
 * @param variantResults Array of CPCVResult — one per strategy variant.
 *                       All must share the same fold structure (same
 *                       nGroups / nTestGroups / data).
 */
export function probabilityOfBacktestOverfitting(
  variantResults: CPCVResult[],
): PBOResult {
  const S = variantResults.length; // number of strategy variants

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

  // Single-strategy shortcut:
  // If there is only one strategy, we compute a simpler degradation-based
  // PBO: fraction of folds where OOS metric < IS metric (i.e., degraded).
  if (S === 1) {
    const folds = variantResults[0].folds;
    let degradedCount = 0;
    const logitLambdas: number[] = [];

    for (const fold of folds) {
      const degraded = fold.outOfSampleMetric < fold.inSampleMetric;
      if (degraded) degradedCount++;
      // logit: negative when degraded
      const ratio = degraded ? 0.25 : 0.75; // simplified rank proxy
      const logitVal = Math.log(ratio / (1 - ratio));
      logitLambdas.push(logitVal);
    }

    const pbo = degradedCount / folds.length;
    return { pbo, logitLambdas, degradationRate: pbo };
  }

  // Multi-strategy case — full Bailey & López de Prado procedure
  const logitLambdas: number[] = [];
  let degradedCount = 0;

  for (let foldIdx = 0; foldIdx < nFolds; foldIdx++) {
    // Find IS-best strategy for this fold
    let bestIS = -Infinity;
    let bestStrategyIdx = 0;
    const isMetrics: number[] = [];
    const oosMetrics: number[] = [];

    for (let s = 0; s < S; s++) {
      const fold = variantResults[s].folds[foldIdx];
      isMetrics.push(fold.inSampleMetric);
      oosMetrics.push(fold.outOfSampleMetric);
      if (fold.inSampleMetric > bestIS) {
        bestIS = fold.inSampleMetric;
        bestStrategyIdx = s;
      }
    }

    // Rank the IS-best strategy's OOS performance among all OOS values
    const bestOOS = oosMetrics[bestStrategyIdx];
    const sortedOOS = [...oosMetrics].sort((a, b) => a - b);
    let rank = sortedOOS.findIndex((v) => v >= bestOOS);
    if (rank === -1) rank = S - 1;
    // 1-based rank normalised to [0, 1]
    const lambda = (rank + 1) / S;

    // Clamp lambda away from 0 and 1 to keep logit finite
    const lambdaClamped = Math.max(0.001, Math.min(0.999, lambda));
    const logitLambda = Math.log(lambdaClamped / (1 - lambdaClamped));
    logitLambdas.push(logitLambda);

    // Below-median OOS? (lambda <= 0.5 means IS-best is in bottom half OOS)
    if (lambda <= 0.5) {
      degradedCount++;
    }
  }

  const pbo = degradedCount / nFolds;
  return { pbo, logitLambdas, degradationRate: pbo };
}

// ────────────────────────────────────────────────────────────────
// Walk-Forward Validation (simpler alternative)
// ────────────────────────────────────────────────────────────────

/**
 * Anchored or rolling walk-forward validation.
 *
 * Slides a train/test window through the time series, computing
 * the metric on each pair.  An optional embargo gap separates
 * train and test windows to prevent leakage.
 *
 * @param data   Ordered time-series observations.
 * @param config Walk-forward configuration.
 * @param metricFn Scalar metric (default: annualized Sharpe).
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

    // Advance window
    if (anchored) {
      // Anchored: training window grows, start stays fixed
      trainEnd += stepSize;
    } else {
      // Rolling: both endpoints advance
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
