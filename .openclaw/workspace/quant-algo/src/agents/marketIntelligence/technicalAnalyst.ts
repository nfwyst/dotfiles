/**
 * Technical Analyst Agent
 * 细粒度任务分解版本 - 基于 Expert Teams 论文
 * 
 * 核心改进：将"分析市场"分解为具体的分析任务
 */

import {
  AnalystAgent,
  AnalysisContext,
  AgentOutput,
  AgentStatus,
  TechnicalReport,
  TrendAnalysis,
  MomentumAnalysis,
  VolatilityAnalysis,
  VolumeAnalysis,
  SupportResistanceLevel,
  MicrostructureAnalysis,
  OHLCV,
  TECHNICAL_ANALYST_VERSION,
} from './types';

import { TechnicalIndicators } from '../../modules/technicalAnalysis';
import { computeRSI } from '../../indicators/rsi';

export class TechnicalAnalystAgent implements AnalystAgent {
  readonly name = 'TechnicalAnalyst';
  readonly version = TECHNICAL_ANALYST_VERSION;
  
  private lastRun: number = 0;
  private errorCount: number = 0;
  private processingTimes: number[] = [];
  
  // 配置
  private config = {
    rsiPeriod: 14,
    rsiPeriodShort: 7,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrPeriod: 14,
    bollingerPeriod: 20,
    bollingerStdDev: 2,
    volumeMAPeriod: 20,
    supportResistanceLookback: 50,
  };
  
