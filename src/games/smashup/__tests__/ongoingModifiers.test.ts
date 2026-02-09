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
import type { SmashUpCore, PlayerState, MinionOnBase, CardInstance } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import {
    getEffectivePower,
    getPlayerEffectivePowerOnBase,
    getTotalEffectivePowerOnBase,
    clearPowerModifierRegistry,
} from '../domain/ongoingModifiers';

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

function makeMinion(uid: string, defId: string, controller: string, power: number): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0, talentUsed: false, attachedActions: [],
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['test_a', 'test_b'] as [string, string],
        ...overrides,
    };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

// ============================================================================
// 基础设施
// ============================================================================

describe('持续力量修正基础设施', () => {
    it('无修正时 getEffectivePower 等于 basePower + powerModifier', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3);
        minion.powerModifier = 2;
        const state = makeState({
            bases: [{ defId: 'base_a', minions: [minion], ongoingActions: [] }],
        });
        expect(getEffectivePower(state, minion, 0)).toBe(5); // 3 + 2
    });

    it('getPlayerEffectivePowerOnBase 正确累加', () => {
        const m1 = makeMinion('m1', 'test_a', '0', 2);
        const m2 = makeMinion('m2', 'test_b', '0', 3);
        const m3 = makeMinion('m3', 'test_c', '1', 5);
        const base = { defId: 'base_a', minions: [m1, m2, m3], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getPlayerEffectivePowerOnBase(state, base, 0, '0')).toBe(5); // 2 + 3
        expect(getPlayerEffectivePowerOnBase(state, base, 0, '1')).toBe(5);
    });

    it('getTotalEffectivePowerOnBase 正确累加所有随从', () => {
        const m1 = makeMinion('m1', 'test_a', '0', 2);
        const m2 = makeMinion('m2', 'test_b', '1', 3);
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
        const stego = makeMinion('stego', 'dino_armor_stego', '1', 3);
        const state = makeState({
            currentPlayerIndex: 0, // 玩家0的回合
            bases: [{ defId: 'base_a', minions: [stego], ongoingActions: [] }],
        });
        // 剑龙属于玩家1，当前是玩家0的回合 → +2
        expect(getEffectivePower(state, stego, 0)).toBe(5); // 3 + 2
    });

    it('己方回合时无修正', () => {
        const stego = makeMinion('stego', 'dino_armor_stego', '0', 3);
        const state = makeState({
            currentPlayerIndex: 0, // 玩家0的回合
            bases: [{ defId: 'base_a', minions: [stego], ongoingActions: [] }],
        });
        // 剑龙属于玩家0，当前也是玩家0的回合 → 无修正
        expect(getEffectivePower(state, stego, 0)).toBe(3);
    });

    it('多个剑龙各自独立计算', () => {
        const stego0 = makeMinion('s0', 'dino_armor_stego', '0', 3);
        const stego1 = makeMinion('s1', 'dino_armor_stego', '1', 3);
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
        const stego = makeMinion('stego', 'dino_armor_stego', '1', 3);
        const other = makeMinion('other', 'test_minion', '1', 2);
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
        const raptor = makeMinion('r1', 'dino_war_raptor', '0', 2);
        const base = { defId: 'base_a', minions: [raptor], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, raptor, 0)).toBe(3); // 2 + 1
    });

    it('两个猛禽各 +2', () => {
        const r1 = makeMinion('r1', 'dino_war_raptor', '0', 2);
        const r2 = makeMinion('r2', 'dino_war_raptor', '0', 2);
        const base = { defId: 'base_a', minions: [r1, r2], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, r1, 0)).toBe(4); // 2 + 2
        expect(getEffectivePower(state, r2, 0)).toBe(4);
    });

    it('三个猛禽各 +3', () => {
        const r1 = makeMinion('r1', 'dino_war_raptor', '0', 2);
        const r2 = makeMinion('r2', 'dino_war_raptor', '0', 2);
        const r3 = makeMinion('r3', 'dino_war_raptor', '0', 2);
        const base = { defId: 'base_a', minions: [r1, r2, r3], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, r1, 0)).toBe(5); // 2 + 3
    });

    it('不同基地的猛禽不互相加成', () => {
        const r1 = makeMinion('r1', 'dino_war_raptor', '0', 2);
        const r2 = makeMinion('r2', 'dino_war_raptor', '0', 2);
        const base0 = { defId: 'base_a', minions: [r1], ongoingActions: [] };
        const base1 = { defId: 'base_b', minions: [r2], ongoingActions: [] };
        const state = makeState({ bases: [base0, base1] });
        expect(getEffectivePower(state, r1, 0)).toBe(3); // 2 + 1（只有自己）
        expect(getEffectivePower(state, r2, 1)).toBe(3);
    });

    it('不同控制者的猛禽不互相加成', () => {
        const r0 = makeMinion('r0', 'dino_war_raptor', '0', 2);
        const r1 = makeMinion('r1', 'dino_war_raptor', '1', 2);
        const base = { defId: 'base_a', minions: [r0, r1], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, r0, 0)).toBe(3); // 2 + 1（只有自己）
        expect(getEffectivePower(state, r1, 0)).toBe(3);
    });

    it('不影响非猛禽随从', () => {
        const raptor = makeMinion('r1', 'dino_war_raptor', '0', 2);
        const other = makeMinion('other', 'test_minion', '0', 3);
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
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1);
        const base = { defId: 'base_a', minions: [alpha], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, alpha, 0)).toBe(1);
    });

    it('同基地有2个其他己方随从时 +2', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1);
        const m1 = makeMinion('m1', 'test_a', '0', 2);
        const m2 = makeMinion('m2', 'test_b', '0', 3);
        const base = { defId: 'base_a', minions: [alpha, m1, m2], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, alpha, 0)).toBe(3); // 1 + 2
    });

    it('跨基地计算所有己方随从', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1);
        const m1 = makeMinion('m1', 'test_a', '0', 2);
        const m2 = makeMinion('m2', 'test_b', '0', 3);
        const base0 = { defId: 'base_a', minions: [alpha, m1], ongoingActions: [] };
        const base1 = { defId: 'base_b', minions: [m2], ongoingActions: [] };
        const state = makeState({ bases: [base0, base1] });
        expect(getEffectivePower(state, alpha, 0)).toBe(3); // 1 + 2（m1 + m2）
    });

    it('不计算对手随从', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1);
        const enemy = makeMinion('e1', 'test_enemy', '1', 5);
        const base = { defId: 'base_a', minions: [alpha, enemy], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, alpha, 0)).toBe(1); // 对手随从不计
    });

    it('不影响其他随从', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1);
        const other = makeMinion('other', 'test_minion', '0', 2);
        const base = { defId: 'base_a', minions: [alpha, other], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, other, 0)).toBe(2); // 阿尔法号只加自身
    });
});

