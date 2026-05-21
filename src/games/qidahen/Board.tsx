import React from 'react';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type { QidahenCommandMap, QidahenCore, QidahenFactionId, QidahenRegionSummary } from './domain';
import { QIDAHEN_COMMANDS } from './domain/commands';
import {
    QIDAHEN_MAP_REGION_DATA,
    type QidahenMapRegion,
    type QidahenMovementEdge,
} from './config/mapRegions';

type Props = GameBoardProps<QidahenCore, QidahenCommandMap>;

const boardImage = '/assets/i18n/zh-CN/qidahen/board/compressed/qidahen-main-map.webp';
const cardBackImage = '/assets/i18n/zh-CN/qidahen/cards/backs/compressed/qidahen-common-card-back.webp';
const BOARD_WIDTH = 1265;
const BOARD_HEIGHT = 893;

const factionTone: Record<QidahenFactionId | 'neutral', string> = {
    ming: '#a93a2f',
    mongol: '#8a642c',
    jin: '#2d628e',
    neutral: '#c4a365',
};

const factionName: Record<QidahenFactionId, string> = {
    ming: '大明',
    mongol: '蒙古',
    jin: '后金',
};

const factionText: Record<QidahenFactionId, string> = {
    ming: 'text-[#ff7869]',
    mongol: 'text-[#d8aa64]',
    jin: 'text-[#82b8df]',
};

const Panel: React.FC<{
    title: string;
    children: React.ReactNode;
    className?: string;
}> = ({ title, children, className = '' }) => (
    <section className={`border border-[#6d5433]/70 bg-[#120f0a]/88 shadow-[0_14px_34px_rgba(0,0,0,0.36)] ${className}`}>
        <header className="border-b border-[#6d5433]/60 bg-[#28130f]/86 px-3 py-2 text-[13px] font-bold tracking-[0.18em] text-[#f0d59a]">
            {title}
        </header>
        {children}
    </section>
);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distance = (touchA: React.Touch, touchB: React.Touch) => {
    const dx = touchA.clientX - touchB.clientX;
    const dy = touchA.clientY - touchB.clientY;
    return Math.sqrt(dx * dx + dy * dy);
};