  /**
   * 主分析方法 - 细粒度任务分解
   */
  async analyze(context: AnalysisContext): Promise<AgentOutput> {
    const startTime = Date.now();
    
    try {
      const { ohlcv, currentPrice } = context;
      
      if (ohlcv.length < 50) {
        return {
          success: false,
          error: 'Insufficient data: need at least 50 candles',
          processingTimeMs: Date.now() - startTime,
        };
      }
      
      // 计算技术指标
      const indicators = this.calculateIndicators(ohlcv);
      
      // 细粒度任务 1: 趋势分析
      const trend = this.analyzeTrend(ohlcv, indicators);
      
      // 细粒度任务 2: 动量分析
      const momentum = this.analyzeMomentum(indicators);
      
      // 细粒度任务 3: 波动率分析
      const volatility = this.analyzeVolatility(ohlcv, indicators, currentPrice);
      
      // 细粒度任务 4: 成交量分析
      const volume = this.analyzeVolume(ohlcv, indicators);
      
      // 细粒度任务 5: 支撑阻力分析
      const supportResistance = this.analyzeSupportResistance(ohlcv, currentPrice);
      
      // 细粒度任务 6: 微观结构分析 (可选)
      const microstructure = context.additionalData?.trades 
        ? this.analyzeMicrostructure(context.additionalData.trades, currentPrice)
        : undefined;
      
      // 计算综合评分
      const compositeScores = this.calculateCompositeScores(
        trend,
        momentum,
        volatility,
        volume
      );
      
      const report: TechnicalReport = {
        timestamp: Date.now(),
        currentPrice,
        trend,
        momentum,
        volatility,
        volume,
        supportResistance,
        microstructure,
        compositeScores,
        agentMetadata: {
          agentName: 'TechnicalAnalyst',
          version: this.version,
          processingTimeMs: Date.now() - startTime,
          dataPoints: ohlcv.length,
        },
      };
      
      this.lastRun = Date.now();
      this.processingTimes.push(Date.now() - startTime);
      if (this.processingTimes.length > 100) {
        this.processingTimes.shift();
      }
      
      return {
        success: true,
        data: report,
        processingTimeMs: Date.now() - startTime,
      };
      
    } catch (error: any) {
      this.errorCount++;
      return {
        success: false,
        error: error.message,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
  
  /**
   * 细粒度任务 1: 趋势分析
   * 专注于识别趋势方向和强度
   */
  private analyzeTrend(ohlcv: OHLCV[], indicators: any): TrendAnalysis {
    const closes = ohlcv.map(c => c.close);
    const currentPrice = closes[closes.length - 1];
    
    // 计算趋势指标
    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, 50);
    const sma200 = this.calculateSMA(closes, Math.min(200, closes.length));
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    
    // ADX 趋势强度
    const adx = indicators.adx || 25;
    const plusDI = indicators.plusDI || 20;
    const minusDI = indicators.minusDI || 20;
    
    // 趋势方向判定
    let direction: 'up' | 'down' | 'sideways' = 'sideways';
    let strength = 50;
    const reasoning: string[] = [];
    
    // 多均线判断
    const priceAboveSMA20 = currentPrice > sma20;
    const priceAboveSMA50 = currentPrice > sma50;
    const sma20AboveSMA50 = sma20 > sma50;
    const ema12AboveEma26 = ema12 > ema26;
    
    // 综合方向判定
    const bullishSignals = [
      priceAboveSMA20,
      priceAboveSMA50,
      sma20AboveSMA50,
      ema12AboveEma26,
      plusDI > minusDI,
    ].filter(Boolean).length;
    
    const bearishSignals = [
      !priceAboveSMA20,
      !priceAboveSMA50,
      !sma20AboveSMA50,
      !ema12AboveEma26,
      minusDI > plusDI,
    ].filter(Boolean).length;
    
    if (bullishSignals >= 4) {
      direction = 'up';
      strength = 60 + bullishSignals * 5;
      reasoning.push(`多头信号占优 (${bullishSignals}/5)`);
      reasoning.push(`价格位于 SMA20(${sma20.toFixed(2)}) 和 SMA50(${sma50.toFixed(2)}) 之上`);
    } else if (bearishSignals >= 4) {
      direction = 'down';
      strength = 60 + bearishSignals * 5;
      reasoning.push(`空头信号占优 (${bearishSignals}/5)`);
      reasoning.push(`价格位于 SMA20(${sma20.toFixed(2)}) 和 SMA50(${sma50.toFixed(2)}) 之下`);
    } else {
      direction = 'sideways';
      strength = 30 + Math.abs(bullishSignals - bearishSignals) * 10;
      reasoning.push(`多空信号均衡 (${bullishSignals} vs ${bearishSignals})`);
    }
    
    // ADX 调整趋势强度
    if (adx > 40) {
      strength = Math.min(100, strength + 15);
      reasoning.push(`ADX=${adx.toFixed(1)} 趋势强劲`);
    } else if (adx < 20) {
      strength = Math.max(10, strength - 15);
      reasoning.push(`ADX=${adx.toFixed(1)} 趋势疲弱`);
    }
    
    // 持续性评估
    let persistence: 'strong' | 'moderate' | 'weak' = 'moderate';
    if (adx > 35 && strength > 70) {
      persistence = 'strong';
    } else if (adx < 25 || strength < 40) {
      persistence = 'weak';
    }
    
    // 反转风险评估
    const reversalRisk = this.assessReversalRisk(indicators, direction);
    
    return {
      direction,
      strength: Math.min(100, Math.max(0, strength)),
      persistence,
      reversalRisk,
      timeframe: '5m',
      reasoning,
    };
  }
  
  /**
   * 细粒度任务 2: 动量分析
   * 专注于超买超卖和动量方向
   */
  private analyzeMomentum(indicators: any): MomentumAnalysis {
    const rsi = indicators.rsi14 || 50;
    const rsi7 = indicators.rsi7 || 50;
    const macdHistogram = indicators.macdHistogram || 0;
    const macdSignal = indicators.macdSignal || 0;
    const stochK = indicators.stochasticK || 50;
    const stochD = indicators.stochasticD || 50;
    const cci = indicators.cci || 0;
    const williamsR = indicators.williamsR || -50;
    
    // RSI 信号
    let rsiSignal: 'oversold' | 'overbought' | 'neutral' = 'neutral';
    if (rsi < 30) {
      rsiSignal = 'oversold';
    } else if (rsi > 70) {
      rsiSignal = 'overbought';
    }
    
    // RSI 背离检测
    const rsiDivergence = this.detectRSIDivergence(indicators);
    
    // MACD 信号
    let macdSignalType: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (macdHistogram > 0) {
      macdSignalType = 'bullish';
    } else if (macdHistogram < 0) {
      macdSignalType = 'bearish';
    }
    
    // MACD 交叉检测
    const macdCrossover = Math.abs(macdHistogram) < 0.1;
    
    // 随机指标信号
    let stochSignal: 'oversold' | 'overbought' | 'neutral' = 'neutral';
    if (stochK < 20 && stochD < 20) {
      stochSignal = 'oversold';
    } else if (stochK > 80 && stochD > 80) {
      stochSignal = 'overbought';
    }
    
    return {
      rsi: {
        value: rsi,
        signal: rsiSignal,
        divergence: rsiDivergence,
      },
      macd: {
        histogram: macdHistogram,
        signal: macdSignalType,
        crossover: macdCrossover,
      },
      stochastic: {
        k: stochK,
        d: stochD,
        signal: stochSignal,
      },
      cci,
      williamsR,
    };
  }
  
  /**
   * 细粒度任务 3: 波动率分析
   * 专注于市场波动状态
   */
  private analyzeVolatility(
    ohlcv: OHLCV[],
    indicators: any,
    currentPrice: number
  ): VolatilityAnalysis {
    const atr = indicators.atr14 || 0;
    const atrPercent = (atr / currentPrice) * 100;
    
    // 布林带
    const bollingerUpper = indicators.bollingerUpper || currentPrice;
    const bollingerMiddle = indicators.bollingerMiddle || currentPrice;
    const bollingerLower = indicators.bollingerLower || currentPrice;
    const bollingerBandwidth = indicators.bollingerBandwidth || 0.02;
    
    // 布林带位置
    let bollingerPosition: 'upper' | 'middle' | 'lower' | 'outside' = 'middle';
    const upperRange = (bollingerUpper - bollingerMiddle) / 2;
    const lowerRange = (bollingerMiddle - bollingerLower) / 2;
    
    if (currentPrice > bollingerUpper) {
      bollingerPosition = 'outside';
    } else if (currentPrice > bollingerMiddle + upperRange * 0.5) {
      bollingerPosition = 'upper';
    } else if (currentPrice < bollingerLower) {
      bollingerPosition = 'outside';
    } else if (currentPrice < bollingerMiddle - lowerRange * 0.5) {
      bollingerPosition = 'lower';
    }
    
    // 布林带收窄检测 (squeeze)
    const squeeze = bollingerBandwidth < 0.01;
    
    // Keltner 通道
    const keltnerUpper = indicators.keltnerUpper || currentPrice;
    const keltnerLower = indicators.keltnerLower || currentPrice;
    
    let keltnerPosition: 'upper' | 'middle' | 'lower' = 'middle';
    if (currentPrice > (keltnerUpper + currentPrice) / 2) {
      keltnerPosition = 'upper';
    } else if (currentPrice < (keltnerLower + currentPrice) / 2) {
      keltnerPosition = 'lower';
    }
    
    return {
      atr,
      atrPercent,
      bollingerPosition,
      bollingerBandwidth,
      squeeze,
      keltnerPosition,
    };
  }
  
  /**
   * 细粒度任务 4: 成交量分析
   * 专注于成交量动能和资金流向
   */
  private analyzeVolume(ohlcv: OHLCV[], indicators: any): VolumeAnalysis {
    const volumes = ohlcv.map(c => c.volume);
    const currentVolume = volumes[volumes.length - 1];
    const volumeSMA20 = indicators.volumeSMA20 || currentVolume;
    const volumeRatio = currentVolume / volumeSMA20;
    
    // OBV
    const obv = this.calculateOBV(ohlcv);
    const obvSMA = this.calculateSMA(ohlcv.slice(-20).map(c => c.volume), 20);
    
    let obvTrend: 'up' | 'down' | 'flat' = 'flat';
    if (obv > obvSMA * 1.02) {
      obvTrend = 'up';
    } else if (obv < obvSMA * 0.98) {
      obvTrend = 'down';
    }
    
    // MFI 和 CMF
    const mfi = indicators.mfi || 50;
    const cmf = indicators.cmf || 0;
    
    // 异常成交量
    const unusualVolume = volumeRatio > 2 || volumeRatio < 0.5;
    
    return {
      obv,
      obvTrend,
      volumeSMA20,
      volumeRatio,
      mfi,
      cmf,
      unusualVolume,
    };
  }
  
  /**
   * 细粒度任务 5: 支撑阻力分析
   * 识别关键价格水平
   */
  private analyzeSupportResistance(
    ohlcv: OHLCV[],
    currentPrice: number
  ): {
    levels: SupportResistanceLevel[];
    nearestSupport: number;
    nearestResistance: number;
  } {
    const lookback = Math.min(this.config.supportResistanceLookback, ohlcv.length);
    const recentOHLCV = ohlcv.slice(-lookback);
    
    // 寻找摆动高低点
    const levels: SupportResistanceLevel[] = [];
    
    for (let i = 2; i < recentOHLCV.length - 2; i++) {
      const candle = recentOHLCV[i];
      const prev1 = recentOHLCV[i - 1];
      const prev2 = recentOHLCV[i - 2];
      const next1 = recentOHLCV[i + 1];
      const next2 = recentOHLCV[i + 2];
      
      // 摆动高点 (阻力)
      if (
        candle.high > prev1.high &&
        candle.high > prev2.high &&
        candle.high > next1.high &&
        candle.high > next2.high
      ) {
        levels.push({
          price: candle.high,
          strength: this.calculateLevelStrength(candle.high, ohlcv),
          type: 'resistance',
          touches: this.countTouches(candle.high, ohlcv),
          lastTouch: candle.timestamp,
        });
      }
      
      // 摆动低点 (支撑)
      if (
        candle.low < prev1.low &&
        candle.low < prev2.low &&
        candle.low < next1.low &&
        candle.low < next2.low
      ) {
        levels.push({
          price: candle.low,
          strength: this.calculateLevelStrength(candle.low, ohlcv),
          type: 'support',
          touches: this.countTouches(candle.low, ohlcv),
          lastTouch: candle.timestamp,
        });
      }
    }
    
    // 按强度排序并取前 10
    const sortedLevels = levels
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10);
    
    // 找最近的支撑和阻力
    const resistances = sortedLevels
      .filter(l => l.type === 'resistance' && l.price > currentPrice)
      .sort((a, b) => a.price - b.price);
    
    const supports = sortedLevels
      .filter(l => l.type === 'support' && l.price < currentPrice)
      .sort((a, b) => b.price - a.price);
    
    return {
      levels: sortedLevels,
      nearestSupport: supports[0]?.price || currentPrice * 0.95,
      nearestResistance: resistances[0]?.price || currentPrice * 1.05,
    };
  }
  
  /**
   * 细粒度任务 6: 微观结构分析
   * 分析订单流和大单活动
   */
  private analyzeMicrostructure(
    trades: any[],
    currentPrice: number
  ): MicrostructureAnalysis {
    // 简化版 - 实际需要更详细的订单簿数据
    const recentTrades = trades.slice(-100);
    
    // 买卖压力
    let buyVolume = 0;
    let sellVolume = 0;
    const largeOrders: any[] = [];
    
    for (const trade of recentTrades) {
      if (trade.side === 'buy') {
        buyVolume += trade.amount;
      } else {
        sellVolume += trade.amount;
      }
      
      // 检测大单 (> 平均的 5 倍)
      if (trade.amount > (buyVolume + sellVolume) / 100 * 5) {
        largeOrders.push({
          side: trade.side,
          size: trade.amount,
          price: trade.price,
          timestamp: trade.timestamp,
        });
      }
    }
    
    const totalVolume = buyVolume + sellVolume;
    const bidAskImbalance = totalVolume > 0 
      ? (buyVolume - sellVolume) / totalVolume 
      : 0;
    
    let tradeFlow: 'buy_pressure' | 'sell_pressure' | 'neutral' = 'neutral';
    if (bidAskImbalance > 0.3) {
      tradeFlow = 'buy_pressure';
    } else if (bidAskImbalance < -0.3) {
      tradeFlow = 'sell_pressure';
    }
    
    return {
      bidAskSpread: 0, // 需要订单簿数据
      bidAskImbalance,
      tradeFlow,
      largeOrders: largeOrders.slice(-10),
      whaleActivity: largeOrders.length > 3,
    };
  }
  
  // ==================== 辅助方法 ====================
  
  private calculateIndicators(ohlcv: OHLCV[]): any {
    const closes = ohlcv.map(c => c.close);
    const highs = ohlcv.map(c => c.high);
    const lows = ohlcv.map(c => c.low);
    const volumes = ohlcv.map(c => c.volume);
    
    // RSI
    const rsi14 = this.calculateRSI(closes, 14);
    const rsi7 = this.calculateRSI(closes, 7);
    
    // MACD
    const macd = this.calculateMACD(closes);
    
    // ATR
    const atr14 = this.calculateATR(ohlcv, 14);
    
    // ADX
    const { adx, plusDI, minusDI } = this.calculateADX(ohlcv, 14);
    
    // 布林带
    const bollinger = this.calculateBollinger(closes, 20, 2);
    
    // Keltner
    const keltner = this.calculateKeltner(ohlcv, 20);
    
    // 随机指标
    const stoch = this.calculateStochastic(ohlcv, 14);
    
    // MFI
    const mfi = this.calculateMFI(ohlcv, 14);
    
    // CMF
    const cmf = this.calculateCMF(ohlcv, 20);
    
    // CCI
    const cci = this.calculateCCI(ohlcv, 20);
    
    // Williams %R
    const williamsR = this.calculateWilliamsR(ohlcv, 14);
    
    return {
      rsi14,
      rsi7,
      macd: macd.macd,
      macdSignal: macd.signal,
      macdHistogram: macd.histogram,
      atr14,
      adx,
      plusDI,
      minusDI,
      bollingerUpper: bollinger.upper,
      bollingerMiddle: bollinger.middle,
      bollingerLower: bollinger.lower,
      bollingerBandwidth: bollinger.bandwidth,
      keltnerUpper: keltner.upper,
      keltnerLower: keltner.lower,
      stochasticK: stoch.k,
      stochasticD: stoch.d,
      mfi,
      cmf,
      cci,
      williamsR,
      volumeSMA20: this.calculateSMA(volumes, 20),
    };
  }
  
  // 简化的指标计算方法
  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }
  
