import React from 'react';
import type { CardPreviewRef } from '../../core/types';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { CardPreview } from '../../components/common/media/CardPreview';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { getCardAtlasSource } from '../../components/common/media/cardAtlasRegistry';
import { getLocalizedAssetPath, getOptimizedImageUrls } from '../../core/AssetLoader';
import type { SpriteAtlasConfig, SpriteAtlasFrame } from '../../engine/primitives/spriteAtlas';
import type {
    QidahenActionChoice,
    QidahenCasualtyPriority,
    QidahenCommandMap,
    QidahenCore,
    QidahenFactionId,
    QidahenHandCard,
    QidahenMapToken,
    QidahenPlunderSource,
    QidahenRecruitChoice,
    QidahenWheelMoveChoice,
    QidahenYearCardSlot,
} from './domain';
import {
    findQidahenReachableRuntimeRegions,
    getQidahenEffectiveVpByFaction,
    getQidahenMovementProfile,
    getQidahenPrestigeBonusByFaction,
} from './domain';
import { QIDAHEN_COMMANDS } from './domain/commands';
import { getQidahenRuleRegionTags } from './domain/regionConfig';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from './ui/mapRegions';
import {
    getQidahenDirectedPassage,
    QIDAHEN_REGION_GRAPH_EDGES,
    QIDAHEN_REGION_GRAPH_NODE_BY_ID,
    QIDAHEN_REGION_ID_BY_MASK_COLOR,
    getQidahenBoundaryTypeMeta,
    qidahenRegionColorKey,
} from './ui/mapGraph';
import qidahenRegionMaskUrl from './data/region-mask.png?url';

type Props = GameBoardProps<QidahenCore, QidahenCommandMap>;

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

const ASSETS = {
    mainMap: 'qidahen/board/qidahen-main-map',
    coverCard: 'qidahen/cards/backs/qidahen-cover-card',
    koreaCard: 'qidahen/cards/backs/korea-card-back',
    mingCard: 'qidahen/cards/backs/ming-card-back',
    mongolCard: 'qidahen/cards/backs/mongol-card-back',
    jinCard: 'qidahen/cards/backs/jin-card-back',
    mingMarker: 'qidahen/markers/ming-control-diplomacy-marker-a',
    mongolMarker: 'qidahen/markers/mongol-control-diplomacy-marker-a',
    jinMarker: 'qidahen/markers/jin-control-diplomacy-marker-a',
} as const;

const MAP_COVER_SCALE = Math.max(STAGE_WIDTH / QIDAHEN_MAP_WIDTH, STAGE_HEIGHT / QIDAHEN_MAP_HEIGHT);
const MAP_COVER_LEFT = (STAGE_WIDTH - QIDAHEN_MAP_WIDTH * MAP_COVER_SCALE) / 2;
const MAP_COVER_TOP = (STAGE_HEIGHT - QIDAHEN_MAP_HEIGHT * MAP_COVER_SCALE) / 2;
const QIDAHEN_FACTION_ORDER: QidahenFactionId[] = ['ming', 'mongol', 'jin'];

const CARD_BACK_BY_FACTION: Record<QidahenFactionId, string> = {
    ming: ASSETS.mingCard,
    mongol: ASSETS.mongolCard,
    jin: ASSETS.jinCard,
};

const WHEEL_SECTORS = [
    { id: 'wheel-reclaim', label: ['开垦', '军屯'], angle: -90 },
    { id: 'wheel-military-farm', label: ['开垦', '军屯'], angle: -45 },
    { id: 'wheel-recruit-train', label: ['征兵', '训练'], angle: 0 },
    { id: 'wheel-diplomacy', label: ['进攻', '调度'], angle: 45 },
    { id: 'wheel-hire', label: ['进攻', '调度'], angle: 90 },
    { id: 'wheel-attack', label: ['外交', '雇佣'], angle: 135 },
    { id: 'wheel-midyear', label: ['征兵', '训练'], angle: 180 },
    { id: 'wheel-new-year', label: ['外交', '雇佣'], angle: 225 },
] as const;

const WHEEL_VIEW = 384;
const WHEEL_CENTER = WHEEL_VIEW / 2;
const WHEEL_INNER_RADIUS = 68;
const WHEEL_OUTER_RADIUS = 188;
const WHEEL_LABEL_RADIUS = 126;

const UI_STYLE = {
    paper: '#e6d3a8',
    paperLight: '#f3e7c4',
    paperWash: 'rgba(244,233,202,0.92)',
    cardField: '#efe0ba',
    paperDeep: '#c8ae72',
    paperEdge: '#9a7d4f',
    ink: '#2a1f15',
    mutedInk: '#66503a',
    bronze: '#5f472d',
    bronzeSoft: '#a88957',
    bronzeFaint: 'rgba(95,71,45,0.34)',
    bronzeDark: '#342417',
    mapInk: '#20150d',
    mapInkSoft: 'rgba(32,21,13,0.76)',
    mapGold: '#d2b775',
    mapIvory: '#ead7a7',
    cinnabar: '#9f3426',
    cinnabarGlow: 'rgba(159,52,38,0.18)',
    oldGold: '#9f7d42',
    soot: '#1f1812',
    shadow: 'rgba(56,35,15,0.24)',
    shadowSoft: 'rgba(56,35,15,0.14)',
} as const;

const UI_SURFACE = {
    paper: [
        `linear-gradient(180deg, rgba(255,247,224,0.95) 0%, ${UI_STYLE.paperWash} 34%, rgba(224,205,158,0.96) 100%)`,
        'radial-gradient(circle at 20% 18%, rgba(255,251,240,0.48), transparent 34%)',
        'radial-gradient(circle at 82% 88%, rgba(134,100,55,0.14), transparent 42%)',
    ].join(', '),
    paperQuiet: [
        'linear-gradient(180deg, rgba(248,239,211,0.94) 0%, rgba(230,211,168,0.92) 100%)',
        'radial-gradient(circle at 18% 16%, rgba(255,250,235,0.45), transparent 34%)',
    ].join(', '),
    paperPressed: 'linear-gradient(180deg, rgba(226,205,157,0.98) 0%, rgba(194,167,110,0.98) 100%)',
    panelShadow: '0 3px 0 rgba(58,37,17,0.24), 0 14px 24px rgba(56,35,15,0.14)',
    softShadow: '0 8px 18px rgba(56,35,15,0.14)',
    hardShadow: '0 4px 0 rgba(58,37,17,0.22), 0 12px 20px rgba(58,37,17,0.18)',
    inkInset: 'inset 0 0 0 1px rgba(255,245,218,0.52), inset 0 -2px 0 rgba(77,56,32,0.12), inset 0 1px 0 rgba(93,67,39,0.08)',
    inkLine: 'inset 0 0 0 1px rgba(49,35,21,0.18)',
    mapPanel: [
        'linear-gradient(180deg, rgba(56,39,24,0.88) 0%, rgba(28,20,13,0.82) 100%)',
        'radial-gradient(circle at 16% 12%, rgba(231,197,126,0.16), transparent 36%)',
    ].join(', '),
    mapPanelSelected: [
        'linear-gradient(180deg, rgba(142,53,38,0.9) 0%, rgba(69,32,22,0.88) 100%)',
        'radial-gradient(circle at 15% 12%, rgba(238,198,127,0.18), transparent 38%)',
    ].join(', '),
    mapPanelShadow: '0 2px 0 rgba(7,5,3,0.7), 0 10px 18px rgba(22,14,8,0.32)',
    mapPanelInset: 'inset 0 0 0 1px rgba(232,200,133,0.2), inset 0 -2px 0 rgba(0,0,0,0.2)',
    cutCorner: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)',
    smallCutCorner: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)',
} as const;

const CARD_DIMENSIONS = {
    deck: { width: 154, height: 214, rawWidth: 476, rawHeight: 660 },
    koreaDeck: { width: 150, height: 208, rawWidth: 476, rawHeight: 660 },
    year: { width: 154, height: 214, rawWidth: 476, rawHeight: 661 },
    hand: { width: 182, height: 251, rawWidth: 487, rawHeight: 672 },
} as const;

const BOTTOM_DOCK_INSET = 10;

const factionTone: Record<QidahenFactionId, { bg: string; border: string; text: string; chip: string }> = {
    ming: { bg: UI_STYLE.paper, border: UI_STYLE.cinnabar, text: UI_STYLE.ink, chip: ASSETS.mingMarker },
    mongol: { bg: UI_STYLE.paper, border: UI_STYLE.oldGold, text: UI_STYLE.ink, chip: ASSETS.mongolMarker },
    jin: { bg: UI_STYLE.paper, border: UI_STYLE.bronze, text: UI_STYLE.ink, chip: ASSETS.jinMarker },
};

const REGION_BY_COLOR = QIDAHEN_REGION_ID_BY_MASK_COLOR;

const BOUNDARY_TYPE_RUNTIME_COLORS: Record<string, string> = {
    plain: 'rgba(218,175,83,0.82)',
    mountain: 'rgba(118,151,130,0.9)',
    river: 'rgba(83,151,188,0.9)',
    coast: 'rgba(74,144,201,0.9)',
    'wall-convex': 'rgba(168,103,51,0.9)',
    'wall-flat': 'rgba(184,128,74,0.9)',
    city: 'rgba(184,65,45,0.92)',
    shanhaiguan: 'rgba(210,194,121,0.9)',
};

const polarToPoint = (center: number, radius: number, angleDeg: number) => {
    const radians = (angleDeg * Math.PI) / 180;
    return {
        x: center + Math.cos(radians) * radius,
        y: center + Math.sin(radians) * radius,
    };
};

const getAtlasFrame = (index: number, atlas: SpriteAtlasConfig): SpriteAtlasFrame => {
    if ('frames' in atlas) {
        if (atlas.frames.length === 0) {
            return { x: 0, y: 0, width: atlas.imageW, height: atlas.imageH };
        }
        return atlas.frames[index % atlas.frames.length] ?? atlas.frames[0];
    }

    const safeIndex = index % (atlas.cols * atlas.rows);
    const col = safeIndex % atlas.cols;
    const row = Math.floor(safeIndex / atlas.cols);
    return {
        x: atlas.colStarts[col] ?? atlas.colStarts[0],
        y: atlas.rowStarts[row] ?? atlas.rowStarts[0],
        width: atlas.colWidths[col] ?? atlas.colWidths[0],
        height: atlas.rowHeights[row] ?? atlas.rowHeights[0],
    };
};

const describeAnnularSlice = (center: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) => {
    const outerStart = polarToPoint(center, outerRadius, startAngle);
    const outerEnd = polarToPoint(center, outerRadius, endAngle);
    const innerEnd = polarToPoint(center, innerRadius, endAngle);
    const innerStart = polarToPoint(center, innerRadius, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';

    return [
        `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
        `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
        'Z',
    ].join(' ');
};

const getCurrentFactionId = (core: QidahenCore): QidahenFactionId => (
    (['ming', 'mongol', 'jin'] as QidahenFactionId[])
        .find((id) => core.factions[id].playerId === core.currentPlayer) ?? 'ming'
);

const buildRegionMaskHitmap = (image: HTMLImageElement) => {
    if (image.naturalWidth !== QIDAHEN_MAP_WIDTH || image.naturalHeight !== QIDAHEN_MAP_HEIGHT) {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = QIDAHEN_MAP_WIDTH;
    canvas.height = QIDAHEN_MAP_HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT).data;
    for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset + 3] === 0) continue;
        const colorKey = qidahenRegionColorKey(data[offset], data[offset + 1], data[offset + 2]);
        if (QIDAHEN_REGION_ID_BY_MASK_COLOR[colorKey]) {
            return data;
        }
    }
    return null;
};

