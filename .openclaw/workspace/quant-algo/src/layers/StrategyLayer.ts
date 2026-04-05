/**
 * 策略层 - Strategy Layer
 * 负责信号生成、LLM 决策、策略融合
 */

import { StrategyEngineModule, StrategyType, StrategySignal } from '../modules/strategyEngine';
import LLMTradingDecisionEngine, { LLMTradingDecision } from '../llmDecision';
import { config } from '../config';
import { Indicators, SMCAnalysis, MicrostructureSignal, AnomalyResult, RiskForecast, OHLCV } from './DataLayer';
import logger from '../logger';
import { stateManager } from '../stateManager';

export interface StrategyContext {
  currentPrice: number;
  indicators: Indicators;
  smcAnalysis: SMCAnalysis | null;
  microSignal: MicrostructureSignal | null;
  anomaly: AnomalyResult | null;
  riskForecast: RiskForecast | null;
  position: {
    side: 'long' | 'short' | 'none';
    size: number;
    entryPrice: number;
    unrealizedPnl: number;
  } | null;
  balance: number;
  recentCandles: OHLCV[];
  newsSummary?: string;
}

export interface EnhancedSignal {
  type: 'buy' | 'sell' | 'hold' | 'neutral';
  strength: number;
  confidence: number;
  stopLoss: number | null;
  takeProfit: number | null;
  targets: {
    tp1?: number;
    tp2?: number;
    tp3?: number;
  } | null;
  reasoning: string[];
  riskLevel: 'low' | 'medium' | 'high';
  llmDecision: LLMTradingDecision | null;
  source: 'strategy' | 'llm' | 'fusion';
}

export interface DecisionEngine {
  getDecision(signal: EnhancedSignal, context: StrategyContext): Promise<LLMTradingDecision | null>;
}

/**
 * 策略层 - 整合多策略信号和 LLM 决策
 */
export class StrategyLayer {
  private strategyEngine: StrategyEngineModule;
  private llmDecision: LLMTradingDecisionEngine;
  private lastSignal: EnhancedSignal | null = null;
  private lastLLMDecision: LLMTradingDecision | null = null;

  constructor(strategy: StrategyType = 'ocs') {
    this.strategyEngine = new StrategyEngineModule(strategy);
    this.llmDecision = new LLMTradingDecisionEngine();
  }

  /**
   * 生成交易信号
   */
  async generateSignal(context: StrategyContext): Promise<EnhancedSignal> {
    // 1. 检查异常情况
    if (context.anomaly?.isAnomaly && context.anomaly.severity >= 7) {
      logger.warn(`🚨 AI 异常检测: ${context.anomaly.reason} (严重度: ${context.anomaly.severity})`);
      
      if (context.anomaly.anomalyType === 'flash_crash' || context.anomaly.anomalyType === 'pump') {
        return this.createHoldSignal('市场异常，暂停交易', context);
      }
    }

    // 2. 检查风险预测
    if (context.riskForecast?.riskLevel === 'high') {
      logger.warn(`⚠️ AI 风险警告: ${context.riskForecast.warnings.join(', ')}`);
    }

    // 3. 更新策略引擎历史数据
    this.strategyEngine.addHistoricalData(context.recentCandles);

    // 4. 生成策略信号
    const strategyContext = {
      indicators: context.indicators,
      multiTimeframeIndicators: {},
      currentPrice: context.currentPrice,
      balance: context.balance,
      hasPosition: context.position?.side !== 'none',
      currentPosition: context.position?.side !== 'none' ? context.position : undefined,
      marketContext: '',
    };

    const strategySignal = this.strategyEngine.generateSignal(strategyContext);

    // 5. 策略信号为 hold 时直接返回
    if (strategySignal.type === 'hold') {
      logger.debug(`策略信号: hold，跳过 LLM 调用`);
      return this.createHoldSignal('策略信号为hold，观望', context);
    }

    // 6. 调用 LLM 进行最终决策
    const llmSignal = await this.callLLM(strategySignal, context);

    // 7. 保存状态
    this.lastSignal = llmSignal;
    if (llmSignal.llmDecision) {
      this.lastLLMDecision = llmSignal.llmDecision;
      stateManager.updateLLM(llmSignal.llmDecision, context.currentPrice);
    }

    return llmSignal;
  }

