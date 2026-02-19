/**
 * 传输层延迟优化 - 核心类型定义
 *
 * 定义乐观更新、本地交互状态、命令批处理三个优化策略的类型接口。
 * 游戏层通过 LatencyOptimizationConfig 声明启用哪些优化策略，
 * 引擎层自动处理所有优化逻辑。
 */

import type { Command, GameEvent, MatchState, RandomFn } from '../../types';
import type { DomainCore } from '../../types';
import type { EngineSystem, GameSystemsConfig } from '../../systems/types';

// ============================================================================
// 命令确定性声明
// ============================================================================

/**
 * 命令确定性判断函数
 *
 * 基于当前状态和命令 payload 动态判断命令是否为确定性命令。
 * 返回 true 表示确定性（可安全预测），false 表示非确定性（跳过预测）。
 */
export type CommandDeterminismFn = (
    state: MatchState<unknown>,
    payload: unknown,
) => boolean;

/**
 * 命令确定性声明值
 *
 * - 'deterministic'：确定性命令，客户端可安全预测
 * - 'non-deterministic'：非确定性命令（如掷骰子、洗牌），跳过预测
 * - CommandDeterminismFn：运行时动态判断
 */
export type CommandDeterminismValue =
    | 'deterministic'
    | 'non-deterministic'
    | CommandDeterminismFn;

/**
 * 命令确定性声明映射
 *
 * key 为命令类型（commandType），value 为确定性声明。
 * 未声明的命令默认视为非确定性命令（保守策略）。
 */
export type CommandDeterminismMap = Record<string, CommandDeterminismValue>;

// ============================================================================
// 乐观动画类型
// ============================================================================

/**
 * 命令级别的动画播放策略
 *
 * - 'optimistic'：乐观动画，确定性命令立即播放，不等服务端确认
 * - 'wait-confirm'：等待确认，服务端确认后播放（原有行为，默认值）
 */
export type AnimationMode = 'optimistic' | 'wait-confirm';

/**
 * 命令动画模式映射
 *
 * key 为命令类型，value 为该命令的动画播放策略。
 * 未声明的命令默认使用 'wait-confirm'。
 */
export type CommandAnimationMap = Record<string, AnimationMode>;

/**
 * EventStream 水位线
 *
 * 记录已通过乐观动画播放的最大事件 ID。
 * 回滚时用于过滤服务端确认状态中已播放的事件，防止重复播放。
 * null 表示无水位线（无乐观动画事件）。
 */
export type EventStreamWatermark = number | null;

// ============================================================================
// 乐观更新配置
// ============================================================================

/** 乐观更新配置 */
export interface OptimisticConfig {
    /** 是否启用乐观更新 */
    enabled: boolean;
    /**
     * 命令确定性声明（可选覆盖）
     *
     * 未声明的命令由 Random Probe 自动检测：
     * - pipeline 执行期间调用了 RandomFn → 非确定性，丢弃乐观结果
     * - 未调用 RandomFn → 确定性，保留乐观结果
     */
    commandDeterminism?: CommandDeterminismMap;
    /** 命令动画模式声明（可选，未声明则全部使用 'wait-confirm'） */
    animationMode?: CommandAnimationMap;
}

// ============================================================================
// 命令批处理配置
// ============================================================================

/** 命令批处理配置 */
export interface BatchingConfig {
    /** 是否启用命令批处理 */
    enabled: boolean;
    /** 批处理时间窗口（毫秒），默认 50ms */
    windowMs?: number;
    /** 最大批次命令数，默认 10 */
    maxBatchSize?: number;
    /** 立即发送的命令类型（不参与批处理） */
    immediateCommands?: string[];
}

// ============================================================================
// 延迟优化总配置
// ============================================================================

/**
 * 延迟优化配置
 *
 * 游戏通过 Domain 配置声明启用优化策略，
 * 三个策略可独立启用任意组合。
 */
export interface LatencyOptimizationConfig {
    /** 乐观更新配置 */
    optimistic?: OptimisticConfig;
    /** 命令批处理配置 */
    batching?: BatchingConfig;
}


// ============================================================================
// 乐观更新引擎内部类型
// ============================================================================

/**
 * 未确认的乐观命令
 *
 * 记录每个乐观预测的命令及其预测状态，用于服务端确认后校验/回滚。
 */
