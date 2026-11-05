import React from 'react';
import qidahenRegionMaskUrl from '../data/region-mask.png?url';
import {
    type QidahenCore,
    type QidahenFactionId,
    type QidahenWheelDispatchSelection,
    type QidahenGrantPardonSelection,
    type QidahenInternalDispatchSelection,
    getQidahenMovementProfile,
    findQidahenReachableRuntimeRegions,
} from '../domain';
import { type QidahenMapViewport, clampQidahenMapViewport, projectQidahenMapPointToStage } from './mapViewport';
import { useTranslation } from 'react-i18next';
import { getOptimizedImageUrls, getLocalizedAssetPath } from '../../../core/AssetLoader';
import {
    ASSETS,
    QIDAHEN_PIXI_MAP_PILOT_ENABLED,
    STAGE_WIDTH,
    STAGE_HEIGHT,
    MAP_COVER_LEFT,
    MAP_COVER_SCALE,
    MAP_COVER_TOP,
    MAP_REGION_TIP_WIDTH,
    ACTIONS_DOCK_LEFT,
    MAP_REGION_TIP_ACTION_GAP,
    MAP_SELECTION_BANNER_WIDTH,
} from './boardLayout';
import { buildRegionMaskHitmap } from './mapMaskHitmap';
import { buildQidahenRuntimeRegionIdByPixel, resolveQidahenRuntimeRegionEntryPoint } from './runtimeRegionOwnership';
import { QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT } from '../data/mapRegions';
import { buildQidahenMapTroopSnapshot, findQidahenMapTroopResult } from '../domain/mapTroopResult';
import { getQidahenDefeatInDetailSelectableSourceRegionIds } from '../domain/defeatInDetail';
import {
    getQidahenRuntimeRegionIdsForPrintedRegionId,
    getQidahenPrintedRegionIdsForRuntimeRegionId,
    QIDAHEN_REGION_GRAPH_EDGES,
    getQidahenDirectedPassage,
    getQidahenBoundaryTypeMeta,
    QIDAHEN_REGION_GRAPH_NODE_BY_ID,
} from '../data/mapGraph';
import { type RegionMaskOverlayToneKey, renderRegionOwnershipOverlay } from './regionMaskOverlay';
import {
    isQidahenGaoDiTargetSelectionActive,
    getPendingCommittedTroopOptions,
    formatSpecialTroops,
    asQidahenPassageBoundaryType,
    formatQidahenCandidateRegionSummary,
    buildRevealedBattleRegionIds,
} from './boardReadModel';
import type { MapScenePoint, MapViewportState, MapInteractionIntent } from '../../../engine/mapRenderer';
import type { ZoomPanViewportState, ZoomPanViewportZoomAnchorArgs } from '../../../components/game/framework';
import type { QidahenGuideBounds, QidahenGuidePoint, QidahenGuideCandidate } from './mapGuideGeometry';

export type MapSceneLayerProps = {
    core: QidahenCore;
    perspectiveFactionId: QidahenFactionId | null;
    mapHitTestingDisabled?: boolean;
    wheelDispatchSelection: QidahenWheelDispatchSelection | null;
    grantPardonSelection: QidahenGrantPardonSelection | null;
    grantPardonMapChoices: QidahenGrantPardonSelection['choices'];
    internalDispatchSelection: QidahenInternalDispatchSelection | null;
    pendingTargetAction: QidahenCore['pendingTargetAction'];
    pendingCommittedTroops?: number;
    onSelectPendingCommittedTroops?: (committedTroops: number) => void;
    onTogglePincerAdvanceTroop?: (choiceId: string) => void;
    onResolveInstigateDefection?: (choiceId: string) => void;
    onResolveWuzhenChaoha?: (choiceId: string) => void;
    tutorialStepId?: string | null;
    tutorialHighlightsResultFeedback: boolean;
    tutorialGuideTargetRegionId?: string | null;
    compactRegionTip: boolean;
    viewport: QidahenMapViewport;
    onViewportChange: (viewport: QidahenMapViewport) => void;
    locale?: string;
    onSelectRegion: (regionId: string, tokenId?: string) => void;
};

