/**
 * 事件驱动执行层 - Event-Driven Execution Layer
 * 订阅策略层事件，执行交易并发布执行结果事件
 */

import type { ExchangeManager } from '../exchange';
import type { RiskManager } from '../riskManager';
import type { NotificationManager } from '../notifier';
// FIX M1: Import from refactored state module instead of god object
import type { StateManager } from '../state';
// FIX H7: Import canonical Position from events/types (single source of truth)
import type { Position } from '../events/types';
import type { ExecutionAdapter } from '../feeds/types';
import { getEventBus } from '../events';
import {
  EventChannels,
  type StrategyLayerCompleteEvent,
  type OrderExecutedEvent,
  type PositionUpdatedEvent,
  type ExecutionLayerCompleteEvent,
  type EnhancedSignal,
  type OHLCV,
} from '../events/types';
import logger from '../logger';
import { HMMRegimeDetector } from '../risk/hmmRegimeDetector';
import { TailRiskModel } from '../risk/tailRiskModel';
import { RiskGuardChain } from '../risk/RiskGuardChain';
import { CircuitBreakerGuard, DailyLossLimitGuard } from '../risk/guards';
import type { TradingContext } from '../risk/types';
import { loadConfig } from '../config/loader.js';

// ==================== 类型定义 ====================

export interface ExecutionContext {
  currentPrice: number;
  balance: number;
  position: Position | null;
  signal: EnhancedSignal;
}

export interface ExecutionResult {
  success: boolean;
  action: 'open_long' | 'open_short' | 'close_long' | 'close_short' | 'update_sltp' | 'hold' | 'error';
  message: string;
  pnl?: number;
  size?: number;
  price?: number;
}

// ==================== 事件驱动执行层 ====================

export class EventDrivenExecutionLayer {
  private exchange: ExchangeManager;
  private riskManager: RiskManager;
  private notificationManager: NotificationManager;
  private stateManager: StateManager;
  private eventBus = getEventBus();

  // FIX BUG 1: Optional execution adapter injected by Runtime.
  // When set, all order operations route through this adapter instead
  // of the exchange directly (used for paper / backtest modes).
  private executionAdapter: ExecutionAdapter | undefined;

  // ── Integrated risk modules ────────────────────────────────
  private hmmDetector = new HMMRegimeDetector();
  private tailRisk = new TailRiskModel();
  private lastClose: number = 0; // track previous close for TailRisk return computation
  private hmmWarmedUp: boolean = false;
  private tailRiskWarmedUp: boolean = false;

  // ── S3 FIX: RiskGuardChain with CircuitBreaker + DailyLossLimit ──
  private riskGuardChain: RiskGuardChain;
  private dailyPnl: number = 0;
  private peakBalance: number = 0;
  private barsSinceLastTrade: number = 0;
  private barsSinceEntry: number = 0;
  private consecutiveLosses: number = 0;

  // FIX BUG 4: Replace isProcessing boolean guard with a proper async mutex.
  // The old pattern had a race condition: after drainEventQueue() saw an
  // empty queue and returned, but before isProcessing was set to false,
  // a new event could be pushed to the queue. Then isProcessing becomes
  // false with an un-drained event sitting in the queue forever.
  //
  // The fix uses a lock-chain pattern: each incoming event appends itself
  // to a promise chain so events are guaranteed to execute sequentially
  // with no gaps.
  private eventQueue: StrategyLayerCompleteEvent[] = [];
  private maxQueueSize: number;
  private static readonly DEFAULT_MAX_QUEUE_SIZE = 100;
  private static readonly QUEUE_WARNING_THRESHOLD = 0.8; // 80%
  private processingLock: Promise<void> = Promise.resolve();
  private isProcessing: boolean = false;

  constructor(
    exchange: ExchangeManager,
    riskManager: RiskManager,
    notificationManager: NotificationManager,
    stateManager: StateManager,
    // FIX: H7 — Configurable max queue size (default 100)
    maxQueueSize: number = EventDrivenExecutionLayer.DEFAULT_MAX_QUEUE_SIZE
  ) {
    this.exchange = exchange;
    this.riskManager = riskManager;
    this.notificationManager = notificationManager;
    this.stateManager = stateManager;
    this.maxQueueSize = maxQueueSize;


    // S3 FIX: Initialize RiskGuardChain with basic guards
    this.riskGuardChain = new RiskGuardChain()
      .addGuard(new CircuitBreakerGuard(10, 1500, 4000))  // 10% drawdown threshold
      .addGuard(new DailyLossLimitGuard(4));               // 4% daily loss limit
    // 订阅策略层完成事件
    this.subscribeToStrategyEvents();
  }

