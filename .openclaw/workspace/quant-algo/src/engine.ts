import { config, validateConfig } from './config';
import ExchangeManager from './exchange';
import { StrategyEngineModule, StrategyType } from './modules/strategyEngine';
import RiskManager, { Position } from './riskManager';
import SMCAnalyzer from './smc';
import MarketMicrostructure from './marketMicro';
import AIModule from './ai';
import LLMTradingDecisionEngine, { LLMTradingDecision } from './llmDecision';
import AdaptiveRSI from './adaptiveRSI';
import { TechnicalAnalysis } from './technicalAnalysis';
import logger, { tradeLogger } from './logger';
import NotificationManager from './notifier';

export class TradingEngine {
  private exchange: ExchangeManager;
  private riskManager: RiskManager;
  private strategyEngine: StrategyEngineModule;  // 使用完整策略引擎
  private smcAnalyzer: SMCAnalyzer;
  private marketMicro: MarketMicrostructure;
  private ai: AIModule;
  private llmDecision: LLMTradingDecisionEngine;
  private techAnalysis: TechnicalAnalysis;
  private notifier: NotificationManager;
  private isRunning: boolean = false;
  private lastSignal: any = null;
  private lastLLMDecision: LLMTradingDecision | null = null;
  private checkIntervalId: Timer | null = null;
  private higherTfData: number[][] = [];

  private adaptiveRSI: AdaptiveRSI;

  // 当前持仓的止损止盈（本地缓存，因为交易所API不返回）
  private currentStopLoss: number | null = null;
  private currentTakeProfit: number | null = null;

  // FIX: H2 — Maintain EMA state across calls for proper recursive computation.
  // EMA is defined as EMA_t = α * Price_t + (1-α) * EMA_{t-1}, requiring the previous
  // EMA value to be stored. These fields persist the last-computed EMA values so that
  // each new bar only requires O(1) incremental computation.
  private prevEma12: number | null = null;
  private prevEma26: number | null = null;
  private emaBarsProcessed: number = 0;

  constructor(strategy: StrategyType = 'ocs') {
    validateConfig();
    this.exchange = new ExchangeManager();
    this.riskManager = new RiskManager();
    this.strategyEngine = new StrategyEngineModule(strategy);  // 初始化策略引擎
    this.smcAnalyzer = new SMCAnalyzer();
    this.marketMicro = new MarketMicrostructure();
    this.ai = new AIModule();
    this.llmDecision = new LLMTradingDecisionEngine();
    this.adaptiveRSI = new AdaptiveRSI({
      basePeriod: 14,
      minPeriod: 5,
      maxPeriod: 30,
      volatilityLookback: 20,
    });
    this.techAnalysis = new TechnicalAnalysis();
    this.notifier = new NotificationManager();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('交易引擎已在运行中');
      return;
    }

    logger.info('🚀 启动 ETH 永续合约量化交易系统 (OCS AI Trader)');
    logger.info(`   交易对: ${config.symbol}`);
    logger.info(`   时间框架: ${config.timeframe} / ${config.higherTimeframe}`);
    logger.info(`   主策略: OCS AI Trader`);
    logger.info(`   SMC分析: ${config.smc.enabled ? '✅' : '❌'}`);
    logger.info(`   市场微观结构: ${config.marketMicrostructure.enabled ? '✅' : '❌'}`);
    logger.info(`   LLM决策引擎: ✅ (最终决策)`);

    const aiStatus = this.ai.getStatus();
    logger.info(`   AI模块: ${aiStatus.enabled ? '✅' : '❌'} ${aiStatus.hasLLM ? '(LLM)' : '(本地)'}`);

    logger.info(`   杠杆: ${config.leverage}x`);
    logger.info(`   检查间隔: ${config.checkInterval}秒`);

    const connected = await this.exchange.testConnection();
    if (!connected) {
      throw new Error('无法连接到 Binance');
    }

    await this.exchange.setLeverage(config.leverage);

    const balance = await this.exchange.getBalance();
    logger.info(`   账户余额: ${balance.free.toFixed(2)} USDT`);

