/** @deprecated Use unified config: import { loadConfig } from "./loader.js" */
/**
 * Symbol Configuration for Multi-Pair Support (Phase 5)
 *
 * Provides per-symbol trading parameters (precision, order limits,
 * tick size, contract size) so the system can be extended beyond
 * a single hardcoded BTC/USDT pair.
 *
 * Usage:
 *   import { getSymbolConfig } from './config/symbolConfig';
 *   const cfg = getSymbolConfig('BTC/USDT:USDT');
 *   console.log(cfg.pricePrecision); // 1
 */

export interface SymbolConfig {
  /** Full symbol identifier, e.g. 'BTC/USDT:USDT' */
  symbol: string;
  /** Number of decimal places for price (e.g. 1 -> $65432.1) */
  pricePrecision: number;
  /** Number of decimal places for quantity (e.g. 3 -> 0.001 BTC) */
  quantityPrecision: number;
  /** Minimum order size in base currency */
  minOrderSize: number;
  /** Maximum order size in base currency */
  maxOrderSize: number;
  /** Minimum price increment */
  tickSize: number;
  /** Contract multiplier (1 for spot/linear, varies for inverse) */
  contractSize: number;
}

/**
 * Built-in presets for commonly traded pairs.
 * Values reflect typical Binance USDT-M perpetual futures specs.
 */
export const SYMBOL_PRESETS: Record<string, SymbolConfig> = {
  'BTC/USDT:USDT': {
    symbol: 'BTC/USDT:USDT',
    pricePrecision: 1,
    quantityPrecision: 3,
    minOrderSize: 0.001,
    maxOrderSize: 100,
    tickSize: 0.1,
    contractSize: 1,
  },
  'ETH/USDT:USDT': {
    symbol: 'ETH/USDT:USDT',
    pricePrecision: 2,
    quantityPrecision: 3,
    minOrderSize: 0.01,
    maxOrderSize: 1000,
    tickSize: 0.01,
    contractSize: 1,
  },
  'SOL/USDT:USDT': {
    symbol: 'SOL/USDT:USDT',
    pricePrecision: 3,
    quantityPrecision: 1,
    minOrderSize: 0.1,
    maxOrderSize: 10000,
    tickSize: 0.001,
    contractSize: 1,
  },
  'BNB/USDT:USDT': {
    symbol: 'BNB/USDT:USDT',
    pricePrecision: 2,
    quantityPrecision: 2,
    minOrderSize: 0.01,
    maxOrderSize: 5000,
    tickSize: 0.01,
    contractSize: 1,
  },
  'DOGE/USDT:USDT': {
    symbol: 'DOGE/USDT:USDT',
    pricePrecision: 5,
    quantityPrecision: 0,
    minOrderSize: 1,
    maxOrderSize: 10000000,
    tickSize: 0.00001,
    contractSize: 1,
  },
};

/**
 * Retrieve configuration for a given symbol.
 * Returns a preset if one exists, otherwise falls back to
 * reasonable defaults suitable for most USDT-margined pairs.
 *
 * @param symbol  Full symbol string (e.g. 'BTC/USDT:USDT')
 * @returns  SymbolConfig for the requested pair
 */
export function getSymbolConfig(symbol: string): SymbolConfig {
  const preset = SYMBOL_PRESETS[symbol];
  if (preset) return preset;

  // Reasonable defaults for unknown symbols
  return {
    symbol,
    pricePrecision: 2,
    quantityPrecision: 4,
    minOrderSize: 0.001,
    maxOrderSize: 100,
    tickSize: 0.01,
    contractSize: 1,
  };
}

/**
 * Register a custom symbol configuration at runtime.
 * Useful for loading exchange-specific specs from API responses.
 */
export function registerSymbolConfig(config: SymbolConfig): void {
  SYMBOL_PRESETS[config.symbol] = config;
}
