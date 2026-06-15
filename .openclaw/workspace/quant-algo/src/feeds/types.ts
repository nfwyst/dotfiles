/**
 * DataFeed Abstraction Layer
 * Unifies historical (backtest) and live data sources behind a common interface.
 * This is the key to running the SAME strategy code in backtest, paper, and live modes.
 */
import { OHLCV, MarketData, Position } from '../events/types';

export type TradingMode = 'backtest' | 'paper' | 'live';

export interface DataFeed {
  readonly mode: TradingMode;

  /** Initialize the feed (connect, load data, etc.) */
  initialize(): Promise<void>;

  /** Get next batch of market data. Returns null when exhausted (backtest end). */
  next(): Promise<MarketData | null>;

  /** Get current timestamp */
  getCurrentTimestamp(): number;

  /** Check if feed has more data */
  hasMore(): boolean;

  /** Clean up resources */
  close(): Promise<void>;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  filledPrice?: number;
  filledSize?: number;
  fee?: number;
  message: string;
  timestamp: number;
}

export interface ExecutionAdapter {
  readonly mode: TradingMode;

  /** Place a market order */
  placeMarketOrder(side: 'buy' | 'sell', size: number, symbol: string): Promise<OrderResult>;

  /** Place a limit order */
  placeLimitOrder(side: 'buy' | 'sell', size: number, price: number, symbol: string): Promise<OrderResult>;

  /** Cancel an order */
  cancelOrder(orderId: string): Promise<boolean>;

  /** Get current balance */
  getBalance(): Promise<number>;

  /** Get current position */
  getPosition(symbol: string): Promise<Position | null>;

  /** Update current market price (used by paper/backtest adapters for simulated fills) */
  updatePrice?(price: number): void;

  /** Phase 6: Partially close a position by percentage (0..1). Optional — only paper/backtest adapters. */
  placePartialClose?(symbol: string, closePercent: number): Promise<OrderResult>;

  /** Clean up */
  close(): Promise<void>;
}
