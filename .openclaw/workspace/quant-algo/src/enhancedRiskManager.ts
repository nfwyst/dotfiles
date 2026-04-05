import logger from './logger';
import { config } from './config';

export interface RiskCheck {
  allowed: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action?: 'allow' | 'reduce' | 'block';
  positionSizeMultiplier?: number;
}

export interface Position {
  side: 'long' | 'short' | 'none';
  size: number;
  entryPrice: number;
  leverage: number;
  unrealizedPnl: number;
  liquidationPrice?: number;
}

export interface AccountState {
  balance: number;
  equity: number;
  dailyPnl: number;
  dailyTrades: number;
  consecutiveLosses: number;
  maxDrawdown: number;
}

/**
 * 增强版风控系统
 * 
 * 针对 150x 杠杆的严格风控:
 * 1. 多层风险检查
 * 2. 动态仓位调整
 * 3. 紧急情况处理
 * 4. 连续亏损保护
 */
export class EnhancedRiskManager {
  private dailyStats = {
    date: new Date().toISOString().split('T')[0],
    trades: 0,
    wins: 0,
    losses: 0,
    totalPnl: 0,
    maxDrawdown: 0,
  };
  
  private consecutiveLosses = 0;
  private lastTradeTime: number | null = null;
  private cooldownEndTime = 0;
  private peakEquity = 0;
  private tradeHistory: { pnl: number; timestamp: number }[] = [];
  
  // 风控参数
  private limits = {
    maxDailyLoss: 0.10,           // 日内最大亏损 10%
    maxDailyTrades: 30,           // 每日最大交易 30 笔
    maxConsecutiveLosses: 3,      // 连续亏损 3 次后冷却
    cooldownMinutes: 30,          // 冷却时间 30 分钟
    maxPositionSizePercent: 0.5,  // 最大仓位 50% 余额
    minConfidence: 0.7,           // 最低置信度
    maxVolatility: 0.03,          // 最大波动率 3%
  };
  
  /**
   * 综合风险检查
   */
  checkAllRisks(
    account: AccountState,
    position: Position,
    signalConfidence: number,
    marketVolatility: number
  ): RiskCheck {
    // 1. 检查日内亏损限制
    const dailyLossCheck = this.checkDailyLoss(account);
    if (!dailyLossCheck.allowed) return dailyLossCheck;
    
    // 2. 检查交易频率
    const frequencyCheck = this.checkTradeFrequency();
    if (!frequencyCheck.allowed) return frequencyCheck;
    
    // 3. 检查连续亏损
    const consecutiveCheck = this.checkConsecutiveLosses();
    if (!consecutiveCheck.allowed) return consecutiveCheck;
    
    // 4. 检查信号质量
    const signalCheck = this.checkSignalQuality(signalConfidence);
    if (!signalCheck.allowed) return signalCheck;
    
    // 5. 检查市场状态
    const marketCheck = this.checkMarketConditions(marketVolatility);
    if (!marketCheck.allowed) return marketCheck;
    
    // 6. 检查持仓风险
    const positionCheck = this.checkPositionRisk(account, position);
    if (!positionCheck.allowed) return positionCheck;
    
    // 计算综合风险等级
    const riskLevel = this.calculateOverallRisk([
      dailyLossCheck,
      frequencyCheck,
      consecutiveCheck,
      signalCheck,
      marketCheck,
      positionCheck,
    ]);
    
    // 确定仓位调整
    const positionSizeMultiplier = this.calculatePositionSizeMultiplier(
      riskLevel,
      signalConfidence,
      account.consecutiveLosses
    );
    
    return {
      allowed: true,
      riskLevel,
      action: positionSizeMultiplier < 1 ? 'reduce' : 'allow',
      positionSizeMultiplier,
    };
  }
  
  /**
   * 检查日内亏损
   */
  private checkDailyLoss(account: AccountState): RiskCheck {
    const lossPercent = Math.abs(account.dailyPnl) / account.balance;
    
    if (lossPercent >= this.limits.maxDailyLoss) {
      return {
        allowed: false,
        reason: `已达到日内最大亏损限制 (${(lossPercent * 100).toFixed(1)}% >= ${(this.limits.maxDailyLoss * 100).toFixed(0)}%)`,
        riskLevel: 'critical',
        action: 'block',
      };
    }
    
    if (lossPercent >= this.limits.maxDailyLoss * 0.8) {
      return {
        allowed: true,
        reason: `接近日内亏损限制 (${(lossPercent * 100).toFixed(1)}%)，降低仓位`,
        riskLevel: 'high',
        action: 'reduce',
        positionSizeMultiplier: 0.5,
      };
    }
    
    return { allowed: true, riskLevel: 'low' };
  }
  
