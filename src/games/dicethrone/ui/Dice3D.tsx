// @asset-pipeline-allow
// @asset-pipeline-allow
import React from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { createScopedLogger } from '../../../lib/logger';
import { SHIMMER_BG } from '../../../components/common/media/OptimizedImage';
import { getDieFaceByValue } from '../domain/diceRegistry';
import {
    DICE_BG_SIZE,
    getDiceSpritePosition,
    getDiceSpriteAssetPath,
} from './assets';
import { prioritizeWebglSpriteCandidates } from './dice3dSpriteSafety';
import {
    getLocalizedImageCandidateUrls,
    getPreloadedImageElement,
    markImageLoaded,
} from '../../../core';
import type { DicePhysicsState } from '../../../lib/dice-physics/types';

export interface Dice3DProps {
    value: number;
    isRolling: boolean;
    size?: string;
    locale?: string;
    index?: number;
    variant?: 'default' | 'spotlight' | 'board-topdown';
    characterId?: string;
    definitionId?: string;
    enableWebgl?: boolean;
    overrideTransform?: string;
    overrideRotateX?: number;
    overrideRotateY?: number;
    overrideRotateZ?: number;
}

export interface DiceField3DProps {
    dice: Array<{
        id: number;
        value: number;
        definitionId?: string;
    }>;
    selectedDieIds?: number[];
    isRolling: boolean;
    rerollingDiceIds?: number[];
    locale?: string;
    characterId?: string;
    slots: Array<{
        left: string;
        top: string;
        rotate: string;
        zIndex?: number;
        world?: {
            x: number;
            y: number;
            z: number;
        };
    }>;
    onDieClick?: (dieId: number) => void;
    onProjectedDiceUpdate?: (layouts: ProjectedDiceLayout[]) => void;
    physicsStates?: DicePhysicsState[];
    physicsLayoutBounds?: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    scenePreset?: 'spotlight' | 'board-topdown';
    canvasClassName?: string;
}

export interface ProjectedDiceLayout {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    selected: boolean;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
}

const dice3DLogger = createScopedLogger('dicethrone:dice3d');
const DICE3D_STYLE_ELEMENT_ID = 'dicethrone-dice3d-styles';
const DICE3D_STYLE_TEXT = `
.dice3d-perspective { perspective: 1000px; }
.dice3d-preserve-3d { transform-style: preserve-3d; }
.dice3d-backface-hidden { backface-visibility: hidden; }
@keyframes dice3d-tumble {
    0% { transform: rotateX(0) rotateY(0); }
    100% { transform: rotateX(1440deg) rotateY(1440deg); }
}
@keyframes dice3d-bonus-tumble {
    0% { transform: rotateX(0) rotateY(0); }
    100% { transform: rotateX(1440deg) rotateY(1440deg); }
}
.animate-dice3d-tumble { animation: dice3d-tumble 1s linear infinite; }
.animate-dice3d-bonus-tumble { animation: dice3d-bonus-tumble 0.8s linear infinite; }
@keyframes dice3d-rail-shadow {
  0% { transform: scale(1) translateZ(0); opacity: 0.22; }
  22% { transform: scale(0.82) translateZ(0); opacity: 0.11; }
  48% { transform: scale(0.9) translateZ(0); opacity: 0.16; }
  76% { transform: scale(0.96) translateZ(0); opacity: 0.2; }
  100% { transform: scale(1) translateZ(0); opacity: 0.22; }
}
@keyframes dice3d-rail-flight-0 {
  0% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  18% { transform: translate3d(-6%, -18%, 0) rotateX(180deg) rotateY(160deg) rotateZ(46deg); }
  43% { transform: translate3d(8%, -33%, 0) rotateX(420deg) rotateY(480deg) rotateZ(132deg); }
  68% { transform: translate3d(-4%, -12%, 0) rotateX(640deg) rotateY(760deg) rotateZ(210deg); }
  100% { transform: translate3d(0, 0, 0) rotateX(760deg) rotateY(900deg) rotateZ(270deg); }
}
@keyframes dice3d-rail-flight-1 {
  0% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  17% { transform: translate3d(7%, -16%, 0) rotateX(150deg) rotateY(210deg) rotateZ(-32deg); }
  42% { transform: translate3d(-9%, -34%, 0) rotateX(400deg) rotateY(520deg) rotateZ(114deg); }
  69% { transform: translate3d(5%, -10%, 0) rotateX(690deg) rotateY(780deg) rotateZ(196deg); }
  100% { transform: translate3d(0, 0, 0) rotateX(840deg) rotateY(980deg) rotateZ(288deg); }
}
@keyframes dice3d-rail-flight-2 {
  0% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  20% { transform: translate3d(-4%, -14%, 0) rotateX(210deg) rotateY(180deg) rotateZ(24deg); }
  46% { transform: translate3d(6%, -29%, 0) rotateX(470deg) rotateY(520deg) rotateZ(148deg); }
  72% { transform: translate3d(-3%, -8%, 0) rotateX(720deg) rotateY(820deg) rotateZ(246deg); }
  100% { transform: translate3d(0, 0, 0) rotateX(880deg) rotateY(1020deg) rotateZ(312deg); }
}
@keyframes dice3d-rail-flight-3 {
  0% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  19% { transform: translate3d(6%, -20%, 0) rotateX(170deg) rotateY(150deg) rotateZ(-26deg); }
  45% { transform: translate3d(-10%, -36%, 0) rotateX(430deg) rotateY(470deg) rotateZ(126deg); }
  70% { transform: translate3d(4%, -13%, 0) rotateX(700deg) rotateY(760deg) rotateZ(224deg); }
  100% { transform: translate3d(0, 0, 0) rotateX(860deg) rotateY(940deg) rotateZ(300deg); }
}
@keyframes dice3d-rail-flight-4 {
  0% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  16% { transform: translate3d(-7%, -15%, 0) rotateX(140deg) rotateY(190deg) rotateZ(42deg); }
  41% { transform: translate3d(9%, -31%, 0) rotateX(390deg) rotateY(500deg) rotateZ(138deg); }
  67% { transform: translate3d(-5%, -11%, 0) rotateX(660deg) rotateY(790deg) rotateZ(228deg); }
  100% { transform: translate3d(0, 0, 0) rotateX(820deg) rotateY(970deg) rotateZ(294deg); }
}
.animate-dice3d-rail-shadow { animation: dice3d-rail-shadow 900ms cubic-bezier(0.2, 0.7, 0.18, 1) both; }
.animate-dice3d-rail-flight-0 { animation: dice3d-rail-flight-0 900ms cubic-bezier(0.2, 0.7, 0.18, 1) both; }
.animate-dice3d-rail-flight-1 { animation: dice3d-rail-flight-1 920ms cubic-bezier(0.2, 0.7, 0.18, 1) both; }
.animate-dice3d-rail-flight-2 { animation: dice3d-rail-flight-2 880ms cubic-bezier(0.2, 0.7, 0.18, 1) both; }
.animate-dice3d-rail-flight-3 { animation: dice3d-rail-flight-3 940ms cubic-bezier(0.2, 0.7, 0.18, 1) both; }
.animate-dice3d-rail-flight-4 { animation: dice3d-rail-flight-4 910ms cubic-bezier(0.2, 0.7, 0.18, 1) both; }
`;

const DICE_FACE_FALLBACK_LABELS: Record<string, string> = {
    fist: 'FS',
    palm: 'PM',
    taiji: 'TJ',
    lotus: 'LT',
    katana: 'KT',
    sword: 'SW',
    helm: 'HM',
    heart: 'HP',
    pray: 'PR',
    rising_sun: 'RS',
    strength: 'ST',
    fire: 'FR',
    fiery_soul: 'FY',
    magma: 'MG',
    meteor: 'MT',
    bow: 'BW',
    foot: 'FT',
    moon: 'MN',
    dagger: 'DG',
    bag: 'BG',
    card: 'CD',
    shadow: 'SD',
    bullet: 'BL',
    dash: 'DS',
    bullseye: 'BE',
};

const SPOTLIGHT_SETTLED_TILTS = [
    [ -0.28,  0.33, -0.05 ],
    [ -0.21, -0.30,  0.07 ],
    [ -0.31,  0.24,  0.03 ],
    [ -0.18, -0.35, -0.09 ],
    [ -0.26,  0.28,  0.08 ],
] as const;

const BOARD_TOPDOWN_SETTLED_TILTS = [
    [  0.006,  0.16,  0.004 ],
    [ -0.005, -0.18, -0.004 ],
    [  0.004,  0.1,  0.002 ],
    [ -0.006, -0.13,  0.003 ],
    [  0.004,  0.2, -0.003 ],
] as const;

const BOARD_TOPDOWN_VISUAL_SCALE = 0.62;
const BOARD_TOPDOWN_COLLISION_RADIUS = 0.56;

let sharedBoardShadowTexture: THREE.CanvasTexture | null = null;
type OutlineShaderMaterial = THREE.ShaderMaterial & {
    uniforms: {
        uColor: { value: THREE.Color };
        uOpacity: { value: number };
        uPower: { value: number };
        uIntensity: { value: number };
        uSolid: { value: number };
        uEdgeOnly: { value: number };
    };
};

function getBoardShadowTexture(): THREE.CanvasTexture {
    if (sharedBoardShadowTexture) {
        return sharedBoardShadowTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        sharedBoardShadowTexture = new THREE.CanvasTexture(canvas);
        return sharedBoardShadowTexture;
    }

    const gradient = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(0,0,0,0.96)');
    gradient.addColorStop(0.28, 'rgba(0,0,0,0.72)');
    gradient.addColorStop(0.56, 'rgba(0,0,0,0.22)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    sharedBoardShadowTexture = new THREE.CanvasTexture(canvas);
    sharedBoardShadowTexture.needsUpdate = true;
    return sharedBoardShadowTexture;
}

function createSelectionSmileGeometry(
    width: number,
    innerHeight: number,
    outerHeight: number,
): THREE.ShapeGeometry {
    const halfWidth = width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-halfWidth, 0);
    shape.quadraticCurveTo(0, outerHeight, halfWidth, 0);
    shape.lineTo(halfWidth, -0.012);
    shape.quadraticCurveTo(0, innerHeight, -halfWidth, -0.012);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 96);
}

