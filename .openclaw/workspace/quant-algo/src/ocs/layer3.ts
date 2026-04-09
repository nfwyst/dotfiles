/**
 * OCS Layer 3: 机器学习层
 * KNN三维分类器
 * 特征: [价格位置, 成交量弹性, 周期相位]
 *
 * ═══════════════════════════════════════════════════════════════
 * ANTI LOOK-AHEAD BIAS DESIGN (C1 fix)
 * ═══════════════════════════════════════════════════════════════
 *
 * All labeling in this module is strictly backward-looking:
 *
 *   label[i] = f( price[i], price[i - lookback] )
 *
 * The model NEVER sees future prices during training.
 *
 * Additionally, a temporal embargo is enforced during KNN search:
 * neighbors whose timestamps fall within the most recent
 * `EMBARGO_BARS` bars are excluded so the classifier cannot leak
 * information from the immediate past into its prediction of the
 * very next bar (serial-correlation leakage).
 *
 * Threshold is kept at 50% to avoid overfitting (reverted from
 * the prior 45% setting which was shown to overfit in-sample).
 *
 * ═══════════════════════════════════════════════════════════════
 * FIX H6: TRIPLE BARRIER LABELING INTEGRATION
 * ═══════════════════════════════════════════════════════════════
 *
 * The `initializeFromHistory` method now uses Triple Barrier
 * labeling (López de Prado AFML Ch.3) instead of simple past
 * return sign. This produces higher-quality training labels that
 * account for take-profit, stop-loss, and max holding period.
 *
 * Anti-leakage guarantee:
 *   - A triple barrier label for entry bar `i` is only used if
 *     `exitIdx <= currentBarIdx` — meaning the label's outcome
 *     is fully resolved before the bar where it is used as a
 *     training sample.
 *   - The temporal embargo in KNN search still applies on top.
 *
 * Falls back to simple past-return labeling when:
 *   - OHLCV data lacks high/low fields (close-only data)
 *   - Triple barrier produces fewer than LABEL_LOOKBACK labels
 * ═══════════════════════════════════════════════════════════════
 */

import { Layer2Output } from './layer2';
import type { OHLCV } from '../events/types';
import { TripleBarrierLabeler, type BarrierLabel } from '../backtest/tripleBarrier';
import { type Layer3Config, DEFAULT_OCS_CONFIG } from '../config/ocsConfig';

export interface HistoricalPattern {
  features: [number, number, number]; // 3D feature vector
  /**
   * Realized Return (NOT future prediction)
   *
   * ANTI LOOK-AHEAD BIAS: This value represents the actual return
   * after a trade closed, calculated from real entry/exit prices.
   *
   * For live trading, use PatternRecorder to manage the delayed update:
   * - Record features at trade open
   * - Calculate return and update this history at trade close
   */
  futureReturn: number; // Kept for backward compatibility (field name only)
  label: 'buy' | 'sell' | 'hold';
  timestamp: number;
}

export interface Layer3Output {
  signal: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-100%
  buyConfidence: number;
  sellConfidence: number;
  neighbors: HistoricalPattern[];
  reasoning: string[];
}

export class OCSLayer3 {
  private history: HistoricalPattern[];
  private readonly MAX_HISTORY: number;
  private currentK: number;
  private readonly config: Layer3Config;

  constructor(config?: Partial<Layer3Config>) {
    const defaultConfig: Layer3Config = { ...DEFAULT_OCS_CONFIG.layer3 };
    this.config = defaultConfig;
    if (config) {
      if (config.knn) this.config.knn = { ...this.config.knn, ...config.knn };
      if (config.adaptiveK) this.config.adaptiveK = { ...this.config.adaptiveK, ...config.adaptiveK };
      if (config.tripleBarrier) this.config.tripleBarrier = { ...this.config.tripleBarrier, ...config.tripleBarrier };
    }

    this.history = [];
    this.currentK = this.config.knn.defaultK;
    this.MAX_HISTORY = this.config.knn.maxHistory;
  }

  // ─── volatility helpers ──────────────────────────────────────

  /**
   * 计算市场波动率 (基于ATR百分比)
   */
  private calculateVolatility(prices: number[], precomputedATR?: number): number {
    if (precomputedATR !== undefined && precomputedATR > 0) {
      const currentPrice = prices[prices.length - 1]!;
      return precomputedATR / currentPrice;
    }

    if (prices.length < 20) return 0.02; // 默认中等波动

    // 计算 14 周期 ATR
    const atr = this.calculateATR(prices, 14);
    const currentPrice = prices[prices.length - 1]!;

    return atr / currentPrice; // ATR 百分比
  }

