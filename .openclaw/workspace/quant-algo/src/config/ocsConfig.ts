/**
 * OCS Configuration Schema (Phase 5)
 *
 * Centralizes all hardcoded parameters from OCS Layer 1–4 into
 * a validated, type-safe configuration object with sensible defaults.
 *
 * Usage:
 *   import { loadOCSConfig, type OCSConfig } from './config/ocsConfig';
 *   const cfg = loadOCSConfig();            // all defaults
 *   const cfg = loadOCSConfig({ layer1: { vpm: { lookback: 30 } } }); // override
 */

import { loadConfig } from './loader.js';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Layer 1: Time-Series Processing
// ═══════════════════════════════════════════════════════════════

const Layer1ConfigSchema = z.object({
  /** Volume Price Mean (VPM) */
  vpm: z.object({
    lookback: z.number().int().positive().default(20),
    bandMultiplier: z.number().positive().default(2),
  }).default({}),

  /** Ehlers Adaptive Moving Average */
  ama: z.object({
    erPeriod: z.number().int().positive().default(10),
    fastLength: z.number().int().positive().default(2),
    slowLength: z.number().int().positive().default(30),
    trendThreshold: z.number().positive().default(0.001),
  }).default({}),

  /** Supertrend */
  supertrend: z.object({
    period: z.number().int().positive().default(10),
    multiplier: z.number().positive().default(3),
  }).default({}),

  /** Stochastic Oscillator */
  stochastics: z.object({
    kPeriod: z.number().int().positive().default(14),
    dPeriod: z.number().int().positive().default(3),
    oversoldThreshold: z.number().default(20),
    overboughtThreshold: z.number().default(80),
  }).default({}),

  /** ATR (used across layers) */
  atr: z.object({
    period: z.number().int().positive().default(14),
  }).default({}),

  /** Gaussian Structure (v312) */
  gaussian: z.object({
    sigma: z.number().positive().default(2.0),
    windowSize: z.number().int().positive().default(20),
  }).default({}),
});

// ═══════════════════════════════════════════════════════════════
// Layer 2: Signal Processing
// ═══════════════════════════════════════════════════════════════

const Layer2ConfigSchema = z.object({
  /** Ehlers Cycle Detection — three timeframe ranges */
  ehlersCycle: z.object({
    short: z.object({
      minPeriod: z.number().int().positive().default(5),
      maxPeriod: z.number().int().positive().default(15),
    }).default({}),
    medium: z.object({
      minPeriod: z.number().int().positive().default(15),
      maxPeriod: z.number().int().positive().default(40),
    }).default({}),
    long: z.object({
      minPeriod: z.number().int().positive().default(40),
      maxPeriod: z.number().int().positive().default(100),
    }).default({}),
    /** Threshold for state change detection (expansion/contraction) */
    stateChangeThreshold: z.number().positive().default(0.1),
  }).default({}),

  /** LMS Adaptive Filter */
  lms: z.object({
    learningRate: z.number().positive().default(0.01),
    initialWeights: z.array(z.number()).default([0.25, 0.25, 0.25, 0.25]),
    epsilon: z.number().positive().default(0.001),
  }).default({}),

  /** Z-Score Confidence Filter */
  zScore: z.object({
    windowSize: z.number().int().positive().default(100),
    minSamples: z.number().int().positive().default(20),
    percentile: z.number().min(0).max(1).default(0.85),
    defaultThreshold: z.number().positive().default(1.5),
    confidenceScale: z.number().positive().default(86),
  }).default({}),

  /** v312 Enhanced Components */
  v312: z.object({
    gaussian: z.object({
      sigma: z.number().positive().default(2.0),
      windowSize: z.number().int().positive().default(20),
    }).default({}),
    cvd: z.object({
      lookbackPeriod: z.number().int().positive().default(20),
      minStrength: z.number().positive().default(60),
    }).default({}),
    trix: z.object({
      period: z.number().int().positive().default(14),
      signalPeriod: z.number().int().positive().default(9),
    }).default({}),
    derivative: z.object({
      velocityPeriod: z.number().positive().default(10),
      accelerationPeriod: z.number().positive().default(0.001),
    }).default({}),
    elasticVolume: z.object({
      lookbackPeriod: z.number().int().positive().default(20),
    }).default({}),
  }).default({}),
});

// ═══════════════════════════════════════════════════════════════
// Layer 3: Machine Learning (KNN)
// ═══════════════════════════════════════════════════════════════

