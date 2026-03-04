/**
 * 测试圣骑士复仇 II 技能的 CP 获取行为
 * 
 * 用户反馈：点击反击2每次都加CP
 * 
 * 预期行为：
 * 1. 触发复仇 II（3盔+1祈祷）应该只获得 4 CP 一次
 * 2. 选择玩家授予反击后，不应该再次获得 CP
 * 3. 多次点击技能按钮不应该重复获得 CP
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { DiceThroneDomain } from '../domain';
import { createQueuedRandom, createHeroMatchup, testSystems } from './test-utils';
import { TOKEN_IDS, PALADIN_DICE_FACE_IDS as FACES } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';

const INITIAL_CP = 1;
const INITIAL_HP = 50;

const cmd = (type: string, playerId: string, payload?: any) => ({ type, playerId, payload });

describe('圣骑士复仇技能 CP 获取测试', () => {
    it('复仇 I - 应该获得 2 CP（基础版本）', () => {
        const random = createQueuedRandom([3, 3, 3, 6, 1]); // 3盔+1祈祷
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createHeroMatchup('paladin', 'barbarian', (core) => {
                core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HP;
                core.players['0'].resources[RESOURCE_IDS.CP] = INITIAL_CP;
                core.players['1'].resources[RESOURCE_IDS.HP] = INITIAL_HP;
                core.players['1'].resources[RESOURCE_IDS.CP] = INITIAL_CP;
            }),
            silent: true,
        });

        const result = runner.run({
            name: '复仇I获得2CP',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'vengeance' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                players: {
                    '0': {
                        cp: INITIAL_CP + 2, // 应该只获得 2 CP
                        tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    },
                },
            },
        });

        expect(result.assertionErrors).toEqual([]);
    });

    it('复仇 II - 应该获得 4 CP（升级版本）', () => {
        const random = createQueuedRandom([3, 3, 3, 6, 1]); // 3盔+1祈祷
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createHeroMatchup('paladin', 'barbarian', (core) => {
                core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HP;
                core.players['0'].resources[RESOURCE_IDS.CP] = INITIAL_CP;
                core.players['1'].resources[RESOURCE_IDS.HP] = INITIAL_HP;
                core.players['1'].resources[RESOURCE_IDS.CP] = INITIAL_CP;
            }),
            silent: true,
        });

        const result = runner.run({
            name: '复仇II获得4CP',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'vengeance' }),
                // 此时应该出现选择玩家的交互
                // 选择自己
                cmd('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['0'] }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                players: {
                    '0': {
                        cp: INITIAL_CP + 4, // 应该只获得 4 CP
                        tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    },
                },
            },
        });

        expect(result.assertionErrors).toEqual([]);
    });

    it('复仇 II - 多次点击技能按钮不应该重复获得 CP', () => {
        const random = createQueuedRandom([3, 3, 3, 6, 1]); // 3盔+1祈祷
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createHeroMatchup('paladin', 'barbarian', (core) => {
                core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HP;
                core.players['0'].resources[RESOURCE_IDS.CP] = INITIAL_CP;
                core.players['1'].resources[RESOURCE_IDS.HP] = INITIAL_HP;
                core.players['1'].resources[RESOURCE_IDS.CP] = INITIAL_CP;
            }),
            silent: true,
        });

        const result = runner.run({
            name: '复仇II多次点击不重复获得CP',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'vengeance' }),
                // 尝试再次点击技能按钮（应该被拒绝或无效）
                cmd('SELECT_ABILITY', '0', { abilityId: 'vengeance' }),
                // 选择自己
                cmd('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['0'] }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                players: {
                    '0': {
                        cp: INITIAL_CP + 4, // 应该只获得 4 CP，不是 8
                        tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    },
                },
            },
        });

        expect(result.assertionErrors).toEqual([]);
    });
});
