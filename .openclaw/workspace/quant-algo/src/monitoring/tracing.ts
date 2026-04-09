/**
 * 分布式追踪模块 - Distributed Tracing Module
 * 
 * 基于 OpenTelemetry 实现的分布式追踪系统
 * 支持跨模块调用链追踪、Trace ID注入日志
 * 
 * 功能：
 * 1. 初始化 OpenTelemetry SDK
 * 2. 配置 TraceExporter (OTLP/HTTP)
 * 3. 提供追踪装饰器和工具函数
 * 4. 与日志系统集成 (Trace ID 注入)
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import {
  trace,
  context,
  SpanStatusCode,
} from '@opentelemetry/api';
import type {
  Span,
  SpanOptions,
  Tracer,
  Context,
  SpanAttributes,
} from '@opentelemetry/api';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import logger, { setTraceContextGetter } from '../logger';

// ==================== 类型定义 ====================

/**
 * 追踪配置
 */
export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  endpoint: string;
  samplingRate: number;
  exportTimeout: number;
  batchSize: number;
  batchTimeout: number;
}

/**
 * Span 上下文信息
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

/**
 * 追踪选项
 */
export interface TracingOptions extends SpanOptions {
  /**
   * 模块名称
   */
  module?: string;
  
  /**
   * 操作类型
   */
  operation?: string;
  
  /**
   * 是否记录参数
   */
  recordArgs?: boolean;
  
  /**
   * 是否记录结果
   */
  recordResult?: boolean;
  
  /**
   * 敏感字段列表 (不会被记录)
   */
  sensitiveFields?: string[];
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: TracingConfig = {
  enabled: process.env.ENABLE_TRACING === 'true',
  serviceName: process.env.TRACING_SERVICE_NAME || 'quant-alto',
  endpoint: process.env.TRACING_ENDPOINT || 'http://localhost:4318/v1/traces',
  samplingRate: parseFloat(process.env.TRACING_SAMPLING_RATE || '1.0'),
  exportTimeout: parseInt(process.env.TRACING_EXPORT_TIMEOUT || '30000'),
  batchSize: parseInt(process.env.TRACING_BATCH_SIZE || '512'),
  batchTimeout: parseInt(process.env.TRACING_BATCH_TIMEOUT || '5000'),
};

// ==================== 追踪器类 ====================

/**
 * 分布式追踪器
 * 单例模式管理 OpenTelemetry SDK
 */
export class TracingManager {
  private static instance: TracingManager | null = null;
  
  private sdk: NodeSDK | null = null;
  private tracer: Tracer | null = null;
  private config: TracingConfig;
  private isInitialized: boolean = false;

  private constructor(config: Partial<TracingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<TracingConfig>): TracingManager {
    if (!TracingManager.instance) {
      TracingManager.instance = new TracingManager(config);
    }
    return TracingManager.instance;
  }

  /**
   * 重置实例 (仅用于测试)
   */
  static resetInstance(): void {
    if (TracingManager.instance) {
      TracingManager.instance.shutdown().catch(console.error);
      TracingManager.instance = null;
    }
  }

  /**
   * 初始化追踪系统
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (!this.config.enabled) {
      logger.info('⚠️ 分布式追踪已禁用');
      this.isInitialized = true;
      // 即使追踪禁用，也设置 trace context getter 以便日志正常工作
      setTraceContextGetter(() => ({}));
      return;
    }

    try {
      // 创建资源
      const resource = resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      });

      // 创建导出器
      const exporter = new OTLPTraceExporter({
        url: this.config.endpoint,
        timeoutMillis: this.config.exportTimeout,
      });

      // 创建 Span 处理器
      const spanProcessor = new BatchSpanProcessor(exporter, {
        maxExportBatchSize: this.config.batchSize,
        scheduledDelayMillis: this.config.batchTimeout,
        exportTimeoutMillis: this.config.exportTimeout,
      });

      // 创建 SDK
      this.sdk = new NodeSDK({
        resource,
        spanProcessor,
      });

      // 启动 SDK
      await this.sdk.start();

      // 获取 Tracer
      this.tracer = trace.getTracer(this.config.serviceName, '1.0.0');

      // 设置日志的 Trace Context 获取器
      setTraceContextGetter(() => {
        const spanContext = this.getActiveSpanContext();
        if (!spanContext) return {};
        return {
          traceId: spanContext.traceId,
          spanId: spanContext.spanId,
        };
      });

      this.isInitialized = true;
      logger.info(`✅ 分布式追踪已初始化 | Endpoint: ${this.config.endpoint} | Sampling: ${this.config.samplingRate * 100}%`);
    } catch (error) {
      logger.error('初始化分布式追踪失败:', error);
      throw error;
    }
  }

  /**
   * 关闭追踪系统
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        logger.info('✅ 分布式追踪已关闭');
      } catch (error) {
        logger.error('关闭分布式追踪失败:', error);
      }
      this.sdk = null;
      this.tracer = null;
      this.isInitialized = false;
    }
  }

  /**
   * 检查是否已初始化
   */
  isEnabled(): boolean {
    return this.isInitialized && this.config.enabled && this.tracer !== null;
  }

