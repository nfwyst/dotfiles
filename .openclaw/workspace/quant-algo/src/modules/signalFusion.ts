/**
 * 信号融合模块
 * 
 * 职责: 融合策略引擎信号和LLM分析信号
 * 输出: 最终交易决策
 *
 * FIX: M5 — Added Information Coefficient (IC) analysis for dynamic signal
 * weighting. Per Grinold & Kahn's "Active Portfolio Management" (2nd ed.),
 * the Fundamental Law of Active Management states:
 *
 *   IR ≈ IC * sqrt(BR)
 *
 * where IR is the information ratio, IC is the information coefficient
 * (rank correlation between predicted and realised returns), and BR is
 * the breadth (number of independent bets). Weighting signal sources by
 * their rolling IC allocates risk budget to signals that demonstrably
 * predict forward returns while automatically down-weighting noise.
 */

import { StrategySignal } from './strategyEngine';
import { LLMTradingSignal } from './llmAnalysis';

export interface FusionResult {
  signal: StrategySignal;
  fusionInfo: {
    originalStrategy: string;
    llmSuggestion: string;
    agreement: 'strong' | 'moderate' | 'weak' | 'conflict';
    adjustment: string;
    // FIX: M5 — Expose IC metrics in fusion result for monitoring
    icMetrics?: {
      strategyIC: number;
      llmIC: number;
      signalCorrelation: number;
      dynamicWeights: { strategy: number; llm: number };
    };
  };
}

// ==================== FIX: M5 — Information Coefficient Tracker ====================

/**
 * InformationCoefficientTracker
 *
 * Tracks predicted vs actual returns for a signal source and computes the
 * rolling rank IC (Spearman correlation) over a configurable window.
 *
 * Reference: Grinold & Kahn, "Active Portfolio Management", Chapter 14 —
 * The Information Coefficient measures the quality of a forecast. A higher
 * IC implies greater skill in predicting cross-sectional returns.
 */
export class InformationCoefficientTracker {
  private predictions: number[] = [];
  private actuals: number[] = [];
  private windowSize: number;

  constructor(windowSize: number = 100) {
    this.windowSize = windowSize;
  }

  /**
   * Record a predicted return and the subsequent actual return.
   */
  addObservation(predicted: number, actual: number): void {
    this.predictions.push(predicted);
    this.actuals.push(actual);

    // Maintain rolling window
    if (this.predictions.length > this.windowSize) {
      this.predictions.shift();
      this.actuals.shift();
    }
  }

  /**
   * Compute the rolling rank IC (Spearman rank correlation) over the
   * current window. Returns 0 if insufficient data (< 5 observations).
   *
   * Spearman rho = 1 - (6 * sum(d_i^2)) / (n * (n^2 - 1))
   * where d_i is the difference in ranks for each paired observation.
   */
  getIC(): number {
    const n = this.predictions.length;
    if (n < 5) return 0; // Need minimum observations for meaningful IC

    const predRanks = computeRanks(this.predictions);
    const actualRanks = computeRanks(this.actuals);

    let sumD2 = 0;
    for (let i = 0; i < n; i++) {
      const d = predRanks[i]! - actualRanks[i]!;
      sumD2 += d * d;
    }

    // Spearman rank correlation formula
    const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
    return rho;
  }

  /**
   * Returns the number of observations currently in the window.
   */
  getObservationCount(): number {
    return this.predictions.length;
  }

  /**
   * Returns the raw predictions array (for correlation computation).
   */
  getPredictions(): number[] {
    return [...this.predictions];
  }

  /**
   * Reset the tracker.
   */
  reset(): void {
    this.predictions = [];
    this.actuals = [];
  }
}

// ==================== FIX: M5 — Rank & Correlation Utilities ====================

/**
 * Compute fractional ranks for an array of values.
 * Ties are handled by averaging the ranks of tied values.
 */
