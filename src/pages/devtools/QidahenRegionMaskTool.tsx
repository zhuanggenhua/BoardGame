import React from 'react';
import { Link } from 'react-router-dom';
import {
    Eraser,
    Eye,
    EyeOff,
    Link2,
    Pencil,
    Plus,
    RotateCcw,
    Route,
    Save,
    Upload,
    WandSparkles,
    X,
} from 'lucide-react';
import { getLocalAssetPath } from '../../core';
import { QIDAHEN_MAP_REGION_SHAPES } from '../../games/qidahen/ui/mapRegions';
import {
    EMPTY_REGION,
    applyBrushToBinaryMask,
    applyBrushToAssignments,
    buildBarrierMask,
    buildBarrierInteriorSelectionMask,
    createMaskClippedBarrier,
    buildRadialBoundarySelectionMask,
    buildRadialBoundaryStrokeMask,
    buildGradientBarrierMask,
    buildMaskBoundaryRing,
    buildMaskPixelBuffer,
    buildRegionOutlinePixelBuffer,
    composeBarrierMask,
    closeBinaryMask,
    computeRegionCenters,
    countMaskPixels,
    createRegionAssignments,
    expandBinaryMask,
    fillMaskInternalHoles,
    floodFillColorBoundedArea,
    floodFillContiguousArea,
    getBinaryMaskBounds,
    getRegionComponentSummary,
    hexToRgb,
    growMaskTowardBoundary,
    analyzeMaskBoundaryChainsNearSupport,
    expandMaskColorBoundedArea,
    intersectBinaryMasks,
    isMagicSelectionUsable,
    keepMaskComponentsTouchingSupportMask,
    keepMaskComponentsTouchingSupportMaskWithThreshold,
    maskContainsPoint,
    scoreMaskBoundaryAlignment,
    type RgbColor,
    rasterizePolygonMask,
    rasterizeStrokeMask,
    replaceRegionWithSelection,
    sampleRegionBoundaryPoints,
    unionBinaryMasks,
} from './qidahenRegionMaskToolUtils';

type MaskPoint = {
    x: number;
    y: number;
};

type PainterRegion = {
    id: string;
    name: string;
    color: string;
    seed: MaskPoint | null;
    links: string[];
};

type ToolMode = 'wand' | 'chain' | 'paint' | 'erase' | 'barrier' | 'path';
type ChainOperation = 'add' | 'subtract';
type BarrierHintOperation = 'add' | 'subtract';
type BarrierEditMode = 'brush' | 'bridge';
type PassageBoundaryType = 'plain' | 'mountain' | 'river' | 'coast' | 'wall-convex' | 'wall-flat' | 'city' | 'shanhaiguan';

type PassageEdge = {
    id: string;
    from: string;
    to: string;
    boundaryType: PassageBoundaryType;
};

type RegionGraphNode = MaskPoint & {
    id: string;
    name: string;
    color: string;
    pixelCount: number;
};

type BoundaryPreset = {
    id: string;
    label: string;
    rgb: RgbColor;
    enabled: boolean;
};

type DiagnosticSample = {
    id: string;
    label: string;
    point: MaskPoint;
    regionName: string;
    note: string;
    guidePolygon?: ReadonlyArray<readonly [number, number]>;
    truthGuide?: boolean;
};

type DiagnosticPreview = {
    sampleId: string;
    originalDataUrl: string;
    heuristicBarrierDataUrl: string;
    fillDataUrl: string;
    fillPixelCount: number;
    usable: boolean;
    method: string | null;
    methodLabel: string;
    guideRejected: boolean;
    comparisonDataUrl: string | null;
    comparisonLabel: string | null;
};

const DEFAULT_MAP_PATH = getLocalAssetPath('i18n/zh-CN/qidahen/board/qidahen-main-map.png');
const MASK_WIDTH = 1265;
const MASK_HEIGHT = 893;
const DEFAULT_BRUSH_SIZE = 16;
const DEFAULT_ZOOM = 1;
const MIN_FIT_ZOOM = 0.52;
const MAX_FIT_ZOOM = 1.35;
const DEFAULT_BOUNDARY_TOLERANCE = 14;
const DEFAULT_BOUNDARY_EXPANSION = 2;
const DEFAULT_BOUNDARY_COMPONENT_MIN_PIXELS = 12;
const DEFAULT_REGION_COLOR_TOLERANCE = 32;
const MAX_MAGIC_FILL_RATIO = 0.22;
const HEURISTIC_BARRIER_BLUR_RADIUS = 1;
const HEURISTIC_BARRIER_LINE_FILTER = {
    minPixels: 10,
    minSpan: 10,
    maxAverageThickness: 4.6,
} as const;
const HEURISTIC_GRADIENT_BARRIER = {
    blurRadius: 1,
    strongGradientThreshold: 26,
    moderateGradientThreshold: 15,
    darkLuminanceThreshold: 152,
    lowChromaThreshold: 78,
    lineFilter: {
        minPixels: 12,
        minSpan: 8,
        maxAverageThickness: 10,
    },
} as const;
const MAGIC_BOOTSTRAP_GUIDE_EXPANSION = 40;
const MAGIC_RADIAL_MAX_RADIUS = 128;
const MAGIC_RADIAL_MIN_PIXEL_COUNT = 160;
const MAGIC_RADIAL_MIN_DENSITY = 0.22;
const MAGIC_RADIAL_MAX_ASPECT_RATIO = 3.2;
const MAGIC_RADIAL_RING_SEARCH_EXPANSION = 6;
const MAGIC_GUIDE_LOCAL_SEARCH_EXPANSION = 3;
const MAGIC_RADIAL_SCORE_MARGIN = 0.04;
const MAGIC_RADIAL_UNGUIDED_SCORE_MARGIN = 0.08;
const MAGIC_SHAPE_SUPPORT_EXPANSION = 12;
const BARRIER_HINT_ADD_COLOR: RgbColor = [110, 231, 183];
const BARRIER_HINT_REMOVE_COLOR: RgbColor = [244, 114, 182];
const HEURISTIC_BARRIER_COLOR: RgbColor = [56, 189, 248];
const DIAGNOSTIC_PREVIEW_WIDTH = 180;
const DIAGNOSTIC_PREVIEW_HEIGHT = 132;
const LOAD_ENDPOINT = '/devtools/qidahen-region-mask/load';
const SAVE_ENDPOINT = '/devtools/qidahen-region-mask/save';
const DATA_OUTPUT_DIR = 'src/games/qidahen/data';
const DIAGNOSTIC_REGION_PREFIX = '__diagnostic__:';

const DEFAULT_REGION_COLORS = [
    '#d64c3a',
    '#e4a93a',
    '#4f88d2',
    '#6fbe73',
    '#8f63d8',
    '#d062aa',
    '#45b6b1',
    '#bf7844',
] as const;

const DEFAULT_BOUNDARY_PRESETS: readonly BoundaryPreset[] = [
    { id: 'painted-slate-line', label: '实画边界 1', rgb: [61, 69, 66], enabled: true },
    { id: 'painted-brown-line', label: '实画边界 2', rgb: [126, 97, 56], enabled: true },
    { id: 'painted-ochre-line', label: '实画边界 3', rgb: [128, 104, 62], enabled: true },
    { id: 'painted-ink-line', label: '实画边界 4', rgb: [43, 36, 34], enabled: true },
] as const;

const getRegionShapeCenterPoint = (regionName: string, fallbackPoint: MaskPoint): MaskPoint => {
    const shape = QIDAHEN_MAP_REGION_SHAPES.find((item) => item.name === regionName);
    if (!shape || shape.polygon.length === 0) {
        return fallbackPoint;
    }
    const sum = shape.polygon.reduce(
        (current, [x, y]) => ({
            x: current.x + x,
            y: current.y + y,
        }),
        { x: 0, y: 0 },
    );
    return {
        x: Math.round(sum.x / shape.polygon.length),
        y: Math.round(sum.y / shape.polygon.length),
    };
};

const DIAGNOSTIC_SAMPLES: readonly DiagnosticSample[] = [
    {
        id: 'beijing',
        label: '北京样本',
        point: { x: 520, y: 610 },
        regionName: '北京',
        note: '简单城市块。先看边界是否闭合，再决定魔棒能不能停住。',
        guidePolygon: [
            [451, 535],
            [517, 552],
            [573, 565],
            [561, 629],
            [494, 653],
            [438, 595],
        ],
        truthGuide: true,
    },
    {
        id: 'jinzhou',
        label: '锦州样本',
        point: getRegionShapeCenterPoint('锦州', { x: 529, y: 359 }),
        regionName: '锦州',
        note: '当前主要问题样本。可对比北京和锦州的边界噪声差异。',
    },
    {
        id: 'song-jin',
        label: '宋进样本',
        point: getRegionShapeCenterPoint('宋进', { x: 704, y: 649 }),
        regionName: '宋进',
        note: '已有第二块样本，可用来验证锁链和路径图不会被破坏。',
    },
] as const;

const PASSAGE_BOUNDARY_TYPES: ReadonlyArray<{ id: PassageBoundaryType; label: string; note: string; width: number; color: string }> = [
    { id: 'plain', label: '平原', note: '战场宽度 3', width: 3, color: '#e8c46d' },
    { id: 'mountain', label: '山脉', note: '战场宽度 2', width: 2, color: '#9fb7a7' },
    { id: 'river', label: '河流', note: '战场宽度 2', width: 2, color: '#67b4d8' },
    { id: 'coast', label: '海岸/水路', note: '船锚区相邻，最多 2 部队', width: 2, color: '#5fa7e8' },
    { id: 'wall-convex', label: '攻入长城', note: '凸面战场宽度 1', width: 1, color: '#c48f55' },
    { id: 'wall-flat', label: '出长城', note: '平面战场宽度 3', width: 3, color: '#b8875e' },
    { id: 'city', label: '攻城', note: '战场宽度 1', width: 1, color: '#d86a4a' },
    { id: 'shanhaiguan', label: '山海关特殊', note: '破关时视为平原', width: 1, color: '#d8d0a2' },
] as const;

const createDefaultRegions = (): PainterRegion[] =>
    QIDAHEN_MAP_REGION_SHAPES.map((shape, index) => ({
        id: shape.id,
        name: shape.name,
        color: DEFAULT_REGION_COLORS[index % DEFAULT_REGION_COLORS.length],
        seed: null,
        links: [],
    }));

const buildDiagnosticRegionId = (sampleId: string) => `${DIAGNOSTIC_REGION_PREFIX}${sampleId}`;

const isDiagnosticRegionId = (regionId: string) => regionId.startsWith(DIAGNOSTIC_REGION_PREFIX);

const createDiagnosticRegion = (sample: DiagnosticSample, regionCount: number): PainterRegion => ({
    id: buildDiagnosticRegionId(sample.id),
    name: `${sample.regionName} 样本`,
    color: DEFAULT_REGION_COLORS[regionCount % DEFAULT_REGION_COLORS.length],
    seed: sample.point,
    links: [],
});

const formatSeed = (seed: MaskPoint | null) => (
    seed ? `${seed.x}, ${seed.y}` : '未设'
);

const buildMaskDataUrl = (mask: Uint8Array) => {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_WIDTH;
    canvas.height = MASK_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('无法创建边界提示导出画布');
    }
    const pixels = new Uint8ClampedArray(MASK_WIDTH * MASK_HEIGHT * 4);
    for (let index = 0; index < mask.length; index += 1) {
        if (mask[index] === 0) {
            continue;
        }
        const offset = index * 4;
        pixels[offset] = 255;
        pixels[offset + 1] = 255;
        pixels[offset + 2] = 255;
        pixels[offset + 3] = 255;
    }
    context.putImageData(new ImageData(pixels, MASK_WIDTH, MASK_HEIGHT), 0, 0);
    return canvas.toDataURL('image/png');
};

const buildMaskDataUrlFromAssignments = ({
    assignments,
    regions,
}: {
    assignments: Int16Array;
    regions: readonly PainterRegion[];
}) => {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_WIDTH;
    canvas.height = MASK_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('无法创建导出 mask 画布');
    }
    const pixels = buildMaskPixelBuffer({
        assignments,
        palette: regions.map((region) => hexToRgb(region.color)),
        width: MASK_WIDTH,
        height: MASK_HEIGHT,
    });
    context.putImageData(new ImageData(pixels, MASK_WIDTH, MASK_HEIGHT), 0, 0);
    return canvas.toDataURL('image/png');
};

const buildBarrierDebugPixelBuffer = ({
    heuristicMask,
    addMask,
    removeMask,
    width,
    height,
}: {
    heuristicMask: Uint8Array | null;
    addMask: Uint8Array;
    removeMask: Uint8Array;
    width: number;
    height: number;
}) => {
    const pixelBuffer = new Uint8ClampedArray(width * height * 4);

    const paint = (index: number, color: RgbColor, alpha: number) => {
        const offset = index * 4;
        pixelBuffer[offset] = color[0];
        pixelBuffer[offset + 1] = color[1];
        pixelBuffer[offset + 2] = color[2];
        pixelBuffer[offset + 3] = alpha;
    };

    for (let index = 0; index < width * height; index += 1) {
        if (heuristicMask?.[index] !== 0) {
            paint(index, HEURISTIC_BARRIER_COLOR, 170);
        }
        if (addMask[index] !== 0) {
            paint(index, BARRIER_HINT_ADD_COLOR, 235);
        }
        if (removeMask[index] !== 0) {
            paint(index, BARRIER_HINT_REMOVE_COLOR, 235);
        }
    }

    return pixelBuffer;
};

const buildCropRect = (point: MaskPoint) => {
    const left = Math.max(0, Math.min(MASK_WIDTH - DIAGNOSTIC_PREVIEW_WIDTH, point.x - Math.floor(DIAGNOSTIC_PREVIEW_WIDTH / 2)));
    const top = Math.max(0, Math.min(MASK_HEIGHT - DIAGNOSTIC_PREVIEW_HEIGHT, point.y - Math.floor(DIAGNOSTIC_PREVIEW_HEIGHT / 2)));
    return {
        left,
        top,
        width: DIAGNOSTIC_PREVIEW_WIDTH,
        height: DIAGNOSTIC_PREVIEW_HEIGHT,
    };
};

const buildBootstrapGuideMaskFromPolygon = (polygon: readonly (readonly [number, number])[]): Uint8Array | null => {
    if (polygon.length === 0) {
        return null;
    }
    const polygonMask = rasterizePolygonMask({
        width: MASK_WIDTH,
        height: MASK_HEIGHT,
        polygon,
    });
    return expandBinaryMask({
        mask: polygonMask,
        width: MASK_WIDTH,
        height: MASK_HEIGHT,
        iterations: MAGIC_BOOTSTRAP_GUIDE_EXPANSION,
    });
};

const buildRegionBootstrapGuideMask = (shapeId: string): Uint8Array | null => {
    const shape = QIDAHEN_MAP_REGION_SHAPES.find((item) => item.id === shapeId);
    if (!shape) {
        return null;
    }
    return buildBootstrapGuideMaskFromPolygon(shape.polygon);
};

const buildRegionMaskFromAssignments = (assignments: Int16Array, regionIndex: number): Uint8Array | null => {
    const mask = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
    let pixelCount = 0;
    for (let index = 0; index < assignments.length; index += 1) {
        if (assignments[index] !== regionIndex) {
            continue;
        }
        mask[index] = 1;
        pixelCount += 1;
    }
    return pixelCount > 0 ? mask : null;
};

const STATIC_BOOTSTRAP_GUIDE_MASKS = new Map<string, Uint8Array | null>(
    QIDAHEN_MAP_REGION_SHAPES.map((shape) => [shape.id, buildRegionBootstrapGuideMask(shape.id)]),
);
for (const sample of DIAGNOSTIC_SAMPLES) {
    if (!sample.guidePolygon) {
        continue;
    }
    STATIC_BOOTSTRAP_GUIDE_MASKS.set(
        buildDiagnosticRegionId(sample.id),
        buildBootstrapGuideMaskFromPolygon(sample.guidePolygon),
    );
}

const STATIC_BOOTSTRAP_SHAPE_MASKS = new Map<string, Uint8Array>(
    QIDAHEN_MAP_REGION_SHAPES.map((shape) => [shape.id, rasterizePolygonMask({
        width: MASK_WIDTH,
        height: MASK_HEIGHT,
        polygon: shape.polygon,
    })]),
);
for (const sample of DIAGNOSTIC_SAMPLES) {
    if (!sample.guidePolygon) {
        continue;
    }
    STATIC_BOOTSTRAP_SHAPE_MASKS.set(
        buildDiagnosticRegionId(sample.id),
        rasterizePolygonMask({
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            polygon: sample.guidePolygon,
        }),
    );
}

const measureMaskOverlap = (
    mask: Uint8Array | null,
    guideMask: Uint8Array | null,
) => {
    if (!mask || !guideMask) {
        return { iou: 0, recall: 0, precision: 0 };
    }

    let intersection = 0;
    let guidePixelCount = 0;
    let maskPixelCount = 0;

    for (let index = 0; index < mask.length; index += 1) {
        const inGuide = guideMask[index] !== 0;
        const inMask = mask[index] !== 0;
        if (inGuide) {
            guidePixelCount += 1;
        }
        if (inMask) {
            maskPixelCount += 1;
        }
        if (inGuide && inMask) {
            intersection += 1;
        }
    }

    const union = guidePixelCount + maskPixelCount - intersection;
    return {
        iou: union > 0 ? intersection / union : 0,
        recall: guidePixelCount > 0 ? intersection / guidePixelCount : 0,
        precision: maskPixelCount > 0 ? intersection / maskPixelCount : 0,
    };
};

const buildCropDataUrl = ({
    pixels,
    width,
    height,
    crop,
    scale = 1,
}: {
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
    crop: { left: number; top: number; width: number; height: number };
    scale?: number;
}) => {
    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    const scratchContext = scratch.getContext('2d');
    if (!scratchContext) {
        throw new Error('无法创建诊断预览画布');
    }
    scratchContext.putImageData(new ImageData(pixels, width, height), 0, 0);

    const canvas = document.createElement('canvas');
    canvas.width = crop.width * scale;
    canvas.height = crop.height * scale;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('无法创建裁图画布');
    }
    context.imageSmoothingEnabled = false;
    context.drawImage(
        scratch,
        crop.left,
        crop.top,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height,
    );
    return canvas.toDataURL('image/png');
};

const buildSolidMaskPixelBuffer = ({
    mask,
    color,
}: {
    mask: Uint8Array;
    color: RgbColor;
}) => {
    const pixels = new Uint8ClampedArray(mask.length * 4);
    for (let index = 0; index < mask.length; index += 1) {
        if (mask[index] === 0) {
            continue;
        }
        const offset = index * 4;
        pixels[offset] = color[0];
        pixels[offset + 1] = color[1];
        pixels[offset + 2] = color[2];
        pixels[offset + 3] = 255;
    }
    return pixels;
};

const buildMaskComparisonPixelBuffer = ({
    heuristicMask,
    truthMask,
}: {
    heuristicMask: Uint8Array;
    truthMask: Uint8Array;
}) => {
    const pixels = new Uint8ClampedArray(heuristicMask.length * 4);
    for (let index = 0; index < heuristicMask.length; index += 1) {
        const inHeuristic = heuristicMask[index] !== 0;
        const inTruth = truthMask[index] !== 0;
        if (!inHeuristic && !inTruth) {
            continue;
        }
        const offset = index * 4;
        if (inHeuristic && inTruth) {
            pixels[offset] = 255;
            pixels[offset + 1] = 196;
            pixels[offset + 2] = 61;
            pixels[offset + 3] = 255;
        } else if (inTruth) {
            pixels[offset] = 251;
            pixels[offset + 1] = 113;
            pixels[offset + 2] = 133;
            pixels[offset + 3] = 255;
        } else {
            pixels[offset] = 56;
            pixels[offset + 1] = 189;
            pixels[offset + 2] = 248;
            pixels[offset + 3] = 255;
        }
    }
    return pixels;
};

const loadImageFromSource = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
});

const readBinaryMaskFromImageSource = async (src: string | null): Promise<Uint8Array> => {
    if (!src) {
        return new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
    }
    const image = await loadImageFromSource(src);
    const canvas = document.createElement('canvas');
    canvas.width = MASK_WIDTH;
    canvas.height = MASK_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('无法创建边界提示读取画布');
    }
    context.clearRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
    context.drawImage(image, 0, 0, MASK_WIDTH, MASK_HEIGHT);
    const source = context.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data;
    const mask = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
    for (let index = 0; index < mask.length; index += 1) {
        if (source[(index * 4) + 3] >= 16) {
            mask[index] = 1;
        }
    }
    return mask;
};

const readBinaryMaskFromFile = (file: File): Promise<Uint8Array> => new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    readBinaryMaskFromImageSource(objectUrl)
        .then(resolve)
        .catch(reject)
        .finally(() => URL.revokeObjectURL(objectUrl));
});

const readAssignmentsFromImageSource = async ({
    src,
    regions,
}: {
    src: string;
    regions: readonly PainterRegion[];
}) => {
    const image = await loadImageFromSource(src);
    const canvas = document.createElement('canvas');
    canvas.width = MASK_WIDTH;
    canvas.height = MASK_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('无法创建 mask 读取画布');
    }
    context.clearRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
    context.drawImage(image, 0, 0, MASK_WIDTH, MASK_HEIGHT);
    const source = context.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data;
    const palette = regions.map((region) => hexToRgb(region.color));
    const nextAssignments = createRegionAssignments(MASK_WIDTH, MASK_HEIGHT);

    for (let index = 0; index < MASK_WIDTH * MASK_HEIGHT; index += 1) {
        const offset = index * 4;
        if (source[offset + 3] < 16) {
            continue;
        }
        for (let paletteIndex = 0; paletteIndex < palette.length; paletteIndex += 1) {
            const color = palette[paletteIndex];
            if (
                source[offset] === color[0]
                && source[offset + 1] === color[1]
                && source[offset + 2] === color[2]
            ) {
                nextAssignments[index] = paletteIndex;
                break;
            }
        }
    }

    return nextAssignments;
};

const isMaskPoint = (value: unknown): value is MaskPoint => {
    if (typeof value !== 'object' || value == null) {
        return false;
    }
    const candidate = value as { x?: unknown; y?: unknown };
    return Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
};

const normalizeLoadedRegions = (value: unknown): PainterRegion[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((candidate) => {
        if (typeof candidate !== 'object' || candidate == null) {
            return [];
        }
        const region = candidate as {
            id?: unknown;
            name?: unknown;
            color?: unknown;
            seed?: unknown;
            links?: unknown;
        };
        if (typeof region.id !== 'string' || typeof region.name !== 'string' || typeof region.color !== 'string') {
            return [];
        }
        return [{
            id: region.id,
            name: region.name,
            color: region.color,
            seed: isMaskPoint(region.seed)
                ? { x: region.seed.x, y: region.seed.y }
                : null,
            links: Array.isArray(region.links)
                ? region.links.filter((item): item is string => typeof item === 'string')
                : [],
        }];
    });
};

const normalizeLoadedPassages = (value: unknown): PassageEdge[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((candidate) => {
        if (typeof candidate !== 'object' || candidate == null) {
            return [];
        }
        const edge = candidate as {
            id?: unknown;
            from?: unknown;
            to?: unknown;
            boundaryType?: unknown;
        };
        if (typeof edge.id !== 'string' || typeof edge.from !== 'string' || typeof edge.to !== 'string') {
            return [];
        }
        const boundaryType = PASSAGE_BOUNDARY_TYPES.some((item) => item.id === edge.boundaryType)
            ? edge.boundaryType as PassageBoundaryType
            : 'plain';
        return [{
            id: edge.id,
            from: edge.from,
            to: edge.to,
            boundaryType,
        }];
    });
};

const normalizeLoadedBoundaryPresets = (value: unknown): BoundaryPreset[] => {
    if (!Array.isArray(value)) {
        return [...DEFAULT_BOUNDARY_PRESETS];
    }
    return DEFAULT_BOUNDARY_PRESETS.map((preset) => {
        const loaded = value.find((candidate) => {
            if (typeof candidate !== 'object' || candidate == null) {
                return false;
            }
            return (candidate as { id?: unknown }).id === preset.id;
        }) as { label?: unknown; rgb?: unknown; enabled?: unknown } | undefined;

        const rgb = Array.isArray(loaded?.rgb) && loaded.rgb.length === 3
            && loaded.rgb.every((channel) => Number.isFinite(channel))
            ? loaded.rgb as RgbColor
            : preset.rgb;

        return {
            id: preset.id,
            label: typeof loaded?.label === 'string' ? loaded.label : preset.label,
            rgb,
            enabled: typeof loaded?.enabled === 'boolean' ? loaded.enabled : preset.enabled,
        };
    });
};

const parseBoundaryColorInput = (value: string): RgbColor => {
    const normalized = value.trim();
    const rgbMatch = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/iu.exec(normalized);
    if (rgbMatch) {
        const rgb = rgbMatch.slice(1).map((channel) => Number.parseInt(channel, 10));
        if (rgb.every((channel) => channel >= 0 && channel <= 255)) {
            return rgb as RgbColor;
        }
    }
    return hexToRgb(normalized);
};

const normalizeLoadedAuthoritativeGuideIds = (value: unknown) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((candidate): candidate is string => typeof candidate === 'string');
};

const extractBoundaryTolerance = (value: unknown) => {
    if (!Array.isArray(value)) {
        return null;
    }
    const firstRule = value.find((candidate) => {
        if (typeof candidate !== 'object' || candidate == null) {
            return false;
        }
        return Number.isFinite((candidate as { tolerance?: unknown }).tolerance);
    }) as { tolerance?: unknown } | undefined;
    return typeof firstRule?.tolerance === 'number' ? firstRule.tolerance : null;
};

const mapClientPointToCanvas = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(MASK_WIDTH - 1, Math.floor(((clientX - rect.left) / rect.width) * MASK_WIDTH))),
        y: Math.max(0, Math.min(MASK_HEIGHT - 1, Math.floor(((clientY - rect.top) / rect.height) * MASK_HEIGHT))),
    };
};

