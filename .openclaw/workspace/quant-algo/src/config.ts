import dotenv from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';

dotenv.config({ path: resolve(process.cwd(), 'config/.env') });

// 风控配置文件路径
const RISK_CONFIG_PATH = resolve(process.cwd(), 'config/risk-config.json');

/**
 * 风控配置接口
 */
export interface RiskConfig {
  version: string;
  stopLoss: {
    defaultPercent: number;
    minPercent: number;
    maxPercent: number;
    atrMultiplier: number;
    adaptiveEnabled: boolean;
  };
  takeProfit: {
    defaultPercent: number;
    minPercent: number;
    maxPercent: number;
    atrMultiplier: number;
    useMultipleTP: boolean;
    tp1: { percent: number; closeRatio: number };
    tp2: { percent: number; closeRatio: number };
    tp3: { percent: number; closeRatio: number };
  };
  trailingStop: {
    enabled: boolean;
    activationPercent: number;
    trailingPercent: number;
    minProfitPercent: number;
  };
  positionSizing: {
    maxRiskPerTrade: number;
    maxPositionSize: number;
    minPositionSize: number;
    kellyFraction: number;
    useVolatilityAdjustment: boolean;
  };
  dailyLimits: {
    maxDailyLoss: number;
    maxDailyTrades: number;
    maxDailyDrawdown: number;
    tradingHours: { start: string; end: string; timezone: string };
  };
  cooldown: {
    defaultMinutes: number;
    afterWin: number;
    afterLoss: number;
    afterConsecutiveLosses: { threshold: number; minutes: number };
  };
  volatility: {
    filterEnabled: boolean;
    minVolatility: number;
    maxVolatility: number;
    lookbackPeriod: number;
    highVolatilityAction: string;
    lowVolatilityAction: string;
  };
  leverage: {
    default: number;
    max: number;
    adaptive: {
      enabled: boolean;
      lowVolatility: number;
      mediumVolatility: number;
      highVolatility: number;
    };
  };
  emergencyRules: {
    liquidationBuffer: number;
    marginCallThreshold: number;
    autoCloseOnDisconnect: boolean;
    maxUnrealizedLoss: number;
  };
}

/**
 * 加载风控配置
 */