  // ----------------------------------------------------------------
  // FIX BUG 1: setExecutionAdapter — injected by Runtime
  // ----------------------------------------------------------------

  /**
   * Set the execution adapter used for order routing.
   * When an adapter is set, all order operations (open/close) and
   * balance/position queries are routed through the adapter instead
   * of the raw exchange. This enables paper-trading and backtesting
   * with identical strategy/execution logic.
   */
  setExecutionAdapter(adapter: ExecutionAdapter): void {
    this.executionAdapter = adapter;
    logger.info(`[ExecutionLayer] ExecutionAdapter set (mode=${adapter.mode})`);
  }

  /**
   * 订阅策略层事件
   */
  private subscribeToStrategyEvents(): void {
    this.eventBus.subscribe<StrategyLayerCompleteEvent>(
      EventChannels.STRATEGY_LAYER_COMPLETE,
      this.handleStrategyLayerComplete.bind(this)
    );

    logger.info('[ExecutionLayer] Subscribed to STRATEGY_LAYER_COMPLETE events');
  }

  /**
   * 处理策略层完成事件
   *
   * FIX BUG 4: Uses a promise-chain mutex to guarantee strict FIFO
   * sequential processing with no race-condition gaps. Each incoming
   * event chains onto the previous processing promise so there is
   * never a window where isProcessing is false while events remain
   * in the queue.
   */
  private handleStrategyLayerComplete(event: StrategyLayerCompleteEvent): void {
    // Bounded queue: if we're backed up, drop oldest to make room
    if (this.isProcessing) {
      if (this.eventQueue.length >= this.maxQueueSize) {
        logger.error(
          `[ExecutionLayer] Event queue is FULL (${this.maxQueueSize}). ` +
          `Dropping oldest event to make room for incoming event. ` +
          `Consider increasing maxQueueSize.`
        );
        this.eventQueue.shift(); // drop oldest to maintain bounded queue
      }
      this.eventQueue.push(event);

      // Warn when queue is >80% full
      const utilization = this.eventQueue.length / this.maxQueueSize;
      if (utilization > EventDrivenExecutionLayer.QUEUE_WARNING_THRESHOLD) {
        logger.warn(
          `[ExecutionLayer] Event queue is ${(utilization * 100).toFixed(0)}% full ` +
          `(${this.eventQueue.length}/${this.maxQueueSize}). ` +
          `Processing may be falling behind signal generation rate.`
        );
      }

      logger.info(
        `[ExecutionLayer] Event queued (queue size: ${this.eventQueue.length}/${this.maxQueueSize})`
      );
      return;
    }

    // FIX BUG 4: Mark as processing BEFORE chaining onto the lock.
    // This prevents a new event from starting a second chain while
    // the first is still being set up.
    this.isProcessing = true;

    // Chain onto the processing lock to guarantee sequential execution.
    this.processingLock = this.processingLock.then(async () => {
      try {
        await this.processStrategyEvent(event);
      } catch (error) {
        logger.error('[ExecutionLayer] Error processing strategy event:', error);
      }
      // Drain any queued events under the same lock
      await this.drainEventQueue();
      this.isProcessing = false;
    });
  }

  /**
   * FIX BUG 4: Drain queued events one by one in FIFO order.
   * Called within the processing lock so no races are possible.
   */
  private async drainEventQueue(): Promise<void> {
    while (this.eventQueue.length > 0) {
      const nextEvent = this.eventQueue.shift()!;
      try {
        await this.processStrategyEvent(nextEvent);
      } catch (error) {
        logger.error('[ExecutionLayer] Error processing queued event:', error);
      }
    }
  }

