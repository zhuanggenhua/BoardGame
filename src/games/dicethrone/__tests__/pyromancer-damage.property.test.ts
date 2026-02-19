/**
 * Pyromancer 状态效果应用属性测试
 *
 * Feature: unified-damage-buff-system
 * Property 4: Pyromancer 伤害正确应用所有修正
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * 验证 Pyromancer custom action 产生的伤害通过 createDamageCalculation
 * 正确收集并应用所有三种类型的修正（Token、Status、Shield），
 * 最终伤害值反映所有修正的累积效果。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';

// ============================================================================
// 生成器
// ============================================================================

/** 基础伤害值（1~50，Pyromancer 技能伤害范围） */
const arbBaseDamage = () => fc.integer({ min: 1, max: 50 });

/** 正整数层数（1~8） */
const arbPositiveStacks = () => fc.integer({ min: 1, max: 8 });

/** damageReduction 每层减伤值（1~5） */
const arbDamageReduction = () => fc.integer({ min: 1, max: 5 });

/** damageBonus 每层加伤值（1~3） */
const arbDamageBonus = () => fc.integer({ min: 1, max: 3 });

/** 护盾值（1~30） */
const arbShieldValue = () => fc.integer({ min: 1, max: 30 });

/** modifyStat 每层修正值（负值=减伤） */
const arbModifyStatValue = () => fc.integer({ min: -5, max: -1 });

/** FM 手动修正值（0~10，模拟 Fire Mastery 加伤） */
const arbFMBonus = () => fc.integer({ min: 0, max: 10 });

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 构造 Pyromancer 伤害场景的最小化游戏状态
 */
function makePyroState(opts: {
  attackerId: string;
  targetId: string;
  attackerTokens?: Record<string, number>;
  targetStatusEffects?: Record<string, number>;
  targetShields?: Array<{ value: number; sourceId: string }>;
  tokenDefs?: any[];
}) {
  return {
    core: {
      players: {
        [opts.attackerId]: {
          tokens: opts.attackerTokens ?? {},
          statusEffects: {},
          damageShields: [],
          resources: { hp: 50 },
        },
        [opts.targetId]: {
          tokens: {},
          statusEffects: opts.targetStatusEffects ?? {},
          damageShields: opts.targetShields ?? [],
          resources: { hp: 50 },
        },
      },
      tokenDefinitions: opts.tokenDefs ?? [],
      pendingAttack: null,
    },
  };
}

// ============================================================================
// Property 4: Pyromancer 伤害正确应用所有修正
// ============================================================================

