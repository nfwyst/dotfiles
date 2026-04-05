/**
 * 趋势分析 Agent
 * 专注于识别趋势方向和强度
 * 
 * 细粒度任务：不做"分析市场"，只做"判断趋势"
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
  TrendAgentOutput,
  ActionType,
} from './types';

import { TechnicalReport } from '../marketIntelligence/types';
import { getLLMClient } from './llmClient';

import logger from '../../logger';

export class TrendAgent implements DecisionAgent {
  readonly name = 'TrendAgent';
  readonly version = '2.1.0';
  
  private lastRun: number = 0;
  private errorCount: number = 0;
  private processingTimes: number[] = [];
  private useLLM: boolean = true;  // 默认使用 LLM
  
  async analyze(context: DecisionContext): Promise<AgentOutput> {
    const startTime = Date.now();
    
    try {
      const { marketIntelligence, currentPrice } = context;
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
        const llmResult = await this.analyzeWithLLM(technical, currentPrice);
        if (llmResult.success) {
          this.lastRun = Date.now();
          this.processingTimes.push(Date.now() - startTime);
          return llmResult;
        }
        
        // LLM 失败，fallback 到纯代码
        logger.warn(`⚠️ TrendAgent LLM failed, fallback to code: ${llmResult.error}`);
      }
      
      // Fallback: 纯代码分析
      const codeResult = this.analyzeWithCode(technical);
      
      this.lastRun = Date.now();
      this.processingTimes.push(Date.now() - startTime);
      
      return codeResult;
      
    } catch (error: any) {
      this.errorCount++;
      return {
        success: false,
        error: error.message,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
  
  /**
   * LLM 模式分析
   */
  private async analyzeWithLLM(technical: TechnicalReport, currentPrice: number): Promise<AgentOutput> {
    const llm = getLLMClient();
    
    if (!llm.isAvailable()) {
      return {
        success: false,
        error: 'DeepSeek API not available',
      };
    }
    
    const systemPrompt = `你是一个专业的趋势分析专家。
你的任务是分析市场数据并判断趋势方向和强度。

输出 JSON 格式:
{
  "direction": "up" | "down" | "sideways",
  "strength": 0-100,
  "persistence": "strong" | "moderate" | "weak",
  "reversalRisk": 0-100,
  "confidence": 0-1,
  "reasoning": ["原因1", "原因2"]
}`;

    const userPrompt = `分析以下市场数据，判断趋势:

市场数据:
- 当前价格: ${currentPrice.toFixed(2)}
- RSI: ${technical.momentum.rsi.value.toFixed(1)}
- MACD 柱状图: ${technical.momentum.macd.histogram.toFixed(2)}
- SMA20: ${technical.trend.sma20?.toFixed(2) || 'N/A'}
- SMA50: ${technical.trend.sma50?.toFixed(2) || 'N/A'}
- ADX: ${technical.trend.adx?.toFixed(1) || 'N/A'}
- 趋势方向 (技术分析): ${technical.trend.direction}
- 趋势强度 (技术分析): ${technical.trend.strength}

请综合分析以上数据，输出趋势判断。`;

    const result = await llm.chat(systemPrompt, userPrompt, true);
    
    if (!result.success || !result.content) {
      return {
        success: false,
        error: result.error || 'Empty response',
      };
    }
    
    try {
      const parsed = JSON.parse(result.content);
      
      // 确定建议行动
      const suggestedAction = this.determineActionFromLLM(parsed);
      const signalStrength = this.calculateSignalStrengthFromLLM(parsed);
      
      const output: TrendAgentOutput = {
        agentName: 'TrendAgent',
        trend: {
          direction: parsed.direction,
          strength: parsed.strength,
          persistence: parsed.persistence,
          reversalRisk: parsed.reversalRisk,
        },
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        suggestedAction,
        signalStrength,
      };
      
      logger.info(`🤖 TrendAgent (LLM): ${parsed.direction} (${parsed.strength}%), confidence: ${(parsed.confidence * 100).toFixed(0)}%`);
      
      return {
        success: true,
        data: output,
        processingTimeMs: 0,
      };
      
    } catch (parseError: any) {
      return {
        success: false,
        error: `JSON parse error: ${parseError.message}`,
      };
    }
  }
  
  /**
   * Fallback: 纯代码分析
   */
  private analyzeWithCode(technical: TechnicalReport): AgentOutput {
    const trendAnalysis = this.analyzeTrend(technical);
    const suggestedAction = this.determineAction(trendAnalysis);
    const signalStrength = this.calculateSignalStrength(trendAnalysis);
    
    const output: TrendAgentOutput = {
      agentName: 'TrendAgent',
      trend: trendAnalysis,
      confidence: this.calculateConfidence(technical),
      reasoning: this.generateReasoning(trendAnalysis, technical),
      suggestedAction,
      signalStrength,
    };
    
    logger.info(`📊 TrendAgent (Code): ${trendAnalysis.direction} (${trendAnalysis.strength}%)`);
    
    return {
      success: true,
      data: output,
      processingTimeMs: 0,
    };
  }
  
  /**
   * 从 LLM 结果确定建议行动
   */
  private determineActionFromLLM(parsed: any): ActionType {
    if (parsed.direction === 'up' && parsed.strength > 50) return 'buy';
    if (parsed.direction === 'down' && parsed.strength > 50) return 'sell';
    return 'hold';
  }
  
  /**
   * 从 LLM 结果计算信号强度
   */
  private calculateSignalStrengthFromLLM(parsed: any): number {
    const base = parsed.direction === 'up' ? 1 : parsed.direction === 'down' ? -1 : 0;
    return base * parsed.strength;
  }
  
  /**
   * 纯代码趋势分析
   */
  private analyzeTrend(technical: TechnicalReport): any {
    return {
      direction: technical.trend.direction,
      strength: technical.trend.strength,
      persistence: technical.trend.strength > 60 ? 'strong' : 'moderate',
      reversalRisk: 30,
    };
  }
  
  private determineAction(trendAnalysis: any): ActionType {
    if (trendAnalysis.direction === 'up' && trendAnalysis.strength > 50) return 'buy';
    if (trendAnalysis.direction === 'down' && trendAnalysis.strength > 50) return 'sell';
    return 'hold';
  }
  
  private calculateSignalStrength(trendAnalysis: any): number {
    const base = trendAnalysis.direction === 'up' ? 1 : trendAnalysis.direction === 'down' ? -1 : 0;
    return base * trendAnalysis.strength;
  }
  
  private calculateConfidence(technical: TechnicalReport): number {
    return technical.trend.strength / 100;
  }
  
  private generateReasoning(trendAnalysis: any, technical: TechnicalReport): string[] {
    const reasons: string[] = [];
    reasons.push(`趋势${trendAnalysis.direction === 'up' ? '向上' : trendAnalysis.direction === 'down' ? '向下' : '横盘'}`);
    reasons.push(`强度 ${trendAnalysis.strength}%`);
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
    logger.info(`TrendAgent LLM mode: ${use ? 'enabled' : 'disabled'}`);
  }
}
