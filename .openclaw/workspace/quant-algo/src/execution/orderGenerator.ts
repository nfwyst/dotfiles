/**
 * 订单生成器
 * 从 Agent 决策生成可执行的订单规格
 * 
 * 基于 ATLAS 论文的订单级动作空间
 */

import {
  OrderSpec,
  TradingBotConfig,
} from './tradingBot';

export interface AgentDecision {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string[];
  
  entry?: {
    priceRange: { min: number; max: number };
    riskRewardRatio: number;
    urgency: 'high' | 'medium' | 'low';
  };
  
  risk?: {
    level: 'low' | 'medium' | 'high';
    maxDrawdown: number;
    recommendedPositionSize: number;
    stopLoss: number;
    stopLossPercent?: number;
    takeProfitLevels: number[];
    takeProfitPercents?: number[];
  };
  
  trend?: {
    direction: 'up' | 'down' | 'sideways';
    strength: number;
  };
}

export interface MarketContext {
  currentPrice: number;
  atr: number;
  balance: number;
  hasPosition: boolean;
  positionSide?: 'long' | 'short';
  volatility: number;
  spread: number;
}

export class OrderGenerator {
  
  /**
   * 从 Agent 决策生成订单
   */
  generateOrder(
    decision: AgentDecision,
    context: MarketContext,
    config?: Partial<TradingBotConfig>
  ): OrderSpec | null {
    
    if (decision.action === 'hold') {
      return null;
    }
    
    const { currentPrice, atr, balance } = context;
    
    // 计算订单类型
    const orderType = this.determineOrderType(decision, context);
    
    // 计算仓位大小
    const positionSize = this.calculatePositionSize(decision, context, config);
    
    // 计算入场价格
    const entryPrice = this.calculateEntryPrice(decision, context, orderType);
    
    // 计算止损
    const stopLoss = this.calculateStopLoss(decision, context);
    
    // 计算止盈
    const takeProfitLevels = this.calculateTakeProfit(decision, context);
    
    return {
      type: orderType,
      side: decision.action,
      size: positionSize,
      price: orderType === 'limit' ? entryPrice : undefined,
      timeInForce: 'GTC',
      stopLoss,
      takeProfitLevels,
    };
  }
  
  /**
   * 从订单生成交易机器人配置
   */
  generateBotConfig(
    decision: AgentDecision,
    context: MarketContext,
    validDays: number = 7
  ): TradingBotConfig {
    
    const now = new Date();
    const validUntil = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);
    
    const atr = context.atr;
    const currentPrice = context.currentPrice;
    
    // 从决策提取参数
    const entryConditions: TradingBotConfig['entryConditions'] = {};
    
    if (decision.trend) {
      entryConditions.trend = {
        direction: decision.trend.direction,
        minStrength: decision.trend.strength * 0.8,
      };
    }
    
    if (decision.entry) {
      entryConditions.price = {
        above: decision.entry.priceRange.min,
        below: decision.entry.priceRange.max,
      };
    }
    
    // 出场条件
    const slMultiplier = decision.risk?.stopLoss 
      ? Math.abs(decision.risk.stopLoss - currentPrice) / atr 
      : 2;
    
    const tpLevels = decision.risk?.takeProfitLevels || [
      (currentPrice + atr * 1.5 - currentPrice) / currentPrice * 100,
      (currentPrice + atr * 3 - currentPrice) / currentPrice * 100,
      (currentPrice + atr * 5 - currentPrice) / currentPrice * 100,
    ];
    
