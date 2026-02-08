/**
 * 大杀四方 - 米斯卡塔尼克大学派系能力
 *
 * 主题：知识/研究、抽牌、行动卡操控
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type { SmashUpEvent, OngoingDetachedEvent, CardsDrawnEvent } from '../domain/types';
import {
    drawMadnessCards, grantExtraAction, grantExtraMinion,
    returnMadnessCard, destroyMinion,
} from '../domain/abilityHelpers';

/** 注册米斯卡塔尼克大学派系所有能力 */
export function registerMiskatonicAbilities(): void {
    // 这些多管闲事的小鬼（行动卡）：消灭一个基地上所有行动卡
    registerAbility('miskatonic_those_meddling_kids', 'onPlay', miskatonicThoseMeddlingKids);
    // 心理分析（行动卡）：抽2张牌 + 抽1张疯狂卡
    registerAbility('miskatonic_psychological_profiling', 'onPlay', miskatonicPsychologicalProfiling);
    // 强制阅读（行动卡）：目标对手抽2张疯狂卡 + 你获得1个额外行动
    registerAbility('miskatonic_mandatory_reading', 'onPlay', miskatonicMandatoryReading);
    // 失落的知识（行动卡）：手中有≥2张疯狂卡时，抽2张牌 + 额外随从 + 额外行动
    registerAbility('miskatonic_lost_knowledge', 'onPlay', miskatonicLostKnowledge);
    // 也许能行（行动卡）：弃2张疯狂卡消灭一个随从
    registerAbility('miskatonic_it_might_just_work', 'onPlay', miskatonicItMightJustWork);
    // 不可见之书（行动卡）：查看对手手牌 + 抽1张疯狂卡 + 2个额外行动
    registerAbility('miskatonic_book_of_iter_the_unseen', 'onPlay', miskatonicBookOfIterTheUnseen);
    // 门口之物（行动卡）：搜索牌库找1张卡 + 抽1张疯狂卡
    registerAbility('miskatonic_thing_on_the_doorstep', 'onPlay', miskatonicThingOnTheDoorstep);
}

/** 这些多管闲事的小鬼 onPlay：消灭一个基地上任意数量的行动卡（MVP：自动选行动卡最多的基地，全部消灭） */
function miskatonicThoseMeddlingKids(ctx: AbilityContext): AbilityResult {
    // 找行动卡最多的基地
    let bestBaseIndex = -1;
    let bestCount = 0;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        // 统计基地上的持续行动卡 + 随从附着的行动卡
        let actionCount = base.ongoingActions.length;
        for (const m of base.minions) {
            actionCount += m.attachedActions.length;
        }
        if (actionCount > bestCount) {
            bestCount = actionCount;
            bestBaseIndex = i;
        }
    }
    if (bestCount === 0) return { events: [] };

    const events: SmashUpEvent[] = [];
    const base = ctx.state.bases[bestBaseIndex];

    // 消灭基地上的持续行动卡
    for (const ongoing of base.ongoingActions) {
        const evt: OngoingDetachedEvent = {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: ongoing.uid,
                defId: ongoing.defId,
                ownerId: ongoing.ownerId,
                reason: 'miskatonic_those_meddling_kids',
            },
            timestamp: ctx.now,
        };
        events.push(evt);
    }

    // 消灭随从上附着的行动卡
    for (const m of base.minions) {
        for (const attached of m.attachedActions) {
            const evt: OngoingDetachedEvent = {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: attached.uid,
                    defId: attached.defId,
                    ownerId: attached.ownerId,
                    reason: 'miskatonic_those_meddling_kids',
                },
                timestamp: ctx.now,
            };
            events.push(evt);
        }
    }

    return { events };
}

/** 心理分析 onPlay：抽2张牌 + 抽1张疯狂卡 */
function miskatonicPsychologicalProfiling(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];
    // 抽2张牌
    const drawCount = Math.min(2, player.deck.length);
    if (drawCount > 0) {
        const drawnUids = player.deck.slice(0, drawCount).map(c => c.uid);
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: drawCount, cardUids: drawnUids },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }
    // 抽1张疯狂卡
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'miskatonic_psychological_profiling', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    return { events };
}

/** 强制阅读 onPlay：目标对手抽2张疯狂卡 + 你获得1个额外行动（MVP：自动选第一个对手） */
function miskatonicMandatoryReading(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 选第一个对手
    const opponent = ctx.state.turnOrder.find(pid => pid !== ctx.playerId);
    if (opponent) {
        const madnessEvt = drawMadnessCards(opponent, 2, ctx.state, 'miskatonic_mandatory_reading', ctx.now);
        if (madnessEvt) events.push(madnessEvt);
    }
    events.push(grantExtraAction(ctx.playerId, 'miskatonic_mandatory_reading', ctx.now));
    return { events };
}

