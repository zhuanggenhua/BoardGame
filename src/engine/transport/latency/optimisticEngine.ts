/**
 * 乐观更新引擎
 *
 * 客户端本地执行 Pipeline 预测状态，立即更新 UI。
 * 服务端确认后校验/回滚，确保最终一致性。
 *
 * 核心职责：
 * 1. 判断命令确定性 → 确定性则本地执行 executePipeline
 * 2. 根据 AnimationMode 决定是否保留 EventStream（乐观动画 or 等待确认）
 * 3. 服务端确认后调和（reconcile）：一致则保持，不一致则回滚
 * 4. 维护 pending 命令队列，支持链式乐观预测
 * 5. 维护 EventStream 水位线，回滚时防止动画重复播放
 */

import type { MatchState, Command, RandomFn } from '../../types';
import type {
    LatencyPipelineConfig,
    CommandDeterminismMap,
    CommandAnimationMap,
    AnimationMode,
    EventStreamWatermark,
    PendingCommand,
    ProcessCommandResult,
    ReconcileResult,
} from './types';
import { executePipeline } from '../../pipeline';

// ============================================================================
// 公共接口
// ============================================================================

/** 乐观更新引擎接口 */
export interface OptimisticEngine {
    /** 处理命令：决定是否乐观预测，返回应渲染的状态 */
    processCommand(type: string, payload: unknown, playerId: string): ProcessCommandResult;

    /** 服务端确认状态到达时调用 */
    reconcile(confirmedState: MatchState<unknown>, meta?: { stateID?: number }): ReconcileResult;

    /** 获取当前应渲染的状态（乐观状态或确认状态） */
    getCurrentState(): MatchState<unknown> | null;

    /** 是否有未确认的乐观命令 */
    hasPendingCommands(): boolean;

    /** 重置（断线重连时调用） */
    reset(): void;

    /** 更新玩家 ID 列表（首次收到服务端状态时调用） */
    setPlayerIds(ids: string[]): void;
}

// ============================================================================
// 工厂函数配置
// ============================================================================

/** createOptimisticEngine 的配置参数 */
export interface OptimisticEngineConfig {
    /** Pipeline 配置（用于客户端本地执行） */
    pipelineConfig: LatencyPipelineConfig;
    /**
     * 命令确定性声明（可选覆盖）
     *
     * 未声明的命令由引擎自动检测（Random Probe）：
     * - 若 pipeline 执行期间调用了 RandomFn → 视为非确定性，丢弃乐观结果
     * - 若未调用 RandomFn → 视为确定性，保留乐观结果
     *
     * 显式声明优先级高于自动检测，用于：
     * - 强制非确定性（如某命令虽不用随机数但结果依赖服务端时序）
     * - 强制确定性（跳过 probe 开销，适用于已知安全的高频命令）
     */
    commandDeterminism?: CommandDeterminismMap;
    /** 命令动画模式声明（可选，未声明则全部使用 'wait-confirm'） */
    commandAnimationMode?: CommandAnimationMap;
    /** 玩家 ID 列表 */
    playerIds: string[];
    /** 本地随机数生成器（可选，默认 Math.random） */
    localRandom?: RandomFn;
}

// ============================================================================
// EventStream 工具函数
// ============================================================================

/**
 * 根据动画模式决定是否保留 EventStream 事件
 *
 * - 'optimistic'：保留乐观执行产生的 EventStream 事件（立即触发动画）
 * - 'wait-confirm'：剥离 EventStream 事件（等服务端确认后触发动画）
 */
export function applyAnimationMode(
    optimisticState: MatchState<unknown>,
    previousState: MatchState<unknown>,
    mode: AnimationMode,
): MatchState<unknown> {
    if (mode === 'optimistic') {
        // 保留乐观执行产生的 EventStream 事件，立即触发动画
        return optimisticState;
    }
    // wait-confirm：剥离 EventStream，保持原有行为
    return {
        ...optimisticState,
        sys: {
            ...optimisticState.sys,
            eventStream: previousState.sys.eventStream,
        },
    };
}

/**
 * 获取 EventStream 中最大事件 ID
 *
 * 用于计算乐观动画水位线。
 * 若 EventStream 为空，返回 null。
 *
 * 注意：entries 按 ID 递增排列，直接取最后一个元素即可。
 * 避免 Math.max(...spread) 在大数组上的栈溢出风险。
 */