    return {
      version: '2.0.0',
      generatedAt: now.toISOString(),
      validUntil: validUntil.toISOString(),
      symbol: 'ETHUSDT',
      
      entryConditions,
      
      exitConditions: {
        takeProfit: {
          levels: tpLevels,
          portions: [0.3, 0.4, 0.3],
        },
        stopLoss: {
          atrMultiplier: slMultiplier,
          trailing: decision.confidence > 0.7,
          trailingPercent: 1.5,
        },
      },
      
      riskManagement: {
        maxPositionSize: decision.risk?.recommendedPositionSize || 0.1,
        maxLeverage: decision.risk?.level === 'high' ? 20 : decision.risk?.level === 'low' ? 100 : 50,
        maxDrawdown: decision.risk?.maxDrawdown || 0.15,
      },
      
      orderSpec: {
        type: decision.entry?.urgency === 'high' ? 'market' : 'limit',
        slippageTolerance: 0.001,
      },
      
      metadata: {
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        marketRegime: decision.trend?.direction,
      },
    };
  }
  
  /**
   * 确定订单类型
   */
  private determineOrderType(
    decision: AgentDecision,
    context: MarketContext
  ): 'market' | 'limit' {
    
    // 高置信度 + 高波动 = 市价单
    if (decision.confidence > 0.8 && context.volatility > 0.02) {
      return 'market';
    }
    
    // 高紧急度 = 市价单
    if (decision.entry?.urgency === 'high') {
      return 'market';
    }
    
    // 低置信度或低波动 = 限价单
    if (decision.confidence < 0.6 || context.volatility < 0.01) {
      return 'limit';
    }
    
    // 默认限价单
    return 'limit';
  }
  
  /**
   * 计算仓位大小
   */
  private calculatePositionSize(
    decision: AgentDecision,
    context: MarketContext,
    config?: Partial<TradingBotConfig>
  ): number {
    
    const { balance, currentPrice } = context;
    
    // 基础仓位比例
    let baseSize = config?.riskManagement?.maxPositionSize || 0.1;
    
    // 根据风险等级调整
    if (decision.risk?.level === 'high') {
      baseSize *= 0.5;
    } else if (decision.risk?.level === 'low') {
      baseSize *= 1.2;
    }
    
    // 根据置信度调整
    baseSize *= (0.5 + decision.confidence * 0.5);
    
    // 根据趋势强度调整
    if (decision.trend?.strength) {
      baseSize *= (0.5 + decision.trend.strength / 200);
    }
    
    // 限制最大仓位
    baseSize = Math.min(baseSize, 0.3);
    
    // 杠杆
    const leverage = config?.riskManagement?.maxLeverage || 50;
    
    // 计算实际大小
    const positionValue = balance * baseSize * leverage;
    return positionValue / currentPrice;
  }
  
  /**
   * 计算入场价格
   */
  private calculateEntryPrice(
    decision: AgentDecision,
    context: MarketContext,
    orderType: 'market' | 'limit'
  ): number {
    
    const { currentPrice, spread } = context;
    
    if (orderType === 'market') {
      return currentPrice;
    }
    
    // 限价单：考虑价格区间
    if (decision.entry?.priceRange) {
      const { min, max } = decision.entry.priceRange;
      
      if (decision.action === 'buy') {
        return Math.min(max, currentPrice - spread);
      } else {
        return Math.max(min, currentPrice + spread);
      }
    }
    
    // 默认：略优于当前价
    return decision.action === 'buy' 
      ? currentPrice * 0.999 
      : currentPrice * 1.001;
  }
  
  /**
   * 计算止损价格
   */
  private calculateStopLoss(
    decision: AgentDecision,
    context: MarketContext
  ): number {
    
    const { currentPrice, atr } = context;
    
    // 如果有百分比，根据方向计算
    if (decision.risk?.stopLossPercent) {
      const percent = decision.risk.stopLossPercent;
      // 做多：止损在下方，做空：止损在上方
      return decision.action === 'buy'
        ? currentPrice * (1 - percent / 100)
        : currentPrice * (1 + percent / 100);
    }
    
    // 如果有具体价格，直接使用（需要验证方向）
    if (decision.risk?.stopLoss) {
      return decision.risk.stopLoss;
    }
    
    // 默认：2倍 ATR，根据方向
    const slMultiplier = decision.risk?.level === 'high' ? 1.5 : 2;
    return decision.action === 'buy'
      ? currentPrice - atr * slMultiplier
      : currentPrice + atr * slMultiplier;
  }
  
  /**
   * 计算止盈水平
   */
  private calculateTakeProfit(
    decision: AgentDecision,
    context: MarketContext
  ): OrderSpec['takeProfitLevels'] {
    
    const { currentPrice, atr } = context;
    const portions = [0.3, 0.4, 0.3];
    
    // 如果有百分比数组，根据方向计算
    if (decision.risk?.takeProfitPercents && decision.risk.takeProfitPercents.length >= 3) {
      return decision.risk.takeProfitPercents.slice(0, 3).map((percent, i) => ({
        // 做多：止盈在上方，做空：止盈在下方
        price: decision.action === 'buy'
          ? currentPrice * (1 + percent / 100)
          : currentPrice * (1 - percent / 100),
        portion: portions[i]!,
        type: 'limit' as const,
      }));
    }
    
    // 如果有具体价格数组，直接使用
    if (decision.risk?.takeProfitLevels && decision.risk.takeProfitLevels.length >= 3) {
      return decision.risk.takeProfitLevels.slice(0, 3).map((price, i) => ({
        price,
        portion: portions[i]!,
        type: 'limit' as const,
      }));
    }
    
    // 默认：1.5x, 3x, 5x ATR，根据方向
    const multipliers = [1.5, 3, 5];
    return multipliers.map((mult, i) => ({
      price: decision.action === 'buy'
        ? currentPrice + atr * mult
        : currentPrice - atr * mult,
      portion: portions[i]!,
      type: 'limit' as const,
    }));
  }
  
  /**
   * 验证订单
   */
  validateOrder(order: OrderSpec, context: MarketContext): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // 检查仓位大小
    if (order.size <= 0) {
      errors.push('Position size must be positive');
    }
    
    // 检查止损
    if (order.side === 'buy' && order.stopLoss >= context.currentPrice) {
      errors.push('Stop loss must be below entry price for long');
    }
    if (order.side === 'sell' && order.stopLoss <= context.currentPrice) {
      errors.push('Stop loss must be above entry price for short');
    }
    
    // 检查止盈
    for (const tp of order.takeProfitLevels) {
      if (order.side === 'buy' && tp.price <= context.currentPrice) {
        errors.push('Take profit must be above entry price for long');
      }
      if (order.side === 'sell' && tp.price >= context.currentPrice) {
        errors.push('Take profit must be below entry price for short');
      }
    }
    
    // 检查止盈比例总和
    const totalPortion = order.takeProfitLevels.reduce((sum, tp) => sum + tp.portion, 0);
    if (Math.abs(totalPortion - 1) > 0.01) {
      errors.push(`Take profit portions must sum to 1 (got ${totalPortion.toFixed(2)})`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default OrderGenerator;
