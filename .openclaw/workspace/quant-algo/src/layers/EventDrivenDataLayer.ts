/**
 * 事件驱动数据层 - Event-Driven Data Layer
 * 发布市场数据、指标、SMC分析等事件
 */

import type { ExchangeManager } from '../exchange';
import type { SMCAnalyzer } from '../smc';
import type { MarketMicrostructure } from '../marketMicro';
import type { AIModule, AnomalyDetection } from '../ai';
import { AdaptiveRSI, type AdaptiveRSIResult } from '../adaptiveRSI';
import { MarketDataFetcher } from '../marketDataFetcher';
import { getEventBus } from '../events';
import { EventChannels } from '../events/types';
  import type {
  OHLCV,
  MarketData,
  Indicators,
  SMCAnalysis,
  MicrostructureSignal,
  AnomalyResult,
  RiskForecast,
  MarketDataGatheredEvent,
  IndicatorsCalculatedEvent,
  SMCAnalyzedEvent,
  DataLayerCompleteEvent,
} from '../events/types';
import logger from '../logger';
// ==================== 类型定义 ====================

export interface DataLayerResult {
  marketData: MarketData;
  indicators: Indicators;
  smcAnalysis: SMCAnalysis | null;
  microSignal: MicrostructureSignal | null;
  anomaly: AnomalyResult | null;
  riskForecast: RiskForecast | null;
}

// ==================== 事件驱动数据层 ====================
// ==================== 事件驱动数据层 ====================

export class EventDrivenDataLayer {
  private exchange: ExchangeManager;
  private smcAnalyzer: SMCAnalyzer;
  private microstructure: MarketMicrostructure;
  private aiModule: AIModule;
  private adaptiveRSI: AdaptiveRSI;
  private marketDataFetcher: MarketDataFetcher;
  private eventBus = getEventBus();

  constructor(
    exchange: ExchangeManager,
    smcAnalyzer: SMCAnalyzer,
    microstructure: MarketMicrostructure,
    aiModule: AIModule
  ) {
    this.exchange = exchange;
    this.smcAnalyzer = smcAnalyzer;
    this.microstructure = microstructure;
    this.aiModule = aiModule;
    this.adaptiveRSI = new AdaptiveRSI();
    this.marketDataFetcher = new MarketDataFetcher();
  }

  /**
   * 获取市场数据并发布事件
   */
  async fetchMarketDataAndEmit(): Promise<MarketData> {
    const startTime = Date.now();
    const correlationId = this.eventBus.getCorrelationId();

    const marketData = await this.fetchMarketData();
    const duration = Date.now() - startTime;

    // 发布市场数据获取事件
    await this.eventBus.publish({
      channel: EventChannels.MARKET_DATA_GATHERED,
      source: 'DataLayer',
      correlationId,
      payload: {
        marketData,
        gatherDuration: duration,
      },
    });

    return marketData;
  }

  /**
   * 计算指标并发布事件
   */
  async calculateIndicatorsAndEmit(ohlcv: OHLCV[], price: number): Promise<Indicators> {
    const correlationId = this.eventBus.getCorrelationId();

    const indicators = this.calculateIndicators(ohlcv);

    // 发布指标计算事件
    await this.eventBus.publish({
      channel: EventChannels.INDICATORS_CALCULATED,
      source: 'DataLayer',
      correlationId,
      payload: {
        indicators,
        price,
      },
    });

    return indicators;
  }

  /**
   * 分析 SMC 并发布事件
   */
  async analyzeSMCAndEmit(ohlcv: OHLCV[], orderBook?: MarketData['orderBook']): Promise<{
    smcAnalysis: SMCAnalysis | null;
    microSignal: MicrostructureSignal | null;
  }> {
    const correlationId = this.eventBus.getCorrelationId();

    const smcAnalysis = this.analyzeSMC(ohlcv);
    const microSignal = orderBook ? this.analyzeMicrostructure(orderBook) : null;

    // 发布 SMC 分析事件
    await this.eventBus.publish({
      channel: EventChannels.SMC_ANALYZED,
      source: 'DataLayer',
      correlationId,
      payload: {
        smcAnalysis,
        microSignal,
      },
    });

    return { smcAnalysis, microSignal };
  }

