import { syncQidahenCorePieceCollections } from './coreDerivedState';
import {
    getQidahenInitialController,
    resolveQidahenPrimaryRuntimeRegionId,
    resolveQidahenRuntimeRegionIds,
} from './regionConfig';
import type { QidahenCore, QidahenFactionId } from './types';

interface QidahenSpecialRuleStateDependencies {
    syncCorePieceCollections: (
        state: QidahenCore,
    ) => QidahenCore;
}

export const getQidahenRuleRegionController = (
    state: QidahenCore,
    ruleRegionId: string,
): QidahenFactionId | 'neutral' => (
    (() => {
        const runtimeRegionIds = resolveQidahenRuntimeRegionIds(ruleRegionId);
        const primaryRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(ruleRegionId);
        const primaryRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === primaryRuntimeRegionId);
        if (primaryRuntimeRegion) {
            return primaryRuntimeRegion.controller;
        }
        const runtimeRegion = state.regions.find((region) => !region.isLogicalRegion && runtimeRegionIds.includes(region.id));
        if (runtimeRegion) {
            return runtimeRegion.controller;
        }
        const logicalRegion = state.regions.find((region) => region.isLogicalRegion && region.id === ruleRegionId);
        return logicalRegion?.controller ?? 'neutral';
    })()
);

export const syncQidahenSpecialRuleState = (
    state: QidahenCore,
    dependencies: QidahenSpecialRuleStateDependencies = {
        syncCorePieceCollections: syncQidahenCorePieceCollections,
    },
): QidahenCore => {
    const syncedState = dependencies.syncCorePieceCollections(state);
    const hanseongInitialController = getQidahenInitialController('shou-cheng');
    const hanseongController = getQidahenRuleRegionController(syncedState, 'shou-cheng');
    const hanseongPrestigeUnlocked = syncedState.hanseongPrestigeUnlocked
        || (hanseongInitialController !== 'neutral' && hanseongController !== hanseongInitialController);
    return hanseongPrestigeUnlocked === syncedState.hanseongPrestigeUnlocked
        ? syncedState
        : {
            ...syncedState,
            hanseongPrestigeUnlocked,
        };
};
