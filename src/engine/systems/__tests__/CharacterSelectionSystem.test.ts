/**
 * 角色选择系统测试
 */

import { describe, it, expect } from 'vitest';
import { CharacterSelectionSystem, CHARACTER_SELECTION_COMMANDS } from '../CharacterSelectionSystem';
import type { CharacterSelectionState } from '../../../core/ui/CharacterSelection.types';

describe('CharacterSelectionSystem', () => {
    describe('createInitialState', () => {
        it('应该创建正确的初始状态', () => {
            const system = new CharacterSelectionSystem();
            const playerIds = ['0', '1'];
            const state = system.createInitialState(playerIds);

            expect(state.selectedCharacters).toEqual({
                '0': 'unselected',
                '1': 'unselected',
            });
            expect(state.readyPlayers).toEqual({
                '0': false,
                '1': false,
            });
            expect(state.hostPlayerId).toBe('0');
            expect(state.hostStarted).toBe(false);
        });

        it('应该支持自定义房主 ID', () => {
            const system = new CharacterSelectionSystem({ initialHostId: '1' });
            const playerIds = ['0', '1'];
            const state = system.createInitialState(playerIds);

            expect(state.hostPlayerId).toBe('1');
        });
    });

    describe('isEveryoneReady', () => {
        it('房主只需选角即可', () => {
            const system = new CharacterSelectionSystem();
            const state: CharacterSelectionState = {
                selectedCharacters: {
                    '0': 'monk',
                    '1': 'unselected',
                },
                readyPlayers: {
                    '0': false,
                    '1': false,
                },
                hostPlayerId: '0',
                hostStarted: false,
            };

            expect(system.isEveryoneReady(state, ['0'])).toBe(true);
            expect(system.isEveryoneReady(state, ['0', '1'])).toBe(false);
        });

        it('非房主需要选角且准备', () => {
            const system = new CharacterSelectionSystem();
            const state: CharacterSelectionState = {
                selectedCharacters: {
                    '0': 'monk',
                    '1': 'barbarian',
                },
                readyPlayers: {
                    '0': false,
                    '1': false,
                },
                hostPlayerId: '0',
                hostStarted: false,
            };

            expect(system.isEveryoneReady(state, ['0', '1'])).toBe(false);

            state.readyPlayers['1'] = true;
            expect(system.isEveryoneReady(state, ['0', '1'])).toBe(true);
        });

        it('所有玩家都准备完毕', () => {
            const system = new CharacterSelectionSystem();
            const state: CharacterSelectionState = {
                selectedCharacters: {
                    '0': 'monk',
                    '1': 'barbarian',
                    '2': 'pyromancer',
                },
                readyPlayers: {
                    '0': false,
                    '1': true,
                    '2': true,
                },
                hostPlayerId: '0',
                hostStarted: false,
            };

            expect(system.isEveryoneReady(state, ['0', '1', '2'])).toBe(true);
        });
    });

    describe('命令验证', () => {
        it('SELECT_CHARACTER 需要在 setup 阶段', () => {
            const system = new CharacterSelectionSystem();
            const hooks = system.getHooks();
            
            const state = {
                sys: {
                    characterSelection: system.createInitialState(['0', '1']),
                    flow: { currentPhase: 'setup' },
                },
            };

            const command = {
                type: CHARACTER_SELECTION_COMMANDS.SELECT_CHARACTER,
                playerId: '0',
                payload: { characterId: 'monk' },
                sourceCommandType: CHARACTER_SELECTION_COMMANDS.SELECT_CHARACTER,
            };

            const result = hooks.beforeCommand?.(state, command);
            expect(result?.valid).toBe(true);
        });

        it('PLAYER_READY 需要先选角', () => {
            const system = new CharacterSelectionSystem();
            const hooks = system.getHooks();
            
            const state = {
                sys: {
                    characterSelection: system.createInitialState(['0', '1']),
                    flow: { currentPhase: 'setup' },
                },
            };

            const command = {
                type: CHARACTER_SELECTION_COMMANDS.PLAYER_READY,
                playerId: '1',
                payload: {},
                sourceCommandType: CHARACTER_SELECTION_COMMANDS.PLAYER_READY,
            };

            // 未选角时不能准备
            let result = hooks.beforeCommand?.(state, command);
            expect(result?.valid).toBe(false);
            expect(result?.error).toBe('character_not_selected');

            // 选角后可以准备
            state.sys.characterSelection!.selectedCharacters['1'] = 'monk';
            result = hooks.beforeCommand?.(state, command);
            expect(result?.valid).toBe(true);
        });

        it('HOST_START_GAME 只能由房主执行', () => {
            const system = new CharacterSelectionSystem();
            const hooks = system.getHooks();
            
            const state = {
                sys: {
                    characterSelection: system.createInitialState(['0', '1']),
                    flow: { currentPhase: 'setup' },
                },
            };

            const command = {
                type: CHARACTER_SELECTION_COMMANDS.HOST_START_GAME,
                playerId: '1',
                payload: {},
                sourceCommandType: CHARACTER_SELECTION_COMMANDS.HOST_START_GAME,
            };

            // 非房主不能开始
            let result = hooks.beforeCommand?.(state, command);
            expect(result?.valid).toBe(false);
            expect(result?.error).toBe('player_mismatch');

            // 房主可以开始
            command.playerId = '0';
            result = hooks.beforeCommand?.(state, command);
            expect(result?.valid).toBe(true);
        });
    });

    describe('事件处理', () => {
        it('CHARACTER_SELECTED 应该更新选角状态', () => {
            const system = new CharacterSelectionSystem();
            const hooks = system.getHooks();
            
            const state = {
                sys: {
                    characterSelection: system.createInitialState(['0', '1']),
                },
            };

            const event = {
                type: 'CHARACTER_SELECTED' as const,
                payload: {
                    playerId: '0',
                    characterId: 'monk',
                },
                sourceCommandType: CHARACTER_SELECTION_COMMANDS.SELECT_CHARACTER,
            };

            hooks.afterEvent?.(state, event);
            expect(state.sys.characterSelection?.selectedCharacters['0']).toBe('monk');
        });

        it('PLAYER_READY 应该更新准备状态', () => {
            const system = new CharacterSelectionSystem();
            const hooks = system.getHooks();
            
            const state = {
                sys: {
                    characterSelection: system.createInitialState(['0', '1']),
                },
            };

            const event = {
                type: 'PLAYER_READY' as const,
                payload: {
                    playerId: '1',
                },
                sourceCommandType: CHARACTER_SELECTION_COMMANDS.PLAYER_READY,
            };

            hooks.afterEvent?.(state, event);
            expect(state.sys.characterSelection?.readyPlayers['1']).toBe(true);
        });

        it('HOST_STARTED 应该更新开始状态', () => {
            const system = new CharacterSelectionSystem();
            const hooks = system.getHooks();
            
            const state = {
                sys: {
                    characterSelection: system.createInitialState(['0', '1']),
                },
            };

            const event = {
                type: 'HOST_STARTED' as const,
                payload: {
                    playerId: '0',
                },
                sourceCommandType: CHARACTER_SELECTION_COMMANDS.HOST_START_GAME,
            };

            hooks.afterEvent?.(state, event);
            expect(state.sys.characterSelection?.hostStarted).toBe(true);
        });
    });
});
