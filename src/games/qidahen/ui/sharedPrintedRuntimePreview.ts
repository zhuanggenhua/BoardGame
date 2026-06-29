import {
    getQidahenRuntimeRegionIdsForPrintedRegionId,
    QIDAHEN_REGION_ID_BY_MASK_COLOR,
    qidahenRegionColorKey,
} from './mapGraph';
import {
    buildQidahenRuntimeRegionIdByPixel,
    resolveQidahenSharedPrintedRegionAnchors,
    type QidahenRuntimeRegionAnchor,
} from './runtimeRegionOwnership';

export type QidahenSharedPrintedRuntimePreview = {
    printedRegionId: string;
    runtimeRegionIds: string[];
    width: number;
    height: number;
    paddedBounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    };
    printedPixelCount: number;
    anchors: QidahenRuntimeRegionAnchor[];
    pixelCountByRuntimeRegionId: Record<string, number>;
    pixels: Uint8ClampedArray;
};

const PREVIEW_PAD = 12;
const PREVIEW_REGION_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
    [77, 213, 89],
    [52, 152, 219],
    [214, 98, 170],
    [228, 169, 58],
];

const DRAW_REGION_ALPHA = 220;

const createPreviewColorByRuntimeRegionId = (runtimeRegionIds: readonly string[]) => {
    const palette = new Map<string, readonly [number, number, number]>();
    runtimeRegionIds.forEach((runtimeRegionId, index) => {
        palette.set(runtimeRegionId, PREVIEW_REGION_PALETTE[index % PREVIEW_REGION_PALETTE.length]);
    });
    return palette;
};

const buildPrintedRegionIdByPixel = (
    hitmap: Uint8ClampedArray,
    width: number,
    height: number,
): Array<string | null> => {
    const printedRegionIdByPixel: Array<string | null> = new Array(width * height).fill(null);
    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
        const offset = pixelIndex * 4;
        if (hitmap[offset + 3] === 0) {
            continue;
        }
        const colorKey = qidahenRegionColorKey(hitmap[offset], hitmap[offset + 1], hitmap[offset + 2]);
        printedRegionIdByPixel[pixelIndex] = QIDAHEN_REGION_ID_BY_MASK_COLOR[colorKey] ?? null;
    }
    return printedRegionIdByPixel;
};

const drawAnchorCross = (
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number,
) => {
    for (let delta = -5; delta <= 5; delta += 1) {
        for (const [drawX, drawY] of [[x + delta, y], [x, y + delta]] as const) {
            if (drawX < 0 || drawY < 0 || drawX >= width || drawY >= height) {
                continue;
            }
            const offset = ((drawY * width) + drawX) * 4;
            pixels[offset] = 255;
            pixels[offset + 1] = 245;
            pixels[offset + 2] = 96;
            pixels[offset + 3] = 255;
        }
    }
};

