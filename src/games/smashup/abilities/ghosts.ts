/**
 * 大杀四方 - 幽灵派系能力
 *
 * 主题：手牌少时获得增益、弃牌操作
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { grantExtraMinion, grantExtraAction, destroyMinion, getMinionPower } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { CardsDrawnEvent, CardsDiscardedEvent, VpAwardedEvent, SmashUpEvent, MinionReturnedEvent } from '../domain/types';
import { drawCards } from '../domain/utils';
import { registerProtection } from '../domain/ongoingEffects';
import type { ProtectionCheckContext } from '../domain/ongoingEffects';

/** 注册幽灵派系所有能力 */
export function registerGhostAbilities(): void {
    // 幽灵 onPlay：弃一张手牌
    registerAbility('ghost_ghost', 'onPlay', ghostGhost);
    // 招魂（行动卡）：手牌≤2时抽到5张
    registerAbility('ghost_seance', 'onPlay', ghostSeance);
    // 阴暗交易（行动卡）：手牌≤2时获得1VP
    registerAbility('ghost_shady_deal', 'onPlay', ghostShadyDeal);
    // 悄然而至（行动卡）：额外打出一个随从和一个行动
    registerAbility('ghost_ghostly_arrival', 'onPlay', ghostGhostlyArrival);
    // 灵魂（随从 onPlay）：弃等量力量的牌消灭一个随从
    registerAbility('ghost_spirit', 'onPlay', ghostSpirit);

    // === ongoing 效果注册 ===
    // ghost_incorporeal: 不受其他玩家卡牌影响（ongoing protection）
    registerProtection('ghost_haunting', 'affect', ghostIncorporealChecker);
    // ghost_make_contact: 控制对手随从（special 能力）
    registerAbility('ghost_make_contact', 'onPlay', ghostMakeContact);
}

/** 幽灵 onPlay：弃一张手牌（MVP：自动弃第一张非自身的手牌） */
function ghostGhost(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 排除刚打出的自己
    const discardable = player.hand.filter(c => c.uid !== ctx.cardUid);
    if (discardable.length === 0) return { events: [] };
    const card = discardable[0];
    const evt: CardsDiscardedEvent = {
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId: ctx.playerId, cardUids: [card.uid] },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 招魂 onPlay：手牌≤2时抽到5张 */
function ghostSeance(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 打出行动卡后手牌会减1，所以用当前手牌数-1判断
    const handAfterPlay = player.hand.length - 1;
    if (handAfterPlay > 2) return { events: [] };
    const drawCount = Math.max(0, 5 - handAfterPlay);
    if (drawCount === 0) return { events: [] };
    const { drawnUids } = drawCards(player, drawCount, ctx.random);
    if (drawnUids.length === 0) return { events: [] };
    const evt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: drawnUids.length, cardUids: drawnUids },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 阴暗交易 onPlay：手牌≤2时获得1VP */
function ghostShadyDeal(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const handAfterPlay = player.hand.length - 1;
    if (handAfterPlay > 2) return { events: [] };
    const evt: VpAwardedEvent = {
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.playerId, amount: 1, reason: 'ghost_shady_deal' },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 悄然而至 onPlay：额外打出一个随从和一个行动 */
function ghostGhostlyArrival(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantExtraMinion(ctx.playerId, 'ghost_ghostly_arrival', ctx.now),
            grantExtraAction(ctx.playerId, 'ghost_ghostly_arrival', ctx.now),
        ],
    };
}

// ghost_haunting (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（+3 力量部分）
//   不受影响部分通过 ghost_incorporeal protection 实现（注册在 registerGhostAbilities 中）
// ghost_door_to_the_beyond (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（手牌≤2时同基地己方随从+2）

/**
 * ghost_incorporeal 保护检查：ghost_haunting 附着的随从不受其他玩家卡牌影响
 * 
 * 规则：附着了 ghost_haunting 的随从不受其他玩家卡牌影响。
 * 实现：检查目标随从是否附着了 ghost_haunting，且攻击者不是随从控制者。
 */
function ghostIncorporealChecker(ctx: ProtectionCheckContext): boolean {
    // 检查目标随从是否附着了 ghost_haunting
    const hasHaunting = ctx.targetMinion.attachedActions.some(a => a.defId === 'ghost_haunting');
    if (!hasHaunting) return false;
    // 只保护不受其他玩家影响
    return ctx.sourcePlayerId !== ctx.targetMinion.controller;
}

/**
 * ghost_make_contact onPlay：控制对手一个随从（将其控制权转移给自己）
 * 
 * MVP：自动选对手力量最高的随从，将其控制权转移
 * 实现方式：通过 MINION_RETURNED 将对手随从回手 + 重新打出到同基地（简化实现）
 * 更准确的实现：直接修改 controller（需要新事件类型）
 * 当前 MVP：移动对手最强随从到自己控制的基地
 */
function ghostMakeContact(ctx: AbilityContext): AbilityResult {
    // 找所有对手随从，按力量降序
    const targets: { uid: string; defId: string; baseIndex: number; owner: string; power: number }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) continue;
            targets.push({
                uid: m.uid, defId: m.defId, baseIndex: i,
                owner: m.owner, power: getMinionPower(ctx.state, m, i),
            });
        }
    }
    if (targets.length === 0) return { events: [] };
    targets.sort((a, b) => b.power - a.power);
    const target = targets[0];

    // MVP：将对手随从返回其手牌（简化版"控制"）
    const evt: MinionReturnedEvent = {
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: target.baseIndex,
            toPlayerId: target.owner,
            reason: 'ghost_make_contact',
        },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/**
 * 灵魂 onPlay：选择一个随从，弃等量力量的手牌来消灭它
 * MVP：自动选最强的对手随从（如果手牌足够弃掉），弃掉力量最低的手牌
 */
function ghostSpirit(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 可弃的手牌（排除刚打出的自己）
    const discardable = player.hand.filter(c => c.uid !== ctx.cardUid);
    if (discardable.length === 0) return { events: [] };

    // 找所有对手随从，按力量降序
    const targets: { uid: string; defId: string; baseIndex: number; owner: string; power: number }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) continue;
            targets.push({
                uid: m.uid, defId: m.defId, baseIndex: i,
                owner: m.owner, power: getMinionPower(ctx.state, m, i),
            });
        }
    }
    targets.sort((a, b) => b.power - a.power);

    // 找一个手牌数量足够弃掉的目标（力量 = 需弃牌数）
    for (const target of targets) {
        if (target.power <= discardable.length) {
            const events: SmashUpEvent[] = [];
            // 弃掉 target.power 张手牌
            const toDiscard = discardable.slice(0, target.power);
            if (toDiscard.length > 0) {
                const discardEvt: CardsDiscardedEvent = {
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId: ctx.playerId, cardUids: toDiscard.map(c => c.uid) },
                    timestamp: ctx.now,
                };
                events.push(discardEvt);
            }
            // 消灭目标
            events.push(destroyMinion(target.uid, target.defId, target.baseIndex, target.owner, 'ghost_spirit', ctx.now));
            return { events };
        }
    }

    return { events: [] };
}