// ============================================================================
// 机器人：微型机修理者
// ============================================================================

describe('robot_microbot_fixer（微型机修理者 ongoing）', () => {
    it('修理者在场时己方所有随从 +1', () => {
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1);
        const m1 = makeMinion('m1', 'test_a', '0', 2);
        const base = { defId: 'base_a', minions: [fixer, m1], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, fixer, 0)).toBe(2); // 1 + 1（修理者自身也受益）
        expect(getEffectivePower(state, m1, 0)).toBe(3); // 2 + 1
    });

    it('两个修理者叠加 +2', () => {
        const f1 = makeMinion('f1', 'robot_microbot_fixer', '0', 1);
        const f2 = makeMinion('f2', 'robot_microbot_fixer', '0', 1);
        const m1 = makeMinion('m1', 'test_a', '0', 2);
        const base = { defId: 'base_a', minions: [f1, f2, m1], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, m1, 0)).toBe(4); // 2 + 2
        expect(getEffectivePower(state, f1, 0)).toBe(3); // 1 + 2
    });

    it('不影响对手随从', () => {
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1);
        const enemy = makeMinion('e1', 'test_enemy', '1', 3);
        const base = { defId: 'base_a', minions: [fixer, enemy], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, enemy, 0)).toBe(3); // 不受修理者影响
    });

    it('跨基地生效', () => {
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1);
        const m1 = makeMinion('m1', 'test_a', '0', 2);
        const base0 = { defId: 'base_a', minions: [fixer], ongoingActions: [] };
        const base1 = { defId: 'base_b', minions: [m1], ongoingActions: [] };
        const state = makeState({ bases: [base0, base1] });
        expect(getEffectivePower(state, m1, 1)).toBe(3); // 2 + 1（修理者在另一个基地）
    });

    it('无修理者时无修正', () => {
        const m1 = makeMinion('m1', 'test_a', '0', 2);
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
        const haunting = makeMinion('h1', 'ghost_haunting', '0', 3);
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
        const haunting = makeMinion('h1', 'ghost_haunting', '0', 3);
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
        const haunting = makeMinion('h1', 'ghost_haunting', '0', 3);
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
        const haunting = makeMinion('h1', 'ghost_haunting', '0', 3);
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
        const haunting = makeMinion('h1', 'ghost_haunting', '0', 3);
        const other = makeMinion('other', 'test_minion', '0', 2);
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
        const raptor = makeMinion('r1', 'dino_war_raptor', '0', 2);
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1);
        const base = { defId: 'base_a', minions: [raptor, fixer], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        // 猛禽：basePower=2 + 猛禽修正=1（只有自己） + 修理者修正=1 = 4
        expect(getEffectivePower(state, raptor, 0)).toBe(4);
        // 修理者：basePower=1 + 修理者修正=1 = 2
        expect(getEffectivePower(state, fixer, 0)).toBe(2);
    });

    it('阿尔法号 + 修理者叠加', () => {
        const alpha = makeMinion('alpha', 'robot_microbot_alpha', '0', 1);
        const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1);
        const m1 = makeMinion('m1', 'test_a', '0', 2);
        const base = { defId: 'base_a', minions: [alpha, fixer, m1], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        // 阿尔法号：basePower=1 + 阿尔法修正=2（fixer+m1） + 修理者修正=1 = 4
        expect(getEffectivePower(state, alpha, 0)).toBe(4);
        // m1：basePower=2 + 修理者修正=1 = 3
        expect(getEffectivePower(state, m1, 0)).toBe(3);
    });

    it('getPlayerEffectivePowerOnBase 含持续修正', () => {
        const r1 = makeMinion('r1', 'dino_war_raptor', '0', 2);
        const r2 = makeMinion('r2', 'dino_war_raptor', '0', 2);
        const enemy = makeMinion('e1', 'test_enemy', '1', 5);
        const base = { defId: 'base_a', minions: [r1, r2, enemy], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        // 玩家0：r1=2+2=4, r2=2+2=4 → 总计 8
        expect(getPlayerEffectivePowerOnBase(state, base, 0, '0')).toBe(8);
        // 玩家1：enemy=5
        expect(getPlayerEffectivePowerOnBase(state, base, 0, '1')).toBe(5);
    });

    it('getTotalEffectivePowerOnBase 含持续修正', () => {
        const r1 = makeMinion('r1', 'dino_war_raptor', '0', 2);
        const r2 = makeMinion('r2', 'dino_war_raptor', '0', 2);
        const enemy = makeMinion('e1', 'test_enemy', '1', 5);
        const base = { defId: 'base_a', minions: [r1, r2, enemy], ongoingActions: [] };
        const state = makeState({ bases: [base] });
        // r1=4, r2=4, enemy=5 → 总计 13
        expect(getTotalEffectivePowerOnBase(state, base, 0)).toBe(13);
    });
});
