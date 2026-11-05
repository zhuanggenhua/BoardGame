import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { MageWarsCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<MageWarsCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.playerOrder': 'strings',
            'core.currentPlayerId': 'string',
            'core.turnNumber': 'number',
            'core.players': 'record',
            'core.objects': 'record',
            'core.walls': 'record',
            'core.arena': 'array',
        }),
    migrations: { 0: (state) => state },
};
