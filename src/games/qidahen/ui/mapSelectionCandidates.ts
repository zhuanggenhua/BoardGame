import type { QidahenCore } from '../domain/types';
import { getExplicitRaidTargetAction, getQidahenRaidSourceCandidateIds } from '../domain/pendingTargetActionBuilder';
import { canPlaceRegularTroopsInRegion } from '../domain/regionSelectionPreferences';
import { getCurrentFactionId } from '../domain/factionTurnAccessors';

/** 候选来自正式动作合法性；教程目标只改变强调，不缩减这个集合。 */
export function getQidahenMapSelectionCandidateIds(
    core: QidahenCore,
    options: {
        actionCandidateIds: readonly string[];
        regularTroopPlacement: boolean;
        raidPreview: boolean;
    },
): string[] {
    const factionId = getCurrentFactionId(core);
    if (options.regularTroopPlacement) {
        return core.regions
            .filter(region => !region.isLogicalRegion && canPlaceRegularTroopsInRegion(region, factionId, core))
            .map(region => region.id);
    }
    if (options.raidPreview) {
        if (!core.regionFocusState.lockedSourceRegionId) return getQidahenRaidSourceCandidateIds(core);
        return core.regions
            .filter(region => !region.isLogicalRegion && getExplicitRaidTargetAction(
                { ...core, explicitRegionId: region.id }, factionId,
            ) != null)
            .map(region => region.id);
    }
    return Array.from(new Set(options.actionCandidateIds));
}
