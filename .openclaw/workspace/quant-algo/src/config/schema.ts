/**
 * Unified Config Schema — Pure Validation
 *
 * This file defines the SHAPE and VALIDATION RULES only.
 * All default values live in config.ts (the single source of truth).
 * No .default() on any field — every value must be explicitly provided.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Primitives
// ═══════════════════════════════════════════════════════════════

export const TradingModeSchema = z.enum(['live', 'paper', 'backtest']);
export type TradingMode = z.infer<typeof TradingModeSchema>;

export const TimeframeSchema = z.enum(['1m', '5m', '15m', '1h', '4h', '1d']);
export type Timeframe = z.infer<typeof TimeframeSchema>;

// ═══════════════════════════════════════════════════════════════
// Sub-Schemas
// ═══════════════════════════════════════════════════════════════

export const SymbolConfigSchema = z.object({
  /** CCXT symbol format (e.g. 'ETH/USDT:USDT') */
  ccxt: z.string(),
  /** Binance raw symbol (e.g. 'ETHUSDT') */
  binance: z.string(),
  /** Price decimal places */
  pricePrecision: z.number().int().nonnegative(),
  /** Quantity decimal places */
  quantityPrecision: z.number().int().nonnegative(),
});
export type SymbolConfig = z.infer<typeof SymbolConfigSchema>;

export const PositionSchema = z.object({
  /** Leverage multiplier */
  leverage: z.number().int().min(1).max(125),
  /** Max position size as fraction of portfolio */
  maxSize: z.number().positive().max(1),
  /** Risk per trade as fraction of balance */
  riskPerTrade: z.number().positive().max(1),
  /** Base position size as fraction of portfolio */
  baseSize: z.number().positive().max(1),
});
export type PositionConfig = z.infer<typeof PositionSchema>;

const MinStopPercentSchema = z.record(TimeframeSchema, z.number().positive()).optional();

export const StopLossSchema = z.object({
  /** ATR multiplier for stop distance */
  atrMultiplier: z.number().positive(),
  /** Buffer added to swing level stops */
  swingBuffer: z.number().nonnegative(),
  /** Minimum stop percentage per timeframe */
  minStopPercent: MinStopPercentSchema,
  /** Maximum stop percentage — caps SL distance to prevent oversized risk */
  maxStopPercent: z.number().positive(),
});
export type StopLossConfig = z.infer<typeof StopLossSchema>;

export const TakeProfitLevelSchema = z.object({
  /** Risk:reward ratio for this level */
  rrRatio: z.number().positive(),
  /** Fraction of position to close at this level (0-1) */
  closePercent: z.number().positive().max(1),
});

export const TakeProfitSchema = z.object({
  /** Ordered array of take-profit levels */
  levels: z.array(TakeProfitLevelSchema).min(1),
});
export type TakeProfitConfig = z.infer<typeof TakeProfitSchema>;

export const AtrFallbackSchema = z.object({
  /** ATR multiplier for stop loss when swing levels unavailable */
  slMultiplier: z.number().positive(),
  /** ATR multipliers for take-profit levels */
  tpMultipliers: z.array(z.number().positive()).min(1),
});
export type AtrFallbackConfig = z.infer<typeof AtrFallbackSchema>;

export const SwingDetectionEntrySchema = z.object({
  lookback: z.number().int().positive(),
  strength: z.number().int().positive(),
  minStopPercent: z.number().positive(),
});

export const SwingDetectionSchema = z.record(TimeframeSchema, SwingDetectionEntrySchema);
export type SwingDetectionConfig = z.infer<typeof SwingDetectionSchema>;

export const RiskSchema = z.object({
  /** Max daily loss as fraction of equity */
  maxDailyLoss: z.number().positive().max(1),
  /** Max trades per day */
  maxDailyTrades: z.number().int().positive(),
  /** Max drawdown before circuit breaker */
  maxDrawdown: z.number().positive().max(1),
  /** Minimum bars between trades */
  cooldownBars: z.number().int().nonnegative(),
  /** Consecutive losses before pause */
  maxConsecutiveLosses: z.number().int().positive(),
  /** Pause duration after consecutive losses */
  consecutiveLossPauseBars: z.number().int().nonnegative(),
  /** Max bars to hold a position */
  maxHoldingBars: z.number().int().positive(),
  /** Circuit breaker cooldown bars */
  circuitBreakerCooldownBars: z.number().int().nonnegative(),
  /** Circuit breaker max cooldown bars */
  circuitBreakerMaxCooldownBars: z.number().int().nonnegative(),
});
export type RiskConfig = z.infer<typeof RiskSchema>;

export const CostSchema = z.object({
  /** Taker fee rate */
  feeRate: z.number().nonnegative(),
  /** Maker rebate (negative = rebate) */
  makerRebate: z.number(),
  /** Slippage in basis points */
  slippageBps: z.number().nonnegative(),
});
export type CostConfig = z.infer<typeof CostSchema>;

export const BacktestSchema = z.object({
  /** Initial balance in quote currency */
  initialBalance: z.number().positive(),
  /** Trading days per year (crypto = 365, used for annualized return calc) */
  tradingDaysPerYear: z.number().int().positive(),
  /** Start date (ISO 8601 date string YYYY-MM-DD) */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date YYYY-MM-DD'),
  /** End date (ISO 8601 date string YYYY-MM-DD) */
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date YYYY-MM-DD'),
});
export type BacktestSpecConfig = z.infer<typeof BacktestSchema>;

export const ExchangeSchema = z.object({
  /** Exchange identifier */
  id: z.string(),
  /** Use sandbox/testnet */
  sandbox: z.boolean(),
  /** Enable rate limiting */
  enableRateLimit: z.boolean(),
});
export type ExchangeConfig = z.infer<typeof ExchangeSchema>;

// ═══════════════════════════════════════════════════════════════
// Root Schema
// ═══════════════════════════════════════════════════════════════

export const UnifiedConfigSchema = z.object({
  mode: TradingModeSchema,
  timeframe: TimeframeSchema,
  higherTimeframe: TimeframeSchema,
  symbol: SymbolConfigSchema,
  position: PositionSchema,
  stopLoss: StopLossSchema,
  takeProfit: TakeProfitSchema,
  atrFallback: AtrFallbackSchema,
  swingDetection: SwingDetectionSchema,
  risk: RiskSchema,
  cost: CostSchema,
  backtest: BacktestSchema,
  exchange: ExchangeSchema,
});

export type UnifiedConfig = z.infer<typeof UnifiedConfigSchema>;
