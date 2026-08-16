import { getQidahenBattleResolutionTroopCount, QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS } from './attackRules';
import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';
import { getQidahenBattleForceCommitments } from './battleForceCommitments';
import { takeCommittedSpecialTroopStacks } from './movementProfileTroopSelection';
import { getQidahenEffectivePopulation } from './populationRules';
import { isQidahenCityRuntimeRegion, isQidahenKoreaRuntimeRegionId } from './regionConfig';
import { mergeSpecialTroopStackGroupsAsPieces } from './troopCompat';
import type {
    QidahenBattleMode,
    QidahenCore,
    QidahenFactionId,
    QidahenPendingTargetAction,
    QidahenPostBattleChoice,
    QidahenSpecialTroopStack,
} from './types';

export const isRegionControlledByFaction = (
    region: Pick<QidahenCore['regions'][number], 'controller'>,
    factionId: QidahenFactionId,
): boolean => region.controller === factionId;

export const isRegionFriendlyToFaction = (
    region: Pick<QidahenCore['regions'][number], 'controller' | 'diplomacyMarkerFaction'>,
    factionId: QidahenFactionId,
): boolean => (
    isRegionControlledByFaction(region, factionId)
    || region.diplomacyMarkerFaction === factionId
);

export const resolvePendingBattleMode = (
    pendingTargetAction: QidahenPendingTargetAction,
    targetRegion: QidahenCore['regions'][number],
    options: {
        defenderSortieBattle: boolean;
        defenderHoldCity: boolean;
    },
): QidahenBattleMode => {
    if (!isQidahenCityRuntimeRegion(targetRegion.id)) {
        return 'field';
    }
    if (options.defenderSortieBattle || options.defenderHoldCity) {
        return 'field';
    }
    return pendingTargetAction.battleMode ?? 'city';
};

