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
 *
 * DataFeed Abstraction:
 *   The runtime now accepts an optional TradingMode and injectable DataFeed /
 *   ExecutionAdapter. When mode = 'paper', PaperExecutionAdapter is used
 *   instead of the real exchange. When mode = 'backtest', a HistoricalDataFeed
 *   replays stored candles. The three layers (Data, Strategy, Execution) run
 *   identically regardless of mode — only the feed and execution adapter differ.
 *
 * FIX C1: The runtime now PASSES dataFeed and executionAdapter to the Data
 * and Execution layers via their setter methods during start(). Previously
 * these were stored but never forwarded, so backtest mode still fetched
 * live data and paper mode still sent real orders.
 */

import type { EventBus } from '../events/EventBus';
import { EventChannels } from '../events/types';
import type { MarketDataGatheredEvent, ExecutionLayerCompleteEvent } from '../events/types';
import type { EventDrivenDataLayer } from '../layers/EventDrivenDataLayer';
import type { EventDrivenStrategyLayer } from '../layers/EventDrivenStrategyLayer';
import type { EventDrivenExecutionLayer } from '../layers/EventDrivenExecutionLayer';
import type { StateManager } from '../state';
import type { PerformanceMetrics } from '../execution/sharedTypes';
import type { DataFeed, ExecutionAdapter, TradingMode } from '../feeds/types';
import { AlertManager } from '../monitoring/alertManager';
import type { Alert } from '../monitoring/alertManager';
import logger from '../logger';
import { KillSwitch } from '../safety/KillSwitch';
import { loadConfig } from '../config/loader.js';

// ==================== Configuration ====================

export interface RuntimeConfig {
  /** Health check interval in milliseconds (default: 30 000) */
  healthCheckIntervalMs?: number;

  /** Graceful shutdown timeout in milliseconds (default: 10 000) */
  shutdownTimeoutMs?: number;

  /** Trading mode: 'backtest' | 'paper' | 'live' (default: 'live') */
  mode?: TradingMode;

  /** Data polling interval in milliseconds (default: 60 000 = 1 minute) */
  dataPollIntervalMs?: number;
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
  mode: TradingMode;
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
  eventBus: EventBus;
  dataLayer: EventDrivenDataLayer;
  strategyLayer: EventDrivenStrategyLayer;
  executionLayer: EventDrivenExecutionLayer;
  stateManager: StateManager;
  config?: RuntimeConfig;

  /** Injectable data feed — when provided the runtime uses this instead of the
   *  data layer's own exchange-backed fetcher. Required for 'backtest' mode,
   *  optional for 'paper' (defaults to LiveDataFeed) and 'live'. */
  dataFeed?: DataFeed;

  /** Injectable execution adapter — when provided the runtime routes order
   *  execution through this adapter. Required for 'paper' mode (should be
   *  PaperExecutionAdapter), ignored in 'backtest' (uses backtest engine),
   *  optional in 'live' (defaults to real exchange). */
  executionAdapter?: ExecutionAdapter;
}

// ==================== Runtime ====================

/**
 * FIX M1: Central lifecycle manager for the event-driven trading pipeline.
 *
 * Layers are constructed externally (their dependencies are domain-specific)
 * and injected here. The runtime owns startup ordering, health monitoring,
 * signal-handler registration, and graceful shutdown.
 *
 * The runtime now supports three trading modes via the DataFeed abstraction:
 *   - 'live'     : Real exchange data + real order execution (default)
 *   - 'paper'    : Real exchange data + simulated order execution
 *   - 'backtest' : Historical data replay + simulated order execution
 *
 * FIX C1: The runtime now injects dataFeed into the DataLayer and
 * executionAdapter into the ExecutionLayer during start(). It also
 * subscribes to MARKET_DATA_GATHERED events to forward price updates
 * to PaperExecutionAdapter (so simulated fills use accurate prices).
 */
export class EventDrivenRuntime {
  // --- Components (injected) ---
  private eventBus: EventBus;
  private dataLayer: EventDrivenDataLayer;
  private strategyLayer: EventDrivenStrategyLayer;
  private executionLayer: EventDrivenExecutionLayer;
  private stateManager: StateManager;

