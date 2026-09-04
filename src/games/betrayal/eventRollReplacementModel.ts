import type { RandomFn } from '../../engine/types';
import {
    eventRollResolutionNeedsAcknowledgement,
    eventRollResolutionNeedsSharedAcknowledgement,
} from './acknowledgementReadModel';
import { findExplorerByPlayerId } from './explorerReadModel';
import {
    cloneDustRuntimeState,
    cloneHelpingHandsRuntimeState,
    cloneMagicCameraRuntimeState,
    cloneUponReflectionRuntimeState,
    createDustRuntimeState,
    createUponReflectionRuntimeState,
} from './hauntRuntimeSetupModel';
import {
    cloneHauntTraitorResolution,
    resolveHauntTraitorResolutionForTrigger,
    type BetrayalHauntTraitorResolution,
} from './hauntTraitorResolutionModel';
import { resolveHauntRevealResolutionForTrigger } from './hauntSetupModel';
import { canUseBookForPendingEventRoll } from './possessionActionReadModel';
import type { BetrayalPossessionUsedPayload } from './possessionUseResolution';
import {
    BETRAYAL_TRAIT_LABEL as TRAIT_LABEL,
    cloneUseEffect,
    eventEffectNeedsPendingEventChoice,
    formatEffectLabel,
    isWarningEventEffect,
    resolveUseEffect,
    type PossessionUseEffectProfile,
    type UseEffectProfile,
} from './possessionEffects';
import { resolveRecentRollTotal } from './recentRollPresentation';
import type { BetrayalHauntRevealResolution } from './scenarioConfig';
import { materializeEventEffect, resolveEventBranch } from './eventRollModel';
import { rollEventTraitCheckWithDice } from './traitRollModel';
import { applyTraitLoss } from './traitTrackModel';
import type {
    BetrayalCore,
    BetrayalDustRuntimeState,
    BetrayalHelpingHandsRuntimeState,
    BetrayalMagicCameraRuntimeState,
    BetrayalPendingEventChoiceState,
    BetrayalPendingEventRollResolutionState,
    BetrayalUponReflectionRuntimeState,
} from './game';

export interface BetrayalEventRollReplacementResult {
    dice: number[];
    passiveBonus: number;
    total: number;
    latestLabel: string;
    effect: UseEffectProfile;
    hauntRoll?: BetrayalPendingEventRollResolutionState['hauntRoll'];
    nextPendingEventChoice?: BetrayalPendingEventChoiceState;
    deathPrevention?: BetrayalPendingEventRollResolutionState['deathPrevention'];
    hauntTriggered?: boolean;
    hauntCardNumber?: number;
    hauntTriggerLabel?: string;
    hauntTraitorPlayerId?: string | null;
    hauntRevealResolution?: BetrayalHauntRevealResolution;
    hauntTraitorResolution?: BetrayalHauntTraitorResolution;
    dustSetup?: BetrayalDustRuntimeState;
    magicCameraSetup?: BetrayalMagicCameraRuntimeState;
    helpingHandsSetup?: BetrayalHelpingHandsRuntimeState;
    uponReflectionSetup?: BetrayalUponReflectionRuntimeState;
}

type BetrayalEventRollReplacementPayload =
    BetrayalPossessionUsedPayload<BetrayalEventRollReplacementResult>
    & {
        effect: Extract<PossessionUseEffectProfile, { mode: 'nextNonCombatTraitReplacement' }>;
        eventRollReplacement: BetrayalEventRollReplacementResult;
    };

function isEventRollReplacementPayload(
    payload: BetrayalPossessionUsedPayload<BetrayalEventRollReplacementResult>,
): payload is BetrayalEventRollReplacementPayload {
    return Boolean(payload.eventRollReplacement && payload.effect.mode === 'nextNonCombatTraitReplacement');
}

function cloneEventRollReplacementPendingChoice(
    pending: BetrayalPendingEventChoiceState,
): BetrayalPendingEventChoiceState {
    return {
        ...pending,
        effect: cloneUseEffect(pending.effect),
    };
}

function cloneEventRollReplacementDeathPrevention(
    deathPrevention: BetrayalPendingEventRollResolutionState['deathPrevention'] | undefined,
): BetrayalPendingEventRollResolutionState['deathPrevention'] | undefined {
    return deathPrevention
        ? {
            ...deathPrevention,
            dice: [...deathPrevention.dice],
            damageTraits: [...deathPrevention.damageTraits],
            traitsBeforeDamage: { ...deathPrevention.traitsBeforeDamage },
        }
        : undefined;
}

