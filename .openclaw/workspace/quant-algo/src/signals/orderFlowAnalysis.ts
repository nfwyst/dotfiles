/**
 * Order Flow Analysis — ScienceDirect 2025
 *
 * Implements Order Flow Imbalance (OFI) and Trades Flow Imbalance (TFI)
 * features for crypto market prediction.
 * OFI measures the imbalance between buy and sell pressure in the order book.
 * TFI measures the imbalance in executed trades.
 *
 * These are the strongest predictors for crypto returns (Sharpe 3.63 in paper).
 */

import { OHLCV } from '../events/types';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface OrderBook {
  bids: Array<[number, number]>; // [price, size]
  asks: Array<[number, number]>; // [price, size]
  timestamp: number;
}

export interface OrderFlowConfig {
  /** Number of order book levels to use */
  levels: number; // default: 10
  /** Lookback for rolling normalization */
  normLookback: number; // default: 100
  /** EMA half-life for smoothing */
  emaHalfLife: number; // default: 20
}

export interface OrderFlowSignal {
  /** Order Flow Imbalance [-1, 1] */
  ofi: number;
  /** Trade Flow Imbalance [-1, 1] (from OHLCV proxy: close vs open) */
  tfi: number;
  /** Volume-weighted OFI */
  vwOfi: number;
  /** Multi-scale OFI (short + medium + long) */
  multiScaleOfi: number;
  /** Normalized aggregate signal [-1, 1] */
  signal: number;
  /** Signal strength [0, 1] */
  strength: number;
  /** Direction */
  direction: 'bullish' | 'bearish' | 'neutral';
  timestamp: number;
}

// ────────────────────────────────────────────────────────────────
// Order Flow Analyzer
// ────────────────────────────────────────────────────────────────

export class OrderFlowAnalyzer {
  private config: OrderFlowConfig;
  private ofiHistory: number[] = [];
  private tfiHistory: number[] = [];
  private prevOrderBook: OrderBook | null = null;
  private lastSignal: OrderFlowSignal | null = null;
  private volumeHistory: number[] = [];

  constructor(config?: Partial<OrderFlowConfig>) {
    this.config = {
      levels: config?.levels ?? 10,
      normLookback: config?.normLookback ?? 100,
      emaHalfLife: config?.emaHalfLife ?? 20,
    };
  }

  /**
   * Update with new order book snapshot and latest candle.
   * Returns flow signal even without order book (uses OHLCV proxy).
   */
  update(candle: OHLCV, orderBook?: OrderBook): OrderFlowSignal {
    // BUG 12 FIX: Push candle volume to history BEFORE computeTFI
    // so that the volume average used by TFI includes the current candle.
    this.volumeHistory.push(candle.volume);
    if (this.volumeHistory.length > this.config.normLookback) {
      this.volumeHistory = this.volumeHistory.slice(-this.config.normLookback);
    }

    // ── Compute TFI from OHLCV (always available) ─────────────
    const tfi = this.computeTFI(candle);
    this.tfiHistory.push(tfi);
    if (this.tfiHistory.length > this.config.normLookback * 2) {
      this.tfiHistory = this.tfiHistory.slice(-this.config.normLookback * 2);
    }

    // ── Compute OFI from order book (if available) ────────────
    let rawOfi = 0;
    if (orderBook && this.prevOrderBook) {
      rawOfi = this.computeOFI(this.prevOrderBook, orderBook);
    }
    this.ofiHistory.push(rawOfi);
    if (this.ofiHistory.length > this.config.normLookback * 2) {
      this.ofiHistory = this.ofiHistory.slice(-this.config.normLookback * 2);
    }
    if (orderBook) {
      this.prevOrderBook = orderBook;
    }

    // ── Normalize signals ─────────────────────────────────────
    const normOfi = this.normalizeSignal(rawOfi, this.ofiHistory);
    const normTfi = this.normalizeSignal(tfi, this.tfiHistory);

    // ── Volume-weighted OFI ───────────────────────────────────
    const avgVol =
      this.volumeHistory.length > 0
        ? this.volumeHistory.reduce((s, v) => s + v, 0) /
          this.volumeHistory.length
        : 1;
    const volRatio = avgVol > 0 ? candle.volume / avgVol : 1;
    const vwOfi = normOfi * Math.min(volRatio, 3); // Cap at 3x to prevent extremes
    const clampedVwOfi = Math.max(-1, Math.min(1, vwOfi));

    // ── Multi-scale OFI ───────────────────────────────────────
    const multiScaleOfi = this.computeMultiScaleOFI();

    // ── Aggregate signal ──────────────────────────────────────
    // Blend OFI (40%), TFI (30%), multi-scale (30%)
    const hasOrderBook = this.prevOrderBook !== null && this.ofiHistory.length > 1;
    let rawSignal: number;
    if (hasOrderBook) {
      rawSignal = 0.4 * normOfi + 0.3 * normTfi + 0.3 * multiScaleOfi;
    } else {
      // Without order book data, rely more on TFI
      rawSignal = 0.6 * normTfi + 0.4 * multiScaleOfi;
    }
    const signal = Math.max(-1, Math.min(1, rawSignal));

    // ── Strength and direction ────────────────────────────────
    const strength = Math.min(1, Math.abs(signal));
    let direction: 'bullish' | 'bearish' | 'neutral';
    if (signal > 0.1) {
      direction = 'bullish';
    } else if (signal < -0.1) {
      direction = 'bearish';
    } else {
      direction = 'neutral';
    }

    this.lastSignal = {
      ofi: normOfi,
      tfi: normTfi,
      vwOfi: clampedVwOfi,
      multiScaleOfi,
      signal,
      strength,
      direction,
      timestamp: candle.timestamp,
    };

    return this.lastSignal;
  }

