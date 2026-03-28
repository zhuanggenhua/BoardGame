/**
 * 大杀四方 - 泰坦能力接入
 *
 * 当前已正式打通：
 * - 奶油泡芙美人
 * - 大衮
 * - 奥术守护者
 * - 鲜血领主
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
    buildMinionTargetOptions,
    changeMinionController,
    drawMadnessCards,
    grantExtraAction,
    grantExtraMinion,
    getMinionPower,
    peekDeckTop,
    getTitanByController,
    getTitanByUid,
    destroyMinion,
    moveMinion,
    moveTitan,
    playTitan,
    revealHand,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { appendResolvedActionAbility, getExternalActionEffectiveHandSize } from '../domain/externalActionPlay';
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
    MinionDestroyedEvent,
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

function getOwnMaxMinionCounters(state: AbilityContext['state'], playerId: string): number {
    let maxCounters = 0;
    for (const base of state.bases) {
        for (const minion of base.minions) {
            if (minion.controller !== playerId) continue;
            maxCounters = Math.max(maxCounters, minion.powerCounters ?? 0);
        }
    }
    return maxCounters;
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
            label: getBaseDef(base.defId)?.name ?? `鍩哄湴 ${index + 1}`,
        }));
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
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? `基地 ${index + 1}`}`,
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
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`}`,
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

function getMajorUrsaEnemyMinionTargets(state: AbilityContext['state'], playerId: string, baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return base.minions
        .filter((minion) => {
            if (minion.controller === playerId) return false;
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            return (def?.power ?? minion.basePower) <= 3;
        })
        .map(minion => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            return ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${def?.name ?? minion.defId} (${def?.power ?? minion.basePower})`,
        });
        });
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
        '哥佐拉：你可以抽 1 张牌',
        [
            { id: 'draw', label: '抽 1 张牌', value: { draw: true }, displayMode: 'button' as const },
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
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
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}（${getMinionPower(state, minion, baseIndex)}）`,
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
        `硕大圆石：是否移动到「${getBaseDef(destinationBase?.defId ?? '')?.name ?? `基地 ${ctx.moveToBaseIndex + 1}`}」？`,
        [
            { id: 'move', label: '移动并结算', value: { move: true }, displayMode: 'button' as const },
            { id: 'skip', label: '跳过', value: { move: false }, displayMode: 'button' as const },
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
        '移动城堡：选择要移动到的基地',
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
        '移动城堡：选择要一起移动的己方随从（至多 3 个，可不选）',
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
        '漫游山岭巨人：选择要交出控制权的己方随从',
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
        '漫游山岭巨人：选择这里一个你拥有的随从来夺回控制权',
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
        '漫游山岭巨人：是否为该随从放置 1 枚 +1 力量标记？',
        [
            { id: 'place', label: '放置标记', value: { place: true }, displayMode: 'button' as const },
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
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
        '漫游山岭巨人：选择要执行的天赋效果',
        [
            { id: 'give', label: '交出控制权并抽 1 张牌', value: { branch: 'give' }, displayMode: 'button' as const },
            { id: 'reclaim', label: '夺回这里一个你拥有的随从', value: { branch: 'reclaim' }, displayMode: 'button' as const },
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
        `超级佐德：是否移动到即将计分的「${getBaseDef(scoringBase.defId)?.name ?? `基地 ${scoringBaseIndex + 1}`}」？`,
        [
            { id: 'move', label: '移动到该基地', value: { move: true }, displayMode: 'button' as const },
            { id: 'stay', label: '留在原地', value: { move: false }, displayMode: 'button' as const },
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
        includeHandCardUids?: string[];
        effectiveHandSize: number;
    },
) {
    const core = 'core' in ctx.state ? ctx.state.core : ctx.state;
    const player = core.players[ctx.playerId];
    if (!player) return [];

    const includeUidSet = new Set(ctx.includeHandCardUids ?? []);
    const justDiscarded = player.hand.filter(card => includeUidSet.has(card.uid));
    const merged = [...player.discard, ...justDiscarded];
    const dedup = new Map<string, typeof merged[number]>();
    for (const card of merged) {
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
    return player.hand
        .filter(card => getCreampuffPlayableActions({
            state: ctx.state,
            playerId: ctx.playerId,
            includeHandCardUids: [card.uid],
            effectiveHandSize,
        }).length > 0)
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
    includeHandCardUids?: string[],
) {
    const actions = getCreampuffPlayableActions({
        state,
        playerId,
        includeHandCardUids,
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
        '奶油泡芙美人：弃置 1 张牌',
        discardOptions,
        { sourceId: 'titan_ghosts_creampuff_man_discard', targetType: 'hand' },
    );
    (interaction.data as { optionsGenerator?: unknown }).optionsGenerator = (nextState: AbilityContext['matchState']) => {
        const nextPlayer = nextState.core.players[ctx.playerId];
        if (!nextPlayer) return [];
        return nextPlayer.hand
            .filter(card => getCreampuffPlayableActions({
                state: nextState,
                playerId: ctx.playerId,
                includeHandCardUids: [card.uid],
                effectiveHandSize: nextPlayer.hand.length,
            }).length > 0)
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

function vampireAncientLordSpecial(ctx: AbilityContext): AbilityResult {
    if ((ctx.state.powerCountersPlacedOnMinionsThisTurn ?? 0) < 2) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'vampires_ancient_lord_special');
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
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        }))
        .filter(candidate => candidate.ownMinionCount >= 2)
        .map(({ baseIndex, label }) => ({ baseIndex, label }));
}

function getEmperorPenguinEligibleBases(state: AbilityContext['state'], playerId: string) {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            ownMinionCount: base.minions.filter(minion => minion.controller === playerId).length,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        }))
        .filter(candidate => candidate.ownMinionCount >= 3)
        .map(({ baseIndex, label }) => ({ baseIndex, label }));
}

function getMoonZeroThreeEligibleBases(state: AbilityContext['state'], playerId: string) {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            hasOnlyOwnMinions: base.minions.every(minion => minion.controller === playerId),
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
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
            label: `${getPlayerLabel(pid)}的牌库`,
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
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
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
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
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
            '时间盒子：是否移除全部计数器并打出到一个基地？',
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
        '三号空间站：选择要查看的牌库',
        playerOptions.map((option, index) => ({
            id: `player-${index}`,
            label: option.label,
            value: { targetPlayerId: option.targetPlayerId },
            displayMode: 'button' as const,
        })),
        { sourceId: 'titan_super_spies_moon_zero_three_choose_player', targetType: 'generic' },
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
        '企鹅帝皇：选择要进场的基地',
        [
            ...baseOptions,
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
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
            label: `${getCardDef(card.defId)?.name ?? card.defId}（${card.zone === 'hand' ? '手牌' : '弃牌堆'}）`,
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
        '企鹅帝皇：选择要洗回牌库的低战力随从',
        options.map(option => ({
            id: option.cardUid,
            label: option.label,
            value: { cardUid: option.cardUid, defId: option.defId, zone: option.zone },
            displayMode: 'button' as const,
        })),
        { sourceId: 'titan_penguins_emperor_penguin_talent', targetType: 'generic' },
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
        '合体机器人：选择要进场的基地',
        [
            ...baseOptions,
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
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
        '克苏鲁：选择要给予疯狂卡的玩家',
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
        '克苏鲁：选择要执行的天赋效果',
        [
            {
                id: 'draw',
                label: '抽一张疯狂卡',
                value: { choice: 'draw' },
                displayMode: 'button' as const,
            },
            {
                id: 'give',
                label: '给另一位玩家一张疯狂卡',
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
                label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
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
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} (${getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`})`,
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
        '巨狼之灵：选择一个你的随从获得 +1 战力直到回合结束',
        buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'buff' }),
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
        '合体机器人：选择要移动到的基地',
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
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || base.minions.length > 0) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'tricksters_big_funny_giant_special');
}

function getBigFunnyGiantDiscardableHandCards(state: AbilityContext['state'], playerId: string, excludeCardUid?: string) {
    const player = state.players[playerId];
    if (!player) return [];
    return player.hand.filter(card => card.uid !== excludeCardUid);
}

function getBigFunnyGiantLowPowerMinions(state: AbilityContext['state'], baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return base.minions
        .filter(minion => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            return (def?.power ?? minion.basePower) <= 2;
        })
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}`,
        }));
}

function trickstersBigFunnyGiantTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const targets = getBigFunnyGiantLowPowerMinions(ctx.state, titan.location.baseIndex);
    const baseOptions = getOtherBaseOptions(ctx.state, titan.location.baseIndex);
    if (targets.length === 0 || baseOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_tricksters_big_funny_giant_choose_minion_${ctx.now}`,
        ctx.playerId,
        '滑稽巨人：选择本基地一个战力 2 或更低的随从',
        buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        { sourceId: 'titan_tricksters_big_funny_giant_choose_minion', targetType: 'minion' },
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

function trickstersBigFunnyGiantOnTurnEnd(ctx: AbilityContext): AbilityResult {
    const titan = getControlledTitanOnBase(ctx.state, 'tricksters_big_funny_giant', ctx.playerId);
    if (!titan || titan.location.zone !== 'base') {
        return { events: [] };
    }
    const base = ctx.state.bases[titan.location.baseIndex];
    if (!base) return { events: [] };
    const hasOpponentMinions = base.minions.some(minion => minion.controller !== ctx.playerId);
    if (hasOpponentMinions) {
        return { events: [] };
    }
    return {
        events: [addTitanPowerCounter(titan.uid, 1, 'tricksters_big_funny_giant', ctx.now)],
    };
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
        '滑稽巨人：选择 1 张手牌弃置，才能把随从打到这里',
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
            '彩虹鸟：是否将其打出到替换的基地？',
            [
                { id: 'play', label: '打出彩虹鸟', value: { play: true }, displayMode: 'button' as const },
                { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
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
        '彩虹鸟：选择弃牌堆中一个战力 2 或更低的随从洗回牌库',
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
            '海怪克拉肯：是否将其打出到替换的基地？',
            [
                { id: 'play', label: '打出海怪克拉肯', value: { play: true }, displayMode: 'button' as const },
                { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
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
            '海怪克拉肯：你可以将此处你的一个随从移动到其他基地而不进入弃牌堆',
            [
                ...buildMinionTargetOptions(minionTargets, { state: ctx.state, sourcePlayerId: titan.controllerId, effectType: 'move' }),
                { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ],
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
        '海怪克拉肯：选择要移动到的基地',
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
    if (getOwnMaxMinionCounters(ctx.state, ctx.playerId) < 7) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'giant_ants_death_on_six_legs_special');
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

function bearCavalryMajorUrsaSpecial(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || !base.minions.some(minion => minion.controller === ctx.playerId)) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'bear_cavalry_major_ursa_special');
}

function bearCavalryMajorUrsaTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const baseOptions = getOtherBaseOptions(ctx.state, titan.location.baseIndex);
    if (baseOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_bear_cavalry_major_ursa_choose_destination_${ctx.now}`,
        ctx.playerId,
        '澶х唺搴э細閫夋嫨瑕佺Щ鍔ㄥ埌鐨勫熀鍦?',
        buildBaseTargetOptions(baseOptions, ctx.state),
        { sourceId: 'titan_bear_cavalry_major_ursa_choose_destination', targetType: 'base' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        fromBaseIndex: titan.location.baseIndex,
        titanDefId: titan.defId,
    };

    return {
        events: [addTitanPowerCounter(titan.uid, 1, 'bear_cavalry_major_ursa', ctx.now)],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function bearCavalryMajorUrsaOnTitanMoved(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.baseIndex;
    if (baseIndex === undefined || !ctx.matchState) {
        return { events: [] };
    }

    const titan = getTitanByController(ctx.state, ctx.playerId);
    if (!titan || titan.defId !== 'bear_cavalry_major_ursa' || titan.location.zone !== 'base' || titan.location.baseIndex !== baseIndex) {
        return { events: [] };
    }

    const minionTargets = getMajorUrsaEnemyMinionTargets(ctx.state, ctx.playerId, baseIndex);
    const otherBases = getOtherBaseOptions(ctx.state, baseIndex);
    if (minionTargets.length === 0 || otherBases.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice(
        `titan_bear_cavalry_major_ursa_choose_minion_${ctx.now}`,
        ctx.playerId,
        '澶х唺搴э細閫夋嫨瑕佺Щ鍔ㄧ殑瀵规墜闅忎粠锛堝彲璺宠繃锛?',
        [
            ...buildMinionTargetOptions(minionTargets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'move' }),
            { id: 'skip', label: '璺宠繃', value: 'skip' as const, displayMode: 'button' as const },
        ],
        { sourceId: 'titan_bear_cavalry_major_ursa_choose_minion', targetType: 'minion' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = { fromBaseIndex: baseIndex };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function vampireAncientLordTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    const candidates = base.minions
        .filter(minion => minion.controller === ctx.playerId && (minion.powerCounters ?? 0) > 0)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量标记 ${minion.powerCounters}）`,
        }));

    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_vampires_ancient_lord_talent_${ctx.now}`,
        ctx.playerId,
        '鲜血领主：选择本基地一个已有 +1 力量标记的己方随从',
        buildMinionTargetOptions(candidates, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'affect' }),
        { sourceId: 'titan_vampires_ancient_lord_talent', targetType: 'minion' },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function buildAncientLordBonusCounterEvents(state: AbilityContext['state'], event: SmashUpEvent): SmashUpEvent[] | undefined {
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

function buildDeathOnSixLegsCounterTransferEvents(
    state: AbilityContext['state'],
    minionUid: string,
    fromBaseIndex: number,
    timestamp: number,
): SmashUpEvent[] | undefined {
    const sourceBase = state.bases[fromBaseIndex];
    const sourceMinion = sourceBase?.minions.find(minion => minion.uid === minionUid);
    if (!sourceMinion || (sourceMinion.powerCounters ?? 0) <= 0) {
        return undefined;
    }

    const titan = (state.titans ?? []).find(candidate =>
        candidate.defId === 'giant_ants_death_on_six_legs'
        && candidate.location.zone === 'base',
    );
    if (!titan) return undefined;

    return [
        addTitanPowerCounter(titan.uid, 1, 'giant_ants_death_on_six_legs', timestamp),
    ];
}

export function registerTitanAbilities(): void {
    registerAbility('super_spies_moon_zero_three', 'special', superSpiesMoonZeroThreeSpecial);
    registerAbility('super_spies_moon_zero_three', 'talent', superSpiesMoonZeroThreeTalent);
    registerTitanSpecialValidator('super_spies_moon_zero_three', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        return getMoonZeroThreeEligibleBases(state, playerId).some(candidate => candidate.baseIndex === baseIndex)
            ? null
            : '你只能将三号空间站打出到没有其他玩家随从的基地';
    });
    registerTitanTalentValidator('super_spies_moon_zero_three', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return getMoonZeroThreeInspectablePlayers(state).length > 0
            ? null
            : '没有可查看的牌库';
    });
    registerTrigger('super_spies_moon_zero_three', 'onDeckInspected', superSpiesMoonZeroThreeOnDeckInspected);

    registerTitanSpecialValidator('penguins_emperor_penguin', () =>
        '企鹅帝皇只能在你的回合开始时通过特殊能力进场');
    registerAbility('penguins_emperor_penguin', 'ongoingActivation', penguinsEmperorPenguinOngoingActivation);
    registerAbility('penguins_emperor_penguin', 'talent', penguinsEmperorPenguinTalent);
    registerTitanOngoingActivationValidator('penguins_emperor_penguin', ({ titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return null;
    });
    registerTitanTalentValidator('penguins_emperor_penguin', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return getEmperorPenguinTalentCandidates(state, playerId).length > 0
            ? null
            : '你的手牌与弃牌堆中没有战力 3 或更低的随从';
    });
    registerTrigger('penguins_emperor_penguin', 'onTurnStart', penguinsEmperorPenguinOnTurnStart, { global: true });

    registerTitanSpecialValidator('changerbots_mergacon', () =>
        '合体机器人只能在你的回合开始时通过特殊能力进场');
    registerAbility('changerbots_mergacon', 'talent', changerbotsMergaconTalent);
    registerTitanTalentValidator('changerbots_mergacon', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : '没有可移动到的其他基地';
    });
    registerTrigger('changerbots_mergacon', 'onTurnStart', changerbotsMergaconOnTurnStart, { global: true });
    registerTitanPowerModifier('changerbots_mergacon', ({ state, titan }) =>
        (state.titanOngoingSuppressedUntilTurnEnd ?? []).includes(titan.uid) ? 0 : 3);

    registerTitanSpecialValidator('itty_critters_rainboroc', () =>
        '彩虹鸟只能在基地计分后通过特殊能力进场');
    registerAbility('itty_critters_rainboroc', 'talent', ittyCrittersRainborocTalent);
    registerTitanTalentValidator('itty_critters_rainboroc', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return getRainborocLowPowerDiscardCards(state, playerId).length > 0
            ? null
            : '你的弃牌堆中没有战力 2 或更低的随从';
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
            : '你只能将哥佐拉打出到有你至少两个战术的基地');
    registerTrigger('kaiju_gorgodzolla', 'onMinionPlayed', kaijuGorgodzollaOnMinionPlayed);
    registerTrigger('kaiju_gorgodzolla', 'onActionPlayed', kaijuGorgodzollaOnActionPlayed);

    registerAbility('explorers_very_large_boulder', 'special', explorersVeryLargeBoulderSpecial);
    registerTitanSpecialValidator('explorers_very_large_boulder', ({ state, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        const base = state.bases[baseIndex];
        if (!base) return '无效的基地索引';
        return base.minions.length === 0
            ? null
            : '你只能将硕大圆石打出到没有玩家随从的基地';
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
            : '只有至少 2 个你拥有的随从正被其他玩家控制时，你才能打出漫游山岭巨人');
    registerTitanTalentValidator('ignobles_the_hill_that_strolls', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        const canGive = getHillGiveControlTargets(state, playerId).length > 0;
        const canReclaim = getHillOwnedMinionsControlledByOthers(state, playerId, titan.location.baseIndex).length > 0;
        return (canGive || canReclaim)
            ? null
            : '没有可交出或可夺回控制权的随从';
    });
    registerTrigger('ignobles_the_hill_that_strolls', 'onMinionAffected', ignoblesTheHillThatStrollsOnMinionAffected, {
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });

    registerAbility('time_travelers_time_box', 'special', timeTravelersTimeBoxSpecial);
    registerAbility('time_travelers_time_box', 'talent', timeTravelersTimeBoxTalent);
    registerTitanSpecialValidator('time_travelers_time_box', ({ titan }) =>
        getTimeBoxCounter(titan) >= 5 ? null : '时间盒子的计数还未达到 5');
    registerTitanTalentValidator('time_travelers_time_box', ({ titan }) =>
        titan.location.zone === 'base' ? null : '该泰坦当前不在场');
    registerTrigger('time_travelers_time_box', 'onTurnStart', timeTravelersTimeBoxOnTurnStart, { global: true, optional: true });
    registerTrigger('time_travelers_time_box', 'onCardReturnedToHand', timeTravelersTimeBoxOnCardReturnedToHand, { global: true, optional: true });

    registerAbility('magical_girls_walking_castle', 'special', magicalGirlsWalkingCastleSpecial);
    registerTitanSpecialValidator('magical_girls_walking_castle', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        return getOwnMinionCountOnBase(state, baseIndex, playerId) >= 2
            ? null
            : '你只能将移动城堡打出到有你至少 2 个随从的基地';
    });
    registerAbility('magical_girls_walking_castle', 'talent', magicalGirlsWalkingCastleTalent);
    registerTitanTalentValidator('magical_girls_walking_castle', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : '没有可移动到的其他基地';
    });
    registerProtection('magical_girls_walking_castle', 'destroy', magicalGirlsWalkingCastleProtectionChecker);

    registerAbility('mega_troopers_megabot', 'special', megaTroopersMegabotSpecial);
    registerTitanSpecialValidator('mega_troopers_megabot', ({ state, playerId, baseIndex }) =>
        getOwnMinionCountOnBase(state, baseIndex, playerId) >= 3
            ? null
            : '你只能将超级佐德打出到有你至少 3 个随从的基地');
    registerTrigger('mega_troopers_megabot', 'beforeScoring', megaTroopersMegabotBeforeScoring);
    registerTitanPowerModifier('mega_troopers_megabot', ({ state, baseIndex, playerId }) =>
        getOwnMinionCountOnBase(state, baseIndex, playerId));

    registerAbility('ghosts_creampuff_man', 'special', ghostsCreampuffManSpecial);
    registerAbility('ghosts_creampuff_man', 'talent', ghostsCreampuffManTalent);
    registerTitanSpecialValidator('ghosts_creampuff_man', ({ state, playerId }) =>
        (state.players[playerId]?.hand.length ?? 0) === 0 ? null : '你必须在没有手牌时才能打出奶油泡芙美人');
    registerTitanTalentValidator('ghosts_creampuff_man', ({ state, playerId }) => {
        const player = state.players[playerId];
        if (!player || player.hand.length === 0) return '你没有可弃置的手牌';
        const hasPlayableAction = player.hand.some(card =>
            getCreampuffPlayableActions({
                state,
                playerId,
                includeHandCardUids: [card.uid],
                effectiveHandSize: player.hand.length,
            }).length > 0,
        );
        return hasPlayableAction ? null : '弃牌后也没有可额外打出的标准战术';
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
            : '你只能将大衮打出到有你至少两个同名随从的基地');
    registerTitanTalentValidator('innsmouth_dagon', ({ state, playerId }) => {
        const player = state.players[playerId];
        const hasMinionInHand = player?.hand.some(card => card.type === 'minion') ?? false;
        return hasMinionInHand ? null : '你手里没有可额外打出的随从';
    });
    registerTitanPowerModifier('innsmouth_dagon', ({ state, baseIndex, playerId }) =>
        getDagonMatchingMinionCount(state, baseIndex, playerId));

    registerAbility('wizards_arcane_protector', 'special', wizardArcaneProtectorSpecial);
    registerAbility('wizards_arcane_protector', 'talent', wizardArcaneProtectorTalent);
    registerTitanSpecialValidator('wizards_arcane_protector', ({ state }) =>
        (state.cardsPlayedThisTurn ?? 0) >= 5 ? null : '你本回合还没有打出 5 张牌');

    registerTitanPowerModifier('wizards_arcane_protector', ({ state, playerId }) => {
        const handSize = state.players[playerId]?.hand.length ?? 0;
        return Math.floor(handSize / 3);
    });

    registerAbility('cthulhu_cthulhu_titan', 'special', cthulhuTitanSpecial);
    registerAbility('cthulhu_cthulhu_titan', 'talent', cthulhuTitanTalent);
    registerTitanSpecialValidator('cthulhu_cthulhu_titan', ({ state, playerId, baseIndex }) => {
        const base = state.bases[baseIndex];
        if (!base) return '无效的基地索引';
        const hasControlledMinion = base.minions.some(minion => minion.controller === playerId);
        return hasControlledMinion ? null : '你只能将克苏鲁打出到有你随从的基地';
    });
    registerTitanTalentValidator('cthulhu_cthulhu_titan', ({ state, playerId }) => {
        const canDrawMadness = (state.madnessDeck?.length ?? 0) > 0;
        const canTransferMadness = buildCthulhuTitanTransferOptions(state, playerId).length > 0;
        return (canDrawMadness || canTransferMadness)
            ? null
            : '你既不能抽疯狂卡，也没有可转交给其他玩家的疯狂卡';
    });
    registerInterceptor('cthulhu_cthulhu_titan', (state, event) => buildCthulhuTitanCounterEvents(state, event));

    registerAbility('giant_ants_death_on_six_legs', 'special', giantAntsDeathOnSixLegsSpecial);
    registerAbility('giant_ants_death_on_six_legs', 'talent', giantAntsDeathOnSixLegsTalent);
    registerTitanSpecialValidator('giant_ants_death_on_six_legs', ({ state, playerId }) =>
        getOwnMaxMinionCounters(state, playerId) >= 7
            ? null
            : '浣犵殑涓€涓殢浠庝笂蹇呴』鏈?7 鏋氭垨鏇村 +1 鍔涢噺鏍囪锛屾墠鑳芥墦鍑哄叚瓒虫绁?',
    );
    registerInterceptor('giant_ants_death_on_six_legs', (state, event) => {
        if (event.type !== SU_EVENTS.MINION_DESTROYED) return undefined;
        const payload = (event as MinionDestroyedEvent).payload;
        const bonusEvents = buildDeathOnSixLegsCounterTransferEvents(
            state,
            payload.minionUid,
            payload.fromBaseIndex,
            event.timestamp ?? 0,
        );
        return bonusEvents ? [event, ...bonusEvents] : undefined;
    });
    registerTrigger('giant_ants_death_on_six_legs', 'onMinionDiscardedFromBase', (ctx) => {
        if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return [];
        return buildDeathOnSixLegsCounterTransferEvents(
            ctx.state,
            ctx.triggerMinionUid,
            ctx.baseIndex,
            ctx.now,
        ) ?? [];
    });

    registerAbility('bear_cavalry_major_ursa', 'special', bearCavalryMajorUrsaSpecial);
    registerAbility('bear_cavalry_major_ursa', 'talent', bearCavalryMajorUrsaTalent);
    registerTitanSpecialValidator('bear_cavalry_major_ursa', ({ state, playerId, baseIndex }) => {
        const base = state.bases[baseIndex];
        if (!base) return '鏃犳晥鐨勫熀鍦扮储寮?';
        return base.minions.some(minion => minion.controller === playerId)
            ? null
            : '浣犲彧鑳藉皢澶х唺搴ф墦鍑哄埌鏈変綘闅忎粠鐨勫熀鍦?';
    });
    registerTitanTalentValidator('bear_cavalry_major_ursa', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '璇ユ嘲鍧﹀綋鍓嶄笉鍦ㄥ満';
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : '娌℃湁鍙互绉诲姩鍒扮殑鍏朵粬鍩哄湴';
    });
    registerTrigger('bear_cavalry_major_ursa', 'onTitanMoved', bearCavalryMajorUrsaOnTitanMoved, { optional: true });

    registerAbility('vampires_ancient_lord', 'special', vampireAncientLordSpecial);
    registerAbility('vampires_ancient_lord', 'talent', vampireAncientLordTalent);
    registerTitanSpecialValidator('vampires_ancient_lord', ({ state }) =>
        (state.powerCountersPlacedOnMinionsThisTurn ?? 0) >= 2 ? null : '你本回合还没有为随从放置 2 枚 +1 力量标记');
    registerTitanTalentValidator('vampires_ancient_lord', ({ state, playerId, baseIndex }) => {
        const base = state.bases[baseIndex];
        if (!base) return '无效的基地索引';
        const hasTarget = base.minions.some(minion =>
            minion.controller === playerId && (minion.powerCounters ?? 0) > 0,
        );
        return hasTarget ? null : '本基地没有你已有 +1 力量标记的随从';
    });
    registerInterceptor('vampires_ancient_lord', (state, event) => buildAncientLordBonusCounterEvents(state, event));

    registerAbility('werewolves_great_wolf_spirit', 'special', werewolvesGreatWolfSpiritSpecial);
    registerTitanSpecialValidator('werewolves_great_wolf_spirit', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        const eligibleBases = getGreatWolfSpiritEligibleBases(state, playerId);
        if (eligibleBases.length < 2) return '你尚未在 2 个或更多基地拥有最高战力';
        return eligibleBases.some(option => option.baseIndex === baseIndex)
            ? null
            : '此基地不满足巨狼之灵的进场条件';
    });
    registerAbility('werewolves_great_wolf_spirit', 'talent', werewolvesGreatWolfSpiritTalent);
    registerTitanTalentValidator('werewolves_great_wolf_spirit', ({ state, titan, playerId }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return getGreatWolfSpiritTalentTargets(state, playerId).length > 0
            ? null
            : '没有可获得力量的己方随从';
    });

    registerAbility('tricksters_big_funny_giant', 'special', trickstersBigFunnyGiantSpecial);
    registerTitanSpecialValidator('tricksters_big_funny_giant', ({ state, titan, baseIndex }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        const base = state.bases[baseIndex];
        if (!base) return '无效的基地索引';
        return base.minions.length === 0
            ? null
            : '滑稽巨人只能打到没有玩家随从的基地';
    });
    registerAbility('tricksters_big_funny_giant', 'talent', trickstersBigFunnyGiantTalent);
    registerTitanTalentValidator('tricksters_big_funny_giant', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        if (getBigFunnyGiantLowPowerMinions(state, titan.location.baseIndex).length === 0) {
            return '本基地没有战力 2 或更低的随从';
        }
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : '没有可移动到的其他基地';
    });
    registerRestriction('tricksters_big_funny_giant', 'play_minion', ({ state, baseIndex, playerId, extra }) => {
        const titan = (state.titans ?? []).find(candidate =>
            candidate.defId === 'tricksters_big_funny_giant'
            && candidate.location.zone === 'base'
            && candidate.location.baseIndex === baseIndex,
        );
        if (!titan || titan.controllerId === playerId) {
            return false;
        }

        const discardable = getBigFunnyGiantDiscardableHandCards(
            state,
            playerId,
            extra?.fromDiscard ? undefined : (extra?.cardUid as string | undefined),
        );
        return discardable.length === 0;
    });
    registerTrigger('tricksters_big_funny_giant', 'onTurnEnd', trickstersBigFunnyGiantOnTurnEnd);
    registerTrigger('tricksters_big_funny_giant', 'onMinionPlayed', trickstersBigFunnyGiantOnMinionPlayed);

    registerAbility('pirates_the_kraken', 'talent', piratesTheKrakenTalent);
    registerTitanTalentValidator('pirates_the_kraken', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : '没有可移动到的其他基地';
    });
    registerTrigger('pirates_the_kraken', 'afterScoring', piratesTheKrakenAfterScoring, { global: true });
}

export function registerTitanInteractionHandlers(): void {
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
            '漫游山岭巨人：选择要交出控制权的玩家',
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
            '硕大圆石：选择要消灭的随从',
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
            `超级佐德：是否移动到即将计分的「${getBaseDef(continuation.scoringBaseDefId)?.name ?? `基地 ${continuation.scoringBaseIndex + 1}`}」？`,
            [
                { id: 'move', label: '移动到该基地', value: { move: true }, displayMode: 'button' as const },
                { id: 'stay', label: '留在原地', value: { move: false }, displayMode: 'button' as const },
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
            `三号空间站：${getPlayerLabel(selected.targetPlayerId)}牌库顶是「${cardName}」，选择放回位置`,
            [
                { id: 'top', label: '放回牌库顶', value: { placement: 'top' }, displayMode: 'button' as const },
                { id: 'bottom', label: '放到牌库底', value: { placement: 'bottom' }, displayMode: 'button' as const },
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
            '彩虹鸟：你可以将其移动到另一个基地',
            [
                ...buildBaseTargetOptions(baseOptions, state.core),
                { id: 'skip', label: '留在原基地', value: { skip: true }, displayMode: 'button' as const },
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
            '澶х唺搴э細閫夋嫨瑕佸皢璇ラ殢浠庣Щ鍔ㄥ埌鐨勫熀鍦?',
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

        const actionOptions = buildCreampuffActionOptions(state, playerId, [selected.cardUid]);
        if (actionOptions.length === 0) {
            return { state, events: [discardEvent] };
        }

        const interaction = createSimpleChoice(
            `titan_ghosts_creampuff_man_play_${timestamp}`,
            playerId,
            '奶油泡芙美人：选择要从弃牌堆额外打出的标准战术',
            actionOptions,
            { sourceId: 'titan_ghosts_creampuff_man_play', targetType: 'generic' },
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
            '海怪克拉肯：选择要移动到的基地',
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

    registerInteractionHandler('titan_tricksters_big_funny_giant_choose_minion', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string; fromBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined || !continuation?.titanUid || !continuation.titanDefId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }

        const baseOptions = getOtherBaseOptions(state.core, continuation.fromBaseIndex);
        if (baseOptions.length === 0) {
            return { state, events: [] };
        }

        const interaction = createSimpleChoice(
            `titan_tricksters_big_funny_giant_choose_base_${timestamp}`,
            playerId,
            '滑稽巨人：选择要移动到的基地',
            buildBaseTargetOptions(baseOptions, state.core),
            { sourceId: 'titan_tricksters_big_funny_giant_choose_base', targetType: 'base' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            minionUid: selected.minionUid,
            minionDefId: selected.defId,
            targetBaseIndex: selected.baseIndex,
            titanUid: continuation.titanUid,
            titanDefId: continuation.titanDefId,
            fromBaseIndex: continuation.fromBaseIndex,
        };

        return {
            state: queueInteraction(state, interaction),
            events: [],
        };
    });

    registerInteractionHandler('titan_tricksters_big_funny_giant_choose_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: {
                minionUid?: string;
                minionDefId?: string;
                targetBaseIndex?: number;
                titanUid?: string;
                titanDefId?: string;
                fromBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.minionUid || !continuation.minionDefId || continuation.targetBaseIndex === undefined || !continuation.titanUid || !continuation.titanDefId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }

        const targetMinion = state.core.bases[continuation.targetBaseIndex]?.minions.find(minion =>
            minion.uid === continuation.minionUid && minion.defId === continuation.minionDefId,
        );
        if (!targetMinion) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                destroyMinion(
                    continuation.minionUid,
                    continuation.minionDefId,
                    continuation.targetBaseIndex,
                    targetMinion.owner,
                    playerId,
                    'tricksters_big_funny_giant_talent',
                    timestamp,
                ),
                moveTitan(
                    continuation.titanUid,
                    continuation.titanDefId,
                    continuation.fromBaseIndex,
                    selected.baseIndex,
                    'tricksters_big_funny_giant_talent',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
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
