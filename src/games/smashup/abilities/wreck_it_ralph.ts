import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    grantContextualExtraAction,
} from '../domain/abilityHelpers';
import { createEffectProgram } from '../domain/abilityRuntime';
import { registerActiveBaseAbility, registerBaseAbility } from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import {
    registerCardAbilitySuppression,
    registerTrigger,
} from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import type {
    BaseReplacedEvent,
    CardSuppressedEvent,
    MinionMetadataUpdatedEvent,
    OngoingAttachedEvent,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getMinionDef } from '../data/cards';
import {
    collectBaseModifiers,
    collectMinions,
    cardToDeckTop,
    firstOtherBaseIndex,
    getActionControllerId,
    isBaseModifier,
    moveMinionToBase,
    recoverFirstDiscardCard,
} from './disney_shared';

const RALPH = 'wreck_it_ralph_wreck_it_ralph';
const FELIX = 'wreck_it_ralph_fix_it_felix_jr';
const VANELLOPE = 'wreck_it_ralph_vanellope_von_schweetz';
const CALHOUN = 'wreck_it_ralph_sergeant_calhoun';
const SUGAR_RUSH_RACER = 'wreck_it_ralph_sugar_rush_racer';
const CY_BUG_INFESTATION = 'wreck_it_ralph_cy_bug_infestation';
const ESCAPE_POD = 'wreck_it_ralph_escape_pod';
const IM_GONNA_WRECK_IT = 'wreck_it_ralph_i_m_gonna_wreck_it';
const KART_BAKERY = 'wreck_it_ralph_kart_bakery';
const KING_CANDY = 'wreck_it_ralph_king_candy';
const MINTS_ERUPTION = 'wreck_it_ralph_mints_eruption';
const RESEARCH_LAB_BEACON = 'wreck_it_ralph_research_lab_beacon';
const SUGAR_RUSH = 'wreck_it_ralph_sugar_rush';
const BASE_THE_DUMP = 'base_the_dump';
const BASE_THE_POWER_STRIP = 'base_the_power_strip';

function source(ctx: AbilityContext) {
    return {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    };
}

function firstOwnMinionHere(ctx: AbilityContext) {
    return ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.controller === ctx.playerId);
}

function ralphTalent(ctx: AbilityContext): AbilityResult {
    const baseModifier = collectBaseModifiers(ctx.state, ctx.baseIndex)[0];
    if (baseModifier) {
        return {
            events: buildValidatedOngoingDetachEvents(ctx.state, {
                cardUid: baseModifier.action.uid,
                defId: baseModifier.action.defId,
                ownerId: baseModifier.action.ownerId,
                reason: RALPH,
                now: ctx.now,
                expectedLocation: 'base',
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            }),
        };
    }
    const handBaseModifier = ctx.state.players[ctx.playerId]?.hand.find(card => isBaseModifier(card.defId));
    if (!handBaseModifier) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [grantContextualExtraAction(ctx, RALPH, {
            restrictToBase: ctx.baseIndex,
            restrictToCardUid: handBaseModifier.uid,
        })],
    };
}

function felixOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: recoverFirstDiscardCard(ctx, card => isBaseModifier(card.defId), FELIX) };
}

function felixTalent(ctx: AbilityContext): AbilityResult {
    const baseModifier = collectBaseModifiers(ctx.state, ctx.baseIndex)[0];
    if (!baseModifier) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [cardToDeckTop(
            baseModifier.action.uid,
            baseModifier.action.defId,
            baseModifier.action.ownerId,
            FELIX,
            ctx.now,
            ctx.playerId,
            ctx.cardUid,
            ctx.baseIndex,
        )],
    };
}

function vanellopeTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const self = base?.minions.find(minion => minion.uid === ctx.cardUid && minion.controller === ctx.playerId);
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (!self || toBaseIndex === undefined) return { events: [] };
    return {
        events: [
            ...moveMinionToBase(ctx.matchState, self, ctx.baseIndex, toBaseIndex, ctx.playerId, VANELLOPE, ctx.now),
            addPowerCounter(self.uid, toBaseIndex, 1, VANELLOPE, ctx.now, source(ctx)),
        ],
    };
}

