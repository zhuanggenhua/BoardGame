/**
 * 组 4：卡牌操作能力（2 个）
 * 
 * 这些能力操作场上卡牌，包括回收卡牌和移除标记。
 */

import { ABILITY_IDS } from '../ids';
import { CARDIA_EVENTS } from '../events';
import { abilityExecutorRegistry } from '../abilityExecutor';
import { registerInteractionHandler } from '../abilityInteractionHandlers';
import type { CardiaAbilityContext } from '../abilityExecutor';
import type { CardiaEvent } from '../events';

/**
 * 沼泽守卫（Swamp Guard）- 影响力 13
 * 效果：拿取一张你之前打出的牌回到手上，并弃掉其相对的牌
 * 
 * 实现：需要交互选择目标卡牌（己方场上卡牌）
 * ✅ 完整实现：让玩家选择要回收的卡牌
 */
abilityExecutorRegistry.register(ABILITY_IDS.SWAMP_GUARD, (ctx: CardiaAbilityContext) => {
    const player = ctx.core.players[ctx.playerId];
    
    // 查找己方场上卡牌（排除当前卡牌）
    const eligibleCards = player.playedCards.filter(card => card.uid !== ctx.cardId);
    
    if (eligibleCards.length === 0) {
        return {
            events: [{
                type: CARDIA_EVENTS.ABILITY_NO_VALID_TARGET,
                timestamp: ctx.timestamp,
                payload: {
                    abilityId: ctx.abilityId,
                    cardId: ctx.cardId,
                    playerId: ctx.playerId,
                    reason: 'no_field_cards',
                },
            }],
        };
    }
    
    // 如果还没有选择目标卡牌，创建交互
    if (!ctx.selectedCardId) {
        const interaction: CardiaInteraction = {
            type: 'card_selection',
            interactionId: `${ctx.abilityId}_${ctx.timestamp}`,
            playerId: ctx.playerId,
            abilityId: ctx.abilityId,  // ← 添加 abilityId 字段
            title: '选择要回收的卡牌',
            description: '选择一张你之前打出的牌回到手上，并弃掉其相对的牌',
            availableCards: eligibleCards.map(c => c.uid),
            minSelect: 1,
            maxSelect: 1,
        };
        
        return {
            events: [],
            interaction,
        };
    }
    
    // 已选择目标卡牌，执行回收逻辑
    const targetCard = player.playedCards.find(c => c.uid === ctx.selectedCardId);
    if (!targetCard) {
        console.error('[SwampGuard] Selected card not found:', ctx.selectedCardId);
        return { events: [] };
    }
    
    const opponent = ctx.core.players[ctx.opponentId];
    
    // 查找相对的卡牌（相同遭遇序号）
    const oppositeCard = opponent.playedCards.find(
        card => card.encounterIndex === targetCard.encounterIndex
    );
    
    const events: any[] = [
        // 回收己方卡牌到手牌
        {
            type: CARDIA_EVENTS.CARD_RECYCLED,
            payload: {
                cardId: targetCard.uid,
                playerId: ctx.playerId,
                from: 'field',
            },
            timestamp: ctx.timestamp,
        }
    ];
    
    // 如果有相对的牌，弃掉它
    if (oppositeCard) {
        events.push({
            type: CARDIA_EVENTS.CARDS_DISCARDED,
            payload: {
                playerId: ctx.opponentId,
                cardIds: [oppositeCard.uid],
                from: 'field',
            },
            timestamp: ctx.timestamp,
        });
    }
    
    return { events };
});

/**
 * 虚空法师（Void Mage）- 影响力 2
 * 效果：从任一张牌上弃掉所有修正标记和持续标记
 * 
 * 实现：需要交互选择目标卡牌（任意有标记的场上卡牌）
 */
