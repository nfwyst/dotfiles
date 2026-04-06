/**
 * Quant Algo 2.0 系统集成入口
 * 整合所有模块：Market Intelligence + Central Trading Agent + OPRO + Execution
 *
 * FIX M1: Added exports for event-driven runtime, layers, and state module.
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

// Execution Layer
export {
  TradingBotRuntime,
  OrderGenerator,
} from './execution';

export type {
  TradingBotConfig,
  OrderSpec,
  AgentDecision,
  MarketContext,
} from './execution';

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
  MonitoringDashboard,
} from './monitoring';

export type {
  TradeRecord,
  PerformanceReport,
  SystemStatus,
} from './monitoring';

// Backtest
export {
  LeakageControlledBacktest,
} from './backtest';

export type {
  BacktestConfig,
  BacktestResult,
  Strategy as BacktestStrategy,
} from './backtest';

// ==================== FIX M1: Event-driven runtime ====================

export { EventDrivenRuntime } from './runtime';
export type { RuntimeConfig, RuntimeDeps, RuntimeHealth, ComponentHealth } from './runtime';

// ==================== FIX M1: Event-driven layers ====================

export {
  EventDrivenDataLayer,
  EventDrivenStrategyLayer,
  EventDrivenExecutionLayer,
} from './layers';

// ==================== FIX M1: State module ====================

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

// ==================== 系统工厂 ====================

import { MarketIntelligencePipeline } from './agents/marketIntelligence';
import { CentralTradingAgent } from './agents/centralTradingAgent';
import { AdaptiveOPRO, FeedbackLoop } from './optimization';
import { TradingBotRuntime, OrderGenerator } from './execution';
import { PerformanceTracker, MonitoringDashboard } from './monitoring';

export interface TradingSystemConfig {
  symbol: string;
  initialBalance: number;
  
  // OPRO 配置
  oproEnabled: boolean;
  optimizationWindowDays: number;
  
  // 风险配置
  maxPositionSize: number;
  maxLeverage: number;
  maxDrawdown: number;
}

export const DEFAULT_SYSTEM_CONFIG: TradingSystemConfig = {
  symbol: 'ETHUSDT',
  initialBalance: 1000,
  oproEnabled: true,
  optimizationWindowDays: 5,
  maxPositionSize: 0.1,
  maxLeverage: 50,
  maxDrawdown: 0.15,
};

/**
 * 创建完整的交易系统
 */
export function createTradingSystem(config?: Partial<TradingSystemConfig>) {
  const finalConfig = { ...DEFAULT_SYSTEM_CONFIG, ...config };
  
  // 1. 性能追踪器
  const performanceTracker = new PerformanceTracker(
    finalConfig.initialBalance,
    finalConfig.optimizationWindowDays
  );
  
  // 2. Adaptive-OPRO
  const opro = new AdaptiveOPRO({
    windowSize: finalConfig.optimizationWindowDays,
  });
  
  // 3. 反馈循环
  const feedbackLoop = new FeedbackLoop(opro, finalConfig.optimizationWindowDays);
  
  // 4. Market Intelligence Pipeline
  const marketIntelligence = new MarketIntelligencePipeline();
  
  // 5. Central Trading Agent
  const centralTradingAgent = new CentralTradingAgent({
    riskLimits: {
      maxPositionSize: finalConfig.maxPositionSize,
      maxLeverage: finalConfig.maxLeverage,
      maxDrawdown: finalConfig.maxDrawdown,
    },
  });
  
  // 6. Trading Bot Runtime
  const tradingBot = new TradingBotRuntime();
  
  // 7. Order Generator
  const orderGenerator = new OrderGenerator();
  
  // 8. Monitoring Dashboard
  const dashboard = new MonitoringDashboard(performanceTracker, opro);
  dashboard.setTradingBot(tradingBot);
  dashboard.setMarketIntelligence(marketIntelligence);
  dashboard.setCentralTradingAgent(centralTradingAgent);
  
  return {
    // 配置
    config: finalConfig,
    
    // 模块
    performanceTracker,
    opro,
    feedbackLoop,
    marketIntelligence,
    centralTradingAgent,
    tradingBot,
    orderGenerator,
    dashboard,
    
    // 便捷方法
    async initialize() {
      await tradingBot.initialize();
      logger.info('Trading system initialized');
    },
    
    getStatus() {
      return dashboard.getStatus();
    },
    
    getPerformance() {
      return performanceTracker.calculateMetrics();
    },
  };
}

import logger from './logger';
