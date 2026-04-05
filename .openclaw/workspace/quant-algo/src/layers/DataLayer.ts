/**
 * 数据层 - Data Layer
 * 负责市场数据获取、指标计算、分析模块
 * 
 * 优化版本：并行处理 + 缓存 + 性能监控 + 背压控制
 */

import ExchangeManager from '../exchange';
import SMCAnalyzer from '../smc';
import MarketMicrostructure from '../marketMicro';
import type { OrderBookImbalance } from '../marketMicro';
import AIModule from '../ai';
import AdaptiveRSI from '../adaptiveRSI';
import { config } from '../config';
import logger from '../logger';
import { metricsCollector } from '../monitoring/index.js';
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  ohlcv: OHLCV[];
  higherTfOhlcv: OHLCV[];
  currentPrice: number;
  orderBook?: {
    bids: [number, number][];
    asks: [number, number][];
    imbalance: OrderBookImbalance;
  };
}

export interface Indicators {
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  rsi14: number;
  adaptiveRSI: {
    value: number;
    period: number;
    overbought: number;
    oversold: number;
    regime: string;
    confidence: number;
  };
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
  atr14: number;
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
  supertrend: {
    direction: 'up' | 'down';
    value: number;
  };
  adx: number;
  stochastic: { k: number; d: number };
  cci: number;
  vwap: number;
  obv: number;
  volumeSma20: number;
  trendScore: number;
  momentumScore: number;
  volumeScore: number;
  volatilityScore: number;
  overallScore: number;
}

export interface SMCAnalysis {
  bullishOBs: number;
  bearishOBs: number;
  fvgs: number;
  sweeps: number;
  bullishFVGs: Array<{ high: number; low: number; mitigated: boolean }>;
  bearishFVGs: Array<{ high: number; low: number; mitigated: boolean }>;
  orderBlocks: Array<{ type: 'bullish' | 'bearish'; high: number; low: number; tested: boolean }>;
}

export interface MicrostructureSignal {
  score: number;
  confidence: number;
  direction: 'bullish' | 'bearish' | 'neutral';
}

export interface AnomalyResult {
  isAnomaly: boolean;
  severity: number;
  anomalyType?: string;
  reason: string;
}

export interface RiskForecast {
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

export interface DataLayerResult {
  marketData: MarketData;
  indicators: Indicators;
  smcAnalysis: SMCAnalysis | null;
  microSignal: MicrostructureSignal | null;
  anomaly: AnomalyResult | null;
  riskForecast: RiskForecast | null;
  performance?: PerformanceMetrics;
}

// ==================== 缓存与性能监控 ====================

/** 技术指标缓存 */
interface IndicatorCache {
  hash: string;
  indicators: Indicators;
  timestamp: number;
}

/** 性能计时记录 */
export interface PerformanceMetrics {
  marketDataFetch: number;
  indicatorCalc: number;
  smcAnalysis: number;
  microstructureAnalysis: number;
  anomalyDetection: number;
  riskPrediction: number;
  totalDuration: number;
}

/** 背压控制状态 */
interface BackpressureState {
  pendingTasks: number;
  lastProcessTime: number;
  isOverloaded: boolean;
  skippedNonCritical: number;
}

const CACHE_TTL_MS = 5000; // 缓存有效期5秒
const BACKPRESSURE_THRESHOLD = 10; // 积压任务阈值
const BACKPRESSURE_COOLDOWN_MS = 1000; // 背压冷却时间

export class DataLayer {
  private exchange: ExchangeManager;
  private smcAnalyzer: SMCAnalyzer;
  private marketMicro: MarketMicrostructure;
  private ai: AIModule;
  private adaptiveRSI: AdaptiveRSI;

  // ==================== 缓存与背压控制 ====================
  private indicatorCache: IndicatorCache | null = null;
  private backpressureState: BackpressureState = {
    pendingTasks: 0,
    lastProcessTime: 0,
    isOverloaded: false,
    skippedNonCritical: 0,
  };
  private lastOhlcvHash: string = '';

