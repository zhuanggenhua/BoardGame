import {
    addFactionHandCards,
    buildDrawnHandCards,
    drawFromFactionPile,
    getFactionDrawPileCount,
} from './handCardState';
import { getArmamentLevel } from './armamentStateAccessors';
import { materializeNonSiegedCityActionSourceRegion } from './actionSourceRegionState';
import {
    isRegionControlledByFaction,
} from './battleState';
import {
    resolveQidahenPrimaryRuntimeRegionId,
} from './regionConfig';
import { buildQidahenRegionFocusState } from './regionFocusSemantics';
import {
    canPlaceRegularTroopsInRegion,
    getPreferredRegularTroopPlacementRegion,
    getPreferredSelectedRegionIdForFaction,
} from './regionSelectionPreferences';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import { buildRegularTroopStack } from './troopStacks';
import { addSpecialTroopStackToRegion } from './troopCompat';
import { trainArtilleryStacksToLevel } from './troopTraining';
import type {
    QidahenCore,
    QidahenFactionId,
} from './types';
import { getQidahenWheelImmediateEffectConfig } from './wheelRules';

export const applyQidahenWheelImmediateEffect = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    wheelPositionId: string,
    timestamp: number,
): QidahenCore => {
    const config = getQidahenWheelImmediateEffectConfig(wheelPositionId);
    if (!config) {
        return state;
    }

    const requiresRegularTroopPlacement = Math.max(0, config.troopDelta) > 0;
    const selectedRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === resolveQidahenPrimaryRuntimeRegionId(state.selectedRegionId)
        && (
            requiresRegularTroopPlacement
                ? canPlaceRegularTroopsInRegion(region, factionId)
                : isRegionControlledByFaction(region, factionId)
        )
    ));
    const fallbackRegionId = config.requiresFriendlyRegion
        ? (
            requiresRegularTroopPlacement
                ? getPreferredRegularTroopPlacementRegion(state, factionId)?.id
                : getPreferredSelectedRegionIdForFaction(state, factionId)
        )
        : state.selectedRegionId;
    const targetRegionId = selectedRegion?.id ?? fallbackRegionId ?? state.selectedRegionId;
    const targetRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === targetRegionId);
    const drawCards = Math.max(0, Math.min(config.drawCards, getFactionDrawPileCount(state, factionId)));
    const summaryLines: string[] = [];

    const nextRegions = targetRegion
        ? refreshRuntimeRegionRules(
            state.regions
                .filter((region) => !region.isLogicalRegion)
                .map((region) => {
                    if (region.id !== targetRegion.id) {
                        return { ...region };
                    }
                    const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(region);
                    const troopDelta = Math.max(0, config.troopDelta);
                    const populationDelta = Math.max(0, config.populationDelta);
                    if (populationDelta > 0) {
                        summaryLines.push(`${state.factions[factionId].name} 在 ${actionTargetRegion.name} 执行${config.label}，人口 +${populationDelta}。`);
                    }
                    if (troopDelta > 0) {
                        summaryLines.push(`${state.factions[factionId].name} 在 ${actionTargetRegion.name} 执行${config.label}，部队 +${troopDelta}。`);
                    }
                    const nextRegion = {
                        ...actionTargetRegion,
                        troops: actionTargetRegion.troops + troopDelta,
                        population: actionTargetRegion.population + populationDelta,
                        note: `${actionTargetRegion.name} 执行轮盘${config.label}后${troopDelta > 0 ? `部队 +${troopDelta}` : ''}${troopDelta > 0 && populationDelta > 0 ? '，' : ''}${populationDelta > 0 ? `人口 +${populationDelta}` : ''}。`,
                    };
                    const artilleryTraining = config.id === 'wheel-recruit-train'
                        ? trainArtilleryStacksToLevel(nextRegion, getArmamentLevel(state, factionId, 'artillery-tech'))
                        : null;
                    if (artilleryTraining && artilleryTraining.trainedCount > 0) {
                        summaryLines.push(`${state.factions[factionId].name} 在 ${actionTargetRegion.name} 执行${config.label}，训练 ${artilleryTraining.trainedCount} 个炮兵至等级 ${artilleryTraining.targetLevel}。`);
                    }
                    const artilleryTrainedRegion = artilleryTraining && artilleryTraining.trainedCount > 0
                        ? {
                            ...nextRegion,
                            note: `${nextRegion.note} 轮盘征兵训练将 ${artilleryTraining.trainedCount} 个炮兵训练至 ${artilleryTraining.targetLevel} 级。`.trim(),
                            specialTroops: artilleryTraining.specialTroops,
                        }
                        : nextRegion;
                    return troopDelta > 0
                        ? addSpecialTroopStackToRegion(artilleryTrainedRegion, buildRegularTroopStack(factionId, `wheel-${config.id}`, troopDelta))
                        : artilleryTrainedRegion;
                }),
            state.fortifications,
        )
        : state.regions;

    if (!targetRegion) {
        summaryLines.push(`${state.factions[factionId].name} 当前没有可结算轮盘${config.label}的己方区域。`);
    }
    if (drawCards > 0) {
        summaryLines.push(`${state.factions[factionId].name} 因轮盘${config.label}获得 ${drawCards} 张手牌。`);
    }
    if (summaryLines.length === 0) {
        summaryLines.push(`${state.factions[factionId].name} 执行轮盘${config.label}，当前无额外可见效果。`);
    }

    const drawnResult = drawFromFactionPile(state.factions, factionId, drawCards);
    const nextFactions = addFactionHandCards(drawnResult.factions, factionId, drawnResult.drawnCards);

    return {
        ...state,
        selectedRegionId: targetRegionId,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(targetRegionId),
        regions: nextRegions,
        drawPileCount: state.drawPileCount - drawnResult.drawnCards,
        handCards: buildDrawnHandCards(state, factionId, drawnResult.drawnCards),
        lastSeasonSummary: buildSeasonSummary(config.summaryTitle, timestamp, summaryLines),
        factions: {
            ...nextFactions,
            [factionId]: {
                ...nextFactions[factionId],
                troops: state.factions[factionId].troops + Math.max(0, config.troopDelta),
            },
        },
        actionLog: [
            {
                id: `log-wheel-effect-${timestamp}`,
                faction: factionId,
                text: summaryLines[0] ?? `${state.factions[factionId].name} 执行轮盘${config.label}。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    };
};
