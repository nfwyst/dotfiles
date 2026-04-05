import { config, validateConfig } from './config';
import ExchangeManager from './exchange';
import TechnicalIndicators from './indicators';
import SMCAnalyzer from './smc';
import MarketMicrostructure from './marketMicro';
import AIModule from './ai';
import RiskManager, { Position } from './riskManager';
import logger, { tradeLogger } from './logger';
import NotificationManager from './notifier';

/**
 * 决策请求
 * 系统收集所有信息后，向交易员请求决策
 */
export interface DecisionRequest {
  type: 'entry' | 'exit' | 'emergency' | 'status';
  timestamp: number;
  
  // 市场数据
  marketData: {
    price: number;
    change24h: number;
    volume24h: number;
    ohlcv: number[][];
  };
  
  // 技术分析
  technical: {
    signal: 'buy' | 'sell' | 'hold';
    strength: number;
    indicators: any;
  };
  
  // SMC 分析
  smc: {
    bullishOB: boolean;
    bearishOB: boolean;
    recentSweeps: string[];
    keyZones: string[];
  };
  
  // AI 分析
  ai: {
    sentiment: number;
    anomalies: string[];
    riskLevel: 'low' | 'medium' | 'high';
    recommendation: string;
  };
  
  // 当前状态
  currentPosition: Position;
  balance: { total: number; free: number };
  dailyStats: any;
  
  // 系统建议 (仅供参考)
  systemSuggestion?: {
    action: string;
    confidence: number;
    reasoning: string[];
  };
}

/**
 * 交易员决策
 */
export interface TraderDecision {
  action: 'buy' | 'sell' | 'hold' | 'close' | 'emergency_exit';
  timestamp: number;
  
  // 决策参数
  parameters?: {
    positionSize?: number;      // 仓位大小 (默认 100%)
    leverage?: number;          // 杠杆 (覆盖配置)
    stopLoss?: number;          // 止损价格
    takeProfit?: number;        // 止盈价格
  };
  
  // 决策说明
  reasoning: string;
  
  // 风险确认
  riskAcknowledged: boolean;
}

/**
 * 交易员控制台
 * 
 * 系统负责：
 * - 24小时监控市场
 * - 收集所有数据
 * - 在关键节点请求决策
 * - 执行交易员的指令
 * 
 * 交易员 (Jack) 负责：
 * - 所有交易决策
 * - 风险管理
 * - 策略调整
 */
export class TraderConsole {
  private exchange: ExchangeManager;
  private riskManager: RiskManager;
  private smcAnalyzer: SMCAnalyzer;
  private marketMicro: MarketMicrostructure;
  private ai: AIModule;
  private notifier: NotificationManager;
  
  private isRunning: boolean = false;
  private checkIntervalId: Timer | null = null;
  private higherTfData: number[][] = [];
  
  // 决策队列
  private pendingDecisions: DecisionRequest[] = [];
  private lastDecisionTime: number = 0;
  private decisionCooldown: number = 30 * 1000; // 30秒冷却
  
  constructor() {
    validateConfig();
    this.exchange = new ExchangeManager();
    this.riskManager = new RiskManager();
    this.smcAnalyzer = new SMCAnalyzer();
    this.marketMicro = new MarketMicrostructure();
    this.ai = new AIModule();
    this.notifier = new NotificationManager();
  }
  
