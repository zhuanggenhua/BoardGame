import { describe, expect, it } from 'vitest';
import { focusQidahenMapRegion, clampQidahenMapViewport } from '../ui/mapRegionFocus';

describe('整片地区在实际HUD空位中聚焦', () => {
    it.each([
        { name: '桌面支付条之上', stage: { width: 1920, height: 1080 }, mapScale: 1920 / 1265,
            protectedRects: [
                { left: 740, top: 16, width: 720, height: 58 },
                { left: 136, top: 8, width: 438, height: 438 },
                { left: 1490, top: 276, width: 362, height: 470 },
                { left: 530, top: 684, width: 860, height: 85 },
                { left: 497, top: 767, width: 926, height: 295 },
            ] },
        { name: '手机手牌和支付条并存', stage: { width: 844, height: 390 }, mapScale: 0.55,
            protectedRects: [
                { left: 8, top: 6, width: 828, height: 54 },
                { left: 8, top: 66, width: 176, height: 176 },
                { left: 670, top: 72, width: 166, height: 195 },
                { left: 200, top: 86, width: 400, height: 69 },
                { left: 180, top: 170, width: 490, height: 220 },
                { left: 0, top: 255, width: 170, height: 135 },
            ] },
    ])('$name时，整个轮廓不被面板或手牌遮住', ({ stage, protectedRects, mapScale }) => {
        const region = { left: 300, top: 200, width: 127, height: 162 };
        const viewport = focusQidahenMapRegion({ region, visibleRect: { left: 0, top: 0, ...stage }, mapOrigin: { x: 0, y: 0 }, mapScale,
            protectedRects, padding: 8, preferredZoom: 1.82 });
        expect(viewport).not.toBeNull();
        const left = viewport!.panX + region.left * mapScale * viewport!.zoom;
        const top = viewport!.panY + region.top * mapScale * viewport!.zoom;
        const right = left + region.width * mapScale * viewport!.zoom;
        const bottom = top + region.height * mapScale * viewport!.zoom;
        expect(left).toBeGreaterThanOrEqual(0);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(right).toBeLessThanOrEqual(stage.width);
        expect(bottom).toBeLessThanOrEqual(stage.height);
        for (const rect of protectedRects) {
            expect(left < rect.left + rect.width && right > rect.left
                && top < rect.top + rect.height && bottom > rect.top).toBe(false);
        }
    });

    it.each([
        { zoom: 0.1, panX: 2400, panY: 1800, expectedZoom: 0.3 },
        { zoom: 9, panX: -2400, panY: -1800, expectedZoom: 5 },
    ])('正式自由平移保留正负坐标，缩放$zoom仍限幅', ({ expectedZoom, ...viewport }) => {
        expect(clampQidahenMapViewport(viewport)).toEqual({ ...viewport, zoom: expectedZoom });
    });

    it('整个可见区域都被HUD覆盖时，不声称完成聚焦', () => {
        expect(focusQidahenMapRegion({ region: { left: 0, top: 0, width: 80, height: 80 },
            visibleRect: { left: 0, top: 0, width: 300, height: 200 }, mapOrigin: { x: 0, y: 0 }, mapScale: 1,
            protectedRects: [{ left: 0, top: 0, width: 300, height: 200 }],
            padding: 8, preferredZoom: 1 })).toBeNull();
    });

    it('手机地图被上下裁切且保护区含缩放小数时，仍能使用行动区右侧的真实空位', () => {
        const scale = 1920 / 844;
        const boxes: Array<[number, number, number, number]> = [[176, 8, 492, 54], [184, 213, 656, 177], [184, 21, 340, 136],
            [540, 156, 192, 226], [8, 8, 160, 160], [176, 72, 154, 45], [8, 176, 152, 100],
            [8, 290, 72, 100], [88, 290, 72, 100], [740, 12, 44, 44],
            ...[110, 238, 366, 494, 622].map((x): [number, number, number, number] => [x, 169, 44, 44])];
        const region = { left: 831, top: 104, width: 127, height: 162 };
        const originY = (1080 - 893 * 1920 / 1265) / 2;
        const viewport = focusQidahenMapRegion({ region,
            visibleRect: { left: 0, top: 42.375 * scale, width: 1920, height: 390 * scale },
            mapOrigin: { x: 0, y: originY }, mapScale: 1920 / 1265,
            protectedRects: boxes.map(([left, top, width, height]) => ({ left: left * scale,
                top: (top + 42.375) * scale, width: width * scale, height: height * scale })),
            padding: 8 * scale, reservedLabelHeight: 24 * scale, preferredZoom: 1.82 });
        expect(viewport).not.toBeNull();
        const left = (viewport!.panX + region.left * 1920 / 1265 * viewport!.zoom) / scale;
        const top = -42.375 + (originY + viewport!.panY + region.top * 1920 / 1265 * viewport!.zoom) / scale;
        const width = region.width * 1920 / 1265 * viewport!.zoom / scale;
        const height = region.height * 1920 / 1265 * viewport!.zoom / scale;
        expect(left).toBeGreaterThanOrEqual(740 - 1e-6);
        expect(left + width).toBeLessThanOrEqual(844);
        expect(top - 24).toBeGreaterThanOrEqual(0);
        expect(top + height).toBeLessThanOrEqual(213);
    });
});
