/**
 * Tail Risk Model — JRFM 2025
 *
 * Crypto returns have fat tails and asymmetric correlation.
 * This module replaces Normal distribution assumptions with:
 * 1. Cornish-Fisher VaR (adjusts for skewness and kurtosis)
 * 2. Expected Shortfall (CVaR)
 * 3. Maximum Drawdown estimation
 */

import { OHLCV } from '../events/types';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface TailRiskConfig {
  confidenceLevel: number; // default: 0.95
  lookback: number; // default: 252
  stressMultiplier: number; // default: 1.5
}

export interface TailRiskResult {
  /** Cornish-Fisher Value at Risk (adjusted for skew/kurt) */
  cfVaR: number;
  /** Expected Shortfall (average loss beyond VaR) */
  expectedShortfall: number;
  /** Normal VaR for comparison */
  normalVaR: number;
  /** Tail ratio: cfVaR / normalVaR (>1 means fatter tails) */
  tailRatio: number;
  /** Maximum drawdown risk estimate */
  maxDrawdownEstimate: number;
  /** Skewness */
  skewness: number;
  /** Excess kurtosis */
  excessKurtosis: number;
  /** Stressed VaR (extreme scenario) */
  stressedVaR: number;
}

// ────────────────────────────────────────────────────────────────
// Tail Risk Model
// ────────────────────────────────────────────────────────────────

export class TailRiskModel {
  private config: TailRiskConfig;
  private returns: number[] = [];
  private lastResult: TailRiskResult | null = null;

  constructor(config?: Partial<TailRiskConfig>) {
    this.config = {
      confidenceLevel: config?.confidenceLevel ?? 0.95,
      lookback: config?.lookback ?? 252,
      stressMultiplier: config?.stressMultiplier ?? 1.5,
    };
  }

  /**
   * Update with new OHLCV candle.
   * Computes the return from the previous close and recalculates risk.
   */
  update(candle: OHLCV, prevClose: number): TailRiskResult {
    if (prevClose <= 0) {
      return this.emptyResult();
    }

    const ret = (candle.close - prevClose) / prevClose;
    this.returns.push(ret);

    // Trim to lookback window
    if (this.returns.length > this.config.lookback * 2) {
      this.returns = this.returns.slice(-this.config.lookback * 2);
    }

    return this.computeRisk();
  }

  /**
   * Batch update with historical data.
   * Computes returns from consecutive closes and recalculates risk.
   */
  batchUpdate(ohlcv: OHLCV[]): TailRiskResult {
    if (ohlcv.length < 2) {
      return this.emptyResult();
    }

    // Compute returns from consecutive candles
    for (let i = 1; i < ohlcv.length; i++) {
      if (ohlcv[i - 1].close > 0) {
        const ret = (ohlcv[i].close - ohlcv[i - 1].close) / ohlcv[i - 1].close;
        this.returns.push(ret);
      }
    }

    // Trim to lookback
    if (this.returns.length > this.config.lookback * 2) {
      this.returns = this.returns.slice(-this.config.lookback * 2);
    }

    return this.computeRisk();
  }

  getCurrentRisk(): TailRiskResult {
    if (this.lastResult) return this.lastResult;
    return this.emptyResult();
  }

  // ────────────────────────────────────────────────────────────
  // Private methods
  // ────────────────────────────────────────────────────────────

  private computeRisk(): TailRiskResult {
    const n = Math.min(this.returns.length, this.config.lookback);
    const recent = this.returns.slice(-n);

    if (n < 5) {
      this.lastResult = this.emptyResult();
      return this.lastResult;
    }

    // ── Basic statistics ──────────────────────────────────────
    const mean = recent.reduce((s, r) => s + r, 0) / n;
    const variance =
      recent.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);

    if (std === 0) {
      this.lastResult = this.emptyResult();
      return this.lastResult;
    }

    // Skewness (Fisher-corrected)
    const skewness =
      (n / ((n - 1) * (n - 2))) *
      recent.reduce((s, r) => s + ((r - mean) / std) ** 3, 0);

