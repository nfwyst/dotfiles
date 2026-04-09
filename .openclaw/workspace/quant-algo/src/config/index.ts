/**
 * Unified Config — Public API
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

// Defaults
export { BASE_DEFAULTS } from './defaults.js';

// Overlays
export {
  BACKTEST_OVERLAY,
  PAPER_OVERLAY,
  LIVE_OVERLAY,
  MODE_OVERLAYS,
  type ConfigOverlay,
} from './overlays.js';

// Loader (primary API)
export { loadConfig, clearConfigCache, printConfigSummary } from './loader.js';
