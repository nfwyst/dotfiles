/**
 * Triple Barrier Labeling Method — López de Prado AFML Ch.3
 *
 * Labels each observation with {-1, 0, +1} based on three barriers:
 * - Upper barrier: take-profit (price rises by ptSl[0] * daily_vol)
 * - Lower barrier: stop-loss (price falls by ptSl[1] * daily_vol)
 * - Vertical barrier: time expiry (maxHoldingPeriod bars)
 *
 * Superior to simple future-return labeling for ML training.
 */

import { OHLCV } from '../events/types';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface TripleBarrierConfig {
  /** [profit-take multiplier, stop-loss multiplier] of daily vol */
  ptSl: [number, number]; // default: [2, 1]
  /** Maximum holding period in bars */
  maxHoldingPeriod: number; // default: 20
  /** Volatility lookback for daily vol estimate */
  volLookback: number; // default: 20
  /** Minimum volatility floor to prevent tiny barriers */
  minVolatility: number; // default: 0.001
}

export interface BarrierLabel {
  /** Entry bar index */
  entryIdx: number;
  /** Exit bar index */
  exitIdx: number;
  /** Label: 1 (profit-take hit), -1 (stop-loss hit), 0 (time expiry) */
  label: -1 | 0 | 1;
  /** Return at exit */
  returnAtExit: number;
  /** Which barrier was hit */
  barrier: 'upper' | 'lower' | 'vertical';
  /** Holding period in bars */
  holdingPeriod: number;
}

// ────────────────────────────────────────────────────────────────
// Triple Barrier Labeler
// ────────────────────────────────────────────────────────────────

export class TripleBarrierLabeler {
  private config: TripleBarrierConfig;

  constructor(config?: Partial<TripleBarrierConfig>) {
    this.config = {
      ptSl: config?.ptSl ?? [2, 1],
      maxHoldingPeriod: config?.maxHoldingPeriod ?? 20,
      volLookback: config?.volLookback ?? 20,
      minVolatility: config?.minVolatility ?? 0.001,
    };
  }

  /**
   * Label all events in the OHLCV series.
   * @param ohlcv - Price series
   * @param eventIndices - Optional: only label specific bars (default: all bars
   *                       starting from volLookback so daily vol is available)
   */
  label(ohlcv: OHLCV[], eventIndices?: number[]): BarrierLabel[] {
    if (ohlcv.length < this.config.volLookback + 1) {
      return [];
    }

    // Compute rolling daily volatility for the entire series
    const dailyVol = this.computeDailyVol(ohlcv, this.config.volLookback);

    // Determine which indices to label
    const indices =
      eventIndices ??
      Array.from(
        { length: ohlcv.length - this.config.volLookback },
        (_, i) => i + this.config.volLookback,
      );

    const labels: BarrierLabel[] = [];

    for (const idx of indices) {
      // Skip if out of bounds or if we don't have volatility data
      if (idx < 0 || idx >= ohlcv.length) continue;
      // Need at least volLookback bars of history for the vol estimate
      if (idx < this.config.volLookback) continue;

      const vol = dailyVol[idx];
      // Skip if vol is undefined (shouldn't happen but be safe)
      if (vol === undefined) continue;

      const result = this.applyBarrier(ohlcv, idx, vol);
      labels.push(result);
    }

    return labels;
  }

  /**
   * Compute rolling daily volatility using log-return standard deviation.
   * Returns an array of same length as ohlcv; indices before lookback
   * are filled with 0.
   */
  private computeDailyVol(ohlcv: OHLCV[], lookback: number): number[] {
    const n = ohlcv.length;
    const vol = new Array<number>(n).fill(0);

    for (let i = lookback; i < n; i++) {
      // Collect log-returns over the lookback window
      const logReturns: number[] = [];
      for (let j = i - lookback + 1; j <= i; j++) {
        if (ohlcv[j - 1]!.close > 0 && ohlcv[j]!.close > 0) {
          logReturns.push(Math.log(ohlcv[j]!.close / ohlcv[j - 1]!.close));
        }
      }

      if (logReturns.length < 2) {
        vol[i] = this.config.minVolatility;
        continue;
      }

      const mean =
        logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
      const variance =
        logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) /
        (logReturns.length - 1);
      const std = Math.sqrt(variance);

      // Enforce minimum volatility floor
      vol[i] = Math.max(std, this.config.minVolatility);
    }

