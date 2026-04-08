/**
 * 2. 策略引擎模块
 * 职责: 核心策略调度，整合技术指标，输出交易信号
 * 支持策略: OCS
 */

import { TechnicalIndicators, OHLCV } from './technicalAnalysis';
import OCSLayer1 from '../ocs/layer1';
import OCSLayer2 from '../ocs/layer2';
import OCSLayer3 from '../ocs/layer3';
import OCSLayer4 from '../ocs/layer4';

import SLTPCalculator from './slTpCalculator';
import OCSEnhanced from '../ocs/enhanced/index';
// OCS 2.0 新增导入
import { sacExecutionAgent, State as SACState } from '../ocs/linearPolicyAgent';

export type StrategyType = 'ocs';

export interface StrategySignal {
  strategy: string;
  type: 'long' | 'short' | 'hold';
  strength: number;        // 0-100
  confidence: number;      // 0-1
  entryPrice: number;
  stopLoss: number;
  takeProfits?: {
    tp1: number;
    tp2: number;
    tp3: number;
  };
  positionSize?: number;   // 建议仓位
  timeframe: string;
  reasoning: string[];
  metadata?: {
    ocsFeatures?: [number, number, number];  // OCS 3D特征
    technicalScores?: any;
    confirmations?: number;
  };
}

export interface StrategyContext {
  indicators: TechnicalIndicators;
  multiTimeframeIndicators: Record<string, TechnicalIndicators | null>;
  currentPrice: number;
  balance: number;
  hasPosition: boolean;
  currentPosition?: any;
  marketContext: string;
}

export class StrategyEngineModule {
  private activeStrategy: StrategyType;

  // OCS组件
  private ocsLayer1: OCSLayer1;
  private ocsLayer2: OCSLayer2;
  private ocsLayer3: OCSLayer3;
  private ocsLayer4: OCSLayer4;



  // SL/TP计算器
  private sltpCalculator: SLTPCalculator;

  // OCS enhanced 增强器
  private ocsEnhanced: OCSEnhanced;

  // 历史数据缓存
  private ohlcvHistory: OHLCV[] = [];

  // OCS 2.0: SAC训练状态
  private sacEnabled: boolean = false;  // 默认禁用，直到训练完成
  private sacTrainingMode: boolean = false;
  private lastSACState: SACState | null = null;
  private lastSACAction: any = null;

  constructor(strategy: StrategyType = 'ocs') {
    this.activeStrategy = strategy;

    // 初始化OCS (默认使用稳定LMS，非注意力机制)
    this.ocsLayer1 = new OCSLayer1();
    this.ocsLayer2 = new OCSLayer2(true, false);  // useV312=true, useAttention=false
    this.ocsLayer3 = new OCSLayer3();
    this.ocsLayer4 = new OCSLayer4();



    // 初始化SL/TP计算器
    this.sltpCalculator = new SLTPCalculator('5m');

    // 初始化OCS enhanced增强器
    this.ocsEnhanced = new OCSEnhanced();
  }

  /**
   * 设置激活的策略
   */
  setStrategy(strategy: StrategyType) {
    this.activeStrategy = strategy;
  }

  /**
   * 获取当前激活的策略
   */
  getStrategy(): StrategyType {
    return this.activeStrategy;
  }

  /**
   * 添加历史数据
   * BUG 2 FIX: Pass offset=50 to initializeFromHistory so that
   * features3D[i] is correctly paired with ohlcv[50 + i]
   */
  addHistoricalData(ohlcv: OHLCV[]) {
    this.ohlcvHistory = ohlcv;

    // 初始化OCS Layer3
    if (ohlcv.length > 50) {
      const features3D: [number, number, number][] = [];
      for (let i = 50; i < ohlcv.length; i++) {
        const slice = ohlcv.slice(0, i);
        const l1 = this.ocsLayer1.process(slice);
        const l2 = this.ocsLayer2.process(
          l1,
          slice.map(s => s.close),
          slice.map(s => s.volume)
        );
        features3D.push(l2.features3D);
      }
      // BUG 2 FIX: features3D[0] corresponds to ohlcv[50], so pass offset=50
      this.ocsLayer3.initializeFromHistory(ohlcv, features3D, 50);
    }
  }

  /**
   * 更新最新数据
   */
  updateData(ohlcv: OHLCV) {
    this.ohlcvHistory.push(ohlcv);
    if (this.ohlcvHistory.length > 500) {
      this.ohlcvHistory.shift();
    }
  }

  /**
   * 生成交易信号
   */
  generateSignal(context: StrategyContext): StrategySignal {
    return this.generateOCSSignal(context);
  }

