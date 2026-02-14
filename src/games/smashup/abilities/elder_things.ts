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
    destroyMinion,
    getMinionPower,
    buildMinionTargetOptions,
    addPowerCounter,
    revealHand,
} from '../domain/abilityHelpers';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type {
    SmashUpEvent,
    CardsDrawnEvent,
    CardsDiscardedEvent,
    DeckReshuffledEvent,
    MinionCardDef,
} from '../domain/types';
import { drawCards } from '../domain/utils';
import { getCardDef, getBaseDef } from '../data/cards';
import { registerTrigger, registerProtection } from '../domain/ongoingEffects';
import type { TriggerContext, ProtectionCheckContext } from '../domain/ongoingEffects';
import type { SmashUpCore, CardToDeckBottomEvent } from '../domain/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';

/** 注册远古之物派系所有能力*/
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

    // === ongoing 效果注册 ===
    // 郦威奇恐怖：回合结束时消灭附着了此卡的随从
    registerTrigger('elder_thing_dunwich_horror', 'onTurnEnd', elderThingDunwichHorrorTrigger);
    // 力量的代价：基地计分前按对手疑狂卡数给己方随从力量
    registerAbility('elder_thing_the_price_of_power', 'special', elderThingPriceOfPowerSpecial);
    // 远古之物：不收回受对手卡牌影响（保护 destroy + move?
    registerProtection('elder_thing_elder_thing', 'destroy', elderThingProtectionChecker);
    registerProtection('elder_thing_elder_thing', 'move', elderThingProtectionChecker);
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

/** ??onPlay：每个对手可抽疯狂卡，不收回抽的让你抽一张牌（MVP：对手全部抽疯狂卡） */
function elderThingMiGo(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const evt = drawMadnessCards(pid, 1, ctx.state, 'elder_thing_mi_go', ctx.now);
        if (evt) {
            events.push(evt);
        } else {
            // 疯狂牌库空了，对手无法抽 ?你抽一张牌
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
        }
    }
    return { events };
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

    // 收集所有对手的手牌用于合并展示（避免多人时 pendingReveal 覆盖）
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
        // 没有随从可选，仍给额外行动
        events.push(grantExtraAction(ctx.playerId, 'elder_thing_begin_the_summoning', ctx.now));
        return { events };
    }
    // Prompt 选择
    const options = minionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        `elder_thing_begin_the_summoning_${ctx.now}`, ctx.playerId,
        '选择要放到牌库顶的随从', options as any[], 'elder_thing_begin_the_summoning',
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
            events.push(destroyMinion(opMinions[0].uid, opMinions[0].defId, opMinions[0].baseIndex, opMinions[0].owner, 'elder_thing_unfathomable_goals', ctx.now));
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
            '你手中有疯狂卡，必须消灭一个自己的随从', buildMinionTargetOptions(options), 'elder_thing_unfathomable_goals',
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
    if (ctx.targetMinion.defId !== 'elder_thing_elder_thing') return false;
    return ctx.sourcePlayerId !== ctx.targetMinion.controller;
}

