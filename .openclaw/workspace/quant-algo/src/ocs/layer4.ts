/**
 * OCS Layer 4: 虚拟交易模拟层
 * 金字塔止盈 + 动态止损
 * TP1/TP2/TP3 + SL
 */

import { Layer3Output } from './layer3';

export interface TradeSetup {
  direction: 'long' | 'short';
  entryPrice: number;
  stopLoss: number;
  takeProfits: {
    tp1: number; // 50%仓位
    tp2: number; // 25%仓位
    tp3: number; // 25%仓位
  };
  positionSize: number;
  riskRewardRatio: number;
  expectedReturn: number;
}

export interface Layer4Output {
  signal: 'open_long' | 'open_short' | 'close_position' | 'partial_close' | 'hold';
  setup?: TradeSetup;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
  closePercent?: number;  // BUG 10 FIX: percentage of position to close for partial closes
}

export class OCSLayer4 {
  private currentPosition: {
    direction: 'long' | 'short';
    entryPrice: number;
    size: number;
    tp1Hit: boolean;
    tp2Hit: boolean;
    stopLoss: number;
    takeProfits: { tp1: number; tp2: number; tp3: number };
  } | null = null;
  
  process(
    layer3Signal: Layer3Output,
    currentPrice: number,
    atr14: number,
    hasPosition: boolean,
    balance: number,
    enhancedSignal?: { action: 'buy' | 'sell' | 'hold'; confidence: number }
  ): Layer4Output {
    // 如果有持仓，检查止盈止损
    if (hasPosition && this.currentPosition) {
      return this.checkExitConditions(currentPrice);
    }
    
    // 如果没有持仓，考虑开仓
    // 优先使用 Layer3 信号，如果没有则使用 enhanced 信号
    let signal = layer3Signal.signal;
    let confidence = layer3Signal.confidence;
    
    if (signal === 'hold' && enhancedSignal && enhancedSignal.action !== 'hold') {
      signal = enhancedSignal.action;
      confidence = enhancedSignal.confidence;
    }
    
    if (!hasPosition && signal !== 'hold') {
      return this.generateEntrySetup(
        { ...layer3Signal, signal, confidence },
        currentPrice,
        atr14,
        balance
      );
    }
    
    return {
      signal: 'hold',
      reason: '无交易机会',
      riskLevel: 'low',
    };
  }
  
  /**
   * 生成入场设置
   */
  private generateEntrySetup(
    layer3Signal: Layer3Output,
    entryPrice: number,
    atr14: number,
    balance: number
  ): Layer4Output {
    const direction = layer3Signal.signal === 'buy' ? 'long' : 'short';
    
    // 计算止损 (基于ATR)
    const stopDistance = atr14 * 1.5;
    const stopLoss = direction === 'long'
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;
    
    // 计算止盈 (金字塔结构)
    // TP1: 1.5x R/R, TP2: 2.5x R/R, TP3: 4x R/R
    const tp1Distance = stopDistance * 1.5;
    const tp2Distance = stopDistance * 2.5;
    const tp3Distance = stopDistance * 4;
    
    const takeProfits = direction === 'long'
      ? {
          tp1: entryPrice + tp1Distance,
          tp2: entryPrice + tp2Distance,
          tp3: entryPrice + tp3Distance,
        }
      : {
          tp1: entryPrice - tp1Distance,
          tp2: entryPrice - tp2Distance,
          tp3: entryPrice - tp3Distance,
        };
    
    // 计算仓位 ( risking 2% of balance )
    const riskAmount = balance * 0.02;
    const positionSize = riskAmount / stopDistance;
    
    // 保存当前持仓设置
    this.currentPosition = {
      direction,
      entryPrice,
      size: positionSize,
      tp1Hit: false,
      tp2Hit: false,
      stopLoss,
      takeProfits,
    };
    
    return {
      signal: direction === 'long' ? 'open_long' : 'open_short',
      setup: {
        direction,
        entryPrice,
        stopLoss,
        takeProfits,
        positionSize,
        riskRewardRatio: 4, // 最大R/R
        expectedReturn: tp3Distance / entryPrice * 100,
      },
      reason: `KNN信号: ${layer3Signal.signal}, 置信度: ${layer3Signal.confidence.toFixed(1)}%`,
      riskLevel: layer3Signal.confidence > 70 ? 'low' : 'medium',
    };
  }
  
