// @asset-pipeline-allow
// 骰子盒皮肤在受控 canvas 流程中把已解析图片转成 Three.js 贴图输入。
import { getDieFaceByValue } from '../domain/diceRegistry';
import { getDiceSpriteAssetPath } from './assets';
import {
    getLocalizedImageCandidateUrls,
    getPreloadedImageElement,
    markImageLoaded,
} from '../../../core';

export interface DiceThroneDiceBoxSkin {
    id: string;
    definitionId?: string;
    faceCanvases: Record<number, HTMLCanvasElement>;
    faceImages: Record<number, HTMLImageElement>;
}

const FACE_ATLAS_COORDS: Record<number, { col: number; row: number }> = {
    1: { col: 0, row: 2 },
    2: { col: 0, row: 1 },
    3: { col: 1, row: 2 },
    4: { col: 1, row: 1 },
    5: { col: 2, row: 1 },
    6: { col: 2, row: 2 },
};

const FACE_TEXTURE_ROTATION: Partial<Record<number, number>> = {
    1: Math.PI,
    6: Math.PI,
};

const DICE_FACE_FALLBACK_LABELS: Record<string, string> = {
    chi: '气',
    fist: '拳',
    lotus: '莲',
    palm: '掌',
    shuriken: '镖',
    mask: '面',
    katana: '刀',
    moon: '月',
    arrow: '箭',
    fire: '火',
    skull: '骨',
    cutlass: '刃',
    loot: '宝',
    gear: '齿',
};

