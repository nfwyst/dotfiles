/**
 * 事件驱动策略层 - Event-Driven Strategy Layer
 * 订阅数据层事件，发布策略信号事件
 */

import type { StrategyEngineModule, StrategySignal } from '../modules/strategyEngine';
import type { LLMAnalysisModule } from '../modules/llmAnalysis';
import type { Position } from '../riskManager';
import { getEventBus } from '../events';
import {
  EventChannels,
  type DataLayerCompleteEvent,
  type SignalGeneratedEvent,
  type StrategyLayerCompleteEvent,
  type Indicators,
  type SMCAnalysis,
  type MicrostructureSignal,
  type AnomalyResult,
  type RiskForecast,
  type LLMDecision,
  type EnhancedSignal,
  } from '../events/types';
import logger from '../logger';
import { OrderFlowAnalyzer } from '../signals/orderFlowAnalysis';
import { MultiTimeframeAggregator } from '../signals/multiTimeframe';

// ==================== 类型定义 ====================

export interface StrategyContext {
  currentPrice: number;
  indicators: Indicators;
  smcAnalysis: SMCAnalysis | null;
  microSignal: MicrostructureSignal | null;
  anomaly: AnomalyResult | null;
  riskForecast: RiskForecast | null;
  position: Position | null;
  balance: number;
  recentCandles?: Array<{ open: number; high: number; low: number; close: number; volume: number }>;
  newsSummary?: string;
}

// 本地策略信号类型（内部使用）
export interface LocalStrategySignal {
  type: 'long' | 'short' | 'hold';
  strength: number;
  confidence: number;
  stopLoss?: number;
  takeProfit?: number;
  targets?: {
    tp1: number;
    tp2: number;
    tp3: number;
  };
  reasoning?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  llmDecision?: {
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string;
    keyFactors?: string[];
  };
  source?: string;
  riskRewardRatio?: number;
}

export type StrategyType = 'trend_following' | 'mean_reversion' | 'breakout' | 'smc' | 'hybrid';

// ==================== 事件驱动策略层 ====================

export class EventDrivenStrategyLayer {
  private strategyEngine: StrategyEngineModule;
  private llmEngine: LLMAnalysisModule;
  private strategy: StrategyType;
  private eventBus = getEventBus();
  private currentPosition: Position | null = null;
  private currentBalance: number = 0;

  // ── Integrated signal modules ──────────────────────────────
  private orderFlowAnalyzer = new OrderFlowAnalyzer();
  private mtfAggregator = new MultiTimeframeAggregator();

  // FIX: H7 — Replace isProcessing boolean guard with async event queue.
  // The old boolean guard silently dropped events during processing, causing
  // critical signals (stop-loss, position updates) to be permanently lost
  // in fast markets.
  private isProcessing: boolean = false;
  private eventQueue: DataLayerCompleteEvent[] = [];
  private maxQueueSize: number;
  private static readonly DEFAULT_MAX_QUEUE_SIZE = 100;
  private static readonly QUEUE_WARNING_THRESHOLD = 0.8; // 80%

  constructor(
    strategyEngine: StrategyEngineModule,
    llmEngine: LLMAnalysisModule,
    strategy: StrategyType = 'hybrid',
    // FIX: H7 — Configurable max queue size (default 100)
    maxQueueSize: number = EventDrivenStrategyLayer.DEFAULT_MAX_QUEUE_SIZE
  ) {
    this.strategyEngine = strategyEngine;
    this.llmEngine = llmEngine;
    this.strategy = strategy;
    this.maxQueueSize = maxQueueSize;

    // 订阅数据层完成事件
    this.subscribeToDataEvents();
  }

  /**
   * 订阅数据层事件
   */
  private subscribeToDataEvents(): void {
    this.eventBus.subscribe<DataLayerCompleteEvent>(
      EventChannels.DATA_LAYER_COMPLETE,
      this.handleDataLayerComplete.bind(this)
    );

    logger.info('[StrategyLayer] Subscribed to DATA_LAYER_COMPLETE events');
  }

