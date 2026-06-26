import type { TokenDef } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, TOKEN_IDS } from '../../domain/ids';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;

export const NINJA_TOKENS: TokenDef[] = [
    {
        id: TOKEN_IDS.DELAYED_POISON,
        name: tokenText(TOKEN_IDS.DELAYED_POISON, 'name'),
        colorTheme: 'from-lime-400 to-yellow-500',
        description: tokenText(TOKEN_IDS.DELAYED_POISON, 'description') as unknown as string[],
        stackLimit: 2,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onTurnEnd',
            removable: true,
        },
        frameId: 'delayed_poison',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.NINJA,
    },
    {
        id: TOKEN_IDS.NINJUTSU,
        name: tokenText(TOKEN_IDS.NINJUTSU, 'name'),
        colorTheme: 'from-slate-400 to-emerald-500',
        description: tokenText(TOKEN_IDS.NINJUTSU, 'description') as unknown as string[],
        stackLimit: 3,
        category: 'consumable',
        activeUse: {
            timing: ['onOffensiveRollEnd'],
            consumeAmount: 1,
            customActionId: 'ninja-ninjutsu-use',
            effect: { type: 'modifyDamageDealt', value: 0 },
        },
        frameId: 'ninjutsu',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.NINJA,
    },
    {
        id: TOKEN_IDS.SMOKE_BOMB,
        name: tokenText(TOKEN_IDS.SMOKE_BOMB, 'name'),
        colorTheme: 'from-zinc-300 to-slate-600',
        description: tokenText(TOKEN_IDS.SMOKE_BOMB, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'buff',
        activeUse: {
            timing: ['beforeDamageReceived'],
            consumeAmount: 1,
            effect: {
                type: 'rollToNegate',
                rollSuccess: { range: [1, 3] },
            },
        },
        frameId: 'smoke_bomb',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.NINJA,
    },
];

export const NINJA_INITIAL_TOKENS: Record<string, number> = {
    [TOKEN_IDS.DELAYED_POISON]: 0,
    [TOKEN_IDS.NINJUTSU]: 0,
    [TOKEN_IDS.SMOKE_BOMB]: 0,
};
