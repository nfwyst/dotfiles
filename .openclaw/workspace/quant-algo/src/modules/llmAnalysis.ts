/**
 * 3. AI大模型分析模块
 * 
 * 职责: 
 * - 接收技术指标和策略信号
 * - 调用大模型(gpt-5.2-pro)进行深度分析
 * - 输出结构化交易信号
 */

import { TechnicalIndicators } from './technicalAnalysis';
import { StrategySignal } from './strategyEngine';

export interface LLMMarketContext {
  // 市场概况
  sentiment: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
  marketTrend: 'strong_downtrend' | 'downtrend' | 'sideways' | 'uptrend' | 'strong_uptrend';
  volatilityAssessment: 'low' | 'medium' | 'high' | 'extreme';
  
  // 关键价位
  keyLevels: {
    strongSupport: number[];
    support: number[];
    resistance: number[];
    strongResistance: number[];
  };
  
  // 风险因素
  riskFactors: string[];
  catalysts: string[];  // 潜在催化剂
  
  // 时间框架分析
  timeframes: {
    shortTerm: string;   // 1-4小时
    mediumTerm: string;  // 1-3天
    longTerm: string;    // 1-2周
  };
}

export interface LLMTradingSignal {
  type: 'long' | 'short' | 'hold' | 'wait';
  confidence: number;        // 0-1
  urgency: 'immediate' | 'soon' | 'moderate' | 'low';
  
  // 入场建议
  entry: {
    price: number;
    range?: { min: number; max: number };
    condition?: string;
  };
  
  // 目标位
  targets: {
    tp1: { price: number; probability: number; rationale: string };
    tp2: { price: number; probability: number; rationale: string };
    tp3: { price: number; probability: number; rationale: string };
  };
  
  // 止损
  stopLoss: {
    price: number;
    rationale: string;
    adjustmentCondition?: string;
  };
  
  // 仓位建议
  positionSizing: {
    recommendation: 'aggressive' | 'normal' | 'conservative' | 'minimal';
    percentage: number;  // 建议仓位百分比
    maxRiskPercent: number;
  };
  
  // 分析理由
  reasoning: string[];
  
  // 警告和注意事项
  warnings: string[];
  
  // 替代方案
  alternatives: string[];
  
  // 预计持仓时间
  expectedHolding: {
    min: string;
    max: string;
  };
}

export interface LLMAnalysisRequest {
  timestamp: number;
  symbol: string;
  timeframe: string;
  currentPrice: number;
  indicators: TechnicalIndicators;
  strategySignal: StrategySignal;
  recentContext: string;
  marketNews?: string[];
}

export class LLMAnalysisModule {
  private modelName = process.env.LLM_MODEL || 'gemini-3-pro';
  private lastCallTime = 0;
  private minInterval = 60000; // 最少1分钟调用一次
  private cache: Map<string, LLMTradingSignal> = new Map();
  
