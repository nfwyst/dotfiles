/**
 * Base Defaults for Unified Trading Config
 *
 * These are the production-ready base values that apply to ALL modes.
 * Mode-specific overrides are in overlays.ts.
 *
 * Values here match the current production behavior exactly:
 *   - SLTPCalculator R:R ratios: 1.2 / 1.8 / 2.5
 *   - Partial close: 50% / 50% / 100%
 *   - ATR fallback: 2x SL, 2.4/3.6/5.0x TP
 *   - Fee: 4 bps taker, -2 bps maker rebate
 *   - Default leverage: 50x (live), overridden per mode
 */

import type { z } from 'zod';
import type { UnifiedConfigSchema } from './schema.js';

/**
 * Base defaults — these are the "ground truth" values.
 * Zod schema defaults mirror these exactly; this object exists
 * so overlays.ts and loader.ts can deep-merge on a concrete object
 * rather than relying solely on Zod .default() chains.
 */
export const BASE_DEFAULTS: z.input<typeof UnifiedConfigSchema> = {
  mode: 'live',
  timeframe: '5m',
  higherTimeframe: '1h',

  symbol: {
    ccxt: 'ETH/USDT:USDT',
    binance: 'ETHUSDT',
    pricePrecision: 2,
    quantityPrecision: 3,
  },

  position: {
    leverage: 50,
    maxSize: 0.10,
    riskPerTrade: 0.02,
    baseSize: 0.01,
  },

  stopLoss: {
    atrMultiplier: 1.5,
    swingBuffer: 0.002,
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

  cost: {
    feeRate: 0.0004,
    makerRebate: -0.0002,
    slippageBps: 3,
  },

  backtest: {
    initialBalance: 10000,
    tradingDaysPerYear: 365,
    startDate: (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 7);
      return d.toISOString().split('T')[0]!;
    })(),
    endDate: new Date().toISOString().split('T')[0]!,
  },

  exchange: {
    id: 'binance',
    sandbox: false,
    enableRateLimit: true,
  },
};
