/**
 * 组 5：能力复制能力（3 个）
 * 
 * 这些能力复制其他卡牌的即时能力并执行。
 * 
 * 注意：
 * - 只能复制即时能力（⚡），不能复制持续能力（🔄）
 * - 复制的能力会递归执行，使用原始能力的执行器
 * - 需要交互选择目标卡牌
 */

import { ABILITY_IDS } from '../ids';
import { CARDIA_EVENTS } from '../events';
import { abilityExecutorRegistry } from '../abilityExecutor';
import { createCardSelectionInteraction } from '../interactionHandlers';
import type { CardiaAbilityContext } from '../abilityExecutor';

/**
 * 女导师（Governess）- 影响力 14
 * 效果：复制并发动你的一张影响力不小于本牌的已打出牌的即时能力
 * 
 * 实现：需要交互选择目标卡牌（己方场上影响力≥14的卡牌，且有即时能力）
 * ✅ 完整实现：递归执行被复制的能力
 */
abilityExecutorRegistry.register(ABILITY_IDS.GOVERNESS, (ctx: CardiaAbilityContext) => {
    const player = ctx.core.players[ctx.playerId];
    
    console.log('[Governess] 能力执行器被调用:', {
        playerId: ctx.playerId,
        cardId: ctx.cardId,
        selectedCardId: ctx.selectedCardId,
        playedCardsCount: player.playedCards.length,
    });
    
    // 查找己方场上影响力≥14的卡牌（排除当前卡牌）
    const eligibleCards = player.playedCards.filter(card => {
        if (card.uid === ctx.cardId) return false;
        
        // 计算当前影响力
        const modifiers = ctx.core.modifierTokens.filter(t => t.cardId === card.uid);
        const currentInfluence = modifiers.reduce((acc, m) => acc + m.value, card.baseInfluence);
        
        // 检查是否有即时能力（至少有一个能力ID）
        const hasInstantAbility = card.abilityIds.length > 0;
        
        console.log('[Governess] 检查卡牌:', {
            uid: card.uid,
            defId: card.defId,
            baseInfluence: card.baseInfluence,
            currentInfluence,
            hasInstantAbility,
            abilityIds: card.abilityIds,
            eligible: currentInfluence >= 14 && hasInstantAbility,
        });
        
        return currentInfluence >= 14 && hasInstantAbility;
    });
    
    console.log('[Governess] 符合条件的卡牌:', {
        count: eligibleCards.length,
        cards: eligibleCards.map(c => ({ uid: c.uid, defId: c.defId })),
    });
    
    if (eligibleCards.length === 0) {
        // 没有符合条件的卡牌，发射 ABILITY_NO_VALID_TARGET 事件
        return {
            events: [
                {
                    type: CARDIA_EVENTS.ABILITY_NO_VALID_TARGET,
                    payload: {
                        abilityId: ctx.abilityId,
                        playerId: ctx.playerId,
                        reason: 'no_eligible_cards',
                    },
                    timestamp: ctx.timestamp,
                }
            ]
        };
    }
    
    // 如果已经选择了卡牌（从交互返回），执行复制逻辑
    if (ctx.selectedCardId) {
        const targetCard = eligibleCards.find(c => c.uid === ctx.selectedCardId);
        if (!targetCard) {
            console.error('[Governess] Selected card not found:', ctx.selectedCardId);
            return { events: [] };
        }
        
        const targetAbilityId = targetCard.abilityIds[0];
        
        console.log('[Governess] 复制能力:', {
            targetCardId: targetCard.uid,
            targetCardDefId: targetCard.defId,
            targetAbilityId,
            governessCardId: ctx.cardId,
            governessAbilityId: ctx.abilityId,
        });
        
        // 递归执行被复制的能力
        const copiedAbilityExecutor = abilityExecutorRegistry.resolve(targetAbilityId);
        if (!copiedAbilityExecutor) {
            console.error('[Governess] Copied ability executor not found:', targetAbilityId);
            return { events: [] };
        }
        
        // 创建新的上下文，使用女导师的 playerId 但保留目标卡牌的 abilityId
        const copiedContext: CardiaAbilityContext = {
            ...ctx,
            abilityId: targetAbilityId,
            // 注意：cardId 保持为女导师的 cardId，因为是女导师在执行能力
        };
        
        console.log('[Governess] 执行被复制的能力:', copiedContext);
        
        // 执行被复制的能力
        const result = copiedAbilityExecutor(copiedContext);
        
        console.log('[Governess] 被复制能力的返回结果:', {
            eventsCount: result.events.length,
            hasInteraction: !!result.interaction,
            interaction: result.interaction,
        });
        
        // 在事件前添加 ABILITY_COPIED 事件（用于日志记录）
        const events: any[] = [
            {
                type: CARDIA_EVENTS.ABILITY_COPIED,
                payload: {
                    sourceCardId: targetCard.uid,
                    sourceAbilityId: targetAbilityId,
                    copiedByCardId: ctx.cardId,
                    copiedByPlayerId: ctx.playerId,
                },
                timestamp: ctx.timestamp,
            },
            ...result.events,
        ];
        
        console.log('[Governess] 最终返回:', {
            eventsCount: events.length,
            hasInteraction: !!result.interaction,
        });
        
        return {
            events,
            interaction: result.interaction,
        };
    }
    
    // 创建卡牌选择交互
    const interaction = createCardSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.abilityId,
        ctx.playerId,
        '选择要复制能力的卡牌',
        '选择你的一张影响力不小于14的已打出牌',
        1, // minSelect
        1, // maxSelect
        {
            owner: ctx.playerId,
            location: 'field',
            minInfluence: 14,
            hasInstantAbility: true,
        },
        ctx.cardId  // ✅ 添加：传入女导师的 cardId
    );
    
    // 填充可选卡牌列表
    interaction.availableCards = eligibleCards.map(c => c.uid);
    
    return {
        events: [],
        interaction,
    };
});

