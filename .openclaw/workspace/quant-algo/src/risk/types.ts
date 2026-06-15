export interface TradingContext {
  currentPrice: number;
  entryPrice: number;
  balance: number;
  unrealizedPnl: number;
  dailyPnl: number;
  dailyTrades: number;
  consecutiveLosses: number;
  barsSinceEntry: number;
  barsSinceLastTrade: number;
  peakBalance: number;
  currentDrawdownPercent: number;
}

export type RiskAction = 'allow' | 'reject' | 'reduce_size';

export interface RiskDecision {
  action: RiskAction;
  reason: string;
  guardName: string;
  metadata?: Record<string, number | string | boolean>;
}

export interface RiskGuard {
  readonly name: string;
  check(context: TradingContext): RiskDecision;
}
