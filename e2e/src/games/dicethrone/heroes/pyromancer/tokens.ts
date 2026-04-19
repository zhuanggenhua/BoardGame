/**
 * 炎术士英雄的 Token 定义
 * 使用统一的 TokenSystem
 * 
 * 包含：
 * - consumable 类型：火焰精通（可主动消耗，增加伤害）
 * - debuff 类型：燃烧（被动触发）
 * - 共享 token：击倒、晕眩（从 sharedTokens 导入）
 */

import type { TokenDef, TokenState } from '../../domain/tokenTypes';
import { TOKEN_IDS, STATUS_IDS, DICETHRONE_STATUS_ATLAS_IDS } from '../../domain/ids';
import { SHARED_TOKENS } from '../../domain/sharedTokens';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;
const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;

/**
 * 炎术士 Token 定义（统一架构）
 * 包含 consumable 和 debuff 类型
 */
export const PYROMANCER_TOKENS: TokenDef[] = [
    // ============================================
    // consumable 类型（可主动消耗）
    // ============================================

    /**
     * 火焰精通 - 增加火焰伤害
     * 效果：由技能效果（custom actions）自动消耗，不通过 Token 响应弹窗交互
     * 上限：5（可通过升级卡提高）
     * 
     * 注意：火焰精通没有 activeUse 配置，因为它不是玩家手动使用的 token。
     * 消耗逻辑在 customActions/pyromancer.ts 中（resolveBurnDown、resolveDmgPerFM 等）。
     */
    {
        id: TOKEN_IDS.FIRE_MASTERY,
        name: tokenText(TOKEN_IDS.FIRE_MASTERY, 'name'),
        colorTheme: 'from-orange-500 to-red-600',
        description: tokenText(TOKEN_IDS.FIRE_MASTERY, 'description') as unknown as string[],
        sfxKey: 'magic.general.simple_magic_sound_fx_pack_vol.fire.flame_armor',
        stackLimit: 5,
        category: 'consumable',
        frameId: 'pyro-status-2',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.PYROMANCER,
    },

    // ============================================
    // debuff 类型（被动触发）
    // ============================================

    /**
     * 燃烧 - 回合开始时受到固定 2 点伤害（可移除的持续效果）
     */
    {
        id: STATUS_IDS.BURN,
        name: statusText(STATUS_IDS.BURN, 'name'),
        colorTheme: 'from-orange-600 to-red-500',
        description: statusText(STATUS_IDS.BURN, 'description') as unknown as string[],
        sfxKey: 'magic.general.simple_magic_sound_fx_pack_vol.fire.flame_chain_a',
        stackLimit: 3,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onTurnStart',
            removable: true, // 可移除的持续效果
            // value 仅为占位，实际伤害固定为 2 点（见 flowHooks.ts）
            actions: [{ type: 'damage', target: 'self', value: 2 }],
        },
        frameId: 'pyro-status-4',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.PYROMANCER,
    },

    // ============================================
    // 共享 token（从 sharedTokens 导入）
    // ============================================
    ...SHARED_TOKENS.filter(t => 
        t.id === STATUS_IDS.KNOCKDOWN || 
        t.id === STATUS_IDS.DAZE
    ),
];

/**
 * 炎术士 Token ID 到定义的映射
 */
export const PYROMANCER_TOKEN_MAP: Record<string, TokenDef> =
    Object.fromEntries(PYROMANCER_TOKENS.map(t => [t.id, t])) as Record<string, TokenDef>;

/**
 * 炎术士初始 Token 状态
 */
export const PYROMANCER_INITIAL_TOKENS: TokenState = {
    [TOKEN_IDS.FIRE_MASTERY]: 0,
    [STATUS_IDS.KNOCKDOWN]: 0,
    [STATUS_IDS.BURN]: 0,
    [STATUS_IDS.DAZE]: 0, // 使用 DAZE 替代 STUN
};
