/**
 * LLM 交易决策模块 - 使用统一 LLMClient
 * 核心机制：缓存、并发控制、强制刷新、智能重试、降级
 */

import { TechnicalIndicators } from './modules/technicalAnalysis';
import logger from './logger';
import { llmClient, llmConfigManager, LLMProvider } from './ai/index';

export interface LLMTradingDecision {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string[];
  riskLevel: 'low' | 'medium' | 'high';
  positionSize: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeHorizon: 'scalp' | 'swing' | 'position';
  warnings: string[];
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentConfidence: number;
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  technicalAnalysis: {
    trend: string;
    momentum: string;
    volatility: string;
    volume: string;
    overall: string;
  };
  newsAnalysis: {
    summary: string;
    impact: 'positive' | 'negative' | 'neutral';
    keyEvents: string[];
  };
  alternativeScenarios: string[];
  timestamp: string;
  thinking?: string;
}

export interface StrategySignalInput {
  type: 'buy' | 'sell' | 'neutral';
  strength: number;
  confidence: number;
  reasoning: string[];
  stopLoss?: number;
  takeProfit?: number;
  targets?: {
    t1?: number;
    t2?: number;
    t3?: number;
  };
  riskRewardRatio?: number;
  entryPrice?: number;
  strategyName?: string;
  timeHorizon?: 'scalp' | 'swing' | 'position';
}

export interface MarketContext {
  currentPrice: number;
  indicators: TechnicalIndicators;
  timeframe: string;
  position: {
    side: 'long' | 'short' | 'none';
    size: number;
    entryPrice: number;
    unrealizedPnl: number;
  } | null;
  balance: number;
  recentCandles: number[][];
  news?: string;
}

export class LLMTradingDecisionEngine {
  // 核心状态管理
  private lastDecision: LLMTradingDecision | null = null;
  private lastDecisionTime: number = 0;
  private lastDecisionPrice: number = 0;
  private minInterval: number = 60000; // 60秒最小间隔
  private priceChangeThreshold: number = 0.005; // 0.5%价格变动阈值
  
  // 并发控制
  private isProcessing: boolean = false;
  
  // 新闻缓存
  private cachedNews: string = '';
  private lastNewsFetchTime: number = 0;

  constructor() {
    const availableProviders = llmConfigManager.getAvailableProviders();
    if (availableProviders.length === 0) {
      logger.warn('⚠️ 未设置任何 LLM API Key，LLM 模块将无法调用云端模型');
    } else {
      logger.info(`✅ LLM 配置已加载，可用供应商: ${availableProviders.join(', ')}`);
    }
  }

