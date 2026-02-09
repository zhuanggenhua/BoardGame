/**
 * 大杀四方 - 黑熊骑兵派系能力
 *
 * 主题：消灭对手最弱随从、移动对手随从
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { destroyMinion, grantExtraMinion, moveMinion, getMinionPower } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionOnBase, OngoingDetachedEvent } from '../domain/types';

/** 注册黑熊骑兵派系所有能力 */
export function registerBearCavalryAbilities(): void {
    // 黑熊擒抱（行动卡）：每位对手消灭自己最弱随从
    registerAbility('bear_cavalry_bear_hug', 'onPlay', bearCavalryBearHug);
    // 委任（行动卡）：额外打出一个随从
    registerAbility('bear_cavalry_commission', 'onPlay', bearCavalryCommission);
    // 黑熊骑兵（随从 onPlay）：移动对手在本基地的一个随从到另一个基地
    registerAbility('bear_cavalry_bear_cavalry', 'onPlay', bearCavalryBearCavalryAbility);
    // 你们已经完蛋（行动卡）：选择有己方随从的基地，移动对手随从
    registerAbility('bear_cavalry_youre_screwed', 'onPlay', bearCavalryYoureScrewed);
    // 与熊同行（行动卡）：移动己方一个随从到其他基地
    registerAbility('bear_cavalry_bear_rides_you', 'onPlay', bearCavalryBearRidesYou);
    // 你们都是美食（行动卡）：移动一个基地上所有对手随从到其他基地
    registerAbility('bear_cavalry_youre_pretty_much_borscht', 'onPlay', bearCavalryYourePrettyMuchBorscht);
    // 黑熊口粮（行动卡）：消灭一个随从或一个已打出的行动卡
    registerAbility('bear_cavalry_bear_necessities', 'onPlay', bearCavalryBearNecessities);
}

/** 黑熊擒抱 onPlay：每位其他玩家消灭自己战斗力最低的随从 */
function bearCavalryBearHug(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);

    for (const opId of opponents) {
        // 收集该对手在所有基地上的随从
        let weakest: { minion: MinionOnBase; baseIndex: number } | null = null;
        for (let i = 0; i < ctx.state.bases.length; i++) {
            for (const m of ctx.state.bases[i].minions) {
                if (m.controller !== opId) continue;
                const power = getMinionPower(ctx.state, m, i);
                if (!weakest || power < getMinionPower(ctx.state, weakest.minion, weakest.baseIndex)) {
                    weakest = { minion: m, baseIndex: i };
                }
            }
        }
        if (weakest) {
            events.push(destroyMinion(
                weakest.minion.uid, weakest.minion.defId,
                weakest.baseIndex, weakest.minion.owner,
                'bear_cavalry_bear_hug', ctx.now
            ));
        }
    }

    return { events };
}

/** 委任 onPlay：额外打出一个随从 */
function bearCavalryCommission(ctx: AbilityContext): AbilityResult {
    return { events: [grantExtraMinion(ctx.playerId, 'bear_cavalry_commission', ctx.now)] };
}

// TODO: bear_cavalry_general_ivan (ongoing) - 己方随从不能被消灭（需要 ongoing 效果系统）
// TODO: bear_cavalry_polar_commando (ongoing) - 唯一随从时+2且不可消灭（需要 ongoing）
// TODO: bear_cavalry_cub_scout (ongoing) - 对手随从移入时消灭弱者（需要 onMinionMoved 触发）
// TODO: bear_cavalry_superiority (ongoing) - 保护己方随从（需要 ongoing 效果系统）
// TODO: bear_cavalry_high_ground (ongoing) - 消灭移入的对手随从（需要 onMinionMoved 触发）

/** 黑熊骑兵 onPlay：移动对手在本基地的一个随从到另一个基地（MVP：自动选力量最高的对手随从移到随从最少的基地） */
function bearCavalryBearCavalryAbility(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    // 找本基地力量最高的对手随从
    const opponentMinions = base.minions
        .filter(m => m.controller !== ctx.playerId && m.uid !== ctx.cardUid)
        .sort((a, b) => getMinionPower(ctx.state, b, ctx.baseIndex) - getMinionPower(ctx.state, a, ctx.baseIndex));
    const target = opponentMinions[0];
    if (!target) return { events: [] };

    // 移到随从最少的其他基地
    let bestBase = -1;
    let bestCount = Infinity;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === ctx.baseIndex) continue;
        if (ctx.state.bases[i].minions.length < bestCount) {
            bestCount = ctx.state.bases[i].minions.length;
            bestBase = i;
        }
    }
    if (bestBase < 0) return { events: [] };

    return { events: [moveMinion(target.uid, target.defId, ctx.baseIndex, bestBase, 'bear_cavalry_bear_cavalry', ctx.now)] };
}

