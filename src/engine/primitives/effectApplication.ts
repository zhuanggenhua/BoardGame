import {
  executeEffect,
  type EffectDef,
  type EffectHandlerRegistry,
  type EffectResult,
} from './effects';
import {
  addTag,
  createTagContainer,
  hasTag,
  removeTag,
  type TagAddOptions,
  type TagContainer,
} from './tags';

export type EffectLifecycle = 'instant' | 'persistent';

export interface EffectActorRef {
  id: string;
  ownerId?: string;
  controllerId?: string;
  zoneId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface EffectTagGrant {
  tagId: string;
  options?: TagAddOptions;
}

export type EffectStackingPolicy = 'none' | 'aggregate_by_target' | 'aggregate_by_source';

export interface EffectStackingRules {
  policy?: EffectStackingPolicy;
  stackKey?: string;
  maxStacks?: number;
}

export interface EffectApplicationRules {
  requiredTags?: string[];
  blockedTags?: string[];
  immunityTags?: string[];
  ongoingRequiredTags?: string[];
  grantedTags?: EffectTagGrant[];
  removeWithAnyTags?: string[];
  stacking?: EffectStackingRules;
}

export interface EffectSpec<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  effect: TEffect;
  source: EffectActorRef;
  target: EffectActorRef;
  lifecycle?: EffectLifecycle;
  level?: number;
  rules?: EffectApplicationRules;
  metadata?: TMetadata;
}

export type EffectApplyFailureCode =
  | 'missing_required_tags'
  | 'blocked_by_tags'
  | 'immune_by_tags'
  | 'missing_ongoing_required_tags'
  | 'removed_by_tags'
  | 'explicit_teardown';

export interface EffectApplyFailureReason {
  code: EffectApplyFailureCode;
  tags: string[];
}

export type EffectApplyOutcome = 'applied' | 'blocked' | 'inactive' | 'removed';
export type EffectApplicationKind = 'new_instance' | 'refreshed_instance';

export interface OwnedEffectTagGrant {
  tagId: string;
  stacks: number;
  options?: TagAddOptions;
}

export interface AppliedEffectInstance<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  spec: EffectSpec<TEffect, TMetadata>;
  lifecycle: EffectLifecycle;
  active: boolean;
  stackCount: number;
  ownedGrantedTags: OwnedEffectTagGrant[];
}

export interface EffectApplyResult<
  TState = unknown,
  TEvent = unknown,
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends EffectResult<TState, TEvent> {
  outcome: EffectApplyOutcome;
  reasons: EffectApplyFailureReason[];
  targetTags: TagContainer;
  applicationKind?: EffectApplicationKind;
  instance?: AppliedEffectInstance<TEffect, TMetadata>;
}

export interface EffectApplicationContext<TState = unknown, TEvent = unknown> {
  state: TState;
  targetTags: TagContainer;
  registry: EffectHandlerRegistry<TState, TEvent>;
  activeInstances?: readonly AppliedEffectInstance[];
}

export interface EffectRuntimeState<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  targetTags: TagContainer;
  activeInstances: readonly AppliedEffectInstance<TEffect, TMetadata>[];
}

export interface EffectRuntimeContext<
  TState = unknown,
  TEvent = unknown,
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  state: TState;
  registry: EffectHandlerRegistry<TState, TEvent>;
  runtime: EffectRuntimeState<TEffect, TMetadata>;
}

export interface EffectRuntimeApplyResult<
  TState = unknown,
  TEvent = unknown,
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends EffectApplyResult<TState, TEvent, TEffect, TMetadata> {
  runtime: EffectRuntimeState<TEffect, TMetadata>;
}

export interface EffectRuntimeLifecycleResult<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends EffectInstanceLifecycleResult<TEffect, TMetadata> {
  runtime: EffectRuntimeState<TEffect, TMetadata>;
}

export interface EffectRuntimeReconcileResult<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  runtime: EffectRuntimeState<TEffect, TMetadata>;
  passCount: number;
}

