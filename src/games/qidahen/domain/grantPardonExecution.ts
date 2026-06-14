import {
    getNonSiegedCityActionSourceSnapshot,
    materializeNonSiegedCityActionSourceRegion,
} from './actionSourceRegionState';
import {
    getFriendlyReceivingRegionSnapshot,
} from './battleState';
import {
    addTroopsToFriendlyBesiegedCityInterior,
    removeTroopsFromNonSiegedCityStateRegion,
} from './cityInteriorTroopTransfer';
import { resolveQidahenPrimaryRuntimeRegionId } from './regionConfig';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import type {
    QidahenCore,
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
    removeTroopsFromNonSiegedCityStateRegion: (
        region: QidahenCore['regions'][number],
        troopLoss: number,
        note: string,
    ) => QidahenCore['regions'][number];
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
    dependencies: QidahenGrantPardonExecutionDependencies = {
        buildSeasonSummary,
        materializeNonSiegedCityActionSourceRegion,
        addTroopsToFriendlyBesiegedCityInterior,
        removeTroopsFromNonSiegedCityStateRegion,
        refreshRuntimeRegionRules,
    },
): QidahenGrantPardonExecutionResult => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(state.selectedRegionId);
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const grantPardonSourceRegion = runtimeRegions.find((region) => (
        region.id === selectedRuntimeRegionId
        && region.controller !== 'ming'
        && getNonSiegedCityActionSourceSnapshot(region).troops > 0
    ));
    const grantPardonDestinationRegion = grantPardonSourceRegion
        ? grantPardonSourceRegion.adjacentRegionIds
            .map((regionId) => runtimeRegions.find((region) => region.id === regionId))
            .filter((region): region is NonNullable<typeof region> => region != null && region.controller === 'ming')
            .sort((left, right) => {
                const leftSource = getFriendlyReceivingRegionSnapshot(left);
                const rightSource = getFriendlyReceivingRegionSnapshot(right);
                return rightSource.troops - leftSource.troops
                    || rightSource.population - leftSource.population
                    || left.name.localeCompare(right.name, 'zh-CN');
            })
            .at(0)
        : null;

    if (!grantPardonSourceRegion || !grantPardonDestinationRegion) {
        return {
            factions,
            lastSeasonSummary: null,
            regions: state.regions,
            selectedRegionId: state.selectedRegionId,
        };
    }

    const nextRuntimeRegions = runtimeRegions.map((region) => {
        if (region.id === grantPardonSourceRegion.id) {
            return dependencies.removeTroopsFromNonSiegedCityStateRegion(
                region,
                1,
                `${region.name} 有 1 个部队经赐印招安后转入 ${grantPardonDestinationRegion.name}。`,
            );
        }
        if (region.id === grantPardonDestinationRegion.id) {
            const actionTargetRegion = dependencies.materializeNonSiegedCityActionSourceRegion(region);
            return dependencies.addTroopsToFriendlyBesiegedCityInterior(
                actionTargetRegion,
                1,
                [],
                `${actionTargetRegion.name} 接收 1 个经赐印招安归化的大明部队。`,
            );
        }
        return region;
    });

    const nextRegions = dependencies.refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const nextFactions: QidahenCore['factions'] = {
        ...factions,
        ming: {
            ...factions.ming,
            troops: factions.ming.troops + 1,
        },
    };
    const sourceFactionId = grantPardonSourceRegion.controller;
    if (sourceFactionId !== 'neutral') {
        nextFactions[sourceFactionId] = {
            ...factions[sourceFactionId],
            troops: Math.max(0, factions[sourceFactionId].troops - 1),
        };
    }

    return {
        factions: nextFactions,
        lastSeasonSummary: dependencies.buildSeasonSummary('赐印招安', timestamp, [
            `${grantPardonSourceRegion.name} 有 1 个部队被招安，转入 ${grantPardonDestinationRegion.name} 并成为大明部队。`,
        ]),
        regions: nextRegions,
        selectedRegionId: grantPardonDestinationRegion.id,
    };
};
