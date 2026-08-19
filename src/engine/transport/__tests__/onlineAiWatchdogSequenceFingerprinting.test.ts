import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import { resolveOnlineAiRecoveryFingerprint } from '../onlineAiWatchdogSequenceFingerprinting';

const createState = (overrides: Partial<MatchState<unknown>> = {}): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase: 'main',
        turnNumber: 1,
        eventStream: { nextId: 1, entries: [] },
    },
    ...overrides,
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

describe('onlineAiWatchdogSequenceFingerprinting', () => {
    it('没有 tracker fingerprint 时按候选和权威状态生成 fallback fingerprint', () => {
        const fingerprint = resolveOnlineAiRecoveryFingerprint({
            state: createState({
                core: {
                    pendingDamage: {
                        id: 'damage-1',
                        responderId: '1',
                        responseType: 'prevent',
                    },
                },
            } as unknown as MatchState<unknown>),
            candidate: createCandidate({ reason: 'pending-damage' }),
            progressMarker: 'progress-marker-fallback',
        });

        expect(fingerprint).toBe('pending-damage:1:main:damage-1:prevent');
    });
});
