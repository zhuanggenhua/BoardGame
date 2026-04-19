import { describe, it, expect } from 'vitest';
import {
  // condition
  evaluateCondition,
  createConditionHandlerRegistry,
  registerConditionHandler,
  type ConditionNode,
  // target
  resolveTarget,
  createTargetResolverRegistry,
  registerTargetResolver,
  type TargetRef,
  // effects
  executeEffect,
  executeEffects,
  createEffectHandlerRegistry,
  registerEffectHandler,
  // zones
  drawCards,
  moveCard,
  peekCards,
  shuffleDeck,
  removeCard,
  reshuffleDiscardIntoDeck,
  findCard,
  drawFromTop,
  // dice
  createDie,
  rollDie,
  rollDice,
  calculateDiceStats,
  checkSymbolsTrigger,
  type DiceDefinition,
  type RandomFn,
  // resources
  getResource,
  setResource,
  modifyResource,
  canAfford,
  payResources,
  clampValue,
} from '../index';

// ============================================================================
// condition
// ============================================================================
describe('engine/primitives/condition', () => {
  it('always 应返回 true', () => {
    expect(evaluateCondition({ type: 'always' }, {})).toBe(true);
  });

  it('compare eq', () => {
    expect(evaluateCondition(
      { type: 'compare', op: 'eq', left: 'hp', right: 10 },
      { hp: 10 },
    )).toBe(true);
    expect(evaluateCondition(
      { type: 'compare', op: 'eq', left: 'hp', right: 10 },
      { hp: 5 },
    )).toBe(false);
  });

  it('compare gte', () => {
    expect(evaluateCondition(
      { type: 'compare', op: 'gte', left: 'hp', right: 5 },
      { hp: 10 },
    )).toBe(true);
  });

  it('and / or', () => {
    const andCond: ConditionNode = {
      type: 'and',
      conditions: [
        { type: 'compare', op: 'gte', left: 'hp', right: 5 },
        { type: 'compare', op: 'eq', left: 'status', right: 1 },
      ],
    };
    expect(evaluateCondition(andCond, { hp: 10, status: 1 })).toBe(true);
    expect(evaluateCondition(andCond, { hp: 10, status: 0 })).toBe(false);

    const orCond: ConditionNode = {
      type: 'or',
      conditions: [
        { type: 'compare', op: 'eq', left: 'hp', right: 0 },
        { type: 'compare', op: 'eq', left: 'status', right: 1 },
      ],
    };
    expect(evaluateCondition(orCond, { hp: 10, status: 1 })).toBe(true);
  });

  it('not', () => {
    const cond: ConditionNode = {
      type: 'not',
      condition: { type: 'compare', op: 'eq', left: 'hp', right: 0 },
    };
    expect(evaluateCondition(cond, { hp: 10 })).toBe(true);
  });

  it('custom handler', () => {
    const registry = createConditionHandlerRegistry();
    registerConditionHandler(registry, 'hasAbility', (params, ctx) => {
      const abilities = ctx.abilities as string[];
      return abilities.includes(params?.abilityId as string);
    });

    const cond: ConditionNode = {
      type: 'custom',
      handler: 'hasAbility',
      params: { abilityId: 'fireball' },
    };
    expect(evaluateCondition(cond, { abilities: ['fireball', 'heal'] }, registry)).toBe(true);
    expect(evaluateCondition(cond, { abilities: ['heal'] }, registry)).toBe(false);
  });

  it('custom handler 未注册时应抛出', () => {
    expect(() =>
      evaluateCondition({ type: 'custom', handler: 'nope' }, {}, createConditionHandlerRegistry()),
    ).toThrowError('未注册的条件处理器: nope');
  });
});

// ============================================================================
// target
// ============================================================================
describe('engine/primitives/target', () => {
  it('self', () => {
    expect(resolveTarget({ type: 'self' }, { sourceId: 'unit-1' })).toEqual(['unit-1']);
  });

  it('id', () => {
    expect(resolveTarget({ type: 'id', id: 'unit-5' }, { sourceId: 'x' })).toEqual(['unit-5']);
  });

  it('custom resolver', () => {
    const registry = createTargetResolverRegistry();
    registerTargetResolver(registry, 'adjacentUnits', (_params, ctx) => {
      return (ctx.adjacent as string[]) ?? [];
    });

    const ref: TargetRef = { type: 'custom', resolver: 'adjacentUnits' };
    const result = resolveTarget(ref, { sourceId: 'u1', adjacent: ['u2', 'u3'] }, registry);
    expect(result).toEqual(['u2', 'u3']);
  });

  it('custom 未注册时应抛出', () => {
    expect(() =>
      resolveTarget({ type: 'custom', resolver: 'nope' }, { sourceId: 'x' }, createTargetResolverRegistry()),
    ).toThrowError('未注册的目标解析器: nope');
  });
});

