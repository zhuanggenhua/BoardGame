import { createQidahenInteractionFact } from './interactionFact';
import type { QidahenEvent } from './types';
import { QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID, QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID, QIDAHEN_EVENT_CHARACTER_TARGET_INTERACTION_SOURCE_ID, QIDAHEN_EVENT_OPPONENT_HAND_CHOICE_INTERACTION_SOURCE_ID, QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID, QIDAHEN_GRANT_PARDON_INTERACTION_SOURCE_ID, QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID, QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID, QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID, QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID, QIDAHEN_OPEN_GATE_SURRENDER_INTERACTION_SOURCE_ID, QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID, QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID } from './interactionSources';
import { getQidahenDiplomacySelectionFromInteraction, getQidahenDriveTigerConsentSelectionFromInteraction, getQidahenEventCharacterTargetSelectionFromInteraction, getQidahenEventOpponentHandChoiceSelectionFromInteraction, getQidahenFortificationMaintenanceSelectionFromInteraction, getQidahenGrantPardonSelectionFromInteraction, getQidahenInternalDispatchSelectionFromInteraction, getQidahenKhanEdictSelectionFromInteraction, getQidahenMaShiTradeSelectionFromInteraction, getQidahenOpenGateSurrenderSelectionFromInteraction, getQidahenRecruitSelectionFromInteraction, getQidahenWheelDispatchSelectionFromInteraction } from './interactionSelectionAccessors';
import { getQidahenResolvedChoiceId, type QidahenInteractionResolutionContext } from './interactionResolutionPayload';







const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
);

const asQidahenInteractionSelectionCarrier = (interactionData?: unknown) => ({ data: interactionData });

const asQidahenResolvedSelectionCarrier = (
    payload: QidahenInteractionResolutionContext['payload'],
) => {
    const interactionData = isRecord(payload.interactionData)
        ? payload.interactionData
        : {};
    const valueData = isRecord(payload.value)
        ? payload.value
        : {};
    const { sourceId: _ignoredValueSourceId, ...selectionValueData } = valueData;

    return {
        data: {
            ...interactionData,
            ...selectionValueData,
        },
    };
};

const getResolvedCommittedTroops = (
    payload: QidahenInteractionResolutionContext['payload'],
): number | undefined => {
    const valueData = isRecord(payload.value)
        ? payload.value
        : {};
    const committedTroops = valueData.committedTroops;
    return typeof committedTroops === 'number' && Number.isFinite(committedTroops)
        ? committedTroops
        : undefined;
};

const resolveQidahenHandLimitDiscardInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    if (payload.sourceId !== QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID) {
        return undefined;
    }
    if (payload.optionIds.length === 0) {
        return null;
    }
    return [createQidahenInteractionFact(context, 'HAND_LIMIT_DISCARD_RESOLVED', { playerId: state.core.currentPlayer, cardIds: payload.optionIds })];
};

const resolveQidahenRecruitInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const recruitSelection = getQidahenRecruitSelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID
        && recruitSelection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (!choiceId) {
        return null;
    }
    const choice = recruitSelection?.choices.find((candidate) => candidate.id === choiceId) ?? null;
    if (!choice) {
        return null;
    }
    return [createQidahenInteractionFact(context, 'RECRUIT_CHOICE_RESOLVED', { playerId: state.core.currentPlayer, choiceId: choice.id, selection: recruitSelection })];
};

const resolveQidahenGrantPardonInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const grantPardonSelection = getQidahenGrantPardonSelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_GRANT_PARDON_INTERACTION_SOURCE_ID
        && grantPardonSelection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (!choiceId) {
        return null;
    }
    const choice = grantPardonSelection?.choices.find((candidate) => candidate.id === choiceId) ?? null;
    return [createQidahenInteractionFact(context, 'GRANT_PARDON_CHOICE_RESOLVED', { playerId: state.core.currentPlayer, choiceId: choice?.id ?? choiceId, selection: grantPardonSelection })];
};

const resolveQidahenDiplomacyInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const diplomacySelection = getQidahenDiplomacySelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID
        && diplomacySelection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (!choiceId) {
        return null;
    }
    const choice = diplomacySelection?.choices.find((candidate) => candidate.id === choiceId) ?? null;
    if (!choice) {
        return null;
    }
    return [createQidahenInteractionFact(context, 'DIPLOMACY_CHOICE_RESOLVED', { playerId: state.core.currentPlayer, choiceId: choice.id, selection: diplomacySelection })];
};

const resolveQidahenWheelDispatchInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const wheelDispatchSelection = getQidahenWheelDispatchSelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID
        && wheelDispatchSelection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (!choiceId) {
        return null;
    }
    return [createQidahenInteractionFact(context, 'WHEEL_DISPATCH_CHOICE_RESOLVED', { playerId: state.core.currentPlayer, choiceId, selection: wheelDispatchSelection, committedTroops: getResolvedCommittedTroops(payload) })];
};

const resolveQidahenInternalDispatchInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const internalDispatchSelection = getQidahenInternalDispatchSelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID
        && internalDispatchSelection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (!choiceId) {
        return null;
    }
    return [createQidahenInteractionFact(context, 'INTERNAL_DISPATCH_RESOLVED', { playerId: state.core.currentPlayer, choiceId, selection: internalDispatchSelection })];
};

const resolveQidahenMaShiTradeInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const maShiTradeSelection = getQidahenMaShiTradeSelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID
        && maShiTradeSelection == null
    ) {
        return undefined;
    }
    const troopCount = (() => {
        const value = payload.value;
        if (value && typeof value === 'object') {
            const troopValue = (value as { troopCount?: unknown }).troopCount;
            if (troopValue === 1 || troopValue === 2 || troopValue === 3) {
                return troopValue;
            }
        }
        const numericChoiceId = Number(getQidahenResolvedChoiceId(payload) ?? 0);
        return numericChoiceId === 1 || numericChoiceId === 2 || numericChoiceId === 3
            ? numericChoiceId
            : null;
    })();
    if (troopCount == null) {
        return null;
    }
    return [createQidahenInteractionFact(context, 'MA_SHI_TRADE_CHOICE_RESOLVED', { playerId: state.core.currentPlayer, troopCount, selection: maShiTradeSelection })];
};

const resolveQidahenKhanEdictInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const khanEdictSelection = getQidahenKhanEdictSelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID
        && khanEdictSelection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (choiceId !== 'recruit-train' && choiceId !== 'hire-dispatch') {
        return null;
    }
    return [createQidahenInteractionFact(context, 'KHAN_EDICT_CHOICE_RESOLVED', { playerId: state.core.currentPlayer, choiceId, selection: khanEdictSelection })];
};

const resolveQidahenDriveTigerConsentInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const driveTigerConsentSelection = getQidahenDriveTigerConsentSelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID
        && driveTigerConsentSelection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (choiceId !== 'accept' && choiceId !== 'decline') {
        return null;
    }
    return [createQidahenInteractionFact(context, 'DRIVE_TIGER_CONSENT_RESOLVED', { playerId: state.core.currentPlayer, choiceId, selection: driveTigerConsentSelection })];
};

const resolveQidahenFortificationMaintenanceInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    if (payload.sourceId !== QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (choiceId !== 'auto-pay' && choiceId !== 'skip-all') {
        return null;
    }
    const fortificationMaintenanceSelection = getQidahenFortificationMaintenanceSelectionFromInteraction(
        asQidahenInteractionSelectionCarrier(payload.interactionData),
    );
    const attritionPriority = (() => {
        const value = payload.value;
        if (!value || typeof value !== 'object') {
            return undefined;
        }
        const candidate = (value as { attritionPriority?: unknown }).attritionPriority;
        return candidate === 'highest-level' || candidate === 'lowest-level'
            ? candidate
            : undefined;
    })();
    return [createQidahenInteractionFact(context, 'FORTIFICATION_MAINTENANCE_RESOLVED', { playerId: state.core.currentPlayer, choiceId, attritionPriority, selection: fortificationMaintenanceSelection })];
};

const resolveQidahenEventCharacterTargetInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const selection = getQidahenEventCharacterTargetSelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_EVENT_CHARACTER_TARGET_INTERACTION_SOURCE_ID
        && selection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (!choiceId) {
        return null;
    }
    return [createQidahenInteractionFact(context, 'EVENT_CHARACTER_TARGET_RESOLVED', { playerId: state.core.currentPlayer, choiceId, selection })];
};

const resolveQidahenEventOpponentHandChoiceInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const selection = getQidahenEventOpponentHandChoiceSelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_EVENT_OPPONENT_HAND_CHOICE_INTERACTION_SOURCE_ID
        && selection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    if (!choiceId) {
        return null;
    }
    return [createQidahenInteractionFact(context, 'EVENT_OPPONENT_HAND_CHOICE_RESOLVED', { playerId: state.core.currentPlayer, choiceId, selection })];
};

const resolveQidahenOpenGateSurrenderInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => {
    const { state, payload, event } = context;
    const selection = getQidahenOpenGateSurrenderSelectionFromInteraction(
        asQidahenResolvedSelectionCarrier(payload),
    );
    if (
        payload.sourceId !== QIDAHEN_OPEN_GATE_SURRENDER_INTERACTION_SOURCE_ID
        && selection == null
    ) {
        return undefined;
    }
    const choiceId = getQidahenResolvedChoiceId(payload);
    const optionIds = selection?.phase === 'jin-characters' || selection?.phase === 'jin-troops'
        ? payload.optionIds
        : choiceId
            ? [choiceId]
            : [];
    return [createQidahenInteractionFact(context, 'OPEN_GATE_SURRENDER_CHOICE_RESOLVED', { playerId: state.core.currentPlayer, optionIds, selection })];
};

export const buildQidahenTurnActionInteractionEvents = (
    context: QidahenInteractionResolutionContext,
): QidahenEvent[] | null | undefined => resolveQidahenHandLimitDiscardInteractionEvent(context)
    ?? resolveQidahenRecruitInteractionEvent(context)
    ?? resolveQidahenGrantPardonInteractionEvent(context)
    ?? resolveQidahenDiplomacyInteractionEvent(context)
    ?? resolveQidahenWheelDispatchInteractionEvent(context)
    ?? resolveQidahenInternalDispatchInteractionEvent(context)
    ?? resolveQidahenMaShiTradeInteractionEvent(context)
    ?? resolveQidahenKhanEdictInteractionEvent(context)
    ?? resolveQidahenDriveTigerConsentInteractionEvent(context)
    ?? resolveQidahenFortificationMaintenanceInteractionEvent(context)
    ?? resolveQidahenEventCharacterTargetInteractionEvent(context)
    ?? resolveQidahenEventOpponentHandChoiceInteractionEvent(context)
    ?? resolveQidahenOpenGateSurrenderInteractionEvent(context);