  /**
   * 获取最终交易决策
   * 核心机制：缓存、并发控制、强制刷新、智能重试、降级
   */
  async getTradingDecision(
    strategySignal: StrategySignalInput,
    marketContext: MarketContext
  ): Promise<LLMTradingDecision | null> {
    // 并发控制：如果正在处理，直接丢弃
    if (this.isProcessing) {
      logger.warn('⏳ LLM 正在处理前一个请求，本次信号过于频繁，已丢弃');
      return null;
    }

    const now = Date.now();
    const currentPrice = marketContext.currentPrice;

    // 检查是否强制刷新
    const shouldForceRefresh = this.checkForceRefresh(currentPrice, marketContext);

    // 使用缓存（如果不强制刷新且间隔未到）
    if (!shouldForceRefresh && now - this.lastDecisionTime < this.minInterval && this.lastDecision) {
      logger.debug('使用缓存的LLM决策');
      return this.lastDecision;
    }

    if (shouldForceRefresh) {
      logger.info(`🔄 强制刷新LLM决策: ${shouldForceRefresh.reason}`);
    }

    // 如果没有可用的 LLM 配置，直接返回 null
    if (!llmConfigManager.isProviderAvailable(llmConfigManager.getDefaultProvider())) {
      logger.info('📝 无 LLM API Key，跳过 LLM 调用');
      return null;
    }

    // 加锁，开始处理
    this.isProcessing = true;

    try {
      const news = marketContext.news || await this.fetchMarketNews();
      const prompt = this.generatePrompt(strategySignal, marketContext, news);

      logger.debug(`🤖 调用 LLM (${llmConfigManager.getDefaultProvider()})...`);
      
      // 使用统一的 LLMClient，启用降级
      const response = await llmClient.chat({
        messages: [
          { role: 'system', content: '你是专业加密货币交易分析师。分析市场数据并输出JSON格式交易决策。' },
          { role: 'user', content: prompt }
        ],
        model: 'deepseek-reasoner', // 使用推理模型
        temperature: 0.2,
        maxTokens: 500,
        timeout: 3000,
        fallbackEnabled: true, // 启用降级
        useCache: true,
      });

      const content = response.content;
      const thinking = response.thinking || '';

      // 解析 JSON
      try {
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const validated = this.validateDecision(parsed);
          
          logger.info(`✅ LLM 调用成功 [${response.provider}]`);
          
          const decision = {
            ...validated,
            newsSummary: news,
            timestamp: new Date().toISOString(),
            thinking,
          } as LLMTradingDecision;

          // 保存报告
          this.saveLLMReport(decision, currentPrice);

          // 更新缓存
          this.lastDecision = decision;
          this.lastDecisionTime = now;
          this.lastDecisionPrice = currentPrice;

          return decision;
        }
      } catch (parseError) {
        logger.error('JSON 解析失败:', parseError);
      }

      return null;
    } catch (error: any) {
      logger.error('LLM 调用异常:', error.message);
      return null;
    } finally {
      // 解锁
      this.isProcessing = false;
    }
  }

  /**
   * 检查是否需要强制刷新缓存
   */
  private checkForceRefresh(
    currentPrice: number,
    marketContext: MarketContext
  ): { shouldRefresh: boolean; reason: string } | null {
    const now = Date.now();
    const timeSinceLast = now - this.lastDecisionTime;

    // 决策已过期(>10分钟)
    if (!this.lastDecision || timeSinceLast > 600000) {
      return { shouldRefresh: true, reason: '决策已过期(>10分钟)' };
    }

    // 价格变动超过阈值(0.5%)
    if (this.lastDecisionPrice > 0) {
      const priceChange = Math.abs(currentPrice - this.lastDecisionPrice) / this.lastDecisionPrice;
      if (priceChange > this.priceChangeThreshold) {
        return { shouldRefresh: true, reason: `价格变动${(priceChange * 100).toFixed(2)}%` };
      }
    }

    // 突破布林带
    const ind = marketContext.indicators;
    if (ind?.bollinger?.lower && currentPrice < ind.bollinger.lower) {
      return { shouldRefresh: true, reason: '跌破布林带下轨' };
    }
    if (ind?.bollinger?.upper && currentPrice > ind.bollinger.upper) {
      return { shouldRefresh: true, reason: '突破布林带上轨' };
    }

    return null;
  }

  /**
   * 获取市场新闻
   */
  private async fetchMarketNews(): Promise<string> {
    const now = Date.now();
    if (now - this.lastNewsFetchTime < 600000 && this.cachedNews) {
      return this.cachedNews;
    }

    try {
      const news = 'ETH市场新闻获取功能';
      this.cachedNews = news;
      this.lastNewsFetchTime = now;
      return news;
    } catch {
      return '新闻获取失败';
    }
  }

  /**
   * 验证决策格式
   */
  private validateDecision(parsed: any): Partial<LLMTradingDecision> {
    const validActions = ['buy', 'sell', 'hold'];
    const validRisks = ['low', 'medium', 'high'];
    
    return {
      action: validActions.includes(parsed.action) ? parsed.action : 'hold',
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : ['无详细理由'],
      riskLevel: validRisks.includes(parsed.riskLevel) ? parsed.riskLevel : 'medium',
      positionSize: Math.max(0, Math.min(1, parsed.positionSize || 0.7)),
      timeHorizon: parsed.timeHorizon || 'swing',
      marketSentiment: parsed.marketSentiment || 'neutral',
      sentimentConfidence: parsed.sentimentConfidence || 0.6,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      keyLevels: parsed.keyLevels || { support: [], resistance: [] },
      technicalAnalysis: parsed.technicalAnalysis || {
        trend: '中性', momentum: '中性', volatility: '中等', volume: '正常', overall: '观望',
      },
      newsAnalysis: parsed.newsAnalysis || {
        summary: '无新闻分析', impact: 'neutral', keyEvents: [],
      },
      alternativeScenarios: Array.isArray(parsed.alternativeScenarios) ? parsed.alternativeScenarios : [],
    };
  }

  /**
   * 生成提示词
   */
  private generatePrompt(
    signal: StrategySignalInput,
    context: MarketContext,
    news: string
  ): string {
    const ind = context.indicators;
    const rsi = ind.adaptiveRSI;

    return `分析ETH市场并给出JSON交易决策：

【策略信号】
- 方向: ${signal.type.toUpperCase()}
- 强度: ${signal.strength}/100
- 置信度: ${(signal.confidence * 100).toFixed(1)}%
- 理由: ${signal.reasoning.join('; ')}

【技术指标】
- 价格: $${context.currentPrice.toFixed(2)}
- Adaptive RSI: ${(rsi?.value ?? 50).toFixed(1) || 'N/A'} (${rsi?.regime || 'unknown'})
- RSI阈值: ${rsi?.oversold || 30} - ${rsi?.overbought || 70}
- 趋势评分: ${ind.trendScore.toFixed(0)}
- 动量评分: ${ind.momentumScore.toFixed(0)}

【新闻】
${news}

输出JSON格式:
{
  "action": "buy|sell|hold",
  "confidence": 0.0-1.0,
  "reasoning": ["理由1", "理由2"],
  "riskLevel": "low|medium|high",
  "marketSentiment": "bullish|bearish|neutral",
  "warnings": ["风险1"]
}`;
  }

  /**
   * 保存 LLM 决策报告
   */
  private saveLLMReport(decision: LLMTradingDecision, currentPrice?: number) {
    try {
      const fs = require('fs');
      const report = {
        lastDecision: { 
          ...decision, 
          decisionPrice: currentPrice 
        },
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync('./llm-report.json', JSON.stringify(report, null, 2));
    } catch (error) {
      logger.error('保存 LLM 报告失败:', error);
    }
  }
  
  /**
   * 获取 Token 使用统计
   */
  getTokenUsageSummary() {
    return llmConfigManager.getTokenUsageSummary();
  }
}

export default LLMTradingDecisionEngine;
