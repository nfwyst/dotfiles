/**
 * Kill Switch - 全局停止机制
 * 
 * 多层防御机制：
 * 1. 内存标志位（最快，<1ms）
 * 2. Redis 共享状态（跨进程，~1-5ms）
 * 3. 文件标记（持久化，~10-50ms）
 * 
 * 检查优先级：内存 -> Redis -> 文件
 */

import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';
import logger from '../logger';
import { config } from '../config';
import { metricsCollector } from '../monitoring/index.js';

// ==================== 类型定义 ====================

export interface KillSwitchState {
  isActive: boolean;
  reason: string | null;
  activatedAt: number | null;
  activatedBy: string | null;
  deactivatedAt: number | null;
  checkCount: number;
  lastCheckAt: number | null;
}

export interface KillSwitchConfig {
  redisKey: string;
  filePath: string;
  autoRecoveryMs: number; // 自动恢复时间（0 表示不自动恢复）
  checkFileIntervalMs: number; // 文件检查间隔
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: KillSwitchConfig = {
  redisKey: 'quant-alto:killswitch',
  filePath: path.join(process.cwd(), 'state', 'killswitch.json'),
  autoRecoveryMs: 0,
  checkFileIntervalMs: 1000,
};

// ==================== KillSwitch 类 ====================

export class KillSwitch {
  private static instance: KillSwitch | null = null;
  
  // 第一层：内存标志位（最快）
  private memoryState: KillSwitchState = {
    isActive: false,
    reason: null,
    activatedAt: null,
    activatedBy: null,
    deactivatedAt: null,
    checkCount: 0,
    lastCheckAt: null,
  };
  
  // 第二层：Redis 连接
  private redis: Redis | null = null;
  private redisConnected: boolean = false;
  
  // 配置
  private config: KillSwitchConfig;
  
  // 文件检查缓存
  private lastFileCheck: number = 0;
  private cachedFileState: KillSwitchState | null = null;
  
  // 告警回调
  private alertCallbacks: Array<(state: KillSwitchState) => void> = [];
  
  // 私有构造函数（单例模式）
  private constructor(customConfig?: Partial<KillSwitchConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...customConfig };
    this.initRedis();
    this.initFileWatch();
    
    // 启动时检查持久化状态
    this.checkPersistedState();
  }
  
  // ==================== 单例获取 ====================
  
  /**
   * 获取 KillSwitch 单例实例
   */
  static getInstance(customConfig?: Partial<KillSwitchConfig>): KillSwitch {
    if (!KillSwitch.instance) {
      KillSwitch.instance = new KillSwitch(customConfig);
    }
    return KillSwitch.instance;
  }
  
  /**
   * 重置单例（仅用于测试）
   */
  static resetInstance(): void {
    if (KillSwitch.instance) {
      KillSwitch.instance.cleanup();
      KillSwitch.instance = null;
    }
  }
  
  // ==================== 初始化方法 ====================
  
