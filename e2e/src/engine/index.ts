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
    createGameEngine,
    createReplayAdapter,
    type AdapterConfig,
} from './adapter';

// 系统层
export * from './systems';

// Hooks
export * from './hooks';

// 测试工具
export { 
    isTestEnvironment, 
    enableTestMode, 
    disableTestMode,
    RandomInjector,
    DiceInjector,
    StateInjector,
    CommandProxy,
    TestHarness,
} from './testing';
