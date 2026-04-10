/**
 * 6. 日志系统模块
 * 
 * 职责:
 * - 分级日志记录 (DEBUG/INFO/WARN/ERROR/FATAL)
 * - 多输出目标 (控制台/文件/远程)
 * - 日志轮转和归档
 * - 结构化日志 (JSON格式)
 * - 性能指标记录
 * - 交易审计日志
 */

import fs from 'fs';
import path from 'path';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
type LogOutput = 'console' | 'file' | 'both' | 'none';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  traceId?: string;
}

interface TradeLogEntry {
  timestamp: string;
  type: 'OPEN' | 'CLOSE' | 'TP1' | 'TP2' | 'TP3' | 'SL' | 'PARTIAL_CLOSE';
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  pnlPercent?: number;
  strategy: string;
  signalStrength: number;
  signalConfidence: number;
  reasoning: string[];
  metadata?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  timestamp: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
}

export class LoggerModule {
  private config: {
    level: LogLevel;
    output: LogOutput;
    logDir: string;
    maxFileSize: number;
    maxFiles: number;
    enableConsole: boolean;
    enableFile: boolean;
    enableAudit: boolean;
    enableMetrics: boolean;
  } = {
    level: 'INFO',
    output: 'both',
    logDir: './logs',
    maxFileSize: 10 * 1024 * 1024,  // 10MB
    maxFiles: 10,
    enableConsole: true,
    enableFile: true,
    enableAudit: true,
    enableMetrics: true,
  };
  
  private currentLogFile: string = '';
  private currentSize: number = 0;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  
  // 模块名称
  private moduleName: string;
  
  constructor(moduleName: string = 'default', config?: Partial<typeof this.config>) {
    this.moduleName = moduleName;
    this.config = { ...this.config, ...config };
    
    this.initialize();
  }
  
  /**
   * 初始化日志系统
   */
  private initialize() {
    // 创建日志目录
    if (this.config.enableFile) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
      fs.mkdirSync(path.join(this.config.logDir, 'audit'), { recursive: true });
      fs.mkdirSync(path.join(this.config.logDir, 'metrics'), { recursive: true });
      this.rotateLogFile();
    }
    
    // 启动定时刷新
    this.flushInterval = setInterval(() => this.flush(), 1000);
    this.flushInterval.unref();
    