const REGION_MASK_OVERLAY_TONES = {
    selected: {
        fill: [198, 54, 36, 102],
        stroke: [255, 248, 233, 244],
    },
    dispatch: {
        fill: [79, 122, 164, 72],
        stroke: [178, 216, 247, 230],
    },
    hovered: {
        fill: [238, 190, 94, 82],
        stroke: [255, 230, 157, 226],
    },
    pending: {
        fill: [184, 59, 39, 62],
        stroke: [184, 59, 39, 210],
    },
} as const;

const formatSpecialTroops = (specialTroops: QidahenCore['regions'][number]['specialTroops']) => (
    specialTroops.map((stack) => `${stack.label} x${stack.count}（${stack.level}级）`).join('，')
);

const getDefenderCavalryEvasionRetreatChoices = (core: QidahenCore): Array<{ id: string; name: string }> => {
    const pending = core.pendingTargetAction;
    if (!pending || pending.defenderFactionId === 'neutral') {
        return [];
    }
    if (pending.actionId !== 'raid' && pending.actionId !== 'wheel-dispatch' && pending.actionId !== 'drive-tiger') {
        return [];
    }
    if (getQidahenRuleRegionTags(pending.targetRuntimeRegionId).includes('city')) {
        return [];
    }
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === pending.targetRuntimeRegionId);
    if (!targetRegion || !targetRegion.specialTroops.some((stack) => stack.troopKind === 'cavalry' && stack.count > 0)) {
        return [];
    }
    return targetRegion.adjacentRegionIds
        .map((regionId) => core.regions.find((region) => !region.isLogicalRegion && region.id === regionId))
        .filter((region): region is NonNullable<typeof region> => region != null && (
            region.controller === pending.defenderFactionId
            || region.diplomacyMarkerFaction === pending.defenderFactionId
        ))
        .sort((left, right) => (
            Number(right.controller === pending.defenderFactionId) - Number(left.controller === pending.defenderFactionId)
            || right.troops - left.troops
            || right.population - left.population
            || left.name.localeCompare(right.name, 'zh-CN')
        ))
        .map((region) => ({ id: region.id, name: region.name }));
};

const canUseAttackerCavalryPlunder = (core: QidahenCore): boolean => {
    const pending = core.pendingTargetAction;
    if (!pending || !pending.sourceRegionId) {
        return false;
    }
    if (pending.actionId !== 'raid' && pending.actionId !== 'wheel-dispatch' && pending.actionId !== 'drive-tiger') {
        return false;
    }
    const targetTags = getQidahenRuleRegionTags(pending.targetRuntimeRegionId);
    if (targetTags.includes('city') || targetTags.includes('korea')) {
        return false;
    }
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === pending.targetRuntimeRegionId);
    if (!targetRegion || targetRegion.population <= 0) {
        return false;
    }
    if (pending.movementProfileId === 'infantry' || pending.movementProfileId === 'dispatch-infantry') {
        return false;
    }
    const sourceRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === pending.sourceRegionId);
    if (!sourceRegion) {
        return false;
    }
    const cavalryCount = sourceRegion.specialTroops
        .filter((stack) => stack.troopKind === 'cavalry')
        .reduce((sum, stack) => sum + stack.count, 0);
    return Math.min(cavalryCount, pending.committedTroops) > 0;
};

const canUseAttackerCavalryPlunderDefenderDeck = (core: QidahenCore): boolean => {
    const pending = core.pendingTargetAction;
    if (!pending || !canUseAttackerCavalryPlunder(core)) {
        return false;
    }
    return pending.defenderFactionId !== 'neutral' && pending.defenderFactionId !== pending.attackerFactionId;
};

const hasStructuredCasualtyChoice = (core: QidahenCore): boolean => {
    const pending = core.pendingTargetAction;
    if (!pending) {
        return false;
    }
    const sourceRegion = pending.sourceRegionId
        ? core.regions.find((region) => !region.isLogicalRegion && region.id === pending.sourceRegionId)
        : null;
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === pending.targetRuntimeRegionId);
    return [sourceRegion, targetRegion].some((region) => (
        region?.specialTroops.some((stack) => stack.troopKind !== 'artillery' && stack.count > 0) === true
    ));
};

const getPendingCommittedTroopOptions = (core: QidahenCore): number[] => {
    const pending = core.pendingTargetAction;
    if (!pending || (pending.actionId !== 'raid' && pending.actionId !== 'wheel-dispatch' && pending.actionId !== 'drive-tiger')) {
        return [];
    }
    const maxCommittedTroops = Math.max(0, Math.min(
        pending.committedTroops,
        pending.sourceAvailableTroops,
        pending.boundaryUnitCap ?? pending.committedTroops,
    ));
    return Array.from({ length: maxCommittedTroops }, (_, index) => index + 1);
};

type RegionMaskOverlayToneKey = keyof typeof REGION_MASK_OVERLAY_TONES;

const readMaskRegionIdAt = (hitmap: Uint8ClampedArray, x: number, y: number): string | null => {
    if (x < 0 || y < 0 || x >= QIDAHEN_MAP_WIDTH || y >= QIDAHEN_MAP_HEIGHT) {
        return null;
    }
    const offset = (y * QIDAHEN_MAP_WIDTH + x) * 4;
    if (hitmap[offset + 3] === 0) {
        return null;
    }
    const colorKey = qidahenRegionColorKey(hitmap[offset], hitmap[offset + 1], hitmap[offset + 2]);
    return REGION_BY_COLOR[colorKey] ?? null;
};

const renderRegionMaskOverlay = (
    canvas: HTMLCanvasElement,
    hitmap: Uint8ClampedArray,
    toneByRegionId: Map<string, RegionMaskOverlayToneKey>,
) => {
    const context = canvas.getContext('2d');
    if (!context) {
        return;
    }

    const image = context.createImageData(QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT);
    const pixels = image.data;

    for (let y = 0; y < QIDAHEN_MAP_HEIGHT; y += 1) {
        for (let x = 0; x < QIDAHEN_MAP_WIDTH; x += 1) {
            const regionId = readMaskRegionIdAt(hitmap, x, y);
            if (!regionId) {
                continue;
            }
            const toneKey = toneByRegionId.get(regionId);
            if (!toneKey) {
                continue;
            }

            const offset = (y * QIDAHEN_MAP_WIDTH + x) * 4;
            const isBorder = (
                readMaskRegionIdAt(hitmap, x - 1, y) !== regionId
                || readMaskRegionIdAt(hitmap, x + 1, y) !== regionId
                || readMaskRegionIdAt(hitmap, x, y - 1) !== regionId
                || readMaskRegionIdAt(hitmap, x, y + 1) !== regionId
            );
            const color = isBorder
                ? REGION_MASK_OVERLAY_TONES[toneKey].stroke
                : REGION_MASK_OVERLAY_TONES[toneKey].fill;
            pixels[offset] = color[0];
            pixels[offset + 1] = color[1];
            pixels[offset + 2] = color[2];
            pixels[offset + 3] = color[3];
        }
    }

    context.clearRect(0, 0, QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT);
    context.putImageData(image, 0, 0);
};

const CardPreviewFit: React.FC<{
    previewRef: CardPreviewRef;
    locale?: string;
    title: string;
    width: number;
    height: number;
    rawWidth: number;
    rawHeight: number;
}> = ({ previewRef, locale, title, width, height, rawWidth, rawHeight }) => {
    if (previewRef.type === 'atlas') {
        const source = getCardAtlasSource(previewRef.atlasId, locale);
        if (source) {
            const frame = getAtlasFrame(previewRef.index, source.config);
            const scale = Math.min(width / frame.width, height / frame.height);
            const scaledWidth = frame.width * scale;
            const scaledHeight = frame.height * scale;
            const localizedPath = getLocalizedAssetPath(source.image, locale ?? 'zh-CN');
            const urls = getOptimizedImageUrls(localizedPath);

            return (
                <div className="absolute inset-0 overflow-hidden" style={{ background: UI_STYLE.cardField }}>
                    <div
                        className="absolute overflow-hidden"
                        data-card-atlas-frame="true"
                        data-card-atlas-id={previewRef.atlasId}
                        data-card-atlas-index={previewRef.index}
                        title={title}
                        style={{
                            left: (width - scaledWidth) / 2,
                            top: (height - scaledHeight) / 2,
                            width: scaledWidth,
                            height: scaledHeight,
                        }}
                    >
                        <img
                            src={urls.webp}
                            alt={title}
                            draggable={false}
                            style={{
                                display: 'block',
                                width: source.config.imageW * scale,
                                height: source.config.imageH * scale,
                                maxWidth: 'none',
                                transform: `translate(${-frame.x * scale}px, ${-frame.y * scale}px)`,
                                transformOrigin: 'top left',
                            }}
                        />
                    </div>
                </div>
            );
        }
    }

    const scale = Math.min(width / rawWidth, height / rawHeight);
    const scaledWidth = rawWidth * scale;
    const scaledHeight = rawHeight * scale;

    return (
        <div className="absolute inset-0 overflow-hidden" style={{ background: UI_STYLE.cardField }}>
            <CardPreview
                previewRef={previewRef}
                locale={locale}
                title={title}
                style={{
                    width: rawWidth,
                    height: rawHeight,
                    transform: `translate(${(width - scaledWidth) / 2}px, ${(height - scaledHeight) / 2}px) scale(${scale})`,
                    transformOrigin: 'top left',
                }}
            />
        </div>
    );
};

const StageRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [stageMetrics, setStageMetrics] = React.useState({ scale: 1, left: 0, top: 0 });

    React.useEffect(() => {
        const element = containerRef.current;
        if (!element) return undefined;

        const update = () => {
            const rect = element.getBoundingClientRect();
            const isLandscapeMobileViewport = window.innerWidth <= 1023 && window.innerWidth > window.innerHeight;
            const visibleWidth = isLandscapeMobileViewport ? Math.min(rect.width, window.innerWidth) : rect.width;
            const visibleHeight = isLandscapeMobileViewport ? Math.min(rect.height, window.innerHeight) : rect.height;
            const scale = Math.min(visibleWidth / STAGE_WIDTH, visibleHeight / STAGE_HEIGHT);
            setStageMetrics({
                scale,
                left: Math.max(0, (visibleWidth - STAGE_WIDTH * scale) / 2),
                top: Math.max(0, (visibleHeight - STAGE_HEIGHT * scale) / 2),
            });
        };

        update();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(element);
        window.addEventListener('resize', update);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', update);
        };
    }, []);

    return (
        <div ref={containerRef} className="relative h-full min-h-0 overflow-hidden bg-white" data-testid="qidahen-board">
            <div
                className="absolute overflow-hidden bg-white"
                data-testid="qidahen-desktop-stage"
                style={{
                    width: STAGE_WIDTH,
                    height: STAGE_HEIGHT,
                    left: stageMetrics.left,
                    top: stageMetrics.top,
                    color: UI_STYLE.ink,
                    transform: `scale(${stageMetrics.scale})`,
                    transformOrigin: 'top left',
                }}
            >
                {children}
            </div>
        </div>
    );
};

