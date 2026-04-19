/**
 * 传输层延迟优化模块
 *
 * 提供命令批处理、乐观更新引擎等功能，
 * 用于减少网络往返次数，提升交互响应速度。
 */

// 命令批处理器
export { createCommandBatcher } from './commandBatcher';
export type { CommandBatcher, CommandBatcherConfig } from './commandBatcher';

// 乐观更新引擎
export {
    createOptimisticEngine,
    applyAnimationMode,
    getMaxEventId,
    filterPlayedEvents,
    stripOptimisticEventStream,
} from './optimisticEngine';
export type { OptimisticEngine, OptimisticEngineConfig } from './optimisticEngine';

// 核心类型
export type {
    LatencyOptimizationConfig,
    OptimisticConfig,
    BatchingConfig,
    CommandDeterminismMap,
    CommandDeterminismValue,
    CommandDeterminismFn,
    AnimationMode,
    CommandAnimationMap,
    EventStreamWatermark,
    PendingCommand,
    BatchedCommand,
    BatcherState,
    LatencyPipelineConfig,
    ProcessCommandResult,
    ReconcileResult,
    OptimisticEngineState,
} from './types';
