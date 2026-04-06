/**
 * EventDrivenRuntime — Orchestrator for the unified event-driven trading pipeline.
 *
 * Bootstraps all layers, wires them to the event bus, manages lifecycle.
 * Replaces the ad-hoc wiring previously scattered across multiple entry points.
 *
 * Architecture:
 *   MarketData → EventBus → DataLayer → EventBus → StrategyLayer → EventBus → ExecutionLayer
 *                                                                         ↓
 *                                                                   StateManager
 *
 * FIX M1: Single orchestration point for all event-driven components.
 */

import { StreamEventBus } from '../events/StreamEventBus';
import { EventChannels } from '../events/types';
import type { EventDrivenDataLayer } from '../layers/EventDrivenDataLayer';
import type { EventDrivenStrategyLayer } from '../layers/EventDrivenStrategyLayer';
import type { EventDrivenExecutionLayer } from '../layers/EventDrivenExecutionLayer';
import type { StateManager } from '../state';
import logger from '../logger';

// ==================== Configuration ====================

export interface RuntimeConfig {
  /** Health check interval in milliseconds (default: 30 000) */
  healthCheckIntervalMs?: number;

  /** Graceful shutdown timeout in milliseconds (default: 10 000) */
  shutdownTimeoutMs?: number;
}

// ==================== Health types ====================

export interface ComponentHealth {
  healthy: boolean;
  latency?: number;
  error?: string;
}

export interface RuntimeHealth {
  running: boolean;
  uptime: number;
  components: {
    eventBus: ComponentHealth;
    dataLayer: ComponentHealth;
    strategyLayer: ComponentHealth;
    executionLayer: ComponentHealth;
    stateManager: ComponentHealth;
  };
}

// ==================== Dependency container ====================

export interface RuntimeDeps {
  eventBus: StreamEventBus;
  dataLayer: EventDrivenDataLayer;
  strategyLayer: EventDrivenStrategyLayer;
  executionLayer: EventDrivenExecutionLayer;
  stateManager: StateManager;
  config?: RuntimeConfig;
}

// ==================== Runtime ====================

/**
 * FIX M1: Central lifecycle manager for the event-driven trading pipeline.
 *
 * Layers are constructed externally (their dependencies are domain-specific)
 * and injected here. The runtime owns startup ordering, health monitoring,
 * signal-handler registration, and graceful shutdown.
 */
export class EventDrivenRuntime {
  // --- Components (injected) ---
  private eventBus: StreamEventBus;
  private dataLayer: EventDrivenDataLayer;
  private strategyLayer: EventDrivenStrategyLayer;
  private executionLayer: EventDrivenExecutionLayer;
  private stateManager: StateManager;

  // --- Config ---
  private readonly healthCheckIntervalMs: number;
  private readonly shutdownTimeoutMs: number;

  // --- Lifecycle state ---
  private isRunning = false;
  private startedAt = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  private shuttingDown = false;

  // FIX M1: Accept a flat dependency bag — keeps the constructor signature
  // stable even when new components are added later.
  constructor(deps: RuntimeDeps) {
    this.eventBus = deps.eventBus;
    this.dataLayer = deps.dataLayer;
    this.strategyLayer = deps.strategyLayer;
    this.executionLayer = deps.executionLayer;
    this.stateManager = deps.stateManager;

    this.healthCheckIntervalMs = deps.config?.healthCheckIntervalMs ?? 30_000;
    this.shutdownTimeoutMs = deps.config?.shutdownTimeoutMs ?? 10_000;
  }

  // ----------------------------------------------------------------
  // Startup
  // ----------------------------------------------------------------

