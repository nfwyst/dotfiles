/**
 * Live data feed - connects to exchange via CCXT for real-time data.
 * Also used for paper trading (same data, different execution).
 */
import { DataFeed, TradingMode } from './types';
import { MarketData, OHLCV } from '../events/types';
import { config } from '../config';
import logger from '../logger';

/** Minimal interface for the CCXT exchange methods used by LiveDataFeed. */
interface CCXTExchange {
  loadMarkets(): Promise<unknown>;
  fetchOHLCV(symbol: string, timeframe: string, since?: number, limit?: number): Promise<number[][]>;
  fetchTicker(symbol: string): Promise<{ last?: number }>;
  fetchOrderBook(symbol: string, limit?: number): Promise<{ bids: Array<[number, number]>; asks: Array<[number, number]> }>;
}

export class LiveDataFeed implements DataFeed {
  readonly mode: TradingMode;
  private exchange: CCXTExchange;
  private symbol: string;
  private timeframe: string;
  private running: boolean = false;
  private lastTimestamp: number = 0;

  constructor(mode: 'live' | 'paper', exchange: CCXTExchange) {
    this.mode = mode;
    this.exchange = exchange;
    this.symbol = config.symbol;
    this.timeframe = config.timeframe;
  }

  async initialize(): Promise<void> {
    await this.exchange.loadMarkets();
    this.running = true;
    logger.info(
      `[LiveDataFeed] Initialized in ${this.mode} mode for ${this.symbol}`,
    );
  }

  async next(): Promise<MarketData | null> {
    if (!this.running) return null;

    try {
      // Fetch recent candles
      const candles = await this.exchange.fetchOHLCV(
        this.symbol,
        this.timeframe,
        undefined,
        200,
      );
      const ohlcv: OHLCV[] = candles.map((c: number[]) => ({
        timestamp: c[0]!,
        open: c[1]!,
        high: c[2]!,
        low: c[3]!,
        close: c[4]!,
        volume: c[5]!,
      }));

      // Fetch higher timeframe
      const htfCandles = await this.exchange.fetchOHLCV(
        this.symbol,
        '1h',
        undefined,
        100,
      );
      const higherTfOhlcv: OHLCV[] = htfCandles.map((c: number[]) => ({
        timestamp: c[0]!,
        open: c[1]!,
        high: c[2]!,
        low: c[3]!,
        close: c[4]!,
        volume: c[5]!,
      }));

      // Get current price
      const ticker = await this.exchange.fetchTicker(this.symbol);
      this.lastTimestamp = Date.now();

      // Optionally fetch order book
      let orderBook:
        | { bids: Array<[number, number]>; asks: Array<[number, number]> }
        | undefined;
      try {
        const ob = await this.exchange.fetchOrderBook(this.symbol, 20);
        orderBook = { bids: ob.bids, asks: ob.asks };
      } catch {
        /* order book optional */
      }

      return {
        ohlcv,
        higherTfOhlcv,
        currentPrice: ticker.last ?? ohlcv[ohlcv.length - 1]!.close,
        orderBook,
      };
    } catch (err) {
      logger.error(`[LiveDataFeed] Error fetching data: ${err}`);
      return null;
    }
  }

  getCurrentTimestamp(): number {
    return this.lastTimestamp || Date.now();
  }

  hasMore(): boolean {
    return this.running;
  }

  async close(): Promise<void> {
    this.running = false;
    logger.info('[LiveDataFeed] Closed');
  }
}
