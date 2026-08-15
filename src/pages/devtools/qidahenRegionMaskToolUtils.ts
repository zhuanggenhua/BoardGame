export type RgbColor = readonly [number, number, number];

type BinaryMaskBuffer = Uint8Array<ArrayBufferLike>;

export type BoundaryRule = {
    id: string;
    rgb: RgbColor;
    tolerance: number;
    enabled?: boolean;
};

type LineComponentFilterOptions = {
    minPixels: number;
    minSpan: number;
    maxAverageThickness: number;
};

export type GradientBarrierOptions = {
    blurRadius: number;
    strongGradientThreshold: number;
    moderateGradientThreshold: number;
    darkLuminanceThreshold: number;
    lowChromaThreshold: number;
    lineFilter?: LineComponentFilterOptions | null;
};

export type PixelBounds = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

export type RegionCenter = {
    regionIndex: number;
    x: number;
    y: number;
    pixelCount: number;
};

export type RegionComponentSummary = {
    componentCount: number;
    largestPixelCount: number;
    totalPixelCount: number;
};

export type ClosedBoundaryInteriorComponent = {
    mask: Uint8Array;
    pixelCount: number;
    bounds: BinaryMaskBounds;
    center: {
        x: number;
        y: number;
    };
};

export type BoundaryPartitionComponent = {
    mask: Uint8Array;
    pixelCount: number;
    bounds: BinaryMaskBounds;
    center: {
        x: number;
        y: number;
    };
    seedIndexes: number[];
};

export type GeneratedComponentRegionMatchInput = {
    componentIndex: number;
    pixelCount: number;
    anchoredRegionIndexes?: readonly number[];
    overlapPixelsByRegionIndex?: ReadonlyMap<number, number> | ReadonlyArray<readonly [number, number]>;
};

export type GeneratedComponentRegionMatch = {
    componentIndex: number;
    regionIndex: number;
    reason: 'anchor' | 'overlap';
    overlapPixels: number;
};

export type OpenBoundaryComponentHint = {
    pixelCount: number;
    bounds: BinaryMaskBounds;
    center: {
        x: number;
        y: number;
    };
    endpoints: readonly [
        { x: number; y: number },
        { x: number; y: number },
    ];
};

export type OpenBoundaryComponentAnalysis = {
    openComponentCount: number;
    largestOpenPixelCount: number;
    hints: OpenBoundaryComponentHint[];
};

export type OpenBoundaryHintTarget = {
    id: string;
    name: string;
    seed: {
        x: number;
        y: number;
    } | null;
};

export type RankedOpenBoundaryComponentHint = OpenBoundaryComponentHint & {
    nearestTarget: OpenBoundaryHintTarget | null;
    distanceToNearestTarget: number | null;
};

export type BinaryMaskBounds = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

export type BoundaryChainAnalysis = {
    mask: Uint8Array;
    boundaryBandPixels: number;
    bridgedBandPixels: number;
    componentCount: number;
    keptComponentCount: number;
    keptPixelCount: number;
    prunedEmptyCount: number;
    rejectedTooSmallCount: number;
    rejectedTooShortCount: number;
    rejectedTooThickCount: number;
    rejectedWeakSupportCount: number;
    largestRejectedPixelCount: number;
    largestRejectedSpan: number;
    largestRejectedAverageThickness: number;
    largestRejectedSupportContactRatio: number;
};

export type BoundarySnapToSupportResult = {
    mask: Uint8Array;
    sourcePixelCount: number;
    matchedSourcePixelCount: number;
    matchedSupportPixelCount: number;
    keptOriginalPixelCount: number;
    supportComponentCount: number;
    keptSupportComponentCount: number;
};

export type ClosedBoundaryPixelFilterResult = {
    mask: Uint8Array;
    closedFaceCount: number;
    anchoredClosedFaceCount: number;
    keptPixelCount: number;
    discardedPixelCount: number;
    largestClosedFacePixelCount: number;
};

export type BoundaryPartitionPixelFilterResult = {
    mask: Uint8Array;
    partitionCount: number;
    anchoredPartitionCount: number;
    keptPixelCount: number;
    discardedPixelCount: number;
    largestPartitionPixelCount: number;
};

type SeedColorProfile = {
    mean: RgbColor;
    meanLuminance: number;
    meanChroma: number;
    stdChannelMax: number;
    stdLuminance: number;
    stdChroma: number;
};

export const EMPTY_REGION = -1;

export const hexToRgb = (value: string): RgbColor => {
    const hex = value.trim().replace('#', '');
    const normalized = hex.length === 3
        ? hex.split('').map((char) => char + char).join('')
        : hex;

    if (normalized.length !== 6) {
        throw new Error(`Invalid hex color: ${value}`);
    }

    return [
        Number.parseInt(normalized.slice(0, 2), 16),
        Number.parseInt(normalized.slice(2, 4), 16),
        Number.parseInt(normalized.slice(4, 6), 16),
    ];
};

export const createRegionAssignments = (width: number, height: number): Int16Array => {
    const assignments = new Int16Array(width * height);
    assignments.fill(EMPTY_REGION);
    return assignments;
};

export const countMaskPixels = (mask: Uint8Array): number => {
    let count = 0;
    for (let index = 0; index < mask.length; index += 1) {
        if (mask[index] !== 0) {
            count += 1;
        }
    }
    return count;
};

const normalizeOverlapEntries = (
    overlapPixelsByRegionIndex: GeneratedComponentRegionMatchInput['overlapPixelsByRegionIndex'],
    regionCount: number,
): Array<readonly [number, number]> => {
    if (!overlapPixelsByRegionIndex) {
        return [];
    }
    const rawEntries = overlapPixelsByRegionIndex instanceof Map
        ? Array.from(overlapPixelsByRegionIndex.entries())
        : [...overlapPixelsByRegionIndex];
    return rawEntries
        .filter(([regionIndex, overlapPixels]) => (
            Number.isInteger(regionIndex)
            && regionIndex >= 0
            && regionIndex < regionCount
            && Number.isFinite(overlapPixels)
            && overlapPixels > 0
        ))
        .map(([regionIndex, overlapPixels]) => [regionIndex, overlapPixels] as const);
};

export const matchGeneratedComponentsToRegionIndexes = ({
    components,
    regionCount,
}: {
    components: readonly GeneratedComponentRegionMatchInput[];
    regionCount: number;
}): Map<number, GeneratedComponentRegionMatch> => {
    const matches = new Map<number, GeneratedComponentRegionMatch>();
    if (regionCount <= 0 || components.length === 0) {
        return matches;
    }

    const usedRegionIndexes = new Set<number>();
    const uniqueAnchoredComponentsByRegionIndex = new Map<number, number[]>();

    for (const component of components) {
        const anchoredRegionIndexes = [...new Set(
            (component.anchoredRegionIndexes ?? []).filter((regionIndex) => (
                Number.isInteger(regionIndex)
                && regionIndex >= 0
                && regionIndex < regionCount
            )),
        )];
        for (const regionIndex of anchoredRegionIndexes) {
            const list = uniqueAnchoredComponentsByRegionIndex.get(regionIndex);
            if (list) {
                list.push(component.componentIndex);
            } else {
                uniqueAnchoredComponentsByRegionIndex.set(regionIndex, [component.componentIndex]);
            }
        }
    }

    const anchorCandidates: Array<GeneratedComponentRegionMatch & { pixelCount: number }> = [];
    for (const component of components) {
        const overlapEntries = normalizeOverlapEntries(component.overlapPixelsByRegionIndex, regionCount);
        const overlapMap = new Map(overlapEntries);
        const uniquelyAnchoredRegionIndexes = [...new Set(
            (component.anchoredRegionIndexes ?? []).filter((regionIndex) => {
                if (!Number.isInteger(regionIndex) || regionIndex < 0 || regionIndex >= regionCount) {
                    return false;
                }
                const matchedComponents = uniqueAnchoredComponentsByRegionIndex.get(regionIndex);
                return matchedComponents?.length === 1 && matchedComponents[0] === component.componentIndex;
            }),
        )];
        if (uniquelyAnchoredRegionIndexes.length !== 1) {
            continue;
        }
        const regionIndex = uniquelyAnchoredRegionIndexes[0];
        anchorCandidates.push({
            componentIndex: component.componentIndex,
            regionIndex,
            reason: 'anchor',
            overlapPixels: overlapMap.get(regionIndex) ?? 0,
            pixelCount: component.pixelCount,
        });
    }

    anchorCandidates.sort((left, right) => (
        (right.overlapPixels - left.overlapPixels)
        || (right.pixelCount - left.pixelCount)
        || (left.componentIndex - right.componentIndex)
    ));

    for (const candidate of anchorCandidates) {
        if (matches.has(candidate.componentIndex) || usedRegionIndexes.has(candidate.regionIndex)) {
            continue;
        }
        matches.set(candidate.componentIndex, {
            componentIndex: candidate.componentIndex,
            regionIndex: candidate.regionIndex,
            reason: 'anchor',
            overlapPixels: candidate.overlapPixels,
        });
        usedRegionIndexes.add(candidate.regionIndex);
    }

    const overlapCandidates: Array<GeneratedComponentRegionMatch & { pixelCount: number }> = [];
    for (const component of components) {
        if (matches.has(component.componentIndex)) {
            continue;
        }
        for (const [regionIndex, overlapPixels] of normalizeOverlapEntries(component.overlapPixelsByRegionIndex, regionCount)) {
            overlapCandidates.push({
                componentIndex: component.componentIndex,
                regionIndex,
                reason: 'overlap',
                overlapPixels,
                pixelCount: component.pixelCount,
            });
        }
    }

    overlapCandidates.sort((left, right) => (
        (right.overlapPixels - left.overlapPixels)
        || (right.pixelCount - left.pixelCount)
        || (left.componentIndex - right.componentIndex)
        || (left.regionIndex - right.regionIndex)
    ));

    for (const candidate of overlapCandidates) {
        if (matches.has(candidate.componentIndex) || usedRegionIndexes.has(candidate.regionIndex)) {
            continue;
        }
        matches.set(candidate.componentIndex, {
            componentIndex: candidate.componentIndex,
            regionIndex: candidate.regionIndex,
            reason: 'overlap',
            overlapPixels: candidate.overlapPixels,
        });
        usedRegionIndexes.add(candidate.regionIndex);
    }

    return matches;
};

export const scoreMaskBoundaryAlignment = ({
    mask,
    barrierMask,
    width,
    height,
    supportRadius = 2,
}: {
    mask: Uint8Array | null | undefined;
    barrierMask: Uint8Array | null | undefined;
    width: number;
    height: number;
    supportRadius?: number;
}): { boundaryPixelCount: number; supportedBoundaryPixelCount: number; supportRatio: number } => {
    if (!mask || !barrierMask || width <= 2 || height <= 2) {
        return { boundaryPixelCount: 0, supportedBoundaryPixelCount: 0, supportRatio: 0 };
    }

    let boundaryPixelCount = 0;
    let supportedBoundaryPixelCount = 0;

    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            const index = (y * width) + x;
            if (mask[index] === 0) {
                continue;
            }
            const touchesOutside = (
                mask[index - 1] === 0
                || mask[index + 1] === 0
                || mask[index - width] === 0
                || mask[index + width] === 0
            );
            if (!touchesOutside) {
                continue;
            }
            boundaryPixelCount += 1;

            let nearBarrier = false;
            for (let offsetY = -supportRadius; offsetY <= supportRadius && !nearBarrier; offsetY += 1) {
                const nextY = y + offsetY;
                if (nextY < 0 || nextY >= height) {
                    continue;
                }
                for (let offsetX = -supportRadius; offsetX <= supportRadius; offsetX += 1) {
                    const nextX = x + offsetX;
                    if (nextX < 0 || nextX >= width) {
                        continue;
                    }
                    if (barrierMask[(nextY * width) + nextX] !== 0) {
                        nearBarrier = true;
                        break;
                    }
                }
            }

            if (nearBarrier) {
                supportedBoundaryPixelCount += 1;
            }
        }
    }

    return {
        boundaryPixelCount,
        supportedBoundaryPixelCount,
        supportRatio: boundaryPixelCount > 0 ? supportedBoundaryPixelCount / boundaryPixelCount : 0,
    };
};

export const maskContainsPoint = ({
    mask,
    width,
    x,
    y,
}: {
    mask: Uint8Array | null | undefined;
    width: number;
    x: number;
    y: number;
}): boolean => {
    if (!mask || width <= 0 || x < 0 || y < 0) {
        return false;
    }
    const height = Math.floor(mask.length / width);
    if (x >= width || y >= height) {
        return false;
    }
    return mask[(y * width) + x] !== 0;
};

export const getBinaryMaskBounds = (mask: Uint8Array, width: number): BinaryMaskBounds | null => {
    if (width <= 0 || mask.length === 0) {
        return null;
    }
    const height = Math.floor(mask.length / width);
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;

    for (let index = 0; index < mask.length; index += 1) {
        if (mask[index] === 0) {
            continue;
        }
        const x = index % width;
        const y = (index / width) | 0;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
    }

    if (right < left || bottom < top) {
        return null;
    }

    return { left, top, right, bottom };
};

export const isMagicSelectionUsable = (
    pixelCount: number,
    totalPixels: number,
    maxRatio: number,
): boolean => (
    pixelCount > 0
    && totalPixels > 0
    && pixelCount <= totalPixels * maxRatio
);

export const matchesRgbWithTolerance = (
    red: number,
    green: number,
    blue: number,
    target: RgbColor,
    tolerance: number,
): boolean => (
    Math.abs(red - target[0]) <= tolerance
    && Math.abs(green - target[1]) <= tolerance
    && Math.abs(blue - target[2]) <= tolerance
);

const dilateMask = (mask: Uint8Array, width: number, height: number): Uint8Array => {
    const next = mask.slice();

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            if (mask[index] === 0) {
                continue;
            }

            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                const nextY = y + offsetY;
                if (nextY < 0 || nextY >= height) {
                    continue;
                }
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    const nextX = x + offsetX;
                    if (nextX < 0 || nextX >= width) {
                        continue;
                    }
                    next[nextY * width + nextX] = 1;
                }
            }
        }
    }

    return next;
};

const erodeMask = (mask: Uint8Array, width: number, height: number): Uint8Array => {
    const next = new Uint8Array(mask.length);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            if (mask[index] === 0) {
                continue;
            }

            let keep = true;
            for (let offsetY = -1; offsetY <= 1 && keep; offsetY += 1) {
                const nextY = y + offsetY;
                if (nextY < 0 || nextY >= height) {
                    keep = false;
                    break;
                }
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    const nextX = x + offsetX;
                    if (nextX < 0 || nextX >= width || mask[nextY * width + nextX] === 0) {
                        keep = false;
                        break;
                    }
                }
            }

            if (keep) {
                next[index] = 1;
            }
        }
    }

    return next;
};

export const expandBinaryMask = ({
    mask,
    width,
    height,
    iterations,
}: {
    mask: Uint8Array;
    width: number;
    height: number;
    iterations: number;
}): Uint8Array => {
    let expanded: BinaryMaskBuffer = mask.slice();
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        expanded = dilateMask(expanded, width, height);
    }
    return expanded;
};

export const trimBinaryMaskByBarrier = ({
    mask,
    barrierMask,
}: {
    mask: Uint8Array;
    barrierMask: Uint8Array;
}): Uint8Array => {
    const trimmed = mask.slice();
    const length = Math.min(trimmed.length, barrierMask.length);
    for (let index = 0; index < length; index += 1) {
        if (barrierMask[index] !== 0) {
            trimmed[index] = 0;
        }
    }
    return trimmed;
};

