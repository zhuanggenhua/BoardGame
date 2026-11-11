import { describe, expect, it } from 'vitest';
import { QIDAHEN_MASK_REGION_BY_ID, qidahenRegionColorKey } from '../ui/mapGraph';
import { buildRegionMaskOverlayPixels, buildRegionOwnershipOverlayPixels, REGION_MASK_OVERLAY_TONES } from '../ui/regionMaskOverlay';
import { buildQidahenRuntimeRegionIdByPixel } from '../ui/runtimeRegionOwnership';
import { resolveQidahenMapRegionAtPoint } from '../ui/mapRegionHitTesting';
import sharp from 'sharp';

const parseHexColor = (hex: string): readonly [number, number, number] => {
    const normalized = hex.replace('#', '');
    return [
        Number.parseInt(normalized.slice(0, 2), 16),
        Number.parseInt(normalized.slice(2, 4), 16),
        Number.parseInt(normalized.slice(4, 6), 16),
    ];
};

const createRegionHitmap = (
    regionId: string,
    width = 7,
    height = 7,
    bounds: { left: number; right: number; top: number; bottom: number } = { left: 2, right: 4, top: 2, bottom: 4 },
) => {
    const region = QIDAHEN_MASK_REGION_BY_ID.get(regionId);
    if (!region) {
        throw new Error(`missing qidahen mask region: ${regionId}`);
    }
    const [red, green, blue] = parseHexColor(region.color);
    const hitmap = new Uint8ClampedArray(width * height * 4);

    for (let y = bounds.top; y <= bounds.bottom; y += 1) {
        for (let x = bounds.left; x <= bounds.right; x += 1) {
            const offset = (y * width + x) * 4;
            hitmap[offset] = red;
            hitmap[offset + 1] = green;
            hitmap[offset + 2] = blue;
            hitmap[offset + 3] = 255;
        }
    }

    return {
        hitmap,
        colorKey: qidahenRegionColorKey(red, green, blue),
    };
};

const countVisiblePixelsOutsideMask = (
    pixels: Uint8ClampedArray,
    colorKey: number,
    hitmap: Uint8ClampedArray,
    width: number,
    height: number,
) => {
    let count = 0;
    for (let index = 0; index < width * height; index += 1) {
        const hitmapOffset = index * 4;
        const hitmapKey = qidahenRegionColorKey(hitmap[hitmapOffset], hitmap[hitmapOffset + 1], hitmap[hitmapOffset + 2]);
        const isRegionPixel = hitmap[hitmapOffset + 3] !== 0 && hitmapKey === colorKey;
        if (isRegionPixel) {
            continue;
        }
        if (pixels[hitmapOffset + 3] > 0) {
            count += 1;
        }
    }
    return count;
};

const readAlphaAt = (pixels: Uint8ClampedArray, width: number, x: number, y: number) => (
    pixels[((y * width) + x) * 4 + 3]
);

