import type { TokenDef } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, TOKEN_IDS } from '../../domain/ids';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;
// 真相源（tip.webp）明确标注：耻辱堆叠限制为 2，因此允许一次性消耗的数量上限也应同步收紧，
// 避免“UI 可选 >2”与“运行时永远不可达”的契约漂移。
const SHAME_CONSUME_AMOUNTS = [1, 2] as const;

export const SAMURAI_TOKEN_SFX_HONOR = 'magic.general.simple_magic_sound_fx_pack_vol.light.heavenly_flame';
export const SAMURAI_TOKEN_SFX_SHAME = 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.pot_explosion';
export const SAMURAI_TOKEN_SFX_RETRIBUTION = 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_power_up_lightning';

export const SAMURAI_TOKENS: TokenDef[] = [
    {
        id: TOKEN_IDS.HONOR,
        name: tokenText(TOKEN_IDS.HONOR, 'name'),
        colorTheme: 'from-emerald-500 to-lime-500',
        description: tokenText(TOKEN_IDS.HONOR, 'description') as unknown as string[],
        sfxKey: SAMURAI_TOKEN_SFX_HONOR,
        // 真相源：tip.webp（堆叠限制 2）
        stackLimit: 2,
        category: 'buff',
        activeUse: {
            timing: ['beforeDamageDealt'],
            consumeAmount: 1,
            allowedConsumeAmounts: [1, 2],
            effect: {
                type: 'modifyDamageDealt',
                value: 1,
                valueByAmount: {
                    1: 1,
                    2: 3,
                },
            },
        },
        frameId: 'honor',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.SAMURAI,
    },
    {
        id: TOKEN_IDS.SHAME,
        name: tokenText(TOKEN_IDS.SHAME, 'name'),
        colorTheme: 'from-rose-500 to-red-600',
        description: tokenText(TOKEN_IDS.SHAME, 'description') as unknown as string[],
        sfxKey: SAMURAI_TOKEN_SFX_SHAME,
        // 真相源：tip.webp（堆叠限制 2）
        stackLimit: 2,
        category: 'debuff',
        activeUse: {
            timing: ['beforeDamageDealt'],
            consumeAmount: 1,
            allowedConsumeAmounts: SHAME_CONSUME_AMOUNTS,
            effect: {
                type: 'modifyDamageDealt',
                value: -1,
            },
        },
        frameId: 'shame',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.SAMURAI,
    },
    {
        id: TOKEN_IDS.SAMURAI_RETRIBUTION,
        name: tokenText(TOKEN_IDS.SAMURAI_RETRIBUTION, 'name'),
        colorTheme: 'from-violet-500 to-fuchsia-600',
        description: tokenText(TOKEN_IDS.SAMURAI_RETRIBUTION, 'description') as unknown as string[],
        sfxKey: SAMURAI_TOKEN_SFX_RETRIBUTION,
        // 真相源：tip.webp（堆叠限制 1）
        stackLimit: 1,
        category: 'buff',
        activeUse: {
            timing: ['beforeDamageReceived'],
            consumeAmount: 1,
            requiresAttackDamage: true,
            customActionId: 'samurai-back-strike-use',
            effect: {
                type: 'modifyDamageReceived',
                value: 0,
            },
        },
        frameId: 'retribution',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.SAMURAI,
    },
];

export const SAMURAI_INITIAL_TOKENS: Record<string, number> = {
    [TOKEN_IDS.HONOR]: 0,
    [TOKEN_IDS.SHAME]: 0,
    [TOKEN_IDS.SAMURAI_RETRIBUTION]: 0,
};
