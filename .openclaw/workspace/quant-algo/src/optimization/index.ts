/**
 * 优化模块入口
 * Adaptive-OPRO 动态 Prompt 优化系统 + Parameter Sensitivity & Walk-Forward
 * 
 * 基于 ATLAS 论文 + López de Prado (2018) methodology
 */

export type {
  OptimizationRecord,
  PerformanceMetrics,
  OptimizationResult,
  OPROConfig,
  OPROStatus,
  OptimizationHistory,
} from './types';

export { calculateScore, hashPrompt, generateOptimizationId, DEFAULT_OPRO_CONFIG } from './types';
export { composePrompt, validatePromptTemplate, REQUIRED_PLACEHOLDERS } from './promptTemplates';
export { AdaptiveOPRO } from './adaptiveOPRO';
export { FeedbackLoop } from './feedbackLoop';

// 单例实例
import { AdaptiveOPRO } from './adaptiveOPRO';
import { FeedbackLoop } from './feedbackLoop';
import { OPROConfig, DEFAULT_OPRO_CONFIG } from './types';

let oproInstance: AdaptiveOPRO | null = null;
let feedbackInstance: FeedbackLoop | null = null;

/**
 * 获取 OPRO 实例
 */
export function getOPRO(config?: Partial<OPROConfig>): AdaptiveOPRO {
  if (!oproInstance) {
    oproInstance = new AdaptiveOPRO(config);
  }
  return oproInstance;
}

/**
 * 获取反馈循环实例
 */
export function getFeedbackLoop(windowSize?: number): FeedbackLoop {
  if (!feedbackInstance) {
    feedbackInstance = new FeedbackLoop(getOPRO(), windowSize);
  }
  return feedbackInstance;
}

/**
 * 重置实例
 */
export function resetInstances(): void {
  oproInstance = null;
  feedbackInstance = null;
}
