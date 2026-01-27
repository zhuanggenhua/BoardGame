/**
 * 僧侣英雄的状态效果定义
 * 使用通用 StatusEffectSystem
 * 
 * 注意：太极、闪避、净化已迁移到 TokenSystem（见 tokens.ts）
 * 此文件只保留真正的被动状态效果（如击倒）
 */

import type { StatusEffectDef } from '../../../systems/StatusEffectSystem';

const statusEffectText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;

/**
 * 僧侣状态效果 ID 枚举
 * 注意：evasive, taiji, purify 已迁移到 TokenSystem
 */
export type MonkStatusEffectId = 'stun';

/**
 * 僧侣状态效果定义
 * 只包含真正的被动状态效果
 */
export const MONK_STATUS_EFFECTS: StatusEffectDef[] = [
    {
        id: 'stun',
        name: statusEffectText('stun', 'name'),
        type: 'debuff',
        icon: '💫',
        colorTheme: 'from-red-600 to-orange-500',
        description: statusEffectText('stun', 'description') as unknown as string[],
        stackLimit: 1,
        timing: 'onPhaseEnter',
        removable: true,
        removalCost: { resource: 'cp', amount: 2 },
    },
];

/**
 * 僧侣状态效果 ID 到定义的映射
 */
export const MONK_STATUS_EFFECT_MAP: Record<MonkStatusEffectId, StatusEffectDef> = 
    Object.fromEntries(MONK_STATUS_EFFECTS.map(e => [e.id, e])) as Record<MonkStatusEffectId, StatusEffectDef>;
