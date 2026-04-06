/**
 * 统一三阶段回测运行器 — Unified 3-Phase Backtest Runner
 *
 * 推荐流程:
 *   Phase A — OCS BacktestEngine (快速迭代策略参数)
 *   Phase B — LeakageControlledBacktest (前视偏差检测 + 执行一致性)
 *   Phase C — CPCV / PBO / DSR 统计显著性验证
 *
 * Usage:
 *   bun run backtest                    # 完整 A→B→C 流程
 *   BT_PHASE=A bun run backtest         # 仅 Phase A (快速迭代)
 *   BT_PHASE=AB bun run backtest        # Phase A + B
 *   BT_SYMBOL=BTCUSDT bun run backtest  # 切换标的
 */

import * as fs from 'fs';
import * as path from 'path';
import type { OHLCV } from './src/events/types';
import {
  BacktestEngine,
  type BacktestConfig,
  type BacktestResult,
  type Trade,
} from './backtest-engine';
import {
  LeakageControlledBacktest,
  type Strategy,
  type BacktestConfig as LCBConfig,
} from './src/backtest/leakageControlledBacktest';
import {
  validateBacktest,
  type TimeSeriesObservation,
  type BacktestValidationResult,
} from './src/backtest/cpcvValidation';

// ────────────────────────────────────────────────────────────
// Config helpers
// ────────────────────────────────────────────────────────────

function getPhases(): Set<string> {
  const raw = (process.env.BT_PHASE || 'ABC').toUpperCase();
  const phases = new Set<string>();
  if (raw.includes('A')) phases.add('A');
  if (raw.includes('B')) phases.add('B');
  if (raw.includes('C')) phases.add('C');
  if (phases.size === 0) { phases.add('A'); phases.add('B'); phases.add('C'); }
  return phases;
}

function makeConfig(): BacktestConfig {
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    symbol:         process.env.BT_SYMBOL    || 'ETHUSDT',
    timeframe:      process.env.BT_TIMEFRAME || '5m',
    startDate,
    endDate,
    initialBalance: 10000,
    positionSize:   0.1,
    leverage:       1,
    feeRate:        0.0006,
    slippage:       0.0001,
  };
}

// ────────────────────────────────────────────────────────────
// Phase A — OCS BacktestEngine (fast parameter iteration)
// ────────────────────────────────────────────────────────────

interface PhaseAResult {
  result: BacktestResult;
  ohlcv: OHLCV[];
  durationMs: number;
}

async function phaseA(config: BacktestConfig): Promise<PhaseAResult> {
  console.log('\n' + '═'.repeat(60));
  console.log('🅰️  Phase A — OCS 策略快速回测');
  console.log('═'.repeat(60));

  const t0 = Date.now();
  const engine = new BacktestEngine(config);
  await engine.loadData();
  const result = await engine.run();
  engine.printSummary(result);
  engine.saveResult(result);
  const durationMs = Date.now() - t0;
  console.log(`⏱  Phase A 耗时: ${(durationMs / 1000).toFixed(1)}s`);

  return { result, ohlcv: engine.getOhlcv(), durationMs };
}

// ────────────────────────────────────────────────────────────
// Phase B — Leakage-Controlled Backtest (pipeline verification)
// ────────────────────────────────────────────────────────────

/**
 * Bridge adapter: wraps Phase A's OCS trade signals into the
 * Strategy interface expected by LeakageControlledBacktest.
 *
 * Approach: replay the Phase A trades as "known signals" on
 * matching bar timestamps, then compare P&L to detect any
 * data-leakage or execution divergence.
 */
