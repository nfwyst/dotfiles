/**
 * @deprecated This module will be moved to `src/ai/AIModule.ts` in a future release.
 * Import from `src/ai/` instead for LLM client functionality.
 * This file provides high-level AI features (sentiment, anomaly detection, strategy
 * recommendation) that wrap the low-level LLMClient in `src/ai/LLMClient.ts`.
 */
import { config } from './config';
import logger from './logger';
import { aiCircuitBreaker } from './safety/circuitBreakers';
import {
  tracingManager,
  getTraceContextForLogging,
} from './monitoring/tracing';
import { llmClient, llmConfigManager } from './ai/index';
import type { LLMProvider } from './ai/index';
export interface SentimentResult {
  score: number;        // -1 到 1
  confidence: number;   // 0 到 1
  sources: string[];
  summary: string;
}

export interface AnomalyDetection {
  isAnomaly: boolean;
  anomalyType?: 'flash_crash' | 'pump' | 'fakeout' | 'whale_manipulation';
  severity: number;     // 0-10
  reason: string;
}

export interface StrategyRecommendation {
  strategy: 'aggressive' | 'conservative' | 'neutral' | 'hold';
  confidence: number;
  parameters: {
    leverage: number;
    positionSize: number;
    stopLossMultiplier: number;
  };
  reasoning: string;
}

export interface AITradeSignal {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  timeHorizon: 'short' | 'medium' | 'long';
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * AI 模块 - 智能交易助手
 * 
 * 功能：
 * 1. 市场情绪分析 (News/Social)
 * 2. 异常检测 (Anomaly Detection)
 * 3. 策略推荐 (Strategy Selection)
 * 4. 自然语言查询 (NLP)
 * 5. 风险预测 (Risk Forecasting)
 * 
 * 使用统一的 LLMConfigManager 管理多供应商
 */
export class AIModule {
  private lastAnalysis: number = 0;
  private analysisInterval: number = 5 * 60 * 1000; // 5分钟
  private cachedSentiment: SentimentResult | null = null;
  
  // 新闻 API Key
  private newsApiKey: string;
  
  constructor() {
    this.newsApiKey = process.env.NEWS_API_KEY || '';
    
    // 使用统一的配置管理器
    const availableProviders = llmConfigManager.getAvailableProviders();
    
    if (availableProviders.length > 0) {
      const defaultProvider = llmConfigManager.getDefaultProvider();
      logger.info(`✅ AI 模块已启用 (供应商: ${availableProviders.join(', ')}, 默认: ${defaultProvider})`);
    } else {
      logger.info('⚠️ AI 模块使用本地模式 (无 LLM API Key)');
    }
  }
  
  /**
   * 1. 市场情绪分析
   * 分析新闻和社交媒体对 ETH 的情绪
   */
  async analyzeSentiment(): Promise<SentimentResult> {
    // 检查缓存
    if (this.cachedSentiment && Date.now() - this.lastAnalysis < this.analysisInterval) {
      return this.cachedSentiment;
    }
    
    // 如果有 LLM 配置，使用 LLM 分析
    if (llmConfigManager.isProviderAvailable(llmConfigManager.getDefaultProvider())) {
      try {
        const result = await this.analyzeSentimentWithLLM();
        this.cachedSentiment = result;
        this.lastAnalysis = Date.now();
        return result;
      } catch (error) {
        logger.error('LLM 情绪分析失败，使用本地规则:', error);
      }
    }
    
    // 本地规则分析 (简化版)
    return this.analyzeSentimentLocally();
  }
  
