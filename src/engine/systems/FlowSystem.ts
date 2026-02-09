/**
 * 流程系统 (FlowSystem)
 *
 * 目标：
 * - sys.phase 是阶段的单一权威来源
 * - ADVANCE_PHASE 统一由 FlowSystem 处理（系统消费命令）
 * - 游戏层通过 FlowHooks 定义阶段规则与阶段副作用（事件）
 */

import type { Command, GameEvent, MatchState, PlayerId, RandomFn } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
const logDev = (...args: unknown[]) => {
    if (isDev) {
        console.log(...args);
    }
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
}

export interface FlowHooks<TCore = unknown> {
    /** 初始阶段 */
    initialPhase: string;

    /** 是否允许推进（可返回错误原因） */
    canAdvance?(args: {
        state: MatchState<TCore>;
        from: string;
        command: Command;
    }): CanAdvanceResult;

    /** 计算下一阶段 */
    getNextPhase(args: {
        state: MatchState<TCore>;
        from: string;
        command: Command;
    }): string;

    /** 离开阶段时产生的事件（可阻止切换或覆盖下一阶段） */
    onPhaseExit?(args: {
        state: MatchState<TCore>;
        from: string;
        to: string;
        command: Command;
        random: RandomFn;
    }): GameEvent[] | PhaseExitResult | void;

    /** 进入阶段时产生的事件 */
    onPhaseEnter?(args: {
        state: MatchState<TCore>; // 注意：此时 sys.phase 已更新
        from: string;
        to: string;
        command: Command;
        random: RandomFn;
    }): GameEvent[] | void;

    /** 用于 SYS_PHASE_CHANGED 事件的 activePlayerId（可选） */
    getActivePlayerId?(args: {
        state: MatchState<TCore>;
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
        state: MatchState<TCore>;
        events: GameEvent[];
        random: RandomFn;
    }): { autoContinue: boolean; playerId: PlayerId } | void;
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

        beforeCommand: ({ state, command, random }): HookResult<TCore> | void => {
            if (command.type !== FLOW_COMMANDS.ADVANCE_PHASE) return;

            const from = getCurrentPhase(state) || hooks.initialPhase;
            logDev(`[FlowSystem][beforeCommand] ADVANCE_PHASE from=${from} playerId=${command.playerId}`);

            // canAdvance 校验
            const can = hooks.canAdvance?.({ state, from, command }) ?? { ok: true };
            if (!can.ok) {
                logDev(`[FlowSystem][beforeCommand] canAdvance failed: ${can.error}`);
                return { halt: true, error: can.error ?? 'cannot_advance_phase' };
            }

            // 计算下一阶段
            let to = hooks.getNextPhase({ state, from, command });
            logDev(`[FlowSystem][beforeCommand] getNextPhase returned to=${to}`);

            // 离开阶段钩子
            const exit = hooks.onPhaseExit?.({ state, from, to, command, random });

            let exitEvents: GameEvent[] = [];
            let shouldHalt = false;

            if (exit) {
                if (Array.isArray(exit)) {
                    exitEvents = exit;
                } else {
                    exitEvents = exit.events ?? [];
                    shouldHalt = exit.halt ?? false;
                    if (exit.overrideNextPhase) {
                        to = exit.overrideNextPhase;
                        logDev(`[FlowSystem][beforeCommand] overrideNextPhase to=${to}`);
                    }
                }
            }

            if (shouldHalt) {
                // 不切换阶段
                logDev(`[FlowSystem][beforeCommand] halt=true, not advancing`);
                return {
                    halt: true,
                    state,
                    events: exitEvents,
                };
            }

            // 更新 sys.phase
            const nextState = setPhase(state, to);
            logDev(`[FlowSystem][beforeCommand] phase updated from=${from} to=${to}`);

            // 生成系统事件（用于 UI/日志）
            const activePlayerId = hooks.getActivePlayerId?.({ state: nextState, from, to, command, exitEvents }) ?? command.playerId;
            const phaseChanged: PhaseChangedEvent = {
                type: FLOW_EVENTS.PHASE_CHANGED,
                payload: { from, to, activePlayerId },
                timestamp: Date.now(),
            };

            // 进入阶段钩子
            const enter = hooks.onPhaseEnter?.({ state: nextState, from, to, command, random });
            const enterEvents = Array.isArray(enter) ? enter : (enter ?? []);

            // 系统消费命令：由管线负责将非 SYS_ 事件 reduce 进 core，并执行 afterEvents hooks
            return {
                halt: true,
                state: nextState,
                events: [...exitEvents, phaseChanged, ...enterEvents],
            };
        },

        afterEvents: ({ state, events, random }): HookResult<TCore> | void => {
            // 检查是否需要自动继续流程
            if (!hooks.onAutoContinueCheck) return;

            const result = hooks.onAutoContinueCheck({ state, events, random });
            if (!result?.autoContinue) return;

            // 自动继续：执行与 ADVANCE_PHASE 相同的逻辑
            const from = getCurrentPhase(state) || hooks.initialPhase;
            const { playerId } = result;
            const syntheticCommand: Command = {
                type: FLOW_COMMANDS.ADVANCE_PHASE,
                playerId,
                payload: undefined,
            };

            logDev(`[FlowSystem][afterEvents] autoContinue from=${from} playerId=${playerId}`);

            // canAdvance 校验（自动继续时通常应该允许）
            const can = hooks.canAdvance?.({ state, from, command: syntheticCommand }) ?? { ok: true };
            if (!can.ok) {
                // 自动继续被阻止，静默失败
                logDev(`[FlowSystem][afterEvents] autoContinue blocked: ${can.error}`);
                return;
            }

            // 计算下一阶段
            let to = hooks.getNextPhase({ state, from, command: syntheticCommand });
            logDev(`[FlowSystem][afterEvents] getNextPhase returned to=${to}`);

            // 离开阶段钩子
            const exit = hooks.onPhaseExit?.({ state, from, to, command: syntheticCommand, random });

            let exitEvents: GameEvent[] = [];
            let shouldHalt = false;

            if (exit) {
                if (Array.isArray(exit)) {
                    exitEvents = exit;
                } else {
                    exitEvents = exit.events ?? [];
                    shouldHalt = exit.halt ?? false;
                    if (exit.overrideNextPhase) {
                        to = exit.overrideNextPhase;
                        logDev(`[FlowSystem][afterEvents] overrideNextPhase to=${to}`);
                    }
                }
            }

            if (shouldHalt) {
                // 流程被 halt（例如又触发了新的响应窗口），只返回事件
                logDev(`[FlowSystem][afterEvents] halt=true, not advancing`);
                return {
                    state,
                    events: exitEvents,
                };
            }

            // 更新 sys.phase
            const nextState = setPhase(state, to);
            logDev(`[FlowSystem][afterEvents] phase updated from=${from} to=${to}`);

            // 生成系统事件
            const activePlayerId = hooks.getActivePlayerId?.({ state: nextState, from, to, command: syntheticCommand, exitEvents }) ?? playerId;
            const phaseChanged: PhaseChangedEvent = {
                type: FLOW_EVENTS.PHASE_CHANGED,
                payload: { from, to, activePlayerId },
                timestamp: Date.now(),
            };

            // 进入阶段钩子
            const enter = hooks.onPhaseEnter?.({ state: nextState, from, to, command: syntheticCommand, random });
            const enterEvents = Array.isArray(enter) ? enter : (enter ?? []);

            return {
                state: nextState,
                events: [...exitEvents, phaseChanged, ...enterEvents],
            };
        },
    };
}
