/**
 * Bootstrap — Factory that wires up the EventDrivenRuntime with all
 * required layers, feeds, and adapters.
 *
 * This replaces the old `createTradingSystem()` which used the deprecated
 * TradingBotRuntime. Now the SAME event-driven pipeline (DataLayer →
 * StrategyLayer → ExecutionLayer) runs in live, paper, AND backtest.
 *
 * Usage:
 *   const runtime = await bootstrap('live');   // or 'paper'
 *   await runtime.start();
 */

import { getEventBus } from './events/RedisEventBus';
import { EventDrivenRuntime } from './runtime/EventDrivenRuntime';
import { EventDrivenDataLayer } from './layers/EventDrivenDataLayer';
import { EventDrivenStrategyLayer } from './layers/EventDrivenStrategyLayer';
import { EventDrivenExecutionLayer } from './layers/EventDrivenExecutionLayer';
import { createStateManager } from './state';
import { ExchangeManager } from './exchange';
import { SMCAnalyzer } from './smc';
import { MarketMicrostructure } from './marketMicro';
import { AIModule } from './ai/AIModule';
import { StrategyEngineModule } from './modules/strategyEngine';
import { LLMAnalysisModule } from './modules/llmAnalysis';
import { RiskManager } from './riskManager';
import NotificationManager from './notifier';
import { LiveExecutionAdapter } from './feeds/LiveExecutionAdapter';
import { PaperExecutionAdapter } from './feeds/PaperExecutionAdapter';
import type { TradingMode } from './feeds/types';
import { loadConfig } from './config/loader.js';
import logger from './logger';

export interface BootstrapOptions {
  mode: TradingMode;
}

/**
 * Create and wire up the full EventDrivenRuntime.
 *
 * Steps:
 *   1. Load unified config for the given mode
 *   2. Create shared singletons (exchange, event bus, state manager)
 *   3. Construct the three event-driven layers
 *   4. Create the appropriate ExecutionAdapter (live or paper)
 *   5. Assemble RuntimeDeps and return a ready-to-start Runtime
 */
export async function bootstrap(
  mode: TradingMode = 'live',
): Promise<EventDrivenRuntime> {
  const cfg = loadConfig(mode === 'backtest' ? 'backtest' : mode);

  logger.info(`[Bootstrap] Creating EventDrivenRuntime (mode=${mode})`);

  // 1. Shared infrastructure
  const eventBus = getEventBus();
  const exchange = new ExchangeManager();
  const stateManager = await createStateManager();

  // 2. Data layer dependencies
  const smcAnalyzer = new SMCAnalyzer();
  const microstructure = new MarketMicrostructure();
  const aiModule = new AIModule();

  const dataLayer = new EventDrivenDataLayer(
    exchange,
    smcAnalyzer,
    microstructure,
    aiModule,
  );

  // 3. Strategy layer dependencies
  const strategyEngine = new StrategyEngineModule('ocs');
  const llmEngine = new LLMAnalysisModule();

  const strategyLayer = new EventDrivenStrategyLayer(
    strategyEngine,
    llmEngine,
    'hybrid',
  );

  // 4. Execution layer dependencies
  const riskManager = new RiskManager();
  const notifier = new NotificationManager();

  const executionLayer = new EventDrivenExecutionLayer(
    exchange,
    riskManager,
    notifier,
    stateManager,
  );

  // 5. Execution adapter — live uses real exchange, paper uses simulated fills
  let executionAdapter;
  if (mode === 'paper') {
    executionAdapter = new PaperExecutionAdapter({
      initialBalance: cfg.position.maxSize * cfg.position.leverage * 100, // rough initial balance
    });
    logger.info('[Bootstrap] Using PaperExecutionAdapter');
  } else if (mode === 'live') {
    executionAdapter = new LiveExecutionAdapter(exchange);
    logger.info('[Bootstrap] Using LiveExecutionAdapter');
  }
  // backtest mode: no adapter needed here — backtest-engine handles execution

  // 6. Assemble runtime
  const runtime = new EventDrivenRuntime({
    eventBus,
    dataLayer,
    strategyLayer,
    executionLayer,
    stateManager,
    config: {
      mode,
      healthCheckIntervalMs: 30_000,
      shutdownTimeoutMs: 10_000,
    },
    executionAdapter,
  });

  // 7. Register POSIX signal handlers for graceful shutdown
  runtime.registerSignalHandlers();

  logger.info('[Bootstrap] EventDrivenRuntime assembled — call runtime.start() to begin');

  return runtime;
}

export default bootstrap;
