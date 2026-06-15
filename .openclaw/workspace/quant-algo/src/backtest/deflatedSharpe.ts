/**
 * Deflated Sharpe Ratio (DSR) — Bailey & López de Prado
 * Corrects Sharpe Ratio for multiple testing bias.
 *
 * DSR = Prob[SR* > 0 | {SR_n}]
 * Where SR* is the "true" Sharpe, adjusted for trials, skewness, kurtosis.
 *
 * Also implements MinBTL (Minimum Backtest Length):
 * MinBTL = 1 + (1 - skew*SR + (kurt-1)/4 * SR^2) * (z_α / SR)^2
 */

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface DSRConfig {
  /** Significance level for DSR test */
  significanceLevel: number; // default: 0.05
  /** Required DSR to pass */
  requiredDSR: number; // default: 0.95
  /** Annualization factor for crypto (sqrt of periods per year) */
  annualizationFactor: number; // default: sqrt(365 * 288) for 5-min bars
}

export interface DSRResult {
  /** Original Sharpe Ratio */
  sharpeRatio: number;
  /** Deflated Sharpe Ratio [0, 1] */
  deflatedSharpe: number;
  /** Whether DSR passes threshold */
  isSignificant: boolean;
  /** Number of trials */
  numTrials: number;
  /** Expected maximum SR under null (Euler-Mascheroni correction) */
  expectedMaxSR: number;
  /** Skewness of returns */
  skewness: number;
  /** Excess kurtosis of returns */
  kurtosis: number;
  /** Minimum backtest length required */
  minBacktestLength: number;
  /** Actual backtest length */
  actualLength: number;
  /** Whether backtest is long enough */
  meetsMinLength: boolean;
}

// ────────────────────────────────────────────────────────────────
// Deflated Sharpe Calculator
// ────────────────────────────────────────────────────────────────

export class DeflatedSharpeCalculator {
  private config: DSRConfig;

  constructor(config?: Partial<DSRConfig>) {
    this.config = {
      significanceLevel: config?.significanceLevel ?? 0.05,
      requiredDSR: config?.requiredDSR ?? 0.95,
      // 5-min bars: 288 bars/day * 365 days/year
      annualizationFactor:
        config?.annualizationFactor ?? Math.sqrt(365 * 288),
    };
  }

  /**
   * Calculate DSR for a set of strategy returns.
   * @param returns - Array of period returns
   * @param numTrials - Number of strategy variants tested (parameter combos)
   */
  calculate(returns: number[], numTrials: number): DSRResult {
    const T = returns.length;

    if (T < 2) {
      return {
        sharpeRatio: 0,
        deflatedSharpe: 0,
        isSignificant: false,
        numTrials,
        expectedMaxSR: 0,
        skewness: 0,
        kurtosis: 0,
        minBacktestLength: Infinity,
        actualLength: T,
        meetsMinLength: false,
      };
    }

    // ── Basic statistics ──────────────────────────────────────
    const mean = returns.reduce((s, r) => s + r, 0) / T;
    const variance =
      returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (T - 1);
    const std = Math.sqrt(variance);

    // Sharpe ratio (non-annualized, per-period)
    const sr = std === 0 ? 0 : mean / std;

    // Skewness (sample, Fisher-adjusted)
    const skewness =
      std === 0
        ? 0
        : (T / ((T - 1) * (T - 2))) *
          returns.reduce((s, r) => s + ((r - mean) / std) ** 3, 0);

    // Excess kurtosis (sample)
    const rawKurt =
      std === 0
        ? 0
        : returns.reduce((s, r) => s + ((r - mean) / std) ** 4, 0) / T;
    // Subtract 3 for Normal baseline to get excess kurtosis
    const excessKurtosis = rawKurt - 3;

    // ── Expected maximum SR under null ────────────────────────
    const expectedMaxSR = this.expectedMaxSharpe(numTrials, T);

    // ── SR standard error (non-Normal adjustment) ─────────────
    const srSE = this.sharpeStdError(sr, skewness, excessKurtosis, T);

    // ── DSR: probability that observed SR exceeds expected max ─
    // DSR = Φ( (SR - E[max(SR)]) / SE(SR) )
    let deflatedSharpe: number;
    if (srSE === 0) {
      deflatedSharpe = sr > expectedMaxSR ? 1 : 0;
    } else {
      const zStat = (sr - expectedMaxSR) / srSE;
      deflatedSharpe = this.normalCDF(zStat);
    }

    // ── Minimum Backtest Length ────────────────────────────────
    // MinBTL = 1 + (1 - skew*SR + (gamma4-1)/4 * SR^2) * (z_α / SR)^2
    // where gamma4 = rawKurt = excessKurtosis + 3, so (gamma4-1)/4 = (excessKurtosis+2)/4
    const zAlpha = this.normalInverseCDF(1 - this.config.significanceLevel);
    let minBacktestLength: number;
    if (Math.abs(sr) < 1e-10) {
      minBacktestLength = Infinity;
    } else {
      // BUG 2 FIX: Changed (excessKurtosis - 1) / 4 to (excessKurtosis + 2) / 4
      // Paper uses (gamma4 - 1)/4 where gamma4 is raw kurtosis.
      // Since excessKurtosis = rawKurt - 3, we need (excessKurtosis + 3 - 1)/4 = (excessKurtosis + 2)/4
      const nonNormalityAdj =
        1 - skewness * sr + ((excessKurtosis + 2) / 4) * sr ** 2;
      // Clamp to avoid pathological negative or near-zero values
      const clampedAdj = Math.max(0.1, nonNormalityAdj);
      minBacktestLength = 1 + clampedAdj * (zAlpha / sr) ** 2;
    }

    const isSignificant = deflatedSharpe >= this.config.requiredDSR;
    const meetsMinLength =
      minBacktestLength === Infinity ? false : T >= minBacktestLength;

    return {
      sharpeRatio: sr,
      deflatedSharpe,
      isSignificant,
      numTrials,
      expectedMaxSR,
      skewness,
      kurtosis: excessKurtosis,
      minBacktestLength,
      actualLength: T,
      meetsMinLength,
    };
  }

