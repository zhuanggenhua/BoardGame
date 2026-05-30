import type { TokenDef } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, STATUS_IDS } from '../../domain/ids';

const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;

export const CURSED_PIRATE_TOKENS: TokenDef[] = [
    {
        id: STATUS_IDS.CURSED_COIN,
        name: statusText(STATUS_IDS.CURSED_COIN, 'name'),
        colorTheme: 'from-yellow-500 to-amber-900',
        description: statusText(STATUS_IDS.CURSED_COIN, 'description') as unknown as string[],
        stackLimit: 5,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: false,
            actions: [],
        },
        frameId: 'cursed_coin',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.CURSED_PIRATE,
    },
    {
        id: STATUS_IDS.POWDER_KEG,
        name: statusText(STATUS_IDS.POWDER_KEG, 'name'),
        colorTheme: 'from-orange-700 to-red-900',
        description: statusText(STATUS_IDS.POWDER_KEG, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: true,
            actions: [],
        },
        frameId: 'powder_keg',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.CURSED_PIRATE,
    },
    {
        id: STATUS_IDS.WITHER,
        name: statusText(STATUS_IDS.WITHER, 'name'),
        colorTheme: 'from-violet-700 to-slate-950',
        description: statusText(STATUS_IDS.WITHER, 'description') as unknown as string[],
        stackLimit: 2,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onDamageDealt',
            damageTriggerScope: 'opponentAttackDamage',
            removable: true,
            actions: [{ type: 'modifyStat', target: 'self', value: -1 }],
        },
        frameId: 'wither',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.CURSED_PIRATE,
    },
    {
        id: STATUS_IDS.PARLEY,
        name: statusText(STATUS_IDS.PARLEY, 'name'),
        colorTheme: 'from-sky-500 to-slate-700',
        description: statusText(STATUS_IDS.PARLEY, 'description') as unknown as string[],
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: true,
            actions: [],
        },
        frameId: 'parley',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.CURSED_PIRATE,
    },
];

export const CURSED_PIRATE_INITIAL_TOKENS: Record<string, number> = {
    [STATUS_IDS.CURSED_COIN]: 0,
    [STATUS_IDS.POWDER_KEG]: 0,
    [STATUS_IDS.WITHER]: 0,
    [STATUS_IDS.PARLEY]: 0,
};
