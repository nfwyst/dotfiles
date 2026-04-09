/**
 * Trading Bot Runtime - 执行层
 * 
 * 核心特点:
 * 1. 纯代码执行，无 LLM 调用
 * 2. 从配置文件读取策略参数
 * 3. 分钟级实时执行
 * 4. 收集性能数据用于反馈
 * 
 * 基于 TiMi 论文的策略-执行解耦架构
 */

import { ExchangeManager } from '../exchange';
import logger from '../logger';
import fs from 'fs';
import path from 'path';
import { computeRSI } from '../indicators/rsi';
import { calculatePositionSize } from '../risk/positionSizing';
import { validateTradingBotConfig } from '../utils/typeGuards';

// ==================== 类型定义 ====================

export interface TradingBotConfig {
  version: string;
  generatedAt: string;
  validUntil: string;
  
  symbol: string;
  
  entryConditions: {
    trend?: { direction: string; minStrength: number };
    momentum?: { 
      rsi?: { 
        // 新字段：多空分离
        longMin?: number;
        longMax?: number;
        shortMin?: number;
        shortMax?: number;
        // 兼容旧字段
        min?: number;
        max?: number;
      }
    };
    volume?: { minRatio: number };
    price?: { above?: number; below?: number };
  };
  
  exitConditions: {
    takeProfit: {
      levels: number[];      // 百分比
      portions: number[];     // 比例
    };
    stopLoss: {
      atrMultiplier: number;
      trailing: boolean;
      trailingPercent?: number;
    };
  };
  
  riskManagement: {
    maxPositionSize: number;  // 余额百分比
    maxLeverage: number;
    maxDrawdown: number;
    dailyLossLimit?: number;
  };
  
  orderSpec: {
    type: 'market' | 'limit';
    slippageTolerance: number;
  };
  
  // 元数据
  metadata?: {
    reasoning?: string[];
    confidence?: number;
    marketRegime?: string;
  };
}

export interface OrderSpec {
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  size: number;
  price?: number;
  stopPrice?: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  stopLoss: number;
  takeProfitLevels: Array<{
    price: number;
    portion: number;
    type: 'limit' | 'trailing';
    trailingPercent?: number;
  }>;
}

export interface Position {
  side: 'long' | 'short' | 'none';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  liquidationPrice?: number;
}

export interface PerformanceMetrics {
  roi: number;
  dailyReturns: number[];
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  avgTradeDuration: number;
  totalPnl: number;
  winningTrades: number;
  losingTrades: number;
}

export interface TradeRecord {
  timestamp: number;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  type: 'entry' | 'exit' | 'stop_loss' | 'take_profit';
  pnl?: number;
  reason: string;
}


// ==================== Binance Account Types ====================

interface BinanceAccountAsset {
  asset: string;
  availableBalance: string;
  walletBalance: string;
  unrealizedProfit: string;
}

interface BinanceAccountPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedProfit: string;
  leverage: string;
  liquidationPrice?: string;
}

interface BinanceAccountInfo {
  assets?: BinanceAccountAsset[];
  positions?: BinanceAccountPosition[];
}

// ==================== Market Data Types ====================

interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketDataResult {
  symbol: string;
  currentPrice: number;
  ohlcv: OHLCVCandle[];
  atr: number;
  rsi: number;
  volumeRatio: number;
  sma20: number;
  sma50: number;
  trendUp: boolean;
  trendDown: boolean;
  trendStrength: number;
  high24h: number;
  low24h: number;
}

type CloseReason = 'entry' | 'exit' | 'stop_loss' | 'take_profit' | 'trend_reversal';

const CLOSE_REASONS: ReadonlySet<string> = new Set<CloseReason>(['entry', 'exit', 'stop_loss', 'take_profit', 'trend_reversal']);
function isCloseReason(value: string): value is CloseReason {
  return CLOSE_REASONS.has(value);
}

// ==================== TradingBotRuntime ====================
// TODO: Migrate all usages of TradingBotRuntime to EventDrivenRuntime
// and remove this class. Active consumers: src/index.ts, src/monitoring/dashboard.ts,
// src/optimization/feedbackLoop.ts, src/execution/index.ts, src/execution/orderGenerator.ts

