/**
 * Historical data feed for backtesting.
 * Replays OHLCV data sequentially, simulating real-time data arrival.
 *
 * FIX BUG 6: Ensured proper exhaustion semantics:
 * - next() returns null when ALL data has been consumed (cursor >= data.length)
 * - hasMore() is strictly consistent with next() (both use cursor < data.length)
 * - Empty data arrays are handled gracefully (hasMore() = false, next() = null)
 * - getCurrentTimestamp() returns 0 for empty data instead of crashing
 */
import { DataFeed, TradingMode } from './types';
import { OHLCV, MarketData } from '../events/types';

export interface HistoricalFeedConfig {
  ohlcv: OHLCV[];
  higherTfOhlcv?: OHLCV[];
  batchSize?: number; // candles per next() call, default 1
}

export class HistoricalDataFeed implements DataFeed {
  readonly mode: TradingMode = 'backtest';
  private data: OHLCV[];
  private higherTf: OHLCV[];
  private cursor: number = 0;
  private batchSize: number;

  constructor(config: HistoricalFeedConfig) {
    this.data = config.ohlcv;
    this.higherTf = config.higherTfOhlcv ?? [];
    this.batchSize = Math.max(1, config.batchSize ?? 1);
  }

  async initialize(): Promise<void> {
    /* no-op for historical */
  }

  /**
   * Get the next batch of market data.
   * Returns null when all data has been exhausted.
   *
   * FIX BUG 6: Explicit empty-data guard and consistent cursor management.
   */
  async next(): Promise<MarketData | null> {
    // FIX BUG 6: Guard against empty data array
    if (this.data.length === 0) return null;

    // Exhaustion check — consistent with hasMore()
    if (this.cursor >= this.data.length) return null;

    const endIdx = Math.min(this.cursor + this.batchSize, this.data.length);
    const batch = this.data.slice(0, endIdx); // All data up to current point
    const currentCandle = this.data[endIdx - 1]!;

    // Find higher TF candles up to current timestamp
    const htfData = this.higherTf.filter(
      (c) => c.timestamp <= currentCandle.timestamp,
    );

    this.cursor = endIdx;

    return {
      ohlcv: batch,
      higherTfOhlcv: htfData,
      currentPrice: currentCandle.close,
    };
  }

  /**
   * Get the timestamp of the most recently consumed candle.
   * Returns 0 if no data has been consumed yet or data is empty.
   *
   * FIX BUG 6: Safe access for empty data arrays.
   */
  getCurrentTimestamp(): number {
    if (this.data.length === 0) return 0;
    if (this.cursor === 0) return this.data[0]?.timestamp ?? 0;
    return this.data[Math.min(this.cursor - 1, this.data.length - 1)]!.timestamp;
  }

  /**
   * Check if the feed has more data to consume.
   *
   * FIX BUG 6: Strictly consistent with next() — both use `cursor < data.length`.
   */
  hasMore(): boolean {
    return this.cursor < this.data.length;
  }

  async close(): Promise<void> {
    /* no-op */
  }
}
