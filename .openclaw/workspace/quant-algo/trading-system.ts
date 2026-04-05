#!/usr/bin/env bun
/**
 * Quant Algo 主控制器
 * 
 * 架构 (2026-03-11 重构):
 * - Market Intelligence Pipeline (技术/情绪/链上分析)
 * - Central Trading Agent (趋势/入场/风险评估 + 对齐分析)
 * - Adaptive-OPRO (动态 Prompt 优化)
 * - Trading Bot Runtime (执行层)
 * - Performance Tracker (性能追踪)
 * 
 * 安全特性:
 * - 进程锁 🔒 防止多实例运行
 */

// 加载环境变量
import { config } from 'dotenv';
config({ path: process.env.HOME + '/.openclaw/.env' });

import { createTradingSystem, TradingSystemConfig } from './src/index';
import { ExchangeManager } from './src/exchange';
import { getProcessLock } from './src/utils/processLock';
import NotificationManager from './src/notifier';
import logger from './src/logger';
import fs from 'fs';

// ==================== 配置 ====================

const CONFIG: TradingSystemConfig = {
  symbol: 'ETHUSDT',
  initialBalance: 1000,
  oproEnabled: true,
  optimizationWindowDays: 5,
  maxPositionSize: 0.02,      // 降低：2% 余额
  maxLeverage: 20,            // 降低：20x 杠杆
  maxDrawdown: 0.10,          // 降低：10% 最大回撤
};

const CHECK_INTERVAL = 60000; // 1 分钟

// ==================== 主控制器 ====================

class TradingSystem {
  private system: ReturnType<typeof createTradingSystem>;
  private exchange: ExchangeManager;
  private notifier: NotificationManager;
  private running: boolean = false;
  
  // 状态
  private balance: number = 0;
  private currentPrice: number = 0;
  private hasPosition: boolean = false;
  private position: any = null;
  private previousPosition: any = null;  // 用于检测平仓
  
  constructor() {
    this.system = createTradingSystem(CONFIG);
    this.exchange = new ExchangeManager();
    this.notifier = new NotificationManager();
  }
  
  /**
   * 启动系统
   */
  async start(): Promise<void> {
    // 🔒 获取进程锁
    const lock = getProcessLock();
    if (!lock.acquire()) {
      logger.error('❌ 无法启动：已有 quant-alto 实例在运行');
      process.exit(1);
    }
    
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('🚀 Quant Algo 启动');
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info(`   Symbol: ${CONFIG.symbol}`);
    logger.info(`   OPRO: ${CONFIG.oproEnabled ? '已启用' : '已禁用'}`);
    logger.info(`   优化窗口: ${CONFIG.optimizationWindowDays} 天`);
    logger.info('');
    
    // 初始化
    await this.initialize();
    
    // 🔔 发送启动通知
    await this.notifier.notifyStart();
    
    // 主循环
    this.running = true;
    while (this.running) {
      try {
        await this.cycle();
      } catch (error: any) {
        logger.error(`主循环错误: ${error.message}`);
      }
      
      await this.sleep(CHECK_INTERVAL);
    }
  }
  
  /**
   * 初始化
   */
  private async initialize(): Promise<void> {
    logger.info('🔄 初始化系统...');
    
    // 初始化交易机器人
    await this.system.tradingBot.initialize();
    
    // 同步账户状态
    await this.syncAccountState();
    
    logger.info('✅ 系统初始化完成');
  }
  
  /**
   * 主循环
   */
  private async cycle(): Promise<void> {
    const cycleStart = Date.now();
    logger.info('─'.repeat(60));
    
    // 0. 同步账户状态（每次循环都更新）
    await this.syncAccountState();
    
    // 1. 获取市场数据
    await this.fetchMarketData();
    
    // 2. 运行 Market Intelligence Pipeline
    const intelligenceReport = await this.runMarketIntelligence();
    
    if (!intelligenceReport) {
      logger.warn('⚠️ 市场情报获取失败，跳过本轮');
      return;
    }
    
    // 3. 运行 Central Trading Agent
    const decision = await this.runCentralTradingAgent(intelligenceReport);
    
    // 4. 执行决策
    if (decision.action !== 'hold') {
      await this.executeDecision(decision);
    } else {
      logger.info('⏸️ 决策: 观望');
    }
    
    // 5. 更新性能追踪
    this.updatePerformanceTracking();
    
    // 6. 检查 OPRO 优化
    if (CONFIG.oproEnabled) {
      await this.checkOPROOptimization();
    }
    
    // 7. 输出状态
    this.logCycleSummary(decision, cycleStart);
  }
  
  /**
   * 获取市场数据
   */
  private async fetchMarketData(): Promise<void> {
    try {
      this.currentPrice = await this.exchange.getCurrentPrice();
      logger.debug(`💰 当前价格: $${this.currentPrice.toFixed(2)}`);
    } catch (error: any) {
      logger.error(`获取市场数据失败: ${error.message}`);
    }
  }
  
