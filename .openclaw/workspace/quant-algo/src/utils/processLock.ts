/**
 * 进程锁模块
 * 防止多个 quant-alto 实例同时运行
 */

import fs from 'fs';
import path from 'path';

// 简单日志
const log = {
  info: (msg: string) => console.log(`\x1b[32m${new Date().toLocaleTimeString()} [INFO] ${msg}\x1b[0m`),
  warn: (msg: string) => console.log(`\x1b[33m${new Date().toLocaleTimeString()} [WARN] ${msg}\x1b[0m`),
  error: (msg: string) => console.log(`\x1b[31m${new Date().toLocaleTimeString()} [ERROR] ${msg}\x1b[0m`),
};

const LOCK_DIR = path.join(process.env.HOME || '/tmp', '.openclaw', 'locks');
const LOCK_FILE = path.join(LOCK_DIR, 'quant-alto.pid');

export class ProcessLock {
  private locked: boolean = false;
  
  /**
   * 尝试获取锁
   * @returns true 如果成功获取锁，false 如果已有进程在运行
   */
  acquire(): boolean {
    try {
      // 确保锁目录存在
      if (!fs.existsSync(LOCK_DIR)) {
        fs.mkdirSync(LOCK_DIR, { recursive: true });
      }
      
      // 检查锁文件是否存在
      if (fs.existsSync(LOCK_FILE)) {
        const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').trim(), 10);
        
        // 检查进程是否还在运行
        if (this.isProcessRunning(existingPid)) {
          log.error(`🔒 进程锁冲突: PID ${existingPid} 已在运行`);
          log.error(`   如果确认没有其他实例，请删除: ${LOCK_FILE}`);
          return false;
        } else {
          // 进程已退出，清理旧锁
          log.warn(`🧹 清理废弃锁: PID ${existingPid} 已不存在`);
          fs.unlinkSync(LOCK_FILE);
        }
      }
      
      // 创建锁文件
      fs.writeFileSync(LOCK_FILE, process.pid.toString());
      this.locked = true;
      
      log.info(`🔒 进程锁已获取: PID ${process.pid}`);
      
      // 注册退出清理
      this.registerCleanup();
      
      return true;
      
    } catch (error: any) {
      log.error(`获取进程锁失败: ${error.message}`);
      return false;
    }
  }
  
  /**
   * 释放锁
   */
  release(): void {
    if (!this.locked) return;
    
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const storedPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').trim(), 10);
        
        // 只释放自己的锁
        if (storedPid === process.pid) {
          fs.unlinkSync(LOCK_FILE);
          log.info(`🔓 进程锁已释放: PID ${process.pid}`);
        }
      }
      
      this.locked = false;
      
    } catch (error: any) {
      log.error(`释放进程锁失败: ${error.message}`);
    }
  }
  
  /**
   * 检查进程是否在运行
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // 发送信号 0 检查进程是否存在
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 注册退出清理
   */
  private registerCleanup(): void {
    // 正常退出
    process.on('exit', () => {
      this.release();
    });
    
    // SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      log.info('\n🛑 收到 SIGINT，正在退出...');
      this.release();
      process.exit(0);
    });
    
    // SIGTERM
    process.on('SIGTERM', () => {
      log.info('\n🛑 收到 SIGTERM，正在退出...');
      this.release();
      process.exit(0);
    });
    
    // 未捕获异常
    process.on('uncaughtException', (error) => {
      log.error(`未捕获异常: ${error.message}`);
      this.release();
      process.exit(1);
    });
    
    // 未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason) => {
      log.error(`未处理的 Promise 拒绝: ${reason}`);
      this.release();
      process.exit(1);
    });
  }
  
  /**
   * 获取当前锁定的 PID
   */
  static getLockedPid(): number | null {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        return parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').trim(), 10);
      }
    } catch {}
    return null;
  }
}

// 单例
let lockInstance: ProcessLock | null = null;

export function getProcessLock(): ProcessLock {
  if (!lockInstance) {
    lockInstance = new ProcessLock();
  }
  return lockInstance;
}
