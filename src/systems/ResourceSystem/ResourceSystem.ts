/**
 * ResourceSystem - 资源系统核心实现
 */

import type {
    ResourceDefinition,
    ResourcePool,
    ResourceChange,
    ResourceCheckResult,
    ResourceChangeResult,
    IResourceSystem,
} from './types';
import { clampValue } from './types';

/**
 * 资源系统实现
 */
class ResourceSystemImpl implements IResourceSystem {
    private definitions: Map<string, ResourceDefinition> = new Map();

    /**
     * 注册资源定义
     */
    registerDefinition(definition: ResourceDefinition): void {
        this.definitions.set(definition.id, definition);
    }

    /**
     * 批量注册资源定义
     */
    registerDefinitions(definitions: ResourceDefinition[]): void {
        definitions.forEach(def => this.registerDefinition(def));
    }

    /**
     * 获取资源定义
     */
    getDefinition(id: string): ResourceDefinition | undefined {
        return this.definitions.get(id);
    }

    /**
     * 获取所有资源定义
     */
    getAllDefinitions(): ResourceDefinition[] {
        return Array.from(this.definitions.values());
    }

    /**
     * 创建初始资源池
     */
    createPool(definitionIds: string[]): ResourcePool {
        const pool: ResourcePool = {};
        for (const id of definitionIds) {
            const def = this.definitions.get(id);
            if (def) {
                pool[id] = def.initialValue;
            }
        }
        return pool;
    }

    /**
     * 获取资源值
     */
    getValue(pool: ResourcePool, resourceId: string): number {
        return pool[resourceId] ?? 0;
    }

    /**
     * 修改资源
     */
    modify(
        pool: ResourcePool,
        resourceId: string,
        delta: number
    ): ResourceChangeResult {
        const def = this.definitions.get(resourceId);
        const currentValue = pool[resourceId] ?? 0;
        const min = def?.min ?? 0;
        const max = def?.max;

        const rawNewValue = currentValue + delta;
        const newValue = clampValue(rawNewValue, min, max);
        const actualDelta = newValue - currentValue;

        return {
            pool: { ...pool, [resourceId]: newValue },
            actualDelta,
            newValue,
            capped: max !== undefined && rawNewValue > max,
            floored: rawNewValue < min,
        };
    }

    /**
     * 设置资源值
     */
    setValue(
        pool: ResourcePool,
        resourceId: string,
        value: number
    ): ResourceChangeResult {
        const def = this.definitions.get(resourceId);
        const currentValue = pool[resourceId] ?? 0;
        const min = def?.min ?? 0;
        const max = def?.max;

        const newValue = clampValue(value, min, max);
        const actualDelta = newValue - currentValue;

        return {
            pool: { ...pool, [resourceId]: newValue },
            actualDelta,
            newValue,
            capped: max !== undefined && value > max,
            floored: value < min,
        };
    }

    /**
     * 检查是否能支付消耗
     */
    canAfford(pool: ResourcePool, costs: Record<string, number>): ResourceCheckResult {
        const shortages: ResourceCheckResult['shortages'] = [];

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

    /**
     * 支付消耗
     */
    pay(pool: ResourcePool, costs: Record<string, number>): ResourcePool {
        const newPool = { ...pool };
        for (const [resourceId, cost] of Object.entries(costs)) {
            const def = this.definitions.get(resourceId);
            const min = def?.min ?? 0;
            const currentValue = newPool[resourceId] ?? 0;
            newPool[resourceId] = Math.max(min, currentValue - cost);
        }
        return newPool;
    }

    /**
     * 批量修改资源
     */
    modifyBatch(pool: ResourcePool, changes: ResourceChange[]): ResourcePool {
        let currentPool = pool;
        for (const change of changes) {
            const result = this.modify(currentPool, change.resourceId, change.delta);
            currentPool = result.pool;
        }
        return currentPool;
    }
}

/**
 * 资源系统单例
 */
export const resourceSystem: IResourceSystem = new ResourceSystemImpl();

/**
 * 辅助函数：创建资源定义
 */
export function createResourceDefinition(
    id: string,
    name: string,
    options: Partial<Omit<ResourceDefinition, 'id' | 'name'>> = {}
): ResourceDefinition {
    return {
        id,
        name,
        initialValue: options.initialValue ?? 0,
        min: options.min ?? 0,
        max: options.max,
        icon: options.icon,
        color: options.color,
        hidden: options.hidden,
    };
}