/**
 * @deprecated 请使用 EventDrivenRuntime 代替。
 * TradingBotRuntime 将在下个大版本中移除。
 * 迁移指南：将 tradingBotConfigs/current.json 中的策略参数
 * 迁移到 config/ocs-config.json 并使用 EventDrivenRuntime。
 */
export class TradingBotRuntime {
  private config: TradingBotConfig | null = null;
  private configPath: string;
  private exchange: ExchangeManager;
  
  private position: Position = { side: 'none', size: 0, entryPrice: 0, markPrice: 0, unrealizedPnl: 0, leverage: 1 };
  private balance: number = 0;
  private trades: TradeRecord[] = [];
  
  private running: boolean = false;
  private lastUpdate: number = 0;
  private checkInterval: number = 60000; // 1分钟
  
  // 性能追踪
  private dailyStartBalance: number = 0;
  private peakBalance: number = 0;
  private dailyPnl: number = 0;
  
  constructor(configPath: string = './config/tradingBotConfigs/current.json') {
    this.configPath = configPath;
    this.exchange = new ExchangeManager();
  }
  
  /**
   * 加载策略配置
   */
  loadConfig(): boolean {
    try {
      const fullPath = path.resolve(this.configPath);
      
      if (!fs.existsSync(fullPath)) {
        logger.warn(`Config file not found: ${fullPath}`);
        return false;
      }
      
      const configContent = fs.readFileSync(fullPath, 'utf8');
      const parsed: unknown = JSON.parse(configContent);
      const validated = validateTradingBotConfig(parsed);
      if (!validated) {
        logger.warn(`Config file has invalid shape: ${fullPath}`);
        return false;
      }
      this.config = validated;
      
      // 检查配置是否过期（仅警告，不阻止加载）
      if (this.config.validUntil) {
        const validUntil = new Date(this.config.validUntil).getTime();
        if (Date.now() > validUntil) {
          logger.warn(`⚠️ Config expired at ${this.config.validUntil}, but still using it`);
        }
      }
      
      logger.info(`✅ Loaded config v${this.config.version}, valid until ${this.config.validUntil}`);
      return true;
      
    } catch (error: unknown) {
      logger.error(`Failed to load config: ${(error instanceof Error ? error.message : String(error))}`);
      return false;
    }
  }
  
  /**
   * 初始化
   */
  async initialize(): Promise<boolean> {
    logger.info('🤖 Trading Bot Runtime initializing...');
    
    // 加载配置
    if (!this.loadConfig()) {
      logger.error('❌ Failed to load config');
      return false;
    }
    
    // 连接交易所
    const connected = await this.exchange.testConnection();
    if (!connected) {
      logger.warn('⚠️ Exchange not connected, running in simulation mode');
    }
    
    // 获取账户状态
    await this.syncAccountState();
    
    logger.info('✅ Trading Bot Runtime initialized');
    return true;
  }
  
  /**
   * 启动执行循环
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Bot already running');
      return;
    }
    
    this.running = true;
    logger.info('🚀 Trading Bot started');
    
    while (this.running) {
      try {
        await this.runCycle();
      } catch (error: unknown) {
        logger.error(`Cycle error: ${(error instanceof Error ? error.message : String(error))}`);
      }
      
      await this.sleep(this.checkInterval);
    }
  }
  
  /**
   * 停止执行
   */
  stop(): void {
    this.running = false;
    logger.info('🛑 Trading Bot stopped');
  }
  
