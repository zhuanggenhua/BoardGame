/**
 * 圣骑士英雄的 Token 定义
 * 使用统一的 TokenSystem
 *
 * 包含：
 * - consumable 类型：暴击、精准、守护、神罚（可主动消耗）
 * - unique 类型：神圣祝福（特殊触发）
 */

import type { TokenDef, TokenState } from '../../../../systems/TokenSystem';
import { TOKEN_IDS } from '../../domain/ids';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;

export const PALADIN_TOKENS: TokenDef[] = [
    // ============================================
    // consumable 类型（可主动消耗）
    // ============================================

    /**
     * 暴击 (Crit) - 增加伤害
     * 消耗 1 层，攻击伤害 +1
     */
    {
        id: TOKEN_IDS.CRIT,
        name: tokenText(TOKEN_IDS.CRIT, 'name'),
        icon: '⚔️',
        colorTheme: 'from-red-500 to-rose-600',
        description: tokenText(TOKEN_IDS.CRIT, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_power_up_fire',
        stackLimit: 3,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageDealt'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageDealt',
                value: 1,
            },
        },
        frameId: 'crit',
    },

    /**
     * 精准 (Accuracy) - 攻击不可防御
     * 消耗 1 层，本次攻击变为不可防御
     */
    {
        id: TOKEN_IDS.ACCURACY,
        name: tokenText(TOKEN_IDS.ACCURACY, 'name'),
        icon: '🎯',
        colorTheme: 'from-blue-500 to-indigo-600',
        description: tokenText(TOKEN_IDS.ACCURACY, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_power_up_lightning',
        stackLimit: 3,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageDealt'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageDealt',
                value: 0, // 不增加伤害，而是使攻击不可防御（逻辑在 custom action 中）
            },
        },
        frameId: 'accuracy',
    },

    /**
     * 守护 (Protect) - 减免伤害
     * 消耗 1 层，受到伤害 -1
     */
    {
        id: TOKEN_IDS.PROTECT,
        name: tokenText(TOKEN_IDS.PROTECT, 'name'),
        icon: '🛡️',
        colorTheme: 'from-amber-500 to-yellow-600',
        description: tokenText(TOKEN_IDS.PROTECT, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.pot_holy_water',
        stackLimit: 3,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageReceived'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageReceived',
                value: -1,
            },
        },
        frameId: 'protect',
    },

    /**
     * 神罚 (Retribution) - 反弹伤害
     * 消耗 1 层，对攻击者造成 2 点不可防御伤害
     */
    {
        id: TOKEN_IDS.RETRIBUTION,
        name: tokenText(TOKEN_IDS.RETRIBUTION, 'name'),
        icon: '⚡',
        colorTheme: 'from-purple-500 to-violet-600',
        description: tokenText(TOKEN_IDS.RETRIBUTION, 'description') as unknown as string[],
        sfxKey: 'magic.general.simple_magic_sound_fx_pack_vol.light.heavenly_flame',
        stackLimit: 3,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageReceived'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageReceived',
                value: 0, // 不减伤，而是反弹 2 点伤害（逻辑在 custom action 中）
            },
        },
        frameId: 'retribution',
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
        icon: '✝️',
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
        frameId: 'blessing-of-divinity',
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
};
