/**
 * Mode-Specific Overlays
 *
 * Each overlay is a DeepPartial of UnifiedConfig that gets merged
 * on top of BASE_DEFAULTS when loading config for a specific mode.
 *
 * Priority chain: env vars > mode overlay > BASE_DEFAULTS > Zod defaults
 */

import type { z } from 'zod';
import type { UnifiedConfigSchema } from './schema.js';

/** Deep partial type for overlay objects */
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

export type ConfigOverlay = DeepPartial<z.input<typeof UnifiedConfigSchema>>;

// ═══════════════════════════════════════════════════════════════
// Backtest Overlay
// ═══════════════════════════════════════════════════════════════

/**
 * Backtest mode: no leverage, conservative sizing, tighter costs.
 * These values match the current backtest-runner.ts / backtest-engine.ts
 * hardcoded values exactly to ensure identical results.
 */
export const BACKTEST_OVERLAY: ConfigOverlay = {
  mode: 'backtest',

  position: {
    leverage: 1,
    baseSize: 0.010,
    maxSize: 0.50,
    riskPerTrade: 0.02,
  },

  cost: {
    feeRate: 0.0004,
    makerRebate: -0.0002,
    slippageBps: 1,
  },

  backtest: {
    initialBalance: 10000,
    tradingDaysPerYear: 365,
    // ★ 回测时间范围 — 修改这里即可 ★
    // 默认: 最近 365 天。也可通过环境变量 BT_START_DATE / BT_END_DATE 临时覆盖
    startDate: (() => {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - 365);
      return d.toISOString().split('T')[0]!;
    })(),
    endDate: new Date().toISOString().split('T')[0]!,
  },
};

// ═══════════════════════════════════════════════════════════════
// Paper Trading Overlay
// ═══════════════════════════════════════════════════════════════

/**
 * Paper mode: moderate leverage for realistic simulation,
 * same costs as live to avoid false confidence.
 */
export const PAPER_OVERLAY: ConfigOverlay = {
  mode: 'paper',

  position: {
    leverage: 10,
    maxSize: 0.10,
  },

  exchange: {
    sandbox: true,
  },
};

// ═══════════════════════════════════════════════════════════════
// Live Trading Overlay
// ═══════════════════════════════════════════════════════════════

/**
 * Live mode: production leverage from env, tighter risk limits.
 * Most values come from BASE_DEFAULTS which are already tuned for live.
 */
export const LIVE_OVERLAY: ConfigOverlay = {
  mode: 'live',

  position: {
    leverage: 50,
    maxSize: 0.08,
  },
};

// ═══════════════════════════════════════════════════════════════
// Overlay Registry
// ═══════════════════════════════════════════════════════════════

export const MODE_OVERLAYS: Record<string, ConfigOverlay> = {
  backtest: BACKTEST_OVERLAY,
  paper: PAPER_OVERLAY,
  live: LIVE_OVERLAY,
};
