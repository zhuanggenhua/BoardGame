/**
 * CheatSystem 单元测试
 */

import { describe, it, expect } from 'vitest';
import { createCheatSystem, CHEAT_COMMANDS, type CheatResourceModifier } from '../CheatSystem';
import type { Command, MatchState, RandomFn } from '../../types';
import { DEFAULT_TUTORIAL_STATE } from '../../types';

type TestPlayer = { statusEffects: Record<string, number> };

type TestCore = {
    players: Record<string, TestPlayer>;
};

const mockRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: (arr) => [...arr],
};

const createTestState = (core: TestCore): MatchState<TestCore> => ({
    sys: {
        schemaVersion: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        interaction: { queue: [] },
        log: { entries: [], maxEntries: 1000 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        actionLog: { entries: [], maxEntries: 50 },
        rematch: { votes: {}, ready: false },
        responseWindow: { current: undefined },
        tutorial: { ...DEFAULT_TUTORIAL_STATE },
        turnNumber: 1,
        phase: 'main1',
    },
    core,
});

describe('CheatSystem', () => {
    it('SET_STATUS: modifier 存在时更新状态效果数量', () => {
        const modifier: CheatResourceModifier<TestCore> = {
            getResource: () => 0,
            setResource: (core) => core,
            setStatus: (core, playerId, statusId, amount) => {
                const player = core.players[playerId];
                if (!player) return core;
                return {
                    ...core,
                    players: {
                        ...core.players,
                        [playerId]: {
                            ...player,
                            statusEffects: {
                                ...player.statusEffects,
                                [statusId]: amount,
                            },
                        },
                    },
                };
            },
        };
        const system = createCheatSystem(modifier);
        const state = createTestState({ players: { '0': { statusEffects: {} } } });
        const command: Command = {
            type: CHEAT_COMMANDS.SET_STATUS,
            playerId: '0',
            payload: { playerId: '0', statusId: 'knockdown', amount: 2 },
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.state?.core.players['0'].statusEffects.knockdown).toBe(2);
    });

    it('SET_STATUS: modifier 缺失时不处理命令', () => {
        const system = createCheatSystem<TestCore>({
            getResource: () => 0,
            setResource: (core) => core,
        });
        const state = createTestState({ players: { '0': { statusEffects: { knockdown: 1 } } } });
        const command: Command = {
            type: CHEAT_COMMANDS.SET_STATUS,
            playerId: '0',
            payload: { playerId: '0', statusId: 'knockdown', amount: 2 },
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result).toBeUndefined();
        expect(state.core.players['0'].statusEffects.knockdown).toBe(1);
    });

    it('无 modifier 时作弊命令直接跳过', () => {
        const system = createCheatSystem<TestCore>();
        const state = createTestState({ players: { '0': { statusEffects: {} } } });
        const command: Command = {
            type: CHEAT_COMMANDS.SET_STATUS,
            playerId: '0',
            payload: { playerId: '0', statusId: 'knockdown', amount: 2 },
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result).toBeUndefined();
    });
});
