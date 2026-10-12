/**
 * Typed rule-modification pipeline.
 *
 * 规则修改不是第二套效果语言。游戏层仍然提供自己的查询上下文和
 * modifier handler；引擎层只负责稳定排序、生命周期和审计轨迹。
 */

export type RuleModificationKind =
  | 'restriction'
  | 'suppression'
  | 'protection'
  | 'replacement'
  | 'prevention'
  | 'transformation'
  | 'cost'
  | 'path'
  | 'classification'
  | 'scoring'
  | 'delayed';

export type RuleModificationLifetime =
  | { kind: 'permanent' }
  | { kind: 'until-round-end' }
  | { kind: 'until-turn-end' }
  | { kind: 'uses'; remaining: number };

export interface RuleModificationSourceRef {
  sourceId: string;
  sourceKind?: string;
  ownerId?: string;
  controllerId?: string;
  holderId?: string;
  sourceControllerId?: string;
  zoneId?: string;
}

export interface RuleModificationResult<TValue> {
  value: TValue;
  allowed?: boolean;
  reason?: string;
  terminal?: boolean;
  consumed?: boolean;
}

export interface RuleModificationContext {
  readonly queryId: string;
  readonly round?: number;
  readonly turn?: number;
  readonly phase?: string;
  readonly [key: string]: unknown;
}

export interface RuleModificationDef<
  TContext extends RuleModificationContext = RuleModificationContext,
  TValue = unknown,
> {
  readonly id: string;
  readonly kind: RuleModificationKind;
  readonly source: RuleModificationSourceRef;
  readonly priority?: number;
  readonly lifetime?: RuleModificationLifetime;
  readonly stacking?: 'all' | 'replace-by-id' | 'exclusive';
  readonly tags?: readonly string[];
  readonly applies?: (context: TContext) => boolean;
  readonly transform: (
    value: TValue,
    context: TContext,
  ) => RuleModificationResult<TValue>;
}

export interface RuleModificationTrace {
  readonly id: string;
  readonly kind: RuleModificationKind;
  readonly source: RuleModificationSourceRef;
  readonly applied: boolean;
  readonly allowed?: boolean;
  readonly reason?: string;
  readonly terminal?: boolean;
}

export interface RuleModificationResolution<TValue> {
  readonly value: TValue;
  readonly allowed: boolean;
  readonly appliedIds: string[];
  readonly skippedIds: string[];
  readonly reasons: string[];
  readonly trace: RuleModificationTrace[];
}

interface OrderedRuleModification<TContext extends RuleModificationContext, TValue> {
  readonly def: RuleModificationDef<TContext, TValue>;
  readonly insertOrder: number;
}

export interface RuleModificationStack<
  TContext extends RuleModificationContext = RuleModificationContext,
  TValue = unknown,
> {
  readonly entries: ReadonlyArray<OrderedRuleModification<TContext, TValue>>;
  readonly nextOrder: number;
}

export const createRuleModificationStack = <
  TContext extends RuleModificationContext = RuleModificationContext,
  TValue = unknown,
>(): RuleModificationStack<TContext, TValue> => ({ entries: [], nextOrder: 0 });

export function addRuleModification<
  TContext extends RuleModificationContext = RuleModificationContext,
  TValue = unknown,
>(
  stack: RuleModificationStack<TContext, TValue>,
  def: RuleModificationDef<TContext, TValue>,
): RuleModificationStack<TContext, TValue> {
  const withoutSameId = stack.entries.filter((entry) => entry.def.id !== def.id);
  return {
    entries: [...withoutSameId, { def, insertOrder: stack.nextOrder }],
    nextOrder: stack.nextOrder + 1,
  };
}

export function removeRuleModification<
  TContext extends RuleModificationContext = RuleModificationContext,
  TValue = unknown,
>(
  stack: RuleModificationStack<TContext, TValue>,
  id: string,
): RuleModificationStack<TContext, TValue> {
  const entries = stack.entries.filter((entry) => entry.def.id !== id);
  return entries.length === stack.entries.length
    ? stack
    : { entries, nextOrder: stack.nextOrder };
}

