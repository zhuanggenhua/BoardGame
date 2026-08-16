import type { QidahenCore } from './types';
import {
    QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID,
    QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID,
    QIDAHEN_EVENT_CHARACTER_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_EVENT_OPPONENT_HAND_CHOICE_INTERACTION_SOURCE_ID,
    QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
    QIDAHEN_GRANT_PARDON_INTERACTION_SOURCE_ID,
    QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,
    QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID,
    QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID,
    QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID,
    QIDAHEN_OPEN_GATE_SURRENDER_INTERACTION_SOURCE_ID,
    QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID,
    QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,
} from './interactionSources';
import {
    getQidahenDiplomacySelectionFromInteraction,
    getQidahenDriveTigerConsentSelectionFromInteraction,
    getQidahenEventCharacterTargetSelectionFromInteraction,
    getQidahenEventOpponentHandChoiceSelectionFromInteraction,
    getQidahenFortificationMaintenanceSelectionFromInteraction,
    getQidahenGrantPardonSelectionFromInteraction,
    getQidahenInternalDispatchSelectionFromInteraction,
    getQidahenKhanEdictSelectionFromInteraction,
    getQidahenMaShiTradeSelectionFromInteraction,
    getQidahenOpenGateSurrenderSelectionFromInteraction,
    getQidahenRecruitSelectionFromInteraction,
    getQidahenWheelDispatchSelectionFromInteraction,
} from './interactionSelectionAccessors';
import {
    getQidahenResolvedChoiceId,
    type QidahenInteractionResolutionContext,
} from './interactionResolutionPayload';
import {
    resolveQidahenInternalDispatchInteractionChoice,
    resolveQidahenWheelDispatchInteractionChoice,
} from './actionWindowDispatch';
import {
    resolveQidahenDiplomacyInteractionChoice,
    resolveQidahenDriveTigerConsentInteractionChoice,
    resolveQidahenGrantPardonInteractionChoice,
    resolveQidahenKhanEdictInteractionChoice,
    resolveQidahenMaShiTradeInteractionChoice,
    resolveQidahenRecruitInteractionChoice,
} from './actionWindowChoices';
import { resolveQidahenFortificationMaintenanceInteractionChoice } from './fortificationMaintenance';
import { resolveQidahenHandLimitDiscardInteractionChoice } from './handLimitDiscard';
import {
    resolveQidahenEventCharacterTargetChoice,
    resolveQidahenEventOpponentHandChoice,
} from './eventCharacterTargetSelection';
import { resolveQidahenOpenGateSurrenderInteraction } from './openGateSurrenderSelection';

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
): QidahenCore | null | undefined => {
    const { state, payload, event } = context;
    if (payload.sourceId !== QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID) {
        return undefined;
    }
    if (payload.optionIds.length === 0) {
        return null;
    }
    return resolveQidahenHandLimitDiscardInteractionChoice(
        state.core,
        payload.optionIds,
        event.timestamp ?? 0,
    );
};

const resolveQidahenRecruitInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenRecruitInteractionChoice(
        state.core,
        choice.id,
        event.timestamp ?? 0,
        recruitSelection,
    );
};

const resolveQidahenGrantPardonInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenGrantPardonInteractionChoice(
        state.core,
        choice?.id ?? choiceId,
        event.timestamp ?? 0,
        grantPardonSelection,
    );
};

const resolveQidahenDiplomacyInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenDiplomacyInteractionChoice(
        state.core,
        choice.id,
        event.timestamp ?? 0,
        diplomacySelection,
    );
};

const resolveQidahenWheelDispatchInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenWheelDispatchInteractionChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        wheelDispatchSelection,
        getResolvedCommittedTroops(payload),
    );
};

const resolveQidahenInternalDispatchInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenInternalDispatchInteractionChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        internalDispatchSelection,
    );
};

const resolveQidahenMaShiTradeInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenMaShiTradeInteractionChoice(
        state.core,
        troopCount,
        event.timestamp ?? 0,
        maShiTradeSelection,
    );
};

const resolveQidahenKhanEdictInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenKhanEdictInteractionChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        khanEdictSelection,
    );
};

const resolveQidahenDriveTigerConsentInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenDriveTigerConsentInteractionChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        driveTigerConsentSelection,
    );
};

const resolveQidahenFortificationMaintenanceInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenFortificationMaintenanceInteractionChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        attritionPriority,
        fortificationMaintenanceSelection,
    );
};

const resolveQidahenEventCharacterTargetInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenEventCharacterTargetChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        selection,
    );
};

const resolveQidahenEventOpponentHandChoiceInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenEventOpponentHandChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        selection,
    );
};

const resolveQidahenOpenGateSurrenderInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
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
    return resolveQidahenOpenGateSurrenderInteraction(
        state.core,
        optionIds,
        event.timestamp ?? 0,
        selection,
    );
};

export const resolveQidahenTurnActionInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => resolveQidahenHandLimitDiscardInteractionEvent(context)
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