export interface EffectRuntimeHostState<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  baseTargetTags: TagContainer;
  runtime: EffectRuntimeState<TEffect, TMetadata>;
}

export interface EffectRuntimeHostContext<
  TState = unknown,
  TEvent = unknown,
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  state: TState;
  registry: EffectHandlerRegistry<TState, TEvent>;
  host: EffectRuntimeHostState<TEffect, TMetadata>;
}

export interface EffectRuntimeHostApplyResult<
  TState = unknown,
  TEvent = unknown,
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends EffectRuntimeApplyResult<TState, TEvent, TEffect, TMetadata> {
  host: EffectRuntimeHostState<TEffect, TMetadata>;
}

export interface EffectRuntimeHostLifecycleResult<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends EffectRuntimeLifecycleResult<TEffect, TMetadata> {
  host: EffectRuntimeHostState<TEffect, TMetadata>;
}

export interface EffectRuntimeHostReconcileResult<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends EffectRuntimeReconcileResult<TEffect, TMetadata> {
  host: EffectRuntimeHostState<TEffect, TMetadata>;
}

function findMatchedTags(container: TagContainer, patterns: readonly string[] | undefined): string[] {
  if (!patterns || patterns.length === 0) return [];
  const matched = new Set<string>();
  for (const pattern of patterns) {
    if (!hasTag(container, pattern)) continue;
    matched.add(pattern);
  }
  return [...matched];
}

function areTagContainersEqual(left: TagContainer, right: TagContainer): boolean {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    const leftEntry = left[key];
    const rightEntry = right[key];
    if (!rightEntry) return false;
    if (
      leftEntry.stacks !== rightEntry.stacks
      || leftEntry.duration !== rightEntry.duration
      || leftEntry.source !== rightEntry.source
      || leftEntry.removable !== rightEntry.removable
    ) {
      return false;
    }
  }
  return true;
}

function applyGrantedTags(container: TagContainer, grants: readonly EffectTagGrant[] | undefined): TagContainer {
  if (!grants || grants.length === 0) return container;
  let next = container;
  for (const grant of grants) {
    next = addTag(next, grant.tagId, grant.options);
  }
  return next;
}

function removeOwnedGrantedTags(container: TagContainer, grants: readonly OwnedEffectTagGrant[] | undefined): TagContainer {
  if (!grants || grants.length === 0) return container;
  let next = container;
  for (const grant of grants) {
    next = removeTag(next, grant.tagId, grant.stacks);
  }
  return next;
}

function normalizeOwnedGrantedTags(grants: readonly EffectTagGrant[] | undefined): OwnedEffectTagGrant[] {
  if (!grants || grants.length === 0) return [];
  return grants.map((grant) => ({
    tagId: grant.tagId,
    stacks: Math.max(1, grant.options?.stacks ?? 1),
    options: grant.options ? { ...grant.options, stacks: Math.max(1, grant.options.stacks ?? 1) } : undefined,
  }));
}

function applyOwnedGrantedTags(container: TagContainer, grants: readonly OwnedEffectTagGrant[] | undefined): TagContainer {
  if (!grants || grants.length === 0) return container;
  let next = container;
  for (const grant of grants) {
    next = addTag(next, grant.tagId, grant.options ?? { stacks: grant.stacks });
  }
  return next;
}

function materializeRuntimeTargetTags(
  baseTargetTags: TagContainer,
  activeInstances: readonly AppliedEffectInstance[] | undefined,
): TagContainer {
  if (!activeInstances || activeInstances.length === 0) return baseTargetTags;
  let next = baseTargetTags;
  for (const instance of activeInstances) {
    if (!instance.active) continue;
    next = applyOwnedGrantedTags(next, instance.ownedGrantedTags);
  }
  return next;
}