  // ── Standard normal CDF ────────────────────────────────────
  // Abramowitz & Stegun approximation (formula 26.2.17)
  // This approximation is for erf(x), so we feed x/sqrt(2) and use exp(-x^2).
  // Max error: 7.5e-8

  private normalCDF(x: number): number {
    if (x < -8) return 0;
    if (x > 8) return 1;

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    // BUG 1 FIX: The A&S formula approximates erf(t), so we must feed |x/sqrt(2)|
    // not raw |x|. And use exp(-t^2) not exp(-t^2/2).
    const absX = Math.abs(x / Math.SQRT2);
    const t = 1 / (1 + p * absX);
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    // BUG 1 FIX: Use exp(-absX^2) since absX is already x/sqrt(2)
    const y =
      1 -
      (a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5) *
        Math.exp(-absX * absX);

    return 0.5 * (1 + sign * y);
  }

  // ── Expected max Sharpe for N independent trials ───────────
  // E[max(SR)] ≈ (1 - γ) * Φ^{-1}(1 - 1/N) + γ * Φ^{-1}(1 - 1/(N*e))
  // where γ ≈ 0.5772 (Euler-Mascheroni constant)

  private expectedMaxSharpe(numTrials: number, T: number): number {
    if (numTrials <= 1) return 0;

    const gamma = 0.5772156649015329; // Euler-Mascheroni constant

    const p1 = 1 - 1 / numTrials;
    const p2 = 1 - 1 / (numTrials * Math.E);

    // Clamp probabilities to avoid Inf from inverse CDF
    const clampedP1 = Math.min(p1, 0.9999);
    const clampedP2 = Math.min(p2, 0.9999);

    const z1 = this.normalInverseCDF(clampedP1);
    const z2 = this.normalInverseCDF(clampedP2);

    // Scale by 1/sqrt(T) because individual trial SRs have SE ~ 1/sqrt(T)
    return ((1 - gamma) * z1 + gamma * z2) * (1 / Math.sqrt(T));
  }

  // ── Inverse normal CDF (quantile function) ─────────────────
  // Rational approximation from Peter Acklam
  // Accurate to ~1.15e-9 over [0, 1]

  private normalInverseCDF(p: number): number {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;

    // Coefficients for rational approximation
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
      // Lower region
      q = Math.sqrt(-2 * Math.log(p));
      return (
        (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
      );
    } else if (p <= pHigh) {
      // Central region
      q = p - 0.5;
      const r = q * q;
      return (
        ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
        (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
      );
    } else {
      // Upper region
      q = Math.sqrt(-2 * Math.log(1 - p));
      return (
        -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
      );
    }
  }

  // ── SR standard error adjusted for non-normality ───────────
  // SE(SR) = sqrt((1 - skew*SR + (gamma4-1)/4 * SR^2) / T)
  // where gamma4 = rawKurt = exKurt + 3, so (gamma4-1)/4 = (exKurt+2)/4
  // From Lo (2002) and Bailey & López de Prado (2014)

  private sharpeStdError(
    sr: number,
    skew: number,
    exKurt: number,
    T: number,
  ): number {
    if (T <= 1) return 0;

    // BUG 2 FIX: Changed (exKurt - 1) / 4 to (exKurt + 2) / 4
    // Non-normality correction factor using raw kurtosis gamma4 = exKurt + 3
    // (gamma4 - 1) / 4 = (exKurt + 2) / 4
    const correction = 1 - skew * sr + ((exKurt + 2) / 4) * sr * sr;

    // Clamp to avoid negative variance from extreme skew/kurtosis
    const clampedCorrection = Math.max(0.01, correction);

    return Math.sqrt(clampedCorrection / T);
  }
}
