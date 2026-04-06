/**
 * 泄漏控制回测框架
 * 确保不使用未来信息
 * 
 * 基于 Expert Teams 论文的泄漏控制方法
 */

import logger from '../logger';
// FIX: Import CPCV functions and types for runWithValidation() integration
import {
  combinatorialPurgedCV,
  probabilityOfBacktestOverfitting,
  type CPCVConfig,
  type CPCVResult,
  type TimeSeriesObservation,
} from './cpcvValidation';

import { OHLCV } from '../events/types';
// FIX H4: Crypto trades 365 days/year, not 252 (equity markets)
const CRYPTO_TRADING_DAYS = 365;

// BUG 15 FIX: Helper to compute bars per day from timeframe string
function barsPerDay(timeframe: string): number {
  const match = timeframe.match(/^(\d+)(m|h|d|w)$/i);
  if (!match) return 288; // default to 5-min bars
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'm': return (24 * 60) / value;
    case 'h': return 24 / value;
    case 'd': return 1;
    case 'w': return 1 / 7;
    default: return 288;
  }
}

// ==================== 类型定义 ====================
export interface BacktestConfig {
  symbol: string;
  startDate: number;
  endDate: number;
  initialBalance: number;
  leverage: number;
  feeRate: number;
  slippage: number;
  
  // 泄漏控制参数
  warmupPeriod: number;      // 预热期 (多少根 K 线)
  executionDelay: number;    // 执行延迟 (多少根 K 线)
  useNextOpen: boolean;      // 使用下一根 K 线开盘价
  
  // BUG 15 FIX: Optional timeframe for bars-per-day calculation
  timeframe?: string;        // e.g. '5m', '1h', '1d'
}

export interface BacktestTrade {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  side: 'long' | 'short';
  size: number;
  pnl: number;
  pnlPercent: number;
  fees: number;
  reason: string;
}

export interface BacktestResult {
  // 收益
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  
  // 风险
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  
  // 交易
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgTradeDuration: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  
  // 回测详情
  trades: BacktestTrade[];
  equityCurve: number[];
  drawdownCurve: number[];
  
  // 泄漏控制验证
  leakageCheck: {
    passed: boolean;
    warnings: string[];
  };
  
  // 元数据
  config: BacktestConfig;
  runTime: number;
}

// FIX: New interface for validated backtest results with CPCV + PBO
export interface ValidatedBacktestResult extends BacktestResult {
  validation: {
    cpcv: CPCVResult;
    pbo: number;
    isOverfit: boolean;  // PBO > 0.5
    oosAverageSharpe: number;
  };
}

// FIX: Configuration for the validation pass
export interface ValidationConfig {
  /** Number of contiguous groups (default 10). */
  nGroups?: number;
  /** Number of test groups per combination (default 2). */
  nTestGroups?: number;
  /** Embargo size in observations (default: 1% of data). */
  embargoSize?: number;
  /** PBO threshold above which the strategy is considered overfit (default 0.5). */
  pboThreshold?: number;
}

export interface Strategy {
  name: string;
  generateSignal(
    data: OHLCV[],
    index: number,
    position: { side: 'long' | 'short' | 'none'; size: number; entryPrice: number } | null
  ): { action: 'buy' | 'sell' | 'hold'; size?: number; stopLoss?: number; takeProfit?: number; reason?: string; timestamp?: number; confidence?: number; entryPrice?: number };
}

// ==================== 默认配置 ====================

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  symbol: 'ETHUSDT',
  startDate: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 天前
  endDate: Date.now(),
  initialBalance: 1000,
  leverage: 10,
  feeRate: 0.0004,    // 0.04%
  slippage: 0.0001,   // 0.01%
  warmupPeriod: 50,   // 50 根 K 线预热
  executionDelay: 1,  // 1 根 K 线延迟
  useNextOpen: true,  // 使用下一根开盘价
  timeframe: '5m',    // BUG 15 FIX: default timeframe
};

// ==================== 回测引擎 ====================

export class LeakageControlledBacktest {
  private config: BacktestConfig;
  private data: OHLCV[] = [];
  
  constructor(config?: Partial<BacktestConfig>) {
    this.config = { ...DEFAULT_BACKTEST_CONFIG, ...config };
  }
  
