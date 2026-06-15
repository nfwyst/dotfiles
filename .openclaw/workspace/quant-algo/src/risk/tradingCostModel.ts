/**
 * Trading Cost Model
 * Goes beyond fixed fee rate to model realistic execution costs:
 * 1. Linear cost (spread + commission)
 * 2. Quadratic cost (market impact for large orders)
 * 3. Timing cost (delay between signal and execution)
 */

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface CostConfig {
  /** Base commission rate */
  commissionRate: number; // default: 0.001
  /** Typical half-spread in bps */
  halfSpreadBps: number; // default: 3
  /** Market impact coefficient */
  impactCoeff: number; // default: 0.1
  /** Average daily volume for the asset */
  avgDailyVolume: number; // default: 1e8
  /** Signal delay in milliseconds */
  signalDelayMs: number; // default: 500
}

export interface CostEstimate {
  /** Total estimated cost as fraction of trade value (in bps) */
  totalCostBps: number;
  /** Commission component */
  commissionBps: number;
  /** Spread component */
  spreadBps: number;
  /** Market impact component */
  impactBps: number;
  /** Timing cost component */
  timingCostBps: number;
  /** Net return after costs */
  netReturnAfterCosts: number;
  /** Break-even holding period (bars) */
  breakEvenBars: number;
}

// ────────────────────────────────────────────────────────────────
// Trading Cost Model
// ────────────────────────────────────────────────────────────────

/** Number of 5-minute bars in a year for crypto (365 * 288). */
const BARS_PER_YEAR = 365 * 288;

export class TradingCostModel {
  private config: CostConfig;
  private recentVolatility: number = 0;

  constructor(config?: Partial<CostConfig>) {
    this.config = {
      commissionRate: config?.commissionRate ?? 0.001,
      halfSpreadBps: config?.halfSpreadBps ?? 3,
      impactCoeff: config?.impactCoeff ?? 0.1,
      avgDailyVolume: config?.avgDailyVolume ?? 1e8,
      signalDelayMs: config?.signalDelayMs ?? 500,
    };
  }

  /**
   * Estimate round-trip cost for a trade.
   *
   * @param orderSize - Notional order size in quote currency (e.g. USDT)
   * @param currentPrice - Current asset price
   * @param volatility - Current volatility (per-bar by default; see isAnnualized)
   * @param expectedReturn - Expected return from the trade (as decimal, e.g. 0.01 = 1%)
   * @param isAnnualized - If true, volatility is annualized and will be converted
   *                        to per-bar: perBarVol = vol / sqrt(365 * 288).
   *                        BUG 6 FIX: Explicit parameter to handle annualized vol.
   */
  estimateCost(
    orderSize: number,
    currentPrice: number,
    volatility: number,
    expectedReturn: number,
    isAnnualized?: boolean,
  ): CostEstimate {
    // BUG 6 FIX: Convert annualized vol to per-bar vol if flagged
    const perBarVol = isAnnualized
      ? volatility / Math.sqrt(BARS_PER_YEAR)
      : volatility;

    // Store per-bar volatility for internal use
    this.recentVolatility = perBarVol;

    // ── Commission (round-trip = 2x) ──────────────────────────
    const commissionBps = this.config.commissionRate * 2 * 10000; // Convert to bps

    // ── Spread (round-trip = 2 * half-spread) ─────────────────
    const spreadBps = this.config.halfSpreadBps * 2;

    // ── Market impact ─────────────────────────────────────────
    const dailyVol = this.config.avgDailyVolume;
    const impactBps = this.computeMarketImpact(orderSize, currentPrice, dailyVol);

    // ── Timing cost ───────────────────────────────────────────
    const timingCostBps = this.computeTimingCost(
      perBarVol,
      this.config.signalDelayMs,
    );

    // ── Total cost ────────────────────────────────────────────
    const totalCostBps = commissionBps + spreadBps + impactBps + timingCostBps;

    // ── Net return after costs ────────────────────────────────
    const totalCostDecimal = totalCostBps / 10000;
    const netReturnAfterCosts = expectedReturn - totalCostDecimal;

    // ── Break-even holding period ─────────────────────────────
    // How many bars you need to hold to overcome costs, given
    // an assumed per-bar edge = expectedReturn / typical_holding_bars.
    // If expected return is zero or negative, break-even is infinite.
    let breakEvenBars: number;
    if (expectedReturn <= 0 || perBarVol <= 0) {
      breakEvenBars = Infinity;
    } else {
      // Assume expected return is for a single trade.
      // Break-even = totalCost / (expectedReturn per bar)
      // Rough model: per-bar return ~ expectedReturn / sqrt(holding_period)
      // Simplified: bars needed ~ (totalCost / expectedReturn)^2
      const ratio = totalCostDecimal / expectedReturn;
      if (ratio >= 1) {
        breakEvenBars = Infinity; // Cost exceeds expected return
      } else {
        // Simple linear model: bars = totalCost / per_bar_edge
        // per_bar_edge ~ expectedReturn (for a single-bar trade)
        breakEvenBars = Math.ceil(totalCostDecimal / expectedReturn);
        if (breakEvenBars < 1) breakEvenBars = 1;
      }
    }

    return {
      totalCostBps,
      commissionBps,
      spreadBps,
      impactBps,
      timingCostBps,
      netReturnAfterCosts,
      breakEvenBars,
    };
  }