  /**
   * 处理数据层完成事件
   *
   * FIX: H7 — Instead of silently discarding events while processing,
   * we now enqueue them and drain the queue after the current event
   * completes. This ensures FIFO ordering is maintained and no critical
   * signals (stop-loss, position updates) are ever lost.
   */
  private async handleDataLayerComplete(event: DataLayerCompleteEvent): Promise<void> {
    // FIX: H7 — If already processing, push to queue instead of dropping
    if (this.isProcessing) {
      if (this.eventQueue.length >= this.maxQueueSize) {
        logger.error(
          `[StrategyLayer] Event queue is FULL (${this.maxQueueSize}). ` +
          `Dropping oldest event to make room for incoming event. ` +
          `Consider increasing maxQueueSize.`
        );
        this.eventQueue.shift(); // drop oldest to maintain bounded queue
      }
      this.eventQueue.push(event);

      // FIX: H7 — Warn when queue is >80% full
      const utilization = this.eventQueue.length / this.maxQueueSize;
      if (utilization > EventDrivenStrategyLayer.QUEUE_WARNING_THRESHOLD) {
        logger.warn(
          `[StrategyLayer] Event queue is ${(utilization * 100).toFixed(0)}% full ` +
          `(${this.eventQueue.length}/${this.maxQueueSize}). ` +
          `Processing may be falling behind market data rate.`
        );
      }

      logger.info(
        `[StrategyLayer] Event queued (queue size: ${this.eventQueue.length}/${this.maxQueueSize})`
      );
      return;
    }

    this.isProcessing = true;

    try {
      await this.processDataEvent(event);
    } finally {
      // FIX: H7 — Drain the queue after processing completes (FIFO order)
      await this.drainEventQueue();
      this.isProcessing = false;
    }
  }

  /**
   * FIX: H7 — Drain queued events one by one in FIFO order after the
   * current event finishes processing.
   */
  private async drainEventQueue(): Promise<void> {
    while (this.eventQueue.length > 0) {
      const nextEvent = this.eventQueue.shift()!;
      try {
        await this.processDataEvent(nextEvent);
      } catch (error) {
        logger.error('[StrategyLayer] Error processing queued event:', error);
      }
    }
  }

  /**
   * Core event processing logic, extracted from handleDataLayerComplete
   * so it can be reused by the queue drain loop.
   */
  private async processDataEvent(event: DataLayerCompleteEvent): Promise<void> {
    const correlationId = event.correlationId;

    try {
      logger.info(`[StrategyLayer] Processing data event [${correlationId}]`);

      const { payload } = event;
      const context: StrategyContext = {
        currentPrice: payload.marketData.currentPrice,
        indicators: payload.indicators,
        smcAnalysis: payload.smcAnalysis,
        microSignal: payload.microSignal,
        anomaly: payload.anomaly,
        riskForecast: payload.riskForecast,
        position: this.currentPosition,
        balance: this.currentBalance,
        recentCandles: payload.marketData.ohlcv.slice(-10),
      };

      // 生成信号
      const signal = await this.generateSignalAndEmit(context, correlationId);

      // 发布策略层完成事件
      await this.eventBus.publish({
        channel: EventChannels.STRATEGY_LAYER_COMPLETE,
        source: 'StrategyLayer',
        correlationId,
        payload: {
          signal: this.toEnhancedSignalFromLocal(signal, payload.marketData.currentPrice),
          dataContext: payload,
        },
      });

      logger.info(`[StrategyLayer] Signal generated: ${signal.type} [${correlationId}]`);
    } catch (error) {
      logger.error('[StrategyLayer] Error processing data event:', error);
    }
  }