  // --- DataFeed abstraction (injected, optional) ---
  private dataFeed: DataFeed | undefined;
  private executionAdapter: ExecutionAdapter | undefined;

  // --- AlertManager integration ---
  private alertManager = new AlertManager();
  private consecutiveLosses = 0;
  private lastTradeTimestamp = 0;
  private peakBalance = 0;
  private initialBalance = 0;

  // --- Config ---
  private readonly healthCheckIntervalMs: number;
  private readonly dataPollIntervalMs: number;
  private readonly shutdownTimeoutMs: number;
  private readonly mode: TradingMode;

  // --- Lifecycle state ---
  private isRunning = false;
  private startedAt = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  private dataPollTimer?: NodeJS.Timeout;
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
    this.dataPollIntervalMs = deps.config?.dataPollIntervalMs ?? 60_000;
    this.shutdownTimeoutMs = deps.config?.shutdownTimeoutMs ?? 10_000;
    this.mode = deps.config?.mode ?? 'live';

    // Store injectable feeds / adapters
    this.dataFeed = deps.dataFeed;
    this.executionAdapter = deps.executionAdapter;
  }

  // ----------------------------------------------------------------
  // Startup
  // ----------------------------------------------------------------

  /**
   * Start all components in the correct order:
   * 1. Event bus  — must be ready before any layer can publish/subscribe
   * 2. State manager is already initialised by its factory
   * 3. DataFeed + ExecutionAdapter initialisation (if injected)
   * 4. FIX C1: Inject dataFeed / executionAdapter into layers
   * 5. FIX C1: Subscribe to MARKET_DATA_GATHERED for price forwarding
   * 6. Layers — subscriptions are wired in their constructors
   * 7. System-started event + health-check timer
   *
   * FIX M1: Deterministic startup order prevents race conditions.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[Runtime] Already running — ignoring duplicate start()');
      return;
    }

    // Log mode prominently
    const modeLabel = this.mode.toUpperCase();
    logger.info('========================================');
    logger.info(`[Runtime] Starting in ${modeLabel} TRADING mode`);
    logger.info('========================================');

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

    // 3. Initialize DataFeed and ExecutionAdapter if provided
    if (this.dataFeed) {
      await this.dataFeed.initialize();
      logger.info(`[Runtime] DataFeed initialized (mode=${this.dataFeed.mode})`);
    }

    if (this.executionAdapter) {
      logger.info(`[Runtime] ExecutionAdapter injected (mode=${this.executionAdapter.mode})`);
    }

    if (this.mode === 'paper') {
      if (!this.executionAdapter) {
        logger.warn(
          '[Runtime] Paper mode without ExecutionAdapter — orders will still hit the real exchange! ' +
          'Inject a PaperExecutionAdapter for simulated execution.',
        );
      } else {
        logger.info('[Runtime] Paper mode: orders routed through PaperExecutionAdapter');
      }
    }

    if (this.mode === 'backtest') {
      if (!this.dataFeed) {
        throw new Error(
          '[Runtime] Backtest mode requires a DataFeed (HistoricalDataFeed). None was injected.',
        );
      }
      logger.info('[Runtime] Backtest mode: replaying historical data');
    }

    // 4. FIX C1: Inject dataFeed into DataLayer and executionAdapter into
    //    ExecutionLayer. This is the CRITICAL step that was missing —
    //    without it the layers ignore the injected dependencies and fall
    //    back to their own hardcoded exchange / fetcher instances.
    if (this.dataFeed) {
      this.dataLayer.setDataFeed(this.dataFeed);
      logger.info('[Runtime] DataFeed injected into DataLayer');
    }

    if (this.executionAdapter) {
      this.executionLayer.setExecutionAdapter(this.executionAdapter);
      logger.info('[Runtime] ExecutionAdapter injected into ExecutionLayer');
    }

    // 5. FIX C1: Subscribe to MARKET_DATA_GATHERED events so we can
    //    forward price updates to the PaperExecutionAdapter. This keeps
    //    the adapter's currentMarketPrice in sync for accurate simulated
    //    fills, slippage, and unrealized PnL calculations.
    if (this.executionAdapter && 'updatePrice' in this.executionAdapter) {
      this.eventBus.subscribe<MarketDataGatheredEvent>(
        EventChannels.MARKET_DATA_GATHERED,
        (event: MarketDataGatheredEvent) => {
          const price = event.payload.marketData.currentPrice;
          if (price > 0 && this.executionAdapter && 'updatePrice' in this.executionAdapter) {
            this.executionAdapter.updatePrice!(price);
          }
        },
      );
      logger.info('[Runtime] Subscribed to MARKET_DATA_GATHERED for price forwarding to ExecutionAdapter');
    }

    // 6. Layers are already subscribed (they wire subscriptions in their
    //    constructors via getEventBus()). Log confirmation.
    // FIX M1: Layers self-subscribe; runtime only needs to verify readiness.
    logger.info('[Runtime] DataLayer ready');
    logger.info('[Runtime] StrategyLayer ready (subscribed to DATA_LAYER_COMPLETE)');
    logger.info('[Runtime] ExecutionLayer ready (subscribed to STRATEGY_LAYER_COMPLETE)');

    // 7. AlertManager: register default monitoring rules and subscribe to execution events
    this.alertManager.registerDefaultRules();
    this.subscribeToExecutionEvents();
    logger.info('[Runtime] AlertManager initialized with default rules');

    // 8. Mark running and record start time
    this.isRunning = true;
    this.startedAt = Date.now();

    // 9. Publish system-started event
    await this.eventBus.publish({
      channel: EventChannels.SYSTEM_STARTED,
      source: 'System',
      correlationId: this.eventBus.generateCorrelationId(),
      payload: {
        config: {
          symbol: loadConfig('live').symbol.binance,
          timeframe: loadConfig('live').timeframe,
          leverage: loadConfig('live').position.leverage,
        },
        balance: 0, // actual balance fetched by layers on demand
        // mode passed via startConfig

      },
    });

    // 10. Start periodic health checks (includes periodic alert evaluation)
    // 10.5. Start data polling loop — triggers DataLayer → StrategyLayer → ExecutionLayer
    this.startDataPolling();
    this.startHealthChecks();

    logger.info(`[Runtime] Pipeline started successfully in ${modeLabel} mode`);
  }

  // ----------------------------------------------------------------
  // AlertManager: Execution event tracking
  // ----------------------------------------------------------------

  /**
   * Subscribe to EXECUTION_LAYER_COMPLETE events to track trading metrics
   * for alert evaluation (consecutive losses, balance drawdown, trade timing).
   */
  private subscribeToExecutionEvents(): void {
    this.eventBus.subscribe<ExecutionLayerCompleteEvent>(
      EventChannels.EXECUTION_LAYER_COMPLETE,
      (event: ExecutionLayerCompleteEvent) => {
        try {
          const { result } = event.payload;
          this.lastTradeTimestamp = Date.now();

          // Track consecutive losses
          if (result.pnl !== undefined && result.pnl < 0) {
            this.consecutiveLosses++;
          } else if (result.pnl !== undefined && result.pnl > 0) {
            this.consecutiveLosses = 0;
          }

          // Update balance tracking from state manager
          try {
            const state = this.stateManager.getState();
            const currentBalance = state.trading?.balance ?? 0;
            if (this.initialBalance === 0 && currentBalance > 0) {
              this.initialBalance = currentBalance;
              this.peakBalance = currentBalance;
            }
            if (currentBalance > this.peakBalance) {
              this.peakBalance = currentBalance;
            }
          } catch {
            // State manager may not expose balance directly; metrics will use fallback
          }

          // Evaluate alerts immediately after each execution event
          const metrics = this.collectMetrics();
          const alerts = this.alertManager.evaluate(metrics);
          for (const alert of alerts) {
            logger.warn(
              `[Runtime][Alert] ${alert.severity.toUpperCase()}: ${alert.message} (rule: ${alert.rule})`,
            );
          }
        } catch (err) {
          logger.error('[Runtime] Error processing execution event for alerts:', err);
        }
      },
    );
    logger.info('[Runtime] Subscribed to EXECUTION_LAYER_COMPLETE for alert monitoring');
  }

  /**
   * Collect current system metrics for alert evaluation.
   * Returns a flat metrics map consumed by AlertManager.evaluate().
   */
  private collectMetrics(): Record<string, number> {
    let currentBalance = 0;
    let killSwitchActive = 0;

    try {
      const state = this.stateManager.getState();
      currentBalance = state.trading?.balance ?? 0;
      // Check for optional killSwitch property that may exist on extended state
      const stateRecord: Record<string, unknown> = { ...state };
      killSwitchActive = stateRecord['killSwitch'] != null ? 1 : 0;
    } catch {
      // Fallback: metrics will show zero balance
    }

    const now = Date.now();
    const drawdownPct =
      this.peakBalance > 0
        ? ((this.peakBalance - currentBalance) / this.peakBalance) * 100
        : 0;

    const lastTradeAgeHours =
      this.lastTradeTimestamp > 0
        ? (now - this.lastTradeTimestamp) / (1000 * 60 * 60)
        : 0;

    const uptimeSeconds = this.isRunning ? (now - this.startedAt) / 1000 : 0;

    return {
      drawdown_pct: drawdownPct,
      current_balance: currentBalance,
      initial_balance: this.initialBalance,
      consecutive_losses: this.consecutiveLosses,
      position_hold_hours: 0, // would need position tracking from ExecutionLayer
      last_trade_age_hours: lastTradeAgeHours,
      kill_switch_active: killSwitchActive,
      latency_seconds: 0, // would need per-cycle timing instrumentation
      uptime_seconds: uptimeSeconds,
    };
  }

  // ----------------------------------------------------------------
  // Shutdown
  // ----------------------------------------------------------------

  /**
   * Graceful shutdown sequence:
   * 1. Stop health-check timer
   * 2. Close DataFeed and ExecutionAdapter
   * 3. Unsubscribe layers (stop accepting new events)
   * 4. Publish system-stopped event
   * 5. Save state snapshot
   * 6. Close event bus connection
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
      this.stopDataPolling();

      // 2. Close DataFeed and ExecutionAdapter
      if (this.dataFeed) {
        try {
          await this.dataFeed.close();
          logger.info('[Runtime] DataFeed closed');
        } catch (err) {
          logger.error('[Runtime] DataFeed close failed:', err);
        }
      }

      if (this.executionAdapter) {
        try {
          await this.executionAdapter.close();
          logger.info('[Runtime] ExecutionAdapter closed');
        } catch (err) {
          logger.error('[Runtime] ExecutionAdapter close failed:', err);
        }
      }

      // 3. Unsubscribe layers in reverse pipeline order
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

      // 4. Publish system-stopped event (best-effort)
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
              totalTrades: state.trading.tradeCount,
              winRate: 0 /* winRate not tracked in state */,
              totalPnl: state.trading.totalPnL,
            },
          },
        });
      } catch (err) {
        logger.error('[Runtime] Failed to publish system-stopped event:', err);
      }

      // 5. Persist state
      // FIX M1: Critical save + snapshot guarantees no data loss on shutdown.
      try {
        this.stateManager.createSnapshot('shutdown');
        this.stateManager.saveCritical();
        logger.info('[Runtime] State snapshot saved');
      } catch (err) {
        logger.error('[Runtime] State save failed:', err);
      }

      // 6. Close state manager (WAL checkpoint + auto-snapshot stop)
      try {
        await this.stateManager.close();
        logger.info('[Runtime] State manager closed');
      } catch (err) {
        logger.error('[Runtime] State manager close failed:', err);
      }

      // 7. Close event bus
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
      mode: this.mode,
      components: {
        eventBus: eventBusHealth,
        dataLayer: { healthy: this.isRunning },
        strategyLayer: {
          healthy: this.isRunning && strategyQueueSize < 50,
          error:
            strategyQueueSize >= 50
              ? `Queue backpressure: ${strategyQueueSize} pending`
              : undefined,
        },
        executionLayer: {
          healthy: this.isRunning && executionQueueSize < 50,
          error:
            executionQueueSize >= 50
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
        const allHealthy = Object.values(health.components).every(
          (c) => c.healthy,
        );

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

        // Periodic alert evaluation (catch degraded states even without trade events)
        try {
          const metrics = this.collectMetrics();
          const alerts = this.alertManager.evaluate(metrics);
          for (const alert of alerts) {
            logger.warn(
              `[Runtime][Alert] ${alert.severity.toUpperCase()}: ${alert.message} (rule: ${alert.rule})`,
            );
          }
        } catch (alertErr) {
          logger.error('[Runtime] Periodic alert evaluation failed:', alertErr);
        }
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
  // Data polling — triggers the DataLayer → StrategyLayer → ExecutionLayer pipeline
  // ----------------------------------------------------------------

  /**
   * Start a periodic timer that calls dataLayer.gatherDataAndEmit().
   * This is the heartbeat of the event-driven pipeline: each tick
   * produces a DATA_LAYER_COMPLETE event which the StrategyLayer
   * picks up, processes, and publishes STRATEGY_LAYER_COMPLETE,
   * which the ExecutionLayer then handles.
   *
   * In backtest mode the DataFeed drives iteration externally, so
   * this polling loop is only active in live and paper modes.
   */
  private startDataPolling(): void {
    if (this.mode === 'backtest') {
      logger.info('[Runtime] Backtest mode — data polling disabled (DataFeed drives iteration)');
      return;
    }

    // Fire immediately on start, then repeat at interval
    const poll = async (): Promise<void> => {
      if (!this.isRunning || this.shuttingDown) return;

      // KillSwitch check — block trading when emergency stop is active
      try {
        const ks = KillSwitch.getInstance();
        const check = await ks.checkFull();
        if (check.blocked) {
          logger.warn(`[Runtime] KillSwitch ACTIVE (${check.source}): ${check.reason} — skipping cycle`);
          return;
        }
      } catch (ksErr) {
        // KillSwitch failure should NOT block trading — log and continue
        logger.warn('[Runtime] KillSwitch check failed, proceeding with cycle:', ksErr);
      }

      try {
        await this.dataLayer.gatherDataAndEmit();
      } catch (err) {
        logger.error('[Runtime] Data polling cycle failed:', err);
      }
    };

    // First tick immediately
    poll();

    this.dataPollTimer = setInterval(() => {
      poll();
    }, this.dataPollIntervalMs);

    // Don't prevent process exit
    if (this.dataPollTimer.unref) {
      this.dataPollTimer.unref();
    }

    logger.info(`[Runtime] Data polling started (interval=${this.dataPollIntervalMs}ms)`);
  }

  private stopDataPolling(): void {
    if (this.dataPollTimer) {
      clearInterval(this.dataPollTimer);
      this.dataPollTimer = undefined;
      logger.info('[Runtime] Data polling stopped');
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

  /** The trading mode this runtime was started with. */
  getMode(): TradingMode {
    return this.mode;
  }

  /** The injected DataFeed, or undefined if none was provided. */
  getDataFeed(): DataFeed | undefined {
    return this.dataFeed;
  }

  /** The injected ExecutionAdapter, or undefined if none was provided. */
  getExecutionAdapter(): ExecutionAdapter | undefined {
    return this.executionAdapter;
  }

  /** Access the AlertManager instance for external alert rule registration. */
  getAlertManager(): AlertManager {
    return this.alertManager;
  }

  /** Retrieve recent alerts, optionally filtered by a timestamp threshold. */
  getRecentAlerts(since?: number): Alert[] {
    return this.alertManager.getRecentAlerts(since);
  }

  /** Access the KillSwitch singleton for emergency stop control. */
  getKillSwitch(): KillSwitch {
    return KillSwitch.getInstance();
  }

  /**
   * Aggregate performance metrics from StateManager.
   * Provides a PerformanceMetrics-compatible snapshot for dashboard/feedbackLoop.
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const state = this.stateManager.getState();
    const t = state.trading;
    const initialBalance = t.balance - t.totalPnL;
    const roi = initialBalance > 0 ? (t.totalPnL / initialBalance) * 100 : 0;
    return {
      roi,
      dailyReturns: [],
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
      profitFactor: 0,
      tradeCount: t.tradeCount,
      avgTradeDuration: 0,
      totalPnl: t.totalPnL,
      winningTrades: 0,
      losingTrades: 0,
    };
  }
}

export default EventDrivenRuntime;
