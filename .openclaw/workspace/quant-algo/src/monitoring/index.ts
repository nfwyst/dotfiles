/**
 * 监控模块导出
 *
 * 提供 Prometheus 兼容的指标收集和暴露功能
 * 提供 OpenTelemetry 分布式追踪功能
 * 提供性能追踪和监控仪表板
 * 提供生产环境告警管理
 */

// 指标收集器
export { MetricsCollector, metricsCollector } from './MetricsCollector.js';
export type {
  TradingLabelNames,
  APILabelNames,
  LLMLabelNames,
  ErrorLabelNames,
  CircuitBreakerLabelNames,
  DataFetchLabelNames,
} from './MetricsCollector.js';

// 分布式追踪
export {
  TracingManager,
  tracingManager,
  getActiveSpan,
  getTraceId,
  getActiveSpanContext,
  addSpanEvent,
  setSpanError,
  setSpanAttributes,
  traced,
  tracedAsync,
  traceFunction,
  traceAsyncFunction,
  createChildSpan,
  getTraceContextForLogging,
} from './tracing.js';
export type {
  TracingConfig,
  SpanContext,
  TracingOptions,
} from './tracing.js';

// 性能追踪器 (新增)
export { PerformanceTracker } from './performanceTracker';
export type {
  TradeRecord,
  DailyMetrics,
  PerformanceMetrics,
  PerformanceReport,
} from './performanceTracker';

// 监控仪表板 (新增)
export { MonitoringDashboard } from './dashboard';
export type {
  SystemStatus,
  SystemAlert,
} from './dashboard';

// 告警管理器
export {
  AlertManager,
  AlertSeverity,
  AlertChannel,
} from './alertManager';
export type {
  AlertRule,
  Alert,
  AlertConfig,
} from './alertManager';
