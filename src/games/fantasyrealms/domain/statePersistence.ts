import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { FantasyRealmsCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<FantasyRealmsCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.playerIds': 'strings',
            'core.currentPlayer': 'string',
            'core.turn': 'number',
            'core.stage': 'string',
            'core.drawPile': 'array',
            'core.discardPile': 'array',
            'core.players': 'record',
            'core.players.*.hand': 'array',
            'core.players.*.score': 'number',
        }),
    migrations: { 0: (state) => state },
};