  /**
   * 获取 Tracer
   */
  getTracer(): Tracer {
    if (!this.tracer) {
      throw new Error('追踪器未初始化，请先调用 initialize()');
    }
    return this.tracer;
  }

  /**
   * 获取当前活跃的 Span
   */
  getActiveSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * 获取当前 Span 上下文
   */
  getActiveSpanContext(): SpanContext | undefined {
    const span = this.getActiveSpan();
    if (!span) return undefined;

    const ctx = span.spanContext();
    return {
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      traceFlags: ctx.traceFlags,
    };
  }

  /**
   * 获取当前 Trace ID
   */
  getTraceId(): string | undefined {
    return this.getActiveSpanContext()?.traceId;
  }

  /**
   * 创建子 Span
   */
  startSpan(name: string, options?: SpanOptions): Span {
    return this.getTracer().startSpan(name, options);
  }

  /**
   * 在 Span 上下文中执行函数
   */
  withSpan<T>(span: Span, fn: () => T): T {
    return context.with(trace.setSpan(context.active(), span), fn);
  }

  /**
   * 在 Span 上下文中执行异步函数
   */
  async withSpanAsync<T>(span: Span, fn: () => Promise<T>): Promise<T> {
    return context.with(trace.setSpan(context.active(), span), fn);
  }

  /**
   * 获取配置
   */
  getConfig(): TracingConfig {
    return { ...this.config };
  }
}

// ==================== 工具函数 ====================

/**
 * 全局追踪管理器实例
 */
export const tracingManager = TracingManager.getInstance();

/**
 * 获取当前活跃的 Span
 */
export function getActiveSpan(): Span | undefined {
  return tracingManager.getActiveSpan();
}

/**
 * 获取当前 Trace ID
 */
export function getTraceId(): string | undefined {
  return tracingManager.getTraceId();
}

/**
 * 获取当前 Span 上下文
 */
export function getActiveSpanContext(): SpanContext | undefined {
  return tracingManager.getActiveSpanContext();
}

/**
 * 添加事件到当前 Span
 */
export function addSpanEvent(name: string, attributes?: SpanAttributes): void {
  const span = getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * 设置当前 Span 状态为错误
 */
export function setSpanError(error: Error | string, attributes?: SpanAttributes): void {
  const span = getActiveSpan();
  if (span) {
    const message = typeof error === 'string' ? error : error.message;
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message,
    });
    if (attributes) {
      span.setAttributes(attributes);
    }
  }
}

/**
 * 设置当前 Span 属性
 */
