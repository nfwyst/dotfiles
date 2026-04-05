import logger from './logger';
import OCSAnalyzer from './ocsAnalyzer';

/**
 * 增强版 OCS AI Trader - 目标 85% 胜率
 * 
 * 优化点:
 * 1. 多时间框架确认
 * 2. 市场状态识别（趋势/震荡）
 * 3. 自适应止损
 * 4. 波动率过滤
 * 5. 成交量确认
 */

export interface EnhancedOCSSignal {
  type: 'buy' | 'sell' | 'hold';
  strength: number;
  confidence: number;
  quality: 'high' | 'medium' | 'low';
  targets?: { t1: number; t2: number; t3: number };
  stopLoss?: number;
  reasoning: string[];
  marketState: 'trending_up' | 'trending_down' | 'ranging' | 'volatile';
  timeframeAlignment: boolean;
  volumeConfirmation: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

export class EnhancedOCSAnalyzer extends OCSAnalyzer {
  
  /**
   * 多时间框架分析
   * 15m, 1h, 4h 必须同向
   */
  analyzeMultiTimeframe(
    prices15m: number[],
    prices1h: number[],
    prices4h: number[]
  ): { aligned: boolean; direction: 'up' | 'down' | 'mixed' } {
    const ema15m = this.calculateSingleEMA(prices15m, 20);
    const ema1h = this.calculateSingleEMA(prices1h, 20);
    const ema4h = this.calculateSingleEMA(prices4h, 20);
    
    const current15m = prices15m[prices15m.length - 1];
    const current1h = prices1h[prices1h.length - 1];
    const current4h = prices4h[prices4h.length - 1];
    
    const up15m = current15m > ema15m;
    const up1h = current1h > ema1h;
    const up4h = current4h > ema4h;
    
    const alignedUp = up15m && up1h && up4h;
    const alignedDown = !up15m && !up1h && !up4h;
    
    return {
      aligned: alignedUp || alignedDown,
      direction: alignedUp ? 'up' : alignedDown ? 'down' : 'mixed',
    };
  }
  
  /**
   * 市场状态识别
   */
  identifyMarketState(
    prices: number[],
    highs: number[],
    lows: number[]
  ): 'trending_up' | 'trending_down' | 'ranging' | 'volatile' {
    // 严格检查输入数据
    if (!prices || !highs || !lows || 
        prices.length < 50 || highs.length < 50 || lows.length < 50) {
      return 'ranging'; // 数据不足，默认震荡
    }
    
    const atr = this.calculateATRValue(highs, lows, prices, 14);
    const currentPrice = prices[prices.length - 1] || 1;
    const volatility = atr / (currentPrice / 100);
    
    // 趋势判断
    const ema20 = this.calculateSingleEMA(prices, 20);
    const ema50 = this.calculateSingleEMA(prices, 50);
    
    if (!ema20 || !ema50 || ema50 === 0) return 'ranging';
    
    const trending = Math.abs(ema20 - ema50) / ema50 > 0.02;
    const upTrend = ema20 > ema50;
    
    if (volatility > 3) return 'volatile';
    if (trending && upTrend) return 'trending_up';
    if (trending && !upTrend) return 'trending_down';
    return 'ranging';
  }
  
  /**
   * 自适应止损计算
   * 根据波动率动态调整
   */
  calculateAdaptiveStopLoss(
    entryPrice: number,
    highs: number[],
    lows: number[],
    closes: number[],
    type: 'buy' | 'sell'
  ): number {
    const atr = this.calculateATRValue(highs, lows, closes, 14);
    const volatility = this.calculateVolatility(closes, 20);
    
    // 高波动时放宽止损，低波动时收紧
    let multiplier = 1.5;
    if (volatility > 0.03) multiplier = 2.0;  // 高波动
    else if (volatility < 0.01) multiplier = 1.0;  // 低波动
    
    const stopDistance = atr * multiplier;
    return type === 'buy' 
      ? entryPrice - stopDistance 
      : entryPrice + stopDistance;
  }
  
  /**
   * 成交量确认
   */
  checkVolumeConfirmation(
    volumes: number[],
    minRatio: number = 1.2
  ): boolean {
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    return currentVolume > avgVolume * minRatio;
  }
  
  /**
   * 波动率过滤
   */
  checkVolatilityFilter(prices: number[], maxVolatility: number = 0.05): boolean {
    const volatility = this.calculateVolatility(prices, 20);
    return volatility <= maxVolatility;
  }
  
