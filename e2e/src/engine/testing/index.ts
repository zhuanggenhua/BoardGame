/**
 * 测试工具导出
 * 
 * 统一导出所有测试工具，方便引擎层集成。
 */

export { isTestEnvironment, enableTestMode, disableTestMode } from './environment';
export { RandomInjector } from './RandomInjector';
export { DiceInjector } from './DiceInjector';
export { StateInjector } from './StateInjector';
export { CommandProxy } from './CommandProxy';
export { TestHarness } from './TestHarness';
export { 
    GameTestRunner,
    type StateExpectation,
    type TestCase,
    type StepLog,
    type TestResult,
    type TestRunnerConfig,
} from './GameTestRunner';
export type {} from './types';
