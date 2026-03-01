/**
 * 大杀四方 - 米斯卡塔尼克大学派系能力
 *
 * 主题：知识研究、抽牌、行动卡操控
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type { SmashUpEvent, OngoingDetachedEvent, CardsDrawnEvent, MinionCardDef, SmashUpCore } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import {
    drawMadnessCards, grantExtraAction, grantExtraMinion,
    returnMadnessCard, destroyMinion, addTempPower, addPowerCounter,
    getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions,
    resolveOrPrompt, buildAbilityFeedback,
} from '../domain/abilityHelpers';
import { getCardDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';


/** 这些多管闲事的小鬼 onPlay：选择一个基地，消灭该基地上任意数量的行动卡（点击式）*/
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
        title: '选择一个基地消灭其上的行动卡',
        sourceId: 'miskatonic_those_meddling_kids',
        targetType: 'base',
        // "消灭任意数量"暗含可选性，始终让玩家确认
        autoResolveIfSingle: false,
    }, (_value) => ({ events: [] })); // resolve 回调不会被调用（autoResolveIfSingle=false）
}

/**
 * 这太疯狂了... onPlay：抽一张疯狂卡 + 全体己方随从+1力量直到回合结束 + 额外打出一个战术
 *
 * 中文版规则：抽一张疯狂卡。你的每个随从获得+1力量直到回合结束。本回合你可以打出一个额外的战术。
 */
function miskatonicPsychologicalProfiling(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 抽1张疯狂卡
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'miskatonic_psychological_profiling', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    // 全体己方随从+1力量直到回合结束
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                events.push(addTempPower(m.uid, i, 1, 'miskatonic_psychological_profiling', ctx.now));
            }
        }
    }
    // 额外打出1个战术
    events.push(grantExtraAction(ctx.playerId, 'miskatonic_psychological_profiling', ctx.now));
    return { events };
}

/**
 * 最好不知道的事 special：在一个基地计分前，选择这里的一个随从。抽最多3张疯狂卡。每抽取一张疯狂卡这个随从都获得+2力量。
 *
 * 中文版规则：特殊：在一个基地计分前，选择这里的一个随从。抽最多3张疯狂卡。每抽取一张疯狂卡这个随从都获得+2力量。
 */