export function setSpanAttributes(attributes: SpanAttributes): void {
  const span = getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

// ==================== 追踪装饰器 ====================

/**
 * 同步函数追踪包装器
 */
export function traced<T extends (...args: unknown[]) => unknown>(
  name: string,
  options: TracingOptions = {}
): (target: unknown, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T> {
  return function (target: unknown, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) {
    const originalMethod = descriptor.value!;
    
    descriptor.value = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
      if (!tracingManager.isEnabled()) {
        return originalMethod.apply(this, args);
      }

      const spanName = `${options.module || 'unknown'}.${name}`;
      const span = tracingManager.startSpan(spanName, {
        kind: options.kind,
        attributes: {
          'function.name': name,
          'function.module': options.module || 'unknown',
          'function.operation': options.operation || 'execute',
        },
      });

      try {
        // 记录参数 (排除敏感字段)
        if (options.recordArgs !== false) {
          const safeArgs = filterSensitiveData(args, options.sensitiveFields);
          span.setAttributes({
            'function.args': JSON.stringify(safeArgs),
          });
        }

        const result = tracingManager.withSpan(span, () => originalMethod.apply(this, args));

        // 记录结果
        if (options.recordResult !== false && result !== undefined) {
          span.setAttributes({
            'function.result': JSON.stringify(filterSensitiveData(result, options.sensitiveFields)),
          });
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        return result;
      } catch (error: unknown) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error instanceof Error ? error.message : String(error)),
        });
        span.end();
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 异步函数追踪包装器
 */
export function tracedAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  options: TracingOptions = {}
): (target: unknown, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T> {
  return function (target: unknown, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) {
    const originalMethod = descriptor.value!;
    
    descriptor.value = async function (this: unknown, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
      if (!tracingManager.isEnabled()) {
        return originalMethod.apply(this, args);
      }

      const spanName = `${options.module || 'unknown'}.${name}`;
      const span = tracingManager.startSpan(spanName, {
        kind: options.kind,
        attributes: {
          'function.name': name,
          'function.module': options.module || 'unknown',
          'function.operation': options.operation || 'execute',
        },
      });

      try {
        // 记录参数 (排除敏感字段)
        if (options.recordArgs !== false) {
          const safeArgs = filterSensitiveData(args, options.sensitiveFields);
          span.setAttributes({
            'function.args': JSON.stringify(safeArgs),
          });
        }

        const result = await tracingManager.withSpanAsync(span, () => originalMethod.apply(this, args));

        // 记录结果
        if (options.recordResult !== false && result !== undefined) {
          span.setAttributes({
            'function.result': JSON.stringify(filterSensitiveData(result, options.sensitiveFields)),
          });
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        return result;
      } catch (error: unknown) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error instanceof Error ? error.message : String(error)),
        });
        span.end();
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 函数追踪包装器 (不使用装饰器)
 */
export function traceFunction<T>(
  name: string,
  fn: () => T,
  options: TracingOptions = {}
): T {
  if (!tracingManager.isEnabled()) {
    return fn();
  }

  const spanName = `${options.module || 'unknown'}.${name}`;
  const span = tracingManager.startSpan(spanName, {
    kind: options.kind,
    attributes: {
      'function.name': name,
      'function.module': options.module || 'unknown',
      'function.operation': options.operation || 'execute',
    },
  });

  try {
    const result = tracingManager.withSpan(span, fn);
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    return result;
  } catch (error: unknown) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error instanceof Error ? error.message : String(error)),
    });
    span.end();
    throw error;
  }
}

/**
 * 异步函数追踪包装器 (不使用装饰器)
 */
export async function traceAsyncFunction<T>(
  name: string,
  fn: () => Promise<T>,
  options: TracingOptions = {}
): Promise<T> {
  if (!tracingManager.isEnabled()) {
    return fn();
  }

  const spanName = `${options.module || 'unknown'}.${name}`;
  const span = tracingManager.startSpan(spanName, {
    kind: options.kind,
    attributes: {
      'function.name': name,
      'function.module': options.module || 'unknown',
      'function.operation': options.operation || 'execute',
    },
  });

  try {
    const result = await tracingManager.withSpanAsync(span, fn);
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    return result;
  } catch (error: unknown) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error instanceof Error ? error.message : String(error)),
    });
    span.end();
    throw error;
  }
}

// ==================== 辅助函数 ====================

/**
 * 过滤敏感数据
 */
function filterSensitiveData(data: unknown, sensitiveFields: string[] = []): unknown {
  const defaultSensitiveFields = [
    'password',
    'secret',
    'apiKey',
    'api_key',
    'apiKeySecret',
    'api_secret',
    'token',
    'authorization',
    'credential',
    'privateKey',
    'private_key',
  ];

  const fieldsToHide = [...defaultSensitiveFields, ...sensitiveFields];

  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => filterSensitiveData(item, sensitiveFields));
  }

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (fieldsToHide.some(field => lowerKey.includes(field.toLowerCase()))) {
      filtered[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      filtered[key] = filterSensitiveData(value, sensitiveFields);
    } else {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * 创建子 Span 辅助函数
 */
export function createChildSpan(name: string, parentSpan?: Span): Span {
  const tracer = tracingManager.getTracer();
  
  if (parentSpan) {
    const ctx = trace.setSpan(context.active(), parentSpan);
    return tracer.startSpan(name, undefined, ctx);
  }
  
  return tracer.startSpan(name);
}

/**
 * 传播追踪上下文到日志
 */
export function getTraceContextForLogging(): Record<string, string> {
  const spanContext = getActiveSpanContext();
  if (!spanContext) {
    return {};
  }

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

// ==================== 导出 ====================

export default TracingManager;
