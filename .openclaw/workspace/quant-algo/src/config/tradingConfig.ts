/**
 * Unified Trading Configuration
 *
 * ★ SINGLE FILE for all config values, mode overrides, and loading logic. ★
 *
 * To change any parameter:
 *   1. Find the mode section below (BACKTEST / PAPER / LIVE)
 *   2. Edit the value directly
 *   3. Done — no other files to touch
 *
 * Priority chain (highest wins):
 *   1. Environment variables (BT_START_DATE, LEVERAGE, etc.)
 *   2. Mode config (BACKTEST_CONFIG / PAPER_CONFIG / LIVE_CONFIG)
 *   3. SHARED_DEFAULTS (common base for all modes)
 *
 * Public API:
 *   loadConfig(mode)        → frozen, validated UnifiedConfig
 *   clearConfigCache()      → reset cache (for tests)
 *   printConfigSummary(cfg) → human-readable console output
 */

import { UnifiedConfigSchema, type TradingMode, type UnifiedConfig } from './schema.js';

// ═══════════════════════════════════════════════════════════════
//  SHARED DEFAULTS — common base values for all modes
// ═══════════════════════════════════════════════════════════════

const SHARED_DEFAULTS = {
  timeframe: '5m' as const,
  higherTimeframe: '1h' as const,

  symbol: {
    ccxt: 'ETH/USDT:USDT',
    binance: 'ETHUSDT',
    pricePrecision: 2,
    quantityPrecision: 3,
  },

  stopLoss: {
    atrMultiplier: 1.5,
    swingBuffer: 0.002,
    maxStopPercent: 0.025,  // 1.5% max SL distance — prevents oversized risk on 5m
    minStopPercent: {
      '1m': 0.003,
      '5m': 0.005,
      '15m': 0.008,
      '1h': 0.01,
      '4h': 0.015,
      '1d': 0.02,
    },
  },

  takeProfit: {
    levels: [
      { rrRatio: 1.2, closePercent: 0.50 },
      { rrRatio: 1.8, closePercent: 0.50 },
      { rrRatio: 2.5, closePercent: 1.00 },
    ],
  },

  atrFallback: {
    slMultiplier: 2.0,
    tpMultipliers: [2.4, 3.6, 5.0],
  },

  swingDetection: {
    '1m': { lookback: 60, strength: 5, minStopPercent: 0.003 },
    '5m': { lookback: 48, strength: 3, minStopPercent: 0.005 },
    '15m': { lookback: 32, strength: 3, minStopPercent: 0.008 },
    '1h': { lookback: 24, strength: 2, minStopPercent: 0.01 },
    '4h': { lookback: 30, strength: 2, minStopPercent: 0.015 },
    '1d': { lookback: 20, strength: 2, minStopPercent: 0.02 },
  },

  risk: {
    maxDailyLoss: 0.04,
    maxDailyTrades: 50,
    maxDrawdown: 0.10,
    cooldownBars: 18,
    maxConsecutiveLosses: 5,
    consecutiveLossPauseBars: 500,
    maxHoldingBars: 1000,
    circuitBreakerCooldownBars: 1500,
    circuitBreakerMaxCooldownBars: 4000,
  },

  exchange: {
    id: 'binance',
    sandbox: false,
    enableRateLimit: true,
  },
} as const;

// ═══════════════════════════════════════════════════════════════
//  BACKTEST CONFIG — edit here for backtest parameters
// ═══════════════════════════════════════════════════════════════

/** Helper: compute ISO date string N days ago from today */
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0]!;
}

