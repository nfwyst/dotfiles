/**
 * 信号融合模块
 * 
 * 职责: 融合策略引擎信号和LLM分析信号
 * 输出: 最终交易决策
 */

import { StrategySignal } from './strategyEngine';
import { LLMTradingSignal } from './llmAnalysis';

export interface FusionResult {
  signal: StrategySignal;
  fusionInfo: {
    originalStrategy: string;
    llmSuggestion: string;
    agreement: 'strong' | 'moderate' | 'weak' | 'conflict';
    adjustment: string;
  };
}

/**
 * 融合策略信号和LLM分析信号
 * 
 * 规则:
 * 1. 方向一致: 增强置信度
 * 2. 方向冲突: 降低置信度并警告
 * 3. LLM建议观望: 轻微调整
 */
export function fuseSignals(
  strategySignal: StrategySignal,
  llmSignal: LLMTradingSignal
): FusionResult {
  const strategyAction = strategySignal.type;
  const llmAction = llmSignal.type;
  
  // 判断一致性
  let agreement: FusionResult['fusionInfo']['agreement'];
  let adjustment: string;
  let finalConfidence = strategySignal.confidence;
  let finalReasoning = [...strategySignal.reasoning];
  
  // 方向完全一致
  if (llmAction === strategyAction) {
    agreement = 'strong';
    finalConfidence = Math.min(0.95, strategySignal.confidence + 0.15);
    adjustment = '置信度+15%';
    
    finalReasoning.push(
      `--- LLM融合分析 ✅ ---`,
      `LLM确认: ${llmAction.toUpperCase()} (置信度${(llmSignal.confidence*100).toFixed(0)}%)`,
      `市场情绪: ${llmSignal.sentiment}`,
      `风险评估: ${llmSignal.riskAssessment}`,
      `仓位建议: ${llmSignal.positionSizing.recommendation}`,
      `建议持仓: ${llmSignal.expectedHolding.min}-${llmSignal.expectedHolding.max}`,
    );
  }
  // LLM建议观望，但策略有方向
  else if (llmAction === 'hold' || llmAction === 'wait') {
    agreement = 'weak';
    finalConfidence = strategySignal.confidence * 0.85;
    adjustment = '置信度-15% (LLM建议观望)';
    
    finalReasoning.push(
      `--- LLM融合分析 ⚠️ ---`,
      `策略信号: ${strategyAction.toUpperCase()}`,
      `LLM建议: 观望`,
      `原因: ${llmSignal.reasoning[0]}`,
      `市场情绪: ${llmSignal.sentiment}`,
      `建议: 可跟随策略但控制仓位`,
    );
  }
  // 方向冲突
  else {
    agreement = 'conflict';
    finalConfidence = strategySignal.confidence * 0.5;
    adjustment = '置信度-50% (方向冲突!)';
    
    finalReasoning.push(
      `--- LLM融合分析 ❌ ---`,
      `⚠️ 严重分歧!`,
      `策略信号: ${strategyAction.toUpperCase()}`,
      `LLM分析: ${llmAction.toUpperCase()}`,
      `市场情绪: ${llmSignal.sentiment}`,
      `风险提示: ${llmSignal.warnings[0]}`,
      `建议: 暂停交易或大幅减仓`,
    );
  }
  
  // 构建最终信号
  const fusedSignal: StrategySignal = {
    ...strategySignal,
    confidence: finalConfidence,
    reasoning: finalReasoning,
    // 如果LLM有更优的SL/TP，可以采纳
    stopLoss: llmSignal.stopLoss?.price || strategySignal.stopLoss,
    takeProfits: strategySignal.takeProfits || {
      tp1: llmSignal.targets.tp1.price,
      tp2: llmSignal.targets.tp2.price,
      tp3: llmSignal.targets.tp3.price,
    },
  };
  
  return {
    signal: fusedSignal,
    fusionInfo: {
      originalStrategy: strategySignal.strategy,
      llmSuggestion: llmAction,
      agreement,
      adjustment,
    },
  };
}

export default fuseSignals;
