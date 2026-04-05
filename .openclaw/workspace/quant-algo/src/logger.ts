/**
 * Logger 重新导出入口
 * 保持向后兼容性 - 导出预初始化的实例
 */
import { LoggerModule, getLogger } from './modules/logger';

// 导出类型
export * from './modules/logger';

// 默认导出: 预初始化的 logger 实例
const logger = getLogger('quant-alto');
export default logger;

// tradeLogger 实例 (用于交易日志)
export const tradeLogger = getLogger('trade');
