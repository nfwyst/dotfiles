/**
 * SL/TP 计算子模块
 * 
 * 职责: 统一计算止损和止盈位置
 * 
 * 规则:
 * - SL: 前高的 Swing High (做空) / 前低的 Swing Low (做多)
 * - TP1: 1:1 风险回报比
 * - TP2: 1:1.5 风险回报比  
 * - TP3: 1:2 风险回报比
 */

export interface SwingLevel {
  swingHigh: number;
  swingLow: number;
  swingHighIndex: number;
  swingLowIndex: number;
}

export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

const TIMEFRAMES: ReadonlySet<string> = new Set<TimeFrame>(['1m', '5m', '15m', '1h', '4h', '1d']);
function isTimeFrame(value: string): value is TimeFrame {
  return TIMEFRAMES.has(value);
}

export interface StopLossTakeProfit {
  entryPrice: number;
  stopLoss: number;
  takeProfits: {
    tp1: number; // 1:1 R/R
    tp2: number; // 1:1.5 R/R
    tp3: number; // 1:2 R/R
  };
  riskRewardRatios: {
    tp1: number;
    tp2: number;
    tp3: number;
  };
  stopDistance: number;
  timeframe: TimeFrame;
  swingLevel: SwingLevel;
  reasoning: string[];
}

export class SLTPCalculator {
  private lookbackPeriod: number;
  private minSwingStrength: number;
  private timeframe: TimeFrame;

  // 不同时间框架的默认参数
  private static TIMEFRAME_CONFIG: Record<TimeFrame, { lookback: number; strength: number; minStopPercent: number }> = {
    '1m': { lookback: 60, strength: 5, minStopPercent: 0.003 },   // 1分钟: 回看60根, 强度5, 最小止损0.3%
    '5m': { lookback: 48, strength: 3, minStopPercent: 0.005 },   // 5分钟: 回看48根(4小时), 强度3
    '15m': { lookback: 32, strength: 3, minStopPercent: 0.008 },  // 15分钟: 回看32根(8小时)
    '1h': { lookback: 24, strength: 2, minStopPercent: 0.01 },    // 1小时: 回看24根(1天)
    '4h': { lookback: 30, strength: 2, minStopPercent: 0.015 },   // 4小时: 回看30根(5天)
    '1d': { lookback: 20, strength: 2, minStopPercent: 0.02 },   // 1天: 回看20根(20天)
  };

  constructor(timeframe: TimeFrame = '5m', lookbackPeriod?: number, minSwingStrength?: number) {
    this.timeframe = timeframe;
    const config = SLTPCalculator.TIMEFRAME_CONFIG[timeframe] || SLTPCalculator.TIMEFRAME_CONFIG['5m']; // 默认使用5m
    this.lookbackPeriod = lookbackPeriod || config.lookback;
    this.minSwingStrength = minSwingStrength || config.strength;
  }

  /**
   * 获取当前时间框架
   */
  getTimeframe(): TimeFrame {
    return this.timeframe;
  }

  /**
   * 获取最小止损百分比 (根据时间框架)
   */
  private getMinStopPercent(): number {
    return SLTPCalculator.TIMEFRAME_CONFIG[this.timeframe].minStopPercent;
  }

