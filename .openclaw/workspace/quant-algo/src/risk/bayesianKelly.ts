/**
 * Bayesian Kelly Criterion Position Sizing
 * 
 * Based on SSRN 2025: "Optimal Betting with Parameter Uncertainty"
 * Implements Kelly fraction with Bayesian posterior uncertainty,
 * plus conservative scaling (1/4 to 1/2 Kelly).
 */

export interface TradeRecord {
  pnl: number;
  returnPct: number;
  timestamp: number;
}

export interface KellyConfig {
  /** Minimum trades before Kelly kicks in (use fixed fraction before) */
  minSampleSize: number;           // default: 30
  /** Kelly scaling factor [0.25, 0.5] — conservative */
  kellyFraction: number;           // default: 0.25 (quarter Kelly)
  /** Maximum position as fraction of equity */
  maxPositionFraction: number;     // default: 0.20
  /** Minimum position as fraction of equity */
  minPositionFraction: number;     // default: 0.01
  /** Lookback window for rolling stats */
  lookbackWindow: number;          // default: 100
  /** Half-life for exponential weighting (recent trades matter more) */
  halfLife: number;                // default: 50
  /** Maximum leverage multiplier */
  maxLeverage: number;             // default: 3
  /** Default fraction when insufficient data */
  defaultFraction: number;         // default: 0.02
}

export interface KellyResult {
  /** Raw Kelly fraction (can be > 1 or negative) */
  rawKelly: number;
  /** Scaled Kelly (after fraction scaling) */
  scaledKelly: number;
  /** Final position fraction (after clamping) */
  positionFraction: number;
  /** Position size in base currency */
  positionSize: number;
  /** Confidence in estimate (0-1 based on sample size) */
  confidence: number;
  /** Win rate used */
  winRate: number;
  /** Average win/loss ratio used */
  payoffRatio: number;
  /** Realized volatility used */
  realizedVolatility: number;
  /** Method used: 'kelly' | 'fixed' */
  method: 'kelly' | 'fixed';
}

export class BayesianKellyManager {
  private config: KellyConfig;
  private tradeHistory: TradeRecord[] = [];
  
  constructor(config?: Partial<KellyConfig>) {
    this.config = {
      minSampleSize: 30,
      kellyFraction: 0.25,
      maxPositionFraction: 0.20,
      minPositionFraction: 0.01,
      lookbackWindow: 100,
      halfLife: 50,
      maxLeverage: 3,
      defaultFraction: 0.02,
      ...config,
    };
  }
  
  /** Record a completed trade */
  recordTrade(trade: TradeRecord): void {
    this.tradeHistory.push(trade);
    // Keep only lookback window
    if (this.tradeHistory.length > this.config.lookbackWindow * 2) {
      this.tradeHistory = this.tradeHistory.slice(-this.config.lookbackWindow);
    }
  }
  
  /** Load historical trades (e.g., from state recovery) */
  loadHistory(trades: TradeRecord[]): void {
    this.tradeHistory = [...trades].slice(-this.config.lookbackWindow);
  }
  
