import { describe, expect, it } from 'vitest';
import { clampQidahenManualViewport, zoomQidahenMapAtPoint } from '../ui/mapRegionFocus';

describe('手动地图视野', () => {
    const options = { origin: { x: 0, y: -138 }, mapScale: 1920 / 1265,
        mapSize: { width: 1265, height: 893 }, stage: { width: 1920, height: 1080 } };

    it('拖到地图边缘时保持视口有底图，并可到达两侧边缘', () => {
        const left = clampQidahenManualViewport({ zoom: 1.3, panX: 500, panY: 800 }, options);
        const right = clampQidahenManualViewport({ zoom: 1.3, panX: -5000, panY: -5000 }, options);
        expect(options.origin.x + left.panX).toBeCloseTo(0);
        expect(options.origin.x + right.panX + options.mapSize.width * options.mapScale * right.zoom).toBeCloseTo(1920);
        expect(options.origin.y + left.panY).toBeCloseTo(0);
        expect(options.origin.y + right.panY + options.mapSize.height * options.mapScale * right.zoom).toBeCloseTo(1080);
    });

    it('缩至小于视口时居中，完整地图仍可见', () => {
        const result = clampQidahenManualViewport({ zoom: 0.5, panX: -400, panY: 500 }, options);
        expect(options.origin.x + result.panX).toBeCloseTo((1920 - 1920 * 0.5) / 2);
        expect(options.origin.y + result.panY).toBeCloseTo((1080 - options.mapSize.height * options.mapScale * 0.5) / 2);
    });

    it('通过按钮缩放时，画面中心对应的地图坐标不变', () => {
        const viewport = { zoom: 1.01, panX: -17, panY: 36 };
        const center = { x: 960, y: 540 };
        const next = zoomQidahenMapAtPoint(viewport, viewport.zoom * 1.14, options.origin, center);
        expect((center.x - options.origin.x - next.panX) / next.zoom).toBeCloseTo((center.x - options.origin.x - viewport.panX) / viewport.zoom);
        expect((center.y - options.origin.y - next.panY) / next.zoom).toBeCloseTo((center.y - options.origin.y - viewport.panY) / viewport.zoom);
    });
});