function calhounTalent(ctx: AbilityContext): AbilityResult {
    const hasBaseModifier = collectBaseModifiers(ctx.state, ctx.baseIndex).length > 0;
    if (!hasBaseModifier) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
            .filter(minion => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid)
            .map(minion => addTempPower(minion.uid, ctx.baseIndex, 1, CALHOUN, ctx.now, source(ctx))),
    };
}

function sugarRushRacerOnBaseModifier(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || ctx.actionTargetBaseIndex === undefined) return [];
    if (!ctx.triggerCardDefId || !isBaseModifier(ctx.triggerCardDefId)) return [];
    const sourceBaseIndex = ctx.sourceBaseIndex;
    if (sourceBaseIndex === undefined) return [];
    const sourceBase = ctx.state.bases[sourceBaseIndex];
    const racer = sourceBase?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!racer) return [];
    const toBaseIndex = sourceBaseIndex === ctx.actionTargetBaseIndex
        ? firstOtherBaseIndex(ctx.state, sourceBaseIndex)
        : ctx.actionTargetBaseIndex;
    if (toBaseIndex === undefined) return [];
    return [
        ...moveMinionToBase(ctx.matchState ?? ctx.state, racer, sourceBaseIndex, toBaseIndex, ctx.sourceControllerId, SUGAR_RUSH_RACER, ctx.now),
        addTempPower(racer.uid, toBaseIndex, 1, SUGAR_RUSH_RACER, ctx.now, {
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: SUGAR_RUSH_RACER,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex,
        }),
    ];
}

function cyBugInfestationTalent(ctx: AbilityContext): AbilityResult {
    const baseModifier = collectBaseModifiers(ctx.state, ctx.baseIndex)
        .find(entry => entry.action.uid === ctx.cardUid);
    if (!baseModifier) return { events: [] };
    return {
        events: buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            ownerId: baseModifier.action.ownerId,
            reason: CY_BUG_INFESTATION,
            now: ctx.now,
            expectedLocation: 'base',
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }),
    };
}

function escapePodMove(ctx: AbilityContext, maxCount: number): AbilityResult {
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (toBaseIndex === undefined) return { events: [] };
    const targets = (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === ctx.playerId)
        .slice(0, maxCount);
    return {
        events: targets.flatMap(minion =>
            moveMinionToBase(ctx.matchState, minion, ctx.baseIndex, toBaseIndex, ctx.playerId, ESCAPE_POD, ctx.now)),
    };
}

function iAmGonnaWreckItTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.BASE_ABILITY_SUPPRESSED,
            payload: {
                baseIndex: ctx.baseIndex,
                suppressorPlayerId: ctx.playerId,
                reason: IM_GONNA_WRECK_IT,
                ...source(ctx),
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function kartBakeryTalent(ctx: AbilityContext): AbilityResult {
    if (!firstOwnMinionHere(ctx)) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function kingCandyTalent(ctx: AbilityContext): AbilityResult {
    const current = collectBaseModifiers(ctx.state, ctx.baseIndex).find(entry => entry.action.uid === ctx.cardUid);
    const destinationBaseIndex = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (!current || destinationBaseIndex === undefined) return { events: [] };
    const target = ctx.state.bases[destinationBaseIndex]?.minions[0]
        ?? ctx.state.bases[ctx.baseIndex]?.minions[0];
    return {
        events: [
            {
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: ctx.cardUid,
                    defId: ctx.defId,
                    ownerId: current.action.ownerId,
                    sourcePlayerId: ctx.playerId,
                    targetType: 'base',
                    targetBaseIndex: destinationBaseIndex,
                    metadata: {
                        ...(current.action.metadata ?? {}),
                        kingCandyTargetMinionUid: target?.uid,
                    },
                    talentUsed: true,
                },
                timestamp: ctx.now,
            } as OngoingAttachedEvent,
            ...(target?.attachedActions ?? []).map(action => ({
                type: SU_EVENTS.CARD_SUPPRESSED,
                payload: {
                    cardUid: action.uid,
                    baseIndex: destinationBaseIndex,
                    suppressorPlayerId: ctx.playerId,
                    cardType: 'attached',
                    reason: KING_CANDY,
                    ...source(ctx),
                },
                timestamp: ctx.now,
            } as CardSuppressedEvent)),
            ...(target
                ? [{
                    type: SU_EVENTS.MINION_METADATA_UPDATED,
                    payload: {
                        minionUid: target.uid,
                        baseIndex: destinationBaseIndex,
                        metadataUpdate: {
                            kingCandyCounterSuppressedBy: ctx.cardUid,
                            kingCandyCounterSuppressedByPlayerId: ctx.playerId,
                        },
                        reason: KING_CANDY,
                    },
                    timestamp: ctx.now,
                } as MinionMetadataUpdatedEvent]
                : []),
        ],
    };
}

function mintsEruption(ctx: AbilityContext): AbilityResult {
    const replacement = ctx.state.baseDiscard?.[0];
    if (!replacement) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [{
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex: ctx.baseIndex,
                oldBaseDefId: ctx.state.bases[ctx.baseIndex]?.defId,
                newBaseDefId: replacement,
                keepCards: true,
                allowMissingFromBaseDeck: true,
            },
            timestamp: ctx.now,
        } as BaseReplacedEvent],
    };
}

