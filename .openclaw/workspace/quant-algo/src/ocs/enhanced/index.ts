/**
 * OCS enhanced 完整集成模块
 * 
 * 整合所有enhanced高级功能:
 * - GaussianStructure (高斯结构框架)
 * - CVDAnalyzer (CVD背离信号)
 * - TRIXSystem (TRIX系统)
 * - DerivativeFilter (导数过滤器)
 * - ElasticVolumeMA (弹性成交量MA)
 */

import GaussianStructure from './gaussianStructure';
import CVDAnalyzer, { CVDDivergence } from './cvdDivergence';
import TRIXSystem, { TRIXData } from './trixSystem';
import DerivativeFilter, { DerivativeData } from './derivativeFilter';
import ElasticVolumeMA, { ElasticVMAData } from './elasticVolumeMA';
import type { Layer2Output } from '../layer2';
import type { Layer3Output } from '../layer3';

export interface OCSEnhancedOutput {
  layer1Enhanced: {
    gaussianSmoothed: number;
  };
  layer2Enhanced: {
    elasticVMA: number;
    cvdDivergence: CVDDivergence | null;
  };
  layer3Enhanced: {
    trixSignal: 'buy' | 'sell' | 'hold';
    trixConfidence: number;
  };
  layer4Enhanced: {
    derivativeAdvice: 'buy' | 'sell' | 'hold' | 'exit';
    derivativeConfidence: number;
    isSignificantMove: boolean;
  };
  combinedSignal: {
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string[];
  };
}

export class OCSEnhanced {
  private gaussian: GaussianStructure;
  private cvdAnalyzer: CVDAnalyzer;
  private trix: TRIXSystem;
  private derivative: DerivativeFilter;
  private elasticVMA: ElasticVolumeMA;

  // ── Incremental cached state (updated by feedBar) ──
  private incrementalReady: boolean = false;
  private prevTrixData: TRIXData | null = null;
  private lastTrixData: TRIXData | null = null;
  private lastDerivativeData: DerivativeData | null = null;
  private lastDerivativeAdvice: { action: 'buy' | 'sell' | 'hold' | 'exit'; confidence: number; reasoning: string[] } | null = null;
  private lastTrixSignal: { action: 'buy' | 'sell' | 'hold'; confidence: number; reasoning: string[] } | null = null;
  private lastCvdDivergence: CVDDivergence | null = null;
  private lastElasticVMAData: ElasticVMAData | null = null;
  private lastGaussianSmoothed: number = 0;

  // Gaussian needs a sliding window of recent closes for smoothLast
  private gaussianBuffer: number[];
  private gaussianBufHead: number = 0;
  private gaussianBufCount: number = 0;
  private gaussianBufCapacity: number = 20; // default window size

  constructor() {
    this.gaussian = new GaussianStructure();
    this.cvdAnalyzer = new CVDAnalyzer();
    this.trix = new TRIXSystem();
    this.derivative = new DerivativeFilter();
    this.elasticVMA = new ElasticVolumeMA();
    this.gaussianBuffer = new Array(this.gaussianBufCapacity).fill(0);
  }

  /**
   * Reset all incremental sub-processor state.
   * Call before starting a new backtest or switching symbols.
   */
  resetIncremental(): void {
    this.trix.reset();
    this.derivative.reset();
    this.cvdAnalyzer.reset();
    this.elasticVMA.reset();
    this.incrementalReady = false;
    this.prevTrixData = null;
    this.lastTrixData = null;
    this.lastDerivativeData = null;
    this.lastDerivativeAdvice = null;
    this.lastTrixSignal = null;
    this.lastCvdDivergence = null;
    this.lastElasticVMAData = null;
    this.lastGaussianSmoothed = 0;
    this.gaussianBufHead = 0;
    this.gaussianBufCount = 0;
    this.gaussianBuffer.fill(0);
  }

  /**
   * Feed warmup bars to build up incremental state.
   * Call this with the first N bars before switching to feedBar/getEnhancedOutput.
   */
  warmup(
    ohlcv: { open: number; high: number; low: number; close: number; volume: number }[],
    dominantCycle?: number
  ): void {
    this.resetIncremental();
    if (dominantCycle) {
      this.elasticVMA.updateDominantCycle(dominantCycle);
    }
    for (const candle of ohlcv) {
      this.feedBarInternal(candle);
    }
    this.incrementalReady = true;
  }

