// FIX M1: WAL logic extracted from the god object into a focused module.
// All file I/O for the write-ahead log is isolated here.

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
  async append(operation: WALOperationType, data: any): Promise<number> {
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
      state = cp.state;
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

    switch (entry.operation) {
      case 'updateTrading':
        s.trading = { ...s.trading, ...entry.data };
        break;
      case 'updatePosition':
        if (entry.data.position) s.trading.lastPosition = s.trading.position;
        s.trading.position = entry.data.position;
        s.trading.lastCheck = Date.now();
        break;
      case 'recordTrade':
        s.trading.tradeCount++;
        s.trading.totalPnL += entry.data.pnl || 0;
        break;
      case 'updateLLM':
        s.llm = { ...s.llm, ...entry.data };
        break;
      case 'updateNotification':
        s.notification = { ...s.notification, ...entry.data };
        break;
      case 'updateStrategy':
        s.strategy = { ...s.strategy, ...entry.data };
        break;
      case 'updateDaemon':
        s.daemon = { ...s.daemon, ...entry.data };
        break;
      case 'updateCache':
        s.cache = { ...s.cache, ...entry.data };
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
        if (e.operation === 'checkpoint' && e.data?.stateSnapshot) {
          return { state: e.data.stateSnapshot as UnifiedState, sequence: e.sequence };
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
