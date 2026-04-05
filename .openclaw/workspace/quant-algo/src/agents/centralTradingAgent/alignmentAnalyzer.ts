/**
 * 对齐分析器
 * 分析各 Agent 输出与最终决策的一致性
 * 
 * 基于 Expert Teams 论文的核心发现：
 * "分析输出与下游决策的对齐度是系统性能的关键驱动"
 */

import {
  AlignmentResult,
  AlignmentReport,
  ActionType,
  TrendAgentOutput,
  EntryAgentOutput,
  RiskAgentOutput,
} from './types';

export class AlignmentAnalyzer {
  
  /**
   * 分析所有 Agent 的对齐情况
   */
  analyzeAlignment(
    trendOutput: TrendAgentOutput | null,
    entryOutput: EntryAgentOutput | null,
    riskOutput: RiskAgentOutput | null,
    finalDecision: ActionType
  ): AlignmentReport {
    
    const alignments: AlignmentResult[] = [];
    
    // 分析每个 Agent
    if (trendOutput) {
      alignments.push(this.analyzeAgentAlignment(
        trendOutput.agentName,
        trendOutput.suggestedAction,
        trendOutput.signalStrength,
        trendOutput.confidence,
        finalDecision
      ));
    }
    
    if (entryOutput) {
      alignments.push(this.analyzeAgentAlignment(
        entryOutput.agentName,
        entryOutput.suggestedAction,
        entryOutput.signalStrength,
        entryOutput.confidence,
        finalDecision
      ));
    }
    
    if (riskOutput) {
      alignments.push(this.analyzeAgentAlignment(
        riskOutput.agentName,
        riskOutput.suggestedAction,
        riskOutput.signalStrength,
        riskOutput.confidence,
        finalDecision
      ));
    }
    
    // 计算整体对齐度
    const overallAlignment = this.calculateOverallAlignment(alignments);
    
    // 评估一致性
    const consistency = this.assessConsistency(alignments, finalDecision);
    
    // 生成建议
    const recommendations = this.generateRecommendations(alignments, consistency);
    
    // 计算置信度调整
    const confidenceAdjustment = this.calculateConfidenceAdjustment(
      overallAlignment,
      consistency
    );
    
    return {
      alignments,
      overallAlignment,
      consistency,
      recommendations,
      confidenceAdjustment,
    };
  }
  
  /**
   * 分析单个 Agent 的对齐情况
   */
  private analyzeAgentAlignment(
    agentName: string,
    suggestedAction: ActionType,
    signalStrength: number,
    confidence: number,
    finalDecision: ActionType
  ): AlignmentResult {
    
    // 检查是否与最终决策一致
    const agreedWithDecision = this.checkAgreement(suggestedAction, finalDecision);
    
    // 计算贡献度
    const contribution = this.calculateContribution(
      signalStrength,
      confidence,
      agreedWithDecision
    );
    
    // 生成警告
    const warnings: string[] = [];
    
    if (!agreedWithDecision && confidence > 0.7) {
      warnings.push(`⚠️ ${agentName} 高置信度 (${(confidence * 100).toFixed(0)}%) 信号被忽略`);
    }
    
    if (Math.abs(signalStrength) > 70 && !agreedWithDecision) {
      warnings.push(`⚠️ ${agentName} 强信号 (${signalStrength.toFixed(0)}) 与决策背离`);
    }
    
    return {
      agentName,
      signal: suggestedAction,
      signalStrength,
      agreedWithDecision,
      confidence,
      contribution,
      warnings,
    };
  }
  
  /**
   * 检查信号是否与决策一致
   */
  private checkAgreement(suggestedAction: ActionType, finalDecision: ActionType): boolean {
    // hold 总是"一致"（不干预）
    if (suggestedAction === 'hold') {
      return true;
    }
    
    return suggestedAction === finalDecision;
  }
  
  /**
   * 计算贡献度
   */
  private calculateContribution(
    signalStrength: number,
    confidence: number,
    agreed: boolean
  ): number {
    // 基础贡献 = 信号强度 × 置信度
    let contribution = Math.abs(signalStrength) / 100 * confidence;
    
    // 如果不一致，贡献为负
    if (!agreed) {
      contribution *= -0.5;
    }
    
    return Math.max(0, Math.min(1, contribution));
  }
  
  /**
   * 计算整体对齐度
   */
  private calculateOverallAlignment(alignments: AlignmentResult[]): number {
    if (alignments.length === 0) return 0;
    
    // 计算加权平均
    let totalWeight = 0;
    let weightedAlignment = 0;
    
    for (const alignment of alignments) {
      const weight = alignment.confidence;
      totalWeight += weight;
      
      // 一致 +1，不一致 -1
      const alignmentScore = alignment.agreedWithDecision ? 1 : 0;
      weightedAlignment += alignmentScore * weight;
    }
    
    return totalWeight > 0 ? weightedAlignment / totalWeight : 0;
  }
  