  /**
   * Internal: feed a single bar and update all cached incremental state.
   */
  private feedBarInternal(candle: { open: number; high: number; low: number; close: number; volume: number }): void {
    // ── TRIX ──
    this.prevTrixData = this.lastTrixData;
    this.lastTrixData = this.trix.updateBar(candle.close);
    if (this.prevTrixData && this.lastTrixData) {
      this.lastTrixSignal = this.trix.generateSignalFromData(this.lastTrixData, this.prevTrixData);
    } else {
      this.lastTrixSignal = { action: 'hold', confidence: 30, reasoning: ['TRIX warming up'] };
    }

    // ── Derivative ──
    this.lastDerivativeData = this.derivative.updateBar(candle.close);
    this.lastDerivativeAdvice = this.derivative.getTradingAdviceFromData(this.lastDerivativeData);

    // ── CVD ──
    const { divergence } = this.cvdAnalyzer.updateBar(candle);
    this.lastCvdDivergence = divergence;

    // ── ElasticVMA ──
    this.lastElasticVMAData = this.elasticVMA.updateBar(candle.close, candle.volume);

    // ── Gaussian: update circular buffer ──
    if (this.gaussianBufCount < this.gaussianBufCapacity) {
      this.gaussianBufCount++;
    }
    this.gaussianBuffer[this.gaussianBufHead] = candle.close;
    this.gaussianBufHead = (this.gaussianBufHead + 1) % this.gaussianBufCapacity;

    // Compute smoothLast on circular buffer (O(windowSize) = O(20))
    const cap = this.gaussianBufCapacity;
    const gaussData: number[] = new Array(this.gaussianBufCount);
    const start = (this.gaussianBufHead - this.gaussianBufCount + cap * 2) % cap;
    for (let k = 0; k < this.gaussianBufCount; k++) {
      gaussData[k] = this.gaussianBuffer[(start + k) % cap]!;
    }
    this.lastGaussianSmoothed = this.gaussian.smoothLast(gaussData);
  }

  /**
   * Feed a single bar to update all sub-processor states (O(1) amortized).
   * MUST be called for EVERY bar to maintain correct state.
   * Does NOT combine signals — call getEnhancedOutput() when you need the result.
   */
  feedBar(
    candle: { open: number; high: number; low: number; close: number; volume: number },
    dominantCycle?: number
  ): void {
    if (dominantCycle) {
      this.elasticVMA.updateDominantCycle(dominantCycle);
    }
    this.feedBarInternal(candle);
  }

  /**
   * Get the enhanced output using the currently cached sub-processor states.
   * Call this AFTER feedBar() when you need the combined signal.
   * This is O(1) — just combines cached values.
   */
  getEnhancedOutput(
    originalLayer3Output: Layer3Output
  ): OCSEnhancedOutput {
    const trixSignal = this.lastTrixSignal || { action: 'hold' as const, confidence: 30, reasoning: ['TRIX warming up'] };
    const derivativeAdvice = this.lastDerivativeAdvice || { action: 'hold' as const, confidence: 30, reasoning: ['Derivative warming up'] };
    const derivativeData = this.lastDerivativeData || { isSignificantMove: false };
    const cvdDivergence = this.lastCvdDivergence;
    const elasticVMAData = this.lastElasticVMAData || { normalized: 0 };

    const combined = this.combineSignals(
      originalLayer3Output,
      trixSignal,
      derivativeAdvice,
      cvdDivergence,
      derivativeData
    );

    return {
      layer1Enhanced: {
        gaussianSmoothed: this.lastGaussianSmoothed,
      },
      layer2Enhanced: {
        elasticVMA: elasticVMAData.normalized,
        cvdDivergence,
      },
      layer3Enhanced: {
        trixSignal: trixSignal.action,
        trixConfidence: trixSignal.confidence,
      },
      layer4Enhanced: {
        derivativeAdvice: derivativeAdvice.action,
        derivativeConfidence: derivativeAdvice.confidence,
        isSignificantMove: 'isSignificantMove' in derivativeData ? derivativeData.isSignificantMove : false,
      },
      combinedSignal: combined,
    };
  }

  /**
   * Combined feedBar + getEnhancedOutput in one call (convenience wrapper).
   * Use when you need both state update AND output on the same bar.
   */
  enhanceIncremental(
    candle: { open: number; high: number; low: number; close: number; volume: number },
    originalLayer2Output: Layer2Output,
    originalLayer3Output: Layer3Output
  ): OCSEnhancedOutput {
    const dominantCycle = originalLayer2Output?.dominantCycle?.period || 20;
    this.feedBar(candle, dominantCycle);
    return this.getEnhancedOutput(originalLayer3Output);
  }