const QidahenMapViewport: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const dragStartRef = React.useRef({ x: 0, y: 0 });
    const offsetStartRef = React.useRef({ x: 0, y: 0 });
    const pinchStartDistanceRef = React.useRef<number | null>(null);
    const pinchStartZoomRef = React.useRef<number | null>(null);
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
    const [offset, setOffset] = React.useState({ x: 0, y: 0 });
    const [zoom, setZoom] = React.useState(1);
    const [isDragging, setIsDragging] = React.useState(false);

    React.useEffect(() => {
        const element = containerRef.current;
        if (!element) return undefined;

        const update = () => {
            const rect = element.getBoundingClientRect();
            setContainerSize({ width: rect.width, height: rect.height });
        };

        update();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(element);
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    const baseScale = React.useMemo(() => {
        if (!containerSize.width || !containerSize.height) return 1;
        const widthFit = containerSize.width / BOARD_WIDTH;
        const heightFit = containerSize.height / BOARD_HEIGHT;
        return containerSize.width <= 1100 ? widthFit : Math.min(widthFit, heightFit);
    }, [containerSize.height, containerSize.width]);

    const scale = baseScale * zoom;

    const clampOffset = React.useCallback((nextOffset: { x: number; y: number }, nextScale = scale) => {
        if (!containerSize.width || !containerSize.height) return nextOffset;
        const scaledWidth = BOARD_WIDTH * nextScale;
        const scaledHeight = BOARD_HEIGHT * nextScale;
        const maxX = Math.max(0, (scaledWidth - containerSize.width) / 2 + 48);
        const maxY = Math.max(0, (scaledHeight - containerSize.height) / 2 + 48);
        return {
            x: clamp(nextOffset.x, -maxX, maxX),
            y: clamp(nextOffset.y, -maxY, maxY),
        };
    }, [containerSize.height, containerSize.width, scale]);

    React.useEffect(() => {
        setOffset((current) => clampOffset(current));
    }, [clampOffset]);

    const updateZoom = React.useCallback((nextZoom: number) => {
        const clampedZoom = clamp(nextZoom, 0.72, 3.4);
        setZoom(clampedZoom);
        setOffset((current) => clampOffset(current, baseScale * clampedZoom));
    }, [baseScale, clampOffset]);

    React.useEffect(() => {
        const element = containerRef.current;
        if (!element) return undefined;

        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            updateZoom(zoom + (event.deltaY > 0 ? -0.08 : 0.08));
        };

        element.addEventListener('wheel', handleWheel, { passive: false });
        return () => element.removeEventListener('wheel', handleWheel);
    }, [updateZoom, zoom]);

    const beginDrag = (clientX: number, clientY: number) => {
        dragStartRef.current = { x: clientX, y: clientY };
        offsetStartRef.current = offset;
        setIsDragging(true);
    };

    const moveDrag = (clientX: number, clientY: number) => {
        if (!isDragging) return;
        const dx = clientX - dragStartRef.current.x;
        const dy = clientY - dragStartRef.current.y;
        setOffset(clampOffset({
            x: offsetStartRef.current.x + dx,
            y: offsetStartRef.current.y + dy,
        }));
    };

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full overflow-hidden select-none"
            data-testid="qidahen-map-container"
            onMouseDown={(event) => {
                if (event.button !== 0) return;
                beginDrag(event.clientX, event.clientY);
            }}
            onMouseMove={(event) => moveDrag(event.clientX, event.clientY)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onTouchStart={(event) => {
                if (event.touches.length === 2) {
                    pinchStartDistanceRef.current = distance(event.touches[0], event.touches[1]);
                    pinchStartZoomRef.current = zoom;
                    setIsDragging(false);
                    return;
                }
                const touch = event.touches[0];
                if (touch) beginDrag(touch.clientX, touch.clientY);
            }}
            onTouchMove={(event) => {
                if (event.touches.length === 2 && pinchStartDistanceRef.current && pinchStartZoomRef.current) {
                    event.preventDefault();
                    const nextDistance = distance(event.touches[0], event.touches[1]);
                    updateZoom(pinchStartZoomRef.current * (nextDistance / pinchStartDistanceRef.current));
                    return;
                }
                const touch = event.touches[0];
                if (touch) moveDrag(touch.clientX, touch.clientY);
            }}
            onTouchEnd={() => {
                pinchStartDistanceRef.current = null;
                pinchStartZoomRef.current = null;
                setIsDragging(false);
            }}
            style={{
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
            }}
        >
            <div
                className="pointer-events-none absolute left-3 top-3 z-20 rounded-lg border border-white/20 bg-black/70 px-3 py-1.5 text-sm font-bold text-white shadow-lg"
                data-testid="qidahen-map-scale"
            >
                {Math.round(zoom * 100)}%
            </div>
            <div
                className="absolute left-1/2 top-1/2 origin-center"
                data-testid="qidahen-map-content"
                style={{
                    width: BOARD_WIDTH,
                    height: BOARD_HEIGHT,
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transition: isDragging ? 'none' : 'transform 90ms ease-out',
                    willChange: isDragging ? 'transform' : 'auto',
                }}
            >
                {children}
            </div>
        </div>
    );
};

