import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { TheGangCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<TheGangCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.playerIds': 'strings',
            'core.players': 'record',
            'core.rules': 'record',
            'core.deck': 'array',
            'core.discardPile': 'array',
            'core.communityCards': 'array',
            'core.round': 'number',
            'core.phase': 'string',
            'core.heistNumber': 'number',
            'core.successes': 'number',
            'core.failures': 'number',
            'core.roundHistory': 'array',
            'core.heistHistory': 'array',
        }),
    migrations: { 0: (state) => state },
};
