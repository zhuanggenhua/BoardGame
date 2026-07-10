import { QIDAHEN_REGION_ID_BY_MASK_COLOR, qidahenRegionColorKey } from './mapGraph';

type OverlayRgba = readonly [number, number, number, number];

export type RegionMaskOverlayToneKey =
    | 'selected'
    | 'source'
    | 'dispatch'
    | 'activeDispatch'
    | 'hovered'
    | 'pending'
    | 'ming'
    | 'mongol'
    | 'jin'
    | 'neutral';

type RegionMaskOverlayToneConfig = {
    fill: OverlayRgba;
    stroke: OverlayRgba;
    innerStrokeRadius?: number;
    outerFill?: OverlayRgba;
    outerFillRadius?: number;
    outerStroke?: OverlayRgba;
    outerStrokeRadius?: number;
    outerGlow?: OverlayRgba;
    outerGlowRadius?: number;
};

export const REGION_MASK_OVERLAY_TONES: Record<RegionMaskOverlayToneKey, RegionMaskOverlayToneConfig> = {
    ming: {
        fill: [159, 52, 38, 28],
        stroke: [159, 52, 38, 74],
    },
    mongol: {
        fill: [105, 88, 44, 28],
        stroke: [125, 107, 58, 70],
    },
    jin: {
        fill: [71, 88, 128, 26],
        stroke: [86, 103, 146, 68],
    },
    neutral: {
        fill: [116, 100, 76, 22],
        stroke: [126, 111, 92, 56],
    },
    selected: {
        fill: [182, 53, 39, 86],
        stroke: [159, 52, 38, 244],
        innerStrokeRadius: 1,
        outerFill: [182, 53, 39, 44],
        outerFillRadius: 3,
        outerStroke: [216, 118, 92, 228],
        outerStrokeRadius: 4,
        outerGlow: [159, 52, 38, 74],
        outerGlowRadius: 7,
    },
    source: {
        fill: [215, 168, 77, 72],
        stroke: [255, 228, 155, 238],
        innerStrokeRadius: 1,
        outerFill: [215, 168, 77, 38],
        outerFillRadius: 2,
        outerGlow: [255, 216, 126, 56],
        outerGlowRadius: 5,
    },
    dispatch: {
        fill: [46, 166, 82, 58],
        stroke: [238, 255, 226, 252],
        innerStrokeRadius: 2,
        outerFill: [46, 166, 82, 46],
        outerFillRadius: 4,
        outerStroke: [161, 246, 170, 244],
        outerStrokeRadius: 5,
        outerGlow: [86, 214, 118, 92],
        outerGlowRadius: 9,
    },
    activeDispatch: {
        fill: [80, 206, 105, 76],
        stroke: [248, 255, 226, 255],
        innerStrokeRadius: 2,
        outerFill: [80, 206, 105, 58],
        outerFillRadius: 5,
        outerStroke: [206, 255, 190, 255],
        outerStrokeRadius: 7,
        outerGlow: [112, 238, 124, 132],
        outerGlowRadius: 12,
    },
    hovered: {
        fill: [238, 190, 94, 82],
        stroke: [255, 230, 157, 226],
    },
    pending: {
        fill: [184, 59, 39, 62],
        stroke: [184, 59, 39, 210],
    },
};

const ENABLE_CENTERED_SELECTED_OUTLINE = true;

const readMaskRegionIdAt = (
    hitmap: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number,
): string | null => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
        return null;
    }
    const offset = (y * width + x) * 4;
    if (hitmap[offset + 3] === 0) {
        return null;
    }
    const colorKey = qidahenRegionColorKey(hitmap[offset], hitmap[offset + 1], hitmap[offset + 2]);
    return QIDAHEN_REGION_ID_BY_MASK_COLOR[colorKey] ?? null;
};

const readOwnershipRegionIdAt = (
    regionIdByPixel: readonly (string | null)[],
    width: number,
    height: number,
    x: number,
    y: number,
): string | null => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
        return null;
    }
    return regionIdByPixel[(y * width) + x] ?? null;
};

