/**
 * 王权骰铸（DiceThrone）选角流程测试
 */

import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCore, PlayerReadyCommand, SelectCharacterCommand, HostStartGameCommand } from '../domain/types';
import type { RandomFn } from '../../../engine/types';
import type { TurnPhase } from '../domain/types';
import { validateCommand } from '../domain/commandValidation';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';

// 固定随机数
const fixedRandom: RandomFn = {
    random: () => 0,
    d: () => 1,
    range: (min) => min,
    shuffle: (arr) => [...arr],
};

const createInitialState = (): DiceThroneCore => {
    return DiceThroneDomain.setup(['0', '1'], fixedRandom);
};

describe('选角流程', () => {
    describe('PLAYER_READY 命令', () => {
        it('未选角色时不能准备', () => {
            const state = createInitialState();
            const cmd: PlayerReadyCommand = {
                type: 'PLAYER_READY',
                playerId: '1',
                payload: {},
            };
            
            const result = validateCommand(state, cmd, 'setup');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('character_not_selected');
        });

        it('选好角色后可以准备', () => {
            const state = createInitialState();
            
            // 先选角色
            state.selectedCharacters['1'] = 'monk';
            
            const cmd: PlayerReadyCommand = {
                type: 'PLAYER_READY',
                playerId: '1',
                payload: {},
            };
            
            const result = validateCommand(state, cmd, 'setup');
            expect(result.valid).toBe(true);
        });

        it('准备后状态更新', () => {
            const state = createInitialState();
            state.selectedCharacters['1'] = 'monk';
            
            const cmd: PlayerReadyCommand = {
                type: 'PLAYER_READY',
                playerId: '1',
                payload: {},
            };
            
            // 执行命令
            const events = execute({ core: state, sys: { phase: 'setup' } }, cmd, fixedRandom);
            expect(events.length).toBe(1);
            expect(events[0].type).toBe('PLAYER_READY');
            
            // 应用事件
            const newState = reduce(state, events[0]);
            expect(newState.readyPlayers['1']).toBe(true);
        });

        it('非 setup 阶段不能准备', () => {
            const state = createInitialState();
            state.selectedCharacters['1'] = 'monk';
            
            const cmd: PlayerReadyCommand = {
                type: 'PLAYER_READY',
                playerId: '1',
                payload: {},
            };
            
            const result = validateCommand(state, cmd, 'upkeep' as TurnPhase);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('invalid_phase');
        });
    });

    describe('HOST_START_GAME 命令', () => {
        it('房主可以开始游戏（全员准备后）', () => {
            const state = createInitialState();
            // 两个玩家都选好角色
            state.selectedCharacters['0'] = 'monk';
            state.selectedCharacters['1'] = 'barbarian';
            // 非房主玩家准备
            state.readyPlayers['1'] = true;
            
            const cmd: HostStartGameCommand = {
                type: 'HOST_START_GAME',
                playerId: '0',
                payload: {},
            };
            
            const result = validateCommand(state, cmd, 'setup');
            expect(result.valid).toBe(true);
        });

        it('非房主不能开始游戏', () => {
            const state = createInitialState();
            state.selectedCharacters['0'] = 'monk';
            state.selectedCharacters['1'] = 'barbarian';
            state.readyPlayers['1'] = true;
            
            const cmd: HostStartGameCommand = {
                type: 'HOST_START_GAME',
                playerId: '1', // 非房主
                payload: {},
            };
            
            const result = validateCommand(state, cmd, 'setup');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('player_mismatch');
        });
    });

    describe('SELECT_CHARACTER 命令', () => {
        it('可以选择角色', () => {
            const state = createInitialState();
            
            const cmd: SelectCharacterCommand = {
                type: 'SELECT_CHARACTER',
                playerId: '0',
                payload: { characterId: 'monk' },
            };
            
            const result = validateCommand(state, cmd, 'setup');
            expect(result.valid).toBe(true);
        });

        it('不能选择已被其他玩家选择的角色', () => {
            const state = createInitialState();
            state.selectedCharacters['1'] = 'monk';

            const cmd: SelectCharacterCommand = {
                type: 'SELECT_CHARACTER',
                playerId: '0',
                payload: { characterId: 'monk' },
            };

            const result = validateCommand(state, cmd, 'setup');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('character_already_taken');
        });

        it('选角后状态更新', () => {
            const state = createInitialState();
            
            const cmd: SelectCharacterCommand = {
                type: 'SELECT_CHARACTER',
                playerId: '0',
                payload: { characterId: 'monk' },
            };
            
            const events = execute({ core: state, sys: { phase: 'setup' } }, cmd, fixedRandom);
            expect(events.length).toBe(1);
            expect(events[0].type).toBe('CHARACTER_SELECTED');
            
            const newState = reduce(state, events[0]);
            expect(newState.selectedCharacters['0']).toBe('monk');
        });
    });
});
