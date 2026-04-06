export { BayesianKellyManager, type KellyConfig, type KellyResult, type TradeRecord as KellyTradeRecord } from './bayesianKelly';
export { HMMRegimeDetector, MarketRegime, type RegimeConfig, type RegimeResult } from './hmmRegimeDetector';
export { TailRiskModel, type TailRiskConfig, type TailRiskResult } from './tailRiskModel';
export { TradingCostModel, type CostConfig, type CostEstimate } from './tradingCostModel';

export { calculatePositionSize } from './positionSizing';
export type { PositionSizeInput, PositionSizeResult } from './positionSizing';
