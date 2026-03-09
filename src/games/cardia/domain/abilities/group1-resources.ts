/**
 * 组 1：简单资源操作能力（3 个）
 * 
 * 这些能力直接操作玩家的资源（手牌、牌库、弃牌堆），不需要复杂的交互或状态管理。
 * 
 * 注意：伏击者（AMBUSHER）和巫王（WITCH_KING）已移至 group7-faction.ts
 */

import { ABILITY_IDS } from '../ids';
import { CARDIA_EVENTS } from '../events';
import { abilityExecutorRegistry } from '../abilityExecutor';
import type { CardiaAbilityContext } from '../abilityExecutor';

/**
 * 破坏者（Saboteur）- 影响力 5
 * 效果：对手弃掉牌库顶 2 张牌
 * 
 * 实现：生成 CARDS_DISCARDED_FROM_DECK 事件
 */
abilityExecutorRegistry.register(ABILITY_IDS.SABOTEUR, (ctx: CardiaAbilityContext) => {
    const opponentPlayer = ctx.core.players[ctx.opponentId];
    
    // 如果对手牌库为空，不产生事件
    if (opponentPlayer.deck.length === 0) {
        return { events: [] };
    }
    
    return {
        events: [
            {
                type: CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK,
                payload: {
                    playerId: ctx.opponentId,
                    count: 2,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});


/**
 * 革命者（Revolutionary）- 影响力 5
 * 效果：你的对手弃掉2张手牌，然后抽取2张牌
 * 
 * 实现：生成 CARDS_DISCARDED 事件（弃2张）和 CARD_DRAWN 事件（抽2张）
 */
abilityExecutorRegistry.register(ABILITY_IDS.REVOLUTIONARY, (ctx: CardiaAbilityContext) => {
    const opponentPlayer = ctx.core.players[ctx.opponentId];
    
    // 如果对手手牌不足2张，弃掉所有手牌
    const discardCount = Math.min(2, opponentPlayer.hand.length);
    
    if (discardCount === 0) {
        // 没有手牌可弃，但仍然抽2张牌
        return {
            events: [
                {
                    type: CARDIA_EVENTS.CARD_DRAWN,
                    payload: {
                        playerId: ctx.opponentId,
                        count: 2,
                    },
                    timestamp: ctx.timestamp,
                }
            ],
        };
    }
    
    // 随机选择要弃掉的手牌
    const discardedCardIds: string[] = [];
    const availableIndices = Array.from({ length: opponentPlayer.hand.length }, (_, i) => i);
    
    for (let i = 0; i < discardCount; i++) {
        const randomIdx = Math.floor(ctx.random.random() * availableIndices.length);
        const cardIndex = availableIndices.splice(randomIdx, 1)[0];
        discardedCardIds.push(opponentPlayer.hand[cardIndex].uid);
    }
    
    return {
        events: [
            {
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: ctx.opponentId,
                    cardIds: discardedCardIds,
                    from: 'hand',
                },
                timestamp: ctx.timestamp,
            },
            {
                type: CARDIA_EVENTS.CARD_DRAWN,
                payload: {
                    playerId: ctx.opponentId,
                    count: 2,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});


/**
 * 继承者（Heir）- 影响力 16
 * 效果：对手选择保留 2 张手牌，弃掉其余手牌和整个牌库
 * 
 * 实现：
 * 1. 如果对手手牌 ≤ 2 张，直接弃掉整个牌库
 * 2. 如果对手手牌 > 2 张，需要交互（对手选择保留 2 张手牌）
 * 3. 弃掉未选择的手牌和整个牌库
 * 
 * 注意：这个能力需要交互，但由于当前框架尚未实现交互系统，
 * 我们先实现简化版本（随机保留 2 张手牌）。
 * 后续在 Task 11 实现交互系统时，会更新为完整版本。
 */
abilityExecutorRegistry.register(ABILITY_IDS.HEIR, (ctx: CardiaAbilityContext) => {
    const opponentPlayer = ctx.core.players[ctx.opponentId];
    const handCards = opponentPlayer.hand;
    
    // 如果对手手牌 ≤ 2 张，直接弃掉整个牌库
    if (handCards.length <= 2) {
        return {
            events: [
                {
                    type: CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK,
                    payload: {
                        playerId: ctx.opponentId,
                        count: opponentPlayer.deck.length,
                    },
                    timestamp: ctx.timestamp,
                }
            ],
        };
    }
    
    // 如果对手手牌 > 2 张，随机保留 2 张，弃掉其余手牌和整个牌库
    // TODO: 在 Task 11 实现交互系统后，改为让对手选择保留的 2 张手牌
    
    // 使用 Fisher-Yates 洗牌算法选择 2 张保留的牌，避免无限循环
    const availableIndices = Array.from({ length: handCards.length }, (_, i) => i);
    const keptCardIndices: number[] = [];
    
    for (let i = 0; i < 2; i++) {
        const randomIdx = Math.floor(ctx.random.random() * availableIndices.length);
        keptCardIndices.push(availableIndices[randomIdx]);
        availableIndices.splice(randomIdx, 1);
    }
    
    const keptSet = new Set(keptCardIndices);
    const discardedCardIds = handCards
        .filter((_, index) => !keptSet.has(index))
        .map(card => card.uid);
    
    return {
        events: [
            {
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: ctx.opponentId,
                    cardIds: discardedCardIds,
                    from: 'hand',
                },
                timestamp: ctx.timestamp,
            },
            {
                type: CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK,
                payload: {
                    playerId: ctx.opponentId,
                    count: opponentPlayer.deck.length,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 注册组 1 的交互处理器
 */
export function registerResourceInteractionHandlers(): void {
    // 革命者：对手选择弃掉的 2 张手牌
    registerInteractionHandler(ABILITY_IDS.REVOLUTIONARY, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selection = value as { cardUids?: string[] };
        
        if (!selection?.cardUids || selection.cardUids.length !== 2) {
            console.error('[Revolutionary] Invalid selection, expected 2 cards:', selection);
            return { state, events: [] };
        }
        
        const opponentId = playerId === '0' ? '1' : '0';
        
        return {
            state,
            events: [
                // 弃掉选中的 2 张手牌
                {
                    type: CARDIA_EVENTS.CARDS_DISCARDED,
                    payload: {
                        playerId: opponentId,
                        cardIds: selection.cardUids,
                        from: 'hand',
                    },
                    timestamp,
                },
                // 抽 2 张牌
                {
                    type: CARDIA_EVENTS.CARD_DRAWN,
                    payload: {
                        playerId: opponentId,
                        count: 2,
                    },
                    timestamp,
                }
            ],
        };
    });
    
    // 继承者：对手选择保留的 2 张手牌
    registerInteractionHandler(ABILITY_IDS.HEIR, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selection = value as { cardUids?: string[] };
        
        if (!selection?.cardUids || selection.cardUids.length !== 2) {
            console.error('[Heir] Invalid selection, expected 2 cards:', selection);
            return { state, events: [] };
        }
        
        const opponentId = playerId === '0' ? '1' : '0';
        const opponentPlayer = state.core.players[opponentId];
        
        // 计算要弃掉的手牌（所有手牌 - 保留的 2 张）
        const keptSet = new Set(selection.cardUids);
        const discardedCardIds = opponentPlayer.hand
            .filter(card => !keptSet.has(card.uid))
            .map(card => card.uid);
        
        return {
            state,
            events: [
                // 弃掉未选中的手牌
                {
                    type: CARDIA_EVENTS.CARDS_DISCARDED,
                    payload: {
                        playerId: opponentId,
                        cardIds: discardedCardIds,
                        from: 'hand',
                    },
                    timestamp,
                },
                // 弃掉整个牌库
                {
                    type: CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK,
                    payload: {
                        playerId: opponentId,
                        count: opponentPlayer.deck.length,
                    },
                    timestamp,
                }
            ],
        };
    });
}

// 导入必要的类型和函数
import { registerInteractionHandler } from '../abilityInteractionHandlers';

