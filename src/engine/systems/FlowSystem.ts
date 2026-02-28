/**
 * 流程系统 (FlowSystem)
 *
 * 目标：
 * - sys.phase 是阶段的单一权威来源
 * - ADVANCE_PHASE 统一由 FlowSystem 处理（系统消费命令）
 * - 游戏层通过 FlowHooks 定义阶段规则与阶段副作用（事件）
 */

import type { Command, GameEvent, MatchState, PlayerId, RandomFn } from '../types';
import { isDevEnv } from '../env';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

const isDev = isDevEnv();
const logDev = (...args: unknown[]) => {
    if (isDev) {
        console.log(...args);
    }
};

const resolveTimestamp = (command?: Command, events?: GameEvent[]): number => {
    if (command && typeof command.timestamp === 'number') return command.timestamp;
    const eventTimestamp = events?.find((event) => typeof event.timestamp === 'number')?.timestamp;
    if (typeof eventTimestamp === 'number') return eventTimestamp;
    return 0;
};

// ============================================================================
// 命令 / 事件
// ============================================================================

export const FLOW_COMMANDS = {
    ADVANCE_PHASE: 'ADVANCE_PHASE',
} as const;

export const FLOW_EVENTS = {
    PHASE_CHANGED: 'SYS_PHASE_CHANGED',
} as const;

export interface PhaseChangedEvent extends GameEvent<typeof FLOW_EVENTS.PHASE_CHANGED> {
    payload: {
        from: string;
        to: string;
        /** 用于 UI/日志展示（由游戏提供语义） */
        activePlayerId: PlayerId;
    };
}

// ============================================================================
// 钩子
// ============================================================================

export interface CanAdvanceResult {
    ok: boolean;
    error?: string;
}

export interface PhaseExitResult {
    /** 产生的事件（领域事件 or 系统事件均可） */
    events?: GameEvent[];
    /** 如果为 true：不切换 phase，但事件仍会被应用 */
    halt?: boolean;
    /** 覆盖下一阶段 */
    overrideNextPhase?: string;
    /** 如果能力创建了 Interaction，返回更新后的 matchState */
    updatedState?: MatchState<any>;
}

/** onPhaseEnter 的结构化返回值（进入阶段后产生事件 + 可选的 sys 状态更新） */
export interface PhaseEnterResult {
    /** 产生的事件（领域事件 or 系统事件均可） */
    events?: GameEvent[];
    /** 如果基地能力/ongoing 效果创建了 Interaction，返回更新后的 matchState */
    updatedState?: MatchState<any>;
}

export interface FlowHooks<TCore = unknown> {
    /** 初始阶段 */
    initialPhase: string;

    /** 是否允许推进（可返回错误原因） */
    canAdvance?(args: {
        state: Readonly<MatchState<TCore>>;
        from: string;
        command: Command;
    }): CanAdvanceResult;

    /** 计算下一阶段 */
    getNextPhase(args: {
        state: Readonly<MatchState<TCore>>;
        from: string;
        command: Command;
    }): string;

    /** 离开阶段时产生的事件（可阻止切换或覆盖下一阶段） */
    onPhaseExit?(args: {
        state: Readonly<MatchState<TCore>>;
        from: string;
        to: string;
        command: Command;
        random: RandomFn;
    }): GameEvent[] | PhaseExitResult | void;

    /** 进入阶段时产生的事件（可携带 updatedState 传播 sys 变更，如 Interaction） */
    onPhaseEnter?(args: {
        state: Readonly<MatchState<TCore>>;
        from: string;
        to: string;
        command: Command;
        random: RandomFn;
    }): GameEvent[] | PhaseEnterResult | void;

    /** 用于 SYS_PHASE_CHANGED 事件的 activePlayerId（可选） */
    getActivePlayerId?(args: {
        state: Readonly<MatchState<TCore>>;
        from: string;
        to: string;
        command: Command;
        /** onPhaseExit 产生的事件（尚未 reduce 进 core） */
        exitEvents?: GameEvent[];
    }): PlayerId;

