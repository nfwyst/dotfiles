/**
 * Adaptive-OPRO 核心
 * 动态 Prompt 优化引擎
 * 
 * 基于 ATLAS 论文的优化方法
 * 
 * 核心特点:
 * 1. 滚动窗口评估 (K=5 天)
 * 2. 模板分离 (静态指令 vs 动态内容)
 * 3. ROI → 评分映射
 * 4. 优化历史追踪
 */

import {
  OptimizationRecord,
  PerformanceMetrics,
  OptimizationResult,
  OPROConfig,
  OPROStatus,
  OptimizationHistory,
  calculateScore,
  hashPrompt,
  generateOptimizationId,
  DEFAULT_OPRO_CONFIG,
  OPRO_VERSION,
} from './types';

import {
  DEFAULT_STATIC_INSTRUCTIONS,
  OPTIMIZER_META_PROMPT,
  composePrompt,
  validatePromptTemplate,
  REQUIRED_PLACEHOLDERS,
} from './promptTemplates';

import logger from '../logger';
import fs from 'fs';
import path from 'path';

export class AdaptiveOPRO {
  private config: OPROConfig;
  
  // 当前 Prompt
  private currentStaticInstructions: string;
  private currentPromptHash: string;
  
  // 优化历史
  private optimizationHistory: OptimizationRecord[];
  
  // 状态
  private lastOptimization: number;
  private totalOptimizations: number;
  private processingTimes: number[];
  
  // 存储路径
  private storagePath: string;
  
  // LLM 配置
  private llmConfig: {
    url: string;
    apiKey: string;
    model: string;
  };
  
  constructor(config?: Partial<OPROConfig>, storagePath?: string) {
    this.config = { ...DEFAULT_OPRO_CONFIG, ...config };
    this.storagePath = storagePath || './data/opro-history.json';
    
    this.currentStaticInstructions = DEFAULT_STATIC_INSTRUCTIONS;
    this.currentPromptHash = hashPrompt(this.currentStaticInstructions);
    
    this.optimizationHistory = [];
    this.lastOptimization = 0;
    this.totalOptimizations = 0;
    this.processingTimes = [];
    
    // LLM 配置
    this.llmConfig = {
      url: process.env.DEEPSEEK_URL || 'https://api.deepseek.com/v1/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: this.config.optimizerModel,
    };
    
    // 加载历史
    this.loadHistory();
  }
  
