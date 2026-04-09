/**
 * 订单规格类型定义
 * 基于 ATLAS 论文的订单级动作空间
 * 
 * 核心概念：
 * - 输出必须是可执行的订单，而非抽象信号
 * - 包含完整的执行参数：类型、规模、时机、价格、止损止盈
 */

// ==================== 核心订单类型 ====================

/**
 * 完整订单规格
 */
export interface OrderSpec {
  // 订单标识
  id: string;
  timestamp: number;
  symbol: string;
  
  // 订单类型
  type: OrderType;
  side: OrderSide;
  
  // 规模
  size: number;                    // 数量 (ETH)
  sizeType: 'absolute' | 'percentage' | 'risk_based';
  
  // 价格参数
  price?: number;                  // 限价单价格
  stopPrice?: number;              // 止损触发价
  
  // 时效
  timeInForce: TimeInForce;
  validUntil?: number;             // Unix timestamp
  
  // 风控参数
  stopLoss: StopLossSpec;
  takeProfit: TakeProfitSpec;
  
  // 执行参数
  execution: ExecutionParams;
  
  // 元数据
  metadata: OrderMetadata;
}

/**
 * 订单类型
 */
export type OrderType = 
  | 'market'        // 市价单
  | 'limit'         // 限价单
  | 'stop'          // 止损单
  | 'stop_limit'    // 止损限价单
  | 'trailing_stop'; // 追踪止损单

/**
 * 订单方向
 */
export type OrderSide = 'buy' | 'sell';

/**
 * 时效类型
 */
export type TimeInForce = 
  | 'GTC'  // Good Till Cancel
  | 'IOC'  // Immediate Or Cancel
  | 'FOK'  // Fill Or Kill
  | 'GTX'; // Good Till Crossing (只做 Maker)

// ==================== 止损规格 ====================

export interface StopLossSpec {
  type: 'fixed' | 'trailing' | 'atr_based' | 'percentage';
  
  // 固定止损
  price?: number;
  
  // 追踪止损
  trailPercent?: number;          // 追踪百分比
  trailAmount?: number;           // 追踪金额
  
  // ATR 止损
  atrMultiplier?: number;
  
  // 百分比止损
  lossPercent?: number;
  
  // 激活条件
  activateOn?: 'entry' | 'profit'; // 入场即激活 或 盈利后激活
  activationProfit?: number;       // 激活所需的盈利百分比
}

// ==================== 止盈规格 ====================

export interface TakeProfitSpec {
  levels: TakeProfitLevel[];
  
  // 策略
  strategy: 'fixed' | 'partial' | 'trailing';
  
  // 移动止损到成本
  moveStopToEntry: boolean;
  moveStopAtLevel: number;        // 在第几个止盈位移动止损
}

export interface TakeProfitLevel {
  price: number;
  portion: number;                // 平仓比例 0-1
  type: 'limit' | 'market';
  
  // 移动止损
  moveStop?: {
    to: 'breakeven' | 'this_level' | 'next_level';
    trail?: number;               // 如果移动到追踪止损
  };
}

// ==================== 执行参数 ====================

export interface ExecutionParams {
  // 滑点容忍
  slippageTolerance: number;      // 0-1
  
  // 分割执行
  splitOrder: boolean;
  splitCount?: number;
  splitInterval?: number;         // 毫秒
  
  // 重试
  retryOnFailure: boolean;
  maxRetries: number;
  retryDelay: number;             // 毫秒
  
  // 超时
  timeout: number;                // 毫秒
}

// ==================== 订单元数据 ====================

export interface OrderMetadata {
  // 来源
  source: 'agent' | 'manual' | 'system';
  agentName?: string;
  
  // 决策信息
  reasoning: string[];
  confidence: number;
  
  // 关联
  parentOrderId?: string;
  relatedPositionId?: string;
  
  // 市场状态
  marketState?: {
    price: number;
    volatility: number;
    trend: string;
  };
}

// ==================== 执行结果 ====================

export interface ExecutionResult {
  success: boolean;
  orderId: string;
  
  // 成交信息
  fills: Fill[];
  totalFilled: number;
  avgPrice: number;
  
  // 费用
  fees: FeeBreakdown;
  
  // 时间
  executionTime: number;
  
  // 错误
  error?: ExecutionError;
}

export interface Fill {
  price: number;
  size: number;
  timestamp: number;
  fee: number;
  feeCurrency: string;
}

export interface FeeBreakdown {
  maker: number;
  taker: number;
  total: number;
  currency: string;
}

export interface ExecutionError {
  code: string;
  message: string;
  retryable: boolean;
}

// ==================== 订单状态 ====================

export interface OrderStatus {
  orderId: string;
  status: 'pending' | 'open' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';
  
  // 填充信息
  filledSize: number;
  remainingSize: number;
  avgFillPrice: number;
  
  // 时间戳
  createdAt: number;
  updatedAt: number;
  
  // 状态变更
  statusHistory: StatusChange[];
}

export interface StatusChange {
  from: string;
  to: string;
  timestamp: number;
  reason?: string;
}

// ==================== 订单构建器 ====================

/**
 * 订单构建器 - 流畅 API
 */
export class OrderBuilder {
  private order: Partial<OrderSpec>;
  
