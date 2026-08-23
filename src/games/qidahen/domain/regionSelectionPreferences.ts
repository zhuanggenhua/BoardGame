import {
    getFriendlyReceivingRegionSnapshot,
    isRegionControlledByFaction,
    isRegionFriendlyToFaction,
} from './battleState';
import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';
import { getQidahenEffectivePopulation } from './populationRules';
import { isQidahenCityRuntimeRegion } from './regionConfig';
import type { QidahenCore, QidahenFactionId } from './types';

export const isRegionUnderSiege = (
    region: Pick<QidahenCore['regions'][number], 'siegeState'>,
): boolean => region.siegeState != null;

export const canPlaceRegularTroopsInRegion = (
    region: Pick<QidahenCore['regions'][number], 'controller' | 'diplomacyMarkerFaction' | 'diplomacyMarkerSide' | 'siegeState'>,
    factionId: QidahenFactionId,
): boolean => (
    isRegionControlledByFaction(region, factionId)
    && !isRegionUnderSiege(region)
    && !(region.diplomacyMarkerFaction === factionId && region.diplomacyMarkerSide === 'vassal')
);

export const isRegionAvailableForNonDispatchAction = (
    region: Pick<QidahenCore['regions'][number], 'siegeState'>,
): boolean => !isRegionUnderSiege(region);

const getPreferredNonSiegedControlledRuntimeRegion = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): QidahenCore['regions'][number] | null => (
    state.regions
        .filter((region) => (
            !region.isLogicalRegion
            && isRegionControlledByFaction(region, factionId)
            && isRegionAvailableForNonDispatchAction(region)
        ))
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return rightSource.troops - leftSource.troops
                || getQidahenEffectivePopulation(right, rightSource.population)
                    - getQidahenEffectivePopulation(left, leftSource.population);
        })[0]
        ?? null
);

const getPreferredControlledRuntimeRegion = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): QidahenCore['regions'][number] | null => (
    state.regions
        .filter((region) => !region.isLogicalRegion && isRegionControlledByFaction(region, factionId))
        .sort((left, right) => {
            const leftSource = getFriendlyReceivingRegionSnapshot(left);
            const rightSource = getFriendlyReceivingRegionSnapshot(right);
            return rightSource.troops - leftSource.troops
                || getQidahenEffectivePopulation(right, rightSource.population)
                    - getQidahenEffectivePopulation(left, leftSource.population);
        })[0]
        ?? null
);

export const isFriendlySiegedCityTarget = (
    region: QidahenCore['regions'][number] | null | undefined,
    attackerFactionId: QidahenFactionId,
): boolean => Boolean(
    region
    && isQidahenCityRuntimeRegion(region.id)
    && isRegionFriendlyToFaction(region, attackerFactionId)
    && region.siegeState
    && region.siegeState.attackerFactionId !== attackerFactionId,
);

export const isOwnSiegedCityReinforcementTarget = (
    region: QidahenCore['regions'][number] | null | undefined,
    attackerFactionId: QidahenFactionId,
): boolean => Boolean(
    region
    && isQidahenCityRuntimeRegion(region.id)
    && region.siegeState
    && region.siegeState.attackerFactionId === attackerFactionId,
);

export const isFriendlyDispatchSupportTarget = (
    region: QidahenCore['regions'][number] | null | undefined,
    factionId: QidahenFactionId,
): boolean => Boolean(
    region
    && (
        (isRegionFriendlyToFaction(region, factionId) && isRegionAvailableForNonDispatchAction(region))
        || isOwnSiegedCityReinforcementTarget(region, factionId)
    ),
);

export const getPreferredRegularTroopPlacementRegion = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): QidahenCore['regions'][number] | null => (
    state.regions
        .filter((region) => !region.isLogicalRegion && canPlaceRegularTroopsInRegion(region, factionId))
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return rightSource.troops - leftSource.troops
                || getQidahenEffectivePopulation(right, rightSource.population)
                    - getQidahenEffectivePopulation(left, leftSource.population)
                || left.name.localeCompare(right.name, 'zh-CN');
        })[0]
        ?? null
);

export const getPreferredSelectedRegionIdForFaction = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): string => {
    const preferred = getPreferredRegularTroopPlacementRegion(state, factionId)
        ?? getPreferredNonSiegedControlledRuntimeRegion(state, factionId)
        ?? getPreferredControlledRuntimeRegion(state, factionId);
    return preferred?.id ?? state.selectedRegionId;
};

export const getPreferredActionWindowSelectedRegionIdForFaction = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): string => {
    const preferredSiegeRegion = state.regions
        .filter((region) => (
            !region.isLogicalRegion
            && region.siegeState?.attackerFactionId === factionId
            && region.siegeState.attackerTroops > 0
        ))
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return right.siegeState!.attackerTroops - left.siegeState!.attackerTroops
                || rightSource.troops - leftSource.troops
                || getQidahenEffectivePopulation(right, rightSource.population)
                    - getQidahenEffectivePopulation(left, leftSource.population)
                || left.name.localeCompare(right.name, 'zh-CN');
        })[0];
    if (preferredSiegeRegion) {
        return preferredSiegeRegion.id;
    }
    return getPreferredSelectedRegionIdForFaction(state, factionId);
};
