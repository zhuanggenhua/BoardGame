/**
 * 大杀四方 - 米斯卡塔尼克大学派系能力
 *
 * 主题：知识研究、抽牌、行动卡操控
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type { SmashUpEvent, OngoingDetachedEvent, CardsDrawnEvent, MinionCardDef } from '../domain/types';
import {
    drawMadnessCards, grantExtraAction, grantExtraMinion,
    returnMadnessCard, destroyMinion,
    getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions,
    resolveOrPrompt, revealHand,
} from '../domain/abilityHelpers';
import { getCardDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';


/** 这些多管闲事的小鬼 onPlay：选择一个基地，消灭该基地上任意数量的行动卡 */
function miskatonicThoseMeddlingKids(ctx: AbilityContext): AbilityResult {
    // 找有行动卡的基地
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        let actionCount = base.ongoingActions.length;
        for (const m of base.minions) {
            actionCount += m.attachedActions.length;
        }
        if (actionCount === 0) continue;
        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${i + 1}`;
        candidates.push({ baseIndex: i, label: `${baseName}（${actionCount}张行动卡）` });
    }
    return resolveOrPrompt(ctx, buildBaseTargetOptions(candidates), {
        id: 'miskatonic_those_meddling_kids',
        title: '选择一个基地消灭其上所有行动卡',
        sourceId: 'miskatonic_those_meddling_kids',
        targetType: 'base',
        // "消灭任意数量"暗含可选性，始终让玩家确认
        autoResolveIfSingle: false,
    }, (value) => destroyAllActionsOnBase(ctx, value.baseIndex));
}

/** 辅助：消灭指定基地上所有行动卡 */
function destroyAllActionsOnBase(ctx: AbilityContext, baseIndex: number): AbilityResult {
    const events: SmashUpEvent[] = [];
    const base = ctx.state.bases[baseIndex];
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

/** 强制阅读 onPlay：选择一位玩家，该玩家抽2张疯狂卡 + 你获得1个额外行动 */
function miskatonicMandatoryReading(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    if (opponents.length === 0) {
        events.push(grantExtraAction(ctx.playerId, 'miskatonic_mandatory_reading', ctx.now));
        return { events };
    }
    // 数据驱动：强制效果，单对手自动执行
    const options = opponents.map((pid, i) => ({
        id: `opp-${i}`, label: `玩家 ${pid}`, value: { pid },
    }));
    return resolveOrPrompt(ctx, options, {
        id: 'miskatonic_mandatory_reading',
        title: '选择一位玩家抽两张疯狂卡',
        sourceId: 'miskatonic_mandatory_reading',
        targetType: 'generic',
    }, (value) => {
        const evts: SmashUpEvent[] = [];
        const madnessEvt = drawMadnessCards(value.pid, 2, ctx.state, 'miskatonic_mandatory_reading', ctx.now);
        if (madnessEvt) evts.push(madnessEvt);
        evts.push(grantExtraAction(ctx.playerId, 'miskatonic_mandatory_reading', ctx.now));
        return { events: evts };
    });
}

/** 失落的知识 onPlay：手中有≥2张疯狂卡时，展示疯狂卡，抽2张牌 + 额外随从 + 额外行动 */
function miskatonicLostKnowledge(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];
    // 检查手中疯狂卡数量（注意：打出此行动卡后手牌已减少，但 execute 的 state 是打出前的状态）
    // 在 execute 中 ctx.state 是命令执行前的状态，此时行动卡还在手牌中
    // 所以需要排除当前打出的卡来计算手牌中的疯狂卡
    const madnessCards = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid);
    if (madnessCards.length < 2) return { events };

    // 展示手中的疯狂卡给所有人看（规则："展示其"）
    const madnessToReveal = madnessCards.map(c => ({ uid: c.uid, defId: c.defId }));
    events.push(revealHand(ctx.playerId, 'all', madnessToReveal, 'miskatonic_lost_knowledge', ctx.now, ctx.playerId));

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

/**
 * 教授 talent：弃1张疯狂卡 → 额外行动 + 额外随从
 *
 * 官方规则：Discard a Madness card. If you do, you may play an extra action and/or an extra minion.
 */
function miskatonicProfessorTalent(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];

    // 检查手中是否有疯狂卡
    const madnessCard = player.hand.find(c => c.defId === MADNESS_CARD_DEF_ID);
    if (!madnessCard) return { events: [] };

    // 弃掉疯狂卡（放入弃牌堆，不是返回疯狂牌库）
    events.push({
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId: ctx.playerId, cardUids: [madnessCard.uid] },
        timestamp: ctx.now,
    } as SmashUpEvent);

    // 额外行动 + 额外随从
    events.push(grantExtraAction(ctx.playerId, 'miskatonic_professor', ctx.now));
    events.push(grantExtraMinion(ctx.playerId, 'miskatonic_professor', ctx.now));

    return { events };
}

/**
 * 图书管理员 talent：弃1张疯狂卡 → 抽1张牌
 *
 * 官方规则：Discard a Madness card. If you do, draw a card.
 */
function miskatonicLibrarianTalent(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];

    // 检查手中是否有疯狂卡
    const madnessCard = player.hand.find(c => c.defId === MADNESS_CARD_DEF_ID);
    if (!madnessCard) return { events: [] };

    // 弃掉疯狂卡（放入弃牌堆）
    events.push({
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId: ctx.playerId, cardUids: [madnessCard.uid] },
        timestamp: ctx.now,
    } as SmashUpEvent);

    // 抽1张牌
    if (player.deck.length > 0) {
        const drawnUid = player.deck[0].uid;
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: 1, cardUids: [drawnUid] },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }

    return { events };
}

/**
 * 心理学家 onPlay：将手牌或弃牌堆中的1张疯狂卡返回疯狂牌库
 *
 * 官方规则：You may return a Madness card from your hand or discard pile to the Madness deck.
 */
function miskatonicPsychologistOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 优先从手牌中找疯狂卡
    const madnessInHand = player.hand.find(c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid);
    if (madnessInHand) {
        return { events: [returnMadnessCard(ctx.playerId, madnessInHand.uid, 'miskatonic_psychologist', ctx.now)] };
    }
    // 其次从弃牌堆中找
    const madnessInDiscard = player.discard.find(c => c.defId === MADNESS_CARD_DEF_ID);
    if (madnessInDiscard) {
        return { events: [returnMadnessCard(ctx.playerId, madnessInDiscard.uid, 'miskatonic_psychologist', ctx.now)] };
    }
    return { events: [] };
}

/**
 * 研究员 onPlay：抽1张疯狂卡
 *
 * 官方规则：You may draw a Madness card.
 */
function miskatonicResearcherOnPlay(ctx: AbilityContext): AbilityResult {
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'miskatonic_researcher', ctx.now);
    if (madnessEvt) return { events: [madnessEvt] };
    return { events: [] };
}

// ============================================================================
// Priority 2: 需要 Prompt 的疯狂卡能力
// ============================================================================

/**
 * 也许能行 onPlay：弃2张疯狂卡消灭一个随从
 */
function miskatonicItMightJustWork(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const madnessInHand = player.hand.filter(
        c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid
    );
    if (madnessInHand.length < 2) return { events: [] };

    // 收集所有可消灭的随从
    const allMinions: { uid: string; defId: string; baseIndex: number; owner: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(ctx.state, m, i);
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            allMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, label: `${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    if (allMinions.length === 0) return { events: [] };
    // Prompt 选择
    const options = allMinions.map(t => ({ uid: t.uid, defId: t.defId, baseIndex: t.baseIndex, label: t.label }));
    const interaction = createSimpleChoice(
        `miskatonic_it_might_just_work_${ctx.now}`, ctx.playerId,
        '选择要消灭的随从（弃2张疯狂卡）', buildMinionTargetOptions(options), 'miskatonic_it_might_just_work',
    );
    (interaction.data as any).continuationContext = { madnessUids: [madnessInHand[0].uid, madnessInHand[1].uid] };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
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
    // 查看对手手牌：收集有手牌的对手
    const opponents: { pid: string; label: string }[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (opponent.hand.length === 0) continue;
        opponents.push({ pid, label: `对手 ${pid}（${opponent.hand.length}张手牌）` });
    }
    if (opponents.length === 0) return { events };
    // 数据驱动：强制效果，单对手自动执行
    const opOptions = opponents.map((o, i) => ({ id: `opp-${i}`, label: o.label, value: { pid: o.pid } }));
    const resolveResult = resolveOrPrompt(ctx, opOptions, {
        id: 'miskatonic_book_of_iter_choose_opponent',
        title: '选择一个对手查看其手牌',
        sourceId: 'miskatonic_book_of_iter_choose_opponent',
        targetType: 'generic',
    }, (value) => {
        const target = ctx.state.players[value.pid];
        const cards = target.hand.map(c => ({ uid: c.uid, defId: c.defId }));
        return { events: [{
            type: SU_EVENTS.REVEAL_HAND,
            payload: {
                targetPlayerId: value.pid,
                viewerPlayerId: ctx.playerId,
                cards,
                reason: 'miskatonic_book_of_iter',
            },
            timestamp: ctx.now,
        }] };
    });
    // 合并前面的事件（疯狂卡+额外行动）和选择结果
    return {
        events: [...events, ...resolveResult.events],
        matchState: resolveResult.matchState,
    };
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

/**
 * 实地考察 onPlay：从手牌中选择任意数量的卡放牌库底，每放一张抽一张
 */
function miskatonicFieldTrip(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 排除刚打出的自己
    const handCards = player.hand.filter(c => c.uid !== ctx.cardUid);
    if (handCards.length === 0) return { events: [] };

    // 创建多选 Prompt 让玩家选择要放牌库底的卡
    const options = handCards.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        `miskatonic_field_trip_${ctx.now}`, ctx.playerId,
        '选择要放到牌库底的卡牌（每放一张抽一张）',
        options as any[],
        'miskatonic_field_trip',
        { min: 1, max: handCards.length },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 注册米斯卡塔尼克大学派系所有能力（放在所有函数定义之后，避免 Vite SSR 提升失效） */
export function registerMiskatonicAbilities(): void {
    // === 行动卡 ===
    // 这些多管闲事的小鬼：消灭一个基地上所有行动卡
    registerAbility('miskatonic_those_meddling_kids', 'onPlay', miskatonicThoseMeddlingKids);
    // 心理分析：抽2张牌 + 抽1张疯狂卡
    registerAbility('miskatonic_psychological_profiling', 'onPlay', miskatonicPsychologicalProfiling);
    // 强制阅读：目标对手抽2张疯狂卡 + 你获得1个额外行动
    registerAbility('miskatonic_mandatory_reading', 'onPlay', miskatonicMandatoryReading);
    // 失落的知识：手中有≥2张疯狂卡时，抽2张牌 + 额外随从 + 额外行动
    registerAbility('miskatonic_lost_knowledge', 'onPlay', miskatonicLostKnowledge);
    // 也许能行：弃2张疯狂卡消灭一个随从
    registerAbility('miskatonic_it_might_just_work', 'onPlay', miskatonicItMightJustWork);
    // 不可见之书：查看对手手牌 + 抽1张疯狂卡 + 2个额外行动
    registerAbility('miskatonic_book_of_iter_the_unseen', 'onPlay', miskatonicBookOfIterTheUnseen);
    // 门口之物：搜索牌库找1张卡 + 抽1张疯狂卡
    registerAbility('miskatonic_thing_on_the_doorstep', 'onPlay', miskatonicThingOnTheDoorstep);
    // 实地考察：手牌放牌库底 + 抽等量牌
    registerAbility('miskatonic_field_trip', 'onPlay', miskatonicFieldTrip);

    // === 随从 ===
    // 教授（power 5, talent）：弃1张疯狂卡 → 额外行动 + 额外随从
    registerAbility('miskatonic_professor', 'talent', miskatonicProfessorTalent);
    // 图书管理员（power 4, talent）：弃1张疯狂卡 → 抽1张牌
    registerAbility('miskatonic_librarian', 'talent', miskatonicLibrarianTalent);
    // 心理学家（power 3, onPlay）：将手牌或弃牌堆中的1张疯狂卡返回疯狂牌库
    registerAbility('miskatonic_psychologist', 'onPlay', miskatonicPsychologistOnPlay);
    // 研究员（power 2, onPlay）：抽1张疯狂卡
    registerAbility('miskatonic_researcher', 'onPlay', miskatonicResearcherOnPlay);
}

/** 注册米斯卡塔尼克大学的交互解决处理函数 */
export function registerMiskatonicInteractionHandlers(): void {
    // 教授的交互处理器已移除（教授现在是 talent，不需要选择目标）

    registerInteractionHandler('miskatonic_it_might_just_work', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { madnessUids: string[] };
        if (!ctx) return undefined;
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const events: SmashUpEvent[] = [];
        for (const uid of ctx.madnessUids) {
            events.push(returnMadnessCard(playerId, uid, 'miskatonic_it_might_just_work', timestamp));
        }
        events.push(destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'miskatonic_it_might_just_work', timestamp));
        return { state, events };
    });

    registerInteractionHandler('miskatonic_book_of_iter_choose_opponent', (state, playerId, value, _iData, _random, timestamp) => {
        const { pid } = value as { pid: string };
        const target = state.core.players[pid];
        if (!target || target.hand.length === 0) return { state, events: [] };
        const cards = target.hand.map(c => ({ uid: c.uid, defId: c.defId }));
        return { state, events: [{
            type: SU_EVENTS.REVEAL_HAND,
            payload: {
                targetPlayerId: pid,
                viewerPlayerId: playerId,
                cards,
                reason: 'miskatonic_book_of_iter',
            },
            timestamp,
        }] };
    });

    // 强制阅读：选择对手后给其抽疯狂卡 + 额外行动
    registerInteractionHandler('miskatonic_mandatory_reading', (state, playerId, value, _iData, _random, timestamp) => {
        const { pid } = value as { pid: string };
        const events: SmashUpEvent[] = [];
        const madnessEvt = drawMadnessCards(pid, 2, state.core, 'miskatonic_mandatory_reading', timestamp);
        if (madnessEvt) events.push(madnessEvt);
        events.push(grantExtraAction(playerId, 'miskatonic_mandatory_reading', timestamp));
        return { state, events };
    });

    // 这些多管闲事的小鬼：选择基地后消灭所有行动卡
    registerInteractionHandler('miskatonic_those_meddling_kids', (state, _playerId, value, _iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        for (const ongoing of base.ongoingActions) {
            events.push({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId, reason: 'miskatonic_those_meddling_kids' },
                timestamp,
            } as OngoingDetachedEvent);
        }
        for (const m of base.minions) {
            for (const attached of m.attachedActions) {
                events.push({
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: { cardUid: attached.uid, defId: attached.defId, ownerId: attached.ownerId, reason: 'miskatonic_those_meddling_kids' },
                    timestamp,
                } as OngoingDetachedEvent);
            }
        }
        return { state, events };
    });

    // 实地考察：选择卡牌后放牌库底 + 抽等量牌
    registerInteractionHandler('miskatonic_field_trip', (state, playerId, value, _iData, _random, timestamp) => {
        const selectedCards = value as Array<{ cardUid: string; defId: string }>;
        if (!Array.isArray(selectedCards) || selectedCards.length === 0) return { state, events: [] };
        const player = state.core.players[playerId];
        const events: SmashUpEvent[] = [];
        const cardUids = selectedCards.map(v => v.cardUid);
        // 手牌放牌库底
        const newDeckUids = [...player.deck.map(c => c.uid), ...cardUids];
        events.push({
            type: SU_EVENTS.HAND_SHUFFLED_INTO_DECK,
            payload: { playerId, newDeckUids, reason: 'miskatonic_field_trip' },
            timestamp,
        });
        // 抽等量牌
        const drawCount = Math.min(cardUids.length, newDeckUids.length);
        if (drawCount > 0) {
            const drawnUids = newDeckUids.slice(0, drawCount);
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId, count: drawCount, cardUids: drawnUids },
                timestamp,
            } as CardsDrawnEvent);
        }
        return { state, events };
    });
}