function computeRanks(values: number[]): number[] {
  const n = values.length;
  const indexed = values.map((v, i) => ({ value: v, index: i }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    // Find the end of the group of ties
    while (j < n - 1 && indexed[j + 1]!.value === indexed[j]!.value) {
      j++;
    }
    // Average rank for tied values (1-based)
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k]!.index] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * FIX: M5 — Compute Pearson correlation between two arrays of equal length.
 * Used for the signal decorrelation check.
 */
function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;

  let sumA = 0, sumB = 0, sumA2 = 0, sumB2 = 0, sumAB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i]!;
    sumB += b[i]!;
    sumA2 += a[i]! * a[i]!;
    sumB2 += b[i]! * b[i]!;
    sumAB += a[i]! * b[i]!;
  }

  const numerator = n * sumAB - sumA * sumB;
  const denominator = Math.sqrt(
    (n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB)
  );

  if (denominator === 0) return 0;
  return numerator / denominator;
}

// ==================== FIX: M5 — Module-level IC trackers ====================

// FIX: M5 — Persistent IC trackers for the two signal sources.
// These accumulate observations across calls to fuseSignals so that IC
// estimates converge as more data arrives.
const strategyICTracker = new InformationCoefficientTracker(100);
const llmICTracker = new InformationCoefficientTracker(100);

/**
 * FIX: M5 — Call this after the actual return for a period is known to
 * update the IC trackers. The caller should provide:
 * - strategyPrediction: the strategy signal's predicted return (e.g. strength * direction)
 * - llmPrediction: the LLM signal's predicted return
 * - actualReturn: the realised return for that period
 *
 * This should be called from the execution layer or PnL tracker once the
 * outcome is observed.
 */
export function updateICObservation(
  strategyPrediction: number,
  llmPrediction: number,
  actualReturn: number
): void {
  strategyICTracker.addObservation(strategyPrediction, actualReturn);
  llmICTracker.addObservation(llmPrediction, actualReturn);
}

/**
 * FIX: M5 — Retrieve the current IC trackers for external inspection /
 * monitoring.
 */
export function getICTrackers(): {
  strategy: InformationCoefficientTracker;
  llm: InformationCoefficientTracker;
} {
  return { strategy: strategyICTracker, llm: llmICTracker };
}

// ==================== Signal Fusion ====================

/**
 * 融合策略信号和LLM分析信号
 * 
 * 规则:
 * 1. 方向一致: 增强置信度
 * 2. 方向冲突: 降低置信度并警告
 * 3. LLM建议观望: 轻微调整
 *
 * FIX: M5 — Enhanced with IC-based dynamic weighting:
 *   weight_i = max(0, IC_i) / sum(max(0, IC_j))
 * per Grinold & Kahn's Fundamental Law. If all ICs are non-positive the
 * fusion outputs a neutral (hold) signal since no source demonstrates
 * forecasting skill.
 *
 * Additionally applies a decorrelation penalty: if the two signal sources
 * have Pearson correlation > 0.8, the weight of the lower-IC source is
 * halved to avoid double-counting overlapping information.
 */