/** 你们已经完蛋 onPlay：选择有己方随从的基地，移动对手随从到其他基地（MVP：自动选己方随从最多的基地，移最强对手随从） */
function bearCavalryYoureScrewed(ctx: AbilityContext): AbilityResult {
    // 找己方随从最多的基地
    let bestBaseIdx = -1;
    let bestMyCount = 0;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const myCount = ctx.state.bases[i].minions.filter(m => m.controller === ctx.playerId).length;
        if (myCount > bestMyCount) {
            bestMyCount = myCount;
            bestBaseIdx = i;
        }
    }
    if (bestBaseIdx < 0 || bestMyCount === 0) return { events: [] };

    // 找该基地最强的对手随从
    const opponentMinions = ctx.state.bases[bestBaseIdx].minions
        .filter(m => m.controller !== ctx.playerId)
        .sort((a, b) => getMinionPower(ctx.state, b, bestBaseIdx) - getMinionPower(ctx.state, a, bestBaseIdx));
    const target = opponentMinions[0];
    if (!target) return { events: [] };

    // 移到随从最少的其他基地
    let destBase = -1;
    let destCount = Infinity;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === bestBaseIdx) continue;
        if (ctx.state.bases[i].minions.length < destCount) {
            destCount = ctx.state.bases[i].minions.length;
            destBase = i;
        }
    }
    if (destBase < 0) return { events: [] };

    return { events: [moveMinion(target.uid, target.defId, bestBaseIdx, destBase, 'bear_cavalry_youre_screwed', ctx.now)] };
}

/** 与熊同行 onPlay：移动己方一个随从到其他基地（MVP：自动选力量最高的移到随从最少的基地） */
function bearCavalryBearRidesYou(ctx: AbilityContext): AbilityResult {
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

    return { events: [moveMinion(strongest.uid, strongest.defId, strongest.baseIndex, bestBase, 'bear_cavalry_bear_rides_you', ctx.now)] };
}

/** 你们都是美食 onPlay：选择有己方随从的基地，移动所有对手随从到其他基地（MVP：自动选己方随从最多的基地） */
function bearCavalryYourePrettyMuchBorscht(ctx: AbilityContext): AbilityResult {
    // 找己方随从最多的基地
    let bestBaseIdx = -1;
    let bestMyCount = 0;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const myCount = ctx.state.bases[i].minions.filter(m => m.controller === ctx.playerId).length;
        if (myCount > bestMyCount) {
            bestMyCount = myCount;
            bestBaseIdx = i;
        }
    }
    if (bestBaseIdx < 0 || bestMyCount === 0) return { events: [] };

    const events: SmashUpEvent[] = [];
    const opponentMinions = ctx.state.bases[bestBaseIdx].minions.filter(m => m.controller !== ctx.playerId);
    if (opponentMinions.length === 0) return { events: [] };

    // 找随从最少的其他基地
    let destBase = -1;
    let destCount = Infinity;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === bestBaseIdx) continue;
        if (ctx.state.bases[i].minions.length < destCount) {
            destCount = ctx.state.bases[i].minions.length;
            destBase = i;
        }
    }
    if (destBase < 0) return { events: [] };

    for (const m of opponentMinions) {
        events.push(moveMinion(m.uid, m.defId, bestBaseIdx, destBase, 'bear_cavalry_youre_pretty_much_borscht', ctx.now));
    }
    return { events };
}

/** 黑熊口粮 onPlay：消灭一个随从或一个已打出的行动卡（MVP：优先消灭对手最强随从） */
function bearCavalryBearNecessities(ctx: AbilityContext): AbilityResult {
    // 优先消灭对手最强随从
    let strongest: { uid: string; defId: string; baseIndex: number; owner: string; power: number } | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) continue;
            const power = getMinionPower(ctx.state, m, i);
            if (!strongest || power > strongest.power) {
                strongest = { uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, power };
            }
        }
    }
    if (strongest) {
        return { events: [destroyMinion(strongest.uid, strongest.defId, strongest.baseIndex, strongest.owner, 'bear_cavalry_bear_necessities', ctx.now)] };
    }

    // 没有对手随从时，尝试消灭对手的持续行动卡
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const ongoing of base.ongoingActions) {
            if (ongoing.ownerId !== ctx.playerId) {
                const evt: OngoingDetachedEvent = {
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: {
                        cardUid: ongoing.uid,
                        defId: ongoing.defId,
                        ownerId: ongoing.ownerId,
                        reason: 'bear_cavalry_bear_necessities',
                    },
                    timestamp: ctx.now,
                };
                return { events: [evt] };
            }
        }
        for (const m of base.minions) {
            for (const attached of m.attachedActions) {
                if (attached.ownerId !== ctx.playerId) {
                    const evt: OngoingDetachedEvent = {
                        type: SU_EVENTS.ONGOING_DETACHED,
                        payload: {
                            cardUid: attached.uid,
                            defId: attached.defId,
                            ownerId: attached.ownerId,
                            reason: 'bear_cavalry_bear_necessities',
                        },
                        timestamp: ctx.now,
                    };
                    return { events: [evt] };
                }
            }
        }
    }

    return { events: [] };
}
