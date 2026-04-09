/**
 * Central Trading Agent 协调器
 * 整合趋势、入场、风险三个 Agent 的输出
 * 
 * 基于 Expert Teams 论文的细粒度任务分解架构
 */

import {
  DecisionContext,
  CompositeDecision,
  CoordinatorConfig,
  DEFAULT_COORDINATOR_CONFIG,
  TrendAgentOutput,
  EntryAgentOutput,
  RiskAgentOutput,
  ActionType,
} from './types';

import { TrendAgent } from './trendAgent';
import { EntryAgent } from './entryAgent';
import { RiskAgent } from './riskAgent';
import { AlignmentAnalyzer } from './alignmentAnalyzer';

import logger from '../../logger';
import { isNonNullObject } from '../../utils/typeGuards';

function isTrendAgentOutput(v: unknown): v is TrendAgentOutput {
  return isNonNullObject(v) && 'trend' in v && 'agentName' in v;
}

function isEntryAgentOutput(v: unknown): v is EntryAgentOutput {
  return isNonNullObject(v) && 'entry' in v && 'agentName' in v;
}

function isRiskAgentOutput(v: unknown): v is RiskAgentOutput {
  return isNonNullObject(v) && 'risk' in v && 'agentName' in v;
}

export class CentralTradingAgent {
  readonly name = 'CentralTradingAgent';
  readonly version = '2.0.0';
  
  private config: CoordinatorConfig;
  
  // 子 Agent
  private trendAgent: TrendAgent;
  private entryAgent: EntryAgent;
  private riskAgent: RiskAgent;
  
  // 对齐分析器
  private alignmentAnalyzer: AlignmentAnalyzer;
  
  constructor(config?: Partial<CoordinatorConfig>) {
    this.config = { ...DEFAULT_COORDINATOR_CONFIG, ...config };
    
    this.trendAgent = new TrendAgent();
    this.entryAgent = new EntryAgent();
    this.riskAgent = new RiskAgent();
    
    this.alignmentAnalyzer = new AlignmentAnalyzer();
  }
  
  /**
   * 主决策方法
   */
  async makeDecision(context: DecisionContext): Promise<CompositeDecision> {
    const startTime = Date.now();
    const agentsUsed: string[] = [];
    
    logger.info('🎯 Central Trading Agent: Making decision...');
    
    // 并行执行所有 Agent
    const [trendResult, entryResult, riskResult] = await Promise.all([
      this.trendAgent.analyze(context),
      this.entryAgent.analyze(context),
      this.riskAgent.analyze(context),
    ]);
    
    // 提取输出
    let trendOutput: TrendAgentOutput | null = null;
    let entryOutput: EntryAgentOutput | null = null;
    let riskOutput: RiskAgentOutput | null = null;
    
    if (trendResult.success && trendResult.data) {
      trendOutput = isTrendAgentOutput(trendResult.data) ? trendResult.data : null;
      agentsUsed.push('TrendAgent');
    }
    
    if (entryResult.success && entryResult.data) {
      entryOutput = isEntryAgentOutput(entryResult.data) ? entryResult.data : null;
      agentsUsed.push('EntryAgent');
    }
    
    if (riskResult.success && riskResult.data) {
      riskOutput = isRiskAgentOutput(riskResult.data) ? riskResult.data : null;
      agentsUsed.push('RiskAgent');
    }
    
    // 综合决策
    const decision = this.combineDecisions(
      trendOutput,
      entryOutput,
      riskOutput,
      context
    );
    
    // 对齐分析
    const alignment = this.alignmentAnalyzer.analyzeAlignment(
      trendOutput,
      entryOutput,
      riskOutput,
      decision.action
    );
    
    // 应用对齐调整
    decision.confidence = Math.max(0.1, Math.min(1, 
      decision.confidence + alignment.confidenceAdjustment
    ));
    decision.alignment = alignment;
    decision.agentsUsed = agentsUsed;
    
    logger.info(`📊 Decision: ${decision.action.toUpperCase()} (confidence: ${(decision.confidence * 100).toFixed(0)}%)`);
    logger.info(`   Alignment: ${(alignment.overallAlignment * 100).toFixed(0)}%`);
    
    return decision;
  }
  
