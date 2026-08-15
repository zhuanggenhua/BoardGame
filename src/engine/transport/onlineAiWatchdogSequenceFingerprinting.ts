import type { MatchState } from '../types';
import {
    buildAiProgressMarker,
    buildInteractionRecoveryFingerprintHint,
    buildResponseWindowRecoveryFingerprintHint,
    type OnlineAiRecoveryEngineConfig,
    type ForceEndTurnStalledAiResolution,
    type HiddenInteractionDescriptor,
    type HiddenSimpleChoiceInteraction,
} from './onlineAiRecovery';

type CurrentInteractionState = {
    current?: HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction;
};

export function readOnlineAiCurrentInteractionRecoveryFingerprintHint(
    state: MatchState<unknown>,
    playerId: string,
    engineConfig?: OnlineAiRecoveryEngineConfig | null,
): string | null {
    const currentInteraction = (state.sys?.interaction as CurrentInteractionState | undefined)?.current;
    if (!currentInteraction || String(currentInteraction.playerId ?? '') !== playerId) {
        return null;
    }
    return buildInteractionRecoveryFingerprintHint(state, currentInteraction, playerId, { engineConfig });
}

export function readOnlineAiCurrentSeatViewInteractionRecoveryFingerprintHint(
    playerView: MatchState<unknown>,
    playerId: string,
    engineConfig?: OnlineAiRecoveryEngineConfig | null,
): string | null {
    const currentInteraction = (playerView.sys?.interaction as CurrentInteractionState | undefined)?.current;
    if (!currentInteraction || String(currentInteraction.playerId ?? '') !== playerId) {
        return null;
    }
    return buildInteractionRecoveryFingerprintHint(playerView, currentInteraction, playerId, { engineConfig });
}

export function readOnlineAiCurrentResponseWindowRecoveryFingerprintHint(
    state: MatchState<unknown>,
    playerId: string,
): string | null {
    const currentWindow = (state.sys?.responseWindow as {
        current?: {
            responderQueue?: unknown;
            currentResponderIndex?: unknown;
        };
    } | undefined)?.current;
    if (!currentWindow) {
        return null;
    }

    const responderQueue = Array.isArray(currentWindow.responderQueue) ? currentWindow.responderQueue : [];
    const responderIndex = typeof currentWindow.currentResponderIndex === 'number'
        ? currentWindow.currentResponderIndex
        : 0;
    if (String(responderQueue[responderIndex] ?? '') !== playerId) {
        return null;
    }

    return buildResponseWindowRecoveryFingerprintHint(
        state,
        playerId,
        'response-window',
    );
}

export function readOnlineAiCurrentInteractionSemanticFingerprint(
    state: MatchState<unknown>,
    playerId: string,
    engineConfig?: OnlineAiRecoveryEngineConfig | null,
): string | null {
    const currentInteraction = (state.sys?.interaction as CurrentInteractionState | undefined)?.current;
    if (!currentInteraction || String(currentInteraction.playerId ?? '') !== playerId) {
        return null;
    }

    return buildInteractionRecoveryFingerprintHint(state, currentInteraction, playerId, { engineConfig });
}

export function buildOnlineAiRecoverySequenceStepKey(args: {
    state: MatchState<unknown>;
    playerId: string;
    progressMarker: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): string {
    const interactionFingerprint = readOnlineAiCurrentInteractionSemanticFingerprint(
        args.state,
        args.playerId,
        args.engineConfig,
    );
    if (interactionFingerprint) {
        return `${args.progressMarker}|interaction:${interactionFingerprint}`;
    }

    const responseWindowFingerprint = readOnlineAiCurrentResponseWindowRecoveryFingerprintHint(
        args.state,
        args.playerId,
    );
    if (responseWindowFingerprint) {
        return `${args.progressMarker}|response-window:${responseWindowFingerprint}`;
    }

    return args.progressMarker;
}

export function resolveOnlineAiRecoveryFingerprint(args: {
    state: MatchState<unknown>;
    candidate: ForceEndTurnStalledAiResolution;
    progressMarker: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): string {
    const { state, candidate, progressMarker } = args;
    const phase = typeof state.sys?.phase === 'string' ? state.sys.phase : '';
    const candidateReason = candidate.reason as string;

    if (candidateReason === 'action-loop') {
        return candidate.fingerprintHint ?? `action-loop:${candidate.playerId}:${phase}`;
    }

    if (candidate.legalActionOnly === true) {
        return candidate.fingerprintHint ?? `legal-action-only:${candidate.playerId}:${phase}`;
    }

    if (candidateReason === 'visible-interaction' || candidateReason === 'hidden-interaction') {
        const current = (state.sys as { interaction?: { current?: unknown } } | undefined)?.interaction?.current as
            | HiddenInteractionDescriptor
            | HiddenSimpleChoiceInteraction
            | undefined;
        if (current) {
            return buildInteractionRecoveryFingerprintHint(state, current, candidate.playerId, {
                engineConfig: args.engineConfig,
            });
        }
        return candidate.fingerprintHint ?? progressMarker;
    }

    if (candidateReason === 'response-window' || candidateReason === 'response-loop') {
        const current = (state.sys as { responseWindow?: { current?: unknown } } | undefined)?.responseWindow?.current as {
            id?: unknown;
        } | undefined;
        if (current) {
            return buildResponseWindowRecoveryFingerprintHint(
                state,
                candidate.playerId,
                candidateReason === 'response-loop' ? 'response-loop' : 'response-window',
            );
        }
        return candidate.fingerprintHint ?? progressMarker;
    }

    if (candidateReason === 'pending-damage') {
        const pendingDamage = (state.core as {
            pendingDamage?: {
                id?: unknown;
                responderId?: unknown;
                responseType?: unknown;
            };
        } | undefined)?.pendingDamage;
        const responderId = typeof pendingDamage?.responderId === 'string' ? pendingDamage.responderId : candidate.playerId;
        const pendingId = typeof pendingDamage?.id === 'string' ? pendingDamage.id : '';
        const responseType = typeof pendingDamage?.responseType === 'string' ? pendingDamage.responseType : '';
        return `pending-damage:${responderId}:${phase}:${pendingId}:${responseType}`;
    }

    return progressMarker;
}

export function buildOnlineAiRecoveryTrackerKey(args: {
    playerId: string;
    reason: string;
    fingerprint: string;
}): string {
    return `${args.playerId}:${args.reason}:${args.fingerprint}`;
}

export function buildOnlineAiRecoveryTrackerSnapshot(args: {
    state: MatchState<unknown>;
    candidate: ForceEndTurnStalledAiResolution;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): {
    progressMarker: string;
    recoveryFingerprint: string;
    trackerKey: string;
} {
    const progressMarker = buildAiProgressMarker(args.state, { engineConfig: args.engineConfig });
    const recoveryFingerprint = resolveOnlineAiRecoveryFingerprint({
        state: args.state,
        candidate: args.candidate,
        progressMarker,
        engineConfig: args.engineConfig,
    });
    return {
        progressMarker,
        recoveryFingerprint,
        trackerKey: buildOnlineAiRecoveryTrackerKey({
            playerId: args.candidate.playerId,
            reason: args.candidate.reason,
            fingerprint: recoveryFingerprint,
        }),
    };
}