function createEffectRuntimeHostStateFromParts<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  baseTargetTags: TagContainer,
  activeInstances: readonly AppliedEffectInstance<TEffect, TMetadata>[],
  options?: { maxPasses?: number },
): EffectRuntimeHostReconcileResult<TEffect, TMetadata> {
  const reconciled = reconcileEffectRuntimeState(createEffectRuntimeState({
    targetTags: materializeRuntimeTargetTags(baseTargetTags, activeInstances),
    activeInstances,
  }), options);

  return {
    ...reconciled,
    host: {
      baseTargetTags,
      runtime: reconciled.runtime,
    },
  };
}

function buildBlockedReasons(container: TagContainer, rules?: EffectApplicationRules): EffectApplyFailureReason[] {
  const reasons: EffectApplyFailureReason[] = [];
  const missingRequired = (rules?.requiredTags ?? []).filter((pattern) => !hasTag(container, pattern));
  if (missingRequired.length > 0) {
    reasons.push({ code: 'missing_required_tags', tags: missingRequired });
  }
  const blockedTags = findMatchedTags(container, rules?.blockedTags);
  if (blockedTags.length > 0) {
    reasons.push({ code: 'blocked_by_tags', tags: blockedTags });
  }
  const immunityTags = findMatchedTags(container, rules?.immunityTags);
  if (immunityTags.length > 0) {
    reasons.push({ code: 'immune_by_tags', tags: immunityTags });
  }
  return reasons;
}

function buildInactiveReasons(container: TagContainer, rules?: EffectApplicationRules): EffectApplyFailureReason[] {
  const missingOngoingRequired = (rules?.ongoingRequiredTags ?? []).filter((pattern) => !hasTag(container, pattern));
  if (missingOngoingRequired.length === 0) return [];
  return [{ code: 'missing_ongoing_required_tags', tags: missingOngoingRequired }];
}

function isPersistentEffectActive(container: TagContainer, rules?: EffectApplicationRules): boolean {
  const ongoingRequiredTags = rules?.ongoingRequiredTags;
  if (!ongoingRequiredTags || ongoingRequiredTags.length === 0) return true;
  return ongoingRequiredTags.every((pattern) => hasTag(container, pattern));
}

function getStackingPolicy(rules?: EffectApplicationRules): EffectStackingPolicy {
  return rules?.stacking?.policy ?? 'none';
}

function getStackingKey(spec: EffectSpec): string | undefined {
  return spec.rules?.stacking?.stackKey ?? spec.effect.type;
}

function canUsePersistentStacking(spec: EffectSpec): boolean {
  return spec.lifecycle === 'persistent' && getStackingPolicy(spec.rules) !== 'none';
}

function isSameStackingBucket(
  current: AppliedEffectInstance,
  nextSpec: EffectSpec,
): boolean {
  const currentKey = getStackingKey(current.spec);
  const nextKey = getStackingKey(nextSpec);
  if (!currentKey || !nextKey || currentKey !== nextKey) return false;

  const policy = getStackingPolicy(nextSpec.rules);
  if (policy === 'aggregate_by_target') return true;
  if (policy === 'aggregate_by_source') {
    return current.spec.source.id === nextSpec.source.id;
  }
  return false;
}

function findStackedInstance(
  instances: readonly AppliedEffectInstance[] | undefined,
  spec: EffectSpec,
): AppliedEffectInstance | undefined {
  if (!instances || instances.length === 0 || !canUsePersistentStacking(spec)) return undefined;
  return instances.find((instance) => isSameStackingBucket(instance, spec));
}

function replaceRuntimeInstance<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  instances: readonly AppliedEffectInstance<TEffect, TMetadata>[],
  nextInstance: AppliedEffectInstance<TEffect, TMetadata>,
): AppliedEffectInstance<TEffect, TMetadata>[] {
  const replaceIndex = instances.findIndex((instance) => (
    instance.spec.id === nextInstance.spec.id
    || isSameStackingBucket(instance, nextInstance.spec)
  ));
  if (replaceIndex < 0) return [...instances, nextInstance];
  return instances.map((instance, index) => (index === replaceIndex ? nextInstance : instance));
}

