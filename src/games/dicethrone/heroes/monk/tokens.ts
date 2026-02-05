/**
 * 僧侣英雄的 Token 定义
 * 使用统一的 TokenSystem
 * 
 * 包含：
 * - consumable 类型：太极、闪避、净化（可主动消耗）
 * - debuff 类型：击倒（被动触发）
 */

import type { TokenDef, TokenState } from '../../../systems/TokenSystem';
import { TOKEN_IDS, STATUS_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;
const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;

/**
 * 僧侣 Token 定义（统一架构）
 * 包含 consumable 和 debuff 类型
 */
export const MONK_TOKENS: TokenDef[] = [
    // ============================================
    // consumable 类型（可主动消耗）
    // ============================================
    
    /**
     * 太极 - 可用于加伤/减伤
     */
    {
        id: TOKEN_IDS.TAIJI,
        name: tokenText(TOKEN_IDS.TAIJI, 'name'),
        icon: '☯',
        colorTheme: 'from-purple-500 to-indigo-500',
        description: tokenText(TOKEN_IDS.TAIJI, 'description') as unknown as string[],
        stackLimit: 5,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageDealt', 'beforeDamageReceived'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageReceived',
                value: -1,
            },
        },
        frameId: 'tai-chi',
    },
    
    /**
     * 闪避 - 投掷闪避判定
     */
    {
        id: TOKEN_IDS.EVASIVE,
        name: tokenText(TOKEN_IDS.EVASIVE, 'name'),
        icon: '💨',
        colorTheme: 'from-cyan-500 to-blue-500',
        description: tokenText(TOKEN_IDS.EVASIVE, 'description') as unknown as string[],
        stackLimit: 3,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageReceived'],
            consumeAmount: 1,
            effect: {
                type: 'rollToNegate',
                rollSuccess: { range: [1, 2] },
            },
        },
        frameId: 'dodge',
    },
    
    /**
     * 净化 - 移除负面状态
     */
    {
        id: TOKEN_IDS.PURIFY,
        name: tokenText(TOKEN_IDS.PURIFY, 'name'),
        icon: '✨',
        colorTheme: 'from-emerald-400 to-green-500',
        description: tokenText(TOKEN_IDS.PURIFY, 'description') as unknown as string[],
        stackLimit: 3,
        category: 'consumable',
        activeUse: {
            timing: ['anytime'],
            consumeAmount: 1,
            effect: { type: 'removeDebuff' },
        },
        frameId: TOKEN_IDS.PURIFY,
    },
    
    // ============================================
    // debuff 类型（被动触发）
    // ============================================
    
    /**
     * 击倒 - 跳过下个回合的进攻投掷阶段
     */
    {
        id: STATUS_IDS.KNOCKDOWN,
        name: statusText(STATUS_IDS.KNOCKDOWN, 'name'),
        icon: '💫',
        colorTheme: 'from-red-600 to-orange-500',
        description: statusText(STATUS_IDS.KNOCKDOWN, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: true,
            removalCost: { resource: RESOURCE_IDS.CP, amount: 2 },
        },
    },
];

/**
 * 僧侣 Token ID 到定义的映射
 */
export const MONK_TOKEN_MAP: Record<string, TokenDef> = 
    Object.fromEntries(MONK_TOKENS.map(t => [t.id, t])) as Record<string, TokenDef>;

/**
 * 僧侣初始 Token 状态
 */
export const MONK_INITIAL_TOKENS: TokenState = {
    [TOKEN_IDS.TAIJI]: 0,
    [TOKEN_IDS.EVASIVE]: 0,
    [TOKEN_IDS.PURIFY]: 0,
    [STATUS_IDS.KNOCKDOWN]: 0,
};
