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
 *
 * FIX BUG 5: Corrected short position PnL to use
 *   (entryPrice - exitPrice) * size * leverage
 * Also fixed: position state is fully reset on close (including markPrice),
 * partial closes are explicitly not supported (full close only),
 * and getSummary() now correctly filters only close trades for win rate.
 */
import { ExecutionAdapter, OrderResult, TradingMode } from './types';
import { Position } from '../events/types';
import logger from '../logger';

export interface PaperTradingConfig {
  initialBalance: number; // default: 10000
  feeRate: number; // default: 0.001 (0.1%)
  slippageBps: number; // default: 5 (0.05%)
  maxPositionSize: number; // default: 1.0
  leverage: number; // default: 1
}

export interface PaperTrade {
  id: string;
  timestamp: number;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  fee: number;
  pnl: number;
  balance: number;
  /** Whether this trade opened or closed a position */
  tradeType: 'open' | 'close';
}

export class PaperExecutionAdapter implements ExecutionAdapter {
  readonly mode: TradingMode = 'paper';
  private config: PaperTradingConfig;
  private balance: number;
  private position: Position | null = null;
  private tradeHistory: PaperTrade[] = [];
  private orderCounter: number = 0;
  private currentMarketPrice: number = 0;

  constructor(config?: Partial<PaperTradingConfig>) {
    this.config = {
      initialBalance: 10000,
      feeRate: 0.001,
      slippageBps: 5,
      maxPositionSize: 1.0,
      leverage: 1,
      ...config,
    };
    this.balance = this.config.initialBalance;
  }

  /** Update current market price (called by data layer on each tick) */
  updatePrice(price: number): void {
    this.currentMarketPrice = price;
  }

  async placeMarketOrder(
    side: 'buy' | 'sell',
    size: number,
    symbol: string,
  ): Promise<OrderResult> {
    const orderId = `paper_${++this.orderCounter}`;
    const slippage =
      this.currentMarketPrice * (this.config.slippageBps / 10000);
    const fillPrice =
      side === 'buy'
        ? this.currentMarketPrice + slippage
        : this.currentMarketPrice - slippage;
    const fee = fillPrice * size * this.config.feeRate;

    // ── Check if this is a CLOSE of an existing position ──────
    if (this.position && this.position.side !== 'none') {
      const isClosingLong = this.position.side === 'long' && side === 'sell';
      const isClosingShort = this.position.side === 'short' && side === 'buy';

      if (isClosingLong || isClosingShort) {
        // FIX BUG 5: Correct PnL calculation for both sides.
        // Long PnL:  (exitPrice - entryPrice) * size * leverage
        // Short PnL: (entryPrice - exitPrice) * size * leverage
        let pnl: number;
        if (this.position.side === 'long') {
          pnl = (fillPrice - this.position.entryPrice) *
            this.position.size *
            this.position.leverage;
        } else {
          // short: profit when price falls
          pnl = (this.position.entryPrice - fillPrice) *
            this.position.size *
            this.position.leverage;
        }
        pnl -= fee; // deduct closing fee

        this.balance += pnl;

        // FIX BUG 5: Fully reset position state on close
        this.position = null;

        const trade: PaperTrade = {
          id: orderId,
          timestamp: Date.now(),
          side,
          size,
          price: fillPrice,
          fee,
          pnl,
          balance: this.balance,
          tradeType: 'close',
        };
        this.tradeHistory.push(trade);
        logger.info(
          `[Paper] CLOSE ${side} ${size} @ ${fillPrice.toFixed(2)} | PnL: ${pnl.toFixed(2)} | Balance: ${this.balance.toFixed(2)}`,
        );

        return {
          success: true,
          orderId,
          filledPrice: fillPrice,
          filledSize: size,
          fee,
          message: `Paper close: ${pnl.toFixed(2)} PnL`,
          timestamp: Date.now(),
        };
      }
    }

    // ── Opening new position ──────────────────────────────────
    // FIX BUG 5: Reject if there is already an open position
    // (partial closes / position flipping not supported).
    if (this.position && this.position.side !== 'none') {
      return {
        success: false,
        message: 'Cannot open new position while one is already open. Close existing position first.',
        timestamp: Date.now(),
      };
    }

    const notional = fillPrice * size;
    if (
      notional / this.config.leverage >
      this.balance * this.config.maxPositionSize
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
    this.balance -= fee;

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

  async placeLimitOrder(
    side: 'buy' | 'sell',
    size: number,
    price: number,
    symbol: string,
  ): Promise<OrderResult> {
    // For paper trading, limit orders fill immediately at limit price (simplification)
    const savedPrice = this.currentMarketPrice;
    this.currentMarketPrice = price;
    const result = await this.placeMarketOrder(side, size, symbol);
    this.currentMarketPrice = savedPrice;
    return result;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    logger.info(`[Paper] Cancel order ${orderId} (no-op in paper mode)`);
    return true;
  }

  async getBalance(): Promise<number> {
    return this.balance;
  }

  async getPosition(symbol: string): Promise<Position | null> {
    if (!this.position || this.position.side === 'none') return null;
    // Update unrealized PnL
    if (this.currentMarketPrice > 0) {
      this.position.unrealizedPnl =
        this.position.side === 'long'
          ? (this.currentMarketPrice - this.position.entryPrice) *
            this.position.size *
            this.position.leverage
          : (this.position.entryPrice - this.currentMarketPrice) *
            this.position.size *
            this.position.leverage;
      this.position.markPrice = this.currentMarketPrice;
    }
    return { ...this.position };
  }

  async close(): Promise<void> {
    logger.info(
      `[Paper] Session closed. Final balance: ${this.balance.toFixed(2)}, Trades: ${this.tradeHistory.length}`,
    );
  }

  /** Get all trade history */
  getTradeHistory(): PaperTrade[] {
    return [...this.tradeHistory];
  }

  /** Get performance summary */
  getSummary(): {
    balance: number;
    trades: number;
    winRate: number;
    totalPnl: number;
    maxDrawdown: number;
  } {
    // FIX BUG 5: Only count close trades for win rate and trade count.
    // Previously open trades (which had pnl = -fee, always negative)
    // were included, inflating the loss count.
    const closeTrades = this.tradeHistory.filter((t) => t.tradeType === 'close');
    const wins = closeTrades.filter((t) => t.pnl > 0).length;

    // Calculate max drawdown
    let peak = this.config.initialBalance;
    let maxDD = 0;
    for (const t of this.tradeHistory) {
      if (t.balance > peak) peak = t.balance;
      const dd = (peak - t.balance) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    return {
      balance: this.balance,
      trades: closeTrades.length,
      winRate: closeTrades.length > 0 ? wins / closeTrades.length : 0,
      totalPnl: this.balance - this.config.initialBalance,
      maxDrawdown: maxDD,
    };
  }
}
