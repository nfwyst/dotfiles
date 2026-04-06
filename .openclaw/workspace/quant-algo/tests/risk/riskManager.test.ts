import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock config and logger before importing the module under test
vi.mock('../../src/config', () => ({
  config: {
    initialBalance: 100,
    maxRiskPerTrade: 0.02,
    leverage: 50,
    riskManagement: {
      stopLossPercent: 0.015,
      takeProfitPercent: 0.03,
      trailingStopPercent: 0.01,
      maxPositions: 1,
      maxDailyLoss: 0.1,
      maxDailyTrades: 50,
      cooldownMinutes: 5,
      volatilityFilter: true,
      minVolatility: 0.002,
      maxVolatility: 0.02,
    },
    risk: {
      positionSizing: {
        kellyFraction: 0.25,
        maxPositionSize: 0.5,
        minPositionSize: 0.01,
      },
    },
  },
}));

vi.mock('../../src/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { RiskManager } from '../../src/riskManager';

// Position type from events/types (the one riskManager uses)
interface Position {
  side: 'long' | 'short' | 'none';
  size: number;
  entryPrice: number;
  leverage: number;
  unrealizedPnl: number;
  markPrice?: number;
  liquidationPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

describe('RiskManager', () => {
  let rm: RiskManager;

  beforeEach(() => {
    rm = new RiskManager();
  });

  // ── canOpenPosition ───────────────────────────────────────────

  describe('canOpenPosition', () => {
    it('returns true with no position', () => {
      const result = rm.canOpenPosition(100, null);
      expect(result.allowed).toBe(true);
    });

    it('returns true with a position whose side is "none"', () => {
      const pos = { side: 'none' as const, size: 0, entryPrice: 0, leverage: 1, unrealizedPnl: 0 };
      const result = rm.canOpenPosition(100, pos as any);
      expect(result.allowed).toBe(true);
    });

    it('returns false with existing long position', () => {
      const pos = { side: 'long' as const, size: 1, entryPrice: 3000, leverage: 10, unrealizedPnl: 0 };
      const result = rm.canOpenPosition(100, pos as any);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('已有持仓');
    });

    it('returns false with existing short position', () => {
      const pos = { side: 'short' as const, size: 1, entryPrice: 3000, leverage: 10, unrealizedPnl: 0 };
      const result = rm.canOpenPosition(100, pos as any);
      expect(result.allowed).toBe(false);
    });

    it('respects cooldown after consecutive losses', () => {
      // Record losses so consecutiveLosses > 0
      rm.recordTrade(-10);
      rm.recordTrade(-10);

      // Immediately try to open — should be blocked by cooldown
      const result = rm.canOpenPosition(100, null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('冷却');
    });

    it('respects daily loss limit', () => {
      // config.initialBalance = 100, maxDailyLoss = 0.1 → limit = 10 USDT loss
      // Record enough losses to exceed 10% of initial balance
      rm.recordTrade(-6);
      rm.recordTrade(-5);
      // Advance time past the cooldown period (5 minutes) so cooldown doesn't
      // block before the daily-loss check is reached.
      const realNow = Date.now;
      Date.now = () => realNow() + 6 * 60 * 1000;
      try {
        const result = rm.canOpenPosition(100, null);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('日内最大亏损');
      } finally {
        Date.now = realNow;
      }
    });

    it('rejects low balance (< 10 USDT)', () => {
      const result = rm.canOpenPosition(5, null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('余额不足');
    });

    it('allows trade when balance is exactly 10', () => {
      const result = rm.canOpenPosition(10, null);
      expect(result.allowed).toBe(true);
    });
  });

  // ── calculatePositionSize ─────────────────────────────────────

  describe('calculatePositionSize', () => {
    it('basic calculation: riskAmount / priceMovement', () => {
      // balance=1000, maxRiskPerTrade=0.02 → riskAmount=20
      // currentPrice=3000, stopLoss=2970 → movement=30
      // positionSize = 20 / 30 = 0.6667
      const size = rm.calculatePositionSize(1000, 3000, 2970);
      expect(size).toBeCloseTo(20 / 30, 4);
    });

    it('respects max leverage limit (caps position size)', () => {
      // Very tight stop loss → huge position → should be capped
      // balance=100, price=3000, stopLoss=2999 → movement=1
      // riskAmount=2, positionSize = 2/1 = 2
      // notional = 2 * 3000 = 6000
      // maxNotional = 100 * 50 * 0.5 = 2500
      // capped: 2500 / 3000 ≈ 0.8333
      const size = rm.calculatePositionSize(100, 3000, 2999);
      expect(size).toBeLessThanOrEqual(2500 / 3000 + 0.0001);
    });

    it('returns a positive number for valid inputs', () => {
      const size = rm.calculatePositionSize(500, 2000, 1950);
      expect(size).toBeGreaterThan(0);
    });
  });

  // ── calculateStopLoss ─────────────────────────────────────────

  describe('calculateStopLoss', () => {
    it('calculates stop loss for long position (below entry)', () => {
      const sl = rm.calculateStopLoss(3000, 'long');
      // 3000 * (1 - 0.015) = 2955
      expect(sl).toBeCloseTo(3000 * (1 - 0.015), 2);
      expect(sl).toBeLessThan(3000);
    });

    it('calculates stop loss for short position (above entry)', () => {
      const sl = rm.calculateStopLoss(3000, 'short');
      // 3000 * (1 + 0.015) = 3045
      expect(sl).toBeCloseTo(3000 * (1 + 0.015), 2);
      expect(sl).toBeGreaterThan(3000);
    });
  });

  // ── calculateTakeProfit ───────────────────────────────────────

  describe('calculateTakeProfit', () => {
    it('calculates take profit for long position (above entry)', () => {
      const tp = rm.calculateTakeProfit(3000, 'long');
      // 3000 * (1 + 0.03) = 3090
      expect(tp).toBeCloseTo(3000 * (1 + 0.03), 2);
      expect(tp).toBeGreaterThan(3000);
    });

    it('calculates take profit for short position (below entry)', () => {
      const tp = rm.calculateTakeProfit(3000, 'short');
      // 3000 * (1 - 0.03) = 2910
      expect(tp).toBeCloseTo(3000 * (1 - 0.03), 2);
      expect(tp).toBeLessThan(3000);
    });
  });

  // ── checkEmergencyExit ────────────────────────────────────────

  describe('checkEmergencyExit', () => {
    it('returns shouldExit=false for side=none', () => {
      const pos = { side: 'none' as const, size: 0, entryPrice: 0, leverage: 1, unrealizedPnl: 0 };
      const result = rm.checkEmergencyExit(pos as any, 3000);
      expect(result.shouldExit).toBe(false);
    });

    it('triggers stop loss on large adverse move for long', () => {
      // stopLossPercent = 0.015, leverage = 10
      // For leveragedPnl <= -0.015 * 100 = -1.5
      // pnlPercent = (current - entry) / entry
      // leveragedPnl = pnlPercent * leverage
      // Need leveragedPnl <= -1.5 → pnlPercent <= -0.15 for leverage=10
      // entry=3000, leverage=10, need price drop of 15%: current = 2550
      const pos = { side: 'long' as const, size: 1, entryPrice: 3000, leverage: 10, unrealizedPnl: 0 };
      const result = rm.checkEmergencyExit(pos as any, 2550);
      expect(result.shouldExit).toBe(true);
      expect(result.reason).toContain('止损');
    });

    it('triggers near liquidation when price is close to liquidation price', () => {
      // With corrected SL logic (no *100 bug), SL triggers at leveragedPnl <= -0.015.
      // We need a price that does NOT trigger SL but IS near liquidation:
      //   leveragedPnl = (2996-3000)/3000 * 10 = -0.0133 > -0.015 (no SL)
      //   distanceToLiquidation = |2996-2970|/2996 = 0.00867 < 0.1 (near liq)
      const pos = {
        side: 'long' as const,
        size: 1,
        entryPrice: 3000,
        leverage: 10,
        unrealizedPnl: -4,
        liquidationPrice: 2970,
      };
      const result = rm.checkEmergencyExit(pos as any, 2996);
      expect(result.shouldExit).toBe(true);
      expect(result.reason).toContain('爆仓');
    });

    it('does not trigger exit for moderate price movement', () => {
      // With corrected SL: leveragedPnl threshold is -0.015 (not -1.5).
      // Price 2998 → pnl = (2998-3000)/3000*10 = -0.00667 > -0.015 → no exit.
      const pos = { side: 'long' as const, size: 1, entryPrice: 3000, leverage: 10, unrealizedPnl: 0 };
      const result = rm.checkEmergencyExit(pos as any, 2998);
      expect(result.shouldExit).toBe(false);
    });
  });

  // ── recordTrade ───────────────────────────────────────────────

  describe('recordTrade', () => {
    it('updates daily stats correctly', () => {
      rm.recordTrade(50);
      rm.recordTrade(-20);
      const stats = rm.getStats();
      expect(stats.trades).toBe(2);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.totalPnl).toBeCloseTo(30, 2);
    });

    it('tracks consecutive losses', () => {
      rm.recordTrade(-10);
      rm.recordTrade(-10);
      rm.recordTrade(-10);
      // After 3 consecutive losses, cooldown should be triggered
      // canOpenPosition should reject
      const result = rm.canOpenPosition(100, null);
      expect(result.allowed).toBe(false);
    });

    it('resets consecutive losses on a win', () => {
      rm.recordTrade(-10);
      rm.recordTrade(-10);
      rm.recordTrade(20); // win resets consecutive losses

      // Wait for cooldown to not apply (consecutiveLosses = 0 now)
      // We need to wait past the cooldown. Since we just traded,
      // lastTradeTime is set, but consecutiveLosses = 0 so cooldown check passes
      const result = rm.canOpenPosition(100, null);
      expect(result.allowed).toBe(true);
    });
  });

  // ── getStats / daily reset ────────────────────────────────────

  describe('getStats', () => {
    it('returns a copy of daily stats', () => {
      rm.recordTrade(10);
      const stats = rm.getStats();
      expect(stats.trades).toBe(1);
      expect(stats.date).toBe(new Date().toISOString().split('T')[0]);
    });
  });

  // ── formatStats ───────────────────────────────────────────────

  describe('formatStats', () => {
    it('formats stats into a readable string', () => {
      rm.recordTrade(50);
      rm.recordTrade(-20);
      const formatted = rm.formatStats();
      expect(formatted).toContain('今日交易统计');
      expect(formatted).toContain('交易次数: 2');
    });
  });
});