export function useQidahenMapSceneModel({
    core,
    perspectiveFactionId,
    mapHitTestingDisabled = false,
    wheelDispatchSelection,
    grantPardonSelection,
    grantPardonMapChoices,
    internalDispatchSelection,
    pendingTargetAction,
    pendingCommittedTroops,
    onSelectPendingCommittedTroops,
    onTogglePincerAdvanceTroop,
    onResolveInstigateDefection,
    onResolveWuzhenChaoha,
    tutorialStepId,
    tutorialHighlightsResultFeedback,
    tutorialGuideTargetRegionId,
    compactRegionTip,
    viewport,
    onViewportChange,
    locale,
    onSelectRegion,
}: MapSceneLayerProps) {
    const { t } = useTranslation('game-qidahen');
    const { t: tCommon } = useTranslation('common');
    const currentFactionId = perspectiveFactionId;
    const pixiMapBackgroundUrl = React.useMemo(
        () => getOptimizedImageUrls(getLocalizedAssetPath(ASSETS.mainMap, locale ?? 'zh-CN')).webp,
        [locale],
    );
    const usePixiMapPilot = QIDAHEN_PIXI_MAP_PILOT_ENABLED;
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const resultFeedbackCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const hitmapRef = React.useRef<Uint8ClampedArray | null>(null);
    const runtimeRegionIdByPixelRef = React.useRef<Array<string | null> | null>(null);
    const lastSeasonSummaryRegionSnapshotRef = React.useRef<Map<string, number> | null>(null);
    const lastSeasonSummaryIdRef = React.useRef<string | null>(null);
    const [runtimeRegionOwnership, setRuntimeRegionOwnership] = React.useState<Array<string | null> | null>(null);
    const [hoveredRegionId, setHoveredRegionId] = React.useState<string | null>(null);
    const regionTipHoverLockRef = React.useRef(false);
    const [maskVersion, setMaskVersion] = React.useState(0);
    const [resultFeedback, setResultFeedback] = React.useState<{
        resultId: string;
        regionId: string;
        troopDelta: number;
        beforeTroops: number;
        afterTroops: number;
    } | null>(null);
    React.useEffect(() => {
        if (typeof Image === 'undefined') return undefined;

        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            const formalHitmap = buildRegionMaskHitmap(image);
            if (!cancelled && formalHitmap) {
                hitmapRef.current = formalHitmap;
                const nextRuntimeRegionOwnership = buildQidahenRuntimeRegionIdByPixel(
                    formalHitmap,
                    QIDAHEN_MAP_WIDTH,
                    QIDAHEN_MAP_HEIGHT,
                );
                runtimeRegionIdByPixelRef.current = nextRuntimeRegionOwnership;
                setRuntimeRegionOwnership(nextRuntimeRegionOwnership);
                setMaskVersion((value) => value + 1);
            }
        };
        image.src = qidahenRegionMaskUrl;
        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        const currentRegionSnapshot = buildQidahenMapTroopSnapshot(core.regions);
        const previousRegionSnapshot = lastSeasonSummaryRegionSnapshotRef.current;
        const resultId = core.lastSeasonSummary?.id ?? null;
        const previousResultId = lastSeasonSummaryIdRef.current;

        if (resultId && resultId !== previousResultId) {
            const explicitMapResult = core.lastSeasonSummary?.mapResult;
            if (explicitMapResult) {
                setResultFeedback({ resultId, ...explicitMapResult });
            } else if (previousRegionSnapshot) {
                const changedTroops = findQidahenMapTroopResult(previousRegionSnapshot, core.regions);
                setResultFeedback(
                    changedTroops
                        ? {
                              resultId,
                              ...changedTroops,
                          }
                        : null,
                );
            }
        } else if (!resultId) {
            setResultFeedback(null);
        }

        lastSeasonSummaryRegionSnapshotRef.current = currentRegionSnapshot;
        lastSeasonSummaryIdRef.current = resultId;
    }, [core.lastSeasonSummary?.id, core.lastSeasonSummary?.mapResult, core.regions]);

    React.useEffect(() => {
        if (!resultFeedback || tutorialHighlightsResultFeedback) {
            return undefined;
        }
        const timeoutId = window.setTimeout(() => setResultFeedback(null), 2500);
        return () => window.clearTimeout(timeoutId);
    }, [resultFeedback, tutorialHighlightsResultFeedback]);

    const tutorialMapTargetRegionId = tutorialStepId === 'select-region' ? 'song-jin' : null;
    const tutorialResultFeedback =
        tutorialHighlightsResultFeedback && core.lastSeasonSummary?.mapResult
            ? { ...core.lastSeasonSummary.mapResult, resultId: core.lastSeasonSummary.id }
            : null;
    const activeResultFeedback =
        tutorialResultFeedback ??
        resultFeedback ??
        (tutorialStepId === 'result' && core.lastSeasonSummary?.mapResult
            ? { ...core.lastSeasonSummary.mapResult, resultId: core.lastSeasonSummary.id }
            : null);
    // 轮盘 / 专题结果卡已经承担“发生了什么”的说明；战斗结果仍保留正式战果文字，
    // 因为战斗后处理需要同时读战损与战后面板，不能只靠教程卡补课。
    const showStandardMapResultFeedback =
        tutorialStepId == null || tutorialStepId === 'battle-result' || tutorialStepId === 'city-result';
    const defeatInDetailSelectableSourceRegionIds = React.useMemo(
        () => getQidahenDefeatInDetailSelectableSourceRegionIds(pendingTargetAction),
        [pendingTargetAction],
    );

    const tutorialGrantPardonTargetRegionId =
        tutorialStepId === 'choose-grant-pardon-source'
            ? grantPardonSelection?.targetRegionId
            : tutorialStepId === 'choose-grant-pardon-target'
              ? tutorialGuideTargetRegionId
              : null;
    const tutorialGrantPardonFocusChoice = tutorialGrantPardonTargetRegionId
        ? (grantPardonMapChoices.find((choice) => choice.targetRegionId === tutorialGrantPardonTargetRegionId) ?? null)
        : null;

    React.useEffect(() => {
        const canvas = overlayCanvasRef.current;
        const runtimeRegionIdByPixel = runtimeRegionIdByPixelRef.current;
        if (!canvas || !runtimeRegionIdByPixel) {
            return;
        }

        const expandRuntimeRegionIds = (regionId: string | null | undefined): string[] => {
            if (!regionId) {
                return [];
            }
            const region = core.regions.find((item) => item.id === regionId);
            if (region) {
                const runtimeRegionIds = region.isLogicalRegion ? region.runtimeRegionIds : [region.id];
                const uniqueRuntimeRegionIds = Array.from(new Set(runtimeRegionIds.filter(Boolean)));
                return uniqueRuntimeRegionIds.length > 0 ? uniqueRuntimeRegionIds : [regionId];
            }
            const runtimeRegionIds = getQidahenRuntimeRegionIdsForPrintedRegionId(regionId);
            return runtimeRegionIds.length > 0 ? runtimeRegionIds : [regionId];
        };

        const toneByRegionId = new Map<string, RegionMaskOverlayToneKey>();
        const applyTone = (regionId: string | null | undefined, tone: RegionMaskOverlayToneKey) => {
            for (const runtimeRegionId of expandRuntimeRegionIds(regionId)) {
                toneByRegionId.set(runtimeRegionId, tone);
            }
        };
        for (const region of core.regions) {
            if (region.isLogicalRegion) {
                continue;
            }
            applyTone(region.id, region.controller);
        }
        const wheelDispatchTargetRegionIds = new Set(
            pendingCommittedTroops != null && pendingCommittedTroops > 0
                ? (wheelDispatchSelection?.candidates.map((candidate) => candidate.targetRuntimeRegionId) ?? [])
                : [],
        );
        const activeWheelDispatchTargetRegionId =
            hoveredRegionId && wheelDispatchTargetRegionIds.has(hoveredRegionId)
                ? hoveredRegionId
                : tutorialGuideTargetRegionId && wheelDispatchTargetRegionIds.has(tutorialGuideTargetRegionId)
                  ? tutorialGuideTargetRegionId
                  : core.explicitRegionId && wheelDispatchTargetRegionIds.has(core.explicitRegionId)
                    ? core.explicitRegionId
                    : (wheelDispatchSelection?.candidates[0]?.targetRuntimeRegionId ?? null);
        applyTone(wheelDispatchSelection?.sourceRegionId, 'source');
        if (activeWheelDispatchTargetRegionId) {
            applyTone(activeWheelDispatchTargetRegionId, 'activeDispatch');
        }
        applyTone(core.gaoDiDispatchSelection?.sourceRegionId, 'source');
        applyTone(internalDispatchSelection?.sourceRegionId, 'source');
        if (defeatInDetailSelectableSourceRegionIds.length > 0) {
            for (const sourceRegionId of defeatInDetailSelectableSourceRegionIds) {
                applyTone(sourceRegionId, 'dispatch');
            }
        } else {
            applyTone(pendingTargetAction?.sourceRegionId, 'source');
        }
        if (isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection)) {
            for (const candidate of core.gaoDiDispatchSelection?.candidates ?? []) {
                applyTone(candidate.targetRegionId, 'dispatch');
            }
        }
        for (const candidate of internalDispatchSelection?.candidates ?? []) {
            applyTone(candidate.targetRegionId, 'dispatch');
        }
        for (const choice of grantPardonMapChoices) {
            if (tutorialGrantPardonFocusChoice) {
                if (choice.id === tutorialGrantPardonFocusChoice.id) {
                    applyTone(choice.sourceRegionId, 'tutorialSource');
                    applyTone(choice.targetRegionId, 'tutorialPrimary');
                } else {
                    applyTone(choice.targetRegionId, 'tutorialCandidate');
                }
            } else {
                applyTone(choice.sourceRegionId, 'source');
                applyTone(choice.targetRegionId, 'dispatch');
            }
        }
        if (pendingTargetAction?.targetRuntimeRegionId || pendingTargetAction?.targetRegionId) {
            applyTone(pendingTargetAction.targetRuntimeRegionId ?? pendingTargetAction.targetRegionId, 'pending');
        }
        if (tutorialMapTargetRegionId) {
            applyTone(tutorialMapTargetRegionId, 'dispatch');
        }
        if (hoveredRegionId) {
            applyTone(hoveredRegionId, 'hovered');
        }
        if (compactRegionTip && core.explicitRegionId) {
            applyTone(core.explicitRegionId, 'selected');
        }
        renderRegionOwnershipOverlay(
            canvas,
            runtimeRegionIdByPixel,
            QIDAHEN_MAP_WIDTH,
            QIDAHEN_MAP_HEIGHT,
            toneByRegionId,
        );
    }, [
        core.gaoDiDispatchSelection,
        internalDispatchSelection?.candidates,
        internalDispatchSelection?.sourceRegionId,
        pendingTargetAction?.sourceRegionId,
        pendingTargetAction?.targetRegionId,
        pendingTargetAction?.targetRuntimeRegionId,
        defeatInDetailSelectableSourceRegionIds,
        compactRegionTip,
        core.regions,
        core.explicitRegionId,
        grantPardonMapChoices,
        tutorialMapTargetRegionId,
        tutorialStepId,
        wheelDispatchSelection?.sourceRegionId,
        wheelDispatchSelection?.candidates,
        pendingCommittedTroops,
        hoveredRegionId,
        tutorialGuideTargetRegionId,
        tutorialGrantPardonFocusChoice,
        maskVersion,
    ]);

    React.useEffect(() => {
        const canvas = resultFeedbackCanvasRef.current;
        const runtimeRegionIdByPixel = runtimeRegionIdByPixelRef.current;
        if (!canvas || !runtimeRegionIdByPixel) {
            return;
        }
        const toneByRegionId = new Map<string, RegionMaskOverlayToneKey>();
        if (activeResultFeedback?.regionId) {
            toneByRegionId.set(activeResultFeedback.regionId, 'result');
        }
        renderRegionOwnershipOverlay(
            canvas,
            runtimeRegionIdByPixel,
            QIDAHEN_MAP_WIDTH,
            QIDAHEN_MAP_HEIGHT,
            toneByRegionId,
        );
    }, [activeResultFeedback?.regionId, runtimeRegionOwnership, maskVersion]);

    const selectedRegion = core.explicitRegionId
        ? core.regions.find((region) => region.id === core.explicitRegionId)
        : undefined;
    const hoveredRegion = hoveredRegionId ? core.regions.find((region) => region.id === hoveredRegionId) : undefined;
    const pendingCommittedOptions = getPendingCommittedTroopOptions(pendingTargetAction);
    const pendingCommittedMax = pendingCommittedOptions[pendingCommittedOptions.length - 1] ?? 0;
    const wheelDispatchSelectableTroopCount = wheelDispatchSelection
        ? Math.max(0, ...wheelDispatchSelection.candidates.map((candidate) => candidate.committedTroops))
        : 0;
    const activeCommittedMax = pendingCommittedMax > 0 ? pendingCommittedMax : wheelDispatchSelectableTroopCount;
    const pendingCommittedSelectionActive =
        activeCommittedMax > 0 && (pendingTargetAction != null || wheelDispatchSelection != null);
    const displaySelectedRegion = compactRegionTip && !pendingCommittedSelectionActive ? selectedRegion : undefined;
    const displayHoveredRegion = pendingCommittedSelectionActive ? undefined : hoveredRegion;
    const focusedRegion = displayHoveredRegion ?? displaySelectedRegion;
    const focusedSpecialTroopsSummary =
        focusedRegion && focusedRegion.specialTroops.length > 0
            ? formatSpecialTroops(focusedRegion.specialTroops)
            : null;

    const getRegionFromPointer = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const runtimeRegionIdByPixel = runtimeRegionIdByPixelRef.current;
        if (!canvas || !runtimeRegionIdByPixel) return null;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(((event.clientX - rect.left) / rect.width) * QIDAHEN_MAP_WIDTH);
        const y = Math.floor(((event.clientY - rect.top) / rect.height) * QIDAHEN_MAP_HEIGHT);
        if (x < 0 || y < 0 || x >= QIDAHEN_MAP_WIDTH || y >= QIDAHEN_MAP_HEIGHT) return null;

        return runtimeRegionIdByPixel[y * QIDAHEN_MAP_WIDTH + x] ?? null;
    }, []);

    const resolveRegionAtMapPoint = React.useCallback((point: MapScenePoint) => {
        const runtimeRegionIdByPixel = runtimeRegionIdByPixelRef.current;
        if (!runtimeRegionIdByPixel) return null;
        const x = Math.floor(point.x);
        const y = Math.floor(point.y);
        if (x < 0 || y < 0 || x >= QIDAHEN_MAP_WIDTH || y >= QIDAHEN_MAP_HEIGHT) return null;
        return runtimeRegionIdByPixel[y * QIDAHEN_MAP_WIDTH + x] ?? null;
    }, []);

    const handlePointerMove = React.useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            setHoveredRegionId(getRegionFromPointer(event));
        },
        [getRegionFromPointer],
    );

    const controlledMapViewport = React.useMemo<ZoomPanViewportState>(
        () => ({
            zoomLevel: viewport.zoom,
            position: {
                x: viewport.panX,
                y: viewport.panY,
            },
        }),
        [viewport.panX, viewport.panY, viewport.zoom],
    );

    const handleControlledViewportChange = React.useCallback(
        (nextViewport: ZoomPanViewportState) => {
            setHoveredRegionId(null);
            onViewportChange(
                clampQidahenMapViewport({
                    zoom: nextViewport.zoomLevel,
                    panX: nextViewport.position.x,
                    panY: nextViewport.position.y,
                }),
            );
        },
        [onViewportChange],
    );

    const handlePixiViewportChange = React.useCallback(
        (nextViewport: MapViewportState) => {
            setHoveredRegionId(null);
            onViewportChange(clampQidahenMapViewport(nextViewport));
        },
        [onViewportChange],
    );

    const resolveMapZoomAnchorPosition = React.useCallback(
        ({ position, zoomLevel, nextZoomLevel, pointer, containerRect }: ZoomPanViewportZoomAnchorArgs) => {
            const stageX = ((pointer.clientX - containerRect.left) / containerRect.width) * STAGE_WIDTH;
            const stageY = ((pointer.clientY - containerRect.top) / containerRect.height) * STAGE_HEIGHT;
            const mapX = (stageX - MAP_COVER_LEFT - position.x) / (MAP_COVER_SCALE * zoomLevel);
            const mapY = (stageY - MAP_COVER_TOP - position.y) / (MAP_COVER_SCALE * zoomLevel);
            return {
                x: stageX - MAP_COVER_LEFT - mapX * MAP_COVER_SCALE * nextZoomLevel,
                y: stageY - MAP_COVER_TOP - mapY * MAP_COVER_SCALE * nextZoomLevel,
            };
        },
        [],
    );

    const handlePointerUp = React.useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            const regionId = getRegionFromPointer(event);
            if (regionId) {
                onSelectRegion(regionId);
            }
        },
        [getRegionFromPointer, onSelectRegion],
    );

    const handlePixiMapInteraction = React.useCallback(
        (intent: MapInteractionIntent) => {
            if (intent.type === 'hover-region') {
                if (!intent.regionId && regionTipHoverLockRef.current) {
                    return;
                }
                setHoveredRegionId(intent.regionId);
                return;
            }
            if (intent.type === 'select-region') {
                onSelectRegion(intent.regionId);
            }
        },
        [onSelectRegion],
    );

    const tipLeft = focusedRegion
        ? Math.min(
              Math.min(
                  STAGE_WIDTH - MAP_REGION_TIP_WIDTH - 18,
                  ACTIONS_DOCK_LEFT - MAP_REGION_TIP_WIDTH - MAP_REGION_TIP_ACTION_GAP,
              ),
              Math.max(
                  18,
                  projectQidahenMapPointToStage(
                      {
                          x: focusedRegion.x * QIDAHEN_MAP_WIDTH,
                          y: focusedRegion.y * QIDAHEN_MAP_HEIGHT,
                      },
                      viewport,
                  ).x + 18,
              ),
          )
        : 0;
    const tipTop = focusedRegion
        ? Math.min(
              STAGE_HEIGHT - 118,
              Math.max(
                  18,
                  projectQidahenMapPointToStage(
                      {
                          x: focusedRegion.x * QIDAHEN_MAP_WIDTH,
                          y: focusedRegion.y * QIDAHEN_MAP_HEIGHT,
                      },
                      viewport,
                  ).y - 34,
              ),
          )
        : 0;
    const focusRuntimeRegionIds = new Set(focusedRegion?.runtimeRegionIds ?? []);
    const runtimeRegionsById = new Map(
        core.regions.filter((region) => !region.isLogicalRegion).map((region) => [region.id, region]),
    );
    const selectedRuntimeRegionIds = new Set(
        displaySelectedRegion?.runtimeRegionIds ?? (displaySelectedRegion?.id ? [displaySelectedRegion.id] : []),
    );
    const sharedPrintedRuntimeOptions = focusedRegion
        ? Array.from(
              new Set(
                  (focusedRegion.isLogicalRegion ? focusedRegion.runtimeRegionIds : [focusedRegion.id])
                      .flatMap((runtimeRegionId) => getQidahenPrintedRegionIdsForRuntimeRegionId(runtimeRegionId))
                      .flatMap((printedRegionId) => getQidahenRuntimeRegionIdsForPrintedRegionId(printedRegionId)),
              ),
          )
              .map((runtimeRegionId) => runtimeRegionsById.get(runtimeRegionId))
              .filter((region): region is NonNullable<typeof region> => region != null)
        : [];
    const runtimeGraphEdges = QIDAHEN_REGION_GRAPH_EDGES.filter(
        (edge) => focusRuntimeRegionIds.has(edge.from) || focusRuntimeRegionIds.has(edge.to),
    )
        .map((edge) => {
            const renderFromId =
                focusRuntimeRegionIds.has(edge.to) && !focusRuntimeRegionIds.has(edge.from) ? edge.to : edge.from;
            const renderToId = renderFromId === edge.from ? edge.to : edge.from;
            const directedPassage = getQidahenDirectedPassage(edge, renderFromId, renderToId);
            const fromRuntimeRegion = runtimeRegionsById.get(renderFromId);
            const stateBoundaryType = asQidahenPassageBoundaryType(
                fromRuntimeRegion?.boundaryTypeByRegionId[renderToId],
            );
            const stateTravelCost = fromRuntimeRegion?.travelCostByRegionId[renderToId];
            const stateBattleWidth = fromRuntimeRegion?.movementCostByRegionId[renderToId];
            const statePassage =
                stateBoundaryType && typeof stateTravelCost === 'number' && typeof stateBattleWidth === 'number'
                    ? {
                          boundaryType: stateBoundaryType,
                          boundaryLabel: getQidahenBoundaryTypeMeta(stateBoundaryType).label,
                          travelCost: stateTravelCost,
                          battleWidth: stateBattleWidth,
                      }
                    : null;
            const fromNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(renderFromId);
            const toNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(renderToId);
            const from = fromNode?.center ?? fromNode?.seed ?? null;
            const to = toNode?.center ?? toNode?.seed ?? null;
            return from && to ? { edge, from, to, directedPassage: statePassage ?? directedPassage } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    const activeMovementPreview =
        focusedRegion && focusedRegion.controller === currentFactionId
            ? (() => {
                  const previewText = (['dispatch-infantry', 'dispatch-cavalry'] as const)
                      .map((profileId) => {
                          const profile = getQidahenMovementProfile(profileId);
                          const reachable = findQidahenReachableRuntimeRegions(
                              core,
                              focusedRegion.id,
                              currentFactionId,
                              profile.movementBudget,
                          )
                              .slice(0, 3)
                              .map((region) => `${region.regionName}${region.usesCoast ? ' 水' : ''}`)
                              .join(' / ');
                          return reachable ? `${profile.label} ${reachable}` : '';
                      })
                      .filter(Boolean)
                      .join(' · ');
                  return previewText;
              })()
            : '';
    const getRegionPoint = (regionId: string | null | undefined) => {
        if (!regionId) {
            return null;
        }
        const region = runtimeRegionsById.get(regionId) ?? core.regions.find((item) => item.id === regionId);
        if (region && typeof region.x === 'number' && typeof region.y === 'number') {
            return {
                x: region.x * QIDAHEN_MAP_WIDTH,
                y: region.y * QIDAHEN_MAP_HEIGHT,
            };
        }
        const graphNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(regionId);
        return graphNode?.center ?? graphNode?.seed ?? null;
    };
    const getGuideArmyTokens = (
        regionId: string | null | undefined,
        factionId: QidahenFactionId | null | undefined,
    ) => {
        if (!regionId || !factionId) {
            return [];
        }
        return core.mapTokens
            .filter((token) => token.type === 'army' && token.regionId === regionId && token.faction === factionId)
            .sort(
                (left, right) =>
                    Number(left.troopIndex == null) - Number(right.troopIndex == null) ||
                    (left.troopIndex ?? 999) - (right.troopIndex ?? 999) ||
                    left.id.localeCompare(right.id, 'en'),
            );
    };
    const getGuideArmyTokenPoint = (
        regionId: string | null | undefined,
        factionId: QidahenFactionId | null | undefined,
        selectedTroopCount?: number | null,
        tokenId?: string | null,
    ) => {
        const matchingTokens = getGuideArmyTokens(regionId, factionId).filter(
            (token) => tokenId == null || token.id === tokenId,
        );
        const selectedTokens =
            selectedTroopCount == null
                ? matchingTokens
                : matchingTokens.filter(
                      (token) => typeof token.troopIndex === 'number' && token.troopIndex <= selectedTroopCount,
                  );
        const targetTokens = selectedTokens.length > 0 ? selectedTokens : matchingTokens;
        if (targetTokens.length <= 0) {
            return null;
        }
        return {
            x: (targetTokens.reduce((sum, token) => sum + token.x, 0) / targetTokens.length) * QIDAHEN_MAP_WIDTH,
            y: (targetTokens.reduce((sum, token) => sum + token.y, 0) / targetTokens.length) * QIDAHEN_MAP_HEIGHT,
        };
    };
    const getGuideArmyTokenBounds = (
        regionId: string | null | undefined,
        factionId: QidahenFactionId | null | undefined,
        preferredTroopIndex?: number | null,
        tokenId?: string | null,
    ): QidahenGuideBounds | null => {
        const matchingTokens = getGuideArmyTokens(regionId, factionId).filter(
            (token) => tokenId == null || token.id === tokenId,
        );
        const preferredToken =
            preferredTroopIndex == null
                ? null
                : (matchingTokens.find((token) => token.troopIndex === preferredTroopIndex) ?? null);
        const targetTokens = preferredToken ? [preferredToken] : matchingTokens;
        if (targetTokens.length <= 0) {
            return null;
        }
        const bounds = targetTokens.reduce(
            (nextBounds, token) => {
                const size = token.size ?? 30;
                const halfSize = size / 2;
                const centerX = token.x * QIDAHEN_MAP_WIDTH;
                const centerY = token.y * QIDAHEN_MAP_HEIGHT;
                return {
                    left: Math.min(nextBounds.left, centerX - halfSize),
                    top: Math.min(nextBounds.top, centerY - halfSize),
                    right: Math.max(nextBounds.right, centerX + halfSize),
                    bottom: Math.max(nextBounds.bottom, centerY + halfSize),
                };
            },
            {
                left: Number.POSITIVE_INFINITY,
                top: Number.POSITIVE_INFINITY,
                right: Number.NEGATIVE_INFINITY,
                bottom: Number.NEGATIVE_INFINITY,
            },
        );
        return {
            ...bounds,
            center: {
                x: (bounds.left + bounds.right) / 2,
                y: (bounds.top + bounds.bottom) / 2,
            },
        };
    };
    const getWheelDispatchTargetPoint = (candidate: QidahenWheelDispatchSelection['candidates'][number]) =>
        (() => {
            const targetPoint = getRegionPoint(candidate.targetRuntimeRegionId);
            if (candidate.targetRuntimeRegionId === 'city-region-22' && targetPoint) {
                return {
                    x: targetPoint.x,
                    y: targetPoint.y,
                };
            }
            return targetPoint;
        })();
    const getGuideArrowTargetPoint = (
        targetRuntimeRegionId: string,
        sourcePoint: QidahenGuidePoint | null | undefined,
        targetPoint: QidahenGuidePoint | null | undefined,
    ) => {
        const runtimeRegionIdByPixel = runtimeRegionOwnership;
        if (runtimeRegionIdByPixel && sourcePoint && targetPoint) {
            const entryPoint = resolveQidahenRuntimeRegionEntryPoint(
                runtimeRegionIdByPixel,
                QIDAHEN_MAP_WIDTH,
                QIDAHEN_MAP_HEIGHT,
                targetRuntimeRegionId,
                sourcePoint,
                targetPoint,
                14,
            );
            if (entryPoint) {
                return entryPoint;
            }
        }
        if (targetRuntimeRegionId === 'city-region-22' && targetPoint) {
            return {
                x: targetPoint.x - 36,
                y: targetPoint.y - 58,
            };
        }
        return targetPoint;
    };
    const getWheelDispatchArrowTargetPoint = (
        candidate: QidahenWheelDispatchSelection['candidates'][number],
        sourcePoint: QidahenGuidePoint | null | undefined,
        targetPoint: QidahenGuidePoint | null | undefined,
    ) => getGuideArrowTargetPoint(candidate.targetRuntimeRegionId, sourcePoint, targetPoint);
    const buildGuidePathPoints = (
        pathRegionIds: string[],
        fallbackSourceRegionId: string | null | undefined,
        fallbackTargetRegionId: string | null | undefined,
        startPoint?: QidahenGuidePoint | null,
        endPoint?: QidahenGuidePoint | null,
    ) => {
        const mergedRegionIds = [fallbackSourceRegionId, ...pathRegionIds, fallbackTargetRegionId].filter(
            (regionId, index, list): regionId is string => Boolean(regionId) && list.indexOf(regionId) === index,
        );
        const points = mergedRegionIds
            .map((regionId) => getRegionPoint(regionId))
            .filter((point): point is NonNullable<typeof point> => point != null);
        const anchoredPoints = points.map((point, index) =>
            index === 0 && startPoint ? startPoint : index === points.length - 1 && endPoint ? endPoint : point,
        );
        return anchoredPoints.length >= 2 ? anchoredPoints : [];
    };
    const inferPendingTargetPathRegionIds = (pending: QidahenCore['pendingTargetAction']): string[] => {
        if (!pending?.sourceRegionId) {
            return [];
        }
        const movementProfile = getQidahenMovementProfile(pending.movementProfileId ?? undefined);
        const reachableTarget = findQidahenReachableRuntimeRegions(
            core,
            pending.sourceRegionId,
            pending.attackerFactionId,
            movementProfile.movementBudget,
            {
                movementProfileId: pending.movementProfileId ?? undefined,
                allowEndOnNonFriendly: true,
                allowPassThroughNonFriendly: false,
            },
        ).find((region) => region.regionId === pending.targetRuntimeRegionId);
        return reachableTarget?.pathRegionIds ?? [];
    };
    const mapSelectionGuide = (() => {
        if (wheelDispatchSelection) {
            if (pendingCommittedTroops == null || pendingCommittedTroops <= 0) {
                return {
                    sourceRegionId: wheelDispatchSelection.sourceRegionId,
                    title: '选择参与部队',
                    hint: '先点源地区兵牌确认本次出兵',
                    badgeLabel: '选择部队',
                    candidates: [],
                    candidateSummary: `${wheelDispatchSelection.displayAnchorRegionName} 出发`,
                };
            }
            return {
                sourceRegionId: wheelDispatchSelection.sourceRegionId,
                title: '点一个进攻目标',
                hint: `${wheelDispatchSelection.displayAnchorRegionName} 出发`,
                badgeLabel: '选择地区',
                candidates: wheelDispatchSelection.candidates.map((candidate) => {
                    const sourcePoint = getGuideArmyTokenPoint(
                        wheelDispatchSelection.sourceRegionId,
                        wheelDispatchSelection.attackerFactionId,
                        pendingCommittedTroops,
                    );
                    const targetPoint = getWheelDispatchTargetPoint(candidate);
                    const arrowTargetPoint = getWheelDispatchArrowTargetPoint(candidate, sourcePoint, targetPoint);
                    const arrowHeadAnchorRatio =
                        candidate.targetRuntimeRegionId === 'city-region-22' ? 0.95 : undefined;
                    const defenderFactionId =
                        candidate.defenderFactionId === 'neutral' ? null : candidate.defenderFactionId;
                    const targetTokens = getGuideArmyTokens(candidate.targetRuntimeRegionId, defenderFactionId);
                    const targetTokenBounds = getGuideArmyTokenBounds(
                        candidate.targetRuntimeRegionId,
                        defenderFactionId,
                    );
                    return {
                        id: candidate.targetRuntimeRegionId,
                        targetRegionId: candidate.targetRuntimeRegionId,
                        targetRegionName: candidate.targetRegionName,
                        resolutionHint: candidate.resolutionHint,
                        targetPoint,
                        arrowTargetPoint,
                        arrowHeadAnchorRatio,
                        targetFocusDisabled: true,
                        targetTokenIds: targetTokens.map((token) => token.id),
                        targetTokenBounds: targetTokenBounds ?? undefined,
                        pathPoints: buildGuidePathPoints(
                            candidate.pathRegionIds,
                            wheelDispatchSelection.sourceRegionId,
                            candidate.targetRuntimeRegionId,
                            sourcePoint,
                            arrowTargetPoint,
                        ),
                    };
                }),
                candidateSummary: formatQidahenCandidateRegionSummary(
                    wheelDispatchSelection.candidates.map((candidate) => candidate.targetRegionName),
                ),
            };
        }
        if (core.gaoDiDispatchSelection) {
            const gaoDiTargetSelectionActive = isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection);
            if (!gaoDiTargetSelectionActive) {
                return null;
            }
            return {
                sourceRegionId: core.gaoDiDispatchSelection.sourceRegionId,
                title: '调度目标',
                hint: '选择目标',
                badgeLabel: '选择目标',
                candidates: core.gaoDiDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.id,
                    targetRegionId: candidate.targetRegionId,
                    targetRegionName: candidate.targetRegionName,
                    resolutionHint: candidate.resolutionHint,
                    pathPoints: buildGuidePathPoints(
                        candidate.pathRegionIds,
                        core.gaoDiDispatchSelection?.sourceRegionId,
                        candidate.targetRegionId,
                    ),
                })),
                candidateSummary: formatQidahenCandidateRegionSummary(
                    core.gaoDiDispatchSelection.candidates.map((candidate) => candidate.targetRegionName),
                ),
            };
        }
        if (grantPardonSelection) {
            if (grantPardonSelection.targetRegionId == null) {
                const targetChoicesByRegion = Array.from(
                    grantPardonMapChoices
                        .reduce((byRegion, choice) => {
                            if (!byRegion.has(choice.targetRegionId)) {
                                byRegion.set(choice.targetRegionId, choice);
                            }
                            return byRegion;
                        }, new Map<string, (typeof grantPardonMapChoices)[number]>())
                        .values(),
                );
                const candidates = targetChoicesByRegion.map((choice) => ({
                    id: `target:${choice.targetRegionId}`,
                    targetRegionId: choice.targetRegionId,
                    targetRegionName: choice.targetRegionName,
                    resolutionHint: `点击${choice.targetRegionName}作为接收区。`,
                    pathPoints: [],
                }));
                return {
                    sourceRegionId: null,
                    title: t('board.actions.grantPardon.mapTargetTitle', { defaultValue: '选择接收区' }),
                    hint: t('board.actions.grantPardon.mapTargetHint', {
                        factionName: tCommon(
                            `qidahenBoard.factions.${grantPardonSelection.executorFactionId ?? 'ming'}`,
                            {
                                defaultValue: core.factions[grantPardonSelection.executorFactionId ?? 'ming'].name,
                            },
                        ),
                        defaultValue: '点击地图上高亮的{{factionName}}控制区',
                    }),
                    badgeLabel: t('board.actions.grantPardon.mapTargetBadge', { defaultValue: '接收区' }),
                    candidates,
                    candidateSummary: formatQidahenCandidateRegionSummary(
                        candidates.map((choice) => choice.targetRegionName),
                    ),
                };
            }
            if (grantPardonSelection.opponentFactionId == null) {
                return {
                    sourceRegionId: null,
                    title: t('board.actions.grantPardon.mapOpponentTitle', { defaultValue: '指定部队所属对手' }),
                    hint: t('board.actions.grantPardon.mapOpponentHint', {
                        defaultValue: '同一接收区对应多个对手；执行方先选择其中一方，随后由该玩家选择部队。',
                    }),
                    badgeLabel: t('board.actions.grantPardon.mapOpponentBadge', { defaultValue: '指定对手' }),
                    candidates: [],
                    candidateSummary: '',
                };
            }
            const candidates = grantPardonMapChoices.map((choice) => {
                const sourcePoint = getGuideArmyTokenPoint(
                    choice.sourceRegionId,
                    choice.sourceFactionId,
                    null,
                    choice.sourceTokenId,
                );
                const targetPoint = getRegionPoint(choice.targetRegionId);
                const arrowTargetPoint = getGuideArrowTargetPoint(choice.targetRegionId, sourcePoint, targetPoint);
                return {
                    id: choice.id,
                    targetRegionId: choice.targetRegionId,
                    targetRegionName: choice.targetRegionName,
                    resolutionHint: choice.detail,
                    sourcePoint: sourcePoint ?? undefined,
                    sourceTokenBounds:
                        getGuideArmyTokenBounds(
                            choice.sourceRegionId,
                            choice.sourceFactionId,
                            null,
                            choice.sourceTokenId,
                        ) ?? undefined,
                    sourceLabel: `${choice.sourceRegionName}·${choice.sourceFactionName}部队`,
                    targetLabel: `${choice.targetRegionName}接收区`,
                    targetPoint: targetPoint ?? undefined,
                    arrowTargetPoint: arrowTargetPoint ?? undefined,
                    pathPoints: buildGuidePathPoints(
                        [],
                        choice.sourceRegionId,
                        choice.targetRegionId,
                        sourcePoint,
                        arrowTargetPoint,
                    ),
                };
            });
            return {
                sourceRegionId: grantPardonSelection.targetRegionId,
                title: t('board.actions.grantPardon.mapTroopTitle', { defaultValue: '选择部队' }),
                hint: t('board.actions.grantPardon.mapTroopHint', {
                    factionName: tCommon(`qidahenBoard.factions.${grantPardonSelection.opponentFactionId}`, {
                        defaultValue: grantPardonSelection.choices[0]?.sourceFactionName ?? '',
                    }),
                    regionName: grantPardonSelection.displayAnchorRegionName ?? grantPardonSelection.targetRegionId,
                    defaultValue: '{{factionName}}玩家点击高亮部队；该部队将直接转入{{regionName}}',
                }),
                badgeLabel: t('board.actions.grantPardon.mapTroopBadge', { defaultValue: '选择部队' }),
                candidates,
                candidateSummary: formatQidahenCandidateRegionSummary(
                    candidates.map((choice) => choice.sourceLabel ?? choice.targetRegionName),
                ),
            };
        }
        if (internalDispatchSelection) {
            return {
                sourceRegionId: internalDispatchSelection.sourceRegionId,
                title: '调度目标',
                hint: '选择目标',
                badgeLabel: '选择目标',
                candidates: internalDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.id,
                    targetRegionId: candidate.targetRegionId,
                    targetRegionName: candidate.targetRegionName,
                    resolutionHint: candidate.resolutionHint,
                    pathPoints: buildGuidePathPoints(
                        candidate.pathRegionIds,
                        internalDispatchSelection.sourceRegionId,
                        candidate.targetRegionId,
                    ),
                })),
                candidateSummary: formatQidahenCandidateRegionSummary(
                    internalDispatchSelection.candidates.map((candidate) => candidate.targetRegionName),
                ),
            };
        }
        if (defeatInDetailSelectableSourceRegionIds.length > 0) {
            const candidates = defeatInDetailSelectableSourceRegionIds.map((regionId) => {
                const region = core.regions.find((candidate) => candidate.id === regionId);
                return {
                    id: regionId,
                    targetRegionId: regionId,
                    targetRegionName: region?.name ?? regionId,
                    resolutionHint: '选择该方向的进攻先进行战斗',
                    pathPoints: [],
                };
            });
            return {
                sourceRegionId: null,
                title: '各个击破',
                hint: '选择先结算的进攻方向',
                badgeLabel: '决定顺序',
                candidates,
                candidateSummary: formatQidahenCandidateRegionSummary(
                    candidates.map((candidate) => candidate.targetRegionName),
                ),
            };
        }
        if (pendingTargetAction?.sourceRegionId) {
            const sourcePoint = getGuideArmyTokenPoint(
                pendingTargetAction.sourceRegionId,
                pendingTargetAction.attackerFactionId,
                pendingCommittedTroops ?? pendingTargetAction.committedTroops,
            );
            const targetPoint = getRegionPoint(pendingTargetAction.targetRuntimeRegionId);
            const arrowTargetPoint = getGuideArrowTargetPoint(
                pendingTargetAction.targetRuntimeRegionId,
                sourcePoint,
                targetPoint,
            );
            return {
                sourceRegionId: pendingTargetAction.sourceRegionId,
                title: `处理中：${pendingTargetAction.targetRegionName}`,
                hint: '处理中',
                badgeLabel: '待结算',
                candidates: [
                    {
                        id: pendingTargetAction.targetRuntimeRegionId,
                        targetRegionId: pendingTargetAction.targetRuntimeRegionId,
                        targetRegionName: pendingTargetAction.targetRegionName,
                        resolutionHint: pendingTargetAction.resolutionHint,
                        targetPoint: targetPoint ?? undefined,
                        arrowTargetPoint: arrowTargetPoint ?? undefined,
                        pathPoints: buildGuidePathPoints(
                            inferPendingTargetPathRegionIds(pendingTargetAction),
                            pendingTargetAction.sourceRegionId,
                            pendingTargetAction.targetRuntimeRegionId,
                            sourcePoint,
                            arrowTargetPoint,
                        ),
                    },
                ],
                candidateSummary: pendingTargetAction.targetRegionName,
            };
        }
        return null;
    })() as null | {
        sourceRegionId: string | null | undefined;
        title: string;
        hint: string;
        badgeLabel: string;
        candidates: QidahenGuideCandidate[];
        candidateSummary: string;
    };
    const mapSelectionCandidateRegionIds = new Set(
        mapSelectionGuide?.candidates.map((candidate) => candidate.targetRegionId) ?? [],
    );
    const activeGuideTargetRegionId =
        hoveredRegionId && mapSelectionCandidateRegionIds.has(hoveredRegionId)
            ? hoveredRegionId
            : tutorialGuideTargetRegionId && mapSelectionCandidateRegionIds.has(tutorialGuideTargetRegionId)
              ? tutorialGuideTargetRegionId
              : core.explicitRegionId && mapSelectionCandidateRegionIds.has(core.explicitRegionId)
                ? core.explicitRegionId
                : (pendingTargetAction?.targetRuntimeRegionId ?? null);
    const activeGuideTargetCandidate =
        mapSelectionGuide?.candidates.find((candidate) => candidate.targetRegionId === activeGuideTargetRegionId) ??
        null;
    const mapSelectionBannerHint = activeGuideTargetCandidate
        ? `${mapSelectionGuide?.hint ?? ''} · 当前目标：${activeGuideTargetCandidate.targetRegionName}`
        : mapSelectionGuide?.candidateSummary
          ? `${mapSelectionGuide.hint} · 可选：${mapSelectionGuide.candidateSummary}`
          : (mapSelectionGuide?.hint ?? '');
    const mapSelectionBannerLeft = (STAGE_WIDTH - MAP_SELECTION_BANNER_WIDTH) / 2;
    const mapSelectionBannerInteractive =
        mapSelectionGuide != null &&
        (pendingTargetAction == null || defeatInDetailSelectableSourceRegionIds.length > 0) &&
        mapSelectionGuide.candidates.length > 0;
    const mapSelectionGuideUsesRegionHighlight =
        grantPardonSelection != null ||
        defeatInDetailSelectableSourceRegionIds.length > 0 ||
        tutorialStepId === 'choose-grant-pardon-target';
    const mapSelectionGuideDrawsRoute =
        mapSelectionGuide != null &&
        (tutorialStepId === 'choose-grant-pardon-source' || !mapSelectionGuideUsesRegionHighlight);
    const revealedBattleRegionIds = React.useMemo(
        () => buildRevealedBattleRegionIds(pendingTargetAction, core.postBattleSelection),
        [pendingTargetAction, core.postBattleSelection],
    );
    const pendingCommittedSelectedCount = Math.min(
        pendingCommittedTroops ?? pendingTargetAction?.committedTroops ?? 0,
        activeCommittedMax,
    );
    const handleSelectPendingCommittedTroopsFromMap = React.useCallback(
        (troopIndex: number) => {
            if (activeCommittedMax <= 0) {
                return;
            }
            onSelectPendingCommittedTroops?.(Math.max(1, Math.min(troopIndex, activeCommittedMax)));
        },
        [activeCommittedMax, onSelectPendingCommittedTroops],
    );
    return {
        usePixiMapPilot,
        controlledMapViewport,
        handleControlledViewportChange,
        resolveMapZoomAnchorPosition,
        t,
        core,
        viewport,
        pixiMapBackgroundUrl,
        handlePixiViewportChange,
        hoveredRegionId,
        resolveRegionAtMapPoint,
        handlePixiMapInteraction,
        mapHitTestingDisabled,
        locale,
        mapSelectionGuide,
        runtimeGraphEdges,
        mapSelectionGuideDrawsRoute,
        activeGuideTargetRegionId,
        overlayCanvasRef,
        tutorialGrantPardonFocusChoice,
        grantPardonMapChoices,
        activeResultFeedback,
        resultFeedbackCanvasRef,
        pendingTargetAction,
        wheelDispatchSelection,
        activeCommittedMax,
        grantPardonSelection,
        currentFactionId,
        revealedBattleRegionIds,
        onSelectRegion,
        pendingCommittedSelectedCount,
        handleSelectPendingCommittedTroopsFromMap,
        onTogglePincerAdvanceTroop,
        onResolveInstigateDefection,
        onResolveWuzhenChaoha,
        tutorialHighlightsResultFeedback,
        showStandardMapResultFeedback,
        tutorialStepId,
        canvasRef,
        tutorialMapTargetRegionId,
        handlePointerMove,
        regionTipHoverLockRef,
        setHoveredRegionId,
        handlePointerUp,
        onViewportChange,
        internalDispatchSelection,
        defeatInDetailSelectableSourceRegionIds,
        mapSelectionBannerLeft,
        mapSelectionBannerInteractive,
        mapSelectionBannerHint,
        focusedRegion,
        tipLeft,
        tipTop,
        focusedSpecialTroopsSummary,
        activeMovementPreview,
        compactRegionTip,
        sharedPrintedRuntimeOptions,
        selectedRuntimeRegionIds,
    };
}
