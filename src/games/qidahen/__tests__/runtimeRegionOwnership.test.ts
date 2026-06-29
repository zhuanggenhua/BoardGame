import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { buildQidahenRuntimeRegionIdByPixel, resolveQidahenSharedPrintedRegionAnchors } from '../ui/runtimeRegionOwnership';
import { getQidahenRuntimeRegionIdsForPrintedRegionId, QIDAHEN_REGION_ID_BY_MASK_COLOR, qidahenRegionColorKey } from '../ui/mapGraph';

const REGION_MASK_PATH = resolve(process.cwd(), 'src/games/qidahen/data/region-mask.png');

describe('qidahen runtime region ownership', () => {
    it('共享印刷区会生成独立的运行时锚点，而不是继续共用同一个中心点', async () => {
        const { data, info } = await sharp(REGION_MASK_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const printedRegionIdByPixel: Array<string | null> = new Array(info.width * info.height).fill(null);

        for (let pixelIndex = 0; pixelIndex < info.width * info.height; pixelIndex += 1) {
            const offset = pixelIndex * info.channels;
            if (data[offset + 3] === 0) {
                continue;
            }
            const colorKey = qidahenRegionColorKey(data[offset], data[offset + 1], data[offset + 2]);
            printedRegionIdByPixel[pixelIndex] = QIDAHEN_REGION_ID_BY_MASK_COLOR[colorKey] ?? null;
        }

        for (const printedRegionId of ['city-region-15', 'city-region-19', 'city-region-28']) {
            const runtimeRegionIds = getQidahenRuntimeRegionIdsForPrintedRegionId(printedRegionId);
            const regionMask = new Uint8Array(info.width * info.height);
            for (let pixelIndex = 0; pixelIndex < printedRegionIdByPixel.length; pixelIndex += 1) {
                if (printedRegionIdByPixel[pixelIndex] === printedRegionId) {
                    regionMask[pixelIndex] = 1;
                }
            }
            const anchors = resolveQidahenSharedPrintedRegionAnchors(
                printedRegionId,
                runtimeRegionIds,
                regionMask,
                info.width,
                info.height,
            );
            expect(anchors.map((anchor) => anchor.runtimeRegionId).sort()).toEqual([...runtimeRegionIds].sort());
            expect(new Set(anchors.map((anchor) => anchor.pixelIndex)).size).toBe(runtimeRegionIds.length);
        }
    });

    it('共享印刷区的运行时像素归属会把每个子区域都实际拆出来', async () => {
        const { data, info } = await sharp(REGION_MASK_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const ownership = buildQidahenRuntimeRegionIdByPixel(
            new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
            info.width,
            info.height,
        );
        const pixelCountByRuntimeRegionId = new Map<string, number>();

        for (const runtimeRegionId of ownership) {
            if (!runtimeRegionId) {
                continue;
            }
            pixelCountByRuntimeRegionId.set(runtimeRegionId, (pixelCountByRuntimeRegionId.get(runtimeRegionId) ?? 0) + 1);
        }

        expect(pixelCountByRuntimeRegionId.get('city-region-15-liaodong')).toBeGreaterThan(0);
        expect(pixelCountByRuntimeRegionId.get('city-region-19-liaoxi')).toBeGreaterThan(0);
        expect(pixelCountByRuntimeRegionId.get('city-region-28-jizhen')).toBeGreaterThan(0);
        expect(pixelCountByRuntimeRegionId.get('city-region-28')).toBeGreaterThan(0);
    });
});
