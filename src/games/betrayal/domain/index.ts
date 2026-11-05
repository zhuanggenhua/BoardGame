import { statePersistence } from './statePersistence';
import type { DomainCore, PlayerId, RandomFn } from '../../../engine/types';
import type { BetrayalCore } from './types';
import type { BetrayalCommand } from '../commandTypes';
import type { BetrayalEvent } from '../events';
import { createBetrayalCharacterSelectCore } from './stateFactory';
import { validateCommand } from './validate';
import { executeCommand } from './execute';
import { reduceEvent } from './reducer';
import { createBetrayalPlayerView } from './playerView';

export const BetrayalDomain: DomainCore<BetrayalCore, BetrayalCommand, BetrayalEvent> = {
    gameId: 'betrayal',
    statePersistence,
    setup: (playerIds: PlayerId[], random: RandomFn, setupData?: unknown) =>
        createBetrayalCharacterSelectCore(playerIds, random, setupData),
    validate: validateCommand,
    execute: executeCommand,
    reduce: reduceEvent,
    playerView: createBetrayalPlayerView,
    isGameOver: (state) => {
        if (state.phase !== 'endgame' || !state.endgameResult) {
            return undefined;
        }
        return {
            winners: state.endgameResult.winners,
            scores: Object.fromEntries(
                state.playerIds.map((playerId) => [playerId, state.endgameResult?.winners.includes(playerId) ? 1 : 0]),
            ),
        };
    },
};