    return vol;
  }

  /**
   * Apply triple barrier to a single event.
   * Walk forward from entryIdx, checking upper/lower barriers at each bar,
   * up to the vertical barrier (maxHoldingPeriod).
   */
  private applyBarrier(
    ohlcv: OHLCV[],
    entryIdx: number,
    dailyVol: number,
  ): BarrierLabel {
    const entryPrice = ohlcv[entryIdx]!.close;
    const [ptMult, slMult] = this.config.ptSl;
    const maxHold = this.config.maxHoldingPeriod;

    // Barrier levels as absolute prices
    const upperBarrier = entryPrice * (1 + ptMult * dailyVol);
    const lowerBarrier = entryPrice * (1 - slMult * dailyVol);

    // Walk forward bar by bar
    const lastIdx = Math.min(entryIdx + maxHold, ohlcv.length - 1);

    for (let t = entryIdx + 1; t <= lastIdx; t++) {
      const candle = ohlcv[t]!;

      const upperBreached = candle.high >= upperBarrier;
      const lowerBreached = candle.low <= lowerBarrier;

      // BUG 5 FIX: When both barriers are breached on the same bar,
      // resolve based on open price proximity to avoid optimistic bias.
      // If open is above entry (trending up), award upper; otherwise award lower.
      if (upperBreached && lowerBreached) {
        if (candle.open >= entryPrice) {
          // Open above entry => trending up => award upper (take-profit)
          const ret = (upperBarrier - entryPrice) / entryPrice;
          return {
            entryIdx,
            exitIdx: t,
            label: 1,
            returnAtExit: ret,
            barrier: 'upper',
            holdingPeriod: t - entryIdx,
          };
        } else {
          // Open below entry => trending down => award lower (stop-loss)
          const ret = (lowerBarrier - entryPrice) / entryPrice;
          return {
            entryIdx,
            exitIdx: t,
            label: -1,
            returnAtExit: ret,
            barrier: 'lower',
            holdingPeriod: t - entryIdx,
          };
        }
      }

      // Check upper barrier (take-profit) — use high price
      if (upperBreached) {
        const ret = (upperBarrier - entryPrice) / entryPrice;
        return {
          entryIdx,
          exitIdx: t,
          label: 1,
          returnAtExit: ret,
          barrier: 'upper',
          holdingPeriod: t - entryIdx,
        };
      }

      // Check lower barrier (stop-loss) — use low price
      if (lowerBreached) {
        const ret = (lowerBarrier - entryPrice) / entryPrice;
        return {
          entryIdx,
          exitIdx: t,
          label: -1,
          returnAtExit: ret,
          barrier: 'lower',
          holdingPeriod: t - entryIdx,
        };
      }
    }

    // Vertical barrier hit (time expiry)
    const exitIdx = lastIdx;
    const exitPrice = ohlcv[exitIdx]!.close;
    const ret = (exitPrice - entryPrice) / entryPrice;

    // Label based on the return at expiry
    let label: -1 | 0 | 1 = 0;
    // If the return is meaningfully positive or negative, label accordingly
    // Otherwise keep 0 for the vertical barrier case
    if (ret > dailyVol * 0.1) {
      label = 1;
    } else if (ret < -dailyVol * 0.1) {
      label = -1;
    }

    return {
      entryIdx,
      exitIdx,
      label,
      returnAtExit: ret,
      barrier: 'vertical',
      holdingPeriod: exitIdx - entryIdx,
    };
  }
}