  constructor(exchange: ExchangeManager) {
    this.exchange = exchange;
    this.smcAnalyzer = new SMCAnalyzer();
    this.marketMicro = new MarketMicrostructure();
    this.ai = new AIModule();
    this.adaptiveRSI = new AdaptiveRSI({
      basePeriod: 14,
      minPeriod: 5,
      maxPeriod: 30,
      volatilityLookback: 20,
    });
  }

  /**
   * 获取完整市场数据（优化版：所有数据源并行获取）
   */
  async fetchMarketData(): Promise<MarketData> {
    const endTimer = metricsCollector.startDataFetchTimer('market_data');

    // 并行获取所有数据源：OHLCV + 高周期OHLCV + 当前价格 + 订单簿
    const [ohlcvRaw, higherTfRaw, currentPrice, orderBookRaw] = await Promise.all([
      this.exchange.fetchOHLCV(config.timeframe, 100),
      config.multiTimeframe.enabled
        ? this.exchange.fetchOHLCV(config.higherTimeframe, 50)
        : Promise.resolve([]),
      this.exchange.getCurrentPrice(),
      // 订单簿获取并行化
      config.marketMicrostructure.enabled
        ? this.exchange.fetchOrderBook(20).catch(() => null)
        : Promise.resolve(null),
    ]);

    const ohlcv = this.formatOHLCV(ohlcvRaw);
    const higherTfOhlcv = this.formatOHLCV(higherTfRaw);

    // 处理订单簿数据
    let orderBook;
    if (orderBookRaw) {
      try {
        const imbalance = this.marketMicro.analyzeOrderBook(orderBookRaw);
        orderBook = {
          bids: orderBookRaw.bids.slice(0, 10),
          asks: orderBookRaw.asks.slice(0, 10),
          imbalance,
        };
        metricsCollector.recordDataFetch('orderbook', 'success');
      } catch (e) {
        logger.debug('订单簿处理失败，继续使用其他数据');
        metricsCollector.recordDataFetch('orderbook', 'failed');
      }
    }

    endTimer();
    metricsCollector.recordDataFetch('market_data', 'success');

    return {
      ohlcv,
      higherTfOhlcv,
      currentPrice,
      orderBook,
    };
  }

  /**
   * 计算技术指标
   */
  calculateIndicators(ohlcv: OHLCV[]): Indicators {
    const closes = ohlcv.map(c => c.close);
    const highs = ohlcv.map(c => c.high);
    const lows = ohlcv.map(c => c.low);
    const volumes = ohlcv.map(c => c.volume);
    const currentPrice = closes[closes.length - 1] ?? 0;

    // 基础 SMA - 明确返回 number 类型
    const sma = (data: number[], period: number): number => {
      if (data.length < period) return data[data.length - 1] ?? 0;
      return data.slice(-period).reduce((a, b) => a + b, 0) / period;
    };

    // RSI
    const rsi = (data: number[], period: number): number => {
      if (data.length < period + 1) return 50;
      let gains = 0, losses = 0;
      for (let i = data.length - period; i < data.length; i++) {
        const current = data[i] ?? 0;
        const prev = data[i - 1] ?? 0;
        const change = current - prev;
        if (change > 0) gains += change;
        else losses -= change;
      }
      if (losses === 0) return 100;
      return 100 - (100 / (1 + gains / losses));
    };

    // ATR
    const atr = (h: number[], l: number[], c: number[], period: number): number => {
      if (h.length < period + 1) return 0;
      let sum = 0;
      for (let i = h.length - period; i < h.length; i++) {
        const high = h[i] ?? 0;
        const low = l[i] ?? 0;
        const prevClose = c[i - 1] ?? 0;
        const tr1 = high - low;
        const tr2 = Math.abs(high - prevClose);
        const tr3 = Math.abs(low - prevClose);
        sum += Math.max(tr1, tr2, tr3);
      }
      return sum / period;
    };

    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, Math.min(200, closes.length));
    const rsi14 = rsi(closes, 14);
    const atr14 = atr(highs, lows, closes, 14);
    const volumeSma20 = sma(volumes, 20);

