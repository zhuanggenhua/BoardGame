/**
 * 大杀四方 - 吸血鬼派系能力
 *
 * 主题：消灭低力量随从获取+1力量指示物
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter, addOngoingCardCounter, destroyMinion,
    buildMinionTargetOptions,
    resolveOrPrompt, findMinionOnBases, buildAbilityFeedback,
    buildBaseTargetOptions,
    buildValidatedDestroyEvents,
    addTempPower,
    addPermanentPower,
    revealAndPickFromDeck,
    buildStandardDrawEvents,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, SmashUpCore } from '../domain/types';
import { registerTrigger, registerRestriction } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { getCardDef, getMinionDef, getBaseDef } from '../data/cards';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { MinionPlayedEvent } from '../domain/types';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { matchesDefId } from '../domain/utils';

// ============================================================================
// 注册入口
// ============================================================================

export function registerVampireAbilities(): void {
    // 随从
    registerAbility('vampire_fledgling_vampire', 'onPlay', vampireFledgling);
    registerAbility('vampire_heavy_drinker', 'onPlay', vampireHeavyDrinker);
    registerAbility('vampire_nightstalker', 'onPlay', vampireNightstalker);

    // 行动卡
    registerAbility('vampire_buffet', 'special', vampireBuffetSpecial);
    registerAbility('vampire_dinner_date', 'onPlay', vampireDinnerDate);
    registerAbility('vampire_big_gulp', 'onPlay', vampireBigGulp);
    registerAbility('vampire_mad_monster_party', 'onPlay', vampireMadMonsterParty);
    registerAbility('vampire_cull_the_weak', 'onPlay', vampireCullTheWeak);
    registerAbility('vampire_crack_of_dusk', 'onPlay', vampireCrackOfDusk);

    // ongoing 效果
    registerVampireOngoingEffects();

    // === POD abilities ===
    registerVampirePodAbilities();
    registerVampirePodOngoingEffects();
}

export function registerVampireInteractionHandlers(): void {
    registerInteractionHandler('vampire_heavy_drinker', handleHeavyDrinkerChoice);
    registerInteractionHandler('vampire_nightstalker', handleNightstalkerChoice);
    registerInteractionHandler('vampire_dinner_date', handleDinnerDateChooseMinion);
    registerInteractionHandler('vampire_dinner_date_target', handleDinnerDateChooseTarget);
    registerInteractionHandler('vampire_big_gulp', handleBigGulpChoice);
    registerInteractionHandler('vampire_cull_the_weak', handleCullTheWeakChooseMinion);
    registerInteractionHandler('vampire_cull_the_weak_choose_card', handleCullTheWeakChooseCard);
    registerInteractionHandler('vampire_crack_of_dusk', handleCrackOfDuskChoice);
    registerInteractionHandler('vampire_crack_of_dusk_base', handleCrackOfDuskChooseBase);

    // POD handlers
    registerInteractionHandler('vampire_heavy_drinker_pod', handleHeavyDrinkerPodChoice);
    registerInteractionHandler('vampire_the_count_pod_add_counter', handleCountPodAddCounter);
    registerInteractionHandler('vampire_the_count_pod_talent', handleCountPodTalent);
    registerInteractionHandler('vampire_nightstalker_pod_talent', handleNightstalkerPodTalent);
    registerInteractionHandler('vampire_big_gulp_pod', handleBigGulpPodChoice);
    registerInteractionHandler('vampire_cull_the_weak_pod', handleCullTheWeakPodChooseMinion);
    registerInteractionHandler('vampire_cull_the_weak_pod_choose_card', handleCullTheWeakPodChooseCard);
    registerInteractionHandler('vampire_crack_of_dusk_pod', handleCrackOfDuskPodChoice);
    registerInteractionHandler('vampire_crack_of_dusk_pod_base', handleCrackOfDuskPodChooseBase);
    registerInteractionHandler('vampire_dinner_date_pod', handleDinnerDatePodChooseMinion);
    registerInteractionHandler('vampire_wolf_pact_pod_minion', handleWolfPactPodPickDebuffTarget);
    registerInteractionHandler('vampire_wolf_pact_pod_minion_target', handleWolfPactPodPickCounterTarget);
    registerInteractionHandler('vampire_wolf_pact_pod_action', handleWolfPactPodShuffleChoice);
    registerInteractionHandler('vampire_fledgling_vampire_pod_bury_source', handleFledglingPodBuryChooseSource);
    registerInteractionHandler('vampire_fledgling_vampire_pod_bury_base', handleFledglingPodBuryChooseBase);
}

function registerVampirePodAbilities(): void {
    // Minions
    registerAbility('vampire_heavy_drinker_pod', 'onPlay', vampireHeavyDrinkerPod);
    registerAbility('vampire_buffet_pod', 'onPlay', vampireBuffetPod);
    registerAbility('vampire_big_gulp_pod', 'onPlay', vampireBigGulpPod);
    registerAbility('vampire_cull_the_weak_pod', 'onPlay', vampireCullTheWeakPod);
    registerAbility('vampire_crack_of_dusk_pod', 'onPlay', vampireCrackOfDuskPod);
    registerAbility('vampire_dinner_date_pod', 'onPlay', vampireDinnerDatePod);
    registerAbility('vampire_fledgling_vampire_pod', 'onPlay', vampireFledglingVampirePodOnPlay);
    registerAbility('vampire_wolf_pact_pod', 'onPlay', vampireWolfPactPodMinionOnPlay);
    registerAbility('vampire_wolf_pact_pod_action', 'onPlay', vampireWolfPactPodActionOnPlay);

    // Talents
    registerAbility('vampire_the_count_pod', 'talent', vampireCountPodTalent);
    registerAbility('vampire_nightstalker_pod', 'talent', vampireNightstalkerPodTalent);
    registerAbility('vampire_stakeout_pod', 'talent', vampireStakeoutPodTalent);

    // Specials implemented via triggers after destroy (see ongoing effects)
}

function schedulePowerModifierUntilNextTurnStart(
    state: MatchState<SmashUpCore>,
    minionUid: string,
    amount: number,
    reason: string,
): MatchState<SmashUpCore> {
    if (amount === 0) return state;
    const expiresOnTurnNumber = state.core.turnNumber + state.core.turnOrder.length;
    const timed = state.core.timedPowerModifiers ?? [];
    return {
        ...state,
        core: {
            ...state.core,
            timedPowerModifiers: [
                ...timed,
                { minionUid, amount, expiresOnTurnNumber, reason },
            ],
        },
    };
}

function registerVampirePodOngoingEffects(): void {
    // The Count POD: after any minion destroyed, you may place a +1 counter on a minion at its base.
    registerTrigger('vampire_the_count_pod', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, baseIndex, now } = ctx;
        if (baseIndex === undefined) return [];
        const base = state.bases[baseIndex];
        if (!base) return [];
        if (!ctx.matchState) return [];

        // 规则：任意基地上的 The Count POD 都可在“被消灭随从所在基地”放置指示物。
        const counts = state.bases.flatMap(
            b => b.minions.filter(m => matchesDefId(m.defId, 'vampire_the_count_pod')),
        );
        if (counts.length === 0) return [];

        const options = base.minions.map((m, i) => {
            const def = getCardDef(m.defId);
            return {
                id: `m-${i}`,
                label: def?.name ?? m.defId,
                value: { minionUid: m.uid, defId: m.defId, baseIndex },
                _source: 'field' as const,
                displayMode: 'card' as const,
            };
        });
        if (options.length === 0) return [];
        let matchState = ctx.matchState;
        for (const count of counts) {
            const interaction = createSimpleChoice(
                `vampire_the_count_pod_add_${count.uid}_${now}`,
                count.controller,
                '吸血鬼伯爵：你可以在该基地的一个随从上放置+1战斗力指示物',
                [
                    ...options,
                    { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
                ] as any[],
                { sourceId: 'vampire_the_count_pod_add_counter', targetType: 'minion' },
            );
            (interaction.data as any).continuationContext = { countUid: count.uid };
            matchState = queueInteraction(matchState, interaction);
        }
        return { events: [], matchState } as any;
    }, { optional: true });

    // Dinner Date POD：被附着随从若力量变为 0，则将其消灭。
    registerTrigger('vampire_dinner_date_pod', 'onMinionAffected', (ctx: TriggerContext) => {
        const { state, baseIndex, triggerMinionUid, now } = ctx;
        if (baseIndex === undefined || !triggerMinionUid) return [];
        const base = state.bases[baseIndex];
        if (!base) return [];
        const minion = base.minions.find(m => m.uid === triggerMinionUid);
        if (!minion) return [];
        const attachment = minion.attachedActions.find(a => a.defId === 'vampire_dinner_date_pod');
        if (!attachment) return [];
        if (getEffectivePower(state, minion, baseIndex) > 0) return [];
        return buildValidatedDestroyEvents(state, {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: baseIndex,
            destroyerId: attachment.ownerId,
            reason: 'vampire_dinner_date_pod',
            now,
        });
    });

    // Buffet POD: after you destroy a minion, you may play Buffet from hand (draw 2).
    registerTrigger('vampire_buffet_pod', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, now } = ctx;
        const destroyerId = (ctx as any).destroyerId as PlayerId | undefined;
        if (!destroyerId) return [];
        const p = state.players[destroyerId];
        const buffet = p.hand.find(c => c.defId === 'vampire_buffet_pod');
        if (!buffet) return [];
        const interaction = createSimpleChoice(
            `vampire_buffet_pod_${destroyerId}_${now}`,
            destroyerId,
            '自助餐：你可以打出此牌（抽两张牌）',
            [
                { id: 'play', label: '打出自助餐', value: { play: true }, displayMode: 'button' as const },
                { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ] as any[],
            { sourceId: 'vampire_buffet_pod_play', targetType: 'button' },
        );
        (interaction.data as any).continuationContext = { cardUid: buffet.uid, defId: buffet.defId };
        return { events: [], matchState: queueInteraction(ctx.matchState!, interaction) } as any;
    }, { optional: true, global: true });

    registerInteractionHandler('vampire_buffet_pod_play', (state, playerId, value, iData, random, timestamp) => {
        const v = value as any;
        if (v?.skip) return { state, events: [] };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; defId: string } | undefined;
        if (!ctx) return { state, events: [] };
        const events: SmashUpEvent[] = [
            { type: SU_EVENTS.ACTION_PLAYED, payload: { playerId, cardUid: ctx.cardUid, defId: ctx.defId, isExtraAction: true }, timestamp } as any,
        ];
        events.push(...buildStandardDrawEvents(state.core, playerId, 2, random, timestamp));
        return { state, events };
    });

    // Mad Monster Party POD: after you destroy a minion, choose its base and place +1 counter on each of your minions there.
    registerTrigger('vampire_mad_monster_party_pod', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const destroyerId = (ctx as any).destroyerId as PlayerId | undefined;
        if (!destroyerId) return [];
        const baseIndex = ctx.baseIndex;
        if (baseIndex === undefined) return [];
        const p = ctx.state.players[destroyerId];
        const card = p.hand.find(c => c.defId === 'vampire_mad_monster_party_pod');
        if (!card) return [];
        const interaction = createSimpleChoice(
            `vampire_mad_monster_party_pod_${destroyerId}_${ctx.now}`,
            destroyerId,
            '疯狂怪物派对：你可以打出此牌（选择被消灭随从的基地）',
            [
                { id: 'play', label: '打出疯狂怪物派对', value: { play: true }, displayMode: 'button' as const },
                { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ] as any[],
            { sourceId: 'vampire_mad_monster_party_pod_play', targetType: 'button' },
        );
        (interaction.data as any).continuationContext = { cardUid: card.uid, baseIndex };
        return { events: [], matchState: queueInteraction(ctx.matchState!, interaction) } as any;
    }, { optional: true, global: true });

    registerInteractionHandler('vampire_mad_monster_party_pod_play', (state, playerId, value, iData, _random, timestamp) => {
        const v = value as any;
        if (v?.skip) return { state, events: [] };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; baseIndex: number } | undefined;
        if (!ctx) return { state, events: [] };
        const base = state.core.bases[ctx.baseIndex];
        if (!base) return { state, events: [] };
        const events: SmashUpEvent[] = [
            { type: SU_EVENTS.ACTION_PLAYED, payload: { playerId, cardUid: ctx.cardUid, defId: 'vampire_mad_monster_party_pod', isExtraAction: true }, timestamp } as any,
        ];
        for (const m of base.minions) {
            if (m.controller === playerId) events.push(addPowerCounter(m.uid, ctx.baseIndex, 1, 'vampire_mad_monster_party_pod', timestamp));
        }
        return { state, events };
    });

    // Fledgling Vampire POD: after you destroy another minion, you may bury this card from hand or discard on any base.
    registerTrigger('vampire_fledgling_vampire_pod', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, destroyerId, triggerMinionUid, now } = ctx;
        if (!destroyerId) return [];
        // "another minion" => don't trigger if the destroyed minion itself is a Fledgling in play
        if (triggerMinionUid && state.bases.some(b => b.minions.some(m => m.uid === triggerMinionUid && m.defId === 'vampire_fledgling_vampire_pod'))) {
            return [];
        }
        const p = state.players[destroyerId];
        if (!p) return [];
        const inHand = p.hand.filter(c => c.defId === 'vampire_fledgling_vampire_pod');
        const inDiscard = p.discard.filter(c => c.defId === 'vampire_fledgling_vampire_pod');
        if (inHand.length === 0 && inDiscard.length === 0) return [];

        const options: any[] = [
            ...inHand.map((c, i) => ({
                id: `hand-${i}`,
                label: '从手牌埋葬',
                value: { cardUid: c.uid, from: 'hand' },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            })),
            ...inDiscard.map((c, i) => ({
                id: `discard-${i}`,
                label: '从弃牌堆埋葬',
                value: { cardUid: c.uid, from: 'discard' },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            })),
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
        ];

        const interaction = createSimpleChoice(
            `vampire_fledgling_vampire_pod_bury_${destroyerId}_${now}`,
            destroyerId,
            '新生吸血鬼：你可以埋葬这张牌到任意基地',
            options,
            { sourceId: 'vampire_fledgling_vampire_pod_bury_source', targetType: 'generic' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState!, interaction) } as any;
    }, { optional: true, global: true });

    // Stakeout POD restriction: block minions power>=3 when active
    registerRestriction('vampire_stakeout_pod', 'play_minion', (rctx) => {
        const blocks = rctx.state.stakeoutPodBlocks ?? [];
        const block = blocks.find(b => b.baseIndex === rctx.baseIndex);
        if (!block) return false;
        if (rctx.playerId === block.ownerId) return false;
        const power = (rctx.extra?.basePower as number | undefined) ?? 0;
        return power >= 3;
    });
}

const handleFledglingPodBuryChooseSource: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as any;
    if (v?.skip) return { state, events: [] };
    if (!v?.cardUid) return { state, events: [] };
    const bases = state.core.bases.map((b, i) => ({ baseIndex: i, label: getBaseDef(b.defId)?.name ?? `基地 #${i + 1}` }));
    const baseOptions = buildBaseTargetOptions(bases, state.core);
    const interaction = createSimpleChoice(
        `vampire_fledgling_vampire_pod_bury_base_${now}`,
        playerId,
        '选择要埋葬到的基地',
        baseOptions,
        { sourceId: 'vampire_fledgling_vampire_pod_bury_base', targetType: 'base' },
    );
    (interaction.data as any).continuationContext = { cardUid: v.cardUid, fromDiscard: v.from === 'discard' };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleFledglingPodBuryChooseBase: IH = (state, playerId, value, interactionData, _random, now) => {
    const ctx = interactionData?.continuationContext as { cardUid: string; fromDiscard: boolean } | undefined;
    if (!ctx) return { state, events: [] };
    const v = value as any;
    const baseIndex = v?.baseIndex as number | undefined;
    if (baseIndex === undefined) return { state, events: [] };
    const buriedEvt: SmashUpEvent = {
        type: SU_EVENTS.CARD_BURIED,
        payload: {
            playerId,
            cardUid: ctx.cardUid,
            defId: 'vampire_fledgling_vampire_pod',
            baseIndex,
            trueOwnerId: playerId,
            buriedFrom: ctx.fromDiscard ? 'discard' : 'hand',
            reason: 'vampire_fledgling_vampire_pod',
        } as any,
        timestamp: now,
    };
    return { state, events: [buriedEvt] };
};

// ============================================================================
// 随从能力
// ============================================================================

function vampireFledglingVampirePodOnPlay(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    const playedFrom = (found.minion.metadata?.playedFrom as string | undefined) ?? 'hand';
    if (playedFrom === 'hand') return { events: [] };
    return { events: [addPowerCounter(found.minion.uid, found.baseIndex, 1, 'vampire_fledgling_vampire_pod', ctx.now)] };
}

/** 新生吸血鬼 onPlay：如果对手在这里力量更高，本随从+1指示物 */
function vampireFledgling(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    let myTotal = 0, maxOpponent = 0;
    for (const m of ctx.state.bases[found.baseIndex].minions) {
        const power = getEffectivePower(ctx.state, m, found.baseIndex);
        if (m.controller === ctx.playerId) myTotal += power;
    }
    const opponentTotals = new Map<string, number>();
    for (const m of ctx.state.bases[found.baseIndex].minions) {
        if (m.controller === ctx.playerId) continue;
        opponentTotals.set(m.controller, (opponentTotals.get(m.controller) ?? 0) + getEffectivePower(ctx.state, m, found.baseIndex));
    }
    for (const total of opponentTotals.values()) {
        if (total > maxOpponent) maxOpponent = total;
    }
    if (maxOpponent > myTotal) {
        return { events: [addPowerCounter(found.minion.uid, found.baseIndex, 1, 'vampire_fledgling_vampire', ctx.now)] };
    }
    return { events: [] };
}

