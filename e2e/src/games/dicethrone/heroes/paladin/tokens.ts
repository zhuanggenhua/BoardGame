/**
 * 圣骑士英雄的 Token 定义
 * 使用统一的 TokenSystem
 *
 * 包含：
 * - consumable 类型：暴击、精准、守护、神罚（可主动消耗）
 * - unique 类型：神圣祝福（特殊触发）
 */

import type { TokenDef, TokenState } from '../../domain/tokenTypes';
import { TOKEN_IDS, DICETHRONE_STATUS_ATLAS_IDS } from '../../domain/ids';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;

export const PALADIN_TOKENS: TokenDef[] = [
    // ============================================
    // consumable 类型（可主动消耗）
    // ============================================

    /**
     * 暴击 (Crit) - 条件性加伤
     * 攻击掷骰阶段对敌方造成的伤害≥5时可消耗此标记，+4伤害。不能用于溅射伤害。
     * 不叠加（stackLimit=1）
     */
    {
        id: TOKEN_IDS.CRIT,
        name: tokenText(TOKEN_IDS.CRIT, 'name'),
        colorTheme: 'from-red-500 to-rose-600',
        description: tokenText(TOKEN_IDS.CRIT, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_power_up_fire',
        stackLimit: 1,
        category: 'consumable',
        activeUse: {
            timing: ['onOffensiveRollEnd'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageDealt',
                value: 4, // 固定+4伤害（需伤害≥5才可使用，由处理器门控）
            },
        },
        frameId: 'holy-strike',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.PALADIN,
    },

    /**
     * 精准 (Accuracy) - 攻击不可防御
     * 攻击掷骰阶段结束时可花费此标记，使攻击变为不可防御。
     * 不叠加（stackLimit=1）
     */
    {
        id: TOKEN_IDS.ACCURACY,
        name: tokenText(TOKEN_IDS.ACCURACY, 'name'),
        colorTheme: 'from-blue-500 to-indigo-600',
        description: tokenText(TOKEN_IDS.ACCURACY, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_power_up_lightning',
        stackLimit: 1,
        category: 'consumable',
        activeUse: {
            timing: ['onOffensiveRollEnd'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageDealt',
                value: 0, // 不增加伤害，而是使攻击不可防御
            },
        },
        frameId: 'rallying-cry',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.PALADIN,
    },

    /**
     * 守护 (Protect) - 伤害减半
     * 任何时候花费此标记将即将受到的伤害减半（减的量向上取整）。
     * 不叠加（stackLimit=1）
     */
    {
        id: TOKEN_IDS.PROTECT,
        name: tokenText(TOKEN_IDS.PROTECT, 'name'),
        colorTheme: 'from-amber-500 to-yellow-600',
        description: tokenText(TOKEN_IDS.PROTECT, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.pot_holy_water',
        stackLimit: 1,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageReceived'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageReceived',
                value: 0, // 动态计算：减半当前伤害（向上取整），由处理器实现
            },
        },
        frameId: 'divine-shield',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.PALADIN,
    },

    /**
     * 神罚 (Retribution) - 反弹伤害的一半
     * 受到攻击伤害时可花费此标记，将本次受到伤害的一半（向上取整）返还给对手。
     * 不减少自己所受伤害。不叠加（stackLimit=1）
     */
    {
        id: TOKEN_IDS.RETRIBUTION,
        name: tokenText(TOKEN_IDS.RETRIBUTION, 'name'),
        colorTheme: 'from-purple-500 to-violet-600',
        description: tokenText(TOKEN_IDS.RETRIBUTION, 'description') as unknown as string[],
        sfxKey: 'magic.general.simple_magic_sound_fx_pack_vol.light.heavenly_flame',
        stackLimit: 1,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageReceived'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageReceived',
                value: 0, // 不减伤，反弹伤害的一半（向上取整），由处理器动态计算
            },
        },
        frameId: 'shield-break',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.PALADIN,
    },

    // ============================================
    // passive 类型（被动标记）
    // ============================================

    /**
     * 教会税升级 (Tithes Upgraded) - income 阶段额外 +1CP
     * 升级后，每次 income 阶段获得 2CP 而非 1CP
     */
    {
        id: TOKEN_IDS.TITHES_UPGRADED,
        name: tokenText(TOKEN_IDS.TITHES_UPGRADED, 'name'),
        colorTheme: 'from-emerald-500 to-green-600',
        description: tokenText(TOKEN_IDS.TITHES_UPGRADED, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'unique',
        frameId: 'rallying-cry',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.PALADIN,
    },

    // ============================================
    // unique 类型（特殊触发）
    // ============================================

    /**
     * 神圣祝福 (Blessing of Divinity) - 免疫致死伤害
     * 当受到致死伤害时，移除此标记，将 HP 设为 1 并回复 5 HP
     */
    {
        id: TOKEN_IDS.BLESSING_OF_DIVINITY,
        name: tokenText(TOKEN_IDS.BLESSING_OF_DIVINITY, 'name'),
        colorTheme: 'from-yellow-400 to-amber-500',
        description: tokenText(TOKEN_IDS.BLESSING_OF_DIVINITY, 'description') as unknown as string[],
        sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_celestial_choir_001',
        stackLimit: 1,
        category: 'consumable',
        passiveTrigger: {
            timing: 'onDamageReceived',
            removable: false,
            actions: [
                { type: 'custom', customActionId: 'paladin-blessing-prevent', target: 'self' },
            ],
        },
        frameId: 'guardian-angel',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.PALADIN,
    },
];

/**
 * 圣骑士 Token ID 到定义的映射
 */
export const PALADIN_TOKEN_MAP: Record<string, TokenDef> =
    Object.fromEntries(PALADIN_TOKENS.map(t => [t.id, t])) as Record<string, TokenDef>;

/**
 * 圣骑士初始 Token 状态
 */
export const PALADIN_INITIAL_TOKENS: TokenState = {
    [TOKEN_IDS.CRIT]: 0,
    [TOKEN_IDS.ACCURACY]: 0,
    [TOKEN_IDS.PROTECT]: 0,
    [TOKEN_IDS.RETRIBUTION]: 0,
    [TOKEN_IDS.BLESSING_OF_DIVINITY]: 0,
    [TOKEN_IDS.TITHES_UPGRADED]: 0,
};
