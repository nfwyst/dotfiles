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
import { TechnicalIndicators, TechnicalAnalysisModule } from './src/modules/technicalAnalysis';
import type { OHLCV } from './src/events/types';
import { StrategyEngineModule, StrategySignal, StrategyContext } from './src/modules/strategyEngine';
import SLTPCalculator from './src/modules/slTpCalculator';
import { OCSLayer1 } from './src/ocs/layer1';
import { OCSLayer2 } from './src/ocs/layer2';
import { OCSLayer3 } from './src/ocs/layer3';
import { OCSLayer4 } from './src/ocs/layer4';
import { OCSEnhanced } from './src/ocs/enhanced';
import { calculatePositionSize } from './src/risk/positionSizing';
// FIX L2: Removed duplicate imports of OCSLayer2 and OCSLayer3 that were at lines 22-23

// FIX H4: Crypto trades 365 days/year, not 252 (equity markets)
export const CRYPTO_TRADING_DAYS = 365;

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

export interface BacktestConfig {
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

export interface Trade {
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

export interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  stats: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalReturn: number;
    totalReturnPercent: number;
    annualizedReturnPercent: number; // FIX H5: CAGR
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

export class BacktestEngine {
  private config: BacktestConfig;
  private ohlcv: OHLCV[] = [];

  /** Expose loaded OHLCV data for external consumers (e.g. Phase B/C) */
  getOhlcv(): OHLCV[] { return this.ohlcv; }
  private balance: number = 0;
  private equity: number = 0;
  private equityCurve: number[] = [];
  private trades: Trade[] = [];
  private position: {
    side: 'long' | 'short' | null;
    entryPrice: number;
    entryTime: number;
    entryBarIndex: number; // BUG 10 FIX: Store entry bar index directly
    size: number;
    stopLoss: number;
    takeProfits: { tp1: number; tp2: number; tp3: number };
    tp1Hit: boolean;
    tp2Hit: boolean;
  } | null = null;
  
  // FIX C3: Pending signal queue for next-bar execution
  private pendingSignal: { signal: StrategySignal; barIndex: number } | null = null;

  // FIX 2: Max Drawdown Circuit Breaker state
  private peakEquity: number = 0;
  private circuitBreakerActive: boolean = false;
  private circuitBreakerCooldownEnd: number = 0;

  // Track CB triggers for escalating cooldown
  private cbTriggerCount: number = 0;


  // FIX: Daily loss limit — prevents cascading intraday losses from compounding drawdown
  private dailyLossLimit: number = 0.04; // 4% of day's starting equity
  private currentDayStartTs: number = 0;
  private dailyStartEquity: number = 0;
  private dailyLossLimitHit: boolean = false;

  // Consecutive loss limiter — pause trading after N consecutive losses
  private consecutiveLosses: number = 0;
  private consecutiveLossPauseEnd: number = 0;

  // Trade cooldown: prevent re-entry immediately after closing a position
  private lastCloseBarIndex: number = -999;
  private tradeCooldownBars: number = 18; // 18 bars = 1.5 hours on 5m timeframe (reduce churn)

  // OCS Layers (用于预计算)
  private ocsLayer1: OCSLayer1;
  private ocsLayer2: OCSLayer2;
  private ocsLayer3: OCSLayer3;
  private ocsLayer4: OCSLayer4;
  private ocsEnhanced: OCSEnhanced;
  private sltpCalculator: SLTPCalculator;
  
  // 预计算数据存储
  // Pre-extracted arrays (computed once in precomputeAll, reused in signal generation)
  private allCloses: number[] = [];
  private allHighs: number[] = [];
  private allLows: number[] = [];
  private allVolumes: number[] = [];

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
    // FIX 4: Initialize peakEquity from initial balance
    this.peakEquity = config.initialBalance;
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
  /**
   * Build a descriptive cache filename from actual date range.
   */
  private getCacheFile(): string {
    const startStr = this.config.startDate.toISOString().split('T')[0];
    const endStr   = this.config.endDate.toISOString().split('T')[0];
    return path.join(
      process.cwd(),
      'backtest-cache',
      `${this.config.symbol}-${this.config.timeframe}-${startStr}-${endStr}.json`
    );
  }

