/**
 * 引擎层导出
 */

// 核心类型
export * from './types';

// 管线
export {
    createInitialSystemState,
    createSeededRandom,
    executePipeline,
    replayEvents,
    type PipelineConfig,
    type PipelineResult,
} from './pipeline';

// 适配器
export {
    createGameAdapter,
    createReplayAdapter,
    type AdapterConfig,
} from './adapter';

// 系统层
export * from './systems';

// Hooks
export * from './hooks';

// 测试工具
export { GameTestRunner, type TestCase, type TestResult, type StateExpectation } from './testing';
