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

/** 手动平移以原图边缘为界；地图小于视口时居中，不裁剪原图。 */
export function clampQidahenManualViewport(viewport: QidahenMapViewport, options: {
    origin: { x: number; y: number }; mapScale: number;
    mapSize: { width: number; height: number }; stage: { width: number; height: number };
}): QidahenMapViewport {
    const next = clampQidahenMapViewport(viewport);
    const clampAxis = (pan: number, origin: number, mapLength: number, stageLength: number) => {
        const size = mapLength * options.mapScale * next.zoom;
        if (size <= stageLength) return (stageLength - size) / 2 - origin;
        return Math.max(stageLength - origin - size, Math.min(-origin, pan));
    };
    return { ...next,
        panX: clampAxis(next.panX, options.origin.x, options.mapSize.width, options.stage.width),
        panY: clampAxis(next.panY, options.origin.y, options.mapSize.height, options.stage.height) };
}

/** 按画面中心缩放，保持中心处的地图内容不动。 */
export function zoomQidahenMapAtPoint(viewport: QidahenMapViewport, zoom: number,
    origin: { x: number; y: number }, point: { x: number; y: number }): QidahenMapViewport {
    const nextZoom = Math.max(QIDAHEN_MAP_MIN_ZOOM, Math.min(QIDAHEN_MAP_MAX_ZOOM, zoom));
    const ratio = nextZoom / viewport.zoom;
    return { zoom: nextZoom, panX: point.x - origin.x - (point.x - origin.x - viewport.panX) * ratio,
        panY: point.y - origin.y - (point.y - origin.y - viewport.panY) * ratio };
}

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
    mapSize?: { width: number; height: number };
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
        if (options.mapSize) {
            // 同时满足对象留在可见空位及地图覆盖视口，不能先居中再简单夹取。
            const width = options.mapSize.width * mapScale * viewport.zoom;
            const height = options.mapSize.height * mapScale * viewport.zoom;
            if (width < visibleRect.width || height < visibleRect.height) return [];
            const left = Math.max(visibleRect.left + visibleRect.width - mapOrigin.x - width,
                frame.left - mapOrigin.x - region.left * mapScale * zoom);
            const right = Math.min(visibleRect.left - mapOrigin.x,
                frame.left + frame.width - mapOrigin.x - (region.left + region.width) * mapScale * zoom);
            const top = Math.max(visibleRect.top + visibleRect.height - mapOrigin.y - height,
                frame.top + labelHeight - mapOrigin.y - region.top * mapScale * zoom);
            const bottom = Math.min(visibleRect.top - mapOrigin.y,
                frame.top + frame.height - mapOrigin.y - (region.top + region.height) * mapScale * zoom);
            if (left > right + 1e-6 || top > bottom + 1e-6) return [];
            viewport.panX = Math.max(left, Math.min(right, viewport.panX));
            viewport.panY = Math.max(top, Math.min(bottom, viewport.panY));
        }
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

/** 按墙线本身避开当前可见控件；墙线外接矩形中的空地图不应被当作墙体。 */
export function focusQidahenMapPolyline(options: {
    points: readonly (readonly [number, number])[];
    visibleRect: Rect;
    mapOrigin: { x: number; y: number };
    mapScale: number;
    mapSize: { width: number; height: number };
    protectedRects: readonly Rect[];
    preferredZoom: number;
    padding: number;
    mapPadding?: { x: number; y: number };
}): QidahenMapViewport | null {
    const { points, visibleRect: screen, mapOrigin, mapScale, mapSize, padding } = options;
    if (points.length < 2) return null;
    const obstacles = options.protectedRects.map(rect => ({ left: rect.left - padding, top: rect.top - padding,
        width: rect.width + 2 * padding, height: rect.height + 2 * padding }));
    // 保留整张底图覆盖视口；墙线采用实际线段采样，避免矩形中的空白误判。
    const samples = points.flatMap((point, index) => {
        const next = points[index + 1];
        if (!next) return [point];
        const count = Math.max(1, Math.ceil(Math.hypot(next[0] - point[0], next[1] - point[1]) / 4));
        return Array.from({ length: count }, (_, i) => [point[0] + (next[0] - point[0]) * i / count,
            point[1] + (next[1] - point[1]) * i / count] as const);
    });
    const minimumZoom = Math.max(QIDAHEN_MAP_MIN_ZOOM, screen.width / (mapSize.width * mapScale), screen.height / (mapSize.height * mapScale));
    const maxZoom = Math.min(QIDAHEN_MAP_MAX_ZOOM, options.preferredZoom);
    const zooms: number[] = [];
    for (let zoom = maxZoom; zoom > minimumZoom; zoom -= 0.08) zooms.push(zoom);
    if (minimumZoom <= maxZoom) zooms.push(Math.min(maxZoom, minimumZoom + 1e-6));
    for (const zoom of zooms) {
        const factor = mapScale * zoom;
        const minX = screen.left + screen.width - mapOrigin.x - mapSize.width * factor;
        const maxX = screen.left - mapOrigin.x;
        const minY = screen.top + screen.height - mapOrigin.y - mapSize.height * factor;
        const maxY = screen.top - mapOrigin.y;
        let best: { viewport: QidahenMapViewport; distance: number } | null = null;
        for (let x = minX; x <= maxX + 0.001; x += 24) for (let y = minY; y <= maxY + 0.001; y += 24) {
            const valid = samples.every(point => {
                const px = mapOrigin.x + x + point[0] * factor, py = mapOrigin.y + y + point[1] * factor;
                const padX = padding + (options.mapPadding?.x ?? 0) * factor;
                const padY = padding + (options.mapPadding?.y ?? 0) * factor;
                return px >= screen.left + padX && px <= screen.left + screen.width - padX
                    && py >= screen.top + padY && py <= screen.top + screen.height - padY
                    && !obstacles.some(rect => px >= rect.left && px <= rect.left + rect.width && py >= rect.top && py <= rect.top + rect.height);
            });
            if (!valid) continue;
            const center = samples[Math.floor(samples.length / 2)];
            const distance = Math.hypot(mapOrigin.x + x + center[0] * factor - screen.left - screen.width / 2,
                mapOrigin.y + y + center[1] * factor - screen.top - screen.height / 2);
            if (!best || distance < best.distance) best = { viewport: { zoom, panX: x, panY: y }, distance };
        }
        if (best) return best.viewport;
    }
    return null;
}
