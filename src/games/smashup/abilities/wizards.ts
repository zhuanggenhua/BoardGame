/**
 * 大杀四方 - 巫师派系能力
 *
 * 主题：抽牌、额外打出行动卡
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    grantExtraAction,
    grantExtraMinion,
    destroyMinion,
    shuffleHandIntoDeck,
    getMinionPower,
    buildMinionTargetOptions,
    revealDeckTop,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { CardsDrawnEvent, SmashUpEvent, DeckReshuffledEvent, MinionCardDef, CardToDeckTopEvent } from '../domain/types';
import { drawCards } from '../domain/utils';
import { registerTrigger } from '../domain/ongoingEffects';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { getCardDef, getBaseDef } from '../data/cards';

/** 时间法师 onPlay：额外打出一个行动*/
function wizardChronomage(ctx: AbilityContext): AbilityResult {
    return { events: [grantExtraAction(ctx.playerId, 'wizard_chronomage', ctx.now)] };
}

/** 女巫 onPlay：抽一张牌 */
function wizardEnchantress(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const { drawnUids } = drawCards(player, 1, ctx.random);
    if (drawnUids.length === 0) return { events: [] };
    const evt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: 1, cardUids: drawnUids },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 秘术学习 onPlay：抽两张）?*/
function wizardMysticStudies(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const { drawnUids } = drawCards(player, 2, ctx.random);
    if (drawnUids.length === 0) return { events: [] };
    const evt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: drawnUids.length, cardUids: drawnUids },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 召唤 onPlay：额外打出一个随从*/
function wizardSummon(ctx: AbilityContext): AbilityResult {
    return { events: [grantExtraMinion(ctx.playerId, 'wizard_summon', ctx.now)] };
}

/** 时间圆环 onPlay：额外打出两个行动*/
function wizardTimeLoop(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantExtraAction(ctx.playerId, 'wizard_time_loop', ctx.now),
            grantExtraAction(ctx.playerId, 'wizard_time_loop', ctx.now),
        ],
    };
}

/** 学徒 onPlay：展示牌库顶给所有人，如果是行动→Prompt 选择放入手牌或作为额外行动打出 */
function wizardNeophyte(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (player.deck.length === 0) return { events: [] };
    const topCard = player.deck[0];

    // 展示牌库顶给所有人（规则："展示你牌库最顶端的牌"）
    const revealEvt = revealDeckTop(
        ctx.playerId, 'all',
        [{ uid: topCard.uid, defId: topCard.defId }],
        1, 'wizard_neophyte', ctx.now,
    );

    if (topCard.type !== 'action') {
        // 不是行动卡，展示后无事发生
        return { events: [revealEvt] };
    }
    const def = getCardDef(topCard.defId);
    const cardName = def?.name ?? topCard.defId;
    const interaction = createSimpleChoice(
        `wizard_neophyte_${ctx.now}`, ctx.playerId,
        `牌库顶是行动卡「${cardName}」，选择处理方式`,
        [
            { id: 'to_hand', label: '放入手牌', value: { action: 'to_hand' } },
            { id: 'play_extra', label: '作为额外行动打出', value: { action: 'play_extra' } },
        ],
        'wizard_neophyte',
    );
    const extended = {
        ...interaction,
        data: { ...interaction.data, continuationContext: { cardUid: topCard.uid, defId: topCard.defId } },
    };
    return { events: [revealEvt], matchState: queueInteraction(ctx.matchState, extended) };
}

