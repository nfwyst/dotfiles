import logger from './logger';
import { web_search } from './openclawTools';

export interface NewsItem {
  title: string;
  url: string;
  snippet: string;
  timestamp: string;
  isImportant: boolean;
  isUrgent: boolean;
  keywords: string[];
}

/**
 * 新闻监控子模块
 * 归属于 NotificationManager，负责 ETH 新闻的获取、分析和通知
 */
class NewsMonitor {
  private cachedNews: NewsItem[] = [];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000;
  
  private readonly IMPORTANT_KEYWORDS = [
    'sec', 'regulation', 'approve', 'etf', 'reject', 'ban', 'legal', 'compliance',
    'crash', 'pump', 'dump', 'surge', 'plunge', 'rally', 'breakout', 'volatile',
    'upgrade', 'hard fork', 'shanghai', 'merge', 'pos', 'ethereum 2', 'dencun',
    'institutional', 'blackrock', 'fidelity', 'grayscale', 'inflow', 'outflow',
    'hack', 'exploit', 'vulnerability', 'security breach', 'stolen',
    'fed', 'federal reserve', 'interest rate', 'inflation', 'cpi', 'recession',
    'bitcoin etf', 'spot etf', 'cbdc', 'stablecoin regulation',
  ];
  
  private readonly URGENT_KEYWORDS = [
    'sec approve', 'etf approved', 'sec reject', 'sec deny',
    'major hack', 'exploit', 'stolen funds',
    'binance shutdown', 'coinbase delist', 'blackrock etf',
    'emergency', 'flash crash', 'systemic risk',
    'fed emergency', 'interest rate hike', 'rate cut',
  ];

  /**
   * 获取新闻摘要
   */
  async getNewsSummary(): Promise<string> {
    const news = await this.fetchNews();
    if (news.length === 0) return '暂无重要新闻';
    return news.slice(0, 3).map((item, i) => `${i + 1}. ${item.title}`).join('\n');
  }

  /**
   * 获取新闻分析（含情绪判断）
   */
  async getNewsAnalysis(): Promise<{
    summary: string;
    impact: 'positive' | 'negative' | 'neutral';
    sentiment: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    keyEvents: string[];
  }> {
    const news = await this.fetchNews();
    
    if (news.length === 0) {
      return {
        summary: '暂无重要新闻',
        impact: 'neutral',
        sentiment: 'neutral',
        confidence: 0.5,
        keyEvents: [],
      };
    }

    let positiveCount = 0;
    let negativeCount = 0;
    const keyEvents: string[] = [];

    for (const item of news.slice(0, 5)) {
      keyEvents.push(item.title);
      const text = (item.title + ' ' + item.snippet).toLowerCase();
      if (text.includes('surge') || text.includes('rally') || text.includes('inflow') || 
          text.includes('approve') || text.includes('bullish')) {
        positiveCount++;
      } else if (text.includes('crash') || text.includes('plunge') || text.includes('outflow') || 
                 text.includes('reject') || text.includes('ban') || text.includes('hack')) {
        negativeCount++;
      }
    }

    const sentiment = positiveCount > negativeCount ? 'bullish' : 
                      negativeCount > positiveCount ? 'bearish' : 'neutral';
    const confidence = Math.abs(positiveCount - negativeCount) / Math.max(news.length, 1);
    const impact = news.some(n => n.isUrgent) ? 
      (sentiment === 'bullish' ? 'positive' : 'negative') : 'neutral';

    return {
      summary: news.slice(0, 3).map(n => n.title).join('; '),
      impact,
      sentiment,
      confidence: Math.min(0.9, confidence + 0.3),
      keyEvents,
    };
  }

  /**
   * 检查并返回新的重要新闻
   */
  async checkForNews(): Promise<NewsItem[]> {
    const news = await this.fetchNews();
    const newNews = this.getNewImportantNews(news);
    if (newNews.length > 0) {
      this.updateCache(news);
    }
    return newNews;
  }

  private async fetchNews(): Promise<NewsItem[]> {
    const now = Date.now();
    if (now - this.lastFetchTime < this.CACHE_DURATION && this.cachedNews.length > 0) {
      return this.cachedNews;
    }

    try {
      const result = await web_search('Ethereum ETH news today breaking', {
        count: 10,
        freshness: 'pd',
      });

      const news: NewsItem[] = [];
      for (const item of result.results) {
        const analysis = this.analyzeNews(item.title, item.snippet);
        if (analysis.isImportant) {
          news.push({
            title: item.title,
            url: item.url,
            snippet: item.snippet,
            timestamp: new Date().toISOString(),
            isImportant: true,
            isUrgent: analysis.isUrgent,
            keywords: analysis.keywords,
          });
        }
      }

      this.cachedNews = news;
      this.lastFetchTime = now;
      return news;
    } catch (error) {
      logger.error('获取新闻失败:', error);
      return this.cachedNews;
    }
  }

  private analyzeNews(title: string, snippet: string): { 
    isImportant: boolean; 
    isUrgent: boolean; 
    keywords: string[];
  } {
    const text = (title + ' ' + snippet).toLowerCase();
    const keywords: string[] = [];

    for (const keyword of this.IMPORTANT_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        keywords.push(keyword);
      }
    }