  /**
   * Core event processing logic, extracted from handleStrategyLayerComplete
   * so it can be reused by the queue drain loop.
   */
  private async processStrategyEvent(event: StrategyLayerCompleteEvent): Promise<void> {
    const correlationId = event.correlationId;

    try {
      logger.info(`[ExecutionLayer] Processing strategy event [${correlationId}]`);

      const { payload } = event;
      const currentPrice = payload.dataContext.marketData.currentPrice;

      // FIX BUG 1: Route balance/position queries through adapter when set
      const balance = await this.getBalanceFromSource();
      const position = await this.getFormattedPosition();

      // ── Feed OHLCV data to HMM and TailRisk models ─────────
      this.feedRiskModels(payload.dataContext.marketData.ohlcv);

      const context: ExecutionContext = {
        currentPrice,
        balance,
        position,
        signal: payload.signal,
      };

      // 执行交易
      const result = await this.executeAndEmit(context, correlationId);

      // 发布执行层完成事件
      await this.eventBus.publish({
        channel: EventChannels.EXECUTION_LAYER_COMPLETE,
        source: 'ExecutionLayer',
        correlationId,
        payload: {
          result,
          signal: payload.signal,
        },
      });

      logger.info(`[ExecutionLayer] Execution complete: ${result.action} [${correlationId}]`);
    } catch (error) {
      logger.error('[ExecutionLayer] Error processing strategy event:', error);

      // 发布错误事件
      await this.eventBus.publish({
        channel: EventChannels.SYSTEM_ERROR,
        source: 'ExecutionLayer',
        correlationId,
        payload: {
          error: String(error),
          recoverable: true,
          layer: 'ExecutionLayer',
        },
      });
    }
  }

  // ── FIX BUG 1: Adapter-aware balance/position helpers ─────────

  /**
   * Get balance from the execution adapter if set, otherwise from the exchange.
   */
  private async getBalanceFromSource(): Promise<number> {
    if (this.executionAdapter) {
      return this.executionAdapter.getBalance();
    }
    const fullBalance = await this.exchange.getFullBalance();
    return fullBalance.free;
  }

  // ── Risk model data feed ─────────────────────────────────────

  /**
   * Feed the latest OHLCV data to HMM and TailRisk models.
   */
  private feedRiskModels(ohlcv: OHLCV[]): void {
    if (ohlcv.length === 0) return;

    try {
      if (!this.hmmWarmedUp && ohlcv.length >= 2) {
        const regimeResult = this.hmmDetector.batchUpdate(ohlcv);
        this.hmmWarmedUp = true;
        logger.info(
          `[ExecutionLayer] HMM batch initialized with ${ohlcv.length} candles ` +
          `(trained=${regimeResult.isTrained}, regime=${regimeResult.label})`
        );
      } else if (this.hmmWarmedUp) {
        const latestCandle = ohlcv[ohlcv.length - 1]!;
        this.hmmDetector.update(latestCandle);
      }
    } catch (error) {
      logger.warn('[ExecutionLayer] HMM regime detector feed failed:', error);
    }

    try {
      if (!this.tailRiskWarmedUp && ohlcv.length >= 2) {
        this.tailRisk.batchUpdate(ohlcv);
        this.lastClose = ohlcv[ohlcv.length - 1]!.close;
        this.tailRiskWarmedUp = true;
        logger.info(
          `[ExecutionLayer] TailRisk batch initialized with ${ohlcv.length} candles`
        );
      } else if (this.tailRiskWarmedUp) {
        const latestCandle = ohlcv[ohlcv.length - 1]!;
        if (this.lastClose > 0) {
          this.tailRisk.update(latestCandle, this.lastClose);
        }
        this.lastClose = latestCandle.close;
      }
    } catch (error) {
      logger.warn('[ExecutionLayer] TailRisk model feed failed:', error);
    }
  }

  /**
   * 执行交易并发布事件
   */
  async executeAndEmit(context: ExecutionContext, correlationId: string): Promise<ExecutionResult> {
    const { signal, currentPrice, balance, position } = context;

    // 1. 紧急检查
    const emergencyCheck = await this.checkEmergencyExit(position, currentPrice);
    if (emergencyCheck) {
      const result = await this.closePosition(position!, 'Emergency exit triggered');
      await this.emitOrderExecuted(result, correlationId);
      return result;
    }

    // 2. 如果有持仓，管理持仓
    if (position) {
      const manageResult = await this.managePosition(context);
      if (manageResult.action !== 'hold') {
        await this.emitOrderExecuted(manageResult, correlationId);
        return manageResult;
      }
    }

    // 3. 检查是否可以开新仓
    if (!this.riskManager.canOpenPosition(balance, position)) {
      return this.createHoldResult('Risk limit reached, cannot open new position');
    }

    // 4. 检查信号强度和置信度
    if (signal.strength < 50 || signal.confidence < 0.6) {
      return this.createHoldResult(`Signal too weak: strength=${signal.strength}, confidence=${signal.confidence}`);
    }

    // 5. 检查 LLM 决策
    if (!signal.llmDecision) {
      return this.createHoldResult('No LLM decision available');
    }


    // S3 FIX: Evaluate RiskGuardChain before opening new position
    const riskContext: TradingContext = {
      currentPrice,
      entryPrice: position?.entryPrice ?? currentPrice,
      balance,
      unrealizedPnl: position?.unrealizedPnl ?? 0,
      dailyPnl: this.dailyPnl,
      dailyTrades: 0,
      consecutiveLosses: this.consecutiveLosses,
      barsSinceEntry: this.barsSinceEntry,
      barsSinceLastTrade: this.barsSinceLastTrade,
      peakBalance: this.peakBalance > 0 ? this.peakBalance : balance,
      currentDrawdownPercent: this.peakBalance > 0 ? ((this.peakBalance - balance) / this.peakBalance) * 100 : 0,
    };
    const riskDecision = this.riskGuardChain.evaluate(riskContext);
    if (riskDecision.action === 'reject') {
      return this.createHoldResult(`Risk guard rejected: ${riskDecision.reason}`);
    }
    // 6. 开新仓
    const result = await this.openPosition(signal, currentPrice, balance);
    await this.emitOrderExecuted(result, correlationId);
    return result;
  }

