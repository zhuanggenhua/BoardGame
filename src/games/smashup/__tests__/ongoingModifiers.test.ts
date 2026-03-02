/**
 * 大杀四方 - 持续力量修正系统测试
 *
 * 覆盖：
 * - 基础设施（getEffectivePower / getPlayerEffectivePowerOnBase / getTotalEffectivePowerOnBase）
 * - 恐龙：dino_armor_stego（重装剑龙 +2 非己方回合）
 * - 恐龙：dino_war_raptor（战争猛禽 同基地猛禽数 +1）
 * - 机器人：robot_microbot_alpha（微型机阿尔法号 +其他己方随从数）
 * - 机器人：robot_microbot_fixer（微型机修理者 己方随从 +1）
 * - 幽灵：ghost_haunting（不散阴魂 手牌≤2 时 +3）
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import {
    getEffectivePower,
    getPlayerEffectivePowerOnBase,
    getTotalEffectivePowerOnBase,
    clearPowerModifierRegistry,
} from '../domain/ongoingModifiers';
import { makeMinion, makeCard, makePlayer, makeState } from './helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================





// ============================================================================
// 基础设施
// ============================================================================

describe('持续力量修正基础设施', () => {
    it('无修正时 getEffectivePower 等于 basePower + powerModifier', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        minion.powerModifier = 2;
        const state = makeState({
            bases: [{ defId: 'base_a', minions: [minion], ongoingActions: [] }],
        });
        expect(getEffectivePower(state, minion, 0)).toBe(5); // 3 + 2
    });

    it('getPlayerEffectivePowerOnBase 正确累加', () => {
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 });
        const m2 = makeMinion('m2', 'test_b', '0', 3, { powerModifier: 0 });
        const m3 = makeMinion('m3', 'test_c', '1', 5, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [m1, m2, m3], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getPlayerEffectivePowerOnBase(state, base, 0, '0')).toBe(5); // 2 + 3
        expect(getPlayerEffectivePowerOnBase(state, base, 0, '1')).toBe(5);
    });

    it('getTotalEffectivePowerOnBase 正确累加所有随从', () => {
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 });
        const m2 = makeMinion('m2', 'test_b', '1', 3, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [m1, m2], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getTotalEffectivePowerOnBase(state, base, 0)).toBe(5);
    });
});

// ============================================================================
// 恐龙：重装剑龙
// ============================================================================

describe('dino_armor_stego（重装剑龙 ongoing）', () => {
    it('非己方回合时 +2 力量', () => {
        const stego = makeMinion('stego', 'dino_armor_stego', '1', 3, { powerModifier: 0 });
        const state = makeState({
            currentPlayerIndex: 0, // 玩家0的回合
            bases: [{ defId: 'base_a', minions: [stego], ongoingActions: [] }],
        });
        // 剑龙属于玩家1，当前是玩家0的回合 → +2
        expect(getEffectivePower(state, stego, 0)).toBe(5); // 3 + 2
    });

    it('己方回合时无修正', () => {
        const stego = makeMinion('stego', 'dino_armor_stego', '0', 3, { powerModifier: 0 });
        const state = makeState({
            currentPlayerIndex: 0, // 玩家0的回合
            bases: [{ defId: 'base_a', minions: [stego], ongoingActions: [] }],
        });
        // 剑龙属于玩家0，当前也是玩家0的回合 → 无修正
        expect(getEffectivePower(state, stego, 0)).toBe(3);
    });

    it('多个剑龙各自独立计算', () => {
        const stego0 = makeMinion('s0', 'dino_armor_stego', '0', 3, { powerModifier: 0 });
        const stego1 = makeMinion('s1', 'dino_armor_stego', '1', 3, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [stego0, stego1], ongoingActions: [] };
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [base],
        });
        // 玩家0的回合：stego0 无修正，stego1 +2
        expect(getEffectivePower(state, stego0, 0)).toBe(3);
        expect(getEffectivePower(state, stego1, 0)).toBe(5);
    });

    it('不影响其他随从', () => {
        const stego = makeMinion('stego', 'dino_armor_stego', '1', 3, { powerModifier: 0 });
        const other = makeMinion('other', 'test_minion', '1', 2, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [stego, other], ongoingActions: [] };
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [base],
        });
        // other 不是剑龙，不受剑龙修正影响
        expect(getEffectivePower(state, other, 0)).toBe(2);
    });
});

// ============================================================================
// 恐龙：战争猛禽
// ============================================================================

describe('dino_war_raptor（战争猛禽 ongoing）', () => {
    it('单个猛禽 +1（含自身）', () => {
        const raptor = makeMinion('r1', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [raptor], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, raptor, 0)).toBe(3); // 2 + 1
    });

    it('两个猛禽各 +2', () => {
        const r1 = makeMinion('r1', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const r2 = makeMinion('r2', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [r1, r2], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, r1, 0)).toBe(4); // 2 + 2
        expect(getEffectivePower(state, r2, 0)).toBe(4);
    });

    it('三个猛禽各 +3', () => {
        const r1 = makeMinion('r1', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const r2 = makeMinion('r2', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const r3 = makeMinion('r3', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [r1, r2, r3], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, r1, 0)).toBe(5); // 2 + 3
    });

    it('不同基地的猛禽不互相加成', () => {
        const r1 = makeMinion('r1', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const r2 = makeMinion('r2', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const base0 = { defId: 'base_a', minions: [r1], ongoingActions: [] };
        const base1 = { defId: 'base_b', minions: [r2], ongoingActions: [] };
        const state = makeState({ bases: [base0, base1] });
        expect(getEffectivePower(state, r1, 0)).toBe(3); // 2 + 1（只有自己）
        expect(getEffectivePower(state, r2, 1)).toBe(3);
    });

    it('不同控制者的猛禽不互相加成', () => {
        const r0 = makeMinion('r0', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const r1 = makeMinion('r1', 'dino_war_raptor', '1', 2, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [r0, r1], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, r0, 0)).toBe(3); // 2 + 1（只有自己）
        expect(getEffectivePower(state, r1, 0)).toBe(3);
    });

    it('不影响非猛禽随从', () => {
        const raptor = makeMinion('r1', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const other = makeMinion('other', 'test_minion', '0', 3, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [raptor, other], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, other, 0)).toBe(3); // 不受猛禽影响
    });
});

// ============================================================================
// 机器人：微型机阿尔法号
// ============================================================================

describe('robot_microbot_alpha（微型机阿尔法号 ongoing）', () => {
    it('场上无其他己方随从时无修正', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [alpha], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, alpha, 0)).toBe(1);
    });

    it('同基地有2个其他己方随从时 +2', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 });
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 });
        const m2 = makeMinion('m2', 'test_b', '0', 3, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [alpha, m1, m2], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, alpha, 0)).toBe(3); // 1 + 2
    });

    it('跨基地计算所有己方随从', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 });
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 });
        const m2 = makeMinion('m2', 'test_b', '0', 3, { powerModifier: 0 });
        const base0 = { defId: 'base_a', minions: [alpha, m1], ongoingActions: [] };
        const base1 = { defId: 'base_b', minions: [m2], ongoingActions: [] };
        const state = makeState({ bases: [base0, base1] });
        expect(getEffectivePower(state, alpha, 0)).toBe(3); // 1 + 2（m1 + m2）
    });

    it('不计算对手随从', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 });
        const enemy = makeMinion('e1', 'test_enemy', '1', 5, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [alpha, enemy], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, alpha, 0)).toBe(1); // 对手随从不计
    });

    it('不影响其他随从', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 });
        const other = makeMinion('other', 'test_minion', '0', 2, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [alpha, other], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, other, 0)).toBe(2); // 阿尔法号只加自身
    });
});

// ============================================================================
// 机器人：微型机修理者
// ============================================================================

describe('robot_microbot_fixer（微型机修理者 ongoing）', () => {
    it('修理者在场时己方微型机 +1（非微型机不受益）', () => {
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1, { powerModifier: 0 });
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 }); // 非微型机
        const guard = makeMinion('guard', 'robot_microbot_guard', '0', 1, { powerModifier: 0 }); // 微型机
        const base = { defId: 'base_a', minions: [fixer, m1, guard], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, fixer, 0)).toBe(2); // 1 + 1（修理者自身是微型机，受益）
        expect(getEffectivePower(state, guard, 0)).toBe(2); // 1 + 1（微型机受益）
        expect(getEffectivePower(state, m1, 0)).toBe(2); // 非微型机不受益
    });

    it('两个修理者叠加 +2（仅微型机受益）', () => {
        const f1 = makeMinion('f1', 'robot_microbot_fixer', '0', 1, { powerModifier: 0 });
        const f2 = makeMinion('f2', 'robot_microbot_fixer', '0', 1, { powerModifier: 0 });
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 }); // 非微型机
        const base = { defId: 'base_a', minions: [f1, f2, m1], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, m1, 0)).toBe(2); // 非微型机不受益
        expect(getEffectivePower(state, f1, 0)).toBe(3); // 1 + 2（两个修理者各 +1）
    });

    it('不影响对手随从', () => {
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1, { powerModifier: 0 });
        const enemy = makeMinion('e1', 'test_enemy', '1', 3, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [fixer, enemy], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, enemy, 0)).toBe(3); // 不受修理者影响
    });

    it('跨基地生效（仅微型机受益）', () => {
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1, { powerModifier: 0 });
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 }); // 非微型机
        const guard = makeMinion('guard', 'robot_microbot_guard', '0', 1, { powerModifier: 0 }); // 微型机
        const base0 = { defId: 'base_a', minions: [fixer], ongoingActions: [] };
        const base1 = { defId: 'base_b', minions: [m1, guard], ongoingActions: [] };
        const state = makeState({ bases: [base0, base1] });
        expect(getEffectivePower(state, m1, 1)).toBe(2); // 非微型机不受益
        expect(getEffectivePower(state, guard, 1)).toBe(2); // 1 + 1（微型机跨基地受益）
    });

    it('alpha 在场时所有己方随从视为微型机均受益', () => {
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1, { powerModifier: 0 });
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 });
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 }); // alpha 在场时视为微型机
        const base = { defId: 'base_a', minions: [fixer, alpha, m1], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, m1, 0)).toBe(3); // 2 + 1（alpha 在场，视为微型机）
    });

    it('无修理者时无修正', () => {
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [m1], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, m1, 0)).toBe(2);
    });
});

// ============================================================================
// 幽灵：不散阴魂
// ============================================================================

describe('ghost_haunting（不散阴魂 ongoing）', () => {
    it('手牌≤2时 +3 力量', () => {
        const haunting = makeMinion('h1', 'ghost_haunting', '0', 3, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [haunting], ongoingActions: [] };
        const state = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('c1', 'test', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [base],
        });
        expect(getEffectivePower(state, haunting, 0)).toBe(6); // 3 + 3
    });

    it('手牌为空时 +3 力量', () => {
        const haunting = makeMinion('h1', 'ghost_haunting', '0', 3, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [haunting], ongoingActions: [] };
        const state = makeState({
            players: {
                '0': makePlayer('0', { hand: [] }),
                '1': makePlayer('1'),
            },
            bases: [base],
        });
        expect(getEffectivePower(state, haunting, 0)).toBe(6);
    });

    it('手牌恰好2张时 +3 力量', () => {
        const haunting = makeMinion('h1', 'ghost_haunting', '0', 3, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [haunting], ongoingActions: [] };
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('c1', 'test', 'minion', '0'),
                        makeCard('c2', 'test', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [base],
        });
        expect(getEffectivePower(state, haunting, 0)).toBe(6);
    });

    it('手牌>2时无修正', () => {
        const haunting = makeMinion('h1', 'ghost_haunting', '0', 3, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [haunting], ongoingActions: [] };
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('c1', 'test', 'minion', '0'),
                        makeCard('c2', 'test', 'minion', '0'),
                        makeCard('c3', 'test', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [base],
        });
        expect(getEffectivePower(state, haunting, 0)).toBe(3);
    });

    it('不影响其他随从', () => {
        const haunting = makeMinion('h1', 'ghost_haunting', '0', 3, { powerModifier: 0 });
        const other = makeMinion('other', 'test_minion', '0', 2, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [haunting, other], ongoingActions: [] };
        const state = makeState({
            players: {
                '0': makePlayer('0', { hand: [] }),
                '1': makePlayer('1'),
            },
            bases: [base],
        });
        expect(getEffectivePower(state, other, 0)).toBe(2);
    });
});

// ============================================================================
// 组合场景
// ============================================================================

describe('多个持续修正组合', () => {
    it('猛禽 + 修理者叠加', () => {
        // 猛禽属于玩家0，修理者也属于玩家0
        const raptor = makeMinion('r1', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [raptor, fixer], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        // 猛禽不是微型机，不受修理者加成
        // 猛禽：basePower=2 + 猛禽修正=1（只有自己） = 3
        expect(getEffectivePower(state, raptor, 0)).toBe(3);
        // 修理者：basePower=1 + 修理者修正=1（自身是微型机） = 2
        expect(getEffectivePower(state, fixer, 0)).toBe(2);
    });

    it('阿尔法号 + 修理者叠加', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 });
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1, { powerModifier: 0 });
        const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [alpha, fixer, m1], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        // 阿尔法号：basePower=1 + 阿尔法修正=2（fixer+m1） + 修理者修正=1 = 4
        expect(getEffectivePower(state, alpha, 0)).toBe(4);
        // m1：basePower=2 + 修理者修正=1 = 3
        expect(getEffectivePower(state, m1, 0)).toBe(3);
    });

    it('getPlayerEffectivePowerOnBase 含持续修正', () => {
        const r1 = makeMinion('r1', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const r2 = makeMinion('r2', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const enemy = makeMinion('e1', 'test_enemy', '1', 5, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [r1, r2, enemy], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        // 玩家0：r1=2+2=4, r2=2+2=4 → 总计 8
        expect(getPlayerEffectivePowerOnBase(state, base, 0, '0')).toBe(8);
        // 玩家1：enemy=5
        expect(getPlayerEffectivePowerOnBase(state, base, 0, '1')).toBe(5);
    });

    it('getTotalEffectivePowerOnBase 含持续修正', () => {
        const r1 = makeMinion('r1', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const r2 = makeMinion('r2', 'dino_war_raptor', '0', 2, { powerModifier: 0 });
        const enemy = makeMinion('e1', 'test_enemy', '1', 5, { powerModifier: 0 });
        const base = { defId: 'base_a', minions: [r1, r2, enemy], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        // r1=4, r2=4, enemy=5 → 总计 13
        expect(getTotalEffectivePowerOnBase(state, base, 0)).toBe(13);
    });
});

// ============================================================================
// registerOngoingPowerModifier 声明式 API 通用测试
// ============================================================================

describe('registerOngoingPowerModifier 通用叠加', () => {
    // 辅助：创建基地 ongoing 行动卡
    function makeOngoing(defId: string, ownerId: string, uid?: string) {
        return { uid: uid ?? `ongoing_${defId}_${ownerId}`, defId, ownerId };
    }

    // --- opponentMinions：睡眠孢子 ---
    describe('opponentMinions（睡眠孢子 killer_plant_sleep_spores）', () => {
        it('单张对对手随从 -1', () => {
            const m1 = makeMinion('m1', 'test_a', '1', 5, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m1],
                ongoingActions: [makeOngoing('killer_plant_sleep_spores', '0')],
            };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m1, 0)).toBe(4); // 5 - 1
        });

        it('两张叠加对对手随从 -2', () => {
            const m1 = makeMinion('m1', 'test_a', '1', 5, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m1],
                ongoingActions: [
                    makeOngoing('killer_plant_sleep_spores', '0', 'sp1'),
                    makeOngoing('killer_plant_sleep_spores', '0', 'sp2'),
                ],
            };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m1, 0)).toBe(3); // 5 - 2
        });

        it('不影响 owner 自己的随从', () => {
            const own = makeMinion('own', 'test_a', '0', 5, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [own],
                ongoingActions: [makeOngoing('killer_plant_sleep_spores', '0')],
            };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, own, 0)).toBe(5);
        });

        it('力量最低为 0', () => {
            const m1 = makeMinion('m1', 'test_a', '1', 1, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m1],
                ongoingActions: [
                    makeOngoing('killer_plant_sleep_spores', '0', 'sp1'),
                    makeOngoing('killer_plant_sleep_spores', '0', 'sp2'),
                    makeOngoing('killer_plant_sleep_spores', '0', 'sp3'),
                ],
            };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m1, 0)).toBe(0); // max(0, 1-3)
        });
    });

    // --- ownerMinions：旋转弹头发射器 ---
    describe('ownerMinions（旋转弹头发射器 steampunk_rotary_slug_thrower）', () => {
        it('单张给己方随从 +2', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 3, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m1],
                ongoingActions: [makeOngoing('steampunk_rotary_slug_thrower', '0')],
            };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m1, 0)).toBe(5); // 3 + 2
        });

        it('两张叠加给己方随从 +4', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 3, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m1],
                ongoingActions: [
                    makeOngoing('steampunk_rotary_slug_thrower', '0', 'rst1'),
                    makeOngoing('steampunk_rotary_slug_thrower', '0', 'rst2'),
                ],
            };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m1, 0)).toBe(7); // 3 + 4
        });

        it('不影响对手随从', () => {
            const enemy = makeMinion('e1', 'test_a', '1', 3, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [enemy],
                ongoingActions: [makeOngoing('steampunk_rotary_slug_thrower', '0')],
            };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, enemy, 0)).toBe(3);
        });
    });

    // --- 基地级别力量修正：蒸汽机车 ---
    describe('基地级别力量修正（蒸汽机车 steampunk_aggromotive）', () => {
        it('给 owner 在基地的总力量 +5（不是给单个随从）', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 });
            const m2 = makeMinion('m2', 'test_b', '0', 3, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m1, m2],
                ongoingActions: [makeOngoing('steampunk_aggromotive', '0')],
            };
            const state = makeState({ bases: [base] });
            // 随从本身的力量不变
            expect(getEffectivePower(state, m1, 0)).toBe(2);
            expect(getEffectivePower(state, m2, 0)).toBe(3);
            // 但玩家在基地的总力量 = 2 + 3 + 5 = 10
            expect(getPlayerEffectivePowerOnBase(state, base, 0, '0')).toBe(10);
        });

        it('两张叠加给 owner 总力量 +10', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 2, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m1],
                ongoingActions: [
                    makeOngoing('steampunk_aggromotive', '0', 'ag1'),
                    makeOngoing('steampunk_aggromotive', '0', 'ag2'),
                ],
            };
            const state = makeState({ bases: [base] });
            // 随从本身的力量不变
            expect(getEffectivePower(state, m1, 0)).toBe(2);
            // 但玩家在基地的总力量 = 2 + 10 = 12
            expect(getPlayerEffectivePowerOnBase(state, base, 0, '0')).toBe(12);
        });

        it('owner 无随从时不生效', () => {
            const enemy = makeMinion('e1', 'test_a', '1', 3, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [enemy],
                ongoingActions: [makeOngoing('steampunk_aggromotive', '0')],
            };
            const state = makeState({ bases: [base] });
            // 对手随从不受影响
            expect(getEffectivePower(state, enemy, 0)).toBe(3);
            // 玩家 0 没有随从，所以蒸汽机车不生效
            expect(getPlayerEffectivePowerOnBase(state, base, 0, '0')).toBe(0);
        });
    });

    // --- self (minion-attached)：升级 / 毒药 / 邓威奇恐怖 ---
    describe('self minion-attached（升级 / 毒药 / 邓威奇恐怖）', () => {
        it('升级：附着 1 张 +2', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 3, {
                attachedActions: [{ uid: 'u1', defId: 'dino_upgrade', ownerId: '0' }],
            });
            const base = { defId: 'base_a', minions: [m1], ongoingActions: [] };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m1, 0)).toBe(5); // 3 + 2
        });

        it('升级：附着 2 张叠加 +4', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 3, {
                attachedActions: [
                    { uid: 'u1', defId: 'dino_upgrade', ownerId: '0' },
                    { uid: 'u2', defId: 'dino_upgrade', ownerId: '0' },
                ],
            });
            const base = { defId: 'base_a', minions: [m1], ongoingActions: [] };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m1, 0)).toBe(7); // 3 + 4
        });

        it('毒药：附着 1 张 -4', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 5, {
                attachedActions: [{ uid: 'p1', defId: 'ninja_poison', ownerId: '1' }],
            });
            const base = { defId: 'base_a', minions: [m1], ongoingActions: [] };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m1, 0)).toBe(1); // 5 - 4
        });

        it('邓威奇恐怖：附着 1 张 +5', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 3, {
                attachedActions: [{ uid: 'dh1', defId: 'elder_thing_dunwich_horror', ownerId: '0' }],
            });
            const base = { defId: 'base_a', minions: [m1], ongoingActions: [] };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m1, 0)).toBe(8); // 3 + 5
        });

        it('不影响未附着的其他随从', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 3, {
                attachedActions: [{ uid: 'u1', defId: 'dino_upgrade', ownerId: '0' }],
            });
            const m2 = makeMinion('m2', 'test_b', '0', 4, { powerModifier: 0 });
            const base = { defId: 'base_a', minions: [m1, m2], ongoingActions: [] };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m2, 0)).toBe(4);
        });
    });

    // --- condition 参数：通灵之门 ---
    describe('condition 参数（通灵之门 ghost_door_to_the_beyond）', () => {
        it('手牌≤2 时己方随从 +2', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 3, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m1],
                ongoingActions: [makeOngoing('ghost_door_to_the_beyond', '0')],
            };
            const state = makeState({
                players: {
                    '0': makePlayer('0', { hand: [makeCard('c1', 'test', 'minion', '0')] }),
                    '1': makePlayer('1'),
                },
                bases: [base],
            });
            expect(getEffectivePower(state, m1, 0)).toBe(5); // 3 + 2
        });

        it('手牌>2 时不生效', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 3, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m1],
                ongoingActions: [makeOngoing('ghost_door_to_the_beyond', '0')],
            };
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'test', 'minion', '0'),
                            makeCard('c2', 'test', 'minion', '0'),
                            makeCard('c3', 'test', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [base],
            });
            expect(getEffectivePower(state, m1, 0)).toBe(3);
        });

        it('条件满足时两张叠加 +4', () => {
            const m1 = makeMinion('m1', 'test_a', '0', 3, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m1],
                ongoingActions: [
                    makeOngoing('ghost_door_to_the_beyond', '0', 'gd1'),
                    makeOngoing('ghost_door_to_the_beyond', '0', 'gd2'),
                ],
            };
            const state = makeState({
                players: {
                    '0': makePlayer('0', { hand: [] }),
                    '1': makePlayer('1'),
                },
                bases: [base],
            });
            expect(getEffectivePower(state, m1, 0)).toBe(7); // 3 + 4
        });
    });

    // --- 混合场景：多种 ongoing 在同一基地 ---
    describe('多种 ongoing 在同一基地组合', () => {
        it('睡眠孢子 + 旋转弹头发射器同时生效', () => {
            const own = makeMinion('own', 'test_a', '0', 4, { powerModifier: 0 });
            const enemy = makeMinion('enemy', 'test_b', '1', 6, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [own, enemy],
                ongoingActions: [
                    makeOngoing('killer_plant_sleep_spores', '0'),
                    makeOngoing('steampunk_rotary_slug_thrower', '0'),
                ],
            };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, own, 0)).toBe(6);   // 4 + 2（弹头）
            expect(getEffectivePower(state, enemy, 0)).toBe(5); // 6 - 1（孢子）
        });

        it('双方各打一张睡眠孢子互相减力', () => {
            const m0 = makeMinion('m0', 'test_a', '0', 5, { powerModifier: 0 });
            const m1 = makeMinion('m1', 'test_b', '1', 5, { powerModifier: 0 });
            const base = {
                defId: 'base_a',
                minions: [m0, m1],
                ongoingActions: [
                    makeOngoing('killer_plant_sleep_spores', '0', 'sp_p0'),
                    makeOngoing('killer_plant_sleep_spores', '1', 'sp_p1'),
                ],
            };
            const state = makeState({ bases: [base] });
            expect(getEffectivePower(state, m0, 0)).toBe(4); // 5 - 1（被玩家1的孢子影响）
            expect(getEffectivePower(state, m1, 0)).toBe(4); // 5 - 1（被玩家0的孢子影响）
        });
    });
});

