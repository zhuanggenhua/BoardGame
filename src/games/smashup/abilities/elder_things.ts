/**
 * 大杀四方 - 远古之物派系能力
 *
 * 主题：疯狂卡操控、惩罚持有疯狂卡的对手?
 * 克苏鲁扩展派系，核心机制围绕 Madness 牌库底
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    drawMadnessCards,
    grantExtraAction,
    grantExtraMinion,
    destroyMinion,
    getMinionPower,
    buildMinionTargetOptions,
    addPowerCounter,
    revealHand,
    buildAbilityFeedback,
    buildValidatedCardToDeckBottomEvents,
} from '../domain/abilityHelpers';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    CardsDrawnEvent,
    CardsDiscardedEvent,
    DeckReshuffledEvent,
    MinionCardDef,
    MinionOnBase,
} from '../domain/types';
import { drawCards, matchesDefId } from '../domain/utils';
import { getFactionCards, getCardDef, getBaseDef } from '../data/cards';
import { registerTrigger, registerProtection } from '../domain/ongoingEffects';
import type { TriggerContext, ProtectionCheckContext } from '../domain/ongoingEffects';
import { getPlayerEffectivePowerOnBase } from '../domain/ongoingModifiers';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { isMinionProtectedNonConsumable } from '../domain/ongoingEffects';
import { filterProtectedDestroyEvents } from '../domain/reducer';

/** 注册远古之物派系所有能力*/
function getOrderedOpponentIds(state: SmashUpCore, playerId: string): string[] {
    const self = String(playerId);
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (const rawPid of state.turnOrder as unknown[]) {
        const pid = String(rawPid);
        if (pid === self) continue;
        if (seen.has(pid)) continue;
        if (!state.players[pid]) continue;
        seen.add(pid);
        ordered.push(pid);
    }

    if (ordered.length > 0) return ordered;
    return Object.keys(state.players).filter(pid => pid !== self);
}

export function registerElderThingAbilities(): void {
    // 拜亚基?onPlay：如果其他玩家有随从在本基地，抽一张疯狂卡
    registerAbility('elder_thing_byakhee', 'onPlay', elderThingByakhee);
    // ??onPlay：每个对手可抽疯狂卡，不收回抽的让你抽一张牌（MVP：对手全部抽疯狂卡）
    registerAbility('elder_thing_mi_go', 'onPlay', elderThingMiGo);
    // 精神错乱（行动卡）：每个对手抽两张疯狂卡
    registerAbility('elder_thing_insanity', 'onPlay', elderThingInsanity);
    // 疯狂接触（行动卡）：每个对手抽一张疯狂卡，你抽一张牌并额外打出一张行动
    registerAbility('elder_thing_touch_of_madness', 'onPlay', elderThingTouchOfMadness);
    // 疯狂之力（行动卡）：所有对手弃掉手牌中的疯狂卡并洗弃牌堆回牌库
    registerAbility('elder_thing_power_of_madness', 'onPlay', elderThingPowerOfMadness);
    // 散播恐怖（行动卡）：每位对手随机弃牌直到弃出非疯狂卡?
    registerAbility('elder_thing_spreading_horror', 'onPlay', elderThingSpreadingHorror);
    // 开始召唤（行动卡）：弃牌堆随从放牌库顶 + 额外行动
    registerAbility('elder_thing_begin_the_summoning', 'onPlay', elderThingBeginTheSummoning);
    // 深不收回可测的目的（行动卡）：对手展示手牌，有疯狂卡的必须消灭一个随从
    registerAbility('elder_thing_unfathomable_goals', 'onPlay', elderThingUnfathomableGoals);

    // 远古之物 onPlay：消灭两个己方随从或放牌库底 + 不收回受对手影响
    registerAbility('elder_thing_elder_thing', 'onPlay', elderThingElderThingOnPlay);
    // 修格斯?onPlay：对手选择抽疯狂卡或被消灭随从
    registerAbility('elder_thing_shoggoth', 'onPlay', elderThingShoggoth);

    // === POD 版本 ===
    registerAbility('elder_thing_elder_thing_pod', 'onPlay', elderThingElderThingPodOnPlay);
    registerAbility('elder_thing_shoggoth_pod', 'onPlay', elderThingShoggothPod);
    registerAbility('elder_thing_mi_go_pod', 'onPlay', elderThingMiGoPod);
    registerAbility('elder_thing_byakhee_pod', 'onPlay', elderThingByakheePod);

    registerAbility('elder_thing_begin_the_summoning_pod', 'onPlay', elderThingBeginTheSummoningPod);
    registerAbility('elder_thing_dunwich_horror_pod', 'onPlay', elderThingDunwichHorrorPodOnPlay);
    registerAbility('elder_thing_insanity_pod', 'onPlay', elderThingInsanityPod);
    registerAbility('elder_thing_power_of_madness_pod', 'onPlay', elderThingPowerOfMadnessPod);
    registerAbility('elder_thing_spreading_horror_pod', 'onPlay', elderThingSpreadingHorrorPod);
    registerAbility('elder_thing_the_price_of_power_pod', 'special', elderThingPriceOfPowerPodSpecial);
    registerAbility('elder_thing_unfathomable_goals_pod', 'onPlay', elderThingUnfathomableGoalsPod);
    registerAbility('elder_thing_touch_of_madness_pod', 'onPlay', elderThingTouchOfMadnessPod);

    // Dunwich Horror POD：before scoring trigger (mandatory)
    registerTrigger('elder_thing_dunwich_horror_pod', 'beforeScoring', elderThingDunwichHorrorPodBeforeScoring, { mandatory: true });
    // POD 版不会“回合结束自动消灭”，这里显式注册 no-op，阻止 alias 继承原版 onTurnEnd 触发。
    registerTrigger('elder_thing_dunwich_horror_pod', 'onTurnEnd', elderThingDunwichHorrorPodOnTurnEndNoop);

    // 远古之物 POD：不受对手卡牌影响
    registerProtection('elder_thing_elder_thing_pod', 'destroy', elderThingPodProtectionChecker);
    registerProtection('elder_thing_elder_thing_pod', 'move', elderThingPodProtectionChecker);
    registerProtection('elder_thing_elder_thing_pod', 'affect', elderThingPodProtectionChecker);

    // === ongoing 效果注册 ===
    // 郦威奇恐怖：回合结束时消灭附着了此卡的随从
    registerTrigger('elder_thing_dunwich_horror', 'onTurnEnd', elderThingDunwichHorrorTrigger);
    // 力量的代价：基地计分前按对手疑狂卡数给己方随从力量
    registerAbility('elder_thing_the_price_of_power', 'special', elderThingPriceOfPowerSpecial);
    // 远古之物：不收回受对手卡牌影响（保护 destroy + move?
    registerProtection('elder_thing_elder_thing', 'destroy', elderThingProtectionChecker);
    registerProtection('elder_thing_elder_thing', 'move', elderThingProtectionChecker);
    registerProtection('elder_thing_elder_thing', 'affect', elderThingProtectionChecker);
}

/** 拜亚基?onPlay：如果其他玩家有随从在本基地，抽一张疯狂卡 */
function elderThingByakhee(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    const hasOpponentMinion = base.minions.some(
        m => m.controller !== ctx.playerId && m.uid !== ctx.cardUid
    );
    if (!hasOpponentMinion) return { events: [] };

    const evt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'elder_thing_byakhee', ctx.now);
    return { events: evt ? [evt] : [] };
}

/**
 * 米-格 onPlay：每个其他玩家可以抽一张疯狂卡。每个不这样做的玩家，都能让你抽一张卡。
 * "可以" → 每个对手需要选择是否抽疯狂卡，链式处理
 */
