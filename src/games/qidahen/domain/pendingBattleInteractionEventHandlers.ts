import { buildQidahenPendingTargetInteractionPayload } from './pendingBattleFlow';
import { createQidahenInteractionFact } from './interactionFact';
import type { QidahenEvent } from './types';
import { QIDAHEN_FEIGNED_RETREAT_INTERACTION_SOURCE_ID, QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID, QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID, QIDAHEN_RAID_AND_AMBUSH_INTERACTION_SOURCE_ID } from './interactionSources';
import { getQidahenPendingTargetActionFromInteraction, getQidahenPostBattleSelectionFromInteraction } from './interactionSelectionAccessors';
import { getQidahenResolvedChoiceId, type QidahenInteractionResolutionContext } from './interactionResolutionPayload';


import type { QidahenFeignedRetreatSelection, QidahenRaidAndAmbushSelection } from './types';

const asQidahenInteractionSelectionCarrier = (interactionData?: unknown) => ({ data: interactionData });

const resolveQidahenFeignedRetreatInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
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
    return [createQidahenInteractionFact(context, 'FEIGNED_RETREAT_SKIPPED', { playerId: state.core.currentPlayer, selection })];
};

const resolveQidahenRaidAndAmbushInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
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
    return [createQidahenInteractionFact(context, 'RAID_AND_AMBUSH_CHOICE_RESOLVED', { playerId: state.core.currentPlayer, choiceId, selection: interactionData?.qidahenRaidAndAmbushSelection })];
};

const resolveQidahenPendingTargetInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
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
    return [createQidahenInteractionFact(context, 'PENDING_ACTION_RESOLVED', buildQidahenPendingTargetInteractionPayload(state.core, payload.value, random, pendingTargetAction))];
};

const resolveQidahenPostBattleInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
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
    return [createQidahenInteractionFact(context, 'POST_BATTLE_DECISION_RESOLVED', { playerId: state.core.currentPlayer, choiceId, selection: postBattleSelection })];
};

export const buildQidahenPendingBattleInteractionEvents = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => resolveQidahenFeignedRetreatInteractionEvent(context)
    ?? resolveQidahenRaidAndAmbushInteractionEvent(context)
    ?? resolveQidahenPendingTargetInteractionEvent(context)
    ?? resolveQidahenPostBattleInteractionEvent(context);
