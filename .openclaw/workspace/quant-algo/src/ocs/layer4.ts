/**
 * OCS Layer 4: 入场信号验证 + 仓位计算
 *
 * 职责（精简后）:
 *   - 验证 Layer3 方向信号 + enhanced 信号
 *   - 计算建议仓位大小（基于风险百分比 + ATR）
 *   - 输出入场参数（方向 / entryPrice / positionSize）
 *
 * 不再负责:
 *   - SL/TP 计算 → 由 SLTPCalculator 统一处理
 *   - 退出逻辑 → 由 ExecutionLayer / backtest-engine 统一处理
 *   - 仓位状态跟踪 → 由 ExecutionLayer state 统一管理
 *
 * SL/TP 和退出逻辑的唯一来源:
 *   回测: backtest-engine.checkPosition()
 *   实盘/模拟: EventDrivenExecutionLayer.checkTakeProfitLevels()
 *   两者均使用统一配置 takeProfit.levels 的 closePercent + SL trailing
 */

import { Layer3Output } from './layer3';
import { type Layer4Config, DEFAULT_OCS_CONFIG } from '../config/ocsConfig';

export interface TradeSetup {
  direction: 'long' | 'short';
  entryPrice: number;
  positionSize: number;
  /** Reason string for logging / reasoning chain */
  reason: string;
}

export interface Layer4Output {
  signal: 'open_long' | 'open_short' | 'hold';
  setup?: TradeSetup;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export class OCSLayer4 {
  private readonly config: Layer4Config;

  constructor(config?: Partial<Layer4Config>) {
    const defaultConfig: Layer4Config = { ...DEFAULT_OCS_CONFIG.layer4 };
    this.config = defaultConfig;
    if (config) {
      if (config.stopLoss) this.config.stopLoss = { ...this.config.stopLoss, ...config.stopLoss };
      if (config.positionSizing) this.config.positionSizing = { ...this.config.positionSizing, ...config.positionSizing };
      // Note: config.takeProfit is no longer consumed by Layer4.
      // SL/TP calculation is handled exclusively by SLTPCalculator.
    }
  }

  process(
    layer3Signal: Layer3Output,
    currentPrice: number,
    atr14: number,
    hasPosition: boolean,
    balance: number,
    enhancedSignal?: { action: 'buy' | 'sell' | 'hold'; confidence: number }
  ): Layer4Output {
    // 有持仓时不生成新开仓信号 — 退出逻辑由 ExecutionLayer 统一处理
    if (hasPosition) {
      return { signal: 'hold', reason: '已有持仓，退出逻辑由执行层统一管理', riskLevel: 'low' };
    }

    // 合并 Layer3 信号和 enhanced 信号
    let signal = layer3Signal.signal;
    let confidence = layer3Signal.confidence;

    if (signal === 'hold' && enhancedSignal && enhancedSignal.action !== 'hold') {
      signal = enhancedSignal.action;
      confidence = enhancedSignal.confidence;
    }

    if (signal === 'hold') {
      return { signal: 'hold', reason: '无交易机会', riskLevel: 'low' };
    }

    return this.generateEntrySetup(
      { ...layer3Signal, signal, confidence },
      currentPrice,
      atr14,
      balance
    );
  }

  /**
   * 生成入场参数（方向 + 仓位大小）
   * SL/TP 不在此计算 — 由 SLTPCalculator 统一处理
   */
  private generateEntrySetup(
    layer3Signal: Layer3Output,
    entryPrice: number,
    atr14: number,
    balance: number
  ): Layer4Output {
    const direction = layer3Signal.signal === 'buy' ? 'long' : 'short';
    const { atrMultiplier } = this.config.stopLoss;
    const { riskPercent } = this.config.positionSizing;

    // 用 ATR 估算止损距离来计算仓位（与 SLTPCalculator 的 ATR fallback 一致）
    const stopDistance = atr14 * atrMultiplier;
    const riskAmount = balance * riskPercent;
    const positionSize = riskAmount / stopDistance;

    const reason = `KNN信号: ${layer3Signal.signal}, 置信度: ${layer3Signal.confidence.toFixed(1)}%`;

    return {
      signal: direction === 'long' ? 'open_long' : 'open_short',
      setup: {
        direction,
        entryPrice,
        positionSize,
        reason,
      },
      reason,
      riskLevel: layer3Signal.confidence > 70 ? 'low' : 'medium',
    };
  }
}

export default OCSLayer4;
