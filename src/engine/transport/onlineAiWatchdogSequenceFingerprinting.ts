import type { MatchState } from '../types';
import {
    buildRefereeReplayDigestFromState,
    buildRefereeReplayFingerprintParts,
} from '../RefereeReplay';
import {
    buildAiProgressMarker,
    buildInteractionRecoveryFingerprintHint,
    buildInteractionSliderSemanticSignature,
    buildMultistepChoiceMetaSemanticSignature,
    buildPendingBonusDiceSettlementSemanticSignature,
    buildPendingDamageSemanticSignature,
    buildResponseWindowRecoveryFingerprintHint,
    type OnlineAiRecoveryEngineConfig,
    type ForceEndTurnStalledAiResolution,
    type HiddenInteractionDescriptor,
    type HiddenSimpleChoiceInteraction,
} from './onlineAiRecovery';

type CurrentInteractionState = {
    current?: HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction;
};

export function readOnlineAiRefereeDecisionRecoveryFingerprint(
    state: MatchState<unknown>,
    playerId: string,
): string | null {
    const digest = buildRefereeReplayDigestFromState(state, {
        playerId,
        traceLimit: 3,
    });
    const parts = buildRefereeReplayFingerprintParts(digest);
    return parts.length > 0 ? parts.join('|') : null;
}

function appendRefereeDecisionRecoveryFingerprint(
    fingerprint: string,
    state: MatchState<unknown>,
    playerId: string,
): string {
    const refereeFingerprint = readOnlineAiRefereeDecisionRecoveryFingerprint(state, playerId);
    return refereeFingerprint
        ? `${fingerprint}|referee:${refereeFingerprint}`
        : fingerprint;
}

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
    _engineConfig?: OnlineAiRecoveryEngineConfig | null,
): string | null {
    const currentInteraction = (state.sys?.interaction as CurrentInteractionState | undefined)?.current;
    if (!currentInteraction || String(currentInteraction.playerId ?? '') !== playerId) {
        return null;
    }

    const interactionKind = typeof currentInteraction.kind === 'string' ? currentInteraction.kind : '';
    const interactionId = typeof currentInteraction.id === 'string' ? currentInteraction.id : '';
    const interactionIdSignature = interactionKind === 'compare-roll-choice'
        ? interactionId
        : '';
    const data = currentInteraction.data;
    const options = Array.isArray(data?.options)
        ? data.options.map((option) => {
            const item = option as {
                id?: unknown;
                disabled?: unknown;
                value?: unknown;
            };
            return [
                typeof item.id === 'string' ? item.id : '',
                item.disabled === true ? '1' : '0',
                JSON.stringify(item.value ?? null),
            ].join(':');
        }).join(',')
        : '';
    const sliderSignature = buildInteractionSliderSemanticSignature(data?.slider);
    const multistepMetaSignature = buildMultistepChoiceMetaSemanticSignature(data?.meta);
    const pendingDamageSignature = buildPendingDamageSemanticSignature(
        (state.core as { pendingDamage?: unknown } | undefined)?.pendingDamage,
    );
    const pendingBonusDiceSignature = buildPendingBonusDiceSettlementSemanticSignature(
        (state.core as { pendingBonusDiceSettlement?: unknown } | undefined)?.pendingBonusDiceSettlement,
    );
    return [
        interactionKind,
        interactionIdSignature,
        typeof data?.sourceId === 'string' ? data.sourceId : '',
        typeof data?.title === 'string' ? data.title : '',
        sliderSignature,
        multistepMetaSignature,
        pendingDamageSignature,
        pendingBonusDiceSignature,
        Array.isArray(data?.allowedDieIds) ? data.allowedDieIds.join(',') : '',
        Array.isArray(data?.completedDieIds) ? data.completedDieIds.join(',') : '',
        JSON.stringify(data?.confirmValue ?? null),
        options,
    ].join('|');
}

export function buildOnlineAiRecoverySequenceStepKey(args: {
    state: MatchState<unknown>;
    playerId: string;
    progressMarker: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): string {
    const refereeFingerprint = readOnlineAiRefereeDecisionRecoveryFingerprint(
        args.state,
        args.playerId,
    );
    const interactionFingerprint = readOnlineAiCurrentInteractionSemanticFingerprint(
        args.state,
        args.playerId,
        args.engineConfig,
    );
    if (interactionFingerprint) {
        const base = `${args.progressMarker}|interaction:${interactionFingerprint}`;
        return refereeFingerprint ? `${base}|referee:${refereeFingerprint}` : base;
    }

    const responseWindowFingerprint = readOnlineAiCurrentResponseWindowRecoveryFingerprintHint(
        args.state,
        args.playerId,
    );
    if (responseWindowFingerprint) {
        const base = `${args.progressMarker}|response-window:${responseWindowFingerprint}`;
        return refereeFingerprint ? `${base}|referee:${refereeFingerprint}` : base;
    }

    if (refereeFingerprint) {
        return `${args.progressMarker}|referee:${refereeFingerprint}`;
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
        return appendRefereeDecisionRecoveryFingerprint(
            candidate.fingerprintHint ?? `action-loop:${candidate.playerId}:${phase}`,
            state,
            candidate.playerId,
        );
    }

    if (candidate.legalActionOnly === true) {
        return appendRefereeDecisionRecoveryFingerprint(
            candidate.fingerprintHint ?? `legal-action-only:${candidate.playerId}:${phase}`,
            state,
            candidate.playerId,
        );
    }

    if (candidateReason === 'visible-interaction' || candidateReason === 'hidden-interaction') {
        const current = (state.sys as { interaction?: { current?: unknown } } | undefined)?.interaction?.current as
            | HiddenInteractionDescriptor
            | HiddenSimpleChoiceInteraction
            | undefined;
        if (current) {
            return appendRefereeDecisionRecoveryFingerprint(
                buildInteractionRecoveryFingerprintHint(state, current, candidate.playerId, {
                    engineConfig: args.engineConfig,
                }),
                state,
                candidate.playerId,
            );
        }
        return appendRefereeDecisionRecoveryFingerprint(
            candidate.fingerprintHint ?? progressMarker,
            state,
            candidate.playerId,
        );
    }

    if (candidateReason === 'response-window' || candidateReason === 'response-loop') {
        const current = (state.sys as { responseWindow?: { current?: unknown } } | undefined)?.responseWindow?.current as {
            id?: unknown;
        } | undefined;
        if (current) {
            return appendRefereeDecisionRecoveryFingerprint(
                buildResponseWindowRecoveryFingerprintHint(
                    state,
                    candidate.playerId,
                    candidateReason === 'response-loop' ? 'response-loop' : 'response-window',
                ),
                state,
                candidate.playerId,
            );
        }
        return appendRefereeDecisionRecoveryFingerprint(
            candidate.fingerprintHint ?? progressMarker,
            state,
            candidate.playerId,
        );
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
        return appendRefereeDecisionRecoveryFingerprint(
            `pending-damage:${responderId}:${phase}:${pendingId}:${responseType}`,
            state,
            candidate.playerId,
        );
    }

    return appendRefereeDecisionRecoveryFingerprint(progressMarker, state, candidate.playerId);
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
    gameId?: string | null;
}): {
    progressMarker: string;
    recoveryFingerprint: string;
    trackerKey: string;
} {
    const progressMarker = buildAiProgressMarker(args.state, {
        engineConfig: args.engineConfig,
        gameId: args.gameId,
    });
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
