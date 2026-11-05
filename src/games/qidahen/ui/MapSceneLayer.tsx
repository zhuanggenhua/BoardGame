import React from 'react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import {
    ASSETS,
    UI_STYLE,
    UI_SURFACE,
    QIDAHEN_MAP_MIN_ZOOM,
    QIDAHEN_MAP_MAX_ZOOM,
    STAGE_WIDTH,
    STAGE_HEIGHT,
    MAP_COVER_LEFT,
    MAP_COVER_TOP,
    MAP_COVER_SCALE,
    QIDAHEN_PIXI_MAP_SCENE_REGIONS,
    BOUNDARY_TYPE_RUNTIME_COLORS,
    MAP_SELECTION_BANNER_TOP,
    MAP_SELECTION_BANNER_WIDTH,
    MAP_REGION_TIP_WIDTH,
} from './boardLayout';
import { type QidahenMapViewport, clampQidahenMapViewport, DEFAULT_QIDAHEN_MAP_VIEWPORT } from './mapViewport';
import { useTranslation } from 'react-i18next';
import { type MapSceneLayerProps, useQidahenMapSceneModel } from './useQidahenMapSceneModel';
import { ZoomPanViewport } from '../../../components/game/framework';
import { PixiMapSceneHost } from '../../../engine/mapRenderer';
import { QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT } from '../data/mapRegions';
import { MapToken } from './MapToken';
import { shouldRevealQidahenMapArmyToken } from './boardReadModel';
import { QidahenMapPopulationLayer } from './QidahenMapPopulationLayer';
import { buildQidahenGuideArrow } from './mapGuideGeometry';

export { buildRegionMaskHitmap } from './mapMaskHitmap';

export { type MapSceneLayerProps, useQidahenMapSceneModel } from './useQidahenMapSceneModel';

export const StaticMapScene: React.FC<{ locale?: string }> = ({ locale }) => (
    <OptimizedImage
        src={ASSETS.mainMap}
        locale={locale}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        data-testid="qidahen-static-map-scene"
        draggable={false}
        placeholder={false}
    />
);

export const MapViewportControls: React.FC<{
    viewport: QidahenMapViewport;
    onViewportChange: (viewport: QidahenMapViewport) => void;
}> = ({ viewport, onViewportChange }) => {
    const { t } = useTranslation('game-qidahen');
    return (
        <div
            className="pointer-events-auto absolute bottom-[132px] left-[26px] z-30 flex flex-col gap-2"
            data-testid="qidahen-map-viewport-controls"
            data-ui-anchor="left-bottom"
        >
            <div className="flex gap-2">
                <button
                    type="button"
                    data-testid="qidahen-map-zoom-out"
                    className="inline-flex h-[38px] min-w-[38px] items-center justify-center border-[3px] text-[18px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                    onClick={() =>
                        onViewportChange(
                            clampQidahenMapViewport({
                                zoom: viewport.zoom / 1.14,
                                panX: viewport.panX,
                                panY: viewport.panY,
                            }),
                        )
                    }
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: UI_SURFACE.paper,
                        color: UI_STYLE.ink,
                        boxShadow: UI_SURFACE.hardShadow,
                        borderRadius: 3,
                    }}
                >
                    -
                </button>
                <button
                    type="button"
                    data-testid="qidahen-map-zoom-reset"
                    className="inline-flex h-[38px] min-w-[74px] items-center justify-center border-[3px] px-3 text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                    onClick={() => onViewportChange(DEFAULT_QIDAHEN_MAP_VIEWPORT)}
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: UI_SURFACE.paper,
                        color: UI_STYLE.ink,
                        boxShadow: UI_SURFACE.hardShadow,
                        borderRadius: 3,
                    }}
                >
                    {t('devtools.regionMaskTool.compactBoundaryStats.reset', { defaultValue: '复位' })}
                </button>
                <button
                    type="button"
                    data-testid="qidahen-map-zoom-in"
                    className="inline-flex h-[38px] min-w-[38px] items-center justify-center border-[3px] text-[18px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                    onClick={() =>
                        onViewportChange(
                            clampQidahenMapViewport({
                                zoom: viewport.zoom * 1.14,
                                panX: viewport.panX,
                                panY: viewport.panY,
                            }),
                        )
                    }
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: UI_SURFACE.paper,
                        color: UI_STYLE.ink,
                        boxShadow: UI_SURFACE.hardShadow,
                        borderRadius: 3,
                    }}
                >
                    +
                </button>
            </div>
        </div>
    );
};

