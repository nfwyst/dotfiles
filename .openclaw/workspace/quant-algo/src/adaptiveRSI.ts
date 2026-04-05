/**
 * Adaptive RSI - 自适应相对强弱指标
 *
 * 根据市场波动率自动调整 RSI 周期和阈值
 * 解决传统 RSI 在趋势/震荡市场中的局限性
 */

export interface AdaptiveRSIConfig {
  basePeriod?: number;        // 基础周期 (默认 14)
  minPeriod?: number;         // 最小周期 (默认 5)
  maxPeriod?: number;         // 最大周期 (默认 30)
  volatilityLookback?: number; // 波动率回看周期 (默认 20)
  // 新增：直接指定超买超卖阈值
  baseOversold?: number;      // 基础超卖阈值 (默认 30)
  baseOverbought?: number;    // 基础超买阈值 (默认 70)
  adaptationFactor?: number;  // 适应因子 (默认 0.5)
}

export interface AdaptiveRSIResult {
  value: number;             // RSI 值
  period: number;            // 当前使用的周期
  overbought: number;        // 动态超买阈值
  oversold: number;          // 动态超卖阈值
  regime: 'trending' | 'ranging';  // 市场状态
  confidence: number;        // 信号置信度
}

export class AdaptiveRSI {
  private config: Required<AdaptiveRSIConfig>;

  constructor(config: AdaptiveRSIConfig = {}) {
    this.config = {
      basePeriod: config.basePeriod || 14,
      minPeriod: config.minPeriod || 5,
      maxPeriod: config.maxPeriod || 30,
      volatilityLookback: config.volatilityLookback || 20,
      baseOversold: config.baseOversold || 30,
      baseOverbought: config.baseOverbought || 70,
      adaptationFactor: config.adaptationFactor || 0.5,
    };
  }

  /**
   * 计算自适应 RSI
   */
  calculate(prices: number[]): AdaptiveRSIResult {
    if (prices.length < this.config.maxPeriod + 5) {
      return {
        value: 50,
        period: this.config.basePeriod,
        overbought: 70,
        oversold: 30,
        regime: 'ranging',
        confidence: 0,
      };
    }

    // 1. 计算市场波动率 (ATR 简化版)
    const volatility = this.calculateVolatility(prices);

    // 2. 计算趋势强度 (使用价格变化的标准差)
    const trendStrength = this.calculateTrendStrength(prices);

    // 3. 确定市场状态
    const isTrending = trendStrength > 0.6;  // 趋势强度 > 0.6 认为是趋势市场
    const regime: 'trending' | 'ranging' = isTrending ? 'trending' : 'ranging';

    // 4. 自适应调整 RSI 周期
    let adaptivePeriod: number;
    if (isTrending) {
      // 趋势市场：使用较长周期减少噪音
      adaptivePeriod = Math.min(
        this.config.maxPeriod,
        Math.max(this.config.basePeriod + 5, Math.floor(this.config.basePeriod * 1.3))
      );
    } else {
      // 震荡市场：使用较短周期更敏感
      adaptivePeriod = Math.max(
        this.config.minPeriod,
        Math.min(this.config.basePeriod - 3, Math.floor(this.config.basePeriod * 0.7))
      );
    }

    // 5. 自适应调整阈值
    let overbought: number;
    let oversold: number;

    if (isTrending) {
      // 趋势市场：放宽阈值，避免过早出场
      const trendDirection = prices[prices.length - 1] > prices[prices.length - 10] ? 'up' : 'down';
      if (trendDirection === 'up') {
        overbought = 75;  // 上涨趋势，超买阈值更高
        oversold = 40;    // 不易触发超卖
      } else {
        overbought = 60;  // 下跌趋势，不易触发超买
        oversold = 25;    // 超卖阈值更低
      }
    } else {
      // 震荡市场：收紧阈值，更敏感
      overbought = 65;
      oversold = 35;
    }

    // 6. 使用自适应周期计算 RSI
    const rsi = this.calculateStandardRSI(prices, adaptivePeriod);

    // 7. 计算信号置信度
    const confidence = this.calculateConfidence(rsi, overbought, oversold, isTrending);

    return {
      value: rsi,
      period: adaptivePeriod,
      overbought,
      oversold,
      regime,
      confidence,
    };
  }

  /**
   * 计算波动率 (简化 ATR)
   */
  private calculateVolatility(prices: number[]): number {
    const lookback = Math.min(this.config.volatilityLookback, prices.length - 1);
    const changes: number[] = [];

    for (let i = prices.length - lookback; i < prices.length; i++) {
      changes.push(Math.abs(prices[i] - prices[i - 1]));
    }

    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const currentPrice = prices[prices.length - 1];

    return avgChange / currentPrice;  // 标准化波动率
  }

  /**
   * 计算趋势强度 (0-1)
   */
  private calculateTrendStrength(prices: number[]): number {
    const lookback = Math.min(20, prices.length - 1);
    const changes: number[] = [];

    for (let i = prices.length - lookback; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    // 使用变化的方向一致性计算趋势强度
    const positiveChanges = changes.filter(c => c > 0).length;
    const negativeChanges = changes.filter(c => c < 0).length;

    const total = changes.length;
    const consistency = Math.max(positiveChanges, negativeChanges) / total;

    // 乘以变化幅度
    const avgChange = changes.reduce((a, b) => Math.abs(a) + Math.abs(b), 0) / total;
    const normalizedChange = Math.min(avgChange / (prices[prices.length - 1] * 0.01), 1);

    return consistency * normalizedChange;
  }

  /**
   * 计算标准 RSI
   */
  private calculateStandardRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * 计算信号置信度
   */
  private calculateConfidence(
    rsi: number,
    overbought: number,
    oversold: number,
    isTrending: boolean
  ): number {
    // 距离阈值越远，置信度越高
    let distanceFromThreshold: number;

    if (rsi > overbought) {
      distanceFromThreshold = rsi - overbought;
    } else if (rsi < oversold) {
      distanceFromThreshold = oversold - rsi;
    } else {
      return 0;  // 在中间区域，无信号
    }

    // 基础置信度
    let confidence = Math.min(distanceFromThreshold / 10, 1);

    // 趋势市场中降低震荡信号的置信度
    if (isTrending && distanceFromThreshold < 10) {
      confidence *= 0.7;
    }

    return confidence;
  }

  /**
   * 获取信号解释
   */
  getSignalDescription(result: AdaptiveRSIResult): string {
    if (result.value > result.overbought) {
      return `超买区域 (RSI ${result.value.toFixed(1)} > ${result.overbought}, ${result.regime === 'trending' ? '趋势' : '震荡'}市场)`;
    } else if (result.value < result.oversold) {
      return `超卖区域 (RSI ${result.value.toFixed(1)} < ${result.oversold}, ${result.regime === 'trending' ? '趋势' : '震荡'}市场)`;
    } else {
      return `中性区域 (${result.oversold} < RSI ${result.value.toFixed(1)} < ${result.overbought})`;
    }
  }
}

export default AdaptiveRSI;