  /**
   * 查找 Swing High / Swing Low
   * 
   * Swing High: 左右各 minSwingStrength 根K线都低于该点
   * Swing Low: 左右各 minSwingStrength 根K线都高于该点
   */
  findSwingLevels(
    highs: number[],
    lows: number[],
    currentIndex: number
  ): SwingLevel | null {
    const startIndex = Math.max(0, currentIndex - this.lookbackPeriod);
    const endIndex = currentIndex;
    
    let swingHigh = -Infinity;
    let swingHighIndex = -1;
    let swingLow = Infinity;
    let swingLowIndex = -1;
    
    // 查找 Swing High
    for (let i = startIndex + this.minSwingStrength; i < endIndex - this.minSwingStrength; i++) {
      const current = highs[i];
      let isSwingHigh = true;
      
      // 检查左边 minSwingStrength 根K线
      for (let j = 1; j <= this.minSwingStrength; j++) {
        if (highs[i - j] > current) {
          isSwingHigh = false;
          break;
        }
      }
      
      // 检查右边 minSwingStrength 根K线
      if (isSwingHigh) {
        for (let j = 1; j <= this.minSwingStrength; j++) {
          if (i + j < highs.length && highs[i + j] > current) {
            isSwingHigh = false;
            break;
          }
        }
      }
      
      if (isSwingHigh && current > swingHigh) {
        swingHigh = current;
        swingHighIndex = i;
      }
    }
    
    // 查找 Swing Low
    for (let i = startIndex + this.minSwingStrength; i < endIndex - this.minSwingStrength; i++) {
      const current = lows[i];
      let isSwingLow = true;
      
      // 检查左边 minSwingStrength 根K线
      for (let j = 1; j <= this.minSwingStrength; j++) {
        if (lows[i - j] < current) {
          isSwingLow = false;
          break;
        }
      }
      
      // 检查右边 minSwingStrength 根K线
      if (isSwingLow) {
        for (let j = 1; j <= this.minSwingStrength; j++) {
          if (i + j < lows.length && lows[i + j] < current) {
            isSwingLow = false;
            break;
          }
        }
      }
      
      if (isSwingLow && current < swingLow) {
        swingLow = current;
        swingLowIndex = i;
      }
    }
    
    if (swingHighIndex === -1 || swingLowIndex === -1) {
      // 如果没找到，使用最近的高低点
      const recentHighs = highs.slice(startIndex, endIndex);
      const recentLows = lows.slice(startIndex, endIndex);
      swingHigh = Math.max(...recentHighs);
      swingLow = Math.min(...recentLows);
      swingHighIndex = recentHighs.indexOf(swingHigh) + startIndex;
      swingLowIndex = recentLows.indexOf(swingLow) + startIndex;
    }
    
    return {
      swingHigh,
      swingLow,
      swingHighIndex,
      swingLowIndex,
    };
  }

