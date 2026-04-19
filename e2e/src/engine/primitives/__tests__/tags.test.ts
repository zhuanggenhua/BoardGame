import { describe, it, expect } from 'vitest';
import {
  isTagMatch,
  getParentTag,
  getTagDepth,
  createTagContainer,
  addTag,
  removeTag,
  removeTagsByPattern,
  hasTag,
  getStacks,
  matchTags,
  getTagIds,
  getTagCount,
  getRemovable,
  tickDurations,
} from '../tags';

// ============================================================================
// isTagMatch — 层级前缀匹配
// ============================================================================

describe('isTagMatch', () => {
  it('精确匹配', () => {
    expect(isTagMatch('Status.Debuff.Stun', 'Status.Debuff.Stun')).toBe(true);
  });

  it('前缀匹配', () => {
    expect(isTagMatch('Status.Debuff.Stun', 'Status.Debuff')).toBe(true);
    expect(isTagMatch('Status.Debuff.Stun', 'Status')).toBe(true);
  });

  it('不完整段不匹配', () => {
    expect(isTagMatch('Status.Debuff.Stun', 'Status.De')).toBe(false);
    expect(isTagMatch('Status.Debuff.Stun', 'Status.Debuff.S')).toBe(false);
  });

  it('反向不匹配', () => {
    expect(isTagMatch('Status', 'Status.Debuff')).toBe(false);
  });

  it('不相关 tag 不匹配', () => {
    expect(isTagMatch('Ability.Passive', 'Status')).toBe(false);
  });
});

// ============================================================================
// getParentTag / getTagDepth
// ============================================================================

describe('getParentTag', () => {
  it('多层级返回父级', () => {
    expect(getParentTag('Status.Debuff.Stun')).toBe('Status.Debuff');
  });

  it('顶层返回 undefined', () => {
    expect(getParentTag('Status')).toBeUndefined();
  });
});

describe('getTagDepth', () => {
  it('计算深度', () => {
    expect(getTagDepth('Status')).toBe(1);
    expect(getTagDepth('Status.Debuff')).toBe(2);
    expect(getTagDepth('Status.Debuff.Stun')).toBe(3);
  });
});

// ============================================================================
// 容器操作
// ============================================================================

describe('addTag', () => {
  it('新增 tag', () => {
    const c = addTag(createTagContainer(), 'Status.Debuff.Stun', {
      stacks: 2,
      duration: 3,
      source: 'ability-1',
      removable: true,
    });
    expect(c['Status.Debuff.Stun']).toEqual({
      stacks: 2,
      duration: 3,
      source: 'ability-1',
      removable: true,
    });
  });

  it('默认层数为 1', () => {
    const c = addTag(createTagContainer(), 'Buff.Shield');
    expect(c['Buff.Shield']?.stacks).toBe(1);
  });

  it('stackMode=add 累加层数', () => {
    let c = addTag(createTagContainer(), 'Token.Fire', { stacks: 2 });
    c = addTag(c, 'Token.Fire', { stacks: 3, stackMode: 'add' });
    expect(getStacks(c, 'Token.Fire')).toBe(5);
  });

  it('stackMode=replace 替换层数', () => {
    let c = addTag(createTagContainer(), 'Token.Fire', { stacks: 5 });
    c = addTag(c, 'Token.Fire', { stacks: 2, stackMode: 'replace' });
    expect(getStacks(c, 'Token.Fire')).toBe(2);
  });

  it('stackMode=max 取最大值', () => {
    let c = addTag(createTagContainer(), 'Token.Fire', { stacks: 3 });
    c = addTag(c, 'Token.Fire', { stacks: 2, stackMode: 'max' });
    expect(getStacks(c, 'Token.Fire')).toBe(3);
    c = addTag(c, 'Token.Fire', { stacks: 5, stackMode: 'max' });
    expect(getStacks(c, 'Token.Fire')).toBe(5);
  });

  it('durationMode=replace 替换持续时间', () => {
    let c = addTag(createTagContainer(), 'Buff.A', { duration: 3 });
    c = addTag(c, 'Buff.A', { duration: 5, durationMode: 'replace' });
    expect(c['Buff.A']?.duration).toBe(5);
  });

  it('durationMode=max 取最大持续时间', () => {
    let c = addTag(createTagContainer(), 'Buff.A', { duration: 5 });
    c = addTag(c, 'Buff.A', { duration: 3, durationMode: 'max' });
    expect(c['Buff.A']?.duration).toBe(5);
  });

  it('durationMode=add 累加持续时间', () => {
    let c = addTag(createTagContainer(), 'Buff.A', { duration: 2 });
    c = addTag(c, 'Buff.A', { duration: 3, durationMode: 'add' });
    expect(c['Buff.A']?.duration).toBe(5);
  });

  it('新增没有 duration 的 tag 叠加后变永久', () => {
    let c = addTag(createTagContainer(), 'Buff.A', { duration: 3 });
    c = addTag(c, 'Buff.A'); // 没有 duration → 变永久
    expect(c['Buff.A']?.duration).toBeUndefined();
  });

  it('旧的是永久 → 保持永久', () => {
    let c = addTag(createTagContainer(), 'Buff.A');
    c = addTag(c, 'Buff.A', { duration: 3 });
    expect(c['Buff.A']?.duration).toBeUndefined();
  });
});

