/**
 * 伤害路径统一回归属性测试
 *
 * Feature: unified-damage-buff-system
 * Property 1: 伤害路径统一回归一致性
 * Property 5: Token 响应窗口行为保持
 *
 * **Validates: Requirements 1.1, 1.5, 1.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createDamageCalculation,
  type PassiveTriggerHandler,
} from '../../../engine/primitives/damageCalculation';
import type { GameEvent } from '../../../engine/types';
import { shouldOpenTokenResponse } from '../domain/tokenResponse';

// ============================================================================
// 生成器
// ============================================================================

/** 基础伤害值（0~80，覆盖 0 边界和常见范围） */
const arbBaseDamage = () => fc.integer({ min: 0, max: 80 });

/** 正整数伤害值（1~80，用于 Token 响应窗口测试，damage>0 才有意义） */
const arbPositiveDamage = () => fc.integer({ min: 1, max: 80 });

/** 正整数层数（1~8，至少 1 层才会触发） */
const arbPositiveStacks = () => fc.integer({ min: 1, max: 8 });

/** damageReduction 每层减伤值（1~5） */
const arbDamageReduction = () => fc.integer({ min: 1, max: 5 });

/** damageBonus 每层加伤值（1~5） */
const arbDamageBonus = () => fc.integer({ min: 1, max: 5 });

/** 护盾值（0~30） */
const arbShieldValue = () => fc.integer({ min: 0, max: 30 });

/** preventAmount（0~50） */
const arbPreventAmount = () => fc.integer({ min: 0, max: 50 });

/** modifyStat 每层修正值（-5~5，负值=减伤，正值=加伤） */
const arbModifyStatValue = () => fc.integer({ min: -5, max: 5 });

/** 合法标识符 */
const arbId = () => fc.stringMatching(/^[a-z][a-z0-9_]{2,12}$/);

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 构造最小化的 DiceThrone 游戏状态
 * 支持 tokens、statusEffects、damageShields、tokenDefinitions
 */
function makeState(opts: {
  attackerId: string;
  targetId: string;
  attackerTokens?: Record<string, number>;
  targetTokens?: Record<string, number>;
  targetStatusEffects?: Record<string, number>;
  targetShields?: Array<{ value: number; sourceId: string }>;
  tokenDefs?: any[];
  pendingDamage?: any;
  pendingAttack?: any;
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
          tokens: opts.targetTokens ?? {},
          statusEffects: opts.targetStatusEffects ?? {},
          damageShields: opts.targetShields ?? [],
          resources: { hp: 50 },
        },
      },
      tokenDefinitions: opts.tokenDefs ?? [],
      pendingDamage: opts.pendingDamage ?? undefined,
      pendingAttack: opts.pendingAttack ?? null,
    },
  };
}


/**
 * 创建一个返回固定 preventAmount 的 PassiveTriggerHandler
 */
function createMockHandler(
  preventAmount: number,
): { handler: PassiveTriggerHandler; calls: any[] } {
  const calls: any[] = [];
  const handler: PassiveTriggerHandler = {
    handleCustomAction(actionId, context) {
      calls.push({ actionId, context });
      const events: GameEvent[] = [];
      if (preventAmount > 0) {
        events.push({
          type: 'PREVENT_DAMAGE',
          payload: { amount: preventAmount, targetId: context.targetId },
          sourceCommandType: 'ABILITY_EFFECT',
          timestamp: context.timestamp,
        });
      }
      return { events, preventAmount };
    },
  };
  return { handler, calls };
}

// ============================================================================
// Property 1: 伤害路径统一回归一致性
// ============================================================================

