/**
 * 暴击 Token 跨英雄转移后使用测试
 *
 * 场景：暗影贼通过乾坤大挪移获得圣骑士的暴击 Token，
 * 然后使用匕首打击（4匕首=6伤害≥5门控），应该能在 offensiveRollEnd 使用暴击 +4 伤害。
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
import { INITIAL_HEALTH } from '../domain/types';
import { initializeCustomActions } from '../domain/customActions';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import type { DiceThroneExpectation } from './test-utils';
import { getUsableTokensForOffensiveRollEnd } from '../domain/tokenResponse';

beforeAll(() => {
    initializeCustomActions();
});

describe('暴击 Token 跨英雄转移后使用', () => {
    it('暗影贼持有暴击 Token 时，getUsableTokensForOffensiveRollEnd 应返回暴击', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 6]);
        const setup = createHeroMatchup('shadow_thief', 'shadow_thief', (core) => {
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
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

        // 推进到 offensiveRoll 阶段并选择技能
        const result = runner.run({
            name: '推进到选择技能后',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'dagger-strike-4' }),
            ],
        });

        // 直接检查 getUsableTokensForOffensiveRollEnd
        const core = result.finalState.core;
        expect(core.pendingAttack).not.toBeNull();
        
        const expectedDamage = 6; // dagger-strike-4 的基础伤害
        const usableTokens = getUsableTokensForOffensiveRollEnd(core, '0', expectedDamage);
        
        console.log('暗影贼 tokens:', core.players['0'].tokens);
        console.log('tokenDefinitions 中 onOffensiveRollEnd 的 Token:', 
            core.tokenDefinitions.filter(d => d.activeUse?.timing?.includes('onOffensiveRollEnd')).map(d => d.id));
        console.log('usableTokens:', usableTokens.map(t => t.id));
        console.log('暗影贼 CRIT 数量:', core.players['0'].tokens[TOKEN_IDS.CRIT]);
        
        // 暗影贼持有暴击 Token 且伤害≥5，应该返回暴击 Token
        expect(usableTokens.length).toBeGreaterThan(0);
        expect(usableTokens.some(t => t.id === TOKEN_IDS.CRIT)).toBe(true);
    });

    it('ADVANCE_PHASE 从 offensiveRoll 退出时应 halt 并弹出暴击选择', () => {
        // 骰子：[1,1,1,1,6] → 4 dagger + 1 shadow → 触发 dagger-strike-4 (6伤害)
        const random = createQueuedRandom([1, 1, 1, 1, 6]);
        const setup = createHeroMatchup('shadow_thief', 'shadow_thief', (core) => {
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
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
            name: '暗影贼暴击Token+匕首打击4→应halt弹出选择',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'dagger-strike-4' }),
                cmd('ADVANCE_PHASE', '0'),       // offensiveRoll exit → 应该 halt 弹出暴击选择
            ],
        });

        const core = result.finalState.core;
        const sys = result.finalState.sys;
        
        console.log('当前阶段:', core.turnPhase);
        console.log('pendingAttack:', core.pendingAttack ? {
            attackerId: core.pendingAttack.attackerId,
            sourceAbilityId: core.pendingAttack.sourceAbilityId,
            isDefendable: core.pendingAttack.isDefendable,
            offensiveRollEndTokenResolved: core.pendingAttack.offensiveRollEndTokenResolved,
            bonusDamage: core.pendingAttack.bonusDamage,
        } : null);
        console.log('sys.interaction.current:', sys.interaction.current);
        console.log('暗影贼 CRIT:', core.players['0'].tokens[TOKEN_IDS.CRIT]);
        
        // 应该还在 offensiveRoll 阶段（halt），等待暴击选择
        // 如果直接跳到 defensiveRoll，说明暴击选择被跳过了
        if (core.turnPhase === 'defensiveRoll' || core.turnPhase === 'main2') {
            console.error('BUG: 暴击 Token 选择被跳过！直接进入了', core.turnPhase);
            console.error('offensiveRollEndTokenResolved:', core.pendingAttack?.offensiveRollEndTokenResolved);
        }
        
        // 验证：应该有活跃的交互（暴击选择）
        expect(sys.interaction.current).not.toBeNull();
        expect(core.pendingAttack?.offensiveRollEndTokenResolved).not.toBe(true);
    });

    it('选择使用暴击 Token 后应消耗 Token 并增加 +4 伤害', () => {
        // 骰子：[1,1,1,1,6] → 4 dagger + 1 shadow → 触发 dagger-strike-4 (6伤害)
        const random = createQueuedRandom([1, 1, 1, 1, 6]);
        const setup = createHeroMatchup('shadow_thief', 'shadow_thief', (core) => {
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
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
            name: '暗影贼使用暴击Token完整流程',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'dagger-strike-4' }),
                cmd('ADVANCE_PHASE', '0'),       // offensiveRoll exit → halt 弹出暴击选择
                cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }), // 选择暴击（第一个选项）
            ],
        });

        const core = result.finalState.core;
        const sys = result.finalState.sys;
        
        console.log('选择暴击后:');
        console.log('  暗影贼 CRIT:', core.players['0'].tokens[TOKEN_IDS.CRIT]);
        console.log('  暗影贼 all tokens:', JSON.stringify(core.players['0'].tokens));
        console.log('  pendingAttack.bonusDamage:', core.pendingAttack?.bonusDamage);
        console.log('  pendingAttack.offensiveRollEndTokenResolved:', core.pendingAttack?.offensiveRollEndTokenResolved);
        console.log('  sys.interaction.current:', sys.interaction.current);
        
        // 检查所有事件来追踪 token 变化
        const events = result.allEvents ?? [];
        const tokenEvents = events.filter((e: any) => 
            e.type === 'CHOICE_RESOLVED' || e.type === 'TOKEN_CONSUMED' || e.type === 'TOKEN_GRANTED'
        );
        console.log('  Token 相关事件:', JSON.stringify(tokenEvents, null, 2));
        
        // 暴击 Token 应被消耗
        expect(core.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(0);
        // 应增加 +4 伤害
        expect(core.pendingAttack?.bonusDamage).toBe(4);
        // Token 选择应标记为已完成
        expect(core.pendingAttack?.offensiveRollEndTokenResolved).toBe(true);
        // 交互应已清除
        expect(sys.interaction.current).toBeUndefined();
    });

    it('选择跳过时不消耗 Token 也不增加伤害', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 6]);
        const setup = createHeroMatchup('shadow_thief', 'shadow_thief', (core) => {
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
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
            name: '暗影贼跳过暴击Token',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'dagger-strike-4' }),
                cmd('ADVANCE_PHASE', '0'),       // offensiveRoll exit → halt 弹出暴击选择
                cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-1' }), // 选择跳过（第二个选项）
            ],
        });

        const core = result.finalState.core;
        
        // Token 不应被消耗
        expect(core.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(1);
        // 不应增加伤害
        expect(core.pendingAttack?.bonusDamage ?? 0).toBe(0);
        // Token 选择应标记为已完成
        expect(core.pendingAttack?.offensiveRollEndTokenResolved).toBe(true);
    });

    it('reducer 处理 CHOICE_RESOLVED 时 token 数量变化追踪', () => {
        // 直接测试 reducer 对 CHOICE_RESOLVED 事件的处理
        const { reduce } = DiceThroneDomain;
        const random = createQueuedRandom([1, 1, 1, 1, 6]);
        const setup = createHeroMatchup('shadow_thief', 'shadow_thief', (core) => {
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
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

        // 推进到暴击选择出现
        const result = runner.run({
            name: '推进到暴击选择',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'dagger-strike-4' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
        });

        const coreBefore = result.finalState.core;
        console.log('reducer 测试 - 选择前 CRIT:', coreBefore.players['0'].tokens[TOKEN_IDS.CRIT]);

        // 模拟 CHOICE_RESOLVED 事件（与引擎产生的一致）
        const choiceResolvedEvent = {
            type: 'CHOICE_RESOLVED' as const,
            payload: {
                playerId: '0',
                statusId: undefined,
                tokenId: TOKEN_IDS.CRIT,
                value: 1,
                customId: 'use-crit',
                sourceAbilityId: 'dagger-strike-4',
            },
            sourceCommandType: 'RESOLVE_CHOICE' as const,
            timestamp: 999,
        };

        const coreAfter = reduce(coreBefore, choiceResolvedEvent as any);
        console.log('reducer 测试 - 选择后 CRIT:', coreAfter.players['0'].tokens[TOKEN_IDS.CRIT]);
        console.log('reducer 测试 - bonusDamage:', coreAfter.pendingAttack?.bonusDamage);
        console.log('reducer 测试 - offensiveRollEndTokenResolved:', coreAfter.pendingAttack?.offensiveRollEndTokenResolved);

        // 验证：token 应被消耗（从 1 → 0）
        expect(coreAfter.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(0);
        expect(coreAfter.pendingAttack?.bonusDamage).toBe(4);
        expect(coreAfter.pendingAttack?.offensiveRollEndTokenResolved).toBe(true);
    });
});