  /**
   * 生成增强信号
   */
  generateEnhancedSignal(data: {
    prices: number[];
    highs: number[];
    lows: number[];
    closes: number[];
    volumes: number[];
    prices1h?: number[];
    prices4h?: number[];
  }): EnhancedOCSSignal {
    const reasons: string[] = [];
    
    // 1. 基础 OCS 信号
    const baseSignal = this.generateOCSSignal(data);
    
    if (baseSignal.type === 'hold' || baseSignal.strength < 60) {
      return {
        type: 'hold',
        strength: 0,
        confidence: 0,
        quality: 'low',
        reasoning: ['基础信号太弱'],
        marketState: 'ranging',
        timeframeAlignment: false,
        volumeConfirmation: false,
        riskLevel: 'low',
      };
    }
    
    // 2. 市场状态识别
    const marketState = this.identifyMarketState(data.prices, data.highs, data.lows);
    reasons.push(`市场状态: ${marketState}`);
    
    // 3. 多时间框架确认
    let timeframeAlignment = false;
    if (data.prices1h && data.prices4h) {
      const mtf = this.analyzeMultiTimeframe(data.prices, data.prices1h, data.prices4h);
      timeframeAlignment = mtf.aligned && 
        ((baseSignal.type === 'buy' && mtf.direction === 'up') ||
         (baseSignal.type === 'sell' && mtf.direction === 'down'));
      if (timeframeAlignment) reasons.push('✅ 多时间框架一致');
      else reasons.push('⚠️ 多时间框架不一致');
    }
    
    // 4. 成交量确认
    const volumeConfirmation = this.checkVolumeConfirmation(data.volumes, 1.3);
    if (volumeConfirmation) reasons.push('✅ 成交量确认');
    else reasons.push('⚠️ 成交量不足');
    
    // 5. 波动率过滤
    const volatilityOK = this.checkVolatilityFilter(data.prices, 0.04);
    if (!volatilityOK) reasons.push('❌ 波动率过高');
    
    // 6. 计算综合得分
    let score = baseSignal.strength;
    let confidence = baseSignal.confidence;
    
    // 加分项
    if (timeframeAlignment) { score += 10; confidence += 0.1; }
    if (volumeConfirmation) { score += 5; confidence += 0.05; }
    if (marketState === 'trending_up' && baseSignal.type === 'buy') { score += 10; }
    if (marketState === 'trending_down' && baseSignal.type === 'sell') { score += 10; }
    
    // 减分项
    if (!volatilityOK) { score -= 15; confidence -= 0.15; }
    if (marketState === 'volatile') { score -= 10; confidence -= 0.1; }
    
    // 限制范围
    score = Math.min(100, Math.max(0, score));
    confidence = Math.min(1, Math.max(0, confidence));
    
    // 7. 确定质量
    let quality: 'high' | 'medium' | 'low' = 'low';
    if (score >= 80 && confidence >= 0.7 && timeframeAlignment) quality = 'high';
    else if (score >= 65 && confidence >= 0.5) quality = 'medium';
    
    // 8. 自适应止损
    const stopLoss = this.calculateAdaptiveStopLoss(
      data.closes[data.closes.length - 1],
      data.highs,
      data.lows,
      data.closes,
      baseSignal.type as 'buy' | 'sell'
    );
    
    // 9. 风险等级
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (score >= 85 && timeframeAlignment && volumeConfirmation) riskLevel = 'low';
    else if (marketState === 'volatile' || !timeframeAlignment) riskLevel = 'high';
    
    return {
      type: baseSignal.type as 'buy' | 'sell' | 'hold',
      strength: Math.round(score),
      confidence,
      quality,
      targets: baseSignal.targets,
      stopLoss,
      reasoning: reasons,
      marketState,
      timeframeAlignment,
      volumeConfirmation,
      riskLevel,
    };
  }
  
  // 辅助方法
  private calculateSingleEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }
  
  private calculateATRValue(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number {
    if (closes.length < period + 1) return 0;
    
    let sum = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      sum += tr;
    }
    return sum / period;
  }
  
  private calculateVolatility(prices: number[], period: number): number {
    if (!prices || prices.length < period + 1) return 0;
    
    const returns: number[] = [];
    for (let i = prices.length - period + 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(365);  // 年化波动率
  }
}

export default EnhancedOCSAnalyzer;
