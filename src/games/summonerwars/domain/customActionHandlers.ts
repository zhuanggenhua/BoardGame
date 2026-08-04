/**
 * 召唤师战争 - 自定义 Action 处理器注册表
 *
 * 将 abilityResolver.ts 中 case 'custom' 的 if/else 链
 * 重构为引擎层 ActionHandlerRegistry 模式。
 *
 * 设计：
 * - 注册特定 actionId 的处理器（如 soul_transfer_request、judgment_draw）
 * - 未注册的 actionId 使用通用 ABILITY_TRIGGERED 事件（fallback）
 * - 支持 getRegisteredIds() 供完整性测试使用
 */

import { ActionHandlerRegistry } from '../../../engine/primitives/actionRegistry';
import type { GameEvent } from '../../../engine/types';
import type { AbilityContext } from './abilityResolver';
import { SW_EVENTS } from './types';
import {
    getUnitAt,
    getSummoner,
    isCellEmpty,
    manhattanDistance,
    normalizeUnitBoosts,
} from './helpers';
import { isMoguFungalBeastCard, isMoguSporePlagueBodyCard } from './ids';

// ============================================================================
// Handler 上下文与签名
// ============================================================================

/** 自定义 Action 处理器上下文 */
export interface SWCustomActionContext {
    /** 技能效果解析上下文 */
    ctx: AbilityContext;
    /** action 参数（来自 effect.params） */
    params?: Record<string, unknown>;
    /** 来源技能 ID */
    abilityId: string;
    /** 时间戳 */
    timestamp: number;
}

// ============================================================================
// 注册表实例
// ============================================================================

export const swCustomActionRegistry = new ActionHandlerRegistry<SWCustomActionContext, GameEvent[]>(
    'SW-CustomAction',
);

// ============================================================================
// Handler 注册
// ============================================================================

// --- 灵魂转移请求（亡灵法师） ---
swCustomActionRegistry.register('soul_transfer_request', ({ ctx, timestamp }) => [{
    type: SW_EVENTS.SOUL_TRANSFER_REQUESTED,
    payload: {
        sourceUnitId: ctx.sourceUnit.instanceId,
        sourcePosition: ctx.sourcePosition,
        victimPosition: ctx.victimPosition,
        ownerId: ctx.ownerId,
    },
    timestamp,
}]);

// --- 心灵捕获检查（欺心巫族） ---
swCustomActionRegistry.register('mind_capture_check', ({ ctx, timestamp }) => [{
    type: SW_EVENTS.MIND_CAPTURE_REQUESTED,
    payload: {
        sourceUnitId: ctx.sourceUnit.instanceId,
        sourcePosition: ctx.sourcePosition,
        targetPosition: ctx.targetPosition,
        ownerId: ctx.ownerId,
    },
    timestamp,
}]);

// --- 裁决抓牌（圣骑士）：攻击后抓取等于所掷出 special 数量的卡牌 ---
swCustomActionRegistry.register('judgment_draw', ({ ctx, timestamp }) => {
    const specialCount = (ctx.diceResults ?? [])
      .flatMap(r => r.marks)
      .filter(mark => mark === 'special')
      .length;
    if (specialCount <= 0) return [];
    return [{
        type: SW_EVENTS.CARD_DRAWN,
        payload: { playerId: ctx.ownerId, count: specialCount, sourceAbilityId: 'judgment' },
        timestamp,
    }];
});

// --- 指引抓牌（圣骑士） ---
swCustomActionRegistry.register('guidance_draw', ({ ctx, timestamp }) => {
    const guidancePlayer = ctx.state.players[ctx.ownerId];
    const guidanceDraw = Math.min(2, guidancePlayer.deck.length);
    if (guidanceDraw <= 0) return [];
    return [{
        type: SW_EVENTS.CARD_DRAWN,
        payload: { playerId: ctx.ownerId, count: guidanceDraw, sourceAbilityId: 'guidance' },
        timestamp,
    }];
});

