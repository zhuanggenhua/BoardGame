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
});
