import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

type PersistedRegionConfig = {
    regions?: Array<{
        id: string;
        name: string;
        color: string;
        seed?: { x: number; y: number } | null;
    }>;
};

type PersistedRegionGraph = {
    nodes?: Array<{
        id?: string;
        name?: string;
        seed?: { x?: number; y?: number } | null;
        center?: { x?: number; y?: number } | null;
        pixelCount?: number;
    }>;
};

const REGION_MASK_PATH = resolve(process.cwd(), 'src/games/qidahen/data/region-mask.png');
const REGION_CONFIG_PATH = resolve(process.cwd(), 'src/games/qidahen/data/region-mask-regions.json');
const REGION_GRAPH_PATH = resolve(process.cwd(), 'src/games/qidahen/data/region-graph.json');

const readRegionConfig = () => JSON.parse(
    readFileSync(REGION_CONFIG_PATH, 'utf8'),
) as PersistedRegionConfig;

const readRegionGraph = () => JSON.parse(
    readFileSync(REGION_GRAPH_PATH, 'utf8'),
) as PersistedRegionGraph;

const hexToRgb = (value: string): readonly [number, number, number] => [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
];

describe('qidahen persisted region mask points', () => {
    it('formal region seed 与 graph 节点必须都落在各自区域像素内', async () => {
        const config = readRegionConfig();
        const graph = readRegionGraph();
        const regions = config.regions ?? [];
        const graphNodes = graph.nodes ?? [];
        const graphNodeById = new Map(
            graphNodes
                .filter((node): node is NonNullable<PersistedRegionGraph['nodes']>[number] & { id: string } => typeof node.id === 'string')
                .map((node) => [node.id, node]),
        );

        expect(graphNodes).toHaveLength(regions.length);
        expect([...graphNodeById.keys()].sort()).toEqual(regions.map((region) => region.id).sort());

        const { data, info } = await sharp(REGION_MASK_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const sample = (x: number, y: number) => {
            const offset = ((y * info.width) + x) * info.channels;
            return {
                r: data[offset],
                g: data[offset + 1],
                b: data[offset + 2],
                a: data[offset + 3],
            };
        };

        const invalidSeeds: Array<{ regionId: string; name: string; point: { x: number; y: number } | null | undefined; sampled: ReturnType<typeof sample> | null }> = [];
        const invalidGraphPoints: Array<{ regionId: string; name: string; point: { x: number; y: number } | null | undefined; sampled: ReturnType<typeof sample> | null }> = [];

        for (const region of regions) {
            const expectedColor = hexToRgb(region.color);
            const graphNode = graphNodeById.get(region.id);
            const graphPoint = graphNode?.center ?? graphNode?.seed ?? null;

            const validatePoint = (point: { x: number; y: number } | null | undefined) => {
                if (!point) {
                    return null;
                }
                if (
                    !Number.isInteger(point.x)
                    || !Number.isInteger(point.y)
                    || point.x < 0
                    || point.x >= info.width
                    || point.y < 0
                    || point.y >= info.height
                ) {
                    return null;
                }
                return sample(point.x, point.y);
            };

            const sampledSeed = validatePoint(region.seed);
            const sampledGraphPoint = validatePoint(graphPoint);
            const matchesRegionColor = (sampled: ReturnType<typeof sample> | null) => (
                Boolean(sampled)
                && sampled!.a !== 0
                && sampled!.r === expectedColor[0]
                && sampled!.g === expectedColor[1]
                && sampled!.b === expectedColor[2]
            );

            if (!matchesRegionColor(sampledSeed)) {
                invalidSeeds.push({
                    regionId: region.id,
                    name: region.name,
                    point: region.seed,
                    sampled: sampledSeed,
                });
            }
            if (!matchesRegionColor(sampledGraphPoint)) {
                invalidGraphPoints.push({
                    regionId: region.id,
                    name: region.name,
                    point: graphPoint,
                    sampled: sampledGraphPoint,
                });
            }
        }

        expect(invalidSeeds).toEqual([]);
        expect(invalidGraphPoints).toEqual([]);
    });

    it('山海关正式区域必须保持已确认基线，UI/教程高亮问题不得迁移区域真相源', async () => {
        const config = readRegionConfig();
        const graph = readRegionGraph();
        const shanhaiguan = config.regions?.find((region) => region.id === 'city-region-25');
        const shanhaiguanGraph = graph.nodes?.find((node) => node.id === 'city-region-25');
        expect(shanhaiguan).toBeTruthy();
        expect(shanhaiguanGraph).toBeTruthy();

        const expectedColor = hexToRgb(shanhaiguan!.color);
        const { data, info } = await sharp(REGION_MASK_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let pixelCount = 0;
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        const matchesShanhaiguan = (x: number, y: number) => {
            const offset = ((y * info.width) + x) * info.channels;
            return data[offset + 3] !== 0
                && data[offset] === expectedColor[0]
                && data[offset + 1] === expectedColor[1]
                && data[offset + 2] === expectedColor[2];
        };

        for (let y = 0; y < info.height; y += 1) {
            for (let x = 0; x < info.width; x += 1) {
                if (!matchesShanhaiguan(x, y)) {
                    continue;
                }
                pixelCount += 1;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }

        expect(pixelCount).toBe(10868);
        expect({ minX, minY, maxX, maxY }).toEqual({
            minX: 458,
            minY: 500,
            maxX: 622,
            maxY: 611,
        });
        expect(matchesShanhaiguan(543, 552)).toBe(true);
        expect(matchesShanhaiguan(627, 547)).toBe(false);
        expect(shanhaiguan!.seed).toEqual({ x: 543, y: 552 });
        expect(shanhaiguanGraph!.seed).toEqual({ x: 543, y: 552 });
        expect(shanhaiguanGraph!.center).toEqual({ x: 543, y: 552 });
        expect(shanhaiguanGraph!.pixelCount).toBe(pixelCount);
    });
});