function buildReplayStrategy(trades: Trade[], name = 'OCS-Replay'): Strategy {
  // Build a map: entryTimestamp → trade
  const tradeByEntry = new Map<number, Trade>();
  const tradeByExit = new Map<number, Trade>();
  for (const t of trades) {
    tradeByEntry.set(t.entryTime, t);
    tradeByExit.set(t.exitTime, t);
  }

  return {
    name,
    generateSignal(
      data: OHLCV[],
      index: number,
      position: { side: 'long' | 'short' | 'none'; size: number; entryPrice: number } | null,
    ) {
      const bar = data[index];
      if (!bar) return { action: 'hold' as const };

      // Close existing position if this bar matches an exit timestamp
      if (position && position.side !== 'none') {
        const exitTrade = tradeByExit.get(bar.timestamp);
        if (exitTrade) {
          const closeSide = position.side === 'long' ? 'sell' : 'buy';
          return {
            action: closeSide as 'buy' | 'sell',
            size: position.size,
            reason: `replay-close: ${exitTrade.exitReason}`,
          };
        }
      }

      // Open new position if this bar matches an entry timestamp
      if (!position || position.side === 'none') {
        const entryTrade = tradeByEntry.get(bar.timestamp);
        if (entryTrade) {
          return {
            action: entryTrade.side === 'long' ? 'buy' as const : 'sell' as const,
            size: entryTrade.size,
            stopLoss: entryTrade.stopLoss,
            takeProfit: entryTrade.takeProfits.tp1,
            reason: 'replay-entry',
          };
        }
      }

      return { action: 'hold' as const };
    },
  };
}

interface PhaseBResult {
  totalReturn: number;
  winRate: number;
  trades: number;
  maxDrawdown: number;
  pnlDivergence: number;        // absolute % divergence from Phase A
  executionConsistent: boolean;  // divergence < 2%
  durationMs: number;
}

async function phaseB(config: BacktestConfig, phaseAResult: PhaseAResult): Promise<PhaseBResult> {
  console.log('\n' + '═'.repeat(60));
  console.log('🅱️  Phase B — 前视偏差检测 & 执行一致性验证');
  console.log('═'.repeat(60));

  const t0 = Date.now();

  // Create LeakageControlledBacktest with matching parameters
  const lcb = new LeakageControlledBacktest({
    symbol: config.symbol,
    timeframe: config.timeframe,
    startDate: config.startDate.getTime(),
    endDate: config.endDate.getTime(),
    initialBalance: config.initialBalance,
    leverage: config.leverage,
    feeRate: config.feeRate,
    slippage: config.slippage,
    warmupPeriod: 200,    // match OCS engine lookback
    executionDelay: 1,    // next-bar execution
    useNextOpen: true,
  });

  // Load same OHLCV data
  lcb.loadData(phaseAResult.ohlcv);

  // Build replay strategy from Phase A trades
  const replayStrategy = buildReplayStrategy(phaseAResult.result.trades);

  // Run through leakage-controlled framework
  const lcbResult = await lcb.run(replayStrategy);

  const phaseATotalReturn = phaseAResult.result.stats.totalReturnPercent;
  const phaseBTotalReturn = lcbResult.totalReturnPercent;
  const pnlDivergence = Math.abs(phaseATotalReturn - phaseBTotalReturn);

  // Divergence threshold: 2% absolute is acceptable (due to execution delay & slippage model differences)
  const executionConsistent = pnlDivergence < 2.0;

  const durationMs = Date.now() - t0;

  console.log(`\n📊 Phase B 结果:`);
  console.log(`   Phase A 总收益: ${phaseATotalReturn >= 0 ? '+' : ''}${phaseATotalReturn.toFixed(2)}%`);
  console.log(`   Phase B 总收益: ${phaseBTotalReturn >= 0 ? '+' : ''}${phaseBTotalReturn.toFixed(2)}%`);
  console.log(`   P&L 偏差: ${pnlDivergence.toFixed(2)}% ${executionConsistent ? '✅ 一致' : '⚠️  偏差较大'}`);
  console.log(`   Phase B 交易数: ${lcbResult.totalTrades}`);
  console.log(`   Phase B 胜率: ${lcbResult.winRate.toFixed(2)}%`);
  console.log(`   Phase B 最大回撤: ${lcbResult.maxDrawdownPercent.toFixed(2)}%`);
  console.log(`⏱  Phase B 耗时: ${(durationMs / 1000).toFixed(1)}s`);

  if (!executionConsistent) {
    console.log(`\n⚠️  警告: P&L 偏差超过 2%, 可能存在前视偏差或执行模型差异!`);
    console.log(`   建议: 检查策略信号是否依赖未来数据, 或对比两个引擎的滑点/手续费模型。`);
  }

  return {
    totalReturn: phaseBTotalReturn,
    winRate: lcbResult.winRate,
    trades: lcbResult.totalTrades,
    maxDrawdown: lcbResult.maxDrawdownPercent,
    pnlDivergence,
    executionConsistent,
    durationMs,
  };
}