export function getMaxEventId(
    eventStream: MatchState<unknown>['sys']['eventStream'],
): number | null {
    if (!eventStream || eventStream.entries.length === 0) return null;
    return eventStream.entries[eventStream.entries.length - 1].id;
}

/**
 * 向后兼容别名：从乐观状态中剥离 EventStream 事件
 *
 * @deprecated 使用 applyAnimationMode(state, prev, 'wait-confirm') 替代
 */
export function stripOptimisticEventStream(
    optimisticState: MatchState<unknown>,
    previousState: MatchState<unknown>,
): MatchState<unknown> {
    return applyAnimationMode(optimisticState, previousState, 'wait-confirm');
}

/**
 * 过滤 EventStream 中已通过乐观动画播放的事件
 *
 * 回滚发生时，服务端确认状态的 EventStream 可能包含与乐观预测相同的事件。
 * 为防止动画重复播放，将 id <= watermark 的事件从 entries 中移除。
 *
 * @param state 服务端确认状态（回滚后的 stateToRender）
 * @param watermark 乐观动画水位线（已播放的最大事件 ID）
 * @returns 过滤后的状态（结构共享，仅修改 eventStream.entries）
 */
export function filterPlayedEvents(
    state: MatchState<unknown>,
    watermark: EventStreamWatermark,
): MatchState<unknown> {
    if (watermark === null) return state;
    const { entries } = state.sys.eventStream;
    if (entries.length === 0) return state;

    const filtered = entries.filter((e: { id: number }) => e.id > watermark);
    // 若无变化，返回原状态（结构共享）
    if (filtered.length === entries.length) return state;

    return {
        ...state,
        sys: {
            ...state.sys,
            eventStream: {
                ...state.sys.eventStream,
                entries: filtered,
            },
        },
    };
}

// ============================================================================
// 工厂函数实现
// ============================================================================

/** 创建默认的本地随机数生成器 */
function createDefaultRandom(): RandomFn {
    return {
        random: () => Math.random(),
        d: (max: number) => Math.floor(Math.random() * max) + 1,
        range: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
        shuffle: <T>(array: T[]): T[] => {
            const result = [...array];
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        },
    };
}

/**
 * Random Probe：包装 RandomFn，追踪是否被调用
 *
 * 用于自动检测命令是否依赖随机数：
 * - pipeline 执行期间若调用了任意随机方法 → wasUsed = true
 * - 调用方据此决定是否丢弃乐观预测结果
 *
 * @param base 底层随机数生成器
 * @returns { probe: RandomFn, wasUsed: () => boolean, reset: () => void }
 */
export function createRandomProbe(base: RandomFn): {
    probe: RandomFn;
    wasUsed: () => boolean;
    reset: () => void;
} {
    let used = false;
    const probe: RandomFn = {
        random: () => { used = true; return base.random(); },
        d: (max) => { used = true; return base.d(max); },
        range: (min, max) => { used = true; return base.range(min, max); },
        shuffle: <T>(array: T[]) => { used = true; return base.shuffle(array); },
    };
    return {
        probe,
        wasUsed: () => used,
        reset: () => { used = false; },
    };
}

/**
 * 创建乐观更新引擎
 *
 * @param config 引擎配置
 * @returns OptimisticEngine 实例
 */