  /**
   * 初始化 Redis 连接
   */
  private initRedis(): void {
    try {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        keyPrefix: config.redis.keyPrefix,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn('[KillSwitch] Redis 连接失败，将使用内存+文件模式');
            return null;
          }
          return Math.min(times * 100, 1000);
        },
      });
      
      this.redis.on('connect', () => {
        this.redisConnected = true;
        logger.info('[KillSwitch] Redis 连接成功');
      });
      
      this.redis.on('error', (err) => {
        logger.error('[KillSwitch] Redis 错误:', err);
        this.redisConnected = false;
      });
      
      this.redis.on('close', () => {
        this.redisConnected = false;
      });
      
      // 尝试连接
      this.redis.connect().catch(() => {
        logger.warn('[KillSwitch] Redis 连接失败，继续使用内存+文件模式');
      });
      
    } catch (error) {
      logger.warn('[KillSwitch] Redis 初始化失败:', error);
      this.redis = null;
    }
  }
  
  /**
   * 初始化文件监听
   */
  private initFileWatch(): void {
    // 确保 state 目录存在
    const stateDir = path.dirname(this.config.filePath);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
  }
  
  /**
   * 检查持久化状态（启动时）
   */
  private async checkPersistedState(): Promise<void> {
    try {
      // 检查文件状态
      const fileState = this.readFromFile();
      if (fileState?.isActive) {
        logger.warn('[KillSwitch] 检测到之前激活的 Kill Switch（文件）');
        this.memoryState = { ...fileState };
        this.triggerAlert(this.memoryState);
        return;
      }
      
      // 检查 Redis 状态
      if (this.redisConnected && this.redis) {
        const redisState = await this.readFromRedis();
        if (redisState?.isActive) {
          logger.warn('[KillSwitch] 检测到之前激活的 Kill Switch（Redis）');
          this.memoryState = { ...redisState };
          this.writeToFile(redisState);
          this.triggerAlert(this.memoryState);
        }
      }
    } catch (error) {
      logger.error('[KillSwitch] 检查持久化状态失败:', error);
    }
  }
  
  // ==================== 核心方法 ====================
  
  /**
   * 检查 Kill Switch 是否激活（同步，仅检查内存）
   * 这是最快的检查方法，用于高频调用场景
   */
  isActive(): boolean {
    this.memoryState.checkCount++;
    this.memoryState.lastCheckAt = Date.now();
    return this.memoryState.isActive;
  }
  
  /**
   * 完整检查（异步，检查所有层）
   * 用于关键操作前的安全检查
   */
  async checkFull(): Promise<{ blocked: boolean; reason: string | null; source: string }> {
    // 1. 内存检查（最快）
    if (this.memoryState.isActive) {
      return {
        blocked: true,
        reason: this.memoryState.reason,
        source: 'memory',
      };
    }
    
    // 2. Redis 检查
    if (this.redisConnected && this.redis) {
      try {
        const redisState = await this.readFromRedis();
        if (redisState?.isActive) {
          // 同步到内存
          this.memoryState = { ...redisState };
          return {
            blocked: true,
            reason: redisState.reason,
            source: 'redis',
          };
        }
      } catch (error) {
        logger.error('[KillSwitch] Redis 检查失败:', error);
      }
    }
    
    // 3. 文件检查（带缓存）
    const now = Date.now();
    if (now - this.lastFileCheck > this.config.checkFileIntervalMs) {
      this.lastFileCheck = now;
      const fileState = this.readFromFile();
      this.cachedFileState = fileState;
      
      if (fileState?.isActive) {
        // 同步到内存
        this.memoryState = { ...fileState };
        return {
          blocked: true,
          reason: fileState.reason,
          source: 'file',
        };
      }
    } else if (this.cachedFileState?.isActive) {
      return {
        blocked: true,
        reason: this.cachedFileState.reason,
        source: 'file_cached',
      };
    }
    
    return {
      blocked: false,
      reason: null,
      source: 'none',
    };
  }
  
  /**
   * 激活 Kill Switch
   */
  async activate(reason: string, activatedBy: string = 'system'): Promise<void> {
    const now = Date.now();
    
    const newState: KillSwitchState = {
      isActive: true,
      reason,
      activatedAt: now,
      activatedBy,
      deactivatedAt: null,
      checkCount: this.memoryState.checkCount,
      lastCheckAt: now,
    };
    
    // 1. 更新内存（立即生效）
    this.memoryState = newState;
    
    // 2. 写入 Redis
    await this.writeToRedis(newState);
    
    // 3. 写入文件
    this.writeToFile(newState);
    
    // 日志
    logger.error(`🚨 [KillSwitch] 已激活！原因: ${reason}，操作者: ${activatedBy}`);
    
    // 触发告警
    this.triggerAlert(newState);
    
    // Prometheus 指标：更新 Kill Switch 状态
    metricsCollector.updateKillswitchStatus(true);
  }

  /**
   * 解除 Kill Switch
   */
  async deactivate(deactivatedBy: string = 'system'): Promise<void> {
    const now = Date.now();
    
    const newState: KillSwitchState = {
      ...this.memoryState,
      isActive: false,
      deactivatedAt: now,
      lastCheckAt: now,
    };
    
    // 1. 更新内存（立即生效）
    this.memoryState = newState;
    
    // 2. 清除 Redis
    await this.clearRedis();
    
    // 3. 更新文件
    this.writeToFile(newState);
    
    // 日志
    logger.info(`✅ [KillSwitch] 已解除！操作者: ${deactivatedBy}`);
    
    // 触发告警
    this.triggerAlert(newState);
    
    // Prometheus 指标：更新 Kill Switch 状态
    metricsCollector.updateKillswitchStatus(false);
  }

  // ==================== 状态查询 ==================
  
  /**
   * 获取当前状态
   */
  getState(): Readonly<KillSwitchState> {
    return { ...this.memoryState };
  }
  
  /**
   * 获取激活原因
   */
  getActivationReason(): string | null {
    return this.memoryState.reason;
  }
  
  /**
   * 获取激活时间
   */
  getActivationTime(): number | null {
    return this.memoryState.activatedAt;
  }
  
  /**
   * 获取激活持续时间（毫秒）
   */
  getActiveDuration(): number | null {
    if (!this.memoryState.isActive || !this.memoryState.activatedAt) {
      return null;
    }
    return Date.now() - this.memoryState.activatedAt;
  }
  
  // ==================== 告警系统 ====================
  
  /**
   * 注册告警回调
   */
  onAlert(callback: (state: KillSwitchState) => void): void {
    this.alertCallbacks.push(callback);
  }
  
  /**
   * 移除告警回调
   */
  offAlert(callback: (state: KillSwitchState) => void): void {
    this.alertCallbacks = this.alertCallbacks.filter(cb => cb !== callback);
  }
  
  /**
   * 触发告警
   */
  private triggerAlert(state: KillSwitchState): void {
    for (const callback of this.alertCallbacks) {
      try {
        callback(state);
      } catch (error) {
        logger.error('[KillSwitch] 告警回调执行失败:', error);
      }
    }
  }
  
  // ==================== Redis 操作 ====================
  
  private async writeToRedis(state: KillSwitchState): Promise<void> {
    if (!this.redis || !this.redisConnected) return;
    
    try {
      const key = this.config.redisKey;
      await this.redis.set(key, JSON.stringify(state));
      // 不设置过期时间，需要手动解除
    } catch (error) {
      logger.error('[KillSwitch] Redis 写入失败:', error);
    }
  }
  
  private async readFromRedis(): Promise<KillSwitchState | null> {
    if (!this.redis || !this.redisConnected) return null;
    
    try {
      const key = this.config.redisKey;
      const data = await this.redis.get(key);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('[KillSwitch] Redis 读取失败:', error);
    }
    return null;
  }
  
  private async clearRedis(): Promise<void> {
    if (!this.redis || !this.redisConnected) return;
    
    try {
      const key = this.config.redisKey;
      await this.redis.del(key);
    } catch (error) {
      logger.error('[KillSwitch] Redis 清除失败:', error);
    }
  }
  
  // ==================== 文件操作 ====================
  
  private writeToFile(state: KillSwitchState): void {
    try {
      const stateDir = path.dirname(this.config.filePath);
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }
      fs.writeFileSync(this.config.filePath, JSON.stringify(state, null, 2));
    } catch (error) {
      logger.error('[KillSwitch] 文件写入失败:', error);
    }
  }
  
  private readFromFile(): KillSwitchState | null {
    try {
      if (fs.existsSync(this.config.filePath)) {
        const data = fs.readFileSync(this.config.filePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('[KillSwitch] 文件读取失败:', error);
    }
    return null;
  }
  
  // ==================== 清理 ====================
  
  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.redis) {
      this.redis.disconnect(false);
      this.redis = null;
    }
    this.alertCallbacks = [];
  }
}

// ==================== 单例导出 ====================

export const killSwitch = KillSwitch.getInstance();
export default KillSwitch;