function researchLabBeaconTalent(ctx: AbilityContext): AbilityResult {
    const sourceFaction = ctx.state.bases[ctx.baseIndex]?.minions[0]
        ? getMinionDef(ctx.state.bases[ctx.baseIndex].minions[0].defId)?.faction
        : undefined;
    if (!sourceFaction) return { events: [] };
    return {
        events: collectMinions(ctx.state, minion => getMinionDef(minion.defId)?.faction === sourceFaction)
            .filter(entry => entry.baseIndex !== ctx.baseIndex)
            .flatMap(entry => buildValidatedMoveEvents(ctx.matchState, {
                minionUid: entry.minion.uid,
                minionDefId: entry.minion.defId,
                fromBaseIndex: entry.baseIndex,
                toBaseIndex: ctx.baseIndex,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'action',
                reason: RESEARCH_LAB_BEACON,
                now: ctx.now,
            })),
    };
}

function researchLabBeaconSelfDestruct(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    if (!base || base.minions.length < 4) return [];
    return buildValidatedOngoingDetachEvents(ctx.state, {
        cardUid: ctx.sourceCardUid,
        defId: RESEARCH_LAB_BEACON,
        ownerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
        reason: RESEARCH_LAB_BEACON,
        now: ctx.now,
        expectedLocation: 'base',
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: RESEARCH_LAB_BEACON,
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    });
}

function sugarRushTalent(ctx: AbilityContext): AbilityResult {
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (toBaseIndex === undefined) return { events: [] };
    const targets = (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === ctx.playerId)
        .slice(0, 2);
    return {
        events: targets.flatMap(minion => [
            ...moveMinionToBase(ctx.matchState, minion, ctx.baseIndex, toBaseIndex, ctx.playerId, SUGAR_RUSH, ctx.now),
            addTempPower(minion.uid, toBaseIndex, 1, SUGAR_RUSH, ctx.now, source(ctx)),
        ]),
    };
}