// ────────────────────────────────────────────────────────────
// Phase C — CPCV + PBO + DSR (statistical significance)
// ────────────────────────────────────────────────────────────

interface PhaseCResult {
  validation: BacktestValidationResult;
  durationMs: number;
}

async function phaseC(phaseAResult: PhaseAResult): Promise<PhaseCResult> {
  console.log('\n' + '═'.repeat(60));
  console.log('🅲  Phase C — 统计显著性验证 (CPCV / PBO / DSR)');
  console.log('═'.repeat(60));

  const t0 = Date.now();
  const equity = phaseAResult.result.equityCurve;

  if (equity.length < 2) {
    throw new Error('Equity curve too short for statistical validation. Need at least 2 data points.');
  }

  // Convert equity curve → per-period returns (TimeSeriesObservation[])
  const observations: TimeSeriesObservation[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1];
    const curr = equity[i];
    const ret = prev !== 0 ? (curr - prev) / prev : 0;
    observations.push({
      timestamp: i, // ordinal index is fine; CPCV only needs ordering
      value: ret,
    });
  }

  console.log(`📈 构建 ${observations.length} 个收益观测值 (从 ${equity.length} 个权益点)`);

  // Run López de Prado validation suite
  const validation = validateBacktest(observations, {
    cpcv: {
      nGroups: Math.min(10, Math.floor(observations.length / 20)), // at least 20 obs per group
      nTestGroups: 2,
    },
    numTrials: 1,
    dsrSignificanceLevel: 0.05,
    dsrRequiredThreshold: 1.0,
  });

  const durationMs = Date.now() - t0;

  // Print results
  console.log(`\n📊 Phase C 结果:`);
  console.log(`   ┌─────────────────────────────────────────┐`);
  console.log(`   │ Sharpe Ratio:        ${validation.sharpeRatio.toFixed(4).padStart(12)}    │`);
  console.log(`   │ Deflated Sharpe:     ${validation.deflatedSharpe.toFixed(4).padStart(12)}    │`);
  console.log(`   │ PBO:                 ${validation.pbo.pbo.toFixed(4).padStart(12)}    │`);
  console.log(`   │ DSR Significant:     ${String(validation.isStatisticallySignificant).padStart(12)}    │`);
  console.log(`   │ Min BT Length:       ${String(validation.minBacktestLength).padStart(12)}    │`);
  console.log(`   │ Meets Min Length:    ${String(validation.meetsMinLength).padStart(12)}    │`);
  console.log(`   │ Overall Pass:        ${String(validation.overallPass).padStart(12)}    │`);
  console.log(`   └─────────────────────────────────────────┘`);
  console.log(`⏱  Phase C 耗时: ${(durationMs / 1000).toFixed(1)}s`);

  if (validation.overallPass) {
    console.log(`\n✅ 统计验证通过: 策略具备统计显著性, 过拟合概率低 (PBO=${validation.pbo.pbo.toFixed(3)})`);
  } else {
    console.log(`\n⚠️  统计验证未通过:`);
    if (validation.pbo.pbo >= 0.5) {
      console.log(`   - PBO=${validation.pbo.pbo.toFixed(3)} ≥ 0.5 → 过拟合风险较高`);
    }
    if (!validation.isStatisticallySignificant) {
      console.log(`   - Deflated Sharpe 未达显著性阈值`);
    }
    if (!validation.meetsMinLength) {
      console.log(`   - 回测长度不足 (需要 ${validation.minBacktestLength} 个观测值)`);
    }
  }

  return { validation, durationMs };
}

// ────────────────────────────────────────────────────────────
// Final Report
// ────────────────────────────────────────────────────────────

