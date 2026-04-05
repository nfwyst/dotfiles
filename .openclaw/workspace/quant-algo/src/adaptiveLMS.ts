import logger from './logger';

/**
 * Adaptive LMS (Least Mean Squares) Filter
 * 
 * 自适应最小均方滤波器 - OCS Layer 2 核心组件
 * 
 * 功能：
 * 1. 多信号融合（价格、成交量、周期）
 * 2. 动态权重调整（根据实时误差）
 * 3. 降噪处理
 * 
 * 原理：
 * - 梯度下降法动态调整权重
 * - 目标：最小化期望输出与实际输出的均方误差
 * - 在线学习：每接收到新数据就更新权重
 */
export class AdaptiveLMSFilter {
  private weights: number[] = [0.33, 0.33, 0.34]; // 价格、成交量、周期权重
  private learningRate: number = 0.01; // 学习率 μ
  private history: number[][] = []; // 历史误差用于自适应调整
  private readonly maxHistory = 100;

  /**
   * 初始化滤波器
   * @param initialWeights 初始权重 [price, volume, cycle]
   * @param learningRate 学习率
   */
  constructor(initialWeights?: number[], learningRate?: number) {
    if (initialWeights && initialWeights.length === 3) {
      this.weights = [...initialWeights];
      this.normalizeWeights();
    }
    if (learningRate) {
      this.learningRate = learningRate;
    }
  }

  /**
   * 滤波 - 融合多维度信号
   * @param priceSignal 价格维度信号 (-1 到 1)
   * @param volumeSignal 成交量维度信号 (-1 到 1)
   * @param cycleSignal 周期维度信号 (-1 到 1)
   * @param desiredOutput 期望输出（用于训练）
   * @returns 滤波后的综合信号
   */
  filter(
    priceSignal: number,
    volumeSignal: number,
    cycleSignal: number,
    desiredOutput?: number
  ): {
    output: number;
    weights: number[];
    error: number;
    confidence: number;
  } {
    const inputs = [priceSignal, volumeSignal, cycleSignal];
    
    // 计算当前输出：y(n) = w^T * x(n)
    const output = this.weights.reduce((sum, w, i) => sum + w * inputs[i], 0);
    
    // 如果有期望输出，计算误差并更新权重
    let error = 0;
    if (desiredOutput !== undefined) {
      // 误差：e(n) = d(n) - y(n)
      error = desiredOutput - output;
      
      // LMS 权重更新：w(n+1) = w(n) + μ * e(n) * x(n)
      for (let i = 0; i < this.weights.length; i++) {
        this.weights[i] += this.learningRate * error * inputs[i];
      }
      
      // 归一化权重（保持总和为1）
      this.normalizeWeights();
      
      // 记录误差历史
      this.history.push(Math.abs(error));
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
      
      // 自适应调整学习率
      this.adaptLearningRate();
    }
    
    // 计算置信度（基于近期误差）
    const confidence = this.calculateConfidence();
    
    return {
      output,
      weights: [...this.weights],
      error,
      confidence,
    };
  }

  /**
   * 批量训练
   * @param data 训练数据数组 [{inputs, desired}]
   * @param epochs 训练轮数
   */
  train(data: { inputs: number[]; desired: number }[], epochs: number = 1): void {
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;
      
      for (const sample of data) {
        const result = this.filter(
          sample.inputs[0],
          sample.inputs[1],
          sample.inputs[2],
          sample.desired
        );
        totalError += Math.abs(result.error);
      }
      
      const avgError = totalError / data.length;
      logger.debug(`LMS Epoch ${epoch + 1}: avg error = ${avgError.toFixed(4)}`);
    }
  }

  /**
   * 归一化权重
   */
  private normalizeWeights(): void {
    const sum = this.weights.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      this.weights = this.weights.map(w => w / sum);
    }
  }

  /**
   * 自适应调整学习率
   * 误差大时增加学习率，误差小时减小学习率
   */
  private adaptLearningRate(): void {
    if (this.history.length < 10) return;
    
    const recentAvg = this.history.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const olderAvg = this.history.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    
    if (recentAvg > olderAvg * 1.2) {
      // 误差增加，稍微增加学习率
      this.learningRate = Math.min(0.1, this.learningRate * 1.05);
    } else if (recentAvg < olderAvg * 0.8) {
      // 误差减小，降低学习率以稳定
      this.learningRate = Math.max(0.001, this.learningRate * 0.95);
    }
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(): number {
    if (this.history.length < 20) return 0.5;
    
    const recentErrors = this.history.slice(-20);
    const avgError = recentErrors.reduce((a, b) => a + b, 0) / recentErrors.length;
    
    // 将误差转换为置信度（误差越小，置信度越高）
    return Math.max(0, Math.min(1, 1 - avgError));
  }

  /**
   * 获取当前状态
   */
  getState(): {
    weights: number[];
    learningRate: number;
    historySize: number;
  } {
    return {
      weights: [...this.weights],
      learningRate: this.learningRate,
      historySize: this.history.length,
    };
  }

  /**
   * 重置滤波器
   */
  reset(): void {
    this.weights = [0.33, 0.33, 0.34];
    this.learningRate = 0.01;
    this.history = [];
  }
}

export default AdaptiveLMSFilter;