  /**
   * 主优化方法
   * 在每个评估窗口结束时调用
   */
  async optimize(metrics: PerformanceMetrics): Promise<OptimizationResult> {
    const startTime = Date.now();
    
    logger.info('🔄 Adaptive-OPRO: Starting optimization...');
    
    try {
      // 1. 计算性能评分
      const score = calculateScore(metrics.roi, this.config);
      
      logger.info(`📊 Performance score: ${score.toFixed(1)}/100 (ROI: ${(metrics.roi * 100).toFixed(2)}%)`);
      
      // 2. 检查是否需要优化
      if (!this.shouldOptimize(metrics, score)) {
        logger.info('⏭️ Optimization skipped (conditions not met)');
        return {
          success: false,
          error: 'Optimization conditions not met',
        };
      }
      
      // 3. 准备优化器输入
      const optimizerInput = this.buildOptimizerInput(metrics, score);
      
      // 4. 调用 LLM 进行优化
      const llmResult = await this.callOptimizerLLM(optimizerInput);
      
      if (!llmResult.success) {
        return llmResult;
      }
      
      // 5. 验证新 Prompt
      const validation = this.validateNewPrompt(llmResult.newPrompt || '');
      
      if (!validation.valid) {
        logger.warn(`⚠️ New prompt validation failed: ${validation.error}`);
        return {
          success: false,
          error: validation.error,
        };
      }
      
      // 6. 应用新 Prompt
      const newPrompt = llmResult.newPrompt!;
      const newHash = hashPrompt(newPrompt);
      
      // 7. 记录优化
      const record: OptimizationRecord = {
        id: generateOptimizationId(),
        timestamp: Date.now(),
        promptHash: newHash,
        promptContent: newPrompt,
        score,
        roi: metrics.roi,
        changeSummary: llmResult.proposedChanges || '',
        expectedImpact: llmResult.expectedImpact || '',
        windowStart: metrics.windowStart,
        windowEnd: metrics.windowEnd,
        tradesInWindow: metrics.tradeCount,
      };
      
      this.optimizationHistory.push(record);
      this.currentStaticInstructions = newPrompt;
      this.currentPromptHash = newHash;
      this.lastOptimization = Date.now();
      this.totalOptimizations++;
      this.processingTimes.push(Date.now() - startTime);
      
      // 8. 保存历史
      this.saveHistory();
      
      logger.info(`✅ Optimization complete: ${llmResult.proposedChanges}`);
      
      return {
        success: true,
        newPrompt,
        promptHash: newHash,
        diagnosis: llmResult.diagnosis,
        proposedChanges: llmResult.proposedChanges,
        expectedImpact: llmResult.expectedImpact,
        confidence: llmResult.confidence,
        processingTimeMs: Date.now() - startTime,
      };
      
    } catch (error: unknown) {
      logger.error(`❌ Optimization failed: ${(error instanceof Error ? error.message : String(error))}`);
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
  
  /**
   * 检查是否应该优化
   */
  private shouldOptimize(metrics: PerformanceMetrics, score: number): boolean {
    // 检查交易次数
    if (metrics.tradeCount < this.config.minTradesForOptimization) {
      logger.debug(`Not enough trades: ${metrics.tradeCount} < ${this.config.minTradesForOptimization}`);
      return false;
    }
    
    // 检查优化间隔
    const timeSinceLastOpt = Date.now() - this.lastOptimization;
    if (timeSinceLastOpt < this.config.optimizationInterval && this.totalOptimizations > 0) {
      logger.debug(`Too soon since last optimization: ${timeSinceLastOpt / 1000 / 60} minutes`);
      return false;
    }
    
    // 检查评分是否需要改进
    // 如果评分很高，不需要优化
    if (score > 80) {
      logger.debug(`Score already high: ${score}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * 构建优化器输入
   */
  private buildOptimizerInput(metrics: PerformanceMetrics, score: number): string {
    // 最近优化历史
    const recentHistory = this.optimizationHistory.slice(-5);
    
    const historyText = recentHistory.length > 0
      ? recentHistory.map(h => `
- 评分: ${h.score.toFixed(1)}/100
- 变更: ${h.changeSummary}
- 效果: ${h.expectedImpact}
`).join('\n')
      : '无历史记录 (首次优化)';
    
    return `
${OPTIMIZER_META_PROMPT}

## 当前 Prompt

\`\`\`
${this.currentStaticInstructions}
\`\`\`

## 性能指标 (最近 ${this.config.windowSize} 天)

- ROI: ${(metrics.roi * 100).toFixed(2)}%
- 评分: ${score.toFixed(1)}/100
- 胜率: ${metrics.winRate.toFixed(1)}%
- 盈亏比: ${metrics.profitFactor.toFixed(2)}
- 最大回撤: ${(metrics.maxDrawdown * 100).toFixed(1)}%
- 交易次数: ${metrics.tradeCount}
- 夏普比率: ${metrics.sharpeRatio.toFixed(2)}

## 优化历史

${historyText}

## 任务

分析以上信息，识别当前 Prompt 的问题并提出改进建议。
输出 JSON 格式的结果。
`;
  }
  
  /**
   * 调用优化器 LLM
   */
  private async callOptimizerLLM(input: string): Promise<OptimizationResult> {
    if (!this.llmConfig.apiKey) {
      return {
        success: false,
        error: 'LLM API key not configured',
      };
    }
    
    try {
      const response = await fetch(this.llmConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: this.llmConfig.model,
          messages: [
            { role: 'system', content: '你是交易策略优化专家，专注于改进 LLM 交易决策 Prompt。' },
            { role: 'user', content: input },
          ],
          temperature: this.config.optimizerTemperature,
          max_tokens: this.config.maxTokens,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }
      
      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      
      // 解析 JSON
      const parsed = this.parseOptimizationResult(content);
      
      return {
        success: true,
        newPrompt: parsed.proposedChanges,
        diagnosis: parsed.diagnosis,
        proposedChanges: parsed.proposedChanges,
        expectedImpact: parsed.expectedImpact,
        confidence: parsed.confidence,
      };
      
    } catch (error: unknown) {
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
      };
    }
  }
  
  /**
   * 解析优化结果
   */
  private parseOptimizationResult(content: string): {
    diagnosis: string;
    proposedChanges: string;
    expectedImpact: string;
    confidence: number;
  } {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                        content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          diagnosis: json.diagnosis || '',
          proposedChanges: json.proposedChanges || this.currentStaticInstructions,
          expectedImpact: json.expectedImpact || '',
          confidence: json.confidence || 0.5,
        };
      }
    } catch (e) {
      // JSON 解析失败
    }
    
    // 返回默认值
    return {
      diagnosis: '无法解析 LLM 响应',
      proposedChanges: this.currentStaticInstructions,
      expectedImpact: '',
      confidence: 0,
    };
  }
  
