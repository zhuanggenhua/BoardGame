import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { QidahenCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<QidahenCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.playerIds': 'strings',
            'core.currentPlayer': 'string',
            'core.roundNumber': 'number',
            'core.turnPhase': 'string',
            'core.factions': 'record',
            'core.regions': 'array',
            'core.handCards': 'array',
            'core.pendingScenarioCharacterChoices': 'array',
            'core.pendingScenarioArmamentChoices': 'array',
            'core.currentFactionOrder': 'strings',
        }),
    migrations: { 0: (state) => state },
};