    // 程序退出时刷新
    process.on('exit', () => this.flush());
    process.on('SIGINT', () => { this.flush(); process.exit(0); });
  }
  
  /**
   * 设置配置
   */
  setConfig(config: Partial<typeof this.config>) {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 分级日志方法
   */
  debug(message: string, data?: unknown) {
    this.log('DEBUG', message, data);
  }
  
  info(message: string, data?: unknown) {
    this.log('INFO', message, data);
  }
  
  warn(message: string, data?: unknown) {
    this.log('WARN', message, data);
  }
  
  error(message: string, data?: unknown) {
    this.log('ERROR', message, data);
  }
  
  fatal(message: string, data?: unknown) {
    this.log('FATAL', message, data);
  }
  
  /**
   * 核心日志方法
   */
  private log(level: LogLevel, message: string, data?: unknown) {
    // 级别过滤
    if (!this.shouldLog(level)) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.moduleName,
      message,
      data,
      traceId: this.generateTraceId(),
    };
    
    // 添加到缓冲区
    this.logBuffer.push(entry);
    
    // 控制台输出
    if (this.config.enableConsole && (this.config.output === 'console' || this.config.output === 'both')) {
      this.consoleOutput(entry);
    }
    
    // 立即刷新错误日志
    if (level === 'ERROR' || level === 'FATAL') {
      this.flush();
    }
  }
  
  /**
   * 判断是否应该记录该级别
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    const configLevel = levels.indexOf(this.config.level);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= configLevel;
  }
  
  /**
   * 控制台输出
   */
  private consoleOutput(entry: LogEntry) {
    const colors: Record<LogLevel, string> = {
      'DEBUG': '\x1b[36m',  // 青色
      'INFO': '\x1b[32m',   // 绿色
      'WARN': '\x1b[33m',   // 黄色
      'ERROR': '\x1b[31m',  // 红色
      'FATAL': '\x1b[35m',  // 紫色
    };
    const reset = '\x1b[0m';
    
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const color = colors[entry.level];
    
    console.log(
      `${color}[${time}] [${entry.level}] [${entry.module}]${reset} ${entry.message}`,
      entry.data ? JSON.stringify(entry.data).substring(0, 200) : ''
    );
  }
  
  /**
   * 刷新缓冲区到文件
   */
  private flush() {
    if (this.logBuffer.length === 0 || !this.config.enableFile) return;
    
    const lines = this.logBuffer.map(e => JSON.stringify(e)).join('\n') + '\n';
    
    try {
      fs.appendFileSync(this.currentLogFile, lines);
      this.currentSize += Buffer.byteLength(lines);
      
      // 检查是否需要轮转
      if (this.currentSize >= this.config.maxFileSize) {
        this.rotateLogFile();
      }
      
      this.logBuffer = [];
    } catch (e) {
      console.error('日志写入失败:', e);
    }
  }
  
  /**
   * 日志文件轮转
   */
  private rotateLogFile() {
    const date = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    this.currentLogFile = path.join(this.config.logDir, `${date}-${timestamp}.log`);
    this.currentSize = 0;
    
    // 清理旧文件
    this.cleanOldFiles();
  }
  
  /**
   * 清理旧日志文件
   */
  private cleanOldFiles() {
    try {
      const files = fs.readdirSync(this.config.logDir)
        .filter(f => f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.config.logDir, f),
          stats: fs.statSync(path.join(this.config.logDir, f))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
      
      // 删除超出数量的旧文件
      for (let i = this.config.maxFiles; i < files.length; i++) {
        fs.unlinkSync(files[i]!.path);
      }
    } catch (e) {
      console.error('清理旧日志失败:', e);
    }
  }
  
  /**
   * 交易审计日志
   */
  logTrade(entry: TradeLogEntry) {
    if (!this.config.enableAudit) return;
    
    const auditFile = path.join(this.config.logDir, 'audit', `trades-${new Date().toISOString().split('T')[0]}.jsonl`);
    
    try {
      fs.mkdirSync(path.dirname(auditFile), { recursive: true });
      fs.appendFileSync(auditFile, JSON.stringify(entry) + '\n');
    } catch (e) {
      console.error('交易日志写入失败:', e);
    }
  }
  
  /**
   * 性能指标记录
   */
  logMetrics(metrics: PerformanceMetrics) {
    if (!this.config.enableMetrics) return;
    
    const metricsFile = path.join(this.config.logDir, 'metrics', `metrics-${new Date().toISOString().split('T')[0]}.json`);
    
    try {
      fs.mkdirSync(path.dirname(metricsFile), { recursive: true });
      
      let data: PerformanceMetrics[] = [];
      if (fs.existsSync(metricsFile)) {
        data = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
      }
      
      data.push(metrics);
      fs.writeFileSync(metricsFile, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('指标记录失败:', e);
    }
  }
  
  /**
   * 获取交易历史
   */
  getTradeHistory(days: number = 7): TradeLogEntry[] {
    const history: TradeLogEntry[] = [];
    const auditDir = path.join(this.config.logDir, 'audit');
    
    try {
      const files = fs.readdirSync(auditDir).filter(f => f.endsWith('.jsonl'));
      
      for (const file of files.slice(-days)) {
        const content = fs.readFileSync(path.join(auditDir, file), 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            history.push(JSON.parse(line));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error('读取交易历史失败:', e);
    }
    
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  /**
   * 生成性能报告
   */
  generatePerformanceReport(): string {
    const history = this.getTradeHistory(30);
    
    if (history.length === 0) {
      return '暂无交易数据';
    }
    
    const total = history.length;
    const wins = history.filter(t => (t.pnl || 0) > 0).length;
    const losses = total - wins;
    const winRate = (wins / total) * 100;
    
    const totalPnL = history.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgPnL = totalPnL / total;
    
    const profits = history.filter(t => (t.pnl || 0) > 0).map(t => t.pnl || 0);
    const losses_ = history.filter(t => (t.pnl || 0) < 0).map(t => Math.abs(t.pnl || 0));
    
    const profitFactor = losses_.length > 0 ? profits.reduce((a, b) => a + b, 0) / losses_.reduce((a, b) => a + b, 0.001) 
      : 999;
    
    return `
╔════════════════════════════════════════════════════════════╗
║                    交易性能报告                             ║
╠════════════════════════════════════════════════════════════╣
║ 总交易次数:     ${total.toString().padEnd(47)} ║
║ 盈利次数:       ${wins.toString().padEnd(47)} ║
║ 亏损次数:       ${losses.toString().padEnd(47)} ║
║ 胜率:           ${winRate.toFixed(2)}%${''.padEnd(44)} ║
║ 总盈亏:         ${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} USDT${''.padEnd(38)} ║
║ 平均盈亏:       ${avgPnL >= 0 ? '+' : ''}${avgPnL.toFixed(2)} USDT${''.padEnd(37)} ║
║ 盈亏比:         ${profitFactor.toFixed(2)}${''.padEnd(46)} ║
╚════════════════════════════════════════════════════════════╝
    `.trim();
  }
  
  /**
   * 生成追踪ID
   */
  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 关闭日志系统
   */
  close() {
    this.flush();
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}

// 默认导出单例
let defaultLogger: LoggerModule | null = null;

export function getLogger(moduleName: string = 'default'): LoggerModule {
  if (!defaultLogger) {
    defaultLogger = new LoggerModule(moduleName);
  }
  return defaultLogger;
}

/**
 * 设置追踪上下文获取器 (用于 OpenTelemetry 集成)
 */
export function setTraceContextGetter(getter: () => { traceId: string; spanId: string } | string | undefined): void {
  // 简单实现：存储 getter 供日志系统使用
  // Store on globalThis using Object.defineProperty to avoid type assertion
  Object.defineProperty(globalThis, '__traceContextGetter', {
    value: getter,
    writable: true,
    configurable: true,
  });
}

export default LoggerModule;
