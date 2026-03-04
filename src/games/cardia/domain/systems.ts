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
import { ABILITY_IDS } from './ids';
import { filterCards, createCardSelectionInteraction } from './interactionHandlers';
import type { GameEvent } from '../../../engine/types';
import { getCardModifiers, calculateCurrentInfluence } from './utils';
import { recalculateEncounterState } from './execute';

/**
 * 将 Cardia 交互包装为引擎层 simple-choice
 * 
 * 策略：创建真实的选项列表，每个选项的 value 包含 cardUid，
 * 这样 InteractionSystem 可以正确处理选择并传递给 handler。
 */
function wrapCardiaInteraction(
    cardiaInteraction: CardiaInteraction,
    core: CardiaCore,
    cardId?: string  // 添加 cardId 参数
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
        
        console.log('[wrapCardiaInteraction] 卡牌查找调试:', {
            availableCards: cardiaInteraction.availableCards,
            allCardsCount: allCards.length,
            allCardUids: allCards.map(c => c.uid),
        });
        
        // 可选卡牌（availableCards）
        const availableCards = cardiaInteraction.availableCards
            .map(uid => {
                const card = allCards.find(c => c.uid === uid);
                if (!card) {
                    console.warn('[wrapCardiaInteraction] 未找到卡牌:', uid);
                    return null;
                }
                
                // 计算当前影响力（基础影响力 + 所有修正标记）
                const modifiers = getCardModifiers(core, card.uid);
                const currentInfluence = calculateCurrentInfluence(card.baseInfluence, modifiers);
                
                // 为每张卡添加 optionId 和 currentInfluence，用于响应交互和 UI 显示
                return {
                    ...card,
                    optionId: `card_${uid}`,
                    currentInfluence,
                };
            })
            .filter((card): card is NonNullable<typeof card> => card !== null);  // 类型守卫
        
        // 禁用的卡牌（disabledCards）
        let disabledCards = (cardiaInteraction.disabledCards || [])
            .map(uid => {
                const card = allCards.find(c => c.uid === uid);
                if (!card) {
                    console.warn('[wrapCardiaInteraction] 未找到禁用卡牌:', uid);
                    return null;
                }
                
                // 计算当前影响力
                const modifiers = getCardModifiers(core, card.uid);
                const currentInfluence = calculateCurrentInfluence(card.baseInfluence, modifiers);
                
                return {
                    ...card,
                    optionId: `card_${uid}_disabled`,  // 禁用卡牌不需要 optionId，但为了一致性还是添加
                    currentInfluence,
                };
            })
            .filter((card): card is NonNullable<typeof card> => card !== null);  // 类型守卫
        
        // 自动收集对手的场上卡牌（如果交互是选择己方卡牌，则自动显示对手的卡牌但禁用）
        // 判断条件：availableCards 都属于同一个玩家，且该玩家是交互发起者
        const availableCardOwners = new Set(availableCards.map(c => c.ownerId));
        if (availableCardOwners.size === 1 && availableCardOwners.has(cardiaInteraction.playerId)) {
            // 所有可选卡牌都属于交互发起者，说明这是"选择己方卡牌"的交互
            // 自动收集对手的场上卡牌并添加到禁用列表
            const opponentId = core.playerOrder.find(id => id !== cardiaInteraction.playerId);
            if (opponentId) {
                const opponentFieldCards = core.players[opponentId].playedCards
                    .map(card => {
                        const modifiers = getCardModifiers(core, card.uid);
                        const currentInfluence = calculateCurrentInfluence(card.baseInfluence, modifiers);
                        return {
                            ...card,
                            optionId: `card_${card.uid}_opponent`,
                            currentInfluence,
                        };
                    });
                
                // 合并到禁用列表（去重）
                const existingDisabledUids = new Set(disabledCards.map(c => c.uid));
                const newDisabledCards = opponentFieldCards.filter(c => !existingDisabledUids.has(c.uid));
                disabledCards = [...disabledCards, ...newDisabledCards];
                
                console.log('[wrapCardiaInteraction] 自动添加对手场上卡牌到禁用列表:', {
                    opponentId,
                    opponentFieldCardsCount: opponentFieldCards.length,
                    newDisabledCount: newDisabledCards.length,
                });
            }
        }
        
        // 合并所有卡牌（可选 + 禁用）
        cards = [...availableCards, ...disabledCards];
        
        console.log('[wrapCardiaInteraction] 转换后的卡牌数量:', {
            available: availableCards.length,
            disabled: disabledCards.length,
            total: cards.length,
        });
        
        // 创建真实的选项列表（只包含可选卡牌）
        options = availableCards.map(card => ({
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
        disabledCardUids: cardiaInteraction.type === 'card_selection' 
            ? cards.filter(c => !options.some(opt => opt.value.cardUid === c.uid)).map(c => c.uid)  // 所有不在 options 中的卡牌都是禁用的
            : undefined,
        // ✅ 修复：优先使用 cardiaInteraction.cardId，其次使用传入的 cardId 参数
        cardId: (cardiaInteraction as any).cardId || cardId,
        // 添加玩家 ID（用于分组显示）
        myPlayerId: cardiaInteraction.playerId,
        opponentId: core.playerOrder.find(id => id !== cardiaInteraction.playerId),
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
    // 使用 Date.now() 而不是 toISOString()，避免在模块加载时就执行
    const loadTime = Date.now();
    
    console.info('[CardiaEventSystem] System created', { loadTime });
    
    return {
        id: 'cardia-event-system',
        name: 'Cardia 事件处理',
        priority: 50, // 在 InteractionSystem(20) 之后执行

        afterEvents: ({ state, events }): HookResult<CardiaCore> | void => {
            console.info('[CardiaEventSystem] afterEvents called', {
                eventsCount: events.length,
                eventTypes: events.map(e => e.type),
                hasCurrentInteraction: !!state.sys.interaction.current,
                currentInteractionId: state.sys.interaction.current?.id,
                queueLength: state.sys.interaction.queue.length,
            });
            
            let newState = state;
            const appliedEvents: GameEvent[] = [];  // 记录已应用的事件
            const modifierEvents: Array<{ cardId: string; value: number }> = [];  // 记录修正标记事件
            let hasInventorPendingSet = false;  // ✅ 修复：使用标志位而不是检查 appliedEvents

            for (const event of events) {
                // 监听 MODIFIER_TOKEN_PLACED → 记录修正标记事件（用于后续触发状态回溯）
                if (event.type === CARDIA_EVENTS.MODIFIER_TOKEN_PLACED) {
                    const payload = event.payload as {
                        cardId: string;
                        value: number;
                        source: string;
                        timestamp: number;
                    };
                    modifierEvents.push({ cardId: payload.cardId, value: payload.value });
                    console.log('[CardiaEventSystem] MODIFIER_TOKEN_PLACED detected:', {
                        cardId: payload.cardId,
                        value: payload.value,
                    });
                }
                
                // 监听 ABILITY_INTERACTION_REQUESTED → 将能力交互加入队列
                if (event.type === CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED) {
                    const payload = event.payload as {
                        abilityId: string;
                        cardId: string;
                        playerId: string;
                        interaction: CardiaInteraction;
                    };
                    
                    if (payload.interaction) {
                        // 将 Cardia 交互包装为引擎层交互，传入 cardId
                        const engineInteraction = wrapCardiaInteraction(
                            payload.interaction,
                            newState.core,
                            payload.cardId  // 传入 cardId
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
                        optionIds?: string[];
                        value: unknown;
                        sourceId?: string;
                        interactionData?: Record<string, unknown>;
                    };
                    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;

                    console.info('[CardiaEventSystem] INTERACTION_RESOLVED', {
                        sourceId: payload.sourceId,
                        playerId: payload.playerId,
                        optionId: payload.optionId,
                        optionIds: payload.optionIds,
                        value: payload.value,
                        valueType: typeof payload.value,
                        valueKeys: payload.value && typeof payload.value === 'object' ? Object.keys(payload.value) : undefined,
                    });

                    if (payload.sourceId) {
                        const handler = getInteractionHandler(payload.sourceId);
                        
                        console.info('[CardiaEventSystem] Handler lookup', {
                            sourceId: payload.sourceId,
                            found: !!handler,
                        });
                        
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
                            
                            console.info('[CardiaEventSystem] Handler result', {
                                hasResult: !!result,
                                eventsCount: result?.events?.length || 0,
                                events: result?.events?.map(e => e.type),
                                hasInteraction: !!(result as any).interaction,
                                interactionType: (result as any).interaction?.type,
                            });
                            
                            if (result) {
                                // 在本地应用事件到状态
                                // 不要返回这些事件，因为我们已经应用了
                                for (const evt of result.events) {
                                    console.info('[CardiaEventSystem] Applying event', {
                                        type: evt.type,
                                        payload: evt.payload,
                                    });
                                    newState = {
                                        ...newState,
                                        core: reduce(newState.core, evt),
                                    };
                                    appliedEvents.push(evt);  // 记录已应用的事件
                                    
                                    // ✅ 修复：检查交互处理器返回的事件中是否有 MODIFIER_TOKEN_PLACED
                                    if (evt.type === CARDIA_EVENTS.MODIFIER_TOKEN_PLACED) {
                                        const payload = evt.payload as {
                                            cardId: string;
                                            value: number;
                                            source: string;
                                            timestamp: number;
                                        };
                                        modifierEvents.push({ cardId: payload.cardId, value: payload.value });
                                        console.log('[CardiaEventSystem] MODIFIER_TOKEN_PLACED from handler:', {
                                            cardId: payload.cardId,
                                            value: payload.value,
                                        });
                                    }
                                    
                                    // ✅ 修复：检查是否有 INVENTOR_PENDING_SET 事件
                                    if (evt.type === CARDIA_EVENTS.INVENTOR_PENDING_SET) {
                                        hasInventorPendingSet = true;
                                        console.log('[CardiaEventSystem] INVENTOR_PENDING_SET detected from handler');
                                    }
                                }
                                
                                // 处理交互处理器返回的新交互
                                if ((result as any).interaction) {
                                    console.log('[CardiaEventSystem] Handler returned new interaction, queueing it');
                                    const cardiaInteraction = (result as any).interaction as CardiaInteraction;
                                    const engineInteraction = wrapCardiaInteraction(
                                        cardiaInteraction,
                                        newState.core,
                                        payload.sourceId  // 使用原始 sourceId 作为 cardId
                                    );
                                    
                                    if (engineInteraction) {
                                        newState = queueInteraction(newState, engineInteraction);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // 处理修正标记事件：触发状态回溯
            if (modifierEvents.length > 0) {
                console.log('[CardiaEventSystem] Processing modifier events for recalculation:', {
                    count: modifierEvents.length,
                    events: modifierEvents,
                });
                
                for (const modEvent of modifierEvents) {
                    console.log('[CardiaEventSystem] Triggering recalculation for card:', modEvent.cardId);
                    
                    // 调用状态回溯函数
                    const recalcEvents = recalculateEncounterState(
                        newState.core,
                        modEvent.cardId,
                        modEvent.value
                    );
                    
                    console.log('[CardiaEventSystem] Recalculation generated events:', {
                        count: recalcEvents.length,
                        types: recalcEvents.map(e => e.type),
                    });
                    
                    // 应用回溯事件到状态
                    for (const evt of recalcEvents) {
                        newState = {
                            ...newState,
                            core: reduce(newState.core, evt),
                        };
                        appliedEvents.push(evt);
                    }
                }
            }
            
            // 检查是否有 INVENTOR_PENDING_SET 事件被应用
            // 如果有，立即创建第二次交互
            console.log('[CardiaEventSystem] After event processing:', {
                hasInventorPendingSet,
                hasPending: !!newState.core.inventorPending,
                pending: newState.core.inventorPending,
            });
            
            if (hasInventorPendingSet && newState.core.inventorPending) {
                console.log('[CardiaEventSystem] INVENTOR_PENDING_SET detected, creating second interaction');
                
                // 获取所有场上卡牌（包含第一次选择的卡牌，但标记为禁用）
                const allCards = filterCards(newState.core, {
                    location: 'field',
                });
                
                const firstCardId = newState.core.inventorPending.firstCardId;
                const triggeringCardId = newState.core.inventorPending.triggeringCardId;  // 获取触发能力的卡牌 ID
                
                console.log('[CardiaEventSystem] Available cards for second interaction:', {
                    total: allCards.length,
                    firstCardId: firstCardId,
                    triggeringCardId: triggeringCardId,
                });
                
                if (allCards.length > 0) {
                    // 创建第二次交互
                    console.log('[CardiaEventSystem] Creating inventor second interaction');
                    const secondInteraction = createCardSelectionInteraction(
                        `${ABILITY_IDS.INVENTOR}_second_${Date.now()}`,
                        ABILITY_IDS.INVENTOR,
                        newState.core.inventorPending.playerId,
                        '选择第二张卡牌',
                        '为第二张卡牌添加-3影响力（不能选择第一张卡牌）',
                        1,
                        1,
                        { location: 'field' }
                    );
                    
                    // ✅ 修复 Bug 1：排除触发能力的卡牌（女导师/发明家本身）和第一次选择的卡牌
                    const excludedCards = [firstCardId];
                    if (triggeringCardId) {
                        excludedCards.push(triggeringCardId);
                    }
                    
                    secondInteraction.availableCards = allCards.filter(uid => !excludedCards.includes(uid));
                    secondInteraction.disabledCards = excludedCards;
                    
                    const engineInteraction = wrapCardiaInteraction(
                        secondInteraction,
                        newState.core,
                        triggeringCardId || ABILITY_IDS.INVENTOR  // 使用触发卡牌 ID
                    );
                    
                    if (engineInteraction) {
                        newState = queueInteraction(newState, engineInteraction);
                        console.log('[CardiaEventSystem] Second interaction queued');
                    }
                } else {
                    // 没有可选卡牌，清理待续标记
                    console.log('[CardiaEventSystem] No cards available, clearing pending flag');
                    newState = {
                        ...newState,
                        core: {
                            ...newState.core,
                            inventorPending: undefined,
                        },
                    };
                }
            }

            if (newState !== state) {
                console.log('[CardiaEventSystem] Returning modified state:', {
                    appliedEventsCount: appliedEvents.length,
                    appliedEventTypes: appliedEvents.map(e => e.type),
                    hasCurrentInteraction: !!newState.sys.interaction.current,
                    currentInteractionId: newState.sys.interaction.current?.id,
                    queueLength: newState.sys.interaction.queue.length,
                });
                // 不返回已应用的事件，因为我们已经在本地 reduce 过了
                // 返回空数组避免引擎重复 reduce
                return { halt: false, state: newState, events: [] };
            }
        },
    };
}
