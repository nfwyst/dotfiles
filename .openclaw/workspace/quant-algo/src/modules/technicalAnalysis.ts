/**
 * 1. 传统技术分析模块 (OCS 2.0 增强版)
 * 职责: 接收K线数据，计算各时间框架技术指标
 * 产出: 标准化技术指标对象 + 微观结构特征
 */

import { MicrostructureFeatures, microstructureExtractor } from './microstructure';
import { OHLCV } from '../events/types';
export type { OHLCV } from '../events/types';
import { computeRSI } from '../indicators/rsi';

export interface TechnicalIndicators {
  timestamp: number;
  timeframe: string;
  symbol: string;
  
  // 价格数据
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  
  // 移动平均线
  sma: { 5: number; 10: number; 20: number; 50: number; 200: number };
  ema: { 12: number; 26: number; 50: number };
  
  // 趋势指标
  adx: number;
  diPlus: number;
  diMinus: number;
  supertrend: { direction: 'up' | 'down'; value: number };
  
  // 动量指标
  rsi: { 6: number; 14: number; 24: number };
  macd: { line: number; signal: number; histogram: number };
  stochastic: { k: number; d: number };
  cci: number;
  williamsR: number;
  
  // 波动指标
  atr: { 14: number; 20: number };
  bollinger: { upper: number; middle: number; lower: number; bandwidth: number; percentB: number };
  keltner: { upper: number; middle: number; lower: number };
  
  // 量能指标
  obv: number;
  vwap: number;
  volumeSma: { 10: number; 20: number };
  volumeRatio: number;
  
  // 微观结构特征 (OCS 2.0 新增)
  microstructure: {
    buyingPressure: number;      // 买卖压力 -1 ~ 1
    volumeImbalance: number;     // 成交量不平衡 -1 ~ 1
    volatilityClustering: number; // 波动率聚集 0 ~ 1
    priceImpact: number;         // 价格冲击 0 ~ 1
    flowToxicity: number;        // 订单流毒性 0 ~ 1
    effectiveSpread: number;     // 有效价差
  };
  
  // 综合评分 (-100 到 100)
  scores: {
    trend: number;
    momentum: number;
    volatility: number;
    volume: number;
    overall: number;
  };
  
  // 信号标记
  signals: {
    goldenCross: boolean;    // 金叉
    deathCross: boolean;     // 死叉
    overbought: boolean;     // 超买
    oversold: boolean;       // 超卖
    trendReversal: 'up' | 'down' | null;
  };
}