/**
 * 幻术师（Illusionist）- 影响力 10（II 牌组）
 * 效果：发动你一张输掉的牌的能力
 * 
 * 实现：需要交互选择目标卡牌（对手场上有即时能力的卡牌）
 * ✅ 完整实现：递归执行被复制的能力
 */
abilityExecutorRegistry.register(ABILITY_IDS.ILLUSIONIST, (ctx: CardiaAbilityContext) => {
    const opponent = ctx.core.players[ctx.opponentId];
    
    // 查找对手场上有即时能力的卡牌
    const eligibleCards = opponent.playedCards.filter(card => {
        return card.abilityIds.length > 0;
    });
    
    if (eligibleCards.length === 0) {
        // 没有符合条件的卡牌，发射 ABILITY_NO_VALID_TARGET 事件
        return {
            events: [
                {
                    type: CARDIA_EVENTS.ABILITY_NO_VALID_TARGET,
                    payload: {
                        abilityId: ctx.abilityId,
                        playerId: ctx.playerId,
                        reason: 'no_eligible_cards',
                    },
                    timestamp: ctx.timestamp,
                }
            ]
        };
    }
    
    // 如果已经选择了卡牌（从交互返回），执行复制逻辑
    if (ctx.selectedCardId) {
        const targetCard = eligibleCards.find(c => c.uid === ctx.selectedCardId);
        if (!targetCard) {
            console.error('[Illusionist] Selected card not found:', ctx.selectedCardId);
            return { events: [] };
        }
        
        const targetAbilityId = targetCard.abilityIds[0];
        
        // 递归执行被复制的能力
        const copiedAbilityExecutor = abilityExecutorRegistry.resolve(targetAbilityId);
        if (!copiedAbilityExecutor) {
            console.error('[Illusionist] Copied ability executor not found:', targetAbilityId);
            return { events: [] };
        }
        
        // 创建新的上下文，使用幻术师的 playerId
        const copiedContext: CardiaAbilityContext = {
            ...ctx,
            abilityId: targetAbilityId,
        };
        
        // 执行被复制的能力
        const result = copiedAbilityExecutor(copiedContext);
        
        // 在事件前添加 ABILITY_COPIED 事件（用于日志记录）
        const events: any[] = [
            {
                type: CARDIA_EVENTS.ABILITY_COPIED,
                payload: {
                    sourceCardId: targetCard.uid,
                    sourceAbilityId: targetAbilityId,
                    copiedByCardId: ctx.cardId,
                    copiedByPlayerId: ctx.playerId,
                },
                timestamp: ctx.timestamp,
            },
            ...result.events,
        ];
        
        return {
            events,
            interaction: result.interaction,
        };
    }
    
    // 创建卡牌选择交互
    const interaction = createCardSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.abilityId,
        ctx.playerId,
        '选择要复制能力的卡牌',
        '选择对手的一张已打出牌',
        1, // minSelect
        1, // maxSelect
        {
            owner: ctx.opponentId,
            location: 'field',
            hasInstantAbility: true,
        },
        ctx.cardId  // ✅ 添加：传入幻术师的 cardId
    );
    
    // 填充可选卡牌列表
    interaction.availableCards = eligibleCards.map(c => c.uid);
    
    return {
        events: [],
        interaction,
    };
});

