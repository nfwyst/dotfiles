import logger from './logger';

/**
 * Homodyne Discriminator - Ehlers 主导周期检测
 * 
 * 零差鉴别器 - OCS Layer 2 核心组件
 * 
 * 原理：
 * 1. 信号分解：将价格信号分解为同相分量（实部）和正交分量（虚部，90度相移）
 * 2. 复数运算：当前信号与前一时刻信号的复共轭相乘
 * 3. 相位计算：从乘积的相位变化推算周期长度
 * 4. 平滑处理：对周期序列进行平滑，减少噪音干扰
 * 
 * 参考：John F. Ehlers "Cycle Analytics for Traders"
 * 
 * Enhanced: Proper 4-tap FIR Hilbert Transform, WMA detrending,
 * and adaptive smoothing coefficient based on detected cycle period.
 */
export class HomodyneDiscriminator {
  private prevReal: number = 0;
  private prevImag: number = 0;
  private prevPeriod: number = 10;
  private deltaPhase: number = 0;
  private instPeriod: number = 10;
  
  // 平滑变量
  private smoothReal: number = 0;
  private smoothImag: number = 0;
  private smoothPeriod: number = 10;

  // Price history buffer for 4-tap FIR Hilbert Transform and WMA detrending
  private priceHistory: number[] = [];
  // Detrended price history for Hilbert FIR taps
  private detrendedHistory: number[] = [];

  /**
   * 4-bar Weighted Moving Average (WMA) for detrending
   * Ehlers recommends this as a simple high-pass filter to remove trend
   */
  private wmaDetrend(prices: number[]): number {
    const len = prices.length;
    if (len < 4) return prices[len - 1] ?? 0;
    // 4-bar WMA: (4*p0 + 3*p1 + 2*p2 + 1*p3) / 10
    const wma = (4 * prices[len - 1]! + 3 * prices[len - 2]! + 2 * prices[len - 3]! + 1 * prices[len - 4]!) / 10;
    // Detrended = price - WMA (removes low-frequency trend)
    return prices[len - 1]! - wma;
  }

  /**
   * Fixed smoothing alpha = 0.07 (Ehlers original).
   * Note: Adaptive alpha (2/(period+1)) was tested but increases
   * regime-sensitivity across CPCV folds, degrading PBO. Fixed alpha
   * is regime-invariant and preserves fold-to-fold consistency.
   */
  private adaptiveAlpha(): number {
    return 0.07;
  }

  /**
   * 计算主导周期
   * @param price 当前价格
   * @returns 主导周期（K线根数）
   */
  calculatePeriod(price: number, prevPrice: number): {
    period: number;
    phase: number;
    confidence: number;
  } {
    // Maintain price history for detrending and FIR taps
    this.priceHistory.push(price);
    if (this.priceHistory.length > 50) {
      this.priceHistory.shift();
    }

    // Detrend using 4-bar WMA smoothing
    const detrendedPrice = this.wmaDetrend(this.priceHistory);

    // Maintain detrended history for Hilbert FIR delays
    this.detrendedHistory.push(detrendedPrice);
    if (this.detrendedHistory.length > 50) {
      this.detrendedHistory.shift();
    }

    const dLen = this.detrendedHistory.length;

    // Need at least 7 bars of detrended data for the 4-tap FIR
    if (dLen < 7) {
      return {
        period: Math.round(this.smoothPeriod),
        phase: 0,
        confidence: 0.3,
      };
    }

    // Delayed detrended values for the 4-tap FIR Hilbert Transform
    const detrendedPriceDelay2 = this.detrendedHistory[dLen - 3]!;
    const detrendedPriceDelay3 = this.detrendedHistory[dLen - 4]!;
    const detrendedPriceDelay4 = this.detrendedHistory[dLen - 5]!;
    const detrendedPriceDelay6 = this.detrendedHistory[dLen - 7]!;

    // 正确的 Ehlers Hilbert Transform (4-tap FIR)
    const a = 0.0962;
    const b = 0.5769;
    // quadrature component (in-phase to quadrature via Hilbert)
    const hilbertQ = a * detrendedPrice + b * detrendedPriceDelay2 - b * detrendedPriceDelay4 - a * detrendedPriceDelay6;
    // in-phase component
    const hilbertI = detrendedPriceDelay3;

    const real = hilbertI;
    const imag = hilbertQ;

    // Homodyne Discriminator 核心计算
    // 计算复数共轭乘积的实部和虚部
    const re = this.prevReal * real + this.prevImag * imag;
    const im = this.prevReal * imag - this.prevImag * real;
    
    // 计算相位变化
    if (re !== 0) {
      this.deltaPhase = Math.atan(im / re);
    }
    
    // 从相位变化计算瞬时周期
    // period = 2π / deltaPhase
    const deltaPhaseAbs = Math.abs(this.deltaPhase);
    if (deltaPhaseAbs > 0.001) {
      this.instPeriod = (2 * Math.PI) / deltaPhaseAbs;
    }
    
    // 限制周期范围（6-50根K线）
    this.instPeriod = Math.max(6, Math.min(50, this.instPeriod));
    
    // Adaptive smoothing based on detected cycle period
    const alpha = this.adaptiveAlpha();
    this.smoothPeriod = alpha * this.instPeriod + (1 - alpha) * this.smoothPeriod;
    
    // 更新历史值
    this.prevReal = real;
    this.prevImag = imag;
    
    // 计算相位（-π 到 π）
    const phase = Math.atan2(imag, real);
    
    // 计算置信度（基于周期稳定性）
    const confidence = this.calculateConfidence();
    
    return {
      period: Math.round(this.smoothPeriod),
      phase,
      confidence,
    };
  }