  /**
   * 调用 LLM 进行决策
   */
  private async callLLM(
    strategySignal: StrategySignal,
    context: StrategyContext
  ): Promise<EnhancedSignal> {
    // 构建 LLM 策略信号
    const llmStrategySignal = {
      type: strategySignal.type === 'long' ? 'buy' as const : 
            strategySignal.type === 'short' ? 'sell' as const : 'neutral' as const,
      strength: strategySignal.strength,
      confidence: strategySignal.confidence,
      reasoning: strategySignal.reasoning,
      stopLoss: strategySignal.stopLoss,
      takeProfit: strategySignal.takeProfits?.tp2,
      targets: {
        t1: strategySignal.takeProfits?.tp1,
        t2: strategySignal.takeProfits?.tp2,
        t3: strategySignal.takeProfits?.tp3,
      },
      riskRewardRatio: strategySignal.stopLoss && strategySignal.takeProfits?.tp2
        ? Math.abs((strategySignal.takeProfits.tp2 - context.currentPrice) / (strategySignal.stopLoss - context.currentPrice))
        : undefined,
      entryPrice: context.currentPrice,
      strategyName: strategySignal.strategy,
      timeHorizon: 'swing' as const,
    };

    // 构建市场上下文
    const marketContext = {
      currentPrice: context.currentPrice,
      indicators: context.indicators,
      timeframe: config.timeframe,
      position: context.position ? {
        side: context.position.side,
        size: context.position.size,
        entryPrice: context.position.entryPrice,
        unrealizedPnl: context.position.unrealizedPnl,
      } : null,
      balance: context.balance,
      recentCandles: context.recentCandles.slice(-20).map(c => [c.timestamp, c.open, c.high, c.low, c.close, c.volume]),
      news: context.newsSummary,
    };

    // 调用 LLM
    const llmDecision = await this.llmDecision.getTradingDecision(llmStrategySignal, marketContext);

    // LLM 返回 null（信号频繁被丢弃）
    if (llmDecision === null) {
      logger.warn('🛑 LLM 信号被丢弃（过于频繁），返回观望');
      return this.createHoldSignal('LLM 正在处理中，信号过于频繁已丢弃', context);
    }

    // 记录 LLM 决策
    logger.info(`🤖 LLM 决策: ${llmDecision.action.toUpperCase()} | 置信度: ${(llmDecision.confidence * 100).toFixed(0)}% | 风险: ${llmDecision.riskLevel}`);

    // 返回增强信号
    return {
      type: llmDecision.action,
      strength: llmDecision.action === 'hold' ? 0 : Math.round(llmDecision.confidence * 100),
      confidence: llmDecision.confidence,
      stopLoss: strategySignal.stopLoss || null,
      takeProfit: strategySignal.takeProfits?.tp2 || null,
      targets: strategySignal.takeProfits || null,
      reasoning: llmDecision.reasoning,
      riskLevel: llmDecision.riskLevel,
      llmDecision,
      source: 'llm',
    };
  }

  /**
   * 创建 hold 信号
   */
  private createHoldSignal(reason: string, context: StrategyContext): EnhancedSignal {
    return {
      type: 'hold',
      strength: 0,
      confidence: 0,
      stopLoss: null,
      takeProfit: null,
      targets: null,
      reasoning: [reason],
      riskLevel: 'low',
      llmDecision: null,
      source: 'strategy',
    };
  }

  /**
   * 获取最后的信号
   */
  getLastSignal(): EnhancedSignal | null {
    return this.lastSignal;
  }

  /**
   * 获取最后的 LLM 决策
   */
  getLastLLMDecision(): LLMTradingDecision | null {
    return this.lastLLMDecision;
  }

  /**
   * 更新策略类型
   */
  setStrategy(strategy: StrategyType): void {
    this.strategyEngine = new StrategyEngineModule(strategy);
    logger.info(`策略已切换为: ${strategy}`);
  }
}

export default StrategyLayer;