export const growMaskTowardBoundary = ({
    mask,
    barrierMask,
    width,
    height,
    iterations,
}: {
    mask: Uint8Array;
    barrierMask: Uint8Array;
    width: number;
    height: number;
    iterations: number;
}): Uint8Array => trimBinaryMaskByBarrier({
    mask: expandBinaryMask({
        mask,
        width,
        height,
        iterations,
    }),
    barrierMask,
});

export const closeBinaryMask = ({
    mask,
    width,
    height,
    iterations,
}: {
    mask: Uint8Array;
    width: number;
    height: number;
    iterations: number;
}): Uint8Array => {
    let closed: BinaryMaskBuffer = mask.slice();
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        closed = dilateMask(closed, width, height);
    }
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        closed = erodeMask(closed, width, height);
    }
    return closed;
};

const bridgeShortBoundaryChainGaps = ({
    mask,
    width,
    height,
    clipMask,
    eligibleMask,
    maxGapPixels,
}: {
    mask: Uint8Array;
    width: number;
    height: number;
    clipMask: Uint8Array;
    eligibleMask: Uint8Array;
    maxGapPixels: number;
}): Uint8Array => {
    const next = mask.slice();
    const directions: Array<readonly [number, number]> = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
    ];

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            if (mask[index] === 0) {
                continue;
            }

            for (const [deltaX, deltaY] of directions) {
                for (let gapPixels = 1; gapPixels <= maxGapPixels; gapPixels += 1) {
                    const endX = x + (deltaX * (gapPixels + 1));
                    const endY = y + (deltaY * (gapPixels + 1));
                    if (endX < 0 || endX >= width || endY < 0 || endY >= height) {
                        break;
                    }
                    const endIndex = endY * width + endX;
                    if (mask[endIndex] === 0) {
                        continue;
                    }

                    let canBridge = true;
                    for (let step = 1; step <= gapPixels; step += 1) {
                        const bridgeX = x + (deltaX * step);
                        const bridgeY = y + (deltaY * step);
                        const bridgeIndex = bridgeY * width + bridgeX;
                        if (clipMask[bridgeIndex] === 0 || eligibleMask[bridgeIndex] === 0) {
                            canBridge = false;
                            break;
                        }
                    }

                    if (!canBridge) {
                        continue;
                    }

                    for (let step = 1; step <= gapPixels; step += 1) {
                        const bridgeX = x + (deltaX * step);
                        const bridgeY = y + (deltaY * step);
                        next[bridgeY * width + bridgeX] = 1;
                    }
                }
            }
        }
    }

    return next;
};

const bridgeBoundaryChainGaps = ({
    mask,
    width,
    height,
    clipMask,
    eligibleMask,
    iterations,
}: {
    mask: Uint8Array;
    width: number;
    height: number;
    clipMask: Uint8Array;
    eligibleMask: Uint8Array;
    iterations: number;
}): Uint8Array => {
    let bridged: BinaryMaskBuffer = mask.slice();
    const maxGapPixels = Math.min(2, Math.max(1, iterations + 1));
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const next = bridgeShortBoundaryChainGaps({
            mask: bridged,
            width,
            height,
            clipMask,
            eligibleMask,
            maxGapPixels,
        });
        if (countMaskPixels(next) === countMaskPixels(bridged)) {
            return bridged;
        }
        bridged = next;
    }
    return bridged;
};

export const intersectBinaryMasks = (primary: Uint8Array, clip: Uint8Array): Uint8Array => {
    const next = new Uint8Array(primary.length);
    const length = Math.min(primary.length, clip.length);
    for (let index = 0; index < length; index += 1) {
        if (primary[index] !== 0 && clip[index] !== 0) {
            next[index] = 1;
        }
    }
    return next;
};

export const buildMaskBoundaryRing = ({
    mask,
    width,
    height,
    expandIterations = 0,
}: {
    mask: Uint8Array;
    width: number;
    height: number;
    expandIterations?: number;
}): Uint8Array => {
    const ring = new Uint8Array(mask.length);
    if (width <= 0 || height <= 0 || mask.length !== width * height) {
        return ring;
    }

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = (y * width) + x;
            if (mask[index] === 0) {
                continue;
            }
            const touchesOutside = (
                x === 0
                || x === width - 1
                || y === 0
                || y === height - 1
                || mask[index - 1] === 0
                || mask[index + 1] === 0
                || mask[index - width] === 0
                || mask[index + width] === 0
            );
            if (touchesOutside) {
                ring[index] = 1;
            }
        }
    }

    return expandIterations > 0
        ? expandBinaryMask({
            mask: ring,
            width,
            height,
            iterations: expandIterations,
        })
        : ring;
};

export const keepMaskComponentsTouchingSupportMask = ({
    mask,
    width,
    clipMask,
    supportMask,
}: {
    mask: Uint8Array;
    width: number;
    clipMask: Uint8Array;
    supportMask: Uint8Array;
}): Uint8Array => {
    const kept = new Uint8Array(mask.length);
    if (width <= 0) {
        return kept;
    }

    const height = Math.floor(mask.length / width);
    const visited = new Uint8Array(mask.length);
    const queue = new Uint32Array(mask.length);

    for (let startIndex = 0; startIndex < mask.length; startIndex += 1) {
        if (mask[startIndex] === 0 || clipMask[startIndex] === 0 || visited[startIndex] !== 0) {
            continue;
        }

        let head = 0;
        let tail = 0;
        let touchesSupport = false;
        visited[startIndex] = 1;
        queue[tail] = startIndex;
        tail += 1;

        while (head < tail) {
            const index = queue[head];
            head += 1;
            if (supportMask[index] !== 0) {
                touchesSupport = true;
            }

            const x = index % width;
            const y = (index / width) | 0;
            const candidates = [
                x > 0 ? index - 1 : -1,
                x < width - 1 ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y < height - 1 ? index + width : -1,
            ];

            for (const nextIndex of candidates) {
                if (
                    nextIndex < 0
                    || mask[nextIndex] === 0
                    || clipMask[nextIndex] === 0
                    || visited[nextIndex] !== 0
                ) {
                    continue;
                }
                visited[nextIndex] = 1;
                queue[tail] = nextIndex;
                tail += 1;
            }
        }

        if (!touchesSupport) {
            continue;
        }
        for (let index = 0; index < tail; index += 1) {
            kept[queue[index]] = 1;
        }
    }

    return kept;
};

export const keepMaskComponentsTouchingSupportMaskWithThreshold = ({
    mask,
    width,
    clipMask,
    supportMask,
    minSupportPixels,
    minSupportRatio = 0,
}: {
    mask: Uint8Array;
    width: number;
    clipMask: Uint8Array;
    supportMask: Uint8Array;
    minSupportPixels: number;
    minSupportRatio?: number;
}): Uint8Array => {
    const kept = new Uint8Array(mask.length);
    if (width <= 0) {
        return kept;
    }

    const height = Math.floor(mask.length / width);
    const visited = new Uint8Array(mask.length);
    const queue = new Uint32Array(mask.length);

    for (let startIndex = 0; startIndex < mask.length; startIndex += 1) {
        if (mask[startIndex] === 0 || clipMask[startIndex] === 0 || visited[startIndex] !== 0) {
            continue;
        }

        let head = 0;
        let tail = 0;
        let supportPixelCount = 0;
        visited[startIndex] = 1;
        queue[tail] = startIndex;
        tail += 1;

        while (head < tail) {
            const index = queue[head];
            head += 1;
            if (supportMask[index] !== 0) {
                supportPixelCount += 1;
            }

            const x = index % width;
            const y = (index / width) | 0;
            const candidates = [
                x > 0 ? index - 1 : -1,
                x < width - 1 ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y < height - 1 ? index + width : -1,
            ];

            for (const nextIndex of candidates) {
                if (
                    nextIndex < 0
                    || mask[nextIndex] === 0
                    || clipMask[nextIndex] === 0
                    || visited[nextIndex] !== 0
                ) {
                    continue;
                }
                visited[nextIndex] = 1;
                queue[tail] = nextIndex;
                tail += 1;
            }
        }

        const supportRatio = tail > 0 ? supportPixelCount / tail : 0;
        if (supportPixelCount < minSupportPixels && supportRatio < minSupportRatio) {
            continue;
        }

        for (let index = 0; index < tail; index += 1) {
            kept[queue[index]] = 1;
        }
    }

    return kept;
};

type BoundaryChainSupportOptions = {
    mask: Uint8Array;
    width: number;
    clipMask: Uint8Array;
    supportMask: Uint8Array;
    maxDistance: number;
    minPixels?: number;
    minSpan?: number;
    maxAverageThickness?: number;
    gapClosingIterations?: number;
};

export const analyzeMaskBoundaryChainsNearSupport = ({
    mask,
    width,
    clipMask,
    supportMask,
    maxDistance,
    minPixels = 1,
    minSpan = 1,
    maxAverageThickness = Number.POSITIVE_INFINITY,
    gapClosingIterations = 0,
}: BoundaryChainSupportOptions): BoundaryChainAnalysis => {
    const kept = new Uint8Array(mask.length);
    const createAnalysis = ({
        boundaryBandPixels = 0,
        bridgedBandPixels = 0,
        componentCount = 0,
        keptComponentCount = 0,
        keptPixelCount = 0,
        prunedEmptyCount = 0,
        rejectedTooSmallCount = 0,
        rejectedTooShortCount = 0,
        rejectedTooThickCount = 0,
        rejectedWeakSupportCount = 0,
        largestRejectedPixelCount = 0,
        largestRejectedSpan = 0,
        largestRejectedAverageThickness = 0,
        largestRejectedSupportContactRatio = 0,
    }: Partial<Omit<BoundaryChainAnalysis, 'mask'>> = {}): BoundaryChainAnalysis => ({
        mask: kept,
        boundaryBandPixels,
        bridgedBandPixels,
        componentCount,
        keptComponentCount,
        keptPixelCount,
        prunedEmptyCount,
        rejectedTooSmallCount,
        rejectedTooShortCount,
        rejectedTooThickCount,
        rejectedWeakSupportCount,
        largestRejectedPixelCount,
        largestRejectedSpan,
        largestRejectedAverageThickness,
        largestRejectedSupportContactRatio,
    });
    if (width <= 0 || maxDistance < 0) {
        return createAnalysis();
    }

    const height = Math.floor(mask.length / width);
    const distances = new Int16Array(mask.length);
    distances.fill(-1);
    const queue = new Uint32Array(mask.length);
    let head = 0;
    let tail = 0;
    for (let index = 0; index < mask.length; index += 1) {
        if (supportMask[index] === 0 || clipMask[index] === 0) {
            continue;
        }
        distances[index] = 0;
        queue[tail] = index;
        tail += 1;
    }

    while (head < tail) {
        const index = queue[head];
        head += 1;
        const distance = distances[index];
        if (distance >= maxDistance) {
            continue;
        }

        const x = index % width;
        const y = (index / width) | 0;
        const candidates = [
            x > 0 ? index - 1 : -1,
            x < width - 1 ? index + 1 : -1,
            y > 0 ? index - width : -1,
            y < height - 1 ? index + width : -1,
        ];

        for (const nextIndex of candidates) {
            if (
                nextIndex < 0
                || clipMask[nextIndex] === 0
                || distances[nextIndex] >= 0
            ) {
                continue;
            }
            distances[nextIndex] = distance + 1;
            queue[tail] = nextIndex;
            tail += 1;
        }
    }

    const boundaryBandMask = new Uint8Array(mask.length);
    for (let index = 0; index < mask.length; index += 1) {
        if (mask[index] !== 0 && distances[index] >= 0 && distances[index] <= maxDistance) {
            boundaryBandMask[index] = 1;
        }
    }
    const boundaryBandPixels = countMaskPixels(boundaryBandMask);
    const gapEligibleMask = new Uint8Array(mask.length);
    for (let index = 0; index < gapEligibleMask.length; index += 1) {
        if (clipMask[index] !== 0 && distances[index] >= 0 && distances[index] <= maxDistance) {
            gapEligibleMask[index] = 1;
        }
    }

    const closedBoundaryBandMask = gapClosingIterations > 0
        ? bridgeBoundaryChainGaps({
            mask: boundaryBandMask,
            width,
            height,
            clipMask,
            eligibleMask: gapEligibleMask,
            iterations: gapClosingIterations,
        })
        : boundaryBandMask;
    for (let index = 0; index < closedBoundaryBandMask.length; index += 1) {
        if (closedBoundaryBandMask[index] !== 0 && (clipMask[index] === 0 || distances[index] < 0 || distances[index] > maxDistance)) {
            closedBoundaryBandMask[index] = 0;
        }
    }
    const bridgedBandPixels = countMaskPixels(closedBoundaryBandMask);

    const visited = new Uint8Array(mask.length);
    const componentQueue = new Uint32Array(mask.length);
    const directSupportMask = new Uint8Array(mask.length);
    let componentCount = 0;
    let keptComponentCount = 0;
    let keptPixelCount = 0;
    let prunedEmptyCount = 0;
    let rejectedTooSmallCount = 0;
    let rejectedTooShortCount = 0;
    let rejectedTooThickCount = 0;
    let rejectedWeakSupportCount = 0;
    let largestRejectedPixelCount = 0;
    let largestRejectedSpan = 0;
    let largestRejectedAverageThickness = 0;
    let largestRejectedSupportContactRatio = 0;
    const recordRejected = (
        prunedPixelCount: number,
        longestSpan: number,
        averageThickness: number,
        supportContactRatio: number,
    ) => {
        if (prunedPixelCount <= largestRejectedPixelCount) {
            return;
        }
        largestRejectedPixelCount = prunedPixelCount;
        largestRejectedSpan = longestSpan;
        largestRejectedAverageThickness = averageThickness;
        largestRejectedSupportContactRatio = supportContactRatio;
    };
    for (let index = 0; index < closedBoundaryBandMask.length; index += 1) {
        if (closedBoundaryBandMask[index] === 0) {
            continue;
        }
        if (supportMask[index] !== 0) {
            directSupportMask[index] = 1;
            continue;
        }
        const x = index % width;
        const y = (index / width) | 0;
        const candidates = [
            x > 0 ? index - 1 : -1,
            x < width - 1 ? index + 1 : -1,
            y > 0 ? index - width : -1,
            y < height - 1 ? index + width : -1,
        ];
        for (const nextIndex of candidates) {
            if (nextIndex >= 0 && supportMask[nextIndex] !== 0) {
                directSupportMask[index] = 1;
                break;
            }
        }
    }

    for (let startIndex = 0; startIndex < closedBoundaryBandMask.length; startIndex += 1) {
        if (closedBoundaryBandMask[startIndex] === 0 || visited[startIndex] !== 0) {
            continue;
        }
        componentCount += 1;

        let componentHead = 0;
        let componentTail = 0;
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        visited[startIndex] = 1;
        componentQueue[componentTail] = startIndex;
        componentTail += 1;

        while (componentHead < componentTail) {
            const index = componentQueue[componentHead];
            componentHead += 1;
            const x = index % width;
            const y = (index / width) | 0;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            const candidates = [
                x > 0 ? index - 1 : -1,
                x < width - 1 ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y < height - 1 ? index + width : -1,
            ];

            for (const nextIndex of candidates) {
                if (
                    nextIndex < 0
                    || closedBoundaryBandMask[nextIndex] === 0
                    || visited[nextIndex] !== 0
                ) {
                    continue;
                }
                visited[nextIndex] = 1;
                componentQueue[componentTail] = nextIndex;
                componentTail += 1;
            }
        }

        const componentMask = new Uint8Array(mask.length);
        let hasDirectSupportContact = false;
        for (let index = 0; index < componentTail; index += 1) {
            const currentIndex = componentQueue[index];
            componentMask[currentIndex] = 1;
            if (directSupportMask[currentIndex] !== 0) {
                hasDirectSupportContact = true;
            }
        }
        const fallbackAnchorDistance = Math.min(maxDistance, Math.max(2, Math.ceil(maxDistance / 2)));
        const isComponentAnchor = (index: number): boolean => (
            directSupportMask[index] !== 0
            || (!hasDirectSupportContact && distances[index] >= 0 && distances[index] <= fallbackAnchorDistance)
        );

        let prunedChanged = true;
        while (prunedChanged) {
            prunedChanged = false;
            for (let index = 0; index < componentTail; index += 1) {
                const currentIndex = componentQueue[index];
                if (componentMask[currentIndex] === 0 || isComponentAnchor(currentIndex)) {
                    continue;
                }

                const x = currentIndex % width;
                const y = (currentIndex / width) | 0;
                let degree = 0;
                const neighbors = [
                    x > 0 ? currentIndex - 1 : -1,
                    x < width - 1 ? currentIndex + 1 : -1,
                    y > 0 ? currentIndex - width : -1,
                    y < height - 1 ? currentIndex + width : -1,
                ];
                for (const nextIndex of neighbors) {
                    if (nextIndex >= 0 && componentMask[nextIndex] !== 0) {
                        degree += 1;
                    }
                }
                if (degree <= 1) {
                    componentMask[currentIndex] = 0;
                    prunedChanged = true;
                }
            }
        }

        let prunedPixelCount = 0;
        let supportContactCount = 0;
        minX = Number.POSITIVE_INFINITY;
        maxX = Number.NEGATIVE_INFINITY;
        minY = Number.POSITIVE_INFINITY;
        maxY = Number.NEGATIVE_INFINITY;
        for (let index = 0; index < componentTail; index += 1) {
            const currentIndex = componentQueue[index];
            if (componentMask[currentIndex] === 0) {
                continue;
            }
            prunedPixelCount += 1;
            if (isComponentAnchor(currentIndex)) {
                supportContactCount += 1;
            }
            const x = currentIndex % width;
            const y = (currentIndex / width) | 0;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }

        const spanX = (maxX - minX) + 1;
        const spanY = (maxY - minY) + 1;
        const longestSpan = Math.max(spanX, spanY);
        const averageThickness = longestSpan > 0 ? prunedPixelCount / longestSpan : prunedPixelCount;
        const supportContactRatio = prunedPixelCount > 0 ? supportContactCount / prunedPixelCount : 0;
        const supportContactThreshold = Math.max(2, Math.ceil(minPixels * 0.1));
        if (prunedPixelCount === 0) {
            prunedEmptyCount += 1;
            continue;
        }
        const tooSmall = prunedPixelCount < minPixels;
        const tooShort = longestSpan < minSpan;
        const tooThick = averageThickness > maxAverageThickness;
        const weakSupport = supportContactCount < supportContactThreshold && supportContactRatio < 0.08;
        if (tooSmall || tooShort || tooThick || weakSupport) {
            if (tooSmall) {
                rejectedTooSmallCount += 1;
            }
            if (tooShort) {
                rejectedTooShortCount += 1;
            }
            if (tooThick) {
                rejectedTooThickCount += 1;
            }
            if (weakSupport) {
                rejectedWeakSupportCount += 1;
            }
            recordRejected(prunedPixelCount, longestSpan, averageThickness, supportContactRatio);
            continue;
        }

        keptComponentCount += 1;
        keptPixelCount += prunedPixelCount;
        for (let index = 0; index < componentTail; index += 1) {
            const currentIndex = componentQueue[index];
            if (componentMask[currentIndex] !== 0) {
                kept[currentIndex] = 1;
            }
        }
    }

    return createAnalysis({
        boundaryBandPixels,
        bridgedBandPixels,
        componentCount,
        keptComponentCount,
        keptPixelCount,
        prunedEmptyCount,
        rejectedTooSmallCount,
        rejectedTooShortCount,
        rejectedTooThickCount,
        rejectedWeakSupportCount,
        largestRejectedPixelCount,
        largestRejectedSpan,
        largestRejectedAverageThickness,
        largestRejectedSupportContactRatio,
    });
};

