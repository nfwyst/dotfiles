/**
 * Central Trading Agent 类型定义
 * 细粒度任务分解架构
 * 
 * 基于 Expert Teams 论文
 */

import type { TechnicalReport, SentimentReport, OnChainReport } from '../marketIntelligence/types';

// ==================== 基础类型 ====================

export type ActionType = 'buy' | 'sell' | 'hold';
export type TrendDirection = 'up' | 'down' | 'sideways';
export type RiskLevel = 'low' | 'medium' | 'high';
export type Urgency = 'high' | 'medium' | 'low';

// ==================== Agent 输出类型 ====================

/**
 * 趋势分析 Agent 输出
 */
export interface TrendAgentOutput {
  agentName: 'TrendAgent';
  
  trend: {
    direction: TrendDirection;
    strength: number;           // 0-100
    persistence: 'strong' | 'moderate' | 'weak';
    reversalRisk: number;       // 0-100
  };
  
  confidence: number;           // 0-1
  reasoning: string[];
  
  // 用于对齐分析
  suggestedAction: ActionType;
  signalStrength: number;       // -100 到 100 (负数=卖出信号)
}

/**
 * 入场时机 Agent 输出
 */
export interface EntryAgentOutput {
  agentName: 'EntryAgent';
  
  entry: {
    action: ActionType;
    priceRange: {
      min: number;
      max: number;
      optimal: number;
    };
    riskRewardRatio: number;
    urgency: Urgency;
    confirmations: string[];
  };
  
  confidence: number;
  reasoning: string[];
  
  // 用于对齐分析
  suggestedAction: ActionType;
  signalStrength: number;
}

/**
 * 风险评估 Agent 输出
 */
export interface RiskAgentOutput {
  agentName: 'RiskAgent';
  
  risk: {
    level: RiskLevel;
    maxDrawdown: number;
    volatilityAssessment: string;
    recommendedPositionSize: number;  // 0-1
    stopLoss: number;
    stopLossPercent?: number;  // 止损百分比
    takeProfitLevels: number[];
    takeProfitPercents?: number[];  // 止盈百分比数组
  };
  
  confidence: number;
  reasoning: string[];
  
  // 用于对齐分析
  suggestedAction: ActionType;  // 可能是 'hold' 如果风险过高
  signalStrength: number;
}

// ==================== 对齐分析 ====================

/**
 * 对齐结果
 */
export interface AlignmentResult {
  agentName: string;
  
  // 信号一致性
  signal: ActionType;
  signalStrength: number;
  agreedWithDecision: boolean;
  
  // 置信度
  confidence: number;
  
  // 贡献度
  contribution: number;         // 0-1, 对最终决策的贡献
  
  // 警告
  warnings: string[];
}

/**
 * 对齐报告
 */
export interface AlignmentReport {
  // 各 Agent 对齐情况
  alignments: AlignmentResult[];
  
  // 整体对齐分数
  overallAlignment: number;     // 0-1
  
  // 一致性评估
  consistency: {
    allAgree: boolean;
    majorityAgree: boolean;
    conflictDetected: boolean;
    conflictingAgents: string[];
  };
  
  // 改进建议
  recommendations: string[];
  
  // 决策可信度调整
  confidenceAdjustment: number; // -0.3 到 +0.1
}

// ==================== 最终决策 ====================

/**
 * 综合决策
 */
export interface CompositeDecision {
  action: ActionType;
  
  // 位置参数
  positionSize: number;
  entryPrice: number;
  stopLoss: number;
  takeProfitLevels: Array<{
    price: number;
    portion: number;
  }>;
  
  // 置信度
  confidence: number;
  
  // 原因
  reasoning: string[];
  
  // 对齐信息
  alignment: AlignmentReport;
  
  // 元数据
  timestamp: number;
  agentsUsed: string[];
}

// ==================== Agent 基础接口 ====================

/**
 * 决策 Agent 接口
 */
export interface DecisionAgent {
  readonly name: string;
  readonly version: string;
  
  analyze(context: DecisionContext): Promise<AgentOutput>;
  getStatus(): AgentStatus;
}

/**
 * 决策上下文
 */
export interface DecisionContext {
  // 市场情报报告
  marketIntelligence: {
    technical: TechnicalReport;
    sentiment?: SentimentReport;
    onChain?: OnChainReport;
  };
  
  // 当前状态
  currentPrice: number;
  balance: number;
  hasPosition: boolean;
  currentPosition?: {
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    unrealizedPnl: number;
  };
  
  // 风险参数
  riskParameters: {
    maxPositionSize: number;
    maxLeverage: number;
    maxDrawdown: number;
  };
  
  // 其他 Agent 输出 (用于协调)
  otherAgentOutputs?: Map<string, AgentOutput>;
}

/**
 * Agent 输出基础
 */
export interface AgentOutput<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  processingTimeMs: number;
}

/**
 * Agent 状态
 */
export interface AgentStatus {
  healthy: boolean;
  lastRun: number;
  errorCount: number;
  avgProcessingTimeMs: number;
}

// ==================== 协调器配置 ====================

/**
 * 协调器配置
 */
export interface CoordinatorConfig {
  // Agent 权重
  agentWeights: {
    trend: number;
    entry: number;
    risk: number;
  };
  
  // 决策阈值
  decisionThresholds: {
    minConfidence: number;      // 最低置信度
    minAlignment: number;       // 最低对齐度
    conflictPenalty: number;    // 冲突惩罚
  };
  
  // 风险限制
  riskLimits: {
    maxPositionSize: number;
    maxLeverage: number;
    maxDrawdown: number;
  };
}

/**
 * 默认配置
 */
export const DEFAULT_COORDINATOR_CONFIG: CoordinatorConfig = {
  agentWeights: {
    trend: 0.35,
    entry: 0.40,
    risk: 0.25,
  },
  decisionThresholds: {
    minConfidence: 0.5,
    minAlignment: 0.6,
    conflictPenalty: 0.2,
  },
  riskLimits: {
    maxPositionSize: 0.3,
    maxLeverage: 50,
    maxDrawdown: 0.15,
  },
};

// ==================== 导出 ====================

export const CTA_VERSION = '2.0.0';
