import {
    getQidahenRuntimeRegionAnchorTargetPoint,
    getQidahenRuntimeRegionIdsForPrintedRegionId,
    QIDAHEN_REGION_ID_BY_MASK_COLOR,
    qidahenRegionColorKey,
} from './mapGraph';

export interface QidahenRuntimeRegionAnchor {
    runtimeRegionId: string;
    pixelIndex: number;
    point: {
        x: number;
        y: number;
    };
}

const EMPTY_OWNER = -1;

const projectPointIntoMask = (
    targetX: number,
    targetY: number,
    regionMask: Uint8Array,
    width: number,
    height: number,
    occupied: Set<number>,
): number | null => {
    const clampedX = Math.max(0, Math.min(width - 1, Math.round(targetX)));
    const clampedY = Math.max(0, Math.min(height - 1, Math.round(targetY)));
    const maxRadius = Math.max(width, height);
    for (let radius = 0; radius <= maxRadius; radius += 1) {
        for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
            const y = clampedY + offsetY;
            if (y < 0 || y >= height) {
                continue;
            }
            for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
                if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) {
                    continue;
                }
                const x = clampedX + offsetX;
                if (x < 0 || x >= width) {
                    continue;
                }
                const pixelIndex = (y * width) + x;
                if (regionMask[pixelIndex] !== 0 && !occupied.has(pixelIndex)) {
                    return pixelIndex;
                }
            }
        }
    }
    return null;
};

const findRegionMaskCentroid = (regionMask: Uint8Array, width: number): { x: number; y: number } | null => {
    let pixelCount = 0;
    let sumX = 0;
    let sumY = 0;
    for (let pixelIndex = 0; pixelIndex < regionMask.length; pixelIndex += 1) {
        if (regionMask[pixelIndex] === 0) {
            continue;
        }
        pixelCount += 1;
        sumX += pixelIndex % width;
        sumY += Math.floor(pixelIndex / width);
    }
    if (pixelCount <= 0) {
        return null;
    }
    return {
        x: sumX / pixelCount,
        y: sumY / pixelCount,
    };
};

export const resolveQidahenSharedPrintedRegionAnchors = (
    printedRegionId: string,
    runtimeRegionIds: readonly string[],
    regionMask: Uint8Array,
    width: number,
    height: number,
): QidahenRuntimeRegionAnchor[] => {
    const occupied = new Set<number>();
    const fallbackCenter = findRegionMaskCentroid(regionMask, width) ?? {
        x: width / 2,
        y: height / 2,
    };

    return runtimeRegionIds.map((runtimeRegionId, runtimeIndex) => {
        const target = getQidahenRuntimeRegionAnchorTargetPoint(runtimeRegionId) ?? fallbackCenter;
        const pixelIndex = projectPointIntoMask(target.x, target.y, regionMask, width, height, occupied);
        if (pixelIndex == null) {
            throw new Error(`无法为 ${printedRegionId} -> ${runtimeRegionId} 投影运行时锚点`);
        }
        occupied.add(pixelIndex);
        return {
            runtimeRegionId,
            pixelIndex,
            point: {
                x: pixelIndex % width,
                y: Math.floor(pixelIndex / width),
            },
        };
    }).sort((left, right) => left.runtimeRegionId.localeCompare(right.runtimeRegionId, 'zh-CN'));
};