export const keepMaskBoundaryChainsNearSupport = (options: BoundaryChainSupportOptions): Uint8Array => (
    analyzeMaskBoundaryChainsNearSupport(options).mask
);

export const snapBoundaryMaskToSupport = ({
    sourceMask,
    supportMask,
    width,
    clipMask,
    maxDistance,
    minPixels = 6,
    minSpan = 6,
    maxAverageThickness = 3,
    gapClosingIterations = 1,
    preserveUnmatched = true,
}: {
    sourceMask: Uint8Array;
    supportMask: Uint8Array;
    width: number;
    clipMask: Uint8Array;
    maxDistance: number;
    minPixels?: number;
    minSpan?: number;
    maxAverageThickness?: number;
    gapClosingIterations?: number;
    preserveUnmatched?: boolean;
}): BoundarySnapToSupportResult => {
    const empty = new Uint8Array(sourceMask.length);
    if (
        width <= 0
        || sourceMask.length === 0
        || sourceMask.length !== supportMask.length
        || sourceMask.length !== clipMask.length
        || maxDistance < 0
    ) {
        return {
            mask: empty,
            sourcePixelCount: 0,
            matchedSourcePixelCount: 0,
            matchedSupportPixelCount: 0,
            keptOriginalPixelCount: 0,
            supportComponentCount: 0,
            keptSupportComponentCount: 0,
        };
    }

    const supportAnalysis = analyzeMaskBoundaryChainsNearSupport({
        mask: supportMask,
        width,
        clipMask,
        supportMask: sourceMask,
        maxDistance,
        minPixels,
        minSpan,
        maxAverageThickness,
        gapClosingIterations,
    });
    const next = supportAnalysis.mask.slice();

    const height = Math.floor(sourceMask.length / width);
    const distances = new Int16Array(sourceMask.length);
    distances.fill(-1);
    const queue = new Uint32Array(sourceMask.length);
    let head = 0;
    let tail = 0;
    for (let index = 0; index < supportMask.length; index += 1) {
        if (supportMask[index] === 0 || clipMask[index] === 0) {
            continue;
        }
        distances[index] = 0;
        queue[tail] = index;
        tail += 1;
    }

    while (head < tail) {
        const index = queue[head];
        head += 1;
        const distance = distances[index];
        if (distance >= maxDistance) {
            continue;
        }
        const x = index % width;
        const y = (index / width) | 0;
        const candidates = [
            x > 0 ? index - 1 : -1,
            x < width - 1 ? index + 1 : -1,
            y > 0 ? index - width : -1,
            y < height - 1 ? index + width : -1,
        ];
        for (const nextIndex of candidates) {
            if (
                nextIndex < 0
                || clipMask[nextIndex] === 0
                || distances[nextIndex] >= 0
            ) {
                continue;
            }
            distances[nextIndex] = distance + 1;
            queue[tail] = nextIndex;
            tail += 1;
        }
    }

    let sourcePixelCount = 0;
    let matchedSourcePixelCount = 0;
    let keptOriginalPixelCount = 0;
    for (let index = 0; index < sourceMask.length; index += 1) {
        if (sourceMask[index] === 0 || clipMask[index] === 0) {
            continue;
        }
        sourcePixelCount += 1;
        const nearSupport = distances[index] >= 0 && distances[index] <= maxDistance;
        if (nearSupport) {
            matchedSourcePixelCount += 1;
            continue;
        }
        if (preserveUnmatched) {
            next[index] = 1;
            keptOriginalPixelCount += 1;
        }
    }

    return {
        mask: next,
        sourcePixelCount,
        matchedSourcePixelCount,
        matchedSupportPixelCount: countMaskPixels(supportAnalysis.mask),
        keptOriginalPixelCount,
        supportComponentCount: supportAnalysis.componentCount,
        keptSupportComponentCount: supportAnalysis.keptComponentCount,
    };
};

export const createMaskClippedBarrier = ({
    barrierMask,
    clipMask,
}: {
    barrierMask: Uint8Array;
    clipMask: Uint8Array;
}): Uint8Array => {
    const next = new Uint8Array(barrierMask.length);
    const length = Math.min(barrierMask.length, clipMask.length);
    for (let index = 0; index < length; index += 1) {
        next[index] = barrierMask[index] !== 0 || clipMask[index] === 0 ? 1 : 0;
    }
    return next;
};

const blurSourcePixels = (
    source: Uint8ClampedArray,
    width: number,
    height: number,
    radius: number,
): Uint8ClampedArray => {
    if (radius <= 0 || width <= 0 || height <= 0) {
        return source;
    }

    const horizontal = new Uint16Array(width * height * 3);
    const blurred = new Uint8ClampedArray(width * height * 4);
    const windowSize = (radius * 2) + 1;

    for (let y = 0; y < height; y += 1) {
        let red = 0;
        let green = 0;
        let blue = 0;

        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            const sampleX = Math.max(0, Math.min(width - 1, offsetX));
            const sourceOffset = ((y * width) + sampleX) * 4;
            red += source[sourceOffset];
            green += source[sourceOffset + 1];
            blue += source[sourceOffset + 2];
        }

        for (let x = 0; x < width; x += 1) {
            const horizontalOffset = ((y * width) + x) * 3;
            horizontal[horizontalOffset] = Math.round(red / windowSize);
            horizontal[horizontalOffset + 1] = Math.round(green / windowSize);
            horizontal[horizontalOffset + 2] = Math.round(blue / windowSize);

            const removeX = Math.max(0, x - radius);
            const addX = Math.min(width - 1, x + radius + 1);
            const removeOffset = ((y * width) + removeX) * 4;
            const addOffset = ((y * width) + addX) * 4;
            red += source[addOffset] - source[removeOffset];
            green += source[addOffset + 1] - source[removeOffset + 1];
            blue += source[addOffset + 2] - source[removeOffset + 2];
        }
    }

    for (let x = 0; x < width; x += 1) {
        let red = 0;
        let green = 0;
        let blue = 0;

        for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
            const sampleY = Math.max(0, Math.min(height - 1, offsetY));
            const horizontalOffset = ((sampleY * width) + x) * 3;
            red += horizontal[horizontalOffset];
            green += horizontal[horizontalOffset + 1];
            blue += horizontal[horizontalOffset + 2];
        }

        for (let y = 0; y < height; y += 1) {
            const outputOffset = ((y * width) + x) * 4;
            blurred[outputOffset] = Math.round(red / windowSize);
            blurred[outputOffset + 1] = Math.round(green / windowSize);
            blurred[outputOffset + 2] = Math.round(blue / windowSize);
            blurred[outputOffset + 3] = source[outputOffset + 3];

            const removeY = Math.max(0, y - radius);
            const addY = Math.min(height - 1, y + radius + 1);
            const removeOffset = ((removeY * width) + x) * 3;
            const addOffset = ((addY * width) + x) * 3;
            red += horizontal[addOffset] - horizontal[removeOffset];
            green += horizontal[addOffset + 1] - horizontal[removeOffset + 1];
            blue += horizontal[addOffset + 2] - horizontal[removeOffset + 2];
        }
    }

    return blurred;
};

const rgbToLuminance = (red: number, green: number, blue: number) => (
    (0.299 * red) + (0.587 * green) + (0.114 * blue)
);

const rgbToChroma = (red: number, green: number, blue: number) => (
    Math.max(red, green, blue) - Math.min(red, green, blue)
);

const filterMaskLineComponents = ({
    mask,
    width,
    minPixels,
    minSpan,
    maxAverageThickness,
}: {
    mask: Uint8Array;
    width: number;
} & LineComponentFilterOptions): Uint8Array => {
    const filtered = new Uint8Array(mask.length);
    if (width <= 0 || minPixels <= 0 || minSpan <= 0 || maxAverageThickness <= 0) {
        return mask.slice();
    }

    const height = Math.floor(mask.length / width);
    const visited = new Uint8Array(mask.length);
    const queue = new Uint32Array(mask.length);

    for (let startIndex = 0; startIndex < mask.length; startIndex += 1) {
        if (mask[startIndex] === 0 || visited[startIndex] !== 0) {
            continue;
        }

        let minX = width;
        let maxX = 0;
        let minY = height;
        let maxY = 0;
        let head = 0;
        let tail = 0;

        visited[startIndex] = 1;
        queue[tail] = startIndex;
        tail += 1;

        while (head < tail) {
            const index = queue[head];
            head += 1;
            const x = index % width;
            const y = (index / width) | 0;

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                const nextY = y + offsetY;
                if (nextY < 0 || nextY >= height) {
                    continue;
                }
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    if (offsetX === 0 && offsetY === 0) {
                        continue;
                    }
                    const nextX = x + offsetX;
                    if (nextX < 0 || nextX >= width) {
                        continue;
                    }
                    const nextIndex = (nextY * width) + nextX;
                    if (mask[nextIndex] === 0 || visited[nextIndex] !== 0) {
                        continue;
                    }
                    visited[nextIndex] = 1;
                    queue[tail] = nextIndex;
                    tail += 1;
                }
            }
        }

        const spanX = (maxX - minX) + 1;
        const spanY = (maxY - minY) + 1;
        const longestSpan = Math.max(spanX, spanY);
        const averageThickness = longestSpan > 0 ? tail / longestSpan : tail;
        const shouldKeep = tail >= minPixels && longestSpan >= minSpan && averageThickness <= maxAverageThickness;
        if (!shouldKeep) {
            continue;
        }
        for (let index = 0; index < tail; index += 1) {
            filtered[queue[index]] = 1;
        }
    }

    return filtered;
};

export const buildBarrierMask = ({
    source,
    width,
    height,
    rules,
    expansion = 0,
    minComponentPixels = 0,
    blurRadius = 0,
    lineFilter = null,
}: {
    source: Uint8ClampedArray;
    width: number;
    height: number;
    rules: readonly BoundaryRule[];
    expansion?: number;
    minComponentPixels?: number;
    blurRadius?: number;
    lineFilter?: LineComponentFilterOptions | null;
}): Uint8Array => {
    const sampledSource = blurRadius > 0
        ? blurSourcePixels(source, width, height, blurRadius)
        : source;
    const barrierMask = new Uint8Array(width * height);

    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
        const offset = pixelIndex * 4;
        const red = sampledSource[offset];
        const green = sampledSource[offset + 1];
        const blue = sampledSource[offset + 2];

        for (const rule of rules) {
            if (rule.enabled === false) {
                continue;
            }
            if (matchesRgbWithTolerance(red, green, blue, rule.rgb, rule.tolerance)) {
                barrierMask[pixelIndex] = 1;
                break;
            }
        }
    }

    let refinedMask = lineFilter
        ? filterMaskLineComponents({
            mask: barrierMask,
            width,
            ...lineFilter,
        })
        : barrierMask;
    refinedMask = minComponentPixels > 0
        ? filterSmallMaskComponents({
            mask: refinedMask,
            width,
            minComponentPixels,
        })
        : refinedMask;
    return expandBinaryMask({
        mask: refinedMask,
        width,
        height,
        iterations: expansion,
    });
};

