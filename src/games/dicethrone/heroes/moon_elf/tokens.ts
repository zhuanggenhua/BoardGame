/**
 * Moon Elf 英雄的 Token 定义
 * 
 * 包含：
 * - Evasive (闪避): Monk 复用
 * - Blinded (致盲)
 * - Entangle (缠绕)
 * - Targeted (锁定)
 */
import type { TokenDef, TokenState } from '../../domain/tokenTypes';
import { TOKEN_IDS, STATUS_IDS, DICETHRONE_STATUS_ATLAS_IDS } from '../../domain/ids';

// 复用 Monk 的 Evasive 定义，但在 Moon Elf 中重新声明以保持独立性结构，
// 或者引用已有的定义如果完全一致。这里为了方便维护（如果音效/描述有微调），我们复制并适配。
// 实际上 Evasive 是通用的，这里我们重新定义一份以确保正确引用 Text key。

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;
const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;

export const MOON_ELF_TOKENS: TokenDef[] = [
    // ============================================
    // Positive Status / Tokens
    // ============================================

    /**
     * 闪避 (Evasive) - Stack limit 3
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
                rollSuccess: { range: [1, 2] }, // 1-2 成功减伤至0 (Wait, image says 1-2 prevents damage? "如果结果为1-2, 伤害减至0"。 通常 DiceThrone 是 6 成功？不，Monk Evasive 也是 1-2 吗？需确认。Monk Tokens 说 range [1,2]。)
                // Image text: "掷骰1颗。如果结果为1-2，伤害减至0" matches Monk logic.
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
                // 锁定是持续效果，不会在受伤后自动移除，只能通过净化等手段移除
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
