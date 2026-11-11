import { describe, expect, it } from 'vitest';
import { getQidahenMapViewportForWheel, getQidahenMapWheelPlacement } from '../ui/mapWheelPlacement';

describe('行动轮盘与底图同一地图坐标', () => {
    const origin = { x: 0, y: -138 };
    const mapScale = 1920 / 1265;
    const stage = { width: 1920, height: 1080 };
    it.each([1, 1.14, 1.3, 1.82])('缩放 %s 时填充圆与印刷轮盘中心和外缘一致', zoom => {
        const viewport = { zoom, panX: -150, panY: 40 };
        const placement = getQidahenMapWheelPlacement({ origin, mapScale, viewport, stage });
        expect(placement.left + placement.size / 2).toBeCloseTo(origin.x + viewport.panX + 242 * mapScale * zoom);
        expect(placement.top + placement.size / 2).toBeCloseTo(origin.y + viewport.panY + 214 * mapScale * zoom);
        expect(placement.size * 187 / 384).toBeCloseTo(140 * mapScale * zoom);
    });
    it('屏外有返回需求，返回后唯一轮盘完整进入视口', () => {
        const hidden = getQidahenMapWheelPlacement({ origin, mapScale, stage, viewport: { zoom: 1.82, panX: -900, panY: -400 } });
        expect(hidden.fullyVisible).toBe(false);
        const viewport = getQidahenMapViewportForWheel({ origin, mapScale });
        const visible = getQidahenMapWheelPlacement({ origin, mapScale, stage, viewport });
        expect(visible.fullyVisible).toBe(true);
    });
});
