/**
 * 破隐一击 (Kidney Shot) 伤害计算 Bug 复现测试
 *
 * Bug 描述：暗影盗贼大顺子触发破隐一击，gainCp(4) 后伤害多了 4 点。
 * 预期：CP=3 → gainCp(4) → CP=7 → damage=7
 * 实际：damage=11（多了 4 点）
 *
 * 调查结论（完整链路验证）：
 * 1. 完整链路测试（卖2牌→遁入阴影→暗影币→大顺子→破隐一击→防御→结算）确认 damage=7，代码正确
 * 2. 暴击 Token 门控条件 expectedDamage < 5 对 kidney-shot 返回 0，暴击 Token 永远不会被提供
 * 3. 用户报告的 damage=11 对应 CP=11 → gainCp(4) 前 CP 就是 7（而非用户以为的 3）
 *    最可能原因：用户在之前的操作中积累了更多 CP（ActionLog 未记录 SELL_CARD，导致 CP 变化不可见）
 * 4. 已补充 SELL_CARD 的 ActionLog 支持，后续用户可以看到完整的 CP 变化历史
 */

import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';
import { INITIAL_CP, INITIAL_HEALTH } from '../domain/types';
import { GameTestRunner } from '../../../engine/testing';
import type { DiceThroneCore } from '../domain/types';
import type { AbilityCard } from '../types';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import { COMMON_CARDS } from '../domain/commonCards';
import {
    createQueuedRandom,
    cmd,
    testSystems,
    assertState,
    createHeroMatchup,
    advanceTo,
} from './test-utils';

