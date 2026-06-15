/**
 * 回测框架入口
 * Phase 3: Cleaned up exports. LeakageControlledBacktest kept for Phase B
 * of backtest-runner.ts.
 */

export {
  LeakageControlledBacktest,
  type BacktestResult,
  type BacktestConfig,
  type Strategy,
  type BacktestTrade,
} from './leakageControlledBacktest';

export {
  combinatorialPurgedCV,
  probabilityOfBacktestOverfitting,
  walkForwardValidation,
  validateBacktest,
  type CPCVConfig,
  type CPCVResult,
  type CPCVFoldResult,
  type PBOResult,
  type TimeSeriesObservation,
  type WalkForwardConfig,
  type WalkForwardResult,
  type BacktestValidationResult,
  type BacktestValidationConfig,
} from './cpcvValidation';

export {
  DeflatedSharpeCalculator,
  type DSRConfig,
  type DSRResult,
} from './deflatedSharpe';

export {
  TripleBarrierLabeler,
  type TripleBarrierConfig,
  type BarrierLabel,
} from './tripleBarrier';
