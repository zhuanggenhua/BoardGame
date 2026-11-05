import { getNonSiegedCityActionSourceSnapshot, materializeNonSiegedCityActionSourceRegion } from './actionSourceRegionState';
import { isRegionFriendlyToFaction } from './battleState';
import { findQidahenReachableRuntimeRegions, getQidahenDirectedPassageRule } from './movement';
import { getQidahenCharacterCommittedTroopLimit } from './pendingBattleCommittedTroops';
import { collapseCompatPiecesToSpecialTroopStacks, expandSpecialTroopStacksToCompatPieces, mergeSpecialTroopStackGroupsAsPieces } from './troopCompat';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { syncQidahenCorePieceCollections } from './coreDerivedState';
import type { QidahenCore, QidahenFactionId } from './types';

export function getQidahenDispatchSourcePieces(core: QidahenCore, factionId: QidahenFactionId, sourceRegionId: string) {
    const source = core.regions.find(region => !region.isLogicalRegion && region.id === sourceRegionId);
    if (!source || source.siegeState || !isRegionFriendlyToFaction(source, factionId)) return [];
    return expandSpecialTroopStacksToCompatPieces(getNonSiegedCityActionSourceSnapshot(source).specialTroops)
        .filter(piece => piece.faction === factionId);
}

/** 先指定真实部队；每支部队均须能走完整路径，友方非战斗调度才使用双倍移动。 */
export function getQidahenDispatchDraftTargets(core: QidahenCore, factionId: QidahenFactionId, sourceRegionId: string, pieceIds: readonly string[]) {
    const pieces = getQidahenDispatchSourcePieces(core, factionId, sourceRegionId).filter(piece => pieceIds.includes(piece.id));
    const max = getQidahenCharacterCommittedTroopLimit(core, factionId, 'wheel-dispatch') ?? 6;
    if (pieces.length === 0 || pieces.length !== pieceIds.length || new Set(pieceIds).size !== pieceIds.length || pieces.length > max) return [];
    const cavalryOnly = pieces.every(piece => piece.troopKind === 'cavalry');
    const profile = cavalryOnly ? 'cavalry' as const : 'infantry' as const;
    const movementBudget = cavalryOnly ? 2 : 1;
    const attacks = findQidahenReachableRuntimeRegions(core, sourceRegionId, factionId, movementBudget, { movementProfileId: profile });
    const dispatches = findQidahenReachableRuntimeRegions(core, sourceRegionId, factionId, movementBudget * 2, {
        movementProfileId: cavalryOnly ? 'dispatch-cavalry' : 'dispatch-infantry', allowEndOnNonFriendly: false,
    });
    const normalTargetIds = new Set(attacks.map(target => target.regionId));
    return [...new Map([...dispatches, ...attacks].map(target => [target.regionId, target])).values()]
        .flatMap(target => {
            const region = core.regions.find(item => item.id === target.regionId && !item.isLogicalRegion)!;
            const friendly = isRegionFriendlyToFaction(region, factionId) && !region.siegeState;
            // 加倍调度的整段必须在己方控制区域；友好中立区仍只适用正常移动。
            if (!normalTargetIds.has(target.regionId) && target.pathRegionIds.some(id => core.regions.find(item => item.id === id)?.controller !== factionId)) return [];
            const previous = target.pathRegionIds.at(-2) ?? sourceRegionId;
            const passage = getQidahenDirectedPassageRule(core, previous, target.regionId, factionId);
            if (!passage || (!friendly && (pieces.filter(piece => piece.troopKind !== 'artillery').length > passage.battleWidth
                || (passage.unitCap != null && pieces.length > passage.unitCap)))) return [];
            return [{ ...target, friendly, movementProfileId: profile, passage }];
        });
}

export function getQidahenDispatchSourceRegionIds(core: QidahenCore, factionId: QidahenFactionId): string[] {
    return core.regions.filter(region => !region.isLogicalRegion && getQidahenDispatchSourcePieces(core, factionId, region.id)
        .some(piece => getQidahenDispatchDraftTargets(core, factionId, region.id, [piece.id]).length > 0)).map(region => region.id);
}

export function applyQidahenFriendlyDispatch(core: QidahenCore, factionId: QidahenFactionId, sourceRegionId: string, pieceIds: string[], targetRegionId: string): QidahenCore {
    const target = getQidahenDispatchDraftTargets(core, factionId, sourceRegionId, pieceIds).find(item => item.regionId === targetRegionId && item.friendly);
    if (!target) return core;
    const selected = getQidahenDispatchSourcePieces(core, factionId, sourceRegionId).filter(piece => pieceIds.includes(piece.id));
    const movingStacks = collapseCompatPiecesToSpecialTroopStacks(selected);
    const regions = core.regions.filter(region => !region.isLogicalRegion).map(region => {
        if (region.id === sourceRegionId) {
            const source = materializeNonSiegedCityActionSourceRegion(region);
            return { ...source, troops: source.troops - selected.length,
                specialTroops: collapseCompatPiecesToSpecialTroopStacks(expandSpecialTroopStacksToCompatPieces(source.specialTroops).filter(piece => !pieceIds.includes(piece.id))) };
        }
        if (region.id === targetRegionId) {
            const destination = materializeNonSiegedCityActionSourceRegion(region);
            return { ...destination, troops: destination.troops + selected.length, specialTroops: mergeSpecialTroopStackGroupsAsPieces(destination.specialTroops, movingStacks) };
        }
        return region;
    });
    return syncQidahenCorePieceCollections({ ...core, regions: refreshRuntimeRegionRules(regions, core.fortifications) });
}