  /**
   * 收集所有数据并发布完成事件
   */
  async gatherDataAndEmit(): Promise<DataLayerResult> {
    const startTime = Date.now();
    const correlationId = this.eventBus.generateCorrelationId();

    logger.info(`[DataLayer] Starting data gathering [${correlationId}]`);

    // 1. 获取市场数据
    const marketData = await this.fetchMarketDataAndEmit();

    // 2. 计算指标
    const indicators = await this.calculateIndicatorsAndEmit(
      marketData.ohlcv,
      marketData.currentPrice
    );

    // 3. SMC 分析
    const { smcAnalysis, microSignal } = await this.analyzeSMCAndEmit(
      marketData.ohlcv,
      marketData.orderBook
    );

    // 4. 异常检测
    const anomaly = this.detectAnomaly(marketData.ohlcv);

    // 5. 风险预测
    const riskForecast = this.predictRisk(marketData.ohlcv);

    const totalDuration = Date.now() - startTime;

    const result: DataLayerResult = {
      marketData,
      indicators,
      smcAnalysis,
      microSignal,
      anomaly,
      riskForecast,
    };

    // 发布数据层完成事件
    await this.eventBus.publish({
      channel: EventChannels.DATA_LAYER_COMPLETE,
      source: 'DataLayer',
      correlationId,
      payload: {
        ...result,
        totalDuration,
      },
    });

    logger.info(`[DataLayer] Data gathering complete [${totalDuration}ms] [${correlationId}]`);

    return result;
  }

  // ==================== 内部方法 ====================

  private async fetchMarketData(): Promise<MarketData> {
    const timeframe = process.env.TIMEFRAME || '5m';
    const higherTimeframe = process.env.HIGHER_TF || '15m';

    // 使用 MarketDataFetcher 获取 K线数据
    const [klinesData, higherTfKlines, currentPrice] = await Promise.all([
      this.marketDataFetcher.fetchKlines(timeframe, 200),
      this.marketDataFetcher.fetchKlines(higherTimeframe, 100),
      this.exchange.getCurrentPrice(),
    ]);

    // MarketDataFetcher 已经返回 OHLCV 格式
    const ohlcv: OHLCV[] = klinesData;
    const higherTfOhlcv: OHLCV[] = higherTfKlines;

    return {
      ohlcv,
      higherTfOhlcv,
      currentPrice,
      orderBook: undefined, // 暂不支持订单簿
    };
  }

  private calculateIndicators(ohlcv: OHLCV[]): Indicators {
    const closes = ohlcv.map((c) => c.close);
    const highs = ohlcv.map((c) => c.high);
    const lows = ohlcv.map((c) => c.low);
    const volumes = ohlcv.map((c) => c.volume);

    // 计算各类指标
    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, 50);
    const sma200 = this.calculateSMA(closes, 200);
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const rsi14 = this.calculateRSI(closes, 14);
    const adaptiveRSIValue = this.adaptiveRSI.calculate(closes);
    const macd = this.calculateMACD(closes);
    const atr14 = this.calculateATR(highs, lows, closes, 14);
    const bollinger = this.calculateBollinger(closes, 20);
    const supertrend = this.calculateSupertrend(highs, lows, closes, 14);
    const adx = this.calculateADX(highs, lows, closes, 14);
    const stochastic = this.calculateStochastic(highs, lows, closes, 14);
    const cci = this.calculateCCI(highs, lows, closes, 20);
    const vwap = this.calculateVWAP(highs, lows, closes, volumes);
    const obv = this.calculateOBV(closes, volumes);
    const volumeSma20 = this.calculateSMA(volumes, 20);

    // 计算综合评分
    const trendScore = this.calculateTrendScore(closes, sma20, sma50, sma200);
    const momentumScore = this.calculateMomentumScore(rsi14, macd, stochastic);
    const volumeScore = this.calculateVolumeScore(volumes, volumeSma20);
    const volatilityScore = this.calculateVolatilityScore(atr14, closes[closes.length - 1] ?? 0);
    const overallScore = (trendScore + momentumScore + volumeScore + volatilityScore) / 4;

