/**
 * LLM 配置管理器
 * 统一管理多个 AI 供应商的配置
 */

import logger from '../logger';
import { isLLMProvider } from '../utils/typeGuards';

// ==================== 类型定义 ====================

/**
 * 支持的 LLM 供应商
 */
export type LLMProvider = 'openai' | 'google' | 'moonshot' | 'deepseek' | 'anthropic';

/**
 * LLM 配置接口
 */
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 供应商特定配置
 */
export interface ProviderConfig {
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  envKey: string;
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: number;
  provider: LLMProvider;
  model: string;
}

/**
 * 供应商配置映射
 */
const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    envKey: 'OPENAI_API_KEY',
  },
  google: {
    name: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-1.5-flash',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
    envKey: 'GOOGLE_API_KEY',
  },
  moonshot: {
    name: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    envKey: 'MOONSHOT_API_KEY',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
    envKey: 'DEEPSEEK_API_KEY',
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-sonnet-20240229',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    envKey: 'ANTHROPIC_API_KEY',
  },
};

// ==================== LLM 配置管理器类 ====================

export class LLMConfigManager {
  private static instance: LLMConfigManager | null = null;
  
  // 当前活跃配置
  private configs: Map<LLMProvider, LLMConfig> = new Map();
  
  // 默认供应商
  private defaultProvider: LLMProvider;
  
  // 备用供应商列表（按优先级排序）
  private fallbackProviders: LLMProvider[] = [];
  
  // Token 使用统计
  private tokenUsageHistory: TokenUsage[] = [];
  private totalTokenUsage: Map<LLMProvider, number> = new Map();
  
  // 私有构造函数
  private constructor() {
    this.defaultProvider = this.detectDefaultProvider();
    this.loadConfigs();
    this.setupFallbackChain();
  }
  
  // ==================== 单例获取 ====================
  
  static getInstance(): LLMConfigManager {
    if (!LLMConfigManager.instance) {
      LLMConfigManager.instance = new LLMConfigManager();
    }
    return LLMConfigManager.instance;
  }
  
  static resetInstance(): void {
    if (LLMConfigManager.instance) {
      LLMConfigManager.instance = null;
    }
  }
  
  // ==================== 初始化方法 ====================
  
  /**
   * 检测默认供应商
   */
  private detectDefaultProvider(): LLMProvider {
    const envProvider = process.env.AI_PROVIDER;
    if (isLLMProvider(envProvider) && PROVIDER_CONFIGS[envProvider]) {
      return envProvider;
    }
    
    // 按优先级检测可用的 API Key
    const priorityOrder: LLMProvider[] = ['deepseek', 'openai', 'google', 'moonshot', 'anthropic'];
    for (const provider of priorityOrder) {
      const envKey = PROVIDER_CONFIGS[provider].envKey;
      if (process.env[envKey]) {
        return provider;
      }
    }
    
    // 默认使用 DeepSeek
    return 'deepseek';
  }
  
  /**
   * 加载所有配置
   */
  private loadConfigs(): void {
    for (const [providerKey, config] of Object.entries(PROVIDER_CONFIGS)) {
      if (!isLLMProvider(providerKey)) continue;
      const provider = providerKey;
      const apiKey = process.env[config.envKey] || '';
      
      if (apiKey) {
        const llmConfig: LLMConfig = {
          provider: provider,
          model: process.env[`${provider.toUpperCase()}_MODEL`] || config.defaultModel,
          apiKey,
          baseUrl: process.env[`${provider.toUpperCase()}_BASE_URL`] || config.baseUrl,
          timeout: parseInt(process.env[`${provider.toUpperCase()}_TIMEOUT`] || '30000'),
          maxRetries: parseInt(process.env[`${provider.toUpperCase()}_MAX_RETRIES`] || '3'),
          temperature: parseFloat(process.env[`${provider.toUpperCase()}_TEMPERATURE`] || '0.7'),
          maxTokens: parseInt(process.env[`${provider.toUpperCase()}_MAX_TOKENS`] || '1000'),
        };
        
        this.configs.set(provider, llmConfig);
        logger.debug(`已加载 ${config.name} 配置`);
      }
    }
    
    // 隐藏 API Key 的日志输出
    const loadedProviders = Array.from(this.configs.keys());
    if (loadedProviders.length > 0) {
      logger.info(`✅ LLM 配置管理器已初始化，可用供应商: ${loadedProviders.join(', ')}`);
    } else {
      logger.warn('⚠️ 未检测到任何 LLM API Key，AI 功能将使用本地模式');
    }
  }
  
  /**
   * 设置备用供应商链
   */
  private setupFallbackChain(): void {
    // 所有已配置的供应商，排除默认供应商
    this.fallbackProviders = Array.from(this.configs.keys())
      .filter(p => p !== this.defaultProvider);
    
    logger.debug(`备用供应商链: ${this.fallbackProviders.join(' → ')}`);
  }
  
  // ==================== 公共 API ====================
  
