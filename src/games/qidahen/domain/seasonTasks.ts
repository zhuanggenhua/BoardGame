import { hasActiveCharacter } from './characterPresenceAccessors';
import { getQidahenEffectiveCityPopulation, getQidahenEffectivePopulation } from './populationRules';
import { getQidahenRuleRegionController } from './specialRuleState';
import { isQidahenKoreaRuntimeRegionId } from './regionConfig';
import { QIDAHEN_NON_HAN_RUNTIME_REGION_IDS } from './regionEthnicity';
import { getRegularTroopCount } from './troopCompat';
import type { QidahenCore, QidahenFactionId } from './types';
import type { QidahenUpkeepTask } from './turnResolutionTypes';

export function getQidahenFortificationMaintenanceCost(core: QidahenCore, fortificationId: string): number {
    const fortification = core.fortifications.find(item => item.id === fortificationId);
    if (!fortification) throw new Error(`Unknown fortification ${fortificationId}`);
    return Math.max(0, fortification.maintenanceCost - (hasActiveCharacter(core, 'ming', 'ming-sun-chengzong') ? 1 : 0));
}

export function canMaintainQidahenFortification(core: QidahenCore, fortificationId: string): boolean {
    const fortification = core.fortifications.find(item => item.id === fortificationId);
    if (!fortification) return false;
    return !fortification.dependencyRegionId || getQidahenRuleRegionController(core, fortification.dependencyRegionId) === 'ming';
}

/** 耗损任务只记录待解决对象；付款、减员及其分配必须由所属玩家选择。 */
export function buildQidahenUpkeepTasks(core: QidahenCore): QidahenUpkeepTask[] {
    const tasks: QidahenUpkeepTask[] = [];
    for (const region of core.regions.filter(item => !item.isLogicalRegion)) {
        const add = (factionId: QidahenFactionId, location: QidahenUpkeepTask['location'], troops: number, population: number, regular: number, reason: QidahenUpkeepTask['reason']) => {
            if (isQidahenKoreaRuntimeRegionId(region.id) && factionId === 'ming' && hasActiveCharacter(core, 'ming', 'ming-mao-wenlong')) return;
            const desert = factionId === 'ming' && QIDAHEN_NON_HAN_RUNTIME_REGION_IDS.has(region.id) && !isQidahenKoreaRuntimeRegionId(region.id);
            const localSupport = reason === 'korea' || reason === 'neutral' || location === 'siege' ? 0
                : Math.min(population, desert ? Math.max(0, troops - regular) : troops);
            const freeSupport = factionId === 'ming' && hasActiveCharacter(core, 'ming', 'ming-wang-huazhen') ? 1 : 0;
            const required = Math.max(0, troops - localSupport - freeSupport);
            if (required > 0) tasks.push({ regionId: region.id, location, factionId, required, reason: desert ? 'desert' : reason });
        };
        if (region.siegeState) {
            add(region.siegeState.attackerFactionId, 'siege', region.siegeState.attackerTroops, 0, getRegularTroopCount({ specialTroops: region.siegeState.attackerSpecialTroops }, region.siegeState.attackerFactionId), 'siege');
        }
        const owner = region.controller !== 'neutral' ? region.controller : region.diplomacyMarkerFaction;
        if (!owner) continue;
        const reason = isQidahenKoreaRuntimeRegionId(region.id) ? 'korea' : region.controller === 'neutral' ? 'neutral' : 'troops';
        if (!region.siegeState && region.troops > 0) add(owner, 'field', region.troops, getQidahenEffectivePopulation(region), getRegularTroopCount(region, owner), reason);
        if (region.cityState && region.cityState.troops > 0) add(owner, 'city', region.cityState.troops,
            region.siegeState ? Math.min(2, getQidahenEffectiveCityPopulation(region)) : getQidahenEffectiveCityPopulation(region), getRegularTroopCount(region.cityState, owner), reason);
    }
    return tasks;
}

export function getQidahenUpkeepForce(core: QidahenCore, task: QidahenUpkeepTask) {
    const region = core.regions.find(item => item.id === task.regionId && !item.isLogicalRegion);
    if (!region) throw new Error(`Missing upkeep region ${task.regionId}`);
    return task.location === 'city' ? region.cityState!
        : task.location === 'siege' ? { troops: region.siegeState!.attackerTroops, specialTroops: region.siegeState!.attackerSpecialTroops }
        : region;
}
