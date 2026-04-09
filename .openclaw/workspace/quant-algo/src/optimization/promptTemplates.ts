/**
 * Prompt 模板定义
 * 模板分离：静态指令 (可优化) vs 动态内容 (固定)
 * 
 * 基于 ATLAS 论文的设计原则
 */

// ==================== 静态指令模板 ====================

/**
 * 默认静态指令
 * 这部分会被 Adaptive-OPRO 优化
 */
export const DEFAULT_STATIC_INSTRUCTIONS = `
## 核心交易原则

1. **趋势优先**: 只在趋势方向交易，避免逆势操作
2. **风险控制**: 每笔交易风险不超过账户的 2%
3. **分批止盈**: 使用三层止盈策略 (30%, 40%, 30%)
4. **顺势加仓**: 只在盈利时加仓，绝不亏损加仓

## 入场规则

- 等待确认信号，不追高杀跌
- 检查多时间框架一致性
- 成交量必须配合价格变动
- RSI 不在极端区域 (30-70)

## 出场规则

- 严格执行止损，不移动止损到亏损位置
- 第一止盈位部分平仓锁定利润
- 追踪止损保护剩余利润
`;

/**
 * 优化器元提示
 * 用于指导 LLM 优化 Prompt
 */
export const OPTIMIZER_META_PROMPT = `
你是一个交易策略优化专家。你的任务是分析当前 Prompt 的性能并提议改进。

## 背景信息
当前系统是一个 ETH 自动交易系统，使用 LLM 进行决策。
每 5 天会评估性能并根据结果优化 Prompt。

## 你的任务
1. 分析性能指标，识别当前 Prompt 的问题
2. 提出具体的改进建议
3. 预期改进的效果

## 优化原则
- 改进应该是有针对性的，解决识别出的问题
- 避免过度复杂化，保持指令清晰
- 考虑市场状态的多样性
- 优先处理风险控制问题

## 输出格式
必须输出有效的 JSON:
{
  "diagnosis": "问题诊断 (1-2 句话)",
  "proposedChanges": "具体的改进内容 (替换原有指令的相关部分)",
  "expectedImpact": "预期效果",
  "confidence": 0.0-1.0
}
`;

// ==================== 动态内容模板 ====================

/**
 * 动态内容模板
 * 这部分是固定的，运行时注入数据
 */
export const DYNAMIC_CONTENT_TEMPLATE = `
## 当前市场数据

### 价格信息
- 当前价格: {CURRENT_PRICE}
- 24h 最高: {HIGH_24H}
- 24h 最低: {LOW_24H}
- 24h 涨跌: {CHANGE_24H}%

### 技术指标
- RSI (14): {RSI_14}
- MACD: {MACD_HISTOGRAM}
- ATR: {ATR}
- 布林带位置: {BOLLINGER_POSITION}

### 趋势分析
- 主导趋势: {TREND_DIRECTION}
- 趋势强度: {TREND_STRENGTH}%
- 波动率状态: {VOLATILITY_STATE}

## 持仓状态
- 当前持仓: {CURRENT_POSITION}
- 入场价格: {ENTRY_PRICE}
- 浮动盈亏: {UNREALIZED_PNL} USDT
- 持仓时间: {HOLD_TIME}

## 账户信息
- 可用余额: {BALANCE} USDT
- 今日盈亏: {TODAY_PNL} USDT
- 最大回撤: {MAX_DRAWDOWN}%

## 分析师报告摘要

### 技术分析
{TECHNICAL_SUMMARY}

### 情绪分析
{SENTIMENT_SUMMARY}

### 链上数据
{ONCHAIN_SUMMARY}

## 近期交易历史
{RECENT_TRADES}

## 性能指标 (最近 5 天)
- 累计收益: {ROI_5D}%
- 胜率: {WIN_RATE}%
- 最大回撤: {MAX_DRAWDOWN_5D}%
- 交易次数: {TRADE_COUNT}

## 决策要求

基于以上信息，做出交易决策。

输出 JSON 格式:
{
  "thinking": "思考过程 (分析各因素)",
  "finalDecision": {
    "action": "buy" | "sell" | "hold",
    "confidence": 0.0-1.0,
    "positionSize": 0.0-1.0,
    "reasoning": ["原因1", "原因2", ...]
  },
  "riskAssessment": {
    "level": "low" | "medium" | "high",
    "maxLoss": number,
    "stopLoss": number,
    "takeProfits": [number, number, number]
  }
}
`;

// ==================== 组合函数 ====================

/**
 * 组合完整 Prompt
 */
export function composePrompt(
  staticInstructions: string,
  dynamicData: Record<string, unknown>
): string {
  let dynamicContent = DYNAMIC_CONTENT_TEMPLATE;
  
  // 替换占位符
  for (const [key, value] of Object.entries(dynamicData)) {
    const placeholder = `{${key}}`;
    dynamicContent = dynamicContent.replace(
      new RegExp(placeholder, 'g'),
      String(value ?? 'N/A')
    );
  }
  
  return `${staticInstructions}\n${dynamicContent}`;
}

/**
 * 提取静态指令中的可优化部分
 */
export function extractOptimizableParts(staticInstructions: string): string[] {
  // 按段落分割
  const lines = staticInstructions.split('\n').filter(l => l.trim());
  return lines.filter(l => 
    l.startsWith('-') || 
    l.match(/^\d+\./) ||
    l.includes(':')
  );
}

/**
 * 验证 Prompt 模板完整性
 */
export function validatePromptTemplate(
  newPrompt: string,
  requiredPlaceholders: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const placeholder of requiredPlaceholders) {
    if (!newPrompt.includes(`{${placeholder}}`)) {
      missing.push(placeholder);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

// ==================== 必需的占位符 ====================

export const REQUIRED_PLACEHOLDERS = [
  'CURRENT_PRICE',
  'CURRENT_POSITION',
  'BALANCE',
  'TECHNICAL_SUMMARY',
  'RECENT_TRADES',
];

// ==================== 导出 ====================

export const PROMPT_TEMPLATE_VERSION = '2.0.0';