const FactionSummary: React.FC<{
    faction: QidahenCore['factions'][QidahenFactionId];
}> = ({ faction }) => (
    <div className="border-b border-[#4e3a24]/70 px-3 py-2.5 last:border-b-0">
        <div className={`${faction.colorClass} -mx-3 -mt-2.5 mb-2 flex items-center justify-between px-3 py-1.5 text-[#f7e7bd]`}>
            <span className="text-[18px] font-black tracking-[0.12em]">{faction.name}</span>
            <span className="text-[11px] opacity-80">手牌 {faction.handCount}/{faction.handLimit}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[12px] text-[#d7c39a]">
            <span>兵力 <b className="text-[#f4dfab]">{faction.troops}</b></span>
            <span>粮草 <b className="text-[#f4dfab]">{faction.grain}</b></span>
            <span>土气 <b className="text-[#f4dfab]">{faction.landTax}</b></span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
            {Array.from({ length: 3 }, (_, index) => (
                <span
                    key={index}
                    className={`h-3 w-3 rotate-45 border ${index < faction.actionDiamonds ? 'border-[#c75a42] bg-[#9f3a2e]' : 'border-[#b58b4f]/80 bg-transparent'}`}
                />
            ))}
        </div>
    </div>
);

const RegionMarker: React.FC<{
    region: QidahenRegionSummary;
    selected: boolean;
    onSelect: (regionId: string) => void;
}> = ({ region, selected, onSelect }) => (
    <button
        type="button"
        className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%` }}
        onClick={(event) => {
            event.stopPropagation();
            onSelect(region.id);
        }}
        aria-label={`选择${region.name}`}
    >
        <span
            className={`relative grid min-h-9 min-w-9 place-items-center rounded-sm border-2 px-2 text-[13px] font-black text-[#f4e2ad] shadow-[0_5px_12px_rgba(0,0,0,0.38)] transition ${selected ? 'scale-110 border-[#f2c064] bg-[#5a2a18]' : 'border-black/60 bg-[#2a2117]/88'}`}
            style={{ outline: selected ? `3px solid ${factionTone[region.controller]}` : undefined }}
        >
            <span className="absolute -right-2 -top-2 rounded-full border border-black/70 px-1.5 text-[11px] text-white" style={{ backgroundColor: factionTone[region.controller] }}>
                {region.troops ?? region.population ?? 0}
            </span>
            {region.name}
        </span>
    </button>
);

const ActionWheelMini: React.FC<{ current: string }> = ({ current }) => {
    const items = ['征兵', '外交', '征收', '调度', '演练', '迂逃', '计策', '间谋'];
    return (
        <div className="relative mx-auto grid h-48 w-48 place-items-center rounded-full border-2 border-[#a98045] bg-[#2a2117] shadow-inner">
            <div className="grid h-20 w-20 place-items-center rounded-full border border-[#d2a95b] bg-[#5a3a1d] text-center text-[15px] font-black leading-tight text-[#f7df9f]">
                行动<br />轮盘
            </div>
            {items.map((item, index) => {
                const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
                const active = item === current;
                return (
                    <div
                        key={item}
                        className={`absolute rounded px-1.5 py-0.5 text-[12px] font-bold ${active ? 'bg-[#8f2f24] text-[#ffe2ad]' : 'text-[#cdb58a]'}`}
                        style={{
                            left: `calc(50% + ${Math.cos(angle) * 70}px)`,
                            top: `calc(50% + ${Math.sin(angle) * 70}px)`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        {item}
                    </div>
                );
            })}
        </div>
    );
};

const canonicalEdgeId = (fromRegionId: string, toRegionId: string) => (
    [fromRegionId, toRegionId].sort().join('__')
);

const edgeLabelPoint = (from: QidahenMapRegion, to: QidahenMapRegion) => ({
    x: (from.labelPoint.x + to.labelPoint.x) / 2,
    y: (from.labelPoint.y + to.labelPoint.y) / 2,
});

const buildRegionDataExport = (
    regions: QidahenMapRegion[],
    edges: QidahenMovementEdge[],
) => {
    const movementByRegionId: Record<string, Record<string, number>> = {};
    const adjacencyByRegionId: Record<string, Set<string>> = {};

    for (const region of regions) {
        movementByRegionId[region.id] = {};
        adjacencyByRegionId[region.id] = new Set();
    }

    for (const edge of edges) {
        movementByRegionId[edge.fromRegionId][edge.toRegionId] = edge.cost;
        adjacencyByRegionId[edge.fromRegionId].add(edge.toRegionId);
        if (edge.bidirectional) {
            movementByRegionId[edge.toRegionId][edge.fromRegionId] = edge.cost;
            adjacencyByRegionId[edge.toRegionId].add(edge.fromRegionId);
        }
    }

    return {
        ...QIDAHEN_MAP_REGION_DATA,
        regions: regions.map((region) => ({
            ...region,
            adjacentRegionIds: Array.from(adjacencyByRegionId[region.id]).sort(),
            movementCostByRegionId: Object.fromEntries(
                Object.entries(movementByRegionId[region.id]).sort(([left], [right]) => left.localeCompare(right)),
            ),
        })),
        movementEdges: edges,
    };
};

const QidahenMapCostEditor: React.FC<{
    selectedRegionId: string;
    onSelectRegion: (regionId: string) => void;
}> = ({ selectedRegionId, onSelectRegion }) => {
    const regions = QIDAHEN_MAP_REGION_DATA.regions;
    const regionById = React.useMemo(() => new Map(regions.map((region) => [region.id, region])), [regions]);
    const [sourceRegionId, setSourceRegionId] = React.useState(selectedRegionId);
    const [targetRegionId, setTargetRegionId] = React.useState<string | null>(null);
    const [edges, setEdges] = React.useState<QidahenMovementEdge[]>(() => QIDAHEN_MAP_REGION_DATA.movementEdges);
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        if (selectedRegionId) setSourceRegionId(selectedRegionId);
    }, [selectedRegionId]);

    const selectedSource = regionById.get(sourceRegionId) ?? regions[0];
    const outgoingEdges = edges.filter((edge) => (
        edge.fromRegionId === sourceRegionId || (edge.bidirectional && edge.toRegionId === sourceRegionId)
    ));
    const exportData = React.useMemo(() => buildRegionDataExport(regions, edges), [edges, regions]);
    const exportText = React.useMemo(() => JSON.stringify(exportData, null, 2), [exportData]);

    const upsertEdge = React.useCallback((fromRegionId: string, toRegionId: string, cost: number) => {
        if (fromRegionId === toRegionId) return;
        const id = canonicalEdgeId(fromRegionId, toRegionId);
        setEdges((current) => {
            const existing = current.find((edge) => edge.id === id);
            if (existing) {
                return current.map((edge) => (
                    edge.id === id
                        ? { ...edge, cost: clamp(Math.round(cost), 1, 9) }
                        : edge
                ));
            }
            return [
                ...current,
                {
                    id,
                    fromRegionId,
                    toRegionId,
                    cost: clamp(Math.round(cost), 1, 9),
                    bidirectional: true,
                },
            ].sort((left, right) => left.id.localeCompare(right.id));
        });
    }, []);

    const removeEdge = React.useCallback((edgeId: string) => {
        setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    }, []);

    const handleRegionPick = React.useCallback((regionId: string) => {
        onSelectRegion(regionId);
        if (!sourceRegionId || sourceRegionId === regionId) {
            setSourceRegionId(regionId);
            setTargetRegionId(null);
            return;
        }
        setTargetRegionId(regionId);
        upsertEdge(sourceRegionId, regionId, 1);
    }, [onSelectRegion, sourceRegionId, upsertEdge]);

    const handleCopy = React.useCallback(async () => {
        try {
            await navigator.clipboard?.writeText(exportText);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        } catch {
            setCopied(false);
        }
    }, [exportText]);

    return (
        <>
            <svg
                className="absolute inset-0 z-10 h-full w-full"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                data-testid="qidahen-map-cost-editor-overlay"
            >
                {regions.map((region) => {
                    const selected = region.id === sourceRegionId;
                    const target = region.id === targetRegionId;
                    return (
                        <polygon
                            key={region.id}
                            points={region.polygon.map((point) => `${point.x},${point.y}`).join(' ')}
                            className="cursor-crosshair"
                            fill={selected ? 'rgba(190, 68, 46, 0.26)' : target ? 'rgba(223, 173, 83, 0.24)' : 'rgba(23, 17, 10, 0.06)'}
                            stroke={selected ? '#f0b35f' : target ? '#ffe2a8' : '#b8884b'}
                            strokeWidth={selected || target ? 0.004 : 0.002}
                            vectorEffect="non-scaling-stroke"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleRegionPick(region.id);
                            }}
                        />
                    );
                })}
                {edges.map((edge) => {
                    const from = regionById.get(edge.fromRegionId);
                    const to = regionById.get(edge.toRegionId);
                    if (!from || !to) return null;
                    const active = edge.fromRegionId === sourceRegionId
                        || edge.toRegionId === sourceRegionId
                        || edge.toRegionId === targetRegionId
                        || edge.fromRegionId === targetRegionId;
                    return (
                        <line
                            key={edge.id}
                            x1={from.labelPoint.x}
                            y1={from.labelPoint.y}
                            x2={to.labelPoint.x}
                            y2={to.labelPoint.y}
                            stroke={active ? '#ffd071' : '#d35642'}
                            strokeWidth={active ? 0.005 : 0.003}
                            strokeDasharray={active ? '0.015 0.008' : undefined}
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                        />
                    );
                })}
            </svg>
            <div className="pointer-events-none absolute inset-0 z-20">
                {edges.map((edge) => {
                    const from = regionById.get(edge.fromRegionId);
                    const to = regionById.get(edge.toRegionId);
                    if (!from || !to) return null;
                    const label = edgeLabelPoint(from, to);
                    return (
                        <div
                            key={edge.id}
                            className="absolute grid h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#ffe0a2] bg-[#3b1711]/95 px-2 text-[12px] font-black text-[#ffe4ad] shadow-[0_4px_12px_rgba(0,0,0,0.42)]"
                            style={{ left: `${label.x * 100}%`, top: `${label.y * 100}%` }}
                            data-testid={`qidahen-map-cost-label-${edge.id}`}
                        >
                            {edge.cost}
                        </div>
                    );
                })}
            </div>
            <aside
                className="absolute right-3 top-3 z-40 flex max-h-[calc(100%-24px)] w-[360px] flex-col border border-[#c18b4c] bg-[#120d08]/96 shadow-[0_18px_44px_rgba(0,0,0,0.52)]"
                data-testid="qidahen-map-cost-editor"
            >
                <div className="border-b border-[#6d5433] bg-[#421b13] px-3 py-2">
                    <div className="text-[13px] font-black tracking-[0.18em] text-[#ffe2ad]">区域移动代价编辑</div>
                    <div className="mt-1 text-[11px] text-[#d9bd85]">源区域：{selectedSource?.name ?? '未选择'}，点击地图区域可建立/选中边。</div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <div className="grid grid-cols-3 gap-1.5">
                        {regions.map((region) => (
                            <button
                                key={region.id}
                                type="button"
                                className={`border px-2 py-1.5 text-[12px] font-bold ${region.id === sourceRegionId ? 'border-[#f0c36a] bg-[#6f2a1f] text-[#ffe2ad]' : 'border-[#5b4329] bg-[#1d160f] text-[#d8bf8c]'}`}
                                onClick={() => {
                                    setSourceRegionId(region.id);
                                    setTargetRegionId(null);
                                    onSelectRegion(region.id);
                                }}
                            >
                                {region.name}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 border border-[#4a3824] bg-black/24 p-2">
                        <div className="mb-2 text-[12px] font-bold text-[#f0c989]">相邻区域与移动代价</div>
                        {outgoingEdges.length > 0 ? (
                            <div className="space-y-2">
                                {outgoingEdges.map((edge) => {
                                    const otherRegionId = edge.fromRegionId === sourceRegionId ? edge.toRegionId : edge.fromRegionId;
                                    const otherRegion = regionById.get(otherRegionId);
                                    return (
                                        <div
                                            key={edge.id}
                                            className="grid grid-cols-[1fr_70px_52px] items-center gap-2"
                                            data-testid={`qidahen-map-cost-edge-row-${edge.id}`}
                                        >
                                            <span className="truncate text-[12px] text-[#dec58e]">{otherRegion?.name ?? otherRegionId}</span>
                                            <input
                                                className="h-8 border border-[#755632] bg-[#20150d] px-2 text-center text-[14px] font-black text-[#ffe2ad]"
                                                type="number"
                                                min={1}
                                                max={9}
                                                value={edge.cost}
                                                aria-label={`${otherRegion?.name ?? otherRegionId} 移动代价`}
                                                onChange={(event) => upsertEdge(edge.fromRegionId, edge.toRegionId, Number(event.target.value))}
                                            />
                                            <button
                                                type="button"
                                                className="h-8 border border-[#5d3328] bg-[#2a1812] text-[12px] font-bold text-[#d9a081]"
                                                data-testid={`qidahen-map-cost-edge-delete-${edge.id}`}
                                                onClick={() => removeEdge(edge.id)}
                                            >
                                                删除
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-[12px] text-[#9f875e]">当前源区域还没有移动边。</div>
                        )}
                    </div>

                    <div className="mt-3 border border-[#4a3824] bg-black/24 p-2">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-bold text-[#f0c989]">新增/更新边</span>
                            <span className="text-[11px] text-[#9f875e]">默认双向</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {regions.filter((region) => region.id !== sourceRegionId).map((region) => {
                                const edgeId = canonicalEdgeId(sourceRegionId, region.id);
                                const exists = edges.some((edge) => edge.id === edgeId);
                                return (
                                    <button
                                        key={region.id}
                                        type="button"
                                        className={`border px-2 py-1.5 text-[12px] ${exists ? 'border-[#ba6a3e] bg-[#3a1a12] text-[#ffd6a0]' : 'border-[#4d3b28] bg-[#17120d] text-[#cbb58a]'}`}
                                        onClick={() => {
                                            setTargetRegionId(region.id);
                                            upsertEdge(sourceRegionId, region.id, exists ? edges.find((edge) => edge.id === edgeId)?.cost ?? 1 : 1);
                                        }}
                                    >
                                        {exists ? '更新 ' : '连接 '}{region.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-bold text-[#f0c989]">导出 JSON</span>
                            <button
                                type="button"
                                className="border border-[#8f6a3b] bg-[#2c2115] px-2 py-1 text-[12px] font-bold text-[#f2d392]"
                                onClick={handleCopy}
                            >
                                {copied ? '已复制' : '复制'}
                            </button>
                        </div>
                        <textarea
                            className="h-44 w-full resize-none border border-[#4a3824] bg-[#100c08] p-2 font-mono text-[11px] leading-4 text-[#d9c193]"
                            value={exportText}
                            readOnly
                            data-testid="qidahen-map-cost-export"
                        />
                    </div>
                </div>
            </aside>
        </>
    );
};

export const QidahenBoard: React.FC<Props> = ({ G, dispatch }) => {
    const core = G.core;
    const selectedRegion = core.regions.find((region) => region.id === core.selectedRegionId) ?? core.regions[0];
    const mapCostEditorEnabled = React.useMemo(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search);
        return params.get('mapCostEditor') === '1'
            || window.localStorage.getItem('qidahen_map_cost_editor') === '1';
    }, []);

    const selectRegion = React.useCallback((regionId: string) => {
        dispatch(QIDAHEN_COMMANDS.SELECT_REGION, { regionId });
    }, [dispatch]);

    const confirmPreviewAction = React.useCallback(() => {
        dispatch(QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION, { actionId: core.actionWheelPosition });
    }, [core.actionWheelPosition, dispatch]);

    return (
        <div className="relative h-full min-h-0 overflow-hidden bg-[#0b0906] text-[#ead8ad]" data-testid="qidahen-board">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_38%,rgba(174,112,51,0.20),transparent_34%),linear-gradient(180deg,rgba(10,8,5,0.58),rgba(10,8,5,0.18)_28%,rgba(10,8,5,0.72))]" />

            <div className="relative z-10 grid h-full min-h-0 grid-cols-[234px_minmax(0,1fr)_276px] grid-rows-[38px_minmax(0,1fr)_172px] gap-1.5 p-1.5 max-[1100px]:grid-cols-[minmax(0,1fr)] max-[1100px]:grid-rows-[34px_minmax(0,1fr)_164px]">
                <div className="col-span-3 flex items-center justify-between border border-[#6d5433]/70 bg-[#0e0c08]/92 px-3 text-[13px] text-[#d9c59a] max-[1100px]:col-span-1">
                    <div className="flex min-w-0 items-center gap-4">
                        <span>对局：七大恨</span>
                        <span>房间号：73218</span>
                        <span>{core.turnLabel}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden text-[#f1d493] sm:inline">行动顺序</span>
                        {(['ming', 'mongol', 'jin'] as QidahenFactionId[]).map((id) => (
                            <span key={id} className={`rounded-full px-3 py-1 text-xs font-bold text-white ${core.factions[id].colorClass}`}>
                                {factionName[id]}
                            </span>
                        ))}
                        <span className="rounded border border-[#6d5433] px-2 py-1 text-[#f1d493]">重置视角</span>
                        <span className="rounded border border-[#6d5433] px-2 py-1 text-[#f1d493]">聚焦</span>
                    </div>
                </div>

                <aside className="min-h-0 overflow-hidden max-[1100px]:hidden">
                    <Panel title="当前年度">
                        <div className="px-4 py-4 text-center">
                            <div className="text-2xl font-black tracking-[0.2em] text-[#f5dfad]">{core.currentYear.split(' ')[0]}</div>
                            <div className="mt-1 text-[22px] font-bold text-[#f5dfad]">{core.currentYear.split(' ')[1]}</div>
                        </div>
                    </Panel>
                    <Panel title="行动轮盘" className="mt-1.5">
                        <div className="p-3">
                            <div className="mb-2 text-center text-xs text-[#c9aa78]">当前：{core.actionWheelPosition}</div>
                            <ActionWheelMini current={core.actionWheelPosition} />
                        </div>
                    </Panel>
                    <Panel title="势力状态" className="mt-1.5">
                        {(['ming', 'mongol', 'jin'] as QidahenFactionId[]).map((id) => (
                            <FactionSummary key={id} faction={core.factions[id]} />
                        ))}
                    </Panel>
                </aside>

                <main className="relative min-h-0 overflow-hidden border border-[#6d5433]/70 bg-[#14100b]">
                    <QidahenMapViewport>
                        <div className="relative w-[1265px]">
                            <img
                                src={boardImage}
                                alt="七大恨主地图"
                                className="block w-[1265px] max-w-none select-none"
                                draggable={false}
                            />
                            <div className="absolute inset-0">
                                {mapCostEditorEnabled ? (
                                    <QidahenMapCostEditor
                                        selectedRegionId={selectedRegion.id}
                                        onSelectRegion={selectRegion}
                                    />
                                ) : null}
                                {core.regions.map((region) => (
                                    <RegionMarker
                                        key={region.id}
                                        region={region}
                                        selected={region.id === selectedRegion.id}
                                        onSelect={selectRegion}
                                    />
                                ))}
                                {selectedRegion ? (
                                    <div
                                        className="absolute max-w-[270px] -translate-x-1/2 rounded border border-[#d1a65d]/80 bg-[#17110a]/94 px-3 py-2 text-left shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
                                        style={{ left: `${selectedRegion.x * 100}%`, top: `${Math.max(0.08, selectedRegion.y - 0.16) * 100}%` }}
                                    >
                                        <div className="text-[16px] font-black text-[#f3d18f]">{selectedRegion.name}</div>
                                        <div className="mt-1 text-[12px] leading-5 text-[#d5c098]">{selectedRegion.note}</div>
                                        <div className="mt-1 text-[11px] leading-4 text-[#bfa875]">
                                            移动代价：{Object.entries(selectedRegion.movementCostByRegionId)
                                                .map(([regionId, cost]) => `${core.regions.find((item) => item.id === regionId)?.name ?? regionId} ${cost}`)
                                                .join(' / ') || '未标注'}
                                        </div>
                                        <button className="mt-2 rounded border border-[#9d3f32] bg-[#64251e] px-2 py-1 text-[12px] text-[#ffe0ad]">
                                            查看区域详情
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </QidahenMapViewport>
                    <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-[#7d613b] bg-[#13100c]/92 px-3 py-2 text-xs text-[#d8bd83]">
                        拖拽地图 · 滚轮/双指缩放 · 点击区域
                    </div>
                </main>

                <aside className="min-h-0 overflow-hidden max-[1100px]:hidden">
                    <Panel title="待处理">
                        <div className="space-y-2 p-2">
                            {core.pendingEffects.map((effect) => (
                                <div key={effect.id} className="border border-[#40311f] bg-[#221b13] px-3 py-2">
                                    <div className="flex items-center justify-between text-sm font-bold text-[#f0c989]">
                                        <span>{effect.title}</span>
                                        <span>⌛ {effect.timer}</span>
                                    </div>
                                    <div className="mt-1 text-xs text-[#bda880]">{effect.detail}</div>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel title="战斗" className="mt-1.5">
                        <div className="p-3 text-center">
                            <div className="text-lg font-black text-[#f0d59a]">{core.battlePreview.regionName} 之战</div>
                            <div className="mt-1 text-xs text-[#c9aa78]">
                                攻方：<span className={factionText[core.battlePreview.attacker]}>{factionName[core.battlePreview.attacker]}</span>
                                <span className="mx-2">守方：</span>
                                <span className={factionText[core.battlePreview.defender]}>{factionName[core.battlePreview.defender]}</span>
                            </div>
                            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                <div className="text-2xl font-black text-[#d95845]">{core.battlePreview.attackerStrength}</div>
                                <div className="text-[#e5c178]">⚔</div>
                                <div className="text-2xl font-black text-[#d1a35d]">{core.battlePreview.defenderStrength}</div>
                            </div>
                            <div className="mt-3 rounded border border-[#64452b] bg-black/30 px-2 py-1 text-xs text-[#dbc28e]">战场：{core.battlePreview.phase}</div>
                        </div>
                    </Panel>

                    <Panel title="行动记录" className="mt-1.5 flex max-h-[calc(100%-246px)] min-h-0 flex-col">
                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                            {core.actionLog.map((entry) => (
                                <div key={entry.id} className="border-b border-[#3b2d1d] pb-2 text-[12px] leading-5 text-[#cdb78b]">
                                    <span className={`${factionText[entry.faction]} font-bold`}>{factionName[entry.faction]}</span>
                                    <span className="ml-1">{entry.text.replace(factionName[entry.faction], '')}</span>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </aside>

                <section className="col-span-2 min-h-0 border border-[#6d5433]/70 bg-[#110e09]/94 max-[1100px]:col-span-1">
                    <div className="grid h-full grid-cols-[160px_minmax(0,1fr)_330px] gap-2 p-2 max-[1100px]:grid-cols-[minmax(0,1fr)_280px] max-[760px]:grid-cols-[minmax(0,1fr)]">
                        <div className="grid place-items-center border border-[#3f3122] bg-[#17120d] text-2xl font-black tracking-[0.28em] text-[#b99458] max-[1100px]:hidden">手牌</div>
                        <div className="min-w-0 overflow-x-auto">
                            <div className="flex h-full min-w-max items-center gap-2">
                                {core.handCards.map((card) => (
                                    <button key={card.id} type="button" className="relative h-[142px] w-[92px] shrink-0 overflow-hidden border border-[#9c7946] bg-[#e8d19b] text-left text-[#28170f] shadow-[0_8px_18px_rgba(0,0,0,0.36)]">
                                        <div className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full border border-[#6f4d23] bg-[#f3dda5] text-sm font-black">{card.cost}</div>
                                        <div className="h-10 bg-[#6b2b20]" />
                                        <div className="px-2 pt-7">
                                            <div className="text-sm font-black">{card.title}</div>
                                            <div className="mt-1 text-[10px] text-[#7b5d38]">{card.type}</div>
                                            <div className="mt-2 text-[11px] leading-4">{card.text}</div>
                                        </div>
                                    </button>
                                ))}
                                <div className="h-[142px] w-[92px] shrink-0 overflow-hidden border border-[#6d5433] bg-[#18120c]">
                                    <img src={cardBackImage} alt="牌背" className="h-full w-full object-cover opacity-80" draggable={false} />
                                </div>
                            </div>
                        </div>
                        <div className="border border-[#3f3122] bg-[#17120d] p-3 max-[760px]:hidden">
                            <div className="mb-2 hidden border-b border-[#3b2d1d] pb-2 max-[1100px]:block">
                                <div className="mb-1 text-[11px] font-bold tracking-[0.14em] text-[#f0c989]">行动记录</div>
                                {core.actionLog.slice(0, 2).map((entry) => (
                                    <div key={entry.id} className="truncate text-[11px] leading-4 text-[#cdb78b]">
                                        <span className={`${factionText[entry.faction]} font-bold`}>{factionName[entry.faction]}</span>
                                        <span className="ml-1">{entry.text.replace(factionName[entry.faction], '')}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="text-xs text-[#c9aa78]">已触行动：调兵遣将</div>
                            <div className="mt-2 text-sm text-[#f0d59a]">消耗行动点：◆ ◆</div>
                            <div className="mt-4 flex gap-2">
                                <button type="button" className="flex-1 border border-[#ad4938] bg-[#7a2f25] px-4 py-3 text-lg font-black text-[#ffe1ae]" onClick={confirmPreviewAction}>确认</button>
                                <button type="button" className="flex-1 border border-[#5d4a31] bg-[#20180f] px-4 py-3 text-lg font-black text-[#d4bd8b]">取消</button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="min-h-0 border border-[#6d5433]/70 bg-[#120f0a]/94 p-3 max-[1100px]:hidden">
                    <button type="button" className="grid h-full w-full place-items-center rounded-full border-2 border-[#8a632f] bg-[#23160d] text-3xl font-black tracking-[0.18em] text-[#d2a35b] shadow-inner" onClick={confirmPreviewAction}>
                        结束<br />行动
                    </button>
                </section>
            </div>
        </div>
    );
};

export default QidahenBoard;
