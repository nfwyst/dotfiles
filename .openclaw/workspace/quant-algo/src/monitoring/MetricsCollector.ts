/**
 * Prometheus 指标收集器
 * 
 * 使用 prom-client 库定义和收集 Prometheus 兼容的指标
 * 支持 Grafana 可视化监控
 */

import client, { Registry, Counter, Histogram, Gauge } from 'prom-client';

// ==================== 标签名称类型 ====================

export type TradingLabelNames = 'side' | 'symbol' | 'status' | 'reason';
export type APILabelNames = 'endpoint' | 'method' | 'status';
export type LLMLabelNames = 'provider' | 'model' | 'operation';
export type ErrorLabelNames = 'module' | 'error_type' | 'severity';
export type CircuitBreakerLabelNames = 'name' | 'state';
export type DataFetchLabelNames = 'source' | 'status';

// ==================== 指标收集器类 ====================

export class MetricsCollector {
  private static instance: MetricsCollector | null = null;
  
  // Prometheus 注册表
  private registry: Registry;
  
  // ==================== 交易指标 ====================
  
  private tradingSignalsTotal: Counter;
  private tradingOrdersTotal: Counter;
  private tradingOrderDurationSeconds: Histogram;
  private tradingPnlTotal: Counter;
  private tradingPositionValue: Gauge;
  
  // ==================== API 指标 ====================
  
  private apiRequestsTotal: Counter;
  private apiRequestDurationSeconds: Histogram;
  
  // ==================== LLM 指标 ====================
  
  private llmRequestsTotal: Counter;
  private llmTokensTotal: Counter;
  private llmRequestDurationSeconds: Histogram;
  
  // ==================== 安全模块指标 ====================
  
  private killswitchStatus: Gauge;
  private circuitBreakerState: Gauge;
  private errorsTotal: Counter;
  
  // ==================== 数据获取指标 ====================
  
  private dataFetchTotal: Counter;
  private dataFetchDurationSeconds: Histogram;
  
