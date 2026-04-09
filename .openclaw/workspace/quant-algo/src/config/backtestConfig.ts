/** @deprecated Use unified config: import { loadConfig } from "./loader.js" */
/**
 * Backtest Risk & Execution Configuration Schema (Phase 5)
 *
 * Centralizes hardcoded risk-management and execution parameters
 * from backtest-engine.ts into a validated, type-safe config.
 *
 * Extracted values (from backtest-engine.ts):
 *   - Circuit breaker:  drawdown threshold 10%, escalating cooldown 1500/3000/4000 bars
 *   - Daily loss limit:  4%
 *   - Consecutive loss:  5 losses -> 500 bar pause
 *   - Trade cooldown:    18 bars between trades
 *   - Max holding:       1000 bars forced close
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Circuit Breaker
// ═══════════════════════════════════════════════════════════════

const CircuitBreakerSchema = z.object({
  /** Max drawdown (fraction) before circuit breaker fires */
  drawdownThreshold: z.number().min(0).max(1).default(0.10),
  /** Base cooldown bars (multiplied by trigger count for escalation) */
  baseCooldownBars: z.number().int().positive().default(1500),
  /** Absolute max cooldown bars regardless of trigger count */
  maxCooldownBars: z.number().int().positive().default(4000),
});

// ═══════════════════════════════════════════════════════════════
// Consecutive Loss Limiter
// ═══════════════════════════════════════════════════════════════

const ConsecutiveLossSchema = z.object({
  /** Number of consecutive losses before pausing */
  maxLosses: z.number().int().positive().default(5),
  /** Bars to pause after hitting consecutive loss limit */
  pauseBars: z.number().int().positive().default(500),
});

// ═══════════════════════════════════════════════════════════════
// Full Backtest Risk Config
// ═══════════════════════════════════════════════════════════════

const BacktestRiskSchema = z.object({
  circuitBreaker: CircuitBreakerSchema.default({}),

  /** Max daily loss as fraction of day-start equity (4% = 0.04) */
  dailyLossLimit: z.number().min(0).max(1).default(0.04),

  consecutiveLoss: ConsecutiveLossSchema.default({}),

  /** Bars to wait after closing a position before opening a new one */
  cooldownBars: z.number().int().nonnegative().default(18),

  /** Force-close any position held longer than this many bars */
  maxHoldingBars: z.number().int().positive().default(1000),
});

// ═══════════════════════════════════════════════════════════════
// Backtest Execution Config (non-risk parameters)
// ═══════════════════════════════════════════════════════════════

const BacktestExecutionSchema = z.object({
  /** Crypto trades 365 days/year (not 252 for equities) */
  tradingDaysPerYear: z.number().int().positive().default(365),
});

// ═══════════════════════════════════════════════════════════════
// Top-level Backtest Config
// ═══════════════════════════════════════════════════════════════

const BacktestConfigSchema = z.object({
  risk: BacktestRiskSchema.default({}),
  execution: BacktestExecutionSchema.default({}),
});

// ── Exported types ─────────────────────────────────────────────

export type BacktestRiskConfig = z.infer<typeof BacktestRiskSchema>;
export type BacktestExecutionConfig = z.infer<typeof BacktestExecutionSchema>;
export type BacktestParamsConfig = z.infer<typeof BacktestConfigSchema>;

// ── Exported schemas ───────────────────────────────────────────

export {
  CircuitBreakerSchema,
  ConsecutiveLossSchema,
  BacktestRiskSchema,
  BacktestExecutionSchema,
  BacktestConfigSchema,
};

// ── Loader ─────────────────────────────────────────────────────

/**
 * Parse and validate a backtest parameters configuration.
 * Missing fields are filled with defaults.
 */
export function loadBacktestConfig(
  overrides?: Partial<z.input<typeof BacktestConfigSchema>>,
): BacktestParamsConfig {
  return BacktestConfigSchema.parse(overrides ?? {});
}

/** Singleton default config. */
export const DEFAULT_BACKTEST_CONFIG: BacktestParamsConfig = loadBacktestConfig();
