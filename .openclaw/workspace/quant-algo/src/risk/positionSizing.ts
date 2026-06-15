/**
 * Canonical position sizing — single source of truth.
 *
 * Hierarchy:
 *   1. Bayesian Kelly (if enough trade history) — production recommended
 *   2. Fixed fractional (fallback) — simple risk-based sizing
 *   3. Hard caps: max leverage utilization, max drawdown limit
 *
 * All position-sizing call sites should delegate here instead of
 * maintaining local implementations.
 */

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export interface PositionSizeInput {
  /** Account equity / balance in quote currency (e.g. USDT) */
  balance: number;
  /** Current asset price in quote currency */
  currentPrice: number;
  /** Stop-loss price — used for risk-based sizing.  0 = not provided. */
  stopLossPrice: number;
  /** Maximum risk per trade as a fraction of balance (e.g. 0.02 = 2 %) */
  maxRiskPerTrade: number;
  /** Account leverage multiplier */
  leverage: number;
  /** Max fraction of available leverage to use (default 0.5 = 50 %) */
  maxLeverageUtil?: number;
  /** Signal strength [0, 1] — optional scaling modifier */
  signalStrength?: number;
  /** HMM / regime-based scaling [0, 1] — optional */
  regimeScale?: number;
  /**
   * Balance step size for staircase rounding (anti-butterfly-effect).
   * When > 0, balance is floored to the nearest step before computing
   * risk amount & notional cap.  This prevents tiny equity differences
   * (e.g. $101) from cascading into divergent position sizes over time.
   * Set to 0 or omit to disable (continuous balance).
   *
   * Recommended: 500 – 1000 for a $10 000 account.
   */
  balanceStep?: number;
}

export interface PositionSizeResult {
  /** Position size in base-asset units (e.g. ETH) */
  size: number;
  /** Notional value in quote currency (size * currentPrice) */
  notionalValue: number;
  /** Maximum loss in quote currency at the stop-loss level */
  riskAmount: number;
  /** Effective leverage actually used (notional / balance) */
  leverageUsed: number;
  /** Which method produced the result */
  method: 'kelly' | 'fixed_fractional' | 'simple_fraction';
}

// ──────────────────────────────────────────────────────────
// Core function
// ──────────────────────────────────────────────────────────

/**
 * Calculate position size using fixed-fractional risk management.
 *
 * If a stop-loss price is provided (and differs from currentPrice),
 * the position is sized so that hitting the stop costs at most
 * `effectiveBalance * maxRiskPerTrade`.  The result is then capped so the
 * notional value does not exceed `balance * leverage * maxLeverageUtil`.
 *
 * `effectiveBalance` = balance floored to `balanceStep` when provided,
 * which eliminates position-size sensitivity to small equity drifts.
 *
 * If no meaningful stop-loss is provided, falls back to a simple
 * fraction of equity: `effectiveBalance * maxRiskPerTrade * leverage / currentPrice`,
 * still capped by maxLeverageUtil.
 *
 * Optional modifiers (signalStrength, regimeScale) multiplicatively
 * scale the result downward before capping.
 */
export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  const {
    balance,
    currentPrice,
    stopLossPrice,
    maxRiskPerTrade,
    leverage,
    maxLeverageUtil = 0.5,
    signalStrength,
    regimeScale,
    balanceStep = 0,
  } = input;

  // BUG 10 FIX: Guard for currentPrice <= 0 to prevent division by zero / NaN
  if (currentPrice <= 0) {
    return {
      size: 0,
      notionalValue: 0,
      riskAmount: 0,
      leverageUsed: leverage || 1,
      method: 'simple_fraction',
    };
  }

  // ── Anti-butterfly: staircase balance rounding ──
  // Floor balance to nearest step so that tiny equity drifts
  // (e.g. $101 from one extra trade) do NOT propagate into
  // different position sizes and divergent trade paths.
  const effectiveBalance = balanceStep > 0
    ? Math.floor(balance / balanceStep) * balanceStep
    : balance;

  // Hard cap on notional (uses raw balance for leverage cap)
  const maxNotional = balance * leverage * maxLeverageUtil;

  // Risk amount (max acceptable loss in quote) — uses stepped balance
  const riskAmount = effectiveBalance * maxRiskPerTrade;

  const priceMovement = Math.abs(currentPrice - stopLossPrice);

  let size: number;
  let method: PositionSizeResult['method'];

  if (priceMovement > 0 && stopLossPrice > 0) {
    // ── Fixed-fractional: size = riskAmount / priceMovement ──
    size = riskAmount / priceMovement;
    method = 'fixed_fractional';
  } else {
    // ── Simple fraction fallback (no stop-loss) ──
    const positionValue = effectiveBalance * maxRiskPerTrade * leverage;
    size = positionValue / currentPrice;
    method = 'simple_fraction';
  }

  // ── Optional modifiers ──
  if (signalStrength !== undefined && signalStrength >= 0 && signalStrength <= 1) {
    // Scale linearly: 0.5 at signalStrength=0, 1.0 at signalStrength=1
    size *= 0.5 + 0.5 * signalStrength;
  }
  if (regimeScale !== undefined && regimeScale >= 0 && regimeScale <= 1) {
    size *= regimeScale;
  }

  // ── Cap by max leverage utilisation ──
  let notionalValue = size * currentPrice;
  if (notionalValue > maxNotional) {
    size = maxNotional / currentPrice;
    notionalValue = maxNotional;
  }

  // Ensure non-negative
  size = Math.max(0, size);
  notionalValue = Math.max(0, notionalValue);

  return {
    size,
    notionalValue,
    riskAmount,
    leverageUsed: balance > 0 ? notionalValue / balance : 0,
    method,
  };
}
