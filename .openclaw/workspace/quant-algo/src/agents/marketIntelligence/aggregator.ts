/**
 * Market Intelligence Pipeline 聚合器
 * 整合各分析师报告，生成综合市场情报报告
 */

import {
  MarketIntelligenceReport,
  TechnicalReport,
  SentimentReport,
  OnChainReport,
  RiskLevel,
  PIPELINE_VERSION,
} from './types';

import { TechnicalAnalystAgent } from './technicalAnalyst';
import { SentimentAnalystAgent } from './sentimentAnalyst';
import { OnChainAnalystAgent } from './onChainAnalyst';
import { AnalysisContext, AgentOutput } from './types';

export class MarketIntelligenceAggregator {
  private technicalAnalyst: TechnicalAnalystAgent;
  private sentimentAnalyst: SentimentAnalystAgent;
  private onChainAnalyst: OnChainAnalystAgent;
  
  constructor() {
    this.technicalAnalyst = new TechnicalAnalystAgent();
    this.sentimentAnalyst = new SentimentAnalystAgent();
    this.onChainAnalyst = new OnChainAnalystAgent();
  }
  
  /**
   * 生成完整的市场情报报告
   */
  async generateReport(context: AnalysisContext): Promise<MarketIntelligenceReport> {
    const startTime = Date.now();
    const agentsUsed: string[] = [];
    
    // 并行执行所有分析师
    const [technicalResult, sentimentResult, onChainResult] = await Promise.all([
      this.technicalAnalyst.analyze(context),
      this.sentimentAnalyst.analyze(context),
      this.onChainAnalyst.analyze(context),
    ]);
    
    // 解析结果
    let technical: TechnicalReport | undefined;
    let sentiment: SentimentReport | undefined;
    let onChain: OnChainReport | undefined;
    
    if (technicalResult.success && technicalResult.data) {
      technical = technicalResult.data as TechnicalReport;
      agentsUsed.push('TechnicalAnalyst');
    }
    
    if (sentimentResult.success && sentimentResult.data) {
      sentiment = sentimentResult.data as SentimentReport;
      agentsUsed.push('SentimentAnalyst');
    }
    
    if (onChainResult.success && onChainResult.data) {
      onChain = onChainResult.data as OnChainReport;
      agentsUsed.push('OnChainAnalyst');
    }
    
    // 必须有技术分析报告
    if (!technical) {
      throw new Error('Technical analysis failed - cannot generate report');
    }
    
    // 评估市场状态
    const marketState = this.assessMarketState(technical, sentiment, onChain);
    
    // 构建报告
    const report: MarketIntelligenceReport = {
      timestamp: Date.now(),
      symbol: context.symbol,
      technical,
      sentiment,
      onChain,
      dataAvailability: {
        technical: !!technical,
        sentiment: !!sentiment,
        onChain: !!onChain,
      },
      marketState,
      pipelineMetadata: {
        version: PIPELINE_VERSION,
        totalProcessingTimeMs: Date.now() - startTime,
        agentsUsed,
        dataFreshness: 0, // 实时数据
      },
    };
    
    return report;
  }
  
  /**
   * 评估市场状态
   */
  private assessMarketState(
    technical: TechnicalReport,
    sentiment?: SentimentReport,
    onChain?: OnChainReport
  ): {
    regime: 'trending_up' | 'trending_down' | 'ranging' | 'volatile';
    volatility: 'low' | 'medium' | 'high';
    liquidity: 'low' | 'medium' | 'high';
    riskLevel: RiskLevel;
  } {
    // 趋势状态
    let regime: 'trending_up' | 'trending_down' | 'ranging' | 'volatile';
    
    if (technical.trend.direction === 'up' && technical.trend.strength > 60) {
      regime = 'trending_up';
    } else if (technical.trend.direction === 'down' && technical.trend.strength > 60) {
      regime = 'trending_down';
    } else if (technical.volatility.squeeze) {
      regime = 'ranging';
    } else {
      regime = 'ranging';
    }
    
    // 波动率
    let volatility: 'low' | 'medium' | 'high';
    if (technical.volatility.atrPercent > 2) {
      volatility = 'high';
    } else if (technical.volatility.atrPercent < 0.5) {
      volatility = 'low';
    } else {
      volatility = 'medium';
    }
    
    // 如果高波动，覆盖 regime
    if (volatility === 'high' && technical.trend.strength < 40) {
      regime = 'volatile';
    }
    
    // 流动性 (基于成交量)
    let liquidity: 'low' | 'medium' | 'high';
    if (technical.volume.volumeRatio > 1.5) {
      liquidity = 'high';
    } else if (technical.volume.volumeRatio < 0.7) {
      liquidity = 'low';
    } else {
      liquidity = 'medium';
    }
    
    // 风险等级
    let riskLevel: RiskLevel = 'medium';
    
    // 技术面风险
    if (technical.volatility.atrPercent > 2.5) {
      riskLevel = 'high';
    } else if (technical.trend.reversalRisk > 60) {
      riskLevel = 'high';
    } else if (technical.compositeScores.overallScore > 30 || technical.compositeScores.overallScore < -30) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }
    
