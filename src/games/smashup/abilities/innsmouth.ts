/**
 * 大杀四方 - 印斯茅斯派系能力
 *
 * 主题：同名随从联动、数量优势
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { addPowerCounter, grantExtraMinion, drawMadnessCards, getMinionPower } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, DeckReshuffledEvent, CardsDrawnEvent, MinionReturnedEvent } from '../domain/types';
import { registerProtection } from '../domain/ongoingEffects';
import type { ProtectionCheckContext } from '../domain/ongoingEffects';

/** 注册印斯茅斯派系所有能力 */
export function registerInnsmouthAbilities(): void {
    // 深潜者（行动卡）：力量≤2的己方随从各+1力量
    registerAbility('innsmouth_the_deep_ones', 'onPlay', innsmouthTheDeepOnes);
    // 新人（行动卡）：所有玩家将弃牌堆随从洗回牌库
    registerAbility('innsmouth_new_acolytes', 'onPlay', innsmouthNewAcolytes);
    // 招募（行动卡）：抽最多3张疯狂卡，每张 = 额外打出1个随从
    registerAbility('innsmouth_recruitment', 'onPlay', innsmouthRecruitment);
    // 本地人（随从 onPlay）：展示牌库顶3张，同名卡放手牌，其余放牌库底
    registerAbility('innsmouth_the_locals', 'onPlay', innsmouthTheLocals);
    // 回归大海（special）：计分后同名随从回手牌
    registerAbility('innsmouth_return_to_the_sea', 'special', innsmouthReturnToTheSea);

    // === ongoing 效果注册 ===
    // in_plain_sight: 力量≤2随从不受其他玩家影响
    registerProtection('innsmouth_in_plain_sight', 'affect', innsmouthInPlainSightChecker);
}

/** 深潜者 onPlay：每个你的力量≤2的随从获得+1力量 */
function innsmouthTheDeepOnes(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (m.controller === ctx.playerId && m.basePower <= 2) {
                events.push(addPowerCounter(m.uid, i, 1, 'innsmouth_the_deep_ones', ctx.now));
            }
        }
    }
    return { events };
}

/** 新人 onPlay：所有玩家将弃牌堆中的所有随从洗回牌库 */
function innsmouthNewAcolytes(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        const player = ctx.state.players[pid];
        const minionsInDiscard = player.discard.filter(c => c.type === 'minion');
        if (minionsInDiscard.length === 0) continue;
        // 合并牌库 + 弃牌堆随从，洗牌
        const newDeckCards = [...player.deck, ...minionsInDiscard];
        const shuffled = ctx.random.shuffle([...newDeckCards]);
        const evt: DeckReshuffledEvent = {
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: {
                playerId: pid,
                deckUids: shuffled.map(c => c.uid),
            },
            timestamp: ctx.now,
        };
        events.push(evt);
    }
    return { events };
}

/** 招募 onPlay：抽最多3张疯狂卡，每张成功抽取 = 额外打出1个随从（MVP：尽量抽满3张） */
function innsmouthRecruitment(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 尝试抽3张疯狂卡
    const madnessEvt = drawMadnessCards(ctx.playerId, 3, ctx.state, 'innsmouth_recruitment', ctx.now);
    if (madnessEvt) {
        events.push(madnessEvt);
        // 每张成功抽取的疯狂卡 = 1个额外随从
        const actualDrawn = madnessEvt.payload.cardUids.length;
        for (let i = 0; i < actualDrawn; i++) {
            events.push(grantExtraMinion(ctx.playerId, 'innsmouth_recruitment', ctx.now));
        }
    }
    return { events };
}

// innsmouth_in_plain_sight (ongoing) - 通过 ongoing 效果系统实现（注册在 registerInnsmouthAbilities 中）

// ============================================================================
// ongoing 效果检查器
// ============================================================================

/**
 * in_plain_sight 保护检查：力量≤2的己方随从不受其他玩家影响
 */
function innsmouthInPlainSightChecker(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    // 检查基地上是否有 in_plain_sight ongoing 行动卡
    const sight = base.ongoingActions.find(o => o.defId === 'innsmouth_in_plain_sight');
    if (!sight) return false;
    // 只保护 sight 拥有者的随从
    if (ctx.targetMinion.controller !== sight.ownerId) return false;
    // 只保护力量≤2的随从
    const power = getMinionPower(ctx.state, ctx.targetMinion, ctx.targetBaseIndex);
    return power <= 2 && ctx.sourcePlayerId !== sight.ownerId;
}

/**
 * 回归大海 special：计分后同名随从回手牌
 * MVP：将自己在被计分基地上的所有同 defId 随从回手牌
 */
function innsmouthReturnToTheSea(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    const events: SmashUpEvent[] = [];
    // 找同基地上自己的同 defId 随从
    const myMinions = base.minions.filter(
        m => m.controller === ctx.playerId && m.uid !== ctx.cardUid
    );
    // 找与触发随从同 defId 的随从
    const triggerMinion = base.minions.find(m => m.uid === ctx.cardUid);
    if (!triggerMinion) return { events: [] };

    const sameDefMinions = myMinions.filter(m => m.defId === triggerMinion.defId);
    for (const m of sameDefMinions) {
        events.push({
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: m.uid,
                minionDefId: m.defId,
                fromBaseIndex: ctx.baseIndex,
                toPlayerId: m.owner,
                reason: 'innsmouth_return_to_the_sea',
            },
            timestamp: ctx.now,
        } as MinionReturnedEvent);
    }
    return { events };
}

/**
 * 本地人 onPlay：展示牌库顶3张，将其中的"本地人"（同 defId）放入手牌，其余放牌库底
 */
function innsmouthTheLocals(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (player.deck.length === 0) return { events: [] };

    const events: SmashUpEvent[] = [];
    const topCards = player.deck.slice(0, 3);
    const locals = topCards.filter(c => c.defId === 'innsmouth_the_locals');
    const others = topCards.filter(c => c.defId !== 'innsmouth_the_locals');

    // 同名卡放入手牌
    if (locals.length > 0) {
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: locals.length, cardUids: locals.map(c => c.uid) },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }

    // 其余放牌库底
    if (others.length > 0) {
        const processedUids = new Set(topCards.map(c => c.uid));
        const remainingDeck = player.deck.filter(c => !processedUids.has(c.uid));
        const newDeckUids = [...remainingDeck.map(c => c.uid), ...others.map(c => c.uid)];
        const reshuffleEvt: DeckReshuffledEvent = {
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: { playerId: ctx.playerId, deckUids: newDeckUids },
            timestamp: ctx.now,
        };
        events.push(reshuffleEvt);
    }

    return { events };
}
