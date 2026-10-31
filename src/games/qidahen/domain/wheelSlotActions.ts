import { getQidahenWheelPosition } from './wheelRules';
import { canPlaceRegularTroopsInRegion } from './regionSelectionPreferences';
import { getEffectiveHomelandController } from './regionRuleSemantics';
import { isQidahenKoreaRuntimeRegionId } from './regionConfig';
import { getRegularTroopCount, removeMercenarySpecialTroops } from './troopCompat';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import type { QidahenCore, QidahenFactionId } from './types';
import type { QidahenWheelSubaction } from './turnResolutionTypes';

export function getQidahenWheelSlotActions(positionId: string): QidahenWheelSubaction[] {
    switch (getQidahenWheelPosition(positionId)?.kind) {
        case 'reclaim-farm': return ['reclaim', 'military-farm'];
        case 'diplomacy-hire': return ['diplomacy', 'hire'];
        case 'recruit-train': return ['recruit-train'];
        case 'dispatch': return ['dispatch'];
        case 'midyear': return ['play-character', 'military-farm', 'dispatch', 'hire'];
        case 'new-year': return ['reclaim', 'diplomacy', 'dispatch', 'hire'];
        default: throw new Error(`Unknown wheel slot ${positionId}`);
    }
}
export const getQidahenFarmTargets = (core: QidahenCore, factionId: QidahenFactionId) => core.regions.filter(region => (
    !region.isLogicalRegion && canPlaceRegularTroopsInRegion(region, factionId, core)
));
export const getQidahenHireTargets = (core: QidahenCore, factionId: QidahenFactionId) => core.regions.filter(region => (
    !region.isLogicalRegion && region.controller === factionId && !region.siegeState
));

/** 每次外交最多三个不同区域；每个候选必须邻近实际控制区，不能靠选中锚点虚构资格。 */
export function getQidahenWheelDiplomacyTargets(core: QidahenCore, factionId: QidahenFactionId) {
    return core.regions.filter(region => !region.isLogicalRegion && !region.siegeState && !isQidahenKoreaRuntimeRegionId(region.id)
        && (['ming', 'mongol', 'jin'] as const).every(id => getRegularTroopCount(region, id) === 0 && (!region.cityState || getRegularTroopCount(region.cityState, id) === 0))
        && core.regions.some(source => !source.isLogicalRegion && source.controller === factionId && source.adjacentRegionIds.includes(region.id))
        && !(getEffectiveHomelandController(core, region.id) !== 'neutral' && region.diplomacyMarkerFaction == null)
        && !(region.diplomacyMarkerFaction === factionId && region.diplomacyMarkerSide === 'vassal'));
}

export function applyQidahenWheelDiplomacy(core: QidahenCore, factionId: QidahenFactionId, regionId: string): QidahenCore {
    if (!getQidahenWheelDiplomacyTargets(core, factionId).some(region => region.id === regionId)) return core;
    const regions = core.regions.filter(region => !region.isLogicalRegion).map(region => {
        if (region.id !== regionId) return region;
        if (region.diplomacyMarkerFaction == null) return { ...region, controller: 'neutral' as const, diplomacyMarkerFaction: factionId, diplomacyMarkerSide: 'friendly' as const };
        if (region.diplomacyMarkerFaction === factionId) return { ...region, controller: factionId, diplomacyMarkerSide: 'vassal' as const };
        if (region.diplomacyMarkerSide === 'vassal') return { ...region, controller: 'neutral' as const, diplomacyMarkerSide: 'friendly' as const };
        const removed = removeMercenarySpecialTroops(region.specialTroops);
        const cityRemoved = region.cityState ? removeMercenarySpecialTroops(region.cityState.specialTroops) : null;
        return { ...region, controller: getEffectiveHomelandController(core, region.id), diplomacyMarkerFaction: null, diplomacyMarkerSide: null,
            troops: region.troops - removed.removedTroops, specialTroops: removed.specialTroops,
            cityState: region.cityState && cityRemoved ? { ...region.cityState, troops: region.cityState.troops - cityRemoved.removedTroops, specialTroops: cityRemoved.specialTroops } : region.cityState };
    });
    return { ...core, regions: refreshRuntimeRegionRules(regions, core.fortifications) };
}
