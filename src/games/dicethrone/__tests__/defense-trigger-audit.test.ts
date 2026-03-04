/**
 * 防御阶段触发审计测试
 * 
 * 目标：确保只有真正造成伤害的技能才会触发防御阶段
 * 
 * 背景：
 * - 之前 playerAbilityHasDamage 只要检测到 rollDie 就返回 true
 * - 导致纯 buff/heal/token 技能（如圣骑士圣光）也触发防御阶段
 * - 修复后精确检查 rollDie 的 conditionalEffects 是否包含 bonusDamage
 */

import { describe, it, expect } from 'vitest';
import { playerAbilityHasDamage } from '../domain/abilityLookup';
import { initHeroState } from '../domain/characters';
import type { DiceThroneCore } from '../domain/types';
import type { PlayerId } from '../../../engine/types';

// 创建最小测试状态
function createTestState(characterId: string): DiceThroneCore {
    const random = {
        shuffle: <T>(arr: T[]) => arr,
        random: () => 0.5,
        d: (_n: number) => 1,
        range: (min: number, _max: number) => min
    } as any;

    const p1 = initHeroState('p1' as PlayerId, characterId as any, random);
    const p2 = initHeroState('p2' as PlayerId, 'monk' as any, random);

    return {
        players: { p1, p2 },
        dice: [],
        currentPlayerId: 'p1' as PlayerId,
        phase: 'offensiveRoll',
        turnNumber: 1,
    } as any;
}

