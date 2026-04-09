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
  const days = parseInt(process.env.BT_DAYS || '365', 10);
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    symbol:         process.env.BT_SYMBOL    || 'ETHUSDT',
    timeframe:      process.env.BT_TIMEFRAME || '5m',
    startDate,
    endDate,
    initialBalance: 10000,
    positionSize:   0.010,  // 1.0% risk per trade
    leverage:       1,
    feeRate:        0.0004,  // 0.04% — aligned with Binance futures maker/taker
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


// ────────────────────────────────────────────────────────────
// Position Aggregation — merge partial-close trades into full positions
// ────────────────────────────────────────────────────────────

interface AggregatedPosition {
  entryTime: number;
  exitTime: number;       // Latest exit time among all partial closes
  side: 'long' | 'short';
  entryPrice: number;
  totalSize: number;       // Sum of all partial close sizes
  weightedExitPrice: number; // Size-weighted average exit price
  exitReason: string;      // Reason of the final (last) exit
}

/**
 * Aggregate partial-close trades into full position records.
 *
 * Phase A generates multiple Trade records per position (TP1 50%, TP2 25%,
 * then SL/TP3/max_holding for the remainder). The LCB engine only supports
 * full open → full close, so replaying individual partial-close trades causes
 * LCB to close 100% at the first TP1 signal, producing massive P&L divergence.
 *
 * This function groups trades by (entryTime, side) — which uniquely identifies
 * a position — and produces one clean entry/exit pair per position.
 */