/** 远古之物 onPlay：消灭两个己方其他随从或将本随从放到牌库底?*/
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

    // 不收回足2个其他随从→必须放牌库底
    if (otherMinions.length < 2) {
        const evt: CardToDeckBottomEvent = {
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: { cardUid: ctx.cardUid, defId: ctx.defId, ownerId: ctx.playerId, reason: 'elder_thing_elder_thing' },
            timestamp: ctx.now,
        };
        return { events: [evt] };
    }

    // ?2 个其他随从→ Prompt 选择
    const options = [
        { id: 'destroy', label: '消灭两个己方其他随从', value: { choice: 'destroy' } },
        { id: 'deckbottom', label: '将本随从放到牌库底底', value: { choice: 'deckbottom' } },
    ];
    const interaction = createSimpleChoice(
        `elder_thing_elder_thing_choice_${ctx.now}`, ctx.playerId,
        '选择远古之物的效果', options as any[], 'elder_thing_elder_thing_choice',
    );
    (interaction.data as any).continuationContext = { cardUid: ctx.cardUid, defId: ctx.defId, baseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// 修格斯?(Shoggoth) - onPlay
// ============================================================================

/** 修格斯 onPlay：每个对手可抽疯狂卡，不收回抽则消灭该对手在此基地的一个随从*/
function elderThingShoggoth(ctx: AbilityContext): AbilityResult {
    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    if (opponents.length === 0) return { events: [] };

    const options = [
        { id: 'draw_madness', label: '抽一张疯狂卡', value: { choice: 'draw_madness' } },
        { id: 'decline', label: '拒绝（被消灭一个随从）', value: { choice: 'decline' } },
    ];
    const interaction = createSimpleChoice(
        `elder_thing_shoggoth_opponent_${ctx.now}`, opponents[0],
        '修格斯：你可以抽一张疯狂卡，否则你在此基地的一个随从将被消灭', options as any[], 'elder_thing_shoggoth_opponent',
    );
    (interaction.data as any).continuationContext = {
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

/** 注册远古之物派系的交互解决处理函数 */
export function registerElderThingInteractionHandlers(): void {
    registerInteractionHandler('elder_thing_begin_the_summoning', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string };
        const player = state.core.players[playerId];
        const newDeckUids = [cardUid, ...player.deck.map(c => c.uid)];
        return { state, events: [
            { type: SU_EVENTS.DECK_RESHUFFLED, payload: { playerId, deckUids: newDeckUids }, timestamp },
            grantExtraAction(playerId, 'elder_thing_begin_the_summoning', timestamp),
        ] };
    });

    registerInteractionHandler('elder_thing_elder_thing_choice', (state, playerId, value, iData, _random, timestamp) => {
        const { choice } = value as { choice: string };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; defId: string; baseIndex: number };
        if (!ctx) return { state, events: [] };

        if (choice === 'deckbottom') {
            return { state, events: [{
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: { cardUid: ctx.cardUid, defId: ctx.defId, ownerId: playerId, reason: 'elder_thing_elder_thing' },
                timestamp,
            }] };
        }

        // choice === 'destroy' → 收集己方随从，MVP 自动选前两个
        const myMinions: { uid: string; defId: string; baseIndex: number; owner: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            for (const m of state.core.bases[i].minions) {
                if (m.controller === playerId && m.uid !== ctx.cardUid) {
                    myMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner });
                }
            }
        }
        const events: SmashUpEvent[] = [];
        const toDestroy = myMinions.slice(0, 2);
        for (const t of toDestroy) {
            events.push(destroyMinion(t.uid, t.defId, t.baseIndex, t.owner, 'elder_thing_elder_thing', timestamp));
        }
        return { state, events };
    });

    registerInteractionHandler('elder_thing_shoggoth_opponent', (state, _playerId, value, iData, _random, timestamp) => {
        const { choice } = value as { choice: string };
        const ctx = (iData as any)?.continuationContext as { baseIndex: number; opponents: string[]; opponentIdx: number; targetPlayerId: string };
        if (!ctx) return { state, events: [] };
        const events: SmashUpEvent[] = [];

        if (choice === 'draw_madness') {
            const evt = drawMadnessCards(ctx.targetPlayerId, 1, state.core, 'elder_thing_shoggoth', timestamp);
            if (evt) events.push(evt);
        } else {
            const base = state.core.bases[ctx.baseIndex];
            if (base) {
                const opMinions = base.minions
                    .filter((m: any) => m.controller === ctx.targetPlayerId)
                    .sort((a: any, b: any) => getMinionPower(state.core, a, ctx.baseIndex) - getMinionPower(state.core, b, ctx.baseIndex));
                if (opMinions.length > 0) {
                    events.push(destroyMinion(opMinions[0].uid, opMinions[0].defId, ctx.baseIndex, opMinions[0].owner, 'elder_thing_shoggoth', timestamp));
                }
            }
        }

        // 链式垂询下一个对手
        const nextIdx = ctx.opponentIdx + 1;
        if (nextIdx < ctx.opponents.length) {
            const nextPid = ctx.opponents[nextIdx];
            const options = [
                { id: 'draw_madness', label: '抽一张疯狂卡', value: { choice: 'draw_madness' } },
                { id: 'decline', label: '拒绝（被消灭一个随从）', value: { choice: 'decline' } },
            ];
            const interaction = createSimpleChoice(
                `elder_thing_shoggoth_opponent_${nextIdx}_${timestamp}`, nextPid,
                '修格斯：你可以抽一张疯狂卡，否则你在此基地的一个随从将被消灭', options as any[], 'elder_thing_shoggoth_opponent',
            );
            (interaction.data as any).continuationContext = {
                targetPlayerId: nextPid,
                baseIndex: ctx.baseIndex,
                opponents: ctx.opponents,
                opponentIdx: nextIdx,
            };
            return { state: queueInteraction(state, interaction), events };
        }

        return { state, events };
    });

    // 深不可测的目的：对手选择消灭自己的随从（链式处理多个对手）
    registerInteractionHandler('elder_thing_unfathomable_goals', (state, _playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return { state, events: [] };
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return { state, events: [] };
        const events: SmashUpEvent[] = [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'elder_thing_unfathomable_goals', timestamp)];

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
                events.push(destroyMinion(opMinions[0].uid, opMinions[0].defId, opMinions[0].baseIndex, opMinions[0].owner, 'elder_thing_unfathomable_goals', timestamp));
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
                `elder_thing_unfathomable_goals_${pid}_${timestamp}`, pid,
                '你手中有疯狂卡，必须消灭一个自己的随从', buildMinionTargetOptions(options), 'elder_thing_unfathomable_goals',
            );
            (interaction.data as any).continuationContext = {
                opponents: ctx.opponents,
                opponentIdx: i,
            };
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
            if (!m.attachedActions.some(a => a.defId === 'elder_thing_dunwich_horror')) continue;
            events.push(destroyMinion(m.uid, m.defId, i, m.owner, 'elder_thing_dunwich_horror', ctx.now));
        }
    }
    return events;
}