describe('Qidahen region mask overlay', () => {
    it('普通候选缩细内描边时保留东江狭长地面的填色和点击归属，不改变推荐或选中样式', async () => {
        const { data, info } = await sharp('src/games/qidahen/data/region-mask.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const owners = buildQidahenRuntimeRegionIdByPixel(new Uint8ClampedArray(data), info.width, info.height);
        Object.freeze(owners);
        const regionId = 'city-region-22';
        const hit = (x: number, y: number) => resolveQidahenMapRegionAtPoint(owners, info.width, info.height, { x, y }, [regionId]);
        const point = { x: 905, y: 505 };
        expect(hit(point.x, point.y)).toBe(regionId);
        const pixels = buildRegionOwnershipOverlayPixels(owners, info.width, info.height, new Map([[regionId, 'candidate']]));
        const pixel = (x: number, y: number) => [...pixels.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
        expect(REGION_MASK_OVERLAY_TONES.candidate.innerStrokeRadius).toBe(1);
        expect(pixel(885, 500)).toEqual([...REGION_MASK_OVERLAY_TONES.candidate.fill]);
        expect(pixel(910, 507)[3]).toBeGreaterThan(0);
        expect(pixel(918, 510)[3]).toBe(0);
        expect(hit(point.x, point.y)).toBe(regionId);
        expect(REGION_MASK_OVERLAY_TONES.tutorialPrimary).toMatchObject({ stroke: [255, 255, 236, 255], innerStrokeRadius: 2 });
        expect(REGION_MASK_OVERLAY_TONES.selected.stroke).toEqual([255, 221, 112, 255]);
    });
    it('印刷说明不显示选中光晕或候选描边，紧邻的土地仍用普通填色', async () => {
        const { data, info } = await sharp('src/games/qidahen/data/region-mask.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const owners = buildQidahenRuntimeRegionIdByPixel(new Uint8ClampedArray(data), info.width, info.height);
        const pixel = (pixels: Uint8ClampedArray, x: number, y: number) => [...pixels.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
        for (const tone of ['candidate', 'selected'] as const) {
            const pixels = buildRegionOwnershipOverlayPixels(owners, info.width, info.height, new Map([['city-region-8', tone]]));
            for (const [x, y] of [[14, 130], [50, 100], [90, 130], [165, 20], [40, 300]]) {
                expect(pixel(pixels, x, y)[3], `${tone} 说明像素 (${x},${y})`).toBe(0);
            }
            for (const [x, y] of [[13, 130], [91, 130], [92, 300], [164, 20]]) {
                expect(pixel(pixels, x, y), `${tone} 说明旁土地 (${x},${y})`).toEqual([...REGION_MASK_OVERLAY_TONES[tone].fill]);
            }
        }
    });
    it('印刷轮盘挖空不会产生巴林候选或选中圆形描边，真实地区边缘仍有描边', () => {
        const width = 1265, height = 893;
        const owners: Array<string | null> = Array(width * height).fill(null);
        for (let y = 210; y <= 218; y++) for (let x = 381; x <= 400; x++) owners[y * width + x] = 'city-region-8';
        const pixel = (pixels: Uint8ClampedArray, x: number, y: number) => [...pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];
        const candidate = buildRegionOwnershipOverlayPixels(owners, width, height, new Map([['city-region-8', 'candidate']]));
        expect(pixel(candidate, 381, 214)).toEqual([...REGION_MASK_OVERLAY_TONES.candidate.fill]);
        expect(pixel(candidate, 400, 214)).toEqual([...REGION_MASK_OVERLAY_TONES.candidate.stroke]);
        const selected = buildRegionOwnershipOverlayPixels(owners, width, height, new Map([['city-region-8', 'selected']]));
        expect(pixel(selected, 380, 214)[3]).toBe(0);
        expect(pixel(selected, 381, 214)).toEqual([...REGION_MASK_OVERLAY_TONES.selected.fill]);
        expect(owners[214 * width + 380]).toBeNull();
    });
    it('选中态会沿真实轮廓两侧出线，避免视觉上只剩内缩边框', () => {
        const width = 7;
        const height = 7;
        const { hitmap, colorKey } = createRegionHitmap('city-region-19-liaoxi');
        const pixels = buildRegionMaskOverlayPixels(
            hitmap,
            width,
            height,
            new Map([['city-region-19-liaoxi', 'selected']]),
        );

        expect(countVisiblePixelsOutsideMask(pixels, colorKey, hitmap, width, height)).toBeGreaterThan(0);
        expect(readAlphaAt(pixels, width, 1, 3)).toBeGreaterThan(0);
        expect(readAlphaAt(pixels, width, 2, 3)).toBeGreaterThan(readAlphaAt(pixels, width, 3, 3));
    });

    it('选中态会跨过较宽的 mask 黑缝向外补描边，不再只贴在区域内部', () => {
        const width = 11;
        const height = 11;
        const { hitmap } = createRegionHitmap(
            'city-region-19-liaoxi',
            width,
            height,
            { left: 4, right: 6, top: 4, bottom: 6 },
        );
        const pixels = buildRegionMaskOverlayPixels(
            hitmap,
            width,
            height,
            new Map([['city-region-19-liaoxi', 'selected']]),
        );

        expect(pixels[((5 * width) + 0) * 4 + 3]).toBeGreaterThan(0);
    });

    it('选中态会把透明边界缝轻微补色，避免只看到一圈内缩描边', () => {
        const width = 11;
        const height = 11;
        const { hitmap } = createRegionHitmap(
            'city-region-19-liaoxi',
            width,
            height,
            { left: 4, right: 6, top: 4, bottom: 6 },
        );
        const pixels = buildRegionMaskOverlayPixels(
            hitmap,
            width,
            height,
            new Map([['city-region-19-liaoxi', 'selected']]),
        );

        const offset = ((5 * width) + 3) * 4;
        expect(pixels[offset]).toBeGreaterThan(0);
        expect(pixels[offset + 3]).toBeGreaterThan(0);
    });

    it('势力归属态沿区域边界留下比填色更深的描边', () => {
        const width = 7;
        const height = 7;
        const { hitmap } = createRegionHitmap('city-region-19-liaoxi');
        const pixels = buildRegionMaskOverlayPixels(
            hitmap,
            width,
            height,
            new Map([['city-region-19-liaoxi', 'ming']]),
        );

        expect(readAlphaAt(pixels, width, 2, 3)).toBeGreaterThan(readAlphaAt(pixels, width, 3, 3));
        expect(readAlphaAt(pixels, width, 2, 3)).toBeGreaterThan(180);
        expect(readAlphaAt(pixels, width, 3, 3)).toBeGreaterThan(0);
        expect(readAlphaAt(pixels, width, 3, 3)).toBeLessThan(40);
    });

    it('非选中态仍只留在区域内部，不把调度或悬浮提示扩到区域外', () => {
        const width = 7;
        const height = 7;
        const { hitmap, colorKey } = createRegionHitmap('city-region-19-liaoxi');
        const pixels = buildRegionMaskOverlayPixels(
            hitmap,
            width,
            height,
            new Map([['city-region-19-liaoxi', 'dispatch']]),
        );

        expect(countVisiblePixelsOutsideMask(pixels, colorKey, hitmap, width, height)).toBe(0);
    });
});
