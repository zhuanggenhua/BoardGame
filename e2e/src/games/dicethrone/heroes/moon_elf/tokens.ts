/**
 * Moon Elf 英雄的 Token 定义
 * 
 * 包含：
 * - Blinded (致盲)
 * - Entangle (缠绕)
 * - Targeted (锁定)
 * - 共享 token：Evasive (闪避) - 从 sharedTokens 导入
 * 
 * 注意：月精灵的 Evasive 有 activeUse 配置，与共享版本不同，所以保留自己的定义
 */
import type { TokenDef, TokenState } from '../../domain/tokenTypes';
import { TOKEN_IDS, STATUS_IDS, DICETHRONE_STATUS_ATLAS_IDS } from '../../domain/ids';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;
const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;

export const MOON_ELF_TOKENS: TokenDef[] = [
    // ============================================
    // Positive Status / Tokens
    // ============================================

    /**
     * 闪避 (Evasive) - Stack limit 3
     * 
     * 注意：月精灵的 Evasive 有 activeUse 配置（投掷判定），
     * 与共享版本（passiveTrigger）不同，所以保留自己的定义
     */
    {
        id: TOKEN_IDS.EVASIVE,
        name: tokenText(TOKEN_IDS.EVASIVE, 'name'),
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
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.MONK,
    },

    // ============================================
    // Negative Status (Debuffs)
    // ============================================

    /**
     * 致盲 (Blinded) - Does not stack
     * 效果：攻击掷骰阶段结算时，掷骰1颗。1-2：攻击无效。
     * 执行逻辑：game.ts onPhaseExit offensiveRoll 中直接实现（非 token passiveTrigger 通道）
     */
    {
        id: STATUS_IDS.BLINDED,
        name: statusText(STATUS_IDS.BLINDED, 'name'),
        colorTheme: 'from-gray-700 to-black',
        description: statusText(STATUS_IDS.BLINDED, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: true,
            actions: [],
        },
        frameId: 'blinded',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.MOON_ELF,
    },

    /**
     * 缠绕 (Entangle)
     * 效果：下次攻击掷骰少一次 (3 -> 2)。
     * 执行逻辑：game.ts onPhaseEnter offensiveRoll 中实现
     */
    {
        id: STATUS_IDS.ENTANGLE,
        name: statusText(STATUS_IDS.ENTANGLE, 'name'),
        colorTheme: 'from-green-700 to-emerald-900',
        description: statusText(STATUS_IDS.ENTANGLE, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: true,
            actions: [{ type: 'modifyStat', target: 'self', value: -1 }],
        },
        frameId: 'entangle',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.MOON_ELF,
    },

    /**
     * 锁定 (Targeted)
     * 效果：受到的伤害 +2。
     * 执行逻辑：effects.ts resolveEffectAction damage case 中实现
     */
    {
        id: STATUS_IDS.TARGETED,
        name: statusText(STATUS_IDS.TARGETED, 'name'),
        colorTheme: 'from-red-600 to-rose-700',
        description: statusText(STATUS_IDS.TARGETED, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onDamageReceived',
            removable: true,
            actions: [
                { type: 'modifyStat', target: 'self', value: 2 },
            ],
        },
        frameId: 'targeted',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.MOON_ELF,
    },
];

export const MOON_ELF_TOKEN_MAP: Record<string, TokenDef> =
    Object.fromEntries(MOON_ELF_TOKENS.map(t => [t.id, t])) as Record<string, TokenDef>;

export const MOON_ELF_INITIAL_TOKENS: TokenState = {
    [TOKEN_IDS.EVASIVE]: 0,
    [STATUS_IDS.BLINDED]: 0,
    [STATUS_IDS.ENTANGLE]: 0,
    [STATUS_IDS.TARGETED]: 0,
};
