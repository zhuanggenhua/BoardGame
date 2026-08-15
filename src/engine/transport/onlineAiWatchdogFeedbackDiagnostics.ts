import { extractAiInteractionSnapshot, extractAiResponseWindowSnapshot } from '../ai/snapshots';
import type { AiInteractionSnapshot, AiResponseWindowSnapshot } from '../ai/types';
import { isEnabledControlChoiceOption } from '../systems/InteractionSystem';
import type { MatchState } from '../types';
import {
    resolveUnsatisfiableReasonFromInteraction,
    type OnlineAiRecoveryEngineConfig,
    type ForceEndTurnStalledAiResolution,
    type HiddenInteractionDescriptor,
} from './onlineAiRecovery';
import { resolveOnlineAiRecoveryFingerprint } from './onlineAiWatchdogSequenceFingerprinting';

export type InteractionSelectabilityDiagnostic = {
    totalOptions: number;
    enabledOptions: number;
    disabledOptions: number;
    minSelectionCount: number;
    enabledOptionIds: string[];
    disabledOptionIds: string[];
    recoverableOptionIds: string[];
    selectionState:
        | 'no-options'
        | 'all-options-disabled'
        | 'recoverable-option-available'
        | 'manual-selection-required';
};

export type OnlineAiRecoveryPendingDamageDiagnostic = {
    id: unknown;
    responderId: unknown;
    responseType: unknown;
    currentDamage: unknown;
    sourceAbilityId: unknown;
    tokenUsageTotals: unknown;
};

export type OnlineAiFeedbackDiagnosticsContext = {
    sharedInteraction: AiInteractionSnapshot | null;
    seatInteraction: AiInteractionSnapshot | null;
    sharedSelectability: InteractionSelectabilityDiagnostic | null;
    seatSelectability: InteractionSelectabilityDiagnostic | null;
    sharedResponseWindow: AiResponseWindowSnapshot | null;
    seatResponseWindow: AiResponseWindowSnapshot | null;
    pendingDamage: OnlineAiRecoveryPendingDamageDiagnostic | null;
    sharedUnsatisfiableReason: string | null;
    seatUnsatisfiableReason: string | null;
};

type OnlineAiRecoveryFeedbackFailureReason =
    | 'missing_visible_state'
    | 'private_overlay_missing'
    | 'private_overlay_stale'
    | string;

const normalizeOnlineAiDiagnosticSegment = (value: unknown, fallback: string): string => {
    if (typeof value !== 'string') {
        return fallback;
    }
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9:_-]/g, '');
    return normalized || fallback;
};

const resolveOnlineAiResponseWindowResponderId = (
    responseWindow: AiResponseWindowSnapshot | null | undefined,
): string | null => {
    if (!responseWindow || !Array.isArray(responseWindow.responderQueue)) {
        return null;
    }
    const index = typeof responseWindow.currentResponderIndex === 'number'
        ? responseWindow.currentResponderIndex
        : 0;
    const responderId = responseWindow.responderQueue[index];
    return typeof responderId === 'string' && responderId.trim().length > 0
        ? responderId
        : null;
};

export function buildInteractionSelectabilityDiagnostic(
    snapshot: AiInteractionSnapshot | null | undefined,
): InteractionSelectabilityDiagnostic | null {
    if (!snapshot) {
        return null;
    }

    const options = Array.isArray(snapshot.options) ? snapshot.options : [];
    const enabledOptions = options.filter((option) => option.disabled !== true);
    const disabledOptions = options.filter((option) => option.disabled === true);
    const multi = snapshot.multi as { min?: unknown } | undefined;
    const minSelectionCount = typeof multi?.min === 'number' ? multi.min : 1;
    const recoverableOptionIds = minSelectionCount === 0
        ? ['__empty_selection__']
        : enabledOptions
            .filter((option) => {
                const displayMode = option.displayMode === 'card' || option.displayMode === 'button'
                    ? option.displayMode
                    : undefined;
                return isEnabledControlChoiceOption({
                    ...option,
                    label: option.label ?? option.id,
                    value: option.value,
                    displayMode,
                });
            })
            .map((option) => option.id);

    const selectionState: InteractionSelectabilityDiagnostic['selectionState'] = options.length === 0
        ? 'no-options'
        : enabledOptions.length === 0
            ? 'all-options-disabled'
            : recoverableOptionIds.length > 0
                ? 'recoverable-option-available'
                : 'manual-selection-required';

    return {
        totalOptions: options.length,
        enabledOptions: enabledOptions.length,
        disabledOptions: disabledOptions.length,
        minSelectionCount,
        enabledOptionIds: enabledOptions.map((option) => option.id),
        disabledOptionIds: disabledOptions.map((option) => option.id),
        recoverableOptionIds,
        selectionState,
    };
}

