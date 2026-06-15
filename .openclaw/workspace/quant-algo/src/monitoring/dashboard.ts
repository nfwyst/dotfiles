/**
 * 监控仪表板接口
 * 提供系统状态查询
 */

import { PerformanceTracker, PerformanceReport, TradeRecord, PerformanceMetrics } from './performanceTracker';
import { AdaptiveOPRO, OPROStatus, OptimizationHistory } from '../optimization/adaptiveOPRO';
import type { PerformanceProvider } from '../execution/sharedTypes';
import { MarketIntelligencePipeline } from '../agents/marketIntelligence';
import { CentralTradingAgent } from '../agents/centralTradingAgent';
import type { AgentStatus } from '../agents/centralTradingAgent/types';
import logger from '../logger';

// ==================== 类型定义 ====================

export interface SystemStatus {
  timestamp: number;
  uptime: number;
  
  // 组件状态
  components: {
    tradingBot: {
      running: boolean;
      position: string;
      balance: number;
      lastUpdate: number;
    };
    marketIntelligence: {
      healthy: boolean;
      lastUpdate: number;
    };
    centralTradingAgent: {
      healthy: boolean;
      agentStatus: Record<string, AgentStatus>;
    };
    opro: {
      healthy: boolean;
      totalOptimizations: number;
      lastOptimization: number;
      scoreTrend: string;
    };
  };
  
  // 性能摘要
  performance: {
    totalRoi: number;
    winRate: number;
    maxDrawdown: number;
    totalTrades: number;
    sharpeRatio: number;
  };
  
  // 告警
  alerts: SystemAlert[];
}

export interface SystemAlert {
  level: 'info' | 'warning' | 'error';
  component: string;
  message: string;
  timestamp: number;
}

// ==================== 监控仪表板 ====================

export class MonitoringDashboard {
  private performanceTracker: PerformanceTracker;
  private opro: AdaptiveOPRO;
  private performanceProvider: PerformanceProvider | null = null;
  private marketIntelligence: MarketIntelligencePipeline | null = null;
  private centralTradingAgent: CentralTradingAgent | null = null;
  
  private startTime: number;
  private alerts: SystemAlert[] = [];
  
  constructor(
    performanceTracker: PerformanceTracker,
    opro: AdaptiveOPRO
  ) {
    this.performanceTracker = performanceTracker;
    this.opro = opro;
    this.startTime = Date.now();
  }
  
  /**
   * 设置交易机器人
   */
  /**
   * 设置性能数据提供者（TradingBotRuntime 或 EventDrivenRuntime）
   */
  setPerformanceProvider(provider: PerformanceProvider): void {
    this.performanceProvider = provider;
  }

  /** @deprecated Use setPerformanceProvider() instead */
  setTradingBot(bot: PerformanceProvider): void {
    this.performanceProvider = bot;
  }
  
  /**
   * 设置市场情报 Pipeline
   */
  setMarketIntelligence(pipeline: MarketIntelligencePipeline): void {
    this.marketIntelligence = pipeline;
  }
  
  /**
   * 设置中央交易 Agent
   */
  setCentralTradingAgent(agent: CentralTradingAgent): void {
    this.centralTradingAgent = agent;
  }
  
  /**
   * 获取系统状态
   */
  getStatus(): SystemStatus {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    // 组件状态
    const tradingBotStatus = this.getTradingBotStatus();
    const miStatus = this.getMarketIntelligenceStatus();
    const ctaStatus = this.getCentralTradingAgentStatus();
    const oproStatus = this.getOPROStatus();
    
    // 性能摘要
    const metrics = this.performanceTracker.calculateMetrics();
    const performance = {
      totalRoi: metrics.totalRoi * 100,
      winRate: metrics.winRate,
      maxDrawdown: metrics.maxDrawdownPercent * 100,
      totalTrades: metrics.totalTrades,
      sharpeRatio: metrics.sharpeRatio,
    };
    
    // 更新告警
    this.updateAlerts(metrics);
    
    return {
      timestamp: now,
      uptime,
      components: {
        tradingBot: tradingBotStatus,
        marketIntelligence: miStatus,
        centralTradingAgent: ctaStatus,
        opro: oproStatus,
      },
      performance,
      alerts: this.alerts.slice(-10),
    };
  }
  
  /**
   * 获取性能报告
   */
  getPerformanceReport(): PerformanceReport {
    return this.performanceTracker.generateReport();
  }
  
  /**
   * 获取交易历史
   */
  getTradeHistory(limit: number = 50): TradeRecord[] {
    const trades = this.performanceTracker.getTradeHistory();
    return trades.slice(-limit);
  }
  
  /**
   * 获取 OPRO 历史
   */
  getOPROHistory(): OptimizationHistory {
    return this.opro.getHistory();
  }
  
