import { describe, expect, test } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { TheGangDomain } from '../domain';
import { engineConfig } from '../game';
import { THE_GANG_COMMANDS, type TheGangCore } from '../domain/types';

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
                const result = adapter.execute(state, {
                    type: THE_GANG_COMMANDS.END_ROUND,
                    playerId: '0',
                    payload: {},
                    timestamp: round * 100,
                    skipValidation: true,
                });
                state = result.state;
            }
        }

        const showdown = adapter.execute(state, {
            type: THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
            playerId: '0',
            payload: {},
            timestamp: 500,
            skipValidation: true,
        });
        state = showdown.state;

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
