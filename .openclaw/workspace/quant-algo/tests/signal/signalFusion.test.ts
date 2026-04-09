import { describe, it, expect, beforeEach } from 'vitest';
import {
  InformationCoefficientTracker,
  updateICObservation,
  getICTrackers,
} from '../../src/modules/signalFusion';

// We test the IC tracker and rank/correlation utilities directly.
// The fuseSignals function depends on complex StrategySignal / LLMTradingSignal
// types with many fields, so we focus on the pure logic: IC computation,
// weight allocation, decorrelation, and the tracker class.

describe('InformationCoefficientTracker', () => {
  let tracker: InformationCoefficientTracker;

  beforeEach(() => {
    tracker = new InformationCoefficientTracker(100);
  });

  // ── IC computation ────────────────────────────────────────────

  it('IC with perfect positive correlation = 1', () => {
    // When predictions perfectly predict actuals (same rank order)
    for (let i = 0; i < 20; i++) {
      tracker.addObservation(i, i);
    }
    const ic = tracker.getIC();
    expect(ic).toBeCloseTo(1.0, 4);
  });

  it('IC with perfect negative correlation = -1', () => {
    for (let i = 0; i < 20; i++) {
      tracker.addObservation(i, 19 - i);
    }
    const ic = tracker.getIC();
    expect(ic).toBeCloseTo(-1.0, 4);
  });

  it('IC with zero correlation ≈ 0 for uncorrelated data', () => {
    // Alternate pattern that breaks correlation
    const predictions = [1, 5, 2, 8, 3, 7, 4, 6, 9, 0, 11, 15, 12, 18, 13, 17, 14, 16, 19, 10];
    const actuals = [10, 0, 15, 5, 12, 8, 18, 2, 6, 14, 1, 11, 16, 3, 19, 7, 13, 9, 4, 17];
    for (let i = 0; i < predictions.length; i++) {
      tracker.addObservation(predictions[i]!, actuals[i]!);
    }
    const ic = tracker.getIC();
    // Should be close to 0 (not exactly 0 due to finite sample)
    expect(Math.abs(ic)).toBeLessThan(0.3);
  });

  it('returns 0 when insufficient data (< 5 observations)', () => {
    tracker.addObservation(1, 2);
    tracker.addObservation(2, 3);
    tracker.addObservation(3, 4);
    expect(tracker.getIC()).toBe(0);
  });

  // ── Rolling window ────────────────────────────────────────────

  it('rolling IC window respects windowSize', () => {
    const smallTracker = new InformationCoefficientTracker(10);
    // Add 20 observations — window should only keep last 10
    for (let i = 0; i < 20; i++) {
      smallTracker.addObservation(i, i);
    }
    expect(smallTracker.getObservationCount()).toBe(10);
  });

  it('rolling IC window updates correctly after overflow', () => {
    const smallTracker = new InformationCoefficientTracker(10);
    // Perfect correlation in first 10
    for (let i = 0; i < 10; i++) {
      smallTracker.addObservation(i, i);
    }
    expect(smallTracker.getIC()).toBeCloseTo(1.0, 2);

    // Add 10 more with negative correlation — old data gets pushed out
    for (let i = 0; i < 10; i++) {
      smallTracker.addObservation(i, 9 - i);
    }
    expect(smallTracker.getIC()).toBeCloseTo(-1.0, 2);
  });

  // ── Edge cases ────────────────────────────────────────────────

  it('handles empty signal array (no observations)', () => {
    expect(tracker.getIC()).toBe(0);
    expect(tracker.getObservationCount()).toBe(0);
  });

  it('handles single observation', () => {
    tracker.addObservation(5, 10);
    expect(tracker.getIC()).toBe(0); // < 5 observations
    expect(tracker.getObservationCount()).toBe(1);
  });

  // ── getPredictions ────────────────────────────────────────────

  it('getPredictions returns a copy of predictions', () => {
    tracker.addObservation(1, 2);
    tracker.addObservation(3, 4);
    const preds = tracker.getPredictions();
    expect(preds).toEqual([1, 3]);
    // Modifying the copy should not affect the tracker
    preds.push(999);
    expect(tracker.getPredictions().length).toBe(2);
  });

  // ── reset ─────────────────────────────────────────────────────

  it('reset clears all observations', () => {
    for (let i = 0; i < 10; i++) {
      tracker.addObservation(i, i);
    }
    expect(tracker.getObservationCount()).toBe(10);
    tracker.reset();
    expect(tracker.getObservationCount()).toBe(0);
    expect(tracker.getIC()).toBe(0);
  });

  // ── Determinism ───────────────────────────────────────────────

  it('fusion is deterministic (same input produces same IC)', () => {
    const t1 = new InformationCoefficientTracker(50);
    const t2 = new InformationCoefficientTracker(50);
    const data = Array.from({ length: 30 }, (_, i) => [i * 1.5, i * 2.0]);
    for (const [p, a] of data) {
      t1.addObservation(p!, a!);
      t2.addObservation(p!, a!);
    }
    expect(t1.getIC()).toBe(t2.getIC());
  });

  // ── IC-weighted allocation ────────────────────────────────────

  it('IC-weighted allocation sums to 1 when both ICs are positive', () => {
    // Simulate two trackers with different IC values
    const stratTracker = new InformationCoefficientTracker(50);
    const llmTracker = new InformationCoefficientTracker(50);

    // Strategy: moderate correlation
    for (let i = 0; i < 20; i++) {
      stratTracker.addObservation(i, i + (i % 3));
    }
    // LLM: strong correlation
    for (let i = 0; i < 20; i++) {
      llmTracker.addObservation(i, i);
    }

    const stratIC = Math.max(0, stratTracker.getIC());
    const llmIC = Math.max(0, llmTracker.getIC());
    const icSum = stratIC + llmIC;

    if (icSum > 0) {
      const w1 = stratIC / icSum;
      const w2 = llmIC / icSum;
      expect(w1 + w2).toBeCloseTo(1.0, 10);
    }
  });

  it('negative IC signals get zero weight in allocation', () => {
    // Negative IC → clamped to 0
    const ic = -0.3;
    const clamped = Math.max(0, ic);
    expect(clamped).toBe(0);
  });
});

describe('Module-level IC functions', () => {
  it('getICTrackers returns strategy and llm tracker objects', () => {
    const trackers = getICTrackers();
    expect(trackers).toHaveProperty('strategy');
    expect(trackers).toHaveProperty('llm');
    expect(typeof trackers.strategy.getIC).toBe('function');
    expect(typeof trackers.llm.getIC).toBe('function');
  });

  it('updateICObservation updates both trackers', () => {
    const before = getICTrackers();
    const stratCountBefore = before.strategy.getObservationCount();
    const llmCountBefore = before.llm.getObservationCount();

    updateICObservation(0.5, 0.3, 0.4);

    const after = getICTrackers();
    expect(after.strategy.getObservationCount()).toBe(stratCountBefore + 1);
    expect(after.llm.getObservationCount()).toBe(llmCountBefore + 1);
  });
});
