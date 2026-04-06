/**
 * Live Execution Adapter - wraps real exchange for order execution.
 */
import { ExecutionAdapter, OrderResult, TradingMode } from './types';
import { Position } from '../events/types';
import { config } from '../config';
import logger from '../logger';

export class LiveExecutionAdapter implements ExecutionAdapter {
  readonly mode: TradingMode = 'live';
  private exchange: any;
  private symbol: string;

  constructor(exchange: any) {
    this.exchange = exchange;
    this.symbol = config.symbol;
  }

  async placeMarketOrder(
    side: 'buy' | 'sell',
    size: number,
    symbol: string,
  ): Promise<OrderResult> {
    try {
      const order = await this.exchange.createOrder(
        symbol || this.symbol,
        'market',
        side,
        size,
      );
      return {
        success: true,
        orderId: order.id,
        filledPrice: order.average ?? order.price,
        filledSize: order.filled ?? size,
        fee: order.fee?.cost ?? 0,
        message: `Order ${order.id} filled`,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      logger.error(`[LiveExecution] Market order failed: ${err.message}`);
      return { success: false, message: err.message, timestamp: Date.now() };
    }
  }

  async placeLimitOrder(
    side: 'buy' | 'sell',
    size: number,
    price: number,
    symbol: string,
  ): Promise<OrderResult> {
    try {
      const order = await this.exchange.createOrder(
        symbol || this.symbol,
        'limit',
        side,
        size,
        price,
      );
      return {
        success: true,
        orderId: order.id,
        filledPrice: order.average ?? price,
        filledSize: order.filled ?? 0,
        fee: order.fee?.cost ?? 0,
        message: `Limit order ${order.id} placed`,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      logger.error(`[LiveExecution] Limit order failed: ${err.message}`);
      return { success: false, message: err.message, timestamp: Date.now() };
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.exchange.cancelOrder(orderId, this.symbol);
      return true;
    } catch (err: any) {
      logger.error(`[LiveExecution] Cancel failed: ${err.message}`);
      return false;
    }
  }

  async getBalance(): Promise<number> {
    const balance = await this.exchange.fetchBalance();
    return balance.total?.USDT ?? balance.free?.USDT ?? 0;
  }

  async getPosition(symbol: string): Promise<Position | null> {
    try {
      const positions = await this.exchange.fetchPositions([
        symbol || this.symbol,
      ]);
      const pos = positions.find(
        (p: any) => Math.abs(p.contracts) > 0,
      );
      if (!pos) return null;
      return {
        side: pos.side === 'long' ? 'long' : 'short',
        size: Math.abs(pos.contracts),
        entryPrice: pos.entryPrice ?? 0,
        leverage: pos.leverage ?? 1,
        unrealizedPnl: pos.unrealizedPnl ?? 0,
        markPrice: pos.markPrice,
        liquidationPrice: pos.liquidationPrice,
      };
    } catch {
      return null;
    }
  }

  async close(): Promise<void> {
    logger.info('[LiveExecution] Adapter closed');
  }
}