  /**
   * 综合各 Agent 决策
   */
  private combineDecisions(
    trendOutput: TrendAgentOutput | null,
    entryOutput: EntryAgentOutput | null,
    riskOutput: RiskAgentOutput | null,
    context: DecisionContext
  ): CompositeDecision {
    
    const { currentPrice } = context;
    const weights = this.config.agentWeights;
    
    // 计算加权信号
    let buySignal = 0;
    let sellSignal = 0;
    const reasoning: string[] = [];
    
    // 趋势信号
    if (trendOutput) {
      const signal = trendOutput.signalStrength;
      if (signal > 0) {
        buySignal += signal * weights.trend;
      } else {
        sellSignal += Math.abs(signal) * weights.trend;
      }
      reasoning.push(...trendOutput.reasoning.slice(0, 2));
    }
    
    // 入场信号
    if (entryOutput) {
      const signal = entryOutput.signalStrength;
      if (signal > 0) {
        buySignal += signal * weights.entry;
      } else {
        sellSignal += Math.abs(signal) * weights.entry;
      }
      reasoning.push(...entryOutput.reasoning.slice(0, 2));
    }
    
    // 风险调整
    if (riskOutput) {
      // 高风险降低信号
      if (riskOutput.risk.level === 'high') {
        buySignal *= 0.5;
        sellSignal *= 0.5;
        reasoning.push('⚠️ 风险评估: 高风险，降低仓位');
      }
      reasoning.push(...riskOutput.reasoning.slice(0, 2));
    }
    
    // 确定最终行动
    const netSignal = buySignal - sellSignal;
    let action: ActionType = 'hold';
    let confidence = 0.5;
    
    const threshold = 20; // 信号阈值
    
    if (netSignal > threshold) {
      action = 'buy';
      confidence = Math.min(1, netSignal / 100);
    } else if (netSignal < -threshold) {
      action = 'sell';
      confidence = Math.min(1, Math.abs(netSignal) / 100);
    } else {
      confidence = 0.3;
      reasoning.push('信号不明确，建议观望');
    }
    
    // 计算位置参数
    const positionSize = this.calculatePositionSize(
      action,
      riskOutput,
      context
    );
    
    const stopLoss = riskOutput?.risk.stopLoss || 
      this.defaultStopLoss(currentPrice, action);
    
    const takeProfitLevels = riskOutput?.risk.takeProfitLevels || 
      this.defaultTakeProfits(currentPrice, action);
    
    return {
      action,
      positionSize,
      entryPrice: currentPrice,
      stopLoss,
      takeProfitLevels: takeProfitLevels.map(price => ({
        price,
        portion: 0.33,
      })),
      confidence,
      reasoning: reasoning.slice(0, 8),
      alignment: {
        alignments: [],
        overallAlignment: 0,
        consistency: {
          allAgree: false,
          majorityAgree: false,
          conflictDetected: false,
          conflictingAgents: [],
        },
        recommendations: [],
        confidenceAdjustment: 0,
      },
      timestamp: Date.now(),
      agentsUsed: [],
    };
  }
  
  /**
   * 计算仓位大小
   */
  private calculatePositionSize(
    action: ActionType,
    riskOutput: RiskAgentOutput | null,
    context: DecisionContext
  ): number {
    if (action === 'hold') return 0;
    
    // 使用风险评估的建议
    if (riskOutput?.risk.recommendedPositionSize) {
      return Math.min(
        riskOutput.risk.recommendedPositionSize,
        this.config.riskLimits.maxPositionSize
      );
    }
    
    // 默认
    return this.config.riskLimits.maxPositionSize * 0.5;
  }
  
  /**
   * 默认止损
   */
  private defaultStopLoss(currentPrice: number, action: ActionType): number {
    const atr = currentPrice * 0.02; // 简化：2% 作为 ATR
    return action === 'buy' 
      ? currentPrice - atr * 2 
      : currentPrice + atr * 2;
  }
  
  /**
   * 默认止盈
   */
  private defaultTakeProfits(currentPrice: number, action: ActionType): number[] {
    const atr = currentPrice * 0.02;
    
    if (action === 'buy') {
      return [
        currentPrice + atr * 1.5,
        currentPrice + atr * 3,
        currentPrice + atr * 5,
      ];
    } else {
      return [
        currentPrice - atr * 1.5,
        currentPrice - atr * 3,
        currentPrice - atr * 5,
      ];
    }
  }
  
  /**
   * 获取所有 Agent 状态
   */
  getAgentsStatus(): Record<string, any> {
    return {
      trend: this.trendAgent.getStatus(),
      entry: this.entryAgent.getStatus(),
      risk: this.riskAgent.getStatus(),
    };
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<CoordinatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default CentralTradingAgent;
