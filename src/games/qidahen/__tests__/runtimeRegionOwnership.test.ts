import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
    buildQidahenRuntimeRegionIdByPixel,
    getQidahenRuntimeRegionBounds,
    resolveQidahenRuntimeRegionEntryPoint,
    resolveQidahenSharedPrintedRegionAnchors,
} from '../ui/runtimeRegionOwnership';
import { getQidahenRuntimeRegionIdsForPrintedRegionId, QIDAHEN_REGION_ID_BY_MASK_COLOR, qidahenRegionColorKey } from '../ui/mapGraph';
import { buildRegionOwnershipOverlayPixels } from '../ui/regionMaskOverlay';
import printedMapOcclusions from '../data/printed-map-occlusions.json';
import { QIDAHEN_PRINTED_REGION_GRAPH_NODE_BY_ID, QIDAHEN_REGION_GRAPH_NODE_BY_ID } from '../ui/mapGraph';

const REGION_MASK_PATH = resolve(process.cwd(), 'src/games/qidahen/data/region-mask.png');

describe('qidahen runtime region ownership', () => {
    it('巴林印刷说明不能命中地区，旁边可见土地及邻区保持原归属，图谱面积与质心同源', async () => {
        const { data, info } = await sharp(REGION_MASK_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const ownership = buildQidahenRuntimeRegionIdByPixel(new Uint8ClampedArray(data), info.width, info.height);
        expect([info.width, info.height]).toEqual([printedMapOcclusions.width, printedMapOcclusions.height]);
        for (const rect of printedMapOcclusions.rectangles) {
            let unexpected = 0;
            for (let y = rect.top; y <= rect.bottom; y++) for (let x = rect.left; x <= rect.right; x++) {
                if (ownership[y * info.width + x] !== null) unexpected++;
            }
            expect(unexpected, rect.id).toBe(0);
        }
        for (const [x, y] of [[92, 130], [101, 130], [102, 215], [100, 250], [95, 320], [200, 50], [225, 375], [478, 201]]) {
            expect(ownership[y * info.width + x], `保留裸露地面 (${x},${y})`).toBe('city-region-8');
        }
        for (const [x, y, id] of [[499, 63, 'city-region-2'], [636, 193, 'city-region-6'], [579, 353, 'city-region-14'], [409, 356, 'city-region-16']] as const) {
            expect(ownership[y * info.width + x], `保留相邻地区 (${x},${y})`).toBe(id);
        }
        let count = 0, sumX = 0, sumY = 0;
        ownership.forEach((id, index) => {
            if (id !== 'city-region-8') return;
            count++; sumX += index % info.width; sumY += Math.floor(index / info.width);
        });
        const expected = { pixelCount: count, center: { x: Math.round(sumX / count), y: Math.round(sumY / count) } };
        expect(QIDAHEN_PRINTED_REGION_GRAPH_NODE_BY_ID.get('city-region-8')).toMatchObject(expected);
        expect(QIDAHEN_REGION_GRAPH_NODE_BY_ID.get('city-region-8')).toMatchObject(expected);
    });
    it('地区提示沿真实命中像素保留凹口，不把包围盒或相邻地区涂成目标', () => {
        const ownership = [
            'a', 'a', null, null,
            'a', 'b', null, null,
            'a', 'a', null, null,
        ];
        expect(getQidahenRuntimeRegionBounds(ownership, 4, 3, ['a'])).toEqual({ left: 0, top: 0, width: 2, height: 3 });
        expect(getQidahenRuntimeRegionBounds(ownership, 4, 3, ['missing'])).toBeNull();
        const pixels = buildRegionOwnershipOverlayPixels(ownership, 4, 3, new Map([['a', 'tutorialPrimary']]));
        ownership.forEach((owner, index) => {
            expect(pixels[index * 4 + 3] > 0).toBe(owner === 'a');
        });
    });

    it('编辑器锚点投影保持在当前各自土地内', async () => {
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

    it('独立印刷土地的运行时像素归属保持各自身份', async () => {
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

    it('地图路线会停在从来源方向进入目标区域的边界内侧，而不是指向区域中心', () => {
        const width = 12;
        const height = 8;
        const ownership: Array<string | null> = new Array(width * height).fill('source');
        for (let y = 0; y < height; y += 1) {
            for (let x = 7; x < width; x += 1) {
                ownership[(y * width) + x] = 'target';
            }
        }

        const point = resolveQidahenRuntimeRegionEntryPoint(
            ownership,
            width,
            height,
            'target',
            { x: 1, y: 4 },
            { x: 10, y: 4 },
            1,
        );

        expect(point).not.toBeNull();
        expect(point!.x).toBeGreaterThanOrEqual(7);
        expect(point!.x).toBeLessThan(10);
        expect(point!.y).toBeCloseTo(4);
    });
});