const touchesOtherRegionWithinRadius = (
    hitmap: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number,
    regionId: string,
    radius: number,
): boolean => {
    if (radius <= 1) {
        return (
            readMaskRegionIdAt(hitmap, width, height, x - 1, y) !== regionId
            || readMaskRegionIdAt(hitmap, width, height, x + 1, y) !== regionId
            || readMaskRegionIdAt(hitmap, width, height, x, y - 1) !== regionId
            || readMaskRegionIdAt(hitmap, width, height, x, y + 1) !== regionId
        );
    }

    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const nextY = y + offsetY;
        if (nextY < 0 || nextY >= height) {
            return true;
        }
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            if ((offsetX * offsetX) + (offsetY * offsetY) > radius * radius) {
                continue;
            }
            const nextX = x + offsetX;
            if (nextX < 0 || nextX >= width) {
                return true;
            }
            if (readMaskRegionIdAt(hitmap, width, height, nextX, nextY) !== regionId) {
                return true;
            }
        }
    }

    return false;
};

const touchesOtherOwnershipRegionWithinRadius = (
    regionIdByPixel: readonly (string | null)[],
    width: number,
    height: number,
    x: number,
    y: number,
    regionId: string,
    radius: number,
): boolean => {
    if (radius <= 1) {
        return (
            readOwnershipRegionIdAt(regionIdByPixel, width, height, x - 1, y) !== regionId
            || readOwnershipRegionIdAt(regionIdByPixel, width, height, x + 1, y) !== regionId
            || readOwnershipRegionIdAt(regionIdByPixel, width, height, x, y - 1) !== regionId
            || readOwnershipRegionIdAt(regionIdByPixel, width, height, x, y + 1) !== regionId
        );
    }

    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const nextY = y + offsetY;
        if (nextY < 0 || nextY >= height) {
            return true;
        }
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            if ((offsetX * offsetX) + (offsetY * offsetY) > radius * radius) {
                continue;
            }
            const nextX = x + offsetX;
            if (nextX < 0 || nextX >= width) {
                return true;
            }
            if (readOwnershipRegionIdAt(regionIdByPixel, width, height, nextX, nextY) !== regionId) {
                return true;
            }
        }
    }

    return false;
};

const blendPixel = (
    pixels: Uint8ClampedArray,
    offset: number,
    color: OverlayRgba,
) => {
    const sourceAlpha = color[3] / 255;
    if (sourceAlpha <= 0) {
        return;
    }

    const destinationAlpha = pixels[offset + 3] / 255;
    const outAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
    if (outAlpha <= 0) {
        return;
    }

    const blendChannel = (source: number, destination: number) => (
        ((source * sourceAlpha) + (destination * destinationAlpha * (1 - sourceAlpha))) / outAlpha
    );

    pixels[offset] = Math.round(blendChannel(color[0], pixels[offset]));
    pixels[offset + 1] = Math.round(blendChannel(color[1], pixels[offset + 1]));
    pixels[offset + 2] = Math.round(blendChannel(color[2], pixels[offset + 2]));
    pixels[offset + 3] = Math.round(outAlpha * 255);
};

const pixelIsNearMask = (
    mask: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    radius: number,
): boolean => {
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
            if (mask[(nextY * width) + nextX] !== 0) {
                return true;
            }
        }
    }
    return false;
};

const selectedPixelTouchesOutsideMask = (
    selectedMask: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    radius: number,
) => {
    if (selectedMask[(y * width) + x] === 0) {
        return false;
    }

    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const nextY = y + offsetY;
        if (nextY < 0 || nextY >= height) {
            return true;
        }
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            if ((offsetX * offsetX) + (offsetY * offsetY) > radius * radius) {
                continue;
            }
            const nextX = x + offsetX;
            if (nextX < 0 || nextX >= width) {
                return true;
            }
            if (selectedMask[(nextY * width) + nextX] === 0) {
                return true;
            }
        }
    }

    return false;
};

const getSelectedOutlineBounds = (
    width: number,
    height: number,
    bounds: { left: number; top: number; right: number; bottom: number },
) => {
    const selectedTone = REGION_MASK_OVERLAY_TONES.selected;
    const maxRadius = Math.max(
        selectedTone.outerFillRadius ?? 0,
        selectedTone.outerStrokeRadius ?? 0,
        selectedTone.outerGlowRadius ?? 0,
    );
    return {
        maxRadius,
        left: Math.max(0, bounds.left - maxRadius),
        top: Math.max(0, bounds.top - maxRadius),
        right: Math.min(width - 1, bounds.right + maxRadius),
        bottom: Math.min(height - 1, bounds.bottom + maxRadius),
    };
};