  /**
   * 验证新 Prompt
   */
  private validateNewPrompt(newPrompt: string): { valid: boolean; error?: string } {
    // 检查长度
    if (newPrompt.length > this.config.maxPromptLength) {
      return { valid: false, error: `Prompt too long: ${newPrompt.length}` };
    }
    
    // 检查必需占位符
    if (this.config.preservePlaceholders) {
      const validation = validatePromptTemplate(newPrompt, REQUIRED_PLACEHOLDERS);
      if (!validation.valid) {
        return { valid: false, error: `Missing placeholders: ${validation.missing.join(', ')}` };
      }
    }
    
    // 检查是否为空
    if (!newPrompt.trim()) {
      return { valid: false, error: 'Prompt is empty' };
    }
    
    return { valid: true };
  }
  
  /**
   * 获取当前 Prompt
   */
  getCurrentPrompt(): { static: string; hash: string } {
    return {
      static: this.currentStaticInstructions,
      hash: this.currentPromptHash,
    };
  }
  
  /**
   * 组合完整 Prompt
   */
  composeFullPrompt(dynamicData: Record<string, any>): string {
    return composePrompt(this.currentStaticInstructions, dynamicData);
  }
  
  /**
   * 获取状态
   */
  getStatus(): OPROStatus {
    const recentScores = this.optimizationHistory
      .slice(-10)
      .map(r => r.score);
    
    let scoreTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentScores.length >= 3) {
      const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2));
      const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 5) {
        scoreTrend = 'improving';
      } else if (secondAvg < firstAvg - 5) {
        scoreTrend = 'declining';
      }
    }
    
    return {
      healthy: true,
      lastOptimization: this.lastOptimization,
      totalOptimizations: this.totalOptimizations,
      currentPromptHash: this.currentPromptHash,
      avgProcessingTimeMs: this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
        : 0,
      recentScores,
      scoreTrend,
    };
  }
  
  /**
   * 获取优化历史
   */
  getHistory(): OptimizationHistory {
    const scores = this.optimizationHistory.map(r => r.score);
    
    return {
      records: this.optimizationHistory,
      totalOptimizations: this.totalOptimizations,
      avgScoreImprovement: this.calculateAvgImprovement(),
      bestScore: scores.length > 0 ? Math.max(...scores) : 0,
      worstScore: scores.length > 0 ? Math.min(...scores) : 0,
      firstOptimization: this.optimizationHistory[0]?.timestamp || 0,
      lastOptimization: this.lastOptimization,
    };
  }
  
  /**
   * 计算平均改进
   */
  private calculateAvgImprovement(): number {
    if (this.optimizationHistory.length < 2) return 0;
    
    const improvements: number[] = [];
    for (let i = 1; i < this.optimizationHistory.length; i++) {
      improvements.push(
        this.optimizationHistory[i].score - this.optimizationHistory[i - 1].score
      );
    }
    
    return improvements.reduce((a, b) => a + b, 0) / improvements.length;
  }
  
  /**
   * 加载历史
   */
  private loadHistory(): void {
    try {
      const fullPath = path.resolve(this.storagePath);
      if (fs.existsSync(fullPath)) {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        
        if (data.history) {
          this.optimizationHistory = data.history;
        }
        if (data.currentPrompt) {
          this.currentStaticInstructions = data.currentPrompt;
          this.currentPromptHash = hashPrompt(this.currentStaticInstructions);
        }
        this.totalOptimizations = data.totalOptimizations || this.optimizationHistory.length;
        this.lastOptimization = data.lastOptimization || 0;
        
        logger.info(`📂 Loaded ${this.optimizationHistory.length} optimization records`);
      }
    } catch (error: unknown) {
      logger.warn(`Failed to load OPRO history: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }
  
  /**
   * 保存历史
   */
  private saveHistory(): void {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const data = {
        version: OPRO_VERSION,
        currentPrompt: this.currentStaticInstructions,
        currentPromptHash: this.currentPromptHash,
        history: this.optimizationHistory,
        totalOptimizations: this.totalOptimizations,
        lastOptimization: this.lastOptimization,
        savedAt: Date.now(),
      };
      
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
      logger.debug(`💾 Saved OPRO history to ${this.storagePath}`);
      
    } catch (error: unknown) {
      logger.error(`Failed to save OPRO history: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }
  
  /**
   * 手动设置 Prompt (用于测试或恢复)
   */
  setPrompt(newPrompt: string): void {
    this.currentStaticInstructions = newPrompt;
    this.currentPromptHash = hashPrompt(newPrompt);
    this.saveHistory();
  }
  
  /**
   * 重置为默认
   */
  reset(): void {
    this.currentStaticInstructions = DEFAULT_STATIC_INSTRUCTIONS;
    this.currentPromptHash = hashPrompt(this.currentStaticInstructions);
    this.optimizationHistory = [];
    this.totalOptimizations = 0;
    this.lastOptimization = 0;
    this.saveHistory();
    logger.info('🔄 OPRO reset to defaults');
  }
}

export default AdaptiveOPRO;