function theDumpAfterScoring(ctx: BaseAbilityContext): AbilityResult {
    const baseModifier = collectBaseModifiers(ctx.state, ctx.baseIndex)
        .find(entry => getActionControllerId(entry.action) === ctx.playerId);
    if (!baseModifier) return { events: [] };
    return {
        events: [{
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: baseModifier.action.uid,
                defId: baseModifier.action.defId,
                ownerId: baseModifier.action.ownerId,
                destination: 'hand',
                reason: BASE_THE_DUMP,
                sourcePlayerId: ctx.playerId,
                sourceDefId: BASE_THE_DUMP,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function powerStripActive(ctx: BaseAbilityContext): AbilityResult {
    const fromHere = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.controller === ctx.playerId);
    const other = collectMinions(ctx.state, (minion, baseIndex) => minion.controller === ctx.playerId && baseIndex !== ctx.baseIndex)[0];
    if (fromHere) {
        const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
        if (toBaseIndex === undefined) return { events: [] };
        return {
            events: moveMinionToBase(ctx.matchState ?? ctx.state, fromHere, ctx.baseIndex, toBaseIndex, ctx.playerId, BASE_THE_POWER_STRIP, ctx.now),
        };
    }
    if (other) {
        return {
            events: moveMinionToBase(ctx.matchState ?? ctx.state, other.minion, other.baseIndex, ctx.baseIndex, ctx.playerId, BASE_THE_POWER_STRIP, ctx.now),
        };
    }
    return { events: [] };
}

export function registerWreckItRalphAbilities(): void {
    registerAbilityProgram(RALPH, 'talent', { program: createEffectProgram(ralphTalent) });
    registerAbilityProgram(FELIX, 'onPlay', { program: createEffectProgram(felixOnPlay) });
    registerAbilityProgram(FELIX, 'talent', { program: createEffectProgram(felixTalent) });
    registerAbilityProgram(VANELLOPE, 'talent', { program: createEffectProgram(vanellopeTalent) });
    registerAbilityProgram(CALHOUN, 'talent', { program: createEffectProgram(calhounTalent) });
    registerAbilityProgram(CY_BUG_INFESTATION, 'talent', { program: createEffectProgram(cyBugInfestationTalent) });
    registerAbilityProgram(ESCAPE_POD, 'onPlay', { program: createEffectProgram(ctx => escapePodMove(ctx, 2)) });
    registerAbilityProgram(ESCAPE_POD, 'special', { program: createEffectProgram(ctx => escapePodMove(ctx, 1)) });
    registerAbilityProgram(IM_GONNA_WRECK_IT, 'talent', { program: createEffectProgram(iAmGonnaWreckItTalent) });
    registerAbilityProgram(KART_BAKERY, 'talent', { program: createEffectProgram(kartBakeryTalent) });
    registerAbilityProgram(KING_CANDY, 'talent', { program: createEffectProgram(kingCandyTalent) });
    registerAbilityProgram(MINTS_ERUPTION, 'onPlay', { program: createEffectProgram(mintsEruption) });
    registerAbilityProgram(RESEARCH_LAB_BEACON, 'talent', { program: createEffectProgram(researchLabBeaconTalent) });
    registerAbilityProgram(SUGAR_RUSH, 'talent', { program: createEffectProgram(sugarRushTalent) });

    registerTrigger(SUGAR_RUSH_RACER, 'onActionPlayed', sugarRushRacerOnBaseModifier, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => !!ctx.triggerCardDefId && isBaseModifier(ctx.triggerCardDefId),
    });
    registerTrigger(RESEARCH_LAB_BEACON, 'onMinionPlayed', researchLabBeaconSelfDestruct, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerCardAbilitySuppression(KING_CANDY, (state) => {
        const suppressed: string[] = [];
        for (const base of state.bases) {
            const targets = new Set(base.ongoingActions
                .filter(action => action.defId === KING_CANDY)
                .map(action => action.metadata?.kingCandyTargetMinionUid)
                .filter((uid): uid is string => typeof uid === 'string'));
            if (targets.size === 0) continue;
            for (const minion of base.minions) {
                if (!targets.has(minion.uid)) continue;
                suppressed.push(...minion.attachedActions.map(action => action.uid));
            }
        }
        return suppressed;
    });

    registerBaseAbility(BASE_THE_DUMP, 'afterScoring', theDumpAfterScoring, { mandatory: false });
    registerActiveBaseAbility(BASE_THE_POWER_STRIP, powerStripActive, {
        oncePerTurn: false,
        canUse: ctx => ctx.state.bases.some((base, baseIndex) =>
            base.minions.some(minion => minion.controller === ctx.playerId)
            && (baseIndex === ctx.baseIndex || ctx.state.bases[ctx.baseIndex]?.minions.some(candidate => candidate.controller === ctx.playerId)),
        ),
    });
}