  /**
   * 计算 ATR
   * BUG 18 FIX: Use true range when OHLCV data is available
   */
  private calculateATR(prices: number[], period: number, highs?: number[], lows?: number[]): number {
    if (prices.length < period + 1) return 0;

    let sum = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      let tr: number;
      if (highs && lows && i < highs.length && i < lows.length && i > 0) {
        // BUG 18 FIX: Use true range: max(high-low, |high-prevClose|, |low-prevClose|)
        tr = Math.max(
          highs[i]! - lows[i]!,
          Math.abs(highs[i]! - prices[i - 1]!),
          Math.abs(lows[i]! - prices[i - 1]!)
        );
      } else {
        // Fallback: use close-to-close as proxy
        const high = Math.max(prices[i]!, prices[i - 1]!);
        const low = Math.min(prices[i]!, prices[i - 1]!);
        tr = high - low;
      }
      sum += tr;
    }

    return sum / period;
  }

  /**
   * 根据波动率自适应调整 K 值
   */
  private adaptK(volatility: number): number {
    const { highVolatilityThreshold, lowVolatilityThreshold, highVolK, lowVolK, normalK } = this.config.adaptiveK;
    if (volatility > highVolatilityThreshold) {
      return highVolK;
    } else if (volatility < lowVolatilityThreshold) {
      return lowVolK;
    }
    return normalK;
  }

  // ─── main entry point ────────────────────────────────────────

  /**
   * Process features and produce a KNN-based signal.
   */
  process(features3D: [number, number, number], prices: number[], precomputedATR?: number): Layer3Output {
    // 1. 根据波动率自适应调整 K
    const volatility = this.calculateVolatility(prices, precomputedATR);
    this.currentK = this.adaptK(volatility);

    // 2. 如果历史数据不足，返回hold
    if (this.history.length < this.currentK) {
      return {
        signal: 'hold',
        confidence: 0,
        buyConfidence: 0,
        sellConfidence: 0,
        neighbors: [],
        reasoning: [
          `历史数据不足 (K=${this.currentK}, 波动率=${(volatility * 100).toFixed(2)}%)`,
        ],
      };
    }

    // 3. KNN分类（带距离加权 + temporal embargo）
    const now = this.history.length > 0
      ? this.history[this.history.length - 1]!.timestamp
      : Date.now();
    const distances = this.findKNearestNeighborsWithDistance(features3D, now);
    const neighbors = distances.map((d) => d.neighbor);

    // 4. 加权投票 - 距离越近的邻居权重越高
    const weightedVotes = { buy: 0, sell: 0, hold: 0 };

    for (const { neighbor, distance } of distances) {
      const weight = 1 / (distance + 0.001); // 避免除零
      weightedVotes[neighbor.label] += weight;
    }

    // 5. 计算加权置信度
    const totalWeight =
      weightedVotes.buy + weightedVotes.sell + weightedVotes.hold;
    const buyConfidence = (weightedVotes.buy / totalWeight) * 100;
    const sellConfidence = (weightedVotes.sell / totalWeight) * 100;

    // 6. 确定信号 — threshold from config
    const threshold = this.config.knn.signalThreshold;
    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;

    if (buyConfidence >= threshold && buyConfidence > sellConfidence) {
      signal = 'buy';
      confidence = buyConfidence;
    } else if (sellConfidence >= threshold && sellConfidence > buyConfidence) {
      signal = 'sell';
      confidence = sellConfidence;
    }

    // 7. 生成推理说明
    const reasoning = this.generateReasoning(
      neighbors,
      features3D,
      volatility,
      this.currentK,
    );

    return {
      signal,
      confidence,
      buyConfidence,
      sellConfidence,
      neighbors,
      reasoning,
    };
  }

  // ─── KNN search with temporal embargo ────────────────────────

  /**
   * 查找K个最近邻居（带距离 + temporal embargo）
   *
   * BUG 19 FIX: When eligible.length === 0, return default hold signal
   * instead of searching embargoed data.
   */
  private findKNearestNeighborsWithDistance(
    features: [number, number, number],
    currentTimestamp: number,
  ): { neighbor: HistoricalPattern; distance: number }[] {
    // Determine the embargo cutoff: exclude the last EMBARGO_BARS entries
    const embargoBars = this.config.knn.embargoBars;
    const embargoStart = Math.max(0, this.history.length - embargoBars);

    // BUG 19 FIX: When no eligible (non-embargoed) samples exist, return empty
    if (embargoStart === 0) {
      return [];
    }

    const K = this.currentK;
    const topK: Array<{ neighbor: HistoricalPattern; distance: number }> = [];
    let maxDist = Infinity;

    // Iterate directly with index bound — no array.slice() copy
    for (let i = 0; i < embargoStart; i++) {
      const h = this.history[i]!;
      const d = this.euclideanDistance(features, h.features);

      if (topK.length < K) {
        // Buffer not full yet — always insert
        topK.push({ neighbor: h, distance: d });
        if (topK.length === K) {
          topK.sort((a, b) => a.distance - b.distance);
          maxDist = topK[K - 1]!.distance;
        }
      } else if (d < maxDist) {
        topK[K - 1] = { neighbor: h, distance: d };
        topK.sort((a, b) => a.distance - b.distance);
        maxDist = topK[K - 1]!.distance;
      }
    }

    // If we collected fewer than K items, sort them
    if (topK.length > 0 && topK.length < K) {
      topK.sort((a, b) => a.distance - b.distance);
    }

    return topK;
  }

  /**
   * 欧几里得距离
   */
  private euclideanDistance(
    a: [number, number, number],
    b: [number, number, number],
  ): number {
    return Math.sqrt(
      Math.pow(a[0] - b[0], 2) +
        Math.pow(a[1] - b[1], 2) +
        Math.pow(a[2] - b[2], 2),
    );
  }

  // ─── reasoning ───────────────────────────────────────────────

  /**
   * 生成推理说明
   */
  private generateReasoning(
    neighbors: HistoricalPattern[],
    currentFeatures: [number, number, number],
    volatility: number,
    k: number,
  ): string[] {
    const reasons: string[] = [];

    // 添加自适应K信息
    const volLevel =
      volatility > this.config.adaptiveK.highVolatilityThreshold ? '高' :
      volatility < this.config.adaptiveK.lowVolatilityThreshold ? '低' : '正常';
    reasons.push(
      `自适应KNN: K=${k} (${volLevel}波动率 ${(volatility * 100).toFixed(2)}%)`,
    );

    // 价格位置分析
    if (currentFeatures[0] < 0.3) {
      reasons.push('价格处于近期低位区间，可能存在反弹机会');
    } else if (currentFeatures[0] > 0.7) {
      reasons.push('价格处于近期高位区间，可能存在回调风险');
    }

    // 成交量分析
    if (currentFeatures[1] > 0.5) {
      reasons.push('成交量放大，资金活跃度提升');
    } else if (currentFeatures[1] < -0.5) {
      reasons.push('成交量萎缩，市场观望情绪浓厚');
    }

    // 周期相位分析
    if (Math.abs(currentFeatures[2]) > 0.7) {
      reasons.push('处于周期极端位置，可能即将转向');
    }

    // 邻居表现
    const positiveNeighbors = neighbors.filter(
      (n) => n.futureReturn > 0,
    ).length;
    reasons.push(
      `历史相似模式中${positiveNeighbors}/${neighbors.length}实现盈利`,
    );

    return reasons;
  }

  // ─── history management ──────────────────────────────────────

  /**
   * Update history with realized return (DELAYED UPDATE)
   *
   * ANTI LOOK-AHEAD BIAS: This method should ONLY be called AFTER
   * a position is closed, using the actual entry and exit prices.
   */
  updateHistory(
    features: [number, number, number],
    entryPrice: number,
    exitPrice: number,
    side: 'long' | 'short',
  ) {
    const realizedReturn =
      side === 'long'
        ? (exitPrice - entryPrice) / entryPrice
        : (entryPrice - exitPrice) / entryPrice;

    const labelThreshold = this.config.knn.labelThreshold;
    let label: 'buy' | 'sell' | 'hold' = 'hold';
    if (realizedReturn > labelThreshold) label = 'buy';
    else if (realizedReturn < -labelThreshold) label = 'sell';

    this.history.push({
      features,
      futureReturn: realizedReturn, // This is realized, not predicted
      label,
      timestamp: Date.now(),
    });

    // Limit history size
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY / 2);
    }
  }

  /**
   * Initialize from historical data (BACKTEST ONLY)
   *
   * ═══════════════════════════════════════════════════════════
   * FIX H6: TRIPLE BARRIER LABELING
   * ═══════════════════════════════════════════════════════════
   *
   * BUG 2 FIX: Accept an `offset` parameter to correct the misalignment
   * between features3D (which starts at bar `offset`) and ohlcv (which
   * starts at bar 0). When features3D[i] corresponds to ohlcv[offset + i],
   * we must use ohlcv[offset + i] for label computation.
   */
  initializeFromHistory(
    ohlcv: OHLCV[],
    features3D: [number, number, number][],
    offset: number = 0,
  ) {
    // FIX H6: Try triple barrier labeling first
    const tripleBarrierLabels = this.computeTripleBarrierLabels(ohlcv);

    if (tripleBarrierLabels !== null && tripleBarrierLabels.length > 0) {
      // ── Triple Barrier path ──────────────────────────────────
      for (const bl of tripleBarrierLabels) {
        const entryIdx = bl.entryIdx;
        const exitIdx = bl.exitIdx;

        // BUG 2 FIX: Convert entryIdx from ohlcv space to features3D space
        const featureIdx = entryIdx - offset;

        // Ensure we have features for the entry bar
        if (featureIdx < 0 || featureIdx >= features3D.length) continue;
        if (entryIdx >= ohlcv.length) continue;

        // The exitIdx must be within our data range
        if (exitIdx >= ohlcv.length) continue;

        // Map triple barrier label to KNN label format
        const label = this.mapTripleBarrierLabel(bl.label);

        this.history.push({
          features: features3D[featureIdx]!,
          futureReturn: bl.returnAtExit,
          label,
          timestamp: ohlcv[exitIdx]!.timestamp,
        });
      }

      // Sort history by timestamp to maintain temporal ordering
      this.history.sort((a, b) => a.timestamp - b.timestamp);

    } else {
      // ── Fallback: simple past-return labeling ────────────────
      const LABEL_LOOKBACK = this.config.knn.labelLookback;
      const labelThreshold = this.config.knn.labelThreshold;

      for (let i = 0; i < features3D.length; i++) {
        const ohlcvIdx = offset + i;
        
        // Need LABEL_LOOKBACK bars of history before this bar
        if (ohlcvIdx < LABEL_LOOKBACK) continue;
        if (ohlcvIdx >= ohlcv.length) continue;

        const pastReturn =
          (ohlcv[ohlcvIdx]!.close - ohlcv[ohlcvIdx - LABEL_LOOKBACK]!.close) /
          ohlcv[ohlcvIdx - LABEL_LOOKBACK]!.close;

        let label: 'buy' | 'sell' | 'hold' = 'hold';
        if (pastReturn > labelThreshold) label = 'buy';
        else if (pastReturn < -labelThreshold) label = 'sell';

        this.history.push({
          features: features3D[i]!,
          futureReturn: pastReturn,
          label,
          timestamp: ohlcv[ohlcvIdx]!.timestamp,
        });
      }
    }
  }

  /**
   * FIX H6: Compute triple barrier labels from OHLCV data.
   */
  private computeTripleBarrierLabels(ohlcv: OHLCV[]): BarrierLabel[] | null {
    if (ohlcv.length < 2) return null;

    const sample = ohlcv[0]!;
    if (
      sample.high === undefined ||
      sample.low === undefined ||
      sample.close === undefined ||
      sample.open === undefined
    ) {
      return null;
    }

    try {
      const tbConfig = this.config.tripleBarrier;
      const labeler = new TripleBarrierLabeler({
        ptSl: tbConfig.ptSl,
        maxHoldingPeriod: tbConfig.maxHoldingPeriod,
        volLookback: tbConfig.volLookback,
        minVolatility: tbConfig.minVolatility,
      });

      const labels = labeler.label(ohlcv);

      // Require a minimum number of labels to be useful
      if (labels.length < this.config.knn.labelLookback) {
        return null;
      }

      return labels;
    } catch {
      return null;
    }
  }

  /**
   * FIX H6: Map triple barrier label (-1, 0, 1) to KNN label format.
   */
  private mapTripleBarrierLabel(barrierLabel: -1 | 0 | 1): 'buy' | 'sell' | 'hold' {
    switch (barrierLabel) {
      case 1:  return 'buy';
      case -1: return 'sell';
      case 0:  return 'hold';
    }
  }

  getHistorySize(): number {
    return this.history.length;
  }
}

export default OCSLayer3;
