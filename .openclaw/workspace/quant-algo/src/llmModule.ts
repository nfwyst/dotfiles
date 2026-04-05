#!/usr/bin/env bun
/**
 * LLM决策模块 - 文件接口版
 * 从 strategy-output.json 读取，支持独立部署和回测
 */

import { config as dotenvConfig } from 'dotenv';
import fs from 'fs';

dotenvConfig({ path: './config/.env' });

const CONFIG = {
  INPUT_FILE: './strategy-output.json',
  OUTPUT_FILE: './llm-report.json',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
  DEEPSEEK_URL: 'https://api.deepseek.com/v1/chat/completions',
};

function log(msg: string) {
  console.log(`[${new Date().toLocaleString('zh-CN')}] [LLM] ${msg}`);
}

export class LLMModule {
  // 从文件读取策略输出
  readStrategyOutput(): any | null {
    try {
      if (fs.existsSync(CONFIG.INPUT_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG.INPUT_FILE, 'utf8'));
      }
    } catch (e) {}
    return null;
  }

  // 保存决策到文件
  saveDecision(decision: any) {
    fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(decision, null, 2));
  }

  // 处理并生成决策
  async process(): Promise<any> {
    const data = this.readStrategyOutput();
    if (!data) {
      log('❌ 无策略输出');
      return null;
    }

    log(`处理策略数据: ${data.strategies?.length || 0}个策略, 共识:${data.consensus?.type?.toUpperCase()}`);

    const prompt = this.buildPrompt(data);
    
    try {
      const response = await this.callLLM(prompt);
      const parsed = this.parseResponse(response);

      const decision = {
        thinking: parsed.thinking || '无思考过程',
        finalDecision: {
          action: parsed.finalDecision?.action || data.consensus?.type || 'hold',
          confidence: parsed.finalDecision?.confidence || 0.5,
          reasoning: parsed.finalDecision?.reasoning || ['基于策略共识'],
          timestamp: new Date().toISOString(),
        },
        technicalAnalysis: parsed.technicalAnalysis,
        riskAssessment: parsed.riskAssessment,
        updatedAt: new Date().toISOString(),
      };

      this.saveDecision(decision);
      log(`✅ 决策: ${decision.finalDecision.action.toUpperCase()} (置信度:${(decision.finalDecision.confidence*100).toFixed(0)}%)`);
      return decision;
    } catch (e: any) {
      log(`❌ 错误: ${e.message}`);
      return null;
    }
  }

  private buildPrompt(data: any): string {
    return `基于策略输出做决策:
共识: ${data.consensus?.type?.toUpperCase()} (强度${data.consensus?.strength?.toFixed(0)})
策略数: ${data.strategies?.length}

输出JSON:
{
  "thinking": "思考过程",
  "finalDecision": { "action": "buy|sell|hold", "confidence": 0.0-1.0, "reasoning": ["原因"] },
  "technicalAnalysis": {},
  "riskAssessment": {}
}`;
  }

  private async callLLM(prompt: string): Promise<any> {
    const res = await fetch(CONFIG.DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: '你是交易员' }, { role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json().then(d => d.choices[0].message.content);
  }

  private parseResponse(content: string): any {
    try { return JSON.parse(content); } catch (e) {
      const match = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      return JSON.parse(match?.[1] || match?.[0] || '{}');
    }
  }
}

// 独立运行入口
async function main() {
  log('═══════════════════════════════════════════');
  log('🤖 LLM 模块 (文件接口版)');
  log('═══════════════════════════════════════════');
  log('📥 从 strategy-output.json 读取');
  log('📤 输出到 llm-report.json');

  if (!CONFIG.DEEPSEEK_API_KEY) { log('❌ API Key 未配置'); process.exit(1); }

  const llm = new LLMModule();
  await llm.process();

  // 定时循环
  setInterval(() => llm.process(), 5 * 60 * 1000);
  log('⏱️ 每5分钟更新');
}

if (import.meta.main) main();

export default LLMModule;
