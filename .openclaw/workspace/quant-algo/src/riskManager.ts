import { config } from './config';
import logger from './logger';
import { Position } from './events/types';
import { BayesianKellyManager, KellyResult } from './risk/bayesianKelly';

export { Position } from './events/types';
export { KellyResult } from './risk/bayesianKelly';
import { calculatePositionSize as canonicalPositionSize } from './risk/positionSizing';


export interface DailyStats {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  totalPnl: number;
  maxDrawdown: number;
}

export class RiskManager {
  private dailyStats: DailyStats;
  private lastTradeTime: Date | null = null;
  private consecutiveLosses: number = 0;
  private kelly: BayesianKellyManager;
  
  constructor() {
    this.dailyStats = this.initDailyStats();
    this.kelly = new BayesianKellyManager({
      kellyFraction: config.risk.positionSizing.kellyFraction,
      maxPositionFraction: config.risk.positionSizing.maxPositionSize,
      minPositionFraction: config.risk.positionSizing.minPositionSize,
    });
  }
  
  private initDailyStats(): DailyStats {
    return {
      date: new Date().toISOString().split('T')[0],
      trades: 0,
      wins: 0,
      losses: 0,
      totalPnl: 0,
      maxDrawdown: 0,
    };
  }
  
  // 检查是否可以开新仓位
  canOpenPosition(balance: number, currentPosition: Position | null): { allowed: boolean; reason?: string } {
    // 检查是否已有持仓
    if (currentPosition && currentPosition.side !== 'none') {
      return { allowed: false, reason: '已有持仓' };
    }
    
    // 检查冷却时间
    if (this.lastTradeTime) {
      const minutesSinceLastTrade = (Date.now() - this.lastTradeTime.getTime()) / (1000 * 60);
      if (minutesSinceLastTrade < config.riskManagement.cooldownMinutes && this.consecutiveLosses > 0) {
        return { 
          allowed: false, 
          reason: `冷却中，还需等待 ${Math.ceil(config.riskManagement.cooldownMinutes - minutesSinceLastTrade)} 分钟` 
        };
      }
    }
    
    // 检查日内最大亏损
    const dailyLossPercent = Math.abs(this.dailyStats.totalPnl) / config.initialBalance;
    if (this.dailyStats.totalPnl < 0 && dailyLossPercent >= config.riskManagement.maxDailyLoss) {
      return { allowed: false, reason: '已达到日内最大亏损限制' };
    }
    
    // 检查余额
    if (balance < 10) {
      return { allowed: false, reason: '余额不足 (最少需要 10 USDT)' };
    }
    
    return { allowed: true };
  }
  
  // 计算仓位大小 — delegates to Bayesian Kelly when sufficient data is available
  calculatePositionSize(balance: number, currentPrice: number, stopLossPrice: number, signalStrength?: number): number {
    // Try Bayesian Kelly first
    const kellyResult = this.kelly.calculatePositionSize(balance, currentPrice, signalStrength);
    
    if (kellyResult.method === 'kelly') {
      // Kelly has enough data — use its position size
      const notionalValue = kellyResult.positionSize * currentPrice;
      const maxNotional = balance * config.leverage * 0.5;
      
      let positionSize = kellyResult.positionSize;
      if (notionalValue > maxNotional) {
        positionSize = maxNotional / currentPrice;
        logger.warn(`Kelly仓位已限制为 ${positionSize.toFixed(4)} (名义价值 ${maxNotional.toFixed(2)} USDT)`);
      }
      
      logger.info(
        `📐 Kelly定仓 | 方法: ${kellyResult.method} | raw=${kellyResult.rawKelly.toFixed(4)} ` +
        `scaled=${kellyResult.scaledKelly.toFixed(4)} frac=${kellyResult.positionFraction.toFixed(4)} ` +
        `winRate=${(kellyResult.winRate * 100).toFixed(1)}% payoff=${kellyResult.payoffRatio.toFixed(2)} ` +
        `confidence=${(kellyResult.confidence * 100).toFixed(1)}%`
      );
      
      return positionSize;
    }
    
    // Fall back to canonical fixed-fractional sizing
    const result = canonicalPositionSize({
      balance,
      currentPrice,
      stopLossPrice,
      maxRiskPerTrade: config.maxRiskPerTrade,
      leverage: config.leverage,
      maxLeverageUtil: 0.5,
    });
    
    logger.info(
      `📐 固定比例定仓 | 方法: ${result.method} | fraction=${config.maxRiskPerTrade} ` +
      `Kelly数据不足 (${kellyResult.confidence.toFixed(0)}% 置信度)`
    );
    
    return result.size;
  }
  