  /**
   * 检查出场条件
   * BUG 10 FIX: TP1 and TP2 emit partial_close with closePercent instead of full close_position
   */
  private checkExitConditions(currentPrice: number): Layer4Output {
    if (!this.currentPosition) {
      return { signal: 'hold', reason: '无持仓', riskLevel: 'low' };
    }
    
    const pos = this.currentPosition;
    
    // 检查止损
    const stopHit = pos.direction === 'long'
      ? currentPrice <= pos.stopLoss
      : currentPrice >= pos.stopLoss;
    
    if (stopHit) {
      const pnl = pos.direction === 'long'
        ? (pos.stopLoss - pos.entryPrice) / pos.entryPrice * 100
        : (pos.entryPrice - pos.stopLoss) / pos.entryPrice * 100;
      
      this.currentPosition = null;
      
      return {
        signal: 'close_position',
        reason: `止损触发 @ ${pos.stopLoss.toFixed(2)}, 盈亏: ${pnl.toFixed(2)}%`,
        riskLevel: 'high',
      };
    }
    
    // 检查TP3 (全部平仓)
    const tp3Hit = pos.direction === 'long'
      ? currentPrice >= pos.takeProfits.tp3
      : currentPrice <= pos.takeProfits.tp3;
    
    if (tp3Hit) {
      const pnl = pos.direction === 'long'
        ? (pos.takeProfits.tp3 - pos.entryPrice) / pos.entryPrice * 100
        : (pos.entryPrice - pos.takeProfits.tp3) / pos.entryPrice * 100;
      
      this.currentPosition = null;
      
      return {
        signal: 'close_position',
        reason: `TP3止盈触发 @ ${pos.takeProfits.tp3.toFixed(2)}, 盈亏: ${pnl.toFixed(2)}%`,
        riskLevel: 'low',
      };
    }
    
    // BUG 10 FIX: TP2 emits partial_close with closePercent: 0.25 instead of close_position
    if (!pos.tp2Hit) {
      const tp2Hit = pos.direction === 'long'
        ? currentPrice >= pos.takeProfits.tp2
        : currentPrice <= pos.takeProfits.tp2;
      
      if (tp2Hit) {
        pos.tp2Hit = true;
        return {
          signal: 'partial_close',
          closePercent: 0.25,
          reason: `TP2止盈触发 @ ${pos.takeProfits.tp2.toFixed(2)}, 平仓25%`,
          riskLevel: 'low',
        };
      }
    }
    
    // BUG 10 FIX: TP1 emits partial_close with closePercent: 0.5 instead of close_position
    if (!pos.tp1Hit) {
      const tp1Hit = pos.direction === 'long'
        ? currentPrice >= pos.takeProfits.tp1
        : currentPrice <= pos.takeProfits.tp1;
      
      if (tp1Hit) {
        pos.tp1Hit = true;
        return {
          signal: 'partial_close',
          closePercent: 0.5,
          reason: `TP1止盈触发 @ ${pos.takeProfits.tp1.toFixed(2)}, 平仓50%`,
          riskLevel: 'low',
        };
      }
    }
    
    return {
      signal: 'hold',
      reason: `持仓中，浮盈: ${this.calculateFloatingPnL(currentPrice).toFixed(2)}%`,
      riskLevel: 'low',
    };
  }
  
  /**
   * 计算浮动盈亏
   */
  private calculateFloatingPnL(currentPrice: number): number {
    if (!this.currentPosition) return 0;
    
    const pos = this.currentPosition;
    return pos.direction === 'long'
      ? (currentPrice - pos.entryPrice) / pos.entryPrice * 100
      : (pos.entryPrice - currentPrice) / pos.entryPrice * 100;
  }
  
  /**
   * 设置当前持仓（从外部恢复状态）
   */
  setPosition(position: typeof this.currentPosition) {
    this.currentPosition = position;
  }
  
  getPosition() {
    return this.currentPosition;
  }
  
  clearPosition() {
    this.currentPosition = null;
  }
}

export default OCSLayer4;