export const MapSceneLayer: React.FC<MapSceneLayerProps> = (props) => {
    const {
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
    } = useQidahenMapSceneModel(props);

    return (
        <ZoomPanViewport
            className="pointer-events-auto absolute inset-0 z-10 overflow-hidden"
            contentClassName="absolute inset-0"
            containerTestId="qidahen-map-layer"
            contentTestId="qidahen-map-viewport-content"
            scaleTestId="qidahen-map-scale"
            initialScale={DEFAULT_QIDAHEN_MAP_VIEWPORT.zoom}
            minScale={QIDAHEN_MAP_MIN_ZOOM}
            maxScale={QIDAHEN_MAP_MAX_ZOOM}
            panBoundsMode="free"
            interactionDisabled={usePixiMapPilot}
            controlledViewport={controlledMapViewport}
            onControlledViewportChange={handleControlledViewportChange}
            controlledViewportSchedule="animation-frame"
            coordinateSize={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
            clampViewport={(nextViewport) => {
                const clampedViewport = clampQidahenMapViewport({
                    zoom: nextViewport.zoomLevel,
                    panX: nextViewport.position.x,
                    panY: nextViewport.position.y,
                });
                return {
                    zoomLevel: clampedViewport.zoom,
                    position: {
                        x: clampedViewport.panX,
                        y: clampedViewport.panY,
                    },
                };
            }}
            getZoomAnchorPosition={resolveMapZoomAnchorPosition}
            wheelZoomFactor={1.14}
            renderContentTransform={false}
            scaleBadgeClassName="border-[#3f2d18] bg-[rgba(24,16,9,0.88)] text-[#f4dfad]"
            ariaLabel={t('board.map.regionSelectionAria', { defaultValue: '七大恨地图区域选择' })}
            containerProps={{
                'data-tutorial-id': 'qidahen-map-layer',
                'data-map-layout': 'full-bleed-cover',
                'data-map-selected': core.explicitRegionId ?? '',
                'data-map-zoom': viewport.zoom,
                'data-map-pan-x': viewport.panX,
                'data-map-pan-y': viewport.panY,
            }}
            style={{
                background: '#c8a970',
                width: STAGE_WIDTH,
                height: STAGE_HEIGHT,
            }}
        >
            {usePixiMapPilot ? (
                <PixiMapSceneHost
                    backgroundUrl={pixiMapBackgroundUrl}
                    mapWidth={QIDAHEN_MAP_WIDTH}
                    mapHeight={QIDAHEN_MAP_HEIGHT}
                    viewport={viewport}
                    onViewportChange={handlePixiViewportChange}
                    minimumZoom={QIDAHEN_MAP_MIN_ZOOM}
                    maximumZoom={QIDAHEN_MAP_MAX_ZOOM}
                    inertiaEnabled
                    origin={{ x: MAP_COVER_LEFT, y: MAP_COVER_TOP }}
                    baseScale={MAP_COVER_SCALE}
                    regions={QIDAHEN_PIXI_MAP_SCENE_REGIONS}
                    selectedRegionId={core.explicitRegionId}
                    hoveredRegionId={hoveredRegionId}
                    hitTestRegionAtPoint={resolveRegionAtMapPoint}
                    onInteraction={handlePixiMapInteraction}
                    interactive
                    regionSelectionEnabled={!mapHitTestingDisabled}
                    canvasTestId="qidahen-pixi-map-canvas"
                    resourceErrorLabel={t('board.map.mainMapLoadError', { defaultValue: '七大恨地图加载失败' })}
                    ariaLabel={t('board.map.regionSelectionAria', { defaultValue: '七大恨地图区域选择' })}
                />
            ) : null}
            <div
                className={`absolute ${usePixiMapPilot ? 'pointer-events-none' : ''}`}
                data-testid="qidahen-map-content"
                style={{
                    left: MAP_COVER_LEFT + viewport.panX,
                    top: MAP_COVER_TOP + viewport.panY,
                    width: QIDAHEN_MAP_WIDTH,
                    height: QIDAHEN_MAP_HEIGHT,
                    transform: `scale(${MAP_COVER_SCALE * viewport.zoom})`,
                    transformOrigin: 'top left',
                }}
            >
                <OptimizedImage
                    src={ASSETS.mainMap}
                    locale={locale}
                    alt={t('board.map.mainMapAlt', { defaultValue: '七大恨主地图' })}
                    className={`absolute inset-0 h-full w-full select-none object-fill ${usePixiMapPilot ? 'pointer-events-none opacity-0' : ''}`}
                    data-testid="qidahen-main-map-image"
                    data-map-renderer-compat={usePixiMapPilot ? 'legacy-hidden' : undefined}
                    aria-hidden={usePixiMapPilot ? true : undefined}
                    draggable={false}
                    placeholder={false}
                />
                <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox={`0 0 ${QIDAHEN_MAP_WIDTH} ${QIDAHEN_MAP_HEIGHT}`}
                    aria-hidden="true"
                    data-testid="qidahen-map-overlay"
                >
                    <defs>
                        <filter id="qidahen-map-province-selected" x="-12%" y="-12%" width="124%" height="124%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3.2" floodColor="rgba(255,248,233,0.58)" />
                            <feDropShadow dx="0" dy="0" stdDeviation="6.5" floodColor="rgba(184,59,39,0.34)" />
                        </filter>
                        <filter id="qidahen-map-province-hover" x="-10%" y="-10%" width="120%" height="120%">
                            <feDropShadow dx="0" dy="0" stdDeviation="4.2" floodColor="rgba(255,220,146,0.44)" />
                        </filter>
                        <filter id="qidahen-map-guide-glow" x="-18%" y="-18%" width="136%" height="136%">
                            <feDropShadow dx="0" dy="0" stdDeviation="4.2" floodColor="rgba(106,214,139,0.42)" />
                        </filter>
                    </defs>
                    {core.routeLines.map((route) => (
                        <polyline
                            key={route.id}
                            points={route.points
                                .map((point) => `${point.x * QIDAHEN_MAP_WIDTH},${point.y * QIDAHEN_MAP_HEIGHT}`)
                                .join(' ')}
                            fill="none"
                            stroke={
                                route.tone === 'red'
                                    ? mapSelectionGuide
                                        ? 'rgba(184,59,39,0.08)'
                                        : 'rgba(184,59,39,0.72)'
                                    : mapSelectionGuide
                                      ? 'rgba(43,101,145,0.06)'
                                      : 'rgba(43,101,145,0.74)'
                            }
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={route.tone === 'red' ? '12 10' : undefined}
                        />
                    ))}
                    <g data-testid="qidahen-runtime-region-graph">
                        {runtimeGraphEdges.map(({ edge, from, to, directedPassage }) => {
                            const boundaryType = directedPassage?.boundaryType ?? edge.boundaryType;
                            const battleWidth = directedPassage?.battleWidth ?? edge.battleWidth;
                            const color =
                                BOUNDARY_TYPE_RUNTIME_COLORS[boundaryType] ?? BOUNDARY_TYPE_RUNTIME_COLORS.plain;
                            return (
                                <g
                                    key={edge.id}
                                    data-testid={`qidahen-runtime-region-edge-${edge.id}`}
                                    data-boundary-type={boundaryType}
                                    data-battle-width={battleWidth}
                                >
                                    <line
                                        x1={from.x}
                                        y1={from.y}
                                        x2={to.x}
                                        y2={to.y}
                                        stroke={color}
                                        strokeWidth={5}
                                        strokeLinecap="round"
                                        strokeDasharray={boundaryType === 'coast' ? '9 9' : undefined}
                                        opacity={mapSelectionGuide ? 0.06 : 0.9}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                </g>
                            );
                        })}
                    </g>
                    {mapSelectionGuideDrawsRoute && mapSelectionGuide ? (
                        <g data-testid="qidahen-map-selection-guide" data-qidahen-map-guide-layer="background">
                            {mapSelectionGuide.candidates.map((candidate) => {
                                const pathPoints = candidate.pathPoints;
                                const activeCandidate = activeGuideTargetRegionId === candidate.targetRegionId;
                                if (!activeCandidate || candidate.targetFocusDisabled || pathPoints.length < 2) {
                                    return null;
                                }
                                const targetPoint = candidate.targetPoint ?? pathPoints[pathPoints.length - 1];
                                const targetFocusRadius = activeCandidate ? 22 : 18;
                                const targetFocusCorner = activeCandidate ? 8 : 7;
                                const targetFocusStroke = activeCandidate ? '#d0ffbf' : '#7de08e';
                                const targetFocusOpacity = activeCandidate ? 0.86 : 0.42;
                                const targetFocusLeft = targetPoint.x - targetFocusRadius;
                                const targetFocusTop = targetPoint.y - targetFocusRadius;
                                const targetFocusRight = targetPoint.x + targetFocusRadius;
                                const targetFocusBottom = targetPoint.y + targetFocusRadius;
                                const boundedTargetFocusCorner = Math.min(
                                    targetFocusCorner,
                                    Math.max(4, (targetFocusRight - targetFocusLeft) / 3),
                                    Math.max(4, (targetFocusBottom - targetFocusTop) / 3),
                                );
                                const targetFocusPaths = [
                                    `M ${targetFocusLeft} ${targetFocusTop + boundedTargetFocusCorner} L ${targetFocusLeft} ${targetFocusTop} L ${targetFocusLeft + boundedTargetFocusCorner} ${targetFocusTop}`,
                                    `M ${targetFocusRight - boundedTargetFocusCorner} ${targetFocusTop} L ${targetFocusRight} ${targetFocusTop} L ${targetFocusRight} ${targetFocusTop + boundedTargetFocusCorner}`,
                                    `M ${targetFocusLeft} ${targetFocusBottom - boundedTargetFocusCorner} L ${targetFocusLeft} ${targetFocusBottom} L ${targetFocusLeft + boundedTargetFocusCorner} ${targetFocusBottom}`,
                                    `M ${targetFocusRight - boundedTargetFocusCorner} ${targetFocusBottom} L ${targetFocusRight} ${targetFocusBottom} L ${targetFocusRight} ${targetFocusBottom - boundedTargetFocusCorner}`,
                                ];
                                return (
                                    <g
                                        key={candidate.id}
                                        data-testid={`qidahen-map-guide-route-${candidate.targetRegionId}`}
                                        data-guide-source-x={candidate.sourcePoint?.x}
                                        data-guide-source-y={candidate.sourcePoint?.y}
                                        data-guide-target-x={targetPoint.x}
                                        data-guide-target-y={targetPoint.y}
                                    >
                                        <g
                                            data-testid={`qidahen-map-guide-target-focus-${candidate.targetRegionId}`}
                                            opacity={targetFocusOpacity}
                                            filter={activeCandidate ? 'url(#qidahen-map-guide-glow)' : undefined}
                                        >
                                            {targetFocusPaths.map((focusPath) => (
                                                <path
                                                    key={focusPath}
                                                    d={focusPath}
                                                    fill="none"
                                                    stroke={targetFocusStroke}
                                                    strokeWidth={activeCandidate ? 3.4 : 2.4}
                                                    strokeLinecap="square"
                                                    strokeLinejoin="miter"
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            ))}
                                        </g>
                                    </g>
                                );
                            })}
                        </g>
                    ) : null}
                </svg>
                <canvas
                    ref={overlayCanvasRef}
                    width={QIDAHEN_MAP_WIDTH}
                    height={QIDAHEN_MAP_HEIGHT}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    data-testid="qidahen-map-region-mask-overlay"
                    data-qidahen-region-outline="true"
                    data-qidahen-tutorial-primary-target={tutorialGrantPardonFocusChoice?.targetRegionId ?? undefined}
                    data-qidahen-tutorial-source-region={tutorialGrantPardonFocusChoice?.sourceRegionId ?? undefined}
                    data-qidahen-tutorial-candidate-count={
                        tutorialGrantPardonFocusChoice ? String(grantPardonMapChoices.length) : undefined
                    }
                    aria-hidden="true"
                />
                {activeResultFeedback ? (
                    <canvas
                        ref={resultFeedbackCanvasRef}
                        width={QIDAHEN_MAP_WIDTH}
                        height={QIDAHEN_MAP_HEIGHT}
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        data-testid="qidahen-map-result-feedback-canvas"
                        data-qidahen-map-result-region={activeResultFeedback.regionId}
                        data-qidahen-map-result-troop-delta={activeResultFeedback.troopDelta}
                        aria-hidden="true"
                    />
                ) : null}
                {core.mapTokens.map((token) => {
                    const pincerAdvanceChoice = core.pincerAdvanceSelection?.choices.find(
                        (choice) => choice.tokenId === token.id,
                    );
                    const instigateDefectionChoice = core.instigateDefectionSelection?.choices.find(
                        (choice) => choice.tokenId === token.id,
                    );
                    const wuzhenChaohaChoice = core.wuzhenChaohaSelection?.choices.find(
                        (choice) => choice.tokenId === token.id,
                    );
                    const pendingCommittedSourceRegionId =
                        pendingTargetAction?.sourceRegionId ?? wheelDispatchSelection?.sourceRegionId ?? null;
                    const pendingCommittedSelectable =
                        token.type === 'army' &&
                        core.pincerAdvanceSelection == null &&
                        core.instigateDefectionSelection == null &&
                        core.wuzhenChaohaSelection == null &&
                        pendingCommittedSourceRegionId != null &&
                        token.regionId === pendingCommittedSourceRegionId &&
                        typeof token.troopIndex === 'number' &&
                        token.troopIndex >= 1 &&
                        token.troopIndex <= activeCommittedMax;
                    const grantPardonSourceSelectable =
                        token.type === 'army' &&
                        grantPardonSelection?.targetRegionId != null &&
                        grantPardonSelection.opponentFactionId != null &&
                        grantPardonMapChoices.some(
                            (choice) =>
                                choice.sourceRegionId === token.regionId &&
                                choice.sourceTokenId === token.id &&
                                choice.sourceFactionId === grantPardonSelection.opponentFactionId &&
                                choice.targetRegionId === grantPardonSelection.targetRegionId,
                        );
                    const grantPardonSourceSelected =
                        token.type === 'army' && grantPardonSelection?.sourceTokenId === token.id;
                    return (
                        <MapToken
                            key={token.id}
                            token={token}
                            revealFront={shouldRevealQidahenMapArmyToken(
                                token,
                                currentFactionId,
                                revealedBattleRegionIds,
                            )}
                            grantPardonSourceSelectable={grantPardonSourceSelectable || grantPardonSourceSelected}
                            grantPardonSourceSelected={grantPardonSourceSelected}
                            onSelectGrantPardonSource={onSelectRegion}
                            pendingCommittedSelectable={pendingCommittedSelectable}
                            pendingCommittedSelected={
                                pendingCommittedSelectable && (token.troopIndex ?? 0) <= pendingCommittedSelectedCount
                            }
                            onSelectPendingCommittedTroops={handleSelectPendingCommittedTroopsFromMap}
                            pincerAdvanceSelectable={pincerAdvanceChoice != null}
                            pincerAdvanceSelected={
                                pincerAdvanceChoice != null &&
                                core.pincerAdvanceSelection?.selectedChoiceIds.includes(pincerAdvanceChoice.id)
                            }
                            onTogglePincerAdvanceTroop={onTogglePincerAdvanceTroop}
                            instigateDefectionSelectable={instigateDefectionChoice != null}
                            onResolveInstigateDefection={onResolveInstigateDefection}
                            wuzhenChaohaSelectable={wuzhenChaohaChoice != null}
                            onResolveWuzhenChaoha={onResolveWuzhenChaoha}
                            tutorialResultArtilleryFocus={Boolean(
                                tutorialHighlightsResultFeedback &&
                                activeResultFeedback?.regionId === token.regionId &&
                                token.troopKind === 'artillery' &&
                                shouldRevealQidahenMapArmyToken(token, currentFactionId, revealedBattleRegionIds),
                            )}
                        />
                    );
                })}
                <QidahenMapPopulationLayer regions={core.regions} />
                {activeResultFeedback != null
                    ? (() => {
                          const resultRegion = core.regions.find(
                              (region) => region.id === activeResultFeedback.regionId,
                          );
                          if (!resultRegion) {
                              return null;
                          }
                          const troopDelta = activeResultFeedback.troopDelta;
                          const resultTroop = core.mapTokens.find(
                              (token) =>
                                  token.type === 'army' &&
                                  token.regionId === activeResultFeedback.regionId &&
                                  token.imageSrc != null,
                          );
                          const resultTroopImageSrc = resultTroop?.imageSrc;
                          const resultTroopSize = resultTroop?.size ?? 30;
                          return (
                              <div
                                  className="pointer-events-none absolute z-[58] h-1 w-1"
                                  data-testid="qidahen-map-result-feedback"
                                  data-tutorial-id="qidahen-map-result-feedback"
                                  data-qidahen-map-result-region={activeResultFeedback.regionId}
                                  data-qidahen-map-result-troop-delta={troopDelta}
                                  data-qidahen-map-result-before-troops={activeResultFeedback.beforeTroops}
                                  data-qidahen-map-result-after-troops={activeResultFeedback.afterTroops}
                                  style={{
                                      left: resultRegion.x * QIDAHEN_MAP_WIDTH,
                                      top: resultRegion.y * QIDAHEN_MAP_HEIGHT,
                                      transform: 'translate(-50%, -50%)',
                                  }}
                                  aria-hidden="true"
                              >
                                  <div
                                      className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[280px] -translate-x-1/2 -translate-y-1/2"
                                      data-testid="qidahen-map-result-feedback-safe-zone"
                                      aria-hidden="true"
                                  />
                                  {showStandardMapResultFeedback ? (
                                      <div
                                          className="pointer-events-none absolute left-1/2 top-[-92px] -translate-x-1/2 whitespace-nowrap rounded border-[3px] border-[#fff0b0] bg-[rgba(61,35,13,0.94)] px-3 py-2 text-[15px] font-black tracking-wide text-[#fff4c9] shadow-[0_4px_14px_rgba(42,23,6,0.72)]"
                                          data-testid="qidahen-map-result-feedback-text"
                                      >
                                          {t('board.map.regionTroopChange', {
                                              regionName: resultRegion.name,
                                              before: activeResultFeedback.beforeTroops,
                                              after: activeResultFeedback.afterTroops,
                                              defaultValue: '{{regionName}}部队：{{before}} → {{after}}',
                                          })}
                                      </div>
                                  ) : null}
                                  {showStandardMapResultFeedback
                                      ? Array.from({ length: troopDelta }, (_, index) => (
                                            <span
                                                key={`${activeResultFeedback.resultId}-troop-${String(index + 1)}`}
                                                className="qidahen-map-result-troop-fade absolute left-1/2 top-1/2 grid place-items-center overflow-hidden rounded-[6px] border-[2px] border-[#fff0b0] bg-[rgba(168,63,38,0.94)] shadow-[0_3px_10px_rgba(42,23,6,0.72),0_0_18px_rgba(255,214,93,0.92)]"
                                                data-testid="qidahen-map-result-troop-fade"
                                                data-qidahen-map-result-troop-index={String(index + 1)}
                                                style={{
                                                    width: resultTroopSize,
                                                    height: resultTroopSize,
                                                    marginLeft: (index - (troopDelta - 1) / 2) * 22,
                                                    marginTop:
                                                        (index % 2 === 0 ? -1 : 1) * (14 + Math.floor(index / 2) * 7),
                                                    animationDelay: `${index * 70}ms`,
                                                }}
                                            >
                                                {resultTroopImageSrc ? (
                                                    <OptimizedImage
                                                        src={resultTroopImageSrc}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                        draggable={false}
                                                        placeholder={false}
                                                    />
                                                ) : (
                                                    <span
                                                        className="h-[18px] w-[11px] rounded-[3px] border-2 border-[#fff0b0] bg-[#bb432f]"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </span>
                                        ))
                                      : null}
                              </div>
                          );
                      })()
                    : null}
                {mapSelectionGuideDrawsRoute && mapSelectionGuide ? (
                    <svg
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox={`0 0 ${QIDAHEN_MAP_WIDTH} ${QIDAHEN_MAP_HEIGHT}`}
                        aria-hidden="true"
                        data-testid="qidahen-map-guide-route-overlay"
                    >
                        <g data-testid="qidahen-map-selection-guide-routes">
                            {mapSelectionGuide.candidates.map((candidate) => {
                                const pathPoints = candidate.pathPoints;
                                const activeCandidate = activeGuideTargetRegionId === candidate.targetRegionId;
                                if (!activeCandidate || pathPoints.length < 2) {
                                    return null;
                                }
                                const arrowPoints = pathPoints;
                                const { linePath, headPath: arrowHeadPath } = buildQidahenGuideArrow(
                                    arrowPoints,
                                    activeCandidate ? 14 : 11,
                                    activeCandidate ? 10 : 9,
                                    activeCandidate ? 4.8 : 4.2,
                                    candidate.arrowHeadAnchorRatio,
                                );
                                const routeColor = activeCandidate
                                    ? 'rgba(255,226,161,0.98)'
                                    : 'rgba(109, 216, 141, 0.68)';
                                const sourceBounds = candidate.sourceTokenBounds;
                                return (
                                    <g
                                        key={candidate.id}
                                        data-testid={`qidahen-map-guide-route-foreground-${candidate.targetRegionId}`}
                                    >
                                        {sourceBounds ? (
                                            <rect
                                                data-testid={`qidahen-map-guide-source-focus-${candidate.targetRegionId}`}
                                                x={sourceBounds.left - 8}
                                                y={sourceBounds.top - 8}
                                                width={Math.max(1, sourceBounds.right - sourceBounds.left + 16)}
                                                height={Math.max(1, sourceBounds.bottom - sourceBounds.top + 16)}
                                                rx={10}
                                                fill="rgba(255, 206, 108, 0.14)"
                                                stroke="#ffe2a1"
                                                strokeWidth={3.6}
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        ) : null}
                                        {linePath ? (
                                            <>
                                                <path
                                                    d={linePath}
                                                    fill="none"
                                                    stroke="rgba(37, 22, 9, 0.82)"
                                                    strokeWidth={activeCandidate ? 8 : 5}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    vectorEffect="non-scaling-stroke"
                                                    opacity={activeCandidate ? 0.9 : 0.3}
                                                />
                                                <path
                                                    d={linePath}
                                                    fill="none"
                                                    stroke={routeColor}
                                                    strokeWidth={activeCandidate ? 4 : 2.6}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    vectorEffect="non-scaling-stroke"
                                                    opacity={activeCandidate ? 1 : 0.34}
                                                    data-testid={`qidahen-map-guide-line-${candidate.targetRegionId}`}
                                                />
                                            </>
                                        ) : null}
                                        {arrowHeadPath ? (
                                            <path
                                                d={arrowHeadPath}
                                                fill={activeCandidate ? '#d8ffbe' : routeColor}
                                                vectorEffect="non-scaling-stroke"
                                                opacity={activeCandidate ? 1 : 0.42}
                                                data-testid={`qidahen-map-guide-arrow-head-${candidate.targetRegionId}`}
                                            />
                                        ) : null}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                ) : null}
                {tutorialStepId === 'choose-grant-pardon-source' && mapSelectionGuide ? (
                    <div
                        className="pointer-events-none absolute inset-0 z-[54]"
                        data-testid="qidahen-grant-pardon-visual-relation"
                        aria-hidden="true"
                    >
                        {mapSelectionGuide.candidates.map((candidate) => {
                            if (!candidate.sourcePoint || !candidate.targetPoint) {
                                return null;
                            }
                            return (
                                <React.Fragment key={`grant-pardon-relation-${candidate.id}`}>
                                    <div
                                        className="absolute rounded border-2 border-[#ffe2a1] bg-[rgba(61,35,13,0.94)] px-2 py-1 text-[12px] font-black tracking-wide text-[#fff4c9] shadow-[0_3px_10px_rgba(32,18,7,0.68)]"
                                        data-testid="qidahen-grant-pardon-source-label"
                                        style={{
                                            left: (candidate.sourceTokenBounds?.right ?? candidate.sourcePoint.x) + 14,
                                            top: (candidate.sourceTokenBounds?.top ?? candidate.sourcePoint.y) - 12,
                                        }}
                                    >
                                        {candidate.sourceLabel}
                                    </div>
                                    <div
                                        className="absolute rounded border-2 border-[#d8ffbe] bg-[rgba(23,83,43,0.94)] px-2 py-1 text-[12px] font-black tracking-wide text-[#f0ffd9] shadow-[0_3px_12px_rgba(36,93,46,0.72)]"
                                        data-testid="qidahen-grant-pardon-target-label"
                                        style={{
                                            left: candidate.targetPoint.x + 26,
                                            top: candidate.targetPoint.y - 10,
                                        }}
                                    >
                                        {candidate.targetLabel}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                ) : null}
                <canvas
                    ref={canvasRef}
                    width={QIDAHEN_MAP_WIDTH}
                    height={QIDAHEN_MAP_HEIGHT}
                    className={`${mapHitTestingDisabled || usePixiMapPilot ? 'pointer-events-none' : 'pointer-events-auto'} absolute inset-0 h-full w-full cursor-pointer opacity-0`}
                    data-testid="qidahen-map-hitmap-canvas"
                    data-map-renderer-compat={usePixiMapPilot ? 'legacy-hidden' : undefined}
                    data-tutorial-id={tutorialMapTargetRegionId ? 'qidahen-map-target-song-jin' : undefined}
                    onPointerMove={handlePointerMove}
                    onPointerLeave={() => {
                        if (!regionTipHoverLockRef.current) {
                            setHoveredRegionId(null);
                        }
                    }}
                    onPointerUp={handlePointerUp}
                    aria-label={t('board.map.regionSelectionAria', { defaultValue: '七大恨地图区域选择' })}
                />
            </div>
            {usePixiMapPilot ? null : <MapViewportControls viewport={viewport} onViewportChange={onViewportChange} />}
            {mapSelectionGuide &&
            core.gaoDiDispatchSelection == null &&
            internalDispatchSelection == null &&
            (pendingTargetAction == null || defeatInDetailSelectableSourceRegionIds.length > 0) ? (
                <div
                    className="pointer-events-none absolute z-50 border-[3px] px-4 py-3"
                    data-testid="qidahen-map-selection-banner"
                    style={{
                        left: mapSelectionBannerLeft,
                        top: MAP_SELECTION_BANNER_TOP,
                        width: MAP_SELECTION_BANNER_WIDTH,
                        borderColor: mapSelectionBannerInteractive ? '#5fb772' : UI_STYLE.oldGold,
                        background: mapSelectionBannerInteractive
                            ? 'rgba(20, 63, 34, 0.94)'
                            : UI_SURFACE.mapPanelSelected,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div
                            className="inline-flex items-center border px-2 py-1 text-[10px] font-black tracking-[0.18em]"
                            style={{
                                borderColor: mapSelectionBannerInteractive ? '#a7e6b4' : '#f6d5a8',
                                color: mapSelectionBannerInteractive ? '#e7ffd8' : '#f6d5a8',
                                background: mapSelectionBannerInteractive
                                    ? 'rgba(76, 142, 88, 0.18)'
                                    : 'rgba(109,74,23,0.18)',
                            }}
                        >
                            {mapSelectionGuide.badgeLabel}
                        </div>
                    </div>
                    <div className="mt-2 text-[18px] font-black leading-6 [text-shadow:0_1px_0_rgba(0,0,0,0.45)]">
                        {mapSelectionGuide.title}
                    </div>
                    <div
                        className="mt-1 text-[12px] font-black leading-5"
                        style={{ color: mapSelectionBannerInteractive ? '#dbf5cf' : '#f3d1a5' }}
                    >
                        {mapSelectionBannerHint}
                    </div>
                </div>
            ) : null}
            {focusedRegion ? (
                <div
                    className="pointer-events-auto absolute z-20 border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-map-region-tip"
                    onPointerEnter={() => {
                        regionTipHoverLockRef.current = true;
                    }}
                    onPointerLeave={() => {
                        regionTipHoverLockRef.current = false;
                        setHoveredRegionId(null);
                    }}
                    style={{
                        left: tipLeft,
                        top: tipTop,
                        width: MAP_REGION_TIP_WIDTH,
                        borderColor: focusedRegion.id === core.explicitRegionId ? UI_STYLE.cinnabar : UI_STYLE.mapInk,
                        background:
                            focusedRegion.id === core.explicitRegionId
                                ? UI_SURFACE.mapPanelSelected
                                : UI_SURFACE.mapPanel,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="text-[16px] [text-shadow:0_1px_0_rgba(0,0,0,0.55)]">
                        {focusedRegion.name} · {focusedRegion.controlLabel}
                    </div>
                    {focusedSpecialTroopsSummary ? (
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.map.regionSpecialTroops', {
                                summary: focusedSpecialTroopsSummary,
                                defaultValue: '特殊 {{summary}}',
                            })}
                        </div>
                    ) : null}
                    {activeMovementPreview ? (
                        <div
                            className="mt-1 text-[11px]"
                            data-testid="qidahen-map-region-movement-preview"
                            style={{ color: '#f3d1a5' }}
                        >
                            {t('board.map.regionReachable', {
                                summary: activeMovementPreview,
                                defaultValue: '调度可达 {{summary}}',
                            })}
                        </div>
                    ) : null}
                    {!compactRegionTip && sharedPrintedRuntimeOptions.length > 1 ? (
                        <div
                            className="pointer-events-auto mt-2 flex flex-wrap items-center gap-2"
                            data-testid="qidahen-shared-printed-runtime-switcher"
                        >
                            <span className="text-[10px]" style={{ color: UI_STYLE.mapGold }}>
                                {t('board.map.sharedPrintedRegion', { defaultValue: '同图块' })}
                            </span>
                            {sharedPrintedRuntimeOptions.map((region) => {
                                const selectedOption = selectedRuntimeRegionIds.has(region.id);
                                return (
                                    <button
                                        key={region.id}
                                        type="button"
                                        data-testid={`qidahen-shared-printed-runtime-option-${region.id}`}
                                        className="inline-flex h-[28px] items-center justify-center border-[2px] px-2 text-[11px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onSelectRegion(region.id);
                                        }}
                                        style={{
                                            borderColor: selectedOption
                                                ? UI_STYLE.mapGold
                                                : 'rgba(243, 209, 165, 0.42)',
                                            background: selectedOption
                                                ? 'rgba(243, 209, 165, 0.16)'
                                                : 'rgba(19, 13, 9, 0.42)',
                                            color: selectedOption ? '#fff6dc' : '#f3d1a5',
                                            borderRadius: 3,
                                        }}
                                    >
                                        {region.name}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </ZoomPanViewport>
    );
};
