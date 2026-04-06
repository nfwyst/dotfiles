/**
 * 回测框架入口
 * FIX: Cleaned up exports — no wildcard re-exports, no redundant duplicates.
 */

export {
  LeakageControlledBacktest,
  type BacktestResult,
  type BacktestConfig,
  type Strategy,
  type BacktestTrade,
  type ValidatedBacktestResult,
  type ValidationConfig,
} from './leakageControlledBacktest';

export {
  combinatorialPurgedCV,
  probabilityOfBacktestOverfitting,
  walkForwardValidation,
  type CPCVConfig,
  type CPCVResult,
  type CPCVFoldResult,
  type PBOResult,
  type TimeSeriesObservation,
  type WalkForwardConfig,
  type WalkForwardResult,
} from './cpcvValidation';