/** 渴血鬼 talent：消灭己方一个随从来给自己+1指示物 */
function vampireHeavyDrinker(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId && m.uid !== ctx.cardUid) {
                const def = getCardDef(m.defId);
                targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId}` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options: any[] = targets.map((t, i) => ({
        id: `minion-${i}`, label: `消灭 ${t.label}`,
        value: {
            minionUid: t.uid,
            minionDefId: t.defId,
            defId: t.defId,
            baseIndex: t.baseIndex,
            sourceMinionUid: found.minion.uid,
            sourceBaseIndex: found.baseIndex,
        },
        _source: 'field' as const,
        displayMode: 'card' as const,
    }));
    options.push({ id: 'skip', label: '跳过（不消灭）', value: { skip: true }, displayMode: 'button' as const });
    return resolveOrPrompt(ctx, options, {
        id: 'vampire_heavy_drinker', title: '选择要消灭的己方随从（本随从+1指示物）',
        sourceId: 'vampire_heavy_drinker', targetType: 'minion' as const,
    }, (rawVal) => {
        const val = rawVal as any;
        if (val.skip) return { events: [] };
        const destroyEvents = buildValidatedDestroyEvents(ctx.state, {
            minionUid: val.minionUid,
            minionDefId: val.defId,
            fromBaseIndex: val.baseIndex,
            destroyerId: ctx.playerId,
            reason: 'vampire_heavy_drinker',
            now: ctx.now,
        });
        if (destroyEvents.length === 0) return { events: [] };
        return {
            events: [
                ...destroyEvents,
                addPowerCounter(val.sourceMinionUid, val.sourceBaseIndex, 1, 'vampire_heavy_drinker', ctx.now),
            ],
        };
    });
}

/** 夜行者 onPlay：消灭同基地力量≤2的随从，本随从+1指示物 */
function vampireNightstalker(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (const m of ctx.state.bases[found.baseIndex].minions) {
        if (m.uid === ctx.cardUid) continue;
        const power = getEffectivePower(ctx.state, m, found.baseIndex);
        if (power <= 2) {
            const def = getCardDef(m.defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: found.baseIndex, label: `${def?.name ?? m.defId} (力量 ${power})` });
        }
    }
    if (targets.length === 0) return { events: [] };
    const minionOptions = buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' });
    if (minionOptions.length === 0) return { events: [] };
    const nsOptions: any[] = [...minionOptions];
    for (const option of nsOptions) {
        if (!option?.value) continue;
        option.value = {
            ...option.value,
            sourceMinionUid: found.minion.uid,
            sourceBaseIndex: found.baseIndex,
        };
    }
    nsOptions.push({ id: 'skip', label: '跳过（不消灭）', value: { skip: true }, displayMode: 'button' as const });
    return resolveOrPrompt(ctx, nsOptions, {
        id: 'vampire_nightstalker', title: '选择要消灭的力量≤2随从（本随从+1指示物）',
        sourceId: 'vampire_nightstalker', targetType: 'minion' as const,
    }, (rawVal) => {
        const val = rawVal as any;
        if (val.skip) return { events: [] };
        const destroyEvents = buildValidatedDestroyEvents(ctx.state, {
            minionUid: val.minionUid,
            minionDefId: val.defId,
            fromBaseIndex: val.baseIndex,
            destroyerId: ctx.playerId,
            reason: 'vampire_nightstalker',
            now: ctx.now,
        });
        if (destroyEvents.length === 0) return { events: [] };
        return {
            events: [
                ...destroyEvents,
                addPowerCounter(val.sourceMinionUid, val.sourceBaseIndex, 1, 'vampire_nightstalker', ctx.now + 1), // +1ms 避免音频节流
            ],
        };
    });
}

// ============================================================================
// 行动卡能力
// ============================================================================

/** 自助餐 special：ARM 延迟到计分后触发 */
function vampireBuffetSpecial(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
            payload: {
                sourceDefId: 'vampire_buffet',
                playerId: ctx.playerId,
                baseIndex: ctx.baseIndex,
                cardUid: ctx.cardUid,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

/** 晚餐约会 onPlay：选己方随从+1指示物，然后消灭同基地力量≤2随从 */
function vampireDinnerDate(ctx: AbilityContext): AbilityResult {
    const ownMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const def = getCardDef(m.defId);
                ownMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId}` });
            }
        }
    }
    if (ownMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = ownMinions.map((c, i) => ({
        id: `minion-${i}`, label: c.label,
        value: { minionUid: c.uid, minionDefId: c.defId, baseIndex: c.baseIndex },
        _source: 'field' as const,
        displayMode: 'card' as const,
    }));
    return resolveOrPrompt(ctx, options, {
        id: 'vampire_dinner_date', title: '选择你的随从放置+1指示物（然后消灭同基地力量≤2随从）',
        sourceId: 'vampire_dinner_date', targetType: 'minion' as const,
    }, (val) => {
        const handled = handleDinnerDateChooseMinion(
            ctx.matchState,
            ctx.playerId,
            { minionUid: val.minionUid, baseIndex: val.baseIndex },
            undefined,
            ctx.random,
            ctx.now,
        );
        if (!handled) return { events: [] };
        return {
            events: handled.events,
            matchState: handled.state,
        };
    });
}