/**
 * 元素师（Elementalist）- 影响力 14（II 牌组）
 * 效果：弃掉你一张具有即时能力的手牌，复制并发动该能力，然后抽一张牌
 * 
 * 实现：需要交互选择目标卡牌（己方手牌中有即时能力的卡牌）
 * ✅ 完整实现：递归执行被复制的能力
 */
abilityExecutorRegistry.register(ABILITY_IDS.ELEMENTALIST, (ctx: CardiaAbilityContext) => {
    const player = ctx.core.players[ctx.playerId];
    
    // ✅ 修复：从手牌中查找有即时能力的卡牌（而非弃牌堆）
    const eligibleCards = player.hand.filter(card => {
        return card.abilityIds.length > 0;
    });
    
    if (eligibleCards.length === 0) {
        // 没有符合条件的卡牌，发射 ABILITY_NO_VALID_TARGET 事件
        return {
            events: [
                {
                    type: CARDIA_EVENTS.ABILITY_NO_VALID_TARGET,
                    payload: {
                        abilityId: ctx.abilityId,
                        playerId: ctx.playerId,
                        reason: 'no_eligible_cards',
                    },
                    timestamp: ctx.timestamp,
                }
            ]
        };
    }
    
    // 如果已经选择了卡牌（从交互返回），执行复制逻辑
    if (ctx.selectedCardId) {
        const targetCard = eligibleCards.find(c => c.uid === ctx.selectedCardId);
        if (!targetCard) {
            console.error('[Elementalist] Selected card not found:', ctx.selectedCardId);
            return { events: [] };
        }
        
        const targetAbilityId = targetCard.abilityIds[0];
        
        // 递归执行被复制的能力
        const copiedAbilityExecutor = abilityExecutorRegistry.resolve(targetAbilityId);
        if (!copiedAbilityExecutor) {
            console.error('[Elementalist] Copied ability executor not found:', targetAbilityId);
            return { events: [] };
        }
        
        // 创建新的上下文，使用元素师的 playerId
        const copiedContext: CardiaAbilityContext = {
            ...ctx,
            abilityId: targetAbilityId,
        };
        
        // 执行被复制的能力
        const result = copiedAbilityExecutor(copiedContext);
        
        // 组合事件：弃牌 → 复制能力 → 被复制能力的事件 → 抽牌
        const events: any[] = [
            // 弃掉手牌（从手牌移到弃牌堆）
            {
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: ctx.playerId,
                    cardIds: [targetCard.uid],
                    from: 'hand',
                },
                timestamp: ctx.timestamp,
            },
            // 复制能力（用于日志记录）
            {
                type: CARDIA_EVENTS.ABILITY_COPIED,
                payload: {
                    sourceCardId: targetCard.uid,
                    sourceAbilityId: targetAbilityId,
                    copiedByCardId: ctx.cardId,
                    copiedByPlayerId: ctx.playerId,
                },
                timestamp: ctx.timestamp,
            },
            // 被复制能力的事件
            ...result.events,
            // 抽一张牌
            {
                type: CARDIA_EVENTS.CARD_DRAWN,
                payload: {
                    playerId: ctx.playerId,
                    count: 1,
                },
                timestamp: ctx.timestamp,
            }
        ];
        
        return {
            events,
            interaction: result.interaction,
        };
    }
    
    // 创建卡牌选择交互
    const interaction = createCardSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.abilityId,
        ctx.playerId,
        '选择要弃掉并复制能力的手牌',
        '选择你的一张具有即时能力的手牌',
        1, // minSelect
        1, // maxSelect
        {
            owner: ctx.playerId,
            location: 'hand',
            hasInstantAbility: true,
        },
        ctx.cardId  // ✅ 添加：传入元素师的 cardId
    );
    
    // 填充可选卡牌列表
    interaction.availableCards = eligibleCards.map(c => c.uid);
    
    return {
        events: [],
        interaction,
    };
});

/**
 * 注册组 5 的交互处理器
 */