  /**
   * 评估一致性
   */
  private assessConsistency(
    alignments: AlignmentResult[],
    finalDecision: ActionType
  ): AlignmentReport['consistency'] {
    
    const actions = alignments.map(a => a.signal);
    const uniqueActions = [...new Set(actions)];
    
    // 统计
    const buyCount = actions.filter(a => a === 'buy').length;
    const sellCount = actions.filter(a => a === 'sell').length;
    const holdCount = actions.filter(a => a === 'hold').length;
    
    // 检测冲突
    const conflictingAgents: string[] = [];
    
    for (const alignment of alignments) {
      if (!alignment.agreedWithDecision && alignment.confidence > 0.5) {
        conflictingAgents.push(alignment.agentName);
      }
    }
    
    // 判断一致性
    const allAgree = uniqueActions.length <= 1 || 
                     (uniqueActions.length === 2 && uniqueActions.includes('hold'));
    
    const majorityAction = this.getMajorityAction(actions);
    const majorityAgree = majorityAction === finalDecision || finalDecision === 'hold';
    
    const conflictDetected = conflictingAgents.length > 0;
    
    return {
      allAgree,
      majorityAgree,
      conflictDetected,
      conflictingAgents,
    };
  }
  
  /**
   * 获取多数行动
   */
  private getMajorityAction(actions: ActionType[]): ActionType {
    const counts = { buy: 0, sell: 0, hold: 0 };
    
    for (const action of actions) {
      counts[action]++;
    }
    
    let maxCount = 0;
    let majority: ActionType = 'hold';
    
    for (const [action, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        majority = action as ActionType;
      }
    }
    
    return majority;
  }
  
  /**
   * 生成改进建议
   */
  private generateRecommendations(
    alignments: AlignmentResult[],
    consistency: AlignmentReport['consistency']
  ): string[] {
    
    const recommendations: string[] = [];
    
    // 检测被忽略的高置信度信号
    for (const alignment of alignments) {
      if (!alignment.agreedWithDecision && alignment.confidence > 0.7) {
        recommendations.push(
          `考虑 ${alignment.agentName} 的信号 (${alignment.signal})`
        );
      }
    }
    
    // 检测冲突
    if (consistency.conflictDetected) {
      recommendations.push(
        `Agent 冲突: ${consistency.conflictingAgents.join(', ')} - 考虑降低置信度`
      );
    }
    
    // 低对齐度警告
    const avgConfidence = alignments.reduce((sum, a) => sum + a.confidence, 0) / alignments.length;
    if (avgConfidence < 0.5) {
      recommendations.push('所有 Agent 置信度较低，考虑观望');
    }
    
    // 完全一致时的积极信号
    if (consistency.allAgree && avgConfidence > 0.7) {
      recommendations.push('✓ 所有 Agent 一致且高置信度，信号可靠');
    }
    
    return recommendations;
  }
  
  /**
   * 计算置信度调整
   */
  private calculateConfidenceAdjustment(
    overallAlignment: number,
    consistency: AlignmentReport['consistency']
  ): number {
    
    // 基础调整
    let adjustment = 0;
    
    // 高对齐度增加置信度
    if (overallAlignment > 0.8) {
      adjustment += 0.1;
    } else if (overallAlignment < 0.5) {
      adjustment -= 0.2;
    }
    
    // 冲突惩罚
    if (consistency.conflictDetected) {
      adjustment -= 0.15;
    }
    
    // 完全一致奖励
    if (consistency.allAgree) {
      adjustment += 0.05;
    }
    
    // 限制范围
    return Math.max(-0.3, Math.min(0.1, adjustment));
  }
  
  /**
   * 格式化对齐报告
   */
  formatReport(report: AlignmentReport): string {
    const lines: string[] = [];
    
    lines.push('=== 对齐分析报告 ===');
    lines.push(`整体对齐度: ${(report.overallAlignment * 100).toFixed(1)}%`);
    lines.push('');
    
    lines.push('各 Agent 对齐情况:');
    for (const alignment of report.alignments) {
      const status = alignment.agreedWithDecision ? '✓' : '✗';
      lines.push(
        `  ${status} ${alignment.agentName}: ${alignment.signal} (${(alignment.confidence * 100).toFixed(0)}%)`
      );
      
      for (const warning of alignment.warnings) {
        lines.push(`    ${warning}`);
      }
    }
    
    lines.push('');
    lines.push(`一致性: ${report.consistency.allAgree ? '完全一致' : report.consistency.majorityAgree ? '多数一致' : '存在分歧'}`);
    
    if (report.consistency.conflictDetected) {
      lines.push(`冲突 Agent: ${report.consistency.conflictingAgents.join(', ')}`);
    }
    
    lines.push('');
    if (report.recommendations.length > 0) {
      lines.push('建议:');
      for (const rec of report.recommendations) {
        lines.push(`  • ${rec}`);
      }
    }
    
    lines.push(`置信度调整: ${report.confidenceAdjustment > 0 ? '+' : ''}${(report.confidenceAdjustment * 100).toFixed(0)}%`);
    
    return lines.join('\n');
  }
}

export default AlignmentAnalyzer;
