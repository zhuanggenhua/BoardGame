import { describe, it, expect } from 'vitest';
import {
  AbilityRegistry,
  AbilityExecutorRegistry,
  createAbilityRegistry,
  createAbilityExecutorRegistry,
  checkAbilityCost,
  filterByTags,
  checkAbilityCondition,
  createConditionHandlerRegistry,
  registerConditionHandler,
  type AbilityDef,
  type AbilityContext,
  type AbilityResult,
} from '../index';

// ============================================================================
// 测试用类型
// ============================================================================

interface TestEffect {
  type: string;
  value: number;
}

type TestTrigger = 'onAttack' | 'onDefend' | 'passive';

type TestDef = AbilityDef<TestEffect, TestTrigger>;

interface TestCtx extends AbilityContext {
  state: { hp: number };
}

interface TestEvent {
  type: string;
  payload: unknown;
}

// 测试数据
const slash: TestDef = {
  id: 'slash',
  name: '斩击',
  trigger: 'onAttack',
  effects: [{ type: 'damage', value: 3 }],
  tags: ['offensive'],
  cost: { mana: 2 },
};

const heal: TestDef = {
  id: 'heal',
  name: '治疗',
  trigger: 'onDefend',
  effects: [{ type: 'heal', value: 5 }],
  tags: ['defensive'],
  cost: { mana: 3 },
};

const rage: TestDef = {
  id: 'rage',
  name: '狂怒',
  trigger: 'passive',
  effects: [{ type: 'buff', value: 2 }],
  tags: ['offensive', 'ultimate'],
};

const basicAttack: TestDef = {
  id: 'basic-attack',
  name: '普攻',
  trigger: 'onAttack',
  effects: [{ type: 'damage', value: 1 }],
};

// ============================================================================
// AbilityRegistry
// ============================================================================
describe('engine/primitives/ability — AbilityRegistry', () => {
  it('register + get', () => {
    const reg = new AbilityRegistry<TestDef>('test');
    reg.register(slash);
    expect(reg.get('slash')).toBe(slash);
    expect(reg.get('nonexistent')).toBeUndefined();
  });

  it('registerAll + getAll', () => {
    const reg = new AbilityRegistry<TestDef>();
    reg.registerAll([slash, heal, rage]);
    expect(reg.getAll()).toHaveLength(3);
    expect(reg.size).toBe(3);
  });

  it('has', () => {
    const reg = new AbilityRegistry<TestDef>();
    reg.register(slash);
    expect(reg.has('slash')).toBe(true);
    expect(reg.has('nonexistent')).toBe(false);
  });

  it('getByTag', () => {
    const reg = new AbilityRegistry<TestDef>();
    reg.registerAll([slash, heal, rage]);
    const offensive = reg.getByTag('offensive');
    expect(offensive).toHaveLength(2);
    expect(offensive.map(d => d.id)).toContain('slash');
    expect(offensive.map(d => d.id)).toContain('rage');

    const defensive = reg.getByTag('defensive');
    expect(defensive).toHaveLength(1);
    expect(defensive[0].id).toBe('heal');
  });

  it('getByTrigger', () => {
    const reg = new AbilityRegistry<TestDef>();
    reg.registerAll([slash, heal, rage, basicAttack]);
    const attacks = reg.getByTrigger('onAttack');
    expect(attacks).toHaveLength(2);
    expect(attacks.map(d => d.id)).toEqual(['slash', 'basic-attack']);
  });

  it('getRegisteredIds', () => {
    const reg = new AbilityRegistry<TestDef>();
    reg.registerAll([slash, heal]);
    const ids = reg.getRegisteredIds();
    expect(ids).toEqual(new Set(['slash', 'heal']));
  });

  it('重复注册应覆盖', () => {
    const reg = new AbilityRegistry<TestDef>();
    reg.register(slash);
    const updated: TestDef = { ...slash, name: '强斩击' };
    reg.register(updated);
    expect(reg.get('slash')?.name).toBe('强斩击');
    expect(reg.size).toBe(1);
  });

  it('clear', () => {
    const reg = new AbilityRegistry<TestDef>();
    reg.registerAll([slash, heal]);
    reg.clear();
    expect(reg.size).toBe(0);
    expect(reg.getAll()).toEqual([]);
  });

  it('getByTag 对无 tags 的定义不报错', () => {
    const reg = new AbilityRegistry<TestDef>();
    reg.register(basicAttack); // 无 tags
    expect(reg.getByTag('offensive')).toEqual([]);
  });

  it('工厂函数 createAbilityRegistry', () => {
    const reg = createAbilityRegistry<TestDef>('factory');
    reg.register(slash);
    expect(reg.get('slash')).toBe(slash);
  });
});