// --- 暗影精灵：死亡契约（本单位被消灭后伤害己方召唤师） ---
swCustomActionRegistry.register('shadow_death_pact_damage', ({ ctx, timestamp }) => {
    const summoner = getSummoner(ctx.state, ctx.ownerId);
    if (!summoner) return [];
    return [{
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: {
            position: summoner.position,
            damage: 1,
            reason: 'shadow_death_pact',
            sourceAbilityId: 'shadow_death_pact',
            sourcePlayerId: ctx.ownerId,
        },
        timestamp,
    }];
}, { categories: ['damage'] });

// --- 暗影精灵：难逃厄运（攻击阶段结束时按本回合击杀结果伤害召唤师） ---
swCustomActionRegistry.register('shadow_inescapable_doom_damage', ({ ctx, timestamp }) => {
    const killerCount = ctx.state.unitKillCountThisTurn?.[ctx.sourceUnit.instanceId] ?? 0;
    const targetPlayer = killerCount > 0
        ? (ctx.ownerId === '0' ? '1' : '0')
        : ctx.ownerId;
    const targetSummoner = getSummoner(ctx.state, targetPlayer);
    if (!targetSummoner) return [];
    return [{
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: {
            position: targetSummoner.position,
            damage: 1,
            reason: 'shadow_inescapable_doom',
            sourceAbilityId: 'shadow_inescapable_doom',
            sourcePlayerId: ctx.ownerId,
        },
        timestamp,
    }];
}, { categories: ['damage'] });

// --- 魔力成瘾（地精）：回合结束时有魔力花 1 魔力，否则弃置本单位 ---
swCustomActionRegistry.register('magic_addiction_check', ({ ctx, timestamp }) => {
    const owner = ctx.ownerId;
    if (ctx.state.players[owner].magic >= 1) {
        return [{
            type: SW_EVENTS.MAGIC_CHANGED,
            payload: { playerId: owner, delta: -1 },
            timestamp,
        }];
    }

    return [{
        type: SW_EVENTS.UNIT_DESTROYED,
        payload: {
            position: ctx.sourcePosition,
            cardId: ctx.sourceUnit.cardId,
            instanceId: ctx.sourceUnit.instanceId,
            cardName: ctx.sourceUnit.card.name,
            owner,
            reason: 'magic_addiction',
        },
        timestamp,
    }];
});

// --- 占位 handler（逻辑在 execute.ts 中处理，此处 no-op） ---
swCustomActionRegistry.register('divine_shield_check', () => []);
swCustomActionRegistry.register('healing_convert', () => []);

// --- 莫古：菌化野兽“感染”替换被消灭单位 ---
swCustomActionRegistry.register('mogu_infection_replace', ({ ctx, timestamp }) => {
    if (!ctx.victimPosition) return [];
    const card = ctx.state.players[ctx.ownerId].discard.find(isMoguSporePlagueBodyCard);
    if (!card || card.cardType !== 'unit') return [];
    return [{
        type: SW_EVENTS.UNIT_SUMMONED,
        payload: {
            playerId: ctx.ownerId,
            cardId: card.id,
            position: ctx.victimPosition,
            card,
            fromDiscard: true,
            sourceAbilityId: 'mogu_infection',
        },
        timestamp,
    }];
});

// --- 莫古：玛硕达“腐坏”阶段结束自伤；存活后的相邻友军充能由 InteractionSystem 等待玩家指定 ---
swCustomActionRegistry.register('mogu_decay', ({ ctx, timestamp }) => {
    return [{
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: {
            position: ctx.sourcePosition,
            damage: 1,
            reason: 'mogu_decay',
            sourceAbilityId: 'mogu_decay',
            sourcePlayerId: ctx.ownerId,
        },
        timestamp,
    }];
}, { categories: ['damage'] });

// --- 莫古：菌袍疫病体“菌化变异”替换自身 ---
swCustomActionRegistry.register('mogu_fungal_mutation_replace', ({ ctx, timestamp }) => {
    if (normalizeUnitBoosts(ctx.sourceUnit.boosts) < 3) return [];
    const card = ctx.state.players[ctx.ownerId].discard.find(isMoguFungalBeastCard);
    if (!card || card.cardType !== 'unit') return [];
    return [{
        type: SW_EVENTS.UNIT_SUMMONED,
        payload: {
            playerId: ctx.ownerId,
            cardId: card.id,
            position: ctx.sourcePosition,
            card,
            fromDiscard: true,
            sourceAbilityId: 'mogu_fungal_mutation',
        },
        timestamp,
    }];
});

