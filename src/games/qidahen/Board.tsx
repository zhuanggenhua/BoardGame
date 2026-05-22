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
    QidahenCommandMap,
    QidahenCore,
    QidahenFactionId,
    QidahenHandCard,
    QidahenMapToken,
    QidahenWheelMoveChoice,
    QidahenYearCardSlot,
} from './domain';
import { QIDAHEN_COMMANDS } from './domain/commands';
import {
    QIDAHEN_MAP_HEIGHT,
    QIDAHEN_MAP_REGION_SHAPES,
    QIDAHEN_MAP_REGION_SHAPES_BY_ID,
    QIDAHEN_MAP_WIDTH,
    type QidahenMapRegionShape,
} from './ui/mapRegions';

type Props = GameBoardProps<QidahenCore, QidahenCommandMap>;

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

const ASSETS = {
    mainMap: 'qidahen/board/qidahen-main-map',
    mapCleanPatch: 'qidahen/board/left-top-clean-patch-v2',
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
const WHEEL_INNER_RADIUS = 72;
const WHEEL_OUTER_RADIUS = 176;
const WHEEL_LABEL_RADIUS = 118;
const WHEEL_SELECTED_SCALE = 1.145;
const WHEEL_SELECTED_PUSH = 15;

const UI_STYLE = {
    paper: '#f6ecd8',
    paperLight: '#fff8e9',
    cardField: '#f7ead6',
    paperDeep: '#e8d6b5',
    ink: '#2f2419',
    mutedInk: '#6f5840',
    bronze: '#8d673c',
    bronzeSoft: '#c9aa78',
    bronzeFaint: 'rgba(141,103,60,0.34)',
    cinnabar: '#b83b27',
    oldGold: '#b79a65',
    soot: '#1f1812',
    shadow: 'rgba(67,43,21,0.16)',
    shadowSoft: 'rgba(67,43,21,0.10)',
} as const;

const UI_SURFACE = {
    paper: `linear-gradient(180deg, ${UI_STYLE.paperLight} 0%, ${UI_STYLE.paper} 58%, ${UI_STYLE.paperDeep} 100%)`,
    paperQuiet: `linear-gradient(180deg, #fffaf0 0%, ${UI_STYLE.paper} 100%)`,
    paperPressed: `linear-gradient(180deg, ${UI_STYLE.paper} 0%, ${UI_STYLE.paperDeep} 100%)`,
    panelShadow: `0 6px 0 ${UI_STYLE.shadow}, 0 16px 30px ${UI_STYLE.shadowSoft}`,
    softShadow: `0 10px 22px ${UI_STYLE.shadowSoft}`,
    inkInset: `inset 0 0 0 1px rgba(255,248,233,0.78), inset 0 -3px 0 rgba(141,103,60,0.12)`,
    cutCorner: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)',
    smallCutCorner: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)',
} as const;

const CARD_DIMENSIONS = {
    deck: { width: 157, height: 218, rawWidth: 476, rawHeight: 660 },
    koreaDeck: { width: 150, height: 208, rawWidth: 476, rawHeight: 660 },
    year: { width: 154, height: 214, rawWidth: 476, rawHeight: 661 },
    hand: { width: 182, height: 252, rawWidth: 479, rawHeight: 664 },
} as const;

const BOTTOM_DOCK_INSET = 10;

const factionTone: Record<QidahenFactionId, { bg: string; border: string; text: string; chip: string }> = {
    ming: { bg: UI_STYLE.paper, border: UI_STYLE.cinnabar, text: UI_STYLE.ink, chip: ASSETS.mingMarker },
    mongol: { bg: UI_STYLE.paper, border: UI_STYLE.oldGold, text: UI_STYLE.ink, chip: ASSETS.mongolMarker },
    jin: { bg: UI_STYLE.paper, border: UI_STYLE.bronze, text: UI_STYLE.ink, chip: ASSETS.jinMarker },
};

