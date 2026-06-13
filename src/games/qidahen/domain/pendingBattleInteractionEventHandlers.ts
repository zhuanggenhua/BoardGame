import type { QidahenCore } from './types';
import {
    QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
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
    resolveQidahenPostBattleInteractionChoice,
} from './pendingBattleFlow';

const asQidahenInteractionSelectionCarrier = (interactionData?: unknown) => ({ data: interactionData });

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
): QidahenCore | null | undefined => resolveQidahenPendingTargetInteractionEvent(context)
    ?? resolveQidahenPostBattleInteractionEvent(context);
