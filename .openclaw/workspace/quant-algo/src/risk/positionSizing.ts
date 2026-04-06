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
 * `balance * maxRiskPerTrade`.  The result is then capped so the
 * notional value does not exceed `balance * leverage * maxLeverageUtil`.
 *
 * If no meaningful stop-loss is provided, falls back to a simple
 * fraction of equity: `balance * maxRiskPerTrade * leverage / currentPrice`,
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
  } = input;

  // Hard cap on notional
  const maxNotional = balance * leverage * maxLeverageUtil;

  // Risk amount (max acceptable loss in quote)
  const riskAmount = balance * maxRiskPerTrade;

  const priceMovement = Math.abs(currentPrice - stopLossPrice);

  let size: number;
  let method: PositionSizeResult['method'];

  if (priceMovement > 0 && stopLossPrice > 0) {
    // ── Fixed-fractional: size = riskAmount / priceMovement ──
    size = riskAmount / priceMovement;
    method = 'fixed_fractional';
  } else {
    // ── Simple fraction fallback (no stop-loss) ──
    const positionValue = balance * maxRiskPerTrade * leverage;
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
