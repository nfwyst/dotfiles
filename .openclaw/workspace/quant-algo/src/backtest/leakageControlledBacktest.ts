/**
 * 泄漏控制回测框架
 * 确保不使用未来信息
 * 
 * 基于 Expert Teams 论文的泄漏控制方法
 */

import logger from '../logger';

// ==================== 类型定义 ====================

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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

export interface Strategy {
  name: string;
  generateSignal(
    data: OHLCV[],
    index: number,
    position: { side: 'long' | 'short' | 'none'; size: number; entryPrice: number } | null
  ): { action: 'buy' | 'sell' | 'hold'; size?: number; stopLoss?: number; takeProfit?: number; reason?: string };
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
        
        const currentDrawdown = peakBalance - currentValue;
        drawdownCurve.push(currentDrawdown / peakBalance);
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
        peakBalance = Math.max(peakBalance, currentValue);
      } else {
        equityCurve.push(balance);
        drawdownCurve.push(0);
      }
      
      // 生成信号 (使用泄漏控制的数据)
      const signal = strategy.generateSignal(availableData, i - 1, position);
      
      // 泄漏检查：确保没有使用未来数据
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
    const tradingDays = this.data.length / 288; // 假设 5 分钟 K 线
    const annualizedReturn = totalReturnPercent * (365 / tradingDays);
    
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
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252 * 288) : 0;
    
    // Sortino
    const negativeReturns = returns.filter(r => r < 0);
    const downStd = negativeReturns.length > 0 
      ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
      : 0;
    const sortinoRatio = downStd > 0 ? (avgReturn / downStd) * Math.sqrt(252 * 288) : 0;
    
    const calmarRatio = annualizedReturn / (maxDrawdown / this.config.initialBalance);
    
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
      maxDrawdownPercent: maxDrawdown / this.config.initialBalance,
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
  
  /**
   * 泄漏检查
   */
  private checkLeakage(
    signal: any,
    currentIndex: number,
    warnings: string[]
  ): void {
    // 检查信号中是否包含未来信息
    // 这是一个简化的检查，实际可能需要更复杂的逻辑
    
    // 检查是否有可疑的时间戳
    if (signal.futureTimestamp) {
      warnings.push(`Signal contains future timestamp at index ${currentIndex}`);
    }
    
    // 检查是否有"未来"关键字
    const signalStr = JSON.stringify(signal).toLowerCase();
    if (signalStr.includes('future') || signalStr.includes('next')) {
      warnings.push(`Signal may contain future information at index ${currentIndex}`);
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
    
    lines.push(`回测耗时: ${result.runTime}ms`);
    
    return lines.join('\n');
  }
}

export default LeakageControlledBacktest;