/** 一大口 onPlay：消灭一个力量≤4的随从（可跳过） */
function vampireBigGulp(ctx: AbilityContext): AbilityResult {
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const power = getEffectivePower(ctx.state, m, i);
            if (power <= 4) {
                const def = getCardDef(m.defId);
                targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (力量 ${power})` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' });
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.all_protected', ctx.now)] };
    
    // 添加"跳过"选项
    const skipOption = { id: 'skip', label: '跳过', value: { skip: true } , displayMode: 'button' as const };
    
    return resolveOrPrompt(ctx, [...options, skipOption], {
        id: 'vampire_big_gulp', title: '选择要消灭的力量≤4随从（可跳过）',
        sourceId: 'vampire_big_gulp', targetType: 'minion' as const,
    }, (val) => {
        // 跳过时不消灭随从
        if ((val as any).skip) return { events: [] };
        
        const minion = ctx.state.bases[val.baseIndex]?.minions.find(m => m.uid === val.minionUid);
        if (!minion) {
            return { events: [] };
        }
        return {
            events: [destroyMinion(val.minionUid, val.defId, val.baseIndex, minion.owner, ctx.playerId, 'vampire_big_gulp', ctx.now)],
        };
    });
}

/** 疯狂怪物派对 onPlay：没有+1指示物的己方随从各放一个 */
function vampireMadMonsterParty(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId && m.powerCounters === 0) {
                events.push(addPowerCounter(m.uid, i, 1, 'vampire_mad_monster_party', ctx.now));
            }
        }
    }
    return { events };
}

/** 剔除弱者 onPlay：选己方随从，弃手牌随从卡，每弃1张+1指示物 */
function vampireCullTheWeak(ctx: AbilityContext): AbilityResult {
    const ownMinions: { uid: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const def = getCardDef(m.defId);
                ownMinions.push({ uid: m.uid, baseIndex: i, label: `${def?.name ?? m.defId}` });
            }
        }
    }
    if (ownMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const player = ctx.state.players[ctx.playerId];
    const minionCardsInHand = player.hand.filter(c => c.type === 'minion');
    if (minionCardsInHand.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_minion_cards_in_hand', ctx.now)] };
    const options = ownMinions.map((c, i) => ({
        id: `minion-${i}`, label: c.label,
        value: { minionUid: c.uid, minionDefId: c.defId, baseIndex: c.baseIndex },
        _source: 'field' as const,
        displayMode: 'card' as const,
    }));
    return resolveOrPrompt(ctx, options, {
        id: 'vampire_cull_the_weak', title: '选择你的随从（弃手牌随从卡来放指示物）',
        sourceId: 'vampire_cull_the_weak', targetType: 'minion' as const,
    }, (val) => {
        const interaction = createCullTheWeakCardInteraction(
            ctx.matchState,
            ctx.playerId,
            { minionUid: val.minionUid, baseIndex: val.baseIndex },
            ctx.now,
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });
}

/** 破晓 onPlay：从弃牌堆打出力量≤2随从并+1指示物 */
function vampireCrackOfDusk(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const candidates = player.discard.filter(c => {
        if (c.type !== 'minion') return false;
        const def = getCardDef(c.defId);
        return def && def.type === 'minion' && (def as { power: number }).power <= 2;
    });
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = candidates.map((c, i) => {
        const def = getCardDef(c.defId);
        return { id: `card-${i}`, label: `${def?.name ?? c.defId}`, value: { cardUid: c.uid, defId: c.defId }, _source: 'discard' as const, displayMode: 'card' as const };
    });
    return resolveOrPrompt(ctx, options, {
        id: 'vampire_crack_of_dusk', title: '从弃牌堆选择力量≤2的随从打出（+1指示物）',
        sourceId: 'vampire_crack_of_dusk', targetType: 'generic' as const,
    }, (val) => {
        // 选完随从后，创建基地选择交互
        return crackOfDuskCreateBaseSelect(ctx.matchState, ctx.playerId, val.cardUid, val.defId, ctx.now);
    });
}

function crackOfDuskCreateBaseSelect(state: MatchState<SmashUpCore>, playerId: string, cardUid: string, defId: string, now: number): AbilityResult {
    const core = state.core;
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < core.bases.length; i++) {
        const baseDef = getBaseDef(core.bases[i].defId);
        candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 #${i + 1}` });
    }
    if (candidates.length === 0) return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_bases', now)] };
    const baseOptions = buildBaseTargetOptions(candidates, core);
    const interaction = createSimpleChoice(
        `vampire_crack_of_dusk_base_${now}`, playerId,
        '选择要打出随从的基地', baseOptions,
        { sourceId: 'vampire_crack_of_dusk_base', targetType: 'base' },
    );
    // 将选中的随从信息写入 continuationContext
    const enriched = {
        ...interaction,
        data: { ...interaction.data, continuationContext: { cardUid, defId } },
    };
    return {
        matchState: queueInteraction(state, enriched),
        events: [],
    };
}

