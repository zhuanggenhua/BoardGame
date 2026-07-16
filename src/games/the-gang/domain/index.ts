import type { DomainCore, GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import { validate } from './commands';
import { execute, reduce } from './reducer';
import { createInitialHeistCore } from './setup';
import type { TheGangCommand, TheGangCore, TheGangEvent } from './types';

export const TheGangDomain: DomainCore<TheGangCore, TheGangCommand, TheGangEvent> = {
    gameId: 'the-gang',

    setup: (playerIds: PlayerId[], random: RandomFn): TheGangCore =>
        createInitialHeistCore(playerIds, random),

    validate,
    execute,
    reduce,

    playerView: (state: TheGangCore, playerId: PlayerId): Partial<TheGangCore> => {
        if (state.phase === 'showdown' || state.phase === 'game-over') {
            return state;
        }

        return {
            ...state,
            players: Object.fromEntries(
                state.playerIds.map((id) => [
                    id,
                    id === playerId
                        ? state.players[id]
                        : { ...state.players[id], pocketCards: [], secondaryPocketCards: [] },
                ]),
            ),
        };
    },

    isGameOver: (state: TheGangCore): GameOverResult | undefined => state.gameResult,
};

export * from './types';
export * from './cards';
export * from './poker';
export * from './showdown';
export * from './expansions';
