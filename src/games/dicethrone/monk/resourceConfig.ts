/**
 * DiceThrone Monk 资源定义
 */

import type { ResourceDefinition } from '../../../systems/ResourceSystem/types';
import { INITIAL_HEALTH, INITIAL_CP, CP_MAX } from '../domain/types';

/**
 * 资源 ID 常量
 */
export const RESOURCE_IDS = {
    CP: 'cp',
    HP: 'hp',
} as const;

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
