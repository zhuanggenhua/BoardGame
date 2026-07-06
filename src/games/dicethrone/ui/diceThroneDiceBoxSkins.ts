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
const DICE_BOX_FACE_CANVAS_SIZE = 512;
const DICE_BOX_FACE_ART_SCALE = 0.68;

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
    const sourceSize = Math.min(sourceWidth, sourceHeight);
    const sourceInsetX = sourceX + (sourceWidth - sourceSize) / 2;
    const sourceInsetY = sourceY + (sourceHeight - sourceSize) / 2;
    const targetSize = size * DICE_BOX_FACE_ART_SCALE;
    const targetWidth = targetSize;
    const targetHeight = targetSize;
    const targetX = (size - targetWidth) / 2;
    const targetY = (size - targetHeight) / 2;

    ctx.drawImage(
        atlasImage,
        sourceInsetX,
        sourceInsetY,
        sourceSize,
        sourceSize,
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
