/**
 * SimpleChoiceSystem：处理 simple-choice 交互。
 *
 * InteractionSystem 只负责队列、通用阻塞和 playerView，
 * 这里负责 simple-choice 的具体响应与超时逻辑。
 */

import type { GameEvent, MatchState, PlayerId } from '../types';
import { resolveCommandTimestamp } from '../utils';
import {
    getFreshSimpleChoiceOptions,
    getSimpleChoiceResponseValidationMode,
    INTERACTION_COMMANDS,
    INTERACTION_EVENTS,
    isControlChoiceValue,
    resolveInteraction,
    stripNonSerializableFromData,
    type PromptOption,
    type SimpleChoiceData,
} from './InteractionSystem';
import type { EngineSystem, HookResult } from './types';

function isSamePlayerId(a: unknown, b: unknown): boolean {
    if (a === undefined || a === null || b === undefined || b === null) return false;
    return String(a) === String(b);
}

export interface SimpleChoiceSystemConfig {
    defaultTimeout?: number;
}

export function createSimpleChoiceSystem<TCore>(
    _config: SimpleChoiceSystemConfig = {},
): EngineSystem<TCore> {
    return {
        id: 'simple-choice',
        name: 'SimpleChoice 响应处理',
        priority: 21,

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            const current = state.sys.interaction.current;

            if (command.type === INTERACTION_COMMANDS.RESPOND) {
                if (!current) {
                    return { halt: true, error: '没有待处理的选择' };
                }
                if (current.kind !== 'simple-choice') return;

                const timestamp = resolveCommandTimestamp(command);
                return handleSimpleChoiceRespond(
                    state,
                    command.playerId,
                    command.payload as { optionId?: string; optionIds?: string[]; mergedValue?: unknown },
                    timestamp,
                );
            }

            if (command.type === INTERACTION_COMMANDS.TIMEOUT) {
                if (!current || current.kind !== 'simple-choice') return;
                const timestamp = resolveCommandTimestamp(command);
                return handleSimpleChoiceTimeout(state, timestamp);
            }

            if (current?.kind === 'simple-choice') {
                const simpleChoiceData = current.data as SimpleChoiceData;
                const allowedCommands = new Set(simpleChoiceData.allowedCommands ?? []);
                const hasActiveResponseWindow = !!state.sys.responseWindow?.current;
                if (
                    isSamePlayerId(current.playerId, command.playerId)
                    && !command.type.startsWith('SYS_')
                    && !allowedCommands.has(command.type)
                    && !hasActiveResponseWindow
                ) {
                    return { halt: true, error: '请先完成当前选择' };
                }
            }
        },

        afterEvents: ({ state, events }): HookResult<TCore> | void => {
            const current = state.sys.interaction.current;
            if (!current || current.kind !== 'simple-choice') return;

            const data = current.data as SimpleChoiceData;
            if (data.autoResolveIfSingle !== true || data.multi) return;

            const availableOptions = getFreshSimpleChoiceOptions(state, current as any);
            if (availableOptions.length !== 1) return;

            const onlyOption = availableOptions[0];
            if (!onlyOption || onlyOption.disabled) return;

            const newState = resolveInteraction(state);
            const timestamp = events[events.length - 1]?.timestamp ?? 0;

            const event: GameEvent = {
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: current.id,
                    playerId: current.playerId,
                    optionId: onlyOption.id,
                    optionIds: undefined,
                    value: onlyOption.value,
                    sourceId: data.sourceId,
                    interactionData: stripNonSerializableFromData({
                        ...data,
                        options: availableOptions,
                    }),
                },
                timestamp,
            };

            return { halt: false, state: newState, events: [event] };
        },
    };
}

