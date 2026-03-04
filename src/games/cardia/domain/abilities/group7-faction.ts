/**
 * 组 7：派系相关能力（2 个）
 * 
 * 这些能力需要玩家选择一个派系，然后对该派系的卡牌执行操作。
 */

import { ABILITY_IDS, FACTION_IDS } from '../ids';
import { CARDIA_EVENTS } from '../events';
import { abilityExecutorRegistry } from '../abilityExecutor';
import { createFactionSelectionInteraction } from '../interactionHandlers';
import { registerInteractionHandler } from '../abilityInteractionHandlers';
import type { CardiaAbilityContext } from '../abilityExecutor';
import type { FactionType, CardiaEvent } from '../core-types';

/**
 * 伏击者（Ambusher）- 影响力 9
 * 效果：选择一个派系，你的对手弃掉所有该派系的手牌
 */
abilityExecutorRegistry.register(ABILITY_IDS.AMBUSHER, (ctx: CardiaAbilityContext) => {
    // 创建派系选择交互
    const interaction = createFactionSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.abilityId,
        ctx.playerId,
        '选择派系',
        '选择一个派系，你的对手弃掉所有该派系的手牌'
    );
    
    return {
        events: [],
        interaction,
    };
});

/**
 * 巫王（Witch King）- 影响力 13（II 牌组）
 * 效果：选择一个派系，你的对手从手牌和牌库弃掉所有该派系的牌，然后混洗他的牌库
 */
abilityExecutorRegistry.register(ABILITY_IDS.WITCH_KING, (ctx: CardiaAbilityContext) => {
    // 创建派系选择交互
    const interaction = createFactionSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.abilityId,
        ctx.playerId,
        '选择派系',
        '选择一个派系，你的对手从手牌和牌库弃掉所有该派系的牌，然后混洗他的牌库'
    );
    
    return {
        events: [],
        interaction,
    };
});

/**
 * 注册派系相关能力的交互处理函数
 */
export function registerFactionInteractionHandlers(): void {
    // 伏击者：选择派系后，对手弃掉所有该派系的手牌
    registerInteractionHandler(ABILITY_IDS.AMBUSHER, (state, playerId, value, _interactionData, _random, timestamp) => {
        console.info('[AMBUSHER] Handler called', {
            playerId,
            value,
            valueType: typeof value,
            valueKeys: value && typeof value === 'object' ? Object.keys(value) : undefined,
        });
        
        const selectedFaction = (value as { faction?: string })?.faction;
        
        console.info('[AMBUSHER] Selected faction', { selectedFaction });
        
        if (!selectedFaction) {
            console.error('[AMBUSHER] No faction selected!');
            return undefined;
        }
        
        const opponentId = playerId === '0' ? '1' : '0';
        const opponentPlayer = state.core.players[opponentId];
        
        // 查找对手该派系的所有手牌
        const factionCards = opponentPlayer.hand.filter(card => card.faction === selectedFaction);
        
        console.info('[AMBUSHER] Faction cards found', {
            opponentId,
            faction: selectedFaction,
            count: factionCards.length,
            cards: factionCards.map(c => ({ uid: c.uid, defId: c.defId, faction: c.faction })),
        });
        
        if (factionCards.length === 0) {
            console.info('[AMBUSHER] No cards to discard');
            return { state, events: [] };
        }
        
        const cardIds = factionCards.map(card => card.uid);
        
        const events: CardiaEvent[] = [
            {
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: opponentId,
                    cardIds,
                    from: 'hand',
                },
                timestamp,
            }
        ];
        
        console.info('[AMBUSHER] Returning events', { events });
        
        return { state, events };
    });
    
    // 巫王：选择派系后，对手从手牌和牌库弃掉所有该派系的牌
    registerInteractionHandler(ABILITY_IDS.WITCH_KING, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selectedFaction = (value as { faction?: string })?.faction;
        if (!selectedFaction) {
            return undefined;
        }
        
        const opponentId = playerId === '0' ? '1' : '0';
        const opponentPlayer = state.core.players[opponentId];
        
        // 查找对手手牌中该派系的所有卡牌
        const handFactionCards = opponentPlayer.hand.filter(card => card.faction === selectedFaction);
        const handCardIds = handFactionCards.map(card => card.uid);
        
        // 查找对手牌库中该派系的所有卡牌
        const deckFactionCards = opponentPlayer.deck.filter(card => card.faction === selectedFaction);
        const deckCardIds = deckFactionCards.map(card => card.uid);
        
        const events: CardiaEvent[] = [];
        
        // 弃掉手牌中该派系的卡牌
        if (handCardIds.length > 0) {
            events.push({
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: opponentId,
                    cardIds: handCardIds,
                    from: 'hand',
                },
                timestamp,
            });
        }
        
        // 弃掉牌库中该派系的卡牌
        if (deckCardIds.length > 0) {
            events.push({
                type: CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK,
                payload: {
                    playerId: opponentId,
                    count: deckCardIds.length,
                },
                timestamp,
            });
        }
        
        // 混洗牌库
        events.push({
            type: CARDIA_EVENTS.DECK_SHUFFLED,
            payload: {
                playerId: opponentId,
            },
            timestamp,
        });
        
        return { state, events };
    });
}