  constructor() {
    this.order = {
      id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      sizeType: 'absolute',
      timeInForce: 'GTC',
      execution: {
        slippageTolerance: 0.001,
        splitOrder: false,
        retryOnFailure: true,
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
      },
      metadata: {
        source: 'agent',
        reasoning: [],
        confidence: 0.5,
      },
    };
  }
  
  symbol(s: string): OrderBuilder {
    this.order.symbol = s;
    return this;
  }
  
  type(t: OrderType): OrderBuilder {
    this.order.type = t;
    return this;
  }
  
  side(s: OrderSide): OrderBuilder {
    this.order.side = s;
    return this;
  }
  
  size(sz: number, type?: 'absolute' | 'percentage' | 'risk_based'): OrderBuilder {
    this.order.size = sz;
    if (type) this.order.sizeType = type;
    return this;
  }
  
  price(p: number): OrderBuilder {
    this.order.price = p;
    return this;
  }
  
  stopPrice(sp: number): OrderBuilder {
    this.order.stopPrice = sp;
    return this;
  }
  
  stopLoss(sl: StopLossSpec): OrderBuilder {
    this.order.stopLoss = sl;
    return this;
  }
  
  takeProfit(tp: TakeProfitSpec): OrderBuilder {
    this.order.takeProfit = tp;
    return this;
  }
  
  reasoning(...reasons: string[]): OrderBuilder {
    this.order.metadata!.reasoning = reasons;
    return this;
  }
  
  confidence(c: number): OrderBuilder {
    this.order.metadata!.confidence = c;
    return this;
  }
  
  build(): OrderSpec {
    const { symbol, type, side, size, stopLoss, takeProfit } = this.order;
    if (!symbol) throw new Error('Symbol is required');
    if (!type) throw new Error('Order type is required');
    if (!side) throw new Error('Order side is required');
    if (!size) throw new Error('Size is required');
    if (!stopLoss) throw new Error('Stop loss is required');
    if (!takeProfit) throw new Error('Take profit is required');
    
    return { ...this.order, symbol, type, side, size, stopLoss, takeProfit } satisfies OrderSpec;
  }
}

// ==================== 辅助函数 ====================

/**
 * 验证订单
 */
export function validateOrder(order: OrderSpec): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 检查必填字段
  if (!order.symbol) errors.push('Symbol is required');
  if (!order.type) errors.push('Order type is required');
  if (!order.side) errors.push('Order side is required');
  if (!order.size || order.size <= 0) errors.push('Size must be positive');
  
  // 检查限价单
  if (order.type === 'limit' && !order.price) {
    errors.push('Limit order requires price');
  }
  
  // 检查止损单
  if (order.type === 'stop' && !order.stopPrice) {
    errors.push('Stop order requires stop price');
  }
  
  // 检查止损止盈
  if (!order.stopLoss) {
    errors.push('Stop loss is required');
  }
  if (!order.takeProfit || order.takeProfit.levels.length === 0) {
    errors.push('At least one take profit level is required');
  }
  
  // 检查止盈比例
  const totalPortion = order.takeProfit?.levels.reduce((sum, l) => sum + l.portion, 0) || 0;
  if (Math.abs(totalPortion - 1) > 0.01) {
    errors.push(`Take profit portions must sum to 1 (got ${totalPortion.toFixed(2)})`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 计算订单风险
 */
export function calculateOrderRisk(
  order: OrderSpec,
  currentPrice: number,
  balance: number
): {
  riskAmount: number;
  riskPercent: number;
  rewardAmount: number;
  rewardPercent: number;
  riskRewardRatio: number;
} {
  // 止损价格
  let stopPrice: number;
  if (order.stopLoss.type === 'fixed') {
    stopPrice = order.stopLoss.price!;
  } else if (order.stopLoss.type === 'atr_based') {
    const atr = currentPrice * 0.02; // 简化
    stopPrice = order.side === 'buy' 
      ? currentPrice - atr * (order.stopLoss.atrMultiplier || 2)
      : currentPrice + atr * (order.stopLoss.atrMultiplier || 2);
  } else if (order.stopLoss.type === 'percentage') {
    stopPrice = order.side === 'buy'
      ? currentPrice * (1 - (order.stopLoss.lossPercent || 0.02))
      : currentPrice * (1 + (order.stopLoss.lossPercent || 0.02));
  } else {
    stopPrice = currentPrice * 0.98; // 默认 2%
  }
  
  // 风险计算
  const entryPrice = order.price || currentPrice;
  const riskPerUnit = order.side === 'buy'
    ? entryPrice - stopPrice
    : stopPrice - entryPrice;
  
  const riskAmount = riskPerUnit * order.size;
  const riskPercent = riskAmount / balance;
  
  // 奖励计算 (使用第一个止盈位)
  const firstTP = order.takeProfit?.levels[0]?.price || entryPrice * 1.02;
  const rewardPerUnit = order.side === 'buy'
    ? firstTP - entryPrice
    : entryPrice - firstTP;
  
  const rewardAmount = rewardPerUnit * order.size;
  const rewardPercent = rewardAmount / balance;
  
  // 风险回报比
  const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;
  
  return {
    riskAmount,
    riskPercent,
    rewardAmount,
    rewardPercent,
    riskRewardRatio,
  };
}

// ==================== 导出 ====================

export const ORDER_VERSION = '2.0.0';