export interface PendingCommand {
    /** 命令序号（单调递增，用于与服务端确认对齐） */
    seq: number;
    /** 命令类型 */
    type: string;
    /** 命令 payload */
    payload: unknown;
    /** 发送命令的玩家 ID（重放时使用，避免用 '0' 兜底导致校验失败） */
    playerId: string;
    /** 乐观预测后的状态 */
    predictedState: MatchState<unknown>;
    /** 预测前的状态（用于回滚） */
    previousState: MatchState<unknown>;
    /**
     * 预测的服务端 stateID（可选）
     *
     * 基于 confirmedStateID + pending 队列位置推算。
     * reconcile 时用于与服务端传来的 stateID 精确匹配，
     * 替代 JSON.stringify 深度比较。
     */
    predictedStateID?: number;
    /**
     * 命令发出时的阶段快照（可选）
     *
     * replayPending 时用于校验：若服务端确认状态的 phase 已不是此值，
     * 说明服务端已执行过该命令，直接丢弃，不重放。
     * 仅对 phase 敏感的命令（如 ADVANCE_PHASE）有意义。
     */
    snapshotPhase?: string;
}

/**
 * Pipeline 配置（用于客户端本地执行）
 *
 * 乐观更新需要在客户端持有与服务端相同的 Pipeline 配置，
 * 以确保本地预测的准确性。
 */
export interface LatencyPipelineConfig {
    /** 领域内核 */
    domain: DomainCore<unknown, Command, GameEvent>;
    /** 启用的系统 */
    systems: EngineSystem<unknown>[];
    /** 系统配置 */
    systemsConfig?: GameSystemsConfig;
}

/**
 * 乐观引擎内部状态
 *
 * 维护确认状态、未确认命令队列和 Pipeline 配置，
 * 用于本地预测和服务端确认校验。
 */
export interface OptimisticEngineState {
    /** 最后一次服务端确认的状态 */
    confirmedState: MatchState<unknown> | null;
    /** 未确认的乐观命令队列（FIFO） */
    pendingCommands: PendingCommand[];
    /** 命令序号计数器 */
    nextSeq: number;
    /** Pipeline 配置（用于本地执行） */
    pipelineConfig: LatencyPipelineConfig;
    /** 命令确定性声明（可选，未声明的命令由 Random Probe 自动检测） */
    commandDeterminism?: CommandDeterminismMap;
    /** 玩家 ID 列表 */
    playerIds: string[];
    /** 本地随机数生成器（用于确定性命令的本地预测） */
    localRandom: RandomFn;
}

// ============================================================================
// 命令批处理器内部类型
// ============================================================================

/** 批处理队列中的命令条目 */
export interface BatchedCommand {
    /** 命令类型 */
    type: string;
    /** 命令 payload */
    payload: unknown;
}

/**
 * 命令批处理器内部状态
 */
export interface BatcherState {
    /** 待发送命令队列 */
    queue: BatchedCommand[];
    /** 当前批处理定时器 */
    timer: ReturnType<typeof setTimeout> | null;
    /** 配置 */
    config: {
        /** 批处理时间窗口（毫秒） */
        windowMs: number;
        /** 最大批次命令数 */
        maxBatchSize: number;
        /** 立即发送的命令类型集合 */
        immediateCommands: Set<string>;
    };
}

// ============================================================================
// 公共接口类型（供外部消费）
// ============================================================================

/**
 * OptimisticEngine 的 processCommand 返回值
 */
export interface ProcessCommandResult {
    /** 应渲染的状态（null 表示不更新乐观状态） */
    stateToRender: MatchState<unknown> | null;
    /** 是否应发送命令到服务端 */
    shouldSend: boolean;
    /** 本次命令的动画模式（供 GameProvider 决策是否需要水位线处理） */
    animationMode: AnimationMode;
}

/**
 * OptimisticEngine 的 reconcile 返回值
 */
export interface ReconcileResult {
    /** 应渲染的状态 */
    stateToRender: MatchState<unknown>;
    /** 是否发生了回滚（乐观状态与确认状态不一致） */
    didRollback: boolean;
    /**
     * 乐观动画事件水位线
     *
     * 仅当 didRollback=true 且存在乐观动画事件时有值。
     * GameProvider 用此值过滤服务端确认状态中已播放的事件。
     */
    optimisticEventWatermark: EventStreamWatermark;
}

