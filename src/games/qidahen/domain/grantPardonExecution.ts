import {
    getNonSiegedCityActionSourceSnapshot,
    materializeNonSiegedCityActionSourceRegion,
} from './actionSourceRegionState';
import {
    addTroopsToFriendlyBesiegedCityInterior,
    removeSelectedTroopFromRegion,
} from './cityInteriorTroopTransfer';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenGrantPardonChoice,
    QidahenSeasonSummary,
} from './types';

interface QidahenGrantPardonExecutionDependencies {
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
    materializeNonSiegedCityActionSourceRegion: (
        region: QidahenCore['regions'][number],
    ) => QidahenCore['regions'][number];
    addTroopsToFriendlyBesiegedCityInterior: (
        region: QidahenCore['regions'][number],
        troops: number,
        specialTroops: QidahenCore['regions'][number]['specialTroops'],
        note: string,
    ) => QidahenCore['regions'][number];
    removeSelectedTroopFromRegion: (
        region: QidahenCore['regions'][number],
        pieceId: string,
        location: 'field' | 'city',
        note: string,
    ) => QidahenCore['regions'][number] | null;
    refreshRuntimeRegionRules: (
        regions: QidahenCore['regions'],
        fortifications: QidahenCore['fortifications'],
    ) => QidahenCore['regions'];
}

interface QidahenGrantPardonExecutionResult {
    factions: QidahenCore['factions'];
    lastSeasonSummary: QidahenSeasonSummary | null;
    regions: QidahenCore['regions'];
    selectedRegionId: string;
}

export const resolveQidahenGrantPardonExecution = (
    state: QidahenCore,
    factions: QidahenCore['factions'],
    timestamp: number,
    choice?: QidahenGrantPardonChoice | null,
    executorFactionId: QidahenFactionId = 'ming',
    dependencies: QidahenGrantPardonExecutionDependencies = {
        buildSeasonSummary,
        materializeNonSiegedCityActionSourceRegion,
        addTroopsToFriendlyBesiegedCityInterior,
        removeSelectedTroopFromRegion,
        refreshRuntimeRegionRules,
    },
): QidahenGrantPardonExecutionResult => {
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const sourceToken = state.mapTokens.find((token) => token.id === choice?.sourceTokenId);
    const selectedPiece = state.pieces.find((piece) => piece.id === choice?.sourcePieceId);
    const grantPardonSourceRegion = runtimeRegions.find((region) => (
        region.id === choice?.sourceRegionId
        && choice?.sourceFactionId !== executorFactionId
        && sourceToken?.type === 'army'
        && sourceToken.regionId === region.id
        && sourceToken.pieceId === selectedPiece?.id
        && selectedPiece?.regionId === region.id
        && selectedPiece.faction === choice?.sourceFactionId
        && selectedPiece.location === choice?.sourceLocation
        && (selectedPiece.location === 'field' || selectedPiece.location === 'city')
    ));
    const grantPardonDestinationRegion = grantPardonSourceRegion
        ? runtimeRegions.find((region) => (
            region.id === choice?.targetRegionId
            && region.controller === executorFactionId
            && grantPardonSourceRegion.adjacentRegionIds.includes(region.id)
        )) ?? null
        : null;

    if (!grantPardonSourceRegion || !grantPardonDestinationRegion) {
        return {
            factions,
            lastSeasonSummary: null,
            regions: state.regions,
            selectedRegionId: state.selectedRegionId,
        };
    }

    const sourcePiece = selectedPiece!;
    const sourceFactionId = choice!.sourceFactionId;
    const sourceBefore = getNonSiegedCityActionSourceSnapshot(grantPardonSourceRegion).troops;
    const destinationBefore = getNonSiegedCityActionSourceSnapshot(grantPardonDestinationRegion).troops;
    const movedTroopStack = {
        id: sourcePiece.sourceStackId,
        label: sourcePiece.label,
        faction: executorFactionId,
        originalFaction: sourcePiece.originalFaction ?? sourcePiece.faction,
        troopClass: sourcePiece.troopClass ?? 'regular' as const,
        troopKind: sourcePiece.troopKind,
        count: 1,
        level: sourcePiece.level,
        pieceIds: [sourcePiece.id],
    };
    const removedSourceRegion = dependencies.removeSelectedTroopFromRegion(
        grantPardonSourceRegion,
        sourcePiece.id,
        sourcePiece.location,
        `${grantPardonSourceRegion.name}有 1 个部队经赐印招安转出。`,
    );
    if (!removedSourceRegion) {
        return {
            factions,
            lastSeasonSummary: null,
            regions: state.regions,
            selectedRegionId: state.selectedRegionId,
        };
    }

    const nextRuntimeRegions = runtimeRegions.map((region) => {
        if (region.id === grantPardonSourceRegion.id) {
            return removedSourceRegion;
        }
        if (region.id === grantPardonDestinationRegion.id) {
            const actionTargetRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            return dependencies.addTroopsToFriendlyBesiegedCityInterior(
                actionTargetRegion,
                1,
                [movedTroopStack],
                `${actionTargetRegion.name} 接收 1 个经赐印招安归化的${state.factions[executorFactionId].name}部队。`,
            );
        }
        return region;
    });

    const nextRegions = dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const nextFactions: QidahenCore['factions'] = {
        ...factions,
        [executorFactionId]: {
            ...factions[executorFactionId],
            troops: factions[executorFactionId].troops + 1,
        },
    };
    nextFactions[sourceFactionId] = {
        ...factions[sourceFactionId],
        troops: Math.max(0, factions[sourceFactionId].troops - 1),
    };
    const sourceAfter = getNonSiegedCityActionSourceSnapshot(
        nextRegions.find((region) => region.id === grantPardonSourceRegion.id) ?? removedSourceRegion,
    ).troops;
    const destinationAfter = getNonSiegedCityActionSourceSnapshot(
        nextRegions.find((region) => region.id === grantPardonDestinationRegion.id) ?? grantPardonDestinationRegion,
    ).troops;

    return {
        factions: nextFactions,
        lastSeasonSummary: dependencies.buildSeasonSummary('赐印招安', timestamp, [
            `${grantPardonSourceRegion.name}部队 ${sourceBefore}→${sourceAfter}；${grantPardonDestinationRegion.name}部队 ${destinationBefore}→${destinationAfter}；${sourcePiece.label}归${state.factions[executorFactionId].name}。`,
        ]),
        regions: nextRegions,
        selectedRegionId: grantPardonDestinationRegion.id,
    };
};
