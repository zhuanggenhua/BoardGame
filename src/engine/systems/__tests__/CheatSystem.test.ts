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
    madnessDeck?: string[];
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

    it('无 modifier 时 MERGE_STATE 仍可作为通用教程注入能力工作', () => {
        const system = createCheatSystem<TestCore>();
        const state = createTestState({
            players: {
                '0': { statusEffects: {} },
                '1': { statusEffects: {} },
            },
            madnessDeck: ['special_madness'],
        });
        const command: Command = {
            type: CHEAT_COMMANDS.MERGE_STATE,
            playerId: '0',
            payload: {
                fields: {
                    players: {
                        '0': {
                            statusEffects: {
                                focused: 2,
                            },
                        },
                    },
                },
            },
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.state?.core.players['0'].statusEffects.focused).toBe(2);
        expect(result?.state?.core.players['1'].statusEffects).toEqual({});
        expect(result?.state?.core.madnessDeck).toEqual(['special_madness']);
    });

    it('MERGE_STATE 可以同步设置教程练习局面的当前阶段，但不覆盖教程进度', () => {
        const system = createCheatSystem<TestCore>();
        const state = createTestState({
            players: {
                '0': { statusEffects: {} },
                '1': { statusEffects: {} },
            },
        });
        const command: Command = {
            type: CHEAT_COMMANDS.MERGE_STATE,
            playerId: '0',
            payload: {
                fields: {
                    players: {
                        '0': {
                            statusEffects: {
                                focused: 1,
                            },
                        },
                    },
                },
                sysFields: {
                    phase: 'deployment',
                    tutorial: { active: false },
                },
            },
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.state?.sys.phase).toBe('deployment');
        expect(result?.state?.sys.tutorial).toEqual(state.sys.tutorial);
        expect(result?.state?.core.players['0'].statusEffects.focused).toBe(1);
    });

    it('MERGE_STATE: 深合并玩家字段时不应污染未点名的 madnessDeck 字符串数组', () => {
        const system = createCheatSystem<TestCore>({
            getResource: () => 0,
            setResource: (core) => core,
        });
        const state = createTestState({
            players: {
                '0': { statusEffects: {} },
                '1': { statusEffects: {} },
            },
            madnessDeck: ['special_madness', 'special_madness', 'special_madness'],
        });
        const command: Command = {
            type: CHEAT_COMMANDS.MERGE_STATE,
            playerId: '0',
            payload: {
                fields: {
                    players: {
                        '0': {
                            statusEffects: {
                                focused: 1,
                            },
                        },
                    },
                },
            },
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.state?.core.players['0'].statusEffects.focused).toBe(1);
        expect(result?.state?.core.players['1'].statusEffects).toEqual({});
        expect(result?.state?.core.madnessDeck).toEqual([
            'special_madness',
            'special_madness',
            'special_madness',
        ]);
    });

    it('customCommands: 由游戏侧 adapter 处理自定义作弊命令', () => {
        const system = createCheatSystem<TestCore>({
            getResource: () => 0,
            setResource: (core) => core,
            customCommands: {
                'test:cheat_focus': ({ state, command }) => {
                    const payload = command.payload as { playerId: string; amount: number };
                    const player = state.core.players[payload.playerId];
                    if (!player) return;
                    return {
                        halt: true,
                        state: {
                            ...state,
                            core: {
                                ...state.core,
                                players: {
                                    ...state.core.players,
                                    [payload.playerId]: {
                                        ...player,
                                        statusEffects: {
                                            ...player.statusEffects,
                                            focused: payload.amount,
                                        },
                                    },
                                },
                            },
                        },
                    };
                },
            },
        });
        const state = createTestState({ players: { '0': { statusEffects: {} } } });
        const command: Command = {
            type: 'test:cheat_focus',
            playerId: '0',
            payload: { playerId: '0', amount: 3 },
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.state?.core.players['0'].statusEffects.focused).toBe(3);
    });

    it('customCommands: 未注册的自定义命令不应被通用作弊系统吞掉', () => {
        const system = createCheatSystem<TestCore>({
            getResource: () => 0,
            setResource: (core) => core,
            customCommands: {},
        });
        const state = createTestState({ players: { '0': { statusEffects: {} } } });
        const command: Command = {
            type: 'test:unknown_custom_cheat',
            playerId: '0',
            payload: {},
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