const applyLegacySelectedHalo = (
    pixels: Uint8ClampedArray,
    selectedMask: Uint8Array,
    width: number,
    height: number,
    bounds: { left: number; top: number; right: number; bottom: number },
) => {
    const selectedTone = REGION_MASK_OVERLAY_TONES.selected;
    const outlineBounds = getSelectedOutlineBounds(width, height, bounds);
    if (outlineBounds.maxRadius <= 0) {
        return;
    }

    for (let y = outlineBounds.top; y <= outlineBounds.bottom; y += 1) {
        for (let x = outlineBounds.left; x <= outlineBounds.right; x += 1) {
            const index = (y * width) + x;
            if (selectedMask[index] !== 0) {
                continue;
            }

            const offset = index * 4;
            if (
                selectedTone.outerFill
                && selectedTone.outerFillRadius
                && pixelIsNearMask(selectedMask, width, height, x, y, selectedTone.outerFillRadius)
            ) {
                blendPixel(pixels, offset, selectedTone.outerFill);
            }
            if (
                selectedTone.outerGlow
                && selectedTone.outerGlowRadius
                && pixelIsNearMask(selectedMask, width, height, x, y, selectedTone.outerGlowRadius)
            ) {
                blendPixel(pixels, offset, selectedTone.outerGlow);
            }
            if (
                selectedTone.outerStroke
                && selectedTone.outerStrokeRadius
                && pixelIsNearMask(selectedMask, width, height, x, y, selectedTone.outerStrokeRadius)
            ) {
                blendPixel(pixels, offset, selectedTone.outerStroke);
            }
        }
    }
};

const applyCenteredSelectedOutline = (
    pixels: Uint8ClampedArray,
    selectedMask: Uint8Array,
    width: number,
    height: number,
    bounds: { left: number; top: number; right: number; bottom: number },
) => {
    const selectedTone = REGION_MASK_OVERLAY_TONES.selected;
    const outlineBounds = getSelectedOutlineBounds(width, height, bounds);
    if (outlineBounds.maxRadius <= 0) {
        return;
    }

    const innerStrokeRadius = Math.max(1, selectedTone.innerStrokeRadius ?? 1);

    for (let y = outlineBounds.top; y <= outlineBounds.bottom; y += 1) {
        for (let x = outlineBounds.left; x <= outlineBounds.right; x += 1) {
            const index = (y * width) + x;
            const offset = index * 4;
            if (selectedMask[index] !== 0) {
                if (selectedPixelTouchesOutsideMask(selectedMask, width, height, x, y, innerStrokeRadius)) {
                    blendPixel(pixels, offset, selectedTone.stroke);
                }
                continue;
            }

            if (
                selectedTone.outerFill
                && selectedTone.outerFillRadius
                && pixelIsNearMask(selectedMask, width, height, x, y, selectedTone.outerFillRadius)
            ) {
                blendPixel(pixels, offset, selectedTone.outerFill);
            }
            if (
                selectedTone.outerGlow
                && selectedTone.outerGlowRadius
                && pixelIsNearMask(selectedMask, width, height, x, y, selectedTone.outerGlowRadius)
            ) {
                blendPixel(pixels, offset, selectedTone.outerGlow);
            }
            if (
                selectedTone.outerStroke
                && selectedTone.outerStrokeRadius
                && pixelIsNearMask(selectedMask, width, height, x, y, selectedTone.outerStrokeRadius)
            ) {
                blendPixel(pixels, offset, selectedTone.outerStroke);
            }
        }
    }
};

const applySelectedHalo = (
    pixels: Uint8ClampedArray,
    selectedMask: Uint8Array,
    width: number,
    height: number,
    bounds: { left: number; top: number; right: number; bottom: number },
) => {
    if (ENABLE_CENTERED_SELECTED_OUTLINE) {
        applyCenteredSelectedOutline(pixels, selectedMask, width, height, bounds);
        return;
    }
    applyLegacySelectedHalo(pixels, selectedMask, width, height, bounds);
};

