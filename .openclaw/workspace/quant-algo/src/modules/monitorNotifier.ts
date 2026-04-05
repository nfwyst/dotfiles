/**
 * 4. 系统通知和监控模块 v2.0
 * 
 * 职责:
 * - 监控市场价格变化
 * - 在无法API设置动态TP/SL时，自动执行止盈止损
 * - 风险管理 (交易前检查、持仓风险监控)
 * - 管理各种通知(Telegram等)
 * - 系统健康检查
 */

import fs from 'fs';

// 风险限制配置
export interface RiskLimits {
  maxPositionSizePercent: number;      // 最大仓位占余额百分比
  maxRiskPerTradePercent: number;      // 单笔交易最大风险
  maxDailyLossPercent: number;         // 日最大亏损
  maxDrawdownPercent: number;          // 最大回撤
  maxLeverage: number;                 // 最大杠杆
  maxOpenPositions: number;            // 最大持仓数
  minRiskRewardRatio: number;          // 最小风险回报比
}

// 默认风险限制
const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSizePercent: 5,     // 最大5%仓位
  maxRiskPerTradePercent: 1,     // 单笔1%风险
  maxDailyLossPercent: 3,        // 日亏损3%
  maxDrawdownPercent: 10,        // 最大回撤10%
  maxLeverage: 100,              // 最大100x
  maxOpenPositions: 1,           // 最多1个持仓
  minRiskRewardRatio: 1.5,       // 最小1.5:1
};

export interface Position {
  id: string;
  side: 'long' | 'short';
  symbol: string;
  entryPrice: number;
  contracts: number;
  leverage: number;
  margin: number;
  stopLoss: number;
  takeProfits: {
    tp1: number;
    tp2: number;
    tp3: number;
  };
  tp1Executed: boolean;
  tp2Executed: boolean;
  tp3Executed: boolean;
  openedAt: number;
  
  // 追踪止损
  trailingStop?: {
    enabled: boolean;
    activationPrice: number;
    callbackRate: number;
    currentStop: number;
  };
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  adjustedPositionSize?: number;
  riskMetrics?: {
    positionRiskPercent: number;
    accountRiskPercent: number;
    riskRewardRatio: number;
    potentialLoss: number;
    potentialProfit: number;
  };
}

export interface Notification {
  id: string;
  type: 'trade' | 'alert' | 'error' | 'info' | 'tp_sl' | 'risk';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  content: string;
  timestamp: number;
  sent: boolean;
  channels: string[];
}

export interface MonitorConfig {
  checkInterval: number;
  tpSlCheckInterval: number;
  notificationCooldown: number;
  maxRetries: number;
  riskLimits: RiskLimits;
}

export class MonitorNotifierModule {
  private config: MonitorConfig;
  private positions: Map<string, Position> = new Map();
  private notifications: Notification[] = [];
  private lastNotificationTime: Map<string, number> = new Map();
  private isRunning = false;
  private checkTimer: NodeJS.Timeout | null = null;
  private reportTimer: NodeJS.Timeout | null = null;
  private lastReportTime: number = 0;
  
  // 风险追踪
  private dailyStats: {
    date: string;
    totalPnL: number;
    trades: number;
    maxDrawdown: number;
    peakBalance: number;
  } = {
    date: new Date().toISOString().split('T')[0],
    totalPnL: 0,
    trades: 0,
    maxDrawdown: 0,
    peakBalance: 0,
  };
  
  // 回调函数
  private onTPSLTriggered?: (position: Position, type: 'tp1' | 'tp2' | 'tp3' | 'sl', price: number) => Promise<void>;
  private onSendNotification?: (notification: Notification) => Promise<void>;
  private getCurrentBalance?: () => number;
  private getCurrentPrice?: () => number;

  constructor(config?: Partial<Omit<MonitorConfig, 'riskLimits'>> & { riskLimits?: Partial<RiskLimits> }) {
    this.config = {
      checkInterval: 5000,
      tpSlCheckInterval: 3000,
      notificationCooldown: 60000,
      maxRetries: 3,
      riskLimits: { ...DEFAULT_RISK_LIMITS, ...config?.riskLimits },
    };
  }
  