export function createBookPendingEventRollReplacement(
    core: BetrayalCore,
    playerId: string,
    cardId: string | undefined,
    random: RandomFn,
    timestamp: number,
): BetrayalEventRollReplacementResult | null {
    if (!canUseBookForPendingEventRoll(core, playerId, cardId)) {
        return null;
    }
    const pending = core.pendingEventRollResolution;
    const recentRoll = core.recentRoll;
    const owner = findExplorerByPlayerId(core, playerId);
    if (
        !pending
        || !recentRoll
        || recentRoll.kind !== 'eventTraitCheck'
        || !recentRoll.trait
        || !recentRoll.branchThresholds?.length
        || !owner
    ) {
        return null;
    }
    const candidates = owner.inventory.filter((card) => (
        resolveUseEffect(card)?.mode === 'nextNonCombatTraitReplacement'
    ));
    const card = cardId
        ? candidates.find((candidate) => candidate.id === cardId)
        : candidates[0];
    const effect = card ? resolveUseEffect(card) : null;
    if (!card || effect?.mode !== 'nextNonCombatTraitReplacement') {
        return null;
    }
    const replacementCore: BetrayalCore = {
        ...core,
        nextNonCombatTraitReplacement: {
            playerId,
            sourceCardId: card.id,
            replacementTrait: effect.replacementTrait,
        },
    };
    const roll = rollEventTraitCheckWithDice(random, owner, effect.replacementTrait, replacementCore);
    const nextBranch = resolveEventBranch(recentRoll.branchThresholds, roll.total);
    const nextEffect = materializeEventEffect(
        nextBranch.effect,
        random,
        owner,
        replacementCore,
        { materializeRandomResults: false },
    );
    const nextPendingEventChoice = eventEffectNeedsPendingEventChoice(nextEffect)
        ? {
            id: `${pending.rollId}-book-${timestamp}`,
            playerId: pending.playerId,
            sourceTitle: pending.sourceTitle,
            eventDescription: recentRoll.eventDescription,
            effect: cloneUseEffect(nextEffect),
        }
        : undefined;
    const pendingHauntRoll = pending.hauntRoll;
    const hauntTriggered = pendingHauntRoll
        ? roll.total >= pendingHauntRoll.threshold
        : false;
    const hauntRevealResolution = hauntTriggered
        ? resolveHauntRevealResolutionForTrigger(
            core,
            { id: null, name: pendingHauntRoll?.successHauntTriggerLabel ?? recentRoll.sourceTitle },
            pendingHauntRoll?.successHauntId,
        )
        : undefined;
    const hauntTraitorResolution = hauntTriggered && hauntRevealResolution
        ? resolveHauntTraitorResolutionForTrigger(
            core,
            hauntRevealResolution.hauntCardNumber,
            playerId,
            {
                eventSelection: pendingHauntRoll?.successTraitorSelection,
                revealRepresentativeOnly: hauntRevealResolution.representativeOnly,
            },
        )
        : undefined;
    return {
        dice: [...roll.dice],
        passiveBonus: roll.passiveBonus,
        total: roll.total,
        latestLabel: nextBranch.label,
        effect: cloneUseEffect(nextEffect),
        hauntRoll: pending.hauntRoll ? { ...pending.hauntRoll } : undefined,
        nextPendingEventChoice,
        hauntTriggered: pendingHauntRoll ? hauntTriggered : pending.hauntTriggered,
        hauntCardNumber: hauntTriggered ? pendingHauntRoll?.successHauntId : undefined,
        hauntTriggerLabel: hauntTriggered
            ? pendingHauntRoll?.successHauntTriggerLabel ?? recentRoll.sourceTitle
            : undefined,
        hauntTraitorPlayerId: hauntTraitorResolution?.traitorPlayerId,
        hauntRevealResolution,
        hauntTraitorResolution,
        dustSetup: hauntTriggered && pendingHauntRoll?.successHauntId === 3
            ? createDustRuntimeState(core, random)
            : undefined,
        uponReflectionSetup: hauntTriggered && pendingHauntRoll?.successHauntId === 7
            ? createUponReflectionRuntimeState(core, playerId, random)
            : undefined,
    };
}

