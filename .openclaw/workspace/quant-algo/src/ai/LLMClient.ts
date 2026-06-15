import { toError } from '../utils/errorUtils';
/**
 * 统一 LLM 客户端
 * 支持多供应商、智能重试、Token 监控、响应缓存、超时控制
 */

import { LLMConfigManager, type LLMConfig, type LLMProvider, type TokenUsage } from './LLMConfigManager';
import { metricsCollector } from '../monitoring/MetricsCollector';
import logger from '../logger';

// ==================== 类型定义 ====================

/**
 * LLM 请求参数
 */
export interface LLMRequestOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'text' | 'json_object' };
  timeout?: number;
  maxRetries?: number;
  useCache?: boolean;
  cacheKey?: string;
  fallbackEnabled?: boolean;
  provider?: LLMProvider;
}

/**
 * LLM 响应
 */
export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
  cached: boolean;
  finishReason: string;
  thinking?: string; // DeepSeek 推理内容
}

/**
 * 缓存条目
 */
interface CacheEntry {
  response: LLMResponse;
  timestamp: number;
  ttl: number;
}

/**
 * 重试配置
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

// ==================== 默认配置 ====================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

// ==================== LLM 客户端类 ====================

export class LLMClient {
  private static instance: LLMClient | null = null;
  
  private configManager: LLMConfigManager;
  
  // 响应缓存
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize = 100;
  
  // 并发控制
  private activeRequests: Map<string, Promise<LLMResponse>> = new Map();
  
  // 默认配置
  private defaultTimeout = 30000;
  private defaultMaxRetries = 3;
  
  // 私有构造函数
  private constructor() {
    this.configManager = LLMConfigManager.getInstance();
    this.startCacheCleanup();
  }
  
  // ==================== 单例获取 ====================
  
  static getInstance(): LLMClient {
    if (!LLMClient.instance) {
      LLMClient.instance = new LLMClient();
    }
    return LLMClient.instance;
  }
  
  static resetInstance(): void {
    if (LLMClient.instance) {
      LLMClient.instance = null;
    }
  }
  
  // ==================== 核心方法 ====================
  
  /**
   * 发送 LLM 请求
   */
  async chat(options: LLMRequestOptions): Promise<LLMResponse> {
    const provider = options.provider || this.configManager.getDefaultProvider();
    
    // 检查缓存
    if (options.useCache !== false) {
      const cacheKey = options.cacheKey || this.generateCacheKey(options, provider);
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        logger.debug(`[LLM] 命中缓存: ${provider}`);
        return { ...cached, cached: true };
      }
    }
    
    // 并发控制：相同请求合并
    const requestKey = this.generateRequestKey(options, provider);
    const existingRequest = this.activeRequests.get(requestKey);
    if (existingRequest) {
      logger.debug(`[LLM] 合并重复请求: ${provider}`);
      return existingRequest;
    }
    
    // 创建新请求
    const request = this.executeWithFallback(options, provider);
    this.activeRequests.set(requestKey, request);
    
    try {
      const response = await request;
      
      // 缓存响应
      if (options.useCache !== false) {
        const cacheKey = options.cacheKey || this.generateCacheKey(options, provider);
        this.cacheResponse(cacheKey, response);
      }
      
      return response;
    } finally {
      this.activeRequests.delete(requestKey);
    }
  }
  
  /**
   * 带降级的执行
   */
  private async executeWithFallback(
    options: LLMRequestOptions,
    initialProvider: LLMProvider
  ): Promise<LLMResponse> {
    // 检查是否启用降级
    const fallbackEnabled = options.fallbackEnabled !== false;
    
    // 尝试主供应商
    try {
      return await this.executeWithRetry(options, initialProvider);
    } catch (primaryError) {
      if (!fallbackEnabled) {
        throw primaryError;
      }
      
      logger.warn(`[LLM] 主供应商 ${initialProvider} 失败，尝试降级`);
      
      // 尝试备用供应商
      let currentProvider: LLMProvider | null = initialProvider;
      while ((currentProvider = this.configManager.getNextFallback(currentProvider!))) {
        try {
          logger.info(`[LLM] 降级到备用供应商: ${currentProvider}`);
          return await this.executeWithRetry(options, currentProvider);
        } catch (fallbackError) {
          logger.warn(`[LLM] 备用供应商 ${currentProvider} 也失败`);
          continue;
        }
      }
      
      // 所有供应商都失败，返回默认响应
      logger.error('[LLM] 所有供应商都失败，返回默认响应');
      return this.getDefaultResponse(options, initialProvider);
    }
  }
  
  /**
   * 带重试的执行
   */
  private async executeWithRetry(
    options: LLMRequestOptions,
    provider: LLMProvider
  ): Promise<LLMResponse> {
    const config = this.configManager.getConfig(provider);
    if (!config) {
      throw new Error(`供应商 ${provider} 未配置`);
    }
    
    const maxRetries = options.maxRetries ?? config.maxRetries ?? this.defaultMaxRetries;
    const timeout = options.timeout ?? config.timeout ?? this.defaultTimeout;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeRequest(options, config, timeout);
        return response;
      } catch (error: unknown) {
        lastError = toError(error);
        
        // 判断是否可重试
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // 最后一次尝试不再等待
        if (attempt < maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          logger.debug(`[LLM] 重试 ${attempt + 1}/${maxRetries}，等待 ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError || new Error('所有重试失败');
  }
  
  /**
   * 执行实际请求
   */
  private async executeRequest(
    options: LLMRequestOptions,
    config: LLMConfig,
    timeout: number
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = options.model || config.model;
    
    // 构建请求体
    const requestBody = this.buildRequestBody(options, model, config);
    
    // 构建请求 URL
    const url = this.buildRequestUrl(config);
    
    // 构建请求头
    const headers = this.buildRequestHeaders(config);
    
    // 创建超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // 记录指标
    const timer = metricsCollector.startLlmTimer(config.provider, model);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      timer();
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 错误 (${response.status}): ${errorText.substring(0, 100)}`);
      }
      
      const data = await response.json();
      const llmResponse = this.parseResponse(data, config, model, startTime);
      
      // 记录 Token 使用
      this.recordTokenUsage(llmResponse, config);
      
      return llmResponse;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      timer();
      
      // 记录错误
      metricsCollector.recordError('llm', (error instanceof Error ? error.name : 'Unknown') || 'unknown', 'medium');
      
      throw error;
    }
  }
  
  /**
   * 构建请求体
   */
  private buildRequestBody(
    options: LLMRequestOptions,
    model: string,
    config: LLMConfig
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? config.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? config.maxTokens ?? 1000,
    };
    
    // JSON 响应格式
    if (options.responseFormat?.type === 'json_object') {
      body.response_format = { type: 'json_object' };
    }
    
    // DeepSeek 特殊处理
    if (config.provider === 'deepseek' && model === 'deepseek-reasoner') {
      // DeepSeek Reasoner 支持推理输出
    }
    
    return body;
  }
  
  /**
   * 构建请求 URL
   */
  private buildRequestUrl(config: LLMConfig): string {
    const baseUrl = config.baseUrl || '';
    
    // Anthropic 使用不同的端点
    if (config.provider === 'anthropic') {
      return `${baseUrl}/messages`;
    }
    
    // OpenAI 兼容的端点
    return `${baseUrl}/chat/completions`;
  }
  
  /**
   * 构建请求头
   */
  private buildRequestHeaders(config: LLMConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // 不同供应商的认证方式
    switch (config.provider) {
      case 'anthropic':
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'google':
        // Google 使用 URL 参数传递 API Key
        break;
      default:
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    
    return headers;
  }
  
  /**
   * 解析响应
   */
  private parseResponse(
    data: { content?: { text?: string }[]; choices?: { message?: { content?: string; reasoning_content?: string }; finish_reason?: string }[]; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } },
    config: LLMConfig,
    model: string,
    startTime: number
  ): LLMResponse {
    let content = '';
    let thinking = '';
    
    // Anthropic 响应格式不同
    if (config.provider === 'anthropic') {
      content = data.content?.[0]?.text || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
      // DeepSeek 推理内容
      thinking = data.choices?.[0]?.message?.reasoning_content || '';
    }
    
    const usage = data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    
    return {
      content,
      provider: config.provider,
      model,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      latency: Date.now() - startTime,
      cached: false,
      finishReason: data.choices?.[0]?.finish_reason || 'stop',
      thinking,
    };
  }
  
  /**
   * 记录 Token 使用
   */
  private recordTokenUsage(response: LLMResponse, config: LLMConfig): void {
    const usage: TokenUsage = {
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      timestamp: Date.now(),
      provider: config.provider,
      model: response.model,
    };
    
    this.configManager.recordTokenUsage(usage);
    
    // Prometheus 指标
    metricsCollector.recordLlmTokens(
      config.provider,
      response.model,
      'chat',
      response.usage.totalTokens
    );
    metricsCollector.recordLlmRequest(config.provider, response.model, 'chat');
    
    logger.debug(
      `[LLM] Token 使用: ${response.usage.totalTokens} (${config.provider}/${response.model})`
    );
  }
  
  // ==================== 缓存方法 ====================
  
  /**
   * 生成缓存键
   */
  private generateCacheKey(options: LLMRequestOptions, provider: LLMProvider): string {
    const content = JSON.stringify({
      messages: options.messages,
      model: options.model,
      temperature: options.temperature,
      provider,
    });
    
    // 简单哈希
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `llm:${provider}:${Math.abs(hash).toString(16)}`;
  }
  
  /**
   * 生成请求键（用于并发控制）
   */
  private generateRequestKey(options: LLMRequestOptions, provider: LLMProvider): string {
    return this.generateCacheKey(options, provider);
  }
  
  /**
   * 获取缓存响应
   */
  private getCachedResponse(key: string): LLMResponse | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.response;
  }
  
  /**
   * 缓存响应
   */
  private cacheResponse(key: string, response: LLMResponse): void {
    // 限制缓存大小
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      response: { ...response, cached: false },
      timestamp: Date.now(),
      ttl: DEFAULT_CACHE_TTL,
    });
  }
  
  /**
   * 清理过期缓存
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.cache.entries());
      for (const [key, entry] of entries) {
        if (now > entry.timestamp + entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // 每分钟清理一次
  }
  
  // ==================== 辅助方法 ====================
  
  /**
   * 计算退避延迟
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = DEFAULT_RETRY_CONFIG.baseDelay * 
      Math.pow(DEFAULT_RETRY_CONFIG.backoffMultiplier, attempt);
    return Math.min(delay, DEFAULT_RETRY_CONFIG.maxDelay);
  }
  
  /**
   * 判断是否可重试错误
   */
  private isRetryableError(error: unknown): boolean {
    const err = error as { name?: string; code?: string; message?: string };
    // 超时
    if (err.name === 'AbortError') {
      return true;
    }
    
    // 网络错误
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      return true;
    }
    
    // 服务器错误 (5xx)
    if (err.message?.includes('5')) {
      return true;
    }
    
    // 速率限制
    if (err.message?.includes('429')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 获取默认响应（降级）
   */
  private getDefaultResponse(
    options: LLMRequestOptions,
    provider: LLMProvider
  ): LLMResponse {
    // 尝试从最后一条用户消息中提取意图
    const lastMessage = options.messages[options.messages.length - 1];
    const content = lastMessage?.content || '';
    
    // 根据内容生成简单响应
    let defaultContent = '无法连接到 AI 服务，请稍后再试。';
    
    // 如果请求 JSON 格式，返回默认 JSON
    if (options.responseFormat?.type === 'json_object') {
      defaultContent = JSON.stringify({
        action: 'hold',
        confidence: 0.3,
        reasoning: ['AI 服务不可用，默认持有'],
        riskLevel: 'medium',
      });
    }
    
    return {
      content: defaultContent,
      provider,
      model: 'fallback',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      latency: 0,
      cached: false,
      finishReason: 'fallback',
    };
  }
  
  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ==================== 公共 API ====================
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('[LLM] 缓存已清除');
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }
  
  /**
   * 快速调用（简化 API）
   */
  async quickChat(
    prompt: string,
    options?: Partial<LLMRequestOptions>
  ): Promise<string> {
    const response = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      ...options,
    });
    
    return response.content;
  }
  
  /**
   * JSON 模式调用
   */
  async chatJson<T = unknown>(
    prompt: string,
    options?: Partial<LLMRequestOptions>
  ): Promise<T> {
    const response = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      responseFormat: { type: 'json_object' },
      ...options,
    });
    
    try {
      return JSON.parse(response.content);
    } catch {
      throw new Error('无法解析 JSON 响应');
    }
  }
}

// ==================== 导出 ====================

export const llmClient = LLMClient.getInstance();
export default LLMClient;