export class TechnicalAnalysisModule {
  private data: Map<string, OHLCV[]> = new Map();
  private timeframes: string[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
  
  /**
   * 添加K线数据
   */
  addCandle(timeframe: string, candle: OHLCV) {
    if (!this.data.has(timeframe)) {
      this.data.set(timeframe, []);
    }
    const candles = this.data.get(timeframe)!;
    candles.push(candle);
    
    // 保持最多500根
    if (candles.length > 500) {
      candles.shift();
    }
  }
  
  /**
   * 批量添加历史数据
   */
  addHistory(timeframe: string, candles: OHLCV[]) {
    this.data.set(timeframe, candles.slice(-500));
  }
  
  /**
   * 获取指定时间框架的技术指标
   */
  getIndicators(timeframe: string): TechnicalIndicators | null {
    const candles = this.data.get(timeframe);
    if (!candles || candles.length < 50) return null;
    
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    
    const current = candles[candles.length - 1];
    if (!current) return null;
    const prev24hIdx = Math.max(0, candles.length - 289);
    const prev24h = candles[prev24hIdx];
    if (!prev24h) return null; // 约24小时前 (5m周期)
    
    return {
      timestamp: current.timestamp,
      timeframe,
      symbol: 'ETHUSDT',
      
      currentPrice: current.close,
      priceChange24h: current.close - prev24h.close,
      priceChangePercent24h: ((current.close - prev24h.close) / prev24h.close) * 100,
      
      sma: {
        5: this.sma(closes, 5),
        10: this.sma(closes, 10),
        20: this.sma(closes, 20),
        50: this.sma(closes, 50),
        200: this.sma(closes, 200),
      },
      
      ema: {
        12: this.ema(closes, 12),
        26: this.ema(closes, 26),
        50: this.ema(closes, 50),
      },
      
      adx: this.adx(highs, lows, closes, 14),
      diPlus: this.diPlus(highs, lows, closes, 14),
      diMinus: this.diMinus(highs, lows, closes, 14),
      supertrend: this.supertrend(highs, lows, closes, 10, 3),
      
      rsi: {
        6: this.rsi(closes, 6),
        14: this.rsi(closes, 14),
        24: this.rsi(closes, 24),
      },
      
      macd: this.macd(closes, 12, 26, 9),
      stochastic: this.stochastic(closes, highs, lows, 14, 3),
      cci: this.cci(highs, lows, closes, 20),
      williamsR: this.williamsR(highs, lows, closes, 14),
      
      atr: {
        14: this.atr(highs, lows, closes, 14),
        20: this.atr(highs, lows, closes, 20),
      },
      
      bollinger: this.bollinger(closes, 20, 2),
      keltner: this.keltner(highs, lows, closes, 20, 2),
      
      obv: this.obv(closes, volumes),
      vwap: this.vwap(candles),
      volumeSma: {
        10: this.sma(volumes, 10),
        20: this.sma(volumes, 20),
      },
      volumeRatio: current.volume / this.sma(volumes, 20),
      
      // 微观结构特征 (OCS 2.0 新增)
      microstructure: microstructureExtractor.extract(candles),
      
      scores: this.calculateScores(closes, highs, lows, volumes),
      
      signals: this.detectSignals(closes, highs, lows),
    };
  }
  
  /**
   * 获取多时间框架指标
   */
  getMultiTimeframeIndicators(): Record<string, TechnicalIndicators | null> {
    const result: Record<string, TechnicalIndicators | null> = {};
    for (const tf of this.timeframes) {
      result[tf] = this.getIndicators(tf);
    }
    return result;
  }
  
  // ========== 私有计算方法 ==========
  
  private sma(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1]! || 0;
    const sum = data.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }
  
