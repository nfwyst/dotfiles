import type { TradingBotConfig } from '../execution/tradingBot';
/**
 * Runtime type-guard utilities used across the codebase.
 *
 * Every guard is a pure predicate – no side-effects, no mutations.
 */

// ───────────────────────────── Generic helpers ─────────────────────────────

/** Narrows unknown to Record<string, unknown> after an isNonNullObject check. */
function asRecord(v: unknown): Record<string, unknown> {
  return v as Record<string, unknown>;
}

/** Returns `true` when `v` is a non-null `object` (not an array). */
export function isNonNullObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ──────────────────── LLM response guards (agents) ────────────────────

export function isLLMTrendResponse(v: unknown): v is {
  direction: 'up' | 'down' | 'sideways';
  strength: number;
  persistence: 'strong' | 'moderate' | 'weak';
  reversalRisk: number;
  confidence: number;
  reasoning: string[];
} {
  if (!isNonNullObject(v)) return false;
  const o = asRecord(v);
  return (
    (o.direction === 'up' || o.direction === 'down' || o.direction === 'sideways') &&
    typeof o.strength === 'number' &&
    (o.persistence === 'strong' || o.persistence === 'moderate' || o.persistence === 'weak') &&
    typeof o.reversalRisk === 'number' &&
    typeof o.confidence === 'number' &&
    Array.isArray(o.reasoning)
  );
}

export function isLLMEntryResponse(v: unknown): v is {
  action: 'buy' | 'sell' | 'hold';
  signalStrength: number;
  confidence: number;
  urgency: 'high' | 'medium' | 'low';
  reasoning: string[];
} {
  if (!isNonNullObject(v)) return false;
  const o = asRecord(v);
  return (
    (o.action === 'buy' || o.action === 'sell' || o.action === 'hold') &&
    typeof o.signalStrength === 'number' &&
    typeof o.confidence === 'number' &&
    (o.urgency === 'high' || o.urgency === 'medium' || o.urgency === 'low') &&
    Array.isArray(o.reasoning)
  );
}

export function isLLMRiskResponse(v: unknown): v is {
  level: 'low' | 'medium' | 'high';
  volatilityAssessment: string;
  recommendedPositionSize: number;
  stopLossPercent: number;
  takeProfitLevels?: Array<{ percent: number; portion: number }>;
  confidence: number;
  reasoning: string[];
} {
  if (!isNonNullObject(v)) return false;
  const o = asRecord(v);
  return (
    (o.level === 'low' || o.level === 'medium' || o.level === 'high') &&
    typeof o.volatilityAssessment === 'string' &&
    typeof o.recommendedPositionSize === 'number' &&
    typeof o.stopLossPercent === 'number' &&
    typeof o.confidence === 'number' &&
    Array.isArray(o.reasoning)
  );
}

// ──────────────── Binance API response guards ────────────────

export function isBinanceFundingRateArray(
  v: unknown,
): v is Array<{ fundingRate: string }> {
  if (!Array.isArray(v)) return false;
  return v.every(
    (item) => isNonNullObject(item) && typeof asRecord(item).fundingRate === 'string',
  );
}

export function isBinanceOpenInterestResponse(
  v: unknown,
): v is { openInterest: string } {
  return isNonNullObject(v) && typeof asRecord(v).openInterest === 'string';
}

export function isBinanceLongShortRatioArray(
  v: unknown,
): v is Array<{ longShortRatio: string }> {
  if (!Array.isArray(v)) return false;
  return v.every(
    (item) => isNonNullObject(item) && typeof asRecord(item).longShortRatio === 'string',
  );
}

// ──────────────── On-chain data guard ────────────────

export function isOnChainRawData(
  v: unknown,
): v is {
  whaleMovements?: unknown[];
  netInflow?: number;
  netOutflow?: number;
  exchangeReserve?: number;
  reserveChange?: number;
} {
  return isNonNullObject(v);
}

// ──────────────── News API guard ────────────────

