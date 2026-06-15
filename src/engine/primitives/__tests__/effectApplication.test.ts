import { describe, expect, it } from 'vitest';
import {
  applyEffectSpecToHost,
  applyEffectSpec,
  applyEffectSpecToRuntime,
  createEffectSpec,
  createEffectRuntimeHostState,
  createEffectRuntimeState,
  removeAppliedEffectInstanceFromHost,
  removeAppliedEffectInstance,
  removeAppliedEffectInstanceFromRuntime,
  syncEffectRuntimeHostBaseTags,
  reconcileEffectRuntimeState,
  reconcileAppliedEffectInstance,
  type EffectSpec,
} from '../effectApplication';
import {
  createEffectHandlerRegistry,
  registerEffectHandler,
  type EffectDef,
} from '../effects';
import { addTag, createTagContainer, getStacks, hasTag } from '../tags';

type TestState = {
  hp: number;
  log: string[];
};

type TestEvent = {
  type: string;
  amount?: number;
};

type DamageEffect = EffectDef & {
  type: 'damage';
  amount: number;
};

function createRegistry() {
  const registry = createEffectHandlerRegistry<TestState, TestEvent>();
  registerEffectHandler(registry, 'damage', (effect, state) => {
    const damage = effect as DamageEffect;
    return {
      state: {
        ...state,
        hp: state.hp - damage.amount,
        log: [...state.log, `damage:${damage.amount}`],
      },
      events: [{ type: 'damage_applied', amount: damage.amount }],
    };
  });
  return registry;
}

function createDamageSpec(overrides?: Partial<EffectSpec<DamageEffect>>) {
  return createEffectSpec({
    id: 'damage-1',
    effect: { type: 'damage', amount: 3 },
    source: { id: 'caster-1' },
    target: { id: 'target-1' },
    ...overrides,
  });
}

