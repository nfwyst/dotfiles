/**
 * 统一状态管理模块
 * 合并所有分散的状态文件到一个统一的结构
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// 状态文件路径
const STATE_DIR = path.join(process.cwd(), 'state');
const STATE_FILE = path.join(STATE_DIR, 'unified-state.json');
const SNAPSHOT_DIR = path.join(STATE_DIR, 'snapshots');
const MAX_SNAPSHOTS = 5;
const WAL_DIR = path.join(STATE_DIR, 'wal');
const CHECKPOINT_INTERVAL = 1000; // 每1000次操作checkpoint
const CHECKPOINT_TIME_INTERVAL = 60 * 1000; // 每分钟checkpoint

// WAL操作类型
export type WALOperationType = 
  | 'updateTrading'
  | 'updatePosition'
  | 'recordTrade'
  | 'updateLLM'
  | 'updateNotification'
  | 'updateStrategy'
  | 'updateDaemon'
  | 'updateCache'
  | 'checkpoint'
  | 'heartbeat';

// WAL记录结构
export interface WALEntry {
  sequence: number;        // ### 序号
  timestamp: number;       // ### 时间戳
  operation: WALOperationType;  // ### 操作类型
  data: any;              // ### 操作数据
  checksum: string;       // ### 校验和
}

// WAL文件信息
export interface WALFileInfo {
  filename: string;
  path: string;
  size: number;
  entryCount: number;
  firstSequence: number;
  lastSequence: number;
  createdAt: Date;
}

// WAL统计信息
export interface WALStats {
  totalEntries: number;
  totalSize: number;
  fileCount: number;
  lastSequence: number;
  lastCheckpointSequence: number;
  pendingOperations: number;
  walFiles: WALFileInfo[];
}
// 统一状态结构
export interface UnifiedState {
  // 元数据
  version: string;
  createdAt: string;
  updatedAt: string;
  
  // 交易状态
  trading: {
    balance: number;
    position: Position | null;
    lastPosition: Position | null;
    tradeCount: number;
    totalPnL: number;
    startTime: number;
    lastCheck: number;
  };
  
  // LLM 决策状态
  llm: {
    lastDecision: any | null;
    lastDecisionTime: number;
    lastDecisionPrice: number;
    thinking: string | null;
  };
  
  // 通知状态
  notification: {
    lastReportHash: string;
    lastReportTime: number;
    lastNotifyCheck: number;
    pendingNotifications: string[];
  };
  
  // 策略状态
  strategy: {
    lastSignal: any | null;
    lastSignalTime: number;
    strategyOutput: any | null;
  };
  
  // 守护进程状态
  daemon: {
    pid: number | null;
    startTime: number | null;
    lastHeartbeat: number;
    status: 'running' | 'stopped' | 'error';
    errorCount: number;
    lastError: string | null;
  };
  
  // 缓存
  cache: {
    newsCache: string;
    newsCacheTime: number;
    priceHistory: number[];
    lastPriceUpdateTime: number;
  };
}

export interface Position {
  side: 'long' | 'short' | 'none';
  contracts: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  stopLoss?: number;
  takeProfit?: number;
}

// 快照结构
export interface StateSnapshot {
  version: string;
  timestamp: string;
  checksum: string;
  state: UnifiedState;
}

// 快照元信息
export interface SnapshotInfo {
  filename: string;
  timestamp: string;
  checksum: string;
  size: number;
}

// 默认状态
const DEFAULT_STATE: UnifiedState = {
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  
  trading: {
    balance: 0,
    position: null,
    lastPosition: null,
    tradeCount: 0,
    totalPnL: 0,
    startTime: Date.now(),
    lastCheck: 0,
  },
  
  llm: {
    lastDecision: null,
    lastDecisionTime: 0,
    lastDecisionPrice: 0,
    thinking: null,
  },
  
  notification: {
    lastReportHash: '',
    lastReportTime: 0,
    lastNotifyCheck: 0,
    pendingNotifications: [],
  },
  
  strategy: {
    lastSignal: null,
    lastSignalTime: 0,
    strategyOutput: null,
  },
  
  daemon: {
    pid: null,
    startTime: null,
    lastHeartbeat: 0,
    status: 'stopped',
    errorCount: 0,
    lastError: null,
  },
  
  cache: {
    newsCache: '',
    newsCacheTime: 0,
    priceHistory: [],
    lastPriceUpdateTime: 0,
  },
};

/**
 * 状态管理器类
 */

