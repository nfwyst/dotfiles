/**
 * Market Intelligence Pipeline 类型定义
 * 基于 ATLAS 和 Expert Teams 论文的细粒度任务分解
 */

// ==================== 基础类型 ====================

export type SignalType = 'buy' | 'sell' | 'hold';
export type TrendDirection = 'up' | 'down' | 'sideways';
export type RiskLevel = 'low' | 'medium' | 'high';
export type Urgency = 'high' | 'medium' | 'low';

// ==================== 技术分析 - 细粒度任务 ====================

export interface TrendAnalysis {
  direction: TrendDirection;
  strength: number;           // 0-100
  persistence: 'strong' | 'moderate' | 'weak';
  reversalRisk: number;       // 0-100
  timeframe: string;          // '5m' | '15m' | '1h' | '4h' | '1d'
  reasoning: string[];
}

export interface MomentumAnalysis {
  rsi: {
    value: number;
    signal: 'oversold' | 'overbought' | 'neutral';
    divergence: boolean;
  };
  macd: {
    histogram: number;
    signal: 'bullish' | 'bearish' | 'neutral';
    crossover: boolean;
  };
  stochastic: {
    k: number;
    d: number;
    signal: 'oversold' | 'overbought' | 'neutral';
  };
  cci: number;
  williamsR: number;
}

export interface VolatilityAnalysis {
  atr: number;
  atrPercent: number;         // ATR 占价格的百分比
  bollingerPosition: 'upper' | 'middle' | 'lower' | 'outside';
  bollingerBandwidth: number;
  squeeze: boolean;           // 布林带收窄
  keltnerPosition: 'upper' | 'middle' | 'lower';
}

export interface VolumeAnalysis {
  obv: number;
  obvTrend: 'up' | 'down' | 'flat';
  volumeSMA20: number;
  volumeRatio: number;        // 当前成交量 / 20周期均值
  mfi: number;                // Money Flow Index
  cmf: number;                // Chaikin Money Flow
  unusualVolume: boolean;
}

export interface SupportResistanceLevel {
  price: number;
  strength: number;           // 0-100
  type: 'support' | 'resistance';
  touches: number;            // 触及次数
  lastTouch: number;          // 最后一次触及的时间戳
}

export interface MicrostructureAnalysis {
  bidAskSpread: number;
  bidAskImbalance: number;    // -1 到 1
  tradeFlow: 'buy_pressure' | 'sell_pressure' | 'neutral';
  largeOrders: Array<{
    side: 'buy' | 'sell';
    size: number;
    price: number;
    timestamp: number;
  }>;
  whaleActivity: boolean;
}

// ==================== 完整技术分析报告 ====================

export interface TechnicalReport {
  timestamp: number;
  currentPrice: number;
  
  // 细粒度任务输出
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  volatility: VolatilityAnalysis;
  volume: VolumeAnalysis;
  supportResistance: {
    levels: SupportResistanceLevel[];
    nearestSupport: number;
    nearestResistance: number;
  };
  microstructure?: MicrostructureAnalysis;
  
  // 综合评分
  compositeScores: {
    trendScore: number;       // -100 到 100
    momentumScore: number;
    volatilityScore: number;
    volumeScore: number;
    overallScore: number;
  };
  
  // Agent 元数据
  agentMetadata: {
    agentName: 'TechnicalAnalyst';
    version: string;
    processingTimeMs: number;
    dataPoints: number;
  };
}

// ==================== 情绪分析 ====================

export interface NewsItem {
  title: string;
  summary: string;
  source: string;
  sentiment: number;          // -1 到 1
  relevance: number;          // 0 到 1
  timestamp: number;
  url?: string;
}

export interface SentimentReport {
  timestamp: number;
  
  // 细粒度分析
  newsAnalysis: {
    items: NewsItem[];
    aggregateSentiment: number;
    keyEvents: string[];
    impactAssessment: 'positive' | 'negative' | 'neutral';
  };
  
  socialAnalysis: {
    twitterSentiment: number;
    redditSentiment: number;
    trending: boolean;
    volume: number;
  };
  
  eventAnalysis: {
    upcomingEvents: Array<{
      event: string;
      date: number;
      expectedImpact: 'high' | 'medium' | 'low';
    }>;
    recentEvents: string[];
  };
  
  // 综合情绪
  overallSentiment: {
    score: number;            // -1 到 1
    confidence: number;       // 0 到 1
    direction: 'bullish' | 'bearish' | 'neutral';
  };
  
  agentMetadata: {
    agentName: 'SentimentAnalyst';
    version: string;
    processingTimeMs: number;
    sourcesChecked: number;
  };
}

// ==================== 链上分析 ====================

export interface WhaleMovement {
  address: string;
  amount: number;
  direction: 'in' | 'out';
  usdValue: number;
  timestamp: number;
}

export interface OnChainReport {
  timestamp: number;
  
  // 链上数据
  whaleActivity: {
    movements: WhaleMovement[];
    netFlow: number;          // 正数 = 流入, 负数 = 流出
    largeTransactions: number;
    signal: 'accumulation' | 'distribution' | 'neutral';
  };
  
  exchangeFlows: {
    netInflow: number;
    netOutflow: number;
    exchangeReserve: number;
    reserveChange: number;
  };
  
  fundingData: {
    fundingRate: number;
    openInterest: number;
    longShortRatio: number;
    liquidations: {
      long: number;
      short: number;
      total: number;
    };
  };
  
  // 综合信号
  onChainSignal: {
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    reasoning: string[];
  };
  
  agentMetadata: {
    agentName: 'OnChainAnalyst';
    version: string;
    processingTimeMs: number;
    dataSource: string;
  };
}

// ==================== 综合报告 ====================

export interface MarketIntelligenceReport {
  timestamp: number;
  symbol: string;
  
  // 各分析师报告
  technical: TechnicalReport;
  sentiment?: SentimentReport;
  onChain?: OnChainReport;
  
  // 数据可用性标记
  dataAvailability: {
    technical: boolean;
    sentiment: boolean;
    onChain: boolean;
  };
  
  // 市场状态评估
  marketState: {
    regime: 'trending_up' | 'trending_down' | 'ranging' | 'volatile';
    volatility: 'low' | 'medium' | 'high';
    liquidity: 'low' | 'medium' | 'high';
    riskLevel: RiskLevel;
  };
  
  // 元数据
  pipelineMetadata: {
    version: string;
    totalProcessingTimeMs: number;
    agentsUsed: string[];
    dataFreshness: number;    // 最新数据距今秒数
  };
}

// ==================== Agent 基础接口 ====================

export interface AnalystAgent {
  readonly name: string;
  readonly version: string;
  
  analyze(context: AnalysisContext): Promise<AgentOutput>;
  
  getStatus(): AgentStatus;
}

export interface AnalysisContext {
  symbol: string;
  ohlcv: OHLCV[];
  currentPrice: number;
  balance: number;
  hasPosition: boolean;
  currentPosition?: Position;
  additionalData?: Record<string, any>;
}

export interface AgentOutput {
  success: boolean;
  data?: any;
  error?: string;
  processingTimeMs: number;
}

export interface AgentStatus {
  healthy: boolean;
  lastRun: number;
  errorCount: number;
  avgProcessingTimeMs: number;
}

// ==================== 辅助类型 ====================

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  leverage: number;
}

// ==================== 导出 ====================

export const PIPELINE_VERSION = '2.0.0';
export const TECHNICAL_ANALYST_VERSION = '2.0.0';
export const SENTIMENT_ANALYST_VERSION = '2.0.0';
export const ONCHAIN_ANALYST_VERSION = '2.0.0';
