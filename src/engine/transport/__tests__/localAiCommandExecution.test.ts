import { describe, expect, it, vi } from 'vitest';
import { createInitialSystemState } from '../../pipeline';
import type { MatchState } from '../../types';
import { executeLocalAiCommandBatch } from '../localAiCommandExecution';
import type { LocalAiCommandEffect } from '../localAiCommandEffects';

type TestCore = {
    marker: string;
    players: Record<string, { resources: { cp: number }; hand: unknown[] }>;
};

function createState(marker: string, cp = 0): MatchState<TestCore> {
    return {
        core: {
            marker,
            players: {
                '1': {
                    resources: { cp },
                    hand: [],
                },
            },
        },
        sys: createInitialSystemState(['0', '1'], []),
    };
}

describe('executeLocalAiCommandBatch', () => {
    it('本地 AI 批次中后续命令被拒绝时回滚已执行命令和随机游标', async () => {
        const initialState = createState('before', 0);
        const afterFirstCommand = createState('after-first-command', 1);
        let currentState: MatchState<unknown> = initialState as MatchState<unknown>;
        let randomCursor = 3;
        const commandEffectsByToken: Record<string, LocalAiCommandEffect> = {};
        const restoreBatchSnapshot = vi.fn((snapshot: {
            state: MatchState<unknown>;
            randomCursor: number | null;
        }) => {
            currentState = snapshot.state;
            randomCursor = snapshot.randomCursor ?? randomCursor;
        });

        const dispatch = vi.fn((type: string, payload: unknown) => {
            const token = (payload as { __aiTraceToken?: string }).__aiTraceToken;
            expect(token).toBeTruthy();
            if (type === 'FIRST_OK') {
                currentState = afterFirstCommand as MatchState<unknown>;
                randomCursor = 9;
                commandEffectsByToken[token!] = {
                    hasStateDelta: true,
                    markerProgressed: true,
                };
                return;
            }

            commandEffectsByToken[token!] = {
                hasStateDelta: false,
                markerProgressed: false,
                rejected: true,
                failureReason: 'domain_rejected',
            };
        });

        const result = await executeLocalAiCommandBatch({
            gameId: 'test-game',
            seed: 'seed-1',
            playerId: '1',
            source: 'local-ai',
            actionKind: 'test-action',
            actionVisibility: 'visible',
            attemptKey: 'attempt-local-ai-batch',
            commands: [
                { type: 'FIRST_OK', payload: { step: 1 } },
                { type: 'SECOND_FAILS', payload: { step: 2 } },
            ],
            dispatch,
            getState: () => currentState,
            getRandomCursor: () => randomCursor,
            restoreBatchSnapshot,
            commandEffectsByToken,
            engineConfig: { gameId: 'test-game' },
        });

        expect(result).toEqual({
            hasAnyCommandEffect: false,
            rolledBack: true,
            failedCommandType: 'SECOND_FAILS',
            failureReason: 'domain_rejected',
        });
        expect(currentState).toBe(initialState);
        expect(randomCursor).toBe(3);
        expect(restoreBatchSnapshot).toHaveBeenCalledWith({
            state: initialState,
            randomCursor: 3,
        });
        expect(dispatch).toHaveBeenCalledTimes(2);
    });
});
