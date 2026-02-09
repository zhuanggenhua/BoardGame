/**
 * 大杀四方 - 忍者派系能力
 *
 * 主题：消灭随从、潜入基地
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { destroyMinion, moveMinion, getMinionPower, grantExtraMinion } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionReturnedEvent, MinionPlayedEvent } from '../domain/types';
import { getCardDef } from '../data/cards';
import type { MinionCardDef } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';

/** 注册忍者派系所有能力 */
export function registerNinjaAbilities(): void {
    // 忍者大师：消灭本基地一个随从
    registerAbility('ninja_master', 'onPlay', ninjaMaster);
    // 猛虎刺客：消灭本基地一个力量≤3的随从
    registerAbility('ninja_tiger_assassin', 'onPlay', ninjaTigerAssassin);
    // 手里剑（行动卡）：消灭一个力量≤3的随从（任意基地）
    registerAbility('ninja_seeing_stars', 'onPlay', ninjaSeeingStars);
    // 欺骗之道（行动卡）：移动己方一个随从到另一个基地
    registerAbility('ninja_way_of_deception', 'onPlay', ninjaWayOfDeception);
    // 伪装（行动卡）：将己方一个随从返回手牌，然后打出一个随从到该基地
    registerAbility('ninja_disguise', 'onPlay', ninjaDisguise);
    // 忍（special）：基地计分前打出到该基地
    registerAbility('ninja_shinobi', 'special', ninjaShinobi);
    // 侍僧（special）：回手并额外打出随从
    registerAbility('ninja_acolyte', 'special', ninjaAcolyte);
    // 隐忍（special action）：基地计分前打出手牌中的随从到该基地
    registerAbility('ninja_hidden_ninja', 'special', ninjaHiddenNinja);

    // 注册 ongoing 拦截器
    registerNinjaOngoingEffects();
}

/** 忍者大师 onPlay：消灭本基地一个随从（MVP：自动选力量最低的对手随从） */
function ninjaMaster(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    const targets = base.minions
        .filter(m => m.uid !== ctx.cardUid)
        .sort((a, b) => getMinionPower(ctx.state, a, ctx.baseIndex) - getMinionPower(ctx.state, b, ctx.baseIndex));
    const target = targets[0];
    if (!target) return { events: [] };

    return {
        events: [
            destroyMinion(target.uid, target.defId, ctx.baseIndex, target.owner, 'ninja_master', ctx.now),
        ],
    };
}

/** 猛虎刺客 onPlay：消灭本基地一个力量≤3的随从（MVP：自动选第一个） */
function ninjaTigerAssassin(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    const target = base.minions.find(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) <= 3
    );
    if (!target) return { events: [] };

    return {
        events: [
            destroyMinion(target.uid, target.defId, ctx.baseIndex, target.owner, 'ninja_tiger_assassin', ctx.now),
        ],
    };
}

/** 手里剑 onPlay：消灭一个力量≤3的随从（任意基地，MVP：自动选第一个对手随从） */
function ninjaSeeingStars(ctx: AbilityContext): AbilityResult {
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const target = base.minions.find(
            m => m.controller !== ctx.playerId && getMinionPower(ctx.state, m, i) <= 3
        );
        if (target) {
            return {
                events: [
                    destroyMinion(target.uid, target.defId, i, target.owner, 'ninja_seeing_stars', ctx.now),
                ],
            };
        }
    }
    return { events: [] };
}

// ninja_poison (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（-4力量）

/** 欺骗之道 onPlay：移动己方一个随从到另一个基地（MVP：自动选力量最高的移到随从最少的基地） */
function ninjaWayOfDeception(ctx: AbilityContext): AbilityResult {
    let strongest: { uid: string; defId: string; baseIndex: number; power: number } | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            const power = getMinionPower(ctx.state, m, i);
            if (!strongest || power > strongest.power) {
                strongest = { uid: m.uid, defId: m.defId, baseIndex: i, power };
            }
        }
    }
    if (!strongest) return { events: [] };

    // 移到随从最少的其他基地
    let bestBase = -1;
    let bestCount = Infinity;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === strongest.baseIndex) continue;
        if (ctx.state.bases[i].minions.length < bestCount) {
            bestCount = ctx.state.bases[i].minions.length;
            bestBase = i;
        }
    }
    if (bestBase < 0) return { events: [] };

    return { events: [moveMinion(strongest.uid, strongest.defId, strongest.baseIndex, bestBase, 'ninja_way_of_deception', ctx.now)] };
}

/**
 * 伪装 onPlay：将己方一个随从返回手牌，然后打出一个随从到该基地
 * MVP：自动选力量最低的己方随从返回，然后从手牌打出力量最高的随从
 */
