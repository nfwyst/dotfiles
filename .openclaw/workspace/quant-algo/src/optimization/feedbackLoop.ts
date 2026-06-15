/**
 * 反馈循环
 * 连接性能追踪和 Adaptive-OPRO
 */

import { PerformanceMetrics, OptimizationResult } from './types';
import { AdaptiveOPRO } from './adaptiveOPRO';
import type { PerformanceProvider } from '../execution/sharedTypes';
import logger from '../logger';

export class FeedbackLoop {
  private opro: AdaptiveOPRO;
  private performanceProvider: PerformanceProvider | null = null;
  
  // 窗口追踪
  private windowStart: number;
  private windowSize: number; // 天
  
  // 性能数据
  private dailyReturns: number[] = [];
  private peakBalance: number = 0;
  
  constructor(opro: AdaptiveOPRO, windowSize: number = 5) {
    this.opro = opro;
    this.windowSize = windowSize;
    this.windowStart = Date.now();
  }
  
  /**
   * 设置交易机器人
   */
  /**
   * 设置性能数据提供者
   */
  setPerformanceProvider(provider: PerformanceProvider): void {
    this.performanceProvider = provider;
  }

  /** @deprecated Use setPerformanceProvider() instead */
  setTradingBot(bot: PerformanceProvider): void {
    this.performanceProvider = bot;
  }
  
  /**
   * 处理反馈
   * 每个评估窗口结束时调用
   */
  async processFeedback(): Promise<OptimizationResult> {
    logger.info('🔄 Processing feedback...');
    
    // 收集性能指标
    const metrics = await this.collectMetrics();
    
    // 调用 OPRO 优化
    const result = await this.opro.optimize(metrics);
    
    if (result.success) {
      logger.info(`✅ Optimization applied: ${result.proposedChanges}`);
      
      // 更新窗口
      this.resetWindow();
    }
    
    return result;
  }
  
  /**
   * 收集性能指标
   */
  async collectMetrics(): Promise<PerformanceMetrics> {
    const now = Date.now();
    const windowEnd = now;
    const windowStart = this.windowStart;
    
    // 从交易机器人获取数据
    let tradeCount = 0;
    let totalPnl = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let balance = 1000;
    
    if (this.performanceProvider) {
      const perfMetrics = this.performanceProvider.getPerformanceMetrics();
      tradeCount = perfMetrics.tradeCount;
      totalPnl = perfMetrics.totalPnl;
      winningTrades = perfMetrics.winningTrades;
      losingTrades = perfMetrics.losingTrades;
      balance = 1000 + totalPnl; // 简化
    }
    
    // 计算指标
    const roi = totalPnl / 1000; // 初始余额假设为 1000
    const winRate = tradeCount > 0 ? (winningTrades / tradeCount) : 0;
    const profitFactor = losingTrades > 0 
      ? (totalPnl > 0 ? totalPnl / Math.abs(totalPnl) : 0)
      : (winningTrades > 0 ? Infinity : 0);
    
    const maxDrawdown = this.peakBalance > 0 
      ? Math.max(0, (this.peakBalance - balance) / this.peakBalance)
      : 0;
    
    return {
      roi,
      dailyReturns: this.dailyReturns,
      cumulativeReturns: [],
      maxDrawdown,
      sharpeRatio: 0, // 需要更多数据
      volatility: 0,
      winRate: winRate * 100,
      profitFactor,
      tradeCount,
      avgHoldTime: 0,
      windowStart,
      windowEnd,
    };
  }
  
  /**
   * 更新每日收益
   */
  updateDailyReturn(dailyPnl: number): void {
    this.dailyReturns.push(dailyPnl);
    
    // 保留最近 30 天
    if (this.dailyReturns.length > 30) {
      this.dailyReturns.shift();
    }
  }
  
  /**
   * 更新峰值余额
   */
  updatePeakBalance(balance: number): void {
    this.peakBalance = Math.max(this.peakBalance, balance);
  }
  
  /**
   * 检查是否需要优化
   */
  shouldProcessFeedback(): boolean {
    const windowMs = this.windowSize * 24 * 60 * 60 * 1000;
    return Date.now() - this.windowStart >= windowMs;
  }
  
  /**
   * 获取窗口进度
   */
  getWindowProgress(): { elapsed: number; total: number; percent: number } {
    const windowMs = this.windowSize * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - this.windowStart;
    
    return {
      elapsed,
      total: windowMs,
      percent: Math.min(100, (elapsed / windowMs) * 100),
    };
  }
  
  /**
   * 重置窗口
   */
  private resetWindow(): void {
    this.windowStart = Date.now();
    this.peakBalance = 0;
    logger.info(`📅 New optimization window started (${this.windowSize} days)`);
  }
  
  /**
   * 手动触发优化
   */
  async triggerOptimization(): Promise<OptimizationResult> {
    return this.processFeedback();
  }
}

export default FeedbackLoop;
