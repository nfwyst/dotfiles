/**
 * Adaptive-OPRO 类型定义
 * 基于 ATLAS 论文的动态 Prompt 优化机制
 */

// ==================== 核心类型 ====================

/**
 * 优化记录
 */
export interface OptimizationRecord {
  id: string;
  timestamp: number;
  
  // Prompt 版本
  promptHash: string;
  promptContent: string;
  
  // 性能评分
  score: number;              // 0-100
  roi: number;                // 实际 ROI
  
  // 变更信息
  changeSummary: string;
  expectedImpact: string;
  
  // 窗口信息
  windowStart: number;
  windowEnd: number;
  tradesInWindow: number;
}

/**
 * 性能指标 (用于优化决策)
 */
export interface PerformanceMetrics {
  // 收益指标
  roi: number;
  dailyReturns: number[];
  cumulativeReturns: number[];
  
  // 风险指标
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  
  // 交易指标
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  avgHoldTime: number;
  
  // 时间范围
  windowStart: number;
  windowEnd: number;
}

/**
 * 优化结果
 */
export interface OptimizationResult {
  success: boolean;
  
  // 新 Prompt
  newPrompt?: string;
  promptHash?: string;
  
  // 变更信息
  diagnosis?: string;
  proposedChanges?: string;
  expectedImpact?: string;
  
  // 元数据
  confidence?: number;
  processingTimeMs?: number;
  
  // 错误信息
  error?: string;
}

/**
 * Prompt 模板
 */
export interface PromptTemplate {
  // 静态部分 (可优化)
  staticInstructions: string;
  
  // 动态部分模板 (固定)
  dynamicTemplate: string;
  
  // 占位符定义
  placeholders: Record<string, string>;
  
  // 元数据
  version: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 优化器配置
 */
export interface OPROConfig {
  // 评估窗口
  windowSize: number;         // 默认 5 天
  
  // 评分映射
  scoreMapping: {
    zeroRoiScore: number;     // ROI=0 时的分数，默认 50
    roiMultiplier: number;    // ROI 系数，默认 250
  };
  
  // 优化触发
  minTradesForOptimization: number;  // 最少交易次数
  optimizationInterval: number;      // 优化间隔 (毫秒)
  
  // LLM 配置
  optimizerModel: string;
  optimizerTemperature: number;
  maxTokens: number;
  
  // 安全限制
  maxPromptLength: number;
  preservePlaceholders: boolean;
}

/**
 * 优化历史
 */
export interface OptimizationHistory {
  records: OptimizationRecord[];
  
  // 统计
  totalOptimizations: number;
  avgScoreImprovement: number;
  bestScore: number;
  worstScore: number;
  
  // 时间范围
  firstOptimization: number;
  lastOptimization: number;
}

/**
 * 优化器状态
 */
export interface OPROStatus {
  healthy: boolean;
  lastOptimization: number;
  totalOptimizations: number;
  currentPromptHash: string;
  avgProcessingTimeMs: number;
  
  // 性能趋势
  recentScores: number[];
  scoreTrend: 'improving' | 'declining' | 'stable';
}

// ==================== 辅助函数 ====================

/**
 * 默认配置
 */
export const DEFAULT_OPRO_CONFIG: OPROConfig = {
  windowSize: 1,  // 降低：1 天窗口（原 5 天）
  scoreMapping: {
    zeroRoiScore: 50,
    roiMultiplier: 250,
  },
  minTradesForOptimization: 3,
  optimizationInterval: 6 * 60 * 60 * 1000, // 降低：6 小时（原 5 天）
  optimizerModel: 'deepseek-chat',
  optimizerTemperature: 0.3,
  maxTokens: 2000,
  maxPromptLength: 4000,
  preservePlaceholders: true,
};

/**
 * 计算 ROI 到评分的映射
 * 基于 ATLAS 论文: s = clip[0,100](50 + 250 * ROI)
 */
export function calculateScore(roi: number, config: OPROConfig): number {
  const { zeroRoiScore, roiMultiplier } = config.scoreMapping;
  const score = zeroRoiScore + roiMultiplier * roi;
  return Math.max(0, Math.min(100, score));
}

/**
 * 生成 Prompt 哈希
 */
export function hashPrompt(prompt: string): string {
  // 简化版哈希
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * 生成唯一 ID
 */
export function generateOptimizationId(): string {
  return `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== 导出 ====================

export const OPRO_VERSION = '2.0.0';