// 剔除弱者 多选辅助
// ============================================================================

interface CullTheWeakCardContext {
    minionUid: string;
    baseIndex: number;
}

function buildCullTheWeakCardOptions(core: SmashUpCore, playerId: string) {
    const player = core.players[playerId];
    if (!player) return [];
    const cardOptions = player.hand
        .filter(c => c.type === 'minion')
        .map((c, i) => {
            const def = getCardDef(c.defId);
            return {
                id: `card-${i}`,
                label: `${def?.name ?? c.defId}`,
                value: { cardUid: c.uid, defId: c.defId },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            };
        });
    return [
        ...cardOptions,
        { id: 'stop', label: '停止弃置并结算', value: { stop: true }, displayMode: 'button' as const },
    ];
}

function createCullTheWeakCardInteraction(
    ms: MatchState<SmashUpCore>,
    playerId: string,
    context: CullTheWeakCardContext,
    now: number,
) {
    const options = buildCullTheWeakCardOptions(ms.core, playerId);
    const interaction = createSimpleChoice<any>(
        `vampire_cull_the_weak_choose_card_${now}`,
        playerId,
        '剔除弱者：点击手牌中的随从卡弃置（每弃一张+1指示物），或点击停止结算',
        options,
        {
            sourceId: 'vampire_cull_the_weak_choose_card',
            targetType: 'hand' as const,
            autoResolveIfSingle: false,
        },
    );

    return {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: context,
            optionsGenerator: (nextState: { core: SmashUpCore }) => buildCullTheWeakCardOptions(nextState.core, playerId),
        },
    };
}