  setCallbacks(callbacks: {
    onTPSLTriggered?: (position: Position, type: 'tp1' | 'tp2' | 'tp3' | 'sl', price: number) => Promise<void>;
    onSendNotification?: (notification: Notification) => Promise<void>;
    getCurrentBalance?: () => number;
    getCurrentPrice?: () => number;
  }) {
    this.onTPSLTriggered = callbacks.onTPSLTriggered;
    this.onSendNotification = callbacks.onSendNotification;
    this.getCurrentBalance = callbacks.getCurrentBalance;
    this.getCurrentPrice = callbacks.getCurrentPrice;
  }
  
  /**
   * ████████ 风险管理核心方法 ████████
   */
  
  /**
   * 交易前风险检查
   * 在开仓前调用，检查是否符合风险限制
   */
  checkTradeRisk(params: {
    side: 'long' | 'short';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    quantity: number;
    balance: number;
    hasPosition: boolean;
    currentPositions?: Position[];
  }): RiskCheckResult {
    const { 
      side, entryPrice, stopLoss, takeProfit, 
      quantity, balance, hasPosition, currentPositions 
    } = params;
    
    // 1. 检查是否已有持仓
    if (hasPosition && this.config.riskLimits.maxOpenPositions === 1) {
      return {
        allowed: false,
        reason: '已有持仓，等待当前持仓平仓后再开仓',
      };
    }
    
    // 2. 检查持仓数量限制
    const openPositions = currentPositions?.length || this.positions.size;
    if (openPositions >= this.config.riskLimits.maxOpenPositions) {
      return {
        allowed: false,
        reason: `已达到最大持仓数限制 (${this.config.riskLimits.maxOpenPositions})`,
      };
    }
    
    // 3. 计算仓位大小限制
    const positionValue = quantity * entryPrice;
    const positionSizePercent = (positionValue / balance) * 100;
    
    if (positionSizePercent > this.config.riskLimits.maxPositionSizePercent) {
      const maxQuantity = (balance * this.config.riskLimits.maxPositionSizePercent / 100) / entryPrice;
      return {
        allowed: false,
        reason: `仓位过大: ${positionSizePercent.toFixed(2)}% > ${this.config.riskLimits.maxPositionSizePercent}%`,
        adjustedPositionSize: maxQuantity,
      };
    }
    
    // 4. 计算单笔交易风险
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const riskAmount = quantity * stopDistance;
    const riskPercent = (riskAmount / balance) * 100;
    
    if (riskPercent > this.config.riskLimits.maxRiskPerTradePercent) {
      const maxQuantity = (balance * this.config.riskLimits.maxRiskPerTradePercent / 100) / stopDistance;
      return {
        allowed: false,
        reason: `单笔风险过高: ${riskPercent.toFixed(2)}% > ${this.config.riskLimits.maxRiskPerTradePercent}%`,
        adjustedPositionSize: maxQuantity,
        riskMetrics: {
          positionRiskPercent: riskPercent,
          accountRiskPercent: riskPercent,
          riskRewardRatio: 0,
          potentialLoss: riskAmount,
          potentialProfit: 0,
        },
      };
    }
    
    // 5. 检查风险回报比
    const profitDistance = Math.abs(takeProfit - entryPrice);
    const riskRewardRatio = profitDistance / stopDistance;
    
    if (riskRewardRatio < this.config.riskLimits.minRiskRewardRatio) {
      return {
        allowed: false,
        reason: `风险回报比不足: ${riskRewardRatio.toFixed(2)}:1 < ${this.config.riskLimits.minRiskRewardRatio}:1`,
      };
    }
    
    // 6. 检查日亏损限制
    if (this.dailyStats.totalPnL < 0) {
      const dailyLossPercent = (Math.abs(this.dailyStats.totalPnL) / balance) * 100;
      if (dailyLossPercent >= this.config.riskLimits.maxDailyLossPercent) {
        return {
          allowed: false,
          reason: `已达到日亏损限制: ${dailyLossPercent.toFixed(2)}% >= ${this.config.riskLimits.maxDailyLossPercent}%`,
        };
      }
    }
    
    // 计算潜在盈亏
    const potentialProfit = quantity * profitDistance;
    const potentialLoss = quantity * stopDistance;
    
    return {
      allowed: true,
      riskMetrics: {
        positionRiskPercent: riskPercent,
        accountRiskPercent: riskPercent,
        riskRewardRatio,
        potentialLoss,
        potentialProfit,
      },
    };
  }
  