describe('removeTag', () => {
  it('完全移除', () => {
    let c = addTag(createTagContainer(), 'Status.Debuff.Stun', { stacks: 3 });
    c = removeTag(c, 'Status.Debuff.Stun');
    expect(c['Status.Debuff.Stun']).toBeUndefined();
  });

  it('减少层数', () => {
    let c = addTag(createTagContainer(), 'Token.Fire', { stacks: 5 });
    c = removeTag(c, 'Token.Fire', 2);
    expect(getStacks(c, 'Token.Fire')).toBe(3);
  });

  it('层数降为 0 时移除', () => {
    let c = addTag(createTagContainer(), 'Token.Fire', { stacks: 2 });
    c = removeTag(c, 'Token.Fire', 2);
    expect(c['Token.Fire']).toBeUndefined();
  });

  it('移除不存在的 tag 返回原容器', () => {
    const c = createTagContainer();
    expect(removeTag(c, 'NonExistent')).toBe(c);
  });
});

describe('removeTagsByPattern', () => {
  it('按前缀批量移除', () => {
    let c = createTagContainer();
    c = addTag(c, 'Status.Debuff.Stun');
    c = addTag(c, 'Status.Debuff.Blinded');
    c = addTag(c, 'Status.Buff.Shield');
    c = removeTagsByPattern(c, 'Status.Debuff');
    expect(getTagIds(c)).toEqual(['Status.Buff.Shield']);
  });
});

// ============================================================================
// 查询
// ============================================================================

describe('hasTag', () => {
  it('精确存在', () => {
    const c = addTag(createTagContainer(), 'Status.Debuff.Stun');
    expect(hasTag(c, 'Status.Debuff.Stun')).toBe(true);
  });

  it('前缀匹配', () => {
    const c = addTag(createTagContainer(), 'Status.Debuff.Stun');
    expect(hasTag(c, 'Status.Debuff')).toBe(true);
    expect(hasTag(c, 'Status')).toBe(true);
  });

  it('不存在', () => {
    const c = addTag(createTagContainer(), 'Ability.Passive');
    expect(hasTag(c, 'Status')).toBe(false);
  });
});

describe('matchTags', () => {
  it('返回所有匹配的 tag', () => {
    let c = createTagContainer();
    c = addTag(c, 'Status.Debuff.Stun', { stacks: 1 });
    c = addTag(c, 'Status.Debuff.Blinded', { stacks: 2 });
    c = addTag(c, 'Status.Buff.Shield', { stacks: 1 });
    const matches = matchTags(c, 'Status.Debuff');
    expect(matches).toHaveLength(2);
    expect(matches.map(([id]) => id).sort()).toEqual([
      'Status.Debuff.Blinded',
      'Status.Debuff.Stun',
    ]);
  });
});

describe('getRemovable', () => {
  it('只返回可移除的 tag', () => {
    let c = createTagContainer();
    c = addTag(c, 'Status.Debuff.Stun', { removable: true });
    c = addTag(c, 'Trait.Undead', { removable: false });
    c = addTag(c, 'Buff.Shield'); // 默认可移除
    const removable = getRemovable(c);
    expect(removable).toHaveLength(2);
    expect(removable.map(([id]) => id).sort()).toEqual([
      'Buff.Shield',
      'Status.Debuff.Stun',
    ]);
  });
});

// ============================================================================
// 回合结算
// ============================================================================

describe('tickDurations', () => {
  it('扣减持续时间', () => {
    let c = createTagContainer();
    c = addTag(c, 'Buff.A', { duration: 3 });
    c = addTag(c, 'Buff.B', { duration: 1 });
    c = addTag(c, 'Buff.C'); // 永久

    const result = tickDurations(c);
    expect(result.expired).toEqual(['Buff.B']);
    expect(result.container['Buff.A']?.duration).toBe(2);
    expect(result.container['Buff.B']).toBeUndefined();
    expect(result.container['Buff.C']).toBeDefined();
    expect(result.container['Buff.C']?.duration).toBeUndefined();
  });

  it('连续 tick 直到全部过期', () => {
    const c = addTag(createTagContainer(), 'Buff.A', { duration: 2 });
    const r1 = tickDurations(c);
    expect(r1.expired).toEqual([]);
    expect(r1.container['Buff.A']?.duration).toBe(1);

    const r2 = tickDurations(r1.container);
    expect(r2.expired).toEqual(['Buff.A']);
    expect(r2.container['Buff.A']).toBeUndefined();
  });
});

// ============================================================================
// 不可变性
// ============================================================================

describe('不可变性', () => {
  it('addTag 不修改原容器', () => {
    const original = createTagContainer();
    addTag(original, 'Buff.A');
    expect(getTagCount(original)).toBe(0);
  });

  it('removeTag 不修改原容器', () => {
    const original = addTag(createTagContainer(), 'Buff.A', { stacks: 3 });
    removeTag(original, 'Buff.A', 1);
    expect(getStacks(original, 'Buff.A')).toBe(3);
  });
});
