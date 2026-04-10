/**
 * Unified Trading Configuration Schema
 *
 * Single source of truth for ALL trading parameters across live, paper, and backtest modes.
 * Uses Zod for runtime validation + static type inference.
 *
 * Design principles:
 *   1. Every parameter lives in exactly ONE place
 *   2. Zod defaults = production-ready base values
 *   3. Mode overlays (backtest/paper/live) apply on top
 *   4. Environment variables override everything
 *   5. Frozen output — no accidental mutation
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════

export const TradingModeSchema = z.enum(['live', 'paper', 'backtest']);
export type TradingMode = z.infer<typeof TradingModeSchema>;

export const TimeframeSchema = z.enum(['1m', '5m', '15m', '1h', '4h', '1d']);
export type Timeframe = z.infer<typeof TimeframeSchema>;

// ═══════════════════════════════════════════════════════════════
// Symbol
// ═══════════════════════════════════════════════════════════════

export const SymbolConfigSchema = z.object({
  /** ccxt-format symbol, e.g. 'ETH/USDT:USDT' */
  ccxt: z.string().default('ETH/USDT:USDT'),
  /** Binance-format symbol, e.g. 'ETHUSDT' */
  binance: z.string().default('ETHUSDT'),
  /** Price decimal places */
  pricePrecision: z.number().int().nonnegative().default(2),
  /** Quantity decimal places */
  quantityPrecision: z.number().int().nonnegative().default(3),
});
export type SymbolConfig = z.infer<typeof SymbolConfigSchema>;

// ═══════════════════════════════════════════════════════════════
// Position Sizing
// ═══════════════════════════════════════════════════════════════

export const PositionSchema = z.object({
  /** Leverage multiplier */
  leverage: z.number().int().min(1).max(125).default(50),
  /** Max position size as fraction of equity */
  maxSize: z.number().min(0).max(1).default(0.10),
  /** Risk per trade as fraction of equity */
  riskPerTrade: z.number().min(0).max(1).default(0.02),
  /** Position size in base currency (for backtest) */
  baseSize: z.number().positive().default(0.01),
});
export type PositionConfig = z.infer<typeof PositionSchema>;

// ═══════════════════════════════════════════════════════════════
// Take Profit Level
// ═══════════════════════════════════════════════════════════════

export const TakeProfitLevelSchema = z.object({
  /** Risk-reward ratio for this TP level */
  rrRatio: z.number().positive(),
  /** Fraction of position to close at this level (0-1) */
  closePercent: z.number().min(0).max(1),
});

// ═══════════════════════════════════════════════════════════════
// Stop Loss
// ═══════════════════════════════════════════════════════════════

export const StopLossSchema = z.object({
  /** ATR multiplier for stop distance */
  atrMultiplier: z.number().positive().default(1.5),
  /** Swing-point buffer (fraction, e.g. 0.002 = 0.2%) */
  swingBuffer: z.number().min(0).default(0.002),
  /** Minimum stop distance per timeframe (fraction) */
  minStopPercent: z.record(TimeframeSchema, z.number().min(0)).default({
    '1m': 0.003,
    '5m': 0.005,
    '15m': 0.008,
    '1h': 0.01,
    '4h': 0.015,
    '1d': 0.02,
  }),
});
export type StopLossConfig = z.infer<typeof StopLossSchema>;

// ═══════════════════════════════════════════════════════════════
// Take Profit
// ═══════════════════════════════════════════════════════════════

export const TakeProfitSchema = z.object({
  /** Ordered TP levels - evaluated sequentially */
  levels: z.array(TakeProfitLevelSchema).default([
    { rrRatio: 1.2, closePercent: 0.50 },
    { rrRatio: 1.8, closePercent: 0.50 },
    { rrRatio: 2.5, closePercent: 1.00 },
  ]),
});
export type TakeProfitConfig = z.infer<typeof TakeProfitSchema>;

// ═══════════════════════════════════════════════════════════════
// ATR Fallback (used when swing levels unavailable)
// ═══════════════════════════════════════════════════════════════

export const AtrFallbackSchema = z.object({
  /** ATR multiplier for stop loss */
  slMultiplier: z.number().positive().default(2.0),
  /** ATR multipliers for each TP level */
  tpMultipliers: z.array(z.number().positive()).default([2.4, 3.6, 5.0]),
});
export type AtrFallbackConfig = z.infer<typeof AtrFallbackSchema>;

// ═══════════════════════════════════════════════════════════════
// Swing Detection (per-timeframe)
// ═══════════════════════════════════════════════════════════════

export const SwingDetectionEntrySchema = z.object({
  lookback: z.number().int().positive(),
  strength: z.number().int().positive(),
  minStopPercent: z.number().min(0),
});

