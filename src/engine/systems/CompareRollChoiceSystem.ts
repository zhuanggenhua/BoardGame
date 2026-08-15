/**
 * CompareRollChoiceSystem：处理 compare-roll-choice 交互。
 *
 * compare-roll-choice 主要用于“对比掷骰/摊牌”类展示后提供分支选择或确认。
 */

import type { GameEvent, PlayerId } from '../types';
import { resolveCommandTimestamp } from '../utils';
import {
    INTERACTION_COMMANDS,
    INTERACTION_EVENTS,
    resolveInteraction,
    stripNonSerializableFromData,
    type CompareRollChoiceData,
    type InteractionDescriptor,
    type PromptOption,
} from './InteractionSystem';
import type { EngineSystem, HookResult } from './types';

function isSamePlayerId(a: unknown, b: unknown): boolean {
    if (a === undefined || a === null || b === undefined || b === null) return false;
    return String(a) === String(b);
}

function getCompareRollData<T>(
    interaction?: InteractionDescriptor,
): (CompareRollChoiceData<T> & { id: string; playerId: PlayerId }) | undefined {
    if (!interaction || interaction.kind !== 'compare-roll-choice') return undefined;
    return {
        id: interaction.id,
        playerId: interaction.playerId,
        ...(interaction.data as CompareRollChoiceData<T>),
    };
}

export interface CompareRollChoiceSystemConfig {
    defaultTimeout?: number;
}

export function createCompareRollChoiceSystem<TCore>(
    _config: CompareRollChoiceSystemConfig = {},
): EngineSystem<TCore> {
    return {
        id: 'compare-roll-choice',
        name: 'CompareRollChoice 响应处理',
        priority: 22,

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            const current = state.sys.interaction.current;
            const data = getCompareRollData<unknown>(current);
            if (!data) return;

            if (!isSamePlayerId(data.playerId, command.playerId)) {
                return { halt: true, error: '不是你的选择回合' };
            }

            if (command.type === INTERACTION_COMMANDS.RESPOND) {
                const payloadInteractionId = (command.payload as { interactionId?: unknown } | undefined)?.interactionId;
                if (payloadInteractionId && payloadInteractionId !== data.id) {
                    return { halt: true, error: '交互已过期' };
                }
                const optionId = (command.payload as { optionId?: string })?.optionId;
                if (!optionId || typeof optionId !== 'string') {
                    return { halt: true, error: '无效的选择' };
                }

                const options = (data.options ?? []) as PromptOption[];
                const option = options.find((item) => item.id === optionId);
                if (!option) {
                    return { halt: true, error: '无效的选择' };
                }
                if (option.disabled) {
                    return { halt: true, error: '该选项不可用' };
                }

                const timestamp = resolveCommandTimestamp(command);
                const newState = resolveInteraction(state);
                const event: GameEvent = {
                    type: INTERACTION_EVENTS.RESOLVED,
                    payload: {
                        interactionId: data.id,
                        playerId: data.playerId,
                        optionId,
                        optionIds: undefined,
                        value: option.value,
                        sourceId: data.sourceId,
                        interactionData: stripNonSerializableFromData(data),
                    },
                    timestamp,
                };
                return { halt: false, state: newState, events: [event] };
            }

            if (command.type === INTERACTION_COMMANDS.CONFIRM) {
                const payloadInteractionId = (command.payload as { interactionId?: unknown } | undefined)?.interactionId;

                if (payloadInteractionId && payloadInteractionId !== data.id) {
                    return { halt: true, error: '交互已过期' };
                }
                if (data.confirmValue === undefined) {
                    return { halt: true, error: '当前交互不可确认' };
                }
                const timestamp = resolveCommandTimestamp(command);
                const newState = resolveInteraction(state);
                const event: GameEvent = {
                    type: INTERACTION_EVENTS.RESOLVED,
                    payload: {
                        interactionId: data.id,
                        playerId: data.playerId,
                        optionId: null,
                        optionIds: undefined,
                        value: data.confirmValue,
                        sourceId: data.sourceId,
                        interactionData: stripNonSerializableFromData(data),
                    },
                    timestamp,
                };
                return { halt: false, state: newState, events: [event] };
            }
        },
    };
}