const REGION_HIT_COLORS = QIDAHEN_MAP_REGION_SHAPES.reduce<Record<string, [number, number, number]>>((colors, shape, index) => {
    colors[shape.id] = [index + 1, 0, 0];
    return colors;
}, {});

const REGION_BY_COLOR = QIDAHEN_MAP_REGION_SHAPES.reduce<Record<number, string>>((regions, shape, index) => {
    regions[index + 1] = shape.id;
    return regions;
}, {});

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

const getSliceFocusTransform = (angle: number, scale: number, push: number) => {
    const focus = polarToPoint(WHEEL_CENTER, (WHEEL_INNER_RADIUS + WHEEL_OUTER_RADIUS) / 2, angle);
    const pushed = polarToPoint(0, push, angle);
    return [
        `translate(${pushed.x.toFixed(3)} ${pushed.y.toFixed(3)})`,
        `translate(${focus.x.toFixed(3)} ${focus.y.toFixed(3)})`,
        `scale(${scale})`,
        `translate(${-focus.x.toFixed(3)} ${-focus.y.toFixed(3)})`,
    ].join(' ');
};

const getCurrentFactionId = (core: QidahenCore): QidahenFactionId => (
    (['ming', 'mongol', 'jin'] as QidahenFactionId[])
        .find((id) => core.factions[id].playerId === core.currentPlayer) ?? 'ming'
);

const mapPath = (shape: QidahenMapRegionShape) => (
    shape.polygon.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z'
);

const buildRegionHitmap = () => {
    const canvas = document.createElement('canvas');
    canvas.width = QIDAHEN_MAP_WIDTH;
    canvas.height = QIDAHEN_MAP_HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    for (const shape of QIDAHEN_MAP_REGION_SHAPES) {
        const color = REGION_HIT_COLORS[shape.id];
        if (!color) continue;
        context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        context.beginPath();
        shape.polygon.forEach(([x, y], index) => {
            if (index === 0) {
                context.moveTo(x, y);
                return;
            }
            context.lineTo(x, y);
        });
        context.closePath();
        context.fill();
    }

    return context.getImageData(0, 0, QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT).data;
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
}> = ({ faction, current }) => {
    const tone = factionTone[faction.id];
    return (
        <div
            className="relative flex h-[70px] min-w-0 flex-1 items-center gap-3 overflow-hidden border px-4"
            data-testid={`qidahen-player-${faction.id}`}
            style={{
                borderColor: current ? tone.border : UI_STYLE.bronze,
                background: UI_SURFACE.paper,
                color: tone.text,
                boxShadow: `${UI_SURFACE.panelShadow}, ${UI_SURFACE.inkInset}`,
                clipPath: UI_SURFACE.cutCorner,
            }}
        >
            <span
                className="pointer-events-none absolute inset-y-0 left-0 w-[7px]"
                style={{ background: current ? tone.border : UI_STYLE.bronzeSoft }}
            />
            <OptimizedImage
                src={tone.chip}
                alt={faction.name}
                className="h-10 w-10 shrink-0 rounded-full border-2 object-cover"
                style={{ borderColor: tone.border, boxShadow: `0 0 0 3px ${UI_STYLE.paperLight}, 0 4px 10px ${UI_STYLE.shadowSoft}` }}
                draggable={false}
                placeholder={false}
            />
            <div className="min-w-0 flex-1 whitespace-nowrap text-[20px] font-black leading-none tracking-[0.03em]">
                <span>{faction.name}</span>
                <span className="ml-3 text-[16px]">VP{faction.vp}</span>
                <span className="ml-3 text-[16px]">{faction.handCount}/{faction.handLimit}</span>
            </div>
            {current ? (
                <span
                    className="grid h-[30px] w-[50px] shrink-0 place-items-center border text-[13px] font-black"
                    style={{ background: UI_STYLE.paperLight, borderColor: tone.border, color: tone.border, clipPath: UI_SURFACE.smallCutCorner }}
                >
                    当前
                </span>
            ) : null}
        </div>
    );
};

