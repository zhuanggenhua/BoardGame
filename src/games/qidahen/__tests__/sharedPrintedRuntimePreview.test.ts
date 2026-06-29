import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { buildQidahenSharedPrintedRuntimePreviews } from '../ui/sharedPrintedRuntimePreview';

const REGION_MASK_PATH = resolve(process.cwd(), 'src/games/qidahen/data/region-mask.png');

describe('七大恨 shared printed 运行时拆分预览', () => {
    it('会为正式共享印刷区生成可视拆分预览，并保留各自像素统计', async () => {
        const { data, info } = await sharp(REGION_MASK_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const previews = buildQidahenSharedPrintedRuntimePreviews(
            new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
            info.width,
            info.height,
            ['city-region-15', 'city-region-19', 'city-region-28'],
        );

        expect(previews.map((preview) => preview.printedRegionId)).toEqual([
            'city-region-15',
            'city-region-19',
            'city-region-28',
        ]);

        const liaobeiPreview = previews.find((preview) => preview.printedRegionId === 'city-region-15');
        expect(liaobeiPreview).toBeDefined();
        expect(liaobeiPreview?.runtimeRegionIds).toEqual(['city-region-15', 'city-region-15-liaodong']);
        expect(liaobeiPreview?.anchors).toHaveLength(2);
        expect(liaobeiPreview?.pixelCountByRuntimeRegionId['city-region-15']).toBeGreaterThan(0);
        expect(liaobeiPreview?.pixelCountByRuntimeRegionId['city-region-15-liaodong']).toBeGreaterThan(0);
        expect(liaobeiPreview?.width).toBeGreaterThan(0);
        expect(liaobeiPreview?.height).toBeGreaterThan(0);
        expect(liaobeiPreview?.pixels.length).toBe(liaobeiPreview!.width * liaobeiPreview!.height * 4);

        const liaoxiPreview = previews.find((preview) => preview.printedRegionId === 'city-region-19');
        expect(liaoxiPreview?.pixelCountByRuntimeRegionId['city-region-19-liaoxi']).toBeGreaterThan(0);

        const jizhenPreview = previews.find((preview) => preview.printedRegionId === 'city-region-28');
        expect(jizhenPreview?.pixelCountByRuntimeRegionId['city-region-28-jizhen']).toBeGreaterThan(0);
        expect(jizhenPreview?.pixelCountByRuntimeRegionId['city-region-28']).toBeGreaterThan(0);
    });
});
