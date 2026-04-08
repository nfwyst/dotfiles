/**
 * 熔断器 - Circuit Breaker
 * 
 * 核心容错模式，防止故障扩散：
 * - 三种状态：CLOSED(正常) → OPEN(熔断) → HALF_OPEN(半开)
 * - 失败计数和阈值检测
 * - 自动恢复机制
 * 
 * 使用示例：
 * ```ts
 * const cb = new CircuitBreaker({ name: 'api' });
 * const result = await cb.execute(async () => fetch('/api'));
 * ```
 */

import logger from '../logger';
import { metricsCollector } from '../monitoring';

// ==================== 类型定义 ====================

/**
 * 熔断器状态
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  /** 熔断器名称（用于日志和监控） */
  name: string;
  /** 失败阈值（达到此数值触发熔断） */
  failureThreshold: number;
  /** 重置超时时间（毫秒，熔断后等待多久尝试恢复） */
  resetTimeout: number;
  /** 半开状态最大调用次数 */
  halfOpenMaxCalls: number;
  /** 单次调用超时时间（毫秒） */
  timeout: number;
  /** 成功阈值（半开状态下连续成功多少次后恢复 CLOSED） */
  successThreshold: number;
  /** 是否启用降级响应（默认 true） */
  enableFallback: boolean;
  /** 熔断时返回的降级数据（可选） */
  fallbackValue?: unknown;
}

/**
 * 熔断器统计信息
 */
export interface CircuitBreakerStats {
  /** 当前状态 */
  state: CircuitState;
  /** 失败计数 */
  failureCount: number;
  /** 成功计数 */
  successCount: number;
  /** 总调用次数 */
  totalCalls: number;
  /** 失败率（百分比） */
  failureRate: number;
  /** 成功率（百分比） */
  successRate: number;
  /** 最近失败原因 */
  lastFailureReason: string | null;
  /** 最近失败时间 */
  lastFailureTime: number | null;
  /** 熔断器打开时间 */
  openedAt: number | null;
  /** 半开状态成功计数 */
  halfOpenSuccessCount: number;
  /** 半开状态调用计数 */
  halfOpenCallCount: number;
}

/**
 * 状态变更事件
 */
export interface StateChangeEvent {
  /** 之前的状态 */
  previousState: CircuitState;
  /** 新状态 */
  newState: CircuitState;
  /** 变更原因 */
  reason: string;
  /** 时间戳 */
  timestamp: number;
  /** 统计信息 */
  stats: CircuitBreakerStats;
}

/**
 * 熔断器结果
 */
export interface CircuitBreakerResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 返回值（成功时） */
  value?: T;
  /** 错误信息（失败时） */
  error?: string;
  /** 是否为降级响应 */
  isFallback: boolean;
  /** 熔断器状态 */
  state: CircuitState;
  /** 执行时间（毫秒） */
  duration: number;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  resetTimeout: 60000,       // 60秒
  halfOpenMaxCalls: 3,
  timeout: 10000,            // 10秒
  successThreshold: 2,
  enableFallback: true,
};

// ==================== CircuitBreaker 类 ====================

export class CircuitBreaker {
  /** 配置 */
  private config: CircuitBreakerConfig;
  
  /** 当前状态 */
  private state: CircuitState = 'CLOSED';
  
  /** 失败计数 */
  private failureCount: number = 0;
  
  /** 成功计数 */
  private successCount: number = 0;
  
  /** 总调用次数 */
  private totalCalls: number = 0;
  
  /** 最近失败原因 */
  private lastFailureReason: string | null = null;
  
  /** 最近失败时间 */
  private lastFailureTime: number | null = null;
  
  /** 熔断器打开时间 */
  private openedAt: number | null = null;
  
  /** 半开状态成功计数 */
  private halfOpenSuccessCount: number = 0;
  
  /** 半开状态调用计数 */
  private halfOpenCallCount: number = 0;
  
  /** 恢复定时器 */
  private resetTimer: NodeJS.Timeout | null = null;
  
  /** 状态变更回调 */
  private stateChangeCallbacks: Array<(event: StateChangeEvent) => void> = [];
  
