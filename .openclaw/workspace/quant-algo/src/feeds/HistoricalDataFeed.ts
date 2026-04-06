/**
 * Historical data feed for backtesting.
 * Replays OHLCV data sequentially, simulating real-time data arrival.
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
    this.batchSize = config.batchSize ?? 1;
  }

  async initialize(): Promise<void> {
    /* no-op for historical */
  }

  async next(): Promise<MarketData | null> {
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

  getCurrentTimestamp(): number {
    if (this.cursor === 0) return this.data[0]?.timestamp ?? 0;
    return this.data[Math.min(this.cursor - 1, this.data.length - 1)]!.timestamp;
  }

  hasMore(): boolean {
    return this.cursor < this.data.length;
  }

  async close(): Promise<void> {
    /* no-op */
  }
}
