import { toError } from '../utils/errorUtils';
/**
 * 订单重试机制 - Order Retry Mechanism
 * 
 * 处理网络抖动和临时故障，确保交易执行的可靠性
 * - 指数退避重试
 * - 幂等性保证
 * - 重试队列管理
 * - 订单状态跟踪
 */

import logger from '../logger';
import { tradeLogger } from '../logger';
import NotificationManager from '../notifier';
import {
  tracingManager,
  getTraceContextForLogging,
} from '../monitoring/tracing';
// ========== 类型定义 ==========

/**
 * 订单状态
 */
export enum OrderStatus {
  PENDING = 'PENDING',       // 等待提交
  SUBMITTED = 'SUBMITTED',   // 已提交
  FILLED = 'FILLED',         // 已成交
  FAILED = 'FAILED',         // 最终失败
  RETRYING = 'RETRYING',     // 重试中
}

/**
 * 订单类型
 */
export type OrderType = 'open_long' | 'open_short' | 'close_long' | 'close_short';

/**
 * 订单请求
 */
interface OrderRequest {
  orderId: string;           // 幂等性 ID
  type: OrderType;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;            // 市价单可不填
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * 订单执行结果
 */
export interface OrderResult {
  orderId: string;
  status: OrderStatus;
  success: boolean;
  exchangeOrderId?: string;
  executedPrice?: number;
  executedQuantity?: number;
  retryCount: number;
  lastError?: string;
  timestamp: number;
}

/**
 * 交易所订单返回结果（通用接口）
 */
interface ExchangeOrderResult {
  id?: string;
  orderId?: string;
  price?: number;
  avgPrice?: number;
  quantity?: number;
  executedQty?: number;
}
/**
 * 重试记录
 */
interface RetryRecord {
  attempt: number;
  timestamp: number;
  delay: number;
  error: string;
  nextRetryAt?: number;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number;          // 最大重试次数 (默认: 5)
  maxRetryTime: number;        // 最大重试时间 ms (默认: 60000)
  initialDelay: number;        // 初始延迟 ms (默认: 1000)
  maxDelay: number;            // 最大延迟 ms (默认: 16000)
  backoffMultiplier: number;   // 退避倍数 (默认: 2)
  retryQueueCheckInterval: number; // 队列检查间隔 ms (默认: 5000)
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  maxRetryTime: 60000,       // 60秒
  initialDelay: 1000,        // 1秒
  maxDelay: 16000,           // 16秒
  backoffMultiplier: 2,
  retryQueueCheckInterval: 5000, // 5秒
};

// ========== 重试策略 ==========

/**
 * 指数退避重试策略
 */
class ExponentialBackoffStrategy {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * 计算下次重试延迟
   * 序列: 1s, 2s, 4s, 8s, 16s (指数退避)
   */
  calculateDelay(retryCount: number): number {
    const delay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier, retryCount);
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * 检查是否应该继续重试
   */
  shouldRetry(retryCount: number, startTime: number): boolean {
    if (retryCount >= this.config.maxRetries) {
      return false;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= this.config.maxRetryTime) {
      return false;
    }

    return true;
  }

  /**
   * 获取剩余重试次数
   */
  getRemainingRetries(retryCount: number): number {
    return Math.max(0, this.config.maxRetries - retryCount);
  }

  /**
   * 获取剩余重试时间
   */
  getRemainingTime(startTime: number): number {
    const elapsed = Date.now() - startTime;
    return Math.max(0, this.config.maxRetryTime - elapsed);
  }

  getConfig(): RetryConfig {
    return { ...this.config };
  }
}

// ========== 幂等性管理器 ==========

/**
 * 订单幂等性管理器
 * 使用订单ID去重，防止重复提交
 */
class IdempotencyManager {
  // 已提交订单缓存 (内存 + 可选持久化)
  private submittedOrders: Map<string, OrderResult> = new Map();
  
  // 订单执行中标记
  private pendingOrders: Set<string> = new Set();
  
  // 缓存过期时间 (默认 10 分钟)
  private readonly CACHE_TTL = 10 * 60 * 1000;
  
  // 定时清理
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * 检查订单是否已提交
   */
  hasSubmitted(orderId: string): boolean {
    return this.submittedOrders.has(orderId);
  }