  /**
   * 使用统一的 LLMClient 进行情绪分析
   */
  private async analyzeSentimentWithLLM(): Promise<SentimentResult> {
    const span = tracingManager.isEnabled()
      ? tracingManager.startSpan('ai.llm_sentiment_analysis', {
          attributes: {
            'ai.operation': 'sentiment_analysis',
            'ai.model': 'gpt-4o-mini',
          },
        })
      : null;

    const prompt = `
Analyze the current market sentiment for Ethereum (ETH). 
Consider recent price action and typical market patterns.

Respond in JSON format:
{
  "score": -0.5 to 0.5, // sentiment score
  "confidence": 0.0 to 1.0,
  "sources": ["technical_analysis", "market_structure"],
  "summary": "Brief sentiment summary"
}
`;

    try {
      span?.addEvent('llm.request_started');
      
      const response = await llmClient.chat({
        messages: [{ role: 'user', content: prompt }],
        responseFormat: { type: 'json_object' },
        maxTokens: 200,
        useCache: true,
      });
      
      span?.addEvent('llm.response_received', {
        'ai.provider': response.provider,
        'ai.tokens_used': response.usage?.totalTokens || 0,
      });
      
      const result = JSON.parse(response.content);
      
      span?.setAttributes({
        'ai.sentiment_score': result.score,
        'ai.confidence': result.confidence,
      });
      span?.setStatus({ code: 0 });
      span?.end();
      
      logger.debug(`AI 情绪分析: ${result.score} (${result.summary}) [${response.provider}]`, getTraceContextForLogging());
      
      return {
        score: result.score,
        confidence: result.confidence,
        sources: result.sources,
        summary: result.summary,
      };
    } catch (error: unknown) {
      span?.recordException(error);
      span?.setStatus({ code: 2, message: (error instanceof Error ? error.message : String(error)) });
      span?.end();
      throw error;
    }
  }
  
  private analyzeSentimentLocally(): SentimentResult {
    // 基于技术指标的简单情绪判断
    // 实际应用中可以从新闻 API、推特等获取数据
    
    return {
      score: 0,
      confidence: 0.3,
      sources: ['local_indicators'],
      summary: '使用本地指标分析 (未连接外部数据源)',
    };
  }
  
  /**
   * 2. 异常检测
   * 检测闪崩、假突破、大单操纵等异常
   */
  detectAnomaly(ohlcv: number[][], recentTrades?: any[]): AnomalyDetection {
    if (ohlcv.length < 10) {
      return { isAnomaly: false, severity: 0, reason: '数据不足' };
    }
    
    const current = ohlcv[ohlcv.length - 1];
    const prev = ohlcv[ohlcv.length - 2];
    const recent = ohlcv.slice(-10);
    
    const currentPrice = current[4];
    const prevPrice = prev[4];
    const currentVolume = current[5];
    const avgVolume = recent.reduce((sum, c) => sum + c[5], 0) / recent.length;
    
    // 检测 1: 闪崩 (5分钟内跌幅 > 3%)
    const priceChange = (currentPrice - prevPrice) / prevPrice;
    if (priceChange < -0.03 && currentVolume > avgVolume * 2) {
      return {
        isAnomaly: true,
        anomalyType: 'flash_crash',
        severity: Math.min(10, Math.abs(priceChange) * 100),
        reason: `闪崩检测: ${(priceChange * 100).toFixed(2)}% 跌幅，成交量 ${(currentVolume / avgVolume).toFixed(1)}x`,
      };
    }
    
    // 检测 2: 假突破 (长上影线 + 高成交量)
    const high = current[2];
    const low = current[3];
    const open = current[1];
    const close = current[4];
    const bodySize = Math.abs(close - open);
    const wickSize = high - Math.max(open, close);
    
    if (wickSize > bodySize * 3 && currentVolume > avgVolume * 1.5) {
      return {
        isAnomaly: true,
        anomalyType: 'fakeout',
        severity: 7,
        reason: '假突破: 长上影线 + 高成交量',
      };
    }
    
    // 检测 3: 爆拉 (5分钟内涨幅 > 3%)
    if (priceChange > 0.03 && currentVolume > avgVolume * 2) {
      return {
        isAnomaly: true,
        anomalyType: 'pump',
        severity: Math.min(10, priceChange * 100),
        reason: `爆拉检测: ${(priceChange * 100).toFixed(2)}% 涨幅，成交量 ${(currentVolume / avgVolume).toFixed(1)}x`,
      };
    }
    
    // 检测 4: 成交量异常 (无明显价格变动但成交量激增)
    if (currentVolume > avgVolume * 3 && Math.abs(priceChange) < 0.01) {
      return {
        isAnomaly: true,
        anomalyType: 'whale_manipulation',
        severity: 6,
        reason: `疑似大单操纵: 成交量 ${(currentVolume / avgVolume).toFixed(1)}x，价格变动 ${(priceChange * 100).toFixed(2)}%`,
      };
    }
    
    return { isAnomaly: false, severity: 0, reason: '无异常' };
  }
  
