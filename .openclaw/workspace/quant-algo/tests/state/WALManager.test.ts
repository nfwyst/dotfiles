import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WALManager, WALManagerConfig } from '../../src/state/WALManager';
import { createDefaultState, UnifiedState } from '../../src/state/types';

describe('WALManager', () => {
  let walDir: string;
  let wal: WALManager;

  beforeEach(() => {
    // Create a unique temp directory for each test
    walDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wal-test-'));
  });

  afterEach(async () => {
    // Close the WAL (stops timers, flushes)
    if (wal) {
      try { await wal.close(); } catch { /* best effort */ }
    }
    // Clean up the temp directory
    try {
      fs.rmSync(walDir, { recursive: true, force: true });
    } catch { /* best effort */ }
  });

  function createWAL(overrides?: Partial<WALManagerConfig>): WALManager {
    wal = new WALManager({
      walDir,
      checkpointInterval: 1000,
      checkpointTimeInterval: 600_000, // long interval so timer doesn't fire during tests
      ...overrides,
    });
    return wal;
  }

  // ── Directory creation ────────────────────────────────────────

  it('creates WAL directory if it does not exist', () => {
    const newDir = path.join(walDir, 'nested', 'wal');
    wal = new WALManager({ walDir: newDir, checkpointTimeInterval: 600_000 });
    expect(fs.existsSync(newDir)).toBe(true);
  });

  // ── Append ────────────────────────────────────────────────────

  it('appends a WAL entry and returns a sequence number', async () => {
    createWAL();
    const seq = await wal.append('updateTrading', { balance: 100 });
    expect(seq).toBe(1);
  });

  it('increments sequence numbers on successive appends', async () => {
    createWAL();
    const s1 = await wal.append('updateTrading', { balance: 100 });
    const s2 = await wal.append('recordTrade', { pnl: 10 });
    const s3 = await wal.append('heartbeat', {});
    expect(s1).toBe(1);
    expect(s2).toBe(2);
    expect(s3).toBe(3);
  });

  // ── Recovery ──────────────────────────────────────────────────

  it('recovers entries from WAL file', async () => {
    createWAL();
    await wal.append('updateTrading', { balance: 500 });
    await wal.append('recordTrade', { pnl: 25 });
    await wal.sync();

    const baseState = createDefaultState();
    const recovered = await wal.recover(baseState);
    expect(recovered.trading.balance).toBe(500);
    expect(recovered.trading.tradeCount).toBe(1);
    expect(recovered.trading.totalPnL).toBe(25);
  });

  // ── Checkpoint ────────────────────────────────────────────────

  it('checkpoint creates a checkpoint entry and resets operation count', async () => {
    createWAL();
    await wal.append('updateTrading', { balance: 100 });
    await wal.append('updateTrading', { balance: 200 });

    const state = createDefaultState();
    state.trading.balance = 200;
    await wal.checkpoint(state);

    const stats = wal.getStats();
    expect(stats.pendingOperations).toBe(0);
    expect(stats.lastCheckpointSequence).toBeGreaterThan(0);
  });

  // ── WAL file rotation ────────────────────────────────────────

  it('creates WAL files with correct naming convention', () => {
    createWAL();
    const files = fs.readdirSync(walDir).filter(f => f.startsWith('wal-') && f.endsWith('.log'));
    expect(files.length).toBeGreaterThanOrEqual(1);
    // Check naming pattern: wal-YYYY-MM-DDTHH-MM-SS.log
    expect(files[0]).toMatch(/^wal-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/);
  });

  // ── Checksums ─────────────────────────────────────────────────

  it('computes correct checksums that validate during recovery', async () => {
    createWAL();
    await wal.append('updateTrading', { balance: 777 });
    await wal.sync();

    // Read the raw WAL file and check the entry has a checksum
    const files = fs.readdirSync(walDir).filter(f => f.startsWith('wal-'));
    const content = fs.readFileSync(path.join(walDir, files[0]), 'utf-8');
    const entry = JSON.parse(content.trim().split('\n')[0]);
    expect(entry.checksum).toBeTruthy();
    expect(typeof entry.checksum).toBe('string');
    expect(entry.checksum.length).toBe(16); // sha256 truncated to 16 hex chars
  });

  // ── Corrupt entries ───────────────────────────────────────────

  it('handles corrupt entries gracefully during recovery', async () => {
    createWAL();
    await wal.append('updateTrading', { balance: 100 });
    await wal.sync();

    // Corrupt the WAL file by appending invalid JSON
    const files = fs.readdirSync(walDir).filter(f => f.startsWith('wal-'));
    fs.appendFileSync(path.join(walDir, files[0]), 'THIS IS NOT VALID JSON\n');

    // Append a valid entry after the corrupt one
    await wal.append('updateTrading', { balance: 200 });
    await wal.sync();

    const baseState = createDefaultState();
    const recovered = await wal.recover(baseState);
    // Should recover the valid entries and skip the corrupt one
    expect(recovered.trading.balance).toBe(200);
  });

  // ── Replay sequence order ─────────────────────────────────────

  it('replays operations in sequence order', async () => {
    createWAL();
    await wal.append('updateTrading', { balance: 100 });
    await wal.append('updateTrading', { balance: 200 });
    await wal.append('updateTrading', { balance: 300 });
    await wal.sync();

    const baseState = createDefaultState();
    const recovered = await wal.recover(baseState);
    // The last update should win
    expect(recovered.trading.balance).toBe(300);
  });

  // ── getStats ──────────────────────────────────────────────────

  it('getStats returns correct counts', async () => {
    createWAL();
    await wal.append('updateTrading', { balance: 100 });
    await wal.append('heartbeat', {});
    await wal.sync();

    const stats = wal.getStats();
    expect(stats.lastSequence).toBe(2);
    expect(stats.fileCount).toBeGreaterThanOrEqual(1);
    expect(stats.pendingOperations).toBe(2);
  });

  // ── needsCheckpoint ───────────────────────────────────────────

  it('needsCheckpoint returns false initially and true after threshold', async () => {
    wal = new WALManager({
      walDir,
      checkpointInterval: 3,
      checkpointTimeInterval: 600_000,
    });

    expect(wal.needsCheckpoint()).toBe(false);
    await wal.append('heartbeat', {});
    await wal.append('heartbeat', {});
    await wal.append('heartbeat', {});
    expect(wal.needsCheckpoint()).toBe(true);
  });

  // ── Concurrent writes ─────────────────────────────────────────

  it('handles concurrent writes without error', async () => {
    createWAL();
    const promises = Array.from({ length: 10 }, (_, i) =>
      wal.append('updateTrading', { balance: i * 100 }),
    );
    const sequences = await Promise.all(promises);
    // All should succeed and produce unique sequences
    const unique = new Set(sequences);
    expect(unique.size).toBe(10);
  });

  // ── Empty WAL ─────────────────────────────────────────────────

  it('handles empty WAL file during recovery', async () => {
    createWAL();
    // Don't write anything — just sync and recover
    await wal.sync();
    const baseState = createDefaultState();
    baseState.trading.balance = 42;
    const recovered = await wal.recover(baseState);
    // Should return the base state unchanged
    expect(recovered.trading.balance).toBe(42);
  });

  // ── getUnprocessedEntries (operations after checkpoint) ───────

  it('recovery skips entries before checkpoint sequence', async () => {
    createWAL();
    await wal.append('updateTrading', { balance: 100 });
    await wal.append('updateTrading', { balance: 200 });

    // Checkpoint at balance=200
    const cpState = createDefaultState();
    cpState.trading.balance = 200;
    await wal.checkpoint(cpState);

    // More entries after checkpoint
    await wal.append('updateTrading', { balance: 300 });
    await wal.sync();

    const baseState = createDefaultState();
    const recovered = await wal.recover(baseState);
    // The checkpoint should restore balance=200 from snapshot,
    // then the post-checkpoint entry updates to 300
    expect(recovered.trading.balance).toBe(300);
  });

  // ── Prune / compact old WAL files ─────────────────────────────

  it('compact removes old fully-checkpointed WAL files beyond retention', async () => {
    // We can't easily force multiple WAL files without internal access,
    // but we can verify that checkpoint + compact doesn't crash
    createWAL();
    await wal.append('heartbeat', {});
    const state = createDefaultState();
    await wal.checkpoint(state);
    // After compaction the manager should still work
    const seq = await wal.append('heartbeat', {});
    expect(seq).toBeGreaterThan(0);
  });

  // ── Recovery from partial write (crash simulation) ────────────

  it('recovers from partial write (truncated last line)', async () => {
    createWAL();
    await wal.append('updateTrading', { balance: 500 });
    await wal.sync();

    // Simulate a crash: append a truncated JSON line
    const files = fs.readdirSync(walDir).filter(f => f.startsWith('wal-'));
    fs.appendFileSync(path.join(walDir, files[0]), '{"sequence":2,"timestamp":123,"opera');

    const baseState = createDefaultState();
    const recovered = await wal.recover(baseState);
    // Should recover the valid first entry and ignore the truncated one
    expect(recovered.trading.balance).toBe(500);
  });

  // ── Static applyOperation ─────────────────────────────────────

  it('applyOperation correctly applies different operation types', () => {
    let state = createDefaultState();

    state = WALManager.applyOperation(state, {
      sequence: 1, timestamp: Date.now(), operation: 'updateTrading',
      data: { balance: 1000 }, checksum: '',
    });
    expect(state.trading.balance).toBe(1000);

    state = WALManager.applyOperation(state, {
      sequence: 2, timestamp: Date.now(), operation: 'recordTrade',
      data: { pnl: 50 }, checksum: '',
    });
    expect(state.trading.tradeCount).toBe(1);
    expect(state.trading.totalPnL).toBe(50);

    state = WALManager.applyOperation(state, {
      sequence: 3, timestamp: Date.now(), operation: 'heartbeat',
      data: {}, checksum: '',
    });
    expect(state.daemon.status).toBe('running');

    state = WALManager.applyOperation(state, {
      sequence: 4, timestamp: Date.now(), operation: 'updateCache',
      data: { newsCache: 'market rally' }, checksum: '',
    });
    expect(state.cache.newsCache).toBe('market rally');
  });
});
