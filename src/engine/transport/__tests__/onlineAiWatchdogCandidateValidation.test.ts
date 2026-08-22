import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import {
    buildOnlineAiRecoveryTrackerSnapshot,
} from '../onlineAiWatchdogSequenceFingerprinting';
import {
    resolveRevalidatedOnlineAiRecoveryCandidateFromLiveState,
} from '../onlineAiWatchdogCandidateValidation';

const createState = (): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase: 'main',
        turnNumber: 1,
        eventStream: { nextId: 1, entries: [] },
    },
}) as unknown as MatchState<unknown>;

const createCandidate = (
    overrides: Partial<ForceEndTurnStalledAiResolution> = {},
): ForceEndTurnStalledAiResolution => ({
    playerId: '1',
    reason: 'active-turn',
    resolution: {
        playerId: '1',
        attemptKey: 'force-end-turn:1',
        source: 'local-ai',
        action: {
            actionId: 'force-end-turn:1',
            kind: 'force-end-turn',
            label: '强制结束 AI 回合',
            commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
        },
    },
    ...overrides,
});

describe('onlineAiWatchdogCandidateValidation', () => {
    it('最新候选与 tracker key 仍一致时允许 recovery sequence 继续', () => {
        const state = createState();
        const candidate = createCandidate();
        const snapshot = buildOnlineAiRecoveryTrackerSnapshot({
            state,
            candidate,
        });

        expect(resolveRevalidatedOnlineAiRecoveryCandidateFromLiveState({
            rawLatestCandidate: candidate,
            expectedCandidate: candidate,
            expectedTrackerKey: snapshot.trackerKey,
            state,
            progressMarker: snapshot.progressMarker,
        })).toBe(candidate);
    });

    it('最新候选 reason 漂移时拒绝继续旧 recovery sequence', () => {
        const state = createState();
        const expectedCandidate = createCandidate();
        const latestCandidate = createCandidate({ reason: 'seat-legal-only' });
        const snapshot = buildOnlineAiRecoveryTrackerSnapshot({
            state,
            candidate: expectedCandidate,
        });

        expect(resolveRevalidatedOnlineAiRecoveryCandidateFromLiveState({
            rawLatestCandidate: latestCandidate,
            expectedCandidate,
            expectedTrackerKey: snapshot.trackerKey,
            state,
            progressMarker: snapshot.progressMarker,
        })).toBeNull();
    });

    it('tracker key 漂移时拒绝继续旧 recovery sequence', () => {
        const state = createState();
        const candidate = createCandidate();

        expect(resolveRevalidatedOnlineAiRecoveryCandidateFromLiveState({
            rawLatestCandidate: candidate,
            expectedCandidate: candidate,
            expectedTrackerKey: '1:active-turn:old-progress-marker',
            state,
            progressMarker: 'new-progress-marker',
        })).toBeNull();
    });
});
