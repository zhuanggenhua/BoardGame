import type { QidahenRuntimeRegionBounds } from './runtimeRegionOwnership';

type Rect = QidahenRuntimeRegionBounds;
export type QidahenMapViewport = { zoom: number; panX: number; panY: number };
export const QIDAHEN_MAP_MIN_ZOOM = 0.3;
export const QIDAHEN_MAP_MAX_ZOOM = 5;

/** 两种地图渲染共用自由平移；缩放仍受正式范围限制。 */
export const clampQidahenMapViewport = (viewport: QidahenMapViewport): QidahenMapViewport => ({
    ...viewport,
    zoom: Math.max(QIDAHEN_MAP_MIN_ZOOM, Math.min(QIDAHEN_MAP_MAX_ZOOM, viewport.zoom)),
});

// 壳层缩放后的相接边可能相差约1e-13，不能因此把有实际留白的空位判成相交。
const overlaps = (a: Rect, b: Rect) => a.left < b.left + b.width - 1e-6 && a.left + a.width > b.left + 1e-6
    && a.top < b.top + b.height - 1e-6 && a.top + a.height > b.top + 1e-6;
const contains = (a: Rect, b: Rect) => a.left <= b.left + 1e-6 && a.top <= b.top + 1e-6
    && a.left + a.width + 1e-6 >= b.left + b.width && a.top + a.height + 1e-6 >= b.top + b.height;

/** 地图取景与临时结算共用同一空位计算，不挤占当前军队和常驻HUD。 */
export function getQidahenAvailableMapFrames(visibleRect: Rect, protectedRects: readonly Rect[], padding: number): Rect[] {
    const screen = { left: visibleRect.left + padding, top: visibleRect.top + padding, width: visibleRect.width - padding * 2, height: visibleRect.height - padding * 2 };
    const obstacles = protectedRects.map(rect => ({ left: rect.left - padding, top: rect.top - padding, width: rect.width + padding * 2, height: rect.height + padding * 2 }));
    let frames = [screen];
    for (const obstacle of obstacles) {
        const next = frames.flatMap(frame => !overlaps(frame, obstacle) ? [frame] : [
            { ...frame, height: obstacle.top - frame.top },
            { ...frame, top: obstacle.top + obstacle.height, height: frame.top + frame.height - obstacle.top - obstacle.height },
            { ...frame, width: obstacle.left - frame.left },
            { ...frame, left: obstacle.left + obstacle.width, width: frame.left + frame.width - obstacle.left - obstacle.width },
        ].filter(rect => rect.width > 0 && rect.height > 0 && contains(frame, rect)));
        frames = next.filter((rect, index) => !next.some((other, otherIndex) => otherIndex !== index && contains(other, rect) && (!contains(rect, other) || otherIndex < index)));
    }
    return frames;
}

/** 根据整片地区范围寻找可见地图空位，不再用地区中心点周围的圆形尺寸估算。 */
export const focusQidahenMapRegion = (options: {
    region: Rect;
    visibleRect: Rect;
    mapOrigin: { x: number; y: number };
    mapScale: number;
    protectedRects: readonly Rect[];
    padding: number;
    reservedLabelHeight?: number;
    preferredZoom: number;
}): QidahenMapViewport | null => {
    const { visibleRect, padding, region, mapScale, mapOrigin } = options;
    const labelHeight = options.reservedLabelHeight ?? 0;
    const screen = { left: visibleRect.left + padding, top: visibleRect.top + padding,
        width: visibleRect.width - padding * 2, height: visibleRect.height - padding * 2 };
    const obstacles = options.protectedRects.map(rect => ({ left: rect.left - padding, top: rect.top - padding,
        width: rect.width + padding * 2, height: rect.height + padding * 2 }));
    const frames = getQidahenAvailableMapFrames(visibleRect, options.protectedRects, padding);
    const candidates = frames.flatMap(frame => {
        const zoom = Math.min(QIDAHEN_MAP_MAX_ZOOM, options.preferredZoom, frame.width / (region.width * mapScale), (frame.height - labelHeight) / (region.height * mapScale));
        if (zoom < QIDAHEN_MAP_MIN_ZOOM) return [];
        const viewport = clampQidahenMapViewport({ zoom,
            panX: frame.left + frame.width / 2 - mapOrigin.x - (region.left + region.width / 2) * mapScale * zoom,
            panY: frame.top + labelHeight + (frame.height - labelHeight) / 2 - mapOrigin.y - (region.top + region.height / 2) * mapScale * zoom });
        const projected = { left: mapOrigin.x + viewport.panX + region.left * mapScale * viewport.zoom,
            top: mapOrigin.y + viewport.panY + region.top * mapScale * viewport.zoom,
            width: region.width * mapScale * viewport.zoom, height: region.height * mapScale * viewport.zoom };
        const occupied = { ...projected, top: projected.top - labelHeight, height: projected.height + labelHeight };
        if (!contains(screen, occupied) || obstacles.some(rect => overlaps(rect, occupied))) return [];
        return [{ viewport, distance: Math.abs(projected.left + projected.width / 2 - visibleRect.left - visibleRect.width / 2)
            + Math.abs(projected.top + projected.height / 2 - visibleRect.top - visibleRect.height / 2) }];
    });
    candidates.sort((a, b) => b.viewport.zoom - a.viewport.zoom || a.distance - b.distance);
    return candidates[0]?.viewport ?? null;
};
