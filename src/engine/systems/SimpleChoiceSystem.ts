/**
 * SimpleChoiceSystem — simple-choice 交互的响应处理
 *
 * 从 InteractionSystem 拆出，专门处理 simple-choice kind 的：
 * - 响应校验（选项合法性、多选数量）
 * - 超时处理
 * - 阻塞逻辑（该玩家的非系统命令被阻塞）
 *
 * InteractionSystem 只管队列/通用阻塞/playerView，不处理任何具体 kind。
 */

import type { MatchState, PlayerId, GameEvent } from '../types';
import { resolveCommandTimestamp } from '../utils';
import type { EngineSystem, HookResult } from './types';
import {
    INTERACTION_COMMANDS,
    INTERACTION_EVENTS,
    resolveInteraction,
    type SimpleChoiceData,
    type PromptOption,
} from './InteractionSystem';

// ============================================================================
// 系统配置
// ============================================================================

export interface SimpleChoiceSystemConfig {
    /** 默认超时时间（毫秒） */
    defaultTimeout?: number;
}

// ============================================================================
// 创建 SimpleChoiceSystem
// ============================================================================

export function createSimpleChoiceSystem<TCore>(
    _config: SimpleChoiceSystemConfig = {},
): EngineSystem<TCore> {
    return {
        id: 'simple-choice',
        name: 'SimpleChoice 响应处理',
        priority: 21, // 在 InteractionSystem(20) 之后

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            const current = state.sys.interaction.current;

            // ---- simple-choice 响应 ----
            if (command.type === INTERACTION_COMMANDS.RESPOND) {
                if (!current) {
                    return { halt: true, error: '没有待处理的选择' };
                }
                // 只处理 simple-choice，其他 kind 放行到游戏层
                if (current.kind !== 'simple-choice') return;

                const ts = resolveCommandTimestamp(command);
                return handleSimpleChoiceRespond(state, command.playerId, command.payload as any, ts);
            }

            // ---- simple-choice 超时 ----
            if (command.type === INTERACTION_COMMANDS.TIMEOUT) {
                if (!current || current.kind !== 'simple-choice') return;
                const ts = resolveCommandTimestamp(command);
                return handleSimpleChoiceTimeout(state, ts);
            }

            // ---- simple-choice 阻塞：该玩家的非系统命令被阻塞 ----
            if (current?.kind === 'simple-choice') {
                if (current.playerId === command.playerId && !command.type.startsWith('SYS_')) {
                    return { halt: true, error: '请先完成当前选择' };
                }
            }
        },
    };
}


// ============================================================================
// simple-choice 处理函数（从 InteractionSystem 搬过来）
// ============================================================================

function handleSimpleChoiceRespond<TCore>(
    state: MatchState<TCore>,
    playerId: PlayerId,
    payload: { optionId?: string; optionIds?: string[]; mergedValue?: unknown },
    timestamp: number,
): HookResult<TCore> {
    const current = state.sys.interaction.current;

    if (!current) {
        return { halt: true, error: '没有待处理的选择' };
    }
    if (current.playerId !== playerId) {
        return { halt: true, error: '不是你的选择回合' };
    }
    if (current.kind !== 'simple-choice') {
        return { halt: true, error: '当前交互不是 simple-choice' };
    }

    const data = current.data as SimpleChoiceData;
    const isMulti = !!data.multi;
    let selectedOptions: PromptOption[] = [];
    let selectedOptionIds: string[] = [];

    if (isMulti) {
        const optionIds = Array.isArray(payload.optionIds)
            ? payload.optionIds
            : typeof payload.optionId === 'string'
              ? [payload.optionId]
              : [];
        const uniqueIds = Array.from(new Set(optionIds)).filter(
            (id) => typeof id === 'string',
        );
        const optionsById = new Map(data.options.map((o) => [o.id, o]));
        if (uniqueIds.find((id) => !optionsById.has(id))) {
            return { halt: true, error: '无效的选择' };
        }
        if (uniqueIds.find((id) => optionsById.get(id)?.disabled)) {
            return { halt: true, error: '该选项不可用' };
        }
        const minSelections = data.multi?.min ?? 1;
        const maxSelections = data.multi?.max;
        if (uniqueIds.length < minSelections) {
            return { halt: true, error: `至少选择 ${minSelections} 项` };
        }
        if (maxSelections !== undefined && uniqueIds.length > maxSelections) {
            return { halt: true, error: `最多选择 ${maxSelections} 项` };
        }
        selectedOptionIds = uniqueIds;
        selectedOptions = uniqueIds.map((id) => optionsById.get(id)!);
    } else {
        if (typeof payload.optionId !== 'string') {
            return { halt: true, error: '无效的选择' };
        }
        const selectedOption = data.options.find(
            (o) => o.id === payload.optionId,
        );
        if (!selectedOption) {
            return { halt: true, error: '无效的选择' };
        }
        if (selectedOption.disabled) {
            return { halt: true, error: '该选项不可用' };
        }
        selectedOptionIds = [selectedOption.id];
        selectedOptions = [selectedOption];
    }

    const newState = resolveInteraction(state);

    const resolvedValue = payload.mergedValue !== undefined
        ? payload.mergedValue
        : isMulti
            ? selectedOptions.map((o) => o.value)
            : selectedOptions[0]?.value;

    const event: GameEvent = {
        type: INTERACTION_EVENTS.RESOLVED,
        payload: {
            interactionId: current.id,
            playerId,
            optionId:
                selectedOptionIds.length > 0 ? selectedOptionIds[0] : null,
            optionIds: isMulti ? selectedOptionIds : undefined,
            value: resolvedValue,
            sourceId: data.sourceId,
            interactionData: current.data,
        },
        timestamp,
    };

    return { halt: false, state: newState, events: [event] };
}

function handleSimpleChoiceTimeout<TCore>(
    state: MatchState<TCore>,
    timestamp: number,
): HookResult<TCore> {
    const current = state.sys.interaction.current;

    if (!current) {
        return { halt: true, error: '没有待处理的选择' };
    }
    if (current.kind !== 'simple-choice') {
        return { halt: true, error: '当前交互不是 simple-choice' };
    }

    const data = current.data as SimpleChoiceData;
    const newState = resolveInteraction(state);

    const event: GameEvent = {
        type: INTERACTION_EVENTS.EXPIRED,
        payload: {
            interactionId: current.id,
            playerId: current.playerId,
            sourceId: data.sourceId,
        },
        timestamp,
    };

    return { state: newState, events: [event] };
}
