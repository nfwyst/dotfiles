/**
 * GT-Score: 鲁棒目标函数 - 过拟合控制
 * 基于2026年论文 "The GT-Score: A Robust Objective Function for Reducing Overfitting"
 * 
 * GT-Score = Sharpe × (1 - MaxDD) × 复杂度惩罚
 * 复杂度惩罚 = exp(-参数数量 / 交易次数)
 * 
 * 2026升级版: 添加复合目标函数
 * GT-Score V2 = Sharpe × Significance × Consistency × (1 - DownsideRisk) × ComplexityPenalty
 * - Significance: 统计显著性 (p-value检验)
 * - Consistency: 策略一致性 (收益分布偏度/峰度)
 * - DownsideRisk: 下行风险 (Sortino比率相关)
 */

export interface BacktestMetrics {
  sharpeRatio: number;
  maxDrawdown: number;
  trades: number;
  parameters: number;
  totalReturn: number;
  winRate: number;
  // 2026新增字段
  sortinoRatio?: number;       // Sortino比率
  calmarRatio?: number;        // Calmar比率
  returnStdDev?: number;       // 收益标准差
  negativeReturns?: number[];  // 负收益序列
  positiveReturns?: number[];  // 正收益序列
}

export interface GTScoreResult {
  gtScore: number;
  sharpeComponent: number;
  drawdownComponent: number;
  complexityPenalty: number;
  overfittingRisk: 'low' | 'medium' | 'high';
  // 2026新增组件
  significanceComponent?: number;   // 统计显著性
  consistencyComponent?: number;    // 策略一致性
  downsideRiskComponent?: number;   // 下行风险
  pValue?: number;                  // p值
  gtScoreV2?: number;               // V2综合分数
}

export class GTScoreCalculator {
  /**
   * 计算 GT-Score
   * 分数越高表示策略越稳健，过拟合风险越低
   */
  calculate(metrics: BacktestMetrics): GTScoreResult {
    const { sharpeRatio, maxDrawdown, trades, parameters } = metrics;
    
    // 1. 夏普比率组件 (已归一化)
    const sharpeComponent = sharpeRatio;
    
    // 2. 回撤组件 (1 - 最大回撤，越接近1越好)
    const drawdownComponent = 1 - maxDrawdown;
    
    // 3. 复杂度惩罚
    // 参数越多、交易次数越少，惩罚越大
    const complexityPenalty = Math.exp(-parameters / Math.max(trades, 1));
    
    // 4. GT-Score 综合计算
    const gtScore = sharpeComponent * drawdownComponent * complexityPenalty;
    
    // 5. 过拟合风险评估
    const overfittingRisk = this.assessOverfittingRisk(
      gtScore, 
      parameters, 
      trades
    );
    
    // 6. 计算V2组件 (2026升级版)
    const v2Components = this.calculateV2Components(metrics, gtScore);
    
    return {
      gtScore,
      sharpeComponent,
      drawdownComponent,
      complexityPenalty,
      overfittingRisk,
      ...v2Components,
    };
  }
  
  /**
   * 评估过拟合风险等级
   */
  private assessOverfittingRisk(
    gtScore: number, 
    parameters: number, 
    trades: number
  ): 'low' | 'medium' | 'high' {
    const paramTradeRatio = parameters / Math.max(trades, 1);
    
    if (gtScore > 0.5 && paramTradeRatio < 0.05) {
      return 'low';
    } else if (gtScore > 0.2 && paramTradeRatio < 0.1) {
      return 'medium';
    }
    return 'high';
  }
  
  /**
   * ### 计算V2组件 (2026升级版)
   * GT-Score V2 = Sharpe × Significance × Consistency × (1 - DownsideRisk) × ComplexityPenalty
   */
  private calculateV2Components(metrics: BacktestMetrics, baseGTScore: number): Partial<GTScoreResult> {
    const { sortinoRatio, calmarRatio, negativeReturns, positiveReturns, trades, winRate } = metrics;
    
    // 1. 统计显著性 (基于交易次数和胜率)
    const pValue = this.calculatePValue(trades, winRate);
    const significanceComponent = 1 - pValue; // p值越小，显著性越高
    
    // 2. 策略一致性 (收益分布偏度)
    const consistencyComponent = this.calculateConsistency(negativeReturns, positiveReturns);
    
    // 3. 下行风险 (基于Sortino比率)
    const downsideRiskComponent = this.calculateDownsideRisk(sortinoRatio, calmarRatio);
    
    // 4. GT-Score V2 综合计算
    const gtScoreV2 = baseGTScore * significanceComponent * consistencyComponent * (1 - downsideRiskComponent);
    
    return {
      significanceComponent,
      consistencyComponent,
      downsideRiskComponent,
      pValue,
      gtScoreV2,
    };
  }
  
