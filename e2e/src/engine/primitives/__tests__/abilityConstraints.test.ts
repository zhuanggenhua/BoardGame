import { describe, it, expect } from 'vitest';
import {
  checkAbilityConstraints,
  createConstraintHandlerRegistry,
  registerConstraintHandler,
  type AbilityConstraints,
  type ConstraintContext,
} from '../abilityConstraints';

describe('engine/primitives/abilityConstraints', () => {
  describe('actionCost 约束', () => {
    it('行动次数未满时应通过', () => {
      const constraints: AbilityConstraints = {
        actionCost: { type: 'move', count: 1 },
      };
      const ctx: ConstraintContext = {
        actionCounts: { move: 2 },
        actionLimits: { move: 3 },
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });
    });

    it('行动次数已满时应失败', () => {
      const constraints: AbilityConstraints = {
        actionCost: { type: 'move', count: 1 },
      };
      const ctx: ConstraintContext = {
        actionCounts: { move: 3 },
        actionLimits: { move: 3 },
      };
      const result = checkAbilityConstraints(constraints, ctx);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('move次数已用完');
      expect(result.failedConstraint).toBe('actionCost');
    });

    it('消耗多次行动时应正确计算', () => {
      const constraints: AbilityConstraints = {
        actionCost: { type: 'attack', count: 2 },
      };
      const ctx: ConstraintContext = {
        actionCounts: { attack: 2 },
        actionLimits: { attack: 3 },
      };
      const result = checkAbilityConstraints(constraints, ctx);
      expect(result.valid).toBe(false); // 2 + 2 > 3
    });

    it('没有配置上限时应视为无限制', () => {
      const constraints: AbilityConstraints = {
        actionCost: { type: 'special' },
      };
      const ctx: ConstraintContext = {
        actionCounts: { special: 10 },
        // 没有 actionLimits.special
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });
    });
  });

  describe('entityState 约束', () => {
    it('notMoved: 单位未移动时应通过', () => {
      const constraints: AbilityConstraints = {
        entityState: { notMoved: true },
      };
      const ctx: ConstraintContext = {
        entityState: { hasMoved: false },
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });
    });

    it('notMoved: 单位已移动时应失败', () => {
      const constraints: AbilityConstraints = {
        entityState: { notMoved: true },
      };
      const ctx: ConstraintContext = {
        entityState: { hasMoved: true },
      };
      const result = checkAbilityConstraints(constraints, ctx);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('已移动');
      expect(result.failedConstraint).toBe('entityState.notMoved');
    });

    it('notAttacked: 单位已攻击时应失败', () => {
      const constraints: AbilityConstraints = {
        entityState: { notAttacked: true },
      };
      const ctx: ConstraintContext = {
        entityState: { hasAttacked: true },
      };
      const result = checkAbilityConstraints(constraints, ctx);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('已攻击');
    });

    it('custom: 自定义状态字段检查', () => {
      const constraints: AbilityConstraints = {
        entityState: { custom: { isStunned: false, hp: 10 } },
      };
      const ctx: ConstraintContext = {
        entityState: { isStunned: false, hp: 10 },
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });

      const ctx2: ConstraintContext = {
        entityState: { isStunned: true, hp: 10 },
      };
      const result = checkAbilityConstraints(constraints, ctx2);
      expect(result.valid).toBe(false);
      expect(result.failedConstraint).toBe('entityState.custom.isStunned');
    });

    it('多个状态约束同时检查', () => {
      const constraints: AbilityConstraints = {
        entityState: { notMoved: true, notAttacked: true },
      };
      const ctx: ConstraintContext = {
        entityState: { hasMoved: false, hasAttacked: false },
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });
    });
  });

  describe('resource 约束', () => {
    it('min: 资源足够时应通过', () => {
      const constraints: AbilityConstraints = {
        resource: { charge: { min: 1 } },
      };
      const ctx: ConstraintContext = {
        resources: { charge: 2 },
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });
    });

    it('min: 资源不足时应失败', () => {
      const constraints: AbilityConstraints = {
        resource: { charge: { min: 2 } },
      };
      const ctx: ConstraintContext = {
        resources: { charge: 1 },
      };
      const result = checkAbilityConstraints(constraints, ctx);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('charge不足');
      expect(result.failedConstraint).toBe('resource.charge.min');
    });

    it('max: 资源过多时应失败', () => {
      const constraints: AbilityConstraints = {
        resource: { hp: { max: 5 } },
      };
      const ctx: ConstraintContext = {
        resources: { hp: 10 },
      };
      const result = checkAbilityConstraints(constraints, ctx);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hp过多');
    });

    it('exact: 精确值检查', () => {
      const constraints: AbilityConstraints = {
        resource: { mana: { exact: 5 } },
      };
      const ctx: ConstraintContext = {
        resources: { mana: 5 },
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });

      const ctx2: ConstraintContext = {
        resources: { mana: 4 },
      };
      expect(checkAbilityConstraints(constraints, ctx2).valid).toBe(false);
    });

    it('多个资源同时检查', () => {
      const constraints: AbilityConstraints = {
        resource: {
          charge: { min: 1 },
          magic: { min: 3 },
        },
      };
      const ctx: ConstraintContext = {
        resources: { charge: 2, magic: 5 },
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });
    });

    it('资源缺失时视为 0', () => {
      const constraints: AbilityConstraints = {
        resource: { charge: { min: 1 } },
      };
      const ctx: ConstraintContext = {
        resources: {}, // 没有 charge
      };
      const result = checkAbilityConstraints(constraints, ctx);
      expect(result.valid).toBe(false);
    });
  });

  describe('usageLimit 约束', () => {
    it('perTurn: 未达上限时应通过', () => {
      const constraints: AbilityConstraints = {
        usageLimit: { perTurn: 1 },
      };
      const ctx: ConstraintContext = {
        usageCounts: { perTurn: 0 },
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });
    });

    it('perTurn: 已达上限时应失败', () => {
      const constraints: AbilityConstraints = {
        usageLimit: { perTurn: 1 },
      };
      const ctx: ConstraintContext = {
        usageCounts: { perTurn: 1 },
      };
      const result = checkAbilityConstraints(constraints, ctx);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('每回合只能使用一次');
      expect(result.failedConstraint).toBe('usageLimit.perTurn');
    });

    it('perBattle / perGame 检查', () => {
      const constraints: AbilityConstraints = {
        usageLimit: { perBattle: 3, perGame: 5 },
      };
      const ctx: ConstraintContext = {
        usageCounts: { perBattle: 2, perGame: 4 },
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });

      const ctx2: ConstraintContext = {
        usageCounts: { perBattle: 3, perGame: 4 },
      };
      expect(checkAbilityConstraints(constraints, ctx2).valid).toBe(false);
    });
  });

  describe('custom 约束', () => {
    it('自定义处理器应正确调用', () => {
      const registry = createConstraintHandlerRegistry();
      registerConstraintHandler(registry, 'hasAbility', (params, ctx) => {
        const abilities = ctx.abilities as string[];
        const required = params?.abilityId as string;
        if (!abilities.includes(required)) {
          return { valid: false, error: `缺少技能: ${required}` };
        }
        return { valid: true };
      });

      const constraints: AbilityConstraints = {
        custom: [{ handler: 'hasAbility', params: { abilityId: 'fireball' } }],
      };

      const ctx: ConstraintContext = {
        abilities: ['fireball', 'heal'],
      };
      expect(checkAbilityConstraints(constraints, ctx, registry)).toEqual({ valid: true });

      const ctx2: ConstraintContext = {
        abilities: ['heal'],
      };
      const result = checkAbilityConstraints(constraints, ctx2, registry);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('缺少技能');
    });

    it('未注册的处理器应抛出错误', () => {
      const constraints: AbilityConstraints = {
        custom: [{ handler: 'unknown' }],
      };
      expect(() =>
        checkAbilityConstraints(constraints, {}, createConstraintHandlerRegistry()),
      ).toThrowError('未注册的约束处理器: unknown');
    });

    it('没有 registry 时应抛出错误', () => {
      const constraints: AbilityConstraints = {
        custom: [{ handler: 'test' }],
      };
      expect(() => checkAbilityConstraints(constraints, {})).toThrowError(
        '需要提供 ConstraintHandlerRegistry',
      );
    });
  });

  describe('组合约束', () => {
    it('所有约束都满足时应通过', () => {
      const constraints: AbilityConstraints = {
        actionCost: { type: 'move', count: 1 },
        entityState: { notMoved: true },
        resource: { charge: { min: 1 } },
        usageLimit: { perTurn: 1 },
      };
      const ctx: ConstraintContext = {
        actionCounts: { move: 2 },
        actionLimits: { move: 3 },
        entityState: { hasMoved: false },
        resources: { charge: 2 },
        usageCounts: { perTurn: 0 },
      };
      expect(checkAbilityConstraints(constraints, ctx)).toEqual({ valid: true });
    });

    it('任一约束不满足时应失败', () => {
      const constraints: AbilityConstraints = {
        actionCost: { type: 'move', count: 1 },
        entityState: { notMoved: true },
        resource: { charge: { min: 1 } },
      };
      const ctx: ConstraintContext = {
        actionCounts: { move: 2 },
        actionLimits: { move: 3 },
        entityState: { hasMoved: false },
        resources: { charge: 0 }, // 资源不足
      };
      const result = checkAbilityConstraints(constraints, ctx);
      expect(result.valid).toBe(false);
      expect(result.failedConstraint).toBe('resource.charge.min');
    });

    it('约束为空时应通过', () => {
      expect(checkAbilityConstraints(undefined, {})).toEqual({ valid: true });
      expect(checkAbilityConstraints({}, {})).toEqual({ valid: true });
    });
  });
});
