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
  private isProcessing: boolean = false;

  constructor(
    strategyEngine: StrategyEngineModule,
    llmEngine: LLMAnalysisModule,
    strategy: StrategyType = 'hybrid'
  ) {
    this.strategyEngine = strategyEngine;
    this.llmEngine = llmEngine;
    this.strategy = strategy;

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
   */
  private async handleDataLayerComplete(event: DataLayerCompleteEvent): Promise<void> {
    if (this.isProcessing) {
      logger.warn('[StrategyLayer] Already processing, skipping event');
      return;
    }

    this.isProcessing = true;
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
    } finally {
      this.isProcessing = false;
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
      return {
        type: strategySignal.type === 'long' ? 'long' : strategySignal.type === 'short' ? 'short' : 'hold',
        strength: strategySignal.strength,
        confidence: strategySignal.confidence,
        stopLoss: strategySignal.stopLoss,
        takeProfit: strategySignal.takeProfits?.tp1 ?? 0,
        reasoning: ['LLM decision failed, using strategy signal'],
        riskLevel: 'medium',
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
   */
  private toEnhancedSignalFromLocal(signal: LocalStrategySignal, currentPrice: number): EnhancedSignal {
    return {
      type: signal.type,
      strength: signal.strength,
      confidence: signal.confidence,
      stopLoss: signal.stopLoss ?? 0,
      takeProfit: signal.takeProfit ?? 0,
      riskRewardRatio: signal.riskRewardRatio ?? 0,
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

  /**
   * 取消订阅
   */
  async unsubscribe(): Promise<void> {
    await this.eventBus.unsubscribe(EventChannels.DATA_LAYER_COMPLETE);
    logger.info('[StrategyLayer] Unsubscribed from data events');
  }
}

export default EventDrivenStrategyLayer;