abilityExecutorRegistry.register(ABILITY_IDS.VOID_MAGE, (ctx: CardiaAbilityContext) => {
    try {
        console.log('[VoidMage] 能力执行器被调用:', {
            playerId: ctx.playerId,
            cardId: ctx.cardId,
            selectedCardId: ctx.selectedCardId,
            modifierTokens: ctx.core.modifierTokens,
            ongoingAbilities: ctx.core.ongoingAbilities,
        });
        
        // 如果还没有选择目标卡牌，创建交互
        if (!ctx.selectedCardId) {
            // 查找所有有修正标记或持续标记的卡牌
            const cardsWithModifiers = new Set(
                ctx.core.modifierTokens.map(token => token.cardId)
            );
            const cardsWithOngoing = new Set(
                ctx.core.ongoingAbilities.map(ability => ability.cardId)
            );
            
            const allCardsWithMarkers = Array.from(new Set([
                ...cardsWithModifiers,
                ...cardsWithOngoing,
            ]));
            
            console.log('[VoidMage] 检测到的标记:', {
                cardsWithModifiers: Array.from(cardsWithModifiers),
                cardsWithOngoing: Array.from(cardsWithOngoing),
                allCardsWithMarkers,
            });
            
            if (allCardsWithMarkers.length === 0) {
                // 场上没有标记，发射提示事件
                console.warn('[VoidMage] 场上没有标记，返回 NO_VALID_TARGET');
                return {
                    events: [{
                        type: CARDIA_EVENTS.ABILITY_NO_VALID_TARGET,
                        timestamp: ctx.timestamp,
                        payload: {
                            abilityId: ctx.abilityId,
                            cardId: ctx.cardId,
                            playerId: ctx.playerId,
                            reason: 'no_markers',
                        },
                    }],
                };
            }
            
            // 创建交互让玩家选择目标卡牌
            const interaction: CardiaInteraction = {
                type: 'card_selection',
                interactionId: `${ctx.abilityId}_${ctx.timestamp}`,
                playerId: ctx.playerId,
                abilityId: ctx.abilityId,  // ← 添加 abilityId 字段
                title: '选择目标卡牌',
                description: '从任一张牌上弃掉所有修正标记和持续标记',
                availableCards: allCardsWithMarkers,
                minSelect: 1,
                maxSelect: 1,
            };
            
            console.log('[VoidMage] 创建交互:', interaction);
            
            return {
                events: [],
                interaction,
            };
        }
        
        // 已选择目标卡牌，执行移除标记的逻辑
        const targetCardId = ctx.selectedCardId;
        
        // 验证卡牌是否仍然存在
        const allPlayedCards = [
            ...ctx.core.players[ctx.playerId].playedCards,
            ...ctx.core.players[ctx.opponentId].playedCards,
        ];
        const targetCard = allPlayedCards.find(c => c.uid === targetCardId);
        
        if (!targetCard) {
            console.error('[VoidMage] Selected card not found:', targetCardId);
            return { events: [] };
        }
        
        // 验证卡牌是否仍有标记
        const hasMarkers = ctx.core.modifierTokens.some(t => t.cardId === targetCardId) ||
                          ctx.core.ongoingAbilities.some(a => a.cardId === targetCardId);
        if (!hasMarkers) {
            console.warn('[VoidMage] Selected card has no markers, returning empty events');
            return { events: [] };
        }
        
        const events: any[] = [];
        
        // 移除该卡牌上的所有修正标记
        const modifiersToRemove = ctx.core.modifierTokens.filter(
            token => token.cardId === targetCardId
        );
        
        for (const modifier of modifiersToRemove) {
            events.push({
                type: CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED,
                payload: {
                    cardId: targetCardId,
                    source: modifier.source,
                },
                timestamp: ctx.timestamp,
            });
        }
        
        // 移除该卡牌上的所有持续标记
        const ongoingToRemove = ctx.core.ongoingAbilities.filter(
            ability => ability.cardId === targetCardId
        );
        
        for (const ability of ongoingToRemove) {
            events.push({
                type: CARDIA_EVENTS.ONGOING_ABILITY_REMOVED,
                payload: {
                    abilityId: ability.abilityId,
                    cardId: ability.cardId,
                    playerId: ability.playerId,
                },
                timestamp: ctx.timestamp,
            });
        }
        
        return { events };
    } catch (error) {
        console.error('[VoidMage] Executor error:', error, {
            abilityId: ctx.abilityId,
            cardId: ctx.cardId,
            playerId: ctx.playerId,
            selectedCardId: ctx.selectedCardId,
        });
        
        // 返回空事件，避免游戏崩溃
        return { events: [] };
    }
});

/**
 * 注册组 4 的交互处理器
 */
export function registerCardOpsInteractionHandlers(): void {
    // 虚空法师：选择目标卡牌后移除所有标记
    registerInteractionHandler(ABILITY_IDS.VOID_MAGE, (state, _playerId, value, _interactionData, _random, timestamp) => {
        // value 包含选中的卡牌信息
        const selectedCard = value as { cardUid?: string };
        if (!selectedCard?.cardUid) {
            console.error('[VoidMage] No cardUid in interaction value');
            return undefined;
        }
        
        const targetCardId = selectedCard.cardUid;
        const events: CardiaEvent[] = [];
        
        // 移除该卡牌上的所有修正标记
        const modifiersToRemove = state.core.modifierTokens.filter(
            token => token.cardId === targetCardId
        );
        
        for (const modifier of modifiersToRemove) {
            events.push({
                type: CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED,
                payload: {
                    cardId: targetCardId,
                    source: modifier.source,
                },
                timestamp,
            });
        }
        
        // 移除该卡牌上的所有持续标记
        const ongoingToRemove = state.core.ongoingAbilities.filter(
            ability => ability.cardId === targetCardId
        );
        
        for (const ability of ongoingToRemove) {
            events.push({
                type: CARDIA_EVENTS.ONGOING_ABILITY_REMOVED,
                payload: {
                    abilityId: ability.abilityId,
                    cardId: ability.cardId,
                    playerId: ability.playerId,
                },
                timestamp,
            });
        }
        
        return { state, events };
    });
    
    // 沼泽守卫：选择目标卡牌后回收到手牌并弃掉相对的牌
    registerInteractionHandler(ABILITY_IDS.SWAMP_GUARD, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selectedCard = value as { cardUid?: string };
        if (!selectedCard?.cardUid) {
            console.error('[SwampGuard] No cardUid in interaction value');
            return { state, events: [] };
        }
        
        const targetCardId = selectedCard.cardUid;
        const player = state.core.players[playerId];
        const opponentId = playerId === '0' ? '1' : '0';
        const opponent = state.core.players[opponentId];
        
        // 查找目标卡牌
        const targetCard = player.playedCards.find(c => c.uid === targetCardId);
        if (!targetCard) {
            console.error('[SwampGuard] Selected card not found:', targetCardId);
            return { state, events: [] };
        }
        
        // 查找相对的卡牌（相同遭遇序号）
        const oppositeCard = opponent.playedCards.find(
            card => card.encounterIndex === targetCard.encounterIndex
        );
        
        const events: CardiaEvent[] = [
            // 回收己方卡牌到手牌
            {
                type: CARDIA_EVENTS.CARD_RECYCLED,
                payload: {
                    cardId: targetCardId,
                    playerId,
                    from: 'field',
                },
                timestamp,
            }
        ];
        
        // 如果有相对的牌，弃掉它
        if (oppositeCard) {
            events.push({
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: opponentId,
                    cardIds: [oppositeCard.uid],
                    from: 'field',
                },
                timestamp,
            });
        }
        
        return { state, events };
    });
}