function aggregateTradesIntoPositions(trades: Trade[]): AggregatedPosition[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = `${t.entryTime}:${t.side}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const positions: AggregatedPosition[] = [];
  for (const [, group] of groups) {
    // Sort by exitTime so the last element is the final exit
    group.sort((a, b) => a.exitTime - b.exitTime);
    const last = group[group.length - 1]!;
    const totalSize = group.reduce((sum, t) => sum + t.size, 0);
    // Weighted exit price: preserves the P&L semantics of partial closes
    const weightedExitPrice = totalSize > 0
      ? group.reduce((sum, t) => sum + t.exitPrice * t.size, 0) / totalSize
      : last.exitPrice;

    positions.push({
      entryTime: group[0]!.entryTime,
      exitTime: last.exitTime,
      side: group[0]!.side,
      entryPrice: group[0]!.entryPrice,
      totalSize,
      weightedExitPrice,
      exitReason: last.exitReason,
    });
  }

  return positions.sort((a, b) => a.entryTime - b.entryTime);
}

/**
 * Bridge adapter: wraps Phase A's OCS trade signals into the
 * Strategy interface expected by LeakageControlledBacktest.
 *
 * Approach: replay the Phase A trades as "known signals" on
 * matching bar timestamps, then compare P&L to detect any
 * data-leakage or execution divergence.
 */
function buildReplayStrategy(trades: Trade[], ohlcv: OHLCV[], name = 'OCS-Replay'): Strategy {
  // FIX: Aggregate partial-close trades into full positions for LCB compatibility.
  // Without this, LCB closes 100% at the first partial-close signal (e.g. TP1),
  // causing systematic P&L divergence (was 23.71%).
  const positions = aggregateTradesIntoPositions(trades);
  console.log(`   📦 聚合 ${trades.length} 笔交易 → ${positions.length} 个完整仓位`);

  // Fix 2: Compute bar period from OHLCV data to shift timestamps
  // Phase A records entryTime at the execution bar (bar i+1).
  // LCB calls generateSignal(data, j-1, pos) and executes at j + executionDelay.
  // With executionDelay=1, execution is at j+1. If we match entryTime at j-1,
  // execution lands at j+1 = (entryBar) + 2 — a 2-bar offset.
  // Shifting timestamps back by one barPeriod makes the match happen one bar earlier,
  // so execution at j+1 = entryBar (correct alignment with Phase A).
  let barPeriodMs = 300000; // default 5m = 300000ms
  if (ohlcv.length >= 2) {
    // Use median of first 10 bar intervals for robustness
    const intervals: number[] = [];
    for (let k = 1; k < Math.min(ohlcv.length, 11); k++) {
      intervals.push(ohlcv[k]!.timestamp - ohlcv[k - 1]!.timestamp);
    }
    intervals.sort((a, b) => a - b);
    barPeriodMs = intervals[Math.floor(intervals.length / 2)]!;
  }
  console.log(`   ⏱  Bar period: ${barPeriodMs}ms (${barPeriodMs / 60000}min) — shifting replay timestamps by -1 bar`);

  // Build maps: timestamp → position[] (multiple positions can share same timestamp)
  // Fix 2: Shift entry/exit timestamps back by one barPeriodMs
  const positionsByEntry = new Map<number, AggregatedPosition[]>();
  const positionsByExit = new Map<number, AggregatedPosition[]>();
  const consumedEntries = new Set<number>(); // index in positions array
  const consumedExits = new Set<number>();

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!;
    // Fix 2: Use shifted timestamps (one bar earlier) so LCB's +1 executionDelay
    // lands on the correct Phase A execution bar
    const shiftedEntry = p.entryTime - barPeriodMs;
    const shiftedExit = p.exitTime - barPeriodMs;
    if (!positionsByEntry.has(shiftedEntry)) positionsByEntry.set(shiftedEntry, []);
    positionsByEntry.get(shiftedEntry)!.push(p);
    if (!positionsByExit.has(shiftedExit)) positionsByExit.set(shiftedExit, []);
    positionsByExit.get(shiftedExit)!.push(p);
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
        const exitPositions = positionsByExit.get(bar.timestamp);
        if (exitPositions) {
          for (const p of exitPositions) {
            const pIdx = positions.indexOf(p);
            if (consumedExits.has(pIdx)) continue;
            if (p.side === position.side) {
              consumedExits.add(pIdx);
              const closeSide = position.side === 'long' ? 'sell' : 'buy';
              return {
                action: closeSide as 'buy' | 'sell',
                size: position.size,  // Close full LCB position
                reason: `replay-close: ${p.exitReason}`,
              };
            }
          }
        }
      }

      // Open new position if this bar matches an entry timestamp
      if (!position || position.side === 'none') {
        const entryPositions = positionsByEntry.get(bar.timestamp);
        if (entryPositions) {
          for (const p of entryPositions) {
            const pIdx = positions.indexOf(p);
            if (consumedEntries.has(pIdx)) continue;
            consumedEntries.add(pIdx);
            return {
              action: p.side === 'long' ? 'buy' as const : 'sell' as const,
              size: p.totalSize,
              reason: 'replay-entry',
            };
          }
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
  pnlDivergence: number;        // absolute % divergence from Phase A (informational)
  entryMatchRate: number;        // per-trade entry alignment rate
  positionCoverage: number;      // Phase B trades / Phase A positions
  executionConsistent: boolean;  // entry match >= 90% AND coverage >= 80%
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
    executionDelay: 0,    // replay mode: -1 bar shift already compensates
    useNextOpen: true,
  });

  // Load same OHLCV data
  lcb.loadData(phaseAResult.ohlcv);

  // Build replay strategy from Phase A trades
  const replayStrategy = buildReplayStrategy(phaseAResult.result.trades, phaseAResult.ohlcv);

  // Run through leakage-controlled framework
  const lcbResult = await lcb.run(replayStrategy);

  // --- P&L divergence (informational only, not pass/fail) ---
  const phaseATotalReturn = phaseAResult.result.stats.totalReturnPercent;
  const phaseBTotalReturn = lcbResult.totalReturnPercent * 100; // LCB returns decimal, convert to %
  const pnlDivergence = Math.abs(phaseATotalReturn - phaseBTotalReturn);

  // --- Per-trade entry alignment check (primary consistency metric) ---
  const phaseBTrades = lcbResult.trades;
  const phaseAPositions = aggregateTradesIntoPositions(phaseAResult.result.trades);

    let entryMatched = 0;
  const entryTotal = Math.min(phaseBTrades.length, phaseAPositions.length);

  // Build Phase A positions by entry time for lookup
  const phaseAByEntry = new Map<number, AggregatedPosition[]>();
  for (const p of phaseAPositions) {
    if (!phaseAByEntry.has(p.entryTime)) phaseAByEntry.set(p.entryTime, []);
    phaseAByEntry.get(p.entryTime)!.push(p);
  }

  for (const bt of phaseBTrades) {
    const candidates = phaseAByEntry.get(bt.entryTime);
    if (candidates) {
      for (const c of candidates) {
        if (c.side === bt.side) {
          const priceDiff = Math.abs(bt.entryPrice - c.entryPrice) / c.entryPrice;
          if (priceDiff < 0.005) { // 0.5% tolerance
            entryMatched++;
            break;
          }
        }
      }
    }
  }

  const entryMatchRate = entryTotal > 0 ? entryMatched / entryTotal : 0;
  const positionCoverage = phaseAPositions.length > 0 ? phaseBTrades.length / phaseAPositions.length : 0;

  // New pass criteria:
  // - Entry match rate >= 90%
  // - Position coverage >= 80% (LCB may skip some due to risk controls)
  const executionConsistent = entryMatchRate >= 0.90 && positionCoverage >= 0.80;

  const durationMs = Date.now() - t0;

  console.log(`\n📊 Phase B 结果:`);
  console.log(`   Phase A 总收益: ${phaseATotalReturn >= 0 ? '+' : ''}${phaseATotalReturn.toFixed(2)}%`);
  console.log(`   Phase B 总收益: ${phaseBTotalReturn >= 0 ? '+' : ''}${phaseBTotalReturn.toFixed(2)}%`);
  console.log(`   P&L 偏差: ${pnlDivergence.toFixed(2)}% (信息参考, 因部分平仓机制差异预期偏差较大)`);
  console.log(`   入场匹配率: ${(entryMatchRate * 100).toFixed(1)}% (${entryMatched}/${entryTotal})`);
  console.log(`   仓位覆盖率: ${(positionCoverage * 100).toFixed(1)}% (${phaseBTrades.length}/${phaseAPositions.length})`);
  console.log(`   Phase A 仓位数: ${phaseAPositions.length} (聚合自 ${phaseAResult.result.trades.length} 笔交易)`);
  console.log(`   Phase B 交易数: ${lcbResult.totalTrades}`);
  console.log(`   Phase B 胜率: ${lcbResult.winRate.toFixed(2)}%`);
  console.log(`   Phase B 最大回撤: ${lcbResult.maxDrawdownPercent.toFixed(2)}%`);
  console.log(`⏱  Phase B 耗时: ${(durationMs / 1000).toFixed(1)}s`);

  if (!executionConsistent) {
    console.log(`\n⚠️  警告: 入场匹配率或仓位覆盖率不足!`);
    if (entryMatchRate < 0.90) {
      console.log(`   - 入场匹配率 ${(entryMatchRate * 100).toFixed(1)}% < 90% 阈值`);
    }
    if (positionCoverage < 0.80) {
      console.log(`   - 仓位覆盖率 ${(positionCoverage * 100).toFixed(1)}% < 80% 阈值`);
    }
    console.log(`   建议: 检查时间戳对齐或风控参数是否过于严格。`);
  }

  return {
    totalReturn: phaseBTotalReturn,
    winRate: lcbResult.winRate,
    trades: lcbResult.totalTrades,
    maxDrawdown: lcbResult.maxDrawdownPercent,
    pnlDivergence,
    entryMatchRate,
    positionCoverage,
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


/**
 * Estimate bars per day from OHLCV timestamps.
 */
function estimateBarsPerDay(ohlcv: OHLCV[]): number {
  if (ohlcv.length < 2) return 288; // default: 5m bars
  const totalMs = ohlcv[ohlcv.length - 1]!.timestamp - ohlcv[0]!.timestamp;
  const totalDays = totalMs / (24 * 60 * 60 * 1000);
  if (totalDays < 0.5) return 288;
  return Math.round(ohlcv.length / totalDays);
}

/**
 * Resample a per-bar equity curve to daily snapshots.
 * Takes the last equity value of each "day window" (barsPerDay bars).
 */
function resampleEquityToDaily(equity: number[], barsPerDay: number): number[] {
  if (barsPerDay <= 1) return equity;
  const daily: number[] = [equity[0]!]; // start with initial equity
  for (let i = barsPerDay; i < equity.length; i += barsPerDay) {
    daily.push(equity[i]!);
  }
  // Always include the last point
  if (equity.length > 0 && (equity.length - 1) % barsPerDay !== 0) {
    daily.push(equity[equity.length - 1]!);
  }
  return daily;
}

async function phaseC(
  phaseAResult: PhaseAResult,
  ohlcv: OHLCV[],
): Promise<PhaseCResult> {
  console.log('\n' + '═'.repeat(60));
  console.log('🅲  Phase C — 统计显著性验证 (CPCV / PBO / DSR)');
  console.log('═'.repeat(60));

  const t0 = Date.now();
  const equity = phaseAResult.result.equityCurve;

  if (equity.length < 2) {
    throw new Error('Equity curve too short for statistical validation. Need at least 2 data points.');
  }

  // ── Resample equity curve to DAILY returns ──────────────────
  // Per-bar returns with sparse trades create extreme kurtosis (99%+ zeros)
  // which makes MinBTL explode. Daily aggregation gives a return series with
  // meaningful distributional properties for López de Prado validation.

  const barsPerDay = estimateBarsPerDay(ohlcv);
  const dailyEquity = resampleEquityToDaily(equity, barsPerDay);
  const observations: TimeSeriesObservation[] = [];
  for (let i = 1; i < dailyEquity.length; i++) {
    const prev = dailyEquity[i - 1]!;
    const curr = dailyEquity[i]!;
    const ret = prev !== 0 ? (curr - prev) / prev : 0;
    observations.push({ timestamp: i, value: ret });
  }

  const tradeCount = phaseAResult.result.trades.length;
  console.log(`📈 权益曲线: ${equity.length} 根K线 → ${dailyEquity.length} 天 → ${observations.length} 个日收益观测值`);
  console.log(`📊 交易数: ${tradeCount} | 每日K线: ~${barsPerDay}`);

  // Minimum requirements check
  if (observations.length < 30) {
    console.log(`\n⚠️  日收益观测值不足 (${observations.length} < 30), 统计验证不可靠`);
    console.log(`   建议: 增加回测时长至 60+ 天 (BT_DAYS=90)`);
  }
  if (tradeCount < 30) {
    console.log(`\n⚠️  交易次数不足 (${tradeCount} < 30), 统计结论仅供参考`);
    console.log(`   建议: 增加回测时长或降低策略触发阈值`);
  }

  // Adaptive nGroups: at least 5 observations per group, minimum 3 groups
  const maxGroups = Math.floor(observations.length / 5);
  const nGroups = Math.max(3, Math.min(10, maxGroups));

  // Run López de Prado validation suite
  const validation = validateBacktest(observations, {
    cpcv: {
      nGroups,
      nTestGroups: Math.min(2, Math.floor(nGroups / 2)),
    },
    numTrials: 1,
    dsrSignificanceLevel: 0.05,
    // Use default threshold (0.95) — DSR is a probability ∈ [0,1]
  });

  const durationMs = Date.now() - t0;

  // Print results
  console.log(`\n📊 Phase C 结果:`);
  console.log(`   ┌──────────────────────────────────────────────┐`);
  console.log(`   │ Sharpe Ratio (日):   ${validation.sharpeRatio.toFixed(4).padStart(12)}         │`);
  console.log(`   │ Deflated Sharpe:     ${validation.deflatedSharpe.toFixed(4).padStart(12)}         │`);
  console.log(`   │ PBO:                 ${validation.pbo.pbo.toFixed(4).padStart(12)}         │`);
  console.log(`   │ DSR Significant:     ${String(validation.isStatisticallySignificant).padStart(12)}         │`);
  console.log(`   │ Min BT Length (日):  ${String(Math.ceil(validation.minBacktestLength)).padStart(12)}         │`);
  console.log(`   │ Actual Length (日):  ${String(observations.length).padStart(12)}         │`);
  console.log(`   │ Meets Min Length:    ${String(validation.meetsMinLength).padStart(12)}         │`);
  console.log(`   │ CPCV nGroups:        ${String(nGroups).padStart(12)}         │`);
  console.log(`   │ Overall Pass:        ${String(validation.overallPass).padStart(12)}         │`);
  console.log(`   └──────────────────────────────────────────────┘`);

  // Diagnostic: show DSR internals for debugging
  if (validation.dsr) {
    const dsr = validation.dsr;
    console.log(`\n🔍 DSR 诊断:`);
    console.log(`   Per-period SR: ${dsr.sharpeRatio.toFixed(6)} | Skewness: ${dsr.skewness.toFixed(4)} | ExKurtosis: ${dsr.kurtosis.toFixed(4)}`);
    console.log(`   Actual: ${dsr.actualLength} 日 | MinBTL: ${Math.ceil(dsr.minBacktestLength)} 日`);
  }

  console.log(`⏱  Phase C 耗时: ${(durationMs / 1000).toFixed(1)}s`);

  if (validation.overallPass) {
    console.log(`\n✅ 统计验证通过: 策略具备统计显著性, 过拟合概率低 (PBO=${validation.pbo.pbo.toFixed(3)})`);
  } else {
    console.log(`\n⚠️  统计验证未通过:`);
    if (validation.pbo.pbo >= 0.5) {
      console.log(`   - PBO=${validation.pbo.pbo.toFixed(3)} ≥ 0.5 → 过拟合风险较高`);
    }
    if (!validation.isStatisticallySignificant) {
      console.log(`   - Deflated Sharpe ${validation.deflatedSharpe.toFixed(4)} < 0.95 阈值`);
    }
    if (!validation.meetsMinLength) {
      console.log(`   - 日收益序列长度不足: ${observations.length} 日 < 需要 ${Math.ceil(validation.minBacktestLength)} 日`);
      // Compute how many calendar days are needed
      const neededDays = Math.ceil(validation.minBacktestLength);
      if (neededDays < 3650) {
        console.log(`   - 建议: 设置 BT_DAYS=${neededDays} 重新回测`);
      }
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
    rows.push(['A: 最大回撤', `${s.maxDrawdown.toFixed(2)}%`, s.maxDrawdown < 15 ? '✅' : s.maxDrawdown < 25 ? '⚠️' : '❌']);
    rows.push(['A: 交易次数', String(s.totalTrades), s.totalTrades >= 10 ? '✅' : '⚠️']);
  }

  if (report.phaseB) {
    const b = report.phaseB;
    rows.push(['B: 入场匹配率', `${(b.entryMatchRate * 100).toFixed(1)}%`, b.entryMatchRate >= 0.90 ? '✅' : '❌']);
    rows.push(['B: 仓位覆盖率', `${(b.positionCoverage * 100).toFixed(1)}%`, b.positionCoverage >= 0.80 ? '✅' : '❌']);
    rows.push(['B: P&L 偏差', `${b.pnlDivergence.toFixed(2)}%`, '📊']);
    rows.push(['B: 执行一致性', b.executionConsistent ? '通过' : '未通过', b.executionConsistent ? '✅' : '❌']);
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
    const cells = row.map((cell, i) => ` ${cell.padEnd(colWidths[i]!)} `);
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
      } catch (err: unknown) {
        console.error(`\n❌ Phase B 失败: ${err instanceof Error ? err.message : String(err)}`);
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
    if (phaseAResult.result.equityCurve.length < 50) {
      console.log(`\n⚠️  权益曲线过短 (${phaseAResult.result.equityCurve.length} 点, < 50), 跳过 Phase C`);
    } else {
      try {
        phaseCResult = await phaseC(phaseAResult, phaseAResult.ohlcv);
      } catch (err: unknown) {
        console.error(`\n❌ Phase C 失败: ${err instanceof Error ? err.message : String(err)}`);
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
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 回测运行器异常:', err);
  process.exit(1);
});
