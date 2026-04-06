/**
 * Canonical RSI implementation — single source of truth.
 *
 * All RSI calculations in the codebase should delegate here.
 * Two variants:
 *   1. computeRSI      — standard Wilder-style RSI (SMA of gains/losses)
 *   2. computeAdaptiveRSI — adjusts period & thresholds based on volatility/trend
 */

// ──────────────────────────────────────────────────────────
// 1. Standard RSI
// ──────────────────────────────────────────────────────────

/**
 * Compute a single RSI value from an array of closing prices.
 *
 * Uses the classic Wilder formula:
 *   RS  = avgGain / avgLoss   (SMA over `period`)
 *   RSI = 100 - 100 / (1 + RS)
 *
 * @param closes - Array of closing prices (oldest → newest)
 * @param period - Look-back window (default 14)
 * @returns RSI in [0, 100].  Returns 50 when data is insufficient.
 */
export function computeRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const prev = closes[i - 1] ?? 0;
    const curr = closes[i] ?? 0;
    const change = curr - prev;
    if (change > 0) {
      gains += change;
    } else {
      losses -= change; // make positive
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Compute RSI for every position in the array where enough data exists.
 *
 * @param closes - Array of closing prices (oldest → newest)
 * @param period - Look-back window (default 14)
 * @returns Array of RSI values aligned to `closes` (leading entries are 50).
 */
export function computeRSISeries(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(50);
    } else {
      result.push(computeRSI(closes.slice(0, i + 1), period));
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────
// 2. Adaptive RSI
// ──────────────────────────────────────────────────────────

export interface AdaptiveRSIConfig {
  basePeriod?: number;          // default 14
  minPeriod?: number;           // default 5
  maxPeriod?: number;           // default 30
  volatilityLookback?: number;  // default 20
  baseOversold?: number;        // default 30
  baseOverbought?: number;      // default 70
  adaptationFactor?: number;    // default 0.5
}

export interface AdaptiveRSIResult {
  value: number;                                // RSI value
  period: number;                               // period actually used
  overbought: number;                           // dynamic OB threshold
  oversold: number;                             // dynamic OS threshold
  regime: 'trending' | 'ranging';               // detected market state
  confidence: number;                           // signal confidence [0, 1]
}

/**
 * Compute an adaptive RSI that adjusts its period and thresholds
 * based on market volatility and trend strength.
 *
 * - In trending markets:  longer period + wider thresholds (reduce whipsaws)
 * - In ranging markets:   shorter period + tighter thresholds (more responsive)
 *
 * @param closes - Array of closing prices (oldest → newest)
 * @param config - Optional tuning knobs
 * @returns AdaptiveRSIResult with the RSI value, effective period, thresholds,
 *          detected regime, and confidence.
 */
export function computeAdaptiveRSI(
  closes: number[],
  config?: AdaptiveRSIConfig,
): AdaptiveRSIResult {
  const cfg = {
    basePeriod: config?.basePeriod ?? 14,
    minPeriod: config?.minPeriod ?? 5,
    maxPeriod: config?.maxPeriod ?? 30,
    volatilityLookback: config?.volatilityLookback ?? 20,
    baseOversold: config?.baseOversold ?? 30,
    baseOverbought: config?.baseOverbought ?? 70,
    adaptationFactor: config?.adaptationFactor ?? 0.5,
  };

  // Insufficient data — return neutral
  if (closes.length < cfg.maxPeriod + 5) {
    return {
      value: 50,
      period: cfg.basePeriod,
      overbought: cfg.baseOverbought,
      oversold: cfg.baseOversold,
      regime: 'ranging',
      confidence: 0,
    };
  }

  // ── Trend strength (direction consistency × magnitude) ──
  const lookback = Math.min(20, closes.length - 1);
  const changes: number[] = [];
  for (let i = closes.length - lookback; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  const positiveCount = changes.filter(c => c > 0).length;
  const negativeCount = changes.filter(c => c < 0).length;
  const consistency = Math.max(positiveCount, negativeCount) / changes.length;
  const avgAbsChange = changes.reduce((s, c) => s + Math.abs(c), 0) / changes.length;
  const normalizedChange = Math.min(avgAbsChange / (closes[closes.length - 1] * 0.01), 1);
  const trendStrength = consistency * normalizedChange;
  const isTrending = trendStrength > 0.6;
  const regime: 'trending' | 'ranging' = isTrending ? 'trending' : 'ranging';

  // ── Adaptive period ──
  let adaptivePeriod: number;
  if (isTrending) {
    adaptivePeriod = Math.min(
      cfg.maxPeriod,
      Math.max(cfg.basePeriod + 5, Math.floor(cfg.basePeriod * 1.3)),
    );
  } else {
    adaptivePeriod = Math.max(
      cfg.minPeriod,
      Math.min(cfg.basePeriod - 3, Math.floor(cfg.basePeriod * 0.7)),
    );
  }

  // ── Adaptive thresholds ──
  let overbought: number;
  let oversold: number;

  if (isTrending) {
    const trendDir = closes[closes.length - 1] > closes[closes.length - 10] ? 'up' : 'down';
    if (trendDir === 'up') {
      overbought = 75;
      oversold = 40;
    } else {
      overbought = 60;
      oversold = 25;
    }
  } else {
    overbought = 65;
    oversold = 35;
  }

  // ── RSI with adaptive period ──
  const rsi = computeRSI(closes, adaptivePeriod);

  // ── Confidence ──
  let distFromThreshold: number;
  if (rsi > overbought) {
    distFromThreshold = rsi - overbought;
  } else if (rsi < oversold) {
    distFromThreshold = oversold - rsi;
  } else {
    distFromThreshold = 0;
  }
  let confidence = Math.min(distFromThreshold / 10, 1);
  if (isTrending && distFromThreshold < 10) {
    confidence *= 0.7;
  }

  return { value: rsi, period: adaptivePeriod, overbought, oversold, regime, confidence };
}