  /**
   * 单次执行循环
   */
  async runCycle(): Promise<void> {
    const now = Date.now();
    
    // 更新账户状态
    await this.syncAccountState();
    
    // 检查配置有效性
    if (!this.config) {
      logger.warn('No config loaded, skipping cycle');
      return;
    }
    
    // 检查日损失限制
    if (this.checkDailyLossLimit()) {
      logger.warn('Daily loss limit reached, pausing trading');
      return;
    }
    
    // 获取市场数据
    const marketData = await this.getMarketData();
    if (!marketData) {
      logger.warn('Failed to get market data');
      return;
    }
    
    // 检查入场条件
    if (this.position.side === 'none') {
      await this.checkEntryConditions(marketData);
    } else {
      // 持仓管理
      await this.managePosition(marketData);
    }
    
    // 更新性能指标
    this.updatePerformanceMetrics();
    
    this.lastUpdate = now;
  }
  
  /**
   * 同步账户状态
   */
  private async syncAccountState(): Promise<void> {
    try {
      const hasAPIKey = process.env.BINANCE_API_KEY && process.env.BINANCE_API_KEY.length > 10;
      
      if (!hasAPIKey) {
        // 模拟模式
        this.balance = 1000;
        return;
      }
      
      const account = await this.exchange.request<BinanceAccountInfo>('/fapi/v2/account');
      const usdtAsset = account.assets?.find((a: BinanceAccountAsset) => a.asset === 'USDT');
      
      this.balance = parseFloat(usdtAsset?.availableBalance || '0');
      this.peakBalance = Math.max(this.peakBalance, this.balance);
      
      // 获取持仓
      const positionData = account.positions?.find(
        (p: BinanceAccountPosition) => p.symbol === (this.config?.symbol || 'ETHUSDT') && parseFloat(p.positionAmt) !== 0
      );
      
      if (positionData) {
        const posAmt = parseFloat(positionData.positionAmt);
        this.position = {
          side: posAmt > 0 ? 'long' : 'short',
          size: Math.abs(posAmt),
          entryPrice: parseFloat(positionData.entryPrice),
          markPrice: parseFloat(positionData.markPrice),
          unrealizedPnl: parseFloat(positionData.unrealizedProfit),
          leverage: parseFloat(positionData.leverage),
          liquidationPrice: parseFloat(positionData.liquidationPrice || '0'),
        };
      } else {
        this.position = { side: 'none', size: 0, entryPrice: 0, markPrice: 0, unrealizedPnl: 0, leverage: 1 };
      }
      
    } catch (error: unknown) {
      logger.error(`Failed to sync account state: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }
  
  /**
   * 获取市场数据
   * BUG 4 FIX: Replace this.exchange.getOHLCV() with this.exchange.fetchOHLCV()
   * BUG 5 FIX: Use this.exchange.getCurrentPrice() for ticker instead of raw signed request.
   *            Handle the number[][] return format from fetchOHLCV().
   */
  private async getMarketData(): Promise<MarketDataResult | null> {
    try {
      const symbol = this.config?.symbol || 'ETHUSDT';
      
      // BUG 4 & 5 FIX: Use the correct fetchOHLCV method
      const rawOhlcv = await this.exchange.fetchOHLCV('5m', 100);
      
      // BUG 5 FIX: fetchOHLCV returns number[][] with format:
      // [timestamp, open, high, low, close, volume]
      // Convert to object format for downstream use
      const ohlcv = rawOhlcv.map((k: number[]) => ({
        timestamp: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
      }));
      
      // BUG 5 FIX: Use getCurrentPrice() instead of raw signed request with malformed URL
      const currentPrice = await this.exchange.getCurrentPrice();
      
      // 计算 ATR
      const atr = this.calculateATR(ohlcv, 14);
      
      // 计算 RSI
      const rsi = this.calculateRSI(ohlcv.map((c: OHLCVCandle) => c.close), 14);
      
      // 计算成交量比率
      const volumes = ohlcv.map((c: OHLCVCandle) => c.volume);
      const avgVolume = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
      const volumeRatio = volumes[volumes.length - 1] / avgVolume;
      
      // ✅ 改进：使用 SMA 判断趋势
      const closes = ohlcv.map((c: OHLCVCandle) => c.close);
      const sma20 = this.calculateSMA(closes, 20);
      const sma50 = this.calculateSMA(closes, 50);
      
      // 趋势判断：价格相对于 SMA 的位置
      const trendUp = currentPrice > sma20 && sma20 > sma50;
      const trendDown = currentPrice < sma20 && sma20 < sma50;
      const trendStrength = Math.abs((currentPrice / sma20 - 1) * 100) * 3 + (sma20 > sma50 ? 25 : -25) + 25;
      
      return {
        symbol,
        currentPrice,
        ohlcv,
        atr,
        rsi,
        volumeRatio,
        sma20,
        sma50,
        trendUp,
        trendDown,
        trendStrength,
        high24h: Math.max(...ohlcv.slice(-288).map((c: OHLCVCandle) => c.high)),
        low24h: Math.min(...ohlcv.slice(-288).map((c: OHLCVCandle) => c.low)),
      };
      
    } catch (error: unknown) {
      logger.error(`Failed to get market data: ${(error instanceof Error ? error.message : String(error))}`);
      return null;
    }
  }
  
  /**
   * 检查入场条件
   */
  private async checkEntryConditions(marketData: MarketDataResult): Promise<void> {
    if (!this.config) return;
    
    const { currentPrice, rsi, volumeRatio, atr, trendUp, trendDown, trendStrength } = marketData;
    const conditions = this.config.entryConditions;
    
    let shouldEnter = true;
    const reasons: string[] = [];
    
    // 检查趋势条件
    if (conditions.trend) {
      const requiredDirection = conditions.trend.direction;
      const minStrength = conditions.trend.minStrength || 50;
      
      // ✅ 改进：使用正确的趋势判断
      if (requiredDirection === 'up' && !trendUp) {
        shouldEnter = false;
        reasons.push(`Trend not up (trendStrength: ${trendStrength.toFixed(0)})`);
      }
      if (requiredDirection === 'down' && !trendDown) {
        shouldEnter = false;
        reasons.push(`Trend not down (trendStrength: ${trendStrength.toFixed(0)})`);
      }
      
      // 趋势强度检查
      if (trendStrength < minStrength) {
        shouldEnter = false;
        reasons.push(`Trend strength ${trendStrength.toFixed(0)} < ${minStrength}`);
      }
      
      // 保存趋势状态
      marketData.trendUp = trendUp;
      marketData.trendDown = trendDown;
    }
    
    // ✅ 改进：分离开仓信号和平仓信号
    let entryLongSignal = false;
    let entryShortSignal = false;
    
    if (conditions.momentum?.rsi) {
      const rsiConfig = conditions.momentum.rsi;
      
      // 做多入场条件：RSI 在范围内 + 趋势向上
      const longMin = rsiConfig.longMin ?? rsiConfig.min;
      const longMax = rsiConfig.longMax ?? rsiConfig.max;
      
      if (longMin !== undefined && longMax !== undefined) {
        if (rsi >= longMin && rsi <= longMax && trendUp) {
          entryLongSignal = true;
          reasons.push(`Entry LONG: RSI=${rsi.toFixed(1)} in [${longMin},${longMax}], trend UP`);
        }
      }
      
      // 做空入场条件：RSI 超买（不要求趋势向下，捕捉回调）
      const shortMin = rsiConfig.shortMin;
      const shortMax = rsiConfig.shortMax ?? 100;
      
      if (shortMin !== undefined) {
        if (rsi >= shortMin && rsi <= shortMax) {
          entryShortSignal = true;
          reasons.push(`Entry SHORT: RSI=${rsi.toFixed(1)} >= ${shortMin}`);
        }
      }
    }
    
    // 检查成交量条件
    if (conditions.volume?.minRatio) {
      if (volumeRatio < conditions.volume.minRatio) {
        shouldEnter = false;
        reasons.push(`Volume ratio ${volumeRatio.toFixed(2)} below minimum ${conditions.volume.minRatio}`);
      }
    }
    
    // 检查价格条件
    if (conditions.price?.above && currentPrice < conditions.price.above) {
      shouldEnter = false;
      reasons.push(`Price ${currentPrice} below ${conditions.price.above}`);
    }
    if (conditions.price?.below && currentPrice > conditions.price.below) {
      shouldEnter = false;
      reasons.push(`Price ${currentPrice} above ${conditions.price.below}`);
    }
    
    if (shouldEnter) {
      // ✅ 改进：独立的入场信号判断
      let side: 'buy' | 'sell';
      
      if (entryLongSignal) {
        side = 'buy';
        logger.info(`✅ 开多信号: ${reasons[reasons.length - 1]}`);
      } else if (entryShortSignal) {
        side = 'sell';
        logger.info(`✅ 开空信号: ${reasons[reasons.length - 1]}`);
      } else {
        // 没有明确的入场信号
        logger.info(`⏸️ 无明确入场信号: RSI=${rsi.toFixed(1)}, trendUp=${trendUp}, trendDown=${trendDown}`);
        return;
      }
      
      await this.executeEntry(side, currentPrice, atr, marketData);
    }
  }
  
  /**
   * 执行入场
   */
  private async executeEntry(
    side: 'buy' | 'sell',
    price: number,
    atr: number,
    marketData: MarketDataResult
  ): Promise<void> {
    if (!this.config) return;
    
    // 计算仓位大小 — delegates to canonical positionSizing
    const leverage = Math.min(this.config.riskManagement.maxLeverage, 50);
    const psResult = calculatePositionSize({
      balance: this.balance,
      currentPrice: price,
      stopLossPrice: side === 'buy' ? price - atr * this.config.exitConditions.stopLoss.atrMultiplier
                                     : price + atr * this.config.exitConditions.stopLoss.atrMultiplier,
      maxRiskPerTrade: this.config.riskManagement.maxPositionSize,
      leverage,
      maxLeverageUtil: 0.5,
    });
    const positionSize = psResult.size;
    
    // 计算止损止盈
    const slMultiplier = this.config.exitConditions.stopLoss.atrMultiplier;
    const stopLoss = side === 'buy' 
      ? price - atr * slMultiplier
      : price + atr * slMultiplier;
    
    const tpLevels = this.config.exitConditions.takeProfit.levels;
    const tpPortions = this.config.exitConditions.takeProfit.portions;
    const takeProfitLevels = tpLevels.map((pct, i) => ({
      price: side === 'buy' ? price * (1 + pct / 100) : price * (1 - pct / 100),
      portion: tpPortions[i] || 1 / tpLevels.length,
      type: 'limit' as const,
    }));
    
    const order: OrderSpec = {
      type: this.config.orderSpec.type,
      side,
      size: positionSize,
      price: this.config.orderSpec.type === 'limit' ? price : undefined,
      timeInForce: 'GTC',
      stopLoss,
      takeProfitLevels,
    };
    
    // 执行订单
    const executed = await this.executeOrder(order);
    
    if (executed) {
      logger.info(`📥 Entry: ${side.toUpperCase()} ${positionSize.toFixed(4)} @ $${price.toFixed(2)}`);
      logger.info(`   Stop Loss: $${stopLoss.toFixed(2)}`);
      logger.info(`   Take Profit: ${takeProfitLevels.map(tp => `$${tp.price.toFixed(2)}`).join(', ')}`);
      
      this.trades.push({
        timestamp: Date.now(),
        side,
        size: positionSize,
        price,
        type: 'entry',
        reason: 'Entry signal triggered',
      });
    }
  }
  
  /**
   * 持仓管理
   */
  private async managePosition(marketData: MarketDataResult): Promise<void> {
    if (!this.config || this.position.side === 'none') return;
    
    const { currentPrice, trendUp, trendDown, trendStrength } = marketData;
    const { stopLoss, trailing, trailingPercent } = this.config.exitConditions.stopLoss;
    
    // ✅ 改进：趋势反转保护
    if (this.position.side === 'short' && trendUp && trendStrength > 50) {
      logger.warn(`⚠️ 空单在上升趋势中 (strength: ${trendStrength.toFixed(0)})，平仓保护`);
      await this.closePosition('trend_reversal', currentPrice);
      return;
    }
    
    if (this.position.side === 'long' && trendDown && trendStrength > 50) {
      logger.warn(`⚠️ 多单在下降趋势中 (strength: ${trendStrength.toFixed(0)})，平仓保护`);
      await this.closePosition('trend_reversal', currentPrice);
      return;
    }
    
    // 更新追踪止损
    if (trailing && trailingPercent) {
      const atr = this.calculateATR(marketData.ohlcv, 14);
      const newStopLoss = this.position.side === 'long'
        ? currentPrice - atr * stopLoss
        : currentPrice + atr * stopLoss;
      
      // 只朝有利方向移动止损
      if (this.position.side === 'long' && newStopLoss > this.position.entryPrice) {
        // 更新止损（实际需要调用交易所 API）
      }
    }
    
    // 检查止损
    const atr = this.calculateATR(marketData.ohlcv, 14);
    const stopLossDistance = atr * stopLoss;
    
    if (this.position.side === 'long' && currentPrice <= this.position.entryPrice - stopLossDistance) {
      logger.warn(`🛑 多单止损触发: entry=${this.position.entryPrice.toFixed(2)}, current=${currentPrice.toFixed(2)}, ATR*${stopLoss}=${stopLossDistance.toFixed(2)}`);
      await this.closePosition('stop_loss', currentPrice);
    } else if (this.position.side === 'short' && currentPrice >= this.position.entryPrice + stopLossDistance) {
      logger.warn(`🛑 空单止损触发: entry=${this.position.entryPrice.toFixed(2)}, current=${currentPrice.toFixed(2)}, ATR*${stopLoss}=${stopLossDistance.toFixed(2)}`);
      await this.closePosition('stop_loss', currentPrice);
    }
    
    // 检查止盈 (简化版)
    const pnlPercent = ((currentPrice - this.position.entryPrice) / this.position.entryPrice) * 100;
    const adjustedPnl = this.position.side === 'short' ? -pnlPercent : pnlPercent;
    
    if (adjustedPnl > this.config.exitConditions.takeProfit.levels[0]) {
      const portion = this.config.exitConditions.takeProfit.portions[0];
      const closeSize = this.position.size * portion;
      logger.info(`🎯 止盈触发: +${adjustedPnl.toFixed(2)}%, 平仓 ${portion * 100}%`);
      await this.partialClose(closeSize, 'take_profit', currentPrice);
    }
  }
  
  /**
   * 执行订单
   */
  private async executeOrder(order: OrderSpec): Promise<boolean> {
    const hasAPIKey = process.env.BINANCE_API_KEY && process.env.BINANCE_API_KEY.length > 10;
    
    if (!hasAPIKey) {
      logger.info(`[SIMULATION] Order: ${order.side.toUpperCase()} ${order.size.toFixed(4)} @ $${order.price?.toFixed(2) || 'market'}`);
      // 更新模拟持仓
      this.position = {
        side: order.side === 'buy' ? 'long' : 'short',
        size: order.size,
        entryPrice: order.price || 0,
        markPrice: order.price || 0,
        unrealizedPnl: 0,
        leverage: this.config?.riskManagement.maxLeverage || 1,
      };
      return true;
    }
    
    try {
      // 使用 ExchangeManager 的方法
      const side: 'BUY' | 'SELL' = order.side === 'buy' ? 'BUY' : 'SELL';
      
      if (order.type === 'market') {
        await this.exchange.createMarketOrder(side, order.size);
      } else {
        // 限价单使用市价单替代（简化）
        logger.info(`[LIMIT->MARKET] Converting limit order to market: ${side} ${order.size.toFixed(4)}`);
        await this.exchange.createMarketOrder(side, order.size);
      }
      
      return true;
      
    } catch (error: unknown) {
      logger.error(`Order execution failed: ${(error instanceof Error ? error.message : String(error))}`);
      return false;
    }
  }
  
  /**
   * 平仓
   */
  private async closePosition(reason: CloseReason, price: number): Promise<void> {
    if (this.position.side === 'none') return;
    
    const side = this.position.side === 'long' ? 'sell' : 'buy';
    
    logger.info(`📤 Close: ${side.toUpperCase()} ${this.position.size.toFixed(4)} @ $${price.toFixed(2)} (${reason})`);
    
    await this.executeOrder({
      type: 'market',
      side,
      size: this.position.size,
      timeInForce: 'IOC',
      stopLoss: 0,
      takeProfitLevels: [],
    });
    
    const pnl = this.position.unrealizedPnl;
    this.trades.push({
      timestamp: Date.now(),
      side,
      size: this.position.size,
      price,
      type: reason,
      pnl,
      reason: `Position closed: ${reason}`,
    });
    
    this.position = { side: 'none', size: 0, entryPrice: 0, markPrice: 0, unrealizedPnl: 0, leverage: 1 };
  }
  
  /**
   * 部分平仓
   */
  private async partialClose(size: number, reason: string, price: number): Promise<void> {
    if (this.position.side === 'none') return;
    
    const side = this.position.side === 'long' ? 'sell' : 'buy';
    
    logger.info(`📤 Partial Close: ${side.toUpperCase()} ${size.toFixed(4)} @ $${price.toFixed(2)} (${reason})`);
    
    await this.executeOrder({
      type: 'market',
      side,
      size,
      timeInForce: 'IOC',
      stopLoss: 0,
      takeProfitLevels: [],
    });
    
    this.position.size -= size;
    if (this.position.size < 0.001) {
      this.position = { side: 'none', size: 0, entryPrice: 0, markPrice: 0, unrealizedPnl: 0, leverage: 1 };
    }
  }
  
  /**
   * 检查日损失限制
   */
  private checkDailyLossLimit(): boolean {
    if (!this.config?.riskManagement.dailyLossLimit) return false;
    
    const dailyLoss = this.dailyStartBalance - this.balance;
    const limit = this.config.riskManagement.dailyLossLimit;
    
    return dailyLoss >= limit;
  }
  
  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(): void {
    // 每日重置
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    if (this.lastUpdate < startOfDay) {
      this.dailyStartBalance = this.balance;
      this.peakBalance = this.balance;
      this.dailyPnl = 0;
    }
    
    this.peakBalance = Math.max(this.peakBalance, this.balance);
    this.dailyPnl = this.balance - this.dailyStartBalance;
  }
  
  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const winningTrades = this.trades.filter(t => (t.pnl || 0) > 0).length;
    const losingTrades = this.trades.filter(t => (t.pnl || 0) < 0).length;
    const totalPnl = this.trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossProfit = this.trades.filter(t => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(this.trades.filter(t => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0));
    
    const maxDrawdown = this.peakBalance > 0 
      ? (this.peakBalance - this.balance) / this.peakBalance 
      : 0;
    
    return {
      roi: this.dailyStartBalance > 0 ? (this.dailyPnl / this.dailyStartBalance) * 100 : 0,
      dailyReturns: [],
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio: 0, // 需要更多数据
      winRate: this.trades.length > 0 ? (winningTrades / this.trades.length) * 100 : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      tradeCount: this.trades.length,
      avgTradeDuration: 0, // 需要更多数据
      totalPnl,
      winningTrades,
      losingTrades,
    };
  }
  
  /**
   * 获取交易历史
   */
  getTradeHistory(): TradeRecord[] {
    return [...this.trades];
  }
  
  // ==================== 辅助方法 ====================
  
  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1];
    return data.slice(-period).reduce((a, b) => a + b, 0) / period;
  }
  
  private calculateATR(ohlcv: OHLCVCandle[], period: number): number {
    if (ohlcv.length < period + 1) return 0;
    
    const trValues: number[] = [];
    for (let i = 1; i < ohlcv.length; i++) {
      const high = ohlcv[i].high;
      const low = ohlcv[i].low;
      const prevClose = ohlcv[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trValues.push(tr);
    }
    
    return trValues.slice(-period).reduce((a, b) => a + b, 0) / period;
  }
  
  /** @see computeRSI from indicators/rsi — delegates to canonical impl */
  private calculateRSI(closes: number[], period: number): number {
    return computeRSI(closes, period);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default TradingBotRuntime;
