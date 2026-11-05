import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { SummonerWarsCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<SummonerWarsCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.players': 'record',
            'core.currentPlayer': 'string',
            'core.phase': 'string',
            'core.turnNumber': 'number',
            'core.board': 'array',
            'core.board.*': 'array',
            'core.selectedFactions': 'record',
            'core.readyPlayers': 'record',
            'core.players.*.hand': 'array',
            'core.players.*.deck': 'array',
            'core.players.*.discard': 'array',
            'core.players.*.magic': 'number',
        }),
    migrations: { 0: (state) => state },
};