  /**
   * 运行 Market Intelligence Pipeline
   */
  private async runMarketIntelligence(): Promise<any> {
    try {
      // 获取 OHLCV 数据
      const ohlcv = await this.exchange.fetchOHLCV('5m', 100);
      
      const context = {
        symbol: CONFIG.symbol,
        ohlcv: ohlcv.map((c: number[]) => ({
          timestamp: c[0],
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
          volume: c[5],
        })),
        currentPrice: this.currentPrice,
        balance: this.balance,
        hasPosition: this.hasPosition,
        currentPosition: this.position,
      };
      
      const report = await this.system.marketIntelligence.analyze(context);
      
      logger.info(`📊 市场情报: ${report.marketState.regime} | 风险: ${report.marketState.riskLevel}`);
      
      return report;
      
    } catch (error: any) {
      logger.error(`Market Intelligence 错误: ${error.message}`);
      return null;
    }
  }
  
  /**
   * 运行 Central Trading Agent
   */
  private async runCentralTradingAgent(intelligenceReport: any): Promise<any> {
    try {
      const context = {
        marketIntelligence: {
          technical: intelligenceReport.technical,
          sentiment: intelligenceReport.sentiment,
          onChain: intelligenceReport.onChain,
        },
        currentPrice: this.currentPrice,
        balance: this.balance,
        hasPosition: this.hasPosition,
        currentPosition: this.position,
        riskParameters: {
          maxPositionSize: CONFIG.maxPositionSize,
          maxLeverage: CONFIG.maxLeverage,
          maxDrawdown: CONFIG.maxDrawdown,
        },
      };
      
      const decision = await this.system.centralTradingAgent.makeDecision(context);
      
      logger.info(`🎯 决策: ${decision.action.toUpperCase()} (置信度: ${(decision.confidence * 100).toFixed(0)}%)`);
      logger.info(`   对齐度: ${(decision.alignment.overallAlignment * 100).toFixed(0)}%`);
      
      return decision;
      
    } catch (error: any) {
      logger.error(`Central Trading Agent 错误: ${error.message}`);
      return { action: 'hold', confidence: 0, reasoning: ['错误'] };
    }
  }
  
  /**
   * 执行决策
   */
  private async executeDecision(decision: any): Promise<void> {
    // 持仓检查：如果已有持仓，只允许平仓或反向操作
    if (this.hasPosition && this.position) {
      const currentSide = this.position.side;
      const decisionAction = decision.action;
      
      // 已有多头，决策还是买入 → 跳过
      if (currentSide === 'long' && decisionAction === 'buy') {
        logger.info(`⏸️ 已有多头持仓，跳过买入`);
        return;
      }
      // 已有空头，决策还是卖出 → 跳过
      if (currentSide === 'short' && decisionAction === 'sell') {
        logger.info(`⏸️ 已有空头持仓，跳过卖出`);
        return;
      }
    }
    
    try {
      // 生成订单
      const order = this.system.orderGenerator.generateOrder(
        {
          action: decision.action,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          entry: {
            priceRange: { min: this.currentPrice * 0.999, max: this.currentPrice * 1.001 },
            riskRewardRatio: 2,
            urgency: 'medium',
          },
          risk: {
            level: 'medium',
            maxDrawdown: CONFIG.maxDrawdown,
            recommendedPositionSize: decision.positionSize,
            stopLoss: decision.stopLoss,
            takeProfitLevels: decision.takeProfitLevels.map((tp: any) => tp.price),
          },
        },
        {
          currentPrice: this.currentPrice,
          atr: this.currentPrice * 0.02,
          balance: this.balance,
          hasPosition: this.hasPosition,
          volatility: 0.02,
          spread: 0.0001,
        }
      );
      
      if (order) {
        // 开仓前设置杠杆
        try {
          await this.exchange.setLeverage(CONFIG.maxLeverage);
        } catch (e: any) {
          logger.warn(`设置杠杆失败: ${e.message}`);
        }
        
        // 验证订单
        const validation = this.system.orderGenerator.validateOrder(order, {
          currentPrice: this.currentPrice,
          atr: this.currentPrice * 0.02,
          balance: this.balance,
          hasPosition: this.hasPosition,
          volatility: 0.02,
          spread: 0.0001,
        });
        
        if (validation.valid) {
          // 执行
          const result = await this.system.tradingBot.executeOrder(order);
          
          if (result) {
            logger.info(`✅ 订单执行成功: ${decision.action.toUpperCase()}`);
            
            // 🔔 发送开仓/平仓通知
            if (decision.action === 'buy' || decision.action === 'sell') {
              // 检测是开仓还是平仓
              if (this.hasPosition && this.position) {
                // 已有持仓，这是平仓或反向操作
                const pnl = 0; // 简化，实际需要计算
                await this.notifier.notifyClosePosition(
                  this.position.side,
                  this.position.entryPrice,
                  this.currentPrice,
                  pnl,
                  decision.reasoning.join(', ')
                );
              } else {
                // 无持仓，这是开仓
                await this.notifier.notifyOpenPosition(
                  decision.action === 'buy' ? 'long' : 'short',
                  this.currentPrice,
                  order.size,
                  CONFIG.maxLeverage
                );
              }
            }
            
            this.hasPosition = decision.action !== 'hold';
            
            // 开仓后设置止损止盈
            if (decision.action !== 'hold') {
              const atr = this.currentPrice * 0.02;
              const stopLoss = decision.action === 'buy'
                ? this.currentPrice - atr * 2
                : this.currentPrice + atr * 2;
              const takeProfit = decision.action === 'buy'
                ? this.currentPrice + atr * 1.5
                : this.currentPrice - atr * 1.5;
              
              await this.exchange.setStopLossTakeProfit(stopLoss, takeProfit, order.size);
              logger.info(`🛡️ 止损止盈已设置: SL=$${stopLoss.toFixed(2)} TP=$${takeProfit.toFixed(2)}`);
            }
            
            // 更新持仓状态
            await this.syncAccountState();
          } else {
            logger.warn(`⚠️ 订单执行失败`);
          }
        } else {
          logger.warn(`⚠️ 订单验证失败: ${validation.errors.join(', ')}`);
        }
      }
      
    } catch (error: any) {
      logger.error(`执行决策错误: ${error.message}`);
    }
  }
  