const clampScroll = (value: number) => Math.max(0, value);

const findNearestNonBarrierPoint = (
    point: MaskPoint,
    barrierMask: Uint8Array,
    searchRadius: number,
    clipMask: Uint8Array | null = null,
): MaskPoint | null => {
    let best: { point: MaskPoint; distanceSquared: number } | null = null;
    for (let offsetY = -searchRadius; offsetY <= searchRadius; offsetY += 1) {
        const y = point.y + offsetY;
        if (y < 0 || y >= MASK_HEIGHT) {
            continue;
        }
        for (let offsetX = -searchRadius; offsetX <= searchRadius; offsetX += 1) {
            const x = point.x + offsetX;
            if (x < 0 || x >= MASK_WIDTH) {
                continue;
            }
            const distanceSquared = (offsetX * offsetX) + (offsetY * offsetY);
            if (distanceSquared > searchRadius * searchRadius) {
                continue;
            }
            if (barrierMask[y * MASK_WIDTH + x] !== 0) {
                continue;
            }
            if (clipMask && clipMask[y * MASK_WIDTH + x] === 0) {
                continue;
            }
            if (!best || distanceSquared < best.distanceSquared) {
                best = { point: { x, y }, distanceSquared };
            }
        }
    }
    return best?.point ?? null;
};

const findBestInteriorSeedPoint = (
    point: MaskPoint,
    barrierMask: Uint8Array,
    searchRadius: number,
    clipMask: Uint8Array | null = null,
): MaskPoint | null => {
    let best: { point: MaskPoint; clearance: number; distanceSquared: number } | null = null;
    const clearanceRadius = Math.max(3, Math.min(7, Math.floor(searchRadius / 3)));
    for (let offsetY = -searchRadius; offsetY <= searchRadius; offsetY += 1) {
        const y = point.y + offsetY;
        if (y < 0 || y >= MASK_HEIGHT) {
            continue;
        }
        for (let offsetX = -searchRadius; offsetX <= searchRadius; offsetX += 1) {
            const x = point.x + offsetX;
            if (x < 0 || x >= MASK_WIDTH) {
                continue;
            }
            const distanceSquared = (offsetX * offsetX) + (offsetY * offsetY);
            if (distanceSquared > searchRadius * searchRadius) {
                continue;
            }
            if (barrierMask[y * MASK_WIDTH + x] !== 0) {
                continue;
            }
            if (clipMask && clipMask[y * MASK_WIDTH + x] === 0) {
                continue;
            }

            let clearance = 0;
            for (let innerY = -clearanceRadius; innerY <= clearanceRadius; innerY += 1) {
                const sampleY = y + innerY;
                if (sampleY < 0 || sampleY >= MASK_HEIGHT) {
                    continue;
                }
                for (let innerX = -clearanceRadius; innerX <= clearanceRadius; innerX += 1) {
                    const sampleX = x + innerX;
                    if (sampleX < 0 || sampleX >= MASK_WIDTH) {
                        continue;
                    }
                    const sampleIndex = sampleY * MASK_WIDTH + sampleX;
                    if (
                        barrierMask[sampleIndex] === 0
                        && (!clipMask || clipMask[sampleIndex] !== 0)
                    ) {
                        clearance += 1;
                    }
                }
            }

            if (!best || clearance > best.clearance || (clearance === best.clearance && distanceSquared < best.distanceSquared)) {
                best = {
                    point: { x, y },
                    clearance,
                    distanceSquared,
                };
            }
        }
    }
    return best?.point ?? null;
};

const findBestInteriorSeedPointInMask = (
    preferredPoint: MaskPoint,
    barrierMask: Uint8Array,
    clipMask: Uint8Array,
): MaskPoint | null => {
    const bounds = getBinaryMaskBounds(clipMask, MASK_WIDTH);
    if (!bounds) {
        return null;
    }

    const clearanceRadius = 7;
    let best: { point: MaskPoint; clearance: number; distanceSquared: number } | null = null;

    for (let y = bounds.top; y <= bounds.bottom; y += 1) {
        for (let x = bounds.left; x <= bounds.right; x += 1) {
            const index = y * MASK_WIDTH + x;
            if (clipMask[index] === 0 || barrierMask[index] !== 0) {
                continue;
            }

            let clearance = 0;
            for (let innerY = -clearanceRadius; innerY <= clearanceRadius; innerY += 1) {
                const sampleY = y + innerY;
                if (sampleY < 0 || sampleY >= MASK_HEIGHT) {
                    continue;
                }
                for (let innerX = -clearanceRadius; innerX <= clearanceRadius; innerX += 1) {
                    const sampleX = x + innerX;
                    if (sampleX < 0 || sampleX >= MASK_WIDTH) {
                        continue;
                    }
                    const sampleIndex = sampleY * MASK_WIDTH + sampleX;
                    if (clipMask[sampleIndex] !== 0 && barrierMask[sampleIndex] === 0) {
                        clearance += 1;
                    }
                }
            }

            const distanceSquared = ((x - preferredPoint.x) * (x - preferredPoint.x))
                + ((y - preferredPoint.y) * (y - preferredPoint.y));

            if (
                !best
                || clearance > best.clearance
                || (clearance === best.clearance && distanceSquared < best.distanceSquared)
            ) {
                best = {
                    point: { x, y },
                    clearance,
                    distanceSquared,
                };
            }
        }
    }

    return best?.point ?? null;
};

const findNearestBarrierPoint = (
    point: MaskPoint,
    barrierMask: Uint8Array,
    searchRadius: number,
): MaskPoint | null => {
    let best: { point: MaskPoint; distanceSquared: number } | null = null;
    for (let offsetY = -searchRadius; offsetY <= searchRadius; offsetY += 1) {
        const y = point.y + offsetY;
        if (y < 0 || y >= MASK_HEIGHT) {
            continue;
        }
        for (let offsetX = -searchRadius; offsetX <= searchRadius; offsetX += 1) {
            const x = point.x + offsetX;
            if (x < 0 || x >= MASK_WIDTH) {
                continue;
            }
            const distanceSquared = (offsetX * offsetX) + (offsetY * offsetY);
            if (distanceSquared > searchRadius * searchRadius) {
                continue;
            }
            if (barrierMask[y * MASK_WIDTH + x] === 0) {
                continue;
            }
            if (!best || distanceSquared < best.distanceSquared) {
                best = { point: { x, y }, distanceSquared };
            }
        }
    }
    return best?.point ?? null;
};

const normalizeEdgeId = (from: string, to: string) => [from, to].sort().join('::');

const getBoundaryTypeMeta = (boundaryType: PassageBoundaryType) => (
    PASSAGE_BOUNDARY_TYPES.find((item) => item.id === boundaryType) ?? PASSAGE_BOUNDARY_TYPES[0]
);

const buildGraphPayload = (
    regions: readonly PainterRegion[],
    passages: readonly PassageEdge[],
    graphNodes: readonly RegionGraphNode[],
) => {
    const nodeMap = new Map(graphNodes.map((node) => [node.id, node]));
    return {
        boundaryTypes: PASSAGE_BOUNDARY_TYPES.map((boundaryType) => ({
            id: boundaryType.id,
            label: boundaryType.label,
            note: boundaryType.note,
            battleWidth: boundaryType.width,
        })),
        nodes: regions.map((region) => {
            const graphNode = nodeMap.get(region.id);
            return {
                id: region.id,
                name: region.name,
                seed: region.seed,
                center: graphNode ? { x: graphNode.x, y: graphNode.y } : null,
                pixelCount: graphNode?.pixelCount ?? 0,
            };
        }),
        edges: passages.map((edge) => {
            const boundaryType = getBoundaryTypeMeta(edge.boundaryType);
            return {
                id: edge.id,
                from: edge.from,
                to: edge.to,
                bidirectional: true,
                boundaryType: edge.boundaryType,
                boundaryLabel: boundaryType.label,
                battleWidth: boundaryType.width,
                ruleNote: boundaryType.note,
            };
        }),
    };
};

const buildRegionPayload = ({
    regions,
    passages,
    boundaryPresets,
    boundaryTolerance,
    boundaryExpansion,
    regionColorTolerance,
    paintedBoundaryOnly,
}: {
    regions: readonly PainterRegion[];
    passages: readonly PassageEdge[];
    boundaryPresets: readonly BoundaryPreset[];
    boundaryTolerance: number;
    boundaryExpansion: number;
    regionColorTolerance: number;
    paintedBoundaryOnly: boolean;
}) => ({
    map: 'qidahen/board/qidahen-main-map.png',
    width: MASK_WIDTH,
    height: MASK_HEIGHT,
    boundaryRules: boundaryPresets.map((preset) => ({
        id: preset.id,
        label: preset.label,
        rgb: preset.rgb,
        enabled: preset.enabled,
        tolerance: boundaryTolerance,
    })),
    boundaryExpansion,
    regionColorTolerance,
    paintedBoundaryOnly,
    regions: regions.map((region) => ({
        ...region,
        links: passages
            .filter((passage) => passage.from === region.id || passage.to === region.id)
            .map((passage) => (passage.from === region.id ? passage.to : passage.from))
            .sort(),
    })),
});

const buildExportAssignments = ({
    assignments,
    regions,
    exportableRegions,
}: {
    assignments: Int16Array;
    regions: readonly PainterRegion[];
    exportableRegions: readonly PainterRegion[];
}) => {
    const remap = new Int16Array(regions.length);
    remap.fill(EMPTY_REGION);
    const sourceIndexById = new Map(regions.map((region, index) => [region.id, index]));
    exportableRegions.forEach((region, exportIndex) => {
        const sourceIndex = sourceIndexById.get(region.id);
        if (sourceIndex != null) {
            remap[sourceIndex] = exportIndex;
        }
    });

    const exportedAssignments = createRegionAssignments(MASK_WIDTH, MASK_HEIGHT);
    for (let index = 0; index < assignments.length; index += 1) {
        const sourceRegionIndex = assignments[index];
        if (sourceRegionIndex < 0 || sourceRegionIndex >= remap.length) {
            continue;
        }
        const exportRegionIndex = remap[sourceRegionIndex];
        if (exportRegionIndex !== EMPTY_REGION) {
            exportedAssignments[index] = exportRegionIndex;
        }
    }
    return exportedAssignments;
};

const buildSubsetAssignments = ({
    assignments,
    regions,
    includedRegionIds,
}: {
    assignments: Int16Array;
    regions: readonly PainterRegion[];
    includedRegionIds: ReadonlySet<string>;
}) => {
    const exportedAssignments = createRegionAssignments(MASK_WIDTH, MASK_HEIGHT);
    if (includedRegionIds.size === 0) {
        return exportedAssignments;
    }
    const sourceIndexById = new Map(regions.map((region, index) => [region.id, index]));
    const includedIndexes = new Set(
        Array.from(includedRegionIds)
            .map((regionId) => sourceIndexById.get(regionId))
            .filter((index): index is number => index != null),
    );
    for (let index = 0; index < assignments.length; index += 1) {
        const sourceRegionIndex = assignments[index];
        if (includedIndexes.has(sourceRegionIndex)) {
            exportedAssignments[index] = sourceRegionIndex;
        }
    }
    return exportedAssignments;
};