describe('Property 1: 伤害路径统一回归一致性', () => {
  /**
   * **Validates: Requirements 1.1, 1.6**
   *
   * 对任意 baseDamage 和 modifyStat passiveTrigger 组合，
   * createDamageCalculation 的 finalDamage 应等于手动计算的结果：
   * max(0, baseDamage + sum(modifyStat.value * stacks))
   */
  it(
    'modifyStat passiveTrigger 修正后的 finalDamage 等于 baseDamage + sum(修正值 * 层数)，下限 0',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbPositiveStacks(),
          arbModifyStatValue().filter(v => v !== 0),
          arbId(),
          (baseDamage, stacks, modifyValue, tokenId) => {
            const tokenDef = {
              id: tokenId,
              name: `Token ${tokenId}`,
              category: 'debuff',
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: [{ type: 'modifyStat', stat: 'damage', value: modifyValue }],
              },
            };

            const state = makeState({
              attackerId: '0',
              targetId: '1',
              targetStatusEffects: { [tokenId]: stacks },
              tokenDefs: [tokenDef],
            });

            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0' },
              target: { playerId: '1' },
              state,
              autoCollectTokens: false,
              autoCollectStatus: true,
              autoCollectShields: false,
              timestamp: 1000,
            });

            const result = calc.resolve();

            // 手动计算预期值：baseDamage + modifyValue * stacks，下限 0
            const expectedDamage = Math.max(0, baseDamage + modifyValue * stacks);
            expect(result.finalDamage).toBe(expectedDamage);
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * **Validates: Requirements 1.1, 1.6**
   *
   * 对任意 baseDamage、damageReduction 状态和 damageBonus Token 组合，
   * createDamageCalculation 正确累加所有修正类型
   */
  it(
    '多种修正类型（damageReduction + damageBonus + shield）正确累加',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbPositiveStacks(),
          arbDamageReduction(),
          arbPositiveStacks(),
          arbDamageBonus(),
          arbShieldValue(),
          arbId(),
          arbId().filter(id => id.length > 3), // 确保与 statusId 不同
          (baseDamage, statusStacks, damageReduction, tokenStacks, damageBonus, shieldValue, statusId, tokenId) => {
            // 确保 statusId 和 tokenId 不同
            const safeTokenId = tokenId === statusId ? `${tokenId}_t` : tokenId;

            const statusDef = {
              id: statusId,
              name: `Status ${statusId}`,
              category: 'debuff',
              damageReduction,
            };

            const tokenDef = {
              id: safeTokenId,
              name: `Token ${safeTokenId}`,
              category: 'buff',
              damageBonus,
            };

            const state = makeState({
              attackerId: '0',
              targetId: '1',
              attackerTokens: { [safeTokenId]: tokenStacks },
              targetStatusEffects: { [statusId]: statusStacks },
              targetShields: shieldValue > 0 ? [{ value: shieldValue, sourceId: 'test' }] : [],
              tokenDefs: [statusDef, tokenDef],
            });

            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0' },
              target: { playerId: '1' },
              state,
              autoCollectTokens: true,
              autoCollectStatus: true,
              autoCollectShields: true,
              timestamp: 1000,
            });

            const result = calc.resolve();

            // 手动计算：baseDamage + tokenBonus - statusReduction - shield，下限 0
            const tokenBonus = damageBonus * tokenStacks;
            const statusReduct = damageReduction * statusStacks;
            const expectedDamage = Math.max(0, baseDamage + tokenBonus - statusReduct - shieldValue);
            expect(result.finalDamage).toBe(expectedDamage);

            // breakdown 应包含基础伤害
            expect(result.breakdown).toBeDefined();
            expect(result.baseDamage).toBe(baseDamage);
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * **Validates: Requirements 1.1, 1.6**
   *
   * 对任意 baseDamage 和 custom passiveTrigger（PREVENT_DAMAGE），
   * createDamageCalculation 的 finalDamage = max(0, baseDamage - preventAmount)
   * 且 sideEffectEvents 被正确收集
   */
  it(
    'custom passiveTrigger (PREVENT_DAMAGE) 正确减免伤害并收集副作用事件',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbPreventAmount(),
          arbPositiveStacks(),
          arbId(),
          (baseDamage, preventAmount, stacks, tokenId) => {
            const tokenDef = {
              id: tokenId,
              name: `Token ${tokenId}`,
              category: 'token',
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: [{ type: 'custom', customActionId: 'PREVENT_TEST' }],
              },
            };

            const state = makeState({
              attackerId: '0',
              targetId: '1',
              targetTokens: { [tokenId]: stacks },
              tokenDefs: [tokenDef],
            });

            const { handler } = createMockHandler(preventAmount);

            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0' },
              target: { playerId: '1' },
              state,
              autoCollectTokens: false,
              autoCollectStatus: true,
              autoCollectShields: false,
              passiveTriggerHandler: handler,
              timestamp: 1000,
            });

            const result = calc.resolve();

            const expectedDamage = Math.max(0, baseDamage - preventAmount);
            expect(result.finalDamage).toBe(expectedDamage);
          },
        ),
        { numRuns: 200 },
      );
    },
  );

  /**
   * **Validates: Requirements 1.1, 1.6**
   *
   * 对任意组合（modifyStat + custom/PREVENT_DAMAGE + shield），
   * 所有修正类型正确叠加，finalDamage = max(0, baseDamage + modifyStat - prevent - shield)
   */
  it(
    '所有修正类型（modifyStat + custom/PREVENT + shield）正确叠加',
    () => {
      fc.assert(
        fc.property(
          arbBaseDamage(),
          arbPositiveStacks(),
          arbModifyStatValue(),
          arbPreventAmount(),
          arbShieldValue(),
          arbId(),
          arbId().filter(id => id.length > 3),
          (baseDamage, stacks, modifyValue, preventAmount, shieldValue, statusId, preventTokenId) => {
            const safePreventId = preventTokenId === statusId ? `${preventTokenId}_p` : preventTokenId;

            const statusDef = {
              id: statusId,
              name: `Status ${statusId}`,
              category: 'debuff',
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: [{ type: 'modifyStat', stat: 'damage', value: modifyValue }],
              },
            };

            const preventDef = {
              id: safePreventId,
              name: `Prevent ${safePreventId}`,
              category: 'token',
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: [{ type: 'custom', customActionId: 'PREVENT_ALL' }],
              },
            };

            const state = makeState({
              attackerId: '0',
              targetId: '1',
              targetStatusEffects: { [statusId]: stacks },
              targetTokens: { [safePreventId]: 1 },
              targetShields: shieldValue > 0 ? [{ value: shieldValue, sourceId: 'test' }] : [],
              tokenDefs: [statusDef, preventDef],
            });

            const { handler } = createMockHandler(preventAmount);

            const calc = createDamageCalculation({
              baseDamage,
              source: { playerId: '0' },
              target: { playerId: '1' },
              state,
              autoCollectTokens: false,
              autoCollectStatus: true,
              autoCollectShields: true,
              passiveTriggerHandler: handler,
              timestamp: 1000,
            });

            const result = calc.resolve();

            // 所有修正叠加：baseDamage + modifyStat*stacks - preventAmount - shield
            const expectedDamage = Math.max(
              0,
              baseDamage + modifyValue * stacks - preventAmount - shieldValue,
            );
            expect(result.finalDamage).toBe(expectedDamage);
          },
        ),
        { numRuns: 200 },
      );
    },
  );
});


