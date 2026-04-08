/**
 * @deprecated This file has been renamed to linearPolicyAgent.ts.
 * This re-export module exists solely for backward compatibility.
 * Please update imports to use './linearPolicyAgent' directly.
 */
export {
  LinearPolicyAgent,
  SACExecutionAgent,
  sacExecutionAgent,
} from './linearPolicyAgent';

export type {
  State,
  Action,
  Transition,
} from './linearPolicyAgent';
