/**
 * 僧侣英雄的 Token 定义
 * 使用通用 TokenSystem
 */

import type { TokenDef } from '../../../systems/TokenSystem';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;

/**
 * 僧侣 Token ID 枚举
 */
export type MonkTokenId = 'taiji' | 'evasive' | 'purify';

/**
 * 僧侣 Token 定义
 */
export const MONK_TOKENS: TokenDef[] = [
    {
        id: 'taiji',
        name: tokenText('taiji', 'name'),
        icon: '☯',
        colorTheme: 'from-purple-500 to-indigo-500',
        description: tokenText('taiji', 'description') as unknown as string[],
        stackLimit: 5,
        usableTiming: ['beforeDamageDealt', 'beforeDamageReceived'],
        consumeAmount: 1,
        useEffect: {
            type: 'modifyDamageReceived',
            value: -1,
        },
        frameId: 'tai-chi',
    },
    {
        id: 'evasive',
        name: tokenText('evasive', 'name'),
        icon: '💨',
        colorTheme: 'from-cyan-500 to-blue-500',
        description: tokenText('evasive', 'description') as unknown as string[],
        stackLimit: 3,
        usableTiming: ['beforeDamageReceived'],
        consumeAmount: 1,
        useEffect: {
            type: 'rollToNegate',
            rollSuccess: {
                range: [1, 2],
            },
        },
        frameId: 'dodge',
    },
    {
        id: 'purify',
        name: tokenText('purify', 'name'),
        icon: '✨',
        colorTheme: 'from-emerald-400 to-green-500',
        description: tokenText('purify', 'description') as unknown as string[],
        stackLimit: 3,
        usableTiming: ['anytime'],
        consumeAmount: 1,
        useEffect: {
            type: 'removeDebuff',
        },
        frameId: 'purify',
    },
];

/**
 * 僧侣 Token ID 到定义的映射
 */
export const MONK_TOKEN_MAP: Record<MonkTokenId, TokenDef> = 
    Object.fromEntries(MONK_TOKENS.map(t => [t.id, t])) as Record<MonkTokenId, TokenDef>;

/**
 * 僧侣初始 Token 状态
 */
export const MONK_INITIAL_TOKENS: Record<MonkTokenId, number> = {
    taiji: 0,
    evasive: 0,
    purify: 0,
};
