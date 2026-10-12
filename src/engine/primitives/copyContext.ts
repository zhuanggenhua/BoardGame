/**
 * 复制 / 借用 / 代理效果的最小执行上下文。
 *
 * 复制只改变效果的执行语义，不改变原始卡牌或能力定义本身。
 * 具体游戏负责把这些稳定 ID 绑定到自己的 ObjectRef / provenance。
 */

export type CopyMode = 'effect-only' | 'ability-with-choice' | 'printed-card-proxy' | 'borrowed-ongoing';
export type CopyPolicy = 'inherit' | 'rebind' | 'reset';

export interface CopySourceRef {
  sourceId: string;
  abilityId?: string;
  effectId?: string;
}

export interface CopyExecutionContext {
  mode: CopyMode;
  source: CopySourceRef;
  copierId: string;
  executorId: string;
  ownerId: string;
  controllerId: string;
  holderId?: string;
  sourceControllerId?: string;
  targetPolicy: CopyPolicy;
  costPolicy: CopyPolicy;
  oncePolicy: CopyPolicy;
  visibilityPolicy: CopyPolicy;
  copyDepth: number;
  maxDepth: number;
  visitedKeys: readonly string[];
  parentFrameId?: string;
  originEventId?: string;
}

export interface CopyExpansionResult {
  allowed: boolean;
  context: CopyExecutionContext;
  rejection?: 'maxDepth' | 'cycle';
}

export function createCopyExecutionContext(
  input: Omit<CopyExecutionContext, 'copyDepth' | 'visitedKeys'> & {
    copyDepth?: number;
    visitedKeys?: readonly string[];
  },
): CopyExecutionContext {
  const initialKey = [input.source.sourceId, input.source.abilityId ?? '', input.source.effectId ?? ''].join(':');
  const visitedKeys = [...(input.visitedKeys ?? [])];
  if (!visitedKeys.includes(initialKey)) visitedKeys.unshift(initialKey);
  return {
    ...input,
    copyDepth: input.copyDepth ?? 0,
    maxDepth: Math.max(0, input.maxDepth),
    visitedKeys,
  };
}

export function copyContextKey(context: Pick<CopyExecutionContext, 'source'>): string {
  return [context.source.sourceId, context.source.abilityId ?? '', context.source.effectId ?? ''].join(':');
}

export function expandCopyContext(
  context: CopyExecutionContext,
  nextSource: CopySourceRef,
): CopyExpansionResult {
  const nextKey = [nextSource.sourceId, nextSource.abilityId ?? '', nextSource.effectId ?? ''].join(':');
  if (context.copyDepth >= context.maxDepth) {
    return { allowed: false, context, rejection: 'maxDepth' };
  }
  if (context.visitedKeys.includes(nextKey)) {
    return { allowed: false, context, rejection: 'cycle' };
  }
  return {
    allowed: true,
    context: {
      ...context,
      source: nextSource,
      copyDepth: context.copyDepth + 1,
      visitedKeys: [...context.visitedKeys, nextKey],
    },
  };
}

export function rebindCopyContext(
  context: CopyExecutionContext,
  patch: Partial<Pick<CopyExecutionContext, 'executorId' | 'ownerId' | 'controllerId' | 'holderId' | 'sourceControllerId'>>,
): CopyExecutionContext {
  return { ...context, ...patch };
}