export function resolveUnsatisfiableReasonFromSelectability(
    snapshot: AiInteractionSnapshot | null | undefined,
): string | null {
    const diagnostic = buildInteractionSelectabilityDiagnostic(snapshot);
    if (!diagnostic) {
        return null;
    }
    if (diagnostic.totalOptions === 0) {
        return 'empty-options';
    }
    if (diagnostic.enabledOptions === 0) {
        return 'all-options-disabled';
    }
    if (diagnostic.minSelectionCount > 0 && diagnostic.enabledOptions < diagnostic.minSelectionCount) {
        return 'min-selection-unreachable';
    }
    return null;
}

export function buildOnlineAiPendingDamageDiagnostic(
    state: MatchState<unknown>,
): OnlineAiRecoveryPendingDamageDiagnostic | null {
    const pendingDamage = (state.core as {
        pendingDamage?: {
            id?: unknown;
            responderId?: unknown;
            responseType?: unknown;
            currentDamage?: unknown;
            sourceAbilityId?: unknown;
            tokenUsageTotals?: unknown;
        };
    } | undefined)?.pendingDamage;
    return pendingDamage ? {
        id: pendingDamage.id ?? null,
        responderId: pendingDamage.responderId ?? null,
        responseType: pendingDamage.responseType ?? null,
        currentDamage: pendingDamage.currentDamage ?? null,
        sourceAbilityId: pendingDamage.sourceAbilityId ?? null,
        tokenUsageTotals: pendingDamage.tokenUsageTotals ?? null,
    } : null;
}

export function buildOnlineAiFeedbackDiagnosticsContext(args: {
    sharedState: MatchState<unknown>;
    seatState: MatchState<unknown>;
    seatUnsatisfiableReasonOverride?: string | null;
}): OnlineAiFeedbackDiagnosticsContext {
    const sharedInteraction = extractAiInteractionSnapshot(args.sharedState);
    const seatInteraction = extractAiInteractionSnapshot(args.seatState);
    const sharedSelectability = buildInteractionSelectabilityDiagnostic(sharedInteraction);
    const seatSelectability = buildInteractionSelectabilityDiagnostic(seatInteraction);
    const sharedInteractionState = (args.sharedState.sys?.interaction as { current?: unknown } | undefined)?.current;
    const seatInteractionState = (args.seatState.sys?.interaction as { current?: unknown } | undefined)?.current;
    const sharedUnsatisfiableReason = resolveUnsatisfiableReasonFromSelectability(sharedInteraction)
        ?? resolveUnsatisfiableReasonFromInteraction(
            args.sharedState,
            sharedInteractionState as HiddenInteractionDescriptor | undefined,
        );
    const seatUnsatisfiableReason = args.seatUnsatisfiableReasonOverride
        ?? resolveUnsatisfiableReasonFromSelectability(seatInteraction)
        ?? resolveUnsatisfiableReasonFromInteraction(
            args.seatState,
            seatInteractionState as HiddenInteractionDescriptor | undefined,
        );

    return {
        sharedInteraction,
        seatInteraction,
        sharedSelectability,
        seatSelectability,
        sharedResponseWindow: extractAiResponseWindowSnapshot(args.sharedState),
        seatResponseWindow: extractAiResponseWindowSnapshot(args.seatState),
        pendingDamage: buildOnlineAiPendingDamageDiagnostic(args.sharedState),
        sharedUnsatisfiableReason,
        seatUnsatisfiableReason,
    };
}

