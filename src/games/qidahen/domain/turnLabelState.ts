import { applyQidahenCharacterActionWindowEffects } from './characterActionWindow';
import { buildTurnLabel, isFactionActionTurnComplete } from './factionActionWindow';
import {
    syncQidahenCorePieceCollections,
    syncQidahenCurrentCoreSelections,
} from './coreDerivedState';
import { getCurrentFactionId } from './factionTurnAccessors';
import type { QidahenCore } from './types';

interface QidahenTurnLabelDependencies {
    applyCharacterActionWindowEffects: (
        state: QidahenCore,
    ) => QidahenCore;
    syncCorePieceCollections: (
        state: QidahenCore,
    ) => QidahenCore;
    syncCurrentCoreSelections: (
        state: QidahenCore,
    ) => QidahenCore;
}

export function updateQidahenTurnLabel(
    state: QidahenCore,
    dependencies: QidahenTurnLabelDependencies = {
        applyCharacterActionWindowEffects: applyQidahenCharacterActionWindowEffects,
        syncCorePieceCollections: syncQidahenCorePieceCollections,
        syncCurrentCoreSelections: syncQidahenCurrentCoreSelections,
    },
): QidahenCore {
    const nextState = dependencies.syncCurrentCoreSelections(
        dependencies.syncCorePieceCollections(
            dependencies.applyCharacterActionWindowEffects(state),
        ),
    );
    const currentFactionId = getCurrentFactionId(nextState);
    return {
        ...nextState,
        turnLabel: buildTurnLabel(
            nextState.roundNumber,
            nextState.factions[currentFactionId].name,
            nextState.turnPhase,
            nextState.wheelActionUsed,
            nextState.factionActionUsed,
            !isFactionActionTurnComplete(nextState, currentFactionId) && nextState.factionActionUsed,
        ),
    };
}
