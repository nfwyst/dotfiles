/**
 * 回测引擎 - Backtest Engine (优化版)
 * 用于验证和优化 OCS 策略
 * 
 * 性能优化：
 * 1. 预计算所有技术指标到 Float64Array
 * 2. 预计算 OCS Layer1/Layer2 特征
 * 3. 批量初始化 Layer3 历史数据
 * 4. 主循环 O(1) 查询代替 O(n) 重复计算
 */

import * as fs from 'fs';
import * as path from 'path';
import { TechnicalIndicators, OHLCV, TechnicalAnalysisModule } from './src/modules/technicalAnalysis';
import { StrategyEngineModule, StrategySignal, StrategyContext } from './src/modules/strategyEngine';
import SLTPCalculator from './src/modules/slTpCalculator';
import { OCSLayer1 } from './src/ocs/layer1';
import { OCSLayer2 } from './src/ocs/layer2';
import { OCSLayer3 } from './src/ocs/layer3';
import { OCSLayer4 } from './src/ocs/layer4';
import { OCSEnhanced } from './src/ocs/enhanced';
import { OCSLayer2 } from './src/ocs/layer2';
import { OCSLayer3 } from './src/ocs/layer3';
interface BacktestConfig {
  symbol: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  positionSize: number;  // 仓位比例 (0-1)
  leverage: number;
  feeRate: number;       // 手续费率
  slippage: number;      // 滑点
}

interface Trade {
  entryTime: number;
  exitTime: number;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfits: { tp1: number; tp2: number; tp3: number };
  size: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
  holdingBars: number;
}

interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  stats: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalReturn: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    avgHoldingBars: number;
    gtScore: number;
  };
  equityCurve: number[];
  drawdownCurve: number[];
}

class BacktestEngine {
  private config: BacktestConfig;
  private ohlcv: OHLCV[] = [];
  private balance: number = 0;
  private equity: number = 0;
  private equityCurve: number[] = [];
  private trades: Trade[] = [];
  private position: {
    side: 'long' | 'short' | null;
    entryPrice: number;
    entryTime: number;
    size: number;
    stopLoss: number;
    takeProfits: { tp1: number; tp2: number; tp3: number };
    tp1Hit: boolean;
    tp2Hit: boolean;
  } | null = null;
  
  // OCS Layers (用于预计算)
  private ocsLayer1: OCSLayer1;
  private ocsLayer2: OCSLayer2;
  private ocsLayer3: OCSLayer3;
  private ocsLayer4: OCSLayer4;
  private ocsEnhanced: OCSEnhanced;
  private sltpCalculator: SLTPCalculator;
  
  // 预计算数据存储
  private precomputedIndicators: Map<number, TechnicalIndicators> = new Map();
  private precomputedLayer1: any[] = [];
  private precomputedLayer2: any[] = [];
  private precomputedFeatures3D: number[][] = [];
  
