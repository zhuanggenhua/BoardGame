import { describe, expect, test } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { TheGangDomain } from '../domain';
import { engineConfig } from '../game';
import { THE_GANG_COMMANDS, type TheGangCommand, type TheGangCore } from '../domain/types';

const stateOf = (core: TheGangCore) => ({
    core,
    sys: {
        schemaVersion: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        interaction: { queue: [] },
        log: { entries: [], maxEntries: 0 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        actionLog: { entries: [], maxEntries: 50 },
        rematch: { votes: {}, ready: false },
        responseWindow: {},
        tutorial: { active: false, manifestId: null, stepIndex: 0, steps: [], step: null },
        turnNumber: 0,
        phase: '',
    },
});

const confirmProgressForAllPlayers = (
    adapter: ReturnType<typeof createReplayAdapter<TheGangCore, TheGangCommand>>,
    state: ReturnType<ReturnType<typeof createReplayAdapter<TheGangCore, TheGangCommand>>['setup']>,
    type: typeof THE_GANG_COMMANDS.END_ROUND | typeof THE_GANG_COMMANDS.REVEAL_SHOWDOWN | typeof THE_GANG_COMMANDS.START_NEXT_HEIST,
    timestamp: number,
) => {
    let nextState = state;
    for (const [index, playerId] of nextState.core.playerIds.entries()) {
        nextState = adapter.execute(nextState, {
            type,
            playerId,
            payload: {},
            timestamp: timestamp + index,
            skipValidation: true,
        }).state;
    }
    return nextState;
};

describe('The Gang domain flow', () => {
    test('3 人抢劫可以完成四轮并摊牌', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-flow-test');
        let state = adapter.setup(['0', '1', '2']);

        for (const round of [1, 2, 3, 4]) {
            for (const [index, playerId] of state.core.playerIds.entries()) {
                const result = adapter.execute(state, {
                    type: THE_GANG_COMMANDS.TAKE_CHIP,
                    playerId,
                    payload: { chip: index + 1 },
                    timestamp: round * 10 + index,
                    skipValidation: true,
                });
                state = result.state;
            }

            if (round < 4) {
                state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.END_ROUND, round * 100);
            }
        }

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.REVEAL_SHOWDOWN, 500);

        expect(state.core.phase).toBe('showdown');
        expect(state.core.communityCards).toHaveLength(5);
        expect(state.core.lastShowdown?.results).toHaveLength(3);
        expect(state.core.successes + state.core.failures).toBe(1);
    });

    test('非本人 playerView 隐藏其他玩家底牌', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-view-test');
        const state = adapter.setup(['0', '1', '2']);
        const view = TheGangDomain.playerView?.(state.core, '1');

        expect(view?.players?.['1'].pocketCards).toHaveLength(2);
        expect(view?.players?.['0'].pocketCards).toHaveLength(0);
        expect(view?.players?.['2'].pocketCards).toHaveLength(0);
    });

    test('基础版玩家数边界注册为 3-6 人', () => {
        expect(engineConfig.minPlayers).toBe(3);
        expect(engineConfig.maxPlayers).toBe(6);
    });

    test('每轮筹码不能重复，且所有玩家选完前不能推进', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-validation-test');
        let state = adapter.setup(['0', '1', '2']);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 1 },
            timestamp: 1,
            skipValidation: true,
        }).state;

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: { chip: 1 },
            timestamp: 2,
        })).toMatchObject({ valid: false, error: 'chipTaken' });

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.END_ROUND,
            playerId: '0',
            payload: {},
            timestamp: 3,
        })).toMatchObject({ valid: false, error: 'missingChips' });

        for (const [index, playerId] of ['1', '2'].entries()) {
            state = adapter.execute(state, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip: index + 2 },
                timestamp: index + 4,
                skipValidation: true,
            }).state;
        }

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.END_ROUND,
            playerId: '0',
            payload: {},
            timestamp: 6,
        })).toMatchObject({ valid: true });
    });

    test('推进轮次、摊牌和下一次抢劫都必须等待全员确认', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-progress-confirmation-test');
        let state = adapter.setup(['0', '1', '2']);

        for (const [index, playerId] of state.core.playerIds.entries()) {
            state = adapter.execute(state, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip: index + 1 },
                timestamp: index,
            }).state;
        }

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.END_ROUND,
            playerId: '0',
            payload: {},
            timestamp: 10,
        }).state;
        expect(state.core.round).toBe(1);
        expect(state.core.communityCards).toHaveLength(0);
        expect(state.core.pendingProgress).toEqual({ kind: 'end-round', approvals: ['0'] });

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.END_ROUND, 20);
        expect(state.core.round).toBe(2);
        expect(state.core.communityCards).toHaveLength(3);
        expect(state.core.pendingProgress).toBeUndefined();

        for (const round of [2, 3, 4]) {
            for (const [index, playerId] of state.core.playerIds.entries()) {
                state = adapter.execute(state, {
                    type: THE_GANG_COMMANDS.TAKE_CHIP,
                    playerId,
                    payload: { chip: index + 1 },
                    timestamp: round * 10 + index,
                }).state;
            }
            if (round < 4) {
                state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.END_ROUND, round * 100);
            }
        }

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
            playerId: '0',
            payload: {},
            timestamp: 500,
        }).state;
        expect(state.core.phase).toBe('chip-selection');
        expect(state.core.lastShowdown).toBeUndefined();
        expect(state.core.pendingProgress).toEqual({ kind: 'reveal-showdown', approvals: ['0'] });

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.REVEAL_SHOWDOWN, 510);
        expect(state.core.phase).toBe('showdown');
        expect(state.core.lastShowdown).toBeDefined();
        expect(state.core.pendingProgress).toBeUndefined();

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.START_NEXT_HEIST,
            playerId: '0',
            payload: {},
            timestamp: 600,
        }).state;
        expect(state.core.phase).toBe('showdown');
        expect(state.core.heistNumber).toBe(1);
        expect(state.core.pendingProgress).toEqual({ kind: 'start-next-heist', approvals: ['0'] });

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.START_NEXT_HEIST, 610);
        expect(state.core.phase).toBe('chip-selection');
        expect(state.core.heistNumber).toBe(2);
        expect(state.core.pendingProgress).toBeUndefined();
    });

    test('游戏结束后拒绝继续执行抢劫命令', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-gameover-test');
        const state = adapter.setup(['0', '1', '2']);
        const gameOverState = stateOf({
            ...state.core,
            phase: 'game-over',
            gameResult: { winners: ['0', '1', '2'] },
        });

        expect(TheGangDomain.validate(gameOverState, {
            type: THE_GANG_COMMANDS.START_NEXT_HEIST,
            playerId: '0',
            payload: {},
            timestamp: 1,
        })).toMatchObject({ valid: false, error: 'gameOver' });
    });
});
