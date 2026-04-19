/**
 * DiceThrone Moon Elf 资源配置
 */
import type { ResourceDefinition } from '../../domain/resourceSystem';
import { INITIAL_HEALTH, MAX_HEALTH, INITIAL_CP, CP_MAX } from '../../domain/types';
import { RESOURCE_IDS } from '../../domain/resources';

export { RESOURCE_IDS } from '../../domain/resources';

export const cpDefinition: ResourceDefinition = {
    id: RESOURCE_IDS.CP,
    name: 'Combat Points',
    icon: '⚡',
    color: '#f59e0b',
    min: 0,
    max: CP_MAX,
    initialValue: INITIAL_CP,
};

export const hpDefinition: ResourceDefinition = {
    id: RESOURCE_IDS.HP,
    name: 'Health Points',
    icon: '❤️',
    color: '#8b5cf6', // Indigo for Moon Elf
    min: 0,
    max: MAX_HEALTH,
    initialValue: INITIAL_HEALTH,
};

export const moonElfResourceDefinitions: ResourceDefinition[] = [
    cpDefinition,
    hpDefinition,
];