const PlayerFloat: React.FC<{ core: QidahenCore }> = ({ core }) => (
    <div
        className="pointer-events-auto absolute left-1/2 top-[36px] z-40 flex w-[920px] gap-3"
        data-testid="qidahen-player-float"
        data-ui-anchor="top-center"
        style={{ transform: 'translateX(-50%)' }}
    >
        {(['ming', 'mongol', 'jin'] as QidahenFactionId[]).map((id) => (
            <PlayerChip key={id} faction={core.factions[id]} current={core.currentPlayer === core.factions[id].playerId} />
        ))}
    </div>
);

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
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const hitmapRef = React.useRef<Uint8ClampedArray | null>(null);
    const [hoveredRegionId, setHoveredRegionId] = React.useState<string | null>(null);

    React.useEffect(() => {
        hitmapRef.current = buildRegionHitmap();
    }, []);

    const selectedRegion = core.regions.find((region) => region.id === core.selectedRegionId);
    const hoveredRegion = hoveredRegionId ? core.regions.find((region) => region.id === hoveredRegionId) : undefined;
    const activeRegion = hoveredRegion ?? selectedRegion;

    const getRegionFromPointer = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const hitmap = hitmapRef.current;
        if (!canvas || !hitmap) return null;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(((event.clientX - rect.left) / rect.width) * QIDAHEN_MAP_WIDTH);
        const y = Math.floor(((event.clientY - rect.top) / rect.height) * QIDAHEN_MAP_HEIGHT);
        if (x < 0 || y < 0 || x >= QIDAHEN_MAP_WIDTH || y >= QIDAHEN_MAP_HEIGHT) return null;

        const offset = (y * QIDAHEN_MAP_WIDTH + x) * 4;
        const colorKey = hitmap[offset];
        return colorKey ? REGION_BY_COLOR[colorKey] ?? null : null;
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
                <OptimizedImage
                    src={ASSETS.mapCleanPatch}
                    locale={locale}
                    alt="地图左上清理层"
                    className="pointer-events-none absolute left-0 top-0 select-none object-fill"
                    data-testid="qidahen-map-clean-patch"
                    draggable={false}
                    placeholder={false}
                    style={{ width: 560, height: 560 }}
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
                    {QIDAHEN_MAP_REGION_SHAPES.map((shape) => {
                        const selected = shape.id === core.selectedRegionId;
                        const hovered = shape.id === hoveredRegionId;
                        const pending = shape.id === core.pendingTargetAction?.targetRegionId;
                        return (
                            <path
                                key={shape.id}
                                d={mapPath(shape)}
                                data-testid={`qidahen-map-region-${shape.id}`}
                                fill={selected ? 'rgba(198,54,36,0.40)' : hovered ? 'rgba(238,190,94,0.32)' : pending ? 'rgba(184,59,39,0.24)' : 'transparent'}
                                stroke={selected ? 'rgba(255,248,233,0.96)' : hovered ? 'rgba(255,230,157,0.88)' : pending ? 'rgba(184,59,39,0.82)' : 'rgba(255,248,233,0.0)'}
                                strokeWidth={selected ? 8 : hovered ? 6 : pending ? 5 : 0}
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                                style={{
                                    filter: selected ? 'url(#qidahen-map-province-selected)' : hovered ? 'url(#qidahen-map-province-hover)' : undefined,
                                    mixBlendMode: selected || hovered || pending ? 'multiply' : undefined,
                                }}
                            />
                        );
                    })}
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
                </svg>
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
            {activeRegion && QIDAHEN_MAP_REGION_SHAPES_BY_ID.has(activeRegion.id) ? (
                <div
                    className="pointer-events-none absolute z-20 border px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-map-region-tip"
                    style={{
                        left: tipLeft,
                        top: tipTop,
                        width: 212,
                        borderColor: activeRegion.id === core.selectedRegionId ? UI_STYLE.cinnabar : UI_STYLE.bronze,
                        background: UI_SURFACE.paperQuiet,
                        color: UI_STYLE.ink,
                        boxShadow: `${UI_SURFACE.softShadow}, ${UI_SURFACE.inkInset}`,
                        clipPath: UI_SURFACE.smallCutCorner,
                    }}
                >
                    <div className="text-[16px] text-[#2f2419]">{activeRegion.name} · {activeRegion.controlLabel}</div>
                    <div className="mt-1 text-[12px] text-[#6f5840]">兵力 {activeRegion.troops} · 人口 {activeRegion.population}</div>
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
            <div className="absolute left-[14px] top-[12px] h-full w-full border" style={{ borderColor: border, background: UI_STYLE.paperDeep, clipPath: UI_SURFACE.smallCutCorner }} />
            <div className="absolute left-[7px] top-[6px] h-full w-full border" style={{ borderColor: border, background: UI_STYLE.paper, clipPath: UI_SURFACE.smallCutCorner }} />
            <div className="relative h-full w-full overflow-hidden border" style={{ borderColor: border, background: UI_STYLE.paperLight, boxShadow: `0 14px 28px ${UI_STYLE.shadow}`, clipPath: UI_SURFACE.smallCutCorner }}>
                {previewRef ? (
                    <CardPreviewFit previewRef={previewRef} locale={locale} title={label} width={width} height={height} rawWidth={rawWidth} rawHeight={rawHeight} />
                ) : src ? (
                    <OptimizedImage src={src} alt={label} className="h-full w-full object-cover" draggable={false} placeholder={false} />
                ) : null}
                <div
                    className="pointer-events-none absolute left-2 top-2 border px-2 py-0.5 text-[13px] font-black tracking-[0.05em]"
                    style={{ color: text, borderColor: border, background: UI_SURFACE.paperQuiet, clipPath: UI_SURFACE.smallCutCorner, boxShadow: UI_SURFACE.inkInset }}
                >
                    {label}
                </div>
                <div className="pointer-events-none absolute bottom-2 right-2 grid h-[42px] w-[42px] place-items-center rounded-full border-2 text-[18px] font-black" style={{ borderColor: border, color: text, background: UI_STYLE.paperLight, boxShadow: `0 4px 10px ${UI_STYLE.shadowSoft}` }}>
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
    onSelectMove: (moveId: string) => void;
    onExecuteMove: (moveId: string) => void;
}> = ({ selectedId, selectedMoveId, moveChoices, moveSummary, onSelectMove, onExecuteMove }) => {
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
            className="pointer-events-auto group absolute left-[64px] top-[56px] z-30 h-[430px] w-[430px]"
            data-testid="qidahen-action-wheel"
            data-ui-anchor="left-top"
        >
            <div
                className="relative h-[414px] w-[414px]"
                role="img"
                aria-label="七大恨行动轮盘"
                data-testid="qidahen-action-wheel-asset"
            >
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background: 'radial-gradient(circle at 47% 43%, #efe6cf 0%, #d8cbad 56%, #c3b08d 100%)',
                        boxShadow: `0 16px 28px ${UI_STYLE.shadowSoft}, inset 0 0 12px rgba(31,24,18,0.12)`,
                    }}
                />
                <svg
                    viewBox={`0 0 ${WHEEL_VIEW} ${WHEEL_VIEW}`}
                    className="absolute inset-0 h-full w-full"
                    aria-hidden="true"
                >
                    <defs>
                        <filter id="qidahen-wheel-press" x="-15%" y="-15%" width="130%" height="130%">
                            <feDropShadow dx="0" dy="2" stdDeviation="1.2" floodColor="rgba(184,59,39,0.28)" />
                        </filter>
                        <filter id="qidahen-wheel-lift" x="-25%" y="-25%" width="150%" height="150%">
                            <feDropShadow dx="0" dy="12" stdDeviation="5.2" floodColor="rgba(37,27,17,0.38)" />
                        </filter>
                        <filter id="qidahen-wheel-current" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="2.5" stdDeviation="1.4" floodColor="rgba(72,54,31,0.24)" />
                        </filter>
                        <filter id="qidahen-wheel-grain" x="-10%" y="-10%" width="120%" height="120%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" seed="17" />
                            <feColorMatrix type="saturate" values="0" />
                            <feComponentTransfer>
                                <feFuncA type="table" tableValues="0 0.12" />
                            </feComponentTransfer>
                        </filter>
                        <clipPath id="qidahen-wheel-face-clip">
                            <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_OUTER_RADIUS - 18} />
                        </clipPath>
                    </defs>
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_OUTER_RADIUS + 4} fill="rgba(239,230,207,0.56)" stroke="#241b14" strokeWidth="2.4" opacity="0.96" />
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_OUTER_RADIUS - 16} fill="none" stroke="rgba(36,27,20,0.28)" strokeWidth="1.05" />
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
                                transform={selectedTarget ? getSliceFocusTransform(sector.angle, WHEEL_SELECTED_SCALE, WHEEL_SELECTED_PUSH) : undefined}
                                filter={selectedTarget ? 'url(#qidahen-wheel-lift)' : current ? 'url(#qidahen-wheel-current)' : undefined}
                            >
                                <path
                                    d={describeAnnularSlice(WHEEL_CENTER, selectedTarget ? WHEEL_INNER_RADIUS + 2 : WHEEL_INNER_RADIUS, selectedTarget ? WHEEL_OUTER_RADIUS - 10 : WHEEL_OUTER_RADIUS - 16, sector.angle - 22.5, sector.angle + 22.5)}
                                    fill={selectedTarget ? 'rgba(206,155,88,0.88)' : current ? 'rgba(214,176,111,0.46)' : index % 2 === 0 ? 'rgba(112,104,88,0.32)' : 'rgba(89,81,68,0.25)'}
                                    stroke={selectedTarget ? 'rgba(184,59,39,0.92)' : current ? 'rgba(141,103,60,0.96)' : 'rgba(35,27,20,0.58)'}
                                    strokeWidth={selectedTarget ? 3.1 : current ? 2.6 : 1.05}
                                />
                                <text
                                    x={labelPoint.x}
                                    y={labelPoint.y - (selectedTarget ? 10 : 9)}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="fill-[#241b14]"
                                    style={{ fontSize: selectedTarget ? '17px' : '16px', fontWeight: 900, paintOrder: 'stroke', stroke: selectedTarget ? 'rgba(246,236,216,0.88)' : 'rgba(214,202,170,0.78)', strokeWidth: selectedTarget ? 2.25 : 1.95 }}
                                >
                                    {sector.label[0]}
                                </text>
                                <text
                                    x={labelPoint.x}
                                    y={labelPoint.y + (selectedTarget ? 11 : 10)}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="fill-[#241b14]"
                                    style={{ fontSize: selectedTarget ? '17px' : '16px', fontWeight: 900, paintOrder: 'stroke', stroke: selectedTarget ? 'rgba(246,236,216,0.88)' : 'rgba(214,202,170,0.78)', strokeWidth: selectedTarget ? 2.25 : 1.95 }}
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
                        style={{ fontSize: '16px', fontWeight: 900, paintOrder: 'stroke', stroke: 'rgba(214,202,170,0.72)', strokeWidth: 1.6 }}
                    >
                        新年 &gt;&gt;&gt;
                    </text>
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_VIEW - 20}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontSize: '16px', fontWeight: 900, paintOrder: 'stroke', stroke: 'rgba(214,202,170,0.72)', strokeWidth: 1.6 }}
                    >
                        年中
                    </text>
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_INNER_RADIUS - 7} fill="rgba(184,169,135,0.92)" stroke="#2f251b" strokeWidth="1.6" />
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r="18" fill="rgba(49,41,31,0.22)" />
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_CENTER - 12}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontSize: '26px', fontWeight: 900, paintOrder: 'stroke', stroke: 'rgba(214,202,170,0.75)', strokeWidth: 2.1 }}
                    >
                        行动
                    </text>
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_CENTER + 17}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontSize: '26px', fontWeight: 900, paintOrder: 'stroke', stroke: 'rgba(214,202,170,0.75)', strokeWidth: 2.1 }}
                    >
                        轮盘
                    </text>
                    <rect x="18" y="18" width={WHEEL_VIEW - 36} height={WHEEL_VIEW - 36} clipPath="url(#qidahen-wheel-face-clip)" filter="url(#qidahen-wheel-grain)" opacity="0.32" />
                    <g data-testid="qidahen-wheel-move-layer">
                        {moveChoices.map((choice) => {
                            const targetAngle = getMoveTargetAngle(choice.steps);
                            const activateMove = () => {
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
                                    className="cursor-pointer outline-none transition-[fill,stroke]"
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
                className="absolute left-[408px] top-[300px] hidden w-[238px] border px-3 py-2 text-[13px] font-black leading-5 tracking-[0.03em] group-hover:block group-focus-within:block"
                data-testid="qidahen-wheel-tip"
                role="tooltip"
                style={{
                    borderColor: UI_STYLE.bronze,
                    background: UI_SURFACE.paperQuiet,
                    color: UI_STYLE.ink,
                    boxShadow: `${UI_SURFACE.softShadow}, ${UI_SURFACE.inkInset}`,
                    clipPath: UI_SURFACE.smallCutCorner,
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
        className="relative overflow-hidden border"
        data-testid={`qidahen-year-card-slot-${card.id}`}
        style={{
            width: CARD_DIMENSIONS.year.width,
            height: CARD_DIMENSIONS.year.height,
            borderColor: UI_STYLE.bronze,
            background: UI_STYLE.paperLight,
            boxShadow: `${UI_SURFACE.softShadow}, ${UI_SURFACE.inkInset}`,
            clipPath: UI_SURFACE.smallCutCorner,
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
    <div className="pointer-events-auto absolute left-[80px] top-[472px] z-20" data-testid="qidahen-chronology-zone" data-ui-anchor="left-middle">
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
    onClick: () => void;
}> = ({ action, selected, onClick }) => (
    <button
        type="button"
        data-testid={`qidahen-action-${action.id}`}
        title={action.detail}
        className="relative inline-flex h-[50px] min-w-[146px] cursor-pointer items-center justify-start overflow-hidden border px-4 text-left text-[18px] font-black tracking-[0.03em] transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30"
        onClick={onClick}
        style={{
            borderColor: selected ? UI_STYLE.cinnabar : UI_STYLE.bronze,
            background: selected ? UI_SURFACE.paperQuiet : UI_SURFACE.paper,
            color: selected ? UI_STYLE.cinnabar : UI_STYLE.ink,
            boxShadow: `${UI_SURFACE.panelShadow}, ${UI_SURFACE.inkInset}`,
            clipPath: UI_SURFACE.cutCorner,
        }}
    >
        <span className="pointer-events-none absolute inset-y-0 left-0 w-[6px]" style={{ background: selected ? UI_STYLE.cinnabar : UI_STYLE.bronzeSoft }} />
        <span className="min-w-0 whitespace-nowrap">{action.label}</span>
    </button>
);

const ActionsZone: React.FC<{
    core: QidahenCore;
    onExecuteAction: (actionId: string) => void;
}> = ({ core, onExecuteAction }) => (
        <div
            className="pointer-events-auto absolute right-[80px] top-[396px] z-30"
            data-testid="qidahen-actions-zone"
            data-ui-anchor="right-middle"
        >
            <div className="flex flex-col items-end gap-2" data-testid="qidahen-action-rail">
                {core.actionChoices.map((action) => (
                    <ActionButton
                        key={action.id}
                        action={action}
                        selected={core.selectedActionId === action.id}
                        onClick={() => onExecuteAction(action.id)}
                    />
                ))}
            </div>
            {core.pendingTargetAction ? (
                <div
                    className="mt-3 border px-3 py-2 text-[14px] font-black leading-6"
                    data-testid="qidahen-raid-intent"
                    style={{ borderColor: UI_STYLE.cinnabar, background: UI_SURFACE.paperQuiet, color: UI_STYLE.ink, boxShadow: UI_SURFACE.inkInset, clipPath: UI_SURFACE.smallCutCorner }}
                >
                    {core.pendingTargetAction.title} · 目标 {core.pendingTargetAction.targetRegionName} · 防守 {core.pendingTargetAction.defenderLabel}
                </div>
            ) : null}
        </div>
);

const HandCard: React.FC<{
    card: QidahenHandCard;
    locale?: string;
}> = ({ card, locale }) => {
    const disabled = card.status === 'disabled';

    return (
        <button
            type="button"
            aria-label={card.label}
            disabled={disabled}
            data-testid={`qidahen-hand-card-${card.id}`}
            tabIndex={disabled ? -1 : 0}
            className="relative shrink-0 overflow-hidden border transition-transform duration-150 hover:-translate-y-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30 disabled:cursor-not-allowed disabled:opacity-55"
            style={{
                width: CARD_DIMENSIONS.hand.width,
                height: CARD_DIMENSIONS.hand.height,
                borderColor: UI_STYLE.bronzeSoft,
                background: UI_STYLE.paperLight,
                boxShadow: `0 12px 22px ${UI_STYLE.shadowSoft}`,
                clipPath: UI_SURFACE.smallCutCorner,
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
}> = ({ core, locale }) => (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 h-[314px]" data-testid="qidahen-bottom-dock">
            <div className="absolute left-[44px]" data-testid="qidahen-draw-anchor" style={{ bottom: BOTTOM_DOCK_INSET }}>
                <DeckStack src={CARD_BACK_BY_FACTION[getCurrentFactionId(core)]} label="抽牌" count={core.drawPileCount} testId="qidahen-draw-pile" />
            </div>
            <div
                className="absolute left-1/2 flex h-[314px] w-[1310px] items-end justify-center gap-3"
                data-testid="qidahen-hand-zone"
                data-ui-role="qidahen-hand-dock"
                style={{ bottom: BOTTOM_DOCK_INSET, transform: 'translateX(-50%)' }}
            >
                <div className="flex items-end justify-center gap-3" data-testid="qidahen-hand-row">
                    {core.handCards.map((card) => (
                        <HandCard key={card.id} card={card} locale={locale} />
                    ))}
                </div>
            </div>
            <div className="absolute right-[44px]" data-testid="qidahen-discard-anchor" style={{ bottom: BOTTOM_DOCK_INSET }}>
                <DeckStack src={ASSETS.coverCard} label="弃牌" count={core.discardPileCount} tone="red" testId="qidahen-discard-pile" />
            </div>
        </div>
);

export const QidahenBoard: React.FC<Props> = ({ G, dispatch, locale }) => {
    const core = G.core;

    const selectWheelMove = React.useCallback((moveId: string) => {
        dispatch(QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, { moveId });
    }, [dispatch]);

    const executeWheelMove = React.useCallback((moveId: string) => {
        dispatch(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE, { moveId });
    }, [dispatch]);

    const executeAction = React.useCallback((actionId: string) => {
        dispatch(QIDAHEN_COMMANDS.EXECUTE_ACTION, { actionId });
    }, [dispatch]);

    const selectRegion = React.useCallback((regionId: string) => {
        dispatch(QIDAHEN_COMMANDS.SELECT_REGION, { regionId });
    }, [dispatch]);

    return (
        <StageRoot>
            <MapSceneLayer core={core} locale={locale} onSelectRegion={selectRegion} />
            <PlayerFloat core={core} />
            <WheelPanel
                selectedId={core.actionWheelPosition}
                selectedMoveId={core.selectedWheelMoveId}
                moveChoices={core.wheelMoveChoices}
                moveSummary={core.wheelMoveSummary}
                onSelectMove={selectWheelMove}
                onExecuteMove={executeWheelMove}
            />
            <KoreaZone core={core} locale={locale} />
            <ChronologyZone cards={core.yearCards} locale={locale} />
            <ActionsZone core={core} onExecuteAction={executeAction} />
            <HandZone core={core} locale={locale} />
        </StageRoot>
    );
};

export default QidahenBoard;
