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

// 选择请求
export * from './ChoiceRequest';

// 时点 / 机会
export * from './TimingOpportunity';

// 裁判查询视图
export * from './RefereeView';

// 裁判证据回放摘要
export * from './RefereeReplay';

// 系统层
export * from './systems';

// Hooks
export * from './hooks';

// Board 渲染后端
export * from './boardRenderer';

// 渲染管线 / 玩家画质设置
export * from './renderPipeline';

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
