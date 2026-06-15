// FIX M1: WAL logic extracted from the god object into a focused module.
// All file I/O for the write-ahead log is isolated here.
//
// FIX H7: WAL replay now migrates legacy Position fields (contracts/pnl)
// to the canonical shape (size/unrealizedPnl/leverage) via migratePosition().

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import type {
  WALOperationType,
  WALEntry,
  WALFileInfo,
  WALStats,
  UnifiedState,
} from './types';
import { migratePosition } from './types';

/** Default: checkpoint every 1 000 operations */
const DEFAULT_CHECKPOINT_INTERVAL = 1000;
/** Default: time-based checkpoint every 60 s */
const DEFAULT_CHECKPOINT_TIME_INTERVAL = 60_000;
/** WAL files to retain after compaction */
const RETAINED_WAL_FILES = 3;

export interface WALManagerConfig {
  walDir: string;
  checkpointInterval?: number;
  checkpointTimeInterval?: number;
}

/**
 * Write-Ahead Log manager.
 *
 * Guarantees crash recovery by persisting every mutation to an
 * append-only log *before* updating the in-memory state.
 */
/** Minimal type guard for UnifiedState shape from WAL checkpoint data */
function isUnifiedState(value: unknown): value is UnifiedState {
  return value !== null && typeof value === 'object' && 'trading' in value;
}

