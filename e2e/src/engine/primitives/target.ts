/**
 * 目标解析框架
 *
 * 提供内置目标类型（self/opponent/all）和游戏注册的自定义解析器。
 * 取代各游戏独立实现的 resolveTargetUnits / TargetRef 解析逻辑。
 *
 * 设计原则：
 * - 引擎层只定义"目标引用"的结构和解析框架
 * - 具体的目标类型语义由游戏层注册（如 adjacentEnemies、inRange 等）
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 内置目标引用 */
export interface BuiltinTargetRef {
  type: 'self' | 'opponent' | 'all';
}

/** 按 ID 引用 */
export interface IdTargetRef {
  type: 'id';
  id: string;
}

/** 自定义目标引用（通过注册的解析器处理） */
export interface CustomTargetRef {
  type: 'custom';
  resolver: string;
  params?: Record<string, unknown>;
}

/** 目标引用联合类型 */
export type TargetRef = BuiltinTargetRef | IdTargetRef | CustomTargetRef;

/**
 * 解析上下文（游戏层传入，引擎层不关心具体内容）
 *
 * 至少包含 sourceId（技能/效果发起者）
 */
export interface TargetContext {
  sourceId: string;
  [key: string]: unknown;
}

// ============================================================================
// 自定义解析器注册
// ============================================================================

/**
 * 自定义目标解析器函数类型
 *
 * @param params 目标引用中的 params
 * @param ctx    解析上下文
 * @returns      目标 ID 列表
 */
export type TargetResolver = (
  params: Record<string, unknown> | undefined,
  ctx: TargetContext,
) => string[];

/**
 * 目标解析器注册表
 */
export interface TargetResolverRegistry {
  resolvers: Map<string, TargetResolver>;
}

/** 创建空的目标解析器注册表 */
export function createTargetResolverRegistry(): TargetResolverRegistry {
  return { resolvers: new Map() };
}

/** 注册自定义目标解析器 */
export function registerTargetResolver(
  registry: TargetResolverRegistry,
  name: string,
  resolver: TargetResolver,
): void {
  registry.resolvers.set(name, resolver);
}

// ============================================================================
// 目标解析
// ============================================================================

/**
 * 解析目标引用，返回目标 ID 列表
 *
 * @param ref      目标引用
 * @param ctx      解析上下文
 * @param registry 自定义解析器注册表（CustomTargetRef 需要）
 * @returns        目标 ID 列表
 */
export function resolveTarget(
  ref: TargetRef,
  ctx: TargetContext,
  registry?: TargetResolverRegistry,
): string[] {
  switch (ref.type) {
    case 'self':
      return [ctx.sourceId];

    case 'opponent': {
      const opponentId = ctx.opponentId;
      return typeof opponentId === 'string' ? [opponentId] : [];
    }

    case 'all': {
      const allIds = ctx.allIds;
      return Array.isArray(allIds) ? allIds as string[] : [];
    }

    case 'id':
      return [ref.id];

    case 'custom': {
      if (!registry) {
        throw new Error(`自定义目标 '${ref.resolver}' 需要提供 TargetResolverRegistry`);
      }
      const resolver = registry.resolvers.get(ref.resolver);
      if (!resolver) {
        throw new Error(`未注册的目标解析器: ${ref.resolver}`);
      }
      return resolver(ref.params, ctx);
    }
  }
}
