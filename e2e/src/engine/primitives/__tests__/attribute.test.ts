import { describe, it, expect } from 'vitest';
import {
  createAttributeSet,
  getBase,
  setBase,
  modifyBase,
  getCurrent,
  getAllCurrent,
  addAttributeModifier,
  removeAttributeModifier,
  removeAttributeModifiersBySource,
  removeAllModifiersBySource,
  tickAttributeModifiers,
  getAttributeDef,
  getAttributeIds,
  hasAttribute,
} from '../attribute';
import type { AttributeDef } from '../attribute';

// ============================================================================
// 测试用属性定义
// ============================================================================

const testDefs: AttributeDef[] = [
  { id: 'attack', name: '攻击力', initialValue: 10, min: 0, max: 100 },
  { id: 'defense', name: '防御力', initialValue: 5, min: 0 },
  { id: 'speed', name: '速度', initialValue: 3 },
];

// ============================================================================
// 创建
// ============================================================================

describe('createAttributeSet', () => {
  it('从定义列表创建', () => {
    const set = createAttributeSet(testDefs);
    expect(getAttributeIds(set).sort()).toEqual(['attack', 'defense', 'speed']);
  });

  it('初始值正确', () => {
    const set = createAttributeSet(testDefs);
    expect(getBase(set, 'attack')).toBe(10);
    expect(getBase(set, 'defense')).toBe(5);
    expect(getBase(set, 'speed')).toBe(3);
  });
});

// ============================================================================
// 基础值操作
// ============================================================================

describe('setBase', () => {
  it('设置基础值', () => {
    let set = createAttributeSet(testDefs);
    set = setBase(set, 'attack', 20);
    expect(getBase(set, 'attack')).toBe(20);
  });

  it('不存在的属性返回原集合', () => {
    const set = createAttributeSet(testDefs);
    expect(setBase(set, 'nonexistent', 10)).toBe(set);
  });
});

describe('modifyBase', () => {
  it('增减基础值', () => {
    let set = createAttributeSet(testDefs);
    set = modifyBase(set, 'attack', 5);
    expect(getBase(set, 'attack')).toBe(15);
    set = modifyBase(set, 'attack', -3);
    expect(getBase(set, 'attack')).toBe(12);
  });
});

// ============================================================================
// 当前值计算
// ============================================================================

describe('getCurrent', () => {
  it('无修改器时等于基础值', () => {
    const set = createAttributeSet(testDefs);
    expect(getCurrent(set, 'attack')).toBe(10);
  });

  it('flat 修改器', () => {
    let set = createAttributeSet(testDefs);
    set = addAttributeModifier(set, 'attack', {
      id: 'weapon-enchant',
      type: 'flat',
      value: 5,
    });
    expect(getCurrent(set, 'attack')).toBe(15);
  });

  it('percent 修改器', () => {
    let set = createAttributeSet(testDefs);
    set = addAttributeModifier(set, 'attack', {
      id: 'rage-buff',
      type: 'percent',
      value: 50, // +50%
    });
    expect(getCurrent(set, 'attack')).toBe(15); // 10 * 1.5
  });

  it('flat + percent 组合', () => {
    let set = createAttributeSet(testDefs);
    set = addAttributeModifier(set, 'attack', {
      id: 'flat-bonus',
      type: 'flat',
      value: 10,
    });
    set = addAttributeModifier(set, 'attack', {
      id: 'pct-buff',
      type: 'percent',
      value: 50,
    });
    // base(10) + flat(10) = 20, * 1.5 = 30
    expect(getCurrent(set, 'attack')).toBe(30);
  });

  it('钳制到 max', () => {
    let set = createAttributeSet(testDefs);
    set = addAttributeModifier(set, 'attack', {
      id: 'huge-buff',
      type: 'flat',
      value: 200,
    });
    expect(getCurrent(set, 'attack')).toBe(100); // max=100
  });

  it('钳制到 min', () => {
    let set = createAttributeSet(testDefs);
    set = addAttributeModifier(set, 'attack', {
      id: 'debuff',
      type: 'flat',
      value: -50,
    });
    expect(getCurrent(set, 'attack')).toBe(0); // min=0
  });

  it('不存在的属性返回 0', () => {
    const set = createAttributeSet(testDefs);
    expect(getCurrent(set, 'nonexistent')).toBe(0);
  });
});

