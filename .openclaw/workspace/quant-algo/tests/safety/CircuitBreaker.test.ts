import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger and monitoring before importing the module
vi.mock('../../src/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/monitoring', () => ({
  metricsCollector: {
    updateCircuitBreakerState: vi.fn(),
  },
}));

import { CircuitBreaker, CircuitState } from '../../src/safety/CircuitBreaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      resetTimeout: 500,          // 500ms for fast tests
      halfOpenMaxCalls: 2,
      timeout: 5000,
      successThreshold: 2,
    });
  });

  afterEach(() => {
    cb.cleanup();
  });

  // ── Initial state ─────────────────────────────────────────────

  it('starts in CLOSED state', () => {
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.isHealthy()).toBe(true);
    expect(cb.isOpen()).toBe(false);
  });

  // ── CLOSED → OPEN transition ──────────────────────────────────

  it('transitions to OPEN on failure threshold', async () => {
    const failFn = async () => { throw new Error('fail'); };

    await cb.execute(failFn);
    expect(cb.getState()).toBe('CLOSED');

    await cb.execute(failFn);
    expect(cb.getState()).toBe('CLOSED');

    await cb.execute(failFn);
    // 3rd failure should trigger OPEN
    expect(cb.getState()).toBe('OPEN');
    expect(cb.isOpen()).toBe(true);
  });

  // ── OPEN state rejects calls ──────────────────────────────────

  it('OPEN state rejects calls and returns error', async () => {
    const failFn = async () => { throw new Error('fail'); };

    // Trip the breaker
    for (let i = 0; i < 3; i++) await cb.execute(failFn);
    expect(cb.getState()).toBe('OPEN');

    // Next call should be rejected immediately
    const result = await cb.execute(async () => 'should not run');
    expect(result.success).toBe(false);
    expect(result.state).toBe('OPEN');
  });

  // ── OPEN → HALF_OPEN transition ───────────────────────────────

  it('transitions to HALF_OPEN after timeout', async () => {
    const failFn = async () => { throw new Error('fail'); };

    // Trip the breaker
    for (let i = 0; i < 3; i++) await cb.execute(failFn);
    expect(cb.getState()).toBe('OPEN');

    // Wait for the reset timeout
    await new Promise(resolve => setTimeout(resolve, 600));

    // The next call should trigger HALF_OPEN transition
    const result = await cb.execute(async () => 'success');
    // It should succeed because the breaker moves to HALF_OPEN first
    expect(result.success).toBe(true);
  });

  // ── HALF_OPEN → CLOSED on success ─────────────────────────────

  it('HALF_OPEN succeeds enough times → transitions to CLOSED', async () => {
    const failFn = async () => { throw new Error('fail'); };

    // Trip the breaker
    for (let i = 0; i < 3; i++) await cb.execute(failFn);

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 600));

    // successThreshold = 2, so 2 successes should close the breaker
    await cb.execute(async () => 'ok');
    await cb.execute(async () => 'ok');
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.isHealthy()).toBe(true);
  });

  // ── HALF_OPEN → OPEN on failure ───────────────────────────────

  it('HALF_OPEN fails → transitions back to OPEN', async () => {
    const failFn = async () => { throw new Error('fail'); };

    // Trip the breaker
    for (let i = 0; i < 3; i++) await cb.execute(failFn);

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 600));

    // First call in HALF_OPEN fails → should go back to OPEN
    const result = await cb.execute(failFn);
    expect(result.success).toBe(false);
    expect(cb.getState()).toBe('OPEN');
  });

  // ── Success resets failure count ──────────────────────────────

  it('success resets failure count in CLOSED state', async () => {
    const failFn = async () => { throw new Error('fail'); };
    const successFn = async () => 'ok';

    // 2 failures (below threshold of 3)
    await cb.execute(failFn);
    await cb.execute(failFn);
    expect(cb.getFailureCount()).toBe(2);

    // 1 success should reset failure count
    await cb.execute(successFn);
    expect(cb.getFailureCount()).toBe(0);
  });

  // ── Concurrent calls ─────────────────────────────────────────

  it('handles concurrent calls correctly', async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      return callCount;
    };

    const results = await Promise.all([
      cb.execute(fn),
      cb.execute(fn),
      cb.execute(fn),
    ]);

    const successes = results.filter(r => r.success);
    expect(successes.length).toBe(3);
  });

  // ── Custom failure threshold ──────────────────────────────────

  it('respects custom failure threshold', async () => {
    const custom = new CircuitBreaker({
      name: 'custom-threshold',
      failureThreshold: 5,
      resetTimeout: 1000,
      halfOpenMaxCalls: 1,
      timeout: 5000,
      successThreshold: 1,
    });

    const failFn = async () => { throw new Error('fail'); };

    for (let i = 0; i < 4; i++) await custom.execute(failFn);
    expect(custom.getState()).toBe('CLOSED'); // Still closed at 4

    await custom.execute(failFn);
    expect(custom.getState()).toBe('OPEN'); // 5th triggers open

    custom.cleanup();
  });

  // ── Custom timeout duration ───────────────────────────────────

  it('respects custom timeout duration', async () => {
    const custom = new CircuitBreaker({
      name: 'custom-timeout',
      failureThreshold: 1,
      resetTimeout: 200,  // Very short
      halfOpenMaxCalls: 1,
      timeout: 5000,
      successThreshold: 1,
    });

    const failFn = async () => { throw new Error('fail'); };
    await custom.execute(failFn);
    expect(custom.getState()).toBe('OPEN');

    // Wait for the short timeout
    await new Promise(resolve => setTimeout(resolve, 300));

    // Should transition to HALF_OPEN on next call
    const result = await custom.execute(async () => 'recovered');
    expect(result.success).toBe(true);

    custom.cleanup();
  });

  // ── Stats ─────────────────────────────────────────────────────

  it('getStats returns correct statistics', async () => {
    await cb.execute(async () => 'ok');
    await cb.execute(async () => { throw new Error('fail'); });

    const stats = cb.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.totalCalls).toBe(2);
    expect(stats.successCount).toBe(1);
    expect(stats.failureCount).toBe(1);
    expect(stats.failureRate).toBeCloseTo(50, 0);
    expect(stats.successRate).toBeCloseTo(50, 0);
  });

  // ── Manual reset / force open ─────────────────────────────────

  it('manual reset returns to CLOSED state', async () => {
    const failFn = async () => { throw new Error('fail'); };
    for (let i = 0; i < 3; i++) await cb.execute(failFn);
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.isHealthy()).toBe(true);
  });

  it('forceOpen sets state to OPEN', () => {
    cb.forceOpen('manual test');
    expect(cb.getState()).toBe('OPEN');
    expect(cb.isOpen()).toBe(true);
  });

  // ── Fallback ──────────────────────────────────────────────────

  it('uses fallback function when call fails', async () => {
    const failFn = async () => { throw new Error('fail'); };
    const fallback = async () => 'fallback-value';

    const result = await cb.execute(failFn, fallback);
    expect(result.success).toBe(true);
    expect(result.value).toBe('fallback-value');
    expect(result.isFallback).toBe(true);
  });

  it('uses configured fallbackValue when OPEN and no fallback fn', async () => {
    const custom = new CircuitBreaker({
      name: 'fallback-test',
      failureThreshold: 1,
      resetTimeout: 60000,
      halfOpenMaxCalls: 1,
      timeout: 5000,
      successThreshold: 1,
      enableFallback: true,
      fallbackValue: { default: true },
    });

    const failFn = async () => { throw new Error('fail'); };
    await custom.execute(failFn); // Trips the breaker
    expect(custom.getState()).toBe('OPEN');

    const result = await custom.execute(async () => 'should not run');
    expect(result.success).toBe(true);
    expect(result.value).toEqual({ default: true });
    expect(result.isFallback).toBe(true);

    custom.cleanup();
  });
});