const QidahenRegionMaskTool: React.FC = () => {
    const bgCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const outlineCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const barrierCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const graphSvgRef = React.useRef<SVGSVGElement>(null);
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const importInputRef = React.useRef<HTMLInputElement>(null);
    const boundaryMaskInputRef = React.useRef<HTMLInputElement>(null);
    const drawingRef = React.useRef(false);
    const chainPointsRef = React.useRef<MaskPoint[]>([]);
    const assignmentsRef = React.useRef<Int16Array>(createRegionAssignments(MASK_WIDTH, MASK_HEIGHT));
    const sourcePixelsRef = React.useRef<Uint8ClampedArray | null>(null);
    const colorLineBarrierMaskRef = React.useRef<Uint8Array | null>(null);
    const colorBarrierMaskRef = React.useRef<Uint8Array | null>(null);
    const rawColorBarrierMaskRef = React.useRef<Uint8Array | null>(null);
    const rawHeuristicBarrierMaskRef = React.useRef<Uint8Array | null>(null);
    const rawBarrierMaskRef = React.useRef<Uint8Array | null>(null);
    const heuristicBarrierMaskRef = React.useRef<Uint8Array | null>(null);
    const boundaryDraftMaskRef = React.useRef<Uint8Array | null>(null);
    const barrierMaskRef = React.useRef<Uint8Array | null>(null);
    const manualBarrierAddRef = React.useRef<Uint8Array>(new Uint8Array(MASK_WIDTH * MASK_HEIGHT));
    const manualBarrierRemoveRef = React.useRef<Uint8Array>(new Uint8Array(MASK_WIDTH * MASK_HEIGHT));
    const rebuildBarrierMaskRef = React.useRef<() => void>(() => undefined);
    const pendingSeedNormalizationRef = React.useRef(false);

    const [mapImage, setMapImage] = React.useState<HTMLImageElement | null>(null);
    const [regions, setRegions] = React.useState<PainterRegion[]>(createDefaultRegions);
    const [selectedRegionId, setSelectedRegionId] = React.useState<string>(QIDAHEN_MAP_REGION_SHAPES[0]?.id ?? 'region-1');
    const [mode, setMode] = React.useState<ToolMode>('wand');
    const [chainOperation, setChainOperation] = React.useState<ChainOperation>('add');
    const chainOperationRef = React.useRef<ChainOperation>('add');
    const [barrierHintOperation, setBarrierHintOperation] = React.useState<BarrierHintOperation>('add');
    const [barrierEditMode, setBarrierEditMode] = React.useState<BarrierEditMode>('brush');
    const [chainPreviewPoints, setChainPreviewPoints] = React.useState<MaskPoint[]>([]);
    const [boundaryControlPoints, setBoundaryControlPoints] = React.useState<MaskPoint[]>([]);
    const [brushSize, setBrushSize] = React.useState<number>(DEFAULT_BRUSH_SIZE);
    const [maskOpacity, setMaskOpacity] = React.useState<number>(0.24);
    const [zoom, setZoom] = React.useState<number>(DEFAULT_ZOOM);
    const [fitZoom, setFitZoom] = React.useState<number>(1);
    const [showMask, setShowMask] = React.useState<boolean>(true);
    const [showBarrier, setShowBarrier] = React.useState<boolean>(false);
    const [boundaryPresets, setBoundaryPresets] = React.useState<BoundaryPreset[]>([...DEFAULT_BOUNDARY_PRESETS]);
    const [boundaryColorInput, setBoundaryColorInput] = React.useState<string>('');
    const [paintedBoundaryOnly, setPaintedBoundaryOnly] = React.useState<boolean>(true);
    const [boundaryTolerance, setBoundaryTolerance] = React.useState<number>(DEFAULT_BOUNDARY_TOLERANCE);
    const [boundaryExpansion, setBoundaryExpansion] = React.useState<number>(DEFAULT_BOUNDARY_EXPANSION);
    const [regionColorTolerance, setRegionColorTolerance] = React.useState<number>(DEFAULT_REGION_COLOR_TOLERANCE);
    const [authoritativeGuideRegionIds, setAuthoritativeGuideRegionIds] = React.useState<string[]>([]);
    const [assignmentsVersion, setAssignmentsVersion] = React.useState<number>(0);
    const [graphNodes, setGraphNodes] = React.useState<RegionGraphNode[]>([]);
    const [passages, setPassages] = React.useState<PassageEdge[]>([]);
    const [pathDragStartId, setPathDragStartId] = React.useState<string | null>(null);
    const [pathDraftPoint, setPathDraftPoint] = React.useState<MaskPoint | null>(null);
    const [boundaryDraftPixelCount, setBoundaryDraftPixelCount] = React.useState<number>(0);
    const [barrierPixelCount, setBarrierPixelCount] = React.useState<number>(0);
    const [manualBarrierAddCount, setManualBarrierAddCount] = React.useState<number>(0);
    const [manualBarrierRemoveCount, setManualBarrierRemoveCount] = React.useState<number>(0);
    const [activeDiagnosticSampleId, setActiveDiagnosticSampleId] = React.useState<string>('beijing');
    const [diagnosticPreview, setDiagnosticPreview] = React.useState<DiagnosticPreview | null>(null);
    const [statusMessage, setStatusMessage] = React.useState<string>('魔棒负责初选；锁链沿已选区域边界做局部加/减，提交前会拒绝碎岛。');
    const displayScale = fitZoom * zoom;
    const selectedRegion = regions.find((region) => region.id === selectedRegionId) ?? regions[0];
    const selectedRegionIndex = regions.findIndex((region) => region.id === selectedRegionId);
    const authoritativeGuideRegionIdSet = React.useMemo(
        () => new Set(authoritativeGuideRegionIds),
        [authoritativeGuideRegionIds],
    );
    const authoritativeTruthMasks = React.useMemo(() => {
        void assignmentsVersion;
        const masks = new Map<string, Uint8Array>();
        if (authoritativeGuideRegionIdSet.size === 0) {
            return masks;
        }
        regions.forEach((region, regionIndex) => {
            if (!authoritativeGuideRegionIdSet.has(region.id)) {
                return;
            }
            const mask = buildRegionMaskFromAssignments(assignmentsRef.current, regionIndex);
            if (mask) {
                masks.set(region.id, mask);
            }
        });
        return masks;
    }, [assignmentsVersion, authoritativeGuideRegionIdSet, regions]);
    const authoritativeBootstrapGuideMasks = React.useMemo(() => {
        const masks = new Map<string, Uint8Array>();
        authoritativeTruthMasks.forEach((mask, regionId) => {
            masks.set(regionId, expandBinaryMask({
                mask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: MAGIC_BOOTSTRAP_GUIDE_EXPANSION,
            }));
        });
        return masks;
    }, [authoritativeTruthMasks]);
    const bootstrapGuideMasks = React.useMemo(
        () => {
            const masks = new Map<string, Uint8Array | null>(STATIC_BOOTSTRAP_GUIDE_MASKS);
            authoritativeBootstrapGuideMasks.forEach((mask, regionId) => {
                masks.set(regionId, mask);
            });
            return masks;
        },
        [authoritativeBootstrapGuideMasks],
    );
    const bootstrapShapeMasks = React.useMemo(
        () => {
            const masks = new Map<string, Uint8Array>(STATIC_BOOTSTRAP_SHAPE_MASKS);
            authoritativeTruthMasks.forEach((mask, regionId) => {
                masks.set(regionId, mask);
            });
            return masks;
        },
        [authoritativeTruthMasks],
    );

    const buildMagicSelection = React.useCallback((
        point: MaskPoint,
        regionId?: string | null,
        options?: { disableTruthGuide?: boolean },
    ) => {
        const barrierMask = barrierMaskRef.current;
        const rawBarrierMask = rawBarrierMaskRef.current;
        const colorLineBarrierMask = colorLineBarrierMaskRef.current;
        const colorBarrierMask = colorBarrierMaskRef.current;
        const rawColorBarrierMask = rawColorBarrierMaskRef.current;
        const sourcePixels = sourcePixelsRef.current;
        if (!barrierMask || !sourcePixels) {
            return null;
        }

        let colorMask = floodFillColorBoundedArea({
            source: sourcePixels,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            startX: point.x,
            startY: point.y,
            barrierMask,
            colorTolerance: regionColorTolerance,
        });
        if (countMaskPixels(colorMask) < 240) {
            colorMask = floodFillContiguousArea({
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                startX: point.x,
                startY: point.y,
                barrierMask,
            });
        }
        colorMask = fillMaskInternalHoles({
            mask: colorMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });

        const regionIndex = regionId
            ? regions.findIndex((region) => region.id === regionId)
            : -1;
        const persistedRegionMaskRaw = regionIndex >= 0
            ? buildRegionMaskFromAssignments(assignmentsRef.current, regionIndex)
            : null;
        const persistedRegionGuideMaskRaw = persistedRegionMaskRaw
            ? expandBinaryMask({
                mask: persistedRegionMaskRaw,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: MAGIC_BOOTSTRAP_GUIDE_EXPANSION,
            })
            : null;
        const authoritativeBootstrapGuideMaskRaw = regionId
            ? (authoritativeBootstrapGuideMasks.get(regionId) ?? null)
            : null;
        const authoritativeTruthMaskRaw = regionId
            ? (authoritativeTruthMasks.get(regionId) ?? null)
            : null;
        const staticBootstrapGuideMaskRaw = regionId
            ? (STATIC_BOOTSTRAP_GUIDE_MASKS.get(regionId) ?? null)
            : null;
        const staticBootstrapShapeMaskRaw = regionId
            ? (STATIC_BOOTSTRAP_SHAPE_MASKS.get(regionId) ?? null)
            : null;
        const persistedStaticOverlap = measureMaskOverlap(
            persistedRegionMaskRaw,
            staticBootstrapShapeMaskRaw,
        );
        const persistedMaskMatchesStatic = staticBootstrapShapeMaskRaw == null
            || (
                persistedStaticOverlap.iou >= 0.12
                || (
                    persistedStaticOverlap.precision >= 0.24
                    && persistedStaticOverlap.recall >= 0.24
                )
            );
        const persistedMaskContainsPoint = persistedMaskMatchesStatic && maskContainsPoint({
            mask: persistedRegionMaskRaw,
            width: MASK_WIDTH,
            x: point.x,
            y: point.y,
        })
            ? persistedRegionMaskRaw
            : null;
        const staticShapeContainsPoint = maskContainsPoint({
            mask: staticBootstrapShapeMaskRaw,
            width: MASK_WIDTH,
            x: point.x,
            y: point.y,
        }) || maskContainsPoint({
            mask: staticBootstrapGuideMaskRaw,
            width: MASK_WIDTH,
            x: point.x,
            y: point.y,
        })
            ? staticBootstrapShapeMaskRaw
            : null;
        const authoritativeStaticOverlap = measureMaskOverlap(
            authoritativeTruthMaskRaw,
            staticBootstrapShapeMaskRaw,
        );
        const authoritativeTruthMatchesStatic = staticBootstrapShapeMaskRaw == null
            || (
                authoritativeStaticOverlap.precision >= 0.94
                && authoritativeStaticOverlap.recall >= 0.35
            );
        const authoritativeGuideContainsPoint = authoritativeTruthMatchesStatic && authoritativeBootstrapGuideMaskRaw && maskContainsPoint({
            mask: authoritativeBootstrapGuideMaskRaw,
            width: MASK_WIDTH,
            x: point.x,
            y: point.y,
        })
            ? authoritativeTruthMaskRaw
            : null;
        const bootstrapGuideMask = authoritativeGuideContainsPoint
            ? authoritativeBootstrapGuideMaskRaw
            : staticShapeContainsPoint
            ? staticBootstrapGuideMaskRaw
            : persistedMaskContainsPoint
                ? persistedRegionGuideMaskRaw
                : null;
        const bootstrapShapeMask = authoritativeGuideContainsPoint ?? staticShapeContainsPoint ?? persistedMaskContainsPoint;
        const bootstrapShapeSource = authoritativeGuideContainsPoint
            ? 'authoritative'
            : staticShapeContainsPoint
            ? 'static'
            : persistedMaskContainsPoint
                ? 'persisted'
                : null;
        const guideRejected = (persistedRegionMaskRaw != null || staticBootstrapGuideMaskRaw != null) && bootstrapGuideMask == null;
        const diagnosticTruthGuide = regionId && isDiagnosticRegionId(regionId)
            ? (DIAGNOSTIC_SAMPLES.find((sample) => buildDiagnosticRegionId(sample.id) === regionId)?.truthGuide ?? false)
            : false;
        const boundedColorMask = bootstrapGuideMask
            ? intersectBinaryMasks(colorMask, bootstrapGuideMask)
            : colorMask;
        const colorPixelCount = countMaskPixels(boundedColorMask);
        const bootstrapShapeMaskPixelCount = bootstrapShapeMask ? countMaskPixels(bootstrapShapeMask) : 0;
        const shapeSupportMask = bootstrapShapeMask
            ? expandBinaryMask({
                mask: bootstrapShapeMask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: MAGIC_SHAPE_SUPPORT_EXPANSION,
            })
            : null;
        const shapeSupportRingMask = shapeSupportMask && bootstrapShapeMask
            ? (() => {
                const ringMask = new Uint8Array(shapeSupportMask.length);
                for (let index = 0; index < ringMask.length; index += 1) {
                    ringMask[index] = shapeSupportMask[index] !== 0 && bootstrapShapeMask[index] === 0 ? 1 : 0;
                }
                return ringMask;
            })()
            : null;
        const shapeAnchoredBarrierMask = shapeSupportMask && shapeSupportRingMask
            ? keepMaskComponentsTouchingSupportMask({
                mask: barrierMask,
                width: MASK_WIDTH,
                clipMask: shapeSupportMask,
                supportMask: shapeSupportRingMask,
            })
            : null;
        const shapeClippedBarrierMask = shapeSupportMask && shapeAnchoredBarrierMask
            ? createMaskClippedBarrier({
                barrierMask: shapeAnchoredBarrierMask,
                clipMask: shapeSupportMask,
            })
            : null;
        const shapeInteriorSeedPoint = shapeSupportMask && shapeClippedBarrierMask
            ? (findBestInteriorSeedPointInMask(point, shapeClippedBarrierMask, shapeSupportMask) ?? point)
            : point;
        const shapeInteriorMaskRaw = shapeSupportMask && shapeClippedBarrierMask
            ? buildBarrierInteriorSelectionMask({
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                startX: shapeInteriorSeedPoint.x,
                startY: shapeInteriorSeedPoint.y,
                roiMask: shapeSupportMask,
                barrierMask: shapeClippedBarrierMask,
                closingIterations: 1,
            })
            : null;
        const shapeInteriorMask = shapeInteriorMaskRaw
            ? fillMaskInternalHoles({
                mask: shapeInteriorMaskRaw,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
            })
            : null;
        const shapeInteriorPixelCount = shapeInteriorMask ? countMaskPixels(shapeInteriorMask) : 0;
        const shapeColorMask = shapeSupportMask && shapeClippedBarrierMask
            ? (() => {
                let clippedColorMask = floodFillColorBoundedArea({
                    source: sourcePixels,
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                    startX: shapeInteriorSeedPoint.x,
                    startY: shapeInteriorSeedPoint.y,
                    barrierMask: shapeClippedBarrierMask,
                    colorTolerance: regionColorTolerance,
                    edgeStopFactor: 0.8,
                });
                if (countMaskPixels(clippedColorMask) < 120) {
                    clippedColorMask = floodFillContiguousArea({
                        width: MASK_WIDTH,
                        height: MASK_HEIGHT,
                        startX: shapeInteriorSeedPoint.x,
                        startY: shapeInteriorSeedPoint.y,
                        barrierMask: shapeClippedBarrierMask,
                    });
                }
                return fillMaskInternalHoles({
                    mask: intersectBinaryMasks(clippedColorMask, shapeSupportMask),
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                });
            })()
            : null;
        const shapeColorPixelCount = shapeColorMask ? countMaskPixels(shapeColorMask) : 0;
        const radialMaskRaw = buildRadialBoundarySelectionMask({
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            startX: point.x,
            startY: point.y,
            barrierMask,
            maxRadius: bootstrapGuideMask ? MAGIC_RADIAL_MAX_RADIUS + 24 : MAGIC_RADIAL_MAX_RADIUS,
        });
        const radialMask = radialMaskRaw && bootstrapGuideMask
            ? intersectBinaryMasks(radialMaskRaw, bootstrapGuideMask)
            : radialMaskRaw;
        const radialPixelCount = radialMask ? countMaskPixels(radialMask) : 0;
        const radialBounds = radialMask ? getBinaryMaskBounds(radialMask, MASK_WIDTH) : null;
        const radialBoundingArea = radialBounds
            ? ((radialBounds.right - radialBounds.left + 1) * (radialBounds.bottom - radialBounds.top + 1))
            : 0;
        const radialDensity = radialBoundingArea > 0 ? radialPixelCount / radialBoundingArea : 0;
        const radialAspectRatio = radialBounds
            ? Math.max(
                (radialBounds.right - radialBounds.left + 1) / Math.max(1, radialBounds.bottom - radialBounds.top + 1),
                (radialBounds.bottom - radialBounds.top + 1) / Math.max(1, radialBounds.right - radialBounds.left + 1),
            )
            : Number.POSITIVE_INFINITY;

        const colorUsable = isMagicSelectionUsable(colorPixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO);
        const radialUsable = radialMask != null
            && radialPixelCount >= MAGIC_RADIAL_MIN_PIXEL_COUNT
            && radialDensity >= MAGIC_RADIAL_MIN_DENSITY
            && radialAspectRatio <= MAGIC_RADIAL_MAX_ASPECT_RATIO
            && isMagicSelectionUsable(radialPixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO);
        const radialBoundaryStrokeMask = radialUsable
            ? buildRadialBoundaryStrokeMask({
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                startX: point.x,
                startY: point.y,
                barrierMask,
                maxRadius: bootstrapGuideMask ? MAGIC_RADIAL_MAX_RADIUS + 24 : MAGIC_RADIAL_MAX_RADIUS,
                radius: 2.2,
            })
            : null;
        const radialBarrierMask = radialUsable && radialBoundaryStrokeMask
            ? unionBinaryMasks(barrierMask, radialBoundaryStrokeMask)
            : barrierMask;
        const radialInteriorSeedPoint = radialMask
            ? (findBestInteriorSeedPointInMask(point, radialBarrierMask, radialMask) ?? point)
            : point;

        const radialColorMask = radialUsable && radialMask
            ? (() => {
                const clippedBarrierMask = createMaskClippedBarrier({
                    barrierMask,
                    clipMask: radialMask,
                });
                let clippedColorMask = floodFillColorBoundedArea({
                    source: sourcePixels,
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                    startX: radialInteriorSeedPoint.x,
                    startY: radialInteriorSeedPoint.y,
                    barrierMask: clippedBarrierMask,
                    colorTolerance: regionColorTolerance,
                    edgeStopFactor: 0.82,
                    profileMask: radialMask,
                });
                if (countMaskPixels(clippedColorMask) < 120) {
                    clippedColorMask = floodFillContiguousArea({
                        width: MASK_WIDTH,
                        height: MASK_HEIGHT,
                        startX: radialInteriorSeedPoint.x,
                        startY: radialInteriorSeedPoint.y,
                        barrierMask: clippedBarrierMask,
                    });
                }
                return fillMaskInternalHoles({
                    mask: clippedColorMask,
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                });
            })()
            : null;
        const guideLocalSearchMask = bootstrapShapeMask
            ? expandBinaryMask({
                mask: bootstrapShapeMask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: MAGIC_GUIDE_LOCAL_SEARCH_EXPANSION,
            })
            : null;
        const guideLocalProfileMask = guideLocalSearchMask
            ? intersectBinaryMasks(
                radialColorMask ?? radialMask ?? bootstrapShapeMask ?? guideLocalSearchMask,
                guideLocalSearchMask,
            )
            : null;
        const guideLocalSupportRingMask = guideLocalSearchMask && bootstrapShapeMask
            ? (() => {
                const ringMask = new Uint8Array(guideLocalSearchMask.length);
                for (let index = 0; index < ringMask.length; index += 1) {
                    ringMask[index] = guideLocalSearchMask[index] !== 0 && bootstrapShapeMask[index] === 0 ? 1 : 0;
                }
                return ringMask;
            })()
            : null;
        const guideLocalBoundaryRingMask = guideLocalSearchMask && bootstrapShapeMask
            ? intersectBinaryMasks(
                buildMaskBoundaryRing({
                    mask: bootstrapShapeMask,
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                    expandIterations: 4,
                }),
                guideLocalSearchMask,
            )
            : null;
        const guideLocalBarrierSupportMask = guideLocalBoundaryRingMask ?? guideLocalSupportRingMask;
        const guideLocalBoundaryChainSourceCandidates = [
            colorLineBarrierMask ? {
                label: 'line',
                mask: colorLineBarrierMask,
                maxDistance: 6,
                gapClosingIterations: 1,
            } : null,
            colorBarrierMask ? {
                label: 'expanded',
                mask: colorBarrierMask,
                maxDistance: 6,
                gapClosingIterations: 1,
            } : null,
            rawColorBarrierMask ? {
                label: 'raw-color',
                mask: rawColorBarrierMask,
                maxDistance: 6,
                gapClosingIterations: 1,
            } : null,
            rawBarrierMask ? {
                label: 'raw-barrier',
                mask: rawBarrierMask,
                maxDistance: 10,
                gapClosingIterations: 0,
            } : null,
            barrierMask ? {
                label: 'barrier',
                mask: barrierMask,
                maxDistance: 10,
                gapClosingIterations: 0,
            } : null,
        ].filter((candidate): candidate is {
            label: string;
            mask: Uint8Array;
            maxDistance: number;
            gapClosingIterations: number;
        } => candidate != null);
        const guideLocalBoundaryChainSourceCandidatesWithAnalysis = guideLocalSearchMask && guideLocalBarrierSupportMask
            ? guideLocalBoundaryChainSourceCandidates.map((candidate) => ({
                ...candidate,
                analysis: analyzeMaskBoundaryChainsNearSupport({
                    mask: candidate.mask,
                    width: MASK_WIDTH,
                    clipMask: guideLocalSearchMask,
                    supportMask: guideLocalBarrierSupportMask,
                    maxDistance: candidate.maxDistance,
                    minPixels: 18,
                    minSpan: 10,
                    maxAverageThickness: 4.5,
                    gapClosingIterations: candidate.gapClosingIterations,
                }),
            }))
            : [];
        const boundaryChainSourcePriority = (label: string) => {
            switch (label) {
                case 'line':
                    return 5;
                case 'expanded':
                    return 4;
                case 'raw-color':
                    return 3;
                case 'raw-barrier':
                    return 2;
                case 'barrier':
                    return 1;
                default:
                    return 0;
            }
        };
        const isKnownColorBoundaryChainSource = (label: string) => (
            label === 'line'
            || label === 'expanded'
            || label === 'raw-color'
        );
        const scoreBoundaryChainSource = (
            candidate: (typeof guideLocalBoundaryChainSourceCandidatesWithAnalysis)[number],
        ) => {
            const analysis = candidate.analysis;
            const bridgeGain = Math.max(0, analysis.bridgedBandPixels - analysis.boundaryBandPixels);
            return analysis.keptPixelCount
                + (Math.min(analysis.keptComponentCount, 3) * 24)
                + (Math.min(bridgeGain, 12) * 0.25)
                - (analysis.rejectedTooThickCount * 12)
                - (analysis.rejectedWeakSupportCount * 4)
                - (analysis.prunedEmptyCount * 2);
        };
        const compareBoundaryChainSources = (
            left: (typeof guideLocalBoundaryChainSourceCandidatesWithAnalysis)[number],
            right: (typeof guideLocalBoundaryChainSourceCandidatesWithAnalysis)[number],
        ) => {
            const leftHasChain = left.analysis.keptPixelCount > 0 ? 1 : 0;
            const rightHasChain = right.analysis.keptPixelCount > 0 ? 1 : 0;
            if (leftHasChain !== rightHasChain) {
                return rightHasChain - leftHasChain;
            }

            const leftKnownColorSource = isKnownColorBoundaryChainSource(left.label);
            const rightKnownColorSource = isKnownColorBoundaryChainSource(right.label);
            if (leftHasChain !== 0 && leftKnownColorSource !== rightKnownColorSource) {
                return leftKnownColorSource ? -1 : 1;
            }

            const leftPriority = boundaryChainSourcePriority(left.label);
            const rightPriority = boundaryChainSourcePriority(right.label);
            const leftScore = scoreBoundaryChainSource(left);
            const rightScore = scoreBoundaryChainSource(right);
            if (leftHasChain !== 0 && leftPriority !== rightPriority) {
                const higherPriority = leftPriority > rightPriority ? left : right;
                const higherScore = higherPriority === left ? leftScore : rightScore;
                const lowerScore = higherPriority === left ? rightScore : leftScore;
                if (higherScore >= lowerScore * 0.55) {
                    return higherPriority === left ? -1 : 1;
                }
            }

            if (leftScore !== rightScore) {
                return rightScore - leftScore;
            }
            if (leftPriority !== rightPriority) {
                return rightPriority - leftPriority;
            }
            return right.analysis.boundaryBandPixels - left.analysis.boundaryBandPixels;
        };
        const guideLocalBoundaryChainSourceSelection = guideLocalBoundaryChainSourceCandidatesWithAnalysis.length > 0
            ? [...guideLocalBoundaryChainSourceCandidatesWithAnalysis].sort(compareBoundaryChainSources)[0]
            : null;
        const guideLocalBoundaryChainSourceMask = guideLocalBoundaryChainSourceSelection?.mask ?? null;
        const guideLocalBoundaryChainSourcePixelCount = guideLocalBoundaryChainSourceMask
            ? countMaskPixels(guideLocalBoundaryChainSourceMask)
            : 0;
        const guideLocalBoundaryChainSearchPixelCount = guideLocalSearchMask ? countMaskPixels(guideLocalSearchMask) : 0;
        const guideLocalBoundaryChainClippedPixelCount = guideLocalSearchMask && guideLocalBoundaryChainSourceMask
            ? countMaskPixels(intersectBinaryMasks(guideLocalBoundaryChainSourceMask, guideLocalSearchMask))
            : 0;
        const guideLocalBarrierSupportPixelCount = guideLocalBarrierSupportMask ? countMaskPixels(guideLocalBarrierSupportMask) : 0;
        const guideLocalBoundaryChainAnalysis = guideLocalBoundaryChainSourceSelection?.analysis ?? null;
        const guideLocalBoundaryChainMask = guideLocalBoundaryChainAnalysis?.mask ?? null;
        const guideLocalBoundaryChainPixelCount = guideLocalBoundaryChainMask
            ? countMaskPixels(guideLocalBoundaryChainMask)
            : 0;
        const guideLocalBoundaryChainAlignment = scoreMaskBoundaryAlignment({
            mask: guideLocalBoundaryChainMask,
            barrierMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        const guideLocalAnchoredBarrierMask = guideLocalSearchMask && guideLocalBarrierSupportMask
            ? (guideLocalBoundaryChainMask && guideLocalBoundaryChainPixelCount > 0
                ? guideLocalBoundaryChainMask
                : keepMaskComponentsTouchingSupportMaskWithThreshold({
                    mask: barrierMask,
                    width: MASK_WIDTH,
                    clipMask: guideLocalSearchMask,
                    supportMask: guideLocalBarrierSupportMask,
                    minSupportPixels: 12,
                    minSupportRatio: 0.045,
                }))
            : null;
        const guideLocalClippedBarrierMask = guideLocalSearchMask && guideLocalAnchoredBarrierMask
            ? createMaskClippedBarrier({
                barrierMask: guideLocalAnchoredBarrierMask,
                clipMask: guideLocalSearchMask,
            })
            : null;
        const guideLocalInteriorSeedPoint = guideLocalSearchMask && guideLocalClippedBarrierMask
            ? (findBestInteriorSeedPointInMask(point, guideLocalClippedBarrierMask, guideLocalSearchMask) ?? point)
            : point;
        const radialInteriorMask = radialUsable && radialMask
            ? buildBarrierInteriorSelectionMask({
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                startX: radialInteriorSeedPoint.x,
                startY: radialInteriorSeedPoint.y,
                roiMask: radialMask,
                barrierMask: radialBarrierMask,
                closingIterations: 1,
            })
            : null;
        const radialInteriorPixelCount = radialInteriorMask ? countMaskPixels(radialInteriorMask) : 0;
        const radialColorPixelCount = radialColorMask ? countMaskPixels(radialColorMask) : 0;
        const guideLocalColorMask = guideLocalSearchMask && guideLocalClippedBarrierMask
            ? (() => {
                const minimumGuideLocalPixelCount = Math.max(
                    240,
                    bootstrapShapeMaskPixelCount > 0 ? Math.round(bootstrapShapeMaskPixelCount * 0.14) : 0,
                );
                let localColorMask = floodFillColorBoundedArea({
                    source: sourcePixels,
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                    startX: guideLocalInteriorSeedPoint.x,
                    startY: guideLocalInteriorSeedPoint.y,
                    barrierMask: guideLocalClippedBarrierMask,
                    colorTolerance: Math.round(regionColorTolerance * 1.35),
                    seedSampleRadius: 4,
                    edgeStopFactor: 0.82,
                    profileMask: guideLocalProfileMask,
                });
                const localColorPixelCount = countMaskPixels(localColorMask);
                const shouldUseGuidedExpansion = localColorPixelCount < Math.max(
                    240,
                    bootstrapShapeMaskPixelCount > 0 ? Math.round(bootstrapShapeMaskPixelCount * 0.18) : 0,
                );
                if (shouldUseGuidedExpansion) {
                    const expansionSeedMask = intersectBinaryMasks(
                        radialColorMask ?? radialMask ?? localColorMask,
                        guideLocalSearchMask,
                    );
                    localColorMask = expandMaskColorBoundedArea({
                        source: sourcePixels,
                        width: MASK_WIDTH,
                        height: MASK_HEIGHT,
                        startX: guideLocalInteriorSeedPoint.x,
                        startY: guideLocalInteriorSeedPoint.y,
                        seedMask: expansionSeedMask,
                        barrierMask: guideLocalClippedBarrierMask,
                        clipMask: guideLocalSearchMask,
                        colorTolerance: Math.round(regionColorTolerance * 1.18),
                        seedSampleRadius: 4,
                        edgeStopFactor: 0.86,
                        profileMask: guideLocalProfileMask,
                    });
                }
                let usedBoundaryInteriorFallback = false;
                if (countMaskPixels(localColorMask) < minimumGuideLocalPixelCount) {
                    const boundaryInteriorMask = buildBarrierInteriorSelectionMask({
                        width: MASK_WIDTH,
                        height: MASK_HEIGHT,
                        startX: guideLocalInteriorSeedPoint.x,
                        startY: guideLocalInteriorSeedPoint.y,
                        roiMask: guideLocalSearchMask,
                        barrierMask: guideLocalClippedBarrierMask,
                        closingIterations: 1,
                    });
                    if (boundaryInteriorMask) {
                        localColorMask = boundaryInteriorMask;
                        usedBoundaryInteriorFallback = true;
                    }
                }
                if (!usedBoundaryInteriorFallback && countMaskPixels(localColorMask) < minimumGuideLocalPixelCount) {
                    localColorMask = floodFillContiguousArea({
                        width: MASK_WIDTH,
                        height: MASK_HEIGHT,
                        startX: guideLocalInteriorSeedPoint.x,
                        startY: guideLocalInteriorSeedPoint.y,
                        barrierMask: guideLocalClippedBarrierMask,
                    });
                }
                const filledMask = fillMaskInternalHoles({
                    mask: intersectBinaryMasks(localColorMask, guideLocalSearchMask),
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                });
                const grownMask = growMaskTowardBoundary({
                    mask: filledMask,
                    barrierMask: guideLocalClippedBarrierMask,
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                    iterations: 1,
                });
                return countMaskPixels(grownMask) > countMaskPixels(filledMask)
                    ? grownMask
                    : filledMask;
            })()
            : null;
        const guideLocalColorPixelCount = guideLocalColorMask ? countMaskPixels(guideLocalColorMask) : 0;
        const guideBoundaryInteriorMask = guideLocalSearchMask && guideLocalClippedBarrierMask
            ? buildBarrierInteriorSelectionMask({
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                startX: guideLocalInteriorSeedPoint.x,
                startY: guideLocalInteriorSeedPoint.y,
                roiMask: guideLocalSearchMask,
                barrierMask: guideLocalClippedBarrierMask,
                closingIterations: 1,
            })
            : null;
        const guideBoundaryInteriorPixelCount = guideBoundaryInteriorMask ? countMaskPixels(guideBoundaryInteriorMask) : 0;
        const colorAlignment = scoreMaskBoundaryAlignment({
            mask: boundedColorMask,
            barrierMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        const radialColorAlignment = scoreMaskBoundaryAlignment({
            mask: radialColorMask,
            barrierMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        const radialInteriorAlignment = scoreMaskBoundaryAlignment({
            mask: radialInteriorMask,
            barrierMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        const radialMaskAlignment = scoreMaskBoundaryAlignment({
            mask: radialMask,
            barrierMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        const shapeInteriorAlignment = scoreMaskBoundaryAlignment({
            mask: shapeInteriorMask,
            barrierMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        const shapeColorAlignment = scoreMaskBoundaryAlignment({
            mask: shapeColorMask,
            barrierMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        const guideLocalColorAlignment = scoreMaskBoundaryAlignment({
            mask: guideLocalColorMask,
            barrierMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        const guideBoundaryInteriorAlignment = scoreMaskBoundaryAlignment({
            mask: guideBoundaryInteriorMask,
            barrierMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        const scoreGuideShape = (mask: Uint8Array | null, guideMask: Uint8Array | null) => {
            if (!mask || !guideMask) {
                return { iou: 0, recall: 0, precision: 0 };
            }
            let intersection = 0;
            let guidePixelCount = 0;
            let maskPixelCount = 0;
            for (let index = 0; index < mask.length; index += 1) {
                const inGuide = guideMask[index] !== 0;
                const inMask = mask[index] !== 0;
                if (inGuide) {
                    guidePixelCount += 1;
                }
                if (inMask) {
                    maskPixelCount += 1;
                }
                if (inGuide && inMask) {
                    intersection += 1;
                }
            }
            const union = guidePixelCount + maskPixelCount - intersection;
            return {
                iou: union > 0 ? intersection / union : 0,
                recall: guidePixelCount > 0 ? intersection / guidePixelCount : 0,
                precision: maskPixelCount > 0 ? intersection / maskPixelCount : 0,
            };
        };
        const weightedBoundaryScore = (alignment: { supportRatio: number; boundaryPixelCount: number }, pixelCount: number) => (
            alignment.supportRatio * Math.min(1, Math.sqrt(pixelCount / 2000))
        );
        const colorGuideShape = scoreGuideShape(boundedColorMask, bootstrapShapeMask);
        const shapeInteriorGuideShape = scoreGuideShape(shapeInteriorMask, bootstrapShapeMask);
        const shapeColorGuideShape = scoreGuideShape(shapeColorMask, bootstrapShapeMask);
        const guideLocalColorGuideShape = scoreGuideShape(guideLocalColorMask, bootstrapShapeMask);
        const guideBoundaryInteriorGuideShape = scoreGuideShape(guideBoundaryInteriorMask, bootstrapShapeMask);
        const radialGuideShape = scoreGuideShape(radialMask, bootstrapShapeMask);
        const radialColorGuideShape = scoreGuideShape(radialColorMask, bootstrapShapeMask);
        const radialInteriorGuideShape = scoreGuideShape(radialInteriorMask, bootstrapShapeMask);
        const truthGuideMask = bootstrapShapeSource === 'authoritative' && authoritativeTruthMaskRaw
            ? authoritativeTruthMaskRaw
            : diagnosticTruthGuide && bootstrapShapeMask && bootstrapShapeSource === 'static'
                ? bootstrapShapeMask
            : null;
        const truthGuidePixelCount = truthGuideMask ? countMaskPixels(truthGuideMask) : 0;
        const truthGuideAlignment = scoreMaskBoundaryAlignment({
            mask: truthGuideMask,
            barrierMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        const truthGuideGuideShape = scoreGuideShape(truthGuideMask, bootstrapShapeMask);
        const truthGuideUsable = truthGuideMask != null;
        const colorScore = weightedBoundaryScore(colorAlignment, colorPixelCount) + (colorGuideShape.iou * 0.12);
        const shapeInteriorScore = weightedBoundaryScore(shapeInteriorAlignment, shapeInteriorPixelCount) + (shapeInteriorGuideShape.iou * 0.18);
        const shapeColorScore = weightedBoundaryScore(shapeColorAlignment, shapeColorPixelCount) + (shapeColorGuideShape.iou * 0.15);
        const truthGuideScore = truthGuideUsable
            ? 0.82 + (weightedBoundaryScore(truthGuideAlignment, truthGuidePixelCount) * 0.08)
            : 0;
        const guideLocalColorScore = weightedBoundaryScore(guideLocalColorAlignment, guideLocalColorPixelCount)
            + (guideLocalColorGuideShape.iou * 0.22)
            + (guideLocalColorGuideShape.recall * 0.04);
        const guideBoundaryInteriorScore = weightedBoundaryScore(guideBoundaryInteriorAlignment, guideBoundaryInteriorPixelCount)
            + (guideBoundaryInteriorGuideShape.iou * 0.2)
            + (guideBoundaryInteriorGuideShape.recall * 0.05);
        const radialScore = weightedBoundaryScore(radialMaskAlignment, radialPixelCount) + (radialGuideShape.iou * 0.12);
        const radialColorScore = weightedBoundaryScore(radialColorAlignment, radialColorPixelCount) + (radialColorGuideShape.iou * 0.12);
        const radialInteriorScore = weightedBoundaryScore(radialInteriorAlignment, radialInteriorPixelCount) + (radialInteriorGuideShape.iou * 0.12);
        const shapeInteriorUsable = shapeInteriorMask != null
            && shapeInteriorPixelCount >= MAGIC_RADIAL_MIN_PIXEL_COUNT * 0.8
            && isMagicSelectionUsable(shapeInteriorPixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO);
        const shapeColorUsable = shapeColorMask != null
            && shapeColorPixelCount >= MAGIC_RADIAL_MIN_PIXEL_COUNT * 0.8
            && isMagicSelectionUsable(shapeColorPixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO);
        const guideLocalColorUsable = guideLocalColorMask != null
            && guideLocalColorPixelCount >= MAGIC_RADIAL_MIN_PIXEL_COUNT
            && (
                bootstrapShapeMaskPixelCount === 0
                || guideLocalColorPixelCount <= bootstrapShapeMaskPixelCount * 1.18
            )
            && (
                !radialUsable
                || guideLocalColorPixelCount >= radialPixelCount * 0.72
                || guideLocalColorAlignment.supportRatio >= radialMaskAlignment.supportRatio + 0.08
            )
            && isMagicSelectionUsable(guideLocalColorPixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO);
        const guideBoundaryInteriorUsable = guideBoundaryInteriorMask != null
            && guideBoundaryInteriorPixelCount >= MAGIC_RADIAL_MIN_PIXEL_COUNT
            && (
                bootstrapShapeMaskPixelCount === 0
                || guideBoundaryInteriorPixelCount <= bootstrapShapeMaskPixelCount * 1.22
            )
            && isMagicSelectionUsable(guideBoundaryInteriorPixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO);
        const radialInteriorUsable = radialInteriorMask != null
            && radialInteriorPixelCount >= MAGIC_RADIAL_MIN_PIXEL_COUNT * 0.55
            && radialInteriorPixelCount <= radialPixelCount;
        const shouldUseRadialColorMask = radialColorMask != null
            && radialColorPixelCount >= MAGIC_RADIAL_MIN_PIXEL_COUNT * 0.55
            && radialColorPixelCount <= radialPixelCount;
        const debugCandidates = [
            {
                method: 'color',
                pixelCount: colorPixelCount,
                score: Number(colorScore.toFixed(4)),
                supportRatio: Number(colorAlignment.supportRatio.toFixed(4)),
                guideRecall: Number(colorGuideShape.recall.toFixed(4)),
                usable: colorUsable,
            },
            {
                method: 'truth-guide',
                pixelCount: truthGuidePixelCount,
                score: Number(truthGuideScore.toFixed(4)),
                supportRatio: Number(truthGuideAlignment.supportRatio.toFixed(4)),
                guideRecall: Number(truthGuideGuideShape.recall.toFixed(4)),
                usable: truthGuideUsable,
            },
            {
                method: 'shape-barrier',
                pixelCount: shapeInteriorPixelCount,
                score: Number(shapeInteriorScore.toFixed(4)),
                supportRatio: Number(shapeInteriorAlignment.supportRatio.toFixed(4)),
                guideRecall: Number(shapeInteriorGuideShape.recall.toFixed(4)),
                usable: shapeInteriorUsable,
            },
            {
                method: 'shape-color',
                pixelCount: shapeColorPixelCount,
                score: Number(shapeColorScore.toFixed(4)),
                supportRatio: Number(shapeColorAlignment.supportRatio.toFixed(4)),
                guideRecall: Number(shapeColorGuideShape.recall.toFixed(4)),
                usable: shapeColorUsable,
            },
            {
                method: 'guide-local-color',
                pixelCount: guideLocalColorPixelCount,
                score: Number(guideLocalColorScore.toFixed(4)),
                supportRatio: Number(guideLocalColorAlignment.supportRatio.toFixed(4)),
                guideRecall: Number(guideLocalColorGuideShape.recall.toFixed(4)),
                usable: guideLocalColorUsable,
                boundaryChainPixels: guideLocalBoundaryChainPixelCount,
                boundaryChainSupportRatio: Number(guideLocalBoundaryChainAlignment.supportRatio.toFixed(4)),
                boundaryChainSourcePixels: guideLocalBoundaryChainSourcePixelCount,
                boundaryChainSearchPixels: guideLocalBoundaryChainSearchPixelCount,
                boundaryChainClippedPixels: guideLocalBoundaryChainClippedPixelCount,
                boundaryChainSupportPixels: guideLocalBarrierSupportPixelCount,
                boundaryChainBandPixels: guideLocalBoundaryChainAnalysis?.boundaryBandPixels ?? 0,
                boundaryChainBridgedBandPixels: guideLocalBoundaryChainAnalysis?.bridgedBandPixels ?? 0,
                boundaryChainComponentCount: guideLocalBoundaryChainAnalysis?.componentCount ?? 0,
                boundaryChainKeptComponentCount: guideLocalBoundaryChainAnalysis?.keptComponentCount ?? 0,
                boundaryChainPrunedEmptyCount: guideLocalBoundaryChainAnalysis?.prunedEmptyCount ?? 0,
                boundaryChainRejectedTooSmallCount: guideLocalBoundaryChainAnalysis?.rejectedTooSmallCount ?? 0,
                boundaryChainRejectedTooShortCount: guideLocalBoundaryChainAnalysis?.rejectedTooShortCount ?? 0,
                boundaryChainRejectedTooThickCount: guideLocalBoundaryChainAnalysis?.rejectedTooThickCount ?? 0,
                boundaryChainRejectedWeakSupportCount: guideLocalBoundaryChainAnalysis?.rejectedWeakSupportCount ?? 0,
                boundaryChainLargestRejectedPixelCount: guideLocalBoundaryChainAnalysis?.largestRejectedPixelCount ?? 0,
                boundaryChainLargestRejectedSpan: guideLocalBoundaryChainAnalysis?.largestRejectedSpan ?? 0,
                boundaryChainLargestRejectedAverageThickness: Number((guideLocalBoundaryChainAnalysis?.largestRejectedAverageThickness ?? 0).toFixed(3)),
                boundaryChainLargestRejectedSupportContactRatio: Number((guideLocalBoundaryChainAnalysis?.largestRejectedSupportContactRatio ?? 0).toFixed(4)),
                boundaryChainSource: guideLocalBoundaryChainSourceSelection?.label ?? null,
                boundaryChainSourceCandidates: guideLocalBoundaryChainSourceCandidatesWithAnalysis.map((candidate) => ({
                    source: candidate.label,
                    score: Number(scoreBoundaryChainSource(candidate).toFixed(2)),
                    keptPixels: candidate.analysis.keptPixelCount,
                    keptComponents: candidate.analysis.keptComponentCount,
                    bandPixels: candidate.analysis.boundaryBandPixels,
                    bridgedBandPixels: candidate.analysis.bridgedBandPixels,
                    rejectedTooThick: candidate.analysis.rejectedTooThickCount,
                    rejectedWeakSupport: candidate.analysis.rejectedWeakSupportCount,
                    largestRejectedPixels: candidate.analysis.largestRejectedPixelCount,
                    largestRejectedThickness: Number(candidate.analysis.largestRejectedAverageThickness.toFixed(3)),
                })),
            },
            {
                method: 'guide-boundary-interior',
                pixelCount: guideBoundaryInteriorPixelCount,
                score: Number(guideBoundaryInteriorScore.toFixed(4)),
                supportRatio: Number(guideBoundaryInteriorAlignment.supportRatio.toFixed(4)),
                guideRecall: Number(guideBoundaryInteriorGuideShape.recall.toFixed(4)),
                usable: guideBoundaryInteriorUsable,
            },
            {
                method: 'radial',
                pixelCount: radialPixelCount,
                score: Number(radialScore.toFixed(4)),
                supportRatio: Number(radialMaskAlignment.supportRatio.toFixed(4)),
                guideRecall: Number(radialGuideShape.recall.toFixed(4)),
                usable: radialUsable,
            },
            {
                method: 'radial-color',
                pixelCount: radialColorPixelCount,
                score: Number(radialColorScore.toFixed(4)),
                supportRatio: Number(radialColorAlignment.supportRatio.toFixed(4)),
                guideRecall: Number(radialColorGuideShape.recall.toFixed(4)),
                usable: shouldUseRadialColorMask,
            },
            {
                method: 'radial-barrier',
                pixelCount: radialInteriorPixelCount,
                score: Number(radialInteriorScore.toFixed(4)),
                supportRatio: Number(radialInteriorAlignment.supportRatio.toFixed(4)),
                guideRecall: Number(radialInteriorGuideShape.recall.toFixed(4)),
                usable: radialInteriorUsable,
            },
        ];
        if (truthGuideUsable && !options?.disableTruthGuide) {
            return {
                mask: truthGuideMask,
                pixelCount: truthGuidePixelCount,
                method: 'truth-guide' as const,
                guideRejected,
                debug: {
                    candidates: debugCandidates,
                    bootstrapShapeSource,
                    fellBackToShapeOutline: false,
                    authoritativeGuide: true,
                },
            };
        }
        const bestBaseRadialCandidate = (() => {
            const candidates = [
                {
                    mask: shapeInteriorMask,
                    pixelCount: shapeInteriorPixelCount,
                    method: 'shape-barrier' as const,
                    score: shapeInteriorScore,
                    supportRatio: shapeInteriorAlignment.supportRatio,
                    guideShape: shapeInteriorGuideShape,
                },
                {
                    mask: shapeColorMask,
                    pixelCount: shapeColorPixelCount,
                    method: 'shape-color' as const,
                    score: shapeColorScore,
                    supportRatio: shapeColorAlignment.supportRatio,
                    guideShape: shapeColorGuideShape,
                },
                {
                    mask: radialMask,
                    pixelCount: radialPixelCount,
                    method: 'radial' as const,
                    score: radialScore,
                    supportRatio: radialMaskAlignment.supportRatio,
                    guideShape: radialGuideShape,
                },
                {
                    mask: guideLocalColorMask,
                    pixelCount: guideLocalColorPixelCount,
                    method: 'guide-local-color' as const,
                    score: guideLocalColorScore,
                    supportRatio: guideLocalColorAlignment.supportRatio,
                    guideShape: guideLocalColorGuideShape,
                },
                {
                    mask: guideBoundaryInteriorMask,
                    pixelCount: guideBoundaryInteriorPixelCount,
                    method: 'guide-boundary-interior' as const,
                    score: guideBoundaryInteriorScore,
                    supportRatio: guideBoundaryInteriorAlignment.supportRatio,
                    guideShape: guideBoundaryInteriorGuideShape,
                },
                {
                    mask: radialColorMask,
                    pixelCount: radialColorPixelCount,
                    method: 'radial-color' as const,
                    score: radialColorScore,
                    supportRatio: radialColorAlignment.supportRatio,
                    guideShape: radialColorGuideShape,
                },
                {
                    mask: radialInteriorMask,
                    pixelCount: radialInteriorPixelCount,
                    method: 'radial-barrier' as const,
                    score: radialInteriorScore,
                    supportRatio: radialInteriorAlignment.supportRatio,
                    guideShape: radialInteriorGuideShape,
                },
            ].filter((candidate) => {
                if (candidate.method === 'shape-barrier') {
                    return shapeInteriorUsable;
                }
                if (candidate.method === 'shape-color') {
                    return shapeColorUsable && !radialUsable;
                }
                if (candidate.method === 'guide-local-color') {
                    return guideLocalColorUsable;
                }
                if (candidate.method === 'guide-boundary-interior') {
                    return guideBoundaryInteriorUsable;
                }
                return candidate.mask != null && candidate.pixelCount > 0;
            });
            if (candidates.length === 0) {
                return null;
            }
            const baseRadialCandidate = candidates.find((candidate) => candidate.method === 'radial');
            const filteredCandidates = baseRadialCandidate
                ? candidates.filter((candidate) => (
                    candidate.method === 'shape-barrier'
                    || candidate.method === 'guide-local-color'
                    || candidate.method === 'guide-boundary-interior'
                    || candidate.method === 'radial'
                    || bootstrapShapeMask == null
                    || candidate.guideShape.recall >= baseRadialCandidate.guideShape.recall - 0.008
                    || candidate.supportRatio >= baseRadialCandidate.supportRatio + 0.04
                    || candidate.guideShape.precision >= baseRadialCandidate.guideShape.precision + 0.01
                ))
                : candidates;
            filteredCandidates.sort((left, right) => right.score - left.score || right.pixelCount - left.pixelCount);
            return filteredCandidates[0] ?? baseRadialCandidate ?? null;
        })();
        const bestRadialCandidate = (() => {
            if (!bestBaseRadialCandidate?.mask) {
                return bestBaseRadialCandidate;
            }

            const refinedCandidates = [1, 2, 3]
                .map((iterations) => {
                    const mask = growMaskTowardBoundary({
                        mask: bestBaseRadialCandidate.mask!,
                        barrierMask,
                        width: MASK_WIDTH,
                        height: MASK_HEIGHT,
                        iterations,
                    });
                    const pixelCount = countMaskPixels(mask);
                    if (
                        pixelCount <= bestBaseRadialCandidate.pixelCount
                        || pixelCount > bestBaseRadialCandidate.pixelCount * 1.45
                        || !isMagicSelectionUsable(pixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO)
                    ) {
                        return null;
                    }
                    const alignment = scoreMaskBoundaryAlignment({
                        mask,
                        barrierMask,
                        width: MASK_WIDTH,
                        height: MASK_HEIGHT,
                    });
                    const guideShape = scoreGuideShape(mask, bootstrapShapeMask);
                    return {
                        mask,
                        pixelCount,
                        method: bestBaseRadialCandidate.method,
                        score: weightedBoundaryScore(alignment, pixelCount),
                        guideShape,
                    };
                })
                .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null);

            if (refinedCandidates.length === 0) {
                return bestBaseRadialCandidate;
            }

            refinedCandidates.sort((left, right) => right.score - left.score || right.pixelCount - left.pixelCount);
            return refinedCandidates[0].score > bestBaseRadialCandidate.score
                ? refinedCandidates[0]
                : bestBaseRadialCandidate;
        })();
        const radialRingBarrierCandidate = (() => {
            if (!radialUsable || !bestRadialCandidate?.mask || guideRejected) {
                return null;
            }

            const searchAreaMask = expandBinaryMask({
                mask: bestRadialCandidate.mask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: MAGIC_RADIAL_RING_SEARCH_EXPANSION,
            });
            const supportRingMask = new Uint8Array(searchAreaMask.length);
            for (let index = 0; index < supportRingMask.length; index += 1) {
                supportRingMask[index] = searchAreaMask[index] !== 0 && bestRadialCandidate.mask[index] === 0 ? 1 : 0;
            }
            const anchoredBarrierMask = keepMaskComponentsTouchingSupportMask({
                mask: barrierMask,
                width: MASK_WIDTH,
                clipMask: searchAreaMask,
                supportMask: supportRingMask,
            });
            const clippedBarrierMask = createMaskClippedBarrier({
                barrierMask: anchoredBarrierMask,
                clipMask: searchAreaMask,
            });
            const mask = buildBarrierInteriorSelectionMask({
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                startX: point.x,
                startY: point.y,
                roiMask: searchAreaMask,
                barrierMask: clippedBarrierMask,
                closingIterations: 1,
            });
            if (!mask) {
                return null;
            }
            const pixelCount = countMaskPixels(mask);
            if (
                pixelCount <= bestRadialCandidate.pixelCount
                || pixelCount > bestRadialCandidate.pixelCount * 1.28
                || !isMagicSelectionUsable(pixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO)
            ) {
                return null;
            }
            const alignment = scoreMaskBoundaryAlignment({
                mask,
                barrierMask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
            });
            const guideShape = scoreGuideShape(mask, bootstrapShapeMask);
            if (alignment.supportRatio <= radialMaskAlignment.supportRatio + 0.02) {
                return null;
            }
            return {
                mask,
                pixelCount,
                method: 'radial-ring' as const,
                score: weightedBoundaryScore(alignment, pixelCount) + (guideShape.iou * 0.12),
                guideShape,
            };
        })();
        const radialRawRingBarrierCandidate = (() => {
            if (!rawBarrierMask || !radialUsable || !bestRadialCandidate?.mask || guideRejected) {
                return null;
            }

            const searchAreaMask = expandBinaryMask({
                mask: bestRadialCandidate.mask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: MAGIC_RADIAL_RING_SEARCH_EXPANSION + 2,
            });
            const supportRingMask = new Uint8Array(searchAreaMask.length);
            for (let index = 0; index < supportRingMask.length; index += 1) {
                supportRingMask[index] = searchAreaMask[index] !== 0 && bestRadialCandidate.mask[index] === 0 ? 1 : 0;
            }
            const anchoredRawBarrierMask = keepMaskComponentsTouchingSupportMask({
                mask: rawBarrierMask,
                width: MASK_WIDTH,
                clipMask: searchAreaMask,
                supportMask: supportRingMask,
            });
            const closedLocalBarrierMask = closeBinaryMask({
                mask: intersectBinaryMasks(
                    unionBinaryMasks(barrierMask, anchoredRawBarrierMask),
                    searchAreaMask,
                ),
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: 1,
            });
            const clippedBarrierMask = createMaskClippedBarrier({
                barrierMask: closedLocalBarrierMask,
                clipMask: searchAreaMask,
            });
            const mask = buildBarrierInteriorSelectionMask({
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                startX: point.x,
                startY: point.y,
                roiMask: searchAreaMask,
                barrierMask: clippedBarrierMask,
                closingIterations: 1,
            });
            if (!mask) {
                return null;
            }
            const pixelCount = countMaskPixels(mask);
            if (
                pixelCount <= bestRadialCandidate.pixelCount
                || pixelCount > bestRadialCandidate.pixelCount * 1.38
                || !isMagicSelectionUsable(pixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO)
            ) {
                return null;
            }
            const alignment = scoreMaskBoundaryAlignment({
                mask,
                barrierMask: rawBarrierMask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
            });
            const guideShape = scoreGuideShape(mask, bootstrapShapeMask);
            if (
                alignment.supportRatio <= radialMaskAlignment.supportRatio + 0.018
                && guideShape.recall <= bestRadialCandidate.guideShape.recall + 0.012
            ) {
                return null;
            }
            return {
                mask,
                pixelCount,
                method: 'radial-ring' as const,
                score: weightedBoundaryScore(alignment, pixelCount) + (guideShape.iou * 0.12),
                guideShape,
            };
        })();
        const radialRawLocalColorCandidate = (() => {
            if (!rawBarrierMask || !bestRadialCandidate?.mask) {
                return null;
            }

            const fallbackSearchAreaMask = expandBinaryMask({
                mask: bestRadialCandidate.mask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: MAGIC_RADIAL_RING_SEARCH_EXPANSION + 14,
            });
            const searchAreaMask = guideLocalSearchMask ?? fallbackSearchAreaMask;
            const candidateHaloMask = expandBinaryMask({
                mask: bestRadialCandidate.mask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: MAGIC_RADIAL_RING_SEARCH_EXPANSION + 2,
            });
            const candidateSupportRingMask = new Uint8Array(searchAreaMask.length);
            for (let index = 0; index < candidateSupportRingMask.length; index += 1) {
                candidateSupportRingMask[index] = (
                    searchAreaMask[index] !== 0
                    && candidateHaloMask[index] !== 0
                    && bestRadialCandidate.mask[index] === 0
                ) ? 1 : 0;
            }
            const searchAreaBoundarySupportMask = intersectBinaryMasks(
                buildMaskBoundaryRing({
                    mask: searchAreaMask,
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                    expandIterations: guideLocalBoundaryRingMask ? 0 : 8,
                }),
                searchAreaMask,
            );
            const localSupportMask = unionBinaryMasks(
                candidateSupportRingMask,
                guideLocalBoundaryRingMask ?? searchAreaBoundarySupportMask,
            );
            const anchoredBarrierMask = keepMaskComponentsTouchingSupportMask({
                mask: unionBinaryMasks(barrierMask, rawBarrierMask),
                width: MASK_WIDTH,
                clipMask: searchAreaMask,
                supportMask: localSupportMask,
            });
            const clippedBarrierMask = createMaskClippedBarrier({
                barrierMask: anchoredBarrierMask,
                clipMask: searchAreaMask,
            });
            const expandedMask = fillMaskInternalHoles({
                mask: expandMaskColorBoundedArea({
                    source: sourcePixels,
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                    startX: guideLocalInteriorSeedPoint.x,
                    startY: guideLocalInteriorSeedPoint.y,
                    seedMask: intersectBinaryMasks(bestRadialCandidate.mask, searchAreaMask),
                    barrierMask: clippedBarrierMask,
                    clipMask: searchAreaMask,
                    colorTolerance: Math.round(regionColorTolerance * 1.08),
                    seedSampleRadius: 4,
                    edgeStopFactor: 0.86,
                    profileMask: intersectBinaryMasks(bestRadialCandidate.mask, searchAreaMask),
                }),
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
            });
            const grownMask = growMaskTowardBoundary({
                mask: expandedMask,
                barrierMask: clippedBarrierMask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: 1,
            });
            const expandedPixelCount = countMaskPixels(expandedMask);
            const grownPixelCount = countMaskPixels(grownMask);
            const expandedFilteredAlignment = scoreMaskBoundaryAlignment({
                mask: expandedMask,
                barrierMask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
            });
            const expandedRawAlignment = scoreMaskBoundaryAlignment({
                mask: expandedMask,
                barrierMask: rawBarrierMask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
            });
            const shouldUseGrownMask = grownPixelCount > expandedPixelCount
                && grownPixelCount <= expandedPixelCount * 1.12;
            const mask = shouldUseGrownMask
                ? grownMask
                : expandedMask;
            const pixelCount = shouldUseGrownMask
                ? grownPixelCount
                : expandedPixelCount;
            if (
                pixelCount <= bestRadialCandidate.pixelCount
                || pixelCount > bestRadialCandidate.pixelCount * 1.72
                || !isMagicSelectionUsable(pixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO)
            ) {
                return null;
            }
            const filteredAlignment = scoreMaskBoundaryAlignment({
                mask,
                barrierMask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
            });
            const rawAlignment = scoreMaskBoundaryAlignment({
                mask,
                barrierMask: rawBarrierMask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
            });
            const guideShape = scoreGuideShape(mask, bootstrapShapeMask);
            if (
                rawAlignment.supportRatio <= bestRadialCandidate.supportRatio + 0.025
                && filteredAlignment.supportRatio <= bestRadialCandidate.supportRatio + 0.02
                && guideShape.recall <= bestRadialCandidate.guideShape.recall + 0.012
            ) {
                return null;
            }
            if (
                shouldUseGrownMask
                && (
                    filteredAlignment.supportRatio < expandedFilteredAlignment.supportRatio - 0.018
                    || rawAlignment.supportRatio < expandedRawAlignment.supportRatio - 0.018
                )
            ) {
                return {
                    mask: expandedMask,
                    pixelCount: expandedPixelCount,
                    method: 'radial-raw-local-color' as const,
                    score: Math.max(
                        weightedBoundaryScore(expandedFilteredAlignment, expandedPixelCount),
                        weightedBoundaryScore(expandedRawAlignment, expandedPixelCount) * 0.98,
                    ) + (scoreGuideShape(expandedMask, bootstrapShapeMask).iou * 0.12),
                    guideShape: scoreGuideShape(expandedMask, bootstrapShapeMask),
                };
            }
            return {
                mask,
                pixelCount,
                method: 'radial-raw-local-color' as const,
                score: Math.max(
                    weightedBoundaryScore(filteredAlignment, pixelCount),
                    weightedBoundaryScore(rawAlignment, pixelCount) * 0.98,
                    ) + (guideShape.iou * 0.12),
                guideShape,
            };
        })();
        const guidedEdgeFillCandidate = (() => {
            if (
                bootstrapShapeSource !== 'static'
                || !bestRadialCandidate?.mask
                || !guideLocalSearchMask
                || !guideLocalClippedBarrierMask
                || bestRadialCandidate.guideShape.recall >= 0.8
            ) {
                return null;
            }

            const expandedMask = fillMaskInternalHoles({
                mask: expandMaskColorBoundedArea({
                    source: sourcePixels,
                    width: MASK_WIDTH,
                    height: MASK_HEIGHT,
                    startX: guideLocalInteriorSeedPoint.x,
                    startY: guideLocalInteriorSeedPoint.y,
                    seedMask: intersectBinaryMasks(bestRadialCandidate.mask, guideLocalSearchMask),
                    barrierMask: guideLocalClippedBarrierMask,
                    clipMask: guideLocalSearchMask,
                    colorTolerance: Math.round(regionColorTolerance * 1.08),
                    seedSampleRadius: 4,
                    edgeStopFactor: 0.82,
                    profileMask: guideLocalProfileMask ?? guideLocalSearchMask,
                }),
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
            });
            const pixelCount = countMaskPixels(expandedMask);
            if (
                pixelCount <= bestRadialCandidate.pixelCount
                || pixelCount > bestRadialCandidate.pixelCount * 1.16
                || !isMagicSelectionUsable(pixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO)
            ) {
                return null;
            }

            const filteredAlignment = scoreMaskBoundaryAlignment({
                mask: expandedMask,
                barrierMask,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
            });
            const guideShape = scoreGuideShape(expandedMask, bootstrapShapeMask);
            if (
                guideShape.recall <= bestRadialCandidate.guideShape.recall + 0.035
                || filteredAlignment.supportRatio < bestRadialCandidate.supportRatio - 0.06
            ) {
                return null;
            }
            return {
                mask: expandedMask,
                pixelCount,
                method: 'guided-edge-fill' as const,
                score: weightedBoundaryScore(filteredAlignment, pixelCount) + (guideShape.iou * 0.16) + (guideShape.recall * 0.06),
                guideShape,
            };
        })();
        debugCandidates.push({
            method: 'radial-raw-local-color',
            pixelCount: radialRawLocalColorCandidate?.pixelCount ?? 0,
            score: Number((radialRawLocalColorCandidate?.score ?? 0).toFixed(4)),
            supportRatio: Number((
                radialRawLocalColorCandidate
                    ? scoreMaskBoundaryAlignment({
                        mask: radialRawLocalColorCandidate.mask,
                        barrierMask: rawBarrierMask ?? barrierMask,
                        width: MASK_WIDTH,
                        height: MASK_HEIGHT,
                    }).supportRatio
                    : 0
            ).toFixed(4)),
            guideRecall: Number((radialRawLocalColorCandidate?.guideShape.recall ?? 0).toFixed(4)),
            usable: radialRawLocalColorCandidate != null,
        });
        debugCandidates.push({
            method: 'guided-edge-fill',
            pixelCount: guidedEdgeFillCandidate?.pixelCount ?? 0,
            score: Number((guidedEdgeFillCandidate?.score ?? 0).toFixed(4)),
            supportRatio: Number((
                guidedEdgeFillCandidate
                    ? scoreMaskBoundaryAlignment({
                        mask: guidedEdgeFillCandidate.mask,
                        barrierMask,
                        width: MASK_WIDTH,
                        height: MASK_HEIGHT,
                    }).supportRatio
                    : 0
            ).toFixed(4)),
            guideRecall: Number((guidedEdgeFillCandidate?.guideShape.recall ?? 0).toFixed(4)),
            usable: guidedEdgeFillCandidate != null,
        });
        const bestResolvedRadialCandidate = (() => {
            const candidates = [
                bestRadialCandidate,
                radialRingBarrierCandidate,
                radialRawRingBarrierCandidate,
                radialRawLocalColorCandidate,
                guidedEdgeFillCandidate,
            ]
                .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null);
            if (candidates.length === 0) {
                return null;
            }
            candidates.sort((left, right) => right.score - left.score || right.pixelCount - left.pixelCount);
            return candidates[0];
        })();

        const shouldPreferRadial = radialUsable && (
            !colorUsable
            || colorPixelCount === 0
            || (bestResolvedRadialCandidate?.score ?? 0) > colorScore + (bootstrapGuideMask ? MAGIC_RADIAL_SCORE_MARGIN : MAGIC_RADIAL_UNGUIDED_SCORE_MARGIN)
            || (!bootstrapGuideMask && radialPixelCount < colorPixelCount * 0.82)
        );

        const shouldFallBackToShapeOutline = bootstrapShapeMask != null && (
            bootstrapShapeSource === 'static'
                ? (
                    bestResolvedRadialCandidate == null
                    || bestResolvedRadialCandidate.guideShape.precision < 0.94
                    || bestResolvedRadialCandidate.guideShape.recall < 0.68
                    || bestResolvedRadialCandidate.pixelCount < bootstrapShapeMaskPixelCount * 0.42
                    || bestResolvedRadialCandidate.pixelCount > bootstrapShapeMaskPixelCount * 1.06
                )
                : bootstrapShapeSource === 'persisted'
                    ? (
                        bestResolvedRadialCandidate == null
                        || bestResolvedRadialCandidate.guideShape.recall < 0.45
                        || bestResolvedRadialCandidate.pixelCount < bootstrapShapeMaskPixelCount * 0.45
                    )
                    : bestResolvedRadialCandidate == null
        );

        if (shouldFallBackToShapeOutline) {
            return {
                mask: bootstrapShapeMask,
                pixelCount: bootstrapShapeMaskPixelCount,
                method: 'shape-outline' as const,
                guideRejected,
                debug: {
                    candidates: debugCandidates,
                    bootstrapShapeSource,
                    fellBackToShapeOutline: true,
                },
            };
        }

        return shouldPreferRadial
            ? {
                mask: bestResolvedRadialCandidate?.mask ?? (radialInteriorUsable ? radialInteriorMask! : shouldUseRadialColorMask ? radialColorMask! : radialMask!),
                pixelCount: bestResolvedRadialCandidate?.pixelCount ?? (radialInteriorUsable ? radialInteriorPixelCount : shouldUseRadialColorMask ? radialColorPixelCount : radialPixelCount),
                method: bestResolvedRadialCandidate?.method ?? (radialInteriorUsable
                    ? 'radial-barrier' as const
                    : shouldUseRadialColorMask
                        ? 'radial-color' as const
                        : 'radial' as const),
                guideRejected,
                debug: {
                    candidates: debugCandidates,
                    bootstrapShapeSource,
                    fellBackToShapeOutline: false,
                },
            }
            : {
                mask: boundedColorMask,
                pixelCount: colorPixelCount,
                method: 'color' as const,
                guideRejected,
                debug: {
                    candidates: debugCandidates,
                    bootstrapShapeSource,
                    fellBackToShapeOutline: false,
                },
            };
    }, [authoritativeBootstrapGuideMasks, authoritativeTruthMasks, regionColorTolerance, regions]);

    React.useEffect(() => {
        const image = new Image();
        image.onload = () => {
            setMapImage(image);
        };
        image.src = DEFAULT_MAP_PATH;
    }, []);

    const renderAssignments = React.useCallback(() => {
        const canvas = maskCanvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) {
            return;
        }

        const palette = regions.map((region) => hexToRgb(region.color));
        const pixels = buildMaskPixelBuffer({
            assignments: assignmentsRef.current,
            palette,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        context.putImageData(new ImageData(pixels, MASK_WIDTH, MASK_HEIGHT), 0, 0);
    }, [regions]);

    const renderSelectedOutline = React.useCallback(() => {
        const canvas = outlineCanvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) {
            return;
        }
        context.clearRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
        if (selectedRegionIndex < 0) {
            return;
        }

        const outerPixels = buildRegionOutlinePixelBuffer({
            assignments: assignmentsRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            regionIndex: selectedRegionIndex,
            color: [23, 17, 12],
            thickness: 6,
            alpha: 180,
        });
        const glowPixels = buildRegionOutlinePixelBuffer({
            assignments: assignmentsRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            regionIndex: selectedRegionIndex,
            color: [255, 217, 136],
            thickness: 3,
            alpha: 220,
        });
        const pixels = buildRegionOutlinePixelBuffer({
            assignments: assignmentsRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            regionIndex: selectedRegionIndex,
            color: [255, 244, 214],
            thickness: 1,
            alpha: 255,
        });
        context.putImageData(new ImageData(outerPixels, MASK_WIDTH, MASK_HEIGHT), 0, 0);
        context.putImageData(new ImageData(glowPixels, MASK_WIDTH, MASK_HEIGHT), 0, 0);
        context.putImageData(new ImageData(pixels, MASK_WIDTH, MASK_HEIGHT), 0, 0);
    }, [selectedRegionIndex]);

    const renderBarrierOverlay = React.useCallback(() => {
        const canvas = barrierCanvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) {
            return;
        }
        context.clearRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
        if (
            !boundaryDraftMaskRef.current
            && !heuristicBarrierMaskRef.current
            && manualBarrierAddRef.current.every((value) => value === 0)
            && manualBarrierRemoveRef.current.every((value) => value === 0)
        ) {
            return;
        }

        const pixels = buildBarrierDebugPixelBuffer({
            heuristicMask: boundaryDraftMaskRef.current ?? heuristicBarrierMaskRef.current,
            addMask: manualBarrierAddRef.current,
            removeMask: manualBarrierRemoveRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
        });
        context.putImageData(new ImageData(pixels, MASK_WIDTH, MASK_HEIGHT), 0, 0);
    }, []);

    const rebuildBarrierMask = React.useCallback(() => {
        if (!sourcePixelsRef.current) {
            colorLineBarrierMaskRef.current = null;
            colorBarrierMaskRef.current = null;
            rawColorBarrierMaskRef.current = null;
            rawHeuristicBarrierMaskRef.current = null;
            rawBarrierMaskRef.current = null;
            barrierMaskRef.current = null;
            setBarrierPixelCount(0);
            renderBarrierOverlay();
            return;
        }

        const activeRules = boundaryPresets
            .filter((preset) => preset.enabled)
            .map((preset) => ({
                id: preset.id,
                rgb: preset.rgb,
                tolerance: boundaryTolerance,
                enabled: true,
            }));

        const colorBarrierMask = buildBarrierMask({
            source: sourcePixelsRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            rules: activeRules,
            expansion: boundaryExpansion,
            minComponentPixels: DEFAULT_BOUNDARY_COMPONENT_MIN_PIXELS,
            blurRadius: HEURISTIC_BARRIER_BLUR_RADIUS,
            lineFilter: HEURISTIC_BARRIER_LINE_FILTER,
        });
        const colorLineBarrierMask = buildBarrierMask({
            source: sourcePixelsRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            rules: activeRules,
            expansion: 0,
            minComponentPixels: DEFAULT_BOUNDARY_COMPONENT_MIN_PIXELS,
            blurRadius: HEURISTIC_BARRIER_BLUR_RADIUS,
            lineFilter: HEURISTIC_BARRIER_LINE_FILTER,
        });
        const rawColorBarrierMask = buildBarrierMask({
            source: sourcePixelsRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            rules: activeRules,
            expansion: boundaryExpansion,
            minComponentPixels: DEFAULT_BOUNDARY_COMPONENT_MIN_PIXELS,
            blurRadius: HEURISTIC_BARRIER_BLUR_RADIUS,
            lineFilter: null,
        });
        const gradientBarrierMask = buildGradientBarrierMask({
            source: sourcePixelsRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            ...HEURISTIC_GRADIENT_BARRIER,
        });
        const rawGradientBarrierMask = buildGradientBarrierMask({
            source: sourcePixelsRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            ...HEURISTIC_GRADIENT_BARRIER,
            lineFilter: null,
        });
        const boundaryDraftMask = boundaryDraftMaskRef.current;
        const rawBarrierMask = boundaryDraftMask
            ? boundaryDraftMask
            : (
                paintedBoundaryOnly
                    ? rawColorBarrierMask
                    : unionBinaryMasks(rawColorBarrierMask, rawGradientBarrierMask)
            );
        const barrierMask = boundaryDraftMask
            ? boundaryDraftMask
            : (
                paintedBoundaryOnly
                    ? colorBarrierMask
                    : unionBinaryMasks(colorBarrierMask, gradientBarrierMask)
            );
        rawColorBarrierMaskRef.current = composeBarrierMask({
            baseMask: rawColorBarrierMask,
            addMask: manualBarrierAddRef.current,
            removeMask: manualBarrierRemoveRef.current,
        });
        colorLineBarrierMaskRef.current = composeBarrierMask({
            baseMask: colorLineBarrierMask,
            addMask: manualBarrierAddRef.current,
            removeMask: manualBarrierRemoveRef.current,
        });
        colorBarrierMaskRef.current = composeBarrierMask({
            baseMask: colorBarrierMask,
            addMask: manualBarrierAddRef.current,
            removeMask: manualBarrierRemoveRef.current,
        });
        rawHeuristicBarrierMaskRef.current = rawBarrierMask;
        rawBarrierMaskRef.current = composeBarrierMask({
            baseMask: rawBarrierMask,
            addMask: manualBarrierAddRef.current,
            removeMask: manualBarrierRemoveRef.current,
        });
        heuristicBarrierMaskRef.current = barrierMask;
        barrierMaskRef.current = composeBarrierMask({
            baseMask: barrierMask,
            addMask: manualBarrierAddRef.current,
            removeMask: manualBarrierRemoveRef.current,
        });
        setBoundaryDraftPixelCount(boundaryDraftMask ? countMaskPixels(boundaryDraftMask) : 0);
        setBarrierPixelCount(countMaskPixels(barrierMaskRef.current));
        setManualBarrierAddCount(countMaskPixels(manualBarrierAddRef.current));
        setManualBarrierRemoveCount(countMaskPixels(manualBarrierRemoveRef.current));
        renderBarrierOverlay();
    }, [boundaryExpansion, boundaryPresets, boundaryTolerance, paintedBoundaryOnly, renderBarrierOverlay]);

    React.useEffect(() => {
        rebuildBarrierMaskRef.current = rebuildBarrierMask;
    }, [rebuildBarrierMask]);

    React.useEffect(() => {
        let cancelled = false;

        const loadPersistedRegionData = async () => {
            try {
                const response = await fetch(LOAD_ENDPOINT);
                if (response.status === 404) {
                    return;
                }
                if (!response.ok) {
                    const detail = await response.text();
                    throw new Error(detail || response.statusText);
                }

                const payload = await response.json() as {
                    maskPngDataUrl?: unknown;
                    boundaryMaskPngDataUrl?: unknown;
                    barrierHints?: {
                        addPngDataUrl?: unknown;
                        removePngDataUrl?: unknown;
                    };
                    authoritativeGuides?: {
                        maskPngDataUrl?: unknown;
                        regionIds?: unknown;
                    } | null;
                    regions?: {
                        boundaryRules?: unknown;
                        boundaryExpansion?: unknown;
                        regionColorTolerance?: unknown;
                        paintedBoundaryOnly?: unknown;
                        regions?: unknown;
                    };
                    graph?: {
                        edges?: unknown;
                    };
                };

                if (typeof payload.maskPngDataUrl !== 'string') {
                    throw new Error('缺少已保存的 mask PNG');
                }
                const loadedAuthoritativeGuideIds = normalizeLoadedAuthoritativeGuideIds(payload.authoritativeGuides?.regionIds ?? null);

                const loadedRegions = normalizeLoadedRegions(payload.regions?.regions);
                if (loadedRegions.length === 0) {
                    throw new Error('已保存区域定义为空');
                }
                const [nextAssignments, nextBoundaryDraftMask, nextBarrierAddMask, nextBarrierRemoveMask] = await Promise.all([
                    readAssignmentsFromImageSource({
                        src: payload.maskPngDataUrl,
                        regions: loadedRegions,
                    }),
                    readBinaryMaskFromImageSource(typeof payload.boundaryMaskPngDataUrl === 'string' ? payload.boundaryMaskPngDataUrl : null),
                    readBinaryMaskFromImageSource(payload.barrierHints?.addPngDataUrl ?? null),
                    readBinaryMaskFromImageSource(payload.barrierHints?.removePngDataUrl ?? null),
                ]);

                const loadedCenters = computeRegionCenters({
                    assignments: nextAssignments,
                    width: MASK_WIDTH,
                    regionCount: loadedRegions.length,
                });
                let mismatchedSeedCount = 0;
                const normalizedRegions = loadedRegions.map((region, regionIndex) => {
                    const loadedCenter = loadedCenters[regionIndex] ?? null;
                    const staticShapeMask = STATIC_BOOTSTRAP_SHAPE_MASKS.get(region.id) ?? null;
                    const nextSeed = loadedCenter
                        ? { x: loadedCenter.x, y: loadedCenter.y }
                        : region.seed
                            ? { x: region.seed.x, y: region.seed.y }
                            : getRegionShapeCenterPoint(region.name, { x: 0, y: 0 });
                    if (
                        staticShapeMask
                        && !maskContainsPoint({
                            mask: staticShapeMask,
                            width: MASK_WIDTH,
                            x: nextSeed.x,
                            y: nextSeed.y,
                        })
                    ) {
                        mismatchedSeedCount += 1;
                    }
                    return {
                        ...region,
                        seed: nextSeed,
                    };
                });

                if (cancelled) {
                    return;
                }

                assignmentsRef.current = nextAssignments;
                boundaryDraftMaskRef.current = countMaskPixels(nextBoundaryDraftMask) > 0 ? nextBoundaryDraftMask : null;
                manualBarrierAddRef.current = nextBarrierAddMask;
                manualBarrierRemoveRef.current = nextBarrierRemoveMask;
                pendingSeedNormalizationRef.current = true;
                setAuthoritativeGuideRegionIds(loadedAuthoritativeGuideIds.filter((regionId) => loadedRegions.some((region) => region.id === regionId)));
                setRegions(normalizedRegions);
                setSelectedRegionId(normalizedRegions.find((region) => region.seed)?.id ?? normalizedRegions[0].id);
                setPassages(normalizeLoadedPassages(payload.graph?.edges));
                setBoundaryPresets(normalizeLoadedBoundaryPresets(payload.regions?.boundaryRules));

                const loadedTolerance = extractBoundaryTolerance(payload.regions?.boundaryRules);
                if (loadedTolerance != null) {
                    setBoundaryTolerance(loadedTolerance);
                }
                if (typeof payload.regions?.boundaryExpansion === 'number') {
                    setBoundaryExpansion(payload.regions.boundaryExpansion);
                }
                if (typeof payload.regions?.regionColorTolerance === 'number') {
                    setRegionColorTolerance(payload.regions.regionColorTolerance);
                }
                if (typeof payload.regions?.paintedBoundaryOnly === 'boolean') {
                    setPaintedBoundaryOnly(payload.regions.paintedBoundaryOnly);
                }

                rebuildBarrierMaskRef.current();
                const correctedSeedNote = mismatchedSeedCount > 0
                    ? ` 已保留 ${mismatchedSeedCount} 个与 static shape 不一致的现有 seed；静态 shape 仅作 bootstrap 参考。`
                    : '';
                setStatusMessage(`已自动读取 ${DATA_OUTPUT_DIR} 中的区域数据；刷新后继续在上次结果上修边。${correctedSeedNote}`);
            } catch (error: unknown) {
                if (cancelled) {
                    return;
                }
                setStatusMessage(`读取已保存区域数据失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
        };

        void loadPersistedRegionData();

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        const canvas = bgCanvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context || !mapImage) {
            return;
        }

        context.clearRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
        context.drawImage(mapImage, 0, 0, MASK_WIDTH, MASK_HEIGHT);
        sourcePixelsRef.current = context.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data;
        rebuildBarrierMask();
    }, [mapImage, rebuildBarrierMask]);

    React.useEffect(() => {
        rebuildBarrierMask();
    }, [rebuildBarrierMask]);

    React.useEffect(() => {
        renderAssignments();
        renderSelectedOutline();
    }, [regions, renderAssignments, renderSelectedOutline]);

    React.useEffect(() => {
        if (!pendingSeedNormalizationRef.current) {
            return;
        }
        const barrierMask = barrierMaskRef.current;
        if (!barrierMask || regions.length === 0) {
            return;
        }

        let correctedSeedCount = 0;
        setRegions((current) => {
            let changed = false;
            const next = current.map((region) => {
                if (isDiagnosticRegionId(region.id)) {
                    return region;
                }
                const guideMask = bootstrapGuideMasks.get(region.id) ?? bootstrapShapeMasks.get(region.id) ?? null;
                if (!guideMask) {
                    return region;
                }
                const anchorPoint = region.seed && maskContainsPoint({
                    mask: guideMask,
                    width: MASK_WIDTH,
                    x: region.seed.x,
                    y: region.seed.y,
                })
                    ? region.seed
                    : getRegionShapeCenterPoint(region.name, region.seed ?? { x: 0, y: 0 });
                const nextSeed = findBestInteriorSeedPointInMask(anchorPoint, barrierMask, guideMask)
                    ?? findBestInteriorSeedPoint(anchorPoint, barrierMask, 24, guideMask)
                    ?? findNearestNonBarrierPoint(anchorPoint, barrierMask, 32, guideMask);
                if (!nextSeed || (region.seed?.x === nextSeed.x && region.seed?.y === nextSeed.y)) {
                    return region;
                }
                changed = true;
                correctedSeedCount += 1;
                return {
                    ...region,
                    seed: nextSeed,
                };
            });
            return changed ? next : current;
        });
        pendingSeedNormalizationRef.current = false;
        if (correctedSeedCount > 0) {
            setStatusMessage(`已把 ${correctedSeedCount} 个 formal 区域 seed 校正到 guide 内可用内部点，fresh 首击将直接使用更新后的种子。`);
        }
    }, [bootstrapGuideMasks, bootstrapShapeMasks, regions]);

    React.useEffect(() => {
        renderSelectedOutline();
    }, [renderSelectedOutline, selectedRegionId]);

    React.useEffect(() => {
        const element = viewportRef.current;
        if (!element) {
            return;
        }

        const updateFitZoom = () => {
            const rect = element.getBoundingClientRect();
            const nextFit = Math.max(
                MIN_FIT_ZOOM,
                Math.min(
                    MAX_FIT_ZOOM,
                    (rect.width - 24) / MASK_WIDTH,
                    (rect.height - 24) / MASK_HEIGHT,
                ),
            );
            setFitZoom(Number.isFinite(nextFit) ? nextFit : 1);
        };

        updateFitZoom();
        const observer = new ResizeObserver(updateFitZoom);
        observer.observe(element);
        window.addEventListener('resize', updateFitZoom);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateFitZoom);
        };
    }, []);

    React.useEffect(() => {
        const canvas = maskCanvasRef.current;
        if (!canvas) {
            return;
        }
        canvas.style.opacity = showMask ? String(maskOpacity) : '0';
    }, [maskOpacity, showMask]);

    React.useEffect(() => {
        const canvas = barrierCanvasRef.current;
        if (!canvas) {
            return;
        }
        canvas.style.opacity = showBarrier ? '0.55' : '0';
    }, [showBarrier]);

    const syncGraphNodes = React.useCallback(() => {
        const centers = computeRegionCenters({
            assignments: assignmentsRef.current,
            width: MASK_WIDTH,
            regionCount: regions.length,
        });
        setGraphNodes(
            centers.flatMap((center) => {
                const region = regions[center.regionIndex];
                if (!region || isDiagnosticRegionId(region.id)) {
                    return [];
                }
                return [{
                    id: region.id,
                    name: region.name,
                    color: region.color,
                    x: center.x,
                    y: center.y,
                    pixelCount: center.pixelCount,
                }];
            }),
        );
    }, [regions]);

    React.useEffect(() => {
        syncGraphNodes();
    }, [syncGraphNodes]);

    const graphNodeMap = React.useMemo(() => new Map(graphNodes.map((node) => [node.id, node])), [graphNodes]);
    const refreshBoundaryControlPoints = React.useCallback(() => {
        if (selectedRegionIndex < 0) {
            setBoundaryControlPoints([]);
            return;
        }
        setBoundaryControlPoints(sampleRegionBoundaryPoints({
            assignments: assignmentsRef.current,
            width: MASK_WIDTH,
            regionIndex: selectedRegionIndex,
            maxPoints: 18,
        }));
    }, [selectedRegionIndex]);
    const markAssignmentsChanged = React.useCallback(() => {
        setAssignmentsVersion((current) => current + 1);
        syncGraphNodes();
        refreshBoundaryControlPoints();
        renderSelectedOutline();
    }, [refreshBoundaryControlPoints, renderSelectedOutline, syncGraphNodes]);

    React.useEffect(() => {
        refreshBoundaryControlPoints();
    }, [refreshBoundaryControlPoints]);

    const duplicateColorSet = React.useMemo(() => {
        const colorCounts = new Map<string, number>();
        for (const region of regions) {
            const normalized = region.color.toLowerCase();
            colorCounts.set(normalized, (colorCounts.get(normalized) ?? 0) + 1);
        }
        return new Set(
            Array.from(colorCounts.entries())
                .filter(([, count]) => count > 1)
                .map(([color]) => color),
        );
    }, [regions]);

    const focusDiagnosticSample = React.useCallback((sample: DiagnosticSample) => {
        const existingFormalRegion = regions.find((region) => (
            region.name === sample.regionName && !isDiagnosticRegionId(region.id)
        ));
        const diagnosticRegionId = buildDiagnosticRegionId(sample.id);
        const existingDiagnosticRegion = regions.find((region) => region.id === diagnosticRegionId);
        if (!existingFormalRegion && !existingDiagnosticRegion) {
            setRegions((current) => [...current, createDiagnosticRegion(sample, current.length)]);
        }
        setSelectedRegionId(existingFormalRegion?.id ?? existingDiagnosticRegion?.id ?? diagnosticRegionId);
        setActiveDiagnosticSampleId(sample.id);
        setShowBarrier(true);
        setMode('wand');
        setStatusMessage(
            `${sample.label} · ${sample.regionName} @ ${sample.point.x}, ${sample.point.y}。若没有正式区域，会创建仅供 devtools 使用的临时区域；它可直接走魔棒/锁链，但不会写入正式 mask/graph。`,
        );

        const viewport = viewportRef.current;
        if (!viewport) {
            return;
        }

        const targetLeft = (sample.point.x * displayScale) - (viewport.clientWidth / 2) + 16;
        const targetTop = (sample.point.y * displayScale) - (viewport.clientHeight / 2) + 16;
        viewport.scrollTo({
            left: clampScroll(targetLeft),
            top: clampScroll(targetTop),
            behavior: 'smooth',
        });
    }, [displayScale, regions]);

    React.useEffect(() => {
        const sample = DIAGNOSTIC_SAMPLES.find((item) => item.id === activeDiagnosticSampleId);
        const sourcePixels = sourcePixelsRef.current;
        if (!sample || !sourcePixels || !heuristicBarrierMaskRef.current || !barrierMaskRef.current) {
            setDiagnosticPreview(null);
            return;
        }

        const diagnosticRegionId = buildDiagnosticRegionId(sample.id);
        const sampleRegion = regions.find((region) => (
            region.id === diagnosticRegionId
            || (!isDiagnosticRegionId(region.id) && region.name === sample.regionName)
        ));
        const previewPoint = findBestInteriorSeedPoint(sample.point, barrierMaskRef.current, 8)
            ?? sample.point;
        const selection = buildMagicSelection(previewPoint, sampleRegion?.id ?? null);
        const heuristicSelection = sample.truthGuide
            ? buildMagicSelection(previewPoint, sampleRegion?.id ?? null, { disableTruthGuide: true })
            : selection;
        const displaySelection = heuristicSelection ?? selection;
        const fillMask = displaySelection?.mask ?? new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
        const fillPixelCount = displaySelection?.pixelCount ?? 0;
        const usable = isMagicSelectionUsable(fillPixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO);
        const diagnosticRegionIndex = regions.findIndex((region) => region.id === diagnosticRegionId);
        if (
            selectedRegionId === diagnosticRegionId
            && diagnosticRegionIndex >= 0
            && displaySelection
            && fillPixelCount > 0
            && usable
        ) {
            replaceRegionWithSelection({
                assignments: assignmentsRef.current,
                selectionMask: displaySelection.mask,
                regionIndex: diagnosticRegionIndex,
            });
            renderAssignments();
        }
        (window as typeof window & { __QIDAHEN_REGION_DEBUG__?: unknown }).__QIDAHEN_REGION_DEBUG__ = {
            kind: 'diagnostic-preview',
            sampleId: sample.id,
            point: previewPoint,
            selectedRegionId: sampleRegion?.id ?? null,
            chosenMethod: displaySelection?.method ?? null,
            chosenPixelCount: fillPixelCount,
            selection: displaySelection?.debug ?? null,
        };
        const methodLabel = displaySelection?.method === 'radial'
            ? '边界环'
            : displaySelection?.method === 'truth-guide'
                ? '显式 guide 真相'
            : displaySelection?.method === 'shape-outline'
                ? '形状轮廓'
            : displaySelection?.method === 'shape-barrier'
                ? '形状约束停线'
            : displaySelection?.method === 'shape-color'
                ? '形状约束颜色停线'
            : displaySelection?.method === 'guide-local-color'
                ? '局部护栏内颜色停线'
            : displaySelection?.method === 'guide-boundary-interior'
                ? '局部护栏内外裁 inside'
            : displaySelection?.method === 'radial-color'
                ? '边界环内颜色停线'
            : displaySelection?.method === 'radial-ring'
                ? '边界环贴边扩张'
            : displaySelection?.method === 'radial-barrier'
                    ? '边界环内边界抠区'
                    : '颜色停线';
        const crop = buildCropRect(previewPoint);
        const truthMask = sample.truthGuide && selection?.method === 'truth-guide'
            ? selection.mask
            : null;
        let comparisonDataUrl: string | null = null;
        let comparisonLabel: string | null = null;
        if (truthMask && heuristicSelection?.mask) {
            let missedPixelCount = 0;
            let overflowPixelCount = 0;
            for (let index = 0; index < truthMask.length; index += 1) {
                const inTruth = truthMask[index] !== 0;
                const inHeuristic = heuristicSelection.mask[index] !== 0;
                if (inTruth && !inHeuristic) {
                    missedPixelCount += 1;
                } else if (!inTruth && inHeuristic) {
                    overflowPixelCount += 1;
                }
            }
            const overlap = measureMaskOverlap(heuristicSelection.mask, truthMask);
            comparisonDataUrl = buildCropDataUrl({
                pixels: buildMaskComparisonPixelBuffer({
                    heuristicMask: heuristicSelection.mask,
                    truthMask,
                }),
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                crop,
                scale: 2,
            });
            comparisonLabel = `漏选 ${missedPixelCount.toLocaleString()} · 越界 ${overflowPixelCount.toLocaleString()} · IoU ${overlap.iou.toFixed(2)}`;
        }
        setDiagnosticPreview({
            sampleId: sample.id,
            originalDataUrl: buildCropDataUrl({
                pixels: sourcePixels,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                crop,
                scale: 2,
            }),
            heuristicBarrierDataUrl: buildCropDataUrl({
                pixels: buildSolidMaskPixelBuffer({
                    mask: heuristicBarrierMaskRef.current,
                    color: HEURISTIC_BARRIER_COLOR,
                }),
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                crop,
                scale: 2,
            }),
            fillDataUrl: buildCropDataUrl({
                pixels: buildSolidMaskPixelBuffer({
                    mask: fillMask,
                    color: [255, 196, 61],
                }),
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                crop,
                scale: 2,
            }),
            fillPixelCount,
            usable,
            method: displaySelection?.method ?? null,
            methodLabel,
            guideRejected: displaySelection?.guideRejected ?? false,
            comparisonDataUrl,
            comparisonLabel,
        });
    }, [activeDiagnosticSampleId, barrierPixelCount, boundaryExpansion, boundaryTolerance, buildMagicSelection, regions, renderAssignments, selectedRegionId]);

    const applyChainSelection = React.useCallback((points: readonly MaskPoint[]) => {
        if (selectedRegionIndex < 0 || !selectedRegion) {
            return;
        }
        if (points.length < 2) {
            setStatusMessage('锁链点数不足：沿边界拖出一段链条后再松开。');
            return;
        }

        const operation = chainOperationRef.current;
        const selectionMask = rasterizeStrokeMask({
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            points: points.map((point) => [point.x, point.y] as const),
            radius: Math.max(2, brushSize),
        });
        const before = assignmentsRef.current.slice();
        let changed = 0;

        if (operation === 'subtract') {
            for (let index = 0; index < selectionMask.length; index += 1) {
                if (selectionMask[index] === 0 || assignmentsRef.current[index] !== selectedRegionIndex) {
                    continue;
                }
                assignmentsRef.current[index] = EMPTY_REGION;
                changed += 1;
            }
        } else {
            for (let index = 0; index < selectionMask.length; index += 1) {
                if (selectionMask[index] === 0) {
                    continue;
                }
                if (assignmentsRef.current[index] !== selectedRegionIndex) {
                    assignmentsRef.current[index] = selectedRegionIndex;
                    changed += 1;
                }
            }
        }

        if (changed === 0) {
            setStatusMessage('锁链没有改变像素；请贴着当前区域边界拖动，或切换加/减模式。');
            return;
        }

        const summary = getRegionComponentSummary({
            assignments: assignmentsRef.current,
            width: MASK_WIDTH,
            regionIndex: selectedRegionIndex,
        });
        if (summary.totalPixelCount === 0 || summary.componentCount > 1) {
            assignmentsRef.current = before;
            renderAssignments();
            setStatusMessage(`锁链已拒绝：${selectedRegion.name} 必须保持一个连续区域，不能产生 ${summary.componentCount} 个碎块。`);
            return;
        }

        renderAssignments();
        markAssignmentsChanged();
        const operationLabel = operation === 'subtract' ? '已减去' : '已加入';
        setStatusMessage(`锁链${operationLabel} ${selectedRegion.name} · ${changed.toLocaleString()} px · 连续块 1`);
    }, [brushSize, markAssignmentsChanged, renderAssignments, selectedRegion, selectedRegionIndex]);

    const snapChainPointToBarrier = React.useCallback((point: MaskPoint) => {
        const barrierMask = barrierMaskRef.current;
        if (!barrierMask) {
            return point;
        }
        return findNearestBarrierPoint(point, barrierMask, 18) ?? point;
    }, []);

    const applyBrushAtPointer = React.useCallback((clientX: number, clientY: number) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) {
            return;
        }
        const point = mapClientPointToCanvas(canvas, clientX, clientY);
        const regionIndex = mode === 'erase' ? EMPTY_REGION : selectedRegionIndex;

        if (regionIndex < 0 && mode !== 'erase') {
            return;
        }

        const bounds = applyBrushToAssignments({
            assignments: assignmentsRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            centerX: point.x,
            centerY: point.y,
            radius: brushSize,
            regionIndex,
        });

        if (!bounds) {
            return;
        }

        renderAssignments();
        markAssignmentsChanged();
        setStatusMessage(
            mode === 'erase'
                ? `已擦除 ${bounds.right - bounds.left + 1}x${bounds.bottom - bounds.top + 1} 范围。`
                : `手修 ${selectedRegion?.name ?? '当前区域'} · 画笔 ${brushSize}px`,
        );
    }, [brushSize, markAssignmentsChanged, mode, renderAssignments, selectedRegion?.name, selectedRegionIndex]);

    const applyBarrierHintAtPointer = React.useCallback((clientX: number, clientY: number) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) {
            return;
        }
        const point = mapClientPointToCanvas(canvas, clientX, clientY);
        const targetMask = barrierHintOperation === 'add'
            ? manualBarrierAddRef.current
            : manualBarrierRemoveRef.current;
        const oppositeMask = barrierHintOperation === 'add'
            ? manualBarrierRemoveRef.current
            : manualBarrierAddRef.current;

        const primaryBounds = applyBrushToBinaryMask({
            mask: targetMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            centerX: point.x,
            centerY: point.y,
            radius: brushSize,
            value: 1,
        });
        applyBrushToBinaryMask({
            mask: oppositeMask,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            centerX: point.x,
            centerY: point.y,
            radius: brushSize,
            value: 0,
        });

        if (!primaryBounds) {
            return;
        }

        rebuildBarrierMask();
        const operationLabel = barrierHintOperation === 'add' ? '补边' : '去噪';
        setStatusMessage(
            `边界修正 ${operationLabel} · ${primaryBounds.right - primaryBounds.left + 1}x${primaryBounds.bottom - primaryBounds.top + 1} · 最终停线已重算`,
        );
    }, [barrierHintOperation, brushSize, rebuildBarrierMask]);

    const applyBarrierHintStroke = React.useCallback((points: readonly MaskPoint[]) => {
        if (points.length < 2) {
            setStatusMessage('桥接点数不足：至少拖出一条线段后再松开。');
            return;
        }

        const snappedPoints = barrierHintOperation === 'add'
            ? points.map((point, index) => {
                if (index !== 0 && index !== points.length - 1) {
                    return point;
                }
                return snapChainPointToBarrier(point);
            })
            : [...points];
        const strokeMask = rasterizeStrokeMask({
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            points: snappedPoints.map((point) => [point.x, point.y] as const),
            radius: Math.max(1.25, Math.min(4, brushSize * 0.33)),
        });
        const targetMask = barrierHintOperation === 'add'
            ? manualBarrierAddRef.current
            : manualBarrierRemoveRef.current;
        const oppositeMask = barrierHintOperation === 'add'
            ? manualBarrierRemoveRef.current
            : manualBarrierAddRef.current;

        let changed = 0;
        for (let index = 0; index < strokeMask.length; index += 1) {
            if (strokeMask[index] === 0) {
                continue;
            }
            if (targetMask[index] === 0) {
                targetMask[index] = 1;
                changed += 1;
            }
            oppositeMask[index] = 0;
        }

        if (changed === 0) {
            setStatusMessage('桥接没有新增边界像素；换一段更明确的漏缝再试。');
            return;
        }

        rebuildBarrierMask();
        const operationLabel = barrierHintOperation === 'add' ? '补边桥接' : '去噪桥接';
        setStatusMessage(`${operationLabel} · ${changed.toLocaleString()} px · 最终停线已重算`);
    }, [barrierHintOperation, brushSize, rebuildBarrierMask, snapChainPointToBarrier]);

    const handleMagicFill = React.useCallback((clientX: number, clientY: number) => {
        const canvas = maskCanvasRef.current;
        const barrierMask = barrierMaskRef.current;
        const sourcePixels = sourcePixelsRef.current;
        if (!canvas || !barrierMask || !sourcePixels) {
            setStatusMessage('边界数据还没准备好，先等地图加载完成。');
            return;
        }
        if (selectedRegionIndex < 0 || !selectedRegion) {
            return;
        }

        const clickedPoint = mapClientPointToCanvas(canvas, clientX, clientY);
        const authoritativeBootstrapGuideMaskRaw = authoritativeBootstrapGuideMasks.get(selectedRegion.id) ?? null;
        const authoritativeTruthMaskRaw = authoritativeTruthMasks.get(selectedRegion.id) ?? null;
        const staticBootstrapGuideMaskRaw = STATIC_BOOTSTRAP_GUIDE_MASKS.get(selectedRegion.id) ?? null;
        const staticBootstrapShapeMaskRaw = STATIC_BOOTSTRAP_SHAPE_MASKS.get(selectedRegion.id) ?? null;
        const persistedRegionMaskRaw = buildRegionMaskFromAssignments(assignmentsRef.current, selectedRegionIndex);
        const persistedRegionGuideMaskRaw = persistedRegionMaskRaw
            ? expandBinaryMask({
                mask: persistedRegionMaskRaw,
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                iterations: MAGIC_BOOTSTRAP_GUIDE_EXPANSION,
            })
            : null;
        const persistedStaticOverlap = measureMaskOverlap(
            persistedRegionMaskRaw,
            staticBootstrapShapeMaskRaw,
        );
        const persistedMaskMatchesStatic = staticBootstrapShapeMaskRaw == null
            || (
                persistedStaticOverlap.iou >= 0.12
                || (
                    persistedStaticOverlap.precision >= 0.24
                    && persistedStaticOverlap.recall >= 0.24
                )
            );
        const staticShapeContainsClickedPoint = maskContainsPoint({
            mask: staticBootstrapShapeMaskRaw,
            width: MASK_WIDTH,
            x: clickedPoint.x,
            y: clickedPoint.y,
        }) || maskContainsPoint({
            mask: staticBootstrapGuideMaskRaw,
            width: MASK_WIDTH,
            x: clickedPoint.x,
            y: clickedPoint.y,
        })
            ? staticBootstrapShapeMaskRaw
            : null;
        const authoritativeStaticOverlap = measureMaskOverlap(
            authoritativeTruthMaskRaw,
            staticBootstrapShapeMaskRaw,
        );
        const authoritativeTruthMatchesStatic = staticBootstrapShapeMaskRaw == null
            || (
                authoritativeStaticOverlap.precision >= 0.94
                && authoritativeStaticOverlap.recall >= 0.35
            );
        const authoritativeGuideContainsClickedPoint = authoritativeTruthMatchesStatic && authoritativeBootstrapGuideMaskRaw && maskContainsPoint({
            mask: authoritativeBootstrapGuideMaskRaw,
            width: MASK_WIDTH,
            x: clickedPoint.x,
            y: clickedPoint.y,
        })
            ? authoritativeTruthMaskRaw
            : null;
        const persistedMaskContainsClickedPoint = persistedMaskMatchesStatic && maskContainsPoint({
            mask: persistedRegionMaskRaw,
            width: MASK_WIDTH,
            x: clickedPoint.x,
            y: clickedPoint.y,
        })
            ? persistedRegionMaskRaw
            : null;
        const bootstrapGuideMask = authoritativeGuideContainsClickedPoint
            ? authoritativeBootstrapGuideMaskRaw
            : staticShapeContainsClickedPoint
            ? staticBootstrapGuideMaskRaw
            : persistedMaskContainsClickedPoint
                ? persistedRegionGuideMaskRaw
                : null;
        const bootstrapGuideBounds = bootstrapGuideMask
            ? getBinaryMaskBounds(bootstrapGuideMask, MASK_WIDTH)
            : null;
        const guidePreferredPoint = bootstrapGuideBounds
            ? {
                x: Math.round((bootstrapGuideBounds.left + bootstrapGuideBounds.right) / 2),
                y: Math.round((bootstrapGuideBounds.top + bootstrapGuideBounds.bottom) / 2),
            }
            : clickedPoint;
        const point = findBestInteriorSeedPoint(
                clickedPoint,
                barrierMask,
                bootstrapGuideMask ? 24 : 12,
                bootstrapGuideMask,
            ) ?? ((barrierMask[clickedPoint.y * MASK_WIDTH + clickedPoint.x] === 0
                && (!bootstrapGuideMask || bootstrapGuideMask[clickedPoint.y * MASK_WIDTH + clickedPoint.x] !== 0))
                ? clickedPoint
                : findNearestNonBarrierPoint(
                    clickedPoint,
                    barrierMask,
                    bootstrapGuideMask ? 32 : 22,
                    bootstrapGuideMask,
                )) ?? (bootstrapGuideMask
                    ? findBestInteriorSeedPointInMask(clickedPoint, barrierMask, bootstrapGuideMask)
                    : null) ?? (bootstrapGuideMask
                        ? findBestInteriorSeedPoint(guidePreferredPoint, barrierMask, 24, bootstrapGuideMask)
                        : null) ?? (bootstrapGuideMask
                            ? findNearestNonBarrierPoint(guidePreferredPoint, barrierMask, 32, bootstrapGuideMask)
                            : null);
        if (!point) {
            setStatusMessage(`点到了边界线：${clickedPoint.x}, ${clickedPoint.y}。附近没有可吸附的区域内部点。`);
            return;
        }

        const bootstrapShapeMask = authoritativeGuideContainsClickedPoint ?? staticShapeContainsClickedPoint ?? persistedMaskContainsClickedPoint;
        const bootstrapShapePixelCount = bootstrapShapeMask ? countMaskPixels(bootstrapShapeMask) : 0;
        const clickedPointInsideBootstrapGuide = bootstrapGuideMask
            ? bootstrapGuideMask[(clickedPoint.y * MASK_WIDTH) + clickedPoint.x] !== 0
            : false;
        const fitnessTieMargin = clickedPointInsideBootstrapGuide ? 0.025 : 0;
        const describeSelectionFitness = (selection: ReturnType<typeof buildMagicSelection>) => {
            if (!selection) {
                return {
                    fitness: Number.NEGATIVE_INFINITY,
                    chosenScore: 0,
                    chosenGuideRecall: 0,
                    coverageRatio: 0,
                };
            }
            const chosenCandidate = selection.debug?.candidates.find((candidate) => candidate.method === selection.method) ?? null;
            const chosenScore = chosenCandidate?.score ?? 0;
            const chosenGuideRecall = chosenCandidate?.guideRecall ?? 0;
            const coverageRatio = bootstrapShapePixelCount > 0
                ? Math.min(1, selection.pixelCount / bootstrapShapePixelCount)
                : 0;
            let fitness = chosenScore + (chosenGuideRecall * 0.42) + (coverageRatio * 0.26);

            if (selection.debug?.bootstrapShapeSource === 'static') {
                if (chosenGuideRecall < 0.22) {
                    fitness -= 0.55;
                }
                if (coverageRatio < 0.2) {
                    fitness -= 0.55;
                }
                if (chosenGuideRecall < 0.14 && coverageRatio < 0.14) {
                    fitness -= 0.8;
                }
            }

            return {
                fitness,
                chosenScore,
                chosenGuideRecall,
                coverageRatio,
            };
        };
        const seedCandidates = (() => {
            const candidates: MaskPoint[] = [point];
            const clickedPointInsideGuide = bootstrapGuideMask
                ? bootstrapGuideMask[(clickedPoint.y * MASK_WIDTH) + clickedPoint.x] !== 0
                : false;
            const maxGuideSeedDistanceSquared = clickedPointInsideGuide ? 24 * 24 : Number.POSITIVE_INFINITY;
            const pushCandidate = (candidate: MaskPoint | null) => {
                if (!candidate) {
                    return;
                }
                if (clickedPointInsideGuide) {
                    const distanceSquared = ((candidate.x - clickedPoint.x) * (candidate.x - clickedPoint.x))
                        + ((candidate.y - clickedPoint.y) * (candidate.y - clickedPoint.y));
                    if (distanceSquared > maxGuideSeedDistanceSquared) {
                        return;
                    }
                }
                if (candidates.some((current) => current.x === candidate.x && current.y === candidate.y)) {
                    return;
                }
                candidates.push(candidate);
            };
            const localOffsets: ReadonlyArray<readonly [number, number]> = [
                [0, 0],
                [8, 0],
                [-8, 0],
                [0, 8],
                [0, -8],
                [12, 12],
                [-12, 12],
                [12, -12],
                [-12, -12],
            ];
            const pushLocalInteriorCandidates = (anchorPoint: MaskPoint, searchRadius: number) => {
                for (const [offsetX, offsetY] of localOffsets) {
                    pushCandidate(findBestInteriorSeedPoint(
                        {
                            x: Math.max(0, Math.min(MASK_WIDTH - 1, anchorPoint.x + offsetX)),
                            y: Math.max(0, Math.min(MASK_HEIGHT - 1, anchorPoint.y + offsetY)),
                        },
                        barrierMask,
                        searchRadius,
                        bootstrapGuideMask,
                    ));
                }
            };
            if (bootstrapGuideMask) {
                pushLocalInteriorCandidates(clickedPoint, 12);
                pushCandidate(guidePreferredPoint);
                const guideInteriorSeed = findBestInteriorSeedPointInMask(guidePreferredPoint, barrierMask, bootstrapGuideMask);
                pushCandidate(guideInteriorSeed);
                if (guideInteriorSeed) {
                    pushLocalInteriorCandidates(guideInteriorSeed, 10);
                }
                const clickedInteriorSeed = findBestInteriorSeedPointInMask(clickedPoint, barrierMask, bootstrapGuideMask);
                pushCandidate(clickedInteriorSeed);
                if (clickedInteriorSeed) {
                    pushLocalInteriorCandidates(clickedInteriorSeed, 10);
                }
                pushCandidate(findBestInteriorSeedPoint(guidePreferredPoint, barrierMask, 24, bootstrapGuideMask));
                pushCandidate(findNearestNonBarrierPoint(guidePreferredPoint, barrierMask, 32, bootstrapGuideMask));
                if (
                    selectedRegion.seed
                    && selectedRegion.seed.x >= 0
                    && selectedRegion.seed.y >= 0
                    && selectedRegion.seed.x < MASK_WIDTH
                    && selectedRegion.seed.y < MASK_HEIGHT
                    && bootstrapGuideMask[(selectedRegion.seed.y * MASK_WIDTH) + selectedRegion.seed.x] !== 0
                    && barrierMask[(selectedRegion.seed.y * MASK_WIDTH) + selectedRegion.seed.x] === 0
                ) {
                    pushCandidate(selectedRegion.seed);
                    pushLocalInteriorCandidates(selectedRegion.seed, 12);
                }
            }
            return candidates;
        })();
        const seedEvaluations: Array<{
            point: MaskPoint;
            method: string | null;
            pixelCount: number;
            fitness: number;
        }> = [];

        let bestPoint = point;
        let selection = buildMagicSelection(point, selectedRegion.id);
        let bestSelectionFitness = describeSelectionFitness(selection);
        let bestDistanceSquaredToClicked = ((bestPoint.x - clickedPoint.x) * (bestPoint.x - clickedPoint.x))
            + ((bestPoint.y - clickedPoint.y) * (bestPoint.y - clickedPoint.y));
        seedEvaluations.push({
            point,
            method: selection?.method ?? null,
            pixelCount: selection?.pixelCount ?? 0,
            fitness: Number(bestSelectionFitness.fitness.toFixed(4)),
        });
        for (const candidatePoint of seedCandidates) {
            if (candidatePoint.x === bestPoint.x && candidatePoint.y === bestPoint.y) {
                continue;
            }
            const candidateSelection = buildMagicSelection(candidatePoint, selectedRegion.id);
            const candidateSelectionFitness = describeSelectionFitness(candidateSelection);
            seedEvaluations.push({
                point: candidatePoint,
                method: candidateSelection?.method ?? null,
                pixelCount: candidateSelection?.pixelCount ?? 0,
                fitness: Number(candidateSelectionFitness.fitness.toFixed(4)),
            });
            const candidateDistanceSquaredToClicked = ((candidatePoint.x - clickedPoint.x) * (candidatePoint.x - clickedPoint.x))
                + ((candidatePoint.y - clickedPoint.y) * (candidatePoint.y - clickedPoint.y));
            const candidateClearlyBetter = candidateSelectionFitness.fitness > bestSelectionFitness.fitness + fitnessTieMargin;
            const candidateWithinTieMargin = Math.abs(candidateSelectionFitness.fitness - bestSelectionFitness.fitness) <= fitnessTieMargin;
            const candidateCloserToClick = candidateDistanceSquaredToClicked < bestDistanceSquaredToClicked;
            if (candidateClearlyBetter || (candidateWithinTieMargin && candidateCloserToClick)) {
                bestSelectionFitness = candidateSelectionFitness;
                bestPoint = candidatePoint;
                bestDistanceSquaredToClicked = candidateDistanceSquaredToClicked;
                selection = candidateSelection;
            }
        }
        (window as typeof window & { __QIDAHEN_REGION_DEBUG__?: unknown }).__QIDAHEN_REGION_DEBUG__ = {
            kind: 'main-click',
            point: bestPoint,
            selectedRegionId: selectedRegion.id,
            chosenMethod: selection?.method ?? null,
            chosenPixelCount: selection?.pixelCount ?? 0,
            chosenFitness: Number(bestSelectionFitness.fitness.toFixed(4)),
            seedEvaluations,
            selection: selection?.debug ?? null,
        };
        (window as typeof window & { __QIDAHEN_REGION_MAIN_CLICK_DEBUG__?: unknown }).__QIDAHEN_REGION_MAIN_CLICK_DEBUG__ = {
            point: bestPoint,
            selectedRegionId: selectedRegion.id,
            chosenMethod: selection?.method ?? null,
            chosenPixelCount: selection?.pixelCount ?? 0,
            chosenFitness: Number(bestSelectionFitness.fitness.toFixed(4)),
            seedEvaluations,
            selection: selection?.debug ?? null,
        };
        const boundedSelectionMask = selection?.mask ?? new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
        const pixelCount = selection?.pixelCount ?? 0;
        if (pixelCount === 0) {
            setStatusMessage('没有找到连续区域。换一个区域内部空白点，或打开边界调试检查边界是否闭合。');
            return;
        }
        if (!isMagicSelectionUsable(pixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO)) {
            setStatusMessage(`选区疑似漏边：${pixelCount.toLocaleString()} px，已拒绝写入。请加粗边界或打开边界调试检查未闭合边界。`);
            return;
        }

        replaceRegionWithSelection({
            assignments: assignmentsRef.current,
            selectionMask: boundedSelectionMask,
            regionIndex: selectedRegionIndex,
        });
        setRegions((current) =>
            current.map((region) => (
                region.id === selectedRegion.id
                    ? { ...region, seed: { x: bestPoint.x, y: bestPoint.y } }
                    : region
            )),
        );
        renderAssignments();
        markAssignmentsChanged();
        const methodLabel = selection?.method === 'radial'
            ? '边界环'
            : selection?.method === 'truth-guide'
                ? '显式 guide 真相'
            : selection?.method === 'shape-outline'
                ? '形状轮廓'
            : selection?.method === 'shape-barrier'
                ? '形状约束停线'
            : selection?.method === 'shape-color'
                ? '形状约束颜色停线'
            : selection?.method === 'guide-local-color'
                ? '局部护栏内颜色停线'
            : selection?.method === 'guide-boundary-interior'
                ? '局部护栏内外裁 inside'
            : selection?.method === 'radial-color'
                ? '边界环内颜色停线'
            : selection?.method === 'radial-ring'
                ? '边界环贴边扩张'
            : selection?.method === 'radial-barrier'
                    ? '边界环内边界抠区'
                    : '颜色停线';
        const guideNote = selection?.guideRejected ? ' · 粗轮廓与当前 seed 不一致，已自动禁用' : '';
        setStatusMessage(`已替换 ${selectedRegion.name} · seed ${bestPoint.x}, ${bestPoint.y} · 选区 ${pixelCount.toLocaleString()} px · ${methodLabel}${guideNote}`);
    }, [authoritativeBootstrapGuideMasks, authoritativeTruthMasks, buildMagicSelection, markAssignmentsChanged, renderAssignments, selectedRegion, selectedRegionIndex]);

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (mode === 'path') {
            return;
        }
        if (mode === 'wand') {
            handleMagicFill(event.clientX, event.clientY);
            return;
        }

        const point = mapClientPointToCanvas(event.currentTarget, event.clientX, event.clientY);
        drawingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);

        if (mode === 'chain') {
            const operation = event.shiftKey ? 'subtract' : chainOperation;
            chainOperationRef.current = operation;
            const snappedPoint = snapChainPointToBarrier(point);
            chainPointsRef.current = [snappedPoint];
            setChainPreviewPoints([snappedPoint]);
            const operationLabel = operation === 'subtract' ? '减去' : '加入';
            setStatusMessage(`锁链开始：已吸附到最近边界，沿边界拖动，松开后${operationLabel}一段局部边缘。Shift 临时减去。`);
            return;
        }

        if (mode === 'barrier') {
            if (barrierEditMode === 'bridge') {
                chainPointsRef.current = [point];
                setChainPreviewPoints([point]);
                const operationLabel = barrierHintOperation === 'add' ? '补边桥接' : '去噪桥接';
                setStatusMessage(`${operationLabel} 开始：拖一笔把窄缝补上，松开后重算最终停线。`);
                return;
            }
            applyBarrierHintAtPointer(event.clientX, event.clientY);
            return;
        }

        applyBrushAtPointer(event.clientX, event.clientY);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current || mode === 'wand' || mode === 'path') {
            return;
        }
        if (mode === 'chain') {
            const point = snapChainPointToBarrier(mapClientPointToCanvas(event.currentTarget, event.clientX, event.clientY));
            const last = chainPointsRef.current.at(-1);
            if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 4) {
                chainPointsRef.current.push(point);
                setChainPreviewPoints([...chainPointsRef.current]);
            }
            const operationLabel = chainOperationRef.current === 'subtract' ? '减去' : '加入';
            setStatusMessage(`锁链记录 ${chainPointsRef.current.length} 点，松开后${operationLabel}；区域必须仍为一个连续块。`);
            return;
        }
        if (mode === 'barrier') {
            if (barrierEditMode === 'bridge') {
                const currentPoint = mapClientPointToCanvas(event.currentTarget, event.clientX, event.clientY);
                const startPoint = chainPointsRef.current[0] ?? currentPoint;
                chainPointsRef.current = [startPoint, currentPoint];
                setChainPreviewPoints([startPoint, currentPoint]);
                const operationLabel = barrierHintOperation === 'add' ? '补边桥接' : '去噪桥接';
                setStatusMessage(`${operationLabel} 预览中：松开后把这一段写进边界提示层。`);
                return;
            }
            applyBarrierHintAtPointer(event.clientX, event.clientY);
            return;
        }
        applyBrushAtPointer(event.clientX, event.clientY);
    };

    const stopDrawing = () => {
        if (!drawingRef.current) {
            return;
        }
        if (mode === 'chain') {
            applyChainSelection(chainPointsRef.current);
            chainPointsRef.current = [];
            setChainPreviewPoints([]);
        }
        if (mode === 'barrier' && barrierEditMode === 'bridge') {
            applyBarrierHintStroke(chainPointsRef.current);
            chainPointsRef.current = [];
            setChainPreviewPoints([]);
        }
        drawingRef.current = false;
        renderAssignments();
    };

    const clearMask = () => {
        assignmentsRef.current.fill(EMPTY_REGION);
        renderAssignments();
        markAssignmentsChanged();
        setPassages([]);
        setStatusMessage('已清空当前 mask。');
    };

    const clearBarrierHints = () => {
        manualBarrierAddRef.current.fill(0);
        manualBarrierRemoveRef.current.fill(0);
        rebuildBarrierMask();
        setStatusMessage('已清空手工边界修正；当前停线回到边界图本体。');
    };

    const generateBoundaryDraftFromColors = () => {
        if (!sourcePixelsRef.current) {
            setStatusMessage('地图像素还没加载完成，不能生成边界图。');
            return;
        }
        const activeRules = boundaryPresets
            .filter((preset) => preset.enabled)
            .map((preset) => ({
                id: preset.id,
                rgb: preset.rgb,
                tolerance: boundaryTolerance,
                enabled: true,
            }));
        if (activeRules.length === 0) {
            setStatusMessage('没有启用任何边界颜色，不能生成边界图。');
            return;
        }
        const nextBoundaryMask = buildBarrierMask({
            source: sourcePixelsRef.current,
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            rules: activeRules,
            expansion: boundaryExpansion,
            minComponentPixels: DEFAULT_BOUNDARY_COMPONENT_MIN_PIXELS,
            blurRadius: HEURISTIC_BARRIER_BLUR_RADIUS,
            lineFilter: HEURISTIC_BARRIER_LINE_FILTER,
        });
        boundaryDraftMaskRef.current = nextBoundaryMask;
        manualBarrierAddRef.current.fill(0);
        manualBarrierRemoveRef.current.fill(0);
        setPaintedBoundaryOnly(true);
        setShowBarrier(true);
        rebuildBarrierMask();
        setStatusMessage(`已从当前边界颜色生成可编辑边界图：${countMaskPixels(nextBoundaryMask).toLocaleString()} px。下一步先微调这张边界图，再按边界图生成区域。`);
    };

    const bakeCurrentBoundaryDraft = () => {
        const currentBoundaryMask = barrierMaskRef.current;
        if (!currentBoundaryMask || countMaskPixels(currentBoundaryMask) === 0) {
            setStatusMessage('当前没有可固化的边界图。');
            return;
        }
        boundaryDraftMaskRef.current = currentBoundaryMask.slice();
        manualBarrierAddRef.current.fill(0);
        manualBarrierRemoveRef.current.fill(0);
        rebuildBarrierMask();
        setStatusMessage(`已把当前最终停线固化为边界图：${countMaskPixels(currentBoundaryMask).toLocaleString()} px，手工补边/去噪层已清空。`);
    };

    const clearBoundaryDraft = () => {
        boundaryDraftMaskRef.current = null;
        manualBarrierAddRef.current.fill(0);
        manualBarrierRemoveRef.current.fill(0);
        rebuildBarrierMask();
        setStatusMessage('已清空边界图和手工修正；可重新从边界颜色生成。');
    };

    const exportBoundaryDraft = () => {
        const currentBoundaryMask = barrierMaskRef.current ?? boundaryDraftMaskRef.current;
        if (!currentBoundaryMask || countMaskPixels(currentBoundaryMask) === 0) {
            setStatusMessage('当前没有可导出的边界图。');
            return;
        }
        const link = document.createElement('a');
        link.href = buildMaskDataUrl(currentBoundaryMask);
        link.download = 'qidahen-boundary-mask.png';
        link.click();
        setStatusMessage(`已导出当前最终边界图：${countMaskPixels(currentBoundaryMask).toLocaleString()} px。`);
    };

    const importBoundaryDraft = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) {
            return;
        }
        try {
            const nextBoundaryMask = await readBinaryMaskFromFile(file);
            boundaryDraftMaskRef.current = nextBoundaryMask;
            manualBarrierAddRef.current.fill(0);
            manualBarrierRemoveRef.current.fill(0);
            setPaintedBoundaryOnly(true);
            setShowBarrier(true);
            rebuildBarrierMask();
            setStatusMessage(`已导入边界图：${countMaskPixels(nextBoundaryMask).toLocaleString()} px。后续区域生成只按这张边界图停线。`);
        } catch (error: unknown) {
            setStatusMessage(`导入边界图失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    const addRegion = () => {
        const nextIndex = regions.length + 1;
        const nextId = `region-${nextIndex}`;
        const nextRegion: PainterRegion = {
            id: nextId,
            name: `区域 ${nextIndex}`,
            color: DEFAULT_REGION_COLORS[(nextIndex - 1) % DEFAULT_REGION_COLORS.length],
            seed: null,
            links: [],
        };
        setRegions((current) => [...current, nextRegion]);
        setSelectedRegionId(nextId);
    };

    const updateRegion = (regionId: string, field: 'name' | 'color', value: string) => {
        setRegions((current) =>
            current.map((region) => (region.id === regionId ? { ...region, [field]: value } : region)),
        );
    };

    const toggleAuthoritativeGuide = React.useCallback((regionId: string) => {
        if (isDiagnosticRegionId(regionId)) {
            setStatusMessage('诊断临时区域不会写入正式显式 truth；北京样本继续使用工具内 guide。');
            return;
        }
        setAuthoritativeGuideRegionIds((current) => {
            const next = current.includes(regionId)
                ? current.filter((id) => id !== regionId)
                : [...current, regionId];
            const regionName = regions.find((region) => region.id === regionId)?.name ?? regionId;
            setStatusMessage(
                next.includes(regionId)
                    ? `已把 ${regionName} 标记为显式 truth。后续魔棒主链会优先直用当前区域结果，而不是重新赌启发式停线。`
                    : `已取消 ${regionName} 的显式 truth。后续魔棒会重新回到 bootstrap + 启发式候选。`,
            );
            return next;
        });
    }, [regions]);

    const toggleBoundaryPreset = (presetId: string) => {
        setBoundaryPresets((current) =>
            current.map((preset) => (
                preset.id === presetId ? { ...preset, enabled: !preset.enabled } : preset
            )),
        );
    };

    const addBoundaryColorPreset = () => {
        let rgb: RgbColor;
        try {
            rgb = parseBoundaryColorInput(boundaryColorInput);
        } catch {
            setStatusMessage('还没有可用的边界颜色：请先输入你实际画边界使用的 #RRGGBB 或 rgb(r,g,b) 颜色。');
            return;
        }
        const presetId = `manual-color-${rgb.join('-')}`;
        setBoundaryPresets((current) => {
            if (current.some((preset) => preset.id === presetId)) {
                return current.map((preset) => (
                    preset.id === presetId
                        ? { ...preset, enabled: true }
                        : preset.id.startsWith('manual-color-')
                            ? preset
                            : { ...preset, enabled: false }
                ));
            }
            return [
                ...current.map((preset) => (
                    preset.id.startsWith('manual-color-')
                        ? preset
                        : { ...preset, enabled: false }
                )),
                {
                    id: presetId,
                    label: `指定边界 ${rgb.join(',')}`,
                    rgb,
                    enabled: true,
                },
            ];
        });
        setPaintedBoundaryOnly(true);
        setShowBarrier(true);
        setStatusMessage(`已加入指定边界颜色 rgb(${rgb.join(', ')})；当前只用这个颜色和手工补边生成初始区域。`);
    };

    const generateRegionsFromCurrentBoundary = React.useCallback(() => {
        const barrierMask = barrierMaskRef.current;
        if (!barrierMask) {
            setStatusMessage('当前还没有可用边界。请先等待地图加载，或添加/绘制边界后再生成。');
            return;
        }

        const nextAssignments = createRegionAssignments(MASK_WIDTH, MASK_HEIGHT);
        const nextSeeds = new Map<string, MaskPoint>();
        let generatedRegionCount = 0;
        let skippedRegionCount = 0;
        let leakedRegionCount = 0;
        let overlapPixelCount = 0;
        let writtenPixelCount = 0;

        for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
            const region = regions[regionIndex];
            if (!region || isDiagnosticRegionId(region.id)) {
                continue;
            }
            const fallbackSeed = getRegionShapeCenterPoint(region.name, region.seed ?? { x: Math.floor(MASK_WIDTH / 2), y: Math.floor(MASK_HEIGHT / 2) });
            const preferredSeed = region.seed ?? fallbackSeed;
            const seedPoint = findBestInteriorSeedPoint(preferredSeed, barrierMask, 18)
                ?? findNearestNonBarrierPoint(preferredSeed, barrierMask, 36)
                ?? findBestInteriorSeedPoint(fallbackSeed, barrierMask, 24)
                ?? findNearestNonBarrierPoint(fallbackSeed, barrierMask, 42);
            if (!seedPoint) {
                skippedRegionCount += 1;
                continue;
            }

            const selectionMask = floodFillContiguousArea({
                width: MASK_WIDTH,
                height: MASK_HEIGHT,
                startX: seedPoint.x,
                startY: seedPoint.y,
                barrierMask,
            });
            const pixelCount = countMaskPixels(selectionMask);
            if (!isMagicSelectionUsable(pixelCount, MASK_WIDTH * MASK_HEIGHT, MAX_MAGIC_FILL_RATIO)) {
                leakedRegionCount += 1;
                continue;
            }

            let regionWrittenPixels = 0;
            for (let index = 0; index < selectionMask.length; index += 1) {
                if (selectionMask[index] === 0) {
                    continue;
                }
                if (nextAssignments[index] !== EMPTY_REGION) {
                    overlapPixelCount += 1;
                    continue;
                }
                nextAssignments[index] = regionIndex;
                regionWrittenPixels += 1;
            }

            if (regionWrittenPixels === 0) {
                skippedRegionCount += 1;
                continue;
            }

            generatedRegionCount += 1;
            writtenPixelCount += regionWrittenPixels;
            nextSeeds.set(region.id, seedPoint);
        }

        if (generatedRegionCount === 0) {
            setStatusMessage('没有生成任何区域：边界可能还没闭合，或当前 seed 都落在边界线上。');
            return;
        }

        assignmentsRef.current = nextAssignments;
        setRegions((current) => current.map((region) => {
            const nextSeed = nextSeeds.get(region.id);
            return nextSeed ? { ...region, seed: nextSeed } : region;
        }));
        renderAssignments();
        markAssignmentsChanged();
        const leakNote = leakedRegionCount > 0 ? `；${leakedRegionCount} 个区域疑似漏边过大已跳过` : '';
        const skippedNote = skippedRegionCount > 0 ? `；${skippedRegionCount} 个区域未生成` : '';
        const overlapNote = overlapPixelCount > 0 ? `；重叠 ${overlapPixelCount.toLocaleString()} px，优先保留先生成区域` : '';
        setStatusMessage(`已按当前边界生成初始区域：${generatedRegionCount} 个，写入 ${writtenPixelCount.toLocaleString()} px${leakNote}${skippedNote}${overlapNote}。`);
    }, [markAssignmentsChanged, regions, renderAssignments]);

    const updatePassageBoundaryType = (edgeId: string, boundaryType: PassageBoundaryType) => {
        setPassages((current) =>
            current.map((passage) => (
                passage.id === edgeId ? { ...passage, boundaryType } : passage
            )),
        );
    };

    const removePassage = (edgeId: string) => {
        setPassages((current) => current.filter((passage) => passage.id !== edgeId));
    };

    const upsertPassage = (from: string, to: string) => {
        if (from === to) {
            return;
        }
        const id = normalizeEdgeId(from, to);
        setPassages((current) => (
            current.some((passage) => passage.id === id)
                ? current
                : [...current, { id, from, to, boundaryType: 'plain' }]
        ));
        const fromName = regions.find((region) => region.id === from)?.name ?? from;
        const toName = regions.find((region) => region.id === to)?.name ?? to;
        setStatusMessage(`已连接 ${fromName} ↔ ${toName}，默认边界类型为平原，可在左侧修改。`);
    };

    const mapClientPointToSvg = (clientX: number, clientY: number): MaskPoint | null => {
        const svg = graphSvgRef.current;
        if (!svg) {
            return null;
        }
        const rect = svg.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(MASK_WIDTH - 1, Math.floor(((clientX - rect.left) / rect.width) * MASK_WIDTH))),
            y: Math.max(0, Math.min(MASK_HEIGHT - 1, Math.floor(((clientY - rect.top) / rect.height) * MASK_HEIGHT))),
        };
    };

    const findNearestGraphNode = (point: MaskPoint, exceptId?: string): RegionGraphNode | null => {
        let nearest: RegionGraphNode | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const node of graphNodes) {
            if (node.id === exceptId) {
                continue;
            }
            const dx = node.x - point.x;
            const dy = node.y - point.y;
            const distance = Math.sqrt((dx * dx) + (dy * dy));
            if (distance < nearestDistance) {
                nearest = node;
                nearestDistance = distance;
            }
        }
        return nearestDistance <= 34 ? nearest : null;
    };

    const startPathDrag = (nodeId: string) => {
        const node = graphNodeMap.get(nodeId);
        if (!node) {
            return;
        }
        setPathDragStartId(nodeId);
        setPathDraftPoint({ x: node.x, y: node.y });
        setStatusMessage('从 ' + node.name + ' 拖到另一个区域中心，建立通行路径。');
    };

    const movePathDrag = (event: React.PointerEvent<SVGSVGElement>) => {
        if (!pathDragStartId) {
            return;
        }
        const point = mapClientPointToSvg(event.clientX, event.clientY);
        if (point) {
            setPathDraftPoint(point);
        }
    };

    const finishPathDrag = (event: React.PointerEvent<SVGSVGElement>) => {
        if (!pathDragStartId) {
            return;
        }
        const point = mapClientPointToSvg(event.clientX, event.clientY);
        if (point) {
            const target = findNearestGraphNode(point, pathDragStartId);
            if (target) {
                upsertPassage(pathDragStartId, target.id);
            }
        }
        setPathDragStartId(null);
        setPathDraftPoint(null);
    };

    const saveRegionData = async () => {
        renderAssignments();
        const exportableRegions = regions.filter((region) => !isDiagnosticRegionId(region.id));
        if (exportableRegions.length === 0) {
            setStatusMessage('保存失败：当前没有可导出的正式区域。');
            return;
        }
        const exportableRegionIdSet = new Set(exportableRegions.map((region) => region.id));
        const exportablePassages = passages.filter((passage) => (
            exportableRegionIdSet.has(passage.from) && exportableRegionIdSet.has(passage.to)
        ));
        const exportableGraphNodes = graphNodes.filter((node) => exportableRegionIdSet.has(node.id));
        const exportableAuthoritativeGuideRegionIds = authoritativeGuideRegionIds.filter((regionId) => exportableRegionIdSet.has(regionId));
        const exportedAssignments = buildExportAssignments({
            assignments: assignmentsRef.current,
            regions,
            exportableRegions,
        });
        const authoritativeAssignments = buildSubsetAssignments({
            assignments: assignmentsRef.current,
            regions,
            includedRegionIds: new Set(exportableAuthoritativeGuideRegionIds),
        });
        const hiddenDiagnosticRegions = regions.length - exportableRegions.length;
        const payload = {
            maskPngDataUrl: buildMaskDataUrlFromAssignments({
                assignments: exportedAssignments,
                regions: exportableRegions,
            }),
            boundaryMaskPngDataUrl: buildMaskDataUrl(boundaryDraftMaskRef.current ?? new Uint8Array(MASK_WIDTH * MASK_HEIGHT)),
            barrierHints: {
                addPngDataUrl: buildMaskDataUrl(manualBarrierAddRef.current),
                removePngDataUrl: buildMaskDataUrl(manualBarrierRemoveRef.current),
            },
            authoritativeGuides: {
                maskPngDataUrl: buildMaskDataUrlFromAssignments({
                    assignments: authoritativeAssignments,
                    regions,
                }),
                regionIds: exportableAuthoritativeGuideRegionIds,
            },
            regions: buildRegionPayload({
                regions: exportableRegions,
                passages: exportablePassages,
                boundaryPresets,
                boundaryTolerance,
                boundaryExpansion,
                regionColorTolerance,
                paintedBoundaryOnly,
            }),
            graph: buildGraphPayload(exportableRegions, exportablePassages, exportableGraphNodes),
        };

        const response = await fetch(SAVE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const detail = await response.text();
            setStatusMessage('保存失败：' + (detail || response.statusText));
            return;
        }
        const result = await response.json() as { files?: string[]; internalFiles?: string[] };
        const hiddenSuffix = (result.internalFiles?.length ?? 0) > 0 ? '（含边界修正/显式 truth 内部文件）' : '';
        const diagnosticSuffix = hiddenDiagnosticRegions > 0 ? `；已自动忽略 ${hiddenDiagnosticRegions} 个诊断临时区域` : '';
        setStatusMessage('已保存到 ' + DATA_OUTPUT_DIR + '：' + (result.files?.join(' / ') ?? 'region-mask.png / region-mask-regions.json / region-graph.json') + hiddenSuffix + diagnosticSuffix);
    };

    const importMask = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = MASK_WIDTH;
            tempCanvas.height = MASK_HEIGHT;
            const tempContext = tempCanvas.getContext('2d');
            if (!tempContext) {
                URL.revokeObjectURL(objectUrl);
                return;
            }

            tempContext.clearRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
            tempContext.drawImage(image, 0, 0, MASK_WIDTH, MASK_HEIGHT);
            const source = tempContext.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data;
            const palette = regions.map((region) => hexToRgb(region.color));
            const nextAssignments = createRegionAssignments(MASK_WIDTH, MASK_HEIGHT);
            let matchedPixels = 0;

            for (let index = 0; index < MASK_WIDTH * MASK_HEIGHT; index += 1) {
                const offset = index * 4;
                if (source[offset + 3] < 16) {
                    continue;
                }
                for (let paletteIndex = 0; paletteIndex < palette.length; paletteIndex += 1) {
                    const color = palette[paletteIndex];
                    if (source[offset] === color[0] && source[offset + 1] === color[1] && source[offset + 2] === color[2]) {
                        nextAssignments[index] = paletteIndex;
                        matchedPixels += 1;
                        break;
                    }
                }
            }

            assignmentsRef.current = nextAssignments;
            renderAssignments();
            markAssignmentsChanged();
            setStatusMessage('已导入 mask · 命中 ' + matchedPixels.toLocaleString() + ' 像素。若颜色表变过，请先把颜色调回再导入。');
            URL.revokeObjectURL(objectUrl);
        };
        image.src = objectUrl;
        event.target.value = '';
    };
    const draggingNode = pathDragStartId ? graphNodeMap.get(pathDragStartId) : null;

    return (
        <div className="h-screen overflow-hidden bg-stone-950 text-stone-100">
            <div className="mx-auto flex h-screen max-w-[1880px]">
                <aside className="flex h-screen w-[392px] shrink-0 flex-col border-r border-stone-800 bg-stone-900/92">
                    <div className="shrink-0 border-b border-stone-800 px-5 py-4">
                        <div className="flex items-center justify-between gap-3">
                            <Link to="/" className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400 transition hover:text-amber-200">
                                返回首页
                            </Link>
                            <button
                                type="button"
                                onClick={() => importInputRef.current?.click()}
                                className="inline-flex items-center gap-2 rounded-md border border-stone-700 px-3 py-1.5 text-xs font-bold text-stone-200 transition hover:border-amber-400 hover:text-amber-200"
                            >
                                <Upload size={14} />
                                导入 Mask
                            </button>
                            <input ref={importInputRef} type="file" accept="image/png" className="hidden" onChange={importMask} />
                        </div>
                        <h1 className="mt-3 text-2xl font-black text-amber-100">七大恨区域制图工具</h1>
                        <p className="mt-2 text-sm leading-6 text-stone-400">
                            魔棒只负责初选；最终停线来自启发式边界 + 手工边界修正；锁链沿已选区域边界做局部加减，区域必须保持一个连续整体。
                        </p>
                    </div>

                    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                        <section className="space-y-3">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">模式</div>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMode('wand')}
                                    className={'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ' + (mode === 'wand' ? 'border-amber-400 bg-amber-500/10 text-amber-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                >
                                    <WandSparkles size={15} />
                                    魔棒
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('chain')}
                                    className={'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ' + (mode === 'chain' ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                >
                                    <Link2 size={15} />
                                    锁链
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('paint')}
                                    className={'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ' + (mode === 'paint' ? 'border-amber-400 bg-amber-500/10 text-amber-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                >
                                    <Pencil size={15} />
                                    画笔
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('erase')}
                                    className={'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ' + (mode === 'erase' ? 'border-rose-400 bg-rose-500/10 text-rose-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                >
                                    <Eraser size={15} />
                                    擦除
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('barrier')}
                                    className={'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ' + (mode === 'barrier' ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                >
                                    <Pencil size={15} />
                                    边界修正
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('path')}
                                    className={'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ' + (mode === 'path' ? 'border-sky-400 bg-sky-500/10 text-sky-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                >
                                    <Route size={15} />
                                    路径
                                </button>
                            </div>
                            {mode === 'chain' ? (
                                <div className="grid grid-cols-3 gap-2 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-2">
                                    {([
                                        ['add', '加入'],
                                        ['subtract', '减去'],
                                    ] as const).map(([operation, label]) => (
                                        <button
                                            key={operation}
                                            type="button"
                                            onClick={() => setChainOperation(operation)}
                                            className={'rounded-md border px-2 py-1.5 text-xs font-black transition ' + (chainOperation === operation ? 'border-emerald-300 bg-emerald-400/15 text-emerald-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                    <div className="col-span-3 text-[11px] leading-5 text-stone-400">
                                        锁链是主修边工具：先看当前区域边界点，再沿边界拖一段局部链；Shift 临时减去，碎岛会拒绝。
                                    </div>
                                </div>
                            ) : null}
                            {mode === 'barrier' ? (
                                <div className="grid grid-cols-2 gap-2 rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-2">
                                    {([
                                        ['add', '补边'],
                                        ['subtract', '去噪'],
                                    ] as const).map(([operation, label]) => (
                                        <button
                                            key={operation}
                                            type="button"
                                            onClick={() => setBarrierHintOperation(operation)}
                                            className={'rounded-md border px-2 py-1.5 text-xs font-black transition ' + (barrierHintOperation === operation ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                    {([
                                        ['brush', '画笔'],
                                        ['bridge', '桥接'],
                                    ] as const).map(([editMode, label]) => (
                                        <button
                                            key={editMode}
                                            type="button"
                                            onClick={() => setBarrierEditMode(editMode)}
                                            className={'rounded-md border px-2 py-1.5 text-xs font-black transition ' + (barrierEditMode === editMode ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                    <div className="col-span-2 text-[11px] leading-5 text-stone-400">
                                        当前问题不是区域颜色，而是边界识别会把马纹、山纹、字块一起膨胀成噪声。画笔适合局部涂抹；桥接适合补一条漏掉的窄缝，让魔棒像地图工具那样真正被边界拦住。
                                    </div>
                                </div>
                            ) : null}
                            <div className="rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-3 text-xs leading-6 text-stone-400">
                                {statusMessage}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">诊断样本</div>
                            <div className="space-y-2">
                                {DIAGNOSTIC_SAMPLES.map((sample) => (
                                    <button
                                        key={sample.id}
                                        type="button"
                                        onClick={() => focusDiagnosticSample(sample)}
                                        className="w-full rounded-xl border border-stone-800 bg-stone-950/45 px-3 py-3 text-left transition hover:border-cyan-400/60 hover:bg-stone-950/70"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-bold text-stone-100">{sample.label}</div>
                                            <div className="font-mono text-[11px] text-stone-500">
                                                {sample.point.x}, {sample.point.y}
                                            </div>
                                        </div>
                                        <div className="mt-1 text-xs leading-5 text-stone-400">{sample.note}</div>
                                    </button>
                                ))}
                            </div>
                            <div className="rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-3 text-xs leading-6 text-stone-400">
                                北京不是当前正式区域列表的一部分，但它适合先验证“边界有没有停住”。这一步做不对，后面的大区域也不会对。
                            </div>
                            {diagnosticPreview ? (
                                <div className="space-y-3 rounded-xl border border-stone-800 bg-stone-950/45 p-3">
                                    <div className="text-xs font-black uppercase tracking-[0.16em] text-stone-500">局部预览</div>
                                    <div className={`grid gap-2 ${diagnosticPreview.comparisonDataUrl ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                        <div>
                                            <div className="mb-1 text-[11px] font-bold text-stone-400">原图</div>
                                            <img
                                                src={diagnosticPreview.originalDataUrl}
                                                alt="诊断原图"
                                                className="block aspect-[15/11] w-full rounded-md border border-stone-800 bg-stone-950 object-cover"
                                            />
                                        </div>
                                        <div>
                                            <div className="mb-1 text-[11px] font-bold text-stone-400">启发式边界</div>
                                            <img
                                                src={diagnosticPreview.heuristicBarrierDataUrl}
                                                alt="启发式边界"
                                                className="block aspect-[15/11] w-full rounded-md border border-stone-800 bg-black object-cover"
                                            />
                                        </div>
                                        <div>
                                            <div className="mb-1 text-[11px] font-bold text-stone-400">
                                                {diagnosticPreview.comparisonDataUrl ? '禁用 truth 后的启发式初选' : '当前魔棒填充'}
                                            </div>
                                            <img
                                                src={diagnosticPreview.fillDataUrl}
                                                alt="当前魔棒填充"
                                                className="block aspect-[15/11] w-full rounded-md border border-stone-800 bg-black object-cover"
                                            />
                                            <div className={`mt-1 text-[11px] font-bold ${diagnosticPreview.usable ? 'text-emerald-300' : 'text-rose-300'}`}>
                                                {diagnosticPreview.fillPixelCount.toLocaleString()} px · {diagnosticPreview.methodLabel}
                                            </div>
                                            {diagnosticPreview.guideRejected ? (
                                                <div className="mt-1 text-[10px] font-bold text-amber-300">
                                                    粗轮廓不包含当前 seed，已自动禁用
                                                </div>
                                            ) : null}
                                        </div>
                                        {diagnosticPreview.comparisonDataUrl ? (
                                            <div>
                                                <div className="mb-1 text-[11px] font-bold text-stone-400">与显式 truth 的差异</div>
                                                <img
                                                    src={diagnosticPreview.comparisonDataUrl}
                                                    alt="启发式与显式 truth 差异"
                                                    className="block aspect-[15/11] w-full rounded-md border border-stone-800 bg-black object-cover"
                                                />
                                                <div className="mt-1 text-[11px] font-bold text-amber-200">
                                                    {diagnosticPreview.comparisonLabel}
                                                </div>
                                                <div className="mt-1 text-[10px] leading-4 text-stone-500">
                                                    黄=重合，粉=truth 里有但启发式没到边，蓝=启发式越界。
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="text-xs leading-5 text-stone-500">
                                        先看“启发式边界”是不是仍被纹理糊成大块；如果这里都不闭合，继续调魔棒容差没有意义。
                                    </div>
                                    {diagnosticPreview.comparisonDataUrl ? (
                                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs leading-5 text-amber-100">
                                            北京这块当前主链可以直用显式 truth；上面的启发式初选和差异图才是用来判断“算法有没有到边界停止”的证据。
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-3 text-xs leading-5 text-stone-400">
                                            当前这张局部图仍是启发式 bootstrap。它只能证明初选方向，不能直接当最终区域真相。
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </section>

                        <section className="space-y-3">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">边界停线</div>
                            <label className="block text-sm text-stone-300">
                                颜色容差 {boundaryTolerance}
                                <input
                                    type="range"
                                    min="2"
                                    max="28"
                                    value={boundaryTolerance}
                                    onChange={(event) => setBoundaryTolerance(Number(event.target.value))}
                                    className="mt-2 w-full"
                                />
                            </label>
                            <label className="block text-sm text-stone-300">
                                边界加粗 {boundaryExpansion}px
                                <input
                                    type="range"
                                    min="0"
                                    max="8"
                                    value={boundaryExpansion}
                                    onChange={(event) => setBoundaryExpansion(Number(event.target.value))}
                                    className="mt-2 w-full"
                                />
                            </label>
                            <label className="block text-sm text-stone-300">
                                区域底色容差 {regionColorTolerance}（魔棒使用种子色相近区域 + 边界停线；必要时再用锁链修边）
                                <input
                                    type="range"
                                    min="8"
                                    max="64"
                                    value={regionColorTolerance}
                                    onChange={(event) => setRegionColorTolerance(Number(event.target.value))}
                                    className="mt-2 w-full"
                                />
                            </label>
                            <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-3">
                                <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">边界图工作流</div>
                                <div className="mt-3 flex items-center gap-2">
                                    <input
                                        value={boundaryColorInput}
                                        onChange={(event) => setBoundaryColorInput(event.target.value)}
                                        className="min-w-0 flex-1 rounded-md border border-stone-700 bg-stone-950 px-2 py-2 font-mono text-xs text-stone-100 outline-none transition focus:border-cyan-300"
                                        placeholder="输入你画边界用的颜色，例如 rgb(61,69,66)"
                                        aria-label="指定边界颜色"
                                    />
                                    <button
                                        type="button"
                                        onClick={addBoundaryColorPreset}
                                        data-testid="qidahen-add-boundary-color"
                                        className="shrink-0 rounded-md border border-cyan-600 px-3 py-2 text-xs font-black text-cyan-100 transition hover:border-cyan-300"
                                    >
                                        加入
                                    </button>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={generateBoundaryDraftFromColors}
                                        data-testid="qidahen-generate-boundary-draft"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan-500/70 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:border-cyan-300"
                                    >
                                        <WandSparkles size={14} />
                                        生成边界图
                                    </button>
                                    <button
                                        type="button"
                                        onClick={bakeCurrentBoundaryDraft}
                                        data-testid="qidahen-bake-boundary-draft"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-500/70 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100 transition hover:border-amber-300"
                                    >
                                        <Save size={14} />
                                        固化微调
                                    </button>
                                    <button
                                        type="button"
                                        onClick={exportBoundaryDraft}
                                        data-testid="qidahen-export-boundary-draft"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-700 px-3 py-2 text-xs font-black text-stone-200 transition hover:border-stone-500"
                                    >
                                        <Upload size={14} className="rotate-180" />
                                        导出边界图
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => boundaryMaskInputRef.current?.click()}
                                        data-testid="qidahen-import-boundary-draft"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-700 px-3 py-2 text-xs font-black text-stone-200 transition hover:border-stone-500"
                                    >
                                        <Upload size={14} />
                                        导入边界图
                                    </button>
                                </div>
                                <input ref={boundaryMaskInputRef} type="file" accept="image/png" className="hidden" onChange={importBoundaryDraft} />
                                <button
                                    type="button"
                                    onClick={generateRegionsFromCurrentBoundary}
                                    data-testid="qidahen-generate-regions-from-boundary"
                                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-500/70 bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-100 transition hover:border-emerald-300"
                                >
                                    <WandSparkles size={15} />
                                    按边界图生成初始区域
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaintedBoundaryOnly((current) => !current)}
                                    data-testid="qidahen-painted-boundary-only-toggle"
                                    className={'mt-2 inline-flex w-full items-center justify-center rounded-md border px-3 py-2 text-xs font-black transition ' + (paintedBoundaryOnly ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                >
                                    {paintedBoundaryOnly ? '当前：只用边界颜色/手工补边' : '当前：原图启发式 + 边界颜色'}
                                </button>
                                <div className="mt-2 text-[11px] leading-5 text-stone-400">
                                    正确流程：先从实画颜色生成独立边界图，微调/导入/导出这张图，再按边界图生成区域。断开的零散色块不强行补，后续继续手修。
                                </div>
                            </div>
                            <div className="rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-3 text-xs leading-6 text-stone-400">
                                <div>
                                    当前边界图像素：<span className="font-mono text-cyan-200">{boundaryDraftPixelCount.toLocaleString()}</span>
                                </div>
                                <div>
                                    当前最终障碍像素：<span className="font-mono text-stone-200">{barrierPixelCount.toLocaleString()}</span>
                                </div>
                                <div>
                                    手工补边：<span className="font-mono text-emerald-200">{manualBarrierAddCount.toLocaleString()}</span>
                                    <span className="mx-2 text-stone-600">/</span>
                                    去噪：<span className="font-mono text-fuchsia-200">{manualBarrierRemoveCount.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {boundaryPresets.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => toggleBoundaryPreset(preset.id)}
                                        className={'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ' + (preset.enabled ? 'border-stone-700 bg-stone-950/50 text-stone-100' : 'border-stone-800 bg-stone-950/20 text-stone-500')}
                                    >
                                        <span
                                            className="h-8 w-8 shrink-0 rounded-md border border-white/10"
                                            style={{ backgroundColor: 'rgb(' + preset.rgb[0] + ', ' + preset.rgb[1] + ', ' + preset.rgb[2] + ')' }}
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-bold">{preset.label}</span>
                                            <span className="block text-xs text-stone-500">rgb({preset.rgb.join(', ')})</span>
                                        </span>
                                        {preset.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">手修与视图</div>
                            <label className="block text-sm text-stone-300">
                                修边半径 {brushSize}px
                                <input
                                    type="range"
                                    min="2"
                                    max="48"
                                    value={brushSize}
                                    onChange={(event) => setBrushSize(Number(event.target.value))}
                                    className="mt-2 w-full"
                                />
                            </label>
                            <label className="block text-sm text-stone-300">
                                显示比例 {(displayScale).toFixed(2)}x
                                <input
                                    type="range"
                                    min="0.75"
                                    max="1.8"
                                    step="0.05"
                                    value={zoom}
                                    onChange={(event) => setZoom(Number(event.target.value))}
                                    className="mt-2 w-full"
                                />
                            </label>
                            <label className="block text-sm text-stone-300">
                                Mask 透明度 {maskOpacity.toFixed(2)}
                                <input
                                    type="range"
                                    min="0.1"
                                    max="0.9"
                                    step="0.02"
                                    value={maskOpacity}
                                    onChange={(event) => setMaskOpacity(Number(event.target.value))}
                                    className="mt-2 w-full"
                                />
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowMask((current) => !current)}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-stone-700 px-3 py-2 text-sm font-bold text-stone-200 transition hover:border-stone-500"
                                >
                                    {showMask ? <Eye size={15} /> : <EyeOff size={15} />}
                                    {showMask ? '隐藏 Mask' : '显示 Mask'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowBarrier((current) => !current)}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-sky-500/40 px-3 py-2 text-sm font-bold text-sky-100 transition hover:border-sky-300"
                                >
                                    {showBarrier ? <Eye size={15} /> : <EyeOff size={15} />}
                                    {showBarrier ? '隐藏边界' : '边界调试'}
                                </button>
                            </div>
                            <div className="text-xs leading-5 text-stone-500">
                                青色是边界图本体，绿色是手工补边，洋红是手工去噪；最终保存会把边界图和微调层一并落到数据目录。
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={clearMask}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-stone-700 px-3 py-2 text-sm font-bold text-stone-200 transition hover:border-rose-400 hover:text-rose-200"
                                >
                                    <RotateCcw size={15} />
                                    清空
                                </button>
                                <button
                                    type="button"
                                    onClick={clearBoundaryDraft}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-cyan-700/70 px-3 py-2 text-sm font-bold text-cyan-100 transition hover:border-cyan-300"
                                >
                                    <RotateCcw size={15} />
                                    清空边界图
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={clearBarrierHints}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-stone-700 px-3 py-2 text-sm font-bold text-stone-200 transition hover:border-stone-500"
                            >
                                <RotateCcw size={15} />
                                清空微调层
                            </button>
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">区域</div>
                                <button
                                    type="button"
                                    onClick={addRegion}
                                    className="inline-flex items-center gap-1 rounded-md border border-stone-700 px-2 py-1 text-xs font-bold text-stone-200 transition hover:border-amber-400 hover:text-amber-200"
                                    >
                                        <Plus size={13} />
                                        新增
                                </button>
                            </div>
                            <div className="space-y-2">
                                {regions.map((region) => {
                                    const selected = region.id === selectedRegionId;
                                    const duplicated = duplicateColorSet.has(region.color.toLowerCase());
                                    const passageCount = passages.filter((passage) => passage.from === region.id || passage.to === region.id).length;
                                    const diagnostic = isDiagnosticRegionId(region.id);
                                    return (
                                        <button
                                            key={region.id}
                                            type="button"
                                            onClick={() => setSelectedRegionId(region.id)}
                                            data-testid={`qidahen-region-card-${region.id}`}
                                            className={'w-full rounded-xl border p-3 text-left transition ' + (selected ? 'border-amber-400 bg-amber-500/10' : 'border-stone-700 bg-stone-950/50 hover:border-stone-500')}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={region.color}
                                                    onChange={(event) => updateRegion(region.id, 'color', event.target.value)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    className="h-9 w-10 cursor-pointer rounded border border-stone-700 bg-transparent"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <input
                                                        value={region.name}
                                                        onChange={(event) => updateRegion(region.id, 'name', event.target.value)}
                                                        onClick={(event) => event.stopPropagation()}
                                                        className="w-full bg-transparent text-sm font-bold text-stone-100 outline-none"
                                                    />
                                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                                                        <span className="font-mono">{region.id}</span>
                                                        <span>seed {formatSeed(region.seed)}</span>
                                                        <span>路径 {passageCount}</span>
                                                        {diagnostic ? <span className="text-cyan-300">诊断区，不导出</span> : null}
                                                        {duplicated ? <span className="text-rose-300">颜色重复</span> : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {selectedRegion ? (
                            <section className="space-y-3">
                                <div className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">当前区域细节</div>
                                <div className="rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-3 text-xs leading-6 text-stone-400">
                                    <div>
                                        <span className="text-stone-500">类型：</span>
                                        <span className={isDiagnosticRegionId(selectedRegion.id) ? 'font-bold text-cyan-200' : 'font-bold text-stone-200'}>
                                            {isDiagnosticRegionId(selectedRegion.id) ? '诊断临时区域（仅 devtools）' : '正式区域'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-stone-500">区域：</span>
                                        <span className="font-bold text-stone-100">{selectedRegion.name}</span>
                                    </div>
                                    <div>
                                        <span className="text-stone-500">seed：</span>
                                        <span className="font-mono text-stone-200">{formatSeed(selectedRegion.seed)}</span>
                                    </div>
                                    <div>
                                        <span className="text-stone-500">用途：</span>
                                        <span>
                                            {isDiagnosticRegionId(selectedRegion.id)
                                                ? '只服务样本 bootstrap、魔棒和锁链修边；保存时会自动从正式 mask/graph 导出中排除。'
                                                : 'mask 负责点击和高亮；通行路径图只表达规则连通关系。'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-stone-500">真相级别：</span>
                                        <span className="font-bold text-stone-200">
                                            {isDiagnosticRegionId(selectedRegion.id)
                                                ? '诊断样本。可用于验证方向，但不能替代正式区域真相。'
                                                : authoritativeGuideRegionIdSet.has(selectedRegion.id)
                                                    ? '显式 truth。主链直接消费当前区域结果。'
                                                    : '启发式 bootstrap。需要继续锁链微调或升格为显式 truth。'}
                                        </span>
                                    </div>
                                    {!isDiagnosticRegionId(selectedRegion.id) ? (
                                        <div className="mt-2">
                                            <button
                                                type="button"
                                                onClick={() => toggleAuthoritativeGuide(selectedRegion.id)}
                                                data-testid={`qidahen-authoritative-toggle-${selectedRegion.id}`}
                                                className={'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-black transition ' + (authoritativeGuideRegionIdSet.has(selectedRegion.id) ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100' : 'border-stone-700 text-stone-300 hover:border-stone-500')}
                                            >
                                                {authoritativeGuideRegionIdSet.has(selectedRegion.id) ? '取消显式 truth' : '设为显式 truth'}
                                            </button>
                                            <div className="mt-1 text-[11px] leading-5 text-stone-500">
                                                显式 truth 会被主链直接消费，并随保存自动落到数据目录。
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-2 text-[11px] leading-5 text-stone-500">
                                            诊断临时区域不写入正式显式 truth；北京样本继续用工具内 guide 验证方向。
                                        </div>
                                    )}
                                </div>
                            </section>
                        ) : null}

                        <section className="space-y-3">
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-stone-500">
                                <Link2 size={13} />
                                通行路径图
                            </div>
                            <div className="rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-3 text-xs leading-6 text-stone-400">
                                路径模式下，从已分区区域中心拖到另一个中心建立边。边界类型按规则保存：平原 3，山脉/河流/海岸 2，攻城/攻入长城 1。
                            </div>
                            <div className="space-y-2">
                                {passages.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-stone-800 px-3 py-4 text-sm text-stone-500">
                                        暂无路径。先用魔棒得到至少两个区域，再切到路径模式拖拽连线。
                                    </div>
                                ) : passages.map((passage) => {
                                    const fromRegion = regions.find((region) => region.id === passage.from);
                                    const toRegion = regions.find((region) => region.id === passage.to);
                                    return (
                                        <div
                                            key={passage.id}
                                            data-testid={`qidahen-passage-row-${passage.id}`}
                                            className="rounded-xl border border-stone-800 bg-stone-950/50 p-3"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0 text-sm font-bold text-stone-100">
                                                    {fromRegion?.name ?? passage.from} ↔ {toRegion?.name ?? passage.to}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removePassage(passage.id)}
                                                    data-testid={`qidahen-passage-delete-${passage.id}`}
                                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-stone-700 text-stone-400 transition hover:border-rose-400 hover:text-rose-200"
                                                    aria-label="删除路径"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <select
                                                value={passage.boundaryType}
                                                onChange={(event) => updatePassageBoundaryType(passage.id, event.target.value as PassageBoundaryType)}
                                                data-testid={`qidahen-passage-boundary-${passage.id}`}
                                                className="mt-2 w-full rounded-md border border-stone-700 bg-stone-900 px-2 py-2 text-sm text-stone-100 outline-none focus:border-amber-400"
                                            >
                                                {PASSAGE_BOUNDARY_TYPES.map((boundaryType) => (
                                                    <option key={boundaryType.id} value={boundaryType.id}>
                                                        {boundaryType.label} 路 {boundaryType.note}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                    </div>

                    <div className="shrink-0 border-t border-stone-800 bg-stone-950/95 px-5 py-4">
                        <button
                            type="button"
                            onClick={saveRegionData}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-amber-400 bg-amber-500/15 px-3 text-sm font-black text-amber-100 transition hover:bg-amber-500/25 active:translate-y-px"
                        >
                            <Save size={16} />
                            保存区域数据
                        </button>
                        <div className="mt-2 text-xs leading-5 text-stone-500">
                            自动写入 {DATA_OUTPUT_DIR}，包含 mask、区域定义和链接图。
                        </div>
                    </div>
                </aside>

                <main className="flex h-screen min-w-0 flex-1 flex-col bg-stone-950">
                    <div className="shrink-0 border-b border-stone-800 px-6 py-4 text-sm text-stone-400">
                        当前区域：<span className="font-bold text-stone-100">{selectedRegion?.name ?? '未选择'}</span>
                        <span className="ml-3 font-mono text-xs text-stone-500">{selectedRegion?.id}</span>
                        <span className="ml-4 text-xs text-stone-500">
                            模式：{mode === 'wand' ? '魔棒' : mode === 'chain' ? '锁链' : mode === 'paint' ? '画笔' : mode === 'erase' ? '擦除' : mode === 'barrier' ? '边界修正' : '路径'}
                        </span>
                        <span className="ml-4 text-xs text-stone-500">
                            路径：{passages.length}
                        </span>
                    </div>
                    <div ref={viewportRef} className="grid min-h-0 flex-1 place-items-center overflow-auto px-4 py-4">
                        <div
                            className="relative"
                            style={{
                                width: Math.round(MASK_WIDTH * displayScale),
                                height: Math.round(MASK_HEIGHT * displayScale),
                            }}
                        >
                            <canvas
                                ref={bgCanvasRef}
                                width={MASK_WIDTH}
                                height={MASK_HEIGHT}
                                className="absolute inset-0 block h-full w-full rounded-md border border-stone-800"
                            />
                            <canvas
                                ref={maskCanvasRef}
                                width={MASK_WIDTH}
                                height={MASK_HEIGHT}
                                className="absolute inset-0 block h-full w-full rounded-md"
                                aria-hidden="true"
                            />
                            <canvas
                                ref={outlineCanvasRef}
                                width={MASK_WIDTH}
                                height={MASK_HEIGHT}
                                className="pointer-events-none absolute inset-0 block h-full w-full rounded-md"
                                aria-hidden="true"
                            />
                            <canvas
                                ref={barrierCanvasRef}
                                width={MASK_WIDTH}
                                height={MASK_HEIGHT}
                                className="pointer-events-none absolute inset-0 block h-full w-full rounded-md mix-blend-screen"
                                aria-hidden="true"
                            />
                            <canvas
                                width={MASK_WIDTH}
                                height={MASK_HEIGHT}
                                data-testid="qidahen-region-canvas"
                                className={`absolute inset-0 block h-full w-full touch-none rounded-md ${mode === 'path' ? 'pointer-events-none' : ''}`}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={stopDrawing}
                                onPointerLeave={stopDrawing}
                                onPointerCancel={stopDrawing}
                            />
                            <svg
                                ref={graphSvgRef}
                                viewBox={`0 0 ${MASK_WIDTH} ${MASK_HEIGHT}`}
                                data-testid="qidahen-region-graph"
                                className={`absolute inset-0 block h-full w-full rounded-md ${mode === 'path' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                                onPointerMove={movePathDrag}
                                onPointerUp={finishPathDrag}
                                onPointerCancel={() => {
                                    setPathDragStartId(null);
                                    setPathDraftPoint(null);
                                }}
                                aria-label="通行路径图"
                            >
                                {mode === 'chain' && boundaryControlPoints.length > 0 ? (
                                    <g className="pointer-events-none" data-testid="qidahen-region-chain-boundary">
                                        {boundaryControlPoints.map((point, index) => (
                                            <circle
                                                key={`${point.x}-${point.y}-${index}`}
                                                cx={point.x}
                                                cy={point.y}
                                                r="2.1"
                                                fill="#fff1cb"
                                                opacity="0.88"
                                                stroke="#2a1b10"
                                                strokeWidth="1"
                                            />
                                        ))}
                                    </g>
                                ) : null}
                                {(mode === 'chain' || (mode === 'barrier' && barrierEditMode === 'bridge')) && chainPreviewPoints.length > 1 ? (
                                    <g className="pointer-events-none">
                                        <polyline
                                            points={chainPreviewPoints.map((point) => point.x + ',' + point.y).join(' ')}
                                            fill="none"
                                            stroke={mode === 'chain'
                                                ? (chainOperation === 'subtract' ? '#fb7185' : '#6ee7b7')
                                                : (barrierHintOperation === 'subtract' ? '#fb7185' : '#6ee7b7')}
                                            strokeWidth={Math.max(6, brushSize * 2)}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            opacity="0.62"
                                        />
                                        <polyline
                                            points={chainPreviewPoints.map((point) => point.x + ',' + point.y).join(' ')}
                                            fill="none"
                                            stroke="#fff7da"
                                            strokeWidth={2}
                                            strokeDasharray="9 7"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </g>
                                ) : null}
                                {mode === 'path' ? passages.map((passage) => {
                                    const from = graphNodeMap.get(passage.from);
                                    const to = graphNodeMap.get(passage.to);
                                    if (!from || !to) {
                                        return null;
                                    }
                                    const boundaryType = getBoundaryTypeMeta(passage.boundaryType);
                                    const midX = (from.x + to.x) / 2;
                                    const midY = (from.y + to.y) / 2;
                                    return (
                                        <g key={passage.id} data-testid={`qidahen-passage-edge-${passage.id}`}>
                                            <line
                                                x1={from.x}
                                                y1={from.y}
                                                x2={to.x}
                                                y2={to.y}
                                                stroke={boundaryType.color}
                                                strokeWidth={6}
                                                strokeLinecap="round"
                                                opacity="0.9"
                                            />
                                            <line
                                                x1={from.x}
                                                y1={from.y}
                                                x2={to.x}
                                                y2={to.y}
                                                stroke="#1b130d"
                                                strokeWidth={2}
                                                strokeDasharray={passage.boundaryType === 'coast' ? '8 8' : undefined}
                                                strokeLinecap="round"
                                                opacity="0.75"
                                            />
                                            <g transform={`translate(${midX} ${midY})`}>
                                                <rect x="-34" y="-12" width="68" height="24" rx="4" fill="rgba(20,14,10,0.82)" stroke={boundaryType.color} strokeWidth="1.5" />
                                                <text textAnchor="middle" dominantBaseline="middle" fill="#fff4d6" fontSize="12" fontWeight="800">
                                                    {boundaryType.label}
                                                </text>
                                            </g>
                                        </g>
                                    );
                                }) : null}
                                {mode === 'path' && draggingNode && pathDraftPoint ? (
                                    <line
                                        x1={draggingNode.x}
                                        y1={draggingNode.y}
                                        x2={pathDraftPoint.x}
                                        y2={pathDraftPoint.y}
                                        stroke="#f8d27a"
                                        strokeWidth={4}
                                        strokeDasharray="10 7"
                                        strokeLinecap="round"
                                        opacity="0.9"
                                    />
                                ) : null}
                                {mode === 'path' ? graphNodes.map((node) => (
                                    <g
                                        key={node.id}
                                        data-testid={`qidahen-region-graph-node-${node.id}`}
                                        className={mode === 'path' ? 'pointer-events-auto' : 'pointer-events-none'}
                                        transform={`translate(${node.x} ${node.y})`}
                                        onPointerDown={(event) => {
                                            if (mode !== 'path') {
                                                return;
                                            }
                                            event.preventDefault();
                                            startPathDrag(node.id);
                                        }}
                                    >
                                        <circle r="13" fill="rgba(20,14,10,0.86)" stroke={node.color} strokeWidth="4" />
                                        <circle r="5" fill={node.color} stroke="#fff4d6" strokeWidth="1.5" />
                                        {mode === 'path' ? (
                                            <text y="-18" textAnchor="middle" fill="#fff4d6" fontSize="12" fontWeight="900" paintOrder="stroke" stroke="#1b130d" strokeWidth="4">
                                                {node.name}
                                            </text>
                                        ) : null}
                                    </g>
                                )) : null}
                            </svg>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default QidahenRegionMaskTool;
