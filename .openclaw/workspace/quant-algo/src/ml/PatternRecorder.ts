/**
 * PatternRecorder - 模式记录器
 * 
 * 解决前视偏差(Look-ahead Bias)问题的关键组件
 * 
 * 核心原理：
 * 1. 开仓时：只记录特征，不记录收益（因为收益未知）
 * 2. 平仓时：计算真实已实现收益，添加到训练集
 * 3. 所有训练数据都是"已实现"的，不使用任何未来数据
 * 
 * 前视偏差的危害：
 * - 回测结果虚高（使用了"未来"信息）
 * - 实盘表现差（实盘中无法获取未来信息）
 * - 是量化交易中最严重的错误之一
 */

import logger from '../logger';
import { KNN3DClassifier } from '../knn3d';

/**
 * 待结算的持仓模式
 */
export interface PendingPattern {
  /** 唯一标识 */
  id: string;
  /** 开仓时的三维特征 */
  features: [number, number, number];
  /** 入场价格 */
  entryPrice: number;
  /** 方向 */
  side: 'long' | 'short';
  /** 开仓时间戳 */
  openTimestamp: number;
  /** 仓位大小 */
  size: number;
  /** 可选：价格序列（用于 DTW） */
  priceSequence?: number[];
  /** 可选：额外元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 已结算的模式（用于训练）
 */
export interface SettledPattern {
  features: [number, number, number];
  realizedReturn: number;  // 已实现收益（非未来收益）
  timestamp: number;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  holdDuration: number;  // 持仓时长（毫秒）
}

/**
 * PatternRecorder 配置
 */
export interface PatternRecorderConfig {
  /** 最大待结算模式数量 */
  maxPendingPatterns: number;
  /** 是否记录价格序列 */
  recordPriceSequence: boolean;
  /** 价格序列长度 */
  priceSequenceLength: number;
}

const DEFAULT_CONFIG: PatternRecorderConfig = {
  maxPendingPatterns: 100,
  recordPriceSequence: false,
  priceSequenceLength: 20,
};

/**
 * PatternRecorder - 延迟更新模式记录器
 * 
 * 使用方法：
 * 1. 开仓时调用 `recordOpenPosition()`
 * 2. 平仓时调用 `settlePosition()`
 * 3. 已实现的模式会自动添加到 KNN 训练集
 */
export class PatternRecorder {
  /** 待结算的模式（开仓但未平仓） */
  private pendingPatterns: Map<string, PendingPattern> = new Map();
  
  /** 已结算的模式（用于审计和分析） */
  private settledPatterns: SettledPattern[] = [];
  
  /** KNN 分类器引用 */
  private knnClassifier: KNN3DClassifier | null = null;
  
  /** 配置 */
  private config: PatternRecorderConfig;
  
  /** 统计信息 */
  private stats = {
    totalRecorded: 0,
    totalSettled: 0,
    totalProfitable: 0,
  };

