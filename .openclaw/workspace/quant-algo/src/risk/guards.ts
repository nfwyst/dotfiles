import type { RiskGuard, RiskDecision, TradingContext } from './types';

/**
 * CircuitBreakerGuard — Triggers a circuit breaker when drawdown exceeds a
 * threshold, with an escalating cooldown period on repeated triggers.
 */
export class CircuitBreakerGuard implements RiskGuard {
  readonly name = 'CircuitBreaker';

  private triggerCount: number = 0;
  private cooldownBarsRemaining: number = 0;

  constructor(
    private readonly drawdownThresholdPercent: number,
    private readonly baseCooldownBars: number,
    private readonly maxCooldownBars: number,
  ) {}

  check(context: TradingContext): RiskDecision {
    // If we are in a cooldown period, decrement and reject
    if (this.cooldownBarsRemaining > 0) {
      this.cooldownBarsRemaining--;
      return {
        action: 'reject',
        reason: `Circuit breaker active: ${this.cooldownBarsRemaining} bars remaining in cooldown (trigger #${this.triggerCount})`,
        guardName: this.name,
        metadata: {
          cooldownRemaining: this.cooldownBarsRemaining,
          triggerCount: this.triggerCount,
        },
      };
    }

    // Check if drawdown exceeds threshold
    if (context.currentDrawdownPercent >= this.drawdownThresholdPercent) {
      this.triggerCount++;
      // Escalating cooldown: baseCooldown * triggerCount, capped at max
      this.cooldownBarsRemaining = Math.min(
        this.maxCooldownBars,
        this.baseCooldownBars * this.triggerCount,
      );
      return {
        action: 'reject',
        reason: `Circuit breaker triggered (#${this.triggerCount}): drawdown ${context.currentDrawdownPercent.toFixed(2)}% >= ${this.drawdownThresholdPercent}%, cooldown ${this.cooldownBarsRemaining} bars`,
        guardName: this.name,
        metadata: {
          drawdownPercent: context.currentDrawdownPercent,
          threshold: this.drawdownThresholdPercent,
          cooldownBars: this.cooldownBarsRemaining,
          triggerCount: this.triggerCount,
        },
      };
    }

    return { action: 'allow', reason: '', guardName: this.name };
  }
}

/**
 * DailyLossLimitGuard — Rejects new trades when daily P&L loss exceeds a
 * configurable limit (expressed as a fraction of balance).
 */
export class DailyLossLimitGuard implements RiskGuard {
  readonly name = 'DailyLossLimit';

  constructor(
    private readonly dailyLossLimitPercent: number,
  ) {}

  check(context: TradingContext): RiskDecision {
    const dailyLossPercent = context.balance > 0
      ? (-context.dailyPnl / context.balance) * 100
      : 0;

    if (context.dailyPnl < 0 && dailyLossPercent >= this.dailyLossLimitPercent) {
      return {
        action: 'reject',
        reason: `Daily loss limit hit: daily loss ${dailyLossPercent.toFixed(2)}% >= ${this.dailyLossLimitPercent}% limit`,
        guardName: this.name,
        metadata: {
          dailyPnl: context.dailyPnl,
          dailyLossPercent,
          limit: this.dailyLossLimitPercent,
        },
      };
    }

    return { action: 'allow', reason: '', guardName: this.name };
  }
}

/**
 * CooldownGuard — Enforces a minimum number of bars between trades to
 * prevent over-trading / churn.
 */
export class CooldownGuard implements RiskGuard {
  readonly name = 'Cooldown';

  constructor(
    private readonly cooldownBars: number,
  ) {}

  check(context: TradingContext): RiskDecision {
    if (context.barsSinceLastTrade < this.cooldownBars) {
      return {
        action: 'reject',
        reason: `Cooldown active: ${context.barsSinceLastTrade} bars since last trade < ${this.cooldownBars} required`,
        guardName: this.name,
        metadata: {
          barsSinceLastTrade: context.barsSinceLastTrade,
          cooldownBars: this.cooldownBars,
        },
      };
    }

    return { action: 'allow', reason: '', guardName: this.name };
  }
}

/**
 * MaxHoldingTimeGuard — Signals to reduce size or reject when a position
 * has been held for too long (measured in bars).
 */
export class MaxHoldingTimeGuard implements RiskGuard {
  readonly name = 'MaxHoldingTime';

  constructor(
    private readonly maxBars: number,
    private readonly warnBars?: number,
  ) {}

  check(context: TradingContext): RiskDecision {
    if (context.barsSinceEntry >= this.maxBars) {
      return {
        action: 'reject',
        reason: `Max holding time exceeded: ${context.barsSinceEntry} bars >= ${this.maxBars} max`,
        guardName: this.name,
        metadata: {
          barsSinceEntry: context.barsSinceEntry,
          maxBars: this.maxBars,
        },
      };
    }

    if (this.warnBars !== undefined && context.barsSinceEntry >= this.warnBars) {
      return {
        action: 'reduce_size',
        reason: `Holding time warning: ${context.barsSinceEntry} bars >= ${this.warnBars} warn threshold`,
        guardName: this.name,
        metadata: {
          barsSinceEntry: context.barsSinceEntry,
          warnBars: this.warnBars,
          maxBars: this.maxBars,
        },
      };
    }

    return { action: 'allow', reason: '', guardName: this.name };
  }
}

/**
 * ConsecutiveLossGuard — Pauses trading after a configurable number of
 * consecutive losses, with a configurable pause duration (in bars).
 */
export class ConsecutiveLossGuard implements RiskGuard {
  readonly name = 'ConsecutiveLoss';

  private pauseUntilBar: number = 0;
  private currentBar: number = 0;

  constructor(
    private readonly maxConsecutiveLosses: number,
    private readonly pauseBars: number,
  ) {}

  check(context: TradingContext): RiskDecision {
    // Track progression via barsSinceEntry as a proxy for "current bar"
    // (the chain caller should provide monotonically increasing context)
    this.currentBar++;

    if (this.currentBar < this.pauseUntilBar) {
      return {
        action: 'reject',
        reason: `Consecutive loss pause: ${context.consecutiveLosses} losses, paused for ${this.pauseUntilBar - this.currentBar} more bars`,
        guardName: this.name,
        metadata: {
          consecutiveLosses: context.consecutiveLosses,
          pauseBarsRemaining: this.pauseUntilBar - this.currentBar,
        },
      };
    }

    if (context.consecutiveLosses >= this.maxConsecutiveLosses) {
      this.pauseUntilBar = this.currentBar + this.pauseBars;
      return {
        action: 'reject',
        reason: `Consecutive loss limit: ${context.consecutiveLosses} losses >= ${this.maxConsecutiveLosses}, pausing ${this.pauseBars} bars`,
        guardName: this.name,
        metadata: {
          consecutiveLosses: context.consecutiveLosses,
          maxConsecutiveLosses: this.maxConsecutiveLosses,
          pauseBars: this.pauseBars,
        },
      };
    }

    return { action: 'allow', reason: '', guardName: this.name };
  }
}