  /**
   * 发布订单执行事件
   */
  private async emitOrderExecuted(result: ExecutionResult, correlationId: string): Promise<void> {
    await this.eventBus.publish({
      channel: EventChannels.ORDER_EXECUTED,
      source: 'ExecutionLayer',
      correlationId,
      payload: {
        action: result.action === 'error' ? 'hold' : result.action as 'open_long' | 'open_short' | 'close_long' | 'close_short' | 'update_sltp' | 'hold',
        success: result.success,
        price: result.price,
        size: result.size,
        message: result.message,
        pnl: result.pnl,
      },
    });
  }

  /**
   * 发布持仓更新事件
   */
  private async emitPositionUpdated(
    position: Position | null,
    previousPosition: Position | null,
    correlationId: string
  ): Promise<void> {
    await this.eventBus.publish({
      channel: EventChannels.POSITION_UPDATED,
      source: 'ExecutionLayer',
      correlationId,
      payload: {
        position: position!,
        previousPosition,
      },
    });
  }

  // ==================== 内部方法 ====================

  private async checkEmergencyExit(position: Position | null, currentPrice: number): Promise<boolean> {
    if (!position) return false;

    const pnlPercent = position.side === 'long'
      ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
      : ((position.entryPrice - currentPrice) / position.entryPrice) * 100;

    return pnlPercent < -10;
  }

  private async managePosition(context: ExecutionContext): Promise<ExecutionResult> {
    const { position, signal, currentPrice, balance } = context;
    if (!position) return this.createHoldResult('No position to manage');

    const shouldClose = this.checkStopLossTakeProfit(position, currentPrice);
    if (shouldClose) {
      return this.closePosition(position, 'Stop loss or take profit triggered');
    }

    if (this.shouldCloseOnSignalReversal(position, signal)) {
      return this.closePosition(position, 'Signal reversal detected');
    }

    if (signal.stopLoss && signal.takeProfit) {
      const updateResult = await this.updateStopLossTakeProfit(position, signal);
      if (updateResult) {
        return updateResult;
      }
    }

    return this.createHoldResult('Position maintained');
  }

  private checkStopLossTakeProfit(position: Position, currentPrice: number): boolean {
    if (position.side === 'long') {
      if (position.stopLoss && currentPrice <= position.stopLoss) return true;
      if (position.takeProfit && currentPrice >= position.takeProfit) return true;
    } else {
      if (position.stopLoss && currentPrice >= position.stopLoss) return true;
      if (position.takeProfit && currentPrice <= position.takeProfit) return true;
    }
    return false;
  }

  private shouldCloseOnSignalReversal(position: Position, signal: EnhancedSignal): boolean {
    if (signal.type === 'hold') return false;
    if (position.side === 'long' && signal.type === 'short') return true;
    if (position.side === 'short' && signal.type === 'long') return true;
    return false;
  }

  private async updateStopLossTakeProfit(
    position: Position,
    signal: EnhancedSignal
  ): Promise<ExecutionResult | null> {
    const slChanged = signal.stopLoss && signal.stopLoss !== position.stopLoss;
    const tpChanged = signal.takeProfit && signal.takeProfit !== position.takeProfit;

    if (!slChanged && !tpChanged) return null;

    position.stopLoss = signal.stopLoss || position.stopLoss;
    position.takeProfit = signal.takeProfit || position.takeProfit;

    this.stateManager.updatePosition({
      side: position.side,
      size: position.size,
      entryPrice: position.entryPrice,
      leverage: position.leverage,
      unrealizedPnl: position.unrealizedPnl,
      markPrice: position.markPrice,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
    });

    await this.notificationManager.notifyAlert(
      'SL/TP Updated',
      `SL=${position.stopLoss}, TP=${position.takeProfit}`
    );

    return {
      success: true,
      action: 'update_sltp',
      message: `Stop loss: ${position.stopLoss}, Take profit: ${position.takeProfit}`,
    };
  }