  constructor(
    knnClassifier?: KNN3DClassifier,
    config: Partial<PatternRecorderConfig> = {}
  ) {
    this.knnClassifier = knnClassifier || null;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 设置 KNN 分类器
   */
  setKNNClassifier(classifier: KNN3DClassifier): void {
    this.knnClassifier = classifier;
  }

  /**
   * 记录开仓模式
   * 
   * 在交易开仓时调用，只记录特征，不记录收益
   * 收益在平仓后才能确定
   */
  recordOpenPosition(
    features: [number, number, number],
    entryPrice: number,
    side: 'long' | 'short',
    size: number,
    priceSequence?: number[],
    metadata?: Record<string, unknown>
  ): string {
    // 生成唯一 ID
    const id = `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 限制价格序列长度
    const limitedPriceSequence = priceSequence 
      ? priceSequence.slice(-this.config.priceSequenceLength)
      : undefined;
    
    const pattern: PendingPattern = {
      id,
      features: [...features] as [number, number, number],
      entryPrice,
      side,
      openTimestamp: Date.now(),
      size,
      priceSequence: limitedPriceSequence,
      metadata,
    };
    
    this.pendingPatterns.set(id, pattern);
    this.stats.totalRecorded++;
    
    // 限制待结算模式数量
    if (this.pendingPatterns.size > this.config.maxPendingPatterns) {
      // 移除最旧的模式（这不应该发生，但作为安全措施）
      const oldestKey = this.pendingPatterns.keys().next().value;
      if (oldestKey) {
        this.pendingPatterns.delete(oldestKey);
        logger.warn(`PatternRecorder: 待结算模式过多，移除最旧的模式 ${oldestKey}`);
      }
    }
    
    logger.debug(`PatternRecorder: 记录开仓模式 ${id} | ${side} @ ${entryPrice}`);
    
    return id;
  }

  /**
   * 结算持仓模式
   * 
   * 在交易平仓时调用，计算真实已实现收益
   * 并将模式添加到 KNN 训练集
   */
  settlePosition(
    patternId: string,
    exitPrice: number
  ): SettledPattern | null {
    const pattern = this.pendingPatterns.get(patternId);
    
    if (!pattern) {
      logger.warn(`PatternRecorder: 未找到待结算模式 ${patternId}`);
      return null;
    }
    
    // 计算已实现收益
    const realizedReturn = pattern.side === 'long'
      ? (exitPrice - pattern.entryPrice) / pattern.entryPrice
      : (pattern.entryPrice - exitPrice) / pattern.entryPrice;
    
    const holdDuration = Date.now() - pattern.openTimestamp;
    
    // 创建已结算模式
    const settledPattern: SettledPattern = {
      features: pattern.features,
      realizedReturn,
      timestamp: pattern.openTimestamp,  // 使用开仓时间戳
      side: pattern.side,
      entryPrice: pattern.entryPrice,
      exitPrice,
      holdDuration,
    };
    
    // 从待结算列表中移除
    this.pendingPatterns.delete(patternId);
    
    // 添加到已结算列表（用于审计）
    this.settledPatterns.push(settledPattern);
    if (this.settledPatterns.length > 1000) {
      this.settledPatterns.shift();
    }
    
    // 更新统计
    this.stats.totalSettled++;
    if (realizedReturn > 0) {
      this.stats.totalProfitable++;
    }
    
    // 添加到 KNN 训练集
    if (this.knnClassifier) {
      this.knnClassifier.addPattern(
        pattern.features,
        realizedReturn,
        pattern.openTimestamp,
        pattern.priceSequence
      );
      logger.info(
        `PatternRecorder: 结算模式 ${patternId} | 收益=${(realizedReturn * 100).toFixed(2)}% | ` +
        `已添加到 KNN 训练集`
      );
    } else {
      logger.warn('PatternRecorder: 未设置 KNN 分类器，模式未添加到训练集');
    }
    
    return settledPattern;
  }

  /**
   * 根据 entryPrice 结算（当没有 patternId 时）
   * 
   * 用于兼容旧的接口
   */
  settleByEntryPrice(
    entryPrice: number,
    exitPrice: number,
    side: 'long' | 'short',
    features?: [number, number, number]
  ): SettledPattern | null {
    // Find matching pending pattern
    let foundId: string | null = null;
    this.pendingPatterns.forEach((pattern, id) => {
      if (
        Math.abs(pattern.entryPrice - entryPrice) < 0.01 &&
        pattern.side === side
      ) {
        foundId = id;
      }
    });
    
    if (foundId) {
      return this.settlePosition(foundId, exitPrice);
    }
    
    // 如果没找到且提供了 features，创建新的已结算模式
    if (features) {
      const realizedReturn = side === 'long'
        ? (exitPrice - entryPrice) / entryPrice
        : (entryPrice - exitPrice) / entryPrice;
      
      const settledPattern: SettledPattern = {
        features,
        realizedReturn,
        timestamp: Date.now(),
        side,
        entryPrice,
        exitPrice,
        holdDuration: 0,
      };
      
      // 直接添加到 KNN
      if (this.knnClassifier) {
        this.knnClassifier.addPattern(features, realizedReturn, Date.now());
        logger.info(
          `PatternRecorder: 直接结算模式 | ${side} | 收益=${(realizedReturn * 100).toFixed(2)}%`
        );
      }
      
      return settledPattern;
    }
    
    logger.warn(
      `PatternRecorder: 未找到匹配的待结算模式 | entryPrice=${entryPrice}, side=${side}`
    );
    return null;
  }

  /**
   * 获取待结算模式数量
   */
  getPendingCount(): number {
    return this.pendingPatterns.size;
  }

  /**
   * 获取已结算模式数量
   */
  getSettledCount(): number {
    return this.settledPatterns.length;
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    pendingCount: number;
    settledCount: number;
    totalRecorded: number;
    totalSettled: number;
    totalProfitable: number;
    winRate: number;
  } {
    return {
      pendingCount: this.pendingPatterns.size,
      settledCount: this.settledPatterns.length,
      totalRecorded: this.stats.totalRecorded,
      totalSettled: this.stats.totalSettled,
      totalProfitable: this.stats.totalProfitable,
      winRate: this.stats.totalSettled > 0
        ? this.stats.totalProfitable / this.stats.totalSettled
        : 0,
    };
  }

  /**
   * 获取最近的已结算模式（用于分析）
   */
  getRecentSettledPatterns(count: number = 50): SettledPattern[] {
    return this.settledPatterns.slice(-count);
  }

  /**
   * 清除所有待结算模式（危险操作，仅用于重置）
   */
  clearPending(): void {
    const count = this.pendingPatterns.size;
    this.pendingPatterns.clear();
    logger.warn(`PatternRecorder: 已清除 ${count} 个待结算模式`);
  }

  /**
   * 清除所有数据（危险操作，仅用于重置）
   */
  clear(): void {
    this.pendingPatterns.clear();
    this.settledPatterns = [];
    this.stats = {
      totalRecorded: 0,
      totalSettled: 0,
      totalProfitable: 0,
    };
    logger.warn('PatternRecorder: 已清除所有数据');
  }
}

export default PatternRecorder;