  /**
   * Calculate optimal position size using Bayesian Kelly.
   * 
   * Kelly Formula: f* = (p * b - q) / b
   *   where p = win probability, q = 1-p, b = avg_win / avg_loss
   * 
   * Bayesian adjustment: Use posterior distribution of p and b,
   * then scale by confidence factor based on sample size.
   * 
   * @param equity - Current account equity
   * @param currentPrice - Current asset price
   * @param signalStrength - Signal confidence [0, 1]
   * @param realizedVol - Current realized volatility (annualized)
   */
  calculatePositionSize(
    equity: number,
    currentPrice: number,
    signalStrength: number = 0.5,
    realizedVol?: number
  ): KellyResult {
    const recentTrades = this.getRecentTrades();
    
    // Insufficient data -> fall back to fixed fraction
    if (recentTrades.length < this.config.minSampleSize) {
      const fixedSize = equity * this.config.defaultFraction / currentPrice;
      return {
        rawKelly: 0,
        scaledKelly: 0,
        positionFraction: this.config.defaultFraction,
        positionSize: fixedSize,
        confidence: recentTrades.length / this.config.minSampleSize,
        winRate: 0,
        payoffRatio: 0,
        realizedVolatility: realizedVol ?? 0,
        method: 'fixed',
      };
    }
    
    // Compute exponentially weighted statistics
    const stats = this.computeWeightedStats(recentTrades);
    
    // Bayesian posterior for win rate:
    // Prior: Beta(1, 1) (uniform), Updated: Beta(1 + wins, 1 + losses)
    const alpha = 1 + stats.wins;
    const beta = 1 + stats.losses;
    const posteriorMean = alpha / (alpha + beta);
    const posteriorVar = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    
    // Use posterior mean as win probability, adjusted for uncertainty
    const p = posteriorMean;
    const q = 1 - p;
    const b = stats.avgWin / Math.max(stats.avgLoss, 1e-10);
    
    // Raw Kelly
    const rawKelly = (p * b - q) / b;
    
    // BUG 8 FIX: Use effective sample size (weighted wins + weighted losses)
    // instead of raw trade count for confidence calculation.
    // The effective N is approximately halfLife / ln(2), but using the
    // actual weighted counts is more accurate.
    const effectiveN = stats.wins + stats.losses;
    const sampleConfidence = Math.min(1, Math.sqrt(effectiveN / this.config.minSampleSize));
    
    // Volatility adjustment: scale down in high-vol regimes
    const vol = realizedVol ?? stats.realizedVol;
    const volScaling = vol > 0 ? Math.min(1, 0.20 / vol) : 1; // target 20% vol
    
    // Signal strength modulation
    const signalMod = 0.5 + 0.5 * Math.max(0, Math.min(1, signalStrength));
    
    // Scaled Kelly with all adjustments
    const scaledKelly = rawKelly 
      * this.config.kellyFraction 
      * sampleConfidence 
      * volScaling 
      * signalMod;
    
    // Clamp to [minPosition, maxPosition]
    const positionFraction = Math.max(
      this.config.minPositionFraction,
      Math.min(this.config.maxPositionFraction, scaledKelly)
    );
    
    // If Kelly says don't bet (negative), use minimum
    const finalFraction = rawKelly <= 0 
      ? this.config.minPositionFraction 
      : positionFraction;
    
    const positionSize = (equity * finalFraction) / currentPrice;
    
    return {
      rawKelly,
      scaledKelly,
      positionFraction: finalFraction,
      positionSize,
      confidence: sampleConfidence * (1 - Math.sqrt(posteriorVar)),
      winRate: p,
      payoffRatio: b,
      realizedVolatility: vol,
      method: 'kelly',
    };
  }
  
  /** Get the recent trades within the lookback window */
  private getRecentTrades(): TradeRecord[] {
    return this.tradeHistory.slice(-this.config.lookbackWindow);
  }
  
  /** Compute exponentially weighted win/loss statistics */
  private computeWeightedStats(trades: TradeRecord[]): {
    wins: number; losses: number;
    avgWin: number; avgLoss: number;
    realizedVol: number;
  } {
    const n = trades.length;
    const lambda = Math.LN2 / this.config.halfLife;
    
    let weightedWins = 0, weightedLosses = 0;
    let weightedWinSum = 0, weightedLossSum = 0;
    let totalWeight = 0;
    let weightedReturnSum = 0;
    let weightedReturnSqSum = 0;
    
    for (let i = 0; i < n; i++) {
      const weight = Math.exp(-lambda * (n - 1 - i));
      totalWeight += weight;
      
      // BUG 9 FIX: pnl=0 trades classified as wins (>= 0) instead of losses
      if (trades[i]!.pnl >= 0) {
        weightedWins += weight;
        weightedWinSum += weight * trades[i]!.returnPct;
      } else {
        weightedLosses += weight;
        weightedLossSum += weight * Math.abs(trades[i]!.returnPct);
      }

      // BUG 13 FIX: Use same exponential weighting for volatility calculation
      weightedReturnSum += weight * trades[i]!.returnPct;
      weightedReturnSqSum += weight * trades[i]!.returnPct * trades[i]!.returnPct;
    }
    
    const wins = weightedWins;
    const losses = weightedLosses;
    const avgWin = weightedWins > 0 ? weightedWinSum / weightedWins : 0;
    const avgLoss = weightedLosses > 0 ? weightedLossSum / weightedLosses : 0.01;
    
    // BUG 13 FIX: Realized volatility using exponentially weighted variance
    // Weighted mean and weighted variance for annualized vol
    const weightedMean = totalWeight > 0 ? weightedReturnSum / totalWeight : 0;
    const weightedVariance = totalWeight > 0
      ? (weightedReturnSqSum / totalWeight) - (weightedMean * weightedMean)
      : 0;
    const CRYPTO_PERIODS_PER_YEAR = 365 * 288; // 5-min bars
    const realizedVol = Math.sqrt(Math.max(0, weightedVariance) * CRYPTO_PERIODS_PER_YEAR);
    
    return { wins, losses, avgWin, avgLoss, realizedVol };
  }
  
  /** Get current statistics summary */
  getStats(): { tradeCount: number; recentWinRate: number; kellyFraction: number } {
    const recent = this.getRecentTrades();
    // BUG 9 FIX: Consistent with the fix above, count pnl >= 0 as wins
    const wins = recent.filter(t => t.pnl >= 0).length;
    return {
      tradeCount: this.tradeHistory.length,
      recentWinRate: recent.length > 0 ? wins / recent.length : 0,
      kellyFraction: this.config.kellyFraction,
    };
  }
}