// ============================================================================
// 交互处理函数
// ============================================================================

type IH = (
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number
) => { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined;

const handleHeavyDrinkerChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as {
        minionUid?: string;
        defId?: string;
        baseIndex?: number;
        skip?: boolean;
        sourceMinionUid?: string;
        sourceBaseIndex?: number;
    };

    if (v.skip) return { state, events: [] };
    if (!v.minionUid || !v.defId || v.baseIndex === undefined) return undefined;
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) return undefined;
    let hdUid = v.sourceMinionUid ?? '';
    let hdBase = v.sourceBaseIndex ?? -1;
    if (!hdUid || hdBase < 0) {
        for (let i = 0; i < state.core.bases.length; i++) {
            const found = state.core.bases[i].minions.find(m => matchesDefId(m.defId, 'vampire_heavy_drinker') && m.controller === playerId);
            if (found) {
                hdUid = found.uid;
                hdBase = i;
                break;
            }
        }
    }

    if (!hdUid) return undefined;
    const destroyEvents = buildValidatedDestroyEvents(state, {
        minionUid: v.minionUid,
        minionDefId: v.defId,
        fromBaseIndex: v.baseIndex,
        destroyerId: playerId,
        reason: 'vampire_heavy_drinker',
        now,
    });
    if (destroyEvents.length === 0) return { state, events: [] };
    return {
        state,
        events: [
            ...destroyEvents,
            addPowerCounter(hdUid, hdBase, 1, 'vampire_heavy_drinker', now + 1), // +1ms 避免音频节流
        ],
    };
};

const handleNightstalkerChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as {
        minionUid?: string;
        defId?: string;
        baseIndex?: number;
        skip?: boolean;
        sourceMinionUid?: string;
        sourceBaseIndex?: number;
    };

    if (v.skip) return { state, events: [] };
    if (!v.minionUid || !v.defId || v.baseIndex === undefined) return undefined;
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) return undefined;

    let nsUid = v.sourceMinionUid ?? '';
    let nsBase = v.sourceBaseIndex ?? -1;
    if (!nsUid || nsBase < 0) {
        for (let i = 0; i < state.core.bases.length; i++) {
            const found = state.core.bases[i].minions.find(m => matchesDefId(m.defId, 'vampire_nightstalker') && m.controller === playerId);
            if (found) {
                nsUid = found.uid;
                nsBase = i;
                break;
            }
        }
    }

    if (!nsUid) return undefined;
    const destroyEvents = buildValidatedDestroyEvents(state, {
        minionUid: v.minionUid,
        minionDefId: v.defId,
        fromBaseIndex: v.baseIndex,
        destroyerId: playerId,
        reason: 'vampire_nightstalker',
        now,
    });
    if (destroyEvents.length === 0) return { state, events: [] };
    return {
        state,
        events: [
            ...destroyEvents,
            addPowerCounter(nsUid, nsBase, 1, 'vampire_nightstalker', now + 1), // +1ms 避免音频节流
        ],
    };
};

const handleDinnerDateChooseMinion: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number };
    const events: SmashUpEvent[] = [addPowerCounter(v.minionUid, v.baseIndex, 1, 'vampire_dinner_date', now)];
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (const m of state.core.bases[v.baseIndex].minions) {
        if (m.uid === v.minionUid) continue;
        const power = getEffectivePower(state.core, m, v.baseIndex);
        if (power <= 2) {
            const def = getCardDef(m.defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: v.baseIndex, label: `${def?.name ?? m.defId} (力量 ${power})` });
        }
    }
    if (targets.length === 0) return { state, events };
    const options = buildMinionTargetOptions(targets, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' });
    if (options.length === 0) return { state, events };
    const interaction = createSimpleChoice(
        `vampire_dinner_date_target_${now}`, playerId,
        '选择要消灭的力量≤2随从', options,
        { sourceId: 'vampire_dinner_date_target', targetType: 'minion' },
    );
    return { state: queueInteraction(state, interaction), events };
};

const handleDinnerDateChooseTarget: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; defId: string; baseIndex: number };
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) {
        return { state, events: [] };
    }
    // 晚餐约会：先+1指示物（已在 handleDinnerDateChooseMinion 中生成），再消灭随从
    // 这里不需要 +1ms 偏移，因为两个事件在不同的交互步骤中生成
    return {
        state,
        events: [destroyMinion(v.minionUid, v.defId, v.baseIndex, target.owner, playerId, 'vampire_dinner_date', now)],
    };
};

const handleBigGulpChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; defId: string; baseIndex: number };
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) {
        return { state, events: [] };
    }
    return {
        state,
        events: [destroyMinion(v.minionUid, v.defId, v.baseIndex, target.owner, playerId, 'vampire_big_gulp', now)],
    };
};