  /**
   * FIX BUG 1 + H7: Routes order execution through the adapter when set,
   * otherwise falls back to the exchange directly.
   */
  private async openPosition(
    signal: EnhancedSignal,
    currentPrice: number,
    balance: number
  ): Promise<ExecutionResult> {
    try {
      const side = signal.llmDecision?.action || 'hold';
      const leverage = loadConfig('live').position.leverage;
      let positionSize = this.riskManager.calculatePositionSize(
        balance,
        signal.stopLoss || currentPrice * 0.02,
        currentPrice
      );

      // ── HMM Regime-based position scaling ───────────────────
      try {
        const regime = this.hmmDetector.getCurrentRegime();
        if (regime && regime.isTrained) {
          if (regime.label === 'CRISIS') {
            logger.warn(
              `[ExecutionLayer] HMM: CRISIS regime detected (prob=${regime.probabilities[2]?.toFixed(2)}) ` +
              `-- reducing position by 75%`
            );
            positionSize *= 0.25;
          } else if (regime.label === 'HIGH_VOL') {
            logger.warn(
              `[ExecutionLayer] HMM: HIGH_VOL regime detected (prob=${regime.probabilities[1]?.toFixed(2)}) ` +
              `-- reducing position by 50%`
            );
            positionSize *= 0.5;
          } else {
            logger.info(
              `[ExecutionLayer] HMM: LOW_VOL regime (scaling=${regime.positionScaling.toFixed(2)})`
            );
          }
        } else {
          logger.info(
            '[ExecutionLayer] HMM regime detector not yet trained ' +
            `(observations=${regime.observationCount}/${100}) -- using full position size`
          );
        }
      } catch (error) {
        logger.warn('[ExecutionLayer] HMM regime check failed, proceeding without adjustment:', error);
      }

      // ── Tail Risk position scaling ──────────────────────────
      try {
        const riskMetrics = this.tailRisk.getCurrentRisk();
        if (riskMetrics.tailRatio > 2.0) {
          logger.warn(
            `[ExecutionLayer] Tail risk elevated (ratio: ${riskMetrics.tailRatio.toFixed(2)}, ` +
            `cfVaR: ${(riskMetrics.cfVaR * 100).toFixed(2)}%, ` +
            `ES: ${(riskMetrics.expectedShortfall * 100).toFixed(2)}%) -- cutting size by 50%`
          );
          positionSize *= 0.5;
        } else if (riskMetrics.tailRatio > 1.5) {
          logger.info(
            `[ExecutionLayer] Tail risk moderate (ratio: ${riskMetrics.tailRatio.toFixed(2)}) ` +
            `-- cutting size by 25%`
          );
          positionSize *= 0.75;
        } else {
          logger.info(
            `[ExecutionLayer] Tail risk normal (ratio: ${riskMetrics.tailRatio.toFixed(2)})`
          );
        }
      } catch (error) {
        logger.warn('[ExecutionLayer] TailRisk check failed, proceeding without adjustment:', error);
      }

      let result: ExecutionResult;
      const symbol = loadConfig('live').symbol.binance;

      if (side === 'buy') {
        // FIX BUG 1: Route through adapter when set
        if (this.executionAdapter) {
          const orderResult = await this.executionAdapter.placeMarketOrder('buy', positionSize, symbol);
          if (!orderResult.success) {
            return {
              success: false,
              action: 'error',
              message: `Adapter order failed: ${orderResult.message}`,
            };
          }
          result = {
            success: true,
            action: 'open_long',
            message: `Opened long position: ${positionSize} @ ${orderResult.filledPrice}`,
            size: orderResult.filledSize ?? positionSize,
            price: orderResult.filledPrice,
          };
        } else {
          const order = await this.exchange.openLong(
            positionSize,
            signal.stopLoss,
            signal.takeProfit
          );
          await this.exchange.setLeverage(leverage);
          result = {
            success: true,
            action: 'open_long',
            message: `Opened long position: ${positionSize} @ ${order.price}`,
            size: positionSize,
            price: order.price,
          };
        }
      } else if (side === 'sell') {
        // FIX BUG 1: Route through adapter when set
        if (this.executionAdapter) {
          const orderResult = await this.executionAdapter.placeMarketOrder('sell', positionSize, symbol);
          if (!orderResult.success) {
            return {
              success: false,
              action: 'error',
              message: `Adapter order failed: ${orderResult.message}`,
            };
          }
          result = {
            success: true,
            action: 'open_short',
            message: `Opened short position: ${positionSize} @ ${orderResult.filledPrice}`,
            size: orderResult.filledSize ?? positionSize,
            price: orderResult.filledPrice,
          };
        } else {
          const order = await this.exchange.openShort(
            positionSize,
            signal.stopLoss,
            signal.takeProfit
          );
          await this.exchange.setLeverage(leverage);
          result = {
            success: true,
            action: 'open_short',
            message: `Opened short position: ${positionSize} @ ${order.price}`,
            size: positionSize,
            price: order.price,
          };
        }
      } else {
        return this.createHoldResult('LLM decision is hold');
      }

      // 发送通知
      await this.notificationManager.notifyOpenPosition(
        side === 'buy' ? 'long' : 'short',
        result.price!,
        positionSize,
        leverage
      );

      // FIX H7: Save canonical Position directly
      this.stateManager.updatePosition({
        side: side === 'buy' ? 'long' : 'short',
        size: positionSize,
        entryPrice: result.price!,
        leverage,
        unrealizedPnl: 0,
        markPrice: result.price,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
      });

      return result;
    } catch (error) {
      logger.error('[ExecutionLayer] Failed to open position:', error);
      return {
        success: false,
        action: 'error',
        message: `Failed to open position: ${error}`,
      };
    }
  }