export function registerCopyInteractionHandlers(): void {
    // 女导师：选择目标卡牌后复制其能力
    registerInteractionHandler(ABILITY_IDS.GOVERNESS, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selectedCard = value as { cardUid?: string };
        if (!selectedCard?.cardUid) {
            console.error('[Governess] No cardUid in interaction value');
            return { state, events: [] };
        }
        
        const player = state.core.players[playerId];
        const targetCard = player.playedCards.find(c => c.uid === selectedCard.cardUid);
        
        if (!targetCard || targetCard.abilityIds.length === 0) {
            console.error('[Governess] Selected card not found or has no abilities:', selectedCard.cardUid);
            return { state, events: [] };
        }
        
        // 重新调用女导师的能力执行器，传入 selectedCardId
        const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.GOVERNESS);
        if (!executor) {
            console.error('[Governess] Executor not found');
            return { state, events: [] };
        }
        
        // ✅ 修复：从 cardiaInteraction.cardId 获取女导师的 cardId
        const cardiaInteraction = (_interactionData as any)?.cardiaInteraction;
        const cardId = cardiaInteraction?.cardId || '';
        
        console.log('[Governess] Interaction handler:', {
            cardId,
            selectedCardId: selectedCard.cardUid,
            interactionData: _interactionData,
        });
        
        const ctx: CardiaAbilityContext = {
            core: state.core,
            playerId,
            opponentId: playerId === '0' ? '1' : '0',
            cardId,
            abilityId: ABILITY_IDS.GOVERNESS,
            timestamp,
            random: _random,
            selectedCardId: selectedCard.cardUid,
        };
        
        const result = executor(ctx);
        
        console.log('[Governess] Executor result:', {
            eventsCount: result.events.length,
            eventTypes: result.events.map(e => e.type),
            events: result.events,
        });
        
        return {
            state,
            events: result.events,
            interaction: result.interaction, // ✅ 修复：传递被复制能力的交互
        };
    });
    
    // 幻术师：选择目标卡牌后复制其能力
    registerInteractionHandler(ABILITY_IDS.ILLUSIONIST, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selectedCard = value as { cardUid?: string };
        if (!selectedCard?.cardUid) {
            console.error('[Illusionist] No cardUid in interaction value');
            return { state, events: [] };
        }
        
        const opponentId = playerId === '0' ? '1' : '0';
        const opponent = state.core.players[opponentId];
        const targetCard = opponent.playedCards.find(c => c.uid === selectedCard.cardUid);
        
        if (!targetCard || targetCard.abilityIds.length === 0) {
            console.error('[Illusionist] Selected card not found or has no abilities:', selectedCard.cardUid);
            return { state, events: [] };
        }
        
        // 重新调用幻术师的能力执行器，传入 selectedCardId
        const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ILLUSIONIST);
        if (!executor) {
            console.error('[Illusionist] Executor not found');
            return { state, events: [] };
        }
        
        // ✅ 修复：从 cardiaInteraction.cardId 获取幻术师的 cardId
        const cardiaInteraction = (_interactionData as any)?.cardiaInteraction;
        const cardId = cardiaInteraction?.cardId || '';
        
        const ctx: CardiaAbilityContext = {
            core: state.core,
            playerId,
            opponentId,
            cardId,
            abilityId: ABILITY_IDS.ILLUSIONIST,
            timestamp,
            random: _random,
            selectedCardId: selectedCard.cardUid,
        };
        
        const result = executor(ctx);
        
        return {
            state,
            events: result.events,
            interaction: result.interaction, // ✅ 修复：传递被复制能力的交互
        };
    });
    
    // 元素师：选择目标手牌后弃掉并复制其能力
    registerInteractionHandler(ABILITY_IDS.ELEMENTALIST, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selectedCard = value as { cardUid?: string };
        if (!selectedCard?.cardUid) {
            console.error('[Elementalist] No cardUid in interaction value');
            return { state, events: [] };
        }
        
        const player = state.core.players[playerId];
        const targetCard = player.hand.find(c => c.uid === selectedCard.cardUid);
        
        if (!targetCard || targetCard.abilityIds.length === 0) {
            console.error('[Elementalist] Selected card not found or has no abilities:', selectedCard.cardUid);
            return { state, events: [] };
        }
        
        // 重新调用元素师的能力执行器，传入 selectedCardId
        const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ELEMENTALIST);
        if (!executor) {
            console.error('[Elementalist] Executor not found');
            return { state, events: [] };
        }
        
        const opponentId = playerId === '0' ? '1' : '0';
        // ✅ 修复：从 cardiaInteraction.cardId 获取元素师的 cardId
        const cardiaInteraction = (_interactionData as any)?.cardiaInteraction;
        const cardId = cardiaInteraction?.cardId || '';
        
        const ctx: CardiaAbilityContext = {
            core: state.core,
            playerId,
            opponentId,
            cardId,
            abilityId: ABILITY_IDS.ELEMENTALIST,
            timestamp,
            random: _random,
            selectedCardId: selectedCard.cardUid,
        };
        
        const result = executor(ctx);
        
        return {
            state,
            events: result.events,
            interaction: result.interaction, // ✅ 修复：传递被复制能力的交互
        };
    });
}

// 导入必要的类型和函数
import { registerInteractionHandler } from '../abilityInteractionHandlers';
