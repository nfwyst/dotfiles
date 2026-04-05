/**
 * 事件类型定义 - Event Types
 * 定义事件驱动架构中所有事件的类型和数据结构
 */

import type { Position } from '../riskManager';

// ==================== 共享类型定义 ====================
// 这些类型定义在这里，避免循环依赖

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  ohlcv: OHLCV[];
  higherTfOhlcv: OHLCV[];
  currentPrice: number;
  orderBook?: {
    bids: Array<[number, number]>;
    asks: Array<[number, number]>;
  };
}

export interface Indicators {
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  rsi14: number;
  adaptiveRSI: { value: number; period: number; trend: string };
  macd: { macd: number; signal: number; histogram: number };
  atr14: number;
  bollinger: { upper: number; middle: number; lower: number };
  supertrend: { value: number; direction: number };
  adx: number;
  stochastic: { k: number; d: number };
  cci: number;
  vwap: number;
  obv: number;
  volumeSma20: number;
  trendScore: number;
  momentumScore: number;
  volumeScore: number;
  volatilityScore: number;
  overallScore: number;
}

export interface SMCAnalysis {
  bullishOBs: Array<{ high: number; low: number; time: number }>;
  bearishOBs: Array<{ high: number; low: number; time: number }>;
  fvgs: Array<{ high: number; low: number; time: number }>;
  sweeps: Array<{ price: number; time: number }>;
  bullishFVGs: Array<{ high: number; low: number; time: number }>;
  bearishFVGs: Array<{ high: number; low: number; time: number }>;
  orderBlocks: Array<{ high: number; low: number; time: number; type: string }>;
}

export interface MicrostructureSignal {
  score: number;
  confidence: number;
  direction: 'bullish' | 'bearish' | 'neutral';
}

export interface AnomalyResult {
  isAnomaly: boolean;
  severity: number;
  anomalyType: string;
  reason: string;
}

