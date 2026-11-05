/** 蜘蛛侠状态与标记定义 */

import type { TokenDef, TokenState } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';

const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;
const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;

export const ZHIZHUXIA_TOKENS: TokenDef[] = [
    {
        id: STATUS_IDS.WEBBED,
        name: statusText(STATUS_IDS.WEBBED, 'name'),
        colorTheme: 'from-cyan-700 to-blue-500',
        description: statusText(STATUS_IDS.WEBBED, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.magic.magic_web_001',
        stackLimit: 1,
        category: 'debuff',
        // 落网的关键消费在普通攻击进入防御前完成；这里保留 onDamageReceived 语义
        // 供伤害范围审计和净化判断使用，但不在晚到的伤害计算阶段重复消费。
        passiveTrigger: {
            timing: 'onDamageReceived',
            damageTriggerScope: 'opponentAttackDamage',
            removable: true,
        },
        frameId: STATUS_IDS.WEBBED,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.ZHIZHUXIA,
    },
    {
        id: TOKEN_IDS.COMBO,
        name: tokenText(TOKEN_IDS.COMBO, 'name'),
        colorTheme: 'from-amber-500 to-orange-400',
        description: tokenText(TOKEN_IDS.COMBO, 'description') as unknown as string[],
        sfxKey: 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1',
        stackLimit: 1,
        category: 'consumable',
        frameId: TOKEN_IDS.COMBO,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.ZHIZHUXIA,
    },
    {
        id: TOKEN_IDS.INVISIBLE,
        name: tokenText(TOKEN_IDS.INVISIBLE, 'name'),
        colorTheme: 'from-slate-600 to-indigo-400',
        description: tokenText(TOKEN_IDS.INVISIBLE, 'description') as unknown as string[],
        sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_fade_001',
        stackLimit: 1,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageReceived', 'duringRoll'],
            consumeAmount: 1,
            requiresUnblockable: true,
            requiresDefenseAbilityId: 'spider-sense',
            customActionId: 'zhizhuxia-extra-defense-roll',
            effect: { type: 'modifyDamageReceived', value: 0 },
        },
        frameId: TOKEN_IDS.INVISIBLE,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.ZHIZHUXIA,
    },
];

export const ZHIZHUXIA_TOKEN_MAP: Record<string, TokenDef> = Object.fromEntries(
    ZHIZHUXIA_TOKENS.map(token => [token.id, token]),
) as Record<string, TokenDef>;

export const ZHIZHUXIA_INITIAL_TOKENS: TokenState = {
    [TOKEN_IDS.COMBO]: 0,
    [TOKEN_IDS.INVISIBLE]: 0,
};

export const ZHIZHUXIA_INITIAL_STATUS_EFFECTS: Record<string, number> = {
    [STATUS_IDS.WEBBED]: 0,
};