export function buildOnlineAiWatchdogBlockerFingerprint(args: {
    phase?: unknown;
    reason?: unknown;
    sharedInteraction?: AiInteractionSnapshot | null;
    seatInteraction?: AiInteractionSnapshot | null;
    responseWindow?: AiResponseWindowSnapshot | null;
    pendingDamage?: OnlineAiRecoveryPendingDamageDiagnostic | null;
}): string | null {
    const phase = normalizeOnlineAiDiagnosticSegment(args.phase, 'unknown-phase');
    const reason = normalizeOnlineAiDiagnosticSegment(args.reason, 'unknown-reason');
    const interaction = args.seatInteraction ?? args.sharedInteraction;
    if (interaction) {
        const kind = normalizeOnlineAiDiagnosticSegment(interaction.kind, 'unknown-kind');
        const sourceId = normalizeOnlineAiDiagnosticSegment(
            typeof interaction.sourceId === 'string' ? interaction.sourceId : interaction.id,
            'unknown-source',
        );
        return `${phase}:${reason}:interaction:${kind}:${sourceId}`;
    }
    if (args.responseWindow) {
        const windowType = normalizeOnlineAiDiagnosticSegment(args.responseWindow.windowType, 'unknown-window');
        const sourceId = normalizeOnlineAiDiagnosticSegment(args.responseWindow.sourceId, 'unknown-source');
        const responderId = normalizeOnlineAiDiagnosticSegment(
            resolveOnlineAiResponseWindowResponderId(args.responseWindow),
            'unknown-responder',
        );
        return `${phase}:${reason}:response-window:${windowType}:${sourceId}:${responderId}`;
    }
    if (args.pendingDamage) {
        const responseType = normalizeOnlineAiDiagnosticSegment(args.pendingDamage.responseType, 'unknown-response');
        const sourceAbilityId = normalizeOnlineAiDiagnosticSegment(
            args.pendingDamage.sourceAbilityId,
            'unknown-source-ability',
        );
        const responderId = normalizeOnlineAiDiagnosticSegment(
            args.pendingDamage.responderId,
            'unknown-responder',
        );
        return `${phase}:${reason}:pending-damage:${responseType}:${sourceAbilityId}:${responderId}`;
    }
    return null;
}

export function extractOnlineAiRecoveryFingerprintFromTrackerKey(
    playerId: string,
    reason: string,
    trackerKey: string,
): string | null {
    const prefix = `${playerId}:${reason}:`;
    if (!trackerKey.startsWith(prefix)) {
        return null;
    }
    const fingerprint = trackerKey.slice(prefix.length).trim();
    return fingerprint || null;
}

export function resolveOnlineAiRecoveryFeedbackFingerprint(args: {
    baseFingerprint: string | null | undefined;
    failureReason?: OnlineAiRecoveryFeedbackFailureReason;
}): string | null {
    const baseFingerprint = args.baseFingerprint?.trim();
    if (!baseFingerprint) {
        return null;
    }

    const detailedFailureFingerprintSegment = args.failureReason === 'missing_visible_state'
        ? 'missing-visible-state'
        : args.failureReason === 'private_overlay_missing'
            ? 'missing-private-overlay'
            : args.failureReason === 'private_overlay_stale'
                ? 'stale-private-overlay'
                : null;
    if (detailedFailureFingerprintSegment) {
        return `${baseFingerprint}:${detailedFailureFingerprintSegment}`;
    }
    return baseFingerprint;
}

export function resolveOnlineAiRecoveryBlockerFingerprint(args: {
    state: MatchState<unknown>;
    candidate: ForceEndTurnStalledAiResolution;
    trackerKey: string;
    progressMarker: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    failureReason?: OnlineAiRecoveryFeedbackFailureReason;
}): string | null {
    return resolveOnlineAiRecoveryFeedbackFingerprint({
        baseFingerprint: args.candidate.fingerprintHint
            ?? extractOnlineAiRecoveryFingerprintFromTrackerKey(
                args.candidate.playerId,
                args.candidate.reason,
                args.trackerKey,
            )
            ?? resolveOnlineAiRecoveryFingerprint({
                state: args.state,
                candidate: args.candidate,
                progressMarker: args.progressMarker,
                engineConfig: args.engineConfig,
            }),
        failureReason: args.failureReason,
    });
}
