/**
 * Quant Algo 2.0 系统集成入口
 * 整合所有模块：Event-Driven Runtime + OCS Layers + State
 *
 * Phase 0: Migrated from TradingBotRuntime to EventDrivenRuntime.
 * The `bootstrap()` factory creates and wires all components.
 */

// ==================== 核心模块 ====================

// Market Intelligence Pipeline
export { 
  MarketIntelligencePipeline,
  getPipeline,
} from './agents/marketIntelligence';

export type {
  MarketIntelligenceReport,
  TechnicalReport,
  SentimentReport,
  OnChainReport,
  AnalysisContext,
} from './agents/marketIntelligence';

// Central Trading Agent
export { CentralTradingAgent } from './agents/centralTradingAgent';

export type {
  CompositeDecision,
  DecisionContext,
  TrendAgentOutput,
  EntryAgentOutput,
  RiskAgentOutput,
  AlignmentReport,
} from './agents/centralTradingAgent';

// Adaptive-OPRO
export {
  AdaptiveOPRO,
  FeedbackLoop,
  getOPRO,
  getFeedbackLoop,
} from './optimization';

export type {
  OptimizationRecord,
  PerformanceMetrics,
  OptimizationResult,
  OPROConfig,
} from './optimization';

// Order types (still useful for order construction)
export {
  OrderBuilder,
  validateOrder,
  calculateOrderRisk,
} from './execution/orderTypes';

export type {
  OrderType,
  OrderSide,
  StopLossSpec,
  TakeProfitSpec,
  TakeProfitLevel,
  ExecutionResult,
} from './execution/orderTypes';

// Monitoring
export {
  PerformanceTracker,
} from './monitoring';
export { MonitoringDashboard } from './monitoring/dashboard';
export type { SystemStatus } from './monitoring/dashboard';

export type {
  TradeRecord,
  PerformanceReport,
} from './monitoring';

// Backtest (CPCV/PBO validation — public API)
export {
  combinatorialPurgedCV,
  probabilityOfBacktestOverfitting,
  validateBacktest,
} from './backtest';

export type {
  CPCVConfig,
  CPCVResult,
  PBOResult,
  BacktestValidationResult,
} from './backtest';

// ==================== Event-driven runtime ====================

export { EventDrivenRuntime } from './runtime';
export type { RuntimeConfig, RuntimeDeps, RuntimeHealth, ComponentHealth } from './runtime';

// ==================== Bootstrap factory ====================

export { bootstrap } from './bootstrap';

// ==================== Event-driven layers ====================

export {
  EventDrivenDataLayer,
  EventDrivenStrategyLayer,
  EventDrivenExecutionLayer,
} from './layers';

// ==================== State module ====================

export {
  StateManager,
  StateStore,
  WALManager,
  SnapshotManager,
  createStateManager,
  createDefaultState,
} from './state';

export type {
  StateConfig,
  UnifiedState,
  WALEntry,
  WALStats,
  StateSnapshot,
  SnapshotInfo,
} from './state';

// ==================== Event Bus ====================

export type { EventBus } from './events/EventBus';

import logger from './logger';