function removeRuntimeInstance<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  instances: readonly AppliedEffectInstance<TEffect, TMetadata>[],
  removedInstance: AppliedEffectInstance<TEffect, TMetadata>,
): AppliedEffectInstance<TEffect, TMetadata>[] {
  return instances.filter((instance) => instance !== removedInstance && instance.spec.id !== removedInstance.spec.id);
}

export function createEffectSpec<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(spec: EffectSpec<TEffect, TMetadata>): EffectSpec<TEffect, TMetadata> {
  return {
    ...spec,
    lifecycle: spec.lifecycle ?? 'instant',
  };
}

export function createEffectRuntimeState<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(options?: {
  targetTags?: TagContainer;
  activeInstances?: readonly AppliedEffectInstance<TEffect, TMetadata>[];
}): EffectRuntimeState<TEffect, TMetadata> {
  return {
    targetTags: options?.targetTags ?? createTagContainer(),
    activeInstances: [...(options?.activeInstances ?? [])],
  };
}

export function createEffectRuntimeHostState<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(options?: {
  baseTargetTags?: TagContainer;
  activeInstances?: readonly AppliedEffectInstance<TEffect, TMetadata>[];
  maxPasses?: number;
}): EffectRuntimeHostState<TEffect, TMetadata> {
  return createEffectRuntimeHostStateFromParts(
    options?.baseTargetTags ?? createTagContainer(),
    [...(options?.activeInstances ?? [])],
    { maxPasses: options?.maxPasses },
  ).host;
}

export function applyEffectSpec<
  TState,
  TEvent,
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  specInput: EffectSpec<TEffect, TMetadata>,
  context: EffectApplicationContext<TState, TEvent>,
): EffectApplyResult<TState, TEvent, TEffect, TMetadata> {
  const spec = createEffectSpec(specInput);
  const reasons = buildBlockedReasons(context.targetTags, spec.rules);
  if (reasons.length > 0) {
    return {
      outcome: 'blocked',
      reasons,
      state: context.state,
      events: [],
      targetTags: context.targetTags,
    };
  }

  if (spec.lifecycle === 'persistent') {
    const ownedGrantedTags = normalizeOwnedGrantedTags(spec.rules?.grantedTags);
    const stackedInstance = findStackedInstance(context.activeInstances, spec);
    const active = isPersistentEffectActive(context.targetTags, spec.rules);
    if (stackedInstance) {
      const maxStacks = Math.max(1, spec.rules?.stacking?.maxStacks ?? Number.MAX_SAFE_INTEGER);
      const nextStackCount = Math.min(stackedInstance.stackCount + 1, maxStacks);
      const instance: AppliedEffectInstance<TEffect, TMetadata> = {
        spec,
        lifecycle: 'persistent',
        active,
        stackCount: nextStackCount,
        ownedGrantedTags: stackedInstance.ownedGrantedTags.length > 0
          ? stackedInstance.ownedGrantedTags
          : ownedGrantedTags,
      };

      if (!active) {
        return {
          outcome: 'inactive',
          reasons: buildInactiveReasons(context.targetTags, spec.rules),
          state: context.state,
          events: [],
          targetTags: context.targetTags,
          applicationKind: 'refreshed_instance',
          instance,
        };
      }

      const targetTags = stackedInstance.active
        ? context.targetTags
        : applyGrantedTags(context.targetTags, spec.rules?.grantedTags);
      return {
        outcome: 'applied',
        reasons: [],
        state: context.state,
        events: [],
        targetTags,
        applicationKind: 'refreshed_instance',
        instance,
      };
    }

    const instance: AppliedEffectInstance<TEffect, TMetadata> = {
      spec,
      lifecycle: 'persistent',
      active,
      stackCount: 1,
      ownedGrantedTags,
    };
    if (!active) {
      return {
        outcome: 'inactive',
        reasons: buildInactiveReasons(context.targetTags, spec.rules),
        state: context.state,
        events: [],
        targetTags: context.targetTags,
        applicationKind: 'new_instance',
        instance,
      };
    }

    return {
      outcome: 'applied',
      reasons: [],
      state: context.state,
      events: [],
      targetTags: applyGrantedTags(context.targetTags, spec.rules?.grantedTags),
      applicationKind: 'new_instance',
      instance,
    };
  }

  const executed = executeEffect(spec.effect, context.state, context.registry);
  return {
    outcome: 'applied',
    reasons: [],
    state: executed.state,
    events: executed.events,
    targetTags: context.targetTags,
  };
}