function createOutlineShaderMaterial({
    color,
    opacity,
    power,
    intensity,
    edgeOnly = false,
    blending = THREE.NormalBlending,
}: {
    color: THREE.ColorRepresentation;
    opacity: number;
    power: number;
    intensity: number;
    edgeOnly?: boolean;
    blending?: THREE.Blending;
}): OutlineShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(color) },
            uOpacity: { value: opacity },
            uPower: { value: power },
            uIntensity: { value: intensity },
            uSolid: { value: 0 },
            uEdgeOnly: { value: edgeOnly ? 1 : 0 },
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vObjectNormal;
            varying vec3 vViewPosition;

            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                vNormal = normalize(normalMatrix * normal);
                vObjectNormal = normalize(normal);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uPower;
            uniform float uIntensity;
            uniform float uSolid;
            uniform float uEdgeOnly;
            varying vec3 vNormal;
            varying vec3 vObjectNormal;
            varying vec3 vViewPosition;

            void main() {
                vec3 normal = normalize(vNormal);
                vec3 objectNormal = abs(normalize(vObjectNormal));
                vec3 viewDir = normalize(vViewPosition);
                float rim = pow(1.0 - clamp(abs(dot(normal, viewDir)), 0.0, 1.0), uPower) * uIntensity;
                float maxAxis = max(max(objectNormal.x, objectNormal.y), objectNormal.z);
                float bevelMask = smoothstep(0.1, 0.3, 1.0 - maxAxis);
                float surfaceMask = mix(1.0, bevelMask, clamp(uEdgeOnly, 0.0, 1.0));
                float rimAlpha = clamp(rim, 0.0, 1.0) * surfaceMask * uOpacity;
                float alpha = mix(rimAlpha, uOpacity, clamp(uSolid, 0.0, 1.0));
                if (alpha < 0.02) discard;
                gl_FragColor = vec4(uColor, alpha);
            }
        `,
        side: THREE.BackSide,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
        blending,
    }) as OutlineShaderMaterial;
}

type DiceSpriteLoadResult = { url: string; img: HTMLImageElement } | null;
type DiceAtlasImageLoadResult = { url: string; img: HTMLImageElement } | null;
const diceSpriteInFlightLoads = new Map<string, Promise<DiceSpriteLoadResult>>();
const diceAtlasImageInFlightLoads = new Map<string, Promise<DiceAtlasImageLoadResult>>();
const diceAtlasImageCache = new Map<string, HTMLImageElement>();

const hasUsableSpriteImage = (img: HTMLImageElement | null | undefined): img is HTMLImageElement =>
    img != null && img.naturalWidth > 0;

const normalizeComparableUrl = (url: string): string => {
    if (!url) return '';
    if (typeof window === 'undefined') return url;
    try {
        return new URL(url, window.location.href).href;
    } catch {
        return url;
    }
};

const matchLoadedSpriteCandidateUrl = (
    img: HTMLImageElement | null | undefined,
    candidateUrls: string[],
): string => {
    if (!hasUsableSpriteImage(img)) return '';

    const normalizedCandidates = candidateUrls.map((candidateUrl) => ({
        candidateUrl,
        normalized: normalizeComparableUrl(candidateUrl),
    }));

    for (const src of [img.currentSrc, img.src]) {
        const normalizedSrc = normalizeComparableUrl(src);
        if (!normalizedSrc) continue;
        const matchedCandidate = normalizedCandidates.find((candidate) => candidate.normalized === normalizedSrc);
        if (matchedCandidate) {
            return matchedCandidate.candidateUrl;
        }
    }

    return '';
};

const resolveLoadedSpriteUrl = (
    candidateUrls: string[],
    spriteAssetPath?: string | null,
    locale?: string,
): string => {
    for (const candidateUrl of candidateUrls) {
        const matchedCandidate = matchLoadedSpriteCandidateUrl(getPreloadedImageElement(candidateUrl), candidateUrls);
        if (matchedCandidate) {
            return matchedCandidate;
        }
    }

    if (spriteAssetPath) {
        const sourceImg = getPreloadedImageElement(spriteAssetPath, locale);
        const matchedCandidate = matchLoadedSpriteCandidateUrl(sourceImg, candidateUrls);
        if (matchedCandidate) {
            return matchedCandidate;
        }

        if (hasUsableSpriteImage(sourceImg)) {
            return sourceImg.currentSrc || sourceImg.src || '';
        }
    }

    return '';
};

const loadDiceSpriteCandidatesShared = (candidateUrls: string[]): Promise<DiceSpriteLoadResult> => {
    if (candidateUrls.length === 0) {
        return Promise.resolve(null);
    }

    const inFlightKey = candidateUrls.join('|');
    const inFlight = diceSpriteInFlightLoads.get(inFlightKey);
    if (inFlight) {
        return inFlight;
    }

    const promise = new Promise<DiceSpriteLoadResult>((resolve) => {
        const tryLoad = (index: number) => {
            if (index >= candidateUrls.length) {
                resolve(null);
                return;
            }

            const url = candidateUrls[index];
            const img = new Image();
            let settled = false;
            const finish = (result: DiceSpriteLoadResult) => {
                if (settled) return;
                settled = true;
                resolve(result);
            };
            const settleFromDimensions = () => {
                if (img.naturalWidth <= 0) return false;
                markImageLoaded(url, undefined, img);
                finish({ url, img });
                return true;
            };
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                settleFromDimensions();
            };
            img.onerror = () => {
                if (settled) return;
                tryLoad(index + 1);
            };
            img.src = url;
            if (img.complete && settleFromDimensions()) return;

            const pollDecodedImage = () => {
                if (settled) return;
                if (settleFromDimensions()) return;
                window.requestAnimationFrame(pollDecodedImage);
            };
            window.requestAnimationFrame(pollDecodedImage);
        };

        tryLoad(0);
    }).finally(() => {
        diceSpriteInFlightLoads.delete(inFlightKey);
    });

    diceSpriteInFlightLoads.set(inFlightKey, promise);
    return promise;
};

const loadDiceAtlasImageShared = (candidateUrls: string[]): Promise<DiceAtlasImageLoadResult> => {
    if (candidateUrls.length === 0) {
        return Promise.resolve(null);
    }

    const orderedCandidates = prioritizeWebglSpriteCandidates(candidateUrls);
    if (orderedCandidates.length === 0) {
        return Promise.resolve(null);
    }
    for (const candidateUrl of orderedCandidates) {
        const cached = diceAtlasImageCache.get(candidateUrl);
        if (cached) {
            return Promise.resolve({ url: candidateUrl, img: cached });
        }
    }

    const inFlightKey = orderedCandidates.join('|');
    const inFlight = diceAtlasImageInFlightLoads.get(inFlightKey);
    if (inFlight) {
        return inFlight;
    }

    const promise = new Promise<DiceAtlasImageLoadResult>((resolve) => {
        const tryLoad = (index: number) => {
            if (index >= orderedCandidates.length) {
                resolve(null);
                return;
            }

            const url = orderedCandidates[index];
            const img = new Image();
            let settled = false;
            const finish = (result: DiceAtlasImageLoadResult) => {
                if (settled) return;
                settled = true;
                resolve(result);
            };
            const settleFromDimensions = () => {
                if (img.naturalWidth <= 0) return false;
                diceAtlasImageCache.set(url, img);
                markImageLoaded(url, undefined, img);
                finish({ url, img });
                return true;
            };
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                settleFromDimensions();
            };
            img.onerror = () => {
                if (settled) return;
                tryLoad(index + 1);
            };
            img.src = url;
            if (img.complete && settleFromDimensions()) return;

            const pollDecodedImage = () => {
                if (settled) return;
                if (settleFromDimensions()) return;
                window.requestAnimationFrame(pollDecodedImage);
            };
            window.requestAnimationFrame(pollDecodedImage);
        };

        tryLoad(0);
    }).finally(() => {
        diceAtlasImageInFlightLoads.delete(inFlightKey);
    });

    diceAtlasImageInFlightLoads.set(inFlightKey, promise);
    return promise;
};

const resolveFallbackLabel = (faceValue: number, definitionId?: string) => {
    const symbol = definitionId
        ? getDieFaceByValue(definitionId, faceValue)?.symbols?.[0]
        : null;
    const symbolKey = typeof symbol === 'string' ? symbol.toLowerCase() : '';
    const label = DICE_FACE_FALLBACK_LABELS[symbolKey];
    return {
        symbol: symbolKey || '',
        label: label ?? String(faceValue),
    };
};

const isWebglCapable = () => {
    if (typeof document === 'undefined') return false;
    try {
        const canvas = document.createElement('canvas');
        return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
        return false;
    }
};

const FACE_MATERIAL_ORDER = [3, 4, 2, 5, 1, 6] as const;
const PROTOTYPE_FACE_MATERIAL_ORDER = [1, 6, 3, 4, 2, 5] as const;

const FACE_TEXTURE_ROTATION: Partial<Record<number, number>> = {
    1: Math.PI,
    6: Math.PI,
};

const FACE_ATLAS_COORDS: Record<number, { col: number; row: number }> = {
    1: { col: 0, row: 2 },
    2: { col: 0, row: 1 },
    3: { col: 1, row: 2 },
    4: { col: 1, row: 1 },
    5: { col: 2, row: 1 },
    6: { col: 2, row: 2 },
};

const FACE_DECAL_TRANSFORMS: Record<number, {
    position: [number, number, number];
    rotation: [number, number, number];
}> = {
    1: { position: [0, 0, 0.516], rotation: [0, 0, 0] },
    6: { position: [0, 0, -0.516], rotation: [0, Math.PI, 0] },
    3: { position: [0.516, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    4: { position: [-0.516, 0, 0], rotation: [0, Math.PI / 2, 0] },
    2: { position: [0, 0.516, 0], rotation: [-Math.PI / 2, 0, 0] },
    5: { position: [0, -0.516, 0], rotation: [Math.PI / 2, 0, 0] },
};

function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function drawFallbackDieFace(
    ctx: CanvasRenderingContext2D,
    size: number,
    fallbackMeta: { label: string; symbol: string },
    isSpotlight: boolean,
) {
    const outerRadius = size * (isSpotlight ? 0.18 : 0.16);
    const innerPadding = size * (isSpotlight ? 0.10 : 0.12);
    const symbolPadding = size * (isSpotlight ? 0.14 : 0.16);

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
    ctx.fillText(fallbackMeta.label, size / 2, size / 2);

    const edge = ctx.createLinearGradient(0, 0, size, size);
    edge.addColorStop(0, 'rgba(255,255,255,0.22)');
    edge.addColorStop(0.5, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.strokeStyle = edge;
    ctx.lineWidth = size * 0.02;
    drawRoundedRect(ctx, size * 0.012, size * 0.012, size - size * 0.024, size - size * 0.024, outerRadius);
    ctx.stroke();
}

function drawSpriteDieFace(
    ctx: CanvasRenderingContext2D,
    size: number,
    faceId: number,
    spriteImage: HTMLImageElement,
    isSpotlight: boolean,
) {
    const face = FACE_ATLAS_COORDS[faceId] ?? FACE_ATLAS_COORDS[1];
    const cellWidth = spriteImage.naturalWidth / 3;
    const cellHeight = spriteImage.naturalHeight / 3;
    const inset = Math.max(1, Math.min(cellWidth, cellHeight) * 0.018);
    const radius = size * (isSpotlight ? 0.16 : 0.14);

    ctx.save();
    drawRoundedRect(ctx, 0, 0, size, size, radius);
    ctx.clip();

    if (FACE_TEXTURE_ROTATION[faceId]) {
        ctx.translate(size / 2, size / 2);
        ctx.rotate(FACE_TEXTURE_ROTATION[faceId]);
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
}

function createFaceTexture(
    faceId: number,
    spriteImage: HTMLImageElement | null,
    fallbackMeta: { label: string; symbol: string },
    isSpotlight: boolean,
): THREE.Texture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    ctx.clearRect(0, 0, size, size);
    if (spriteImage) {
        try {
            drawSpriteDieFace(ctx, size, faceId, spriteImage, isSpotlight);
        } catch (error) {
            dice3DLogger.warn('draw-sprite-face-failed', {
                faceId,
                message: error instanceof Error ? error.message : String(error),
            });
            ctx.clearRect(0, 0, size, size);
            drawFallbackDieFace(ctx, size, fallbackMeta, isSpotlight);
        }
    } else {
        drawFallbackDieFace(ctx, size, fallbackMeta, isSpotlight);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.premultiplyAlpha = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

function getSpotlightTilt(index: number): THREE.Euler {
    const [x, y, z] = SPOTLIGHT_SETTLED_TILTS[index % SPOTLIGHT_SETTLED_TILTS.length];
    return new THREE.Euler(x, y, z, 'XYZ');
}

function getBoardTopdownTilt(index: number): THREE.Euler {
    const [x, y, z] = BOARD_TOPDOWN_SETTLED_TILTS[index % BOARD_TOPDOWN_SETTLED_TILTS.length];
    return new THREE.Euler(x, y, z, 'XYZ');
}

function getSettledEuler(value: number): THREE.Euler {
    switch (value) {
        case 1: return new THREE.Euler(0, 0, 0, 'XYZ');
        case 6: return new THREE.Euler(Math.PI, 0, 0, 'XYZ');
        case 2: return new THREE.Euler(-Math.PI / 2, 0, 0, 'XYZ');
        case 5: return new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ');
        case 3: return new THREE.Euler(0, -Math.PI / 2, 0, 'XYZ');
        case 4: return new THREE.Euler(0, Math.PI / 2, 0, 'XYZ');
        default: return new THREE.Euler(0, 0, 0, 'XYZ');
    }
}

function buildTargetQuaternion(
    value: number,
    index: number,
    variant: 'default' | 'spotlight' | 'board-topdown',
): THREE.Quaternion {
    const base = new THREE.Quaternion().setFromEuler(getSettledEuler(value));
    if (variant === 'spotlight') {
        const tilt = new THREE.Quaternion().setFromEuler(getSpotlightTilt(index));
        return base.multiply(tilt);
    }
    if (variant === 'board-topdown') {
        return new THREE.Quaternion().setFromEuler(getBoardTopdownTilt(index));
    }
    return base;
}

function getExternalPhysicsVisualQuaternion(
    value: number,
    index: number,
    physicsState: DicePhysicsState,
): THREE.Quaternion {
    const physicsQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
            physicsState.motion.rotateX,
            physicsState.motion.rotateY,
            physicsState.motion.rotateZ,
            'XYZ',
        ),
    );
    if (!physicsState.settled) {
        return physicsQuat;
    }

    return buildTargetQuaternion(value, index, 'board-topdown');
}

const parseDegValue = (value: string, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? (parsed * Math.PI) / 180 : fallback;
};

function createPrototypeFaceTexture(
    faceId: number,
    spriteImage: HTMLImageElement | null,
    fallbackMeta: { label: string; symbol: string },
): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    ctx.fillStyle = '#171e2b';
    ctx.fillRect(0, 0, size, size);

    if (spriteImage) {
        try {
            const face = FACE_ATLAS_COORDS[faceId] ?? FACE_ATLAS_COORDS[1];
            const cellWidth = spriteImage.naturalWidth / 3;
            const cellHeight = spriteImage.naturalHeight / 3;
            const pad = Math.max(1, Math.floor(Math.min(cellWidth, cellHeight) * 0.015));
            ctx.drawImage(
                spriteImage,
                face.col * cellWidth + pad,
                face.row * cellHeight + pad,
                cellWidth - pad * 2,
                cellHeight - pad * 2,
                0,
                0,
                size,
                size,
            );
        } catch (error) {
            dice3DLogger.warn('draw-prototype-face-failed', {
                faceId,
                message: error instanceof Error ? error.message : String(error),
            });
            drawFallbackDieFace(ctx, size, fallbackMeta, true);
        }
    } else {
        drawFallbackDieFace(ctx, size, fallbackMeta, true);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

function createPrototypeDiceMesh({
    value,
    index,
    definitionId,
    atlasImage,
    slotRotate,
    isSelected,
    variant,
}: {
    value: number;
    index: number;
    definitionId?: string;
    atlasImage: HTMLImageElement | null;
    slotRotate: number;
    isSelected?: boolean;
    variant: 'spotlight' | 'board-topdown';
}) {
    const geometry = new RoundedBoxGeometry(
        1.12,
        1.12,
        1.12,
        8,
        variant === 'board-topdown' ? 0.26 : 0.16,
    );
    const materials = PROTOTYPE_FACE_MATERIAL_ORDER.map((faceId, materialIndex) => {
        const displayFaceId = variant === 'board-topdown' && materialIndex === 2 ? value : faceId;
        const texture = createPrototypeFaceTexture(
            displayFaceId,
            atlasImage,
            resolveFallbackLabel(displayFaceId, definitionId),
        );
        return new THREE.MeshStandardMaterial({
            map: texture,
            color: variant === 'board-topdown' ? 0xf7f9fd : 0xffffff,
            roughness: variant === 'board-topdown' ? 0.46 : 0.46,
            metalness: variant === 'board-topdown' ? 0.06 : 0.18,
            emissive: new THREE.Color('#8fd8ff').multiplyScalar(variant === 'board-topdown' ? 0.004 : 0.045),
            envMapIntensity: variant === 'board-topdown' ? 0.34 : 0.8,
        });
    });
    const mesh = new THREE.Mesh(geometry, materials);
    if (variant === 'board-topdown') {
        materials.forEach((material) => {
            material.emissiveIntensity = 0.004;
            material.color.set(0xf7f9fd);
            material.envMapIntensity = 0.34;
            material.needsUpdate = true;
        });
    }
    const outlineMaterial = createOutlineShaderMaterial({
        color: 0x2c170d,
        opacity: isSelected ? 0.82 : 0.74,
        power: isSelected ? 1.52 : 1.72,
        intensity: isSelected ? 1.86 : 1.42,
        edgeOnly: variant === 'board-topdown',
    });
    const outlineShell = new THREE.Mesh(geometry, outlineMaterial);
    outlineShell.scale.setScalar(isSelected ? 1.07 : 1.058);
    const highlightMaterial = createOutlineShaderMaterial({
        color: 0xffc15a,
        opacity: variant === 'board-topdown' ? (isSelected ? 0.58 : 0) : (isSelected ? 0.66 : 0),
        power: variant === 'board-topdown' ? 1.24 : 2.12,
        intensity: variant === 'board-topdown' ? 1.18 : 1.78,
        edgeOnly: variant === 'board-topdown',
        blending: THREE.AdditiveBlending,
    });
    const highlightShell = new THREE.Mesh(geometry, highlightMaterial);
    highlightShell.scale.setScalar(variant === 'board-topdown'
        ? (isSelected ? 1.108 : 1.082)
        : (isSelected ? 1.122 : 1.076));
    outlineShell.visible = variant !== 'board-topdown';
    highlightShell.visible = variant !== 'board-topdown';
    mesh.add(outlineShell);
    mesh.add(highlightShell);
    const shadowMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        map: getBoardShadowTexture(),
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
        toneMapped: false,
    });
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 1.02), shadowMaterial);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.renderOrder = 1;
    shadowMesh.visible = true;
    if (variant === 'board-topdown') {
        shadowMesh.scale.set(1.28, 0.82, 1);
    }
    const selectionRingMaterial = new THREE.MeshBasicMaterial({
        color: 0xe3ae38,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        depthTest: true,
        blending: THREE.NormalBlending,
    });
    const selectionRingMesh = new THREE.Mesh(
        createSelectionSmileGeometry(1.3, 0.092, 0.18),
        selectionRingMaterial,
    );
    selectionRingMesh.renderOrder = 0;
    selectionRingMesh.visible = variant === 'board-topdown' && Boolean(isSelected);
    const selectionRingGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0x170d05,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        depthTest: true,
        blending: THREE.NormalBlending,
    });
    const selectionRingGlowMesh = new THREE.Mesh(
        createSelectionSmileGeometry(1.38, 0.104, 0.208),
        selectionRingGlowMaterial,
    );
    selectionRingGlowMesh.renderOrder = -1;
    selectionRingGlowMesh.visible = variant === 'board-topdown' && Boolean(isSelected);
    const slotQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, slotRotate, 'XYZ'));
    mesh.quaternion.copy(
        variant === 'board-topdown'
            ? buildTargetQuaternion(value, index, 'board-topdown')
            : buildTargetQuaternion(value, index, 'spotlight').multiply(slotQuat),
    );

    return {
        mesh,
        shadowMesh,
        selectionRingMesh,
        selectionRingGlowMesh,
        geometry,
        materials,
        outlineShell,
        outlineMaterial,
        highlightShell,
        highlightMaterial,
        shadowMaterial,
        selectionRingMaterial,
        selectionRingGlowMaterial,
        faceValue: value,
        targetQuat: mesh.quaternion.clone(),
        baseY: 0,
    };
}

function applyAngularVelocityQuaternion(
    quaternion: THREE.Quaternion,
    angularVelocity: THREE.Vector3,
    deltaSeconds: number,
) {
    const angularSpeed = angularVelocity.length();
    if (angularSpeed < 0.0001 || deltaSeconds <= 0) return;
    const axis = angularVelocity.clone().normalize();
    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angularSpeed * deltaSeconds);
    quaternion.premultiply(deltaQuat).normalize();
}

export const DiceField3D = ({
    dice,
    selectedDieIds = [],
    isRolling,
    rerollingDiceIds,
    locale,
    characterId = 'monk',
    slots,
    onDieClick,
    onProjectedDiceUpdate,
    physicsStates,
    physicsLayoutBounds,
    scenePreset = 'spotlight',
    canvasClassName,
}: DiceField3DProps) => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const underlayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const onDieClickRef = React.useRef(onDieClick);
    const onProjectedDiceUpdateRef = React.useRef(onProjectedDiceUpdate);
    const physicsStatesRef = React.useRef(physicsStates);
    const physicsLayoutBoundsRef = React.useRef(physicsLayoutBounds);
    const stateRef = React.useRef<{
        renderer: THREE.WebGLRenderer;
        composer?: EffectComposer;
        outlinePass?: OutlinePass;
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        resizeObserver?: ResizeObserver;
        rafId?: number;
        diceItems: Array<ReturnType<typeof createPrototypeDiceMesh> & {
            dieId: number;
            targetX: number;
            targetZ: number;
            posX: number;
            posZ: number;
            velocityX: number;
            velocityZ: number;
            bouncePhase: number;
            bounceAmplitude: number;
            spinX: number;
            spinY: number;
            spinZ: number;
            wasRolling: boolean;
            settledVisualX: number | null;
            settledVisualZ: number | null;
        }>;
        raycaster: THREE.Raycaster;
        pointer: THREE.Vector2;
        disposed: boolean;
    } | null>(null);
    const rollingRef = React.useRef({ isRolling, rerollingDiceIds });
    const selectedDieIdsRef = React.useRef(new Set<number>(selectedDieIds));
    const signature = React.useMemo(
        () => dice.map((die) => `${die.id}:${die.value}:${die.definitionId ?? ''}`).join('|'),
        [dice],
    );
    const firstDefinitionId = dice[0]?.definitionId;
    const spriteAssetPath = React.useMemo(
        () => getDiceSpriteAssetPath(firstDefinitionId, characterId),
        [characterId, firstDefinitionId],
    );
    const effectiveLocale = locale ?? 'zh-CN';
    const spriteCandidates = React.useMemo(
        () => (spriteAssetPath ? getLocalizedImageCandidateUrls(spriteAssetPath, effectiveLocale) : []),
        [effectiveLocale, spriteAssetPath],
    );

    React.useEffect(() => {
        rollingRef.current = { isRolling, rerollingDiceIds };
    }, [isRolling, rerollingDiceIds]);

    React.useEffect(() => {
        selectedDieIdsRef.current = new Set(selectedDieIds);
        const state = stateRef.current;
        if (!state) return;
        const isBoardTopdown = scenePreset === 'board-topdown';
        state.diceItems.forEach((item) => {
            const selected = selectedDieIdsRef.current.has(item.dieId);
            item.materials.forEach((material) => {
                if (!isBoardTopdown) return;
                material.emissiveIntensity = 0.004;
                material.color.set(0xf7f9fd);
                material.envMapIntensity = 0.34;
            });
            item.outlineMaterial.uniforms.uColor.value.set(
                0x2c170d,
            );
            item.outlineMaterial.uniforms.uOpacity.value = selected && isBoardTopdown ? 0 : 0.74;
            item.outlineMaterial.uniforms.uPower.value = 1.72;
            item.outlineMaterial.uniforms.uIntensity.value = selected && isBoardTopdown ? 0 : 1.42;
            item.outlineMaterial.uniforms.uSolid.value = 0;
            item.outlineMaterial.uniforms.uEdgeOnly.value = isBoardTopdown ? 1 : 0;
            item.outlineShell.renderOrder = 0;
            item.outlineShell.scale.setScalar(selected && isBoardTopdown ? BOARD_TOPDOWN_VISUAL_SCALE * 1.038 : 1.058);
            item.outlineShell.visible = !isBoardTopdown;
            item.highlightMaterial.uniforms.uColor.value.set(0xffc15a);
            item.highlightMaterial.uniforms.uOpacity.value = selected && isBoardTopdown ? 0 : 0;
            item.highlightMaterial.uniforms.uPower.value = 2.12;
            item.highlightMaterial.uniforms.uIntensity.value = selected && isBoardTopdown ? 0 : 1.12;
            item.highlightMaterial.uniforms.uSolid.value = 0;
            item.highlightMaterial.uniforms.uEdgeOnly.value = isBoardTopdown ? 1 : 0;
            item.highlightShell.renderOrder = 0;
            item.highlightShell.scale.setScalar(selected && isBoardTopdown ? BOARD_TOPDOWN_VISUAL_SCALE * 1.052 : 1.076);
            item.highlightShell.visible = !isBoardTopdown;
            item.mesh.scale.setScalar(isBoardTopdown ? BOARD_TOPDOWN_VISUAL_SCALE : 0.96);
            item.shadowMaterial.opacity = isBoardTopdown ? 0.34 : 0.58;
            item.shadowMesh.visible = true;
            item.shadowMesh.scale.set(
                isBoardTopdown ? BOARD_TOPDOWN_VISUAL_SCALE * 1.32 : 1.06,
                isBoardTopdown ? BOARD_TOPDOWN_VISUAL_SCALE * 0.76 : 0.76,
                1,
            );
            item.selectionRingMaterial.opacity = 0;
            item.selectionRingMesh.visible = false;
            item.selectionRingGlowMaterial.opacity = 0;
            item.selectionRingGlowMesh.visible = false;
        });
        if (isBoardTopdown && state.outlinePass) {
            state.outlinePass.selectedObjects = [];
        }
        if (isBoardTopdown && state.composer) {
            state.composer.render();
        } else {
            state.renderer.render(state.scene, state.camera);
        }
    }, [scenePreset, selectedDieIds]);

    React.useEffect(() => {
        onDieClickRef.current = onDieClick;
    }, [onDieClick]);

    React.useEffect(() => {
        onProjectedDiceUpdateRef.current = onProjectedDiceUpdate;
    }, [onProjectedDiceUpdate]);

    React.useEffect(() => {
        physicsStatesRef.current = physicsStates;
    }, [physicsStates]);

    React.useEffect(() => {
        physicsLayoutBoundsRef.current = physicsLayoutBounds;
    }, [physicsLayoutBounds]);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        const underlayCanvas = underlayCanvasRef.current;
        if (!canvas || !underlayCanvas || !isWebglCapable() || dice.length === 0) return;

        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance',
            });
        } catch (error) {
            dice3DLogger.warn('field-webgl-renderer-unavailable', {
                message: error instanceof Error ? error.message : String(error),
            });
            return;
        }

        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.92;
        renderer.shadowMap.enabled = false;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x070b10, scenePreset === 'board-topdown' ? 0.022 : 0.038);
        const camera = new THREE.PerspectiveCamera(scenePreset === 'board-topdown' ? 29 : 34, 1, 0.1, 100);
        if (scenePreset === 'board-topdown') {
            camera.position.set(-0.18, 5.9, 3.45);
            camera.lookAt(0.04, -1.42, 0.36);
        } else {
            camera.position.set(0, 2.05, 8.15);
            camera.lookAt(0, -0.88, 0);
        }

        const keyLight = new THREE.SpotLight(0xf7fbff, scenePreset === 'board-topdown' ? 170 : 260, 24, Math.PI / 5.6, 0.52, 1.1);
        keyLight.position.set(scenePreset === 'board-topdown' ? -1.45 : -3.6, scenePreset === 'board-topdown' ? 11.2 : 7.2, scenePreset === 'board-topdown' ? 0.62 : 5.2);
        scene.add(keyLight);
        scene.add(new THREE.HemisphereLight(0xe4efff, 0x17131a, scenePreset === 'board-topdown' ? 0.94 : 1.45));
        const shadowLight = scenePreset === 'board-topdown'
            ? new THREE.DirectionalLight(0xfafcff, 1.42)
            : null;
        if (shadowLight) {
            shadowLight.position.set(-0.38, 10.6, 0.22);
            shadowLight.target.position.set(0, -1.2, 0.03);
            shadowLight.castShadow = true;
            shadowLight.shadow.mapSize.set(2048, 2048);
            shadowLight.shadow.bias = -0.0003;
            shadowLight.shadow.normalBias = 0.014;
            shadowLight.shadow.camera.near = 1;
            shadowLight.shadow.camera.far = 14;
            shadowLight.shadow.camera.left = -4.2;
            shadowLight.shadow.camera.right = 4.2;
            shadowLight.shadow.camera.top = 4.2;
            shadowLight.shadow.camera.bottom = -4.2;
            scene.add(shadowLight);
            scene.add(shadowLight.target);
        }

        const rimLight = new THREE.PointLight(0x4ecfff, scenePreset === 'board-topdown' ? 54 : 120, 15);
        rimLight.position.set(scenePreset === 'board-topdown' ? 2.8 : 4.8, scenePreset === 'board-topdown' ? 4.8 : 3.2, scenePreset === 'board-topdown' ? 1.1 : 2.6);
        scene.add(rimLight);

        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(scenePreset === 'board-topdown' ? 2.85 : 3.45, 96),
            new THREE.MeshStandardMaterial({
                color: scenePreset === 'board-topdown' ? 0x141b28 : 0x0d1720,
                roughness: scenePreset === 'board-topdown' ? 0.84 : 0.72,
                metalness: 0.12,
                transparent: true,
                opacity: scenePreset === 'board-topdown' ? 0.08 : 0.58,
            }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = scenePreset === 'board-topdown' ? -1.55 : -1.72;
        floor.receiveShadow = false;
        scene.add(floor);

        const halo = scenePreset === 'board-topdown'
            ? null
            : new THREE.Mesh(
                new THREE.TorusGeometry(2.45, 0.018, 12, 160),
                new THREE.MeshBasicMaterial({ color: 0xffc44f, transparent: true, opacity: 0.55 }),
            );
        if (halo) {
            halo.rotation.x = -Math.PI / 2;
            halo.position.y = -1.62;
            scene.add(halo);
        }

        const composer = scenePreset === 'board-topdown' ? new EffectComposer(renderer) : undefined;
        const outlinePass = composer
            ? new OutlinePass(new THREE.Vector2(1, 1), scene, camera)
            : undefined;
        if (composer && outlinePass) {
            composer.addPass(new RenderPass(scene, camera));
            outlinePass.edgeStrength = 0;
            outlinePass.edgeGlow = 0;
            outlinePass.edgeThickness = 1;
            outlinePass.pulsePeriod = 0;
            outlinePass.visibleEdgeColor.set('#9a6517');
            outlinePass.hiddenEdgeColor.set('#2d1606');
            composer.addPass(outlinePass);
        }

        const diceGroup = new THREE.Group();
        scene.add(diceGroup);
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const initialAtlasImage = prioritizeWebglSpriteCandidates(spriteCandidates)
            .map((candidateUrl) => getPreloadedImageElement(candidateUrl))
            .find((img): img is HTMLImageElement => Boolean(img && img.complete && img.naturalWidth > 0))
            ?? null;
        let texturesReady = Boolean(initialAtlasImage);
        canvas.dataset.diceTexturesReady = texturesReady ? 'true' : 'false';

        const diceItems = dice.map((die, index) => {
            const slot = slots[index % slots.length];
            const item = createPrototypeDiceMesh({
                value: die.value,
                index,
                definitionId: die.definitionId,
                atlasImage: initialAtlasImage,
                slotRotate: parseDegValue(slot.rotate),
                isSelected: selectedDieIdsRef.current.has(die.id),
                variant: scenePreset === 'board-topdown' ? 'board-topdown' : 'spotlight',
            });
            const worldX = slot.world?.x ?? 0;
            const worldZ = slot.world?.z ?? 0;
            const worldY = slot.world?.y ?? -1.08;
            item.baseY = scenePreset === 'board-topdown' ? worldY - 0.035 : worldY;
            item.mesh.position.set(
                worldX,
                item.baseY,
                worldZ,
            );
            item.mesh.castShadow = false;
            item.mesh.receiveShadow = false;
            item.shadowMesh.position.set(worldX, floor.position.y + 0.01, worldZ);
            item.shadowMesh.scale.set(
                scenePreset === 'board-topdown' ? BOARD_TOPDOWN_VISUAL_SCALE * 1.32 : 1.06,
                scenePreset === 'board-topdown' ? BOARD_TOPDOWN_VISUAL_SCALE * 0.76 : 0.76,
                1,
            );
            item.mesh.scale.setScalar(scenePreset === 'board-topdown' ? BOARD_TOPDOWN_VISUAL_SCALE : 1.04);
            item.mesh.userData.dieId = die.id;
            item.mesh.userData.index = index;
            diceGroup.add(item.shadowMesh);
            diceGroup.add(item.selectionRingGlowMesh);
            diceGroup.add(item.selectionRingMesh);
            diceGroup.add(item.mesh);
            return {
                ...item,
                dieId: die.id,
                targetX: worldX,
                targetZ: worldZ,
                posX: worldX,
                posZ: worldZ,
                velocityX: 0,
                velocityZ: 0,
                bouncePhase: index * 0.75,
                bounceAmplitude: 0,
                spinX: 0.14 + (index * 0.01),
                spinY: 0.17 + (index * 0.012),
                spinZ: 0.05 + (index * 0.008),
                wasRolling: false,
                settledVisualX: null,
                settledVisualZ: null,
            };
        });

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const width = Math.max(1, rect.width);
            const height = Math.max(1, rect.height);
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            renderer.setSize(width, height, false);
            underlayCanvas.width = Math.max(1, Math.round(width * pixelRatio));
            underlayCanvas.height = Math.max(1, Math.round(height * pixelRatio));
            underlayCanvas.style.width = `${width}px`;
            underlayCanvas.style.height = `${height}px`;
            camera.aspect = width / height;
            if (scenePreset === 'board-topdown') {
                camera.position.x = width < 760 ? -0.14 : -0.18;
                camera.position.z = width < 760 ? 3.62 : 3.45;
                camera.position.y = width < 760 ? 6.18 : 5.9;
            } else {
                camera.position.z = width < 760 ? 8.9 : 8.15;
                camera.position.y = width < 760 ? 2.35 : 2.05;
            }
            if (scenePreset === 'board-topdown') {
                camera.lookAt(0.04, -1.42, 0.36);
            }
            camera.updateProjectionMatrix();
            if (scenePreset === 'board-topdown' && composer && outlinePass) {
                composer.setSize(width, height);
                outlinePass.setSize(width, height);
                composer.render();
            } else {
                renderer.render(scene, camera);
            }
        };

        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(resize)
            : undefined;
        observer?.observe(canvas);

        stateRef.current = {
            renderer,
            composer,
            outlinePass,
            scene,
            camera,
            resizeObserver: observer,
            diceItems,
            raycaster,
            pointer,
            disposed: false,
        };

        const replaceTextures = (atlasImage: HTMLImageElement | null) => {
            diceItems.forEach((item, dieIndex) => {
                const die = dice[dieIndex];
                PROTOTYPE_FACE_MATERIAL_ORDER.forEach((faceId, materialIndex) => {
                    const displayFaceId = scenePreset === 'board-topdown' && materialIndex === 2
                        ? (die?.value ?? item.faceValue)
                        : faceId;
                    const material = item.materials[materialIndex];
                    material.map?.dispose();
                    material.map = createPrototypeFaceTexture(
                        displayFaceId,
                        atlasImage,
                        resolveFallbackLabel(displayFaceId, die?.definitionId),
                    );
                    material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                    material.needsUpdate = true;
                });
            });
            texturesReady = true;
            canvas.dataset.diceTexturesReady = texturesReady ? 'true' : 'false';
            renderer.render(scene, camera);
        };

        const xBounds: [number, number] = scenePreset === 'board-topdown' ? [-2.26, 2.26] : [-2.35, 2.35];
        const zBounds: [number, number] = scenePreset === 'board-topdown' ? [-1.62, 1.5] : [-0.88, 0.88];
        const collisionRadius = scenePreset === 'board-topdown' ? BOARD_TOPDOWN_COLLISION_RADIUS : 0.78;

        const resolveDiceSeparation = () => {
            const maxIterations = scenePreset === 'board-topdown' ? 8 : 4;
            const centerX = (xBounds[0] + xBounds[1]) / 2;
            const centerZ = (zBounds[0] + zBounds[1]) / 2;
            for (let iteration = 0; iteration < maxIterations; iteration += 1) {
                let moved = false;
                for (let i = 0; i < diceItems.length; i += 1) {
                    for (let j = i + 1; j < diceItems.length; j += 1) {
                    const a = diceItems[i];
                    const b = diceItems[j];
                    const dx = b.posX - a.posX;
                    const dz = b.posZ - a.posZ;
                    let distance = Math.hypot(dx, dz);
                    if (distance < 0.0001) {
                        distance = 0.0001;
                    }
                    const minDistance = collisionRadius * 2;
                    if (distance >= minDistance) continue;

                    const overlap = minDistance - distance;
                    const fallbackAngle = ((i * 1.91) + (j * 2.47) + (iteration * 0.73)) % (Math.PI * 2);
                    const rawNx = distance <= 0.0002 ? Math.cos(fallbackAngle) : dx / distance;
                    const rawNz = distance <= 0.0002 ? Math.sin(fallbackAngle) : dz / distance;
                    const edgeBiasAx = a.posX > centerX ? -0.34 : 0.34;
                    const edgeBiasBx = b.posX > centerX ? -0.34 : 0.34;
                    const edgeBiasAz = a.posZ > centerZ ? -0.22 : 0.22;
                    const edgeBiasBz = b.posZ > centerZ ? -0.22 : 0.22;
                    const aPushX = ((-rawNx * overlap * 0.5) + (edgeBiasAx * overlap * 0.18));
                    const aPushZ = ((-rawNz * overlap * 0.5) + (edgeBiasAz * overlap * 0.12));
                    const bPushX = ((rawNx * overlap * 0.5) + (edgeBiasBx * overlap * 0.18));
                    const bPushZ = ((rawNz * overlap * 0.5) + (edgeBiasBz * overlap * 0.12));

                    const nextAX = THREE.MathUtils.clamp(a.posX + aPushX, xBounds[0], xBounds[1]);
                    const nextAZ = THREE.MathUtils.clamp(a.posZ + aPushZ, zBounds[0], zBounds[1]);
                    const nextBX = THREE.MathUtils.clamp(b.posX + bPushX, xBounds[0], xBounds[1]);
                    const nextBZ = THREE.MathUtils.clamp(b.posZ + bPushZ, zBounds[0], zBounds[1]);
                    moved = moved
                        || Math.abs(nextAX - a.posX) > 0.001
                        || Math.abs(nextAZ - a.posZ) > 0.001
                        || Math.abs(nextBX - b.posX) > 0.001
                        || Math.abs(nextBZ - b.posZ) > 0.001;
                    a.posX = nextAX;
                    a.posZ = nextAZ;
                    b.posX = nextBX;
                    b.posZ = nextBZ;

                    a.velocityX += aPushX * 0.06;
                    a.velocityZ += aPushZ * 0.06;
                    b.velocityX += bPushX * 0.06;
                    b.velocityZ += bPushZ * 0.06;
                    }
                }
                if (!moved) break;
            }
        };

        const projectDiceLayouts = () => {
            const callback = onProjectedDiceUpdateRef.current;
            if (!callback) return;
            const rect = canvas.getBoundingClientRect();
            const localHalfExtent = 0.59;
            const localCorners = [
                new THREE.Vector3(-localHalfExtent, -localHalfExtent, -localHalfExtent),
                new THREE.Vector3(localHalfExtent, -localHalfExtent, -localHalfExtent),
                new THREE.Vector3(-localHalfExtent, localHalfExtent, -localHalfExtent),
                new THREE.Vector3(localHalfExtent, localHalfExtent, -localHalfExtent),
                new THREE.Vector3(-localHalfExtent, -localHalfExtent, localHalfExtent),
                new THREE.Vector3(localHalfExtent, -localHalfExtent, localHalfExtent),
                new THREE.Vector3(-localHalfExtent, localHalfExtent, localHalfExtent),
                new THREE.Vector3(localHalfExtent, localHalfExtent, localHalfExtent),
            ];
            const layouts = diceItems.map((item) => {
                item.mesh.updateWorldMatrix(true, false);
                let minX = Number.POSITIVE_INFINITY;
                let maxX = Number.NEGATIVE_INFINITY;
                let minY = Number.POSITIVE_INFINITY;
                let maxY = Number.NEGATIVE_INFINITY;

                for (const localCorner of localCorners) {
                    const projectedCorner = localCorner.clone().applyMatrix4(item.mesh.matrixWorld).project(camera);
                    const pixelX = ((projectedCorner.x * 0.5) + 0.5) * rect.width;
                    const pixelY = ((-projectedCorner.y * 0.5) + 0.5) * rect.height;
                    minX = Math.min(minX, pixelX);
                    maxX = Math.max(maxX, pixelX);
                    minY = Math.min(minY, pixelY);
                    maxY = Math.max(maxY, pixelY);
                }

                const width = Math.max(46, (maxX - minX) * 0.94);
                const height = Math.max(46, (maxY - minY) * 0.88);
                const halfWidth = (width / 2) + (scenePreset === 'board-topdown' ? 18 : 6);
                const halfHeight = (height / 2) + (scenePreset === 'board-topdown' ? 18 : 6);
                const centerX = THREE.MathUtils.clamp((minX + maxX) / 2, halfWidth, Math.max(halfWidth, rect.width - halfWidth));
                const centerY = THREE.MathUtils.clamp((minY + maxY) / 2, halfHeight, Math.max(halfHeight, rect.height - halfHeight));
                return {
                    id: item.dieId,
                    x: centerX,
                    y: centerY,
                    width,
                    height,
                    minX,
                    maxX,
                    minY,
                    maxY,
                    selected: selectedDieIdsRef.current.has(item.dieId),
                    rotateX: item.mesh.rotation.x,
                    rotateY: item.mesh.rotation.y,
                    rotateZ: item.mesh.rotation.z,
                };
            });
            callback(layouts);
        };

        const resolveWorldPositionFromPhysicsLayout = (
            layout: { x: number; y: number },
            targetY: number,
            rect: DOMRect,
        ) => {
            const layoutBounds = physicsLayoutBoundsRef.current;
            const sourceX = layoutBounds
                ? (layoutBounds.left + ((layout.x / Math.max(rect.width, 1)) * layoutBounds.width)) * rect.width
                : layout.x;
            const sourceY = layoutBounds
                ? (layoutBounds.top + ((layout.y / Math.max(rect.height, 1)) * layoutBounds.height)) * rect.height
                : layout.y;
            const ndc = new THREE.Vector2(
                ((sourceX / Math.max(rect.width, 1)) * 2) - 1,
                -(((sourceY / Math.max(rect.height, 1)) * 2) - 1),
            );
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -targetY);
            const point = new THREE.Vector3();
            raycaster.setFromCamera(ndc, camera);
            if (!raycaster.ray.intersectPlane(plane, point)) return null;

            return {
                x: THREE.MathUtils.clamp(point.x, xBounds[0], xBounds[1]),
                z: THREE.MathUtils.clamp(point.z, zBounds[0], zBounds[1]),
            };
        };

        const tick = () => {
            const state = stateRef.current;
            if (!state || state.disposed) return;
            const rolling = rollingRef.current;
            const underlayCtx = underlayCanvas.getContext('2d');
            const stageRect = canvas.getBoundingClientRect();
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            const physicsStateMap = new Map(
                (physicsStatesRef.current ?? []).map((physicsState) => [physicsState.id, physicsState]),
            );
            const usesExternalPhysics = scenePreset === 'board-topdown' && physicsStateMap.size > 0;
            diceItems.forEach((item, dieIndex) => {
                const die = dice[dieIndex];
                const physicsState = usesExternalPhysics ? physicsStateMap.get(item.dieId) : undefined;
                if (physicsState) {
                    const worldPosition = resolveWorldPositionFromPhysicsLayout(
                        physicsState.layout,
                        item.baseY,
                        stageRect,
                    );
                    if (worldPosition) {
                        if (physicsState.settled) {
                            if (item.settledVisualX == null || item.settledVisualZ == null) {
                                item.settledVisualX = worldPosition.x;
                                item.settledVisualZ = worldPosition.z;
                            }
                            item.targetX = item.settledVisualX;
                            item.targetZ = item.settledVisualZ;
                            item.posX = item.settledVisualX;
                            item.posZ = item.settledVisualZ;
                        } else {
                            item.settledVisualX = null;
                            item.settledVisualZ = null;
                            item.targetX = worldPosition.x;
                            item.targetZ = worldPosition.z;
                            item.posX += (worldPosition.x - item.posX) * 0.88;
                            item.posZ += (worldPosition.z - item.posZ) * 0.88;
                        }
                    }
                    item.wasRolling = !physicsState.settled;
                    item.velocityX = 0;
                    item.velocityZ = 0;
                    item.bounceAmplitude = 0;
                    const visualQuat = getExternalPhysicsVisualQuaternion(die?.value ?? item.faceValue, dieIndex, physicsState);
                    if (physicsState.settled) {
                        item.targetQuat.copy(visualQuat);
                        item.mesh.quaternion.copy(visualQuat);
                        item.mesh.position.y = item.baseY;
                    } else {
                        item.mesh.quaternion.copy(visualQuat);
                        const motionLift = Math.max(0, physicsState.motion.y - item.baseY);
                        item.mesh.position.y = item.baseY + THREE.MathUtils.clamp(motionLift, 0, 0.52);
                    }
                    item.mesh.position.x = item.posX;
                    item.mesh.position.z = item.posZ;
                    return;
                }
                const dieRolling = rolling.isRolling || Boolean(die && rolling.rerollingDiceIds?.includes(die.id));
                const wasRolling = item.wasRolling;
                if (dieRolling) {
                    if (!wasRolling) {
                        if (scenePreset === 'board-topdown') {
                            const launchAngle = (-Math.PI * 0.9)
                                + ((dieIndex / Math.max(1, diceItems.length - 1)) * Math.PI * 1.72)
                                + ((Math.random() - 0.5) * 0.34);
                            const launchSpeedX = 0.22 + (Math.random() * 0.06);
                            const launchSpeedZ = 0.18 + (Math.random() * 0.05);
                            item.velocityX = Math.cos(launchAngle) * launchSpeedX;
                            item.velocityZ = Math.sin(launchAngle) * launchSpeedZ;
                            item.bounceAmplitude = 0.22 + (Math.random() * 0.06);
                            item.spinX = 0.13 + (Math.random() * 0.04);
                            item.spinY = 0.15 + (Math.random() * 0.05);
                            item.spinZ = 0.05 + (Math.random() * 0.03);
                        } else {
                            item.velocityX = (Math.random() - 0.5) * 0.18;
                            item.velocityZ = (Math.random() - 0.5) * 0.11;
                            item.bounceAmplitude = 0.58 + (Math.random() * 0.12);
                            item.spinX = 0.16 + (Math.random() * 0.06);
                            item.spinY = 0.18 + (Math.random() * 0.08);
                            item.spinZ = 0.06 + (Math.random() * 0.04);
                        }
                    }
                    item.wasRolling = true;
                    item.posX += item.velocityX;
                    item.posZ += item.velocityZ;
                    if (item.posX < xBounds[0] || item.posX > xBounds[1]) {
                        item.posX = THREE.MathUtils.clamp(item.posX, xBounds[0], xBounds[1]);
                        item.velocityX *= -0.82;
                    }
                    if (item.posZ < zBounds[0] || item.posZ > zBounds[1]) {
                        item.posZ = THREE.MathUtils.clamp(item.posZ, zBounds[0], zBounds[1]);
                        item.velocityZ *= -0.82;
                    }
                    item.velocityX *= scenePreset === 'board-topdown' ? 0.989 : 0.992;
                    item.velocityZ *= scenePreset === 'board-topdown' ? 0.989 : 0.992;
                    item.bounceAmplitude *= scenePreset === 'board-topdown' ? 0.976 : 0.985;
                    item.mesh.rotation.x += item.spinX;
                    item.mesh.rotation.y += item.spinY;
                    item.mesh.rotation.z += item.spinZ;
                    item.mesh.position.x = item.posX;
                    item.mesh.position.z = item.posZ;
                    item.mesh.position.y = item.baseY + Math.abs(Math.sin((performance.now() * 0.0105) + item.bouncePhase)) * item.bounceAmplitude;
                } else {
                    if (wasRolling) {
                        item.targetX = THREE.MathUtils.clamp(item.posX, xBounds[0], xBounds[1]);
                        item.targetZ = THREE.MathUtils.clamp(item.posZ, zBounds[0], zBounds[1]);
                        item.posX = item.targetX;
                        item.posZ = item.targetZ;
                        item.velocityX = 0;
                        item.velocityZ = 0;
                        item.bounceAmplitude = 0;
                    }
                    item.wasRolling = false;
                    item.posX += (item.targetX - item.posX) * 0.16;
                    item.posZ += (item.targetZ - item.posZ) * 0.16;
                    if (scenePreset === 'board-topdown') {
                        item.mesh.quaternion.copy(item.targetQuat);
                    } else {
                        item.mesh.quaternion.rotateTowards(item.targetQuat, 0.1);
                    }
                    item.mesh.position.x = item.posX;
                    item.mesh.position.z = item.posZ;
                    item.mesh.position.y += (item.baseY - item.mesh.position.y) * (scenePreset === 'board-topdown' ? 0.34 : 0.18);
                }
            });
            resolveDiceSeparation();
            if (usesExternalPhysics) {
                diceItems.forEach((item) => {
                    if (physicsStateMap.get(item.dieId)?.settled !== true) return;
                    item.targetX = item.posX;
                    item.targetZ = item.posZ;
                    item.settledVisualX = item.posX;
                    item.settledVisualZ = item.posZ;
                });
            }
            const debugWindow = window as Window & {
                __DT_RING_DEBUG__?: Array<{
                    dieId: number;
                    selected: boolean;
                    centerPixelY: number;
                    ringPixelY: number;
                    glowPixelY: number;
                    ringTopPixelY: number;
                    ringBottomPixelY: number;
                    glowTopPixelY: number;
                    glowBottomPixelY: number;
                    upperBias: number;
                    lowerBias: number;
                    ringTargetZ: number;
                    glowTargetZ: number;
                    ringScale: number;
                    glowScale: number;
                }>;
            };
            if (scenePreset === 'board-topdown') {
                debugWindow.__DT_RING_DEBUG__ = [];
            }
            diceItems.forEach((item) => {
                item.mesh.position.x = item.posX;
                item.mesh.position.z = item.posZ;
                const lift = Math.max(0, item.mesh.position.y - item.baseY);
                const shadowSpread = scenePreset === 'board-topdown'
                ? THREE.MathUtils.clamp(1.02 - (lift * 0.42), 0.76, 1.02)
                : THREE.MathUtils.clamp(1 - (lift * 0.26), 0.78, 1);
            item.shadowMesh.position.x = item.posX + (scenePreset === 'board-topdown' ? 0.018 : 0);
            item.shadowMesh.position.z = item.posZ + (scenePreset === 'board-topdown' ? 0.018 : 0);
            if (scenePreset === 'board-topdown') {
                item.selectionRingMaterial.opacity = 0;
                item.selectionRingGlowMaterial.opacity = 0;
                item.selectionRingMesh.visible = false;
                item.selectionRingGlowMesh.visible = false;
            } else {
                item.selectionRingGlowMesh.position.x = item.posX;
                item.selectionRingGlowMesh.position.z = item.posZ;
                item.selectionRingMesh.position.x = item.posX;
                item.selectionRingMesh.position.z = item.posZ;
                item.selectionRingGlowMesh.position.y = floor.position.y + 0.014;
                item.selectionRingMesh.position.y = floor.position.y + 0.017;
                item.selectionRingMesh.scale.setScalar(1);
                item.selectionRingGlowMesh.scale.setScalar(1);
            }
            item.shadowMesh.scale.set(
                shadowSpread * (scenePreset === 'board-topdown' ? BOARD_TOPDOWN_VISUAL_SCALE * 1.32 : 1),
                shadowSpread * (scenePreset === 'board-topdown' ? BOARD_TOPDOWN_VISUAL_SCALE * 0.76 : 0.8),
                1,
                );
                item.shadowMaterial.opacity = scenePreset === 'board-topdown'
                    ? THREE.MathUtils.clamp(0.5 - (lift * 0.36), 0.22, 0.5)
                    : THREE.MathUtils.clamp(0.18 - (lift * 0.18), 0.06, 0.18);
            });
            if (scenePreset === 'board-topdown' && underlayCtx) {
                underlayCtx.setTransform(1, 0, 0, 1, 0, 0);
                underlayCtx.clearRect(0, 0, underlayCanvas.width, underlayCanvas.height);
                underlayCtx.scale(pixelRatio, pixelRatio);
                const localHalfExtent = 0.59;
                const localCorners = [
                    new THREE.Vector3(-localHalfExtent, -localHalfExtent, -localHalfExtent),
                    new THREE.Vector3(localHalfExtent, -localHalfExtent, -localHalfExtent),
                    new THREE.Vector3(-localHalfExtent, localHalfExtent, -localHalfExtent),
                    new THREE.Vector3(localHalfExtent, localHalfExtent, -localHalfExtent),
                    new THREE.Vector3(-localHalfExtent, -localHalfExtent, localHalfExtent),
                    new THREE.Vector3(localHalfExtent, -localHalfExtent, localHalfExtent),
                    new THREE.Vector3(-localHalfExtent, localHalfExtent, localHalfExtent),
                    new THREE.Vector3(localHalfExtent, localHalfExtent, localHalfExtent),
                ];
                for (const item of diceItems) {
                    if (!selectedDieIdsRef.current.has(item.dieId)) continue;
                    item.mesh.updateWorldMatrix(true, false);
                    let minPixelX = Number.POSITIVE_INFINITY;
                    let maxPixelX = Number.NEGATIVE_INFINITY;
                    let minPixelY = Number.POSITIVE_INFINITY;
                    let maxPixelY = Number.NEGATIVE_INFINITY;
                    for (const localCorner of localCorners) {
                        const projectedCorner = localCorner.clone().applyMatrix4(item.mesh.matrixWorld).project(camera);
                        const pixelX = ((projectedCorner.x * 0.5) + 0.5) * stageRect.width;
                        const pixelY = ((-projectedCorner.y * 0.5) + 0.5) * stageRect.height;
                        minPixelX = Math.min(minPixelX, pixelX);
                        maxPixelX = Math.max(maxPixelX, pixelX);
                        minPixelY = Math.min(minPixelY, pixelY);
                        maxPixelY = Math.max(maxPixelY, pixelY);
                    }
                    const bboxWidth = maxPixelX - minPixelX;
                    const bboxHeight = maxPixelY - minPixelY;
                    const depthProgress = THREE.MathUtils.clamp(
                        (item.posZ - zBounds[0]) / (zBounds[1] - zBounds[0]),
                        0,
                        1,
                    );
                    const centerX = (minPixelX + maxPixelX) * 0.5;
                    const radiusX = Math.max(
                        bboxWidth * THREE.MathUtils.lerp(0.52, 0.48, depthProgress),
                        23,
                    );
                    const radiusY = Math.max(
                        bboxHeight * THREE.MathUtils.lerp(0.22, 0.2, depthProgress),
                        9,
                    );
                    const arcCenterY = maxPixelY - (bboxHeight * THREE.MathUtils.lerp(0.08, 0.06, depthProgress));
                    const shadowLineWidth = Math.max(4.2, radiusX * 0.08);
                    const mainLineWidth = Math.max(2.8, radiusX * 0.048);
                    const startAngle = Math.PI * 1.06;
                    const endAngle = Math.PI * 1.94;
                    underlayCtx.save();
                    underlayCtx.translate(centerX, arcCenterY);
                    underlayCtx.scale(1, radiusY / radiusX);
                    underlayCtx.beginPath();
                    underlayCtx.lineCap = 'round';
                    underlayCtx.lineWidth = shadowLineWidth;
                    underlayCtx.strokeStyle = `rgba(96, 48, 10, ${THREE.MathUtils.lerp(0.34, 0.24, depthProgress).toFixed(3)})`;
                    underlayCtx.arc(0, 0, radiusX, startAngle, endAngle);
                    underlayCtx.stroke();
                    underlayCtx.beginPath();
                    underlayCtx.lineCap = 'round';
                    underlayCtx.lineWidth = mainLineWidth;
                    underlayCtx.strokeStyle = `rgba(243, 190, 74, ${THREE.MathUtils.lerp(0.98, 0.88, depthProgress).toFixed(3)})`;
                    underlayCtx.arc(0, 0, radiusX, startAngle, endAngle);
                    underlayCtx.stroke();
                    underlayCtx.restore();
                }
            }
            const maxLift = diceItems.reduce(
                (max, item) => Math.max(max, Math.abs(item.mesh.position.y - item.baseY)),
                0,
            );
            const maxTravel = diceItems.reduce(
                (max, item) => Math.max(
                    max,
                    Math.abs(item.targetX - item.posX),
                    Math.abs(item.targetZ - item.posZ),
                ),
                0,
            );
            const diceSettled = !rolling.isRolling
                && texturesReady
                && maxLift <= 0.012
                && maxTravel <= 0.012
                && diceItems.every((item) => !item.wasRolling);
            const externalDiceSettled = usesExternalPhysics
                ? diceItems.every((item) => physicsStateMap.get(item.dieId)?.settled === true)
                : diceSettled;
            const visualDiceSettled = externalDiceSettled
                && texturesReady
                && maxLift <= 0.004
                && maxTravel <= 0.012
                && diceItems.every((item) => !item.wasRolling);
            canvas.dataset.diceSettled = externalDiceSettled ? 'true' : 'false';
            canvas.dataset.diceVisualSettled = visualDiceSettled ? 'true' : 'false';
            canvas.dataset.dicePhysicsSource = usesExternalPhysics ? 'dice-box-threejs' : 'internal';
            canvas.dataset.dicePhysicsMode = usesExternalPhysics ? 'physics-only' : 'self-rendered';
            canvas.dataset.diceMaxLift = maxLift.toFixed(4);
            canvas.dataset.diceMaxTravel = maxTravel.toFixed(4);
            canvas.dataset.diceAnyWasRolling = diceItems.some((item) => item.wasRolling) ? 'true' : 'false';
            diceGroup.rotation.y = Math.sin(performance.now() * 0.00024) * 0.02;
            diceGroup.position.y = 0;
            if (halo) {
                halo.rotation.z += 0.0022;
            }
            if (scenePreset === 'board-topdown' && composer) {
                composer.render();
            } else {
                renderer.render(scene, camera);
            }
            projectDiceLayouts();
            state.rafId = requestAnimationFrame(tick);
        };

        const handlePointerUp = (event: PointerEvent) => {
            const clickHandler = onDieClickRef.current;
            if (!clickHandler) return;
            const rect = canvas.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(diceItems.map((item) => item.mesh));
            const dieId = hits[0]?.object?.userData?.dieId;
            if (typeof dieId === 'number') {
                clickHandler(dieId);
            }
        };

        canvas.addEventListener('pointerup', handlePointerUp);
        resize();
        projectDiceLayouts();
        stateRef.current.rafId = requestAnimationFrame(tick);

        const fallbackTextureReadyTimer = window.setTimeout(() => {
            if (stateRef.current?.disposed || texturesReady) return;
            replaceTextures(initialAtlasImage);
        }, 180);

        void loadDiceAtlasImageShared(spriteCandidates).then((result) => {
            if (stateRef.current?.disposed) return;
            window.clearTimeout(fallbackTextureReadyTimer);
            replaceTextures(result?.img ?? null);
        });

        return () => {
            const state = stateRef.current;
            if (state) {
                state.disposed = true;
                if (state.rafId) cancelAnimationFrame(state.rafId);
                state.resizeObserver?.disconnect();
                state.outlinePass?.dispose();
                state.composer?.dispose();
                state.diceItems.forEach((item) => {
                    item.materials.forEach((material) => {
                        material.map?.dispose();
                        material.dispose();
                    });
                    item.outlineMaterial.dispose();
                    item.highlightMaterial.dispose();
                    item.shadowMaterial.dispose();
                    item.selectionRingMaterial.dispose();
                    item.selectionRingGlowMaterial.dispose();
                    item.shadowMesh.geometry.dispose();
                    item.selectionRingGlowMesh.geometry.dispose();
                    item.selectionRingMesh.geometry.dispose();
                    item.geometry.dispose();
                });
                floor.geometry.dispose();
                if (Array.isArray(floor.material)) {
                    floor.material.forEach((material) => material.dispose());
                } else {
                    floor.material.dispose();
                }
                if (halo) {
                    halo.geometry.dispose();
                    if (Array.isArray(halo.material)) {
                        halo.material.forEach((material) => material.dispose());
                    } else {
                        halo.material.dispose();
                    }
                }
                if (shadowLight?.shadow?.map) {
                    shadowLight.shadow.map.dispose();
                }
                shadowLight?.dispose();
            }
            window.clearTimeout(fallbackTextureReadyTimer);
            canvas.removeEventListener('pointerup', handlePointerUp);
            delete canvas.dataset.diceSettled;
            delete canvas.dataset.diceMaxLift;
            delete canvas.dataset.diceTexturesReady;
            renderer.dispose();
            stateRef.current = null;
        };
    }, [dice, scenePreset, signature, slots, spriteCandidates]);

    return (
        <>
            <canvas
                ref={underlayCanvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
                data-testid="dice-field-3d-underlay"
                aria-hidden="true"
            />
            <canvas
                ref={canvasRef}
                className={`pointer-events-none absolute inset-0 h-full w-full ${canvasClassName ?? ''}`}
                data-testid="dice-field-3d-canvas"
                aria-hidden="true"
            />
        </>
    );
};

function FallbackFaces({
    faces,
    isRolling,
    index,
    isSpotlight,
    isBoardTopdown,
    settledTransform,
    spriteReady,
    resolvedSpriteUrl,
    definitionId,
}: {
    faces: Array<{ id: number; trans: string }>;
    isRolling: boolean;
    index: number;
    isSpotlight: boolean;
    isBoardTopdown: boolean;
    settledTransform: string;
    spriteReady: boolean;
    resolvedSpriteUrl: string | null;
    definitionId?: string;
}) {
    const shellRadius = isSpotlight ? 'rounded-[0.34vw]' : (isBoardTopdown ? 'rounded-[0.28vw]' : 'rounded-[0.2vw]');
    const faceRadius = isSpotlight ? 'rounded-[0.7vw]' : (isBoardTopdown ? 'rounded-[0.52vw]' : 'rounded-[0.38vw]');
    const shellFaceInset = isSpotlight ? '-3.5%' : (isBoardTopdown ? '-3%' : '-2.5%');
    const decalInset = isSpotlight ? '12.5%' : (isBoardTopdown ? '12%' : '11.5%');
    const railFlightClass = isSpotlight || isBoardTopdown
        ? ''
        : `animate-dice3d-rail-flight-${index % 5}`;
    const shellFaceStyle = {
        background: 'linear-gradient(145deg, #fff8eb 0%, #f0e4cd 54%, #d8c7aa 100%)',
        boxShadow: isSpotlight
            ? 'inset -0.12rem -0.12rem 0.28rem rgba(134,104,61,0.12), inset 0.08rem 0.08rem 0.2rem rgba(255,255,255,0.28)'
            : 'inset -0.08rem -0.08rem 0.18rem rgba(134,104,61,0.1), inset 0.05rem 0.05rem 0.12rem rgba(255,255,255,0.2)',
    } as const;

    return (
        <div
            className={`relative w-full h-full dice3d-preserve-3d ${isRolling ? (railFlightClass || '') : ''}`}
            style={{
                transform: isRolling && !railFlightClass
                    ? `rotateX(${720 + index * 90}deg) rotateY(${720 + index * 90}deg)`
                    : settledTransform,
                transition: isRolling ? (railFlightClass ? 'none' : 'transform 900ms linear') : 'transform 360ms cubic-bezier(0.2, 0.7, 0.18, 1)',
            }}
        >
            {faces.map((face) => {
                const { xPos, yPos } = getDiceSpritePosition(face.id);
                const needsFlip = face.id === 1 || face.id === 6;
                const faceTransform = needsFlip ? `${face.trans} rotateZ(180deg)` : face.trans;
                const hasSprite = Boolean(spriteReady && resolvedSpriteUrl);
                const fallbackMeta = resolveFallbackLabel(face.id, definitionId);

                return (
                    <div
                        key={face.id}
                        className={`absolute dice3d-backface-hidden ${shellRadius} overflow-hidden`}
                        style={{
                            inset: shellFaceInset,
                            transform: faceTransform,
                            ...shellFaceStyle,
                        }}
                        data-face-id={face.id}
                        data-face-fallback={hasSprite ? 'false' : 'glyph'}
                        data-face-symbol={fallbackMeta.symbol}
                    >
                        <div
                            className={`absolute ${faceRadius} overflow-hidden flex items-center justify-center`}
                            style={{
                                inset: decalInset,
                                ...(hasSprite && resolvedSpriteUrl ? {
                                    backgroundImage: `url("${resolvedSpriteUrl}")`,
                                    backgroundSize: DICE_BG_SIZE,
                                    backgroundPosition: `${xPos}% ${yPos}%`,
                                    backgroundRepeat: 'no-repeat',
                                } : {
                                    backgroundColor: SHIMMER_BG.backgroundColor,
                                    backgroundImage: SHIMMER_BG.backgroundImage,
                                    backgroundSize: SHIMMER_BG.backgroundSize,
                                    backgroundPosition: SHIMMER_BG.backgroundPosition,
                                    backgroundRepeat: 'no-repeat',
                                    animation: SHIMMER_BG.animation,
                                }),
                                boxShadow: isSpotlight
                                    ? 'inset -0.2rem -0.25rem 0.5rem rgba(0,0,0,0.2), inset 0.15rem 0.12rem 0.25rem rgba(255,255,255,0.3)'
                                    : 'inset -0.12rem -0.12rem 0.22rem rgba(0,0,0,0.18), inset 0.08rem 0.08rem 0.16rem rgba(255,255,255,0.24)',
                                imageRendering: 'auto',
                            }}
                        >
                            {!hasSprite && (
                                <span
                                    className="pointer-events-none select-none text-slate-100 font-black uppercase tracking-[0.08em]"
                                    style={{
                                        fontSize: isSpotlight ? '1.5vw' : '1.1vw',
                                        textShadow: '0 0 0.4vw rgba(0, 0, 0, 0.75)',
                                        lineHeight: 1,
                                    }}
                                >
                                    {fallbackMeta.label}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function FlatRailFace({
    value,
    spriteReady,
    resolvedSpriteUrl,
    definitionId,
}: {
    value: number;
    spriteReady: boolean;
    resolvedSpriteUrl: string | null;
    definitionId?: string;
}) {
    const { xPos, yPos } = getDiceSpritePosition(value);
    const hasSprite = Boolean(spriteReady && resolvedSpriteUrl);
    const fallbackMeta = resolveFallbackLabel(value, definitionId);

    return (
        <div className="relative h-full w-full overflow-hidden rounded-[0.42vw] border border-[#d9bf7f] bg-[linear-gradient(160deg,_rgba(255,248,235,0.98)_0%,_rgba(239,228,205,0.98)_62%,_rgba(216,199,170,0.98)_100%)] shadow-[0_0.16vw_0.6vw_rgba(0,0,0,0.35)]">
            <div
                className="absolute inset-[8%] overflow-hidden rounded-[0.32vw] border border-white/65"
                data-flat-face-value={String(value)}
                data-flat-sprite-position={`${xPos},${yPos}`}
                style={hasSprite && resolvedSpriteUrl ? {
                    backgroundImage: `url("${resolvedSpriteUrl}")`,
                    backgroundSize: DICE_BG_SIZE,
                    backgroundPosition: `${xPos}% ${yPos}%`,
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: '#ffffff',
                } : {
                    backgroundColor: SHIMMER_BG.backgroundColor,
                    backgroundImage: SHIMMER_BG.backgroundImage,
                    backgroundSize: SHIMMER_BG.backgroundSize,
                    backgroundPosition: SHIMMER_BG.backgroundPosition,
                    backgroundRepeat: SHIMMER_BG.backgroundRepeat,
                    animation: SHIMMER_BG.animation,
                }}
            >
                {!hasSprite && (
                    <span
                        className="absolute inset-0 flex items-center justify-center select-none text-slate-100 font-black uppercase tracking-[0.08em]"
                        style={{
                            fontSize: '1.02vw',
                            textShadow: '0 0 0.35vw rgba(0, 0, 0, 0.72)',
                            lineHeight: 1,
                        }}
                    >
                        {fallbackMeta.label}
                    </span>
                )}
            </div>
            <div className="pointer-events-none absolute inset-x-[14%] top-[10%] h-[14%] rounded-full bg-white/42 blur-[0.12vw]" />
            <div className="pointer-events-none absolute inset-[7%] rounded-[0.34vw] shadow-[inset_0_-0.12vw_0.28vw_rgba(15,23,42,0.16)]" />
        </div>
    );
}

function WebglDice({
    value,
    isRolling,
    index,
    isSpotlight,
    isBoardTopdown,
    spriteCandidates,
    definitionId,
    overrideRotateX,
    overrideRotateY,
    overrideRotateZ,
    onUnavailable,
    onReady,
}: {
    value: number;
    isRolling: boolean;
    index: number;
    isSpotlight: boolean;
    isBoardTopdown: boolean;
    spriteCandidates: string[];
    definitionId?: string;
    overrideRotateX?: number;
    overrideRotateY?: number;
    overrideRotateZ?: number;
    onUnavailable: () => void;
    onReady?: () => void;
}) {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const stateRef = React.useRef<{
        renderer: THREE.WebGLRenderer;
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        cube: THREE.Group;
        shadowMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
        cubeGeometry: RoundedBoxGeometry;
        cubeMaterial: THREE.MeshStandardMaterial;
        outlineMaterial: OutlineShaderMaterial;
        decalGeometry: THREE.PlaneGeometry;
        faceMaterials: THREE.MeshBasicMaterial[];
        shadowMaterial: THREE.MeshBasicMaterial;
        resizeObserver?: ResizeObserver;
        rafId?: number;
        disposed: boolean;
    } | null>(null);
    const motionRef = React.useRef({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        angularVelocity: new THREE.Vector3(0, 0, 0),
        wasRolling: false,
        lastFrameAt: 0,
    });
    const rollingRef = React.useRef(isRolling);
    const readyNotifiedRef = React.useRef(false);
    const hasOverrideEuler = overrideRotateX !== undefined
        && overrideRotateY !== undefined
        && overrideRotateZ !== undefined;
    const targetQuatRef = React.useRef(
        hasOverrideEuler
            ? new THREE.Quaternion().setFromEuler(new THREE.Euler(
                overrideRotateX,
                overrideRotateY,
                overrideRotateZ,
            ))
            : buildTargetQuaternion(value, index, isSpotlight ? 'spotlight' : (isBoardTopdown ? 'board-topdown' : 'default')),
    );

    const applyMotionTransforms = React.useCallback(() => {
        const state = stateRef.current;
        if (!state) return;
        const motion = motionRef.current;
        state.cube.position.set(motion.x, motion.y, motion.z);
        const shadowOffsetX = motion.x * (isSpotlight ? 0.42 : 0.55);
        const shadowOffsetZ = motion.z * (isSpotlight ? 0.34 : 0.42);
        const shadowLift = THREE.MathUtils.clamp(motion.y, 0, 0.42);
        const shadowScale = THREE.MathUtils.clamp(1.02 - (shadowLift * 0.42), 0.76, 1.02);
        state.shadowMesh.position.set(shadowOffsetX, -0.62, shadowOffsetZ);
        state.shadowMesh.scale.set(shadowScale, shadowScale * 0.78, 1);
        state.shadowMaterial.opacity = THREE.MathUtils.clamp(0.26 - (shadowLift * 0.32), 0.08, 0.26);
    }, [isSpotlight]);

    const resetMotionState = React.useCallback(() => {
        motionRef.current = {
            x: 0,
            y: 0,
            z: 0,
            vx: 0,
            vy: 0,
            vz: 0,
            angularVelocity: new THREE.Vector3(0, 0, 0),
            wasRolling: false,
            lastFrameAt: 0,
        };
        applyMotionTransforms();
    }, [applyMotionTransforms]);

    const applyFaceTextures = React.useCallback((spriteImage: HTMLImageElement | null) => {
        const state = stateRef.current;
        if (!state) return;

        FACE_MATERIAL_ORDER.forEach((faceId, materialIndex) => {
            const material = state.faceMaterials[materialIndex];
            material.map?.dispose();
            material.map = createFaceTexture(
                faceId,
                spriteImage,
                resolveFallbackLabel(faceId, definitionId),
                isSpotlight,
            );
            material.opacity = 1;
            material.needsUpdate = true;
        });

        state.renderer.render(state.scene, state.camera);
    }, [definitionId, isSpotlight]);

    React.useEffect(() => {
        rollingRef.current = isRolling;
        targetQuatRef.current = hasOverrideEuler
            ? new THREE.Quaternion().setFromEuler(new THREE.Euler(
                overrideRotateX,
                overrideRotateY,
                overrideRotateZ,
            ))
            : buildTargetQuaternion(
                value,
                index,
                isSpotlight ? 'spotlight' : (isBoardTopdown ? 'board-topdown' : 'default'),
            );
        if (!isRolling) {
            motionRef.current.lastFrameAt = 0;
        }
    }, [hasOverrideEuler, index, isBoardTopdown, isRolling, isSpotlight, overrideRotateX, overrideRotateY, overrideRotateZ, value]);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !isWebglCapable()) return;

        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance',
            });
        } catch (error) {
            dice3DLogger.warn('webgl-renderer-unavailable', {
                message: error instanceof Error ? error.message : String(error),
            });
            onUnavailable();
            return;
        }
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(isSpotlight ? 28 : (isBoardTopdown ? 27 : 31), 1, 0.1, 20);
        camera.position.set(
            isSpotlight ? 1.55 : (isBoardTopdown ? 0.18 : 1.42),
            isSpotlight ? 1.22 : (isBoardTopdown ? 2.34 : 1.08),
            isSpotlight ? 2.65 : (isBoardTopdown ? 1.64 : 2.82),
        );
        camera.lookAt(0, 0, 0);

        const ambient = new THREE.AmbientLight(0xffffff, isSpotlight ? 1.8 : (isBoardTopdown ? 1.58 : 1.45));
        const hemi = new THREE.HemisphereLight(0xfff2dd, 0x5d4a2f, isSpotlight ? 1.55 : (isBoardTopdown ? 1.26 : 1.1));
        const key = new THREE.DirectionalLight(0xffffff, isSpotlight ? 2.6 : (isBoardTopdown ? 2.15 : 1.9));
        key.position.set(isBoardTopdown ? -1.2 : -1.7, isBoardTopdown ? 2.6 : 2.2, isBoardTopdown ? 1.7 : 2.8);
        const fill = new THREE.DirectionalLight(0xffe8c6, isSpotlight ? 1.1 : (isBoardTopdown ? 0.88 : 0.75));
        fill.position.set(isBoardTopdown ? 1.8 : 2.1, isBoardTopdown ? 1.2 : 0.6, isBoardTopdown ? 1.1 : 1.2);
        scene.add(ambient, hemi, key, fill);

        const cubeGeometry = new RoundedBoxGeometry(1, 1, 1, 7, isSpotlight ? 0.15 : (isBoardTopdown ? 0.145 : 0.135));
        const cubeMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#f2e3c8'),
            roughness: 0.7,
            metalness: 0.02,
        });
        const cubeShell = new THREE.Mesh(cubeGeometry, cubeMaterial);
        const outlineMaterial = createOutlineShaderMaterial({
            color: isBoardTopdown ? 0x4a2b14 : 0x4a3726,
            opacity: isBoardTopdown ? 0.9 : 0.72,
            power: isBoardTopdown ? 1.58 : 1.78,
            intensity: isBoardTopdown ? 1.9 : 1.2,
        });
        const outlineShell = new THREE.Mesh(cubeGeometry, outlineMaterial);
        outlineShell.scale.setScalar(isBoardTopdown ? 1.075 : 1.045);

        const decalGeometry = new THREE.PlaneGeometry(isSpotlight ? 0.88 : 0.9, isSpotlight ? 0.88 : 0.9);
        const faceMaterials = FACE_MATERIAL_ORDER.map(() => new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            alphaTest: 0.02,
            side: THREE.DoubleSide,
            depthWrite: false,
        }));
        const cube = new THREE.Group();
        cube.add(outlineShell);
        cube.add(cubeShell);

        FACE_MATERIAL_ORDER.forEach((faceId, materialIndex) => {
            const transform = FACE_DECAL_TRANSFORMS[faceId];
            const decal = new THREE.Mesh(decalGeometry, faceMaterials[materialIndex]);
            decal.position.set(...transform.position);
            decal.rotation.set(...transform.rotation);
            decal.renderOrder = 3;
            cube.add(decal);
        });

        const shadowMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            map: getBoardShadowTexture(),
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            toneMapped: false,
        });
        const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.92), shadowMaterial);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = -0.62;
        shadowMesh.renderOrder = 0;
        scene.add(shadowMesh);
        scene.add(cube);
        cube.quaternion.copy(targetQuatRef.current);
        resetMotionState();

        const render = () => {
            renderer.render(scene, camera);
        };

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const width = Math.max(1, rect.width);
            const height = Math.max(1, rect.height);
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            render();
        };

        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(resize)
            : undefined;
        observer?.observe(canvas);
        resize();
        if (!readyNotifiedRef.current) {
            readyNotifiedRef.current = true;
            onReady?.();
        }

        stateRef.current = {
            renderer,
            scene,
            camera,
            cube,
            shadowMesh,
            cubeGeometry,
            cubeMaterial,
            outlineMaterial,
            decalGeometry,
            faceMaterials,
            shadowMaterial,
            resizeObserver: observer,
            disposed: false,
        };

        const tick = () => {
            const state = stateRef.current;
            if (!state || state.disposed) return;
            const motion = motionRef.current;
            const now = performance.now();
            const deltaSeconds = motion.lastFrameAt > 0
                ? THREE.MathUtils.clamp((now - motion.lastFrameAt) / 1000, 1 / 120, 1 / 24)
                : 1 / 60;
            motion.lastFrameAt = now;

            if (rollingRef.current) {
                if (!motion.wasRolling) {
                    const lateralBias = ((index % 3) - 1) * 0.05;
                    motion.x = lateralBias;
                    motion.y = 0.12 + (Math.random() * 0.04);
                    motion.z = -0.06 + ((Math.random() - 0.5) * 0.08);
                    motion.vx = lateralBias * -1.15 + ((Math.random() - 0.5) * 0.7);
                    motion.vy = 3.6 + (Math.random() * 0.8);
                    motion.vz = 1.2 + (Math.random() * 0.55);
                    motion.angularVelocity.set(
                        8.6 + (Math.random() * 2.1),
                        10.2 + (Math.random() * 2.4),
                        4.6 + (Math.random() * 1.4),
                    );
                    motion.wasRolling = true;
                }

                motion.vy -= 11.8 * deltaSeconds;
                motion.x += motion.vx * deltaSeconds;
                motion.y += motion.vy * deltaSeconds;
                motion.z += motion.vz * deltaSeconds;

                if (motion.y < 0) {
                    motion.y = 0;
                    motion.vy = Math.abs(motion.vy) * 0.54;
                    motion.angularVelocity.x += (-motion.vz * 1.8) * deltaSeconds;
                    motion.angularVelocity.z += (motion.vx * 1.8) * deltaSeconds;
                    if (motion.vy < 0.16) {
                        motion.vy = 0;
                    }
                }
                if (motion.x < -0.42 || motion.x > 0.42) {
                    motion.x = THREE.MathUtils.clamp(motion.x, -0.42, 0.42);
                    motion.vx *= -0.72;
                    motion.angularVelocity.z *= -0.8;
                }
                if (motion.z < -0.24 || motion.z > 0.28) {
                    motion.z = THREE.MathUtils.clamp(motion.z, -0.24, 0.28);
                    motion.vz *= -0.7;
                    motion.angularVelocity.x *= -0.8;
                }

                const grounded = motion.y === 0;
                const linearDamping = grounded ? 2.8 : 0.18;
                const angularDamping = grounded ? 1.65 : 0.22;
                const linearDampingFactor = Math.exp(-linearDamping * deltaSeconds);
                motion.vx *= linearDampingFactor;
                motion.vz *= linearDampingFactor;
                motion.angularVelocity.multiplyScalar(Math.exp(-angularDamping * deltaSeconds));
                applyAngularVelocityQuaternion(cube.quaternion, motion.angularVelocity, deltaSeconds);
            } else {
                motion.wasRolling = false;
                motion.vx += (0 - motion.x) * 3.2 * deltaSeconds;
                motion.vz += (0 - motion.z) * 3.2 * deltaSeconds;
                motion.vy -= 10.6 * deltaSeconds;
                motion.x += motion.vx * deltaSeconds;
                motion.y += motion.vy * deltaSeconds;
                motion.z += motion.vz * deltaSeconds;

                if (motion.y < 0) {
                    motion.y = 0;
                    motion.vy *= -0.34;
                    motion.angularVelocity.x += (-motion.vz * 1.4) * deltaSeconds;
                    motion.angularVelocity.z += (motion.vx * 1.4) * deltaSeconds;
                    if (Math.abs(motion.vy) < 0.08) {
                        motion.vy = 0;
                    }
                }
                const grounded = motion.y === 0;
                const linearDampingFactor = Math.exp(-(grounded ? 4.9 : 0.22) * deltaSeconds);
                motion.vx *= linearDampingFactor;
                motion.vz *= linearDampingFactor;
                motion.angularVelocity.multiplyScalar(Math.exp(-(grounded ? 4.2 : 0.28) * deltaSeconds));
                applyAngularVelocityQuaternion(cube.quaternion, motion.angularVelocity, deltaSeconds);
                if (
                    grounded
                    && Math.hypot(motion.vx, motion.vy, motion.vz) < 0.22
                    && motion.angularVelocity.length() < 1.1
                ) {
                    cube.quaternion.rotateTowards(
                        targetQuatRef.current,
                        deltaSeconds * (isSpotlight ? 5.4 : 6.2),
                    );
                }
                if (
                    cube.quaternion.angleTo(targetQuatRef.current) < 0.0015
                    && Math.abs(motion.x) < 0.003
                    && Math.abs(motion.y) < 0.003
                    && Math.abs(motion.z) < 0.003
                    && Math.abs(motion.vx) < 0.002
                    && Math.abs(motion.vy) < 0.002
                    && Math.abs(motion.vz) < 0.002
                ) {
                    cube.quaternion.copy(targetQuatRef.current);
                    motion.x = 0;
                    motion.y = 0;
                    motion.z = 0;
                    motion.vx = 0;
                    motion.vy = 0;
                    motion.vz = 0;
                    motion.angularVelocity.set(0, 0, 0);
                }
            }

            applyMotionTransforms();
            renderer.render(scene, camera);
            state.rafId = requestAnimationFrame(() => tick());
        };

        const initialSpriteImage = prioritizeWebglSpriteCandidates(spriteCandidates)
            .map((candidateUrl) => getPreloadedImageElement(candidateUrl))
            .find(hasUsableSpriteImage) ?? null;
        applyFaceTextures(initialSpriteImage);
        render();
        stateRef.current.rafId = requestAnimationFrame(() => tick());

        return () => {
            motionRef.current.lastFrameAt = 0;
            const state = stateRef.current;
            if (state) {
                state.disposed = true;
                if (state.rafId) cancelAnimationFrame(state.rafId);
                state.resizeObserver?.disconnect();
                state.faceMaterials.forEach((material) => {
                    material.map?.dispose();
                    material.dispose();
                });
                state.decalGeometry.dispose();
                state.cubeGeometry.dispose();
                state.cubeMaterial.dispose();
                state.outlineMaterial.dispose();
                state.shadowMesh.geometry.dispose();
                state.shadowMaterial.dispose();
            }
            renderer.dispose();
            stateRef.current = null;
            readyNotifiedRef.current = false;
        };
    }, [applyFaceTextures, applyMotionTransforms, index, isBoardTopdown, isSpotlight, onReady, onUnavailable, resetMotionState, spriteCandidates]);

    React.useEffect(() => {
        let cancelled = false;
        const webglSpriteCandidates = prioritizeWebglSpriteCandidates(spriteCandidates);
        const immediateImage = webglSpriteCandidates
            .map((candidateUrl) => getPreloadedImageElement(candidateUrl))
            .find(hasUsableSpriteImage) ?? null;
        if (immediateImage) {
            applyFaceTextures(immediateImage);
            return () => {
                cancelled = true;
            };
        }

        void loadDiceAtlasImageShared(webglSpriteCandidates).then((result) => {
            if (cancelled) return;
            applyFaceTextures(result?.img ?? null);
        });

        return () => {
            cancelled = true;
        };
    }, [applyFaceTextures, spriteCandidates]);

    return (
        <div className="relative h-full w-full">
            <canvas
                ref={canvasRef}
                className="block h-full w-full"
                data-testid="dice-3d-canvas"
                aria-hidden="true"
            />
        </div>
    );
}

/** 3D 骰子组件 */
export const Dice3D = ({
    value,
    isRolling,
    size = '4.5vw',
    locale,
    index = 0,
    variant = 'default',
    characterId = 'monk',
    definitionId,
    enableWebgl = true,
    overrideTransform,
    overrideRotateX,
    overrideRotateY,
    overrideRotateZ,
}: Dice3DProps) => {
    const translateZ = `calc(${size} / 2)`;
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const lastInspectKeyRef = React.useRef<string | null>(null);
    const spriteAssetPath = React.useMemo(
        () => getDiceSpriteAssetPath(definitionId, characterId),
        [characterId, definitionId],
    );
    const effectiveLocale = locale ?? 'zh-CN';
    const spriteCandidates = React.useMemo(
        () => (spriteAssetPath ? getLocalizedImageCandidateUrls(spriteAssetPath, effectiveLocale) : []),
        [effectiveLocale, spriteAssetPath],
    );
    const loadedSpriteUrl = React.useMemo(
        () => resolveLoadedSpriteUrl(spriteCandidates, spriteAssetPath, effectiveLocale),
        [effectiveLocale, spriteAssetPath, spriteCandidates],
    );
    const spriteStateKey = `${spriteAssetPath ?? ''}|${effectiveLocale}`;

    const faces = React.useMemo(() => ([
        { id: 1, trans: `translateZ(${translateZ})` },
        { id: 6, trans: `rotateY(180deg) rotateZ(180deg) translateZ(${translateZ})` },
        { id: 3, trans: `rotateY(90deg) translateZ(${translateZ})` },
        { id: 4, trans: `rotateY(-90deg) translateZ(${translateZ})` },
        { id: 2, trans: `rotateX(90deg) translateZ(${translateZ})` },
        { id: 5, trans: `rotateX(-90deg) translateZ(${translateZ})` },
    ]), [translateZ]);

    const [spriteState, setSpriteState] = React.useState(() => ({
        key: spriteStateKey,
        resolvedSpriteUrl: loadedSpriteUrl || spriteCandidates[0] || null,
        isSpriteReady: Boolean(loadedSpriteUrl),
    }));
    const currentSpriteState = spriteState.key === spriteStateKey
        ? spriteState
        : {
            key: spriteStateKey,
            resolvedSpriteUrl: loadedSpriteUrl || spriteCandidates[0] || null,
            isSpriteReady: Boolean(loadedSpriteUrl),
        };
    const { resolvedSpriteUrl, isSpriteReady } = currentSpriteState;
    const [webglUnavailable, setWebglUnavailable] = React.useState(false);
    const [webglReady, setWebglReady] = React.useState(false);
    const handleWebglUnavailable = React.useCallback(() => {
        setWebglUnavailable(true);
    }, []);

    React.useEffect(() => {
        if (typeof document === 'undefined') return;
        if (document.getElementById(DICE3D_STYLE_ELEMENT_ID)) return;
        const style = document.createElement('style');
        style.id = DICE3D_STYLE_ELEMENT_ID;
        style.textContent = DICE3D_STYLE_TEXT;
        document.head.appendChild(style);
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        if (!spriteAssetPath) return () => {
            cancelled = true;
        };

        if (loadedSpriteUrl) {
            setSpriteState((current) => {
                if (current.isSpriteReady && current.resolvedSpriteUrl === loadedSpriteUrl) return current;
                return {
                    key: spriteStateKey,
                    resolvedSpriteUrl: loadedSpriteUrl,
                    isSpriteReady: true,
                };
            });
            return () => {
                cancelled = true;
            };
        }

        if (spriteCandidates.length === 0) {
            setSpriteState(() => ({
                key: spriteStateKey,
                resolvedSpriteUrl: null,
                isSpriteReady: false,
            }));
            return () => {
                cancelled = true;
            };
        }

        setSpriteState((current) => ({
            key: spriteStateKey,
            resolvedSpriteUrl: current.resolvedSpriteUrl ?? spriteCandidates[0] ?? null,
            isSpriteReady: false,
        }));

        void loadDiceSpriteCandidatesShared(spriteCandidates).then((result) => {
            if (cancelled || !result) {
                return;
            }

            markImageLoaded(spriteAssetPath, effectiveLocale, result.img);
            setSpriteState(() => ({
                key: spriteStateKey,
                resolvedSpriteUrl: result.url,
                isSpriteReady: true,
            }));
        });

        return () => {
            cancelled = true;
        };
    }, [effectiveLocale, loadedSpriteUrl, spriteAssetPath, spriteCandidates, spriteStateKey]);

    React.useEffect(() => {
        dice3DLogger.debug('sprite-resolved', {
            definitionId: definitionId ?? null,
            characterId,
            locale: effectiveLocale,
            spriteAssetPath: spriteAssetPath ?? null,
            spriteUrl: resolvedSpriteUrl ?? null,
            isSpriteReady,
        });
    }, [characterId, definitionId, effectiveLocale, isSpriteReady, resolvedSpriteUrl, spriteAssetPath]);

    const isSpotlight = variant === 'spotlight';
    const isBoardTopdown = variant === 'board-topdown';
    const hasWebgl = enableWebgl && !webglUnavailable && isWebglCapable();
    const showFlatRailFallback = !isSpotlight && !isBoardTopdown;

    React.useEffect(() => {
        if (!hasWebgl) {
            setWebglReady(false);
        }
    }, [hasWebgl]);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const root = rootRef.current;
        if (!root) return;
        const inspectKey = [
            resolvedSpriteUrl ?? 'null',
            isSpriteReady ? 'ready' : 'not-ready',
            size,
            value,
        ].join('|');
        if (lastInspectKeyRef.current === inspectKey) return;
        lastInspectKeyRef.current = inspectKey;

        const faceEl = root.querySelector('[data-face-id="1"]') as HTMLElement | null;
        if (!faceEl) {
            dice3DLogger.warn('sprite-inspect-missing-face', {
                definitionId: definitionId ?? null,
                characterId,
                locale: locale ?? null,
            });
            return;
        }

        const style = window.getComputedStyle(faceEl);
        dice3DLogger.info('sprite-inspect', {
            definitionId: definitionId ?? null,
            characterId,
            locale: locale ?? null,
            spriteUrl: resolvedSpriteUrl ?? null,
            isSpriteReady,
            size,
            value,
            diceBgSize: DICE_BG_SIZE,
            backgroundImage: style.backgroundImage,
            backgroundSize: style.backgroundSize,
            backgroundPosition: style.backgroundPosition,
            backgroundRepeat: style.backgroundRepeat,
            opacity: style.opacity,
            visibility: style.visibility,
            display: style.display,
        });
    }, [characterId, definitionId, isSpriteReady, locale, resolvedSpriteUrl, size, value]);

    const animationClass = isSpotlight ? 'animate-dice3d-bonus-tumble' : 'animate-dice3d-tumble';
    const settledTransform = isSpotlight
        ? `rotateX(-0.28rad) rotateY(0.33rad) rotateZ(-0.05rad)`
        : (isBoardTopdown
            ? `rotateX(-1.18rad) rotateY(${0.38 + (index * 0.07)}rad) rotateZ(${(-0.1 + (index * 0.035)).toFixed(2)}rad)`
            : `rotateX(0deg) rotateY(0deg)`);
    const fallbackTransform = overrideTransform ?? settledTransform;
    const usePhysicsDrivenFallback = isBoardTopdown && !hasWebgl && Boolean(overrideTransform);
    const railShadowClass = !isSpotlight && !isBoardTopdown && isRolling ? 'animate-dice3d-rail-shadow' : '';
    const isRailVariant = !isSpotlight && !isBoardTopdown;

    const getLegacyRailTransform = (faceValue: number) => {
        switch (faceValue) {
            case 1: return 'rotateX(0deg) rotateY(0deg)';
            case 6: return 'rotateX(180deg) rotateY(0deg)';
            case 2: return 'rotateX(-90deg) rotateY(0deg)';
            case 5: return 'rotateX(90deg) rotateY(0deg)';
            case 3: return 'rotateX(0deg) rotateY(-90deg)';
            case 4: return 'rotateX(0deg) rotateY(90deg)';
            default: return 'rotateY(0deg)';
        }
    };

    if (isRailVariant) {
        return (
            <div
                ref={rootRef}
                className="relative dice3d-perspective"
                style={{ width: size, height: size }}
                data-testid="dice-3d"
                data-sprite-ready={isSpriteReady ? 'true' : 'false'}
                data-definition-id={definitionId ?? ''}
                data-sprite-url={resolvedSpriteUrl ?? ''}
            >
                <div
                    className={`relative w-full h-full dice3d-preserve-3d ${isRolling ? animationClass : ''}`}
                    style={{
                        transform: isRolling
                            ? `rotateX(${720 + index * 90}deg) rotateY(${720 + index * 90}deg)`
                            : getLegacyRailTransform(value),
                        transition: isRolling ? 'none' : 'transform 1000ms ease-out',
                    }}
                >
                    {faces.map((face) => {
                        const { xPos, yPos } = getDiceSpritePosition(face.id);
                        const needsFlip = face.id === 1 || face.id === 6;
                        const faceTransform = needsFlip ? `${face.trans} rotateZ(180deg)` : face.trans;
                        const hasSprite = Boolean(isSpriteReady && resolvedSpriteUrl);
                        const fallbackMeta = resolveFallbackLabel(face.id, definitionId);

                        return (
                            <div
                                key={face.id}
                                className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[0.5vw] border border-slate-700/50 bg-slate-900 shadow-inner dice3d-backface-hidden"
                                style={{
                                    transform: faceTransform,
                                    ...(hasSprite && resolvedSpriteUrl ? {
                                        backgroundImage: `url("${resolvedSpriteUrl}")`,
                                        backgroundSize: DICE_BG_SIZE,
                                        backgroundPosition: `${xPos}% ${yPos}%`,
                                        backgroundRepeat: 'no-repeat',
                                    } : {
                                        backgroundColor: SHIMMER_BG.backgroundColor,
                                        backgroundImage: SHIMMER_BG.backgroundImage,
                                        backgroundSize: SHIMMER_BG.backgroundSize,
                                        backgroundPosition: SHIMMER_BG.backgroundPosition,
                                        backgroundRepeat: 'no-repeat',
                                        animation: SHIMMER_BG.animation,
                                    }),
                                    boxShadow: 'inset 0 0 1vw rgba(0,0,0,0.8)',
                                    imageRendering: 'auto',
                                }}
                                data-face-id={face.id}
                                data-face-fallback={hasSprite ? 'false' : 'glyph'}
                                data-face-symbol={fallbackMeta.symbol}
                            >
                                {!hasSprite && (
                                    <span
                                        className="pointer-events-none select-none text-[1.1vw] font-black uppercase tracking-[0.08em] text-slate-100"
                                        style={{
                                            textShadow: '0 0 0.4vw rgba(0, 0, 0, 0.75)',
                                            lineHeight: 1,
                                        }}
                                    >
                                        {fallbackMeta.label}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={rootRef}
            className="relative dice3d-perspective"
            style={{
                width: size,
                height: size,
                perspective: isSpotlight ? '1400px' : (isBoardTopdown ? '1800px' : undefined),
                filter: isSpotlight
                    ? 'drop-shadow(0 18px 18px rgba(0,0,0,0.45))'
                    : (isBoardTopdown
                        ? 'drop-shadow(0 0 1.25px rgba(255,248,232,0.72)) drop-shadow(0 0 0.85px rgba(8,16,28,0.94)) drop-shadow(0 14px 16px rgba(0,0,0,0.34))'
                        : undefined),
            }}
            data-testid="dice-3d"
            data-sprite-ready={isSpriteReady ? 'true' : 'false'}
            data-definition-id={definitionId ?? ''}
            data-sprite-url={resolvedSpriteUrl ?? ''}
        >
            {!hasWebgl && !isSpotlight && !isBoardTopdown && (
                <div
                    className={`pointer-events-none absolute left-[10%] right-[10%] bottom-[2%] h-[18%] rounded-full bg-black/30 blur-[0.18vw] ${railShadowClass}`}
                    aria-hidden="true"
                />
            )}
            {showFlatRailFallback && (!hasWebgl || !webglReady) && (
                <div className="absolute inset-0">
                    <FlatRailFace
                        value={value}
                        spriteReady={isSpriteReady}
                        resolvedSpriteUrl={resolvedSpriteUrl}
                        definitionId={definitionId}
                    />
                </div>
            )}
            {hasWebgl ? (
                <div
                    className="relative h-full w-full transition-opacity duration-150"
                    style={{ opacity: showFlatRailFallback && !webglReady ? 0 : 1 }}
                >
                    <WebglDice
                        value={value}
                        isRolling={isRolling}
                        index={index}
                        isSpotlight={isSpotlight}
                        isBoardTopdown={isBoardTopdown}
                        spriteCandidates={spriteCandidates}
                        definitionId={definitionId}
                        overrideRotateX={overrideRotateX}
                        overrideRotateY={overrideRotateY}
                        overrideRotateZ={overrideRotateZ}
                        onUnavailable={handleWebglUnavailable}
                        onReady={() => setWebglReady(true)}
                    />
                </div>
            ) : (
                showFlatRailFallback ? null : (
                    <div
                        className={`relative h-full w-full dice3d-preserve-3d ${isRolling && !usePhysicsDrivenFallback ? animationClass : ''}`}
                        style={{
                            transform: usePhysicsDrivenFallback
                                ? fallbackTransform
                                : (isRolling
                                ? `rotateX(${720 + index * 90}deg) rotateY(${720 + index * 90}deg)`
                                : fallbackTransform),
                            transition: isRolling && !usePhysicsDrivenFallback ? 'none' : 'transform 75ms linear',
                        }}
                    >
                        <FallbackFaces
                            faces={faces}
                            isRolling={isRolling}
                            index={index}
                            isSpotlight={isSpotlight}
                            isBoardTopdown={isBoardTopdown}
                            settledTransform={fallbackTransform}
                            spriteReady={isSpriteReady}
                            resolvedSpriteUrl={resolvedSpriteUrl}
                            definitionId={definitionId}
                        />
                    </div>
                )
            )}
            <div
                className="pointer-events-none absolute inset-0 opacity-0"
                aria-hidden="true"
            >
                <FallbackFaces
                    faces={faces}
                    isRolling={isRolling}
                    index={index}
                    isSpotlight={isSpotlight}
                    isBoardTopdown={isBoardTopdown}
                    settledTransform={fallbackTransform}
                    spriteReady={isSpriteReady}
                    resolvedSpriteUrl={resolvedSpriteUrl}
                    definitionId={definitionId}
                />
            </div>
        </div>
    );
};

export default Dice3D;