describe('Property 4: Pyromancer 伤害正确应用所有修正', () => {

  /**
   * **Validates: Requirements 2.1**
   *
   * Pyromancer 使用默认 autoCollect 时，目标的 statusEffects（如 armor 减伤）
   * 被正确收集并应用到伤害计算中。
   */
  it(
    '目标状态效果（damageReduction）正确减免 Pyromancer 伤害',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbPositiveStacks(),
          arbDamageReduction(),
          (baseDamage, stacks, damageReduction) => {
            const armorDef = {
              id: 'armor',
              name: 'Armor',
              category: 'debuff',
              damageReduction,
            };

            const state = makePyroState({
              attackerId: '0',
              targetId: '1',
              targetStatusEffects: { armor: stacks },
              tokenDefs: [armorDef],
            });

            // 模拟 Pyromancer 的 createDamageCalculation 调用（默认 autoCollect）
            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0', abilityId: 'pyro_ability' },
              target: { playerId: '1' },
              state,
              timestamp: 1000,
              // 默认 autoCollectStatus: true（3.1 修复后的行为）
            });

            const result = calc.resolve();

            const expectedDamage = Math.max(0, baseDamage - damageReduction * stacks);
            expect(result.finalDamage).toBe(expectedDamage);

            // 当有减伤时，modifiers 应包含状态修正
            if (damageReduction * stacks > 0) {
              const statusMod = result.modifiers.find(m => m.sourceId === 'armor');
              expect(statusMod).toBeDefined();
              expect(statusMod!.value).toBe(-damageReduction * stacks);
            }
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * **Validates: Requirements 2.1**
   *
   * Pyromancer 使用默认 autoCollect 时，目标的 passiveTrigger（modifyStat）
   * 被正确收集并应用到伤害计算中。
   */
  it(
    '目标 passiveTrigger modifyStat 正确修正 Pyromancer 伤害',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbPositiveStacks(),
          arbModifyStatValue(),
          (baseDamage, stacks, modifyValue) => {
            const statusDef = {
              id: 'tough_skin',
              name: 'Tough Skin',
              category: 'debuff',
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: [{ type: 'modifyStat', stat: 'damage', value: modifyValue }],
              },
            };

            const state = makePyroState({
              attackerId: '0',
              targetId: '1',
              targetStatusEffects: { tough_skin: stacks },
              tokenDefs: [statusDef],
            });

            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0', abilityId: 'pyro_ability' },
              target: { playerId: '1' },
              state,
              timestamp: 1000,
            });

            const result = calc.resolve();

            const expectedDamage = Math.max(0, baseDamage + modifyValue * stacks);
            expect(result.finalDamage).toBe(expectedDamage);
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * **Validates: Requirements 2.2**
   *
   * Pyromancer 使用默认 autoCollect 时，攻击方的 Token（damageBonus）
   * 被正确收集并应用到伤害计算中。
   * 注意：部分 Pyromancer 技能手动添加 FM 修正（autoCollectTokens: false），
   * 但其他 Token 类型仍通过自动收集生效。
   */
  it(
    '攻击方 Token（damageBonus）正确增加 Pyromancer 伤害',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbPositiveStacks(),
          arbDamageBonus(),
          (baseDamage, tokenStacks, damageBonus) => {
            const tokenDef = {
              id: 'power_token',
              name: 'Power Token',
              category: 'buff',
              damageBonus,
            };

            const state = makePyroState({
              attackerId: '0',
              targetId: '1',
              attackerTokens: { power_token: tokenStacks },
              tokenDefs: [tokenDef],
            });

            // 使用默认 autoCollectTokens: true（如 soulBurnDamage、meteor、burnDown 等）
            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0', abilityId: 'pyro_ability' },
              target: { playerId: '1' },
              state,
              timestamp: 1000,
            });

            const result = calc.resolve();

            const expectedDamage = baseDamage + damageBonus * tokenStacks;
            expect(result.finalDamage).toBe(expectedDamage);

            // modifiers 应包含 Token 修正
            const tokenMod = result.modifiers.find(m => m.sourceId === 'power_token');
            expect(tokenMod).toBeDefined();
            expect(tokenMod!.value).toBe(damageBonus * tokenStacks);
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * **Validates: Requirements 2.3**
   *
   * Pyromancer 使用默认 autoCollect 时，目标的 damageShields
   * 被正确收集并应用到伤害计算中。
   */
  it(
    '目标护盾正确减免 Pyromancer 伤害',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbShieldValue(),
          (baseDamage, shieldValue) => {
            const state = makePyroState({
              attackerId: '0',
              targetId: '1',
              targetShields: [{ value: shieldValue, sourceId: 'shield_source' }],
            });

            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0', abilityId: 'pyro_ability' },
              target: { playerId: '1' },
              state,
              timestamp: 1000,
            });

            const result = calc.resolve();

            const expectedDamage = Math.max(0, baseDamage - shieldValue);
            expect(result.finalDamage).toBe(expectedDamage);

            // modifiers 应包含护盾修正
            const shieldMod = result.modifiers.find(m => m.sourceId === 'shield');
            expect(shieldMod).toBeDefined();
            expect(shieldMod!.value).toBe(-shieldValue);
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * 核心属性：对任意 Pyromancer 伤害场景，当同时存在 Token 加伤、
   * Status 减伤和 Shield 减免时，三种修正正确累加，
   * finalDamage = max(0, baseDamage + tokenBonus - statusReduction - shield)
   */
  it(
    '三种修正类型（Token + Status + Shield）正确累加',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbPositiveStacks(),
          arbDamageBonus(),
          arbPositiveStacks(),
          arbDamageReduction(),
          arbShieldValue(),
          (baseDamage, tokenStacks, damageBonus, statusStacks, damageReduction, shieldValue) => {
            const tokenDef = {
              id: 'power_token',
              name: 'Power Token',
              category: 'buff',
              damageBonus,
            };

            const statusDef = {
              id: 'armor',
              name: 'Armor',
              category: 'debuff',
              damageReduction,
            };

            const state = makePyroState({
              attackerId: '0',
              targetId: '1',
              attackerTokens: { power_token: tokenStacks },
              targetStatusEffects: { armor: statusStacks },
              targetShields: [{ value: shieldValue, sourceId: 'shield_source' }],
              tokenDefs: [tokenDef, statusDef],
            });

            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0', abilityId: 'pyro_ability' },
              target: { playerId: '1' },
              state,
              timestamp: 1000,
              // 全部使用默认 autoCollect: true
            });

            const result = calc.resolve();

            const tokenBonus = damageBonus * tokenStacks;
            const statusReduct = damageReduction * statusStacks;
            const expectedDamage = Math.max(0, baseDamage + tokenBonus - statusReduct - shieldValue);
            expect(result.finalDamage).toBe(expectedDamage);

            // breakdown 应包含基础伤害
            expect(result.baseDamage).toBe(baseDamage);
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * 模拟 Pyromancer 手动 FM 修正场景（autoCollectTokens: false + additionalModifiers），
   * 状态效果和护盾仍然被正确收集和应用。
   */
  it(
    '手动 FM 修正 + 自动收集 Status/Shield 正确叠加',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbFMBonus(),
          arbPositiveStacks(),
          arbDamageReduction(),
          arbShieldValue(),
          (baseDamage, fmBonus, statusStacks, damageReduction, shieldValue) => {
            const statusDef = {
              id: 'armor',
              name: 'Armor',
              category: 'debuff',
              damageReduction,
            };

            const state = makePyroState({
              attackerId: '0',
              targetId: '1',
              targetStatusEffects: { armor: statusStacks },
              targetShields: [{ value: shieldValue, sourceId: 'shield_source' }],
              tokenDefs: [statusDef],
            });

            // 模拟 fieryCombo/ignite 的调用模式：
            // autoCollectTokens: false（手动 FM），但 Status 和 Shield 自动收集
            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0', abilityId: 'pyro_fiery_combo' },
              target: { playerId: '1' },
              state,
              timestamp: 1000,
              autoCollectTokens: false,
              // autoCollectStatus: true（默认，3.1 修复后）
              // autoCollectShields: true（默认，3.1 修复后）
              additionalModifiers: fmBonus > 0 ? [{
                id: 'fiery-combo-fm',
                type: 'flat' as const,
                value: fmBonus,
                priority: 10,
                source: 'fire_mastery',
                description: 'Fire Mastery',
              }] : [],
            });

            const result = calc.resolve();

            const statusReduct = damageReduction * statusStacks;
            const expectedDamage = Math.max(0, baseDamage + fmBonus - statusReduct - shieldValue);
            expect(result.finalDamage).toBe(expectedDamage);
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * 当所有修正使伤害降为 0 或以下时，finalDamage 始终为 0（下限保证）。
   */
  it(
    '修正使伤害降为负值时，finalDamage 下限为 0',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),  // 小基础伤害
          arbPositiveStacks(),
          fc.integer({ min: 3, max: 5 }),   // 大减伤
          fc.integer({ min: 5, max: 30 }),  // 大护盾
          (baseDamage, statusStacks, damageReduction, shieldValue) => {
            const statusDef = {
              id: 'heavy_armor',
              name: 'Heavy Armor',
              category: 'debuff',
              damageReduction,
            };

            const state = makePyroState({
              attackerId: '0',
              targetId: '1',
              targetStatusEffects: { heavy_armor: statusStacks },
              targetShields: [{ value: shieldValue, sourceId: 'shield_source' }],
              tokenDefs: [statusDef],
            });

            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0', abilityId: 'pyro_ability' },
              target: { playerId: '1' },
              state,
              timestamp: 1000,
            });

            const result = calc.resolve();

            // finalDamage 永远 >= 0
            expect(result.finalDamage).toBeGreaterThanOrEqual(0);

            // 验证计算正确性
            const rawDamage = baseDamage - damageReduction * statusStacks - shieldValue;
            expect(result.finalDamage).toBe(Math.max(0, rawDamage));
          },
        ),
        { numRuns: 200 },
      );
    },
  );
});