// --- 莫古：枯萎法师“鲜血灌注” ---
swCustomActionRegistry.register('mogu_blood_infusion', ({ ctx, timestamp }) => {
    const targetPosition = ctx.payload?.targetPosition as import('./types').CellCoord | undefined;
    if (!targetPosition) return [];
    const target = getUnitAt(ctx.state, targetPosition);
    if (!target || target.owner !== ctx.ownerId) return [];
    if (manhattanDistance(ctx.sourcePosition, targetPosition) > 2) return [];
    return [
        {
            type: SW_EVENTS.UNIT_CHARGED,
            payload: { position: targetPosition, delta: 1, sourceAbilityId: 'mogu_blood_infusion' },
            timestamp,
        },
        {
            type: SW_EVENTS.UNIT_DAMAGED,
            payload: { position: targetPosition, damage: 1, reason: 'mogu_blood_infusion', sourcePlayerId: ctx.ownerId },
            timestamp,
        },
    ];
});

// --- 莫古：鲜血萨满“传输” ---
swCustomActionRegistry.register('mogu_transmission', ({ ctx, timestamp }) => {
    const mode = ctx.payload?.mode as string | undefined;
    const fromPosition = ctx.payload?.fromPosition as import('./types').CellCoord | undefined;
    const toPosition = ctx.payload?.toPosition as import('./types').CellCoord | undefined;
    const amount = Number(ctx.payload?.amount ?? 0);
    if (!toPosition || !Number.isFinite(amount) || amount <= 0) return [];
    const sourcePosition = mode === 'self_to_target' ? ctx.sourcePosition : fromPosition;
    if (!sourcePosition) return [];
    const fromUnit = getUnitAt(ctx.state, sourcePosition);
    const toUnit = getUnitAt(ctx.state, toPosition);
    if (!fromUnit || !toUnit || fromUnit.owner !== ctx.ownerId || toUnit.owner !== ctx.ownerId) return [];
    if (manhattanDistance(ctx.sourcePosition, sourcePosition) > 2 || manhattanDistance(ctx.sourcePosition, toPosition) > 2) return [];
    const transferAmount = Math.min(amount, normalizeUnitBoosts(fromUnit.boosts));
    if (transferAmount <= 0) return [];
    return [
        {
            type: SW_EVENTS.UNIT_CHARGED,
            payload: { position: sourcePosition, delta: -transferAmount, sourceAbilityId: 'mogu_transmission' },
            timestamp,
        },
        {
            type: SW_EVENTS.UNIT_CHARGED,
            payload: { position: toPosition, delta: transferAmount, sourceAbilityId: 'mogu_transmission' },
            timestamp,
        },
    ];
});

// --- 莫古：狂热菌菇持续效果的手动结算 ---
swCustomActionRegistry.register('mogu_fanatical_fungus', ({ ctx, timestamp }) => {
    const targetPosition = ctx.payload?.targetPosition as import('./types').CellCoord | undefined;
    const newPosition = ctx.payload?.newPosition as import('./types').CellCoord | undefined;
    if (!targetPosition) return [];
    const target = getUnitAt(ctx.state, targetPosition);
    if (!target || target.owner !== ctx.ownerId) return [];
    const finalPosition = newPosition ?? targetPosition;
    const events: GameEvent[] = [];
    if (newPosition && isCellEmpty(ctx.state, newPosition) && manhattanDistance(targetPosition, newPosition) === 1) {
        events.push({
            type: SW_EVENTS.UNIT_PUSHED,
            payload: { targetPosition, newPosition },
            timestamp,
        });
    }
    events.push({
        type: SW_EVENTS.UNIT_CHARGED,
        payload: { position: finalPosition, delta: 1, sourceAbilityId: 'mogu_fanatical_fungus' },
        timestamp,
    });
    events.push({
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: { position: finalPosition, damage: 1, reason: 'mogu_fanatical_fungus', sourcePlayerId: ctx.ownerId },
        timestamp,
    });
    return events;
});
