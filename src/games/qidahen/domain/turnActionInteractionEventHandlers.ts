import type { QidahenCore } from './types';
import {
    QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID,
    QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID,
    QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
    QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,
    QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID,
    QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID,
    QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID,
    QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID,
    QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,
} from './interactionSources';
import {
    getQidahenDiplomacySelectionFromInteraction,
    getQidahenDriveTigerConsentSelectionFromInteraction,
    getQidahenFortificationMaintenanceSelectionFromInteraction,
    getQidahenInternalDispatchSelectionFromInteraction,
    getQidahenKhanEdictSelectionFromInteraction,
    getQidahenMaShiTradeSelectionFromInteraction,
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
    resolveQidahenKhanEdictInteractionChoice,
    resolveQidahenMaShiTradeInteractionChoice,
    resolveQidahenRecruitInteractionChoice,
} from './actionWindowChoices';
import { resolveQidahenFortificationMaintenanceInteractionChoice } from './fortificationMaintenance';
import { resolveQidahenHandLimitDiscardInteractionChoice } from './handLimitDiscard';

const asQidahenInteractionSelectionCarrier = (interactionData?: unknown) => ({ data: interactionData });

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
        asQidahenInteractionSelectionCarrier(payload.interactionData),
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
    return resolveQidahenRecruitInteractionChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        recruitSelection,
    );
};

const resolveQidahenDiplomacyInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
    const { state, payload, event } = context;
    const diplomacySelection = getQidahenDiplomacySelectionFromInteraction(
        asQidahenInteractionSelectionCarrier(payload.interactionData),
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
    return resolveQidahenDiplomacyInteractionChoice(
        state.core,
        choiceId,
        event.timestamp ?? 0,
        diplomacySelection,
    );
};

const resolveQidahenWheelDispatchInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
    const { state, payload, event } = context;
    const wheelDispatchSelection = getQidahenWheelDispatchSelectionFromInteraction(
        asQidahenInteractionSelectionCarrier(payload.interactionData),
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
    );
};

const resolveQidahenInternalDispatchInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => {
    const { state, payload, event } = context;
    const internalDispatchSelection = getQidahenInternalDispatchSelectionFromInteraction(
        asQidahenInteractionSelectionCarrier(payload.interactionData),
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
        asQidahenInteractionSelectionCarrier(payload.interactionData),
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
        asQidahenInteractionSelectionCarrier(payload.interactionData),
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
        asQidahenInteractionSelectionCarrier(payload.interactionData),
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

export const resolveQidahenTurnActionInteractionEvent = (
    context: QidahenInteractionResolutionContext,
): QidahenCore | null | undefined => resolveQidahenHandLimitDiscardInteractionEvent(context)
    ?? resolveQidahenRecruitInteractionEvent(context)
    ?? resolveQidahenDiplomacyInteractionEvent(context)
    ?? resolveQidahenWheelDispatchInteractionEvent(context)
    ?? resolveQidahenInternalDispatchInteractionEvent(context)
    ?? resolveQidahenMaShiTradeInteractionEvent(context)
    ?? resolveQidahenKhanEdictInteractionEvent(context)
    ?? resolveQidahenDriveTigerConsentInteractionEvent(context)
    ?? resolveQidahenFortificationMaintenanceInteractionEvent(context);
