import { getQidahenBoundaryTypeMeta } from '../ui/mapGraph';
import type { QidahenPassageBoundaryType } from '../ui/mapGraph';
import {
    resolveQidahenPrimaryRuntimeRegionId,
    resolveQidahenRuleRegionConfig,
} from './regionConfig';
import type { QidahenCore, QidahenFactionId, QidahenRegionSummary } from './types';

export type QidahenMovementProfileId =
    | 'infantry'
    | 'cavalry'
    | 'dispatch-infantry'
    | 'dispatch-cavalry';

export interface QidahenMovementProfile {
    id: QidahenMovementProfileId;
    label: string;
    movementBudget: number;
}

export interface QidahenDirectedPassageRule {
    fromId: string;
    toId: string;
    boundaryType: QidahenPassageBoundaryType;
    boundaryLabel: string;
    travelCost: number;
    battleWidth: number;
    ruleNote: string;
    unitCap: number | null;
    usable: boolean;
    usesCoast: boolean;
}

export interface QidahenAdjacentRuntimeRegion {
    regionId: string;
    regionName: string;
    controller: QidahenFactionId | 'neutral';
    passage: QidahenDirectedPassageRule;
}

export interface QidahenReachableRuntimeRegion {
    regionId: string;
    regionName: string;
    controller: QidahenFactionId | 'neutral';
    totalTravelCost: number;
    pathRegionIds: string[];
    finalBoundaryType: QidahenPassageBoundaryType;
    usesCoast: boolean;
    stopsOnEntry: boolean;
}

interface FindReachableOptions {
    allowEndOnNonFriendly?: boolean;
    allowPassThroughNonFriendly?: boolean;
}

export const QIDAHEN_MOVEMENT_PROFILES: QidahenMovementProfile[] = [
    { id: 'infantry', label: '步 1', movementBudget: 1 },
    { id: 'cavalry', label: '骑 2', movementBudget: 2 },
    { id: 'dispatch-infantry', label: '调步 2', movementBudget: 2 },
    { id: 'dispatch-cavalry', label: '调骑 4', movementBudget: 4 },
];

const QIDAHEN_MOVEMENT_PROFILE_BY_ID = new Map(
    QIDAHEN_MOVEMENT_PROFILES.map((profile) => [profile.id, profile]),
);

const toRuntimeRegionId = (regionId: string): string => resolveQidahenPrimaryRuntimeRegionId(regionId);

const findRuntimeRegion = (
    state: QidahenCore,
    regionId: string,
): QidahenRegionSummary | undefined => {
    const runtimeRegionId = toRuntimeRegionId(regionId);
    return state.regions.find((region) => !region.isLogicalRegion && region.id === runtimeRegionId);
};

const isFriendlyControlledRegion = (
    region: QidahenRegionSummary,
    factionId: QidahenFactionId,
): boolean => (
    region.controller === factionId
    || region.diplomacyMarkerFaction === factionId
);

const isCityRuntimeRegion = (regionId: string): boolean => (
    resolveQidahenRuleRegionConfig(regionId).tags.includes('city')
);

const isCityWaterRouteEnabled = (
    state: QidahenCore,
    fromRegion: QidahenRegionSummary,
    toRuntimeId: string,
): boolean => (
    [fromRegion.id, toRuntimeId].some((regionId) => {
        const runtimeRegion = findRuntimeRegion(state, regionId);
        return Boolean(runtimeRegion?.siegeState) && isCityRuntimeRegion(regionId);
    })
);

const hasActiveCharacter = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    characterId: string,
): boolean => state.factions[factionId].characters.some((character) => character.id === characterId && character.inPlay);

const getEffectiveMovementBudget = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    movementBudget: number,
): number => (
    movementBudget
    + (
        factionId === 'mongol' && hasActiveCharacter(state, 'mongol', 'mongol-oba-taiji')
            ? 1
            : 0
    )
    + (
        factionId === 'jin' && hasActiveCharacter(state, 'jin', 'jin-manggultai')
            ? 1
            : 0
    )
);

export const getQidahenMovementProfile = (
    profileId: QidahenMovementProfileId,
): QidahenMovementProfile => (
    QIDAHEN_MOVEMENT_PROFILE_BY_ID.get(profileId) ?? QIDAHEN_MOVEMENT_PROFILES[0]
);

export const getQidahenDirectedPassageRule = (
    state: QidahenCore,
    fromId: string,
    toId: string,
    factionId: QidahenFactionId,
): QidahenDirectedPassageRule | null => {
    const fromRegion = findRuntimeRegion(state, fromId);
    const toRuntimeId = toRuntimeRegionId(toId);
    if (!fromRegion || fromRegion.id === toRuntimeId) {
        return null;
    }
    const boundaryType = fromRegion.boundaryTypeByRegionId[toRuntimeId];
    const travelCost = fromRegion.travelCostByRegionId[toRuntimeId];
    const battleWidth = fromRegion.movementCostByRegionId[toRuntimeId];
    if (typeof boundaryType !== 'string' || typeof travelCost !== 'number' || typeof battleWidth !== 'number') {
        return null;
    }
    const meta = getQidahenBoundaryTypeMeta(boundaryType as QidahenPassageBoundaryType);
    const usesCoast = boundaryType === 'coast';
    const touchesCity = usesCoast && (isCityRuntimeRegion(fromRegion.id) || isCityRuntimeRegion(toRuntimeId));
    const cityWaterRouteEnabled = !touchesCity || isCityWaterRouteEnabled(state, fromRegion, toRuntimeId);
    return {
        fromId: fromRegion.id,
        toId: toRuntimeId,
        boundaryType: boundaryType as QidahenPassageBoundaryType,
        boundaryLabel: meta.label,
        travelCost,
        battleWidth,
        ruleNote: meta.note,
        unitCap: meta.unitCap,
        usable: !usesCoast || (factionId === 'ming' && cityWaterRouteEnabled),
        usesCoast,
    };
};