describe('破隐一击伤害计算 Bug 复现', () => {
    it('标准场景：伤害应等于 gainCp 后的 CP 值', () => {
        // Shadow Thief 初始 CP=3，大顺子 → kidney-shot
        // gainCp(4) → CP=7 → damage-full-cp → baseDamage=7
        const queuedRandom = createQueuedRandom([
            1, 2, 3, 4, 5,  // 进攻掷骰
            4, 2, 1, 4, 6,  // 防御掷骰
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: createHeroMatchup('shadow_thief', 'pyromancer', (core) => {
                core.players['0'].resources[RESOURCE_IDS.CP] = 3;
                for (const pid of ['0', '1']) {
                    for (const key of Object.keys(core.players[pid].tokens)) {
                        core.players[pid].tokens[key] = 0;
                    }
                }
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '破隐一击标准伤害验证',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'kidney-shot' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: { turnPhase: 'main2' },
        });

        expect(result.assertionErrors).toEqual([]);
        const core = result.finalState.core;
        expect(core.players['0'].resources[RESOURCE_IDS.CP]).toBe(7);
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 7);
    });

    it('暴击 Token 不会被提供给 kidney-shot（CP=0 + gainCp(4) = 4 < 5 门控）', () => {
        // kidney-shot preDefense: gainCp(4)，CP 从 0 变为 4
        // estimateDamage 在 preDefense 后评估：CP=4 < 5 → 暴击 Token 被过滤
        // 因此有暴击 Token 也不会被询问，直接进入防御阶段
        const queuedRandom = createQueuedRandom([
            1, 2, 3, 4, 5,  // 进攻掷骰
            4, 2, 1, 4, 6,  // 防御掷骰
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: createHeroMatchup('shadow_thief', 'pyromancer', (core) => {
                core.players['0'].resources[RESOURCE_IDS.CP] = 0;
                core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
                core.players['0'].tokens[TOKEN_IDS.SNEAK] = 0;
                core.players['0'].tokens[TOKEN_IDS.SNEAK_ATTACK] = 0;
                for (const key of Object.keys(core.players['1'].tokens)) {
                    core.players['1'].tokens[key] = 0;
                }
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '破隐一击 + 暴击 Token（CP 不足，不会被提供）',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'kidney-shot' }),
                cmd('ADVANCE_PHASE', '0'),
                // 暴击 Token 不会被提供（CP=0+4=4 < 5），直接进入防御阶段
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: { turnPhase: 'main2' },
        });

        expect(result.assertionErrors).toEqual([]);
        const core = result.finalState.core;
        // CP=0 + gainCp(4) = 4, damage = 4
        expect(core.players['0'].resources[RESOURCE_IDS.CP]).toBe(4);
        // 暴击 Token 未被消耗（选择从未创建）
        expect(core.players['0'].tokens[TOKEN_IDS.CRIT]).toBe(1);
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 4);
    });

    it('完整链路复现：卖2牌→遁入阴影→暗影币→大顺子→破隐一击→防御→结算', () => {
        // 精确复现用户操作序列：
        // 初始 CP=2, 第一回合先手跳过 income
        // 卖 card-just-this: +1 → CP=3
        // 卖 card-play-six: +1 → CP=4
        // 打 遁入阴影 (cpCost=4): -4 → CP=0, 获得 Sneak x1
        // 打 暗影币 (cpCost=0, 有 Sneak → +3): CP=3
        // offensiveRoll → 大顺子 [1,2,3,4,5] → kidney-shot
        // preDefense: gainCp(4) → CP=7
        // defensiveRoll → 防御掷骰
        // withDamage: damage-full-cp → baseDamage=CP=7
        // 预期伤害: 7

        // 从暗影盗贼卡牌中找到需要的卡
        const findCard = (id: string): AbilityCard => {
            const card = SHADOW_THIEF_CARDS.find(c => c.id === id)
                ?? COMMON_CARDS.find(c => c.id === id);
            if (!card) throw new Error(`找不到卡牌: ${id}`);
            return { ...card };
        };

        const queuedRandom = createQueuedRandom([
            1, 2, 3, 4, 5,  // 进攻掷骰：大顺子
            4, 2, 1, 4, 6,  // 防御掷骰
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: createHeroMatchup('shadow_thief', 'pyromancer', (core) => {
                // createHeroMatchup 已将手牌移到牌库
                // 给暗影盗贼放入用户实际使用的 4 张手牌
                core.players['0'].hand = [
                    findCard('card-just-this'),
                    findCard('card-play-six'),
                    findCard('action-into-the-shadows'),
                    findCard('action-shadow-coins'),
                ];
                // 初始 CP=2（INITIAL_CP），第一回合先手跳过 income
                core.players['0'].resources[RESOURCE_IDS.CP] = INITIAL_CP;
                // 清除所有 Token 避免干扰
                for (const pid of ['0', '1']) {
                    for (const key of Object.keys(core.players[pid].tokens)) {
                        core.players[pid].tokens[key] = 0;
                    }
                }
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '完整链路：卖牌→出牌→大顺子→破隐一击',
            commands: [
                // main1 阶段：卖牌 + 出牌
                cmd('SELL_CARD', '0', { cardId: 'card-just-this' }),     // CP: 2→3
                cmd('SELL_CARD', '0', { cardId: 'card-play-six' }),      // CP: 3→4
                cmd('PLAY_CARD', '0', { cardId: 'action-into-the-shadows' }), // CP: 4→0, Sneak+1
                cmd('PLAY_CARD', '0', { cardId: 'action-shadow-coins' }),     // CP: 0→3 (有Sneak+3)
                // 推进到 offensiveRoll
                cmd('ADVANCE_PHASE', '0'),
                // 掷骰
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                // 选择破隐一击
                cmd('SELECT_ABILITY', '0', { abilityId: 'kidney-shot' }),
                // 推进到防御阶段（preDefense: gainCp(4) → CP=7）
                cmd('ADVANCE_PHASE', '0'),
                // 防御掷骰
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                // 推进结算
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: { turnPhase: 'main2' },
        });

        expect(result.assertionErrors).toEqual([]);
        const core = result.finalState.core;

        // CP 验证：初始2 + 卖2张(+2) - 遁入阴影(-4) + 暗影币(+3) + gainCp(+4) = 7
        expect(core.players['0'].resources[RESOURCE_IDS.CP]).toBe(7);

        // 伤害验证：damage-full-cp 读取 CP=7 → baseDamage=7
        // 如果这里是 INITIAL_HEALTH - 11，说明代码确实有 bug
        // 如果是 INITIAL_HEALTH - 7，说明代码正确，用户的 CP 在攻击前不是 3
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 7);

        // Sneak Token 验证：遁入阴影获得 1 个
        expect(core.players['0'].tokens[TOKEN_IDS.SNEAK]).toBe(1);
    });

    it('高 CP 场景：CP=7 + gainCp(4) = 11 → damage=11（非 bug）', () => {
        // 复现用户报告的 damage=11 场景
        // 如果攻击前 CP 就是 7（而非用户以为的 3），gainCp(4) 后 CP=11，damage=11
        // 这不是 bug，是用户误判了攻击前的 CP 值
        const queuedRandom = createQueuedRandom([
            1, 2, 3, 4, 5,  // 进攻掷骰
            4, 2, 1, 4, 6,  // 防御掷骰
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: createHeroMatchup('shadow_thief', 'pyromancer', (core) => {
                core.players['0'].resources[RESOURCE_IDS.CP] = 7; // 攻击前 CP=7
                for (const pid of ['0', '1']) {
                    for (const key of Object.keys(core.players[pid].tokens)) {
                        core.players[pid].tokens[key] = 0;
                    }
                }
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '高 CP 场景验证 damage=CP',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'kidney-shot' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: { turnPhase: 'main2' },
        });

        expect(result.assertionErrors).toEqual([]);
        const core = result.finalState.core;
        // CP=7 + gainCp(4) = 11
        expect(core.players['0'].resources[RESOURCE_IDS.CP]).toBe(11);
        // damage = CP = 11
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 11);
    });
});