describe('effectApplication primitives', () => {
  it('instant effect 在满足条件时会通过统一 apply gateway 进入具体 handler', () => {
    const result = applyEffectSpec(
      createDamageSpec({
        rules: { requiredTags: ['Unit.Vulnerable'] },
      }),
      {
        state: { hp: 10, log: [] },
        targetTags: addTag(createTagContainer(), 'Unit.Vulnerable'),
        registry: createRegistry(),
      },
    );

    expect(result.outcome).toBe('applied');
    expect(result.state.hp).toBe(7);
    expect(result.events).toEqual([{ type: 'damage_applied', amount: 3 }]);
  });

  it('命中 blocked/immunity 规则时不会进入具体 handler，并返回结构化 blocked outcome', () => {
    const result = applyEffectSpec(
      createDamageSpec({
        rules: {
          blockedTags: ['Shield.Blocked'],
          immunityTags: ['Shield.Immune'],
        },
      }),
      {
        state: { hp: 10, log: [] },
        targetTags: addTag(
          addTag(createTagContainer(), 'Shield.Blocked'),
          'Shield.Immune',
        ),
        registry: createRegistry(),
      },
    );

    expect(result.outcome).toBe('blocked');
    expect(result.state.hp).toBe(10);
    expect(result.events).toEqual([]);
    expect(result.reasons).toEqual([
      { code: 'blocked_by_tags', tags: ['Shield.Blocked'] },
      { code: 'immune_by_tags', tags: ['Shield.Immune'] },
    ]);
  });

  it('持续效果在 ongoing 条件不满足时返回 inactive，而不是伪装成 rejected', () => {
    const result = applyEffectSpec(
      createDamageSpec({
        lifecycle: 'persistent',
        rules: {
          ongoingRequiredTags: ['Aura.Enabled'],
          grantedTags: [{ tagId: 'Buff.Haste' }],
        },
      }),
      {
        state: { hp: 10, log: [] },
        targetTags: createTagContainer(),
        registry: createRegistry(),
      },
    );

    expect(result.outcome).toBe('inactive');
    expect(result.instance?.active).toBe(false);
    expect(result.reasons).toEqual([
      { code: 'missing_ongoing_required_tags', tags: ['Aura.Enabled'] },
    ]);
    expect(hasTag(result.targetTags, 'Buff.Haste')).toBe(false);
  });

  it('持续效果激活时会授予标签，并在 remove-with-tags 命中后统一移除', () => {
    const applied = applyEffectSpec(
      createDamageSpec({
        lifecycle: 'persistent',
        rules: {
          ongoingRequiredTags: ['Aura.Enabled'],
          grantedTags: [{ tagId: 'Buff.Haste' }],
          removeWithAnyTags: ['Status.Silenced'],
        },
      }),
      {
        state: { hp: 10, log: [] },
        targetTags: addTag(createTagContainer(), 'Aura.Enabled'),
        registry: createRegistry(),
      },
    );

    expect(applied.outcome).toBe('applied');
    expect(applied.instance?.active).toBe(true);
    expect(hasTag(applied.targetTags, 'Buff.Haste')).toBe(true);

    const reconciled = reconcileAppliedEffectInstance(
      applied.instance!,
      addTag(applied.targetTags, 'Status.Silenced'),
    );

    expect(reconciled.outcome).toBe('removed');
    expect(reconciled.reasons).toEqual([
      { code: 'removed_by_tags', tags: ['Status.Silenced'] },
    ]);
    expect(hasTag(reconciled.targetTags, 'Buff.Haste')).toBe(false);
  });

  it('aggregate_by_target 会刷新既有 instance，而不是重复创建独立实例', () => {
    const first = applyEffectSpec(
      createDamageSpec({
        lifecycle: 'persistent',
        rules: {
          ongoingRequiredTags: ['Aura.Enabled'],
          grantedTags: [{ tagId: 'Buff.Haste' }],
          stacking: {
            policy: 'aggregate_by_target',
            stackKey: 'haste-aura',
            maxStacks: 3,
          },
        },
      }),
      {
        state: { hp: 10, log: [] },
        targetTags: addTag(createTagContainer(), 'Aura.Enabled'),
        registry: createRegistry(),
      },
    );

    const refreshed = applyEffectSpec(
      createDamageSpec({
        id: 'damage-2',
        lifecycle: 'persistent',
        rules: {
          ongoingRequiredTags: ['Aura.Enabled'],
          grantedTags: [{ tagId: 'Buff.Haste' }],
          stacking: {
            policy: 'aggregate_by_target',
            stackKey: 'haste-aura',
            maxStacks: 3,
          },
        },
      }),
      {
        state: { hp: 10, log: [] },
        targetTags: first.targetTags,
        registry: createRegistry(),
        activeInstances: [first.instance!],
      },
    );

    expect(first.applicationKind).toBe('new_instance');
    expect(refreshed.applicationKind).toBe('refreshed_instance');
    expect(refreshed.instance?.stackCount).toBe(2);
    expect(getStacks(refreshed.targetTags, 'Buff.Haste')).toBe(1);
  });

  it('aggregate_by_source 会保留不同来源的独立实例，并按实例精确回收 granted tags', () => {
    const first = applyEffectSpec(
      createDamageSpec({
        lifecycle: 'persistent',
        rules: {
          grantedTags: [{ tagId: 'Buff.Haste' }],
          stacking: {
            policy: 'aggregate_by_source',
            stackKey: 'haste-aura',
          },
        },
      }),
      {
        state: { hp: 10, log: [] },
        targetTags: createTagContainer(),
        registry: createRegistry(),
      },
    );

    const second = applyEffectSpec(
      createDamageSpec({
        id: 'damage-2',
        source: { id: 'caster-2' },
        lifecycle: 'persistent',
        rules: {
          grantedTags: [{ tagId: 'Buff.Haste' }],
          stacking: {
            policy: 'aggregate_by_source',
            stackKey: 'haste-aura',
          },
        },
      }),
      {
        state: { hp: 10, log: [] },
        targetTags: first.targetTags,
        registry: createRegistry(),
        activeInstances: [first.instance!],
      },
    );

    expect(first.applicationKind).toBe('new_instance');
    expect(second.applicationKind).toBe('new_instance');
    expect(getStacks(second.targetTags, 'Buff.Haste')).toBe(2);

    const removedFirst = removeAppliedEffectInstance(
      first.instance!,
      second.targetTags,
    );

    expect(removedFirst.reasons).toEqual([
      { code: 'explicit_teardown', tags: [] },
    ]);
    expect(getStacks(removedFirst.targetTags, 'Buff.Haste')).toBe(1);
    expect(hasTag(removedFirst.targetTags, 'Buff.Haste')).toBe(true);
  });

  it('持续效果可在标签变化后从 inactive 切到 active，并同步 granted tags', () => {
    const initial = applyEffectSpec(
      createDamageSpec({
        lifecycle: 'persistent',
        rules: {
          ongoingRequiredTags: ['Aura.Enabled'],
          grantedTags: [{ tagId: 'Buff.Haste' }],
        },
      }),
      {
        state: { hp: 10, log: [] },
        targetTags: createTagContainer(),
        registry: createRegistry(),
      },
    );

    const reconciled = reconcileAppliedEffectInstance(
      initial.instance!,
      addTag(initial.targetTags, 'Aura.Enabled'),
    );

    expect(initial.outcome).toBe('inactive');
    expect(reconciled.outcome).toBe('active');
    expect(reconciled.reasons).toEqual([]);
    expect(reconciled.instance?.active).toBe(true);
    expect(hasTag(reconciled.targetTags, 'Buff.Haste')).toBe(true);
  });

  it('持续效果在 active 期间失去 ongoing 条件时，会返回可机读的 inactive 原因', () => {
    const applied = applyEffectSpec(
      createDamageSpec({
        lifecycle: 'persistent',
        rules: {
          ongoingRequiredTags: ['Aura.Enabled'],
          grantedTags: [{ tagId: 'Buff.Haste' }],
        },
      }),
      {
        state: { hp: 10, log: [] },
        targetTags: addTag(createTagContainer(), 'Aura.Enabled'),
        registry: createRegistry(),
      },
    );

    const reconciled = reconcileAppliedEffectInstance(
      applied.instance!,
      createTagContainer(),
    );

    expect(reconciled.outcome).toBe('inactive');
    expect(reconciled.reasons).toEqual([
      { code: 'missing_ongoing_required_tags', tags: ['Aura.Enabled'] },
    ]);
    expect(reconciled.instance?.active).toBe(false);
    expect(hasTag(reconciled.targetTags, 'Buff.Haste')).toBe(false);
  });

  it('runtime helper 会统一维护 targetTags 与 activeInstances，避免游戏层手写容器更新', () => {
    const first = applyEffectSpecToRuntime(
      createDamageSpec({
        lifecycle: 'persistent',
        rules: {
          grantedTags: [{ tagId: 'Buff.Haste' }],
          stacking: {
            policy: 'aggregate_by_source',
            stackKey: 'haste-aura',
          },
        },
      }),
      {
        state: { hp: 10, log: [] },
        registry: createRegistry(),
        runtime: createEffectRuntimeState(),
      },
    );

    const second = applyEffectSpecToRuntime(
      createDamageSpec({
        id: 'damage-2',
        source: { id: 'caster-2' },
        lifecycle: 'persistent',
        rules: {
          grantedTags: [{ tagId: 'Buff.Haste' }],
          stacking: {
            policy: 'aggregate_by_source',
            stackKey: 'haste-aura',
          },
        },
      }),
      {
        state: { hp: 10, log: [] },
        registry: createRegistry(),
        runtime: first.runtime,
      },
    );

    expect(first.runtime.activeInstances).toHaveLength(1);
    expect(second.runtime.activeInstances).toHaveLength(2);
    expect(getStacks(second.runtime.targetTags, 'Buff.Haste')).toBe(2);

    const removedFirst = removeAppliedEffectInstanceFromRuntime(
      first.runtime.activeInstances[0],
      second.runtime,
    );

    expect(removedFirst.runtime.activeInstances).toHaveLength(1);
    expect(getStacks(removedFirst.runtime.targetTags, 'Buff.Haste')).toBe(1);
  });

  it('runtime reconcile helper 会跑到稳定态，而不是要求游戏层自己多轮重放 lifecycle', () => {
    const auraSource = createDamageSpec({
      id: 'aura-source',
      lifecycle: 'persistent',
      rules: {
        ongoingRequiredTags: ['Switch.On'],
        grantedTags: [{ tagId: 'Aura.Enabled' }],
      },
    });
    const auraDependent = createDamageSpec({
      id: 'aura-dependent',
      lifecycle: 'persistent',
      rules: {
        ongoingRequiredTags: ['Aura.Enabled'],
        grantedTags: [{ tagId: 'Buff.Haste' }],
      },
    });

    const dependentInitial = applyEffectSpec(auraDependent, {
      state: { hp: 10, log: [] },
      targetTags: createTagContainer(),
      registry: createRegistry(),
    });
    const sourceInitial = applyEffectSpec(auraSource, {
      state: { hp: 10, log: [] },
      targetTags: createTagContainer(),
      registry: createRegistry(),
    });

    const reconciled = reconcileEffectRuntimeState(createEffectRuntimeState({
      targetTags: addTag(createTagContainer(), 'Switch.On'),
      activeInstances: [
        dependentInitial.instance!,
        sourceInitial.instance!,
      ],
    }));

    expect(reconciled.passCount).toBeGreaterThan(1);
    expect(reconciled.runtime.activeInstances).toHaveLength(2);
    expect(reconciled.runtime.activeInstances.every((instance) => instance.active)).toBe(true);
    expect(hasTag(reconciled.runtime.targetTags, 'Aura.Enabled')).toBe(true);
    expect(hasTag(reconciled.runtime.targetTags, 'Buff.Haste')).toBe(true);
  });

  it('runtime host 会分离外部基础标签，并在基础标签变化后自动回放依赖链', () => {
    const auraSource = createDamageSpec({
      id: 'aura-source',
      lifecycle: 'persistent',
      rules: {
        ongoingRequiredTags: ['Switch.On'],
        grantedTags: [{ tagId: 'Aura.Enabled', options: { source: 'aura-source' } }],
      },
    });
    const auraDependent = createDamageSpec({
      id: 'aura-dependent',
      lifecycle: 'persistent',
      rules: {
        ongoingRequiredTags: ['Aura.Enabled'],
        grantedTags: [{ tagId: 'Buff.Haste', options: { source: 'aura-dependent' } }],
      },
    });

    const first = applyEffectSpecToHost(auraSource, {
      state: { hp: 10, log: [] },
      registry: createRegistry(),
      host: createEffectRuntimeHostState(),
    });
    const second = applyEffectSpecToHost(auraDependent, {
      state: { hp: 10, log: [] },
      registry: createRegistry(),
      host: first.host,
    });

    expect(second.host.runtime.activeInstances.every((instance) => instance.active === false)).toBe(true);
    expect(hasTag(second.host.runtime.targetTags, 'Aura.Enabled')).toBe(false);
    expect(hasTag(second.host.runtime.targetTags, 'Buff.Haste')).toBe(false);

    const withSwitch = syncEffectRuntimeHostBaseTags(
      second.host,
      addTag(createTagContainer(), 'Switch.On'),
    );

    expect(hasTag(withSwitch.host.baseTargetTags, 'Switch.On')).toBe(true);
    expect(withSwitch.host.runtime.activeInstances.every((instance) => instance.active)).toBe(true);
    expect(hasTag(withSwitch.host.runtime.targetTags, 'Switch.On')).toBe(true);
    expect(hasTag(withSwitch.host.runtime.targetTags, 'Aura.Enabled')).toBe(true);
    expect(hasTag(withSwitch.host.runtime.targetTags, 'Buff.Haste')).toBe(true);
    expect(withSwitch.host.runtime.targetTags['Aura.Enabled']?.source).toBe('aura-source');
    expect(withSwitch.host.runtime.targetTags['Buff.Haste']?.source).toBe('aura-dependent');
  });

  it('runtime host remove 会自动重跑生命周期，避免游戏层手动 remove 后再补 reconcile', () => {
    const auraSource = createDamageSpec({
      id: 'aura-source',
      lifecycle: 'persistent',
      rules: {
        ongoingRequiredTags: ['Switch.On'],
        grantedTags: [{ tagId: 'Aura.Enabled' }],
      },
    });
    const auraDependent = createDamageSpec({
      id: 'aura-dependent',
      lifecycle: 'persistent',
      rules: {
        ongoingRequiredTags: ['Aura.Enabled'],
        grantedTags: [{ tagId: 'Buff.Haste' }],
      },
    });

    const seededHost = createEffectRuntimeHostState({
      baseTargetTags: addTag(createTagContainer(), 'Switch.On'),
    });
    const sourceApplied = applyEffectSpecToHost(auraSource, {
      state: { hp: 10, log: [] },
      registry: createRegistry(),
      host: seededHost,
    });
    const dependentApplied = applyEffectSpecToHost(auraDependent, {
      state: { hp: 10, log: [] },
      registry: createRegistry(),
      host: sourceApplied.host,
    });

    expect(dependentApplied.host.runtime.activeInstances.every((instance) => instance.active)).toBe(true);
    expect(hasTag(dependentApplied.host.runtime.targetTags, 'Aura.Enabled')).toBe(true);
    expect(hasTag(dependentApplied.host.runtime.targetTags, 'Buff.Haste')).toBe(true);

    const removed = removeAppliedEffectInstanceFromHost(
      dependentApplied.host.runtime.activeInstances.find((instance) => instance.spec.id === 'aura-source')!,
      dependentApplied.host,
    );

    expect(hasTag(removed.host.runtime.targetTags, 'Switch.On')).toBe(true);
    expect(hasTag(removed.host.runtime.targetTags, 'Aura.Enabled')).toBe(false);
    expect(hasTag(removed.host.runtime.targetTags, 'Buff.Haste')).toBe(false);
    expect(removed.host.runtime.activeInstances).toHaveLength(1);
    expect(removed.host.runtime.activeInstances[0].spec.id).toBe('aura-dependent');
    expect(removed.host.runtime.activeInstances[0].active).toBe(false);
  });
});