export const buildRegionMaskOverlayPixels = (
    hitmap: Uint8ClampedArray,
    width: number,
    height: number,
    toneByRegionId: Map<string, RegionMaskOverlayToneKey>,
): Uint8ClampedArray => {
    const pixels = new Uint8ClampedArray(width * height * 4);
    const selectedMask = new Uint8Array(width * height);
    const selectedBounds = {
        left: width,
        top: height,
        right: -1,
        bottom: -1,
    };

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const regionId = readMaskRegionIdAt(hitmap, width, height, x, y);
            if (!regionId) {
                continue;
            }
            const toneKey = toneByRegionId.get(regionId);
            if (!toneKey) {
                continue;
            }

            const tone = REGION_MASK_OVERLAY_TONES[toneKey];
            const offset = (y * width + x) * 4;
            if (toneKey === 'selected') {
                pixels[offset] = tone.fill[0];
                pixels[offset + 1] = tone.fill[1];
                pixels[offset + 2] = tone.fill[2];
                pixels[offset + 3] = tone.fill[3];
                selectedMask[(y * width) + x] = 1;
                selectedBounds.left = Math.min(selectedBounds.left, x);
                selectedBounds.top = Math.min(selectedBounds.top, y);
                selectedBounds.right = Math.max(selectedBounds.right, x);
                selectedBounds.bottom = Math.max(selectedBounds.bottom, y);
                continue;
            }

            const innerStrokeRadius = Math.max(1, tone.innerStrokeRadius ?? 1);
            const isBorder = touchesOtherRegionWithinRadius(hitmap, width, height, x, y, regionId, innerStrokeRadius);
            const color = isBorder ? tone.stroke : tone.fill;
            pixels[offset] = color[0];
            pixels[offset + 1] = color[1];
            pixels[offset + 2] = color[2];
            pixels[offset + 3] = color[3];
        }
    }

    if (selectedBounds.right >= 0) {
        applySelectedHalo(pixels, selectedMask, width, height, selectedBounds);
    }

    return pixels;
};

export const buildRegionOwnershipOverlayPixels = (
    regionIdByPixel: readonly (string | null)[],
    width: number,
    height: number,
    toneByRegionId: Map<string, RegionMaskOverlayToneKey>,
): Uint8ClampedArray => {
    const pixels = new Uint8ClampedArray(width * height * 4);
    const selectedMask = new Uint8Array(width * height);
    const selectedBounds = {
        left: width,
        top: height,
        right: -1,
        bottom: -1,
    };

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const regionId = readOwnershipRegionIdAt(regionIdByPixel, width, height, x, y);
            if (!regionId) {
                continue;
            }
            const toneKey = toneByRegionId.get(regionId);
            if (!toneKey) {
                continue;
            }

            const tone = REGION_MASK_OVERLAY_TONES[toneKey];
            const offset = (y * width + x) * 4;
            if (toneKey === 'selected') {
                pixels[offset] = tone.fill[0];
                pixels[offset + 1] = tone.fill[1];
                pixels[offset + 2] = tone.fill[2];
                pixels[offset + 3] = tone.fill[3];
                selectedMask[(y * width) + x] = 1;
                selectedBounds.left = Math.min(selectedBounds.left, x);
                selectedBounds.top = Math.min(selectedBounds.top, y);
                selectedBounds.right = Math.max(selectedBounds.right, x);
                selectedBounds.bottom = Math.max(selectedBounds.bottom, y);
                continue;
            }

            const innerStrokeRadius = Math.max(1, tone.innerStrokeRadius ?? 1);
            const isBorder = touchesOtherOwnershipRegionWithinRadius(regionIdByPixel, width, height, x, y, regionId, innerStrokeRadius);
            const color = isBorder ? tone.stroke : tone.fill;
            pixels[offset] = color[0];
            pixels[offset + 1] = color[1];
            pixels[offset + 2] = color[2];
            pixels[offset + 3] = color[3];
        }
    }

    if (selectedBounds.right >= 0) {
        applySelectedHalo(pixels, selectedMask, width, height, selectedBounds);
    }

    return pixels;
};

export const renderRegionMaskOverlay = (
    canvas: HTMLCanvasElement,
    hitmap: Uint8ClampedArray,
    width: number,
    height: number,
    toneByRegionId: Map<string, RegionMaskOverlayToneKey>,
) => {
    const context = canvas.getContext('2d');
    if (!context) {
        return;
    }

    const image = context.createImageData(width, height);
    image.data.set(buildRegionMaskOverlayPixels(hitmap, width, height, toneByRegionId));
    context.clearRect(0, 0, width, height);
    context.putImageData(image, 0, 0);
};

export const renderRegionOwnershipOverlay = (
    canvas: HTMLCanvasElement,
    regionIdByPixel: readonly (string | null)[],
    width: number,
    height: number,
    toneByRegionId: Map<string, RegionMaskOverlayToneKey>,
) => {
    const context = canvas.getContext('2d');
    if (!context) {
        return;
    }

    const image = context.createImageData(width, height);
    image.data.set(buildRegionOwnershipOverlayPixels(regionIdByPixel, width, height, toneByRegionId));
    context.clearRect(0, 0, width, height);
    context.putImageData(image, 0, 0);
};