  /**
   * 更新性能追踪
   */
  private updatePerformanceTracking(): void {
    // 更新余额
    this.system.performanceTracker.setBalance(this.balance);
  }
  
  /**
   * 检查 OPRO 优化
   */
  private async checkOPROOptimization(): Promise<void> {
    try {
      const feedbackLoop = this.system.feedbackLoop;
      
      if (feedbackLoop.shouldProcessFeedback()) {
        logger.info('🔄 触发 OPRO 优化...');
        
        const result = await feedbackLoop.processFeedback();
        
        if (result.success) {
          logger.info(`✅ OPRO 优化完成: ${result.proposedChanges}`);
        } else {
          logger.debug(`OPRO 优化跳过: ${result.error}`);
        }
      }
      
    } catch (error: any) {
      logger.error(`OPRO 优化错误: ${error.message}`);
    }
  }
  
  /**
   * 同步账户状态
   */
  private async syncAccountState(): Promise<void> {
    try {
      const hasAPIKey = process.env.BINANCE_API_KEY && process.env.BINANCE_API_KEY.length > 10;
      
      if (!hasAPIKey) {
        this.balance = CONFIG.initialBalance;
        logger.info(`💰 模拟模式: 初始余额 $${this.balance}`);
        return;
      }
      
      const account = await (this.exchange as any).request('/fapi/v2/account');
      const usdtAsset = account.assets?.find((a: any) => a.asset === 'USDT');
      
      this.balance = parseFloat(usdtAsset?.availableBalance || 0);
      
      const positionData = account.positions?.find(
        (p: any) => p.symbol === CONFIG.symbol && parseFloat(p.positionAmt) !== 0
      );
      
      if (positionData) {
        const posAmt = parseFloat(positionData.positionAmt);
        this.hasPosition = true;
        this.position = {
          side: posAmt > 0 ? 'long' : 'short',
          size: Math.abs(posAmt),
          entryPrice: parseFloat(positionData.entryPrice),
          unrealizedPnl: parseFloat(positionData.unrealizedProfit),
        };
      } else {
        this.hasPosition = false;
        this.position = null;
      }
      
      logger.info(`💰 余额: $${this.balance.toFixed(2)}`);
      if (this.hasPosition) {
        logger.info(`📍 持仓: ${this.position.side.toUpperCase()} ${this.position.size} @ $${this.position.entryPrice}`);
      }
      
    } catch (error: any) {
      logger.warn(`⚠️ 同步账户状态失败: ${error.message}`);
      this.balance = CONFIG.initialBalance;
    }
  }
  
  /**
   * 输出循环摘要
   */
  private logCycleSummary(decision: any, cycleStart: number): void {
    const duration = Date.now() - cycleStart;
    const metrics = this.system.performanceTracker.calculateMetrics();
    
    logger.info('─'.repeat(60));
    logger.info(`✅ 循环完成 (${duration}ms)`);
    logger.info(`   总收益: ${(metrics.totalRoi * 100).toFixed(2)}%`);
    logger.info(`   胜率: ${metrics.winRate.toFixed(1)}%`);
    logger.info(`   最大回撤: ${(metrics.maxDrawdownPercent * 100).toFixed(2)}%`);
  }
  
  /**
   * 停止系统
   */
  stop(): void {
    this.running = false;
    
    // 🔓 释放进程锁
    const lock = getProcessLock();
    lock.release();
    
    logger.info('🛑 系统停止');
  }
  
  /**
   * 获取状态
   */
  getStatus(): any {
    return this.system.getStatus();
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== 入口 ====================

const system = new TradingSystem();

process.on('SIGTERM', () => system.stop());
process.on('SIGINT', () => system.stop());

system.start().catch(e => {
  logger.error(`💥 致命错误: ${e.message}`);
  process.exit(1);
});

export default system;
