import type {
    QidahenArmamentId,
    QidahenCore,
    QidahenFactionId,
    QidahenSeasonSummary,
} from './types';

interface QidahenSelectedActionExecutionResolutionDependencies {
    resolveGrantPardonExecution: (
        state: QidahenCore,
        factions: QidahenCore['factions'],
        timestamp: number,
    ) => {
        factions: QidahenCore['factions'];
        lastSeasonSummary: QidahenSeasonSummary | null;
        regions: QidahenCore['regions'];
        selectedRegionId: string;
    };
    resolveSelectedArmamentUpgradeExecution: (
        state: QidahenCore,
        factions: QidahenCore['factions'],
        currentFactionId: QidahenFactionId,
        selectedArmamentId: QidahenArmamentId | null,
        selectedHandActionCardLabel: string | null,
        timestamp: number,
    ) => {
        factions: QidahenCore['factions'];
        lastSeasonSummary: QidahenSeasonSummary | null;
    };
}

interface QidahenSelectedActionExecutionResolutionResult {
    factions: QidahenCore['factions'];
    lastSeasonSummary: QidahenSeasonSummary | null;
    regions: QidahenCore['regions'];
    selectedRegionId: string;
}

export const resolveQidahenSelectedActionExecutionResolution = (
    state: QidahenCore,
    actionId: string,
    currentFactionId: QidahenFactionId,
    selectedArmamentId: QidahenArmamentId | null,
    selectedHandActionCardLabel: string | null,
    factions: QidahenCore['factions'],
    timestamp: number,
    dependencies: QidahenSelectedActionExecutionResolutionDependencies,
): QidahenSelectedActionExecutionResolutionResult => {
    let nextFactions = factions;
    let nextLastSeasonSummary: QidahenSeasonSummary | null = null;
    let nextRegions = state.regions;
    let nextSelectedRegionId = state.selectedRegionId;

    if (actionId === 'upgrade-armament') {
        const upgradeResolution = dependencies.resolveSelectedArmamentUpgradeExecution(
            state,
            nextFactions,
            currentFactionId,
            selectedArmamentId,
            selectedHandActionCardLabel,
            timestamp,
        );
        nextFactions = upgradeResolution.factions;
        nextLastSeasonSummary = upgradeResolution.lastSeasonSummary;
    }

    if (actionId === 'grant-pardon') {
        const grantPardonResolution = dependencies.resolveGrantPardonExecution(
            state,
            nextFactions,
            timestamp,
        );
        nextFactions = grantPardonResolution.factions;
        nextLastSeasonSummary = grantPardonResolution.lastSeasonSummary;
        nextRegions = grantPardonResolution.regions;
        nextSelectedRegionId = grantPardonResolution.selectedRegionId;
    }

    return {
        factions: nextFactions,
        lastSeasonSummary: nextLastSeasonSummary,
        regions: nextRegions,
        selectedRegionId: nextSelectedRegionId,
    };
};
