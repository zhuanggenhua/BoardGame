/**
 * 条件评估工具
 *
 * 提供布尔组合（and/or/not）和比较运算，并允许游戏注册自定义条件处理器。
 * 取代旧 combat preset 的 ConditionRegistry 模式。
 *
 * 设计原则：纯函数 + 注册器模式（注册器作为参数传入，不使用全局单例）
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 比较运算符 */
export type CompareOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

/** 始终为真 */
export interface AlwaysCondition {
  type: 'always';
}

/** 比较条件 */
export interface CompareCondition {
  type: 'compare';
  op: CompareOp;
  /** 左操作数（变量名或字面量） */
  left: string | number;
  /** 右操作数（变量名或字面量） */
  right: string | number;
}

/** AND 组合 */
export interface AndCondition {
  type: 'and';
  conditions: ConditionNode[];
}

/** OR 组合 */
export interface OrCondition {
  type: 'or';
  conditions: ConditionNode[];
}

/** NOT 取反 */
export interface NotCondition {
  type: 'not';
  condition: ConditionNode;
}

/** 自定义条件（通过注册的处理器评估） */
export interface CustomCondition {
  type: 'custom';
  handler: string;
  params?: Record<string, unknown>;
}

/** 条件节点联合类型 */
export type ConditionNode =
  | AlwaysCondition
  | CompareCondition
  | AndCondition
  | OrCondition
  | NotCondition
  | CustomCondition;

/** 条件上下文（变量名 → 值） */
export type ConditionContext = Record<string, unknown>;

// ============================================================================
// 自定义条件处理器注册
// ============================================================================

/**
 * 自定义条件处理器函数类型
 *
 * @param params 条件定义中的 params
 * @param ctx    评估上下文
 * @returns      条件是否满足
 */
export type ConditionHandler = (
  params: Record<string, unknown> | undefined,
  ctx: ConditionContext,
) => boolean;

/**
 * 条件处理器注册表
 *
 * 每个游戏应在 setup 阶段创建自己的实例并注册自定义处理器。
 * 不使用全局单例，避免游戏间污染。
 */
export interface ConditionHandlerRegistry {
  handlers: Map<string, ConditionHandler>;
}

/** 创建空的条件处理器注册表 */
export function createConditionHandlerRegistry(): ConditionHandlerRegistry {
  return { handlers: new Map() };
}

/** 注册自定义条件处理器 */
export function registerConditionHandler(
  registry: ConditionHandlerRegistry,
  name: string,
  handler: ConditionHandler,
): void {
  registry.handlers.set(name, handler);
}

// ============================================================================
// 条件评估
// ============================================================================

/**
 * 解析操作数：字符串视为变量名从 ctx 取值，数字直接返回
 */
function resolveOperand(operand: string | number, ctx: ConditionContext): unknown {
  if (typeof operand === 'number') return operand;
  return ctx[operand];
}

/**
 * 执行比较运算
 */
function compare(op: CompareOp, left: unknown, right: unknown): boolean {
  // 类型统一为 number（如果可以的话）
  const l = typeof left === 'number' ? left : Number(left);
  const r = typeof right === 'number' ? right : Number(right);

  // 如果转换后有 NaN，退回到严格等值比较
  if (Number.isNaN(l) || Number.isNaN(r)) {
    if (op === 'eq') return left === right;
    if (op === 'neq') return left !== right;
    return false;
  }

  switch (op) {
    case 'eq': return l === r;
    case 'neq': return l !== r;
    case 'gt': return l > r;
    case 'gte': return l >= r;
    case 'lt': return l < r;
    case 'lte': return l <= r;
  }
}

/**
 * 评估条件节点
 *
 * @param node     条件节点
 * @param ctx      变量上下文
 * @param registry 自定义处理器注册表（可选，仅 CustomCondition 需要）
 * @returns        条件是否满足
 */
export function evaluateCondition(
  node: ConditionNode,
  ctx: ConditionContext,
  registry?: ConditionHandlerRegistry,
): boolean {
  switch (node.type) {
    case 'always':
      return true;

    case 'compare':
      return compare(
        node.op,
        resolveOperand(node.left, ctx),
        resolveOperand(node.right, ctx),
      );

    case 'and':
      return node.conditions.every(c => evaluateCondition(c, ctx, registry));

    case 'or':
      return node.conditions.some(c => evaluateCondition(c, ctx, registry));

    case 'not':
      return !evaluateCondition(node.condition, ctx, registry);

    case 'custom': {
      if (!registry) {
        throw new Error(`自定义条件 '${node.handler}' 需要提供 ConditionHandlerRegistry`);
      }
      const handler = registry.handlers.get(node.handler);
      if (!handler) {
        throw new Error(`未注册的条件处理器: ${node.handler}`);
      }
      return handler(node.params, ctx);
    }
  }
}
