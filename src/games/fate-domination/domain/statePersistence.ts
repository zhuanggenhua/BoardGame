import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { FateDominationCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<FateDominationCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.playerIds': 'strings',
            'core.currentPlayerId': 'string',
            'core.round': 'number',
            'core.phase': 'string',
            'core.players': 'record',
            'core.battlefield': 'record',
            'core.turnOrder': 'strings',
            'core.currentTurnIndex': 'number',
            'core.eventDeck': 'array',
            'core.eventDiscard': 'array',
            'core.resolvedLocations': 'array',
            'core.ruleState': 'record',
        }),
    migrations: { 0: (state) => state },
};