export const getQidahenDirectedTravelCost = (
    state: QidahenCore,
    fromId: string,
    toId: string,
    factionId: QidahenFactionId,
): number | null => {
    const passage = getQidahenDirectedPassageRule(state, fromId, toId, factionId);
    return passage?.usable ? passage.travelCost : null;
};

export const getQidahenAdjacentRuntimeRegions = (
    state: QidahenCore,
    regionId: string,
    factionId: QidahenFactionId,
): QidahenAdjacentRuntimeRegion[] => {
    const runtimeRegion = findRuntimeRegion(state, regionId);
    if (!runtimeRegion) {
        return [];
    }
    return runtimeRegion.adjacentRegionIds
        .map((adjacentRegionId) => {
            const adjacentRegion = findRuntimeRegion(state, adjacentRegionId);
            const passage = getQidahenDirectedPassageRule(state, runtimeRegion.id, adjacentRegionId, factionId);
            if (!adjacentRegion || !passage || !passage.usable) {
                return null;
            }
            return {
                regionId: adjacentRegion.id,
                regionName: adjacentRegion.name,
                controller: adjacentRegion.controller,
                passage,
            };
        })
        .filter((item): item is QidahenAdjacentRuntimeRegion => item !== null)
        .sort((left, right) => (
            left.passage.travelCost - right.passage.travelCost
            || left.regionName.localeCompare(right.regionName, 'zh-CN')
        ));
};

export const findQidahenReachableRuntimeRegions = (
    state: QidahenCore,
    startRegionId: string,
    factionId: QidahenFactionId,
    movementBudget: number,
    options: FindReachableOptions = {},
): QidahenReachableRuntimeRegion[] => {
    const startRegion = findRuntimeRegion(state, startRegionId);
    const effectiveMovementBudget = getEffectiveMovementBudget(state, factionId, movementBudget);
    if (!startRegion || effectiveMovementBudget <= 0) {
        return [];
    }

    const allowEndOnNonFriendly = options.allowEndOnNonFriendly ?? true;
    const allowPassThroughNonFriendly = options.allowPassThroughNonFriendly ?? false;

    const queue: Array<{
        regionId: string;
        totalTravelCost: number;
        pathRegionIds: string[];
        usesCoast: boolean;
    }> = [{
        regionId: startRegion.id,
        totalTravelCost: 0,
        pathRegionIds: [startRegion.id],
        usesCoast: false,
    }];
    const bestCostByKey = new Map<string, number>([[`${startRegion.id}|0`, 0]]);
    const reachableById = new Map<string, QidahenReachableRuntimeRegion>();

    while (queue.length > 0) {
        queue.sort((left, right) => left.totalTravelCost - right.totalTravelCost);
        const current = queue.shift();
        if (!current) {
            break;
        }
        const currentRegion = findRuntimeRegion(state, current.regionId);
        if (!currentRegion) {
            continue;
        }

        for (const adjacent of getQidahenAdjacentRuntimeRegions(state, currentRegion.id, factionId)) {
            if (current.usesCoast && !adjacent.passage.usesCoast) {
                continue;
            }

            const nextCost = current.totalTravelCost + adjacent.passage.travelCost;
            if (nextCost > effectiveMovementBudget) {
                continue;
            }

            const nextUsesCoast = current.usesCoast || adjacent.passage.usesCoast;
            const nextPath = [...current.pathRegionIds, adjacent.regionId];
            const nextRegion = findRuntimeRegion(state, adjacent.regionId);
            const nextIsFriendly = nextRegion ? isFriendlyControlledRegion(nextRegion, factionId) : false;
            const stopsOnEntry = !nextIsFriendly;
            if (stopsOnEntry && !allowEndOnNonFriendly) {
                continue;
            }

            const existing = reachableById.get(adjacent.regionId);
            if (
                !existing
                || nextCost < existing.totalTravelCost
                || (nextCost === existing.totalTravelCost && nextPath.length < existing.pathRegionIds.length)
            ) {
                reachableById.set(adjacent.regionId, {
                    regionId: adjacent.regionId,
                    regionName: adjacent.regionName,
                    controller: adjacent.controller,
                    totalTravelCost: nextCost,
                    pathRegionIds: nextPath,
                    finalBoundaryType: adjacent.passage.boundaryType,
                    usesCoast: nextUsesCoast,
                    stopsOnEntry,
                });
            }

            if (stopsOnEntry && !allowPassThroughNonFriendly) {
                continue;
            }

            const stateKey = `${adjacent.regionId}|${nextUsesCoast ? 1 : 0}`;
            const bestCost = bestCostByKey.get(stateKey);
            if (bestCost != null && bestCost <= nextCost) {
                continue;
            }
            bestCostByKey.set(stateKey, nextCost);
            queue.push({
                regionId: adjacent.regionId,
                totalTravelCost: nextCost,
                pathRegionIds: nextPath,
                usesCoast: nextUsesCoast,
            });
        }
    }

    return [...reachableById.values()]
        .filter((region) => region.regionId !== startRegion.id)
        .sort((left, right) => (
            left.totalTravelCost - right.totalTravelCost
            || left.pathRegionIds.length - right.pathRegionIds.length
            || left.regionName.localeCompare(right.regionName, 'zh-CN')
        ));
};
