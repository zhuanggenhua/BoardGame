import { describe, expect, it } from 'vitest';
import { createCopyExecutionContext, expandCopyContext, rebindCopyContext } from '../copyContext';

const base = createCopyExecutionContext({
  mode: 'ability-with-choice',
  source: { sourceId: 'card-a', abilityId: 'ability-a' },
  copierId: 'player-1',
  executorId: 'player-1',
  ownerId: 'player-1',
  controllerId: 'player-1',
  targetPolicy: 'rebind',
  costPolicy: 'inherit',
  oncePolicy: 'reset',
  visibilityPolicy: 'inherit',
  maxDepth: 2,
});

describe('copy execution context', () => {
  it('保留复制来源并在展开时增加深度与访问键', () => {
    const result = expandCopyContext(base, { sourceId: 'card-b', abilityId: 'ability-b' });
    expect(result.allowed).toBe(true);
    expect(result.context.copyDepth).toBe(1);
    expect(result.context.source.sourceId).toBe('card-b');
    expect(result.context.visitedKeys).toContain('card-b:ability-b:');
  });

  it('拒绝循环和超过深度的复制链', () => {
    const first = expandCopyContext(base, { sourceId: 'card-b', abilityId: 'ability-b' });
    expect(expandCopyContext(first.context, { sourceId: 'card-b', abilityId: 'ability-b' }).rejection).toBe('cycle');
    expect(expandCopyContext(first.context, { sourceId: 'card-a', abilityId: 'ability-a' }).rejection).toBe('cycle');
    const depthLimited = createCopyExecutionContext({ ...base, copyDepth: 2, maxDepth: 2 });
    expect(expandCopyContext(depthLimited, { sourceId: 'card-c', abilityId: 'ability-c' }).rejection).toBe('maxDepth');
  });

  it('控制者重绑定不丢失原始来源和复制者', () => {
    const rebound = rebindCopyContext(base, { controllerId: 'player-2', executorId: 'player-2' });
    expect(rebound.source).toEqual(base.source);
    expect(rebound.copierId).toBe('player-1');
    expect(rebound.controllerId).toBe('player-2');
  });
});