export function removeRuleModificationsBySource<
  TContext extends RuleModificationContext = RuleModificationContext,
  TValue = unknown,
>(
  stack: RuleModificationStack<TContext, TValue>,
  sourceId: string,
): RuleModificationStack<TContext, TValue> {
  const entries = stack.entries.filter((entry) => entry.def.source.sourceId !== sourceId);
  return entries.length === stack.entries.length
    ? stack
    : { entries, nextOrder: stack.nextOrder };
}

function compareRuleModifications<
  TContext extends RuleModificationContext,
  TValue,
>(
  left: OrderedRuleModification<TContext, TValue>,
  right: OrderedRuleModification<TContext, TValue>,
): number {
  const priorityDelta = (left.def.priority ?? 0) - (right.def.priority ?? 0);
  return priorityDelta !== 0 ? priorityDelta : left.insertOrder - right.insertOrder;
}

export function resolveRuleModifications<
  TContext extends RuleModificationContext = RuleModificationContext,
  TValue = unknown,
>(
  value: TValue,
  stack: RuleModificationStack<TContext, TValue>,
  context: TContext,
): RuleModificationResolution<TValue> {
  let current = value;
  let allowed = true;
  const appliedIds: string[] = [];
  const skippedIds: string[] = [];
  const reasons: string[] = [];
  const trace: RuleModificationTrace[] = [];

  const ordered = [...stack.entries].sort(compareRuleModifications);
  for (const entry of ordered) {
    const { def } = entry;
    if (def.applies && !def.applies(context)) {
      skippedIds.push(def.id);
      trace.push({ id: def.id, kind: def.kind, source: def.source, applied: false });
      continue;
    }

    const result = def.transform(current, context);
    current = result.value;
    appliedIds.push(def.id);
    if (result.allowed === false) {
      allowed = false;
    }
    if (result.reason) reasons.push(result.reason);
    trace.push({
      id: def.id,
      kind: def.kind,
      source: def.source,
      applied: true,
      allowed: result.allowed,
      reason: result.reason,
      terminal: result.terminal,
    });

    if (result.terminal) break;
  }

  return { value: current, allowed, appliedIds, skippedIds, reasons, trace };
}

export function tickRuleModificationLifetimes<
  TContext extends RuleModificationContext = RuleModificationContext,
  TValue = unknown,
>(
  stack: RuleModificationStack<TContext, TValue>,
): { stack: RuleModificationStack<TContext, TValue>; expiredIds: string[] } {
  const expiredIds: string[] = [];
  const entries = stack.entries.flatMap((entry) => {
    const lifetime = entry.def.lifetime;
    if (!lifetime || lifetime.kind === 'permanent' || lifetime.kind === 'until-round-end' || lifetime.kind === 'until-turn-end') {
      return [entry];
    }
    const remaining = lifetime.remaining - 1;
    if (remaining <= 0) {
      expiredIds.push(entry.def.id);
      return [];
    }
    return [{ ...entry, def: { ...entry.def, lifetime: { kind: 'uses', remaining } } }];
  });
  return { stack: entries.length === stack.entries.length ? stack : { entries, nextOrder: stack.nextOrder }, expiredIds };
}

export function consumeRuleModification<
  TContext extends RuleModificationContext = RuleModificationContext,
  TValue = unknown,
>(
  stack: RuleModificationStack<TContext, TValue>,
  id: string,
): RuleModificationStack<TContext, TValue> {
  const entry = stack.entries.find((candidate) => candidate.def.id === id);
  if (!entry || entry.def.lifetime?.kind !== 'uses') return stack;
  return tickRuleModificationLifetimes({ entries: [entry], nextOrder: stack.nextOrder }).stack.entries.length === 0
    ? removeRuleModification(stack, id)
    : addRuleModification(stack, {
      ...entry.def,
      lifetime: { kind: 'uses', remaining: entry.def.lifetime.remaining - 1 },
    });
}
