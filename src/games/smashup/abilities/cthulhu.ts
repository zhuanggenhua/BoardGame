/**
 * 大杀四方 - 克苏鲁之仆派系能力
 *
 * 主题：疯狂卡操控、弃牌堆回收、额外行动
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { SU_EVENTS } from '../domain/types';
import { MADNESS_CARD_DEF_ID } from '../domain/types';
import type {
    SmashUpEvent,
    DeckReshuffledEvent,
    CardsDrawnEvent,
    VpAwardedEvent,
    MinionCardDef,
} from '../domain/types';
import { getCardDef } from '../data/cards';
import {
    drawMadnessCards, grantExtraAction, destroyMinion,
    returnMadnessCard, getMinionPower,
} from '../domain/abilityHelpers';

/** 注册克苏鲁之仆派系所有能力 */
export function registerCthulhuAbilities(): void {
    // 强制招募（行动卡）：弃牌堆力量≤3随从放牌库顶
    registerAbility('cthulhu_recruit_by_force', 'onPlay', cthulhuRecruitByForce);
    // 再次降临（行动卡）：弃牌堆行动卡洗回牌库
    registerAbility('cthulhu_it_begins_again', 'onPlay', cthulhuItBeginsAgain);
    // 克苏鲁的馈赠（行动卡）：从牌库顶找2张行动卡放入手牌
    registerAbility('cthulhu_fhtagn', 'onPlay', cthulhuFhtagn);
    // 暗中低语（行动卡）：抽1张疯狂卡 + 2个额外行动
    registerAbility('cthulhu_whispers_in_darkness', 'onPlay', cthulhuWhispersInDarkness);
    // 封印已破（行动卡）：抽1张疯狂卡 + 1VP
    registerAbility('cthulhu_seal_is_broken', 'onPlay', cthulhuSealIsBroken);
    // 腐化（行动卡）：抽1张疯狂卡 + 消灭一个随从（MVP：自动选最弱对手随从）
    registerAbility('cthulhu_corruption', 'onPlay', cthulhuCorruption);
    // 疯狂释放（行动卡）：弃任意数量疯狂卡，每张 = 抽1牌 + 额外行动
    registerAbility('cthulhu_madness_unleashed', 'onPlay', cthulhuMadnessUnleashed);
    // 星之眷族（随从 talent）：将手中疯狂卡转给对手
    registerAbility('cthulhu_star_spawn', 'talent', cthulhuStarSpawn);
    // 仆人（随从 talent）：消灭自身 + 弃牌堆行动卡放牌库顶
    registerAbility('cthulhu_servitor', 'talent', cthulhuServitor);
}

/** 强制招募 onPlay：将弃牌堆中力量≤3的随从放到牌库顶（MVP：全部放入） */
function cthulhuRecruitByForce(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const events: SmashUpEvent[] = [];

    // 从弃牌堆找力量≤3的随从
    const eligibleMinions = player.discard.filter(c => {
        if (c.type !== 'minion') return false;
        const def = getCardDef(c.defId);
        return def && def.type === 'minion' && (def as MinionCardDef).power <= 3;
    });

    if (eligibleMinions.length === 0) return { events: [] };

    // 随从放牌库顶：先随从，再原牌库
    // DECK_RESHUFFLED reducer 会合并 deck+discard，按 deckUids 排序
    // 所以我们需要把弃牌堆中非目标卡也包含在 deckUids 中（它们会留在弃牌堆被合并）
    const newDeck = [...eligibleMinions, ...player.deck];
    const evt: DeckReshuffledEvent = {
        type: SU_EVENTS.DECK_RESHUFFLED,
        payload: {
            playerId: ctx.playerId,
            deckUids: newDeck.map(c => c.uid),
        },
        timestamp: ctx.now,
    };
    events.push(evt);

    return { events };
}