  /**
   * Fetch OHLCV from Binance public API (no API key required).
   * Handles pagination: Binance limits 1500 candles per request.
   */
  private async fetchFromBinance(): Promise<OHLCV[]> {
    const BASE = 'https://fapi.binance.com';
    const symbol = this.config.symbol;          // e.g. 'ETHUSDT'
    const interval = this.config.timeframe;     // e.g. '5m'
    const startTs = this.config.startDate.getTime();
    const endTs   = this.config.endDate.getTime();
    const LIMIT   = 1500;

    let allCandles: OHLCV[] = [];
    let currentStart = startTs;

    console.log(`📡 正在从 Binance 获取 ${symbol} ${interval} 数据 ...`);

    while (currentStart < endTs) {
      const url = `${BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStart}&endTime=${endTs}&limit=${LIMIT}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Binance API error: ${res.status} ${res.statusText}`);
      }

      const raw: any[] = await res.json();
      if (raw.length === 0) break;

      for (const k of raw) {
        allCandles.push({
          timestamp: k[0],
          open:   parseFloat(k[1]),
          high:   parseFloat(k[2]),
          low:    parseFloat(k[3]),
          close:  parseFloat(k[4]),
          volume: parseFloat(k[5]),
        });
      }

      // Move past the last candle's open time to avoid duplicates
      currentStart = raw[raw.length - 1][0] + 1;

      // Rate-limit politeness
      if (raw.length === LIMIT) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log(`   📥 获取到 ${allCandles.length} 根K线`);
    return allCandles;
  }

  /**
   * Load historical data — reads from cache if available, otherwise
   * auto-fetches from Binance public API and saves to cache.
   */
  async loadData(): Promise<void> {
    const cacheFile = this.getCacheFile();
    const cacheDir  = path.dirname(cacheFile);

    if (fs.existsSync(cacheFile)) {
      // ── Cache hit ──
      console.log(`📂 读取缓存: ${path.basename(cacheFile)}`);
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      this.ohlcv = data.ohlcv || data;
    } else {
      // ── Cache miss → fetch from Binance ──
      this.ohlcv = await this.fetchFromBinance();

      // Save to cache for next run
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(cacheFile, JSON.stringify(this.ohlcv, null, 2));
      console.log(`   💾 已缓存至 ${path.basename(cacheFile)}`);
    }

    // Sort by time
    this.ohlcv.sort((a: OHLCV, b: OHLCV) => a.timestamp - b.timestamp);

    // Filter to requested date range (cache may contain wider window)
    const startTs = this.config.startDate.getTime();
    const endTs   = this.config.endDate.getTime();
    this.ohlcv = this.ohlcv.filter((c: OHLCV) => c.timestamp >= startTs && c.timestamp <= endTs);

    if (this.ohlcv.length === 0) {
      throw new Error(
        `No candle data in range ${this.config.startDate.toISOString()} – ${this.config.endDate.toISOString()}. ` +
        `Delete cache and retry, or check your date range.`
      );
    }

    console.log(`✅ 加载 ${this.ohlcv.length} 根K线 (${this.config.startDate.toISOString().split('T')[0]} → ${this.config.endDate.toISOString().split('T')[0]})`);
  }

