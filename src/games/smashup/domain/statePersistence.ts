import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { SmashUpCore } from './types';
import { normalizeLegacySmashUpMatchState } from './migrateLegacyState';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<SmashUpCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.players': 'record',
            'core.turnOrder': 'strings',
            'core.currentPlayerIndex': 'number',
            'core.bases': 'array',
            'core.baseDeck': 'strings',
            'core.baseDiscard': 'strings',
            'core.turnNumber': 'number',
            'core.nextUid': 'number',
            'core.players.*.hand': 'array',
            'core.players.*.deck': 'array',
            'core.players.*.discard': 'array',
            'core.players.*.vp': 'number',
            'core.players.*.minionsPlayed': 'number',
            'core.players.*.minionLimit': 'number',
            'core.players.*.actionsPlayed': 'number',
            'core.players.*.actionLimit': 'number',
            'core.bases.*.minions': 'array',
            'core.bases.*.ongoingActions': 'array',
        }),
    migrations: { 0: normalizeLegacySmashUpMatchState },
};