/** Type guard: is value a non-null object (usable as a record)? */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class WALManager {
  private walDir: string;
  private checkpointInterval: number;

  private currentSequence: number = 0;
  private currentWalFile: string | null = null;
  private walFd: number | null = null;
  private lastCheckpointSequence: number = 0;
  private operationCount: number = 0;
  private checkpointTimer: NodeJS.Timeout | null = null;
  private syncPromise: Promise<void> | null = null;

  // FIX M1: Configuration is injected, not read from module-level constants
  constructor(config: WALManagerConfig) {
    this.walDir = config.walDir;
    this.checkpointInterval = config.checkpointInterval ?? DEFAULT_CHECKPOINT_INTERVAL;

    this.init(config.checkpointTimeInterval ?? DEFAULT_CHECKPOINT_TIME_INTERVAL);
  }

  // ------------------------------------------------------------------
  // Initialisation
  // ------------------------------------------------------------------

  private init(checkpointTimeInterval: number): void {
    if (!fs.existsSync(this.walDir)) {
      fs.mkdirSync(this.walDir, { recursive: true });
    }

    this.currentSequence = this.getLastSequence();
    this.lastCheckpointSequence = this.getLastCheckpointSequence();
    this.rotateWALFile();
    this.startCheckpointTimer(checkpointTimeInterval);
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /** Append an operation to the WAL and return its sequence number. */
  async append(operation: WALOperationType, data: unknown): Promise<number> {
    const sequence = ++this.currentSequence;

    const entry: WALEntry = {
      sequence,
      timestamp: Date.now(),
      operation,
      data,
      checksum: '',
    };
    entry.checksum = this.calculateEntryChecksum(entry);

    const line = JSON.stringify(entry) + '\n';

    return new Promise((resolve, reject) => {
      if (this.walFd === null) {
        reject(new Error('WAL file not open'));
        return;
      }
      fs.write(this.walFd, line, (err) => {
        if (err) {
          reject(err);
        } else {
          this.operationCount++;
          resolve(sequence);
        }
      });
    });
  }

  /** Flush the current WAL file descriptor to disk. */
  async sync(): Promise<void> {
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = new Promise((resolve, reject) => {
      if (this.walFd === null) { resolve(); return; }
      fs.fsync(this.walFd, (err) => {
        this.syncPromise = null;
        err ? reject(err) : resolve();
      });
    });

    return this.syncPromise;
  }

  /** Create a checkpoint — snapshot state + compact old WAL files. */
  async checkpoint(state: UnifiedState): Promise<void> {
    await this.sync();

    const sequence = await this.append('checkpoint', {
      stateSnapshot: state,
      checkpointTime: Date.now(),
    });

    await this.sync();

    this.lastCheckpointSequence = sequence;
    this.operationCount = 0;

    await this.compact();
  }

  /** Replay WAL entries on top of `currentState` and return the recovered state. */
  async recover(currentState: UnifiedState): Promise<UnifiedState> {
    const walFiles = this.getWALFiles();
    if (walFiles.length === 0) return currentState;

    let state = currentState;
    let recoveredCount = 0;
    let lastValidSequence = 0;

    const cp = this.findLatestCheckpoint(walFiles);
    if (cp) {
      // FIX H7: Migrate position fields in checkpoint state
      state = WALManager.migrateState(cp.state);
      lastValidSequence = cp.sequence;
    }

    for (const file of walFiles) {
      for (const entry of this.readWALFile(file.path)) {
        if (entry.sequence <= lastValidSequence) continue;
        const expected = this.calculateEntryChecksum(entry);
        if (entry.checksum !== expected) continue;

        state = WALManager.applyOperation(state, entry);
        lastValidSequence = entry.sequence;
        recoveredCount++;
      }
    }

    return state;
  }

  /** Whether the operation counter has crossed the checkpoint threshold. */
  needsCheckpoint(): boolean {
    return this.operationCount >= this.checkpointInterval;
  }

  getStats(): WALStats {
    const files = this.getWALFiles();
    return {
      totalEntries: files.reduce((s, f) => s + f.entryCount, 0),
      totalSize: files.reduce((s, f) => s + f.size, 0),
      fileCount: files.length,
      lastSequence: this.currentSequence,
      lastCheckpointSequence: this.lastCheckpointSequence,
      pendingOperations: this.operationCount,
      walFiles: files,
    };
  }

  async close(): Promise<void> {
    await this.sync();
    if (this.walFd !== null) {
      fs.closeSync(this.walFd);
      this.walFd = null;
    }
    this.stopCheckpointTimer();
  }

  // ------------------------------------------------------------------
  // Static helper — apply a single WAL entry to state (pure function)
  // ------------------------------------------------------------------

  static applyOperation(state: UnifiedState, entry: WALEntry): UnifiedState {
    const s = { ...state };
    const data = isRecord(entry.data) ? entry.data : {};

    switch (entry.operation) {
      case 'updateTrading':
        s.trading = {
          ...s.trading,
          ...(typeof data.balance === 'number' ? { balance: data.balance } : {}),
          ...(typeof data.tradeCount === 'number' ? { tradeCount: data.tradeCount } : {}),
          ...(typeof data.totalPnL === 'number' ? { totalPnL: data.totalPnL } : {}),
          ...(typeof data.startTime === 'number' ? { startTime: data.startTime } : {}),
          ...(typeof data.lastCheck === 'number' ? { lastCheck: data.lastCheck } : {}),
        };
        if ('position' in data) {
          s.trading.position = migratePosition(data.position);
        }
        if ('lastPosition' in data) {
          s.trading.lastPosition = migratePosition(data.lastPosition);
        }
        break;
      case 'updatePosition':
        if (data.position) s.trading.lastPosition = s.trading.position;
        // FIX H7: Migrate legacy position fields during WAL replay
        s.trading.position = migratePosition(data.position);
        s.trading.lastCheck = Date.now();
        break;
      case 'recordTrade':
        s.trading.tradeCount++;
        s.trading.totalPnL += typeof data.pnl === 'number' ? data.pnl : 0;
        break;
      case 'updateLLM':
        s.llm = {
          ...s.llm,
          ...('lastDecision' in data ? { lastDecision: data.lastDecision as UnifiedState['llm']['lastDecision'] } : {}),
          ...(typeof data.lastDecisionTime === 'number' ? { lastDecisionTime: data.lastDecisionTime } : {}),
          ...(typeof data.lastDecisionPrice === 'number' ? { lastDecisionPrice: data.lastDecisionPrice } : {}),
          ...('thinking' in data ? { thinking: typeof data.thinking === 'string' ? data.thinking : null } : {}),
        };
        break;
      case 'updateNotification':
        s.notification = {
          ...s.notification,
          ...(typeof data.lastReportHash === 'string' ? { lastReportHash: data.lastReportHash } : {}),
          ...(typeof data.lastReportTime === 'number' ? { lastReportTime: data.lastReportTime } : {}),
          ...(typeof data.lastNotifyCheck === 'number' ? { lastNotifyCheck: data.lastNotifyCheck } : {}),
          ...(Array.isArray(data.pendingNotifications) ? { pendingNotifications: data.pendingNotifications as string[] } : {}),
        };
        break;
      case 'updateStrategy':
        s.strategy = {
          ...s.strategy,
          ...('lastSignal' in data ? { lastSignal: data.lastSignal as UnifiedState['strategy']['lastSignal'] } : {}),
          ...(typeof data.lastSignalTime === 'number' ? { lastSignalTime: data.lastSignalTime } : {}),
          ...('strategyOutput' in data ? { strategyOutput: data.strategyOutput as UnifiedState['strategy']['strategyOutput'] } : {}),
        };
        break;
      case 'updateDaemon':
        s.daemon = {
          ...s.daemon,
          ...('pid' in data ? { pid: typeof data.pid === 'number' ? data.pid : null } : {}),
          ...('startTime' in data ? { startTime: typeof data.startTime === 'number' ? data.startTime : null } : {}),
          ...(typeof data.lastHeartbeat === 'number' ? { lastHeartbeat: data.lastHeartbeat } : {}),
          ...(typeof data.status === 'string' && (data.status === 'running' || data.status === 'stopped' || data.status === 'error') ? { status: data.status } : {}),
          ...(typeof data.errorCount === 'number' ? { errorCount: data.errorCount } : {}),
          ...('lastError' in data ? { lastError: typeof data.lastError === 'string' ? data.lastError : null } : {}),
        };
        break;
      case 'updateCache':
        s.cache = {
          ...s.cache,
          ...(typeof data.newsCache === 'string' ? { newsCache: data.newsCache } : {}),
          ...(typeof data.newsCacheTime === 'number' ? { newsCacheTime: data.newsCacheTime } : {}),
          ...(Array.isArray(data.priceHistory) ? { priceHistory: data.priceHistory as number[] } : {}),
          ...(typeof data.lastPriceUpdateTime === 'number' ? { lastPriceUpdateTime: data.lastPriceUpdateTime } : {}),
        };
        break;
      case 'heartbeat':
        s.daemon.lastHeartbeat = Date.now();
        s.daemon.status = 'running';
        break;
      case 'checkpoint':
        break; // handled separately during recovery
    }

    s.updatedAt = new Date().toISOString();
    return s;
  }

  // ------------------------------------------------------------------
  // FIX H7: Migrate legacy Position fields in a full state snapshot
  // ------------------------------------------------------------------

  /**
   * Migrate a deserialized UnifiedState so any legacy Position
   * objects (with `contracts`/`pnl` fields) are converted to the
   * canonical shape (with `size`/`unrealizedPnl`/`leverage`).
   */
  static migrateState(state: UnifiedState): UnifiedState {
    const s = { ...state, trading: { ...state.trading } };
    if (s.trading.position) {
      s.trading.position = migratePosition(s.trading.position);
    }
    if (s.trading.lastPosition) {
      s.trading.lastPosition = migratePosition(s.trading.lastPosition);
    }
    return s;
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private calculateEntryChecksum(entry: Omit<WALEntry, 'checksum'>): string {
    const data = `${entry.sequence}|${entry.timestamp}|${entry.operation}|${JSON.stringify(entry.data)}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private generateWALFilename(): string {
    return `wal-${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.log`;
  }

  private rotateWALFile(): void {
    if (this.walFd !== null) {
      try { fs.fsyncSync(this.walFd); fs.closeSync(this.walFd); } catch { /* best effort */ }
    }
    this.currentWalFile = path.join(this.walDir, this.generateWALFilename());
    this.walFd = fs.openSync(this.currentWalFile, 'a');
  }

  private async compact(): Promise<void> {
    const walFiles = this.getWALFiles();
    for (const file of walFiles.slice(RETAINED_WAL_FILES)) {
      try {
        const entries = this.readWALFile(file.path);
        const hasUncheckpointed = entries.some(
          (e) => e.sequence > this.lastCheckpointSequence && e.operation !== 'checkpoint',
        );
        if (!hasUncheckpointed) fs.unlinkSync(file.path);
      } catch { /* best effort */ }
    }
  }

  private getWALFiles(): WALFileInfo[] {
    if (!fs.existsSync(this.walDir)) return [];

    return fs.readdirSync(this.walDir)
      .filter((f) => f.startsWith('wal-') && f.endsWith('.log'))
      .sort()
      .reverse()
      .map((filename) => {
        const filePath = path.join(this.walDir, filename);
        const stat = fs.statSync(filePath);
        const entries = this.readWALFile(filePath);
        return {
          filename,
          path: filePath,
          size: stat.size,
          entryCount: entries.length,
          firstSequence: entries[0]?.sequence || 0,
          lastSequence: entries[entries.length - 1]?.sequence || 0,
          createdAt: stat.birthtime,
        };
      });
  }

  private readWALFile(filePath: string): WALEntry[] {
    try {
      return fs.readFileSync(filePath, 'utf-8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => { try { return JSON.parse(line); } catch { return null; } })
        .filter((e): e is WALEntry => e !== null);
    } catch {
      return [];
    }
  }

  private getLastSequence(): number {
    const files = this.getWALFiles();
    if (files.length === 0) return 0;
    const entries = this.readWALFile(files[0]!.path);
    return entries[entries.length - 1]?.sequence ?? 0;
  }

  private getLastCheckpointSequence(): number {
    for (const file of this.getWALFiles()) {
      const cps = this.readWALFile(file.path).filter((e) => e.operation === 'checkpoint');
      if (cps.length > 0) return cps[cps.length - 1]!.sequence;
    }
    return 0;
  }

  private findLatestCheckpoint(walFiles: WALFileInfo[]): { state: UnifiedState; sequence: number } | null {
    for (const file of walFiles) {
      const entries = this.readWALFile(file.path);
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i]!;
        if (e.operation !== 'checkpoint') continue;
        const eData = isRecord(e.data) ? e.data : undefined;
        if (eData && 'stateSnapshot' in eData) {
          const snapshot = eData.stateSnapshot;
          if (isUnifiedState(snapshot)) {
            return { state: snapshot, sequence: e.sequence };
          }
        }
      }
    }
    return null;
  }

  private startCheckpointTimer(interval: number): void {
    this.checkpointTimer = setInterval(() => {
      // Intentionally empty — the owner (StateManager facade) is
      // responsible for calling checkpoint() at the right time.
    }, interval);
  }

  private stopCheckpointTimer(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
  }
}