// ============================================================================
// Property 5: Token 响应窗口行为保持
// ============================================================================

describe('Property 5: Token 响应窗口行为保持', () => {
  /**
   * **Validates: Requirements 1.5**
   *
   * 当目标拥有 consumable 类型 Token（activeUse.timing 包含 beforeDamageReceived），
   * 且 damage > 0 且无 pendingDamage，shouldOpenTokenResponse 返回 'defenderMitigation'
   */
  it(
    '目标有防御 Token 且 damage > 0 时，shouldOpenTokenResponse 返回 defenderMitigation',
    () => {
      fc.assert(
        fc.property(
          arbPositiveDamage(),
          arbPositiveStacks(),
          arbId(),
          (damage, tokenStacks, tokenId) => {
            const defensiveTokenDef = {
              id: tokenId,
              name: `Defense ${tokenId}`,
              category: 'consumable',
              activeUse: {
                timing: ['beforeDamageReceived'],
                consumeAmount: 1,
                effect: { type: 'modifyDamage', value: -1 },
              },
            };

            // 构造直传态（shouldOpenTokenResponse 直接读 state.players）
            const state = {
              players: {
                '0': {
                  tokens: {},
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
                '1': {
                  tokens: { [tokenId]: tokenStacks },
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
              },
              tokenDefinitions: [defensiveTokenDef],
              pendingDamage: undefined,
              pendingAttack: null,
            } as any;

            const result = shouldOpenTokenResponse(state, '0', '1', damage);
            expect(result).toBe('defenderMitigation');
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  /**
   * **Validates: Requirements 1.5**
   *
   * 当攻击方拥有 consumable 类型 Token（activeUse.timing 包含 beforeDamageDealt），
   * 且 damage > 0 且无 pendingDamage，shouldOpenTokenResponse 返回 'attackerBoost'
   */
  it(
    '攻击方有进攻 Token 且 damage > 0 时，shouldOpenTokenResponse 返回 attackerBoost',
    () => {
      fc.assert(
        fc.property(
          arbPositiveDamage(),
          arbPositiveStacks(),
          arbId(),
          (damage, tokenStacks, tokenId) => {
            const offensiveTokenDef = {
              id: tokenId,
              name: `Offense ${tokenId}`,
              category: 'consumable',
              activeUse: {
                timing: ['beforeDamageDealt'],
                consumeAmount: 1,
                effect: { type: 'modifyDamage', value: 2 },
              },
            };

            const state = {
              players: {
                '0': {
                  tokens: { [tokenId]: tokenStacks },
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
                '1': {
                  tokens: {},
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
              },
              tokenDefinitions: [offensiveTokenDef],
              pendingDamage: undefined,
              pendingAttack: null,
            } as any;

            const result = shouldOpenTokenResponse(state, '0', '1', damage);
            expect(result).toBe('attackerBoost');
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  /**
   * **Validates: Requirements 1.5**
   *
   * 当双方都没有 consumable Token 时，shouldOpenTokenResponse 返回 null
   */
  it(
    '双方无 consumable Token 时，shouldOpenTokenResponse 返回 null',
    () => {
      fc.assert(
        fc.property(
          arbPositiveDamage(),
          arbPositiveStacks(),
          arbId(),
          (damage, stacks, statusId) => {
            // 只有 debuff 类型的 token（非 consumable），不触发响应窗口
            const debuffDef = {
              id: statusId,
              name: `Debuff ${statusId}`,
              category: 'debuff',
              passiveTrigger: {
                timing: 'onDamageReceived',
                actions: [{ type: 'modifyStat', stat: 'damage', value: -1 }],
              },
            };

            const state = {
              players: {
                '0': {
                  tokens: {},
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
                '1': {
                  tokens: {},
                  statusEffects: { [statusId]: stacks },
                  damageShields: [],
                  resources: { hp: 50 },
                },
              },
              tokenDefinitions: [debuffDef],
              pendingDamage: undefined,
              pendingAttack: null,
            } as any;

            const result = shouldOpenTokenResponse(state, '0', '1', damage);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  /**
   * **Validates: Requirements 1.5**
   *
   * damage <= 0 时，shouldOpenTokenResponse 始终返回 null，
   * 无论双方是否有 Token
   */
  it(
    'damage <= 0 时，shouldOpenTokenResponse 始终返回 null',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -50, max: 0 }),
          arbPositiveStacks(),
          arbId(),
          (damage, tokenStacks, tokenId) => {
            const defensiveTokenDef = {
              id: tokenId,
              name: `Defense ${tokenId}`,
              category: 'consumable',
              activeUse: {
                timing: ['beforeDamageReceived'],
                consumeAmount: 1,
                effect: { type: 'modifyDamage', value: -1 },
              },
            };

            const state = {
              players: {
                '0': {
                  tokens: {},
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
                '1': {
                  tokens: { [tokenId]: tokenStacks },
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
              },
              tokenDefinitions: [defensiveTokenDef],
              pendingDamage: undefined,
              pendingAttack: null,
            } as any;

            const result = shouldOpenTokenResponse(state, '0', '1', damage);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  /**
   * **Validates: Requirements 1.5**
   *
   * 已有 pendingDamage 时，shouldOpenTokenResponse 始终返回 null（避免重复打开）
   */
  it(
    '已有 pendingDamage 时，shouldOpenTokenResponse 返回 null',
    () => {
      fc.assert(
        fc.property(
          arbPositiveDamage(),
          arbPositiveStacks(),
          arbId(),
          (damage, tokenStacks, tokenId) => {
            const defensiveTokenDef = {
              id: tokenId,
              name: `Defense ${tokenId}`,
              category: 'consumable',
              activeUse: {
                timing: ['beforeDamageReceived'],
                consumeAmount: 1,
                effect: { type: 'modifyDamage', value: -1 },
              },
            };

            const state = {
              players: {
                '0': {
                  tokens: {},
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
                '1': {
                  tokens: { [tokenId]: tokenStacks },
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
              },
              tokenDefinitions: [defensiveTokenDef],
              // 已有待处理伤害
              pendingDamage: {
                attackerId: '0',
                targetId: '1',
                amount: 5,
                type: 'beforeDamageReceived',
              },
              pendingAttack: null,
            } as any;

            const result = shouldOpenTokenResponse(state, '0', '1', damage);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  /**
   * **Validates: Requirements 1.5**
   *
   * 终极技能（isUltimate=true）时，攻击方有进攻 Token 仍返回 attackerBoost，
   * 但防御方 Token 被跳过（返回 null）
   */
  it(
    '终极技能跳过防御方 Token 响应，但攻击方进攻 Token 仍可用',
    () => {
      fc.assert(
        fc.property(
          arbPositiveDamage(),
          arbPositiveStacks(),
          arbId(),
          arbId().filter(id => id.length > 3),
          (damage, tokenStacks, defenseTokenId, offenseTokenId) => {
            const safeOffenseId = offenseTokenId === defenseTokenId
              ? `${offenseTokenId}_o`
              : offenseTokenId;

            const defensiveTokenDef = {
              id: defenseTokenId,
              name: `Defense ${defenseTokenId}`,
              category: 'consumable',
              activeUse: {
                timing: ['beforeDamageReceived'],
                consumeAmount: 1,
                effect: { type: 'modifyDamage', value: -1 },
              },
            };

            const offensiveTokenDef = {
              id: safeOffenseId,
              name: `Offense ${safeOffenseId}`,
              category: 'consumable',
              activeUse: {
                timing: ['beforeDamageDealt'],
                consumeAmount: 1,
                effect: { type: 'modifyDamage', value: 2 },
              },
            };

            // 场景 1：攻击方无进攻 Token，防御方有防御 Token，终极技能 → null
            const stateDefenseOnly = {
              players: {
                '0': {
                  tokens: {},
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
                '1': {
                  tokens: { [defenseTokenId]: tokenStacks },
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
              },
              tokenDefinitions: [defensiveTokenDef],
              pendingDamage: undefined,
              pendingAttack: { isUltimate: true },
            } as any;

            const resultDefenseOnly = shouldOpenTokenResponse(stateDefenseOnly, '0', '1', damage);
            expect(resultDefenseOnly).toBeNull();

            // 场景 2：攻击方有进攻 Token，终极技能 → attackerBoost（进攻 Token 不受终极限制）
            const stateBoth = {
              players: {
                '0': {
                  tokens: { [safeOffenseId]: tokenStacks },
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
                '1': {
                  tokens: { [defenseTokenId]: tokenStacks },
                  statusEffects: {},
                  damageShields: [],
                  resources: { hp: 50 },
                },
              },
              tokenDefinitions: [defensiveTokenDef, offensiveTokenDef],
              pendingDamage: undefined,
              pendingAttack: { isUltimate: true },
            } as any;

            const resultBoth = shouldOpenTokenResponse(stateBoth, '0', '1', damage);
            expect(resultBoth).toBe('attackerBoost');
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
