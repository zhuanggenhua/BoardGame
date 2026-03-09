/**
 * 组 2：影响力修正能力（12 个）
 * 
 * 这些能力通过放置修正标记来改变卡牌的影响力。
 * 大部分能力需要交互（选择目标卡牌）。
 */

import { ABILITY_IDS } from '../ids';
import { CARDIA_EVENTS } from '../events';
import { abilityExecutorRegistry } from '../abilityExecutor';
import { getPlayerFieldCards, calculateCurrentInfluence, getCardModifiers } from '../utils';
import { createCardSelectionInteraction, filterCards, createModifierSelectionInteraction, createFactionSelectionInteraction } from '../interactionHandlers';
import { registerInteractionHandler } from '../abilityInteractionHandlers';
import type { CardiaAbilityContext } from '../abilityExecutor';
import type { CardiaEvent } from '../events';

/**
 * 外科医生（Surgeon）- 影响力 3
 * 效果：为你下一张打出的牌添加 -5 影响力
 * 
 * 实现：注册延迟效果，在下次打出牌时触发
 */
abilityExecutorRegistry.register(ABILITY_IDS.SURGEON, (ctx: CardiaAbilityContext) => {
    return {
        events: [
            {
                type: CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED,
                payload: {
                    effectType: 'modifyInfluence',
                    target: 'self',
                    value: -5,
                    condition: 'onNextCardPlayed',
                    sourceAbilityId: ctx.abilityId,
                    sourcePlayerId: ctx.playerId,
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});


/**
 * 税务官（Tax Collector）- 影响力 4
 * 效果：添加+4影响力到本牌
 * 
 * 实现：直接为本牌添加 +4 修正标记，不需要交互
 */
abilityExecutorRegistry.register(ABILITY_IDS.TAX_COLLECTOR, (ctx: CardiaAbilityContext) => {
    return {
        events: [
            {
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                payload: {
                    cardId: ctx.cardId,
                    value: 4,
                    source: ctx.abilityId,
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 天才（Genius）- 影响力 7
 * 效果：添加+3影响力到你的一张不大于8影响力的牌上
 * 
 * 实现：需要交互选择目标卡牌（影响力≤8）
 */
abilityExecutorRegistry.register(ABILITY_IDS.GENIUS, (ctx: CardiaAbilityContext) => {
    if (!ctx.selectedCardId) {
        const availableCards = filterCards(ctx.core, {
            location: 'field',
            owner: ctx.playerId,
            maxInfluence: 8, // 过滤影响力≤8的卡牌
        });
        
        if (availableCards.length === 0) {
            return { events: [] };
        }
        
        const interaction = createCardSelectionInteraction(
            `${ctx.abilityId}_${ctx.timestamp}`,
            ctx.abilityId,
            ctx.playerId,
            '选择目标卡牌',
            '为你的一张影响力≤8的打出的牌添加+3影响力',
            1,
            1,
            { location: 'field', owner: ctx.playerId, maxInfluence: 8 }
        );
        
        interaction.availableCards = availableCards;
        
        return {
            events: [],
            interaction,
        };
    }
    
    return {
        events: [
            {
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                payload: {
                    cardId: ctx.selectedCardId,
                    value: 3,
                    source: ctx.abilityId,
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 使者（Messenger）- 影响力 3
 * 效果：添加-3影响力到任一张牌或你下一张打出的牌
 * 
 * 实现：需要交互选择目标（任一张场上牌或下一张牌）
 * ✅ 完整实现：支持选择场上任一张牌或"下一张牌"选项
 */
abilityExecutorRegistry.register(ABILITY_IDS.MESSENGER, (ctx: CardiaAbilityContext) => {
    // 如果玩家选择了"下一张牌"选项
    if (ctx.selectedOption === 'next_card') {
        return {
            events: [
                {
                    type: CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED,
                    payload: {
                        effectType: 'modifyInfluence',
                        target: 'self',
                        value: -3,
                        condition: 'onNextCardPlayed',
                        sourceAbilityId: ctx.abilityId,
                        sourcePlayerId: ctx.playerId,
                        timestamp: ctx.timestamp,
                    },
                    timestamp: ctx.timestamp,
                }
            ],
        };
    }
    
    // 如果玩家还没有选择
    if (!ctx.selectedCardId && !ctx.selectedOption) {
        // 获取所有场上卡牌（己方+对手）
        const availableCards = filterCards(ctx.core, {
            location: 'field',
        });
        
        // 创建交互，包含场上卡牌和"下一张牌"选项
        const interaction = createCardSelectionInteraction(
            `${ctx.abilityId}_${ctx.timestamp}`,
            ctx.abilityId,
            ctx.playerId,
            '选择目标',
            '为任一张场上牌添加-3影响力，或选择"下一张牌"',
            1,
            1,
            { location: 'field' }
        );
        
        // 添加场上卡牌选项
        interaction.availableCards = availableCards;
        
        // 添加"下一张牌"选项（通过扩展 interaction 数据）
        (interaction as any).extraOptions = [
            {
                id: 'next_card',
                label: '下一张打出的牌',
                description: '为你下一张打出的牌添加-3影响力',
            }
        ];
        
        return {
            events: [],
            interaction,
        };
    }
    
    // 玩家选择了场上卡牌
    return {
        events: [
            {
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                payload: {
                    cardId: ctx.selectedCardId,
                    value: -3,
                    source: ctx.abilityId,
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 发明家（Inventor）- 影响力 15
 * 效果：添加+3影响力到任一张牌，并添加-3影响力到另外任一张牌
 * 
 * 实现：两次独立的单选交互
 * - 能力执行器：创建第一次交互
 * - 第一次交互处理器：放置 +3，设置 inventorPending 标记
 * - CardiaEventSystem：检测到 inventorPending，创建第二次交互
 * - 第二次交互处理器：放置 -3，清理 inventorPending 标记
 */
abilityExecutorRegistry.register(ABILITY_IDS.INVENTOR, (ctx: CardiaAbilityContext) => {
    // 获取所有场上卡牌（己方+对手）
    const availableCards = filterCards(ctx.core, {
        location: 'field',
    });
    
    if (availableCards.length === 0) {
        return { events: [] };
    }
    
    // 创建第一次交互
    const interaction = createCardSelectionInteraction(
        `${ctx.abilityId}_first_${ctx.timestamp}`,
        ctx.abilityId,
        ctx.playerId,
        '选择第一张卡牌',
        '为第一张卡牌添加+3影响力',
        1,
        1,
        { location: 'field' },
        ctx.cardId  // ✅ 添加：传入发明家的 cardId
    );
    
    interaction.availableCards = availableCards;
    
    return {
        events: [],
        interaction,
    };
});

/**
 * 钟表匠（Clockmaker）- 影响力 11
 * 效果：添加+3影响力到你上一个遭遇的牌和你下一次打出的牌
 * 
 * 实现：
 * 1. 为上一个遭遇的牌添加 +3 修正标记（如果存在）
 * 2. 注册延迟效果，为下一张打出的牌添加 +3 修正标记
 */
abilityExecutorRegistry.register(ABILITY_IDS.CLOCKMAKER, (ctx: CardiaAbilityContext) => {
    const player = ctx.core.players[ctx.playerId];
    const events: any[] = [];
    
    // 查找上一个遭遇的牌（当前卡牌的 encounterIndex - 1）
    const currentCard = player.playedCards.find(card => card.uid === ctx.cardId);
    
    if (currentCard && currentCard.encounterIndex > 0) {
        const previousCard = player.playedCards.find(
            card => card.encounterIndex === currentCard.encounterIndex - 1
        );
        
        if (previousCard) {
            events.push({
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                payload: {
                    cardId: previousCard.uid,
                    value: 3,
                    source: ctx.abilityId,
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            });
        }
    }
    
    // 注册延迟效果，为下一张打出的牌添加 +3
    events.push({
        type: CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED,
        payload: {
            effectType: 'modifyInfluence',
            target: 'self',
            value: 3,
            condition: 'onNextCardPlayed',
            sourceAbilityId: ctx.abilityId,
            sourcePlayerId: ctx.playerId,
            timestamp: ctx.timestamp,
        },
        timestamp: ctx.timestamp,
    });
    
    return { events };
});

/**
 * 宫廷卫士（Court Guard）- 影响力 7
 * 效果：你选择一个派系，你的对手可以选择弃掉一张该派系的手牌，否则本牌添加+7影响力
 * 
 * 实现：需要交互选择派系，然后对手选择是否弃牌
 */
abilityExecutorRegistry.register(ABILITY_IDS.COURT_GUARD, (ctx: CardiaAbilityContext) => {
    // 创建派系选择交互
    const interaction = createFactionSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.abilityId,  // 显式传递 abilityId
        ctx.playerId,
        '选择派系',
        '选择一个派系，你的对手可以选择弃掉一张该派系的手牌，否则本牌添加+7影响力'
    );
    
    // 将 cardId 存储在 interaction 中，供后续处理使用
    (interaction as any).cardId = ctx.cardId;
    
    return {
        events: [],
        interaction,
    };
});

/**
 * 毒师（Poisoner）- 影响力 1
 * 效果：降低相对的牌的影响力直到当前遭遇为平局
 * 
 * 实现：动态计算需要降低的影响力值，使当前遭遇为平局
 */
abilityExecutorRegistry.register(ABILITY_IDS.POISONER, (ctx: CardiaAbilityContext) => {
    const player = ctx.core.players[ctx.playerId];
    const opponent = ctx.core.players[ctx.opponentId];
    
    // 查找当前卡牌
    const currentCard = player.playedCards.find(card => card.uid === ctx.cardId);
    
    if (!currentCard) {
        return { events: [] };
    }
    
    // 查找相对的卡牌（相同遭遇序号）
    const oppositeCard = opponent.playedCards.find(
        card => card.encounterIndex === currentCard.encounterIndex
    );
    
    if (!oppositeCard) {
        return { events: [] };
    }
    
    // 计算当前影响力
    const currentModifiers = getCardModifiers(ctx.core, currentCard.uid);
    const oppositeModifiers = getCardModifiers(ctx.core, oppositeCard.uid);
    
    const currentInfluence = calculateCurrentInfluence(currentCard.baseInfluence, currentModifiers);
    const oppositeInfluence = calculateCurrentInfluence(oppositeCard.baseInfluence, oppositeModifiers);
    
    // 计算需要降低的影响力值（使遭遇为平局）
    const reductionNeeded = oppositeInfluence - currentInfluence;
    
    if (reductionNeeded <= 0) {
        // 对手已经输了或平局，不需要降低
        return { events: [] };
    }
    
    return {
        events: [
            {
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                payload: {
                    cardId: oppositeCard.uid,
                    value: -reductionNeeded,
                    source: ctx.abilityId,
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 图书管理员（Librarian）- 影响力 6
 * 效果：在你下一次打出牌并揭示后，添加+2或-2影响力到那张牌上
 * 
 * 实现：需要交互选择 +2 或 -2，然后注册延迟效果
 * ✅ 完整实现：让玩家选择 +2 或 -2
 */
abilityExecutorRegistry.register(ABILITY_IDS.LIBRARIAN, (ctx: CardiaAbilityContext) => {
    // 如果玩家还没有选择修正值
    if (ctx.selectedModifierValue === undefined) {
        const interaction = createModifierSelectionInteraction(
            `${ctx.abilityId}_${ctx.timestamp}`,
            ctx.playerId,
            '选择修正值',
            '为你下一张打出的牌添加+2或-2影响力',
            [2, -2]
        );
        
        return {
            events: [],
            interaction,
        };
    }
    
    // 玩家已选择修正值，注册延迟效果
    return {
        events: [
            {
                type: CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED,
                payload: {
                    effectType: 'modifyInfluence',
                    target: 'self',
                    value: ctx.selectedModifierValue,
                    condition: 'onNextCardPlayed',
                    sourceAbilityId: ctx.abilityId,
                    sourcePlayerId: ctx.playerId,
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 工程师（Engineer）- 影响力 11
 * 效果：下一次遭遇发动能力阶段后，添加+5影响力到你打出的牌上
 * 
 * 实现：注册延迟效果，在下次遭遇的能力阶段后触发
 */
abilityExecutorRegistry.register(ABILITY_IDS.ENGINEER, (ctx: CardiaAbilityContext) => {
    return {
        events: [
            {
                type: CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED,
                payload: {
                    effectType: 'modifyInfluence',
                    target: 'self',
                    value: 5,
                    condition: 'onNextEncounterAfterAbility',
                    sourceAbilityId: ctx.abilityId,
                    sourcePlayerId: ctx.playerId,
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 念动力法师（Telekinetic Mage）- 影响力 2
 * 效果：从你的一张牌移动所有修正标记和持续标记到你的另一张牌
 * 
 * 实现：需要交互选择源卡牌和目标卡牌
 * TODO: 在 Task 11 实现交互系统后，更新为完整版本
 * 当前简化版本：移动己方第一张卡牌的所有修正标记和持续标记到第二张卡牌
 */
abilityExecutorRegistry.register(ABILITY_IDS.TELEKINETIC_MAGE, (ctx: CardiaAbilityContext) => {
    const player = ctx.core.players[ctx.playerId];
    
    // 至少需要 2 张场上卡牌
    if (player.playedCards.length < 2) {
        return { events: [] };
    }
    
    // 查找第一张有修正标记或持续标记的卡牌
    const sourceCard = player.playedCards.find(card => {
        const hasModifiers = ctx.core.modifierTokens.some(token => token.cardId === card.uid);
        const hasOngoing = ctx.core.ongoingAbilities.some(ability => ability.cardId === card.uid);
        return hasModifiers || hasOngoing;
    });
    
    if (!sourceCard) {
        return { events: [] };
    }
    
    // 选择目标卡牌（第二张场上卡牌）
    const targetCard = player.playedCards.find(card => card.uid !== sourceCard.uid);
    
    if (!targetCard) {
        return { events: [] };
    }
    
    const events: any[] = [];
    
    // ✅ 移动所有修正标记
    const modifierTokens = ctx.core.modifierTokens.filter(token => token.cardId === sourceCard.uid);
    
    for (const modifierToken of modifierTokens) {
        // 移除源卡牌的修正标记
        events.push({
            type: CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED,
            payload: {
                cardId: sourceCard.uid,
                source: modifierToken.source,
            },
            timestamp: ctx.timestamp,
        });
        
        // 在目标卡牌上放置修正标记
        events.push({
            type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
            payload: {
                cardId: targetCard.uid,
                value: modifierToken.value,
                source: modifierToken.source,
                timestamp: ctx.timestamp,
            },
            timestamp: ctx.timestamp,
        });
    }
    
    // ✅ 新增：移动所有持续标记
    const ongoingAbilities = ctx.core.ongoingAbilities.filter(
        ability => ability.cardId === sourceCard.uid
    );
    
    for (const ability of ongoingAbilities) {
        // 移除源卡牌的持续标记
        events.push({
            type: CARDIA_EVENTS.ONGOING_ABILITY_REMOVED,
            payload: {
                abilityId: ability.abilityId,
                cardId: sourceCard.uid,
                playerId: ability.playerId,
            },
            timestamp: ctx.timestamp,
        });
        
        // 在目标卡牌上放置持续标记
        events.push({
            type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED,
            payload: {
                abilityId: ability.abilityId,
                cardId: targetCard.uid,
                playerId: ability.playerId,
                effectType: ability.effectType,
                timestamp: ctx.timestamp,
            },
            timestamp: ctx.timestamp,
        });
    }
    
    return { events };
});

/**
 * 雇佣剑士（Mercenary Swordsman）- 影响力 1
 * 效果：弃掉本牌和相对的牌
 * 
 * 实现：弃掉当前卡牌和对手在相同遭遇序号的卡牌
 */
abilityExecutorRegistry.register(ABILITY_IDS.MERCENARY_SWORDSMAN, (ctx: CardiaAbilityContext) => {
    const player = ctx.core.players[ctx.playerId];
    const opponent = ctx.core.players[ctx.opponentId];
    
    // 查找当前卡牌
    const currentCard = player.playedCards.find(card => card.uid === ctx.cardId);
    
    if (!currentCard) {
        return { events: [] };
    }
    
    // 查找相对的卡牌（相同遭遇序号）
    const oppositeCard = opponent.playedCards.find(card => card.encounterIndex === currentCard.encounterIndex);
    
    const cardsToDiscard: string[] = [currentCard.uid];
    
    if (oppositeCard) {
        cardsToDiscard.push(oppositeCard.uid);
    }
    
    return {
        events: [
            {
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: ctx.playerId,
                    cardIds: [currentCard.uid],
                    from: 'field',
                },
                timestamp: ctx.timestamp,
            },
            ...(oppositeCard ? [{
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: ctx.opponentId,
                    cardIds: [oppositeCard.uid],
                    from: 'field',
                },
                timestamp: ctx.timestamp,
            }] : []),
        ],
    };
});



// ============================================================================
// 交互处理函数注册
// ============================================================================

/**
 * 注册影响力修正能力的交互处理函数
 */
export function registerModifierInteractionHandlers(): void {
    // 外科医生：不需要交互处理器（延迟效果由系统自动处理）
    
    // 天才：选择目标卡牌后放置 +3 修正标记
    registerInteractionHandler(ABILITY_IDS.GENIUS, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selectedCard = value as { cardUid?: string };
        
        if (!selectedCard?.cardUid) {
            console.error('[Genius] No cardUid in interaction value');
            return { state, events: [] };
        }
        
        // 验证卡牌是否仍在场上且属于己方
        const player = state.core.players[playerId];
        const targetCard = player.playedCards.find(c => c.uid === selectedCard.cardUid);
        
        if (!targetCard) {
            console.error('[Genius] Selected card not found or not owned by player:', selectedCard.cardUid);
            return { state, events: [] };
        }
        
        return {
            state,
            events: [
                {
                    type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                    payload: {
                        cardId: selectedCard.cardUid,
                        value: 3,
                        source: ABILITY_IDS.GENIUS,
                        timestamp,
                    },
                    timestamp,
                }
            ],
        };
    });
    
    // 使者：选择目标卡牌或"下一张牌"选项
    registerInteractionHandler(ABILITY_IDS.MESSENGER, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selection = value as { cardUid?: string; option?: string };
        
        // 如果选择了"下一张牌"选项
        if (selection.option === 'next_card') {
            return {
                state,
                events: [
                    {
                        type: CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED,
                        payload: {
                            effectType: 'modifyInfluence',
                            target: 'self',
                            value: -3,
                            condition: 'onNextCardPlayed',
                            sourceAbilityId: ABILITY_IDS.MESSENGER,
                            sourcePlayerId: playerId,
                            timestamp,
                        },
                        timestamp,
                    }
                ],
            };
        }
        
        // 如果选择了场上卡牌
        if (selection.cardUid) {
            return {
                state,
                events: [
                    {
                        type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                        payload: {
                            cardId: selection.cardUid,
                            value: -3,
                            source: ABILITY_IDS.MESSENGER,
                            timestamp,
                        },
                        timestamp,
                    }
                ],
            };
        }
        
        console.error('[Messenger] Invalid selection:', selection);
        return { state, events: [] };
    });
    
    // 图书管理员：选择修正值后注册延迟效果
    registerInteractionHandler(ABILITY_IDS.LIBRARIAN, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selectedModifier = value as { modifierValue?: number };
        
        if (selectedModifier.modifierValue === undefined) {
            console.error('[Librarian] No modifierValue in interaction value');
            return { state, events: [] };
        }
        
        // 验证修正值是否有效（+2 或 -2）
        if (selectedModifier.modifierValue !== 2 && selectedModifier.modifierValue !== -2) {
            console.error('[Librarian] Invalid modifier value:', selectedModifier.modifierValue);
            return { state, events: [] };
        }
        
        return {
            state,
            events: [
                {
                    type: CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED,
                    payload: {
                        effectType: 'modifyInfluence',
                        target: 'self',
                        value: selectedModifier.modifierValue,
                        condition: 'onNextCardPlayed',
                        sourceAbilityId: ABILITY_IDS.LIBRARIAN,
                        sourcePlayerId: playerId,
                        timestamp,
                    },
                    timestamp,
                }
            ],
        };
    });
    
    // 宫廷卫士：选择派系后，对手选择是否弃牌
    registerInteractionHandler(ABILITY_IDS.COURT_GUARD, (state, playerId, value, interactionData, _random, timestamp) => {
        console.log('[CourtGuard] ========== INTERACTION HANDLER CALLED ==========');
        console.log('[CourtGuard] Input parameters:', {
            playerId,
            value,
            valueType: typeof value,
            valueKeys: value && typeof value === 'object' ? Object.keys(value) : undefined,
            hasInteractionData: !!interactionData,
            interactionDataKeys: interactionData ? Object.keys(interactionData) : undefined,
        });
        
        const selectedFaction = (value as { faction?: string })?.faction;
        const selectedOption = (value as { option?: string })?.option;
        
        // 第一步：己方选择派系
        if (selectedFaction && !selectedOption) {
            const opponentId = playerId === '0' ? '1' : '0';
            const opponentPlayer = state.core.players[opponentId];
            
            console.log('[CourtGuard] Step 1: Faction selected', {
                selectedFaction,
                playerId,
                opponentId,
                opponentHandCount: opponentPlayer.hand.length,
                opponentHand: opponentPlayer.hand.map(c => ({ uid: c.uid, faction: c.faction, defId: c.defId })),
            });
            
            // 查找对手该派系的手牌
            const factionCards = opponentPlayer.hand.filter(card => card.faction === selectedFaction);
            
            console.log('[CourtGuard] Faction cards found', {
                selectedFaction,
                factionCardsCount: factionCards.length,
                factionCards: factionCards.map(c => ({ uid: c.uid, defId: c.defId, faction: c.faction })),
                factionCardUids: factionCards.map(c => c.uid),
            });
            
            // 获取当前卡牌 ID（从 interactionData 中）
            const cardId = (interactionData as any)?.cardId;
            
            console.log('[CourtGuard] ========== SAVING CONTEXT ==========');
            console.log('[CourtGuard] Context to save:', {
                faction: selectedFaction,
                cardId,
                factionCards: factionCards.map(c => c.uid),
            });
            
            console.log('[CourtGuard] CardId from interactionData', {
                cardId,
                hasInteractionData: !!interactionData,
                interactionDataKeys: interactionData ? Object.keys(interactionData) : [],
            });
            
            if (factionCards.length === 0) {
                // 对手没有该派系手牌，本牌添加+7影响力
                console.log('[CourtGuard] No faction cards, adding +7 modifier');
                return {
                    state,
                    events: [{
                        type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                        payload: {
                            cardId,
                            value: 7,
                            source: ABILITY_IDS.COURT_GUARD,
                            timestamp,
                        },
                        timestamp,
                    }],
                };
            }
            
            // 对手有该派系手牌，创建对手的选择交互
            console.log('[CourtGuard] Creating opponent choice interaction');
            const opponentInteraction: any = {
                type: 'choice',
                interactionId: `${ABILITY_IDS.COURT_GUARD}_opponent_${timestamp}`,
                playerId: opponentId,
                abilityId: ABILITY_IDS.COURT_GUARD,  // ← 添加 abilityId 字段
                title: '选择是否弃牌',
                description: `对手选择了${selectedFaction}派系，你可以弃掉一张该派系的手牌，否则对手的牌添加+7影响力`,
                options: [
                    {
                        id: 'discard',
                        label: '弃掉一张手牌',
                        description: `弃掉一张${selectedFaction}派系的手牌`,
                    },
                    {
                        id: 'decline',
                        label: '不弃牌',
                        description: '对手的牌添加+7影响力',
                    }
                ],
                // 存储上下文信息
                context: {
                    faction: selectedFaction,
                    cardId,
                    factionCards: factionCards.map(c => c.uid),
                },
            };
            
            console.log('[CourtGuard] Returning opponent interaction', {
                interactionId: opponentInteraction.interactionId,
                playerId: opponentInteraction.playerId,
                optionsCount: opponentInteraction.options.length,
                hasContext: !!opponentInteraction.context,
                contextKeys: opponentInteraction.context ? Object.keys(opponentInteraction.context) : [],
                factionCardsInContext: opponentInteraction.context?.factionCards,
            });
            
            console.log('[CourtGuard] About to return object with interaction field');
            
            const returnValue = {
                state,
                events: [],
                interaction: opponentInteraction,
            };
            
            console.log('[CourtGuard] Return value structure:', {
                hasState: !!returnValue.state,
                hasEvents: !!returnValue.events,
                hasInteraction: !!returnValue.interaction,
                interactionType: returnValue.interaction?.type,
            });
            
            return returnValue;
        }
        
        // 第二步：对手选择是否弃牌
        if (selectedOption) {
            const context = (interactionData as any)?.context;
            if (!context) {
                console.error('[CourtGuard] No context in interaction data');
                return { state, events: [] };
            }
            
            const { faction, cardId, factionCards } = context;
            
            console.log('[CourtGuard] Step 2: Option selected', {
                selectedOption,
                playerId,
                faction,
                cardId,
                factionCardsFromContext: factionCards,
            });
            
            if (selectedOption === 'discard') {
                // 对手选择弃牌，需要再选择具体哪张牌
                const opponentPlayer = state.core.players[playerId];
                const availableCards = opponentPlayer.hand.filter(c => factionCards.includes(c.uid));
                
                console.log('[CourtGuard] Filtering available cards', {
                    opponentHandCount: opponentPlayer.hand.length,
                    opponentHandCards: opponentPlayer.hand.map(c => ({ uid: c.uid, faction: c.faction })),
                    factionCardsFromContext: factionCards,
                    availableCardsCount: availableCards.length,
                    availableCards: availableCards.map(c => ({ uid: c.uid, faction: c.faction })),
                });
                
                if (availableCards.length === 0) {
                    console.error('[CourtGuard] No faction cards found in hand');
                    return { state, events: [] };
                }
                
                // 如果只有一张牌，直接弃掉
                if (availableCards.length === 1) {
                    console.log('[CourtGuard] Only 1 card, auto-discarding', {
                        cardUid: availableCards[0].uid,
                    });
                    return {
                        state,
                        events: [{
                            type: CARDIA_EVENTS.CARDS_DISCARDED,
                            payload: {
                                playerId,
                                cardIds: [availableCards[0].uid],
                                from: 'hand',
                            },
                            timestamp,
                        }],
                    };
                }
                
                // 多张牌，创建选择交互
                console.log('[CourtGuard] Multiple cards, creating card selection interaction', {
                    availableCardsCount: availableCards.length,
                });
                const cardSelectionInteraction: any = {
                    type: 'card_selection',
                    interactionId: `${ABILITY_IDS.COURT_GUARD}_discard_${timestamp}`,
                    playerId,
                    abilityId: ABILITY_IDS.COURT_GUARD,  // ← 添加 abilityId 字段
                    title: '选择要弃掉的牌',
                    description: `选择一张${faction}派系的手牌弃掉`,
                    availableCards: availableCards.map(c => c.uid),
                    minSelect: 1,
                    maxSelect: 1,
                    // ✅ 修复：保留 context，供第三步使用
                    context: {
                        faction,
                        cardId,
                        factionCards,
                    },
                };
                
                console.log('[CourtGuard] Returning card selection interaction', {
                    interactionId: cardSelectionInteraction.interactionId,
                    playerId: cardSelectionInteraction.playerId,
                    availableCardsCount: cardSelectionInteraction.availableCards.length,
                    hasContext: !!cardSelectionInteraction.context,
                });
                
                return {
                    state,
                    events: [],
                    interaction: cardSelectionInteraction,
                };
            } else if (selectedOption === 'decline') {
                // 对手选择不弃牌，本牌添加+7影响力
                return {
                    state,
                    events: [{
                        type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                        payload: {
                            cardId,
                            value: 7,
                            source: ABILITY_IDS.COURT_GUARD,
                            timestamp,
                        },
                        timestamp,
                    }],
                };
            }
        }
        
        // 第三步：对手选择具体弃掉哪张牌
        const selectedCard = (value as { cardUid?: string })?.cardUid;
        if (selectedCard) {
            return {
                state,
                events: [{
                    type: CARDIA_EVENTS.CARDS_DISCARDED,
                    payload: {
                        playerId,
                        cardIds: [selectedCard],
                        from: 'hand',
                    },
                    timestamp,
                }],
            };
        }
        
        console.error('[CourtGuard] Invalid interaction value:', value);
        return { state, events: [] };
    });
    
    // 发明家：两次独立的单选交互
    // 使用 inventorPending 标记判断是第几次交互
    // 第一次交互：inventorPending 不存在 → 放置 +3，设置 inventorPending
    // 第二次交互：inventorPending 存在 → 放置 -3，清理 inventorPending
    registerInteractionHandler(ABILITY_IDS.INVENTOR, (state, playerId, value, interactionData, _random, timestamp) => {
        const selectedCard = value as { cardUid?: string };
        
        if (!selectedCard?.cardUid) {
            console.error('[Inventor] No cardUid in interaction value');
            return { state, events: [] };
        }
        
        // 使用 inventorPending 标记判断是第几次交互
        const isFirstInteraction = !state.core.inventorPending;
        
        console.log('[Inventor] Interaction handler called:', {
            isFirstInteraction,
            hasPendingFlag: !!state.core.inventorPending,
            selectedCardUid: selectedCard.cardUid,
        });
        
        if (isFirstInteraction) {
            // 第一次交互：放置 +3，设置待续标记
            console.log('[Inventor] First interaction: placing +3 modifier and setting pending flag');
            console.log('[Inventor] First interaction selectedCardUid:', selectedCard.cardUid);
            
            // ✅ 修复 Bug 1：从 interactionData 中获取触发能力的卡牌 ID
            const cardiaInteraction = (interactionData as any)?.cardiaInteraction;
            const triggeringCardId = cardiaInteraction?.cardId;
            
            return {
                state,
                events: [
                    {
                        type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                        payload: {
                            cardId: selectedCard.cardUid,
                            value: 3,
                            source: ABILITY_IDS.INVENTOR,
                            timestamp,
                        },
                        timestamp,
                    },
                    {
                        type: CARDIA_EVENTS.INVENTOR_PENDING_SET,
                        payload: {
                            playerId,
                            timestamp,
                            firstCardId: selectedCard.cardUid,  // 记录第一次选择的卡牌
                            triggeringCardId,  // ✅ 记录触发能力的卡牌 ID（女导师/发明家本身）
                        },
                        timestamp,
                    }
                ],
            };
        } else {
            // 第二次交互：放置 -3，清理待续标记
            console.log('[Inventor] Second interaction: placing -3 modifier and clearing pending flag');
            
            return {
                state,
                events: [
                    {
                        type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                        payload: {
                            cardId: selectedCard.cardUid,
                            value: -3,
                            source: ABILITY_IDS.INVENTOR,
                            timestamp,
                        },
                        timestamp,
                    },
                    {
                        type: CARDIA_EVENTS.INVENTOR_PENDING_CLEARED,
                        payload: {
                            playerId,
                        },
                        timestamp,
                    }
                ],
            };
        }
    });
    
    // 念动力法师：选择两张卡牌（从第一张移动所有标记到第二张）
    registerInteractionHandler(ABILITY_IDS.TELEKINETIC_MAGE, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selection = value as { cardUids?: string[] };
        
        if (!selection?.cardUids || selection.cardUids.length !== 2) {
            console.error('[TelekineticMage] Invalid selection, expected 2 cards:', selection);
            return { state, events: [] };
        }
        
        const [sourceCardId, targetCardId] = selection.cardUids;
        const events: CardiaEvent[] = [];
        
        // 移动所有修正标记
        const modifierTokens = state.core.modifierTokens.filter(token => token.cardId === sourceCardId);
        
        for (const modifierToken of modifierTokens) {
            // 移除源卡牌的修正标记
            events.push({
                type: CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED,
                payload: {
                    cardId: sourceCardId,
                    source: modifierToken.source,
                },
                timestamp,
            });
            
            // 在目标卡牌上放置修正标记
            events.push({
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                payload: {
                    cardId: targetCardId,
                    value: modifierToken.value,
                    source: modifierToken.source,
                    timestamp,
                },
                timestamp,
            });
        }
        
        // 移动所有持续标记
        const ongoingAbilities = state.core.ongoingAbilities.filter(
            ability => ability.cardId === sourceCardId
        );
        
        for (const ability of ongoingAbilities) {
            // 移除源卡牌的持续标记
            events.push({
                type: CARDIA_EVENTS.ONGOING_ABILITY_REMOVED,
                payload: {
                    abilityId: ability.abilityId,
                    cardId: sourceCardId,
                    playerId: ability.playerId,
                },
                timestamp,
            });
            
            // 在目标卡牌上放置持续标记
            events.push({
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED,
                payload: {
                    abilityId: ability.abilityId,
                    cardId: targetCardId,
                    playerId: ability.playerId,
                    effectType: ability.effectType,
                    timestamp,
                },
                timestamp,
            });
        }
        
        return { state, events };
    });
}