export function createOptimisticEngine(config: OptimisticEngineConfig): OptimisticEngine {
    const { pipelineConfig } = config;
    const commandDeterminism: CommandDeterminismMap = config.commandDeterminism ?? {};
    const commandAnimationMode: CommandAnimationMap = config.commandAnimationMode ?? {};
    const localRandom: RandomFn = config.localRandom ?? createDefaultRandom();

    /** 基于 localRandom 创建 probe（复用同一个，每次 processCommand 前 reset） */
    const randomProbe = createRandomProbe(localRandom);

    /** 玩家 ID 列表（首次收到服务端状态后填充） */
    let playerIds: string[] = config.playerIds ?? [];

    /** 最后一次服务端确认的状态 */
    let confirmedState: MatchState<unknown> | null = null;

    /** 未确认的乐观命令队列（FIFO） */
    let pendingCommands: PendingCommand[] = [];

    /** 命令序号计数器 */
    let nextSeq = 1;

    /**
     * 乐观动画事件水位线
     *
     * 记录已通过乐观动画播放的最大事件 ID。
     * 回滚时携带此值，供 GameProvider 过滤已播放事件。
     */
    let optimisticEventWatermark: EventStreamWatermark = null;

    /**
     * wait-confirm 模式下的事件水位线
     *
     * 当 wait-confirm 命令被乐观执行时，EventStream 被替换为 previousState 的版本。
     * 客户端的 EventStream 游标已消费到 previousState 的 maxEventId。
     * 回滚到服务端状态时，服务端状态可能包含游标已消费的事件，
     * 需要用此水位线过滤，防止动画重复播放。
     */
    let waitConfirmWatermark: EventStreamWatermark = null;

    /**
     * 最后一次服务端确认的 stateID
     *
     * 用于推算 pending 命令的 predictedStateID（confirmedStateID + 1, +2, ...）。
     * reconcile 时用 stateID 精确匹配替代 JSON.stringify 深度比较。
     * null 表示尚未收到服务端 stateID（旧版服务端不传 meta）。
     */
    let confirmedStateID: number | null = null;

    /**
     * 未预测命令屏障
     *
     * 当某个命令因非确定性（Random Probe 检测到随机数调用、显式声明 non-deterministic、
     * 或 pipeline 执行失败）而未被乐观预测时，设置此屏障。
     *
     * 屏障激活期间，后续所有 processCommand 调用都跳过预测，
     * 因为它们的预测基础状态（confirmedState）不包含未预测命令的效果，
     * 预测结果必然不准确。
     *
     * 典型场景：USE_TOKEN（含随机数）未预测 → SKIP_TOKEN_RESPONSE 不应预测，
     * 否则回滚时 optimisticEventWatermark 会错误过滤掉 BONUS_DIE_ROLLED 等服务端事件。
     *
     * reconcile 时清除屏障（服务端确认状态已包含未预测命令的效果）。
     */
    let unpredictedBarrier = false;

    /**
     * 判断命令是否有显式确定性声明
     *
     * 返回值：
     * - 'deterministic'：显式声明为确定性，跳过 probe
     * - 'non-deterministic'：显式声明为非确定性，跳过 probe
     * - null：无声明，使用 Random Probe 自动检测
     */
    function getExplicitDeterminism(
        type: string,
        state: MatchState<unknown>,
        payload: unknown,
    ): 'deterministic' | 'non-deterministic' | null {
        const declaration = commandDeterminism[type];
        if (!declaration) return null;
        if (declaration === 'deterministic') return 'deterministic';
        if (declaration === 'non-deterministic') return 'non-deterministic';
        // 动态判断函数
        return declaration(state, payload) ? 'deterministic' : 'non-deterministic';
    }

    /**
     * 获取命令的动画模式
     *
     * 未声明的命令默认使用 'wait-confirm'（保守策略）。
     */
    function getAnimationMode(type: string): AnimationMode {
        return commandAnimationMode[type] ?? 'wait-confirm';
    }

    /**
     * 获取当前最新状态（最后一个乐观预测状态，或确认状态）
     */
    function getLatestState(): MatchState<unknown> | null {
        if (pendingCommands.length > 0) {
            return pendingCommands[pendingCommands.length - 1].predictedState;
        }
        return confirmedState;
    }

    /**
     * 基于给定状态重新预测所有 pending 命令
     *
     * 用于 reconcile 后，基于新确认状态重新执行剩余 pending 命令。
     * 如果某个命令预测失败，则丢弃该命令及后续所有命令。
     */
    function replayPending(
        baseState: MatchState<unknown>,
        commands: PendingCommand[],
    ): PendingCommand[] {
        const replayed: PendingCommand[] = [];
        let currentState = baseState;

        for (const cmd of commands) {
            // Phase 快照校验：若命令发出时记录了 snapshotPhase，
            // 而当前 replay 基准状态的 phase 已不是该值，
            // 说明服务端已执行过该命令（phase 已推进），直接丢弃，不重放。
            if (cmd.snapshotPhase !== undefined) {
                const currentPhase = (currentState as MatchState<unknown> & { sys: { phase?: string } }).sys?.phase;
                if (currentPhase !== cmd.snapshotPhase) {
                    // 服务端已执行此命令（phase 已推进），跳过。
                    // 使用 continue 而非 break：后续命令可能属于新 phase，仍需尝试重放。
                    // 极端情况：两个连续 ADVANCE_PHASE 命令，第一个被跳过后第二个可能导致
                    // 状态超前一个 phase。实际中极少发生（用户不会连续快速推进两个阶段），
                    // 且服务端确认后会立即调和修正。
                    continue;
                }
            }

            try {
                const command: Command = {
                    type: cmd.type,
                    playerId: cmd.playerId,
                    payload: cmd.payload,
                };

                const result = executePipeline(
                    pipelineConfig,
                    currentState,
                    command,
                    localRandom,
                    playerIds,
                );

                if (!result.success) {
                    // 命令在新状态下验证失败，丢弃
                    break;
                }

                // 重放时保持原有动画模式
                const mode = getAnimationMode(cmd.type);
                const predictedState = applyAnimationMode(result.state, currentState, mode);
                replayed.push({
                    ...cmd,
                    predictedState,
                    previousState: currentState,
                });
                currentState = predictedState;
            } catch {
                // Pipeline 执行异常，丢弃该命令及后续
                break;
            }
        }

        return replayed;
    }

    return {
        processCommand(type: string, payload: unknown, playerId: string): ProcessCommandResult {
            const currentState = getLatestState();

            // 没有确认状态时无法预测
            if (!currentState) {
                return { stateToRender: null, shouldSend: true, animationMode: 'wait-confirm' };
            }

            // 未预测命令屏障：前序命令未被预测，当前预测基础状态不完整，跳过预测
            if (unpredictedBarrier) {
                return { stateToRender: null, shouldSend: true, animationMode: 'wait-confirm' };
            }

            // 显式声明为非确定性：跳过预测，直接发送
            const explicitDecl = getExplicitDeterminism(type, currentState, payload);
            if (explicitDecl === 'non-deterministic') {
                unpredictedBarrier = true;
                return { stateToRender: null, shouldSend: true, animationMode: 'wait-confirm' };
            }

            // 尝试本地执行 Pipeline（使用 probe 检测随机数调用）
            try {
                const command: Command = { type, playerId, payload };

                // 显式声明为确定性 → 用 localRandom 直接执行（跳过 probe 开销）
                // 无声明 → 用 probe 执行，事后检查是否调用了随机数
                const useProbe = explicitDecl === null;
                if (useProbe) randomProbe.reset();
                const randomToUse = useProbe ? randomProbe.probe : localRandom;

                const result = executePipeline(
                    pipelineConfig,
                    currentState,
                    command,
                    randomToUse,
                    playerIds,
                );

                if (!result.success) {
                    // 本地验证失败，不更新乐观状态，仍发送到服务端
                    return { stateToRender: null, shouldSend: true, animationMode: 'wait-confirm' };
                }

                // Random Probe 自动检测：若 pipeline 执行期间调用了随机数 → 丢弃乐观结果
                if (useProbe && randomProbe.wasUsed()) {
                    unpredictedBarrier = true;
                    return { stateToRender: null, shouldSend: true, animationMode: 'wait-confirm' };
                }

                // 根据动画模式决定是否保留 EventStream
                const mode = getAnimationMode(type);
                const predictedState = applyAnimationMode(result.state, currentState, mode);

                // 乐观动画模式：更新水位线（取最大值）
                if (mode === 'optimistic') {
                    const newWatermark = getMaxEventId(result.state.sys.eventStream);
                    if (newWatermark !== null) {
                        optimisticEventWatermark = Math.max(
                            optimisticEventWatermark ?? 0,
                            newWatermark,
                        );
                    }
                }

                // wait-confirm 模式：记录 previousState 的 EventStream 水位线
                // 客户端游标已消费到此位置，回滚时需要过滤这些已消费的事件
                if (mode === 'wait-confirm') {
                    const prevMaxId = getMaxEventId(currentState.sys.eventStream);
                    if (prevMaxId !== null) {
                        waitConfirmWatermark = Math.max(
                            waitConfirmWatermark ?? 0,
                            prevMaxId,
                        );
                    }
                }

                // 加入 pending 队列
                pendingCommands.push({
                    seq: nextSeq++,
                    type,
                    payload,
                    playerId,
                    predictedState,
                    previousState: currentState,
                    // 推算预测的 stateID：confirmedStateID + pending 队列位置
                    // 每个命令执行后服务端 stateID 递增 1
                    predictedStateID: confirmedStateID !== null
                        ? confirmedStateID + pendingCommands.length + 1
                        : undefined,
                    // 记录发出时的 phase，供 replayPending 校验（防止服务端已执行后重复 replay）
                    snapshotPhase: (currentState as MatchState<unknown> & { sys: { phase?: string } }).sys?.phase,
                });

                return { stateToRender: predictedState, shouldSend: true, animationMode: mode };
            } catch {
                // Pipeline 执行异常，不更新乐观状态
                return { stateToRender: null, shouldSend: true, animationMode: 'wait-confirm' };
            }
        },

        reconcile(serverState: MatchState<unknown>, meta?: { stateID?: number }): ReconcileResult {
            // 更新确认状态
            confirmedState = serverState;

            // 更新 confirmedStateID（用于后续 processCommand 推算 predictedStateID）
            if (meta?.stateID !== undefined) {
                confirmedStateID = meta.stateID;
            }

            if (pendingCommands.length === 0) {
                // 无 pending 命令，直接使用确认状态，重置水位线
                optimisticEventWatermark = null;
                waitConfirmWatermark = null;
                // 清除未预测命令屏障：服务端确认状态已包含所有命令的效果
                unpredictedBarrier = false;
                return {
                    stateToRender: serverState,
                    didRollback: false,
                    optimisticEventWatermark: null,
                };
            }

            // 尝试识别服务端确认的是哪个 pending 命令。
            //
            // 优先使用 stateID 精确匹配（O(1)，无误判风险）：
            //   服务端每次命令执行后 stateID 递增 1，
            //   pending[0].predictedStateID 是基于 confirmedStateID 推算的预期值。
            //   若 meta.stateID === pending[0].predictedStateID，说明服务端确认了 pending[0]。
            //
            // Fallback 到 JSON.stringify 深度比较（向后兼容旧版服务端不传 stateID）：
            //   若 pending[0].predictedState.core 与 serverState.core 序列化相同，
            //   说明本地预测准确，服务端确认了 pending[0]。
            //   风险：两个不同命令产生相同 core 序列化时会误判（极低概率）。
            const baseForReplay = serverState;
            let commandsToReplay = pendingCommands;
            let firstCommandConfirmed = false;

            const firstPending = pendingCommands[0];
            if (
                meta?.stateID !== undefined &&
                firstPending.predictedStateID !== undefined
            ) {
                // stateID 精确匹配
                firstCommandConfirmed = meta.stateID === firstPending.predictedStateID;
            } else {
                // Fallback: JSON.stringify 深度比较
                firstCommandConfirmed =
                    JSON.stringify(firstPending.predictedState.core) === JSON.stringify(serverState.core);
            }

            if (firstCommandConfirmed) {
                // 服务端确认了 pending[0]，丢弃它，基于服务端状态重放剩余
                commandsToReplay = pendingCommands.slice(1);
            }

            const replayed = replayPending(baseForReplay, commandsToReplay);
            pendingCommands = replayed;

            if (pendingCommands.length === 0) {
                // 所有 pending 命令已消费（确认或失效）
                // 清除未预测命令屏障
                unpredictedBarrier = false;
                //
                // 水位线策略：
                // - 命令通过 core 匹配正常确认（firstCommandConfirmed）：
                //   乐观动画已播放，服务端事件与乐观事件一致，无需过滤 → null
                //   此时不算回滚（didRollback: false），预测准确
                // - 状态发散（对手命令/非确定性结果）导致 pending 全部失效：
                //   需要过滤已播放的乐观事件，防止重复播放
                //   同时需要过滤 wait-confirm 模式下客户端游标已消费的事件
                const watermark = firstCommandConfirmed
                    ? null
                    : (optimisticEventWatermark ?? waitConfirmWatermark);
                optimisticEventWatermark = null;
                waitConfirmWatermark = null;
                return {
                    stateToRender: serverState,
                    didRollback: !firstCommandConfirmed,
                    optimisticEventWatermark: watermark,
                };
            }

            // 返回最新的乐观预测状态（无回滚）
            // 清除屏障：confirmed state 已包含未预测命令的效果，
            // replayed pending 基于完整状态，后续预测可以恢复
            unpredictedBarrier = false;
            const latestPredicted = pendingCommands[pendingCommands.length - 1].predictedState;
            return {
                stateToRender: latestPredicted,
                didRollback: false,
                optimisticEventWatermark: null,
            };
        },

        getCurrentState(): MatchState<unknown> | null {
            return getLatestState();
        },

        hasPendingCommands(): boolean {
            return pendingCommands.length > 0;
        },

        reset(): void {
            pendingCommands = [];
            confirmedState = null;
            nextSeq = 1;
            optimisticEventWatermark = null;
            waitConfirmWatermark = null;
            confirmedStateID = null;
            unpredictedBarrier = false;
        },

        setPlayerIds(ids: string[]): void {
            playerIds = ids;
        },
    };
}
