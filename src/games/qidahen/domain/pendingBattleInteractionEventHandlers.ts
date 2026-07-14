import type { QidahenCore } from './types';
import {
    QIDAHEN_FEIGNED_RETREAT_INTERACTION_SOURCE_ID,
    QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
    QIDAHEN_RAID_AND_AMBUSH_INTERACTION_SOURCE_ID,
} from './interactionSources';
import {
    getQidahenPendingTargetActionFromInteraction,
    getQidahenPostBattleSelectionFromInteraction,
} from './interactionSelectionAccessors';
import {
    getQidahenResolvedChoiceId,
    type QidahenInteractionResolutionContext,
} from './interactionResolutionPayload';
import {
    resolveQidahenPendingTargetInteractionChoice,
    resolveQidahenPendingActionFromPayload,
    resolveQidahenPostBattleInteractionChoice,
} from './pendingBattleFlow';
import { resolveQidahenRaidAndAmbushChoice } from './raidAndAmbushSelection';
import type {
    QidahenFeignedRetreatSelection,
    QidahenRaidAndAmbushSelection,
} from './types';

const asQidahenInteractionSelectionCarrier = (interactionData?: unknown) => ({ data: interactionData });

const resolveQidahenFeignedRetreatInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
    const { state, payload, event } = context;
    if (payload.sourceId !== QIDAHEN_FEIGNED_RETREAT_INTERACTION_SOURCE_ID) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (choiceId !== 'skip') {
        return null;
    }
    const interactionData = payload.interactionData as {
        qidahenFeignedRetreatSelection?: QidahenFeignedRetreatSelection;
    } | null | undefined;
    const selection = interactionData?.qidahenFeignedRetreatSelection
        ?? state.core.feignedRetreatSelection;
    if (!selection) {
        return null;
    }
    return resolveQidahenPendingActionFromPayload(
        {
            ...state.core,
            pendingTargetAction: {
                ...selection.pendingTargetAction,
            },
            feignedRetreatSelection: null,
        },
        {
            ...selection.cavalryPlunderPayload,
            pendingTargetAction: {
                ...selection.pendingTargetAction,
            },
            attackerCavalryPlunder: true,
            battleRolls: null,
            feignedRetreatResponseResolved: true,
        },
        event.timestamp ?? 0,
    );
};

const resolveQidahenRaidAndAmbushInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
    const { state, payload, event } = context;
    if (payload.sourceId !== QIDAHEN_RAID_AND_AMBUSH_INTERACTION_SOURCE_ID) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (!choiceId) {
        return null;
    }
    const interactionData = payload.interactionData as {
        qidahenRaidAndAmbushSelection?: QidahenRaidAndAmbushSelection;
    } | null | undefined;
    return resolveQidahenRaidAndAmbushChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        interactionData?.qidahenRaidAndAmbushSelection,
    );
};

const resolveQidahenPendingTargetInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
    const { state, payload, event, random } = context;
    if (payload.sourceId !== QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (!choiceId) {
        return null;
    }
    const pendingTargetAction = getQidahenPendingTargetActionFromInteraction(
        asQidahenInteractionSelectionCarrier(payload.interactionData),
    );
    return resolveQidahenPendingTargetInteractionChoice(
        state.core,
        choiceId,
        payload.value,
        event.timestamp ?? 0,
        random,
        pendingTargetAction,
    );
};

const resolveQidahenPostBattleInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
    const { state, payload, event } = context;
    const postBattleSelection = getQidahenPostBattleSelectionFromInteraction(
        asQidahenInteractionSelectionCarrier(payload.interactionData),
    );
    if (
        payload.sourceId !== QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID
        && postBattleSelection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (!choiceId) {
        return null;
    }
    return resolveQidahenPostBattleInteractionChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        postBattleSelection,
    );
};

export const resolveQidahenPendingBattleInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => resolveQidahenFeignedRetreatInteractionEvent(context)
    ?? resolveQidahenRaidAndAmbushInteractionEvent(context)
    ?? resolveQidahenPendingTargetInteractionEvent(context)
    ?? resolveQidahenPostBattleInteractionEvent(context);