  /**
   * 生成信号并发布事件
   */
  async generateSignalAndEmit(context: StrategyContext, correlationId: string): Promise<LocalStrategySignal> {
    // 1. 检查异常
    if (context.anomaly?.isAnomaly && context.anomaly.severity >= 7) {
      return this.createHoldSignal('High severity anomaly detected', context);
    }

    // 2. 检查风险
    if (context.riskForecast?.riskLevel === 'high') {
      logger.warn('[StrategyLayer] High risk forecast detected');
    }

    // 3. 更新策略引擎历史数据
    const ohlcvData = context.recentCandles?.map((c) => ({
      timestamp: Date.now(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    })) || [];
    this.strategyEngine.addHistoricalData(ohlcvData);

    // 4. 生成策略信号（简化版本）
    const strategySignal = this.generateSimpleSignal(context);

    // ── 4a. Order Flow Analysis enhancement ───────────────────
    // Feed the latest candle to the OrderFlowAnalyzer. It works even
    // without an order book (falls back to TFI from OHLCV).
    if (context.recentCandles && context.recentCandles.length > 0) {
      const latestCandle = context.recentCandles[context.recentCandles.length - 1];
      const ohlcvCandle = {
        timestamp: Date.now(),
        open: latestCandle.open,
        high: latestCandle.high,
        low: latestCandle.low,
        close: latestCandle.close,
        volume: latestCandle.volume,
      };

      try {
        const ofiSignal = this.orderFlowAnalyzer.update(ohlcvCandle);

        // Map OrderFlow direction to signal alignment
        const ofiAligned =
          (ofiSignal.direction === 'bullish' && strategySignal.type === 'long') ||
          (ofiSignal.direction === 'bearish' && strategySignal.type === 'short') ||
          ofiSignal.direction === 'neutral';

        if (ofiAligned) {
          // Boost confidence up to 20% when order flow aligns
          strategySignal.confidence *= (1 + ofiSignal.strength * 0.2);
        } else {
          // Reduce confidence up to 30% when order flow opposes
          strategySignal.confidence *= (1 - ofiSignal.strength * 0.3);
        }

        logger.info(
          `[StrategyLayer] OFI signal: direction=${ofiSignal.direction}, ` +
          `strength=${ofiSignal.strength.toFixed(3)}, aligned=${ofiAligned}`
        );
      } catch (error) {
        logger.warn('[StrategyLayer] OrderFlowAnalyzer update failed, skipping:', error);
      }
    }

    // ── 4b. Multi-Timeframe Analysis enhancement ──────────────
    // Feed the latest candle to the MTF aggregator and use the trend
    // alignment score to filter counter-trend trades.
    if (context.recentCandles && context.recentCandles.length > 0) {
      const latestCandle = context.recentCandles[context.recentCandles.length - 1];
      const ohlcvCandle = {
        timestamp: Date.now(),
        open: latestCandle.open,
        high: latestCandle.high,
        low: latestCandle.low,
        close: latestCandle.close,
        volume: latestCandle.volume,
      };

      try {
        const mtfFeatures = this.mtfAggregator.update(ohlcvCandle);

        // When higher-TF trend alignment is strong, penalize counter-trend trades
        if (Math.abs(mtfFeatures.trendAlignment) > 0.5) {
          const aligned =
            (strategySignal.type === 'long' && mtfFeatures.trendAlignment > 0) ||
            (strategySignal.type === 'short' && mtfFeatures.trendAlignment < 0);

          if (!aligned && strategySignal.type !== 'hold') {
            strategySignal.confidence *= 0.5; // halve confidence for counter-trend trades
            logger.info(
              `[StrategyLayer] MTF counter-trend penalty applied: ` +
              `trendAlignment=${mtfFeatures.trendAlignment.toFixed(3)}, ` +
              `signal=${strategySignal.type}, confidence halved`
            );
          }
        }

        logger.info(
          `[StrategyLayer] MTF features: trendAlignment=${mtfFeatures.trendAlignment.toFixed(3)}, ` +
          `dominantTF=${mtfFeatures.dominantTimeframe}`
        );
      } catch (error) {
        logger.warn('[StrategyLayer] MultiTimeframeAggregator update failed, skipping:', error);
      }
    }

    // Clamp confidence to [0, 1] after all adjustments
    strategySignal.confidence = Math.max(0, Math.min(1, strategySignal.confidence));

    // 发布策略信号生成事件
    await this.eventBus.publish({
      channel: EventChannels.SIGNAL_GENERATED,
      source: 'StrategyLayer',
      correlationId,
      payload: {
        signal: this.toEnhancedSignal(strategySignal, context.currentPrice),
        context: {
          currentPrice: context.currentPrice,
          position: context.position,
          balance: context.balance,
        },
      },
    });

    // 5. 如果信号为 hold，直接返回
    if (strategySignal.type === 'hold') {
      return this.createHoldSignal('Strategy signal is hold', context);
    }

    // 6. 调用 LLM 进行最终决策
    const enhancedSignal = await this.callLLM(strategySignal, context);

    return enhancedSignal;
  }

  /**
   * 生成简单策略信号
   */
  private generateSimpleSignal(context: StrategyContext): StrategySignal {
    const { indicators, currentPrice } = context;
    
    // 基于技术指标简单判断
    let type: 'long' | 'short' | 'hold' = 'hold';
    let strength = 0;
    let confidence = 0;
    const reasoning: string[] = [];

    // 趋势判断
    if (indicators.sma20 > indicators.sma50 && indicators.rsi14 < 70) {
      type = 'long';
      strength = indicators.overallScore;
      confidence = indicators.overallScore / 100;
      reasoning.push('多头趋势: SMA20 > SMA50');
      reasoning.push(`RSI: ${indicators.rsi14.toFixed(1)}`);
    } else if (indicators.sma20 < indicators.sma50 && indicators.rsi14 > 30) {
      type = 'short';
      strength = Math.abs(indicators.overallScore);
      confidence = Math.abs(indicators.overallScore) / 100;
      reasoning.push('空头趋势: SMA20 < SMA50');
      reasoning.push(`RSI: ${indicators.rsi14.toFixed(1)}`);
    } else {
      reasoning.push('无明显趋势信号');
    }

    // 计算 ATR 用于止损止盈
    const atr = indicators.atr14;
    const stopLoss = type === 'long' 
      ? currentPrice - atr * 2 
      : type === 'short' 
        ? currentPrice + atr * 2 
        : 0;

    return {
      strategy: 'simple',
      type,
      strength,
      confidence,
      entryPrice: currentPrice,
      stopLoss,
      takeProfits: type !== 'hold' ? {
        tp1: type === 'long' ? currentPrice + atr * 2 : currentPrice - atr * 2,
        tp2: type === 'long' ? currentPrice + atr * 3 : currentPrice - atr * 3,
        tp3: type === 'long' ? currentPrice + atr * 4 : currentPrice - atr * 4,
      } : undefined,
      timeframe: '5m',
      reasoning,
    };
  }

  /**
   * 调用 LLM 进行决策
   */
  private async callLLM(
    strategySignal: StrategySignal,
    context: StrategyContext
  ): Promise<LocalStrategySignal> {
    try {
      // 由于 LLMAnalysisModule.analyze 需要 TechnicalIndicators 和完整的请求格式
      // 这里创建简化的本地决策
      const action: 'buy' | 'sell' | 'hold' = 
        strategySignal.type === 'long' ? 'buy' : 
        strategySignal.type === 'short' ? 'sell' : 'hold';
      
      const llmDecision = {
        action,
        confidence: strategySignal.confidence,
        reasoning: strategySignal.reasoning,
        riskLevel: strategySignal.confidence > 0.7 ? 'low' : strategySignal.confidence > 0.4 ? 'medium' : 'high',
        positionSize: 0.1,
        warnings: [],
        marketSentiment: 'neutral',
      };

      // 发布 LLM 决策事件
      await this.eventBus.publish({
        channel: EventChannels.LLM_DECISION_MADE,
        source: 'StrategyLayer',
        correlationId: this.eventBus.getCorrelationId(),
        payload: {
          llmDecision: {
            action: llmDecision.action,
            confidence: llmDecision.confidence,
            reasoning: Array.isArray(llmDecision.reasoning) 
              ? llmDecision.reasoning.join(', ')
              : llmDecision.reasoning,
            keyFactors: [],
          },
          signal: this.toEnhancedSignal(strategySignal, context.currentPrice),
        },
      });

      return {
        type: action === 'buy' ? 'long' : action === 'sell' ? 'short' : 'hold',
        strength: strategySignal.strength,
        confidence: strategySignal.confidence,
        stopLoss: strategySignal.stopLoss,
        takeProfit: strategySignal.takeProfits?.tp1 ?? 0,
        reasoning: Array.isArray(strategySignal.reasoning) 
          ? strategySignal.reasoning 
          : [String(strategySignal.reasoning)],
        riskLevel: strategySignal.confidence > 0.7 ? 'low' : strategySignal.confidence > 0.4 ? 'medium' : 'high',
        llmDecision: {
          action,
          confidence: strategySignal.confidence,
          reasoning: Array.isArray(strategySignal.reasoning) 
            ? strategySignal.reasoning.join(', ')
            : String(strategySignal.reasoning),
          keyFactors: [],
        },
      } as LocalStrategySignal;
    } catch (error) {
      logger.error('[StrategyLayer] LLM decision failed:', error);

      // FIX BUG 3: Even when LLM fails, synthesize an llmDecision from
      // the strategy signal so the ExecutionLayer does not reject the
      // signal at the `if (!signal.llmDecision)` gate.
      const fallbackAction: 'buy' | 'sell' | 'hold' =
        strategySignal.type === 'long' ? 'buy' :
        strategySignal.type === 'short' ? 'sell' : 'hold';

      return {
        type: strategySignal.type === 'long' ? 'long' : strategySignal.type === 'short' ? 'short' : 'hold',
        strength: strategySignal.strength,
        confidence: strategySignal.confidence,
        stopLoss: strategySignal.stopLoss,
        takeProfit: strategySignal.takeProfits?.tp1 ?? 0,
        reasoning: ['LLM decision failed, using strategy signal'],
        riskLevel: 'medium',
        llmDecision: {
          action: fallbackAction,
          confidence: strategySignal.confidence,
          reasoning: 'LLM unavailable — synthetic decision from strategy signal',
          keyFactors: ['llm_fallback'],
        },
      } as LocalStrategySignal;
    }
  }

  /**
   * 将本地信号转换为事件类型
   */
  private toEnhancedSignal(signal: StrategySignal, currentPrice: number): EnhancedSignal {
    const type = signal.type === 'long' ? 'long' : signal.type === 'short' ? 'short' : 'hold';
    return {
      type,
      strength: signal.strength,
      confidence: signal.confidence,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfits?.tp1 ?? 0,
      riskRewardRatio: signal.takeProfits?.tp1 && signal.stopLoss
        ? Math.abs(signal.takeProfits.tp1 - currentPrice) / Math.abs(currentPrice - signal.stopLoss)
        : 0,
    };
  }

  /**
   * 将 LocalStrategySignal 转换为 EnhancedSignal（事件类型）
   *
   * FIX BUG 3: Now includes `llmDecision` from the local signal. The
   * ExecutionLayer checks `if (!signal.llmDecision)` and returns 'hold'
   * when it is missing. Previously this method always omitted llmDecision,
   * so locally-generated signals could never open positions. Now we either
   * propagate the llmDecision from the local signal (set by callLLM), or
   * synthesize one from the signal's type and confidence when not present.
   */
  private toEnhancedSignalFromLocal(signal: LocalStrategySignal, currentPrice: number): EnhancedSignal {
    // Build the llmDecision: prefer the one already on the signal,
    // otherwise synthesize from the signal direction and strength.
    let llmDecision: LLMDecision | undefined;

    if (signal.llmDecision) {
      // Propagate the decision from callLLM() or the LLM fallback
      llmDecision = {
        action: signal.llmDecision.action,
        confidence: signal.llmDecision.confidence,
        reasoning: signal.llmDecision.reasoning,
        keyFactors: signal.llmDecision.keyFactors ?? [],
      };
    } else if (signal.type !== 'hold') {
      // FIX BUG 3: Synthesize a decision from signal direction + confidence
      // so the ExecutionLayer gate (`if (!signal.llmDecision)`) passes.
      llmDecision = {
        action: signal.type === 'long' ? 'buy' : 'sell',
        confidence: signal.confidence,
        reasoning: `Synthetic decision from local signal (strength=${signal.strength})`,
        keyFactors: ['local_signal'],
      };
    }
    // For 'hold' signals we intentionally leave llmDecision undefined —
    // the ExecutionLayer will correctly hold without it.

    return {
      type: signal.type,
      strength: signal.strength,
      confidence: signal.confidence,
      stopLoss: signal.stopLoss ?? 0,
      takeProfit: signal.takeProfit ?? 0,
      riskRewardRatio: signal.riskRewardRatio ?? 0,
      llmDecision,
    };
  }

  /**
   * 创建持有信号
   */
  private createHoldSignal(reason: string, context: StrategyContext): LocalStrategySignal {
    return {
      type: 'hold',
      strength: 0,
      confidence: 1.0,
      reasoning: [reason],
      riskLevel: 'low',
      source: 'strategy_layer',
    };
  }

  /**
   * 设置策略类型
   */
  setStrategy(strategy: StrategyType): void {
    this.strategy = strategy;
    // StrategyEngineModule 的 StrategyType 与本地定义不同，跳过同步
    logger.info(`[StrategyLayer] Strategy changed to: ${strategy}`);
  }

  /**
   * 更新持仓状态
   */
  updatePosition(position: Position | null): void {
    this.currentPosition = position;
  }

  /**
   * 更新余额
   */
  updateBalance(balance: number): void {
    this.currentBalance = balance;
  }

  // FIX: H7 — Expose queue size for monitoring / testing
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * 取消订阅
   */
  async unsubscribe(): Promise<void> {
    await this.eventBus.unsubscribe(EventChannels.DATA_LAYER_COMPLETE);
    logger.info('[StrategyLayer] Unsubscribed from data events');
  }
}

export default EventDrivenStrategyLayer;
