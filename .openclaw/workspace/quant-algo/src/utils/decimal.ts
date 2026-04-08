/**
 * 数值精度工具 — 加密货币交易精度保护
 * 使用整数运算避免浮点误差
 */

/**
 * 将浮点数四舍五入到指定小数位
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * 精确加法
 */
export function safeAdd(a: number, b: number, decimals: number = 8): number {
  return roundTo(a + b, decimals);
}

/**
 * 精确减法
 */
export function safeSub(a: number, b: number, decimals: number = 8): number {
  return roundTo(a - b, decimals);
}

/**
 * 精确乘法
 */
export function safeMul(a: number, b: number, decimals: number = 8): number {
  return roundTo(a * b, decimals);
}

/**
 * 精确除法（带除零保护）
 */
export function safeDiv(a: number, b: number, decimals: number = 8, fallback: number = 0): number {
  if (b === 0) return fallback;
  return roundTo(a / b, decimals);
}

/**
 * 将数量调整到交易所最小步进
 */
export function adjustToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.floor(value / step) * step;
}

/**
 * 将价格调整到 tick size
 */
export function adjustToTick(price: number, tickSize: number): number {
  if (tickSize <= 0) return price;
  return Math.round(price / tickSize) * tickSize;
}

/**
 * 计算百分比变化
 */
export function percentChange(from: number, to: number): number {
  if (from === 0) return 0;
  return roundTo((to - from) / from, 6);
}

/**
 * 计算 PnL
 */
export function calculatePnl(
  entryPrice: number,
  exitPrice: number,
  size: number,
  side: 'long' | 'short',
  feeRate: number = 0
): number {
  const rawPnl = side === 'long'
    ? (exitPrice - entryPrice) * size
    : (entryPrice - exitPrice) * size;
  const fees = (entryPrice * size + exitPrice * size) * feeRate;
  return roundTo(rawPnl - fees, 8);
}
