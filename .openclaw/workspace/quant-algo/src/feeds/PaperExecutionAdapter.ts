/**
 * Paper Trading Execution Adapter
 *
 * Simulates order execution with real market data but virtual portfolio.
 * Tracks orders, positions, and P&L without risking real capital.
 *
 * Features:
 * - Simulated fills with configurable slippage
 * - Virtual balance and position tracking
 * - Realistic fee simulation
 * - Trade history for analysis
 * - Partial close support (Phase 6)
 * - Pending limit order queue with price-crossing detection (Phase 6)
 * - Precision-safe arithmetic via decimal utilities (Phase 6)
 *
 * FIX BUG 5: Corrected short position PnL to use
 *   (entryPrice - exitPrice) * size * leverage
 * Also fixed: position state is fully reset on close (including markPrice),
 * partial closes are explicitly not supported (full close only),
 * and getSummary() now correctly filters only close trades for win rate.
 */
import { ExecutionAdapter, OrderResult, TradingMode } from './types';
import { Position } from '../events/types';
import { loadConfig } from '../config/config.js';
import {
  roundTo,
  safeAdd,
  safeSub,
  safeMul,
  safeDiv,
  calculatePnl,
} from '../utils/decimal';
import logger from '../logger';

interface PaperTradingConfig {
  initialBalance: number; // default: 10000
  maxPositionSize: number; // default: 1.0
  leverage: number; // default: 1
  /** Trading cost configuration. If omitted, reads from unified config. */
  costConfig?: { feeRate: number; makerRebate: number; slippageBps: number };
}

interface PaperTrade {
  id: string;
  timestamp: number;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  fee: number;
  pnl: number;
  balance: number;
  /** Whether this trade opened or closed a position */
  tradeType: 'open' | 'close' | 'partial_close';
}

/** Pending limit order waiting for price crossing */
interface PendingLimitOrder {
  orderId: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  symbol: string;
  createdAt: number;
  expiresAt: number; // 默认 24h
}

