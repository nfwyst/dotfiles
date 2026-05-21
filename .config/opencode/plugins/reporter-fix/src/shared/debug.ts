import os from 'os';
import path from 'path';
import { stat, readdir, unlink } from 'fs/promises';
import { version } from '../version.ts';
import type { ReporterConfig } from './config.ts';
import { appendTextFile } from './file.ts';
import { logError } from './log.ts';

export interface DebugLogger {
  readonly enabled: boolean;
  log(step: string, data?: Record<string, unknown>): void;
  flush(): Promise<void>;
}

interface DebugEntry {
  timestamp: string;
  worktree: string;
  plugin_version: string;
  step: string;
  data?: Record<string, unknown>;
}

class NoopDebugLogger implements DebugLogger {
  readonly enabled: boolean = false;

  log(_step: string, _data?: Record<string, unknown>): void {}

  async flush(): Promise<void> {}
}

const MAX_LOG_FILE_BYTES: number = 32 * 1024 * 1024; // 32 MB per hour-bucket
const RETENTION_DAYS: number = 7;

class JsonlDebugLogger implements DebugLogger {
  readonly enabled: boolean = true;
  private readonly worktree: string;
  private readonly filePath: string;
  private pendingWrite: Promise<void> = Promise.resolve();
  private pendingCount = 0;
  private suspended: boolean = false;

  constructor(worktree: string, filePath: string) {
    this.worktree = worktree;
    this.filePath = filePath;
  }

  log(step: string, data?: Record<string, unknown>): void {
    if (this.suspended) return;

    const entry: DebugEntry = {
      timestamp: new Date().toISOString(),
      worktree: this.worktree,
      plugin_version: version,
      step,
      ...(data ? { data } : {}),
    };

    this.pendingCount++;
    if (this.pendingCount > 256) {
      this.pendingWrite = Promise.resolve();
      this.pendingCount = 0;
    }

    this.pendingWrite = this.pendingWrite
      .then(() => this.appendIfWithinSizeBudget(entry));

    this.pendingWrite.catch((error) => {
      const message: string = error instanceof Error ? error.message : String(error);
      logError(`写入 debug 日志失败: ${message}`);
    });
  }

  private async appendIfWithinSizeBudget(entry: DebugEntry): Promise<void> {
    try {
      const info = await stat(this.filePath).catch(() => undefined);
      if (info && info.size > MAX_LOG_FILE_BYTES) {
        // Rather than rotate (which would race with concurrent writers), we
        // suspend further writes for this hour-bucket. The next bucket starts
        // fresh on the next hour boundary thanks to formatDebugLogHour().
        this.suspended = true;
        logError(`debug 日志已达到 ${MAX_LOG_FILE_BYTES} 字节，本时段后续日志已暂停。`);
        return;
      }
      await appendTextFile(this.filePath, JSON.stringify(entry) + '\n');
    } catch (error) {
      const message: string = error instanceof Error ? error.message : String(error);
      logError(`写入 debug 日志失败: ${message}`);
    }
  }

  async flush(): Promise<void> {
    await this.pendingWrite.catch(() => undefined);
  }
}

const NOOP_DEBUG_LOGGER: DebugLogger = new NoopDebugLogger();

function padTimeSegment(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDebugLogHour(date: Date): string {
  const year: number = date.getFullYear();
  const month: string = padTimeSegment(date.getMonth() + 1);
  const day: string = padTimeSegment(date.getDate());
  const hour: string = padTimeSegment(date.getHours());

  return `${year}_${month}_${day}_${hour}00`;
}

/**
 * Pick a log directory that exists on the current OS. macOS keeps the
 * historical ~/Library/Logs path so existing tooling keeps working; on other
 * platforms we fall back to a hidden state directory under $HOME.
 */
function defaultLogDirectory(homeDirectory: string): string {
  if (process.platform === 'darwin') {
    return path.join(homeDirectory, 'Library', 'Logs', 'opencode-reporter-plugin');
  }
  return path.join(homeDirectory, '.opencode-reporter-plugin', 'logs');
}

export function createDebugLogFilePath(
  source: string,
  homeDirectory: string = os.homedir(),
  now: number = Date.now()
): string {
  const fileName: string = `${source}-${formatDebugLogHour(new Date(now))}.jsonl`;
  return path.join(defaultLogDirectory(homeDirectory), fileName);
}

async function pruneOldLogs(directory: string, retentionMs: number): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return;
  }
  const cutoff = Date.now() - retentionMs;
  await Promise.all(
    entries.map(async (name) => {
      const target = path.join(directory, name);
      try {
        const info = await stat(target);
        if (info.isFile() && info.mtimeMs < cutoff) {
          await unlink(target).catch(() => undefined);
        }
      } catch {
        // ignore missing files / permission errors
      }
    })
  );
}

export function createDebugLogger(
  config: ReporterConfig,
  source: string,
  worktree: string
): DebugLogger {
  if (!config.debug) {
    return NOOP_DEBUG_LOGGER;
  }

  const filePath: string = createDebugLogFilePath(source);
  // Best-effort retention sweep; never blocks plugin startup.
  void pruneOldLogs(path.dirname(filePath), RETENTION_DAYS * 24 * 60 * 60 * 1000).catch(
    () => undefined
  );
  return new JsonlDebugLogger(worktree, filePath);
}
