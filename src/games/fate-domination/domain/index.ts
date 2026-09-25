import type { DomainCore, GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialFateDominationCore } from './setup';
import { validate } from './commands';
import { execute, reduce } from './reducer';
import type { FateDominationCommand, FateDominationCore, FateDominationEvent } from './types';

export const FateDominationDomain: DomainCore<FateDominationCore, FateDominationCommand, FateDominationEvent> = {
    gameId: 'fate-domination',
    setup: (playerIds: PlayerId[], random: RandomFn) => createInitialFateDominationCore(playerIds, random),
    validate,
    execute,
    reduce,
    playerView: (state, playerId) => ({
        ...state,
        players: Object.fromEntries(state.playerIds.map((id) => [id, id === playerId ? state.players[id] : { ...state.players[id], hand: [], selectedAttackIds: [], activeAttackIds: [] }])),
    }),
    isGameOver: (state): GameOverResult | undefined => state.gameResult,
};

export * from './types';
export * from './setup';
export * from './rules';
