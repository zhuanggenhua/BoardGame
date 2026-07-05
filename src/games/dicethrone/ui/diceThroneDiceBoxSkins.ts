// @asset-pipeline-allow
// 骰子盒皮肤在受控 canvas 流程中把已解析图片转成 Three.js 贴图输入。
import {
    DICE_ATLAS,
    getDiceSpriteAssetPath,
    resolveCharacterIdFromDiceDefinitionId,
    resolveSpriteAssetUrls,
} from './assets';

export interface DiceThroneDiceBoxSkin {
    id: string;
    definitionId?: string;
    faceCanvases: Record<number, HTMLCanvasElement>;
    edgeCanvas: HTMLCanvasElement;
    faceImages: Record<number, HTMLImageElement>;
    preferPresetMaterials: true;
}

const DICE_BOX_FACE_ART_SCALE = 0.66;
const DICE_BOX_ATLAS_FACE_VALUES = [1, 2, 3, 4, 5, 6] as const;
const DICE_FACE_BACKGROUND_RGB = { r: 224, g: 215, b: 178 };
const DICE_BOX_NUMBER_ERASE_PADDING = 0.035;
const DICE_BOX_BACKGROUND_DISTANCE_TOLERANCE = 34;
const TRANSPARENT_PIXEL_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

type SpriteComponentBounds = {
    area: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

type RgbColor = {
    r: number;
    g: number;
    b: number;
};

const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
) => {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
};

const drawDieFaceBase = (ctx: CanvasRenderingContext2D, size: number) => {
    const radius = size * 0.15;

    ctx.save();
    drawRoundedRect(ctx, 0, 0, size, size, radius);
    ctx.clip();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    ctx.restore();

    const edge = ctx.createLinearGradient(0, 0, size, size);
    edge.addColorStop(0, 'rgba(255,255,255,0.42)');
    edge.addColorStop(0.5, 'rgba(255,255,255,0.04)');
    edge.addColorStop(1, 'rgba(70,70,70,0.08)');
    ctx.strokeStyle = edge;
    ctx.lineWidth = size * 0.018;
    drawRoundedRect(ctx, size * 0.01, size * 0.01, size - size * 0.02, size - size * 0.02, radius);
    ctx.stroke();
};

const loadImageFromCandidates = (urls: string[]): Promise<HTMLImageElement | null> => new Promise((resolve) => {
    const candidates = urls.filter(Boolean);
    let index = 0;

    const loadNext = () => {
        const src = candidates[index];
        if (!src) {
            resolve(null);
            return;
        }

        index += 1;
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = loadNext;
        image.src = src;
    };

    loadNext();
});

const createEdgeCanvas = () => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const radius = size * 0.15;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, 0, 0, size, size, radius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(70,70,70,0.08)';
    ctx.lineWidth = size * 0.018;
    drawRoundedRect(ctx, size * 0.01, size * 0.01, size - size * 0.02, size - size * 0.02, radius);
    ctx.stroke();

    return canvas;
};

const colorDistance = (r: number, g: number, b: number, color: RgbColor) => Math.hypot(
    r - color.r,
    g - color.g,
    b - color.b,
);

const readPixel = (data: Uint8ClampedArray, width: number, x: number, y: number): RgbColor | null => {
    const offset = (y * width + x) * 4;
    const alpha = data[offset + 3] ?? 0;
    if (alpha <= 16) return null;
    return {
        r: data[offset] ?? 0,
        g: data[offset + 1] ?? 0,
        b: data[offset + 2] ?? 0,
    };
};