  // 私有构造函数 (单例模式)
  private constructor() {
    // 创建注册表
    this.registry = new Registry();
    
    // 添加默认标签
    this.registry.setDefaultLabels({
      app: 'quant-alto',
    });
    
    // ==================== 交易指标 ====================
    
    this.tradingSignalsTotal = new Counter({
      name: 'trading_signals_total',
      help: '交易信号总数',
      labelNames: ['side', 'symbol', 'status'],
      registers: [this.registry],
    });
    
    this.tradingOrdersTotal = new Counter({
      name: 'trading_orders_total',
      help: '订单总数',
      labelNames: ['side', 'symbol', 'status', 'reason'],
      registers: [this.registry],
    });
    
    this.tradingOrderDurationSeconds = new Histogram({
      name: 'trading_order_duration_seconds',
      help: '订单执行延迟',
      labelNames: ['side', 'symbol'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
    
    this.tradingPnlTotal = new Counter({
      name: 'trading_pnl_total',
      help: '累计盈亏 (USDT)',
      labelNames: ['side', 'symbol'],
      registers: [this.registry],
    });
    
    this.tradingPositionValue = new Gauge({
      name: 'trading_position_value',
      help: '持仓价值 (USDT)',
      labelNames: ['side', 'symbol'],
      registers: [this.registry],
    });
    
    // ==================== API 指标 ====================
    
    this.apiRequestsTotal = new Counter({
      name: 'api_requests_total',
      help: 'API 请求总数',
      labelNames: ['endpoint', 'method', 'status'],
      registers: [this.registry],
    });
    
    this.apiRequestDurationSeconds = new Histogram({
      name: 'api_request_duration_seconds',
      help: 'API 请求延迟',
      labelNames: ['endpoint', 'method'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
    
    // ==================== LLM 指标 ====================
    
    this.llmRequestsTotal = new Counter({
      name: 'llm_requests_total',
      help: 'LLM 请求总数',
      labelNames: ['provider', 'model', 'operation'],
      registers: [this.registry],
    });
    
    this.llmTokensTotal = new Counter({
      name: 'llm_tokens_total',
      help: 'Token 使用量',
      labelNames: ['provider', 'model', 'operation'],
      registers: [this.registry],
    });
    
    this.llmRequestDurationSeconds = new Histogram({
      name: 'llm_request_duration_seconds',
      help: 'LLM 请求延迟',
      labelNames: ['provider', 'model'],
      buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
      registers: [this.registry],
    });
    
    // ==================== 安全模块指标 ====================
    
    this.killswitchStatus = new Gauge({
      name: 'killswitch_status',
      help: 'Kill Switch 状态 (0=inactive, 1=active)',
      registers: [this.registry],
    });
    
    this.circuitBreakerState = new Gauge({
      name: 'circuit_breaker_state',
      help: '熔断器状态 (0=closed, 1=open, 2=half_open)',
      labelNames: ['name', 'state'],
      registers: [this.registry],
    });
    
    this.errorsTotal = new Counter({
      name: 'errors_total',
      help: '错误总数',
      labelNames: ['module', 'error_type', 'severity'],
      registers: [this.registry],
    });
    
    // ==================== 数据获取指标 ====================
    
    this.dataFetchTotal = new Counter({
      name: 'data_fetch_total',
      help: '数据获取次数',
      labelNames: ['source', 'status'],
      registers: [this.registry],
    });
    
    this.dataFetchDurationSeconds = new Histogram({
      name: 'data_fetch_duration_seconds',
      help: '数据获取延迟',
      labelNames: ['source'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
    
    // 启动默认指标收集 (CPU, 内存等)
    client.collectDefaultMetrics({ register: this.registry });
  }
  
  // ==================== 单例获取 ====================
  
  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }
  
  static resetInstance(): void {
    if (MetricsCollector.instance) {
      MetricsCollector.instance = null;
    }
  }
  
  // ==================== 交易指标方法 ====================
  
  /**
   * 记录交易信号
   */
  recordSignal(side: 'long' | 'short', symbol: string, status: 'success' | 'failed' = 'success'): void {
    this.tradingSignalsTotal.inc({ side, symbol, status });
  }
  
  /**
   * 记录订单
   */
  recordOrder(
    side: 'long' | 'short',
    symbol: string,
    status: 'success' | 'failed' | 'retrying',
    reason?: string
  ): void {
    this.tradingOrdersTotal.inc({ side, symbol, status, reason: reason || 'none' });
  }
  
  /**
   * 开始订单计时器
   */
  startOrderTimer(side: 'long' | 'short', symbol: string): () => void {
    return this.tradingOrderDurationSeconds.startTimer({ side, symbol });
  }
  
  /**
   * 记录盈亏
   */
  recordPnl(side: 'long' | 'short', symbol: string, pnl: number): void {
    if (pnl !== 0) {
      this.tradingPnlTotal.inc({ side, symbol }, pnl);
    }
  }
  
  /**
   * 更新持仓价值
   */
  updatePositionValue(side: 'long' | 'short', symbol: string, value: number): void {
    if (value > 0) {
      this.tradingPositionValue.set({ side, symbol }, value);
    } else {
      this.tradingPositionValue.remove({ side, symbol });
    }
  }
  
  /**
   * 清除持仓价值
   */
  clearPositionValue(side: 'long' | 'short', symbol: string): void {
    this.tradingPositionValue.remove({ side, symbol });
  }
  
  // ==================== API 指标方法 ====================
  
  /**
   * 记录 API 请求
   */
  recordApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE',
    status: 'success' | 'failed'
  ): void {
    this.apiRequestsTotal.inc({ endpoint, method, status });
  }
  
  /**
   * 开始 API 请求计时器
   */
  startApiTimer(endpoint: string, method: 'GET' | 'POST' | 'DELETE'): () => void {
    return this.apiRequestDurationSeconds.startTimer({ endpoint, method });
  }
  
  // ==================== LLM 指标方法 ====================
  
  /**
   * 记录 LLM 请求
   */
  recordLlmRequest(
    provider: string,
    model: string,
    operation: string
  ): void {
    this.llmRequestsTotal.inc({ provider, model, operation });
  }
  
  /**
   * 记录 Token 使用量
   */
  recordLlmTokens(
    provider: string,
    model: string,
    operation: string,
    tokens: number
  ): void {
    this.llmTokensTotal.inc({ provider, model, operation }, tokens);
  }
  
  /**
   * 开始 LLM 请求计时器
   */
  startLlmTimer(provider: string, model: string): () => void {
    return this.llmRequestDurationSeconds.startTimer({ provider, model });
  }
  
  // ==================== 安全模块指标方法 ====================
  
  /**
   * 更新 Kill Switch 状态
   */
  updateKillswitchStatus(isActive: boolean): void {
    this.killswitchStatus.set(isActive ? 1 : 0);
  }
  
  /**
   * 更新熔断器状态
   */
  updateCircuitBreakerState(name: string, state: 'closed' | 'open' | 'half_open'): void {
    const stateValue = state === 'closed' ? 0 : state === 'open' ? 1 : 2;
    this.circuitBreakerState.set({ name, state }, stateValue);
  }
  
  /**
   * 记录错误
   */
  recordError(
    module: string,
    errorType: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    this.errorsTotal.inc({ module, error_type: errorType, severity });
  }
  
  // ==================== 数据获取指标方法 ====================
  
  /**
   * 记录数据获取
   */
  recordDataFetch(source: string, status: 'success' | 'failed'): void {
    this.dataFetchTotal.inc({ source, status });
  }
  
  /**
   * 开始数据获取计时器
   */
  startDataFetchTimer(source: string): () => void {
    return this.dataFetchDurationSeconds.startTimer({ source });
  }
  
  // ==================== 输出方法 ====================
  
  /**
   * 获取 Prometheus 格式的指标输出
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
  
  /**
   * 获取注册表
   */
  getRegistry(): Registry {
    return this.registry;
  }
  
  /**
   * 清除所有指标 (仅用于测试)
   */
  clear(): void {
    this.registry.resetMetrics();
  }
}

// ==================== 单例导出 ====================

export const metricsCollector = MetricsCollector.getInstance();
export default MetricsCollector;