function miskatonicMandatoryReading(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.baseIndex ?? 0;
    const base = ctx.state.bases[baseIndex];
    if (!base || base.minions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 选择基地上的一个随从
    const options = base.minions.map(m => {
        const def = getCardDef(m.defId) as MinionCardDef | undefined;
        const name = def?.name ?? m.defId;
        const power = getMinionPower(ctx.state, m, baseIndex);
        return { uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${power})` };
    });
    return resolveOrPrompt(ctx, buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'affect' }), {
        id: 'miskatonic_mandatory_reading',
        title: '最好不知道的事：选择一个随从',
        sourceId: 'miskatonic_mandatory_reading',
        targetType: 'minion',
    }, (value) => {
        // 单候选自动执行时直接创建第二步交互（多候选时由 interaction handler 处理）
        return buildMandatoryReadingDrawInteraction(ctx.matchState, ctx.playerId, value.minionUid, baseIndex, ctx.now);
    });
}

/** 构建"最好不知道的事"第二步交互（选择抽几张疯狂卡），供 resolve 回调和 interaction handler 共用 */
function buildMandatoryReadingDrawInteraction(
    matchState: MatchState<SmashUpCore>,
    playerId: string,
    minionUid: string,
    baseIndex: number,
    timestamp: number,
): AbilityResult {
    const madnessDeckSize = (matchState.core as any).madnessDeck?.length ?? 0;
    const maxDraw = Math.min(3, madnessDeckSize);
    if (maxDraw === 0) return { events: [] };
    const drawOptions: any[] = [];
    for (let i = 1; i <= maxDraw; i++) {
        drawOptions.push({ id: `draw-${i}`, label: `抽${i}张疯狂卡（随从+${i * 2}力量）`, value: { count: i, minionUid, baseIndex } });
    }
    drawOptions.push({ id: 'skip', label: '不抽', value: { skip: true }, displayMode: 'button' as const });
    const interaction = createSimpleChoice(
        `miskatonic_mandatory_reading_draw_${timestamp}`, playerId,
        '最好不知道的事：选择抽取疯狂卡数量', drawOptions,
        'miskatonic_mandatory_reading_draw',
    );
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

/**
 * 通往超凡的门 talent（ongoing 行动卡）：抽一张疯狂卡，你可以额外打出一个随从到这
 *
 * 中文版规则：打出到基地上。天赋：抽一张疯狂卡，你可以额外打出一个随从到这。
 */
function miskatonicLostKnowledge(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 抽1张疯狂卡
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'miskatonic_lost_knowledge', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    // 额外打出1个随从到此基地（restrictToBase 限定到 ongoing 所在基地）
    if (ctx.baseIndex !== undefined) {
        events.push(grantExtraMinion(ctx.playerId, 'miskatonic_lost_knowledge', ctx.now, ctx.baseIndex));
    } else {
        events.push(grantExtraMinion(ctx.playerId, 'miskatonic_lost_knowledge', ctx.now));
    }
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
    
    // 统计手牌和弃牌堆中的疯狂卡数量
    const handMadness = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid);
    const discardMadness = player.discard.filter(c => c.defId === MADNESS_CARD_DEF_ID);
    
    if (handMadness.length === 0 && discardMadness.length === 0) return { events: [] };
    
    // 按来源分组的选项
    const options: any[] = [];
    if (handMadness.length > 0) {
        options.push({
            id: 'hand',
            label: `从手牌返回1张疯狂卡`,
            value: { source: 'hand' },
            displayMode: 'button' as const,
        });
    }
    if (discardMadness.length > 0) {
        options.push({
            id: 'discard',
            label: `从弃牌堆返回1张疯狂卡`,
            value: { source: 'discard' },
            displayMode: 'button' as const,
        });
    }
    options.push({
        id: 'skip',
        label: '跳过',
        value: { skip: true },
        displayMode: 'button' as const,
    });
    
    const interaction = createSimpleChoice(
        `miskatonic_psychologist_${ctx.now}`, ctx.playerId,
        '选择要返回疯狂牌库的疯狂卡（可跳过）', options, 'miskatonic_psychologist',
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
/**
 * 它可能有用 onPlay：弃掉一张疯狂卡来使你的每个随从获得+1力量直到回合结束
 *
 * 中文版规则：弃掉一张疯狂卡来使你的每个随从获得+1力量直到回合结束。
 */
function miskatonicItMightJustWork(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const madnessInHand = player.hand.filter(
        c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid
    );
    if (madnessInHand.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };

    const events: SmashUpEvent[] = [];
    // 弃掉1张疯狂卡
    events.push({
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId: ctx.playerId, cardUids: [madnessInHand[0].uid] },
        timestamp: ctx.now,
    } as SmashUpEvent);
    // 所有己方随从+1力量（临时，回合结束清零）
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                events.push(addTempPower(m.uid, i, 1, 'miskatonic_it_might_just_work', ctx.now));
            }
        }
    }
    return { events };
}

/**
 * 金克丝! onPlay：从你的手牌和弃牌堆返回至多两张疯狂卡到疯狂卡牌堆
 *
 * 中文版规则：从你的手牌和弃牌堆返回至多两张疯狂卡到疯狂卡牌堆。
 */
function miskatonicBookOfIterTheUnseen(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 收集手牌和弃牌堆中的疯狂卡（排除刚打出的自己）
    const handMadness = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid);
    const discardMadness = player.discard.filter(c => c.defId === MADNESS_CARD_DEF_ID);
    const totalMadness = handMadness.length + discardMadness.length;

    if (totalMadness === 0) return { events: [] };

    // 构建初始选项（基于当前状态）
    const buildOptions = (hCount: number, dCount: number) => {
        const options: any[] = [];
        if (hCount >= 1) {
            options.push({ id: 'hand-1', label: `从手牌返回1张疯狂卡`, value: { source: 'hand', count: 1 } });
        }
        if (hCount >= 2) {
            options.push({ id: 'hand-2', label: `从手牌返回2张疯狂卡`, value: { source: 'hand', count: 2 } });
        }
        if (dCount >= 1) {
            options.push({ id: 'discard-1', label: `从弃牌堆返回1张疯狂卡`, value: { source: 'discard', count: 1 } });
        }
        if (dCount >= 2) {
            options.push({ id: 'discard-2', label: `从弃牌堆返回2张疯狂卡`, value: { source: 'discard', count: 2 } });
        }
        // 混合来源（手牌1+弃牌堆1）
        if (hCount >= 1 && dCount >= 1) {
            options.push({ id: 'mixed', label: `手牌1张+弃牌堆1张`, value: { source: 'mixed', handCount: 1, discardCount: 1 } });
        }
        // 跳过选项（"至多"意味着可以不返回）
        options.push({ id: 'skip', label: '不返回', value: { skip: true }, displayMode: 'button' as const });
        return options;
    };

    const interaction = createSimpleChoice(
        `miskatonic_book_of_iter_${ctx.now}`, ctx.playerId,
        '金克丝!：选择要返回疯狂卡牌堆的疯狂卡', buildOptions(handMadness.length, discardMadness.length),
        'miskatonic_book_of_iter_the_unseen',
    );

    // 添加 optionsGenerator：根据最新状态动态刷新选项
    (interaction.data as any).optionsGenerator = (state: any) => {
        const p = state.core.players[ctx.playerId];
        const hMadness = p.hand.filter((c: any) => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid);
        const dMadness = p.discard.filter((c: any) => c.defId === MADNESS_CARD_DEF_ID);
        return buildOptions(hMadness.length, dMadness.length);
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 老詹金斯!? special：在一个基地计分前，消灭一个在那里拥有最高力量的随从
 *
 * 中文版规则：特殊：在一个基地计分前，消灭一个在那里拥有最高力量的随从。
 */
function miskatonicThingOnTheDoorstep(ctx: AbilityContext): AbilityResult {
    // special 卡在基地计分前打出，ctx.baseIndex 是计分的基地
    const baseIndex = ctx.baseIndex ?? 0;
    const base = ctx.state.bases[baseIndex];
    if (!base || base.minions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 找到最高力量的随从
    let maxPower = -Infinity;
    for (const m of base.minions) {
        const power = getMinionPower(ctx.state, m, baseIndex);
        if (power > maxPower) maxPower = power;
    }
    // 收集所有最高力量的随从（可能有多个并列）
    const topMinions = base.minions.filter(m => getMinionPower(ctx.state, m, baseIndex) === maxPower);

    if (topMinions.length === 1) {
        // 唯一最高力量随从，直接消灭
        const target = topMinions[0];
        return { events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, undefined, 'miskatonic_thing_on_the_doorstep', ctx.now)] };
    }

    // 多个并列最高力量，让玩家选择
    const options = topMinions.map(m => {
        const def = getCardDef(m.defId) as MinionCardDef | undefined;
        const name = def?.name ?? m.defId;
        const power = getMinionPower(ctx.state, m, baseIndex);
        return { uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${power})` };
    });
    return resolveOrPrompt(ctx, buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }), {
        id: 'miskatonic_thing_on_the_doorstep',
        title: '老詹金斯!?：选择要消灭的最高力量随从',
        sourceId: 'miskatonic_thing_on_the_doorstep',
        targetType: 'minion',
    }, (value) => {
        const target = base.minions.find(m => m.uid === value.minionUid);
        if (!target) return { events: [] };
        return { events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, undefined, 'miskatonic_thing_on_the_doorstep', ctx.now)] };
    });
}

