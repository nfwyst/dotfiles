/**
 * Redis 事件总线 - Redis Event Bus
 * 基于 Redis Pub/Sub 实现的分布式事件总线
 * 支持发布/订阅模式，用于解耦三层架构
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import {
  EventChannels,
} from './types';
import type {
  BaseEvent,
  TradingEvent,
  EventHandler,
  EventFilter,
  EventChannel,
} from './types';
import logger from '../logger';
import { config } from '../config';
import {
  tracingManager,
  getTraceContextForLogging,
} from '../monitoring/tracing';
import { parseTradingEvent } from './validation';
// ==================== 事件总线配置 ====================

export interface EventBusConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  retryStrategy?: {
    maxRetries: number;
    delay: number;
    backoffMultiplier: number;
  };
  enableOfflineQueue?: boolean;
  maxListeners?: number;
}

const DEFAULT_CONFIG: EventBusConfig = {
  redis: {
    host: config.redis?.host || 'localhost',
    port: config.redis?.port || 6379,
    password: config.redis?.password,
    db: config.redis?.db || 0,
    keyPrefix: 'quant-alto:',
  },
  retryStrategy: {
    maxRetries: 10,
    delay: 1000,
    backoffMultiplier: 2,
  },
  enableOfflineQueue: true,
  maxListeners: 100,
};

// ==================== 事件总线实现 ====================

export class RedisEventBus extends EventEmitter {
  private publisher: Redis;
  private subscriber: Redis;
  private config: EventBusConfig;
  private isConnected: boolean = false;
  private subscriptions: Map<EventChannel, Set<EventHandler>> = new Map();
  private eventHistory: TradingEvent[] = [];
  private maxHistorySize: number = 1000;
  private correlationId: string = '';

  constructor(customConfig?: Partial<EventBusConfig>) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...customConfig,
      redis: { ...DEFAULT_CONFIG.redis, ...customConfig?.redis },
      retryStrategy: {
        maxRetries: customConfig?.retryStrategy?.maxRetries ?? DEFAULT_CONFIG.retryStrategy!.maxRetries,
        delay: customConfig?.retryStrategy?.delay ?? DEFAULT_CONFIG.retryStrategy!.delay,
        backoffMultiplier: customConfig?.retryStrategy?.backoffMultiplier ?? DEFAULT_CONFIG.retryStrategy!.backoffMultiplier,
      },
    };

    // 设置最大监听器数量
    this.setMaxListeners(this.config.maxListeners || 100);

    // 创建 Redis 连接
    this.publisher = this.createRedisClient('publisher');
    this.subscriber = this.createRedisClient('subscriber');

    // 设置事件处理
    this.setupEventHandlers();
  }

  /**
   * 创建 Redis 客户端
   */
  private createRedisClient(role: 'publisher' | 'subscriber'): Redis {
    const client = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      keyPrefix: this.config.redis.keyPrefix,
      enableOfflineQueue: this.config.enableOfflineQueue,
      retryStrategy: (times: number) => {
        if (times > (this.config.retryStrategy?.maxRetries || 10)) {
          logger.error(`Redis ${role} connection failed after ${times} retries`);
          return null; // 停止重试
        }
        const delay = Math.min(
          (this.config.retryStrategy?.delay || 1000) *
          Math.pow(this.config.retryStrategy?.backoffMultiplier || 2, times),
          30000
        );
        logger.warn(`Redis ${role} reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          logger.warn(`Redis ${role} reconnecting due to READONLY error`);
          return true;
        }
        return false;
      },
    });

    return client;
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // Publisher 事件
    this.publisher.on('connect', () => {
      logger.info('Redis publisher connected');
    });

    this.publisher.on('error', (err) => {
      logger.error('Redis publisher error:', err);
    });

    // Subscriber 事件
    this.subscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
    });

    this.subscriber.on('error', (err) => {
      logger.error('Redis subscriber error:', err);
    });

    // 消息处理
    this.subscriber.on('message', (channel: string, message: string) => {
      this.handleMessage(channel as EventChannel, message);
    });

    // 连接就绪
    Promise.all([
      new Promise<void>((resolve) => this.publisher.on('ready', () => resolve())),
      new Promise<void>((resolve) => this.subscriber.on('ready', () => resolve())),
    ]).then(() => {
      this.isConnected = true;
      logger.info('✅ Redis EventBus connected and ready');
      this.emit('ready');
    });
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(channel: EventChannel, message: string): void {
    try {
      const event = parseTradingEvent(message);
      if (!event) {
        logger.warn(\`[EventValidation] Dropping invalid event on channel \${channel}\`);
        return;
      }

      // 记录事件历史
      this.addToHistory(event);

      // 调用本地订阅者
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            const result = handler(event);
            if (result instanceof Promise) {
              result.catch((err) => {
                logger.error(`Handler error for channel ${channel}:`, err);
              });
            }
          } catch (err) {
            logger.error(`Handler sync error for channel ${channel}:`, err);
          }
        });
      }

      // 发出本地事件
      this.emit('event', event);
      this.emit(channel, event);

    } catch (err) {
      logger.error(`Failed to parse message on channel ${channel}:`, err);
    }
  }

  /**
   * 添加事件到历史记录
   */
  private addToHistory(event: TradingEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * 生成唯一事件 ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成关联 ID
   */
  generateCorrelationId(): string {
    this.correlationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.correlationId;
  }

  /**
   * 获取当前关联 ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  // ==================== 公共 API ====================

  /**
   * 发布事件
   */
  async publish(event: Omit<TradingEvent, 'id' | 'timestamp'>): Promise<void> {
    const span = tracingManager.isEnabled()
      ? tracingManager.startSpan('eventbus.publish', {
          attributes: {
            'event.channel': event.channel,
            'event.source': event.source,
            'event.correlation_id': event.correlationId,
          },
        })
      : null;

    if (!this.isConnected) {
      logger.warn('EventBus not connected, queuing event');
      // 可以在这里实现离线队列
    }

    const fullEvent: TradingEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
    } as TradingEvent;

    const message = JSON.stringify(fullEvent);

    try {
      const startTime = Date.now();
      await this.publisher.publish(event.channel, message);
      const duration = Date.now() - startTime;
      
      span?.setAttributes({
        'event.id': fullEvent.id,
        'event.timestamp': fullEvent.timestamp,
        'event.publish_duration_ms': duration,
      });
      span?.setStatus({ code: 0 });
      span?.end();
      
      logger.debug(`Published event: ${event.channel} [${event.correlationId}]`, getTraceContextForLogging());
    } catch (err: unknown) {
      span?.recordException(err);
      span?.setStatus({ code: 2, message: (err instanceof Error ? err.message : String(err)) });
      span?.end();
      logger.error(`Failed to publish event on ${event.channel}:`, err);
      throw err;
    }
  }

  /**
   * 订阅频道
   */
  async subscribe<T extends TradingEvent>(
    channel: EventChannel,
    handler: EventHandler<T>
  ): Promise<void> {
    const span = tracingManager.isEnabled()
      ? tracingManager.startSpan('eventbus.subscribe', {
          attributes: {
            'event.channel': channel,
          },
        })
      : null;

    try {
      // 添加到本地订阅表
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
        // 首次订阅时订阅 Redis 频道
        await this.subscriber.subscribe(channel);
        logger.info(`Subscribed to channel: ${channel}`);
      }

      this.subscriptions.get(channel)!.add(handler as EventHandler);
      span?.setStatus({ code: 0 });
      span?.end();
    } catch (err: unknown) {
      span?.recordException(err);
      span?.setStatus({ code: 2, message: (err instanceof Error ? err.message : String(err)) });
      span?.end();
      throw err;
    }
  }

  /**
   * 取消订阅
   */
  async unsubscribe<T extends TradingEvent>(
    channel: EventChannel,
    handler?: EventHandler<T>
  ): Promise<void> {
    const handlers = this.subscriptions.get(channel);

    if (!handlers) return;

    if (handler) {
      handlers.delete(handler as EventHandler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) {
      await this.subscriber.unsubscribe(channel);
      this.subscriptions.delete(channel);
      logger.info(`Unsubscribed from channel: ${channel}`);
    }
  }

  /**
   * 订阅所有频道
   */
  async subscribeAll(handler: EventHandler): Promise<void> {
    const channels = Object.values(EventChannels);
    await Promise.all(channels.map((channel) => this.subscribe(channel, handler)));
  }

  /**
   * 获取事件历史
   */
  getHistory(filter?: EventFilter): TradingEvent[] {
    let events = [...this.eventHistory];

    if (filter) {
      if (filter.channels) {
        events = events.filter((e) => filter.channels!.includes(e.channel));
      }
      if (filter.sources) {
        events = events.filter((e) => filter.sources!.includes(e.source));
      }
      if (filter.correlationId) {
        events = events.filter((e) => e.correlationId === filter.correlationId);
      }
      if (filter.startTime) {
        events = events.filter((e) => e.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        events = events.filter((e) => e.timestamp <= filter.endTime!);
      }
    }

    return events;
  }

  /**
   * 获取特定关联 ID 的事件链
   */
  getEventChain(correlationId: string): TradingEvent[] {
    return this.eventHistory.filter((e) => e.correlationId === correlationId);
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * 检查连接状态
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * 等待就绪
   */
  async waitForReady(timeout: number = 5000): Promise<void> {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('EventBus connection timeout'));
      }, timeout);

      this.once('ready', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    logger.info('Closing Redis EventBus...');

    // 取消所有订阅
    const channels = Array.from(this.subscriptions.keys());
    if (channels.length > 0) {
      await this.subscriber.unsubscribe(...channels);
    }

    // 关闭连接
    await Promise.all([
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);

    this.isConnected = false;
    this.subscriptions.clear();
    logger.info('✅ Redis EventBus closed');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    if (!this.isConnected) {
      return { healthy: false, error: 'Not connected' };
    }

    try {
      const start = Date.now();
      await this.publisher.ping();
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (err) {
      return { healthy: false, error: String(err) };
    }
  }
}

// ==================== 单例实例 ====================

let eventBusInstance: RedisEventBus | null = null;

export function getEventBus(config?: Partial<EventBusConfig>): RedisEventBus {
  if (!eventBusInstance) {
    eventBusInstance = new RedisEventBus(config);
  }
  return eventBusInstance;
}

export function resetEventBus(): void {
  if (eventBusInstance) {
    eventBusInstance.close().catch(console.error);
    eventBusInstance = null;
  }
}

export default RedisEventBus;
