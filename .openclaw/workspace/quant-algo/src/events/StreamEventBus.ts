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
import { parseTradingEvent, parseDLQMessage } from './validation';

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

  // FIX: M2 — Deduplication tracking to prevent duplicate message processing
  // on retry. Uses a Map<messageEventId, expiryTimestamp> with periodic cleanup.
  private processedMessageIds: Map<string, number> = new Map();
  private static readonly DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
  private static readonly DEDUP_CLEANUP_INTERVAL_MS = 60 * 1000; // cleanup every 60s
  private dedupCleanupTimer: ReturnType<typeof setInterval> | null = null;

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

    // FIX: M2 — Start periodic dedup cleanup
    this.dedupCleanupTimer = setInterval(
      () => this.cleanupProcessedIds(),
      StreamEventBus.DEDUP_CLEANUP_INTERVAL_MS
    );
    // Allow the process to exit even if the timer is still running
    if (this.dedupCleanupTimer && typeof this.dedupCleanupTimer.unref === 'function') {
      this.dedupCleanupTimer.unref();
    }
  }

  /**
   * FIX: M2 — Remove expired entries from the deduplication map
   */
  private cleanupProcessedIds(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, expiry] of this.processedMessageIds) {
      if (now >= expiry) {
        this.processedMessageIds.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`[StreamEventBus] Dedup cleanup: removed ${cleaned} expired entries, ${this.processedMessageIds.size} remaining`);
    }
  }

  /**
   * FIX: M2 — Mark a message event ID as processed with TTL
   */
  private markAsProcessed(eventId: string): void {
    this.processedMessageIds.set(eventId, Date.now() + StreamEventBus.DEDUP_TTL_MS);
  }

  /**
   * FIX: M2 — Check if a message event ID was already processed (idempotency check)
   */
  private isAlreadyProcessed(eventId: string): boolean {
    const expiry = this.processedMessageIds.get(eventId);
    if (expiry === undefined) return false;
    if (Date.now() >= expiry) {
      // Expired — treat as not processed
      this.processedMessageIds.delete(eventId);
      return false;
    }
    return true;
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
   * FIX: M2 — Helper key for retry metadata stored separately from the
   * main stream, avoiding the XADD-based "update" that created duplicates.
   */
  private getRetryMetaKey(channel: EventChannel, messageId: string): string {
    return `retrymeta:${channel}:${messageId}`;
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
   *
   * FIX: M2 — Removed the XADD call that was used to "update" the delivery
   * count. That XADD appended a brand-new message to the stream instead of
   * updating the existing one, causing duplicate messages on every delivery.
   *
   * The fix:
   * 1. Delivery metadata is now tracked in a separate Redis hash key
   *    (retrymeta:<channel>:<messageId>) instead of being written back to
   *    the stream via XADD.
   * 2. An idempotency check (processedMessageIds) prevents the handler from
   *    being invoked twice for the same logical event, even if the stream
   *    message is re-delivered.
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
      const event = parseTradingEvent(messageData.data || '{}');
      if (!event) {
        logger.warn(\`[EventValidation] Dropping invalid event for message \${messageId} on \${channel}\`);
        if (autoAck) {
          await this.ack(channel, messageId, groupName);
        }
        return;
      }
      const retryCount = parseInt(messageData.retryCount || '0', 10);

      // FIX: M2 — Idempotency check at the consumer level.
      // If this event was already successfully processed, just ACK and skip.
      const eventId = event.id || messageId;
      if (this.isAlreadyProcessed(eventId)) {
        logger.debug(`[StreamEventBus] Skipping duplicate event ${eventId} (messageId=${messageId})`);
        if (autoAck) {
          await this.ack(channel, messageId, groupName);
        }
        // FIX: M2 — Clean up stale retry metadata for this message
        await this.client.del(this.getRetryMetaKey(channel, messageId)).catch(() => {});
        return;
      }

      // FIX: M2 — Track delivery count in a separate hash key instead of
      // using XADD which creates duplicates. HINCRBY is atomic and updates
      // in-place without appending new stream entries.
      const retryMetaKey = this.getRetryMetaKey(channel, messageId);
      const deliveredCount = await this.client.hincrby(retryMetaKey, 'deliveredCount', 1);
      // Set a TTL on the metadata key so it doesn't persist forever
      await this.client.expire(retryMetaKey, 600); // 10 min TTL

      // 执行处理器
      const result = handler(event);
      if (result instanceof Promise) {
        await result;
      }

      // FIX: M2 — Mark event as processed to prevent duplicate handling on re-delivery
      this.markAsProcessed(eventId);

      // 自动确认
      if (autoAck) {
        await this.ack(channel, messageId, groupName);
      }

      // FIX: M2 — Clean up retry metadata after successful processing
      await this.client.del(retryMetaKey).catch(() => {});

      this.emit('message:processed', { channel, messageId, event });
    } catch (err) {
      logger.error(`Error processing message ${messageId} on ${channel}:`, err);
      
      // 处理失败，增加重试计数或移至DLQ
      await this.handleFailedMessage(channel, messageId, messageData, groupName, err);
    }
  }

  /**
   * 处理失败消息
   *
   * FIX: M2 — Replaced the XADD-based retry count update with a separate
   * Redis hash (retrymeta:<channel>:<messageId>). The old code used XADD to
   * "update" the retry count, which actually appended a brand-new duplicate
   * message to the stream. Now we:
   * 1. Store retry count in a Redis hash (HINCRBY is atomic and in-place)
   * 2. XACK the original message once it exceeds max retries or moves to DLQ
   * 3. The message stays in the pending list for re-delivery by XCLAIM, no
   *    new stream entries are created
   */
  private async handleFailedMessage(
    channel: EventChannel,
    messageId: string,
    messageData: Record<string, string>,
    groupName: string,
    error: unknown
  ): Promise<void> {
    // FIX: M2 — Read/update retry count from separate hash, not via XADD
    const retryMetaKey = this.getRetryMetaKey(channel, messageId);
    const retryCount = await this.client.hincrby(retryMetaKey, 'retryCount', 1);
    await this.client.hset(retryMetaKey, 'lastError', String(error));
    await this.client.expire(retryMetaKey, 600); // 10 min TTL

    if (retryCount >= this.config.stream.retryCount) {
      // 超过最大重试次数，移至DLQ
      await this.moveToDLQ(channel, messageId, messageData, error);
      await this.ack(channel, messageId, groupName); // 从原流中删除
      // FIX: M2 — Clean up retry metadata
      await this.client.del(retryMetaKey).catch(() => {});
      logger.warn(`Message ${messageId} moved to DLQ after ${retryCount} retries`);
    } else {
      // FIX: M2 — Do NOT use XADD here. The message remains in the stream's
      // pending entries list (PEL) because we have not ACK'd it. XCLAIM in
      // claimPendingMessages() will re-deliver it after the idle threshold.
      // The retry count is already persisted in the hash above.
      logger.debug(`Message ${messageId} retry count updated to ${retryCount} (via hash, no XADD)`);
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
      data: (parseTradingEvent(messageData.data || '{}') ?? {}) as TradingEvent,
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
            const dlqMsg = parseDLQMessage(data.data || '{}');
            if (dlqMsg) {
              messages.push(dlqMsg as unknown as DLQMessage);
            }
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
        const dlqMessage = parseDLQMessage(data.data || '{}') as unknown as DLQMessage;
        if (!dlqMessage) {
          logger.warn(\`[EventValidation] Failed to parse DLQ message \${messageId}\`);
          return;
        }

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
            data: (parseTradingEvent(data.data || '{}') ?? {}) as TradingEvent,
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

    // FIX: M2 — Clean up dedup timer on shutdown
    if (this.dedupCleanupTimer) {
      clearInterval(this.dedupCleanupTimer);
      this.dedupCleanupTimer = null;
    }
    this.processedMessageIds.clear();

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