  private ema(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1]! || 0;
    const multiplier = 2 / (period + 1);
    let ema = this.sma(data.slice(0, period), period);
    for (let i = period; i < data.length; i++) {
      ema = (data[i]! - ema) * multiplier + ema;
    }
    return ema;
  }
  
  /** @see computeRSI from indicators/rsi — delegates to canonical impl */
  private rsi(data: number[], period: number): number {
    return computeRSI(data, period);
  }
  
  /**
   * BUG 14 FIX: MACD with proper EMA(signal) of the MACD line series.
   * Previously: signal = line * 0.9 (constant ratio, not a real signal line).
   * Now: Compute EMA(fast) and EMA(slow) for every bar to build a MACD line series,
   *      then compute EMA(signal period) of that MACD line series.
   */
  private macd(data: number[], fast: number, slow: number, signalPeriod: number) {
    if (data.length < slow) {
      return { line: 0, signal: 0, histogram: 0 };
    }

    // Build full EMA series for fast and slow
    const fastMultiplier = 2 / (fast + 1);
    const slowMultiplier = 2 / (slow + 1);

    // Seed fast EMA with SMA of first `fast` bars
    let emaFast = 0;
    for (let i = 0; i < fast; i++) emaFast += data[i]!;
    emaFast /= fast;

    // Seed slow EMA with SMA of first `slow` bars
    let emaSlow = 0;
    for (let i = 0; i < slow; i++) emaSlow += data[i]!;
    emaSlow /= slow;

    // We only have meaningful MACD values starting at index `slow - 1`.
    // Build the MACD line series from index `slow` onward (fast EMA must
    // also be updated through those bars).

    // Re-seed fast EMA properly: run it from bar 0 to bar slow-1
    emaFast = 0;
    for (let i = 0; i < fast; i++) emaFast += data[i]!;
    emaFast /= fast;
    for (let i = fast; i < slow; i++) {
      emaFast = (data[i]! - emaFast) * fastMultiplier + emaFast;
    }

    // Now both EMAs are positioned at bar slow-1
    // macdLine series collects values from bar slow-1 onward
    const macdLineSeries: number[] = [];
    macdLineSeries.push(emaFast - emaSlow);

    for (let i = slow; i < data.length; i++) {
      emaFast = (data[i]! - emaFast) * fastMultiplier + emaFast;
      emaSlow = (data[i]! - emaSlow) * slowMultiplier + emaSlow;
      macdLineSeries.push(emaFast - emaSlow);
    }

    // Compute signal line as EMA(signalPeriod) of the macdLineSeries
    const currentLine = macdLineSeries[macdLineSeries.length - 1]!;

    if (macdLineSeries.length < signalPeriod) {
      // Not enough MACD values for signal EMA; use SMA as approximation
      const avg = macdLineSeries.reduce((a, b) => a + b, 0) / macdLineSeries.length;
      return { line: currentLine, signal: avg, histogram: currentLine - avg };
    }

    // Seed signal EMA with SMA of first signalPeriod MACD values
    let signalEma = 0;
    for (let i = 0; i < signalPeriod; i++) signalEma += macdLineSeries[i]!;
    signalEma /= signalPeriod;

    const signalMultiplier = 2 / (signalPeriod + 1);
    for (let i = signalPeriod; i < macdLineSeries.length; i++) {
      signalEma = (macdLineSeries[i]! - signalEma) * signalMultiplier + signalEma;
    }

    return { line: currentLine, signal: signalEma, histogram: currentLine - signalEma };
  }
  
  /**
   * BUG 15 FIX: Stochastic with proper %D as SMA(dPeriod) of recent %K values.
   * Previously: %D = SMA of a single-element array [k], which always equals k.
   * Now: Compute %K for each of the last dPeriod bars, then %D = SMA of those %K values.
   */
  private stochastic(closes: number[], highs: number[], lows: number[], kPeriod: number, dPeriod: number) {
    if (closes.length < kPeriod) return { k: 50, d: 50 };

    // Compute %K for the last dPeriod bars (or as many as available)
    const kValues: number[] = [];
    const barsAvailable = Math.min(dPeriod, closes.length - kPeriod + 1);
    
    for (let offset = barsAvailable - 1; offset >= 0; offset--) {
      // For bar at index (closes.length - 1 - offset)
      const endIdx = closes.length - offset;
      const startIdx = endIdx - kPeriod;
      
      const periodLows = lows.slice(startIdx, endIdx);
      const periodHighs = highs.slice(startIdx, endIdx);
      
      const lowestLow = Math.min(...periodLows);
      const highestHigh = Math.max(...periodHighs);
      const closeVal = closes[endIdx - 1]!;
      
      const kVal = highestHigh === lowestLow ? 50 : ((closeVal - lowestLow) / (highestHigh - lowestLow)) * 100;
      kValues.push(kVal);
    }

    const k = kValues[kValues.length - 1]!; // most recent %K
    const d = kValues.reduce((a, b) => a + b, 0) / kValues.length; // SMA of %K values

    return { k, d };
  }
  
  private cci(highs: number[], lows: number[], closes: number[], period: number) {
    if (closes.length < period) return 0;
    const tp = closes.map((c, i) => (highs[i]! + lows[i]! + c) / 3);
    const smaTP = this.sma(tp, period);
    const md = tp.slice(-period).reduce((sum, x) => sum + Math.abs(x - smaTP), 0) / period;
    return md === 0 ? 0 : (tp[tp.length - 1]! - smaTP) / (0.015 * md);
  }
  
  private williamsR(highs: number[], lows: number[], closes: number[], period: number) {
    if (closes.length < period) return -50;
    const high = Math.max(...highs.slice(-period));
    const low = Math.min(...lows.slice(-period));
    const close = closes[closes.length - 1]!;
    return high === low ? -50 : ((high - close) / (high - low)) * -100;
  }
  
  private atr(highs: number[], lows: number[], closes: number[], period: number) {
    if (closes.length < period + 1) return 0;
    let sum = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const tr = Math.max(
        highs[i]! - lows[i]!,
        Math.abs(highs[i]! - closes[i - 1]!),
        Math.abs(lows[i]! - closes[i - 1]!)
      );
      sum += tr;
    }
    return sum / period;
  }
  
  private bollinger(data: number[], period: number, stdDev: number) {
    const middle = this.sma(data, period);
    if (data.length < period) {
      return { upper: middle, middle, lower: middle, bandwidth: 0, percentB: 0.5 };
    }
    const variance = data.slice(-period).reduce((sum, x) => sum + Math.pow(x - middle, 2), 0) / period;
    const std = Math.sqrt(variance);
    const upper = middle + stdDev * std;
    const lower = middle - stdDev * std;
    const bandwidth = ((upper - lower) / middle) * 100;
    const close = data[data.length - 1]!;
    const percentB = (close - lower) / (upper - lower);
    return { upper, middle, lower, bandwidth, percentB };
  }
  
  private keltner(highs: number[], lows: number[], closes: number[], period: number, multiplier: number) {
    const middle = this.ema(closes, period);
    const atr = this.atr(highs, lows, closes, period);
    return { upper: middle + multiplier * atr, middle, lower: middle - multiplier * atr };
  }
  
  /**
   * BUG 13 FIX: Real ADX calculation using Wilder's method.
   * Previously: hardcoded `return 25`.
   * Now: Computes True Range, +DM/-DM, Wilder-smoothed DI+/DI-/DX, and ADX.
   *
   * Returns { adxValue, diPlusValue, diMinusValue } for internal use.
   * The public-facing adx/diPlus/diMinus methods delegate to this.
   */
  private computeDirectionalMovement(highs: number[], lows: number[], closes: number[], period: number): { adxValue: number; diPlusValue: number; diMinusValue: number } {
    const len = highs.length;
    // Need at least 2*period bars for a meaningful ADX
    if (len < period * 2) {
      return { adxValue: 25, diPlusValue: 20, diMinusValue: 20 };
    }

    // Step 1: Compute True Range, +DM, -DM for each bar starting at index 1
    const trArray: number[] = [];
    const plusDMArray: number[] = [];
    const minusDMArray: number[] = [];

    for (let i = 1; i < len; i++) {
      const tr = Math.max(
        highs[i]! - lows[i]!,
        Math.abs(highs[i]! - closes[i - 1]!),
        Math.abs(lows[i]! - closes[i - 1]!)
      );
      trArray.push(tr);

      const upMove = highs[i]! - highs[i - 1]!;
      const downMove = lows[i - 1]! - lows[i]!;

      plusDMArray.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDMArray.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    // Step 2: Wilder smoothing — first value is sum of first `period` values
    // then subsequent values use: smoothed = prev - (prev / period) + current
    const wilderSmooth = (values: number[], p: number): number[] => {
      const result: number[] = [];
      let sum = 0;
      for (let i = 0; i < p; i++) sum += values[i]!;
      result.push(sum);
      for (let i = p; i < values.length; i++) {
        const smoothed = result[result.length - 1]! - result[result.length - 1]! / p + values[i]!;
        result.push(smoothed);
      }
      return result;
    };

    const smoothTR = wilderSmooth(trArray, period);
    const smoothPlusDM = wilderSmooth(plusDMArray, period);
    const smoothMinusDM = wilderSmooth(minusDMArray, period);

    // Step 3: Compute DI+ and DI- series, then DX
    const dxArray: number[] = [];
    let latestDIPlus = 0;
    let latestDIMinus = 0;

    for (let i = 0; i < smoothTR.length; i++) {
      const diP = smoothTR[i]! === 0 ? 0 : (smoothPlusDM[i]! / smoothTR[i]!) * 100;
      const diM = smoothTR[i]! === 0 ? 0 : (smoothMinusDM[i]! / smoothTR[i]!) * 100;
      const diSum = diP + diM;
      const dx = diSum === 0 ? 0 : (Math.abs(diP - diM) / diSum) * 100;
      dxArray.push(dx);
      latestDIPlus = diP;
      latestDIMinus = diM;
    }

    // Step 4: ADX = Wilder-smoothed DX over `period`
    if (dxArray.length < period) {
      // Not enough DX values — return latest DI values with approximate ADX
      const avgDx = dxArray.reduce((a, b) => a + b, 0) / dxArray.length;
      return { adxValue: avgDx, diPlusValue: latestDIPlus, diMinusValue: latestDIMinus };
    }

    // First ADX = SMA of first `period` DX values
    let adx = 0;
    for (let i = 0; i < period; i++) adx += dxArray[i]!;
    adx /= period;

    // Subsequent ADX values use Wilder smoothing
    for (let i = period; i < dxArray.length; i++) {
      adx = (adx * (period - 1) + dxArray[i]!) / period;
    }

    return { adxValue: adx, diPlusValue: latestDIPlus, diMinusValue: latestDIMinus };
  }

  private adx(highs: number[], lows: number[], closes: number[], period: number): number {
    return this.computeDirectionalMovement(highs, lows, closes, period).adxValue;
  }
  
  private diPlus(highs: number[], lows: number[], closes: number[], period: number): number {
    return this.computeDirectionalMovement(highs, lows, closes, period).diPlusValue;
  }
  
  private diMinus(highs: number[], lows: number[], closes: number[], period: number): number {
    return this.computeDirectionalMovement(highs, lows, closes, period).diMinusValue;
  }
  
  private supertrend(highs: number[], lows: number[], closes: number[], period: number, multiplier: number) {
    const atr = this.atr(highs, lows, closes, period);
    const close = closes[closes.length - 1]!;
    const sma = this.sma(closes, period);
    const direction: 'up' | 'down' = close > sma ? 'up' : 'down';
    return { direction, value: close > sma ? close - multiplier * atr : close + multiplier * atr };
  }
  
  private obv(closes: number[], volumes: number[]) {
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i]! > closes[i - 1]!) obv += volumes[i]!;
      else if (closes[i]! < closes[i - 1]!) obv -= volumes[i]!;
    }
    return obv;
  }
  
  private vwap(candles: OHLCV[]) {
    let sumPV = 0, sumV = 0;
    for (const c of candles) {
      const tp = (c.high + c.low + c.close) / 3;
      sumPV += tp * c.volume;
      sumV += c.volume;
    }
    return sumV === 0 ? candles[candles.length - 1]?.close || 0 : sumPV / sumV;
  }
  
  private calculateScores(closes: number[], highs: number[], lows: number[], volumes: number[]) {
    const current = closes[closes.length - 1]!;
    const sma20 = this.sma(closes, 20);
    const sma50 = this.sma(closes, 50);
    const rsi14 = this.rsi(closes, 14);
    const macd = this.macd(closes, 12, 26, 9);
    
    // 趋势评分
    let trend = 0;
    if (current > sma20) trend += 25;
    if (current > sma50) trend += 25;
    if (sma20 > sma50) trend += 25;
    if (macd.histogram > 0) trend += 25;
    trend = (trend - 50) * 2; // 归一化到-100到100
    
    // 动量评分
    let momentum = 0;
    if (rsi14 > 50) momentum += 33;
    if (macd.line > 0) momentum += 33;
    if (macd.histogram > 0) momentum += 34;
    momentum = (momentum - 50) * 2;
    
    // 波动评分
    const atr = this.atr(highs, lows, closes, 14);
    const atrPercent = (atr / current) * 100;
    let volatility = 0;
    if (atrPercent > 3 && atrPercent < 6) volatility = 50;
    else if (atrPercent > 6) volatility = -30;
    else if (atrPercent < 2) volatility = -50;
    
    // 量能评分
    const volSma20 = this.sma(volumes, 20);
    const currentVol = volumes[volumes.length - 1]!;
    let volume = 0;
    if (currentVol > volSma20 * 1.5) volume = 50;
    else if (currentVol < volSma20 * 0.5) volume = -50;
    
    const overall = Math.round((trend + momentum + volatility + volume) / 4);
    
    return { trend: Math.round(trend), momentum: Math.round(momentum), volatility: Math.round(volatility), volume: Math.round(volume), overall };
  }
  
  private detectSignals(closes: number[], highs: number[], lows: number[]) {
    const sma50 = this.sma(closes, 50);
    const sma200 = this.sma(closes, 200);
    const rsi14 = this.rsi(closes, 14);
    
    return {
      goldenCross: sma50 > sma200 && this.sma(closes.slice(0, -1), 50) <= this.sma(closes.slice(0, -1), 200),
      deathCross: sma50 < sma200 && this.sma(closes.slice(0, -1), 50) >= this.sma(closes.slice(0, -1), 200),
      overbought: rsi14 > 70,
      oversold: rsi14 < 30,
      trendReversal: null,
    };
  }
}

export default TechnicalAnalysisModule;
