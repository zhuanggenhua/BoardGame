/**
 * ResourceSystem - 通用资源系统类型定义
 * 
 * 支持各类桌游资源机制：
 * - 货币/点数（CP、金币、法力）
 * - 生命值/护盾
 * - 可消耗资源（行动点、能量）
 */

// ============================================================================
// 资源定义（模板）
// ============================================================================

/**
 * 资源定义
 */
export interface ResourceDefinition {
    /** 唯一标识 */
    id: string;
    /** 显示名称（或 i18n key） */
    name: string;
    /** 图标 */
    icon?: string;
    /** 颜色主题 */
    color?: string;
    /** 最小值（默认 0） */
    min?: number;
    /** 最大值（undefined = 无上限） */
    max?: number;
    /** 初始值 */
    initialValue: number;
    /** 是否隐藏（对其他玩家） */
    hidden?: boolean;
}

// ============================================================================
// 资源实例（运行时）
// ============================================================================

/**
 * 资源实例
 */
export interface Resource {
    /** 资源定义 ID */
    definitionId: string;
    /** 当前值 */
    value: number;
}

/**
 * 资源池（玩家持有的所有资源）
 */
export type ResourcePool = Record<string, number>;

// ============================================================================
// 资源操作
// ============================================================================

/**
 * 资源变更操作
 */
export interface ResourceChange {
    /** 资源 ID */
    resourceId: string;
    /** 变更量（正数增加，负数减少） */
    delta: number;
}

/**
 * 资源消耗检查结果
 */
export interface ResourceCheckResult {
    /** 是否足够 */
    canAfford: boolean;
    /** 不足的资源列表 */
    shortages: Array<{
        resourceId: string;
        required: number;
        available: number;
    }>;
}

/**
 * 资源变更结果
 */
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

// ============================================================================
// ResourceSystem 接口
// ============================================================================

/**
 * 资源系统接口
 */
export interface IResourceSystem {
    /** 注册资源定义 */
    registerDefinition(definition: ResourceDefinition): void;

    /** 获取资源定义 */
    getDefinition(id: string): ResourceDefinition | undefined;

    /** 创建初始资源池 */
    createPool(definitionIds: string[]): ResourcePool;

    /** 获取资源值 */
    getValue(pool: ResourcePool, resourceId: string): number;

    /** 修改资源（返回新池，不修改原池） */
    modify(
        pool: ResourcePool,
        resourceId: string,
        delta: number
    ): ResourceChangeResult;

    /** 设置资源值（返回新池） */
    setValue(
        pool: ResourcePool,
        resourceId: string,
        value: number
    ): ResourceChangeResult;

    /** 检查是否能支付消耗 */
    canAfford(pool: ResourcePool, costs: Record<string, number>): ResourceCheckResult;

    /** 支付消耗（返回新池，不检查是否足够） */
    pay(pool: ResourcePool, costs: Record<string, number>): ResourcePool;

    /** 批量修改资源 */
    modifyBatch(pool: ResourcePool, changes: ResourceChange[]): ResourcePool;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 限制值在边界内
 */
export const clampValue = (value: number, min?: number, max?: number): number => {
    let result = value;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
    return result;
};
