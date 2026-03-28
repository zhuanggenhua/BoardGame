import type { TokenDef } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, TOKEN_IDS } from '../../domain/ids';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;

export const SAMURAI_TOKENS: TokenDef[] = [
    {
        id: TOKEN_IDS.HONOR,
        name: tokenText(TOKEN_IDS.HONOR, 'name'),
        colorTheme: 'from-emerald-500 to-lime-500',
        description: tokenText(TOKEN_IDS.HONOR, 'description') as unknown as string[],
        stackLimit: 0,
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
        stackLimit: 0,
        category: 'debuff',
        activeUse: {
            timing: ['beforeDamageDealt'],
            consumeAmount: 1,
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
        stackLimit: 0,
        category: 'buff',
        activeUse: {
            timing: ['beforeDamageReceived'],
            consumeAmount: 1,
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