  /**
   * 预计算所有指标和OCS特征 (性能优化版)
   * 
   * Key optimization: Use a fixed sliding window (WINDOW_SIZE bars) instead
   * of slice(0, i) which grows linearly. This reduces O(n²) to O(n).
   * 
   * Layer1 and Layer2 are stateful (LMS weights, Supertrend, z-score history
   * accumulate across calls), so we still iterate every bar — but each iteration
   * only copies a fixed-size window instead of the entire history.
   */
  private precomputeAll(): void {
    console.log('\n⚡ 预计算指标和OCS特征...');
    const startPrecompute = Date.now();
    
    // Pre-extract full arrays ONCE and store as instance variables
    // These are reused in generateSignalFromPrecomputed to avoid OHLCV slice allocations
    this.allCloses = this.ohlcv.map(c => c.close);
    this.allHighs = this.ohlcv.map(c => c.high);
    this.allLows = this.ohlcv.map(c => c.low);
    this.allVolumes = this.ohlcv.map(c => c.volume);
    const allCloses = this.allCloses;
    const allHighs = this.allHighs;
    const allLows = this.allLows;
    const allVolumes = this.allVolumes;
    
    const lookback = 50;
    // Fixed window: 300 bars is enough for all indicators (Ehlers needs 100,
    // AMA benefits from ~200, 300 gives comfortable margin)
    const WINDOW_SIZE = 300;

    // Progress logging for long runs
    const totalBars = this.ohlcv.length - lookback;
    let lastProgressLog = Date.now();
    
    // 预计算OCS Layer1 和 Layer2 with sliding window
    for (let i = lookback; i < this.ohlcv.length; i++) {
      // Sliding window: take the last WINDOW_SIZE bars up to index i
      const windowStart = Math.max(0, i - WINDOW_SIZE);
      const ohlcvWindow = this.ohlcv.slice(windowStart, i);
      const closesWindow = allCloses.slice(windowStart, i);
      const volumesWindow = allVolumes.slice(windowStart, i);
      
      const l1 = this.ocsLayer1.process(ohlcvWindow);
      const l2 = this.ocsLayer2.process(l1, closesWindow, volumesWindow);
      
      this.precomputedLayer1.push(l1);
      this.precomputedLayer2.push(l2);
      this.precomputedFeatures3D.push(l2.features3D);

      // Log progress every 10 seconds
      const now = Date.now();
      if (now - lastProgressLog > 10000) {
        const progress = ((i - lookback) / totalBars * 100).toFixed(1);
        const elapsed = ((now - startPrecompute) / 1000).toFixed(0);
        const rate = Math.round((i - lookback) / ((now - startPrecompute) / 1000));
        const eta = Math.round((totalBars - (i - lookback)) / rate);
        console.log(`   ⏳ 进度: ${progress}% (${i - lookback}/${totalBars}) | ${elapsed}s | ${rate} bars/s | ETA: ${eta}s`);
        lastProgressLog = now;
      }
    }
    
    // FIX P1: Pass full ohlcv with offset=lookback so features3D[i] correctly maps to ohlcv[lookback + i]
    this.ocsLayer3.initializeFromHistory(this.ohlcv, this.precomputedFeatures3D, lookback);
    
    // 预计算技术指标 (these use the full pre-extracted arrays — already O(n))
    const sma20 = this.computeSMA(allCloses, 20);
    const sma50 = this.computeSMA(allCloses, 50);
    const sma200 = this.computeSMA(allCloses, 200);
    const ema12 = this.computeEMA(allCloses, 12);
    const ema26 = this.computeEMA(allCloses, 26);
    const ema50 = this.computeEMA(allCloses, 50);
    const rsi14 = this.computeRSI(allCloses, 14);
    const macd = this.computeMACD(allCloses, 12, 26, 9);
    const bollinger = this.computeBollinger(allCloses, 20, 2);
    const atr14 = this.computeATR(allHighs, allLows, allCloses, 14);
    
    // 存储预计算指标到 Map
    for (let i = 200; i < this.ohlcv.length; i++) {
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

  // BUG 12 FIX: Seed EMA with SMA of first `period` elements instead of zeros
  private computeEMA(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(0);
    if (data.length < period) return result;
    const multiplier = 2 / (period + 1);
    // Seed with SMA of first `period` elements
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result[period - 1] = ema;
    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
      result[i] = ema;
    }
    return result;
  }

  // BUG 4 FIX: RSI seeding loop runs i=1..period (inclusive), smoothing loop
  // must start at i = period + 1 to avoid double-counting the change at index period.
  private computeRSI(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(50);
    if (data.length <= period) return result;
    let gains = 0, losses = 0;
    
    // Seeding: accumulate changes for i = 1 to period (inclusive)
    for (let i = 1; i <= period; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Set the RSI at index `period`
    if (avgLoss === 0) result[period] = 100;
    else result[period] = 100 - (100 / (1 + avgGain / avgLoss));
    
    // BUG 4 FIX: Start smoothing at period + 1 instead of period
    for (let i = period + 1; i < data.length; i++) {
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
    // FIX C2: Compute signal EMA directly on the full MACD line to preserve temporal alignment.
    // The old code used filter(l => l !== 0) which destroyed index correspondence (lookahead bias).
    const signalLine = this.computeEMA(line, signal);

    // FIX C2: signalLine already has correct length and alignment, no padding needed.

    return {
      line,
      signal: signalLine,
      histogram: line.map((l, i) => l - signalLine[i])
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

      // ── Daily loss limit: reset on new day, check cumulative loss ──
      const currentDayTs = new Date(currentCandle.timestamp);
      currentDayTs.setUTCHours(0, 0, 0, 0);
      const dayStartMs = currentDayTs.getTime();
      if (dayStartMs !== this.currentDayStartTs) {
        // New calendar day — reset daily tracking
        this.currentDayStartTs = dayStartMs;
        this.dailyStartEquity = this.equity;
        this.dailyLossLimitHit = false;
      }
      // Check if daily loss limit breached
      if (!this.dailyLossLimitHit && this.dailyStartEquity > 0) {
        const dailyReturn = (this.equity - this.dailyStartEquity) / this.dailyStartEquity;
        if (dailyReturn < -this.dailyLossLimit) {
          this.dailyLossLimitHit = true;
          // Force-close on daily loss limit breach to prevent further damage
          if (this.position) {
            console.log(`  🛑 日内止损: 强制平仓`);
            this.closePosition(currentCandle, 'daily_loss_limit', i);
          }
          console.log(`  🛑 日内止损触发: 当日亏损 ${(dailyReturn * 100).toFixed(2)}% > ${(this.dailyLossLimit * 100).toFixed(1)}% 限制, 暂停开仓至次日`);
        }
      }

      // ── Circuit breaker: check FIRST before position management ──
      // Compute unrealized equity to detect drawdown with open positions
      const preCheckEquity = this.calculateEquity(currentCandle.close);
      if (preCheckEquity > this.peakEquity) this.peakEquity = preCheckEquity;
      const currentDrawdown = (this.peakEquity - preCheckEquity) / this.peakEquity;

      // Trigger circuit breaker at 10% drawdown — force-close IMMEDIATELY
      if (currentDrawdown > 0.10 && !this.circuitBreakerActive) {
        this.circuitBreakerActive = true;
        this.cbTriggerCount++;
        // Escalating cooldown: 1st=1500 bars (~5d), 2nd=3000 (~10d), 3rd+=4000 (~14d)
        const cooldownBars = Math.min(4000, 1500 * this.cbTriggerCount);
        this.circuitBreakerCooldownEnd = i + cooldownBars;
        if (this.position) {
          console.log(`  🔴 熔断器: 强制平仓以阻止回撤扩大`);
          this.closePosition(currentCandle, 'circuit_breaker', i);
        }
        if (this.pendingSignal) this.pendingSignal = null;
        console.log(`  🔴 熔断器触发 (#${this.cbTriggerCount}): 回撤 ${(currentDrawdown * 100).toFixed(1)}% > 10%, 暂停 ${cooldownBars} bars`);
      }
      if (this.circuitBreakerActive && i >= this.circuitBreakerCooldownEnd) {
        this.circuitBreakerActive = false;
        this.peakEquity = this.calculateEquity(currentCandle.close); // Reset peak
        // cbTriggerCount stays — escalating cooldown persists across CB events
        console.log(`  🟢 熔断器解除: 重置基准权益为 $${this.peakEquity.toFixed(2)}`);
      }

      // 检查当前持仓 (SL/TP checks)
      if (this.position) {
        this.checkPosition(currentCandle, i);
      }

      // FIX C3: Execute pending signal at current bar's OPEN price (next-bar execution)
      if (this.pendingSignal && !this.position && !this.circuitBreakerActive && !this.dailyLossLimitHit && i >= this.consecutiveLossPauseEnd && (i - this.lastCloseBarIndex) >= this.tradeCooldownBars) {
        this.openPosition(this.pendingSignal.signal, currentCandle, i, true); // useOpen=true
        this.pendingSignal = null;
      }

      // 如果没有持仓，生成信号
      if (!this.position && !this.circuitBreakerActive && !this.dailyLossLimitHit && i >= this.consecutiveLossPauseEnd && (i - this.lastCloseBarIndex) >= this.tradeCooldownBars) {
        const indicators = this.precomputedIndicators.get(i);
        if (!indicators) continue;

        const ocsIndex = i - ocsLookback;
        const l1 = this.precomputedLayer1[ocsIndex];
        const l2 = this.precomputedLayer2[ocsIndex];
        
        const signal = this.generateSignalFromPrecomputed(indicators, l2, currentCandle.close, i);
        
        if (signal && signal.type !== 'hold' && signal.confidence >= 0.5) {  // Raised pre-filter
          const sma20 = indicators.sma[20];
          const sma50 = indicators.sma[50];
          const isTrendUp = sma20 > sma50;
          const isTrendDown = sma20 < sma50;
          
          const isTrendAligned = 
            (signal.type === 'long' && isTrendUp) || 
            (signal.type === 'short' && isTrendDown);
          
          const confidenceThreshold = isTrendAligned ? 0.52 : 0.75;  // Tightened: filter marginal signals
          
          if (signal.confidence >= confidenceThreshold) {
            console.log(`  📊 趋势: ${isTrendUp ? '↑上涨' : '↓下跌'} | 信号: ${signal.type} | 置信度: ${signal.confidence.toFixed(2)} | 阈值: ${confidenceThreshold}`);
            this.pendingSignal = { signal, barIndex: i };
          } else {
            console.log(`  ⏭️ 信号被趋势过滤: ${signal.type} 置信度${signal.confidence.toFixed(2)} < ${confidenceThreshold}`);
          }
        }
      }

      // 记录权益曲线 (after all position changes for this bar)
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

    // FIX: Use pre-extracted number arrays instead of OHLCV slice.
    // OHLCV objects are ~100+ bytes each; number arrays are 8 bytes/element.
    // For 90K iterations × 5000 elements, this reduces allocation from
    // 45GB (OHLCV) to ~3.6GB (numbers), well within GC capacity.
    
    // Layer3 only needs prices for calculateVolatility (14-bar ATR).
    // Use 300-bar window — avoids O(n²) from slice(0, index+1).
    const l3WinStart = Math.max(0, index - 300);
    const closesForL3 = this.allCloses.slice(l3WinStart, index + 1);
    const l3 = this.ocsLayer3.process(l2Output.features3D, closesForL3);
    
    // Enhanced 增强 — use BOUNDED slice of existing OHLCV array
    // Array.slice() is a shallow copy (pointers only): 500 × 8B = 4KB per call.
    // 500 bars (~42 hours on 5m) provides enough CVD/TRIX/Gaussian history.
    const enhWinStart = Math.max(0, index - 500);
    const enhOhlcvWindow = this.ohlcv.slice(enhWinStart, index + 1);
    const enhancedOutput = this.ocsEnhanced.enhance(enhOhlcvWindow, l2Output, l3);
    
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
    
    // 使用 SLTPCalculator (300-bar window of S/R levels, plenty for 48-bar lookback)
    const sltpWinStart = Math.max(0, index - 300);
    const highs = this.allHighs.slice(sltpWinStart, index + 1);
    const lows = this.allLows.slice(sltpWinStart, index + 1);
    
    const sltp = this.sltpCalculator.calculate(
      finalDirection,
      l4.setup.entryPrice,
      highs,
      lows,
      highs.length - 1
    );
    
    // BUG 11 FIX: Compute default SL/TP from ATR if not provided by SLTP calculator
    const atr = indicators.atr[14];
    const defaultSL = finalDirection === 'long'
      ? currentPrice - 2 * atr
      : currentPrice + 2 * atr;
    const computedSL = sltp?.stopLoss ?? defaultSL;
    const computedTP = sltp?.takeProfits ?? {
      tp1: finalDirection === 'long' ? currentPrice + 2.4 * atr : currentPrice - 2.4 * atr,  // 1.2x risk
      tp2: finalDirection === 'long' ? currentPrice + 3.6 * atr : currentPrice - 3.6 * atr,  // 1.8x risk
      tp3: finalDirection === 'long' ? currentPrice + 5.0 * atr : currentPrice - 5.0 * atr,  // 2.5x risk
    };

    // BUG 11 FIX: Validate SL/TP are defined and sane before returning signal
    if (computedSL === undefined || computedSL === null || !isFinite(computedSL)) {
      console.log(`  ⚠️ Invalid SL computed, skipping signal`);
      return { type: 'hold', confidence: 0 };
    }

    // Minimum reward-to-cost filter: skip trades where TP1 is too close to entry
    // relative to round-trip transaction costs (2x fees + 2x slippage).
    // This filters out thin-edge trades that erode Sharpe.
    const entryP = l4.setup.entryPrice;
    const tp1Distance = Math.abs(computedTP.tp1 - entryP);
    const roundTripCost = entryP * (2 * this.config.feeRate + 2 * this.config.slippage);
    if (tp1Distance < 2.0 * roundTripCost) {
      console.log(`  ⏭️ 奖励/成本过低: TP1距离 ${tp1Distance.toFixed(2)} < 2x成本 ${(2 * roundTripCost).toFixed(2)}, 跳过`);
      return { type: 'hold', confidence: 0 };
    }

    return {
      type: finalDirection === 'long' ? 'long' : 'short',
      entryPrice: l4.setup.entryPrice,
      stopLoss: computedSL,
      takeProfits: computedTP,
      confidence: finalConfidence,
      reason: `Layer4: ${l4.reason}`
    };
  }

  /**
   * 检查持仓止盈止损
   * FIX 1: Reordered TP checks to SL → TP3 → TP2 → TP1 (check highest TPs first).
   * After TP1 hit → move SL to breakeven (entry price).
   * After TP2 hit → trail SL to TP1 level.
   */
  private checkPosition(candle: OHLCV, index: number): void {
    if (!this.position) return;

    // Max holding period: close position after 1500 bars (~5 days on 5m)
    // Prevents capital from being tied up in drifting trades
    const holdingBars = index - this.position.entryBarIndex;
    if (holdingBars >= 1000) {
      console.log(`  ⏰ 最大持仓时间: ${holdingBars} bars, 强制平仓`);
      this.closePosition(candle, 'max_holding', index);
      return;
    }

    const { side, entryPrice, stopLoss, takeProfits, tp1Hit, tp2Hit } = this.position;

    if (side === 'long') {
      // 1. Check Stop Loss first
      // FIX H6: Check for gap — if bar opens below SL, fill at open (not SL price)
      if (candle.low <= stopLoss) {
        const gapFillPrice = candle.open < stopLoss ? candle.open : undefined;
        this.closePosition(candle, 'stop_loss', index, gapFillPrice);
        return;
      }
      // 2. Check TP3 (highest) — full close
      // FIX H6: Check for gap — if bar opens above TP3, fill at open (not TP3 price)
      if (candle.high >= takeProfits.tp3) {
        const gapFillPrice = candle.open > takeProfits.tp3 ? candle.open : undefined;
        this.closePosition(candle, 'tp3', index, gapFillPrice);
        return;
      }
      // 3. Check TP2 — partial close, then trail SL to TP1
      // FIX H6: Check for gap — if bar opens above TP2, fill at open (not TP2 price)
      if (!tp2Hit && candle.high >= takeProfits.tp2) {
        const gapFillPrice = candle.open > takeProfits.tp2 ? candle.open : undefined;
        this.closePosition(candle, 'tp2', index, gapFillPrice);
        // FIX 1: After TP2 hit, trail stop to TP1 level
        if (this.position) {
          this.position.stopLoss = takeProfits.tp1;
        }
        return;
      }
      // 4. Check TP1 — partial close, then move SL to breakeven
      // FIX H6: Check for gap — if bar opens above TP1, fill at open (not TP1 price)
      if (!tp1Hit && candle.high >= takeProfits.tp1) {
        const gapFillPrice = candle.open > takeProfits.tp1 ? candle.open : undefined;
        this.closePosition(candle, 'tp1', index, gapFillPrice);
        // FIX 1: After TP1 hit, move stop to breakeven (entry price)
        if (this.position) {
          this.position.stopLoss = entryPrice;
        }
        return;
      }
    } else if (side === 'short') {
      // 1. Check Stop Loss first
      // FIX H6: Check for gap — if bar opens above SL, fill at open (not SL price)
      if (candle.high >= stopLoss) {
        const gapFillPrice = candle.open > stopLoss ? candle.open : undefined;
        this.closePosition(candle, 'stop_loss', index, gapFillPrice);
        return;
      }
      // 2. Check TP3 (lowest for shorts) — full close
      // FIX H6: Check for gap — if bar opens below TP3, fill at open (not TP3 price)
      if (candle.low <= takeProfits.tp3) {
        const gapFillPrice = candle.open < takeProfits.tp3 ? candle.open : undefined;
        this.closePosition(candle, 'tp3', index, gapFillPrice);
        return;
      }
      // 3. Check TP2 — partial close, then trail SL to TP1
      // FIX H6: Check for gap — if bar opens below TP2, fill at open (not TP2 price)
      if (!tp2Hit && candle.low <= takeProfits.tp2) {
        const gapFillPrice = candle.open < takeProfits.tp2 ? candle.open : undefined;
        this.closePosition(candle, 'tp2', index, gapFillPrice);
        // FIX 1: After TP2 hit, trail stop to TP1 level
        if (this.position) {
          this.position.stopLoss = takeProfits.tp1;
        }
        return;
      }
      // 4. Check TP1 — partial close, then move SL to breakeven
      // FIX H6: Check for gap — if bar opens below TP1, fill at open (not TP1 price)
      if (!tp1Hit && candle.low <= takeProfits.tp1) {
        const gapFillPrice = candle.open < takeProfits.tp1 ? candle.open : undefined;
        this.closePosition(candle, 'tp1', index, gapFillPrice);
        // FIX 1: After TP1 hit, move stop to breakeven (entry price)
        if (this.position) {
          this.position.stopLoss = entryPrice;
        }
        return;
      }
    }
  }

  /**
   * 开仓
   */
  private openPosition(signal: StrategySignal, candle: OHLCV, index: number, useOpen: boolean = false): void {
    const { type, entryPrice, stopLoss, takeProfits } = signal;

    // BUG 11 FIX: Validate SL/TP are defined before opening position
    if (stopLoss === undefined || stopLoss === null || !isFinite(stopLoss)) {
      console.log(`  ⚠️ Cannot open position: stopLoss is undefined or invalid`);
      return;
    }
    if (!takeProfits || !isFinite(takeProfits.tp1)) {
      console.log(`  ⚠️ Cannot open position: takeProfits are undefined or invalid`);
      return;
    }
    
    // FIX C3: Use bar's open price for next-bar execution, not close
    const basePrice = useOpen ? candle.open : candle.close;
    const psResult = calculatePositionSize({
      balance: this.balance,
      currentPrice: basePrice,
      stopLossPrice: stopLoss ?? 0,
      maxRiskPerTrade: this.config.positionSize,
      leverage: this.config.leverage,
      maxLeverageUtil: 1.0,  // backtest uses full leverage allowance
    });
    const size = psResult.size;

    const slippageCost = basePrice * this.config.slippage;
    const actualEntryPrice = type === 'long' 
      ? basePrice + slippageCost 
      : basePrice - slippageCost;
    const positionValue = psResult.notionalValue;
    const fee = positionValue * this.config.feeRate;

    this.balance -= fee;

    this.position = {
      side: type,
      entryPrice: actualEntryPrice,
      entryTime: candle.timestamp,
      entryBarIndex: index, // BUG 10 FIX: Store entry bar index
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
  private closePosition(candle: OHLCV, reason: string, index: number, overrideExitPrice?: number): void {
    if (!this.position) return;

    const { side, entryPrice, entryTime, entryBarIndex, size, stopLoss, takeProfits } = this.position;

    let exitPrice = candle.close;
    let partialClose = false;

    // FIX H6: Use override price if provided (gap fill)
    if (overrideExitPrice !== undefined) {
      exitPrice = overrideExitPrice;
    } else if (reason === 'stop_loss') {
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

    // Handle partial close flags for override cases too
    if (overrideExitPrice !== undefined) {
      if (reason === 'tp1') {
        partialClose = true;
        this.position.tp1Hit = true;
      } else if (reason === 'tp2') {
        partialClose = true;
        this.position.tp2Hit = true;
      }
    }

    // 计算滑点和手续费
    const slippageCost = exitPrice * this.config.slippage;
    const actualExitPrice = side === 'long'
      ? exitPrice - slippageCost
      : exitPrice + slippageCost;
    
    // FIX P1: Determine partial close size based on exit reason (Layer4 spec)
    // TP1: close 50% of current position (closePercent: 0.5)
    // TP2: close 50% of remaining (which is 25% of original)
    let closeSize: number;
    if (reason === 'tp1') {
      closeSize = size * 0.5; // TP1: close 50% of current
    } else if (reason === 'tp2') {
      closeSize = size * 0.5; // TP2: close 50% of remaining (which is 25% of original)
    } else {
      closeSize = size; // Full close (SL, TP3, end_of_test)
    }
    // BUG 3 FIX: Removed duplicate `const positionValue = psResult.notionalValue;`
    // psResult doesn't exist in this scope. Compute positionValue from closeSize * actualExitPrice.
    const positionValue = closeSize * actualExitPrice;
    const fee = positionValue * this.config.feeRate;

    // 计算盈亏
    let pnl: number;
    if (side === 'long') {
      pnl = (actualExitPrice - entryPrice) * closeSize - fee;
    } else {
      pnl = (entryPrice - actualExitPrice) * closeSize - fee;
    }

    const pnlPercent = (pnl / this.balance) * 100;
    this.balance += pnl;

    // BUG 10 FIX: Use stored entryBarIndex instead of findIndex (which can return -1)
    const holdingBars = index - entryBarIndex;

    const trade: Trade = {
      entryTime,
      exitTime: candle.timestamp,
      side,
      entryPrice,
      exitPrice: actualExitPrice,
      stopLoss,
      takeProfits,
      size: closeSize, // FIX L1: Record actual close size, not full position size
      pnl,
      pnlPercent,
      exitReason: reason,
      holdingBars
    };

    this.trades.push(trade);

    // Track consecutive losses for pause mechanism
    if (pnl < 0) {
      this.consecutiveLosses++;
      if (this.consecutiveLosses >= 5) {
        this.consecutiveLossPauseEnd = index + 500; // Pause ~1.7 days after 5 consecutive losses
        console.log(`  ⚠️ 连续亏损 ${this.consecutiveLosses} 次, 暂停交易 ~1.7天 (500 bars)`);
      }
    } else {
      this.consecutiveLosses = 0;
    }

    const pnlStr = pnl >= 0 ? `+${pnl.toFixed(2)}` : `${pnl.toFixed(2)}`;
    console.log(`   [${new Date(candle.timestamp).toLocaleString()}] 平仓 ${reason} @ ${actualExitPrice.toFixed(2)} | PnL: ${pnlStr}`);

    // FIX P1: Subtract closed amount instead of halving; handles TP1/TP2 correctly
    if (partialClose) {
      this.position.size -= closeSize;
    } else {
      this.lastCloseBarIndex = index; // Track close bar for trade cooldown
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

    // BUG 15 FIX: Compute bars per day from timeframe config instead of hardcoding 288
    const bpd = barsPerDay(this.config.timeframe);

    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    // BUG 6 FIX: Use sample std (N-1) instead of population std (N) for Sharpe consistency
    const stdReturn = returns.length > 1
      ? Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / (returns.length - 1))
      : 0;
    // FIX H4: Use CRYPTO_TRADING_DAYS (365) instead of 252 for crypto annualization
    // BUG 15 FIX: Use bpd instead of hardcoded 288
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(CRYPTO_TRADING_DAYS * bpd) : 0; // 年化

    const totalReturnPercent = ((this.balance - this.config.initialBalance) / this.config.initialBalance) * 100;

    // FIX H5: Use CAGR instead of linear extrapolation
    // BUG 15 FIX: Use bpd instead of hardcoded 288
    const tradingDays = this.ohlcv.length / bpd;
    const finalValue = this.balance;
    const initialValue = this.config.initialBalance;
    const annualizedReturnPercent = tradingDays > 0
      ? (Math.pow(finalValue / initialValue, CRYPTO_TRADING_DAYS / tradingDays) - 1) * 100
      : 0;

    // GT Score
    const gtScore = sharpeRatio * (1 - maxDrawdown / 100) * 10;

    const stats = {
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0,
      totalReturn: this.balance - this.config.initialBalance,
      totalReturnPercent,
      annualizedReturnPercent, // FIX H5: CAGR
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
    console.log(`   年化收益 (CAGR): ${stats.annualizedReturnPercent >= 0 ? '+' : ''}${stats.annualizedReturnPercent.toFixed(2)}%`);
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
export async function main() {
  // Default: backtest last 7 days. Override via env or CLI args as needed.
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const config: BacktestConfig = {
    symbol: process.env.BT_SYMBOL   || 'ETHUSDT',
    timeframe: process.env.BT_TIMEFRAME || '5m',
    startDate,
    endDate,
    initialBalance: 10000,
    positionSize: 0.010,  // 1.2%仓位 (tightened to reduce drawdown)
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

// Run only when executed directly (not imported)
const isMain = process.argv[1] && (process.argv[1].endsWith("backtest-engine.ts") || process.argv[1].endsWith("backtest-engine"));
if (isMain) { main(); }