const estimateFaceBackgroundColor = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
): RgbColor => {
    const samplePoints = [
        [0.08, 0.08],
        [0.5, 0.08],
        [0.92, 0.08],
        [0.08, 0.5],
        [0.92, 0.5],
        [0.08, 0.92],
        [0.5, 0.92],
        [0.92, 0.92],
    ];
    const colors = samplePoints
        .map(([xRatio, yRatio]) => readPixel(
            data,
            width,
            Math.min(width - 1, Math.max(0, Math.round((width - 1) * xRatio))),
            Math.min(height - 1, Math.max(0, Math.round((height - 1) * yRatio))),
        ))
        .filter((color): color is RgbColor => Boolean(color));

    if (colors.length === 0) return DICE_FACE_BACKGROUND_RGB;

    const sortedByReference = [...colors].sort((a, b) => (
        colorDistance(a.r, a.g, a.b, DICE_FACE_BACKGROUND_RGB)
        - colorDistance(b.r, b.g, b.b, DICE_FACE_BACKGROUND_RGB)
    ));
    const usable = sortedByReference.slice(0, Math.max(3, Math.ceil(sortedByReference.length * 0.65)));

    return {
        r: Math.round(usable.reduce((sum, color) => sum + color.r, 0) / usable.length),
        g: Math.round(usable.reduce((sum, color) => sum + color.g, 0) / usable.length),
        b: Math.round(usable.reduce((sum, color) => sum + color.b, 0) / usable.length),
    };
};

const isResidualAtlasFaceBackgroundPixel = (
    r: number,
    g: number,
    b: number,
    alpha: number,
    backgroundColor: RgbColor,
) => {
    if (alpha < 16) return true;
    return colorDistance(r, g, b, backgroundColor) <= DICE_BOX_BACKGROUND_DISTANCE_TOLERANCE;
};

const isVisibleSpritePixel = (data: Uint8ClampedArray, width: number, x: number, y: number) => {
    const offset = (y * width + x) * 4;
    const alpha = data[offset + 3] ?? 0;
    return alpha >= 16;
};

const extractSpriteComponents = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
) => {
    const visited = new Uint8Array(width * height);
    const components: SpriteComponentBounds[] = [];
    const queue: number[] = [];

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const startIndex = y * width + x;
            if (visited[startIndex] || !isVisibleSpritePixel(data, width, x, y)) {
                visited[startIndex] = 1;
                continue;
            }

            let area = 0;
            let minX = x;
            let minY = y;
            let maxX = x;
            let maxY = y;
            queue.length = 0;
            queue.push(startIndex);
            visited[startIndex] = 1;

            for (let cursor = 0; cursor < queue.length; cursor += 1) {
                const index = queue[cursor] ?? 0;
                const cx = index % width;
                const cy = Math.floor(index / width);
                area += 1;
                minX = Math.min(minX, cx);
                minY = Math.min(minY, cy);
                maxX = Math.max(maxX, cx);
                maxY = Math.max(maxY, cy);

                const neighbors = [
                    index - 1,
                    index + 1,
                    index - width,
                    index + width,
                ];
                for (const neighbor of neighbors) {
                    if (neighbor < 0 || neighbor >= visited.length || visited[neighbor]) continue;
                    const nx = neighbor % width;
                    const ny = Math.floor(neighbor / width);
                    if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
                    visited[neighbor] = 1;
                    if (isVisibleSpritePixel(data, width, nx, ny)) {
                        queue.push(neighbor);
                    }
                }
            }

            if (area > 20) {
                components.push({ area, minX, minY, maxX, maxY });
            }
        }
    }

    return components;
};

const isAtlasNumberComponent = (
    faceValue: number,
    bounds: SpriteComponentBounds,
    width: number,
    height: number,
) => {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const componentWidth = bounds.maxX - bounds.minX + 1;
    const componentHeight = bounds.maxY - bounds.minY + 1;
    const isTopLeftNumber = centerX < width * 0.42 && centerY < height * 0.5;
    const isBottomRightNumber = centerX > width * 0.58 && centerY > height * 0.55;
    const isNarrowDigit = componentWidth < width * 0.34 || componentHeight < height * 0.42;

    if (faceValue === 1 || faceValue === 6) {
        return isBottomRightNumber && isNarrowDigit;
    }
    return isTopLeftNumber && isNarrowDigit;
};