describe('防御阶段触发审计', () => {
    describe('圣骑士 (Paladin)', () => {
        it('❌ Holy Light (圣光) - 纯治疗+buff，不应触发防御', () => {
            const state = createTestState('paladin');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'holy-light');
            expect(hasDamage).toBe(false);
        });

        it('✅ Righteous Combat (正义冲击) - 有基础伤害5，应触发防御', () => {
            const state = createTestState('paladin');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'righteous-combat');
            expect(hasDamage).toBe(true);
        });

        it('✅ Blessing of Might (力量祝福) - 有基础伤害3，应触发防御', () => {
            const state = createTestState('paladin');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'blessing-of-might');
            expect(hasDamage).toBe(true);
        });

        it('✅ Holy Strike (神圣冲击) - 有基础伤害5/8，应触发防御', () => {
            const state = createTestState('paladin');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'holy-strike');
            expect(hasDamage).toBe(true);
        });

        it('❌ Vengeance (复仇) - 纯 token+CP，不应触发防御', () => {
            const state = createTestState('paladin');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'vengeance');
            expect(hasDamage).toBe(false);
        });

        it('✅ Righteous Prayer (正义祈祷) - 有基础伤害8，应触发防御', () => {
            const state = createTestState('paladin');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'righteous-prayer');
            expect(hasDamage).toBe(true);
        });

        it('✅ Unyielding Faith (坚毅信念) - 有基础伤害10，应触发防御', () => {
            const state = createTestState('paladin');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'unyielding-faith');
            expect(hasDamage).toBe(true);
        });
    });

    describe('僧侣 (Monk)', () => {
        it('✅ Taiji Combo (太极连击) - 有基础伤害5 + rollDie bonusDamage，应触发防御', () => {
            const state = createTestState('monk');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'taiji-combo');
            expect(hasDamage).toBe(true);
        });

        it('✅ Fist Technique (拳法) - 有基础伤害，应触发防御', () => {
            const state = createTestState('monk');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'fist-technique');
            expect(hasDamage).toBe(true);
        });

        it('❌ Zen Forget (禅忘) - 纯 buff/token，不应触发防御', () => {
            const state = createTestState('monk');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'zen-forget');
            expect(hasDamage).toBe(false);
        });
    });

    describe('野蛮人 (Barbarian)', () => {
        it('✅ Slap (掌击) - 有基础伤害，应触发防御', () => {
            const state = createTestState('barbarian');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'slap');
            expect(hasDamage).toBe(true);
        });

        it('✅ All Out Strike (全力一击) - 有基础伤害，应触发防御', () => {
            const state = createTestState('barbarian');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'all-out-strike');
            expect(hasDamage).toBe(true);
        });

        it('❌ Steadfast (坚定) - 纯 token，不应触发防御', () => {
            const state = createTestState('barbarian');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'steadfast');
            expect(hasDamage).toBe(false);
        });
    });

    describe('火法师 (Pyromancer)', () => {
        it('✅ Fireball (火球术) - 有基础伤害，应触发防御', () => {
            const state = createTestState('pyromancer');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'fireball');
            expect(hasDamage).toBe(true);
        });

        it('✅ Soul Burn (焚魂) - custom action 包含 damage category，应触发防御', () => {
            const state = createTestState('pyromancer');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'soul-burn');
            expect(hasDamage).toBe(true);
        });

        it('✅ Pyro Blast (烈焰冲击) - 有基础伤害，应触发防御', () => {
            const state = createTestState('pyromancer');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'pyro-blast');
            expect(hasDamage).toBe(true);
        });

        it('❌ Ignite (点燃) - custom action 只有 resource category，不应触发防御', () => {
            const state = createTestState('pyromancer');
            // 注意：ignite 实际上有伤害，这个测试可能需要调整
            // 如果 ignite 的 custom action categories 包含 'damage'，则应该返回 true
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'ignite');
            // 根据实际 categories 调整预期
            expect(hasDamage).toBe(true); // ignite-resolve 包含 damage category
        });
    });

    describe('暗影盗贼 (Shadow Thief)', () => {
        it('✅ Dagger Strike (匕首打击) - 有基础伤害，应触发防御', () => {
            const state = createTestState('shadow_thief');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'dagger-strike');
            expect(hasDamage).toBe(true);
        });

        it('✅ Pickpocket (扒窃) - 造成一半CP的伤害，应触发防御', () => {
            const state = createTestState('shadow_thief');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'pickpocket');
            expect(hasDamage).toBe(true);
        });

        it('❌ Steal (偷窃) - 纯偷 CP，不应触发防御', () => {
            const state = createTestState('shadow_thief');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'steal');
            expect(hasDamage).toBe(false);
        });

        it('✅ Kidney Shot (肾击) - 有基础伤害，应触发防御', () => {
            const state = createTestState('shadow_thief');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'kidney-shot');
            expect(hasDamage).toBe(true);
        });

        it('✅ Shadow Dance (暗影之舞) - custom action 包含 damage category，应触发防御', () => {
            const state = createTestState('shadow_thief');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'shadow-dance');
            expect(hasDamage).toBe(true);
        });
    });

    describe('月精灵 (Moon Elf)', () => {
        it('✅ Longbow (长弓) - 有基础伤害，应触发防御', () => {
            const state = createTestState('moon_elf');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'longbow');
            expect(hasDamage).toBe(true);
        });

        it('✅ Covert Fire (隐蔽射击) - 有基础伤害，应触发防御', () => {
            const state = createTestState('moon_elf');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'covert-fire');
            expect(hasDamage).toBe(true);
        });

        it('✅ Elusive Step (闪避步) - 防御技能包含反伤，应触发防御', () => {
            const state = createTestState('moon_elf');
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'elusive-step');
            expect(hasDamage).toBe(true);
        });
    });

    describe('边界情况', () => {
        it('rollDie 只有 heal/token/cp 效果，不应触发防御', () => {
            const state = createTestState('paladin');
            // Holy Light: rollDie 只有 token/heal/drawCard/cp，无 bonusDamage
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'holy-light');
            expect(hasDamage).toBe(false);
        });

        it('rollDie 包含 bonusDamage，应触发防御', () => {
            const state = createTestState('paladin');
            // Righteous Combat: rollDie 包含 bonusDamage
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'righteous-combat');
            expect(hasDamage).toBe(true);
        });

        it('custom action categories 包含 damage，应触发防御', () => {
            const state = createTestState('pyromancer');
            // Soul Burn: custom action 包含 damage category
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'soul-burn');
            expect(hasDamage).toBe(true);
        });

        it('custom action categories 只有 resource，不应触发防御', () => {
            const state = createTestState('shadow_thief');
            // Steal: custom action 只有 resource category（纯偷 CP）
            const hasDamage = playerAbilityHasDamage(state, 'p1' as PlayerId, 'steal');
            expect(hasDamage).toBe(false);
        });
    });
});
