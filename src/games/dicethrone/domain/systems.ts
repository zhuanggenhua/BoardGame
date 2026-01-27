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
} from './types';

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
                    const promptOptions: PromptOption<{
                        statusId?: string;
                        tokenId?: string;
                        value: number;
                        customId?: string;
                        labelKey?: string;
                    }>[] = payload.options.map((opt, index) => {
                        const label = opt.labelKey
                            ?? (opt.tokenId ? `tokens.${opt.tokenId}.name`
                                : opt.statusId ? `statusEffects.${opt.statusId}.name`
                                    : `choices.option-${index}`);
                        return {
                            id: `option-${index}`,
                            label,
                            value: opt,
                        };
                    });
                    
                    const prompt = createPrompt(
                        `choice-${payload.sourceAbilityId}-${Date.now()}`,
                        payload.playerId,
                        payload.titleKey,
                        promptOptions,
                        payload.sourceAbilityId
                    );
                    
                    newState = queuePrompt(newState, prompt);
                }

                // 处理 Prompt 响应 -> 生成 CHOICE_RESOLVED 领域事件
                const resolvedEvent = handlePromptResolved(event);
                if (resolvedEvent) {
                    nextEvents.push(resolvedEvent);
                    // 注意：选择完成后的阶段推进现在由 FlowSystem 统一处理
                    // 用户/测试需要在选择完成后调用 ADVANCE_PHASE 继续流程
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
        value: { statusId?: string; tokenId?: string; value: number; customId?: string };
        sourceId?: string;
    };
    
    return {
        type: 'CHOICE_RESOLVED',
        payload: {
            playerId: payload.playerId,
            statusId: payload.value.statusId,
            tokenId: payload.value.tokenId,
            value: payload.value.value,
            customId: payload.value.customId,
            sourceAbilityId: payload.sourceId,
        },
        sourceCommandType: 'RESOLVE_CHOICE',
        timestamp: Date.now(),
    };
}
