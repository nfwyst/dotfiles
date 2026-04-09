/**
 * 预配置熔断器实例
 * 
 * 为不同模块提供预配置的熔断器实例
 */

import { CircuitBreaker } from './CircuitBreaker';
import type { CircuitBreakerConfig, CircuitState, StateChangeEvent, CircuitBreakerStats } from './CircuitBreaker';
import logger from '../logger';

// ==================== 预配置熔断器实例 ====================

/**
 * 交易所 API 熔断器
 * 
 * 配置说明：
 * - 失败阈值：3次（API 故障快速熔断）
 * - 重置超时：30秒（快速尝试恢复）
 * - 超时时间：15秒（API 响应较长）
 */
export const exchangeCircuitBreaker = new CircuitBreaker({
  name: 'exchange-api',
  failureThreshold: 3,
  resetTimeout: 30000,       // 30秒
  halfOpenMaxCalls: 2,
  timeout: 15000,            // 15秒
  successThreshold: 2,
  enableFallback: true,
  fallbackValue: null,       // 返回 null 作为降级值
});

/**
 * AI/LLM 调用熔断器
 * 
 * 配置说明：
 * - 失败阈值：5次（LLM 偶尔失败可容忍）
 * - 重置超时：60秒（LLM 服务恢复较慢）
 * - 超时时间：30秒（LLM 响应较长）
 */
export const aiCircuitBreaker = new CircuitBreaker({
  name: 'ai-llm',
  failureThreshold: 5,
  resetTimeout: 60000,       // 60秒
  halfOpenMaxCalls: 3,
  timeout: 30000,            // 30秒
  successThreshold: 2,
  enableFallback: true,
  fallbackValue: null,
});

/**
 * 订单执行熔断器
 * 
 * 配置说明：
 * - 失败阈值：2次（交易执行必须可靠，快速熔断）
 * - 重置超时：10秒（交易执行需要快速恢复）
 * - 超时时间：10秒（订单执行不能太慢）
 */
export const executionCircuitBreaker = new CircuitBreaker({
  name: 'order-execution',
  failureThreshold: 2,
  resetTimeout: 10000,       // 10秒
  halfOpenMaxCalls: 1,       // 半开状态只允许一次调用
  timeout: 10000,            // 10秒
  successThreshold: 1,       // 成功一次即可恢复
  enableFallback: true,
  fallbackValue: null,
});

/**
 * WebSocket 连接熔断器
 * 
 * 配置说明：
 * - 失败阈值：3次
 * - 重置超时：15秒
 * - 超时时间：5秒
 */
export const websocketCircuitBreaker = new CircuitBreaker({
  name: 'websocket',
  failureThreshold: 3,
  resetTimeout: 15000,       // 15秒
  halfOpenMaxCalls: 2,
  timeout: 5000,             // 5秒
  successThreshold: 1,
  enableFallback: true,
  fallbackValue: null,
});

// ==================== 熔断器管理器 ====================

/**
 * 熔断器管理器
 * 
 * 统一管理所有熔断器实例，提供批量操作和监控
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager | null = null;
  
  /** 所有熔断器实例 */
  private breakers: Map<string, CircuitBreaker> = new Map();
  
  /** 全局告警回调 */
  private globalAlertCallbacks: Array<(name: string, event: StateChangeEvent) => void> = [];

  private constructor() {
    // 注册预配置熔断器
    this.register('exchange', exchangeCircuitBreaker);
    this.register('ai', aiCircuitBreaker);
    this.register('execution', executionCircuitBreaker);
    this.register('websocket', websocketCircuitBreaker);
  }

  /**
   * 获取单例实例
   */
  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * 注册熔断器
   */
  register(name: string, breaker: CircuitBreaker): void {
    this.breakers.set(name, breaker);
    
    // 注册告警回调
    breaker.onAlert((event) => {
      this.handleAlert(name, event);
    });
    
    logger.debug(`[CircuitBreakerManager] 注册熔断器: ${name}`);
  }

  /**
   * 获取熔断器
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * 获取所有熔断器状态
   */
  getAllStates(): Record<string, { state: CircuitState; stats: CircuitBreakerStats }> {
    const result: Record<string, { state: CircuitState; stats: CircuitBreakerStats }> = {};
    
    for (const [name, breaker] of this.breakers) {
      result[name] = {
        state: breaker.getState(),
        stats: breaker.getStats(),
      };
    }
    
    return result;
  }

  /**
   * 检查所有熔断器是否健康
   */
  isAllHealthy(): boolean {
    for (const breaker of this.breakers.values()) {
      if (!breaker.isHealthy()) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取熔断中的熔断器列表
   */
  getOpenBreakers(): string[] {
    const result: string[] = [];
    
    for (const [name, breaker] of this.breakers) {
      if (breaker.isOpen()) {
        result.push(name);
      }
    }
    
    return result;
  }

  /**
   * 重置所有熔断器
   */
  resetAll(): void {
    for (const [name, breaker] of this.breakers) {
      breaker.reset();
      logger.info(`[CircuitBreakerManager] 重置熔断器: ${name}`);
    }
  }

  /**
   * 注册全局告警回调
   */
  onGlobalAlert(callback: (name: string, event: StateChangeEvent) => void): void {
    this.globalAlertCallbacks.push(callback);
  }

  /**
   * 移除全局告警回调
   */
  offGlobalAlert(callback: (name: string, event: StateChangeEvent) => void): void {
    this.globalAlertCallbacks = this.globalAlertCallbacks.filter(cb => cb !== callback);
  }

  /**
   * 处理告警
   */
  private handleAlert(name: string, event: StateChangeEvent): void {
    logger.warn(`🚨 [CircuitBreakerManager] 熔断告警: ${name}`, event);
    
    for (const callback of this.globalAlertCallbacks) {
      try {
        callback(name, event);
      } catch (error) {
        logger.error('[CircuitBreakerManager] 告警回调执行失败:', error);
      }
    }
  }

  /**
   * 清理所有熔断器
   */
  cleanup(): void {
    for (const breaker of this.breakers.values()) {
      breaker.cleanup();
    }
    this.breakers.clear();
    this.globalAlertCallbacks = [];
  }
}

// ==================== 导出 ====================

export const circuitBreakerManager = CircuitBreakerManager.getInstance();

export default {
  exchangeCircuitBreaker,
  aiCircuitBreaker,
  executionCircuitBreaker,
  websocketCircuitBreaker,
  circuitBreakerManager,
};
