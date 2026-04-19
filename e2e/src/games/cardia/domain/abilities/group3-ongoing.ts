/**
 * 组 3：持续能力（5 个）
 * 
 * 这些能力放置持续标记（🔄），在后续遭遇中自动应用效果。
 * 持续标记的生命周期：
 * - 调停者、审判官：持续到游戏结束（除非被虚空法师移除）
 * - 财务官、顾问、机械精灵：一次性效果，触发后自动移除
 */

import { ABILITY_IDS } from '../ids';
import { CARDIA_EVENTS } from '../events';
import { abilityExecutorRegistry } from '../abilityExecutor';
import type { CardiaAbilityContext } from '../abilityExecutor';

/**
 * 调停者（Mediator）- 影响力 4
 * 效果：这次遭遇为平局
 * 
 * 实现：
 * 1. 放置持续标记，只影响当前遭遇（通过 encounterIndex 限定）
 * 2. 遭遇结算时检查持续标记，强制平局
 * 3. 如果当前遭遇已有获胜方（印戒已放置），移除获胜方卡牌上的印戒
 * 
 * 持续时间：一次性（只影响当前遭遇）
 * 
 * 注意：虽然标记是持续的（直到被虚空法师移除），但效果只影响当前遭遇。
 * 这是通过 encounterIndex 字段实现的：只有当 encounterIndex 匹配时才应用效果。
 */
abilityExecutorRegistry.register(ABILITY_IDS.MEDIATOR, (ctx: CardiaAbilityContext) => {
    const events: any[] = [];
    
    // 1. 放置持续标记（只影响当前遭遇）
    events.push({
        type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED.type,
        payload: {
            abilityId: ctx.abilityId,
            cardId: ctx.cardId,
            playerId: ctx.playerId,
            effectType: 'forceTie',
            timestamp: ctx.timestamp,
            encounterIndex: ctx.core.turnNumber, // 记录当前遭遇索引，只影响这个遭遇
        },
        timestamp: ctx.timestamp,
    });
    
    // 2. 检查当前遭遇是否有获胜方，如果有，移除获胜方卡牌上的印戒
    const currentEncounter = ctx.core.currentEncounter;
    if (currentEncounter && currentEncounter.winnerId && currentEncounter.winnerId !== 'tie') {
        const winnerId = currentEncounter.winnerId;
        const winnerPlayer = ctx.core.players[winnerId];
        
        // 查找当前遭遇中获胜方的卡牌（最后一张打出的卡牌）
        if (winnerPlayer && winnerPlayer.playedCards.length > 0) {
            const winnerCard = winnerPlayer.playedCards[winnerPlayer.playedCards.length - 1];
            
            // 如果获胜方卡牌有印戒，移除印戒
            if (winnerCard && winnerCard.signets > 0) {
                console.log('[Mediator] Removing signet from winner card', {
                    winnerId,
                    cardUid: winnerCard.uid,
                    signets: winnerCard.signets,
                });
                
                events.push({
                    type: CARDIA_EVENTS.SIGNET_REMOVED.type,
                    payload: {
                        cardId: winnerCard.uid,
                        playerId: winnerId,
                    },
                    timestamp: ctx.timestamp,
                });
            }
        }
    }
    
    return { events };
});

/**
 * 审判官（Magistrate）- 影响力 8
 * 效果：你赢得所有平局，包括之后的遭遇。平局不会触发能力
 * 
 * 实现：放置持续标记，在遭遇结算时将平局转换为己方获胜
 * 持续时间：永久（直到被虚空法师移除）
 * 优先级：高于调停者（如果双方都有持续标记，审判官优先）
 */