const PlayerChip: React.FC<{
    faction: QidahenCore['factions'][QidahenFactionId];
    current: boolean;
    effectiveVp: number;
    prestigeBonus: number;
}> = ({ faction, current, effectiveVp, prestigeBonus }) => {
    const tone = factionTone[faction.id];
    const markedCharacters = faction.characters.filter((character) => character.defeatMarkers > 0);
    const armamentSummary = faction.armaments.length > 0
        ? faction.armaments.map((armament) => `${armament.name}${armament.level}`).join(' / ')
        : '未开发';
    return (
        <div
            className="relative flex h-[74px] min-w-0 flex-1 items-center gap-3 overflow-hidden border-[3px] px-3.5"
            data-testid={`qidahen-player-${faction.id}`}
            style={{
                borderColor: current ? tone.border : UI_STYLE.mapInk,
                background: current ? UI_SURFACE.mapPanelSelected : UI_SURFACE.mapPanel,
                color: UI_STYLE.mapIvory,
                boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                borderRadius: 3,
            }}
        >
            <span
                className="pointer-events-none absolute inset-y-0 left-0 w-[8px]"
                style={{ background: current ? tone.border : 'rgba(210,183,117,0.72)' }}
            />
            <span className="pointer-events-none absolute inset-x-[16px] top-[3px] h-[1px]" style={{ background: 'rgba(232,200,133,0.34)' }} />
            <OptimizedImage
                src={tone.chip}
                alt={faction.name}
                className="h-10 w-10 shrink-0 rounded-full border-2 object-cover"
                style={{ borderColor: tone.border, boxShadow: `0 0 0 2px rgba(32,21,13,0.92), 0 3px 8px rgba(0,0,0,0.34)` }}
                draggable={false}
                placeholder={false}
            />
            <div className="min-w-0 flex-1 text-[19px] font-black leading-none tracking-[0.02em] [text-shadow:0_1px_0_rgba(0,0,0,0.55)]">
                <div className="min-w-0 whitespace-nowrap">
                    <span>{faction.name}</span>
                    <span className="ml-3 text-[15px]" style={{ color: UI_STYLE.mapGold }}>VP{effectiveVp}</span>
                    {prestigeBonus > 0 ? (
                        <span className="ml-2 text-[11px]" style={{ color: '#f3d1a5' }}>汉城+{prestigeBonus}</span>
                    ) : null}
                    <span className="ml-3 text-[15px]" style={{ color: UI_STYLE.mapGold }}>{faction.handCount}/{faction.handLimit}</span>
                </div>
                <div
                    className="mt-1 truncate text-[11px] leading-none"
                    data-testid={`qidahen-armaments-${faction.id}`}
                    style={{ color: '#f3d1a5' }}
                >
                    军备 {armamentSummary}
                </div>
                <div
                    className="mt-1 truncate text-[11px] leading-none"
                    data-testid={`qidahen-character-markers-${faction.id}`}
                    style={{ color: markedCharacters.length > 0 ? '#f3d1a5' : 'rgba(243,209,165,0.62)' }}
                >
                    {markedCharacters.length > 0
                        ? markedCharacters.map((character) => `${character.name}(${character.number})败×${character.defeatMarkers}`).join(' / ')
                        : `人物 ${faction.characters.filter((character) => character.inPlay).length}`}
                </div>
            </div>
            {faction.defeatMarkers > 0 ? (
                <span
                    className="grid h-[26px] min-w-[42px] shrink-0 place-items-center border-2 px-1.5 text-[12px] font-black"
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: 'rgba(87, 35, 24, 0.92)',
                        color: '#f3d1a5',
                        boxShadow: `0 2px 6px ${UI_STYLE.shadowSoft}`,
                        borderRadius: 2,
                    }}
                >
                    败×{faction.defeatMarkers}
                </span>
            ) : null}
            {current ? (
                <span
                    className="grid h-[28px] w-[48px] shrink-0 place-items-center border-2 text-[12px] font-black"
                    style={{
                        background: 'linear-gradient(180deg, rgba(196,81,61,0.96) 0%, rgba(159,52,38,0.96) 100%)',
                        borderColor: UI_STYLE.mapInk,
                        color: '#f8e7c9',
                        boxShadow: `0 3px 7px ${UI_STYLE.cinnabarGlow}`,
                        borderRadius: 2,
                    }}
                >
                    当前
                </span>
            ) : null}
        </div>
    );
};

const PlayerFloat: React.FC<{ core: QidahenCore }> = ({ core }) => {
    const prestigeBonusByFaction = getQidahenPrestigeBonusByFaction(core);
    return (
        <div
            className="pointer-events-auto absolute left-[720px] top-[36px] z-40 flex w-[700px] gap-3"
            data-testid="qidahen-player-float"
            data-ui-anchor="top-right"
        >
            {(['ming', 'mongol', 'jin'] as QidahenFactionId[]).map((id) => (
                <PlayerChip
                    key={id}
                    faction={core.factions[id]}
                    current={core.currentPlayer === core.factions[id].playerId}
                    effectiveVp={getQidahenEffectiveVpByFaction(core, id)}
                    prestigeBonus={prestigeBonusByFaction[id]}
                />
            ))}
        </div>
    );
};

const MapToken: React.FC<{ token: QidahenMapToken }> = ({ token }) => {
    const size = token.size ?? 30;
    const tone = factionTone[token.faction === 'neutral' ? 'ming' : token.faction];
    return (
        <div
            className="pointer-events-none absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[13px] font-black"
            data-testid={`qidahen-map-token-${token.id}`}
            style={{
                left: token.x * QIDAHEN_MAP_WIDTH,
                top: token.y * QIDAHEN_MAP_HEIGHT,
                width: size,
                height: size,
                color: UI_STYLE.ink,
            }}
        >
            {token.imageSrc ? (
                <OptimizedImage
                    src={token.imageSrc}
                    alt={token.id}
                    className="h-full w-full rounded-full object-cover"
                    draggable={false}
                    placeholder={false}
                    style={{ boxShadow: `0 2px 8px ${UI_STYLE.shadowSoft}` }}
                />
            ) : (
                <span
                    className="grid h-full w-full place-items-center rounded-full border-2"
                    style={{ borderColor: tone.border, background: UI_STYLE.paperLight }}
                >
                    {token.value}
                </span>
            )}
        </div>
    );
};

