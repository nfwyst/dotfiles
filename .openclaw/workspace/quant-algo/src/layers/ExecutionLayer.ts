/**
 * 执行层 - Execution Layer
 * 负责订单管理、持仓管理、止盈止损执行、通知发送
 * 
 * 集成熔断器保护，防止级联故障
 */

import ExchangeManager from '../exchange';
import RiskManager from '../riskManager';
import type { Position } from '../riskManager';
import NotificationManager from '../notifier';
import { config } from '../config';
import logger, { tradeLogger } from '../logger';
import { stateManager } from '../stateManager';
import type { EnhancedSignal } from './StrategyLayer';
import { executionCircuitBreaker } from '../safety/circuitBreakers';

export interface ExecutionContext {
  currentPrice: number;
  balance: number;
  position: Position;
  signal: EnhancedSignal;
}

export interface ExecutionResult {
  success: boolean;
  action: 'open_long' | 'open_short' | 'close_long' | 'close_short' | 'update_sltp' | 'hold' | 'error';
  message: string;
  pnl?: number;
  size?: number;
  price?: number;
}

/**
 * 执行层 - 处理交易执行和持仓管理
 */
export class ExecutionLayer {
  private exchange: ExchangeManager;
  private riskManager: RiskManager;
  private notifier: NotificationManager;
  private currentStopLoss: number | null = null;
  private currentTakeProfit: number | null = null;

  constructor(exchange: ExchangeManager) {
    this.exchange = exchange;
    this.riskManager = new RiskManager();
    this.notifier = new NotificationManager();
  }

