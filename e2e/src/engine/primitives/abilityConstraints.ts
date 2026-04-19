/**
 * 通用能力约束系统
 *
 * 提供可复用的能力激活前置条件检查，避免游戏层重复实现相同逻辑。
 * 
 * 设计原则：
 * - 数据驱动：约束声明在 AbilityDef 中，验证逻辑在引擎层统一处理
 * - 可组合：多个约束可同时生效
 * - 可扩展：游戏层可注册自定义约束检查器
 * - 类型安全：通过泛型保持上下文类型
 *
 * 使用示例：
 * ```typescript
 * // 1. 在 AbilityDef 中声明约束
 * const prepareAbility: AbilityDef = {
 *   id: 'prepare',
 *   constraints: {
 *     actionCost: { type: 'move', count: 1 },
 *     entityState: { notMoved: true },
 *     resource: { charge: { min: 0 } }, // 可选：需要充能
 *   },
 *   // ...
 * };
 *
 * // 2. 在验证层调用
 * const result = checkAbilityConstraints(
 *   ability,
 *   {
 *     actionCounts: { move: 2, attack: 1 },
 *     actionLimits: { move: 3, attack: 3 },
 *     entityState: { hasMoved: false, hasAttacked: false },
 *     resources: { charge: 2, magic: 5 },
 *   },
 *   constraintRegistry, // 可选：自定义约束
 * );
 * ```
 */

// ============================================================================
// 约束类型定义
// ============================================================================

/**
 * 行动消耗约束
 * 
 * 用于"消耗一次移动/攻击行动"的技能（如预备、高阶念力代替攻击）
 */
export interface ActionCostConstraint {
  /** 行动类型（如 'move', 'attack'） */
  type: string;
  /** 消耗数量（默认 1） */
  count?: number;
}

/**
 * 实体状态约束
 * 
 * 用于检查实体的布尔状态（如"未移动"、"未攻击"）
 */
export interface EntityStateConstraint {
  /** 要求实体未移动 */
  notMoved?: boolean;
  /** 要求实体未攻击 */
  notAttacked?: boolean;
  /** 要求实体未使用技能 */
  notUsedAbility?: boolean;
  /** 自定义状态字段检查 { fieldName: expectedValue } */
  custom?: Record<string, boolean | number | string>;
}

/**
 * 资源约束
 * 
 * 用于检查资源数量（如充能、魔力、生命值）
 */
export interface ResourceConstraint {
  /** 资源 ID → 数量要求 */
  [resourceId: string]: {
    /** 最小值（含） */
    min?: number;
    /** 最大值（含） */
    max?: number;
    /** 精确值 */
    exact?: number;
  };
}

/**
 * 使用次数约束
 * 
 * 用于"每回合只能使用 N 次"的技能
 */
export interface UsageLimitConstraint {
  /** 每回合最大使用次数 */
  perTurn?: number;
  /** 每战斗最大使用次数 */
  perBattle?: number;
  /** 每游戏最大使用次数 */
  perGame?: number;
}

/**
 * 自定义约束
 * 
 * 通过注册的处理器评估复杂条件
 */
export interface CustomConstraint {
  /** 处理器名称 */
  handler: string;
  /** 传递给处理器的参数 */
  params?: Record<string, unknown>;
}

/**
 * 能力约束集合
 * 
 * 在 AbilityDef 中声明，所有约束必须同时满足
 */
export interface AbilityConstraints {
  /** 行动消耗约束 */
  actionCost?: ActionCostConstraint;
  /** 实体状态约束 */
  entityState?: EntityStateConstraint;
  /** 资源约束 */
  resource?: ResourceConstraint;
  /** 使用次数约束 */
  usageLimit?: UsageLimitConstraint;
  /** 自定义约束列表 */
  custom?: CustomConstraint[];
}

// ============================================================================
// 约束检查上下文
// ============================================================================

/**
 * 约束检查上下文
 * 
 * 包含验证约束所需的所有状态信息
 */