    // Adaptive RSI
    const adaptiveRSIInstance = new AdaptiveRSI({
      baseOversold: 25,
      baseOverbought: 75,
      adaptationFactor: 0.6,
    });
    const rsiResult = adaptiveRSIInstance.calculate(closes);

    // 布林带
    const stdDev = (data: number[], period: number): number => {
      const mean = sma(data, period);
      const squaredDiffs = data.slice(-period).map(x => Math.pow(x - mean, 2));
      return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
    };
    const bbStd = stdDev(closes, 20);

    // MACD
    const ema12 = sma(closes, 12) * 1.1;
    const ema26 = sma(closes, 26);
    const macdLine = ema12 - ema26;
    const macdSignal = sma([macdLine], 9);

    // Supertrend
    const supertrendValue = currentPrice - (atr14 * 3);
    const supertrendDirection: 'up' | 'down' = currentPrice > supertrendValue ? 'up' : 'down';

    // ADX
    const close14 = closes[closes.length - 1] ?? 0;
    const closePrev14 = closes[closes.length - 14] ?? close14;
    const dx = closePrev14 > 0 ? Math.abs(((close14 - closePrev14) / closePrev14) * 100) : 0;
    const adx = Math.min(50, Math.max(10, dx));

    // Stochastic
    const lowestLow = Math.min(...lows.slice(-14));
    const highestHigh = Math.max(...highs.slice(-14));
    const k = highestHigh !== lowestLow ? ((currentPrice - lowestLow) / (highestHigh - lowestLow)) * 100 : 50;

    // CCI
    const lastHigh = highs[highs.length - 1] ?? 0;
    const lastLow = lows[lows.length - 1] ?? 0;
    const lastClose = closes[closes.length - 1] ?? 0;
    const typicalPrice = (lastHigh + lastLow + lastClose) / 3;
    const smaTypical = sma([typicalPrice], 20);
    const meanDeviation = Math.abs(typicalPrice - smaTypical);
    const cci = meanDeviation !== 0 ? (typicalPrice - smaTypical) / (0.015 * meanDeviation) : 0;

    // OBV
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      const currClose = closes[i] ?? 0;
      const prevClose = closes[i - 1] ?? 0;
      const vol = volumes[i] ?? 0;
      if (currClose > prevClose) obv += vol;
      else if (currClose < prevClose) obv -= vol;
    }

    const totalVolume = volumes.reduce((a, b) => a + b, 0);

