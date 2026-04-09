/**
 * 澶ф潃鍥涙柟 - 娉板潶鑳藉姏鎺ュ叆
 *
 * 褰撳墠宸叉寮忔墦閫氾細
 * - 濂舵补娉¤姍缇庝汉
 * - 澶ц‘
 * - 濂ユ湳瀹堟姢鑰?
 * - 椴滆棰嗕富
 */

import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getBaseDef, getCardDef, getMinionLikePower, getTitanDef } from '../data/cards';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addPermanentPower,
    addTempPower,
    addTitanPowerCounter,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildStandardDrawEvents,
    buildMinionTargetOptions,
    changeMinionController,
    drawMadnessCards,
    grantExtraAction,
    grantExtraMinion,
    inspectDeck,
    revealDeckTop,
    getMinionPower,
    peekDeckTop,
    findCardInPlayerZone,
    findMinionOnBases,
    getTitanByController,
    getTitanByUid,
    destroyMinion,
    moveMinion,
    moveTitan,
    playTitan,
    removePowerCounter,
    removeTitanPowerCounter,
    removeTitanFromPlay,
    revealHand,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { appendResolvedActionAbility, getExternalActionEffectiveHandSize } from '../domain/externalActionPlay';
import { buildBuryCardEvents, buildBuriedCardReturnedToHandEvent } from '../domain/bury';
import { continueActiveDuel } from '../domain/duel';
import { registerInterceptor, registerProtection, registerRestriction, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { getPlayerEffectivePowerOnBase, registerTitanPowerModifier } from '../domain/ongoingModifiers';
import { validateActionPlaySemantics } from '../domain/playLegality';
import {
    registerTitanSpecialValidator,
    registerTitanOngoingActivationValidator,
    registerTitanTalentValidator,
} from '../domain/titanAbilityValidators';
import type {
    ActionCardDef,
    ActionPlayedEvent,
    CardTransferredEvent,
    CardsDrawnEvent,
    MadnessDrawnEvent,
    MinionCardDef,
    PowerCounterAddedEvent,
    SmashUpEvent,
    TitanState,
    TitanPowerCounterAddedEvent,
} from '../domain/types';
import { MADNESS_CARD_DEF_ID, SU_EVENTS } from '../domain/types';
import { drawCards, getPlayerLabel } from '../domain/utils';

function getPlayedCardCount(ctx: AbilityContext): number {
    const player = ctx.state.players[ctx.playerId];
    return ctx.state.cardsPlayedThisTurn ?? ((player?.minionsPlayed ?? 0) + (player?.actionsPlayed ?? 0));
}

function getOwnTotalMinionCounters(state: AbilityContext['state'], playerId: string): number {
    let totalCounters = 0;
    for (const base of state.bases) {
        for (const minion of base.minions) {
            if (minion.controller !== playerId) continue;
            totalCounters += minion.powerCounters ?? 0;
        }
    }
    return totalCounters;
}

function getBaseIndicesWithOwnMinions(state: AbilityContext['state'], playerId: string): number[] {
    return state.bases
        .map((base, index) => ({ base, index }))
        .filter(({ base }) => base.minions.some(minion => minion.controller === playerId))
        .map(({ index }) => index);
}

function getOtherBaseOptions(state: AbilityContext['state'], excludedBaseIndex: number) {
    return state.bases
        .map((base, index) => ({ base, index }))
        .filter(({ index }) => index !== excludedBaseIndex)
        .map(({ base, index }) => ({
            baseIndex: index,
            label: getBaseDef(base.defId)?.name ?? `閸╁搫婀?${index + 1}`,
        }));
}

function getOwnedBuriedCardChoices(
    state: AbilityContext['state'],
    playerId: string,
    restrictedBaseIndex?: number,
) {
    return state.bases.flatMap((base, baseIndex) => {
        if (restrictedBaseIndex !== undefined && baseIndex !== restrictedBaseIndex) {
            return [];
        }

        return (base.buriedCards ?? [])
            .filter(card => card.controllerId === playerId)
            .map(card => ({
                cardUid: card.uid,
                defId: card.defId,
                baseIndex,
                baseDefId: base.defId,
                label: `${getCardDef(card.defId)?.name ?? card.defId} @ ${getBaseDef(base.defId)?.name ?? base.defId}`,
            }));
    });
}

function getOwnedSetAsideTitan(state: AbilityContext['state'], playerId: string, defId: string) {
    return (state.titans ?? []).find(candidate =>
        candidate.defId === defId
        && candidate.ownerId === playerId
        && candidate.location.zone === 'setaside',
    );
}

function getHillOwnedMinionsControlledByOthers(
    state: AbilityContext['state'],
    playerId: string,
    baseIndex?: number,
) {
    const bases = baseIndex === undefined
        ? state.bases.map((base, index) => ({ base, index }))
        : [{ base: state.bases[baseIndex], index: baseIndex }];

    return bases
        .flatMap(({ base, index }) => (base?.minions ?? [])
            .filter(minion => minion.owner === playerId && minion.controller !== playerId)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: index,
                controllerId: minion.controller,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? `鍩哄湴 ${index + 1}`}`,
            })));
}

function getHillGiveControlTargets(state: AbilityContext['state'], playerId: string) {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.owner === playerId && minion.controller === playerId)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                controllerId: minion.controller,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? `鍩哄湴 ${baseIndex + 1}`}`,
            })));
}

function buildOtherPlayerChoiceOptions(state: AbilityContext['state'], playerId: string) {
    return state.turnOrder
        .filter(pid => pid !== playerId)
        .map((pid, index) => ({
            id: `player-${index}`,
            label: getPlayerLabel(pid),
            value: { targetPlayerId: pid },
            displayMode: 'button' as const,
        }));
}

function getDeferredPostScoringEvents(interactionData: Record<string, unknown> | undefined): SmashUpEvent[] | undefined {
    const continuation = interactionData?.continuationContext as { _deferredPostScoringEvents?: SmashUpEvent[] } | undefined;
    return continuation?._deferredPostScoringEvents;
}

function appendDeferredPostScoringEventsIfLast(
    state: AbilityContext['matchState'],
    interactionData: Record<string, unknown> | undefined,
    events: SmashUpEvent[],
): SmashUpEvent[] {
    const deferredEvents = getDeferredPostScoringEvents(interactionData);
    const hasPendingInteraction =
        !!state.sys.interaction?.current
        || (state.sys.interaction?.queue?.length ?? 0) > 0;
    if (deferredEvents && deferredEvents.length > 0 && !hasPendingInteraction) {
        events.push(...deferredEvents);
    }
    return events;
}

function schedulePowerModifierUntilNextTurnStart(
    state: AbilityContext['matchState'],
    minionUid: string,
    amount: number,
    reason: string,
): AbilityContext['matchState'] {
    if (amount === 0) return state;
    const expiresOnTurnNumber = state.core.turnNumber + state.core.turnOrder.length;
    return {
        ...state,
        core: {
            ...state.core,
            timedPowerModifiers: [
                ...(state.core.timedPowerModifiers ?? []),
                { minionUid, amount, expiresOnTurnNumber, reason },
            ],
        },
    };
}

function playTitanFromSetAside(ctx: AbilityContext, reason: string): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'setaside') return { events: [] };
    if (getTitanByController(ctx.state, ctx.playerId)) return { events: [] };

    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const titanDef = getTitanDef(titan.defId);
    const consumesRegularPlayKind = titanDef?.summonMode === 'insteadOfRegularMinion'
        ? 'minion'
        : titanDef?.summonMode === 'insteadOfRegularAction'
            ? 'action'
            : titanDef?.summonMode === 'insteadOfRegularMinionAndAction'
                ? ['minion', 'action'] as const
                : undefined;

    return {
        events: [
            playTitan(
                titan,
                ctx.playerId,
                ctx.baseIndex,
                reason,
                ctx.now,
                base.defId,
                consumesRegularPlayKind,
            ),
        ],
    };
}

function isStandardAction(defId: string): boolean {
    const def = getCardDef(defId);
    return def?.type === 'action' && (def as ActionCardDef).subtype === 'standard';
}

function getDagonMatchingMinionCount(state: AbilityContext['state'], baseIndex: number, playerId: string): number {
    const base = state.bases[baseIndex];
    if (!base) return 0;

    const counts = new Map<string, number>();
    for (const minion of base.minions) {
        if (minion.controller !== playerId) continue;
        counts.set(minion.defId, (counts.get(minion.defId) ?? 0) + 1);
    }

    let total = 0;
    for (const count of counts.values()) {
        if (count >= 2) total += count;
    }
    return total;
}

function getOwnActionCountOnBase(state: AbilityContext['state'], baseIndex: number, playerId: string): number {
    const base = state.bases[baseIndex];
    if (!base) return 0;

    let total = base.ongoingActions.filter(action => action.ownerId === playerId).length;
    for (const minion of base.minions) {
        total += minion.attachedActions.filter(action => action.ownerId === playerId).length;
    }
    return total;
}

function getOwnMinionCountOnBase(state: AbilityContext['state'], baseIndex: number, playerId: string): number {
    const base = state.bases[baseIndex];
    if (!base) return 0;
    return base.minions.filter(minion => minion.controller === playerId).length;
}

function getGorgodzollaOnBase(state: AbilityContext['state'], playerId: string, baseIndex: number) {
    return (state.titans ?? []).find(titan =>
        titan.defId === 'kaiju_gorgodzolla'
        && titan.controllerId === playerId
        && titan.location.zone === 'base'
        && titan.location.baseIndex === baseIndex,
    );
}

function kaijuGorgodzollaSpecial(ctx: AbilityContext): AbilityResult {
    if (getOwnActionCountOnBase(ctx.state, ctx.baseIndex, ctx.playerId) < 2) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'kaiju_gorgodzolla_special');
}

function kaijuGorgodzollaOnMinionPlayed(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined) return [];
    const titan = getGorgodzollaOnBase(ctx.state, ctx.playerId, ctx.baseIndex);
    if (!titan) return [];
    return [addTitanPowerCounter(titan.uid, 1, 'kaiju_gorgodzolla', ctx.now)];
}

function kaijuGorgodzollaOnActionPlayed(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (ctx.baseIndex === undefined) return [];
    const titan = getGorgodzollaOnBase(ctx.state, ctx.playerId, ctx.baseIndex);
    if (!titan) return [];

    const events: SmashUpEvent[] = [
        addTitanPowerCounter(titan.uid, 1, 'kaiju_gorgodzolla', ctx.now),
    ];
    const player = ctx.state.players[ctx.playerId];
    const canDraw = ((player?.deck.length ?? 0) + (player?.discard.length ?? 0)) > 0;
    if (!ctx.matchState || !canDraw) {
        return events;
    }

    const interaction = createSimpleChoice(
        `titan_kaiju_gorgodzolla_draw_${titan.uid}_${ctx.now}`,
        ctx.playerId,
        '鍝ヤ綈鎷夛細浣犲彲浠ユ娊 1 寮犵墝',
        [
            { id: 'draw', label: '鎶?1 寮犵墝', value: { draw: true }, displayMode: 'button' as const },
            { id: 'skip', label: '璺宠繃', value: { skip: true }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_kaiju_gorgodzolla_draw', targetType: 'button' },
    );

    return {
        events,
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function megaTroopersMegabotSpecial(ctx: AbilityContext): AbilityResult {
    if (getOwnMinionCountOnBase(ctx.state, ctx.baseIndex, ctx.playerId) < 3) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'mega_troopers_megabot_special');
}

function getVeryLargeBoulderOnBase(state: AbilityContext['state'], playerId: string, baseIndex: number) {
    return (state.titans ?? []).find(titan =>
        titan.defId === 'explorers_very_large_boulder'
        && titan.controllerId === playerId
        && titan.location.zone === 'base'
        && titan.location.baseIndex === baseIndex,
    );
}

function explorersVeryLargeBoulderSpecial(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || base.minions.length > 0) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'explorers_very_large_boulder_special');
}

function getVeryLargeBoulderDestroyTargets(state: AbilityContext['state'], baseIndex: number, threshold: number) {
    const base = state.bases[baseIndex];
    if (!base || threshold <= 0) return [];
    return base.minions
        .filter(minion => getMinionPower(state, minion, baseIndex) < threshold)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId} (${getMinionPower(state, minion, baseIndex)})`,
        }));
}

function explorersVeryLargeBoulderOnMinionMoved(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (ctx.moveFromBaseIndex === undefined || ctx.moveToBaseIndex === undefined) return [];
    if (ctx.moveFromBaseIndex === ctx.moveToBaseIndex) return [];

    const titan = getVeryLargeBoulderOnBase(ctx.state, ctx.playerId, ctx.moveFromBaseIndex);
    if (!titan) return [];
    if (!ctx.matchState) return [];

    const destinationBase = ctx.state.bases[ctx.moveToBaseIndex];
    const interaction = createSimpleChoice(
        `titan_explorers_very_large_boulder_move_${titan.uid}_${ctx.now}`,
        titan.controllerId,
        `Very Large Boulder: move to ${getBaseDef(destinationBase?.defId ?? '')?.name ?? `Base ${ctx.moveToBaseIndex + 1}`}?`,
        [
            { id: 'move', label: 'Move there', value: { move: true }, displayMode: 'button' as const },
            { id: 'skip', label: 'Skip', value: { move: false }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_explorers_very_large_boulder_move', targetType: 'button' },
    );
    (interaction.data as {
        continuationContext?: {
            titanUid: string;
            titanDefId: string;
            fromBaseIndex: number;
            toBaseIndex: number;
            toBaseDefId?: string;
            destroyThreshold: number;
        };
    }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        fromBaseIndex: ctx.moveFromBaseIndex,
        toBaseIndex: ctx.moveToBaseIndex,
        toBaseDefId: destinationBase?.defId,
        destroyThreshold: titan.powerCounters,
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function explorersVeryLargeBoulderOnTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'explorers_very_large_boulder'
        && candidate.controllerId === ctx.playerId
        && candidate.location.zone === 'base',
    );
    if (!titan) return [];
    if ((ctx.state.titanMovedTurnByTitanUid ?? {})[titan.uid] === ctx.state.turnNumber) {
        return [];
    }
    return [addTitanPowerCounter(titan.uid, 1, 'explorers_very_large_boulder', ctx.now)];
}

function magicalGirlsWalkingCastleSpecial(ctx: AbilityContext): AbilityResult {
    if (getOwnMinionCountOnBase(ctx.state, ctx.baseIndex, ctx.playerId) < 2) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'magical_girls_walking_castle_special');
}

function magicalGirlsWalkingCastleProtectionChecker(ctx: ProtectionCheckContext): boolean {
    const castle = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'magical_girls_walking_castle'
        && candidate.location.zone === 'base'
        && candidate.location.baseIndex === ctx.targetBaseIndex,
    );
    if (!castle) return false;
    if (ctx.targetMinion.controller !== castle.controllerId) return false;
    return ctx.sourcePlayerId !== ctx.targetMinion.controller;
}

function getWalkingCastleOwnedMinionsOnBase(state: AbilityContext['state'], playerId: string, baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return base.minions
        .filter(minion => minion.controller === playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
}

function queueWalkingCastleChooseBaseInteraction(
    matchState: AbilityContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    now: number,
    continuationContext: {
        titanUid: string;
        titanDefId: string;
        fromBaseIndex: number;
        selectedMinionUids: string[];
    },
) {
    const baseOptions = getOtherBaseOptions(state, continuationContext.fromBaseIndex);
    if (baseOptions.length === 0) return undefined;

    const interaction = createSimpleChoice(
        `titan_magical_girls_walking_castle_choose_base_${now}`,
        playerId,
        'Walking Castle: choose a base to move to',
        buildBaseTargetOptions(baseOptions, state),
        { sourceId: 'titan_magical_girls_walking_castle_choose_base', targetType: 'base' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = continuationContext;
    return queueInteraction(matchState, interaction);
}

function queueWalkingCastleChooseMinionsInteraction(
    matchState: AbilityContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    now: number,
    continuationContext: {
        titanUid: string;
        titanDefId: string;
        fromBaseIndex: number;
        targetBaseIndex: number;
        targetBaseDefId?: string;
    },
) {
    const ownedMinions = getWalkingCastleOwnedMinionsOnBase(state, playerId, continuationContext.fromBaseIndex);
    if (ownedMinions.length === 0) return undefined;

    const interaction = createSimpleChoice(
        `titan_magical_girls_walking_castle_choose_minions_${now}`,
        playerId,
        'Walking Castle: choose up to 3 of your minions to move with it',
        buildMinionTargetOptions(ownedMinions, { state, sourcePlayerId: playerId, effectType: 'move' }),
        { sourceId: 'titan_magical_girls_walking_castle_choose_minions', targetType: 'minion' },
        undefined,
        { min: 0, max: Math.min(3, ownedMinions.length) },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = continuationContext;
    return queueInteraction(matchState, interaction);
}

function magicalGirlsWalkingCastleTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        fromBaseIndex: titan.location.baseIndex,
    };
    const baseOptions = getOtherBaseOptions(ctx.state, titan.location.baseIndex);
    if (baseOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = queueWalkingCastleChooseBaseInteraction(
        ctx.matchState,
        ctx.state,
        ctx.playerId,
        ctx.now,
        continuationContext,
    );

    return {
        events: [],
        matchState: interaction ?? ctx.matchState,
    };
}

function queueHillGiveMinionInteraction(
    matchState: AbilityContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    now: number,
) {
    const targets = getHillGiveControlTargets(state, playerId);
    if (targets.length === 0) return undefined;

    return queueInteraction(matchState, createSimpleChoice(
        `titan_ignobles_the_hill_that_strolls_give_minion_${now}`,
        playerId,
        'The Hill That Strolls: choose one of your minions to give away',
        buildMinionTargetOptions(targets, { state, sourcePlayerId: playerId, effectType: 'affect' }),
        { sourceId: 'titan_ignobles_the_hill_that_strolls_give_minion', targetType: 'minion' },
    ));
}

function queueHillReclaimMinionInteraction(
    matchState: AbilityContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    now: number,
    titanBaseIndex: number,
) {
    const targets = getHillOwnedMinionsControlledByOthers(state, playerId, titanBaseIndex);
    if (targets.length === 0) return undefined;

    return queueInteraction(matchState, createSimpleChoice(
        `titan_ignobles_the_hill_that_strolls_reclaim_minion_${now}`,
        playerId,
        'The Hill That Strolls: choose one of your minions here to reclaim',
        buildMinionTargetOptions(targets, { state, sourcePlayerId: playerId, effectType: 'affect' }),
        { sourceId: 'titan_ignobles_the_hill_that_strolls_reclaim_minion', targetType: 'minion' },
    ));
}

function ignoblesTheHillThatStrollsSpecial(ctx: AbilityContext): AbilityResult {
    if (getHillOwnedMinionsControlledByOthers(ctx.state, ctx.playerId).length < 2) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'ignobles_the_hill_that_strolls_special');
}

function ignoblesTheHillThatStrollsOnMinionAffected(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || ctx.affectType !== 'control_change' || !ctx.triggerMinion || ctx.baseIndex === undefined) {
        return [];
    }
    if (ctx.triggerMinion.owner !== ctx.playerId || ctx.triggerMinion.controller === ctx.playerId) {
        return [];
    }

    const interaction = createSimpleChoice(
        `titan_ignobles_the_hill_that_strolls_counter_${ctx.now}`,
        ctx.playerId,
        'The Hill That Strolls: place a +1 power counter on that minion?',
        [
            { id: 'place', label: '鏀剧疆鏍囪', value: { place: true }, displayMode: 'button' as const },
            { id: 'skip', label: '璺宠繃', value: { skip: true }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_ignobles_the_hill_that_strolls_counter', targetType: 'button' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        minionUid: ctx.triggerMinion.uid,
        minionDefId: ctx.triggerMinion.defId,
        baseIndex: ctx.baseIndex,
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function ignoblesTheHillThatStrollsTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const giveTargets = getHillGiveControlTargets(ctx.state, ctx.playerId);
    const reclaimTargets = getHillOwnedMinionsControlledByOthers(ctx.state, ctx.playerId, titan.location.baseIndex);
    if (giveTargets.length === 0 && reclaimTargets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (giveTargets.length > 0 && reclaimTargets.length === 0) {
        const nextState = queueHillGiveMinionInteraction(ctx.matchState, ctx.state, ctx.playerId, ctx.now);
        return nextState
            ? { events: [], matchState: nextState }
            : { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (giveTargets.length === 0 && reclaimTargets.length > 0) {
        const nextState = queueHillReclaimMinionInteraction(
            ctx.matchState,
            ctx.state,
            ctx.playerId,
            ctx.now,
            titan.location.baseIndex,
        );
        return nextState
            ? { events: [], matchState: nextState }
            : { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_ignobles_the_hill_that_strolls_choose_branch_${ctx.now}`,
        ctx.playerId,
        'The Hill That Strolls: choose a talent effect',
        [
            { id: 'give', label: 'Give one away and draw 1', value: { branch: 'give' }, displayMode: 'button' as const },
            { id: 'reclaim', label: 'Reclaim one here', value: { branch: 'reclaim' }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_ignobles_the_hill_that_strolls_choose_branch', targetType: 'button' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanBaseIndex: titan.location.baseIndex,
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function megaTroopersMegabotBeforeScoring(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const scoringBaseIndex = ctx.baseIndex;
    if (scoringBaseIndex === undefined) return [];

    const scoringBase = ctx.state.bases[scoringBaseIndex];
    if (!scoringBase) return [];

    const megabots = (ctx.state.titans ?? [])
        .filter((titan): titan is TitanState & { location: { zone: 'base'; baseIndex: number; enteredAt: number } } =>
            titan.defId === 'mega_troopers_megabot'
            && titan.location.zone === 'base'
            && titan.location.baseIndex !== scoringBaseIndex,
        )
        .map(titan => ({
            titanUid: titan.uid,
            titanDefId: titan.defId,
            controllerId: titan.controllerId,
            fromBaseIndex: titan.location.baseIndex,
        }));
    if (megabots.length === 0) return [];

    if (!ctx.matchState) {
        return megabots.map(megabot => moveTitan(
            megabot.titanUid,
            megabot.titanDefId,
            megabot.fromBaseIndex,
            scoringBaseIndex,
            'mega_troopers_megabot_before_scoring',
            ctx.now,
            scoringBase.defId,
        ));
    }

    const [first, ...remaining] = megabots;
    const interaction = createSimpleChoice(
        `titan_mega_troopers_megabot_move_${first.titanUid}_${ctx.now}`,
        first.controllerId,
        `Megabot: move to ${getBaseDef(scoringBase.defId)?.name ?? `Base ${scoringBaseIndex + 1}`} before it scores?`,
        [
            { id: 'move', label: 'Move there', value: { move: true }, displayMode: 'button' as const },
            { id: 'stay', label: 'Stay here', value: { move: false }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_mega_troopers_megabot_move', targetType: 'button' },
    );
    (interaction.data as {
        continuationContext?: {
            titanUid: string;
            titanDefId: string;
            fromBaseIndex: number;
            scoringBaseIndex: number;
            scoringBaseDefId: string;
            remaining: Array<{
                titanUid: string;
                titanDefId: string;
                controllerId: string;
                fromBaseIndex: number;
            }>;
        };
    }).continuationContext = {
        titanUid: first.titanUid,
        titanDefId: first.titanDefId,
        fromBaseIndex: first.fromBaseIndex,
        scoringBaseIndex,
        scoringBaseDefId: scoringBase.defId,
        remaining,
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function getCreampuffPlayableActions(
    ctx: {
        state: AbilityContext['state'] | AbilityContext['matchState'];
        playerId: string;
        effectiveHandSize: number;
    },
) {
    const core = 'core' in ctx.state ? ctx.state.core : ctx.state;
    const player = core.players[ctx.playerId];
    if (!player) return [];

    const dedup = new Map<string, typeof player.discard[number]>();
    for (const card of player.discard) {
        if (!isStandardAction(card.defId)) continue;
        if (!validateActionPlaySemantics(core, ctx.playerId, {
            defId: card.defId,
            effectiveHandSize: ctx.effectiveHandSize,
        }).valid) {
            continue;
        }
        dedup.set(card.uid, card);
    }
    return Array.from(dedup.values());
}

function buildCreampuffDiscardOptions(ctx: AbilityContext) {
    const player = ctx.state.players[ctx.playerId];
    const effectiveHandSize = player.hand.length;
    const hasPlayableAction = getCreampuffPlayableActions({
        state: ctx.state,
        playerId: ctx.playerId,
        effectiveHandSize,
    }).length > 0;
    if (!hasPlayableAction) {
        return [];
    }
    return player.hand
        .map(card => ({
            id: `card-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        }));
}

function buildCreampuffActionOptions(
    state: AbilityContext['matchState'],
    playerId: string,
) {
    const actions = getCreampuffPlayableActions({
        state,
        playerId,
        effectiveHandSize: getExternalActionEffectiveHandSize(state, playerId),
    });
    return actions.map(card => ({
        id: `action-${card.uid}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        _source: 'discard' as const,
        displayMode: 'card' as const,
    }));
}

function ghostsCreampuffManSpecial(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.hand.length > 0) return { events: [] };
    return playTitanFromSetAside(ctx, 'ghosts_creampuff_man_special');
}

function ghostsCreampuffManTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const discardOptions = buildCreampuffDiscardOptions(ctx);
    if (discardOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_ghosts_creampuff_man_discard_${ctx.now}`,
        ctx.playerId,
        '濂舵补娉¤姍缇庝汉锛氬純缃?1 寮犵墝',
        discardOptions,
        { sourceId: 'titan_ghosts_creampuff_man_discard', targetType: 'hand' },
    );
    (interaction.data as { optionsGenerator?: unknown }).optionsGenerator = (nextState: AbilityContext['matchState']) => {
        const nextPlayer = nextState.core.players[ctx.playerId];
        if (!nextPlayer) return [];
        const hasPlayableAction = getCreampuffPlayableActions({
            state: nextState,
            playerId: ctx.playerId,
            effectiveHandSize: nextPlayer.hand.length,
        }).length > 0;
        if (!hasPlayableAction) return [];
        return nextPlayer.hand
            .map(card => ({
                id: `card-${card.uid}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            }));
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function wizardArcaneProtectorSpecial(ctx: AbilityContext): AbilityResult {
    if (getPlayedCardCount(ctx) < 5) return { events: [] };
    return playTitanFromSetAside(ctx, 'wizards_arcane_protector_special');
}

function innsmouthDagonSpecial(ctx: AbilityContext): AbilityResult {
    if (getDagonMatchingMinionCount(ctx.state, ctx.baseIndex, ctx.playerId) < 2) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'innsmouth_dagon_special');
}

function innsmouthDagonTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    return {
        events: [grantExtraMinion(ctx.playerId, 'innsmouth_dagon', ctx.now, ctx.baseIndex)],
    };
}

function wizardArcaneProtectorTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const player = ctx.state.players[ctx.playerId];
    const { drawnUids } = drawCards(player, 1, ctx.random);
    if (drawnUids.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    }

    const drawEvent: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: {
            playerId: ctx.playerId,
            count: drawnUids.length,
            cardUids: drawnUids,
        },
        timestamp: ctx.now,
    };

    return { events: [drawEvent] };
}

