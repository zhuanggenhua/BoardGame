/** 索尔状态与独一同伴；同伴在tokens中仅存0/1位置，不是可移除状态。 */
import type { TokenDef } from '../../domain/tokenTypes';
import { DICETHRONE_STATUS_ATLAS_IDS, TOKEN_IDS } from '../../domain/ids';

export const THOR_TOKENS: TokenDef[] = [
    {
        id: TOKEN_IDS.GUARD_BREAK,
        name: 'tokens.guard_break.name',
        description: 'tokens.guard_break.description' as unknown as string[],
        category: 'buff',
        stackLimit: 2,
        colorTheme: 'from-cyan-500 to-blue-800',
        activeUse: { timing: ['onOffensiveRollEnd'], consumeAmount: 1, effect: { type: 'custom' }, customActionId: 'thor-guard-break' },
        frameId: TOKEN_IDS.GUARD_BREAK,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.THOR,
    },
    {
        id: TOKEN_IDS.ELECTROKINESIS,
        name: 'tokens.electrokinesis.name',
        description: 'tokens.electrokinesis.description' as unknown as string[],
        category: 'buff',
        stackLimit: 4,
        colorTheme: 'from-violet-600 to-yellow-300',
        frameId: TOKEN_IDS.ELECTROKINESIS,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.THOR,
    },
    {
        id: TOKEN_IDS.MJOLNIR,
        name: 'tokens.mjolnir.name',
        description: 'tokens.mjolnir.description' as unknown as string[],
        category: 'companion',
        stackLimit: 1,
        colorTheme: 'from-cyan-300 to-slate-600',
        passiveTrigger: { timing: 'manual', removable: false, transferable: false },
        frameId: TOKEN_IDS.MJOLNIR,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.THOR,
    },
];

export const THOR_INITIAL_TOKENS = {
    [TOKEN_IDS.GUARD_BREAK]: 0,
    [TOKEN_IDS.ELECTROKINESIS]: 0,
    [TOKEN_IDS.MJOLNIR]: 1,
};