  /**
   * 3. 策略推荐
   * 根据市场状态推荐最佳策略参数
   */
  recommendStrategy(
    ohlcv: number[][],
    volatility: number,
    trend: 'up' | 'down' | 'sideways'
  ): StrategyRecommendation {
    const currentPrice = ohlcv[ohlcv.length - 1][4];
    const atr = this.calculateATR(ohlcv);
    const volatilityPercent = atr / currentPrice;
    
    // 基于波动率和趋势的策略选择
    if (volatilityPercent > 0.02) {
      // 高波动 - 保守策略
      return {
        strategy: 'conservative',
        confidence: 0.7,
        parameters: {
          leverage: Math.min(50, config.leverage),
          positionSize: 0.5,
          stopLossMultiplier: 1.5,
        },
        reasoning: '高波动市场 (${(volatilityPercent * 100).toFixed(1)}%)，降低杠杆和仓位',
      };
    } else if (volatilityPercent < 0.005 && trend !== 'sideways') {
      // 低波动但有趋势 - 可以激进
      return {
        strategy: 'aggressive',
        confidence: 0.6,
        parameters: {
          leverage: config.leverage,
          positionSize: 1.2,
          stopLossMultiplier: 0.8,
        },
        reasoning: '低波动趋势市，增加仓位把握趋势',
      };
    } else {
      // 震荡市 - 中性
      return {
        strategy: 'neutral',
        confidence: 0.5,
        parameters: {
          leverage: Math.min(100, config.leverage),
          positionSize: 0.8,
          stopLossMultiplier: 1.0,
        },
        reasoning: '震荡市场，标准参数',
      };
    }
  }
  
  /**
   * 4. AI 交易信号增强
   * 使用 AI 验证技术信号
   */
  async enhanceSignal(
    technicalSignal: { type: 'buy' | 'sell' | 'hold'; strength: number },
    ohlcv: number[][],
    anomaly: AnomalyDetection,
    sentiment: SentimentResult
  ): Promise<AITradeSignal> {
    let confidence = technicalSignal.strength / 100;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    const reasons: string[] = [];
    
    // 1. 异常检测影响
    if (anomaly.isAnomaly) {
      if (anomaly.anomalyType === 'flash_crash' && technicalSignal.type === 'buy') {
        confidence += 0.2;
        reasons.push(`闪崩后的买入机会 (严重度: ${anomaly.severity})`);
      } else if (anomaly.anomalyType === 'pump' && technicalSignal.type === 'sell') {
        confidence += 0.2;
        reasons.push(`爆拉后的卖出机会`);
      } else {
        confidence -= 0.3;
        riskLevel = 'high';
        reasons.push(`异常检测: ${anomaly.reason}`);
      }
    }
    
    // 2. 情绪影响
    if (Math.abs(sentiment.score) > 0.3 && sentiment.confidence > 0.5) {
      if ((technicalSignal.type === 'buy' && sentiment.score > 0) ||
          (technicalSignal.type === 'sell' && sentiment.score < 0)) {
        confidence += 0.15;
        reasons.push(`市场情绪一致 (${sentiment.summary})`);
      } else {
        confidence -= 0.2;
        reasons.push(`市场情绪背离 (${sentiment.summary})`);
      }
    }
    
    // 3. 波动率影响
    const atr = this.calculateATR(ohlcv);
    const volatility = atr / ohlcv[ohlcv.length - 1][4];
    if (volatility > 0.02) {
      riskLevel = 'high';
      reasons.push('高波动警告');
    } else if (volatility < 0.005) {
      riskLevel = 'low';
    }
    
    // 确定时间框架
    let timeHorizon: 'short' | 'medium' | 'long' = 'short';
    if (confidence > 0.8) timeHorizon = 'medium';
    if (confidence > 0.9 && !anomaly.isAnomaly) timeHorizon = 'long';
    
    return {
      action: technicalSignal.type,
      confidence: Math.min(1, Math.max(0, confidence)),
      timeHorizon,
      reasoning: reasons.join('; ') || '技术分析信号',
      riskLevel,
    };
  }
  