const handleCullTheWeakChooseMinion: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number };
    const player = state.core.players[playerId];
    if (!player) return undefined;
    const minionCards = player.hand.filter(c => c.type === 'minion');
    if (minionCards.length === 0) return { state, events: [] };
    const interaction = createCullTheWeakCardInteraction(
        state, playerId, { minionUid: v.minionUid, baseIndex: v.baseIndex }, now,
    );
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleCullTheWeakChooseCard: IH = (state, playerId, value, interactionData, _random, now) => {
    const context = interactionData?.continuationContext as CullTheWeakCardContext | undefined;
    if (!context) return undefined;
    const v = value as { cardUid?: string; defId?: string; stop?: boolean };
    if (v.stop) return { state, events: [] };
    if (!v.cardUid) return undefined;
    const events: SmashUpEvent[] = [
        {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: [v.cardUid] },
            timestamp: now,
        } as SmashUpEvent,
        addPowerCounter(context.minionUid, context.baseIndex, 1, 'vampire_cull_the_weak', now),
    ];
    const player = state.core.players[playerId];
    const remainingMinions = player
        ? player.hand.filter(c => c.type === 'minion' && c.uid !== v.cardUid).length
        : 0;
    if (remainingMinions <= 0) return { state, events };
    const nextInteraction = createCullTheWeakCardInteraction(state, playerId, context, now);
    return { state: queueInteraction(state, nextInteraction), events };
};

const handleCrackOfDuskChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { cardUid: string; defId: string };
    // 选完随从后，创建基地选择交互
    const result = crackOfDuskCreateBaseSelect(state, playerId, v.cardUid, v.defId, now);
    return { state: result.matchState ?? state, events: result.events };
};

const handleCrackOfDuskChooseBase: IH = (state, playerId, value, interactionData, _random, now) => {
    const context = interactionData?.continuationContext as { cardUid: string; defId: string } | undefined;
    if (!context) return undefined;
    const v = value as { baseIndex: number };
    const minionDef = getMinionDef(context.defId);
    const playedEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: context.cardUid,
            defId: context.defId,
            baseIndex: v.baseIndex,
            power: minionDef?.power ?? 0,
            fromDiscard: true,
        },
        timestamp: now,
    };
    return {
        state,
        events: [
            playedEvt,
            addPowerCounter(context.cardUid, v.baseIndex, 1, 'vampire_crack_of_dusk', now + 1), // +1ms 避免与打出随从音效冲突
        ],
    };
};

// ============================================================================
// POD implementations
// ============================================================================

function vampireHeavyDrinkerPod(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    const base = ctx.state.bases[found.baseIndex];
    if (!base) return { events: [] };

    const hereTargets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (const m of base.minions) {
        if (m.uid === ctx.cardUid) continue;
        const power = getEffectivePower(ctx.state, m, found.baseIndex);
        if (power <= 2) {
            const def = getCardDef(m.defId);
            hereTargets.push({ uid: m.uid, defId: m.defId, baseIndex: found.baseIndex, label: `${def?.name ?? m.defId} (战斗力 ${power})` });
        }
    }
    const otherOwnTargets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            if (m.uid === ctx.cardUid) continue;
            const def = getCardDef(m.defId);
            otherOwnTargets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId}` });
        }
    }

    const interaction = createSimpleChoice(
        `vampire_heavy_drinker_pod_${ctx.now}`,
        ctx.playerId,
        '海量酒鬼：选择要消灭的随从（本随从放置两个+1战斗力指示物）',
        [
            ...buildMinionTargetOptions(hereTargets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }).map(o => ({
                ...o,
                id: `here-${o.id}`,
                value: { ...o.value, sourceMinionUid: found.minion.uid, sourceBaseIndex: found.baseIndex },
            })),
            ...otherOwnTargets.map((t, i) => ({
                id: `own-${i}`,
                label: `消灭：${t.label}`,
                value: { minionUid: t.uid, defId: t.defId, baseIndex: t.baseIndex, sourceMinionUid: found.minion.uid, sourceBaseIndex: found.baseIndex },
                _source: 'field' as const,
                displayMode: 'card' as const,
            })),
            { id: 'skip', label: '跳过（不消灭）', value: { skip: true }, displayMode: 'button' as const },
        ] as any[],
        { sourceId: 'vampire_heavy_drinker_pod', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const handleHeavyDrinkerPodChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as any;
    if (v?.skip) return { state, events: [] };
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) return { state, events: [] };
    const destroyEvents = buildValidatedDestroyEvents(state.core, {
        minionUid: v.minionUid,
        minionDefId: v.defId,
        fromBaseIndex: v.baseIndex,
        destroyerId: playerId,
        reason: 'vampire_heavy_drinker_pod',
        now,
    });
    if (destroyEvents.length === 0) return { state, events: [] };
    return {
        state,
        events: [
            ...destroyEvents,
            addPowerCounter(v.sourceMinionUid, v.sourceBaseIndex, 2, 'vampire_heavy_drinker_pod', now),
        ],
    };
};

function vampireCountPodTalent(ctx: AbilityContext): AbilityResult {
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const def = getCardDef(m.defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId}` });
        }
    }
    if (targets.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `vampire_the_count_pod_talent_${ctx.now}`,
        ctx.playerId,
        '吸血鬼伯爵：选择一个随从直到你的下回合开始时-1战斗力',
        [
            ...buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'affect' }),
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
        ] as any[],
        { sourceId: 'vampire_the_count_pod_talent', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const handleCountPodTalent: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as any;
    if (v?.skip) return { state, events: [] };
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) return { state, events: [] };
    const nextState = schedulePowerModifierUntilNextTurnStart(
        state,
        v.minionUid,
        -1,
        'vampire_the_count_pod',
    );
    return {
        state: nextState,
        events: [addPermanentPower(v.minionUid, v.baseIndex, -1, 'vampire_the_count_pod', now)],
    };
};

const handleCountPodAddCounter: IH = (state, _playerId, value, _data, _random, now) => {
    const v = value as any;
    if (v?.skip) return { state, events: [] };
    return { state, events: [addPowerCounter(v.minionUid, v.baseIndex, 1, 'vampire_the_count_pod', now)] };
};

function vampireBuffetPod(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now) };
}

function vampireNightstalkerPodTalent(ctx: AbilityContext): AbilityResult {
    const hasDestroyed = (ctx.state.destroyedMinionByPlayersThisTurn ?? []).includes(ctx.playerId);
    if (!hasDestroyed) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const events: SmashUpEvent[] = buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
    events.push(addTempPower(ctx.cardUid, ctx.baseIndex, 2, 'vampire_nightstalker_pod', ctx.now));
    return { events };
}

const handleNightstalkerPodTalent: IH = (state) => ({ state, events: [] });

