/**
 * Multi-Timeframe Feature Aggregation
 *
 * Combines features from 1min, 5min, 1h, 4h, 1d timeframes.
 * Academic consensus: multi-scale features improve prediction accuracy.
 */

import { OHLCV } from '../events/types';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface TimeframeConfig {
  /** Base timeframe in minutes */
  baseTimeframe: number; // default: 5
  /** Higher timeframes to aggregate (in minutes) */
  higherTimeframes: number[]; // default: [60, 240, 1440]
}

export interface MultiTimeframeFeatures {
  /** Returns at each timeframe */
  returns: Record<string, number>;
  /** Volatility at each timeframe */
  volatility: Record<string, number>;
  /** Momentum (RSI proxy) at each timeframe */
  momentum: Record<string, number>;
  /** Volume ratio at each timeframe */
  volumeRatio: Record<string, number>;
  /** Cross-timeframe trend alignment score [-1, 1] */
  trendAlignment: number;
  /** Dominant timeframe (which TF has strongest signal) */
  dominantTimeframe: string;
}

// ────────────────────────────────────────────────────────────────
// Multi-Timeframe Aggregator
// ────────────────────────────────────────────────────────────────

export class MultiTimeframeAggregator {
  private config: TimeframeConfig;
  private candleBuffers: Map<number, OHLCV[]> = new Map();
  private maxBuffer: number = 500;

  constructor(config?: Partial<TimeframeConfig>) {
    this.config = {
      baseTimeframe: config?.baseTimeframe ?? 5,
      higherTimeframes: config?.higherTimeframes ?? [60, 240, 1440],
    };

    // Initialize buffer for base timeframe
    this.candleBuffers.set(this.config.baseTimeframe, []);
  }

  /**
   * Feed a base-timeframe candle; returns aggregated features.
   */
  update(candle: OHLCV): MultiTimeframeFeatures {
    // Add candle to the base buffer
    const baseBuffer = this.candleBuffers.get(this.config.baseTimeframe)!;
    baseBuffer.push(candle);

    // Trim base buffer
    if (baseBuffer.length > this.maxBuffer) {
      baseBuffer.splice(0, baseBuffer.length - this.maxBuffer);
    }

    // Compute features for each timeframe
    const allTimeframes = [
      this.config.baseTimeframe,
      ...this.config.higherTimeframes,
    ];
    const returns: Record<string, number> = {};
    const volatility: Record<string, number> = {};
    const momentum: Record<string, number> = {};
    const volumeRatio: Record<string, number> = {};
    const featureMap = new Map<number, { ret: number; mom: number }>();

    for (const tf of allTimeframes) {
      const tfLabel = this.tfLabel(tf);

      let candles: OHLCV[];
      if (tf === this.config.baseTimeframe) {
        candles = baseBuffer;
      } else {
        // Resample base candles to this higher timeframe
        candles = this.resample(baseBuffer, tf);
      }

      if (candles.length < 2) {
        returns[tfLabel] = 0;
        volatility[tfLabel] = 0;
        momentum[tfLabel] = 0.5;
        volumeRatio[tfLabel] = 1;
        featureMap.set(tf, { ret: 0, mom: 0.5 });
        continue;
      }

      const feat = this.computeFeatures(candles);
      returns[tfLabel] = feat.ret;
      volatility[tfLabel] = feat.vol;
      momentum[tfLabel] = feat.mom;
      volumeRatio[tfLabel] = feat.volRatio;
      featureMap.set(tf, { ret: feat.ret, mom: feat.mom });
    }

    // Cross-timeframe trend alignment
    const trendAlignment = this.computeTrendAlignment(featureMap);

    // Dominant timeframe: the TF with the strongest absolute return
    let maxAbsReturn = 0;
    let dominant = this.tfLabel(this.config.baseTimeframe);
    for (const [tfLabel, ret] of Object.entries(returns)) {
      const absRet = Math.abs(ret);
      if (absRet > maxAbsReturn) {
        maxAbsReturn = absRet;
        dominant = tfLabel;
      }
    }

    return {
      returns,
      volatility,
      momentum,
      volumeRatio,
      trendAlignment,
      dominantTimeframe: dominant,
    };
  }

