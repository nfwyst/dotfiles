// FIX M1: Barrel exports + factory function replace the singleton god object.
// Consumers import from './state' and get dependency-injected components.

import * as fs from 'fs';
import * as path from 'path';

import type {
  StateConfig,
  UnifiedState,
  Position,
  WALOperationType,
  WALEntry,
  WALFileInfo,
  WALStats,
  StateSnapshot,
  SnapshotInfo,
} from './types';
import { createDefaultState, migratePosition } from './types';
import { StateStore } from './StateStore';
import { WALManager } from './WALManager';
import { SnapshotManager } from './SnapshotManager';

// ============================================
// Re-exports
// ============================================

export type {
  StateConfig,
  UnifiedState,
  Position,
  WALOperationType,
  WALEntry,
  WALFileInfo,
  WALStats,
  StateSnapshot,
  SnapshotInfo,
};
export { createDefaultState, migratePosition, StateStore, WALManager, SnapshotManager };

// ============================================
// Composed facade — keeps the external API surface compatible
// ============================================

/**
 * StateManager provides the same public methods as the old god object
 * but delegates to focused, injectable components internally.
 *
 * FIX M1: No singleton pattern — instantiate via `createStateManager()`.
 */
export class StateManager {
  readonly store: StateStore;
  readonly wal: WALManager;
  readonly snapshot: SnapshotManager;

  private stateDir: string;
  private stateFile: string;
  private autoSave: boolean = true;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(
    store: StateStore,
    wal: WALManager,
    snapshot: SnapshotManager,
    stateDir: string,
  ) {
    this.store = store;
    this.wal = wal;
    this.snapshot = snapshot;
    this.stateDir = stateDir;
    this.stateFile = path.join(stateDir, 'unified-state.json');
  }

  // ------------------------------------------------------------------
  // Persistence helpers (debounced save, critical save)
  // ------------------------------------------------------------------

