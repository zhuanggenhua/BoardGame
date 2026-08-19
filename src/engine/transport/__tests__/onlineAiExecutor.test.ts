import { describe, expect, it, vi } from 'vitest';
import { executeOnlineAiCommandSequence } from '../onlineAiExecutor';
import type { MatchState, RandomFn } from '../../types';

describe('onlineAiExecutor', () => {
    it('AI 命令序列中后续命令失败时应回滚已执行命令的状态并保留失败原因', async () => {
        const snapshotState = {
            core: { marker: 'before' },
            sys: { phase: 'summon' },
        } as unknown as MatchState<unknown>;
        const mutatedState = {
            core: { marker: 'after-first-command' },
            sys: { phase: 'move' },
        } as unknown as MatchState<unknown>;
        const restoredRandom = vi.fn() as unknown as RandomFn;
        const restoredCursor = vi.fn(() => 7);
        const match = {
            matchID: 'match-online-ai-command-sequence-rollback',
            state: snapshotState,
            stateID: 10,
            randomSeed: 'seed-online-ai-command-sequence',
            random: vi.fn() as unknown as RandomFn,
            getRandomCursor: vi.fn(() => 7),
            lastCommandPlayerId: '0',
            lastBroadcastedViews: new Map<string, unknown>([['0', { cached: true }]]),
            lastCommandFailureReason: null as string | null,
        };
        const persistState = vi.fn(async () => {});
        const broadcastState = vi.fn();
        const executeCommand = vi.fn(async (command: { type: string }) => {
            if (command.type === 'FIRST_OK') {
                match.state = mutatedState;
                match.stateID = 11;
                match.lastCommandPlayerId = '1';
                match.lastBroadcastedViews.set('1', { cached: true });
                return true;
            }

            match.lastCommandFailureReason = 'pipeline_error: second command denied';
            return false;
        });

        const result = await executeOnlineAiCommandSequence({
            match,
            playerId: '1',
            commands: [
                { type: 'FIRST_OK', payload: { step: 1 } },
                { type: 'SECOND_FAILS', payload: { step: 2 } },
            ],
            options: {
                reportFailureFeedback: false,
                feedbackSource: 'online-ai-watchdog',
                onlineAiAttemptKey: 'attempt-online-ai-command-sequence',
            },
            createTrackedRandom: vi.fn(() => ({
                random: restoredRandom,
                getCursor: restoredCursor,
            })),
            persistState,
            broadcastState,
            executeCommand,
        });

        expect(result).toEqual({
            success: false,
            executedCommandTypes: ['FIRST_OK'],
            failedCommandType: 'SECOND_FAILS',
            failureReason: 'pipeline_error: second command denied',
            stateChanged: false,
        });
        expect(match.state).toBe(snapshotState);
        expect(match.stateID).toBe(10);
        expect(match.random).toBe(restoredRandom);
        expect(match.getRandomCursor).toBe(restoredCursor);
        expect(match.lastCommandPlayerId).toBe('0');
        expect(match.lastBroadcastedViews.size).toBe(0);
        expect(match.lastCommandFailureReason).toBe('pipeline_error: second command denied');
        expect(persistState).toHaveBeenCalledWith({
            G: snapshotState,
            _stateID: 10,
            randomSeed: 'seed-online-ai-command-sequence',
            randomCursor: 7,
        });
        expect(broadcastState).toHaveBeenCalledTimes(1);
    });
});
