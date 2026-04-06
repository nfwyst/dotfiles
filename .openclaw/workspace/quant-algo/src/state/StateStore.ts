// FIX M1: Pure in-memory state container — no file I/O, no singleton.
// All persistence is handled by WALManager and SnapshotManager.

import type {
  UnifiedState,
  Position,
} from './types';
import { createDefaultState } from './types';

/**
 * Core state container with a clean getter/setter API.
 *
 * Accepts initial state via constructor injection so it can be
 * composed with WAL recovery or snapshot restore without coupling
 * to the file system.
 */
export class StateStore {
  // FIX M1: State is injected, not loaded from disk in the constructor
  private state: UnifiedState;

  constructor(initialState?: UnifiedState) {
    this.state = initialState ?? createDefaultState();
  }

  // ============================================
  // Generic accessors
  // ============================================

  getState(): Readonly<UnifiedState> {
    return this.state;
  }

  /** Replace the entire state tree (used during WAL recovery / snapshot restore) */
  setState(next: UnifiedState): void {
    this.state = next;
  }

  // ============================================
  // Trading
  // ============================================

  getTrading(): UnifiedState['trading'] {
    return this.state.trading;
  }

  updateTrading(updates: Partial<UnifiedState['trading']>): void {
    this.state.trading = { ...this.state.trading, ...updates };
    this.touch();
  }

  updatePosition(position: Position | null): void {
    if (position) {
      this.state.trading.lastPosition = this.state.trading.position;
    }
    this.state.trading.position = position;
    this.state.trading.lastCheck = Date.now();
    this.touch();
  }

  recordTrade(pnl: number): void {
    this.state.trading.tradeCount++;
    this.state.trading.totalPnL += pnl;
    this.touch();
  }

  // ============================================
  // LLM
  // ============================================

  getLLM(): UnifiedState['llm'] {
    return this.state.llm;
  }

  updateLLM(decision: any, price: number): void {
    this.state.llm.lastDecision = decision;
    this.state.llm.lastDecisionTime = Date.now();
    this.state.llm.lastDecisionPrice = price;
    if (decision.thinking) {
      this.state.llm.thinking = decision.thinking;
    }
    this.touch();
  }

  // ============================================
  // Notification
  // ============================================

  getNotification(): UnifiedState['notification'] {
    return this.state.notification;
  }

  updateNotification(updates: Partial<UnifiedState['notification']>): void {
    this.state.notification = { ...this.state.notification, ...updates };
    this.touch();
  }

  addPendingNotification(notification: string): void {
    this.state.notification.pendingNotifications.push(notification);
    this.touch();
  }

  clearPendingNotifications(): string[] {
    const pending = this.state.notification.pendingNotifications;
    this.state.notification.pendingNotifications = [];
    this.touch();
    return pending;
  }

  // ============================================
  // Strategy
  // ============================================

  getStrategy(): UnifiedState['strategy'] {
    return this.state.strategy;
  }

  updateStrategy(signal: any, output?: any): void {
    this.state.strategy.lastSignal = signal;
    this.state.strategy.lastSignalTime = Date.now();
    if (output !== undefined) {
      this.state.strategy.strategyOutput = output;
    }
    this.touch();
  }

  // ============================================
  // Daemon
  // ============================================

  getDaemon(): UnifiedState['daemon'] {
    return this.state.daemon;
  }

  updateDaemon(updates: Partial<UnifiedState['daemon']>): void {
    this.state.daemon = { ...this.state.daemon, ...updates };
    this.touch();
  }

  heartbeat(): void {
    this.state.daemon.lastHeartbeat = Date.now();
    this.state.daemon.status = 'running';
    this.touch();
  }

  recordError(error: string): void {
    this.state.daemon.errorCount++;
    this.state.daemon.lastError = error;
    this.touch();
  }

  // ============================================
  // Cache
  // ============================================

  getCache(): UnifiedState['cache'] {
    return this.state.cache;
  }

  updateCache(updates: Partial<UnifiedState['cache']>): void {
    this.state.cache = { ...this.state.cache, ...updates };
    this.touch();
  }

  // ============================================
  // Internal
  // ============================================

  private touch(): void {
    this.state.updatedAt = new Date().toISOString();
  }
}