  /**
   * 计算 SL/TP
   * 
   * @param side 'long' | 'short'
   * @param entryPrice 入场价格
   * @param highs 历史最高价数组
   * @param lows 历史最低价数组
   * @param currentIndex 当前索引
   * @param timeframe 可选时间框架覆盖
   */
  calculate(
    side: 'long' | 'short',
    entryPrice: number,
    highs: number[],
    lows: number[],
    currentIndex: number,
    timeframe?: TimeFrame
  ): StopLossTakeProfit | null {
    // 如果指定了不同时间框架，临时切换
    const originalTimeframe = this.timeframe;
    if (timeframe && timeframe !== this.timeframe) {
      this.timeframe = timeframe;
      const config = SLTPCalculator.TIMEFRAME_CONFIG[timeframe];
      this.lookbackPeriod = config.lookback;
      this.minSwingStrength = config.strength;
    }

    try {
      // 查找 Swing Levels
      const swingLevels = this.findSwingLevels(highs, lows, currentIndex);
      if (!swingLevels) return null;

      let stopLoss: number;
      let stopDistance: number;
      const reasoning: string[] = [];
      const tf = this.timeframe;

      if (side === 'long') {
        // 做多: SL 设置在 Swing Low 下方
        const buffer = entryPrice * 0.002; // 0.2% 缓冲
        stopLoss = swingLevels.swingLow - buffer;
        stopDistance = entryPrice - stopLoss;

        reasoning.push(`[${tf}] 做多止损: Swing Low ${swingLevels.swingLow.toFixed(2)} - ${(buffer / entryPrice * 100).toFixed(2)}%缓冲`);
        reasoning.push(`Swing Low 形成于: ${currentIndex - swingLevels.swingLowIndex} 根K线前 (${this.getTimeAgo(currentIndex - swingLevels.swingLowIndex)})`);
      } else {
        // 做空: SL 设置在 Swing High 上方
        const buffer = entryPrice * 0.002; // 0.2% 缓冲
        stopLoss = swingLevels.swingHigh + buffer;
        stopDistance = stopLoss - entryPrice;

        reasoning.push(`[${tf}] 做空止损: Swing High ${swingLevels.swingHigh.toFixed(2)} + ${(buffer / entryPrice * 100).toFixed(2)}%缓冲`);
        reasoning.push(`Swing High 形成于: ${currentIndex - swingLevels.swingHighIndex} 根K线前 (${this.getTimeAgo(currentIndex - swingLevels.swingHighIndex)})`);
      }

      // 根据时间框架确保最小止损距离
      const minStopPercent = this.getMinStopPercent();
      const minStopDistance = entryPrice * minStopPercent;
      if (stopDistance < minStopDistance) {
        stopDistance = minStopDistance;
        if (side === 'long') {
          stopLoss = entryPrice - stopDistance;
        } else {
          stopLoss = entryPrice + stopDistance;
        }
        reasoning.push(`止损距离小于${tf}最小要求${(minStopPercent * 100).toFixed(2)}%，已调整`);
      }

      // 计算 TP (基于风险回报比)
      const tp1Distance = stopDistance * 1.2;   // 1:1.2 R/R (widened from 1:1)
      const tp2Distance = stopDistance * 1.8;   // 1:1.8 R/R (widened from 1:1.5)
      const tp3Distance = stopDistance * 2.5;   // 1:2.5 R/R (widened from 1:2)

      let takeProfits: { tp1: number; tp2: number; tp3: number };

      if (side === 'long') {
        takeProfits = {
          tp1: entryPrice + tp1Distance,
          tp2: entryPrice + tp2Distance,
          tp3: entryPrice + tp3Distance,
        };
      } else {
        takeProfits = {
          tp1: entryPrice - tp1Distance,
          tp2: entryPrice - tp2Distance,
          tp3: entryPrice - tp3Distance,
        };
      }

      reasoning.push(`风险距离: ${stopDistance.toFixed(2)} (${(stopDistance / entryPrice * 100).toFixed(2)}%)`);
      reasoning.push(`TP1 1:1.2: ${takeProfits.tp1.toFixed(2)} (${side === 'long' ? '+' : '-'}${(tp1Distance / entryPrice * 100).toFixed(2)}%)`);
      reasoning.push(`TP2 1:1.8: ${takeProfits.tp2.toFixed(2)} (${side === 'long' ? '+' : '-'}${(tp2Distance / entryPrice * 100).toFixed(2)}%)`);
      reasoning.push(`TP3 1:2.5: ${takeProfits.tp3.toFixed(2)} (${side === 'long' ? '+' : '-'}${(tp3Distance / entryPrice * 100).toFixed(2)}%)`);

      return {
        entryPrice,
        stopLoss,
        takeProfits,
        riskRewardRatios: {
          tp1: 1.2,
          tp2: 1.8,
          tp3: 2.5,
        },
        stopDistance,
        timeframe: this.timeframe,
        swingLevel: swingLevels,
        reasoning,
      };
    } finally {
      // 恢复原始时间框架
      if (timeframe && timeframe !== originalTimeframe) {
        this.timeframe = originalTimeframe;
        const config = SLTPCalculator.TIMEFRAME_CONFIG[originalTimeframe];
        this.lookbackPeriod = config.lookback;
        this.minSwingStrength = config.strength;
      }
    }
  }

  /**
   * 将K线数量转换为人类可读的时间
   */
  private getTimeAgo(bars: number): string {
    const tf = this.timeframe;
    const minutes: Record<TimeFrame, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };
    const totalMinutes = bars * minutes[tf];