/**
 * WAL(Write-Ahead Log)管理器
 * ### 确保崩溃恢复时零数据丢失
 */
export class WALManager {
  private currentSequence: number = 0;
  private currentWalFile: string | null = null;
  private walFd: number | null = null;
  private lastCheckpointSequence: number = 0;
  private operationCount: number = 0;
  private checkpointTimer: NodeJS.Timeout | null = null;
  private buffer: WALEntry[] = [];
  private syncPromise: Promise<void> | null = null;

  constructor() {
    this.initWAL();
  }

  /**
   * ### 初始化WAL
   */
  private initWAL(): void {
    if (!fs.existsSync(WAL_DIR)) {
      fs.mkdirSync(WAL_DIR, { recursive: true });
    }

    // 恢复序号
    this.currentSequence = this.getLastSequence();
    this.lastCheckpointSequence = this.getLastCheckpointSequence();

    // 创建或打开当前WAL文件
    this.rotateWALFile();

    // 启动定时checkpoint
    this.startCheckpointTimer();
  }

  /**
   * ### 生成WAL文件名
   */
  private generateWALFilename(): string {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .substring(0, 19);
    return `wal-${timestamp}.log`;
  }

  /**
   * ### 旋转WAL文件
   */
  private rotateWALFile(): void {
    // 关闭旧文件
    if (this.walFd !== null) {
      try {
        fs.fsyncSync(this.walFd);
        fs.closeSync(this.walFd);
      } catch (e) {
        console.error('关闭WAL文件失败:', e);
      }
    }

    // 创建新文件
    this.currentWalFile = path.join(WAL_DIR, this.generateWALFilename());
    this.walFd = fs.openSync(this.currentWalFile, 'a');
  }