  /**
   * 检查交易频率
   */
  private checkTradeFrequency(): RiskCheck {
    // 检查冷却期
    if (Date.now() < this.cooldownEndTime) {
      const remaining = Math.ceil((this.cooldownEndTime - Date.now()) / 60000);
      return {
        allowed: false,
        reason: `冷却期中，还需 ${remaining} 分钟`,
        riskLevel: 'medium',
        action: 'block',
      };
    }
    
    // 检查每日交易次数
    if (this.dailyStats.trades >= this.limits.maxDailyTrades) {
      return {
        allowed: false,
        reason: `已达到每日最大交易次数 (${this.limits.maxDailyTrades})`,
        riskLevel: 'medium',
        action: 'block',
      };
    }
    
    return { allowed: true, riskLevel: 'low' };
  }
  
  /**
   * 检查连续亏损
   */
  private checkConsecutiveLosses(): RiskCheck {
    if (this.consecutiveLosses >= this.limits.maxConsecutiveLosses) {
      // 启动冷却
      this.cooldownEndTime = Date.now() + this.limits.cooldownMinutes * 60 * 1000;
      
      return {
        allowed: false,
        reason: `连续亏损 ${this.consecutiveLosses} 次，进入 ${this.limits.cooldownMinutes} 分钟冷却期`,
        riskLevel: 'high',
        action: 'block',
      };
    }
    
    if (this.consecutiveLosses >= 2) {
      return {
        allowed: true,
        reason: `连续亏损 ${this.consecutiveLosses} 次，降低仓位`,
        riskLevel: 'medium',
        action: 'reduce',
        positionSizeMultiplier: 0.5,
      };
    }
    
    return { allowed: true, riskLevel: 'low' };
  }
  
  /**
   * 检查信号质量
   */
  private checkSignalQuality(confidence: number): RiskCheck {
    if (confidence < this.limits.minConfidence * 0.8) {
      return {
        allowed: false,
        reason: `信号置信度过低 (${(confidence * 100).toFixed(0)}%)`,
        riskLevel: 'high',
        action: 'block',
      };
    }
    
    if (confidence < this.limits.minConfidence) {
      return {
        allowed: true,
        reason: `信号置信度偏低 (${(confidence * 100).toFixed(0)}%)`,
        riskLevel: 'medium',
        action: 'reduce',
        positionSizeMultiplier: 0.7,
      };
    }
    
    return { allowed: true, riskLevel: 'low' };
  }
  
  /**
   * 检查市场状态
   */
  private checkMarketConditions(volatility: number): RiskCheck {
    if (volatility > this.limits.maxVolatility) {
      return {
        allowed: false,
        reason: `波动率过高 (${(volatility * 100).toFixed(1)}% > ${(this.limits.maxVolatility * 100).toFixed(1)}%)`,
        riskLevel: 'high',
        action: 'block',
      };
    }
    
    if (volatility > this.limits.maxVolatility * 0.7) {
      return {
        allowed: true,
        reason: `波动率偏高 (${(volatility * 100).toFixed(1)}%)`,
        riskLevel: 'medium',
        action: 'reduce',
        positionSizeMultiplier: 0.7,
      };
    }
    
    return { allowed: true, riskLevel: 'low' };
  }
  
  /**
   * 检查持仓风险
   */
  private checkPositionRisk(account: AccountState, position: Position): RiskCheck {
    // 检查是否已有持仓
    if (position.side !== 'none') {
      // 检查浮亏
      const unrealizedPnlPercent = Math.abs(position.unrealizedPnl) / account.balance;
      
      if (unrealizedPnlPercent > 0.05) {
        return {
          allowed: false,
          reason: `当前持仓浮亏过大 (${(unrealizedPnlPercent * 100).toFixed(1)}%)，不建议开新仓`,
          riskLevel: 'high',
          action: 'block',
        };
      }
    }
    
    // 检查最大回撤
    if (account.maxDrawdown > 0.15) {
      return {
        allowed: true,
        reason: `最大回撤较大 (${(account.maxDrawdown * 100).toFixed(1)}%)，降低仓位`,
        riskLevel: 'medium',
        action: 'reduce',
        positionSizeMultiplier: 0.6,
      };
    }
    
    return { allowed: true, riskLevel: 'low' };
  }
  
  /**
   * 计算综合风险等级
   */
  private calculateOverallRisk(checks: RiskCheck[]): 'low' | 'medium' | 'high' | 'critical' {
    const scores = checks.map(c => {
      switch (c.riskLevel) {
        case 'critical': return 4;
        case 'high': return 3;
        case 'medium': return 2;
        case 'low': return 1;
        default: return 1;
      }
    });
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    if (avgScore >= 3.5) return 'critical';
    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    return 'low';
  }
  