/** 再次降临 onPlay：将弃牌堆中任意数量的行动卡洗回牌库（MVP：全部洗回） */
function cthulhuItBeginsAgain(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const actionsInDiscard = player.discard.filter(c => c.type === 'action');
    if (actionsInDiscard.length === 0) return { events: [] };

    // 合并牌库 + 弃牌堆行动卡，洗牌
    const newDeckCards = [...player.deck, ...actionsInDiscard];
    const shuffled = ctx.random.shuffle([...newDeckCards]);
    const evt: DeckReshuffledEvent = {
        type: SU_EVENTS.DECK_RESHUFFLED,
        payload: {
            playerId: ctx.playerId,
            deckUids: shuffled.map(c => c.uid),
        },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 克苏鲁的馈赠 onPlay：从牌库顶展示直到找到2张行动卡，放入手牌，其余放牌库底 */
function cthulhuFhtagn(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (player.deck.length === 0) return { events: [] };

    const events: SmashUpEvent[] = [];
    const foundActions: string[] = [];
    const otherCards: string[] = [];

    // 从牌库顶逐张检查
    for (const card of player.deck) {
        if (card.type === 'action' && foundActions.length < 2) {
            foundActions.push(card.uid);
        } else if (foundActions.length < 2) {
            otherCards.push(card.uid);
        } else {
            // 已找到2张行动卡，剩余保持原序
            break;
        }
    }

    if (foundActions.length === 0) return { events: [] };

    // 行动卡放入手牌（用 CARDS_DRAWN 事件）
    const drawEvt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: {
            playerId: ctx.playerId,
            count: foundActions.length,
            cardUids: foundActions,
        },
        timestamp: ctx.now,
    };
    events.push(drawEvt);

    // 其余卡放牌库底：重建牌库 = 未翻到的牌 + 其余翻到的非行动卡
    const processedUids = new Set([...foundActions, ...otherCards]);
    const remainingDeck = player.deck.filter(c => !processedUids.has(c.uid));
    // 新牌库 = 剩余未翻到的 + 翻到的非行动卡放底部
    const newDeckUids = [...remainingDeck.map(c => c.uid), ...otherCards];

    if (otherCards.length > 0) {
        const reshuffleEvt: DeckReshuffledEvent = {
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: {
                playerId: ctx.playerId,
                deckUids: newDeckUids,
            },
            timestamp: ctx.now,
        };
        events.push(reshuffleEvt);
    }

    return { events };
}

/** 暗中低语 onPlay：抽1张疯狂卡 + 获得2个额外行动 */
function cthulhuWhispersInDarkness(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'cthulhu_whispers_in_darkness', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    events.push(grantExtraAction(ctx.playerId, 'cthulhu_whispers_in_darkness', ctx.now));
    events.push(grantExtraAction(ctx.playerId, 'cthulhu_whispers_in_darkness', ctx.now));
    return { events };
}

/** 封印已破 onPlay：抽1张疯狂卡 + 获得1VP */
function cthulhuSealIsBroken(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'cthulhu_seal_is_broken', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    const vpEvt: VpAwardedEvent = {
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.playerId, amount: 1, reason: 'cthulhu_seal_is_broken' },
        timestamp: ctx.now,
    };
    events.push(vpEvt);
    return { events };
}

/** 腐化 onPlay：抽1张疯狂卡 + 消灭一个随从（MVP：自动选最弱对手随从） */
function cthulhuCorruption(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'cthulhu_corruption', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    // 找最弱的对手随从
    let weakest: { uid: string; defId: string; baseIndex: number; ownerId: string; power: number } | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) continue;
            const effectivePower = getMinionPower(ctx.state, m, i);
            if (!weakest || effectivePower < weakest.power) {
                weakest = { uid: m.uid, defId: m.defId, baseIndex: i, ownerId: m.owner, power: effectivePower };
            }
        }
    }
    if (weakest) {
        events.push(destroyMinion(weakest.uid, weakest.defId, weakest.baseIndex, weakest.ownerId, 'cthulhu_corruption', ctx.now));
    }
    return { events };
}

/**
 * 疯狂释放 onPlay：弃掉手中任意数量的疯狂卡，每张 = 抽1张牌 + 1个额外行动
 * 
 * - 无疯狂卡时无效果
 * - 只有1张疯狂卡时自动弃掉（不创建 Prompt）
 * - 多张疯狂卡时创建 Prompt 让玩家选择弃几张（MVP：自动弃全部）
 */
