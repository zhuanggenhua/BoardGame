import {
    addFactionHandCards,
    appendDrawnHandCards,
    drawFromFactionPile,
    getFactionDrawPileCount,
} from './handCardState';
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
    getQidahenRegularTroopPlacementTarget,
} from './regionSelectionPreferences';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import { buildRegularTroopStack } from './troopStacks';
import { addSpecialTroopStackToRegion } from './troopCompat';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenSeasonSummary,
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
                ? canPlaceRegularTroopsInRegion(region, factionId, state)
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
    const regularTroopTarget = requiresRegularTroopPlacement
        ? getQidahenRegularTroopPlacementTarget(state, factionId)
        : null;
    const targetRegionId = requiresRegularTroopPlacement
        ? regularTroopTarget?.id ?? state.selectedRegionId
        : selectedRegion?.id ?? fallbackRegionId ?? state.selectedRegionId;
    const targetRegion = requiresRegularTroopPlacement
        ? regularTroopTarget
        : state.regions.find((region) => !region.isLogicalRegion && region.id === targetRegionId);
    const drawCards = Math.max(0, Math.min(config.drawCards, getFactionDrawPileCount(state, factionId)));
    const summaryLines: string[] = [];
    let mapResult: QidahenSeasonSummary['mapResult'];

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
                    const troopsBefore = actionTargetRegion.troops;
                    const troopsAfter = troopsBefore + troopDelta;
                    if (populationDelta > 0) {
                        summaryLines.push(`${actionTargetRegion.name}：人口 +${populationDelta}。`);
                    }
                    if (troopDelta > 0) {
                        mapResult = {
                            regionId: actionTargetRegion.id,
                            troopDelta,
                            beforeTroops: troopsBefore,
                            afterTroops: troopsAfter,
                        };
                        summaryLines.push(`${actionTargetRegion.name}：部队 +${troopDelta}。`);
                    }
                    const nextRegion = {
                        ...actionTargetRegion,
                        troops: actionTargetRegion.troops + troopDelta,
                        population: actionTargetRegion.population + populationDelta,
                        note: `${actionTargetRegion.name} 执行轮盘${config.label}后${troopDelta > 0 ? `部队 +${troopDelta}` : ''}${troopDelta > 0 && populationDelta > 0 ? '，' : ''}${populationDelta > 0 ? `人口 +${populationDelta}` : ''}。`,
                    };
                    return troopDelta > 0
                        ? addSpecialTroopStackToRegion(nextRegion, buildRegularTroopStack(factionId, `wheel-${config.id}`, troopDelta))
                        : nextRegion;
                }),
            state.fortifications,
        )
        : state.regions;

    if (!targetRegion) {
        summaryLines.push(requiresRegularTroopPlacement
            ? `${state.factions[factionId].name} 当前没有可建立正规军的本土区域，未建立部队。`
            : `${state.factions[factionId].name} 当前没有可结算轮盘${config.label}的己方区域。`);
    }
    if (drawCards > 0) {
        summaryLines.push(`抽 ${drawCards} 张手牌。`);
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
        handCards: appendDrawnHandCards(state.handCards, drawnResult.cards, factionId),
        lastSeasonSummary: {
            ...buildSeasonSummary(config.summaryTitle, timestamp, summaryLines),
            ...(mapResult ? { mapResult } : {}),
        },
        factions: {
            ...nextFactions,
            [factionId]: {
                ...nextFactions[factionId],
                troops: state.factions[factionId].troops + (targetRegion ? Math.max(0, config.troopDelta) : 0),
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
