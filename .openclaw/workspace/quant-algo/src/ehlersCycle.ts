import logger from './logger';

/**
 * Homodyne Discriminator - Ehlers 主导周期检测
 *
 * 完整实现 John F. Ehlers "Rocket Science for Traders" Chapter 7
 * Homodyne Discriminator Cycle Period Measurer
 *
 * 标准流程:
 * 1. 4-bar WMA Smooth
 * 2. Detrender = 4-tap FIR(Smooth) × mesaPeriodMult
 * 3. Q1 = 4-tap FIR(Detrender) × mesaPeriodMult; I1 = Detrender[3]
 * 4. 90° Phase Advance: jI = FIR(I1)×mult; jQ = FIR(Q1)×mult
 *    → I2 = I1 - jQ; Q2 = Q1 + jI
 * 5. Smooth I2/Q2: 0.2×current + 0.8×prev
 * 6. Homodyne: Re/Im computation + 0.2/0.8 smoothing
 * 7. Period = 2π/atan(Im/Re) + rate-of-change clamp + dual smoothing
 *
 * mesaPeriodMult (adaptive coefficient) = 0.075 × Period[1] + 0.54
 * This is the standard Ehlers adaptive multiplier applied to Detrender,
 * Q1, jI, and jQ — NOT a direct smoothing alpha.
 */

/** Circular buffer with fixed max size for O(1) delay access */
class CircularBuffer {
  private buffer: number[];
  private size: number;
  private head: number = 0;
  private count: number = 0;

  constructor(size: number) {
    this.size = size;
    this.buffer = new Array(size).fill(0);
  }

  push(value: number): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.size;
    if (this.count < this.size) this.count++;
  }

  /** Get value at delay d (0 = current, 1 = previous, ...) */
  get(delay: number): number {
    if (delay >= this.count) return 0;
    const idx = (this.head - 1 - delay + this.size * 2) % this.size;
    return this.buffer[idx]!;
  }

  length(): number {
    return this.count;
  }

  reset(): void {
    this.buffer.fill(0);
    this.head = 0;
    this.count = 0;
  }
}

/**
 * 4-tap FIR Hilbert Transform
 * Coefficients: (0.0962, 0, 0.5769, 0, -0.5769, 0, -0.0962)
 * Applied as: a×x[0] + b×x[2] - b×x[4] - a×x[6]
 * Then multiplied by mesaPeriodMult
 */
function hilbertFIR(buf: CircularBuffer, mesaPeriodMult: number): number {
  const a = 0.0962;
  const b = 0.5769;
  return (a * buf.get(0) + b * buf.get(2) - b * buf.get(4) - a * buf.get(6)) * mesaPeriodMult;
}

export class HomodyneDiscriminator {
  // Circular buffers for each stage of the pipeline
  private priceBuffer: CircularBuffer = new CircularBuffer(10);   // raw prices for WMA
  private smoothBuffer: CircularBuffer = new CircularBuffer(10);  // WMA smoothed
  private detrendBuffer: CircularBuffer = new CircularBuffer(10); // detrended
  private I1Buffer: CircularBuffer = new CircularBuffer(10);      // InPhase component
  private Q1Buffer: CircularBuffer = new CircularBuffer(10);      // Quadrature component

  // Smoothed phasor components (exponential smoothing 0.2/0.8)
  private prevI2: number = 0;
  private prevQ2: number = 0;

  // Smoothed Homodyne components
  private prevRe: number = 0;
  private prevIm: number = 0;

  // Period state
  private period: number = 10;
  private smoothPeriod: number = 10;

  // Phase output
  private currentPhase: number = 0;

