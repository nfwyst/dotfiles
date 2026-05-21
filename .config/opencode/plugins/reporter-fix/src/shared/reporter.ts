import type { ReporterConfig } from './config.ts';
import { type DebugLogger } from './debug.ts';
import { logError } from './log.ts';
import { version } from '../version.ts';

export interface TelemetryRecord {
  created_at: number;
  username: string;
  git_url: string;
  file_path: string;
  accept_content: string;
  sign: string;
  model?: string;
  session_id: string;
  tool_name: string;
  call_id: string;
  source: string;
  branch?: string;
  base_url?: string;
  commit_hash?: string;
}

interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type FetchLike = (...args: [string, Record<string, unknown>?]) => Promise<FetchResponseLike>;

export class TelemetryReporter {
  private readonly config: ReporterConfig;
  private readonly fetchImpl: FetchLike;
  private readonly debugLogger?: DebugLogger;
  private queue: TelemetryRecord[] = [];
  private readonly timer?: ReturnType<typeof globalThis.setInterval>;
  private flushPromise: Promise<void> | null = null;
  private retryCount = 0;
  private droppedFromOverflow = 0;
  private disposed = false;
  private static readonly MAX_RETRY = 5;
  private static readonly MAX_QUEUE_SIZE = 10000;

  constructor(
    config: ReporterConfig,
    fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
    debugLogger?: DebugLogger
  ) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.debugLogger = debugLogger;

    this.debugLogger?.log('reporter.init', {
      enabled: this.enabled,
      endpoint: this.config.endpoint,
      flushIntervalMs: this.config.flushIntervalMs,
      maxBatchSize: this.config.maxBatchSize,
    });

    if (this.config.enabled && this.config.flushIntervalMs > 0) {
      this.timer = globalThis.setInterval(() => {
        void this.flush();
      }, this.config.flushIntervalMs);
      this.timer.unref?.();
    }
  }

  get enabled(): boolean {
    return this.config.enabled && this.config.endpoint.length > 0;
  }

  enqueue(records: TelemetryRecord[]): void {
    if (!this.enabled || records.length === 0) {
      this.debugLogger?.log('reporter.enqueue.skip', {
        enabled: this.enabled,
        recordCount: records.length,
      });
      return;
    }

    if (this.disposed) {
      this.debugLogger?.log('reporter.enqueue.skip', {
        reason: 'disposed',
        recordCount: records.length,
      });
      return;
    }

    this.queue.push(...records);

    let dropped = 0;
    while (this.queue.length > TelemetryReporter.MAX_QUEUE_SIZE) {
      this.queue.shift();
      dropped++;
    }
    if (dropped > 0) {
      this.droppedFromOverflow += dropped;
      // Surface drops at WARN level so operators notice when telemetry is
      // being silently discarded due to backend outages.
      logError(
        `上报队列已满，丢弃 ${dropped} 条记录（累计丢弃 ${this.droppedFromOverflow} 条）。`
      );
      this.debugLogger?.log('reporter.enqueue.overflow', {
        droppedThisCall: dropped,
        droppedTotal: this.droppedFromOverflow,
        queueLength: this.queue.length,
      });
    }

    this.debugLogger?.log('reporter.enqueue', {
      recordCount: records.length,
      queueLength: this.queue.length,
    });

    if (this.queue.length >= this.config.maxBatchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.enabled) {
      this.debugLogger?.log('reporter.flush.skip', { reason: 'disabled' });
      return;
    }

    if (this.queue.length === 0) {
      this.debugLogger?.log('reporter.flush.skip', { reason: 'empty-queue' });
      return;
    }

    if (this.flushPromise) {
      this.debugLogger?.log('reporter.flush.join', {
        queueLength: this.queue.length,
      });
      return this.flushPromise;
    }

    this.debugLogger?.log('reporter.flush.start', {
      queueLength: this.queue.length,
    });

    this.flushPromise = this.flushInternal().finally(() => {
      this.debugLogger?.log('reporter.flush.end', { queueLength: this.queue.length });
      this.flushPromise = null;
    });

    await this.flushPromise;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.timer) {
      globalThis.clearInterval(this.timer);
    }

    this.debugLogger?.log('reporter.dispose.start', {
      queueLength: this.queue.length,
    });
    await this.flush();
    await this.debugLogger?.flush();
  }

  private async flushInternal(): Promise<void> {
    let offset = 0;
    while (offset < this.queue.length) {
      const batchSize = Math.min(this.config.maxBatchSize, this.queue.length - offset);
      const batch = this.queue.slice(offset, offset + batchSize);
      this.debugLogger?.log('reporter.flush.batch', { batchSize, queueLength: this.queue.length });
      const result = await this.send(batch);
      this.debugLogger?.log('reporter.flush.result', { result, batchSize });

      if (result === 'retry') {
        this.retryCount++;
        if (this.retryCount > TelemetryReporter.MAX_RETRY) {
          this.retryCount = 0;
          offset += batchSize;
          continue;
        }
        // Exponential backoff lives INSIDE flushInternal so we keep the
        // single-flight contract: callers awaiting flush() never block on
        // retry sleeps from a previous (already returned) flush cycle.
        const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 60000);
        await new Promise((r) => {
          const t = setTimeout(r, delay);
          t.unref?.();
        });
        // Don't advance offset; same batch will be re-sent next iteration.
        continue;
      }

      this.retryCount = 0;
      offset += batchSize;
    }
    if (offset > 0) {
      this.queue = this.queue.slice(offset);
    }
  }

  private async send(records: TelemetryRecord[]): Promise<'success' | 'drop' | 'retry'> {
    const controller = new globalThis.AbortController();
    const timeout: ReturnType<typeof globalThis.setTimeout> = globalThis.setTimeout(
      () => controller.abort(),
      this.config.timeoutMs
    );

    try {
      this.debugLogger?.log('reporter.send.start', {
        recordCount: records.length,
        endpoint: this.config.endpoint,
      });

      const response = await this.fetchImpl(this.config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.config.token ? { authorization: `Bearer ${this.config.token}` } : {}),
          ...this.config.headers,
          'x-sdk-version': version,
        },
        body: JSON.stringify(records),
        signal: controller.signal,
      });

      if (response.ok) {
        this.debugLogger?.log('reporter.send.success', {
          recordCount: records.length,
          status: response.status,
        });
        return 'success';
      }

      const body: string = await response.text().catch(() => '');
      logError(`上报请求失败，状态码 ${response.status}: ${body}`);
      this.debugLogger?.log('reporter.send.failure', {
        recordCount: records.length,
        status: response.status,
        body,
      });

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return 'drop';
      }

      return 'retry';
    } catch (error) {
      const message: string = error instanceof Error ? error.message : String(error);
      logError(`上报请求失败: ${message}`);
      this.debugLogger?.log('reporter.send.error', {
        recordCount: records.length,
        message,
      });
      return 'retry';
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }
}