function handleSimpleChoiceRespond<TCore>(
    state: MatchState<TCore>,
    playerId: PlayerId,
    payload: { interactionId?: unknown; optionId?: string; optionIds?: string[]; mergedValue?: unknown },
    timestamp: number,
): HookResult<TCore> {
    const current = state.sys.interaction.current;

    if (!current) {
        return { halt: true, error: '没有待处理的选择' };
    }
    if (!isSamePlayerId(current.playerId, playerId)) {
        return { halt: true, error: '不是你的选择回合' };
    }
    if (current.kind !== 'simple-choice') {
        return { halt: true, error: '当前交互不是 simple-choice' };
    }
    if (typeof payload.interactionId === 'string' && payload.interactionId !== current.id) {
        return { halt: true, error: '交互已过期' };
    }

    const data = current.data as SimpleChoiceData;
    const isMulti = !!data.multi;
    const responseValidationMode = getSimpleChoiceResponseValidationMode(data);
    const availableOptions = responseValidationMode === 'live'
        ? getFreshSimpleChoiceOptions(state, current as any)
        : data.options;

    let selectedOptions: PromptOption[] = [];
    let selectedOptionIds: string[] = [];

    if (isMulti) {
        const optionIds = Array.isArray(payload.optionIds)
            ? payload.optionIds
            : typeof payload.optionId === 'string'
                ? [payload.optionId]
                : [];
        const uniqueIds = Array.from(new Set(optionIds)).filter(
            (id): id is string => typeof id === 'string',
        );
        const optionsById = new Map(availableOptions.map((option) => [option.id, option]));

        if (uniqueIds.some((id) => !optionsById.has(id))) {
            return { halt: true, error: '无效的选择' };
        }
        if (uniqueIds.some((id) => optionsById.get(id)?.disabled)) {
            return { halt: true, error: '该选项不可用' };
        }

        selectedOptionIds = uniqueIds;
        selectedOptions = uniqueIds.map((id) => optionsById.get(id)!);
        const selectedSingleRecovery = selectedOptions.length === 1
            && isControlChoiceValue(selectedOptions[0]?.value);

        const minSelections = data.multi?.min ?? 1;
        const maxSelections = data.multi?.max;
        if (!selectedSingleRecovery && uniqueIds.length < minSelections) {
            return { halt: true, error: `至少选择 ${minSelections} 项` };
        }
        if (!selectedSingleRecovery && maxSelections !== undefined && uniqueIds.length > maxSelections) {
            return { halt: true, error: `最多选择 ${maxSelections} 项` };
        }
    } else {
        if (typeof payload.optionId !== 'string') {
            return { halt: true, error: '无效的选择' };
        }

        const selectedOption = availableOptions.find((option) => option.id === payload.optionId);
        if (!selectedOption) {
            return { halt: true, error: '无效的选择' };
        }
        if (selectedOption.disabled) {
            return { halt: true, error: '该选项不可用' };
        }

        selectedOptionIds = [selectedOption.id];
        selectedOptions = [selectedOption];
    }

    let resolvedValue: unknown;
    if (payload.mergedValue !== undefined) {
        if (isMulti) {
            return { halt: true, error: '非法的选择值' };
        }

        const selectedOptionValue = selectedOptions[0]?.value;
        if (!selectedOptionValue || typeof selectedOptionValue !== 'object' || Array.isArray(selectedOptionValue)) {
            return { halt: true, error: '非法的选择值' };
        }

        const mergedValue = payload.mergedValue;
        if (!mergedValue || typeof mergedValue !== 'object' || Array.isArray(mergedValue)) {
            return { halt: true, error: '非法的选择值' };
        }

        const selectedOptionRecord = selectedOptionValue as Record<string, unknown>;

        if (data.slider) {
            const selectedNumericValue = (selectedOptionValue as { value?: unknown }).value;
            const mergedNumericValue = (mergedValue as { value?: unknown }).value;
            if (
                typeof selectedNumericValue !== 'number'
                || !Number.isFinite(selectedNumericValue)
                || typeof mergedNumericValue !== 'number'
                || !Number.isFinite(mergedNumericValue)
                || !Number.isInteger(mergedNumericValue)
                || mergedNumericValue < 1
                || mergedNumericValue > selectedNumericValue
            ) {
                return { halt: true, error: '非法的选择值' };
            }

            const resolvedSliderValue: Record<string, unknown> = {
                ...selectedOptionRecord,
                value: mergedNumericValue,
            };
            if (typeof selectedOptionRecord.amount === 'number' && Number.isFinite(selectedOptionRecord.amount)) {
                resolvedSliderValue.amount = mergedNumericValue;
            }
            resolvedValue = resolvedSliderValue;
        } else if (data.targetType === 'discard_minion') {
            resolvedValue = {
                ...selectedOptionRecord,
                ...(mergedValue as Record<string, unknown>),
            };
        } else {
            const mergedRecord = mergedValue as Record<string, unknown>;
            const hasConflict = Object.keys(mergedRecord).some((key) => key in selectedOptionRecord);
            if (hasConflict) {
                return { halt: true, error: '非法的选择值' };
            }
            resolvedValue = {
                ...selectedOptionRecord,
                ...mergedRecord,
            };
        }
    } else {
        const isSingleRecoveryChoice = isMulti
            && selectedOptions.length === 1
            && isControlChoiceValue(selectedOptions[0]?.value);
        resolvedValue = isSingleRecoveryChoice
            ? selectedOptions[0]?.value
            : isMulti
                ? selectedOptions.map((option) => option.value)
                : selectedOptions[0]?.value;
    }

    const newState = resolveInteraction(state);
    // live 校验只用于“当前是否还能选这个 option”的判断；
    // 事件里仍需携带原始交互快照，避免下游系统把刷新后的 options 误判成“不是同一个 blocker”。
    const interactionDataForEvent = current.data;
    const isEmergencySkip = Boolean(
        resolvedValue
        && typeof resolvedValue === 'object'
        && (resolvedValue as { __emergency_skip__?: boolean }).__emergency_skip__ === true
    );
    const emergencySkipReason = resolvedValue
        && typeof resolvedValue === 'object'
        ? (resolvedValue as { __emergency_skip_reason__?: unknown }).__emergency_skip_reason__
        : undefined;

    const event: GameEvent = {
        type: isEmergencySkip ? INTERACTION_EVENTS.CANCELLED : INTERACTION_EVENTS.RESOLVED,
        payload: {
            interactionId: current.id,
            playerId,
            optionId: selectedOptionIds.length > 0 ? selectedOptionIds[0] : null,
            optionIds: isMulti ? selectedOptionIds : undefined,
            value: resolvedValue,
            sourceId: data.sourceId,
            interactionData: stripNonSerializableFromData(interactionDataForEvent),
            ...(isEmergencySkip ? {
                reason: typeof emergencySkipReason === 'string' ? emergencySkipReason : 'empty-options',
            } : {}),
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