const eraseAtlasPrintedNumber = (
    ctx: CanvasRenderingContext2D,
    faceValue: number,
    size: number,
) => {
    const padding = size * DICE_BOX_NUMBER_ERASE_PADDING;
    const fillNumberArea = (x: number, y: number, width: number, height: number) => {
        ctx.save();
        ctx.fillStyle = `rgb(${DICE_FACE_BACKGROUND_RGB.r}, ${DICE_FACE_BACKGROUND_RGB.g}, ${DICE_FACE_BACKGROUND_RGB.b})`;
        ctx.fillRect(x - padding, y - padding, width + padding * 2, height + padding * 2);
        ctx.restore();
    };

    if (faceValue === 1 || faceValue === 6) {
        fillNumberArea(size * 0.57, size * 0.48, size * 0.36, size * 0.42);
        return;
    }

    fillNumberArea(size * 0.05, size * 0.05, size * 0.34, size * 0.42);
};

const mergeSpriteComponentBounds = (
    components: SpriteComponentBounds[],
    faceValue: number,
    width: number,
    height: number,
) => {
    const symbolComponents = components
        .filter((component) => !isAtlasNumberComponent(faceValue, component, width, height))
        .filter((component) => component.area >= Math.max(72, width * height * 0.002));
    const usableComponents = symbolComponents.length > 0 ? symbolComponents : components;
    if (usableComponents.length === 0) return null;

    const anchor = usableComponents.reduce((best, component) => (
        component.area > best.area ? component : best
    ));
    const anchorCenterX = (anchor.minX + anchor.maxX) / 2;
    const anchorCenterY = (anchor.minY + anchor.maxY) / 2;
    const maxDistance = Math.min(width, height) * 0.32;
    const relatedComponents = usableComponents.filter((component) => {
        if (component === anchor) return true;
        const centerX = (component.minX + component.maxX) / 2;
        const centerY = (component.minY + component.maxY) / 2;
        const distance = Math.hypot(centerX - anchorCenterX, centerY - anchorCenterY);
        return distance <= maxDistance || component.area >= anchor.area * 0.18;
    });

    return relatedComponents.reduce<SpriteComponentBounds>((merged, component) => ({
        area: merged.area + component.area,
        minX: Math.min(merged.minX, component.minX),
        minY: Math.min(merged.minY, component.minY),
        maxX: Math.max(merged.maxX, component.maxX),
        maxY: Math.max(merged.maxY, component.maxY),
    }), {
        area: 0,
        minX: width,
        minY: height,
        maxX: -1,
        maxY: -1,
    });
};

const drawAtlasSymbol = (
    targetCtx: CanvasRenderingContext2D,
    atlasImage: HTMLImageElement | null,
    faceValue: number,
    size: number,
    artScale = DICE_BOX_FACE_ART_SCALE,
) => {
    if (!atlasImage?.naturalWidth || !atlasImage.naturalHeight) return;

    const mapping = DICE_ATLAS.faceMap[faceValue] ?? DICE_ATLAS.faceMap[1];
    const sourceWidth = atlasImage.naturalWidth / DICE_ATLAS.cols;
    const sourceHeight = atlasImage.naturalHeight / DICE_ATLAS.rows;
    const sourceX = mapping.col * sourceWidth;
    const sourceY = mapping.row * sourceHeight;
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = Math.max(1, Math.round(sourceWidth));
    spriteCanvas.height = Math.max(1, Math.round(sourceHeight));
    const spriteCtx = spriteCanvas.getContext('2d', { willReadFrequently: true });
    if (!spriteCtx) return;

    spriteCtx.drawImage(
        atlasImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        spriteCanvas.width,
        spriteCanvas.height,
    );
    eraseAtlasPrintedNumber(spriteCtx, faceValue, spriteCanvas.width);

    const imageData = spriteCtx.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height);
    const data = imageData.data;
    const backgroundColor = estimateFaceBackgroundColor(data, spriteCanvas.width, spriteCanvas.height);

    for (let y = 0; y < spriteCanvas.height; y += 1) {
        for (let x = 0; x < spriteCanvas.width; x += 1) {
            const offset = (y * spriteCanvas.width + x) * 4;
            const r = data[offset] ?? 0;
            const g = data[offset + 1] ?? 0;
            const b = data[offset + 2] ?? 0;
            const alpha = data[offset + 3] ?? 0;

            if (isResidualAtlasFaceBackgroundPixel(r, g, b, alpha, backgroundColor)) {
                data[offset + 3] = 0;
            }
        }
    }

    spriteCtx.putImageData(imageData, 0, 0);

    const components = extractSpriteComponents(data, spriteCanvas.width, spriteCanvas.height);
    const bounds = mergeSpriteComponentBounds(components, faceValue, spriteCanvas.width, spriteCanvas.height);
    if (!bounds || bounds.area < 24) return;

    const padding = Math.max(4, Math.round(Math.min(spriteCanvas.width, spriteCanvas.height) * 0.026));
    const minX = Math.max(0, bounds.minX - padding);
    const minY = Math.max(0, bounds.minY - padding);
    const maxX = Math.min(spriteCanvas.width - 1, bounds.maxX + padding);
    const maxY = Math.min(spriteCanvas.height - 1, bounds.maxY + padding);
    const spriteWidth = maxX - minX + 1;
    const spriteHeight = maxY - minY + 1;
    if (spriteWidth < 2 || spriteHeight < 2) return;
    const maxTarget = size * artScale;
    const targetScale = Math.min(maxTarget / spriteWidth, maxTarget / spriteHeight);
    const targetWidth = spriteWidth * targetScale;
    const targetHeight = spriteHeight * targetScale;
    const targetX = (size - targetWidth) / 2;
    const targetY = (size - targetHeight) / 2;

    targetCtx.drawImage(
        spriteCanvas,
        minX,
        minY,
        spriteWidth,
        spriteHeight,
        targetX,
        targetY,
        targetWidth,
        targetHeight,
    );
};