function vampireBigGulpPod(ctx: AbilityContext): AbilityResult {
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const p = getEffectivePower(ctx.state, m, i);
            if (p <= 4) {
                const def = getCardDef(m.defId);
                targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (战斗力 ${p})` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const interaction = createSimpleChoice(
        `vampire_big_gulp_pod_${ctx.now}`,
        ctx.playerId,
        '选择要消灭的战斗力≤4的随从',
        buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        { sourceId: 'vampire_big_gulp_pod', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const handleBigGulpPodChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as any;
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) return { state, events: [] };
    return { state, events: [destroyMinion(v.minionUid, v.defId, v.baseIndex, target.owner, playerId, 'vampire_big_gulp_pod', now)] };
};

function vampireCullTheWeakPod(ctx: AbilityContext): AbilityResult {
    // Engine limitation: no full deck browse UI. We approximate by searching until 2 minions found, discard them, then place counters.
    const picked = revealAndPickFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        predicate: (c) => c.type === 'minion',
        maxPick: 2,
        revealTo: ctx.playerId,
        reason: 'vampire_cull_the_weak_pod',
        now: ctx.now,
    });
    if (picked.picked.length === 0) return { events: [] };
    // Choose target minion to receive counters (one per discarded minion)
    const myMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const def = getCardDef(m.defId);
            myMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: def?.name ?? m.defId });
        }
    }
    const interaction = createSimpleChoice(
        `vampire_cull_the_weak_pod_${ctx.now}`,
        ctx.playerId,
        '剔除弱者：选择一个随从放置+1战斗力指示物（每弃1张随从放1个）',
        buildMinionTargetOptions(myMinions, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'affect' }) as any,
        { sourceId: 'vampire_cull_the_weak_pod', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = { discardedCount: picked.picked.length, deckEvents: picked.events, discardUids: picked.picked.map(c => c.uid) };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const handleCullTheWeakPodChooseMinion: IH = (state, playerId, value, interactionData, _random, now) => {
    const ctx = interactionData?.continuationContext as any;
    if (!ctx) return { state, events: [] };
    const v = value as any;
    const events: SmashUpEvent[] = [...(ctx.deckEvents ?? [])];
    // discard picked uids from deck top via CARDS_MILLED (deck->discard) approximation
    events.push({ type: SU_EVENTS.CARDS_MILLED, payload: { playerId, count: ctx.discardUids.length, cardUids: ctx.discardUids }, timestamp: now } as any);
    for (let i = 0; i < (ctx.discardedCount ?? 0); i++) {
        events.push(addPowerCounter(v.minionUid, v.baseIndex, 1, 'vampire_cull_the_weak_pod', now));
    }
    return { state, events };
};

const handleCullTheWeakPodChooseCard: IH = (state) => ({ state, events: [] });

function vampireCrackOfDuskPod(ctx: AbilityContext): AbilityResult {
    // Same as base but played as extra minion
    return vampireCrackOfDusk(ctx);
}

const handleCrackOfDuskPodChoice: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as any;
    const result = crackOfDuskCreateBaseSelect(state, playerId, v.cardUid, v.defId, now);
    // override sourceId so we can treat as extra in base handler
    const interaction = (result.matchState?.sys.interaction.current) as any;
    if (interaction) interaction.data.sourceId = 'vampire_crack_of_dusk_pod_base';
    return { state: result.matchState ?? state, events: result.events };
};

const handleCrackOfDuskPodChooseBase: IH = (state, playerId, value, interactionData, _random, now) => {
    const context = interactionData?.continuationContext as { cardUid: string; defId: string } | undefined;
    if (!context) return undefined;
    const v = value as { baseIndex: number };
    const minionDef = getMinionDef(context.defId);
    const playedEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: context.cardUid,
            defId: context.defId,
            baseIndex: v.baseIndex,
            power: minionDef?.power ?? 0,
            fromDiscard: true,
            consumesNormalLimit: false,
        } as any,
        timestamp: now,
    };
    return { state, events: [playedEvt, addPowerCounter(context.cardUid, v.baseIndex, 1, 'vampire_crack_of_dusk_pod', now + 1)] };
};

function vampireDinnerDatePod(ctx: AbilityContext): AbilityResult {
    // When played as ongoing on a minion: choose one of your minions to receive two counters; attached minion -2 power.
    if (!ctx.targetMinionUid) return { events: [] };
    const own: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            const def = getCardDef(m.defId);
            own.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: def?.name ?? m.defId });
        }
    }
    const interaction = createSimpleChoice(
        `vampire_dinner_date_pod_${ctx.now}`,
        ctx.playerId,
        '晚餐约会：选择你的一个随从放置两个+1战斗力指示物',
        buildMinionTargetOptions(own, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'affect' }) as any,
        { sourceId: 'vampire_dinner_date_pod', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = { attachedMinionUid: ctx.targetMinionUid, attachedBaseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const handleDinnerDatePodChooseMinion: IH = (state, playerId, value, interactionData, _random, now) => {
    const ctx = interactionData?.continuationContext as any;
    if (!ctx) return { state, events: [] };
    const v = value as any;
    const events: SmashUpEvent[] = [addPowerCounter(v.minionUid, v.baseIndex, 2, 'vampire_dinner_date_pod', now)];

    // Dinner Date POD 的 -2 是 ongoing 修正（见 ongoing_modifiers.ts），
    // 这里仅处理“若该随从力量为 0，则将其消灭”的即时检查。
    const attachedBase = state.core.bases[ctx.attachedBaseIndex];
    const attachedMinion = attachedBase?.minions.find(m => m.uid === ctx.attachedMinionUid);
    if (attachedMinion) {
        const effectiveNow = getEffectivePower(state.core, attachedMinion, ctx.attachedBaseIndex);
        const hasDinnerDateAttached = attachedMinion.attachedActions.some(a => a.defId === 'vampire_dinner_date_pod');
        const projectedPower = hasDinnerDateAttached ? effectiveNow : effectiveNow - 2;
        if (projectedPower > 0) return { state, events };
        events.push(
            ...buildValidatedDestroyEvents(state.core, {
                minionUid: attachedMinion.uid,
                minionDefId: attachedMinion.defId,
                fromBaseIndex: ctx.attachedBaseIndex,
                destroyerId: playerId,
                reason: 'vampire_dinner_date_pod',
                now,
            }),
        );
    }
    return { state, events };
};

function vampireWolfPactPodMinionOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const hasOtherOwnMinionHere = !!base?.minions.some(m => m.controller === ctx.playerId && m.uid !== ctx.cardUid);
    if (!hasOtherOwnMinionHere) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `vampire_wolf_pact_pod_minion_${ctx.now}`,
        ctx.playerId,
        '狼之契约（随从）：选择一个随从直到你下回合开始时-1战斗力',
        [
            ...buildMinionTargetOptions(
                ctx.state.bases.flatMap((b, i) =>
                    b.minions.map(m => ({ uid: m.uid, defId: m.defId, baseIndex: i, label: getCardDef(m.defId)?.name ?? m.defId })),
                ),
                { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'affect' },
            ),
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
        ] as any,
        { sourceId: 'vampire_wolf_pact_pod_minion', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = { wolfUid: ctx.cardUid, wolfBaseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const handleWolfPactPodPickDebuffTarget: IH = (state, playerId, value, interactionData, _random, now) => {
    const ctx = interactionData?.continuationContext as any;
    if (!ctx) return { state, events: [] };
    const v = value as any;
    if (v?.skip) return { state, events: [] };
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!target) return { state, events: [] };
    const base = state.core.bases[ctx.wolfBaseIndex];
    if (!base) return { state, events: [] };
    const recipients = base.minions
        .filter((m: any) => m.controller === playerId && m.uid !== ctx.wolfUid)
        .map((m: any, i: number) => ({
            id: `r-${i}`,
            label: getCardDef(m.defId)?.name ?? m.defId,
            value: { minionUid: m.uid, defId: m.defId, baseIndex: ctx.wolfBaseIndex, debuffed: v },
            _source: 'field' as const,
            displayMode: 'card' as const,
        }));
    // 文本是“you may ... to place +1 on another one of your minions here”：
    // 没有“another one”时，不能强制扣 -1。
    if (recipients.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(
        `vampire_wolf_pact_pod_minion_target_${now}`,
        playerId,
        '狼之契约：选择在该基地的另一个你的随从放置+1战斗力指示物',
        recipients as any[],
        { sourceId: 'vampire_wolf_pact_pod_minion_target', targetType: 'minion' },
    );
    const nextState = schedulePowerModifierUntilNextTurnStart(
        queueInteraction(state, interaction),
        v.minionUid,
        -1,
        'vampire_wolf_pact_pod',
    );
    return {
        state: nextState,
        events: [addPermanentPower(v.minionUid, v.baseIndex, -1, 'vampire_wolf_pact_pod', now)],
    };
};

const handleWolfPactPodPickCounterTarget: IH = (state, _playerId, value, _data, _random, now) => {
    const v = value as any;
    return { state, events: [addPowerCounter(v.minionUid, v.baseIndex, 1, 'vampire_wolf_pact_pod', now)] };
};

function vampireWolfPactPodActionOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.discard.length === 0) return { events: [] };
    const options = player.discard.map((c, i) => ({
        id: `c-${i}`,
        label: getCardDef(c.defId)?.name ?? c.defId,
        value: { cardUid: c.uid },
        _source: 'discard' as const,
        displayMode: 'card' as const,
    }));
    const interaction = createSimpleChoice(
        `vampire_wolf_pact_pod_action_${ctx.now}`,
        ctx.playerId,
        '狼之契约（战术）：选择弃牌堆的一张卡洗入牌库',
        options as any[],
        { sourceId: 'vampire_wolf_pact_pod_action', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const handleWolfPactPodShuffleChoice: IH = (state, playerId, value, _data, random, now) => {
    const v = value as any;
    if (!v.cardUid) return { state, events: [] };
    const p = state.core.players[playerId];
    const card = p.discard.find(c => c.uid === v.cardUid);
    if (!card) return { state, events: [] };
    const newDeckUids = random.shuffle([...p.deck.map(c => c.uid), card.uid]);
    return { state, events: [{ type: SU_EVENTS.DECK_REORDERED, payload: { playerId, deckUids: newDeckUids }, timestamp: now } as any] };
};

function vampireStakeoutPodTalent(ctx: AbilityContext): AbilityResult {
    // Find base where this ongoing is attached
    const baseIndex = ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const decreased = ctx.state.basePowerDecreasedPlayersThisTurn?.[baseIndex] ?? [];
    const hasOther = decreased.some(pid => pid !== ctx.playerId);
    if (!hasOther) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const expires = ctx.state.turnNumber + ctx.state.turnOrder.length;
    const prev = ctx.state.stakeoutPodBlocks ?? [];
    const events: SmashUpEvent[] = [
        {
            type: SU_EVENTS.STAKEOUT_POD_BLOCK_ADDED,
            payload: { baseIndex, ownerId: ctx.playerId, expiresOnTurnNumber: expires, reason: 'vampire_stakeout_pod' },
            timestamp: ctx.now,
        } as any,
    ];
    return { events };
}
// ============================================================================
// Ongoing 效果注册
// ============================================================================

function registerVampireOngoingEffects(): void {
    // 吸血鬼伯爵 ongoing：对手随从被消灭后+1指示物
    registerTrigger('vampire_the_count', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, playerId: destroyedOwnerId, triggerMinionUid, now } = ctx;
        if (!triggerMinionUid) return [];
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            for (const m of state.bases[i].minions) {
                if (matchesDefId(m.defId, 'vampire_the_count') && m.controller !== destroyedOwnerId) {
                    events.push(addPowerCounter(m.uid, i, 1, 'vampire_the_count', now));
                }
            }
        }
        return events;
    });

    // 投机主义 ongoing(minion)：对手随从被消灭后+1指示物
    registerTrigger('vampire_opportunist', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, playerId: destroyedOwnerId, now } = ctx;
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            for (const m of state.bases[i].minions) {
                if (m.controller === destroyedOwnerId) continue;
                if (m.attachedActions.some(a => matchesDefId(a.defId, 'vampire_opportunist'))) {
                    events.push(addPowerCounter(m.uid, i, 1, 'vampire_opportunist', now));
                }
            }
        }
        return events;
    });

    // 召唤狼群 ongoing(base)：回合开始在本卡上放+1力量指示物
    registerTrigger('vampire_summon_wolves', 'onTurnStart', (ctx: TriggerContext) => {
        const { state, playerId, now } = ctx;
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            for (const oa of state.bases[i].ongoingActions) {
                if (matchesDefId(oa.defId, 'vampire_summon_wolves') && oa.ownerId === playerId) {
                    events.push(addOngoingCardCounter(oa.uid, i, 1, 'vampire_summon_wolves', now) as unknown as SmashUpEvent);
                }
            }
        }
        return events;
    });

    // 自助餐 special：基地计分后如果打出者是赢家（排名第一），己方所有随从+1指示物
    // 使用 ARMED → afterScoring 延迟触发机制
    registerTrigger('vampire_buffet', 'afterScoring', (ctx: TriggerContext) => {
        const { state, baseIndex, rankings, now } = ctx;
        if (baseIndex === undefined || !rankings || rankings.length === 0) return [];

        const armed = (state.pendingAfterScoringSpecials ?? []).filter(
            s => s.sourceDefId === 'vampire_buffet' && s.baseIndex === baseIndex,
        );
        if (armed.length === 0) return [];

        const events: SmashUpEvent[] = armed.map(s => ({
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
            payload: { sourceDefId: s.sourceDefId, playerId: s.playerId, baseIndex: s.baseIndex, baseDefId: ctx.state.bases[s.baseIndex].defId  },
            timestamp: now,
        } as SmashUpEvent));

        for (const entry of armed) {
            // 只有排名第一（赢家）才触发效果
            if (rankings[0].playerId !== entry.playerId) continue;
            
            // 给所有基地上的己方随从加指示物（包括计分基地）
            for (let i = 0; i < state.bases.length; i++) {
                for (const m of state.bases[i].minions) {
                    if (m.controller === entry.playerId) {
                        events.push(addPowerCounter(m.uid, i, 1, 'vampire_buffet', now));
                    }
                }
            }
        }
        return events;
    });
}