    return {
      sma20,
      sma50,
      sma200,
      ema12,
      ema26,
      rsi14,
      adaptiveRSI: {
        value: rsiResult.value,
        period: rsiResult.period,
        overbought: rsiResult.overbought,
        oversold: rsiResult.oversold,
        regime: rsiResult.regime,
        confidence: rsiResult.confidence,
      },
      macd: {
        line: macdLine,
        signal: macdSignal,
        histogram: macdLine - macdSignal,
      },
      atr14,
      bollinger: {
        upper: sma20 + 2 * bbStd,
        middle: sma20,
        lower: sma20 - 2 * bbStd,
        bandwidth: sma20 > 0 ? (4 * bbStd) / sma20 : 0,
      },
      supertrend: {
        direction: supertrendDirection,
        value: supertrendValue,
      },
      adx,
      stochastic: { k, d: sma([k], 3) },
      cci,
      vwap: sma(closes, 14),
      obv,
      volumeSma20,
      trendScore: sma50 > 0 ? ((currentPrice - sma50) / sma50) * 1000 : 0,
      momentumScore: (rsi14 - 50) * 2,
      volumeScore: totalVolume > 0 ? (obv / totalVolume) * 100 : 0,
      volatilityScore: currentPrice > 0 ? -((atr14 / currentPrice) * 1000) : 0,
      overallScore: sma20 > 0 ? (rsi14 - 50) * 0.5 + ((currentPrice - sma20) / sma20) * 500 + ((k - 50) * 0.5) : (rsi14 - 50) * 0.5 + ((k - 50) * 0.5),
    };
  }

  /**
   * SMC 分析
   */
  analyzeSMC(ohlcv: OHLCV[]): SMCAnalysis | null {
    if (!config.smc.enabled) return null;

    const rawOhlcv = ohlcv.map(o => [o.timestamp, o.open, o.high, o.low, o.close, o.volume]);
    this.smcAnalyzer.analyze(rawOhlcv);
    const stats = this.smcAnalyzer.getStats();

    return {
      bullishOBs: stats.bullishOBs,
      bearishOBs: stats.bearishOBs,
      fvgs: stats.fvgs,
      sweeps: stats.sweeps,
      bullishFVGs: [],
      bearishFVGs: [],
      orderBlocks: [],
    };
  }

  /**
   * 市场微观结构分析
   */
  analyzeMicrostructure(orderBook: MarketData['orderBook']): MicrostructureSignal | null {
    if (!orderBook) return null;

    const signal = this.marketMicro.generateSignal(orderBook.imbalance);
    return {
      score: signal.score,
      confidence: signal.confidence,
      direction: signal.score > 0 ? 'bullish' : signal.score < 0 ? 'bearish' : 'neutral',
    };
  }

  /**
   * AI 异常检测
   */
  detectAnomaly(ohlcv: OHLCV[]): AnomalyResult {
    const rawOhlcv = ohlcv.map(o => [o.timestamp, o.open, o.high, o.low, o.close, o.volume]);
    return this.ai.detectAnomaly(rawOhlcv);
  }

  /**
   * AI 风险预测
   */
  predictRisk(ohlcv: OHLCV[]): RiskForecast {
    const rawOhlcv = ohlcv.map(o => [o.timestamp, o.open, o.high, o.low, o.close, o.volume]);
    return this.ai.predictRisk(rawOhlcv);
  }

  /**
   * 获取完整数据层结果（优化版：并行处理 + 缓存 + 性能监控）
   */
  async gatherData(): Promise<DataLayerResult> {
    const totalStartTime = Date.now();
    const perf: PerformanceMetrics = {
      marketDataFetch: 0,
      indicatorCalc: 0,
      smcAnalysis: 0,
      microstructureAnalysis: 0,
      anomalyDetection: 0,
      riskPrediction: 0,
      totalDuration: 0,
    };

    // 背压控制检查
    this.updateBackpressure();
    const skipNonCritical = this.backpressureState.isOverloaded;

    if (skipNonCritical) {
      this.backpressureState.skippedNonCritical++;
      logger.warn(`[DataLayer] 背压控制：跳过非关键处理 (积压: ${this.backpressureState.pendingTasks})`);
    }

    // 1. 并行获取市场数据
    const marketDataStartTime = Date.now();
    const marketData = await this.fetchMarketData();
    perf.marketDataFetch = Date.now() - marketDataStartTime;

    // 2. 计算指标（带缓存）
    const indicatorStartTime = Date.now();
    const ohlcvHash = this.computeOhlcvHash(marketData.ohlcv);
    let indicators: Indicators;

    if (this.indicatorCache && this.indicatorCache.hash === ohlcvHash && 
        Date.now() - this.indicatorCache.timestamp < CACHE_TTL_MS) {
      // 使用缓存
      indicators = this.indicatorCache.indicators;
      metricsCollector.recordDataFetch('indicator_cache', 'success');
    } else {
      indicators = this.calculateIndicators(marketData.ohlcv);
      this.indicatorCache = {
        hash: ohlcvHash,
        indicators,
        timestamp: Date.now(),
      };
    }
    perf.indicatorCalc = Date.now() - indicatorStartTime;

    // 3. 并行执行分析任务
    const analysisStartTime = Date.now();
    
    // 关键分析任务：始终执行
    const criticalTasks = Promise.all([
      // SMC 分析
      (async () => {
        const start = Date.now();
        const result = this.analyzeSMC(marketData.ohlcv);
        return { result, duration: Date.now() - start };
      })(),
      // 微观结构分析
      (async () => {
        const start = Date.now();
        const result = this.analyzeMicrostructure(marketData.orderBook);
        return { result, duration: Date.now() - start };
      })(),
    ]);

    // 非关键分析任务：背压时跳过
    let anomaly: AnomalyResult | null = null;
    let riskForecast: RiskForecast | null = null;
    let anomalyDuration = 0;
    let riskDuration = 0;

    if (!skipNonCritical) {
      const nonCriticalTasks = Promise.all([
        // 异常检测
        (async () => {
          const start = Date.now();
          const result = this.detectAnomaly(marketData.ohlcv);
          return { result, duration: Date.now() - start };
        })(),
        // 风险预测
        (async () => {
          const start = Date.now();
          const result = this.predictRisk(marketData.ohlcv);
          return { result, duration: Date.now() - start };
        })(),
      ]);

      const [anomalyRes, riskRes] = await nonCriticalTasks;
      anomaly = anomalyRes.result;
      riskForecast = riskRes.result;
      anomalyDuration = anomalyRes.duration;
      riskDuration = riskRes.duration;
    }

    // 等待关键任务完成
    const [smcRes, microRes] = await criticalTasks;
    const smcAnalysis = smcRes.result;
    const microSignal = microRes.result;

    perf.smcAnalysis = smcRes.duration;
    perf.microstructureAnalysis = microRes.duration;
    perf.anomalyDetection = anomalyDuration;
    perf.riskPrediction = riskDuration;
    perf.totalDuration = Date.now() - totalStartTime;

    // 记录性能指标到 Prometheus
    metricsCollector.recordDataFetch('gather_data_total', 'success');
    if (perf.totalDuration > 100) {
      logger.warn(`[DataLayer] 数据获取耗时超过100ms: ${perf.totalDuration}ms`, perf);
    }

    return {
      marketData,
      indicators,
      smcAnalysis,
      microSignal,
      anomaly,
      riskForecast,
      performance: perf,
    };
  }

  /**
   * 计算 OHLCV 数据哈希（用于缓存键）
   */
  private computeOhlcvHash(ohlcv: OHLCV[]): string {
    if (ohlcv.length === 0) return '';
    const lastCandle = ohlcv[ohlcv.length - 1];
    if (!lastCandle) return '';
    // 使用最后一根K线的时间戳和收盘价作为哈希
    return `${lastCandle.timestamp}-${lastCandle.close.toFixed(2)}-${ohlcv.length}`;
  }

  /**
   * 更新背压控制状态
   */
  private updateBackpressure(): void {
    const now = Date.now();
    
    // 增加待处理任务计数
    this.backpressureState.pendingTasks++;
    
    // 检查是否过载
    if (this.backpressureState.pendingTasks > BACKPRESSURE_THRESHOLD) {
      this.backpressureState.isOverloaded = true;
    }
    
    // 冷却期后重置
    if (now - this.backpressureState.lastProcessTime > BACKPRESSURE_COOLDOWN_MS) {
      this.backpressureState.pendingTasks = Math.max(0, this.backpressureState.pendingTasks - 1);
      if (this.backpressureState.pendingTasks <= BACKPRESSURE_THRESHOLD / 2) {
        this.backpressureState.isOverloaded = false;
      }
    }
    
    this.backpressureState.lastProcessTime = now;
  }

  /**
   * 获取背压控制状态
   */
  getBackpressureState(): BackpressureState {
    return { ...this.backpressureState };
  }

  /**
   * 清除指标缓存
   */
  clearCache(): void {
    this.indicatorCache = null;
    this.lastOhlcvHash = '';
  }

  /**
   * 格式化 OHLCV 数据
   */
  private formatOHLCV(raw: number[][]): OHLCV[] {
    return raw.map(c => ({
      timestamp: c[0] ?? 0,
      open: c[1] ?? 0,
      high: c[2] ?? 0,
      low: c[3] ?? 0,
      close: c[4] ?? 0,
      volume: c[5] ?? 0,
    }));
  }

  /**
   * 获取 SMC 分析器（用于标记测试）
   */
  getSMCAnalyzer(): SMCAnalyzer {
    return this.smcAnalyzer;
  }
}

export default DataLayer;
