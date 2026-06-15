// FIX M1: Snapshot/persistence logic extracted into its own module.
// All snapshot file I/O is isolated here.

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import type {
  UnifiedState,
  StateSnapshot,
  SnapshotInfo,
} from './types';
import { migratePosition } from './types';

const DEFAULT_MAX_SNAPSHOTS = 5;

export interface SnapshotManagerConfig {
  snapshotDir: string;
  maxSnapshots?: number;
}

/**
 * Manages periodic and on-demand state snapshots.
 */
export class SnapshotManager {
  private snapshotDir: string;
  private maxSnapshots: number;
  private autoTimer: NodeJS.Timeout | null = null;

  // FIX M1: Config is injected, not module-scoped constants
  constructor(config: SnapshotManagerConfig) {
    this.snapshotDir = config.snapshotDir;
    this.maxSnapshots = config.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS;
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /** Create a snapshot of `state` and return its metadata. */
  createSnapshot(state: UnifiedState, reason: string = 'manual'): SnapshotInfo | null {
    try {
      if (!fs.existsSync(this.snapshotDir)) {
        fs.mkdirSync(this.snapshotDir, { recursive: true });
      }

      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `snapshot-${timestamp}.json`;
      const filePath = path.join(this.snapshotDir, filename);

      const stateData = JSON.stringify(state, null, 2);
      const checksum = this.calculateChecksum(stateData);

      const snapshot: StateSnapshot = {
        version: '1.0.0',
        timestamp: now.toISOString(),
        checksum,
        state,
      };

      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
      this.cleanupOldSnapshots();

      return {
        filename,
        timestamp: snapshot.timestamp,
        checksum,
        size: fs.statSync(filePath).size,
      };
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      return null;
    }
  }

  /** List all snapshots ordered newest-first. */
  listSnapshots(): SnapshotInfo[] {
    try {
      if (!fs.existsSync(this.snapshotDir)) return [];

      return fs.readdirSync(this.snapshotDir)
        .filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))
        .sort()
        .reverse()
        .map((file) => {
          const filePath = path.join(this.snapshotDir, file);
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return {
              filename: file,
              timestamp: data.timestamp || 'unknown',
              checksum: data.checksum || 'unknown',
              size: fs.statSync(filePath).size,
            };
          } catch {
            return null;
          }
        })
        .filter((s): s is SnapshotInfo => s !== null);
    } catch {
      return [];
    }
  }

  /**
   * Restore the snapshot matching `timestamp` (or the latest one).
   * Returns the state, or null on failure.
   *
   * FIX H7: Applies migratePosition() to handle legacy snapshots that
   * used the old Position shape (contracts/pnl instead of size/unrealizedPnl).
   */
  restoreSnapshot(timestamp?: string): UnifiedState | null {
    try {
      const snapshots = this.listSnapshots();
      if (snapshots.length === 0) return null;

      const target = timestamp
        ? snapshots.find((s) => s.timestamp.startsWith(timestamp))
        : snapshots[0];
      if (!target) return null;

      const filePath = path.join(this.snapshotDir, target.filename);
      const snapshot: StateSnapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // Verify checksum
      const stateData = JSON.stringify(snapshot.state, null, 2);
      if (this.calculateChecksum(stateData) !== snapshot.checksum) {
        console.error(`Snapshot checksum mismatch: ${target.filename}`);
        return null;
      }

      // FIX H7: Migrate legacy Position fields in restored state
      const state = snapshot.state;
      if (state.trading) {
        if (state.trading.position) {
          state.trading.position = migratePosition(state.trading.position);
        }
        if (state.trading.lastPosition) {
          state.trading.lastPosition = migratePosition(state.trading.lastPosition);
        }
      }

      return state;
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      return null;
    }
  }

  /** Start a repeating timer that calls `snapshotFn` periodically. */
  startAutoSnapshot(interval: number, snapshotFn: () => void): void {
    this.stopAutoSnapshot();
    this.autoTimer = setInterval(snapshotFn, interval);
  }

  stopAutoSnapshot(): void {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private calculateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private cleanupOldSnapshots(): number {
    try {
      if (!fs.existsSync(this.snapshotDir)) return 0;

      const files = fs.readdirSync(this.snapshotDir)
        .filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))
        .sort()
        .reverse();

      let deleted = 0;
      for (let i = this.maxSnapshots; i < files.length; i++) {
        const file = files[i];
        if (file) {
          fs.unlinkSync(path.join(this.snapshotDir, file));
          deleted++;
        }
      }
      return deleted;
    } catch {
      return 0;
    }
  }
}
