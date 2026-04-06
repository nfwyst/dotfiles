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
import fs from 'fs';

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

  // FIX H3: added optional fields to surface parsing metadata
  /** True when the signal was produced from LLM output parsing */
  _fromLLM?: boolean;
  /** True when parsing fell back to defaults (LLM output could not be parsed) */
  _isDefault?: boolean;
  /** Warning message when parsing fails */
  _parseWarning?: string;
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

请以JSON格式输出，包含以下字段：
\`\`\`json
{
  "direction": "bullish" | "bearish" | "neutral",
  "confidence": 0.0 - 1.0,
  "type": "long" | "short" | "hold" | "wait",
  "reasoning": "...",
  "key_levels": { "support": [...], "resistance": [...] },
  "risk_assessment": "low" | "medium" | "high",
  "entry_price": number,
  "entry_range_min": number,
  "entry_range_max": number,
  "tp1": number, "tp1_prob": number,
  "tp2": number, "tp2_prob": number,
  "tp3": number, "tp3_prob": number,
  "stop_loss": number,
  "position_sizing": "aggressive" | "normal" | "conservative" | "minimal",
  "position_percentage": number,
  "urgency": "immediate" | "soon" | "moderate" | "low",
  "warnings": ["..."],
  "alternatives": ["..."],
  "holding_min": "...",
  "holding_max": "..."
}
\`\`\`
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
      // fs is imported at top level
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
  
  // =====================================================================
  // FIX H3: Complete rewrite of parseLLMResponse.
  //
  // PROBLEM: The original implementation completely ignored the LLM
  // response text parameter. It returned hardcoded values derived only
  // from the strategySignal, making the entire LLM call pointless.
  //
  // FIX: Three-layer parsing strategy:
  //   Layer 1: Structured JSON extraction from the LLM response
  //   Layer 2: Regex-based extraction of key fields as fallback
  //   Layer 3: Clearly-marked default with confidence=0 and warning flag
  // =====================================================================

  /**
   * FIX H3: Extract a JSON object from an LLM response string.
   * Handles JSON embedded in markdown code fences, or bare JSON.
   * Returns null if no valid JSON object is found.
   */
  private extractJSON(text: string): Record<string, any> | null {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return null;
    }

    // Strategy 1: Look for JSON inside ```json ... ``` code fences
    const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = fenceRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]!.trim());
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (_) { /* try next fence */ }
    }

    // Strategy 2: Find the first { ... } block that parses as JSON
    let braceDepth = 0;
    let start = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (braceDepth === 0) start = i;
        braceDepth++;
      } else if (text[i] === '}') {
        braceDepth--;
        if (braceDepth === 0 && start !== -1) {
          try {
            const candidate = text.slice(start, i + 1);
            const parsed = JSON.parse(candidate);
            if (typeof parsed === 'object' && parsed !== null) {
              return parsed;
            }
          } catch (_) { /* continue scanning */ }
          start = -1;
        }
      }
    }

    return null;
  }

  /**
   * FIX H3: Regex-based fallback extraction of key fields from
   * unstructured LLM text. Used when JSON parsing fails.
   */
  private regexExtractFields(text: string): {
    direction?: string;
    confidence?: number;
    type?: string;
    reasoning?: string;
    riskAssessment?: string;
    supportLevels?: number[];
    resistanceLevels?: number[];
    entryPrice?: number;
    stopLoss?: number;
    tp1?: number;
    tp2?: number;
    tp3?: number;
    urgency?: string;
  } {
    const result: Record<string, any> = {};
    const lower = text.toLowerCase();

    // Direction: look for bullish/bearish/neutral keywords
    if (/\b(strongly?\s+)?bullish\b/i.test(text) || /看多|做多|上涨/i.test(text)) {
      result.direction = 'bullish';
    } else if (/\b(strongly?\s+)?bearish\b/i.test(text) || /看空|做空|下跌/i.test(text)) {
      result.direction = 'bearish';
    } else if (/\bneutral\b/i.test(text) || /中性|观望/i.test(text)) {
      result.direction = 'neutral';
    }

    // Type: long/short/hold/wait
    if (/\b(?:recommend|建议|信号|signal)[:\s]*(long|做多)/i.test(text)) {
      result.type = 'long';
    } else if (/\b(?:recommend|建议|信号|signal)[:\s]*(short|做空)/i.test(text)) {
      result.type = 'short';
    } else if (/\b(?:recommend|建议|信号|signal)[:\s]*(hold|持有)/i.test(text)) {
      result.type = 'hold';
    } else if (/\b(?:recommend|建议|信号|signal)[:\s]*(wait|等待|观望)/i.test(text)) {
      result.type = 'wait';
    } else if (result.direction === 'bullish') {
      result.type = 'long';
    } else if (result.direction === 'bearish') {
      result.type = 'short';
    }

    // Confidence: look for percentage or decimal
    const confMatch = text.match(/(?:confidence|置信度|信心)[:\s]*(\d+(?:\.\d+)?)\s*%?/i);
    if (confMatch) {
      let val = parseFloat(confMatch[1]!);
      if (val > 1) val = val / 100; // Convert percentage to decimal
      result.confidence = Math.max(0, Math.min(1, val));
    }

    // Reasoning: grab the first substantial sentence after keywords
    const reasonMatch = text.match(/(?:reasoning|理由|分析|rationale)[:\s]*([^\n]{10,200})/i);
    if (reasonMatch) {
      result.reasoning = reasonMatch[1]!.trim();
    }

    // Risk assessment
    if (/(?:risk|风险)[:\s]*(high|高)/i.test(text)) {
      result.riskAssessment = 'high';
    } else if (/(?:risk|风险)[:\s]*(low|低)/i.test(text)) {
      result.riskAssessment = 'low';
    } else if (/(?:risk|风险)[:\s]*(medium|中)/i.test(text)) {
      result.riskAssessment = 'medium';
    }

    // Price levels: extract numbers near keywords
    const extractPrice = (pattern: RegExp): number | undefined => {
      const m = text.match(pattern);
      if (m) {
        const val = parseFloat(m[1]!.replace(/[,$]/g, ''));
        return isFinite(val) && val > 0 ? val : undefined;
      }
      return undefined;
    };

    result.entryPrice = extractPrice(/(?:entry|入场|建议价)[:\s]*\$?([\d,.]+)/i);
    result.stopLoss = extractPrice(/(?:stop.?loss|止损)[:\s]*\$?([\d,.]+)/i);
    result.tp1 = extractPrice(/(?:tp1|目标1|target\s*1)[:\s]*\$?([\d,.]+)/i);
    result.tp2 = extractPrice(/(?:tp2|目标2|target\s*2)[:\s]*\$?([\d,.]+)/i);
    result.tp3 = extractPrice(/(?:tp3|目标3|target\s*3)[:\s]*\$?([\d,.]+)/i);

    // Support/resistance levels
    const supportMatch = text.match(/(?:support|支撑)[:\s]*([\d,.\s$]+)/i);
    if (supportMatch) {
      result.supportLevels = supportMatch[1]!.match(/[\d.]+/g)?.map(Number).filter(n => n > 0) ?? [];
    }
    const resistMatch = text.match(/(?:resistance|阻力)[:\s]*([\d,.\s$]+)/i);
    if (resistMatch) {
      result.resistanceLevels = resistMatch[1]!.match(/[\d.]+/g)?.map(Number).filter(n => n > 0) ?? [];
    }

    // Urgency
    if (/\b(immediate|立即|马上)\b/i.test(text)) {
      result.urgency = 'immediate';
    } else if (/\b(soon|尽快)\b/i.test(text)) {
      result.urgency = 'soon';
    } else if (/\b(moderate|适中)\b/i.test(text)) {
      result.urgency = 'moderate';
    }

    return result;
  }

  /**
   * FIX H3: Build an LLMTradingSignal from a successfully parsed JSON
   * object, using request data to fill any gaps.
   */
  private buildSignalFromParsedJSON(
    json: Record<string, any>,
    request: LLMAnalysisRequest
  ): LLMTradingSignal {
    const { strategySignal, currentPrice } = request;
    const atr = request.indicators.atr[14];

    // FIX H3: Map direction to type if type not provided directly
    let type: LLMTradingSignal['type'] = 'hold';
    if (json.type && ['long', 'short', 'hold', 'wait'].includes(json.type)) {
      type = json.type;
    } else if (json.direction === 'bullish') {
      type = 'long';
    } else if (json.direction === 'bearish') {
      type = 'short';
    } else if (json.direction === 'neutral') {
      type = 'hold';
    }

    // FIX H3: Parse confidence from LLM output (may be 0-100 or 0-1)
    let confidence = 0.5;
    if (typeof json.confidence === 'number') {
      confidence = json.confidence > 1 ? json.confidence / 100 : json.confidence;
      confidence = Math.max(0, Math.min(1, confidence));
    }

    // FIX H3: Entry price from LLM, fall back to strategy signal
    const entryPrice = (typeof json.entry_price === 'number' && json.entry_price > 0)
      ? json.entry_price
      : strategySignal.entryPrice;

    // FIX H3: Parse urgency
    const validUrgencies = ['immediate', 'soon', 'moderate', 'low'] as const;
    const urgency: LLMTradingSignal['urgency'] =
      validUrgencies.includes(json.urgency) ? json.urgency : (confidence > 0.8 ? 'immediate' : 'moderate');

    // FIX H3: Parse targets from LLM output
    const defaultTp1 = type === 'long' ? currentPrice + atr * 2 : currentPrice - atr * 2;
    const defaultTp2 = type === 'long' ? currentPrice + atr * 3 : currentPrice - atr * 3;
    const defaultTp3 = type === 'long' ? currentPrice + atr * 4 : currentPrice - atr * 4;

    const parsedTp1 = typeof json.tp1 === 'number' && json.tp1 > 0 ? json.tp1 : defaultTp1;
    const parsedTp2 = typeof json.tp2 === 'number' && json.tp2 > 0 ? json.tp2 : defaultTp2;
    const parsedTp3 = typeof json.tp3 === 'number' && json.tp3 > 0 ? json.tp3 : defaultTp3;

    // FIX H3: Parse stop loss from LLM output
    const parsedStopLoss = typeof json.stop_loss === 'number' && json.stop_loss > 0
      ? json.stop_loss
      : strategySignal.stopLoss;

    // FIX H3: Parse position sizing
    const validSizing = ['aggressive', 'normal', 'conservative', 'minimal'] as const;
    const positionRec: LLMTradingSignal['positionSizing']['recommendation'] =
      validSizing.includes(json.position_sizing) ? json.position_sizing : (confidence > 0.8 ? 'normal' : 'conservative');

    const positionPct = typeof json.position_percentage === 'number'
      ? Math.max(0.5, Math.min(10, json.position_percentage))
      : Math.min(5, confidence * 5);

    // FIX H3: Parse reasoning from LLM
    const reasoning: string[] = [];
    if (typeof json.reasoning === 'string' && json.reasoning.length > 0) {
      reasoning.push(`LLM分析: ${json.reasoning}`);
    } else if (Array.isArray(json.reasoning)) {
      reasoning.push(...json.reasoning.map((r: any) => String(r)));
    }
    if (reasoning.length === 0) {
      reasoning.push('LLM分析: 无详细理由');
    }

    // FIX H3: Parse warnings and alternatives
    const warnings: string[] = Array.isArray(json.warnings)
      ? json.warnings.map((w: any) => String(w))
      : ['加密货币市场波动剧烈', '建议严格止损'];
    const alternatives: string[] = Array.isArray(json.alternatives)
      ? json.alternatives.map((a: any) => String(a))
      : ['若错过入场点，等待回调再入场'];

    // FIX H3: Parse holding times
    const holdingMin = typeof json.holding_min === 'string' ? json.holding_min : '4小时';
    const holdingMax = typeof json.holding_max === 'string' ? json.holding_max : '3天';

    return {
      type,
      confidence,
      urgency,
      entry: {
        price: entryPrice,
        range: {
          min: typeof json.entry_range_min === 'number' ? json.entry_range_min : entryPrice - atr * 0.5,
          max: typeof json.entry_range_max === 'number' ? json.entry_range_max : entryPrice + atr * 0.5,
        },
      },
      targets: {
        tp1: {
          price: parsedTp1,
          probability: typeof json.tp1_prob === 'number' ? json.tp1_prob : 0.7,
          rationale: json.tp1_rationale || '基于LLM分析和ATR',
        },
        tp2: {
          price: parsedTp2,
          probability: typeof json.tp2_prob === 'number' ? json.tp2_prob : 0.5,
          rationale: json.tp2_rationale || '次要目标位',
        },
        tp3: {
          price: parsedTp3,
          probability: typeof json.tp3_prob === 'number' ? json.tp3_prob : 0.3,
          rationale: json.tp3_rationale || '最终目标位',
        },
      },
      stopLoss: {
        price: parsedStopLoss,
        rationale: typeof json.stop_loss_rationale === 'string'
          ? json.stop_loss_rationale
          : '基于LLM分析和关键技术位',
        adjustmentCondition: '若价格向有利方向移动1.5个ATR，可移动止损至成本价',
      },
      positionSizing: {
        recommendation: positionRec,
        percentage: positionPct,
        maxRiskPercent: typeof json.max_risk_percent === 'number' ? json.max_risk_percent : 2,
      },
      reasoning,
      warnings,
      alternatives,
      expectedHolding: { min: holdingMin, max: holdingMax },
      _fromLLM: true,
    };
  }

  /**
   * FIX H3: Build an LLMTradingSignal from regex-extracted fields.
   * Used when JSON parsing fails but regex extraction found some data.
   */
  private buildSignalFromRegex(
    fields: ReturnType<LLMAnalysisModule['regexExtractFields']>,
    request: LLMAnalysisRequest
  ): LLMTradingSignal {
    const { strategySignal, currentPrice } = request;
    const atr = request.indicators.atr[14];

    // FIX H3: Derive type from extracted direction or fall back to strategy
    let type: LLMTradingSignal['type'] = strategySignal.type;
    if (fields.type && ['long', 'short', 'hold', 'wait'].includes(fields.type)) {
      type = fields.type as LLMTradingSignal['type'];
    } else if (fields.direction === 'bullish') {
      type = 'long';
    } else if (fields.direction === 'bearish') {
      type = 'short';
    } else if (fields.direction === 'neutral') {
      type = 'hold';
    }

    const confidence = fields.confidence ?? strategySignal.confidence * 0.9;
    const entryPrice = fields.entryPrice ?? strategySignal.entryPrice;
    const stopLoss = fields.stopLoss ?? strategySignal.stopLoss;

    const defaultTp1 = type === 'long' ? currentPrice + atr * 2 : currentPrice - atr * 2;
    const defaultTp2 = type === 'long' ? currentPrice + atr * 3 : currentPrice - atr * 3;
    const defaultTp3 = type === 'long' ? currentPrice + atr * 4 : currentPrice - atr * 4;

    const reasoning: string[] = [];
    if (fields.reasoning) {
      reasoning.push(`LLM分析(regex提取): ${fields.reasoning}`);
    }
    reasoning.push(...strategySignal.reasoning);
    reasoning.push('注: LLM输出未能以JSON解析，使用正则提取关键字段');

    return {
      type,
      confidence,
      urgency: fields.urgency as LLMTradingSignal['urgency'] ?? (confidence > 0.8 ? 'immediate' : 'moderate'),
      entry: {
        price: entryPrice,
        range: {
          min: entryPrice - atr * 0.5,
          max: entryPrice + atr * 0.5,
        },
      },
      targets: {
        tp1: {
          price: fields.tp1 ?? defaultTp1,
          probability: 0.65,
          rationale: '基于LLM文本分析(regex提取)',
        },
        tp2: {
          price: fields.tp2 ?? defaultTp2,
          probability: 0.45,
          rationale: '次要目标位',
        },
        tp3: {
          price: fields.tp3 ?? defaultTp3,
          probability: 0.25,
          rationale: '最终目标位',
        },
      },
      stopLoss: {
        price: stopLoss,
        rationale: '基于LLM文本分析和技术位',
        adjustmentCondition: '若价格向有利方向移动1.5个ATR，可移动止损至成本价',
      },
      positionSizing: {
        recommendation: confidence > 0.8 ? 'normal' : 'conservative',
        percentage: Math.min(5, confidence * 5),
        maxRiskPercent: 2,
      },
      reasoning,
      warnings: [
        '加密货币市场波动剧烈',
        '建议严格止损',
        '注: LLM输出解析为regex模式，精度可能降低',
      ],
      alternatives: [
        '若错过入场点，等待回调再入场',
        '可考虑分批建仓降低风险',
      ],
      expectedHolding: {
        min: '4小时',
        max: '3天',
      },
      _fromLLM: true,
    };
  }

  /**
   * 解析大模型响应
   *
   * FIX H3: Complete rewrite. The original returned hardcoded defaults
   * and never looked at the `response` parameter at all. Now implements
   * a three-layer parsing strategy:
   *
   *   Layer 1 — JSON extraction: Try to find and parse a JSON object
   *             from the LLM response (handles code fences and bare JSON).
   *   Layer 2 — Regex fallback: If JSON parsing fails, extract key
   *             fields (direction, confidence, reasoning, price levels,
   *             risk_assessment) via regex patterns.
   *   Layer 3 — Default fallback: If all parsing fails, return a
   *             clearly marked default with confidence=0 and a warning
   *             flag so downstream consumers know the LLM was unhelpful.
   *
   * All parsing failures are logged for debugging.
   */
  private parseLLMResponse(response: string, request: LLMAnalysisRequest): LLMTradingSignal {
    const { strategySignal, currentPrice } = request;
    const atr = request.indicators.atr[14];

    // ================================================================
    // FIX H3 Layer 1: Structured JSON parsing
    // ================================================================
    if (response && response.trim().length > 0) {
      const json = this.extractJSON(response);
      if (json !== null) {
        // FIX H3: Validate that JSON contains at least one meaningful field
        const hasMeaningfulData =
          json.direction || json.type || json.confidence !== undefined ||
          json.entry_price || json.tp1 || json.stop_loss;

        if (hasMeaningfulData) {
          console.log('[LLM解析] Layer 1 成功: JSON结构化解析');
          return this.buildSignalFromParsedJSON(json, request);
        } else {
          // FIX H3: JSON parsed but has no trading fields — log and fall through
          console.warn('[LLM解析] Layer 1: JSON解析成功但缺少交易字段，尝试regex');
        }
      } else {
        // FIX H3: Log JSON parsing failure for debugging
        console.warn('[LLM解析] Layer 1 失败: 无法提取JSON，尝试regex提取');
      }

      // ==============================================================
      // FIX H3 Layer 2: Regex-based extraction of key fields
      // ==============================================================
      const regexFields = this.regexExtractFields(response);

      // FIX H3: Check if regex extracted at least direction or confidence
      const hasRegexData = regexFields.direction || regexFields.confidence !== undefined ||
        regexFields.type || regexFields.entryPrice;

      if (hasRegexData) {
        console.log('[LLM解析] Layer 2 成功: regex提取到关键字段:', {
          direction: regexFields.direction,
          confidence: regexFields.confidence,
          type: regexFields.type,
        });
        return this.buildSignalFromRegex(regexFields, request);
      } else {
        console.warn('[LLM解析] Layer 2 失败: regex未能提取到有效字段');
      }
    } else {
      // FIX H3: Log empty response
      console.warn('[LLM解析] 收到空的LLM响应');
    }

    // ================================================================
    // FIX H3 Layer 3: Default fallback with confidence=0 and warning
    //
    // This ensures downstream consumers can detect that the LLM
    // analysis was not usable. confidence=0 means "no LLM insight",
    // and _isDefault=true flags it explicitly.
    // ================================================================
    console.warn(
      '[LLM解析] Layer 3: 所有解析层失败，返回带警告标记的默认值。',
      '响应长度:', response?.length ?? 0,
      '响应前200字符:', response?.slice(0, 200) ?? '(empty)'
    );

    return {
      // FIX H3: Use strategy signal type but set confidence to 0
      // so downstream logic knows LLM provided no useful insight.
      type: strategySignal.type,
      confidence: 0,
      urgency: 'low',
      entry: {
        price: strategySignal.entryPrice,
        range: {
          min: strategySignal.entryPrice - atr * 0.5,
          max: strategySignal.entryPrice + atr * 0.5,
        },
      },
      targets: {
        tp1: {
          price: strategySignal.takeProfits?.tp1 || (strategySignal.type === 'long' ? currentPrice + atr * 2 : currentPrice - atr * 2),
          probability: 0.5,
          rationale: '默认值: LLM输出解析失败',
        },
        tp2: {
          price: strategySignal.takeProfits?.tp2 || (strategySignal.type === 'long' ? currentPrice + atr * 3 : currentPrice - atr * 3),
          probability: 0.3,
          rationale: '默认值: LLM输出解析失败',
        },
        tp3: {
          price: strategySignal.takeProfits?.tp3 || (strategySignal.type === 'long' ? currentPrice + atr * 4 : currentPrice - atr * 4),
          probability: 0.15,
          rationale: '默认值: LLM输出解析失败',
        },
      },
      stopLoss: {
        price: strategySignal.stopLoss,
        rationale: '默认止损: LLM输出解析失败，使用策略信号止损',
      },
      positionSizing: {
        recommendation: 'minimal',
        percentage: 1,
        maxRiskPercent: 1,
      },
      reasoning: [
        '⚠ LLM分析输出无法解析',
        '已回退到策略信号基础值',
        '置信度设为0，建议不依赖此信号做交易决策',
      ],
      warnings: [
        '⚠ LLM响应解析失败 — 此信号为默认值，不包含LLM洞察',
        '建议等待下次有效LLM分析后再行动',
        '加密货币市场波动剧烈，建议严格止损',
      ],
      alternatives: [
        '等待下一个分析周期获取有效LLM输出',
        '仅依赖技术指标和策略信号做决策',
      ],
      expectedHolding: {
        min: 'N/A',
        max: 'N/A',
      },
      // FIX H3: Clearly mark this as a default fallback
      _fromLLM: false,
      _isDefault: true,
      _parseWarning: 'All parsing layers failed. This signal uses hardcoded defaults with confidence=0.',
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
    // FIX H3: If the LLM signal is a default fallback (confidence=0, _isDefault),
    // do not boost or modify the strategy signal — just return it as-is with a note.
    if (llmSignal._isDefault || llmSignal.confidence === 0) {
      return {
        ...strategySignal,
        reasoning: [
          ...strategySignal.reasoning,
          '--- LLM分析 ---',
          '⚠ LLM输出解析失败，未融合LLM信号',
        ],
      };
    }

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