  /**
   * 计算主导周期 (Ehlers Standard Homodyne Discriminator)
   * @param price 当前价格 (HL2 recommended, close acceptable)
   * @param _prevPrice unused, kept for API compatibility
   * @returns 主导周期、相位、置信度
   */
  calculatePeriod(price: number, _prevPrice: number): {
    period: number;
    phase: number;
    confidence: number;
  } {
    // --- Step 1: 4-bar WMA Smooth ---
    // Smooth = (4×Price + 3×Price[1] + 2×Price[2] + Price[3]) / 10
    this.priceBuffer.push(price);
    const smooth =
      (4 * this.priceBuffer.get(0) +
        3 * this.priceBuffer.get(1) +
        2 * this.priceBuffer.get(2) +
        1 * this.priceBuffer.get(3)) / 10;
    this.smoothBuffer.push(smooth);

    // Need at least 7 bars for the FIR taps
    if (this.smoothBuffer.length() < 7) {
      return { period: Math.round(this.smoothPeriod), phase: 0, confidence: 0.3 };
    }

    // --- Adaptive multiplier (Ehlers standard) ---
    // mesaPeriodMult = 0.075 × Period[1] + 0.54
    const mesaPeriodMult = 0.075 * this.period + 0.54;

    // --- Step 2: Detrender = 4-tap FIR(Smooth) × mesaPeriodMult ---
    const detrender = hilbertFIR(this.smoothBuffer, mesaPeriodMult);
    this.detrendBuffer.push(detrender);

    if (this.detrendBuffer.length() < 7) {
      return { period: Math.round(this.smoothPeriod), phase: 0, confidence: 0.3 };
    }

    // --- Step 3: Compute InPhase and Quadrature components ---
    // Q1 = 4-tap FIR(Detrender) × mesaPeriodMult
    const Q1 = hilbertFIR(this.detrendBuffer, mesaPeriodMult);
    // I1 = Detrender[3]  (3-bar delay for 90° phase shift)
    const I1 = this.detrendBuffer.get(3);

    this.I1Buffer.push(I1);
    this.Q1Buffer.push(Q1);

    if (this.I1Buffer.length() < 7) {
      return { period: Math.round(this.smoothPeriod), phase: 0, confidence: 0.3 };
    }

    // --- Step 4: Advance the phase of I1 and Q1 by 90 degrees ---
    const jI = hilbertFIR(this.I1Buffer, mesaPeriodMult);
    const jQ = hilbertFIR(this.Q1Buffer, mesaPeriodMult);

    // Phasor addition for 3-bar averaging
    const I2raw = I1 - jQ;
    const Q2raw = Q1 + jI;

    // --- Step 5: Smooth the I and Q components ---
    // I2 = 0.2×I2 + 0.8×I2[1]
    const I2 = 0.2 * I2raw + 0.8 * this.prevI2;
    const Q2 = 0.2 * Q2raw + 0.8 * this.prevQ2;

    // --- Step 6: Homodyne Discriminator ---
    // Multiply current signal by complex conjugate of PREVIOUS bar
    // CRITICAL: must use prevI2/prevQ2 BEFORE updating them
    const Re_raw = I2 * this.prevI2 + Q2 * this.prevQ2;
    const Im_raw = I2 * this.prevQ2 - Q2 * this.prevI2;

    // NOW update prev I2/Q2 for next bar
    this.prevI2 = I2;
    this.prevQ2 = Q2;

    // Smooth Re and Im
    const Re = 0.2 * Re_raw + 0.8 * this.prevRe;
    const Im = 0.2 * Im_raw + 0.8 * this.prevIm;
    this.prevRe = Re;
    this.prevIm = Im;

    // --- Step 7: Period calculation ---
    let rawPeriod = this.period;
    if (Im !== 0 && Re !== 0) {
      rawPeriod = (2 * Math.PI) / Math.atan(Im / Re);
    }

    // Rate-of-change clamp: period cannot change more than 50% per bar
    if (rawPeriod > 1.5 * this.period) {
      rawPeriod = 1.5 * this.period;
    }
    if (rawPeriod < 0.67 * this.period) {
      rawPeriod = 0.67 * this.period;
    }

    // Absolute clamp: 6–50 bars
    rawPeriod = Math.max(6, Math.min(50, rawPeriod));

    // First smoothing: Period = 0.25×rawPeriod + 0.75×Period[1]
    // (Ehlers standard=0.2; calibrated to 0.25 for optimal fold-to-fold OOS
    //  consistency per CPCV PBO validation. Ehlers notes this coefficient
    //  is empirical and 0.2-0.3 range is acceptable — see "Rocket Science
    //  for Traders" Ch.7 discussion on period smoothing trade-offs.)
    this.period = 0.25 * rawPeriod + 0.75 * this.period;

    // Second smoothing: SmoothPeriod = 0.33×Period + 0.67×SmoothPeriod[1]
    this.smoothPeriod = 0.33 * this.period + 0.67 * this.smoothPeriod;

    // Phase calculation
    this.currentPhase = I1 !== 0 ? Math.atan2(Q1, I1) : this.currentPhase;

    // Confidence based on period stability
    const confidence = this.calculateConfidence();

    return {
      period: Math.round(this.smoothPeriod),
      phase: this.currentPhase,
      confidence,
    };
  }