const partitionSharedPrintedRegionPixels = (
    regionIdByPixel: Array<string | null>,
    printedRegionId: string,
    runtimeRegionIds: readonly string[],
    pixelIndexes: readonly number[],
    width: number,
    height: number,
) => {
    const regionMask = new Uint8Array(width * height);
    for (const pixelIndex of pixelIndexes) {
        regionMask[pixelIndex] = 1;
    }

    const anchors = resolveQidahenSharedPrintedRegionAnchors(
        printedRegionId,
        runtimeRegionIds,
        regionMask,
        width,
        height,
    );
    const anchorOrder = new Map(anchors.map((anchor, index) => [anchor.runtimeRegionId, index]));
    const ownerByPixel = new Int16Array(width * height);
    const distanceByPixel = new Int32Array(width * height);
    ownerByPixel.fill(EMPTY_OWNER);
    distanceByPixel.fill(-1);

    const queue = new Int32Array(pixelIndexes.length);
    let head = 0;
    let tail = 0;
    for (const anchor of anchors) {
        const ownerIndex = anchorOrder.get(anchor.runtimeRegionId) ?? 0;
        ownerByPixel[anchor.pixelIndex] = ownerIndex;
        distanceByPixel[anchor.pixelIndex] = 0;
        queue[tail] = anchor.pixelIndex;
        tail += 1;
    }

    const preferCandidateOwner = (pixelIndex: number, candidateOwnerIndex: number, currentOwnerIndex: number): boolean => {
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const candidateAnchor = anchors[candidateOwnerIndex];
        const currentAnchor = anchors[currentOwnerIndex];
        const candidateScore = ((x - candidateAnchor.point.x) ** 2) + ((y - candidateAnchor.point.y) ** 2);
        const currentScore = ((x - currentAnchor.point.x) ** 2) + ((y - currentAnchor.point.y) ** 2);
        if (candidateScore !== currentScore) {
            return candidateScore < currentScore;
        }
        return candidateAnchor.runtimeRegionId.localeCompare(currentAnchor.runtimeRegionId, 'zh-CN') < 0;
    };

    while (head < tail) {
        const pixelIndex = queue[head];
        head += 1;
        const ownerIndex = ownerByPixel[pixelIndex];
        const nextDistance = distanceByPixel[pixelIndex] + 1;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const neighbors = [
            x > 0 ? pixelIndex - 1 : -1,
            x < width - 1 ? pixelIndex + 1 : -1,
            y > 0 ? pixelIndex - width : -1,
            y < height - 1 ? pixelIndex + width : -1,
        ];
        for (const nextPixelIndex of neighbors) {
            if (nextPixelIndex < 0 || regionMask[nextPixelIndex] === 0) {
                continue;
            }
            if (distanceByPixel[nextPixelIndex] < 0) {
                distanceByPixel[nextPixelIndex] = nextDistance;
                ownerByPixel[nextPixelIndex] = ownerIndex;
                queue[tail] = nextPixelIndex;
                tail += 1;
                continue;
            }
            if (distanceByPixel[nextPixelIndex] !== nextDistance) {
                continue;
            }
            const currentOwnerIndex = ownerByPixel[nextPixelIndex];
            if (currentOwnerIndex === ownerIndex) {
                continue;
            }
            if (preferCandidateOwner(nextPixelIndex, ownerIndex, currentOwnerIndex)) {
                ownerByPixel[nextPixelIndex] = ownerIndex;
            }
        }
    }

    for (const pixelIndex of pixelIndexes) {
        const ownerIndex = ownerByPixel[pixelIndex];
        const runtimeRegionId = anchors[ownerIndex]?.runtimeRegionId ?? runtimeRegionIds[0] ?? printedRegionId;
        regionIdByPixel[pixelIndex] = runtimeRegionId;
    }
};

export const buildQidahenRuntimeRegionIdByPixel = (
    hitmap: Uint8ClampedArray,
    width: number,
    height: number,
): Array<string | null> => {
    const regionIdByPixel: Array<string | null> = new Array(width * height).fill(null);
    const pixelIndexesByPrintedRegionId = new Map<string, number[]>();

    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
        const offset = pixelIndex * 4;
        if (hitmap[offset + 3] === 0) {
            continue;
        }
        const colorKey = qidahenRegionColorKey(hitmap[offset], hitmap[offset + 1], hitmap[offset + 2]);
        const printedRegionId = QIDAHEN_REGION_ID_BY_MASK_COLOR[colorKey] ?? null;
        if (!printedRegionId) {
            continue;
        }
        const list = pixelIndexesByPrintedRegionId.get(printedRegionId);
        if (list) {
            list.push(pixelIndex);
        } else {
            pixelIndexesByPrintedRegionId.set(printedRegionId, [pixelIndex]);
        }
    }

    for (const [printedRegionId, pixelIndexes] of pixelIndexesByPrintedRegionId.entries()) {
        const runtimeRegionIds = getQidahenRuntimeRegionIdsForPrintedRegionId(printedRegionId);
        if (runtimeRegionIds.length <= 1) {
            const resolvedRuntimeRegionId = runtimeRegionIds[0] ?? printedRegionId;
            for (const pixelIndex of pixelIndexes) {
                regionIdByPixel[pixelIndex] = resolvedRuntimeRegionId;
            }
            continue;
        }
        partitionSharedPrintedRegionPixels(
            regionIdByPixel,
            printedRegionId,
            runtimeRegionIds,
            pixelIndexes,
            width,
            height,
        );
    }

    return regionIdByPixel;
};