    /**
     * 事件触发的自动流程继续
     * 当收到特定事件后，游戏层可决定是否自动继续阶段推进
     * @returns 如果返回 autoContinue: true，则自动执行 ADVANCE_PHASE 逻辑
     *          playerId 必须指定，用于构造虚拟命令
     */
    onAutoContinueCheck?(args: {
        state: Readonly<MatchState<TCore>>;
        events: GameEvent[];
        random: RandomFn;
    }): { autoContinue: boolean; playerId: PlayerId } | void;

    /**
     * 获取当前活跃玩家 ID（用于 ADVANCE_PHASE 命令的发送者校验）
     * 
     * 与 getActivePlayerId 不同：此方法只返回"当前阶段应该操作的玩家"，
     * 不涉及阶段转换后的活跃玩家计算。
     * 
     * 引擎层在执行 ADVANCE_PHASE 前自动校验 command.playerId === getCurrentPlayerId，
     * 防止快速点击导致命令队列越过回合边界。
     * 
     * 可选：未提供时不做校验（向后兼容）。
     */
    getCurrentPlayerId?(args: {
        state: Readonly<MatchState<TCore>>;
    }): PlayerId;
}

// ============================================================================
// 配置
// ============================================================================

export interface FlowSystemConfig<TCore = unknown> {
    hooks: FlowHooks<TCore>;
}

// ============================================================================
// 辅助
// ============================================================================

export function getCurrentPhase<TCore>(state: MatchState<TCore>): string {
    return state.sys.phase;
}

export function setPhase<TCore>(state: MatchState<TCore>, phase: string): MatchState<TCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            phase,
        },
    };
}

// ============================================================================
// 阶段推进通用逻辑
// ============================================================================

interface PhaseAdvanceParams<TCore> {
    state: MatchState<TCore>;
    command: Command;
    random: RandomFn;
    hooks: FlowHooks<TCore>;
    logLabel: 'beforeCommand' | 'afterEvents';
    timestamp: number;
    playerIds?: PlayerId[];
    invalidPlayerStrategy: 'error' | 'ignore';
    haltOnExit: boolean;
}

function executePhaseAdvance<TCore>(params: PhaseAdvanceParams<TCore>): HookResult<TCore> | void {
    const { state, command, random, hooks, logLabel, timestamp, playerIds, invalidPlayerStrategy, haltOnExit } = params;

    if (playerIds && !playerIds.includes(command.playerId)) {
        return invalidPlayerStrategy === 'error' ? { halt: true, error: 'player_mismatch' } : undefined;
    }

    const from = getCurrentPhase(state) || hooks.initialPhase;
    logDev(`[FlowSystem][${logLabel}] ADVANCE_PHASE from=${from} playerId=${command.playerId}`);

    // 引擎层通用校验：命令发送者必须是当前活跃玩家
    // 防止快速点击导致命令队列越过回合边界，推进对手的阶段
    if (hooks.getCurrentPlayerId) {
        const currentPlayerId = hooks.getCurrentPlayerId({ state });
        if (command.playerId !== currentPlayerId) {
            logDev(`[FlowSystem][${logLabel}] rejected: command.playerId=${command.playerId} !== currentPlayerId=${currentPlayerId}`);
            return invalidPlayerStrategy === 'error'
                ? { halt: true, error: 'not_active_player' }
                : undefined;
        }
    }

    const can = hooks.canAdvance?.({ state, from, command }) ?? { ok: true };
    if (!can.ok) {
        logDev(`[FlowSystem][${logLabel}] canAdvance failed: ${can.error}`);
        return invalidPlayerStrategy === 'error'
            ? { halt: true, error: can.error ?? 'cannot_advance_phase' }
            : undefined;
    }

    let to = hooks.getNextPhase({ state, from, command });
    logDev(`[FlowSystem][${logLabel}] getNextPhase returned to=${to}`);

    const exit = hooks.onPhaseExit?.({ state, from, to, command, random });

    let exitEvents: GameEvent[] = [];
    let shouldHalt = false;
    let updatedState: MatchState<TCore> | undefined;

    if (exit) {
        if (Array.isArray(exit)) {
            exitEvents = exit;
        } else {
            exitEvents = exit.events ?? [];
            shouldHalt = exit.halt ?? false;
            updatedState = exit.updatedState as MatchState<TCore> | undefined;
            if (exit.overrideNextPhase) {
                to = exit.overrideNextPhase;
                logDev(`[FlowSystem][${logLabel}] overrideNextPhase to=${to}`);
            }
        }
    }

    if (shouldHalt) {
        logDev(`[FlowSystem][${logLabel}] halt=true, not advancing`);
        const haltedState = updatedState ?? state;
        return {
            halt: haltOnExit ? true : undefined,
            state: {
                ...haltedState,
                sys: { ...haltedState.sys, flowHalted: true },
            },
            events: exitEvents,
        };
    }

    const nextState = setPhase(state, to);
    // 阶段成功推进，清除 halt 标记
    nextState.sys = { ...nextState.sys, flowHalted: false };
    logDev(`[FlowSystem][${logLabel}] phase updated from=${from} to=${to}`);

    const activePlayerId = hooks.getActivePlayerId?.({ state: nextState, from, to, command, exitEvents }) ?? command.playerId;
    const phaseChanged: PhaseChangedEvent = {
        type: FLOW_EVENTS.PHASE_CHANGED,
        payload: { from, to, activePlayerId },
        timestamp,
    };

    const enter = hooks.onPhaseEnter?.({ state: nextState, from, to, command, random });
    let enterEvents: GameEvent[] = [];
    let enterUpdatedState: MatchState<TCore> | undefined;

    if (enter) {
        if (Array.isArray(enter)) {
            enterEvents = enter;
        } else {
            enterEvents = enter.events ?? [];
            enterUpdatedState = enter.updatedState as MatchState<TCore> | undefined;
        }
    }

    // 如果 onPhaseEnter 返回了 updatedState（如基地能力创建了 Interaction），
    // 合并 sys 到 nextState，确保 Interaction 等 sys 变更不丢失
    const finalState = enterUpdatedState
        ? { ...nextState, sys: { ...enterUpdatedState.sys, phase: to, flowHalted: false } }
        : nextState;

    return {
        halt: haltOnExit ? true : undefined,
        state: finalState,
        events: [...exitEvents, phaseChanged, ...enterEvents],
    };
}