  private save(): void {
    if (!this.autoSave) return;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveNow(), 500);
  }

  saveNow(): void {
    try {
      if (!fs.existsSync(this.stateDir)) fs.mkdirSync(this.stateDir, { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify(this.store.getState(), null, 2));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  saveCritical(): void {
    try {
      if (!fs.existsSync(this.stateDir)) fs.mkdirSync(this.stateDir, { recursive: true });
      const data = JSON.stringify(this.store.getState(), null, 2);
      const fd = fs.openSync(this.stateFile, 'w');
      fs.writeFileSync(fd, data);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } catch (error) {
      console.error('Failed to save critical state:', error);
    }
  }

  // ------------------------------------------------------------------
  // State accessors — delegate to StateStore
  // ------------------------------------------------------------------

  getState(): Readonly<UnifiedState> {
    return this.store.getState();
  }

  getTrading() { return this.store.getTrading(); }
  getLLM()     { return this.store.getLLM(); }
  getStrategy(){ return this.store.getStrategy(); }
  getCache()   { return this.store.getCache(); }

  // ------------------------------------------------------------------
  // Mutators — WAL first, then in-memory, then persist
  // ------------------------------------------------------------------

  async updateTrading(updates: Partial<UnifiedState['trading']>): Promise<void> {
    await this.writeAhead('updateTrading', updates);
    this.store.updateTrading(updates);
    this.save();
    this.checkCheckpointNeeded();
  }

  async updatePosition(position: Position | null): Promise<void> {
    await this.writeAhead('updatePosition', { position });
    this.store.updatePosition(position);
    this.save();
    this.checkCheckpointNeeded();
  }

  async recordTrade(pnl: number): Promise<void> {
    await this.writeAhead('recordTrade', { pnl });
    this.store.recordTrade(pnl);
    this.save();
    this.checkCheckpointNeeded();
  }

  async updateLLM(decision: any, price: number): Promise<void> {
    const data = {
      lastDecision: decision,
      lastDecisionTime: Date.now(),
      lastDecisionPrice: price,
      thinking: decision.thinking || null,
    };
    await this.writeAhead('updateLLM', data);
    this.store.updateLLM(decision, price);
    this.save();
  }

  async updateNotification(updates: Partial<UnifiedState['notification']>): Promise<void> {
    await this.writeAhead('updateNotification', updates);
    this.store.updateNotification(updates);
    this.save();
  }

  addPendingNotification(notification: string): void {
    this.store.addPendingNotification(notification);
    this.save();
  }

  clearPendingNotifications(): string[] {
    const pending = this.store.clearPendingNotifications();
    this.save();
    return pending;
  }

  async updateStrategy(signal: any, output?: any): Promise<void> {
    const data: any = { lastSignal: signal, lastSignalTime: Date.now() };
    if (output) data.strategyOutput = output;
    await this.writeAhead('updateStrategy', data);
    this.store.updateStrategy(signal, output);
    this.save();
  }

  async updateDaemon(updates: Partial<UnifiedState['daemon']>): Promise<void> {
    await this.writeAhead('updateDaemon', updates);
    this.store.updateDaemon(updates);
    this.save();
  }

  async heartbeat(): Promise<void> {
    await this.writeAhead('heartbeat', {});
    this.store.heartbeat();
    this.save();
  }

  recordError(error: string): void {
    this.store.recordError(error);
    this.save();
  }

  async updateCache(updates: Partial<UnifiedState['cache']>): Promise<void> {
    await this.writeAhead('updateCache', updates);
    this.store.updateCache(updates);
    this.save();
  }

  // ------------------------------------------------------------------
  // WAL helpers
  // ------------------------------------------------------------------

  private async writeAhead(operation: WALOperationType, data: any): Promise<void> {
    try {
      await this.wal.append(operation, data);
    } catch (error) {
      console.error('WAL write failed:', error);
      throw error;
    }
  }

  async createCheckpoint(): Promise<void> {
    await this.wal.checkpoint(this.store.getState() as UnifiedState);
  }

  getWALStats(): WALStats {
    return this.wal.getStats();
  }

  private checkCheckpointNeeded(): void {
    if (this.wal.needsCheckpoint()) {
      this.createCheckpoint().catch((e) => console.error('Checkpoint failed:', e));
    }
  }

  // ------------------------------------------------------------------
  // Snapshot helpers
  // ------------------------------------------------------------------

  createSnapshot(reason: string = 'manual'): SnapshotInfo | null {
    return this.snapshot.createSnapshot(this.store.getState() as UnifiedState, reason);
  }

  listSnapshots(): SnapshotInfo[] {
    return this.snapshot.listSnapshots();
  }

  restoreSnapshot(timestamp?: string): boolean {
    const restored = this.snapshot.restoreSnapshot(timestamp);
    if (!restored) return false;
    this.store.setState(restored);
    this.saveNow();
    return true;
  }

  /** Snapshot + position update in one step (used on open/close). */
  saveWithSnapshot(position: Position | null): void {
    this.updatePosition(position);
    this.saveCritical();
    const reason = position ? 'position-opened' : 'position-closed';
    this.createSnapshot(reason);
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  async close(): Promise<void> {
    await this.createCheckpoint();
    await this.wal.close();
    this.snapshot.stopAutoSnapshot();
    this.saveCritical();
  }
}

// ============================================
// Factory
// ============================================

/** Default auto-snapshot interval: 1 hour */
const DEFAULT_AUTO_SNAPSHOT_INTERVAL = 60 * 60 * 1000;

/**
 * FIX M1: Factory wires up the three components with dependency injection.
 * No global singleton — callers own the returned `StateManager`.
 *
 * FIX BUG 2: This function is now async and properly awaits WAL recovery
 * before returning. Previously the recovery ran in an un-awaited async IIFE,
 * which meant the StateManager was returned before WAL replay finished.
 * New operations could race ahead of recovery, causing state corruption.
 *
 * FIX H7: Applies migratePosition() after loading state from disk to handle
 * legacy snapshots that used the old Position shape (contracts/pnl).
 */
export async function createStateManager(config?: Partial<StateConfig>): Promise<StateManager> {
  const stateDir = config?.stateDir ?? path.join(process.cwd(), 'state');
  const stateFile = path.join(stateDir, 'unified-state.json');
  const snapshotDir = path.join(stateDir, 'snapshots');
  const walDir = path.join(stateDir, 'wal');

  // --- Load persisted state (or default) ---
  let initialState = createDefaultState();
  try {
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
    if (fs.existsSync(stateFile)) {
      const loaded = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      const d = createDefaultState();
      initialState = {
        ...d,
        ...loaded,
        trading:      { ...d.trading,      ...loaded.trading },
        llm:          { ...d.llm,          ...loaded.llm },
        notification: { ...d.notification, ...loaded.notification },
        strategy:     { ...d.strategy,     ...loaded.strategy },
        daemon:       { ...d.daemon,       ...loaded.daemon },
        cache:        { ...d.cache,        ...loaded.cache },
      };
    }
  } catch { /* fall back to defaults */ }

  // FIX H7: Migrate legacy Position fields after loading from disk
  if (initialState.trading) {
    if (initialState.trading.position) {
      initialState.trading.position = migratePosition(initialState.trading.position);
    }
    if ((initialState.trading as any).lastPosition) {
      (initialState.trading as any).lastPosition = migratePosition(
        (initialState.trading as any).lastPosition,
      );
    }
  }

  // --- Construct components ---
  const store = new StateStore(initialState);

  const wal = new WALManager({
    walDir,
    checkpointInterval: config?.checkpointInterval,
    checkpointTimeInterval: config?.checkpointTimeInterval,
  });

  const snap = new SnapshotManager({
    snapshotDir,
    maxSnapshots: config?.maxSnapshots,
  });

  const manager = new StateManager(store, wal, snap, stateDir);

  // --- FIX BUG 2: WAL recovery — now properly awaited ---
  // Previously this ran inside an un-awaited `(async () => { ... })()`,
  // which meant the manager was returned before recovery finished,
  // allowing new operations to race ahead of replay.
  try {
    const recovered = await wal.recover(store.getState() as UnifiedState);
    if (recovered !== store.getState()) {
      store.setState(recovered);
      manager.saveNow();
    }
  } catch (error) {
    console.error('WAL recovery failed (best effort):', error);
    // Continue with current state — this matches the original "best effort" semantics
  }

  // --- Initial snapshot + auto-schedule ---
  snap.createSnapshot(store.getState() as UnifiedState, 'startup');
  const autoInterval = config?.autoSnapshotInterval ?? DEFAULT_AUTO_SNAPSHOT_INTERVAL;
  snap.startAutoSnapshot(autoInterval, () => {
    snap.createSnapshot(store.getState() as UnifiedState, 'auto-hourly');
  });

  return manager;
}
