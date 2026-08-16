import { QIDAHEN_RUNTIME_REGION_DEFINITIONS, getQidahenBoundaryTypeMeta, type QidahenPassageBoundaryType } from '../ui/mapGraph';
import {
    getQidahenLogicalRuleRegionConfigs,
    resolveQidahenRuleRegionConfig,
} from './regionConfig';
import { getRegionControlLabel } from './factionLabelSemantics';
import {
    cloneCityStateAsPieceSnapshot,
    cloneRuntimeRegionAsPieceSnapshot,
    cloneSiegeStateAsPieceSnapshot,
    mergeSpecialTroopStackGroupsAsPieces,
} from './troopCompat';
import type { QidahenCore, QidahenFortificationState } from './types';

const STATEFUL_REGION_NAME_OVERRIDES: Partial<Record<string, string>> = {
    'city-region-22': '东江',
    'city-region-18': '平壤',
    'city-region-29': '汉城',
    'song-jin': '皮岛',
};

export const getQidahenStatefulRegionDisplayName = (regionId: string): string => (
    STATEFUL_REGION_NAME_OVERRIDES[regionId] ?? resolveQidahenRuleRegionConfig(regionId).name
);

const appendLogicalRuleRegions = (runtimeRegions: QidahenCore['regions']): QidahenCore['regions'] => {
    const runtimeRegionsById = new Map(runtimeRegions.map((region) => [region.id, region]));
    const logicalRegions = getQidahenLogicalRuleRegionConfigs()
        .map((config) => {
            const members = config.runtimeRegionIds
                .map((runtimeRegionId) => runtimeRegionsById.get(runtimeRegionId))
                .filter((region): region is NonNullable<typeof region> => region != null);
            const primary = runtimeRegionsById.get(config.primaryRuntimeRegionId) ?? members[0];
            if (!primary || members.length === 0) {
                return null;
            }

            const adjacentRegionIds = Array.from(new Set(
                members.flatMap((region) => region.adjacentRegionIds),
            )).filter((regionId) => !config.runtimeRegionIds.includes(regionId)).sort();
            const movementCostByRegionId = adjacentRegionIds.reduce<Record<string, number>>((acc, regionId) => {
                const costs = members
                    .map((region) => region.movementCostByRegionId[regionId])
                    .filter((cost): cost is number => typeof cost === 'number' && Number.isFinite(cost));
                if (costs.length > 0) {
                    acc[regionId] = Math.min(...costs);
                }
                return acc;
            }, {});
            const travelCostByRegionId = adjacentRegionIds.reduce<Record<string, number>>((acc, regionId) => {
                const costs = members
                    .map((region) => region.travelCostByRegionId[regionId])
                    .filter((cost): cost is number => typeof cost === 'number' && Number.isFinite(cost));
                if (costs.length > 0) {
                    acc[regionId] = Math.min(...costs);
                }
                return acc;
            }, {});
            const boundaryTypeByRegionId = adjacentRegionIds.reduce<Record<string, string>>((acc, regionId) => {
                const type = members
                    .map((region) => region.boundaryTypeByRegionId[regionId])
                    .find((value): value is string => typeof value === 'string' && value.length > 0);
                if (type) {
                    acc[regionId] = type;
                }
                return acc;
            }, {});
            const x = members.reduce((sum, region) => sum + region.x, 0) / members.length;
            const y = members.reduce((sum, region) => sum + region.y, 0) / members.length;
            return {
                id: config.id,
                name: config.name,
                isLogicalRegion: true,
                primaryRuntimeRegionId: config.primaryRuntimeRegionId,
                runtimeRegionIds: [...config.runtimeRegionIds],
                controller: primary.controller,
                diplomacyMarkerFaction: primary.diplomacyMarkerFaction,
                diplomacyMarkerSide: primary.diplomacyMarkerSide,
                x,
                y,
                troops: members.reduce((sum, region) => sum + region.troops, 0),
                population: members.reduce((sum, region) => sum + region.population, 0),
                controlLabel: getRegionControlLabel(primary),
                note: `${config.name} · 规则兼容区，映射 ${config.runtimeRegionIds.join('、')}。`,
                siegeState: cloneSiegeStateAsPieceSnapshot(primary),
                cityState: cloneCityStateAsPieceSnapshot(primary),
                eventMarkers: members.flatMap((member) => member.eventMarkers.map((marker) => ({ ...marker }))),
                specialTroops: mergeSpecialTroopStackGroupsAsPieces(
                    ...members.map((member) => member.specialTroops),
                ),
                adjacentRegionIds,
                travelCostByRegionId,
                movementCostByRegionId,
                boundaryTypeByRegionId,
            };
        })
        .filter((region): region is NonNullable<typeof region> => region !== null);

    return [...runtimeRegions, ...logicalRegions];
};

