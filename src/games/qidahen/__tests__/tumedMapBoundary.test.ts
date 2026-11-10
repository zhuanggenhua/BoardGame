import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { resolveQidahenMapRegionAtPoint } from '../ui/mapRegionHitTesting';
import { buildQidahenRuntimeRegionIdByPixel, getQidahenRuntimeRegionBounds } from '../ui/runtimeRegionOwnership';

describe('土默特及相邻地区的正式地图像素', () => {
    it('印刷分界线不再被识别成远端土默特地区，两侧的地区仍可命中', async () => {
        const dataDir = resolve(process.cwd(), 'src/games/qidahen/data');
        const { data, info } = await sharp(resolve(dataDir, 'region-mask.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
        const ownership = buildQidahenRuntimeRegionIdByPixel(pixels, info.width, info.height);
        const samples: Array<[number, number, string | null]> = [
            [409, 150, null], [410, 180, null], [406, 200, null],
            [402, 210, null], [400, 230, null], [396, 250, null],
            [412, 150, 'city-region-8'], [450, 210, 'city-region-8'],
            [330, 370, 'city-region-16'], [299, 378, 'city-region-20'],
            [280, 390, 'city-region-20'], [200, 420, 'city-region-20'],
        ];
        for (const [x, y, expected] of samples) {
            expect(resolveQidahenMapRegionAtPoint(ownership, info.width, info.height, { x, y }), `${x},${y}`).toBe(expected);
        }
        const bounds = getQidahenRuntimeRegionBounds(ownership, info.width, info.height, ['city-region-20']);
        expect(bounds?.top).toBeGreaterThanOrEqual(370);

        const indexes = ownership.flatMap((id, index) => id === 'city-region-20' ? [index] : []);
        const expected = {
            pixelCount: indexes.length,
            center: {
                x: Math.round(indexes.reduce((sum, index) => sum + index % info.width, 0) / indexes.length),
                y: Math.round(indexes.reduce((sum, index) => sum + Math.floor(index / info.width), 0) / indexes.length),
            },
        };
        for (const file of ['region-graph.json', 'runtime-region-graph.json']) {
            const graph = JSON.parse(readFileSync(resolve(dataDir, file), 'utf8'));
            expect(graph.nodes.find((node: { id: string }) => node.id === 'city-region-20')).toMatchObject(expected);
        }
    });
});
