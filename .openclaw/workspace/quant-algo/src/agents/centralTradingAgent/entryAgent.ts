/**
 * 入场时机 Agent
 * 专注于识别最佳入场点
 * 
 * 细粒度任务：只判断"何时入场"，不判断"是否入场"
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
  EntryAgentOutput,
  ActionType,
  Urgency,
} from './types';

import { TechnicalReport, SupportResistanceLevel } from '../marketIntelligence/types';
import { isLLMEntryResponse } from '../../utils/typeGuards';
import { LLMClient } from '../../ai/LLMClient';

import logger from '../../logger';

// ==================== Entry evaluation types ====================

/** Internal entry evaluation result */
interface EntryEvaluation {
  action: ActionType;
  confidence: number;
  reasoning: string[];
  priceRange: {
    min: number;
    max: number;
    optimal: number;
  };
  riskRewardRatio: number;
  urgency: Urgency;
  confirmations: string[];
}

/** LLM response shape for entry analysis */
interface LLMEntryResponse {
  action: ActionType;
  signalStrength: number;
  confidence: number;
  urgency: Urgency;
  reasoning: string[];
}

export class EntryAgent implements DecisionAgent {
  readonly name = 'EntryAgent';
  readonly version = '2.1.0';
  
  private lastRun: number = 0;
  private errorCount: number = 0;
  private processingTimes: number[] = [];
  private useLLM: boolean = true;
  