export interface EffectInstanceLifecycleResult<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  outcome: 'active' | 'inactive' | 'removed';
  reasons: EffectApplyFailureReason[];
  targetTags: TagContainer;
  instance?: AppliedEffectInstance<TEffect, TMetadata>;
}

export function reconcileAppliedEffectInstance<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  instance: AppliedEffectInstance<TEffect, TMetadata>,
  targetTags: TagContainer,
): EffectInstanceLifecycleResult<TEffect, TMetadata> {
  const removalTags = findMatchedTags(targetTags, instance.spec.rules?.removeWithAnyTags);
  if (removalTags.length > 0) {
    return {
      outcome: 'removed',
      reasons: [{ code: 'removed_by_tags', tags: removalTags }],
      targetTags: instance.active
        ? removeOwnedGrantedTags(targetTags, instance.ownedGrantedTags)
        : targetTags,
    };
  }

  const shouldBeActive = isPersistentEffectActive(targetTags, instance.spec.rules);
  const inactiveReasons = shouldBeActive ? [] : buildInactiveReasons(targetTags, instance.spec.rules);
  if (shouldBeActive === instance.active) {
    return {
      outcome: shouldBeActive ? 'active' : 'inactive',
      reasons: inactiveReasons,
      targetTags,
      instance,
    };
  }

  if (shouldBeActive) {
    return {
      outcome: 'active',
      reasons: [],
      targetTags: applyGrantedTags(targetTags, instance.spec.rules?.grantedTags),
      instance: { ...instance, active: true },
    };
  }

  return {
    outcome: 'inactive',
    reasons: inactiveReasons,
    targetTags: removeOwnedGrantedTags(targetTags, instance.ownedGrantedTags),
    instance: { ...instance, active: false },
  };
}

export function removeAppliedEffectInstance<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  instance: AppliedEffectInstance<TEffect, TMetadata>,
  targetTags: TagContainer,
): EffectInstanceLifecycleResult<TEffect, TMetadata> {
  return {
    outcome: 'removed',
    reasons: [{ code: 'explicit_teardown', tags: [] }],
    targetTags: instance.active
      ? removeOwnedGrantedTags(targetTags, instance.ownedGrantedTags)
      : targetTags,
  };
}

export function applyEffectSpecToRuntime<
  TState,
  TEvent,
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  specInput: EffectSpec<TEffect, TMetadata>,
  context: EffectRuntimeContext<TState, TEvent, TEffect, TMetadata>,
): EffectRuntimeApplyResult<TState, TEvent, TEffect, TMetadata> {
  const result = applyEffectSpec(specInput, {
    state: context.state,
    targetTags: context.runtime.targetTags,
    registry: context.registry,
    activeInstances: context.runtime.activeInstances,
  });

  let activeInstances = [...context.runtime.activeInstances];
  if (result.instance) {
    activeInstances = result.applicationKind === 'refreshed_instance'
      ? replaceRuntimeInstance(activeInstances, result.instance)
      : [...activeInstances, result.instance];
  }

  return {
    ...result,
    runtime: createEffectRuntimeState({
      targetTags: result.targetTags,
      activeInstances,
    }),
  };
}