// ============================================================================
// effects
// ============================================================================
describe('engine/primitives/effects', () => {
  interface GState { hp: number }
  interface GEvent { type: string; value: number }

  it('单个效果执行', () => {
    const registry = createEffectHandlerRegistry<GState, GEvent>();
    registerEffectHandler(registry, 'damage', (effect, state) => ({
      state: { hp: state.hp - (effect.amount as number) },
      events: [{ type: 'damaged', value: effect.amount as number }],
    }));

    const result = executeEffect({ type: 'damage', amount: 5 }, { hp: 20 }, registry);
    expect(result.state.hp).toBe(15);
    expect(result.events).toHaveLength(1);
  });

  it('多个效果顺序执行', () => {
    const registry = createEffectHandlerRegistry<GState, GEvent>();
    registerEffectHandler(registry, 'damage', (effect, state) => ({
      state: { hp: state.hp - (effect.amount as number) },
      events: [{ type: 'damaged', value: effect.amount as number }],
    }));
    registerEffectHandler(registry, 'heal', (effect, state) => ({
      state: { hp: state.hp + (effect.amount as number) },
      events: [{ type: 'healed', value: effect.amount as number }],
    }));

    const result = executeEffects(
      [{ type: 'damage', amount: 10 }, { type: 'heal', amount: 3 }],
      { hp: 20 },
      registry,
    );
    expect(result.state.hp).toBe(13);
    expect(result.events).toHaveLength(2);
  });

  it('未注册类型应抛出', () => {
    const registry = createEffectHandlerRegistry();
    expect(() =>
      executeEffect({ type: 'unknownEffect' }, {}, registry),
    ).toThrowError('未注册的效果类型: unknownEffect');
  });
});

// ============================================================================
// zones
// ============================================================================
describe('engine/primitives/zones', () => {
  const c = (id: string) => ({ id });

  it('drawCards 从牌库抽牌到手牌', () => {
    const result = drawCards([c('a'), c('b'), c('c')], [], 2);
    expect(result.deck).toEqual([c('c')]);
    expect(result.hand).toEqual([c('a'), c('b')]);
  });

  it('drawCards 牌库不够时抽尽', () => {
    const result = drawCards([c('a')], [], 5);
    expect(result.deck).toEqual([]);
    expect(result.hand).toEqual([c('a')]);
  });

  it('moveCard 成功', () => {
    const result = moveCard([c('a'), c('b')], [c('c')], 'a');
    expect(result.found).toBe(true);
    expect(result.from).toEqual([c('b')]);
    expect(result.to).toEqual([c('c'), c('a')]);
  });

  it('moveCard 卡牌不存在', () => {
    const result = moveCard([c('a')], [c('b')], 'nope');
    expect(result.found).toBe(false);
    expect(result.from).toEqual([c('a')]);
  });

  it('peekCards 不移除', () => {
    const deck = [c('a'), c('b'), c('c')];
    expect(peekCards(deck, 2)).toEqual([c('a'), c('b')]);
    expect(deck).toHaveLength(3); // 原数组不变
  });

  it('shuffleDeck 返回新数组', () => {
    const deck = [c('a'), c('b'), c('c')];
    const reversed = shuffleDeck(deck, (arr) => [...arr].reverse());
    expect(reversed).toEqual([c('c'), c('b'), c('a')]);
    expect(deck).toEqual([c('a'), c('b'), c('c')]); // 原数组不变
  });

  it('removeCard', () => {
    const { card, remaining } = removeCard([c('a'), c('b'), c('c')], 'b');
    expect(card).toEqual(c('b'));
    expect(remaining).toEqual([c('a'), c('c')]);
  });

  it('findCard', () => {
    expect(findCard([c('a'), c('b')], 'b')).toEqual(c('b'));
    expect(findCard([c('a')], 'x')).toBeUndefined();
  });

  it('drawFromTop', () => {
    const { drawn, remaining } = drawFromTop([c('a'), c('b'), c('c')], 2);
    expect(drawn).toEqual([c('a'), c('b')]);
    expect(remaining).toEqual([c('c')]);
  });

  it('reshuffleDiscardIntoDeck', () => {
    const result = reshuffleDiscardIntoDeck(
      [c('a')],
      [c('b'), c('c')],
      (arr) => [...arr].reverse(),
    );
    expect(result.discard).toEqual([]);
    expect(result.deck).toHaveLength(3);
  });
});