  /**
   * 获取已提交订单结果
   */
  getSubmittedOrder(orderId: string): OrderResult | undefined {
    return this.submittedOrders.get(orderId);
  }

  /**
   * 检查订单是否正在执行中
   */
  isPending(orderId: string): boolean {
    return this.pendingOrders.has(orderId);
  }

  /**
   * 标记订单开始执行
   */
  markPending(orderId: string): void {
    this.pendingOrders.add(orderId);
  }

  /**
   * 标记订单执行完成
   */
  markCompleted(orderId: string, result: OrderResult): void {
    this.pendingOrders.delete(orderId);
    this.submittedOrders.set(orderId, result);
  }

  /**
   * 清理过期缓存
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      Array.from(this.submittedOrders.entries()).forEach(([orderId, result]) => {
        if (now - result.timestamp > this.CACHE_TTL) {
          this.submittedOrders.delete(orderId);
        }
      });
    }, this.CACHE_TTL);
  }

  /**
   * 停止清理定时器
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.submittedOrders.clear();
    this.pendingOrders.clear();
  }
}

// ========== 重试队列 ==========

/**
 * 重试队列项
 */
interface RetryQueueItem {
  request: OrderRequest;
  retryCount: number;
  startTime: number;
  nextRetryAt: number;
  history: RetryRecord[];
  executor: () => Promise<ExchangeOrderResult>;
}

/**
 * 重试队列管理器
 */
class RetryQueue {
  private queue: RetryQueueItem[] = [];
  private strategy: ExponentialBackoffStrategy;
  private checkInterval: NodeJS.Timeout | null = null;
  private processing: boolean = false;
  private onRetrySuccess?: (orderId: string, result: ExchangeOrderResult) => void;
  private onRetryFailed?: (orderId: string, error: string) => void;

  constructor(
    strategy: ExponentialBackoffStrategy,
    config: {
      onRetrySuccess?: (orderId: string, result: ExchangeOrderResult) => void;
      onRetryFailed?: (orderId: string, error: string) => void;
    } = {}
  ) {
    this.strategy = strategy;
    this.onRetrySuccess = config.onRetrySuccess;
    this.onRetryFailed = config.onRetryFailed;
    this.startProcessing();
  }

  /**
   * 添加订单到重试队列
   */
  enqueue(
    request: OrderRequest,
    executor: () => Promise<ExchangeOrderResult>,
    retryCount: number = 0,
    history: RetryRecord[] = []
  ): void {
    const delay = this.strategy.calculateDelay(retryCount);
    const now = Date.now();

    const item: RetryQueueItem = {
      request,
      retryCount,
      startTime: history.length > 0 && history[0] ? history[0].timestamp : now,
      nextRetryAt: now + delay,
      history,
      executor,
    };

    this.queue.push(item);
    logger.info(`📥 订单 ${request.orderId} 加入重试队列 | 第 ${retryCount + 1} 次重试将在 ${delay}ms 后执行`);
  }

  /**
   * 获取队列长度
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * 获取待重试订单列表
   */
  getPendingOrders(): Array<{ orderId: string; retryCount: number; nextRetryAt: number }> {
    return this.queue.map(item => ({
      orderId: item.request.orderId,
      retryCount: item.retryCount,
      nextRetryAt: item.nextRetryAt,
    }));
  }

  /**
   * 启动队列处理
   */
  private startProcessing(): void {
    const config = this.strategy.getConfig();
    this.checkInterval = setInterval(() => {
      this.processQueue();
    }, config.retryQueueCheckInterval);
  }