export const buildGradientBarrierMask = ({
    source,
    width,
    height,
    blurRadius,
    strongGradientThreshold,
    moderateGradientThreshold,
    darkLuminanceThreshold,
    lowChromaThreshold,
    lineFilter = null,
}: {
    source: Uint8ClampedArray;
    width: number;
    height: number;
} & GradientBarrierOptions): Uint8Array => {
    if (width <= 2 || height <= 2) {
        return new Uint8Array(width * height);
    }

    const sampledSource = blurRadius > 0
        ? blurSourcePixels(source, width, height, blurRadius)
        : source;
    const barrierMask = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            const centerOffset = ((y * width) + x) * 4;
            const centerRed = sampledSource[centerOffset];
            const centerGreen = sampledSource[centerOffset + 1];
            const centerBlue = sampledSource[centerOffset + 2];
            const centerLuminance = rgbToLuminance(centerRed, centerGreen, centerBlue);
            const centerChroma = rgbToChroma(centerRed, centerGreen, centerBlue);

            const luminanceAt = (sampleX: number, sampleY: number) => {
                const offset = ((sampleY * width) + sampleX) * 4;
                return rgbToLuminance(
                    sampledSource[offset],
                    sampledSource[offset + 1],
                    sampledSource[offset + 2],
                );
            };

            const gx = (
                (-1 * luminanceAt(x - 1, y - 1))
                + (1 * luminanceAt(x + 1, y - 1))
                + (-2 * luminanceAt(x - 1, y))
                + (2 * luminanceAt(x + 1, y))
                + (-1 * luminanceAt(x - 1, y + 1))
                + (1 * luminanceAt(x + 1, y + 1))
            );
            const gy = (
                (-1 * luminanceAt(x - 1, y - 1))
                + (-2 * luminanceAt(x, y - 1))
                + (-1 * luminanceAt(x + 1, y - 1))
                + (1 * luminanceAt(x - 1, y + 1))
                + (2 * luminanceAt(x, y + 1))
                + (1 * luminanceAt(x + 1, y + 1))
            );
            const gradientMagnitude = Math.hypot(gx, gy) / 4;
            const isStrongEdge = gradientMagnitude >= strongGradientThreshold;
            const isDarkLinearEdge = (
                gradientMagnitude >= moderateGradientThreshold
                && centerLuminance <= darkLuminanceThreshold
                && centerChroma <= lowChromaThreshold
            );

            if (isStrongEdge || isDarkLinearEdge) {
                barrierMask[(y * width) + x] = 1;
            }
        }
    }

    return lineFilter
        ? filterMaskLineComponents({
            mask: barrierMask,
            width,
            ...lineFilter,
        })
        : barrierMask;
};

export const unionBinaryMasks = (...masks: Array<Uint8Array | null | undefined>): Uint8Array => {
    const firstMask = masks.find((mask) => mask != null);
    if (!firstMask) {
        return new Uint8Array(0);
    }
    const next = new Uint8Array(firstMask.length);
    for (const mask of masks) {
        if (!mask) {
            continue;
        }
        for (let index = 0; index < next.length; index += 1) {
            if (mask[index] !== 0) {
                next[index] = 1;
            }
        }
    }
    return next;
};

export const composeBarrierMask = ({
    baseMask,
    addMask,
    removeMask,
}: {
    baseMask: Uint8Array;
    addMask?: Uint8Array | null;
    removeMask?: Uint8Array | null;
}): Uint8Array => {
    const combined = baseMask.slice();
    for (let index = 0; index < combined.length; index += 1) {
        if (addMask?.[index] !== 0) {
            combined[index] = 1;
        }
        if (removeMask?.[index] !== 0) {
            combined[index] = 0;
        }
    }
    return combined;
};

export const filterSmallMaskComponents = ({
    mask,
    width,
    minComponentPixels,
}: {
    mask: Uint8Array;
    width: number;
    minComponentPixels: number;
}): Uint8Array => {
    const filtered = new Uint8Array(mask.length);
    if (width <= 0 || minComponentPixels <= 1) {
        return mask.slice();
    }

    const height = Math.floor(mask.length / width);
    const visited = new Uint8Array(mask.length);
    const queue = new Uint32Array(mask.length);

    for (let startIndex = 0; startIndex < mask.length; startIndex += 1) {
        if (mask[startIndex] === 0 || visited[startIndex] !== 0) {
            continue;
        }

        let head = 0;
        let tail = 0;
        visited[startIndex] = 1;
        queue[tail] = startIndex;
        tail += 1;

        while (head < tail) {
            const index = queue[head];
            head += 1;
            const x = index % width;
            const y = (index / width) | 0;
            const candidates = [
                x > 0 ? index - 1 : -1,
                x < width - 1 ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y < height - 1 ? index + width : -1,
            ];

            for (const nextIndex of candidates) {
                if (
                    nextIndex < 0
                    || mask[nextIndex] === 0
                    || visited[nextIndex] !== 0
                ) {
                    continue;
                }
                visited[nextIndex] = 1;
                queue[tail] = nextIndex;
                tail += 1;
            }
        }

        if (tail < minComponentPixels) {
            continue;
        }
        for (let index = 0; index < tail; index += 1) {
            filtered[queue[index]] = 1;
        }
    }

    return filtered;
};

export const keepBoundaryComponentsSealingInterior = ({
    mask,
    width,
    minInteriorPixels = 1,
    anchors = [],
}: {
    mask: Uint8Array;
    width: number;
    minInteriorPixels?: number;
    anchors?: ReadonlyArray<readonly [number, number]>;
}): Uint8Array => {
    const height = width > 0 ? Math.floor(mask.length / width) : 0;
    if (width <= 0 || height <= 0 || mask.length === 0) {
        return new Uint8Array(mask.length);
    }

    const outside = new Uint8Array(mask.length);
    const queue = new Uint32Array(mask.length);
    let head = 0;
    let tail = 0;

    const enqueueOutside = (index: number) => {
        if (index < 0 || index >= mask.length || mask[index] !== 0 || outside[index] !== 0) {
            return;
        }
        outside[index] = 1;
        queue[tail] = index;
        tail += 1;
    };

    for (let x = 0; x < width; x += 1) {
        enqueueOutside(x);
        enqueueOutside(((height - 1) * width) + x);
    }
    for (let y = 0; y < height; y += 1) {
        enqueueOutside(y * width);
        enqueueOutside((y * width) + width - 1);
    }

    while (head < tail) {
        const index = queue[head];
        head += 1;
        const x = index % width;
        const y = (index / width) | 0;
        enqueueOutside(x > 0 ? index - 1 : -1);
        enqueueOutside(x < width - 1 ? index + 1 : -1);
        enqueueOutside(y > 0 ? index - width : -1);
        enqueueOutside(y < height - 1 ? index + width : -1);
        enqueueOutside(x > 0 && y > 0 ? index - width - 1 : -1);
        enqueueOutside(x < width - 1 && y > 0 ? index - width + 1 : -1);
        enqueueOutside(x > 0 && y < height - 1 ? index + width - 1 : -1);
        enqueueOutside(x < width - 1 && y < height - 1 ? index + width + 1 : -1);
    }

    const interior = new Uint8Array(mask.length);
    let interiorPixelCount = 0;
    for (let index = 0; index < mask.length; index += 1) {
        if (mask[index] === 0 && outside[index] === 0) {
            interior[index] = 1;
            interiorPixelCount += 1;
        }
    }

    if (interiorPixelCount < minInteriorPixels) {
        return new Uint8Array(mask.length);
    }

    const filtered = new Uint8Array(mask.length);
    const visited = new Uint8Array(mask.length);
    const componentQueue = new Uint32Array(mask.length);
    const componentPixels = new Uint32Array(mask.length);

    const touchesInterior = (index: number) => {
        const x = index % width;
        const y = (index / width) | 0;
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            const nextY = y + offsetY;
            if (nextY < 0 || nextY >= height) {
                continue;
            }
            for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                if (offsetX === 0 && offsetY === 0) {
                    continue;
                }
                const nextX = x + offsetX;
                if (nextX < 0 || nextX >= width) {
                    continue;
                }
                if (interior[(nextY * width) + nextX] !== 0) {
                    return true;
                }
            }
        }
        return false;
    };

    for (let startIndex = 0; startIndex < mask.length; startIndex += 1) {
        if (mask[startIndex] === 0 || visited[startIndex] !== 0) {
            continue;
        }

        let componentHead = 0;
        let componentTail = 0;
        let componentPixelCount = 0;
        let sealsInterior = false;
        let minX = width - 1;
        let minY = height - 1;
        let maxX = 0;
        let maxY = 0;
        visited[startIndex] = 1;
        componentQueue[componentTail] = startIndex;
        componentTail += 1;

        while (componentHead < componentTail) {
            const index = componentQueue[componentHead];
            componentHead += 1;
            componentPixels[componentPixelCount] = index;
            componentPixelCount += 1;

            if (!sealsInterior && touchesInterior(index)) {
                sealsInterior = true;
            }

            const x = index % width;
            const y = (index / width) | 0;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            const candidates = [
                x > 0 ? index - 1 : -1,
                x < width - 1 ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y < height - 1 ? index + width : -1,
                x > 0 && y > 0 ? index - width - 1 : -1,
                x < width - 1 && y > 0 ? index - width + 1 : -1,
                x > 0 && y < height - 1 ? index + width - 1 : -1,
                x < width - 1 && y < height - 1 ? index + width + 1 : -1,
            ];

            for (const nextIndex of candidates) {
                if (nextIndex < 0 || mask[nextIndex] === 0 || visited[nextIndex] !== 0) {
                    continue;
                }
                visited[nextIndex] = 1;
                componentQueue[componentTail] = nextIndex;
                componentTail += 1;
            }
        }

        if (!sealsInterior) {
            continue;
        }
        if (anchors.length > 0) {
            const left = Math.max(0, minX - 1);
            const top = Math.max(0, minY - 1);
            const right = Math.min(width - 1, maxX + 1);
            const bottom = Math.min(height - 1, maxY + 1);
            const boxWidth = (right - left) + 1;
            const boxHeight = (bottom - top) + 1;
            const boxMask = new Uint8Array(boxWidth * boxHeight);
            for (let index = 0; index < componentPixelCount; index += 1) {
                const pixelIndex = componentPixels[index];
                const x = (pixelIndex % width) - left;
                const y = ((pixelIndex / width) | 0) - top;
                boxMask[(y * boxWidth) + x] = 1;
            }

            const boxOutside = new Uint8Array(boxMask.length);
            const boxQueue = new Uint32Array(boxMask.length);
            let boxHead = 0;
            let boxTail = 0;
            const enqueueBoxOutside = (index: number) => {
                if (index < 0 || index >= boxMask.length || boxMask[index] !== 0 || boxOutside[index] !== 0) {
                    return;
                }
                boxOutside[index] = 1;
                boxQueue[boxTail] = index;
                boxTail += 1;
            };
            for (let x = 0; x < boxWidth; x += 1) {
                enqueueBoxOutside(x);
                enqueueBoxOutside(((boxHeight - 1) * boxWidth) + x);
            }
            for (let y = 0; y < boxHeight; y += 1) {
                enqueueBoxOutside(y * boxWidth);
                enqueueBoxOutside((y * boxWidth) + boxWidth - 1);
            }
            while (boxHead < boxTail) {
                const index = boxQueue[boxHead];
                boxHead += 1;
                const x = index % boxWidth;
                const y = (index / boxWidth) | 0;
                enqueueBoxOutside(x > 0 ? index - 1 : -1);
                enqueueBoxOutside(x < boxWidth - 1 ? index + 1 : -1);
                enqueueBoxOutside(y > 0 ? index - boxWidth : -1);
                enqueueBoxOutside(y < boxHeight - 1 ? index + boxWidth : -1);
            }

            const containsAnchor = anchors.some(([anchorX, anchorY]) => {
                if (anchorX < left || anchorX > right || anchorY < top || anchorY > bottom) {
                    return false;
                }
                const localIndex = ((anchorY - top) * boxWidth) + (anchorX - left);
                return boxMask[localIndex] === 0 && boxOutside[localIndex] === 0;
            });
            if (!containsAnchor) {
                continue;
            }
        }
        for (let index = 0; index < componentPixelCount; index += 1) {
            filtered[componentPixels[index]] = 1;
        }
    }

    return filtered;
};

export const keepBoundaryPixelsTouchingClosedInteriors = ({
    mask,
    width,
    minInteriorPixels = 1,
    maxInteriorPixels = Number.POSITIVE_INFINITY,
    anchors = [],
    keepThicknessIterations = 1,
}: {
    mask: Uint8Array;
    width: number;
    minInteriorPixels?: number;
    maxInteriorPixels?: number;
    anchors?: ReadonlyArray<readonly [number, number]>;
    keepThicknessIterations?: number;
}): ClosedBoundaryPixelFilterResult => {
    const height = width > 0 ? Math.floor(mask.length / width) : 0;
    if (width <= 0 || height <= 0 || mask.length === 0) {
        return {
            mask: new Uint8Array(mask.length),
            closedFaceCount: 0,
            anchoredClosedFaceCount: 0,
            keptPixelCount: 0,
            discardedPixelCount: countMaskPixels(mask),
            largestClosedFacePixelCount: 0,
        };
    }

    const closedFaces = extractClosedBoundaryInteriorComponents({
        barrierMask: mask,
        width,
        minPixels: minInteriorPixels,
        maxPixels: maxInteriorPixels,
    });
    const keptBoundary = new Uint8Array(mask.length);
    let anchoredClosedFaceCount = 0;

    const shouldKeepFace = (face: ClosedBoundaryInteriorComponent): boolean => {
        if (anchors.length === 0) {
            return true;
        }
        return anchors.some(([anchorX, anchorY]) => maskContainsPoint({
            mask: face.mask,
            width,
            x: anchorX,
            y: anchorY,
        }));
    };

    for (const face of closedFaces) {
        if (!shouldKeepFace(face)) {
            continue;
        }
        anchoredClosedFaceCount += 1;
        for (let index = 0; index < face.mask.length; index += 1) {
            if (face.mask[index] === 0) {
                continue;
            }
            const x = index % width;
            const y = (index / width) | 0;
            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                const nextY = y + offsetY;
                if (nextY < 0 || nextY >= height) {
                    continue;
                }
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    if (offsetX === 0 && offsetY === 0) {
                        continue;
                    }
                    const nextX = x + offsetX;
                    if (nextX < 0 || nextX >= width) {
                        continue;
                    }
                    const nextIndex = (nextY * width) + nextX;
                    if (mask[nextIndex] !== 0) {
                        keptBoundary[nextIndex] = 1;
                    }
                }
            }
        }
    }

    const thickenedBoundary = keepThicknessIterations > 0
        ? intersectBinaryMasks(
            expandBinaryMask({
                mask: keptBoundary,
                width,
                height,
                iterations: keepThicknessIterations,
            }),
            mask,
        )
        : keptBoundary;
    const keptPixelCount = countMaskPixels(thickenedBoundary);
    const sourcePixelCount = countMaskPixels(mask);

    return {
        mask: thickenedBoundary,
        closedFaceCount: closedFaces.length,
        anchoredClosedFaceCount,
        keptPixelCount,
        discardedPixelCount: Math.max(0, sourcePixelCount - keptPixelCount),
        largestClosedFacePixelCount: closedFaces[0]?.pixelCount ?? 0,
    };
};