// ============================================================================
// dice
// ============================================================================
describe('engine/primitives/dice', () => {
  const testDef: DiceDefinition = {
    id: 'test-d6',
    sides: 6,
    faces: [
      { value: 1, symbols: ['sword'] },
      { value: 2, symbols: ['sword'] },
      { value: 3, symbols: ['shield'] },
      { value: 4, symbols: ['shield'] },
      { value: 5, symbols: ['magic'] },
      { value: 6, symbols: ['magic', 'sword'] },
    ],
  };

  const fixedRandom = (v: number): RandomFn => ({ d: () => v });

  it('createDie 使用初始值', () => {
    const die = createDie(testDef, 0, { initialValue: 3 });
    expect(die.id).toBe(0);
    expect(die.value).toBe(3);
    expect(die.symbol).toBe('shield');
    expect(die.isKept).toBe(false);
  });

  it('createDie 使用 random', () => {
    const die = createDie(testDef, 1, undefined, fixedRandom(5));
    expect(die.value).toBe(5);
    expect(die.symbol).toBe('magic');
  });

  it('rollDie 不重掷锁定骰子', () => {
    const die = createDie(testDef, 0, { initialValue: 1, isKept: true });
    const rolled = rollDie(die, testDef, fixedRandom(6));
    expect(rolled.value).toBe(1); // 保持原值
  });

  it('rollDie 重掷未锁定骰子', () => {
    const die = createDie(testDef, 0, { initialValue: 1 });
    const rolled = rollDie(die, testDef, fixedRandom(6));
    expect(rolled.value).toBe(6);
    expect(rolled.symbols).toEqual(['magic', 'sword']);
  });

  it('rollDice 批量掷骰', () => {
    const dice = [
      createDie(testDef, 0, { initialValue: 1 }),
      createDie(testDef, 1, { initialValue: 2, isKept: true }),
    ];
    const result = rollDice(dice, testDef, fixedRandom(4));
    expect(result.dice[0].value).toBe(4); // 重掷
    expect(result.dice[1].value).toBe(2); // 保持
  });

  it('calculateDiceStats', () => {
    const dice = [1, 2, 3, 4, 5].map((v, i) =>
      createDie(testDef, i, { initialValue: v }),
    );
    const stats = calculateDiceStats(dice);
    expect(stats.total).toBe(15);
    expect(stats.hasSmallStraight).toBe(true);
    expect(stats.hasLargeStraight).toBe(true);
    expect(stats.maxOfAKind).toBe(1);
  });

  it('checkSymbolsTrigger', () => {
    expect(checkSymbolsTrigger({ sword: 3, shield: 1 }, { sword: 2 })).toBe(true);
    expect(checkSymbolsTrigger({ sword: 1 }, { sword: 2 })).toBe(false);
  });
});

// ============================================================================
// resources
// ============================================================================
describe('engine/primitives/resources', () => {
  it('getResource 不存在返回 0', () => {
    expect(getResource({}, 'gold')).toBe(0);
    expect(getResource({ gold: 10 }, 'gold')).toBe(10);
  });

  it('setResource', () => {
    const result = setResource({ mana: 5 }, 'mana', 10);
    expect(result.pool.mana).toBe(10);
    expect(result.actualDelta).toBe(5);
  });

  it('setResource with bounds clamping', () => {
    const result = setResource({ gold: 10 }, 'gold', -5, { min: 0, max: 100 });
    expect(result.pool.gold).toBe(0);
    expect(result.floored).toBe(true);
    expect(result.capped).toBe(false);
  });

  it('modifyResource', () => {
    const result = modifyResource({ gold: 10 }, 'gold', -15, { min: 0 });
    expect(result.pool.gold).toBe(0);
    expect(result.floored).toBe(true);
  });

  it('canAfford', () => {
    const check = canAfford({ gold: 5, wood: 10 }, { gold: 3, wood: 15 });
    expect(check.canAfford).toBe(false);
    expect(check.shortages).toHaveLength(1);
    expect(check.shortages[0].resourceId).toBe('wood');
  });

  it('payResources', () => {
    const pool = payResources({ gold: 10, wood: 5 }, { gold: 3, wood: 2 });
    expect(pool.gold).toBe(7);
    expect(pool.wood).toBe(3);
  });

  it('clampValue', () => {
    expect(clampValue(-5, 0, 100)).toBe(0);
    expect(clampValue(150, 0, 100)).toBe(100);
    expect(clampValue(50, 0, 100)).toBe(50);
  });
});
