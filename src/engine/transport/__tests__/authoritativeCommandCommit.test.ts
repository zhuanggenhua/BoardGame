import { describe, expect, it, vi } from 'vitest';
import type { MatchState, RandomFn } from '../../types';
import { createInitialSystemState } from '../../pipeline';
import {
    commitAuthoritativeCommandSuccess,
    type AuthoritativeCommandCommitMatch,
} from '../authoritativeCommandCommit';
import type { StoredMatchState } from '../storage';

type TestCore = {
    count: number;
};

const baseRandom: RandomFn = {
    random: () => 0,
    d: () => 1,
    range: (min) => min,
    shuffle: (array) => [...array],
};

function createState(count: number): MatchState<TestCore> {
    return {
        core: { count },
        sys: createInitialSystemState(['0', '1'], []),
    };
}

function createMatch(state: MatchState<unknown>, stateID = 1): AuthoritativeCommandCommitMatch {
    return {
        matchID: 'match-1',
        gameId: 'test-game',
        state,
        stateID,
        randomSeed: 'seed-1',
        random: baseRandom,
        getRandomCursor: () => 3,
        lastCommandPlayerId: null,
        lastBroadcastedViews: new Map([['0', { stale: true }]]),
        unloaded: false,
    };
}

describe('commitAuthoritativeCommandSuccess', () => {
    it('提交成功命令时更新权威状态、版本号、最后命令玩家并持久化', async () => {
        const match = createMatch(createState(0) as MatchState<unknown>);
        const nextState = createState(2) as MatchState<unknown>;
        const persisted: StoredMatchState[] = [];
        const onCommandSucceeded = vi.fn();

        const result = await commitAuthoritativeCommandSuccess({
            match,
            playerId: '0',
            commandType: 'ADD',
            nextState,
            createTrackedRandom: vi.fn(() => ({
                random: baseRandom,
                getCursor: () => 99,
            })),
            persistState: async (storedState) => {
                persisted.push(storedState);
            },
            onCommandSucceeded,
        });

        expect(result).toEqual({
            committed: true,
            stateIdAfter: 2,
            gameOver: undefined,
            restoredRandomCursor: null,
        });
        expect(match.state).toBe(nextState);
        expect(match.stateID).toBe(2);
        expect(match.lastCommandPlayerId).toBe('0');
        expect(persisted).toEqual([{
            G: nextState,
            _stateID: 2,
            randomSeed: 'seed-1',
            randomCursor: 3,
        }]);
        expect(onCommandSucceeded).toHaveBeenCalledWith('match-1', 'test-game', 'ADD');
    });

    it('Undo 恢复随机游标时重建随机源、清空广播缓存并清除持久化信号', async () => {
        const match = createMatch(createState(0) as MatchState<unknown>);
        const nextState = createState(2) as MatchState<unknown>;
        nextState.sys.undo = {
            ...nextState.sys.undo,
            restoredRandomCursor: 12,
        };
        const rebuiltRandom: RandomFn = {
            random: () => 0.5,
            d: () => 4,
            range: (_min, max) => max,
            shuffle: (array) => [...array].reverse(),
        };
        const createTrackedRandom = vi.fn(() => ({
            random: rebuiltRandom,
            getCursor: () => 12,
        }));
        const persisted: StoredMatchState[] = [];
        const restoredLogs: number[] = [];

        const result = await commitAuthoritativeCommandSuccess({
            match,
            playerId: '1',
            commandType: 'UNDO',
            nextState,
            createTrackedRandom,
            persistState: async (storedState) => {
                persisted.push(storedState);
            },
            logRandomCursorRestored: (cursor) => restoredLogs.push(cursor),
        });

        expect(result.restoredRandomCursor).toBe(12);
        expect(createTrackedRandom).toHaveBeenCalledWith('seed-1', 12);
        expect(match.random).toBe(rebuiltRandom);
        expect(match.getRandomCursor()).toBe(12);
        expect(match.lastBroadcastedViews.size).toBe(0);
        expect((match.state.sys.undo as { restoredRandomCursor?: number }).restoredRandomCursor).toBeUndefined();
        expect((persisted[0].G as MatchState<unknown>).sys.undo).toMatchObject({
            restoredRandomCursor: undefined,
        });
        expect(persisted[0].randomCursor).toBe(12);
        expect(restoredLogs).toEqual([12]);
    });

    it('对局已卸载时只更新内存态并返回未提交，不持久化或触发成功回调', async () => {
        const match = createMatch(createState(0) as MatchState<unknown>);
        match.unloaded = true;
        const onCommandSucceeded = vi.fn();

        const result = await commitAuthoritativeCommandSuccess({
            match,
            playerId: '0',
            commandType: 'ADD',
            nextState: createState(1) as MatchState<unknown>,
            createTrackedRandom: vi.fn(() => ({
                random: baseRandom,
                getCursor: () => 9,
            })),
            persistState: async () => {
                throw new Error('unloaded match should not persist');
            },
            onCommandSucceeded,
        });

        expect(result.committed).toBe(false);
        expect(match.stateID).toBe(2);
        expect(match.lastCommandPlayerId).toBe('0');
        expect(onCommandSucceeded).not.toHaveBeenCalled();
    });
});