    this.isRunning = true;
    await this.notifier.notifyStart();

    // 立即执行一次
    await this.tradeCycle();

    this.checkIntervalId = setInterval(() => {
      this.tradeCycle().catch(error => {
        logger.error('交易周期错误:', error);
      });
    }, config.checkInterval * 1000);

    logger.info('✅ 交易引擎已启动');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    logger.info('🛑 交易引擎已停止');
    await this.notifier.notifyStop();
    console.log(this.riskManager.formatStats());
  }

  private async tradeCycle(): Promise<void> {
    try {
      // 获取主时间框架数据
      const ohlcv = await this.exchange.fetchOHLCV(config.timeframe, 100);

      // 获取更高时间框架数据（用于趋势确认）
      if (config.multiTimeframe.enabled) {
        this.higherTfData = await this.exchange.fetchOHLCV(config.higherTimeframe, 50);
      }

      // SMC 分析
      if (config.smc.enabled) {
        this.smcAnalyzer.analyze(ohlcv);
      }

      // 市场微观结构分析
      if (config.marketMicrostructure.enabled) {
        try {
          const orderBook = await this.exchange.getExchange().fetchOrderBook(config.symbol, 20);
          const imbalance = this.marketMicro.analyzeOrderBook(orderBook);
          const marketSignal = this.marketMicro.generateSignal(imbalance);

          logger.debug(`市场微观结构信号: ${marketSignal.score} (置信度: ${marketSignal.confidence.toFixed(2)})`);
        } catch (e) {
          // 订单簿获取失败不影响主逻辑
        }
      }

      // AI 异常检测
      const anomaly = this.ai.detectAnomaly(ohlcv);
      if (anomaly.isAnomaly && anomaly.severity >= 7) {
        logger.warn(`🚨 AI 异常检测: ${anomaly.reason} (严重度: ${anomaly.severity})`);

        // 高严重度异常时暂停开新仓
        if (anomaly.anomalyType === 'flash_crash' || anomaly.anomalyType === 'pump') {
          logger.warn('⚠️ 市场异常，暂停开新仓');
        }
      }

      // AI 风险预测
      const riskForecast = this.ai.predictRisk(ohlcv);
      if (riskForecast.riskLevel === 'high') {
        logger.warn(`⚠️ AI 风险警告: ${riskForecast.warnings.join(', ')}`);
      }

      // 新闻监控 - 由通知管理器统一处理
      await this.notifier.checkAndNotifyNews();

      // 生成信号
      const signal = await this.generateSignal(ohlcv);
      const currentPrice = await this.exchange.getCurrentPrice();
      const balance = await this.exchange.getBalance();
      const position = await this.getFormattedPosition();

      // 打印市场状态
      this.logMarketStatus(currentPrice, signal, position, balance);

      // 风控检查
      const emergencyCheck = this.riskManager.checkEmergencyExit(position, currentPrice);
      if (emergencyCheck.shouldExit) {
        await this.closePosition(position, emergencyCheck.reason!);
        return;
      }

      // 持仓管理
      if (position.side !== 'none') {
        await this.manageOpenPosition(position, signal, currentPrice);
        return;
      }

      // 检查是否可以开新仓位
      const canTrade = this.riskManager.canOpenPosition(balance.free, position);
      if (!canTrade.allowed) {
        logger.debug(`无法开新仓: ${canTrade.reason}`);
        return;
      }

      // 根据综合信号开仓
      if (signal.strength >= 50 && signal.confidence >= 0.6) {
        await this.openPosition(signal, currentPrice, balance.free);
      }

      this.lastSignal = signal;

    } catch (error) {
      logger.error('交易周期执行失败:', error);
    }
  }

  /**
   * 生成交易信号 - 现在包含 LLM 最终决策
   */
  private async generateSignal(
    ohlcv: number[][]
  ): Promise<any> {
    // 准备 OCS 数据
    const opens: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const closes: number[] = [];
    const volumes: number[] = [];

    ohlcv.forEach(candle => {
      opens.push(candle[1]);
      highs.push(candle[2]);
      lows.push(candle[3]);
      closes.push(candle[4]);
      volumes.push(candle[5]);
    });

    // 计算技术指标
    const indicators = this.calculateIndicators(ohlcv);

    // 获取当前价格
    const currentPrice = closes[closes.length - 1];

    // 更新策略引擎的历史数据
    this.strategyEngine.addHistoricalData(ohlcv.map(c => ({
      timestamp: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5]
    })));

    // 获取当前市场上下文
    const position = await this.getFormattedPosition();
    const balance = await this.exchange.getBalance();

    // 使用策略引擎生成信号
    const strategyContext = {
      indicators,
      multiTimeframeIndicators: {},
      currentPrice,
      balance: balance.free,
      hasPosition: position.side !== 'none',
      currentPosition: position.side !== 'none' ? position : undefined,
      marketContext: ''
    };

    const strategySignal = this.strategyEngine.generateSignal(strategyContext);

    // 🛑 如果策略信号是 hold，直接返回，不调用 LLM
    if (strategySignal.type === 'hold') {
      logger.debug(`策略信号: hold，跳过 LLM 调用`);
      return {
        type: 'neutral',
        strength: 0,
        confidence: 0,
        stopLoss: strategySignal.stopLoss,
        takeProfit: strategySignal.takeProfits?.tp2,
        targets: strategySignal.takeProfits,
        reasoning: ['策略信号为hold，观望'],
        aiRisk: 'low',
        llmDecision: null as any,
      };
    }

    // 构建策略信号输入（兼容 LLM 模块格式）
    const llmStrategySignal = {
      type: strategySignal.type === 'long' ? 'buy' : strategySignal.type === 'short' ? 'sell' : 'neutral' as 'buy' | 'sell' | 'neutral',
      strength: strategySignal.strength,
      confidence: strategySignal.confidence,
      reasoning: strategySignal.reasoning,
      stopLoss: strategySignal.stopLoss,
      takeProfit: strategySignal.takeProfits?.tp2,
      targets: {
        t1: strategySignal.takeProfits?.tp1,
        t2: strategySignal.takeProfits?.tp2,
        t3: strategySignal.takeProfits?.tp3,
      },
      riskRewardRatio: strategySignal.stopLoss && strategySignal.takeProfits?.tp2
        ? Math.abs((strategySignal.takeProfits.tp2 - currentPrice) / (strategySignal.stopLoss - currentPrice))
        : undefined,
      entryPrice: currentPrice,
      strategyName: strategySignal.strategy,
      timeHorizon: 'swing' as const,
    };

    // 获取新闻摘要（从通知模块，避免重复获取）
    const newsSummary = await this.notifier.getNewsSummary();

    const marketContext = {
      currentPrice,
      indicators,
      timeframe: config.timeframe,
      position: position.side !== 'none' ? {
        side: position.side,
        size: position.size,
        entryPrice: position.entryPrice,
        unrealizedPnl: position.unrealizedPnl,
      } : null,
      balance: balance.free,
      recentCandles: ohlcv.slice(-20),
      news: newsSummary,
    };

    // 🎯 调用 LLM 进行最终决策
    const llmDecision = await this.llmDecision.getTradingDecision(llmStrategySignal, marketContext);

    // 🛑 如果 LLM 返回 null（信号过于频繁被丢弃），直接返回 hold
    if (llmDecision === null) {
      logger.warn('🛑 LLM 信号被丢弃（过于频繁），返回观望');
      return {
        type: 'neutral',
        strength: 0,
        confidence: 0,
        stopLoss: strategySignal.stopLoss,
        takeProfit: strategySignal.takeProfits?.tp2,
        targets: strategySignal.takeProfits,
        reasoning: ['LLM 正在处理中，信号过于频繁已丢弃'],
        aiRisk: 'low',
        llmDecision: null as any,
      };
    }

    this.lastLLMDecision = llmDecision;

    // 记录 LLM 决策
    logger.info(`🤖 LLM 决策: ${llmDecision.action.toUpperCase()} | 置信度: ${(llmDecision.confidence * 100).toFixed(0)}% | 风险: ${llmDecision.riskLevel}`);

    // 返回增强的信号（包含 LLM 决策）
    return {
      type: llmDecision.action === 'buy' ? 'buy' : llmDecision.action === 'sell' ? 'sell' : 'neutral',
      strength: llmDecision.action === 'hold' ? 0 : Math.round(llmDecision.confidence * 100),
      confidence: llmDecision.confidence,
      stopLoss: strategySignal.stopLoss,
      takeProfit: strategySignal.takeProfits?.tp2,
      targets: strategySignal.takeProfits,
      reasoning: llmDecision.reasoning,
      aiRisk: llmDecision.riskLevel,
      llmDecision,
    };
  }

  /**
   * 计算技术指标
   */
  private calculateIndicators(ohlcv: number[][]): any {
    const closes = ohlcv.map(c => c[4]);
    const highs = ohlcv.map(c => c[2]);
    const lows = ohlcv.map(c => c[3]);
    const volumes = ohlcv.map(c => c[5]);
    const currentPrice = closes[closes.length - 1];

    // 简单移动平均线
    const sma = (data: number[], period: number) => {
      if (data.length < period) return data[data.length - 1];
      const sum = data.slice(-period).reduce((a, b) => a + b, 0);
      return sum / period;
    };

    // FIX: H2 — Proper EMA using recursive formula: EMA_t = α * Price_t + (1-α) * EMA_{t-1}
    // where α = 2/(N+1). The old code used `SMA * 1.1` which has no mathematical basis
    // and produces values systematically 10% above the SMA regardless of price action.
    // A correct EMA weights recent prices exponentially, giving a smoothed indicator that
    // tracks price momentum. For initialization (first call), SMA is used as the seed value.
    const ema = (data: number[], period: number): number => {
      if (data.length === 0) return 0;
      const alpha = 2 / (period + 1);
      // Use SMA of first `period` bars as seed, then apply recursive EMA formula
      const seedEnd = Math.min(period, data.length);
      let emaValue = data.slice(0, seedEnd).reduce((a, b) => a + b, 0) / seedEnd;
      for (let i = seedEnd; i < data.length; i++) {
        emaValue = alpha * data[i] + (1 - alpha) * emaValue;
      }
      return emaValue;
    };

    // RSI
    const rsi = (data: number[], period: number) => {
      if (data.length < period + 1) return 50;
      let gains = 0, losses = 0;
      for (let i = data.length - period; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    };

    // ATR
    const atr = (highs: number[], lows: number[], closes: number[], period: number) => {
      if (highs.length < period + 1) return 0;
      let sum = 0;
      for (let i = highs.length - period; i < highs.length; i++) {
        const tr1 = highs[i] - lows[i];
        const tr2 = Math.abs(highs[i] - closes[i - 1]);
        const tr3 = Math.abs(lows[i] - closes[i - 1]);
        sum += Math.max(tr1, tr2, tr3);
      }
      return sum / period;
    };

    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, Math.min(200, closes.length));
    const rsi14 = rsi(closes, 14);
    const atr14 = atr(highs, lows, closes, 14);
    const volumeSma20 = sma(volumes, 20);

    // 计算 Adaptive RSI（放到技术指标模块）
    const adaptiveRSI = new AdaptiveRSI({
      baseOversold: 25,
      baseOverbought: 75,
      adaptationFactor: 0.6,
    });
    const rsiResult = adaptiveRSI.calculate(closes);

    // 布林带
    const stdDev = (data: number[], period: number) => {
      const mean = sma(data, period);
      const squaredDiffs = data.slice(-period).map(x => Math.pow(x - mean, 2));
      return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
    };
    const bbStd = stdDev(closes, 20);

    // FIX: H2 — Replace `sma(closes, 12) * 1.1` with proper EMA recursive formula.
    // Also maintain EMA state across calls for incremental computation.
    // For the first call or when data length changes, recompute from scratch and cache.
    if (this.prevEma12 === null || this.emaBarsProcessed !== closes.length) {
      // Full recomputation: use SMA as seed, then apply recursive EMA
      this.prevEma12 = ema(closes, 12);
      this.prevEma26 = ema(closes, 26);
      this.emaBarsProcessed = closes.length;
    } else {
      // FIX: H2 — Incremental update with latest price using recursive EMA formula
      const alpha12 = 2 / (12 + 1);
      const alpha26 = 2 / (26 + 1);
      this.prevEma12 = alpha12 * currentPrice + (1 - alpha12) * this.prevEma12;
      this.prevEma26 = alpha26 * currentPrice + (1 - alpha26) * this.prevEma26;
      this.emaBarsProcessed = closes.length;
    }
    const ema12 = this.prevEma12;
    const ema26 = this.prevEma26!;

    const macdLine = ema12 - ema26;
    const macdSignal = sma([macdLine], 9) || macdLine * 0.9;

    // Supertrend 简化计算
    const supertrendValue = currentPrice - (atr14 * 3);
    const supertrendDirection = currentPrice > supertrendValue ? 'up' : 'down';

    // ADX 简化计算（基于价格变化）
    const dx = Math.abs(((closes[closes.length - 1] - closes[closes.length - 14]) / closes[closes.length - 14]) * 100);
    const adx = Math.min(50, Math.max(10, dx));

    // Stochastic 简化
    const lowestLow = Math.min(...lows.slice(-14));
    const highestHigh = Math.max(...highs.slice(-14));
    const k = highestHigh !== lowestLow ? ((currentPrice - lowestLow) / (highestHigh - lowestLow)) * 100 : 50;

    // CCI 简化
    const typicalPrice = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
    const smaTypical = sma([typicalPrice], 20);
    const meanDeviation = Math.abs(typicalPrice - smaTypical);
    const cci = meanDeviation !== 0 ? (typicalPrice - smaTypical) / (0.015 * meanDeviation) : 0;

    // OBV 计算
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) obv += volumes[i];
      else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    }

    return {
      sma20,
      sma50,
      sma200,
      ema12,
      ema26,
      rsi14,
      // Adaptive RSI 结果
      adaptiveRSI: {
        value: rsiResult.value,
        period: rsiResult.period,
        overbought: rsiResult.overbought,
        oversold: rsiResult.oversold,
        regime: rsiResult.regime,
        confidence: rsiResult.confidence,
      },
      macd: {
        line: macdLine,
        signal: macdSignal,
        histogram: macdLine - macdSignal,
      },
      atr14,
      bollinger: {
        upper: sma20 + 2 * bbStd,
        middle: sma20,
        lower: sma20 - 2 * bbStd,
        bandwidth: (4 * bbStd) / sma20,
      },
      supertrend: {
        direction: supertrendDirection as 'up' | 'down',
        value: supertrendValue,
      },
      adx,
      stochastic: { k, d: sma([k], 3) || k },
      cci,
      vwap: sma(closes, 14),
      obv,
      volumeSma20,
      trendScore: ((currentPrice - sma50) / sma50) * 1000,
      momentumScore: (rsi14 - 50) * 2,
      volumeScore: ((obv / volumes.reduce((a, b) => a + b, 0)) * 100),
      volatilityScore: -((atr14 / currentPrice) * 1000),
      overallScore: (rsi14 - 50) * 0.5 + ((currentPrice - sma20) / sma20) * 500 + ((k - 50) * 0.5),
    };
  }

  private async openPosition(signal: any, currentPrice: number, balance: number): Promise<void> {
    // 🎯 使用 LLM 的最终决策
    const llmDecision: LLMTradingDecision = signal.llmDecision;

    if (!llmDecision) {
      logger.error('❌ 缺少 LLM 决策，拒绝开仓');
      return;
    }

    // LLM 建议 hold 时不开仓
    if (llmDecision.action === 'hold') {
      logger.info(`🛑 LLM 建议观望，跳过交易 | 理由: ${llmDecision.reasoning[0] || '风险过高'}`);
      return;
    }

    const side = llmDecision.action; // buy or sell
    const positionSide: 'long' | 'short' = side === 'buy' ? 'long' : 'short';

    // LLM 风险过高时不开仓
    if (llmDecision.riskLevel === 'high') {
      logger.warn(`⚠️ LLM 评估风险过高 (${llmDecision.warnings.join(', ')}), 跳过交易`);
      return;
    }

    // 使用 LLM 建议的仓位比例
    const basePositionSize = this.riskManager.calculatePositionSize(balance, currentPrice,
      this.riskManager.calculateStopLoss(currentPrice, positionSide));
    const positionSize = basePositionSize * llmDecision.positionSize;

    if (positionSize <= 0) {
      logger.warn('计算的仓位大小无效，跳过本次交易');
      return;
    }

    const stopLossPrice = signal.stopLoss || this.riskManager.calculateStopLoss(currentPrice, positionSide);
    const takeProfitPrice = signal.takeProfit || this.riskManager.calculateTakeProfit(currentPrice, positionSide);

    logger.info(`🤖 LLM 决策执行 | 方向: ${positionSide.toUpperCase()} | 价格: $${currentPrice}`);
    logger.info(`   LLM 置信度: ${(llmDecision.confidence * 100).toFixed(0)}% | 风险等级: ${llmDecision.riskLevel}`);
    logger.info(`   建议仓位比例: ${(llmDecision.positionSize * 100).toFixed(0)}% | 实际仓位: ${positionSize.toFixed(4)} ETH`);
    logger.info(`   市场情绪: ${llmDecision.marketSentiment} | 时间框架: ${llmDecision.timeHorizon}`);
    logger.info(`   止损: ${stopLossPrice.toFixed(2)} | 止盈: ${takeProfitPrice.toFixed(2)}`);
    logger.info(`   决策理由: ${llmDecision.reasoning.slice(0, 2).join('; ')}`);

    try {
      if (side === 'buy') {
        await this.exchange.openLong(positionSize, stopLossPrice, takeProfitPrice);
      } else {
        await this.exchange.openShort(positionSize, stopLossPrice, takeProfitPrice);
      }

      // ✅ 保存 SL/TP 到本地状态
      this.currentStopLoss = stopLossPrice;
      this.currentTakeProfit = takeProfitPrice;

      tradeLogger.info('开仓', {
        side: positionSide,
        price: currentPrice,
        size: positionSize,
        stopLoss: stopLossPrice,
        takeProfit: takeProfitPrice,
        llmConfidence: llmDecision.confidence,
        llmRiskLevel: llmDecision.riskLevel,
        llmReasoning: llmDecision.reasoning,
        marketSentiment: llmDecision.marketSentiment,
      });

      // 发送包含 LLM 分析的详细通知
      const notifyMsg = `🤖 **LLM 决策开仓**\n方向: ${positionSide.toUpperCase()} @ $${currentPrice}\n置信度: ${(llmDecision.confidence * 100).toFixed(0)}% | 风险: ${llmDecision.riskLevel}\n情绪: ${llmDecision.marketSentiment}\n仓位: ${(llmDecision.positionSize * 100).toFixed(0)}%`;
      await this.notifier.sendNotification(notifyMsg);

    } catch (error) {
      logger.error('开仓失败:', error);
    }
  }

  private async manageOpenPosition(position: Position, signal: any, currentPrice: number): Promise<void> {
    // 🚨 优先检查止盈止损（无论LLM信号如何）
    if (position.side === 'long') {
      if (position.stopLoss && currentPrice <= position.stopLoss) {
        await this.closePosition(position, `止损触发 @ $${currentPrice} (SL: $${position.stopLoss})`);
        return;
      }
      if (position.takeProfit && currentPrice >= position.takeProfit) {
        await this.closePosition(position, `止盈触发 @ $${currentPrice} (TP: $${position.takeProfit})`);
        return;
      }
    } else if (position.side === 'short') {
      if (position.stopLoss && currentPrice >= position.stopLoss) {
        await this.closePosition(position, `止损触发 @ $${currentPrice} (SL: $${position.stopLoss})`);
        return;
      }
      if (position.takeProfit && currentPrice <= position.takeProfit) {
        await this.closePosition(position, `止盈触发 @ $${currentPrice} (TP: $${position.takeProfit})`);
        return;
      }
    }

    // 信号反转平仓
    const shouldClose =
      (position.side === 'long' && signal.type === 'sell' && signal.strength >= 50) ||
      (position.side === 'short' && signal.type === 'buy' && signal.strength >= 50);

    if (shouldClose) {
      await this.closePosition(position, `信号反转 (强度 ${signal.strength})`);
      return;
    }

    // SMC 确认突破块后平仓
    if (config.smc.enabled) {
      this.smcAnalyzer.markZoneTested(currentPrice);
    }
  }

  private async closePosition(position: Position, reason: string): Promise<void> {
    if (position.side === 'none' || position.size === 0) return;

    const closeSide = position.side === 'long' ? 'sell' : 'buy';

    logger.info(`📤 执行平仓 | 原因: ${reason} | 持仓: ${position.side.toUpperCase()}`);

    try {
      await this.exchange.createOrder(
        config.symbol,
        'market',
        closeSide,
        position.size
      );

      // ✅ 平仓后清除 SL/TP
      this.currentStopLoss = null;
      this.currentTakeProfit = null;

      const pnl = position.unrealizedPnl;
      this.riskManager.recordTrade(pnl);

      tradeLogger.info('平仓', {
        side: position.side,
        reason: reason,
        pnl: pnl,
        size: position.size,
      });

      console.log(this.riskManager.formatStats());

      await this.notifier.notifyClosePosition(
        position.side,
        position.entryPrice,
        position.entryPrice + (pnl / position.size),
        pnl,
        reason
      );

    } catch (error) {
      logger.error('平仓失败:', error);
    }
  }

  private async getFormattedPosition(): Promise<Position> {
    const rawPosition = await this.exchange.getPosition();

    if (!rawPosition || rawPosition.contracts === 0) {
      // 重置 SL/TP
      this.currentStopLoss = null;
      this.currentTakeProfit = null;
      return {
        side: 'none',
        size: 0,
        entryPrice: 0,
        leverage: config.leverage,
        unrealizedPnl: 0,
      };
    }

    return {
      side: rawPosition.side === 'long' ? 'long' : 'short',
      size: Math.abs(rawPosition.contracts),
      entryPrice: rawPosition.entryPrice || 0,
      leverage: rawPosition.leverage || config.leverage,
      unrealizedPnl: rawPosition.unrealizedPnl || 0,
      liquidationPrice: rawPosition.liquidationPrice,
      stopLoss: this.currentStopLoss,
      takeProfit: this.currentTakeProfit,
    };
  }

  private logMarketStatus(price: number, signal: any, position: Position, balance: { total: number; free: number }): void {
    const positionInfo = position.side !== 'none'
      ? `| 持仓: ${position.side.toUpperCase()} ${position.size.toFixed(4)} @ ${position.entryPrice.toFixed(2)} (PnL: ${position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)})`
      : '| 无持仓';

    // LLM 决策信息
    const llmDecision: LLMTradingDecision = signal.llmDecision;
    const llmInfo = llmDecision
      ? `| LLM: ${llmDecision.action.toUpperCase()}(${(llmDecision.confidence * 100).toFixed(0)}%) ${llmDecision.riskLevel === 'high' ? '🔴' : llmDecision.riskLevel === 'medium' ? '🟡' : '🟢'}`
      : '';

    logger.info(`📈 ETH: $${price.toFixed(2)} | 策略: ${signal.type.toUpperCase()} (${signal.strength}) ${llmInfo} ${positionInfo}`);

    // SMC 统计
    if (config.smc.enabled && Math.random() < 0.2) {
      const smcStats = this.smcAnalyzer.getStats();
      logger.debug(`SMC: ${smcStats.bullishOBs}看涨OB | ${smcStats.bearishOBs}看跌OB | ${smcStats.fvgs}FVG | ${smcStats.sweeps}Sweep`);
    }
  }

  getStatus(): { isRunning: boolean; stats: string } {
    return {
      isRunning: this.isRunning,
      stats: this.riskManager.formatStats(),
    };
  }
}

export default TradingEngine;