export interface ConstraintContext {
  /** 行动计数 { actionType: currentCount } */
  actionCounts?: Record<string, number>;
  /** 行动上限 { actionType: maxCount } */
  actionLimits?: Record<string, number>;
  /** 实体状态 */
  entityState?: {
    hasMoved?: boolean;
    hasAttacked?: boolean;
    hasUsedAbility?: boolean;
    [key: string]: boolean | number | string | undefined;
  };
  /** 资源数量 { resourceId: amount } */
  resources?: Record<string, number>;
  /** 使用次数记录 */
  usageCounts?: {
    perTurn?: number;
    perBattle?: number;
    perGame?: number;
  };
  /** 游戏特定扩展字段 */
  [key: string]: unknown;
}

/**
 * 约束检查结果
 */
export interface ConstraintCheckResult {
  /** 是否满足约束 */
  valid: boolean;
  /** 不满足时的错误信息 */
  error?: string;
  /** 失败的约束类型（用于调试） */
  failedConstraint?: string;
}

// ============================================================================
// 自定义约束处理器注册
// ============================================================================

/**
 * 自定义约束处理器函数类型
 */
export type ConstraintHandler = (
  params: Record<string, unknown> | undefined,
  ctx: ConstraintContext,
) => ConstraintCheckResult;

/**
 * 约束处理器注册表
 */
export interface ConstraintHandlerRegistry {
  handlers: Map<string, ConstraintHandler>;
}

/** 创建空的约束处理器注册表 */
export function createConstraintHandlerRegistry(): ConstraintHandlerRegistry {
  return { handlers: new Map() };
}

/** 注册自定义约束处理器 */
export function registerConstraintHandler(
  registry: ConstraintHandlerRegistry,
  name: string,
  handler: ConstraintHandler,
): void {
  registry.handlers.set(name, handler);
}

// ============================================================================
// 约束检查实现
// ============================================================================

/**
 * 检查行动消耗约束
 */
function checkActionCost(
  constraint: ActionCostConstraint,
  ctx: ConstraintContext,
): ConstraintCheckResult {
  const { type, count = 1 } = constraint;
  const currentCount = ctx.actionCounts?.[type] ?? 0;
  const limit = ctx.actionLimits?.[type];

  if (limit === undefined) {
    // 没有配置上限，视为无限制
    return { valid: true };
  }

  if (currentCount + count > limit) {
    return {
      valid: false,
      error: `本回合${type}次数已用完`,
      failedConstraint: 'actionCost',
    };
  }

  return { valid: true };
}

/**
 * 检查实体状态约束
 */
