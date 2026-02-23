/**
 * DiceThrone Paladin 资源配置
 *
 * 圣骑士角色特定的资源配置。
 * 通用 RESOURCE_IDS 从 domain/resources.ts 导入。
 */

import type { ResourceDefinition } from '../../domain/resourceSystem';
import { INITIAL_HEALTH, MAX_HEALTH, INITIAL_CP, CP_MAX } from '../../domain/types';
import { RESOURCE_IDS } from '../../domain/resources';

export { RESOURCE_IDS } from '../../domain/resources';

export const paladinCpDefinition: ResourceDefinition = {
    id: RESOURCE_IDS.CP,
    name: 'Combat Points',
    icon: '⚡',
    color: '#f59e0b',
    min: 0,
    max: CP_MAX,
    initialValue: INITIAL_CP,
};

export const paladinHpDefinition: ResourceDefinition = {
    id: RESOURCE_IDS.HP,
    name: 'Health Points',
    icon: '❤️',
    color: '#ef4444',
    min: 0,
    max: MAX_HEALTH,
    initialValue: INITIAL_HEALTH,
};

export const paladinResourceDefinitions: ResourceDefinition[] = [
    paladinCpDefinition,
    paladinHpDefinition,
];
