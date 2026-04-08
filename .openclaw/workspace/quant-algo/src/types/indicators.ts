/**
 * 统一的技术指标类型，供回测和实盘共用
 */
export interface UnifiedIndicators {
  sma: { 5?: number; 10?: number; 20: number; 50: number; 200: number };
  ema: { 12: number; 26: number; 50?: number };
  rsi: { 6?: number; 14: number; 24?: number };
  atr: { 14: number; 20?: number };
  macd: { line: number; signal: number; histogram: number };
  bollinger: { upper: number; middle: number; lower: number; bandwidth?: number; percentB?: number };
  stochastic: { k: number; d: number };
  adx: number;
  cci?: number;
  vwap?: number;
  obv?: number;
  supertrend?: { value: number; direction: 'up' | 'down' | number };
  volumeSma20?: number;
  scores: {
    trend: number;
    momentum: number;
    volatility: number;
    volume: number;
    overall: number;
  };
}

/**
 * 从 events/types.ts 的扁平 Indicators 转换为 UnifiedIndicators
 */
export function toUnifiedIndicators(flat: import('../events/types').Indicators): UnifiedIndicators {
  return {
    sma: { 20: flat.sma20, 50: flat.sma50, 200: flat.sma200 },
    ema: { 12: flat.ema12, 26: flat.ema26 },
    rsi: { 14: flat.rsi14 },
    atr: { 14: flat.atr14 },
    macd: { line: flat.macd.macd, signal: flat.macd.signal, histogram: flat.macd.histogram },
    bollinger: flat.bollinger,
    stochastic: flat.stochastic,
    adx: flat.adx,
    cci: flat.cci,
    vwap: flat.vwap,
    obv: flat.obv,
    supertrend: flat.supertrend ? { value: flat.supertrend.value, direction: flat.supertrend.direction > 0 ? 'up' : 'down' } : undefined,
    volumeSma20: flat.volumeSma20,
    scores: {
      trend: flat.trendScore,
      momentum: flat.momentumScore,
      volatility: flat.volatilityScore,
      volume: flat.volumeScore,
      overall: flat.overallScore,
    },
  };
}

/**
 * 从 TechnicalIndicators（modules/technicalAnalysis.ts）转换为 UnifiedIndicators
 */
export function fromTechnicalIndicators(tech: import('../modules/technicalAnalysis').TechnicalIndicators): UnifiedIndicators {
  return {
    sma: tech.sma,
    ema: tech.ema,
    rsi: tech.rsi,
    atr: tech.atr,
    macd: tech.macd,
    bollinger: tech.bollinger,
    stochastic: tech.stochastic,
    adx: tech.adx,
    cci: tech.cci,
    vwap: tech.vwap,
    obv: tech.obv,
    supertrend: tech.supertrend,
    volumeSma20: tech.volumeSma?.[20],
    scores: tech.scores,
  };
}
