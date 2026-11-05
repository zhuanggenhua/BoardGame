import { resolve } from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildQidahenRuntimeRegionIdByPixel } from '../ui/runtimeRegionOwnership';
import { buildQidahenPopulationSites, layoutQidahenPopulation, QIDAHEN_POPULATION_SIZE } from '../ui/populationLayout';
import { QIDAHEN_RUNTIME_REGION_DEFINITIONS } from '../ui/mapGraph';
import { createInitialCore } from '../domain/initialCoreSetup';

const width = 1265, height = 893;
let owners: (string | null)[];
const regions = QIDAHEN_RUNTIME_REGION_DEFINITIONS.map(region => ({
    id: region.id, x: region.center!.x / width, y: region.center!.y / height,
    population: 2, isLogicalRegion: false,
}));
let sites: ReturnType<typeof buildQidahenPopulationSites>;
beforeAll(async () => {
    const data = await sharp(resolve('src/games/qidahen/data/region-mask.png')).ensureAlpha().raw().toBuffer();
    owners = buildQidahenRuntimeRegionIdByPixel(new Uint8ClampedArray(data), width, height);
    sites = buildQidahenPopulationSites(owners, width, height, regions);
});

describe('七大恨人口标记的区域归属与占位', () => {
    it('37区中心与内部锚点归属正确；完整方块留在本区，窄区引线指回本区且所有方块互不重叠', () => {
        const placements = layoutQidahenPopulation(sites, regions, [], width, height);
        expect(placements).toHaveLength(37);
        for (const region of regions) {
            expect(owners[Math.round(region.y * height) * width + Math.round(region.x * width)], region.id).toBe(region.id);
        }
        for (const placement of placements) {
            const { point, anchor, regionId, callout } = placement;
            expect(owners[anchor.y * width + anchor.x], regionId).toBe(regionId);
            if (callout) {
                expect(Math.hypot(point.x - anchor.x, point.y - anchor.y)).toBeGreaterThan(QIDAHEN_POPULATION_SIZE / 2);
            } else {
                for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
                    expect(owners[(point.y + dy) * width + point.x + dx], regionId).toBe(regionId);
                }
            }
            for (const other of placements) {
                if (other.regionId === regionId) continue;
                expect(Math.abs(point.x - other.point.x) >= QIDAHEN_POPULATION_SIZE || Math.abs(point.y - other.point.y) >= QIDAHEN_POPULATION_SIZE, `${regionId}/${other.regionId}`).toBe(true);
            }
        }
    });

    it('真实开局军队/控制标记不被人口方块遮挡；人口从零恢复时邻区位置稳定', () => {
        const tokens = createInitialCore(['0', '1', '2']).mapTokens;
        const placements = layoutQidahenPopulation(sites, regions, tokens, width, height);
        for (const { point } of placements) for (const token of tokens) {
            const minimum = (QIDAHEN_POPULATION_SIZE + (token.size ?? 30)) / 2;
            expect(Math.abs(point.x - token.x * width) >= minimum || Math.abs(point.y - token.y * height) >= minimum).toBe(true);
        }
        const withoutLiaoxi = layoutQidahenPopulation(sites, regions.map(region => region.id === 'city-region-19-liaoxi' ? { ...region, population: 0 } : region), tokens, width, height);
        expect(withoutLiaoxi).toEqual(placements.filter(p => p.regionId !== 'city-region-19-liaoxi'));
    });
});