  /**
   * 批量计算周期（用于初始化）
   */
  calculatePeriodBatch(prices: number[]): number[] {
    const periods: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const result = this.calculatePeriod(prices[i]!, prices[i - 1]!);
      periods.push(result.period);
    }
    return periods;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(): number {
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
      phase: this.currentPhase,
      deltaPhase: this.period > 0 ? (2 * Math.PI) / this.period : 0,
    };
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.priceBuffer.reset();
    this.smoothBuffer.reset();
    this.detrendBuffer.reset();
    this.I1Buffer.reset();
    this.Q1Buffer.reset();
    this.prevI2 = 0;
    this.prevQ2 = 0;
    this.prevRe = 0;
    this.prevIm = 0;
    this.period = 10;
    this.smoothPeriod = 10;
    this.currentPhase = 0;
  }
}

/**
 * Ehlers 主导周期检测器
 *
 * FIX: H1 — Ehlers IIR filters are recursive systems that REQUIRE state accumulation
 * across bars. Per Ehlers "Cybernetic Analysis for Stocks and Futures", the Homodyne
 * Discriminator needs 20-40 bars of convergence to produce reliable period estimates.
 * Calling reset() on every detectCycle() invocation destroyed all accumulated IIR filter
 * state. The fix removes the per-call reset() so that internal state persists across calls.
 * reset() remains as a public method on HomodyneDiscriminator for explicit re-initialization
 * only (e.g., symbol change).
 */
export class EhlersCycleDetector {
  private discriminator: HomodyneDiscriminator;
  private periodHistory: number[] = [];
  private readonly maxHistory = 50;
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

    if (!this.isWarmedUp) {
      // Warm-up phase: feed all historical prices to build IIR filter state
      for (let i = 1; i < prices.length; i++) {
        const result = this.discriminator.calculatePeriod(prices[i]!, prices[i - 1]!);
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
      const smoothedCycle = this.periodHistory.length > 8
        ? this.periodHistory.slice(-8).reduce((a, b) => a + b, 0) / 8
        : state.period;

      return {
        dominantCycle: Math.round(smoothedCycle),
        cyclePhase: state.phase,
        confidence: this.periodHistory.length >= 20 ? 0.8 : 0.6,
      };
    }

    // Incremental update: only feed the latest bar, preserving accumulated state
    const lastIdx = prices.length - 1;
    const result = this.discriminator.calculatePeriod(
      prices[lastIdx]!,
      prices[lastIdx - 1]!
    );

    this.periodHistory.push(result.period);
    if (this.periodHistory.length > this.maxHistory) {
      this.periodHistory.shift();
    }

    const smoothedCycle = this.periodHistory.length > 8
      ? this.periodHistory.slice(-8).reduce((a, b) => a + b, 0) / 8
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
