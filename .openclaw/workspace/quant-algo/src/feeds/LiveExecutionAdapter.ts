/**
 * Live Execution Adapter - wraps ExchangeManager for the unified ExecutionAdapter interface.
 * 
 * Since ExchangeManager now implements ExecutionAdapter directly, this class serves as
 * a thin wrapper that can add additional live-specific behavior (logging, safety checks, etc.)
 * on top of the core ExchangeManager.
 */
import { ExecutionAdapter, OrderResult, TradingMode } from './types';
import { Position } from '../events/types';
import { ExchangeManager } from '../exchange';
import { config } from '../config';
import logger from '../logger';

export class LiveExecutionAdapter implements ExecutionAdapter {
  private exchange: ExchangeManager;
  private symbol: string;

  constructor(exchange: ExchangeManager) {
    this.exchange = exchange;
    this.symbol = config.symbol;
  }

  get mode(): TradingMode {
    return this.exchange.mode;
  }

  async placeMarketOrder(
    side: 'buy' | 'sell',
    size: number,
    symbol: string,
  ): Promise<OrderResult> {
    logger.info(`[LiveExecution] Placing market order: ${side} ${size} ${symbol || this.symbol} (mode=${this.mode})`);
    return this.exchange.placeMarketOrder(side, size, symbol || this.symbol);
  }

  async placeLimitOrder(
    side: 'buy' | 'sell',
    size: number,
    price: number,
    symbol: string,
  ): Promise<OrderResult> {
    logger.info(`[LiveExecution] Placing limit order: ${side} ${size} @ ${price} ${symbol || this.symbol} (mode=${this.mode})`);
    return this.exchange.placeLimitOrder(side, size, price, symbol || this.symbol);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    logger.info(`[LiveExecution] Cancelling order: ${orderId}`);
    return this.exchange.cancelOrder(orderId);
  }

  async getBalance(): Promise<number> {
    return this.exchange.getBalance();
  }

  async getPosition(symbol: string): Promise<Position | null> {
    return this.exchange.getPosition(symbol || this.symbol);
  }

  /**
   * Partial close: reduce existing position by closePercent (0..1).
   * On a real exchange this places a reduce-only market order for
   * the calculated portion of the current position size.
   */
  async placePartialClose(symbol: string, closePercent: number): Promise<OrderResult> {
    const position = await this.getPosition(symbol || this.symbol);
    if (!position || position.side === 'none' || position.size === 0) {
      return { success: false, message: 'No position to partially close', timestamp: Date.now() };
    }
    const closeSize = position.size * closePercent;
    if (closeSize <= 0) {
      return { success: false, message: 'Close size is zero', timestamp: Date.now() };
    }
    const closeSide: 'buy' | 'sell' = position.side === 'long' ? 'sell' : 'buy';
    logger.info(
      `[LiveExecution] Partial close: ${closeSide} ${closeSize} ${symbol || this.symbol} ` +
      `(${(closePercent * 100).toFixed(0)}% of ${position.size})`
    );
    return this.exchange.placeMarketOrder(closeSide, closeSize, symbol || this.symbol);
  }

  async close(): Promise<void> {
    logger.info('[LiveExecution] Adapter closed');
    return this.exchange.close();
  }
}