    // BUG 4 FIX: Excess kurtosis with Fisher correction (matching skewness).
    // Guard: need n >= 4 for the correction to be defined.
    let excessKurtosis: number;
    if (n < 4) {
      // Not enough data for Fisher-corrected kurtosis; fall back to biased
      const rawKurt =
        recent.reduce((s, r) => s + ((r - mean) / std) ** 4, 0) / n;
      excessKurtosis = rawKurt - 3;
    } else {
      const sumZ4 = recent.reduce((s, r) => s + ((r - mean) / std) ** 4, 0);
      // Fisher correction formula for excess kurtosis:
      //   G2 = ((n+1)*n / ((n-1)*(n-2)*(n-3))) * (sumZ4/n) - 3*(n-1)^2 / ((n-2)*(n-3))
      excessKurtosis =
        ((n + 1) * n / ((n - 1) * (n - 2) * (n - 3))) * (sumZ4 / n) -
        (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
    }

    // ── Normal VaR ────────────────────────────────────────────
    // BUG 1 FIX: Use the LEFT-tail z-value for VaR.
    // For confidence=0.95, we need the 5th percentile: z(0.05) = -1.645
    const zLeft = this.normalInverseCDF(1 - this.config.confidenceLevel);
    const normalVaR = -(mean + zLeft * std);
    // Ensure VaR is non-negative (it represents a loss)
    const clampedNormalVaR = Math.max(0, normalVaR);

    // ── Cornish-Fisher VaR ────────────────────────────────────
    // BUG 1 FIX: Apply CF expansion to the left-tail z-value
    const cfZLeft = this.cornishFisherQuantile(zLeft, skewness, excessKurtosis);
    const cfVaR = -(mean + cfZLeft * std);
    const clampedCfVaR = Math.max(0, cfVaR);

    // ── Tail ratio ────────────────────────────────────────────
    const tailRatio =
      clampedNormalVaR > 0 ? clampedCfVaR / clampedNormalVaR : 1;

    // ── Expected Shortfall (CVaR) ─────────────────────────────
    const expectedShortfall = this.computeExpectedShortfall(
      recent,
      this.config.confidenceLevel,
    );

    // ── Maximum Drawdown estimate ─────────────────────────────
    const maxDrawdownEstimate = this.estimateMaxDrawdown(recent);

    // ── Stressed VaR ──────────────────────────────────────────
    const stressedVaR = clampedCfVaR * this.config.stressMultiplier;

    this.lastResult = {
      cfVaR: clampedCfVaR,
      expectedShortfall,
      normalVaR: clampedNormalVaR,
      tailRatio,
      maxDrawdownEstimate,
      skewness,
      excessKurtosis,
      stressedVaR,
    };

    return this.lastResult;
  }

  /**
   * Cornish-Fisher expansion for quantile adjustment.
   * Adjusts the Normal quantile z for skewness S and excess kurtosis K:
   *
   *   z_cf = z + (z^2 - 1)/6 * S + (z^3 - 3z)/24 * K - (2z^3 - 5z)/36 * S^2
   *
   * Reference: Cornish & Fisher (1938), Bailey & López de Prado (2014)
   */
  private cornishFisherQuantile(
    z: number,
    skew: number,
    exKurt: number,
  ): number {
    const z2 = z * z;
    const z3 = z2 * z;

    const cfZ =
      z +
      ((z2 - 1) / 6) * skew +
      ((z3 - 3 * z) / 24) * exKurt -
      ((2 * z3 - 5 * z) / 36) * skew * skew;

    return cfZ;
  }

  /**
   * Historical simulation Expected Shortfall (CVaR).
   *
   * ES = average of returns that fall below the VaR threshold.
   * This is the average loss in the worst (1 - confidenceLevel) fraction
   * of the return distribution.
   */
  private computeExpectedShortfall(
    returns: number[],
    confidenceLevel: number,
  ): number {
    if (returns.length === 0) return 0;

    // Sort returns ascending (worst returns first)
    const sorted = [...returns].sort((a, b) => a - b);

    // Number of observations in the tail
    const tailCount = Math.max(
      1,
      Math.floor(sorted.length * (1 - confidenceLevel)),
    );

    // Average of the worst returns
    let tailSum = 0;
    for (let i = 0; i < tailCount; i++) {
      tailSum += sorted[i];
    }

    const avgTailReturn = tailSum / tailCount;

    // ES is positive (represents a loss magnitude)
    return Math.max(0, -avgTailReturn);
  }

  /**
   * Estimate maximum drawdown from return series.
   *
   * Computes the realized maximum drawdown from the return series,
   * which serves as an empirical estimate of future drawdown risk.
   */
  private estimateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;

    // Build equity curve from returns
    let equity = 1;
    let peak = 1;
    let maxDD = 0;

    for (const ret of returns) {
      equity *= 1 + ret;
      if (equity > peak) {
        peak = equity;
      }
      const dd = (peak - equity) / peak;
      if (dd > maxDD) {
        maxDD = dd;
      }
    }

    return maxDD;
  }

  /**
   * Inverse normal CDF (quantile function).
   * Rational approximation from Peter Acklam.
   */
  private normalInverseCDF(p: number): number {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;

    const a1 = -3.969683028665376e1;
    const a2 = 2.209460984245205e2;
    const a3 = -2.759285104469687e2;
    const a4 = 1.383577518672690e2;
    const a5 = -3.066479806614716e1;
    const a6 = 2.506628277459239e0;

    const b1 = -5.447609879822406e1;
    const b2 = 1.615858368580409e2;
    const b3 = -1.556989798598866e2;
    const b4 = 6.680131188771972e1;
    const b5 = -1.328068155288572e1;

    const c1 = -7.784894002430293e-3;
    const c2 = -3.223964580411365e-1;
    const c3 = -2.400758277161838e0;
    const c4 = -2.549732539343734e0;
    const c5 = 4.374664141464968e0;
    const c6 = 2.938163982698783e0;

    const d1 = 7.784695709041462e-3;
    const d2 = 3.224671290700398e-1;
    const d3 = 2.445134137142996e0;
    const d4 = 3.754408661907416e0;

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    let q: number;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (
        (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
      );
    } else if (p <= pHigh) {
      q = p - 0.5;
      const r = q * q;
      return (
        ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
        (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
      );
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return (
        -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
      );
    }
  }

  private emptyResult(): TailRiskResult {
    return {
      cfVaR: 0,
      expectedShortfall: 0,
      normalVaR: 0,
      tailRatio: 1,
      maxDrawdownEstimate: 0,
      skewness: 0,
      excessKurtosis: 0,
      stressedVaR: 0,
    };
  }
}
