// FIX M1: Extracted all type definitions from the stateManager god object
// into a dedicated types module. No runtime code lives here.
//
// FIX H7: Position type is now re-exported from events/types.ts (canonical
// source) instead of being duplicated with different field names.

import { Position } from '../events/types';
import type { LLMTradingSignal } from '../modules/llmAnalysis';
import type { StrategySignal } from '../modules/strategyEngine';
import type { OCSEnhancedOutput } from '../ocs/enhanced/index';

// Re-export the canonical Position type so that any code importing
// Position from 'state/types' continues to work seamlessly.
export type { Position } from '../events/types';

// ============================================
// WAL Types
// ============================================

/** WAL operation discriminator */
export type WALOperationType =
  | 'updateTrading'
  | 'updatePosition'
  | 'recordTrade'
  | 'updateLLM'
  | 'updateNotification'
  | 'updateStrategy'
  | 'updateDaemon'
  | 'updateCache'
  | 'checkpoint'
  | 'heartbeat';

/** Single WAL record */
export interface WALEntry {
  sequence: number;
  timestamp: number;
  operation: WALOperationType;
  data: unknown;
  checksum: string;
}

/** Metadata for one WAL file on disk */
export interface WALFileInfo {
  filename: string;
  path: string;
  size: number;
  entryCount: number;
  firstSequence: number;
  lastSequence: number;
  createdAt: Date;
}

/** Aggregated WAL statistics */
export interface WALStats {
  totalEntries: number;
  totalSize: number;
  fileCount: number;
  lastSequence: number;
  lastCheckpointSequence: number;
  pendingOperations: number;
  walFiles: WALFileInfo[];
}

// ============================================
// FIX H7: Legacy Position shape for snapshot migration
// ============================================

/**
 * The old Position shape that may exist in persisted snapshots
 * and WAL entries written before the H7 unification.
 *
 * This interface is ONLY used for migration/deserialization.
 * All runtime code uses the canonical Position from events/types.
 */
export interface LegacyStatePosition {
  side: 'long' | 'short' | 'none';
  contracts: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  stopLoss?: number;
  takeProfit?: number;
}

/**
 * FIX H7: Migrate a legacy state Position (with `contracts`/`pnl`)
 * to the canonical Position (with `size`/`unrealizedPnl`/`leverage`).
 *
 * This is called during:
 *   - Snapshot restoration
 *   - WAL replay
 *   - Initial state load from disk
 *
 * If the position already has the canonical fields, it is returned as-is.
 */
export function migratePosition(raw: unknown): Position | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return null;
  // After the typeof/null checks above, raw is a non-null object.
  // Use Record<string, unknown> via intersection to satisfy the index signature.
  const rec = raw as Record<string, unknown>;

  // Helper: parse side field with validation
  function parseSide(v: unknown): Position['side'] {
    if (v === 'long' || v === 'short' || v === 'none') return v;
    return 'none';
  }

  // Helper: parse a required numeric field with a default
  function requiredNum(v: unknown, fallback: number): number {
    return typeof v === 'number' ? v : fallback;
  }

  // Helper: parse an optional numeric field
  function optionalNum(v: unknown): number | undefined {
    return typeof v === 'number' ? v : undefined;
  }

  // Already canonical (has `size` field) — return as-is
  if (typeof rec.size === 'number') {
    return {
      side: parseSide(rec.side),
      size: rec.size,
      entryPrice: requiredNum(rec.entryPrice, 0),
      leverage: requiredNum(rec.leverage, 1),
      unrealizedPnl: requiredNum(rec.unrealizedPnl, 0),
      markPrice: optionalNum(rec.markPrice),
      liquidationPrice: optionalNum(rec.liquidationPrice),
      stopLoss: optionalNum(rec.stopLoss),
      takeProfit: optionalNum(rec.takeProfit),
    };
  }

  // Legacy format (has `contracts` field) — migrate
  if (typeof rec.contracts === 'number') {
    return {
      side: parseSide(rec.side),
      size: rec.contracts,                        // contracts -> size
      entryPrice: requiredNum(rec.entryPrice, 0),
      leverage: requiredNum(rec.leverage, 1),      // default 1 if missing
      unrealizedPnl: requiredNum(rec.pnl, 0),     // pnl -> unrealizedPnl
      markPrice: optionalNum(rec.markPrice),
      liquidationPrice: optionalNum(rec.liquidationPrice),
      stopLoss: optionalNum(rec.stopLoss),
      takeProfit: optionalNum(rec.takeProfit),
    };
  }

  // Unknown shape — return null rather than corrupt state
  return null;
}


// ============================================
// Unified State
// ============================================

export interface UnifiedState {
  version: string;
  createdAt: string;
  updatedAt: string;

  trading: {
    balance: number;
    position: Position | null;
    lastPosition: Position | null;
    tradeCount: number;
    totalPnL: number;
    startTime: number;
    lastCheck: number;
  };

  llm: {
    lastDecision: LLMTradingSignal | null;
    lastDecisionTime: number;
    lastDecisionPrice: number;
    thinking: string | null;
  };

  notification: {
    lastReportHash: string;
    lastReportTime: number;
    lastNotifyCheck: number;
    pendingNotifications: string[];
  };

  strategy: {
    lastSignal: StrategySignal | null;
    lastSignalTime: number;
    strategyOutput: OCSEnhancedOutput | null;
  };

  daemon: {
    pid: number | null;
    startTime: number | null;
    lastHeartbeat: number;
    status: 'running' | 'stopped' | 'error';
    errorCount: number;
    lastError: string | null;
  };

  cache: {
    newsCache: string;
    newsCacheTime: number;
    priceHistory: number[];
    lastPriceUpdateTime: number;
  };
}

// ============================================
// Snapshot Types
// ============================================

export interface StateSnapshot {
  version: string;
  timestamp: string;
  checksum: string;
  state: UnifiedState;
}

export interface SnapshotInfo {
  filename: string;
  timestamp: string;
  checksum: string;
  size: number;
}

// ============================================
// Configuration
// ============================================

/** FIX M1: Configuration is now injectable instead of hard-coded constants */
export interface StateConfig {
  /** Root directory for all state artefacts */
  stateDir: string;
  /** Maximum snapshots to retain */
  maxSnapshots?: number;
  /** Operations between WAL checkpoints */
  checkpointInterval?: number;
  /** Milliseconds between time-based checkpoints */
  checkpointTimeInterval?: number;
  /** Milliseconds between automatic snapshots */
  autoSnapshotInterval?: number;
}

// ============================================
// Defaults
// ============================================

export function createDefaultState(): UnifiedState {
  return {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    trading: {
      balance: 0,
      position: null,
      lastPosition: null,
      tradeCount: 0,
      totalPnL: 0,
      startTime: Date.now(),
      lastCheck: 0,
    },

    llm: {
      lastDecision: null,
      lastDecisionTime: 0,
      lastDecisionPrice: 0,
      thinking: null,
    },

    notification: {
      lastReportHash: '',
      lastReportTime: 0,
      lastNotifyCheck: 0,
      pendingNotifications: [],
    },

    strategy: {
      lastSignal: null,
      lastSignalTime: 0,
      strategyOutput: null,
    },

    daemon: {
      pid: null,
      startTime: null,
      lastHeartbeat: 0,
      status: 'stopped',
      errorCount: 0,
      lastError: null,
    },

    cache: {
      newsCache: '',
      newsCacheTime: 0,
      priceHistory: [],
      lastPriceUpdateTime: 0,
    },
  };
}