/** 聚集秘术 onPlay：展示每个对手牌库顶给所有人，选择其中一张行动卡作为额外行动打出 */
function wizardMassEnchantment(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 收集所有对手牌库顶卡牌，合并为一个展示事件（避免多人时 pendingReveal 覆盖）
    const allRevealCards: { uid: string; defId: string }[] = [];
    const revealTargetIds: string[] = [];
    const actionCandidates: { uid: string; defId: string; pid: string; label: string }[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (opponent.deck.length === 0) continue;
        const topCard = opponent.deck[0];
        revealTargetIds.push(pid);
        allRevealCards.push({ uid: topCard.uid, defId: topCard.defId });
        if (topCard.type === 'action') {
            const def = getCardDef(topCard.defId);
            const name = def?.name ?? topCard.defId;
            actionCandidates.push({ uid: topCard.uid, defId: topCard.defId, pid, label: `${name}（来自对手 ${pid}）` });
        }
    }
    // 合并展示所有对手牌库顶（一个事件，避免多人覆盖）
    if (allRevealCards.length > 0) {
        const targetIds = revealTargetIds.length === 1 ? revealTargetIds[0] : revealTargetIds;
        events.push(revealDeckTop(
            targetIds, 'all', allRevealCards,
            allRevealCards.length, 'wizard_mass_enchantment', ctx.now, ctx.playerId,
        ));
    }
    if (actionCandidates.length === 0) return { events };
    // 交互选择
    const options = actionCandidates.map((c, i) => ({ id: `card-${i}`, label: c.label, value: { cardUid: c.uid, defId: c.defId, pid: c.pid } }));
    const interaction = createSimpleChoice(
        `wizard_mass_enchantment_${ctx.now}`, ctx.playerId,
        '选择一张行动卡作为额外行动打出', options, 'wizard_mass_enchantment',
    );
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 注册巫师派系所有能力 */
export function registerWizardAbilities(): void {
    const abilities: Array<[string, (ctx: AbilityContext) => AbilityResult]> = [
        ['wizard_chronomage', wizardChronomage],
        ['wizard_enchantress', wizardEnchantress],
        ['wizard_mystic_studies', wizardMysticStudies],
        ['wizard_summon', wizardSummon],
        ['wizard_time_loop', wizardTimeLoop],
        ['wizard_neophyte', wizardNeophyte],
        ['wizard_winds_of_change', wizardWindsOfChange],
        ['wizard_sacrifice', wizardSacrifice],
        ['wizard_mass_enchantment', wizardMassEnchantment],
        ['wizard_portal', wizardPortal],
        ['wizard_scry', wizardScry],
    ];

    for (const [id, handler] of abilities) {
        registerAbility(id, 'onPlay', handler);
    }

    // 注册 ongoing 拦截?
    registerWizardOngoingEffects();
}

/** 传送门 onPlay：展示牌库顶5张，玩家选择要拿的随从放入手牌，其余以玩家选择的顺序放牌库顶 */
function wizardPortal(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (player.deck.length === 0) return { events: [] };

    const topCards = player.deck.slice(0, 5);
    const minions = topCards.filter(c => c.type === 'minion');
    const others = topCards.filter(c => c.type !== 'minion');

    // 展示牌库顶卡牌给所有人（规则："展示你牌库顶的5张牌"）
    const revealEvt = revealDeckTop(
        ctx.playerId, 'all',
        topCards.map(c => ({ uid: c.uid, defId: c.defId })),
        topCards.length, 'wizard_portal', ctx.now,
    );

    // 没有随从：直接进入排序流程
    if (minions.length === 0) {
        const result = wizardPortalOrderRemaining(ctx, others, [revealEvt]);
        return result;
    }

    // 有随从：让玩家选择要拿哪些（可以不拿）
    const options = minions.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `minion-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        `wizard_portal_pick_${ctx.now}`, ctx.playerId,
        '传送：选择要放入手牌的随从（可以不选）', options, 'wizard_portal_pick',
        undefined, { min: 0, max: minions.length },
    );
    const allTopCards = topCards.map(c => ({ uid: c.uid, defId: c.defId, type: c.type }));
    return {
        events: [revealEvt],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { allTopCards } },
        }),
    };
}

/** 传送门辅助：对剩余牌排序放回牌库顶 */
function wizardPortalOrderRemaining(
    ctx: AbilityContext,
    remaining: { uid: string; defId: string }[],
    drawEvents: SmashUpEvent[],
): AbilityResult {
    if (remaining.length === 0) return { events: drawEvents };
    if (remaining.length === 1) {
        return {
            events: [
                ...drawEvents,
                {
                    type: SU_EVENTS.CARD_TO_DECK_TOP,
                    payload: { cardUid: remaining[0].uid, defId: remaining[0].defId, ownerId: ctx.playerId, reason: 'wizard_portal' },
                    timestamp: ctx.now,
                } as CardToDeckTopEvent,
            ],
        };
    }
    // 多张：让玩家逐个选择放回顺序
    const options = remaining.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        `wizard_portal_order_${ctx.now}`, ctx.playerId,
        '传送：选择放回牌库顶的第一张牌（最先选的在最上面）', options, 'wizard_portal_order',
    );
    const remainingUids = remaining.map(c => ({ uid: c.uid, defId: c.defId }));
    return {
        events: drawEvents,
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { remaining: remainingUids, ordered: [] as { uid: string; defId: string }[] } },
        }),
    };
}

/** 占卜 onPlay：搜索牌库找一张行动卡放入手牌，然后洗牌库 */
function wizardScry(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const actionCards = player.deck.filter(c => c.type === 'action');
    if (actionCards.length === 0) return { events: [] };
    const options = actionCards.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        `wizard_scry_${ctx.now}`, ctx.playerId,
        '占卜：选择一张行动卡放入手牌', options, 'wizard_scry',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 变化之风 onPlay：洗手牌回牌库抽5张，额外打出一个行动*/
function wizardWindsOfChange(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const events: SmashUpEvent[] = [];

    // 1. 手牌洗入牌库
    // 注意：当前打出的行动卡（ctx.cardUid）会?ACTION_PLAYED reducer 从手牌移除，
    // 所以这里排除它
    const remainingHand = player.hand.filter(c => c.uid !== ctx.cardUid);
    const allCards = [...remainingHand, ...player.deck];
    const shuffled = ctx.random.shuffle([...allCards]);
    events.push(shuffleHandIntoDeck(
        ctx.playerId,
        shuffled.map(c => c.uid),
        'wizard_winds_of_change',
        ctx.now
    ));

    // 2. ?张牌（基于洗牌后的牌库）
    const drawCount = Math.min(5, shuffled.length);
    if (drawCount > 0) {
        const drawnUids = shuffled.slice(0, drawCount).map(c => c.uid);
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: drawCount, cardUids: drawnUids },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }

    // 3. 额外打出一个行动
    events.push(grantExtraAction(ctx.playerId, 'wizard_winds_of_change', ctx.now));

    return { events };
}

/** 献祭 onPlay：选择己方随从→消灭→抽等量力量的?*/
function wizardSacrifice(ctx: AbilityContext): AbilityResult {
    // 收集己方所有随从
    const myMinions: { uid: string; defId: string; power: number; baseIndex: number; ownerId: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            const power = getMinionPower(ctx.state, m, i);
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            myMinions.push({ uid: m.uid, defId: m.defId, power, baseIndex: i, ownerId: m.owner, label: `${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    if (myMinions.length === 0) return { events: [] };
    const options = myMinions.map(m => ({ uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: m.label }));
    const interaction = createSimpleChoice(
        `wizard_sacrifice_${ctx.now}`, ctx.playerId,
        '选择要牺牲的随从（抽取等量力量的牌）', buildMinionTargetOptions(options), 'wizard_sacrifice',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}


// ============================================================================
// Ongoing 拦截器注册
// ============================================================================

/** 注册巫师派系?ongoing 拦截?*/
function registerWizardOngoingEffects(): void {
    // 大法师：回合开始时，控制者额外打出一个行动
    registerTrigger('wizard_archmage', 'onTurnStart', (trigCtx) => {
        // 找到 archmage 的控制者?
        let archmageController: string | undefined;
        for (const base of trigCtx.state.bases) {
            const archmage = base.minions.find(m => m.defId === 'wizard_archmage');
            if (archmage) {
                archmageController = archmage.controller;
                break;
            }
        }
        if (!archmageController) return [];
        // 只在控制者的回合触发
        if (archmageController !== trigCtx.playerId) return [];

        return [{
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: archmageController,
                limitType: 'action' as const,
                delta: 1,
                reason: 'wizard_archmage',
            },
            timestamp: trigCtx.now,
        }];
    });
}


// ============================================================================
// 交互解决处理函数（InteractionHandler）
// ============================================================================

/** 注册巫师派系的交互解决处理函数 */
export function registerWizardInteractionHandlers(): void {
    // 学徒：选择放入手牌 or 作为额外行动打出
    registerInteractionHandler('wizard_neophyte', (state, playerId, value, iData, _random, timestamp) => {
        const { action } = value as { action: 'to_hand' | 'play_extra' };
        const cardUid = (iData as Record<string, unknown>)?.continuationContext
            ? ((iData as Record<string, unknown>).continuationContext as { cardUid: string }).cardUid
            : '';
        if (action === 'to_hand') {
            return {
                state,
                events: [{
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId, count: 1, cardUids: [cardUid] },
                    timestamp,
                } as SmashUpEvent],
            };
        }
        // play_extra: 放入手牌 + 额外行动
        return {
            state,
            events: [
                { type: SU_EVENTS.CARDS_DRAWN, payload: { playerId, count: 1, cardUids: [cardUid] }, timestamp } as SmashUpEvent,
                grantExtraAction(playerId, 'wizard_neophyte', timestamp),
            ],
        };
    });

    // 聚集秘术：选择对手行动卡→转移 + 额外行动
    registerInteractionHandler('wizard_mass_enchantment', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid, defId, pid } = value as { cardUid: string; defId: string; pid: string };
        return {
            state,
            events: [
                { type: SU_EVENTS.CARD_TRANSFERRED, payload: { cardUid, defId, fromPlayerId: pid, toPlayerId: playerId, reason: 'wizard_mass_enchantment' }, timestamp } as SmashUpEvent,
                grantExtraAction(playerId, 'wizard_mass_enchantment', timestamp),
            ],
        };
    });

    // 占卜：选择行动卡→展示给所有人→放入手牌→洗混牌库
    registerInteractionHandler('wizard_scry', (state, playerId, value, _iData, random, timestamp) => {
        const { cardUid, defId } = value as { cardUid: string; defId?: string };
        const player = state.core.players[playerId];

        const events: SmashUpEvent[] = [];

        // 展示选中的卡给所有玩家（规则："展示给所有玩家"）
        if (defId) {
            events.push({
                type: SU_EVENTS.REVEAL_HAND,
                payload: {
                    targetPlayerId: playerId,
                    viewerPlayerId: 'all',
                    cards: [{ uid: cardUid, defId }],
                    sourcePlayerId: playerId,
                    reason: 'wizard_scry',
                },
                timestamp,
            });
        }

        // 放入手牌
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [cardUid] },
            timestamp,
        });
        // 洗混牌库（移除已抽取的卡后重新洗混）
        const remainingDeck = player.deck.filter(c => c.uid !== cardUid);
        const shuffled = random.shuffle([...remainingDeck]);
        const reshuffleEvt: DeckReshuffledEvent = {
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: { playerId, deckUids: shuffled.map(c => c.uid) },
            timestamp,
        };
        events.push(reshuffleEvt);
        return {
            state,
            events,
        };
    });

    // 传送：玩家选择要拿的随从
    registerInteractionHandler('wizard_portal_pick', (state, playerId, value, iData, _random, timestamp) => {
        const ctx = (iData as any)?.continuationContext as { allTopCards: { uid: string; defId: string; type: string }[] };
        if (!ctx) return undefined;

        // value 是多选结果数组（每项 { cardUid, defId }）
        const picks = Array.isArray(value) ? value as { cardUid: string; defId: string }[] : [value as { cardUid: string; defId: string }];
        const pickedUids = new Set(picks.map(p => p.cardUid));

        // 选中的随从放入手牌
        const events: SmashUpEvent[] = [];
        if (pickedUids.size > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId, count: pickedUids.size, cardUids: [...pickedUids] },
                timestamp,
            } as CardsDrawnEvent);
        }

        // 剩余的牌（未选随从 + 非随从）需要排序放回牌库顶
        const remaining = ctx.allTopCards
            .filter(c => !pickedUids.has(c.uid))
            .map(c => ({ uid: c.uid, defId: c.defId }));

        if (remaining.length === 0) return { state, events };
        if (remaining.length === 1) {
            events.push({
                type: SU_EVENTS.CARD_TO_DECK_TOP,
                payload: { cardUid: remaining[0].uid, defId: remaining[0].defId, ownerId: playerId, reason: 'wizard_portal' },
                timestamp,
            } as CardToDeckTopEvent);
            return { state, events };
        }

        // 多张：进入排序流程
        const options = remaining.map((c, i) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
        });
        const next = createSimpleChoice(
            `wizard_portal_order_${timestamp}`, playerId,
            '传送：选择放回牌库顶的第一张牌（最先选的在最上面）', options, 'wizard_portal_order',
        );
        return {
            state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { remaining, ordered: [] } } }),
            events,
        };
    });

    // 传送：逐个选择非随从牌放回牌库顶的顺序
    registerInteractionHandler('wizard_portal_order', (state, playerId, value, iData, _random, timestamp) => {
        const { cardUid, defId } = value as { cardUid: string; defId: string };
        const ctx = (iData as any)?.continuationContext as { remaining: { uid: string; defId: string }[]; ordered: { uid: string; defId: string }[] };
        if (!ctx) return undefined;
        const ordered = [...ctx.ordered, { uid: cardUid, defId }];
        const remaining = ctx.remaining.filter(c => c.uid !== cardUid);
        if (remaining.length <= 1) {
            // 最后一张或没有了，全部放回牌库顶
            const allCards = remaining.length === 1 ? [...ordered, remaining[0]] : ordered;
            // 按选择顺序放回：先选的在最上面，所以倒序 push CARD_TO_DECK_TOP
            const events: SmashUpEvent[] = [];
            for (let i = allCards.length - 1; i >= 0; i--) {
                events.push({
                    type: SU_EVENTS.CARD_TO_DECK_TOP,
                    payload: { cardUid: allCards[i].uid, defId: allCards[i].defId, ownerId: playerId, reason: 'wizard_portal' },
                    timestamp,
                } as CardToDeckTopEvent);
            }
            return { state, events };
        }
        // 还有多张，继续选
        const options = remaining.map((c, i) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
        });
        const next = createSimpleChoice(
            `wizard_portal_order_${timestamp}`, playerId,
            `传送：选择下一张放回牌库顶的牌（已选 ${ordered.length} 张）`, options, 'wizard_portal_order',
        );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { remaining, ordered } } }), events: [] };
    });

    // 献祭：选择随从→消灭 + 抽牌
    registerInteractionHandler('wizard_sacrifice', (state, playerId, value, _iData, random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const minion = base.minions.find(m => m.uid === minionUid);
        if (!minion) return undefined;
        const power = getMinionPower(state.core, minion, baseIndex);
        const events: SmashUpEvent[] = [
            destroyMinion(minion.uid, minion.defId, baseIndex, minion.owner, 'wizard_sacrifice', timestamp),
        ];
        if (power > 0) {
            const player = state.core.players[playerId];
            const { drawnUids } = drawCards(player, power, random);
            if (drawnUids.length > 0) {
                events.push({ type: SU_EVENTS.CARDS_DRAWN, payload: { playerId, count: drawnUids.length, cardUids: drawnUids }, timestamp } as SmashUpEvent);
            }
        }
        return { state, events };
    });
}
