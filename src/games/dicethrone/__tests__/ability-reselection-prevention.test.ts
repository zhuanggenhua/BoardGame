/**
 * DiceThrone 技能重选防护测试
 *
 * 测试目标：验证"攻击发起后不能重新选择技能"的规则（官方规则 §3.6）
 *
 * 背景：此验证逻辑曾在 POD 提交中被误删，导致玩家可以在攻击发起后重新选择技能。
 * 此测试确保该验证逻辑正常工作，并防止未来回归。
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { getAvailableAbilityIds } from '../domain/rules';
import { RESOURCE_IDS } from '../domain/resources';
import {
    testSystems,
    fixedRandom,
    createNoResponseSetup,
    createHeroMatchup,
    assertState,
    cmd,
    createQueuedRandom,
    getCardById,
} from './test-utils';
import { ZHANSHUJIA_DICE_FACE_IDS } from '../domain/ids';

const createRunner = (random = fixedRandom) =>
    new GameTestRunner({
        domain: DiceThroneDomain,
        systems: testSystems,
        playerIds: ['0', '1'],
        random,
        setup: createNoResponseSetup(),
        assertFn: assertState,
        silent: true,
    });

describe('技能重选防护（attack_already_initiated）', () => {
    it('攻击发起后不能重新选择技能', () => {
        // 使用队列随机数确保掷出 5 个拳头（触发 fist-technique-5）
        // 骰子面值 1 = 拳头面
        const diceValues = [1, 1, 1, 1, 1]; // 5 个拳头面
        const random = createQueuedRandom(diceValues);
        const runner = createRunner(random);

        // 1. 进入进攻掷骰阶段并选择技能
        const result = runner.run({
            name: '攻击发起后不能重新选择技能',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),      // 掷骰
                cmd('CONFIRM_ROLL', '0'),   // 确认掷骰
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }), // 选择拳法技能
            ],
        });

        // 验证：攻击已发起
        expect(result.finalState.core.pendingAttack).toBeDefined();
        expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('fist-technique-5');

        // 2. 尝试重新选择技能（应该被拒绝）
        const runner2 = createRunner(random);
        const reselect = runner2.run({
            name: '尝试重新选择技能',
            setup: () => result.finalState,
            commands: [
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }), // 尝试重新选择
            ],
        });

        // 验证：应该被拒绝，错误码为 attack_already_initiated
        expect(reselect.actualErrors).toHaveLength(1);
        expect(reselect.actualErrors[0].error).toBe('attack_already_initiated');
        // 验证：攻击未改变（仍然是原来的技能）
        expect(reselect.finalState.core.pendingAttack?.sourceAbilityId).toBe('fist-technique-5');
    });

    it('冲拳必须从当前骰面解析到具体变体，父技能不能进入 0 伤害攻击链', () => {
        const playerIds = ['0', '1'];
        const random = createQueuedRandom([1, 1, 1, 1, 5, 1, 1, 1]);
        const run = (state: ReturnType<ReturnType<typeof createHeroMatchup>>, command: ReturnType<typeof cmd>) => (
            executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                { ...command, timestamp: Date.now() } as any,
                random,
                playerIds,
            )
        );

        let state = createHeroMatchup('monk', 'barbarian')(playerIds, random);
        for (const command of [
            cmd('ADVANCE_PHASE', '0'),
            cmd('ROLL_DICE', '0'),
            cmd('CONFIRM_ROLL', '0'),
        ]) {
            const result = run(state, command);
            expect(result.success, `${command.type} 必须成功：${result.error ?? ''}`).toBe(true);
            state = result.state;
        }

        const availableAbilityIds = getAvailableAbilityIds(state.core, '0', 'offensiveRoll');
        expect(availableAbilityIds).toContain('fist-technique-4');
        expect(availableAbilityIds).not.toContain('fist-technique');

        const parentSelect = run(state, cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique' }));
        expect(parentSelect.success).toBe(false);
        expect(parentSelect.error).toBe('ability_not_available');
        expect(parentSelect.state.core.pendingAttack).toBeNull();

        const selected = run(state, cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-4' }));
        expect(selected.success, selected.error ?? '').toBe(true);
        expect(selected.state.core.pendingAttack?.sourceAbilityId).toBe('fist-technique-4');

        state = selected.state;
        for (const command of [
            cmd('ADVANCE_PHASE', '0'),
            cmd('ROLL_DICE', '1'),
            cmd('CONFIRM_ROLL', '1'),
            cmd('ADVANCE_PHASE', '1'),
        ]) {
            const result = run(state, command);
            expect(result.success, `${command.type} 必须成功：${result.error ?? ''}`).toBe(true);
            state = result.state;
        }

        expect(state.sys.phase).toBe('main2');
        expect(state.core.pendingAttack).toBeNull();
        expect(state.core.lastResolvedAttackDamage).toBeGreaterThan(0);
        expect(state.core.players['1'].resources[RESOURCE_IDS.HP]).toBeLessThan(50);
    });

    it('制胜高地选中后必须先保留攻击并开放发动前改骰响应窗口', () => {
        const playerIds = ['0', '1'];
        const random = createQueuedRandom([6, 6, 6, 6, 6]);
        const run = (state: ReturnType<ReturnType<typeof createHeroMatchup>>, command: ReturnType<typeof cmd>) => (
            executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                { ...command, timestamp: Date.now() } as any,
                random,
                playerIds,
            )
        );

        let state = createHeroMatchup('zhanshujia', 'cursed_pirate')(playerIds, random);
        for (const command of [
            cmd('ADVANCE_PHASE', '0'),
            cmd('ROLL_DICE', '0'),
            cmd('CONFIRM_ROLL', '0'),
        ]) {
            const result = run(state, command);
            expect(result.success, `${command.type} 必须成功：${result.error ?? ''}`).toBe(true);
            state = result.state;
        }

        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '1': {
                        ...state.core.players['1'],
                        hand: [getCardById('card-surprise')],
                        resources: {
                            ...state.core.players['1'].resources,
                            [RESOURCE_IDS.CP]: 10,
                        },
                    },
                },
            },
        };

        expect(state.core.dice.map((die) => die.value)).toEqual([6, 6, 6, 6, 6]);
        expect(state.core.dice.every((die) => die.symbol === ZHANSHUJIA_DICE_FACE_IDS.MEDAL)).toBe(true);
        expect(getAvailableAbilityIds(state.core, '0', 'offensiveRoll')).toContain('high-ground');

        const selected = run(state, cmd('SELECT_ABILITY', '0', { abilityId: 'high-ground' }));
        expect(selected.success, selected.error ?? '').toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'high-ground',
            isUltimate: true,
        });
        expect(selected.state.sys.responseWindow.current).toMatchObject({
            windowType: 'afterRollConfirmed',
            responderQueue: ['1'],
        });
        expect(selected.state.core.rollConfirmed).toBe(true);
    });
});
