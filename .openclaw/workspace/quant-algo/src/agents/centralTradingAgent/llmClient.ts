/**
 * LLM 客户端
 * 用于 Agent 调用 DeepSeek API
 */

import logger from '../../logger';

export interface LLMResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export class LLMClient {
  private apiKey: string;
  private url: string;
  private model: string;
  
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.url = process.env.DEEPSEEK_URL || 'https://api.deepseek.com/v1/chat/completions';
    this.model = 'deepseek-chat';
  }
  
  /**
   * 检查 LLM 是否可用
   */
  isAvailable(): boolean {
    return this.apiKey.length > 10;
  }
  
  /**
   * 调用 LLM
   */
  async chat(systemPrompt: string, userPrompt: string, jsonMode: boolean = true): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'DeepSeek API Key not configured',
      };
    }
    
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: jsonMode ? { type: 'json_object' } : undefined,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }
      
      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      
      return {
        success: true,
        content,
      };
      
    } catch (error: any) {
      logger.error(`LLM call failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// 单例
let llmClient: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!llmClient) {
    llmClient = new LLMClient();
  }
  return llmClient;
}
