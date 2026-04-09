/**
 * 风险评估 Agent
 * 专注于量化交易风险
 * 
 * 细粒度任务：只评估风险，不做方向判断
 * 
 * 支持两种模式:
 * 1. LLM 模式 - 调用 DeepSeek API 进行推理
 * 2. Fallback 模式 - 纯代码计算
 */

import {
  DecisionAgent,
  DecisionContext,
  AgentOutput,
  AgentStatus,
  RiskAgentOutput,
  ActionType,
  RiskLevel,
} from './types';

import { TechnicalReport } from '../marketIntelligence/types';
import { LLMClient } from '../../ai/LLMClient';

import logger from '../../logger';

// ==================== Risk analysis types ====================

/** Risk parameters controlling position sizing and limits */
interface RiskParameters {
  maxPositionSize: number;
  maxLeverage: number;
  maxDrawdown: number;
}

/** Internal risk analysis result */
interface RiskAnalysis {
  level: RiskLevel;
  maxDrawdown: number;
  volatilityAssessment: string;
  recommendedPositionSize: number;
  stopLoss: number;
  stopLossPercent?: number;
  takeProfitLevels: number[];
  takeProfitPercents?: number[];
}

/** LLM response shape for risk assessment */
interface LLMRiskResponse {
  level: RiskLevel;
  volatilityAssessment: string;
  recommendedPositionSize: number;
  stopLossPercent: number;
  takeProfitLevels?: Array<{ percent: number; portion: number }>;
  confidence: number;
  reasoning: string[];
}

export class RiskAgent implements DecisionAgent {
  readonly name = 'RiskAgent';
  readonly version = '2.1.0';
  
  private lastRun: number = 0;
  private errorCount: number = 0;
  private processingTimes: number[] = [];
  private useLLM: boolean = true;
  
