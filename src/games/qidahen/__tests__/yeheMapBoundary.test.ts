import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveQidahenMapRegionAtPoint } from '../ui/mapRegionHitTesting';
import { buildQidahenRuntimeRegionIdByPixel, getQidahenRuntimeRegionBounds } from '../ui/runtimeRegionOwnership';

const dataDir = resolve(process.cwd(), 'src/games/qidahen/data');
const affectedIds = ['city-region-3', 'city-region-4', 'city-region-5', 'city-region-7',
    'city-region-9', 'city-region-10', 'city-region-11', 'city-region-13'];

describe('叶赫及相邻地区的正式地图像素', () => {
    let pixels: Uint8ClampedArray;
    let ownership: Array<string | null>;
    let width: number;
    let height: number;

    beforeAll(async () => {
        const result = await sharp(resolve(dataDir, 'region-mask.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        width = result.info.width;
        height = result.info.height;
        pixels = new Uint8ClampedArray(result.data.buffer, result.data.byteOffset, result.data.byteLength);
        ownership = buildQidahenRuntimeRegionIdByPixel(pixels, width, height);
    });

    it('两岸土地分别命中对应地区，叶赫不会沿远端河道延伸', () => {
        const samples: Array<[number, number, string | null]> = [
            [900, 85, 'city-region-4'], [900, 120, 'city-region-7'],
            [810, 180, 'city-region-3'], [845, 180, 'city-region-7'],
            [940, 180, 'city-region-7'], [975, 180, 'city-region-9'],
            [900, 245, 'city-region-7'], [900, 295, 'city-region-15'],
            [700, 140, 'city-region-3'], [700, 155, 'city-region-6'],
            [770, 185, 'city-region-3'], [770, 210, 'city-region-10'],
            [1040, 115, 'city-region-4'], [1040, 155, 'city-region-9'],
            [1200, 180, 'city-region-5'], [1200, 220, 'city-region-11'],
            [705, 150, null], [770, 200, null],
        ];
        for (const [x, y, expected] of samples) {
            expect(resolveQidahenMapRegionAtPoint(ownership, width, height, { x, y }), `${x},${y}`).toBe(expected);
        }
        expect(getQidahenRuntimeRegionBounds(ownership, width, height, ['city-region-7']))
            .toEqual({ left: 819, top: 93, width: 149, height: 185 });
    });

    it('受影响土地的两份 graph 面积和中心与正式像素一致', () => {
        const graphs = ['region-graph.json', 'runtime-region-graph.json'].map(file => JSON.parse(readFileSync(resolve(dataDir, file), 'utf8')));
        for (const id of affectedIds) {
            let count = 0, sumX = 0, sumY = 0;
            for (let index = 0; index < ownership.length; index += 1) {
                if (ownership[index] !== id) continue;
                count += 1;
                sumX += index % width;
                sumY += Math.floor(index / width);
            }
            const expected = { pixelCount: count, center: { x: Math.round(sumX / count), y: Math.round(sumY / count) } };
            for (const graph of graphs) expect(graph.nodes.find((node: { id: string }) => node.id === id)).toMatchObject(expected);
        }
    });
});