  async start(): Promise<void> {
    logger.info('🎮 交易员控制台启动');
    logger.info('   模式: 人机协作 (系统监控 + 交易员决策)');
    logger.info('   交易员: Jack (24h 在线)');
    logger.info('   系统将收集数据并请求决策');
    
    const connected = await this.exchange.testConnection();
    if (!connected) throw new Error('无法连接到交易所');
    
    await this.exchange.setLeverage(config.leverage);
    
    this.isRunning = true;
    await this.notifier.notifyStart();
    
    // 立即汇报状态
    await this.reportStatus();
    
    // 启动监控循环
    this.checkIntervalId = setInterval(() => {
      this.monitor().catch(error => logger.error('监控错误:', error));
    }, config.checkInterval * 1000);
    
    logger.info('✅ 监控已启动，等待交易机会...');
  }
  
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.checkIntervalId) clearInterval(this.checkIntervalId);
    logger.info('🛑 交易员控制台已停止');
    await this.notifier.notifyStop();
  }
  
  /**
   * 监控循环 - 收集数据，等待决策
   */
  private async monitor(): Promise<void> {
    try {
      // 获取数据
      const ohlcv = await this.exchange.fetchOHLCV(config.timeframe, 100);
      if (config.multiTimeframe.enabled) {
        this.higherTfData = await this.exchange.fetchOHLCV(config.higherTimeframe, 50);
      }
      
      // 分析
      this.smcAnalyzer.analyze(ohlcv);
      const techSignal = TechnicalIndicators.generateSignal(ohlcv);
      const anomaly = this.ai.detectAnomaly(ohlcv);
      
      const currentPrice = await this.exchange.getCurrentPrice();
      const balance = await this.exchange.getBalance();
      const position = await this.getFormattedPosition();
      
      // 检查是否需要决策
      const decisionType = this.determineDecisionType(
        techSignal, anomaly, position, currentPrice
      );
      
      if (decisionType) {
        // 冷却检查
        if (Date.now() - this.lastDecisionTime < this.decisionCooldown) {
          return;
        }
        
        // 构建决策请求
        const request = await this.buildDecisionRequest(
          decisionType, ohlcv, techSignal, position, balance, currentPrice
        );
        
        // 发送给交易员
        await this.requestDecision(request);
      }
      
    } catch (error) {
      logger.error('监控错误:', error);
    }
  }
  
  /**
   * 确定是否需要决策
   */
  private determineDecisionType(
    signal: any,
    anomaly: any,
    position: Position,
    currentPrice: number
  ): 'entry' | 'exit' | 'emergency' | null {
    // 紧急：异常 + 有持仓
    if (anomaly.isAnomaly && anomaly.severity >= 8 && position.side !== 'none') {
      return 'emergency';
    }
    
    // 出场：有持仓 + 信号反转
    if (position.side !== 'none' && signal.strength >= 50) {
      const shouldExit = 
        (position.side === 'long' && signal.type === 'sell') ||
        (position.side === 'short' && signal.type === 'buy');
      if (shouldExit) return 'exit';
    }
    
    // 入场：无持仓 + 强信号
    if (position.side === 'none' && signal.strength >= 60) {
      return 'entry';
    }
    
    return null;
  }
  
  /**
   * 构建决策请求
   */
  private async buildDecisionRequest(
    type: 'entry' | 'exit' | 'emergency',
    ohlcv: number[][],
    techSignal: any,
    position: Position,
    balance: any,
    currentPrice: number
  ): Promise<DecisionRequest> {
    // SMC 分析
    const bullishOB = !!this.smcAnalyzer.getNearestBullishOB(currentPrice);
    const bearishOB = !!this.smcAnalyzer.getNearestBearishOB(currentPrice);
    const sweeps = this.smcAnalyzer.getRecentSweeps(Date.now() - 30 * 60 * 1000);
    
    // AI 分析
    const sentiment = await this.ai.analyzeSentiment();
    const anomaly = this.ai.detectAnomaly(ohlcv);
    const riskForecast = this.ai.predictRisk(ohlcv);
    
    // 系统建议
    const suggestion = this.generateSystemSuggestion(
      type, techSignal, anomaly, position, currentPrice
    );
    
    return {
      type,
      timestamp: Date.now(),
      marketData: {
        price: currentPrice,
        change24h: (ohlcv[ohlcv.length - 1][4] - ohlcv[ohlcv.length - 24][4]) / ohlcv[ohlcv.length - 24][4] * 100,
        volume24h: 0, // 简化
        ohlcv,
      },
      technical: {
        signal: techSignal.type,
        strength: techSignal.strength,
        indicators: techSignal.indicators,
      },
      smc: {
        bullishOB,
        bearishOB,
        recentSweeps: sweeps.map(s => s.type),
        keyZones: [],
      },
      ai: {
        sentiment: sentiment.score,
        anomalies: anomaly.isAnomaly ? [anomaly.reason] : [],
        riskLevel: riskForecast.riskLevel,
        recommendation: sentiment.summary,
      },
      currentPosition: position,
      balance,
      dailyStats: this.riskManager.getStats(),
      systemSuggestion: suggestion,
    };
  }
  
  /**
   * 生成系统建议
   */
  private generateSystemSuggestion(
    type: string,
    signal: any,
    anomaly: any,
    position: Position,
    price: number
  ) {
    const reasoning: string[] = [];
    let action = 'hold';
    let confidence = 0.5;
    
    if (type === 'entry') {
      action = signal.type;
      confidence = signal.strength / 100;
      reasoning.push(`技术信号强度: ${signal.strength}/100`);
      if (anomaly.isAnomaly) {
        reasoning.push(`⚠️ 但检测到异常: ${anomaly.reason}`);
        confidence -= 0.2;
      }
    } else if (type === 'exit') {
      action = 'close';
      confidence = 0.7;
      reasoning.push('信号反转');
      reasoning.push(`当前浮亏: ${position.unrealizedPnl.toFixed(2)} USDT`);
    } else if (type === 'emergency') {
      action = 'emergency_exit';
      confidence = 0.9;
      reasoning.push(`🚨 异常严重度: ${anomaly.severity}/10`);
      reasoning.push('建议立即平仓');
    }
    
    return { action, confidence, reasoning };
  }
  
  /**
   * 请求交易员决策
   * 
   * 这会向交易员发送所有信息，等待回复
   */
  private async requestDecision(request: DecisionRequest): Promise<void> {
    this.lastDecisionTime = Date.now();
    
    // 格式化请求
    const message = this.formatDecisionRequest(request);
    
    // 记录并发送
    logger.info('\n' + message);
    await this.notifier.sendMessage(message);
    
    // 存储到队列等待决策
    this.pendingDecisions.push(request);
    
    // 紧急情况下立即通知
    if (request.type === 'emergency') {
      await this.notifier.notifyAlert(
        '🚨 紧急决策请求',
        '检测到高风险情况，请立即查看并决策！'
      );
    }
  }
  
  /**
   * 格式化决策请求
   */
  private formatDecisionRequest(req: DecisionRequest): string {
    const lines: string[] = [];
    
    const typeEmoji = req.type === 'emergency' ? '🚨' : 
                     req.type === 'entry' ? '🎯' : '📤';
    
    lines.push(`${typeEmoji} 【决策请求】类型: ${req.type.toUpperCase()}`);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`时间: ${new Date(req.timestamp).toLocaleString()}`);
    lines.push('');
    
    // 市场数据
    lines.push('📊 市场数据');
    lines.push(`   价格: $${req.marketData.price.toFixed(2)} (${req.marketData.change24h >= 0 ? '+' : ''}${req.marketData.change24h.toFixed(2)}%)`);
    lines.push('');
    
    // 技术分析
    lines.push('📈 技术分析');
    lines.push(`   信号: ${req.technical.signal.toUpperCase()} (强度: ${req.technical.strength}/100)`);
    lines.push(`   RSI: ${req.technical.indicators.rsi.toFixed(2)}`);
    lines.push(`   EMA: ${req.technical.indicators.emaFast.toFixed(2)} / ${req.technical.indicators.emaSlow.toFixed(2)}`);
    lines.push('');
    
    // SMC
    lines.push('🎯 SMC 分析');
    lines.push(`   看涨OB: ${req.smc.bullishOB ? '✅' : '❌'}`);
    lines.push(`   看跌OB: ${req.smc.bearishOB ? '✅' : '❌'}`);
    if (req.smc.recentSweeps.length > 0) {
      lines.push(`   最近猎杀: ${req.smc.recentSweeps.join(', ')}`);
    }
    lines.push('');
    
    // AI 分析
    lines.push('🤖 AI 分析');
    lines.push(`   情绪: ${req.ai.sentiment > 0.2 ? '偏多 📈' : req.ai.sentiment < -0.2 ? '偏空 📉' : '中性 ➡️'}`);
    lines.push(`   风险等级: ${req.ai.riskLevel.toUpperCase()}`);
    if (req.ai.anomalies.length > 0) {
      lines.push(`   ⚠️ 异常: ${req.ai.anomalies.join(', ')}`);
    }
    lines.push('');
    
    // 当前持仓
    lines.push('💼 当前持仓');
    if (req.currentPosition.side === 'none') {
      lines.push('   无持仓');
    } else {
      lines.push(`   ${req.currentPosition.side.toUpperCase()} ${req.currentPosition.size.toFixed(4)} @ ${req.currentPosition.entryPrice.toFixed(2)}`);
      lines.push(`   浮亏: ${req.currentPosition.unrealizedPnl >= 0 ? '+' : ''}${req.currentPosition.unrealizedPnl.toFixed(2)} USDT`);
    }
    lines.push('');
    
    // 系统建议
    if (req.systemSuggestion) {
      lines.push('💡 系统建议');
      lines.push(`   建议操作: ${req.systemSuggestion.action.toUpperCase()}`);
      lines.push(`   置信度: ${(req.systemSuggestion.confidence * 100).toFixed(0)}%`);
      lines.push(`   理由:`);
      req.systemSuggestion.reasoning.forEach(r => lines.push(`      • ${r}`));
      lines.push('');
    }
    
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('⏰ 等待交易员决策...');
    lines.push('');
    
    return lines.join('\n');
  }
  
  /**
   * 接收交易员决策
   * 
   * 这是交易员提交决策的入口
   */
  async receiveDecision(decision: TraderDecision): Promise<void> {
    logger.info('\n✅ 收到交易员决策');
    logger.info(`   操作: ${decision.action.toUpperCase()}`);
    logger.info(`   理由: ${decision.reasoning}`);
    
    if (!decision.riskAcknowledged) {
      logger.warn('⚠️ 交易员未确认风险，取消执行');
      return;
    }
    
    // 执行决策
    await this.executeDecision(decision);
    
    // 从队列移除
    this.pendingDecisions = this.pendingDecisions.filter(
      d => d.timestamp < decision.timestamp
    );
  }
  
  /**
   * 执行交易决策
   */
  private async executeDecision(decision: TraderDecision): Promise<void> {
    const position = await this.getFormattedPosition();
    const price = await this.exchange.getCurrentPrice();
    const balance = await this.exchange.getBalance();
    
    try {
      if (decision.action === 'buy' && position.side === 'none') {
        const size = decision.parameters?.positionSize || 1;
        const positionSize = this.riskManager.calculatePositionSize(
          balance.free, price, price * 0.985
        ) * size;
        
        await this.exchange.openLong(
          positionSize,
          decision.parameters?.stopLoss || price * 0.985,
          decision.parameters?.takeProfit || price * 1.03
        );
        
        logger.info(`🟢 已执行: 开多 ${positionSize.toFixed(4)} ETH @ $${price.toFixed(2)}`);
        
      } else if (decision.action === 'sell' && position.side === 'none') {
        const size = decision.parameters?.positionSize || 1;
        const positionSize = this.riskManager.calculatePositionSize(
          balance.free, price, price * 1.015
        ) * size;
        
        await this.exchange.openShort(
          positionSize,
          decision.parameters?.stopLoss || price * 1.015,
          decision.parameters?.takeProfit || price * 0.97
        );
        
        logger.info(`🔴 已执行: 开空 ${positionSize.toFixed(4)} ETH @ $${price.toFixed(2)}`);
        
      } else if ((decision.action === 'close' || decision.action === 'emergency_exit') 
                 && position.side !== 'none') {
        const closeSide = position.side === 'long' ? 'sell' : 'buy';
        await this.exchange.closePosition(closeSide, position.size);
        
        const pnl = position.unrealizedPnl;
        this.riskManager.recordTrade(pnl);
        
        logger.info(`⚪ 已执行: 平仓 | PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);
        
      } else {
        logger.info(`⏸️ 决策已接收但未执行: ${decision.action} (条件不满足)`);
      }
      
    } catch (error) {
      logger.error('执行决策失败:', error);
    }
  }
  
  /**
   * 汇报当前状态
   */
  async reportStatus(): Promise<void> {
    const price = await this.exchange.getCurrentPrice();
    const position = await this.getFormattedPosition();
    const balance = await this.exchange.getBalance();
    const stats = this.riskManager.getStats();
    
    logger.info('\n📊 交易员状态汇报');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`ETH 价格: $${price.toFixed(2)}`);
    logger.info(`账户余额: ${balance.free.toFixed(2)} USDT`);
    
    if (position.side !== 'none') {
      logger.info(`当前持仓: ${position.side.toUpperCase()} ${position.size.toFixed(4)} @ ${position.entryPrice.toFixed(2)}`);
      logger.info(`浮动盈亏: ${position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)} USDT`);
    } else {
      logger.info('当前持仓: 无');
    }
    
    logger.info(`今日交易: ${stats.trades} 笔 | 盈亏: ${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)} USDT`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
  
  /**
   * 获取持仓信息
   */
  private async getFormattedPosition(): Promise<Position> {
    const raw = await this.exchange.getPosition();
    if (!raw || raw.contracts === 0) {
      return { side: 'none', size: 0, entryPrice: 0, leverage: config.leverage, unrealizedPnl: 0 };
    }
    return {
      side: raw.side === 'long' ? 'long' : 'short',
      size: Math.abs(raw.contracts),
      entryPrice: raw.entryPrice || 0,
      leverage: raw.leverage || config.leverage,
      unrealizedPnl: raw.unrealizedPnl || 0,
      liquidationPrice: raw.liquidationPrice,
    };
  }
  
  /**
   * 获取待处理决策
   */
  getPendingDecisions(): DecisionRequest[] {
    return this.pendingDecisions;
  }
}

export default TraderConsole;