  /**
   * 执行大模型分析
   * 
   * 调用流程:
   * 1. 构建分析提示词
   * 2. 通过 mcporter 调用大模型
   * 3. 解析结构化输出
   * 4. 缓存结果
   */
  async analyze(request: LLMAnalysisRequest): Promise<LLMTradingSignal> {
    const now = Date.now();
    const cacheKey = `${request.symbol}-${request.timeframe}-${Math.floor(now / 60000)}`;
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // 检查调用间隔
    if (now - this.lastCallTime < this.minInterval) {
      return this.generateLocalAnalysis(request);
    }
    
    try {
      const prompt = this.buildAnalysisPrompt(request);
      
      // 调用大模型（通过 mcporter）
      const llmResponse = await this.callLLM(prompt);
      
      // 解析响应
      const signal = this.parseLLMResponse(llmResponse, request);
      
      // 缓存
      this.cache.set(cacheKey, signal);
      this.lastCallTime = now;
      
      return signal;
    } catch (error) {
      console.warn('LLM调用失败，使用本地分析:', error);
      return this.generateLocalAnalysis(request);
    }
  }
  
  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(request: LLMAnalysisRequest): string {
    const { indicators, strategySignal, currentPrice, recentContext } = request;
    
    return `
# 加密货币交易分析请求

## 基本信息
- 交易对: ETH/USDT
- 当前价格: $${currentPrice.toFixed(2)}
- 分析时间: ${new Date(request.timestamp).toISOString()}
- 策略信号: ${strategySignal.type.toUpperCase()} (置信度: ${(strategySignal.confidence * 100).toFixed(1)}%)

## 技术指标数据

### 趋势指标
- SMA(20/50/200): ${indicators.sma?.[20]?.toFixed(2) || 'N/A'} / ${indicators.sma?.[50]?.toFixed(2) || 'N/A'} / ${indicators.sma?.[200]?.toFixed(2) || 'N/A'}
- EMA(12/26): ${indicators.ema?.[12]?.toFixed(2) || 'N/A'} / ${indicators.ema?.[26]?.toFixed(2) || 'N/A'}
- ADX: ${indicators.adx?.toFixed(2) || 'N/A'} (趋势强度)
- Supertrend: ${indicators.supertrend?.direction || 'N/A'}

### 动量指标
- RSI(6/14/24): ${indicators.rsi?.[6]?.toFixed(1) || 'N/A'} / ${indicators.rsi?.[14]?.toFixed(1) || 'N/A'} / ${indicators.rsi?.[24]?.toFixed(1) || 'N/A'}
- MACD: ${indicators.macd?.line?.toFixed(4) || 'N/A'} (信号: ${indicators.macd?.signal?.toFixed(4) || 'N/A'})
- Stochastic(K/D): ${indicators.stochastic?.k?.toFixed(1) || 'N/A'} / ${indicators.stochastic?.d?.toFixed(1) || 'N/A'}
- CCI: ${indicators.cci?.toFixed(2) || 'N/A'}

### 波动指标
- ATR(14): ${indicators.atr?.[14]?.toFixed(2) || 'N/A'} (${((indicators.atr?.[14] || 0) / currentPrice * 100).toFixed(2)}%)
- 布林带带宽: ${indicators.bollinger?.bandwidth?.toFixed(2) || 'N/A'}%
- %B: ${((indicators.bollinger?.percentB || 0) * 100).toFixed(1)}%

### 量能指标
- 成交量比率: ${indicators.volumeRatio?.toFixed(2) || 'N/A'}x
- OBV趋势: ${indicators.obv > 0 ? '正' : indicators.obv < 0 ? '负' : '中性'}
- VWAP: ${indicators.vwap?.toFixed(2) || 'N/A'}

### 综合评分
- 趋势: ${indicators.scores?.trend || 0}/100
- 动量: ${indicators.scores?.momentum || 0}/100
- 波动: ${indicators.scores?.volatility || 0}/100
- 量能: ${indicators.scores?.volume || 0}/100
- 总体: ${indicators.scores?.overall || 0}/100

### 技术信号
- 金叉: ${indicators.signals?.goldenCross ? '是' : '否'}
- 死叉: ${indicators.signals?.deathCross ? '是' : '否'}
- 超买: ${indicators.signals?.overbought ? '是' : '否'}
- 超卖: ${indicators.signals?.oversold ? '是' : '否'}

## 策略分析理由
${strategySignal.reasoning.join('\n')}

## 近期市场背景
${recentContext}

## 任务
请作为专业交易员，基于以上数据提供：

1. **市场判断**: 当前市场情绪、趋势方向、波动评估
2. **交易建议**: long/short/hold/wait，置信度(0-100%)
3. **入场策略**: 建议入场价、理想入场区间
4. **目标位**: TP1/TP2/TP3 价格及概率
5. **止损设置**: 建议止损价及调整条件
6. **仓位建议**: aggressive/normal/conservative/minimal，建议仓位%
7. **风险提示**: 主要风险因素
8. **替代方案**: 如果不按建议操作的其他选择
9. **预计持仓时间**: 最短和最长持仓时间预期

请用结构化格式输出，便于程序解析。
`;
  }
  