export const keepBoundaryPixelsTouchingSeedPartitions = ({
    mask,
    width,
    fillableMask = null,
    seeds = [],
    minPartitionPixels = 1,
    keepThicknessIterations = 1,
}: {
    mask: Uint8Array;
    width: number;
    fillableMask?: Uint8Array | null;
    seeds?: ReadonlyArray<{ x: number; y: number }>;
    minPartitionPixels?: number;
    keepThicknessIterations?: number;
}): BoundaryPartitionPixelFilterResult => {
    const height = width > 0 ? Math.floor(mask.length / width) : 0;
    if (width <= 0 || height <= 0 || mask.length === 0) {
        return {
            mask: new Uint8Array(mask.length),
            partitionCount: 0,
            anchoredPartitionCount: 0,
            keptPixelCount: 0,
            discardedPixelCount: countMaskPixels(mask),
            largestPartitionPixelCount: 0,
        };
    }

    const partitions = extractBoundaryPartitionComponents({
        barrierMask: mask,
        width,
        fillableMask,
        seeds,
        minPixels: minPartitionPixels,
    });
    const partitionLabelByPixel = new Int32Array(mask.length);
    partitionLabelByPixel.fill(-1);
    const anchoredPartitionLabels = new Set<number>();
    let anchoredPartitionCount = 0;

    partitions.forEach((partition, partitionIndex) => {
        if (partition.seedIndexes.length === 1) {
            anchoredPartitionCount += 1;
            anchoredPartitionLabels.add(partitionIndex);
        }
        for (let index = 0; index < partition.mask.length; index += 1) {
            if (partition.mask[index] !== 0) {
                partitionLabelByPixel[index] = partitionIndex;
            }
        }
    });

    const keptBoundary = new Uint8Array(mask.length);
    const visitedBoundary = new Uint8Array(mask.length);
    const componentQueue = new Uint32Array(mask.length);
    const componentPixels = new Uint32Array(mask.length);
    for (let startIndex = 0; startIndex < mask.length; startIndex += 1) {
        if (mask[startIndex] === 0 || visitedBoundary[startIndex] !== 0) {
            continue;
        }
        const labels = new Set<number>();
        const anchoredLabels = new Set<number>();
        let touchesFillBoundary = false;

        let head = 0;
        let tail = 0;
        let componentPixelCount = 0;
        visitedBoundary[startIndex] = 1;
        componentQueue[tail] = startIndex;
        tail += 1;

        while (head < tail) {
            const index = componentQueue[head];
            head += 1;
            componentPixels[componentPixelCount] = index;
            componentPixelCount += 1;
            const x = index % width;
            const y = (index / width) | 0;

            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                const nextY = y + offsetY;
                if (nextY < 0 || nextY >= height) {
                    touchesFillBoundary = true;
                    continue;
                }
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    if (offsetX === 0 && offsetY === 0) {
                        continue;
                    }
                    const nextX = x + offsetX;
                    if (nextX < 0 || nextX >= width) {
                        touchesFillBoundary = true;
                        continue;
                    }
                    const nextIndex = (nextY * width) + nextX;
                    if (mask[nextIndex] !== 0 && visitedBoundary[nextIndex] === 0) {
                        visitedBoundary[nextIndex] = 1;
                        componentQueue[tail] = nextIndex;
                        tail += 1;
                    }
                    if (fillableMask != null && fillableMask[nextIndex] === 0) {
                        touchesFillBoundary = true;
                        continue;
                    }
                    const label = partitionLabelByPixel[nextIndex];
                    if (label >= 0) {
                        labels.add(label);
                        if (anchoredPartitionLabels.has(label)) {
                            anchoredLabels.add(label);
                        }
                    }
                }
            }
        }

        if (anchoredLabels.size > 0 && (labels.size >= 2 || touchesFillBoundary)) {
            for (let componentIndex = 0; componentIndex < componentPixelCount; componentIndex += 1) {
                keptBoundary[componentPixels[componentIndex]] = 1;
            }
        }
    }

    const thickenedBoundary = keepThicknessIterations > 0
        ? intersectBinaryMasks(
            expandBinaryMask({
                mask: keptBoundary,
                width,
                height,
                iterations: keepThicknessIterations,
            }),
            mask,
        )
        : keptBoundary;
    const keptPixelCount = countMaskPixels(thickenedBoundary);
    const sourcePixelCount = countMaskPixels(mask);

    return {
        mask: thickenedBoundary,
        partitionCount: partitions.length,
        anchoredPartitionCount,
        keptPixelCount,
        discardedPixelCount: Math.max(0, sourcePixelCount - keptPixelCount),
        largestPartitionPixelCount: partitions[0]?.pixelCount ?? 0,
    };
};

export const extractClosedBoundaryInteriorComponents = ({
    barrierMask,
    width,
    minPixels = 1,
    maxPixels = Number.POSITIVE_INFINITY,
}: {
    barrierMask: Uint8Array;
    width: number;
    minPixels?: number;
    maxPixels?: number;
}): ClosedBoundaryInteriorComponent[] => {
    const height = width > 0 ? Math.floor(barrierMask.length / width) : 0;
    if (width <= 0 || height <= 0 || barrierMask.length === 0) {
        return [];
    }

    const outside = new Uint8Array(barrierMask.length);
    const queue = new Uint32Array(barrierMask.length);
    let head = 0;
    let tail = 0;
    const enqueueOutside = (index: number) => {
        if (
            index < 0
            || index >= barrierMask.length
            || barrierMask[index] !== 0
            || outside[index] !== 0
        ) {
            return;
        }
        outside[index] = 1;
        queue[tail] = index;
        tail += 1;
    };

    for (let x = 0; x < width; x += 1) {
        enqueueOutside(x);
        enqueueOutside(((height - 1) * width) + x);
    }
    for (let y = 0; y < height; y += 1) {
        enqueueOutside(y * width);
        enqueueOutside((y * width) + width - 1);
    }

    while (head < tail) {
        const index = queue[head];
        head += 1;
        const x = index % width;
        const y = (index / width) | 0;
        enqueueOutside(x > 0 ? index - 1 : -1);
        enqueueOutside(x < width - 1 ? index + 1 : -1);
        enqueueOutside(y > 0 ? index - width : -1);
        enqueueOutside(y < height - 1 ? index + width : -1);
        enqueueOutside(x > 0 && y > 0 ? index - width - 1 : -1);
        enqueueOutside(x < width - 1 && y > 0 ? index - width + 1 : -1);
        enqueueOutside(x > 0 && y < height - 1 ? index + width - 1 : -1);
        enqueueOutside(x < width - 1 && y < height - 1 ? index + width + 1 : -1);
    }

    const visited = new Uint8Array(barrierMask.length);
    const componentQueue = new Uint32Array(barrierMask.length);
    const components: ClosedBoundaryInteriorComponent[] = [];

    for (let startIndex = 0; startIndex < barrierMask.length; startIndex += 1) {
        if (
            barrierMask[startIndex] !== 0
            || outside[startIndex] !== 0
            || visited[startIndex] !== 0
        ) {
            continue;
        }

        let componentHead = 0;
        let componentTail = 0;
        let pixelCount = 0;
        let sumX = 0;
        let sumY = 0;
        let left = width - 1;
        let right = 0;
        let top = height - 1;
        let bottom = 0;
        visited[startIndex] = 1;
        componentQueue[componentTail] = startIndex;
        componentTail += 1;

        while (componentHead < componentTail) {
            const index = componentQueue[componentHead];
            componentHead += 1;
            const x = index % width;
            const y = (index / width) | 0;
            pixelCount += 1;
            sumX += x;
            sumY += y;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);

            const candidates = [
                x > 0 ? index - 1 : -1,
                x < width - 1 ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y < height - 1 ? index + width : -1,
                x > 0 && y > 0 ? index - width - 1 : -1,
                x < width - 1 && y > 0 ? index - width + 1 : -1,
                x > 0 && y < height - 1 ? index + width - 1 : -1,
                x < width - 1 && y < height - 1 ? index + width + 1 : -1,
            ];

            for (const nextIndex of candidates) {
                if (
                    nextIndex < 0
                    || barrierMask[nextIndex] !== 0
                    || outside[nextIndex] !== 0
                    || visited[nextIndex] !== 0
                ) {
                    continue;
                }
                visited[nextIndex] = 1;
                componentQueue[componentTail] = nextIndex;
                componentTail += 1;
            }
        }

        if (pixelCount < minPixels || pixelCount > maxPixels) {
            continue;
        }

        const mask = new Uint8Array(barrierMask.length);
        for (let index = 0; index < componentTail; index += 1) {
            mask[componentQueue[index]] = 1;
        }
        components.push({
            mask,
            pixelCount,
            bounds: { left, top, right, bottom },
            center: {
                x: Math.round(sumX / pixelCount),
                y: Math.round(sumY / pixelCount),
            },
        });
    }

    return components.sort((a, b) => b.pixelCount - a.pixelCount);
};

export const extractBoundaryPartitionComponents = ({
    barrierMask,
    width,
    fillableMask = null,
    seeds = [],
    minPixels = 1,
    maxPixels = Number.POSITIVE_INFINITY,
}: {
    barrierMask: Uint8Array;
    width: number;
    fillableMask?: Uint8Array | null;
    seeds?: ReadonlyArray<{ x: number; y: number }>;
    minPixels?: number;
    maxPixels?: number;
}): BoundaryPartitionComponent[] => {
    const height = width > 0 ? Math.floor(barrierMask.length / width) : 0;
    if (
        width <= 0
        || height <= 0
        || barrierMask.length === 0
        || (fillableMask != null && fillableMask.length !== barrierMask.length)
    ) {
        return [];
    }

    const seedIndexesByPixel = new Map<number, number[]>();
    seeds.forEach((seed, seedIndex) => {
        if (seed.x < 0 || seed.y < 0 || seed.x >= width || seed.y >= height) {
            return;
        }
        const pixelIndex = (seed.y * width) + seed.x;
        const list = seedIndexesByPixel.get(pixelIndex);
        if (list) {
            list.push(seedIndex);
        } else {
            seedIndexesByPixel.set(pixelIndex, [seedIndex]);
        }
    });

    const canFill = (index: number) => (
        index >= 0
        && index < barrierMask.length
        && barrierMask[index] === 0
        && (fillableMask == null || fillableMask[index] !== 0)
    );

    const visited = new Uint8Array(barrierMask.length);
    const queue = new Uint32Array(barrierMask.length);
    const components: BoundaryPartitionComponent[] = [];

    for (let startIndex = 0; startIndex < barrierMask.length; startIndex += 1) {
        if (!canFill(startIndex) || visited[startIndex] !== 0) {
            continue;
        }

        let head = 0;
        let tail = 0;
        let pixelCount = 0;
        let sumX = 0;
        let sumY = 0;
        let left = width - 1;
        let right = 0;
        let top = height - 1;
        let bottom = 0;
        const seedIndexes: number[] = [];

        visited[startIndex] = 1;
        queue[tail] = startIndex;
        tail += 1;

        while (head < tail) {
            const index = queue[head];
            head += 1;
            const x = index % width;
            const y = (index / width) | 0;
            pixelCount += 1;
            sumX += x;
            sumY += y;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);

            const currentSeedIndexes = seedIndexesByPixel.get(index);
            if (currentSeedIndexes) {
                seedIndexes.push(...currentSeedIndexes);
            }

            const candidates = [
                x > 0 ? index - 1 : -1,
                x < width - 1 ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y < height - 1 ? index + width : -1,
            ];

            for (const nextIndex of candidates) {
                if (nextIndex < 0 || visited[nextIndex] !== 0 || !canFill(nextIndex)) {
                    continue;
                }
                visited[nextIndex] = 1;
                queue[tail] = nextIndex;
                tail += 1;
            }
        }

        if (pixelCount < minPixels || pixelCount > maxPixels) {
            continue;
        }

        const mask = new Uint8Array(barrierMask.length);
        for (let index = 0; index < tail; index += 1) {
            mask[queue[index]] = 1;
        }
        components.push({
            mask,
            pixelCount,
            bounds: { left, top, right, bottom },
            center: {
                x: Math.round(sumX / pixelCount),
                y: Math.round(sumY / pixelCount),
            },
            seedIndexes,
        });
    }

    return components.sort((a, b) => b.pixelCount - a.pixelCount);
};

export const analyzeOpenBoundaryComponents = ({
    barrierMask,
    width,
    minPixels = 16,
    maxHints = 8,
}: {
    barrierMask: Uint8Array;
    width: number;
    minPixels?: number;
    maxHints?: number;
}): OpenBoundaryComponentAnalysis => {
    const height = width > 0 ? Math.floor(barrierMask.length / width) : 0;
    if (width <= 0 || height <= 0 || barrierMask.length === 0) {
        return { openComponentCount: 0, largestOpenPixelCount: 0, hints: [] };
    }

    const outside = new Uint8Array(barrierMask.length);
    const outsideQueue = new Uint32Array(barrierMask.length);
    let outsideHead = 0;
    let outsideTail = 0;
    const enqueueOutside = (index: number) => {
        if (
            index < 0
            || index >= barrierMask.length
            || barrierMask[index] !== 0
            || outside[index] !== 0
        ) {
            return;
        }
        outside[index] = 1;
        outsideQueue[outsideTail] = index;
        outsideTail += 1;
    };

    for (let x = 0; x < width; x += 1) {
        enqueueOutside(x);
        enqueueOutside(((height - 1) * width) + x);
    }
    for (let y = 0; y < height; y += 1) {
        enqueueOutside(y * width);
        enqueueOutside((y * width) + width - 1);
    }

    while (outsideHead < outsideTail) {
        const index = outsideQueue[outsideHead];
        outsideHead += 1;
        const x = index % width;
        const y = (index / width) | 0;
        enqueueOutside(x > 0 ? index - 1 : -1);
        enqueueOutside(x < width - 1 ? index + 1 : -1);
        enqueueOutside(y > 0 ? index - width : -1);
        enqueueOutside(y < height - 1 ? index + width : -1);
        enqueueOutside(x > 0 && y > 0 ? index - width - 1 : -1);
        enqueueOutside(x < width - 1 && y > 0 ? index - width + 1 : -1);
        enqueueOutside(x > 0 && y < height - 1 ? index + width - 1 : -1);
        enqueueOutside(x < width - 1 && y < height - 1 ? index + width + 1 : -1);
    }

    const touchesInterior = (index: number) => {
        const x = index % width;
        const y = (index / width) | 0;
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            const nextY = y + offsetY;
            if (nextY < 0 || nextY >= height) {
                continue;
            }
            for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                if (offsetX === 0 && offsetY === 0) {
                    continue;
                }
                const nextX = x + offsetX;
                if (nextX < 0 || nextX >= width) {
                    continue;
                }
                const nextIndex = (nextY * width) + nextX;
                if (barrierMask[nextIndex] === 0 && outside[nextIndex] === 0) {
                    return true;
                }
            }
        }
        return false;
    };

    const findFarthestPixel = (fromIndex: number, pixels: Uint32Array, pixelCount: number) => {
        const fromX = fromIndex % width;
        const fromY = (fromIndex / width) | 0;
        let farthestIndex = fromIndex;
        let farthestDistance = -1;
        for (let index = 0; index < pixelCount; index += 1) {
            const pixelIndex = pixels[index];
            const x = pixelIndex % width;
            const y = (pixelIndex / width) | 0;
            const distance = ((x - fromX) * (x - fromX)) + ((y - fromY) * (y - fromY));
            if (distance > farthestDistance) {
                farthestDistance = distance;
                farthestIndex = pixelIndex;
            }
        }
        return farthestIndex;
    };

    const visited = new Uint8Array(barrierMask.length);
    const componentQueue = new Uint32Array(barrierMask.length);
    const componentPixels = new Uint32Array(barrierMask.length);
    const hints: OpenBoundaryComponentHint[] = [];
    let openComponentCount = 0;
    let largestOpenPixelCount = 0;

    for (let startIndex = 0; startIndex < barrierMask.length; startIndex += 1) {
        if (barrierMask[startIndex] === 0 || visited[startIndex] !== 0) {
            continue;
        }

        let componentHead = 0;
        let componentTail = 0;
        let componentPixelCount = 0;
        let sumX = 0;
        let sumY = 0;
        let touchesClosedInterior = false;
        let left = width - 1;
        let right = 0;
        let top = height - 1;
        let bottom = 0;
        visited[startIndex] = 1;
        componentQueue[componentTail] = startIndex;
        componentTail += 1;

        while (componentHead < componentTail) {
            const index = componentQueue[componentHead];
            componentHead += 1;
            componentPixels[componentPixelCount] = index;
            componentPixelCount += 1;

            const x = index % width;
            const y = (index / width) | 0;
            sumX += x;
            sumY += y;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
            if (!touchesClosedInterior && touchesInterior(index)) {
                touchesClosedInterior = true;
            }

            const candidates = [
                x > 0 ? index - 1 : -1,
                x < width - 1 ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y < height - 1 ? index + width : -1,
                x > 0 && y > 0 ? index - width - 1 : -1,
                x < width - 1 && y > 0 ? index - width + 1 : -1,
                x > 0 && y < height - 1 ? index + width - 1 : -1,
                x < width - 1 && y < height - 1 ? index + width + 1 : -1,
            ];

            for (const nextIndex of candidates) {
                if (nextIndex < 0 || barrierMask[nextIndex] === 0 || visited[nextIndex] !== 0) {
                    continue;
                }
                visited[nextIndex] = 1;
                componentQueue[componentTail] = nextIndex;
                componentTail += 1;
            }
        }

        if (touchesClosedInterior || componentPixelCount < minPixels) {
            continue;
        }

        openComponentCount += 1;
        largestOpenPixelCount = Math.max(largestOpenPixelCount, componentPixelCount);
        if (hints.length >= maxHints) {
            continue;
        }
        const firstEndpoint = findFarthestPixel(componentPixels[0], componentPixels, componentPixelCount);
        const secondEndpoint = findFarthestPixel(firstEndpoint, componentPixels, componentPixelCount);
        hints.push({
            pixelCount: componentPixelCount,
            bounds: { left, top, right, bottom },
            center: {
                x: Math.round(sumX / componentPixelCount),
                y: Math.round(sumY / componentPixelCount),
            },
            endpoints: [
                { x: firstEndpoint % width, y: (firstEndpoint / width) | 0 },
                { x: secondEndpoint % width, y: (secondEndpoint / width) | 0 },
            ],
        });
    }

    hints.sort((a, b) => b.pixelCount - a.pixelCount);
    return { openComponentCount, largestOpenPixelCount, hints };
};

