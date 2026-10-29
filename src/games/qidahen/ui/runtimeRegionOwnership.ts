import {
    getQidahenRuntimeRegionAnchorTargetPoint,
    getQidahenRuntimeRegionIdsForPrintedRegionId,
    QIDAHEN_REGION_ID_BY_MASK_COLOR,
    qidahenRegionColorKey,
    QIDAHEN_RUNTIME_REGION_BY_ID,
} from './mapGraph';

export interface QidahenRuntimeRegionAnchor {
    runtimeRegionId: string;
    pixelIndex: number;
    point: {
        x: number;
        y: number;
    };
}

export interface QidahenRuntimeRegionPoint {
    x: number;
    y: number;
}

export interface QidahenRuntimeRegionBounds {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** 从正式命中像素派生地区范围，仅供标注定位；边界仍由同一像素归属绘制。 */
export const getQidahenRuntimeRegionBounds = (
    regionIdByPixel: readonly (string | null)[],
    width: number,
    height: number,
    regionIds: readonly string[],
): QidahenRuntimeRegionBounds | null => {
    if (regionIds.length === 1) {
        const region = QIDAHEN_RUNTIME_REGION_BY_ID.get(regionIds[0]);
        if (region?.mapRole === 'city' && region.markerBounds) return region.markerBounds;
    }
    const wanted = new Set(regionIds);
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    for (let index = 0; index < regionIdByPixel.length; index += 1) {
        const owner = regionIdByPixel[index];
        if (!owner || !wanted.has(owner)) continue;
        const x = index % width;
        const y = Math.floor(index / width);
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
    }
    return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
};

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

    return runtimeRegionIds.map((runtimeRegionId) => {
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

/** 正式土地与印刷mask一一对应；城市在原图字牌范围独立命中，不按锚点距离伪造地界。 */
export const buildQidahenRuntimeRegionIdByPixel = (
    hitmap: Uint8ClampedArray,
    width: number,
    height: number,
): Array<string | null> => {
    const regionIdByPixel: Array<string | null> = new Array(width * height).fill(null);
    const runtimeIdByPrintedId = new Map<string, string>();
    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
        const offset = pixelIndex * 4;
        if (hitmap[offset + 3] === 0) continue;
        const printedId = QIDAHEN_REGION_ID_BY_MASK_COLOR[qidahenRegionColorKey(hitmap[offset], hitmap[offset + 1], hitmap[offset + 2])];
        if (!printedId) continue;
        let runtimeId = runtimeIdByPrintedId.get(printedId);
        if (!runtimeId) {
            const ids = getQidahenRuntimeRegionIdsForPrintedRegionId(printedId);
            if (ids.length !== 1) throw new Error(`正式地图区域 ${printedId} 必须对应唯一土地或点位，实际为 ${ids.join(',')}`);
            runtimeId = ids[0];
            runtimeIdByPrintedId.set(printedId, runtimeId);
        }
        regionIdByPixel[pixelIndex] = runtimeId;
    }
    return regionIdByPixel;
};

export const resolveQidahenRuntimeRegionEntryPoint = (
    regionIdByPixel: readonly (string | null)[],
    width: number,
    height: number,
    targetRegionId: string,
    sourcePoint: QidahenRuntimeRegionPoint,
    targetPoint: QidahenRuntimeRegionPoint,
    insetDistance: number = 12,
): QidahenRuntimeRegionPoint | null => {
    if (width <= 0 || height <= 0 || regionIdByPixel.length < width * height) {
        return null;
    }
    const dx = targetPoint.x - sourcePoint.x;
    const dy = targetPoint.y - sourcePoint.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0) {
        return null;
    }
    const ownerAtRatio = (ratio: number): string | null => {
        const x = Math.max(0, Math.min(width - 1, Math.round(sourcePoint.x + dx * ratio)));
        const y = Math.max(0, Math.min(height - 1, Math.round(sourcePoint.y + dy * ratio)));
        return regionIdByPixel[(y * width) + x] ?? null;
    };
    const sampleCount = Math.max(1, Math.ceil(distance * 2));
    let previousRatio = 0;
    let entryRatio: number | null = ownerAtRatio(0) === targetRegionId ? 0 : null;
    for (let index = 1; entryRatio == null && index <= sampleCount; index += 1) {
        const ratio = index / sampleCount;
        if (ownerAtRatio(ratio) !== targetRegionId) {
            previousRatio = ratio;
            continue;
        }
        let low = previousRatio;
        let high = ratio;
        for (let iteration = 0; iteration < 10; iteration += 1) {
            const middle = (low + high) / 2;
            if (ownerAtRatio(middle) === targetRegionId) {
                high = middle;
            } else {
                low = middle;
            }
        }
        entryRatio = high;
    }
    if (entryRatio == null) {
        return null;
    }
    const insetRatio = Math.min(
        1 - entryRatio,
        Math.max(0, insetDistance) / distance,
    );
    const resolvedRatio = entryRatio + insetRatio;
    return {
        x: sourcePoint.x + dx * resolvedRatio,
        y: sourcePoint.y + dy * resolvedRatio,
    };
};