export function applyBetrayalEventRollReplacementState(
    core: BetrayalCore,
    payload: BetrayalPossessionUsedPayload<BetrayalEventRollReplacementResult>,
): boolean {
    if (!isEventRollReplacementPayload(payload)) {
        return false;
    }
    const replacement = payload.eventRollReplacement;
    const pending = core.pendingEventRollResolution;
    const recentRoll = core.recentRoll;
    const owner = findExplorerByPlayerId(core, payload.playerId);
    if (!pending || !recentRoll || !owner || pending.rollId !== recentRoll.id) {
        return false;
    }
    applyTraitLoss(owner, ['sanity'], payload.effect.sanityCost);
    core.recentRoll = {
        ...recentRoll,
        trait: payload.effect.replacementTrait,
        rollLabel: `${TRAIT_LABEL[payload.effect.replacementTrait]}检定`,
        dice: [...replacement.dice],
        passiveBonus: replacement.passiveBonus,
        latestLabel: replacement.latestLabel,
    };
    const nextPendingEventChoice = replacement.nextPendingEventChoice
        ? cloneEventRollReplacementPendingChoice(replacement.nextPendingEventChoice)
        : undefined;
    const acknowledgementContext = {
        nextPendingEventChoice,
        hauntRevealResolution: replacement.hauntRevealResolution,
        hauntTraitorResolution: replacement.hauntTraitorResolution,
        dustSetup: replacement.dustSetup,
        magicCameraSetup: replacement.magicCameraSetup,
        helpingHandsSetup: replacement.helpingHandsSetup,
        uponReflectionSetup: replacement.uponReflectionSetup,
    };
    const requiresAcknowledgement = eventRollResolutionNeedsAcknowledgement(acknowledgementContext);
    const needsSharedAcknowledgement = eventRollResolutionNeedsSharedAcknowledgement(acknowledgementContext);
    core.pendingEventRollResolution = {
        ...pending,
        requiredPlayerIds: needsSharedAcknowledgement && core.playerIds.length > 0
            ? [...core.playerIds]
            : [pending.playerId],
        acknowledgedPlayerIds: [],
        hauntRoll: replacement.hauntRoll ? { ...replacement.hauntRoll } : undefined,
        effect: cloneUseEffect(replacement.effect),
        nextPendingEventChoice,
        deathPrevention: cloneEventRollReplacementDeathPrevention(replacement.deathPrevention),
        hauntTriggered: replacement.hauntTriggered,
        hauntCardNumber: replacement.hauntCardNumber,
        hauntTriggerLabel: replacement.hauntTriggerLabel,
        hauntTraitorPlayerId: replacement.hauntTraitorPlayerId,
        hauntRevealResolution: replacement.hauntRevealResolution
            ? { ...replacement.hauntRevealResolution }
            : undefined,
        hauntTraitorResolution: replacement.hauntTraitorResolution
            ? cloneHauntTraitorResolution(replacement.hauntTraitorResolution) ?? undefined
            : undefined,
        dustSetup: replacement.dustSetup
            ? cloneDustRuntimeState(replacement.dustSetup)
            : undefined,
        magicCameraSetup: replacement.magicCameraSetup
            ? cloneMagicCameraRuntimeState(replacement.magicCameraSetup)
            : undefined,
        helpingHandsSetup: replacement.helpingHandsSetup
            ? cloneHelpingHandsRuntimeState(replacement.helpingHandsSetup)
            : undefined,
        uponReflectionSetup: replacement.uponReflectionSetup
            ? cloneUponReflectionRuntimeState(replacement.uponReflectionSetup)
            : undefined,
        requiresAcknowledgement,
    };
    core.usedCardIdsThisTurn = Array.from(new Set([
        ...core.usedCardIdsThisTurn,
        payload.cardId,
    ]));
    core.nextNonCombatTraitReplacement = null;
    if (core.latestDiscovery && core.latestDiscovery.title === recentRoll.sourceTitle) {
        const total = resolveRecentRollTotal(core.recentRoll);
        const rollLabel = core.recentRoll.rollLabel ?? '投骰';
        core.latestDiscovery = {
            ...core.latestDiscovery,
            detail: `${rollLabel} ${total}：${replacement.latestLabel}；${formatEffectLabel(replacement.effect)}`,
            tone: isWarningEventEffect(replacement.effect) ? 'warning' : 'accent',
        };
    }
    return true;
}