/** 失落的知识 onPlay：手中有≥2张疯狂卡时，抽2张牌 + 额外随从 + 额外行动 */
function miskatonicLostKnowledge(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];
    // 检查手中疯狂卡数量（注意：打出此行动卡后手牌已减少，但 execute 时 state 是打出前的状态）
    // 在 execute 中 ctx.state 是命令执行前的状态，此时行动卡还在手牌中
    // 所以需要排除当前打出的卡来计算手牌中的疯狂卡
    const madnessInHand = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid).length;
    if (madnessInHand < 2) return { events };
    // 抽2张牌
    const drawCount = Math.min(2, player.deck.length);
    if (drawCount > 0) {
        const drawnUids = player.deck.slice(0, drawCount).map(c => c.uid);
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: drawCount, cardUids: drawnUids },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }
    events.push(grantExtraMinion(ctx.playerId, 'miskatonic_lost_knowledge', ctx.now));
    events.push(grantExtraAction(ctx.playerId, 'miskatonic_lost_knowledge', ctx.now));
    return { events };
}

// TODO: miskatonic_the_librarian (onPlay) - 抽2张或取回2张行动卡（需要 Prompt 选择）
// TODO: miskatonic_professor (onPlay) - 返回力量≤3随从到手牌（需要 Prompt 选目标）
// TODO: miskatonic_fellow (talent) - 抽牌+额外行动（需要 talent 系统）
// TODO: miskatonic_student (special) - 疯狂卡转移（需要 Madness）
// TODO: miskatonic_field_trip - 手牌放牌库底+抽牌（需要 Prompt 选卡）

// ============================================================================
// Priority 2: 需要 Prompt 的疯狂卡能力
// ============================================================================

/**
 * 也许能行 onPlay：弃2张疯狂卡消灭一个随从
 * 
 * - 手中疯狂卡不足2张时无效果
 * - 只有一个可消灭目标时自动选择
 * - 多个目标时创建 Prompt（MVP：自动选最强对手随从）
 */
function miskatonicItMightJustWork(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const madnessInHand = player.hand.filter(
        c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid
    );
    if (madnessInHand.length < 2) return { events: [] };

    // 找所有基地上的随从（可消灭任意随从，包括自己的）
    const allMinions: { uid: string; defId: string; baseIndex: number; owner: string; power: number }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            allMinions.push({
                uid: m.uid, defId: m.defId, baseIndex: i,
                owner: m.owner, power: m.basePower + m.powerModifier,
            });
        }
    }
    if (allMinions.length === 0) return { events: [] };

    // MVP：自动选最强的对手随从（优先对手，其次自己）
    const opponentMinions = allMinions.filter(m => m.owner !== ctx.playerId);
    const target = opponentMinions.length > 0
        ? opponentMinions.sort((a, b) => b.power - a.power)[0]
        : allMinions.sort((a, b) => b.power - a.power)[0];

    const events: SmashUpEvent[] = [];
    // 弃2张疯狂卡（返回疯狂牌库）
    events.push(returnMadnessCard(ctx.playerId, madnessInHand[0].uid, 'miskatonic_it_might_just_work', ctx.now));
    events.push(returnMadnessCard(ctx.playerId, madnessInHand[1].uid, 'miskatonic_it_might_just_work', ctx.now));
    // 消灭目标随从
    events.push(destroyMinion(target.uid, target.defId, target.baseIndex, target.owner, 'miskatonic_it_might_just_work', ctx.now));
    return { events };
}

/**
 * 不可见之书 onPlay：查看对手手牌 + 抽1张疯狂卡 + 2个额外行动
 * 
 * MVP：查看手牌为信息展示（暂不实现 UI），直接给疯狂卡和额外行动
 */
function miskatonicBookOfIterTheUnseen(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 抽1张疯狂卡
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'miskatonic_book_of_iter_the_unseen', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    // 2个额外行动
    events.push(grantExtraAction(ctx.playerId, 'miskatonic_book_of_iter_the_unseen', ctx.now));
    events.push(grantExtraAction(ctx.playerId, 'miskatonic_book_of_iter_the_unseen', ctx.now));
    // TODO: 查看对手手牌的 UI 展示（需要 REVEAL_HAND 事件 + UI 支持）
    return { events };
}

/**
 * 门口之物 onPlay：搜索牌库找1张卡放入手牌 + 抽1张疯狂卡
 * 
 * MVP：自动选牌库中第一张非疯狂卡（不创建 Prompt）
 */
function miskatonicThingOnTheDoorstep(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];

    // 从牌库中找第一张非疯狂卡
    const targetCard = player.deck.find(c => c.defId !== MADNESS_CARD_DEF_ID);
    if (targetCard) {
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: 1, cardUids: [targetCard.uid] },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }

    // 抽1张疯狂卡
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'miskatonic_thing_on_the_doorstep', ctx.now);
    if (madnessEvt) events.push(madnessEvt);

    return { events };
}

/** 注册米斯卡塔尼克大学的 Prompt 继续函数 */
export function registerMiskatonicPromptContinuations(): void {
    // 目前 MVP 实现都是自动选择，暂无需要 Prompt 继续函数
    // 后续实现完整 Prompt 选择时在此注册
}
