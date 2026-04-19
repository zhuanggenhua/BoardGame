/**
 * 暴击 Token 与 custom action 伤害技能的兼容性测试
 *
 * Bug 场景：暗影贼通过乾坤大挪移获得暴击 Token 后，
 * 使用 kidney-shot（破隐一击）等 custom action 伤害技能时，
 * 暴击选择不弹出。
 *
 * 根因：getPlayerAbilityBaseDamage 只计算显式 damage action 的值，
 * 对 custom action 伤害（如 CP 系伤害）返回 0，导致暴击门控（≥5）失败。
 *
 * 修复：CustomActionMeta 新增 estimateDamage 回调，
 * getPlayerAbilityBaseDamage 对有 estimateDamage 的 custom action 调用回调估算伤害。
 * 暗影贼的 CP 系伤害 custom action 注册时提供了基于当前 CP 的估算函数。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import {
    testSystems,
    createQueuedRandom,
    cmd,
    assertState,
    createHeroMatchup,
    advanceTo,
} from './test-utils';
import { TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { initializeCustomActions } from '../domain/customActions';
import { getPendingAttackExpectedDamage } from '../domain/utils';
import { getPlayerAbilityBaseDamage } from '../domain/abilityLookup';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import type { DiceThroneExpectation } from './test-utils';

beforeAll(() => {
    initializeCustomActions();
});

describe('暴击 Token 与 custom action 伤害技能', () => {

    it('getPlayerAbilityBaseDamage 通过 estimateDamage 回调估算 CP 系伤害', () => {
        const setup = createHeroMatchup('shadow_thief', 'paladin', (core) => {
            core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        });
        const random = createQueuedRandom([]);
        const state = setup(['0', '1'], random);

        // kidney-shot: damage-full-cp → estimateDamage 返回当前 CP = 10
        expect(getPlayerAbilityBaseDamage(state.core, '0', 'kidney-shot')).toBe(10);

        // pickpocket: damage-half-cp → estimateDamage 返回 ceil(10/2) = 5
        expect(getPlayerAbilityBaseDamage(state.core, '0', 'pickpocket')).toBe(5);
    });

    it('getPendingAttackExpectedDamage 对 custom action 伤害技能返回正确预估', () => {
        const setup = createHeroMatchup('shadow_thief', 'paladin', (core) => {
            core.players['0'].resources[RESOURCE_IDS.CP] = 8;
        });
        const random = createQueuedRandom([]);
        const state = setup(['0', '1'], random);

        // kidney-shot: full CP = 8
        const pendingKidney = {
            attackerId: '0', defenderId: '1',
            sourceAbilityId: 'kidney-shot',
            isDefendable: true, bonusDamage: 0,
        };
        expect(getPendingAttackExpectedDamage(state.core, pendingKidney as any)).toBe(8);

        // shadow-shank: CP + 5 = 13
        const pendingShank = {
            attackerId: '0', defenderId: '1',
            sourceAbilityId: 'shadow-shank',
            isDefendable: true, bonusDamage: 0,
        };
        expect(getPendingAttackExpectedDamage(state.core, pendingShank as any)).toBe(13);
    });

    it('暗影贼用 kidney-shot 攻击时，持有暴击应弹出选择', () => {
        // 骰子 [1,2,3,4,5] → large straight → kidney-shot
        const random = createQueuedRandom([1, 2, 3, 4, 5]);
        const setup = createHeroMatchup('shadow_thief', 'paladin', (core) => {
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
            core.players['0'].resources[RESOURCE_IDS.CP] = 8;
        });

        const runner = new GameTestRunner<DiceThroneCore, DiceThroneCommand, DiceThroneEvent, DiceThroneExpectation>({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup,
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: 'kidney-shot + 暴击 Token',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'kidney-shot' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
        });

        const sys = result.finalState.sys;
        expect(sys.interaction.current).not.toBeUndefined();
        expect(result.finalState.core.pendingAttack?.offensiveRollEndTokenResolved).not.toBe(true);
    });

    it('暗影贼用 kidney-shot + 暴击：选择使用后 +4 伤害', () => {
        const random = createQueuedRandom([1, 2, 3, 4, 5]);
        const setup = createHeroMatchup('shadow_thief', 'paladin', (core) => {
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
            core.players['0'].resources[RESOURCE_IDS.CP] = 8;
        });

        const runner = new GameTestRunner<DiceThroneCore, DiceThroneCommand, DiceThroneEvent, DiceThroneExpectation>({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup,
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: 'kidney-shot + 使用暴击',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'kidney-shot' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
            ],
        });

        const core = result.finalState.core;
        expect(core.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(0);
        expect(core.pendingAttack?.bonusDamage).toBe(4);
        expect(core.pendingAttack?.offensiveRollEndTokenResolved).toBe(true);
    });

    it('shadow-shank (终极) + 暴击：终极不可防御但暴击仍可用', () => {
        // 骰子 [6,6,6,6,6] → 5 shadow → shadow-shank
        const random = createQueuedRandom([6, 6, 6, 6, 6]);
        const setup = createHeroMatchup('shadow_thief', 'paladin', (core) => {
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
            core.players['0'].resources[RESOURCE_IDS.CP] = 5;
        });

        const runner = new GameTestRunner<DiceThroneCore, DiceThroneCommand, DiceThroneEvent, DiceThroneExpectation>({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup,
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: 'shadow-shank + 暴击 Token',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'shadow-shank' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
        });

        const sys = result.finalState.sys;
        expect(sys.interaction.current).not.toBeUndefined();
    });

    it('CP 为 0 时 kidney-shot 预估伤害为 0，暴击门控正确拦截', () => {
        const setup = createHeroMatchup('shadow_thief', 'paladin', (core) => {
            core.players['0'].resources[RESOURCE_IDS.CP] = 0;
        });
        const random = createQueuedRandom([]);
        const state = setup(['0', '1'], random);

        // CP=0 时 kidney-shot 预估伤害为 0，不应通过暴击门控
        expect(getPlayerAbilityBaseDamage(state.core, '0', 'kidney-shot')).toBe(0);
    });
});
