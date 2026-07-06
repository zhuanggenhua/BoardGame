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

const DICE_BOX_ATLAS_FACE_VALUES = [1, 2, 3, 4, 5, 6] as const;
const TRANSPARENT_PIXEL_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const DICE_BOX_FACE_CANVAS_SIZE = 1024;
const DICE_BOX_FACE_ART_SCALE = 0.68;
const DICE_BOX_BACKGROUND_DISTANCE_TOLERANCE = 44;
const DICE_BOX_BACKGROUND_FEATHER_TOLERANCE = 84;
const DICE_BOX_LIGHT_BACKGROUND_LUMA = 150;

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

    const face = ctx.createLinearGradient(0, 0, size, size);
    face.addColorStop(0, '#fffdf6');
    face.addColorStop(0.62, '#f6f1df');
    face.addColorStop(1, '#ddd5bd');
    ctx.fillStyle = face;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();

    const edge = ctx.createLinearGradient(0, 0, size, size);
    edge.addColorStop(0, 'rgba(255,255,255,0.62)');
    edge.addColorStop(0.5, 'rgba(120,110,82,0.08)');
    edge.addColorStop(1, 'rgba(55,48,34,0.18)');
    ctx.strokeStyle = edge;
    ctx.lineWidth = size * 0.018;
    drawRoundedRect(ctx, size * 0.01, size * 0.01, size - size * 0.02, size - size * 0.02, radius);
    ctx.stroke();
};

const createPresetLabelCanvas = (faceValue: number, atlasImage: HTMLImageElement | null) => {
    const size = DICE_BOX_FACE_CANVAS_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, size, size);
    drawOfficialAtlasFace(ctx, atlasImage, faceValue, size);

    return canvas;
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
    const size = DICE_BOX_FACE_CANVAS_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const radius = size * 0.15;
    const face = ctx.createLinearGradient(0, 0, size, size);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(0.62, '#f2efe4');
    face.addColorStop(1, '#cbc2aa');
    ctx.fillStyle = face;
    drawRoundedRect(ctx, 0, 0, size, size, radius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(62, 55, 42, 0.24)';
    ctx.lineWidth = size * 0.024;
    drawRoundedRect(ctx, size * 0.01, size * 0.01, size - size * 0.02, size - size * 0.02, radius);
    ctx.stroke();

    return canvas;
};

const colorDistance = (r: number, g: number, b: number, color: RgbColor) => Math.hypot(
    r - color.r,
    g - color.g,
    b - color.b,
);

const luminance = (r: number, g: number, b: number) => (0.2126 * r) + (0.7152 * g) + (0.0722 * b);

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

    if (colors.length === 0) {
        return { r: 224, g: 215, b: 178 };
    }

    return {
        r: Math.round(colors.reduce((sum, color) => sum + color.r, 0) / colors.length),
        g: Math.round(colors.reduce((sum, color) => sum + color.g, 0) / colors.length),
        b: Math.round(colors.reduce((sum, color) => sum + color.b, 0) / colors.length),
    };
};

const drawOfficialAtlasFace = (
    ctx: CanvasRenderingContext2D,
    atlasImage: HTMLImageElement | null,
    faceValue: number,
    size: number,
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

    spriteCtx.imageSmoothingEnabled = false;
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

    const imageData = spriteCtx.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height);
    const data = imageData.data;
    const backgroundColor = estimateFaceBackgroundColor(data, spriteCanvas.width, spriteCanvas.height);
    let minX = spriteCanvas.width;
    let minY = spriteCanvas.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < spriteCanvas.height; y += 1) {
        for (let x = 0; x < spriteCanvas.width; x += 1) {
            const offset = (y * spriteCanvas.width + x) * 4;
            const r = data[offset] ?? 0;
            const g = data[offset + 1] ?? 0;
            const b = data[offset + 2] ?? 0;
            const alpha = data[offset + 3] ?? 0;
            const distance = colorDistance(r, g, b, backgroundColor);
            const lightBackgroundPixel = luminance(r, g, b) >= DICE_BOX_LIGHT_BACKGROUND_LUMA
                && distance <= DICE_BOX_BACKGROUND_FEATHER_TOLERANCE;
            if (
                alpha < 16
                || distance <= DICE_BOX_BACKGROUND_DISTANCE_TOLERANCE
                || lightBackgroundPixel
            ) {
                data[offset + 3] = 0;
                continue;
            }
            if (distance < DICE_BOX_BACKGROUND_FEATHER_TOLERANCE) {
                const feather = (distance - DICE_BOX_BACKGROUND_DISTANCE_TOLERANCE)
                    / (DICE_BOX_BACKGROUND_FEATHER_TOLERANCE - DICE_BOX_BACKGROUND_DISTANCE_TOLERANCE);
                data[offset + 3] = Math.max(0, Math.min(alpha, Math.round(alpha * feather)));
            }
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }

    if (maxX < minX || maxY < minY) return;
    spriteCtx.putImageData(imageData, 0, 0);

    const padding = Math.max(4, Math.round(Math.min(spriteCanvas.width, spriteCanvas.height) * 0.035));
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(spriteCanvas.width, maxX + padding + 1) - cropX;
    const cropH = Math.min(spriteCanvas.height, maxY + padding + 1) - cropY;
    const maxTarget = size * DICE_BOX_FACE_ART_SCALE;
    const scale = Math.min(maxTarget / cropW, maxTarget / cropH);
    const targetWidth = cropW * scale;
    const targetHeight = cropH * scale;
    const targetX = (size - targetWidth) / 2;
    const targetY = (size - targetHeight) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
        spriteCanvas,
        cropX,
        cropY,
        cropW,
        cropH,
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
    const size = DICE_BOX_FACE_CANVAS_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, size, size);
    drawDieFaceBase(ctx, size);
    drawOfficialAtlasFace(ctx, atlasImage, faceValue, size);

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
        faceImages[faceValue] = await canvasToImage(createPresetLabelCanvas(faceValue, atlasImage));
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
