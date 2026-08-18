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

describe('攻击技能选择确认边界', () => {
    it('进攻阶段选中攻击但未推进前，仍可改选其它当前可用技能', () => {
        // 使用队列随机数确保掷出 5 个拳头（触发 fist-technique-5）
        // 骰子面值 1 = 拳头面
        const diceValues = [1, 1, 1, 1, 1]; // 5 个拳头面
        const random = createQueuedRandom(diceValues);
        const runner = createRunner(random);

        // 1. 进入进攻掷骰阶段并选择技能
        const result = runner.run({
            name: '进攻阶段先选择一个攻击候选',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),      // 掷骰
                cmd('CONFIRM_ROLL', '0'),   // 确认掷骰
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }), // 选择拳法技能
            ],
        });

        // 验证：攻击候选已记录，但仍停留在进攻阶段，尚未推进到防御/结算。
        expect(result.finalState.core.pendingAttack).toBeDefined();
        expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('fist-technique-5');
        expect(result.finalState.sys.phase).toBe('offensiveRoll');

        // 2. 未推进前改选同一骰面下另一个可用技能。
        const runner2 = createRunner(random);
        const reselect = runner2.run({
            name: '未推进前改选攻击候选',
            setup: () => result.finalState,
            commands: [
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-4' }),
            ],
        });

        expect(reselect.actualErrors).toHaveLength(0);
        expect(reselect.finalState.sys.phase).toBe('offensiveRoll');
        expect(reselect.finalState.core.pendingAttack?.sourceAbilityId).toBe('fist-technique-4');

        // 3. 真正推进到防御阶段后，攻击方不能再用进攻 SELECT_ABILITY 换技能。
        const advanced = createRunner(random).run({
            name: '推进到防御后不能改选攻击',
            setup: () => reselect.finalState,
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
            ],
        });

        expect(advanced.finalState.sys.phase).toBe('defensiveRoll');
        expect(advanced.actualErrors).toHaveLength(1);
        expect(advanced.actualErrors[0].error).toBe('player_mismatch');
        expect(advanced.finalState.core.pendingAttack?.sourceAbilityId).toBe('fist-technique-4');
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

    it('制胜高地确认骰后开放改骰响应，选中攻击候选不应重新打开窗口', () => {
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

        for (const command of [
            cmd('ADVANCE_PHASE', '0'),
            cmd('ROLL_DICE', '0'),
            cmd('CONFIRM_ROLL', '0'),
        ]) {
            const result = run(state, command);
            expect(result.success, `${command.type} 必须成功：${result.error ?? ''}`).toBe(true);
            state = result.state;
        }

        expect(state.core.dice.map((die) => die.value)).toEqual([6, 6, 6, 6, 6]);
        expect(state.core.dice.every((die) => die.symbol === ZHANSHUJIA_DICE_FACE_IDS.MEDAL)).toBe(true);
        expect(getAvailableAbilityIds(state.core, '0', 'offensiveRoll')).toContain('high-ground');
        expect(state.sys.responseWindow.current).toMatchObject({
            windowType: 'afterRollConfirmed',
            responderQueue: ['1'],
        });

        const passed = run(state, cmd('RESPONSE_PASS', '1'));
        expect(passed.success, passed.error ?? '').toBe(true);
        expect(passed.state.sys.responseWindow.current).toBeUndefined();

        const selected = run(passed.state, cmd('SELECT_ABILITY', '0', { abilityId: 'high-ground' }));
        expect(selected.success, selected.error ?? '').toBe(true);
        expect(selected.state.core.pendingAttack).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'high-ground',
            isUltimate: true,
        });
        expect(selected.state.sys.responseWindow.current).toBeUndefined();
        expect(selected.state.core.rollConfirmed).toBe(true);
    });
});
