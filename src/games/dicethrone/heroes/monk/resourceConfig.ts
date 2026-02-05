/**
 * DiceThrone Monk 资源配置
 * 
 * Monk 角色特定的资源配置（如 max 值）。
 * 通用 RESOURCE_IDS 从 domain/resources.ts 导入。
 */

import type { ResourceDefinition } from '../../../systems/ResourceSystem/types';
import { INITIAL_HEALTH, INITIAL_CP, CP_MAX } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';

// 重新导出以保持向后兼容
export { RESOURCE_IDS } from '../domain/resources';

/**
 * CP（战斗点数）定义
 */
export const cpDefinition: ResourceDefinition = {
    id: RESOURCE_IDS.CP,
    name: 'Combat Points',
    icon: '⚡',
    color: '#f59e0b',
    min: 0,
    max: CP_MAX,
    initialValue: INITIAL_CP,
};

/**
 * HP（生命值）定义
 */
export const hpDefinition: ResourceDefinition = {
    id: RESOURCE_IDS.HP,
    name: 'Health Points',
    icon: '❤️',
    color: '#ef4444',
    min: 0,
    max: INITIAL_HEALTH,
    initialValue: INITIAL_HEALTH,
};

/**
 * 所有 Monk 资源定义
 */
export const monkResourceDefinitions: ResourceDefinition[] = [
    cpDefinition,
    hpDefinition,
];