abilityExecutorRegistry.register(ABILITY_IDS.MAGISTRATE, (ctx: CardiaAbilityContext) => {
    return {
        events: [
            {
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED.type,
                payload: {
                    abilityId: ctx.abilityId,
                    cardId: ctx.cardId,
                    playerId: ctx.playerId,
                    effectType: 'winTies',
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 财务官（Treasurer）- 影响力 12
 * 效果：🔄 上一个遭遇获胜的那张牌额外获得1枚印戒
 * 
 * 实现：
 * 1. 放置持续标记（保持持续能力的语义）
 * 2. 同时立即检查上一个遭遇的获胜卡牌并给予额外印戒（效果立即生效）
 * 3. 持续标记在下次遭遇结算时被移除（一次性效果）
 * 
 * 注意：
 * - "上一个遭遇"指的是财务官激活时的上一个遭遇（不是当前遭遇）
 * - 例如：第2回合 P1 获胜，第3回合财务官激活，立即给第2回合的获胜卡牌额外印戒
 * - 持续标记的作用：标识能力已激活，在下次遭遇结算时被移除
 */
abilityExecutorRegistry.register(ABILITY_IDS.TREASURER, (ctx: CardiaAbilityContext) => {
    const events: any[] = [];
    
    // 2. 立即检查上一个遭遇的获胜卡牌并给予额外印戒
    // 注意：Treasurer 在当前遭遇的 ability 阶段激活
    // 此时 previousEncounter 已经是当前遭遇（第N回合）
    // 我们需要的是"上一个遭遇"（第N-1回合），即 encounterHistory 的倒数第二个
    const encounterHistory = ctx.core.encounterHistory;
    const previousEncounter = encounterHistory.length >= 2 
        ? encounterHistory[encounterHistory.length - 2]  // 倒数第二个遭遇
        : null;
    
    console.log('[Treasurer] Ability activated:', {
        playerId: ctx.playerId,
        cardId: ctx.cardId,
        currentTurn: ctx.core.turnNumber,
        encounterHistoryLength: encounterHistory.length,
        previousEncounter: previousEncounter ? {
            winnerId: previousEncounter.winnerId,
            player1CardUid: previousEncounter.player1Card?.uid,
            player2CardUid: previousEncounter.player2Card?.uid,
        } : null,
    });
    
    let targetCardId: string | undefined;
    let targetPlayerId: string | undefined;
    
    if (previousEncounter && previousEncounter.winnerId && previousEncounter.winnerId !== 'tie') {
        // 找到上一个遭遇的获胜卡牌
        const previousWinnerCard = previousEncounter.winnerId === previousEncounter.player1Card?.ownerId
            ? previousEncounter.player1Card
            : previousEncounter.player2Card;
        
        if (previousWinnerCard) {
            targetCardId = previousWinnerCard.uid;
            targetPlayerId = previousEncounter.winnerId;
            
            // 立即给上一个遭遇的获胜卡牌额外印戒
            events.push({
                type: CARDIA_EVENTS.EXTRA_SIGNET_PLACED.type,
                timestamp: ctx.timestamp,
                payload: {
                    cardId: previousWinnerCard.uid,
                    playerId: previousEncounter.winnerId,
                },
            });
            
            console.log('[Treasurer] Extra signet granted immediately to previous encounter winner:', {
                previousWinnerCardId: previousWinnerCard.uid,
                previousWinnerId: previousEncounter.winnerId,
                encounterIndex: encounterHistory.length - 2,
            });
        }
    } else {
        console.log('[Treasurer] No previous encounter winner found:', {
            hasPreviousEncounter: !!previousEncounter,
            previousWinnerId: previousEncounter?.winnerId,
            reason: !previousEncounter ? 'no previous encounter' : 
                    previousEncounter.winnerId === 'tie' ? 'previous was tie' : 
                    'unknown',
        });
    }
    
    // 1. 放置持续标记（保持持续能力的语义）
    // 记录目标卡牌信息，以便虚空法师移除时能收回额外印戒
    events.push({
        type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED.type,
        payload: {
            abilityId: ctx.abilityId,
            cardId: ctx.cardId,
            playerId: ctx.playerId,
            effectType: 'extraSignet',
            timestamp: ctx.timestamp,
            encounterIndex: ctx.core.turnNumber, // 记录放置时的遭遇索引
            targetCardId,  // 记录目标卡牌 UID（虚空法师移除时需要）
            targetPlayerId, // 记录目标玩家 ID（虚空法师移除时需要）
        },
        timestamp: ctx.timestamp,
    });
    
    return { events };
});

/**
 * 顾问（Advisor）- 影响力 12（II 牌组）
 * 效果：上一个遭遇中，你的牌获胜且你对手的牌失败
 * 
 * 实现：放置持续标记，在下次遭遇结算时额外放置印戒
 * 持续时间：一次性（触发后自动移除）
 * 
 * 注意：根据卡牌描述，顾问的效果与财务官相同，都是额外获得1枚印戒
 * 区别在于触发条件的描述方式不同，但实际效果相同
 */
abilityExecutorRegistry.register(ABILITY_IDS.ADVISOR, (ctx: CardiaAbilityContext) => {
    return {
        events: [
            {
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED.type,
                payload: {
                    abilityId: ctx.abilityId,
                    cardId: ctx.cardId,
                    playerId: ctx.playerId,
                    effectType: 'extraSignet',
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

/**
 * 机械精灵（Mechanical Spirit）- 影响力 15
 * 效果：如果你赢得下一个遭遇，你赢得游戏
 * 
 * 实现：放置持续标记，在下次遭遇结算时检查获胜条件并触发游戏结束
 * 持续时间：一次性（触发后自动移除）
 * 
 * 注意：这是一个特殊胜利条件，需要在遭遇结算时特殊处理
 */
abilityExecutorRegistry.register(ABILITY_IDS.MECHANICAL_SPIRIT, (ctx: CardiaAbilityContext) => {
    return {
        events: [
            {
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED.type,
                payload: {
                    abilityId: ctx.abilityId,
                    cardId: ctx.cardId,
                    playerId: ctx.playerId,
                    effectType: 'conditionalVictory',
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});