const Layer3ConfigSchema = z.object({
  /** KNN classifier */
  knn: z.object({
    defaultK: z.number().int().positive().default(5),
    maxHistory: z.number().int().positive().default(1000),
    /** Temporal embargo: recent bars excluded from neighbor search */
    embargoBars: z.number().int().nonnegative().default(5),
    /** Lookback for fallback label computation */
    labelLookback: z.number().int().positive().default(5),
    /** Confidence threshold for signal emission (%) */
    signalThreshold: z.number().min(0).max(100).default(50),
    /** Label threshold for buy/sell classification */
    labelThreshold: z.number().positive().default(0.005),
  }).default({}),

  /** Adaptive K based on volatility */
  adaptiveK: z.object({
    highVolatilityThreshold: z.number().positive().default(0.03),
    lowVolatilityThreshold: z.number().positive().default(0.01),
    highVolK: z.number().int().positive().default(3),
    lowVolK: z.number().int().positive().default(7),
    normalK: z.number().int().positive().default(5),
  }).default({}),

  /** Triple barrier labeling (used in initializeFromHistory) */
  tripleBarrier: z.object({
    ptSl: z.tuple([z.number(), z.number()]).default([2, 1]),
    maxHoldingPeriod: z.number().int().positive().default(20),
    volLookback: z.number().int().positive().default(20),
    minVolatility: z.number().positive().default(0.001),
  }).default({}),
});

// ═══════════════════════════════════════════════════════════════
// Layer 4: Virtual Trade Simulation
// ═══════════════════════════════════════════════════════════════

// Align Layer4 defaults with unified config
const _unified = loadConfig('live');
const _tpLevels = _unified.takeProfit.levels;

const Layer4ConfigSchema = z.object({
  /** Stop loss ATR multiplier */
  stopLoss: z.object({
    atrMultiplier: z.number().positive().default(_unified.stopLoss.atrMultiplier),
  }).default({}),

  /** Take-profit pyramid (R:R multiples of stop distance) */
  takeProfit: z.object({
    tp1RR: z.number().positive().default(_tpLevels[0]?.rrRatio ?? 1.2),
    tp2RR: z.number().positive().default(_tpLevels[1]?.rrRatio ?? 1.8),
    tp3RR: z.number().positive().default(_tpLevels[2]?.rrRatio ?? 2.5),
    /** Percentage of position closed at each TP level */
    tp1ClosePercent: z.number().min(0).max(1).default(_tpLevels[0]?.closePercent ?? 0.50),
    tp2ClosePercent: z.number().min(0).max(1).default(_tpLevels[1]?.closePercent ?? 0.50),
    // tp3 closes remaining (implicitly 0.25)
  }).default({}),

  /** Position sizing: risk percentage of balance */
  positionSizing: z.object({
    riskPercent: z.number().min(0).max(1).default(_unified.position.riskPerTrade),
  }).default({}),
});

// ═══════════════════════════════════════════════════════════════
// Top-level OCS Config
// ═══════════════════════════════════════════════════════════════

const OCSConfigSchema = z.object({
  layer1: Layer1ConfigSchema.default({}),
  layer2: Layer2ConfigSchema.default({}),
  layer3: Layer3ConfigSchema.default({}),
  layer4: Layer4ConfigSchema.default({}),
});

// ── Exported types ─────────────────────────────────────────────

export type Layer1Config = z.infer<typeof Layer1ConfigSchema>;
export type Layer2Config = z.infer<typeof Layer2ConfigSchema>;
export type Layer3Config = z.infer<typeof Layer3ConfigSchema>;
export type Layer4Config = z.infer<typeof Layer4ConfigSchema>;
type OCSConfig = z.infer<typeof OCSConfigSchema>;

// ── Exported schemas (for external validation / composition) ───

export {
  Layer1ConfigSchema,
  Layer2ConfigSchema,
  Layer3ConfigSchema,
  Layer4ConfigSchema,
  OCSConfigSchema,
};

// ── Loader ─────────────────────────────────────────────────────

/**
 * Parse and validate an OCS configuration object.
 * Missing fields are filled with defaults.
 *
 * @param overrides  Partial config (e.g. loaded from JSON)
 * @returns  Fully resolved, validated OCSConfig
 */
function loadOCSConfig(overrides?: Partial<z.input<typeof OCSConfigSchema>>): OCSConfig {
  return OCSConfigSchema.parse(overrides ?? {});
}

/** Singleton default config (all defaults, zero overrides). */
export const DEFAULT_OCS_CONFIG: OCSConfig = loadOCSConfig();
