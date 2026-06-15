import type { RiskGuard, RiskDecision, TradingContext } from './types';

/**
 * RiskGuardChain evaluates a sequence of RiskGuard instances against a
 * TradingContext. Guards are checked in insertion order:
 *
 * - The first `reject` decision is returned immediately (short-circuit).
 * - If no guard rejects but at least one returns `reduce_size`, the last
 *   `reduce_size` decision is returned.
 * - If every guard returns `allow`, a single `allow` decision is returned.
 */
export class RiskGuardChain {
  private guards: RiskGuard[] = [];

  addGuard(guard: RiskGuard): this {
    this.guards.push(guard);
    return this;
  }

  evaluate(context: TradingContext): RiskDecision {
    let reduceSizeDecision: RiskDecision | null = null;

    for (const guard of this.guards) {
      const decision = guard.check(context);

      if (decision.action === 'reject') {
        return decision;
      }

      if (decision.action === 'reduce_size') {
        reduceSizeDecision = decision;
      }
    }

    if (reduceSizeDecision) {
      return reduceSizeDecision;
    }

    return {
      action: 'allow',
      reason: 'All guards passed',
      guardName: 'RiskGuardChain',
    };
  }

  getGuards(): readonly RiskGuard[] {
    return this.guards;
  }
}