export const buildQidahenSharedPrintedRuntimePreviews = (
    hitmap: Uint8ClampedArray,
    width: number,
    height: number,
    printedRegionIds?: readonly string[],
): QidahenSharedPrintedRuntimePreview[] => {
    const printedRegionIdByPixel = buildPrintedRegionIdByPixel(hitmap, width, height);
    const runtimeRegionIdByPixel = buildQidahenRuntimeRegionIdByPixel(hitmap, width, height);
    const requestedPrintedRegionIds = printedRegionIds != null
        ? new Set(printedRegionIds)
        : null;
    const pixelIndexesByPrintedRegionId = new Map<string, number[]>();

    for (let pixelIndex = 0; pixelIndex < printedRegionIdByPixel.length; pixelIndex += 1) {
        const printedRegionId = printedRegionIdByPixel[pixelIndex];
        if (!printedRegionId) {
            continue;
        }
        if (requestedPrintedRegionIds && !requestedPrintedRegionIds.has(printedRegionId)) {
            continue;
        }
        const list = pixelIndexesByPrintedRegionId.get(printedRegionId);
        if (list) {
            list.push(pixelIndex);
        } else {
            pixelIndexesByPrintedRegionId.set(printedRegionId, [pixelIndex]);
        }
    }

    const previews: QidahenSharedPrintedRuntimePreview[] = [];
    for (const [printedRegionId, pixelIndexes] of pixelIndexesByPrintedRegionId.entries()) {
        const runtimeRegionIds = getQidahenRuntimeRegionIdsForPrintedRegionId(printedRegionId);
        if (runtimeRegionIds.length <= 1 || pixelIndexes.length <= 0) {
            continue;
        }

        const regionMask = new Uint8Array(width * height);
        let left = width;
        let top = height;
        let right = 0;
        let bottom = 0;
        for (const pixelIndex of pixelIndexes) {
            regionMask[pixelIndex] = 1;
            const x = pixelIndex % width;
            const y = Math.floor(pixelIndex / width);
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        }

        const anchors = resolveQidahenSharedPrintedRegionAnchors(
            printedRegionId,
            runtimeRegionIds,
            regionMask,
            width,
            height,
        );
        const pixelCountByRuntimeRegionId = Object.fromEntries(runtimeRegionIds.map((runtimeRegionId) => [runtimeRegionId, 0]));
        const paddedBounds = {
            left: Math.max(0, left - PREVIEW_PAD),
            top: Math.max(0, top - PREVIEW_PAD),
            right: Math.min(width - 1, right + PREVIEW_PAD),
            bottom: Math.min(height - 1, bottom + PREVIEW_PAD),
        };
        const cropWidth = paddedBounds.right - paddedBounds.left + 1;
        const cropHeight = paddedBounds.bottom - paddedBounds.top + 1;
        const pixels = new Uint8ClampedArray(cropWidth * cropHeight * 4);
        const previewColorByRuntimeRegionId = createPreviewColorByRuntimeRegionId(runtimeRegionIds);

        for (let y = paddedBounds.top; y <= paddedBounds.bottom; y += 1) {
            for (let x = paddedBounds.left; x <= paddedBounds.right; x += 1) {
                const sourcePixelIndex = (y * width) + x;
                if (printedRegionIdByPixel[sourcePixelIndex] !== printedRegionId) {
                    continue;
                }
                const runtimeRegionId = runtimeRegionIdByPixel[sourcePixelIndex];
                if (runtimeRegionId) {
                    pixelCountByRuntimeRegionId[runtimeRegionId] = (pixelCountByRuntimeRegionId[runtimeRegionId] ?? 0) + 1;
                }
                const color = runtimeRegionId
                    ? (previewColorByRuntimeRegionId.get(runtimeRegionId) ?? PREVIEW_REGION_PALETTE[0])
                    : PREVIEW_REGION_PALETTE[0];
                const offset = (((y - paddedBounds.top) * cropWidth) + (x - paddedBounds.left)) * 4;
                pixels[offset] = color[0];
                pixels[offset + 1] = color[1];
                pixels[offset + 2] = color[2];
                pixels[offset + 3] = DRAW_REGION_ALPHA;
            }
        }

        for (const anchor of anchors) {
            drawAnchorCross(
                pixels,
                cropWidth,
                cropHeight,
                anchor.point.x - paddedBounds.left,
                anchor.point.y - paddedBounds.top,
            );
        }

        previews.push({
            printedRegionId,
            runtimeRegionIds: [...runtimeRegionIds],
            width: cropWidth,
            height: cropHeight,
            paddedBounds,
            printedPixelCount: pixelIndexes.length,
            anchors,
            pixelCountByRuntimeRegionId,
            pixels,
        });
    }

    return previews.sort((leftPreview, rightPreview) => (
        leftPreview.printedRegionId.localeCompare(rightPreview.printedRegionId, 'zh-CN')
    ));
};
