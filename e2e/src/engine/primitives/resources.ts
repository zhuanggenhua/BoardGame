/**
 * 资源管理工具函数
 *
 * 从 systems/ResourceSystem 提取为纯函数 API。
 * 资源定义（边界、初始值）由游戏层提供，不使用全局注册器。
 *
 * 设计原则：
 * - 纯函数，不可变，返回新对象
 * - 边界配置由调用者传入，引擎不保存状态
 * - 支持 canAfford / pay 常见资源消耗模式
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 资源池（资源名 → 当前值） */
export type ResourcePool = Record<string, number>;

/** 资源边界定义 */
export interface ResourceBounds {
  min?: number;
  max?: number;
}

/** 资源变更结果 */
export interface ResourceChangeResult {
  /** 变更后的资源池 */
  pool: ResourcePool;
  /** 实际变更量（可能被边界限制） */
  actualDelta: number;
  /** 新值 */
  newValue: number;
  /** 是否触发上限 */
  capped: boolean;
  /** 是否触发下限 */
  floored: boolean;
}

/** 资源消耗检查结果 */
export interface AffordCheckResult {
  /** 是否足够 */
  canAfford: boolean;
  /** 不足的资源列表 */
  shortages: Array<{
    resourceId: string;
    required: number;
    available: number;
  }>;
}

// ============================================================================
// 辅助函数
// ============================================================================

/** 将值钳制到边界内 */
export function clampValue(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  return result;
}

// ============================================================================
// 核心操作
// ============================================================================

/** 获取资源值（不存在返回 0） */
export function getResource(pool: ResourcePool, resourceId: string): number {
  return pool[resourceId] ?? 0;
}

/** 设置资源绝对值 */
export function setResource(
  pool: ResourcePool,
  resourceId: string,
  value: number,
  bounds?: ResourceBounds,
): ResourceChangeResult {
  const currentValue = pool[resourceId] ?? 0;
  const min = bounds?.min;
  const max = bounds?.max;
  const newValue = clampValue(value, min, max);
  const actualDelta = newValue - currentValue;

  return {
    pool: { ...pool, [resourceId]: newValue },
    actualDelta,
    newValue,
    capped: max !== undefined && value > max,
    floored: min !== undefined && value < min,
  };
}

/** 修改资源（增减） */
export function modifyResource(
  pool: ResourcePool,
  resourceId: string,
  delta: number,
  bounds?: ResourceBounds,
): ResourceChangeResult {
  const currentValue = pool[resourceId] ?? 0;
  return setResource(pool, resourceId, currentValue + delta, bounds);
}

/** 批量修改资源 */
export function modifyResources(
  pool: ResourcePool,
  changes: Record<string, number>,
  boundsMap?: Record<string, ResourceBounds>,
): ResourcePool {
  let currentPool = pool;
  for (const [resourceId, delta] of Object.entries(changes)) {
    const result = modifyResource(currentPool, resourceId, delta, boundsMap?.[resourceId]);
    currentPool = result.pool;
  }
  return currentPool;
}

/** 检查是否能支付消耗 */
export function canAfford(
  pool: ResourcePool,
  costs: Record<string, number>,
): AffordCheckResult {
  const shortages: AffordCheckResult['shortages'] = [];

  for (const [resourceId, required] of Object.entries(costs)) {
    const available = pool[resourceId] ?? 0;
    if (available < required) {
      shortages.push({ resourceId, required, available });
    }
  }

  return {
    canAfford: shortages.length === 0,
    shortages,
  };
}

/** 支付消耗（返回新池，不检查是否足够） */
export function payResources(
  pool: ResourcePool,
  costs: Record<string, number>,
  boundsMap?: Record<string, ResourceBounds>,
): ResourcePool {
  let currentPool = pool;
  for (const [resourceId, cost] of Object.entries(costs)) {
    const bounds = boundsMap?.[resourceId] ?? { min: 0 };
    const result = modifyResource(currentPool, resourceId, -cost, bounds);
    currentPool = result.pool;
  }
  return currentPool;
}

/** 创建初始资源池 */
export function createResourcePool(
  definitions: Record<string, number>,
): ResourcePool {
  return { ...definitions };
}