  /**
   * Resample base candles to higher timeframe.
   * Groups base candles into buckets of size (targetMinutes / baseTimeframe)
   * and merges each group into one OHLCV bar.
   */
  private resample(candles: OHLCV[], targetMinutes: number): OHLCV[] {
    const ratio = Math.round(targetMinutes / this.config.baseTimeframe);
    if (ratio <= 1 || candles.length < ratio) return candles;

    const result: OHLCV[] = [];

    // Align from the end so the most recent bar is complete (or partial)
    // We want the last group to end at the last candle
    const totalBars = candles.length;
    const startOffset = totalBars % ratio;

    for (let i = startOffset; i + ratio <= totalBars; i += ratio) {
      const group = candles.slice(i, i + ratio);
      if (group.length === 0) continue;

      const merged: OHLCV = {
        timestamp: group[0].timestamp,
        open: group[0].open,
        high: Math.max(...group.map((c) => c.high)),
        low: Math.min(...group.map((c) => c.low)),
        close: group[group.length - 1].close,
        volume: group.reduce((s, c) => s + c.volume, 0),
      };
      result.push(merged);
    }

    // If there's a trailing partial group, include it
    if (startOffset > 0 && candles.length >= ratio) {
      // The partial group at the beginning is excluded by the loop above
      // But we may want the latest partial group at the end
      // Actually the loop above handles complete groups. Let's check if
      // there are leftover candles at the end
    }

    return result;
  }

  /**
   * Compute features for a single timeframe's candle array.
   */
  private computeFeatures(candles: OHLCV[]): {
    ret: number;
    vol: number;
    mom: number;
    volRatio: number;
  } {
    const n = candles.length;
    if (n < 2) {
      return { ret: 0, vol: 0, mom: 0.5, volRatio: 1 };
    }

    // ── Return: last candle's return ──────────────────────────
    const lastClose = candles[n - 1].close;
    const prevClose = candles[n - 2].close;
    const ret = prevClose !== 0 ? (lastClose - prevClose) / prevClose : 0;

    // ── Volatility: std of recent log returns ─────────────────
    const lookback = Math.min(20, n - 1);
    const logReturns: number[] = [];
    for (let i = n - lookback; i < n; i++) {
      if (candles[i - 1].close > 0 && candles[i].close > 0) {
        logReturns.push(Math.log(candles[i].close / candles[i - 1].close));
      }
    }

    let vol = 0;
    if (logReturns.length > 1) {
      const mean =
        logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
      const variance =
        logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) /
        (logReturns.length - 1);
      vol = Math.sqrt(variance);
    }

    // ── Momentum: RSI proxy (fraction of up-bars in lookback) ─
    let ups = 0;
    let downs = 0;
    const momLookback = Math.min(14, n - 1);
    for (let i = n - momLookback; i < n; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change > 0) ups += change;
      else downs += Math.abs(change);
    }
    const totalMove = ups + downs;
    // RSI-style: ups / (ups + downs), mapped to [0, 1]
    const mom = totalMove > 0 ? ups / totalMove : 0.5;

    // ── Volume ratio: current vs average ──────────────────────
    const volLookback = Math.min(20, n);
    const recentVolumes = candles.slice(-volLookback).map((c) => c.volume);
    const avgVol =
      recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;
    const currentVol = candles[n - 1].volume;
    const volRatio = avgVol > 0 ? currentVol / avgVol : 1;

    return { ret, vol, mom, volRatio };
  }

  /**
   * Cross-timeframe trend alignment.
   *
   * Measures how aligned the return direction and momentum are across
   * all timeframes. Returns [-1, 1]:
   *   +1 = all timeframes bullish (positive returns, momentum > 0.5)
   *   -1 = all timeframes bearish
   *    0 = mixed signals
   */
  private computeTrendAlignment(
    features: Map<number, { ret: number; mom: number }>,
  ): number {
    if (features.size === 0) return 0;

    let alignmentSum = 0;
    let count = 0;

    for (const [, feat] of features) {
      // Return direction: sign of return, scaled by magnitude
      const retDirection = feat.ret > 0 ? 1 : feat.ret < 0 ? -1 : 0;

      // Momentum direction: > 0.5 is bullish, < 0.5 is bearish
      const momDirection = feat.mom > 0.55 ? 1 : feat.mom < 0.45 ? -1 : 0;

      // Average both signals
      alignmentSum += (retDirection + momDirection) / 2;
      count++;
    }

    if (count === 0) return 0;

    // Normalize to [-1, 1]
    const raw = alignmentSum / count;
    return Math.max(-1, Math.min(1, raw));
  }

  /**
   * Human-readable timeframe label.
   */
  private tfLabel(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${minutes / 60}h`;
    return `${minutes / 1440}d`;
  }
}
