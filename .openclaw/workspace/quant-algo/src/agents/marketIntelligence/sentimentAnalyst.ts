/**
 * Sentiment Analyst Agent
 * 情绪分析 Agent - 新闻和社交媒体情绪
 */

import { isNewsApiResponse, isNonNullObject } from '../../utils/typeGuards';
import {
  AnalystAgent,
  AnalysisContext,
  AgentOutput,
  AgentStatus,
  SentimentReport,
  NewsItem,
  SENTIMENT_ANALYST_VERSION,
} from './types';

// ==================== Sentiment analysis types ====================

/** Aggregated news sentiment analysis */
interface NewsSentiment {
  items: NewsItem[];
  aggregateSentiment: number;
  keyEvents: string[];
  impactAssessment: 'positive' | 'negative' | 'neutral';
}

/** Social media sentiment analysis */
interface SocialSentiment {
  twitterSentiment: number;
  redditSentiment: number;
  trending: boolean;
  volume: number;
}

/** Event analysis result */
interface EventAnalysis {
  upcomingEvents: Array<{
    event: string;
    date: number;
    expectedImpact: 'high' | 'medium' | 'low';
  }>;
  recentEvents: string[];
}

/** Raw news API response shape */
interface NewsApiResponse {
  status: string;
  articles?: Array<{
    title: string;
    description?: string;
    source?: { name?: string };
    publishedAt: string;
    url: string;
  }>;
}

export class SentimentAnalystAgent implements AnalystAgent {
  readonly name = 'SentimentAnalyst';
  readonly version = SENTIMENT_ANALYST_VERSION;
  
  private lastRun: number = 0;
  private errorCount: number = 0;
  private processingTimes: number[] = [];
  
  // 缓存
  private cachedReport: SentimentReport | null = null;
  private cacheExpiry: number = 5 * 60 * 1000; // 5分钟缓存
  
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
      
      // 尝试获取真实新闻数据
      let newsItems: NewsItem[] = [];
      let hasRealData = false;
      
      try {
        // 尝试调用新闻 API
        newsItems = await this.fetchNews(context.symbol);
        hasRealData = newsItems.length > 0;
      } catch (e) {
        // API 不可用，使用模拟数据
        hasRealData = false;
      }
      
      // 如果没有真实数据，生成基于技术指标的推断情绪
      if (!hasRealData) {
        return this.generateInferredSentiment(context, startTime);
      }
      
      // 分析新闻情绪
      const newsAnalysis = this.analyzeNewsSentiment(newsItems);
      
      // 社交媒体分析 (简化版)
      const socialAnalysis = this.analyzeSocialSentiment(context);
      
      // 事件分析
      const eventAnalysis = this.analyzeEvents(context);
      
      // 综合情绪
      const overallSentiment = this.calculateOverallSentiment(
        newsAnalysis,
        socialAnalysis
      );
      