const createFaceCanvas = (
    faceValue: number,
    atlasImage: HTMLImageElement | null,
) => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.clearRect(0, 0, size, size);
    drawDieFaceBase(ctx, size);
    drawAtlasSymbol(ctx, atlasImage, faceValue, size);

    return canvas;
};

const canvasToImage = (canvas: HTMLCanvasElement): Promise<HTMLImageElement> => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    try {
        image.src = canvas.toDataURL('image/png');
    } catch {
        image.src = TRANSPARENT_PIXEL_SRC;
    }
});

export async function loadDiceThroneDiceBoxSkin(
    definitionId?: string,
    locale = 'zh-CN',
): Promise<DiceThroneDiceBoxSkin> {
    const characterId = resolveCharacterIdFromDiceDefinitionId(definitionId) ?? 'monk';
    const spriteAssetPath = getDiceSpriteAssetPath(definitionId, characterId);
    const spriteUrls = resolveSpriteAssetUrls(spriteAssetPath, locale);
    const atlasImage = await loadImageFromCandidates(spriteUrls);
    const faceCanvases: Record<number, HTMLCanvasElement> = {};
    const faceImages: Record<number, HTMLImageElement> = {};
    const edgeCanvas = createEdgeCanvas();

    for (const faceValue of DICE_BOX_ATLAS_FACE_VALUES) {
        faceCanvases[faceValue] = createFaceCanvas(faceValue, atlasImage);
        faceImages[faceValue] = await canvasToImage(faceCanvases[faceValue]);
    }

    return {
        id: `dicethrone:${definitionId ?? characterId}:${locale}:${spriteAssetPath}`,
        definitionId,
        faceCanvases,
        edgeCanvas,
        faceImages,
        preferPresetMaterials: true,
    };
}

export async function loadDiceThroneDiceBoxSkins(
    dice: Array<{ definitionId?: string }>,
    locale = 'zh-CN',
): Promise<Array<DiceThroneDiceBoxSkin | null>> {
    const cache = new Map<string, Promise<DiceThroneDiceBoxSkin>>();

    return Promise.all(dice.map((die) => {
        const key = `${die.definitionId ?? 'monk-dice'}|${locale}`;
        let pending = cache.get(key);
        if (!pending) {
            pending = loadDiceThroneDiceBoxSkin(die.definitionId, locale);
            cache.set(key, pending);
        }
        return pending;
    }));
}