  private strategyEngine: StrategyEngineModule;
  private ta: TechnicalAnalysisModule;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.balance = config.initialBalance;
    this.equity = config.initialBalance;
    this.strategyEngine = new StrategyEngineModule('ocs');
    this.ta = new TechnicalAnalysisModule();
    this.ocsLayer1 = new OCSLayer1();
    this.ocsLayer2 = new OCSLayer2();
    this.ocsLayer3 = new OCSLayer3();
    this.ocsLayer4 = new OCSLayer4();
    this.ocsEnhanced = new OCSEnhanced();
    this.sltpCalculator = new SLTPCalculator();
  }

  /**
   * 加载历史数据
   */
  async loadData(): Promise<void> {
    const cacheFile = path.join(
      process.cwd(),
      'backtest-cache',
      `${this.config.symbol}-${this.config.timeframe}-2025-11-29-2026-02-27.json`
    );

    if (!fs.existsSync(cacheFile)) {
      throw new Error(`No cached data found: ${cacheFile}`);
    }

    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    this.ohlcv = data.ohlcv || data;
    
    // 确保数据按时间排序
    this.ohlcv.sort((a: OHLCV, b: OHLCV) => a.timestamp - b.timestamp);
    
    // 过滤日期范围
    const startTs = this.config.startDate.getTime();
    const endTs = this.config.endDate.getTime();
    this.ohlcv = this.ohlcv.filter((c: OHLCV) => c.timestamp >= startTs && c.timestamp <= endTs);
    
    console.log(`✅ 加载 ${this.ohlcv.length} 根K线数据`);
  }

  /**
   * 预计算所有指标和OCS特征 (性能优化关键)
   */
  private precomputeAll(): void {
    console.log('\n⚡ 预计算指标和OCS特征...');
    const startPrecompute = Date.now();
    
    const closes = this.ohlcv.map(c => c.close);
    const highs = this.ohlcv.map(c => c.high);
    const lows = this.ohlcv.map(c => c.low);
    const volumes = this.ohlcv.map(c => c.volume);
    
    // 预计算技术指标
    const sma20 = this.computeSMA(closes, 20);
    const sma50 = this.computeSMA(closes, 50);
    const sma200 = this.computeSMA(closes, 200);
    const ema12 = this.computeEMA(closes, 12);
    const ema26 = this.computeEMA(closes, 26);
    const ema50 = this.computeEMA(closes, 50);
    
    // RSI
    const rsi14 = this.computeRSI(closes, 14);
    
    // MACD
    const macd = this.computeMACD(closes, 12, 26, 9);
    
    // Bollinger
    const bollinger = this.computeBollinger(closes, 20, 2);
    
    // ATR
    const atr14 = this.computeATR(highs, lows, closes, 14);
    
    // 预计算OCS Layer1 和 Layer2
    const lookback = 50;
    for (let i = lookback; i < this.ohlcv.length; i++) {
      const slice = this.ohlcv.slice(0, i);
      
      const l1 = this.ocsLayer1.process(slice);
      this.precomputedLayer1.push(l1);
      
      const l2 = this.ocsLayer2.process(
        l1,
        slice.map(s => s.close),
        slice.map(s => s.volume)
      );
      this.precomputedLayer2.push(l2);
      this.precomputedFeatures3D.push(l2.features3D);
    }
    
    // 初始化 Layer3
    const ohlcvFromLookback = this.ohlcv.slice(lookback);
    this.ocsLayer3.initializeFromHistory(ohlcvFromLookback, this.precomputedFeatures3D);
    
    // 存储预计算指标到 Map
    for (let i = 200; i < this.ohlcv.length; i++) {
      const idx = i - 200;
      this.precomputedIndicators.set(i, {
        sma: { 20: sma20[i], 50: sma50[i], 200: sma200[i] },
        ema: { 12: ema12[i], 26: ema26[i], 50: ema50[i] },
        rsi: { 14: rsi14[i] },
        macd: {
          line: macd.line[i],
          signal: macd.signal[i],
          histogram: macd.histogram[i]
        },
        bollinger: {
          upper: bollinger.upper[i],
          middle: bollinger.middle[i],
          lower: bollinger.lower[i]
        },
        atr: { 14: atr14[i] }
      });
    }
    
    console.log(`   ✅ 预计算完成 (${((Date.now() - startPrecompute) / 1000).toFixed(1)}秒)`);
  }

  // 技术指标计算方法
  private computeSMA(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(0);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      if (i >= period) sum -= data[i - period];
      if (i >= period - 1) result[i] = sum / period;
    }
    return result;
  }

  private computeEMA(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(0);
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = 0; i < data.length; i++) {
      if (i >= period - 1) {
        ema = (data[i] - ema) * multiplier + ema;
        result[i] = ema;
      }
    }
    return result;
  }

  private computeRSI(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(50);
    let gains = 0, losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = period; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(0, change)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(0, -change)) / period;
      
      if (avgLoss === 0) result[i] = 100;
      else result[i] = 100 - (100 / (1 + avgGain / avgLoss));
    }
    return result;
  }

  private computeMACD(data: number[], fast: number, slow: number, signal: number): { line: number[]; signal: number[]; histogram: number[] } {
    const emaFast = this.computeEMA(data, fast);
    const emaSlow = this.computeEMA(data, slow);
    const line = emaFast.map((f, i) => f - emaSlow[i]);
    const signalLine = this.computeEMA(line.filter(l => l !== 0), signal);
    
    const signalPadded: number[] = [];
    let sigIdx = 0;
    for (let i = 0; i < data.length; i++) {
      if (line[i] !== 0 && sigIdx < signalLine.length) {
        signalPadded.push(signalLine[sigIdx++]);
      } else {
        signalPadded.push(0);
      }
    }
    
    return {
      line,
      signal: signalPadded,
      histogram: line.map((l, i) => l - signalPadded[i])
    };
  }

  private computeBollinger(data: number[], period: number, stdDev: number): { upper: number[]; middle: number[]; lower: number[] } {
    const middle = this.computeSMA(data, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i >= period - 1) {
        const slice = data.slice(i - period + 1, i + 1);
        const mean = middle[i];
        const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        upper.push(mean + stdDev * std);
        lower.push(mean - stdDev * std);
      } else {
        upper.push(0);
        lower.push(0);
      }
    }
    return { upper, middle, lower };
  }

  private computeATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const tr: number[] = [0];
    for (let i = 1; i < highs.length; i++) {
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - closes[i - 1]);
      const lc = Math.abs(lows[i] - closes[i - 1]);
      tr.push(Math.max(hl, hc, lc));
    }
    return this.computeSMA(tr, period);
  }

  /**
   * 运行回测 (优化版)
   */
  async run(): Promise<BacktestResult> {
    console.log('\n🚀 开始回测...');
    console.log(`   时间范围: ${new Date(this.ohlcv[0].timestamp).toLocaleDateString()} - ${new Date(this.ohlcv[this.ohlcv.length - 1].timestamp).toLocaleDateString()}`);
    console.log(`   初始资金: $${this.config.initialBalance.toLocaleString()}`);

    // 预计算所有指标和OCS特征
    this.precomputeAll();

    const lookback = 200;
    const ocsLookback = 50;

    for (let i = lookback; i < this.ohlcv.length; i++) {
      const currentCandle = this.ohlcv[i];

      // 检查当前持仓
      if (this.position) {
        this.checkPosition(currentCandle, i);
      }

      // 如果没有持仓，生成信号
      if (!this.position) {
        const indicators = this.precomputedIndicators.get(i);
        if (!indicators) continue;

        // 使用预计算的OCS特征生成信号
        const ocsIndex = i - ocsLookback;
        const l1 = this.precomputedLayer1[ocsIndex];
        const l2 = this.precomputedLayer2[ocsIndex];
        
        // 从预计算数据构建信号
        const signal = this.generateSignalFromPrecomputed(indicators, l2, currentCandle.close, i);
        
        if (signal && signal.type !== 'hold' && signal.confidence >= 0.6) {
          const sma20 = indicators.sma[20];
          const sma50 = indicators.sma[50];
          const isTrendUp = sma20 > sma50;
          const isTrendDown = sma20 < sma50;
          
          const isTrendAligned = 
            (signal.type === 'long' && isTrendUp) || 
            (signal.type === 'short' && isTrendDown);
          
          const confidenceThreshold = isTrendAligned ? 0.5 : 0.8;
          
          if (signal.confidence >= confidenceThreshold) {
            console.log(`  📊 趋势: ${isTrendUp ? '↑上涨' : '↓下跌'} | 信号: ${signal.type} | 置信度: ${signal.confidence.toFixed(2)} | 阈值: ${confidenceThreshold}`);
            this.openPosition(signal, currentCandle, i);
          } else {
            console.log(`  ⏭️ 信号被趋势过滤: ${signal.type} 置信度${signal.confidence.toFixed(2)} < ${confidenceThreshold}`);
          }
        }
      }
      // 记录权益曲线
      this.equity = this.calculateEquity(currentCandle.close);
      this.equityCurve.push(this.equity);
    }

    // 平掉最后的持仓
    if (this.position) {
      const lastCandle = this.ohlcv[this.ohlcv.length - 1];
      this.closePosition(lastCandle, 'end_of_test', this.ohlcv.length - 1);
    }

    return this.generateResult();
  }

  /**
   * 从预计算数据生成信号 (优化版)
   */
  private generateSignalFromPrecomputed(
    indicators: TechnicalIndicators,
    l2Output: any,
    currentPrice: number,
    index: number
  ): StrategySignal | null {

    // 使用预计算的 Layer2 输出
    const ohlcvSlice = this.ohlcv.slice(0, index + 1);
    const closePrices = ohlcvSlice.map(h => h.close);
    
    // Layer3 - 使用 close 数组
    const l3 = this.ocsLayer3.process(l2Output.features3D, closePrices);
    
    // Enhanced 增强
    const enhancedOutput = this.ocsEnhanced.enhance(ohlcvSlice, l2Output, l3);
    
    // Layer4 - 最终信号
    const l4 = this.ocsLayer4.process(
      l3,
      currentPrice,
      indicators.atr[14],
      false, // hasPosition
      this.balance,
      enhancedOutput.combinedSignal
    );
    
    // 如果 Layer4 没有信号，返回 hold
    if (l4.signal === 'hold' || !l4.setup) {
      return { type: 'hold', confidence: 0 };
    }
    
    const finalDirection = l4.setup.direction;
    const finalConfidence = l3.signal !== 'hold'
      ? l3.confidence / 100
      : enhancedOutput.combinedSignal.confidence / 100;
    
    // 使用 SLTPCalculator
    const highs = ohlcvSlice.map(h => h.high);
    const lows = ohlcvSlice.map(h => h.low);
    
    const sltp = this.sltpCalculator.calculate(
      finalDirection,
      l4.setup.entryPrice,
      highs,
      lows,
      ohlcvSlice.length - 1
    );
    
    return {
      type: finalDirection === 'long' ? 'long' : 'short',
      entryPrice: l4.setup.entryPrice,
      stopLoss: sltp?.stopLoss || (finalDirection === 'long' ? currentPrice - 2 * indicators.atr[14] : currentPrice + 2 * indicators.atr[14]),
      takeProfits: sltp?.takeProfits || {
        tp1: finalDirection === 'long' ? currentPrice + indicators.atr[14] : currentPrice - indicators.atr[14],
        tp2: finalDirection === 'long' ? currentPrice + 2 * indicators.atr[14] : currentPrice - 2 * indicators.atr[14],
        tp3: finalDirection === 'long' ? currentPrice + 3 * indicators.atr[14] : currentPrice - 3 * indicators.atr[14]
      },
      confidence: finalConfidence,
      reason: `Layer4: ${l4.reason}`
    };
  }

  /**
   * 检查持仓止盈止损
   */
  private checkPosition(candle: OHLCV, index: number): void {
    if (!this.position) return;

    const { side, entryPrice, stopLoss, takeProfits, tp1Hit, tp2Hit } = this.position;

    if (side === 'long') {
      // 检查止损
      if (candle.low <= stopLoss) {
        this.closePosition(candle, 'stop_loss', index);
        return;
      }
      // 检查止盈1
      if (!tp1Hit && candle.high >= takeProfits.tp1) {
        this.closePosition(candle, 'tp1', index);
        return;
      }
      // 检查止盈2
      if (!tp2Hit && candle.high >= takeProfits.tp2) {
        this.closePosition(candle, 'tp2', index);
        return;
      }
      // 检查止盈3
      if (candle.high >= takeProfits.tp3) {
        this.closePosition(candle, 'tp3', index);
        return;
      }
    } else if (side === 'short') {
      // 检查止损
      if (candle.high >= stopLoss) {
        this.closePosition(candle, 'stop_loss', index);
        return;
      }
      // 检查止盈
      if (!tp1Hit && candle.low <= takeProfits.tp1) {
        this.closePosition(candle, 'tp1', index);
        return;
      }
      if (!tp2Hit && candle.low <= takeProfits.tp2) {
        this.closePosition(candle, 'tp2', index);
        return;
      }
      if (candle.low <= takeProfits.tp3) {
        this.closePosition(candle, 'tp3', index);
        return;
      }
    }
  }

  /**
   * 开仓
   */
  private openPosition(signal: StrategySignal, candle: OHLCV, index: number): void {
    const { type, entryPrice, stopLoss, takeProfits } = signal;
    
    // 计算仓位大小
    const positionValue = this.balance * this.config.positionSize * this.config.leverage;
    const size = positionValue / candle.close;

    // 计算滑点和手续费
    const slippageCost = candle.close * this.config.slippage;
    const actualEntryPrice = type === 'long' 
      ? candle.close + slippageCost 
      : candle.close - slippageCost;
    const fee = positionValue * this.config.feeRate;

    this.balance -= fee;

    this.position = {
      side: type,
      entryPrice: actualEntryPrice,
      entryTime: candle.timestamp,
      size,
      stopLoss: stopLoss,
      takeProfits: takeProfits!,
      tp1Hit: false,
      tp2Hit: false
    };

    console.log(`   [${new Date(candle.timestamp).toLocaleString()}] 开仓 ${type.toUpperCase()} @ ${actualEntryPrice.toFixed(2)}`);
  }

  /**
   * 平仓
   */
  private closePosition(candle: OHLCV, reason: string, index: number): void {
    if (!this.position) return;

    const { side, entryPrice, entryTime, size, stopLoss, takeProfits } = this.position;

    let exitPrice = candle.close;
    let partialClose = false;

    // 根据退出原因确定退出价格
    if (reason === 'stop_loss') {
      exitPrice = side === 'long' ? stopLoss : stopLoss;
    } else if (reason === 'tp1') {
      exitPrice = takeProfits.tp1;
      partialClose = true;
      this.position.tp1Hit = true;
    } else if (reason === 'tp2') {
      exitPrice = takeProfits.tp2;
      partialClose = true;
      this.position.tp2Hit = true;
    } else if (reason === 'tp3') {
      exitPrice = takeProfits.tp3;
    }

    // 计算滑点和手续费
    const slippageCost = exitPrice * this.config.slippage;
    const actualExitPrice = side === 'long'
      ? exitPrice - slippageCost
      : exitPrice + slippageCost;
    
    const positionValue = size * actualExitPrice;
    const fee = positionValue * this.config.feeRate;

    // 计算盈亏
    let pnl: number;
    if (side === 'long') {
      pnl = (actualExitPrice - entryPrice) * size - fee;
    } else {
      pnl = (entryPrice - actualExitPrice) * size - fee;
    }

    const pnlPercent = (pnl / this.balance) * 100;
    this.balance += pnl;

    const trade: Trade = {
      entryTime,
      exitTime: candle.timestamp,
      side,
      entryPrice,
      exitPrice: actualExitPrice,
      stopLoss,
      takeProfits,
      size,
      pnl,
      pnlPercent,
      exitReason: reason,
      holdingBars: index - this.ohlcv.findIndex(c => c.timestamp === entryTime)
    };

    this.trades.push(trade);

    const pnlStr = pnl >= 0 ? `+${pnl.toFixed(2)}` : `${pnl.toFixed(2)}`;
    console.log(`   [${new Date(candle.timestamp).toLocaleString()}] 平仓 ${reason} @ ${actualExitPrice.toFixed(2)} | PnL: ${pnlStr}`);

    // 如果是部分止盈，继续持有剩余仓位
    if (partialClose) {
      this.position.size *= 0.5; // 简化处理：每次止盈平掉一半
    } else {
      this.position = null;
    }
  }

  /**
   * 计算当前权益
   */
  private calculateEquity(currentPrice: number): number {
    if (!this.position) return this.balance;

    const { side, entryPrice, size } = this.position;
    const unrealizedPnl = side === 'long'
      ? (currentPrice - entryPrice) * size
      : (entryPrice - currentPrice) * size;

    return this.balance + unrealizedPnl;
  }

  /**
   * 生成回测结果
   */
  private generateResult(): BacktestResult {
    const winningTrades = this.trades.filter(t => t.pnl > 0);
    const losingTrades = this.trades.filter(t => t.pnl < 0);

    const totalWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    // 计算最大回撤
    let maxEquity = this.config.initialBalance;
    let maxDrawdown = 0;
    const drawdownCurve: number[] = [];

    for (const equity of this.equityCurve) {
      if (equity > maxEquity) maxEquity = equity;
      const drawdown = (maxEquity - equity) / maxEquity * 100;
      drawdownCurve.push(drawdown);
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // 计算Sharpe比率
    const returns = this.equityCurve.slice(1).map((e, i) => 
      (e - this.equityCurve[i]) / this.equityCurve[i]
    );
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252 * 288) : 0; // 年化

    // GT Score
    const gtScore = sharpeRatio * (1 - maxDrawdown / 100) * 10;

    const stats = {
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0,
      totalReturn: this.balance - this.config.initialBalance,
      totalReturnPercent: ((this.balance - this.config.initialBalance) / this.config.initialBalance) * 100,
      maxDrawdown,
      maxDrawdownPercent: maxDrawdown,
      sharpeRatio,
      profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
      avgWin: winningTrades.length > 0 ? totalWin / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0,
      avgHoldingBars: this.trades.length > 0 
        ? this.trades.reduce((sum, t) => sum + t.holdingBars, 0) / this.trades.length 
        : 0,
      gtScore
    };

    return {
      config: this.config,
      trades: this.trades,
      stats,
      equityCurve: this.equityCurve,
      drawdownCurve
    };
  }

  /**
   * 保存结果
   */
  saveResult(result: BacktestResult): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(process.cwd(), 'backtest-reports', `ocs-backtest-${timestamp}.json`);

    // 确保目录存在
    if (!fs.existsSync(path.dirname(reportFile))) {
      fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    }

    fs.writeFileSync(reportFile, JSON.stringify(result, null, 2));
    console.log(`\n📄 报告已保存: ${reportFile}`);
  }

  /**
   * 打印结果摘要
   */
  printSummary(result: BacktestResult): void {
    const { stats } = result;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 回测结果摘要');
    console.log('='.repeat(60));
    console.log(`\n📈 交易统计:`);
    console.log(`   总交易次数: ${stats.totalTrades}`);
    console.log(`   胜率: ${stats.winRate.toFixed(2)}%`);
    console.log(`   盈利交易: ${stats.winningTrades} | 亏损交易: ${stats.losingTrades}`);
    
    console.log(`\n💰 收益统计:`);
    console.log(`   总收益: $${stats.totalReturn.toFixed(2)} (${stats.totalReturnPercent >= 0 ? '+' : ''}${stats.totalReturnPercent.toFixed(2)}%)`);
    console.log(`   最大回撤: ${stats.maxDrawdown.toFixed(2)}%`);
    console.log(`   盈利因子: ${stats.profitFactor.toFixed(2)}`);
    
    console.log(`\n📊 风险指标:`);
    console.log(`   Sharpe比率: ${stats.sharpeRatio.toFixed(2)}`);
    console.log(`   GT Score: ${stats.gtScore.toFixed(2)}`);
    
    console.log(`\n📉 交易详情:`);
    console.log(`   平均盈利: $${stats.avgWin.toFixed(2)}`);
    console.log(`   平均亏损: $${stats.avgLoss.toFixed(2)}`);
    console.log(`   最大盈利: $${stats.largestWin.toFixed(2)}`);
    console.log(`   最大亏损: $${stats.largestLoss.toFixed(2)}`);
    console.log(`   平均持仓: ${stats.avgHoldingBars.toFixed(0)} 根K线`);
    console.log('='.repeat(60));
  }
}

// 主函数
async function main() {
  const config: BacktestConfig = {
    symbol: 'ETHUSDT',
    timeframe: '5m',
    startDate: new Date('2026-02-20'),  // 7天回测
    endDate: new Date('2026-02-27'),
    initialBalance: 10000,
    positionSize: 0.1,   // 10%仓位
    leverage: 1,         // 1倍杠杆
    feeRate: 0.0006,     // 0.06% 手续费
    slippage: 0.0001     // 0.01% 滑点
  };

  const engine = new BacktestEngine(config);

  try {
    await engine.loadData();
    const result = await engine.run();
    engine.printSummary(result);
    engine.saveResult(result);
  } catch (error) {
    console.error('❌ 回测失败:', error);
    process.exit(1);
  }
}

main();