  /**
   * 5. 自然语言查询
   * 用自然语言询问市场状态
   */
  async queryMarket(question: string, context: any): Promise<string> {
    if (!llmConfigManager.isProviderAvailable(llmConfigManager.getDefaultProvider())) {
      return 'AI 查询需要配置 LLM API Key';
    }
    
    const prompt = `
你是一个专业的加密货币交易助手。基于以下市场数据回答问题：

当前价格: $${context.price?.toFixed(2) || 'N/A'}
24h变化: ${context.change24h?.toFixed(2) || 'N/A'}%
持仓: ${context.position || '无'}
账户余额: $${context.balance?.toFixed(2) || 'N/A'}

问题: ${question}

请用中文简短回答，给出具体的交易建议或分析。
`;

    try {
      const response = await llmClient.quickChat(prompt, {
        maxTokens: 300,
        temperature: 0.7,
      });
      return response;
    } catch (error) {
      logger.error('AI 查询失败:', error);
      return 'AI 查询失败，请稍后再试';
    }
  }
  
  /**
   * 6. 预测风险
   * 预测未来可能的风险事件
   */
  predictRisk(ohlcv: number[][]): {
    riskLevel: 'low' | 'medium' | 'high';
    warnings: string[];
  } {
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    const recent = ohlcv.slice(-20);
    const prices = recent.map(c => c[4]);
    const volumes = recent.map(c => c[5]);
    
    // 1. 波动率增加
    const volatility = this.calculateVolatility(prices);
    if (volatility > 0.02) {
      warnings.push(`波动率升高: ${(volatility * 100).toFixed(1)}%`);
      riskLevel = 'medium';
    }
    
    // 2. 成交量下降（可能预示变盘）
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const lastVolume = volumes[volumes.length - 1];
    if (lastVolume < avgVolume * 0.5) {
      warnings.push('成交量萎缩，可能即将变盘');
    }
    
    // 3. 连续同方向K线
    let consecutive = 1;
    for (let i = prices.length - 1; i > 0; i--) {
      if ((prices[i] > prices[i - 1] && prices[i - 1] > prices[i - 2]) ||
          (prices[i] < prices[i - 1] && prices[i - 1] < prices[i - 2])) {
        consecutive++;
      } else {
        break;
      }
    }
    if (consecutive >= 5) {
      warnings.push(`连续 ${consecutive} 根同方向K线，注意回调风险`);
      riskLevel = 'high';
    }
    
    return { riskLevel, warnings };
  }
  
  // 辅助方法: 计算 ATR
  private calculateATR(ohlcv: number[][], period: number = 14): number {
    if (ohlcv.length < period + 1) return 0;
    
    const trValues: number[] = [];
    for (let i = ohlcv.length - period; i < ohlcv.length; i++) {
      const current = ohlcv[i];
      const prev = ohlcv[i - 1];
      
      const high = current[2];
      const low = current[3];
      const prevClose = prev[4];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trValues.push(tr);
    }
    
    return trValues.reduce((a, b) => a + b, 0) / trValues.length;
  }
  
  // 辅助方法: 计算波动率
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(returns.length); // 年化波动率近似
  }
  
  /**
   * 获取 AI 模块状态
   */
  getStatus(): { enabled: boolean; hasLLM: boolean; lastAnalysis: number } {
    return {
      enabled: true,
      hasLLM: llmConfigManager.getAvailableProviders().length > 0,
      lastAnalysis: this.lastAnalysis,
    };
  }
  
  /**
   * 获取 Token 使用统计
   */
  getTokenUsageSummary() {
    return llmConfigManager.getTokenUsageSummary();
  }
}

export default AIModule;