export const SwingDetectionSchema = z.record(
  TimeframeSchema,
  SwingDetectionEntrySchema,
).default({
  '1m': { lookback: 60, strength: 5, minStopPercent: 0.003 },
  '5m': { lookback: 48, strength: 3, minStopPercent: 0.005 },
  '15m': { lookback: 32, strength: 3, minStopPercent: 0.008 },
  '1h': { lookback: 24, strength: 2, minStopPercent: 0.01 },
  '4h': { lookback: 30, strength: 2, minStopPercent: 0.015 },
  '1d': { lookback: 20, strength: 2, minStopPercent: 0.02 },
});
export type SwingDetectionConfig = z.infer<typeof SwingDetectionSchema>;

// ═══════════════════════════════════════════════════════════════
// Risk Management
// ═══════════════════════════════════════════════════════════════

export const RiskSchema = z.object({
  /** Max daily loss as fraction of equity */
  maxDailyLoss: z.number().min(0).max(1).default(0.04),
  /** Max daily trades */
  maxDailyTrades: z.number().int().positive().default(50),
  /** Max drawdown before circuit breaker */
  maxDrawdown: z.number().min(0).max(1).default(0.10),
  /** Cooldown bars between trades (backtest) */
  cooldownBars: z.number().int().nonnegative().default(18),
  /** Max consecutive losses before pausing */
  maxConsecutiveLosses: z.number().int().positive().default(5),
  /** Pause bars after hitting consecutive loss limit */
  consecutiveLossPauseBars: z.number().int().nonnegative().default(500),
  /** Max holding bars before force-close */
  maxHoldingBars: z.number().int().positive().default(1000),
  /** Circuit breaker base cooldown bars */
  circuitBreakerCooldownBars: z.number().int().positive().default(1500),
  /** Circuit breaker max cooldown bars */
  circuitBreakerMaxCooldownBars: z.number().int().positive().default(4000),
});
export type RiskConfig = z.infer<typeof RiskSchema>;

// ═══════════════════════════════════════════════════════════════
// Trading Costs
// ═══════════════════════════════════════════════════════════════

export const CostSchema = z.object({
  /** Taker fee rate (e.g. 0.0004 = 4 bps) */
  feeRate: z.number().min(0).default(0.0004),
  /** Maker rebate (negative = rebate, e.g. -0.0002) */
  makerRebate: z.number().default(-0.0002),
  /** Estimated slippage in basis points */
  slippageBps: z.number().min(0).default(3),
});
export type CostConfig = z.infer<typeof CostSchema>;

// ═══════════════════════════════════════════════════════════════
// Backtest-specific
// ═══════════════════════════════════════════════════════════════

export const BacktestSchema = z.object({
  /** Initial balance in quote currency */
  initialBalance: z.number().positive().default(10000),
  /** Trading days per year (crypto = 365, used for annualized return calc) */
  tradingDaysPerYear: z.number().int().positive().default(365),
  /** Start date (ISO 8601 date string, e.g. '2026-04-03') */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date YYYY-MM-DD'),
  /** End date (ISO 8601 date string, e.g. '2026-04-10') */
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date YYYY-MM-DD'),
});
export type BacktestSpecConfig = z.infer<typeof BacktestSchema>;

// ═══════════════════════════════════════════════════════════════
// Exchange Connectivity
// ═══════════════════════════════════════════════════════════════

export const ExchangeSchema = z.object({
  id: z.string().default('binance'),
  sandbox: z.boolean().default(false),
  enableRateLimit: z.boolean().default(true),
});
export type ExchangeConfig = z.infer<typeof ExchangeSchema>;

// ═══════════════════════════════════════════════════════════════
// Top-Level Unified Config
// ═══════════════════════════════════════════════════════════════

export const UnifiedConfigSchema = z.object({
  /** Trading mode */
  mode: TradingModeSchema.default('live'),
  /** Primary timeframe */
  timeframe: TimeframeSchema.default('5m'),
  /** Higher timeframe for multi-TF analysis */
  higherTimeframe: TimeframeSchema.default('1h'),
  /** Symbol configuration */
  symbol: SymbolConfigSchema.default({}),
  /** Position sizing */
  position: PositionSchema.default({}),
  /** Stop loss parameters */
  stopLoss: StopLossSchema.default({}),
  /** Take profit parameters */
  takeProfit: TakeProfitSchema.default({}),
  /** ATR fallback for SL/TP when swing levels unavailable */
  atrFallback: AtrFallbackSchema.default({}),
  /** Swing detection per-timeframe config */
  swingDetection: SwingDetectionSchema.default({}),
  /** Risk management */
  risk: RiskSchema.default({}),
  /** Trading costs */
  cost: CostSchema.default({}),
  /** Backtest-specific settings */
  backtest: BacktestSchema.default(() => {
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 7);
    return {
      initialBalance: 10000,
      tradingDaysPerYear: 365,
      startDate: start.toISOString().split('T')[0]!,
      endDate: end.toISOString().split('T')[0]!,
    };
  }),
  /** Exchange connectivity */
  exchange: ExchangeSchema.default({}),
});

export type UnifiedConfig = z.infer<typeof UnifiedConfigSchema>;
