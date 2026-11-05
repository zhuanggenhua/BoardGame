import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { CardiaCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<CardiaCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.players': 'record',
            'core.playerOrder': 'strings',
            'core.currentPlayerId': 'string',
            'core.turnNumber': 'number',
            'core.phase': 'string',
            'core.encounterHistory': 'array',
            'core.ongoingAbilities': 'array',
            'core.modifierTokens': 'array',
            'core.delayedEffects': 'array',
            'core.players.*.hand': 'array',
            'core.players.*.deck': 'array',
        }),
    migrations: { 0: (state) => state },
};
