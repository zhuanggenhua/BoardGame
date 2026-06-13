import { isQidahenCityRuntimeRegion } from './regionConfig';
import { getActionRuleRegionNameById } from './regionRuleSemantics';
import { mergeSpecialTroopStackGroupsAsPieces } from './troopCompat';
import type { QidahenCore } from './types';

export const getNonSiegedCityActionSourceSnapshot = (
    region: QidahenCore['regions'][number],
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'population' | 'specialTroops'> => {
    if (!region.cityState || region.siegeState || !isQidahenCityRuntimeRegion(region.id)) {
        return {
            controller: region.controller,
            troops: region.troops,
            population: region.population,
            specialTroops: region.specialTroops,
        };
    }

    return {
        controller: region.controller,
        troops: region.troops + region.cityState.troops,
        population: region.population + region.cityState.population,
        specialTroops: mergeSpecialTroopStackGroupsAsPieces(
            region.specialTroops,
            region.cityState.specialTroops,
        ),
    };
};

export const materializeNonSiegedCityActionSourceRegion = (
    region: QidahenCore['regions'][number],
): QidahenCore['regions'][number] => {
    if (!region.cityState || region.siegeState || !isQidahenCityRuntimeRegion(region.id)) {
        return {
            ...region,
            name: getActionRuleRegionNameById(region.id, region.name),
        };
    }

    const sourceSnapshot = getNonSiegedCityActionSourceSnapshot(region);
    return {
        ...region,
        name: getActionRuleRegionNameById(region.id, region.name),
        troops: sourceSnapshot.troops,
        population: sourceSnapshot.population,
        specialTroops: sourceSnapshot.specialTroops,
        cityState: null,
    };
};
