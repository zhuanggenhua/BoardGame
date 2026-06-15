import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

type PersistedRegionConfig = {
    regions?: Array<{
        id: string;
        name: string;
        color: string;
    }>;
};

const REGION_MASK_PATH = resolve(process.cwd(), 'src/games/qidahen/data/region-mask.png');
const REGION_CONFIG_PATH = resolve(process.cwd(), 'src/games/qidahen/data/region-mask-regions.json');

const readRegionConfig = () => JSON.parse(
    readFileSync(REGION_CONFIG_PATH, 'utf8'),
) as PersistedRegionConfig;

const hexToRgb = (value: string): readonly [number, number, number] => [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
];

describe('qidahen formal region mask 连通性', () => {
    it('每个正式区域都必须只对应一个连续闭合块，不能把异地闭合块染成同一区域', async () => {
        const config = readRegionConfig();
        const regions = config.regions ?? [];
        const { data, info } = await sharp(REGION_MASK_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const visited = new Uint8Array(info.width * info.height);
        const componentCountByRegionId = new Map<string, number>();
        const regionIdByColor = new Map(
            regions.map((region) => [hexToRgb(region.color).join(','), region.id]),
        );
        const queue = new Uint32Array(info.width * info.height);

        const readRegionIdAt = (x: number, y: number): string | null => {
            const offset = ((y * info.width) + x) * info.channels;
            if (data[offset + 3] === 0) {
                return null;
            }
            return regionIdByColor.get([data[offset], data[offset + 1], data[offset + 2]].join(',')) ?? null;
        };

        for (let y = 0; y < info.height; y += 1) {
            for (let x = 0; x < info.width; x += 1) {
                const pixelIndex = (y * info.width) + x;
                if (visited[pixelIndex] !== 0) {
                    continue;
                }
                visited[pixelIndex] = 1;
                const regionId = readRegionIdAt(x, y);
                if (!regionId) {
                    continue;
                }

                componentCountByRegionId.set(regionId, (componentCountByRegionId.get(regionId) ?? 0) + 1);
                let head = 0;
                let tail = 0;
                queue[tail] = pixelIndex;
                tail += 1;

                while (head < tail) {
                    const currentIndex = queue[head];
                    head += 1;
                    const currentX = currentIndex % info.width;
                    const currentY = Math.floor(currentIndex / info.width);
                    const neighbors = [
                        currentX > 0 ? currentIndex - 1 : -1,
                        currentX < info.width - 1 ? currentIndex + 1 : -1,
                        currentY > 0 ? currentIndex - info.width : -1,
                        currentY < info.height - 1 ? currentIndex + info.width : -1,
                    ];
                    for (const nextIndex of neighbors) {
                        if (nextIndex < 0 || visited[nextIndex] !== 0) {
                            continue;
                        }
                        const nextX = nextIndex % info.width;
                        const nextY = Math.floor(nextIndex / info.width);
                        if (readRegionIdAt(nextX, nextY) !== regionId) {
                            continue;
                        }
                        visited[nextIndex] = 1;
                        queue[tail] = nextIndex;
                        tail += 1;
                    }
                }
            }
        }

        const disconnectedRegions = regions
            .map((region) => ({
                regionId: region.id,
                regionName: region.name,
                componentCount: componentCountByRegionId.get(region.id) ?? 0,
            }))
            .filter((region) => region.componentCount !== 1);

        expect(disconnectedRegions).toEqual([]);
    });
});