export function reconcileEffectRuntimeState<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  runtime: EffectRuntimeState<TEffect, TMetadata>,
  options?: { maxPasses?: number },
): EffectRuntimeReconcileResult<TEffect, TMetadata> {
  let current = createEffectRuntimeState(runtime);
  const maxPasses = Math.max(1, options?.maxPasses ?? (runtime.activeInstances.length * 2 + 1));

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    let changed = false;
    let targetTags = current.targetTags;
    const nextInstances: AppliedEffectInstance<TEffect, TMetadata>[] = [];

    for (const instance of current.activeInstances) {
      const transition = reconcileAppliedEffectInstance(instance, targetTags);
      if (!areTagContainersEqual(targetTags, transition.targetTags)) {
        changed = true;
      }
      targetTags = transition.targetTags;

      if (transition.outcome === 'removed') {
        changed = true;
        continue;
      }

      const nextInstance = transition.instance ?? instance;
      if (nextInstance !== instance) {
        changed = true;
      }
      nextInstances.push(nextInstance);
    }

    if (
      nextInstances.length !== current.activeInstances.length
      || nextInstances.some((instance, index) => instance !== current.activeInstances[index])
    ) {
      changed = true;
    }

    current = createEffectRuntimeState({
      targetTags,
      activeInstances: nextInstances,
    });

    if (!changed) {
      return { runtime: current, passCount: pass };
    }
  }

  return { runtime: current, passCount: maxPasses };
}

export function reconcileEffectRuntimeHostState<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  host: EffectRuntimeHostState<TEffect, TMetadata>,
  options?: { maxPasses?: number },
): EffectRuntimeHostReconcileResult<TEffect, TMetadata> {
  return createEffectRuntimeHostStateFromParts(
    host.baseTargetTags,
    [...host.runtime.activeInstances],
    options,
  );
}

export function syncEffectRuntimeHostBaseTags<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  host: EffectRuntimeHostState<TEffect, TMetadata>,
  baseTargetTags: TagContainer,
  options?: { maxPasses?: number },
): EffectRuntimeHostReconcileResult<TEffect, TMetadata> {
  return createEffectRuntimeHostStateFromParts(
    baseTargetTags,
    [...host.runtime.activeInstances],
    options,
  );
}

export function removeAppliedEffectInstanceFromRuntime<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  instance: AppliedEffectInstance<TEffect, TMetadata>,
  runtime: EffectRuntimeState<TEffect, TMetadata>,
): EffectRuntimeLifecycleResult<TEffect, TMetadata> {
  const result = removeAppliedEffectInstance(instance, runtime.targetTags);
  return {
    ...result,
    runtime: createEffectRuntimeState({
      targetTags: result.targetTags,
      activeInstances: removeRuntimeInstance(runtime.activeInstances, instance),
    }),
  };
}

export function applyEffectSpecToHost<
  TState,
  TEvent,
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  specInput: EffectSpec<TEffect, TMetadata>,
  context: EffectRuntimeHostContext<TState, TEvent, TEffect, TMetadata>,
): EffectRuntimeHostApplyResult<TState, TEvent, TEffect, TMetadata> {
  const applied = applyEffectSpecToRuntime(specInput, {
    state: context.state,
    registry: context.registry,
    runtime: context.host.runtime,
  });
  const reconciledHost = reconcileEffectRuntimeHostState({
    baseTargetTags: context.host.baseTargetTags,
    runtime: applied.runtime,
  });

  return {
    ...applied,
    runtime: reconciledHost.host.runtime,
    host: reconciledHost.host,
  };
}

export function removeAppliedEffectInstanceFromHost<
  TEffect extends EffectDef = EffectDef,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  instance: AppliedEffectInstance<TEffect, TMetadata>,
  host: EffectRuntimeHostState<TEffect, TMetadata>,
  options?: { maxPasses?: number },
): EffectRuntimeHostLifecycleResult<TEffect, TMetadata> {
  const removed = removeAppliedEffectInstanceFromRuntime(instance, host.runtime);
  const reconciledHost = reconcileEffectRuntimeHostState({
    baseTargetTags: host.baseTargetTags,
    runtime: removed.runtime,
  }, options);

  return {
    ...removed,
    runtime: reconciledHost.host.runtime,
    host: reconciledHost.host,
  };
}