const MapSceneLayer: React.FC<{
    core: QidahenCore;
    locale?: string;
    onSelectRegion: (regionId: string) => void;
}> = ({ core, locale, onSelectRegion }) => {
    const currentFactionId = QIDAHEN_FACTION_ORDER.find((factionId) => core.factions[factionId].playerId === core.currentPlayer) ?? 'ming';
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const hitmapRef = React.useRef<Uint8ClampedArray | null>(null);
    const [hoveredRegionId, setHoveredRegionId] = React.useState<string | null>(null);
    const [maskVersion, setMaskVersion] = React.useState(0);

    React.useEffect(() => {
        if (typeof Image === 'undefined') return undefined;

        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            const formalHitmap = buildRegionMaskHitmap(image);
            if (!cancelled && formalHitmap) {
                hitmapRef.current = formalHitmap;
                setMaskVersion((value) => value + 1);
            }
        };
        image.src = qidahenRegionMaskUrl;
        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        const canvas = overlayCanvasRef.current;
        const hitmap = hitmapRef.current;
        if (!canvas || !hitmap) {
            return;
        }

        const toneByRegionId = new Map<string, RegionMaskOverlayToneKey>();
        for (const candidate of core.wheelDispatchSelection?.candidates ?? []) {
            toneByRegionId.set(candidate.targetRuntimeRegionId, 'dispatch');
        }
        for (const candidate of core.gaoDiDispatchSelection?.candidates ?? []) {
            toneByRegionId.set(candidate.targetRegionId, 'dispatch');
        }
        for (const candidate of core.internalDispatchSelection?.candidates ?? []) {
            toneByRegionId.set(candidate.targetRegionId, 'dispatch');
        }
        if (core.pendingTargetAction?.targetRegionId) {
            toneByRegionId.set(core.pendingTargetAction.targetRegionId, 'pending');
        }
        if (hoveredRegionId) {
            toneByRegionId.set(hoveredRegionId, 'hovered');
        }
        if (core.selectedRegionId) {
            toneByRegionId.set(core.selectedRegionId, 'selected');
        }
        renderRegionMaskOverlay(canvas, hitmap, toneByRegionId);
    }, [core.gaoDiDispatchSelection?.candidates, core.internalDispatchSelection?.candidates, core.pendingTargetAction?.targetRegionId, core.selectedRegionId, core.wheelDispatchSelection?.candidates, hoveredRegionId, maskVersion]);

    const selectedRegion = core.regions.find((region) => region.id === core.selectedRegionId);
    const hoveredRegion = hoveredRegionId ? core.regions.find((region) => region.id === hoveredRegionId) : undefined;
    const activeRegion = hoveredRegion ?? selectedRegion;
    const activeSpecialTroopsSummary = activeRegion && activeRegion.specialTroops.length > 0
        ? formatSpecialTroops(activeRegion.specialTroops)
        : null;

    const getRegionFromPointer = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const hitmap = hitmapRef.current;
        if (!canvas || !hitmap) return null;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(((event.clientX - rect.left) / rect.width) * QIDAHEN_MAP_WIDTH);
        const y = Math.floor(((event.clientY - rect.top) / rect.height) * QIDAHEN_MAP_HEIGHT);
        if (x < 0 || y < 0 || x >= QIDAHEN_MAP_WIDTH || y >= QIDAHEN_MAP_HEIGHT) return null;

        const offset = (y * QIDAHEN_MAP_WIDTH + x) * 4;
        if (hitmap[offset + 3] === 0) return null;
        const colorKey = qidahenRegionColorKey(hitmap[offset], hitmap[offset + 1], hitmap[offset + 2]);
        return REGION_BY_COLOR[colorKey] ?? null;
    }, []);

    const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        setHoveredRegionId(getRegionFromPointer(event));
    }, [getRegionFromPointer]);

    const handleClick = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const regionId = getRegionFromPointer(event);
        if (regionId) {
            onSelectRegion(regionId);
        }
    }, [getRegionFromPointer, onSelectRegion]);

    const tipLeft = activeRegion
        ? Math.min(STAGE_WIDTH - 250, Math.max(18, MAP_COVER_LEFT + activeRegion.x * QIDAHEN_MAP_WIDTH * MAP_COVER_SCALE + 18))
        : 0;
    const tipTop = activeRegion
        ? Math.min(STAGE_HEIGHT - 118, Math.max(18, MAP_COVER_TOP + activeRegion.y * QIDAHEN_MAP_HEIGHT * MAP_COVER_SCALE - 34))
        : 0;
    const focusRuntimeRegionIds = new Set(activeRegion?.runtimeRegionIds ?? selectedRegion?.runtimeRegionIds ?? [core.selectedRegionId]);
    const runtimeRegionsById = new Map(
        core.regions
            .filter((region) => !region.isLogicalRegion)
            .map((region) => [region.id, region]),
    );
    const runtimeGraphEdges = QIDAHEN_REGION_GRAPH_EDGES
        .filter((edge) => focusRuntimeRegionIds.has(edge.from) || focusRuntimeRegionIds.has(edge.to))
        .map((edge) => {
            const renderFromId = focusRuntimeRegionIds.has(edge.to) && !focusRuntimeRegionIds.has(edge.from)
                ? edge.to
                : edge.from;
            const renderToId = renderFromId === edge.from ? edge.to : edge.from;
            const directedPassage = getQidahenDirectedPassage(edge, renderFromId, renderToId);
            const fromRuntimeRegion = runtimeRegionsById.get(renderFromId);
            const stateBoundaryType = fromRuntimeRegion?.boundaryTypeByRegionId[renderToId];
            const stateTravelCost = fromRuntimeRegion?.travelCostByRegionId[renderToId];
            const stateBattleWidth = fromRuntimeRegion?.movementCostByRegionId[renderToId];
            const statePassage = stateBoundaryType && typeof stateTravelCost === 'number' && typeof stateBattleWidth === 'number'
                ? {
                    boundaryType: stateBoundaryType,
                    boundaryLabel: getQidahenBoundaryTypeMeta(stateBoundaryType).label,
                    travelCost: stateTravelCost,
                    battleWidth: stateBattleWidth,
                }
                : null;
            const fromNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(renderFromId);
            const toNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(renderToId);
            const from = fromNode?.center ?? fromNode?.seed ?? null;
            const to = toNode?.center ?? toNode?.seed ?? null;
            return from && to ? { edge, from, to, directedPassage: statePassage ?? directedPassage } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    const activePassageSummary = activeRegion
        ? Object.entries(activeRegion.travelCostByRegionId)
            .map(([regionId, travelCost]) => {
                const targetRegion = core.regions.find((region) => region.id === regionId);
                const boundaryType = activeRegion.boundaryTypeByRegionId[regionId];
                const battleWidth = activeRegion.movementCostByRegionId[regionId];
                const boundaryMeta = boundaryType ? getQidahenBoundaryTypeMeta(boundaryType) : getQidahenBoundaryTypeMeta('plain');
                const boundaryLabel = boundaryMeta.label;
                return {
                    regionId,
                    regionName: targetRegion?.name ?? regionId,
                    travelCost,
                    battleWidth,
                    boundaryLabel,
                    unitCap: boundaryMeta.unitCap,
                };
            })
            .sort((left, right) => left.travelCost - right.travelCost || left.regionName.localeCompare(right.regionName, 'zh-CN'))
            .slice(0, 3)
            .map((entry) => `${entry.regionName} ${entry.boundaryLabel} 移${entry.travelCost}/宽${entry.battleWidth ?? '-'}${entry.unitCap ? `/限${entry.unitCap}` : ''}`)
            .join(' · ')
        : '';
    const activeMovementPreview = activeRegion && activeRegion.controller === currentFactionId
        ? (() => {
            const previewText = (['dispatch-infantry', 'dispatch-cavalry'] as const)
                .map((profileId) => {
                    const profile = getQidahenMovementProfile(profileId);
                    const reachable = findQidahenReachableRuntimeRegions(core, activeRegion.id, currentFactionId, profile.movementBudget)
                        .slice(0, 3)
                        .map((region) => `${region.regionName}${region.usesCoast ? ' 水' : ''}`)
                        .join(' / ');
                    return reachable ? `${profile.label} ${reachable}` : '';
                })
                .filter(Boolean)
                .join(' · ');
            return previewText || '暂无';
        })()
        : '';

    return (
        <div
            className="pointer-events-auto absolute inset-0 z-10 overflow-hidden"
            data-testid="qidahen-map-layer"
            data-map-layout="full-bleed-cover"
            data-map-selected={core.selectedRegionId}
            style={{
                background: '#c8a970',
            }}
        >
            <div
                className="absolute"
                style={{
                    left: MAP_COVER_LEFT,
                    top: MAP_COVER_TOP,
                    width: QIDAHEN_MAP_WIDTH,
                    height: QIDAHEN_MAP_HEIGHT,
                    transform: `scale(${MAP_COVER_SCALE})`,
                    transformOrigin: 'top left',
                }}
            >
                <OptimizedImage
                    src={ASSETS.mainMap}
                    locale={locale}
                    alt="七大恨主地图"
                    className="absolute inset-0 h-full w-full select-none object-fill"
                    data-testid="qidahen-main-map-image"
                    draggable={false}
                    placeholder={false}
                />
                <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox={`0 0 ${QIDAHEN_MAP_WIDTH} ${QIDAHEN_MAP_HEIGHT}`}
                    aria-hidden="true"
                    data-testid="qidahen-map-overlay"
                >
                    <defs>
                        <filter id="qidahen-map-province-selected" x="-12%" y="-12%" width="124%" height="124%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3.2" floodColor="rgba(255,248,233,0.58)" />
                            <feDropShadow dx="0" dy="0" stdDeviation="6.5" floodColor="rgba(184,59,39,0.34)" />
                        </filter>
                        <filter id="qidahen-map-province-hover" x="-10%" y="-10%" width="120%" height="120%">
                            <feDropShadow dx="0" dy="0" stdDeviation="4.2" floodColor="rgba(255,220,146,0.44)" />
                        </filter>
                    </defs>
                    {core.routeLines.map((route) => (
                        <polyline
                            key={route.id}
                            points={route.points.map((point) => `${point.x * QIDAHEN_MAP_WIDTH},${point.y * QIDAHEN_MAP_HEIGHT}`).join(' ')}
                            fill="none"
                            stroke={route.tone === 'red' ? 'rgba(184,59,39,0.72)' : 'rgba(43,101,145,0.74)'}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={route.tone === 'red' ? '12 10' : undefined}
                        />
                    ))}
                    <g data-testid="qidahen-runtime-region-graph">
                        {runtimeGraphEdges.map(({ edge, from, to, directedPassage }) => {
                            const boundaryType = directedPassage?.boundaryType ?? edge.boundaryType;
                            const boundaryLabel = directedPassage?.boundaryLabel ?? edge.boundaryLabel;
                            const battleWidth = directedPassage?.battleWidth ?? edge.battleWidth;
                            const boundaryMeta = getQidahenBoundaryTypeMeta(boundaryType);
                            const color = BOUNDARY_TYPE_RUNTIME_COLORS[boundaryType] ?? BOUNDARY_TYPE_RUNTIME_COLORS.plain;
                            const midX = (from.x + to.x) / 2;
                            const midY = (from.y + to.y) / 2;
                            return (
                                <g
                                    key={edge.id}
                                    data-testid={`qidahen-runtime-region-edge-${edge.id}`}
                                    data-boundary-type={boundaryType}
                                    data-battle-width={battleWidth}
                                >
                                    <line
                                        x1={from.x}
                                        y1={from.y}
                                        x2={to.x}
                                        y2={to.y}
                                        stroke={color}
                                        strokeWidth={5}
                                        strokeLinecap="round"
                                        strokeDasharray={boundaryType === 'coast' ? '9 9' : undefined}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    <text
                                        x={midX}
                                        y={midY - 8}
                                        fill={color}
                                        stroke="rgba(32,21,13,0.78)"
                                        strokeWidth={3}
                                        paintOrder="stroke fill"
                                        textAnchor="middle"
                                        fontSize={18}
                                        fontWeight={900}
                                    >
                                        {boundaryLabel || boundaryMeta.label}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </svg>
                <canvas
                    ref={overlayCanvasRef}
                    width={QIDAHEN_MAP_WIDTH}
                    height={QIDAHEN_MAP_HEIGHT}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    data-testid="qidahen-map-region-mask-overlay"
                    aria-hidden="true"
                />
                {core.mapTokens.map((token) => (
                    <MapToken key={token.id} token={token} />
                ))}
                <canvas
                    ref={canvasRef}
                    width={QIDAHEN_MAP_WIDTH}
                    height={QIDAHEN_MAP_HEIGHT}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    data-testid="qidahen-map-hitmap-canvas"
                    onPointerMove={handlePointerMove}
                    onPointerLeave={() => setHoveredRegionId(null)}
                    onPointerDown={handleClick}
                    aria-label="七大恨地图区域选择"
                />
            </div>
            {activeRegion ? (
                <div
                    className="pointer-events-none absolute z-20 border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-map-region-tip"
                    style={{
                        left: tipLeft,
                        top: tipTop,
                        width: 252,
                        borderColor: activeRegion.id === core.selectedRegionId ? UI_STYLE.cinnabar : UI_STYLE.mapInk,
                        background: activeRegion.id === core.selectedRegionId ? UI_SURFACE.mapPanelSelected : UI_SURFACE.mapPanel,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="text-[16px] [text-shadow:0_1px_0_rgba(0,0,0,0.55)]">{activeRegion.name} · {activeRegion.controlLabel}</div>
                    <div className="mt-1 text-[12px]" style={{ color: UI_STYLE.mapGold }}>兵力 {activeRegion.troops} · 人口 {activeRegion.population}</div>
                    {activeSpecialTroopsSummary ? (
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            特殊 {activeSpecialTroopsSummary}
                        </div>
                    ) : null}
                    {activePassageSummary ? (
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            接边 {activePassageSummary}
                        </div>
                    ) : null}
                    {activeMovementPreview ? (
                        <div
                            className="mt-1 text-[11px]"
                            data-testid="qidahen-map-region-movement-preview"
                            style={{ color: '#f3d1a5' }}
                        >
                            调度可达 {activeMovementPreview}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

const DeckStack: React.FC<{
    src?: string;
    previewRef?: CardPreviewRef;
    label: string;
    count: number;
    className?: string;
    locale?: string;
    tone?: 'ink' | 'red';
    testId?: string;
    width?: number;
    height?: number;
    rawWidth?: number;
    rawHeight?: number;
}> = ({
    src,
    previewRef,
    label,
    count,
    className = '',
    locale,
    tone = 'ink',
    testId,
    width = CARD_DIMENSIONS.deck.width,
    height = CARD_DIMENSIONS.deck.height,
    rawWidth = CARD_DIMENSIONS.deck.rawWidth,
    rawHeight = CARD_DIMENSIONS.deck.rawHeight,
}) => {
    const border = tone === 'red' ? UI_STYLE.cinnabar : UI_STYLE.bronze;
    const text = tone === 'red' ? UI_STYLE.cinnabar : UI_STYLE.ink;

    return (
        <div className={`relative shrink-0 ${className}`} data-testid={testId} aria-label={`${label} ${count}`} style={{ width, height }}>
            <div className="absolute left-[9px] top-[8px] h-full w-full" style={{ background: 'rgba(32,21,13,0.58)', borderRadius: 7 }} />
            <div className="absolute left-[5px] top-[4px] h-full w-full" style={{ background: 'rgba(87,61,34,0.62)', borderRadius: 7 }} />
            <div className="relative h-full w-full overflow-hidden" style={{ background: UI_SURFACE.mapPanel, boxShadow: '0 8px 16px rgba(22,14,8,0.28)', borderRadius: 7 }}>
                {previewRef ? (
                    <CardPreviewFit previewRef={previewRef} locale={locale} title={label} width={width} height={height} rawWidth={rawWidth} rawHeight={rawHeight} />
                ) : src ? (
                    <OptimizedImage src={src} alt={label} className="h-full w-full object-cover" draggable={false} placeholder={false} />
                ) : null}
                <div
                    className="pointer-events-none absolute left-2 top-2 border-2 px-2 py-0.5 text-[12px] font-black tracking-[0.08em]"
                    style={{ color: tone === 'red' ? '#f4d0a0' : UI_STYLE.mapIvory, borderColor: UI_STYLE.mapInk, background: tone === 'red' ? UI_SURFACE.mapPanelSelected : UI_SURFACE.mapPanel, borderRadius: 2, boxShadow: UI_SURFACE.mapPanelInset }}
                >
                    {label}
                </div>
                <div className="pointer-events-none absolute bottom-2 right-2 grid h-[40px] w-[40px] place-items-center rounded-full border-2 text-[17px] font-black" style={{ borderColor: border, color: text, background: 'rgba(248,237,206,0.96)', boxShadow: `0 3px 8px ${UI_STYLE.shadowSoft}` }}>
                    {count}
                </div>
            </div>
        </div>
    );
};

const WheelPanel: React.FC<{
    selectedId: string;
    selectedMoveId: string;
    moveChoices: QidahenWheelMoveChoice[];
    moveSummary: string;
    disabled: boolean;
    onSelectMove: (moveId: string) => void;
    onExecuteMove: (moveId: string) => void;
}> = ({ selectedId, selectedMoveId, moveChoices, moveSummary, disabled, onSelectMove, onExecuteMove }) => {
    const [activeMoveId, setActiveMoveId] = React.useState(selectedMoveId);
    const selectedIndex = Math.max(0, WHEEL_SECTORS.findIndex((sector) => sector.id === selectedId));
    const selectedAngle = WHEEL_SECTORS[selectedIndex]?.angle ?? -90;
    const activeMove = moveChoices.find((choice) => choice.id === activeMoveId)
        ?? moveChoices.find((choice) => choice.id === selectedMoveId)
        ?? moveChoices[0];
    const activeSummary = activeMove ? `${activeMove.label}：${activeMove.drawText}` : moveSummary;

    React.useEffect(() => {
        setActiveMoveId(selectedMoveId);
    }, [selectedMoveId]);

    const getMoveTargetAngle = (steps: number) => {
        const targetIndex = (selectedIndex + steps) % WHEEL_SECTORS.length;
        return WHEEL_SECTORS[targetIndex]?.angle ?? selectedAngle;
    };

    const selectedMove = moveChoices.find((choice) => choice.id === selectedMoveId);
    const selectedMoveTargetIndex = selectedMove ? (selectedIndex + selectedMove.steps) % WHEEL_SECTORS.length : selectedIndex;
    const sectorRenderOrder = WHEEL_SECTORS
        .map((sector, index) => ({ sector, index }))
        .sort((a, b) => {
            if (a.index === selectedMoveTargetIndex) return 1;
            if (b.index === selectedMoveTargetIndex) return -1;
            return a.index - b.index;
        });

    return (
        <div
            className="pointer-events-auto group absolute left-[136px] top-[-35px] z-30 h-[438px] w-[438px]"
            data-testid="qidahen-action-wheel"
            data-ui-anchor="left-top"
        >
            <div
                className="relative h-full w-full"
                role="img"
                aria-label="七大恨行动轮盘"
                data-testid="qidahen-action-wheel-asset"
            >
                <svg
                    viewBox={`0 0 ${WHEEL_VIEW} ${WHEEL_VIEW}`}
                    className="absolute inset-0 h-full w-full"
                    aria-hidden="true"
                >
                    <defs>
                        <filter id="qidahen-wheel-current" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="1.4" stdDeviation="0.9" floodColor="rgba(72,54,31,0.18)" />
                        </filter>
                        <filter id="qidahen-wheel-grain" x="-10%" y="-10%" width="120%" height="120%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="2" seed="21" />
                            <feColorMatrix type="saturate" values="0" />
                            <feComponentTransfer>
                                <feFuncA type="table" tableValues="0 0.14" />
                            </feComponentTransfer>
                        </filter>
                        <radialGradient id="qidahen-wheel-paper" cx="47%" cy="42%" r="58%">
                            <stop offset="0%" stopColor="#a28c58" />
                            <stop offset="62%" stopColor="#7d755d" />
                            <stop offset="100%" stopColor="#5b5442" />
                        </radialGradient>
                        <radialGradient id="qidahen-wheel-center-paper" cx="47%" cy="38%" r="62%">
                            <stop offset="0%" stopColor="#af9052" />
                            <stop offset="100%" stopColor="#99793f" />
                        </radialGradient>
                        <clipPath id="qidahen-wheel-face-clip">
                            <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_OUTER_RADIUS - 7} />
                        </clipPath>
                    </defs>
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_OUTER_RADIUS - 4} fill="url(#qidahen-wheel-paper)" stroke="#1f160f" strokeWidth="6" />
                    <circle
                        cx={WHEEL_CENTER}
                        cy={WHEEL_CENTER}
                        r={WHEEL_OUTER_RADIUS - 8}
                        clipPath="url(#qidahen-wheel-face-clip)"
                        filter="url(#qidahen-wheel-grain)"
                        opacity="0.82"
                        style={{ mixBlendMode: 'multiply' }}
                    />
                    {sectorRenderOrder.map(({ sector, index }) => {
                        const current = index === selectedIndex;
                        const selectedTarget = selectedMove ? index === selectedMoveTargetIndex : false;
                        const labelPoint = polarToPoint(WHEEL_CENTER, WHEEL_LABEL_RADIUS, sector.angle);
                        return (
                            <g
                                key={sector.id}
                                data-testid="qidahen-wheel-sector"
                                data-wheel-sector-id={sector.id}
                                data-wheel-selected={selectedTarget ? 'true' : undefined}
                                filter={current ? 'url(#qidahen-wheel-current)' : undefined}
                            >
                                <path
                                    d={describeAnnularSlice(WHEEL_CENTER, WHEEL_INNER_RADIUS, WHEEL_OUTER_RADIUS - 16, sector.angle - 22.5, sector.angle + 22.5)}
                                    fill={selectedTarget ? 'rgba(150,45,32,0.44)' : current ? 'rgba(182,145,76,0.18)' : index % 2 === 0 ? 'rgba(54,52,43,0.18)' : 'rgba(105,93,68,0.14)'}
                                    stroke={selectedTarget ? 'rgba(99,27,20,1)' : 'rgba(32,23,15,0.56)'}
                                    strokeWidth={selectedTarget ? 3 : 0.9}
                                    strokeLinejoin="round"
                                />
                                <text
                                    x={labelPoint.x - 9}
                                    y={labelPoint.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="fill-[#241b14]"
                                    style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: selectedTarget ? '13px' : '12px', fontWeight: 650, writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '0.6px' }}
                                >
                                    {sector.label[0]}
                                </text>
                                <text
                                    x={labelPoint.x + 10}
                                    y={labelPoint.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="fill-[#241b14]"
                                    style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: selectedTarget ? '13px' : '12px', fontWeight: 650, writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '0.6px' }}
                                >
                                    {sector.label[1]}
                                </text>
                            </g>
                        );
                    })}
                    <text
                        x={WHEEL_CENTER}
                        y="24"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '12px', fontWeight: 700 }}
                    >
                        新年 &gt;&gt;&gt;
                    </text>
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_VIEW - 20}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '12px', fontWeight: 700 }}
                    >
                        年中
                    </text>
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_INNER_RADIUS - 6} fill="url(#qidahen-wheel-center-paper)" stroke="#24190f" strokeWidth="2" />
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_CENTER - 32}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        行
                    </text>
                    <text
                        x={WHEEL_CENTER + 31}
                        y={WHEEL_CENTER}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        轮
                    </text>
                    <text
                        x={WHEEL_CENTER - 31}
                        y={WHEEL_CENTER}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        盘
                    </text>
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_CENTER + 34}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        动
                    </text>
                    <g data-testid="qidahen-wheel-move-layer">
                        {moveChoices.map((choice) => {
                            const targetAngle = getMoveTargetAngle(choice.steps);
                            const activateMove = () => {
                                if (disabled) {
                                    return;
                                }
                                if (choice.id === selectedMoveId) {
                                    onExecuteMove(choice.id);
                                    return;
                                }
                                onSelectMove(choice.id);
                            };
                            return (
                                <path
                                    key={choice.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={choice.label}
                                    data-testid={`qidahen-wheel-move-target-${choice.id}`}
                                    d={describeAnnularSlice(WHEEL_CENTER, WHEEL_INNER_RADIUS - 8, WHEEL_OUTER_RADIUS - 8, targetAngle - 23.5, targetAngle + 23.5)}
                                    fill="rgba(255,248,233,0.001)"
                                    stroke="transparent"
                                    strokeWidth="1"
                                    className={`outline-none transition-[fill,stroke] ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    aria-disabled={disabled}
                                    onClick={activateMove}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            activateMove();
                                        }
                                    }}
                                    onFocus={() => setActiveMoveId(choice.id)}
                                    onMouseEnter={() => setActiveMoveId(choice.id)}
                                    onBlur={() => setActiveMoveId(selectedMoveId)}
                                    onMouseLeave={() => setActiveMoveId(selectedMoveId)}
                                />
                            );
                        })}
                    </g>
                </svg>
            </div>

            <div
                className="pointer-events-none absolute left-[372px] top-[360px] hidden w-[244px] border-[3px] px-3 py-2 text-[13px] font-black leading-5 tracking-[0.03em] group-hover:block group-focus-within:block"
                data-testid="qidahen-wheel-tip"
                role="tooltip"
                style={{
                    borderColor: UI_STYLE.mapInk,
                    background: UI_SURFACE.mapPanel,
                    color: UI_STYLE.mapIvory,
                    boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                    borderRadius: 3,
                }}
            >
                {activeSummary}
            </div>
        </div>
    );
};

const YearCardSlot: React.FC<{
    card: QidahenYearCardSlot;
    locale?: string;
}> = ({ card, locale }) => (
    <div
        className="relative overflow-hidden"
        data-testid={`qidahen-year-card-slot-${card.id}`}
        style={{
            width: CARD_DIMENSIONS.year.width,
            height: CARD_DIMENSIONS.year.height,
            background: 'transparent',
            boxShadow: '0 8px 16px rgba(56,35,15,0.18)',
            borderRadius: 7,
        }}
    >
        <CardPreviewFit
            previewRef={card.previewRef}
            locale={locale}
            title={card.label}
            width={CARD_DIMENSIONS.year.width}
            height={CARD_DIMENSIONS.year.height}
            rawWidth={CARD_DIMENSIONS.year.rawWidth}
            rawHeight={CARD_DIMENSIONS.year.rawHeight}
        />
    </div>
);

const ChronologyZone: React.FC<{
    cards: QidahenYearCardSlot[];
    locale?: string;
}> = ({ cards, locale }) => (
    <div className="pointer-events-auto absolute left-[80px] top-[542px] z-20" data-testid="qidahen-chronology-zone" data-ui-anchor="left-middle">
        <div className="flex items-end gap-3">
            {cards.slice(0, 2).map((card) => (
                <YearCardSlot key={card.id} card={card} locale={locale} />
            ))}
        </div>
    </div>
);

const KoreaZone: React.FC<{
    core: QidahenCore;
    locale?: string;
}> = ({ core, locale }) => (
    <div
        className="pointer-events-auto absolute right-[80px] top-[92px] z-20 flex gap-4"
        data-testid="qidahen-korea-zone"
        data-ui-anchor="right-top"
    >
        <DeckStack
            src={ASSETS.koreaCard}
            label="朝鲜牌库"
            count={core.koreaDeckCount}
            width={CARD_DIMENSIONS.koreaDeck.width}
            height={CARD_DIMENSIONS.koreaDeck.height}
            rawWidth={CARD_DIMENSIONS.koreaDeck.rawWidth}
            rawHeight={CARD_DIMENSIONS.koreaDeck.rawHeight}
            testId="qidahen-korea-draw-pile"
        />
        <DeckStack
            previewRef={core.koreaDiscardPreviewRef}
            locale={locale}
            label="朝鲜弃牌"
            count={core.koreaDiscardCount}
            tone="red"
            width={CARD_DIMENSIONS.koreaDeck.width}
            height={CARD_DIMENSIONS.koreaDeck.height}
            rawWidth={CARD_DIMENSIONS.koreaDeck.rawWidth}
            rawHeight={CARD_DIMENSIONS.koreaDeck.rawHeight}
            testId="qidahen-korea-discard-pile"
        />
    </div>
);

const ActionButton: React.FC<{
    action: QidahenActionChoice;
    selected: boolean;
    disabled?: boolean;
    onClick: () => void;
}> = ({ action, selected, disabled = false, onClick }) => (
    <button
        type="button"
        data-testid={`qidahen-action-${action.id}`}
        title={action.detail}
        disabled={disabled}
        className="relative inline-flex h-[52px] min-w-[146px] items-center justify-start overflow-hidden border-[3px] px-4 text-left text-[18px] font-black tracking-[0.04em] transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#9f3426]/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:translate-y-0"
        onClick={onClick}
        style={{
            borderColor: UI_STYLE.mapInk,
            background: selected ? UI_SURFACE.mapPanelSelected : UI_SURFACE.mapPanel,
            color: selected ? '#f6d5a8' : UI_STYLE.mapIvory,
            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
            borderRadius: 3,
        }}
    >
        <span className="pointer-events-none absolute inset-y-0 left-0 w-[8px]" style={{ background: selected ? UI_STYLE.cinnabar : 'rgba(210,183,117,0.76)' }} />
        <span className="pointer-events-none absolute inset-x-[14px] top-[3px] h-[1px]" style={{ background: 'rgba(232,200,133,0.3)' }} />
        <span className="min-w-0 whitespace-nowrap [text-shadow:0_1px_0_rgba(0,0,0,0.6)]">{action.label}</span>
    </button>
);

const ActionsZone: React.FC<{
    core: QidahenCore;
    onExecuteAction: (actionId: string) => void;
    onSelectRegion: (regionId: string) => void;
    onResolveRecruitChoice: (choiceId: QidahenRecruitChoice['id']) => void;
    onResolveSunYuanhuaTech: (choiceId: 'confirm' | 'skip') => void;
    onResolveGaoDiDispatch: (choiceId: string) => void;
    onResolveInternalDispatch: (choiceId: string) => void;
    onResolveMaShiTradeChoice: (troopCount: 1 | 2 | 3) => void;
    onResolveKhanEdictChoice: (choiceId: 'recruit-train' | 'hire-dispatch') => void;
    onResolveDiplomacyChoice: (choiceId: 'hire-only' | 'place-friendly' | 'flip-vassal' | 'remove-marker') => void;
    onResolveDriveTigerConsent: (choiceId: 'accept' | 'decline') => void;
    onResolveFortificationMaintenance: (choiceId: 'auto-pay' | 'skip-all', attritionPriority: QidahenCasualtyPriority) => void;
    upkeepAttritionPriority: QidahenCasualtyPriority;
    onSelectUpkeepAttritionPriority: (priority: QidahenCasualtyPriority) => void;
    onResolveHandLimitDiscard: () => void;
    pendingCommittedTroops?: number;
    onSelectPendingCommittedTroops: (committedTroops: number) => void;
    pendingAttackerCasualtyPriority: QidahenCasualtyPriority;
    pendingDefenderCasualtyPriority: QidahenCasualtyPriority;
    onSelectPendingAttackerCasualtyPriority: (priority: QidahenCasualtyPriority) => void;
    onSelectPendingDefenderCasualtyPriority: (priority: QidahenCasualtyPriority) => void;
    onResolvePendingAction: (retreatLossMode?: 'rear-guard' | 'rout', defenderCavalryEvasion?: boolean, attackerCavalryPlunder?: boolean, attackerCavalryPlunderSource?: QidahenPlunderSource, defenderCavalryEvasionRegionId?: string, attackerCasualtyPriority?: QidahenCasualtyPriority, defenderCasualtyPriority?: QidahenCasualtyPriority, committedTroops?: number) => void;
    onResolvePostBattleDecision: (choiceId: string) => void;
}> = ({ core, onExecuteAction, onSelectRegion, onResolveRecruitChoice, onResolveSunYuanhuaTech, onResolveGaoDiDispatch, onResolveInternalDispatch, onResolveMaShiTradeChoice, onResolveKhanEdictChoice, onResolveDiplomacyChoice, onResolveDriveTigerConsent, onResolveFortificationMaintenance, upkeepAttritionPriority, onSelectUpkeepAttritionPriority, onResolveHandLimitDiscard, pendingCommittedTroops, onSelectPendingCommittedTroops, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, onSelectPendingAttackerCasualtyPriority, onSelectPendingDefenderCasualtyPriority, onResolvePendingAction, onResolvePostBattleDecision }) => (
        <div
            className="pointer-events-auto absolute right-[80px] top-[276px] z-40"
            data-testid="qidahen-actions-zone"
            data-ui-anchor="right-middle"
        >
            <div
                className="mb-3 border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                data-testid="qidahen-turn-banner"
                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
            >
                <div>{core.turnLabel}</div>
                <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                    {core.currentYear} · 轮盘 {core.wheelActionUsed ? '已用' : '未用'} · 势力行动 {core.factionActionUsed ? '已用' : '未用'}
                </div>
            </div>
            {core.victoryStatus ? (
                <div
                    className="mb-3 max-w-[420px] border-[3px] px-3 py-2 text-[12px] font-black leading-5"
                    data-testid="qidahen-victory-status"
                    style={{ borderColor: UI_STYLE.cinnabar, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.victoryStatus.winnerName} 已达成{
                        core.victoryStatus.condition === 'hegemony'
                            ? '霸权胜利'
                            : core.victoryStatus.condition === 'military'
                                ? '军事胜利'
                                : '威望胜利'
                    }</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {core.victoryStatus.detail}
                    </div>
                </div>
            ) : null}
            <div
                className="mb-3 flex flex-wrap items-center justify-end gap-2"
                data-testid="qidahen-fortification-strip"
            >
                {core.fortifications.map((fortification) => (
                    <div
                        key={fortification.id}
                        className="border-[2px] px-2 py-1 text-[11px] font-black leading-4"
                        title={fortification.ruleNote}
                        data-testid={`qidahen-fortification-${fortification.id}`}
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: fortification.ruined ? UI_SURFACE.mapPanelSelected : UI_SURFACE.mapPanel,
                            color: fortification.ruined ? '#f6d5a8' : UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        {fortification.label} · {fortification.ruined ? '破败' : '完整'}
                    </div>
                ))}
            </div>
            {core.lastSeasonSummary ? (
                <div
                    className="mb-3 max-w-[420px] border-[3px] px-3 py-2 text-[12px] font-black leading-5"
                    data-testid="qidahen-season-summary"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.lastSeasonSummary.title}</div>
                    <div className="mt-1 space-y-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {core.lastSeasonSummary.lines.slice(0, 5).map((line) => (
                            <div key={line}>{line}</div>
                        ))}
                    </div>
                </div>
            ) : null}
            {core.handLimitDiscardSelection ? (
                <div
                    className="mb-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-hand-limit-discard-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.handLimitDiscardSelection.factionName} · 检查手牌上限</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        手牌 {core.handLimitDiscardSelection.handCount}/{core.handLimitDiscardSelection.handLimit} · 需弃 {core.handLimitDiscardSelection.requiredDiscardCount} · 已择 {core.handLimitDiscardSelection.selectedCardIds.length}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        点击底部手牌选择要弃掉的牌。
                    </div>
                    <button
                        type="button"
                        data-testid="qidahen-resolve-hand-limit-discard"
                        disabled={core.handLimitDiscardSelection.selectedCardIds.length < core.handLimitDiscardSelection.requiredDiscardCount}
                        className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                        onClick={onResolveHandLimitDiscard}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                    >
                        确认弃牌
                    </button>
                </div>
            ) : null}
            {core.sunYuanhuaTechSelection ? (
                <div
                    className="mb-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-sun-yuanhua-tech-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.sunYuanhuaTechSelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        需弃 {core.sunYuanhuaTechSelection.requiredCardCount} 张 · 已择 {core.sunYuanhuaTechSelection.selectedCardIds.length}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {core.sunYuanhuaTechSelection.summary}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        点击底部手牌选择 2 张要弃掉的牌，然后确认打科技；也可以直接跳过。
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            data-testid="qidahen-sun-yuanhua-tech-confirm"
                            disabled={core.sunYuanhuaTechSelection.selectedCardIds.length < core.sunYuanhuaTechSelection.requiredCardCount}
                            className="inline-flex min-h-[40px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                            onClick={() => onResolveSunYuanhuaTech('confirm')}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                            确认打科技
                        </button>
                        <button
                            type="button"
                            data-testid="qidahen-sun-yuanhua-tech-skip"
                            className="inline-flex min-h-[40px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                            onClick={() => onResolveSunYuanhuaTech('skip')}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                            跳过孙元化科技
                        </button>
                    </div>
                </div>
            ) : null}
            <div className="flex flex-col items-end gap-2" data-testid="qidahen-action-rail">
                {core.actionChoices.map((action) => (
                    <ActionButton
                        key={action.id}
                        action={action}
                        selected={core.selectedActionId === action.id}
                        disabled={core.factionActionUsed || core.recruitSelection != null || core.sunYuanhuaTechSelection != null || core.gaoDiDispatchSelection != null || core.internalDispatchSelection != null || core.maShiTradeSelection != null || core.khanEdictSelection != null || core.diplomacySelection != null || core.driveTigerConsentSelection != null || core.fortificationMaintenanceSelection != null || core.handLimitDiscardSelection != null || core.pendingTargetAction != null || core.postBattleSelection != null || core.wheelDispatchSelection != null}
                        onClick={() => onExecuteAction(action.id)}
                    />
                ))}
            </div>
            {core.fortificationMaintenanceSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-fortification-maintenance-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.fortificationMaintenanceSelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {core.fortificationMaintenanceSelection.summary}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]" data-testid="qidahen-upkeep-attrition-priority">
                        <span className="mr-1" style={{ color: '#f3d1a5' }}>兵力耗损</span>
                        {[
                            { id: 'lowest-level' as const, label: '低级先损' },
                            { id: 'highest-level' as const, label: '高级先损' },
                        ].map((option) => {
                            const selected = option.id === upkeepAttritionPriority;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    data-testid={`qidahen-upkeep-attrition-${option.id}`}
                                    className="inline-flex h-[28px] min-w-[54px] items-center justify-center border-[2px] px-2 text-[11px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onSelectUpkeepAttritionPriority(option.id)}
                                    style={{
                                        borderColor: selected ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                                        background: selected ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paper,
                                        color: selected ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                        boxShadow: selected ? UI_SURFACE.mapPanelShadow : UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {core.fortificationMaintenanceSelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-fortification-maintenance-choice-${choice.id}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveFortificationMaintenance(choice.id, upkeepAttritionPriority)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {core.gaoDiDispatchSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-gao-di-dispatch-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.gaoDiDispatchSelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        源区 {core.gaoDiDispatchSelection.sourceRegionName} · 部队最多 {core.gaoDiDispatchSelection.maxTroops} · 人口最多 {core.gaoDiDispatchSelection.maxPopulation}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {core.gaoDiDispatchSelection.summary}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        先点击底部手牌选择要弃掉的牌，再点击下面的调度目标；也可以直接跳过。
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {core.gaoDiDispatchSelection.candidates.map((candidate) => {
                            const amount = candidate.committedTroops + candidate.committedPopulation;
                            return (
                                <button
                                    key={candidate.id}
                                    type="button"
                                    data-testid={`qidahen-gao-di-dispatch-choice-${candidate.id}`}
                                    disabled={core.gaoDiDispatchSelection?.selectedCardId == null}
                                    className="inline-flex min-h-[50px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                                    onClick={() => onResolveGaoDiDispatch(candidate.id)}
                                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                                >
                                    <span className="min-w-0">
                                        <span className="block text-[13px]">{candidate.targetRegionName} · {candidate.mode === 'troops' ? '部队' : '人口'} {amount}</span>
                                        <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                            {candidate.resolutionHint}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {candidate.mode === 'troops' ? `${amount} 个部队` : `${amount} 个人口`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        data-testid="qidahen-gao-di-dispatch-skip"
                        className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                        onClick={() => onResolveGaoDiDispatch('skip')}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                    >
                        跳过高第调度
                    </button>
                </div>
            ) : null}
            {core.internalDispatchSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-internal-dispatch-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.internalDispatchSelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        源区 {core.internalDispatchSelection.sourceRegionName} · 最多调度 {core.internalDispatchSelection.maxTroops} 部队
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {core.internalDispatchSelection.summary}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {core.internalDispatchSelection.candidates.map((candidate) => (
                            <button
                                key={candidate.id}
                                type="button"
                                data-testid={`qidahen-internal-dispatch-choice-${candidate.targetRegionId}`}
                                className="inline-flex min-h-[50px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveInternalDispatch(candidate.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{candidate.targetRegionName}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {candidate.resolutionHint}
                                    </span>
                                </span>
                                <span className="shrink-0 text-[11px]" style={{ color: UI_STYLE.cinnabar }}>
                                    调 {candidate.committedTroops}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {core.recruitSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-recruit-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>征召军队</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        当前目标 {core.recruitSelection.targetRegionName ?? '未锁定'} · 可切换到其他己方控制区后再决定建军方式
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {core.recruitSelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-recruit-choice-${choice.id}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveRecruitChoice(choice.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {core.maShiTradeSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-ma-shi-trade-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>马市贸易</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        当前目标 {core.maShiTradeSelection.targetRegionName ?? '未锁定'} · 可切换到其他大明控制区后再决定建立数量
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {core.maShiTradeSelection.choices.map((choice) => (
                            <button
                                key={choice.troopCount}
                                type="button"
                                data-testid={`qidahen-ma-shi-trade-choice-${choice.troopCount}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveMaShiTradeChoice(choice.troopCount)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {core.khanEdictSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-khan-edict-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>大汗令箭</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        当前区域 {core.khanEdictSelection.sourceRegionName ?? '未锁定'} · 可切换地图选中区后再决定
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {core.khanEdictSelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-khan-edict-choice-${choice.id}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveKhanEdictChoice(choice.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {core.diplomacySelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-diplomacy-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.diplomacySelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        源区 {core.diplomacySelection.sourceRegionName ?? '未锁定'} · 雇佣落在 {core.diplomacySelection.hireRegionName ?? '当前控制区'}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        已执行 {core.diplomacySelection.resolvedSteps.length}/{core.diplomacySelection.maxTargetCount} 次外交 · 还可继续 {core.diplomacySelection.remainingTargetCount} 次
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        当前目标 {core.diplomacySelection.targetRegionName ?? '未锁定'} · {core.diplomacySelection.targetHint}
                    </div>
                    {core.diplomacySelection.resolvedSteps.length > 0 ? (
                        <div
                            className="mt-2 border-[2px] px-2 py-2 text-[11px] leading-4"
                            data-testid="qidahen-diplomacy-history"
                            style={{ borderColor: 'rgba(232,200,133,0.26)', background: 'rgba(17,11,7,0.22)', borderRadius: 3 }}
                        >
                            {core.diplomacySelection.resolvedSteps.map((step) => (
                                <div key={`${step.index}-${step.targetRegionId}`} className="mt-1 first:mt-0">
                                    外交 {step.index} · {step.summary}
                                </div>
                            ))}
                        </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {core.diplomacySelection.candidateTargetRegionIds.map((regionId) => {
                            const region = core.regions.find((item) => item.id === regionId && !item.isLogicalRegion);
                            if (!region) return null;
                            return (
                                <button
                                    key={regionId}
                                    type="button"
                                    data-testid={`qidahen-diplomacy-target-${regionId}`}
                                    className="border-[2px] px-2 py-1 text-[11px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onSelectRegion(regionId)}
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: core.diplomacySelection.targetRegionId === regionId ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paper,
                                        color: core.diplomacySelection.targetRegionId === regionId ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    {region.name}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {core.diplomacySelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-diplomacy-choice-${choice.id}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveDiplomacyChoice(choice.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {core.driveTigerConsentSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-drive-tiger-consent-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>驱虎吞狼</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {core.driveTigerConsentSelection.targetFactionName} 是否同意接受大明指挥；同意后才会抽 6 张牌并进入调度进攻。
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {core.driveTigerConsentSelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-drive-tiger-consent-choice-${choice.id}`}
                                className="border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveDriveTigerConsent(choice.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="block">
                                    {choice.label}
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {core.wheelDispatchSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-wheel-dispatch-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.wheelDispatchSelection.restriction}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        源区 {core.wheelDispatchSelection.sourceRegionName} · 可选目标 {core.wheelDispatchSelection.candidates.length} · 可直接点击地图高亮区
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {core.wheelDispatchSelection.candidates.map((candidate) => (
                            <button
                                key={candidate.targetRuntimeRegionId}
                                type="button"
                                data-testid={`qidahen-wheel-dispatch-target-${candidate.targetRuntimeRegionId}`}
                                className="inline-flex min-h-[50px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onSelectRegion(candidate.targetRuntimeRegionId)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{candidate.targetRegionName} · 防守 {candidate.defenderLabel}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {candidate.resolutionHint}
                                    </span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.cinnabar }}>
                                        源兵 {candidate.sourceAvailableTroops} · 投入 {candidate.committedTroops} · 压力 {candidate.attackPressure}
                                    </span>
                                </span>
                                <span className="shrink-0 text-[11px]" style={{ color: UI_STYLE.cinnabar }}>
                                    耗 {candidate.totalTravelCost}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {core.pendingTargetAction ? (
                <div
                    className="mt-3 border-[3px] px-3 py-2 text-[14px] font-black leading-6"
                    data-testid="qidahen-raid-intent"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.pendingTargetAction.title} · 目标 {core.pendingTargetAction.targetRegionName} · 防守 {core.pendingTargetAction.defenderLabel}</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {core.pendingTargetAction.resolutionHint}
                        {core.pendingTargetAction.defenderPayCost != null ? ` · 守方需付 ${core.pendingTargetAction.defenderPayCost}` : ''}
                    </div>
                    {core.pendingTargetAction.actionId === 'raid' || core.pendingTargetAction.actionId === 'wheel-dispatch' || core.pendingTargetAction.actionId === 'drive-tiger' ? (
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            源兵 {core.pendingTargetAction.sourceAvailableTroops} · 投入 {core.pendingTargetAction.committedTroops} · 压力 {core.pendingTargetAction.attackPressure}
                            {core.pendingTargetAction.boundaryUnitCap ? ` · 边界上限 ${core.pendingTargetAction.boundaryUnitCap}` : ''}
                        </div>
                    ) : null}
                    {getPendingCommittedTroopOptions(core).length > 1 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]" data-testid="qidahen-pending-committed-troops">
                            <span className="mr-1" style={{ color: '#f3d1a5' }}>实际投入</span>
                            {getPendingCommittedTroopOptions(core).map((committedTroops) => {
                                const selected = committedTroops === (pendingCommittedTroops ?? core.pendingTargetAction?.committedTroops);
                                return (
                                    <button
                                        key={committedTroops}
                                        type="button"
                                        data-testid={`qidahen-pending-committed-${committedTroops}`}
                                        className="inline-flex h-[28px] min-w-[34px] items-center justify-center border-[2px] px-2 text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onSelectPendingCommittedTroops(committedTroops)}
                                        style={{
                                            borderColor: selected ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                                            background: selected ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paper,
                                            color: selected ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                            boxShadow: selected ? UI_SURFACE.mapPanelShadow : UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {committedTroops}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                    {hasStructuredCasualtyChoice(core) ? (
                        <div className="mt-2 space-y-1.5 text-[11px]" data-testid="qidahen-pending-casualty-priority">
                            {[
                                {
                                    id: 'attacker' as const,
                                    label: '攻方承伤',
                                    selected: pendingAttackerCasualtyPriority,
                                    onSelect: onSelectPendingAttackerCasualtyPriority,
                                },
                                {
                                    id: 'defender' as const,
                                    label: '守方承伤',
                                    selected: pendingDefenderCasualtyPriority,
                                    onSelect: onSelectPendingDefenderCasualtyPriority,
                                },
                            ].map((group) => (
                                <div key={group.id} className="flex flex-wrap items-center gap-1.5" data-testid={`qidahen-${group.id}-casualty-priority`}>
                                    <span className="mr-1" style={{ color: '#f3d1a5' }}>{group.label}</span>
                                    {[
                                        { id: 'highest-level' as const, label: '高级先损' },
                                        { id: 'lowest-level' as const, label: '低级先损' },
                                    ].map((option) => {
                                        const selected = option.id === group.selected;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                data-testid={`qidahen-${group.id}-casualty-${option.id}`}
                                                className="inline-flex h-[28px] min-w-[54px] items-center justify-center border-[2px] px-2 text-[11px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                                onClick={() => group.onSelect(option.id)}
                                                style={{
                                                    borderColor: selected ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                                                    background: selected ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paper,
                                                    color: selected ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                                    boxShadow: selected ? UI_SURFACE.mapPanelShadow : UI_SURFACE.hardShadow,
                                                    borderRadius: 3,
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {canUseAttackerCavalryPlunder(core) ? (
                            <button
                                type="button"
                                data-testid="qidahen-resolve-pending-action-cavalry-plunder"
                                className="inline-flex h-[38px] min-w-[168px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolvePendingAction('rear-guard', false, true, 'attacker', undefined, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, pendingCommittedTroops)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                骑兵劫掠己方牌堆
                            </button>
                        ) : null}
                        {canUseAttackerCavalryPlunderDefenderDeck(core) ? (
                            <button
                                type="button"
                                data-testid="qidahen-resolve-pending-action-cavalry-plunder-defender"
                                className="inline-flex h-[38px] min-w-[180px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolvePendingAction('rear-guard', false, true, 'defender', undefined, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, pendingCommittedTroops)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                骑兵劫掠守方牌堆
                            </button>
                        ) : null}
                        {getDefenderCavalryEvasionRetreatChoices(core).map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-resolve-pending-action-cavalry-evasion-${choice.id}`}
                                className="inline-flex h-[38px] min-w-[176px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolvePendingAction('rear-guard', true, false, undefined, choice.id, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, pendingCommittedTroops)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                骑兵避战至{choice.name}
                            </button>
                        ))}
                        <button
                            type="button"
                            data-testid="qidahen-resolve-pending-action"
                            className="inline-flex h-[38px] min-w-[132px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                            onClick={() => onResolvePendingAction('rear-guard', false, false, undefined, undefined, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, pendingCommittedTroops)}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                            断后结算
                        </button>
                        <button
                            type="button"
                            data-testid="qidahen-resolve-pending-action-rout"
                            className="inline-flex h-[38px] min-w-[132px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                            onClick={() => onResolvePendingAction('rout', false, false, undefined, undefined, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, pendingCommittedTroops)}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                            溃败结算
                        </button>
                    </div>
                </div>
            ) : null}
            {core.postBattleSelection ? (
                <div
                    className="mt-3 border-[3px] px-3 py-2 text-[14px] font-black leading-6"
                    data-testid="qidahen-post-battle-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.postBattleSelection.title} · {core.postBattleSelection.targetRegionName}</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {core.postBattleSelection.summary} · 投入 {core.postBattleSelection.committedTroops}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {core.postBattleSelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-post-battle-choice-${choice.id}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolvePostBattleDecision(choice.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
);

const HandCard: React.FC<{
    card: QidahenHandCard;
    locale?: string;
    selected?: boolean;
    onClick?: () => void;
}> = ({ card, locale, selected = false, onClick }) => {
    const disabled = card.status === 'disabled';

    return (
        <button
            type="button"
            aria-label={card.label}
            disabled={disabled}
            data-testid={`qidahen-hand-card-${card.id}`}
            tabIndex={disabled ? -1 : 0}
            className="relative shrink-0 overflow-hidden transition-transform duration-150 hover:-translate-y-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30 disabled:cursor-not-allowed disabled:opacity-55"
            onClick={onClick}
            style={{
                width: CARD_DIMENSIONS.hand.width,
                height: CARD_DIMENSIONS.hand.height,
                background: 'transparent',
                boxShadow: selected ? '0 0 0 4px #f0d386, 0 12px 22px rgba(56,35,15,0.34)' : '0 8px 16px rgba(56,35,15,0.18)',
                borderRadius: 7,
            }}
        >
            <CardPreviewFit
                previewRef={card.previewRef}
                locale={locale}
                title={card.label}
                width={CARD_DIMENSIONS.hand.width}
                height={CARD_DIMENSIONS.hand.height}
                rawWidth={CARD_DIMENSIONS.hand.rawWidth}
                rawHeight={CARD_DIMENSIONS.hand.rawHeight}
            />
        </button>
    );
};

const HandZone: React.FC<{
    core: QidahenCore;
    locale?: string;
    onSelectHandLimitDiscardCard: (cardId: string) => void;
    onSelectSunYuanhuaTechCard: (cardId: string) => void;
    onSelectGaoDiDispatchCard: (cardId: string) => void;
}> = ({ core, locale, onSelectHandLimitDiscardCard, onSelectSunYuanhuaTechCard, onSelectGaoDiDispatchCard }) => {
    const currentFactionId = getCurrentFactionId(core);
    const currentFaction = core.factions[currentFactionId];
    const currentHandCards = core.handCards.filter((card) => card.faction === currentFactionId);

    return (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 h-[314px]" data-testid="qidahen-bottom-dock">
            <div className="absolute left-[44px]" data-testid="qidahen-draw-anchor" style={{ bottom: BOTTOM_DOCK_INSET }}>
                <DeckStack
                    src={CARD_BACK_BY_FACTION[currentFactionId]}
                    label={`${currentFaction.name}抽牌`}
                    count={currentFaction.drawPileCount}
                    testId="qidahen-draw-pile"
                />
            </div>
            <div
                className="absolute left-1/2 flex h-[314px] w-[1310px] max-w-[calc(100vw-360px)] items-end justify-start gap-3 overflow-x-auto overflow-y-visible px-2"
                data-testid="qidahen-hand-zone"
                data-ui-role="qidahen-hand-dock"
                style={{ bottom: BOTTOM_DOCK_INSET, transform: 'translateX(-50%)' }}
            >
                <div className="mx-auto flex min-w-max items-end justify-center gap-3" data-testid="qidahen-hand-row">
                    {currentHandCards.map((card) => {
                        const handLimitSelection = core.handLimitDiscardSelection;
                        const selectableForHandLimit = handLimitSelection?.candidateCardIds.includes(card.id) ?? false;
                        const sunYuanhuaSelection = core.sunYuanhuaTechSelection;
                        const selectableForSunYuanhua = sunYuanhuaSelection?.candidateCardIds.includes(card.id) ?? false;
                        const gaoDiSelection = core.gaoDiDispatchSelection;
                        const selectableForGaoDi = gaoDiSelection?.candidateCardIds.includes(card.id) ?? false;
                        return (
                            <HandCard
                                key={card.id}
                                card={card}
                                locale={locale}
                                selected={(handLimitSelection?.selectedCardIds.includes(card.id) ?? false) || (sunYuanhuaSelection?.selectedCardIds.includes(card.id) ?? false) || (gaoDiSelection?.selectedCardId === card.id)}
                                onClick={selectableForHandLimit
                                    ? () => onSelectHandLimitDiscardCard(card.id)
                                    : selectableForSunYuanhua
                                        ? () => onSelectSunYuanhuaTechCard(card.id)
                                    : selectableForGaoDi
                                        ? () => onSelectGaoDiDispatchCard(card.id)
                                        : undefined}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="absolute right-[44px]" data-testid="qidahen-discard-anchor" style={{ bottom: BOTTOM_DOCK_INSET }}>
                <DeckStack
                    src={ASSETS.coverCard}
                    label={`${currentFaction.name}弃牌`}
                    count={currentFaction.discardPileCount}
                    tone="red"
                    testId="qidahen-discard-pile"
                />
            </div>
        </div>
    );
};

export const QidahenBoard: React.FC<Props> = ({ G, dispatch, locale }) => {
    const core = G.core;
    const [pendingCommittedTroops, setPendingCommittedTroops] = React.useState<number | undefined>(core.pendingTargetAction?.committedTroops);
    const [pendingAttackerCasualtyPriority, setPendingAttackerCasualtyPriority] = React.useState<QidahenCasualtyPriority>('highest-level');
    const [pendingDefenderCasualtyPriority, setPendingDefenderCasualtyPriority] = React.useState<QidahenCasualtyPriority>('highest-level');
    const [upkeepAttritionPriority, setUpkeepAttritionPriority] = React.useState<QidahenCasualtyPriority>('lowest-level');

    React.useEffect(() => {
        setPendingCommittedTroops(core.pendingTargetAction?.committedTroops);
        setPendingAttackerCasualtyPriority('highest-level');
        setPendingDefenderCasualtyPriority('highest-level');
    }, [
        core.pendingTargetAction?.actionId,
        core.pendingTargetAction?.sourceRegionId,
        core.pendingTargetAction?.targetRuntimeRegionId,
        core.pendingTargetAction?.committedTroops,
    ]);

    const selectWheelMove = React.useCallback((moveId: string) => {
        dispatch(QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, { moveId });
    }, [dispatch]);

    const executeWheelMove = React.useCallback((moveId: string) => {
        dispatch(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE, { moveId });
    }, [dispatch]);

    const executeAction = React.useCallback((actionId: string) => {
        dispatch(QIDAHEN_COMMANDS.EXECUTE_ACTION, { actionId });
    }, [dispatch]);

    const resolvePendingAction = React.useCallback((retreatLossMode?: 'rear-guard' | 'rout', defenderCavalryEvasion?: boolean, attackerCavalryPlunder?: boolean, attackerCavalryPlunderSource?: QidahenPlunderSource, defenderCavalryEvasionRegionId?: string, attackerCasualtyPriority?: QidahenCasualtyPriority, defenderCasualtyPriority?: QidahenCasualtyPriority, committedTroops?: number) => {
        dispatch(
            QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            retreatLossMode || defenderCavalryEvasion || attackerCavalryPlunder || attackerCavalryPlunderSource || defenderCavalryEvasionRegionId || attackerCasualtyPriority || defenderCasualtyPriority || committedTroops
                ? {
                    ...(committedTroops ? { committedTroops } : {}),
                    ...(retreatLossMode ? { retreatLossMode } : {}),
                    ...(defenderCavalryEvasion ? { defenderCavalryEvasion } : {}),
                    ...(defenderCavalryEvasionRegionId ? { defenderCavalryEvasionRegionId } : {}),
                    ...(attackerCavalryPlunder ? { attackerCavalryPlunder } : {}),
                    ...(attackerCavalryPlunderSource ? { attackerCavalryPlunderSource } : {}),
                    ...(attackerCasualtyPriority ? { attackerCasualtyPriority } : {}),
                    ...(defenderCasualtyPriority ? { defenderCasualtyPriority } : {}),
                }
                : {},
        );
    }, [dispatch]);

    const resolveRecruitChoice = React.useCallback((choiceId: QidahenRecruitChoice['id']) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE, { choiceId });
    }, [dispatch]);

    const selectGaoDiDispatchCard = React.useCallback((cardId: string) => {
        dispatch(QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD, { cardId });
    }, [dispatch]);

    const selectSunYuanhuaTechCard = React.useCallback((cardId: string) => {
        dispatch(QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD, { cardId });
    }, [dispatch]);

    const resolveGaoDiDispatch = React.useCallback((choiceId: string) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH, { choiceId });
    }, [dispatch]);

    const resolveSunYuanhuaTech = React.useCallback((choiceId: 'confirm' | 'skip') => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH, { choiceId });
    }, [dispatch]);

    const resolveInternalDispatch = React.useCallback((choiceId: string) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH, { choiceId });
    }, [dispatch]);

    const resolveKhanEdictChoice = React.useCallback((choiceId: 'recruit-train' | 'hire-dispatch') => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE, { choiceId });
    }, [dispatch]);

    const resolveDiplomacyChoice = React.useCallback((choiceId: 'hire-only' | 'place-friendly' | 'flip-vassal' | 'remove-marker') => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE, { choiceId });
    }, [dispatch]);

    const resolveMaShiTradeChoice = React.useCallback((troopCount: 1 | 2 | 3) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE, { troopCount });
    }, [dispatch]);

    const resolveDriveTigerConsent = React.useCallback((choiceId: 'accept' | 'decline') => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT, { choiceId });
    }, [dispatch]);

    const resolveFortificationMaintenance = React.useCallback((choiceId: 'auto-pay' | 'skip-all', attritionPriority: QidahenCasualtyPriority) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE, { choiceId, attritionPriority });
    }, [dispatch]);

    const selectHandLimitDiscardCard = React.useCallback((cardId: string) => {
        dispatch(QIDAHEN_COMMANDS.SELECT_HAND_LIMIT_DISCARD_CARD, { cardId });
    }, [dispatch]);

    const resolveHandLimitDiscard = React.useCallback(() => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD, {});
    }, [dispatch]);

    const resolvePostBattleDecision = React.useCallback((choiceId: string) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION, { choiceId });
    }, [dispatch]);

    const selectRegion = React.useCallback((regionId: string) => {
        if (core.pendingTargetAction != null || core.postBattleSelection != null || core.driveTigerConsentSelection != null || core.fortificationMaintenanceSelection != null || core.handLimitDiscardSelection != null || core.sunYuanhuaTechSelection != null) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.SELECT_REGION, { regionId });
    }, [core.pendingTargetAction, core.postBattleSelection, core.driveTigerConsentSelection, core.fortificationMaintenanceSelection, core.handLimitDiscardSelection, core.sunYuanhuaTechSelection, dispatch]);

    return (
        <StageRoot>
            <MapSceneLayer core={core} locale={locale} onSelectRegion={selectRegion} />
            <PlayerFloat core={core} />
            <WheelPanel
                selectedId={core.actionWheelPosition}
                selectedMoveId={core.selectedWheelMoveId}
                moveChoices={core.wheelMoveChoices}
                moveSummary={core.wheelMoveSummary}
                disabled={core.wheelActionUsed || core.recruitSelection != null || core.sunYuanhuaTechSelection != null || core.gaoDiDispatchSelection != null || core.internalDispatchSelection != null || core.maShiTradeSelection != null || core.khanEdictSelection != null || core.diplomacySelection != null || core.fortificationMaintenanceSelection != null || core.handLimitDiscardSelection != null || core.pendingTargetAction != null || core.postBattleSelection != null}
                onSelectMove={selectWheelMove}
                onExecuteMove={executeWheelMove}
            />
            <KoreaZone core={core} locale={locale} />
            <ChronologyZone cards={core.yearCards} locale={locale} />
            <ActionsZone
                core={core}
                onExecuteAction={executeAction}
                onSelectRegion={selectRegion}
                onResolveRecruitChoice={resolveRecruitChoice}
                onResolveSunYuanhuaTech={resolveSunYuanhuaTech}
                onResolveGaoDiDispatch={resolveGaoDiDispatch}
                onResolveInternalDispatch={resolveInternalDispatch}
                onResolveMaShiTradeChoice={resolveMaShiTradeChoice}
                onResolveKhanEdictChoice={resolveKhanEdictChoice}
                onResolveDiplomacyChoice={resolveDiplomacyChoice}
                onResolveDriveTigerConsent={resolveDriveTigerConsent}
                onResolveFortificationMaintenance={resolveFortificationMaintenance}
                upkeepAttritionPriority={upkeepAttritionPriority}
                onSelectUpkeepAttritionPriority={setUpkeepAttritionPriority}
                onResolveHandLimitDiscard={resolveHandLimitDiscard}
                pendingCommittedTroops={pendingCommittedTroops}
                onSelectPendingCommittedTroops={setPendingCommittedTroops}
                pendingAttackerCasualtyPriority={pendingAttackerCasualtyPriority}
                pendingDefenderCasualtyPriority={pendingDefenderCasualtyPriority}
                onSelectPendingAttackerCasualtyPriority={setPendingAttackerCasualtyPriority}
                onSelectPendingDefenderCasualtyPriority={setPendingDefenderCasualtyPriority}
                onResolvePendingAction={resolvePendingAction}
                onResolvePostBattleDecision={resolvePostBattleDecision}
            />
            <HandZone
                core={core}
                locale={locale}
                onSelectHandLimitDiscardCard={selectHandLimitDiscardCard}
                onSelectSunYuanhuaTechCard={selectSunYuanhuaTechCard}
                onSelectGaoDiDispatchCard={selectGaoDiDispatchCard}
            />
        </StageRoot>
    );
};

export default QidahenBoard;