describe('getAllCurrent', () => {
  it('批量获取所有当前值', () => {
    let set = createAttributeSet(testDefs);
    set = addAttributeModifier(set, 'attack', {
      id: 'buff',
      type: 'flat',
      value: 5,
    });
    const all = getAllCurrent(set);
    expect(all['attack']).toBe(15);
    expect(all['defense']).toBe(5);
    expect(all['speed']).toBe(3);
  });
});

// ============================================================================
// 修改器管理
// ============================================================================

describe('removeAttributeModifier', () => {
  it('移除后恢复原值', () => {
    let set = createAttributeSet(testDefs);
    set = addAttributeModifier(set, 'attack', {
      id: 'buff',
      type: 'flat',
      value: 10,
    });
    expect(getCurrent(set, 'attack')).toBe(20);

    set = removeAttributeModifier(set, 'attack', 'buff');
    expect(getCurrent(set, 'attack')).toBe(10);
  });
});

describe('removeAttributeModifiersBySource', () => {
  it('按来源移除单属性修改器', () => {
    let set = createAttributeSet(testDefs);
    set = addAttributeModifier(set, 'attack', {
      id: 'a',
      type: 'flat',
      value: 5,
      source: 'spell-1',
    });
    set = addAttributeModifier(set, 'attack', {
      id: 'b',
      type: 'flat',
      value: 3,
      source: 'spell-2',
    });
    set = removeAttributeModifiersBySource(set, 'attack', 'spell-1');
    expect(getCurrent(set, 'attack')).toBe(13); // 10 + 3
  });
});

describe('removeAllModifiersBySource', () => {
  it('按来源移除所有属性上的修改器', () => {
    let set = createAttributeSet(testDefs);
    set = addAttributeModifier(set, 'attack', {
      id: 'a',
      type: 'flat',
      value: 5,
      source: 'aura',
    });
    set = addAttributeModifier(set, 'defense', {
      id: 'b',
      type: 'flat',
      value: 3,
      source: 'aura',
    });
    set = addAttributeModifier(set, 'speed', {
      id: 'c',
      type: 'flat',
      value: 2,
      source: 'other',
    });

    set = removeAllModifiersBySource(set, 'aura');
    expect(getCurrent(set, 'attack')).toBe(10);
    expect(getCurrent(set, 'defense')).toBe(5);
    expect(getCurrent(set, 'speed')).toBe(5); // 3 + 2（other 保留）
  });

  it('无变更时返回原集合', () => {
    const set = createAttributeSet(testDefs);
    expect(removeAllModifiersBySource(set, 'nonexistent')).toBe(set);
  });
});

// ============================================================================
// 回合结算
// ============================================================================

describe('tickAttributeModifiers', () => {
  it('对所有属性执行 tick', () => {
    let set = createAttributeSet(testDefs);
    set = addAttributeModifier(set, 'attack', {
      id: 'temp-buff',
      type: 'flat',
      value: 10,
      duration: 1,
    });
    set = addAttributeModifier(set, 'defense', {
      id: 'shield',
      type: 'flat',
      value: 5,
      duration: 2,
    });

    const result = tickAttributeModifiers(set);
    expect(result.expired).toEqual({
      attack: ['temp-buff'],
    });
    // attack 修改器已过期
    expect(getCurrent(result.set, 'attack')).toBe(10);
    // defense 修改器还有 1 回合
    expect(getCurrent(result.set, 'defense')).toBe(10);
  });
});

// ============================================================================
// 查询
// ============================================================================

describe('查询', () => {
  it('getAttributeDef', () => {
    const set = createAttributeSet(testDefs);
    expect(getAttributeDef(set, 'attack')?.name).toBe('攻击力');
    expect(getAttributeDef(set, 'nonexistent')).toBeUndefined();
  });

  it('hasAttribute', () => {
    const set = createAttributeSet(testDefs);
    expect(hasAttribute(set, 'attack')).toBe(true);
    expect(hasAttribute(set, 'nonexistent')).toBe(false);
  });
});

// ============================================================================
// 不可变性
// ============================================================================

describe('不可变性', () => {
  it('setBase 不修改原集合', () => {
    const original = createAttributeSet(testDefs);
    setBase(original, 'attack', 99);
    expect(getBase(original, 'attack')).toBe(10);
  });

  it('addAttributeModifier 不修改原集合', () => {
    const original = createAttributeSet(testDefs);
    addAttributeModifier(original, 'attack', {
      id: 'buff',
      type: 'flat',
      value: 99,
    });
    expect(getCurrent(original, 'attack')).toBe(10);
  });
});
