/**
 * 大杀四方 - 泰坦能力接入
 *
 * 当前已正式打通：
 * - 奶油泡芙美人
 * - 大衮
 * - 奥术守护者
 * - 鲜血领主
 */

import type { MatchState } from '../../../engine/types';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { syncActiveResolutionWithInteraction } from '../../../engine/systems/resolutionStack';
import { getBaseDef, getCardDef, getMinionLikePower, getTitanDef } from '../data/cards';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { createCardObjectRefFromInstance, createCardTransferEvent } from '../domain/objectProvenance';
import {
    addPowerCounter,
    addPermanentPower,
    addTempPower,
    addTitanPowerCounter,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildFieldSourceTargetPromptConfig,
    buildFieldSourceToBaseTargetOptions,
    buildFieldSourceToMinionTargetOptions,
    buildPlayerTargetOptions,
    buildStandardDrawEvents,
    buildMinionTargetOptions,
    createSkipOption,
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
    canControllerPlayTitan,
    getTitanByController,
    getTitanByUid,
    moveTitan,
    playTitan,
    removePowerCounter,
    removeTitanPowerCounter,
    removeTitanFromPlay,
    revealHand,
    recoverCardsFromDiscard,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
} from '../domain/abilityHelpers';
import { appendResolvedActionAbility, getExternalActionEffectiveHandSize } from '../domain/externalActionPlay';
import { buildBuryCardEvents, buildBuriedCardReturnedToHandEvent } from '../domain/bury';
import { continueActiveDuel } from '../domain/duel';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerInterceptor, registerProtection, registerRestriction, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, RestrictionCheckContext, TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { getPlayerEffectivePowerOnBase, registerTitanPowerModifier } from '../domain/ongoingModifiers';
import {
    appendPendingPostScoringActions,
    getDeferredPostScoringEvents,
    getDeferredReplacementBaseDefId,
} from '../domain/scoringSession';
import {
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { validateActionPlaySemantics } from '../domain/playLegality';
import { actionLikeNeedsPlayBase, actionLikeNeedsPlayMinion } from '../domain/utils';
import {
    registerTitanSpecialValidator,
    registerTitanOngoingActivationValidator,
    registerTitanTalentValidator,
} from '../domain/titanAbilityValidators';
import type {
    ActionCardDef,
    ActionPlayedEvent,
    CardInstance,
    CardTransferredEvent,
    CardsDrawnEvent,
    MadnessDrawnEvent,
    MinionCardDef,
    PowerCounterAddedEvent,
    SmashUpCore,
    SmashUpEvent,
    TitanState,
    TitanPowerCounterAddedEvent,
} from '../domain/types';
import { MADNESS_CARD_DEF_ID, SU_EVENTS } from '../domain/types';
import { getPlayerLabel } from '../domain/utils';

type ScoringTitanMoveCandidate = {
    titanUid: string;
    titanDefId: string;
    controllerId: string;
    fromBaseIndex: number;
};

type ScoringTitanMoveContinuation = {
    titanUid: string;
    titanDefId: string;
    fromBaseIndex: number;
    scoringBaseIndex: number;
    scoringBaseDefId: string;
    remaining: ScoringTitanMoveCandidate[];
};

function buildScoringTitanMoveInteraction(args: {
    sourceId: 'titan_mega_troopers_megabot_move' | 'titan_tornados_category_5_move';
    id: string;
    playerId: string;
    title: string;
    titleKey: string;
    titleNameKey: string;
    state: SmashUpCore;
    source: ScoringTitanMoveCandidate;
    scoringBaseIndex: number;
    scoringBaseDefId: string;
    remaining: ScoringTitanMoveCandidate[];
    now: number;
}) {
    const interaction = createSimpleChoice(
        args.id,
        args.playerId,
        args.title,
        [
            ...buildFieldSourceToBaseTargetOptions(
                {
                    type: 'titan',
                    uid: args.source.titanUid,
                    defId: args.source.titanDefId,
                    fromBaseIndex: args.source.fromBaseIndex,
                },
                [{
                    baseIndex: args.scoringBaseIndex,
                    label: getBaseDef(args.scoringBaseDefId)?.name ?? `基地 ${args.scoringBaseIndex + 1}`,
                }],
                args.state,
                { move: true as const },
            ),
            { id: 'stay', label: '留在原地', labelKey: 'ui.stay_here', value: { move: false }, displayMode: 'button' as const },
        ],
        buildFieldSourceTargetPromptConfig({
            sourceId: args.sourceId,
            titleKey: args.titleKey,
            titleParams: {
                name: args.titleNameKey,
                baseName: `cards.${args.scoringBaseDefId}.name`,
            },
        }),
    );
    (interaction.data as { continuationContext?: ScoringTitanMoveContinuation }).continuationContext = {
        titanUid: args.source.titanUid,
        titanDefId: args.source.titanDefId,
        fromBaseIndex: args.source.fromBaseIndex,
        scoringBaseIndex: args.scoringBaseIndex,
        scoringBaseDefId: args.scoringBaseDefId,
        remaining: args.remaining,
    };
    return interaction;
}

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
            label: getBaseDef(base.defId)?.name ?? `基地 ${index + 1}`,
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

function getControlledSetAsideTitan(state: AbilityContext['state'], playerId: string, defId: string) {
    return (state.titans ?? []).find(candidate =>
        candidate.defId === defId
        && candidate.controllerId === playerId
        && candidate.location.zone === 'setaside',
    );
}

function getQueuedSetAsideTitanForSourceController(ctx: TriggerContext, defId: string) {
    const sourceTitan = ctx.sourceCardUid ? getTitanByUid(ctx.state, ctx.sourceCardUid) : undefined;
    if (sourceTitan?.defId === defId && sourceTitan.location.zone === 'setaside') {
        return sourceTitan;
    }

    const controllerId = ctx.sourceControllerId ?? ctx.playerId;
    return (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === defId
        && candidate.controllerId === controllerId
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

function getLiveHillTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: { titanUid?: string; titanBaseIndex?: number },
): { titanUid?: string; titanBaseIndex: number } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'ignobles_the_hill_that_strolls'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            ? { titanUid: titan.uid, titanBaseIndex: titan.location.baseIndex }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'ignobles_the_hill_that_strolls', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanBaseIndex: liveTitan.location.baseIndex };
    }

    return continuation?.titanBaseIndex !== undefined
        ? { titanBaseIndex: continuation.titanBaseIndex }
        : undefined;
}

function getLiveWalkingCastleTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: {
        titanUid?: string;
        titanDefId?: string;
        fromBaseIndex?: number;
    },
): { titanUid?: string; titanDefId: string; fromBaseIndex: number } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'magical_girls_walking_castle'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            && (continuation.fromBaseIndex === undefined || titan.location.baseIndex === continuation.fromBaseIndex)
            ? { titanUid: titan.uid, titanDefId: titan.defId, fromBaseIndex: titan.location.baseIndex }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'magical_girls_walking_castle', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanDefId: liveTitan.defId, fromBaseIndex: liveTitan.location.baseIndex };
    }

    return continuation?.titanDefId && continuation.fromBaseIndex !== undefined
        ? { titanDefId: continuation.titanDefId, fromBaseIndex: continuation.fromBaseIndex }
        : undefined;
}

function getLiveMergaconTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: {
        titanUid?: string;
        titanDefId?: string;
        fromBaseIndex?: number;
    },
): { titanUid?: string; titanDefId: string; fromBaseIndex: number } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'changerbots_mergacon'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            && (continuation.fromBaseIndex === undefined || titan.location.baseIndex === continuation.fromBaseIndex)
            ? { titanUid: titan.uid, titanDefId: titan.defId, fromBaseIndex: titan.location.baseIndex }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'changerbots_mergacon', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanDefId: liveTitan.defId, fromBaseIndex: liveTitan.location.baseIndex };
    }

    return continuation?.titanDefId && continuation.fromBaseIndex !== undefined
        ? { titanDefId: continuation.titanDefId, fromBaseIndex: continuation.fromBaseIndex }
        : undefined;
}

function getLiveRainborocTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: {
        titanUid?: string;
        titanDefId?: string;
        fromBaseIndex?: number;
    },
): { titanUid?: string; titanDefId: string; fromBaseIndex: number } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'itty_critters_rainboroc'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            && (continuation.fromBaseIndex === undefined || titan.location.baseIndex === continuation.fromBaseIndex)
            ? { titanUid: titan.uid, titanDefId: titan.defId, fromBaseIndex: titan.location.baseIndex }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'itty_critters_rainboroc', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanDefId: liveTitan.defId, fromBaseIndex: liveTitan.location.baseIndex };
    }

    return continuation?.titanDefId && continuation.fromBaseIndex !== undefined
        ? { titanDefId: continuation.titanDefId, fromBaseIndex: continuation.fromBaseIndex }
        : undefined;
}

function getLiveMoonZeroThreeTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: {
        titanUid?: string;
        titanDefId?: string;
    },
): { titanUid?: string; titanDefId: string } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'super_spies_moon_zero_three'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            ? { titanUid: titan.uid, titanDefId: titan.defId }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'super_spies_moon_zero_three', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanDefId: liveTitan.defId };
    }

    return continuation?.titanDefId
        ? { titanDefId: continuation.titanDefId }
        : undefined;
}

function getLiveCthulhuTitanTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: {
        titanUid?: string;
        titanDefId?: string;
    },
): { titanUid?: string; titanDefId: string } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'cthulhu_cthulhu_titan'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            ? { titanUid: titan.uid, titanDefId: titan.defId }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'cthulhu_cthulhu_titan', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanDefId: liveTitan.defId };
    }

    return continuation?.titanDefId
        ? { titanDefId: continuation.titanDefId }
        : undefined;
}

function getLiveGreatWolfSpiritTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: {
        titanUid?: string;
        titanDefId?: string;
    },
): { titanUid?: string; titanDefId: string } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'werewolves_great_wolf_spirit'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            ? { titanUid: titan.uid, titanDefId: titan.defId }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'werewolves_great_wolf_spirit', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanDefId: liveTitan.defId };
    }

    return continuation?.titanDefId
        ? { titanDefId: continuation.titanDefId }
        : undefined;
}

function getLiveAncientLordTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: {
        titanUid?: string;
        titanDefId?: string;
    },
): { titanUid?: string; titanDefId: string } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'vampires_ancient_lord'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            ? { titanUid: titan.uid, titanDefId: titan.defId }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'vampires_ancient_lord', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanDefId: liveTitan.defId };
    }

    return continuation?.titanDefId
        ? { titanDefId: continuation.titanDefId }
        : undefined;
}

function getLiveKrakenTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: {
        titanUid?: string;
        titanDefId?: string;
        fromBaseIndex?: number;
    },
): { titanUid?: string; titanDefId: string; fromBaseIndex: number } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'pirates_the_kraken'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            && (continuation.fromBaseIndex === undefined || titan.location.baseIndex === continuation.fromBaseIndex)
            ? { titanUid: titan.uid, titanDefId: titan.defId, fromBaseIndex: titan.location.baseIndex }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'pirates_the_kraken', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanDefId: liveTitan.defId, fromBaseIndex: liveTitan.location.baseIndex };
    }

    return continuation?.titanDefId && continuation.fromBaseIndex !== undefined
        ? { titanDefId: continuation.titanDefId, fromBaseIndex: continuation.fromBaseIndex }
        : undefined;
}

function getLiveBigFunnyGiantTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: {
        titanUid?: string;
        titanDefId?: string;
        fromBaseIndex?: number;
    },
): { titanUid?: string; titanDefId: string; fromBaseIndex: number } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'tricksters_big_funny_giant'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            && (continuation.fromBaseIndex === undefined || titan.location.baseIndex === continuation.fromBaseIndex)
            ? { titanUid: titan.uid, titanDefId: titan.defId, fromBaseIndex: titan.location.baseIndex }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'tricksters_big_funny_giant', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanDefId: liveTitan.defId, fromBaseIndex: liveTitan.location.baseIndex };
    }

    return continuation?.titanDefId && continuation.fromBaseIndex !== undefined
        ? { titanDefId: continuation.titanDefId, fromBaseIndex: continuation.fromBaseIndex }
        : undefined;
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

type CreampuffActionTargetMode = 'none' | 'base' | 'minion';

function getCreampuffActionTargetMode(defId: string): CreampuffActionTargetMode | undefined {
    const def = getCardDef(defId) as ActionCardDef | undefined;
    if (!def || def.type !== 'action' || def.subtype !== 'standard') return undefined;
    if (actionLikeNeedsPlayMinion(def)) return 'minion';
    if (actionLikeNeedsPlayBase(def)) return 'base';
    return 'none';
}