function elderThingMiGo(ctx: AbilityContext): AbilityResult {
    const opponents = getOrderedOpponentIds(ctx.state, ctx.playerId);
    if (opponents.length === 0) return { events: [] };

    // 链式处理：第一个对手选择
    const options = [
        { id: 'draw_madness', label: '抽一张疯狂卡', value: { choice: 'draw_madness' }, displayMode: 'button' as const },
        { id: 'decline', label: '拒绝（让对方抽一张牌）', value: { choice: 'decline' }, displayMode: 'button' as const },
    ];
    const interaction = createSimpleChoice(
        `elder_thing_mi_go_${opponents[0]}_${ctx.now}`, opponents[0],
        '米-格：你可以抽一张疯狂卡，否则对方抽一张牌', options as any[],
        { sourceId: 'elder_thing_mi_go', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = {
        casterPlayerId: ctx.playerId,
        opponents,
        opponentIdx: 0,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 精神错乱 onPlay：每个对手抽两张疯狂卡?*/
function elderThingInsanity(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const evt = drawMadnessCards(pid, 2, ctx.state, 'elder_thing_insanity', ctx.now);
        if (evt) events.push(evt);
    }
    return { events };
}

/** 疯狂接触 onPlay：每个对手抽一张疯狂卡，你抽一张牌并额外打出一张行动*/
function elderThingTouchOfMadness(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // 对手各抽一张疯狂卡
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const evt = drawMadnessCards(pid, 1, ctx.state, 'elder_thing_touch_of_madness', ctx.now);
        if (evt) events.push(evt);
    }

    // 你抽一张牌
    const player = ctx.state.players[ctx.playerId];
    const { drawnUids } = drawCards(player, 1, ctx.random);
    if (drawnUids.length > 0) {
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: 1, cardUids: drawnUids },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }

    // 额外打出一张行动
    events.push(grantExtraAction(ctx.playerId, 'elder_thing_touch_of_madness', ctx.now));

    return { events };
}

/** 疯狂之力 onPlay：所有对手展示手牌，弃掉手牌中的疯狂卡并洗弃牌堆回牌库 */
function elderThingPowerOfMadness(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // 收集所有对手的手牌用于合并展示（避免多人时多次展示覆盖）
    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];

    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];

        // 收集对手手牌（规则："所有其他玩家展示他们的手牌"）
        if (opponent.hand.length > 0) {
            revealTargetIds.push(pid);
            for (const c of opponent.hand) {
                allRevealCards.push({ uid: c.uid, defId: c.defId });
            }
        }

        // 找出手牌中的疯狂卡
        const madnessInHand = opponent.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
        if (madnessInHand.length > 0) {
            const discardEvt: CardsDiscardedEvent = {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: pid, cardUids: madnessInHand.map(c => c.uid) },
                timestamp: ctx.now,
            };
            events.push(discardEvt);
        }

        // 洗弃牌堆回牌库（包括刚弃掉的疯狂卡）
        const allDiscardCards = [...opponent.discard, ...madnessInHand];
        if (allDiscardCards.length > 0) {
            const newDeck = ctx.random.shuffle([...opponent.deck, ...allDiscardCards]);
            const reshuffleEvt: DeckReshuffledEvent = {
                type: SU_EVENTS.DECK_RESHUFFLED,
                payload: { playerId: pid, deckUids: newDeck.map(c => c.uid) },
                timestamp: ctx.now,
            };
            events.push(reshuffleEvt);
        }
    }

    // 合并展示所有对手手牌（一个事件，避免多人覆盖）
    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.unshift(revealHand(targetIds, 'all', allRevealCards, 'elder_thing_power_of_madness', ctx.now, ctx.playerId));
    }

    return { events };
}


/** 散播恐惧?onPlay：每位对手随机弃牌直到弃出一张非疯狂卡?*/
function elderThingSpreadingHorror(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (opponent.hand.length === 0) continue;

        // 随机排列手牌，依次弃掉直到弃出非疯狂卡?
        const shuffledHand = ctx.random.shuffle([...opponent.hand]);
        const discardUids: string[] = [];
        for (const card of shuffledHand) {
            discardUids.push(card.uid);
            if (card.defId !== MADNESS_CARD_DEF_ID) break; // 弃出非疯狂卡，停止?
        }

        if (discardUids.length > 0) {
            const discardEvt: CardsDiscardedEvent = {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: pid, cardUids: discardUids },
                timestamp: ctx.now,
            };
            events.push(discardEvt);
        }
    }

    return { events };
}

/** 开始召唤?onPlay：从弃牌堆选一个随从放牌库底+ 额外行动 */
function elderThingBeginTheSummoning(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];
    const minionsInDiscard = player.discard.filter(c => c.type === 'minion');

    if (minionsInDiscard.length === 0) {
        // 没有随从可选，仍给额外行动，但提示弃牌堆为空
        events.push(buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now));
        events.push(grantExtraAction(ctx.playerId, 'elder_thing_begin_the_summoning', ctx.now));
        return { events };
    }
    // Prompt 选择
    const options = minionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } , _source: 'discard' as const, displayMode: 'card' as const };
    });
    const interaction = createSimpleChoice(
        `elder_thing_begin_the_summoning_${ctx.now}`, ctx.playerId,
        '选择要放到牌库顶的随从', options as any[],
        { sourceId: 'elder_thing_begin_the_summoning', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 深不可测的目的 onPlay：对手展示手牌，有疯狂卡的必须消灭一个自己的随从 */
function elderThingUnfathomableGoals(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // 先收集所有对手手牌，合并成一个展示事件（避免多人覆盖）
    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (opponent.hand.length > 0) {
            revealTargetIds.push(pid);
            for (const c of opponent.hand) {
                allRevealCards.push({ uid: c.uid, defId: c.defId });
            }
        }
    }
    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.push(revealHand(targetIds, 'all', allRevealCards, 'elder_thing_unfathomable_goals', ctx.now, ctx.playerId));
    }

    // 收集所有有疯狂卡的对手，按顺序处理
    const opponentsWithMadness: string[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (opponent.hand.some(c => c.defId === MADNESS_CARD_DEF_ID)) {
            opponentsWithMadness.push(pid);
        }
    }

    // 链式处理：处理第一个对手，剩余的通过 continuationContext 传递
    return unfathomableGoalsProcessNext(ctx, events, opponentsWithMadness, 0);
}

/** 深不可测的目的：链式处理对手消灭随从 */
function unfathomableGoalsProcessNext(
    ctx: AbilityContext,
    events: SmashUpEvent[],
    opponents: string[],
    idx: number,
): AbilityResult {
    while (idx < opponents.length) {
        const pid = opponents[idx];
        const opMinions: { uid: string; defId: string; baseIndex: number; owner: string; power: number }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            for (const m of ctx.state.bases[i].minions) {
                if (m.controller !== pid) continue;
                opMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, power: getMinionPower(ctx.state, m, i) });
            }
        }
        if (opMinions.length === 0) {
            idx++;
            continue;
        }
        if (opMinions.length === 1) {
            // 只有一个随从，直接消灭，继续下一个对手
            events.push(destroyMinion(opMinions[0].uid, opMinions[0].defId, opMinions[0].baseIndex, opMinions[0].owner, pid, 'elder_thing_unfathomable_goals', ctx.now));
            idx++;
            continue;
        }
        // 多个随从：让对手选择消灭哪个，剩余对手通过 continuationContext 链式处理
        const options = opMinions.map(m => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[m.baseIndex].defId);
            const baseName = baseDef?.name ?? `基地 ${m.baseIndex + 1}`;
            return { uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: `${name} (力量 ${m.power}) @ ${baseName}` };
        });
        const interaction = createSimpleChoice(
            `elder_thing_unfathomable_goals_${pid}_${ctx.now}`, pid,
            '你手中有疯狂卡，必须消灭一个自己的随从',
            buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: pid }),
            { sourceId: 'elder_thing_unfathomable_goals', targetType: 'minion' },
        );
        (interaction.data as any).continuationContext = {
            opponents,
            opponentIdx: idx,
        };
        return { events, matchState: queueInteraction(ctx.matchState, interaction) };
    }

    return { events };
}


// ============================================================================
// 远古之物 (Elder Thing) - onPlay + 保护
// ============================================================================

/** 远古之物保护检查：不收回受对手卡牌影响 */
function elderThingProtectionChecker(ctx: ProtectionCheckContext): boolean {
    // 只保护?elder_thing_elder_thing 自身，且只拦截对手发起的效果
    if (!matchesDefId(ctx.targetMinion.defId, 'elder_thing_elder_thing')) return false;
    return ctx.sourcePlayerId !== ctx.targetMinion.controller;
}

function elderThingPodProtectionChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.targetMinion.defId === 'elder_thing_elder_thing_pod';
}

// ============================================================================
// POD implementations
// ============================================================================

function elderThingByakheePod(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        if (!base.minions.some(m => m.controller === pid)) continue;
        const evt = drawMadnessCards(pid, 1, ctx.state, 'elder_thing_byakhee_pod', ctx.now);
        if (evt) events.push(evt);
    }
    return { events };
}

type PodYesNoChoiceValue = { choice: 'yes' } | { choice: 'no' };

