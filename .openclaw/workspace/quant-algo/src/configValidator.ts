import { config as dotenvConfig } from 'dotenv';
import fs from 'fs';

dotenvConfig({ path: './config/.env' });

export interface ConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfig(): ConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查必需的 API Keys
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const binanceKey = process.env.BINANCE_API_KEY;
  const binanceSecret = process.env.BINANCE_API_SECRET;

  if (!deepseekKey || deepseekKey.length < 20) {
    errors.push('DEEPSEEK_API_KEY 未配置或格式错误');
  }

  if (!binanceKey) {
    warnings.push('BINANCE_API_KEY 未配置 - 将使用模拟数据运行 (从 https://testnet.binance.vision/ 获取真实API)');
  }

  if (!binanceSecret) {
    warnings.push('BINANCE_API_SECRET 未配置');
  }

  // 检查交易配置
  const timeframe = process.env.TIMEFRAME || '5m';
  const validTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];
  if (!validTimeframes.includes(timeframe)) {
    errors.push(`TIMEFRAME ${timeframe} 无效`);
  }

  const leverage = parseInt(process.env.LEVERAGE || '50');
  if (leverage < 1 || leverage > 125) {
    errors.push(`LEVERAGE ${leverage} 必须在 1-125 之间`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateConfigOrExit(): void {
  const result = validateConfig();
  if (!result.valid) {
    console.error('\n❌ 配置错误，系统无法启动:\n');
    result.errors.forEach(e => console.error(`   - ${e}`));
    console.error('\n请编辑 config/.env 修复上述问题\n');
    process.exit(1);
  }
}
