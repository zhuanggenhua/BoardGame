/**
 * 大杀四方 - 米斯卡塔尼克大学派系能力
 *
 * 主题：知识研究、抽牌、行动卡操控
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type { SmashUpEvent, OngoingDetachedEvent, CardsDrawnEvent, MinionCardDef, DeckReorderedEvent } from '../domain/types';
import {
    drawMadnessCards, grantExtraAction, grantExtraMinion,
    returnMadnessCard, destroyMinion,
    getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions,
    resolveOrPrompt, revealHand, buildAbilityFeedback,
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
    return resolveOrPrompt(ctx, buildBaseTargetOptions(candidates, ctx.state), {
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
        autoCancelOption: true,  // 允许取消
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
 * "你可以" → 需要跳过选项
 */
function miskatonicPsychologistOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 收集所有可返回的疯狂卡（手牌+弃牌堆）
    const candidates: { uid: string; source: 'hand' | 'discard'; label: string }[] = [];
    for (const c of player.hand) {
        if (c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid) {
            candidates.push({ uid: c.uid, source: 'hand', label: '疯狂卡（手牌）' });
        }
    }
    for (const c of player.discard) {
        if (c.defId === MADNESS_CARD_DEF_ID) {
            candidates.push({ uid: c.uid, source: 'discard', label: '疯狂卡（弃牌堆）' });
        }
    }
    if (candidates.length === 0) return { events: [] };
    // 单候选也需要确认（"你可以"=可选）
    const options = candidates.map((c, i) => ({
        id: `madness-${i}`, label: c.label, value: { cardUid: c.uid, defId: MADNESS_CARD_DEF_ID, source: c.source },
    }));
    const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };
    const interaction = createSimpleChoice(
        `miskatonic_psychologist_${ctx.now}`, ctx.playerId,
        '选择要返回疯狂牌库的疯狂卡（可跳过）', [...options, skipOption] as any[], 'miskatonic_psychologist',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 研究员 onPlay：抽1张疯狂卡
 *
 * 官方规则：You may draw a Madness card.
 * "你可以" → 需要确认交互
 */
function miskatonicResearcherOnPlay(ctx: AbilityContext): AbilityResult {
    // 检查疯狂牌库是否有牌
    if (!ctx.state.madnessDeck || ctx.state.madnessDeck.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    const interaction = createSimpleChoice(
        `miskatonic_researcher_${ctx.now}`, ctx.playerId,
        '是否抽取一张疯狂卡？',
        [
            { id: 'draw', label: '抽取疯狂卡', value: { draw: true } },
            { id: 'skip', label: '跳过', value: { skip: true } },
        ],
        'miskatonic_researcher',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
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
    if (madnessInHand.length < 2) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };

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
    if (allMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
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
 * 门口之物 onPlay：搜寻牌库找一张随从或行动卡加入手牌，然后洗牌，再抽1张疯狂卡
 *
 * 描述："从牌组搜寻一张随从或战术并加入手牌。抽一张疯狂卡。"
 */
function miskatonicThingOnTheDoorstep(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];

    // 搜索牌库中所有非疯狂卡（随从或行动卡）
    const eligible = player.deck.filter(c => c.defId !== MADNESS_CARD_DEF_ID);
    if (eligible.length === 0) {
        // 牌库无可选卡，规则仍要求重洗牌库 + 抽疯狂卡
        const events: SmashUpEvent[] = [];
        const shuffled = ctx.random.shuffle([...player.deck]);
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId: ctx.playerId, deckUids: shuffled.map(c => c.uid) },
            timestamp: ctx.now,
        } as DeckReorderedEvent);
        events.push(buildAbilityFeedback(ctx.playerId, 'feedback.deck_search_no_match', ctx.now));
        const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'miskatonic_thing_on_the_doorstep', ctx.now);
        if (madnessEvt) events.push(madnessEvt);
        return { events };
    }

    // 单候选自动选择
    if (eligible.length === 1) {
        const card = eligible[0];
        const remainingDeck = player.deck.filter(c => c.uid !== card.uid).map(c => c.uid);
        const events: SmashUpEvent[] = [
            { type: SU_EVENTS.CARDS_DRAWN, payload: { playerId: ctx.playerId, count: 1, cardUids: [card.uid] }, timestamp: ctx.now } as CardsDrawnEvent,
            { type: SU_EVENTS.DECK_REORDERED, payload: { playerId: ctx.playerId, deckUids: remainingDeck }, timestamp: ctx.now } as DeckReorderedEvent,
        ];
        const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'miskatonic_thing_on_the_doorstep', ctx.now);
        if (madnessEvt) events.push(madnessEvt);
        return { events };
    }

    // 多候选：创建搜索选择交互
    const options = eligible.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        const typeLabel = c.type === 'minion' ? '随从' : '行动';
        return { id: `card-${i}`, label: `${name}（${typeLabel}）`, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        `miskatonic_thing_on_the_doorstep_${ctx.now}`, ctx.playerId,
        '搜寻牌库：选择一张随从或行动卡加入手牌', options as any[], 'miskatonic_thing_on_the_doorstep',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 实地考察 onPlay：从手牌中选择任意数量的卡放牌库底，每放一张抽一张
 */
function miskatonicFieldTrip(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 排除刚打出的自己
    const handCards = player.hand.filter(c => c.uid !== ctx.cardUid);
    if (handCards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };

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
        undefined, { min: 0, max: handCards.length },
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
        // 修复：描述说"弃掉两张疯狂卡"，应使用 CARDS_DISCARDED（放入弃牌堆），而非 returnMadnessCard（返回疯狂牌库）
        events.push({
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: ctx.madnessUids },
            timestamp,
        } as SmashUpEvent);
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
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { pid } = value as { pid: string };
        const events: SmashUpEvent[] = [];
        const madnessEvt = drawMadnessCards(pid, 2, state.core, 'miskatonic_mandatory_reading', timestamp);
        if (madnessEvt) events.push(madnessEvt);
        events.push(grantExtraAction(playerId, 'miskatonic_mandatory_reading', timestamp));
        return { state, events };
    });

    // 这些多管闲事的小鬼：选择基地后→多选要消灭的行动卡（任意数量）
    registerInteractionHandler('miskatonic_those_meddling_kids', (state, playerId, value, _iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return { state, events: [] };
        // 收集该基地上所有行动卡
        const actionCards: { uid: string; defId: string; ownerId: string; label: string }[] = [];
        for (const ongoing of base.ongoingActions) {
            const def = getCardDef(ongoing.defId);
            actionCards.push({ uid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId, label: def?.name ?? ongoing.defId });
        }
        for (const m of base.minions) {
            for (const attached of m.attachedActions) {
                const def = getCardDef(attached.defId);
                const mDef = getCardDef(m.defId);
                actionCards.push({ uid: attached.uid, defId: attached.defId, ownerId: attached.ownerId, label: `${def?.name ?? attached.defId}（附着在 ${mDef?.name ?? m.defId} 上）` });
            }
        }
        if (actionCards.length === 0) return { state, events: [] };
        // 创建多选交互（min:0 = 可不选任何）
        const options = actionCards.map((c, i) => ({
            id: `action-${i}`, label: c.label, value: { cardUid: c.uid, defId: c.defId, ownerId: c.ownerId },
        }));
        const next = createSimpleChoice(
            `miskatonic_those_meddling_kids_select_${timestamp}`, playerId,
            '选择要消灭的行动卡（任意数量）', options as any[], 'miskatonic_those_meddling_kids_select',
            undefined, { min: 0, max: actionCards.length },
        );
        return { state: queueInteraction(state, next), events: [] };
    });

    // 这些多管闲事的小鬼：多选行动卡后消灭
    registerInteractionHandler('miskatonic_those_meddling_kids_select', (state, _playerId, value, _iData, _random, timestamp) => {
        const selections = (Array.isArray(value) ? value : [value]) as { cardUid: string; defId: string; ownerId: string }[];
        if (!selections || selections.length === 0 || !selections[0]?.cardUid) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        for (const sel of selections) {
            events.push({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid: sel.cardUid, defId: sel.defId, ownerId: sel.ownerId, reason: 'miskatonic_those_meddling_kids' },
                timestamp,
            } as OngoingDetachedEvent);
        }
        return { state, events };
    });

    // 门口之物：搜索牌库选择卡牌加入手牌 + 洗牌 + 抽疯狂卡
    registerInteractionHandler('miskatonic_thing_on_the_doorstep', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string; defId: string };
        const player = state.core.players[playerId];
        const events: SmashUpEvent[] = [];
        // 从牌库取出选中的卡加入手牌
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [cardUid] },
            timestamp,
        } as CardsDrawnEvent);
        // 洗牌（排除已取出的卡）
        const remainingDeck = player.deck.filter(c => c.uid !== cardUid).map(c => c.uid);
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: remainingDeck },
            timestamp,
        } as DeckReorderedEvent);
        // 抽1张疯狂卡
        const madnessEvt = drawMadnessCards(playerId, 1, state.core, 'miskatonic_thing_on_the_doorstep', timestamp);
        if (madnessEvt) events.push(madnessEvt);
        return { state, events };
    });

    // 心理学家：选择疯狂卡返回疯狂牌库（可跳过）
    registerInteractionHandler('miskatonic_psychologist', (state, playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        const { cardUid } = value as { cardUid: string };
        return { state, events: [returnMadnessCard(playerId, cardUid, 'miskatonic_psychologist', timestamp)] };
    });

    // 研究员：确认是否抽取疯狂卡（可跳过）
    registerInteractionHandler('miskatonic_researcher', (state, playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        const madnessEvt = drawMadnessCards(playerId, 1, state.core, 'miskatonic_researcher', timestamp);
        return { state, events: madnessEvt ? [madnessEvt] : [] };
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