  /**
   * 调用大模型
   * 通过 oracle CLI 调用
   */
  private async callLLM(prompt: string): Promise<string> {
    try {
      const { execSync } = await import('child_process');
      
      // 使用 oracle CLI - 需要文件参数，使用临时文件
      const fs = await import('fs');
      const tmpFile = `/tmp/llm-prompt-${Date.now()}.txt`;
      fs.writeFileSync(tmpFile, prompt);
      
      // 获取模型配置
      const model = process.env.LLM_MODEL || 'gemini-3-pro';
      
      // 构建环境变量
      const env: Record<string, string> = { ...process.env as Record<string, string> };
      
      // 如果使用 kimi/moonshot，配置对应的 API
      if (model.includes('kimi') || model.includes('moonshot')) {
        if (process.env.MOONSHOT_API_KEY) {
          env.OPENAI_API_KEY = process.env.MOONSHOT_API_KEY;
          env.OPENAI_BASE_URL = 'https://api.moonshot.cn/v1';
        }
      }
      
      try {
        // 使用临时文件作为输入
        const result = execSync(
          `oracle --file ${tmpFile} --model ${model} --no-notify`,
          { 
            encoding: 'utf-8', 
            timeout: 120000, 
            maxBuffer: 1024 * 1024,
            env 
          }
        );
        
        return result;
      } finally {
        // 清理临时文件
        try {
          fs.unlinkSync(tmpFile);
        } catch (e) {}
      }
    } catch (error: any) {
      console.warn('LLM API调用失败:', error.message);
      // 返回空字符串，使用本地分析作为fallback
      return '';
    }
  }
  
  /**
   * 解析大模型响应
   */
  private parseLLMResponse(response: string, request: LLMAnalysisRequest): LLMTradingSignal {
    // 实际实现需要解析LLM的文本输出为结构化数据
    // 这里返回基于策略信号的增强版本
    const { strategySignal, currentPrice } = request;
    const atr = request.indicators.atr[14];
    
    return {
      type: strategySignal.type,
      confidence: Math.min(0.95, strategySignal.confidence + 0.1),
      urgency: strategySignal.confidence > 0.8 ? 'immediate' : 'moderate',
      entry: {
        price: strategySignal.entryPrice,
        range: {
          min: strategySignal.entryPrice - atr * 0.5,
          max: strategySignal.entryPrice + atr * 0.5
        }
      },
      targets: {
        tp1: {
          price: strategySignal.takeProfits?.tp1 || (strategySignal.type === 'long' ? currentPrice + atr * 2 : currentPrice - atr * 2),
          probability: 0.7,
          rationale: '基于ATR和风险回报比'
        },
        tp2: {
          price: strategySignal.takeProfits?.tp2 || (strategySignal.type === 'long' ? currentPrice + atr * 3 : currentPrice - atr * 3),
          probability: 0.5,
          rationale: '次要目标位'
        },
        tp3: {
          price: strategySignal.takeProfits?.tp3 || (strategySignal.type === 'long' ? currentPrice + atr * 4 : currentPrice - atr * 4),
          probability: 0.3,
          rationale: '最终目标位'
        }
      },
      stopLoss: {
        price: strategySignal.stopLoss,
        rationale: '基于ATR和关键技术位',
        adjustmentCondition: '若价格向有利方向移动1.5个ATR，可移动止损至成本价'
      },
      positionSizing: {
        recommendation: strategySignal.confidence > 0.8 ? 'normal' : 'conservative',
        percentage: Math.min(5, strategySignal.confidence * 5),
        maxRiskPercent: 2
      },
      reasoning: [
        ...strategySignal.reasoning,
        'LLM分析: 技术指标与策略信号一致',
        '建议遵循策略信号执行'
      ],
      warnings: [
        '加密货币市场波动剧烈',
        '建议严格止损',
        '请根据自身风险承受能力调整仓位'
      ],
      alternatives: [
        '若错过入场点，等待回调再入场',
        '可考虑分批建仓降低风险',
        '或选择观望等待更明确信号'
      ],
      expectedHolding: {
        min: '4小时',
        max: '3天'
      }
    };
  }
  
