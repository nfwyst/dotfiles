/** @deprecated Prefer unified config cost section: loadConfig(mode).cost. This module is kept for backward compatibility. */
export interface TradingCostConfig {
  feeRate: number;         // taker 手续费率（如 0.0004 = 4 bps）
  makerRebate: number;     // maker 返佣（如 -0.0002 = -2 bps）
  slippageBps: number;     // 估算滑点（如 3 = 3 bps）
  fundingRate?: number;    // 资金费率（如适用）
}

export const DEFAULT_TRADING_COSTS: TradingCostConfig = {
  feeRate: 0.0004,     // Binance VIP0 taker
  makerRebate: -0.0002, // Binance VIP0 maker
  slippageBps: 3,       // 3 bps 保守估计
};

export function getTotalCostBps(config: TradingCostConfig, isMaker: boolean = false): number {
  const feeBps = (isMaker ? config.makerRebate : config.feeRate) * 10000;
  return feeBps + config.slippageBps;
}