function checkEntityState(
  constraint: EntityStateConstraint,
  ctx: ConstraintContext,
): ConstraintCheckResult {
  const state = ctx.entityState ?? {};

  if (constraint.notMoved && state.hasMoved) {
    return {
      valid: false,
      error: '该单位本回合已移动',
      failedConstraint: 'entityState.notMoved',
    };
  }

  if (constraint.notAttacked && state.hasAttacked) {
    return {
      valid: false,
      error: '该单位本回合已攻击',
      failedConstraint: 'entityState.notAttacked',
    };
  }

  if (constraint.notUsedAbility && state.hasUsedAbility) {
    return {
      valid: false,
      error: '该单位本回合已使用技能',
      failedConstraint: 'entityState.notUsedAbility',
    };
  }

  // 自定义状态字段检查
  if (constraint.custom) {
    for (const [field, expected] of Object.entries(constraint.custom)) {
      if (state[field] !== expected) {
        return {
          valid: false,
          error: `状态不满足：${field}`,
          failedConstraint: `entityState.custom.${field}`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * 检查资源约束
 */
function checkResource(
  constraint: ResourceConstraint,
  ctx: ConstraintContext,
): ConstraintCheckResult {
  const resources = ctx.resources ?? {};

  for (const [resourceId, requirement] of Object.entries(constraint)) {
    const current = resources[resourceId] ?? 0;

    if (requirement.exact !== undefined && current !== requirement.exact) {
      return {
        valid: false,
        error: `${resourceId}必须为${requirement.exact}`,
        failedConstraint: `resource.${resourceId}.exact`,
      };
    }

    if (requirement.min !== undefined && current < requirement.min) {
      return {
        valid: false,
        error: `${resourceId}不足（需要${requirement.min}）`,
        failedConstraint: `resource.${resourceId}.min`,
      };
    }

    if (requirement.max !== undefined && current > requirement.max) {
      return {
        valid: false,
        error: `${resourceId}过多（最多${requirement.max}）`,
        failedConstraint: `resource.${resourceId}.max`,
      };
    }
  }

  return { valid: true };
}

/**
 * 检查使用次数约束
 */
function checkUsageLimit(
  constraint: UsageLimitConstraint,
  ctx: ConstraintContext,
): ConstraintCheckResult {
  const counts = ctx.usageCounts ?? {};

  if (constraint.perTurn !== undefined && (counts.perTurn ?? 0) >= constraint.perTurn) {
    return {
      valid: false,
      error: '每回合只能使用一次',
      failedConstraint: 'usageLimit.perTurn',
    };
  }

  if (constraint.perBattle !== undefined && (counts.perBattle ?? 0) >= constraint.perBattle) {
    return {
      valid: false,
      error: `每战斗最多使用${constraint.perBattle}次`,
      failedConstraint: 'usageLimit.perBattle',
    };
  }

  if (constraint.perGame !== undefined && (counts.perGame ?? 0) >= constraint.perGame) {
    return {
      valid: false,
      error: `每游戏最多使用${constraint.perGame}次`,
      failedConstraint: 'usageLimit.perGame',
    };
  }

  return { valid: true };
}

/**
 * 检查自定义约束
 */
function checkCustomConstraints(
  constraints: CustomConstraint[],
  ctx: ConstraintContext,
  registry?: ConstraintHandlerRegistry,
): ConstraintCheckResult {
  for (const constraint of constraints) {
    if (!registry) {
      throw new Error(`自定义约束 '${constraint.handler}' 需要提供 ConstraintHandlerRegistry`);
    }

    const handler = registry.handlers.get(constraint.handler);
    if (!handler) {
      throw new Error(`未注册的约束处理器: ${constraint.handler}`);
    }

    const result = handler(constraint.params, ctx);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

// ============================================================================
// 主检查函数
// ============================================================================

/**
 * 检查能力约束
 * 
 * 统一检查所有声明的约束，任一约束不满足则返回 valid: false
 * 
 * @param constraints 能力约束声明
 * @param ctx         约束检查上下文
 * @param registry    自定义约束处理器注册表（可选）
 * @returns           检查结果
 */
export function checkAbilityConstraints(
  constraints: AbilityConstraints | undefined,
  ctx: ConstraintContext,
  registry?: ConstraintHandlerRegistry,
): ConstraintCheckResult {
  if (!constraints) {
    return { valid: true };
  }

  // 行动消耗约束
  if (constraints.actionCost) {
    const result = checkActionCost(constraints.actionCost, ctx);
    if (!result.valid) return result;
  }

  // 实体状态约束
  if (constraints.entityState) {
    const result = checkEntityState(constraints.entityState, ctx);
    if (!result.valid) return result;
  }

  // 资源约束
  if (constraints.resource) {
    const result = checkResource(constraints.resource, ctx);
    if (!result.valid) return result;
  }

  // 使用次数约束
  if (constraints.usageLimit) {
    const result = checkUsageLimit(constraints.usageLimit, ctx);
    if (!result.valid) return result;
  }

  // 自定义约束
  if (constraints.custom && constraints.custom.length > 0) {
    const result = checkCustomConstraints(constraints.custom, ctx, registry);
    if (!result.valid) return result;
  }

  return { valid: true };
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 从游戏状态构建约束检查上下文的辅助函数
 * 
 * 游戏层可以实现自己的 builder 函数，将游戏状态映射到 ConstraintContext
 * 
 * @example
 * ```typescript
 * function buildConstraintContext(
 *   core: SummonerWarsCore,
 *   unit: BoardUnit,
 *   playerId: PlayerId,
 * ): ConstraintContext {
 *   return {
 *     actionCounts: {
 *       move: core.players[playerId].moveCount,
 *       attack: core.players[playerId].attackCount,
 *     },
 *     actionLimits: { move: 3, attack: 3 },
 *     entityState: {
 *       hasMoved: unit.hasMoved,
 *       hasAttacked: unit.hasAttacked,
 *     },
 *     resources: {
 *       charge: unit.boosts ?? 0,
 *       magic: core.players[playerId].magic,
 *     },
 *   };
 * }
 * ```
 */
export type ConstraintContextBuilder<TGameState = unknown, TEntity = unknown> = (
  state: TGameState,
  entity: TEntity,
  ...args: unknown[]
) => ConstraintContext;