export interface RiskForecast {
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

// ==================== 策略层类型 ====================

export interface LLMDecision {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  keyFactors: string[];
}

export interface EnhancedSignal {
  type: 'long' | 'short' | 'hold';
  strength: number;
  confidence: number;
  stopLoss: number;
  takeProfit: number;
  llmDecision?: LLMDecision;
  smcAlignment?: {
    hasOrderBlock: boolean;
    hasFVG: boolean;
    sweepDetected: boolean;
    direction: 'bullish' | 'bearish' | 'neutral';
  };
  riskRewardRatio: number;
}

// ==================== 事件通道常量 ====================

export const EventChannels = {
  // 数据层事件
  MARKET_DATA_GATHERED: 'market:data:gathered',
  INDICATORS_CALCULATED: 'market:indicators:calculated',
  SMC_ANALYZED: 'market:smc:analyzed',
  DATA_LAYER_COMPLETE: 'data:layer:complete',

  // 策略层事件
  SIGNAL_GENERATED: 'strategy:signal:generated',
  LLM_DECISION_MADE: 'strategy:llm:decision',
  STRATEGY_LAYER_COMPLETE: 'strategy:layer:complete',

  // 执行层事件
  ORDER_EXECUTED: 'execution:order:executed',
  POSITION_UPDATED: 'execution:position:updated',
  NOTIFICATION_SENT: 'execution:notification:sent',
  EXECUTION_LAYER_COMPLETE: 'execution:layer:complete',

  // 系统事件
  SYSTEM_STARTED: 'system:started',
  SYSTEM_STOPPED: 'system:stopped',
  SYSTEM_ERROR: 'system:error',
  HEARTBEAT: 'system:heartbeat',
} as const;

export type EventChannel = typeof EventChannels[keyof typeof EventChannels];

// ==================== 基础事件接口 ====================

export interface BaseEvent<T = unknown> {
  id: string;
  channel: EventChannel;
  timestamp: number;
  source: 'DataLayer' | 'StrategyLayer' | 'ExecutionLayer' | 'System';
  correlationId: string;
  payload: T;
}

// ==================== 数据层事件负载 ====================

export interface MarketDataGatheredPayload {
  marketData: MarketData;
  gatherDuration: number;
}

export interface IndicatorsCalculatedPayload {
  indicators: Indicators;
  price: number;
}

export interface SMCAnalyzedPayload {
  smcAnalysis: SMCAnalysis | null;
  microSignal: MicrostructureSignal | null;
}

export interface DataLayerCompletePayload {
  marketData: MarketData;
  indicators: Indicators;
  smcAnalysis: SMCAnalysis | null;
  microSignal: MicrostructureSignal | null;
  anomaly: AnomalyResult | null;
  riskForecast: RiskForecast | null;
  totalDuration: number;
}

// ==================== 策略层事件负载 ====================

export interface SignalGeneratedPayload {
  signal: EnhancedSignal;
  context: {
    currentPrice: number;
    position: Position | null;
    balance: number;
  };
}

export interface LLMDecisionPayload {
  llmDecision: EnhancedSignal['llmDecision'];
  signal: EnhancedSignal;
}

export interface StrategyLayerCompletePayload {
  signal: EnhancedSignal;
  dataContext: DataLayerCompletePayload;
}

// ==================== 执行层事件负载 ====================

export interface OrderExecutedPayload {
  action: 'open_long' | 'open_short' | 'close_long' | 'close_short' | 'update_sltp' | 'hold';
  success: boolean;
  price?: number;
  size?: number;
  message: string;
  pnl?: number;
}

export interface PositionUpdatedPayload {
  position: Position;
  previousPosition: Position | null;
}

export interface NotificationSentPayload {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface ExecutionLayerCompletePayload {
  result: {
    success: boolean;
    action: string;
    message: string;
    pnl?: number;
  };
  signal: EnhancedSignal;
}

// ==================== 系统事件负载 ====================

export interface SystemStartedPayload {
  config: {
    symbol: string;
    timeframe: string;
    leverage: number;
  };
  balance: number;
}

export interface SystemStoppedPayload {
  reason: string;
  duration: number;
  finalStats: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
  };
}

export interface SystemErrorPayload {
  error: string;
  stack?: string;
  layer?: 'DataLayer' | 'StrategyLayer' | 'ExecutionLayer';
  recoverable: boolean;
}

export interface HeartbeatPayload {
  pid: number;
  uptime: number;
  lastTradeTime: number | null;
  position: Position | null;
}

// ==================== 具体事件类型 ====================

export type MarketDataGatheredEvent = BaseEvent<MarketDataGatheredPayload>;
export type IndicatorsCalculatedEvent = BaseEvent<IndicatorsCalculatedPayload>;
export type SMCAnalyzedEvent = BaseEvent<SMCAnalyzedPayload>;
export type DataLayerCompleteEvent = BaseEvent<DataLayerCompletePayload>;

export type SignalGeneratedEvent = BaseEvent<SignalGeneratedPayload>;
export type LLMDecisionEvent = BaseEvent<LLMDecisionPayload>;
export type StrategyLayerCompleteEvent = BaseEvent<StrategyLayerCompletePayload>;

export type OrderExecutedEvent = BaseEvent<OrderExecutedPayload>;
export type PositionUpdatedEvent = BaseEvent<PositionUpdatedPayload>;
export type NotificationSentEvent = BaseEvent<NotificationSentPayload>;
export type ExecutionLayerCompleteEvent = BaseEvent<ExecutionLayerCompletePayload>;

export type SystemStartedEvent = BaseEvent<SystemStartedPayload>;
export type SystemStoppedEvent = BaseEvent<SystemStoppedPayload>;
export type SystemErrorEvent = BaseEvent<SystemErrorPayload>;
export type HeartbeatEvent = BaseEvent<HeartbeatPayload>;

// ==================== 事件联合类型 ====================

export type TradingEvent =
  | MarketDataGatheredEvent
  | IndicatorsCalculatedEvent
  | SMCAnalyzedEvent
  | DataLayerCompleteEvent
  | SignalGeneratedEvent
  | LLMDecisionEvent
  | StrategyLayerCompleteEvent
  | OrderExecutedEvent
  | PositionUpdatedEvent
  | NotificationSentEvent
  | ExecutionLayerCompleteEvent
  | SystemStartedEvent
  | SystemStoppedEvent
  | SystemErrorEvent
  | HeartbeatEvent;

// ==================== 事件处理器类型 ====================

export type EventHandler<T extends BaseEvent = TradingEvent> = (event: T) => Promise<void> | void;

// ==================== 事件过滤器 ====================

export interface EventFilter {
  channels?: EventChannel[];
  sources?: BaseEvent['source'][];
  correlationId?: string;
  startTime?: number;
  endTime?: number;
}
