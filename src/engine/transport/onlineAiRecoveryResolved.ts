import type { AiSeatController } from '../ai';
import type { MatchState } from '../types';
import {
    buildInteractionRecoveryFingerprintHint,
    buildResponseWindowRecoveryFingerprintHint,
    type ForceEndTurnStalledAiResolution,
    type HiddenInteractionDescriptor,
    type HiddenSimpleChoiceInteraction,
} from './onlineAiRecovery';

export function normalizeFollowUpLegalActionOnlyCandidate(
    candidate: ForceEndTurnStalledAiResolution,
    expectedCandidate: ForceEndTurnStalledAiResolution,
): ForceEndTurnStalledAiResolution {
    if (
        expectedCandidate.reason !== 'active-turn'
        || expectedCandidate.legalActionOnly !== true
        || candidate.reason !== 'active-turn'
        || candidate.legalActionOnly === true
    ) {
        return candidate;
    }

    return {
        ...candidate,
        legalActionOnly: true,
        ...(expectedCandidate.allowForceCommandAfterLegalActionExhausted === true
            ? {
                allowForceCommandAfterLegalActionExhausted: true,
            }
            : {}),
    };
}

export async function resolveOnlineAiRecoveryResolved(args: {
    getSharedState: () => MatchState<unknown>;
    candidate: ForceEndTurnStalledAiResolution;
    seatControllers: Record<string, AiSeatController>;
    resolveRecoveryCandidate: () => Promise<ForceEndTurnStalledAiResolution | null>;
    applyPlayerView: (playerId: string) => MatchState<unknown>;
}): Promise<boolean> {
    const { candidate, seatControllers } = args;
    if (candidate.legalActionOnly === true) {
        const rawNextCandidate = await args.resolveRecoveryCandidate();
        const nextCandidate = rawNextCandidate
            ? normalizeFollowUpLegalActionOnlyCandidate(rawNextCandidate, candidate)
            : rawNextCandidate;
        if (!nextCandidate || nextCandidate.playerId !== candidate.playerId) {
            return true;
        }
        if (nextCandidate.legalActionOnly !== true) {
            return nextCandidate.reason !== 'response-window' && nextCandidate.reason !== 'response-loop';
        }
        if (nextCandidate.reason !== candidate.reason) {
            return true;
        }
        if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
            return nextCandidate.fingerprintHint !== candidate.fingerprintHint;
        }
        return false;
    }

    if (candidate.reason === 'active-turn') {
        const nextCandidate = await args.resolveRecoveryCandidate();
        return !nextCandidate
            || nextCandidate.playerId !== candidate.playerId
            || nextCandidate.reason !== 'active-turn';
    }

    if (candidate.reason === 'seat-legal-only') {
        const nextCandidate = await args.resolveRecoveryCandidate();
        if (!nextCandidate || nextCandidate.playerId !== candidate.playerId || nextCandidate.reason !== 'seat-legal-only') {
            return true;
        }
        if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
            return nextCandidate.fingerprintHint !== candidate.fingerprintHint;
        }
        return false;
    }

    if (candidate.reason === 'visible-interaction') {
        const sharedState = args.getSharedState();
        const current = (sharedState.sys?.interaction as { current?: { playerId?: unknown } } | undefined)?.current;
        if (current && typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
            const currentFingerprint = buildInteractionRecoveryFingerprintHint(
                sharedState,
                current as HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction,
                candidate.playerId,
            );
            if (currentFingerprint !== candidate.fingerprintHint) {
                return true;
            }
        }
        return String(current?.playerId ?? '') !== candidate.playerId;
    }

    if (candidate.reason === 'hidden-interaction') {
        const sharedState = args.getSharedState();
        const sharedInteraction = sharedState.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
        const seatView = args.applyPlayerView(candidate.playerId);
        const seatInteraction = seatView.sys?.interaction as { current?: { playerId?: unknown }; isBlocked?: unknown } | undefined;

        if (sharedInteraction?.current) {
            const sharedCurrent = sharedInteraction.current as { playerId?: unknown } | undefined;
            if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
                const sharedFingerprint = buildInteractionRecoveryFingerprintHint(
                    sharedState,
                    sharedInteraction.current as HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction,
                    candidate.playerId,
                );
                if (sharedFingerprint !== candidate.fingerprintHint) {
                    return true;
                }
            }
            if (String(sharedCurrent?.playerId ?? '') === candidate.playerId) {
                return false;
            }
        }

        if (seatInteraction?.current) {
            if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
                const seatFingerprint = buildInteractionRecoveryFingerprintHint(
                    seatView,
                    seatInteraction.current as HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction,
                    candidate.playerId,
                );
                if (seatFingerprint !== candidate.fingerprintHint) {
                    return true;
                }
            }
            return String(seatInteraction.current.playerId ?? '') !== candidate.playerId;
        }

        return seatInteraction?.isBlocked !== true;
    }

    if (candidate.reason === 'response-window' || candidate.reason === 'response-loop') {
        const sharedState = args.getSharedState();
        const current = (sharedState.sys?.responseWindow as {
            current?: {
                responderQueue?: unknown;
                currentResponderIndex?: unknown;
            };
        } | undefined)?.current;
        if (!current) {
            return true;
        }

        if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
            const currentFingerprint = buildResponseWindowRecoveryFingerprintHint(
                sharedState,
                candidate.playerId,
                candidate.reason,
            );
            if (currentFingerprint !== candidate.fingerprintHint) {
                return true;
            }
        }

        const responderQueue = Array.isArray(current.responderQueue) ? current.responderQueue : [];
        const responderIndex = typeof current.currentResponderIndex === 'number' ? current.currentResponderIndex : 0;
        const responderId = typeof responderQueue[responderIndex] === 'string' ? responderQueue[responderIndex] : '';
        if (!responderId) {
            return false;
        }

        const isForceClosingHumanResponseWindow = candidate.resolution.action.commands.some((command) => (
            command.type === 'SYS_RESPONSE_WINDOW_FORCE_CLOSE'
        )) && responderId !== candidate.playerId && seatControllers[responderId]?.type === 'human';
        if (isForceClosingHumanResponseWindow) {
            return false;
        }

        return responderId !== candidate.playerId || seatControllers[responderId]?.type === 'human';
    }

    return true;
}
