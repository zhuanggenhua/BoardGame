/**
 * 测试圣骑士反击 II 技能的 CP 获取行为
 *
 * 用户反馈：点击反击2每次都加CP
 *
 * 预期行为：
 * 1. 触发反击 II（3盔+1祈祷）应该只获得 4 CP 一次
 * 2. 选择玩家授予神罚后，不应该再次获得 CP
 * 3. 多次点击技能按钮不应该重复获得 CP
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { DiceThroneDomain } from '../domain';
import { createQueuedRandom, createHeroMatchup, testSystems } from './test-utils';
import { TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { CP_MAX } from '../domain/types';
import { VENGEANCE_2 } from '../heroes/paladin/abilities';

const INITIAL_CP = 1;
const INITIAL_HP = 50;

const cmd = (type: string, playerId: string, payload?: any) => ({ type, playerId, payload });
const expectPaladinResources = (result: ReturnType<GameTestRunner<any, any, any, any>['run']>, cp: number) => {
    const player = result.finalState.core.players['0'];
    expect(player.resources[RESOURCE_IDS.CP]).toBe(cp);
    expect(player.tokens[TOKEN_IDS.RETRIBUTION] ?? 0).toBe(1);
};

const createVengeance2Setup = (startingCp: number) => createHeroMatchup('paladin', 'barbarian', (core) => {
    const player = core.players['0'];
    player.abilities = player.abilities.map((ability) => structuredClone(ability));
    const vengeanceIndex = player.abilities.findIndex((ability) => ability.id === 'vengeance');
    if (vengeanceIndex < 0) {
        throw new Error('未找到圣骑士 vengeance 基础技能');
    }

    player.abilities[vengeanceIndex] = structuredClone(VENGEANCE_2);
    player.abilityLevels['vengeance'] = 2;
    player.resources[RESOURCE_IDS.HP] = INITIAL_HP;
    player.resources[RESOURCE_IDS.CP] = startingCp;

    core.players['1'].resources[RESOURCE_IDS.HP] = INITIAL_HP;
    core.players['1'].resources[RESOURCE_IDS.CP] = INITIAL_CP;
});

describe('圣骑士复仇技能 CP 获取测试', () => {
    it('复仇 I - 应该获得 3 CP（基础版本）', () => {
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
            name: '复仇I获得3CP',
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
                        cp: INITIAL_CP + 3,
                        tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    },
                },
            },
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.actualErrors).toEqual([]);
        expectPaladinResources(result, INITIAL_CP + 3);
    });

    it('反击 II - 应该在真实交互链路中只获得 4 CP 一次', () => {
        const random = createQueuedRandom([3, 3, 3, 6, 1]); // 3盔+1祈祷
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createVengeance2Setup(INITIAL_CP),
            silent: true,
        });

        const result = runner.run({
            name: '复仇II真实链路获得4CP',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'vengeance-2-main' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['0'] }),
            ],
            expect: {
                turnPhase: 'main2',
                pendingInteraction: null,
                players: {
                    '0': {
                        cp: INITIAL_CP + 4,
                        tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                        abilityLevels: { vengeance: 2 },
                    },
                },
            },
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.actualErrors).toEqual([]);
        expectPaladinResources(result, INITIAL_CP + 4);
    });

    it('复仇 I - 接近上限时只应钳制到 CP_MAX，不应异常回满/溢出', () => {
        const random = createQueuedRandom([3, 3, 3, 6, 1]); // 3盔+1祈祷
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createHeroMatchup('paladin', 'barbarian', (core) => {
                core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HP;
                core.players['0'].resources[RESOURCE_IDS.CP] = CP_MAX - 1;
                core.players['1'].resources[RESOURCE_IDS.HP] = INITIAL_HP;
                core.players['1'].resources[RESOURCE_IDS.CP] = INITIAL_CP;
            }),
            silent: true,
        });

        const result = runner.run({
            name: '复仇I边界钳制到CP_MAX',
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
                        cp: CP_MAX,
                        tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    },
                },
            },
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.actualErrors).toEqual([]);
        expectPaladinResources(result, CP_MAX);
    });

    it('反击 II - 多次点击技能按钮不应该重复获得 CP', () => {
        const random = createQueuedRandom([3, 3, 3, 6, 1]); // 3盔+1祈祷
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createVengeance2Setup(INITIAL_CP),
            silent: true,
        });

        const result = runner.run({
            name: '复仇II多次点击不重复获得CP',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'vengeance-2-main' }),
                cmd('SELECT_ABILITY', '0', { abilityId: 'vengeance-2-main' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['0'] }),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': {
                        cp: INITIAL_CP + 4,
                        tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    },
                },
            },
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.actualErrors).toEqual([]);
        expectPaladinResources(result, INITIAL_CP + 4);
    });

    it('反击 II - 交互完成后再连点，也只能结算一次并在边界处钳制到 CP_MAX', () => {
        const random = createQueuedRandom([3, 3, 3, 6, 1]); // 3盔+1祈祷
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createVengeance2Setup(CP_MAX - 1),
            silent: true,
        });

        const result = runner.run({
            name: '复仇II交互完成后连点仍只结算一次',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'vengeance-2-main' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['0'] }),
                cmd('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['0'] }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                players: {
                    '0': {
                        cp: CP_MAX,
                        tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    },
                },
            },
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.actualErrors.map((entry) => entry.error)).toContain('no_pending_interaction');
        expectPaladinResources(result, CP_MAX);
    });
});
