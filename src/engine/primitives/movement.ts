/**
 * 通用移动查询原语。
 *
 * 这里只处理“路径、成本、限制如何组合”的框架语义，不知道任何游戏的
 * 地点、战场或资源名称。具体游戏通过回调与窄 adapter 提供路线和限制。
 */

export type MovementMode = 'normal' | 'effect';

export type MovementFailureCode =
  | 'notDeployed'
  | 'alreadyThere'
  | 'illegalRoute'
  | 'cannotLeaveLocation'
  | 'cannotEnterLocation'
  | 'pathBlocked'
  | 'locationFull'
  | 'engaged'
  | 'insufficientResource';

export interface MovementFailure {
  code: MovementFailureCode;
  source?: string;
}

export interface MovementCheck {
  valid: boolean;
  failures: readonly MovementFailure[];
}

export interface MovementLegalityQuery<NodeId> {
  from: NodeId | null;
  to: NodeId;
  mode: MovementMode;
  path: readonly NodeId[] | null;
  cost: number | null;
  availableResource?: number;
  enforceResource?: boolean;
  engaged?: boolean;
  ignoreEngagement?: boolean;
  leave: MovementCheck;
  enter: MovementCheck;
  pathCheck: MovementCheck;
}

export interface MovementResolution<NodeId> {
  valid: boolean;
  mode: MovementMode;
  from: NodeId | null;
  to: NodeId;
  path: readonly NodeId[] | null;
  cost: number | null;
  failures: readonly MovementFailure[];
}

const ok = (): MovementCheck => ({ valid: true, failures: [] });

export const movementFailure = (code: MovementFailureCode, source?: string): MovementCheck => ({
  valid: false,
  failures: [{ code, ...(source ? { source } : {}) }],
});

export const movementCheck = (valid: boolean, failure?: MovementFailure): MovementCheck => (
  valid ? ok() : { valid: false, failures: failure ? [failure] : [{ code: 'pathBlocked' }] }
);

export function canEnterLocation(input: { allowed: boolean; failure?: MovementFailure }): MovementCheck {
  return movementCheck(input.allowed, input.failure ?? { code: 'cannotEnterLocation' });
}

export function canLeaveLocation(input: { allowed: boolean; failure?: MovementFailure }): MovementCheck {
  return movementCheck(input.allowed, input.failure ?? { code: 'cannotLeaveLocation' });
}

/**
 * 沿着有向图解析路径。`next` 是当前节点在该规则上下文下的下一节点；
 * 规则改写只需替换这个 resolver，不必修改调用方或 reducer。
 */
export function resolveMovementPath<NodeId>(
  from: NodeId | null,
  to: NodeId,
  next: (node: NodeId) => NodeId | null,
): readonly NodeId[] | null {
  if (from === null || Object.is(from, to)) return null;

  const path: NodeId[] = [from];
  let current = from;
  while (!Object.is(current, to)) {
    const nextNode = next(current);
    if (nextNode === null || path.some((node) => Object.is(node, nextNode))) return null;
    path.push(nextNode);
    current = nextNode;
  }
  return path;
}

export function resolveMovementCost<NodeId>(
  path: readonly NodeId[] | null,
  stepCost: (from: NodeId, to: NodeId, stepIndex: number) => number,
  options: { perStepModifier?: number; flatModifier?: number; free?: boolean } = {},
): number | null {
  if (!path || path.length < 2) return null;
  if (options.free) return 0;

  const baseCost = path.slice(0, -1).reduce((sum, from, index) => {
    const to = path[index + 1];
    return sum + stepCost(from, to, index);
  }, 0);
  const perStepModifier = options.perStepModifier ?? 0;
  const flatModifier = options.flatModifier ?? 0;
  return Math.max(0, baseCost + perStepModifier * (path.length - 1) + flatModifier);
}

function mergeFailures(...checks: MovementCheck[]): MovementFailure[] {
  const merged: MovementFailure[] = [];
  for (const check of checks) {
    for (const failure of check.failures) {
      if (!merged.some((item) => item.code === failure.code && item.source === failure.source)) merged.push(failure);
    }
  }
  return merged;
}

export function resolveMovement<NodeId>(query: MovementLegalityQuery<NodeId>): MovementResolution<NodeId> {
  const failures: MovementFailure[] = [];

  if (query.from === null) failures.push({ code: 'notDeployed' });
  if (query.from !== null && Object.is(query.from, query.to)) failures.push({ code: 'alreadyThere' });
  if (query.path === null || query.path.length < 2 || query.cost === null) failures.push({ code: 'illegalRoute' });
  failures.push(...mergeFailures(query.leave, query.enter, query.pathCheck));

  if (query.engaged && !query.ignoreEngagement) failures.push({ code: 'engaged' });
  if (query.enforceResource && query.cost !== null && (query.availableResource ?? 0) < query.cost) {
    failures.push({ code: 'insufficientResource' });
  }

  const uniqueFailures = failures.filter((failure, index) => failures.findIndex((item) => item.code === failure.code && item.source === failure.source) === index);
  return {
    valid: uniqueFailures.length === 0,
    mode: query.mode,
    from: query.from,
    to: query.to,
    path: query.path,
    cost: query.cost,
    failures: uniqueFailures,
  };
}

export function canNormalMove<NodeId>(query: Omit<MovementLegalityQuery<NodeId>, 'mode'>): MovementCheck {
  const result = resolveMovement({ ...query, mode: 'normal' });
  return { valid: result.valid, failures: result.failures };
}

export function canEffectMove<NodeId>(query: Omit<MovementLegalityQuery<NodeId>, 'mode'>): MovementCheck {
  const result = resolveMovement({ ...query, mode: 'effect' });
  return { valid: result.valid, failures: result.failures };
}
