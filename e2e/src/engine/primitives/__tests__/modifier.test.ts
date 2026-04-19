import { describe, it, expect } from 'vitest';
import {
  createModifierStack,
  addModifier,
  addModifiers,
  removeModifier,
  removeModifiersBySource,
  getModifier,
  getModifiersBySource,
  getAllModifiers,
  getModifierCount,
  applyModifiers,
  computeModifiedValue,
  tickModifiers,
} from '../modifier';
import type { ModifierDef } from '../modifier';

// ============================================================================
// 容器操作
// ============================================================================

describe('createModifierStack', () => {
  it('创建空栈', () => {
    const stack = createModifierStack();
    expect(getModifierCount(stack)).toBe(0);
  });
});

describe('addModifier', () => {
  it('添加修改器', () => {
    const stack = addModifier(createModifierStack(), {
      id: 'mod-1',
      type: 'flat',
      value: 10,
    });
    expect(getModifierCount(stack)).toBe(1);
    expect(getModifier(stack, 'mod-1')?.value).toBe(10);
  });

  it('重复 ID 覆盖', () => {
    let stack = addModifier(createModifierStack(), {
      id: 'mod-1',
      type: 'flat',
      value: 10,
    });
    stack = addModifier(stack, {
      id: 'mod-1',
      type: 'flat',
      value: 20,
    });
    expect(getModifierCount(stack)).toBe(1);
    expect(getModifier(stack, 'mod-1')?.value).toBe(20);
  });
});

describe('addModifiers', () => {
  it('批量添加', () => {
    const stack = addModifiers(createModifierStack(), [
      { id: 'a', type: 'flat', value: 1 },
      { id: 'b', type: 'flat', value: 2 },
    ]);
    expect(getModifierCount(stack)).toBe(2);
  });
});

describe('removeModifier', () => {
  it('移除修改器', () => {
    let stack = addModifier(createModifierStack(), {
      id: 'mod-1',
      type: 'flat',
      value: 10,
    });
    stack = removeModifier(stack, 'mod-1');
    expect(getModifierCount(stack)).toBe(0);
  });

  it('移除不存在的返回原容器', () => {
    const stack = createModifierStack();
    expect(removeModifier(stack, 'non-existent')).toBe(stack);
  });
});

describe('removeModifiersBySource', () => {
  it('按来源移除', () => {
    let stack = addModifiers(createModifierStack(), [
      { id: 'a', type: 'flat', value: 1, source: 'buff-1' },
      { id: 'b', type: 'flat', value: 2, source: 'buff-1' },
      { id: 'c', type: 'flat', value: 3, source: 'buff-2' },
    ]);
    stack = removeModifiersBySource(stack, 'buff-1');
    expect(getModifierCount(stack)).toBe(1);
    expect(getModifier(stack, 'c')?.value).toBe(3);
  });
});

// ============================================================================
// 查询
// ============================================================================

describe('getModifiersBySource', () => {
  it('按来源查询', () => {
    const stack = addModifiers(createModifierStack(), [
      { id: 'a', type: 'flat', value: 1, source: 'buff-1' },
      { id: 'b', type: 'flat', value: 2, source: 'buff-2' },
      { id: 'c', type: 'flat', value: 3, source: 'buff-1' },
    ]);
    const mods = getModifiersBySource(stack, 'buff-1');
    expect(mods).toHaveLength(2);
    expect(mods.map(m => m.id)).toEqual(['a', 'c']);
  });
});

describe('getAllModifiers', () => {
  it('返回所有修改器', () => {
    const stack = addModifiers(createModifierStack(), [
      { id: 'a', type: 'flat', value: 1 },
      { id: 'b', type: 'percent', value: 50 },
    ]);
    expect(getAllModifiers(stack)).toHaveLength(2);
  });
});

// ============================================================================
// 管线执行
// ============================================================================