function elderThingMiGoPod(ctx: AbilityContext): AbilityResult {
    const opponents = getOrderedOpponentIds(ctx.state, ctx.playerId);
    if (opponents.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `elder_thing_mi_go_pod_${opponents[0]}_${ctx.now}`,
        opponents[0],
        '米-格：你可以抽一张疯狂卡',
        [
            { id: 'yes', label: '抽一张疯狂卡', value: { choice: 'yes' }, displayMode: 'button' as const },
            { id: 'no', label: '不抽', value: { choice: 'no' }, displayMode: 'button' as const },
        ] as any[],
        { sourceId: 'elder_thing_mi_go_pod', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = {
        casterPlayerId: ctx.playerId,
        baseIndex: ctx.baseIndex,
        opponents,
        opponentIdx: 0,
        anyDrew: false,
        declinedCount: 0,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function elderThingShoggothPod(ctx: AbilityContext): AbilityResult {
    const opponents = getOrderedOpponentIds(ctx.state, ctx.playerId);
    if (opponents.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `elder_thing_shoggoth_pod_${opponents[0]}_${ctx.now}`,
        opponents[0],
        '修格斯：你可以抽一张疯狂卡',
        [
            { id: 'yes', label: '抽一张疯狂卡', value: { choice: 'yes' }, displayMode: 'button' as const },
            { id: 'no', label: '不抽', value: { choice: 'no' }, displayMode: 'button' as const },
        ] as any[],
        { sourceId: 'elder_thing_shoggoth_pod', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = {
        casterPlayerId: ctx.playerId,
        baseIndex: ctx.baseIndex,
        opponents,
        opponentIdx: 0,
        decliners: [] as string[],
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function elderThingElderThingPodOnPlay(ctx: AbilityContext): AbilityResult {
    const otherMinions: { uid: string; defId: string; baseIndex: number; owner: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            if (m.uid === ctx.cardUid) continue;
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            otherMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, label: def?.name ?? m.defId });
        }
    }
    const canDestroy = otherMinions.length >= 2;
    const interaction = createSimpleChoice(
        `elder_thing_elder_thing_pod_mode_${ctx.now}`,
        ctx.playerId,
        '远古之物：消灭两个你的其他随从，否则将其放到牌库底',
        [
            { id: 'destroy', label: '消灭两个你的其他随从', value: { mode: 'destroy' }, displayMode: 'button' as const, disabled: !canDestroy },
            { id: 'bottom', label: '将本随从放到牌库底', value: { mode: 'bottom' }, displayMode: 'button' as const },
        ] as any[],
        { sourceId: 'elder_thing_elder_thing_pod_mode', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = { cardUid: ctx.cardUid, baseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function elderThingBeginTheSummoningPod(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minionsInDiscard = player.discard.filter(c => c.type === 'minion');
    if (minionsInDiscard.length === 0) {
        return { events: [grantExtraAction(ctx.playerId, 'elder_thing_begin_the_summoning_pod', ctx.now)] };
    }
    const options = minionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId);
        return { id: `card-${i}`, label: def?.name ?? c.defId, value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const, _source: 'discard' as const };
    });
    const interaction = createSimpleChoice(
        `elder_thing_begin_the_summoning_pod_${ctx.now}`,
        ctx.playerId,
        '选择要放到牌库顶的随从',
        options as any[],
        { sourceId: 'elder_thing_begin_the_summoning_pod', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function elderThingDunwichHorrorPodOnPlay(ctx: AbilityContext): AbilityResult {
    // POD：+5 仅来自 ongoing 修正；onPlay 不应再额外叠加永久力量，避免与 ongoing 叠加成 +10。
    void ctx;
    return { events: [] };
}

function elderThingInsanityPod(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const evt = drawMadnessCards(pid, 2, ctx.state, 'elder_thing_insanity_pod', ctx.now);
        if (evt) events.push(evt);
    }
    // POD: Place this action in the box (remove from game) after resolving.
    events.push({
        type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
        payload: { playerId: ctx.playerId, cardUid: ctx.cardUid, defId: ctx.defId, reason: 'elder_thing_insanity_pod_box' },
        timestamp: ctx.now,
    });
    return { events };
}

function elderThingPowerOfMadnessPod(ctx: AbilityContext): AbilityResult {
    // Correct order (POD): name an action, then reveal hand, discard named copies, then shuffle discard into deck.
    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    if (opponents.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `elder_thing_power_of_madness_pod_${ctx.now}`,
        ctx.playerId,
        '疯狂之力：依次为每个对手选择一个要命名的战术',
        [
            { id: 'start', label: '开始', value: { start: true }, displayMode: 'button' as const },
        ],
        { sourceId: 'elder_thing_power_of_madness_pod_start', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = { opponents, idx: 0 };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function elderThingSpreadingHorrorPod(ctx: AbilityContext): AbilityResult {
    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    if (opponents.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `elder_thing_spreading_horror_pod_${opponents[0]}_${ctx.now}`,
        opponents[0],
        '散播恐怖：你可以弃置两张非疯狂卡',
        [
            { id: 'yes', label: '弃置两张非疯狂卡', value: { choice: 'yes' }, displayMode: 'button' as const },
            { id: 'no', label: '不弃置', value: { choice: 'no' }, displayMode: 'button' as const },
        ] as any[],
        { sourceId: 'elder_thing_spreading_horror_pod_opponent', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = { casterPlayerId: ctx.playerId, opponents, idx: 0, decliners: [] as string[] };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function elderThingUnfathomableGoalsPod(ctx: AbilityContext): AbilityResult {
    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    const events: SmashUpEvent[] = [];
    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];
    let anyTwoMadness = false;
    let totalMadness = 0;
    for (const pid of opponents) {
        const p = ctx.state.players[pid];
        if (p.hand.length > 0) {
            revealTargetIds.push(pid);
            for (const c of p.hand) allRevealCards.push({ uid: c.uid, defId: c.defId });
        }
        const count = p.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length;
        if (count >= 2) anyTwoMadness = true;
        totalMadness += count;
    }
    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.push(revealHand(targetIds, 'all', allRevealCards, 'elder_thing_unfathomable_goals_pod', ctx.now, ctx.playerId));
    }
    if (anyTwoMadness) events.push(grantExtraMinion(ctx.playerId, 'elder_thing_unfathomable_goals_pod', ctx.now));
    if (totalMadness >= 4) events.push(grantExtraAction(ctx.playerId, 'elder_thing_unfathomable_goals_pod', ctx.now));
    return { events };
}

function elderThingTouchOfMadnessPod(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const evt = drawMadnessCards(pid, 1, ctx.state, 'elder_thing_touch_of_madness_pod', ctx.now);
        if (evt) events.push(evt);
    }
    const player = ctx.state.players[ctx.playerId];
    const { drawnUids } = drawCards(player, 1, ctx.random);
    if (drawnUids.length > 0) {
        events.push({ type: SU_EVENTS.CARDS_DRAWN, payload: { playerId: ctx.playerId, count: 1, cardUids: drawnUids }, timestamp: ctx.now } as CardsDrawnEvent);
    }
    events.push(grantExtraAction(ctx.playerId, 'elder_thing_touch_of_madness_pod', ctx.now));
    return { events };
}

function elderThingPriceOfPowerPodSpecial(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const scoringBase = ctx.state.bases[ctx.baseIndex];
    const inBeforeScoringWindow = ctx.matchState.sys.phase === 'scoreBases'
        || ctx.matchState.sys.responseWindow?.current?.windowType === 'meFirst';

    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId).filter(pid => {
        if (!inBeforeScoringWindow) return true;
        return !!scoringBase?.minions.some(m => m.controller === pid);
    });

    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];
    let totalMadness = 0;
    for (const pid of opponents) {
        const p = ctx.state.players[pid];
        if (p.hand.length > 0) {
            revealTargetIds.push(pid);
            for (const c of p.hand) allRevealCards.push({ uid: c.uid, defId: c.defId });
        }
        totalMadness += p.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length;
    }

    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.push(revealHand(targetIds, 'all', allRevealCards, 'elder_thing_the_price_of_power_pod', ctx.now, ctx.playerId));
    }

    if (totalMadness === 0) return { events };

    const myMinions: Array<{ uid: string; baseIndex: number }> = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex++) {
        for (const m of ctx.state.bases[baseIndex].minions) {
            if (m.controller === ctx.playerId) {
                myMinions.push({ uid: m.uid, baseIndex });
            }
        }
    }
    if (myMinions.length === 0) return { events };

    // 目前沿用“自动分配”实现：按轮询分配每个 +1 指示物（后续可升级为逐次可选目标交互）。
    for (let i = 0; i < totalMadness; i++) {
        const target = myMinions[i % myMinions.length];
        events.push(addPowerCounter(target.uid, target.baseIndex, 1, 'elder_thing_the_price_of_power_pod', ctx.now));
    }
    return { events };
}

function elderThingDunwichHorrorPodBeforeScoring(ctx: TriggerContext): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: any } {
    const { state, baseIndex, now } = ctx;
    if (baseIndex === undefined) return [];
    if (!ctx.matchState) return [];
    const base = state.bases[baseIndex];
    if (!base) return [];

    // Find minions on this base with Dunwich Horror POD attached
    const targets: { controller: string; minionUid: string; minionDefId: string; ownerId: string }[] = [];
    for (const m of base.minions) {
        if (m.attachedActions.some(a => a.defId === 'elder_thing_dunwich_horror_pod')) {
            targets.push({ controller: m.controller, minionUid: m.uid, minionDefId: m.defId, ownerId: m.owner });
        }
    }
    if (targets.length === 0) return [];

    // Only handle one at a time (queue will re-trigger next scoring check if multiple)
    const t = targets[0];
    const interaction = createSimpleChoice(
        `elder_thing_dunwich_horror_pod_${t.minionUid}_${now}`,
        t.controller,
        '敦威治恐怖：抽两张疯狂卡，或者消灭该随从',
        [
            { id: 'draw', label: '抽两张疯狂卡', value: { choice: 'draw' }, displayMode: 'button' as const },
            { id: 'destroy', label: '消灭该随从', value: { choice: 'destroy' }, displayMode: 'button' as const },
        ] as any[],
        { sourceId: 'elder_thing_dunwich_horror_pod_choice', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = { baseIndex, ...t };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function elderThingDunwichHorrorPodOnTurnEndNoop(_ctx: TriggerContext): SmashUpEvent[] {
    return [];
}

/** 远古之物 onPlay：消灭两个己方其他随从或将本随从放到牌库底 */
function elderThingElderThingOnPlay(ctx: AbilityContext): AbilityResult {
    // 收集己方其他随从
    const otherMinions: { uid: string; defId: string; baseIndex: number; owner: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId && m.uid !== ctx.cardUid) {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const baseDef = getBaseDef(ctx.state.bases[i].defId);
                const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                otherMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, label: `${name} @ ${baseName}` });
            }
        }
    }

    // 始终显示选择界面，随从不足 2 个时"消灭"选项置灰
    const canDestroy = otherMinions.length >= 2;
    const options = [
        {
            id: 'destroy',
            label: canDestroy ? '消灭两个己方其他随从' : '消灭两个己方其他随从（随从不足）',
            value: { choice: 'destroy' },
            displayMode: 'button' as const,
            disabled: !canDestroy,
        },
        { 
            id: 'deckbottom', 
            label: '将本随从放到牌库底', 
            value: { choice: 'deckbottom' },
            displayMode: 'button' as const,
        },
    ];
    const interaction = createSimpleChoice(
        `elder_thing_elder_thing_choice_${ctx.now}`, ctx.playerId,
        '选择远古之物的效果', options as any[],
        { sourceId: 'elder_thing_elder_thing_choice', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = { cardUid: ctx.cardUid, defId: ctx.defId, baseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// 修格斯?(Shoggoth) - onPlay
// ============================================================================

/** 修格斯 onPlay：每个对手可抽疯狂卡，不收回抽则消灭该对手在此基地的一个随从*/
function elderThingShoggoth(ctx: AbilityContext): AbilityResult {
    // 前置条件：你只能将这张卡打到你至少拥有6点力量的基地
    const base = ctx.state.bases[ctx.baseIndex];
    if (base) {
        const playerPower = getPlayerEffectivePowerOnBase(ctx.state, base, ctx.baseIndex, ctx.playerId);
        if (playerPower < 6) return { events: [] };
    }

    const opponents = getOrderedOpponentIds(ctx.state, ctx.playerId);
    if (opponents.length === 0) return { events: [] };

    const options = [
        { id: 'draw_madness', label: '抽一张疯狂卡', value: { choice: 'draw_madness' }, displayMode: 'button' as const },
        { id: 'decline', label: '拒绝（被消灭一个随从）', value: { choice: 'decline' }, displayMode: 'button' as const },
    ];
    const interaction = createSimpleChoice(
        `elder_thing_shoggoth_opponent_${ctx.now}`, opponents[0],
        '修格斯：你可以抽一张疯狂卡，否则你在此基地的一个随从将被消灭', options as any[],
        { sourceId: 'elder_thing_shoggoth_opponent', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = {
        casterPlayerId: ctx.playerId,
        targetPlayerId: opponents[0],
        baseIndex: ctx.baseIndex,
        opponents,
        opponentIdx: 0,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// 交互解决处理函数
// ============================================================================

/** 修格斯链式处理：继续询问下一个对手 */
function shoggothContinueChain(
    state: any, events: SmashUpEvent[],
    ctx: { casterPlayerId: string; baseIndex: number; opponents: string[]; opponentIdx: number },
    timestamp: number,
): { state: any; events: SmashUpEvent[] } {
    const nextIdx = ctx.opponentIdx + 1;
    if (nextIdx < ctx.opponents.length) {
        const nextPid = ctx.opponents[nextIdx];
        const options = [
            { id: 'draw_madness', label: '抽一张疯狂卡', value: { choice: 'draw_madness' }, displayMode: 'button' as const },
            { id: 'decline', label: '拒绝（被消灭一个随从）', value: { choice: 'decline' }, displayMode: 'button' as const },
        ];
        const interaction = createSimpleChoice(
            `elder_thing_shoggoth_opponent_${nextIdx}_${timestamp}`, nextPid,
            '修格斯：你可以抽一张疯狂卡，否则你在此基地的一个随从将被消灭', options as any[],
            { sourceId: 'elder_thing_shoggoth_opponent', targetType: 'button' },
        );
        (interaction.data as any).continuationContext = {
            casterPlayerId: ctx.casterPlayerId,
            targetPlayerId: nextPid,
            baseIndex: ctx.baseIndex,
            opponents: ctx.opponents,
            opponentIdx: nextIdx,
        };
        return { state: queueInteraction(state, interaction), events };
    }
    return { state, events };
}

function queueSpreadingHorrorPodMayPlay(
    state: any,
    ctx: { casterPlayerId: string; remaining: number; usedBases: number[] },
    timestamp: number,
): { state: any; events: SmashUpEvent[] } {
    if (ctx.remaining <= 0) return { state, events: [] };

    const player = state.core.players[ctx.casterPlayerId];
    const hasPlayableDiscardMinion = player.discard.some((c: any) => {
        if (c.type !== 'minion') return false;
        const def = getCardDef(c.defId) as any;
        return def?.type === 'minion' && def.power <= 3;
    });
    const hasAvailableBase = state.core.bases.some((_b: any, i: number) => !ctx.usedBases.includes(i));

    // 没有可打出的随从或没有可选基地：该次机会自动跳过，继续下一个“可选打出”机会。
    if (!hasPlayableDiscardMinion || !hasAvailableBase) {
        return queueSpreadingHorrorPodMayPlay(state, { ...ctx, remaining: ctx.remaining - 1 }, timestamp);
    }

    const interaction = createSimpleChoice(
        `elder_thing_spreading_horror_pod_may_${timestamp}_${ctx.remaining}`,
        ctx.casterPlayerId,
        '散播恐怖：你可以从弃牌堆打出一个战斗力≤3的随从',
        [
            { id: 'yes', label: '打出一个随从', value: { choice: 'yes' }, displayMode: 'button' as const },
            { id: 'no', label: '不打出', value: { choice: 'no' }, displayMode: 'button' as const },
        ] as any[],
        { sourceId: 'elder_thing_spreading_horror_pod_may_play', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = ctx;
    return { state: queueInteraction(state, interaction), events: [] };
}

/** 注册远古之物派系的交互解决处理函数 */
export function registerElderThingInteractionHandlers(): void {
    // 米-格：对手选择是否抽疯狂卡（链式处理）
    registerInteractionHandler('elder_thing_mi_go', (state, _playerId, value, iData, _random, timestamp) => {
        const { choice } = value as { choice: string };
        const ctx = (iData as any)?.continuationContext as { casterPlayerId: string; opponents: string[]; opponentIdx: number };
        if (!ctx) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        const currentOpponent = ctx.opponents[ctx.opponentIdx];

        if (choice === 'draw_madness') {
            const evt = drawMadnessCards(currentOpponent, 1, state.core, 'elder_thing_mi_go', timestamp);
            if (evt) events.push(evt);
        } else {
            // 对手拒绝 → 施法者抽一张牌
            const caster = state.core.players[ctx.casterPlayerId];
            if (caster && caster.deck.length > 0) {
                const drawnUid = caster.deck[0].uid;
                events.push({
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId: ctx.casterPlayerId, count: 1, cardUids: [drawnUid] },
                    timestamp,
                } as CardsDrawnEvent);
            }
        }

        // 链式处理下一个对手
        const nextIdx = ctx.opponentIdx + 1;
        if (nextIdx < ctx.opponents.length) {
            const nextPid = ctx.opponents[nextIdx];
            const options = [
                { id: 'draw_madness', label: '抽一张疯狂卡', value: { choice: 'draw_madness' }, displayMode: 'button' as const },
                { id: 'decline', label: '拒绝（让对方抽一张牌）', value: { choice: 'decline' }, displayMode: 'button' as const },
            ];
            const interaction = createSimpleChoice(
                `elder_thing_mi_go_${nextPid}_${timestamp}`, nextPid,
                '米-格：你可以抽一张疯狂卡，否则对方抽一张牌', options as any[],
                { sourceId: 'elder_thing_mi_go', targetType: 'button' },
            );
            (interaction.data as any).continuationContext = {
                casterPlayerId: ctx.casterPlayerId,
                opponents: ctx.opponents,
                opponentIdx: nextIdx,
            };
            return { state: queueInteraction(state, interaction), events };
        }

        return { state, events };
    });

    registerInteractionHandler('elder_thing_begin_the_summoning', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string };
        const player = state.core.players[playerId];
        // DECK_REORDERED：将弃牌堆中的随从放到牌库顶，reducer 会自动从弃牌堆移除
        const newDeckUids = [cardUid, ...player.deck.map(c => c.uid)];
        return { state, events: [
            { type: SU_EVENTS.DECK_REORDERED, payload: { playerId, deckUids: newDeckUids }, timestamp },
            grantExtraAction(playerId, 'elder_thing_begin_the_summoning', timestamp),
        ] };
    });

    registerInteractionHandler('elder_thing_elder_thing_choice', (state, playerId, value, iData, _random, timestamp) => {
        const { choice } = value as { choice: string };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; defId: string; baseIndex: number };
        if (!ctx) return { state, events: [] };

        if (choice === 'deckbottom') {
            return {
                state,
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: ctx.cardUid,
                    defId: ctx.defId,
                    ownerId: playerId,
                    reason: 'elder_thing_elder_thing',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }

        // choice === 'destroy' → 选择两个目标；只有两者都能被成功消灭时才消灭，否则远古之物进牌库底且不消灭任何随从（FAQ）。
        const myMinions: { minion: MinionOnBase; baseIndex: number }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            for (const m of state.core.bases[i].minions) {
                if (m.controller === playerId && m.uid !== ctx.cardUid) {
                    myMinions.push({ minion: m, baseIndex: i });
                }
            }
        }
        
        // 恰好 2 个随从：无需选择，但要先检查是否“都能被成功消灭”
        if (myMinions.length === 2) {
            const [a, b] = myMinions;
            const proposed: SmashUpEvent[] = [
                destroyMinion(a.minion.uid, a.minion.defId, a.baseIndex, a.minion.owner, playerId, 'elder_thing_elder_thing', timestamp),
                destroyMinion(b.minion.uid, b.minion.defId, b.baseIndex, b.minion.owner, playerId, 'elder_thing_elder_thing', timestamp),
            ];
            const filtered = filterProtectedDestroyEvents(proposed, state.core, playerId);
            const destroyCount = filtered.filter(e => e.type === SU_EVENTS.MINION_DESTROYED).length;
            if (destroyCount < 2) {
                return {
                    state,
                    events: buildValidatedCardToDeckBottomEvents(state, {
                        cardUid: ctx.cardUid,
                        defId: ctx.defId,
                        ownerId: playerId,
                        reason: 'elder_thing_elder_thing_failed_destroy',
                        now: timestamp,
                        expectedLocation: 'bases',
                    }),
                };
            }
            return { state, events: proposed };
        }
        
        // >2 个随从时：让玩家点击第一个要消灭的随从
        const options = myMinions.map(({ minion: m, baseIndex: bi }) => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(state.core.bases[bi].defId);
            const baseName = baseDef?.name ?? `基地 ${bi + 1}`;
            const power = getMinionPower(state.core, m, bi);
            return { uid: m.uid, defId: m.defId, baseIndex: bi, label: `${name} (力量 ${power}) @ ${baseName}` };
        });
        const interaction = createSimpleChoice(
            `elder_thing_elder_thing_destroy_first_${timestamp}`, playerId,
            '远古之物：点击第一个要消灭的随从', buildMinionTargetOptions(options, { state: state.core, sourcePlayerId: playerId }),
            { sourceId: 'elder_thing_elder_thing_destroy_first', targetType: 'minion' }
        );
        (interaction.data as any).continuationContext = { elderThingUid: ctx.cardUid, elderThingDefId: ctx.defId };
        return { state: queueInteraction(state, interaction), events: [] };
    });

    // 远古之物：玩家点击第一个要消灭的随从
    registerInteractionHandler('elder_thing_elder_thing_destroy_first', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number; defId: string };
        const cont = (iData as any)?.continuationContext as { elderThingUid: string; elderThingDefId: string } | undefined;
        if (!cont?.elderThingUid || !cont?.elderThingDefId) return { state, events: [] };
        const base = state.core.bases[baseIndex];
        const target = base?.minions.find(m => m.uid === minionUid);
        if (!target) return { state, events: [] };

        // 第二步：让玩家选择第二个目标（先不消灭任何随从，避免“只消灭 1 个”的非法中间态）
        const candidates: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            for (const m of state.core.bases[i].minions) {
                if (m.controller !== playerId) continue;
                if (m.uid === minionUid) continue;
                if (matchesDefId(m.defId, 'elder_thing_elder_thing')) continue;
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const baseDef = getBaseDef(state.core.bases[i].defId);
                const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                const power = getMinionPower(state.core, m, i);
                candidates.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
            }
        }

        if (candidates.length === 0) {
            // 理论上不该发生（前面已保证至少 2 个其他随从），兜底：失败 → 远古之物进牌库底
            return {
                state,
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: cont.elderThingUid,
                    defId: cont.elderThingDefId,
                    ownerId: playerId,
                    reason: 'elder_thing_elder_thing_failed_destroy',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }

        const interaction = createSimpleChoice(
            `elder_thing_elder_thing_destroy_second_${timestamp}`,
            playerId,
            '远古之物：点击第二个要消灭的随从',
            buildMinionTargetOptions(candidates, { state: state.core, sourcePlayerId: playerId }),
            { sourceId: 'elder_thing_elder_thing_destroy_second', targetType: 'minion' }
        );
        (interaction.data as any).continuationContext = {
            elderThingUid: cont.elderThingUid,
            elderThingDefId: cont.elderThingDefId,
            first: { minionUid, baseIndex, defId: target.defId },
        };
        return { state: queueInteraction(state, interaction), events: [] };
    });
    
    // 远古之物：玩家点击第二个要消灭的随从
    registerInteractionHandler('elder_thing_elder_thing_destroy_second', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex, defId } = value as { minionUid: string; baseIndex: number; defId: string };
        const base = state.core.bases[baseIndex];
        const target = base?.minions.find(m => m.uid === minionUid);
        if (!target) return { state, events: [] };

        const cont = (iData as any)?.continuationContext as { elderThingUid?: string; elderThingDefId?: string; first?: { minionUid: string; baseIndex: number; defId: string } } | undefined;
        const first = cont?.first;
        if (!first) return { state, events: [] };

        const firstBase = state.core.bases[first.baseIndex];
        const firstMinion = firstBase?.minions.find(m => m.uid === first.minionUid);
        if (!firstMinion) return { state, events: [] };

        const proposed: SmashUpEvent[] = [
            destroyMinion(firstMinion.uid, firstMinion.defId, first.baseIndex, firstMinion.owner, playerId, 'elder_thing_elder_thing', timestamp),
            destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'elder_thing_elder_thing', timestamp),
        ];
        const filtered = filterProtectedDestroyEvents(proposed, state.core, playerId);
        const destroyCount = filtered.filter(e => e.type === SU_EVENTS.MINION_DESTROYED).length;
        if (destroyCount < 2) {
            // 失败：远古之物进牌库底，且不消灭任何随从
            if (!cont?.elderThingUid || !cont?.elderThingDefId) return { state, events: [] };
            return {
                state,
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: cont.elderThingUid,
                    defId: cont.elderThingDefId,
                    ownerId: playerId,
                    reason: 'elder_thing_elder_thing_failed_destroy',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }

        return { state, events: proposed };
    });

    registerInteractionHandler('elder_thing_shoggoth_opponent', (state, _playerId, value, iData, _random, timestamp) => {
        const { choice } = value as { choice: string };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number; opponents: string[]; opponentIdx: number; targetPlayerId: string; casterPlayerId: string };
        if (!ctx) return { state, events: [] };
        const events: SmashUpEvent[] = [];

        if (choice === 'draw_madness') {
            const evt = drawMadnessCards(ctx.targetPlayerId, 1, state.core, 'elder_thing_shoggoth', timestamp);
            if (evt) events.push(evt);
        } else {
            // 对手拒绝抽疯狂卡 → 由修格斯控制者选择消灭该对手在此基地的一个随从
            const base = state.core.bases[ctx.baseIndex];
            if (base) {
                const opMinions = base.minions.filter((m: any) => m.controller === ctx.targetPlayerId);
                if (opMinions.length === 1) {
                    // 只有一个随从，直接消灭
                    events.push(destroyMinion(opMinions[0].uid, opMinions[0].defId, ctx.baseIndex, opMinions[0].owner, ctx.casterPlayerId, 'elder_thing_shoggoth', timestamp));
                } else if (opMinions.length > 1) {
                    // 多个随从，由修格斯控制者选择
                    const options = opMinions.map(m => {
                        const def = getCardDef(m.defId) as MinionCardDef | undefined;
                        return { uid: m.uid, defId: m.defId, baseIndex: ctx.baseIndex, label: def?.name ?? m.defId };
                    });
                    const interaction = createSimpleChoice(
                        `elder_thing_shoggoth_destroy_${ctx.opponentIdx}_${timestamp}`, ctx.casterPlayerId,
                        `修格斯：选择消灭对手在此基地的一个随从`, buildMinionTargetOptions(options, { state: state.core, sourcePlayerId: ctx.casterPlayerId, effectType: 'destroy' }), { sourceId: 'elder_thing_shoggoth_destroy', targetType: 'minion' }
                        );
                    (interaction.data as any).continuationContext = {
                        casterPlayerId: ctx.casterPlayerId,
                        baseIndex: ctx.baseIndex,
                        opponents: ctx.opponents,
                        opponentIdx: ctx.opponentIdx,
                    };
                    return { state: queueInteraction(state, interaction), events };
                }
            }
        }

        // 链式垂询下一个对手
        return shoggothContinueChain(state, events, ctx, timestamp);
    });

    // 修格斯：控制者选择消灭对手随从后的处理
    registerInteractionHandler('elder_thing_shoggoth_destroy', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex, defId } = value as { minionUid: string; baseIndex: number; defId: string };
        const ctx = (iData as any)?.continuationContext as { casterPlayerId: string; baseIndex: number; opponents: string[]; opponentIdx: number };
        if (!ctx) return { state, events: [] };

        const base = state.core.bases[baseIndex];
        const target = base?.minions.find(m => m.uid === minionUid);
        const events: SmashUpEvent[] = [];
        if (target) {
            events.push(destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'elder_thing_shoggoth', timestamp));
        }

        // 继续链式处理下一个对手
        return shoggothContinueChain(state, events, ctx, timestamp);
    });

    // 深不可测的目的：对手选择消灭自己的随从（链式处理多个对手）
    registerInteractionHandler('elder_thing_unfathomable_goals', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return { state, events: [] };
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return { state, events: [] };
        const events: SmashUpEvent[] = [destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'elder_thing_unfathomable_goals', timestamp)];

        // 链式处理下一个对手
        const ctx = (iData as any)?.continuationContext as { opponents: string[]; opponentIdx: number } | undefined;
        if (!ctx) return { state, events };
        const nextIdx = ctx.opponentIdx + 1;
        if (nextIdx >= ctx.opponents.length) return { state, events };

        // 查找下一个需要选择的对手
        for (let i = nextIdx; i < ctx.opponents.length; i++) {
            const pid = ctx.opponents[i];
            const opMinions: { uid: string; defId: string; baseIndex: number; owner: string }[] = [];
            for (let bi = 0; bi < state.core.bases.length; bi++) {
                for (const m of state.core.bases[bi].minions) {
                    if (m.controller !== pid) continue;
                    opMinions.push({ uid: m.uid, defId: m.defId, baseIndex: bi, owner: m.owner });
                }
            }
            if (opMinions.length === 0) continue;
            if (opMinions.length === 1) {
                events.push(destroyMinion(opMinions[0].uid, opMinions[0].defId, opMinions[0].baseIndex, opMinions[0].owner, pid, 'elder_thing_unfathomable_goals', timestamp));
                continue;
            }
            // 多个随从：创建交互
            const options = opMinions.map(m => {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const baseDef = getBaseDef(state.core.bases[m.baseIndex].defId);
                const baseName = baseDef?.name ?? `基地 ${m.baseIndex + 1}`;
                return { uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: `${name} @ ${baseName}` };
            });
            const interaction = createSimpleChoice(
                `elder_thing_unfathomable_goals_${pid}_${timestamp}`, pid, '你手中有疯狂卡，必须消灭一个自己的随从', buildMinionTargetOptions(options, { state: state.core, sourcePlayerId: pid }), { sourceId: 'elder_thing_unfathomable_goals', targetType: 'minion' }
                );
            (interaction.data as any).continuationContext = {
                opponents: ctx.opponents,
                opponentIdx: i,
            };
            return { state: queueInteraction(state, interaction), events };
        }

        return { state, events };
    });

    // =========================
    // POD handlers
    // =========================

    registerInteractionHandler('elder_thing_elder_thing_pod_mode', (state, playerId, value, iData, _random, timestamp) => {
        const { mode } = value as { mode?: 'destroy' | 'bottom' };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; baseIndex: number } | undefined;
        if (!ctx) return { state, events: [] };

        if (mode === 'bottom') {
            return {
                state,
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: ctx.cardUid,
                    defId: 'elder_thing_elder_thing_pod',
                    ownerId: playerId,
                    reason: 'elder_thing_elder_thing_pod',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }

        // destroy mode: choose exactly 2 other minions; if not possible → forced bottom
        const candidates: { uid: string; defId: string; baseIndex: number; owner: string; label: string }[] = [];
        for (let bi = 0; bi < state.core.bases.length; bi++) {
            for (const m of state.core.bases[bi].minions) {
                if (m.controller !== playerId) continue;
                if (m.uid === ctx.cardUid) continue;
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                candidates.push({ uid: m.uid, defId: m.defId, baseIndex: bi, owner: m.owner, label: def?.name ?? m.defId });
            }
        }
        if (candidates.length < 2) {
            return {
                state,
                events: buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: ctx.cardUid,
                    defId: 'elder_thing_elder_thing_pod',
                    ownerId: playerId,
                    reason: 'elder_thing_elder_thing_pod_forced',
                    now: timestamp,
                    expectedLocation: 'bases',
                }),
            };
        }
        const options = buildMinionTargetOptions(candidates, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' });
        const interaction = createSimpleChoice(
            `elder_thing_elder_thing_pod_destroy_${timestamp}`,
            playerId,
            '远古之物：选择要消灭的两个你的其他随从',
            options,
            { sourceId: 'elder_thing_elder_thing_pod_destroy', targetType: 'minion', multi: { min: 2, max: 2 } },
        );
        (interaction.data as any).continuationContext = ctx;
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('elder_thing_elder_thing_pod_destroy', (state, playerId, value, iData, _random, timestamp) => {
        const ctx = (iData as any)?.continuationContext as { cardUid: string; baseIndex: number } | undefined;
        if (!ctx) return { state, events: [] };
        const selected = Array.isArray(value) ? value as any[] : [value as any];
        const picks = selected
            .map(v => ({ minionUid: v.minionUid ?? v.uid, baseIndex: v.baseIndex, defId: v.defId }))
            .filter(v => v.minionUid && v.baseIndex !== undefined) as Array<{ minionUid: string; baseIndex: number; defId: string }>;
        if (picks.length < 2) return { state, events: [] };

        let destroyableCount = 0;
        const events: SmashUpEvent[] = [];
        for (const p of picks.slice(0, 2)) {
            const base = state.core.bases[p.baseIndex];
            const m = base?.minions.find(x => x.uid === p.minionUid);
            if (!m) continue;
            if (!isMinionProtectedNonConsumable(state.core, m, p.baseIndex, playerId, 'destroy')) {
                destroyableCount++;
            }
            events.push(destroyMinion(m.uid, m.defId, p.baseIndex, m.owner, playerId, 'elder_thing_elder_thing_pod', timestamp));
        }

        // Clarification: if you cannot destroy two successfully, you must place Elder Thing on deck bottom.
        if (destroyableCount < 2) {
            events.push(...buildValidatedCardToDeckBottomEvents(state, {
                cardUid: ctx.cardUid,
                defId: 'elder_thing_elder_thing_pod',
                ownerId: playerId,
                reason: 'elder_thing_elder_thing_pod_fallback',
                now: timestamp,
                expectedLocation: 'bases',
            }));
        }

        return { state, events };
    });

    registerInteractionHandler('elder_thing_begin_the_summoning_pod', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid, defId } = value as { cardUid?: string; defId?: string };
        if (!cardUid || !defId) return { state, events: [] };
        const player = state.core.players[playerId];
        const inDiscard = player.discard.find(c => c.uid === cardUid && c.type === 'minion');
        if (!inDiscard) return { state, events: [] };
        const evt: SmashUpEvent = {
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: { cardUid, defId, ownerId: playerId, reason: 'elder_thing_begin_the_summoning_pod' },
            timestamp,
        };
        return { state, events: [evt, grantExtraAction(playerId, 'elder_thing_begin_the_summoning_pod', timestamp)] };
    });

    registerInteractionHandler('elder_thing_mi_go_pod', (state, _playerId, value, iData, random, timestamp) => {
        const { choice } = value as { choice?: 'yes' | 'no' };
        const ctx = (iData as any)?.continuationContext as {
            casterPlayerId: string; baseIndex: number; opponents: string[]; opponentIdx: number; anyDrew: boolean; declinedCount: number;
        } | undefined;
        if (!ctx) return { state, events: [] };
        const opponent = ctx.opponents[ctx.opponentIdx];
        const events: SmashUpEvent[] = [];
        if (choice === 'yes') {
            const evt = drawMadnessCards(opponent, 1, state.core, 'elder_thing_mi_go_pod', timestamp);
            if (evt) events.push(evt);
            ctx.anyDrew = true;
        } else {
            // caster draws a card
            const caster = state.core.players[ctx.casterPlayerId];
            const { drawnUids } = drawCards(caster, 1, random);
            if (drawnUids.length > 0) {
                events.push({ type: SU_EVENTS.CARDS_DRAWN, payload: { playerId: ctx.casterPlayerId, count: 1, cardUids: drawnUids }, timestamp } as CardsDrawnEvent);
            }
            ctx.declinedCount += 1;
        }
        const nextIdx = ctx.opponentIdx + 1;
        if (nextIdx < ctx.opponents.length) {
            const nextPid = ctx.opponents[nextIdx];
            const interaction = createSimpleChoice(
                `elder_thing_mi_go_pod_${nextPid}_${timestamp}`,
                nextPid,
                '米-格：你可以抽一张疯狂卡',
                [
                    { id: 'yes', label: '抽一张疯狂卡', value: { choice: 'yes' }, displayMode: 'button' as const },
                    { id: 'no', label: '不抽', value: { choice: 'no' }, displayMode: 'button' as const },
                ] as any[],
                { sourceId: 'elder_thing_mi_go_pod', targetType: 'button' },
            );
            (interaction.data as any).continuationContext = { ...ctx, opponentIdx: nextIdx };
            return { state: queueInteraction(state, interaction), events };
        }

        // If no one drew a madness card, you may place a +1 power counter on a minion.
        if (!ctx.anyDrew) {
            const myMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
            for (let bi = 0; bi < state.core.bases.length; bi++) {
                for (const m of state.core.bases[bi].minions) {
                    const def = getCardDef(m.defId) as MinionCardDef | undefined;
                    myMinions.push({ uid: m.uid, defId: m.defId, baseIndex: bi, label: def?.name ?? m.defId });
                }
            }
            if (myMinions.length > 0) {
                const interaction = createSimpleChoice(
                    `elder_thing_mi_go_pod_counter_${timestamp}`,
                    ctx.casterPlayerId,
                    '米-格：你可以在一个随从上放置+1战斗力指示物',
                    [
                        { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
                        ...buildMinionTargetOptions(myMinions, { state: state.core, sourcePlayerId: ctx.casterPlayerId, effectType: 'affect' }),
                    ] as any[],
                    { sourceId: 'elder_thing_mi_go_pod_counter', targetType: 'minion' },
                );
                return { state: queueInteraction(state, interaction), events };
            }
        }
        return { state, events };
    });

    registerInteractionHandler('elder_thing_mi_go_pod_counter', (state, playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        const v = value as { minionUid?: string; baseIndex?: number };
        if (!v.minionUid || v.baseIndex === undefined) return { state, events: [] };
        return { state, events: [addPowerCounter(v.minionUid, v.baseIndex, 1, 'elder_thing_mi_go_pod', timestamp)] };
    });

    registerInteractionHandler('elder_thing_shoggoth_pod', (state, _playerId, value, iData, _random, timestamp) => {
        const { choice } = value as { choice?: 'yes' | 'no' };
        const ctx = (iData as any)?.continuationContext as {
            casterPlayerId: string; baseIndex: number; opponents: string[]; opponentIdx: number; decliners: string[];
        } | undefined;
        if (!ctx) return { state, events: [] };
        const opponent = ctx.opponents[ctx.opponentIdx];
        const events: SmashUpEvent[] = [];
        if (choice === 'yes') {
            const evt = drawMadnessCards(opponent, 1, state.core, 'elder_thing_shoggoth_pod', timestamp);
            if (evt) events.push(evt);
        } else {
            ctx.decliners.push(opponent);
        }
        const nextIdx = ctx.opponentIdx + 1;
        if (nextIdx < ctx.opponents.length) {
            const nextPid = ctx.opponents[nextIdx];
            const interaction = createSimpleChoice(
                `elder_thing_shoggoth_pod_${nextPid}_${timestamp}`,
                nextPid,
                '修格斯：你可以抽一张疯狂卡',
                [
                    { id: 'yes', label: '抽一张疯狂卡', value: { choice: 'yes' }, displayMode: 'button' as const },
                    { id: 'no', label: '不抽', value: { choice: 'no' }, displayMode: 'button' as const },
                ] as any[],
                { sourceId: 'elder_thing_shoggoth_pod', targetType: 'button' },
            );
            (interaction.data as any).continuationContext = { ...ctx, opponentIdx: nextIdx };
            return { state: queueInteraction(state, interaction), events };
        }

        // process decliners: if any, prompt caster to destroy minions here
        if (ctx.decliners.length > 0) {
            const first = ctx.decliners[0];
            const base = state.core.bases[ctx.baseIndex];
            const minions = base?.minions.filter(m => m.controller === first) ?? [];
            if (minions.length > 0) {
                const options = buildMinionTargetOptions(minions.map(m => ({ uid: m.uid, defId: m.defId, baseIndex: ctx.baseIndex, label: getCardDef(m.defId)?.name ?? m.defId })), { state: state.core, sourcePlayerId: ctx.casterPlayerId, effectType: 'destroy' });
                const interaction = createSimpleChoice(
                    `elder_thing_shoggoth_pod_destroy_${timestamp}`,
                    ctx.casterPlayerId,
                    `修格斯：选择消灭 ${first} 在此基地的一个随从`,
                    options,
                    { sourceId: 'elder_thing_shoggoth_pod_destroy', targetType: 'minion' },
                );
                (interaction.data as any).continuationContext = { ...ctx, declinerIdx: 0 };
                return { state: queueInteraction(state, interaction), events };
            }
        }

        // No decliners or no minions to destroy: finalize power check
        const base = state.core.bases[ctx.baseIndex];
        const myPower = base ? getPlayerEffectivePowerOnBase(state.core, base, ctx.baseIndex, ctx.casterPlayerId) : 0;
        if (myPower < 12) {
            const evt = drawMadnessCards(ctx.casterPlayerId, 2, state.core, 'elder_thing_shoggoth_pod', timestamp);
            if (evt) events.push(evt);
        }
        return { state, events };
    });

    registerInteractionHandler('elder_thing_shoggoth_pod_destroy', (state, playerId, value, iData, _random, timestamp) => {
        const ctx = (iData as any)?.continuationContext as any;
        if (!ctx) return { state, events: [] };
        const v = value as { minionUid?: string; baseIndex?: number };
        if (!v.minionUid || v.baseIndex === undefined) return { state, events: [] };
        const base = state.core.bases[v.baseIndex];
        const target = base?.minions.find(m => m.uid === v.minionUid);
        const events: SmashUpEvent[] = [];
        if (target) {
            events.push(destroyMinion(target.uid, target.defId, v.baseIndex, target.owner, playerId, 'elder_thing_shoggoth_pod', timestamp));
        }
        const nextDeclinerIdx = (ctx.declinerIdx ?? 0) + 1;
        if (nextDeclinerIdx < ctx.decliners.length) {
            const nextPid = ctx.decliners[nextDeclinerIdx];
            const base2 = state.core.bases[ctx.baseIndex];
            const minions2 = base2?.minions.filter((m: any) => m.controller === nextPid) ?? [];
            if (minions2.length > 0) {
                const options = buildMinionTargetOptions(minions2.map((m: any) => ({ uid: m.uid, defId: m.defId, baseIndex: ctx.baseIndex, label: getCardDef(m.defId)?.name ?? m.defId })), { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' });
                const interaction = createSimpleChoice(
                    `elder_thing_shoggoth_pod_destroy_${timestamp}_${nextDeclinerIdx}`,
                    playerId,
                    `修格斯：选择消灭 ${nextPid} 在此基地的一个随从`,
                    options,
                    { sourceId: 'elder_thing_shoggoth_pod_destroy', targetType: 'minion' },
                );
                (interaction.data as any).continuationContext = { ...ctx, declinerIdx: nextDeclinerIdx };
                return { state: queueInteraction(state, interaction), events };
            }
        }
        // finalize power check
        const baseFinal = state.core.bases[ctx.baseIndex];
        const myPower = baseFinal ? getPlayerEffectivePowerOnBase(state.core, baseFinal, ctx.baseIndex, ctx.casterPlayerId) : 0;
        if (myPower < 12) {
            const evt = drawMadnessCards(ctx.casterPlayerId, 2, state.core, 'elder_thing_shoggoth_pod', timestamp);
            if (evt) events.push(evt);
        }
        return { state, events };
    });

    registerInteractionHandler('elder_thing_dunwich_horror_pod_choice', (state, playerId, value, iData, _random, timestamp) => {
        const { choice } = value as { choice?: 'draw' | 'destroy' };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number; minionUid: string; minionDefId: string; ownerId: string } | undefined;
        if (!ctx) return { state, events: [] };
        if (choice === 'draw') {
            const evt = drawMadnessCards(playerId, 2, state.core, 'elder_thing_dunwich_horror_pod', timestamp);
            return { state, events: evt ? [evt] : [] };
        }
        // destroy
        return { state, events: [destroyMinion(ctx.minionUid, ctx.minionDefId, ctx.baseIndex, ctx.ownerId, playerId, 'elder_thing_dunwich_horror_pod', timestamp)] };
    });

    registerInteractionHandler('elder_thing_spreading_horror_pod_opponent', (state, _playerId, value, iData, _random, timestamp) => {
        const { choice } = value as { choice?: 'yes' | 'no' };
        const ctx = (iData as any)?.continuationContext as any;
        if (!ctx) return { state, events: [] };
        const pid = ctx.opponents[ctx.idx];
        const player = state.core.players[pid];
        const nonMadness = player.hand.filter((c: any) => c.defId !== MADNESS_CARD_DEF_ID);
        const events: SmashUpEvent[] = [];
        if (choice === 'yes' && nonMadness.length >= 2) {
            events.push({ type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId: pid, cardUids: [nonMadness[0].uid, nonMadness[1].uid] }, timestamp } as any);
        } else {
            ctx.decliners.push(pid);
        }
        const nextIdx = ctx.idx + 1;
        if (nextIdx < ctx.opponents.length) {
            const nextPid = ctx.opponents[nextIdx];
            const interaction = createSimpleChoice(
                `elder_thing_spreading_horror_pod_${nextPid}_${timestamp}`,
                nextPid,
                '散播恐怖：你可以弃置两张非疯狂卡',
                [
                    { id: 'yes', label: '弃置两张非疯狂卡', value: { choice: 'yes' }, displayMode: 'button' as const },
                    { id: 'no', label: '不弃置', value: { choice: 'no' }, displayMode: 'button' as const },
                ] as any[],
                { sourceId: 'elder_thing_spreading_horror_pod_opponent', targetType: 'button' },
            );
            (interaction.data as any).continuationContext = { ...ctx, idx: nextIdx };
            return { state: queueInteraction(state, interaction), events };
        }
        // after all opponents, if decliners >0 start play-from-discard loop
        if (ctx.decliners.length > 0) {
            const next = queueSpreadingHorrorPodMayPlay(
                state,
                { casterPlayerId: ctx.casterPlayerId, remaining: ctx.decliners.length, usedBases: [] as number[] },
                timestamp,
            );
            return { state: next.state, events: [...events, ...next.events] };
        }
        return { state, events };
    });

    registerInteractionHandler('elder_thing_spreading_horror_pod_may_play', (state, playerId, value, iData, _random, timestamp) => {
        const ctx = (iData as any)?.continuationContext as { casterPlayerId: string; remaining: number; usedBases: number[] } | undefined;
        const { choice } = value as { choice?: 'yes' | 'no' };
        if (!ctx) return { state, events: [] };

        if (choice !== 'yes') {
            const nextCtx = { ...ctx, remaining: ctx.remaining - 1 };
            if (nextCtx.remaining <= 0) return { state, events: [] };
            return queueSpreadingHorrorPodMayPlay(state, nextCtx, timestamp);
        }

        const bases = state.core.bases
            .map((b: any, i: number) => ({ baseIndex: i, label: getBaseDef(b.defId)?.name ?? `基地 ${i + 1}` }))
            .filter((b: any) => !ctx.usedBases.includes(b.baseIndex));
        if (bases.length === 0) {
            const nextCtx = { ...ctx, remaining: ctx.remaining - 1 };
            if (nextCtx.remaining <= 0) return { state, events: [] };
            return queueSpreadingHorrorPodMayPlay(state, nextCtx, timestamp);
        }

        const interaction = createSimpleChoice(
            `elder_thing_spreading_horror_pod_choose_base_${timestamp}_${ctx.remaining}`,
            playerId,
            '散播恐怖：选择要打出随从的基地（每次必须不同）',
            buildBaseTargetOptions(bases, state.core),
            { sourceId: 'elder_thing_spreading_horror_pod_choose_base', targetType: 'base' },
        );
        (interaction.data as any).continuationContext = ctx;
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('elder_thing_spreading_horror_pod_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const ctx = (iData as any)?.continuationContext as any;
        const { baseIndex } = value as { baseIndex?: number };
        if (!ctx || baseIndex === undefined) return { state, events: [] };
        if (ctx.usedBases.includes(baseIndex)) return { state, events: [] };
        const player = state.core.players[playerId];
        const discardMinions = player.discard.filter((c: any) => c.type === 'minion').filter((c: any) => {
            const def = getCardDef(c.defId) as any;
            return def?.type === 'minion' && def.power <= 3;
        });
        if (discardMinions.length === 0) {
            const nextCtx = { ...ctx, remaining: (ctx.remaining ?? 1) - 1 };
            if (nextCtx.remaining <= 0) return { state, events: [] };
            return queueSpreadingHorrorPodMayPlay(state, nextCtx, timestamp);
        }
        const options = discardMinions.map((c: any, i: number) => ({ id: `m-${i}`, label: getCardDef(c.defId)?.name ?? c.defId, value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const, _source: 'discard' as const }));
        const interaction = createSimpleChoice(
            `elder_thing_spreading_horror_pod_choose_minion_${timestamp}`,
            playerId,
            '散播恐怖：选择要从弃牌堆打出的随从（战斗力≤3）',
            options as any[],
            { sourceId: 'elder_thing_spreading_horror_pod_choose_minion', targetType: 'generic' },
        );
        (interaction.data as any).continuationContext = { ...ctx, chosenBaseIndex: baseIndex };
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('elder_thing_spreading_horror_pod_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        const ctx = (iData as any)?.continuationContext as any;
        const { cardUid, defId } = value as any;
        if (!ctx || !cardUid || !defId) return { state, events: [] };
        const def = getCardDef(defId) as any;
        const playedEvt: any = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid, defId, baseIndex: ctx.chosenBaseIndex, power: def?.power ?? 0, fromDiscard: true, consumesNormalLimit: false, discardPlaySourceId: 'elder_thing_spreading_horror_pod' },
            timestamp,
        };
        const events: SmashUpEvent[] = [playedEvt];
        const remaining = (ctx.remaining ?? 1) - 1;
        const usedBases = [...ctx.usedBases, ctx.chosenBaseIndex];
        if (remaining > 0) {
            const next = queueSpreadingHorrorPodMayPlay(
                state,
                { casterPlayerId: playerId, remaining, usedBases },
                timestamp,
            );
            return { state: next.state, events: [...events, ...next.events] };
        }
        return { state, events };
    });

    registerInteractionHandler('elder_thing_power_of_madness_pod_start', (state, playerId, _value, iData, random, timestamp) => {
        const ctx = (iData as any)?.continuationContext as { opponents: string[]; idx: number } | undefined;
        if (!ctx) return { state, events: [] };
        const targetPid = ctx.opponents[ctx.idx];
        // Only list actions from factions that are present in this match (all players' selected factions),
        // plus Madness (also an action). This keeps the naming list searchable.
        const factionIds = new Set<string>();
        for (const p of Object.values(state.core.players)) {
            const factions = (p as any)?.factions as [string, string] | undefined;
            if (!factions) continue;
            factionIds.add(factions[0]);
            factionIds.add(factions[1]);
        }
        const actionDefIds = new Set<string>();
        for (const fid of factionIds) {
            for (const def of getFactionCards(fid as any)) {
                if (def.type !== 'action') continue;
                actionDefIds.add(def.id);
            }
        }
        actionDefIds.add(MADNESS_CARD_DEF_ID);

        const allActionDefIds = Array.from(actionDefIds);
        allActionDefIds.sort((a, b) => (getCardDef(a)?.name ?? a).localeCompare(getCardDef(b)?.name ?? b, 'zh-CN'));

        const options = allActionDefIds.map((defId: string, i: number) => ({
            id: `a-${i}`,
            label: getCardDef(defId)?.name ?? defId,
            value: { defId },
            displayMode: 'button' as const,
        }));
        const interaction = createSimpleChoice(
            `elder_thing_power_of_madness_pod_choose_${targetPid}_${timestamp}`,
            playerId,
            `疯狂之力：为 ${targetPid} 选择要命名的战术`,
            options as any[],
            { sourceId: 'elder_thing_power_of_madness_pod_choose', targetType: 'button' },
        );
        (interaction.data as any).continuationContext = { ...ctx, targetPid };
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('elder_thing_power_of_madness_pod_choose', (state, playerId, value, iData, random, timestamp) => {
        const ctx = (iData as any)?.continuationContext as any;
        if (!ctx) return { state, events: [] };
        const targetPid = ctx.targetPid as string;
        const namedDefId = (value as any).defId as string;
        const opponent = state.core.players[targetPid];
        const events: SmashUpEvent[] = [];

        // Reveal AFTER naming (rule order)
        if (opponent.hand.length > 0) {
            events.push(
                revealHand(targetPid, 'all', opponent.hand.map((c: any) => ({ uid: c.uid, defId: c.defId })), 'elder_thing_power_of_madness_pod', timestamp, playerId)
            );
        }

        // Discard all copies of the named action from hand
        if (namedDefId) {
            const discards = opponent.hand.filter((c: any) => c.defId === namedDefId).map((c: any) => c.uid);
            if (discards.length > 0) {
                events.push({ type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId: targetPid, cardUids: discards }, timestamp } as any);
            }
        }

        // Shuffle discard pile into deck even if no discards (FAQ)
        const newDeck = random.shuffle([...opponent.deck, ...opponent.discard]);
        events.push({ type: SU_EVENTS.DECK_RESHUFFLED, payload: { playerId: targetPid, deckUids: newDeck.map((c: any) => c.uid) }, timestamp } as any);

        const nextIdx = (ctx.idx ?? 0) + 1;
        if (nextIdx < ctx.opponents.length) {
            const nextCtx = { opponents: ctx.opponents, idx: nextIdx };
            const interaction = createSimpleChoice(
                `elder_thing_power_of_madness_pod_next_${timestamp}_${nextIdx}`,
                playerId,
                '疯狂之力：继续',
                [{ id: 'next', label: '继续', value: { start: true }, displayMode: 'button' as const }],
                { sourceId: 'elder_thing_power_of_madness_pod_start', targetType: 'button' },
            );
            (interaction.data as any).continuationContext = nextCtx;
            return { state: queueInteraction(state, interaction), events };
        }
        return { state, events };
    });
}

// ============================================================================
// ongoing 效果触发器
// ============================================================================

/**
 * 力量的代价 special 能力：基地计分前打出
 *
 * 效果：在计分基地上，每个对手手牌中的疯狂卡给己方随从 +2 力量
 * ctx.baseIndex 为计分基地索引（由 Me First! 窗口传入）
 */
function elderThingPriceOfPowerSpecial(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const scoringBaseIndex = ctx.baseIndex;
    const base = ctx.state.bases[scoringBaseIndex];
    if (!base) return { events };

    // 收集所有对手手牌用于合并展示（规则："所有有随从在这里的其他玩家展示他们的手牌"）
    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];
    let totalMadness = 0;
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        if (!base.minions.some(m => m.controller === pid)) continue;
        const opponent = ctx.state.players[pid];
        if (opponent.hand.length > 0) {
            revealTargetIds.push(pid);
            for (const c of opponent.hand) {
                allRevealCards.push({ uid: c.uid, defId: c.defId });
            }
        }
        totalMadness += opponent.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length;
    }

    // 合并展示所有对手手牌（一个事件，避免多人覆盖）
    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.push(revealHand(targetIds, 'all', allRevealCards, 'elder_thing_the_price_of_power', ctx.now, ctx.playerId));
    }

    if (totalMadness === 0) return { events };

    // 给己方在该基地的随从轮流 +2 力量
    const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
    if (myMinions.length === 0) return { events };
    for (let i = 0; i < totalMadness; i++) {
        const target = myMinions[i % myMinions.length];
        events.push(addPowerCounter(target.uid, scoringBaseIndex, 2, 'elder_thing_the_price_of_power', ctx.now));
    }
    return { events };
}


/** 邓威奇恐怖触发：回合结束时消灭附着了此卡的随从 */
function elderThingDunwichHorrorTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (!m.attachedActions.some(a => matchesDefId(a.defId, 'elder_thing_dunwich_horror'))) continue;
            events.push(destroyMinion(m.uid, m.defId, i, m.owner, undefined, 'elder_thing_dunwich_horror', ctx.now));
        }
    }
    return events;
}
