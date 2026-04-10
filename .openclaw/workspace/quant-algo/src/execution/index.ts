/**
 * 执行层入口
 * 策略-执行解耦架构
 */

export { OrderGenerator } from './orderGenerator';
export { validateOrder, calculateOrderRisk, OrderBuilder } from './orderTypes';

export type {
  OrderSpec,
  OrderType,
  OrderSide,
  StopLossSpec,
  TakeProfitSpec,
  TakeProfitLevel,
  ExecutionResult,
  ExecutionParams,
  OrderMetadata,
} from './orderTypes';

export type {
  TradingBotConfig,
  SimpleOrderSpec,
  Position,
  PerformanceMetrics,
  TradeRecord,
} from './sharedTypes';

export type {
  AgentDecision,
  MarketContext,
} from './orderGenerator';
