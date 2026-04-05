/**
 * Market Intelligence Pipeline 入口
 * 整合技术分析、情绪分析、链上分析的综合情报系统
 * 
 * 基于 ATLAS 和 Expert Teams 论文设计
 */

export * from './types';
export { TechnicalAnalystAgent } from './technicalAnalyst';
export { SentimentAnalystAgent } from './sentimentAnalyst';
export { OnChainAnalystAgent } from './onChainAnalyst';
export { MarketIntelligenceAggregator } from './aggregator';

// 便捷导入
import { MarketIntelligenceAggregator } from './aggregator';
import { AnalysisContext, MarketIntelligenceReport } from './types';

/**
 * Market Intelligence Pipeline 主类
 */
export class MarketIntelligencePipeline {
  private aggregator: MarketIntelligenceAggregator;
  
  constructor() {
    this.aggregator = new MarketIntelligenceAggregator();
  }
  
  /**
   * 运行完整的市场情报分析
   */
  async analyze(context: AnalysisContext): Promise<MarketIntelligenceReport> {
    return this.aggregator.generateReport(context);
  }
  
  /**
   * 获取交易建议摘要
   */
  getTradeSummary(report: MarketIntelligenceReport) {
    return this.aggregator.generateTradeSummary(report);
  }
  
  /**
   * 获取所有 Agent 状态
   */
  getStatus() {
    return this.aggregator.getAgentsStatus();
  }
}

// 默认导出
export default MarketIntelligencePipeline;

// 单例实例
let pipelineInstance: MarketIntelligencePipeline | null = null;

export function getPipeline(): MarketIntelligencePipeline {
  if (!pipelineInstance) {
    pipelineInstance = new MarketIntelligencePipeline();
  }
  return pipelineInstance;
}
