/**
 * 组 6：特殊机制能力（5 个）
 * 
 * 这些能力具有独特的游戏机制，包括卡牌替换、揭示顺序改变、额外印戒、条件弃牌和直接胜利。
 */

import { ABILITY_IDS, FACTION_IDS } from '../ids';
import { CARDIA_EVENTS } from '../events';
import { abilityExecutorRegistry } from '../abilityExecutor';
import type { CardiaAbilityContext } from '../abilityExecutor';

/**
 * 傀儡师（Puppeteer）- 影响力 10
 * 效果：弃掉相对的牌，替换为你从对手手牌随机抽取的一张牌。对方的能力不会被触发
 * 
 * 实现：弃掉对手在相同遭遇序号的卡牌，从对手手牌随机抽取一张替换
 * 注意：替换的卡牌不触发能力（在 execute.ts 中处理）
 */
abilityExecutorRegistry.register(ABILITY_IDS.PUPPETEER, (ctx: CardiaAbilityContext) => {
    console.log('[Puppeteer] 能力执行器被调用');
    
    const player = ctx.core.players[ctx.playerId];
    const opponent = ctx.core.players[ctx.opponentId];
    
    // 查找当前卡牌
    const currentCard = player.playedCards.find(card => card.uid === ctx.cardId);
    
    if (!currentCard) {
        console.warn('[Puppeteer] 未找到当前卡牌');
        return { events: [] };
    }
    
    // 查找相对的卡牌（相同遭遇序号）
    const oppositeCard = opponent.playedCards.find(
        card => card.encounterIndex === currentCard.encounterIndex
    );
    
    if (!oppositeCard) {
        console.warn('[Puppeteer] 未找到相对的卡牌');
        return { events: [] };
    }
    
    // 对手手牌为空，无法替换
    if (opponent.hand.length === 0) {
        console.warn('[Puppeteer] 对手手牌为空');
        return { events: [] };
    }
    
    // 随机选择对手手牌中的一张
    const randomIndex = Math.floor(ctx.random.random() * opponent.hand.length);
    const replacementCard = opponent.hand[randomIndex];
    
    console.log('[Puppeteer] 准备替换卡牌:', {
        oldCard: { uid: oppositeCard.uid, defId: oppositeCard.defId },
        newCard: { uid: replacementCard.uid, defId: replacementCard.defId },
        encounterIndex: currentCard.encounterIndex,
    });
    
    return {
        events: [
            {
                type: CARDIA_EVENTS.CARD_REPLACED,
                payload: {
                    oldCardId: oppositeCard.uid,
                    newCardId: replacementCard.uid,
                    playerId: ctx.opponentId,
                    encounterIndex: currentCard.encounterIndex,
                    suppressAbility: true, // 不触发替换卡牌的能力
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 占卜师（Diviner）- 影响力 6
 * 效果：下一次遭遇中，你的对手必须在你之前朝上打出牌
 * 
 * 实现：
 * 1. 设置 revealFirstNextEncounter 为对手ID（明牌）
 * 2. 设置 forcedPlayOrderNextEncounter 为对手ID（强制先出牌）
 */
abilityExecutorRegistry.register(ABILITY_IDS.DIVINER, (ctx: CardiaAbilityContext) => {
    return {
        events: [
            {
                type: CARDIA_EVENTS.REVEAL_ORDER_CHANGED,
                payload: {
                    revealFirstPlayerId: ctx.opponentId,
                    forcedPlayOrderPlayerId: ctx.opponentId,  // 新增：强制先出牌
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 贵族（Aristocrat）- 影响力 8（II 牌组）
 * 效果：如果本牌赢得遭遇，获得额外1枚印戒
 * 
 * 实现：在遭遇结算时检查本牌是否获胜，如果是则额外放置印戒
 * 注意：这个逻辑应该在 execute.ts 的 resolveEncounter 中处理
 * 当前只发射事件标记，实际效果在遭遇结算时应用
 */
abilityExecutorRegistry.register(ABILITY_IDS.ARISTOCRAT, (ctx: CardiaAbilityContext) => {
    // 贵族的效果是条件性的，需要在遭遇结算时检查
    // 这里发射一个标记事件，表示贵族能力已激活
    // 实际的额外印戒放置在 resolveEncounter 中处理
    return {
        events: [
            {
                type: CARDIA_EVENTS.EXTRA_SIGNET_PLACED,
                payload: {
                    cardId: ctx.cardId,
                    playerId: ctx.playerId,
                    conditional: true, // 标记为条件性效果
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 精灵（Elf）- 影响力 16
 * 效果：你赢得游戏
 * 
 * 实现：直接触发游戏胜利
 */
abilityExecutorRegistry.register(ABILITY_IDS.ELF, (ctx: CardiaAbilityContext) => {
    return {
        events: [
            {
                type: CARDIA_EVENTS.GAME_WON,
                payload: {
                    winnerId: ctx.playerId,
                    reason: 'elf',
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 勒索者（Extortionist）- 影响力 9（II 牌组）
 * 效果：选择一个派系，如果你的对手下一张牌没有打出该派系，则在揭示那张牌后弃掉2张手牌
 * 
 * 实现：注册延迟效果，在对手下次打牌后检查派系并执行弃牌
 * TODO: 在 Task 11 实现交互系统后，让玩家选择派系
 * 当前简化版本：自动选择沼泽派系
 */
abilityExecutorRegistry.register(ABILITY_IDS.EXTORTIONIST, (ctx: CardiaAbilityContext) => {
    // TODO: 在 Task 11 实现交互系统后，让玩家选择派系
    const selectedFaction = FACTION_IDS.SWAMP; // 简化版本：自动选择沼泽派系
    
    return {
        events: [
            {
                type: CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED,
                payload: {
                    effectId: `extortionist_${ctx.cardId}`,
                    abilityId: ABILITY_IDS.EXTORTIONIST,
                    playerId: ctx.playerId,
                    targetPlayerId: ctx.opponentId,
                    trigger: 'onOpponentPlayCard',
                    data: {
                        requiredFaction: selectedFaction,
                        discardCount: 2,
                    },
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 注册组 6 的交互处理器
 */
export function registerSpecialInteractionHandlers(): void {
    // 勒索者：选择派系后注册延迟效果
    registerInteractionHandler(ABILITY_IDS.EXTORTIONIST, (state, playerId, value, _interactionData, _random, timestamp) => {
        const selectedFaction = (value as { faction?: string })?.faction;
        if (!selectedFaction) {
            console.error('[Extortionist] No faction in interaction value');
            return { state, events: [] };
        }
        
        const opponentId = playerId === '0' ? '1' : '0';
        
        return {
            state,
            events: [
                {
                    type: CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED,
                    payload: {
                        effectId: `extortionist_${timestamp}`,
                        abilityId: ABILITY_IDS.EXTORTIONIST,
                        playerId,
                        targetPlayerId: opponentId,
                        trigger: 'onOpponentPlayCard',
                        data: {
                            requiredFaction: selectedFaction,
                            discardCount: 2,
                        },
                    },
                    timestamp,
                }
            ],
        };
    });
}

// 导入必要的类型和函数
import { registerInteractionHandler } from '../abilityInteractionHandlers';