// ============================================================================
// AbilityExecutorRegistry
// ============================================================================
describe('engine/primitives/ability — AbilityExecutorRegistry', () => {
  const dummyExecutor = (ctx: TestCtx): AbilityResult<TestEvent> => ({
    events: [{ type: 'test', payload: ctx.sourceId }],
  });

  const anotherExecutor = (ctx: TestCtx): AbilityResult<TestEvent> => ({
    events: [{ type: 'other', payload: ctx.ownerId }],
  });

  it('register + resolve（纯 id）', () => {
    const reg = new AbilityExecutorRegistry<TestCtx, TestEvent>('test');
    reg.register('soul_transfer', dummyExecutor);
    const executor = reg.resolve('soul_transfer');
    expect(executor).toBe(dummyExecutor);
    expect(reg.resolve('nonexistent')).toBeUndefined();
  });

  it('register + resolve（id + tag）', () => {
    const reg = new AbilityExecutorRegistry<TestCtx, TestEvent>();
    reg.register('ninja', dummyExecutor, 'onPlay');
    reg.register('ninja', anotherExecutor, 'talent');

    expect(reg.resolve('ninja', 'onPlay')).toBe(dummyExecutor);
    expect(reg.resolve('ninja', 'talent')).toBe(anotherExecutor);
    expect(reg.resolve('ninja')).toBeUndefined(); // 纯 id 未注册
  });

  it('has', () => {
    const reg = new AbilityExecutorRegistry<TestCtx, TestEvent>();
    reg.register('fire', dummyExecutor, 'onPlay');
    expect(reg.has('fire', 'onPlay')).toBe(true);
    expect(reg.has('fire', 'talent')).toBe(false);
    expect(reg.has('fire')).toBe(false);
  });

  it('getRegisteredIds', () => {
    const reg = new AbilityExecutorRegistry<TestCtx, TestEvent>();
    reg.register('a', dummyExecutor);
    reg.register('b', dummyExecutor, 'onPlay');
    const ids = reg.getRegisteredIds();
    expect(ids).toEqual(new Set(['a', 'b::onPlay']));
  });

  it('size + clear', () => {
    const reg = new AbilityExecutorRegistry<TestCtx, TestEvent>();
    reg.register('a', dummyExecutor);
    reg.register('b', dummyExecutor, 'tag1');
    expect(reg.size).toBe(2);
    reg.clear();
    expect(reg.size).toBe(0);
  });

  it('执行器返回正确结果', () => {
    const reg = new AbilityExecutorRegistry<TestCtx, TestEvent>();
    reg.register('test-ability', dummyExecutor);
    const executor = reg.resolve('test-ability')!;
    const result = executor({ sourceId: 'unit-1', ownerId: 'p0', timestamp: 100, state: { hp: 20 } });
    expect(result.events).toEqual([{ type: 'test', payload: 'unit-1' }]);
  });

  it('工厂函数 createAbilityExecutorRegistry', () => {
    const reg = createAbilityExecutorRegistry<TestCtx, TestEvent>('factory');
    reg.register('x', dummyExecutor);
    expect(reg.resolve('x')).toBe(dummyExecutor);
  });
});

// ============================================================================
// 可用性检查工具函数
// ============================================================================
describe('engine/primitives/ability — checkAbilityCost', () => {
  it('无 cost 应返回 true', () => {
    expect(checkAbilityCost({ cost: undefined }, {})).toBe(true);
    expect(checkAbilityCost({}, { mana: 10 })).toBe(true);
  });

  it('资源足够应返回 true', () => {
    expect(checkAbilityCost(slash, { mana: 5 })).toBe(true);
    expect(checkAbilityCost(slash, { mana: 2 })).toBe(true);
  });

  it('资源不足应返回 false', () => {
    expect(checkAbilityCost(slash, { mana: 1 })).toBe(false);
    expect(checkAbilityCost(slash, {})).toBe(false);
  });

  it('多种资源消耗', () => {
    const def = { cost: { mana: 2, gold: 3 } };
    expect(checkAbilityCost(def, { mana: 5, gold: 5 })).toBe(true);
    expect(checkAbilityCost(def, { mana: 5, gold: 1 })).toBe(false);
    expect(checkAbilityCost(def, { mana: 1, gold: 5 })).toBe(false);
  });
});

describe('engine/primitives/ability — filterByTags', () => {
  const defs = [slash, heal, rage, basicAttack];

  it('空 blockedTags 返回全部', () => {
    expect(filterByTags(defs, [])).toEqual(defs);
    expect(filterByTags(defs, new Set())).toEqual(defs);
  });

  it('过滤包含被阻塞标签的定义', () => {
    const result = filterByTags(defs, ['ultimate']);
    expect(result.map(d => d.id)).toEqual(['slash', 'heal', 'basic-attack']);
  });

  it('多个阻塞标签', () => {
    const result = filterByTags(defs, new Set(['offensive', 'defensive']));
    // rage 有 offensive+ultimate, slash 有 offensive, heal 有 defensive
    // 只剩 basicAttack（无 tags）
    expect(result.map(d => d.id)).toEqual(['basic-attack']);
  });

  it('无 tags 的定义不被过滤', () => {
    const result = filterByTags([basicAttack], ['offensive']);
    expect(result).toEqual([basicAttack]);
  });
});

describe('engine/primitives/ability — checkAbilityCondition', () => {
  it('无条件应返回 true', () => {
    expect(checkAbilityCondition({}, {})).toBe(true);
    expect(checkAbilityCondition({ condition: undefined }, {})).toBe(true);
  });

  it('always 条件应返回 true', () => {
    expect(checkAbilityCondition({ condition: { type: 'always' } }, {})).toBe(true);
  });

  it('compare 条件应正确评估', () => {
    const defWithCondition = {
      condition: { type: 'compare' as const, op: 'gte' as const, left: 'hp', right: 5 },
    };
    expect(checkAbilityCondition(defWithCondition, { hp: 10 })).toBe(true);
    expect(checkAbilityCondition(defWithCondition, { hp: 3 })).toBe(false);
  });

  it('支持自定义条件处理器', () => {
    const registry = createConditionHandlerRegistry();
    registerConditionHandler(registry, 'hasBuff', (params: Record<string, unknown> | undefined) => {
      return params?.active === true;
    });

    const def = {
      condition: { type: 'custom' as const, handler: 'hasBuff', params: { active: true } },
    };
    expect(checkAbilityCondition(def, {}, registry)).toBe(true);
  });
});