export function isNewsApiResponse(
  v: unknown,
): v is {
  status: string;
  articles: Array<{
    title: string;
    description?: string;
    source?: { name?: string };
    publishedAt: string;
    url: string;
  }>;
} {
  if (!isNonNullObject(v)) return false;
  const o = asRecord(v);
  return typeof o.status === 'string' && Array.isArray(o.articles);
}

// ──────────────── Market data guards ────────────────

export function isKlineArray(
  v: unknown,
): v is Array<[number, string, string, string, string, string, ...unknown[]]> {
  if (!Array.isArray(v)) return false;
  if (v.length === 0) return true;
  const first = v[0];
  return Array.isArray(first) && first.length >= 6;
}

export function isTradeRecordArray(
  v: unknown,
): v is Array<{ side: 'buy' | 'sell'; amount: number; price: number; timestamp: number }> {
  if (!Array.isArray(v)) return false;
  if (v.length === 0) return true;
  const first = v[0];
  return (
    isNonNullObject(first) &&
    (first.side === 'buy' || first.side === 'sell') &&
    typeof first.amount === 'number' &&
    typeof first.price === 'number' &&
    typeof first.timestamp === 'number'
  );
}

// ──────────────── LLM provider guard ────────────────

const VALID_LLM_PROVIDERS = new Set(['openai', 'google', 'moonshot', 'deepseek', 'anthropic']);

export function isLLMProvider(
  v: unknown,
): v is 'openai' | 'google' | 'moonshot' | 'deepseek' | 'anthropic' {
  return typeof v === 'string' && VALID_LLM_PROVIDERS.has(v);
}

// ──────────────── TradingBotConfig validator ────────────────

export function validateTradingBotConfig(v: unknown): TradingBotConfig | null {
  if (!isNonNullObject(v)) return null;
  const o = asRecord(v);
  if (
    typeof o.version !== 'string' ||
    typeof o.generatedAt !== 'string' ||
    typeof o.validUntil !== 'string' ||
    typeof o.symbol !== 'string' ||
    !isNonNullObject(o.entryConditions) ||
    !isNonNullObject(o.exitConditions) ||
    !isNonNullObject(o.riskManagement) ||
    !isNonNullObject(o.orderSpec)
  ) {
    return null;
  }
  // After validating top-level shape we trust the JSON structure matches
  // TradingBotConfig.  A full deep validation is impractical for dynamic
  // config files; the bot gracefully handles unexpected nested shapes at
  // runtime via optional chaining throughout the codebase.
  return v as unknown as TradingBotConfig;
}

// ──────────────── Factor type guard ────────────────

const VALID_FACTOR_TYPES = new Set([
  'momentum', 'value', 'quality', 'volatility', 'sentiment', 'custom',
]);

export function isValidFactorType(
  v: unknown,
): v is 'momentum' | 'value' | 'quality' | 'volatility' | 'sentiment' | 'custom' {
  return typeof v === 'string' && VALID_FACTOR_TYPES.has(v);
}

// ──────────────── Trading signal guards ────────────────

const VALID_SIGNAL_TYPES = new Set(['long', 'short', 'hold', 'wait']);

export function isValidTradingSignalType(
  v: unknown,
): v is 'long' | 'short' | 'hold' | 'wait' {
  return typeof v === 'string' && VALID_SIGNAL_TYPES.has(v);
}

const VALID_SIGNAL_URGENCIES = new Set(['immediate', 'soon', 'moderate', 'low']);

export function isValidTradingSignalUrgency(
  v: unknown,
): v is 'immediate' | 'soon' | 'moderate' | 'low' {
  return typeof v === 'string' && VALID_SIGNAL_URGENCIES.has(v);
}

// ──────────────── Position sizing recommendation guard ────────────────

const VALID_POSITION_SIZING = new Set(['aggressive', 'normal', 'conservative', 'minimal']);

export function isValidPositionSizing(
  v: unknown,
): v is 'aggressive' | 'normal' | 'conservative' | 'minimal' {
  return typeof v === 'string' && VALID_POSITION_SIZING.has(v);
}
