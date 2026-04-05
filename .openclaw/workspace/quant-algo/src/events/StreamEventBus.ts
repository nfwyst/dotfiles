/**
 * Redis Stream 事件总线 - Redis Stream Event Bus
 * 基于 Redis Stream 实现的持久化事件总线
 * 支持消息持久化、ACK机制、消费者组、死信队列
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

// ==================== Stream 事件总线配置 ====================

export interface StreamEventBusConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  stream: {
    maxLen: number;           // Stream最大长度（默认10000）
    blockTimeout: number;     // 阻塞读取超时ms（默认5000）
    retryCount: number;       // 最大重试次数（默认3次）
    retryDelay: number;       // 重试延迟ms（默认1000）
  };
  consumer: {
    groupName: string;        // 默认消费者组名
    consumerName: string;     // 默认消费者名
  };
  retryStrategy?: {
    maxRetries: number;
    delay: number;
    backoffMultiplier: number;
  };
}

const DEFAULT_CONFIG: StreamEventBusConfig = {
  redis: {
    host: config.redis?.host || 'localhost',
    port: config.redis?.port || 6379,
    password: config.redis?.password,
    db: config.redis?.db || 0,
    keyPrefix: 'quant-alto:stream:',
  },
  stream: {
    maxLen: 10000,
    blockTimeout: 5000,
    retryCount: 3,
    retryDelay: 1000,
  },
  consumer: {
    groupName: 'default-group',
    consumerName: `consumer-${process.pid}`,
  },
  retryStrategy: {
    maxRetries: 10,
    delay: 1000,
    backoffMultiplier: 2,
  },
};

// ==================== 消息元数据 ====================

interface StreamMessage {
  id: string;
  data: TradingEvent;
  retryCount: number;
  lastError?: string;
  deliveredCount: number;
}

interface PendingMessage {
  id: string;
  consumer: string;
  idleTime: number;
  deliveredCount: number;
}

interface DLQMessage extends StreamMessage {
  movedToDLQAt: number;
  reason: string;
}

// ==================== 订阅选项 ====================

export interface SubscribeOptions {
  groupName?: string;         // 消费者组名
  consumerName?: string;      // 消费者名
  startFrom?: 'beginning' | 'latest' | string;  // 开始位置
  autoAck?: boolean;          // 自动确认（默认true）
  blockTimeout?: number;      // 阻塞超时
}

// ==================== Stream 事件总线实现 ====================

export class StreamEventBus extends EventEmitter {
  private client: Redis;
  private config: StreamEventBusConfig;
  private isConnected: boolean = false;
  private subscriptions: Map<string, {
    handler: EventHandler;
    options: SubscribeOptions;
    running: boolean;
  }> = new Map();
  private consumerGroups: Map<string, string> = new Map(); // channel -> groupName
  private dlqPrefix: string = 'dlq:';
  private correlationId: string = '';
  private shutdownRequested: boolean = false;

  constructor(customConfig?: Partial<StreamEventBusConfig>) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...customConfig,
      redis: { ...DEFAULT_CONFIG.redis, ...customConfig?.redis },
      stream: { ...DEFAULT_CONFIG.stream, ...customConfig?.stream },
      consumer: { ...DEFAULT_CONFIG.consumer, ...customConfig?.consumer },
      retryStrategy: {
        maxRetries: customConfig?.retryStrategy?.maxRetries ?? DEFAULT_CONFIG.retryStrategy!.maxRetries,
        delay: customConfig?.retryStrategy?.delay ?? DEFAULT_CONFIG.retryStrategy!.delay,
        backoffMultiplier: customConfig?.retryStrategy?.backoffMultiplier ?? DEFAULT_CONFIG.retryStrategy!.backoffMultiplier,
      },
    };
    this.setMaxListeners(100);
    this.client = this.createRedisClient();
    this.setupEventHandlers();
  }

  /**
   * 创建 Redis 客户端
   */
  private createRedisClient(): Redis {
    const client = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      keyPrefix: this.config.redis.keyPrefix,
      enableOfflineQueue: true,
      retryStrategy: (times: number) => {
        if (times > (this.config.retryStrategy?.maxRetries || 10)) {
          logger.error(`Redis Stream connection failed after ${times} retries`);
          return null;
        }
        const delay = Math.min(
          (this.config.retryStrategy?.delay || 1000) *
          Math.pow(this.config.retryStrategy?.backoffMultiplier || 2, times),
          30000
        );
        logger.warn(`Redis Stream reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          logger.warn('Redis Stream reconnecting due to READONLY error');
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
    this.client.on('connect', () => {
      logger.info('Redis Stream client connected');
    });

    this.client.on('error', (err) => {
      logger.error('Redis Stream client error:', err);
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('✅ Redis Stream EventBus connected and ready');
      this.emit('ready');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis Stream client connection closed');
    });
  }

  /**
   * 获取 Stream Key
   */
  private getStreamKey(channel: EventChannel): string {
    return `stream:${channel}`;
  }

  /**
   * 获取 DLQ Key
   */
  private getDLQKey(channel: EventChannel): string {
    return `${this.dlqPrefix}${channel}`;
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
   * 发布事件到 Stream
   * 使用 XADD 命令添加消息到流
   */
  async publish(event: Omit<TradingEvent, 'id' | 'timestamp'>): Promise<string> {
    if (!this.isConnected) {
      logger.warn('StreamEventBus not connected, queuing event');
    }

    const fullEvent: TradingEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
    } as TradingEvent;

    const streamKey = this.getStreamKey(event.channel);

    try {
      // XADD 添加消息，使用 MAXLEN 限制流长度
      const messageId = await this.client.xadd(
        streamKey,
        'MAXLEN',
        '~',
        this.config.stream.maxLen,
        '*',
        'data',
        JSON.stringify(fullEvent),
        'retryCount',
        '0',
        'deliveredCount',
        '0'
      );

      logger.debug(`Published event to stream: ${event.channel} [${messageId}]`);
      this.emit('published', { channel: event.channel, messageId: messageId || '', event: fullEvent });
      
      return messageId || '';
    } catch (err) {
      logger.error(`Failed to publish event to stream ${event.channel}:`, err);
      throw err;
    }
  }

  /**
   * 创建消费者组
   */
  async createConsumerGroup(
    channel: EventChannel,
    groupName: string,
    startFrom: 'beginning' | 'latest' | string = 'latest'
  ): Promise<void> {
    const streamKey = this.getStreamKey(channel);
    const startId = startFrom === 'beginning' ? '0' : startFrom === 'latest' ? '$' : startFrom;

    try {
      await this.client.xgroup('CREATE', streamKey, groupName, startId, 'MKSTREAM');
      logger.info(`Created consumer group '${groupName}' for stream '${channel}'`);
    } catch (err: unknown) {
      // 如果组已存在，忽略错误
      if (err instanceof Error && err.message.includes('BUSYGROUP')) {
        logger.debug(`Consumer group '${groupName}' already exists for stream '${channel}'`);
      } else {
        throw err;
      }
    }
  }

  /**
   * 订阅频道
   * 使用消费者组从 Stream 读取消息
   */
  async subscribe<T extends TradingEvent>(
    channel: EventChannel,
    handler: EventHandler<T>,
    options: SubscribeOptions = {}
  ): Promise<void> {
    const {
      groupName = this.config.consumer.groupName,
      consumerName = this.config.consumer.consumerName,
      startFrom = 'latest',
      autoAck = true,
      blockTimeout = this.config.stream.blockTimeout,
    } = options;

    // 创建消费者组
    await this.createConsumerGroup(channel, groupName, startFrom);
    this.consumerGroups.set(channel, groupName);

    // 注册订阅
    const subscriptionKey = `${channel}:${groupName}:${consumerName}`;
    this.subscriptions.set(subscriptionKey, {
      handler: handler as EventHandler,
      options: { ...options, groupName, consumerName, blockTimeout },
      running: false,
    });

    logger.info(`Subscribed to stream: ${channel} (group: ${groupName}, consumer: ${consumerName})`);

    // 启动消费者循环
    this.startConsumerLoop(channel, groupName, consumerName, blockTimeout, autoAck);
  }

  /**
   * 启动消费者循环
   */
  private async startConsumerLoop(
    channel: EventChannel,
    groupName: string,
    consumerName: string,
    blockTimeout: number,
    autoAck: boolean
  ): Promise<void> {
    const streamKey = this.getStreamKey(channel);
    const subscriptionKey = `${channel}:${groupName}:${consumerName}`;
    const subscription = this.subscriptions.get(subscriptionKey);

    if (!subscription) return;

    subscription.running = true;

    // 使用 setImmediate 避免阻塞
    const consume = async (): Promise<void> => {
      if (this.shutdownRequested || !subscription.running) {
        return;
      }

      try {
        // XREADGROUP 读取消息
        const messages = await this.client.xreadgroup(
          'GROUP', groupName, consumerName,
          'COUNT', 1,
          'BLOCK', blockTimeout,
          'STREAMS', streamKey,
          '>'
        );

        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages as [string, [string, string[]][]][]) {
            for (const [messageId, fields] of streamMessages) {
              await this.processMessage(
                channel,
                messageId,
                fields,
                subscription.handler,
                groupName,
                autoAck
              );
            }
          }
        }

        // 处理待处理消息（超时未ACK的消息）
        await this.claimPendingMessages(channel, groupName, consumerName, subscription.handler, autoAck);
      } catch (err) {
        logger.error(`Error in consumer loop for ${channel}:`, err);
      }

      // 继续循环
      if (subscription.running && !this.shutdownRequested) {
        setImmediate(consume);
      }
    };

    consume();
  }

  /**
   * 处理单条消息
   */
  private async processMessage(
    channel: EventChannel,
    messageId: string,
    fields: string[],
    handler: EventHandler,
    groupName: string,
    autoAck: boolean
  ): Promise<void> {
    const streamKey = this.getStreamKey(channel);

    // 解析消息字段
    const messageData: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      if (key !== undefined && value !== undefined) {
        messageData[key] = value;
      }
    }

    try {
      const event = JSON.parse(messageData.data || '{}') as TradingEvent;
      const retryCount = parseInt(messageData.retryCount || '0', 10);
      const deliveredCount = parseInt(messageData.deliveredCount || '0', 10) + 1;

      // 更新投递计数
      await this.client.xadd(
        streamKey,
        'MAXLEN',
        '~',
        this.config.stream.maxLen,
        '*',
        'data',
        messageData.data ?? '',
        'retryCount', String(retryCount),
        'deliveredCount', String(deliveredCount)
      );

      // 执行处理器
      const result = handler(event);
      if (result instanceof Promise) {
        await result;
      }

      // 自动确认
      if (autoAck) {
        await this.ack(channel, messageId, groupName);
      }

      this.emit('message:processed', { channel, messageId, event });
    } catch (err) {
      logger.error(`Error processing message ${messageId} on ${channel}:`, err);
      
      // 处理失败，增加重试计数或移至DLQ
      await this.handleFailedMessage(channel, messageId, messageData, groupName, err);
    }
  }

  /**
   * 处理失败消息
   */
  private async handleFailedMessage(
    channel: EventChannel,
    messageId: string,
    messageData: Record<string, string>,
    groupName: string,
    error: unknown
  ): Promise<void> {
    const streamKey = this.getStreamKey(channel);
    const retryCount = parseInt(messageData.retryCount || '0', 10) + 1;

    if (retryCount >= this.config.stream.retryCount) {
      // 超过最大重试次数，移至DLQ
      await this.moveToDLQ(channel, messageId, messageData, error);
      await this.ack(channel, messageId, groupName); // 从原流中删除
      logger.warn(`Message ${messageId} moved to DLQ after ${retryCount} retries`);
    } else {
      // 更新重试计数（添加新消息，自动生成ID）
      await this.client.xadd(
        streamKey,
        'MAXLEN', '~', this.config.stream.maxLen,
        '*',
        'data',
        messageData.data ?? '',
        'retryCount', String(retryCount),
        'deliveredCount',
        messageData.deliveredCount ?? '0',
        'lastError', String(error)
      );
      
      logger.debug(`Message ${messageId} retry count updated to ${retryCount}`);
    }
  }

  /**
   * 移动消息到死信队列
   */
  private async moveToDLQ(
    channel: EventChannel,
    messageId: string,
    messageData: Record<string, string>,
    error: unknown
  ): Promise<void> {
    const dlqKey = this.getDLQKey(channel);

    const dlqMessage: DLQMessage = {
      id: messageId,
      data: JSON.parse(messageData.data || '{}') as TradingEvent,
      retryCount: parseInt(messageData.retryCount || '0', 10),
      lastError: messageData.lastError,
      deliveredCount: parseInt(messageData.deliveredCount || '0', 10),
      movedToDLQAt: Date.now(),
      reason: String(error),
    };

    await this.client.xadd(
      dlqKey,
      'MAXLEN',
      '~',
      this.config.stream.maxLen,
      '*',
      'data', JSON.stringify(dlqMessage)
    );

    this.emit('dlq:message', { channel, messageId, reason: String(error) });
  }

  /**
   * 认领待处理消息
   */
  private async claimPendingMessages(
    channel: EventChannel,
    groupName: string,
    consumerName: string,
    handler: EventHandler,
    autoAck: boolean
  ): Promise<void> {
    const streamKey = this.getStreamKey(channel);
    const idleTime = this.config.stream.retryDelay * 2; // 空闲时间阈值

    try {
      // 获取待处理消息
      const pending = await this.client.xpending(
        streamKey,
        groupName,
        '-',
        '+',
        10
      );

      if (!pending || pending.length === 0) return;

      for (const [messageId, consumer, idle, delivered] of pending as [string, string, number, number][]) {
        // 如果消息空闲时间超过阈值，认领它
        if (idle >= idleTime) {
          const claimed = await this.client.xclaim(
            streamKey,
            groupName,
            consumerName,
            idleTime,
            messageId
          );

          if (claimed && claimed.length > 0) {
            for (const [claimedId, fields] of claimed as [string, string[]][]) {
              logger.debug(`Claimed pending message ${claimedId} from ${consumer}`);
              await this.processMessage(channel, claimedId, fields, handler, groupName, autoAck);
            }
          }
        }
      }
    } catch (err) {
      logger.error(`Error claiming pending messages for ${channel}:`, err);
    }
  }

  /**
   * 确认消息已处理 (XACK)
   */
  async ack(channel: EventChannel, messageId: string, groupName?: string): Promise<void> {
    const streamKey = this.getStreamKey(channel);
    const group = groupName || this.consumerGroups.get(channel) || this.config.consumer.groupName;

    try {
      await this.client.xack(streamKey, group, messageId);
      logger.debug(`Acknowledged message ${messageId} on ${channel}`);
    } catch (err) {
      logger.error(`Failed to ack message ${messageId}:`, err);
      throw err;
    }
  }

  /**
   * 批量确认消息
   */
  async ackMultiple(channel: EventChannel, messageIds: string[], groupName?: string): Promise<void> {
    const streamKey = this.getStreamKey(channel);
    const group = groupName || this.consumerGroups.get(channel) || this.config.consumer.groupName;

    try {
      await this.client.xack(streamKey, group, ...messageIds);
      logger.debug(`Acknowledged ${messageIds.length} messages on ${channel}`);
    } catch (err) {
      logger.error(`Failed to ack multiple messages:`, err);
      throw err;
    }
  }

  /**
   * 获取待处理消息
   */
  async getPending(channel: EventChannel, groupName?: string): Promise<PendingMessage[]> {
    const streamKey = this.getStreamKey(channel);
    const group = groupName || this.consumerGroups.get(channel) || this.config.consumer.groupName;

    try {
      const pending = await this.client.xpending(
        streamKey,
        group,
        '-',
        '+',
        100
      );

      return (pending as [string, string, string, string][]).map(([id, consumer, idle, delivered]) => ({
        id,
        consumer,
        idleTime: parseInt(idle, 10),
        deliveredCount: parseInt(delivered, 10),
      }));
    } catch (err) {
      logger.error(`Failed to get pending messages for ${channel}:`, err);
      return [];
    }
  }

  /**
   * 获取死信队列消息
   */
  async getDLQ(channel: EventChannel): Promise<DLQMessage[]> {
    const dlqKey = this.getDLQKey(channel);
    const messages: DLQMessage[] = [];

    try {
      const result = await this.client.xrange(dlqKey, '-', '+', 'COUNT', 100);

      if (result) {
        for (const [id, fields] of result as [string, string[]][]) {
          const data: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            const key = fields[i];
            const value = fields[i + 1];
            if (key !== undefined && value !== undefined) {
              data[key] = value;
            }
          }
          try {
            messages.push(JSON.parse(data.data || '{}') as DLQMessage);
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (err) {
      logger.error(`Failed to get DLQ messages for ${channel}:`, err);
    }

    return messages;
  }

  /**
   * 重放DLQ消息
   */
  async replayDLQMessage(channel: EventChannel, messageId: string): Promise<void> {
    const dlqKey = this.getDLQKey(channel);

    try {
      const result = await this.client.xrange(dlqKey, messageId, messageId);

      if (result && result.length > 0) {
        const entry = result[0];
        if (!entry) return;
        const [_, fields] = entry;
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          const key = fields[i];
          const value = fields[i + 1];
          if (key !== undefined && value !== undefined) {
            data[key] = value;
          }
        }
        const dlqMessage = JSON.parse(data.data || '{}') as DLQMessage;

        // 重新发布到原流
        const { id: _id, timestamp: _timestamp, ...eventData } = dlqMessage.data;
        await this.publish(eventData as Omit<TradingEvent, 'id' | 'timestamp'>);

        // 从DLQ中删除
        await this.client.xdel(dlqKey, messageId);
        logger.info(`Replayed DLQ message ${messageId} to ${channel}`);
      }
    } catch (err) {
      logger.error(`Failed to replay DLQ message ${messageId}:`, err);
      throw err;
    }
  }

  /**
   * 取消订阅
   */
  async unsubscribe(channel: EventChannel, groupName?: string, consumerName?: string): Promise<void> {
    const group = groupName || this.config.consumer.groupName;
    const consumer = consumerName || this.config.consumer.consumerName;
    const subscriptionKey = `${channel}:${group}:${consumer}`;

    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      subscription.running = false;
      this.subscriptions.delete(subscriptionKey);
      logger.info(`Unsubscribed from stream: ${channel} (group: ${group}, consumer: ${consumer})`);
    }
  }

  /**
   * 获取流信息
   */
  async getStreamInfo(channel: EventChannel): Promise<{
    length: number;
    groups: number;
    firstEntry: string | null;
    lastEntry: string | null;
  }> {
    const streamKey = this.getStreamKey(channel);

    try {
      const info = await this.client.xinfo('STREAM', streamKey) as Record<string, unknown>;
      
      return {
        length: (info.length as number) || 0,
        groups: (info.groups as number) || 0,
        firstEntry: (info['first-entry'] as [string, string[]] | null)?.[0] || null,
        lastEntry: (info['last-entry'] as [string, string[]] | null)?.[0] || null,
      };
    } catch (err) {
      logger.error(`Failed to get stream info for ${channel}:`, err);
      return { length: 0, groups: 0, firstEntry: null, lastEntry: null };
    }
  }

  /**
   * 读取流消息（不使用消费者组）
   */
  async readStream(
    channel: EventChannel,
    start: string = '-',
    end: string = '+',
    count: number = 10
  ): Promise<StreamMessage[]> {
    const streamKey = this.getStreamKey(channel);
    const messages: StreamMessage[] = [];

    try {
      const result = await this.client.xrange(streamKey, start, end, 'COUNT', count);

      if (result) {
        for (const [id, fields] of result) {
          const data: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            const key = fields[i];
            const value = fields[i + 1];
            if (key !== undefined && value !== undefined) {
              data[key] = value;
            }
          }
          messages.push({
            id,
            data: JSON.parse(data.data || '{}') as TradingEvent,
            retryCount: parseInt(data.retryCount || '0', 10),
            lastError: data.lastError,
            deliveredCount: parseInt(data.deliveredCount || '0', 10),
          });
        }
      }
    } catch (err) {
      logger.error(`Failed to read stream for ${channel}:`, err);
    }

    return messages;
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
        reject(new Error('StreamEventBus connection timeout'));
      }, timeout);

      this.once('ready', () => {
        clearTimeout(timer);
        resolve();
      });
    });
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
      await this.client.ping();
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (err) {
      return { healthy: false, error: String(err) };
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    logger.info('Closing Redis Stream EventBus...');

    this.shutdownRequested = true;

    // 停止所有消费者
    Array.from(this.subscriptions.values()).forEach((subscription) => {
      subscription.running = false;
    });
    this.subscriptions.clear();

    // 关闭连接
    await this.client.quit();

    this.isConnected = false;
    logger.info('✅ Redis Stream EventBus closed');
  }
}

// ==================== 单例实例 ====================

let streamEventBusInstance: StreamEventBus | null = null;

export function getStreamEventBus(config?: Partial<StreamEventBusConfig>): StreamEventBus {
  if (!streamEventBusInstance) {
    streamEventBusInstance = new StreamEventBus(config);
  }
  return streamEventBusInstance;
}

export function resetStreamEventBus(): void {
  if (streamEventBusInstance) {
    streamEventBusInstance.close().catch(console.error);
    streamEventBusInstance = null;
  }
}

export default StreamEventBus;
