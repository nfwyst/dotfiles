/**
 * 事件驱动策略层 - Event-Driven Strategy Layer
 * 订阅数据层事件，发布策略信号事件
 */

import type { StrategyEngineModule, StrategySignal, StrategyContext as OCSStrategyContext } from '../modules/strategyEngine';
import type { TechnicalIndicators } from '../modules/technicalAnalysis';
import type { LLMAnalysisModule, LLMTradingSignal } from '../modules/llmAnalysis';
import { fuseSignals, updateICObservation } from '../modules/signalFusion';
import { marketStateAdaptor } from '../modules/marketStateAdaptor';
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
  type TakeProfitLevel,
  } from '../events/types';
import { loadConfig } from '../config/config.js';
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

  // OCS 管道所需的最小历史数据条数（Layer3 需要 >50）
  private static readonly OCS_MIN_HISTORY_LENGTH = 60;

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

    // 订阅数据层事件
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

    // 4. 生成策略信号 — 优先使用 OCS Layer1-4 管道，降级到简化信号
    let strategySignal: StrategySignal;
    let signalSource: 'OCS' | 'SimpleSignal';

    try {
      strategySignal = this.tryGenerateOCSSignal(context);
      signalSource = 'OCS';
      logger.info(
        `[StrategyLayer] [OCS] OCS pipeline signal generated: ` +
        `type=${strategySignal.type}, confidence=${strategySignal.confidence.toFixed(3)}, ` +
        `strategy=${strategySignal.strategy}`
      );
    } catch (ocsError) {
      // OCS 管道失败，降级到简化 SMA/RSI 信号
      logger.warn(
        `[StrategyLayer] [Fallback] OCS pipeline failed, falling back to SimpleSignal: ${ocsError}`
      );
      strategySignal = this.generateSimpleSignal(context);
      signalSource = 'SimpleSignal';
      logger.info(
        `[StrategyLayer] [SimpleSignal] Fallback signal generated: ` +
        `type=${strategySignal.type}, confidence=${strategySignal.confidence.toFixed(3)}`
      );
    }

    // ── 4a. Order Flow Analysis enhancement ───────────────────
    // Feed the latest candle to the OrderFlowAnalyzer. It works even
    // without an order book (falls back to TFI from OHLCV).
    if (context.recentCandles && context.recentCandles.length > 0) {
      const latestCandle = context.recentCandles[context.recentCandles.length - 1]!;
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
      const latestCandle = context.recentCandles[context.recentCandles.length - 1]!;
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

    // 5.5. Market state adaptation — adjust confidence & log state
    if (context.recentCandles && context.recentCandles.length >= 30) {
      const closes = context.recentCandles.map(c => c.close);
      const highs = context.recentCandles.map(c => c.high);
      const lows = context.recentCandles.map(c => c.low);
      const state = marketStateAdaptor.detectState(closes, highs, lows);
      const adapted = marketStateAdaptor.getAdaptedParams(state);

      // Apply confidence floor from market state
      if (strategySignal.confidence * 100 < adapted.minConfidence) {
        logger.info(
          `[StrategyLayer] MarketState=${state}: confidence ${(strategySignal.confidence * 100).toFixed(0)}% ` +
          `< minConfidence ${adapted.minConfidence}% — downgrading to hold`
        );
        return this.createHoldSignal(`MarketState ${state}: confidence below threshold`, context);
      }

      // Adjust confidence by position size multiplier (trending → boost, ranging → dampen)
      strategySignal.confidence = Math.min(0.95, strategySignal.confidence * adapted.positionSizeMultiplier);

      logger.info(
        `[StrategyLayer] MarketState=${state}: zThresh=${adapted.zScoreThreshold}, ` +
        `knnThresh=${adapted.knnThreshold}, slMult=${adapted.stopLossMultiplier}, ` +
        `posMult=${adapted.positionSizeMultiplier}`
      );
    }

    // 6. 调用 LLM 进行最终决策（作为 OCS 信号的确认层）
    const enhancedSignal = await this.callLLM(strategySignal, context);

    // 标记信号来源，便于日志追踪
    enhancedSignal.source = signalSource;

    return enhancedSignal;
  }

  // ==================== OCS 管道信号生成 ====================

  /**
   * 尝试通过 OCS Layer1-4 管道生成信号。
   *
   * 前置条件检查:
   * - strategyEngine 必须已初始化
   * - 历史数据必须 >= OCS_MIN_HISTORY_LENGTH (60 bars)
   *
   * 如果前置条件不满足或 OCS 管道抛出异常，调用方应降级到 generateSimpleSignal()。
   */
  private tryGenerateOCSSignal(context: StrategyContext): StrategySignal {
    // 前置条件: strategyEngine 必须存在
    if (!this.strategyEngine) {
      throw new Error('strategyEngine is not initialized');
    }

    // 前置条件: 历史数据充足（OCS Layer3 KNN 需要 >50 条初始化）
    if (
      !context.recentCandles ||
      context.recentCandles.length < EventDrivenStrategyLayer.OCS_MIN_HISTORY_LENGTH
    ) {
      throw new Error(
        `Insufficient OHLCV history for OCS pipeline: ` +
        `got ${context.recentCandles?.length ?? 0}, need >= ${EventDrivenStrategyLayer.OCS_MIN_HISTORY_LENGTH}`
      );
    }

    // 构建 OCS StrategyContext（适配类型差异）
    const ocsContext = this.buildOCSStrategyContext(context);

    // 调用策略引擎的 OCS 管道
    const ocsSignal = this.strategyEngine.generateSignal(ocsContext);

    logger.info(
      `[StrategyLayer] [OCS] Layer1-4 pipeline result: ` +
      `type=${ocsSignal.type}, strategy=${ocsSignal.strategy}, ` +
      `strength=${ocsSignal.strength}, confidence=${ocsSignal.confidence.toFixed(3)}, ` +
      `reasoning=[${ocsSignal.reasoning.join(' | ')}]`
    );

    return ocsSignal;
  }

  /**
   * 从事件驱动层的 StrategyContext 构建 OCS StrategyContext。
   *
   * strategyEngine.generateSignal() 接收的 StrategyContext 需要
   * TechnicalIndicators（完整类型）。OCS 管道实际只使用：
   *   - indicators.atr[14]
   *   - indicators.microstructure
   * 其余字段用 Indicators（简化事件类型）中的对应值填充。
   */
  private buildOCSStrategyContext(context: StrategyContext): OCSStrategyContext {
    const ind = context.indicators;

    // 构建最小可用的 TechnicalIndicators 对象
    // OCS pipeline 实际仅读取 indicators.atr[14] 和 indicators.microstructure
    const technicalIndicators: TechnicalIndicators = {
      timestamp: Date.now(),
      timeframe: '5m',
      symbol: '',
      currentPrice: context.currentPrice,
      priceChange24h: 0,
      priceChangePercent24h: 0,
      sma: { 5: 0, 10: 0, 20: ind.sma20, 50: ind.sma50, 200: ind.sma200 },
      ema: { 12: ind.ema12, 26: ind.ema26, 50: 0 },
      adx: ind.adx,
      diPlus: 0,
      diMinus: 0,
      supertrend: {
        direction: ind.supertrend.direction > 0 ? 'up' : 'down',
        value: ind.supertrend.value,
      },
      rsi: { 6: 0, 14: ind.rsi14, 24: 0 },
      macd: {
        line: ind.macd.macd,
        signal: ind.macd.signal,
        histogram: ind.macd.histogram,
      },
      stochastic: { k: ind.stochastic.k, d: ind.stochastic.d },
      cci: ind.cci,
      williamsR: 0,
      atr: { 14: ind.atr14, 20: 0 },
      bollinger: {
        upper: ind.bollinger.upper,
        middle: ind.bollinger.middle,
        lower: ind.bollinger.lower,
        bandwidth: 0,
        percentB: 0,
      },
      keltner: { upper: 0, middle: 0, lower: 0 },
      obv: ind.obv,
      vwap: ind.vwap,
      volumeSma: { 10: 0, 20: ind.volumeSma20 },
      volumeRatio: 0,
      microstructure: {
        buyingPressure: context.microSignal?.direction === 'bullish' ? context.microSignal.score / 100 :
                        context.microSignal?.direction === 'bearish' ? -(context.microSignal.score / 100) : 0,
        volumeImbalance: 0,
        volatilityClustering: 0,
        priceImpact: 0,
        flowToxicity: 0,
        effectiveSpread: 0,
      },
      scores: {
        trend: ind.trendScore,
        momentum: ind.momentumScore,
        volatility: ind.volatilityScore,
        volume: ind.volumeScore,
        overall: ind.overallScore,
      },
      signals: {
        goldenCross: ind.sma20 > ind.sma50,
        deathCross: ind.sma20 < ind.sma50,
        overbought: ind.rsi14 > 70,
        oversold: ind.rsi14 < 30,
        trendReversal: null,
      },
    };

    return {
      indicators: technicalIndicators,
      multiTimeframeIndicators: {},
      currentPrice: context.currentPrice,
      balance: context.balance,
      hasPosition: context.position !== null && context.position.side !== 'none',
      currentPosition: context.position ? { direction: context.position.side === 'none' ? 'long' as const : context.position.side, entryPrice: context.position.entryPrice, size: context.position.size } : context.position,
      marketContext: `price=${context.currentPrice}`,
    };
  }

  /**
   * 生成简单策略信号（降级方案：SMA20/SMA50 交叉 + RSI）
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

      // Build LLMTradingSignal for fuseSignals (stub — will be real when LLM is wired)
      const llmTradingSignal: LLMTradingSignal = {
        type: action === 'buy' ? 'long' : action === 'sell' ? 'short' : 'hold',
        confidence: strategySignal.confidence,
        urgency: 'moderate',
        entry: { price: context.currentPrice },
        targets: {
          tp1: { price: strategySignal.takeProfits?.tp1 ?? 0, probability: 0.6, rationale: 'strategy' },
          tp2: { price: strategySignal.takeProfits?.tp2 ?? 0, probability: 0.4, rationale: 'strategy' },
          tp3: { price: strategySignal.takeProfits?.tp3 ?? 0, probability: 0.2, rationale: 'strategy' },
        },
        stopLoss: { price: strategySignal.stopLoss, rationale: 'strategy' },
        positionSizing: { recommendation: 'normal', percentage: 10, maxRiskPercent: 2 },
        reasoning: Array.isArray(strategySignal.reasoning) ? strategySignal.reasoning : [String(strategySignal.reasoning)],
        warnings: [],
        alternatives: [],
        expectedHolding: { min: '1h', max: '24h' },
      };

      // Fuse strategy signal with LLM signal using IC-weighted fusion
      const fusionResult = fuseSignals(strategySignal, llmTradingSignal);
      const fusedSignal = fusionResult.signal;

      return {
        type: fusedSignal.type === 'long' ? 'long' : fusedSignal.type === 'short' ? 'short' : 'hold',
        strength: fusedSignal.strength,
        confidence: fusedSignal.confidence,
        stopLoss: fusedSignal.stopLoss,
        targets: fusedSignal.takeProfits,
        reasoning: Array.isArray(fusedSignal.reasoning) 
          ? fusedSignal.reasoning 
          : [String(fusedSignal.reasoning)],
        riskLevel: fusedSignal.confidence > 0.7 ? 'low' : fusedSignal.confidence > 0.4 ? 'medium' : 'high',
        llmDecision: {
          action,
          confidence: fusedSignal.confidence,
          reasoning: Array.isArray(fusedSignal.reasoning) 
            ? fusedSignal.reasoning.join(', ')
            : String(fusedSignal.reasoning),
          keyFactors: [],
        },
      } satisfies LocalStrategySignal;
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
        targets: strategySignal.takeProfits,
        reasoning: ['LLM decision failed, using strategy signal'],
        riskLevel: 'medium',
        llmDecision: {
          action: fallbackAction,
          confidence: strategySignal.confidence,
          reasoning: 'LLM unavailable — synthetic decision from strategy signal',
          keyFactors: ['llm_fallback'],
        },
      } satisfies LocalStrategySignal;
    }
  }

  /**
   * 将本地信号转换为事件类型
   */
  /**
   * Build multi-level TakeProfitLevel[] from StrategySignal.takeProfits + unified config.
   * Mirrors the backtest-engine's partial close structure so the execution layer
   * can apply the same TP1→50%/TP2→50%/TP3→100% logic in live/paper trading.
   */
  private buildTakeProfitLevels(
    takeProfits: { tp1: number; tp2: number; tp3: number } | undefined,
  ): TakeProfitLevel[] | undefined {
    if (!takeProfits) return undefined;
    const cfg = loadConfig('live');
    const levels = cfg.takeProfit.levels;
    // Map each TP price to the corresponding closePercent from unified config
    const tpPrices = [takeProfits.tp1, takeProfits.tp2, takeProfits.tp3];
    return tpPrices.map((price, i) => ({
      price,
      closePercent: levels[i]?.closePercent ?? (i === 2 ? 1.0 : 0.5),
      hit: false,
    }));
  }

  private toEnhancedSignal(signal: StrategySignal, currentPrice: number): EnhancedSignal {
    const type = signal.type === 'long' ? 'long' : signal.type === 'short' ? 'short' : 'hold';
    return {
      type,
      strength: signal.strength,
      confidence: signal.confidence,
      stopLoss: signal.stopLoss,
      takeProfitLevels: this.buildTakeProfitLevels(signal.takeProfits) ?? [],
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

    // Build takeProfitLevels from targets (tp1/tp2/tp3) if present on the local signal
    const takeProfitLevels = signal.targets
      ? this.buildTakeProfitLevels(signal.targets)
      : undefined;

    return {
      type: signal.type,
      strength: signal.strength,
      confidence: signal.confidence,
      stopLoss: signal.stopLoss ?? 0,
      takeProfitLevels: takeProfitLevels ?? [],
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