const resolveFallbackLabel = (faceValue: number, definitionId?: string) => {
    const symbol = definitionId
        ? getDieFaceByValue(definitionId, faceValue)?.symbols?.[0]
        : null;
    const symbolKey = typeof symbol === 'string' ? symbol.toLowerCase() : '';
    return DICE_FACE_FALLBACK_LABELS[symbolKey] ?? String(faceValue);
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

const drawFallbackDieFace = (
    ctx: CanvasRenderingContext2D,
    size: number,
    faceValue: number,
    definitionId?: string,
) => {
    const outerRadius = size * 0.15;
    const innerPadding = size * 0.12;
    const symbolPadding = size * 0.16;

    const shimmerGradient = ctx.createLinearGradient(0, 0, size, size);
    shimmerGradient.addColorStop(0, '#fff7e9');
    shimmerGradient.addColorStop(0.45, '#f0e2c7');
    shimmerGradient.addColorStop(1, '#c9b08e');
    ctx.fillStyle = shimmerGradient;
    drawRoundedRect(ctx, 0, 0, size, size, outerRadius);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = 'rgba(88,64,35,0.25)';
    ctx.shadowBlur = size * 0.03;
    ctx.shadowOffsetY = size * 0.01;
    ctx.fillStyle = 'rgba(255,248,234,0.85)';
    drawRoundedRect(ctx, innerPadding, innerPadding, size - innerPadding * 2, size - innerPadding * 2, size * 0.11);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(111,100,80,0.95)';
    ctx.fillRect(symbolPadding, symbolPadding, size - symbolPadding * 2, size - symbolPadding * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.font = `900 ${size * 0.23}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(resolveFallbackLabel(faceValue, definitionId), size / 2, size / 2);

    const edge = ctx.createLinearGradient(0, 0, size, size);
    edge.addColorStop(0, 'rgba(255,255,255,0.22)');
    edge.addColorStop(0.5, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.strokeStyle = edge;
    ctx.lineWidth = size * 0.02;
    drawRoundedRect(ctx, size * 0.012, size * 0.012, size - size * 0.024, size - size * 0.024, outerRadius);
    ctx.stroke();
};

const drawSpriteDieFace = (
    ctx: CanvasRenderingContext2D,
    size: number,
    faceValue: number,
    spriteImage: HTMLImageElement,
) => {
    const face = FACE_ATLAS_COORDS[faceValue] ?? FACE_ATLAS_COORDS[1];
    const cellWidth = spriteImage.naturalWidth / 3;
    const cellHeight = spriteImage.naturalHeight / 3;
    const inset = Math.max(1, Math.min(cellWidth, cellHeight) * 0.018);
    const radius = size * 0.14;

    ctx.save();
    drawRoundedRect(ctx, 0, 0, size, size, radius);
    ctx.clip();

    if (FACE_TEXTURE_ROTATION[faceValue]) {
        ctx.translate(size / 2, size / 2);
        ctx.rotate(FACE_TEXTURE_ROTATION[faceValue]);
        ctx.drawImage(
            spriteImage,
            face.col * cellWidth + inset,
            face.row * cellHeight + inset,
            cellWidth - inset * 2,
            cellHeight - inset * 2,
            -size / 2,
            -size / 2,
            size,
            size,
        );
    } else {
        ctx.drawImage(
            spriteImage,
            face.col * cellWidth + inset,
            face.row * cellHeight + inset,
            cellWidth - inset * 2,
            cellHeight - inset * 2,
            0,
            0,
            size,
            size,
        );
    }

    ctx.restore();

    const edge = ctx.createLinearGradient(0, 0, size, size);
    edge.addColorStop(0, 'rgba(255,255,255,0.25)');
    edge.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    edge.addColorStop(1, 'rgba(46,30,12,0.22)');
    ctx.strokeStyle = edge;
    ctx.lineWidth = size * 0.018;
    drawRoundedRect(ctx, size * 0.01, size * 0.01, size - size * 0.02, size - size * 0.02, radius);
    ctx.stroke();
};

const loadImage = (url: string): Promise<HTMLImageElement | null> => new Promise((resolve) => {
    if (typeof Image === 'undefined') {
        resolve(null);
        return;
    }

    const cached = getPreloadedImageElement(url);
    if (cached?.complete && cached.naturalWidth > 0 && cached.naturalHeight > 0) {
        resolve(cached);
        return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
});

const loadFirstUsableImage = async (urls: string[], locale: string) => {
    for (const url of urls) {
        const image = await loadImage(url);
        if (image?.naturalWidth && image.naturalHeight) {
            markImageLoaded(url, locale, image);
            return image;
        }
    }
    return null;
};

const createFaceCanvas = (
    faceValue: number,
    spriteImage: HTMLImageElement | null,
    definitionId?: string,
) => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.clearRect(0, 0, size, size);
    if (spriteImage) {
        try {
            drawSpriteDieFace(ctx, size, faceValue, spriteImage);
        } catch {
            ctx.clearRect(0, 0, size, size);
            drawFallbackDieFace(ctx, size, faceValue, definitionId);
        }
    } else {
        drawFallbackDieFace(ctx, size, faceValue, definitionId);
    }

    return canvas;
};

const canvasToImage = (
    canvas: HTMLCanvasElement,
    fallbackCanvas?: HTMLCanvasElement,
): Promise<HTMLImageElement> => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    try {
        image.src = canvas.toDataURL('image/png');
    } catch (error) {
        if (fallbackCanvas && fallbackCanvas !== canvas) {
            try {
                image.src = fallbackCanvas.toDataURL('image/png');
                return;
            } catch {
                // Fall through to the final transparent pixel fallback.
            }
        }
        image.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
    }
});

export async function loadDiceThroneDiceBoxSkin(
    definitionId?: string,
    locale = 'zh-CN',
): Promise<DiceThroneDiceBoxSkin> {
    const characterId = definitionId?.replace('-dice', '') ?? 'monk';
    const spriteAssetPath = getDiceSpriteAssetPath(definitionId, characterId);
    const spriteCandidates = spriteAssetPath
        ? getLocalizedImageCandidateUrls(spriteAssetPath, locale)
        : [];
    const spriteImage = await loadFirstUsableImage(spriteCandidates, locale);
    const faceCanvases: Record<number, HTMLCanvasElement> = {};
    const faceImages: Record<number, HTMLImageElement> = {};

    for (const faceValue of [1, 2, 3, 4, 5, 6]) {
        const canvas = createFaceCanvas(faceValue, spriteImage, definitionId);
        const fallbackCanvas = createFaceCanvas(faceValue, null, definitionId);
        faceCanvases[faceValue] = canvas;
        faceImages[faceValue] = await canvasToImage(canvas, fallbackCanvas);
    }

    return {
        id: `dicethrone:${definitionId ?? characterId}:${locale}`,
        definitionId,
        faceCanvases,
        faceImages,
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