  /** Update volatility estimate (per-bar volatility) */
  updateVolatility(vol: number, isAnnualized?: boolean): void {
    // BUG 6 FIX: Also handle annualized vol in updateVolatility
    this.recentVolatility = isAnnualized
      ? vol / Math.sqrt(BARS_PER_YEAR)
      : vol;
  }

  /**
   * Market impact: Almgren-Chriss square-root model.
   *
   * Impact (bps) = impactCoeff * sigma * sqrt(orderSize / ADV)
   *
   * where:
   *   sigma = daily volatility in bps
   *   orderSize / ADV = participation rate
   *
   * Reference: Almgren & Chriss, "Optimal Execution of Portfolio Transactions" (2001)
   */
  private computeMarketImpact(
    orderSize: number,
    currentPrice: number,
    dailyVol: number,
  ): number {
    if (dailyVol <= 0 || currentPrice <= 0) return 0;

    // Convert order size to number of units
    const orderUnits = orderSize / currentPrice;

    // Participation rate: fraction of daily volume
    const participationRate = orderUnits / dailyVol;

    // If participation rate is negligible, impact is near zero
    if (participationRate < 1e-8) return 0;

    // BUG 6 FIX: Daily volatility in bps using per-bar volatility.
    // Per-bar vol * sqrt(288 bars/day) = daily vol, then * 10000 for bps.
    const dailyVolBps = this.recentVolatility * Math.sqrt(288) * 10000;

    // Almgren-Chriss square-root model
    const impactBps =
      this.config.impactCoeff * dailyVolBps * Math.sqrt(participationRate);

    // Round-trip: impact on both entry and exit
    return impactBps * 2;
  }

  /**
   * Timing cost from signal delay.
   *
   * Models the expected price slippage during the delay between
   * signal generation and order execution.
   *
   * Cost = volatility * sqrt(delay_fraction_of_bar)
   * Expressed in bps.
   *
   * For a 5-min bar (300,000 ms), a 500ms delay is 0.167% of a bar.
   */
  private computeTimingCost(volatility: number, delayMs: number): number {
    if (volatility <= 0 || delayMs <= 0) return 0;

    // Bar duration in ms (assuming 5-min bars)
    const barDurationMs = 5 * 60 * 1000; // 300,000 ms

    // Fraction of a bar that the delay represents
    const delayFraction = delayMs / barDurationMs;

    // Expected price movement during delay (random walk model):
    // E[|dP|] = vol_per_bar * sqrt(delayFraction)
    // BUG 6 FIX: volatility parameter here is already per-bar vol
    const volPerBar = volatility;
    const expectedSlippage = volPerBar * Math.sqrt(delayFraction);

    // Convert to bps (round-trip)
    return expectedSlippage * 10000 * 2;
  }
}
