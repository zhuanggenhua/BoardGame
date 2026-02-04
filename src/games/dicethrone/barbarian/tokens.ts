/**
 * 狂战士英雄的 Token 定义
 * 使用统一的 TokenSystem
 * 
 * 包含：
 * - debuff 类型：脑震荡、眩晕（被动触发）
 * 
 * 注意：狂战士没有 consumable 类型的 Token（不像僧侣有太极、闪避、净化）
 */

import type { TokenDef, TokenState } from '../../../systems/TokenSystem';
import { STATUS_IDS } from '../domain/ids';

const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;

/**
 * 狂战士 Token 定义（统一架构）
 * 包含 debuff 类型
 */
export const BARBARIAN_TOKENS: TokenDef[] = [
    // ============================================
    // debuff 类型（被动触发）
    // ============================================
    
    /**
     * 脑震荡 Token
     * 效果：跳过下个收入阶段后自动移除
     * 不可叠加，不可花费移除（但可被净化）
     */
    {
        id: STATUS_IDS.CONCUSSION,
        name: statusText(STATUS_IDS.CONCUSSION, 'name'),
        icon: '💫',
        colorTheme: 'from-red-600 to-orange-500',
        description: statusText(STATUS_IDS.CONCUSSION, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onPhaseEnter', // 在收入阶段开始时检查
            removable: true, // 自动移除，不需要花费移除（但可被净化）
            actions: [{ type: 'skipPhase', target: 'self' }], // 跳过收入阶段
        },
    },
    
    /**
     * 眩晕 Token
     * 效果：无法行动，攻击结束后移除并触发额外攻击
     * 不可叠加，不可花费移除（但可被净化）
     */
    {
        id: STATUS_IDS.DAZE,
        name: statusText(STATUS_IDS.DAZE, 'name'),
        icon: '😵',
        colorTheme: 'from-yellow-600 to-amber-500',
        description: statusText(STATUS_IDS.DAZE, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onAttackEnd', // 在攻击结束时触发额外攻击
            removable: true, // 攻击结束后自动移除（但可被净化）
            actions: [{ type: 'extraAttack', target: 'self' }], // 触发额外攻击
        },
    },
];

/**
 * 狂战士 Token ID 到定义的映射
 */
export const BARBARIAN_TOKEN_MAP: Record<string, TokenDef> = 
    Object.fromEntries(BARBARIAN_TOKENS.map(t => [t.id, t])) as Record<string, TokenDef>;

/**
 * 狂战士初始 Token 状态
 */
export const BARBARIAN_INITIAL_TOKENS: TokenState = {
    [STATUS_IDS.CONCUSSION]: 0,
    [STATUS_IDS.DAZE]: 0,
};