  /**
   * 计算仓位调整倍数
   */
  private calculatePositionSizeMultiplier(
    riskLevel: string,
    confidence: number,
    consecutiveLosses: number
  ): number {
    let multiplier = 1.0;
    
    // 基于风险等级
    switch (riskLevel) {
      case 'critical': multiplier = 0; break;
      case 'high': multiplier = 0.5; break;
      case 'medium': multiplier = 0.8; break;
      case 'low': multiplier = 1.0; break;
    }
    
    // 基于置信度微调
    if (confidence > 0.85) multiplier *= 1.2;
    else if (confidence < 0.7) multiplier *= 0.8;
    
    // 基于连续亏损
    if (consecutiveLosses > 0) {
      multiplier *= Math.pow(0.7, consecutiveLosses);
    }
    
    return Math.max(0.3, Math.min(1.5, multiplier));
  }
  
  /**
   * 记录交易结果
   */
  recordTrade(pnl: number): void {
    this.dailyStats.trades++;
    this.dailyStats.totalPnl += pnl;
    
    if (pnl > 0) {
      this.dailyStats.wins++;
      this.consecutiveLosses = 0;
    } else {
      this.dailyStats.losses++;
      this.consecutiveLosses++;
    }
    
    this.lastTradeTime = Date.now();
    
    this.tradeHistory.push({ pnl, timestamp: Date.now() });
    if (this.tradeHistory.length > 50) this.tradeHistory.shift();
    
    // 检查是否需要重置每日统计
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.dailyStats.date) {
      this.resetDailyStats();
    }
  }
  
  /**
   * 检查紧急情况
   */
  checkEmergency(position: Position, currentPrice: number): {
    shouldExit: boolean;
    reason?: string;
  } {
    if (position.side === 'none') return { shouldExit: false };
    
    // 检查爆仓风险
    if (position.liquidationPrice) {
      const distanceToLiquidation = Math.abs(currentPrice - position.liquidationPrice) / currentPrice;
      
      if (distanceToLiquidation < 0.02) {
        return {
          shouldExit: true,
          reason: '⚠️ 接近爆仓价，紧急平仓！',
        };
      }
    }
    
    // 检查极端亏损
    const pnlPercent = position.unrealizedPnl / (position.entryPrice * position.size);
    const leveragedPnl = pnlPercent * position.leverage;
    
    if (leveragedPnl <= -0.02) { // 150x杠杆下约2%价格波动 = 300%亏损
      return {
        shouldExit: true,
        reason: `⚠️ 亏损超过 2% (${(leveragedPnl * 100).toFixed(1)}%)，强制止损！`,
      };
    }
    
    return { shouldExit: false };
  }
  
  /**
   * 重置每日统计
   */
  private resetDailyStats(): void {
    this.dailyStats = {
      date: new Date().toISOString().split('T')[0],
      trades: 0,
      wins: 0,
      losses: 0,
      totalPnl: 0,
      maxDrawdown: 0,
    };
    this.consecutiveLosses = 0;
  }
  
  /**
   * 获取风控统计
   */
  getStats(): {
    dailyTrades: number;
    dailyPnl: number;
    consecutiveLosses: number;
    inCooldown: boolean;
    riskLevel: string;
  } {
    return {
      dailyTrades: this.dailyStats.trades,
      dailyPnl: this.dailyStats.totalPnl,
      consecutiveLosses: this.consecutiveLosses,
      inCooldown: Date.now() < this.cooldownEndTime,
      riskLevel: this.consecutiveLosses >= 2 ? 'elevated' : 'normal',
    };
  }
  
  /**
   * 格式化统计输出
   */
  formatStats(): string {
    const stats = this.getStats();
    const winRate = this.dailyStats.trades > 0
      ? (this.dailyStats.wins / this.dailyStats.trades * 100).toFixed(1)
      : '0.0';
    
    return `
📊 风控统计
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
今日交易: ${stats.dailyTrades} 笔 (胜 ${this.dailyStats.wins} / 负 ${this.dailyStats.losses})
胜率: ${winRate}%
今日盈亏: ${stats.dailyPnl >= 0 ? '+' : ''}${stats.dailyPnl.toFixed(2)} USDT
连续亏损: ${stats.consecutiveLosses} 次
冷却状态: ${stats.inCooldown ? '🔴 冷却中' : '🟢 正常'}
风险等级: ${stats.riskLevel === 'elevated' ? '🟡  elevated' : '🟢 normal'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }
}

export default EnhancedRiskManager;
