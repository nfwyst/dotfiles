/**
 * tradingBot.ts — Legacy re-export shim
 * 
 * 所有类型已迁移至 sharedTypes.ts。
 * 此文件仅保留 re-export 以保持已有 import path 向后兼容。
 * 
 * @deprecated 直接从 './sharedTypes' 导入。
 */

export type {
  TradingBotConfig,
  SimpleOrderSpec as OrderSpec,
  SimpleOrderSpec,
  Position,
  PerformanceMetrics,
  TradeRecord,
} from './sharedTypes';