    let isUrgent = false;
    for (const keyword of this.URGENT_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        isUrgent = true;
        keywords.push(keyword + '⚠️');
      }
    }

    return {
      isImportant: keywords.length > 0,
      isUrgent,
      keywords: [...new Set(keywords)],
    };
  }

  private getNewImportantNews(currentNews: NewsItem[]): NewsItem[] {
    return currentNews.filter(item => 
      !this.cachedNews.some(cached => cached.title === item.title)
    );
  }

  private updateCache(news: NewsItem[]): void {
    const merged = [...news, ...this.cachedNews];
    const unique = merged.filter((item, index, self) => 
      index === self.findIndex(t => t.title === item.title)
    );
    this.cachedNews = unique.slice(0, 50);
  }
}

/**
 * 监控通知管理器
 * 
 * 统一管理：
 * 1. 交易通知（开平仓、每日汇总）
 * 2. 新闻监控与通知
 * 3. 系统警报
 */
export class NotificationManager {
  private botToken: string;
  private chatId: string;
  private enabled: boolean;
  private newsMonitor: NewsMonitor;
  
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    this.enabled = !!(this.botToken && this.chatId);
    this.newsMonitor = new NewsMonitor();
    
    if (this.enabled) {
      logger.info('✅ Telegram 通知已启用');
    }
    logger.info('📰 新闻监控子模块已初始化');
  }
  
  /**
   * 获取新闻摘要（供 LLM 使用）
   */
  async getNewsSummary(): Promise<string> {
    return this.newsMonitor.getNewsSummary();
  }

  /**
   * 获取新闻分析（供 LLM 使用）
   */
  async getNewsAnalysis() {
    return this.newsMonitor.getNewsAnalysis();
  }

  /**
   * 检查新闻并通知（在主循环中调用）
   */
  async checkAndNotifyNews(): Promise<void> {
    const newNews = await this.newsMonitor.checkForNews();
    
    if (newNews.length === 0) return;

    newNews.sort((a, b) => (b.isUrgent ? 1 : 0) - (a.isUrgent ? 1 : 0));

    for (const item of newNews) {
      await this.sendNewsNotification(item);
    }
  }

  private async sendNewsNotification(item: NewsItem): Promise<void> {
    const emoji = item.isUrgent ? '🚨' : '📰';
    const priority = item.isUrgent ? '【紧急】' : '【重要】';
    
    const message = `
${emoji} ${priority} ETH 新闻

<b>${item.title}</b>

🏷️ 关键词: ${item.keywords.slice(0, 5).join(', ')}

💬 ${item.snippet.slice(0, 150)}...

🕐 ${new Date(item.timestamp).toLocaleString('zh-CN')}
    `.trim();

    await this.sendMessage(message);

    if (item.isUrgent) {
      logger.warn(`🚨 紧急新闻: ${item.title}`);
    } else {
      logger.info(`📰 重要新闻: ${item.title}`);
    }
  }

  // ========== 基础通知方法 ==========
  
  private async sendMessage(message: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    if (!this.enabled) return false;
    
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: parseMode,
        }),
      });
      
      return response.ok;
    } catch (error) {
      logger.error('发送 Telegram 通知失败:', error);
      return false;
    }
  }
  
  // ========== 交易通知 ==========
  
  async notifyOpenPosition(side: 'long' | 'short', price: number, size: number, leverage: number): Promise<void> {
    const emoji = side === 'long' ? '🟢' : '🔴';
    const message = `
${emoji} <b>开仓通知</b>

方向: ${side.toUpperCase()}
价格: $${price.toFixed(2)}
数量: ${size.toFixed(4)} ETH
杠杆: ${leverage}x
    `.trim();
    
    await this.sendMessage(message);
  }
  
  async notifyClosePosition(side: 'long' | 'short', entryPrice: number, exitPrice: number, pnl: number, reason: string): Promise<void> {
    const pnlEmoji = pnl >= 0 ? '✅' : '❌';
    
    const message = `
${pnlEmoji} <b>平仓通知</b>

方向: ${side.toUpperCase()}
入场价: $${entryPrice.toFixed(2)}
出场价: $${exitPrice.toFixed(2)}
盈亏: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT
原因: ${reason}
    `.trim();
    
    await this.sendMessage(message);
  }
  
  async notifyDailySummary(trades: number, wins: number, losses: number, totalPnl: number): Promise<void> {
    const winRate = trades > 0 ? (wins / trades * 100).toFixed(1) : '0.0';
    const emoji = totalPnl >= 0 ? '📈' : '📉';
    
    const message = `
${emoji} <b>每日交易汇总</b>

交易次数: ${trades}
盈利: ${wins} | 亏损: ${losses}
胜率: ${winRate}%
总盈亏: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USDT
    `.trim();
    
    await this.sendMessage(message);
  }
  
  // ========== 系统通知 ==========
  
  async notifyAlert(title: string, message: string): Promise<void> {
    const formatted = `🚨 <b>${title}</b>\n\n${message}`;
    await this.sendMessage(formatted);
  }
  
  async notifyStart(): Promise<void> {
    const message = `🚀 <b>ETH 交易系统已启动</b>\n\n开始 24/7 监控市场...`;
    await this.sendMessage(message);
  }
  
  async notifyStop(): Promise<void> {
    const message = `🛑 <b>ETH 交易系统已停止</b>\n\n交易机器人已安全关闭。`;
    await this.sendMessage(message);
  }
}

export default NotificationManager;
