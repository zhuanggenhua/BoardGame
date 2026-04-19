/**
 * 暴击 Token 跨英雄转移后使用 - 完整流程测试
 *
 * 场景：圣骑士 vs 暗影贼
 * 1. 圣骑士持有暴击 Token
 * 2. 暗影贼通过乾坤大挪移（card-transfer-status）将暴击从圣骑士转移到自己
 * 3. 暗影贼使用匕首打击（dagger-strike-4，6伤害≥5门控）
 * 4. 验证暴击选择弹出 → 选择使用 → +4 伤害
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
import { COMMON_CARDS } from '../domain/commonCards';
import { initializeCustomActions } from '../domain/customActions';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent, InteractionDescriptor } from '../domain/types';
import type { DiceThroneExpectation } from './test-utils';
import type { AbilityCard } from '../types';

beforeAll(() => {
    initializeCustomActions();
});

const transferCard = COMMON_CARDS.find(c => c.id === 'card-transfer-status')!;

describe('暴击 Token 完整转移+使用流程（圣骑士→暗影贼）', () => {

    it('打出乾坤大挪移→TRANSFER_STATUS→暴击转移成功', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const setup = createHeroMatchup('shadow_thief', 'paladin', (core) => {
            core.players['1'].tokens[TOKEN_IDS.CRIT] = 1;
            core.players['0'].hand = [{ ...transferCard, id: 'transfer-inst' } as AbilityCard];
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

        // 所有命令在一次 run 中执行（GameTestRunner 每次 run 从 setup 开始）
        const result = runner.run({
            name: '打出乾坤大挪移→转移暴击',
            commands: [
                cmd('PLAY_CARD', '0', { cardId: 'transfer-inst' }),
                // PLAY_CARD 触发 transfer-status custom action → 创建 selectStatus 交互
                // 然后 TRANSFER_STATUS 在交互存在时执行
                cmd('TRANSFER_STATUS', '0', {
                    fromPlayerId: '1',
                    toPlayerId: '0',
                    statusId: TOKEN_IDS.CRIT,
                }),
            ],
        });

        const core = result.finalState.core;
        const sys = result.finalState.sys;

        console.log('转移后:');
        console.log('  圣骑士 CRIT:', core.players['1'].tokens[TOKEN_IDS.CRIT]);
        console.log('  暗影贼 CRIT:', core.players['0'].tokens[TOKEN_IDS.CRIT]);
        console.log('  暗影贼 all tokens:', JSON.stringify(core.players['0'].tokens));
        console.log('  sys.interaction.current:', sys.interaction.current);

        // 验证转移结果
        expect(core.players['1'].tokens[TOKEN_IDS.CRIT]).toBe(0);
        expect(core.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(1);
        // 交互应已自动完成
        expect(sys.interaction.current).toBeUndefined();
    });

    it('转移暴击后，暗影贼攻击时应弹出暴击选择（对手是圣骑士）', () => {
        // 骰子：[1,1,1,1,6] → 4 dagger + 1 shadow → 触发 dagger-strike-4 (6伤害)
        const random = createQueuedRandom([1, 1, 1, 1, 6]);
        const setup = createHeroMatchup('shadow_thief', 'paladin', (core) => {
            // 直接注入转移后的状态
            core.players['1'].tokens[TOKEN_IDS.CRIT] = 0;
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
            name: '暗影贼攻击→应弹出暴击选择',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'dagger-strike-4' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
        });

        const core = result.finalState.core;
        const sys = result.finalState.sys;

        console.log('暗影贼攻击后:');
        console.log('  暗影贼 CRIT:', core.players['0'].tokens[TOKEN_IDS.CRIT]);
        console.log('  sys.interaction:', sys.interaction.current?.kind);
        console.log('  offensiveRollEndTokenResolved:', core.pendingAttack?.offensiveRollEndTokenResolved);

        expect(sys.interaction.current).not.toBeUndefined();
        expect(core.pendingAttack?.offensiveRollEndTokenResolved).not.toBe(true);
    });

    it('完整流程：转移暴击→攻击→使用暴击→+4伤害', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 6]);
        const setup = createHeroMatchup('shadow_thief', 'paladin', (core) => {
            core.players['1'].tokens[TOKEN_IDS.CRIT] = 0;
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
            name: '攻击→暴击选择→使用暴击',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'dagger-strike-4' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
            ],
        });

        const core = result.finalState.core;
        const actionLogEntries = result.finalState.sys.actionLog?.entries ?? [];

        expect(core.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(0);
        expect(core.pendingAttack?.bonusDamage).toBe(4);
        expect(core.pendingAttack?.attackModifierBonusDamage ?? 0).toBe(0);
        expect(core.pendingAttack?.offensiveRollEndTokenResolved).toBe(true);
        const critLogEntry = actionLogEntries.find(entry =>
            entry.segments.some(segment => segment.type === 'i18n' && (segment as any).key === 'actionLog.offensiveRollEndTokenUsed')
        );
        expect(critLogEntry).toBeDefined();
    });

    it('完整端到端：打出乾坤大挪移→转移→攻击→使用暴击', () => {
        // 骰子：[1,1,1,1,6] → 4 dagger + 1 shadow → 触发 dagger-strike-4 (6伤害)
        const random = createQueuedRandom([1, 1, 1, 1, 6]);
        const setup = createHeroMatchup('shadow_thief', 'paladin', (core) => {
            core.players['1'].tokens[TOKEN_IDS.CRIT] = 1;
            core.players['0'].hand = [{ ...transferCard, id: 'transfer-inst' } as AbilityCard];
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
            name: '完整端到端流程',
            commands: [
                // 1. 打出乾坤大挪移
                cmd('PLAY_CARD', '0', { cardId: 'transfer-inst' }),
                // 2. 执行转移（selectStatus 交互存在时）
                cmd('TRANSFER_STATUS', '0', {
                    fromPlayerId: '1',
                    toPlayerId: '0',
                    statusId: TOKEN_IDS.CRIT,
                }),
                // 3. 推进到攻击阶段
                ...advanceTo('offensiveRoll'),
                // 4. 掷骰并选择技能
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'dagger-strike-4' }),
                // 5. 推进阶段 → halt 弹出暴击选择
                cmd('ADVANCE_PHASE', '0'),
                // 6. 使用暴击
                cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
            ],
        });

        const core = result.finalState.core;

        console.log('完整端到端结果:');
        console.log('  圣骑士 CRIT:', core.players['1'].tokens[TOKEN_IDS.CRIT]);
        console.log('  暗影贼 CRIT:', core.players['0'].tokens[TOKEN_IDS.CRIT]);
        console.log('  bonusDamage:', core.pendingAttack?.bonusDamage);
        console.log('  offensiveRollEndTokenResolved:', core.pendingAttack?.offensiveRollEndTokenResolved);

        // 圣骑士暴击已被转移并消耗
        expect(core.players['1'].tokens[TOKEN_IDS.CRIT]).toBe(0);
        // 暗影贼暴击已被使用
        expect(core.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(0);
        // +4 伤害
        expect(core.pendingAttack?.bonusDamage).toBe(4);
        expect(core.pendingAttack?.offensiveRollEndTokenResolved).toBe(true);
    });
});
