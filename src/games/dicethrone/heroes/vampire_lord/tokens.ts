/** 吸血鬼领主状态与标记定义 */

import type { TokenDef, TokenState } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';

const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;
const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;

export const VAMPIRE_LORD_TOKENS: TokenDef[] = [
    {
        id: TOKEN_IDS.BLOOD_POWER,
        name: tokenText(TOKEN_IDS.BLOOD_POWER, 'name'),
        colorTheme: 'from-red-800 to-rose-600',
        description: tokenText(TOKEN_IDS.BLOOD_POWER, 'description') as unknown as string[],
        sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_blight_curse_001',
        stackLimit: 5,
        category: 'consumable',
        frameId: TOKEN_IDS.BLOOD_POWER,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.VAMPIRE_LORD,
    },
    {
        id: TOKEN_IDS.MESMERIZE,
        name: tokenText(TOKEN_IDS.MESMERIZE, 'name'),
        colorTheme: 'from-purple-700 to-fuchsia-500',
        description: tokenText(TOKEN_IDS.MESMERIZE, 'description') as unknown as string[],
        sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_001',
        stackLimit: 1,
        category: 'consumable',
        frameId: TOKEN_IDS.MESMERIZE,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.VAMPIRE_LORD,
    },
    {
        id: STATUS_IDS.BLEED,
        name: statusText(STATUS_IDS.BLEED, 'name'),
        colorTheme: 'from-red-700 to-rose-500',
        description: statusText(STATUS_IDS.BLEED, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_cut_flesh_001',
        stackLimit: 2,
        category: 'debuff',
        passiveTrigger: {
            timing: 'manual',
            removable: true,
        },
        frameId: STATUS_IDS.BLEED,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.VAMPIRE_LORD,
    },
];

export const VAMPIRE_LORD_TOKEN_MAP: Record<string, TokenDef> = Object.fromEntries(
    VAMPIRE_LORD_TOKENS.map(token => [token.id, token]),
) as Record<string, TokenDef>;

export const VAMPIRE_LORD_INITIAL_TOKENS: TokenState = {
    [TOKEN_IDS.BLOOD_POWER]: 0,
    [TOKEN_IDS.MESMERIZE]: 0,
};

export const VAMPIRE_LORD_INITIAL_STATUS_EFFECTS: Record<string, number> = {
    [STATUS_IDS.BLEED]: 0,
};
