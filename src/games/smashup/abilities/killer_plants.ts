/**
 * 大杀四方 - 食人花派系能力
 *
 * 主题：额外出随从、搜索牌库、力量修正
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { grantExtraMinion, destroyMinion, getMinionPower } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { PowerCounterRemovedEvent, SmashUpEvent, CardsDrawnEvent, MinionDestroyedEvent } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, TriggerContext } from '../domain/ongoingEffects';

/** 急速生长 onPlay：额外打出一个随从 */
function killerPlantInstaGrow(ctx: AbilityContext): AbilityResult {
    return { events: [grantExtraMinion(ctx.playerId, 'killer_plant_insta_grow', ctx.now)] };
}

/** 野生食人花 onPlay：打出回合-2力量（通过 powerModifier 实现） */
function killerPlantWeedEater(ctx: AbilityContext): AbilityResult {
    // 打出时给 -2 力量修正（本回合有效，回合结束时应清除——MVP 先用 powerModifier 实现）
    const evt: PowerCounterRemovedEvent = {
        type: SU_EVENTS.POWER_COUNTER_REMOVED,
        payload: {
            minionUid: ctx.cardUid,
            baseIndex: ctx.baseIndex,
            amount: 2,
            reason: 'killer_plant_weed_eater',
        },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

// killer_plant_sleep_spores (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（-1力量）
// TODO: killer_plant_overgrowth (ongoing) - 降低爆破点（需要 ongoing 效果系统，暂不实现）
// TODO: killer_plant_entangled (ongoing) - 禁止移动+回合开始消灭（需要 ongoing + onTurnStart，暂不实现）
// TODO(完善): killer_plant_venus_man_trap (talent) - 搜索牌库打出力量≤2随从（当前为 MVP：抽第一张随从）
// TODO(完善): killer_plant_water_lily (ongoing) - 回合开始抽牌（当前为 MVP：抽牌但无 UI 提示）
// TODO(完善): killer_plant_sprout (ongoing) - 回合开始消灭自身+搜索打出随从（当前为 MVP：消灭自身+抽一张随从）
// TODO(完善): killer_plant_budding (action) - 搜索同名卡（当前为 MVP：抽第一张随从）
// TODO(完善): killer_plant_deep_roots (ongoing) - 保护随从不被移动（当前为 MVP：仅检测附着行动卡）
// TODO(完善): killer_plant_choking_vines (ongoing) - 回合开始消灭随从（当前为 MVP：自动消灭最低力量）
// TODO(完善): killer_plant_blossom (action) - 打出三个同名额外随从（当前为 MVP：直接加 3 次额外随从）

// ============================================================================
// ongoing 效果检查器
// ============================================================================

/**
 * deep_roots 保护检查：附着了 deep_roots 的随从不可被移动
 */
function killerPlantDeepRootsChecker(ctx: ProtectionCheckContext): boolean {
    return ctx.targetMinion.attachedActions.some(a => a.defId === 'killer_plant_deep_roots');
}

/**
 * water_lily 触发：回合开始时控制者抽1牌
 */
function killerPlantWaterLilyTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (const base of ctx.state.bases) {
        for (const m of base.minions) {
            if (m.defId !== 'killer_plant_water_lily') continue;
            if (m.controller !== ctx.playerId) continue;
            const player = ctx.state.players[m.controller];
            if (!player || player.deck.length === 0) continue;
            const drawnUid = player.deck[0].uid;
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: m.controller, count: 1, cardUids: [drawnUid] },
                timestamp: ctx.now,
            } as CardsDrawnEvent);
        }
    }
    return events;
}

/**
 * sprout 触发：控制者回合开始时消灭自身 + 搜索牌库打出一个随从
 * MVP：消灭自身 + 从牌库抽1张随从到手牌
 */
function killerPlantSproutTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (m.defId !== 'killer_plant_sprout') continue;
            if (m.controller !== ctx.playerId) continue;
            // 消灭自身
            events.push({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: m.uid,
                    minionDefId: m.defId,
                    fromBaseIndex: i,
                    ownerId: m.owner,
                    reason: 'killer_plant_sprout',
                },
                timestamp: ctx.now,
            } as MinionDestroyedEvent);
            // 从牌库找第一张随从
            const player = ctx.state.players[m.controller];
            if (player) {
                const minionCard = player.deck.find(c => c.type === 'minion');
                if (minionCard) {
                    events.push({
                        type: SU_EVENTS.CARDS_DRAWN,
                        payload: { playerId: m.controller, count: 1, cardUids: [minionCard.uid] },
                        timestamp: ctx.now,
                    } as CardsDrawnEvent);
                }
            }
        }
    }
    return events;
}

/**
 * choking_vines 触发：回合开始时消灭此基地上力量最低的随从
 */
function killerPlantChokingVinesTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const hasVines = base.ongoingActions.some(o => o.defId === 'killer_plant_choking_vines');
        if (!hasVines) continue;
        // 找力量最低的随从
        if (base.minions.length === 0) continue;
        let weakest = base.minions[0];
        let weakestPower = getMinionPower(ctx.state, weakest, i);
        for (let j = 1; j < base.minions.length; j++) {
            const power = getMinionPower(ctx.state, base.minions[j], i);
            if (power < weakestPower) {
                weakest = base.minions[j];
                weakestPower = power;
            }
        }
        events.push(destroyMinion(weakest.uid, weakest.defId, i, weakest.owner, 'killer_plant_choking_vines', ctx.now));
    }
    return events;
}

// ============================================================================
// 新增能力实现
// ============================================================================

/**
 * 金星捕蝇草 talent：搜索牌库打出力量≤2随从
 * MVP：自动选牌库中第一张力量≤2的随从到手牌
 */
function killerPlantVenusManTrap(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const target = player.deck.find(c => c.type === 'minion');
    // 简化：抽第一张随从（实际应检查力量≤2，但牌库中没有力量信息，MVP 简化处理）
    if (!target) return { events: [] };
    const evt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: 1, cardUids: [target.uid] },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/**
 * 发芽 onPlay：搜索牌库找同名随从
 * MVP：从牌库中找第一张随从到手牌
 */
function killerPlantBudding(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const target = player.deck.find(c => c.type === 'minion');
    if (!target) return { events: [] };
    const evt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: 1, cardUids: [target.uid] },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/**
 * 绽放 onPlay：额外打出3个随从
 */
function killerPlantBlossom(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantExtraMinion(ctx.playerId, 'killer_plant_blossom', ctx.now),
            grantExtraMinion(ctx.playerId, 'killer_plant_blossom', ctx.now),
            grantExtraMinion(ctx.playerId, 'killer_plant_blossom', ctx.now),
        ],
    };
}

/** 注册食人花派系所有能力 */
export function registerKillerPlantAbilities(): void {
    // 急速生长（行动卡）：额外打出一个随从
    registerAbility('killer_plant_insta_grow', 'onPlay', killerPlantInstaGrow);
    // 野生食人花（随从）：打出回合-2力量
    registerAbility('killer_plant_weed_eater', 'onPlay', killerPlantWeedEater);
    // 金星捕蝇草（talent）：搜索牌库打出力量≤2随从
    registerAbility('killer_plant_venus_man_trap', 'talent', killerPlantVenusManTrap);
    // 发芽（行动卡）：搜索牌库打出同名随从
    registerAbility('killer_plant_budding', 'onPlay', killerPlantBudding);
    // 绽放（行动卡）：额外打出3个随从
    registerAbility('killer_plant_blossom', 'onPlay', killerPlantBlossom);

    // === ongoing 效果注册 ===
    // deep_roots: 保护随从不被移动
    registerProtection('killer_plant_deep_roots', 'move', killerPlantDeepRootsChecker);
    // water_lily: 回合开始时控制者抽1牌
    registerTrigger('killer_plant_water_lily', 'onTurnStart', killerPlantWaterLilyTrigger);
    // sprout: 回合开始时消灭自身 + 搜索打出随从
    registerTrigger('killer_plant_sprout', 'onTurnStart', killerPlantSproutTrigger);
    // choking_vines: 回合开始时消灭此基地上力量最低的随从
    registerTrigger('killer_plant_choking_vines', 'onTurnStart', killerPlantChokingVinesTrigger);
}
