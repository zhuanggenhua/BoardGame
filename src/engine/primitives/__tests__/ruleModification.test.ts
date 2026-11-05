import { describe, expect, it } from 'vitest';
import {
  addRuleModification,
  createRuleModificationStack,
  removeRuleModificationsBySource,
  resolveRuleModifications,
  tickRuleModificationLifetimes,
  type RuleModificationContext,
} from '../ruleModification';

interface TestContext extends RuleModificationContext {
  actorId: string;
}

const source = (sourceId: string) => ({ sourceId, sourceKind: 'card', controllerId: 'p1' });

describe('rule modification primitive', () => {
  it('按优先级执行并保留来源轨迹', () => {
    let stack = createRuleModificationStack<TestContext, number>();
    stack = addRuleModification(stack, {
      id: 'double',
      kind: 'transformation',
      source: source('card-double'),
      priority: 20,
      transform: (value) => ({ value: value * 2 }),
    });
    stack = addRuleModification(stack, {
      id: 'flat',
      kind: 'transformation',
      source: source('card-flat'),
      priority: 10,
      transform: (value) => ({ value: value + 1 }),
    });

    const result = resolveRuleModifications(3, stack, { queryId: 'power', actorId: 'p1' });
    expect(result.value).toBe(8);
    expect(result.appliedIds).toEqual(['flat', 'double']);
    expect(result.trace.map((item) => item.source.sourceId)).toEqual(['card-flat', 'card-double']);
  });

  it('保留拒绝原因，且可按来源移除与按次数过期', () => {
    let stack = createRuleModificationStack<TestContext, string>();
    stack = addRuleModification(stack, {
      id: 'deny',
      kind: 'restriction',
      source: source('card-deny'),
      transform: (value) => ({ value, allowed: false, reason: 'blocked' }),
    });
    stack = addRuleModification(stack, {
      id: 'once',
      kind: 'prevention',
      source: source('card-once'),
      lifetime: { kind: 'uses', remaining: 1 },
      transform: (value) => ({ value: `${value}!` }),
    });

    const denied = resolveRuleModifications('move', stack, { queryId: 'move', actorId: 'p1' });
    expect(denied.allowed).toBe(false);
    expect(denied.reasons).toEqual(['blocked']);

    const ticked = tickRuleModificationLifetimes(stack);
    expect(ticked.expiredIds).toEqual(['once']);
    expect(ticked.stack.entries.map((entry) => entry.def.id)).toEqual(['deny']);

    const removed = removeRuleModificationsBySource(stack, 'card-deny');
    expect(removed.entries.map((entry) => entry.def.id)).toEqual(['once']);
  });
});