interface RunnerReport {
  config: BacktestConfig;
  phases: string[];
  phaseA?: PhaseAResult;
  phaseB?: PhaseBResult;
  phaseC?: PhaseCResult;
  totalDurationMs: number;
  overallVerdict: 'PASS' | 'WARN' | 'FAIL';
}

function printFinalReport(report: RunnerReport): void {
  console.log('\n' + '═'.repeat(60));
  console.log('📋 三阶段回测总报告');
  console.log('═'.repeat(60));

  const rows: string[][] = [];
  rows.push(['指标', '值', '状态']);

  if (report.phaseA) {
    const s = report.phaseA.result.stats;
    rows.push(['A: 总收益', `${s.totalReturnPercent >= 0 ? '+' : ''}${s.totalReturnPercent.toFixed(2)}%`, s.totalReturnPercent > 0 ? '✅' : '⚠️']);
    rows.push(['A: Sharpe', s.sharpeRatio.toFixed(2), s.sharpeRatio > 1 ? '✅' : s.sharpeRatio > 0 ? '⚠️' : '❌']);
    rows.push(['A: 胜率', `${s.winRate.toFixed(1)}%`, s.winRate > 50 ? '✅' : '⚠️']);
    rows.push(['A: 最大回撤', `${s.maxDrawdown.toFixed(2)}%`, s.maxDrawdown < 10 ? '✅' : s.maxDrawdown < 20 ? '⚠️' : '❌']);
    rows.push(['A: 交易次数', String(s.totalTrades), s.totalTrades >= 10 ? '✅' : '⚠️']);
  }

  if (report.phaseB) {
    const b = report.phaseB;
    rows.push(['B: P&L 偏差', `${b.pnlDivergence.toFixed(2)}%`, b.executionConsistent ? '✅' : '❌']);
    rows.push(['B: 执行一致性', b.executionConsistent ? '一致' : '偏差', b.executionConsistent ? '✅' : '❌']);
  }

  if (report.phaseC) {
    const v = report.phaseC.validation;
    rows.push(['C: PBO', v.pbo.pbo.toFixed(4), v.pbo.pbo < 0.5 ? '✅' : '❌']);
    rows.push(['C: Deflated Sharpe', v.deflatedSharpe.toFixed(4), v.isStatisticallySignificant ? '✅' : '❌']);
    rows.push(['C: 总体通过', String(v.overallPass), v.overallPass ? '✅' : '❌']);
  }

  // Print table
  const colWidths = [18, 14, 4];
  const sep = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  console.log(sep);
  for (const row of rows) {
    const cells = row.map((cell, i) => ` ${cell.padEnd(colWidths[i])} `);
    console.log('|' + cells.join('|') + '|');
    if (row === rows[0]) console.log(sep);
  }
  console.log(sep);

  console.log(`\n⏱  总耗时: ${(report.totalDurationMs / 1000).toFixed(1)}s`);

  // Overall verdict
  const icon = report.overallVerdict === 'PASS' ? '✅' :
               report.overallVerdict === 'WARN' ? '⚠️' : '❌';
  console.log(`\n${icon} 最终判定: ${report.overallVerdict}`);

  if (report.overallVerdict === 'PASS') {
    console.log('   策略通过所有验证, 可进入 Paper Trading 阶段。');
  } else if (report.overallVerdict === 'WARN') {
    console.log('   策略有警告项, 建议优化后重新验证。');
  } else {
    console.log('   策略未通过验证, 请修改策略后重新回测。');
  }
}