  async closePosition(position: Position, reason: string): Promise<ExecutionResult> {
    try {
      let pnl = 0;
      let fillPrice: number;

      if (position.side === 'long' || position.side === 'short') {
        // FIX BUG 1: Route close through adapter when set
        if (this.executionAdapter) {
          const closeSide = position.side === 'long' ? 'sell' : 'buy';
          const symbol = loadConfig('live').symbol.binance;
          const orderResult = await this.executionAdapter.placeMarketOrder(closeSide, position.size, symbol);
          if (!orderResult.success) {
            return {
              success: false,
              action: 'error',
              message: `Adapter close failed: ${orderResult.message}`,
            };
          }
          fillPrice = orderResult.filledPrice ?? 0;
        } else {
          const order = await this.exchange.closePosition(position.side, position.size);
          fillPrice = order.price;
        }

        pnl = position.side === 'long'
          ? (fillPrice - position.entryPrice) * position.size
          : (position.entryPrice - fillPrice) * position.size;
      } else {
        return this.createHoldResult('No position to close');
      }

      const action = position.side === 'long' ? 'close_long' : 'close_short';
      const result: ExecutionResult = {
        success: true,
        action,
        message: `Closed ${position.side} position: ${reason}. PnL: ${pnl.toFixed(2)} USDT`,
        pnl,
        size: position.size,
        price: fillPrice,
      };

      // 发送通知
      await this.notificationManager.notifyClosePosition(
        position.side,
        position.entryPrice,
        fillPrice,
        pnl,
        reason
      );

      // 清除持仓状态
      this.stateManager.updatePosition(null);

      return result;
    } catch (error) {
      logger.error('[ExecutionLayer] Failed to close position:', error);
      return {
        success: false,
        action: 'error',
        message: `Failed to close position: ${error}`,
      };
    }
  }

  /**
   * FIX BUG 1: Route position queries through adapter when set.
   */
  async getFormattedPosition(): Promise<Position | null> {
    if (this.executionAdapter) {
      const symbol = loadConfig('live').symbol.binance;
      return this.executionAdapter.getPosition(symbol);
    }
    const state = this.stateManager.getState();
    const statePosition = state.trading.position;
    if (!statePosition) return null;
    return statePosition;
  }

  private createHoldResult(message: string): ExecutionResult {
    return {
      success: true,
      action: 'hold',
      message,
    };
  }

  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * 取消订阅
   */
  async unsubscribe(): Promise<void> {
    await this.eventBus.unsubscribe(EventChannels.STRATEGY_LAYER_COMPLETE);
    logger.info('[ExecutionLayer] Unsubscribed from strategy events');
  }
}

export default EventDrivenExecutionLayer;