  // 计算止损价格
  calculateStopLoss(entryPrice: number, side: 'long' | 'short'): number {
    const stopLossPercent = config.riskManagement.stopLossPercent;
    
    if (side === 'long') {
      return entryPrice * (1 - stopLossPercent);
    } else {
      return entryPrice * (1 + stopLossPercent);
    }
  }
  
  // 计算止盈价格
  calculateTakeProfit(entryPrice: number, side: 'long' | 'short'): number {
    const takeProfitPercent = config.riskManagement.takeProfitPercent;
    
    if (side === 'long') {
      return entryPrice * (1 + takeProfitPercent);
    } else {
      return entryPrice * (1 - takeProfitPercent);
    }
  }
  
  // 检查是否需要紧急平仓
  checkEmergencyExit(position: Position, currentPrice: number): { shouldExit: boolean; reason?: string } {
    if (position.side === 'none') {
      return { shouldExit: false };
    }
    
    // 计算未实现盈亏百分比
    let pnlPercent = 0;
    if (position.side === 'long') {
      pnlPercent = (currentPrice - position.entryPrice) / position.entryPrice;
    } else {
      pnlPercent = (position.entryPrice - currentPrice) / position.entryPrice;
    }
    
    // 考虑杠杆后的实际盈亏
    const leveragedPnl = pnlPercent * position.leverage;
    
    // 止损检查
    if (leveragedPnl <= -config.riskManagement.stopLossPercent * 100) {
      return { shouldExit: true, reason: '触发止损' };
    }
    
    // 止盈检查
    if (leveragedPnl >= config.riskManagement.takeProfitPercent * 100) {
      return { shouldExit: true, reason: '触发止盈' };
    }
    
    // 接近爆仓风险检查（距离爆仓价 10% 以内）
    if (position.liquidationPrice) {
      const distanceToLiquidation = Math.abs(currentPrice - position.liquidationPrice) / currentPrice;
      if (distanceToLiquidation < 0.1) {
        return { shouldExit: true, reason: '接近爆仓价，紧急平仓' };
      }
    }
    
    return { shouldExit: false };
  }
  
  // 记录交易结果
  recordTrade(pnl: number, balance?: number): void {
    this.dailyStats.trades++;
    this.dailyStats.totalPnl += pnl;
    
    if (pnl > 0) {
      this.dailyStats.wins++;
      this.consecutiveLosses = 0;
    } else {
      this.dailyStats.losses++;
      this.consecutiveLosses++;
    }
    
    this.lastTradeTime = new Date();
    
    // Feed the trade into Bayesian Kelly tracker
    const effectiveBalance = balance ?? config.initialBalance;
    this.kelly.recordTrade({
      pnl,
      returnPct: pnl / effectiveBalance,
      timestamp: Date.now(),
    });
    
    logger.info(`📊 交易记录 | PnL: ${pnl.toFixed(2)} USDT | 今日总盈亏: ${this.dailyStats.totalPnl.toFixed(2)} USDT`);
    
    // 如果连续亏损，增加冷却时间
    if (this.consecutiveLosses >= 3) {
      logger.warn(`⚠️ 连续亏损 ${this.consecutiveLosses} 次，进入冷却模式`);
    }
  }
  
  /**
   * Expose the Bayesian Kelly calculation for external inspection.
   * Returns the full KellyResult without any leverage clamping.
   */
  getKellyResult(equity: number, price: number, signalStrength?: number, realizedVol?: number): KellyResult {
    return this.kelly.calculatePositionSize(equity, price, signalStrength, realizedVol);
  }
  
  // 获取统计信息
  getStats(): DailyStats {
    // 检查是否需要重置（新的一天）
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.dailyStats.date) {
      this.dailyStats = this.initDailyStats();
      this.consecutiveLosses = 0;
    }
    
    return { ...this.dailyStats };
  }
  
  // 格式化统计输出
  formatStats(): string {
    const stats = this.getStats();
    const kellyStats = this.kelly.getStats();
    const winRate = stats.trades > 0 ? (stats.wins / stats.trades * 100).toFixed(1) : '0.0';
    
    return `
📈 今日交易统计
━━━━━━━━━━━━━━━━━━━━━
交易次数: ${stats.trades}
盈利: ${stats.wins} | 亏损: ${stats.losses}
胜率: ${winRate}%
总盈亏: ${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)} USDT
━━━━━━━━━━━━━━━━━━━━━
Kelly统计
  总交易数: ${kellyStats.tradeCount}
  近期胜率: ${(kellyStats.recentWinRate * 100).toFixed(1)}%
  Kelly比例: ${kellyStats.kellyFraction}
━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }
}

export default RiskManager;
