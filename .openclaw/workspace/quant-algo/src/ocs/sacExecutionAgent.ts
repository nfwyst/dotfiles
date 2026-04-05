/**
 * SAC (Soft Actor-Critic) 执行智能体
 * OCS 2.0 - P3.1
 * 
 * 深度强化学习用于最优订单执行
 * 基于: "Deep Reinforcement Learning for Optimum Order Execution" (2026)
 * 
 * 简化版实现，使用确定性策略而非完整神经网络
 */

export interface State {
  priceFeatures: number[];      // 价格相关特征
  position: number;             // 当前持仓 (-1 ~ 1)
  marketState: string;          // 市场状态
  layerOutputs: number[];       // Layer 1-3 的输出
}

export interface Action {
  positionSize: number;         // 目标仓位 (-1 ~ 1)
  stopLossRatio: number;        // 止损比例 (0.01 ~ 0.05)
  takeProfitRatio: number;      // 止盈比例 (0.02 ~ 0.10)
}

export interface Transition {
  state: State;
  action: Action;
  reward: number;
  nextState: State;
  done: boolean;
}

export class SACExecutionAgent {
  private actorWeights: number[][];      // 策略网络权重 (简化)
  private criticWeights: number[][];     // 价值网络权重 (简化)
  private replayBuffer: Transition[];
  private readonly bufferSize: number;
  private readonly gamma: number;        // 折扣因子
  private readonly alpha: number;        // 温度参数 (熵正则化)
  private readonly lr: number;           // 学习率
  
  constructor() {
    // 初始化权重 (简化：使用随机初始化)
    this.actorWeights = this.initializeWeights(10, 3);   // 输入10维，输出3维
    this.criticWeights = this.initializeWeights(13, 1);  // 输入13维（state+action），输出1维
    this.replayBuffer = [];
    this.bufferSize = 1000;
    this.gamma = 0.99;
    this.alpha = 0.2;  // 熵正则化系数
    this.lr = 0.001;
  }
  
  /**
   * 选择动作 (策略网络前向传播)
   */
  selectAction(state: State): Action {
    const features = this.stateToFeatures(state);
    const output = this.forward(features, this.actorWeights);
    
    // 输出映射到动作空间
    return {
      positionSize: Math.tanh(output[0]),           // -1 ~ 1
      stopLossRatio: 0.01 + Math.abs(output[1]) * 0.04,   // 0.01 ~ 0.05
      takeProfitRatio: 0.02 + Math.abs(output[2]) * 0.08  // 0.02 ~ 0.10
    };
  }
  
  /**
   * 存储经验
   */
  storeTransition(transition: Transition) {
    this.replayBuffer.push(transition);
    if (this.replayBuffer.length > this.bufferSize) {
      this.replayBuffer.shift();
    }
  }
  
  /**
   * 训练一步
   */
  train() {
    if (this.replayBuffer.length < 32) return;
    
    // 随机采样批次
    const batch = this.sampleBatch(32);
    
    // 更新Critic (简化版Q学习)
    for (const transition of batch) {
      this.updateCritic(transition);
    }
    
    // 更新Actor (策略梯度)
    for (const transition of batch) {
      this.updateActor(transition);
    }
  }
  
  /**
   * 计算奖励 (风险调整后收益)
   * reward = return - λ * CVaR
   */
  calculateReward(pnl: number, cvar: number): number {
    const lambda = 0.5;  // 风险厌恶系数
    return pnl - lambda * cvar;
  }
  
  // ========== 私有方法 ==========
  
  private initializeWeights(inputDim: number, outputDim: number): number[][] {
    const weights: number[][] = [];
    for (let i = 0; i < outputDim; i++) {
      const row: number[] = [];
      for (let j = 0; j < inputDim; j++) {
        row.push((Math.random() - 0.5) * 0.1);  // 小随机初始化
      }
      weights.push(row);
    }
    return weights;
  }
  
  private stateToFeatures(state: State): number[] {
    return [
      ...state.priceFeatures.slice(0, 5),
      state.position,
      state.layerOutputs[0] || 0,
      state.layerOutputs[1] || 0,
      state.layerOutputs[2] || 0,
      state.marketState === 'trending' ? 1 : 0,
      state.marketState === 'ranging' ? 1 : 0
    ];
  }
  
  private forward(input: number[], weights: number[][]): number[] {
    return weights.map(row => 
      row.reduce((sum, w, i) => sum + w * (input[i] || 0), 0)
    );
  }
  
  private sampleBatch(size: number): Transition[] {
    const batch: Transition[] = [];
    for (let i = 0; i < size; i++) {
      const idx = Math.floor(Math.random() * this.replayBuffer.length);
      batch.push(this.replayBuffer[idx]);
    }
    return batch;
  }
  
  private updateCritic(transition: Transition) {
    // 简化：直接更新权重
    const features = [
      ...this.stateToFeatures(transition.state),
      transition.action.positionSize
    ];
    
    const targetQ = transition.reward + 
      (transition.done ? 0 : this.gamma * this.estimateValue(transition.nextState));
    
    // 梯度下降更新
    const currentQ = this.forward(features, this.criticWeights)[0];
    const error = targetQ - currentQ;
    
    // 权重更新
    for (let i = 0; i < this.criticWeights.length; i++) {
      for (let j = 0; j < this.criticWeights[i].length; j++) {
        this.criticWeights[i][j] += this.lr * error * (features[j] || 0);
      }
    }
  }
  
  private updateActor(transition: Transition) {
    // 策略梯度更新 (简化)
    const features = this.stateToFeatures(transition.state);
    const action = this.selectAction(transition.state);
    
    // 计算策略梯度
    const advantage = transition.reward;  // 简化优势估计
    
    // 更新Actor权重
    for (let i = 0; i < this.actorWeights.length; i++) {
      for (let j = 0; j < this.actorWeights[i].length; j++) {
        this.actorWeights[i][j] += this.lr * advantage * features[j] * 0.1;
      }
    }
  }
  
  private estimateValue(state: State): number {
    const features = this.stateToFeatures(state);
    const action = this.selectAction(state);
    const criticFeatures = [...features, action.positionSize];
    return this.forward(criticFeatures, this.criticWeights)[0];
  }
}

export const sacExecutionAgent = new SACExecutionAgent();
