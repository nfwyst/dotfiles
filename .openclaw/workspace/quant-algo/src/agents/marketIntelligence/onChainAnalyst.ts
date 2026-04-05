/**
 * On-Chain Analyst Agent
 * 链上数据分析 Agent - 鲸鱼活动、交易所流、资金费率
 */

import {
  AnalystAgent,
  AnalysisContext,
  AgentOutput,
  AgentStatus,
  OnChainReport,
  WhaleMovement,
  ONCHAIN_ANALYST_VERSION,
} from './types';

export class OnChainAnalystAgent implements AnalystAgent {
  readonly name = 'OnChainAnalyst';
  readonly version = ONCHAIN_ANALYST_VERSION;
  
  private lastRun: number = 0;
  private errorCount: number = 0;
  private processingTimes: number[] = [];
  
  // 缓存
  private cachedReport: OnChainReport | null = null;
  private cacheExpiry: number = 10 * 60 * 1000; // 10分钟缓存
  
  // 配置
  private config = {
    whaleThreshold: 100, // ETH 数量阈值
    largeTxThreshold: 500000, // USD 阈值
  };
  
  async analyze(context: AnalysisContext): Promise<AgentOutput> {
    const startTime = Date.now();
    
    try {
      // 检查缓存
      if (this.cachedReport && Date.now() - this.lastRun < this.cacheExpiry) {
        return {
          success: true,
          data: this.cachedReport,
          processingTimeMs: 0,
        };
      }
      
      const { symbol, additionalData } = context;
      
      // 尝试获取真实链上数据
      let hasRealData = false;
      let whaleActivity = null;
      let exchangeFlows = null;
      let fundingData = null;
      
      // 尝试从 additionalData 或 API 获取数据
      if (additionalData?.onChainData) {
        hasRealData = true;
        whaleActivity = this.parseWhaleActivity(additionalData.onChainData);
        exchangeFlows = this.parseExchangeFlows(additionalData.onChainData);
        fundingData = this.parseFundingData(additionalData.onChainData);
      }
      
      // 如果没有真实数据，使用 Binance API 获取资金费率和持仓
      if (!hasRealData) {
        try {
          fundingData = await this.fetchFundingData(symbol);
          hasRealData = fundingData !== null;
        } catch (e) {
          // 无法获取数据
        }
      }
      
      // 如果完全没有数据，生成推断报告
      if (!hasRealData) {
        return this.generateInferredReport(context, startTime);
      }
      
      // 综合信号
      const onChainSignal = this.calculateOnChainSignal(
        whaleActivity,
        exchangeFlows,
        fundingData
      );
      
      const report: OnChainReport = {
        timestamp: Date.now(),
        whaleActivity: whaleActivity || {
          movements: [],
          netFlow: 0,
          largeTransactions: 0,
          signal: 'neutral',
        },
        exchangeFlows: exchangeFlows || {
          netInflow: 0,
          netOutflow: 0,
          exchangeReserve: 0,
          reserveChange: 0,
        },
        fundingData: fundingData || {
          fundingRate: 0,
          openInterest: 0,
          longShortRatio: 1,
          liquidations: { long: 0, short: 0, total: 0 },
        },
        onChainSignal,
        agentMetadata: {
          agentName: 'OnChainAnalyst',
          version: this.version,
          processingTimeMs: Date.now() - startTime,
          dataSource: hasRealData ? 'api' : 'inferred',
        },
      };
      
      this.cachedReport = report;
      this.lastRun = Date.now();
      this.processingTimes.push(Date.now() - startTime);
      
      return {
        success: true,
        data: report,
        processingTimeMs: Date.now() - startTime,
      };
      
    } catch (error: any) {
      this.errorCount++;
      return {
        success: false,
        error: error.message,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
  
  /**
   * 从 Binance API 获取资金费率和持仓数据
   */
  private async fetchFundingData(symbol: string): Promise<any> {
    try {
      const exchangeSymbol = symbol.replace('/', '').toUpperCase() + 'USDT';
      
      // 获取资金费率
      const fundingResponse = await fetch(
        `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${exchangeSymbol}&limit=1`
      );
      const fundingData = await fundingResponse.json() as any[];
      
      // 获取持仓量
      const oiResponse = await fetch(
        `https://fapi.binance.com/fapi/v1/openInterest?symbol=${exchangeSymbol}`
      );
      const oiData = await oiResponse.json() as { openInterest: string };
      
      // 获取多空比例
      const ratioResponse = await fetch(
        `https://fapi.binance.com/fapi/v1/globalLongShortAccountRatio?symbol=${exchangeSymbol}&period=5m&limit=1`
      );
      const ratioData = await ratioResponse.json() as any[];
      
      const fundingRate = fundingData[0] ? parseFloat(fundingData[0].fundingRate) : 0;
      const openInterest = parseFloat(oiData.openInterest || '0');
      const longShortRatio = ratioData[0] ? parseFloat(ratioData[0].longShortRatio) : 1;
      
      return {
        fundingRate,
        openInterest,
        longShortRatio,
        liquidations: { long: 0, short: 0, total: 0 },
      };
      
    } catch (e) {
      return null;
    }
  }
  
  /**
   * 生成推断报告 (无真实数据时)
   */
  private generateInferredReport(
    context: AnalysisContext,
    startTime: number
  ): AgentOutput {
    const { additionalData } = context;
    
    // 使用策略共识作为代理信号
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let confidence = 0.2;
    
    if (additionalData?.strategyConsensus) {
      const consensus = additionalData.strategyConsensus;
      if (consensus.type === 'buy' && consensus.strength > 50) {
        signal = 'bullish';
        confidence = 0.3;
      } else if (consensus.type === 'sell' && consensus.strength > 50) {
        signal = 'bearish';
        confidence = 0.3;
      }
    }
    
    const report: OnChainReport = {
      timestamp: Date.now(),
      whaleActivity: {
        movements: [],
        netFlow: 0,
        largeTransactions: 0,
        signal: 'neutral',
      },
      exchangeFlows: {
        netInflow: 0,
        netOutflow: 0,
        exchangeReserve: 0,
        reserveChange: 0,
      },
      fundingData: {
        fundingRate: 0,
        openInterest: 0,
        longShortRatio: 1,
        liquidations: { long: 0, short: 0, total: 0 },
      },
      onChainSignal: {
        direction: signal,
        confidence,
        reasoning: ['无链上数据，使用技术信号推断'],
      },
      agentMetadata: {
        agentName: 'OnChainAnalyst',
        version: this.version,
        processingTimeMs: Date.now() - startTime,
        dataSource: 'inferred',
      },
    };
    
    this.cachedReport = report;
    this.lastRun = Date.now();
    
    return {
      success: true,
      data: report,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  private parseWhaleActivity(data: any): any {
    const movements: WhaleMovement[] = data.whaleMovements || [];
    const largeTransactions = movements.filter(
      (m: WhaleMovement) => m.usdValue > this.config.largeTxThreshold
    ).length;
    
    let netFlow = 0;
    for (const m of movements) {
      netFlow += m.direction === 'in' ? m.amount : -m.amount;
    }
    
    let signal: 'accumulation' | 'distribution' | 'neutral' = 'neutral';
    if (netFlow > 1000) {
      signal = 'accumulation';
    } else if (netFlow < -1000) {
      signal = 'distribution';
    }
    
    return { movements, netFlow, largeTransactions, signal };
  }
  
  private parseExchangeFlows(data: any): any {
    return {
      netInflow: data.netInflow || 0,
      netOutflow: data.netOutflow || 0,
      exchangeReserve: data.exchangeReserve || 0,
      reserveChange: data.reserveChange || 0,
    };
  }
  
  private parseFundingData(data: any): any {
    return {
      fundingRate: data.fundingRate || 0,
      openInterest: data.openInterest || 0,
      longShortRatio: data.longShortRatio || 1,
      liquidations: data.liquidations || { long: 0, short: 0, total: 0 },
    };
  }
  
  private calculateOnChainSignal(
    whaleActivity: any,
    exchangeFlows: any,
    fundingData: any
  ): { direction: 'bullish' | 'bearish' | 'neutral'; confidence: number; reasoning: string[] } {
    const reasoning: string[] = [];
    let bullishScore = 0;
    let bearishScore = 0;
    
    // 鲸鱼活动
    if (whaleActivity) {
      if (whaleActivity.signal === 'accumulation') {
        bullishScore += 0.3;
        reasoning.push(`鲸鱼积累: 净流入 ${whaleActivity.netFlow.toFixed(1)} ETH`);
      } else if (whaleActivity.signal === 'distribution') {
        bearishScore += 0.3;
        reasoning.push(`鲸鱼派发: 净流出 ${Math.abs(whaleActivity.netFlow).toFixed(1)} ETH`);
      }
    }
    
    // 资金费率
    if (fundingData) {
      const fr = fundingData.fundingRate;
      if (fr > 0.0005) {
        bearishScore += 0.2;
        reasoning.push(`资金费率高 (${(fr * 100).toFixed(4)}%): 多头过热`);
      } else if (fr < -0.0005) {
        bullishScore += 0.2;
        reasoning.push(`资金费率负 (${(fr * 100).toFixed(4)}%): 空头过热`);
      }
      
      // 多空比例
      const ratio = fundingData.longShortRatio;
      if (ratio > 1.5) {
        bearishScore += 0.15;
        reasoning.push(`多空比高 (${ratio.toFixed(2)}): 多头拥挤`);
      } else if (ratio < 0.8) {
        bullishScore += 0.15;
        reasoning.push(`多空比低 (${ratio.toFixed(2)}): 空头拥挤`);
      }
    }
    
    // 交易所流
    if (exchangeFlows) {
      const reserveChange = exchangeFlows.reserveChange;
      if (reserveChange < -5) {
        bullishScore += 0.2;
        reasoning.push(`交易所储备下降: 潜在买压`);
      } else if (reserveChange > 5) {
        bearishScore += 0.2;
        reasoning.push(`交易所储备增加: 潜在卖压`);
      }
    }
    
    // 综合判断
    const netScore = bullishScore - bearishScore;
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    
    if (netScore > 0.2) {
      direction = 'bullish';
    } else if (netScore < -0.2) {
      direction = 'bearish';
    }
    
    const confidence = Math.min(0.8, Math.abs(netScore) + 0.2);
    
    return { direction, confidence, reasoning };
  }
  
  getStatus(): AgentStatus {
    return {
      healthy: this.errorCount < 5,
      lastRun: this.lastRun,
      errorCount: this.errorCount,
      avgProcessingTimeMs: this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
        : 0,
    };
  }
}

export default OnChainAnalystAgent;