  /**
   * 获取指定供应商的配置
   */
  getConfig(provider?: LLMProvider): LLMConfig | null {
    const targetProvider = provider || this.defaultProvider;
    return this.configs.get(targetProvider) || null;
  }
  
  /**
   * 获取默认供应商配置
   */
  getDefaultConfig(): LLMConfig | null {
    return this.getConfig(this.defaultProvider);
  }
  
  /**
   * 获取所有已配置的供应商
   */
  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.configs.keys());
  }
  
  /**
   * 获取默认供应商
   */
  getDefaultProvider(): LLMProvider {
    return this.defaultProvider;
  }
  
  /**
   * 设置默认供应商
   */
  setDefaultProvider(provider: LLMProvider): boolean {
    if (this.configs.has(provider)) {
      this.defaultProvider = provider;
      this.setupFallbackChain();
      logger.info(`默认 LLM 供应商已切换为: ${PROVIDER_CONFIGS[provider].name}`);
      return true;
    }
    logger.warn(`无法设置默认供应商: ${provider} 未配置`);
    return false;
  }
  
  /**
   * 获取备用供应商列表
   */
  getFallbackProviders(): LLMProvider[] {
    return [...this.fallbackProviders];
  }
  
  /**
   * 获取下一个可用的备用供应商
   */
  getNextFallback(currentProvider: LLMProvider): LLMProvider | null {
    const currentIndex = this.fallbackProviders.indexOf(currentProvider);
    if (currentIndex >= 0 && currentIndex < this.fallbackProviders.length - 1) {
      return this.fallbackProviders[currentIndex + 1] ?? null;
    }
    
    // 如果当前是默认供应商，从备用列表第一个开始
    if (currentProvider === this.defaultProvider && this.fallbackProviders.length > 0) {
      return this.fallbackProviders[0] ?? null;
    }
    
    return null;
  }
  
  /**
   * 检查供应商是否可用
   */
  isProviderAvailable(provider: LLMProvider): boolean {
    const config = this.configs.get(provider);
    return !!config && config.apiKey.length > 0;
  }
  
  /**
   * 验证配置
   */
  validateConfig(config: LLMConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.apiKey || config.apiKey.length < 10) {
      errors.push('API Key 无效或过短');
    }
    
    if (!PROVIDER_CONFIGS[config.provider]) {
      errors.push(`不支持的供应商: ${config.provider}`);
    }
    
    if (config.timeout && config.timeout < 1000) {
      errors.push('超时时间过短，最小 1000ms');
    }
    
    if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('Temperature 必须在 0-2 之间');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  // ==================== Token 使用统计 ====================
  
  /**
   * 记录 Token 使用
   */
  recordTokenUsage(usage: TokenUsage): void {
    this.tokenUsageHistory.push(usage);
    
    // 更新累计统计
    const currentTotal = this.totalTokenUsage.get(usage.provider) || 0;
    this.totalTokenUsage.set(usage.provider, currentTotal + usage.totalTokens);
    
    // 保留最近 1000 条记录
    if (this.tokenUsageHistory.length > 1000) {
      this.tokenUsageHistory.shift();
    }
  }
  
  /**
   * 获取累计 Token 使用量
   */
  getTotalTokenUsage(provider?: LLMProvider): number {
    if (provider) {
      return this.totalTokenUsage.get(provider) || 0;
    }
    
    let total = 0;
    const values = Array.from(this.totalTokenUsage.values());
    for (const count of values) {
      total += count;
    }
    return total;
  }
  
  /**
   * 获取最近的 Token 使用记录
   */
  getRecentTokenUsage(limit: number = 100): TokenUsage[] {
    return this.tokenUsageHistory.slice(-limit);
  }
  
  /**
   * 获取 Token 使用统计摘要
   */
  getTokenUsageSummary(): Partial<Record<LLMProvider, { total: number; count: number; avgPerRequest: number }>> {
    type UsageStat = { total: number; count: number; avgPerRequest: number };
    const summary: Partial<Record<LLMProvider, UsageStat>> = {};
    const providers = Array.from(this.configs.keys());
    for (const provider of providers) {
      const records = this.tokenUsageHistory.filter(r => r.provider === provider);
      const total = this.totalTokenUsage.get(provider) || 0;
      
      summary[provider] = {
        total,
        count: records.length,
        avgPerRequest: records.length > 0 ? total / records.length : 0,
      };
    }
    
    return summary;
  }
  
  // ==================== 供应商信息 ====================
  
  /**
   * 获取供应商配置信息
   */
  getProviderInfo(provider: LLMProvider): ProviderConfig | null {
    return PROVIDER_CONFIGS[provider] || null;
  }
  
  /**
   * 获取所有供应商信息
   */
  getAllProviderInfos(): Record<LLMProvider, ProviderConfig> {
    return { ...PROVIDER_CONFIGS };
  }
}

// ==================== 导出 ====================

export const llmConfigManager = LLMConfigManager.getInstance();
export default LLMConfigManager;
