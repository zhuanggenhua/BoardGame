import React from 'react';
import type { Props } from './boardTypes';
import { useQidahenRuntime } from './useQidahenRuntime';
import { useQidahenChoiceState } from './useQidahenChoiceState';
import { useQidahenActionCommands } from './useQidahenActionCommands';
import type { QidahenFactionId } from '../domain';
import { canPlaceRegularTroopsInRegion } from '../domain/regionSelectionPreferences';
import { QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT } from '../data/mapRegions';
import { QIDAHEN_REGION_GRAPH_NODE_BY_ID } from '../data/mapGraph';
import {
    projectQidahenMapPointToStage,
    getQidahenTutorialMapFocusRegionId,
    buildQidahenFocusedMapViewport,
    buildQidahenFocusedMapViewportForPoints,
} from './mapViewport';
import { getQidahenDefeatInDetailSelectableSourceRegionIds } from '../domain/defeatInDetail';
import { isQidahenGaoDiTargetSelectionActive } from './boardReadModel';
import { getCurrentFactionId } from '../domain/factionTurnAccessors';

export function useQidahenMapFocus({
    displayCore,
    mapViewport,
    wheelDispatchPaymentPending,
    defeatInDetailOrderSelectionActive,
    pendingTargetAction,
    wheelDispatchSelection,
    pendingCommittedTroops,
    core,
    internalDispatchSelection,
    grantPardonSelection,
    grantPardonMapChoices,
    recruitSelection,
    maShiTradeSelection,
    khanEdictSelection,
    diplomacySelection,
    tutorialStep,
    activeAutoFocusKeyRef,
    mapViewportBeforeAutoFocusRef,
    setMapViewport,
}: Props &
    ReturnType<typeof useQidahenRuntime> &
    ReturnType<typeof useQidahenChoiceState> &
    ReturnType<typeof useQidahenActionCommands>) {
    const buildRegularTroopPlacementCandidates = React.useCallback(
        (factionId: QidahenFactionId) =>
            displayCore.regions
                .filter((region) => !region.isLogicalRegion && canPlaceRegularTroopsInRegion(region, factionId))
                .map((region) => ({
                    id: region.id,
                    action: 'select-region' as const,
                    resolutionChoiceId: region.id,
                    targetRegionId: region.id,
                    targetRegionName: region.name,
                })),
        [displayCore.regions],
    );

    const getTopLevelGuideRegionMapPoint = React.useCallback(
        (regionId: string | null | undefined) => {
            if (!regionId) {
                return null;
            }
            const region = displayCore.regions.find((item) => item.id === regionId);
            if (region && typeof region.x === 'number' && typeof region.y === 'number') {
                return {
                    x: region.x * QIDAHEN_MAP_WIDTH,
                    y: region.y * QIDAHEN_MAP_HEIGHT,
                };
            }
            const graphNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(regionId);
            return graphNode?.center ?? graphNode?.seed ?? null;
        },
        [displayCore.regions],
    );

    const getTopLevelGuideRegionPoint = React.useCallback(
        (regionId: string | null | undefined) => {
            const point = getTopLevelGuideRegionMapPoint(regionId);
            return point ? projectQidahenMapPointToStage(point, mapViewport) : null;
        },
        [getTopLevelGuideRegionMapPoint, mapViewport],
    );

    const topLevelMapSelectionGuide = (() => {
        if (wheelDispatchPaymentPending) {
            return null;
        }
        if (defeatInDetailOrderSelectionActive) {
            return {
                title: '决定战斗顺序',
                candidates: getQidahenDefeatInDetailSelectableSourceRegionIds(pendingTargetAction).map((regionId) => {
                    const region = displayCore.regions.find((candidate) => candidate.id === regionId);
                    return {
                        id: regionId,
                        action: 'select-region' as const,
                        resolutionChoiceId: regionId,
                        targetRegionId: regionId,
                        targetRegionName: region?.name ?? regionId,
                    };
                }),
            };
        }
        if (pendingTargetAction != null) {
            return null;
        }
        if (wheelDispatchSelection && (pendingCommittedTroops == null || pendingCommittedTroops <= 0)) {
            return null;
        }
        if (wheelDispatchSelection) {
            return {
                title: '选择目标',
                candidates: wheelDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.targetRuntimeRegionId,
                    action: 'wheel-dispatch' as const,
                    resolutionChoiceId: candidate.targetRuntimeRegionId,
                    targetRegionId: candidate.targetRuntimeRegionId,
                    targetRegionName: candidate.targetRegionName,
                })),
            };
        }
        if (core.gaoDiDispatchSelection) {
            const gaoDiTargetSelectionActive = isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection);
            if (!gaoDiTargetSelectionActive) {
                return null;
            }
            return {
                title: '高第调度',
                candidates: core.gaoDiDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.id,
                    action: 'gao-di' as const,
                    resolutionChoiceId: candidate.id,
                    targetRegionId: candidate.targetRegionId,
                    targetRegionName: candidate.targetRegionName,
                })),
            };
        }
        if (internalDispatchSelection) {
            return {
                title: '王化贞调度',
                candidates: internalDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.id,
                    action: 'internal-dispatch' as const,
                    resolutionChoiceId: candidate.id,
                    targetRegionId: candidate.targetRegionId,
                    targetRegionName: candidate.targetRegionName,
                })),
            };
        }
        if (grantPardonSelection) {
            if (grantPardonSelection.targetRegionId != null) {
                return null;
            }
            return {
                title: '赐印招安',
                candidates: Array.from(
                    new Map(grantPardonMapChoices.map((choice) => [choice.targetRegionId, choice])).values(),
                ).map((choice) => ({
                    id: `target:${choice.targetRegionId}`,
                    action: 'select-region' as const,
                    targetRegionId: choice.targetRegionId,
                    resolutionChoiceId: choice.targetRegionId,
                    targetRegionName: choice.targetRegionName,
                })),
            };
        }
        if (recruitSelection) {
            const recruitFactionId = getCurrentFactionId(core);
            return {
                title: '征召地区',
                candidates: buildRegularTroopPlacementCandidates(recruitFactionId),
            };
        }
        if (maShiTradeSelection) {
            return {
                title: '马市建军地区',
                candidates: buildRegularTroopPlacementCandidates('ming'),
            };
        }
        if (khanEdictSelection) {
            const khanFactionId = getCurrentFactionId(core);
            return {
                title: '大汗令箭地区',
                candidates: buildRegularTroopPlacementCandidates(khanFactionId),
            };
        }
        if (diplomacySelection) {
            return {
                title: '外交目标',
                candidates: diplomacySelection.candidateTargetRegionIds.map((regionId) => {
                    const region = displayCore.regions.find((item) => item.id === regionId && !item.isLogicalRegion);
                    return {
                        id: regionId,
                        action: 'select-region' as const,
                        resolutionChoiceId: regionId,
                        targetRegionId: regionId,
                        targetRegionName: region?.name ?? regionId,
                    };
                }),
            };
        }
        return null;
    })();

    const autoFocusMapTargetRegionIdsKey =
        topLevelMapSelectionGuide?.candidates.map((candidate) => candidate.targetRegionId).join('|') ?? '';

    const tutorialMapFocusRegionId = getQidahenTutorialMapFocusRegionId(tutorialStep?.highlightTarget);

    const tutorialMapFocusCandidateRegionId =
        tutorialMapFocusRegionId &&
        topLevelMapSelectionGuide?.candidates.some((candidate) => candidate.targetRegionId === tutorialMapFocusRegionId)
            ? tutorialMapFocusRegionId
            : null;

    const autoFocusMapTargetKey =
        topLevelMapSelectionGuide && autoFocusMapTargetRegionIdsKey
            ? `${topLevelMapSelectionGuide.title}:${autoFocusMapTargetRegionIdsKey}:${tutorialMapFocusCandidateRegionId ?? ''}:${wheelDispatchSelection?.sourceRegionId ?? core.gaoDiDispatchSelection?.sourceRegionId ?? internalDispatchSelection?.sourceRegionId ?? grantPardonSelection?.sourceRegionId ?? ''}`
            : null;

    const mapTargetSelectionActive =
        topLevelMapSelectionGuide != null && topLevelMapSelectionGuide.candidates.length > 0;

    React.useEffect(() => {
        const autoFocusMapTargetRegionIds = autoFocusMapTargetRegionIdsKey
            ? autoFocusMapTargetRegionIdsKey.split('|')
            : [];
        if (!autoFocusMapTargetKey || autoFocusMapTargetRegionIds.length <= 0) {
            if (activeAutoFocusKeyRef.current && mapViewportBeforeAutoFocusRef.current) {
                setMapViewport(mapViewportBeforeAutoFocusRef.current);
            }
            activeAutoFocusKeyRef.current = null;
            mapViewportBeforeAutoFocusRef.current = null;
            return;
        }
        const activeTargetRegionId = tutorialMapFocusCandidateRegionId ?? autoFocusMapTargetRegionIds[0] ?? null;
        const activeTargetPoint = getTopLevelGuideRegionMapPoint(activeTargetRegionId);
        const focusRegionIds = [
            wheelDispatchSelection?.sourceRegionId,
            core.gaoDiDispatchSelection?.sourceRegionId,
            internalDispatchSelection?.sourceRegionId,
            grantPardonSelection?.sourceRegionId,
            ...autoFocusMapTargetRegionIds,
        ];
        const points = focusRegionIds
            .map((regionId) => getTopLevelGuideRegionMapPoint(regionId))
            .filter((point): point is { x: number; y: number } => point != null);
        const viewport =
            tutorialMapFocusCandidateRegionId && activeTargetPoint
                ? buildQidahenFocusedMapViewport(activeTargetPoint, 1.82)
                : buildQidahenFocusedMapViewportForPoints(points, points.length > 1 ? 1 : 1.48);
        if (!viewport) {
            return;
        }
        setMapViewport((currentViewport) => {
            if (!activeAutoFocusKeyRef.current) {
                mapViewportBeforeAutoFocusRef.current = currentViewport;
            }
            activeAutoFocusKeyRef.current = autoFocusMapTargetKey;
            return currentViewport.zoom === viewport.zoom &&
                currentViewport.panX === viewport.panX &&
                currentViewport.panY === viewport.panY
                ? currentViewport
                : viewport;
        });
    }, [
        autoFocusMapTargetKey,
        autoFocusMapTargetRegionIdsKey,
        core.gaoDiDispatchSelection?.sourceRegionId,
        grantPardonSelection?.sourceRegionId,
        getTopLevelGuideRegionMapPoint,
        internalDispatchSelection?.sourceRegionId,
        tutorialMapFocusCandidateRegionId,
        wheelDispatchSelection?.sourceRegionId,
    ]);
    return {
        getTopLevelGuideRegionPoint,
        topLevelMapSelectionGuide,
        tutorialMapFocusCandidateRegionId,
        mapTargetSelectionActive,
    };
}