  private calculateEMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(data.slice(0, period), period);
    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    return ema;
  }
  
  /** @see computeRSI from indicators/rsi — delegates to canonical impl */
  private calculateRSI(closes: number[], period: number): number {
    return computeRSI(closes, period);
  }
  
  private calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macd = ema12 - ema26;
    
    // 简化: 使用 EMA9 作为信号线
    const macdLine = [];
    for (let i = 26; i < closes.length; i++) {
      const e12 = this.calculateEMA(closes.slice(0, i + 1), 12);
      const e26 = this.calculateEMA(closes.slice(0, i + 1), 26);
      macdLine.push(e12 - e26);
    }
    const signal = macdLine.length >= 9 ? this.calculateEMA(macdLine, 9) : macd;
    
    return { macd, signal, histogram: macd - signal };
  }
  
  private calculateATR(ohlcv: OHLCV[], period: number): number {
    if (ohlcv.length < period + 1) return 0;
    
    const trValues: number[] = [];
    for (let i = 1; i < ohlcv.length; i++) {
      const high = ohlcv[i].high;
      const low = ohlcv[i].low;
      const prevClose = ohlcv[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trValues.push(tr);
    }
    
    return this.calculateSMA(trValues.slice(-period), period);
  }
  
  private calculateADX(ohlcv: OHLCV[], period: number): { adx: number; plusDI: number; minusDI: number } {
    // 简化版 ADX 计算
    if (ohlcv.length < period * 2) {
      return { adx: 25, plusDI: 20, minusDI: 20 };
    }
    
    const trValues: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    
    for (let i = 1; i < ohlcv.length; i++) {
      const high = ohlcv[i].high;
      const low = ohlcv[i].low;
      const prevHigh = ohlcv[i - 1].high;
      const prevLow = ohlcv[i - 1].low;
      const prevClose = ohlcv[i - 1].close;
      
      trValues.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
      plusDM.push(high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0);
      minusDM.push(prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0);
    }
    
    const atr = this.calculateSMA(trValues.slice(-period), period);
    const plusDI = (this.calculateSMA(plusDM.slice(-period), period) / atr) * 100;
    const minusDI = (this.calculateSMA(minusDM.slice(-period), period) / atr) * 100;
    
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    
    return { adx: dx, plusDI, minusDI };
  }
  
  private calculateBollinger(closes: number[], period: number, stdDev: number): any {
    const middle = this.calculateSMA(closes.slice(-period), period);
    const slice = closes.slice(-period);
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - middle, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    return {
      upper: middle + stdDev * std,
      middle,
      lower: middle - stdDev * std,
      bandwidth: (2 * stdDev * std) / middle,
    };
  }
  
  private calculateKeltner(ohlcv: OHLCV[], period: number): any {
    const closes = ohlcv.map(c => c.close);
    const middle = this.calculateEMA(closes, period);
    const atr = this.calculateATR(ohlcv, period);
    
    return {
      upper: middle + 2 * atr,
      middle,
      lower: middle - 2 * atr,
    };
  }
  
  private calculateStochastic(ohlcv: OHLCV[], period: number): { k: number; d: number } {
    const recent = ohlcv.slice(-period);
    const currentClose = ohlcv[ohlcv.length - 1].close;
    const highestHigh = Math.max(...recent.map(c => c.high));
    const lowestLow = Math.min(...recent.map(c => c.low));
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // 简化: 使用前3个K值的平均作为D
    const kValues: number[] = [];
    for (let i = period; i <= ohlcv.length; i++) {
      const slice = ohlcv.slice(i - period, i);
      const close = slice[slice.length - 1].close;
      const high = Math.max(...slice.map(c => c.high));
      const low = Math.min(...slice.map(c => c.low));
      kValues.push(((close - low) / (high - low)) * 100);
    }
    
    const d = this.calculateSMA(kValues.slice(-3), 3);
    
    return { k, d };
  }
  
  private calculateMFI(ohlcv: OHLCV[], period: number): number {
    // Money Flow Index
    if (ohlcv.length < period + 1) return 50;
    
    let positiveFlow = 0;
    let negativeFlow = 0;
    
    for (let i = ohlcv.length - period; i < ohlcv.length; i++) {
      const typicalPrice = (ohlcv[i].high + ohlcv[i].low + ohlcv[i].close) / 3;
      const prevTypicalPrice = (ohlcv[i - 1].high + ohlcv[i - 1].low + ohlcv[i - 1].close) / 3;
      const moneyFlow = typicalPrice * ohlcv[i].volume;
      
      if (typicalPrice > prevTypicalPrice) {
        positiveFlow += moneyFlow;
      } else {
        negativeFlow += moneyFlow;
      }
    }
    
    if (negativeFlow === 0) return 100;
    
    const mfRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + mfRatio));
  }
  
  private calculateCMF(ohlcv: OHLCV[], period: number): number {
    // Chaikin Money Flow
    if (ohlcv.length < period) return 0;
    
    let sumMFV = 0;
    let sumVolume = 0;
    
    for (let i = ohlcv.length - period; i < ohlcv.length; i++) {
      const { high, low, close, volume } = ohlcv[i];
      const mfMultiplier = ((close - low) - (high - close)) / (high - low);
      const mfVolume = mfMultiplier * volume;
      
      sumMFV += mfVolume;
      sumVolume += volume;
    }
    
    return sumVolume > 0 ? sumMFV / sumVolume : 0;
  }
  
  private calculateCCI(ohlcv: OHLCV[], period: number): number {
    // Commodity Channel Index
    const recent = ohlcv.slice(-period);
    const typicalPrices = recent.map(c => (c.high + c.low + c.close) / 3);
    const smaTP = this.calculateSMA(typicalPrices, period);
    
    const meanDev = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
    const currentTP = typicalPrices[typicalPrices.length - 1];
    
    return meanDev > 0 ? (currentTP - smaTP) / (0.015 * meanDev) : 0;
  }
  
  private calculateWilliamsR(ohlcv: OHLCV[], period: number): number {
    const recent = ohlcv.slice(-period);
    const currentClose = ohlcv[ohlcv.length - 1].close;
    const highestHigh = Math.max(...recent.map(c => c.high));
    const lowestLow = Math.min(...recent.map(c => c.low));
    
    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }
  
  private calculateOBV(ohlcv: OHLCV[]): number {
    let obv = 0;
    for (let i = 1; i < ohlcv.length; i++) {
      if (ohlcv[i].close > ohlcv[i - 1].close) {
        obv += ohlcv[i].volume;
      } else if (ohlcv[i].close < ohlcv[i - 1].close) {
        obv -= ohlcv[i].volume;
      }
    }
    return obv;
  }
  
  private assessReversalRisk(indicators: any, direction: 'up' | 'down' | 'sideways'): number {
    let risk = 30; // 基准风险
    
    // RSI 极端值增加反转风险
    if (direction === 'up' && indicators.rsi14 > 70) {
      risk += 25;
    } else if (direction === 'down' && indicators.rsi14 < 30) {
      risk += 25;
    }
    
    // 布林带外部增加反转风险
    if (indicators.bollingerPosition === 'outside') {
      risk += 20;
    }
    
    // ADX 低表示趋势弱，反转风险低
    if (indicators.adx < 20) {
      risk -= 10;
    }
    
    return Math.min(100, Math.max(0, risk));
  }
  
  private detectRSIDivergence(indicators: any): boolean {
    // 简化版背离检测
    return Math.abs(indicators.rsi14 - indicators.rsi7) > 10;
  }
  
  private calculateLevelStrength(price: number, ohlcv: OHLCV[]): number {
    // 根据价格附近的成交量评估支撑/阻力强度
    const nearby = ohlcv.filter(c => 
      Math.abs(c.close - price) / price < 0.01
    );
    return Math.min(100, nearby.length * 10);
  }
  
  private countTouches(price: number, ohlcv: OHLCV[]): number {
    // 计算价格触及次数
    return ohlcv.filter(c => 
      Math.abs(c.low - price) / price < 0.005 ||
      Math.abs(c.high - price) / price < 0.005
    ).length;
  }
  
  private calculateCompositeScores(
    trend: TrendAnalysis,
    momentum: MomentumAnalysis,
    volatility: VolatilityAnalysis,
    volume: VolumeAnalysis
  ): {
    trendScore: number;
    momentumScore: number;
    volatilityScore: number;
    volumeScore: number;
    overallScore: number;
  } {
    // 趋势评分 (-100 到 100)
    let trendScore = 0;
    if (trend.direction === 'up') {
      trendScore = trend.strength;
    } else if (trend.direction === 'down') {
      trendScore = -trend.strength;
    }
    
    // 动量评分 (-100 到 100)
    let momentumScore = 0;
    if (momentum.rsi.signal === 'overbought') {
      momentumScore = -30;
    } else if (momentum.rsi.signal === 'oversold') {
      momentumScore = 30;
    }
    if (momentum.macd.signal === 'bullish') {
      momentumScore += 20;
    } else if (momentum.macd.signal === 'bearish') {
      momentumScore -= 20;
    }
    
    // 波动率评分 (高波动为负)
    let volatilityScore = 0;
    if (volatility.squeeze) {
      volatilityScore = 20; // 收窄可能预示突破
    } else if (volatility.atrPercent > 2) {
      volatilityScore = -20; // 高波动风险
    }
    
    // 成交量评分
    let volumeScore = 0;
    if (volume.obvTrend === 'up' && volume.volumeRatio > 1.5) {
      volumeScore = 30;
    } else if (volume.obvTrend === 'down' && volume.volumeRatio > 1.5) {
      volumeScore = -30;
    }
    
    // 综合评分
    const overallScore = (trendScore + momentumScore + volatilityScore + volumeScore) / 4;
    
    return {
      trendScore,
      momentumScore,
      volatilityScore,
      volumeScore,
      overallScore,
    };
  }
  
  getStatus(): AgentStatus {
    return {
      healthy: this.errorCount < 5,
      lastRun: this.lastRun,
      errorCount: this.errorCount,
      avgProcessingTimeMs: this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
        : 0,
    };
  }
}

export default TechnicalAnalystAgent;