    if (totalMinutes < 60) return `${totalMinutes}分钟`;
    if (totalMinutes < 1440) return `${Math.floor(totalMinutes / 60)}小时`;
    return `${Math.floor(totalMinutes / 1440)}天`;
  }

  /**
   * 批量计算 (用于回测)
   * @param timeframe 指定时间框架
   */
  calculateBatch(
    side: 'long' | 'short',
    entryPrice: number,
    highs: number[],
    lows: number[],
    timeframe?: TimeFrame
  ): StopLossTakeProfit | null {
    return this.calculate(side, entryPrice, highs, lows, highs.length, timeframe);
  }

  /**
   * 使用 ATR 计算 SL (备用方案)
   * @param timeframe 时间框架影响最小止损百分比
   */
  calculateWithATR(
    side: 'long' | 'short',
    entryPrice: number,
    atr: number,
    atrMultiplier: number = 2.0,
    timeframe?: TimeFrame
  ): StopLossTakeProfit {
    const tf = timeframe || this.timeframe;
    const stopDistance = Math.max(
      atr * atrMultiplier,
      entryPrice * SLTPCalculator.TIMEFRAME_CONFIG[tf].minStopPercent
    );

    let stopLoss: number;
    let takeProfits: { tp1: number; tp2: number; tp3: number };

    if (side === 'long') {
      stopLoss = entryPrice - stopDistance;
      takeProfits = {
        tp1: entryPrice + stopDistance * 1.2,
        tp2: entryPrice + stopDistance * 1.8,
        tp3: entryPrice + stopDistance * 2.5,
      };
    } else {
      stopLoss = entryPrice + stopDistance;
      takeProfits = {
        tp1: entryPrice - stopDistance * 1.2,
        tp2: entryPrice - stopDistance * 1.8,
        tp3: entryPrice - stopDistance * 2.5,
      };
    }

    return {
      entryPrice,
      stopLoss,
      takeProfits,
      riskRewardRatios: { tp1: 1.2, tp2: 1.8, tp3: 2.5 },
      stopDistance,
      timeframe: tf,
      swingLevel: { swingHigh: 0, swingLow: 0, swingHighIndex: -1, swingLowIndex: -1 },
      reasoning: [
        `[${tf}] ATR(${atrMultiplier}x)止损: ${stopDistance.toFixed(2)}`,
        `TP1: 1:1, TP2: 1:1.5, TP3: 1:2`,
      ],
    };
  }

  /**
   * 多时间框架 SL/TP 计算
   * 返回多个时间框架下的 SL/TP 用于对比验证
   */
  calculateMultiTimeframe(
    side: 'long' | 'short',
    entryPrice: number,
    ohlcvByTimeframe: Record<TimeFrame, { highs: number[]; lows: number[] }>
  ): Record<TimeFrame, StopLossTakeProfit | null> {
    const results: Partial<Record<TimeFrame, StopLossTakeProfit | null>> = {};

    for (const [tf, data] of Object.entries(ohlcvByTimeframe)) {
      if (isTimeFrame(tf)) {
        results[tf] = this.calculate(
          side,
          entryPrice,
          data.highs,
          data.lows,
          data.highs.length,
          tf
        );
      }
    }

    // The input is Record<TimeFrame, ...> so all TimeFrame keys are populated
    const fullResults: Record<TimeFrame, StopLossTakeProfit | null> = {
      '1m': results['1m'] ?? null,
      '5m': results['5m'] ?? null,
      '15m': results['15m'] ?? null,
      '1h': results['1h'] ?? null,
      '4h': results['4h'] ?? null,
      '1d': results['1d'] ?? null,
    };
    return fullResults;
  }

  /**
   * 获取指定时间框架的配置
   */
  static getTimeframeConfig(timeframe: TimeFrame) {
    return SLTPCalculator.TIMEFRAME_CONFIG[timeframe];
  }
}

export default SLTPCalculator;
