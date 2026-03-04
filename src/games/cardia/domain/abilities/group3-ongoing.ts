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
 * 1. 放置持续标记（用于标识能力已激活）
 * 2. 立即改变当前遭遇结果为平局
 * 
 * 持续时间：永久（直到被虚空法师移除）
 */
abilityExecutorRegistry.register(ABILITY_IDS.MEDIATOR, (ctx: CardiaAbilityContext) => {
    const events = [];
    
    // 1. 放置持续标记
    events.push({
        type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED,
        payload: {
            abilityId: ctx.abilityId,
            cardId: ctx.cardId,
            playerId: ctx.playerId,
            effectType: 'forceTie',
            timestamp: ctx.timestamp,
            encounterIndex: ctx.core.turnNumber, // 记录影响的遭遇索引
        },
        timestamp: ctx.timestamp,
    });
    
    // 2. 立即改变当前遭遇结果为平局
    // 注意：这里使用 turnNumber 作为 slotIndex，因为 encounterHistory 的索引就是 turnNumber
    events.push({
        type: CARDIA_EVENTS.ENCOUNTER_RESULT_CHANGED,
        payload: {
            slotIndex: ctx.core.encounterHistory.length - 1, // 最后一个遭遇（当前遭遇）
            newWinner: 'tie',
        },
        timestamp: ctx.timestamp,
    });
    
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
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED,
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
 * 效果：🔄 上个遭遇获胜的牌额外获得1枚印戒
 * 
 * 实现：放置持续标记，在之后的每次遭遇结算时，获胜的牌额外获得1枚印戒
 * 持续时间：永久（直到被虚空法师移除）
 * 不区分玩家：任何玩家获胜都会触发
 */
abilityExecutorRegistry.register(ABILITY_IDS.TREASURER, (ctx: CardiaAbilityContext) => {
    return {
        events: [
            {
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED,
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
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED,
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
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED,
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
