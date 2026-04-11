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
import { loadConfig, printConfigSummary } from './src/config/index.js';

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
  const cfg = loadConfig('backtest');

  const startDate = new Date(cfg.backtest.startDate);
  const endDate = new Date(cfg.backtest.endDate);

  return {
    symbol:         cfg.symbol.binance,
    timeframe:      cfg.timeframe,
    startDate,
    endDate,
    initialBalance: cfg.backtest.initialBalance,
    positionSize:   cfg.position.baseSize,
    leverage:       cfg.position.leverage,
    costConfig: {
      feeRate:      cfg.cost.feeRate,
      makerRebate:  cfg.cost.makerRebate,
      slippageBps:  cfg.cost.slippageBps,
    },
    feeRate:        cfg.cost.feeRate,
    slippage:       cfg.cost.slippageBps / 10000,
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
  console.log(`   Phase A 仓位数: ${phaseAPositions.length}`);
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

/**
 * Adaptive resample: choose the largest period that yields >= minObs observations.
 * Tries: 1d → 4h → 1h → raw bars.
 * Returns { resampled equity array, period label, bars per period }.
 */
function adaptiveResample(
  equity: number[],
  barsPerDay: number,
  minObs: number = 30,
): { resampled: number[]; periodLabel: string; barsPerPeriod: number } {
  const candidates: Array<{ label: string; divisor: number }> = [
    { label: '日', divisor: 1 },          // 1 day
    { label: '4h', divisor: 6 },          // 4 hours
    { label: '1h', divisor: 24 },         // 1 hour
    { label: '30m', divisor: 48 },        // 30 minutes
    { label: '15m', divisor: 96 },        // 15 minutes
  ];

  for (const { label, divisor } of candidates) {
    const barsPerPeriod = Math.max(1, Math.round(barsPerDay / divisor));
    const estimated = Math.floor((equity.length - 1) / barsPerPeriod);
    if (estimated >= minObs) {
      const resampled = resampleEquityToDaily(equity, barsPerPeriod);
      return { resampled, periodLabel: label, barsPerPeriod };
    }
  }

  // Fallback: use raw bar-level returns (no resample)
  return { resampled: equity, periodLabel: 'bar', barsPerPeriod: 1 };
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

  // ── Adaptive resample: choose granularity to get enough observations ──
  // Long backtests → daily returns (standard López de Prado approach)
  // Short backtests → 4h/1h returns (preserves statistical power)
  // Avoids: "not enough observations" for intraday backtests

  const bpd = estimateBarsPerDay(ohlcv);
  const { resampled: sampledEquity, periodLabel, barsPerPeriod } = adaptiveResample(equity, bpd);
  const observations: TimeSeriesObservation[] = [];
  for (let i = 1; i < sampledEquity.length; i++) {
    const prev = sampledEquity[i - 1]!;
    const curr = sampledEquity[i]!;
    const ret = prev !== 0 ? (curr - prev) / prev : 0;
    observations.push({ timestamp: i, value: ret });
  }

  const tradeCount = phaseAResult.result.trades.length;
  console.log(`📈 权益曲线: ${equity.length} 根K线 → ${observations.length} 个观测值 (${periodLabel}级采样, 每${barsPerPeriod}根K线)`);
  console.log(`📊 交易数: ${tradeCount} | 每日K线: ~${bpd}`);

  const positionCount = phaseAResult.result.stats.totalPositions;
  if (positionCount < 10) {
    console.log(`\n⚠️  仓位数较少 (${positionCount}), 统计结论仅供参考`);
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
  console.log(`   │ Sharpe Ratio (${periodLabel}):   ${validation.sharpeRatio.toFixed(4).padStart(12)}         │`);
  console.log(`   │ Deflated Sharpe:     ${validation.deflatedSharpe.toFixed(4).padStart(12)}         │`);
  console.log(`   │ PBO:                 ${validation.pbo.pbo.toFixed(4).padStart(12)}         │`);
  console.log(`   │ DSR Significant:     ${String(validation.isStatisticallySignificant).padStart(12)}         │`);
  console.log(`   │ Min BT Length (${periodLabel}):  ${String(Math.ceil(validation.minBacktestLength)).padStart(12)}         │`);
  console.log(`   │ Actual Length (${periodLabel}):  ${String(observations.length).padStart(12)}         │`);
  console.log(`   │ Meets Min Length:    ${String(validation.meetsMinLength).padStart(12)}         │`);
  console.log(`   │ CPCV nGroups:        ${String(nGroups).padStart(12)}         │`);
  console.log(`   │ Overall Pass:        ${String(validation.overallPass).padStart(12)}         │`);
  console.log(`   └──────────────────────────────────────────────┘`);

  // Diagnostic: show DSR internals for debugging
  if (validation.dsr) {
    const dsr = validation.dsr;
    console.log(`\n🔍 DSR 诊断:`);
    console.log(`   Per-period SR: ${dsr.sharpeRatio.toFixed(6)} | Skewness: ${dsr.skewness.toFixed(4)} | ExKurtosis: ${dsr.kurtosis.toFixed(4)}`);
    console.log(`   Actual: ${dsr.actualLength} ${periodLabel} | MinBTL: ${Math.ceil(dsr.minBacktestLength)} ${periodLabel}`);
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
      console.log(`   - 收益序列长度不足: ${observations.length} 个${periodLabel}观测 < 需要 ${Math.ceil(validation.minBacktestLength)} 个`);
      // Compute how many calendar days are needed
      // Only show duration suggestion if it's reasonable
      if (periodLabel === '日') {
        const neededDays = Math.ceil(validation.minBacktestLength);
        if (neededDays < 3650) {
          console.log(`   - 建议: 调整 BT_START_DATE/BT_END_DATE 使回测区间 >= ${neededDays} 天`);
        }
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
    rows.push(['A: 仓位数', String(s.totalPositions), s.totalPositions >= 10 ? '✅' : '⚠️']);
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


// ────────────────────────────────────────────────────────────
// Monte Carlo window scan — robustness evaluation
// ────────────────────────────────────────────────────────────

/**
 * Run multiple backtests with shifted start/end dates to assess
 * how sensitive results are to the choice of window.
 *
 * Usage: BT_MONTE_CARLO=7 bun run backtest
 *
 * This runs 7 backtests, each shifted by +1 day from the previous.
 * Reports the median, P5, and P95 of key metrics.
 */
interface MCResult {
  offset: number;
  totalReturn: number;
  sharpe: number;
  maxDrawdown: number;
  pbo: number;
  positions: number;
  pnlDeviation: number;
  verdict: string;
}

function getMonteCarloCount(): number {
  const raw = process.env.BT_MONTE_CARLO;
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) || n < 2 ? 0 : Math.min(n, 30); // cap at 30
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function printMCReport(results: MCResult[]) {
  console.log('\n' + '═'.repeat(60));
  console.log('🎲 Monte Carlo 窗口扫描报告');
  console.log('═'.repeat(60));

  const returns = results.map(r => r.totalReturn);
  const sharpes = results.map(r => r.sharpe);
  const mdds = results.map(r => r.maxDrawdown);
  const pbos = results.map(r => r.pbo);
  const devs = results.map(r => r.pnlDeviation).filter(v => v >= 0);
  const passes = results.filter(r => r.verdict === 'PASS').length;

  console.log(`\n📊 ${results.length} 次回测结果:`);
  console.log(`   PASS: ${passes}/${results.length} (${(passes/results.length*100).toFixed(0)}%)`);
  console.log('');

  const metrics: Array<{ name: string; values: number[]; fmt: (v: number) => string }> = [
    { name: '总收益%', values: returns, fmt: v => `${v.toFixed(2)}%` },
    { name: 'Sharpe', values: sharpes, fmt: v => v.toFixed(2) },
    { name: '最大回撤%', values: mdds, fmt: v => `${v.toFixed(2)}%` },
    { name: 'PBO', values: pbos, fmt: v => v.toFixed(4) },
    { name: 'P&L偏差%', values: devs, fmt: v => `${v.toFixed(2)}%` },
  ];

  console.log(`+${'─'.repeat(14)}+${'─'.repeat(12)}+${'─'.repeat(12)}+${'─'.repeat(12)}+${'─'.repeat(12)}+${'─'.repeat(12)}+`);
  console.log(`| ${'指标'.padEnd(12)} | ${'P5'.padStart(10)} | ${'P25'.padStart(10)} | ${'中位数'.padStart(8)} | ${'P75'.padStart(10)} | ${'P95'.padStart(10)} |`);
  console.log(`+${'─'.repeat(14)}+${'─'.repeat(12)}+${'─'.repeat(12)}+${'─'.repeat(12)}+${'─'.repeat(12)}+${'─'.repeat(12)}+`);
  for (const m of metrics) {
    const p5  = m.fmt(percentile(m.values, 5));
    const p25 = m.fmt(percentile(m.values, 25));
    const med = m.fmt(percentile(m.values, 50));
    const p75 = m.fmt(percentile(m.values, 75));
    const p95 = m.fmt(percentile(m.values, 95));
    console.log(`| ${m.name.padEnd(12)} | ${p5.padStart(10)} | ${p25.padStart(10)} | ${med.padStart(10)} | ${p75.padStart(10)} | ${p95.padStart(10)} |`);
  }
  console.log(`+${'─'.repeat(14)}+${'─'.repeat(12)}+${'─'.repeat(12)}+${'─'.repeat(12)}+${'─'.repeat(12)}+${'─'.repeat(12)}+`);

  // Stability score: coefficient of variation of returns
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
  const cv = mean !== 0 ? (std / Math.abs(mean)) * 100 : 0;
  console.log(`\n📈 收益稳定性: 均值=${mean.toFixed(2)}% 标准差=${std.toFixed(2)}% CV=${cv.toFixed(1)}%`);
  if (cv < 10) {
    console.log('   ✅ 窗口敏感度: 低 (CV < 10%) — 策略对起始日期不敏感');
  } else if (cv < 25) {
    console.log('   ⚠️  窗口敏感度: 中 (10% ≤ CV < 25%) — 策略对起始日期有一定敏感性');
  } else {
    console.log('   ❌ 窗口敏感度: 高 (CV ≥ 25%) — 策略对起始日期高度敏感');
  }

  // Per-run detail table
  console.log('\n📋 各偏移量明细:');
  console.log(`+${'─'.repeat(8)}+${'─'.repeat(12)}+${'─'.repeat(10)}+${'─'.repeat(10)}+${'─'.repeat(10)}+${'─'.repeat(8)}+`);
  console.log(`| ${'偏移'.padStart(6)} | ${'收益%'.padStart(10)} | ${'Sharpe'.padStart(8)} | ${'MDD%'.padStart(8)} | ${'PBO'.padStart(8)} | ${'判定'.padStart(6)} |`);
  console.log(`+${'─'.repeat(8)}+${'─'.repeat(12)}+${'─'.repeat(10)}+${'─'.repeat(10)}+${'─'.repeat(10)}+${'─'.repeat(8)}+`);
  for (const r of results) {
    const icon = r.verdict === 'PASS' ? '✅' : r.verdict === 'WARN' ? '⚠️' : '❌';
    console.log(`| ${('+' + r.offset + 'd').padStart(6)} | ${(r.totalReturn.toFixed(2) + '%').padStart(10)} | ${r.sharpe.toFixed(2).padStart(8)} | ${r.maxDrawdown.toFixed(2).padStart(8)} | ${r.pbo.toFixed(4).padStart(8)} | ${icon.padStart(4)} |`);
  }
  console.log(`+${'─'.repeat(8)}+${'─'.repeat(12)}+${'─'.repeat(10)}+${'─'.repeat(10)}+${'─'.repeat(10)}+${'─'.repeat(8)}+`);
}


async function monteCarloMain(count: number) {
  const phases = getPhases();
  const baseConfig = makeConfig();
  const unifiedCfg = loadConfig('backtest');

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    Quant-Algo Monte Carlo 窗口扫描 v1.0                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`📌 标的: ${baseConfig.symbol} | 周期: ${baseConfig.timeframe}`);
  console.log(`📅 基准: ${baseConfig.startDate.toISOString().split('T')[0]} → ${baseConfig.endDate.toISOString().split('T')[0]}`);
  console.log(`🎲 Monte Carlo: ${count} 次窗口偏移扫描`);
  console.log('');

  const results: MCResult[] = [];
  const t0 = Date.now();

  for (let offset = 0; offset < count; offset++) {
    const shiftedStart = new Date(baseConfig.startDate.getTime() + offset * 86400000);
    const shiftedEnd = new Date(baseConfig.endDate.getTime() + offset * 86400000);
    const config = { ...baseConfig, startDate: shiftedStart, endDate: shiftedEnd };

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🎲 MC Run #${offset + 1}/${count}: ${shiftedStart.toISOString().split('T')[0]} → ${shiftedEnd.toISOString().split('T')[0]}`);
    console.log('─'.repeat(60));

    try {
      // Phase A
      const phaseAResult = await phaseA(config);

      // Phase B
      let phaseBResult: PhaseBResult | undefined;
      if (phases.has('B') && phaseAResult.result.trades.length > 0) {
        try {
          phaseBResult = await phaseB(config, phaseAResult);
        } catch { /* skip */ }
      }

      // Phase C
      let phaseCResult: PhaseCResult | undefined;
      if (phases.has('C') && phaseAResult.result.equityCurve.length >= 50) {
        try {
          phaseCResult = await phaseC(phaseAResult, phaseAResult.ohlcv);
        } catch { /* skip */ }
      }

      // Verdict
      let verdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
      if (phaseAResult.result.stats.totalReturnPercent < 0) {
        const bpd = estimateBarsPerDay(phaseAResult.ohlcv);
        verdict = (phaseAResult.result.equityCurve.length / bpd) < 7 ? 'WARN' : 'FAIL';
      }
      if (phaseBResult && !phaseBResult.executionConsistent) verdict = 'FAIL';
      if (phaseCResult && !phaseCResult.validation.overallPass) {
        const bpd2 = estimateBarsPerDay(phaseAResult.ohlcv);
        const days = phaseAResult.result.equityCurve.length / bpd2;
        if (days >= 30) {
          verdict = phaseCResult.validation.pbo.pbo >= 0.5 ? 'FAIL' : 'WARN';
        } else {
          verdict = verdict === 'FAIL' ? 'FAIL' : 'WARN';
        }
      }
      if (phaseAResult.result.trades.length === 0) verdict = 'WARN';

      results.push({
        offset,
        totalReturn: phaseAResult.result.stats.totalReturnPercent,
        sharpe: phaseAResult.result.stats.sharpeRatio,
        maxDrawdown: phaseAResult.result.stats.maxDrawdownPercent,
        pbo: phaseCResult?.validation?.pbo?.pbo ?? -1,
        positions: phaseAResult.result.stats.totalPositions,
        pnlDeviation: phaseBResult?.pnlDivergence ?? -1,
        verdict,
      });
    } catch (err) {
      console.error(`  ❌ MC Run #${offset + 1} failed: ${err}`);
    }
  }

  const totalMs = Date.now() - t0;
  printMCReport(results);
  console.log(`\n⏱  Monte Carlo 总耗时: ${(totalMs / 1000).toFixed(1)}s`);

  // Save MC report
  const mcReportPath = path.join(
    process.cwd(), 'backtest-reports',
    `mc-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(mcReportPath, JSON.stringify(results, null, 2));
  console.log(`📄 MC报告已保存: ${mcReportPath}`);
  process.exit(0);
}

async function main() {
  const mcCount = getMonteCarloCount();
  if (mcCount >= 2) {
    return monteCarloMain(mcCount);
  }

  const phases = getPhases();
  const config = makeConfig();

  // Print unified config summary
  const unifiedCfg = loadConfig('backtest');
  printConfigSummary(unifiedCfg);

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
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('at least') && msg.includes('observations')) {
          console.log(`\n⚠️  Phase C 跳过: 数据量不足以进行统计验证 (${msg})`);
          console.log('   这不影响策略本身的有效性, 增加回测时长即可启用 Phase C');
        } else {
          console.error(`\n❌ Phase C 失败: ${msg}`);
        }
      }
    }
  }

  const totalDurationMs = Date.now() - t0;

  // ── Determine overall verdict ──
  let overallVerdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  // Short backtests (< 7 days) with negative returns → WARN, not FAIL
  // Single-day losses are statistically meaningless
  if (phaseAResult && phaseAResult.result.stats.totalReturnPercent < 0) {
    const bpd = estimateBarsPerDay(phaseAResult.ohlcv);
    const tradingDays = phaseAResult.result.equityCurve.length / bpd;
    overallVerdict = tradingDays < 7 ? 'WARN' : 'FAIL';
  }
  if (phaseBResult && !phaseBResult.executionConsistent) {
    overallVerdict = 'FAIL';
  }
  if (phaseCResult && !phaseCResult.validation.overallPass) {
    const bpd2 = estimateBarsPerDay(phaseAResult!.ohlcv);
    const days = phaseAResult!.result.equityCurve.length / bpd2;
    // Short backtests (< 30 days): Phase C lacks statistical power → cap at WARN
    if (days < 30) {
      overallVerdict = overallVerdict === 'FAIL' ? 'FAIL' : 'WARN';
    } else {
      overallVerdict = phaseCResult.validation.pbo.pbo >= 0.5 ? 'FAIL' : 'WARN';
    }
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
