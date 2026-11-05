import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { TicTacToeCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<TicTacToeCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.playerIds': 'strings',
            'core.currentPlayer': 'string',
            'core.cells': 'array',
        }),
    migrations: { 0: (state) => state },
};
