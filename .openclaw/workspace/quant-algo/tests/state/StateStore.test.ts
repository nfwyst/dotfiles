import { describe, it, expect, beforeEach } from 'vitest';
import { StateStore } from '../../src/state/StateStore';
import { createDefaultState, UnifiedState, Position } from '../../src/state/types';
import type { LLMTradingSignal } from '../../src/modules/llmAnalysis';
import type { StrategySignal } from '../../src/modules/strategyEngine';
import type { OCSEnhancedOutput } from '../../src/ocs/enhanced/index';

describe('StateStore', () => {
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore();
  });

  // ── Construction ──────────────────────────────────────────────

  it('creates default state when no initial state is provided', () => {
    const state = store.getState();
    expect(state.version).toBe('1.0.0');
    expect(state.trading.balance).toBe(0);
    expect(state.trading.position).toBeNull();
    expect(state.trading.tradeCount).toBe(0);
    expect(state.trading.totalPnL).toBe(0);
    expect(state.daemon.status).toBe('stopped');
  });

  it('accepts injected initial state via constructor', () => {
    const custom = createDefaultState();
    custom.trading.balance = 5000;
    custom.version = '2.0.0';
    const s = new StateStore(custom);
    expect(s.getState().trading.balance).toBe(5000);
    expect(s.getState().version).toBe('2.0.0');
  });

  // ── Section getters ───────────────────────────────────────────

  it('getTrading returns the trading section', () => {
    store.updateTrading({ balance: 1234 });
    const trading = store.getTrading();
    expect(trading.balance).toBe(1234);
  });

  it('getLLM returns the llm section', () => {
    const llm = store.getLLM();
    expect(llm.lastDecision).toBeNull();
    expect(llm.lastDecisionTime).toBe(0);
  });

  it('getNotification returns the notification section', () => {
    const notif = store.getNotification();
    expect(notif.pendingNotifications).toEqual([]);
    expect(notif.lastReportHash).toBe('');
  });

  it('getStrategy returns the strategy section', () => {
    const strat = store.getStrategy();
    expect(strat.lastSignal).toBeNull();
    expect(strat.lastSignalTime).toBe(0);
  });

  it('getDaemon returns the daemon section', () => {
    const d = store.getDaemon();
    expect(d.status).toBe('stopped');
    expect(d.errorCount).toBe(0);
  });

  it('getCache returns the cache section', () => {
    const c = store.getCache();
    expect(c.newsCache).toBe('');
    expect(c.priceHistory).toEqual([]);
  });

  // ── Trading updates ───────────────────────────────────────────

  it('updateTrading merges partial updates into trading', () => {
    store.updateTrading({ balance: 500 });
    expect(store.getTrading().balance).toBe(500);
    // other fields unchanged
    expect(store.getTrading().tradeCount).toBe(0);
  });

  it('updatePosition sets position and records lastCheck', () => {
    const pos: Position = {
      side: 'long',
      size: 1,
      entryPrice: 3000,
      leverage: 1,
      unrealizedPnl: 100,
    };
    store.updatePosition(pos);
    expect(store.getTrading().position).toEqual(pos);
    expect(store.getTrading().lastCheck).toBeGreaterThan(0);
  });

  it('updatePosition saves previous position in lastPosition', () => {
    const pos1: Position = { side: 'long', size: 1, entryPrice: 3000, leverage: 1, unrealizedPnl: 100 };
    const pos2: Position = { side: 'short', size: 2, entryPrice: 3200, leverage: 1, unrealizedPnl: 200 };
    store.updatePosition(pos1);
    store.updatePosition(pos2);
    expect(store.getTrading().position).toEqual(pos2);
    expect(store.getTrading().lastPosition).toEqual(pos1);
  });

  it('handles null position correctly', () => {
    const pos: Position = { side: 'long', size: 1, entryPrice: 3000, leverage: 1, unrealizedPnl: 100 };
    store.updatePosition(pos);
    store.updatePosition(null);
    expect(store.getTrading().position).toBeNull();
    // lastPosition should NOT be updated to pos because null was passed
    // (only updated when non-null position is provided)
    expect(store.getTrading().lastPosition).toBeNull();
  });

  it('recordTrade increments count and adds PnL', () => {
    store.recordTrade(50);
    store.recordTrade(-20);
    store.recordTrade(30);
    expect(store.getTrading().tradeCount).toBe(3);
    expect(store.getTrading().totalPnL).toBe(60);
  });

  // ── LLM updates ───────────────────────────────────────────────

  it('updateLLM stores decision, price, and thinking', () => {
    const decision = { type: 'long' as const, thinking: 'bullish divergence detected' } as unknown as LLMTradingSignal;
    store.updateLLM(decision, 2500);
    const llm = store.getLLM();
    expect(llm.lastDecision).toEqual(decision);
    expect(llm.lastDecisionPrice).toBe(2500);
    expect(llm.thinking).toBe('bullish divergence detected');
    expect(llm.lastDecisionTime).toBeGreaterThan(0);
  });

  // ── Notification updates ──────────────────────────────────────

  it('updateNotification merges partial updates', () => {
    store.updateNotification({ lastReportHash: 'abc123' });
    expect(store.getNotification().lastReportHash).toBe('abc123');
  });

  it('addPendingNotification appends to list', () => {
    store.addPendingNotification('trade executed');
    store.addPendingNotification('stop loss hit');
    expect(store.getNotification().pendingNotifications).toEqual([
      'trade executed',
      'stop loss hit',
    ]);
  });

  it('clearPendingNotifications returns and resets the list', () => {
    store.addPendingNotification('msg1');
    store.addPendingNotification('msg2');
    const cleared = store.clearPendingNotifications();
    expect(cleared).toEqual(['msg1', 'msg2']);
    expect(store.getNotification().pendingNotifications).toEqual([]);
  });

  // ── Strategy updates ──────────────────────────────────────────

  it('updateStrategy sets signal and optional output', () => {
    const signal = { type: 'long' as const, confidence: 0.85 } as unknown as StrategySignal;
    const output = { scores: [1, 2, 3] } as unknown as OCSEnhancedOutput;
    store.updateStrategy(signal, output);
    expect(store.getStrategy().lastSignal).toEqual(signal);
    expect(store.getStrategy().strategyOutput).toEqual(output);
    expect(store.getStrategy().lastSignalTime).toBeGreaterThan(0);
  });

  // ── Daemon updates ────────────────────────────────────────────

  it('updateDaemon merges partial updates', () => {
    store.updateDaemon({ pid: 12345, status: 'running' });
    expect(store.getDaemon().pid).toBe(12345);
    expect(store.getDaemon().status).toBe('running');
  });

  it('heartbeat sets status to running and updates lastHeartbeat', () => {
    store.heartbeat();
    expect(store.getDaemon().status).toBe('running');
    expect(store.getDaemon().lastHeartbeat).toBeGreaterThan(0);
  });

  it('recordError increments errorCount and stores message', () => {
    store.recordError('connection timeout');
    store.recordError('rate limit');
    expect(store.getDaemon().errorCount).toBe(2);
    expect(store.getDaemon().lastError).toBe('rate limit');
  });

  // ── Cache updates ─────────────────────────────────────────────

  it('updateCache merges partial updates', () => {
    store.updateCache({ newsCache: 'BTC rallies', newsCacheTime: 1000 });
    expect(store.getCache().newsCache).toBe('BTC rallies');
    expect(store.getCache().newsCacheTime).toBe(1000);
  });

  // ── getState / setState ───────────────────────────────────────

  it('setState replaces the entire state tree', () => {
    const newState = createDefaultState();
    newState.trading.balance = 9999;
    newState.version = '3.0.0';
    store.setState(newState);
    expect(store.getState().trading.balance).toBe(9999);
    expect(store.getState().version).toBe('3.0.0');
  });

  it('getState returns a readonly reference (version check)', () => {
    const state = store.getState();
    expect(state.version).toBe('1.0.0');
  });

  // ── Concurrent updates ────────────────────────────────────────

  it('concurrent updates do not conflict (sequential mutations)', () => {
    store.updateTrading({ balance: 100 });
    store.updateDaemon({ status: 'running' });
    store.recordTrade(10);
    store.heartbeat();
    expect(store.getTrading().balance).toBe(100);
    expect(store.getTrading().tradeCount).toBe(1);
    expect(store.getDaemon().status).toBe('running');
  });

  // ── updatedAt tracking ────────────────────────────────────────

  it('touch updates the updatedAt timestamp on every mutation', () => {
    const before = store.getState().updatedAt;
    store.recordTrade(1);
    const after = store.getState().updatedAt;
    // updatedAt should have been refreshed (or at least not be before)
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });

  // ── Reset restores defaults ───────────────────────────────────

  it('reset restores defaults by replacing state', () => {
    store.updateTrading({ balance: 5000 });
    store.recordTrade(100);
    store.heartbeat();
    // Reset by setting a fresh default state
    store.setState(createDefaultState());
    expect(store.getTrading().balance).toBe(0);
    expect(store.getTrading().tradeCount).toBe(0);
    expect(store.getDaemon().status).toBe('stopped');
  });
});