export function fuseSignals(
  strategySignal: StrategySignal,
  llmSignal: LLMTradingSignal
): FusionResult {
  const strategyAction = strategySignal.type;
  const llmAction = llmSignal.type;
  
  // ---- FIX: M5 — IC-based dynamic weight computation ----
  const strategyIC = strategyICTracker.getIC();
  const llmIC = llmICTracker.getIC();

  // Compute signal decorrelation (Pearson on raw predictions)
  const stratPreds = strategyICTracker.getPredictions();
  const llmPreds = llmICTracker.getPredictions();
  const signalCorrelation = pearsonCorrelation(stratPreds, llmPreds);

  let strategyWeight: number;
  let llmWeight: number;

  const clampedStratIC = Math.max(0, strategyIC);
  const clampedLlmIC = Math.max(0, llmIC);
  const icSum = clampedStratIC + clampedLlmIC;

  // BUG 20 FIX: Change || to && — allICsNegative should be true only when BOTH trackers
  // have enough observations AND the sum is zero (i.e., both ICs are non-positive).
  const allICsNegative = icSum === 0 && (strategyICTracker.getObservationCount() >= 5 && llmICTracker.getObservationCount() >= 5);

  if (icSum > 0) {
    // FIX: M5 — Weight signals by their rolling IC
    strategyWeight = clampedStratIC / icSum;
    llmWeight = clampedLlmIC / icSum;

    // FIX: M5 — Decorrelation check: if signals are highly correlated
    // (correlation > 0.8), halve the weight of the lower-IC source to
    // avoid double-counting overlapping information content.
    if (signalCorrelation > 0.8) {
      if (strategyIC < llmIC) {
        strategyWeight *= 0.5;
      } else {
        llmWeight *= 0.5;
      }
      // Re-normalise after penalty
      const totalW = strategyWeight + llmWeight;
      if (totalW > 0) {
        strategyWeight /= totalW;
        llmWeight /= totalW;
      }
    }
  } else {
    // Insufficient data or no positive IC — use equal weights as baseline
    strategyWeight = 0.5;
    llmWeight = 0.5;
  }

  // ---- Agreement / confidence logic (preserved from original) ----
  
  let agreement: FusionResult['fusionInfo']['agreement'];
  let adjustment: string;
  let finalConfidence = strategySignal.confidence;
  let finalReasoning = [...strategySignal.reasoning];
  let finalType = strategySignal.type;

  // FIX: M5 — If all ICs are non-positive and we have enough data,
  // output a neutral hold signal.
  if (allICsNegative) {
    agreement = 'weak';
    finalType = 'hold';
    finalConfidence = 0;
    adjustment = 'All signal ICs non-positive — neutral output (Grinold & Kahn)';
    finalReasoning.push(
      `--- IC Analysis (Grinold & Kahn Fundamental Law) ---`,
      `Strategy IC: ${strategyIC.toFixed(4)} | LLM IC: ${llmIC.toFixed(4)}`,
      `All ICs non-positive: no source demonstrates forecasting skill.`,
      `Outputting neutral signal per Fundamental Law of Active Management.`,
    );
  }
  // 方向完全一致
  else if (llmAction === strategyAction) {
    agreement = 'strong';
    // FIX: M5 — IC-weighted confidence blend instead of flat +15%
    finalConfidence = Math.min(
      0.95,
      strategySignal.confidence * strategyWeight + llmSignal.confidence * llmWeight + 0.10
    );
    adjustment = `IC-weighted blend (strat=${strategyWeight.toFixed(2)}, llm=${llmWeight.toFixed(2)}) + agreement bonus`;
    
    // BUG 11 FIX: Use optional chaining for llmSignal.sentiment and llmSignal.riskAssessment
    finalReasoning.push(
      `--- LLM融合分析 ✅ ---`,
      `LLM确认: ${llmAction.toUpperCase()} (置信度${(llmSignal.confidence*100).toFixed(0)}%)`,
      `市场情绪: ${llmSignal?.sentiment ?? 'neutral'}`,
      `风险评估: ${llmSignal?.riskAssessment ?? 'medium'}`,
      `仓位建议: ${llmSignal.positionSizing.recommendation}`,
      `建议持仓: ${llmSignal.expectedHolding.min}-${llmSignal.expectedHolding.max}`,
      `--- IC Metrics (Grinold & Kahn) ---`,
      `Strategy IC: ${strategyIC.toFixed(4)} | LLM IC: ${llmIC.toFixed(4)}`,
      `Dynamic weights: strategy=${strategyWeight.toFixed(2)}, llm=${llmWeight.toFixed(2)}`,
      `Signal correlation: ${signalCorrelation.toFixed(4)}`,
    );
  }
  // LLM建议观望，但策略有方向
  else if (llmAction === 'hold' || llmAction === 'wait') {
    agreement = 'weak';
    // FIX: M5 — IC-weighted reduction: if LLM has high IC, trust its
    // "hold" call more strongly
    const holdPenalty = 0.85 - (llmWeight * 0.15); // 70%–85% depending on LLM IC
    finalConfidence = strategySignal.confidence * holdPenalty;
    adjustment = `IC-weighted hold penalty (factor=${holdPenalty.toFixed(2)}, llm_weight=${llmWeight.toFixed(2)})`;
    
    // BUG 11 FIX: Use optional chaining for llmSignal.sentiment
    finalReasoning.push(
      `--- LLM融合分析 ⚠️ ---`,
      `策略信号: ${strategyAction.toUpperCase()}`,
      `LLM建议: 观望`,
      `原因: ${llmSignal.reasoning[0]}`,
      `市场情绪: ${llmSignal?.sentiment ?? 'neutral'}`,
      `建议: 可跟随策略但控制仓位`,
      `--- IC Metrics (Grinold & Kahn) ---`,
      `Strategy IC: ${strategyIC.toFixed(4)} | LLM IC: ${llmIC.toFixed(4)}`,
      `Dynamic weights: strategy=${strategyWeight.toFixed(2)}, llm=${llmWeight.toFixed(2)}`,
      `Signal correlation: ${signalCorrelation.toFixed(4)}`,
    );
  }
  // 方向冲突
  else {
    agreement = 'conflict';
    // FIX: M5 — IC-weighted conflict resolution: the source with higher
    // IC gets more influence on the final confidence
    const conflictPenalty = 0.5 - (Math.abs(strategyWeight - llmWeight) * 0.1); // 40%-50%
    finalConfidence = strategySignal.confidence * conflictPenalty;
    adjustment = `IC-weighted conflict penalty (factor=${conflictPenalty.toFixed(2)})`;
    
    // BUG 11 FIX: Use optional chaining for llmSignal.sentiment and llmSignal.riskAssessment
    finalReasoning.push(
      `--- LLM融合分析 ❌ ---`,
      `⚠️ 严重分歧!`,
      `策略信号: ${strategyAction.toUpperCase()}`,
      `LLM分析: ${llmAction.toUpperCase()}`,
      `市场情绪: ${llmSignal?.sentiment ?? 'neutral'}`,
      `风险提示: ${llmSignal.warnings[0]}`,
      `建议: 暂停交易或大幅减仓`,
      `--- IC Metrics (Grinold & Kahn) ---`,
      `Strategy IC: ${strategyIC.toFixed(4)} | LLM IC: ${llmIC.toFixed(4)}`,
      `Dynamic weights: strategy=${strategyWeight.toFixed(2)}, llm=${llmWeight.toFixed(2)}`,
      `Signal correlation: ${signalCorrelation.toFixed(4)}`,
    );
  }
  
  // 构建最终信号
  // BUG 21 FIX: Use ?? instead of || for SL price to handle 0 correctly
  const fusedSignal: StrategySignal = {
    ...strategySignal,
    type: finalType,
    confidence: finalConfidence,
    reasoning: finalReasoning,
    // BUG 21 FIX: Use ?? so that a stopLoss price of 0 is not treated as falsy
    stopLoss: llmSignal.stopLoss?.price ?? strategySignal.stopLoss,
    takeProfits: strategySignal.takeProfits || {
      tp1: llmSignal.targets.tp1.price,
      tp2: llmSignal.targets.tp2.price,
      tp3: llmSignal.targets.tp3.price,
    },
  };
  
  return {
    signal: fusedSignal,
    fusionInfo: {
      originalStrategy: strategySignal.strategy,
      llmSuggestion: llmAction,
      agreement,
      adjustment,
      // FIX: M5 — Expose IC metrics for downstream monitoring / logging
      icMetrics: {
        strategyIC,
        llmIC,
        signalCorrelation,
        dynamicWeights: { strategy: strategyWeight, llm: llmWeight },
      },
    },
  };
}

export default fuseSignals;