function loadRiskConfig(): RiskConfig {
  try {
    if (fs.existsSync(RISK_CONFIG_PATH)) {
      const data = fs.readFileSync(RISK_CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('⚠️ 无法加载风控配置文件，使用默认值');
  }
  
  // 返回默认配置
  return {
    version: '1.0.0',
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
}

// 加载风控配置
const riskConfig = loadRiskConfig();

export interface TradingConfig {
  exchange: {
    id: string;
    apiKey: string;
    secret: string;
    sandbox: boolean;
    enableRateLimit: boolean;
  };
  
  symbol: string;
  
  // 资金管理
  initialBalance: number;
  maxRiskPerTrade: number;
  leverage: number;
  
  // 交易参数 - 时间框架统一
  timeframe: string;
  higherTimeframe: string;
  checkInterval: number;
  
  // SMC 参数
  smc: {
    enabled: boolean;
    lookbackPeriods: number;
    fvgThreshold: number;
    liquiditySweepThreshold: number;
    breakerBlockThreshold: number;
  };
  
  // 机器学习参数
  ml: {
    enabled: boolean;
    modelUpdateInterval: number;
    confidenceThreshold: number;
    features: string[];
  };
  
  // 市场微观结构
  marketMicrostructure: {
    enabled: boolean;
    orderBookDepth: number;
    largeTradeThreshold: number;
    fundingRateThreshold: number;
    deltaThreshold: number;
  };
  
  // 多时间框架参数
  multiTimeframe: {
    enabled: boolean;
    timeframes: string[];
    alignmentThreshold: number;
  };
  
  strategy: {
    rsiPeriod: number;
    rsiOverbought: number;
    rsiOversold: number;
    maFast: number;
    maSlow: number;
    bbPeriod: number;
    bbStdDev: number;
  };
  
  riskManagement: {
    stopLossPercent: number;
    takeProfitPercent: number;
    trailingStopPercent: number;
    maxPositions: number;
    maxDailyLoss: number;
    maxDailyTrades: number;
    cooldownMinutes: number;
    volatilityFilter: boolean;
    minVolatility: number;
    maxVolatility: number;
  };
  
  // 新增：完整风控配置
  risk: RiskConfig;
  
  // Redis 配置 (事件总线)
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  
  // 指标服务器配置
  metrics: {
    port: number;
    host: string;
    enabled: boolean;
  };
  
  // AI/LLM 配置
  ai: {
    defaultProvider: string;
    fallbackEnabled: boolean;
    timeout: number;
    maxRetries: number;
    cacheEnabled: boolean;
    cacheTTL: number;
    tokenLimit: number;
  };
  
  // 分布式追踪配置
  tracing: {
    enabled: boolean;
    serviceName: string;
    endpoint: string;
    samplingRate: number;
    exportTimeout: number;
    batchSize: number;
    batchTimeout: number;
  };
}

export const config: TradingConfig = {
  exchange: {
    id: 'binance',
    apiKey: process.env.BINANCE_API_KEY || '',
    secret: process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET || '',
    sandbox: process.env.BINANCE_SANDBOX !== 'false',
    enableRateLimit: true,
  },
  
  symbol: 'ETH/USDT:USDT',

  initialBalance: 100,
  maxRiskPerTrade: riskConfig.positionSizing.maxRiskPerTrade,
  leverage: parseInt(process.env.LEVERAGE || String(riskConfig.leverage.default)),

  timeframe: process.env.TIMEFRAME || '5m',
  higherTimeframe: process.env.TIMEFRAME === '1m' ? '5m' :
    process.env.TIMEFRAME === '5m' ? '15m' :
      process.env.TIMEFRAME === '15m' ? '1h' : '4h',
  checkInterval: parseInt(process.env.CHECK_INTERVAL || '30'),
  
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
  
  // 从风控配置文件读取
  riskManagement: {
    stopLossPercent: riskConfig.stopLoss.defaultPercent,
    takeProfitPercent: riskConfig.takeProfit.defaultPercent,
    trailingStopPercent: riskConfig.trailingStop.trailingPercent,
    maxPositions: 1,
    maxDailyLoss: riskConfig.dailyLimits.maxDailyLoss,
    maxDailyTrades: riskConfig.dailyLimits.maxDailyTrades,
    cooldownMinutes: riskConfig.cooldown.defaultMinutes,
    volatilityFilter: riskConfig.volatility.filterEnabled,
    minVolatility: riskConfig.volatility.minVolatility,
    maxVolatility: riskConfig.volatility.maxVolatility,
  },
  
  // 完整风控配置
  risk: riskConfig,
  
  // Redis 配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'quant-alto:',
  },
  
  // 指标服务器配置
  metrics: {
    port: parseInt(process.env.METRICS_PORT || '9090'),
    host: process.env.METRICS_HOST || '0.0.0.0',
    enabled: process.env.METRICS_ENABLED !== 'false',
  },
  
  // AI/LLM 配置
  ai: {
    defaultProvider: process.env.AI_PROVIDER || 'deepseek',
    fallbackEnabled: process.env.AI_FALLBACK_ENABLED !== 'false',
    timeout: parseInt(process.env.AI_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3'),
    cacheEnabled: process.env.AI_CACHE_ENABLED !== 'false',
    cacheTTL: parseInt(process.env.AI_CACHE_TTL || '300000'), // 5分钟
    tokenLimit: parseInt(process.env.AI_TOKEN_LIMIT || '100000'), // 每日限制
  },
  // 分布式追踪配置
  tracing: {
    enabled: process.env.ENABLE_TRACING === 'true',
    serviceName: process.env.TRACING_SERVICE_NAME || 'quant-alto',
    endpoint: process.env.TRACING_ENDPOINT || 'http://localhost:4318/v1/traces',
    samplingRate: parseFloat(process.env.TRACING_SAMPLING_RATE || '1.0'),
    exportTimeout: parseInt(process.env.TRACING_EXPORT_TIMEOUT || '30000'),
    batchSize: parseInt(process.env.TRACING_BATCH_SIZE || '512'),
    batchTimeout: parseInt(process.env.TRACING_BATCH_TIMEOUT || '5000'),
  },
};

export function validateConfig(): void {
  if (!config.exchange.apiKey || !config.exchange.secret) {
    throw new Error('错误：请在 config/.env 文件中配置 BINANCE_API_KEY 和 BINANCE_SECRET');
  }
  
  if (config.leverage > config.risk.leverage.max) {
    console.warn(`⚠️ 警告：杠杆 ${config.leverage}x 超过最大值 ${config.risk.leverage.max}x`);
  }
  
  console.log('✅ 配置验证通过');
  console.log(`   交易对: ${config.symbol}`);
  console.log(`   时间框架: ${config.timeframe} / ${config.higherTimeframe}`);
  console.log(`   SMC: ${config.smc.enabled ? '启用' : '禁用'}`);
  console.log(`   多时间框架: ${config.multiTimeframe.enabled ? '启用' : '禁用'}`);
  console.log(`   杠杆: ${config.leverage}x`);
  console.log(`   交易模式: ${config.exchange.sandbox ? '🟡 Testnet (模拟盘)' : '🔴 MAINNET (实盘!)'}`);
  console.log(`   风控配置: v${riskConfig.version}`);
  console.log(`   指标服务器: ${config.metrics.enabled ? `启用 (端口 ${config.metrics.port})` : '禁用'}`);
  console.log(`   分布式追踪: ${config.tracing.enabled ? `启用 (${config.tracing.endpoint})` : '禁用'}`);
  console.log(`   AI 配置: 供应商=${config.ai.defaultProvider}, 降级=${config.ai.fallbackEnabled ? '启用' : '禁用'}`);
}

// 导出风控配置
export { riskConfig, RISK_CONFIG_PATH };
export default config;