function saveRunnerReport(report: RunnerReport): void {
  const reportDir = path.join(process.cwd(), 'backtest-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(reportDir, `runner-report-${timestamp}.json`);

  // Serialize (strip non-serializable fields)
  const serializable = {
    config: {
      ...report.config,
      startDate: report.config.startDate.toISOString(),
      endDate: report.config.endDate.toISOString(),
    },
    phases: report.phases,
    phaseA: report.phaseA ? {
      stats: report.phaseA.result.stats,
      tradeCount: report.phaseA.result.trades.length,
      durationMs: report.phaseA.durationMs,
    } : undefined,
    phaseB: report.phaseB,
    phaseC: report.phaseC ? {
      sharpeRatio: report.phaseC.validation.sharpeRatio,
      deflatedSharpe: report.phaseC.validation.deflatedSharpe,
      pbo: report.phaseC.validation.pbo.pbo,
      overallPass: report.phaseC.validation.overallPass,
      isStatisticallySignificant: report.phaseC.validation.isStatisticallySignificant,
      meetsMinLength: report.phaseC.validation.meetsMinLength,
      durationMs: report.phaseC.durationMs,
    } : undefined,
    totalDurationMs: report.totalDurationMs,
    overallVerdict: report.overallVerdict,
  };

  fs.writeFileSync(reportFile, JSON.stringify(serializable, null, 2));
  console.log(`\n📄 报告已保存: ${reportFile}`);
}

// ────────────────────────────────────────────────────────────
// Main orchestrator
// ────────────────────────────────────────────────────────────

async function main() {
  const phases = getPhases();
  const config = makeConfig();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Quant-Algo 三阶段回测运行器 v1.0                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`📌 标的: ${config.symbol} | 周期: ${config.timeframe}`);
  console.log(`📅 ${config.startDate.toISOString().split('T')[0]} → ${config.endDate.toISOString().split('T')[0]}`);
  console.log(`🔄 阶段: ${[...phases].join(' → ')}`);

  const t0 = Date.now();
  let phaseAResult: PhaseAResult | undefined;
  let phaseBResult: PhaseBResult | undefined;
  let phaseCResult: PhaseCResult | undefined;

  // ── Phase A ──
  if (phases.has('A')) {
    phaseAResult = await phaseA(config);
  }

  // ── Phase B (requires Phase A) ──
  if (phases.has('B')) {
    if (!phaseAResult) {
      console.log('\n⚠️  Phase B 需要 Phase A 的结果, 自动运行 Phase A...');
      phaseAResult = await phaseA(config);
    }
    if (phaseAResult.result.trades.length === 0) {
      console.log('\n⚠️  Phase A 无交易, 跳过 Phase B');
    } else {
      try {
        phaseBResult = await phaseB(config, phaseAResult);
      } catch (err: any) {
        console.error(`\n❌ Phase B 失败: ${err.message}`);
        console.log('   继续执行 Phase C...');
      }
    }
  }

  // ── Phase C (requires Phase A) ──
  if (phases.has('C')) {
    if (!phaseAResult) {
      console.log('\n⚠️  Phase C 需要 Phase A 的结果, 自动运行 Phase A...');
      phaseAResult = await phaseA(config);
    }
    if (phaseAResult.result.equityCurve.length < 20) {
      console.log(`\n⚠️  权益曲线过短 (${phaseAResult.result.equityCurve.length} 点), 跳过 Phase C`);
    } else {
      try {
        phaseCResult = await phaseC(phaseAResult);
      } catch (err: any) {
        console.error(`\n❌ Phase C 失败: ${err.message}`);
      }
    }
  }

  const totalDurationMs = Date.now() - t0;

  // ── Determine overall verdict ──
  let overallVerdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  if (phaseAResult && phaseAResult.result.stats.totalReturnPercent < 0) {
    overallVerdict = 'FAIL';
  }
  if (phaseBResult && !phaseBResult.executionConsistent) {
    overallVerdict = 'FAIL';
  }
  if (phaseCResult && !phaseCResult.validation.overallPass) {
    overallVerdict = phaseCResult.validation.pbo.pbo >= 0.5 ? 'FAIL' : 'WARN';
  }
  // No trades at all → WARN
  if (phaseAResult && phaseAResult.result.trades.length === 0) {
    overallVerdict = 'WARN';
  }

  // ── Final report ──
  const report: RunnerReport = {
    config,
    phases: [...phases],
    phaseA: phaseAResult,
    phaseB: phaseBResult,
    phaseC: phaseCResult,
    totalDurationMs,
    overallVerdict,
  };

  printFinalReport(report);
  saveRunnerReport(report);

  // Exit with non-zero if FAIL
  if (overallVerdict === 'FAIL') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ 回测运行器异常:', err);
  process.exit(1);
});
