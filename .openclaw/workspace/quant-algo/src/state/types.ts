// FIX M1: Extracted all type definitions from the stateManager god object
// into a dedicated types module. No runtime code lives here.

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
  data: any;
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
// Domain Types
// ============================================

export interface Position {
  side: 'long' | 'short' | 'none';
  contracts: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  stopLoss?: number;
  takeProfit?: number;
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
    lastDecision: any | null;
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
    lastSignal: any | null;
    lastSignalTime: number;
    strategyOutput: any | null;
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
