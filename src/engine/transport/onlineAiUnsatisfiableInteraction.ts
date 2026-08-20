import { extractAiInteractionSnapshot } from '../ai/snapshots';
import type { AiInteractionSnapshot } from '../ai/types';
import type { MatchState } from '../types';
import {
    buildInteractionSelectabilityDiagnostic,
    resolveUnsatisfiableReasonFromSelectability,
    type InteractionSelectabilityDiagnostic,
} from './onlineAiWatchdogFeedbackDiagnostics';

const UNSATISFIABLE_INTERACTION_REASONS = new Set([
    'empty-options',
    'all-options-disabled',
    'min-selection-unreachable',
]);

const isEmergencySkipOnlySelectability = (
    diagnostic: InteractionSelectabilityDiagnostic | null | undefined,
): boolean => {
    if (!diagnostic) {
        return false;
    }
    return diagnostic.totalOptions === 1
        && diagnostic.enabledOptions === 1
        && diagnostic.disabledOptions === 0
        && diagnostic.selectionState === 'recoverable-option-available'
        && diagnostic.enabledOptionIds[0] === '__emergency_skip__';
};

const shouldTranslateAiEmergencySkipToCancel = (payload: unknown): boolean => {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const candidate = payload as {
        optionId?: unknown;
        optionIds?: unknown;
        mergedValue?: unknown;
    };
    if (candidate.optionId === '__emergency_skip__') {
        return true;
    }
    if (
        Array.isArray(candidate.optionIds)
        && candidate.optionIds.length === 1
        && candidate.optionIds[0] === '__emergency_skip__'
    ) {
        return true;
    }

    const mergedValue = candidate.mergedValue as { __emergency_skip__?: unknown } | undefined;
    return mergedValue?.__emergency_skip__ === true;
};

export const isOnlineAiUnsatisfiableInteractionReason = (
    reason: string | null | undefined,
): boolean => typeof reason === 'string' && UNSATISFIABLE_INTERACTION_REASONS.has(reason);

export const shouldSuppressUnsatisfiableInteractionFeedback = (args: {
    sharedInteraction: AiInteractionSnapshot | null | undefined;
    seatInteraction: AiInteractionSnapshot | null | undefined;
    sharedSelectability?: InteractionSelectabilityDiagnostic | null;
    seatSelectability?: InteractionSelectabilityDiagnostic | null;
}): boolean => {
    const sharedSelectability = args.sharedSelectability
        ?? buildInteractionSelectabilityDiagnostic(args.sharedInteraction);
    if (isEmergencySkipOnlySelectability(sharedSelectability)) {
        return true;
    }

    return false;
};

export const resolveAiEmergencySkipCancelPayload = (
    preCommandSeatState: MatchState<unknown>,
    payload: unknown,
): { interactionId?: string; reason?: string } | null => {
    if (!shouldTranslateAiEmergencySkipToCancel(payload)) {
        return null;
    }

    const interaction = extractAiInteractionSnapshot(preCommandSeatState);
    if (!interaction) {
        return null;
    }

    const payloadInteractionId = payload && typeof payload === 'object'
        ? (payload as { interactionId?: unknown }).interactionId
        : undefined;
    if (
        typeof payloadInteractionId === 'string'
        && typeof interaction.id === 'string'
        && payloadInteractionId !== interaction.id
    ) {
        return null;
    }

    const options = Array.isArray(interaction.options) ? interaction.options : [];
    const emergencyOption = options.find((option) => option.id === '__emergency_skip__' && option.disabled !== true);
    if (!emergencyOption) {
        return null;
    }

    const reasonFromOption = emergencyOption.value
        && typeof emergencyOption.value === 'object'
        ? (emergencyOption.value as { __emergency_skip_reason__?: unknown }).__emergency_skip_reason__
        : undefined;
    const reason = typeof reasonFromOption === 'string'
        ? reasonFromOption
        : resolveUnsatisfiableReasonFromSelectability(interaction) ?? 'empty-options';

    return {
        interactionId: typeof interaction.id === 'string' ? interaction.id : undefined,
        reason,
    };
};
