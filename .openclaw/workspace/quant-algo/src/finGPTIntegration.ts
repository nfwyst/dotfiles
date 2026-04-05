import logger from './logger';

export interface NewsEvent {
  title: string;
  source: string;
  sentiment: number;
  relevance: number;
  timestamp: number;
  category: 'macro' | 'crypto' | 'tech' | 'regulation' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MarketSentiment {
  overall: number;
  shortTerm: number;
  longTerm: number;
  confidence: number;
  keyEvents: NewsEvent[];
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * FinGPT 风格的市场情绪与风险分析
 * 
 * 功能:
 * 1. 重大事件检测 (安全风险、监管政策等)
 * 2. 市场情绪分析
 * 3. 交易建议生成
 * 4. 风险预警
 */
export class FinGPTAnalyzer {
  private lastCheck: number = 0;
  private checkInterval: number = 5 * 60 * 1000; // 5分钟
  private cachedSentiment: MarketSentiment | null = null;
  private eventHistory: NewsEvent[] = [];
  
  /**
   * 分析市场情绪 (集成到交易流程)
   */
  async analyze(): Promise<MarketSentiment> {
    // 检查缓存
    if (this.cachedSentiment && Date.now() - this.lastCheck < this.checkInterval) {
      return this.cachedSentiment;
    }
    
    try {
      // 获取市场数据
      const sentiment = await this.gatherMarketData();
      
      this.cachedSentiment = sentiment;
      this.lastCheck = Date.now();
      
      // 如果有高风险事件，记录日志
      if (sentiment.riskLevel === 'high' || sentiment.riskLevel === 'critical') {
        logger.warn(`⚠️ FinGPT 风险预警: ${sentiment.riskLevel.toUpperCase()}`);
        sentiment.keyEvents
          .filter(e => e.severity === 'high' || e.severity === 'critical')
          .forEach(e => logger.warn(`   - ${e.title}`));
      }
      
      return sentiment;
      
    } catch (error) {
      logger.error('FinGPT 分析失败:', error);
      return this.getDefaultSentiment();
    }
  }
  
  /**
   * 收集市场数据 (简化版)
   */
  private async gatherMarketData(): Promise<MarketSentiment> {
    const events = this.simulateMarketEvents();
    const overall = this.calculateOverallSentiment(events);
    const riskLevel = this.calculateRiskLevel(events);
    
    return {
      overall,
      shortTerm: overall * 0.8 + (Math.random() - 0.5) * 0.2,
      longTerm: overall * 0.6,
      confidence: 0.7,
      keyEvents: events,
      riskLevel,
    };
  }
  
  /**
   * 模拟市场事件 (实际使用时替换为真实数据)
   */
  private simulateMarketEvents(): NewsEvent[] {
    const events: NewsEvent[] = [];
    const now = Date.now();
    
    if (Math.random() > 0.7) {
      events.push({
        title: '以太坊网络活跃度上升',
        source: 'OnChainData',
        sentiment: 0.4,
        relevance: 0.8,
        timestamp: now - 3600000,
        category: 'tech',
        severity: 'low',
      });
    }
    
    return events;
  }
  
  /**
   * 检查是否应暂停交易
   */
  async shouldPauseTrading(): Promise<{
    shouldPause: boolean;
    reason?: string;
    duration?: number;
  }> {
    const sentiment = await this.analyze();
    
    // 严重风险事件 - 暂停交易
    const criticalEvents = sentiment.keyEvents.filter(e => e.severity === 'critical');
    if (criticalEvents.length > 0) {
      return {
        shouldPause: true,
        reason: `严重风险事件: ${criticalEvents[0].title}`,
        duration: 4 * 60 * 60 * 1000,
      };
    }
    
    // 高风险 + 情绪极度负面
    if (sentiment.riskLevel === 'high' && sentiment.overall < -0.7) {
      return {
        shouldPause: true,
        reason: '市场情绪极度负面',
        duration: 2 * 60 * 60 * 1000,
      };
    }
    
    return { shouldPause: false };
  }
  
  /**
   * 获取交易建议
   */
  async getTradingAdvice(): Promise<{
    action: 'increase' | 'decrease' | 'hold';
    confidence: number;
    reasoning: string[];
    riskAdjustment: number;
  }> {
    const sentiment = await this.analyze();
    const reasoning: string[] = [];
    let action: 'increase' | 'decrease' | 'hold' = 'hold';
    let riskAdjustment = 1.0;
    
    if (sentiment.overall > 0.6 && sentiment.confidence > 0.6) {
      action = 'increase';
      riskAdjustment = 1.2;
      reasoning.push('市场情绪偏多，可增加仓位');
    } else if (sentiment.overall < -0.6 && sentiment.confidence > 0.6) {
      action = 'decrease';
      riskAdjustment = 0.5;
      reasoning.push('市场情绪偏空，降低仓位');
    } else {
      reasoning.push('市场情绪中性，保持标准仓位');
    }
    
    if (sentiment.riskLevel === 'high') {
      riskAdjustment *= 0.7;
      reasoning.push('风险等级高，进一步降低仓位');
    }
    
    return {
      action,
      confidence: sentiment.confidence,
      reasoning,
      riskAdjustment: Math.max(0.3, Math.min(1.5, riskAdjustment)),
    };
  }
  
  private calculateOverallSentiment(events: NewsEvent[]): number {
    if (events.length === 0) return 0;
    const weightedSum = events.reduce((sum, e) => sum + e.sentiment * e.relevance, 0);
    const totalWeight = events.reduce((sum, e) => sum + e.relevance, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  private calculateRiskLevel(events: NewsEvent[]): 'low' | 'medium' | 'high' {
    const criticalCount = events.filter(e => e.severity === 'critical').length;
    const highCount = events.filter(e => e.severity === 'high').length;
    
    if (criticalCount > 0) return 'high';
    if (highCount >= 2) return 'high';
    if (highCount === 1) return 'medium';
    return 'low';
  }
  
  private getDefaultSentiment(): MarketSentiment {
    return {
      overall: 0,
      shortTerm: 0,
      longTerm: 0,
      confidence: 0.5,
      keyEvents: [],
      riskLevel: 'medium',
    };
  }
  
  /**
   * 手动添加事件
   */
  addEvent(event: Omit<NewsEvent, 'timestamp'>): void {
    const fullEvent: NewsEvent = { ...event, timestamp: Date.now() };
    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > 100) this.eventHistory.shift();
    this.cachedSentiment = null;
    logger.info(`FinGPT: 添加事件 - ${event.title} (${event.severity})`);
  }
}

export default FinGPTAnalyzer;
