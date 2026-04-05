/**
 * Prometheus 指标服务器
 * 
 * 提供 HTTP 服务器暴露 /metrics 端点
 * 支持 Prometheus 抓取格式，兼容 Grafana 可视化
 */

import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { metricsCollector } from './MetricsCollector.js';
import logger from '../logger.js';

// ==================== 配置 ====================

export interface MetricsServerConfig {
  port: number;
  host: string;
  path: string;
}

const DEFAULT_CONFIG: MetricsServerConfig = {
  port: parseInt(process.env.METRICS_PORT || '9090'),
  host: process.env.METRICS_HOST || '0.0.0.0',
  path: '/metrics',
};

// ==================== MetricsServer 类 ====================

export class MetricsServer {
  private server: Server | null = null;
  private config: MetricsServerConfig;
  private isRunning: boolean = false;
  
  constructor(config: Partial<MetricsServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 启动指标服务器
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        logger.warn('[MetricsServer] 服务器已在运行');
        resolve();
        return;
      }
      
      this.server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        await this.handleRequest(req, res);
      });
      
      this.server.on('error', (error: Error) => {
        logger.error('[MetricsServer] 服务器错误:', error);
        if (!this.isRunning) {
          reject(error);
        }
      });
      
      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        logger.info(`[MetricsServer] 📊 指标服务器启动成功`);
        logger.info(`   端点: http://${this.config.host}:${this.config.port}${this.config.path}`);
        logger.info(`   Prometheus 可通过此端点抓取指标`);
        resolve();
      });
    });
  }
  
  /**
   * 停止指标服务器
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server || !this.isRunning) {
        resolve();
        return;
      }
      
      this.server.close((error) => {
        if (error) {
          logger.error('[MetricsServer] 停止服务器失败:', error);
          reject(error);
        } else {
          this.isRunning = false;
          this.server = null;
          logger.info('[MetricsServer] 指标服务器已停止');
          resolve();
        }
      });
    });
  }
  
  /**
   * 处理 HTTP 请求
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '/';
    const method = req.method || 'GET';
    
    // 只处理 GET 请求
    if (method !== 'GET') {
      this.sendResponse(res, 405, 'Method Not Allowed');
      return;
    }
    
    // 处理 /metrics 端点
    if (url === this.config.path || url === '/') {
      await this.handleMetricsRequest(res);
      return;
    }
    
    // 处理健康检查
    if (url === '/health' || url === '/healthz') {
      this.sendResponse(res, 200, 'OK', 'text/plain');
      return;
    }
    
    // 处理就绪检查
    if (url === '/ready' || url === '/readyz') {
      this.sendResponse(res, 200, 'OK', 'text/plain');
      return;
    }
    
    // 404 响应
    this.sendResponse(res, 404, 'Not Found');
  }
  
  /**
   * 处理 /metrics 请求
   */
  private async handleMetricsRequest(res: ServerResponse): Promise<void> {
    try {
      const metrics = await metricsCollector.getMetrics();
      this.sendResponse(res, 200, metrics, 'text/plain; version=0.0.4; charset=utf-8');
    } catch (error) {
      logger.error('[MetricsServer] 获取指标失败:', error);
      this.sendResponse(res, 500, 'Internal Server Error');
    }
  }
  
  /**
   * 发送 HTTP 响应
   */
  private sendResponse(
    res: ServerResponse,
    statusCode: number,
    body: string,
    contentType: string = 'text/plain'
  ): void {
    res.writeHead(statusCode, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  }
  
  /**
   * 获取服务器状态
   */
  getStatus(): { isRunning: boolean; port: number; host: string; path: string } {
    return {
      isRunning: this.isRunning,
      port: this.config.port,
      host: this.config.host,
      path: this.config.path,
    };
  }
}

// ==================== 单例导出 ====================

let metricsServerInstance: MetricsServer | null = null;

export function getMetricsServer(config?: Partial<MetricsServerConfig>): MetricsServer {
  if (!metricsServerInstance) {
    metricsServerInstance = new MetricsServer(config);
  }
  return metricsServerInstance;
}

export function resetMetricsServer(): void {
  if (metricsServerInstance) {
    metricsServerInstance.stop().catch(() => {});
    metricsServerInstance = null;
  }
}

export default MetricsServer;