  /**
   * Original array-based enhance (kept for backward compatibility / warmup phase).
   */
  enhance(
    ohlcv: { open: number; high: number; low: number; close: number; volume: number }[],
    originalLayer2Output: Layer2Output,
    originalLayer3Output: Layer3Output
  ): OCSEnhancedOutput {
    const closes = ohlcv.map(d => d.close);
    const volumes = ohlcv.map(d => d.volume);
    
    const gaussianResult = this.gaussian.smooth(closes);
    
    const dominantCycle = originalLayer2Output?.dominantCycle?.period || 20;
    const elasticVMAData = this.elasticVMA.calculateLatest(closes, volumes, dominantCycle);
    
    const cvdDivergence = this.cvdAnalyzer.detectDivergence(
      closes,
      this.cvdAnalyzer.calculateCVD(ohlcv),
      closes.length - 1
    );
    
    const trixSignal = this.trix.generateSignal(closes);
    
    const derivativeAdvice = this.derivative.getTradingAdvice(closes);
    const derivativeData = this.derivative.calculate(closes);
    const latestDerivative = derivativeData[derivativeData.length - 1];
    
    const combined = this.combineSignals(
      originalLayer3Output,
      trixSignal,
      derivativeAdvice,
      cvdDivergence,
      latestDerivative!
    );
    
    return {
      layer1Enhanced: {
        gaussianSmoothed: gaussianResult.value,
      },
      layer2Enhanced: {
        elasticVMA: elasticVMAData.normalized,
        cvdDivergence,
      },
      layer3Enhanced: {
        trixSignal: trixSignal.action,
        trixConfidence: trixSignal.confidence,
      },
      layer4Enhanced: {
        derivativeAdvice: derivativeAdvice.action,
        derivativeConfidence: derivativeAdvice.confidence,
        isSignificantMove: latestDerivative!.isSignificantMove,
      },
      combinedSignal: combined,
    };
  }

  private combineSignals(
    originalLayer3: Layer3Output,
    trixSignal: { action: 'buy' | 'sell' | 'hold'; confidence: number; reasoning: string[] },
    derivativeAdvice: { action: 'buy' | 'sell' | 'hold' | 'exit'; confidence: number; reasoning: string[] },
    cvdDivergence: CVDDivergence | null,
    derivativeData: DerivativeData | { isSignificantMove: boolean }
  ): { action: 'buy' | 'sell' | 'hold'; confidence: number; reasoning: string[] } {
    const votes = { buy: 0, sell: 0, hold: 0 };
    const confidenceScores = { buy: 0, sell: 0 };
    const reasoning: string[] = [];
    
    if (originalLayer3?.signal === 'buy') {
      votes.buy++;
      confidenceScores.buy += originalLayer3.confidence || 50;
      reasoning.push(`原始KNN: 买入 (${originalLayer3.confidence?.toFixed(0)}%)`);
    } else if (originalLayer3?.signal === 'sell') {
      votes.sell++;
      confidenceScores.sell += originalLayer3.confidence || 50;
      reasoning.push(`原始KNN: 卖出 (${originalLayer3.confidence?.toFixed(0)}%)`);
    }
    
    if (trixSignal.action === 'buy') {
      votes.buy++;
      confidenceScores.buy += trixSignal.confidence;
      reasoning.push(`TRIX: 买入 (${trixSignal.confidence}%)`);
    } else if (trixSignal.action === 'sell') {
      votes.sell++;
      confidenceScores.sell += trixSignal.confidence;
      reasoning.push(`TRIX: 卖出 (${trixSignal.confidence}%)`);
    }
    
    if (derivativeAdvice.action === 'buy') {
      votes.buy++;
      confidenceScores.buy += derivativeAdvice.confidence;
    } else if (derivativeAdvice.action === 'sell') {
      votes.sell++;
      confidenceScores.sell += derivativeAdvice.confidence;
    }
    
    if (cvdDivergence?.type === 'bullish') {
      votes.buy += 2;
      confidenceScores.buy += cvdDivergence.strength;
      reasoning.push(`CVD背离: 看涨 ${cvdDivergence.strength.toFixed(0)}%`);
    } else if (cvdDivergence?.type === 'bearish') {
      votes.sell += 2;
      confidenceScores.sell += cvdDivergence.strength;
      reasoning.push(`CVD背离: 看跌 ${cvdDivergence.strength.toFixed(0)}%`);
    }
    
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 50;
    
    if (votes.buy > votes.sell && votes.buy >= 2) {
      action = 'buy';
      confidence = Math.min(95, confidenceScores.buy / votes.buy);
    } else if (votes.sell > votes.buy && votes.sell >= 2) {
      action = 'sell';
      confidence = Math.min(95, confidenceScores.sell / votes.sell);
    } else {
      reasoning.push('信号分歧');
    }
    
    return { action, confidence, reasoning };
  }
}

export { GaussianStructure, CVDAnalyzer, TRIXSystem, DerivativeFilter, ElasticVolumeMA };
export type { CVDDivergence };
export default OCSEnhanced;