function ninjaDisguise(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // 找己方力量最低的随从
    let weakest: { uid: string; defId: string; baseIndex: number; power: number; owner: string } | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            const power = getMinionPower(ctx.state, m, i);
            if (!weakest || power < weakest.power) {
                weakest = { uid: m.uid, defId: m.defId, baseIndex: i, power, owner: m.owner };
            }
        }
    }
    if (!weakest) return { events: [] };

    // 返回手牌
    const returnEvt: MinionReturnedEvent = {
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
            minionUid: weakest.uid,
            minionDefId: weakest.defId,
            fromBaseIndex: weakest.baseIndex,
            toPlayerId: weakest.owner,
            reason: 'ninja_disguise',
        },
        timestamp: ctx.now,
    };
    events.push(returnEvt);

    // 从手牌找力量最高的随从打出到同一基地（排除当前打出的行动卡）
    const player = ctx.state.players[ctx.playerId];
    const minionCards = player.hand.filter(c => c.type === 'minion' && c.uid !== ctx.cardUid);
    if (minionCards.length === 0) return { events };

    // 按力量排序
    let bestCard: { uid: string; defId: string; power: number } | undefined;
    for (const c of minionCards) {
        const def = getCardDef(c.defId);
        if (!def || def.type !== 'minion') continue;
        const power = (def as MinionCardDef).power;
        if (!bestCard || power > bestCard.power) {
            bestCard = { uid: c.uid, defId: c.defId, power };
        }
    }
    if (!bestCard) return { events };

    const playEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId: ctx.playerId,
            cardUid: bestCard.uid,
            defId: bestCard.defId,
            baseIndex: weakest.baseIndex,
            power: bestCard.power,
        },
        timestamp: ctx.now,
    };
    events.push(playEvt);

    return { events };
}


// ============================================================================
// Special 时机能力
// ============================================================================

/**
 * 忍 special：基地计分前，可以从手牌打出到该基地
 * MVP：自动打出（如果在手牌中）
 */
function ninjaShinobi(ctx: AbilityContext): AbilityResult {
    // 检查该随从是否在手牌中
    const player = ctx.state.players[ctx.playerId];
    const inHand = player.hand.find(c => c.defId === 'ninja_shinobi');
    if (!inHand) return { events: [] };

    const def = getCardDef('ninja_shinobi');
    if (!def || def.type !== 'minion') return { events: [] };

    const playEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId: ctx.playerId,
            cardUid: inHand.uid,
            defId: 'ninja_shinobi',
            baseIndex: ctx.baseIndex,
            power: (def as MinionCardDef).power,
        },
        timestamp: ctx.now,
    };
    return { events: [playEvt] };
}

/**
 * 侍僧 special：将此随从从基地返回手牌，然后额外打出一个随从
 * MVP：自动执行
 */
function ninjaAcolyte(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // 返回手牌
    const returnEvt: MinionReturnedEvent = {
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
            minionUid: ctx.cardUid,
            minionDefId: ctx.defId,
            fromBaseIndex: ctx.baseIndex,
            toPlayerId: ctx.playerId,
            reason: 'ninja_acolyte',
        },
        timestamp: ctx.now,
    };
    events.push(returnEvt);

    // 额外打出一个随从
    events.push(grantExtraMinion(ctx.playerId, 'ninja_acolyte', ctx.now));

    return { events };
}

/**
 * 隐忍 special action：基地计分前，从手牌打出一个随从到该基地
 * MVP：自动选手牌中力量最高的随从
 */
function ninjaHiddenNinja(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minionCards = player.hand.filter(c => c.type === 'minion');
    if (minionCards.length === 0) return { events: [] };

    // 选力量最高的随从
    let bestCard: { uid: string; defId: string; power: number } | undefined;
    for (const c of minionCards) {
        const def = getCardDef(c.defId);
        if (!def || def.type !== 'minion') continue;
        const power = (def as MinionCardDef).power;
        if (!bestCard || power > bestCard.power) {
            bestCard = { uid: c.uid, defId: c.defId, power };
        }
    }
    if (!bestCard) return { events: [] };

    const playEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId: ctx.playerId,
            cardUid: bestCard.uid,
            defId: bestCard.defId,
            baseIndex: ctx.baseIndex,
            power: bestCard.power,
        },
        timestamp: ctx.now,
    };
    return { events: [playEvt] };
}

// ============================================================================
// Ongoing 拦截器注册
// ============================================================================

/** 注册忍者派系的 ongoing 拦截器 */
function registerNinjaOngoingEffects(): void {
    // 烟雾弹：保护同基地己方随从不受对手行动卡影响
    registerProtection('ninja_smoke_bomb', 'action', (ctx) => {
        // 只保护烟雾弹所在基地的、烟雾弹拥有者的随从
        for (const base of ctx.state.bases) {
            const bomb = base.ongoingActions.find(o => o.defId === 'ninja_smoke_bomb');
            if (!bomb) continue;
            const baseIdx = ctx.state.bases.indexOf(base);
            if (baseIdx !== ctx.targetBaseIndex) continue;
            // 只保护烟雾弹拥有者的随从，且来源是对手
            return ctx.targetMinion.controller === bomb.ownerId && ctx.sourcePlayerId !== bomb.ownerId;
        }
        return false;
    });

    // 暗杀：回合结束时消灭目标随从（附着在随从上的 ongoing）
    registerTrigger('ninja_assassination', 'onTurnEnd', (trigCtx) => {
        const events: SmashUpEvent[] = [];
        // 查找所有附着了 assassination 的随从
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            for (const m of base.minions) {
                const hasAssassination = m.attachedActions.some(a => a.defId === 'ninja_assassination');
                if (hasAssassination) {
                    events.push({
                        type: SU_EVENTS.MINION_DESTROYED,
                        payload: {
                            minionUid: m.uid,
                            minionDefId: m.defId,
                            fromBaseIndex: i,
                            ownerId: m.owner,
                            reason: 'ninja_assassination',
                        },
                        timestamp: trigCtx.now,
                    });
                }
            }
        }
        return events;
    });

    // 渗透：附着此卡的随从不受基地能力影响（广义保护）
    registerProtection('ninja_infiltrate', 'affect', (ctx) => {
        // 检查目标随从是否附着了 infiltrate
        return ctx.targetMinion.attachedActions.some(a => a.defId === 'ninja_infiltrate');
    });
}