  /**
   * 加载历史数据
   */
  loadData(data: OHLCV[]): void {
    this.data = data.sort((a, b) => a.timestamp - b.timestamp);
    logger.info(`📊 Loaded ${data.length} candles for backtest`);
  }
  
  /**
   * 运行回测
   */
  async run(strategy: Strategy): Promise<BacktestResult> {
    const startTime = Date.now();
    
    if (this.data.length < this.config.warmupPeriod + 10) {
      throw new Error('Insufficient data for backtest');
    }
    
    logger.info(`🔄 Running backtest for ${strategy.name}...`);
    logger.info(`   Period: ${new Date(this.config.startDate).toISOString()} - ${new Date(this.config.endDate).toISOString()}`);
    
    // 初始化
    let balance = this.config.initialBalance;
    let peakBalance = balance;
    let maxDrawdown = 0;
    
    // 记录入场索引
    let entryIndex = 0;
    
    const trades: BacktestTrade[] = [];
    const equityCurve: number[] = [];
    const drawdownCurve: number[] = [];
    const leakageWarnings: string[] = [];
    
    let position: { side: 'long' | 'short' | 'none'; size: number; entryPrice: number } = {
      side: 'none',
      size: 0,
      entryPrice: 0,
    };
    
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    
    // 回测循环
    for (let i = this.config.warmupPeriod; i < this.data.length - this.config.executionDelay; i++) {
      // 关键泄漏控制：只使用 i 之前的数据
      const availableData = this.data.slice(0, i);
      const currentCandle = this.data[i];
      
      // 更新持仓价值
      if (position.side !== 'none') {
        const markPrice = currentCandle.close;
        const unrealizedPnl = position.side === 'long'
          ? (markPrice - position.entryPrice) * position.size
          : (position.entryPrice - markPrice) * position.size;
        
        const currentValue = balance + unrealizedPnl;
        equityCurve.push(currentValue);
        
        // BUG 13 FIX: Update peakBalance BEFORE computing drawdown
        peakBalance = Math.max(peakBalance, currentValue);
        const currentDrawdown = peakBalance - currentValue;
        drawdownCurve.push(currentDrawdown / peakBalance);
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      } else {
        equityCurve.push(balance);
        // BUG 13 FIX: Update peakBalance BEFORE computing drawdown
        peakBalance = Math.max(peakBalance, balance);
        drawdownCurve.push(0);
      }
      
      // 生成信号 (使用泄漏控制的数据)
      const signal = strategy.generateSignal(availableData, i - 1, position);
      
      // FIX: Replaced no-op keyword-matching checkLeakage with actual leakage detection
      this.checkLeakage(signal, i, leakageWarnings);
      
      // 执行交易 (使用下一根 K 线的开盘价)
      const executionIndex = i + this.config.executionDelay;
      const executionCandle = this.data[executionIndex];
      const executionPrice = this.config.useNextOpen 
        ? executionCandle.open 
        : availableData[availableData.length - 1].close;
      
      // 应用滑点
      const slippageAdjustedPrice = signal.action === 'buy'
        ? executionPrice * (1 + this.config.slippage)
        : executionPrice * (1 - this.config.slippage);
      
      // 执行
      if (signal.action === 'buy' && position.side === 'none') {
        // 开多
        const size = (balance * this.config.leverage) / slippageAdjustedPrice;
        const fees = size * slippageAdjustedPrice * this.config.feeRate;
        
        position = {
          side: 'long',
          size,
          entryPrice: slippageAdjustedPrice,
        };
        entryIndex = i;
        balance -= fees;
        
      } else if (signal.action === 'sell' && position.side === 'none') {
        // 开空
        const size = (balance * this.config.leverage) / slippageAdjustedPrice;
        const fees = size * slippageAdjustedPrice * this.config.feeRate;
        
        position = {
          side: 'short',
          size,
          entryPrice: slippageAdjustedPrice,
        };
        entryIndex = i;
        balance -= fees;
        
      } else if (signal.action === 'sell' && position.side === 'long') {
        // 平多
        const pnl = (slippageAdjustedPrice - position.entryPrice) * position.size;
        const fees = position.size * slippageAdjustedPrice * this.config.feeRate;
        
        balance += pnl - fees;
        
        trades.push({
          entryTime: this.data[entryIndex].timestamp,
          entryPrice: position.entryPrice,
          exitTime: executionCandle.timestamp,
          exitPrice: slippageAdjustedPrice,
          side: 'long',
          size: position.size,
          pnl,
          pnlPercent: pnl / (position.entryPrice * position.size),
          fees,
          reason: signal.reason || 'Signal',
        });
        
        // 更新连续计数
        if (pnl > 0) {
          consecutiveWins++;
          consecutiveLosses = 0;
          maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
        } else {
          consecutiveLosses++;
          consecutiveWins = 0;
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
        }
        
        position = { side: 'none', size: 0, entryPrice: 0 };
        
      } else if (signal.action === 'buy' && position.side === 'short') {
        // 平空
        const pnl = (position.entryPrice - slippageAdjustedPrice) * position.size;
        const fees = position.size * slippageAdjustedPrice * this.config.feeRate;
        
        balance += pnl - fees;
        
        trades.push({
          entryTime: this.data[entryIndex].timestamp,
          entryPrice: position.entryPrice,
          exitTime: executionCandle.timestamp,
          exitPrice: slippageAdjustedPrice,
          side: 'short',
          size: position.size,
          pnl,
          pnlPercent: pnl / (position.entryPrice * position.size),
          fees,
          reason: signal.reason || 'Signal',
        });
        
        if (pnl > 0) {
          consecutiveWins++;
          consecutiveLosses = 0;
          maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
        } else {
          consecutiveLosses++;
          consecutiveWins = 0;
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
        }
        
        position = { side: 'none', size: 0, entryPrice: 0 };
      }
    }
    
    // 计算指标
    const totalReturn = balance - this.config.initialBalance;
    const totalReturnPercent = totalReturn / this.config.initialBalance;
    // BUG 15 FIX: Compute bars per day from timeframe config instead of hardcoding 288
    const bpd = barsPerDay(this.config.timeframe ?? '5m');
    const tradingDays = this.data.length / bpd;
    // FIX H5: Use CAGR instead of linear extrapolation
    // Old: totalReturnPercent * (365 / tradingDays) — linear, overestimates for long periods
    const finalValue = balance;
    const initialValue = this.config.initialBalance;
    const annualizedReturn = tradingDays > 0
      ? Math.pow(finalValue / initialValue, CRYPTO_TRADING_DAYS / tradingDays) - 1
      : 0;
    
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length) 
      : 0;
    