      const report: SentimentReport = {
        timestamp: Date.now(),
        newsAnalysis,
        socialAnalysis,
        eventAnalysis,
        overallSentiment,
        agentMetadata: {
          agentName: 'SentimentAnalyst',
          version: this.version,
          processingTimeMs: Date.now() - startTime,
          sourcesChecked: newsItems.length,
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
      
    } catch (error: unknown) {
      this.errorCount++;
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
  
  /**
   * 基于技术指标推断情绪 (无外部数据时使用)
   */
  private generateInferredSentiment(
    context: AnalysisContext,
    startTime: number
  ): AgentOutput {
    const { ohlcv, additionalData } = context;
    
    // 使用技术指标推断市场情绪
    const closes = ohlcv.map(c => c.close);
    const currentPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2];
    const priceChange = (currentPrice - prevPrice) / prevPrice;
    
    // 计算简单的市场状态
    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, Math.min(50, closes.length));
    
    // 推断情绪分数
    let score = 0;
    const reasoning: string[] = [];
    
    if (currentPrice > sma20) {
      score += 0.2;
      reasoning.push('价格位于 SMA20 之上');
    } else {
      score -= 0.2;
      reasoning.push('价格位于 SMA20 之下');
    }
    
    if (currentPrice > sma50) {
      score += 0.15;
      reasoning.push('价格位于 SMA50 之上');
    } else {
      score -= 0.15;
      reasoning.push('价格位于 SMA50 之下');
    }
    
    // 使用策略输出的共识 (如果有)
    if (additionalData?.strategyConsensus && isNonNullObject(additionalData.strategyConsensus)) {
      const sc = additionalData.strategyConsensus;
      const consensus = { type: typeof sc.type === 'string' ? sc.type : '', strength: typeof sc.strength === 'number' ? sc.strength : 0 };
      if (consensus.type === 'buy') {
        score += 0.3;
        reasoning.push(`策略共识: 买入 (${consensus.strength}%)`);
      } else if (consensus.type === 'sell') {
        score -= 0.3;
        reasoning.push(`策略共识: 卖出 (${consensus.strength}%)`);
      }
    }
    
    // 限制范围
    score = Math.max(-1, Math.min(1, score));
    
    const direction = score > 0.1 ? 'bullish' : score < -0.1 ? 'bearish' : 'neutral';
    
    const report: SentimentReport = {
      timestamp: Date.now(),
      newsAnalysis: {
        items: [],
        aggregateSentiment: score,
        keyEvents: [],
        impactAssessment: direction === 'bullish' ? 'positive' : direction === 'bearish' ? 'negative' : 'neutral',
      },
      socialAnalysis: {
        twitterSentiment: score,
        redditSentiment: score,
        trending: false,
        volume: 0,
      },
      eventAnalysis: {
        upcomingEvents: [],
        recentEvents: reasoning,
      },
      overallSentiment: {
        score,
        confidence: 0.3, // 低置信度，因为是推断的
        direction,
      },
      agentMetadata: {
        agentName: 'SentimentAnalyst',
        version: this.version,
        processingTimeMs: Date.now() - startTime,
        sourcesChecked: 0,
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
  
  private async fetchNews(symbol: string): Promise<NewsItem[]> {
    // 尝试从配置的新闻 API 获取
    const newsApiKey = process.env.NEWS_API_KEY;
    
    if (!newsApiKey) {
      return [];
    }
    
    try {
      const url = `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=10&apiKey=${newsApiKey}`;
      const response = await fetch(url);
      const rawData: unknown = await response.json();
      
      // Type-safe parsing
      if (isNewsApiResponse(rawData) && rawData.status === 'ok' && Array.isArray(rawData.articles)) {
        const data = rawData;
        return (data.articles || []).map((article) => ({
          title: article.title,
          summary: article.description || '',
          source: article.source?.name || 'unknown',
          sentiment: 0, // 需要后续分析
          relevance: 0.8,
          timestamp: new Date(article.publishedAt).getTime(),
          url: article.url,
        }));
      }
    } catch (e) {
      // API 调用失败
    }
    
    return [];
  }
  
  private analyzeNewsSentiment(items: NewsItem[]): NewsSentiment {
    if (items.length === 0) {
      return {
        items: [],
        aggregateSentiment: 0,
        keyEvents: [],
        impactAssessment: 'neutral',
      };
    }
    
    // 简单的关键词情感分析
    const bullishWords = ['surge', 'rally', 'gain', 'bullish', 'up', 'rise', 'positive', 'adoption', 'growth'];
    const bearishWords = ['crash', 'drop', 'fall', 'bearish', 'down', 'decline', 'negative', 'sell', 'loss'];
    
    let totalSentiment = 0;
    const keyEvents: string[] = [];
    
    for (const item of items) {
      const text = (item.title + ' ' + item.summary).toLowerCase();
      
      let bullishCount = 0;
      let bearishCount = 0;
      
      for (const word of bullishWords) {
        if (text.includes(word)) bullishCount++;
      }
      
      for (const word of bearishWords) {
        if (text.includes(word)) bearishCount++;
      }
      
      item.sentiment = (bullishCount - bearishCount) / Math.max(1, bullishCount + bearishCount);
      totalSentiment += item.sentiment;
      
      if (Math.abs(item.sentiment) > 0.5) {
        keyEvents.push(item.title);
      }
    }
    
    const aggregateSentiment = totalSentiment / items.length;
    
    return {
      items: items.slice(0, 5),
      aggregateSentiment,
      keyEvents: keyEvents.slice(0, 3),
      impactAssessment: aggregateSentiment > 0.2 ? 'positive' : aggregateSentiment < -0.2 ? 'negative' : 'neutral',
    };
  }
  
  private analyzeSocialSentiment(context: AnalysisContext): SocialSentiment {
    // 简化版社交媒体分析
    // 实际应用中应该连接 Twitter API, Reddit API 等
    
    const { additionalData } = context;
    
    // 如果有策略共识，作为社交情绪的代理
    let sentiment = 0;
    if (additionalData?.strategyConsensus && isNonNullObject(additionalData.strategyConsensus)) {
      const sc = additionalData.strategyConsensus;
      const consensus = { type: typeof sc.type === 'string' ? sc.type : '', strength: typeof sc.strength === 'number' ? sc.strength : 0 };
      if (consensus.type === 'buy') {
        sentiment = 0.3;
      } else if (consensus.type === 'sell') {
        sentiment = -0.3;
      }
    }
    
    return {
      twitterSentiment: sentiment,
      redditSentiment: sentiment,
      trending: false,
      volume: 0,
    };
  }
  
  private analyzeEvents(context: AnalysisContext): EventAnalysis {
    // 事件分析 (简化版)
    // 实际应用中应该连接事件日历 API
    
    return {
      upcomingEvents: [],
      recentEvents: [],
    };
  }
  
  private calculateOverallSentiment(
    newsAnalysis: NewsSentiment,
    socialAnalysis: SocialSentiment
  ): { score: number; confidence: number; direction: 'bullish' | 'bearish' | 'neutral' } {
    // 加权平均
    const newsWeight = 0.6;
    const socialWeight = 0.4;
    
    const score = 
      newsAnalysis.aggregateSentiment * newsWeight +
      ((socialAnalysis.twitterSentiment + socialAnalysis.redditSentiment) / 2) * socialWeight;
    
    // 置信度基于数据源数量
    const confidence = Math.min(1, (newsAnalysis.items?.length || 0) / 10 * 0.5 + 0.3);
    
    const direction = score > 0.1 ? 'bullish' : score < -0.1 ? 'bearish' : 'neutral';
    
    return { score, confidence, direction };
  }
  
  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
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

export default SentimentAnalystAgent;
