/** 女猎手状态与标记定义 */

import type { TokenDef, TokenState } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';

const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;
const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;

export const LIEREN_TOKENS: TokenDef[] = [
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
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.LIEREN,
    },
    {
        id: TOKEN_IDS.NYRAS_BOND,
        name: tokenText(TOKEN_IDS.NYRAS_BOND, 'name'),
        colorTheme: 'from-emerald-500 to-lime-400',
        description: tokenText(TOKEN_IDS.NYRAS_BOND, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.creatures.creature_wolf_growl_001',
        stackLimit: 1,
        category: 'consumable',
        frameId: TOKEN_IDS.NYRAS_BOND,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.LIEREN,
    },
];

export const LIEREN_TOKEN_MAP: Record<string, TokenDef> = Object.fromEntries(
    LIEREN_TOKENS.map(token => [token.id, token]),
) as Record<string, TokenDef>;

export const LIEREN_INITIAL_TOKENS: TokenState = {
    [TOKEN_IDS.NYRAS_BOND]: 0,
};

export const LIEREN_INITIAL_STATUS_EFFECTS: Record<string, number> = {
    [STATUS_IDS.BLEED]: 0,
};
