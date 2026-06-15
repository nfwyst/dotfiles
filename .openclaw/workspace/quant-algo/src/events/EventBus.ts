/**
 * EventBus — Shared interface extracted from RedisEventBus & StreamEventBus.
 *
 * Both implementations extend EventEmitter and expose these methods.
 * The EventDrivenRuntime now depends on this interface instead of a
 * concrete class, so we can wire either bus without type casts.
 */

import type { TradingEvent, EventChannel, EventHandler } from './types';

export interface EventBus {
  /** Block until the bus is connected (e.g. Redis ready). */
  waitForReady(timeoutMs: number): Promise<void>;

  /** Publish a trading event (id + timestamp are added automatically). */
  publish(event: Omit<TradingEvent, 'id' | 'timestamp'>): Promise<void>;

  /** Subscribe to a channel with a typed handler. */
  subscribe<T extends TradingEvent>(
    channel: EventChannel,
    handler: EventHandler<T>,
  ): Promise<void>;

  /** Unsubscribe from a channel. */
  unsubscribe<T extends TradingEvent>(
    channel: EventChannel,
    handler?: EventHandler<T>,
  ): Promise<void>;

  /** Close the bus connection. */
  close(): Promise<void>;

  /** Health check — returns healthy flag + optional latency. */
  healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }>;

  /** Get the current correlation id (for heartbeat etc). */
  getCorrelationId(): string;

  /** Generate a new correlation id. */
  generateCorrelationId(): string;
}