const cloneRuntimeRegionsForRuleRefresh = (regions: QidahenCore['regions']) => (
    regions
        .filter((region) => !region.isLogicalRegion)
        .map((region) => {
            const base = QIDAHEN_RUNTIME_REGION_DEFINITIONS.find((item) => item.id === region.id);
            return {
                ...cloneRuntimeRegionAsPieceSnapshot(region),
                name: getQidahenStatefulRegionDisplayName(region.id),
                diplomacyMarkerFaction: region.diplomacyMarkerFaction,
                diplomacyMarkerSide: region.diplomacyMarkerSide,
                controlLabel: getRegionControlLabel(region),
                adjacentRegionIds: [...(base?.adjacentRegionIds ?? region.adjacentRegionIds)],
                travelCostByRegionId: { ...(base?.travelCostByRegionId ?? region.travelCostByRegionId) },
                movementCostByRegionId: { ...(base?.movementCostByRegionId ?? region.movementCostByRegionId) },
                boundaryTypeByRegionId: { ...(base?.boundaryTypeByRegionId ?? region.boundaryTypeByRegionId) },
            };
        })
);

const setDirectedBoundary = (
    runtimeRegions: QidahenCore['regions'],
    fromId: string,
    toId: string,
    boundaryType: QidahenPassageBoundaryType,
) => {
    const meta = getQidahenBoundaryTypeMeta(boundaryType);
    return runtimeRegions.map((region) => {
        if (region.id !== fromId || region.isLogicalRegion || !(toId in region.boundaryTypeByRegionId)) {
            return region;
        }
        return {
            ...region,
            boundaryTypeByRegionId: {
                ...region.boundaryTypeByRegionId,
                [toId]: boundaryType,
            },
            travelCostByRegionId: {
                ...region.travelCostByRegionId,
                [toId]: meta.travelCost,
            },
            movementCostByRegionId: {
                ...region.movementCostByRegionId,
                [toId]: meta.battleWidth,
            },
        };
    });
};

const setBidirectionalBoundary = (
    runtimeRegions: QidahenCore['regions'],
    leftId: string,
    rightId: string,
    boundaryType: QidahenPassageBoundaryType,
) => (
    setDirectedBoundary(
        setDirectedBoundary(runtimeRegions, leftId, rightId, boundaryType),
        rightId,
        leftId,
        boundaryType,
    )
);

export const refreshRuntimeRegionRules = (
    regions: QidahenCore['regions'],
    fortifications: QidahenFortificationState[],
): QidahenCore['regions'] => {
    let runtimeRegions = cloneRuntimeRegionsForRuleRefresh(regions);
    const fortificationById = new Map(fortifications.map((item) => [item.id, item]));

    if (fortificationById.get('outer-wall')?.ruined) {
        runtimeRegions = setBidirectionalBoundary(runtimeRegions, 'city-region-20', 'city-region-24', 'plain');
    }

    if (fortificationById.get('shanhaiguan')?.ruined) {
        runtimeRegions = setBidirectionalBoundary(runtimeRegions, 'city-region-25', 'city-region-28-jizhen', 'plain');
    }

    if (fortificationById.get('ningyuan')?.ruined) {
        runtimeRegions = setBidirectionalBoundary(runtimeRegions, 'jinzhou', 'city-region-24', 'plain');
    }

    if (fortificationById.get('jinzhou')?.ruined) {
        for (const adjacentRegionId of ['city-region-14', 'city-region-19', 'city-region-24', 'city-region-25']) {
            runtimeRegions = setBidirectionalBoundary(runtimeRegions, 'jinzhou', adjacentRegionId, 'plain');
        }
    }

    runtimeRegions = runtimeRegions.map((region) => ({
        ...region,
        controlLabel: getRegionControlLabel(region),
    }));

    return appendLogicalRuleRegions(runtimeRegions);
};
