/**
 * 安全模块导出
 */

export { KillSwitch, killSwitch } from './KillSwitch';
export type { KillSwitchState, KillSwitchConfig } from './KillSwitch';

export { CircuitBreaker } from './CircuitBreaker';
export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitBreakerResult,
  StateChangeEvent,
} from './CircuitBreaker';

export {
  exchangeCircuitBreaker,
  aiCircuitBreaker,
  executionCircuitBreaker,
  websocketCircuitBreaker,
  circuitBreakerManager,
  CircuitBreakerManager,
} from './circuitBreakers';
