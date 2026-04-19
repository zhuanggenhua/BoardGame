/**
 * 通用 Action Handler 注册表
 *
 * 设计原则：
 * - 引擎层通用，与具体游戏无关
 * - 泛型支持不同游戏的 Context / Result 类型
 * - 每个游戏创建自己的实例（非全局单例），避免游戏间污染
 * - 提供 getRegisteredIds() 支持引用完整性验证
 *
 * 替代模式：
 * - DiceThrone 的 `customActionRegistry: Map<string, CustomActionEntry>`
 * - SummonerWars 的 abilityResolver.ts if/else 硬编码链
 * - SmashUp 的 `abilityRegistry`（已是注册表模式，可选迁移）
 */

// ============================================================================
// 类型定义
// ============================================================================

/** Action 处理器函数签名 */
export type ActionHandler<TCtx = unknown, TResult = unknown> = (ctx: TCtx) => TResult;

/** 处理器元数据（可选，用于分类/过滤） */
export interface ActionHandlerMeta {
    /** 效果分类标签 */
    categories?: string[];
    /** 是否需要玩家交互 */
    requiresInteraction?: boolean;
    /** 其他游戏特定元数据 */
    [key: string]: unknown;
}

/** 注册条目 */
interface RegistryEntry<TCtx, TResult> {
    handler: ActionHandler<TCtx, TResult>;
    meta?: ActionHandlerMeta;
}

// ============================================================================
// ActionHandlerRegistry
// ============================================================================

/**
 * 通用 Action Handler 注册表
 *
 * 使用示例：
 * ```
 * // DiceThrone
 * const customActions = new ActionHandlerRegistry<CustomActionContext, DiceThroneEvent[]>();
 * customActions.register('pyro-details-dmg-per-fm', resolveDmgPerFM, { categories: ['damage'] });
 *
 * // SummonerWars
 * const customAbilityActions = new ActionHandlerRegistry<AbilityContext, GameEvent[]>();
 * customAbilityActions.register('soul_transfer_request', handleSoulTransfer);
 * ```
 */
export class ActionHandlerRegistry<TCtx = unknown, TResult = unknown> {
    private entries = new Map<string, RegistryEntry<TCtx, TResult>>();
    private label: string;

    /**
     * @param label 注册表名称（用于日志/错误消息）
     */
    constructor(label = 'ActionHandlerRegistry') {
        this.label = label;
    }

    /** 注册处理器 */
    register(
        actionId: string,
        handler: ActionHandler<TCtx, TResult>,
        meta?: ActionHandlerMeta,
    ): void {
        if (this.entries.has(actionId)) {
            console.warn(`[${this.label}] "${actionId}" 已存在，将被覆盖`);
        }
        this.entries.set(actionId, { handler, meta });
    }

    /** 获取处理器 */
    get(actionId: string): ActionHandler<TCtx, TResult> | undefined {
        return this.entries.get(actionId)?.handler;
    }

    /** 获取处理器元数据 */
    getMeta(actionId: string): ActionHandlerMeta | undefined {
        return this.entries.get(actionId)?.meta;
    }

    /** 检查是否已注册 */
    has(actionId: string): boolean {
        return this.entries.has(actionId);
    }

    /** 获取所有已注册的 ID（用于引用完整性验证） */
    getRegisteredIds(): Set<string> {
        return new Set(this.entries.keys());
    }

    /** 获取注册表大小 */
    get size(): number {
        return this.entries.size;
    }

    /** 按分类标签过滤 */
    getByCategory(category: string): Array<{ actionId: string; handler: ActionHandler<TCtx, TResult>; meta?: ActionHandlerMeta }> {
        const results: Array<{ actionId: string; handler: ActionHandler<TCtx, TResult>; meta?: ActionHandlerMeta }> = [];
        for (const [actionId, entry] of this.entries) {
            if (entry.meta?.categories?.includes(category)) {
                results.push({ actionId, handler: entry.handler, meta: entry.meta });
            }
        }
        return results;
    }

    /** 清空（测试用） */
    clear(): void {
        this.entries.clear();
    }
}