  /**
   * ### 计算p值 (二项分布近似)
   * H0: 胜率 <= 50% (无预测能力)
   * H1: 胜率 > 50% (有预测能力)
   */
  private calculatePValue(trades: number, winRate: number): number {
    if (trades < 10) return 1; // 样本太少，无法判断显著性
    
    // 正态近似
    const p = 0.5; // 原假设胜率
    const n = trades;
    const observedWins = winRate * n;
    const expectedWins = p * n;
    const stdDev = Math.sqrt(n * p * (1 - p));
    
    if (stdDev === 0) return 1;
    
    // Z分数
    const z = (observedWins - expectedWins) / stdDev;
    
    // 单侧p值 (正态分布右尾)
    const pValue = 0.5 * (1 - this.erf(Math.abs(z) / Math.sqrt(2)));
    
    return Math.max(0.001, Math.min(0.999, pValue));
  }
  
  /**
   * 误差函数近似 (用于正态分布计算)
   */
  private erf(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }
  
  /**
   * ### 计算策略一致性
   * 基于收益分布的偏度
   */
  private calculateConsistency(negativeReturns?: number[], positiveReturns?: number[]): number {
    if (!negativeReturns || !positiveReturns) {
      return 0.5; // 默认中等一致性
    }
    
    const allReturns = [...negativeReturns, ...positiveReturns];
    if (allReturns.length < 5) return 0.5;
    
    // 计算均值和标准差
    const mean = allReturns.reduce((a, b) => a + b, 0) / allReturns.length;
    const variance = allReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / allReturns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0.5;
    
    // 计算偏度 (正偏度表示更多正收益)
    const skewness = allReturns.reduce(
      (sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0
    ) / allReturns.length;
    
    // 偏度映射到0-1范围 (偏度>0表示一致性高)
    const consistency = 1 / (1 + Math.exp(-skewness));
    
    return Math.max(0.1, Math.min(1, consistency));
  }
  
  /**
   * ### 计算下行风险
   * 基于Sortino比率和Calmar比率
   */
  private calculateDownsideRisk(sortinoRatio?: number, calmarRatio?: number): number {
    if (sortinoRatio === undefined && calmarRatio === undefined) {
      return 0.3; // 默认中等下行风险
    }
    
    // Sortino比率越高，下行风险越低
    let riskFromSortino = 0.3;
    if (sortinoRatio !== undefined) {
      riskFromSortino = Math.max(0, Math.min(1, 1 - sortinoRatio / 4));
    }
    
    // Calmar比率越高，下行风险越低
    let riskFromCalmar = 0.3;
    if (calmarRatio !== undefined) {
      riskFromCalmar = Math.max(0, Math.min(1, 1 - calmarRatio / 5));
    }
    
    // 综合下行风险
    return (riskFromSortino + riskFromCalmar) / 2;
  }
  
  /**
   * 比较多个策略的 GT-Score
   * 返回排序后的策略列表
   */
  compareStrategies(
    strategies: Array<{ name: string; metrics: BacktestMetrics }>
  ): Array<{ name: string; result: GTScoreResult; rank: number }> {
    const results = strategies.map(s => ({
      name: s.name,
      result: this.calculate(s.metrics),
      rank: 0
    }));
    
    // 按 GT-Score 降序排序
    results.sort((a, b) => b.result.gtScore - a.result.gtScore);
    
    // 分配排名
    results.forEach((r, i) => {
      r.rank = i + 1;
    });
    
    return results;
  }
  
  /**
   * 检查策略是否通过 GT-Score 阈值
   */
  isStrategyValid(metrics: BacktestMetrics, threshold: number = 0.3): boolean {
    const result = this.calculate(metrics);
    return result.gtScore >= threshold && result.overfittingRisk !== 'high';
  }
}

// 单例导出
export const gtScoreCalculator = new GTScoreCalculator();
