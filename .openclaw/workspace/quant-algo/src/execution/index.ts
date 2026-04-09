/**
 * 执行层入口
 * 策略-执行解耦架构
 */

export { TradingBotRuntime } from './tradingBot';
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
} from './tradingBot';

export type {
  AgentDecision,
  MarketContext,
} from './orderGenerator';
