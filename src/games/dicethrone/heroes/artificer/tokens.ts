import type { TokenDef } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;
const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;

export const ARTIFICER_TOKENS: TokenDef[] = [
    {
        id: TOKEN_IDS.SYNTH,
        name: tokenText(TOKEN_IDS.SYNTH, 'name'),
        colorTheme: 'from-cyan-300 to-slate-700',
        description: tokenText(TOKEN_IDS.SYNTH, 'description') as unknown as string[],
        iconPath: 'dicethrone/images/artificial/status/合成器',
        stackLimit: 7,
        category: 'consumable',
        frameId: 'synth',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.ARTIFICER,
    },
    {
        id: STATUS_IDS.NANOBOMB,
        name: statusText(STATUS_IDS.NANOBOMB, 'name'),
        colorTheme: 'from-rose-500 to-slate-950',
        description: statusText(STATUS_IDS.NANOBOMB, 'description') as unknown as string[],
        iconPath: 'dicethrone/images/artificial/status/纳米爆蛋',
        stackLimit: 3,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: true,
            actions: [],
        },
        frameId: 'nanobomb',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.ARTIFICER,
    },
    {
        id: TOKEN_IDS.NANOBOT,
        name: tokenText(TOKEN_IDS.NANOBOT, 'name'),
        colorTheme: 'from-emerald-300 to-teal-800',
        description: tokenText(TOKEN_IDS.NANOBOT, 'description') as unknown as string[],
        iconPath: 'dicethrone/images/artificial/status/纳米机器人1次使用机会',
        stackLimit: 1,
        category: 'consumable',
        frameId: 'nanobot',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.ARTIFICER,
    },
    {
        id: TOKEN_IDS.SHOCK_BOT,
        name: tokenText(TOKEN_IDS.SHOCK_BOT, 'name'),
        colorTheme: 'from-sky-300 to-indigo-800',
        description: tokenText(TOKEN_IDS.SHOCK_BOT, 'description') as unknown as string[],
        iconPath: 'dicethrone/images/artificial/status/电能机器人1次使用机会',
        stackLimit: 1,
        category: 'consumable',
        frameId: 'shock_bot',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.ARTIFICER,
    },
    {
        id: TOKEN_IDS.HEAL_BOT,
        name: tokenText(TOKEN_IDS.HEAL_BOT, 'name'),
        colorTheme: 'from-lime-300 to-green-800',
        description: tokenText(TOKEN_IDS.HEAL_BOT, 'description') as unknown as string[],
        iconPath: 'dicethrone/images/artificial/status/治疗机器人1次使用机会',
        stackLimit: 2,
        category: 'consumable',
        frameId: 'heal_bot',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.ARTIFICER,
    },
];

export const ARTIFICER_INITIAL_TOKENS: Record<string, number> = {
    [TOKEN_IDS.SYNTH]: 0,
    [STATUS_IDS.NANOBOMB]: 0,
    [TOKEN_IDS.NANOBOT]: 0,
    [TOKEN_IDS.SHOCK_BOT]: 0,
    [TOKEN_IDS.HEAL_BOT]: 0,
};