  /**
   * Compute OFI from consecutive order book snapshots.
   *
   * OFI = sum over levels of:
   *   delta_bid_size * I(bid_price >= prev_bid_price)
   * - delta_ask_size * I(ask_price <= prev_ask_price)
   */
  private computeOFI(prev: OrderBook, curr: OrderBook): number {
    const levels = Math.min(
      this.config.levels,
      prev.bids.length,
      prev.asks.length,
      curr.bids.length,
      curr.asks.length,
    );

    if (levels === 0) return 0;

    let ofi = 0;

    for (let i = 0; i < levels; i++) {
      const [prevBidPrice, prevBidSize] = prev.bids[i]!;
      const [currBidPrice, currBidSize] = curr.bids[i]!;
      const [prevAskPrice, prevAskSize] = prev.asks[i]!;
      const [currAskPrice, currAskSize] = curr.asks[i]!;

      // Bid-side contribution:
      // If current bid price >= previous bid price, the change in bid size
      // represents increasing buy pressure
      if (currBidPrice >= prevBidPrice) {
        ofi += currBidSize - prevBidSize;
      } else {
        // Price dropped: all previous bid size was "removed"
        ofi -= prevBidSize;
      }

      // Ask-side contribution:
      // If current ask price <= previous ask price, the change in ask size
      // represents increasing sell pressure (negative for flow)
      if (currAskPrice <= prevAskPrice) {
        ofi -= (currAskSize - prevAskSize);
      } else {
        // Price rose: all previous ask size was "removed" (bullish)
        ofi += prevAskSize;
      }
    }

    return ofi;
  }

  /**
   * Compute TFI proxy from OHLCV.
   * TFI proxy = (close - open) / (high - low) * volume_ratio
   *
   * Approximates trade flow imbalance from candle data when
   * tick-level trade data is unavailable.
   */
  private computeTFI(candle: OHLCV): number {
    const range = candle.high - candle.low;
    if (range === 0) return 0;

    // Direction component: how far close is from open relative to range
    const directionRatio = (candle.close - candle.open) / range;

    // Volume component: current volume vs recent average
    // BUG 12 FIX: volumeHistory already includes current candle's volume
    // (pushed before this function is called), so the average is up to date.
    const avgVol =
      this.volumeHistory.length > 0
        ? this.volumeHistory.reduce((s, v) => s + v, 0) /
          this.volumeHistory.length
        : candle.volume;
    const volumeRatio = avgVol > 0 ? candle.volume / avgVol : 1;

    // Combine direction with volume emphasis
    // Cap volume ratio at 3x to prevent extreme values
    const tfi = directionRatio * Math.min(volumeRatio, 3);

    return tfi;
  }

  /**
   * Multi-scale OFI: combine short (5), medium (20), long (50) lookbacks.
   * Each scale is an EMA of the OFI history with different half-lives.
   * The final value is the average of the three scales, normalized.
   */
  private computeMultiScaleOFI(): number {
    if (this.ofiHistory.length < 2) return 0;

    const shortEma = this.ema(this.ofiHistory, 5);
    const mediumEma = this.ema(this.ofiHistory, 20);
    const longEma = this.ema(this.ofiHistory, 50);

    // Combine scales with equal weight
    const raw = (shortEma + mediumEma + longEma) / 3;

    // Normalize using the full OFI history
    return this.normalizeSignal(raw, this.ofiHistory);
  }

  /**
   * Normalize signal to [-1, 1] using rolling z-score.
   * z = (value - mean) / std, then tanh to compress to [-1, 1].
   */
  private normalizeSignal(value: number, history: number[]): number {
    const lookback = Math.min(this.config.normLookback, history.length);
    if (lookback < 2) return 0;

    const recent = history.slice(-lookback);
    const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
    const variance =
      recent.reduce((s, v) => s + (v - mean) ** 2, 0) / (recent.length - 1);
    const std = Math.sqrt(variance);

    if (std === 0) return 0;

    const zScore = (value - mean) / std;
    // Use tanh to smoothly compress to [-1, 1]
    return Math.tanh(zScore / 2);
  }

  /**
   * EMA smoothing.
   * Decay factor: alpha = 1 - exp(-ln(2) / halfLife)
   */
  private ema(values: number[], halfLife: number): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0]!;

    const alpha = 1 - Math.exp(-Math.LN2 / Math.max(1, halfLife));
    let result = values[0]!;

    for (let i = 1; i < values.length; i++) {
      result = alpha * values[i]! + (1 - alpha) * result;
    }

    return result;
  }

  getCurrentSignal(): OrderFlowSignal {
    if (this.lastSignal) return this.lastSignal;
    return {
      ofi: 0,
      tfi: 0,
      vwOfi: 0,
      multiScaleOfi: 0,
      signal: 0,
      strength: 0,
      direction: 'neutral',
      timestamp: 0,
    };
  }
}
