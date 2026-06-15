/**
 * 共享类型定义
 * 
 * 从 tradingBot.ts 提取的接口类型，供 orderGenerator、dashboard、
 * feedbackLoop、typeGuards 等模块引用，消除对 TradingBotRuntime 类的依赖。
 */

// ==================== 交易机器人配置 ====================

export interface TradingBotConfig {
  version: string;
  generatedAt: string;
  validUntil: string;
  
  symbol: string;
  
  entryConditions: {
    trend?: { direction: string; minStrength: number };
    momentum?: { 
      rsi?: { 
        longMin?: number;
        longMax?: number;
        shortMin?: number;
        shortMax?: number;
        min?: number;
        max?: number;
      }
    };
    volume?: { minRatio: number };
    price?: { above?: number; below?: number };
  };
  
  exitConditions: {
    takeProfit: {
      levels: number[];
      portions: number[];
    };
    stopLoss: {
      atrMultiplier: number;
      trailing: boolean;
      trailingPercent?: number;
    };
  };
  
  riskManagement: {
    maxPositionSize: number;
    maxLeverage: number;
    maxDrawdown: number;
    dailyLossLimit?: number;
  };
  
  orderSpec: {
    type: 'market' | 'limit';
    slippageTolerance: number;
  };
  
  metadata?: {
    reasoning?: string[];
    confidence?: number;
    marketRegime?: string;
  };
}

// ==================== 简版订单规格 ====================

export interface SimpleOrderSpec {
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  size: number;
  price?: number;
  stopPrice?: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  stopLoss: number;
  takeProfitLevels: Array<{
    price: number;
    portion: number;
    type: 'limit' | 'trailing';
    trailingPercent?: number;
  }>;
}

// ==================== 持仓 ====================

export interface Position {
  side: 'long' | 'short' | 'none';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  liquidationPrice?: number;
}

// ==================== 性能指标 ====================

export interface PerformanceMetrics {
  roi: number;
  dailyReturns: number[];
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  avgTradeDuration: number;
  totalPnl: number;
  winningTrades: number;
  losingTrades: number;
}

// ==================== 交易记录 ====================

export interface TradeRecord {
  timestamp: number;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  type: 'entry' | 'exit' | 'stop_loss' | 'take_profit';
  pnl?: number;
  reason: string;
}

// ==================== 性能数据提供者接口 ====================

/**
 * 任何能提供 PerformanceMetrics 的对象都实现此接口。
 * TradingBotRuntime 和 EventDrivenRuntime 均满足。
 */
export interface PerformanceProvider {
  getPerformanceMetrics(): PerformanceMetrics;
}