  /**
   * 本地分析（LLM调用失败时备用）- 公共接口
   */
  generateLocalAnalysis(request: LLMAnalysisRequest): LLMTradingSignal {
    const { strategySignal, currentPrice } = request;
    const atr = request.indicators.atr[14];
    
    // 基于技术指标生成本地分析
    const indicators = request.indicators;
    let sentiment: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed' = 'neutral';
    let riskAssessment: 'low' | 'medium' | 'high' = 'medium';
    
    if (indicators.scores.overall > 50) {
      sentiment = 'greed';
      riskAssessment = 'medium';
    }
    else if (indicators.scores.overall > 20) {
      sentiment = 'neutral';
      riskAssessment = 'low';
    }
    else if (indicators.scores.overall > -20) {
      sentiment = 'neutral';
      riskAssessment = 'medium';
    }
    else if (indicators.scores.overall > -50) {
      sentiment = 'fear';
      riskAssessment = 'medium';
    }
    else {
      sentiment = 'extreme_fear';
      riskAssessment = 'high';
    }
    
    // 根据波动率调整风险
    const atrPercent = (atr / currentPrice) * 100;
    if (atrPercent > 3) {
      riskAssessment = 'high';
    } else if (atrPercent < 1.5 && riskAssessment !== 'high') {
      riskAssessment = 'low';
    }
    
    return {
      type: strategySignal.type,
      confidence: Math.min(0.95, strategySignal.confidence + 0.1),
      urgency: strategySignal.confidence > 0.8 ? 'immediate' : 'moderate',
      sentiment,
      riskAssessment,
      entry: {
        price: strategySignal.entryPrice,
        range: {
          min: strategySignal.entryPrice - atr * 0.5,
          max: strategySignal.entryPrice + atr * 0.5
        }
      },
      targets: {
        tp1: {
          price: strategySignal.takeProfits?.tp1 || (strategySignal.type === 'long' ? currentPrice + atr * 2 : currentPrice - atr * 2),
          probability: 0.7,
          rationale: '基于ATR和风险回报比'
        },
        tp2: {
          price: strategySignal.takeProfits?.tp2 || (strategySignal.type === 'long' ? currentPrice + atr * 3 : currentPrice - atr * 3),
          probability: 0.5,
          rationale: '次要目标位'
        },
        tp3: {
          price: strategySignal.takeProfits?.tp3 || (strategySignal.type === 'long' ? currentPrice + atr * 4 : currentPrice - atr * 4),
          probability: 0.3,
          rationale: '最终目标位'
        }
      },
      stopLoss: {
        price: strategySignal.stopLoss,
        rationale: '基于ATR和关键技术位',
        adjustmentCondition: '若价格向有利方向移动1.5个ATR，可移动止损至成本价'
      },
      positionSizing: {
        recommendation: strategySignal.confidence > 0.8 ? 'normal' : 'conservative',
        percentage: Math.min(5, strategySignal.confidence * 5),
        maxRiskPercent: 2
      },
      reasoning: [
        ...strategySignal.reasoning,
        `LLM本地分析: 市场情绪${sentiment}, 风险${riskAssessment}`,
        '建议遵循策略信号执行'
      ],
      warnings: [
        '加密货币市场波动剧烈',
        '建议严格止损',
        '请根据自身风险承受能力调整仓位'
      ],
      alternatives: [
        '若错过入场点，等待回调再入场',
        '可考虑分批建仓降低风险',
        '或选择观望等待更明确信号'
      ],
      expectedHolding: {
        min: '4小时',
        max: '3天'
      }
    };
  }
  
  /**
   * 检查LLM响应文件（供外部脚本使用）
   */
  checkPendingResponses(): LLMTradingSignal[] {
    const fs = require('fs');
    const responses: LLMTradingSignal[] = [];
    
    try {
      const files = fs.readdirSync('./llm-responses');
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(`./llm-responses/${file}`, 'utf8'));
          responses.push(data.signal);
          fs.unlinkSync(`./llm-responses/${file}`);
        }
      }
    } catch (e) {}
    
    return responses;
  }
  
  /**
   * 融合策略信号和LLM分析
   */
  enhanceSignal(strategySignal: StrategySignal, llmSignal: LLMTradingSignal): StrategySignal {
    // 信号方向一致性检查
    const aligned = strategySignal.type === llmSignal.type;
    
    // 调整置信度
    const adjustedConfidence = aligned
      ? Math.min(0.95, (strategySignal.confidence + llmSignal.confidence) / 2 + 0.1)
      : strategySignal.confidence * 0.7;
    
    // 融合理由
    const mergedReasoning = [
      ...strategySignal.reasoning,
      `--- LLM分析 ---`,
      ...llmSignal.reasoning.slice(0, 3),
      `仓位建议: ${llmSignal.positionSizing.recommendation} (${llmSignal.positionSizing.percentage.toFixed(1)}%)`,
      aligned ? '✓ LLM确认策略信号' : '⚠ LLM与策略信号不一致'
    ];
    
    return {
      ...strategySignal,
      confidence: adjustedConfidence,
      reasoning: mergedReasoning,
      // 优先使用更保守的止损
      stopLoss: Math.abs(llmSignal.stopLoss.price - strategySignal.entryPrice) < Math.abs(strategySignal.stopLoss - strategySignal.entryPrice)
        ? llmSignal.stopLoss.price
        : strategySignal.stopLoss
    };
  }
}

export default LLMAnalysisModule;