  /** 告警回调 */
  private alertCallbacks: Array<(event: StateChangeEvent) => void> = [];

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.debug(`[CircuitBreaker:${this.config.name}] 初始化完成`, this.config);
  }

  // ==================== 核心方法 ====================

  /**
   * 执行函数（带熔断保护）
   * 
   * @param fn 要执行的异步函数
   * @param fallback 可选的降级函数
   * @returns 执行结果
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<CircuitBreakerResult<T>> {
    const startTime = Date.now();
    
    // 1. 检查状态
    if (this.state === 'OPEN') {
      // 检查是否可以尝试恢复
      if (this.shouldAttemptReset()) {
        this.transitionTo('HALF_OPEN', '重置超时，尝试恢复');
      } else {
        // 熔断中，返回降级响应
        return this.handleOpenState(fallback, startTime);
      }
    }

    // 2. 检查半开状态调用限制
    if (this.state === 'HALF_OPEN' && this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
      return this.handleOpenState(fallback, startTime);
    }

    // 3. 执行函数（带超时）
    try {
      const value = await this.executeWithTimeout(fn);
      this.onSuccess();
      
      return {
        success: true,
        value,
        isFallback: false,
        state: this.state,
        duration: Date.now() - startTime,
      };
    } catch (error: unknown) {
      this.onFailure(error);
      
      // 尝试降级
      if (this.config.enableFallback) {
        const fallbackResult = await this.tryFallback(fallback, startTime);
        if (fallbackResult) {
          return fallbackResult;
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        isFallback: false,
        state: this.state,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 带超时执行
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`执行超时 (${this.config.timeout}ms)`));
      }, this.config.timeout);

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * 处理 OPEN 状态
   */
  private async handleOpenState<T>(
    fallback?: () => Promise<T> | T,
    startTime: number = Date.now()
  ): Promise<CircuitBreakerResult<T>> {
    const fallbackResult = await this.tryFallback(fallback, startTime);
    if (fallbackResult) {
      return fallbackResult;
    }

    return {
      success: false,
      error: `熔断器已打开 (${this.config.name})`,
      isFallback: false,
      state: 'OPEN',
      duration: Date.now() - startTime,
    };
  }

  /**
   * 尝试降级
   */
  private async tryFallback<T>(
    fallback?: () => Promise<T> | T,
    startTime: number = Date.now()
  ): Promise<CircuitBreakerResult<T> | null> {
    // 优先使用传入的降级函数
    if (fallback) {
      try {
        const value = await fallback();
        return {
          success: true,
          value,
          isFallback: true,
          state: this.state,
          duration: Date.now() - startTime,
        };
      } catch (error: unknown) {
        logger.warn(`[CircuitBreaker:${this.config.name}] 降级函数执行失败:`, error instanceof Error ? error.message : String(error));
      }
    }

    // 使用配置的降级值
    if (this.config.fallbackValue !== undefined) {
      return {
        success: true,
        value: this.config.fallbackValue,
        isFallback: true,
        state: this.state,
        duration: Date.now() - startTime,
      };
    }

    return null;
  }

  // ==================== 状态转换 ====================

  /**
   * 成功回调
   */
  private onSuccess(): void {
    this.totalCalls++;
    this.successCount++;

    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccessCount++;
      this.halfOpenCallCount++;
      
      // 半开状态下连续成功达到阈值，恢复为 CLOSED
      if (this.halfOpenSuccessCount >= this.config.successThreshold) {
        this.transitionTo('CLOSED', '半开状态成功次数达标，恢复正常');
      }
    } else if (this.state === 'CLOSED') {
      // CLOSED 状态下成功，重置失败计数
      this.failureCount = 0;
    }
  }

  /**
   * 失败回调
   */
  private onFailure(error: unknown): void {
    this.totalCalls++;
    this.failureCount++;
    this.lastFailureReason = error instanceof Error ? error.message : String(error);
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // 半开状态下失败，立即重新熔断
      this.halfOpenCallCount++;
      this.transitionTo('OPEN', `半开状态下失败: ${this.lastFailureReason}`);
    } else if (this.state === 'CLOSED') {
      // CLOSED 状态下检查是否需要熔断
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('OPEN', `失败次数达到阈值 (${this.failureCount}/${this.config.failureThreshold})`);
      }
    }

    logger.warn(
      `[CircuitBreaker:${this.config.name}] 执行失败: ${this.lastFailureReason} | ` +
      `失败计数: ${this.failureCount}/${this.config.failureThreshold}`
    );
  }

  /**
   * 状态转换
   */
  private transitionTo(newState: CircuitState, reason: string): void {
    const previousState = this.state;
    this.state = newState;

    const event: StateChangeEvent = {
      previousState,
      newState,
      reason,
      timestamp: Date.now(),
      stats: this.getStats(),
    };

    if (newState === 'OPEN') {
      this.openedAt = Date.now();
      this.scheduleReset();
      logger.error(
        `🚨 [CircuitBreaker:${this.config.name}] 熔断器打开 | ` +
        `原因: ${reason}`
      );
      this.triggerAlert(event);
    } else if (newState === 'HALF_OPEN') {
      this.halfOpenSuccessCount = 0;
      this.halfOpenCallCount = 0;
      logger.info(
        `⚠️ [CircuitBreaker:${this.config.name}] 进入半开状态 | ` +
        `允许 ${this.config.halfOpenMaxCalls} 次探测调用`
      );
    } else if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.openedAt = null;
      this.halfOpenSuccessCount = 0;
      this.halfOpenCallCount = 0;
      this.cancelResetTimer();
      logger.info(
        `✅ [CircuitBreaker:${this.config.name}] 熔断器关闭，恢复正常 | ` +
        `原因: ${reason}`
      );
    }

    // Prometheus 指标：更新熔断器状态
    metricsCollector.updateCircuitBreakerState(
      this.config.name, 
      newState.toLowerCase() as 'closed' | 'open' | 'half_open'
    );
    
    // 触发状态变更回调
  }

  /**
   * 检查是否应该尝试重置
   */
  private shouldAttemptReset(): boolean {
    if (!this.openedAt) return false;
    return Date.now() - this.openedAt >= this.config.resetTimeout;
  }

  /**
   * 调度重置检查
   */
  private scheduleReset(): void {
    this.cancelResetTimer();
    
    this.resetTimer = setTimeout(() => {
      if (this.state === 'OPEN') {
        this.transitionTo('HALF_OPEN', '重置超时，进入半开状态');
      }
    }, this.config.resetTimeout);
  }

  /**
   * 取消重置定时器
   */
  private cancelResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  // ==================== 公共方法 ====================

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取失败计数
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * 获取成功计数
   */
  getSuccessCount(): number {
    return this.successCount;
  }

  /**
   * 获取统计信息
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      failureRate: this.totalCalls > 0 ? (this.failureCount / this.totalCalls) * 100 : 0,
      successRate: this.totalCalls > 0 ? (this.successCount / this.totalCalls) * 100 : 0,
      lastFailureReason: this.lastFailureReason,
      lastFailureTime: this.lastFailureTime,
      openedAt: this.openedAt,
      halfOpenSuccessCount: this.halfOpenSuccessCount,
      halfOpenCallCount: this.halfOpenCallCount,
    };
  }

  /**
   * 重置熔断器（手动）
   */
  reset(): void {
    this.transitionTo('CLOSED', '手动重置');
  }

  /**
   * 强制打开熔断器
   */
  forceOpen(reason: string = '手动触发'): void {
    this.transitionTo('OPEN', reason);
  }

  /**
   * 是否健康（CLOSED 状态）
   */
  isHealthy(): boolean {
    return this.state === 'CLOSED';
  }

  /**
   * 是否熔断中
   */
  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  /**
   * 是否半开状态
   */
  isHalfOpen(): boolean {
    return this.state === 'HALF_OPEN';
  }

  // ==================== 事件回调 ====================

  /**
   * 注册状态变更回调
   */
  onStateChange(callback: (event: StateChangeEvent) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * 移除状态变更回调
   */
  offStateChange(callback: (event: StateChangeEvent) => void): void {
    this.stateChangeCallbacks = this.stateChangeCallbacks.filter(cb => cb !== callback);
  }

  /**
   * 注册告警回调（状态变为 OPEN 时触发）
   */
  onAlert(callback: (event: StateChangeEvent) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * 移除告警回调
   */
  offAlert(callback: (event: StateChangeEvent) => void): void {
    this.alertCallbacks = this.alertCallbacks.filter(cb => cb !== callback);
  }

  /**
   * 触发状态变更回调
   */
  private triggerStateChange(event: StateChangeEvent): void {
    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error(`[CircuitBreaker:${this.config.name}] 状态变更回调执行失败:`, error);
      }
    }
  }

  /**
   * 触发告警回调
   */
  private triggerAlert(event: StateChangeEvent): void {
    for (const callback of this.alertCallbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error(`[CircuitBreaker:${this.config.name}] 告警回调执行失败:`, error);
      }
    }
  }

  // ==================== 清理 ====================

  /**
   * 清理资源
   */
  cleanup(): void {
    this.cancelResetTimer();
    this.stateChangeCallbacks = [];
    this.alertCallbacks = [];
  }
}

export default CircuitBreaker;
