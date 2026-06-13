import { getCurrentFactionId } from './factionTurnAccessors';
import {
    getQidahenFortificationMaintenanceSelectionForCore,
    getQidahenInteractionSelectionStateForCore,
} from './interactionSelectionAccessors';
import { syncQidahenCorePieceCollections } from './coreDerivedState';
import {
    resolveQidahenNewYear,
} from './seasonResolution';
import type {
    QidahenCasualtyPriority,
    QidahenCore,
    QidahenFortificationMaintenanceMode,
    QidahenFortificationMaintenanceSelection,
} from './types';
import { advanceQidahenTurnIfReady } from './turnAdvance';
import { applyQidahenVictoryStatus } from './victoryResolution';

type QidahenNewYearResolution = Pick<
    QidahenCore,
    'currentYearIndex' | 'currentYear' | 'currentFactionOrder' | 'yearCards' | 'factions' | 'regions' | 'fortifications' | 'koreaDeckCount' | 'lastSeasonSummary'
>;

interface QidahenFortificationMaintenanceDependencies {
    resolveNewYear: (
        state: QidahenCore,
        timestamp: number,
        maintenanceMode?: QidahenFortificationMaintenanceMode,
        attritionPriority?: QidahenCasualtyPriority,
    ) => QidahenNewYearResolution;
    syncCorePieceCollections: (
        state: QidahenCore,
    ) => QidahenCore;
    applyVictoryStatus: (
        state: QidahenCore,
        options?: {
            allowHegemony?: boolean;
        },
    ) => QidahenCore;
    advanceTurnIfReady: (
        state: QidahenCore,
        timestamp: number,
    ) => QidahenCore;
}

export const resolveQidahenFortificationMaintenanceInteractionChoice = (
    state: QidahenCore,
    choiceId: QidahenFortificationMaintenanceMode,
    timestamp: number,
    attritionPriority?: QidahenCasualtyPriority,
    interactionSelection?: QidahenFortificationMaintenanceSelection | null,
    dependencies: QidahenFortificationMaintenanceDependencies = {
        resolveNewYear: resolveQidahenNewYear,
        syncCorePieceCollections: syncQidahenCorePieceCollections,
        applyVictoryStatus: applyQidahenVictoryStatus,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        getQidahenFortificationMaintenanceSelectionForCore,
    );
    if (!selection) {
        return state;
    }
    const newYearResolution = dependencies.resolveNewYear(
        state,
        timestamp,
        choiceId,
        attritionPriority,
    );
    const nextState = {
        ...state,
        turnPhase: 'action-window' as const,
        currentYearIndex: newYearResolution.currentYearIndex,
        currentYear: newYearResolution.currentYear,
        currentFactionOrder: newYearResolution.currentFactionOrder,
        yearCards: newYearResolution.yearCards,
        factions: newYearResolution.factions,
        regions: newYearResolution.regions,
        fortifications: newYearResolution.fortifications,
        koreaDeckCount: newYearResolution.koreaDeckCount,
        lastSeasonSummary: newYearResolution.lastSeasonSummary,
        actionLog: [
            {
                id: `log-new-year-${timestamp}`,
                faction: getCurrentFactionId(state),
                text: `大明选择${choiceId === 'skip-all' ? '放弃维护全部防线' : '尽量维护防线'}，已执行新年结算。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    };
    const syncedNextState = dependencies.syncCorePieceCollections(nextState);
    return dependencies.advanceTurnIfReady(
        dependencies.applyVictoryStatus(syncedNextState, { allowHegemony: true }),
        timestamp,
    );
};