export const rankOpenBoundaryHintsForTargets = ({
    hints,
    targets,
}: {
    hints: OpenBoundaryComponentHint[];
    targets: OpenBoundaryHintTarget[];
}): RankedOpenBoundaryComponentHint[] => {
    const activeTargets = targets.filter((target) => target.seed != null);
    const distanceToHint = (hint: OpenBoundaryComponentHint, seed: { x: number; y: number }) => {
        const points = [hint.center, hint.endpoints[0], hint.endpoints[1]];
        let minDistance = Number.POSITIVE_INFINITY;
        for (const point of points) {
            const dx = point.x - seed.x;
            const dy = point.y - seed.y;
            minDistance = Math.min(minDistance, Math.sqrt((dx * dx) + (dy * dy)));
        }
        return minDistance;
    };

    return hints.map((hint) => {
        let nearestTarget: OpenBoundaryHintTarget | null = null;
        let distanceToNearestTarget: number | null = null;
        for (const target of activeTargets) {
            if (!target.seed) {
                continue;
            }
            const distance = distanceToHint(hint, target.seed);
            if (distanceToNearestTarget == null || distance < distanceToNearestTarget) {
                nearestTarget = target;
                distanceToNearestTarget = distance;
            }
        }
        return {
            ...hint,
            nearestTarget,
            distanceToNearestTarget,
        };
    }).sort((left, right) => {
        if (left.distanceToNearestTarget != null && right.distanceToNearestTarget != null) {
            const distanceDelta = left.distanceToNearestTarget - right.distanceToNearestTarget;
            if (Math.abs(distanceDelta) > 0.001) {
                return distanceDelta;
            }
        } else if (left.distanceToNearestTarget != null) {
            return -1;
        } else if (right.distanceToNearestTarget != null) {
            return 1;
        }
        return right.pixelCount - left.pixelCount;
    });
};

export const floodFillContiguousArea = ({
    width,
    height,
    startX,
    startY,
    barrierMask,
}: {
    width: number;
    height: number;
    startX: number;
    startY: number;
    barrierMask: Uint8Array;
}): Uint8Array => {
    const fillMask = new Uint8Array(width * height);

    if (startX < 0 || startY < 0 || startX >= width || startY >= height) {
        return fillMask;
    }

    const startIndex = startY * width + startX;
    if (barrierMask[startIndex] !== 0) {
        return fillMask;
    }

    const queue = new Uint32Array(width * height);
    let head = 0;
    let tail = 0;

    queue[tail] = startIndex;
    tail += 1;
    fillMask[startIndex] = 1;

    while (head < tail) {
        const index = queue[head];
        head += 1;

        const x = index % width;
        const y = (index / width) | 0;

        if (x > 0) {
            const nextIndex = index - 1;
            if (barrierMask[nextIndex] === 0 && fillMask[nextIndex] === 0) {
                fillMask[nextIndex] = 1;
                queue[tail] = nextIndex;
                tail += 1;
            }
        }

        if (x < width - 1) {
            const nextIndex = index + 1;
            if (barrierMask[nextIndex] === 0 && fillMask[nextIndex] === 0) {
                fillMask[nextIndex] = 1;
                queue[tail] = nextIndex;
                tail += 1;
            }
        }

        if (y > 0) {
            const nextIndex = index - width;
            if (barrierMask[nextIndex] === 0 && fillMask[nextIndex] === 0) {
                fillMask[nextIndex] = 1;
                queue[tail] = nextIndex;
                tail += 1;
            }
        }

        if (y < height - 1) {
            const nextIndex = index + width;
            if (barrierMask[nextIndex] === 0 && fillMask[nextIndex] === 0) {
                fillMask[nextIndex] = 1;
                queue[tail] = nextIndex;
                tail += 1;
            }
        }
    }

    return fillMask;
};

const buildRadialBoundarySelectionData = ({
    width,
    height,
    startX,
    startY,
    barrierMask,
    maxRadius,
    rayCount = 96,
    minHitRatio = 0.55,
}: {
    width: number;
    height: number;
    startX: number;
    startY: number;
    barrierMask: Uint8Array;
    maxRadius: number;
    rayCount?: number;
    minHitRatio?: number;
}): { mask: Uint8Array; polygon: Array<readonly [number, number]> } | null => {
    if (
        width <= 0
        || height <= 0
        || startX < 0
        || startY < 0
        || startX >= width
        || startY >= height
        || maxRadius <= 1
        || rayCount < 8
    ) {
        return null;
    }

    const distances = new Float32Array(rayCount);
    const hitDistances: number[] = [];
    const hitFlags = new Uint8Array(rayCount);

    for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
        const angle = (Math.PI * 2 * rayIndex) / rayCount;
        const deltaX = Math.cos(angle);
        const deltaY = Math.sin(angle);
        let lastInsideDistance = 0;
        let foundBarrier = false;

        for (let radius = 1; radius <= maxRadius; radius += 1) {
            const x = Math.round(startX + (deltaX * radius));
            const y = Math.round(startY + (deltaY * radius));
            if (x < 0 || x >= width || y < 0 || y >= height) {
                break;
            }
            const index = (y * width) + x;
            if (barrierMask[index] !== 0) {
                foundBarrier = true;
                break;
            }
            lastInsideDistance = radius;
        }

        if (foundBarrier) {
            hitFlags[rayIndex] = 1;
            hitDistances.push(lastInsideDistance);
        }
        distances[rayIndex] = lastInsideDistance;
    }

    const hitCount = hitDistances.length;
    if (hitCount / rayCount < minHitRatio || hitCount === 0) {
        return null;
    }

    hitDistances.sort((left, right) => left - right);
    const medianDistance = hitDistances[Math.floor(hitDistances.length / 2)] ?? 0;
    const fallbackDistance = Math.max(1, medianDistance * 0.9);

    for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
        if (hitFlags[rayIndex] !== 0) {
            distances[rayIndex] = Math.max(1, distances[rayIndex]);
            continue;
        }
        distances[rayIndex] = fallbackDistance;
    }

    const smoothedDistances = new Float32Array(rayCount);
    for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
        let total = 0;
        let samples = 0;
        for (let offset = -2; offset <= 2; offset += 1) {
            const sampleIndex = (rayIndex + offset + rayCount) % rayCount;
            total += distances[sampleIndex];
            samples += 1;
        }
        smoothedDistances[rayIndex] = total / samples;
    }

    const points: Array<readonly [number, number]> = [];
    for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
        const angle = (Math.PI * 2 * rayIndex) / rayCount;
        const distance = smoothedDistances[rayIndex];
        const x = Math.max(0, Math.min(width - 1, Math.round(startX + (Math.cos(angle) * distance))));
        const y = Math.max(0, Math.min(height - 1, Math.round(startY + (Math.sin(angle) * distance))));
        points.push([x, y] as const);
    }

    return {
        polygon: points,
        mask: rasterizePolygonMask({
            width,
            height,
            polygon: points,
        }),
    };
};

export const buildRadialBoundarySelectionMask = (options: {
    width: number;
    height: number;
    startX: number;
    startY: number;
    barrierMask: Uint8Array;
    maxRadius: number;
    rayCount?: number;
    minHitRatio?: number;
}): Uint8Array | null => (
    buildRadialBoundarySelectionData(options)?.mask ?? null
);

export const buildRadialBoundaryStrokeMask = (options: {
    width: number;
    height: number;
    startX: number;
    startY: number;
    barrierMask: Uint8Array;
    maxRadius: number;
    rayCount?: number;
    minHitRatio?: number;
    radius?: number;
}): Uint8Array | null => {
    const selection = buildRadialBoundarySelectionData(options);
    if (!selection) {
        return null;
    }
    const closedPoints = selection.polygon.length > 1
        ? [...selection.polygon, selection.polygon[0]]
        : selection.polygon;
    return rasterizeStrokeMask({
        width: options.width,
        height: options.height,
        points: closedPoints,
        radius: options.radius ?? 1.4,
    });
};

export const buildBarrierInteriorSelectionMask = ({
    width,
    height,
    startX,
    startY,
    roiMask,
    barrierMask,
    closingIterations = 1,
}: {
    width: number;
    height: number;
    startX: number;
    startY: number;
    roiMask: Uint8Array;
    barrierMask: Uint8Array;
    closingIterations?: number;
}): Uint8Array | null => {
    if (
        width <= 0
        || height <= 0
        || startX < 0
        || startY < 0
        || startX >= width
        || startY >= height
    ) {
        return null;
    }

    const startIndex = startY * width + startX;
    if (roiMask[startIndex] === 0) {
        return null;
    }

    const roiBounds = getBinaryMaskBounds(roiMask, width);
    if (!roiBounds) {
        return null;
    }

    const barrierWithinRoi = intersectBinaryMasks(barrierMask, roiMask);
    const closedBarrier = closingIterations > 0
        ? closeBinaryMask({
            mask: barrierWithinRoi,
            width,
            height,
            iterations: closingIterations,
        })
        : barrierWithinRoi;
    const outsideMask = new Uint8Array(width * height);
    const queue = new Uint32Array(width * height);
    let head = 0;
    let tail = 0;

    const enqueueOutside = (index: number) => {
        if (
            roiMask[index] === 0
            || closedBarrier[index] !== 0
            || outsideMask[index] !== 0
            || index === startIndex
        ) {
            return;
        }
        outsideMask[index] = 1;
        queue[tail] = index;
        tail += 1;
    };

    for (let x = roiBounds.left; x <= roiBounds.right; x += 1) {
        enqueueOutside(roiBounds.top * width + x);
        enqueueOutside(roiBounds.bottom * width + x);
    }
    for (let y = roiBounds.top; y <= roiBounds.bottom; y += 1) {
        enqueueOutside(y * width + roiBounds.left);
        enqueueOutside(y * width + roiBounds.right);
    }

    while (head < tail) {
        const index = queue[head];
        head += 1;
        const x = index % width;
        const y = (index / width) | 0;
        const candidates = [
            x > roiBounds.left ? index - 1 : -1,
            x < roiBounds.right ? index + 1 : -1,
            y > roiBounds.top ? index - width : -1,
            y < roiBounds.bottom ? index + width : -1,
        ];

        for (const nextIndex of candidates) {
            if (nextIndex < 0) {
                continue;
            }
            enqueueOutside(nextIndex);
        }
    }

    const interiorMask = new Uint8Array(width * height);
    for (let index = 0; index < interiorMask.length; index += 1) {
        if (
            roiMask[index] !== 0
            && closedBarrier[index] === 0
            && outsideMask[index] === 0
        ) {
            interiorMask[index] = 1;
        }
    }

    if (interiorMask[startIndex] === 0) {
        return null;
    }

    const visited = new Uint8Array(width * height);
    const componentQueue = new Uint32Array(width * height);
    const components: Array<{
        pixels: number[];
        pixelCount: number;
        minDistanceSquared: number;
        containsStart: boolean;
    }> = [];

    for (let index = 0; index < interiorMask.length; index += 1) {
        if (interiorMask[index] === 0 || visited[index] !== 0) {
            continue;
        }

        let head = 0;
        let tail = 0;
        let pixelCount = 0;
        let containsStart = false;
        let minDistanceSquared = Number.POSITIVE_INFINITY;
        const pixels: number[] = [];

        visited[index] = 1;
        componentQueue[tail] = index;
        tail += 1;

        while (head < tail) {
            const currentIndex = componentQueue[head];
            head += 1;
            pixelCount += 1;
            pixels.push(currentIndex);
            if (currentIndex === startIndex) {
                containsStart = true;
            }

            const currentX = currentIndex % width;
            const currentY = (currentIndex / width) | 0;
            const distanceSquared = ((currentX - startX) * (currentX - startX))
                + ((currentY - startY) * (currentY - startY));
            if (distanceSquared < minDistanceSquared) {
                minDistanceSquared = distanceSquared;
            }

            const candidates = [
                currentX > roiBounds.left ? currentIndex - 1 : -1,
                currentX < roiBounds.right ? currentIndex + 1 : -1,
                currentY > roiBounds.top ? currentIndex - width : -1,
                currentY < roiBounds.bottom ? currentIndex + width : -1,
            ];

            for (const nextIndex of candidates) {
                if (
                    nextIndex < 0
                    || visited[nextIndex] !== 0
                    || interiorMask[nextIndex] === 0
                ) {
                    continue;
                }
                visited[nextIndex] = 1;
                componentQueue[tail] = nextIndex;
                tail += 1;
            }
        }

        components.push({
            pixels,
            pixelCount,
            minDistanceSquared,
            containsStart,
        });
    }

    if (components.length === 0) {
        return null;
    }

    const largestPixelCount = components.reduce(
        (current, component) => Math.max(current, component.pixelCount),
        0,
    );
    const startComponent = components.find((component) => component.containsStart) ?? null;
    const selectedComponent = (
        startComponent
        && startComponent.pixelCount >= Math.max(16, largestPixelCount * 0.25)
    )
        ? startComponent
        : [...components].sort(
            (left, right) => right.pixelCount - left.pixelCount || left.minDistanceSquared - right.minDistanceSquared,
        )[0];

    const selectionMask = new Uint8Array(width * height);
    for (const index of selectedComponent.pixels) {
        selectionMask[index] = 1;
    }

    return fillMaskInternalHoles({
        mask: selectionMask,
        width,
        height,
    });
};

