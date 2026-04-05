import { 
  RSI, 
  SMA, 
  EMA, 
  BollingerBands,
  MACD,
  ATR,
} from 'technicalindicators';

export interface IndicatorValues {
  rsi: number;
  smaFast: number;
  smaSlow: number;
  emaFast: number;
  emaSlow: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  atr: number;
}

export interface Signal {
  type: 'buy' | 'sell' | 'hold';
  strength: number;  // 0-100
  reason: string;
  indicators: IndicatorValues;
}

export class TechnicalIndicators {
  // 计算所有指标
  static calculate(ohlcv: number[][]): IndicatorValues {
    const closes = ohlcv.map(candle => candle[4]);
    const highs = ohlcv.map(candle => candle[2]);
    const lows = ohlcv.map(candle => candle[3]);
    
    // RSI
    const rsiValues = RSI.calculate({ 
      values: closes, 
      period: 14 
    });
    
    // 简单移动平均
    const smaFastValues = SMA.calculate({ 
      values: closes, 
      period: 9 
    });
    const smaSlowValues = SMA.calculate({ 
      values: closes, 
      period: 21 
    });
    
    // 指数移动平均
    const emaFastValues = EMA.calculate({ 
      values: closes, 
      period: 9 
    });
    const emaSlowValues = EMA.calculate({ 
      values: closes, 
      period: 21 
    });
    
    // 布林带
    const bbValues = BollingerBands.calculate({
      values: closes,
      period: 20,
      stdDev: 2,
    });
    
    // MACD
    const macdValues = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    
    // ATR (平均真实波幅)
    const atrValues = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
    });
    
    const lastIndex = closes.length - 1;
    
    return {
      rsi: rsiValues[rsiValues.length - 1] || 50,
      smaFast: smaFastValues[smaFastValues.length - 1] || closes[lastIndex],
      smaSlow: smaSlowValues[smaSlowValues.length - 1] || closes[lastIndex],
      emaFast: emaFastValues[emaFastValues.length - 1] || closes[lastIndex],
      emaSlow: emaSlowValues[emaSlowValues.length - 1] || closes[lastIndex],
      bbUpper: bbValues[bbValues.length - 1]?.upper || closes[lastIndex] * 1.02,
      bbMiddle: bbValues[bbValues.length - 1]?.middle || closes[lastIndex],
      bbLower: bbValues[bbValues.length - 1]?.lower || closes[lastIndex] * 0.98,
      macd: macdValues[macdValues.length - 1]?.MACD || 0,
      macdSignal: macdValues[macdValues.length - 1]?.signal || 0,
      macdHistogram: macdValues[macdValues.length - 1]?.histogram || 0,
      atr: atrValues[atrValues.length - 1] || 0,
    };
  }
  
  // 生成交易信号
  static generateSignal(ohlcv: number[][]): Signal {
    const indicators = this.calculate(ohlcv);
    const currentPrice = ohlcv[ohlcv.length - 1][4];
    
    let buyScore = 0;
    let sellScore = 0;
    const reasons: string[] = [];
    
    // RSI 信号 (优化版 - 更宽松的阈值)
    if (indicators.rsi < 40) {
      buyScore += 30;
      reasons.push('RSI偏低');
    } else if (indicators.rsi > 60) {
      sellScore += 30;
      reasons.push('RSI偏高');
    }
    
    // 移动平均线趋势
    if (indicators.emaFast > indicators.emaSlow) {
      buyScore += 25;
      reasons.push('EMA上升');
    } else if (indicators.emaFast < indicators.emaSlow) {
      sellScore += 25;
      reasons.push('EMA下降');
    }
    
    // 布林带 (放宽触发条件)
    if (currentPrice < indicators.bbLower * 1.01) {
      buyScore += 25;
      reasons.push('接近布林带下轨');
    } else if (currentPrice > indicators.bbUpper * 0.99) {
      sellScore += 25;
      reasons.push('接近布林带上轨');
    }
    
    // MACD (简化判断)
    if (indicators.macdHistogram > 0) {
      buyScore += 20;
      reasons.push('MACD为正');
    } else if (indicators.macdHistogram < 0) {
      sellScore += 20;
      reasons.push('MACD为负');
    }
    
    // 价格与均线关系
    if (currentPrice > indicators.smaFast && currentPrice > indicators.smaSlow) {
      buyScore += 15;
    } else if (currentPrice < indicators.smaFast && currentPrice < indicators.smaSlow) {
      sellScore += 15;
    }
    
    // 确定信号 (阈值降低到 40，与回测一致)
    let type: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;
    
    if (buyScore >= 40 && buyScore > sellScore) {
      type = 'buy';
      strength = buyScore;
    } else if (sellScore >= 40 && sellScore > buyScore) {
      type = 'sell';
      strength = sellScore;
    }
    
    return {
      type,
      strength,
      reason: reasons.join(', ') || '无明确信号',
      indicators,
    };
  }
  
  // 格式化指标输出
  static formatIndicators(ind: IndicatorValues): string {
    return `
RSI: ${ind.rsi.toFixed(2)}
EMA(9/21): ${ind.emaFast.toFixed(2)} / ${ind.emaSlow.toFixed(2)}
BB: ${ind.bbLower.toFixed(2)} / ${ind.bbMiddle.toFixed(2)} / ${ind.bbUpper.toFixed(2)}
MACD: ${ind.macd.toFixed(4)} / ${ind.macdSignal.toFixed(4)} / ${ind.macdHistogram.toFixed(4)}
ATR: ${ind.atr.toFixed(2)}
    `.trim();
  }
}

export default TechnicalIndicators;