    const profitFactor = avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : 
                          avgWin > 0 ? Infinity : 0;
    
    // 计算夏普比率
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
    }
    
    // BUG 7 FIX: Guard against empty/insufficient equity curve
    let sharpeRatio = 0;
    let sortinoRatio = 0;
    if (returns.length >= 2) {
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      // BUG 6 FIX: Use sample std (N-1) instead of population std (N) for Sharpe consistency
      const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1));
      // BUG 15 FIX: Use bpd instead of hardcoded 288
      sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(CRYPTO_TRADING_DAYS * bpd) : 0;
    
      // BUG 14 FIX: Sortino uses ALL observations count (N), not just negative count
      const negativeReturns = returns.filter(r => r < 0);
      // Downside deviation: sum of squared negative returns divided by total N (all observations)
      const downStd = negativeReturns.length > 0 
        ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length)
        : 0;
      const avgReturnForSortino = returns.reduce((a, b) => a + b, 0) / returns.length;
      // BUG 15 FIX: Use bpd instead of hardcoded 288
      sortinoRatio = downStd > 0 ? (avgReturnForSortino / downStd) * Math.sqrt(CRYPTO_TRADING_DAYS * bpd) : 0;
    }
    
    // BUG 8 FIX: maxDrawdownPercent divides by peakBalance not initialBalance
    // BUG 9 FIX: Guard against division by zero when maxDrawdown = 0
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / (maxDrawdown / peakBalance) : 0;
    
    // 平均持仓时间
    const avgTradeDuration = trades.length > 0
      ? trades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / trades.length / 1000 / 60
      : 0;
    
    const runTime = Date.now() - startTime;
    
    // 泄漏检查结果
    const leakageCheck = {
      passed: leakageWarnings.length === 0,
      warnings: leakageWarnings,
    };
    
    const result: BacktestResult = {
      totalReturn,
      totalReturnPercent,
      annualizedReturn,
      maxDrawdown,
      // BUG 8 FIX: Use peakBalance instead of initialBalance for maxDrawdownPercent
      maxDrawdownPercent: peakBalance > 0 ? maxDrawdown / peakBalance : 0,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      totalTrades: trades.length,
      winRate: winRate * 100,
      profitFactor,
      avgTradeDuration,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      trades,
      equityCurve,
      drawdownCurve,
      leakageCheck,
      config: this.config,
      runTime,
    };
    
    logger.info(`✅ Backtest complete: ${trades.length} trades, ${(totalReturnPercent * 100).toFixed(2)}% return`);
    
    return result;
  }
  
  // FIX: New method — run backtest with CPCV validation and PBO scoring
  /**
   * Run backtest with Combinatorial Purged Cross-Validation (CPCV).
   *
   * 1. Runs the standard backtest via `run()` to get the full-sample result.
   * 2. Converts the equity curve to per-bar returns as TimeSeriesObservations.
   * 3. Runs CPCV on those returns to evaluate out-of-sample consistency.
   * 4. Computes PBO to quantify the probability of overfitting.
   * 5. Returns an enhanced result with validation metrics.
   *
   * @param strategy       The trading strategy to evaluate.
   * @param validationCfg  Optional CPCV / PBO configuration overrides.
   */
  async runWithValidation(
    strategy: Strategy,
    validationCfg?: ValidationConfig,
  ): Promise<ValidatedBacktestResult> {
    // Step 1: Run the standard backtest to get full-sample result
    const baseResult = await this.run(strategy);

    // Step 2: Convert equity curve to per-bar return observations for CPCV
    const observations: TimeSeriesObservation[] = [];
    for (let i = 1; i < baseResult.equityCurve.length; i++) {
      const prev = baseResult.equityCurve[i - 1];
      const curr = baseResult.equityCurve[i];
      const ret = prev !== 0 ? (curr - prev) / prev : 0;
      // FIX: Use the data timestamps when available, fall back to index
      const ts = (this.config.warmupPeriod + i < this.data.length)
        ? this.data[this.config.warmupPeriod + i].timestamp
        : i;
      observations.push({ timestamp: ts, value: ret });
    }

    // Step 3: Run CPCV
    const nGroups = validationCfg?.nGroups ?? 10;
    const nTestGroups = validationCfg?.nTestGroups ?? 2;
    const embargoSize = validationCfg?.embargoSize; // undefined => auto 1%

    const cpcvResult = combinatorialPurgedCV(
      observations,
      nGroups,
      nTestGroups,
      embargoSize,
    );

    // Step 4: Compute PBO (single-strategy variant)
    const pboResult = probabilityOfBacktestOverfitting([cpcvResult]);
    const pbo = pboResult.pbo;

    // Step 5: Compute average OOS Sharpe across all CPCV folds
    const oosAverageSharpe =
      cpcvResult.folds.reduce((sum, f) => sum + f.outOfSampleMetric, 0) /
      cpcvResult.folds.length;

    // Step 6: Determine pass/fail
    const pboThreshold = validationCfg?.pboThreshold ?? 0.5;
    const isOverfit = pbo > pboThreshold;

    logger.info(
      `🔬 CPCV Validation: PBO=${pbo.toFixed(3)}, avgOOS_Sharpe=${oosAverageSharpe.toFixed(3)}, ` +
      `overfit=${isOverfit ? 'YES' : 'NO'} (threshold=${pboThreshold})`,
    );

    // Step 7: Return enhanced result
    const validatedResult: ValidatedBacktestResult = {
      ...baseResult,
      validation: {
        cpcv: cpcvResult,
        pbo,
        isOverfit,
        oosAverageSharpe,
      },
    };

    return validatedResult;
  }
  
  /**
   * 泄漏检查 — 多层验证
   * FIX: Old implementation only checked for "future"/"next" string literals (no-op).
   * New implementation performs actual statistical and structural checks.
   */
  private checkLeakage(
    signal: any,
    currentIndex: number,
    warnings: string[]
  ): void {
    // FIX: Check 1 — Signal should not reference future timestamps
    if (signal.timestamp && signal.timestamp > this.data[currentIndex].timestamp) {
      warnings.push(`Signal at index ${currentIndex} references future timestamp ${signal.timestamp}`);
    }

    // FIX: Check 2 — Signal confidence should be within valid range
    if (signal.confidence !== undefined && (signal.confidence > 1 || signal.confidence < 0)) {
      warnings.push(`Signal at index ${currentIndex} has suspicious confidence: ${signal.confidence}`);
    }

    // FIX: Check 3 — Entry price should be within current bar's range
    if (signal.entryPrice !== undefined) {
      const bar = this.data[currentIndex];
      if (signal.entryPrice > bar.high * 1.01 || signal.entryPrice < bar.low * 0.99) {
        warnings.push(`Signal at index ${currentIndex} has entry price ${signal.entryPrice} outside bar range [${bar.low}, ${bar.high}]`);
      }
    }
  }
  
  /**
   * 生成回测报告
   */
  generateReport(result: BacktestResult): string {
    const lines: string[] = [];
    
    lines.push('=== 回测报告 ===');
    lines.push(`策略: ${result.config.symbol}`);
    lines.push(`期间: ${new Date(result.config.startDate).toLocaleDateString()} - ${new Date(result.config.endDate).toLocaleDateString()}`);
    lines.push('');
    
    lines.push('收益指标:');
    lines.push(`  总收益: $${result.totalReturn.toFixed(2)} (${(result.totalReturnPercent * 100).toFixed(2)}%)`);
    lines.push(`  年化收益: ${(result.annualizedReturn * 100).toFixed(2)}%`);
    lines.push('');
    
    lines.push('风险指标:');
    lines.push(`  最大回撤: $${result.maxDrawdown.toFixed(2)} (${(result.maxDrawdownPercent * 100).toFixed(2)}%)`);
    lines.push(`  夏普比率: ${result.sharpeRatio.toFixed(2)}`);
    lines.push(`  索提诺比率: ${result.sortinoRatio.toFixed(2)}`);
    lines.push(`  卡玛比率: ${result.calmarRatio.toFixed(2)}`);
    lines.push('');
    
    lines.push('交易统计:');
    lines.push(`  总交易数: ${result.totalTrades}`);
    lines.push(`  胜率: ${result.winRate.toFixed(1)}%`);
    lines.push(`  盈亏比: ${result.profitFactor.toFixed(2)}`);
    lines.push(`  平均持仓: ${result.avgTradeDuration.toFixed(1)} 分钟`);
    lines.push(`  最大连续盈利: ${result.maxConsecutiveWins}`);
    lines.push(`  最大连续亏损: ${result.maxConsecutiveLosses}`);
    lines.push('');
    
    lines.push('泄漏控制:');
    lines.push(`  检查结果: ${result.leakageCheck.passed ? '✓ 通过' : '✗ 失败'}`);
    if (result.leakageCheck.warnings.length > 0) {
      for (const w of result.leakageCheck.warnings) {
        lines.push(`  ⚠️ ${w}`);
      }
    }
    lines.push('');
    
    // FIX: Include validation section if this is a ValidatedBacktestResult
    const validated = result as ValidatedBacktestResult;
    if (validated.validation) {
      lines.push('CPCV 验证:');
      lines.push(`  PBO: ${validated.validation.pbo.toFixed(3)}`);
      lines.push(`  过拟合: ${validated.validation.isOverfit ? '✗ 是 (FAIL)' : '✓ 否 (PASS)'}`);
      lines.push(`  平均 OOS Sharpe: ${validated.validation.oosAverageSharpe.toFixed(3)}`);
      lines.push(`  CPCV 折数: ${validated.validation.cpcv.totalCombinations}`);
      lines.push('');
    }
    
    lines.push(`回测耗时: ${result.runTime}ms`);
    
    return lines.join('\n');
  }
}

export default LeakageControlledBacktest;