  async analyze(context: DecisionContext): Promise<AgentOutput> {
    const startTime = Date.now();
    
    try {
      const { marketIntelligence, currentPrice, hasPosition } = context;
      const technical = marketIntelligence.technical;
      
      if (!technical) {
        return {
          success: false,
          error: 'Technical report not available',
          processingTimeMs: Date.now() - startTime,
        };
      }
      
      // 如果已有持仓，不建议新入场
      if (hasPosition) {
        return {
          success: true,
          data: this.createHoldOutput('已有持仓，等待出场信号'),
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
        
        logger.warn(`⚠️ EntryAgent LLM failed, fallback to code: ${llmResult.error}`);
      }
      
      // Fallback: 纯代码分析
      const codeResult = this.analyzeWithCode(technical, currentPrice);
      
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
  private async analyzeWithLLM(technical: TechnicalReport, currentPrice: number): Promise<AgentOutput> {
    const llm = LLMClient.getInstance();
    const systemPrompt = `你是一个专业的入场时机分析专家。
你的任务是判断当前是否是好的入场点。

输出 JSON 格式:
{
  "action": "buy" | "sell" | "hold",
  "signalStrength": -100 到 100,
  "confidence": 0-1,
  "urgency": "high" | "medium" | "low",
  "reasoning": ["原因1", "原因2"]
}`;

    const supportLevels = technical.supportResistance.levels
      .filter((l: SupportResistanceLevel) => l.type === 'support')
      .map((s: SupportResistanceLevel) => s.price.toFixed(2))
      .join(', ') || technical.supportResistance.nearestSupport?.toFixed(2) || 'N/A';
    
    const resistanceLevels = technical.supportResistance.levels
      .filter((l: SupportResistanceLevel) => l.type === 'resistance')
      .map((r: SupportResistanceLevel) => r.price.toFixed(2))
      .join(', ') || technical.supportResistance.nearestResistance?.toFixed(2) || 'N/A';

    const userPrompt = `分析以下市场数据，判断入场时机:

市场数据:
- 当前价格: ${currentPrice.toFixed(2)}
- RSI: ${technical.momentum.rsi.value.toFixed(1)} (超卖<30, 超买>70)
- MACD 柱状图: ${technical.momentum.macd.histogram.toFixed(2)}
- ATR (波动率): ${technical.volatility.atr?.toFixed(2) || 'N/A'}
- 成交量比率: ${technical.volume.volumeRatio?.toFixed(2) || 'N/A'}
- 支撑位: ${supportLevels}
- 阻力位: ${resistanceLevels}

请综合分析，判断是否应该入场。如果 RSI 在 30-55 且趋势向上，可以考虑做多；如果 RSI >= 85，可以考虑做空。`;

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
        processingTimeMs: 0,
      };
    }

    if (!resultContent) {
      return {
        success: false,
        error: 'Empty response',
        processingTimeMs: 0,
      };
    }
    
    try {
      const rawParsed: unknown = JSON.parse(resultContent);
      if (!rawParsed || typeof rawParsed !== 'object') {
        return { success: false, error: 'Invalid JSON response', processingTimeMs: 0 };
      }
      if (!isLLMEntryResponse(rawParsed)) {
        return { success: false, error: 'LLM response does not match LLMEntryResponse shape', processingTimeMs: 0 };
      }
      const parsed = rawParsed;
      
      const output: EntryAgentOutput = {
        agentName: 'EntryAgent',
        entry: {
          action: parsed.action,
          priceRange: {
            min: currentPrice * 0.999,
            max: currentPrice * 1.001,
            optimal: currentPrice,
          },
          riskRewardRatio: 2,
          urgency: parsed.urgency,
          confirmations: parsed.reasoning,
        },
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        suggestedAction: parsed.action,
        signalStrength: parsed.signalStrength,
      };
      
      logger.info(`🤖 EntryAgent (LLM): ${parsed.action} (signal: ${parsed.signalStrength}), confidence: ${(parsed.confidence * 100).toFixed(0)}%`);
      
      return {
        success: true,
        data: output,
        processingTimeMs: 0,
      };
      
    } catch (parseError: unknown) {
      return {
        success: false,
        error: `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        processingTimeMs: 0,
      };
    }
  }
  
  /**
   * Fallback: 纯代码分析
   */
  private analyzeWithCode(technical: TechnicalReport, currentPrice: number): AgentOutput {
    const entry = this.evaluateEntry(technical, currentPrice);
    const suggestedAction = entry.action;
    const signalStrength = this.calculateSignalStrength(entry);
    
    const output: EntryAgentOutput = {
      agentName: 'EntryAgent',
      entry,
      confidence: entry.confidence,
      reasoning: entry.reasoning,
      suggestedAction,
      signalStrength,
    };
    
    logger.info(`📊 EntryAgent (Code): ${entry.action}`);
    
    return {
      success: true,
      data: output,
      processingTimeMs: 0,
    };
  }
  
  private evaluateEntry(technical: TechnicalReport, currentPrice: number): EntryEvaluation {
    const rsi = technical.momentum.rsi.value;
    const macd = technical.momentum.macd;
    const volume = technical.volume;
    
    let action: ActionType = 'hold';
    let confidence = 0.3;
    const reasoning: string[] = [];
    
    // 做多条件
    if (rsi >= 30 && rsi <= 55 && technical.trend.direction === 'up') {
      action = 'buy';
      confidence = 0.6;
      reasoning.push('RSI 在做多区间 (30-55)');
      reasoning.push('趋势向上');
    }
    // 做空条件
    else if (rsi >= 85) {
      action = 'sell';
      confidence = 0.5;
      reasoning.push('RSI 严重超买 (>= 85)');
    }
    // 观望
    else {
      reasoning.push('不满足入场条件');
    }
    
    return {
      action,
      confidence,
      reasoning,
      priceRange: {
        min: currentPrice * 0.999,
        max: currentPrice * 1.001,
        optimal: currentPrice,
      },
      riskRewardRatio: 2,
      urgency: 'medium',
      confirmations: reasoning,
    };
  }
  
  private calculateSignalStrength(entry: EntryEvaluation): number {
    if (entry.action === 'buy') return 50 * entry.confidence;
    if (entry.action === 'sell') return -50 * entry.confidence;
    return 0;
  }
  
  private createHoldOutput(reason: string): EntryAgentOutput {
    return {
      agentName: 'EntryAgent',
      entry: {
        action: 'hold',
        priceRange: { min: 0, max: 0, optimal: 0 },
        riskRewardRatio: 0,
        urgency: 'low',
        confirmations: [reason],
      },
      confidence: 0.3,
      reasoning: [reason],
      suggestedAction: 'hold',
      signalStrength: 0,
    };
  }
  
  getStatus(): AgentStatus {
    return {
      healthy: this.errorCount < 10,
      lastRun: this.lastRun,
      errorCount: this.errorCount,
      avgProcessingTimeMs: this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
        : 0,
    };
  }
  
  setUseLLM(use: boolean): void {
    this.useLLM = use;
    logger.info(`EntryAgent LLM mode: ${use ? 'enabled' : 'disabled'}`);
  }
}