const DEFAULT_LIMIT_ORDER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class PaperExecutionAdapter implements ExecutionAdapter {
  readonly mode: TradingMode = 'paper';
  private config: Required<Omit<PaperTradingConfig, 'costConfig'>> & { costConfig: { feeRate: number; makerRebate: number; slippageBps: number } };
  private balance: number;
  private position: Position | null = null;
  private tradeHistory: PaperTrade[] = [];
  private orderCounter: number = 0;
  private currentMarketPrice: number = 0;

  /** Phase 6: pending limit order queue */
  private pendingLimitOrders: Map<string, PendingLimitOrder> = new Map();

  constructor(config?: Partial<PaperTradingConfig>) {
    this.config = {
      initialBalance: 10000,
      maxPositionSize: 1.0,
      leverage: 1,
      costConfig: loadConfig('paper').cost,
      ...config,
    };
    this.balance = this.config.initialBalance;
  }

  /** Effective fee rate (taker) derived from cost config */
  private get feeRate(): number {
    return this.config.costConfig.feeRate;
  }

  /** Effective slippage in basis points derived from cost config */
  private get slippageBps(): number {
    return this.config.costConfig.slippageBps;
  }

  /**
   * Update current market price (called by data layer on each tick).
   * Also checks pending limit orders for price-crossing fills.
   */
  updatePrice(price: number): void {
    const previousPrice = this.currentMarketPrice;
    this.currentMarketPrice = price;

    // Phase 6: check pending limit orders for price crossing
    this.checkPendingLimitOrders(previousPrice, price);
  }

  async placeMarketOrder(
    side: 'buy' | 'sell',
    size: number,
    symbol: string,
  ): Promise<OrderResult> {
    const orderId = `paper_${++this.orderCounter}`;
    const slippage =
      safeMul(this.currentMarketPrice, safeDiv(this.slippageBps, 10000));
    const fillPrice =
      side === 'buy'
        ? safeAdd(this.currentMarketPrice, slippage)
        : safeSub(this.currentMarketPrice, slippage);
    const fee = safeMul(safeMul(fillPrice, size), this.feeRate);

    // ── Check if this is a CLOSE of an existing position ──────
    if (this.position && this.position.side !== 'none') {
      const isClosingLong = this.position.side === 'long' && side === 'sell';
      const isClosingShort = this.position.side === 'short' && side === 'buy';

      if (isClosingLong || isClosingShort) {
        // Determine if this is a partial or full close
        const closeSize = Math.min(size, this.position.size);
        const isPartialClose = closeSize < this.position.size;

        // Phase 6: Use decimal utility for PnL calculation
        const pnl = safeSub(
          calculatePnl(
            this.position.entryPrice,
            fillPrice,
            closeSize,
            this.position.side as 'long' | 'short',
          ),
          fee,
        );

        // Scale PnL by leverage
        const leveragedPnl = safeMul(
          safeAdd(
            calculatePnl(
              this.position.entryPrice,
              fillPrice,
              closeSize,
              this.position.side as 'long' | 'short',
            ),
            0, // no extra addition, just for precision
          ),
          this.position.leverage,
        );
        const finalPnl = safeSub(leveragedPnl, fee);

        this.balance = safeAdd(this.balance, finalPnl);

        const tradeType: PaperTrade['tradeType'] = isPartialClose ? 'partial_close' : 'close';

        if (isPartialClose) {
          // Phase 6: Partial close — reduce position size, keep position open
          this.position = {
            ...this.position,
            size: roundTo(this.position.size - closeSize, 8),
          };
          logger.info(
            `[Paper] PARTIAL CLOSE ${side} ${closeSize} @ ${fillPrice.toFixed(2)} | PnL: ${finalPnl.toFixed(2)} | Remaining: ${this.position.size} | Balance: ${this.balance.toFixed(2)}`,
          );
        } else {
          // FIX BUG 5: Fully reset position state on close
          this.position = null;
          logger.info(
            `[Paper] CLOSE ${side} ${closeSize} @ ${fillPrice.toFixed(2)} | PnL: ${finalPnl.toFixed(2)} | Balance: ${this.balance.toFixed(2)}`,
          );
        }

        const trade: PaperTrade = {
          id: orderId,
          timestamp: Date.now(),
          side,
          size: closeSize,
          price: fillPrice,
          fee,
          pnl: finalPnl,
          balance: this.balance,
          tradeType,
        };
        this.tradeHistory.push(trade);

        return {
          success: true,
          orderId,
          filledPrice: fillPrice,
          filledSize: closeSize,
          fee,
          message: `Paper ${tradeType}: ${finalPnl.toFixed(2)} PnL`,
          timestamp: Date.now(),
        };
      }
    }

    // ── Opening new position ──────────────────────────────────
    // FIX BUG 5: Reject if there is already an open position
    // (position flipping not supported).
    if (this.position && this.position.side !== 'none') {
      return {
        success: false,
        message: 'Cannot open new position while one is already open. Close existing position first.',
        timestamp: Date.now(),
      };
    }

    const notional = safeMul(fillPrice, size);
    if (
      safeDiv(notional, this.config.leverage) >
      safeMul(this.balance, this.config.maxPositionSize)
    ) {
      return {
        success: false,
        message: 'Insufficient balance for position',
        timestamp: Date.now(),
      };
    }

    this.position = {
      side: side === 'buy' ? 'long' : 'short',
      size,
      entryPrice: fillPrice,
      leverage: this.config.leverage,
      unrealizedPnl: 0,
      markPrice: fillPrice,
    };
    this.balance = safeSub(this.balance, fee);

    const trade: PaperTrade = {
      id: orderId,
      timestamp: Date.now(),
      side,
      size,
      price: fillPrice,
      fee,
      pnl: 0, // FIX BUG 5: Opening a position has zero realized PnL (fee is separate)
      balance: this.balance,
      tradeType: 'open',
    };
    this.tradeHistory.push(trade);
    logger.info(
      `[Paper] OPEN ${side} ${size} @ ${fillPrice.toFixed(2)} | Fee: ${fee.toFixed(2)} | Balance: ${this.balance.toFixed(2)}`,
    );

    return {
      success: true,
      orderId,
      filledPrice: fillPrice,
      filledSize: size,
      fee,
      message: `Paper order filled`,
      timestamp: Date.now(),
    };
  }

  /**
   * Phase 6: Limit orders are no longer filled immediately.
   * Instead they are placed into a pending order queue and filled
   * when the market price crosses the limit price.
   */
  async placeLimitOrder(
    side: 'buy' | 'sell',
    size: number,
    price: number,
    symbol: string,
  ): Promise<OrderResult> {
    const orderId = `paper_limit_${++this.orderCounter}`;
    const now = Date.now();

    // Check if the limit price would be immediately filled
    // Buy limit fills when market price <= limit price
    // Sell limit fills when market price >= limit price
    const immediatelyFillable =
      (side === 'buy' && this.currentMarketPrice <= price) ||
      (side === 'sell' && this.currentMarketPrice >= price);

    if (immediatelyFillable) {
      // Price already crossed — execute immediately at limit price
      const savedPrice = this.currentMarketPrice;
      this.currentMarketPrice = price;
      const result = await this.placeMarketOrder(side, size, symbol);
      this.currentMarketPrice = savedPrice;
      return result;
    }

    // Place into pending order queue
    const pendingOrder: PendingLimitOrder = {
      orderId,
      side,
      size,
      price,
      symbol,
      createdAt: now,
      expiresAt: now + DEFAULT_LIMIT_ORDER_TTL_MS,
    };

    this.pendingLimitOrders.set(orderId, pendingOrder);

    logger.info(
      `[Paper] LIMIT ORDER QUEUED: ${side} ${size} @ ${price.toFixed(2)} | ID: ${orderId} | Expires: ${new Date(pendingOrder.expiresAt).toISOString()}`,
    );

    return {
      success: true,
      orderId,
      message: `Limit order queued, waiting for price crossing`,
      timestamp: now,
    };
  }

  /**
   * Phase 6: Check pending limit orders for price-crossing fills.
   * Called on every price update.
   */
  private checkPendingLimitOrders(previousPrice: number, currentPrice: number): void {
    if (this.pendingLimitOrders.size === 0) return;
    const now = Date.now();

    const toRemove: string[] = [];

    for (const [orderId, order] of this.pendingLimitOrders) {
      // Remove expired orders
      if (now >= order.expiresAt) {
        logger.info(`[Paper] LIMIT ORDER EXPIRED: ${orderId}`);
        toRemove.push(orderId);
        continue;
      }

      // Check price crossing:
      // Buy limit: price must cross down through the limit price
      //   previousPrice > order.price && currentPrice <= order.price
      // Sell limit: price must cross up through the limit price
      //   previousPrice < order.price && currentPrice >= order.price
      let crossed = false;

      if (order.side === 'buy' && currentPrice <= order.price) {
        crossed = true;
      } else if (order.side === 'sell' && currentPrice >= order.price) {
        crossed = true;
      }

      if (crossed) {
        logger.info(
          `[Paper] LIMIT ORDER TRIGGERED: ${orderId} | ${order.side} ${order.size} @ ${order.price.toFixed(2)} (market: ${currentPrice.toFixed(2)})`,
        );
        toRemove.push(orderId);

        // Execute at the limit price
        const savedPrice = this.currentMarketPrice;
        this.currentMarketPrice = order.price;
        // Fire and forget — limit order fill is async but we handle errors
        this.placeMarketOrder(order.side, order.size, order.symbol).catch((err) => {
          logger.error(`[Paper] Failed to fill limit order ${orderId}: ${err}`);
        });
        this.currentMarketPrice = savedPrice;
      }
    }

    for (const id of toRemove) {
      this.pendingLimitOrders.delete(id);
    }
  }

  /**
   * Phase 6: Partial close — close a percentage of the current position.
   */
  async placePartialClose(symbol: string, closePercent: number): Promise<OrderResult> {
    const position = await this.getPosition(symbol);
    if (!position || position.side === 'none' || position.size === 0) {
      return { success: false, message: 'No position to partially close', timestamp: Date.now() };
    }
    const closeSize = roundTo(safeMul(position.size, closePercent), 8);
    if (closeSize <= 0) {
      return { success: false, message: 'Close size is zero after rounding', timestamp: Date.now() };
    }
    const side: 'buy' | 'sell' = position.side === 'long' ? 'sell' : 'buy';
    return this.placeMarketOrder(side, closeSize, symbol);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    // Phase 6: Support cancelling pending limit orders
    if (this.pendingLimitOrders.has(orderId)) {
      this.pendingLimitOrders.delete(orderId);
      logger.info(`[Paper] LIMIT ORDER CANCELLED: ${orderId}`);
      return true;
    }
    logger.info(`[Paper] Cancel order ${orderId} (no-op in paper mode)`);
    return true;
  }

  async getBalance(): Promise<number> {
    return this.balance;
  }

  async getPosition(symbol: string): Promise<Position | null> {
    if (!this.position || this.position.side === 'none') return null;
    // Update unrealized PnL using decimal utilities
    if (this.currentMarketPrice > 0) {
      this.position.unrealizedPnl = safeMul(
        calculatePnl(
          this.position.entryPrice,
          this.currentMarketPrice,
          this.position.size,
          this.position.side as 'long' | 'short',
        ),
        this.position.leverage,
      );
      this.position.markPrice = this.currentMarketPrice;
    }
    return { ...this.position };
  }

  async close(): Promise<void> {
    // Cancel all pending limit orders on close
    if (this.pendingLimitOrders.size > 0) {
      logger.info(`[Paper] Cancelling ${this.pendingLimitOrders.size} pending limit orders on close`);
      this.pendingLimitOrders.clear();
    }
    logger.info(
      `[Paper] Session closed. Final balance: ${this.balance.toFixed(2)}, Trades: ${this.tradeHistory.length}`,
    );
  }

  /** Get all trade history */
  getTradeHistory(): PaperTrade[] {
    return [...this.tradeHistory];
  }

  /** Get all pending limit orders */
  getPendingLimitOrders(): PendingLimitOrder[] {
    return Array.from(this.pendingLimitOrders.values());
  }

  /** Get performance summary */
  getSummary(): {
    balance: number;
    trades: number;
    winRate: number;
    totalPnl: number;
    maxDrawdown: number;
  } {
    // FIX BUG 5: Only count close/partial_close trades for win rate and trade count.
    // Previously open trades (which had pnl = -fee, always negative)
    // were included, inflating the loss count.
    const closeTrades = this.tradeHistory.filter(
      (t) => t.tradeType === 'close' || t.tradeType === 'partial_close',
    );
    const wins = closeTrades.filter((t) => t.pnl > 0).length;

    // Calculate max drawdown
    let peak = this.config.initialBalance;
    let maxDD = 0;
    for (const t of this.tradeHistory) {
      if (t.balance > peak) peak = t.balance;
      const dd = safeDiv(safeSub(peak, t.balance), peak);
      if (dd > maxDD) maxDD = dd;
    }

    return {
      balance: this.balance,
      trades: closeTrades.length,
      winRate: closeTrades.length > 0 ? safeDiv(wins, closeTrades.length, 4) : 0,
      totalPnl: safeSub(this.balance, this.config.initialBalance),
      maxDrawdown: maxDD,
    };
  }
}
