import type { MatchState } from '../types';
import type { ForceEndTurnStalledAiResolution, OnlineAiRecoveryEngineConfig } from './onlineAiRecovery';
import {
    buildOnlineAiRecoveryTrackerKey,
    resolveOnlineAiRecoveryFingerprint,
} from './onlineAiWatchdogSequenceFingerprinting';
import { normalizeOnlineAiRecoveryExpectedLegalActionOnlyCandidate } from './onlineAiWatchdogSequenceHelpers';

export function resolveChainedOnlineAiRecoveryCandidate(
    nextCandidate: ForceEndTurnStalledAiResolution | null,
    expectedPlayerId: string,
): ForceEndTurnStalledAiResolution | null {
    if (!nextCandidate || nextCandidate.playerId !== expectedPlayerId) {
        return null;
    }
    return nextCandidate;
}

export function resolveRevalidatedOnlineAiRecoveryCandidate(args: {
    latestCandidate: ForceEndTurnStalledAiResolution | null;
    expectedCandidate: ForceEndTurnStalledAiResolution;
    latestTrackerKey?: string;
    expectedTrackerKey: string;
}): ForceEndTurnStalledAiResolution | null {
    const { latestCandidate, expectedCandidate, latestTrackerKey, expectedTrackerKey } = args;
    if (!latestCandidate) {
        return null;
    }

    const stillSameCandidate = latestCandidate.playerId === expectedCandidate.playerId
        && latestCandidate.reason === expectedCandidate.reason
        && latestCandidate.requiresConfirmedAdvancePhase === expectedCandidate.requiresConfirmedAdvancePhase
        && latestCandidate.legalActionOnly === expectedCandidate.legalActionOnly;

    if (!stillSameCandidate || latestTrackerKey !== expectedTrackerKey) {
        return null;
    }

    return latestCandidate;
}

export function resolveRevalidatedOnlineAiRecoveryCandidateFromLatest(args: {
    rawLatestCandidate: ForceEndTurnStalledAiResolution | null;
    expectedCandidate: ForceEndTurnStalledAiResolution;
    latestFingerprint?: string | null;
    expectedTrackerKey: string;
}): ForceEndTurnStalledAiResolution | null {
    const latestCandidate = args.rawLatestCandidate
        ? normalizeOnlineAiRecoveryExpectedLegalActionOnlyCandidate({
            candidate: args.rawLatestCandidate,
            expectedCandidate: args.expectedCandidate,
        })
        : args.rawLatestCandidate;

    const latestTrackerKey = latestCandidate && args.latestFingerprint
        ? buildOnlineAiRecoveryTrackerKey({
            playerId: latestCandidate.playerId,
            reason: latestCandidate.reason,
            fingerprint: args.latestFingerprint,
        })
        : undefined;
    const compatibleLatestTrackerKey = latestTrackerKey && (
        latestTrackerKey === args.expectedTrackerKey
        || (latestTrackerKey?.startsWith(`${args.expectedTrackerKey}|referee:`) ?? false)
    )
        ? latestTrackerKey
        : undefined;
    const expectedTrackerKey = compatibleLatestTrackerKey ?? args.expectedTrackerKey;

    return resolveRevalidatedOnlineAiRecoveryCandidate({
        latestCandidate,
        expectedCandidate: args.expectedCandidate,
        latestTrackerKey,
        expectedTrackerKey,
    });
}

export function resolveRevalidatedOnlineAiRecoveryCandidateFromLiveState(args: {
    rawLatestCandidate: ForceEndTurnStalledAiResolution | null;
    expectedCandidate: ForceEndTurnStalledAiResolution;
    expectedTrackerKey: string;
    state: MatchState<unknown>;
    progressMarker: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): ForceEndTurnStalledAiResolution | null {
    const normalizedLatestCandidate = args.rawLatestCandidate
        ? normalizeOnlineAiRecoveryExpectedLegalActionOnlyCandidate({
            candidate: args.rawLatestCandidate,
            expectedCandidate: args.expectedCandidate,
        })
        : args.rawLatestCandidate;
    const latestFingerprint = normalizedLatestCandidate
        ? resolveOnlineAiRecoveryFingerprint({
            state: args.state,
            candidate: normalizedLatestCandidate,
            progressMarker: args.progressMarker,
            engineConfig: args.engineConfig,
        })
        : null;

    return resolveRevalidatedOnlineAiRecoveryCandidateFromLatest({
        rawLatestCandidate: normalizedLatestCandidate,
        expectedCandidate: args.expectedCandidate,
        expectedTrackerKey: args.expectedTrackerKey,
        latestFingerprint,
    });
}