function today(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Convert a duration in hours to bar count for a given timeframe.
 * Example: barsForHours(24, '5m') → 288 bars (one day on 5m)
 */
function barsForHours(hours: number, tf: string): number {
  const tfMinutes: Record<string, number> = {
    '1m': 1, '3m': 3, '5m': 5, '15m': 15, '30m': 30,
    '1h': 60, '2h': 120, '4h': 240, '1d': 1440,
  };
  const mins = tfMinutes[tf] ?? 5;
  return Math.round((hours * 60) / mins);
}

const BACKTEST_CONFIG = {
  mode: 'backtest' as const,
  ...SHARED_DEFAULTS,

  position: {
    leverage: 1,
    baseSize: 0.010,
    maxSize: 0.45,
    riskPerTrade: 0.02,
  },

  cost: {
    feeRate: 0.0004,       // 4 bps taker
    makerRebate: -0.0002,  // -2 bps maker rebate
    slippageBps: 1,        // 1 bps slippage
  },

  backtest: {
    initialBalance: 10000,
    tradingDaysPerYear: 365,
    // ★ 回测时间范围 — 修改这里 ★
    startDate: daysAgo(365),
    endDate: today(),
  },
};

// ═══════════════════════════════════════════════════════════════
//  PAPER CONFIG — edit here for paper trading parameters
// ═══════════════════════════════════════════════════════════════

const PAPER_CONFIG = {
  mode: 'paper' as const,
  ...SHARED_DEFAULTS,

  position: {
    leverage: 10,
    maxSize: 0.10,
    riskPerTrade: 0.02,
    baseSize: 0.01,
  },

  cost: {
    feeRate: 0.0004,
    makerRebate: -0.0002,
    slippageBps: 3,
  },

  backtest: {
    initialBalance: 10000,
    tradingDaysPerYear: 365,
    startDate: today(),
    endDate: today(),
  },

  exchange: {
    ...SHARED_DEFAULTS.exchange,
    sandbox: true,
  },
};

// ═══════════════════════════════════════════════════════════════
//  LIVE CONFIG — edit here for live trading parameters
// ═══════════════════════════════════════════════════════════════

const LIVE_CONFIG = {
  mode: 'live' as const,
  ...SHARED_DEFAULTS,

  position: {
    leverage: 50,
    maxSize: 0.08,
    riskPerTrade: 0.02,
    baseSize: 0.01,
  },

  cost: {
    feeRate: 0.0004,
    makerRebate: -0.0002,
    slippageBps: 3,
  },

  backtest: {
    initialBalance: 10000,
    tradingDaysPerYear: 365,
    startDate: today(),
    endDate: today(),
  },
};

// ═══════════════════════════════════════════════════════════════
//  Mode Registry
// ═══════════════════════════════════════════════════════════════

const MODE_CONFIGS: Record<TradingMode, Record<string, unknown>> = {
  backtest: BACKTEST_CONFIG as unknown as Record<string, unknown>,
  paper: PAPER_CONFIG as unknown as Record<string, unknown>,
  live: LIVE_CONFIG as unknown as Record<string, unknown>,
};

// ═══════════════════════════════════════════════════════════════
//  Environment Variable Overrides
// ═══════════════════════════════════════════════════════════════

/** Deep partial type for override objects */
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

export type ConfigOverlay = DeepPartial<UnifiedConfig>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

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

/**
 * Read environment variables and build a partial config overlay.
 * Only set fields that have corresponding env vars defined.
 */
function readEnvOverrides(): Record<string, unknown> {
  const env = process.env;
  const overlay: Record<string, unknown> = {};

  // Symbol
  if (env['SYMBOL']) {
    overlay['symbol'] = { ccxt: env['SYMBOL'] };
  }
  if (env['BT_SYMBOL']) {
    overlay['symbol'] = {
      ...(overlay['symbol'] as Record<string, unknown> | undefined),
      binance: env['BT_SYMBOL'],
    };
  }

  // Timeframe
  if (env['TIMEFRAME']) overlay['timeframe'] = env['TIMEFRAME'];
  if (env['BT_TIMEFRAME']) overlay['timeframe'] = env['BT_TIMEFRAME'];

  // Leverage
  if (env['LEVERAGE']) {
    const lev = parseInt(env['LEVERAGE'], 10);
    if (!Number.isNaN(lev) && lev >= 1) {
      overlay['position'] = { leverage: lev };
    }
  }

  // Backtest date range
  const btOverlay: Record<string, unknown> = {};
  if (env['BT_START_DATE']) btOverlay['startDate'] = env['BT_START_DATE'];
  if (env['BT_END_DATE']) btOverlay['endDate'] = env['BT_END_DATE'];
  if (Object.keys(btOverlay).length > 0) overlay['backtest'] = btOverlay;

  // Exchange
  if (env['EXCHANGE_SANDBOX'] === 'true') {
    overlay['exchange'] = { sandbox: true };
  }

  return overlay;
}

// ═══════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════

const configCache = new Map<TradingMode, UnifiedConfig>();

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
 *   console.log(cfg.backtest.startDate);   // '2025-04-10'
 */
export function loadConfig(
  mode: TradingMode = 'live',
  overrides?: ConfigOverlay,
): UnifiedConfig {
  if (!overrides) {
    const cached = configCache.get(mode);
    if (cached) return cached;
  }

  // Start from the full mode config
  let merged = { ...MODE_CONFIGS[mode] } as Record<string, unknown>;

  // Apply env overrides
  const envOverlay = readEnvOverrides();
  merged = deepMerge(merged, envOverlay);

  // Apply programmatic overrides
  if (overrides) {
    merged = deepMerge(merged, overrides as Record<string, unknown>);
  }

  // Ensure mode is correct
  merged['mode'] = mode;

  // Auto-fix: when startDate == endDate, treat as "that entire day" → endDate + 1 day
  const bt = merged['backtest'] as Record<string, unknown> | undefined;
  if (bt && typeof bt['startDate'] === 'string' && typeof bt['endDate'] === 'string') {
    if (bt['startDate'] === bt['endDate']) {
      const d = new Date(bt['endDate'] as string);
      d.setUTCDate(d.getUTCDate() + 1);
      bt['endDate'] = d.toISOString().split('T')[0]!;
    }
  }

  // Validate through Zod
  const config = UnifiedConfigSchema.parse(merged);
  const frozen = deepFreeze(config);

  if (!overrides) configCache.set(mode, frozen);
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
    console.log(`  Range:      ${config.backtest.startDate} → ${config.backtest.endDate}`);
  }
  console.log('═══════════════════════════════════════════════');
}
