import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { DiceThroneCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<DiceThroneCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.players': 'record',
            'core.activePlayerId': 'string',
            'core.startingPlayerId': 'string',
            'core.turnNumber': 'number',
            'core.dice': 'array',
            'core.rollCount': 'number',
            'core.rollLimit': 'number',
            'core.tokenDefinitions': 'array',
            'core.selectedCharacters': 'record',
            'core.readyPlayers': 'record',
            'core.players.*.hand': 'array',
            'core.players.*.deck': 'array',
            'core.players.*.discard': 'array',
            'core.players.*.resources': 'record',
        }),
    migrations: { 0: (state) => state },
};
