import type { ResourceDefinition } from '../../domain/resourceSystem';
import { INITIAL_HEALTH, MAX_HEALTH, INITIAL_CP, CP_MAX } from '../../domain/types';

export const SHADOW_THIEF_RESOURCES: ResourceDefinition[] = [
    {
        id: 'cp',
        name: 'CP',
        initialValue: INITIAL_CP,
        min: 0,
        max: CP_MAX,
        icon: '⚡',
        color: '#FFA500',
    },
    {
        id: 'hp',
        name: 'HP',
        initialValue: INITIAL_HEALTH,
        min: 0,
        max: MAX_HEALTH, // 规则：玩家可以治疗到超过初始生命值最多 10 点
        icon: '❤️',
        color: '#FF0000',
    },
];