  async analyze(context: DecisionContext): Promise<AgentOutput> {
    const startTime = Date.now();
    
    try {
      const { marketIntelligence, currentPrice, balance, riskParameters } = context;
      const technical = marketIntelligence.technical as TechnicalReport;
      
      if (!technical) {
        return {
          success: false,
          error: 'Technical report not available',
          processingTimeMs: Date.now() - startTime,
        };
      }
      
      // 尝试使用 LLM 模式
      if (this.useLLM) {
        const llmResult = await this.analyzeWithLLM(technical, currentPrice, balance, riskParameters);
        if (llmResult.success) {
          this.lastRun = Date.now();
          this.processingTimes.push(Date.now() - startTime);
          return llmResult;
        }
        
        logger.warn(`⚠️ RiskAgent LLM failed, fallback to code: ${llmResult.error}`);
      }
      
      // Fallback: 纯代码分析
      const codeResult = this.analyzeWithCode(technical, currentPrice, balance, riskParameters);
      
      this.lastRun = Date.now();
      this.processingTimes.push(Date.now() - startTime);
      
      return codeResult;
      
    } catch (error: unknown) {
      this.errorCount++;
      return {
        success: false,
        error: (error instanceof Error ? error.message : String(error)),
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
  
  /**
   * LLM 模式分析
   */
  private async analyzeWithLLM(
    technical: TechnicalReport,
    currentPrice: number,
    balance: number,
    riskParameters: RiskParameters
  ): Promise<AgentOutput> {
    const llm = LLMClient.getInstance();
    const systemPrompt = `你是一个专业的风险评估专家。
你的任务是评估当前交易风险并设置止损止盈。

输出 JSON 格式:
{
  "level": "low" | "medium" | "high",
  "volatilityAssessment": "波动率评估描述",
  "recommendedPositionSize": 0-1 (建议仓位比例),
  "stopLossPercent": 止损百分比,
  "takeProfitLevels": [
    { "percent": 止盈百分比1, "portion": 平仓比例1 },
    { "percent": 止盈百分比2, "portion": 平仓比例2 },
    { "percent": 止盈百分比3, "portion": 平仓比例3 }
  ],
  "confidence": 0-1,
  "reasoning": ["原因1", "原因2"]
}

注意: takeProfitLevels 必须有三个级别，portion 总和必须等于 1。
例如: [{"percent": 1.5, "portion": 0.3}, {"percent": 3, "portion": 0.4}, {"percent": 5, "portion": 0.3}]`;

    const userPrompt = `评估当前交易风险:

市场数据:
- 当前价格: ${currentPrice.toFixed(2)}
- ATR (波动率): ${technical.volatility.atr?.toFixed(2) || 'N/A'}
- RSI: ${technical.momentum.rsi.value.toFixed(1)}
- 趋势强度: ${technical.trend.strength}
- 成交量比率: ${technical.volume.volumeRatio?.toFixed(2) || 'N/A'}

账户信息:
- 余额: ${balance.toFixed(2)} USDT
- 最大仓位: ${(riskParameters?.maxPositionSize * 100 || 2).toFixed(1)}%
- 最大杠杆: ${riskParameters?.maxLeverage || 20}x
- 最大回撤: ${((riskParameters?.maxDrawdown || 0.1) * 100).toFixed(1)}%

请综合评估风险，给出建议。`;

    let resultContent: string;
    try {
      const llmResp = await llm.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        responseFormat: { type: 'json_object' },
        temperature: 0.3,
      });
      resultContent = llmResp.content;
    } catch (llmError: unknown) {
      return {
        success: false,
        error: llmError instanceof Error ? llmError.message : 'LLM call failed',
      };
    }

    if (!resultContent) {
      return {
        success: false,
        error: 'Empty response',
      };
    }
    
    try {
      const rawParsed: unknown = JSON.parse(resultContent);
      if (!rawParsed || typeof rawParsed !== 'object') {
        return { success: false, error: 'Invalid JSON response' };
      }
      const parsed = rawParsed as LLMRiskResponse;
      
      // 计算止损止盈价格
      // 止损止盈百分比（不计算具体价格，由 OrderGenerator 根据方向计算）
      const stopLossPercent = parsed.stopLossPercent || 2;
      const takeProfitPercents = parsed.takeProfitLevels 
        ? parsed.takeProfitLevels.map((tp) => tp.percent)
        : [1.5, 3, 5];
      
      const output: RiskAgentOutput = {
        agentName: 'RiskAgent',
        risk: {
          level: parsed.level,
          maxDrawdown: riskParameters?.maxDrawdown || 0.1,
          volatilityAssessment: parsed.volatilityAssessment,
          recommendedPositionSize: parsed.recommendedPositionSize,
          stopLoss: 0,  // 占位，由 OrderGenerator 计算
          stopLossPercent,
          takeProfitLevels: [],  // 占位，由 OrderGenerator 计算
          takeProfitPercents,
        },
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        suggestedAction: parsed.level === 'high' ? 'hold' : 'buy',
        signalStrength: parsed.level === 'high' ? 0 : parsed.recommendedPositionSize * 50,
      };
      
      logger.info(`🤖 RiskAgent (LLM): ${parsed.level} risk, position: ${(parsed.recommendedPositionSize * 100).toFixed(1)}%, SL: ${stopLossPercent}%, TP: ${takeProfitPercents.join('%, ')}%`);
      
      return {
        success: true,
        data: output,
        processingTimeMs: 0,
      };
      
    } catch (parseError: unknown) {
      return {
        success: false,
        error: `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      };
    }
  }
  
  /**
   * Fallback: 纯代码分析
   */
  private analyzeWithCode(
    technical: TechnicalReport,
    currentPrice: number,
    balance: number,
    riskParameters: RiskParameters
  ): AgentOutput {
    const riskAnalysis = this.analyzeRisk(technical, currentPrice, balance, riskParameters);
    const suggestedAction = this.determineAction(riskAnalysis);
    const signalStrength = this.calculateSignalStrength(riskAnalysis);
    
    const output: RiskAgentOutput = {
      agentName: 'RiskAgent',
      risk: riskAnalysis,
      confidence: 0.7,
      reasoning: this.generateReasoning(riskAnalysis),
      suggestedAction,
      signalStrength,
    };
    
    logger.info(`📊 RiskAgent (Code): ${riskAnalysis.level} risk`);
    
    return {
      success: true,
      data: output,
      processingTimeMs: 0,
    };
  }
  
  private analyzeRisk(
    technical: TechnicalReport,
    currentPrice: number,
    balance: number,
    riskParameters: RiskParameters
  ): RiskAnalysis {
    const atr = technical.volatility.atr || currentPrice * 0.02;
    const volatilityPercent = (atr / currentPrice) * 100;
    
    let level: RiskLevel = 'low';
    if (volatilityPercent > 3) level = 'high';
    else if (volatilityPercent > 2) level = 'medium';
    
    // 推荐仓位
    const basePosition = riskParameters?.maxPositionSize || 0.02;
    const adjustedPosition = level === 'high' ? basePosition * 0.5 : basePosition;
    
    // 止损止盈
    const atrMultiplier = 2;
    const stopLoss = currentPrice - atr * atrMultiplier;
    const takeProfit = currentPrice + atr * 1.5;
    
    return {
      level,
      maxDrawdown: riskParameters?.maxDrawdown || 0.1,
      volatilityAssessment: `ATR ${atr.toFixed(2)} (${volatilityPercent.toFixed(2)}%)`,
      recommendedPositionSize: adjustedPosition,
      stopLoss,
      takeProfitLevels: [takeProfit],
    };
  }
  
  private determineAction(riskAnalysis: RiskAnalysis): ActionType {
    return riskAnalysis.level === 'high' ? 'hold' : 'buy';
  }
  
  private calculateSignalStrength(riskAnalysis: RiskAnalysis): number {
    if (riskAnalysis.level === 'high') return 0;
    if (riskAnalysis.level === 'medium') return 25;
    return 50;
  }
  
  private generateReasoning(riskAnalysis: RiskAnalysis): string[] {
    const reasons: string[] = [];
    reasons.push(`风险等级: ${riskAnalysis.level}`);
    reasons.push(`建议仓位: ${(riskAnalysis.recommendedPositionSize * 100).toFixed(1)}%`);
    return reasons;
  }
  
  getStatus(): AgentStatus {
    return {
      name: this.name,
      version: this.version,
      lastRun: this.lastRun,
      errorCount: this.errorCount,
      avgProcessingTime: this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
        : 0,
    };
  }
  
  setUseLLM(use: boolean): void {
    this.useLLM = use;
    logger.info(`RiskAgent LLM mode: ${use ? 'enabled' : 'disabled'}`);
  }
}