  /**
   * 生成摘要报告
   */
  generateSummary(): string {
    const status = this.getStatus();
    const lines: string[] = [];
    
    lines.push('=== Quant Algo 系统状态 ===');
    lines.push(`时间: ${new Date(status.timestamp).toLocaleString()}`);
    lines.push(`运行时间: ${this.formatDuration(status.uptime)}`);
    lines.push('');
    
    lines.push('组件状态:');
    lines.push(`  交易机器人: ${status.components.tradingBot.running ? '运行中' : '已停止'}`);
    lines.push(`  当前持仓: ${status.components.tradingBot.position}`);
    lines.push(`  余额: $${status.components.tradingBot.balance.toFixed(2)}`);
    lines.push('');
    
    lines.push('性能摘要:');
    lines.push(`  总收益: ${status.performance.totalRoi.toFixed(2)}%`);
    lines.push(`  胜率: ${status.performance.winRate.toFixed(1)}%`);
    lines.push(`  最大回撤: ${status.performance.maxDrawdown.toFixed(2)}%`);
    lines.push(`  夏普比率: ${status.performance.sharpeRatio.toFixed(2)}`);
    lines.push(`  总交易数: ${status.performance.totalTrades}`);
    lines.push('');
    
    lines.push('OPRO 状态:');
    lines.push(`  优化次数: ${status.components.opro.totalOptimizations}`);
    lines.push(`  趋势: ${status.components.opro.scoreTrend}`);
    lines.push('');
    
    if (status.alerts.length > 0) {
      lines.push('告警:');
      for (const alert of status.alerts.slice(-5)) {
        const icon = alert.level === 'error' ? '❌' : alert.level === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`  ${icon} [${alert.component}] ${alert.message}`);
      }
    }
    
    return lines.join('\n');
  }
  
  // ==================== 私有方法 ====================
  
  private getTradingBotStatus(): SystemStatus['components']['tradingBot'] {
    if (!this.performanceProvider) {
      return {
        running: false,
        position: 'N/A',
        balance: 0,
        lastUpdate: 0,
      };
    }
    
    const metrics = this.performanceProvider.getPerformanceMetrics();
    const balance = this.performanceTracker.getBalance();
    
    return {
      running: true,
      position: 'N/A', // 需要从 bot 获取
      balance,
      lastUpdate: Date.now(),
    };
  }
  
  private getMarketIntelligenceStatus(): SystemStatus['components']['marketIntelligence'] {
    if (!this.marketIntelligence) {
      return { healthy: false, lastUpdate: 0 };
    }
    
    const status = this.marketIntelligence.getStatus();
    const allHealthy = Object.values(status).every((s: AgentStatus) => s.healthy);
    
    return {
      healthy: allHealthy,
      lastUpdate: Math.max(...Object.values(status).map((s: AgentStatus) => s.lastRun || 0)),
    };
  }
  
  private getCentralTradingAgentStatus(): SystemStatus['components']['centralTradingAgent'] {
    if (!this.centralTradingAgent) {
      return { healthy: false, agentStatus: {} };
    }
    
    const status = this.centralTradingAgent.getAgentsStatus();
    const allHealthy = Object.values(status).every((s: AgentStatus) => s.healthy);
    
    return {
      healthy: allHealthy,
      agentStatus: status,
    };
  }
  
  private getOPROStatus(): SystemStatus['components']['opro'] {
    const status = this.opro.getStatus();
    
    return {
      healthy: status.healthy,
      totalOptimizations: status.totalOptimizations,
      lastOptimization: status.lastOptimization,
      scoreTrend: status.scoreTrend,
    };
  }
  
  private updateAlerts(metrics: PerformanceMetrics): void {
    const now = Date.now();
    
    // 清理旧告警
    this.alerts = this.alerts.filter(a => now - a.timestamp < 24 * 60 * 60 * 1000);
    
    // 检查性能告警
    if (metrics.winRate < 40) {
      this.addAlert('warning', 'Performance', '胜率低于 40%');
    }
    
    if (metrics.maxDrawdownPercent > 0.15) {
      this.addAlert('warning', 'Risk', '最大回撤超过 15%');
    }
    
    if (metrics.sharpeRatio < 0) {
      this.addAlert('warning', 'Performance', '夏普比率为负');
    }
  }
  
  private addAlert(level: SystemAlert['level'], component: string, message: string): void {
    // 避免重复告警
    const exists = this.alerts.find(
      a => a.component === component && a.message === message
    );
    
    if (!exists) {
      this.alerts.push({
        level,
        component,
        message,
        timestamp: Date.now(),
      });
      
      logger.warn(`[Alert] ${component}: ${message}`);
    }
  }
  
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}天 ${hours % 24}小时`;
    } else if (hours > 0) {
      return `${hours}小时 ${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return `${seconds}秒`;
    }
  }
}

export default MonitoringDashboard;