function vampireAncientLordSpecial(_ctx: AbilityContext): AbilityResult {
    return { events: [] };
}

function cthulhuTitanSpecial(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    if (!base.minions.some(minion => minion.controller === ctx.playerId)) {
        return { events: [] };
    }

    const titanPlay = playTitanFromSetAside(ctx, 'cthulhu_cthulhu_titan_special');
    if (titanPlay.events.length === 0) {
        return titanPlay;
    }

    const madnessEvent = drawMadnessCards(ctx.playerId, 2, ctx.state, 'cthulhu_cthulhu_titan_special', ctx.now);
    return {
        events: madnessEvent ? [madnessEvent, ...titanPlay.events] : titanPlay.events,
    };
}

function getControlledTitanOnBase(state: AbilityContext['state'], defId: string, playerId: string) {
    return (state.titans ?? []).find(candidate =>
        candidate.defId === defId
        && candidate.controllerId === playerId
        && candidate.location.zone === 'base',
    );
}

function getMergaconEligibleBases(state: AbilityContext['state'], playerId: string) {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            ownMinionCount: base.minions.filter(minion => minion.controller === playerId).length,
            label: getBaseDef(base.defId)?.name ?? `鍩哄湴 ${baseIndex + 1}`,
        }))
        .filter(candidate => candidate.ownMinionCount >= 2)
        .map(({ baseIndex, label }) => ({ baseIndex, label }));
}

function getEmperorPenguinEligibleBases(state: AbilityContext['state'], playerId: string) {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            ownMinionCount: base.minions.filter(minion => minion.controller === playerId).length,
            label: getBaseDef(base.defId)?.name ?? `鍩哄湴 ${baseIndex + 1}`,
        }))
        .filter(candidate => candidate.ownMinionCount >= 3)
        .map(({ baseIndex, label }) => ({ baseIndex, label }));
}

function getMoonZeroThreeEligibleBases(state: AbilityContext['state'], playerId: string) {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            hasOnlyOwnMinions: base.minions.every(minion => minion.controller === playerId),
            label: getBaseDef(base.defId)?.name ?? `鍩哄湴 ${baseIndex + 1}`,
        }))
        .filter(candidate => candidate.hasOnlyOwnMinions)
        .map(({ baseIndex, label }) => ({ baseIndex, label }));
}

function getMoonZeroThreeInspectablePlayers(state: AbilityContext['state']) {
    return state.turnOrder
        .filter(pid => {
            const player = state.players[pid];
            return ((player?.deck.length ?? 0) + (player?.discard.length ?? 0)) > 0;
        })
        .map(pid => ({
            targetPlayerId: pid,
            label: `${getPlayerLabel(pid)} deck`,
        }));
}

function getTimeBoxCounter(titan: TitanState | undefined) {
    return Number(titan?.metadata?.timeBoxCounters ?? 0);
}

function buildTimeBoxMetadataEvent(titanUid: string, counterCount: number, reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.TITAN_METADATA_UPDATED,
        payload: {
            titanUid,
            metadataUpdate: { timeBoxCounters: Math.max(0, counterCount) },
            reason,
        },
        timestamp: now,
    };
}

function queueTimeBoxPlayInteraction(
    matchState: AbilityContext['matchState'] | TriggerContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    titan: TitanState,
    now: number,
    prompt: string,
) {
    if (!matchState) return undefined;
    const baseOptions = buildBaseTargetOptions(
        state.bases.map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `鍩哄湴 ${baseIndex + 1}`,
        })),
        state,
    );
    if (baseOptions.length === 0) return undefined;

    const interaction = createSimpleChoice(
        `titan_time_travelers_time_box_play_${now}`,
        playerId,
        prompt,
        [
            ...baseOptions,
            { id: 'skip', label: '璺宠繃', value: { skip: true }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_time_travelers_time_box_play', targetType: 'base', autoResolveIfSingle: false },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
    };
    return queueInteraction(matchState, interaction);
}

function buildTimeBoxCounterProgress(ctx: TriggerContext, reason: string): TriggerResult | SmashUpEvent[] {
    if (getTitanByController(ctx.state, ctx.playerId)) return [];

    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'time_travelers_time_box'
        && candidate.ownerId === ctx.playerId
        && candidate.location.zone === 'setaside',
    );
    if (!titan) return [];

    const currentCounter = getTimeBoxCounter(titan);
    const nextCounter = currentCounter + 1;
    const events: SmashUpEvent[] = [
        buildTimeBoxMetadataEvent(titan.uid, nextCounter, reason, ctx.now),
    ];

    if (currentCounter < 5 && nextCounter >= 5) {
        const nextMatchState = queueTimeBoxPlayInteraction(
            ctx.matchState,
            ctx.state,
            ctx.playerId,
            titan,
            ctx.now,
            '鏃堕棿鐩掑瓙锛氭槸鍚︾Щ闄ゅ叏閮ㄨ鏁板櫒骞舵墦鍑哄埌涓€涓熀鍦帮紵',
        );
        return nextMatchState ? { events, matchState: nextMatchState } : { events };
    }

    return { events };
}

function timeTravelersTimeBoxOnTurnStart(ctx: TriggerContext) {
    return buildTimeBoxCounterProgress(ctx, 'time_travelers_time_box_on_turn_start');
}

function timeTravelersTimeBoxOnCardReturnedToHand(ctx: TriggerContext) {
    return buildTimeBoxCounterProgress(ctx, 'time_travelers_time_box_on_card_returned_to_hand');
}

function timeTravelersTimeBoxSpecial(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'setaside' || titan.ownerId !== ctx.playerId) {
        return { events: [] };
    }
    if (getTimeBoxCounter(titan) < 5) {
        return { events: [] };
    }

    return {
        events: [
            buildTimeBoxMetadataEvent(titan.uid, 0, 'time_travelers_time_box_special', ctx.now),
            playTitan(titan, ctx.playerId, ctx.baseIndex, 'time_travelers_time_box_special', ctx.now),
        ],
    };
}

function timeTravelersTimeBoxTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    return {
        events: [
            grantExtraMinion(ctx.playerId, 'time_travelers_time_box_talent', ctx.now, ctx.baseIndex, { powerMax: 2 }),
            grantExtraAction(ctx.playerId, 'time_travelers_time_box_talent', ctx.now),
        ],
    };
}