  /**
   * ### 计算WAL记录校验和
   */
  private calculateEntryChecksum(entry: Omit<WALEntry, 'checksum'>): string {
    const data = `${entry.sequence}|${entry.timestamp}|${entry.operation}|${JSON.stringify(entry.data)}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * ### 追加操作到WAL
   */
  async append(operation: WALOperationType, data: any): Promise<number> {
    const sequence = ++this.currentSequence;
    
    const entry: WALEntry = {
      sequence,
      timestamp: Date.now(),
      operation,
      data,
      checksum: '', // 先占位
    };
    
    entry.checksum = this.calculateEntryChecksum(entry);
    
    // 写入缓冲区
    this.buffer.push(entry);
    
    // 写入文件
    const line = JSON.stringify(entry) + '\n';
    
    return new Promise((resolve, reject) => {
      if (this.walFd === null) {
        reject(new Error('WAL文件未打开'));
        return;
      }
      
      fs.write(this.walFd!, line, (err) => {
        if (err) {
          reject(err);
        } else {
          this.operationCount++;
          resolve(sequence);
        }
      });
    });
  }

  /**
   * ### 同步WAL到磁盘
   */
  async sync(): Promise<void> {
    if (this.syncPromise) {
      return this.syncPromise;
    }
    
    this.syncPromise = new Promise((resolve, reject) => {
      if (this.walFd === null) {
        resolve();
        return;
      }
      
      fs.fsync(this.walFd!, (err) => {
        this.syncPromise = null;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    return this.syncPromise;
  }

  /**
   * ### 创建检查点
   */
  async checkpoint(state: UnifiedState): Promise<void> {
    // 强制同步当前WAL
    await this.sync();
    
    // 写入checkpoint记录
    const sequence = await this.append('checkpoint', {
      stateSnapshot: state,
      checkpointTime: Date.now(),
    });
    
    await this.sync();
    
    this.lastCheckpointSequence = sequence;
    this.operationCount = 0;
    
    // 压缩旧WAL文件
    await this.compact();
    
    console.log(`✅ WAL检查点已创建: 序号 ${sequence}`);
  }

  /**
   * ### 从WAL恢复状态
   */
  async recover(currentState: UnifiedState): Promise<UnifiedState> {
    const walFiles = this.getWALFiles();
    
    if (walFiles.length === 0) {
      console.log('没有WAL文件需要恢复');
      return currentState;
    }
    
    let state = currentState;
    let recoveredCount = 0;
    let lastValidSequence = 0;
    
    // 从最新的checkpoint开始恢复
    const checkpointState = this.findLatestCheckpoint(walFiles);
    if (checkpointState) {
      state = checkpointState.state;
      lastValidSequence = checkpointState.sequence;
      console.log(`从检查点恢复: 序号 ${lastValidSequence}`);
    }
    
    // 重放WAL记录
    for (const file of walFiles) {
      const entries = this.readWALFile(file.path);
      
      for (const entry of entries) {
        // 验证校验和
        const expectedChecksum = this.calculateEntryChecksum(entry);
        if (entry.checksum !== expectedChecksum) {
          console.warn(`WAL记录校验失败: 序号 ${entry.sequence}`);
          continue;
        }
        
        // 跳过已恢复的记录
        if (entry.sequence <= lastValidSequence) {
          continue;
        }
        
        // 重放操作
        state = this.applyOperation(state, entry);
        lastValidSequence = entry.sequence;
        recoveredCount++;
      }
    }
    
    console.log(`✅ WAL恢复完成: 恢复了 ${recoveredCount} 条记录`);
    
    return state;
  }

  /**
   * ### 应用WAL操作到状态
   */
  private applyOperation(state: UnifiedState, entry: WALEntry): UnifiedState {
    const newState = { ...state };
    
    switch (entry.operation) {
      case 'updateTrading':
        newState.trading = { ...newState.trading, ...entry.data };
        break;
      case 'updatePosition':
        if (entry.data.position) {
          newState.trading.lastPosition = newState.trading.position;
        }
        newState.trading.position = entry.data.position;
        newState.trading.lastCheck = Date.now();
        break;
      case 'recordTrade':
        newState.trading.tradeCount++;
        newState.trading.totalPnL += entry.data.pnl || 0;
        break;
      case 'updateLLM':
        newState.llm = { ...newState.llm, ...entry.data };
        break;
      case 'updateNotification':
        newState.notification = { ...newState.notification, ...entry.data };
        break;
      case 'updateStrategy':
        newState.strategy = { ...newState.strategy, ...entry.data };
        break;
      case 'updateDaemon':
        newState.daemon = { ...newState.daemon, ...entry.data };
        break;
      case 'updateCache':
        newState.cache = { ...newState.cache, ...entry.data };
        break;
      case 'heartbeat':
        newState.daemon.lastHeartbeat = Date.now();
        newState.daemon.status = 'running';
        break;
      case 'checkpoint':
        // checkpoint已在recover中单独处理
        break;
    }
    
    newState.updatedAt = new Date().toISOString();
    return newState;
  }

  /**
   * ### 压缩WAL文件
   */
  async compact(): Promise<void> {
    const walFiles = this.getWALFiles();
    
    // 保留最近3个WAL文件
    const filesToDelete = walFiles.slice(3);
    
    for (const file of filesToDelete) {
      try {
        // 检查是否包含未checkpoint的记录
        const entries = this.readWALFile(file.path);
        const hasUncheckpointed = entries.some(e => 
          e.sequence > this.lastCheckpointSequence && e.operation !== 'checkpoint'
        );
        
        if (!hasUncheckpointed) {
          fs.unlinkSync(file.path);
          console.log(`🗑️ 已清理WAL文件: ${file.filename}`);
        }
      } catch (e) {
        console.error(`清理WAL文件失败 ${file.filename}:`, e);
      }
    }
  }

  /**
   * ### 获取WAL文件列表
   */
  private getWALFiles(): WALFileInfo[] {
    if (!fs.existsSync(WAL_DIR)) {
      return [];
    }
    
    const files = fs.readdirSync(WAL_DIR)
      .filter(f => f.startsWith('wal-') && f.endsWith('.log'))
      .sort()
      .reverse();
    
    return files.map(filename => {
      const filePath = path.join(WAL_DIR, filename);
      const stat = fs.statSync(filePath);
      const entries = this.readWALFile(filePath);
      
      return {
        filename,
        path: filePath,
        size: stat.size,
        entryCount: entries.length,
        firstSequence: entries[0]?.sequence || 0,
        lastSequence: entries[entries.length - 1]?.sequence || 0,
        createdAt: stat.birthtime,
      };
    });
  }

  /**
   * ### 读取WAL文件
   */
  private readWALFile(filePath: string): WALEntry[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      return lines.map(line => {
        try {
          return JSON.parse(line) as WALEntry;
        } catch {
          return null as unknown as WALEntry;
        }
      }).filter((e): e is WALEntry => e !== null);
    } catch {
      return [];
    }
  }

  /**
   * ### 获取最后序号
   */
  private getLastSequence(): number {
    const files = this.getWALFiles();
    if (files.length === 0) return 0;
    
    const latestFile = files[0];
    if (!latestFile) return 0;
    const entries = this.readWALFile(latestFile.path);
    const lastEntry = entries[entries.length - 1];
    return lastEntry?.sequence ?? 0;
  }

  /**
   * ### 获取最后checkpoint序号
   */
  private getLastCheckpointSequence(): number {
    const files = this.getWALFiles();
    
    for (const file of files) {
      const entries = this.readWALFile(file.path);
      const checkpoints = entries.filter(e => e.operation === 'checkpoint');
      if (checkpoints.length > 0) {
        const lastCheckpoint = checkpoints[checkpoints.length - 1];
        return lastCheckpoint?.sequence ?? 0;
      }
    }
    
    return 0;
  }

  /**
   * ### 查找最新checkpoint
   */
  private findLatestCheckpoint(walFiles: WALFileInfo[]): { state: UnifiedState; sequence: number } | null {
    for (const file of walFiles) {
      const entries = this.readWALFile(file.path);
      
      // 从后往前找checkpoint
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (!entry) continue;
        if (entry.operation === 'checkpoint' && entry.data?.stateSnapshot) {
          return {
            state: entry.data.stateSnapshot as UnifiedState,
            sequence: entry.sequence,
          };
        }
      }
    }
    
    return null;
  }

  /**
   * ### 启动checkpoint定时器
   */
  private startCheckpointTimer(): void {
    this.checkpointTimer = setInterval(() => {
      // 由StateManager调用checkpoint
    }, CHECKPOINT_TIME_INTERVAL);
  }

  /**
   * ### 停止checkpoint定时器
   */
  stopCheckpointTimer(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
  }

  /**
   * ### 获取WAL统计信息
   */
  getStats(): WALStats {
    const files = this.getWALFiles();
    const totalEntries = files.reduce((sum, f) => sum + f.entryCount, 0);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    
    return {
      totalEntries,
      totalSize,
      fileCount: files.length,
      lastSequence: this.currentSequence,
      lastCheckpointSequence: this.lastCheckpointSequence,
      pendingOperations: this.operationCount,
      walFiles: files,
    };
  }

  /**
   * ### 是否需要checkpoint
   */
  needsCheckpoint(): boolean {
    return this.operationCount >= CHECKPOINT_INTERVAL;
  }

  /**
   * ### 关闭WAL
   */
  async close(): Promise<void> {
    await this.sync();
    
    if (this.walFd !== null) {
      fs.closeSync(this.walFd);
      this.walFd = null;
    }
    
    this.stopCheckpointTimer();
  }
}


export class StateManager {
  private state: UnifiedState;
  private autoSave: boolean = true;
  private saveTimeout: NodeJS.Timeout | null = null;
  private snapshotInterval: NodeJS.Timeout | null = null;
  private walManager: WALManager; // ### WAL管理器

  
  constructor() {
    // 初始化WAL管理器
    this.walManager = new WALManager();
    
    // 先尝试从损坏状态恢复
    this.recoverFromCorruptionIfNeeded();
    
    // 加载状态
    this.state = this.load();
    
    // ### 从WAL恢复未完成的事务
    this.recoverFromWAL();
    
    // 启动时创建快照
    this.createSnapshot('startup');
    // 启动定时快照（每小时）
    this.startAutoSnapshot();
  }

  
  /**
   * 加载状态
   */
  private load(): UnifiedState {
    try {
      // 确保 state 目录存在
      if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
      }
      
      if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, 'utf-8');
        const loaded = JSON.parse(data);
        
        // 合并默认值（处理新增字段）
        return {
          ...DEFAULT_STATE,
          ...loaded,
          trading: { ...DEFAULT_STATE.trading, ...loaded.trading },
          llm: { ...DEFAULT_STATE.llm, ...loaded.llm },
          notification: { ...DEFAULT_STATE.notification, ...loaded.notification },
          strategy: { ...DEFAULT_STATE.strategy, ...loaded.strategy },
          daemon: { ...DEFAULT_STATE.daemon, ...loaded.daemon },
          cache: { ...DEFAULT_STATE.cache, ...loaded.cache },
        };
      }
    } catch (error) {
      console.error('加载状态失败:', error);
    }
    
    return { ...DEFAULT_STATE };
  }
  
  /**
   * 保存状态（防抖）
   */
  private save(): void {
    if (!this.autoSave) return;
    
    // 防抖：500ms 后保存
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveNow();
    }, 500);
  }
  
  /**
   * 立即保存
   */
  saveNow(): void {
    try {
      this.state.updatedAt = new Date().toISOString();
      
      if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
      }
      
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('保存状态失败:', error);
    }
  }
  
  /**
   * 立即保存（关键状态，使用 fsync）
   */
  saveCritical(): void {
    try {
      this.state.updatedAt = new Date().toISOString();
      
      if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
      }
      
      const data = JSON.stringify(this.state, null, 2);
      const fd = fs.openSync(STATE_FILE, 'w');
      fs.writeFileSync(fd, data);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } catch (error) {
      console.error('保存关键状态失败:', error);
    }
  }
  
  /**
   * 获取完整状态
   */
  getState(): Readonly<UnifiedState> {
    return this.state;
  }
  
  // ============================================
  // 交易状态操作
  // ============================================
  
  /**
   * ### 更新交易状态（带WAL预写）
   */
  async updateTrading(updates: Partial<UnifiedState['trading']>): Promise<void> {
    // 先写入WAL
    await this.writeAhead('updateTrading', updates);
    // 然后更新内存状态
    this.state.trading = { ...this.state.trading, ...updates };
    this.save();
    this.checkCheckpointNeeded();
  }
  
  getTrading(): UnifiedState['trading'] {
    return this.state.trading;
  }
  
  /**
   * ### 更新仓位（带WAL预写）
   */
  async updatePosition(position: Position | null): Promise<void> {
    await this.writeAhead('updatePosition', { position });
    if (position) {
      this.state.trading.lastPosition = this.state.trading.position;
    }
    this.state.trading.position = position;
    this.state.trading.lastCheck = Date.now();
    this.save();
    this.checkCheckpointNeeded();
  }
  
  /**
   * ### 记录交易（带WAL预写）
   */
  async recordTrade(pnl: number): Promise<void> {
    await this.writeAhead('recordTrade', { pnl });
    this.state.trading.tradeCount++;
    this.state.trading.totalPnL += pnl;
    this.save();
    this.checkCheckpointNeeded();
  }
  
  // ============================================
  // LLM 状态操作
  // ============================================
  
  /**
   * ### 更新LLM状态（带WAL预写）
   */
  async updateLLM(decision: any, price: number): Promise<void> {
    const data = {
      lastDecision: decision,
      lastDecisionTime: Date.now(),
      lastDecisionPrice: price,
      thinking: decision.thinking || null,
    };
    await this.writeAhead('updateLLM', data);
    this.state.llm.lastDecision = decision;
    this.state.llm.lastDecisionTime = data.lastDecisionTime;
    this.state.llm.lastDecisionPrice = price;
    if (decision.thinking) {
      this.state.llm.thinking = decision.thinking;
    }
    this.save();
  }
  
  getLLM(): UnifiedState['llm'] {
    return this.state.llm;
  }
  
  // ============================================
  // 通知状态操作
  // ============================================
  
  /**
   * ### 更新通知状态（带WAL预写）
   */
  async updateNotification(updates: Partial<UnifiedState['notification']>): Promise<void> {
    await this.writeAhead('updateNotification', updates);
    this.state.notification = { ...this.state.notification, ...updates };
    this.save();
  }
  
  addPendingNotification(notification: string): void {
    this.state.notification.pendingNotifications.push(notification);
    this.save();
  }
  
  clearPendingNotifications(): string[] {
    const pending = this.state.notification.pendingNotifications;
    this.state.notification.pendingNotifications = [];
    this.save();
    return pending;
  }
  
  // ============================================
  // 策略状态操作
  // ============================================
  
  /**
   * ### 更新策略状态（带WAL预写）
   */
  async updateStrategy(signal: any, output?: any): Promise<void> {
    const data: any = {
      lastSignal: signal,
      lastSignalTime: Date.now(),
    };
    if (output) {
      data.strategyOutput = output;
    }
    await this.writeAhead('updateStrategy', data);
    this.state.strategy.lastSignal = signal;
    this.state.strategy.lastSignalTime = data.lastSignalTime;
    if (output) {
      this.state.strategy.strategyOutput = output;
    }
    this.save();
  }
  
  getStrategy(): UnifiedState['strategy'] {
    return this.state.strategy;
  }
  
  // ============================================
  // 守护进程状态操作
  // ============================================
  
  /**
   * ### 更新守护进程状态（带WAL预写）
   */
  async updateDaemon(updates: Partial<UnifiedState['daemon']>): Promise<void> {
    await this.writeAhead('updateDaemon', updates);
    this.state.daemon = { ...this.state.daemon, ...updates };
    this.save();
  }
  
  /**
   * ### 心跳（带WAL预写）
   */
  async heartbeat(): Promise<void> {
    await this.writeAhead('heartbeat', {});
    this.state.daemon.lastHeartbeat = Date.now();
    this.state.daemon.status = 'running';
    this.save();
  }
  
  recordError(error: string): void {
    this.state.daemon.errorCount++;
    this.state.daemon.lastError = error;
    this.save();
  }
  
  // ============================================
  // 缓存操作
  // ============================================
  
  /**
   * ### 更新缓存（带WAL预写）
   */
  async updateCache(updates: Partial<UnifiedState['cache']>): Promise<void> {
    await this.writeAhead('updateCache', updates);
    this.state.cache = { ...this.state.cache, ...updates };
    this.save();
  }
  
  getCache(): UnifiedState['cache'] {
    return this.state.cache;
  }
  
  // ============================================
  // WAL (Write-Ahead Log) 操作
  // ============================================
  
  /**
   * ### 预写日志
   * 在状态变更前先写入WAL，确保崩溃恢复
   */
  private async writeAhead(operation: WALOperationType, data: any): Promise<void> {
    try {
      await this.walManager.append(operation, data);
    } catch (error) {
      console.error('WAL写入失败:', error);
      throw error; // WAL失败则中止操作
    }
  }
  
  /**
   * ### 创建WAL检查点
   */
  async createCheckpoint(): Promise<void> {
    await this.walManager.checkpoint(this.state);
  }
  
  /**
   * ### 从WAL恢复状态
   */
  private async recoverFromWAL(): Promise<void> {
    try {
      const recoveredState = await this.walManager.recover(this.state);
      if (recoveredState !== this.state) {
        this.state = recoveredState;
        this.saveNow();
        console.log('✅ 从WAL恢复了状态');
      }
    } catch (error) {
      console.error('WAL恢复失败:', error);
    }
  }
  
  /**
   * ### 获取WAL统计信息
   */
  getWALStats(): WALStats {
    return this.walManager.getStats();
  }
  
  /**
   * ### 检查是否需要checkpoint
   */
  private checkCheckpointNeeded(): void {
    if (this.walManager.needsCheckpoint()) {
      // 异步执行checkpoint
      this.createCheckpoint().catch(e => console.error('Checkpoint失败:', e));
    }
  }
  
  /**
   * ### 关闭状态管理器（安全关闭WAL）
   */
  async close(): Promise<void> {
    // 最后一次checkpoint
    await this.createCheckpoint();
    // 关闭WAL
    await this.walManager.close();
    // 停止定时任务
    this.stopAutoSnapshot();
    // 保存最终状态
    this.saveCritical();
  }
  
  // ============================================
  // 快照管理
  // ============================================
  
  /**
   * 计算状态数据的校验和
   */
  private calculateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }
  
  /**
   * 创建状态快照
   */
  createSnapshot(reason: string = 'manual'): SnapshotInfo | null {
    try {
      if (!fs.existsSync(SNAPSHOT_DIR)) {
        fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
      }
      
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `snapshot-${timestamp}.json`;
      const filePath = path.join(SNAPSHOT_DIR, filename);
      
      const stateData = JSON.stringify(this.state, null, 2);
      const checksum = this.calculateChecksum(stateData);
      
      const snapshot: StateSnapshot = {
        version: '1.0.0',
        timestamp: now.toISOString(),
        checksum,
        state: this.state,
      };
      
      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
      
      // 清理旧快照
      this.cleanupOldSnapshots(MAX_SNAPSHOTS);
      
      console.log(`✅ 快照已创建: ${filename} (原因: ${reason})`);
      
      return {
        filename,
        timestamp: snapshot.timestamp,
        checksum,
        size: fs.statSync(filePath).size,
      };
    } catch (error) {
      console.error('创建快照失败:', error);
      return null;
    }
  }
  
  /**
   * 列出所有快照
   */
  listSnapshots(): SnapshotInfo[] {
    try {
      if (!fs.existsSync(SNAPSHOT_DIR)) {
        return [];
      }
      
      const files = fs.readdirSync(SNAPSHOT_DIR)
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      const snapshots: SnapshotInfo[] = [];
      
      for (const file of files) {
        const filePath = path.join(SNAPSHOT_DIR, file);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          snapshots.push({
            filename: file,
            timestamp: data.timestamp || 'unknown',
            checksum: data.checksum || 'unknown',
            size: fs.statSync(filePath).size,
          });
        } catch {
          // 跳过损坏的快照文件
        }
      }
      
      return snapshots;
    } catch (error) {
      console.error('列出快照失败:', error);
      return [];
    }
  }
  
  /**
   * 恢复快照
   */
  restoreSnapshot(timestamp?: string): boolean {
    try {
      const snapshots = this.listSnapshots();
      
      if (snapshots.length === 0) {
        console.warn('没有可用的快照');
        return false;
      }
      
      let targetSnapshot: SnapshotInfo | undefined;
      
      if (timestamp) {
        targetSnapshot = snapshots.find(s => s.timestamp.startsWith(timestamp));
      } else {
        targetSnapshot = snapshots[0];
      }
      
      if (!targetSnapshot) {
        console.warn(`未找到时间戳为 ${timestamp} 的快照`);
        return false;
      }
      
      const filePath = path.join(SNAPSHOT_DIR, targetSnapshot.filename);
      const data = fs.readFileSync(filePath, 'utf-8');
      const snapshot: StateSnapshot = JSON.parse(data);
      
      // 验证校验和
      const stateData = JSON.stringify(snapshot.state, null, 2);
      const calculatedChecksum = this.calculateChecksum(stateData);
      
      if (calculatedChecksum !== snapshot.checksum) {
        console.error(`快照校验和不匹配: ${targetSnapshot.filename}`);
        return false;
      }
      
      // 恢复状态
      this.state = snapshot.state;
      this.saveNow();
      
      console.log(`✅ 已从快照恢复: ${targetSnapshot.filename}`);
      return true;
    } catch (error) {
      console.error('恢复快照失败:', error);
      return false;
    }
  }
  
  /**
   * 清理旧快照
   */
  cleanupOldSnapshots(maxCount: number): number {
    try {
      if (!fs.existsSync(SNAPSHOT_DIR)) {
        return 0;
      }
      
      const files = fs.readdirSync(SNAPSHOT_DIR)
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      let deleted = 0;
      
      // 删除超过最大数量的旧快照
      for (let i = maxCount; i < files.length; i++) {
        const file = files[i];
        if (file) {
          const filePath = path.join(SNAPSHOT_DIR, file);
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
      
      if (deleted > 0) {
        console.log(`🗑️ 已清理 ${deleted} 个旧快照`);
      }
      
      return deleted;
    } catch (error) {
      console.error('清理快照失败:', error);
      return 0;
    }
  }
  
  /**
   * 验证状态文件完整性
   */
  private verifyStateFile(): boolean {
    try {
      if (!fs.existsSync(STATE_FILE)) {
        return false;
      }
      
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      
      // 基本结构验证
      return parsed && typeof parsed === 'object' && parsed.version;
    } catch {
      return false;
    }
  }
  
  /**
   * 检测并从损坏状态恢复
   */
  private recoverFromCorruptionIfNeeded(): void {
    if (fs.existsSync(STATE_FILE) && !this.verifyStateFile()) {
      console.warn('⚠️ 状态文件可能已损坏，尝试从快照恢复...');
      
      const snapshots = this.listSnapshots();
      if (snapshots.length > 0) {
        // 临时设置默认状态，然后恢复
        this.state = { ...DEFAULT_STATE };
        if (this.restoreSnapshot()) {
          console.log('✅ 已从最新快照恢复');
        }
      } else {
        console.warn('没有可用的快照，将使用默认状态');
      }
    }
  }
  
  /**
   * 启动自动快照定时器
   */
  private startAutoSnapshot(): void {
    // 每小时创建一次快照
    this.snapshotInterval = setInterval(() => {
      this.createSnapshot('auto-hourly');
    }, 60 * 60 * 1000);
  }
  
  /**
   * 停止自动快照
   */
  stopAutoSnapshot(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }
  
  /**
   * 关键状态变更时创建快照（如开仓/平仓）
   */
  saveWithSnapshot(position: Position | null): void {
    this.updatePosition(position);
    this.saveCritical();
    const reason = position ? 'position-opened' : 'position-closed';
    this.createSnapshot(reason);
  }
  // ============================================
  // 迁移工具
  // ============================================
  
  /**
   * 从旧状态文件迁移
   */
  static migrateFromLegacy(): void {
    const manager = new StateManager();
    const cwd = process.cwd();
    
    // 迁移 trading-state.json
    const tradingStatePath = path.join(cwd, 'trading-state.json');
    if (fs.existsSync(tradingStatePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(tradingStatePath, 'utf-8'));
        manager.updateTrading({
          balance: data.balance || 0,
          position: data.position || null,
          lastPosition: data.lastPosition || null,
          tradeCount: data.tradeCount || 0,
          totalPnL: data.totalPnL || 0,
          startTime: data.startTime || Date.now(),
          lastCheck: data.lastCheck || 0,
        });
        console.log('✅ 已迁移 trading-state.json');
      } catch (e) {
        console.error('迁移 trading-state.json 失败:', e);
      }
    }
    
    // 迁移 last-notification.json
    const notifyPath = path.join(cwd, 'last-notification.json');
    if (fs.existsSync(notifyPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(notifyPath, 'utf-8'));
        manager.updateNotification({
          lastReportHash: data.lastReportHash || '',
          lastReportTime: data.lastReportTime || 0,
        });
        console.log('✅ 已迁移 last-notification.json');
      } catch (e) {
        console.error('迁移 last-notification.json 失败:', e);
      }
    }
    
    // 迁移 llm-report.json
    const llmPath = path.join(cwd, 'llm-report.json');
    if (fs.existsSync(llmPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(llmPath, 'utf-8'));
        if (data.lastDecision) {
          manager.updateLLM(data.lastDecision, data.lastDecision?.decisionPrice || 0);
        }
        console.log('✅ 已迁移 llm-report.json');
      } catch (e) {
        console.error('迁移 llm-report.json 失败:', e);
      }
    }
    
    manager.saveNow();
    console.log('✅ 状态迁移完成');
  }
}

// 单例导出
export const stateManager = new StateManager();
export default stateManager;
