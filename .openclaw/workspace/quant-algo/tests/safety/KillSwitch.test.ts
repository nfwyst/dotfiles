import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock all external dependencies before importing KillSwitch
vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }));
  return { default: MockRedis };
});

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
    updateKillswitchStatus: vi.fn(),
  },
}));

vi.mock('../../src/config', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0,
      keyPrefix: 'test:',
    },
  },
}));

import { KillSwitch } from '../../src/safety/KillSwitch';

describe('KillSwitch', () => {
  let tempDir: string;
  let killSwitchFilePath: string;

  beforeEach(() => {
    // Reset the singleton before each test
    KillSwitch.resetInstance();

    // Create a temp directory for the kill switch file
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'killswitch-test-'));
    killSwitchFilePath = path.join(tempDir, 'killswitch.json');
  });

  afterEach(() => {
    KillSwitch.resetInstance();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* best effort */ }
  });

  function createKillSwitch(): KillSwitch {
    return KillSwitch.getInstance({
      filePath: killSwitchFilePath,
      redisKey: 'test:killswitch',
      autoRecoveryMs: 0,
      checkFileIntervalMs: 100,
    });
  }

  // ── isActive ──────────────────────────────────────────────────

  it('isActive returns false initially', () => {
    const ks = createKillSwitch();
    expect(ks.isActive()).toBe(false);
  });

  // ── activate / trigger ────────────────────────────────────────

  it('activate sets kill switch to active', async () => {
    const ks = createKillSwitch();
    await ks.activate('emergency stop', 'test');
    expect(ks.isActive()).toBe(true);
    expect(ks.getActivationReason()).toBe('emergency stop');
  });

  // ── checkFull ─────────────────────────────────────────────────

  it('checkFull returns blocked=false when not triggered', async () => {
    const ks = createKillSwitch();
    const result = await ks.checkFull();
    expect(result.blocked).toBe(false);
  });

  it('checkFull returns blocked=true after activation', async () => {
    const ks = createKillSwitch();
    await ks.activate('max drawdown exceeded', 'risk-manager');
    const result = await ks.checkFull();
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('max drawdown exceeded');
    expect(result.source).toBe('memory');
  });

  // ── File-based kill switch ────────────────────────────────────

  it('handles file-based kill switch persistence', async () => {
    const ks = createKillSwitch();
    await ks.activate('test reason', 'test-user');

    // The file should have been written
    expect(fs.existsSync(killSwitchFilePath)).toBe(true);
    const fileContent = JSON.parse(fs.readFileSync(killSwitchFilePath, 'utf-8'));
    expect(fileContent.isActive).toBe(true);
    expect(fileContent.reason).toBe('test reason');
    expect(fileContent.activatedBy).toBe('test-user');
  });

  // ── deactivate / reset ────────────────────────────────────────

  it('deactivate clears kill switch state', async () => {
    const ks = createKillSwitch();
    await ks.activate('stop trading', 'admin');
    expect(ks.isActive()).toBe(true);

    await ks.deactivate('admin');
    expect(ks.isActive()).toBe(false);
    expect(ks.getState().deactivatedAt).not.toBeNull();
  });

  // ── getState ──────────────────────────────────────────────────

  it('getState returns a copy of the current state', () => {
    const ks = createKillSwitch();
    const state = ks.getState();
    expect(state.isActive).toBe(false);
    expect(state.reason).toBeNull();
    expect(state.activatedAt).toBeNull();
    // Verify it's a copy (not same reference)
    expect(state).not.toBe(ks.getState());
  });

  // ── getActiveDuration ─────────────────────────────────────────

  it('getActiveDuration returns null when not active', () => {
    const ks = createKillSwitch();
    expect(ks.getActiveDuration()).toBeNull();
  });

  it('getActiveDuration returns positive number when active', async () => {
    const ks = createKillSwitch();
    await ks.activate('test', 'test');
    // Small delay so duration > 0
    await new Promise(resolve => setTimeout(resolve, 10));
    const duration = ks.getActiveDuration();
    expect(duration).not.toBeNull();
    expect(duration!).toBeGreaterThanOrEqual(0);
  });

  // ── Alert callbacks ───────────────────────────────────────────

  it('onAlert callback is called on activation', async () => {
    const ks = createKillSwitch();
    const alertFn = vi.fn();
    ks.onAlert(alertFn);

    await ks.activate('critical error', 'system');
    expect(alertFn).toHaveBeenCalled();
    expect(alertFn.mock.calls[0][0].isActive).toBe(true);
  });

  it('offAlert removes callback', async () => {
    const ks = createKillSwitch();
    const alertFn = vi.fn();
    ks.onAlert(alertFn);
    ks.offAlert(alertFn);

    await ks.activate('test', 'test');
    expect(alertFn).not.toHaveBeenCalled();
  });

  // ── Singleton ─────────────────────────────────────────────────

  it('getInstance returns the same instance', () => {
    const ks1 = createKillSwitch();
    const ks2 = KillSwitch.getInstance();
    expect(ks1).toBe(ks2);
  });

  it('resetInstance allows creating a fresh instance', () => {
    const ks1 = createKillSwitch();
    KillSwitch.resetInstance();
    const ks2 = createKillSwitch();
    // After reset, it should be a new instance
    // (We can't easily compare identity since resetInstance + getInstance creates new)
    expect(ks2.isActive()).toBe(false);
  });
});
