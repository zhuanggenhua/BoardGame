import {
    QIDAHEN_MAP_MIN_ZOOM,
    QIDAHEN_MAP_MAX_ZOOM,
    QIDAHEN_PIXI_MAP_PILOT_ENABLED,
    MAP_COVER_SCALE,
    STAGE_WIDTH,
    MAP_COVER_LEFT,
    STAGE_HEIGHT,
    MAP_COVER_TOP,
} from './boardLayout';
import { QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT } from '../data/mapRegions';

export type QidahenMapViewport = {
    zoom: number;
    panX: number;
    panY: number;
};

export const DEFAULT_QIDAHEN_MAP_VIEWPORT: QidahenMapViewport = {
    zoom: 1,
    panX: 0,
    panY: 0,
};

export const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const clampQidahenMapViewport = (viewport: QidahenMapViewport): QidahenMapViewport => {
    const zoom = clampNumber(viewport.zoom, QIDAHEN_MAP_MIN_ZOOM, QIDAHEN_MAP_MAX_ZOOM);
    if (QIDAHEN_PIXI_MAP_PILOT_ENABLED) {
        return {
            zoom,
            panX: viewport.panX,
            panY: viewport.panY,
        };
    }
    const scaledMapWidth = QIDAHEN_MAP_WIDTH * MAP_COVER_SCALE * zoom;
    const scaledMapHeight = QIDAHEN_MAP_HEIGHT * MAP_COVER_SCALE * zoom;
    const minPanX = STAGE_WIDTH - MAP_COVER_LEFT - scaledMapWidth;
    const maxPanX = -MAP_COVER_LEFT;
    const minPanY = STAGE_HEIGHT - MAP_COVER_TOP - scaledMapHeight;
    const maxPanY = -MAP_COVER_TOP;
    return {
        zoom,
        panX: clampNumber(viewport.panX, minPanX, maxPanX),
        panY: clampNumber(viewport.panY, minPanY, maxPanY),
    };
};

export const projectQidahenMapPointToStage = (point: { x: number; y: number }, viewport: QidahenMapViewport) => ({
    x: MAP_COVER_LEFT + viewport.panX + point.x * MAP_COVER_SCALE * viewport.zoom,
    y: MAP_COVER_TOP + viewport.panY + point.y * MAP_COVER_SCALE * viewport.zoom,
});

export const buildQidahenFocusedMapViewport = (
    point: { x: number; y: number },
    zoom: number = 1.62,
): QidahenMapViewport =>
    clampQidahenMapViewport({
        zoom,
        panX: STAGE_WIDTH / 2 - MAP_COVER_LEFT - point.x * MAP_COVER_SCALE * zoom,
        panY: STAGE_HEIGHT / 2 - MAP_COVER_TOP - point.y * MAP_COVER_SCALE * zoom,
    });

export const buildQidahenFocusedMapViewportForPoints = (
    points: Array<{ x: number; y: number }>,
    zoom: number = 1.48,
): QidahenMapViewport | null => {
    if (points.length <= 0) {
        return null;
    }
    if (points.length === 1) {
        return buildQidahenFocusedMapViewport(points[0], zoom);
    }
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const focusPoint = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
    };
    return clampQidahenMapViewport({
        zoom,
        panX: STAGE_WIDTH / 2 - MAP_COVER_LEFT - focusPoint.x * MAP_COVER_SCALE * zoom,
        panY: STAGE_HEIGHT * 0.44 - MAP_COVER_TOP - focusPoint.y * MAP_COVER_SCALE * zoom,
    });
};

export const QIDAHEN_MAP_GUIDE_TARGET_PREFIX = 'qidahen-map-guide-hit-target-';

export const getQidahenTutorialMapFocusRegionId = (highlightTarget: string | null | undefined): string | null => {
    if (!highlightTarget?.startsWith(QIDAHEN_MAP_GUIDE_TARGET_PREFIX)) {
        return null;
    }
    return highlightTarget.slice(QIDAHEN_MAP_GUIDE_TARGET_PREFIX.length) || null;
};
