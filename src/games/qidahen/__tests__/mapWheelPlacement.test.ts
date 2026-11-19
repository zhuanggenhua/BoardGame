import { describe, expect, it } from 'vitest';
import { getQidahenMapWheelPlacement } from '../ui/mapWheelPlacement';

describe('行动轮盘固定在舞台上', () => {
    const origin = { x: 0, y: -138 };
    const mapScale = 1920 / 1265;
    it('按复位镜头计算唯一的固定位置，保留原印刷盘基准尺寸', () => {
        const initialView = { zoom: 1.01, panX: -17, panY: 36 };
        const placement = getQidahenMapWheelPlacement({ origin, mapScale, initialView });
        const scale = mapScale * initialView.zoom;
        expect(placement.left).toBeGreaterThan(0);
        expect(placement.top).toBeGreaterThan(0);
        expect(placement.left + placement.size / 2).toBeCloseTo(origin.x + initialView.panX + 242 * scale);
        expect(placement.top + placement.size / 2).toBeCloseTo(origin.y + initialView.panY + 214 * scale);
        expect(placement.size * 187 / 384).toBeCloseTo(140 * scale);
    });
});