function buildCreampuffActionTargetOptions(
    state: SmashUpCore,
    playerId: string,
    card: { uid: string; defId: string },
    effectiveHandSize: number,
): PromptOption<{ cardUid: string; defId: string; targetBaseIndex?: number; targetMinionUid?: string }>[] {
    const mode = getCreampuffActionTargetMode(card.defId);
    if (!mode) return [];

    if (mode === 'none') {
        return validateActionPlaySemantics(state, playerId, {
            defId: card.defId,
            effectiveHandSize,
        }).valid
            ? [{
                id: 'play',
                label: '直接打出',
                labelKey: 'ui.titan_creampuff_man_play_direct_option',
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'button' as const,
            }]
            : [];
    }

    if (mode === 'base') {
        return state.bases
            .map((base, targetBaseIndex) => ({ base, targetBaseIndex }))
            .filter(({ targetBaseIndex }) => validateActionPlaySemantics(state, playerId, {
                defId: card.defId,
                targetBaseIndex,
                effectiveHandSize,
            }).valid)
            .map(({ base, targetBaseIndex }) => ({
                id: `base-${targetBaseIndex}`,
                label: getBaseDef(base.defId)?.name ?? base.defId,
                value: { cardUid: card.uid, defId: card.defId, targetBaseIndex },
                displayMode: 'card' as const,
            }));
    }

    return state.bases.flatMap((base, targetBaseIndex) =>
        base.minions
            .filter(minion => validateActionPlaySemantics(state, playerId, {
                defId: card.defId,
                targetBaseIndex,
                targetMinionUid: minion.uid,
                effectiveHandSize,
            }).valid)
            .map(minion => ({
                id: `minion-${minion.uid}`,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
                value: {
                    cardUid: card.uid,
                    defId: card.defId,
                    targetBaseIndex,
                    targetMinionUid: minion.uid,
                },
                displayMode: 'card' as const,
            })),
    );
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

    let total = base.ongoingActions.filter(action =>
        (((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === playerId),
    ).length;
    for (const minion of base.minions) {
        total += minion.attachedActions.filter(action =>
            (((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === playerId),
        ).length;
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
    const titanControllerId = ctx.sourceControllerId ?? ctx.playerId;
    const titan = getGorgodzollaOnBase(ctx.state, titanControllerId, ctx.baseIndex);
    if (!titan) return [];
    return [addTitanPowerCounter(titan.uid, 1, 'kaiju_gorgodzolla', ctx.now)];
}

function kaijuGorgodzollaOnActionPlayed(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (ctx.baseIndex === undefined) return [];
    const titanControllerId = ctx.sourceControllerId ?? ctx.playerId;
    const titan = getGorgodzollaOnBase(ctx.state, titanControllerId, ctx.baseIndex);
    if (!titan) return [];

    const events: SmashUpEvent[] = [
        addTitanPowerCounter(titan.uid, 1, 'kaiju_gorgodzolla', ctx.now),
    ];
    const player = ctx.state.players[titanControllerId];
    const canDraw = ((player?.deck.length ?? 0) + (player?.discard.length ?? 0)) > 0;
    if (!ctx.matchState || !canDraw) {
        return events;
    }

    const interaction = createSimpleChoice(
        `titan_kaiju_gorgodzolla_draw_${titan.uid}_${ctx.now}`,
        titanControllerId,
        '哥佐拉：你可以抽 1 张牌',
        [
            {
                id: 'draw',
                label: '抽 1 张牌',
                labelKey: 'ui.titan_gorgodzolla_draw_option',
                value: { draw: true },
                displayMode: 'button' as const,
            },
            createSkipOption(),
        ],
        {
            sourceId: 'titan_kaiju_gorgodzolla_draw',
            targetType: 'button',
            titleKey: 'ui.titan_gorgodzolla_draw_title',
        },
    );
    (interaction.data as {
        continuationContext?: { titanUid?: string; titanBaseIndex?: number };
    }).continuationContext = {
        titanUid: titan.uid,
        titanBaseIndex: ctx.baseIndex,
    };

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

    const titanControllerId = ctx.sourceControllerId ?? ctx.playerId;
    const titan = getVeryLargeBoulderOnBase(ctx.state, titanControllerId, ctx.moveFromBaseIndex);
    if (!titan) return [];
    if (!ctx.matchState) return [];

    const destinationBase = ctx.state.bases[ctx.moveToBaseIndex];
    const interaction = createSimpleChoice(
        `titan_explorers_very_large_boulder_move_${titan.uid}_${ctx.now}`,
        titan.controllerId,
        'ui.titan_very_large_boulder_move_title',
        [
            { id: 'move', label: '移动到该基地', labelKey: 'ui.move_there', value: { move: true }, displayMode: 'button' as const },
            { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { move: false }, displayMode: 'button' as const },
        ],
        {
            sourceId: 'titan_explorers_very_large_boulder_move',
            targetType: 'button',
            titleKey: 'ui.titan_very_large_boulder_move_title',
            titleParams: {
                name: 'cards.explorers_very_large_boulder.name',
                baseName: destinationBase?.defId ? `cards.${destinationBase.defId}.name` : `基地 ${ctx.moveToBaseIndex + 1}`,
            },
        },
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
    const titan = ctx.sourceCardUid
        ? getTitanByUid(ctx.state, ctx.sourceCardUid)
        : (ctx.state.titans ?? []).find(candidate =>
            candidate.defId === 'explorers_very_large_boulder'
            && candidate.controllerId === ctx.playerId
            && candidate.location.zone === 'base',
        );
    if (!titan) return [];
    if (titan.defId !== 'explorers_very_large_boulder' || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return [];
    }
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
        {
            sourceId: 'titan_magical_girls_walking_castle_choose_base',
            targetType: 'base',
            titleKey: 'ui.titan_walking_castle_choose_base_title',
        },
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
        '移动城堡：选择最多 3 个你的随从随之移动',
        buildMinionTargetOptions(ownedMinions, { state, sourcePlayerId: playerId, effectType: 'move' }),
        {
            sourceId: 'titan_magical_girls_walking_castle_choose_minions',
            targetType: 'minion',
            titleKey: 'ui.titan_walking_castle_choose_minions_title',
        },
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
    continuationContext?: { titanUid?: string; titanBaseIndex?: number },
) {
    const targets = getHillGiveControlTargets(state, playerId);
    if (targets.length === 0) return undefined;

    const interaction = createSimpleChoice(
        `titan_ignobles_the_hill_that_strolls_give_minion_${now}`,
        playerId,
        '移动的山：选择一个你的随从送出',
        buildMinionTargetOptions(targets, { state, sourcePlayerId: playerId, effectType: 'affect' }),
        {
            sourceId: 'titan_ignobles_the_hill_that_strolls_give_minion',
            targetType: 'minion',
            titleKey: 'ui.titan_hill_that_strolls_give_minion_title',
        },
    );
    if (continuationContext) {
        (interaction.data as { continuationContext?: unknown }).continuationContext = continuationContext;
    }
    return queueInteraction(matchState, interaction);
}

function queueHillReclaimMinionInteraction(
    matchState: AbilityContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    now: number,
    titanBaseIndex: number,
    continuationContext?: { titanUid?: string; titanBaseIndex?: number },
) {
    const targets = getHillOwnedMinionsControlledByOthers(state, playerId, titanBaseIndex);
    if (targets.length === 0) return undefined;

    const interaction = createSimpleChoice(
        `titan_ignobles_the_hill_that_strolls_reclaim_minion_${now}`,
        playerId,
        '移动的山：选择此处一个你的随从取回',
        buildMinionTargetOptions(targets, { state, sourcePlayerId: playerId, effectType: 'affect' }),
        {
            sourceId: 'titan_ignobles_the_hill_that_strolls_reclaim_minion',
            targetType: 'minion',
            titleKey: 'ui.titan_hill_that_strolls_reclaim_minion_title',
        },
    );
    if (continuationContext) {
        (interaction.data as { continuationContext?: unknown }).continuationContext = continuationContext;
    }
    return queueInteraction(matchState, interaction);
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
    const titanControllerId = ctx.sourceControllerId ?? ctx.playerId;
    if (ctx.triggerMinion.owner !== titanControllerId || ctx.triggerMinion.controller === titanControllerId) {
        return [];
    }
    const titan = ctx.sourceCardUid
        ? getTitanByUid(ctx.state, ctx.sourceCardUid)
        : getControlledTitanOnBase(ctx.state, 'ignobles_the_hill_that_strolls', titanControllerId);
    if (
        !titan
        || titan.defId !== 'ignobles_the_hill_that_strolls'
        || titan.location.zone !== 'base'
        || titan.controllerId !== titanControllerId
    ) {
        return [];
    }

    const interaction = createSimpleChoice(
        `titan_ignobles_the_hill_that_strolls_counter_${ctx.now}`,
        titanControllerId,
        '移动的山：要在该随从上放置 1 枚 +1 战力标记吗？',
        [
            { id: 'place', label: '放置标记', labelKey: 'ui.place_counter', value: { place: true }, displayMode: 'button' as const },
            { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
        ],
        {
            sourceId: 'titan_ignobles_the_hill_that_strolls_counter',
            targetType: 'button',
            titleKey: 'ui.titan_hill_that_strolls_counter_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanBaseIndex: titan.location.baseIndex,
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
        const nextState = queueHillGiveMinionInteraction(ctx.matchState, ctx.state, ctx.playerId, ctx.now, {
            titanUid: titan.uid,
            titanBaseIndex: titan.location.baseIndex,
        });
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
            {
                titanUid: titan.uid,
                titanBaseIndex: titan.location.baseIndex,
            },
        );
        return nextState
            ? { events: [], matchState: nextState }
            : { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_ignobles_the_hill_that_strolls_choose_branch_${ctx.now}`,
        ctx.playerId,
        '移动的山：选择天赋效果',
        [
            { id: 'give', label: 'Give one away and draw 1', labelKey: 'ui.titan_hill_that_strolls_give_option', value: { branch: 'give' }, displayMode: 'button' as const },
            { id: 'reclaim', label: 'Reclaim one here', labelKey: 'ui.titan_hill_that_strolls_reclaim_option', value: { branch: 'reclaim' }, displayMode: 'button' as const },
        ],
        {
            sourceId: 'titan_ignobles_the_hill_that_strolls_choose_branch',
            targetType: 'button',
            titleKey: 'ui.titan_hill_that_strolls_branch_title',
        },
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
    const interaction = buildScoringTitanMoveInteraction({
        sourceId: 'titan_mega_troopers_megabot_move',
        id: `titan_mega_troopers_megabot_move_${first.titanUid}_${ctx.now}`,
        playerId: first.controllerId,
        title: 'ui.titan_megabot_move_title',
        titleKey: 'ui.titan_megabot_move_title',
        titleNameKey: 'cards.mega_troopers_megabot.name',
        state: ctx.state,
        source: first,
        scoringBaseIndex,
        scoringBaseDefId: scoringBase.defId,
        remaining,
        now: ctx.now,
    });

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
        if (buildCreampuffActionTargetOptions(core, ctx.playerId, card, ctx.effectiveHandSize).length === 0) {
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

function resolveCreampuffActionPlay(params: {
    state: MatchState<SmashUpCore>;
    playerId: string;
    cardUid: string;
    defId: string;
    random: AbilityContext['random'];
    timestamp: number;
    titanBaseIndex: number;
    targetBaseIndex?: number;
    targetMinionUid?: string;
}): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const {
        state,
        playerId,
        cardUid,
        defId,
        random,
        timestamp,
        titanBaseIndex,
        targetBaseIndex,
        targetMinionUid,
    } = params;
    const player = state.core.players[playerId];
    const actionCard = player?.discard.find(card => card.uid === cardUid && card.defId === defId);
    if (!player || !actionCard || !isStandardAction(actionCard.defId)) {
        return { state, events: [] };
    }
    const ownerId = actionCard.owner;

    const effectiveHandSize = getExternalActionEffectiveHandSize(state, playerId);
    const validation = validateActionPlaySemantics(state.core, playerId, {
        defId,
        targetBaseIndex,
        targetMinionUid,
        effectiveHandSize,
    });
    if (!validation.valid) {
        return { state, events: [] };
    }

    const events: SmashUpEvent[] = [
        recoverCardsFromDiscard(playerId, [cardUid], 'ghosts_creampuff_man_talent', timestamp),
        buildActionPlayedEvent({
            playerId,
            cardUid,
            defId,
            ownerId,
            isExtraAction: true,
            targetBaseIndex,
            targetMinionUid,
            timestamp,
        }) as SmashUpEvent,
    ];

    const result = appendResolvedActionAbility({
        state,
        events,
        playerId,
        cardUid,
        defId,
        random,
        timestamp,
        baseIndex: targetBaseIndex ?? titanBaseIndex,
        targetMinionUid,
        handSizeAfterPlay: state.core.players[playerId]?.hand.length ?? 0,
    });
    result.events.push({
        type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
        payload: {
            cardUid,
            defId,
            ownerId,
            ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
            reason: 'ghosts_creampuff_man_talent',
        },
        timestamp,
    } as SmashUpEvent);
    return result;
}

function getLiveCreampuffTitanBaseIndex(
    core: SmashUpCore,
    playerId: string,
    continuation?: { titanUid?: string; titanBaseIndex?: number },
): number | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'ghosts_creampuff_man'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            ? titan.location.baseIndex
            : undefined;
    }
    const liveTitan = getTitanByController(core, playerId);
    if (liveTitan?.defId === 'ghosts_creampuff_man' && liveTitan.location.zone === 'base') {
        return liveTitan.location.baseIndex;
    }
    return continuation?.titanBaseIndex;
}

function ghostsCreampuffManSpecial(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.hand.length > 0) return { events: [] };
    return playTitanFromSetAside(ctx, 'ghosts_creampuff_man_special');
}

function fairiesSpiritOfTheForestSpecial(ctx: AbilityContext): AbilityResult {
    return playTitanFromSetAside(ctx, 'fairies_spirit_of_the_forest_special');
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
        '奶油泡芙美人：弃 1 张牌',
        discardOptions,
        {
            sourceId: 'titan_ghosts_creampuff_man_discard',
            targetType: 'hand',
            titleKey: 'ui.titan_creampuff_man_discard_title',
        },
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
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanBaseIndex: titan.location.baseIndex,
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

    const events = buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
    if (events.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    }

    return { events };
}

function vampireAncientLordSpecial(ctx: AbilityContext): AbilityResult {
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
            label: `${getPlayerLabel(pid)} deck`,
        }));
}

function getEverythingGloveHighPowerMinionCount(state: AbilityContext['state'], playerId: string) {
    return state.bases.reduce((total, base, baseIndex) => total + base.minions.filter(minion =>
        minion.controller === playerId
        && getMinionPower(state, minion, baseIndex) >= 5,
    ).length, 0);
}

function everythingGloveProtectionChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const glove = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'superheroes_the_everything_glove'
        && candidate.location.zone === 'base'
        && candidate.location.baseIndex === ctx.targetBaseIndex
        && candidate.controllerId === ctx.targetMinion.controller,
    );
    return !!glove;
}

function getTimeBoxCounter(titan: TitanState | undefined) {
    return Number(titan?.metadata?.timeBoxCounters ?? 0);
}

function isTimeBoxPlayArmed(titan: TitanState | undefined): boolean {
    return titan?.metadata?.timeBoxPlayArmed === true;
}

function buildTimeBoxMetadataEvent(
    titanUid: string,
    counterCount: number,
    reason: string,
    now: number,
    options?: { armed?: boolean },
): SmashUpEvent {
    return {
        type: SU_EVENTS.TITAN_METADATA_UPDATED,
        payload: {
            titanUid,
            metadataUpdate: {
                timeBoxCounters: Math.max(0, counterCount),
                timeBoxPlayArmed: options?.armed === true,
            },
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
    promptKey: string,
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
            createSkipOption(),
        ],
        { sourceId: 'titan_time_travelers_time_box_play', targetType: 'base', autoResolveIfSingle: false, titleKey: promptKey },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
    };
    return queueInteraction(matchState, interaction);
}

function getQueuedTimeBoxPlayPromptTitan(
    core: SmashUpCore,
    playerId: string,
    continuation?: { titanUid?: string; titanDefId?: string },
): TitanState | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (
        !titan
        || !continuation?.titanDefId
        || titan.defId !== continuation.titanDefId
        || titan.controllerId !== playerId
        || titan.location.zone !== 'setaside'
        || getTimeBoxCounter(titan) < 5
        || !isTimeBoxPlayArmed(titan)
    ) {
        return undefined;
    }

    return titan;
}

function getLiveTimeBoxPlayTitan(
    core: SmashUpCore,
    playerId: string,
    continuation?: { titanUid?: string; titanDefId?: string },
): TitanState | undefined {
    const titan = getQueuedTimeBoxPlayPromptTitan(core, playerId, continuation);
    if (!titan || !canControllerPlayTitan(core, playerId, titan.uid)) {
        return undefined;
    }

    return titan;
}

function getLiveSetAsideTitanPlayPromptTitan(
    core: SmashUpCore,
    playerId: string,
    continuation?: { titanUid?: string; titanDefId?: string },
): TitanState | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (
        !titan
        || !continuation?.titanDefId
        || titan.defId !== continuation.titanDefId
        || titan.controllerId !== playerId
        || titan.location.zone !== 'setaside'
        || !canControllerPlayTitan(core, playerId, titan.uid)
    ) {
        return undefined;
    }

    return titan;
}

function getLiveControlledBaseTitan(
    core: SmashUpCore,
    playerId: string,
    continuation?: { titanUid?: string; titanDefId?: string },
): TitanState | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (
        !titan
        || !continuation?.titanDefId
        || titan.defId !== continuation.titanDefId
        || titan.controllerId !== playerId
        || titan.location.zone !== 'base'
    ) {
        return undefined;
    }

    return titan;
}

function hasPendingInteractionSource(
    matchState: MatchState<SmashUpCore> | undefined,
    sourceId: string,
): boolean {
    if (!matchState) return false;

    const currentSourceId = (matchState.sys.interaction.current?.data as { sourceId?: string } | undefined)?.sourceId;
    if (currentSourceId === sourceId) {
        return true;
    }

    return matchState.sys.interaction.queue.some((interaction) =>
        (interaction.data as { sourceId?: string } | undefined)?.sourceId === sourceId,
    );
}

function buildTimeBoxCounterProgress(ctx: TriggerContext, reason: string): TriggerResult | SmashUpEvent[] {
    const titan = getQueuedSetAsideTitanForSourceController(ctx, 'time_travelers_time_box');
    if (!titan) return [];

    const currentCounter = getTimeBoxCounter(titan);
    const nextCounter = currentCounter + 1;
    const events: SmashUpEvent[] = [
        buildTimeBoxMetadataEvent(titan.uid, nextCounter, reason, ctx.now, {
            armed: nextCounter >= 5,
        }),
    ];

    if (nextCounter >= 5) {
        const nextMatchState = queueTimeBoxPlayInteraction(
            ctx.matchState,
            ctx.state,
            ctx.playerId,
            titan,
            ctx.now,
            '时间盒子：是否移除全部计数器并打出到一个基地？',
            'ui.time_travelers_time_box_play_title',
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
    if (!titan || titan.location.zone !== 'setaside' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }
    if (getTimeBoxCounter(titan) < 5) {
        return { events: [] };
    }

    return {
        events: [
            buildTimeBoxMetadataEvent(titan.uid, 0, 'time_travelers_time_box_special', ctx.now, {
                armed: false,
            }),
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

function getHelicoprionCounter(titan: TitanState | undefined) {
    return Number(titan?.metadata?.helicoprionCounters ?? 0);
}

function buildHelicoprionMetadataEvent(
    titanUid: string,
    counterCount: number,
    reason: string,
    now: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.TITAN_METADATA_UPDATED,
        payload: {
            titanUid,
            metadataUpdate: {
                helicoprionCounters: Math.max(0, counterCount),
            },
            reason,
        },
        timestamp: now,
    };
}

function queueHelicoprionPlayInteraction(
    matchState: AbilityContext['matchState'] | TriggerContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    titan: TitanState,
    now: number,
) {
    if (!matchState || !canControllerPlayTitan(state, playerId, titan.uid)) return undefined;
    const baseOptions = buildBaseTargetOptions(
        state.bases.map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        })),
        state,
    );
    if (baseOptions.length === 0) return undefined;

    const interaction = createSimpleChoice(
        `titan_sharks_helicoprion_play_${now}`,
        playerId,
        '旋齿鲨：是否移除全部计数器并打出到一个基地？',
        [
            ...baseOptions,
            createSkipOption(),
        ],
        {
            sourceId: 'titan_sharks_helicoprion_play',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.titan_helicoprion_play_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
    };
    return queueInteraction(matchState, interaction);
}

function buildHelicoprionCounterProgress(ctx: TriggerContext, reason: string): TriggerResult | SmashUpEvent[] {
    const titan = getQueuedSetAsideTitanForSourceController(ctx, 'sharks_helicoprion');
    if (!titan) return [];

    const nextCounter = getHelicoprionCounter(titan) + 1;
    const events: SmashUpEvent[] = [
        buildHelicoprionMetadataEvent(titan.uid, nextCounter, reason, ctx.now),
    ];
    if (nextCounter < 4) {
        return { events };
    }

    const nextMatchState = queueHelicoprionPlayInteraction(
        ctx.matchState,
        ctx.state,
        ctx.playerId,
        titan,
        ctx.now,
    );
    return nextMatchState ? { events, matchState: nextMatchState } : { events };
}

function sharksHelicoprionOnTurnStart(ctx: TriggerContext) {
    return buildHelicoprionCounterProgress(ctx, 'sharks_helicoprion_on_turn_start');
}

function getControlledHelicoprionForTrigger(ctx: TriggerContext, controllerId: string) {
    const sourceTitan = ctx.sourceCardUid ? getTitanByUid(ctx.state, ctx.sourceCardUid) : undefined;
    if (sourceTitan?.defId === 'sharks_helicoprion' && sourceTitan.controllerId === controllerId) {
        return sourceTitan;
    }

    return (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'sharks_helicoprion'
        && candidate.controllerId === controllerId,
    );
}

function sharksHelicoprionOnMinionDestroyed(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const controllerId = ctx.sourceControllerId ?? ctx.playerId;
    const titan = getControlledHelicoprionForTrigger(ctx, controllerId);
    if (!titan) return [];

    if (titan.location.zone === 'setaside') {
        return buildHelicoprionCounterProgress({
            ...ctx,
            sourceCardUid: titan.uid,
            sourceControllerId: controllerId,
        }, 'sharks_helicoprion_on_minion_destroyed');
    }

    return sharksHelicoprionOnMinionDestroyedReward({
        ...ctx,
        sourceCardUid: titan.uid,
        sourceControllerId: controllerId,
    });
}

function sharksHelicoprionSpecial(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'setaside' || getHelicoprionCounter(titan) < 4) {
        return { events: [] };
    }

    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };

    return {
        events: [
            buildHelicoprionMetadataEvent(titan.uid, 0, 'sharks_helicoprion_special', ctx.now),
            playTitan(
                titan,
                ctx.playerId,
                ctx.baseIndex,
                'sharks_helicoprion_special',
                ctx.now,
                base.defId,
            ),
        ],
    };
}

function sharksHelicoprionTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    return {
        events: [grantExtraMinion(ctx.playerId, 'sharks_helicoprion_talent', ctx.now, ctx.baseIndex)],
    };
}

function getHelicoprionMakoChoices(state: AbilityContext['state'], playerId: string) {
    const player = state.players[playerId];
    if (!player) return [];

    return [
        ...player.deck
            .filter(card => card.defId === 'sharks_mako')
            .map(card => ({
                cardUid: card.uid,
                defId: card.defId,
                sourceZone: 'deck' as const,
                label: `${getCardDef(card.defId)?.name ?? card.defId}（牌库）`,
            })),
        ...player.discard
            .filter(card => card.defId === 'sharks_mako')
            .map(card => ({
                cardUid: card.uid,
                defId: card.defId,
                sourceZone: 'discard' as const,
                label: `${getCardDef(card.defId)?.name ?? card.defId}（弃牌堆）`,
            })),
    ];
}

function sharksHelicoprionOnMinionDestroyedReward(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || ctx.baseIndex === undefined) return [];

    const controllerId = ctx.sourceControllerId ?? ctx.playerId;
    const currentPlayerId = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
    if (currentPlayerId === controllerId) return [];
    if (ctx.destroyerId === undefined) return [];
    if (ctx.destroyerId === controllerId) return [];

    const titan = getControlledTitanOnBase(ctx.state, 'sharks_helicoprion', controllerId);
    if (
        !titan
        || titan.defId !== 'sharks_helicoprion'
        || titan.location.zone !== 'base'
        || titan.location.baseIndex !== ctx.baseIndex
        || titan.controllerId !== controllerId
    ) {
        return [];
    }

    const makoChoices = getHelicoprionMakoChoices(ctx.state, controllerId);
    const canDraw = ((ctx.state.players[controllerId]?.deck.length ?? 0) + (ctx.state.players[controllerId]?.discard.length ?? 0)) > 0;
    if (makoChoices.length === 0 && !canDraw) {
        return [];
    }

    const interaction = createSimpleChoice(
        `titan_sharks_helicoprion_reward_${titan.uid}_${ctx.now}`,
        controllerId,
        '旋齿鲨：选择把 1 张鲭鲨拿回手牌，或抽 1 张牌',
        [
            ...makoChoices.map(option => ({
                id: `${option.sourceZone}-${option.cardUid}`,
                label: option.label,
                value: {
                    action: 'take_mako',
                    cardUid: option.cardUid,
                    defId: option.defId,
                    sourceZone: option.sourceZone,
                },
                displayMode: 'card' as const,
            })),
            ...(canDraw
                ? [{
                    id: 'draw',
                    label: '抽 1 张牌',
                    labelKey: 'ui.titan_helicoprion_reward_draw_option',
                    value: { action: 'draw' },
                    displayMode: 'button' as const,
                }]
                : []),
            createSkipOption(),
        ],
        {
            sourceId: 'titan_sharks_helicoprion_reward',
            targetType: 'generic',
            titleKey: 'ui.titan_helicoprion_reward_title',
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function superheroesTheEverythingGloveSpecial(ctx: AbilityContext): AbilityResult {
    if (getEverythingGloveHighPowerMinionCount(ctx.state, ctx.playerId) < 3) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'superheroes_the_everything_glove_special');
}

function superheroesTheEverythingGloveTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    return {
        events: [
            grantExtraMinion(ctx.playerId, 'superheroes_the_everything_glove_talent', ctx.now, ctx.baseIndex, { powerMax: 2 }),
            grantExtraAction(ctx.playerId, 'superheroes_the_everything_glove_talent', ctx.now),
        ],
    };
}

function tornadosCategory5Special(ctx: AbilityContext): AbilityResult {
    if ((ctx.state.minionMovesThisTurnByPlayer?.[ctx.playerId] ?? 0) < 2) {
        return { events: [] };
    }
    return playTitanFromSetAside(ctx, 'tornados_category_5_special');
}

function tornadosCategory5OnMinionMoved(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState) return [];

    const controllerId = ctx.sourceControllerId ?? ctx.playerId;
    if (ctx.state.turnOrder[ctx.state.currentPlayerIndex] !== controllerId) return [];
    if ((ctx.state.minionMovesThisTurnByPlayer?.[controllerId] ?? 0) < 2) return [];
    if (getTitanByController(ctx.state, controllerId)) return [];

    const titan = getQueuedSetAsideTitanForSourceController(ctx, 'tornados_category_5');
    if (!titan || !canControllerPlayTitan(ctx.state, controllerId, titan.uid)) return [];
    if (hasPendingInteractionSource(ctx.matchState, 'titan_tornados_category_5_play')) return [];

    const baseOptions = buildBaseTargetOptions(
        ctx.state.bases.map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        })),
        ctx.state,
    );
    if (baseOptions.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_tornados_category_5_play_${ctx.now}`,
        controllerId,
        '五级风暴：选择要进场的基地',
        [
            ...baseOptions,
            createSkipOption(),
        ],
        {
            sourceId: 'titan_tornados_category_5_play',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.titan_category_5_play_title',
        },
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

function tornadosCategory5BeforeScoring(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const scoringBaseIndex = ctx.baseIndex;
    if (scoringBaseIndex === undefined) return [];

    const scoringBase = ctx.state.bases[scoringBaseIndex];
    if (!scoringBase) return [];

    const category5Titans = (ctx.state.titans ?? [])
        .filter((titan): titan is TitanState & { location: { zone: 'base'; baseIndex: number; enteredAt: number } } =>
            titan.defId === 'tornados_category_5'
            && titan.location.zone === 'base'
            && titan.location.baseIndex !== scoringBaseIndex,
        )
        .map(titan => ({
            titanUid: titan.uid,
            titanDefId: titan.defId,
            controllerId: titan.controllerId,
            fromBaseIndex: titan.location.baseIndex,
        }));
    if (category5Titans.length === 0) return [];

    if (!ctx.matchState) {
        return category5Titans.map(candidate => moveTitan(
            candidate.titanUid,
            candidate.titanDefId,
            candidate.fromBaseIndex,
            scoringBaseIndex,
            'tornados_category_5_before_scoring',
            ctx.now,
            scoringBase.defId,
        ));
    }

    const [first, ...remaining] = category5Titans;
    const interaction = buildScoringTitanMoveInteraction({
        sourceId: 'titan_tornados_category_5_move',
        id: `titan_tornados_category_5_move_${first.titanUid}_${ctx.now}`,
        playerId: first.controllerId,
        title: '五级风暴：是否移动到将要计分的基地？',
        titleKey: 'ui.titan_megabot_move_title',
        titleNameKey: 'cards.tornados_category_5.name',
        state: ctx.state,
        source: first,
        scoringBaseIndex,
        scoringBaseDefId: scoringBase.defId,
        remaining,
        now: ctx.now,
    });

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function pecosBillOnDuelStarted(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || !ctx.duel) return [];

    const challengerPlayerId = ctx.duel.challengerPlayerId;
    if (getTitanByController(ctx.state, challengerPlayerId)) return [];

    const titan = getControlledSetAsideTitan(ctx.state, challengerPlayerId, 'pecos_bill');
    const player = ctx.state.players[challengerPlayerId];
    if (!titan || !player || player.hand.length === 0) return [];

    const duelBaseIndex = ctx.baseIndex ?? ctx.duel.baseIndex;
    const duelBase = ctx.state.bases[duelBaseIndex];
    const interaction = createSimpleChoice(
        `titan_pecos_bill_duel_start_${titan.uid}_${ctx.now}`,
        challengerPlayerId,
        'Pecos Bill：你可以弃一张牌，将此泰坦打到决斗基地',
        [
            ...player.hand.map((card) => ({
                id: `hand-${card.uid}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            })),
            { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
        ],
        {
            sourceId: 'titan_pecos_bill_duel_start',
            targetType: 'hand',
            autoRefresh: 'hand',
            titleKey: 'ui.titan_pecos_bill_duel_start_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
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

    const titan = getQueuedSetAsideTitanForSourceController(ctx, 'sphinx');
    if (!titan) return [];

    const buriedChoices = getOwnedBuriedCardChoices(ctx.state, ctx.playerId);
    if (buriedChoices.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_sphinx_start_turn_${ctx.now}`,
        ctx.playerId,
        '狮身人面像：选择一张你的埋葬牌回到手牌，并将此泰坦移至那里',
        [
            ...buriedChoices.map((choice) => ({
                id: `buried-${choice.cardUid}`,
                label: choice.label,
                value: choice,
                displayMode: 'card' as const,
            })),
            { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
        ],
        {
            sourceId: 'titan_sphinx_start_turn',
            targetType: 'generic',
            autoResolveIfSingle: false,
            titleKey: 'ui.titan_sphinx_start_turn_title',
        },
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
            '狮身人面像：你可以将此处一张你的埋葬牌移回手牌',
            [
                ...buriedChoices.map((choice) => ({
                    id: `buried-${choice.cardUid}`,
                    label: choice.label,
                    value: choice,
                    displayMode: 'card' as const,
                })),
                createSkipOption(),
            ],
            {
                sourceId: 'titan_sphinx_after_scoring',
                targetType: 'generic',
                titleKey: 'ui.titan_sphinx_after_scoring_title',
            },
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
        '狮身人面像：选择一张手牌埋葬在此处',
        player.hand.map((card) => ({
            id: `hand-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'titan_sphinx_talent',
            targetType: 'hand',
            titleKey: 'ui.titan_sphinx_talent_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
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
    const titan = ctx.sourceCardUid
        ? getTitanByUid(ctx.state, ctx.sourceCardUid)
        : getControlledTitanOnBase(ctx.state, 'super_spies_moon_zero_three', ctx.playerId);
    if (!titan) return [];
    if (titan.defId !== 'super_spies_moon_zero_three' || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return [];
    }
    if ((ctx.state.moonZeroThreeTriggeredTurnByTitan ?? {})[titan.uid] === ctx.state.turnNumber) {
        return [];
    }
    const nextMatchState = ctx.matchState
        ? {
            ...ctx.matchState,
            core: {
                ...ctx.matchState.core,
                moonZeroThreeTriggeredTurnByTitan: {
                    ...(ctx.matchState.core.moonZeroThreeTriggeredTurnByTitan ?? {}),
                    [titan.uid]: ctx.matchState.core.turnNumber,
                },
            },
        }
        : undefined;
    return {
        events: [addTitanPowerCounter(titan.uid, 1, 'super_spies_moon_zero_three_on_deck_inspected', ctx.now)],
        ...(nextMatchState ? { matchState: nextMatchState } : {}),
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
        buildPlayerTargetOptions(
            playerOptions.map((option, index) => ({
                id: `player-${index}`,
                label: option.label,
                targetPlayerId: option.targetPlayerId,
                displayMode: 'button' as const,
            })),
            {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                effectIntent: 'inspect',
            },
        ),
        {
            sourceId: 'titan_super_spies_moon_zero_three_choose_player',
            targetType: 'player',
            titleKey: 'ui.titan_moon_zero_three_choose_player_title',
        },
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

    const titan = getQueuedSetAsideTitanForSourceController(ctx, 'penguins_emperor_penguin');
    if (!titan) return [];

    const baseOptions = buildBaseTargetOptions(getEmperorPenguinEligibleBases(ctx.state, ctx.playerId), ctx.state);
    if (baseOptions.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_penguins_emperor_penguin_play_${ctx.now}`,
        ctx.playerId,
        '企鹅帝皇：选择要进场的基地',
        [
            ...baseOptions,
            createSkipOption(),
        ],
        {
            sourceId: 'titan_penguins_emperor_penguin_play',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.titan_emperor_penguin_play_title',
        },
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
        '企鹅皇帝：选择一个低战力随从洗入牌库',
        options.map(option => ({
            id: option.cardUid,
            label: option.label,
            value: { cardUid: option.cardUid, defId: option.defId, zone: option.zone },
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'titan_penguins_emperor_penguin_talent',
            targetType: 'generic',
            titleKey: 'ui.titan_emperor_penguin_talent_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function changerbotsMergaconOnTurnStart(ctx: TriggerContext) {
    if (getTitanByController(ctx.state, ctx.playerId)) return [];
    if (!ctx.matchState) return [];

    const titan = getQueuedSetAsideTitanForSourceController(ctx, 'changerbots_mergacon');
    if (!titan) return [];

    const baseOptions = buildBaseTargetOptions(getMergaconEligibleBases(ctx.state, ctx.playerId), ctx.state);
    if (baseOptions.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_changerbots_mergacon_play_${ctx.now}`,
        ctx.playerId,
        '合体机器人：选择要进场的基地',
        [
            ...baseOptions,
            createSkipOption(),
        ],
        {
            sourceId: 'titan_changerbots_mergacon_play',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.titan_mergacon_play_title',
        },
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

    return buildPlayerTargetOptions<{ madnessUid: string }>(
        state.turnOrder
            .filter(pid => pid !== playerId)
            .filter(pid => Boolean(state.players[pid]))
            .map(pid => ({
                id: `player-${pid}`,
                label: getPlayerLabel(pid),
                targetPlayerId: pid,
                value: { madnessUid: madnessCard.uid },
                displayMode: 'button' as const,
            })),
        {
            sourcePlayerId: playerId,
            effectIntent: 'debuff',
        },
    );
}

function queueCthulhuTitanTransferInteraction(
    matchState: AbilityContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    now: number,
    continuation?: {
        titanUid?: string;
        titanDefId?: string;
    },
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
    (interaction.data as { continuationContext?: unknown }).continuationContext = continuation;
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
        const nextMatchState = queueCthulhuTitanTransferInteraction(
            ctx.matchState,
            ctx.state,
            ctx.playerId,
            ctx.now,
            { titanUid: titan.uid, titanDefId: titan.defId },
        );
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
                labelKey: 'ui.titan_cthulhu_talent_draw_madness_option',
                value: { choice: 'draw' },
                displayMode: 'button' as const,
            },
            {
                id: 'give',
                label: '给另一位玩家一张疯狂卡',
                labelKey: 'ui.titan_cthulhu_talent_give_madness_option',
                value: { choice: 'give' },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'titan_cthulhu_cthulhu_titan_talent_choice',
            targetType: 'button',
            titleKey: 'ui.titan_cthulhu_talent_title',
        },
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

function getEligibleKrakenSetAsideTitans(
    state: AbilityContext['state'],
    scoringBaseIndex: number,
    triggerBaseControllersAtTrigger?: readonly string[],
) {
    const base = state.bases[scoringBaseIndex];
    if (!base) return [];
    const eligibleControllers = triggerBaseControllersAtTrigger?.length
        ? new Set(triggerBaseControllersAtTrigger)
        : new Set(base.minions.map(minion => minion.controller));
    return (state.titans ?? []).filter(titan =>
        titan.defId === 'pirates_the_kraken'
        && titan.location.zone === 'setaside'
        && eligibleControllers.has(titan.controllerId)
        && !getTitanByController(state, titan.controllerId),
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

function getGreatWolfSpiritMoveOptions(
    state: AbilityContext['state'],
    playerId: string,
    currentBaseIndex: number,
) {
    return state.bases
        .map((base, baseIndex) => {
            if (baseIndex === currentBaseIndex) return null;
            const myPower = getPlayerEffectivePowerOnBase(state, base, baseIndex, playerId);
            if (myPower <= 0) return null;
            const hasStrictlyMostPower = Object.keys(state.players).every(pid => {
                if (pid === playerId) return true;
                return getPlayerEffectivePowerOnBase(state, base, baseIndex, pid) < myPower;
            });
            if (!hasStrictlyMostPower) return null;
            return {
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `Base ${baseIndex + 1}`,
            };
        })
        .filter((value): value is { baseIndex: number; label: string } => value !== null);
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
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
        return { events: [] };
    }

    const interaction = createSimpleChoice(
        `titan_werewolves_great_wolf_spirit_talent_${ctx.now}`,
        ctx.playerId,
        '巨狼之灵：选择一个你的随从获得 +1 战力直到回合结束',
        buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, sourceDefId: ctx.defId, effectType: 'buff' }),
        {
            sourceId: 'titan_werewolves_great_wolf_spirit_talent',
            targetType: 'minion',
            titleKey: 'ui.titan_great_wolf_spirit_talent_title',
        },
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

function werewolvesGreatWolfSpiritOnTurnStart(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState) return [];

    const titanControllerId = ctx.sourceControllerId ?? ctx.playerId;
    const titan = (() => {
        const sourceTitan = ctx.sourceCardUid ? getTitanByUid(ctx.state, ctx.sourceCardUid) : undefined;
        if (
            sourceTitan?.defId === 'werewolves_great_wolf_spirit'
            && sourceTitan.controllerId === titanControllerId
            && sourceTitan.location.zone === 'base'
        ) {
            return sourceTitan;
        }

        const liveTitans = (ctx.state.titans ?? []).filter(candidate =>
            candidate.defId === 'werewolves_great_wolf_spirit'
            && candidate.controllerId === titanControllerId
            && candidate.location.zone === 'base',
        );
        return liveTitans.find(candidate =>
            ctx.sourceBaseIndex !== undefined
            && candidate.location.baseIndex === ctx.sourceBaseIndex,
        ) ?? liveTitans[0];
    })();
    if (!titan || titan.location.zone !== 'base') return [];

    const baseOptions = getGreatWolfSpiritMoveOptions(ctx.state, titanControllerId, titan.location.baseIndex);
    if (baseOptions.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_werewolves_great_wolf_spirit_move_${ctx.now}`,
        titanControllerId,
        '巨狼之灵：你可以将此泰坦移动到一个你战力高于任何其他玩家的基地',
        [
            ...buildBaseTargetOptions(baseOptions, ctx.state),
            createSkipOption(),
        ],
        {
            sourceId: 'titan_werewolves_great_wolf_spirit_move',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.titan_great_wolf_spirit_move_title',
        },
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
        'Mergacon：选择要移动到的基地',
        buildBaseTargetOptions(baseOptions, ctx.state),
        {
            sourceId: 'titan_changerbots_mergacon_talent',
            targetType: 'base',
            titleKey: 'ui.titan_mergacon_choose_base_title',
        },
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

function isTrickstersBigFunnyGiantDefId(defId: string): boolean {
    return defId === 'tricksters_big_funny_giant' || defId === 'tricksters_big_funny_giant_pod';
}

function getBigFunnyGiantDiscardableHandCards(state: AbilityContext['state'], playerId: string, excludeCardUid?: string) {
    const player = state.players[playerId];
    if (!player) return [];
    return player.hand.filter(card => card.uid !== excludeCardUid);
}

function getBigFunnyGiantTalentTargets(state: AbilityContext['state'], baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base) return [];
    return base.minions
        .filter(minion => getMinionPower(state, minion, baseIndex) <= 2)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
}

function trickstersBigFunnyGiantOnTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    const titans = ctx.sourceCardUid
        ? (ctx.state.titans ?? []).filter(candidate =>
            candidate.uid === ctx.sourceCardUid
            && candidate.defId === 'tricksters_big_funny_giant'
            && candidate.location.zone === 'base'
            && candidate.controllerId === ctx.playerId,
        )
        : (ctx.state.titans ?? []).filter(candidate =>
            candidate.defId === 'tricksters_big_funny_giant'
            && candidate.location.zone === 'base'
            && candidate.controllerId === ctx.playerId,
        );
    if (titans.length === 0) {
        return [];
    }

    const events: SmashUpEvent[] = [];
    for (const titan of titans) {
        const base = ctx.state.bases[titan.location.baseIndex];
        if (!base) continue;

        const opponentHasMinionHere = base.minions.some(minion => minion.controller !== titan.controllerId);
        if (opponentHasMinionHere) continue;

        events.push(addTitanPowerCounter(titan.uid, 1, 'tricksters_big_funny_giant', ctx.now));
    }

    return events;
}

function findEligibleBigFunnyGiantMinionPlay(ctx: {
    state: SmashUpCore;
    playerId: string;
    baseIndex?: number;
    triggerMinionUid?: string;
    sourceCardUid?: string;
}): { titan: TitanState; discardable: CardInstance[] } | undefined {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return undefined;

    const titan = (ctx.state.titans ?? []).find(candidate =>
        isTrickstersBigFunnyGiantDefId(candidate.defId)
        && candidate.location.zone === 'base'
        && candidate.location.baseIndex === ctx.baseIndex
        && (!ctx.sourceCardUid || candidate.uid === ctx.sourceCardUid)
        && candidate.controllerId !== ctx.playerId,
    );
    if (!titan) {
        return undefined;
    }

    const discardable = getBigFunnyGiantDiscardableHandCards(ctx.state, ctx.playerId, ctx.triggerMinionUid);
    if (discardable.length === 0) {
        return undefined;
    }
    return { titan, discardable };
}

function trickstersBigFunnyGiantPodOnTurnEnd(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const titans = ctx.sourceCardUid
        ? (ctx.state.titans ?? []).filter(candidate =>
            candidate.uid === ctx.sourceCardUid
            && candidate.defId === 'tricksters_big_funny_giant_pod'
            && candidate.location.zone === 'base'
            && candidate.controllerId !== ctx.playerId,
        )
        : (ctx.state.titans ?? []).filter(candidate =>
            candidate.defId === 'tricksters_big_funny_giant_pod'
            && candidate.location.zone === 'base'
            && candidate.controllerId !== ctx.playerId,
        );
    if (titans.length === 0) {
        return [];
    }

    const eligibleTitans = titans.filter(titan => {
        const base = ctx.state.bases[titan.location.baseIndex];
        return base && !base.minions.some(minion => minion.controller === ctx.playerId);
    });
    if (eligibleTitans.length === 0) {
        return [];
    }

    if (!ctx.matchState) {
        return eligibleTitans.map(titan => addTitanPowerCounter(titan.uid, 1, 'tricksters_big_funny_giant_pod_turn_end', ctx.now));
    }

    let nextMatchState = ctx.matchState;
    for (const titan of eligibleTitans) {
        const interaction = createSimpleChoice(
            `titan_tricksters_big_funny_giant_pod_counter_${titan.uid}_${ctx.now}`,
            titan.controllerId,
            'ui.titan_tricksters_big_funny_giant_pod_counter_title',
            [
                {
                    id: 'add',
                    label: '放置 +1 指示物',
                    labelKey: 'ui.titan_big_funny_giant_pod_add_counter_option',
                    value: { add: true },
                    displayMode: 'button' as const,
                },
                { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
            ],
            {
                sourceId: 'titan_tricksters_big_funny_giant_pod_counter',
                targetType: 'button',
                titleKey: 'ui.titan_tricksters_big_funny_giant_pod_counter_title',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: titan.uid,
            titanDefId: titan.defId,
        };
        nextMatchState = queueInteraction(nextMatchState, interaction);
    }

    return { events: [], matchState: nextMatchState };
}

function trickstersBigFunnyGiantOnMinionPlayed(ctx: AbilityContext): AbilityResult | SmashUpEvent[] {
    const eligible = findEligibleBigFunnyGiantMinionPlay(ctx);
    if (!eligible) {
        return [];
    }
    const { discardable } = eligible;
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
        '滑稽巨人：选择要弃置的手牌',
        discardable.map(card => ({
            id: `discard-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
            _source: 'hand' as const,
        })),
        {
            sourceId: 'titan_tricksters_big_funny_giant_discard_to_play',
            targetType: 'hand',
            titleKey: 'ui.titan_big_funny_giant_discard_title',
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function trickstersBigFunnyGiantTalent(ctx: AbilityContext): AbilityResult {
    const titan = getTitanByUid(ctx.state, ctx.cardUid);
    if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId || !ctx.matchState) {
        return { events: [] };
    }

    const baseIndex = titan.location.baseIndex;
    const minionTargets = getBigFunnyGiantTalentTargets(ctx.state, baseIndex);
    if (minionTargets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `titan_tricksters_big_funny_giant_choose_minion_${ctx.now}`,
        ctx.playerId,
        '滑稽巨人：选择力量≤2的随从',
        buildMinionTargetOptions(minionTargets, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: titan.defId,
            effectType: 'destroy',
        }),
        {
            sourceId: 'titan_tricksters_big_funny_giant_choose_minion',
            targetType: 'minion',
            titleKey: 'ui.titan_big_funny_giant_choose_minion_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        fromBaseIndex: baseIndex,
    };

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
        isTrickstersBigFunnyGiantDefId(candidate.defId)
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
        && winnerIds.has(candidate.controllerId),
    )) {
        const interaction = createSimpleChoice(
            `titan_itty_critters_rainboroc_play_replacement_${titan.uid}_${ctx.now}`,
            titan.controllerId,
            'ui.titan_rainboroc_play_replacement_title',
            [
                { id: 'play', label: '打出这个泰坦', labelKey: 'ui.play_this_titan', value: { play: true }, displayMode: 'button' as const },
                { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
            ],
            {
                sourceId: 'titan_itty_critters_rainboroc_play_replacement',
                targetType: 'button',
                titleKey: 'ui.titan_rainboroc_play_replacement_title',
                titleParams: {
                    name: 'cards.itty_critters_rainboroc.name',
                },
            },
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

function findEligibleRainborocTitanForMinionPlayed(ctx: {
    state: SmashUpCore;
    playerId: string;
    baseIndex?: number;
    triggerMinionUid?: string;
    sourceCardUid?: string;
}): TitanState | undefined {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return undefined;

    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.defId === 'itty_critters_rainboroc'
        && candidate.location.zone === 'base'
        && candidate.location.baseIndex === ctx.baseIndex
        && candidate.controllerId === ctx.playerId
        && (!ctx.sourceCardUid || candidate.uid === ctx.sourceCardUid),
    );
    if (!titan) return undefined;

    if ((ctx.state.rainborocTriggeredTurnByTitan ?? {})[titan.uid] === ctx.state.turnNumber) {
        return undefined;
    }

    const triggerMinion = ctx.state.bases[ctx.baseIndex]?.minions.find(minion =>
        minion.uid === ctx.triggerMinionUid,
    );
    if (!triggerMinion || triggerMinion.controller !== ctx.playerId) return undefined;

    const triggerDef = getCardDef(triggerMinion.defId) as MinionCardDef | undefined;
    const triggerPower = triggerDef?.power ?? triggerMinion.basePower;
    if (triggerPower > 2) {
        return undefined;
    }

    return titan;
}

function ittyCrittersRainborocOnMinionPlayed(ctx: AbilityContext): AbilityResult | SmashUpEvent[] {
    const titan = findEligibleRainborocTitanForMinionPlayed(ctx);
    if (!titan) {
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
        {
            sourceId: 'titan_itty_critters_rainboroc_choose_discard',
            targetType: 'discard',
            titleKey: 'ui.titan_rainboroc_choose_discard_title',
        },
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
    triggerBaseControllersAtTrigger?: string[];
    now: number;
}): AbilityResult | SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.matchState) return [];

    let nextMatchState = ctx.matchState;

    for (const titan of getEligibleKrakenSetAsideTitans(ctx.state, ctx.baseIndex, ctx.triggerBaseControllersAtTrigger)) {
        const interaction = createSimpleChoice(
            `titan_pirates_the_kraken_play_replacement_${titan.uid}_${ctx.now}`,
            titan.controllerId,
            '海怪克拉肯：是否将其打出到替换的基地？',
            [
                {
                    id: 'play',
                    label: '打出海怪克拉肯',
                    labelKey: 'ui.titan_kraken_play_replacement_option',
                    value: { play: true },
                    displayMode: 'button' as const,
                },
                createSkipOption(),
            ],
            {
                sourceId: 'titan_pirates_the_kraken_play_replacement',
                targetType: 'button',
                titleKey: 'ui.titan_kraken_play_replacement_title',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: titan.uid,
            titanDefId: titan.defId,
            ownerId: titan.ownerId,
            controllerId: titan.controllerId,
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
            '克拉肯：将此处一个你的随从移到其他基地，代替弃置',
            buildFieldSourceToMinionTargetOptions(
                {
                    type: 'titan',
                    uid: titan.uid,
                    defId: titan.defId,
                    baseIndex: ctx.baseIndex,
                },
                minionTargets,
                {
                    state: ctx.state,
                    sourcePlayerId: titan.controllerId,
                    sourceDefId: titan.defId,
                    effectType: 'move',
                    sourceKind: 'nonAction',
                },
            ),
            buildFieldSourceTargetPromptConfig({
                sourceId: 'titan_pirates_the_kraken_choose_minion',
                titleKey: 'ui.titan_kraken_choose_minion_title',
            }),
        );
        (interaction.data as {
            continuationContext?: unknown;
            optionsGenerator?: (state: MatchState<SmashUpCore>, data: Record<string, unknown> | undefined) => PromptOption[];
        }).continuationContext = {
            titanUid: titan.uid,
            titanDefId: titan.defId,
            controllerId: titan.controllerId,
            scoringBaseIndex: ctx.baseIndex,
        };
        (interaction.data as {
            continuationContext?: unknown;
            optionsGenerator?: (state: MatchState<SmashUpCore>, data: Record<string, unknown> | undefined) => PromptOption[];
        }).optionsGenerator = (nextState, data) => {
            const continuation = (data as {
                continuationContext?: { titanUid?: string; titanDefId?: string; controllerId?: string; scoringBaseIndex?: number };
            } | undefined)?.continuationContext;
            if (!continuation?.titanUid || !continuation.titanDefId || !continuation.controllerId || continuation.scoringBaseIndex === undefined) {
                return [];
            }
            const liveTitan = getTitanByUid(nextState.core, continuation.titanUid);
            if (
                !liveTitan
                || liveTitan.defId !== continuation.titanDefId
                || liveTitan.controllerId !== continuation.controllerId
                || liveTitan.location.zone !== 'base'
                || liveTitan.location.baseIndex !== continuation.scoringBaseIndex
            ) {
                return [];
            }
            return buildFieldSourceToMinionTargetOptions(
                {
                    type: 'titan',
                    uid: liveTitan.uid,
                    defId: liveTitan.defId,
                    baseIndex: continuation.scoringBaseIndex,
                },
                getKrakenRescueMinionTargets(nextState.core, continuation.controllerId, continuation.scoringBaseIndex),
                {
                    state: nextState.core,
                    sourcePlayerId: continuation.controllerId,
                    sourceDefId: continuation.titanDefId,
                    effectType: 'move',
                    sourceKind: 'nonAction',
                },
            );
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
        '克拉肯：选择要移动到的基地',
        buildBaseTargetOptions(baseOptions, ctx.state),
        {
            sourceId: 'titan_pirates_the_kraken_talent',
            targetType: 'base',
            titleKey: 'ui.titan_kraken_choose_base_title',
        },
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
    if (getOwnTotalMinionCounters(ctx.state, ctx.playerId) < 7 || player.hand.length === 0) {
        return { events: [] };
    }

    const interaction = createSimpleChoice(
        `titan_giant_ants_death_on_six_legs_special_${ctx.now}`,
        ctx.playerId,
        '六足死神：弃 1 张牌来打出此泰坦',
        player.hand.map(card => ({
            id: `hand-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'titan_giant_ants_death_on_six_legs_special',
            targetType: 'hand',
            titleKey: 'ui.titan_death_on_six_legs_special_title',
        },
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

    const baseLabel = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;

    return base.minions
        .filter(minion => minion.controller !== playerId && getMinionPower(state, minion, baseIndex) <= 3)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId} (${baseLabel})`,
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

    const baseOptions = getOtherBaseOptions(ctx.state, titan.location.baseIndex);
    if (baseOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const moveInteraction = createSimpleChoice(
        `titan_bear_cavalry_major_ursa_choose_destination_${ctx.now}`,
        ctx.playerId,
        '大熊座：选择一个基地移动到',
        buildBaseTargetOptions(baseOptions, ctx.state),
        {
            sourceId: 'titan_bear_cavalry_major_ursa_choose_destination',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.titan_major_ursa_choose_destination_title',
        },
    );
    (moveInteraction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
        fromBaseIndex: titan.location.baseIndex,
    };

    return {
        events: [addTitanPowerCounter(titan.uid, 1, 'bear_cavalry_major_ursa_talent', ctx.now)],
        matchState: queueInteraction(ctx.matchState, moveInteraction),
    };
}

function bearCavalryMajorUrsaOnTitanMoved(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || ctx.baseIndex === undefined) return [];
    const titanControllerId = ctx.sourceControllerId ?? ctx.playerId;

    const titan = ctx.sourceCardUid
        ? (ctx.state.titans ?? []).find(candidate =>
            candidate.uid === ctx.sourceCardUid
            && candidate.defId === 'bear_cavalry_major_ursa'
            && candidate.location.zone === 'base'
            && candidate.location.baseIndex === ctx.baseIndex
            && candidate.controllerId === titanControllerId,
        )
        : (ctx.state.titans ?? []).find(candidate =>
            candidate.defId === 'bear_cavalry_major_ursa'
            && candidate.location.zone === 'base'
            && candidate.location.baseIndex === ctx.baseIndex
            && candidate.controllerId === titanControllerId,
        );
    if (!titan) return [];

    const targets = getMajorUrsaEnemyMinionTargets(ctx.state, titanControllerId, ctx.baseIndex);
    if (targets.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_bear_cavalry_major_ursa_choose_minion_${ctx.now}`,
        titanControllerId,
        '大熊座：选择一个对手战力≤3的随从移动',
        [
            ...buildMinionTargetOptions(targets, {
                state: ctx.state,
                sourcePlayerId: titanControllerId,
                sourceDefId: titan.defId,
                effectType: 'move',
            }),
            { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: 'skip' as const, displayMode: 'button' as const },
        ],
        {
            sourceId: 'titan_bear_cavalry_major_ursa_choose_minion',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.titan_major_ursa_choose_enemy_minion_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        fromBaseIndex: ctx.baseIndex,
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function bearCavalryMajorUrsaOnMinionMoved(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const titanControllerId = ctx.sourceControllerId ?? ctx.playerId;
    if (
        !ctx.triggerMinionUid
        || ctx.baseIndex === undefined
        || ctx.moveToBaseIndex === undefined
        || ctx.baseIndex !== ctx.moveToBaseIndex
    ) {
        return [];
    }

    const titan = ctx.sourceCardUid
        ? (ctx.state.titans ?? []).find(candidate =>
            candidate.uid === ctx.sourceCardUid
            && candidate.defId === 'bear_cavalry_major_ursa'
            && candidate.location.zone === 'base'
            && candidate.location.baseIndex === ctx.baseIndex
            && candidate.controllerId === titanControllerId,
        )
        : (ctx.state.titans ?? []).find(candidate =>
            candidate.defId === 'bear_cavalry_major_ursa'
            && candidate.location.zone === 'base'
            && candidate.location.baseIndex === ctx.baseIndex
            && candidate.controllerId === titanControllerId,
        );
    if (!titan) {
        return [];
    }

    const movedMinion = ctx.state.bases[ctx.moveToBaseIndex]?.minions
        .find(minion => minion.uid === ctx.triggerMinionUid);
    if (!movedMinion || movedMinion.controller === titanControllerId) {
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
        '鲜血领主：选择本基地一个已有 +1 力量标记的己方随从',
        buildMinionTargetOptions(candidates, { state: ctx.state, sourcePlayerId: ctx.playerId, sourceDefId: ctx.defId, effectType: 'affect' }),
        {
            sourceId: 'titan_vampires_ancient_lord_talent',
            targetType: 'minion',
            titleKey: 'ui.titan_ancient_lord_talent_title',
        },
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

function getSetAsideControlledTitan(state: AbilityContext['state'], defId: string, playerId: string) {
    return (state.titans ?? []).find(candidate =>
        candidate.defId === defId
        && candidate.controllerId === playerId
        && candidate.location.zone === 'setaside',
    );
}

function queueVampireAncientLordSpecialInteraction(
    matchState: AbilityContext['matchState'],
    state: AbilityContext['state'],
    playerId: string,
    minionUid: string,
    minionDefId: string,
    baseIndex: number,
    now: number,
) {
    const titan = getSetAsideControlledTitan(state, 'vampires_ancient_lord', playerId);
    const base = state.bases[baseIndex];
    if (!titan || !base) return undefined;

    const options = [
        {
            id: 'skip',
            label: '保留在随从上',
            labelKey: 'ui.titan_ancient_lord_keep_counter_option',
            value: {
                mode: 'skip',
                minionUid,
                minionDefId,
                baseIndex,
                baseDefId: base.defId,
                titanUid: titan.uid,
            },
            displayMode: 'button' as const,
        },
        {
            id: 'store',
            label: 'Place it on Ancient Lord',
            labelKey: 'ui.titan_ancient_lord_store_counter_option',
            value: {
                mode: 'store',
                minionUid,
                minionDefId,
                baseIndex,
                baseDefId: base.defId,
                titanUid: titan.uid,
            },
            displayMode: 'button' as const,
        },
    ];

    if (!getTitanByController(state, playerId) && (titan.powerCounters + 1) >= 3) {
        options.push({
            id: 'store-and-play',
            label: 'Place it there and play Ancient Lord',
            labelKey: 'ui.titan_ancient_lord_store_and_play_option',
            value: {
                mode: 'storeAndPlay',
                minionUid,
                minionDefId,
                baseIndex,
                baseDefId: base.defId,
                titanUid: titan.uid,
            },
            displayMode: 'button' as const,
        });
    }

    const interaction = createSimpleChoice(
        `titan_vampires_ancient_lord_special_${now}`,
        playerId,
        '鲜血领主：选择是否把其中 1 枚 +1 战斗力标记改放到此泰坦上',
        options,
        {
            sourceId: 'titan_vampires_ancient_lord_special',
            targetType: 'generic',
            titleKey: 'ui.titan_ancient_lord_special_title',
        },
    );
    return queueInteraction(matchState, interaction);
}

function vampireAncientLordOnPowerCounterChanged(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (
        !ctx.matchState
        || ctx.affectType !== 'power_change'
        || ctx.counterChangeKind !== 'added'
        || (ctx.counterDelta ?? 0) <= 0
    ) {
        return [];
    }
    const controllerId = ctx.triggerMinion?.controller;
    if (!controllerId || !ctx.triggerMinion || ctx.baseIndex === undefined) {
        return [];
    }
    if (ctx.reason?.startsWith('vampires_ancient_lord_special')) {
        return [];
    }

    const nextState = queueVampireAncientLordSpecialInteraction(
        ctx.matchState,
        ctx.state,
        controllerId,
        ctx.triggerMinion.uid,
        ctx.triggerMinion.defId,
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
                labelKey: 'ui.titan_death_on_six_legs_transfer_option',
                value: {
                    transfer: true,
                    titanUid: titan.uid,
                    minionUid,
                    minionDefId,
                    baseIndex,
                    baseDefId: sourceBase.defId,
                },
                displayMode: 'button' as const,
            },
            {
                id: 'skip',
                label: '跳过',
                labelKey: 'ui.skip',
                value: {
                    skip: true,
                    titanUid: titan.uid,
                    minionUid,
                    minionDefId,
                    baseIndex,
                    baseDefId: sourceBase.defId,
                },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'titan_giant_ants_death_on_six_legs_transfer',
            targetType: 'generic',
            titleKey: 'ui.titan_death_on_six_legs_transfer_title',
            titleParams: { minionName },
        },
    );
    return queueInteraction(matchState, interaction);
}

function giantAntsDeathOnSixLegsBeforeDiscard(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) {
        return [];
    }
    if (!ctx.triggerMinion || !ctx.sourceCardUid || !ctx.sourceControllerId) {
        return [];
    }
    if (ctx.triggerMinion.controller !== ctx.sourceControllerId) {
        return [];
    }

    const titan = getTitanByUid(ctx.state, ctx.sourceCardUid);
    if (!titan || titan.location.zone !== 'base') {
        return [];
    }

    return [addTitanPowerCounter(titan.uid, 1, 'giant_ants_death_on_six_legs', ctx.now)];
}

function isDestroyPipelineDiscardTrigger(ctx: TriggerContext): boolean {
    return typeof ctx.sourceEventId === 'string' && ctx.sourceEventId.startsWith('minion-discarded-from-base:');
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
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
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
        '堡垒巨蜥：选择一个你的随从消灭',
        buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        {
            sourceId: 'titan_dinosaurs_fort_titanosaurus_special',
            targetType: 'minion',
            titleKey: 'ui.titan_fort_titanosaurus_special_title',
        },
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
    const nextMatchState = queueFortTitanosaurusOngoingChoice(
        ctx.matchState,
        ctx.playerId,
        ctx.actionTargetType === 'minion' && ctx.actionTargetMinionUid
            ? [ctx.actionTargetMinionUid]
            : [],
        ctx.now,
    );
    if (!nextMatchState) {
        return [];
    }

    return { events: [], matchState: nextMatchState };
}

export function queueFortTitanosaurusOngoingChoice(
    matchState: MatchState<SmashUpCore> | undefined,
    playerId: string,
    targetMinionUids: readonly string[],
    now: number,
): MatchState<SmashUpCore> | undefined {
    if (!matchState || targetMinionUids.length === 0) return undefined;

    const titan = getFortTitanosaurus(matchState.core, playerId);
    if (!titan) return undefined;
    if (Number(titan.metadata?.fortTitanosaurusTriggeredTurn ?? -1) === matchState.core.turnNumber) {
        return undefined;
    }

    const targets = Array.from(new Set(targetMinionUids))
        .map((targetMinionUid) => findMinionOnBases(matchState.core, targetMinionUid))
        .filter((target): target is NonNullable<typeof target> => !!target);
    if (targets.length === 0) return undefined;

    const options = targets.flatMap((target, index) => {
        const minionName = getCardDef(target.minion.defId)?.name ?? target.minion.defId;
        return [
            {
                id: `minion-only-${index}`,
                label: `只给 ${minionName} 放置`,
                value: { mode: 'minion' as const, targetMinionUid: target.minion.uid },
                displayMode: 'button' as const,
            },
            {
                id: `both-${index}`,
                label: `给 ${minionName} 和此泰坦各放置 1 枚`,
                value: { mode: 'both' as const, targetMinionUid: target.minion.uid },
                displayMode: 'button' as const,
            },
        ];
    });
    options.push({
        id: 'titan-only',
        label: '只给此泰坦放置',
        labelKey: 'ui.titan_fort_titanosaurus_titan_only_option',
        value: { mode: 'titan' as const },
        displayMode: 'button' as const,
    });

    const interaction = createSimpleChoice(
        `titan_dinosaurs_fort_titanosaurus_ongoing_${now}`,
        playerId,
        'Fort Titanosaurus：选择要放置 +1 战力标记的位置',
        options,
        {
            sourceId: 'titan_dinosaurs_fort_titanosaurus_ongoing',
            targetType: 'generic',
            titleKey: 'ui.titan_fort_titanosaurus_ongoing_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
    };

    return queueInteraction(matchState, interaction);
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
    const splitSourceDiscardCards = (shuffledDiscard: CardInstance[]): CardInstance[] => {
        const sourceDiscardCards: CardInstance[] = [];
        const borrowedByOwner = new Map<string, CardInstance[]>();
        for (const card of shuffledDiscard) {
            if (card.owner !== playerId && state.players[card.owner]) {
                borrowedByOwner.set(card.owner, [...(borrowedByOwner.get(card.owner) ?? []), card]);
            } else {
                sourceDiscardCards.push(card);
            }
        }
        for (const [ownerId, cards] of borrowedByOwner.entries()) {
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    sourcePlayerId: playerId,
                    deckUids: [
                        ...state.players[ownerId].deck.map(card => card.uid),
                        ...cards.map(card => card.uid),
                    ],
                },
                timestamp: now,
            });
        }
        return sourceDiscardCards;
    };

    if (deckSnapshot.length === 0 && player.discard.length > 0) {
        deckSnapshot = splitSourceDiscardCards(random.shuffle([...player.discard]));
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: deckSnapshot.map(card => card.uid) },
            timestamp: now,
        });
    } else if (deckSnapshot.length === 1 && player.discard.length > 0) {
        const shuffledDiscard = splitSourceDiscardCards(random.shuffle([...player.discard]));
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
    const titan = ctx.sourceCardUid
        ? getTitanByUid(ctx.state, ctx.sourceCardUid)
        : (ctx.state.titans ?? []).find(candidate =>
            candidate.defId === 'ninjas_invisible_ninja' && candidate.controllerId === ctx.playerId,
        );
    if (!titan || titan.defId !== 'ninjas_invisible_ninja') return [];

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
        'Invisible Ninja：你可以消灭此泰坦，额外打出 1 张战斗力 3 或以下的随从',
        [
            { id: 'destroy', label: '消灭它并获得额外随从机会', labelKey: 'ui.destroy_titan_and_gain_extra_minion_play', value: { destroyTitan: true }, displayMode: 'button' as const },
            { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
        ],
        {
            sourceId: 'titan_ninjas_invisible_ninja_start_turn',
            targetType: 'generic',
            titleKey: 'ui.titan_invisible_ninja_start_turn_title',
        },
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
        'Invisible Ninja：弃 1 张牌来打出此泰坦',
        player.hand.map(card => ({
            id: `hand-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'titan_ninjas_invisible_ninja_special',
            targetType: 'hand',
            titleKey: 'ui.titan_invisible_ninja_special_title',
        },
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
    const controllerId = ctx.sourceControllerId ?? ctx.playerId;
    const titan = ctx.sourceCardUid
        ? getTitanByUid(ctx.state, ctx.sourceCardUid)
        : getControlledTitanOnBase(ctx.state, 'ninjas_invisible_ninja', controllerId);
    if (
        !titan
        || titan.defId !== 'ninjas_invisible_ninja'
        || titan.location.zone !== 'base'
        || titan.controllerId !== controllerId
        || !ctx.matchState
    ) return [];
    if (Number(titan.metadata?.invisibleNinjaTriggeredTurn ?? -1) === ctx.state.turnNumber) {
        return [];
    }

    const destroyedControllerId = ctx.triggerMinion?.controller
        ?? ctx.triggerCardOwnerId
        ?? ctx.controllerId
        ?? ctx.playerId;
    const destroyAnotherPlayersCard =
        (ctx.timing === 'onMinionDestroyed' || ctx.timing === 'onCardDestroyed')
        && ctx.destroyerId === controllerId
        && destroyedControllerId !== controllerId;
    const returnedPlayerId = ctx.eventPlayerId ?? ctx.playerId;
    const returnedOwnMinion =
        ctx.timing === 'onCardReturnedToHand'
        && !!ctx.triggerMinionUid
        && returnedPlayerId === controllerId;
    if (!destroyAnotherPlayersCard && !returnedOwnMinion) {
        return [];
    }

    const peek = buildInvisibleNinjaPeekResult(
        ctx.state,
        controllerId,
        ctx.random,
        ctx.now,
        'ninjas_invisible_ninja_ongoing',
    );
    if (peek.cards.length === 0) return [];

    const interaction = createSimpleChoice(
        `titan_ninjas_invisible_ninja_ongoing_${ctx.now}`,
        controllerId,
        'Invisible Ninja：选择要抽的牌',
        peek.cards.map(card => ({
            id: `deck-${card.uid}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'titan_ninjas_invisible_ninja_ongoing',
            targetType: 'generic',
            titleKey: 'ui.titan_invisible_ninja_ongoing_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        cardUids: peek.cards.map(card => card.uid),
    };

    return { events: peek.events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function canTriggerInvisibleNinjaTriggered(ctx: TriggerContext): boolean {
    const controllerId = ctx.sourceControllerId ?? ctx.playerId;
    if (ctx.timing === 'onMinionDestroyed' || ctx.timing === 'onCardDestroyed') {
        const destroyedControllerId = ctx.triggerMinion?.controller
            ?? ctx.triggerCardOwnerId
            ?? ctx.controllerId
            ?? ctx.playerId;
        return ctx.destroyerId === controllerId
            && destroyedControllerId !== controllerId;
    }

    const returnedPlayerId = ctx.eventPlayerId ?? ctx.playerId;
    return ctx.timing === 'onCardReturnedToHand'
        && !!ctx.triggerMinionUid
        && returnedPlayerId === controllerId;
}

function killerKudzuOnTurnStart(ctx: TriggerContext): SmashUpEvent[] {
    const titan = getQueuedSetAsideTitanForSourceController(ctx, 'killer_plants_killer_kudzu');
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
        'Killer Kudzu：选择至多 2 张弃牌堆中的随从洗回牌库',
        options,
        {
            sourceId: 'titan_killer_plants_killer_kudzu_recycle',
            targetType: 'generic',
            multi: { min: 0, max: Math.min(2, options.length) },
            autoRefresh: 'discard',
            responseValidationMode: 'live',
            titleKey: 'ui.titan_killer_kudzu_recycle_title',
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
        'Killer Kudzu：选择效果',
        [
            { id: 'recycle', label: 'Shuffle up to 2 minions back', labelKey: 'ui.titan_killer_kudzu_recycle_option', value: { recycle: true }, displayMode: 'button' as const },
            { id: 'draw', label: 'Draw 2 cards', labelKey: 'ui.titan_killer_kudzu_draw_option', value: { draw: true }, displayMode: 'button' as const },
        ],
        {
            sourceId: 'titan_killer_plants_killer_kudzu_removed',
            targetType: 'generic',
            titleKey: 'ui.titan_killer_kudzu_removed_title',
        },
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
        'Killer Kudzu：选择要从弃牌堆打出的随从',
        candidates,
        {
            sourceId: 'titan_killer_plants_killer_kudzu_talent',
            targetType: 'generic',
            autoRefresh: 'discard',
            responseValidationMode: 'live',
            titleKey: 'ui.titan_killer_kudzu_talent_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        titanDefId: titan.defId,
    };

    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

type BrideEffectKind = 'box' | 'destroy' | 'removeCounter';
type BrideStartBranchValue = { kind: BrideEffectKind } | { skip: true };

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
                label: `${getCardDef(card.defId)?.name ?? card.defId}（手牌）`,
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
    _targetUid: string,
) {
    const otherKinds: BrideEffectKind[] = ['box', 'destroy', 'removeCounter'].filter(
        (kind): kind is BrideEffectKind => kind !== firstKind,
    );
    return otherKinds.some(kind => {
        if (kind === 'box') return getTheBrideBoxTargets(state, playerId).length > 0;
        if (kind === 'destroy') return getTheBrideDestroyTargets(state, playerId).length > 0;
        return getTheBrideRemoveCounterTargets(state, playerId).length > 0;
    });
}

function buildTheBrideStartBranchOptions(
    state: AbilityContext['state'],
    playerId: string,
    usedKinds: BrideEffectKind[],
    _excludedUid?: string,
) {
    const options: PromptOption<BrideStartBranchValue>[] = [];
    const requireSecondChoice = usedKinds.length === 0;
    if (!usedKinds.includes('box') && buildTheBrideStartTargetOptions(state, playerId, 'box', undefined, requireSecondChoice).length > 0) {
        options.push({ id: 'box', label: '放进盒中', labelKey: 'ui.titan_the_bride_effect_box', value: { kind: 'box' }, displayMode: 'button' });
    }
    if (!usedKinds.includes('destroy') && buildTheBrideStartTargetOptions(state, playerId, 'destroy', undefined, requireSecondChoice).length > 0) {
        options.push({ id: 'destroy', label: '消灭己方随从', labelKey: 'ui.titan_the_bride_effect_destroy', value: { kind: 'destroy' }, displayMode: 'button' });
    }
    if (!usedKinds.includes('removeCounter') && buildTheBrideStartTargetOptions(state, playerId, 'removeCounter', undefined, requireSecondChoice).length > 0) {
        options.push({ id: 'removeCounter', label: '移除 +1 指示物', labelKey: 'ui.titan_the_bride_effect_remove_counter', value: { kind: 'removeCounter' }, displayMode: 'button' });
    }
    if (usedKinds.length === 0) {
        options.push({
            ...createSkipOption('跳过（本回合不让 The Bride 进场）', 'ui.titan_the_bride_skip_start'),
        });
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
                ownerId: card.owner,
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
        return buildValidatedDestroyEvents(state, {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: selection.baseIndex,
            destroyerId: playerId,
            reason: 'frankenstein_the_bride_special',
            now,
            sourcePlayerId: playerId,
            sourceDefId: 'frankenstein_the_bride',
            sourceControllerId: playerId,
            sourceBaseIndex: selection.baseIndex,
            sourceKind: 'nonAction',
        });
    }
    return [removePowerCounter(minion.uid, selection.baseIndex, 1, 'frankenstein_the_bride_special', now)];
}

type TheBrideStartPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: string;
    titanUid: string;
    titanDefId: string;
    usedKinds: BrideEffectKind[];
    selectedTargetUids: string[];
    activeKind?: BrideEffectKind;
    now: number;
};

function buildTheBrideStartContext(
    matchState: MatchState<SmashUpCore>,
    playerId: string,
    titan: Pick<TitanState, 'uid' | 'defId'>,
    now: number,
    usedKinds: BrideEffectKind[] = [],
    selectedTargetUids: string[] = [],
): TheBrideStartPromptContext {
    return {
        matchState,
        playerId,
        titanUid: titan.uid,
        titanDefId: titan.defId,
        usedKinds,
        selectedTargetUids,
        now,
    };
}

const theBrideStartChooseBasePromptProgram = createPromptProgram<
    TheBrideStartPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'titan_frankenstein_the_bride_start_choose_base',
    buildInteraction: (context) => createSimpleChoice(
        `titan_frankenstein_the_bride_start_choose_base_${context.now}`,
        context.playerId,
        'The Bride：选择要打出的基地',
        getAllBaseOptions(context.matchState.core),
        {
            sourceId: 'titan_frankenstein_the_bride_start_choose_base',
            targetType: 'base',
            titleKey: 'ui.titan_the_bride_start_base_title',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = context as Partial<TheBrideStartPromptContext> | undefined;
        if (selected?.baseIndex === undefined || !continuation?.titanUid || !continuation.titanDefId) {
            return { events: [] };
        }

        const titan = getLiveTheBrideStartTitan(state.core, playerId, continuation);
        if (!titan) return { events: [] };

        return {
            events: [playTitan(titan, playerId, selected.baseIndex, 'frankenstein_the_bride_special', timestamp, selected.baseDefId)],
        };
    },
});

const theBrideStartAfterEffectProgram = createEffectProgram<
    TheBrideStartPromptContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!getLiveTheBrideStartTitan(context.matchState.core, context.playerId, context)) {
        return { events: [] };
    }

    if (context.usedKinds.length < 2) {
        const options = buildTheBrideStartBranchOptions(context.matchState.core, context.playerId, context.usedKinds);
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            context,
            nextProgram: theBrideStartChooseBranchPromptProgram,
        };
    }

    return {
        events: [],
        context,
        nextProgram: theBrideStartChooseBasePromptProgram,
    };
});

const theBrideStartChooseTargetPromptProgram = createPromptProgram<
    TheBrideStartPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'titan_frankenstein_the_bride_start_choose_target',
    buildInteraction: (context) => {
        const requireSecondChoice = context.usedKinds.length === 0;
        const options = context.activeKind
            ? buildTheBrideStartTargetOptions(context.matchState.core, context.playerId, context.activeKind, undefined, requireSecondChoice)
            : [];
        const interaction = createSimpleChoice(
            `titan_frankenstein_the_bride_start_choose_target_${context.now}`,
            context.playerId,
            'The Bride：选择效果目标',
            options,
            {
                sourceId: 'titan_frankenstein_the_bride_start_choose_target',
                targetType: 'generic',
                titleKey: 'ui.titan_the_bride_start_target_title',
            },
        );
        (interaction.data as { optionsGenerator?: unknown }).optionsGenerator = (nextState: AbilityContext['matchState']) =>
            context.activeKind
                ? buildTheBrideStartTargetOptions(nextState.core, context.playerId, context.activeKind, undefined, requireSecondChoice)
                : [];
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as { kind?: BrideEffectKind; targetUid?: string; defId?: string; from?: 'hand' | 'discard'; baseIndex?: number } | undefined;
        const continuation = context as Partial<TheBrideStartPromptContext> | undefined;
        if (!selected?.kind || !selected.targetUid || !selected.defId || !continuation?.titanUid || !continuation.titanDefId) {
            return { events: [] };
        }
        if (!getLiveTheBrideStartTitan(state.core, playerId, continuation)) {
            return { events: [] };
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

        return {
            events,
            context: {
                matchState: state,
                playerId,
                titanUid: continuation.titanUid,
                titanDefId: continuation.titanDefId,
                usedKinds,
                selectedTargetUids,
                now: timestamp,
            } satisfies TheBrideStartPromptContext,
            nextProgram: theBrideStartAfterEffectProgram,
        };
    },
});

const theBrideStartChooseBranchPromptProgram = createPromptProgram<
    TheBrideStartPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'titan_frankenstein_the_bride_start_choose_branch',
    buildInteraction: (context) => {
        const isSecondChoice = context.usedKinds.length > 0;
        const interaction = createSimpleChoice(
            `titan_frankenstein_the_bride_start_choose_branch_${context.now}`,
            context.playerId,
            isSecondChoice ? '新娘：选择第二个效果' : '新娘：选择第一个效果',
            buildTheBrideStartBranchOptions(context.matchState.core, context.playerId, context.usedKinds),
            {
                sourceId: 'titan_frankenstein_the_bride_start_choose_branch',
                targetType: 'generic',
                titleKey: isSecondChoice
                    ? 'ui.titan_the_bride_start_second_effect_title'
                    : 'ui.titan_the_bride_start_first_effect_title',
            },
        );
        (interaction.data as { optionsGenerator?: unknown }).optionsGenerator = (nextState: AbilityContext['matchState']) =>
            buildTheBrideStartBranchOptions(nextState.core, context.playerId, context.usedKinds);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as BrideStartBranchValue | undefined;
        const continuation = context as Partial<TheBrideStartPromptContext> | undefined;
        if (selected && 'skip' in selected && selected.skip) {
            return { events: [] };
        }
        if (!selected || !('kind' in selected) || !selected.kind || !continuation?.titanUid || !continuation.titanDefId) {
            return { events: [] };
        }
        if (!getLiveTheBrideStartTitan(state.core, playerId, continuation)) {
            return { events: [] };
        }

        return {
            events: [],
            context: {
                matchState: state,
                playerId,
                titanUid: continuation.titanUid,
                titanDefId: continuation.titanDefId,
                usedKinds: continuation.usedKinds ?? [],
                selectedTargetUids: continuation.selectedTargetUids ?? [],
                activeKind: selected.kind,
                now: timestamp,
            } satisfies TheBrideStartPromptContext,
            nextProgram: theBrideStartChooseTargetPromptProgram,
        };
    },
});

function theBrideOnTurnStart(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const titanControllerId = ctx.sourceControllerId ?? ctx.playerId;
    if (!ctx.matchState || getTitanByController(ctx.state, titanControllerId)) return [];
    const titan = getQueuedSetAsideTitanForSourceController(ctx, 'frankenstein_the_bride');
    if (!titan) return [];

    const branchOptions = buildTheBrideStartBranchOptions(ctx.state, titanControllerId, []);
    if (branchOptions.length === 0) return [];

    return executeAbilityProgram(
        theBrideStartChooseBranchPromptProgram,
        buildTheBrideStartContext(ctx.matchState, titanControllerId, titan, ctx.now),
    );
}

function theBrideOnPowerCounterChanged(ctx: TriggerContext): SmashUpEvent[] {
    if (
        ctx.affectType !== 'power_change'
        || ctx.counterChangeKind !== 'added'
        || (ctx.counterDelta ?? 0) <= 0
    ) {
        return [];
    }

    const controllerId = ctx.triggerMinion?.controller;
    if (!controllerId) return [];

    const titan = ctx.sourceCardUid
        ? getTitanByUid(ctx.state, ctx.sourceCardUid)
        : getControlledTitanOnBase(ctx.state, 'frankenstein_the_bride', controllerId);
    if (
        !titan
        || titan.defId !== 'frankenstein_the_bride'
        || titan.controllerId !== controllerId
        || titan.location.zone !== 'base'
    ) return [];
    if (Number(titan.metadata?.theBrideTriggeredTurn ?? -1) === ctx.state.turnNumber) {
        return [];
    }
    return [
        buildTitanMetadataUpdateEvent(titan.uid, { theBrideTriggeredTurn: ctx.state.turnNumber }, 'frankenstein_the_bride_ongoing', ctx.now),
        ...buildStandardDrawEvents(ctx.state, controllerId, 1, ctx.random, ctx.now),
    ];
}

function canTriggerTheBrideOnPowerCounterChanged(ctx: TriggerContext): boolean {
    if (
        ctx.affectType !== 'power_change'
        || ctx.counterChangeKind !== 'added'
        || (ctx.counterDelta ?? 0) <= 0
    ) {
        return false;
    }

    const controllerId = ctx.triggerMinion?.controller;
    if (!controllerId) return false;
    const titan = ctx.sourceCardUid
        ? getTitanByUid(ctx.state, ctx.sourceCardUid)
        : getControlledTitanOnBase(ctx.state, 'frankenstein_the_bride', controllerId);
    if (
        !titan
        || titan.defId !== 'frankenstein_the_bride'
        || titan.controllerId !== controllerId
        || titan.location.zone !== 'base'
    ) return false;
    return Number(titan.metadata?.theBrideTriggeredTurn ?? -1) !== ctx.state.turnNumber;
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

function getLiveTheBrideTalentContext(
    core: SmashUpCore,
    playerId: string,
    continuation?: { titanUid?: string; titanBaseIndex?: number },
): { titanUid?: string; titanBaseIndex: number } | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (titan) {
        return titan.defId === 'frankenstein_the_bride'
            && titan.location.zone === 'base'
            && titan.controllerId === playerId
            ? { titanUid: titan.uid, titanBaseIndex: titan.location.baseIndex }
            : undefined;
    }

    const liveTitan = getControlledTitanOnBase(core, 'frankenstein_the_bride', playerId);
    if (liveTitan) {
        return { titanUid: liveTitan.uid, titanBaseIndex: liveTitan.location.baseIndex };
    }

    return continuation?.titanBaseIndex !== undefined
        ? { titanBaseIndex: continuation.titanBaseIndex }
        : undefined;
}

function getLiveTheBrideStartTitan(
    core: SmashUpCore,
    playerId: string,
    continuation?: { titanUid?: string; titanDefId?: string },
): TitanState | undefined {
    const titan = continuation?.titanUid ? getTitanByUid(core, continuation.titanUid) : undefined;
    if (
        !titan
        || !continuation?.titanDefId
        || titan.defId !== continuation.titanDefId
        || titan.controllerId !== playerId
        || titan.location.zone !== 'setaside'
        || !canControllerPlayTitan(core, playerId, titan.uid)
    ) {
        return undefined;
    }

    return titan;
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
            '新娘：选择此基地你的一名随从放置 +1 战力标记',
            buildMinionTargetOptions(addCounterTargets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'affect' }),
            {
                sourceId: 'titan_frankenstein_the_bride_talent_add_counter',
                targetType: 'minion',
                titleKey: 'ui.titan_the_bride_talent_add_counter_title',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: titan.uid,
            titanBaseIndex: titan.location.baseIndex,
        };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }

    if (addCounterTargets.length === 0 && extraActionOptions.length > 0) {
        const interaction = createSimpleChoice(
            `titan_frankenstein_the_bride_talent_extra_action_${ctx.now}`,
            ctx.playerId,
            '新娘：选择要移除的指示物组合',
            extraActionOptions,
            {
                sourceId: 'titan_frankenstein_the_bride_talent_extra_action',
                targetType: 'generic',
                titleKey: 'ui.titan_the_bride_talent_extra_action_title',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: titan.uid,
            titanBaseIndex: titan.location.baseIndex,
        };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }

    const interaction = createSimpleChoice(
        `titan_frankenstein_the_bride_talent_branch_${ctx.now}`,
        ctx.playerId,
        '新娘：选择天赋效果',
        [
            { id: 'add-counter', label: 'Place a +1 counter', labelKey: 'ui.titan_the_bride_talent_add_counter_option', value: { branch: 'addCounter' }, displayMode: 'button' as const },
            { id: 'extra-action', label: 'Remove 2 counters for an extra action', labelKey: 'ui.titan_the_bride_talent_extra_action_option', value: { branch: 'extraAction' }, displayMode: 'button' as const },
        ],
        {
            sourceId: 'titan_frankenstein_the_bride_talent_branch',
            targetType: 'generic',
            titleKey: 'ui.titan_the_bride_talent_branch_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
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
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return titan.powerCounters >= 4 ? null : 'This titan needs at least 4 +1 power counters';
    });
    registerTrigger('dinosaurs_fort_titanosaurus', 'onActionPlayed', fortTitanosaurusOnActionPlayed, {
        optional: true,
        baseScoped: false,
        playerContext: 'sourceController',
    });

    registerAbility('ninjas_invisible_ninja', 'special', invisibleNinjaSpecial);
    registerTitanSpecialValidator('ninjas_invisible_ninja', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return 'This titan is not set aside';
        const startTurnSeen = Number(titan.metadata?.invisibleNinjaStartTurn ?? -1);
        const wasInPlayAtStart = Boolean(titan.metadata?.invisibleNinjaWasInPlayAtStart);
        if (startTurnSeen !== state.turnNumber || wasInPlayAtStart) {
            return 'This titan must not have been in play at the start of your turn';
        }
        if ((state.players[playerId]?.hand.length ?? 0) === 0) {
            return '你需要弃 1 张牌来打出此泰坦';
        }
        return getBaseIndicesWithOwnMinions(state, playerId).includes(baseIndex)
            ? null
            : '你只能将其打到有你随从的基地';
    });
    registerTrigger('ninjas_invisible_ninja', 'onTurnStart', invisibleNinjaOnTurnStart, {
        global: true,
        playerContext: 'sourceController',
    });
    registerTrigger('ninjas_invisible_ninja', 'onMinionDestroyed', invisibleNinjaTriggered, {
        optional: true,
        baseScoped: false,
        playerContext: 'sourceController',
        canTrigger: canTriggerInvisibleNinjaTriggered,
    });
    registerTrigger('ninjas_invisible_ninja', 'onCardDestroyed', invisibleNinjaTriggered, {
        optional: true,
        baseScoped: false,
        playerContext: 'sourceController',
        canTrigger: canTriggerInvisibleNinjaTriggered,
    });
    registerTrigger('ninjas_invisible_ninja', 'onCardReturnedToHand', invisibleNinjaTriggered, {
        optional: true,
        baseScoped: false,
        playerContext: 'sourceController',
        canTrigger: canTriggerInvisibleNinjaTriggered,
    });

    registerAbility('killer_plants_killer_kudzu', 'special', killerKudzuSpecial);
    registerAbility('killer_plants_killer_kudzu', 'talent', {
        execute: killerKudzuTalent,
        validateUse: (ctx) => {
            const titan = getTitanByUid(ctx.state, ctx.cardUid);
            if (!titan || titan.location.zone !== 'base' || titan.controllerId !== ctx.playerId) {
                return '该泰坦当前不在可发动状态';
            }
            if (titan.powerCounters <= 0) {
                return '该泰坦没有足够的力量指示物';
            }
            const player = ctx.state.players[ctx.playerId];
            const hasCandidate = (player?.discard ?? []).some(card => {
                if (card.type !== 'minion') return false;
                const def = getCardDef(card.defId) as MinionCardDef | undefined;
                return (def?.power ?? 0) <= titan.powerCounters;
            });
            return hasCandidate ? null : '弃牌堆中没有可打出的有效随从';
        },
    });
    registerTitanSpecialValidator('killer_plants_killer_kudzu', ({ titan }) =>
        titan.location.zone === 'setaside' && titan.powerCounters >= 3 ? null : 'This titan must be set aside with at least 3 counters');
    registerTitanTalentValidator('killer_plants_killer_kudzu', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        const player = state.players[playerId];
        const hasCandidate = player?.discard.some(card => {
            if (card.type !== 'minion') return false;
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            return (def?.power ?? 0) <= titan.powerCounters;
        }) ?? false;
        return hasCandidate ? null : '你的弃牌堆中没有符合战斗力条件的随从';
    });
    registerTrigger('killer_plants_killer_kudzu', 'onTurnStart', killerKudzuOnTurnStart, {
        global: true,
        playerContext: 'sourceController',
    });
    registerTrigger('killer_plants_killer_kudzu', 'onTitanRemovedFromPlay', killerKudzuOnTitanRemovedFromPlay, {
        optional: true,
        global: true,
        playerContext: 'sourceController',
    });

    registerAbility('frankenstein_the_bride', 'talent', theBrideTalent);
    registerTitanTalentValidator('frankenstein_the_bride', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        const addCounterTargets = getTheBrideDestroyTargets(state, playerId).filter(target => target.baseIndex === titan.location.baseIndex);
        const extraActionOptions = buildTheBrideExtraActionOptions(state, playerId);
        return (addCounterTargets.length > 0 || extraActionOptions.length > 0)
            ? null
            : 'No valid talent targets';
    });
    registerTrigger('frankenstein_the_bride', 'onTurnStart', theBrideOnTurnStart, {
        global: true,
        optional: true,
        playerContext: 'sourceController',
    });
    registerTrigger('frankenstein_the_bride', 'onMinionAffected', theBrideOnPowerCounterChanged, {
        baseScoped: false,
        canTrigger: canTriggerTheBrideOnPowerCounterChanged,
        playerContext: 'sourceController',
        perInstance: true,
    });

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
    registerTrigger('super_spies_moon_zero_three', 'onDeckInspected', superSpiesMoonZeroThreeOnDeckInspected, {
    });

    registerTitanSpecialValidator('penguins_emperor_penguin', () =>
        '企鹅帝皇只能在你的回合开始时通过特殊能力进场');
    registerAbility('penguins_emperor_penguin', 'ongoingActivation', penguinsEmperorPenguinOngoingActivation);
    registerAbility('penguins_emperor_penguin', 'talent', penguinsEmperorPenguinTalent);
    registerTitanOngoingActivationValidator('penguins_emperor_penguin', ({ state, playerId, titan }) => {
        // 该持续主动能力会把牌库顶随从按「通常随从额度」打出（events.payload.consumesNormalLimit=true）。
        // 因此若本回合随从额度用尽，或牌库顶不是随从/合体随从，则应该直接判定为不可用，避免“看似可点但无效果”的交互。
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        const player = state.players[playerId];
        if (!player) return '玩家不存在';
        if (player.minionsPlayed >= player.minionLimit) return '本回合随从额度已用完';
        const topCard = player.deck?.[0];
        if (!topCard || !(topCard.type === 'minion' || topCard.type === 'fusion')) {
            return '牌库顶没有可打出的随从';
        }
        return null;
    });
    registerTitanTalentValidator('penguins_emperor_penguin', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return getEmperorPenguinTalentCandidates(state, playerId).length > 0
            ? null
            : '你的手牌与弃牌堆中没有战斗力 3 或更低的随从';
    });
    registerTrigger('penguins_emperor_penguin', 'onTurnStart', penguinsEmperorPenguinOnTurnStart, {
        global: true,
        playerContext: 'sourceController',
    });

    registerTitanSpecialValidator('changerbots_mergacon', () =>
        '合体机器人只能在你的回合开始时通过特殊能力进场');
    registerAbility('changerbots_mergacon', 'talent', changerbotsMergaconTalent);
    registerTitanTalentValidator('changerbots_mergacon', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : 'There is no other base to move to';
    });
    registerTrigger('changerbots_mergacon', 'onTurnStart', changerbotsMergaconOnTurnStart, {
        global: true,
        playerContext: 'sourceController',
    });
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
    }), {
        global: true,
    });
    registerTrigger('itty_critters_rainboroc', 'onMinionPlayed', ittyCrittersRainborocOnMinionPlayed, {
        canTrigger: (ctx) => !!findEligibleRainborocTitanForMinionPlayed(ctx),
        perInstance: true,
    });

    registerAbility('kaiju_gorgodzolla', 'special', kaijuGorgodzollaSpecial);
    registerTitanSpecialValidator('kaiju_gorgodzolla', ({ state, playerId, baseIndex }) =>
        getOwnActionCountOnBase(state, baseIndex, playerId) >= 2
            ? null
            : 'You can only play Gorgodzolla on a base where you have at least two actions');
    registerTrigger('kaiju_gorgodzolla', 'onMinionPlayed', kaijuGorgodzollaOnMinionPlayed, {
        playerContext: 'sourceController',
        canTrigger: (ctx) => ctx.baseIndex !== undefined
            && !!getGorgodzollaOnBase(ctx.state, ctx.sourceControllerId ?? ctx.playerId, ctx.baseIndex),
    });
    registerTrigger('kaiju_gorgodzolla', 'onActionPlayed', kaijuGorgodzollaOnActionPlayed, {
        playerContext: 'sourceController',
    });

    registerAbility('explorers_very_large_boulder', 'special', explorersVeryLargeBoulderSpecial);
    registerTitanSpecialValidator('explorers_very_large_boulder', ({ state, baseIndex, titan }) => {
        const base = state.bases[baseIndex];
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        if (titan.location.zone !== 'setaside') return 'This titan is not set aside';
        if (!base) return 'Invalid base index';
        return base.minions.length === 0
            ? null
            : '你只能将硕大圆石打出到没有玩家随从的基地';
    });
    registerTrigger('explorers_very_large_boulder', 'onMinionMoved', explorersVeryLargeBoulderOnMinionMoved, {
        playerContext: 'sourceController',
    });
    registerTrigger('explorers_very_large_boulder', 'onTurnEnd', explorersVeryLargeBoulderOnTurnEnd, {
        playerContext: 'sourceController',
    });

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
            : 'There is no minion to give away or reclaim';
    });
    registerTrigger('ignobles_the_hill_that_strolls', 'onMinionAffected', ignoblesTheHillThatStrollsOnMinionAffected, {
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });

    registerAbility('time_travelers_time_box', 'special', {
        execute: timeTravelersTimeBoxSpecial,
        validateUse: (ctx) => (
            isTimeBoxPlayArmed(getTitanByUid(ctx.state, ctx.cardUid))
                ? null
                : '时间盒子的进场机会已经结束'
        ),
    });
    registerAbility('time_travelers_time_box', 'talent', timeTravelersTimeBoxTalent);
    registerTitanSpecialValidator('time_travelers_time_box', ({ titan }) =>
        getTimeBoxCounter(titan) >= 5 ? null : '时间盒子的计数还未达到 5');
    registerTitanTalentValidator('time_travelers_time_box', ({ titan }) =>
        titan.location.zone === 'base' ? null : '该泰坦当前不在场');
    registerTrigger('time_travelers_time_box', 'onTurnStart', timeTravelersTimeBoxOnTurnStart, {
        global: true,
        optional: true,
        playerContext: 'sourceController',
    });
    registerTrigger('time_travelers_time_box', 'onCardReturnedToHand', timeTravelersTimeBoxOnCardReturnedToHand, {
        global: true,
        optional: true,
        playerContext: 'sourceController',
    });

    registerTrigger('pecos_bill', 'onDuelStarted', pecosBillOnDuelStarted, {
        global: true,
    });
    registerTrigger('pecos_bill', 'onDuelResolved', pecosBillOnDuelResolved, {
    });
    registerProtection('pecos_bill', 'move', pecosBillMoveProtectionChecker);

    registerAbility('sphinx', 'talent', sphinxTalent);
    registerTitanTalentValidator('sphinx', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return (state.players[playerId]?.hand.length ?? 0) > 0
            ? null
            : 'You have no card in hand to bury';
    });
    registerTrigger('sphinx', 'onTurnStart', sphinxOnTurnStart, {
        global: true,
        playerContext: 'sourceController',
    });
    registerTrigger('sphinx', 'afterScoring', (ctx) => sphinxAfterScoring({
        state: ctx.state,
        matchState: ctx.matchState,
        baseIndex: ctx.baseIndex,
        now: ctx.now,
    }), {
        global: true,
        playerContext: 'sourceController',
    });

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
            : 'There is no other base to move to';
    });
    registerProtection('magical_girls_walking_castle', 'destroy', magicalGirlsWalkingCastleProtectionChecker);

    registerAbility('mega_troopers_megabot', 'special', megaTroopersMegabotSpecial);
    registerTitanSpecialValidator('mega_troopers_megabot', ({ state, playerId, baseIndex }) =>
        getOwnMinionCountOnBase(state, baseIndex, playerId) >= 3
            ? null
            : '你只能将超级佐德打出到有你至少 3 个随从的基地');
    registerTrigger('mega_troopers_megabot', 'beforeScoring', megaTroopersMegabotBeforeScoring, {
        playerContext: 'sourceController',
    });
    registerTitanPowerModifier('mega_troopers_megabot', ({ state, baseIndex, playerId }) =>
        getOwnMinionCountOnBase(state, baseIndex, playerId));

    registerAbility('sharks_helicoprion', 'special', {
        execute: sharksHelicoprionSpecial,
        validateUse: (ctx) => {
            const titan = getTitanByUid(ctx.state, ctx.cardUid);
            return getHelicoprionCounter(titan) >= 4 ? null : '旋齿鲨的计数还未达到 4';
        },
    });
    registerTitanSpecialValidator('sharks_helicoprion', () =>
        '旋齿鲨只能在你的回合开始或有随从被消灭后通过特殊能力进场');
    registerAbility('sharks_helicoprion', 'talent', sharksHelicoprionTalent);
    registerTitanTalentValidator('sharks_helicoprion', ({ titan }) =>
        titan.location.zone === 'base' ? null : '该泰坦当前不在场');
    registerTrigger('sharks_helicoprion', 'onTurnStart', sharksHelicoprionOnTurnStart, {
        global: true,
        playerContext: 'sourceController',
    });
    registerTrigger('sharks_helicoprion', 'onMinionDestroyed', sharksHelicoprionOnMinionDestroyed, {
        global: true,
        baseScoped: false,
        playerContext: 'sourceController',
        canTrigger: (ctx) => {
            const controllerId = ctx.sourceControllerId ?? ctx.playerId;
            const titan = getControlledHelicoprionForTrigger(ctx, controllerId);
            if (!titan || titan.defId !== 'sharks_helicoprion') return false;
            if (titan.location.zone === 'setaside') return true;
            return ctx.baseIndex !== undefined
                && titan.location.zone === 'base'
                && titan.controllerId === controllerId
                && titan.location.baseIndex === ctx.baseIndex;
        },
    });

    registerAbility('superheroes_the_everything_glove', 'special', superheroesTheEverythingGloveSpecial);
    registerAbility('superheroes_the_everything_glove', 'talent', superheroesTheEverythingGloveTalent);
    registerTitanSpecialValidator('superheroes_the_everything_glove', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        return getEverythingGloveHighPowerMinionCount(state, playerId) >= 3
            ? null
            : '你需要有至少 3 个战力 5 或更高的随从在场';
    });
    registerTitanTalentValidator('superheroes_the_everything_glove', ({ titan }) =>
        titan.location.zone === 'base' ? null : '该泰坦当前不在场');
    registerProtection('superheroes_the_everything_glove', 'destroy', everythingGloveProtectionChecker);
    registerProtection('superheroes_the_everything_glove', 'move', everythingGloveProtectionChecker);
    registerProtection('superheroes_the_everything_glove', 'affect', everythingGloveProtectionChecker);

    registerAbility('tornados_category_5', 'special', tornadosCategory5Special);
    registerTitanSpecialValidator('tornados_category_5', ({ state, playerId, titan }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        if (state.turnOrder[state.currentPlayerIndex] !== playerId) {
            return '五级风暴只能在你的回合中进场';
        }
        return (state.minionMovesThisTurnByPlayer?.[playerId] ?? 0) >= 2
            ? null
            : '你本回合至少要移动 2 个随从';
    });
    registerTrigger('tornados_category_5', 'onMinionMoved', tornadosCategory5OnMinionMoved, {
        global: true,
        optional: true,
        playerContext: 'sourceController',
    });
    registerTrigger('tornados_category_5', 'beforeScoring', tornadosCategory5BeforeScoring, {
        playerContext: 'sourceController',
    });
    registerTitanPowerModifier('tornados_category_5', ({ state, baseIndex }) =>
        state.minionMoveEventsByBaseThisTurn?.[baseIndex] ?? 0);

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
        return hasPlayableAction ? null : '弃牌后也没有可额外打出的标准战术';
    });
    registerTitanPowerModifier('ghosts_creampuff_man', ({ state, playerId }) => {
        const handSize = state.players[playerId]?.hand.length ?? 0;
        return Math.max(0, 5 - handSize);
    });

    registerAbility('fairies_spirit_of_the_forest', 'special', fairiesSpiritOfTheForestSpecial);
    registerTitanSpecialValidator('fairies_spirit_of_the_forest', ({ titan }) =>
        titan.location.zone === 'setaside' ? null : '该泰坦当前不在牌库旁');

    registerAbility('innsmouth_dagon', 'special', innsmouthDagonSpecial);
    registerAbility('innsmouth_dagon', 'talent', innsmouthDagonTalent);
    registerTitanSpecialValidator('innsmouth_dagon', ({ state, playerId, baseIndex }) =>
        getDagonMatchingMinionCount(state, baseIndex, playerId) >= 2
            ? null
            : '你只能将大衮打出到有你至少两个同名随从的基地');
    registerTitanTalentValidator('innsmouth_dagon', ({ state, playerId }) => {
        const player = state.players[playerId];
        const hasMinionInHand = player?.hand.some(card => card.type === 'minion') ?? false;
        return hasMinionInHand ? null : 'You have no minion in hand to play';
    });
    registerTitanPowerModifier('innsmouth_dagon', ({ state, baseIndex, playerId }) =>
        getDagonMatchingMinionCount(state, baseIndex, playerId));

    registerAbility('wizards_arcane_protector', 'special', wizardArcaneProtectorSpecial);
    registerAbility('wizards_arcane_protector', 'talent', wizardArcaneProtectorTalent);
    registerTitanSpecialValidator('wizards_arcane_protector', ({ state, titan }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        return (state.cardsPlayedThisTurn ?? 0) >= 5 ? null : '你本回合还没有打出 5 张牌';
    });

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
            : '你既不能抽疯狂卡，也没有可转交给其他玩家的疯狂卡';
    });
    registerInterceptor('cthulhu_cthulhu_titan', (state, event) => buildCthulhuTitanCounterEvents(state, event));

    registerAbility('giant_ants_death_on_six_legs', 'special', giantAntsDeathOnSixLegsSpecial);
    registerAbility('giant_ants_death_on_six_legs', 'talent', giantAntsDeathOnSixLegsTalent);
    registerTitanSpecialValidator('giant_ants_death_on_six_legs', ({ state, playerId }) =>
        getOwnTotalMinionCounters(state, playerId) >= 7
            ? null
            : 'Your minions need a total of at least 7 +1 power counters',
    );
    registerTrigger('giant_ants_death_on_six_legs', 'onMinionDestroyed', giantAntsDeathOnSixLegsBeforeDiscard, {
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerTrigger('giant_ants_death_on_six_legs', 'onMinionDiscardedFromBase', giantAntsDeathOnSixLegsBeforeDiscard, {
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerAbility('bear_cavalry_major_ursa', 'special', bearCavalryMajorUrsaSpecial);
    registerAbility('bear_cavalry_major_ursa', 'talent', bearCavalryMajorUrsaTalent);
    registerTitanSpecialValidator('bear_cavalry_major_ursa', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return 'This titan is not set aside';
        const base = state.bases[baseIndex];
        if (!base) return 'Invalid base index';
        return base.minions.some(minion => minion.controller === playerId)
            ? null
            : 'You can only play Major Ursa on a base where you have a minion';
    });

    registerTrigger('bear_cavalry_major_ursa', 'onTitanMoved', bearCavalryMajorUrsaOnTitanMoved, {
        optional: true,
        playerContext: 'sourceController',
    });
    registerTitanTalentValidator('bear_cavalry_major_ursa', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        const canMoveTitan = getOtherBaseOptions(state, titan.location.baseIndex).length > 0;
        return canMoveTitan ? null : '没有可移动的基地';
    });
    registerTrigger('bear_cavalry_major_ursa', 'onMinionMoved', bearCavalryMajorUrsaOnMinionMoved, {
        optional: true,
        playerContext: 'sourceController',
    });

    registerAbility('vampires_ancient_lord', 'special', vampireAncientLordSpecial);
    registerAbility('vampires_ancient_lord', 'talent', vampireAncientLordTalent);
    registerTitanSpecialValidator('vampires_ancient_lord', ({ state }) =>
        (state.powerCountersPlacedOnMinionsThisTurn ?? 0) >= 2 ? null : '你本回合还没有为随从放置 2 枚 +1 力量标记');
    registerTitanTalentValidator('vampires_ancient_lord', ({ state, playerId, baseIndex }) => {
        const base = state.bases[baseIndex];
        if (!base) return 'Invalid base index';
        const hasTarget = base.minions.some(minion =>
            minion.controller === playerId && (minion.powerCounters ?? 0) > 0,
        );
        return hasTarget ? null : 'There is no minion here with a +1 power counter';
    });
    registerInterceptor('vampires_ancient_lord', (state, event) => buildAncientLordBonusCounterEvents(state, event));

    registerTrigger('vampires_ancient_lord', 'onMinionAffected', vampireAncientLordOnPowerCounterChanged, {
        global: true,
        optional: true,
        baseScoped: false,
        playerContext: 'sourceController',
    });

    registerAbility('werewolves_great_wolf_spirit', 'special', werewolvesGreatWolfSpiritSpecial);
    registerTitanSpecialValidator('werewolves_great_wolf_spirit', ({ state, playerId, baseIndex, titan }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        const eligibleBases = getGreatWolfSpiritEligibleBases(state, playerId);
        if (eligibleBases.length < 2) return 'You must be tied for highest power on at least 2 bases';
        return eligibleBases.some(option => option.baseIndex === baseIndex)
            ? null
            : 'This base does not satisfy Great Wolf Spirit special';
    });
    registerAbility('werewolves_great_wolf_spirit', 'talent', werewolvesGreatWolfSpiritTalent);
    registerTrigger('werewolves_great_wolf_spirit', 'onTurnStart', werewolvesGreatWolfSpiritOnTurnStart, {
        optional: true,
        playerContext: 'sourceController',
    });
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
        return base.minions.length === 0 ? null : '只能打到空基地';
    });
    registerAbility('tricksters_big_funny_giant_pod', 'special', trickstersBigFunnyGiantSpecial);
    registerTitanSpecialValidator('tricksters_big_funny_giant_pod', ({ state, titan, baseIndex }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        return state.bases[baseIndex] ? null : '无效的基地索引';
    });
    const bigFunnyGiantPlayMinionRestriction = (ctx: RestrictionCheckContext) => {
        const titan = (ctx.state.titans ?? []).find(candidate =>
            candidate.defId === 'tricksters_big_funny_giant'
            && candidate.location.zone === 'base'
            && candidate.location.baseIndex === ctx.baseIndex,
        );
        if (!titan || titan.controllerId === ctx.playerId) return false;
        const player = ctx.state.players[ctx.playerId];
        if (!player) return false;
        const cardUid = ctx.extra?.cardUid as string | undefined;
        const isFromHand = !!cardUid && player.hand.some(card => card.uid === cardUid);
        const requiredHandSize = isFromHand ? 2 : 1;
        return player.hand.length < requiredHandSize;
    };
    registerRestriction('tricksters_big_funny_giant', 'play_minion', bigFunnyGiantPlayMinionRestriction);
    const registerBigFunnyGiantTalent = (defId: string) => {
        registerAbility(defId, 'talent', trickstersBigFunnyGiantTalent);
        registerTitanTalentValidator(defId, ({ state, titan, baseIndex }) => {
            if (titan.location.zone !== 'base') return '该泰坦当前不在场';
            if (titan.location.baseIndex !== baseIndex) return '必须选择泰坦所在基地';
            const targets = getBigFunnyGiantTalentTargets(state, titan.location.baseIndex);
            if (targets.length === 0) return '没有可选择的低战力随从';
            return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
                ? null
                : '没有可移动的基地';
        });
    };
    registerBigFunnyGiantTalent('tricksters_big_funny_giant');
    registerTrigger('tricksters_big_funny_giant', 'onTurnEnd', trickstersBigFunnyGiantOnTurnEnd, {
        playerContext: 'sourceController',
    });
    registerTrigger('tricksters_big_funny_giant_pod', 'onTurnEnd', trickstersBigFunnyGiantPodOnTurnEnd, {
    });
    for (const defId of ['tricksters_big_funny_giant', 'tricksters_big_funny_giant_pod']) {
        registerTrigger(defId, 'onMinionPlayed', trickstersBigFunnyGiantOnMinionPlayed, {
            canTrigger: (ctx) => !!findEligibleBigFunnyGiantMinionPlay(ctx),
            perInstance: true,
        });
        registerTrigger(defId, 'afterScoring', (ctx) => trickstersBigFunnyGiantAfterScoring({
            state: ctx.state,
            baseIndex: ctx.baseIndex,
            rankings: ctx.rankings,
            now: ctx.now,
        }), {
            global: true,
        });
    }

    registerAbility('pirates_the_kraken', 'talent', piratesTheKrakenTalent);
    registerTitanTalentValidator('pirates_the_kraken', ({ state, titan }) => {
        if (titan.location.zone !== 'base') return '该泰坦当前不在场';
        return getOtherBaseOptions(state, titan.location.baseIndex).length > 0
            ? null
            : 'There is no other base to move to';
    });
    registerTrigger('pirates_the_kraken', 'afterScoring', piratesTheKrakenAfterScoring, {
        global: true,
        playerContext: 'sourceController',
    });
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

        const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
        const base = state.core.bases[continuation.baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === selected.minionUid && candidate.controller === playerId);
        if (!titan || !base || !minion) {
            return { state, events: [] };
        }

        const destroyedPower = getMinionPower(state.core, minion, continuation.baseIndex);
        return {
            state,
            events: [
                ...buildValidatedDestroyEvents(state, {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: continuation.baseIndex,
                    destroyerId: playerId,
                    reason: 'dinosaurs_fort_titanosaurus_special',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceDefId: 'dinosaurs_fort_titanosaurus',
                    sourceControllerId: playerId,
                    sourceBaseIndex: continuation.baseIndex,
                    sourceKind: 'nonAction',
                }),
                playTitan(titan, playerId, continuation.baseIndex, 'dinosaurs_fort_titanosaurus_special', timestamp, continuation.baseDefId),
                ...(destroyedPower > 0 ? [addTitanPowerCounter(titan.uid, destroyedPower, 'dinosaurs_fort_titanosaurus_special', timestamp)] : []),
            ],
        };
    });

    registerInteractionHandler('titan_dinosaurs_fort_titanosaurus_ongoing', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { mode?: 'minion' | 'titan' | 'both'; targetMinionUid?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string };
        } | undefined)?.continuationContext;
        if (!selected?.mode || !continuation?.titanUid) {
            return { state, events: [] };
        }
        const titan = getTitanByUid(state.core, continuation.titanUid);
        if (!titan || titan.defId !== 'dinosaurs_fort_titanosaurus' || titan.location.zone !== 'base' || titan.controllerId !== playerId) {
            return { state, events: [] };
        }

        const events: SmashUpEvent[] = [
            buildTitanMetadataUpdateEvent(
                titan.uid,
                { fortTitanosaurusTriggeredTurn: state.core.turnNumber },
                'dinosaurs_fort_titanosaurus_ongoing',
                timestamp,
            ),
        ];

        if (selected.mode === 'minion' || selected.mode === 'both') {
            const found = selected.targetMinionUid
                ? findMinionOnBases(state.core, selected.targetMinionUid)
                : undefined;
            if (found) {
                events.push(addPowerCounter(found.minion.uid, found.baseIndex, 1, 'dinosaurs_fort_titanosaurus_ongoing', timestamp));
            }
        }
        if (selected.mode === 'titan' || selected.mode === 'both') {
            events.push(addTitanPowerCounter(titan.uid, 1, 'dinosaurs_fort_titanosaurus_ongoing', timestamp));
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
            continuationContext?: { titanUid?: string; titanDefId?: string; baseIndex?: number; baseDefId?: string };
        } | undefined)?.continuationContext;
        if (!selected?.cardUid || !continuation?.titanUid || !continuation.titanDefId || continuation.baseIndex === undefined) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
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
            continuationContext?: { titanUid?: string; titanDefId?: string; baseIndex?: number; baseDefId?: string };
        } | undefined)?.continuationContext;
        if (!selected?.cardUid || !continuation?.titanUid || !continuation.titanDefId || continuation.baseIndex === undefined) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
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
        const titan = getTitanByUid(state.core, continuation.titanUid);
        if (
            !titan
            || titan.defId !== 'ninjas_invisible_ninja'
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
        ) {
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
            const sourceRemaining = remainingShown.filter(card => card.owner === playerId || !state.core.players[card.owner]);
            const borrowedByOwner = new Map<string, CardInstance[]>();
            for (const card of remainingShown) {
                if (card.owner === playerId || !state.core.players[card.owner]) continue;
                borrowedByOwner.set(card.owner, [...(borrowedByOwner.get(card.owner) ?? []), card]);
            }
            for (const [ownerId, cards] of borrowedByOwner.entries()) {
                events.push({
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: {
                        playerId: ownerId,
                        sourcePlayerId: playerId,
                        deckUids: [
                            ...state.core.players[ownerId].deck.map(card => card.uid),
                            ...cards.map(card => card.uid),
                        ],
                    },
                    timestamp,
                } as SmashUpEvent);
            }
            const shuffled = random.shuffle([
                ...player.deck.filter(card => !shownUidSet.has(card.uid)),
                ...sourceRemaining,
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
        const cardsByOwner = new Map<string, CardInstance[]>();
        for (const card of selectedFromDiscard) {
            const ownerId = state.core.players[card.owner] ? card.owner : playerId;
            cardsByOwner.set(ownerId, [...(cardsByOwner.get(ownerId) ?? []), card]);
        }
        return {
            state,
            events: Array.from(cardsByOwner.entries()).map(([ownerId, cards]) => {
                const owner = state.core.players[ownerId] ?? player;
                const shuffled = random.shuffle([...owner.deck, ...cards]);
                return {
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: {
                        playerId: ownerId,
                        deckUids: shuffled.map(card => card.uid),
                        ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
                    },
                    timestamp,
                } as SmashUpEvent;
            }),
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
            '杀手葛藤：选择要打出该随从的基地',
            baseOptions,
            {
                sourceId: 'titan_killer_plants_killer_kudzu_talent_base',
                targetType: 'base',
                titleKey: 'ui.titan_killer_kudzu_choose_base_title',
            },
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
            continuationContext?: { titanUid?: string; titanDefId?: string; cardUid?: string; defId?: string };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.titanUid || !continuation.titanDefId || !continuation.cardUid || !continuation.defId) {
            return { state, events: [] };
        }

        const titan = getLiveControlledBaseTitan(state.core, playerId, continuation);
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

    registerInteractionHandler('titan_frankenstein_the_bride_talent_branch', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { branch?: 'addCounter' | 'extraAction' } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        const liveContext = getLiveTheBrideTalentContext(state.core, playerId, continuation);
        if (!selected?.branch || !liveContext) {
            return { state, events: [] };
        }

        if (selected.branch === 'addCounter') {
            const targets = getTheBrideDestroyTargets(state.core, playerId)
                .filter(target => target.baseIndex === liveContext.titanBaseIndex);
            const interaction = createSimpleChoice(
                `titan_frankenstein_the_bride_talent_add_counter_${timestamp}`,
                playerId,
                '新娘：选择此基地你的一名随从放置 +1 战力标记',
                buildMinionTargetOptions(targets, { state: state.core, sourcePlayerId: playerId, effectType: 'affect' }),
                {
                    sourceId: 'titan_frankenstein_the_bride_talent_add_counter',
                    targetType: 'minion',
                    titleKey: 'ui.titan_the_bride_talent_add_counter_title',
                },
            );
            (interaction.data as { continuationContext?: unknown }).continuationContext = liveContext;
            return { state: queueInteraction(state, interaction), events: [] };
        }

        const interaction = createSimpleChoice(
            `titan_frankenstein_the_bride_talent_extra_action_${timestamp}`,
            playerId,
            'The Bride：选择要移除的指示物组合',
            buildTheBrideExtraActionOptions(state.core, playerId),
            {
                sourceId: 'titan_frankenstein_the_bride_talent_extra_action',
                targetType: 'generic',
                titleKey: 'ui.titan_the_bride_talent_extra_action_title',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = liveContext;
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('titan_frankenstein_the_bride_talent_add_counter', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        const liveContext = getLiveTheBrideTalentContext(state.core, playerId, continuation);
        if (!selected?.minionUid || selected.baseIndex === undefined || !liveContext || selected.baseIndex !== liveContext.titanBaseIndex) {
            return { state, events: [] };
        }
        return {
            state,
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'frankenstein_the_bride_talent', timestamp)],
        };
    });

    registerInteractionHandler('titan_frankenstein_the_bride_talent_extra_action', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { removals?: Array<{ minionUid: string; baseIndex: number; amount: number }> } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.removals?.length || !getLiveTheBrideTalentContext(state.core, playerId, continuation)) {
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

    registerInteractionHandler('titan_kaiju_gorgodzolla_draw', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { draw?: boolean } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.draw) {
            return { state, events: [] };
        }

        const titan = continuation?.titanUid ? getTitanByUid(state.core, continuation.titanUid) : undefined;
        if (
            !titan
            || titan.defId !== 'kaiju_gorgodzolla'
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
            || titan.location.baseIndex !== continuation?.titanBaseIndex
        ) {
            return { state, events: [] };
        }
        const events = buildStandardDrawEvents(state.core, playerId, 1, random, timestamp);
        if (events.length === 0) {
            return { state, events: [] };
        }

        return { state, events };
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
        const liveContext = getLiveWalkingCastleTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        const selectedMinionUids = selections
            .map(selection => selection.minionUid)
            .filter((uid): uid is string => Boolean(uid))
            .slice(0, 3);

        const events: SmashUpEvent[] = [
            moveTitan(
                liveContext.titanUid ?? continuation.titanUid,
                liveContext.titanDefId,
                liveContext.fromBaseIndex,
                continuation.targetBaseIndex,
                'magical_girls_walking_castle_talent',
                timestamp,
                continuation.targetBaseDefId,
            ),
        ];

        const sourceBase = state.core.bases[liveContext.fromBaseIndex];
        if (sourceBase) {
            for (const minionUid of selectedMinionUids) {
                const minion = sourceBase.minions.find(candidate =>
                    candidate.uid === minionUid && candidate.controller === playerId,
                );
                if (!minion) continue;
                events.push(...buildValidatedMoveEvents(state, {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: liveContext.fromBaseIndex,
                    toBaseIndex: continuation.targetBaseIndex,
                    toBaseDefId: continuation.targetBaseDefId,
                    reason: 'magical_girls_walking_castle_talent',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceCardUid: liveContext.titanUid ?? continuation.titanUid,
                    sourceDefId: liveContext.titanDefId,
                    sourceControllerId: playerId,
                    sourceBaseIndex: liveContext.fromBaseIndex,
                    sourceKind: 'nonAction',
                }));
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
        const liveContext = getLiveWalkingCastleTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        const nextState = queueWalkingCastleChooseMinionsInteraction(
            state,
            state.core,
            playerId,
            timestamp,
            {
                titanUid: liveContext.titanUid ?? continuation.titanUid,
                titanDefId: liveContext.titanDefId,
                fromBaseIndex: liveContext.fromBaseIndex,
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
                liveContext.titanUid ?? continuation.titanUid,
                liveContext.titanDefId,
                liveContext.fromBaseIndex,
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
        const liveContext = getLiveHillTalentContext(state.core, playerId, continuation);
        if (!selected?.branch || !liveContext) {
            return { state, events: [] };
        }

        if (selected.branch === 'give') {
            const nextState = queueHillGiveMinionInteraction(state, state.core, playerId, timestamp, liveContext);
            return nextState
                ? { state: nextState, events: [] }
                : { state, events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
        }

        const nextState = queueHillReclaimMinionInteraction(
            state,
            state.core,
            playerId,
            timestamp,
            liveContext.titanBaseIndex,
            liveContext,
        );
        return nextState
            ? { state: nextState, events: [] }
            : { state, events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
    });

    registerInteractionHandler('titan_ignobles_the_hill_that_strolls_give_minion', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId || !getLiveHillTalentContext(state.core, playerId, continuation)) {
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
                ...buildStandardDrawEvents(state.core, playerId, 1, random, timestamp),
            ];
            return { state, events };
        }

        const interaction = createSimpleChoice(
            `titan_ignobles_the_hill_that_strolls_choose_player_${timestamp}`,
            playerId,
            '移动的山：选择要交出控制权的玩家',
            opponentOptions,
            {
                sourceId: 'titan_ignobles_the_hill_that_strolls_choose_player',
                targetType: 'button',
                titleKey: 'ui.titan_hill_that_strolls_choose_player_title',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: continuation?.titanUid,
            titanBaseIndex: continuation?.titanBaseIndex,
            minionUid: minion.uid,
            minionDefId: minion.defId,
            baseIndex: selected.baseIndex,
        };
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('titan_ignobles_the_hill_that_strolls_choose_player', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { targetPlayerId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanBaseIndex?: number; minionUid?: string; minionDefId?: string; baseIndex?: number };
        } | undefined)?.continuationContext;
        if (
            !selected?.targetPlayerId
            || !continuation?.minionUid
            || !continuation.minionDefId
            || continuation.baseIndex === undefined
            || !getLiveHillTalentContext(state.core, playerId, continuation)
        ) {
            return { state, events: [] };
        }

        const base = state.core.bases[continuation.baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === continuation.minionUid);
        if (!minion || minion.owner !== playerId || minion.controller !== playerId) {
            return { state, events: [] };
        }

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
            ...buildStandardDrawEvents(state.core, playerId, 1, random, timestamp),
        ];
        return { state, events };
    });

    registerInteractionHandler('titan_ignobles_the_hill_that_strolls_reclaim_minion', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        const liveContext = getLiveHillTalentContext(state.core, playerId, continuation);
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId || !liveContext || selected.baseIndex !== liveContext.titanBaseIndex) {
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
            continuationContext?: { titanUid?: string; titanBaseIndex?: number; minionUid?: string; minionDefId?: string; baseIndex?: number };
        } | undefined)?.continuationContext;
        const liveContext = getLiveHillTalentContext(state.core, playerId, continuation);
        if (
            !selected?.place
            || !continuation?.minionUid
            || !continuation.minionDefId
            || continuation.baseIndex === undefined
            || !liveContext
            || continuation.titanBaseIndex !== liveContext.titanBaseIndex
        ) {
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

        const titan = getTitanByUid(state.core, continuation.titanUid);
        if (
            !titan
            || titan.defId !== continuation.titanDefId
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
            || titan.location.baseIndex !== continuation.fromBaseIndex
        ) {
            return { state, events: [] };
        }

        const events: SmashUpEvent[] = [
            moveTitan(
                titan.uid,
                titan.defId,
                titan.location.baseIndex,
                continuation.toBaseIndex,
                'explorers_very_large_boulder_move',
                timestamp,
                continuation.toBaseDefId,
            ),
        ];

        const destroyTargets = getVeryLargeBoulderDestroyTargets(
            state.core,
            continuation.toBaseIndex,
            titan.powerCounters,
        );
        if (destroyTargets.length === 0) {
            return { state, events };
        }

        if (destroyTargets.length === 1) {
            const [target] = destroyTargets;
            const targetBase = state.core.bases[continuation.toBaseIndex];
            const targetMinion = targetBase?.minions.find(minion => minion.uid === target.uid);
            if (!targetMinion) return { state, events };
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: targetMinion.uid,
                minionDefId: targetMinion.defId,
                fromBaseIndex: continuation.toBaseIndex,
                destroyerId: playerId,
                reason: 'explorers_very_large_boulder_move',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: titan.uid,
                sourceDefId: titan.defId,
                sourceControllerId: playerId,
                sourceBaseIndex: continuation.toBaseIndex,
                sourceKind: 'nonAction',
            }));
            return { state, events };
        }

        const interaction = createSimpleChoice(
            `titan_explorers_very_large_boulder_destroy_${timestamp}`,
            playerId,
            '硕大圆石：选择要消灭的随从',
            buildMinionTargetOptions(destroyTargets, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' }),
            {
                sourceId: 'titan_explorers_very_large_boulder_destroy',
                targetType: 'minion',
                titleKey: 'ui.titan_very_large_boulder_destroy_title',
            },
        );
        (interaction.data as {
            continuationContext?: {
                titanUid: string;
                titanDefId: string;
                targetBaseIndex: number;
            };
        }).continuationContext = {
            titanUid: titan.uid,
            titanDefId: titan.defId,
            targetBaseIndex: continuation.toBaseIndex,
        };
        return { state: queueInteraction(state, interaction), events };
    });

    registerInteractionHandler('titan_explorers_very_large_boulder_destroy', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                targetBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        if (!selected?.minionUid || !continuation?.titanUid || !continuation.titanDefId || continuation.targetBaseIndex === undefined) {
            return { state, events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        if (
            !titan
            || titan.defId !== continuation.titanDefId
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
            || titan.location.baseIndex !== continuation.targetBaseIndex
        ) {
            return { state, events: [] };
        }

        const base = state.core.bases[continuation.targetBaseIndex];
        const target = base?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) {
            return { state, events: [] };
        }

        return {
            state,
            events: buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: continuation.targetBaseIndex,
                destroyerId: playerId,
                reason: 'explorers_very_large_boulder_move',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: titan.uid,
                sourceDefId: titan.defId,
                sourceControllerId: playerId,
                sourceBaseIndex: continuation.targetBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    registerInteractionHandler('titan_mega_troopers_megabot_move', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { move?: boolean } | undefined;
        const continuation = (data as { continuationContext?: Partial<ScoringTitanMoveContinuation> } | undefined)?.continuationContext;

        const events: SmashUpEvent[] = [];
        if (
            selected?.move
            && continuation?.titanUid
            && continuation.titanDefId
            && continuation.fromBaseIndex !== undefined
            && continuation.scoringBaseIndex !== undefined
        ) {
            const titan = getTitanByUid(state.core, continuation.titanUid);
            if (
                !titan
                || titan.defId !== continuation.titanDefId
                || titan.controllerId !== playerId
                || titan.location.zone !== 'base'
                || titan.location.baseIndex !== continuation.fromBaseIndex
            ) {
                return { state, events };
            }
            events.push(moveTitan(
                titan.uid,
                titan.defId,
                titan.location.baseIndex,
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
        const interaction = buildScoringTitanMoveInteraction({
            sourceId: 'titan_mega_troopers_megabot_move',
            id: `titan_mega_troopers_megabot_move_${next.titanUid}_${timestamp}`,
            playerId: next.controllerId,
            title: 'ui.titan_megabot_move_title',
            titleKey: 'ui.titan_megabot_move_title',
            titleNameKey: 'cards.mega_troopers_megabot.name',
            state: state.core,
            source: next,
            scoringBaseIndex: continuation.scoringBaseIndex,
            scoringBaseDefId: continuation.scoringBaseDefId,
            remaining: rest,
            now: timestamp,
        });

        return {
            state: queueInteraction(state, interaction),
            events,
        };
    });

    registerInteractionHandler('titan_tornados_category_5_move', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { move?: boolean } | undefined;
        const continuation = (data as { continuationContext?: Partial<ScoringTitanMoveContinuation> } | undefined)?.continuationContext;

        const events: SmashUpEvent[] = [];
        if (
            selected?.move
            && continuation?.titanUid
            && continuation.titanDefId
            && continuation.fromBaseIndex !== undefined
            && continuation.scoringBaseIndex !== undefined
        ) {
            const titan = getTitanByUid(state.core, continuation.titanUid);
            if (
                !titan
                || titan.defId !== continuation.titanDefId
                || titan.controllerId !== playerId
                || titan.location.zone !== 'base'
                || titan.location.baseIndex !== continuation.fromBaseIndex
            ) {
                return { state, events };
            }
            events.push(moveTitan(
                titan.uid,
                titan.defId,
                titan.location.baseIndex,
                continuation.scoringBaseIndex,
                'tornados_category_5_before_scoring',
                timestamp,
                continuation.scoringBaseDefId,
            ));
        }

        const remaining = continuation?.remaining ?? [];
        if (remaining.length === 0 || continuation?.scoringBaseIndex === undefined || !continuation.scoringBaseDefId) {
            return { state, events };
        }

        const [next, ...rest] = remaining;
        const interaction = buildScoringTitanMoveInteraction({
            sourceId: 'titan_tornados_category_5_move',
            id: `titan_tornados_category_5_move_${next.titanUid}_${timestamp}`,
            playerId: next.controllerId,
            title: '五级风暴：是否移动到将要计分的基地？',
            titleKey: 'ui.titan_megabot_move_title',
            titleNameKey: 'cards.tornados_category_5.name',
            state: state.core,
            source: next,
            scoringBaseIndex: continuation.scoringBaseIndex,
            scoringBaseDefId: continuation.scoringBaseDefId,
            remaining: rest,
            now: timestamp,
        });

        return {
            state: queueInteraction(state, interaction),
            events,
        };
    });

    registerInteractionHandler('titan_tornados_category_5_play', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string; skip?: boolean } | undefined;
        if (selected?.skip) {
            return { state, events: [] };
        }

        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
        if (selected?.baseIndex === undefined || !titan) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                playTitan(
                    titan,
                    playerId,
                    selected.baseIndex,
                    'tornados_category_5_special',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
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
        const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
        if (selected?.baseIndex === undefined || !titan) {
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
        const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
        if (selected?.baseIndex === undefined || !titan) {
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
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        const queuedTitan = getQueuedTimeBoxPlayPromptTitan(state.core, playerId, continuation);
        if (selected?.skip) {
            return queuedTitan
                ? {
                    state,
                    events: [
                        buildTimeBoxMetadataEvent(
                            queuedTitan.uid,
                            getTimeBoxCounter(queuedTitan),
                            'time_travelers_time_box_prompt_skip',
                            timestamp,
                            { armed: false },
                        ),
                    ],
                }
                : { state, events: [] };
        }

        const titan = getLiveTimeBoxPlayTitan(state.core, playerId, continuation);
        if (selected?.baseIndex === undefined || !titan) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                buildTimeBoxMetadataEvent(titan.uid, 0, 'time_travelers_time_box_prompt_play', timestamp, {
                    armed: false,
                }),
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

    registerInteractionHandler('titan_sharks_helicoprion_play', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string; skip?: boolean } | undefined;
        if (selected?.skip) {
            return { state, events: [] };
        }

        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
        if (selected?.baseIndex === undefined || !titan) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                buildHelicoprionMetadataEvent(titan.uid, 0, 'sharks_helicoprion_prompt_play', timestamp),
                playTitan(
                    titan,
                    playerId,
                    selected.baseIndex,
                    'sharks_helicoprion_prompt_play',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_sharks_helicoprion_reward', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as {
            skip?: boolean;
            action?: 'draw' | 'take_mako';
            cardUid?: string;
            defId?: string;
            sourceZone?: 'deck' | 'discard';
        } | undefined;
        if (selected?.skip) {
            return { state, events: [] };
        }
        if (selected?.action === 'draw') {
            return {
                state,
                events: buildStandardDrawEvents(state.core, playerId, 1, random, timestamp),
            };
        }
        if (!selected?.cardUid || !selected.defId || !selected.sourceZone) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        if (!player) {
            return { state, events: [] };
        }

        if (selected.sourceZone === 'deck') {
            const liveCard = player.deck.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
            if (!liveCard) {
                return { state, events: [] };
            }

            const events: SmashUpEvent[] = [createCardTransferEvent({
                card: createCardObjectRefFromInstance(liveCard),
                fromPlayerId: playerId,
                toPlayerId: playerId,
                reason: 'sharks_helicoprion_reward',
                timestamp,
            }) as SmashUpEvent];
            const shuffledRemaining = random.shuffle(player.deck.filter(card => card.uid !== selected.cardUid));
            if (shuffledRemaining.length > 0) {
                events.push({
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId, deckUids: shuffledRemaining.map(card => card.uid) },
                    timestamp,
                } as SmashUpEvent);
            }
            return { state, events };
        }

        const liveCard = player.discard.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
        if (!liveCard) {
            return { state, events: [] };
        }
        return {
            state,
            events: [recoverCardsFromDiscard(playerId, [selected.cardUid], 'sharks_helicoprion_reward', timestamp)],
        };
    });

    registerInteractionHandler('titan_pecos_bill_duel_start', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string; baseIndex?: number; baseDefId?: string };
        } | undefined)?.continuationContext;
        if (!state.core.activeDuel) return { state, events: [] };

        if (selected?.skip) {
            return { state: continueActiveDuel(state, timestamp), events: [] };
        }
        if (!selected?.cardUid || continuation?.baseIndex === undefined || !continuation.titanUid || !continuation.titanDefId) {
            return { state: continueActiveDuel(state, timestamp), events: [] };
        }

        const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
        const player = state.core.players[playerId];
        const discardedCard = player?.hand.find((card) => card.uid === selected.cardUid);
        if (
            !titan
            || !player
            || !discardedCard
        ) {
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
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        if (selected?.skip) {
            return { state, events: [] };
        }
        if (!selected?.cardUid || selected.baseIndex === undefined || !continuation?.titanUid || !continuation.titanDefId) {
            return { state, events: [] };
        }

        const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
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
            return { state, events: [] };
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

        return { state, events: [returnEvent] };
    });

    registerInteractionHandler('titan_sphinx_talent', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string; skip?: boolean } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; baseIndex?: number };
        } | undefined)?.continuationContext;
        if (selected?.skip) {
            return { state, events: [] };
        }
        if (!selected?.cardUid || !selected.defId) {
            return { state, events: [] };
        }
        const titan = continuation?.titanUid ? getTitanByUid(state.core, continuation.titanUid) : undefined;
        const baseIndex = titan?.location.zone === 'base' && titan.controllerId === playerId
            ? titan.location.baseIndex
            : continuation?.titanUid
                ? undefined
                : continuation?.baseIndex;
        if (baseIndex === undefined) {
            return { state, events: [] };
        }
        const trueOwnerId = state.core.players[playerId]?.hand.find(card => card.uid === selected.cardUid)?.owner ?? playerId;

        return {
            state,
            events: buildBuryCardEvents({
                core: state.core,
                matchState: state,
                playerId,
                cardUid: selected.cardUid,
                defId: selected.defId,
                baseIndex,
                trueOwnerId,
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
        if (
            !selected?.targetPlayerId
            || !titan
            || titan.defId !== continuation?.titanDefId
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
        ) {
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
            'ui.titan_moon_zero_three_resolve_title',
            [
                { id: 'top', label: '放回牌库顶', labelKey: 'ui.put_it_on_top', value: { placement: 'top' }, displayMode: 'button' as const },
                { id: 'bottom', label: '放到牌库底', labelKey: 'ui.put_it_on_bottom', value: { placement: 'bottom' }, displayMode: 'button' as const },
            ],
            {
                sourceId: 'titan_super_spies_moon_zero_three_resolve',
                targetType: 'button',
                displayCard: { defId: peek.card.defId },
                titleKey: 'ui.titan_moon_zero_three_resolve_title',
                titleParams: {
                    name: 'cards.super_spies_moon_zero_three.name',
                    playerLabel: getPlayerLabel(selected.targetPlayerId),
                    cardName: `cards.${peek.card.defId}.name`,
                },
            },
        );
        (nextInteraction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: titan.uid,
            titanDefId: titan.defId,
            targetPlayerId: selected.targetPlayerId,
            cardUid: peek.card.uid,
            defId: peek.card.defId,
            ownerId: peek.card.owner,
        };

        return {
            state: queueInteraction(state, nextInteraction),
            events: peek.events,
        };
    });

    registerInteractionHandler('titan_super_spies_moon_zero_three_resolve', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { placement?: 'top' | 'bottom' } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string; targetPlayerId?: string; cardUid?: string; defId?: string; ownerId?: string };
        } | undefined)?.continuationContext;
        if (!selected?.placement || !continuation?.targetPlayerId || !continuation.cardUid || !continuation.defId) {
            return { state, events: [] };
        }
        const liveContext = getLiveMoonZeroThreeTalentContext(state.core, _playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        if (selected.placement === 'top') {
            return { state, events: [] };
        }

        const ownerId = continuation.ownerId ?? continuation.targetPlayerId;
        return {
            state,
            events: [{
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: continuation.cardUid,
                    defId: continuation.defId,
                    ownerId,
                    ...(ownerId !== continuation.targetPlayerId ? { sourcePlayerId: continuation.targetPlayerId } : {}),
                    reason: 'super_spies_moon_zero_three_talent',
                },
                timestamp,
            } as SmashUpEvent],
        };
    });

    registerInteractionHandler('titan_penguins_emperor_penguin_talent', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string; zone?: 'hand' | 'discard' } | undefined;
        const continuation = (data as { continuationContext?: { titanUid?: string } } | undefined)?.continuationContext;
        if (!selected?.cardUid || !selected.defId || !selected.zone) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const titan = continuation?.titanUid
            ? getTitanByUid(state.core, continuation.titanUid)
            : getControlledTitanOnBase(state.core, 'penguins_emperor_penguin', playerId);
        if (!player || !titan) {
            return { state, events: [] };
        }
        if (titan.defId !== 'penguins_emperor_penguin' || titan.location.zone !== 'base' || titan.controllerId !== playerId) {
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
                ownerId: card.owner,
                reason: 'penguins_emperor_penguin_talent',
                sourcePlayerId: playerId,
            },
            timestamp,
        } as SmashUpEvent);
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: card.owner,
                deckUids: random.shuffle([...(state.core.players[card.owner]?.deck ?? []).map(candidate => candidate.uid), card.uid]),
                ...(card.owner !== playerId ? { sourcePlayerId: playerId } : {}),
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
        const liveContext = getLiveMergaconTalentContext(state.core, _playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.TITAN_ONGOING_SUPPRESSED,
                    payload: {
                        titanUid: liveContext.titanUid ?? continuation.titanUid,
                        reason: 'changerbots_mergacon_talent',
                    },
                    timestamp,
                } as SmashUpEvent,
                moveTitan(
                    liveContext.titanUid ?? continuation.titanUid,
                    liveContext.titanDefId,
                    liveContext.fromBaseIndex,
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
        const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
        const replacementEvent = getDeferredPostScoringEvents(state, data as Record<string, unknown> | undefined)?.find(
            event => event.type === SU_EVENTS.BASE_REPLACED,
        );
        const replacementBaseIndex = replacementEvent?.payload?.baseIndex;
        const replacementBaseDefId = replacementEvent?.payload?.newBaseDefId;
        if (!titan || !continuation?.titanDefId || typeof replacementBaseIndex !== 'number') {
            return { state, events: [] };
        }

        const pendingAction = {
            kind: 'playTitanOnReplacementBase' as const,
            titanUid: titan.uid,
            defId: continuation.titanDefId,
            ownerId: titan.ownerId,
            controllerId: titan.controllerId,
            baseIndex: replacementBaseIndex,
            targetBaseDefId: replacementBaseDefId,
            reason: 'itty_critters_rainboroc_special',
        };

        return {
            state: appendPendingPostScoringActions(state, [pendingAction]),
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
        const liveContext = getLiveRainborocTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const card = player?.discard.find(candidate => candidate.uid === selected.cardUid);
        if (!player || !card) {
            return { state, events: [] };
        }
        const ownerId = card.owner;
        const ownerDeck = state.core.players[ownerId]?.deck ?? [];

        const deckEvent: SmashUpEvent = {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: ownerId,
                deckUids: random.shuffle([...ownerDeck, card]).map(candidate => candidate.uid),
                ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
            },
            timestamp,
        };

        const baseOptions = getOtherBaseOptions(state.core, liveContext.fromBaseIndex);
        if (baseOptions.length === 0) {
            return {
                state,
                events: [deckEvent],
            };
        }

        const interaction = createSimpleChoice(
            `titan_itty_critters_rainboroc_choose_base_${timestamp}`,
            playerId,
            'ui.titan_rainboroc_choose_base_title',
            [
                ...buildBaseTargetOptions(baseOptions, state.core),
                { id: 'skip', label: '留在原地', labelKey: 'ui.stay_here', value: { skip: true }, displayMode: 'button' as const },
            ],
            {
                sourceId: 'titan_itty_critters_rainboroc_choose_base',
                targetType: 'base',
                titleKey: 'ui.titan_rainboroc_choose_base_title',
                titleParams: {
                    name: 'cards.itty_critters_rainboroc.name',
                },
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: liveContext.titanUid ?? continuation.titanUid,
            titanDefId: liveContext.titanDefId,
            fromBaseIndex: liveContext.fromBaseIndex,
        };

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
        const liveContext = getLiveRainborocTalentContext(state.core, _playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                moveTitan(
                    liveContext.titanUid ?? continuation.titanUid,
                    liveContext.titanDefId,
                    liveContext.fromBaseIndex,
                    selected.baseIndex,
                    'itty_critters_rainboroc_talent',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });

    registerInteractionHandler('titan_bear_cavalry_major_ursa_choose_destination', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; fromBaseIndex?: number; titanDefId?: string };
        } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.titanUid || continuation.fromBaseIndex === undefined || !continuation.titanDefId) {
            return { state, events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        if (
            !titan
            || titan.defId !== continuation.titanDefId
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
            || titan.location.baseIndex !== continuation.fromBaseIndex
        ) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                moveTitan(
                    titan.uid,
                    titan.defId,
                    titan.location.baseIndex,
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
        const continuation = (data as { continuationContext?: { titanUid?: string; fromBaseIndex?: number } } | undefined)?.continuationContext;
        if (!selected?.minionUid || !selected.defId || !continuation?.titanUid || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        if (
            !titan
            || titan.defId !== 'bear_cavalry_major_ursa'
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
            || titan.location.baseIndex !== continuation.fromBaseIndex
        ) {
            return { state, events: [] };
        }

        const baseOptions = getOtherBaseOptions(state.core, continuation.fromBaseIndex);
        if (baseOptions.length === 0) {
            return { state, events: [] };
        }

        const interaction = createSimpleChoice(
            `titan_bear_cavalry_major_ursa_choose_base_${timestamp}`,
            playerId,
            '大熊座：选择要将该随从移动到的基地',
            buildBaseTargetOptions(baseOptions, state.core),
            {
                sourceId: 'titan_bear_cavalry_major_ursa_choose_base',
                targetType: 'base',
                titleKey: 'ui.titan_major_ursa_choose_base_for_minion_title',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: continuation.titanUid,
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
            continuationContext?: { titanUid?: string; minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (
            selected?.baseIndex === undefined
            || !continuation?.titanUid
            || !continuation.minionUid
            || !continuation.minionDefId
            || continuation.fromBaseIndex === undefined
        ) {
            return { state, events: [] };
        }
        const sourceTitan = (state.core.titans ?? []).find(titan =>
            titan.uid === continuation.titanUid
            && titan.defId === 'bear_cavalry_major_ursa'
            && titan.location.zone === 'base',
        );
        if (!sourceTitan) {
            return { state, events: [] };
        }

        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: continuation.minionUid,
                minionDefId: continuation.minionDefId,
                fromBaseIndex: continuation.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                toBaseDefId: selected.baseDefId,
                reason: 'bear_cavalry_major_ursa',
                now: timestamp,
                sourcePlayerId: sourceTitan.controllerId,
                sourceCardUid: sourceTitan.uid,
                sourceDefId: sourceTitan.defId,
                sourceControllerId: sourceTitan.controllerId,
                sourceBaseIndex: sourceTitan.location.baseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    registerInteractionHandler('titan_ghosts_creampuff_man_discard', (state, playerId, value, data, _random, timestamp) => {
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
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        const titanBaseIndex = getLiveCreampuffTitanBaseIndex(state.core, playerId, continuation);
        if (titanBaseIndex === undefined) {
            return { state, events: [discardEvent] };
        }

        const interaction = createSimpleChoice(
            `titan_ghosts_creampuff_man_play_${timestamp}`,
            playerId,
            '奶油泡芙美人：选择要从弃牌堆额外打出的标准战术',
            actionOptions,
            {
                sourceId: 'titan_ghosts_creampuff_man_play',
                targetType: 'generic',
                titleKey: 'ui.titan_creampuff_man_play_title',
            },
        );
        (interaction.data as { optionsGenerator?: unknown; continuationContext?: unknown }).optionsGenerator = (nextState: AbilityContext['matchState']) =>
            buildCreampuffActionOptions(nextState, playerId);
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: continuation?.titanUid,
            titanBaseIndex,
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

        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        const baseIndex = getLiveCreampuffTitanBaseIndex(state.core, playerId, continuation);
        if (baseIndex === undefined) {
            return { state, events: [] };
        }
        const effectiveHandSize = getExternalActionEffectiveHandSize(state, playerId);
        const targetMode = getCreampuffActionTargetMode(selected.defId);
        if (targetMode && targetMode !== 'none') {
            const targetOptions = buildCreampuffActionTargetOptions(state.core, playerId, actionCard, effectiveHandSize);
            if (targetOptions.length === 0) {
                return { state, events: [] };
            }
            const interaction = createSimpleChoice(
                `titan_ghosts_creampuff_man_action_target_${timestamp}`,
                playerId,
                '奶油泡芙美人：选择额外行动的目标',
                targetOptions,
                {
                    sourceId: 'titan_ghosts_creampuff_man_action_target',
                    targetType: targetMode,
                    responseValidationMode: 'live',
                    titleKey: 'ui.titan_creampuff_man_action_target_title',
                },
            );
            (interaction.data as { optionsGenerator?: unknown; continuationContext?: unknown }).optionsGenerator = (nextState: AbilityContext['matchState']) => {
                const nextPlayer = nextState.core.players[playerId];
                const nextCard = nextPlayer?.discard.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
                if (!nextCard) return [];
                return buildCreampuffActionTargetOptions(
                    nextState.core,
                    playerId,
                    nextCard,
                    getExternalActionEffectiveHandSize(nextState, playerId),
                );
            };
            (interaction.data as { continuationContext?: unknown }).continuationContext = {
                cardUid: selected.cardUid,
                defId: selected.defId,
                titanUid: continuation?.titanUid,
                titanBaseIndex: baseIndex,
            };
            return {
                state: queueInteraction(state, interaction),
                events: [],
            };
        }

        return resolveCreampuffActionPlay({
            state,
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            random,
            timestamp,
            titanBaseIndex: baseIndex,
        });
    });

    registerInteractionHandler('titan_ghosts_creampuff_man_action_target', (state, playerId, value, data, random, timestamp) => {
        const selected = value as { cardUid?: string; defId?: string; targetBaseIndex?: number; targetMinionUid?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { cardUid?: string; defId?: string; titanUid?: string; titanBaseIndex?: number };
        } | undefined)?.continuationContext;
        const cardUid = selected?.cardUid ?? continuation?.cardUid;
        const defId = selected?.defId ?? continuation?.defId;
        if (!cardUid || !defId) {
            return { state, events: [] };
        }
        const titanBaseIndex = getLiveCreampuffTitanBaseIndex(state.core, playerId, continuation);
        if (titanBaseIndex === undefined) {
            return { state, events: [] };
        }
        return resolveCreampuffActionPlay({
            state,
            playerId,
            cardUid,
            defId,
            random,
            timestamp,
            titanBaseIndex,
            targetBaseIndex: selected?.targetBaseIndex,
            targetMinionUid: selected?.targetMinionUid,
        });
    });

    registerInteractionHandler('titan_fairies_spirit_of_the_forest_clash_move', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { skip?: boolean; baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; fromBaseIndex?: number; visitedBaseIndices?: number[] };
        } | undefined)?.continuationContext;
        const titan = continuation?.titanUid ? getTitanByUid(state.core, continuation.titanUid) : undefined;
        if (
            !titan
            || titan.defId !== 'fairies_spirit_of_the_forest'
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
            || titan.location.baseIndex !== continuation?.fromBaseIndex
        ) {
            return { state, events: [] };
        }

        if (
            selected?.baseIndex !== undefined
            && continuation?.fromBaseIndex !== undefined
            && selected.baseIndex !== continuation.fromBaseIndex
        ) {
            const visitedBaseIndices = Array.isArray(continuation.visitedBaseIndices)
                ? continuation.visitedBaseIndices.filter((baseIndex): baseIndex is number => typeof baseIndex === 'number')
                : [];
            const nextVisitedBaseIndices = [...new Set([...visitedBaseIndices, continuation.fromBaseIndex])];
            return {
                state,
                events: [
                    moveTitan(
                        titan.uid,
                        titan.defId,
                        continuation.fromBaseIndex,
                        selected.baseIndex,
                        'fairies_spirit_of_the_forest_clash_move',
                        timestamp,
                        selected.baseDefId,
                        { spiritOfTheForestClashVisitedBaseIndices: nextVisitedBaseIndices },
                    ),
                ],
            };
        }

        return {
            state,
            events: [removeTitanFromPlay(titan, 'titan_clash', timestamp)],
        };
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
            && candidate.controllerId === playerId
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

    registerInteractionHandler('titan_vampires_ancient_lord_talent', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
            };
        } | undefined)?.continuationContext;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const liveContext = getLiveAncientLordTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }
        return {
            state,
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'vampires_ancient_lord_talent', timestamp)],
        };
    });

    registerInteractionHandler('titan_cthulhu_cthulhu_titan_talent_choice', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CthulhuTitanTalentChoiceValue | undefined;
        if (!selected) return { state, events: [] };
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
            };
        } | undefined)?.continuationContext;
        const liveContext = getLiveCthulhuTitanTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        if (selected.choice === 'draw') {
            const madnessEvent = drawMadnessCards(playerId, 1, state.core, 'cthulhu_cthulhu_titan_talent', timestamp);
            return { state, events: madnessEvent ? [madnessEvent] : [] };
        }

        if (selected.choice === 'give') {
            const nextState = queueCthulhuTitanTransferInteraction(state, state.core, playerId, timestamp, liveContext);
            return nextState ? { state: nextState, events: [] } : { state, events: [] };
        }

        return { state, events: [] };
    });

    registerInteractionHandler('titan_cthulhu_cthulhu_titan_talent_target', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CthulhuTitanTransferChoiceValue | undefined;
        if (!selected?.targetPlayerId || !selected.madnessUid) {
            return { state, events: [] };
        }
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
            };
        } | undefined)?.continuationContext;
        const liveContext = getLiveCthulhuTitanTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const madnessCard = player?.hand.find(card =>
            card.uid === selected.madnessUid && card.defId === MADNESS_CARD_DEF_ID,
        );
        if (!player || !madnessCard || !state.core.players[selected.targetPlayerId]) {
            return { state, events: [] };
        }

        const transferEvent: CardTransferredEvent = createCardTransferEvent({
            card: createCardObjectRefFromInstance(madnessCard),
            fromPlayerId: playerId,
            toPlayerId: selected.targetPlayerId,
            reason: 'cthulhu_cthulhu_titan_talent',
            timestamp,
        });
        return { state, events: [transferEvent] };
    });

    registerInteractionHandler('titan_pirates_the_kraken_play_replacement', (state, playerId, value, data, _random, _timestamp) => {
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
            const titan = getLiveSetAsideTitanPlayPromptTitan(state.core, playerId, continuation);
            const replacementBaseDefId = getDeferredReplacementBaseDefId(state, data as Record<string, unknown> | undefined);
            if (titan && replacementBaseDefId) {
                const pendingAction = {
                    kind: 'playTitanOnReplacementBase' as const,
                    titanUid: titan.uid,
                    defId: continuation.titanDefId,
                    ownerId: continuation.ownerId,
                    controllerId: continuation.controllerId,
                    baseIndex: continuation.scoringBaseIndex,
                    targetBaseDefId: replacementBaseDefId,
                    reason: 'pirates_the_kraken_after_scoring_play',
                };
                nextState = appendPendingPostScoringActions(state, [pendingAction]);
            }
        }

        return { state: nextState, events };
    });

    registerInteractionHandler('titan_pirates_the_kraken_choose_minion', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as {
            skip?: boolean;
            minionUid?: string;
            targetMinionUid?: string;
            targetUid?: string;
            defId?: string;
            minionDefId?: string;
            targetMinionDefId?: string;
            targetDefId?: string;
            baseIndex?: number;
        } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                controllerId?: string;
                scoringBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        if (selected?.skip || continuation?.scoringBaseIndex === undefined || continuation.controllerId !== playerId) {
            return { state, events: [] };
        }
        const targetMinionUid = selected?.targetMinionUid ?? selected?.targetUid ?? selected?.minionUid;
        const targetDefId = selected?.targetMinionDefId ?? selected?.targetDefId ?? selected?.minionDefId ?? selected?.defId;
        if (!targetMinionUid || !targetDefId) {
            return { state, events: [] };
        }

        const titan = continuation.titanUid ? getTitanByUid(state.core, continuation.titanUid) : undefined;
        if (
            !titan
            || titan.defId !== continuation.titanDefId
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
            || titan.location.baseIndex !== continuation.scoringBaseIndex
        ) {
            return { state, events: [] };
        }

        const sourceBase = state.core.bases[continuation.scoringBaseIndex];
        const selectedMinion = sourceBase?.minions.find(minion =>
            minion.uid === targetMinionUid
            && minion.defId === targetDefId
            && minion.controller === continuation.controllerId,
        );
        if (!selectedMinion) {
            return { state, events: [] };
        }

        const baseOptions = getOtherBaseOptions(state.core, continuation.scoringBaseIndex);
        if (baseOptions.length === 0) {
            return { state, events: [] };
        }

        const interaction = createSimpleChoice(
            `titan_pirates_the_kraken_choose_base_${selectedMinion.uid}_${timestamp}`,
            playerId,
            '克拉肯：选择要移动到的基地',
            buildBaseTargetOptions(baseOptions, state.core),
            {
                sourceId: 'titan_pirates_the_kraken_choose_base',
                targetType: 'base',
                titleKey: 'ui.titan_kraken_choose_base_title',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: (data as {
                continuationContext?: { titanUid?: string; titanDefId?: string };
            } | undefined)?.continuationContext?.titanUid,
            titanDefId: (data as {
                continuationContext?: { titanUid?: string; titanDefId?: string };
            } | undefined)?.continuationContext?.titanDefId,
            minionUid: selectedMinion.uid,
            minionDefId: selectedMinion.defId,
            fromBaseIndex: continuation.scoringBaseIndex,
        };

        const queuedState = queueInteraction(state, interaction, { urgent: true });
        const currentInteraction = queuedState.sys.interaction.current;
        const [nextInteraction, ...remainingQueue] = queuedState.sys.interaction.queue;
        if (!nextInteraction) {
            return {
                state: queuedState,
                events: [],
            };
        }

        return {
            state: syncActiveResolutionWithInteraction({
                ...queuedState,
                sys: {
                    ...queuedState.sys,
                    interaction: {
                        ...queuedState.sys.interaction,
                        current: nextInteraction,
                        queue: currentInteraction
                            ? [currentInteraction, ...remainingQueue]
                            : remainingQueue,
                    },
                },
            }),
            events: [],
        };
    });

    registerInteractionHandler('titan_pirates_the_kraken_choose_base', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                titanDefId?: string;
                minionUid?: string;
                minionDefId?: string;
                fromBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        if (
            selected?.baseIndex === undefined
            || !continuation?.minionUid
            || !continuation.minionDefId
            || !continuation.titanDefId
            || continuation.fromBaseIndex === undefined
        ) {
            return { state, events: [] };
        }
        const liveContext = getLiveKrakenTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        const sourceBase = state.core.bases[liveContext.fromBaseIndex];
        const liveMinion = sourceBase?.minions.find(minion => minion.uid === continuation.minionUid);
        const baseOptions = getOtherBaseOptions(state.core, liveContext.fromBaseIndex);
        if (!liveMinion || !baseOptions.some(base => base.baseIndex === selected.baseIndex)) {
            return { state, events: [] };
        }

        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: liveMinion.uid,
                minionDefId: liveMinion.defId,
                fromBaseIndex: liveContext.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                toBaseDefId: selected.baseDefId,
                reason: 'pirates_the_kraken_after_scoring_move',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: liveContext.titanUid ?? continuation.titanUid,
                sourceDefId: liveContext.titanDefId,
                sourceControllerId: playerId,
                sourceBaseIndex: liveContext.fromBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    registerInteractionHandler('titan_pirates_the_kraken_talent', (state, playerId, value, data, _random, timestamp) => {
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
        const liveContext = getLiveKrakenTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        const expiresOnTurnNumber = state.core.turnNumber + state.core.turnOrder.length;
        const events: SmashUpEvent[] = [
            moveTitan(
                liveContext.titanUid ?? continuation.titanUid,
                liveContext.titanDefId,
                liveContext.fromBaseIndex,
                selected.baseIndex,
                'pirates_the_kraken_talent',
                timestamp,
                selected.baseDefId,
            ),
        ];

        const targetBase = state.core.bases[selected.baseIndex];
        for (const minion of targetBase?.minions ?? []) {
            if (minion.controller === playerId) continue;
            events.push(addPermanentPower(
                minion.uid,
                selected.baseIndex,
                -1,
                'pirates_the_kraken_talent',
                timestamp,
                { expiresOnTurnNumber },
            ));
        }

        return { state, events };
    });

    registerInteractionHandler('titan_tricksters_big_funny_giant_choose_minion', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string; fromBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        if (!continuation?.titanUid || !continuation.titanDefId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }
        const liveContext = getLiveBigFunnyGiantTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        const baseOptions = getOtherBaseOptions(state.core, liveContext.fromBaseIndex);
        if (baseOptions.length === 0) {
            return { state, events: [] };
        }

        const interaction = createSimpleChoice(
            `titan_tricksters_big_funny_giant_choose_base_${timestamp}`,
            playerId,
            '滑稽巨人：选择要移动到的基地',
            buildBaseTargetOptions(baseOptions, state.core),
            {
                sourceId: 'titan_tricksters_big_funny_giant_choose_base',
                targetType: 'base',
                titleKey: 'ui.titan_big_funny_giant_choose_base_title',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            titanUid: liveContext.titanUid ?? continuation.titanUid,
            titanDefId: liveContext.titanDefId,
            fromBaseIndex: liveContext.fromBaseIndex,
            minionUid: selected.minionUid,
            minionDefId: selected.defId,
            minionBaseIndex: selected.baseIndex,
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
                titanUid?: string;
                titanDefId?: string;
                fromBaseIndex?: number;
                minionUid?: string;
                minionDefId?: string;
                minionBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        if (
            selected?.baseIndex === undefined
            || !continuation?.titanUid
            || !continuation.titanDefId
            || continuation.fromBaseIndex === undefined
            || !continuation.minionUid
            || !continuation.minionDefId
            || continuation.minionBaseIndex === undefined
        ) {
            return { state, events: [] };
        }
        const liveContext = getLiveBigFunnyGiantTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
            return { state, events: [] };
        }

        const base = state.core.bases[continuation.minionBaseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === continuation.minionUid);
        if (!base || !minion) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                ...buildValidatedDestroyEvents(state, {
                    minionUid: continuation.minionUid,
                    minionDefId: continuation.minionDefId,
                    fromBaseIndex: continuation.minionBaseIndex,
                    destroyerId: playerId,
                    reason: 'tricksters_big_funny_giant_talent',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceCardUid: liveContext.titanUid ?? continuation.titanUid,
                    sourceDefId: liveContext.titanDefId,
                    sourceControllerId: playerId,
                    sourceBaseIndex: liveContext.fromBaseIndex,
                    sourceKind: 'nonAction',
                }),
                moveTitan(
                    liveContext.titanUid ?? continuation.titanUid,
                    liveContext.titanDefId,
                    liveContext.fromBaseIndex,
                    selected.baseIndex,
                    'tricksters_big_funny_giant_talent',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
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

    registerInteractionHandler('titan_tricksters_big_funny_giant_pod_counter', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { add?: boolean; skip?: boolean } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        if (!selected?.add || selected.skip || !continuation?.titanUid || continuation.titanDefId !== 'tricksters_big_funny_giant_pod') {
            return { state, events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        if (!titan || titan.defId !== 'tricksters_big_funny_giant_pod' || titan.location.zone !== 'base') {
            return { state, events: [] };
        }

        return {
            state,
            events: [addTitanPowerCounter(titan.uid, 1, 'tricksters_big_funny_giant_pod_turn_end', timestamp)],
        };
    });

    registerInteractionHandler('titan_werewolves_great_wolf_spirit_talent', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string };
        } | undefined)?.continuationContext;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const liveContext = getLiveGreatWolfSpiritTalentContext(state.core, playerId, continuation);
        if (!liveContext) {
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

    registerInteractionHandler('titan_werewolves_great_wolf_spirit_move', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { skip?: boolean; baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: { titanUid?: string; titanDefId?: string; fromBaseIndex?: number };
        } | undefined)?.continuationContext;
        if (selected?.skip) {
            return { state, events: [] };
        }
        if (
            selected?.baseIndex === undefined
            || !continuation?.titanUid
            || !continuation.titanDefId
            || continuation.fromBaseIndex === undefined
        ) {
            return { state, events: [] };
        }

        const titan = getTitanByUid(state.core, continuation.titanUid);
        if (
            !titan
            || titan.defId !== continuation.titanDefId
            || titan.controllerId !== playerId
            || titan.location.zone !== 'base'
            || titan.location.baseIndex !== continuation.fromBaseIndex
        ) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                moveTitan(
                    titan.uid,
                    titan.defId,
                    titan.location.baseIndex,
                    selected.baseIndex,
                    'werewolves_great_wolf_spirit_move',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    });
}
