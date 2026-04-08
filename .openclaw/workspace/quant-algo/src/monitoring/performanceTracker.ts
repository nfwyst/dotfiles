/**
 * 性能追踪器
 * 记录和计算交易性能指标
 * 
 * 用于 Adaptive-OPRO 的滚动窗口评估
 */

import logger from '../logger';
import fs from 'fs';
import path from 'path';

// ==================== 类型定义 ====================

export interface TradeRecord {
  id: string;
  timestamp: number;
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  type: 'entry' | 'exit' | 'stop_loss' | 'take_profit';
  pnl?: number;
  fees?: number;
  reason: string;
  agentDecision?: string;
}

export interface DailyMetrics {
  date: string;
  startBalance: number;
  endBalance: number;
  pnl: number;
  roi: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  maxDrawdown: number;
  peakBalance: number;
}

export interface PerformanceMetrics {
  // 收益指标
  totalPnl: number;
  totalRoi: number;
  dailyReturns: number[];
  cumulativeReturns: number[];
  
  // 风险指标
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  volatility: number;
  
  // 交易指标
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgTradeDuration: number; // 分钟
  
  // 时间范围
  startDate: number;
  endDate: number;
  tradingDays: number;
  
  // 最近窗口 (用于 OPRO)
  lastWindowMetrics?: {
    roi: number;
    tradeCount: number;
    winRate: number;
    maxDrawdown: number;
  };
}

export interface PerformanceReport {
  timestamp: number;
  metrics: PerformanceMetrics;
  recentTrades: TradeRecord[];
  dailyMetrics: DailyMetrics[];
  recommendations: string[];
}

// ==================== PerformanceTracker ====================

export class PerformanceTracker {
  private trades: TradeRecord[] = [];
  private dailyMetrics: DailyMetrics[] = [];
  
  private balance: number;
  private initialBalance: number;
  private peakBalance: number;
  
  private windowSize: number; // 天
  private dataPath: string;
  
  constructor(initialBalance: number = 1000, windowSize: number = 5, dataPath?: string) {
    this.balance = initialBalance;
    this.initialBalance = initialBalance;
    this.peakBalance = initialBalance;
    this.windowSize = windowSize;
    this.dataPath = dataPath || './data/performance.json';
    
    this.loadData();
  }
  
  /**
   * 记录交易
   */
  recordTrade(trade: Omit<TradeRecord, 'id'>): void {
    const fullTrade: TradeRecord = {
      ...trade,
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    };
    
    this.trades.push(fullTrade);
    
    // 更新余额
    if (trade.pnl !== undefined) {
      this.balance += trade.pnl;
      this.peakBalance = Math.max(this.peakBalance, this.balance);
    }
    
    // 更新日指标
    this.updateDailyMetrics(trade);
    
    // 保存
    this.saveData();
    
    logger.debug(`📝 Trade recorded: ${trade.side} ${trade.size} @ ${trade.price}`);
  }
  
  /**
   * 批量记录交易
   */
  recordTrades(trades: Omit<TradeRecord, 'id'>[]): void {
    for (const trade of trades) {
      this.recordTrade(trade);
    }
  }
  
  /**
   * 计算性能指标
   */
  calculateMetrics(): PerformanceMetrics {
    const now = Date.now();
    const startDate = this.trades.length > 0 
      ? this.trades[0].timestamp 
      : now;
    
    // 收益指标
    const totalPnl = this.balance - this.initialBalance;
    const totalRoi = totalPnl / this.initialBalance;
    
    // 日收益
    const dailyReturns = this.dailyMetrics.map(d => d.roi);
    const cumulativeReturns: number[] = [];
    let cumulative = 0;
    for (const r of dailyReturns) {
      cumulative += r;
      cumulativeReturns.push(cumulative);
    }
    
    // 风险指标
    const maxDrawdown = this.calculateMaxDrawdown();
    const maxDrawdownPercent = maxDrawdown / this.peakBalance;
    const volatility = this.calculateVolatility(dailyReturns);
    const sharpeRatio = this.calculateSharpeRatio(dailyReturns, volatility);
    const sortinoRatio = this.calculateSortinoRatio(dailyReturns);
    const calmarRatio = totalRoi / (maxDrawdownPercent || 1);
    
    // 交易指标
    const closedTrades = this.trades.filter(t => t.type !== 'entry');
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
    
    const totalTrades = closedTrades.length;
    const winCount = winningTrades.length;
    const lossCount = losingTrades.length;
    const winRate = totalTrades > 0 ? winCount / totalTrades : 0;
    
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winCount 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / lossCount) 
      : 0;
    
