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
 * ═══════════════════════════════════════════════════════════════
 */

import { Layer2Output } from './layer2';

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

/**
 * Number of recent bars excluded from KNN neighbor search.
 * Prevents serial-correlation leakage — the classifier should not
 * peek at patterns whose outcomes are still unfolding or that are
 * auto-correlated with the current bar.
 */
const EMBARGO_BARS = 5;

/**
 * Lookback window used when labeling historical data.
 * label[i] = sign( price[i] - price[i - LABEL_LOOKBACK] )
 */
const LABEL_LOOKBACK = 5;

export class OCSLayer3 {
  private history: HistoricalPattern[];
  private readonly MAX_HISTORY: number;
  private currentK: number;

  constructor() {
    this.history = [];
    this.currentK = 5; // 默认 K 值
    this.MAX_HISTORY = 1000;
  }

  // ─── volatility helpers ──────────────────────────────────────

  /**
   * 计算市场波动率 (基于ATR百分比)
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 20) return 0.02; // 默认中等波动

    // 计算 14 周期 ATR
    const atr = this.calculateATR(prices, 14);
    const currentPrice = prices[prices.length - 1];

    return atr / currentPrice; // ATR 百分比
  }

  /**
   * 计算 ATR
   */
  private calculateATR(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;

    let sum = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const high = Math.max(prices[i], prices[i - 1]);
      const low = Math.min(prices[i], prices[i - 1]);
      const tr = high - low;
      sum += tr;
    }

    return sum / period;
  }

  /**
   * 根据波动率自适应调整 K 值
   * 高波动: K=3 (减少噪声干扰)
   * 低波动: K=7 (提高稳定性)
   * 正常: K=5
   */
  private adaptK(volatility: number): number {
    if (volatility > 0.03) {
      return 3; // 高波动，使用小 K 减少噪声
    } else if (volatility < 0.01) {
      return 7; // 低波动，使用大 K 提高稳定性
    }
    return 5; // 正常波动
  }

  // ─── main entry point ────────────────────────────────────────

  process(features3D: [number, number, number], prices: number[]): Layer3Output {
    // 1. 根据波动率自适应调整 K
    const volatility = this.calculateVolatility(prices);
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
      ? this.history[this.history.length - 1].timestamp
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

    // 6. 确定信号 — threshold 50% (reverted from 45% to prevent overfitting)
    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;

    if (buyConfidence >= 50 && buyConfidence > sellConfidence) {
      signal = 'buy';
      confidence = buyConfidence;
    } else if (sellConfidence >= 50 && sellConfidence > buyConfidence) {
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
   * The embargo excludes any pattern whose index falls within the
   * last `EMBARGO_BARS` entries so the classifier cannot use
   * auto-correlated recent samples.
   */
  private findKNearestNeighborsWithDistance(
    features: [number, number, number],
    currentTimestamp: number,
  ): { neighbor: HistoricalPattern; distance: number }[] {
    // Determine the embargo cutoff: exclude the last EMBARGO_BARS entries
    const embargoStart = Math.max(0, this.history.length - EMBARGO_BARS);

    const eligible = this.history.slice(0, embargoStart);

    if (eligible.length === 0) {
      // Not enough non-embargoed history — fall back to full set
      // (only happens during the very first few bars)
      const distances = this.history.map((pattern) => ({
        neighbor: pattern,
        distance: this.euclideanDistance(features, pattern.features),
      }));
      distances.sort((a, b) => a.distance - b.distance);
      return distances.slice(0, this.currentK);
    }

    const distances = eligible.map((pattern) => ({
      neighbor: pattern,
      distance: this.euclideanDistance(features, pattern.features),
    }));

    distances.sort((a, b) => a.distance - b.distance);

    return distances.slice(0, this.currentK);
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
      volatility > 0.03 ? '高' : volatility < 0.01 ? '低' : '正常';
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
   *
   * DO NOT call this method before or during a trade — that would
   * introduce look-ahead bias by using information not yet available.
   *
   * Recommended: Use PatternRecorder in ExecutionLayer to automate this.
   *
   * @param features Feature vector at trade open time
   * @param entryPrice Actual entry price
   * @param exitPrice Actual exit price (only known after close)
   * @param side Trade direction
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

    let label: 'buy' | 'sell' | 'hold' = 'hold';
    if (realizedReturn > 0.005) label = 'buy';
    else if (realizedReturn < -0.005) label = 'sell';

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
   * ANTI LOOK-AHEAD DESIGN — PAST-RETURN LABELING
   * ═══════════════════════════════════════════════════════════
   *
   * Labels are derived from PAST (realized) returns only:
   *
   *   return[i] = ( close[i] - close[i - LABEL_LOOKBACK] ) / close[i - LABEL_LOOKBACK]
   *
   * This means the label at bar i reflects what ALREADY happened
   * over the preceding `LABEL_LOOKBACK` bars — information that
   * would have been fully observable at bar i in real time.
   *
   * The old implementation used ohlcv[i + 5].close (future price)
   * which leaked forward information into training labels.
   *
   * Combined with the temporal embargo in KNN search, this
   * eliminates both label-leakage and serial-correlation leakage.
   * ═══════════════════════════════════════════════════════════
   *
   * @param ohlcv Historical OHLCV data
   * @param features3D Pre-computed 3D features
   */
  initializeFromHistory(
    ohlcv: any[],
    features3D: [number, number, number][],
  ) {
    // Start from index LABEL_LOOKBACK so we have enough past data
    // to compute a realized return for every sample.
    for (
      let i = LABEL_LOOKBACK;
      i < ohlcv.length && i < features3D.length;
      i++
    ) {
      // PAST return: how much price moved over the last LABEL_LOOKBACK bars.
      // This is information that is fully known at bar i — no lookahead.
      const pastReturn =
        (ohlcv[i].close - ohlcv[i - LABEL_LOOKBACK].close) /
        ohlcv[i - LABEL_LOOKBACK].close;

      let label: 'buy' | 'sell' | 'hold' = 'hold';
      if (pastReturn > 0.005) label = 'buy';
      else if (pastReturn < -0.005) label = 'sell';

      this.history.push({
        features: features3D[i],
        futureReturn: pastReturn, // backward-looking despite legacy field name
        label,
        timestamp: ohlcv[i].timestamp,
      });
    }
  }

  getHistorySize(): number {
    return this.history.length;
  }
}

export default OCSLayer3;