function pecosBillOnDuelStarted(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || !ctx.duel) return [];

    const challengerPlayerId = ctx.duel.challengerPlayerId;
    if (getTitanByController(ctx.state, challengerPlayerId)) return [];

    const titan = getOwnedSetAsideTitan(ctx.state, challengerPlayerId, 'pecos_bill');
    const player = ctx.state.players[challengerPlayerId];
    if (!titan || !player || player.hand.length === 0) return [];

    const duelBaseIndex = ctx.baseIndex ?? ctx.duel.baseIndex;
    const duelBase = ctx.state.bases[duelBaseIndex];
    const interaction = createSimpleChoice(
        `titan_pecos_bill_duel_start_${titan.uid}_${ctx.now}`,
        challengerPlayerId,
        'Pecos Bill: you may discard a card to play this titan on the duel base',
        [
            ...player.hand.map((card) => ({
                id: `hand-${card.uid}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            })),
            { id: 'skip', label: '璺宠繃', value: { skip: true }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_pecos_bill_duel_start', targetType: 'hand', autoRefresh: 'hand' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        baseIndex: duelBaseIndex,
        baseDefId: duelBase?.defId,
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function pecosBillMoveProtectionChecker(ctx: ProtectionCheckContext): boolean {
    const duelBaseIndex = ctx.state.activeDuel?.baseIndex;
    if (duelBaseIndex === undefined || duelBaseIndex !== ctx.targetBaseIndex) return false;

    const pecosBill = (ctx.state.titans ?? []).find((titan) =>
        titan.defId === 'pecos_bill'
        && titan.location.zone === 'base'
        && titan.location.baseIndex === ctx.targetBaseIndex,
    );
    if (!pecosBill) return false;

    return ctx.sourcePlayerId !== pecosBill.controllerId;
}

function pecosBillOnDuelResolved(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.duelTie || !ctx.duelWinner) return [];

    const matchingPecosBills = (ctx.state.titans ?? []).filter((titan) =>
        titan.defId === 'pecos_bill'
        && titan.location.zone === 'base'
        && titan.controllerId === ctx.duelWinner?.controller,
    );
    if (matchingPecosBills.length === 0) return [];

    return buildStandardDrawEvents(ctx.state, ctx.duelWinner.controller, matchingPecosBills.length, ctx.random, ctx.now);
}

function sphinxOnTurnStart(ctx: TriggerContext) {
    if (!ctx.matchState) return [];
    if (getTitanByController(ctx.state, ctx.playerId)) return [];

    const titan = getOwnedSetAsideTitan(ctx.state, ctx.playerId, 'sphinx');
    if (!titan) return [];

    const buriedChoices = getOwnedBuriedCardChoices(ctx.state, ctx.playerId);
    if (buriedChoices.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_sphinx_start_turn_${ctx.now}`,
        ctx.playerId,
        'Sphinx: choose one of your buried cards to return to your hand and move this titan there',
        [
            ...buriedChoices.map((choice) => ({
                id: `buried-${choice.cardUid}`,
                label: choice.label,
                value: choice,
                displayMode: 'card' as const,
            })),
            { id: 'skip', label: '璺宠繃', value: { skip: true }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_sphinx_start_turn', targetType: 'generic', autoResolveIfSingle: false, autoRefresh: 'buried', responseValidationMode: 'live' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function sphinxAfterScoring(ctx: {
    state: AbilityContext['state'];
    matchState?: AbilityContext['matchState'];
    baseIndex?: number;
    now: number;
}): AbilityResult | SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.matchState) return [];

    let nextMatchState = ctx.matchState;
    const sphinxesOnScoringBase = (ctx.state.titans ?? []).filter(titan =>
        titan.defId === 'sphinx'
        && titan.location.zone === 'base'
        && titan.location.baseIndex === ctx.baseIndex,
    );

    for (const titan of sphinxesOnScoringBase) {
        const buriedChoices = getOwnedBuriedCardChoices(ctx.state, titan.controllerId, ctx.baseIndex);
        if (buriedChoices.length === 0) continue;

        const interaction = createSimpleChoice(
            `titan_sphinx_after_scoring_${titan.uid}_${ctx.now}`,
            titan.controllerId,
            '鐙韩浜洪潰鍍忥細浣犲彲浠ュ皢姝ゅ涓€寮犱綘鐨勫煁钁墝绉诲洖鎵嬬墝',
            [
                ...buriedChoices.map((choice) => ({
                    id: `buried-${choice.cardUid}`,
                    label: choice.label,
                    value: choice,
                    displayMode: 'card' as const,
                })),
                { id: 'skip', label: '璺宠繃', value: { skip: true }, displayMode: 'button' as const },
            ],
            { sourceId: 'titan_sphinx_after_scoring', targetType: 'generic', autoRefresh: 'buried', responseValidationMode: 'live' },
        );
        nextMatchState = queueInteraction(nextMatchState, interaction);
    }

    return nextMatchState === ctx.matchState
        ? []
        : { events: [], matchState: nextMatchState };
}

function sphinxTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const player = ctx.state.players[ctx.playerId];
    if (!player || player.hand.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice(
        `titan_sphinx_talent_${ctx.now}`,
        ctx.playerId,
        '鐙韩浜洪潰鍍忥細閫夋嫨涓€寮犳墜鐗屽煁钁湪姝ゅ',
        player.hand.map((card) => ({
            id: `hand-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        })),
        { sourceId: 'titan_sphinx_talent', targetType: 'hand' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        baseIndex: titan.location.baseIndex,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function superSpiesMoonZeroThreeSpecial(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    if (!base.minions.every(minion => minion.controller === ctx.playerId)) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'super_spies_moon_zero_three_special');
}

function superSpiesMoonZeroThreeOnDeckInspected(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const titan = getControlledTitanOnBase(ctx.state, 'super_spies_moon_zero_three', ctx.playerId);
    if (!titan) return [];
    if ((ctx.state.moonZeroThreeTriggeredTurnByTitan ?? {})[titan.uid] === ctx.state.turnNumber) {
        return [];
    }
    return {
        events: [addTitanPowerCounter(titan.uid, 1, 'super_spies_moon_zero_three_on_deck_inspected', ctx.now)],
    };
}

function superSpiesMoonZeroThreeTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const playerOptions = getMoonZeroThreeInspectablePlayers(ctx.state);
    if (playerOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_super_spies_moon_zero_three_choose_player_${ctx.now}`,
        ctx.playerId,
        '涓夊彿绌洪棿绔欙細閫夋嫨瑕佹煡鐪嬬殑鐗屽簱',
        playerOptions.map((option, index) => ({
            id: `player-${index}`,
            label: option.label,
            value: { targetPlayerId: option.targetPlayerId },
            displayMode: 'button' as const,
        })),
        { sourceId: 'titan_super_spies_moon_zero_three_choose_player', targetType: 'player' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function penguinsEmperorPenguinOnTurnStart(ctx: TriggerContext) {
    if (getTitanByController(ctx.state, ctx.playerId)) return [];
    if (!ctx.matchState) return [];

    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'penguins_emperor_penguin'
        && candidate.ownerId === ctx.playerId
        && candidate.location.zone === 'setaside',
    );
    if (!titan) return [];

    const baseOptions = buildBaseTargetOptions(getEmperorPenguinEligibleBases(ctx.state, ctx.playerId), ctx.state);
    if (baseOptions.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_penguins_emperor_penguin_play_${ctx.now}`,
        ctx.playerId,
        '浼侀箙甯濈殗锛氶€夋嫨瑕佽繘鍦虹殑鍩哄湴',
        [
            ...baseOptions,
            { id: 'skip', label: '璺宠繃', value: { skip: true }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_penguins_emperor_penguin_play', targetType: 'base', autoResolveIfSingle: false },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function penguinsEmperorPenguinOngoingActivation(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const player = ctx.state.players[ctx.playerId];
    const topCard = player?.deck[0];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!player || !topCard || !base) {
        return { events: [] };
    }
    if (!(topCard.type === 'minion' || topCard.type === 'fusion')) {
        return { events: [] };
    }

    return {
        events: [{
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: ctx.playerId,
                cardUid: topCard.uid,
                defId: topCard.defId,
                baseIndex: ctx.baseIndex,
                baseDefId: base.defId,
                power: getMinionLikePower(topCard.defId) ?? 0,
                fromDeck: true,
                consumesNormalLimit: true,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function getEmperorPenguinTalentCandidates(state: AbilityContext['state'], playerId: string) {
    const player = state.players[playerId];
    if (!player) return [];

    const sources = [
        ...player.hand.map(card => ({ ...card, zone: 'hand' as const })),
        ...player.discard.map(card => ({ ...card, zone: 'discard' as const })),
    ];

    return sources
        .filter(card => (card.type === 'minion' || card.type === 'fusion'))
        .filter(card => (getMinionLikePower(card.defId) ?? 99) <= 3)
        .map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            zone: card.zone,
            label: `${getCardDef(card.defId)?.name ?? card.defId} (${card.zone === 'hand' ? 'hand' : 'discard'})`,
        }));
}

function penguinsEmperorPenguinTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const options = getEmperorPenguinTalentCandidates(ctx.state, ctx.playerId);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_penguins_emperor_penguin_talent_${ctx.now}`,
        ctx.playerId,
        'Emperor Penguin: choose a low-power minion to shuffle into your deck',
        options.map(option => ({
            id: option.cardUid,
            label: option.label,
            value: { cardUid: option.cardUid, defId: option.defId, zone: option.zone },
            displayMode: 'card' as const,
        })),
        { sourceId: 'titan_penguins_emperor_penguin_talent', targetType: 'generic', autoRefresh: 'hand_or_discard', responseValidationMode: 'live' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function changerbotsMergaconOnTurnStart(ctx: TriggerContext) {
    if (getTitanByController(ctx.state, ctx.playerId)) return [];
    if (!ctx.matchState) return [];

    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'changerbots_mergacon'
        && candidate.ownerId === ctx.playerId
        && candidate.location.zone === 'setaside',
    );
    if (!titan) return [];

    const baseOptions = buildBaseTargetOptions(getMergaconEligibleBases(ctx.state, ctx.playerId), ctx.state);
    if (baseOptions.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_changerbots_mergacon_play_${ctx.now}`,
        ctx.playerId,
        '鍚堜綋鏈哄櫒浜猴細閫夋嫨瑕佽繘鍦虹殑鍩哄湴',
        [
            ...baseOptions,
            { id: 'skip', label: '璺宠繃', value: { skip: true }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_changerbots_mergacon_play', targetType: 'base', autoResolveIfSingle: false },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

type CthulhuTitanTalentChoiceValue = { choice: 'draw' | 'give' };
type CthulhuTitanTransferChoiceValue = { targetPlayerId: string; madnessUid: string };

function buildCthulhuTitanTransferOptions(state: AbilityContext['state'], playerId: string) {
    const player = state.players[playerId];
    if (!player) return [];

    const madnessCard = player.hand.find(card => card.defId === MADNESS_CARD_DEF_ID);
    if (!madnessCard) return [];

    return state.turnOrder
        .filter(pid => pid !== playerId)
        .filter(pid => Boolean(state.players[pid]))
        .map(pid => ({
            id: `player-${pid}`,
            label: getPlayerLabel(pid),
            value: { targetPlayerId: pid, madnessUid: madnessCard.uid },
            displayMode: 'button' as const,
        }));
}

function queueCthulhuTitanTransferInteraction(
    matchState: AbilityContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    now: number,
) {
    const transferOptions = buildCthulhuTitanTransferOptions(state, playerId);
    if (transferOptions.length === 0) return undefined;
    const interaction = createSimpleChoice<CthulhuTitanTransferChoiceValue>(
        `titan_cthulhu_cthulhu_titan_talent_target_${now}`,
        playerId,
        'Cthulhu: choose a player to receive a Madness card',
        transferOptions,
        { sourceId: 'titan_cthulhu_cthulhu_titan_talent_target', targetType: 'generic' },
    );
    return queueInteraction(matchState, interaction);
}

function cthulhuTitanTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const canDrawMadness = (ctx.state.madnessDeck?.length ?? 0) > 0;
    const transferOptions = buildCthulhuTitanTransferOptions(ctx.state, ctx.playerId);
    const canTransferMadness = transferOptions.length > 0;

    if (!canDrawMadness && !canTransferMadness) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (canDrawMadness && !canTransferMadness) {
        const madnessEvent = drawMadnessCards(ctx.playerId, 1, ctx.state, 'cthulhu_cthulhu_titan_talent', ctx.now);
        return { events: madnessEvent ? [madnessEvent] : [] };
    }

    if (!canDrawMadness && canTransferMadness) {
        const nextMatchState = queueCthulhuTitanTransferInteraction(ctx.matchState, ctx.state, ctx.playerId, ctx.now);
        return nextMatchState
            ? { events: [], matchState: nextMatchState }
            : { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice<CthulhuTitanTalentChoiceValue>(
        `titan_cthulhu_cthulhu_titan_talent_choice_${ctx.now}`,
        ctx.playerId,
        '鍏嬭嫃椴侊細閫夋嫨瑕佹墽琛岀殑澶╄祴鏁堟灉',
        [
            {
                id: 'draw',
                label: '鎶戒竴寮犵柉鐙傚崱',
                value: { choice: 'draw' },
                displayMode: 'button' as const,
            },
            {
                id: 'give',
                label: '缁欏彟涓€浣嶇帺瀹朵竴寮犵柉鐙傚崱',
                value: { choice: 'give' },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'titan_cthulhu_cthulhu_titan_talent_choice', targetType: 'button' },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function buildCthulhuTitanCounterEvents(
    state: AbilityContext['state'],
    event: SmashUpEvent,
): SmashUpEvent[] | undefined {
    if (event.type === SU_EVENTS.MADNESS_DRAWN) {
        const { playerId, count } = (event as MadnessDrawnEvent).payload;
        if (count <= 0) return undefined;
        const titan = getControlledTitanOnBase(state, 'cthulhu_cthulhu_titan', playerId);
        if (!titan) return undefined;
        return [
            event,
            addTitanPowerCounter(titan.uid, count, 'cthulhu_cthulhu_titan', event.timestamp ?? 0),
        ];
    }

    if (event.type === SU_EVENTS.ACTION_PLAYED) {
        const { playerId, defId } = (event as ActionPlayedEvent).payload;
        if (defId !== MADNESS_CARD_DEF_ID) return undefined;
        const titan = getControlledTitanOnBase(state, 'cthulhu_cthulhu_titan', playerId);
        if (!titan) return undefined;
        return [
            event,
            addTitanPowerCounter(titan.uid, 1, 'cthulhu_cthulhu_titan', event.timestamp ?? 0),
        ];
    }

    return undefined;
}

function getEligibleKrakenSetAsideTitans(state: AbilityContext['state'], scoringBaseIndex: number) {
    const base = state.bases[scoringBaseIndex];
    if (!base) return [];
    return (state.titans ?? []).filter(titan =>
        titan.defId === 'pirates_the_kraken'
        && titan.location.zone === 'setaside'
        && base.minions.some(minion => minion.controller === titan.ownerId)
        && !getTitanByController(state, titan.ownerId),
    );
}

function getKrakenRescueMinionTargets(state: AbilityContext['state'], playerId: string, baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return base.minions
        .filter(minion => minion.controller === playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
}

function getGreatWolfSpiritEligibleBases(state: AbilityContext['state'], playerId: string) {
    return state.bases
        .map((base, baseIndex) => {
            const myPower = getPlayerEffectivePowerOnBase(state, base, baseIndex, playerId);
            if (myPower <= 0) return null;
            const hasHighestPower = Object.keys(state.players).every(pid => {
                if (pid === playerId) return true;
                return getPlayerEffectivePowerOnBase(state, base, baseIndex, pid) <= myPower;
            });
            if (!hasHighestPower) return null;
            return {
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `鍩哄湴 ${baseIndex + 1}`,
            };
        })
        .filter((value): value is { baseIndex: number; label: string } => value !== null);
}

function getGreatWolfSpiritTalentTargets(state: AbilityContext['state'], playerId: string) {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === playerId)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} (${getBaseDef(base.defId)?.name ?? `鍩哄湴 ${baseIndex + 1}`})`,
            })),
    );
}

function werewolvesGreatWolfSpiritSpecial(ctx: AbilityContext): AbilityResult {
    const eligibleBases = getGreatWolfSpiritEligibleBases(ctx.state, ctx.playerId);
    if (eligibleBases.length < 2) return { events: [] };
    if (!eligibleBases.some(option => option.baseIndex === ctx.baseIndex)) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'werewolves_great_wolf_spirit_special');
}

function werewolvesGreatWolfSpiritTalent(ctx: AbilityContext): AbilityResult {
    const targets = getGreatWolfSpiritTalentTargets(ctx.state, ctx.playerId);
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_werewolves_great_wolf_spirit_talent_${ctx.now}`,
        ctx.playerId,
        '宸ㄧ嫾涔嬬伒锛氶€夋嫨涓€涓綘鐨勯殢浠庤幏寰?+1 鎴樺姏鐩村埌鍥炲悎缁撴潫',
        buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, sourceDefId: ctx.defId, effectType: 'buff' }),
        { sourceId: 'titan_werewolves_great_wolf_spirit_talent', targetType: 'minion' },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function changerbotsMergaconTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const baseOptions = getOtherBaseOptions(ctx.state, titan.location.baseIndex);
    if (baseOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_changerbots_mergacon_talent_${ctx.now}`,
        ctx.playerId,
        'Mergacon: choose a base to move to',
        buildBaseTargetOptions(baseOptions, ctx.state),
        { sourceId: 'titan_changerbots_mergacon_talent', targetType: 'base' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        fromBaseIndex: titan.location.baseIndex,
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function trickstersBigFunnyGiantSpecial(ctx: AbilityContext): AbilityResult {
    return playTitanFromSetAside(ctx, 'tricksters_big_funny_giant_special');
}

function getBigFunnyGiantDiscardableHandCards(state: AbilityContext['state'], playerId: string, excludeCardUid?: string) {
    const player = state.players[playerId];
    if (!player) return [];
    return player.hand.filter(card => card.uid !== excludeCardUid);
}

function trickstersBigFunnyGiantOnTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    const titans = (ctx.state.titans ?? []).filter(candidate =>
        candidate.defId === 'tricksters_big_funny_giant'
        && candidate.location.zone === 'base'
        && candidate.controllerId !== ctx.playerId,
    );
    if (titans.length === 0) {
        return [];
    }

    const events: SmashUpEvent[] = [];
    for (const titan of titans) {
        const base = ctx.state.bases[titan.location.baseIndex];
        if (!base) continue;

        const endingPlayerHasMinionHere = base.minions.some(minion => minion.controller === ctx.playerId);
        if (endingPlayerHasMinionHere) continue;

        events.push(addTitanPowerCounter(titan.uid, 1, 'tricksters_big_funny_giant', ctx.now));
    }

    return events;
}

function trickstersBigFunnyGiantOnMinionPlayed(ctx: AbilityContext): AbilityResult | SmashUpEvent[] {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return [];
    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'tricksters_big_funny_giant'
        && candidate.location.zone === 'base'
        && candidate.location.baseIndex === ctx.baseIndex,
    );
    if (!titan || titan.controllerId === ctx.playerId) {
        return [];
    }

    const discardable = getBigFunnyGiantDiscardableHandCards(ctx.state, ctx.playerId);
    if (discardable.length === 0) {
        return [];
    }
    if (!ctx.matchState) {
        return [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: ctx.playerId, cardUids: [discardable[0].uid] },
            timestamp: ctx.now,
        }];
    }
    if (discardable.length === 1) {
        return {
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: ctx.playerId, cardUids: [discardable[0].uid] },
                timestamp: ctx.now,
            }],
            matchState: ctx.matchState,
        };
    }

        const interaction = createSimpleChoice(
            `titan_tricksters_big_funny_giant_discard_${ctx.now}`,
            ctx.playerId,
            'Big Funny Giant: choose a card to discard so you can play this titan here',
            discardable.map(card => ({
                id: `discard-${card.uid}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
            _source: 'hand' as const,
        })),
        { sourceId: 'titan_tricksters_big_funny_giant_discard_to_play', targetType: 'hand' },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function trickstersBigFunnyGiantAfterScoring(ctx: {
    state: AbilityContext['state'];
    baseIndex?: number;
    rankings?: TriggerContext['rankings'];
    now: number;
}): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.rankings || ctx.rankings.length === 0) {
        return [];
    }

    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) {
        return [];
    }

    const highestPower = Math.max(...ctx.rankings.map(entry => entry.power));
    const winnerIds = new Set(
        ctx.rankings
            .filter(entry => entry.power === highestPower)
            .map(entry => entry.playerId),
    );
    if (winnerIds.size === 0) {
        return [];
    }

    const titans = (ctx.state.titans ?? []).filter(candidate =>
        candidate.defId === 'tricksters_big_funny_giant'
        && candidate.location.zone === 'base'
        && candidate.location.baseIndex === ctx.baseIndex
        && winnerIds.has(candidate.controllerId),
    );
    if (titans.length === 0) {
        return [];
    }

    const events: SmashUpEvent[] = [];
    for (const titan of titans) {
        const anotherPlayerHasNoMinionHere = Object.keys(ctx.state.players).some(otherPlayerId =>
            otherPlayerId !== titan.controllerId
            && !base.minions.some(minion => minion.controller === otherPlayerId),
        );
        if (!anotherPlayerHasNoMinionHere) continue;

        events.push({
            type: SU_EVENTS.VP_AWARDED,
            payload: {
                playerId: titan.controllerId,
                amount: 1,
                reason: 'tricksters_big_funny_giant_after_scoring',
            },
            timestamp: ctx.now,
        } as VpAwardedEvent);
    }

    return events;
}

function getRainborocLowPowerDiscardCards(state: AbilityContext['state'], playerId: string) {
    const player = state.players[playerId];
    if (!player) return [];

    return player.discard.filter(card => {
        const def = getCardDef(card.defId) as MinionCardDef | undefined;
        return def?.type === 'minion' && (def.power ?? 0) <= 2;
    });
}

function ittyCrittersRainborocAfterScoring(ctx: {
    state: AbilityContext['state'];
    matchState?: AbilityContext['matchState'];
    baseIndex?: number;
    rankings?: TriggerContext['rankings'];
    now: number;
}): AbilityResult | SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.matchState || !ctx.rankings || ctx.rankings.length === 0) {
        return [];
    }

    const highestPower = Math.max(...ctx.rankings.map(entry => entry.power));
    const winnerIds = new Set(
        ctx.rankings
            .filter(entry => entry.power === highestPower)
            .map(entry => entry.playerId),
    );
    if (winnerIds.size === 0) {
        return [];
    }

    let nextMatchState = ctx.matchState;
    for (const titan of (ctx.state.titans ?? []).filter(candidate =>
        candidate.defId === 'itty_critters_rainboroc'
        && candidate.location.zone === 'setaside'
        && winnerIds.has(candidate.ownerId),
    )) {
        const interaction = createSimpleChoice(
            `titan_itty_critters_rainboroc_play_replacement_${titan.uid}_${ctx.now}`,
            titan.ownerId,
            'Rainboroc: play this titan on the replacement base?',
            [
                { id: 'play', label: 'Play Rainboroc', value: { play: true }, displayMode: 'button' as const },
                { id: 'skip', label: 'Skip', value: { skip: true }, displayMode: 'button' as const },
            ],
            { sourceId: 'titan_itty_critters_rainboroc_play_replacement', targetType: 'button' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: titan.uid,
            titanDefId: titan.defId,
            scoringBaseIndex: ctx.baseIndex,
        };
        nextMatchState = queueInteraction(nextMatchState, interaction);
    }

    return nextMatchState === ctx.matchState
        ? []
        : { events: [], matchState: nextMatchState };
}

function ittyCrittersRainborocOnMinionPlayed(ctx: AbilityContext): AbilityResult | SmashUpEvent[] {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return [];

    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'itty_critters_rainboroc'
        && candidate.location.zone === 'base'
        && candidate.location.baseIndex === ctx.baseIndex
        && candidate.controllerId === ctx.playerId,
    );
    if (!titan) {
        return [];
    }

    if ((ctx.state.rainborocTriggeredTurnByTitan ?? {})[titan.uid] === ctx.state.turnNumber) {
        return [];
    }

    const triggerMinion = ctx.state.bases[ctx.baseIndex]?.minions.find(minion =>
        minion.uid === ctx.triggerMinionUid,
    );
    if (!triggerMinion || triggerMinion.controller !== ctx.playerId) {
        return [];
    }

    const triggerDef = getCardDef(triggerMinion.defId) as MinionCardDef | undefined;
    const triggerPower = triggerDef?.power ?? triggerMinion.basePower;
    if (triggerPower > 2) {
        return [];
    }

    return [
        addTitanPowerCounter(titan.uid, 1, 'itty_critters_rainboroc', ctx.now),
    ];
}

function ittyCrittersRainborocTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const discardable = getRainborocLowPowerDiscardCards(ctx.state, ctx.playerId);
    if (discardable.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_itty_critters_rainboroc_choose_discard_${ctx.now}`,
        ctx.playerId,
        '褰╄櫣楦燂細閫夋嫨寮冪墝鍫嗕腑涓€涓垬鍔?2 鎴栨洿浣庣殑闅忎粠娲楀洖鐗屽簱',
        discardable.map(card => ({
            id: `rainboroc-discard-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
            _source: 'discard' as const,
        })),
        { sourceId: 'titan_itty_critters_rainboroc_choose_discard', targetType: 'discard' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        fromBaseIndex: titan.location.baseIndex,
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function piratesTheKrakenAfterScoring(ctx: {
    state: AbilityContext['state'];
    matchState?: AbilityContext['matchState'];
    baseIndex?: number;
    now: number;
}): AbilityResult | SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.matchState) return [];

    let nextMatchState = ctx.matchState;

    for (const titan of getEligibleKrakenSetAsideTitans(ctx.state, ctx.baseIndex)) {
        const interaction = createSimpleChoice(
            `titan_pirates_the_kraken_play_replacement_${titan.uid}_${ctx.now}`,
            titan.ownerId,
            '娴锋€厠鎷夎偗锛氭槸鍚﹀皢鍏舵墦鍑哄埌鏇挎崲鐨勫熀鍦帮紵',
            [
                { id: 'play', label: '鎵撳嚭娴锋€厠鎷夎偗', value: { play: true }, displayMode: 'button' as const },
                { id: 'skip', label: '璺宠繃', value: { skip: true }, displayMode: 'button' as const },
            ],
            { sourceId: 'titan_pirates_the_kraken_play_replacement', targetType: 'button' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: titan.uid,
            titanDefId: titan.defId,
            ownerId: titan.ownerId,
            controllerId: titan.ownerId,
            scoringBaseIndex: ctx.baseIndex,
        };
        nextMatchState = queueInteraction(nextMatchState, interaction);
    }

    const krakensOnScoringBase = (ctx.state.titans ?? []).filter(titan =>
        titan.defId === 'pirates_the_kraken'
        && titan.location.zone === 'base'
        && titan.location.baseIndex === ctx.baseIndex,
    );
    for (const titan of krakensOnScoringBase) {
        const minionTargets = getKrakenRescueMinionTargets(ctx.state, titan.controllerId, ctx.baseIndex);
        const otherBases = getOtherBaseOptions(ctx.state, ctx.baseIndex);
        if (minionTargets.length === 0 || otherBases.length === 0) continue;

        const interaction = createSimpleChoice(
            `titan_pirates_the_kraken_choose_minion_${titan.uid}_${ctx.now}`,
            titan.controllerId,
            'The Kraken: move one of your minions here to another base instead of discarding it',
            buildMinionTargetOptions(minionTargets, { state: ctx.state, sourcePlayerId: titan.controllerId, effectType: 'move' }),
            { sourceId: 'titan_pirates_the_kraken_choose_minion', targetType: 'minion' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            scoringBaseIndex: ctx.baseIndex,
        };
        nextMatchState = queueInteraction(nextMatchState, interaction);
    }

    return nextMatchState === ctx.matchState
        ? []
        : { events: [], matchState: nextMatchState };
}

function piratesTheKrakenTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const baseOptions = getOtherBaseOptions(ctx.state, titan.location.baseIndex);
    if (baseOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_pirates_the_kraken_talent_${ctx.now}`,
        ctx.playerId,
        'The Kraken: choose a base to move to',
        buildBaseTargetOptions(baseOptions, ctx.state),
        { sourceId: 'titan_pirates_the_kraken_talent', targetType: 'base' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        controllerId: titan.controllerId,
        fromBaseIndex: titan.location.baseIndex,
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function giantAntsDeathOnSixLegsSpecial(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    const player = ctx.state.players[ctx.playerId];
    if (!titan || titan.location.zone !== 'setaside' || !player) {
        return { events: [] };
    }
    if (getOwnTotalMinionCounters(ctx.state, ctx.playerId) < 6 || player.hand.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice(
        `titan_giant_ants_death_on_six_legs_special_${ctx.now}`,
        ctx.playerId,
        'Death on Six Legs锛氬純 1 寮犵墝鏉ユ墦鍑烘娉板潶',
        player.hand.map(card => ({
            id: `hand-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        })),
        { sourceId: 'titan_giant_ants_death_on_six_legs_special', targetType: 'hand' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        baseIndex: ctx.baseIndex,
        baseDefId: ctx.state.bases[ctx.baseIndex]?.defId,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function giantAntsDeathOnSixLegsTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    return {
        events: [grantExtraAction(ctx.playerId, 'giant_ants_death_on_six_legs', ctx.now)],
    };
}

function getMajorUrsaEnemyMinionTargets(state: AbilityContext['state'], playerId: string, baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return base.minions
        .filter(minion => minion.controller !== playerId && getMinionPower(state, minion, baseIndex) <= 3)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
        }));
}

function bearCavalryMajorUrsaSpecial(ctx: AbilityContext): AbilityResult {
    return playTitanFromSetAside(ctx, 'bear_cavalry_major_ursa_special');
}

function bearCavalryMajorUrsaTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const base = ctx.state.bases[titan.location.baseIndex];
    if (!base) {
        return { events: [] };
    }

    const counterTargets = base.minions.map(minion => ({
        uid: minion.uid,
        defId: minion.defId,
        baseIndex: titan.location.baseIndex,
    }));
    const baseOptions = getOtherBaseOptions(ctx.state, titan.location.baseIndex);
    const canAddCounter = counterTargets.length > 0;
    const canMoveTitan = baseOptions.length > 0;
    if (!canAddCounter && !canMoveTitan) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (canAddCounter && !canMoveTitan) {
        const counterInteraction = createSimpleChoice(
            `titan_bear_cavalry_major_ursa_choose_counter_target_${ctx.now}`,
            ctx.playerId,
            'Major Ursa: choose a minion here to place a +1 power counter on',
            buildMinionTargetOptions(counterTargets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'affect' }),
            { sourceId: 'titan_bear_cavalry_major_ursa_choose_counter_target', targetType: 'minion' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, counterInteraction),
        };
    }

    if (!canAddCounter && canMoveTitan) {
        const moveInteraction = createSimpleChoice(
            `titan_bear_cavalry_major_ursa_choose_destination_${ctx.now}`,
            ctx.playerId,
            'Major Ursa: choose a base to move to',
            buildBaseTargetOptions(baseOptions, ctx.state),
            { sourceId: 'titan_bear_cavalry_major_ursa_choose_destination', targetType: 'base' },
        );
        (moveInteraction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: titan.uid,
            fromBaseIndex: titan.location.baseIndex,
            titanDefId: titan.defId,
        };
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, moveInteraction),
        };
    }

    const modeInteraction = createSimpleChoice(
        `titan_bear_cavalry_major_ursa_choose_talent_mode_${ctx.now}`,
        ctx.playerId,
        'Major Ursa: choose a talent effect',
        [
            { id: 'counter', label: 'Place a +1 counter', value: { branch: 'counter' }, displayMode: 'button' as const },
            { id: 'move', label: 'Move this titan', value: { branch: 'move' }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_bear_cavalry_major_ursa_choose_talent_mode', targetType: 'generic' },
    );
    (modeInteraction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        baseIndex: titan.location.baseIndex,
    };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, modeInteraction),
    };
}

function bearCavalryMajorUrsaOnTitanMoved(ctx: AbilityContext): AbilityResult {
    void ctx;
    return { events: [] };
}

function bearCavalryMajorUrsaOnMinionMoved(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return [];

    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'bear_cavalry_major_ursa'
        && candidate.location.zone === 'base'
        && candidate.location.baseIndex === ctx.baseIndex
        && candidate.controllerId === ctx.playerId,
    );
    if (!titan) {
        return [];
    }

    const movedMinion = [
        ctx.moveToBaseIndex,
        ctx.moveFromBaseIndex,
        ctx.baseIndex,
    ]
        .filter((baseIndex): baseIndex is number => baseIndex !== undefined)
        .flatMap(baseIndex => ctx.state.bases[baseIndex]?.minions ?? [])
        .find(minion => minion.uid === ctx.triggerMinionUid);
    if (!movedMinion || movedMinion.controller === ctx.playerId) {
        return [];
    }

    return [addTitanPowerCounter(titan.uid, 1, 'bear_cavalry_major_ursa', ctx.now)];
}

function vampireAncientLordTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const candidates = ctx.state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === ctx.playerId && (minion.powerCounters ?? 0) > 0)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: (getCardDef(minion.defId)?.name ?? minion.defId) + ' @ ' + (getBaseDef(base.defId)?.name ?? ('Base ' + (baseIndex + 1))),
            })),
    );

    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_vampires_ancient_lord_talent_${ctx.now}`,
        ctx.playerId,
        'Ancient Lord: choose one of your minions with a +1 power counter',
        buildMinionTargetOptions(candidates, { state: ctx.state, sourcePlayerId: ctx.playerId, sourceDefId: ctx.defId, effectType: 'affect' }),
        { sourceId: 'titan_vampires_ancient_lord_talent', targetType: 'minion' },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function getSetAsideOwnedTitan(state: AbilityContext['state'], defId: string, playerId: string) {
    return (state.titans ?? []).find(candidate =>
        candidate.defId === defId
        && candidate.ownerId === playerId
        && candidate.location.zone === 'setaside',
    );
}

function queueVampireAncientLordSpecialInteraction(
    matchState: AbilityContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    minionUid: string,
    baseIndex: number,
    now: number,
) {
    const titan = getSetAsideOwnedTitan(state, 'vampires_ancient_lord', playerId);
    const base = state.bases[baseIndex];
    if (!titan || !base) return undefined;

    const options = [
        {
            id: 'skip',
            label: '淇濈暀鍦ㄩ殢浠庝笂',
            value: { mode: 'skip', minionUid, baseIndex, titanUid: titan.uid },
            displayMode: 'button' as const,
        },
        {
            id: 'store',
            label: 'Place it on Ancient Lord',
            value: { mode: 'store', minionUid, baseIndex, titanUid: titan.uid },
            displayMode: 'button' as const,
        },
    ];

    if (!getTitanByController(state, playerId) && (titan.powerCounters + 1) >= 3) {
        options.push({
            id: 'store-and-play',
            label: 'Place it there and play Ancient Lord',
            value: { mode: 'storeAndPlay', minionUid, baseIndex, titanUid: titan.uid },
            displayMode: 'button' as const,
        });
    }

    const interaction = createSimpleChoice(
        `titan_vampires_ancient_lord_special_${now}`,
        playerId,
        '椴滆棰嗕富锛氶€夋嫨鏄惁鎶婂叾涓?1 鏋?+1 鎴樻枟鍔涙爣璁版敼鏀惧埌姝ゆ嘲鍧︿笂',
        options,
        { sourceId: 'titan_vampires_ancient_lord_special', targetType: 'generic' },
    );
    return queueInteraction(matchState, interaction);
}

function vampireAncientLordOnPowerCounterChanged(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || ctx.counterChangeKind !== 'added' || (ctx.counterDelta ?? 0) <= 0) {
        return [];
    }
    if (!ctx.triggerMinion || ctx.triggerMinion.controller !== ctx.playerId || ctx.baseIndex === undefined) {
        return [];
    }
    if (ctx.reason?.startsWith('vampires_ancient_lord_special')) {
        return [];
    }

    const nextState = queueVampireAncientLordSpecialInteraction(
        ctx.matchState,
        ctx.state,
        ctx.playerId,
        ctx.triggerMinion.uid,
        ctx.baseIndex,
        ctx.now,
    );
    return nextState ? { events: [], matchState: nextState } : [];
}

function buildAncientLordBonusCounterEvents(state: AbilityContext['state'], event: SmashUpEvent): SmashUpEvent[] | undefined {
    if (event.type !== SU_EVENTS.POWER_COUNTER_ADDED) {
        return undefined;
    }

    const podPayload = (event as PowerCounterAddedEvent).payload;
    if (podPayload.amount <= 0) return undefined;

    const podTarget = state.bases[podPayload.baseIndex]?.minions.find(minion => minion.uid === podPayload.minionUid);
    if (!podTarget) return undefined;

    const podAncientLord = (state.titans ?? []).find(titan =>
        titan.defId === 'vampires_ancient_lord'
        && titan.location.zone === 'base'
        && titan.location.baseIndex === podPayload.baseIndex
        && titan.controllerId === podTarget.controller,
    );
    if (!podAncientLord || (podTarget.powerCounters ?? 0) > 0) return undefined;

    return [
        event,
        addPowerCounter(podPayload.minionUid, podPayload.baseIndex, 1, 'vampires_ancient_lord', event.timestamp ?? 0),
    ];

    if (event.type === SU_EVENTS.POWER_COUNTER_ADDED) {
        const { minionUid, baseIndex, amount } = (event as PowerCounterAddedEvent).payload;
        if (amount <= 0) return undefined;

        const target = state.bases[baseIndex]?.minions.find(minion => minion.uid === minionUid);
        if (!target) return undefined;

        const ancientLord = (state.titans ?? []).find(titan =>
            titan.defId === 'vampires_ancient_lord'
            && titan.location.zone === 'base'
            && titan.controllerId === target.controller,
        );
        if (!ancientLord || (target.powerCounters ?? 0) > 0) return undefined;

        return [event, addPowerCounter(minionUid, baseIndex, 1, 'vampires_ancient_lord', event.timestamp ?? 0)];
    }

    if (event.type === SU_EVENTS.TITAN_POWER_COUNTER_ADDED) {
        const { titanUid, amount } = (event as TitanPowerCounterAddedEvent).payload;
        if (amount <= 0) return undefined;

        const targetTitan = (state.titans ?? []).find(titan => titan.uid === titanUid && titan.location.zone === 'base');
        if (!targetTitan) return undefined;

        const ancientLord = (state.titans ?? []).find(titan =>
            titan.defId === 'vampires_ancient_lord'
            && titan.location.zone === 'base'
            && titan.controllerId === targetTitan.controllerId,
        );
        if (!ancientLord || targetTitan.powerCounters > 0) return undefined;

        return [event, addTitanPowerCounter(titanUid, 1, 'vampires_ancient_lord', event.timestamp ?? 0)];
    }

    return undefined;
}

function queueDeathOnSixLegsTransferInteraction(
    matchState: AbilityContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    minionUid: string,
    minionDefId: string,
    baseIndex: number,
    now: number,
) {
    const sourceBase = state.bases[baseIndex];
    const sourceMinion = sourceBase?.minions.find(minion => minion.uid === minionUid);
    if (!sourceMinion || (sourceMinion.powerCounters ?? 0) <= 0) {
        return undefined;
    }

    const titan = (state.titans ?? []).find(candidate =>
        candidate.defId === 'giant_ants_death_on_six_legs'
        && candidate.location.zone === 'base'
        && candidate.controllerId === playerId,
    );
    if (!titan) return undefined;

    const minionName = getCardDef(minionDefId)?.name ?? minionDefId;
    const interaction = createSimpleChoice(
        `titan_giant_ants_death_on_six_legs_transfer_${now}`,
        playerId,
        `Death on Six Legs: transfer one +1 power counter from ${minionName} to this titan?`,
        [
            {
                id: 'transfer',
                label: 'Transfer 1 counter',
                value: { transfer: true, titanUid: titan.uid, minionUid, baseIndex },
                displayMode: 'button' as const,
            },
            {
                id: 'skip',
                label: '璺宠繃',
                value: { skip: true, titanUid: titan.uid, minionUid, baseIndex },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'titan_giant_ants_death_on_six_legs_transfer', targetType: 'generic' },
    );
    return queueInteraction(matchState, interaction);
}

function giantAntsDeathOnSixLegsBeforeDiscard(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || !ctx.triggerMinion || ctx.baseIndex === undefined) {
        return [];
    }
    if (ctx.reason?.startsWith('giant_ants_death_on_six_legs_transfer')) {
        return [];
    }

    const nextState = queueDeathOnSixLegsTransferInteraction(
        ctx.matchState,
        ctx.state,
        ctx.playerId,
        ctx.triggerMinion.uid,
        ctx.triggerMinion.defId,
        ctx.baseIndex,
        ctx.now,
    );
    return nextState ? { events: [], matchState: nextState } : [];
}

function buildTitanMetadataUpdateEvent(
    titanUid: string,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.TITAN_METADATA_UPDATED,
        payload: {
            titanUid,
            metadataUpdate,
            reason,
        },
        timestamp: now,
    };
}

function getAllBaseOptions(state: AbilityContext['state']) {
    return buildBaseTargetOptions(
        state.bases.map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `鍩哄湴 ${baseIndex + 1}`,
        })),
        state,
    );
}

function getFortTitanosaurus(state: AbilityContext['state'], playerId: string) {
    return getControlledTitanOnBase(state, 'dinosaurs_fort_titanosaurus', playerId);
}

function getFortTitanosaurusSpecialTargets(state: AbilityContext['state'], playerId: string, baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return base.minions
        .filter(minion => minion.controller === playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId} (${getMinionPower(state, minion, baseIndex)})`,
        }));
}

function fortTitanosaurusSpecial(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    const player = ctx.state.players[ctx.playerId];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!titan || titan.location.zone !== 'setaside' || !player || !base) {
        return { events: [] };
    }
    if ((player.minionsPlayed ?? 0) > 0 || getTitanByController(ctx.state, ctx.playerId)) {
        return { events: [] };
    }

    const targets = getFortTitanosaurusSpecialTargets(ctx.state, ctx.playerId, ctx.baseIndex);
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_dinosaurs_fort_titanosaurus_special_${ctx.now}`,
        ctx.playerId,
        'Fort Titanosaurus: choose one of your minions to destroy',
        buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        { sourceId: 'titan_dinosaurs_fort_titanosaurus_special', targetType: 'minion' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        baseIndex: ctx.baseIndex,
        baseDefId: base.defId,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function fortTitanosaurusOnActionPlayed(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || ctx.actionTargetType !== 'minion' || !ctx.actionTargetMinionUid) {
        return [];
    }

    const titan = getFortTitanosaurus(ctx.state, ctx.playerId);
    if (!titan) return [];
    if (Number(titan.metadata?.fortTitanosaurusTriggeredTurn ?? -1) === ctx.state.turnNumber) {
        return [];
    }

    const target = findMinionOnBases(ctx.state, ctx.actionTargetMinionUid);
    const options = [
        {
            id: 'titan-only',
            label: 'Place it on this titan only',
            value: { mode: 'titan' },
            displayMode: 'button' as const,
        },
    ];

    if (target) {
        const minionName = getCardDef(target.minion.defId)?.name ?? target.minion.defId;
        options.unshift({
            id: 'minion-only',
            label: `鍙粰 ${minionName} 鏀剧疆`,
            value: { mode: 'minion' },
            displayMode: 'button' as const,
        });
        options.push({
            id: 'both',
            label: `Place one on ${minionName} and one on this titan`,
            value: { mode: 'both' },
            displayMode: 'button' as const,
        });
    }

    const interaction = createSimpleChoice(
        `titan_dinosaurs_fort_titanosaurus_ongoing_${ctx.now}`,
        ctx.playerId,
        'Fort Titanosaurus: choose where to place the +1 power counter',
        options,
        { sourceId: 'titan_dinosaurs_fort_titanosaurus_ongoing', targetType: 'generic' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        targetMinionUid: target?.minion.uid,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function fortTitanosaurusTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId || titan.powerCounters < 4) {
        return { events: [] };
    }
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function buildInvisibleNinjaPeekResult(
    state: AbilityContext['state'],
    playerId: string,
    random: AbilityContext['random'],
    now: number,
    reason: string,
): { events: SmashUpEvent[]; cards: Array<{ uid: string; defId: string }> } {
    const player = state.players[playerId];
    if (!player) return { events: [], cards: [] };

    let deckSnapshot = [...player.deck];
    const events: SmashUpEvent[] = [];

    if (deckSnapshot.length === 0 && player.discard.length > 0) {
        deckSnapshot = random.shuffle([...player.discard]);
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: deckSnapshot.map(card => card.uid) },
            timestamp: now,
        });
    } else if (deckSnapshot.length === 1 && player.discard.length > 0) {
        const shuffledDiscard = random.shuffle([...player.discard]);
        deckSnapshot = [deckSnapshot[0], ...shuffledDiscard];
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: deckSnapshot.map(card => card.uid) },
            timestamp: now,
        });
    }

    const cards = deckSnapshot.slice(0, 2).map(card => ({ uid: card.uid, defId: card.defId }));
    if (cards.length === 0) return { events, cards: [] };

    events.push(inspectDeck(playerId, playerId, cards.length, reason, now));
    events.push(revealDeckTop(playerId, playerId, cards, cards.length, reason, now, playerId));
    return { events, cards };
}

function invisibleNinjaOnTurnStart(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'ninjas_invisible_ninja' && candidate.ownerId === ctx.playerId,
    );
    if (!titan) return [];

    const events: SmashUpEvent[] = [
        buildTitanMetadataUpdateEvent(
            titan.uid,
            {
                invisibleNinjaStartTurn: ctx.state.turnNumber,
                invisibleNinjaWasInPlayAtStart: titan.location.zone === 'base',
            },
            'ninjas_invisible_ninja_turn_start',
            ctx.now,
        ),
    ];

    if (!ctx.matchState || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events };
    }

    const interaction = createSimpleChoice(
        `titan_ninjas_invisible_ninja_start_turn_${ctx.now}`,
        ctx.playerId,
        'Invisible Ninja锛氫綘鍙互娑堢伃姝ゆ嘲鍧︼紝棰濆鎵撳嚭 1 寮犳垬鏂楀姏 3 鎴栦互涓嬬殑闅忎粠',
        [
            { id: 'destroy', label: 'Destroy it and gain the extra minion play', value: { destroyTitan: true }, displayMode: 'button' as const },
            { id: 'skip', label: 'Skip', value: { skip: true }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_ninjas_invisible_ninja_start_turn', targetType: 'generic' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
    };

    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function invisibleNinjaSpecial(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    const player = ctx.state.players[ctx.playerId];
    if (!titan || titan.location.zone !== 'setaside' || !player || player.hand.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice(
        `titan_ninjas_invisible_ninja_special_${ctx.now}`,
        ctx.playerId,
        'Invisible Ninja锛氬純 1 寮犵墝鏉ユ墦鍑烘娉板潶',
        player.hand.map(card => ({
            id: `hand-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        })),
        { sourceId: 'titan_ninjas_invisible_ninja_special', targetType: 'hand' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        baseIndex: ctx.baseIndex,
        baseDefId: ctx.state.bases[ctx.baseIndex]?.defId,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function invisibleNinjaTriggered(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const titan = getControlledTitanOnBase(ctx.state, 'ninjas_invisible_ninja', ctx.playerId);
    if (!titan || !ctx.matchState) return [];
    if (Number(titan.metadata?.invisibleNinjaTriggeredTurn ?? -1) === ctx.state.turnNumber) {
        return [];
    }

    const destroyAnotherPlayersCard =
        ctx.destroyerId === ctx.playerId
        && !!ctx.triggerMinion
        && ctx.triggerMinion.owner !== ctx.playerId;
    const returnedOwnMinion = !!ctx.triggerMinionUid;
    if (!destroyAnotherPlayersCard && !returnedOwnMinion) {
        return [];
    }

    const peek = buildInvisibleNinjaPeekResult(
        ctx.state,
        ctx.playerId,
        ctx.random,
        ctx.now,
        'ninjas_invisible_ninja_ongoing',
    );
    if (peek.cards.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_ninjas_invisible_ninja_ongoing_${ctx.now}`,
        ctx.playerId,
        'Invisible Ninja锛氶€夋嫨瑕佹娊鐨勭墝',
        peek.cards.map(card => ({
            id: `deck-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
        })),
        { sourceId: 'titan_ninjas_invisible_ninja_ongoing', targetType: 'generic' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        cardUids: peek.cards.map(card => card.uid),
    };

    return { events: peek.events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function killerKudzuOnTurnStart(ctx: TriggerContext): SmashUpEvent[] {
    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'killer_plants_killer_kudzu'
        && candidate.ownerId === ctx.playerId
        && candidate.location.zone === 'setaside',
    );
    if (!titan) return [];
    return [addTitanPowerCounter(titan.uid, 1, 'killer_plants_killer_kudzu_turn_start', ctx.now)];
}

function killerKudzuSpecial(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'setaside' || titan.powerCounters < 3 || getTitanByController(ctx.state, ctx.playerId)) {
        return { events: [] };
    }

    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    const overflow = Math.max(0, titan.powerCounters - 6);
    return {
        events: [
            playTitan(titan, ctx.playerId, ctx.baseIndex, 'killer_plants_killer_kudzu_special', ctx.now, base.defId, 'minion'),
            ...(overflow > 0 ? [removeTitanPowerCounter(titan.uid, overflow, 'killer_plants_killer_kudzu_special', ctx.now)] : []),
        ],
    };
}

function buildKillerKudzuDiscardMinionOptions(state: AbilityContext['state'], playerId: string) {
    const player = state.players[playerId];
    if (!player) return [];

    return player.discard
        .filter(card => card.type === 'minion')
        .map(card => ({
            id: `discard-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'discard' as const,
            displayMode: 'card' as const,
        }));
}

function queueKillerKudzuRecycleInteraction(
    matchState: AbilityContext['matchState'] | TriggerContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    now: number,
) {
    if (!matchState) return undefined;
    const options = buildKillerKudzuDiscardMinionOptions(state, playerId);
    const interaction = createSimpleChoice(
        `titan_killer_plants_killer_kudzu_recycle_${now}`,
        playerId,
        'Killer Kudzu锛氶€夋嫨鑷冲 2 寮犲純鐗屽爢涓殑闅忎粠娲楀洖鐗屽簱',
        options,
        {
            sourceId: 'titan_killer_plants_killer_kudzu_recycle',
            targetType: 'generic',
            multi: { min: 0, max: Math.min(2, options.length) },
            autoRefresh: 'discard',
            responseValidationMode: 'live',
        },
    );
    return queueInteraction(matchState, interaction);
}

function killerKudzuOnTitanRemovedFromPlay(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return [];

    const discardOptions = buildKillerKudzuDiscardMinionOptions(ctx.state, ctx.playerId);
    const canDraw = ((player.deck.length ?? 0) + (player.discard.length ?? 0)) > 0;
    if (discardOptions.length === 0) {
        return canDraw ? buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now) : [];
    }
    if (!ctx.matchState) return [];

    if (!canDraw) {
        const nextState = queueKillerKudzuRecycleInteraction(ctx.matchState, ctx.state, ctx.playerId, ctx.now);
        return nextState ? { events: [], matchState: nextState } : [];
    }

    const interaction = createSimpleChoice(
        `titan_killer_plants_killer_kudzu_removed_${ctx.now}`,
        ctx.playerId,
        'Killer Kudzu锛氶€夋嫨鏁堟灉',
        [
            { id: 'recycle', label: 'Shuffle up to 2 minions back', value: { recycle: true }, displayMode: 'button' as const },
            { id: 'draw', label: 'Draw 2 cards', value: { draw: true }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_killer_plants_killer_kudzu_removed', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function killerKudzuTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId || titan.powerCounters <= 0) {
        return { events: [] };
    }

    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };

    const candidates = player.discard
        .filter(card => {
            if (card.type !== 'minion') return false;
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            return (def?.power ?? 0) <= titan.powerCounters;
        })
        .map(card => ({
            id: `discard-${card.uid}`,
            label: `${getCardDef(card.defId)?.name ?? card.defId}`,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'discard' as const,
            displayMode: 'card' as const,
        }));
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_killer_plants_killer_kudzu_talent_${ctx.now}`,
        ctx.playerId,
        'Killer Kudzu锛氶€夋嫨瑕佷粠寮冪墝鍫嗘墦鍑虹殑闅忎粠',
        candidates,
        { sourceId: 'titan_killer_plants_killer_kudzu_talent', targetType: 'generic', autoRefresh: 'discard', responseValidationMode: 'live' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

type BrideEffectKind = 'box' | 'destroy' | 'removeCounter';

function getTheBrideBoxTargets(state: AbilityContext['state'], playerId: string, excludedUid?: string) {
    const player = state.players[playerId];
    if (!player) return [];

    return [
        ...player.hand
            .filter(card => card.type === 'minion' && card.uid !== excludedUid)
            .map(card => ({
                uid: card.uid,
                defId: card.defId,
                from: 'hand' as const,
                label: `${getCardDef(card.defId)?.name ?? card.defId}锛堟墜鐗岋級`,
            })),
        ...player.discard
            .filter(card => card.type === 'minion' && card.uid !== excludedUid)
            .map(card => ({
                uid: card.uid,
                defId: card.defId,
                from: 'discard' as const,
                label: `${getCardDef(card.defId)?.name ?? card.defId} (discard)`,
            })),
    ];
}

function getTheBrideDestroyTargets(state: AbilityContext['state'], playerId: string, excludedUid?: string) {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === playerId && minion.uid !== excludedUid)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? base.defId}`,
            })));
}

function getTheBrideRemoveCounterTargets(state: AbilityContext['state'], playerId: string, excludedUid?: string) {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === playerId && minion.uid !== excludedUid && (minion.powerCounters ?? 0) > 0)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? base.defId}`,
            })));
}

function hasTheBrideSecondEffectOption(
    state: AbilityContext['state'],
    playerId: string,
    firstKind: BrideEffectKind,
    targetUid: string,
) {
    const otherKinds: BrideEffectKind[] = ['box', 'destroy', 'removeCounter'].filter(
        (kind): kind is BrideEffectKind => kind !== firstKind,
    );
    return otherKinds.some(kind => {
        if (kind === 'box') return getTheBrideBoxTargets(state, playerId, targetUid).length > 0;
        if (kind === 'destroy') return getTheBrideDestroyTargets(state, playerId, targetUid).length > 0;
        return getTheBrideRemoveCounterTargets(state, playerId, targetUid).length > 0;
    });
}

function buildTheBrideStartBranchOptions(
    state: AbilityContext['state'],
    playerId: string,
    usedKinds: BrideEffectKind[],
    excludedUid?: string,
) {
    const options: Array<{ id: string; label: string; value: { kind: BrideEffectKind }; displayMode: 'button' }> = [];
    const requireSecondChoice = usedKinds.length === 0;
    if (!usedKinds.includes('box') && buildTheBrideStartTargetOptions(state, playerId, 'box', excludedUid, requireSecondChoice).length > 0) {
        options.push({ id: 'box', label: '鏀捐繘鐩掍腑', value: { kind: 'box' }, displayMode: 'button' });
    }
    if (!usedKinds.includes('destroy') && buildTheBrideStartTargetOptions(state, playerId, 'destroy', excludedUid, requireSecondChoice).length > 0) {
        options.push({ id: 'destroy', label: '娑堢伃宸辨柟闅忎粠', value: { kind: 'destroy' }, displayMode: 'button' });
    }
    if (!usedKinds.includes('removeCounter') && buildTheBrideStartTargetOptions(state, playerId, 'removeCounter', excludedUid, requireSecondChoice).length > 0) {
        options.push({ id: 'removeCounter', label: '绉婚櫎 +1 鏍囪', value: { kind: 'removeCounter' }, displayMode: 'button' });
    }
    return options;
}

function buildTheBrideStartTargetOptions(
    state: AbilityContext['state'],
    playerId: string,
    kind: BrideEffectKind,
    excludedUid?: string,
    requireSecondChoice = false,
) {
    const rawTargets = kind === 'box'
        ? getTheBrideBoxTargets(state, playerId, excludedUid)
        : kind === 'destroy'
            ? getTheBrideDestroyTargets(state, playerId, excludedUid)
            : getTheBrideRemoveCounterTargets(state, playerId, excludedUid);

    return rawTargets
        .filter(target => !requireSecondChoice || hasTheBrideSecondEffectOption(state, playerId, kind, target.uid))
        .map(target => ({
            id: `${kind}-${target.uid}`,
            label: target.label,
            value: {
                kind,
                targetUid: target.uid,
                defId: target.defId,
                from: (target as { from?: 'hand' | 'discard' }).from,
                baseIndex: (target as { baseIndex?: number }).baseIndex,
            },
            displayMode: 'card' as const,
        }));
}

function buildTheBrideEffectEvents(
    state: AbilityContext['state'],
    playerId: string,
    selection: { kind: BrideEffectKind; targetUid: string; defId: string; from?: 'hand' | 'discard'; baseIndex?: number },
    now: number,
) {
    if (selection.kind === 'box') {
        if (!selection.from) return [];
        const card = findCardInPlayerZone(state, playerId, selection.from, selection.targetUid, selection.defId);
        if (!card) return [];
        return [{
            type: SU_EVENTS.CARD_BOXED,
            payload: {
                playerId,
                cardUid: card.uid,
                defId: card.defId,
                from: selection.from,
                reason: 'frankenstein_the_bride_special',
            },
            timestamp: now,
        } as SmashUpEvent];
    }

    if (selection.baseIndex === undefined) return [];
    const base = state.bases[selection.baseIndex];
    const minion = base?.minions.find(candidate => candidate.uid === selection.targetUid && candidate.controller === playerId);
    if (!minion) return [];

    if (selection.kind === 'destroy') {
        return [destroyMinion(minion.uid, minion.defId, selection.baseIndex, minion.owner, playerId, 'frankenstein_the_bride_special', now)];
    }
    return [removePowerCounter(minion.uid, selection.baseIndex, 1, 'frankenstein_the_bride_special', now)];
}

function theBrideOnTurnStart(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || getTitanByController(ctx.state, ctx.playerId)) return [];
    const titan = getOwnedSetAsideTitan(ctx.state, ctx.playerId, 'frankenstein_the_bride');
    if (!titan) return [];

    const branchOptions = buildTheBrideStartBranchOptions(ctx.state, ctx.playerId, []);
    if (branchOptions.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_frankenstein_the_bride_start_choose_branch_${ctx.now}`,
        ctx.playerId,
        'The Bride: choose the first effect',
        branchOptions,
        { sourceId: 'titan_frankenstein_the_bride_start_choose_branch', targetType: 'generic' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        usedKinds: [] as BrideEffectKind[],
        selectedTargetUids: [] as string[],
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function theBrideOnPowerCounterChanged(ctx: TriggerContext): SmashUpEvent[] {
    const titan = getControlledTitanOnBase(ctx.state, 'frankenstein_the_bride', ctx.playerId);
    if (!titan) return [];
    if (Number(titan.metadata?.theBrideTriggeredTurn ?? -1) === ctx.state.turnNumber) {
        return [];
    }
    return [
        buildTitanMetadataUpdateEvent(titan.uid, { theBrideTriggeredTurn: ctx.state.turnNumber }, 'frankenstein_the_bride_ongoing', ctx.now),
        ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
    ];
}

function buildTheBrideExtraActionOptions(state: AbilityContext['state'], playerId: string) {
    const minions = state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === playerId && (minion.powerCounters ?? 0) > 0)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                counters: minion.powerCounters ?? 0,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? base.defId}`,
            })));

    const options: Array<{ id: string; label: string; value: { removals: Array<{ minionUid: string; baseIndex: number; amount: number }> }; displayMode: 'button' }> = [];
    for (const minion of minions.filter(candidate => candidate.counters >= 2)) {
        options.push({
            id: `single-${minion.uid}`,
            label: `Remove 2 counters from ${minion.label}`,
            value: { removals: [{ minionUid: minion.uid, baseIndex: minion.baseIndex, amount: 2 }] },
            displayMode: 'button',
        });
    }
    for (let i = 0; i < minions.length; i++) {
        for (let j = i + 1; j < minions.length; j++) {
            options.push({
                id: `pair-${minions[i].uid}-${minions[j].uid}`,
                label: `Remove 1 counter from ${minions[i].label} and ${minions[j].label}`,
                value: {
                    removals: [
                        { minionUid: minions[i].uid, baseIndex: minions[i].baseIndex, amount: 1 },
                        { minionUid: minions[j].uid, baseIndex: minions[j].baseIndex, amount: 1 },
                    ],
                },
                displayMode: 'button',
            });
        }
    }
    return options;
}

function theBrideTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const addCounterTargets = getTheBrideDestroyTargets(ctx.state, ctx.playerId)
        .filter(target => target.baseIndex === titan.location.baseIndex);
    const extraActionOptions = buildTheBrideExtraActionOptions(ctx.state, ctx.playerId);
    if (addCounterTargets.length === 0 && extraActionOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (addCounterTargets.length > 0 && extraActionOptions.length === 0) {
        const interaction = createSimpleChoice(
            `titan_frankenstein_the_bride_talent_add_counter_${ctx.now}`,
            ctx.playerId,
            'The Bride: choose one of your minions here to place a +1 power counter on',
            buildMinionTargetOptions(addCounterTargets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'affect' }),
            { sourceId: 'titan_frankenstein_the_bride_talent_add_counter', targetType: 'minion' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }

    if (addCounterTargets.length === 0 && extraActionOptions.length > 0) {
        const interaction = createSimpleChoice(
            `titan_frankenstein_the_bride_talent_extra_action_${ctx.now}`,
            ctx.playerId,
            'The Bride: choose a set of counters to remove',
            extraActionOptions,
            { sourceId: 'titan_frankenstein_the_bride_talent_extra_action', targetType: 'generic' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }

    const interaction = createSimpleChoice(
        `titan_frankenstein_the_bride_talent_branch_${ctx.now}`,
        ctx.playerId,
        'The Bride: choose a talent effect',
        [
            { id: 'add-counter', label: 'Place a +1 counter', value: { branch: 'addCounter' }, displayMode: 'button' as const },
            { id: 'extra-action', label: 'Remove 2 counters for an extra action', value: { branch: 'extraAction' }, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_frankenstein_the_bride_talent_branch', targetType: 'generic' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanBaseIndex: titan.location.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

export function registerTitanAbilities(): void {
    registerAbility('dinosaurs_fort_titanosaurus', 'special', fortTitanosaurusSpecial);
    registerAbility('dinosaurs_fort_titanosaurus', 'talent', fortTitanosaurusTalent);
    registerTitanSpecialValidator('dinosaurs_fort_titanosaurus', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return 'This titan is not set aside';
        if ((state.players[playerId]?.minionsPlayed ?? 0) > 0) return 'You have already played a minion this turn';
        return getFortTitanosaurusSpecialTargets(state, playerId, baseIndex).length > 0
            ? null
            : 'You must play it on a base where you have a minion and destroy one of your minions there';
    });
    registerTitanTalentValidator('dinosaurs_fort_titanosaurus', ({ titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return titan.powerCounters >= 4 ? null : 'This titan needs at least 4 +1 power counters';
    });
    registerTrigger('dinosaurs_fort_titanosaurus', 'onActionPlayed', fortTitanosaurusOnActionPlayed, { optional: true, baseScoped: false });

    registerAbility('ninjas_invisible_ninja', 'special', invisibleNinjaSpecial);
    registerTitanSpecialValidator('ninjas_invisible_ninja', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return 'This titan is not set aside';
        const startTurnSeen = Number(titan.metadata?.invisibleNinjaStartTurn ?? -1);
        const wasInPlayAtStart = Boolean(titan.metadata?.invisibleNinjaWasInPlayAtStart);
        if (startTurnSeen !== state.turnNumber || wasInPlayAtStart) {
            return 'This titan must not have been in play at the start of your turn';
        }
        if ((state.players[playerId]?.hand.length ?? 0) === 0) {
            return '浣犻渶瑕佸純 1 寮犵墝鏉ユ墦鍑烘娉板潶';
        }
        return getBaseIndicesWithOwnMinions(state, playerId).includes(baseIndex)
            ? null
            : '浣犲彧鑳藉皢鍏舵墦鍒版湁浣犻殢浠庣殑鍩哄湴';
    });
    registerTrigger('ninjas_invisible_ninja', 'onTurnStart', invisibleNinjaOnTurnStart, { global: true });
    registerTrigger('ninjas_invisible_ninja', 'onMinionDestroyed', invisibleNinjaTriggered, { optional: true, baseScoped: false });
    registerTrigger('ninjas_invisible_ninja', 'onCardReturnedToHand', invisibleNinjaTriggered, { optional: true, baseScoped: false });

    registerAbility('killer_plants_killer_kudzu', 'special', killerKudzuSpecial);
    registerAbility('killer_plants_killer_kudzu', 'talent', killerKudzuTalent);
    registerTitanSpecialValidator('killer_plants_killer_kudzu', ({ titan }) =>
        titan.location.zone === 'setaside' && titan.powerCounters >= 3 ? null : 'This titan must be set aside with at least 3 counters');
    registerTitanTalentValidator('killer_plants_killer_kudzu', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        const player = state.players[playerId];
        const hasCandidate = player?.discard.some(card => {
            if (card.type !== 'minion') return false;
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            return (def?.power ?? 0) <= titan.powerCounters;
        }) ?? false;
        return hasCandidate ? null : '浣犵殑寮冪墝鍫嗕腑娌℃湁绗﹀悎鎴樻枟鍔涙潯浠剁殑闅忎粠';
    });
    registerTrigger('killer_plants_killer_kudzu', 'onTurnStart', killerKudzuOnTurnStart, { global: true });
    registerTrigger('killer_plants_killer_kudzu', 'onTitanRemovedFromPlay', killerKudzuOnTitanRemovedFromPlay, { optional: true, global: true });

    registerAbility('frankenstein_the_bride', 'talent', theBrideTalent);
    registerTitanTalentValidator('frankenstein_the_bride', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        const addCounterTargets = getTheBrideDestroyTargets(state, playerId).filter(target => target.baseIndex === titan.location.baseIndex);
        const extraActionOptions = buildTheBrideExtraActionOptions(state, playerId);
        return (addCounterTargets.length > 0 || extraActionOptions.length > 0)
            ? null
            : 'No valid talent targets';
    });
    registerTrigger('frankenstein_the_bride', 'onTurnStart', theBrideOnTurnStart, { global: true });
    registerTrigger('frankenstein_the_bride', 'onPowerCounterChanged', theBrideOnPowerCounterChanged, { baseScoped: false });

    registerAbility('super_spies_moon_zero_three', 'special', superSpiesMoonZeroThreeSpecial);
    registerAbility('super_spies_moon_zero_three', 'talent', superSpiesMoonZeroThreeTalent);
    registerTitanSpecialValidator('super_spies_moon_zero_three', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄧ墝搴撴梺';
        return getMoonZeroThreeEligibleBases(state, playerId).some(candidate => candidate.baseIndex === baseIndex)
            ? null
            : 'You can only play Moon Zero Three on a base with none of other players minions';
    });
    registerTitanTalentValidator('super_spies_moon_zero_three', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return getMoonZeroThreeInspectablePlayers(state).length > 0
            ? null
            : '娌℃湁鍙煡鐪嬬殑鐗屽簱';
    });
    registerTrigger('super_spies_moon_zero_three', 'onDeckInspected', superSpiesMoonZeroThreeOnDeckInspected);

    registerTitanSpecialValidator('penguins_emperor_penguin', () =>
        '浼侀箙甯濈殗鍙兘鍦ㄤ綘鐨勫洖鍚堝紑濮嬫椂閫氳繃鐗规畩鑳藉姏杩涘満');
    registerAbility('penguins_emperor_penguin', 'ongoingActivation', penguinsEmperorPenguinOngoingActivation);
    registerAbility('penguins_emperor_penguin', 'talent', penguinsEmperorPenguinTalent);
    registerTitanOngoingActivationValidator('penguins_emperor_penguin', ({ titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return null;
    });
    registerTitanTalentValidator('penguins_emperor_penguin', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return getEmperorPenguinTalentCandidates(state, playerId).length > 0
            ? null
            : '浣犵殑鎵嬬墝涓庡純鐗屽爢涓病鏈夋垬鍔?3 鎴栨洿浣庣殑闅忎粠';
    });
    registerTrigger('penguins_emperor_penguin', 'onTurnStart', penguinsEmperorPenguinOnTurnStart, { global: true });

    registerTitanSpecialValidator('changerbots_mergacon', () =>
        '鍚堜綋鏈哄櫒浜哄彧鑳藉湪浣犵殑鍥炲悎寮€濮嬫椂閫氳繃鐗规畩鑳藉姏杩涘満');
    registerAbility('changerbots_mergacon', 'talent', changerbotsMergaconTalent);
    registerTitanTalentValidator('changerbots_mergacon', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : 'There is no other base to move to';
    });
    registerTrigger('changerbots_mergacon', 'onTurnStart', changerbotsMergaconOnTurnStart, { global: true });
    registerTitanPowerModifier('changerbots_mergacon', ({ state, titan }) =>
        (state.titanOngoingSuppressedUntilTurnEnd ?? []).includes(titan.uid) ? 0 : 3);

    registerTitanSpecialValidator('itty_critters_rainboroc', () =>
        '褰╄櫣楦熷彧鑳藉湪鍩哄湴璁″垎鍚庨€氳繃鐗规畩鑳藉姏杩涘満');
    registerAbility('itty_critters_rainboroc', 'talent', ittyCrittersRainborocTalent);
    registerTitanTalentValidator('itty_critters_rainboroc', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return getRainborocLowPowerDiscardCards(state, playerId).length > 0
            ? null
            : '浣犵殑寮冪墝鍫嗕腑娌℃湁鎴樺姏 2 鎴栨洿浣庣殑闅忎粠';
    });
    registerTrigger('itty_critters_rainboroc', 'afterScoring', (ctx) => ittyCrittersRainborocAfterScoring({
        state: ctx.state,
        matchState: ctx.matchState,
        baseIndex: ctx.baseIndex,
        rankings: ctx.rankings,
        now: ctx.now,
    }), { global: true });
    registerTrigger('itty_critters_rainboroc', 'onMinionPlayed', ittyCrittersRainborocOnMinionPlayed);

    registerAbility('kaiju_gorgodzolla', 'special', kaijuGorgodzollaSpecial);
    registerTitanSpecialValidator('kaiju_gorgodzolla', ({ state, playerId, baseIndex }) =>
        getOwnActionCountOnBase(state, baseIndex, playerId) >= 2
            ? null
            : 'You can only play Gorgodzolla on a base where you have at least two actions');
    registerTrigger('kaiju_gorgodzolla', 'onMinionPlayed', kaijuGorgodzollaOnMinionPlayed);
    registerTrigger('kaiju_gorgodzolla', 'onActionPlayed', kaijuGorgodzollaOnActionPlayed);

    registerAbility('explorers_very_large_boulder', 'special', explorersVeryLargeBoulderSpecial);
    registerTitanSpecialValidator('explorers_very_large_boulder', ({ state, baseIndex, titan }) => {
        const base = state.bases[baseIndex];
        if (titan.location.zone !== 'setaside') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄧ墝搴撴梺';
        if (titan.location.zone !== 'setaside') return 'This titan is not set aside';
        if (!base) return 'Invalid base index';
        return base.minions.length === 0
            ? null
            : '浣犲彧鑳藉皢纭曞ぇ鍦嗙煶鎵撳嚭鍒版病鏈夌帺瀹堕殢浠庣殑鍩哄湴';
    });
    registerTrigger('explorers_very_large_boulder', 'onMinionMoved', explorersVeryLargeBoulderOnMinionMoved, {
        playerContext: 'sourceController',
    });
    registerTrigger('explorers_very_large_boulder', 'onTurnEnd', explorersVeryLargeBoulderOnTurnEnd);

    registerAbility('ignobles_the_hill_that_strolls', 'special', ignoblesTheHillThatStrollsSpecial);
    registerAbility('ignobles_the_hill_that_strolls', 'talent', ignoblesTheHillThatStrollsTalent);
    registerTitanSpecialValidator('ignobles_the_hill_that_strolls', ({ state, playerId }) =>
        getHillOwnedMinionsControlledByOthers(state, playerId).length >= 2
            ? null
            : '鍙湁鑷冲皯 2 涓綘鎷ユ湁鐨勯殢浠庢琚叾浠栫帺瀹舵帶鍒舵椂锛屼綘鎵嶈兘鎵撳嚭婕父灞卞箔宸ㄤ汉');
    registerTitanTalentValidator('ignobles_the_hill_that_strolls', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        const canGive = getHillGiveControlTargets(state, playerId).length > 0;
        const canReclaim = getHillOwnedMinionsControlledByOthers(state, playerId, titan.location.baseIndex).length > 0;
        return (canGive || canReclaim)
            ? null
            : 'There is no minion to give away or reclaim';
    });
    registerTrigger('ignobles_the_hill_that_strolls', 'onMinionAffected', ignoblesTheHillThatStrollsOnMinionAffected, {
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });

    registerAbility('time_travelers_time_box', 'special', timeTravelersTimeBoxSpecial);
    registerAbility('time_travelers_time_box', 'talent', timeTravelersTimeBoxTalent);
    registerTitanSpecialValidator('time_travelers_time_box', ({ titan }) =>
        getTimeBoxCounter(titan) >= 5 ? null : '鏃堕棿鐩掑瓙鐨勮鏁拌繕鏈揪鍒?5');
    registerTitanTalentValidator('time_travelers_time_box', ({ titan }) =>
        titan.location.zone === 'base' ? null : '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満');
    registerTrigger('time_travelers_time_box', 'onTurnStart', timeTravelersTimeBoxOnTurnStart, { global: true, optional: true });
    registerTrigger('time_travelers_time_box', 'onCardReturnedToHand', timeTravelersTimeBoxOnCardReturnedToHand, { global: true, optional: true });

    registerTrigger('pecos_bill', 'onDuelStarted', pecosBillOnDuelStarted, { global: true });
    registerTrigger('pecos_bill', 'onDuelResolved', pecosBillOnDuelResolved);
    registerProtection('pecos_bill', 'move', pecosBillMoveProtectionChecker);

    registerAbility('sphinx', 'talent', sphinxTalent);
    registerTitanTalentValidator('sphinx', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return (state.players[playerId]?.hand.length ?? 0) > 0
            ? null
            : 'You have no card in hand to bury';
    });
    registerTrigger('sphinx', 'onTurnStart', sphinxOnTurnStart, { global: true });
    registerTrigger('sphinx', 'afterScoring', (ctx) => sphinxAfterScoring({
        state: ctx.state,
        matchState: ctx.matchState,
        baseIndex: ctx.baseIndex,
        now: ctx.now,
    }), { global: true });

    registerAbility('magical_girls_walking_castle', 'special', magicalGirlsWalkingCastleSpecial);
    registerTitanSpecialValidator('magical_girls_walking_castle', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄧ墝搴撴梺';
        return getOwnMinionCountOnBase(state, baseIndex, playerId) >= 2
            ? null
            : '浣犲彧鑳藉皢绉诲姩鍩庡牎鎵撳嚭鍒版湁浣犺嚦灏?2 涓殢浠庣殑鍩哄湴';
    });
    registerAbility('magical_girls_walking_castle', 'talent', magicalGirlsWalkingCastleTalent);
    registerTitanTalentValidator('magical_girls_walking_castle', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : 'There is no other base to move to';
    });
    registerProtection('magical_girls_walking_castle', 'destroy', magicalGirlsWalkingCastleProtectionChecker);

    registerAbility('mega_troopers_megabot', 'special', megaTroopersMegabotSpecial);
    registerTitanSpecialValidator('mega_troopers_megabot', ({ state, playerId, baseIndex }) =>
        getOwnMinionCountOnBase(state, baseIndex, playerId) >= 3
            ? null
            : '浣犲彧鑳藉皢瓒呯骇浣愬痉鎵撳嚭鍒版湁浣犺嚦灏?3 涓殢浠庣殑鍩哄湴');
    registerTrigger('mega_troopers_megabot', 'beforeScoring', megaTroopersMegabotBeforeScoring);
    registerTitanPowerModifier('mega_troopers_megabot', ({ state, baseIndex, playerId }) =>
        getOwnMinionCountOnBase(state, baseIndex, playerId));

    registerAbility('ghosts_creampuff_man', 'special', ghostsCreampuffManSpecial);
    registerAbility('ghosts_creampuff_man', 'talent', ghostsCreampuffManTalent);
    registerTitanSpecialValidator('ghosts_creampuff_man', ({ state, playerId }) =>
        (state.players[playerId]?.hand.length ?? 0) === 0 ? null : 'You can only play Creampuff Man while you have no cards in hand');
    registerTitanTalentValidator('ghosts_creampuff_man', ({ state, playerId }) => {
        const player = state.players[playerId];
        if (!player || player.hand.length === 0) return 'You have no card to discard';
        const hasPlayableAction = getCreampuffPlayableActions({
            state,
            playerId,
            effectiveHandSize: player.hand.length,
        }).length > 0;
        return hasPlayableAction ? null : '寮冪墝鍚庝篃娌℃湁鍙澶栨墦鍑虹殑鏍囧噯鎴樻湳';
    });
    registerTitanPowerModifier('ghosts_creampuff_man', ({ state, playerId }) => {
        const handSize = state.players[playerId]?.hand.length ?? 0;
        return Math.max(0, 5 - handSize);
    });

    registerAbility('innsmouth_dagon', 'special', innsmouthDagonSpecial);
    registerAbility('innsmouth_dagon', 'talent', innsmouthDagonTalent);
    registerTitanSpecialValidator('innsmouth_dagon', ({ state, playerId, baseIndex }) =>
        getDagonMatchingMinionCount(state, baseIndex, playerId) >= 2
            ? null
            : '浣犲彧鑳藉皢澶ц‘鎵撳嚭鍒版湁浣犺嚦灏戜袱涓悓鍚嶉殢浠庣殑鍩哄湴');
    registerTitanTalentValidator('innsmouth_dagon', ({ state, playerId }) => {
        const player = state.players[playerId];
        const hasMinionInHand = player?.hand.some(card => card.type === 'minion') ?? false;
        return hasMinionInHand ? null : 'You have no minion in hand to play';
    });
    registerTitanPowerModifier('innsmouth_dagon', ({ state, baseIndex, playerId }) =>
        getDagonMatchingMinionCount(state, baseIndex, playerId));

    registerAbility('wizards_arcane_protector', 'special', wizardArcaneProtectorSpecial);
    registerAbility('wizards_arcane_protector', 'talent', wizardArcaneProtectorTalent);
    registerTitanSpecialValidator('wizards_arcane_protector', ({ state }) =>
        (state.cardsPlayedThisTurn ?? 0) >= 5 ? null : '浣犳湰鍥炲悎杩樻病鏈夋墦鍑?5 寮犵墝');

    registerTitanPowerModifier('wizards_arcane_protector', ({ state, playerId }) => {
        const handSize = state.players[playerId]?.hand.length ?? 0;
        return Math.floor(handSize / 2);
    });

    registerAbility('cthulhu_cthulhu_titan', 'special', cthulhuTitanSpecial);
    registerAbility('cthulhu_cthulhu_titan', 'talent', cthulhuTitanTalent);
    registerTitanSpecialValidator('cthulhu_cthulhu_titan', ({ state, playerId, baseIndex }) => {
        const base = state.bases[baseIndex];
        if (!base) return 'Invalid base index';
        const hasControlledMinion = base.minions.some(minion => minion.controller === playerId);
        return hasControlledMinion ? null : 'You can only play Cthulhu on a base where you have a minion';
    });
    registerTitanTalentValidator('cthulhu_cthulhu_titan', ({ state, playerId }) => {
        const canDrawMadness = (state.madnessDeck?.length ?? 0) > 0;
        const canTransferMadness = buildCthulhuTitanTransferOptions(state, playerId).length > 0;
        return (canDrawMadness || canTransferMadness)
            ? null
            : '浣犳棦涓嶈兘鎶界柉鐙傚崱锛屼篃娌℃湁鍙浆浜ょ粰鍏朵粬鐜╁鐨勭柉鐙傚崱';
    });
    registerInterceptor('cthulhu_cthulhu_titan', (state, event) => buildCthulhuTitanCounterEvents(state, event));

    registerAbility('giant_ants_death_on_six_legs', 'special', giantAntsDeathOnSixLegsSpecial);
    registerAbility('giant_ants_death_on_six_legs', 'talent', giantAntsDeathOnSixLegsTalent);
    registerTitanSpecialValidator('giant_ants_death_on_six_legs', ({ state, playerId }) =>
        getOwnTotalMinionCounters(state, playerId) >= 6
            ? null
            : 'Your minions need a total of at least 6 +1 power counters',
    );
    registerTrigger('giant_ants_death_on_six_legs', 'onMinionDestroyed', giantAntsDeathOnSixLegsBeforeDiscard, {
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerTrigger('giant_ants_death_on_six_legs', 'onMinionDiscardedFromBase', giantAntsDeathOnSixLegsBeforeDiscard, {
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerAbility('bear_cavalry_major_ursa', 'special', bearCavalryMajorUrsaSpecial);
    registerAbility('bear_cavalry_major_ursa', 'talent', bearCavalryMajorUrsaTalent);
    registerTitanSpecialValidator('bear_cavalry_major_ursa', ({ state, playerId, baseIndex }) => {
        const base = state.bases[baseIndex];
        if (!base) return 'Invalid base index';
        return base.minions.some(minion => minion.controller === playerId)
            ? null
            : 'You can only play Major Ursa on a base where you have a minion';
    });
    registerTitanTalentValidator('bear_cavalry_major_ursa', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '鐠囥儲鍢查崸锕€缍嬮崜宥勭瑝閸︺劌婧€';
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : '濞屸剝婀侀崣顖欎簰缁夎濮╅崚鎵畱閸忔湹绮崺鍝勬勾';
    });
    registerTrigger('bear_cavalry_major_ursa', 'onTitanMoved', bearCavalryMajorUrsaOnTitanMoved, { optional: true });
    registerTitanSpecialValidator('bear_cavalry_major_ursa', ({ state, titan, baseIndex }) => {
        if (titan.location.zone !== 'setaside') return 'This titan is not set aside';
        return state.bases[baseIndex]
            ? null
            : 'Invalid base index';
    });
    registerTitanTalentValidator('bear_cavalry_major_ursa', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        const base = state.bases[titan.location.baseIndex];
        const hasMinionHere = !!base && base.minions.length > 0;
        const canMoveTitan = getOtherBaseOptions(state, titan.location.baseIndex).length > 0;
        return (hasMinionHere || canMoveTitan)
            ? null
            : 'No valid talent targets';
    });
    registerTrigger('bear_cavalry_major_ursa', 'onMinionMoved', bearCavalryMajorUrsaOnMinionMoved, {
        optional: true,
        playerContext: 'sourceController',
    });

    registerAbility('vampires_ancient_lord', 'special', vampireAncientLordSpecial);
    registerAbility('vampires_ancient_lord', 'talent', vampireAncientLordTalent);
    registerTitanSpecialValidator('vampires_ancient_lord', ({ state }) =>
        (state.powerCountersPlacedOnMinionsThisTurn ?? 0) >= 2 ? null : '浣犳湰鍥炲悎杩樻病鏈変负闅忎粠鏀剧疆 2 鏋?+1 鍔涢噺鏍囪');
    registerTitanTalentValidator('vampires_ancient_lord', ({ state, playerId, baseIndex }) => {
        const base = state.bases[baseIndex];
        if (!base) return 'Invalid base index';
        const hasTarget = base.minions.some(minion =>
            minion.controller === playerId && (minion.powerCounters ?? 0) > 0,
        );
        return hasTarget ? null : 'There is no minion here with a +1 power counter';
    });
    registerInterceptor('vampires_ancient_lord', (state, event) => buildAncientLordBonusCounterEvents(state, event));
    registerTitanSpecialValidator('vampires_ancient_lord', () =>
        '姝ゆ嘲鍧﹂€氳繃鍏剁壒娈婅Е鍙戣繘鍦猴紝涓嶈兘鎵嬪姩鍙戝姩');
    registerTitanTalentValidator('vampires_ancient_lord', ({ state, playerId }) => {
        const hasTarget = state.bases.some(base =>
            base.minions.some(minion => minion.controller === playerId && (minion.powerCounters ?? 0) > 0),
        );
        return hasTarget ? null : '浣犳病鏈夊凡鏈?+1 鎴樻枟鍔涙爣璁扮殑宸辨柟闅忎粠';
    });
    registerTrigger('vampires_ancient_lord', 'onPowerCounterChanged', vampireAncientLordOnPowerCounterChanged, {
        global: true,
        optional: true,
        baseScoped: false,
    });

    registerAbility('werewolves_great_wolf_spirit', 'special', werewolvesGreatWolfSpiritSpecial);
    registerTitanSpecialValidator('werewolves_great_wolf_spirit', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄧ墝搴撴梺';
        const eligibleBases = getGreatWolfSpiritEligibleBases(state, playerId);
        if (eligibleBases.length < 2) return 'You must be tied for highest power on at least 2 bases';
        return eligibleBases.some(option => option.baseIndex === baseIndex)
            ? null
            : 'This base does not satisfy Great Wolf Spirit special';
    });
    registerAbility('werewolves_great_wolf_spirit', 'talent', werewolvesGreatWolfSpiritTalent);
    registerTitanTalentValidator('werewolves_great_wolf_spirit', ({ state, titan, playerId }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return getGreatWolfSpiritTalentTargets(state, playerId).length > 0
            ? null
            : '娌℃湁鍙幏寰楀姏閲忕殑宸辨柟闅忎粠';
    });

    registerAbility('tricksters_big_funny_giant', 'special', trickstersBigFunnyGiantSpecial);
    registerTitanSpecialValidator('tricksters_big_funny_giant', ({ state, titan, baseIndex }) => {
        if (titan.location.zone !== 'setaside') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄧ墝搴撴梺';
        return state.bases[baseIndex] ? null : 'Invalid base index';
    });
    registerTrigger('tricksters_big_funny_giant', 'onTurnEnd', trickstersBigFunnyGiantOnTurnEnd);
    registerTrigger('tricksters_big_funny_giant', 'onMinionPlayed', trickstersBigFunnyGiantOnMinionPlayed);
    registerTrigger('tricksters_big_funny_giant', 'afterScoring', (ctx) => trickstersBigFunnyGiantAfterScoring({
        state: ctx.state,
        baseIndex: ctx.baseIndex,
        rankings: ctx.rankings,
        now: ctx.now,
    }), { global: true });

    registerAbility('pirates_the_kraken', 'talent', piratesTheKrakenTalent);
    registerTitanTalentValidator('pirates_the_kraken', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : 'There is no other base to move to';
    });
    registerTrigger('pirates_the_kraken', 'afterScoring', piratesTheKrakenAfterScoring, { global: true });
}

export function registerTitanInteractionHandlers(): void {
    registerInteractionHandler('titan_dinosaurs_fort_titanosaurus_special', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string; baseIndex?: number; baseDefId?: string };
        } | undefined)?.continuationContext;
        if (!selected?.minionUid || !continuation?.titanUid || !continuation.titanDefId || continuation.baseIndex === undefined) {
            return { state, events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        const base = state.core.bases[continuation.baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === selected.minionUid && candidate.controller === playerId);
        if (!titan || !base || !minion) {
            return { state, events: [] };
        }

        const destroyedPower = getMinionPower(state.core, minion, continuation.baseIndex);
        return {
            state,
            events: [
                destroyMinion(minion.uid, minion.defId, continuation.baseIndex, minion.owner, playerId, 'dinosaurs_fort_titanosaurus_special', timestamp),
                playTitan(titan, playerId, continuation.baseIndex, 'dinosaurs_fort_titanosaurus_special', timestamp, continuation.baseDefId),
                ...(destroyedPower > 0 ? [addTitanPowerCounter(titan.uid, destroyedPower, 'dinosaurs_fort_titanosaurus_special', timestamp)] : []),
            ],
        };
    });

    registerInteractionHandler('titan_dinosaurs_fort_titanosaurus_ongoing', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { mode?: 'minion' | 'titan' | 'both' } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; targetMinionUid?: string };
        } | undefined)?.continuationContext;
        if (!selected?.mode || !continuation?.titanUid) {
            return { state, events: [] };
        }

        const events: SmashUpEvent[] = [
            buildTitanMetadataUpdateEvent(
                continuation.titanUid,
                { fortTitanosaurusTriggeredTurn: state.core.turnNumber },
                'dinosaurs_fort_titanosaurus_ongoing',
                timestamp,
            ),
        ];

        if (selected.mode === 'minion' || selected.mode === 'both') {
            const found = continuation.targetMinionUid
                ? findMinionOnBases(state.core, continuation.targetMinionUid)
                : undefined;
            if (found) {
                events.push(addPowerCounter(found.minion.uid, found.baseIndex, 1, 'dinosaurs_fort_titanosaurus_ongoing', timestamp));
            }
        }
        if (selected.mode === 'titan' || selected.mode === 'both') {
            events.push(addTitanPowerCounter(continuation.titanUid, 1, 'dinosaurs_fort_titanosaurus_ongoing', timestamp));
        }

        return { state, events };
    });

    registerInteractionHandler('titan_ninjas_invisible_ninja_start_turn', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { destroyTitan?: boolean } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string };
        } | undefined)?.continuationContext;
        if (!selected?.destroyTitan || !continuation?.titanUid) {
            return { state, events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        if (!titan || titan.location.zone !== 'base' || titan.controllerId !== playerId) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                removeTitanFromPlay(titan, 'ninjas_invisible_ninja_start_turn', timestamp),
                grantExtraMinion(playerId, 'ninjas_invisible_ninja_start_turn', timestamp, undefined, { powerMax: 3 }),
            ],
        };
    });

    registerInteractionHandler('titan_ninjas_invisible_ninja_special', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; baseIndex?: number; baseDefId?: string };
        } | undefined)?.continuationContext;
        if (!selected?.cardUid || !continuation?.titanUid || continuation.baseIndex === undefined) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const titan = getTitanByUid(state.core, continuation.titanUid);
        const discardCard = player?.hand.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
        if (!player || !titan || !discardCard) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId, cardUids: [discardCard.uid] },
                    timestamp,
                } as SmashUpEvent,
                playTitan(titan, playerId, continuation.baseIndex, 'ninjas_invisible_ninja_special', timestamp, continuation.baseDefId),
            ],
        };
    });

    registerInteractionHandler('titan_giant_ants_death_on_six_legs_special', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; baseIndex?: number; baseDefId?: string };
        } | undefined)?.continuationContext;
        if (!selected?.cardUid || !continuation?.titanUid || continuation.baseIndex === undefined) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const titan = getTitanByUid(state.core, continuation.titanUid);
        const discardCard = player?.hand.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
        if (!player || !titan || !discardCard) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId, cardUids: [discardCard.uid] },
                    timestamp,
                } as SmashUpEvent,
                playTitan(titan, playerId, continuation.baseIndex, 'giant_ants_death_on_six_legs_special', timestamp, continuation.baseDefId),
            ],
        };
    });

    registerInteractionHandler('titan_giant_ants_death_on_six_legs_transfer', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as {
            transfer?: boolean;
            minionUid?: string;
            baseIndex?: number;
            titanUid?: string;
        } | undefined;
        if (!selected?.transfer || !selected.minionUid || selected.baseIndex === undefined || !selected.titanUid) {
            return { state, events: [] };
        }

        const minion = state.core.bases[selected.baseIndex]?.minions.find(candidate => candidate.uid === selected.minionUid);
        const titan = (state.core.titans ?? []).find(candidate => candidate.uid === selected.titanUid);
        if (!minion || !titan || (minion.powerCounters ?? 0) <= 0) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                removePowerCounter(selected.minionUid, selected.baseIndex, 1, 'giant_ants_death_on_six_legs_transfer', timestamp),
                addTitanPowerCounter(selected.titanUid, 1, 'giant_ants_death_on_six_legs_transfer', timestamp),
            ],
        };
    });

    registerInteractionHandler('titan_ninjas_invisible_ninja_ongoing', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { cardUid?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; cardUids?: string[] };
        } | undefined)?.continuationContext;
        if (!selected?.cardUid || !continuation?.titanUid || !continuation.cardUids?.length) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        if (!player) return { state, events: [] };

        const shownUidSet = new Set(continuation.cardUids);
        const shownCards = player.deck.filter(card => shownUidSet.has(card.uid));
        const chosenCard = shownCards.find(card => card.uid === selected.cardUid);
        if (!chosenCard) {
            return { state, events: [] };
        }

        const remainingShown = shownCards.filter(card => card.uid !== chosenCard.uid);
        const events: SmashUpEvent[] = [
            buildTitanMetadataUpdateEvent(
                continuation.titanUid,
                { invisibleNinjaTriggeredTurn: state.core.turnNumber },
                'ninjas_invisible_ninja_ongoing',
                timestamp,
            ),
            {
                type: SU_EVENTS.CARDS_DRAWN,
                payload: {
                    playerId,
                    count: 1,
                    cardUids: [chosenCard.uid],
                },
                timestamp,
            } as CardsDrawnEvent,
        ];

        if (remainingShown.length > 0) {
            const shuffled = random.shuffle([
                ...player.deck.filter(card => !shownUidSet.has(card.uid)),
                ...remainingShown,
            ]);
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId, deckUids: shuffled.map(card => card.uid) },
                timestamp,
            } as SmashUpEvent);
        }

        return { state, events };
    });

    registerInteractionHandler('titan_killer_plants_killer_kudzu_removed', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as { recycle?: boolean; draw?: boolean } | undefined;
        if (selected?.draw) {
            return {
                state,
                events: buildStandardDrawEvents(state.core, playerId, 2, random, timestamp),
            };
        }
        if (!selected?.recycle) {
            return { state, events: [] };
        }

        const nextState = queueKillerKudzuRecycleInteraction(state, state.core, playerId, timestamp);
        return { state: nextState ?? state, events: [] };
    });

    registerInteractionHandler('titan_killer_plants_killer_kudzu_recycle', (state, playerId, value, _data, random, timestamp) => {
        const selectedCards = (Array.isArray(value) ? value : value ? [value] : []) as Array<{ cardUid?: string }>;
        const player = state.core.players[playerId];
        if (!player) return { state, events: [] };

        const selectedUidSet = new Set(
            selectedCards
                .map(card => card.cardUid)
                .filter((cardUid): cardUid is string => Boolean(cardUid)),
        );
        if (selectedUidSet.size === 0) return { state, events: [] };

        const selectedFromDiscard = player.discard.filter(card => selectedUidSet.has(card.uid));
        const shuffled = random.shuffle([...player.deck, ...selectedFromDiscard]);
        return {
            state,
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId, deckUids: shuffled.map(card => card.uid) },
                timestamp,
            } as SmashUpEvent],
        };
    });

    registerInteractionHandler('titan_killer_plants_killer_kudzu_talent', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        if (!selected?.cardUid || !selected.defId || !continuation?.titanUid || !continuation.titanDefId) {
            return { state, events: [] };
        }

        const baseOptions = getAllBaseOptions(state.core);
        if (baseOptions.length === 0) return { state, events: [] };

        const interaction = createSimpleChoice(
            `titan_killer_plants_killer_kudzu_talent_base_${timestamp}`,
            playerId,
            'Killer Kudzu: choose a base to play that minion on',
            baseOptions,
            { sourceId: 'titan_killer_plants_killer_kudzu_talent_base', targetType: 'base' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: continuation.titanUid,
            titanDefId: continuation.titanDefId,
            cardUid: selected.cardUid,
            defId: selected.defId,
        };

        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('titan_killer_plants_killer_kudzu_talent_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; cardUid?: string; defId?: string };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.titanUid || !continuation.cardUid || !continuation.defId) {
            return { state, events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        const card = state.core.players[playerId]?.discard.find(candidate =>
            candidate.uid === continuation.cardUid && candidate.defId === continuation.defId,
        );
        const cardDef = getCardDef(continuation.defId) as MinionCardDef | undefined;
        if (!titan || !card || !cardDef) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                removeTitanFromPlay(titan, 'killer_plants_killer_kudzu_talent', timestamp),
                {
                    type: SU_EVENTS.MINION_PLAYED,
                    payload: {
                        playerId,
                        cardUid: card.uid,
                        defId: card.defId,
                        baseIndex: selected.baseIndex,
                        baseDefId: selected.baseDefId,
                        power: cardDef.power,
                        fromDiscard: true,
                        consumesNormalLimit: false,
                        discardPlaySourceId: 'titan_killer_plants_killer_kudzu_talent',
                    },
                    timestamp,
                } as SmashUpEvent,
            ],
        };
    });

    registerInteractionHandler('titan_frankenstein_the_bride_start_choose_branch', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { kind?: BrideEffectKind } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                usedKinds?: BrideEffectKind[];
                selectedTargetUids?: string[];
            };
        } | undefined)?.continuationContext;
        if (!selected?.kind || !continuation?.titanUid || !continuation.titanDefId) {
            return { state, events: [] };
        }

        const excludedUid = continuation.selectedTargetUids?.[0];
        const requireSecondChoice = (continuation.usedKinds?.length ?? 0) === 0;
        const options = buildTheBrideStartTargetOptions(state.core, playerId, selected.kind, excludedUid, requireSecondChoice);
        if (options.length === 0) {
            return { state, events: [] };
        }

        const interaction = createSimpleChoice(
            `titan_frankenstein_the_bride_start_choose_target_${timestamp}`,
            playerId,
            'The Bride锛氶€夋嫨鏁堟灉鐩爣',
            options,
            { sourceId: 'titan_frankenstein_the_bride_start_choose_target', targetType: 'generic' },
        );
        (interaction.data as { continuationContext?: unknown; optionsGenerator?: unknown }).continuationContext = {
            ...continuation,
            activeKind: selected.kind,
        };
        (interaction.data as { continuationContext?: unknown; optionsGenerator?: unknown }).optionsGenerator = (nextState: AbilityContext['matchState']) =>
            buildTheBrideStartTargetOptions(
                nextState.core,
                playerId,
                selected.kind,
                excludedUid,
                requireSecondChoice,
            );

        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('titan_frankenstein_the_bride_start_choose_target', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { kind?: BrideEffectKind; targetUid?: string; defId?: string; from?: 'hand' | 'discard'; baseIndex?: number } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                usedKinds?: BrideEffectKind[];
                selectedTargetUids?: string[];
            };
        } | undefined)?.continuationContext;
        if (!selected?.kind || !selected.targetUid || !selected.defId || !continuation?.titanUid || !continuation.titanDefId) {
            return { state, events: [] };
        }

        const events = buildTheBrideEffectEvents(state.core, playerId, {
            kind: selected.kind,
            targetUid: selected.targetUid,
            defId: selected.defId,
            from: selected.from,
            baseIndex: selected.baseIndex,
        }, timestamp);

        const usedKinds = [...(continuation.usedKinds ?? []), selected.kind];
        const selectedTargetUids = [...(continuation.selectedTargetUids ?? []), selected.targetUid];

        if (usedKinds.length < 2) {
            const interaction = createSimpleChoice(
                `titan_frankenstein_the_bride_start_choose_branch_${timestamp}`,
                playerId,
                'The Bride: choose the second effect',
                buildTheBrideStartBranchOptions(state.core, playerId, usedKinds, selected.targetUid),
                { sourceId: 'titan_frankenstein_the_bride_start_choose_branch', targetType: 'generic' },
            );
            (interaction.data as { continuationContext?: unknown; optionsGenerator?: unknown }).continuationContext = {
                titanUid: continuation.titanUid,
                titanDefId: continuation.titanDefId,
                usedKinds,
                selectedTargetUids,
            };
            (interaction.data as { continuationContext?: unknown; optionsGenerator?: unknown }).optionsGenerator = (nextState: AbilityContext['matchState']) =>
                buildTheBrideStartBranchOptions(nextState.core, playerId, usedKinds, selected.targetUid);
            return { state: queueInteraction(state, interaction), events };
        }

        const interaction = createSimpleChoice(
            `titan_frankenstein_the_bride_start_choose_base_${timestamp}`,
            playerId,
            'The Bride锛氶€夋嫨瑕佹墦鍑虹殑鍩哄湴',
            getAllBaseOptions(state.core),
            { sourceId: 'titan_frankenstein_the_bride_start_choose_base', targetType: 'base' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: continuation.titanUid,
            titanDefId: continuation.titanDefId,
        };
        return { state: queueInteraction(state, interaction), events };
    });

    registerInteractionHandler('titan_frankenstein_the_bride_start_choose_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.titanUid) {
            return { state, events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        if (!titan) return { state, events: [] };

        return {
            state,
            events: [playTitan(titan, playerId, selected.baseIndex, 'frankenstein_the_bride_special', timestamp, selected.baseDefId)],
        };
    });

    registerInteractionHandler('titan_frankenstein_the_bride_talent_branch', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { branch?: 'addCounter' | 'extraAction' } | undefined;
        const continuation = (data as {
            continuationContext?: { titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.branch || continuation?.titanBaseIndex === undefined) {
            return { state, events: [] };
        }

        if (selected.branch === 'addCounter') {
            const targets = getTheBrideDestroyTargets(state.core, playerId)
                .filter(target => target.baseIndex === continuation.titanBaseIndex);
            const interaction = createSimpleChoice(
                `titan_frankenstein_the_bride_talent_add_counter_${timestamp}`,
                playerId,
                'The Bride: choose one of your minions here to place a +1 power counter on',
                buildMinionTargetOptions(targets, { state: state.core, sourcePlayerId: playerId, effectType: 'affect' }),
                { sourceId: 'titan_frankenstein_the_bride_talent_add_counter', targetType: 'minion' },
            );
            return { state: queueInteraction(state, interaction), events: [] };
        }

        const interaction = createSimpleChoice(
            `titan_frankenstein_the_bride_talent_extra_action_${timestamp}`,
            playerId,
            'The Bride锛氶€夋嫨瑕佺Щ闄ょ殑鏍囪缁勫悎',
            buildTheBrideExtraActionOptions(state.core, playerId),
            { sourceId: 'titan_frankenstein_the_bride_talent_extra_action', targetType: 'generic' },
        );
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('titan_frankenstein_the_bride_talent_add_counter', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'frankenstein_the_bride_talent', timestamp)],
        };
    });

    registerInteractionHandler('titan_frankenstein_the_bride_talent_extra_action', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { removals?: Array<{ minionUid: string; baseIndex: number; amount: number }> } | undefined;
        if (!selected?.removals?.length) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                ...selected.removals.map(removal =>
                    removePowerCounter(removal.minionUid, removal.baseIndex, removal.amount, 'frankenstein_the_bride_talent', timestamp),
                ),
                grantExtraAction(playerId, 'frankenstein_the_bride_talent', timestamp),
            ],
        };
    });

    registerInteractionHandler('titan_kaiju_gorgodzolla_draw', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as { draw?: boolean } | undefined;
        if (!selected?.draw) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        if (!player) {
            return { state, events: [] };
        }

        const { drawnUids } = drawCards(player, 1, random);
        if (drawnUids.length === 0) {
            return { state, events: [] };
        }

        const drawEvent: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: {
                playerId,
                count: drawnUids.length,
                cardUids: drawnUids,
            },
            timestamp,
        };

        return { state, events: [drawEvent] };
    });

    registerInteractionHandler('titan_magical_girls_walking_castle_choose_minions', (state, playerId, value, data, _random, timestamp) => {
        const selections = (Array.isArray(value) ? value : [value]) as Array<{ minionUid?: string }>;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                fromBaseIndex?: number;
                targetBaseIndex?: number;
                targetBaseDefId?: string;
            };
        } | undefined)?.continuationContext;
        if (
            !continuation?.titanUid
            || !continuation.titanDefId
            || continuation.fromBaseIndex === undefined
            || continuation.targetBaseIndex === undefined
        ) {
            return { state, events: [] };
        }

        const selectedMinionUids = selections
            .map(selection => selection.minionUid)
            .filter((uid): uid is string => Boolean(uid))
            .slice(0, 3);

        const events: SmashUpEvent[] = [
            moveTitan(
                continuation.titanUid,
                continuation.titanDefId,
                continuation.fromBaseIndex,
                continuation.targetBaseIndex,
                'magical_girls_walking_castle_talent',
                timestamp,
                continuation.targetBaseDefId,
            ),
        ];

        const sourceBase = state.core.bases[continuation.fromBaseIndex];
        if (sourceBase) {
            for (const minionUid of selectedMinionUids) {
                const minion = sourceBase.minions.find(candidate =>
                    candidate.uid === minionUid && candidate.controller === playerId,
                );
                if (!minion) continue;
                events.push(moveMinion(
                    minion.uid,
                    minion.defId,
                    continuation.fromBaseIndex,
                    continuation.targetBaseIndex,
                    'magical_girls_walking_castle_talent',
                    timestamp,
                    continuation.targetBaseDefId,
                ));
            }
        }

        return { state, events };
    });

    registerInteractionHandler('titan_magical_girls_walking_castle_choose_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                fromBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        if (
            selected?.baseIndex === undefined
            || !continuation?.titanUid
            || !continuation.titanDefId
            || continuation.fromBaseIndex === undefined
        ) {
            return { state, events: [] };
        }

        const nextState = queueWalkingCastleChooseMinionsInteraction(
            state,
            state.core,
            playerId,
            timestamp,
            {
                titanUid: continuation.titanUid,
                titanDefId: continuation.titanDefId,
                fromBaseIndex: continuation.fromBaseIndex,
                targetBaseIndex: selected.baseIndex,
                targetBaseDefId: selected.baseDefId,
            },
        );
        if (nextState) {
            return { state: nextState, events: [] };
        }

        return {
            state,
            events: [moveTitan(
                continuation.titanUid,
                continuation.titanDefId,
                continuation.fromBaseIndex,
                selected.baseIndex,
                'magical_girls_walking_castle_talent',
                timestamp,
                selected.baseDefId,
            )],
        };
    });

    registerInteractionHandler('titan_ignobles_the_hill_that_strolls_choose_branch', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { branch?: 'give' | 'reclaim' } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.branch || continuation?.titanBaseIndex === undefined) {
            return { state, events: [] };
        }

        if (selected.branch === 'give') {
            const nextState = queueHillGiveMinionInteraction(state, state.core, playerId, timestamp);
            return nextState
                ? { state: nextState, events: [] }
                : { state, events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
        }

        const nextState = queueHillReclaimMinionInteraction(
            state,
            state.core,
            playerId,
            timestamp,
            continuation.titanBaseIndex,
        );
        return nextState
            ? { state: nextState, events: [] }
            : { state, events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
    });

    registerInteractionHandler('titan_ignobles_the_hill_that_strolls_give_minion', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { state, events: [] };
        }

        const base = state.core.bases[selected.baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === selected.minionUid);
        if (!minion || minion.owner !== playerId || minion.controller !== playerId) {
            return { state, events: [] };
        }

        const opponentOptions = buildOtherPlayerChoiceOptions(state.core, playerId);
        if (opponentOptions.length === 0) {
            return { state, events: [] };
        }

        if (opponentOptions.length === 1) {
            const draw = drawCards(state.core.players[playerId], 1, random);
            const events: SmashUpEvent[] = [
                changeMinionController(
                    minion.uid,
                    minion.defId,
                    selected.baseIndex,
                    minion.owner,
                    minion.controller,
                    opponentOptions[0].value.targetPlayerId,
                    playerId,
                    'ignobles_the_hill_that_strolls_talent',
                    timestamp,
                ),
            ];
            if (draw.drawnUids.length > 0) {
                events.push({
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId, count: draw.drawnUids.length, cardUids: draw.drawnUids },
                    timestamp,
                } as CardsDrawnEvent);
            }
            return { state, events };
        }

        const interaction = createSimpleChoice(
            `titan_ignobles_the_hill_that_strolls_choose_player_${timestamp}`,
            playerId,
            'The Hill That Strolls: choose a player to give control to',
            opponentOptions,
            { sourceId: 'titan_ignobles_the_hill_that_strolls_choose_player', targetType: 'button' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            baseIndex: selected.baseIndex,
        };
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('titan_ignobles_the_hill_that_strolls_choose_player', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { targetPlayerId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { minionUid?: string; minionDefId?: string; baseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.targetPlayerId || !continuation?.minionUid || !continuation.minionDefId || continuation.baseIndex === undefined) {
            return { state, events: [] };
        }

        const base = state.core.bases[continuation.baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === continuation.minionUid);
        if (!minion || minion.owner !== playerId || minion.controller !== playerId) {
            return { state, events: [] };
        }

        const draw = drawCards(state.core.players[playerId], 1, random);
        const events: SmashUpEvent[] = [
            changeMinionController(
                minion.uid,
                minion.defId,
                continuation.baseIndex,
                minion.owner,
                minion.controller,
                selected.targetPlayerId,
                playerId,
                'ignobles_the_hill_that_strolls_talent',
                timestamp,
            ),
        ];
        if (draw.drawnUids.length > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId, count: draw.drawnUids.length, cardUids: draw.drawnUids },
                timestamp,
            } as CardsDrawnEvent);
        }
        return { state, events };
    });

    registerInteractionHandler('titan_ignobles_the_hill_that_strolls_reclaim_minion', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { state, events: [] };
        }

        const base = state.core.bases[selected.baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === selected.minionUid);
        if (!minion || minion.owner !== playerId || minion.controller === playerId) {
            return { state, events: [] };
        }

        return {
            state,
            events: [changeMinionController(
                minion.uid,
                minion.defId,
                selected.baseIndex,
                minion.owner,
                minion.controller,
                playerId,
                playerId,
                'ignobles_the_hill_that_strolls_talent',
                timestamp,
            )],
        };
    });

    registerInteractionHandler('titan_ignobles_the_hill_that_strolls_counter', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { place?: boolean; skip?: boolean } | undefined;
        const continuation = (data as {
            continuationContext?: { minionUid?: string; minionDefId?: string; baseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.place || !continuation?.minionUid || !continuation.minionDefId || continuation.baseIndex === undefined) {
            return { state, events: [] };
        }

        const base = state.core.bases[continuation.baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === continuation.minionUid);
        if (!minion || minion.owner !== playerId || minion.controller === playerId) {
            return { state, events: [] };
        }

        return {
            state,
            events: [addPowerCounter(continuation.minionUid, continuation.baseIndex, 1, 'ignobles_the_hill_that_strolls', timestamp)],
        };
    });

    registerInteractionHandler('titan_explorers_very_large_boulder_move', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { move?: boolean } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                fromBaseIndex?: number;
                toBaseIndex?: number;
                toBaseDefId?: string;
                destroyThreshold?: number;
            };
        } | undefined)?.continuationContext;
        if (
            !selected?.move
            || !continuation?.titanUid
            || !continuation.titanDefId
            || continuation.fromBaseIndex === undefined
            || continuation.toBaseIndex === undefined
        ) {
            return { state, events: [] };
        }

        const events: SmashUpEvent[] = [
            moveTitan(
                continuation.titanUid,
                continuation.titanDefId,
                continuation.fromBaseIndex,
                continuation.toBaseIndex,
                'explorers_very_large_boulder_move',
                timestamp,
                continuation.toBaseDefId,
            ),
        ];

        const destroyTargets = getVeryLargeBoulderDestroyTargets(
            state.core,
            continuation.toBaseIndex,
            continuation.destroyThreshold ?? 0,
        );
        if (destroyTargets.length === 0) {
            return { state, events };
        }

        if (destroyTargets.length === 1) {
            const [target] = destroyTargets;
            const targetBase = state.core.bases[continuation.toBaseIndex];
            const targetMinion = targetBase?.minions.find(minion => minion.uid === target.uid);
            if (!targetMinion) return { state, events };
            events.push(destroyMinion(
                targetMinion.uid,
                targetMinion.defId,
                continuation.toBaseIndex,
                targetMinion.owner,
                playerId,
                'explorers_very_large_boulder_move',
                timestamp,
            ));
            return { state, events };
        }

        const interaction = createSimpleChoice(
            `titan_explorers_very_large_boulder_destroy_${timestamp}`,
            playerId,
            '纭曞ぇ鍦嗙煶锛氶€夋嫨瑕佹秷鐏殑闅忎粠',
            buildMinionTargetOptions(destroyTargets, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' }),
            { sourceId: 'titan_explorers_very_large_boulder_destroy', targetType: 'minion' },
        );
        (interaction.data as {
            continuationContext?: {
                targetBaseIndex: number;
            };
        }).continuationContext = {
            targetBaseIndex: continuation.toBaseIndex,
        };
        return { state: queueInteraction(state, interaction), events };
    });

    registerInteractionHandler('titan_explorers_very_large_boulder_destroy', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string } | undefined;
        const continuation = (data as {
            continuationContext?: {
                targetBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        if (!selected?.minionUid || continuation?.targetBaseIndex === undefined) {
            return { state, events: [] };
        }

        const base = state.core.bases[continuation.targetBaseIndex];
        const target = base?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) {
            return { state, events: [] };
        }

        return {
            state,
            events: [destroyMinion(
                target.uid,
                target.defId,
                continuation.targetBaseIndex,
                target.owner,
                playerId,
                'explorers_very_large_boulder_move',
                timestamp,
            )],
        };
    });

    registerInteractionHandler('titan_mega_troopers_megabot_move', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { move?: boolean } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                fromBaseIndex?: number;
                scoringBaseIndex?: number;
                scoringBaseDefId?: string;
                remaining?: Array<{
                    titanUid: string;
                    titanDefId: string;
                    controllerId: string;
                    fromBaseIndex: number;
                }>;
            };
        } | undefined)?.continuationContext;

        const events: SmashUpEvent[] = [];
        if (
            selected?.move
            && continuation?.titanUid
            && continuation.titanDefId
            && continuation.fromBaseIndex !== undefined
            && continuation.scoringBaseIndex !== undefined
        ) {
            events.push(moveTitan(
                continuation.titanUid,
                continuation.titanDefId,
                continuation.fromBaseIndex,
                continuation.scoringBaseIndex,
                'mega_troopers_megabot_before_scoring',
                timestamp,
                continuation.scoringBaseDefId,
            ));
        }

        const remaining = continuation?.remaining ?? [];
        if (remaining.length === 0 || continuation?.scoringBaseIndex === undefined || !continuation.scoringBaseDefId) {
            return { state, events };
        }

        const [next, ...rest] = remaining;
        const interaction = createSimpleChoice(
            `titan_mega_troopers_megabot_move_${next.titanUid}_${timestamp}`,
            next.controllerId,
            `Megabot: move to ${getBaseDef(continuation.scoringBaseDefId)?.name ?? `Base ${continuation.scoringBaseIndex + 1}`} before it scores?`,
            [
                { id: 'move', label: '绉诲姩鍒拌鍩哄湴', value: { move: true }, displayMode: 'button' as const },
                { id: 'stay', label: '鐣欏湪鍘熷湴', value: { move: false }, displayMode: 'button' as const },
            ],
            { sourceId: 'titan_mega_troopers_megabot_move', targetType: 'button' },
        );
        (interaction.data as {
            continuationContext?: {
                titanUid: string;
                titanDefId: string;
                fromBaseIndex: number;
                scoringBaseIndex: number;
                scoringBaseDefId: string;
                remaining: Array<{
                    titanUid: string;
                    titanDefId: string;
                    controllerId: string;
                    fromBaseIndex: number;
                }>;
            };
        }).continuationContext = {
            titanUid: next.titanUid,
            titanDefId: next.titanDefId,
            fromBaseIndex: next.fromBaseIndex,
            scoringBaseIndex: continuation.scoringBaseIndex,
            scoringBaseDefId: continuation.scoringBaseDefId,
            remaining: rest,
        };

        return {
            state: queueInteraction(state, interaction),
            events,
        };
    });

    registerInteractionHandler('titan_changerbots_mergacon_play', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string; skip?: boolean } | undefined;
        if (selected?.skip) {
            return { state, events: [] };
        }

        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        const titan = continuation?.titanUid ? getTitanByUid(state.core, continuation.titanUid) : undefined;
        if (selected?.baseIndex === undefined || !continuation?.titanDefId || !titan) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                playTitan(
                    titan,
                    playerId,
                    selected.baseIndex,
                    'changerbots_mergacon_special',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_penguins_emperor_penguin_play', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string; skip?: boolean } | undefined;
        if (selected?.skip) {
            return { state, events: [] };
        }

        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        const titan = continuation?.titanUid ? getTitanByUid(state.core, continuation.titanUid) : undefined;
        if (selected?.baseIndex === undefined || !continuation?.titanDefId || !titan) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                playTitan(
                    titan,
                    playerId,
                    selected.baseIndex,
                    'penguins_emperor_penguin_special',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_time_travelers_time_box_play', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string; skip?: boolean } | undefined;
        if (selected?.skip) {
            return { state, events: [] };
        }

        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        const titan = continuation?.titanUid ? getTitanByUid(state.core, continuation.titanUid) : undefined;
        if (selected?.baseIndex === undefined || !titan) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                buildTimeBoxMetadataEvent(titan.uid, 0, 'time_travelers_time_box_prompt_play', timestamp),
                playTitan(
                    titan,
                    playerId,
                    selected.baseIndex,
                    'time_travelers_time_box_prompt_play',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_pecos_bill_duel_start', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; baseIndex?: number; baseDefId?: string };
        } | undefined)?.continuationContext;
        if (!state.core.activeDuel) return { state, events: [] };

        if (selected?.skip) {
            return { state: continueActiveDuel(state, timestamp), events: [] };
        }
        if (!selected?.cardUid || continuation?.baseIndex === undefined || !continuation.titanUid) {
            return { state: continueActiveDuel(state, timestamp), events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        const player = state.core.players[playerId];
        const discardedCard = player?.hand.find((card) => card.uid === selected.cardUid);
        if (!titan || !player || !discardedCard) {
            return { state: continueActiveDuel(state, timestamp), events: [] };
        }

        return {
            state: continueActiveDuel(state, timestamp),
            events: [
                {
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId, cardUids: [selected.cardUid] },
                    timestamp,
                } as SmashUpEvent,
                {
                    type: SU_EVENTS.TITAN_METADATA_UPDATED,
                    payload: {
                        titanUid: titan.uid,
                        metadataUpdate: { deferClashUntilDuelEnds: true },
                        reason: 'pecos_bill_duel_start',
                    },
                    timestamp,
                } as SmashUpEvent,
                playTitan(
                    titan,
                    playerId,
                    continuation.baseIndex,
                    'pecos_bill_duel_start',
                    timestamp,
                    continuation.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_sphinx_start_turn', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as {
            skip?: boolean;
            cardUid?: string;
            defId?: string;
            baseIndex?: number;
            baseDefId?: string;
        } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string };
        } | undefined)?.continuationContext;
        if (selected?.skip) {
            return { state, events: [] };
        }
        if (!selected?.cardUid || selected.baseIndex === undefined || !continuation?.titanUid) {
            return { state, events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        const returnEvent = buildBuriedCardReturnedToHandEvent({
            core: state.core,
            playerId,
            cardUid: selected.cardUid,
            baseIndex: selected.baseIndex,
            source: 'sphinx-start-turn',
            now: timestamp,
        });
        if (!titan || !returnEvent) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                returnEvent,
                playTitan(
                    titan,
                    playerId,
                    selected.baseIndex,
                    'sphinx_start_turn',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_sphinx_after_scoring', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as {
            skip?: boolean;
            cardUid?: string;
            baseIndex?: number;
        } | undefined;
        if (selected?.skip) {
            const events = appendDeferredPostScoringEventsIfLast(state, data as Record<string, unknown> | undefined, []);
            return { state, events };
        }
        if (!selected?.cardUid || selected.baseIndex === undefined) {
            return { state, events: [] };
        }

        const returnEvent = buildBuriedCardReturnedToHandEvent({
            core: state.core,
            playerId,
            cardUid: selected.cardUid,
            baseIndex: selected.baseIndex,
            source: 'sphinx-after-scoring',
            now: timestamp,
        });
        if (!returnEvent) {
            return { state, events: [] };
        }

        const events = appendDeferredPostScoringEventsIfLast(
            state,
            data as Record<string, unknown> | undefined,
            [returnEvent],
        );
        return { state, events };
    });

    registerInteractionHandler('titan_sphinx_talent', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string; skip?: boolean } | undefined;
        const continuation = (data as {
            continuationContext?: { baseIndex?: number };
        } | undefined)?.continuationContext;
        if (selected?.skip) {
            return { state, events: [] };
        }
        if (!selected?.cardUid || !selected.defId || continuation?.baseIndex === undefined) {
            return { state, events: [] };
        }

        return {
            state,
            events: buildBuryCardEvents({
                core: state.core,
                matchState: state,
                playerId,
                cardUid: selected.cardUid,
                defId: selected.defId,
                baseIndex: continuation.baseIndex,
                trueOwnerId: playerId,
                buriedFrom: 'hand',
                reason: 'sphinx_talent',
                random,
                now: timestamp,
            }),
        };
    });

    registerInteractionHandler('titan_super_spies_moon_zero_three_choose_player', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { targetPlayerId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        const titan = continuation?.titanUid ? getTitanByUid(state.core, continuation.titanUid) : undefined;
        if (!selected?.targetPlayerId || !titan) {
            return { state, events: [] };
        }

        const peek = peekDeckTop(
            state.core,
            random,
            selected.targetPlayerId,
            'none',
            'super_spies_moon_zero_three_talent',
            timestamp,
            playerId,
        );
        if (!peek) {
            return {
                state,
                events: [buildAbilityFeedback(playerId, 'feedback.deck_empty', timestamp)],
            };
        }

        const cardName = getCardDef(peek.card.defId)?.name ?? peek.card.defId;
        const nextInteraction = createSimpleChoice(
            `titan_super_spies_moon_zero_three_resolve_${timestamp}`,
            playerId,
            `Moon Zero Three: ${getPlayerLabel(selected.targetPlayerId)} top card is ${cardName}. Choose where to put it.`,
            [
                { id: 'top', label: 'Put it on top', value: { placement: 'top' }, displayMode: 'button' as const },
                { id: 'bottom', label: 'Put it on bottom', value: { placement: 'bottom' }, displayMode: 'button' as const },
            ],
            {
                sourceId: 'titan_super_spies_moon_zero_three_resolve',
                targetType: 'button',
                displayCard: { defId: peek.card.defId },
            },
        );
        (nextInteraction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: titan.uid,
            titanDefId: titan.defId,
            targetPlayerId: selected.targetPlayerId,
            cardUid: peek.card.uid,
            defId: peek.card.defId,
        };

        return {
            state: queueInteraction(state, nextInteraction),
            events: peek.events,
        };
    });

    registerInteractionHandler('titan_super_spies_moon_zero_three_resolve', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { placement?: 'top' | 'bottom' } | undefined;
        const continuation = (data as {
            continuationContext?: { targetPlayerId?: string; cardUid?: string; defId?: string };
        } | undefined)?.continuationContext;
        if (!selected?.placement || !continuation?.targetPlayerId || !continuation.cardUid || !continuation.defId) {
            return { state, events: [] };
        }

        if (selected.placement === 'top') {
            return { state, events: [] };
        }

        return {
            state,
            events: [{
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: continuation.cardUid,
                    defId: continuation.defId,
                    ownerId: continuation.targetPlayerId,
                    reason: 'super_spies_moon_zero_three_talent',
                },
                timestamp,
            } as SmashUpEvent],
        };
    });

    registerInteractionHandler('titan_penguins_emperor_penguin_talent', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string; zone?: 'hand' | 'discard' } | undefined;
        if (!selected?.cardUid || !selected.defId || !selected.zone) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const titan = getControlledTitanOnBase(state.core, 'penguins_emperor_penguin', playerId);
        if (!player || !titan) {
            return { state, events: [] };
        }

        const sourceCards = selected.zone === 'hand' ? player.hand : player.discard;
        const card = sourceCards.find(candidate => candidate.uid === selected.cardUid);
        if (!card) {
            return { state, events: [] };
        }

        const events: SmashUpEvent[] = [];
        if (selected.zone === 'hand') {
            events.push(revealHand(playerId, playerId, [{ uid: card.uid, defId: card.defId }], 'penguins_emperor_penguin_talent', timestamp));
        }
        events.push({
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: playerId,
                reason: 'penguins_emperor_penguin_talent',
            },
            timestamp,
        } as SmashUpEvent);
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId,
                deckUids: random.shuffle([...player.deck.map(candidate => candidate.uid), card.uid]),
            },
            timestamp,
        } as SmashUpEvent);
        events.push(addTitanPowerCounter(titan.uid, 1, 'penguins_emperor_penguin_talent', timestamp));

        return { state, events };
    });

    registerInteractionHandler('titan_changerbots_mergacon_talent', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string; fromBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.titanUid || !continuation.titanDefId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.TITAN_ONGOING_SUPPRESSED,
                    payload: {
                        titanUid: continuation.titanUid,
                        reason: 'changerbots_mergacon_talent',
                    },
                    timestamp,
                } as SmashUpEvent,
                moveTitan(
                    continuation.titanUid,
                    continuation.titanDefId,
                    continuation.fromBaseIndex,
                    selected.baseIndex,
                    'changerbots_mergacon_talent',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_itty_critters_rainboroc_play_replacement', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { play?: boolean; skip?: boolean } | undefined;
        if (!selected?.play) {
            return { state, events: [] };
        }

        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        const titan = continuation?.titanUid ? getTitanByUid(state.core, continuation.titanUid) : undefined;
        const replacementEvent = getDeferredPostScoringEvents(data as Record<string, unknown> | undefined)?.find(
            event => event.type === SU_EVENTS.BASE_REPLACED,
        );
        const replacementBaseIndex = replacementEvent?.payload?.baseIndex;
        const replacementBaseDefId = replacementEvent?.payload?.newBaseDefId;
        if (!titan || !continuation?.titanDefId || typeof replacementBaseIndex !== 'number') {
            return { state, events: [] };
        }

        return {
            state: {
                ...state,
                core: {
                    ...state.core,
                    pendingPostScoringActions: [
                        ...(state.core.pendingPostScoringActions ?? []),
                        {
                            kind: 'playTitanOnReplacementBase',
                            titanUid: titan.uid,
                            defId: continuation.titanDefId,
                            ownerId: titan.ownerId,
                            controllerId: titan.controllerId,
                            baseIndex: replacementBaseIndex,
                            targetBaseDefId: replacementBaseDefId,
                            reason: 'itty_critters_rainboroc_special',
                        },
                    ],
                },
            },
            events: [],
        };
    });

    registerInteractionHandler('titan_itty_critters_rainboroc_choose_discard', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string; fromBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.cardUid || !continuation?.titanUid || !continuation.titanDefId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const card = player?.discard.find(candidate => candidate.uid === selected.cardUid);
        if (!player || !card) {
            return { state, events: [] };
        }

        const deckEvent: SmashUpEvent = {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId,
                deckUids: random.shuffle([...player.deck, card]).map(candidate => candidate.uid),
            },
            timestamp,
        };

        const baseOptions = getOtherBaseOptions(state.core, continuation.fromBaseIndex);
        if (baseOptions.length === 0) {
            return {
                state,
                events: [deckEvent],
            };
        }

        const interaction = createSimpleChoice(
            `titan_itty_critters_rainboroc_choose_base_${timestamp}`,
            playerId,
            'Rainboroc: you may move this titan to another base',
            [
                ...buildBaseTargetOptions(baseOptions, state.core),
                { id: 'skip', label: 'Stay here', value: { skip: true }, displayMode: 'button' as const },
            ],
            { sourceId: 'titan_itty_critters_rainboroc_choose_base', targetType: 'base' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = continuation;

        return {
            state: queueInteraction(state, interaction),
            events: [deckEvent],
        };
    });

    registerInteractionHandler('titan_itty_critters_rainboroc_choose_base', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string; skip?: boolean } | undefined;
        if (selected?.skip) {
            return { state, events: [] };
        }

        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string; fromBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.titanUid || !continuation.titanDefId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                moveTitan(
                    continuation.titanUid,
                    continuation.titanDefId,
                    continuation.fromBaseIndex,
                    selected.baseIndex,
                    'itty_critters_rainboroc_talent',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_bear_cavalry_major_ursa_choose_destination', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; fromBaseIndex?: number; titanDefId?: string };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.titanUid || continuation.fromBaseIndex === undefined || !continuation.titanDefId) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                moveTitan(
                    continuation.titanUid,
                    continuation.titanDefId,
                    continuation.fromBaseIndex,
                    selected.baseIndex,
                    'bear_cavalry_major_ursa',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_bear_cavalry_major_ursa_choose_talent_mode', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { branch?: 'counter' | 'move' } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string; baseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.branch || !continuation?.titanUid || !continuation.titanDefId || continuation.baseIndex === undefined) {
            return { state, events: [] };
        }

        if (selected.branch === 'counter') {
            const base = state.core.bases[continuation.baseIndex];
            if (!base || base.minions.length === 0) {
                return { state, events: [] };
            }

            const interaction = createSimpleChoice(
                `titan_bear_cavalry_major_ursa_choose_counter_target_${timestamp}`,
                playerId,
                'Major Ursa锛氶€夋嫨姝ゅ涓€涓殢浠庢斁缃?+1 鎴樺姏鏍囪',
                buildMinionTargetOptions(
                    base.minions.map(minion => ({
                        uid: minion.uid,
                        defId: minion.defId,
                        baseIndex: continuation.baseIndex!,
                    })),
                    { state: state.core, sourcePlayerId: playerId, effectType: 'affect' },
                ),
                { sourceId: 'titan_bear_cavalry_major_ursa_choose_counter_target', targetType: 'minion' },
            );
            return {
                state: queueInteraction(state, interaction),
                events: [],
            };
        }

        const baseOptions = getOtherBaseOptions(state.core, continuation.baseIndex);
        if (baseOptions.length === 0) {
            return { state, events: [] };
        }

        const interaction = createSimpleChoice(
            `titan_bear_cavalry_major_ursa_choose_destination_${timestamp}`,
            playerId,
            'Major Ursa: choose a base to move to',
            buildBaseTargetOptions(baseOptions, state.core),
            { sourceId: 'titan_bear_cavalry_major_ursa_choose_destination', targetType: 'base' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: continuation.titanUid,
            fromBaseIndex: continuation.baseIndex,
            titanDefId: continuation.titanDefId,
        };
        return {
            state: queueInteraction(state, interaction),
            events: [],
        };
    });

    registerInteractionHandler('titan_bear_cavalry_major_ursa_choose_counter_target', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'bear_cavalry_major_ursa_talent', timestamp)],
        };
    });

    registerInteractionHandler('titan_bear_cavalry_major_ursa_choose_minion', (state, playerId, value, data, _random, timestamp) => {
        if (value === 'skip') {
            return { state, events: [] };
        }

        const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
        const continuation = (data as { continuationContext?: { fromBaseIndex?: number } } | undefined)?.continuationContext;
        if (!selected?.minionUid || !selected.defId || continuation?.fromBaseIndex === undefined) {
            return { state, events: [] };
        }

        const baseOptions = getOtherBaseOptions(state.core, continuation.fromBaseIndex);
        if (baseOptions.length === 0) {
            return { state, events: [] };
        }

        const interaction = createSimpleChoice(
            `titan_bear_cavalry_major_ursa_choose_base_${timestamp}`,
            playerId,
            '婢堆呭敽鎼囱嶇窗闁瀚ㄧ憰浣哥殺鐠囥儵娈㈡禒搴Ｐ╅崝銊ュ煂閻ㄥ嫬鐔€閸?',
            buildBaseTargetOptions(baseOptions, state.core),
            { sourceId: 'titan_bear_cavalry_major_ursa_choose_base', targetType: 'base' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            minionUid: selected.minionUid,
            minionDefId: selected.defId,
            fromBaseIndex: selected.baseIndex ?? continuation.fromBaseIndex,
        };

        return {
            state: queueInteraction(state, interaction),
            events: [],
        };
    });

    registerInteractionHandler('titan_bear_cavalry_major_ursa_choose_base', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.minionUid || !continuation.minionDefId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                moveMinion(
                    continuation.minionUid,
                    continuation.minionDefId,
                    continuation.fromBaseIndex,
                    selected.baseIndex,
                    'bear_cavalry_major_ursa',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_ghosts_creampuff_man_discard', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { cardUid?: string } | undefined;
        if (!selected?.cardUid) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const discardedCard = player?.hand.find(card => card.uid === selected.cardUid);
        if (!player || !discardedCard) {
            return { state, events: [] };
        }

        const discardEvent: SmashUpEvent = {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: [selected.cardUid] },
            timestamp,
        };

        const actionOptions = buildCreampuffActionOptions(state, playerId);
        if (actionOptions.length === 0) {
            return { state, events: [discardEvent] };
        }

        const interaction = createSimpleChoice(
            `titan_ghosts_creampuff_man_play_${timestamp}`,
            playerId,
            '濂舵补娉¤姍缇庝汉锛氶€夋嫨瑕佷粠寮冪墝鍫嗛澶栨墦鍑虹殑鏍囧噯鎴樻湳',
            actionOptions,
            { sourceId: 'titan_ghosts_creampuff_man_play', targetType: 'generic', autoRefresh: 'discard', responseValidationMode: 'live' },
        );
        (interaction.data as { optionsGenerator?: unknown; continuationContext?: unknown }).optionsGenerator = (nextState: AbilityContext['matchState']) =>
            buildCreampuffActionOptions(nextState, playerId);
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanBaseIndex: getTitanByController(state.core, playerId)?.location.zone === 'base'
                ? getTitanByController(state.core, playerId)?.location.baseIndex
                : 0,
        };

        return {
            state: queueInteraction(state, interaction),
            events: [discardEvent],
        };
    });

    registerInteractionHandler('titan_ghosts_creampuff_man_play', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string } | undefined;
        if (!selected?.cardUid || !selected.defId) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const actionCard = player?.discard.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
        if (!player || !actionCard || !isStandardAction(actionCard.defId)) {
            return { state, events: [] };
        }

        const effectiveHandSize = getExternalActionEffectiveHandSize(state, playerId);
        if (!validateActionPlaySemantics(state.core, playerId, {
            defId: selected.defId,
            effectiveHandSize,
        }).valid) {
            return { state, events: [] };
        }

        const continuation = (data as { continuationContext?: { titanBaseIndex?: number } } | undefined)?.continuationContext;
        const baseIndex = continuation?.titanBaseIndex ?? 0;
        const events: SmashUpEvent[] = [
            recoverCardsFromDiscard(playerId, [selected.cardUid], 'ghosts_creampuff_man_talent', timestamp),
            {
                type: SU_EVENTS.ACTION_PLAYED,
                payload: {
                    playerId,
                    cardUid: selected.cardUid,
                    defId: selected.defId,
                    isExtraAction: true,
                },
                timestamp,
            } as SmashUpEvent,
        ];

        const result = appendResolvedActionAbility({
            state,
            events,
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            random,
            timestamp,
            baseIndex,
            handSizeAfterPlay: state.core.players[playerId]?.hand.length ?? 0,
        });
        result.events.push({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: {
                cardUid: selected.cardUid,
                defId: selected.defId,
                ownerId: playerId,
                reason: 'ghosts_creampuff_man_talent',
            },
            timestamp,
        } as SmashUpEvent);
        return result;
    });

    registerInteractionHandler('titan_vampires_ancient_lord_special', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as {
            mode?: 'skip' | 'store' | 'storeAndPlay';
            minionUid?: string;
            baseIndex?: number;
            titanUid?: string;
        } | undefined;
        if (!selected?.mode || !selected?.minionUid || selected.baseIndex === undefined || !selected.titanUid) {
            return { state, events: [] };
        }
        if (selected.mode === 'skip') {
            return { state, events: [] };
        }

        const titan = (state.core.titans ?? []).find(candidate =>
            candidate.uid === selected.titanUid
            && candidate.ownerId === playerId
            && candidate.location.zone === 'setaside',
        );
        const base = state.core.bases[selected.baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === selected.minionUid && candidate.controller === playerId);
        if (!titan || !base || !minion) {
            return { state, events: [] };
        }

        const events: SmashUpEvent[] = [
            removePowerCounter(selected.minionUid, selected.baseIndex, 1, 'vampires_ancient_lord_special', timestamp),
            addTitanPowerCounter(titan.uid, 1, 'vampires_ancient_lord_special', timestamp),
        ];

        if (selected.mode === 'storeAndPlay' && !getTitanByController(state.core, playerId)) {
            const totalCounters = titan.powerCounters + 1;
            events.push(
                removeTitanPowerCounter(titan.uid, totalCounters, 'vampires_ancient_lord_special', timestamp),
                playTitan(titan, playerId, selected.baseIndex, 'vampires_ancient_lord_special', timestamp, base.defId),
            );
        }

        return { state, events };
    });

    registerInteractionHandler('titan_vampires_ancient_lord_talent', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'vampires_ancient_lord_talent', timestamp)],
        };
    });

    registerInteractionHandler('titan_cthulhu_cthulhu_titan_talent_choice', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as CthulhuTitanTalentChoiceValue | undefined;
        if (!selected) return { state, events: [] };

        if (selected.choice === 'draw') {
            const madnessEvent = drawMadnessCards(playerId, 1, state.core, 'cthulhu_cthulhu_titan_talent', timestamp);
            return { state, events: madnessEvent ? [madnessEvent] : [] };
        }

        if (selected.choice === 'give') {
            const nextState = queueCthulhuTitanTransferInteraction(state, state.core, playerId, timestamp);
            return nextState ? { state: nextState, events: [] } : { state, events: [] };
        }

        return { state, events: [] };
    });

    registerInteractionHandler('titan_cthulhu_cthulhu_titan_talent_target', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as CthulhuTitanTransferChoiceValue | undefined;
        if (!selected?.targetPlayerId || !selected.madnessUid) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const madnessCard = player?.hand.find(card =>
            card.uid === selected.madnessUid && card.defId === MADNESS_CARD_DEF_ID,
        );
        if (!player || !madnessCard || !state.core.players[selected.targetPlayerId]) {
            return { state, events: [] };
        }

        const transferEvent: CardTransferredEvent = {
            type: SU_EVENTS.CARD_TRANSFERRED,
            payload: {
                cardUid: madnessCard.uid,
                defId: madnessCard.defId,
                fromPlayerId: playerId,
                toPlayerId: selected.targetPlayerId,
                reason: 'cthulhu_cthulhu_titan_talent',
            },
            timestamp,
        };
        return { state, events: [transferEvent] };
    });

    registerInteractionHandler('titan_pirates_the_kraken_play_replacement', (state, _playerId, value, data, _random, _timestamp) => {
        const selected = value as { play?: boolean; skip?: boolean } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                ownerId?: string;
                controllerId?: string;
                scoringBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        const events: SmashUpEvent[] = [];
        let nextState = state;

        if (selected?.play && continuation?.titanUid && continuation.titanDefId && continuation.ownerId && continuation.controllerId && continuation.scoringBaseIndex !== undefined) {
            const deferredEvents = getDeferredPostScoringEvents(data as Record<string, unknown> | undefined) ?? [];
            const replacementBaseDefId = (deferredEvents as Array<{ type: string; payload?: { newBaseDefId?: string } }>).find(
                event => event.type === SU_EVENTS.BASE_REPLACED,
            )?.payload?.newBaseDefId;
            if (replacementBaseDefId) {
                nextState = {
                    ...state,
                    core: {
                        ...state.core,
                        pendingPostScoringActions: [
                            ...(state.core.pendingPostScoringActions ?? []),
                            {
                                kind: 'playTitanOnReplacementBase',
                                titanUid: continuation.titanUid,
                                defId: continuation.titanDefId,
                                ownerId: continuation.ownerId,
                                controllerId: continuation.controllerId,
                                baseIndex: continuation.scoringBaseIndex,
                                targetBaseDefId: replacementBaseDefId,
                                reason: 'pirates_the_kraken_after_scoring_play',
                            },
                        ],
                    },
                };
            }
        }

        appendDeferredPostScoringEventsIfLast(state, data as Record<string, unknown> | undefined, events);
        return { state: nextState, events };
    });

    registerInteractionHandler('titan_pirates_the_kraken_choose_minion', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; defId?: string; baseIndex?: number } | undefined;
        const continuation = (data as { continuationContext?: { scoringBaseIndex?: number } } | undefined)?.continuationContext;
        if (selected?.skip || continuation?.scoringBaseIndex === undefined) {
            const events = appendDeferredPostScoringEventsIfLast(state, data as Record<string, unknown> | undefined, []);
            return { state, events };
        }
        if (!selected?.minionUid || !selected.defId) {
            return { state, events: [] };
        }

        const baseOptions = getOtherBaseOptions(state.core, continuation.scoringBaseIndex);
        if (baseOptions.length === 0) {
            const events = appendDeferredPostScoringEventsIfLast(state, data as Record<string, unknown> | undefined, []);
            return { state, events };
        }

        const interaction = createSimpleChoice(
            `titan_pirates_the_kraken_choose_base_${selected.minionUid}_${timestamp}`,
            playerId,
            'The Kraken: choose a base to move to',
            buildBaseTargetOptions(baseOptions, state.core),
            { sourceId: 'titan_pirates_the_kraken_choose_base', targetType: 'base' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            minionUid: selected.minionUid,
            minionDefId: selected.defId,
            fromBaseIndex: selected.baseIndex ?? continuation.scoringBaseIndex,
        };

        return {
            state: queueInteraction(state, interaction),
            events: [],
        };
    });

    registerInteractionHandler('titan_pirates_the_kraken_choose_base', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.minionUid || !continuation.minionDefId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }

        const events = appendDeferredPostScoringEventsIfLast(
            state,
            data as Record<string, unknown> | undefined,
            [
                moveMinion(
                    continuation.minionUid,
                    continuation.minionDefId,
                    continuation.fromBaseIndex,
                    selected.baseIndex,
                    'pirates_the_kraken_after_scoring_move',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        );

        return { state, events };
    });

    registerInteractionHandler('titan_pirates_the_kraken_talent', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                controllerId?: string;
                fromBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.titanUid || !continuation.titanDefId || !continuation.controllerId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }

        let nextState = state;
        const events: SmashUpEvent[] = [
            moveTitan(
                continuation.titanUid,
                continuation.titanDefId,
                continuation.fromBaseIndex,
                selected.baseIndex,
                'pirates_the_kraken_talent',
                timestamp,
                selected.baseDefId,
            ),
        ];

        const targetBase = state.core.bases[selected.baseIndex];
        for (const minion of targetBase?.minions ?? []) {
            if (minion.controller === continuation.controllerId) continue;
            nextState = schedulePowerModifierUntilNextTurnStart(
                nextState,
                minion.uid,
                -1,
                'pirates_the_kraken_talent',
            );
            events.push(addPermanentPower(
                minion.uid,
                selected.baseIndex,
                -1,
                'pirates_the_kraken_talent',
                timestamp,
            ));
        }

        return { state: nextState, events };
    });

    registerInteractionHandler('titan_tricksters_big_funny_giant_discard_to_play', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { cardUid?: string } | undefined;
        if (!selected?.cardUid) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const card = player?.hand.find(candidate => candidate.uid === selected.cardUid);
        if (!player || !card) {
            return { state, events: [] };
        }

        return {
            state,
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: [selected.cardUid] },
                timestamp,
            }],
        };
    });

    registerInteractionHandler('titan_werewolves_great_wolf_spirit_talent', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                addTempPower(
                    selected.minionUid,
                    selected.baseIndex,
                    1,
                    'werewolves_great_wolf_spirit_talent',
                    timestamp,
                ),
            ],
        };
    });


}