const sampleSeedColorProfile = ({
    source,
    width,
    height,
    startX,
    startY,
    barrierMask,
    radius,
    profileMask = null,
}: {
    source: Uint8ClampedArray;
    width: number;
    height: number;
    startX: number;
    startY: number;
    barrierMask: Uint8Array;
    radius: number;
    profileMask?: Uint8Array | null;
}): SeedColorProfile | null => {
    let red = 0;
    let green = 0;
    let blue = 0;
    let luminance = 0;
    let chroma = 0;
    let count = 0;
    const samples: Array<readonly [number, number, number]> = [];
    const pushSample = (index: number) => {
        if (barrierMask[index] !== 0) {
            return;
        }
        const offset = index * 4;
        const sampleRed = source[offset];
        const sampleGreen = source[offset + 1];
        const sampleBlue = source[offset + 2];
        red += sampleRed;
        green += sampleGreen;
        blue += sampleBlue;
        luminance += rgbToLuminance(sampleRed, sampleGreen, sampleBlue);
        chroma += rgbToChroma(sampleRed, sampleGreen, sampleBlue);
        count += 1;
        samples.push([sampleRed, sampleGreen, sampleBlue] as const);
    };

    if (profileMask) {
        let profilePixelCount = 0;
        const profileLength = Math.min(profileMask.length, width * height);
        for (let index = 0; index < profileLength; index += 1) {
            if (profileMask[index] !== 0 && barrierMask[index] === 0) {
                profilePixelCount += 1;
            }
        }

        if (profilePixelCount > 0) {
            const stride = Math.max(1, Math.ceil(profilePixelCount / 2048));
            let seen = 0;
            for (let index = 0; index < profileLength; index += 1) {
                if (profileMask[index] === 0 || barrierMask[index] !== 0) {
                    continue;
                }
                if (seen % stride === 0) {
                    pushSample(index);
                }
                seen += 1;
            }
        }
    }

    if (count === 0) {
        for (let y = Math.max(0, startY - radius); y <= Math.min(height - 1, startY + radius); y += 1) {
            for (let x = Math.max(0, startX - radius); x <= Math.min(width - 1, startX + radius); x += 1) {
                pushSample(y * width + x);
            }
        }
    }

    if (count === 0) {
        return null;
    }

    const meanRed = red / count;
    const meanGreen = green / count;
    const meanBlue = blue / count;
    const meanLuminance = luminance / count;
    const meanChroma = chroma / count;

    let varianceRed = 0;
    let varianceGreen = 0;
    let varianceBlue = 0;
    let varianceLuminance = 0;
    let varianceChroma = 0;

    for (const [sampleRed, sampleGreen, sampleBlue] of samples) {
        varianceRed += (sampleRed - meanRed) ** 2;
        varianceGreen += (sampleGreen - meanGreen) ** 2;
        varianceBlue += (sampleBlue - meanBlue) ** 2;
        varianceLuminance += (rgbToLuminance(sampleRed, sampleGreen, sampleBlue) - meanLuminance) ** 2;
        varianceChroma += (rgbToChroma(sampleRed, sampleGreen, sampleBlue) - meanChroma) ** 2;
    }

    return {
        mean: [
            Math.round(meanRed),
            Math.round(meanGreen),
            Math.round(meanBlue),
        ],
        meanLuminance,
        meanChroma,
        stdChannelMax: Math.max(
            Math.sqrt(varianceRed / count),
            Math.sqrt(varianceGreen / count),
            Math.sqrt(varianceBlue / count),
        ),
        stdLuminance: Math.sqrt(varianceLuminance / count),
        stdChroma: Math.sqrt(varianceChroma / count),
    };
};

export const floodFillColorBoundedArea = ({
    source,
    width,
    height,
    startX,
    startY,
    barrierMask,
    colorTolerance,
    seedSampleRadius = 3,
    edgeStopFactor = 0,
    profileMask = null,
}: {
    source: Uint8ClampedArray;
    width: number;
    height: number;
    startX: number;
    startY: number;
    barrierMask: Uint8Array;
    colorTolerance: number;
    seedSampleRadius?: number;
    edgeStopFactor?: number;
    profileMask?: Uint8Array | null;
}): Uint8Array => {
    const fillMask = new Uint8Array(width * height);

    if (startX < 0 || startY < 0 || startX >= width || startY >= height) {
        return fillMask;
    }

    const startIndex = startY * width + startX;
    if (barrierMask[startIndex] !== 0) {
        return fillMask;
    }

    const seedProfile = sampleSeedColorProfile({
        source,
        width,
        height,
        startX,
        startY,
        barrierMask,
        radius: seedSampleRadius,
        profileMask,
    });
    if (!seedProfile) {
        return fillMask;
    }

    const adaptiveChannelTolerance = Math.max(
        6,
        Math.min(colorTolerance, (seedProfile.stdChannelMax * 2.2) + (colorTolerance * 0.35)),
    );
    const adaptiveRgbDistanceTolerance = Math.max(
        10,
        Math.min(colorTolerance * 1.4, (adaptiveChannelTolerance * 1.8) + 2),
    );
    const adaptiveLuminanceTolerance = Math.max(
        8,
        Math.min(colorTolerance, (seedProfile.stdLuminance * 2.4) + (colorTolerance * 0.3)),
    );
    const adaptiveChromaTolerance = Math.max(
        10,
        Math.min(colorTolerance * 1.1, (seedProfile.stdChroma * 2.4) + (colorTolerance * 0.35)),
    );
    const useEdgeStop = edgeStopFactor > 0;
    const adaptiveCrossChannelTolerance = Math.max(
        6,
        adaptiveChannelTolerance * edgeStopFactor,
    );
    const adaptiveCrossRgbDistanceTolerance = Math.max(
        10,
        adaptiveRgbDistanceTolerance * edgeStopFactor,
    );
    const adaptiveCrossLuminanceTolerance = Math.max(
        8,
        adaptiveLuminanceTolerance * edgeStopFactor,
    );
    const adaptiveCrossChromaTolerance = Math.max(
        8,
        adaptiveChromaTolerance * edgeStopFactor,
    );

    const queue = new Uint32Array(width * height);
    let head = 0;
    let tail = 0;

    queue[tail] = startIndex;
    tail += 1;
    fillMask[startIndex] = 1;

    while (head < tail) {
        const index = queue[head];
        head += 1;

        const x = index % width;
        const y = (index / width) | 0;
        const candidates = [
            x > 0 ? index - 1 : -1,
            x < width - 1 ? index + 1 : -1,
            y > 0 ? index - width : -1,
            y < height - 1 ? index + width : -1,
        ];

        for (const nextIndex of candidates) {
            if (nextIndex < 0 || fillMask[nextIndex] !== 0 || barrierMask[nextIndex] !== 0) {
                continue;
            }
            const currentOffset = index * 4;
            const currentRed = source[currentOffset];
            const currentGreen = source[currentOffset + 1];
            const currentBlue = source[currentOffset + 2];
            const offset = nextIndex * 4;
            const candidateRed = source[offset];
            const candidateGreen = source[offset + 1];
            const candidateBlue = source[offset + 2];
            const channelDiffMax = Math.max(
                Math.abs(candidateRed - seedProfile.mean[0]),
                Math.abs(candidateGreen - seedProfile.mean[1]),
                Math.abs(candidateBlue - seedProfile.mean[2]),
            );
            const rgbDistance = Math.hypot(
                candidateRed - seedProfile.mean[0],
                candidateGreen - seedProfile.mean[1],
                candidateBlue - seedProfile.mean[2],
            );
            const luminanceDiff = Math.abs(
                rgbToLuminance(candidateRed, candidateGreen, candidateBlue) - seedProfile.meanLuminance,
            );
            const chromaDiff = Math.abs(
                rgbToChroma(candidateRed, candidateGreen, candidateBlue) - seedProfile.meanChroma,
            );

            if (
                channelDiffMax > adaptiveChannelTolerance
                || rgbDistance > adaptiveRgbDistanceTolerance
                || luminanceDiff > adaptiveLuminanceTolerance
                || chromaDiff > adaptiveChromaTolerance
            ) {
                continue;
            }
            if (useEdgeStop) {
                const crossChannelDiffMax = Math.max(
                    Math.abs(candidateRed - currentRed),
                    Math.abs(candidateGreen - currentGreen),
                    Math.abs(candidateBlue - currentBlue),
                );
                const crossRgbDistance = Math.hypot(
                    candidateRed - currentRed,
                    candidateGreen - currentGreen,
                    candidateBlue - currentBlue,
                );
                const crossLuminanceDiff = Math.abs(
                    rgbToLuminance(candidateRed, candidateGreen, candidateBlue)
                    - rgbToLuminance(currentRed, currentGreen, currentBlue),
                );
                const crossChromaDiff = Math.abs(
                    rgbToChroma(candidateRed, candidateGreen, candidateBlue)
                    - rgbToChroma(currentRed, currentGreen, currentBlue),
                );
                if (
                    crossChannelDiffMax > adaptiveCrossChannelTolerance
                    || crossRgbDistance > adaptiveCrossRgbDistanceTolerance
                    || crossLuminanceDiff > adaptiveCrossLuminanceTolerance
                    || crossChromaDiff > adaptiveCrossChromaTolerance
                ) {
                    continue;
                }
            }
            fillMask[nextIndex] = 1;
            queue[tail] = nextIndex;
            tail += 1;
        }
    }

    return fillMask;
};

export const expandMaskColorBoundedArea = ({
    source,
    width,
    height,
    startX,
    startY,
    seedMask,
    barrierMask,
    clipMask = null,
    colorTolerance,
    seedSampleRadius = 3,
    edgeStopFactor = 0,
    profileMask = null,
}: {
    source: Uint8ClampedArray;
    width: number;
    height: number;
    startX: number;
    startY: number;
    seedMask: Uint8Array;
    barrierMask: Uint8Array;
    clipMask?: Uint8Array | null;
    colorTolerance: number;
    seedSampleRadius?: number;
    edgeStopFactor?: number;
    profileMask?: Uint8Array | null;
}): Uint8Array => {
    const fillMask = seedMask.slice();

    if (startX < 0 || startY < 0 || startX >= width || startY >= height) {
        return fillMask;
    }

    const startIndex = startY * width + startX;
    if (barrierMask[startIndex] !== 0) {
        return fillMask;
    }

    const seedProfile = sampleSeedColorProfile({
        source,
        width,
        height,
        startX,
        startY,
        barrierMask,
        radius: seedSampleRadius,
        profileMask,
    });
    if (!seedProfile) {
        return fillMask;
    }

    const adaptiveChannelTolerance = Math.max(
        6,
        Math.min(colorTolerance, (seedProfile.stdChannelMax * 2.2) + (colorTolerance * 0.35)),
    );
    const adaptiveRgbDistanceTolerance = Math.max(
        10,
        Math.min(colorTolerance * 1.4, (adaptiveChannelTolerance * 1.8) + 2),
    );
    const adaptiveLuminanceTolerance = Math.max(
        8,
        Math.min(colorTolerance, (seedProfile.stdLuminance * 2.4) + (colorTolerance * 0.3)),
    );
    const adaptiveChromaTolerance = Math.max(
        10,
        Math.min(colorTolerance * 1.1, (seedProfile.stdChroma * 2.4) + (colorTolerance * 0.35)),
    );
    const useEdgeStop = edgeStopFactor > 0;
    const adaptiveCrossChannelTolerance = Math.max(6, adaptiveChannelTolerance * edgeStopFactor);
    const adaptiveCrossRgbDistanceTolerance = Math.max(10, adaptiveRgbDistanceTolerance * edgeStopFactor);
    const adaptiveCrossLuminanceTolerance = Math.max(8, adaptiveLuminanceTolerance * edgeStopFactor);
    const adaptiveCrossChromaTolerance = Math.max(8, adaptiveChromaTolerance * edgeStopFactor);

    const queue = new Uint32Array(width * height);
    let head = 0;
    let tail = 0;

    for (let index = 0; index < fillMask.length; index += 1) {
        if (fillMask[index] === 0 || barrierMask[index] !== 0) {
            continue;
        }
        if (clipMask && clipMask[index] === 0) {
            fillMask[index] = 0;
            continue;
        }
        queue[tail] = index;
        tail += 1;
    }

    while (head < tail) {
        const index = queue[head];
        head += 1;

        const x = index % width;
        const y = (index / width) | 0;
        const candidates = [
            x > 0 ? index - 1 : -1,
            x < width - 1 ? index + 1 : -1,
            y > 0 ? index - width : -1,
            y < height - 1 ? index + width : -1,
        ];

        for (const nextIndex of candidates) {
            if (
                nextIndex < 0
                || fillMask[nextIndex] !== 0
                || barrierMask[nextIndex] !== 0
                || (clipMask && clipMask[nextIndex] === 0)
            ) {
                continue;
            }

            const currentOffset = index * 4;
            const currentRed = source[currentOffset];
            const currentGreen = source[currentOffset + 1];
            const currentBlue = source[currentOffset + 2];
            const offset = nextIndex * 4;
            const candidateRed = source[offset];
            const candidateGreen = source[offset + 1];
            const candidateBlue = source[offset + 2];
            const channelDiffMax = Math.max(
                Math.abs(candidateRed - seedProfile.mean[0]),
                Math.abs(candidateGreen - seedProfile.mean[1]),
                Math.abs(candidateBlue - seedProfile.mean[2]),
            );
            const rgbDistance = Math.hypot(
                candidateRed - seedProfile.mean[0],
                candidateGreen - seedProfile.mean[1],
                candidateBlue - seedProfile.mean[2],
            );
            const luminanceDiff = Math.abs(
                rgbToLuminance(candidateRed, candidateGreen, candidateBlue) - seedProfile.meanLuminance,
            );
            const chromaDiff = Math.abs(
                rgbToChroma(candidateRed, candidateGreen, candidateBlue) - seedProfile.meanChroma,
            );

            if (
                channelDiffMax > adaptiveChannelTolerance
                || rgbDistance > adaptiveRgbDistanceTolerance
                || luminanceDiff > adaptiveLuminanceTolerance
                || chromaDiff > adaptiveChromaTolerance
            ) {
                continue;
            }

            if (useEdgeStop) {
                const crossChannelDiffMax = Math.max(
                    Math.abs(candidateRed - currentRed),
                    Math.abs(candidateGreen - currentGreen),
                    Math.abs(candidateBlue - currentBlue),
                );
                const crossRgbDistance = Math.hypot(
                    candidateRed - currentRed,
                    candidateGreen - currentGreen,
                    candidateBlue - currentBlue,
                );
                const crossLuminanceDiff = Math.abs(
                    rgbToLuminance(candidateRed, candidateGreen, candidateBlue)
                    - rgbToLuminance(currentRed, currentGreen, currentBlue),
                );
                const crossChromaDiff = Math.abs(
                    rgbToChroma(candidateRed, candidateGreen, candidateBlue)
                    - rgbToChroma(currentRed, currentGreen, currentBlue),
                );
                if (
                    crossChannelDiffMax > adaptiveCrossChannelTolerance
                    || crossRgbDistance > adaptiveCrossRgbDistanceTolerance
                    || crossLuminanceDiff > adaptiveCrossLuminanceTolerance
                    || crossChromaDiff > adaptiveCrossChromaTolerance
                ) {
                    continue;
                }
            }

            fillMask[nextIndex] = 1;
            queue[tail] = nextIndex;
            tail += 1;
        }
    }

    return fillMask;
};

