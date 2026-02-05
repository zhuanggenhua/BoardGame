import type { DomainCore, GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import type { SmashUpCommand, SmashUpCore, SmashUpEvent } from './types';
import { validate } from './commands';
import { execute, reduce } from './reducer';

export const SmashUpDomain: DomainCore<SmashUpCore, SmashUpCommand, SmashUpEvent> = {
    gameId: 'smashup',

    setup: (playerIds: PlayerId[], _random: RandomFn): SmashUpCore => ({
        playerIds,
        gameResult: undefined,
    }),

    validate,
    execute,
    reduce,

    isGameOver: (state: SmashUpCore): GameOverResult | undefined => state.gameResult,
};

export type { SmashUpCommand, SmashUpCore, SmashUpEvent } from './types';
