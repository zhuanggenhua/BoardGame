import { describe, it, expect, vi } from 'vitest';
import {
  AbilityRegistry,
  AbilityExecutorRegistry,
  createAbilityRegistry,
  createAbilityExecutorRegistry,
  checkAbilityCost,
  filterByTags,
  checkAbilityCondition,
  buildOpportunityFromAbilityDef,
  createAbilityChoiceContract,
  createAbilityOpportunity,
  createConditionHandlerRegistry,
  registerConditionHandler,
  type AbilityDef,
  type AbilityContext,
  type AbilityResult,
} from '../index';
import {
  buildChoiceRequestFromOpportunity,
  createTimingPoint,
  validateOpportunity,
} from '../../TimingOpportunity';

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

// ============================================================================
// AbilityDef -> Opportunity 生命周期投影
// ============================================================================
describe('engine/primitives/ability — buildOpportunityFromAbilityDef', () => {
  const timing = createTimingPoint({
    gameId: 'test-game',
    position: 'after',
    factKind: 'attack',
    timestamp: 10,
    parentFrameId: 'combat-frame',
  });

  it('把能力生命周期阶段投影为对应 Opportunity class', () => {
    const def: TestDef = {
      id: 'shield-form',
      name: '护盾形态',
      trigger: 'onDefend',
      effects: [{ type: 'buff', value: 1 }],
    };

    const cases = [
      ['trigger', 'mandatory'],
      ['response', 'response'],
      ['replacement', 'replacement'],
      ['prevention', 'prevention'],
      ['continuous', 'continuous'],
      ['delayed', 'delayed'],
      ['activation', 'optional'],
    ] as const;

    for (const [phase, expectedClass] of cases) {
      const opportunity = buildOpportunityFromAbilityDef({
        def,
        timing,
        lifecycle: {
          sourceId: `source-${phase}`,
          controllerId: 'p1',
          phase,
        },
      });

      expect(opportunity.class).toBe(expectedClass);
      expect(opportunity.resolution).toEqual({ type: 'none' });
      expect(opportunity.sourceRef.metadata).toMatchObject({
        abilityId: 'shield-form',
        abilityLifecyclePhase: phase,
        abilityTrigger: 'onDefend',
        effectCount: 1,
      });
    }
  });

  it('保留来源、控制者、费用、目标、ChoiceRequest 和 AI 合同', () => {
    const def: TestDef = {
      id: 'precise-strike',
      name: '精准打击',
      trigger: 'onAttack',
      condition: { type: 'compare', op: 'gte', left: 'mana', right: 2 },
      effects: [{ type: 'damage', value: 3 }],
      tags: ['offensive'],
      cost: { mana: 2 },
    };

    const opportunity = buildOpportunityFromAbilityDef({
      def,
      timing,
      lifecycle: {
        sourceId: 'card-7',
        sourceKind: 'card',
        controllerId: 'p1',
        ownerId: 'p1',
        phase: 'activation',
      },
      conditionContext: { mana: 2 },
      targetRequest: {
        kind: 'select-object',
        min: 1,
        max: 1,
        description: '选择攻击目标',
      },
      resolution: { type: 'choice-request' },
      choice: {
        kind: 'select-object',
        candidates: [{
          id: 'target-p2',
          label: '目标玩家',
          commands: [{
            type: 'USE_ABILITY',
            payload: { abilityId: 'precise-strike', targetId: 'p2' },
          }],
        }],
        selection: { min: 1, max: 1 },
        resolution: { type: 'candidate-commands' },
        ai: { status: 'shared-policy' },
      },
      metadata: { priority: 8 },
    });

    expect(opportunity).toMatchObject({
      sourceRef: {
        kind: 'card',
        id: 'card-7',
        ownerId: 'p1',
        controllerId: 'p1',
      },
      controllerId: 'p1',
      class: 'optional',
      condition: { satisfied: true },
      cost: {
        kind: 'resource',
        paid: false,
        refundable: true,
        metadata: { resources: { mana: 2 } },
      },
      targetRequest: { kind: 'select-object', min: 1, max: 1 },
      aiSupport: undefined,
      metadata: {
        abilityId: 'precise-strike',
        abilityLifecyclePhase: 'activation',
        abilityTags: ['offensive'],
        priority: 8,
      },
    });
    expect(validateOpportunity(opportunity).filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    expect(buildChoiceRequestFromOpportunity(opportunity)).toMatchObject({
      requestId: opportunity.id,
      playerId: 'p1',
      ownerFrameId: 'combat-frame',
      sourceId: 'card-7',
      metadata: {
        opportunityId: opportunity.id,
        timingPointId: timing.id,
        opportunityClass: 'optional',
        abilityId: 'precise-strike',
      },
    });
  });

  it('用共享 helper 生成能力 ChoiceRequest 合同和候选 provenance', () => {
    const def: TestDef = {
      id: 'precise-strike',
      name: '精准打击',
      trigger: 'onAttack',
      effects: [{ type: 'damage', value: 3 }],
      tags: ['offensive'],
    };
    const lifecycle = {
      sourceId: 'card-7',
      sourceKind: 'card' as const,
      controllerId: 'p1',
      ownerId: 'p1',
      phase: 'activation' as const,
    };
    const targetRequest = {
      kind: 'select-object' as const,
      min: 1,
      max: 1,
      description: '选择攻击目标',
    };

    const opportunity = buildOpportunityFromAbilityDef({
      def,
      timing,
      lifecycle,
      targetRequest,
      resolution: { type: 'choice-request' },
      choice: createAbilityChoiceContract({
        def,
        lifecycle,
        targetRequest,
        candidates: [{
          id: 'target-p2',
          label: '目标玩家',
          commands: [{
            type: 'USE_ABILITY',
            payload: { abilityId: 'precise-strike', targetId: 'p2' },
          }],
        }],
        resolution: { type: 'candidate-commands' },
        ai: { status: 'shared-policy' },
      }),
    });

    const request = buildChoiceRequestFromOpportunity(opportunity);
    expect(request).toMatchObject({
      requestId: opportunity.id,
      playerId: 'p1',
      kind: 'select-object',
      selection: { min: 1, max: 1 },
      metadata: {
        opportunityId: opportunity.id,
        abilityId: 'precise-strike',
        abilityLifecyclePhase: 'activation',
        abilitySourceId: 'card-7',
      },
    });
    expect(request.candidates[0]).toMatchObject({
      id: 'target-p2',
      metadata: {
        abilityId: 'precise-strike',
        abilityLifecyclePhase: 'activation',
        abilitySourceId: 'card-7',
        abilityControllerId: 'p1',
      },
      actionKeyParts: ['ability', 'activation', 'card-7', 'precise-strike', 'base', 'target-p2'],
    });
  });

  it('共享 helper 不猜未知目标类型，避免生成不可验证 ChoiceRequest', () => {
    const def: TestDef = {
      id: 'scripted-mode',
      name: '脚本模式',
      trigger: 'onAttack',
      effects: [{ type: 'damage', value: 1 }],
    };

    expect(() => createAbilityChoiceContract({
      def,
      lifecycle: {
        sourceId: 'card-9',
        controllerId: 'p1',
        phase: 'activation',
      },
      targetRequest: {
        kind: 'game-specific-mode',
        min: 1,
        max: 1,
      },
      candidates: [{ id: 'mode-a' }],
      resolution: { type: 'candidate-commands' },
    })).toThrow('Ability scripted-mode 缺少可投影为 ChoiceRequest 的 choice kind');
  });

  it('条件不成立时产出 inactive opportunity，由统一诊断暴露', () => {
    const def: TestDef = {
      id: 'last-stand',
      name: '背水一战',
      trigger: 'onDefend',
      condition: { type: 'compare', op: 'lte', left: 'hp', right: 3 },
      effects: [{ type: 'buff', value: 4 }],
    };

    const opportunity = createAbilityOpportunity({
      def,
      timing,
      lifecycle: {
        sourceId: 'hero-1',
        controllerId: 'p1',
        phase: 'trigger',
      },
      conditionContext: { hp: 8 },
    });

    expect(opportunity.condition).toEqual({
      satisfied: false,
      reason: 'Ability last-stand 条件不成立',
    });
    expect(validateOpportunity(opportunity)).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'inactive-opportunity',
    }));
  });

  it('只产出合同，不执行效果、不写运行时状态', () => {
    const effect = vi.fn();
    const def: AbilityDef<(() => void), TestTrigger> = {
      id: 'scripted-effect',
      name: '脚本效果',
      trigger: 'onAttack',
      effects: [effect],
    };

    const opportunity = buildOpportunityFromAbilityDef({
      def,
      timing,
      lifecycle: {
        sourceId: 'card-8',
        controllerId: 'p1',
        phase: 'trigger',
      },
      resolution: {
        type: 'events',
        events: [{
          type: 'ABILITY_QUEUED',
          payload: { abilityId: 'scripted-effect' },
          timestamp: 11,
        }],
      },
    });

    expect(effect).not.toHaveBeenCalled();
    expect(opportunity.resolution).toMatchObject({
      type: 'events',
      events: [expect.objectContaining({
        type: 'ABILITY_QUEUED',
        payload: { abilityId: 'scripted-effect' },
      })],
    });
  });
});