export const getBattleRegionSnapshot = (
    region: QidahenCore['regions'][number],
    battleMode: QidahenBattleMode = 'field',
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'population' | 'specialTroops'> => {
    if (battleMode === 'city' && region.cityState) {
        return {
            controller: region.controller,
            troops: region.cityState.troops,
            population: region.cityState.population,
            specialTroops: region.cityState.specialTroops,
        };
    }
    return {
        controller: region.controller,
        troops: region.troops,
        population: region.population,
        specialTroops: region.specialTroops,
    };
};

export const getFriendlyReceivingRegionSnapshot = (
    region: QidahenCore['regions'][number],
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'population' | 'specialTroops'> => {
    if (region.siegeState && region.cityState && isQidahenCityRuntimeRegion(region.id)) {
        return {
            controller: region.controller,
            troops: region.cityState.troops,
            population: region.cityState.population,
            specialTroops: region.cityState.specialTroops,
        };
    }
    return getNonSiegedCityActionSourceSnapshot(region);
};

const getCityBesiegePlunderPopulationCap = (
    region: QidahenCore['regions'][number],
): number => {
    if (isQidahenKoreaRuntimeRegionId(region.id)) {
        return 0;
    }
    if (!isQidahenCityRuntimeRegion(region.id)) {
        return region.population;
    }
    if (region.cityState) {
        return Math.max(0, region.population);
    }
    return Math.max(0, region.population - 2);
};

export const getCityPopulationState = (
    region: QidahenCore['regions'][number],
    battleMode: QidahenBattleMode = 'field',
): {
    insidePopulation: number;
    outsidePopulation: number;
    totalPopulation: number;
} => {
    if (!isQidahenCityRuntimeRegion(region.id)) {
        return {
            insidePopulation: 0,
            outsidePopulation: region.population,
            totalPopulation: region.population,
        };
    }
    if (battleMode === 'city') {
        if (region.cityState) {
            return {
                insidePopulation: region.cityState.population,
                outsidePopulation: region.population,
                totalPopulation: region.population + region.cityState.population,
            };
        }
        return {
            insidePopulation: region.population,
            outsidePopulation: 0,
            totalPopulation: region.population,
        };
    }
    if (region.cityState) {
        return {
            insidePopulation: region.cityState.population,
            outsidePopulation: region.population,
            totalPopulation: region.population + region.cityState.population,
        };
    }
    const insidePopulation = Math.min(2, region.population);
    return {
        insidePopulation,
        outsidePopulation: Math.max(0, region.population - insidePopulation),
        totalPopulation: region.population,
    };
};

export const getPostBattlePlunderPopulationCap = (
    region: QidahenCore['regions'][number],
    battleMode: QidahenBattleMode,
    mode: QidahenPostBattleChoice['mode'],
): number => {
    if (isQidahenKoreaRuntimeRegionId(region.id)) {
        return 0;
    }
    if (!isQidahenCityRuntimeRegion(region.id)) {
        return region.population;
    }
    if (mode === 'besiege') {
        if (battleMode === 'city') {
            return getCityPopulationState(region, battleMode).outsidePopulation;
        }
        return getCityBesiegePlunderPopulationCap(region);
    }
    if (battleMode === 'city') {
        return getCityPopulationState(region, battleMode).totalPopulation;
    }
    return region.population;
};

export const getRegionSiegeAttackerForceSnapshot = (
    region: QidahenCore['regions'][number],
    factionId: QidahenFactionId,
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'population' | 'specialTroops'> | null => (
    region.siegeState?.attackerFactionId === factionId
        ? {
            controller: factionId,
            troops: region.siegeState?.attackerTroops ?? 0,
            population: 0,
            specialTroops: region.siegeState?.attackerSpecialTroops ?? [],
        }
        : null
);

const getPendingActionAttackerPositionRegionId = (
    pendingTargetAction: QidahenPendingTargetAction,
): string | null => pendingTargetAction.attackerPositionRegionId ?? pendingTargetAction.sourceRegionId;

export const getPendingActionSourceForceSnapshot = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'population' | 'specialTroops'> | null => {
    const forceCommitments = getQidahenBattleForceCommitments(pendingTargetAction);
    if (forceCommitments.length > 1) {
        const sourceForces = forceCommitments.flatMap((commitment) => {
            const sourceRegion = state.regions.find((region) => (
                !region.isLogicalRegion
                && region.id === commitment.sourceRegionId
            ));
            if (!sourceRegion) {
                return [];
            }
            const sourceSnapshot = getRegionSiegeAttackerForceSnapshot(
                sourceRegion,
                pendingTargetAction.attackerFactionId,
            ) ?? getNonSiegedCityActionSourceSnapshot(sourceRegion);
            return [{
                committedTroops: Math.min(commitment.committedTroops, sourceSnapshot.troops),
                specialTroops: takeCommittedSpecialTroopStacks(
                    sourceSnapshot,
                    commitment.committedTroops,
                    commitment.movementProfileId,
                ),
            }];
        });
        if (sourceForces.length === 0) {
            return null;
        }
        return {
            controller: pendingTargetAction.attackerFactionId,
            troops: sourceForces.reduce((total, force) => total + force.committedTroops, 0),
            population: 0,
            specialTroops: sourceForces.reduce<QidahenSpecialTroopStack[]>(
                (merged, force) => mergeSpecialTroopStackGroupsAsPieces(merged, force.specialTroops),
                [],
            ),
        };
    }
    const positionRegionId = getPendingActionAttackerPositionRegionId(pendingTargetAction);
    if (!positionRegionId) {
        return null;
    }
    const positionRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === positionRegionId) ?? null;
    if (!positionRegion) {
        return null;
    }
    return getRegionSiegeAttackerForceSnapshot(positionRegion, pendingTargetAction.attackerFactionId)
        ?? (() => {
            const sourceSnapshot = getNonSiegedCityActionSourceSnapshot(positionRegion);
            return {
                controller: sourceSnapshot.controller,
                troops: sourceSnapshot.troops,
                population: sourceSnapshot.population,
                specialTroops: sourceSnapshot.specialTroops,
            };
        })();
};

export const getPendingActionDefenderForceSnapshot = (
    targetRegion: QidahenCore['regions'][number],
    pendingTargetAction: QidahenPendingTargetAction,
    battleMode: QidahenBattleMode,
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'population' | 'specialTroops'> => {
    if (pendingTargetAction.targetKind === 'siege-attacker' && targetRegion.siegeState) {
        return {
            controller: targetRegion.siegeState.attackerFactionId,
            troops: targetRegion.siegeState.attackerTroops,
            population: 0,
            specialTroops: targetRegion.siegeState.attackerSpecialTroops,
        };
    }
    return getBattleRegionSnapshot(targetRegion, battleMode);
};

const getNeutralGarrisonTroops = (
    region: QidahenCore['regions'][number],
    battleMode: QidahenBattleMode = 'field',
): number => {
    const battleRegion = getBattleRegionSnapshot(region, battleMode);
    return battleRegion.controller === 'neutral' && battleRegion.troops <= 0
        ? Math.min(
            getQidahenEffectivePopulation(region, battleRegion.population),
            QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS,
        )
        : 0;
};

export const getEffectiveDefenderTroops = (
    region: QidahenCore['regions'][number],
    battleMode: QidahenBattleMode = 'field',
): number => {
    const battleRegion = getBattleRegionSnapshot(region, battleMode);
    return battleRegion.troops > 0 ? getQidahenBattleResolutionTroopCount(battleRegion) : getNeutralGarrisonTroops(region, battleMode);
};

export const getEffectivePendingDefenderTroops = (
    targetRegion: QidahenCore['regions'][number],
    pendingTargetAction: QidahenPendingTargetAction,
    battleMode: QidahenBattleMode,
): number => {
    if (pendingTargetAction.targetKind === 'siege-attacker') {
        const defenderForce = getPendingActionDefenderForceSnapshot(targetRegion, pendingTargetAction, battleMode);
        return defenderForce.troops > 0 ? getQidahenBattleResolutionTroopCount(defenderForce) : 0;
    }
    return getEffectiveDefenderTroops(targetRegion, battleMode);
};