  /**
   * 持仓风险监控
   * 检查现有持仓的风险状况
   */
  checkPositionRisk(position: Position, currentPrice: number): {
    status: 'safe' | 'warning' | 'danger' | 'liquidation';
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    distanceToSL: number;
    distanceToLiquidation?: number;
    recommendation?: string;
  } {
    const entryValue = position.contracts * position.entryPrice;
    const currentValue = position.contracts * currentPrice;
    
    const unrealizedPnL = position.side === 'long'
      ? currentValue - entryValue
      : entryValue - currentValue;
    
    const unrealizedPnLPercent = (unrealizedPnL / entryValue) * 100;
    
    // 计算到止损的距离
    const distanceToSL = position.side === 'long'
      ? ((currentPrice - position.stopLoss) / currentPrice) * 100
      : ((position.stopLoss - currentPrice) / currentPrice) * 100;
    
    // 判断风险状态
    let status: 'safe' | 'warning' | 'danger' | 'liquidation' = 'safe';
    let recommendation: string | undefined;
    
    if (unrealizedPnLPercent <= -50) {
      status = 'liquidation';
      recommendation = '⚠️ 严重亏损，考虑立即止损或减仓';
    } else if (unrealizedPnLPercent <= -30) {
      status = 'danger';
      recommendation = '⚠️ 高风险，密切监控';
    } else if (distanceToSL <= 0.5) {
      status = 'warning';
      recommendation = '⚠️ 接近止损位';
    } else if (unrealizedPnLPercent >= 50) {
      status = 'safe';
      recommendation = '✓ 盈利良好，可考虑移动止损';
    }
    
    return {
      status,
      unrealizedPnL,
      unrealizedPnLPercent,
      distanceToSL,
      recommendation,
    };
  }
  
  /**
   * 更新交易统计（用于日亏损计算）
   */
  updateTradeStats(pnl: number, balance: number) {
    const today = new Date().toISOString().split('T')[0];
    
    // 检查是否新的一天
    if (today !== this.dailyStats.date) {
      this.dailyStats = {
        date: today,
        totalPnL: 0,
        trades: 0,
        maxDrawdown: 0,
        peakBalance: balance,
      };
    }
    
    this.dailyStats.totalPnL += pnl;
    this.dailyStats.trades++;
    
    // 更新峰值和回撤
    if (balance > this.dailyStats.peakBalance) {
      this.dailyStats.peakBalance = balance;
    }
    const drawdown = ((this.dailyStats.peakBalance - balance) / this.dailyStats.peakBalance) * 100;
    if (drawdown > this.dailyStats.maxDrawdown) {
      this.dailyStats.maxDrawdown = drawdown;
    }
    
    // 检查日亏损限制
    if (this.dailyStats.totalPnL < 0) {
      const dailyLossPercent = (Math.abs(this.dailyStats.totalPnL) / balance) * 100;
      if (dailyLossPercent >= this.config.riskLimits.maxDailyLossPercent * 0.8) {
        this.notify({
          type: 'risk',
          priority: 'high',
          title: '⚠️ 日亏损接近限制',
          content: `今日亏损: ${dailyLossPercent.toFixed(2)}% / ${this.config.riskLimits.maxDailyLossPercent}%`,
          channels: ['telegram', 'log']
        });
      }
    }
  }
  
  /**
   * 计算建议仓位大小（基于风险限制）
   */
  calculatePositionSize(
    balance: number,
    entryPrice: number,
    stopLoss: number,
    riskPercent?: number
  ): number {
    const targetRisk = riskPercent || this.config.riskLimits.maxRiskPerTradePercent;
    const riskAmount = balance * (targetRisk / 100);
    const stopDistance = Math.abs(entryPrice - stopLoss);
    
    if (stopDistance === 0) return 0;
    
    const contracts = riskAmount / stopDistance;
    
    // 检查仓位大小限制
    const maxPositionValue = balance * (this.config.riskLimits.maxPositionSizePercent / 100) * this.config.riskLimits.maxLeverage;
    const maxContracts = maxPositionValue / entryPrice;
    
    return Math.min(contracts, maxContracts);
  }
  
  /**
   * ████████ 监控和通知方法 ████████
   */
  
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.checkTimer = setInterval(() => {
      this.checkLoop();
    }, this.config.checkInterval);

    // 30分钟定期报告
    this.reportTimer = setInterval(() => {
      this.sendPeriodicReport();
    }, 30 * 60 * 1000); // 30分钟

    this.lastReportTime = Date.now();