    // 情绪风险调整
    if (sentiment) {
      const sentimentExtremes = Math.abs(sentiment.overallSentiment.score);
      if (sentimentExtremes > 0.6) {
        riskLevel = 'high'; // 极端情绪
      }
    }
    
    // 链上风险调整
    if (onChain) {
      if (Math.abs(onChain.fundingData.fundingRate) > 0.001) {
        riskLevel = 'high'; // 极端资金费率
      }
    }
    
    return { regime, volatility, liquidity, riskLevel };
  }
  
  /**
   * 生成交易建议摘要
   */
  generateTradeSummary(report: MarketIntelligenceReport): {
    recommendation: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string[];
    keyLevels: { entry: number; stopLoss: number; takeProfit: number[] };
  } {
    const { technical, sentiment, onChain, marketState } = report;
    const reasoning: string[] = [];
    
    // 趋势信号
    let trendSignal = 0;
    if (technical.trend.direction === 'up') {
      trendSignal = technical.trend.strength / 100;
      reasoning.push(`上升趋势 (${technical.trend.strength.toFixed(0)}%)`);
    } else if (technical.trend.direction === 'down') {
      trendSignal = -technical.trend.strength / 100;
      reasoning.push(`下降趋势 (${technical.trend.strength.toFixed(0)}%)`);
    }
    
    // 动量信号
    let momentumSignal = 0;
    if (technical.momentum.rsi.signal === 'oversold') {
      momentumSignal = 0.3;
      reasoning.push(`RSI 超卖 (${technical.momentum.rsi.value.toFixed(1)})`);
    } else if (technical.momentum.rsi.signal === 'overbought') {
      momentumSignal = -0.3;
      reasoning.push(`RSI 超买 (${technical.momentum.rsi.value.toFixed(1)})`);
    }
    
    // 情绪信号
    let sentimentSignal = 0;
    if (sentiment && sentiment.overallSentiment.confidence > 0.5) {
      sentimentSignal = sentiment.overallSentiment.score * 0.5;
      reasoning.push(`市场情绪: ${sentiment.overallSentiment.direction}`);
    }
    
    // 链上信号
    let onChainSignal = 0;
    if (onChain && onChain.onChainSignal.confidence > 0.4) {
      if (onChain.onChainSignal.direction === 'bullish') {
        onChainSignal = onChain.onChainSignal.confidence * 0.3;
      } else if (onChain.onChainSignal.direction === 'bearish') {
        onChainSignal = -onChain.onChainSignal.confidence * 0.3;
      }
      reasoning.push(...onChain.onChainSignal.reasoning.slice(0, 2));
    }
    
    // 综合信号
    const totalSignal = trendSignal + momentumSignal + sentimentSignal + onChainSignal;
    
    let recommendation: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = Math.min(1, Math.abs(totalSignal) + 0.3);
    
    if (totalSignal > 0.3) {
      recommendation = 'buy';
    } else if (totalSignal < -0.3) {
      recommendation = 'sell';
    }
    
    // 风险调整
    if (marketState.riskLevel === 'high' && Math.abs(totalSignal) < 0.5) {
      recommendation = 'hold';
      confidence *= 0.7;
      reasoning.push('高风险环境，保持谨慎');
    }
    
    // 关键价位
    const currentPrice = technical.currentPrice;
    const atr = technical.volatility.atr;
    
    const keyLevels = {
      entry: currentPrice,
      stopLoss: recommendation === 'buy' 
        ? currentPrice - atr * 2
        : currentPrice + atr * 2,
      takeProfit: recommendation === 'buy'
        ? [currentPrice + atr * 1.5, currentPrice + atr * 3, currentPrice + atr * 5]
        : [currentPrice - atr * 1.5, currentPrice - atr * 3, currentPrice - atr * 5],
    };
    
    return { recommendation, confidence, reasoning, keyLevels };
  }
  
  /**
   * 获取所有 Agent 状态
   */
  getAgentsStatus(): Record<string, any> {
    return {
      technical: this.technicalAnalyst.getStatus(),
      sentiment: this.sentimentAnalyst.getStatus(),
      onChain: this.onChainAnalyst.getStatus(),
    };
  }
}

export default MarketIntelligenceAggregator;
