/**
 * Cardia - 专用事件处理系统
 * 
 * 处理领域事件到系统状态的映射：
 * - 监听 INTERACTION_CREATED 事件 → 将交互加入队列
 * - 监听 ABILITY_INTERACTION_REQUESTED 事件 → 将能力交互加入队列
 * - 监听 SYS_INTERACTION_RESOLVED 事件 → 从 sourceId 查找处理函数 → 生成后续领域事件
 * 
 * 注意：Cardia 使用自定义交互系统（CardiaInteraction），
 * 通过 simple-choice 包装后存入 sys.interaction，
 * UI 层从 data.cardiaInteraction 读取原始交互数据。
 */

import type { RandomFn } from '../../../engine/types';
import { queueInteraction, createSimpleChoice, INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import type { CardiaCore } from './core-types';
import { CARDIA_EVENTS } from './events';
import type { CardiaInteraction } from './interactionHandlers';
import { getInteractionHandler } from './abilityInteractionHandlers';
import { reduce } from './reduce';

/**
 * 将 Cardia 交互包装为引擎层 simple-choice
 * 
 * 策略：创建真实的选项列表，每个选项的 value 包含 cardUid，
 * 这样 InteractionSystem 可以正确处理选择并传递给 handler。
 */
function wrapCardiaInteraction(
    cardiaInteraction: CardiaInteraction,
    core: CardiaCore
): any {
    let interactionType: string;
    let options: any[] = [];
    let cards: any[] = [];
    
    if (cardiaInteraction.type === 'card_selection') {
        interactionType = 'card-selection';
        
        // 将 availableCards (UIDs) 转换为完整的卡牌对象和选项
        const allCards = [
            ...Object.values(core.players).flatMap(p => p.playedCards),
            ...Object.values(core.players).flatMap(p => p.hand),
        ];
        
        cards = cardiaInteraction.availableCards
            .map(uid => {
                const card = allCards.find(c => c.uid === uid);
                if (!card) return null;
                
                // 为每张卡添加 optionId，用于响应交互
                return {
                    ...card,
                    optionId: `card_${uid}`,
                };
            })
            .filter(Boolean);
        
        // 创建真实的选项列表
        options = cards.map(card => ({
            id: card.optionId,
            label: card.defId, // 卡牌名称
            value: { cardUid: card.uid }, // 包含 cardUid 的值对象
        }));
    } else if (cardiaInteraction.type === 'faction_selection') {
        interactionType = 'faction-selection';
        
        // 创建派系选项列表
        const factions = ['swamp', 'academy', 'guild', 'dynasty'];
        options = factions.map(faction => ({
            id: `faction_${faction}`,
            label: faction,
            value: { faction },
        }));
    } else if (cardiaInteraction.type === 'modifier_selection') {
        interactionType = 'modifier-selection';
        
        // 创建修正值选项列表
        const modifiers = (cardiaInteraction as any).availableModifiers || [];
        options = modifiers.map((value: number) => ({
            id: `modifier_${value}`,
            label: value > 0 ? `+${value}` : `${value}`,
            value: { modifierValue: value },
        }));
    } else {
        interactionType = 'unknown';
    }
    
    const interaction = createSimpleChoice(
        cardiaInteraction.interactionId,
        cardiaInteraction.playerId,
        cardiaInteraction.title,
        options,
        {
            // 直接使用 abilityId 作为 sourceId（显式优于隐式）
            sourceId: cardiaInteraction.abilityId,
            targetType: 'generic',
        }
    );
    
    // 将 Cardia 交互数据存储在 data 中（供 UI 使用）
    (interaction.data as any) = {
        ...interaction.data,
        interactionType,
        cardiaInteraction,
        // 为 UI 提供便捷字段
        cards,
        minSelect: cardiaInteraction.type === 'card_selection' ? cardiaInteraction.minSelect : undefined,
        maxSelect: cardiaInteraction.type === 'card_selection' ? cardiaInteraction.maxSelect : undefined,
        // 复制 cardId（如果存在）到 data 中，供交互处理器使用
        cardId: (cardiaInteraction as any).cardId,
    };
    
    return interaction;
}

/**
 * 创建 Cardia 游戏结束处理系统
 * 
 * 职责：
 * - 监听 GAME_WON 事件 → 设置 sys.gameover 状态
 */
export function createGameOverSystem(): EngineSystem<CardiaCore> {
    return {
        id: 'cardia-gameover-system',
        name: 'Cardia 游戏结束处理',
        priority: 100, // 高优先级，确保最后执行

        afterEvents: ({ state, events }): HookResult<CardiaCore> | void => {
            for (const event of events) {
                if (event.type === CARDIA_EVENTS.GAME_WON) {
                    const payload = event.payload as { winnerId: string; reason: string };
                    
                    // 设置 sys.gameover
                    const newState = {
                        ...state,
                        sys: {
                            ...state.sys,
                            gameover: {
                                winner: payload.winnerId,
                            },
                        },
                    };
                    return {
                        halt: false,
                        state: newState,
                        events: [],
                    };
                }
            }
        },
    };
}

/**
 * 创建 Cardia 事件处理系统
 * 
 * 职责：
 * - 监听 INTERACTION_CREATED 事件 → 将交互加入队列
 * - 监听 ABILITY_INTERACTION_REQUESTED 事件 → 将能力交互加入队列
 */
export function createCardiaEventSystem(): EngineSystem<CardiaCore> {
    return {
        id: 'cardia-event-system',
        name: 'Cardia 事件处理',
        priority: 50, // 在 InteractionSystem(20) 之后执行

        afterEvents: ({ state, events }): HookResult<CardiaCore> | void => {
            let newState = state;

            for (const event of events) {
                // 监听 ABILITY_INTERACTION_REQUESTED → 将能力交互加入队列
                if (event.type === CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED) {
                    const payload = event.payload as {
                        abilityId: string;
                        cardId: string;
                        playerId: string;
                        interaction: CardiaInteraction;
                    };
                    
                    if (payload.interaction) {
                        // 将 Cardia 交互包装为引擎层交互
                        const engineInteraction = wrapCardiaInteraction(
                            payload.interaction,
                            newState.core
                        );
                        
                        if (engineInteraction) {
                            newState = queueInteraction(newState, engineInteraction);
                        }
                    }
                }
                
                // 监听 SYS_INTERACTION_RESOLVED → 从 sourceId 查找处理函数 → 生成后续事件
                if (event.type === INTERACTION_EVENTS.RESOLVED) {
                    const payload = event.payload as {
                        interactionId: string;
                        playerId: string;
                        optionId: string | null;
                        value: unknown;
                        sourceId?: string;
                        interactionData?: Record<string, unknown>;
                    };
                    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;

                    if (payload.sourceId) {
                        const handler = getInteractionHandler(payload.sourceId);
                        
                        if (handler) {
                            const random: RandomFn = {
                                random: () => Math.random(),
                                d: (max: number) => Math.floor(Math.random() * max) + 1,
                                range: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
                                shuffle: <T>(array: T[]) => {
                                    const result = [...array];
                                    for (let i = result.length - 1; i > 0; i--) {
                                        const j = Math.floor(Math.random() * (i + 1));
                                        [result[i], result[j]] = [result[j], result[i]];
                                    }
                                    return result;
                                },
                            };
                            const result = handler(
                                newState,
                                payload.playerId,
                                payload.value,
                                payload.interactionData,
                                random,
                                eventTimestamp
                            );
                            
                            if (result) {
                                newState = result.state;
                                // 立即 reduce 事件到状态，而不是返回给引擎
                                for (const evt of result.events) {
                                    newState = {
                                        ...newState,
                                        core: reduce(newState.core, evt),
                                    };
                                }
                            }
                        }
                    }
                }
            }

            if (newState !== state) {
                return { halt: false, state: newState, events: [] };
            }
        },
    };
}