    this.log('info', '监控通知模块已启动', {
      checkInterval: this.config.checkInterval,
      reportInterval: '30分钟',
      riskLimits: this.config.riskLimits
    });
  }
  
  stop() {
    this.isRunning = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
    this.log('info', '监控通知模块已停止');
  }
  
  addPosition(position: Position) {
    this.positions.set(position.id, position);
    
    // 发送Telegram通知 - 开仓
    const pnlPercent = ((position.currentPrice - position.entryPrice) / position.entryPrice * 100).toFixed(2);
    this.notify({
      id: this.generateId(),
      type: 'trade',
      priority: 'high',
      title: `📈 新开仓 ${position.side.toUpperCase()}`,
      content: `💰 价格: ${position.entryPrice.toFixed(2)} USDT\n` +
               `📊 数量: ${position.contracts.toFixed(4)} ETH\n` +
               `🛑 止损: ${position.stopLoss.toFixed(2)} (${((Math.abs(position.stopLoss - position.entryPrice) / position.entryPrice) * 100).toFixed(1)}%)\n` +
               `🎯 TP1: ${position.takeProfits.tp1.toFixed(2)} | TP3: ${position.takeProfits.tp3.toFixed(2)}\n` +
               `⏰ 时间: ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      sent: false,
      channels: ['telegram', 'log']
    });
    
    // 立即处理高优先级通知
    this.processNotification({
      id: this.generateId(),
      type: 'trade',
      priority: 'high',
      title: `📈 新开仓 ${position.side.toUpperCase()}`,
      content: `💰 价格: ${position.entryPrice.toFixed(2)} USDT`,
      timestamp: Date.now(),
      sent: false,
      channels: ['telegram', 'log']
    });
  }
  
  removePosition(positionId: string, reason?: string) {
    const position = this.positions.get(positionId);
    if (position) {
      // 发送平仓通知
      this.notify({
        id: this.generateId(),
        type: 'trade',
        priority: 'high',
        title: `📉 平仓 ${position.side.toUpperCase()}`,
        content: `原因: ${reason || '止盈/止损触发'}\n` +
                 `入场: ${position.entryPrice.toFixed(2)} | 出场: ${position.currentPrice?.toFixed(2) || 'N/A'}`,
        timestamp: Date.now(),
        sent: false,
        channels: ['telegram', 'log']
      });
    }
    this.positions.delete(positionId);
  }
  
  /**
   * 发送30分钟定期报告
   */
  private sendPeriodicReport() {
    const now = Date.now();
    const balance = this.getCurrentBalance?.() || 0;
    const price = this.getCurrentPrice?.() || 0;
    
    // 计算运行时间
    const runTime = Math.floor((now - this.lastReportTime) / 1000 / 60);
    
    // 获取持仓信息
    const positions = Array.from(this.positions.values());
    const positionCount = positions.length;
    
    let content = `⏰ 定期报告 (每30分钟)\n`;
    content += `━━━━━━━━━━━━━━━━━━━━\n`;
    content += `💰 当前价格: $${price.toFixed(2)}\n`;
    content += `💵 账户余额: ${balance.toFixed(2)} USDT\n`;
    content += `📊 持仓数量: ${positionCount}\n`;
    
    if (positionCount > 0) {
      positions.forEach((pos, idx) => {
        const pnl = pos.currentPrice ? 
          (pos.side === 'long' ? pos.currentPrice - pos.entryPrice : pos.entryPrice - pos.currentPrice) : 0;
        const pnlPercent = (pnl / pos.entryPrice * 100).toFixed(2);
        content += `\n📈 持仓 ${idx + 1}: ${pos.side.toUpperCase()}\n`;
        content += `   入场: ${pos.entryPrice.toFixed(2)} | 当前: ${pos.currentPrice?.toFixed(2) || 'N/A'}\n`;
        content += `   盈亏: ${pnl >= 0 ? '+' : ''}${pnlPercent}%\n`;
        content += `   止损: ${pos.stopLoss.toFixed(2)}`;
      });
    }
    
    content += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    content += `📅 日统计: ${this.dailyStats.trades}笔交易 | PnL: ${this.dailyStats.totalPnL.toFixed(2)} USDT\n`;
    content += `⏱️ 运行时间: ${runTime}分钟`;
    
    this.notify({
      id: this.generateId(),
      type: 'info',
      priority: 'medium',
      title: '📊 定期状态报告 (30分钟)',
      content: content,
      timestamp: now,
      sent: false,
      channels: ['telegram', 'log']
    });
    
    this.log('info', '定期报告已发送', { balance, price, positions: positionCount });
  }
  
  updateTPStatus(positionId: string, tp: 'tp1' | 'tp2' | 'tp3', executed: boolean) {
    const pos = this.positions.get(positionId);
    if (pos) {
      if (tp === 'tp1') pos.tp1Executed = executed;
      if (tp === 'tp2') pos.tp2Executed = executed;
      if (tp === 'tp3') pos.tp3Executed = executed;
    }
  }
  
  private async checkLoop() {
    await this.checkPositionsTPSL();
    await this.processNotifications();
    this.checkLLMResponses();
  }
  
  private async checkPositionsTPSL(currentPrices?: Map<string, number>) {
    for (const [id, position] of this.positions) {
      const currentPrice = currentPrices?.get(position.symbol);
      if (!currentPrice) continue;
      
      // 检查风险状态
      const riskStatus = this.checkPositionRisk(position, currentPrice);
      if (riskStatus.status === 'danger' || riskStatus.status === 'liquidation') {
        this.notify({
          type: 'risk',
          priority: 'urgent',
          title: `🚨 持仓风险警告 - ${riskStatus.status.toUpperCase()}`,
          content: `浮亏: ${riskStatus.unrealizedPnLPercent.toFixed(2)}%\n${riskStatus.recommendation}`,
          channels: ['telegram', 'log']
        });
      }
      
      // 检查止损
      const slHit = position.side === 'long'
        ? currentPrice <= position.stopLoss
        : currentPrice >= position.stopLoss;
      
      if (slHit) {
        await this.triggerTPSL(position, 'sl', currentPrice);
        continue;
      }
      
      // 检查追踪止损
      if (position.trailingStop?.enabled) {
        await this.checkTrailingStop(position, currentPrice);
      }
      
      // 检查TP3
      if (!position.tp3Executed) {
        const tp3Hit = position.side === 'long'
          ? currentPrice >= position.takeProfits.tp3
          : currentPrice <= position.takeProfits.tp3;
        
        if (tp3Hit) {
          await this.triggerTPSL(position, 'tp3', currentPrice);
          continue;
        }
      }
      
      // 检查TP2 (在TP1已执行的基础上)
      if (position.tp1Executed && !position.tp2Executed) {
        const tp2Hit = position.side === 'long'
          ? currentPrice >= position.takeProfits.tp2
          : currentPrice <= position.takeProfits.tp2;
        
        if (tp2Hit) {
          await this.triggerTPSL(position, 'tp2', currentPrice);
          continue;
        }
      }
      
      // 检查TP1
      if (!position.tp1Executed) {
        const tp1Hit = position.side === 'long'
          ? currentPrice >= position.takeProfits.tp1
          : currentPrice <= position.takeProfits.tp1;
        
        if (tp1Hit) {
          await this.triggerTPSL(position, 'tp1', currentPrice);
        }
      }
    }
  }
  
  private async checkTrailingStop(position: Position, currentPrice: number) {
    if (!position.trailingStop) return;
    
    const ts = position.trailingStop;
    
    // 检查是否激活
    if (!ts.activationPrice) {
      const profitPercent = position.side === 'long'
        ? (currentPrice - position.entryPrice) / position.entryPrice
        : (position.entryPrice - currentPrice) / position.entryPrice;
      
      if (profitPercent >= 0.015) {
        ts.activationPrice = currentPrice;
        ts.currentStop = position.side === 'long'
          ? currentPrice * (1 - ts.callbackRate)
          : currentPrice * (1 + ts.callbackRate);
      }
      return;
    }
    
    // 更新止损
    if (position.side === 'long' && currentPrice > ts.activationPrice) {
      const newStop = currentPrice * (1 - ts.callbackRate);
      if (newStop > ts.currentStop) {
        ts.currentStop = newStop;
        this.log('info', `追踪止损更新: ${position.id}`, { newStop });
      }
    } else if (position.side === 'short' && currentPrice < ts.activationPrice) {
      const newStop = currentPrice * (1 + ts.callbackRate);
      if (newStop < ts.currentStop) {
        ts.currentStop = newStop;
        this.log('info', `追踪止损更新: ${position.id}`, { newStop });
      }
    }
    
    // 检查是否触发
    const hit = position.side === 'long'
      ? currentPrice <= ts.currentStop
      : currentPrice >= ts.currentStop;
    
    if (hit) {
      await this.triggerTPSL(position, 'sl', currentPrice);
    }
  }
  
  private async triggerTPSL(position: Position, type: 'tp1' | 'tp2' | 'tp3' | 'sl', price: number) {
    const pnl = this.calculatePnL(position, price);
    const emoji = type === 'sl' ? '🛑' : '🎯';
    const typeName = type === 'sl' ? '止损' : `止盈${type.replace('tp', '')}`;
    
    this.notify({
      id: this.generateId(),
      type: 'tp_sl',
      priority: 'high',
      title: `${emoji} ${typeName}触发`,
      content: `${position.side.toUpperCase()} ${position.contracts} ETH\n` +
               `触发价: ${price.toFixed(2)}\n` +
               `盈亏: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${((pnl/(position.entryPrice * position.contracts))*100).toFixed(2)}%)`,
      timestamp: Date.now(),
      sent: false,
      channels: ['telegram', 'log']
    });
    
    if (this.onTPSLTriggered) {
      await this.onTPSLTriggered(position, type, price);
    }
    
    if (type === 'tp1') position.tp1Executed = true;
    if (type === 'tp2') position.tp2Executed = true;
    if (type === 'tp3' || type === 'sl') {
      this.positions.delete(position.id);
    }
  }
  
  notify(notification: Omit<Notification, 'id' | 'timestamp' | 'sent'>) {
    const notif: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: Date.now(),
      sent: false
    };
    
    this.notifications.push(notif);
    
    if (notification.priority === 'urgent') {
      this.processNotification(notif);
    }
  }
  
  private async processNotifications() {
    const pending = this.notifications.filter(n => !n.sent);
    
    for (const notif of pending) {
      const lastTime = this.lastNotificationTime.get(notif.type) || 0;
      if (Date.now() - lastTime < this.config.notificationCooldown && notif.priority !== 'urgent') {
        continue;
      }
      
      await this.processNotification(notif);
    }
    
    this.notifications = this.notifications.filter(n => !n.sent);
  }
  
  private async processNotification(notif: Notification) {
    try {
      this.writeToFile(notif);
      
      if (this.onSendNotification) {
        await this.onSendNotification(notif);
      }
      
      notif.sent = true;
      this.lastNotificationTime.set(notif.type, Date.now());
    } catch (e) {
      this.log('error', `通知发送失败: ${notif.id}`, e);
    }
  }
  
  private writeToFile(notif: Notification) {
    try {
      const fs = require('fs');
      fs.mkdirSync('./notifications', { recursive: true });
      
      const fileName = `./notifications/${notif.type}-${notif.id}.json`;
      fs.writeFileSync(fileName, JSON.stringify(notif, null, 2));
      
      const line = `[${new Date(notif.timestamp).toISOString()}] ${notif.title}\n${notif.content}\n---\n`;
      fs.appendFileSync('./NOTIFICATIONS.txt', line);
    } catch (e) {}
  }
  
  private checkLLMResponses() {
    try {
      const fs = require('fs');
      const files = fs.readdirSync('./llm-responses');
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(`./llm-responses/${file}`, 'utf8'));
          this.notify({
            id: this.generateId(),
            type: 'info',
            priority: 'medium',
            title: '🤖 LLM分析完成',
            content: data.summary || '收到LLM分析结果',
            timestamp: Date.now(),
            sent: false,
            channels: ['telegram', 'log']
          });
          fs.unlinkSync(`./llm-responses/${file}`);
        }
      }
    } catch (e) {}
  }
  
  private calculatePnL(position: Position, currentPrice: number): number {
    const entryValue = position.contracts * position.entryPrice;
    const currentValue = position.contracts * currentPrice;
    return position.side === 'long'
      ? currentValue - entryValue
      : entryValue - currentValue;
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private log(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
    
    try {
      const fs = require('fs');
      fs.mkdirSync('./logs', { recursive: true });
      fs.appendFileSync('./logs/monitor.log', logLine);
    } catch (e) {}
  }
  
  getStats() {
    return {
      positions: this.positions.size,
      pendingNotifications: this.notifications.filter(n => !n.sent).length,
      isRunning: this.isRunning,
      dailyStats: this.dailyStats,
    };
  }
}

export default MonitorNotifierModule;
