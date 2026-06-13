import { isQidahenCityRuntimeRegion } from './regionConfig';
import { addSpecialTroopStacksToRegion, mergeSpecialTroopStackGroupsAsPieces } from './troopCompat';
import { applyCommittedTroopRemovalToRegion } from './pendingBattleCombatSupport';
import type { QidahenCore, QidahenSpecialTroopStack } from './types';

export const addTroopsToFriendlyBesiegedCityInterior = (
    region: QidahenCore['regions'][number],
    troops: number,
    specialTroops: QidahenSpecialTroopStack[],
    note: string,
): QidahenCore['regions'][number] => {
    if (!region.siegeState || !isQidahenCityRuntimeRegion(region.id)) {
        return addSpecialTroopStacksToRegion({
            ...region,
            troops: region.troops + troops,
            note,
        }, specialTroops);
    }

    return {
        ...region,
        cityState: {
            troops: (region.cityState?.troops ?? 0) + troops,
            population: region.cityState?.population ?? 0,
            specialTroops: mergeSpecialTroopStackGroupsAsPieces(
                region.cityState?.specialTroops ?? [],
                specialTroops,
            ),
        },
        note,
    };
};

export const removeTroopsFromNonSiegedCityStateRegion = (
    region: QidahenCore['regions'][number],
    troopLoss: number,
    note: string,
): QidahenCore['regions'][number] => {
    if (!region.cityState || region.siegeState || !isQidahenCityRuntimeRegion(region.id) || region.troops > 0) {
        return applyCommittedTroopRemovalToRegion({
            ...region,
            troops: Math.max(0, region.troops - troopLoss),
            note,
        }, troopLoss);
    }

    const cityForce = applyCommittedTroopRemovalToRegion({
        ...region.cityState,
        troops: Math.max(0, region.cityState.troops - troopLoss),
        controller: region.controller,
        note,
    }, troopLoss);
    return {
        ...region,
        note,
        cityState: {
            troops: cityForce.troops,
            population: region.cityState.population,
            specialTroops: cityForce.specialTroops,
        },
    };
};
