#!/usr/bin/env bun
/**
 * Quant Algo 主控制器
 *
 * 架构 (Phase 0 重构):
 *   EventDrivenRuntime 统一编排:
 *   DataLayer → StrategyLayer → ExecutionLayer
 *   全部通过 EventBus (Redis pub/sub) 通信
 *
 * 所有交易模式 (live / paper / backtest) 共享相同的
 * 信号生成 → 止盈止损 → 部分平仓 → SL 追踪 逻辑。
 *
 * 安全特性:
 * - 进程锁 🔒 防止多实例运行
 * - 优雅关机 (SIGTERM / SIGINT)
 */

// 加载环境变量
import { config } from 'dotenv';
config({ path: process.env.HOME + '/.openclaw/.env' });

import { bootstrap } from './src/bootstrap';
import { getProcessLock } from './src/utils/processLock';
import { loadConfig, printConfigSummary } from './src/config/tradingConfig.js';
import logger from './src/logger';
import type { TradingMode } from './src/feeds/types';

// ==================== Configuration ====================

// Determine mode from CLI args or env
function resolveMode(): TradingMode {
  const arg = process.argv[2]?.toLowerCase();
  if (arg === 'paper' || arg === 'live') return arg;
  const envMode = process.env.TRADING_MODE?.toLowerCase();
  if (envMode === 'paper' || envMode === 'live') return envMode;
  return 'paper'; // default to paper for safety
}

// ==================== Main ====================

async function main(): Promise<void> {
  // 🔒 获取进程锁
  const lock = getProcessLock();
  if (!lock.acquire()) {
    logger.error('❌ 无法启动：已有 quant-algo 实例在运行');
    process.exit(1);
  }

  const mode = resolveMode();
  const cfg = loadConfig(mode);

  logger.info('═══════════════════════════════════════════════════════════');
  logger.info(`🚀 Quant Algo 启动 (${mode.toUpperCase()} mode)`);
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info(`   Symbol:   ${cfg.symbol.binance}`);
  logger.info(`   Leverage: ${cfg.position.leverage}x`);
  logger.info(`   Max DD:   ${(cfg.risk.maxDrawdown * 100).toFixed(1)}%`);
  logger.info('');
  printConfigSummary(mode);

  // Bootstrap: create all layers + EventDrivenRuntime
  const runtime = await bootstrap(mode);

  // Start the event-driven pipeline
  // DataLayer fetches market data → publishes MARKET_DATA_GATHERED
  // StrategyLayer subscribes → generates signals → publishes STRATEGY_LAYER_COMPLETE
  // ExecutionLayer subscribes → executes orders with unified TP/SL partial close
  await runtime.start();

  logger.info('✅ EventDrivenRuntime started — pipeline is running');
  logger.info('   Press Ctrl+C for graceful shutdown');

  // Keep the process alive — the event bus drives the pipeline
  // Signal handlers (SIGTERM/SIGINT) are registered by bootstrap
  await new Promise<void>(() => {
    // never resolves — runtime runs until signal
  });
}

main().catch((e) => {
  logger.error('💥 启动失败:', e);
  process.exit(1);
});