// ============================================================================
// 创建系统
// ============================================================================

export function createFlowSystem<TCore>(config: FlowSystemConfig<TCore>): EngineSystem<TCore> {
    const { hooks } = config;

    return {
        id: SYSTEM_IDS.FLOW,
        name: '流程系统',
        // 必须晚于 ResponseWindow(15) / Prompt(20) 的拦截，避免绕过系统级阻塞
        priority: 25,

        setup: (): Partial<{ phase: string }> => ({ phase: hooks.initialPhase }),

        beforeCommand: ({ state, command, random, playerIds }): HookResult<TCore> | void => {
            if (command.type !== FLOW_COMMANDS.ADVANCE_PHASE) return;
            return executePhaseAdvance({
                state,
                command,
                random,
                hooks,
                logLabel: 'beforeCommand',
                timestamp: resolveTimestamp(command),
                playerIds,
                invalidPlayerStrategy: 'error',
                haltOnExit: true,
            });
        },

        afterEvents: ({ state, events, random, playerIds }): HookResult<TCore> | void => {
            // 检查是否需要自动继续流程
            if (!hooks.onAutoContinueCheck) return;

            const result = hooks.onAutoContinueCheck({ state, events, random });
            if (!result?.autoContinue) return;

            if (!playerIds.includes(result.playerId)) {
                return;
            }

            // 自动继续：执行与 ADVANCE_PHASE 相同的逻辑
            const from = getCurrentPhase(state) || hooks.initialPhase;
            const { playerId } = result;
            const syntheticCommand: Command = {
                type: FLOW_COMMANDS.ADVANCE_PHASE,
                playerId,
                payload: undefined,
            };
            logDev(`[FlowSystem][afterEvents] autoContinue from=${from} playerId=${playerId}`);

            return executePhaseAdvance({
                state,
                command: syntheticCommand,
                random,
                hooks,
                logLabel: 'afterEvents',
                timestamp: resolveTimestamp(undefined, events),
                playerIds,
                invalidPlayerStrategy: 'ignore',
                haltOnExit: false,
            });
        },
    };
}