  /**
   * 执行交易信号
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { signal, position, currentPrice, balance } = context;

    // 0. 熔断器检查
    if (executionCircuitBreaker.isOpen()) {
      logger.warn('🚨 执行熔断器已打开，拒绝交易');
      return {
        success: false,
        action: 'hold',
        message: '执行熔断器已打开，等待恢复',
      };
    }

    // 1. 紧急检查
    const emergencyCheck = this.riskManager.checkEmergencyExit(position, currentPrice);
    if (emergencyCheck.shouldExit) {
      return await this.closePosition(position, emergencyCheck.reason!);
    }

    // 2. 有持仓时管理持仓
    if (position.side !== 'none') {
      return await this.managePosition(context);
    }

    // 3. 检查是否可以开新仓
    const canTrade = this.riskManager.canOpenPosition(balance, position);
    if (!canTrade.allowed) {
      logger.debug(`无法开新仓: ${canTrade.reason}`);
      return {
        success: false,
        action: 'hold',
        message: canTrade.reason || '风控限制',
      };
    }

    // 4. 开新仓
    if (signal.strength >= 50 && signal.confidence >= 0.6 && signal.llmDecision) {
      return await this.openPosition(signal, currentPrice, balance);
    }

    return {
      success: false,
      action: 'hold',
      message: '信号强度不足',
    };
  }

  /**
   * 开仓
   */
  private async openPosition(
    signal: EnhancedSignal,
    currentPrice: number,
    balance: number
  ): Promise<ExecutionResult> {
    const llmDecision = signal.llmDecision;
    if (!llmDecision) {
      return {
        success: false,
        action: 'error',
        message: '缺少 LLM 决策',
      };
    }

    // LLM 建议 hold
    if (llmDecision.action === 'hold') {
      logger.info(`🛑 LLM 建议观望 | 理由: ${llmDecision.reasoning[0] || '风险过高'}`);
      return {
        success: false,
        action: 'hold',
        message: llmDecision.reasoning[0] || 'LLM 建议观望',
      };
    }

    // 风险过高
    if (llmDecision.riskLevel === 'high') {
      logger.warn(`⚠️ LLM 评估风险过高: ${llmDecision.warnings.join(', ')}`);
      return {
        success: false,
        action: 'hold',
        message: `风险过高: ${llmDecision.warnings.join(', ')}`,
      };
    }

    const side = llmDecision.action;
    const positionSide: 'long' | 'short' = side === 'buy' ? 'long' : 'short';

    // 计算仓位
    const basePositionSize = this.riskManager.calculatePositionSize(
      balance,
      currentPrice,
      this.riskManager.calculateStopLoss(currentPrice, positionSide)
    );
    const positionSize = basePositionSize * llmDecision.positionSize;

    if (positionSize <= 0) {
      return {
        success: false,
        action: 'error',
        message: '仓位大小无效',
      };
    }

    // 止损止盈
    const stopLossPrice = signal.stopLoss || this.riskManager.calculateStopLoss(currentPrice, positionSide);
    const takeProfitPrice = signal.takeProfit || this.riskManager.calculateTakeProfit(currentPrice, positionSide);

    // 日志
    logger.info(`🤖 LLM 决策执行 | 方向: ${positionSide.toUpperCase()} | 价格: $${currentPrice}`);
    logger.info(`   LLM 置信度: ${(llmDecision.confidence * 100).toFixed(0)}% | 风险: ${llmDecision.riskLevel}`);
    logger.info(`   仓位: ${positionSize.toFixed(4)} ETH | 止损: ${stopLossPrice.toFixed(2)} | 止盈: ${takeProfitPrice.toFixed(2)}`);

    try {
      if (side === 'buy') {
        await this.exchange.openLong(positionSize, stopLossPrice, takeProfitPrice);
      } else {
        await this.exchange.openShort(positionSize, stopLossPrice, takeProfitPrice);
      }

      // 保存 SL/TP
      this.currentStopLoss = stopLossPrice;
      this.currentTakeProfit = takeProfitPrice;

      // 记录
      tradeLogger.info('开仓', {
        side: positionSide,
        price: currentPrice,
        size: positionSize,
        stopLoss: stopLossPrice,
        takeProfit: takeProfitPrice,
        llmConfidence: llmDecision.confidence,
        llmRiskLevel: llmDecision.riskLevel,
        llmReasoning: llmDecision.reasoning,
        marketSentiment: llmDecision.marketSentiment,
      });

      // 更新状态
      stateManager.updatePosition({
        side: positionSide,
        contracts: positionSize,
        entryPrice: currentPrice,
        markPrice: currentPrice,
        pnl: 0,
        stopLoss: stopLossPrice,
        takeProfit: takeProfitPrice,
      });

      // 通知
      await this.notifier.sendNotification(
        `🤖 **LLM 决策开仓**\n方向: ${positionSide.toUpperCase()} @ $${currentPrice}\n置信度: ${(llmDecision.confidence * 100).toFixed(0)}% | 风险: ${llmDecision.riskLevel}\n仓位: ${(llmDecision.positionSize * 100).toFixed(0)}%`
      );

      return {
        success: true,
        action: side === 'buy' ? 'open_long' : 'open_short',
        message: `开仓成功: ${positionSide} ${positionSize.toFixed(4)} @ $${currentPrice}`,
        size: positionSize,
        price: currentPrice,
      };

    } catch (error: any) {
      logger.error('开仓失败:', error);
      return {
        success: false,
        action: 'error',
        message: `开仓失败: ${error.message}`,
      };
    }
  }

  /**
   * 管理持仓
   */
  private async managePosition(context: ExecutionContext): Promise<ExecutionResult> {
    const { position, signal, currentPrice } = context;

    // 止损触发
    if (position.side === 'long' && position.stopLoss && currentPrice <= position.stopLoss) {
      return await this.closePosition(position, `止损触发 @ $${currentPrice}`);
    }
    if (position.side === 'short' && position.stopLoss && currentPrice >= position.stopLoss) {
      return await this.closePosition(position, `止损触发 @ $${currentPrice}`);
    }

    // 止盈触发
    if (position.side === 'long' && position.takeProfit && currentPrice >= position.takeProfit) {
      return await this.closePosition(position, `止盈触发 @ $${currentPrice}`);
    }
    if (position.side === 'short' && position.takeProfit && currentPrice <= position.takeProfit) {
      return await this.closePosition(position, `止盈触发 @ $${currentPrice}`);
    }

    // 信号反转平仓
    const shouldClose =
      (position.side === 'long' && signal.type === 'sell' && signal.strength >= 50) ||
      (position.side === 'short' && signal.type === 'buy' && signal.strength >= 50);

    if (shouldClose) {
      return await this.closePosition(position, `信号反转 (强度 ${signal.strength})`);
    }

    return {
      success: true,
      action: 'hold',
      message: '持仓管理正常',
    };
  }