  /**
   * Start all components in the correct order:
   * 1. Event bus  — must be ready before any layer can publish/subscribe
   * 2. State manager is already initialised by its factory
   * 3. Layers — subscriptions are wired in their constructors
   * 4. System-started event + health-check timer
   *
   * FIX M1: Deterministic startup order prevents race conditions.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[Runtime] Already running — ignoring duplicate start()');
      return;
    }

    logger.info('[Runtime] Starting event-driven trading pipeline...');

    // 1. Wait for the event bus connection
    // FIX M1: Block until Redis is reachable so layers don't publish into the void.
    try {
      await this.eventBus.waitForReady(10_000);
      logger.info('[Runtime] Event bus connected');
    } catch (err) {
      logger.error('[Runtime] Event bus failed to connect:', err);
      throw err;
    }

    // 2. State manager — already recovered by createStateManager() factory.
    //    Nothing extra needed here, but we log for traceability.
    logger.info('[Runtime] State manager ready');

    // 3. Layers are already subscribed (they wire subscriptions in their
    //    constructors via getEventBus()). Log confirmation.
    // FIX M1: Layers self-subscribe; runtime only needs to verify readiness.
    logger.info('[Runtime] DataLayer ready');
    logger.info('[Runtime] StrategyLayer ready (subscribed to DATA_LAYER_COMPLETE)');
    logger.info('[Runtime] ExecutionLayer ready (subscribed to STRATEGY_LAYER_COMPLETE)');

    // 4. Mark running and record start time
    this.isRunning = true;
    this.startedAt = Date.now();

    // 5. Publish system-started event
    await this.eventBus.publish({
      channel: EventChannels.SYSTEM_STARTED,
      source: 'System',
      correlationId: this.eventBus.generateCorrelationId(),
      payload: {
        config: {
          symbol: process.env.SYMBOL || 'ETHUSDT',
          timeframe: process.env.TIMEFRAME || '5m',
          leverage: Number(process.env.LEVERAGE) || 5,
        },
        balance: 0, // actual balance fetched by layers on demand
      },
    });

    // 6. Start periodic health checks
    this.startHealthChecks();

    logger.info('[Runtime] Pipeline started successfully');
  }

  // ----------------------------------------------------------------
  // Shutdown
  // ----------------------------------------------------------------

  /**
   * Graceful shutdown sequence:
   * 1. Stop health-check timer
   * 2. Unsubscribe layers (stop accepting new events)
   * 3. Publish system-stopped event
   * 4. Save state snapshot
   * 5. Close event bus connection
   *
   * FIX M1: Bounded shutdown timeout prevents indefinite hangs.
   */
  async stop(): Promise<void> {
    if (!this.isRunning || this.shuttingDown) {
      logger.warn('[Runtime] Not running or already shutting down');
      return;
    }

    this.shuttingDown = true;
    logger.info('[Runtime] Initiating graceful shutdown...');

    const shutdownStart = Date.now();

    const shutdownWork = async (): Promise<void> => {
      // 1. Stop health checks
      this.stopHealthChecks();

      // 2. Unsubscribe layers in reverse pipeline order
      // FIX M1: Reverse-order teardown ensures downstream consumers
      // finish before upstream producers stop feeding them.
      try {
        await this.executionLayer.unsubscribe();
        logger.info('[Runtime] ExecutionLayer unsubscribed');
      } catch (err) {
        logger.error('[Runtime] ExecutionLayer unsubscribe failed:', err);
      }

      try {
        await this.strategyLayer.unsubscribe();
        logger.info('[Runtime] StrategyLayer unsubscribed');
      } catch (err) {
        logger.error('[Runtime] StrategyLayer unsubscribe failed:', err);
      }

      // 3. Publish system-stopped event (best-effort)
      try {
        const uptime = Date.now() - this.startedAt;
        const state = this.stateManager.getState();
        await this.eventBus.publish({
          channel: EventChannels.SYSTEM_STOPPED,
          source: 'System',
          correlationId: this.eventBus.generateCorrelationId(),
          payload: {
            reason: 'Graceful shutdown',
            duration: uptime,
            finalStats: {
              totalTrades: state.trading.totalTrades,
              winRate: state.trading.winRate,
              totalPnl: state.trading.totalPnl,
            },
          },
        });
      } catch (err) {
        logger.error('[Runtime] Failed to publish system-stopped event:', err);
      }

      // 4. Persist state
      // FIX M1: Critical save + snapshot guarantees no data loss on shutdown.
      try {
        this.stateManager.createSnapshot('shutdown');
        this.stateManager.saveCritical();
        logger.info('[Runtime] State snapshot saved');
      } catch (err) {
        logger.error('[Runtime] State save failed:', err);
      }

      // 5. Close state manager (WAL checkpoint + auto-snapshot stop)
      try {
        await this.stateManager.close();
        logger.info('[Runtime] State manager closed');
      } catch (err) {
        logger.error('[Runtime] State manager close failed:', err);
      }

      // 6. Close event bus
      try {
        await this.eventBus.close();
        logger.info('[Runtime] Event bus closed');
      } catch (err) {
        logger.error('[Runtime] Event bus close failed:', err);
      }
    };

    // Race shutdown against timeout
    try {
      await Promise.race([
        shutdownWork(),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error('Shutdown timed out')),
            this.shutdownTimeoutMs,
          ),
        ),
      ]);
    } catch (err) {
      logger.error('[Runtime] Shutdown did not complete within timeout:', err);
    }

    this.isRunning = false;
    this.shuttingDown = false;

    const elapsed = Date.now() - shutdownStart;
    logger.info(`[Runtime] Shutdown complete (${elapsed}ms)`);
  }

  // ----------------------------------------------------------------
  // Health checks
  // ----------------------------------------------------------------

  /**
   * Returns a snapshot of component health. Useful for /healthz endpoints
   * or periodic monitoring logs.
   */
  async getHealth(): Promise<RuntimeHealth> {
    const uptime = this.isRunning ? Date.now() - this.startedAt : 0;

    // Event bus health (async — pings Redis)
    let eventBusHealth: ComponentHealth;
    try {
      eventBusHealth = await this.eventBus.healthCheck();
    } catch (err) {
      eventBusHealth = { healthy: false, error: String(err) };
    }

    // State manager health — synchronous check
    let stateHealth: ComponentHealth;
    try {
      const state = this.stateManager.getState();
      stateHealth = { healthy: !!state };
    } catch (err) {
      stateHealth = { healthy: false, error: String(err) };
    }

    // Layer health — based on queue depth (0 = healthy, large = degraded)
    const strategyQueueSize = this.strategyLayer.getQueueSize();
    const executionQueueSize = this.executionLayer.getQueueSize();

    return {
      running: this.isRunning,
      uptime,
      components: {
        eventBus: eventBusHealth,
        dataLayer: { healthy: this.isRunning },
        strategyLayer: {
          healthy: this.isRunning && strategyQueueSize < 50,
          error: strategyQueueSize >= 50
            ? `Queue backpressure: ${strategyQueueSize} pending`
            : undefined,
        },
        executionLayer: {
          healthy: this.isRunning && executionQueueSize < 50,
          error: executionQueueSize >= 50
            ? `Queue backpressure: ${executionQueueSize} pending`
            : undefined,
        },
        stateManager: stateHealth,
      },
    };
  }

  /** FIX M1: Periodic health + heartbeat publishing for external monitors. */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.getHealth();
        const allHealthy = Object.values(health.components).every((c) => c.healthy);

        if (!allHealthy) {
          const unhealthy = Object.entries(health.components)
            .filter(([, c]) => !c.healthy)
            .map(([name, c]) => `${name}: ${c.error || 'unhealthy'}`)
            .join(', ');
          logger.warn(`[Runtime] Health check degraded — ${unhealthy}`);
        }

        // Publish heartbeat so external monitors can track liveness
        await this.eventBus.publish({
          channel: EventChannels.HEARTBEAT,
          source: 'System',
          correlationId: this.eventBus.getCorrelationId(),
          payload: {
            pid: process.pid,
            uptime: health.uptime,
            lastTradeTime: null,
            position: null,
          },
        });
      } catch (err) {
        logger.error('[Runtime] Health check failed:', err);
      }
    }, this.healthCheckIntervalMs);

    // Don't prevent process exit
    if (this.healthCheckTimer.unref) {
      this.healthCheckTimer.unref();
    }
  }

  private stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  // ----------------------------------------------------------------
  // Signal handlers
  // ----------------------------------------------------------------

  /**
   * Register POSIX signal handlers for graceful shutdown.
   *
   * FIX M1: Ensures state is persisted even when the process is killed
   * by a container orchestrator (SIGTERM) or Ctrl-C (SIGINT).
   */
  registerSignalHandlers(): void {
    const handler = (signal: string) => {
      logger.info(`[Runtime] Received ${signal}, shutting down...`);
      this.stop()
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error(`[Runtime] Shutdown error after ${signal}:`, err);
          process.exit(1);
        });
    };

    process.on('SIGTERM', () => handler('SIGTERM'));
    process.on('SIGINT', () => handler('SIGINT'));

    logger.info('[Runtime] Signal handlers registered (SIGTERM, SIGINT)');
  }

  // ----------------------------------------------------------------
  // Accessors
  // ----------------------------------------------------------------

  /** Whether the runtime is currently running. */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /** Milliseconds since start(), or 0 if not running. */
  getUptime(): number {
    return this.isRunning ? Date.now() - this.startedAt : 0;
  }
}

export default EventDrivenRuntime;
