/**
 * Prompt/Choice 系统
 * 
 * 统一的选择/提示协议，替代各游戏自造 pendingChoice
 */

import type { MatchState, PlayerId, PromptOption, PromptState, GameEvent } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

// ============================================================================
// Prompt 系统配置
// ============================================================================

export interface PromptSystemConfig {
    /** 默认超时时间（毫秒） */
    defaultTimeout?: number;
}

// ============================================================================
// Prompt 命令类型
// ============================================================================

export const PROMPT_COMMANDS = {
    RESPOND: 'SYS_PROMPT_RESPOND',
    TIMEOUT: 'SYS_PROMPT_TIMEOUT',
} as const;

// ============================================================================
// Prompt 事件类型
// ============================================================================

export const PROMPT_EVENTS = {
    CREATED: 'SYS_PROMPT_CREATED',
    RESOLVED: 'SYS_PROMPT_RESOLVED',
    EXPIRED: 'SYS_PROMPT_EXPIRED',
} as const;

// ============================================================================
// Prompt 辅助函数
// ============================================================================

/**
 * 创建 Prompt
 */
export function createPrompt<T>(
    id: string,
    playerId: PlayerId,
    title: string,
    options: PromptOption<T>[],
    sourceId?: string,
    timeout?: number
): PromptState<T>['current'] {
    return {
        id,
        playerId,
        title,
        options,
        sourceId,
        timeout,
    };
}

/**
 * 将 Prompt 加入队列
 */
export function queuePrompt<TCore, T>(
    state: MatchState<TCore>,
    prompt: PromptState<T>['current']
): MatchState<TCore> {
    if (!prompt) return state;

    const { current, queue } = state.sys.prompt;

    // 如果没有当前 prompt，直接设为当前
    if (!current) {
        return {
            ...state,
            sys: {
                ...state.sys,
                prompt: {
                    ...state.sys.prompt,
                    current: prompt as PromptState['current'],
                },
            },
        };
    }

    // 否则加入队列
    return {
        ...state,
        sys: {
            ...state.sys,
            prompt: {
                ...state.sys.prompt,
                queue: [...queue, prompt as PromptState['current']],
            },
        },
    };
}

/**
 * 解决当前 Prompt 并弹出下一个
 */
export function resolvePrompt<TCore>(
    state: MatchState<TCore>
): MatchState<TCore> {
    const { queue } = state.sys.prompt;
    const nextPrompt = queue[0];
    const newQueue = queue.slice(1);

    return {
        ...state,
        sys: {
            ...state.sys,
            prompt: {
                current: nextPrompt,
                queue: newQueue,
            },
        },
    };
}

// ============================================================================
// 创建 Prompt 系统
// ============================================================================

export function createPromptSystem<TCore>(
    _config: PromptSystemConfig = {}
): EngineSystem<TCore> {
    return {
        id: SYSTEM_IDS.PROMPT,
        name: 'Prompt 系统',
        priority: 20,

        setup: (): Partial<{ prompt: PromptState }> => ({
            prompt: {
                queue: [],
            },
        }),

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            // 处理 Prompt 响应命令
            if (command.type === PROMPT_COMMANDS.RESPOND) {
                return handlePromptResponse(state, command.playerId, command.payload as { optionId: string });
            }
            if (command.type === PROMPT_COMMANDS.TIMEOUT) {
                return handlePromptTimeout(state);
            }

            // 如果有 Prompt 待处理，阻止其他命令
            if (state.sys.prompt.current && state.sys.prompt.current.playerId === command.playerId) {
                // 允许 Prompt 相关命令
                if (!command.type.startsWith('SYS_PROMPT_')) {
                    return { halt: true, error: '请先完成当前选择' };
                }
            }
        },

        playerView: (state, playerId): Partial<{ prompt: PromptState }> => {
            // 只显示与当前玩家相关的 Prompt
            const { current, queue } = state.sys.prompt;

            const filteredCurrent = current?.playerId === playerId ? current : undefined;
            const filteredQueue = queue.filter(p => p?.playerId === playerId);

            return {
                prompt: {
                    current: filteredCurrent,
                    queue: filteredQueue,
                },
            };
        },
    };
}

// ============================================================================
// Prompt 处理函数
// ============================================================================

function handlePromptResponse<TCore>(
    state: MatchState<TCore>,
    playerId: PlayerId,
    payload: { optionId: string }
): HookResult<TCore> {
    const { current } = state.sys.prompt;

    if (!current) {
        return { halt: true, error: '没有待处理的选择' };
    }

    if (current.playerId !== playerId) {
        return { halt: true, error: '不是你的选择回合' };
    }

    const selectedOption = current.options.find(o => o.id === payload.optionId);
    if (!selectedOption) {
        return { halt: true, error: '无效的选择' };
    }

    if (selectedOption.disabled) {
        return { halt: true, error: '该选项不可用' };
    }

    // 解决 Prompt 并弹出下一个
    const newState = resolvePrompt(state);

    // 生成 Prompt 解决事件
    const event: GameEvent = {
        type: PROMPT_EVENTS.RESOLVED,
        payload: {
            promptId: current.id,
            playerId,
            optionId: payload.optionId,
            value: selectedOption.value,
        },
        timestamp: Date.now(),
    };

    return {
        halt: false, // 允许后续处理（游戏逻辑可能需要处理选择结果）
        state: newState,
        events: [event],
    };
}

function handlePromptTimeout<TCore>(state: MatchState<TCore>): HookResult<TCore> {
    const { current } = state.sys.prompt;

    if (!current) {
        return { halt: true, error: '没有待处理的选择' };
    }

    // 解决 Prompt
    const newState = resolvePrompt(state);

    // 生成 Prompt 超时事件
    const event: GameEvent = {
        type: PROMPT_EVENTS.EXPIRED,
        payload: {
            promptId: current.id,
            playerId: current.playerId,
        },
        timestamp: Date.now(),
    };

    return {
        state: newState,
        events: [event],
    };
}
