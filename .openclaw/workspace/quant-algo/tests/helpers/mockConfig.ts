/**
 * Mock configuration for tests.
 *
 * Mirrors the shape of `src/config.ts` → `TradingConfig` so that modules
 * under test receive realistic but deterministic values without touching
 * the file system, environment variables, or network.
 */

export const mockRiskConfig = {
  version: '1.0.0-test',
  stopLoss: {
    defaultPercent: 0.015,
    minPercent: 0.005,
    maxPercent: 0.05,
    atrMultiplier: 1.5,
    adaptiveEnabled: true,
  },
  takeProfit: {
    defaultPercent: 0.03,
    minPercent: 0.01,
    maxPercent: 0.1,
    atrMultiplier: 3.0,
    useMultipleTP: true,
    tp1: { percent: 0.015, closeRatio: 0.3 },
    tp2: { percent: 0.03, closeRatio: 0.4 },
    tp3: { percent: 0.05, closeRatio: 0.3 },
  },
  trailingStop: {
    enabled: true,
    activationPercent: 0.01,
    trailingPercent: 0.01,
    minProfitPercent: 0.005,
  },
  positionSizing: {
    maxRiskPerTrade: 0.02,
    maxPositionSize: 0.5,
    minPositionSize: 0.01,
    kellyFraction: 0.25,
    useVolatilityAdjustment: true,
  },
  dailyLimits: {
    maxDailyLoss: 0.1,
    maxDailyTrades: 50,
    maxDailyDrawdown: 0.15,
    tradingHours: { start: '00:00', end: '23:59', timezone: 'Asia/Shanghai' },
  },
  cooldown: {
    defaultMinutes: 5,
    afterWin: 2,
    afterLoss: 10,
    afterConsecutiveLosses: { threshold: 3, minutes: 30 },
  },
  volatility: {
    filterEnabled: true,
    minVolatility: 0.002,
    maxVolatility: 0.02,
    lookbackPeriod: 20,
    highVolatilityAction: 'reduce_size',
    lowVolatilityAction: 'skip',
  },
  leverage: {
    default: 50,
    max: 125,
    adaptive: {
      enabled: true,
      lowVolatility: 30,
      mediumVolatility: 50,
      highVolatility: 20,
    },
  },
  emergencyRules: {
    liquidationBuffer: 0.1,
    marginCallThreshold: 0.2,
    autoCloseOnDisconnect: true,
    maxUnrealizedLoss: 0.3,
  },
};

export const mockConfig = {
  exchange: {
    id: 'binance',
    apiKey: 'test-api-key',
    secret: 'test-secret',
    sandbox: true,
    enableRateLimit: true,
  },

  symbol: 'ETH/USDT:USDT',

  initialBalance: 100,
  maxRiskPerTrade: 0.02,
  leverage: 50,

  timeframe: '5m',
  higherTimeframe: '15m',
  checkInterval: 30,

  smc: {
    enabled: true,
    lookbackPeriods: 20,
    fvgThreshold: 0.001,
    liquiditySweepThreshold: 0.005,
    breakerBlockThreshold: 0.003,
  },

  ml: {
    enabled: false,
    modelUpdateInterval: 24,
    confidenceThreshold: 0.7,
    features: ['rsi', 'ema_diff', 'bb_position', 'volume_profile', 'price_momentum', 'volatility'],
  },

  marketMicrostructure: {
    enabled: true,
    orderBookDepth: 20,
    largeTradeThreshold: 100000,
    fundingRateThreshold: 0.0001,
    deltaThreshold: 1000000,
  },

  multiTimeframe: {
    enabled: true,
    timeframes: ['5m', '15m', '1h', '4h'],
    alignmentThreshold: 0.6,
  },

  strategy: {
    rsiPeriod: 14,
    rsiOverbought: 60,
    rsiOversold: 40,
    maFast: 9,
    maSlow: 21,
    bbPeriod: 20,
    bbStdDev: 2,
  },

  riskManagement: {
    stopLossPercent: 0.015,
    takeProfitPercent: 0.03,
    trailingStopPercent: 0.01,
    maxPositions: 1,
    maxDailyLoss: 0.1,
    maxDailyTrades: 50,
    cooldownMinutes: 5,
    volatilityFilter: true,
    minVolatility: 0.002,
    maxVolatility: 0.02,
  },

  risk: mockRiskConfig,

  redis: {
    host: 'localhost',
    port: 6379,
    password: undefined,
    db: 0,
    keyPrefix: 'quant-alto-test:',
  },

  metrics: {
    port: 9090,
    host: '0.0.0.0',
    enabled: false,
  },

  ai: {
    defaultProvider: 'deepseek',
    fallbackEnabled: true,
    timeout: 30000,
    maxRetries: 3,
    cacheEnabled: true,
    cacheTTL: 300000,
    tokenLimit: 100000,
  },

  tracing: {
    enabled: false,
    serviceName: 'quant-alto-test',
    endpoint: 'http://localhost:4318/v1/traces',
    samplingRate: 1.0,
    exportTimeout: 30000,
    batchSize: 512,
    batchTimeout: 5000,
  },
};

export default mockConfig;