  /**
   * 平仓
   */
  async closePosition(position: Position, reason: string): Promise<ExecutionResult> {
    if (position.side === 'none' || position.size === 0) {
      return {
        success: false,
        action: 'error',
        message: '无持仓可平',
      };
    }

    const closeSide = position.side === 'long' ? 'sell' : 'buy';

    logger.info(`📤 执行平仓 | 原因: ${reason} | 持仓: ${position.side.toUpperCase()}`);

    try {
      await this.exchange.createOrder(
        config.symbol,
        'market',
        closeSide,
        position.size
      );

      // 清除 SL/TP
      this.currentStopLoss = null;
      this.currentTakeProfit = null;

      // 记录
      const pnl = position.unrealizedPnl;
      this.riskManager.recordTrade(pnl);

      tradeLogger.info('平仓', {
        side: position.side,
        reason: reason,
        pnl: pnl,
        size: position.size,
      });

      // 更新状态
      stateManager.updatePosition(null);
      stateManager.recordTrade(pnl);

      // 通知
      await this.notifier.notifyClosePosition(
        position.side,
        position.entryPrice,
        position.entryPrice + (pnl / position.size),
        pnl,
        reason
      );

      console.log(this.riskManager.formatStats());

      return {
        success: true,
        action: position.side === 'long' ? 'close_long' : 'close_short',
        message: `平仓成功: ${reason}`,
        pnl,
        size: position.size,
        price: position.entryPrice,
      };

    } catch (error: any) {
      logger.error('平仓失败:', error);
      return {
        success: false,
        action: 'error',
        message: `平仓失败: ${error.message}`,
      };
    }
  }

  /**
   * 获取格式化的持仓信息
   */
  async getFormattedPosition(): Promise<Position> {
    const rawPosition = await this.exchange.getPosition();

    if (!rawPosition || rawPosition.contracts === 0) {
      this.currentStopLoss = null;
      this.currentTakeProfit = null;
      return {
        side: 'none',
        size: 0,
        entryPrice: 0,
        leverage: config.leverage,
        unrealizedPnl: 0,
      };
    }

    return {
      side: rawPosition.side === 'long' ? 'long' : 'short',
      size: Math.abs(rawPosition.contracts),
      entryPrice: rawPosition.entryPrice || 0,
      leverage: rawPosition.leverage || config.leverage,
      unrealizedPnl: rawPosition.unrealizedPnl || 0,
      liquidationPrice: rawPosition.liquidationPrice,
      stopLoss: this.currentStopLoss,
      takeProfit: this.currentTakeProfit,
    };
  }

  /**
   * 获取风控统计
   */
  getRiskStats(): string {
    return this.riskManager.formatStats();
  }

  /**
   * 发送启动通知
   */
  async notifyStart(): Promise<void> {
    await this.notifier.notifyStart();
  }

  /**
   * 发送停止通知
   */
  async notifyStop(): Promise<void> {
    await this.notifier.notifyStop();
  }

  /**
   * 检查新闻
   */
  async checkNews(): Promise<void> {
    await this.notifier.checkAndNotifyNews();
  }

  /**
   * 获取新闻摘要
   */
  async getNewsSummary(): Promise<string> {
    return await this.notifier.getNewsSummary();
  }
}

export default ExecutionLayer;