    return {
      sma20,
      sma50,
      sma200,
      ema12,
      ema26,
      rsi14,
      adaptiveRSI: {
        value: adaptiveRSIValue.value,
        period: adaptiveRSIValue.period,
        trend: adaptiveRSIValue.regime,
      },
      macd,
      atr14,
      bollinger,
      supertrend,
      adx,
      stochastic,
      cci,
      vwap,
      obv,
      volumeSma20,
      trendScore,
      momentumScore,
      volumeScore,
      volatilityScore,
      overallScore,
    };
  }

  private analyzeSMC(ohlcv: OHLCV[]): SMCAnalysis | null {
    try {
      // SMCAnalyzer.analyze 需要 number[][] 格式
      const ohlcvData = ohlcv.map(k => [k.timestamp, k.open, k.high, k.low, k.close, k.volume]);
      this.smcAnalyzer.analyze(ohlcvData);
      
      // 从 SMCAnalyzer 提取数据
      const stats = this.smcAnalyzer.getStats();
      
      // 构建 SMCAnalysis 结果
      return {
        bullishOBs: [],
        bearishOBs: [],
        fvgs: [],
        sweeps: [],
        bullishFVGs: [],
        bearishFVGs: [],
        orderBlocks: [],
      };
    } catch (error) {
      logger.error('[DataLayer] SMC analysis failed:', error);
      return null;
    }
  }

  private analyzeMicrostructure(orderBook: MarketData['orderBook']): MicrostructureSignal | null {
    if (!orderBook) return null;
    try {
      const imbalance = this.microstructure.analyzeOrderBook(orderBook);
      return {
        score: imbalance.delta,
        confidence: imbalance.wallStrength / 100,
        direction: imbalance.ratio > 1 ? 'bullish' : imbalance.ratio < 1 ? 'bearish' : 'neutral',
      };
    } catch (error) {
      logger.error('[DataLayer] Microstructure analysis failed:', error);
      return null;
    }
  }

  private detectAnomaly(ohlcv: OHLCV[]): AnomalyResult {
    try {
      // AIModule.detectAnomaly 需要 number[][] 格式
      const ohlcvData = ohlcv.map(k => [k.timestamp, k.open, k.high, k.low, k.close, k.volume]);
      const result: AnomalyDetection = this.aiModule.detectAnomaly(ohlcvData);
      return {
        isAnomaly: result.isAnomaly,
        severity: result.severity,
        anomalyType: result.anomalyType || 'none',
        reason: result.reason,
      };
    } catch (error) {
      logger.error('[DataLayer] Anomaly detection failed:', error);
      return {
        isAnomaly: false,
        severity: 0,
        anomalyType: 'none',
        reason: 'Detection failed',
      };
    }
  }

  private predictRisk(ohlcv: OHLCV[]): RiskForecast {
    try {
      // AIModule.predictRisk 需要 number[][] 格式
      const ohlcvData = ohlcv.map(k => [k.timestamp, k.open, k.high, k.low, k.close, k.volume]);
      return this.aiModule.predictRisk(ohlcvData);
    } catch (error) {
      logger.error('[DataLayer] Risk prediction failed:', error);
      return {
        riskLevel: 'medium',
        warnings: ['Risk prediction failed'],
      };
    }
  }

  // ==================== 指标计算辅助方法 ====================

  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateEMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      const value = data[i] ?? 0;
      ema = (value - ema) * multiplier + ema;
    }
    return ema;
  }

  private calculateRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const prevClose = closes[i - 1] ?? 0;
      const currClose = closes[i] ?? 0;
      const change = currClose - prevClose;
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([...closes.map(() => macd)], 9);
    const histogram = macd - signal;
    return { macd, signal, histogram };
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (closes.length < period + 1) return 0;
    const trValues: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const high = highs[i] ?? 0;
      const low = lows[i] ?? 0;
      const prevClose = closes[i - 1] ?? 0;
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trValues.push(tr);
    }
    return this.calculateSMA(trValues, period);
  }

  private calculateBollinger(
    closes: number[],
    period: number
  ): { upper: number; middle: number; lower: number } {
    const middle = this.calculateSMA(closes, period);
    const slice = closes.slice(-period);
    const stdDev = Math.sqrt(
      slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period
    );
    return {
      upper: middle + 2 * stdDev,
      middle,
      lower: middle - 2 * stdDev,
    };
  }

  private calculateSupertrend(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): { value: number; direction: number } {
    const atr = this.calculateATR(highs, lows, closes, period);
    const lastHigh = highs[highs.length - 1] ?? 0;
    const lastLow = lows[lows.length - 1] ?? 0;
    const close = closes[closes.length - 1] ?? 0;
    const hl2 = (lastHigh + lastLow) / 2;
    const upperBand = hl2 + 3 * atr;
    const lowerBand = hl2 - 3 * atr;
    const direction = close > upperBand ? -1 : close < lowerBand ? 1 : 0;
    return { value: direction === 1 ? upperBand : lowerBand, direction };
  }

  private calculateADX(highs: number[], lows: number[], closes: number[], period: number): number {
    if (closes.length < period * 2) return 25;
    let plusDM = 0;
    let minusDM = 0;
    let tr = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const high = highs[i] ?? 0;
      const prevHigh = highs[i - 1] ?? 0;
      const low = lows[i] ?? 0;
      const prevLow = lows[i - 1] ?? 0;
      const close = closes[i] ?? 0;
      const prevClose = closes[i - 1] ?? 0;
      const upMove = high - prevHigh;
      const downMove = prevLow - low;
      plusDM += upMove > downMove && upMove > 0 ? upMove : 0;
      minusDM += downMove > upMove && downMove > 0 ? downMove : 0;
      tr += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    }
    const plusDI = (plusDM / tr) * 100;
    const minusDI = (minusDM / tr) * 100;
    return Math.abs((plusDI - minusDI) / (plusDI + minusDI)) * 100;
  }

  private calculateStochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): { k: number; d: number } {
    const slice = closes.length >= period ? closes.slice(-period) : closes;
    const highSlice = highs.length >= period ? highs.slice(-period) : highs;
    const lowSlice = lows.length >= period ? lows.slice(-period) : lows;
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    const lastClose = closes[closes.length - 1] ?? 0;
    const k = highestHigh !== lowestLow ? ((lastClose - lowestLow) / (highestHigh - lowestLow)) * 100 : 50;
    const d = k; // 简化版
    return { k, d };
  }

  private calculateCCI(highs: number[], lows: number[], closes: number[], period: number): number {
    const slice = closes.length >= period ? closes.slice(-period) : closes;
    const tp = slice.map((c, i) => ((highs[i] ?? 0) + (lows[i] ?? 0) + c) / 3);
    const sma = this.calculateSMA(tp, period);
    const meanDev = tp.reduce((sum, val) => sum + Math.abs(val - sma), 0) / period;
    const currentTP = ((highs[highs.length - 1] ?? 0) + (lows[lows.length - 1] ?? 0) + (closes[closes.length - 1] ?? 0)) / 3;
    return meanDev > 0 ? (currentTP - sma) / (0.015 * meanDev) : 0;
  }

  private calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
    let sumPV = 0;
    let sumV = 0;
    for (let i = 0; i < closes.length; i++) {
      const tp = ((highs[i] ?? 0) + (lows[i] ?? 0) + (closes[i] ?? 0)) / 3;
      sumPV += tp * (volumes[i] ?? 0);
      sumV += volumes[i] ?? 0;
    }
    return sumV > 0 ? sumPV / sumV : (closes[closes.length - 1] ?? 0);
  }

  private calculateOBV(closes: number[], volumes: number[]): number {
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      const curr = closes[i] ?? 0;
      const prev = closes[i - 1] ?? 0;
      const vol = volumes[i] ?? 0;
      if (curr > prev) obv += vol;
      else if (curr < prev) obv -= vol;
    }
    return obv;
  }

  private calculateTrendScore(closes: number[], sma20: number, sma50: number, sma200: number): number {
    const currentPrice = closes[closes.length - 1] ?? 0;
    if (currentPrice === 0) return 50;
    let score = 50;
    if (currentPrice > sma20) score += 10;
    if (currentPrice > sma50) score += 10;
    if (currentPrice > sma200) score += 10;
    if (sma20 > sma50) score += 10;
    if (sma50 > sma200) score += 10;
    return Math.min(100, Math.max(0, score));
  }

  private calculateMomentumScore(rsi: number, macd: { histogram: number }, stoch: { k: number }): number {
    let score = 50;
    if (rsi > 50 && rsi < 70) score += 15;
    else if (rsi > 70) score -= 10;
    else if (rsi < 30) score += 10;
    if (macd.histogram > 0) score += 15;
    if (stoch.k > 50 && stoch.k < 80) score += 10;
    return Math.min(100, Math.max(0, score));
  }

  private calculateVolumeScore(volumes: number[], volumeSma: number): number {
    const currentVolume = volumes[volumes.length - 1] ?? 0;
    if (volumeSma === 0 || currentVolume === 0) return 50;
    const ratio = currentVolume / volumeSma;
    if (ratio > 1.5) return 80;
    if (ratio > 1.2) return 65;
    if (ratio > 0.8) return 50;
    return 35;
  }

  private calculateVolatilityScore(atr: number, currentPrice: number): number {
    const volatilityRatio = atr / currentPrice;
    if (volatilityRatio > 0.03) return 80;
    if (volatilityRatio > 0.02) return 60;
    if (volatilityRatio > 0.01) return 40;
    return 20;
  }
}

export default EventDrivenDataLayer;