function cthulhuMadnessUnleashed(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 排除当前打出的卡，找手中的疯狂卡
    const madnessInHand = player.hand.filter(
        c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid
    );
    if (madnessInHand.length === 0) return { events: [] };

    // MVP：自动弃掉所有疯狂卡（不创建 Prompt）
    return { events: discardMadnessAndDraw(ctx, madnessInHand.map(c => c.uid)) };
}

/** 弃疯狂卡并抽牌+额外行动（辅助函数） */
function discardMadnessAndDraw(
    ctx: AbilityContext,
    madnessUids: string[]
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];

    // 返回疯狂卡到疯狂牌库
    for (const uid of madnessUids) {
        events.push(returnMadnessCard(ctx.playerId, uid, 'cthulhu_madness_unleashed', ctx.now));
    }

    // 每张疯狂卡 = 抽1张牌 + 1个额外行动
    const drawCount = Math.min(madnessUids.length, player.deck.length);
    if (drawCount > 0) {
        const drawnUids = player.deck.slice(0, drawCount).map(c => c.uid);
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: drawCount, cardUids: drawnUids },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }
    for (let i = 0; i < madnessUids.length; i++) {
        events.push(grantExtraAction(ctx.playerId, 'cthulhu_madness_unleashed', ctx.now));
    }
    return events;
}

// TODO: cthulhu_chosen (special) - 计分前抽疯狂卡+2力量（需要 Madness + beforeScoring）
// TODO: cthulhu_altar (ongoing) - 打出随从时额外行动（需要 ongoing 触发系统）
// TODO: cthulhu_complete_the_ritual (ongoing) - 回合开始清场换基地（需要 onTurnStart）
// TODO: cthulhu_furthering_the_cause (ongoing) - 回合结束时条件获VP（需要 onTurnEnd 触发）

/**
 * 星之眷族 talent：将手中一张疯狂卡转给另一个玩家
 * 
 * MVP：自动选第一个对手，转移手中第一张疯狂卡
 * 手中无疯狂卡时无效果
 */
function cthulhuStarSpawn(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const madnessInHand = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
    if (madnessInHand.length === 0) return { events: [] };

    // 选第一个对手
    const opponent = ctx.state.turnOrder.find(pid => pid !== ctx.playerId);
    if (!opponent) return { events: [] };

    const events: SmashUpEvent[] = [];
    const madnessCard = madnessInHand[0];

    // 从自己手牌返回疯狂卡到疯狂牌库
    events.push(returnMadnessCard(ctx.playerId, madnessCard.uid, 'cthulhu_star_spawn', ctx.now));

    // 对手抽1张疯狂卡（从疯狂牌库）
    const drawEvt = drawMadnessCards(opponent, 1, ctx.state, 'cthulhu_star_spawn', ctx.now);
    if (drawEvt) events.push(drawEvt);

    return { events };
}

/**
 * 仆人 talent：消灭自身，从弃牌堆选一张行动卡放到牌库顶
 * 
 * MVP：自动选弃牌堆中第一张行动卡
 * 弃牌堆无行动卡时仍消灭自身（天赋效果是"消灭本卡并..."，消灭是前置条件）
 */
function cthulhuServitor(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];

    // 消灭自身
    events.push(destroyMinion(
        ctx.cardUid, ctx.defId, ctx.baseIndex, ctx.playerId,
        'cthulhu_servitor', ctx.now
    ));

    // 从弃牌堆找第一张行动卡放牌库顶
    const actionInDiscard = player.discard.find(c => c.type === 'action');
    if (actionInDiscard) {
        // 用 DECK_RESHUFFLED 重排牌库：目标卡放顶部 + 原牌库
        const newDeckUids = [actionInDiscard.uid, ...player.deck.map(c => c.uid)];
        const reshuffleEvt: DeckReshuffledEvent = {
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: { playerId: ctx.playerId, deckUids: newDeckUids },
            timestamp: ctx.now,
        };
        events.push(reshuffleEvt);
    }

    return { events };
}
