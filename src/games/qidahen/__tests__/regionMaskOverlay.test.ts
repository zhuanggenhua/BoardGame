import { describe, expect, it } from 'vitest';
import { QIDAHEN_MASK_REGION_BY_ID, qidahenRegionColorKey } from '../ui/mapGraph';
import { buildRegionMaskOverlayPixels } from '../ui/regionMaskOverlay';

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

describe('Qidahen region mask overlay', () => {
    it('选中态会向区域外扩一圈描边与光圈，避免视觉上只剩内缩边框', () => {
        const width = 7;
        const height = 7;
        const { hitmap, colorKey } = createRegionHitmap('jinzhou');
        const pixels = buildRegionMaskOverlayPixels(
            hitmap,
            width,
            height,
            new Map([['jinzhou', 'selected']]),
        );

        expect(countVisiblePixelsOutsideMask(pixels, colorKey, hitmap, width, height)).toBeGreaterThan(0);
        expect(pixels[((3 * width) + 3) * 4 + 3]).toBeGreaterThan(0);
    });

    it('选中态会跨过较宽的 mask 黑缝向外补描边，不再只贴在区域内部', () => {
        const width = 11;
        const height = 11;
        const { hitmap } = createRegionHitmap(
            'jinzhou',
            width,
            height,
            { left: 4, right: 6, top: 4, bottom: 6 },
        );
        const pixels = buildRegionMaskOverlayPixels(
            hitmap,
            width,
            height,
            new Map([['jinzhou', 'selected']]),
        );

        expect(pixels[((5 * width) + 0) * 4 + 3]).toBeGreaterThan(0);
    });

    it('选中态会把透明边界缝轻微补色，避免只看到一圈内缩描边', () => {
        const width = 11;
        const height = 11;
        const { hitmap } = createRegionHitmap(
            'jinzhou',
            width,
            height,
            { left: 4, right: 6, top: 4, bottom: 6 },
        );
        const pixels = buildRegionMaskOverlayPixels(
            hitmap,
            width,
            height,
            new Map([['jinzhou', 'selected']]),
        );

        const offset = ((5 * width) + 3) * 4;
        expect(pixels[offset]).toBeGreaterThan(0);
        expect(pixels[offset + 3]).toBeGreaterThan(0);
    });

    it('非选中态仍只留在区域内部，不把调度或悬浮提示扩到区域外', () => {
        const width = 7;
        const height = 7;
        const { hitmap, colorKey } = createRegionHitmap('jinzhou');
        const pixels = buildRegionMaskOverlayPixels(
            hitmap,
            width,
            height,
            new Map([['jinzhou', 'dispatch']]),
        );

        expect(countVisiblePixelsOutsideMask(pixels, colorKey, hitmap, width, height)).toBe(0);
    });
});
