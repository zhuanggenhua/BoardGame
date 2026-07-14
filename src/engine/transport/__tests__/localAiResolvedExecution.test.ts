import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import { executeResolvedLocalAiAction } from '../localAiResolvedExecution';

function createState(controllerType: 'human' | 'local-ai'): MatchState<unknown> {
    return {
        core: {
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: controllerType },
            },
        },
        sys: {
            phase: 'main',
            eventStream: { entries: [], maxEntries: 200, nextId: 1 },
            actionLog: { entries: [], maxEntries: 50 },
        },
    } as MatchState<unknown>;
}

describe('executeResolvedLocalAiAction', () => {
    it('本地 AI 决策排队后若当前座位已变真人，不应继续替真人发命令', async () => {
        let currentState = createState('local-ai');
        const dispatch = vi.fn();
        const activeAttemptKeyRef = { current: 'attempt-queued' };

        await executeResolvedLocalAiAction({
            gameId: 'test-game',
            seed: 'seed-1',
            config: { gameId: 'test-game' } as any,
            resolution: {
                playerId: '1',
                attemptKey: 'attempt-queued',
                source: 'local-ai',
                action: {
                    actionId: 'reroll',
                    kind: 'reroll-dice',
                    label: '重掷',
                    commands: [{ type: 'REROLL_DICE', payload: { dieIds: ['die-1'] } }],
                },
            },
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', minimumActionDelayMs: 1 },
            },
            decisionResolvedAt: Date.now(),
            decisionElapsedMs: 0,
            activePhaseElapsedMs: null,
            activePhaseStartedAt: null,
            startedAt: Date.now(),
            isCancelled: () => false,
            lastVisibleActionAt: null,
            ensureAiTurnTimeline: () => undefined,
            startDelay: () => {
                currentState = createState('human');
                return {
                    promise: Promise.resolve({ outcome: 'elapsed', targetDelayMs: 1, waitedMs: 1 }),
                    cancel: vi.fn(),
                };
            },
            setPendingDelayHandle: vi.fn(),
            dispatch,
            getState: () => currentState,
            commandEffectsByToken: {},
            activeAttemptKeyRef,
            markerBeforeDispatch: 'before',
            scheduleRetry: vi.fn(),
            onVisibleActionAt: vi.fn(),
        });

        expect(dispatch).not.toHaveBeenCalled();
        expect(activeAttemptKeyRef.current).toBeNull();
    });
});
