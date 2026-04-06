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
import TRIXSystem from './trixSystem';
import DerivativeFilter from './derivativeFilter';
import ElasticVolumeMA from './elasticVolumeMA';

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

  constructor() {
    this.gaussian = new GaussianStructure();
    this.cvdAnalyzer = new CVDAnalyzer();
    this.trix = new TRIXSystem();
    this.derivative = new DerivativeFilter();
    this.elasticVMA = new ElasticVolumeMA();
  }

  enhance(
    ohlcv: { open: number; high: number; low: number; close: number; volume: number }[],
    originalLayer2Output: any,
    originalLayer3Output: any
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
      latestDerivative
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
        isSignificantMove: latestDerivative.isSignificantMove,
      },
      combinedSignal: combined,
    };
  }

  private combineSignals(
    originalLayer3: any,
    trixSignal: any,
    derivativeAdvice: any,
    cvdDivergence: CVDDivergence | null,
    derivativeData: any
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
