/**
 * Unified Config Loader
 *
 * Single entry point: loadConfig(mode) -> frozen UnifiedConfig
 *
 * Merge priority (highest wins):
 *   1. Environment variables (LEVERAGE, SYMBOL, TIMEFRAME, etc.)
 *   2. Mode overlay (backtest/paper/live)
 *   3. BASE_DEFAULTS
 *   4. Zod schema defaults (fallback)
 *
 * The returned object is deeply frozen — consumers cannot mutate it.
 */

import { UnifiedConfigSchema, type TradingMode, type UnifiedConfig } from './schema.js';
import { BASE_DEFAULTS } from './defaults.js';
import { MODE_OVERLAYS, type ConfigOverlay } from './overlays.js';

// ═══════════════════════════════════════════════════════════════
// Deep Merge Utility
// ═══════════════════════════════════════════════════════════════

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge source into target (immutable — returns new object).
 * Arrays are replaced, not concatenated.
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Record<string, unknown> | undefined>
): T {
  const result: Record<string, unknown> = { ...target };
  for (const source of sources) {
    if (!source) continue;
    for (const key of Object.keys(source)) {
      const sv = source[key];
      const tv = result[key];
      if (isPlainObject(sv) && isPlainObject(tv)) {
        result[key] = deepMerge(tv, sv);
      } else if (sv !== undefined) {
        result[key] = sv;
      }
    }
  }
  return result as T;
}

// ═══════════════════════════════════════════════════════════════
// Deep Freeze Utility
// ═══════════════════════════════════════════════════════════════

function deepFreeze<T>(obj: T): Readonly<T> {
  if (typeof obj !== 'object' || obj === null) return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

// ═══════════════════════════════════════════════════════════════
// Environment Variable Reader
// ═══════════════════════════════════════════════════════════════

/**
 * Read environment variables and build a partial config overlay.
 * Only set fields that have corresponding env vars defined.
 */
function readEnvOverrides(): ConfigOverlay {
  const env = process.env;
  const overlay: ConfigOverlay = {};

  // Symbol
  if (env['SYMBOL']) {
    overlay.symbol = { ccxt: env['SYMBOL'] };
  }
  if (env['BT_SYMBOL']) {
    overlay.symbol = {
      ...overlay.symbol,
      binance: env['BT_SYMBOL'],
    };
  }

  // Timeframe
  if (env['TIMEFRAME']) {
    overlay.timeframe = env['TIMEFRAME'] as '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  }
  if (env['BT_TIMEFRAME']) {
    overlay.timeframe = env['BT_TIMEFRAME'] as '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  }

  // Leverage
  if (env['LEVERAGE']) {
    const lev = parseInt(env['LEVERAGE'], 10);
    if (!Number.isNaN(lev) && lev >= 1) {
      overlay.position = { ...overlay.position, leverage: lev };
    }
  }

  // Backtest days
  if (env['BT_DAYS']) {
    const days = parseInt(env['BT_DAYS'], 10);
    if (!Number.isNaN(days) && days > 0) {
      overlay.backtest = { ...overlay.backtest, days };
    }
  }

  // Exchange
  if (env['EXCHANGE_SANDBOX'] === 'true') {
    overlay.exchange = { sandbox: true };
  }

  return overlay;
}

// ═══════════════════════════════════════════════════════════════
// Config Cache
// ═══════════════════════════════════════════════════════════════

const configCache = new Map<TradingMode, UnifiedConfig>();

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

/**
 * Load and validate the unified trading configuration for a given mode.
 *
 * @param mode - 'live' | 'paper' | 'backtest'
 * @param overrides - Optional programmatic overrides (highest priority after env)
 * @returns Deeply frozen, fully validated UnifiedConfig
 * @throws ZodError if merged config fails validation
 *
 * @example
 *   const cfg = loadConfig('backtest');
 *   console.log(cfg.position.leverage);    // 1
 *   console.log(cfg.takeProfit.levels[0]); // { rrRatio: 1.2, closePercent: 0.50 }
 */
export function loadConfig(
  mode: TradingMode = 'live',
  overrides?: ConfigOverlay,
): UnifiedConfig {
  // Check cache (only if no overrides)
  if (!overrides) {
    const cached = configCache.get(mode);
    if (cached) return cached;
  }

  // Layer 1: BASE_DEFAULTS
  let merged = { ...BASE_DEFAULTS } as Record<string, unknown>;

  // Layer 2: Mode overlay
  const modeOverlay = MODE_OVERLAYS[mode];
  if (modeOverlay) {
    merged = deepMerge(merged, modeOverlay as Record<string, unknown>);
  }

  // Layer 3: Environment variables
  const envOverlay = readEnvOverrides();
  merged = deepMerge(merged, envOverlay as Record<string, unknown>);

  // Layer 4: Programmatic overrides
  if (overrides) {
    merged = deepMerge(merged, overrides as Record<string, unknown>);
  }

  // Ensure mode is set correctly
  merged['mode'] = mode;

  // Validate through Zod
  const config = UnifiedConfigSchema.parse(merged);

  // Freeze to prevent mutation
  const frozen = deepFreeze(config);

  // Cache if no overrides
  if (!overrides) {
    configCache.set(mode, frozen);
  }

  return frozen;
}

/**
 * Clear the config cache. Useful for testing or when env vars change.
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Print a human-readable summary of the config to console.
 * Useful for startup verification.
 */
export function printConfigSummary(config: UnifiedConfig): void {
  const tpDesc = config.takeProfit.levels
    .map((l, i) => `TP${i + 1}: ${l.rrRatio}R @ ${(l.closePercent * 100).toFixed(0)}%`)
    .join(', ');

  console.log('═══════════════════════════════════════════════');
  console.log('  Unified Trading Config');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Mode:       ${config.mode}`);
  console.log(`  Symbol:     ${config.symbol.ccxt} (${config.symbol.binance})`);
  console.log(`  Timeframe:  ${config.timeframe} / ${config.higherTimeframe}`);
  console.log(`  Leverage:   ${config.position.leverage}x`);
  console.log(`  Max Size:   ${(config.position.maxSize * 100).toFixed(1)}%`);
  console.log(`  Risk/Trade: ${(config.position.riskPerTrade * 100).toFixed(1)}%`);
  console.log(`  SL ATR:     ${config.stopLoss.atrMultiplier}x`);
  console.log(`  TP Levels:  ${tpDesc}`);
  console.log(`  Fee:        ${(config.cost.feeRate * 10000).toFixed(1)} bps`);
  console.log(`  Slippage:   ${config.cost.slippageBps} bps`);
  if (config.mode === 'backtest') {
    console.log(`  Balance:    $${config.backtest.initialBalance.toLocaleString()}`);
    console.log(`  Days:       ${config.backtest.days}`);
  }
  console.log('═══════════════════════════════════════════════');
}
