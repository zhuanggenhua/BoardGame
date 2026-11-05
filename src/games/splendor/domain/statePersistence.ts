import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { SplendorCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<SplendorCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.playerOrder': 'strings',
            'core.currentPlayer': 'string',
            'core.round': 'number',
            'core.players': 'record',
            'core.bank': 'record',
            'core.market': 'record',
            'core.decks': 'record',
            'core.nobleIds': 'strings',
            'core.endgame': 'record',
        }),
    migrations: { 0: (state) => state },
};
