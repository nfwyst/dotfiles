/**
 * Unified Config — Public API
 *
 * Two files only:
 *   schema.ts — Zod validation rules and types (no defaults)
 *   config.ts — All values, mode configs, env overrides, loadConfig()
 *
 * Usage:
 *   import { loadConfig, printConfigSummary } from './config/index.js';
 *   const cfg = loadConfig('backtest');
 */

// Schema & types
export {
  UnifiedConfigSchema,
  TradingModeSchema,
  TimeframeSchema,
  SymbolConfigSchema,
  PositionSchema,
  StopLossSchema,
  TakeProfitSchema,
  TakeProfitLevelSchema,
  AtrFallbackSchema,
  SwingDetectionSchema,
  SwingDetectionEntrySchema,
  RiskSchema,
  CostSchema,
  BacktestSchema,
  ExchangeSchema,
  type TradingMode,
  type Timeframe,
  type UnifiedConfig,
  type SymbolConfig,
  type PositionConfig,
  type StopLossConfig,
  type TakeProfitConfig,
  type AtrFallbackConfig,
  type SwingDetectionConfig,
  type RiskConfig,
  type CostConfig,
  type BacktestSpecConfig,
  type ExchangeConfig,
} from './schema.js';

// Config values & loader (primary API)
export {
  loadConfig,
  clearConfigCache,
  printConfigSummary,
  type ConfigOverlay,
} from './tradingConfig.js';