  /**
   * 处理重试队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const now = Date.now();

    // 找出需要重试的订单
    const readyItems = this.queue.filter(item => item.nextRetryAt <= now);

    for (const item of readyItems) {
      await this.processItem(item);
    }

    this.processing = false;
  }

  /**
   * 处理单个重试项
   */
  private async processItem(item: RetryQueueItem): Promise<void> {
    const { request, executor, retryCount, startTime, history } = item;

    // 检查是否还能重试
    if (!this.strategy.shouldRetry(retryCount, startTime)) {
      // 移除出队列
      this.queue = this.queue.filter(q => q.request.orderId !== request.orderId);

      // 触发失败回调
      if (this.onRetryFailed) {
        const errorMsg = `重试次数耗尽或超时 | 重试次数: ${retryCount}`;
        this.onRetryFailed(request.orderId, errorMsg);
      }

      logger.error(`❌ 订单 ${request.orderId} 重试失败 | 已达最大重试次数或超时`);
      return;
    }

    const delay = this.strategy.calculateDelay(retryCount);

    try {
      logger.info(`🔄 执行订单重试 | ID: ${request.orderId} | 第 ${retryCount + 1} 次重试`);
      
      const result = await executor();

      // 成功 - 移除出队列
      this.queue = this.queue.filter(q => q.request.orderId !== request.orderId);

      // 记录成功
      tradeLogger.info('订单重试成功', {
        orderId: request.orderId,
        retryCount: retryCount + 1,
        result,
      });

      logger.info(`✅ 订单 ${request.orderId} 重试成功 | 第 ${retryCount + 1} 次重试`);

      // 触发成功回调
      if (this.onRetrySuccess) {
        this.onRetrySuccess(request.orderId, result);
      }

    } catch (error: unknown) {
      // 记录失败
      const record: RetryRecord = {
        attempt: retryCount + 1,
        timestamp: Date.now(),
        delay,
        error: (error instanceof Error ? error.message : String(error)),
      };

      item.history.push(record);
      item.retryCount = retryCount + 1;
      item.nextRetryAt = Date.now() + this.strategy.calculateDelay(retryCount + 1);

      logger.warn(`⚠️ 订单 ${request.orderId} 重试失败 | 剩余重试: ${this.strategy.getRemainingRetries(retryCount + 1)} | 错误: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * 停止队列处理
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = [];
  }
}

// ========== 订单状态跟踪器 ==========

/**
 * 订单状态跟踪器
 */
class OrderTracker {
  private orders: Map<string, {
    request: OrderRequest;
    status: OrderStatus;
    result?: OrderResult;
    history: RetryRecord[];
    createdAt: number;
    updatedAt: number;
  }> = new Map();

  /**
   * 创建订单跟踪
   */
  create(request: OrderRequest): void {
    this.orders.set(request.orderId, {
      request,
      status: OrderStatus.PENDING,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  /**
   * 更新订单状态
   */
  updateStatus(orderId: string, status: OrderStatus, result?: OrderResult): void {
    const order = this.orders.get(orderId);
    if (!order) return;

    order.status = status;
    order.updatedAt = Date.now();
    if (result) {
      order.result = result;
    }
  }

  /**
   * 添加重试记录
   */
  addRetryRecord(orderId: string, record: RetryRecord): void {
    const order = this.orders.get(orderId);
    if (!order) return;

    order.history.push(record);
    order.updatedAt = Date.now();
  }

  /**
   * 获取订单状态
   */
  getStatus(orderId: string): OrderStatus | undefined {
    return this.orders.get(orderId)?.status;
  }

  /**
   * 获取订单详情
   */
  getOrder(orderId: string): {
    request: OrderRequest;
    status: OrderStatus;
    result?: OrderResult;
    history: RetryRecord[];
    createdAt: number;
    updatedAt: number;
  } | undefined {
    return this.orders.get(orderId);
  }

  /**
   * 获取所有订单统计
   */
  getStats(): {
    total: number;
    pending: number;
    submitted: number;
    filled: number;
    failed: number;
    retrying: number;
  } {
    let pending = 0, submitted = 0, filled = 0, failed = 0, retrying = 0;

    Array.from(this.orders.values()).forEach(order => {
      switch (order.status) {
        case OrderStatus.PENDING: pending++; break;
        case OrderStatus.SUBMITTED: submitted++; break;
        case OrderStatus.FILLED: filled++; break;
        case OrderStatus.FAILED: failed++; break;
        case OrderStatus.RETRYING: retrying++; break;
      }
    });

    return {
      total: this.orders.size,
      pending,
      submitted,
      filled,
      failed,
      retrying,
    };
  }

  /**
   * 清理过期订单 (保留最近 1 小时)
   */
  cleanup(maxAge: number = 60 * 60 * 1000): void {
    const now = Date.now();
    Array.from(this.orders.entries()).forEach(([orderId, order]) => {
      if (now - order.updatedAt > maxAge) {
        this.orders.delete(orderId);
      }
    });
  }
}

// ========== 订单重试管理器 ==========

/**
 * 订单重试管理器
 * 统一管理重试逻辑
 */
export class OrderRetryManager {
  private strategy: ExponentialBackoffStrategy;
  private idempotency: IdempotencyManager;
  private queue: RetryQueue;
  private tracker: OrderTracker;
  private notifier: NotificationManager;

  constructor(config: Partial<RetryConfig> = {}) {
    this.strategy = new ExponentialBackoffStrategy(config);
    this.idempotency = new IdempotencyManager();
    this.tracker = new OrderTracker();
    this.notifier = new NotificationManager();

    this.queue = new RetryQueue(this.strategy, {
      onRetrySuccess: this.handleRetrySuccess.bind(this),
      onRetryFailed: this.handleRetryFailed.bind(this),
    });
  }

  /**
   * 生成唯一订单ID (用于幂等性)
   */
  static generateOrderId(prefix: string = 'ORD'): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * 执行带重试的订单
   */
  async executeWithRetry(
    request: OrderRequest,
    executor: () => Promise<ExchangeOrderResult>
  ): Promise<OrderResult> {
    const orderId = request.orderId;

    // 启动追踪 Span
    const span = tracingManager.isEnabled() 
      ? tracingManager.startSpan('execution.executeWithRetry', {
          attributes: {
            'order.id': orderId,
            'order.type': request.type,
            'order.symbol': request.symbol,
            'order.side': request.side,
            'order.quantity': request.quantity,
          },
        })
      : null;

    try {
      // 1. 幂等性检查 - 已提交过
      if (this.idempotency.hasSubmitted(orderId)) {
        const existingResult = this.idempotency.getSubmittedOrder(orderId);
        logger.info(`📋 订单 ${orderId} 已提交过，返回缓存结果`, getTraceContextForLogging());
        span?.addEvent('order.idempotent_cache_hit');
        span?.end();
        return existingResult!;
      }

      // 2. 幂等性检查 - 正在执行中
      if (this.idempotency.isPending(orderId)) {
        logger.warn(`⏳ 订单 ${orderId} 正在执行中，跳过重复提交`, getTraceContextForLogging());
        span?.addEvent('order.duplicate_pending');
        span?.setStatus({ code: 1, message: '订单正在执行中' });
        span?.end();
        return {
          orderId,
          status: OrderStatus.PENDING,
          success: false,
          retryCount: 0,
          lastError: '订单正在执行中',
          timestamp: Date.now(),
        };
      }

      // 3. 创建订单跟踪
      this.tracker.create(request);
      this.idempotency.markPending(orderId);
      span?.addEvent('order.tracking_started');

      // 4. 首次执行
      try {
        this.tracker.updateStatus(orderId, OrderStatus.SUBMITTED);
        span?.addEvent('order.submitted');
        
        const result = await (span 
          ? tracingManager.withSpanAsync(span, executor) 
          : executor());

        // 成功
        const orderResult: OrderResult = {
          orderId,
          status: OrderStatus.FILLED,
          success: true,
          exchangeOrderId: result?.id || result?.orderId,
          executedPrice: result?.price || result?.avgPrice,
          executedQuantity: result?.quantity || result?.executedQty,
          retryCount: 0,
          timestamp: Date.now(),
        };

        this.tracker.updateStatus(orderId, OrderStatus.FILLED, orderResult);
        this.idempotency.markCompleted(orderId, orderResult);

        span?.setAttributes({
          'order.exchange_id': orderResult.exchangeOrderId || '',
          'order.executed_price': orderResult.executedPrice || 0,
          'order.status': 'filled',
        });
        span?.setStatus({ code: 0 });
        
        logger.info(`✅ 订单 ${orderId} 首次执行成功`, getTraceContextForLogging());

        span?.end();
        return orderResult;

      } catch (error: unknown) {
        // 首次失败，加入重试队列
        logger.warn(`⚠️ 订单 ${orderId} 首次执行失败: ${(error instanceof Error ? error.message : String(error))}，准备重试`, getTraceContextForLogging());

        span?.recordException(toError(error));
        span?.addEvent('order.first_attempt_failed', { error: (error instanceof Error ? error.message : String(error)) });

        const record: RetryRecord = {
          attempt: 0,
          timestamp: Date.now(),
          delay: 0,
          error: (error instanceof Error ? error.message : String(error)),
        };

        this.tracker.addRetryRecord(orderId, record);
        this.tracker.updateStatus(orderId, OrderStatus.RETRYING);

        // 加入重试队列
        this.queue.enqueue(request, executor, 0, [record]);

        span?.setAttributes({
          'order.status': 'retrying',
          'order.retry_count': 0,
        });
        span?.end();

        return {
          orderId,
          status: OrderStatus.RETRYING,
          success: false,
          retryCount: 0,
          lastError: (error instanceof Error ? error.message : String(error)),
          timestamp: Date.now(),
        };
      }
    } catch (unexpectedError: unknown) {
      span?.recordException(unexpectedError instanceof Error ? unexpectedError : new Error(String(unexpectedError)));
      span?.setStatus({ code: 2, message: unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError) });
      span?.end();
      throw unexpectedError;
    }
  }

  /**
   * 处理重试成功
   */
  private handleRetrySuccess(orderId: string, result: ExchangeOrderResult): void {
    const orderResult: OrderResult = {
      orderId,
      status: OrderStatus.FILLED,
      success: true,
      exchangeOrderId: result?.id || result?.orderId,
      executedPrice: result?.price || result?.avgPrice,
      executedQuantity: result?.quantity || result?.executedQty,
      retryCount: this.tracker.getOrder(orderId)?.history.length || 1,
      timestamp: Date.now(),
    };

    this.tracker.updateStatus(orderId, OrderStatus.FILLED, orderResult);
    this.idempotency.markCompleted(orderId, orderResult);
  }

  /**
   * 处理重试失败 (最终失败)
   */
  private async handleRetryFailed(orderId: string, error: string): Promise<void> {
    const order = this.tracker.getOrder(orderId);
    
    const orderResult: OrderResult = {
      orderId,
      status: OrderStatus.FAILED,
      success: false,
      retryCount: order?.history.length || 0,
      lastError: error,
      timestamp: Date.now(),
    };

    this.tracker.updateStatus(orderId, OrderStatus.FAILED, orderResult);
    this.idempotency.markCompleted(orderId, orderResult);

    // 触发告警
    await this.sendFailureAlert(orderId, order?.request, error);
  }

  /**
   * 发送失败告警
   */
  private async sendFailureAlert(
    orderId: string,
    request?: OrderRequest,
    error?: string
  ): Promise<void> {
    const order = request || this.tracker.getOrder(orderId)?.request;
    
    const message = `
🚨 **订单执行失败告警**

订单ID: ${orderId}
类型: ${order?.type || 'Unknown'}
方向: ${order?.side || 'Unknown'}
数量: ${order?.quantity || 0}

错误信息: ${error || '未知错误'}
重试次数: ${this.tracker.getOrder(orderId)?.history.length || 0}

请手动检查订单状态！
    `.trim();

    logger.error(`🚨 订单执行失败告警: ${orderId}`);
    
    await this.notifier.notifyAlert('订单执行失败', message);
  }

  /**
   * 获取订单状态
   */
  getOrderStatus(orderId: string): OrderStatus | undefined {
    return this.tracker.getStatus(orderId);
  }

  /**
   * 获取订单详情
   */
  getOrderDetail(orderId: string) {
    return this.tracker.getOrder(orderId);
  }

  /**
   * 获取重试队列状态
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      pendingOrders: this.queue.getPendingOrders(),
      stats: this.tracker.getStats(),
    };
  }

  /**
   * 获取重试策略配置
   */
  getRetryConfig(): RetryConfig {
    return this.strategy.getConfig();
  }

  /**
   * 停止所有服务
   */
  stop(): void {
    this.queue.stop();
    this.idempotency.stopCleanup();
  }

  /**
   * 清理资源
   */
  clear(): void {
    this.queue.clear();
    this.idempotency.clear();
  }
}

// ========== 导出 ==========

export default OrderRetryManager;