describe('applyModifiers', () => {
  it('flat 加算', () => {
    const stack = addModifier(createModifierStack(), {
      id: 'flat-1',
      type: 'flat',
      value: 5,
    });
    const result = applyModifiers(stack, 10);
    expect(result.finalValue).toBe(15);
    expect(result.appliedIds).toEqual(['flat-1']);
  });

  it('percent 百分比乘算', () => {
    const stack = addModifier(createModifierStack(), {
      id: 'pct-1',
      type: 'percent',
      value: 50, // +50%
    });
    const result = applyModifiers(stack, 100);
    expect(result.finalValue).toBe(150);
  });

  it('override 覆盖', () => {
    const stack = addModifiers(createModifierStack(), [
      { id: 'flat-1', type: 'flat', value: 100 },
      { id: 'override-1', type: 'override', value: 42 },
    ]);
    const result = applyModifiers(stack, 10);
    expect(result.finalValue).toBe(42);
  });

  it('compute 自定义计算', () => {
    interface TestCtx { multiplier: number }
    const stack = addModifier<TestCtx>(createModifierStack<TestCtx>(), {
      id: 'compute-1',
      type: 'compute',
      computeFn: (val, ctx) => val * ctx.multiplier,
    });
    const result = applyModifiers(stack, 10, { multiplier: 3 });
    expect(result.finalValue).toBe(30);
  });

  it('同优先级按 type 排序：flat → percent → override', () => {
    const stack = addModifiers(createModifierStack(), [
      { id: 'pct', type: 'percent', value: 100 }, // 应该在 flat 之后
      { id: 'flat', type: 'flat', value: 10 },     // 先执行
    ]);
    // base=10, +flat(10)=20, *percent(100%)=40
    const result = applyModifiers(stack, 10);
    expect(result.finalValue).toBe(40);
    expect(result.appliedIds).toEqual(['flat', 'pct']);
  });

  it('不同优先级按 priority 升序', () => {
    const stack = addModifiers(createModifierStack(), [
      { id: 'late', type: 'flat', value: 5, priority: 10 },
      { id: 'early', type: 'flat', value: 3, priority: 1 },
    ]);
    const result = applyModifiers(stack, 0);
    expect(result.finalValue).toBe(8);
    expect(result.appliedIds).toEqual(['early', 'late']);
  });

  it('条件不满足时跳过', () => {
    interface TestCtx { isFireType: boolean }
    const stack = addModifier<TestCtx>(createModifierStack<TestCtx>(), {
      id: 'fire-bonus',
      type: 'flat',
      value: 10,
      condition: (ctx) => ctx.isFireType,
    });
    const r1 = applyModifiers(stack, 100, { isFireType: false });
    expect(r1.finalValue).toBe(100);
    expect(r1.skippedIds).toEqual(['fire-bonus']);

    const r2 = applyModifiers(stack, 100, { isFireType: true });
    expect(r2.finalValue).toBe(110);
    expect(r2.appliedIds).toEqual(['fire-bonus']);
  });

  it('空栈返回 baseValue', () => {
    const result = applyModifiers(createModifierStack(), 42);
    expect(result.finalValue).toBe(42);
  });
});

describe('computeModifiedValue', () => {
  it('只返回最终值', () => {
    const stack = addModifier(createModifierStack(), {
      id: 'flat-1',
      type: 'flat',
      value: 5,
    });
    expect(computeModifiedValue(stack, 10)).toBe(15);
  });
});

// ============================================================================
// 复杂管线场景
// ============================================================================

describe('复杂管线', () => {
  it('DiceThrone 场景：base dmg + flat bonus + percent buff + 条件减伤', () => {
    interface CombatCtx { targetHasShield: boolean }
    const stack = addModifiers<CombatCtx>(createModifierStack<CombatCtx>(), [
      // 基础加成
      { id: 'weapon-bonus', type: 'flat', value: 3, priority: 0 },
      // 百分比 buff
      { id: 'rage-buff', type: 'percent', value: 50, priority: 0 },
      // 条件减伤（目标有盾时 -5）
      {
        id: 'shield-reduction',
        type: 'flat',
        value: -5,
        priority: 10,
        condition: (ctx) => ctx.targetHasShield,
      },
    ]);

    // 无盾：base(10) + flat(3) = 13 → *1.5 = 19.5
    const r1 = applyModifiers(stack, 10, { targetHasShield: false });
    expect(r1.finalValue).toBe(19.5);

    // 有盾：base(10) + flat(3) = 13 → *1.5 = 19.5 → flat(-5) = 14.5
    const r2 = applyModifiers(stack, 10, { targetHasShield: true });
    expect(r2.finalValue).toBe(14.5);
  });

  it('SmashUp 场景：power 计算用 compute', () => {
    interface SmashCtx { minionsOnBase: number }
    const defs: ModifierDef<SmashCtx>[] = [
      {
        id: 'war-raptor-ongoing',
        type: 'compute',
        computeFn: (val, ctx) => val + ctx.minionsOnBase,
        source: 'war-raptor',
      },
    ];
    const stack = addModifiers(createModifierStack<SmashCtx>(), defs);
    expect(computeModifiedValue(stack, 3, { minionsOnBase: 4 })).toBe(7);
  });
});

// ============================================================================
// 回合结算
// ============================================================================

describe('tickModifiers', () => {
  it('扣减持续时间并移除到期的', () => {
    const stack = addModifiers(createModifierStack(), [
      { id: 'a', type: 'flat', value: 1, duration: 3 },
      { id: 'b', type: 'flat', value: 2, duration: 1 },
      { id: 'c', type: 'flat', value: 3 }, // 永久
    ]);

    const result = tickModifiers(stack);
    expect(result.expired).toEqual(['b']);
    expect(getModifierCount(result.stack)).toBe(2);
    expect(getModifier(result.stack, 'a')?.duration).toBe(2);
    expect(getModifier(result.stack, 'c')?.duration).toBeUndefined();
  });
});

// ============================================================================
// 不可变性
// ============================================================================

describe('不可变性', () => {
  it('addModifier 不修改原栈', () => {
    const original = createModifierStack();
    addModifier(original, { id: 'a', type: 'flat', value: 1 });
    expect(getModifierCount(original)).toBe(0);
  });

  it('removeModifier 不修改原栈', () => {
    const original = addModifier(createModifierStack(), {
      id: 'a',
      type: 'flat',
      value: 1,
    });
    removeModifier(original, 'a');
    expect(getModifierCount(original)).toBe(1);
  });
});