  /**
   * OCS策略信号 - OCS 1.0 稳定版 + 已验证优化
   * 保留: GT-Score + 微观结构特征
   * 回退: Layer 3原始实现, 禁用SAC和注意力机制
   */
  private generateOCSSignal(context: StrategyContext): StrategySignal {
    const { currentPrice, balance, hasPosition, indicators } = context;

    // OCS Layer 1-4 处理 (稳定版本)
    const layer1Output = this.ocsLayer1.process(this.ohlcvHistory);
    const layer2Output = this.ocsLayer2.process(
      layer1Output,
      this.ohlcvHistory.map(h => h.close),
      this.ohlcvHistory.map(h => h.volume)
    );
    const layer3Output = this.ocsLayer3.process(
      layer2Output.features3D,
      this.ohlcvHistory.map(h => h.close)
    );
    
    // 使用 enhanced 增强
    const enhancedOutput = this.ocsEnhanced.enhance(
      this.ohlcvHistory,
      layer2Output,
      layer3Output
    );

    // 传递 enhanced 信号给 Layer4
    const layer4Output = this.ocsLayer4.process(
      layer3Output,
      currentPrice,
      indicators.atr[14],
      hasPosition,
      balance,
      enhancedOutput.combinedSignal
    );

    // 如果 Layer4 没有信号，返回 hold
    if (layer4Output.signal === 'hold' || !layer4Output.setup) {
      return {
        strategy: 'OCS-stable',
        type: 'hold',
        strength: 0,
        confidence: 0,
        entryPrice: currentPrice,
        stopLoss: 0,
        timeframe: '5m',
        reasoning: [layer4Output.reason],
        metadata: { 
          ocsFeatures: layer2Output.features3D, 
          enhanced: enhancedOutput,
          microstructure: indicators.microstructure  // 保留微观结构特征
        }
      };
    }

    const finalDirection = layer4Output.setup.direction;
    const finalConfidence = layer3Output.signal !== 'hold' 
      ? layer3Output.confidence / 100 
      : enhancedOutput.combinedSignal.confidence / 100;
    const setup = layer4Output.setup;

    // 使用统一的 SL/TP 计算子模块
    const highs = this.ohlcvHistory.map(h => h.high);
    const lows = this.ohlcvHistory.map(h => h.low);
    
    const sltp = this.sltpCalculator.calculate(
      finalDirection,
      setup.entryPrice,
      highs,
      lows,
      this.ohlcvHistory.length - 1
    );
    
    const reasoning = [
      layer4Output.reason,
      `KNN信号: ${layer3Output.signal} (置信度: ${layer3Output.confidence.toFixed(1)}%)`,
      `Ehlers周期: ${layer2Output.dominantCycle.period}根K线 (${layer2Output.dominantCycle.state})`,
      `enhanced增强: ${enhancedOutput.combinedSignal.action} (置信度: ${enhancedOutput.combinedSignal.confidence.toFixed(1)}%)`,
      ...enhancedOutput.combinedSignal.reasoning.slice(0, 2),
    ];
    
    if (sltp) {
      reasoning.push(...sltp.reasoning);
    }

    return {
      strategy: 'OCS-stable',
      type: finalDirection,
      strength: layer4Output.riskLevel === 'low' ? 85 : 70,
      confidence: finalConfidence,
      entryPrice: setup.entryPrice,
      stopLoss: sltp?.stopLoss || setup.stopLoss,
      takeProfits: sltp?.takeProfits || setup.takeProfits,
      positionSize: setup.positionSize,
      timeframe: '5m',
      reasoning,
      metadata: {
        ocsFeatures: layer2Output.features3D,
        enhanced: enhancedOutput,
        unifiedTpsl: !!sltp,
        microstructure: indicators.microstructure  // 保留微观结构特征
      }
    };
  }







  /**
   * 更新OCS历史（平仓后调用）
   */
  updateOCSHistory(features3D: [number, number, number], entryPrice: number, exitPrice: number, direction: 'long' | 'short') {
    this.ocsLayer3.updateHistory(features3D, entryPrice, exitPrice, direction);
  }

  /**
   * OCS持仓管理
   */
  getOCSPosition() { return this.ocsLayer4.getPosition(); }
  setOCSPosition(position: any) { this.ocsLayer4.setPosition(position); }
  clearOCSPosition() { this.ocsLayer4.clearPosition(); }

  // ========== OCS 2.0: SAC训练方法 ==========

  /**
   * 启用SAC训练模式
   */
  enableSACTraining() {
    this.sacTrainingMode = true;
    this.sacEnabled = true;
    console.log('SAC训练模式已启用');
  }

  /**
   * 禁用SAC训练模式
   */
  disableSACTraining() {
    this.sacTrainingMode = false;
    console.log('SAC训练模式已禁用');
  }

  /**
   * 记录交易结果并训练SAC (平仓后调用)
   */
  recordTradeResult(pnl: number, cvar: number) {
    if (!this.sacTrainingMode || !this.lastSACState || !this.lastSACAction) {
      return;
    }

    // 计算奖励
    const reward = sacExecutionAgent.calculateReward(pnl, cvar);

    // 存储经验
    sacExecutionAgent.storeTransition({
      state: this.lastSACState,
      action: this.lastSACAction,
      reward: reward,
      nextState: this.lastSACState, // 简化：使用相同状态
      done: false
    });

    // 训练一步
    sacExecutionAgent.train();

    // 清空当前状态
    this.lastSACState = null;
    this.lastSACAction = null;
  }

  /**
   * 完成SAC训练并启用
   */
  finalizeSACTraining() {
    this.sacTrainingMode = false;
    this.sacEnabled = true;
    console.log('SAC训练完成，已启用');
  }
}

export default StrategyEngineModule;
