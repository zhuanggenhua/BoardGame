import { validateStateFields, type StatePersistenceContract } from '../../../engine/statePersistence';
import type { BetrayalCore } from './types';

/** Version 0 is the known, unversioned pre-contract state. */
export const statePersistence: StatePersistenceContract<BetrayalCore> = {
    version: 1,
    validate: (state) =>
        validateStateFields(state, {
            'core.playerIds': 'strings',
            'core.currentPlayer': 'string',
            'core.phase': 'string',
            'core.rooms': 'array',
            'core.otherExplorers': 'array',
            'core.currentExplorer': 'record',
            'core.currentExplorerTraits': 'record',
            'core.currentExplorerInventory': 'array',
            'core.monsters': 'array',
            'core.roomDiscoveryDeck': 'array',
            'core.pendingCardResolutionQueue': 'array',
        }),
    migrations: { 0: (state) => state },
};
