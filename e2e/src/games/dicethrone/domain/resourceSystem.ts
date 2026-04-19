/**
 * DiceThrone 资源系统（本地封装）
 *
 * 使用 engine/primitives/resources 作为底层工具函数，
 * 保持旧 ResourceSystem 的 API（register/modify/setValue/pay 等），
 * 便于平滑迁移。
 */

import type { ResourcePool } from '../../../engine/primitives';
import {
    canAfford,
    createResourcePool,
    getResource,
    modifyResource,
    payResources,
    setResource,
    type ResourceBounds,
} from '../../../engine/primitives';

export interface ResourceDefinition {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    min?: number;
    max?: number;
    initialValue: number;
    hidden?: boolean;
}

export interface ResourceChange {
    resourceId: string;
    delta: number;
}

export interface ResourceCheckResult {
    canAfford: boolean;
    shortages: Array<{
        resourceId: string;
        required: number;
        available: number;
    }>;
}

export interface ResourceChangeResult {
    pool: ResourcePool;
    actualDelta: number;
    newValue: number;
    capped: boolean;
    floored: boolean;
}

class ResourceSystemImpl {
    private definitions = new Map<string, ResourceDefinition>();

    registerDefinition(definition: ResourceDefinition): void {
        this.definitions.set(definition.id, definition);
    }

    registerDefinitions(definitions: ResourceDefinition[]): void {
        definitions.forEach(def => this.registerDefinition(def));
    }

    getDefinition(id: string): ResourceDefinition | undefined {
        return this.definitions.get(id);
    }

    getAllDefinitions(): ResourceDefinition[] {
        return Array.from(this.definitions.values());
    }

    createPool(definitionIds: string[]): ResourcePool {
        const defs: Record<string, number> = {};
        for (const id of definitionIds) {
            const def = this.definitions.get(id);
            if (def) defs[id] = def.initialValue;
        }
        return createResourcePool(defs);
    }

    getValue(pool: ResourcePool, resourceId: string): number {
        return getResource(pool, resourceId);
    }

    modify(pool: ResourcePool, resourceId: string, delta: number): ResourceChangeResult {
        const def = this.definitions.get(resourceId);
        const bounds: ResourceBounds | undefined = def ? { min: def.min ?? 0, max: def.max } : undefined;
        return modifyResource(pool, resourceId, delta, bounds);
    }

    setValue(pool: ResourcePool, resourceId: string, value: number): ResourceChangeResult {
        const def = this.definitions.get(resourceId);
        const bounds: ResourceBounds | undefined = def ? { min: def.min ?? 0, max: def.max } : undefined;
        return setResource(pool, resourceId, value, bounds);
    }

    canAfford(pool: ResourcePool, costs: Record<string, number>): ResourceCheckResult {
        return canAfford(pool, costs);
    }

    pay(pool: ResourcePool, costs: Record<string, number>): ResourcePool {
        const boundsMap: Record<string, ResourceBounds> = {};
        for (const [id, def] of this.definitions.entries()) {
            boundsMap[id] = { min: def.min ?? 0, max: def.max };
        }
        return payResources(pool, costs, boundsMap);
    }

    modifyBatch(pool: ResourcePool, changes: ResourceChange[]): ResourcePool {
        let current = pool;
        for (const change of changes) {
            const result = this.modify(current, change.resourceId, change.delta);
            current = result.pool;
        }
        return current;
    }
}

export const resourceSystem = new ResourceSystemImpl();

export type { ResourcePool };