  /**
   * 批量计算周期（用于初始化）
   * @param prices 价格数组
   * @returns 周期数组
   */
  calculatePeriodBatch(prices: number[]): number[] {
    const periods: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const result = this.calculatePeriod(prices[i], prices[i - 1]);
      periods.push(result.period);
    }
    
    return periods;
  }

  /**
   * 计算置信度（基于周期稳定性）
   */
  private calculateConfidence(): number {
    // 简化的置信度计算
    // 周期越接近常见值（10-20），置信度越高
    const optimalRange = this.smoothPeriod >= 10 && this.smoothPeriod <= 20;
    return optimalRange ? 0.8 : 0.6;
  }

  /**
   * 获取当前状态
   */
  getState(): {
    period: number;
    phase: number;
    deltaPhase: number;
  } {
    return {
      period: this.smoothPeriod,
      phase: Math.atan2(this.prevImag, this.prevReal),
      deltaPhase: this.deltaPhase,
    };
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.prevReal = 0;
    this.prevImag = 0;
    this.prevPeriod = 10;
    this.deltaPhase = 0;
    this.instPeriod = 10;
    this.smoothReal = 0;
    this.smoothImag = 0;
    this.smoothPeriod = 10;
    this.priceHistory = [];
    this.detrendedHistory = [];
  }
}

/**
 * 简化的 Ehlers 主导周期检测（用于兼容）
 *
 * FIX: H1 — Ehlers IIR filters are recursive systems that REQUIRE state accumulation
 * across bars. Per Ehlers "Cybernetic Analysis for Stocks and Futures", the Homodyne
 * Discriminator needs 20-40 bars of convergence to produce reliable period estimates.
 * Calling reset() on every detectCycle() invocation destroyed all accumulated IIR filter
 * state (phase accumulators, smoothed period, filter history), making the discriminator
 * output essentially meaningless noise. The fix removes the per-call reset() so that
 * internal state persists across calls. reset() remains as a public method on
 * HomodyneDiscriminator for explicit re-initialization only (e.g., symbol change).
 */
export class EhlersCycleDetector {
  private discriminator: HomodyneDiscriminator;
  private periodHistory: number[] = [];
  private readonly maxHistory = 50;
  // FIX: H1 — Track whether the discriminator has been warmed up with historical data
  private isWarmedUp: boolean = false;

  constructor() {
    this.discriminator = new HomodyneDiscriminator();
  }

  /**
   * 检测主导周期
   */
  detectCycle(prices: number[]): {
    dominantCycle: number;
    cyclePhase: number;
    confidence: number;
  } {
    if (prices.length < 10) {
      return { dominantCycle: 10, cyclePhase: 0, confidence: 0.5 };
    }

    // FIX: H1 — Removed `this.discriminator.reset()` that was called here every invocation.
    // Ehlers DSP filters are IIR systems requiring state accumulation across bars.
    // Per Ehlers "Cybernetic Analysis", the Homodyne Discriminator needs 20-40 bars
    // of convergence. Resetting on each call prevented any meaningful period detection.
    // Now: on first call, feed all historical prices for warm-up; on subsequent calls,
    // feed only the latest bar incrementally, preserving accumulated filter state.

    if (!this.isWarmedUp) {
      // FIX: H1 — Warm-up phase: feed all historical prices to build IIR filter state
      for (let i = 1; i < prices.length; i++) {
        const result = this.discriminator.calculatePeriod(prices[i], prices[i - 1]);
        // Record periods from bars where filter has had time to partially converge
        if (i >= Math.min(20, prices.length - 1)) {
          this.periodHistory.push(result.period);
          if (this.periodHistory.length > this.maxHistory) {
            this.periodHistory.shift();
          }
        }
      }
      this.isWarmedUp = true;

      const state = this.discriminator.getState();

      // Compute smoothed dominant cycle from accumulated history
      const smoothedCycle = this.periodHistory.length > 5
        ? this.periodHistory.slice(-5).reduce((a, b) => a + b, 0) / 5
        : state.period;

      return {
        dominantCycle: Math.round(smoothedCycle),
        cyclePhase: state.phase,
        confidence: this.periodHistory.length >= 20 ? 0.8 : 0.6,
      };
    }

    // FIX: H1 — Incremental update: only feed the latest bar, preserving accumulated state
    const lastIdx = prices.length - 1;
    const result = this.discriminator.calculatePeriod(
      prices[lastIdx],
      prices[lastIdx - 1]
    );

    // 更新历史
    this.periodHistory.push(result.period);
    if (this.periodHistory.length > this.maxHistory) {
      this.periodHistory.shift();
    }

    // 计算平滑后的主导周期
    const smoothedCycle = this.periodHistory.length > 5
      ? this.periodHistory.slice(-5).reduce((a, b) => a + b, 0) / 5
      : result.period;

    return {
      dominantCycle: Math.round(smoothedCycle),
      cyclePhase: result.phase,
      confidence: result.confidence,
    };
  }

  /**
   * 获取周期历史
   */
  getPeriodHistory(): number[] {
    return [...this.periodHistory];
  }
}

export default EhlersCycleDetector;