/**
 * 实地考察 onPlay：从手牌中选择任意数量的卡放牌库底，每放一张抽一张
 */
function miskatonicFieldTrip(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 排除刚打出的自己，以及疯狂卡（疯狂卡不能放牌库底）
    const handCards = player.hand.filter(c => c.uid !== ctx.cardUid && c.defId !== MADNESS_CARD_DEF_ID);
    if (handCards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };

    // 创建多选 Prompt 让玩家选择要放牌库底的卡
    const options = handCards.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId }, _source: 'hand' as const };
    });
    const interaction = createSimpleChoice(
        `miskatonic_field_trip_${ctx.now}`, ctx.playerId,
        '选择要放到牌库底的卡牌（每放一张抽一张）',
        [...options, { id: 'skip', label: '跳过', value: { skip: true } }] as any[],
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
    // 心理分析（这太疯狂了...）：抽疯狂卡+全体己方随从+1力量+额外战术
    registerAbility('miskatonic_psychological_profiling', 'onPlay', miskatonicPsychologicalProfiling);
    // 最好不知道的事：special，基地计分前选随从+抽疯狂卡+该随从+2力量/张
    registerAbility('miskatonic_mandatory_reading', 'special', miskatonicMandatoryReading);
    // 失落的知识（通往超凡的门）：ongoing talent，抽疯狂卡+额外随从到此基地
    registerAbility('miskatonic_lost_knowledge', 'talent', miskatonicLostKnowledge);
    // 也许能行（它可能有用）：弃1张疯狂卡，己方所有随从+1力量直到回合结束
    registerAbility('miskatonic_it_might_just_work', 'onPlay', miskatonicItMightJustWork);
    // 不可见之书（金克丝!）：从手牌/弃牌堆返回至多2张疯狂卡到疯狂牌库
    registerAbility('miskatonic_book_of_iter_the_unseen', 'onPlay', miskatonicBookOfIterTheUnseen);
    // 老詹金斯!?：特殊，基地计分前消灭该基地最高力量随从
    registerAbility('miskatonic_thing_on_the_doorstep', 'special', miskatonicThingOnTheDoorstep);
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
/** 多管闲事的小鬼：显示下一张可消灭的行动卡（带跳过按钮）*/
function meddlingKidsShowNextAction(
    state: import('../../../engine/types').MatchState<import('../domain/types').SmashUpCore>,
    playerId: string,
    baseIndex: number,
    timestamp: number,
    excludeUid?: string,
): { state: typeof state; events: SmashUpEvent[] } {
    const base = state.core.bases[baseIndex];
    if (!base) return { state, events: [] };
    const actionCards: { uid: string; defId: string; ownerId: string; label: string }[] = [];
    for (const ongoing of base.ongoingActions) {
        if (ongoing.uid === excludeUid) continue;
        const def = getCardDef(ongoing.defId);
        actionCards.push({ uid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId, label: def?.name ?? ongoing.defId });
    }
    for (const m of base.minions) {
        for (const attached of m.attachedActions) {
            if (attached.uid === excludeUid) continue;
            const def = getCardDef(attached.defId);
            const mDef = getCardDef(m.defId);
            actionCards.push({ uid: attached.uid, defId: attached.defId, ownerId: attached.ownerId, label: `${def?.name ?? attached.defId}（附着在 ${mDef?.name ?? m.defId} 上）` });
        }
    }
    if (actionCards.length === 0) return { state, events: [] };
    const options = [
        { id: 'skip', label: '跳过（不再消灭）', value: { skip: true } },
        ...actionCards.map((c, i) => ({
            id: `action-${i}`, label: c.label, value: { cardUid: c.uid, defId: c.defId, ownerId: c.ownerId }, _source: 'ongoing' as const,
        })),
    ];
    const next = createSimpleChoice(
        `miskatonic_those_meddling_kids_select_${timestamp}`, playerId,
        '多管闲事的小鬼：点击要消灭的行动卡（可选）', options as any[],
        { sourceId: 'miskatonic_those_meddling_kids_select', targetType: 'ongoing' },
    );
    (next.data as any).continuationContext = { baseIndex };
    return { state: queueInteraction(state, next), events: [] };
}

export function registerMiskatonicInteractionHandlers(): void {
    // 教授的交互处理器已移除（教授现在是 talent，不需要选择目标）
    // 它可能有用的交互处理器已移除（不再需要选择随从，改为全体+1力量）

    // 金克丝!：从手牌/弃牌堆返回疯狂卡到疯狂牌库
    registerInteractionHandler('miskatonic_book_of_iter_the_unseen', (state, playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        const { source, count, handCount, discardCount } = value as { source: string; count?: number; handCount?: number; discardCount?: number };
        const player = state.core.players[playerId];
        const events: SmashUpEvent[] = [];

        if (source === 'hand') {
            const madnessCards = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
            const toReturn = madnessCards.slice(0, count ?? 1);
            for (const card of toReturn) {
                events.push(returnMadnessCard(playerId, card.uid, 'miskatonic_book_of_iter_the_unseen', timestamp));
            }
        } else if (source === 'discard') {
            const madnessCards = player.discard.filter(c => c.defId === MADNESS_CARD_DEF_ID);
            const toReturn = madnessCards.slice(0, count ?? 1);
            for (const card of toReturn) {
                events.push(returnMadnessCard(playerId, card.uid, 'miskatonic_book_of_iter_the_unseen', timestamp));
            }
        } else if (source === 'mixed') {
            // 手牌1张 + 弃牌堆1张
            // 注意：handler 执行时状态可能已变（前序交互消耗了疯狂卡），需降级处理而非静默跳过
            const handMadness = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
            const discardMadness = player.discard.filter(c => c.defId === MADNESS_CARD_DEF_ID);
            const wantHand = handCount ?? 1;
            const wantDiscard = discardCount ?? 1;
            // 优先满足 mixed，不足时降级：从有牌的来源补足
            const actualFromHand = Math.min(wantHand, handMadness.length);
            const actualFromDiscard = Math.min(wantDiscard, discardMadness.length);
            for (let i = 0; i < actualFromHand; i++) {
                events.push(returnMadnessCard(playerId, handMadness[i].uid, 'miskatonic_book_of_iter_the_unseen', timestamp));
            }
            for (let i = 0; i < actualFromDiscard; i++) {
                events.push(returnMadnessCard(playerId, discardMadness[i].uid, 'miskatonic_book_of_iter_the_unseen', timestamp));
            }
        }
        return { state, events };
    });

    // 最好不知道的事：选择随从后，创建第二步交互（选择抽几张疯狂卡）
    registerInteractionHandler('miskatonic_mandatory_reading', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const result = buildMandatoryReadingDrawInteraction(state, playerId, minionUid, baseIndex, timestamp);
        return { state: result.matchState ?? state, events: result.events };
    });

    // 最好不知道的事：选择抽取疯狂卡数量后，抽疯狂卡+给随从加力量
    registerInteractionHandler('miskatonic_mandatory_reading_draw', (state, playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        const { count, minionUid, baseIndex } = value as { count: number; minionUid: string; baseIndex: number };
        const events: SmashUpEvent[] = [];
        // 一次性抽 count 张疯狂卡（传 count 而非循环调用，避免 nextUid 不递增导致重复 UID）
        const madnessEvt = drawMadnessCards(playerId, count, state.core, 'miskatonic_mandatory_reading', timestamp);
        if (madnessEvt) events.push(madnessEvt);
        // 每抽1张，该随从+2力量（永久）
        events.push(addPowerCounter(minionUid, baseIndex, count * 2, 'miskatonic_mandatory_reading', timestamp));
        return { state, events };
    });

    // 这些多管闲事的小鬼：选择基地后→点击式逐个消灭行动卡
    registerInteractionHandler('miskatonic_those_meddling_kids', (state, playerId, value, _iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        return meddlingKidsShowNextAction(state, playerId, baseIndex, timestamp);
    });

    // 这些多管闲事的小鬼：点击消灭一张行动卡后，继续显示下一张（带跳过）
    registerInteractionHandler('miskatonic_those_meddling_kids_select', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string; ownerId?: string };
        if (selected.skip) return { state, events: [] };
        const { cardUid: ongoingUid, defId, ownerId } = selected;
        if (!ongoingUid) return { state, events: [] };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number } | undefined;
        const events: SmashUpEvent[] = [{
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: { cardUid: ongoingUid, defId: defId!, ownerId: ownerId!, reason: 'miskatonic_those_meddling_kids' },
            timestamp,
        } as OngoingDetachedEvent];
        // 继续显示剩余行动卡（排除刚消灭的）
        if (ctx) {
            const result = meddlingKidsShowNextAction(state, playerId, ctx.baseIndex, timestamp, ongoingUid);
            if (result.state !== state) {
                return { state: result.state, events };
            }
        }
        return { state, events };
    });

    // 老詹金斯!?的交互处理器已移除（改为 special，resolveOrPrompt 自动处理）

    // 心理学家：选择疯狂卡返回疯狂牌库（可跳过）
    registerInteractionHandler('miskatonic_psychologist', (state, playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        
        const { source } = value as { source: 'hand' | 'discard' };
        const player = state.core.players[playerId];
        
        // 从对应来源找第一张疯狂卡
        const madnessCards = source === 'hand' ? player.hand : player.discard;
        const madnessCard = madnessCards.find(c => c.defId === MADNESS_CARD_DEF_ID);
        
        if (!madnessCard) return { state, events: [] };
        
        return { state, events: [returnMadnessCard(playerId, madnessCard.uid, 'miskatonic_psychologist', timestamp)] };
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
        const cardUids = selectedCards.map(v => v.cardUid).filter(Boolean) as string[];
        // 跳过：没有有效卡牌（如点了跳过按钮）
        if (cardUids.length === 0) return { state, events: [] };
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