    const profitFactor = avgLoss > 0 ? (avgWin * winCount) / (avgLoss * lossCount) : 
                         avgWin > 0 ? Infinity : 0;
    
    // 平均持仓时间
    const avgTradeDuration = this.calculateAvgTradeDuration();
    
    // 交易天数
    const tradingDays = this.dailyMetrics.length;
    
    // 最近窗口指标
    const lastWindowMetrics = this.calculateWindowMetrics();
    
    return {
      totalPnl,
      totalRoi,
      dailyReturns,
      cumulativeReturns,
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      volatility,
      totalTrades,
      winningTrades: winCount,
      losingTrades: lossCount,
      winRate: winRate * 100,
      avgWin,
      avgLoss,
      profitFactor,
      avgTradeDuration,
      startDate,
      endDate: now,
      tradingDays,
      lastWindowMetrics,
    };
  }
  
  /**
   * 计算最近窗口指标 (用于 OPRO)
   */
  calculateWindowMetrics(): { roi: number; tradeCount: number; winRate: number; maxDrawdown: number } {
    const windowStart = Date.now() - this.windowSize * 24 * 60 * 60 * 1000;
    
    const windowTrades = this.trades.filter(t => t.timestamp >= windowStart);
    const closedTrades = windowTrades.filter(t => t.type !== 'entry');
    
    const roi = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / this.initialBalance;
    const tradeCount = closedTrades.length;
    const winCount = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const winRate = tradeCount > 0 ? winCount / tradeCount : 0;
    
    // 窗口内最大回撤
    let peak = this.initialBalance;
    let maxDD = 0;
    let balance = this.initialBalance;
    
    for (const trade of windowTrades) {
      if (trade.pnl !== undefined) {
        balance += trade.pnl;
        peak = Math.max(peak, balance);
        maxDD = Math.max(maxDD, peak - balance);
      }
    }
    
    return {
      roi,
      tradeCount,
      winRate: winRate * 100,
      maxDrawdown: maxDD / this.initialBalance,
    };
  }
  
  /**
   * 生成性能报告
   */
  generateReport(): PerformanceReport {
    const metrics = this.calculateMetrics();
    const recentTrades = this.trades.slice(-20);
    const dailyMetrics = this.dailyMetrics.slice(-30);
    const recommendations = this.generateRecommendations(metrics);
    
    return {
      timestamp: Date.now(),
      metrics,
      recentTrades,
      dailyMetrics,
      recommendations,
    };
  }
  
  /**
   * 生成改进建议
   */
  private generateRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];
    
    // 低胜率
    if (metrics.winRate < 40) {
      recommendations.push('⚠️ 胜率低于 40%，建议优化入场条件');
    }
    
    // 高回撤
    if (metrics.maxDrawdownPercent > 0.15) {
      recommendations.push('⚠️ 最大回撤超过 15%，建议加强风险控制');
    }
    
    // 低盈亏比
    if (metrics.profitFactor < 1 && metrics.profitFactor > 0) {
      recommendations.push('⚠️ 盈亏比小于 1，建议调整止损止盈');
    }
    
    // 夏普比率
    if (metrics.sharpeRatio < 0) {
      recommendations.push('⚠️ 夏普比率为负，策略表现不如无风险收益');
    } else if (metrics.sharpeRatio > 1) {
      recommendations.push('✓ 夏普比率良好 (>1)');
    }
    
    // 交易频率
    if (metrics.tradingDays > 0 && metrics.totalTrades / metrics.tradingDays < 0.3) {
      recommendations.push('📉 交易频率较低，可能错过机会');
    } else if (metrics.tradingDays > 0 && metrics.totalTrades / metrics.tradingDays > 5) {
      recommendations.push('📈 交易频率较高，注意手续费和滑点');
    }
    
    return recommendations;
  }
  
  /**
   * 计算最大回撤
   */
  private calculateMaxDrawdown(): number {
    if (this.trades.length === 0) return 0;
    
    let peak = this.initialBalance;
    let maxDrawdown = 0;
    let balance = this.initialBalance;
    
    for (const trade of this.trades) {
      if (trade.pnl !== undefined) {
        balance += trade.pnl;
        peak = Math.max(peak, balance);
        maxDrawdown = Math.max(maxDrawdown, peak - balance);
      }
    }
    
    return maxDrawdown;
  }
  
  /**
   * 计算波动率
   */
  private calculateVolatility(dailyReturns: number[]): number {
    if (dailyReturns.length < 2) return 0;
    
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // 年化
  }
  
  /**
   * 计算夏普比率
   */
  private calculateSharpeRatio(dailyReturns: number[], volatility: number): number {
    if (dailyReturns.length < 2 || volatility === 0) return 0;
    
    const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const riskFreeRate = 0.04 / 252; // 假设年化 4%
    
    return (meanReturn - riskFreeRate) / (volatility / Math.sqrt(252));
  }
  
  /**
   * 计算索提诺比率
   */
  private calculateSortinoRatio(dailyReturns: number[]): number {
    if (dailyReturns.length < 2) return 0;
    
    const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const riskFreeRate = 0.04 / 252;
    
    // 只计算下行波动率
    const negativeReturns = dailyReturns.filter(r => r < 0);
    if (negativeReturns.length === 0) return meanReturn > 0 ? Infinity : 0;
    
    const downVol = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    );
    
    return downVol > 0 ? (meanReturn - riskFreeRate) / downVol : 0;
  }
  
  /**
   * 计算平均持仓时间
   */
  private calculateAvgTradeDuration(): number {
    // 简化：需要配对 entry/exit
    const entries = this.trades.filter(t => t.type === 'entry');
    const exits = this.trades.filter(t => t.type !== 'entry');
    
    if (entries.length === 0 || exits.length === 0) return 0;
    
    // 简化计算：使用最后 N 个交易
    const recentPairs = Math.min(entries.length, exits.length, 10);
    
    let totalDuration = 0;
    for (let i = 0; i < recentPairs; i++) {
      const entry = entries[entries.length - recentPairs + i];
      const exit = exits[exits.length - recentPairs + i];
      
      if (entry && exit) {
        totalDuration += (exit.timestamp - entry.timestamp) / 1000 / 60; // 分钟
      }
    }
    
    return recentPairs > 0 ? totalDuration / recentPairs : 0;
  }
  
  /**
   * 更新日指标
   */
  private updateDailyMetrics(trade: TradeRecord): void {
    const today = new Date().toISOString().split('T')[0];
    
    let daily = this.dailyMetrics.find(d => d.date === today);
    
    if (!daily) {
      daily = {
        date: today,
        startBalance: this.balance,
        endBalance: this.balance,
        pnl: 0,
        roi: 0,
        tradeCount: 0,
        winCount: 0,
        lossCount: 0,
        maxDrawdown: 0,
        peakBalance: this.balance,
      };
      this.dailyMetrics.push(daily);
    }
    
    // 更新
    if (trade.pnl !== undefined) {
      daily.pnl += trade.pnl;
      daily.endBalance = this.balance;
      daily.roi = daily.pnl / daily.startBalance;
      daily.peakBalance = Math.max(daily.peakBalance, this.balance);
      
      if (trade.pnl > 0) {
        daily.winCount++;
      } else if (trade.pnl < 0) {
        daily.lossCount++;
      }
    }
    
    daily.tradeCount++;
  }
  
  /**
   * 设置当前余额
   */
  setBalance(balance: number): void {
    this.balance = balance;
    this.peakBalance = Math.max(this.peakBalance, balance);
  }
  
  /**
   * 获取当前余额
   */
  getBalance(): number {
    return this.balance;
  }
  
  /**
   * 获取交易历史
   */
  getTradeHistory(): TradeRecord[] {
    return [...this.trades];
  }
  
  /**
   * 重置
   */
  reset(initialBalance?: number): void {
    this.trades = [];
    this.dailyMetrics = [];
    this.balance = initialBalance || this.initialBalance;
    this.initialBalance = this.balance;
    this.peakBalance = this.balance;
    this.saveData();
  }
  
  /**
   * 加载数据
   */
  private loadData(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
        
        if (data.trades) this.trades = data.trades;
        if (data.dailyMetrics) this.dailyMetrics = data.dailyMetrics;
        if (data.balance) this.balance = data.balance;
        if (data.initialBalance) this.initialBalance = data.initialBalance;
        if (data.peakBalance) this.peakBalance = data.peakBalance;
      }
    } catch (error: unknown) {
      logger.warn(`Failed to load performance data: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }
  
  /**
   * 保存数据
   */
  private saveData(): void {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const data = {
        trades: this.trades,
        dailyMetrics: this.dailyMetrics,
        balance: this.balance,
        initialBalance: this.initialBalance,
        peakBalance: this.peakBalance,
        savedAt: Date.now(),
      };
      
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error: unknown) {
      logger.error(`Failed to save performance data: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }
}

export default PerformanceTracker;