export const fillMaskInternalHoles = ({
    mask,
    width,
    height,
}: {
    mask: Uint8Array;
    width: number;
    height: number;
}): Uint8Array => {
    const filled = mask.slice();
    if (width <= 0 || height <= 0 || mask.length !== width * height) {
        return filled;
    }

    const outside = new Uint8Array(width * height);
    const queue = new Uint32Array(width * height);
    let head = 0;
    let tail = 0;

    const enqueueOutside = (index: number) => {
        if (mask[index] !== 0 || outside[index] !== 0) {
            return;
        }
        outside[index] = 1;
        queue[tail] = index;
        tail += 1;
    };

    for (let x = 0; x < width; x += 1) {
        enqueueOutside(x);
        enqueueOutside((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
        enqueueOutside(y * width);
        enqueueOutside(y * width + width - 1);
    }

    while (head < tail) {
        const index = queue[head];
        head += 1;
        const x = index % width;
        const y = (index / width) | 0;
        if (x > 0) enqueueOutside(index - 1);
        if (x < width - 1) enqueueOutside(index + 1);
        if (y > 0) enqueueOutside(index - width);
        if (y < height - 1) enqueueOutside(index + width);
    }

    for (let index = 0; index < filled.length; index += 1) {
        if (filled[index] === 0 && outside[index] === 0) {
            filled[index] = 1;
        }
    }

    return filled;
};

export const rasterizePolygonMask = ({
    width,
    height,
    polygon,
}: {
    width: number;
    height: number;
    polygon: readonly (readonly [number, number])[];
}): Uint8Array => {
    const fillMask = new Uint8Array(width * height);
    if (polygon.length < 3 || width <= 0 || height <= 0) {
        return fillMask;
    }

    const minY = Math.max(0, Math.floor(Math.min(...polygon.map(([, y]) => y))));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...polygon.map(([, y]) => y))));

    for (let y = minY; y <= maxY; y += 1) {
        const scanY = y + 0.5;
        const intersections: number[] = [];
        for (let index = 0; index < polygon.length; index += 1) {
            const [x1, y1] = polygon[index];
            const [x2, y2] = polygon[(index + 1) % polygon.length];
            if ((y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY)) {
                intersections.push(x1 + (((scanY - y1) / (y2 - y1)) * (x2 - x1)));
            }
        }
        intersections.sort((a, b) => a - b);
        for (let pairIndex = 0; pairIndex + 1 < intersections.length; pairIndex += 2) {
            const left = Math.max(0, Math.floor(intersections[pairIndex]));
            const right = Math.min(width - 1, Math.ceil(intersections[pairIndex + 1]) - 1);
            for (let x = left; x <= right; x += 1) {
                fillMask[y * width + x] = 1;
            }
        }
    }

    return fillMask;
};

export const rasterizeStrokeMask = ({
    width,
    height,
    points,
    radius,
}: {
    width: number;
    height: number;
    points: readonly (readonly [number, number])[];
    radius: number;
}): Uint8Array => {
    const mask = new Uint8Array(width * height);
    if (width <= 0 || height <= 0 || points.length === 0 || radius <= 0) {
        return mask;
    }

    const paintCircle = (centerX: number, centerY: number) => {
        const left = Math.max(0, Math.floor(centerX - radius));
        const right = Math.min(width - 1, Math.ceil(centerX + radius));
        const top = Math.max(0, Math.floor(centerY - radius));
        const bottom = Math.min(height - 1, Math.ceil(centerY + radius));
        const radiusSquared = radius * radius;

        for (let y = top; y <= bottom; y += 1) {
            for (let x = left; x <= right; x += 1) {
                const dx = x - centerX;
                const dy = y - centerY;
                if ((dx * dx) + (dy * dy) <= radiusSquared) {
                    mask[y * width + x] = 1;
                }
            }
        }
    };

    for (let index = 0; index < points.length; index += 1) {
        const [x, y] = points[index];
        const previous = points[index - 1];
        if (!previous) {
            paintCircle(x, y);
            continue;
        }

        const [previousX, previousY] = previous;
        const distance = Math.hypot(x - previousX, y - previousY);
        const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.55)));
        for (let step = 0; step <= steps; step += 1) {
            const t = step / steps;
            paintCircle(
                previousX + ((x - previousX) * t),
                previousY + ((y - previousY) * t),
            );
        }
    }

    return mask;
};

export const getRegionComponentSummary = ({
    assignments,
    width,
    regionIndex,
}: {
    assignments: Int16Array;
    width: number;
    regionIndex: number;
}): RegionComponentSummary => {
    const height = width > 0 ? Math.floor(assignments.length / width) : 0;
    const visited = new Uint8Array(assignments.length);
    const queue = new Uint32Array(assignments.length);
    let componentCount = 0;
    let largestPixelCount = 0;
    let totalPixelCount = 0;

    for (let startIndex = 0; startIndex < assignments.length; startIndex += 1) {
        if (assignments[startIndex] !== regionIndex) {
            continue;
        }
        totalPixelCount += 1;
        if (visited[startIndex] !== 0) {
            continue;
        }

        componentCount += 1;
        let pixelCount = 0;
        let head = 0;
        let tail = 0;
        visited[startIndex] = 1;
        queue[tail] = startIndex;
        tail += 1;

        while (head < tail) {
            const index = queue[head];
            head += 1;
            pixelCount += 1;
            const x = index % width;
            const y = (index / width) | 0;
            const candidates = [
                x > 0 ? index - 1 : -1,
                x < width - 1 ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y < height - 1 ? index + width : -1,
            ];

            for (const nextIndex of candidates) {
                if (
                    nextIndex < 0
                    || visited[nextIndex] !== 0
                    || assignments[nextIndex] !== regionIndex
                ) {
                    continue;
                }
                visited[nextIndex] = 1;
                queue[tail] = nextIndex;
                tail += 1;
            }
        }

        largestPixelCount = Math.max(largestPixelCount, pixelCount);
    }

    return { componentCount, largestPixelCount, totalPixelCount };
};

export const sampleRegionBoundaryPoints = ({
    assignments,
    width,
    regionIndex,
    maxPoints = 240,
}: {
    assignments: Int16Array;
    width: number;
    regionIndex: number;
    maxPoints?: number;
}): Array<{ x: number; y: number }> => {
    const height = width > 0 ? Math.floor(assignments.length / width) : 0;
    const boundaryPoints: Array<{ x: number; y: number }> = [];

    for (let index = 0; index < assignments.length; index += 1) {
        if (assignments[index] !== regionIndex) {
            continue;
        }
        const x = index % width;
        const y = (index / width) | 0;
        const touchesOutside = (
            x === 0
            || x === width - 1
            || y === 0
            || y === height - 1
            || assignments[index - 1] !== regionIndex
            || assignments[index + 1] !== regionIndex
            || assignments[index - width] !== regionIndex
            || assignments[index + width] !== regionIndex
        );
        if (touchesOutside) {
            boundaryPoints.push({ x, y });
        }
    }

    if (boundaryPoints.length <= maxPoints) {
        return boundaryPoints;
    }

    const stride = Math.ceil(boundaryPoints.length / maxPoints);
    return boundaryPoints.filter((_, index) => index % stride === 0).slice(0, maxPoints);
};

export const applyBrushToAssignments = ({
    assignments,
    width,
    height,
    centerX,
    centerY,
    radius,
    regionIndex,
}: {
    assignments: Int16Array;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    radius: number;
    regionIndex: number;
}): PixelBounds | null => {
    const left = Math.max(0, Math.floor(centerX - radius));
    const right = Math.min(width - 1, Math.ceil(centerX + radius));
    const top = Math.max(0, Math.floor(centerY - radius));
    const bottom = Math.min(height - 1, Math.ceil(centerY + radius));
    const radiusSquared = radius * radius;

    let changed = false;

    for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
            const dx = x - centerX;
            const dy = y - centerY;
            if ((dx * dx) + (dy * dy) > radiusSquared) {
                continue;
            }
            const index = y * width + x;
            if (assignments[index] === regionIndex) {
                continue;
            }
            assignments[index] = regionIndex;
            changed = true;
        }
    }

    return changed ? { left, right, top, bottom } : null;
};

export const applyBrushToBinaryMask = ({
    mask,
    width,
    height,
    centerX,
    centerY,
    radius,
    value,
}: {
    mask: Uint8Array;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    radius: number;
    value: 0 | 1;
}): PixelBounds | null => {
    const left = Math.max(0, Math.floor(centerX - radius));
    const right = Math.min(width - 1, Math.ceil(centerX + radius));
    const top = Math.max(0, Math.floor(centerY - radius));
    const bottom = Math.min(height - 1, Math.ceil(centerY + radius));
    const radiusSquared = radius * radius;

    let changed = false;

    for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
            const dx = x - centerX;
            const dy = y - centerY;
            if ((dx * dx) + (dy * dy) > radiusSquared) {
                continue;
            }
            const index = y * width + x;
            if (mask[index] === value) {
                continue;
            }
            mask[index] = value;
            changed = true;
        }
    }

    return changed ? { left, right, top, bottom } : null;
};

export const replaceRegionWithSelection = ({
    assignments,
    selectionMask,
    regionIndex,
}: {
    assignments: Int16Array;
    selectionMask: Uint8Array;
    regionIndex: number;
}): boolean => {
    let changed = false;

    for (let index = 0; index < assignments.length; index += 1) {
        if (assignments[index] === regionIndex && selectionMask[index] === 0) {
            assignments[index] = EMPTY_REGION;
            changed = true;
        }
    }

    for (let index = 0; index < selectionMask.length; index += 1) {
        if (selectionMask[index] === 0 || assignments[index] === regionIndex) {
            continue;
        }
        assignments[index] = regionIndex;
        changed = true;
    }

    return changed;
};

export const buildMaskPixelBuffer = ({
    assignments,
    palette,
    width,
    height,
}: {
    assignments: Int16Array;
    palette: readonly RgbColor[];
    width: number;
    height: number;
}): Uint8ClampedArray => {
    const pixelBuffer = new Uint8ClampedArray(width * height * 4);

    for (let index = 0; index < assignments.length; index += 1) {
        const assignment = assignments[index];
        if (assignment < 0 || assignment >= palette.length) {
            continue;
        }
        const color = palette[assignment];
        const offset = index * 4;
        pixelBuffer[offset] = color[0];
        pixelBuffer[offset + 1] = color[1];
        pixelBuffer[offset + 2] = color[2];
        pixelBuffer[offset + 3] = 255;
    }

    return pixelBuffer;
};

export const buildRegionOutlinePixelBuffer = ({
    assignments,
    width,
    height,
    regionIndex,
    color,
    thickness = 1,
    alpha = 255,
}: {
    assignments: Int16Array;
    width: number;
    height: number;
    regionIndex: number;
    color: RgbColor;
    thickness?: number;
    alpha?: number;
}): Uint8ClampedArray => {
    const pixelBuffer = new Uint8ClampedArray(width * height * 4);
    const radius = Math.max(1, Math.round(thickness));

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let touchesRegion = false;
            let touchesNonRegion = false;

            for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
                const nextY = y + offsetY;
                if (nextY < 0 || nextY >= height) {
                    touchesNonRegion = true;
                    continue;
                }
                for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
                    if ((offsetX * offsetX) + (offsetY * offsetY) > radius * radius) {
                        continue;
                    }
                    const nextX = x + offsetX;
                    if (nextX < 0 || nextX >= width) {
                        touchesNonRegion = true;
                        continue;
                    }
                    if (assignments[nextY * width + nextX] === regionIndex) {
                        touchesRegion = true;
                    } else {
                        touchesNonRegion = true;
                    }
                    if (touchesRegion && touchesNonRegion) {
                        break;
                    }
                }
                if (touchesRegion && touchesNonRegion) {
                    break;
                }
            }

            if (!touchesRegion || !touchesNonRegion) {
                continue;
            }

            const offset = (y * width + x) * 4;
            pixelBuffer[offset] = color[0];
            pixelBuffer[offset + 1] = color[1];
            pixelBuffer[offset + 2] = color[2];
            pixelBuffer[offset + 3] = alpha;
        }
    }

    return pixelBuffer;
};

export const buildRegionOuterGlowPixelBuffer = ({
    assignments,
    width,
    height,
    regionIndex,
    color,
    thickness,
    alpha,
}: {
    assignments: Int16Array;
    width: number;
    height: number;
    regionIndex: number;
    color: RgbColor;
    thickness: number;
    alpha: number;
}): Uint8ClampedArray => {
    const pixelBuffer = new Uint8ClampedArray(width * height * 4);
    const radius = Math.max(1, Math.round(thickness));

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            if (assignments[index] === regionIndex) {
                continue;
            }

            let nearRegion = false;
            for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
                const nextY = y + offsetY;
                if (nextY < 0 || nextY >= height) {
                    continue;
                }
                for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
                    if ((offsetX * offsetX) + (offsetY * offsetY) > radius * radius) {
                        continue;
                    }
                    const nextX = x + offsetX;
                    if (nextX < 0 || nextX >= width) {
                        continue;
                    }
                    if (assignments[nextY * width + nextX] === regionIndex) {
                        nearRegion = true;
                        break;
                    }
                }
                if (nearRegion) {
                    break;
                }
            }

            if (!nearRegion) {
                continue;
            }

            const offset = index * 4;
            pixelBuffer[offset] = color[0];
            pixelBuffer[offset + 1] = color[1];
            pixelBuffer[offset + 2] = color[2];
            pixelBuffer[offset + 3] = alpha;
        }
    }

    return pixelBuffer;
};

export const computeRegionCenters = ({
    assignments,
    width,
    regionCount,
}: {
    assignments: Int16Array;
    width: number;
    regionCount: number;
}): RegionCenter[] => {
    const sums = Array.from({ length: regionCount }, () => ({
        x: 0,
        y: 0,
        pixelCount: 0,
    }));
    if (width <= 0) {
        return [];
    }

    for (let index = 0; index < assignments.length; index += 1) {
        const regionIndex = assignments[index];
        if (regionIndex < 0 || regionIndex >= regionCount) {
            continue;
        }
        const sum = sums[regionIndex];
        sum.x += index % width;
        sum.y += Math.floor(index / width);
        sum.pixelCount += 1;
    }

    return sums
        .map((sum, regionIndex) => (
            sum.pixelCount > 0
                ? {
                    regionIndex,
                    x: Math.round(sum.x / sum.pixelCount),
                    y: Math.round(sum.y / sum.pixelCount),
                    pixelCount: sum.pixelCount,
                }
                : null
        ))
        .filter((center): center is RegionCenter => center != null);
};

export const buildBarrierOverlayPixelBuffer = ({
    barrierMask,
    width,
    height,
}: {
    barrierMask: Uint8Array;
    width: number;
    height: number;
}): Uint8ClampedArray => {
    const pixelBuffer = new Uint8ClampedArray(width * height * 4);

    for (let index = 0; index < barrierMask.length; index += 1) {
        if (barrierMask[index] === 0) {
            continue;
        }
        const offset = index * 4;
        pixelBuffer[offset] = 56;
        pixelBuffer[offset + 1] = 189;
        pixelBuffer[offset + 2] = 248;
        pixelBuffer[offset + 3] = 170;
    }

    return pixelBuffer;
};
