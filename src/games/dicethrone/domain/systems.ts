/**
 * DiceThrone 专用系统扩展
 * 处理领域事件到系统状态的映射
 */

import type { GameEvent, PromptOption } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import { PROMPT_EVENTS, queuePrompt, createPrompt } from '../../../engine/systems/PromptSystem';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    ChoiceRequestedEvent,
    ChoiceResolvedEvent,
    PhaseChangedEvent,
} from './types';
import { resolveAttack } from './attack';
import { reduce } from './reducer';

// ============================================================================
// DiceThrone 事件处理系统
// ============================================================================

/**
 * 创建 DiceThrone 事件处理系统
 * 负责将领域事件转换为系统状态更新（如 Prompt）
 */
export function createDiceThroneEventSystem(): EngineSystem<DiceThroneCore> {
    return {
        id: 'dicethrone-events',
        name: 'DiceThrone 事件处理',
        priority: 50, // 在 PromptSystem 之后执行

        afterEvents: ({ state, events }): HookResult<DiceThroneCore> | void => {
            let newState = state;
            const nextEvents: GameEvent[] = [];

            for (const event of events) {
                const dtEvent = event as DiceThroneEvent;
                
                // 处理 CHOICE_REQUESTED 事件 -> 创建 Prompt
                if (dtEvent.type === 'CHOICE_REQUESTED') {
                    const payload = (dtEvent as ChoiceRequestedEvent).payload;
                    
                    // 将 DiceThrone 的选择选项转换为 PromptOption
                    const promptOptions: PromptOption<{ statusId: string; value: number }>[] = 
                        payload.options.map((opt, index) => ({
                            id: `option-${index}`,
                            label: opt.statusId, // UI 层会根据 statusId 显示本地化文案
                            value: opt,
                        }));
                    
                    const prompt = createPrompt(
                        `choice-${payload.sourceAbilityId}-${Date.now()}`,
                        payload.playerId,
                        payload.titleKey,
                        promptOptions,
                        payload.sourceAbilityId
                    );
                    
                    newState = queuePrompt(newState, prompt);
                }

                const resolvedEvent = handlePromptResolved(event);
                if (resolvedEvent) {
                    nextEvents.push(resolvedEvent);
                    const followupEvents = buildChoiceFollowupEvents(state.core, resolvedEvent);
                    if (followupEvents.length > 0) {
                        nextEvents.push(...followupEvents);
                    }
                }
            }

            if (newState !== state || nextEvents.length > 0) {
                return {
                    state: newState,
                    events: nextEvents.length > 0 ? nextEvents : undefined,
                };
            }
        },
    };
}

const now = () => Date.now();

function buildChoiceFollowupEvents(
    core: DiceThroneCore,
    resolvedEvent: ChoiceResolvedEvent
): DiceThroneEvent[] {
    if (core.turnPhase !== 'offensiveRoll') return [];
    if (!core.pendingAttack?.preDefenseResolved) return [];
    if (core.pendingAttack.attackerId !== resolvedEvent.payload.playerId) return [];

    const followups: DiceThroneEvent[] = [];

    if (core.pendingAttack.isDefendable) {
        const phaseEvent: PhaseChangedEvent = {
            type: 'PHASE_CHANGED',
            payload: {
                from: core.turnPhase,
                to: 'defensiveRoll',
                activePlayerId: core.activePlayerId,
            },
            sourceCommandType: resolvedEvent.sourceCommandType,
            timestamp: now(),
        };
        followups.push(phaseEvent);
        return followups;
    }

    const coreAfterChoice = reduce(core, resolvedEvent);
    const attackEvents = resolveAttack(coreAfterChoice, { includePreDefense: false });
    followups.push(...attackEvents);

    const phaseEvent: PhaseChangedEvent = {
        type: 'PHASE_CHANGED',
        payload: {
            from: core.turnPhase,
            to: 'main2',
            activePlayerId: core.activePlayerId,
        },
        sourceCommandType: resolvedEvent.sourceCommandType,
        timestamp: now(),
    };
    followups.push(phaseEvent);

    return followups;
}

/**
 * 处理 Prompt 响应事件，生成领域事件
 * 在 pipeline 层通过 domain.execute 处理 RESOLVE_CHOICE 命令时调用
 */
export function handlePromptResolved(
    event: GameEvent
): ChoiceResolvedEvent | null {
    if (event.type !== PROMPT_EVENTS.RESOLVED) return null;
    
    const payload = event.payload as {
        promptId: string;
        playerId: string;
        optionId: string;
        value: { statusId: string; value: number };
    };
    
    return {
        type: 'CHOICE_RESOLVED',
        payload: {
            playerId: payload.playerId,
            statusId: payload.value.statusId,
            value: payload.value.value,
        },
        sourceCommandType: 'RESOLVE_CHOICE',
        timestamp: Date.now(),
    };
}
