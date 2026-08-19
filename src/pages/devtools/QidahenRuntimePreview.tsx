import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Eye, Pencil, RefreshCcw, Route } from 'lucide-react';
import {
    normalizeQidahenRegionMaskRuntimeGuideCandidates,
    type QidahenRegionMaskRuntimeGuideCandidate,
} from '../../games/qidahen/regionAuthoritativeGuideFormats';
import { buildQidahenSharedPrintedRegionMappings } from '../../games/qidahen/sharedPrintedRegionMappings';
import { readQidahenRegionMaskLoadPayload } from '../../games/qidahen/regionMaskWorkspaceBridge';
import {
    getQidahenBoundaryTypeMeta,
    parseQidahenRegionGraph,
    QIDAHEN_RUNTIME_REGION_DEFINITIONS,
    type QidahenRegionGraph,
    type QidahenRegionGraphNode,
} from '../../games/qidahen/ui/mapGraph';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from '../../games/qidahen/ui/mapRegions';
import {
    buildQidahenSharedPrintedRuntimePreviews,
    type QidahenSharedPrintedRuntimePreview,
} from '../../games/qidahen/ui/sharedPrintedRuntimePreview';

const DEFAULT_WORKSPACE = 'best-available-move-cost-ready';
const DEFAULT_MAP_PATH = '/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png';
const LOAD_ENDPOINT = '/devtools/qidahen-region-mask/load';

const BOUNDARY_TYPE_RUNTIME_COLORS: Record<string, string> = {
    plain: 'rgba(218,175,83,0.88)',
    mountain: 'rgba(118,151,130,0.94)',
    river: 'rgba(83,151,188,0.94)',
    coast: 'rgba(74,144,201,0.94)',
    'wall-convex': 'rgba(168,103,51,0.94)',
    'wall-flat': 'rgba(184,128,74,0.94)',
    city: 'rgba(184,65,45,0.96)',
    shanhaiguan: 'rgba(210,194,121,0.94)',
};

const NODE_LABEL_OFFSETS: Record<string, { x: number; y: number }> = {
    jinzhou: { x: 0, y: -18 },
    'song-jin': { x: 0, y: 30 },
    'shan-hai-guan': { x: 0, y: -18 },
    'xian-xing': { x: 0, y: -18 },
    'shou-cheng': { x: 0, y: -18 },
};

const EDGE_LABEL_OFFSETS: Record<string, { x: number; y: number }> = {
    'jinzhou::shan-hai-guan': { x: -14, y: 22 },
    'jinzhou::song-jin': { x: 10, y: 4 },
    'shan-hai-guan::song-jin': { x: -8, y: 26 },
    'shou-cheng::xian-xing': { x: 6, y: 2 },
};

const sanitizeWorkspaceKey = (value: string) => (
    value
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80)
);

const workspaceAssetUrl = (workspace: string, fileName: string, nonce: number) => (
    `/temp/devtools/qidahen-region-mask-workspaces/${encodeURIComponent(workspace)}/${fileName}?t=${nonce}`
);

const createImageDataFromPixels = (
    pixels: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
): ImageData => {
    const clampedPixels = new Uint8ClampedArray(pixels.byteLength);
    clampedPixels.set(pixels);
    return new ImageData(clampedPixels, width, height);
};

type RuntimeGuideCandidate = QidahenRegionMaskRuntimeGuideCandidate;

type SharedPrintedRuntimePreviewCard = {
    printedRegionId: string;
    imageUrl: string;
    preview: QidahenSharedPrintedRuntimePreview;
};

const normalizeLoadedRuntimeGuideCandidates = (value: unknown) => {
    return normalizeQidahenRegionMaskRuntimeGuideCandidates(value);
};

type PreviewState = {
    graph: QidahenRegionGraph | null;
    workspace: string;
    runtimeGuideCandidates: RuntimeGuideCandidate[];
    error: string | null;
    loading: boolean;
    loadedAtLabel: string;
};

type QidahenRuntimePreviewDebugSnapshot = {
    workspace: string;
    loading: boolean;
    error: string | null;
    loadedAtLabel: string;
    graphNodeCount: number;
    graphNodeIds: string[];
    graphEdgeCount: number;
    graphEdgeIds: string[];
    unresolvedNodeCount: number;
    sharedPrintedRegionCount: number;
    sharedPrintedRegionIds: string[];
    sharedPrintedRegionRuntimeIdsByPrintedId: Record<string, string[]>;
    sharedPrintedRegionMissingGuideCount: number;
    sharedPrintedRegionMissingGuideRuntimeIdsByPrintedId: Record<string, string[]>;
    sharedPrintedRegionRuntimeGuideCandidateCount: number;
    sharedPrintedRegionRuntimeGuideCandidateRuntimeIdsByPrintedId: Record<string, string[]>;
    formalSharedPrintedRegionCount: number;
    formalSharedPrintedRegionIds: string[];
    formalSharedPrintedRegionMissingGuideCount: number;
    formalSharedPrintedRegionMissingGuideRuntimeIdsByPrintedId: Record<string, string[]>;
    edgeById: Record<string, {
        from: string;
        to: string;
        boundaryType: string;
        boundaryLabel: string;
        travelCost: number;
        battleWidth: number;
    }>;
};

declare global {
    interface Window {
        __QIDAHEN_RUNTIME_PREVIEW_DEBUG__?: QidahenRuntimePreviewDebugSnapshot;
    }
}

const QidahenRuntimePreview: React.FC = () => {
    const { t } = useTranslation('game-qidahen');
    const initialWorkspace = React.useMemo(() => {
        if (typeof window === 'undefined') {
            return DEFAULT_WORKSPACE;
        }
        const params = new URLSearchParams(window.location.search);
        return sanitizeWorkspaceKey(params.get('workspace') ?? '') || DEFAULT_WORKSPACE;
    }, []);
    const workspace = initialWorkspace;
    const [reloadNonce, setReloadNonce] = React.useState(() => Date.now());
    const [state, setState] = React.useState<PreviewState>({
        graph: null,
        workspace: initialWorkspace,
        runtimeGuideCandidates: [],
        error: null,
        loading: true,
        loadedAtLabel: '',
    });
    const [sharedPrintedPreviewCards, setSharedPrintedPreviewCards] = React.useState<SharedPrintedRuntimePreviewCard[]>([]);

    React.useEffect(() => {
        let cancelled = false;
        const loadUrl = `${LOAD_ENDPOINT}?workspace=${encodeURIComponent(workspace)}&t=${reloadNonce}`;
        setState((current) => ({
            ...current,
            workspace,
            loading: true,
            error: null,
        }));
        void fetch(loadUrl, { cache: 'no-store' })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`读取 ${workspace} 工作区失败：${response.status}`);
                }
                return response.json();
            })
            .then((payload) => {
                if (cancelled) {
                    return;
                }
                const normalizedPayload = readQidahenRegionMaskLoadPayload(payload);
                const graph = parseQidahenRegionGraph(normalizedPayload.graph);
                const runtimeGuideCandidates = normalizeLoadedRuntimeGuideCandidates(
                    normalizedPayload.authoritativeGuides?.runtimeGuideCandidates ?? null,
                );
                setState({
                    graph,
                    workspace,
                    runtimeGuideCandidates,
                    error: null,
                    loading: false,
                    loadedAtLabel: new Date().toLocaleString('zh-CN', { hour12: false }),
                });
            })
            .catch((error: unknown) => {
                if (cancelled) {
                    return;
                }
                setState({
                    graph: null,
                    workspace,
                    runtimeGuideCandidates: [],
                    error: error instanceof Error ? error.message : '读取临时工作区失败',
                    loading: false,
                    loadedAtLabel: '',
                });
            });
        return () => {
            cancelled = true;
        };
    }, [workspace, reloadNonce]);

    const nodePointById = React.useMemo(() => {
        const graph = state.graph;
        if (!graph) {
            return new Map<string, QidahenRegionGraphNode['center']>();
        }
        return new Map(
            graph.nodes.map((node) => [node.id, node.center ?? node.seed]),
        );
    }, [state.graph]);

    const runtimeEdges = React.useMemo(() => (
        (state.graph?.edges ?? []).map((edge) => {
            const from = nodePointById.get(edge.from);
            const to = nodePointById.get(edge.to);
            return from && to ? { edge, from, to } : null;
        }).filter((item): item is NonNullable<typeof item> => item !== null)
    ), [nodePointById, state.graph]);

    const unresolvedNodeCount = React.useMemo(() => (
        (state.graph?.nodes ?? []).filter((node) => node.center == null && node.seed == null).length
    ), [state.graph]);

    const nodeNameById = React.useMemo(() => (
        new Map((state.graph?.nodes ?? []).map((node) => [node.id, node.name]))
    ), [state.graph]);
    const sharedPrintedMappings = React.useMemo(() => (
        buildQidahenSharedPrintedRegionMappings({
            visiblePrintedRegionIds: (state.graph?.nodes ?? []).map((node) => node.id),
            visibleRuntimeRegionIds: (state.graph?.nodes ?? []).map((node) => node.id),
            runtimeGuideCandidates: state.runtimeGuideCandidates,
            runtimeRegionNameById: nodeNameById,
        })
    ), [nodeNameById, state.graph, state.runtimeGuideCandidates]);
    const maskUrl = React.useMemo(() => (
        workspaceAssetUrl(workspace, 'region-mask.png', reloadNonce)
    ), [reloadNonce, workspace]);
    React.useEffect(() => {
        let cancelled = false;
        const activeObjectUrls: string[] = [];
        if (typeof window === 'undefined' || sharedPrintedMappings.length === 0) {
            setSharedPrintedPreviewCards([]);
            return () => {
                activeObjectUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
            };
        }

        const loadPreviewCards = async () => {
            try {
                const image = new Image();
                image.src = maskUrl;
                await image.decode();
                if (cancelled) {
                    return;
                }

                const canvas = document.createElement('canvas');
                canvas.width = QIDAHEN_MAP_WIDTH;
                canvas.height = QIDAHEN_MAP_HEIGHT;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (!context) {
                    setSharedPrintedPreviewCards([]);
                    return;
                }
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const previews = buildQidahenSharedPrintedRuntimePreviews(
                    imageData.data,
                    canvas.width,
                    canvas.height,
                    sharedPrintedMappings.map((mapping) => mapping.printedRegionId),
                );
                const nextCards = previews.map((preview) => {
                    const previewCanvas = document.createElement('canvas');
                    previewCanvas.width = preview.width;
                    previewCanvas.height = preview.height;
                    const previewContext = previewCanvas.getContext('2d');
                    if (!previewContext) {
                        return null;
                    }
                    previewContext.putImageData(createImageDataFromPixels(preview.pixels, preview.width, preview.height), 0, 0);
                    const imageUrl = previewCanvas.toDataURL('image/png');
                    return {
                        printedRegionId: preview.printedRegionId,
                        imageUrl,
                        preview,
                    } satisfies SharedPrintedRuntimePreviewCard;
                }).filter((card): card is SharedPrintedRuntimePreviewCard => card != null);
                if (!cancelled) {
                    setSharedPrintedPreviewCards(nextCards);
                }
            } catch {
                if (!cancelled) {
                    setSharedPrintedPreviewCards([]);
                }
            }
        };

        void loadPreviewCards();
        return () => {
            cancelled = true;
            activeObjectUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
        };
    }, [maskUrl, sharedPrintedMappings]);
    const formalSharedPrintedMappings = React.useMemo(() => (
        buildQidahenSharedPrintedRegionMappings()
    ), []);
    const sharedPrintedMissingGuideCount = React.useMemo(() => (
        sharedPrintedMappings.filter((item) => item.missingAuthoritativeRuntimeIds.length > 0).length
    ), [sharedPrintedMappings]);
    const sharedPrintedGuideCandidateCount = React.useMemo(() => (
        sharedPrintedMappings.filter((item) => item.runtimeGuideCandidates.length > 0).length
    ), [sharedPrintedMappings]);
    const formalSharedPrintedMissingGuideCount = React.useMemo(() => (
        formalSharedPrintedMappings.filter((item) => item.missingAuthoritativeRuntimeIds.length > 0).length
    ), [formalSharedPrintedMappings]);
    const debugSnapshot = React.useMemo<QidahenRuntimePreviewDebugSnapshot>(() => ({
        workspace,
        loading: state.loading,
        error: state.error,
        loadedAtLabel: state.loadedAtLabel,
        graphNodeCount: state.graph?.nodes.length ?? 0,
        graphNodeIds: (state.graph?.nodes ?? []).map((node) => node.id),
        graphEdgeCount: state.graph?.edges.length ?? 0,
        graphEdgeIds: (state.graph?.edges ?? []).map((edge) => edge.id),
        unresolvedNodeCount,
        sharedPrintedRegionCount: sharedPrintedMappings.length,
        sharedPrintedRegionIds: sharedPrintedMappings.map((item) => item.printedRegionId),
        sharedPrintedRegionRuntimeIdsByPrintedId: Object.fromEntries(
            sharedPrintedMappings.map((item) => [item.printedRegionId, item.runtimeRegionIds]),
        ),
        sharedPrintedRegionMissingGuideCount: sharedPrintedMissingGuideCount,
        sharedPrintedRegionMissingGuideRuntimeIdsByPrintedId: Object.fromEntries(
            sharedPrintedMappings
                .filter((item) => item.missingAuthoritativeRuntimeIds.length > 0)
                .map((item) => [item.printedRegionId, item.missingAuthoritativeRuntimeIds]),
        ),
        sharedPrintedRegionRuntimeGuideCandidateCount: sharedPrintedGuideCandidateCount,
        sharedPrintedRegionRuntimeGuideCandidateRuntimeIdsByPrintedId: Object.fromEntries(
            sharedPrintedMappings
                .filter((item) => item.runtimeGuideCandidates.length > 0)
                .map((item) => [item.printedRegionId, item.runtimeGuideCandidates.map((candidate) => candidate.runtimeRegionId)]),
        ),
        formalSharedPrintedRegionCount: formalSharedPrintedMappings.length,
        formalSharedPrintedRegionIds: formalSharedPrintedMappings.map((item) => item.printedRegionId),
        formalSharedPrintedRegionMissingGuideCount: formalSharedPrintedMissingGuideCount,
        formalSharedPrintedRegionMissingGuideRuntimeIdsByPrintedId: Object.fromEntries(
            formalSharedPrintedMappings
                .filter((item) => item.missingAuthoritativeRuntimeIds.length > 0)
                .map((item) => [item.printedRegionId, item.missingAuthoritativeRuntimeIds]),
        ),
        edgeById: Object.fromEntries(
            (state.graph?.edges ?? []).map((edge) => [edge.id, {
                from: edge.from,
                to: edge.to,
                boundaryType: edge.boundaryType,
                boundaryLabel: edge.boundaryLabel,
                travelCost: edge.travelCost,
                battleWidth: edge.battleWidth,
            }]),
        ),
    }), [formalSharedPrintedMappings, formalSharedPrintedMissingGuideCount, sharedPrintedGuideCandidateCount, sharedPrintedMappings, sharedPrintedMissingGuideCount, state.error, state.graph, state.loadedAtLabel, state.loading, unresolvedNodeCount, workspace]);
    React.useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.__QIDAHEN_RUNTIME_PREVIEW_DEBUG__ = debugSnapshot;
        return () => {
            if (window.__QIDAHEN_RUNTIME_PREVIEW_DEBUG__ === debugSnapshot) {
                delete window.__QIDAHEN_RUNTIME_PREVIEW_DEBUG__;
            }
        };
    }, [debugSnapshot]);

    const openWorkspaceEditor = React.useCallback(() => {
        window.location.assign(`/dev/qidahen-region-mask?workspace=${encodeURIComponent(workspace)}`);
    }, [workspace]);

    return (
        <div className="min-h-screen bg-stone-950 text-stone-100">
            <div className="mx-auto flex min-h-screen max-w-[1700px] flex-col px-5 py-5 lg:px-6">
                <header className="rounded-2xl border border-stone-800 bg-stone-950/80 px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                                <Eye size={14} />
                                {t('devtools.runtimePreview.eyebrow', { defaultValue: '七大恨运行时预览' })}
                            </div>
                            <h1 className="mt-2 text-2xl font-black text-stone-50">
                                {t('devtools.runtimePreview.title', { defaultValue: '临时工作区只读消费桥' })}
                            </h1>
                            <p className="mt-2 max-w-[900px] text-sm leading-6 text-stone-300">
                                {t('devtools.runtimePreview.descriptionPrefix', { defaultValue: '这里直接读取临时工作区里的' })} <code>region-mask.png</code> {t('devtools.runtimePreview.descriptionBetween', { defaultValue: '和' })} <code>region-graph.json</code>{t('devtools.runtimePreview.descriptionSuffix', { defaultValue: '，用运行时方式预览区域、中心点、通路和边界规则。不写正式七大恨数据。' })}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                <span
                                    data-testid="qidahen-runtime-preview-workspace"
                                    className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-3 py-1 font-mono text-cyan-100"
                                >
                                    {t('devtools.runtimePreview.workspaceBadge', {
                                        defaultValue: 'workspace={{workspace}}',
                                        workspace,
                                    })}
                                </span>
                                {state.graph ? (
                                    <span
                                        data-testid="qidahen-runtime-preview-stats"
                                        className="rounded-full border border-stone-700 bg-stone-900 px-3 py-1 text-stone-200"
                                    >
                                        {t('devtools.runtimePreview.stats', {
                                            defaultValue: '中心 {{nodes}} / 通路 {{edges}} / 缺中心 {{unresolved}} / 共享印刷区 {{sharedPrinted}} / 缺权威指引 {{missingGuide}} / 候选 {{candidates}}',
                                            nodes: state.graph.nodes.length,
                                            edges: state.graph.edges.length,
                                            unresolved: unresolvedNodeCount,
                                            sharedPrinted: sharedPrintedMappings.length,
                                            missingGuide: sharedPrintedMissingGuideCount,
                                            candidates: sharedPrintedGuideCandidateCount,
                                        })}
                                    </span>
                                ) : null}
                                {state.loadedAtLabel ? (
                                    <span className="rounded-full border border-stone-800 bg-stone-900/80 px-3 py-1 text-stone-400">
                                        {t('devtools.runtimePreview.loadedAt', {
                                            defaultValue: '最近读取：{{label}}',
                                            label: state.loadedAtLabel,
                                        })}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                to={`/dev/qidahen-region-mask?workspace=${encodeURIComponent(workspace)}`}
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-400/45 bg-amber-500/10 px-3 py-2 text-sm font-black text-amber-100 transition hover:border-amber-200"
                            >
                                <Pencil size={15} />
                                {t('devtools.runtimePreview.backToEditor', { defaultValue: '回到工具编辑' })}
                            </Link>
                            <button
                                type="button"
                                onClick={() => setReloadNonce(Date.now())}
                                data-testid="qidahen-runtime-preview-refresh"
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-700 bg-stone-900/80 px-3 py-2 text-sm font-black text-stone-100 transition hover:border-stone-500"
                            >
                                <RefreshCcw size={15} />
                                {t('devtools.runtimePreview.refresh', { defaultValue: '重新读取' })}
                            </button>
                            <Link
                                to={`/dev/qidahen-region-mask?workspace=${encodeURIComponent(DEFAULT_WORKSPACE)}`}
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-sky-400/45 bg-sky-500/10 px-3 py-2 text-sm font-black text-sky-100 transition hover:border-sky-200"
                            >
                                <Route size={15} />
                                {t('devtools.runtimePreview.openReadyWorkspace', { defaultValue: '打开现成可用成果' })}
                            </Link>
                        </div>
                    </div>
                </header>

                <div className="mt-5 grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <section className="min-h-0 rounded-2xl border border-stone-800 bg-stone-950/75 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
                            <div>{t('devtools.runtimePreview.mapSectionTitle', { defaultValue: '主地图 + 区域 mask + 运行时通路叠层' })}</div>
                            {state.loading ? <div data-testid="qidahen-runtime-preview-loading">{t('devtools.runtimePreview.loading', { defaultValue: '正在读取工作区...' })}</div> : null}
                            {state.error ? (
                                <div data-testid="qidahen-runtime-preview-error" className="font-bold text-rose-300">
                                    {state.error}
                                </div>
                            ) : null}
                        </div>
                        <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
                            <div
                                data-testid="qidahen-runtime-preview-map"
                                className="relative overflow-hidden rounded-lg bg-[#c8a970]"
                                style={{ aspectRatio: `${QIDAHEN_MAP_WIDTH} / ${QIDAHEN_MAP_HEIGHT}` }}
                            >
                                <img
                                    src={DEFAULT_MAP_PATH}
                                    alt={t('devtools.runtimePreview.mapAlt', { defaultValue: '七大恨主地图' })}
                                    className="absolute inset-0 h-full w-full object-fill"
                                    draggable={false}
                                />
                                <img
                                    src={maskUrl}
                                    alt=""
                                    aria-hidden="true"
                                    data-testid="qidahen-runtime-preview-mask"
                                    className="pointer-events-none absolute inset-0 h-full w-full object-fill"
                                    style={{ opacity: 0.34, mixBlendMode: 'multiply' }}
                                />
                                <svg
                                    className="pointer-events-none absolute inset-0 h-full w-full"
                                    viewBox={`0 0 ${QIDAHEN_MAP_WIDTH} ${QIDAHEN_MAP_HEIGHT}`}
                                    aria-hidden="true"
                                >
                                    <g data-testid="qidahen-runtime-preview-graph">
                                        {runtimeEdges.map(({ edge, from, to }) => {
                                            const boundaryMeta = getQidahenBoundaryTypeMeta(edge.boundaryType);
                                            const color = BOUNDARY_TYPE_RUNTIME_COLORS[edge.boundaryType] ?? BOUNDARY_TYPE_RUNTIME_COLORS.plain;
                                            const label = edge.reverseBoundaryLabel && edge.reverseBoundaryLabel !== edge.boundaryLabel
                                                ? `${edge.boundaryLabel}/${edge.reverseBoundaryLabel}`
                                                : edge.boundaryLabel;
                                            const labelOffset = EDGE_LABEL_OFFSETS[edge.id] ?? { x: 0, y: 0 };
                                            const midX = (from.x + to.x) / 2 + labelOffset.x;
                                            const midY = (from.y + to.y) / 2 + labelOffset.y;
                                            return (
                                                <g
                                                    key={edge.id}
                                                    data-testid={`qidahen-runtime-preview-edge-${edge.id}`}
                                                    data-boundary-type={edge.boundaryType}
                                                    data-travel-cost={edge.travelCost}
                                                    data-battle-width={edge.battleWidth}
                                                >
                                                    <line
                                                        x1={from.x}
                                                        y1={from.y}
                                                        x2={to.x}
                                                        y2={to.y}
                                                        stroke={color}
                                                        strokeWidth={6}
                                                        strokeLinecap="round"
                                                        strokeDasharray={edge.boundaryType === 'coast' ? '10 10' : undefined}
                                                        vectorEffect="non-scaling-stroke"
                                                    />
                                                    <rect
                                                        x={midX - 44}
                                                        y={midY - 20}
                                                        width={88}
                                                        height={26}
                                                        rx={5}
                                                        fill="rgba(20,14,10,0.82)"
                                                        stroke={color}
                                                        strokeWidth={1.5}
                                                    />
                                                    <text
                                                        x={midX}
                                                        y={midY - 2}
                                                        fill={color}
                                                        textAnchor="middle"
                                                        fontSize={14}
                                                        fontWeight={900}
                                                    >
                                                        {label || boundaryMeta.label}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                        {(state.graph?.nodes ?? []).map((node) => {
                                            const point = node.center ?? node.seed;
                                            if (!point) {
                                                return null;
                                            }
                                            const labelOffset = NODE_LABEL_OFFSETS[node.id] ?? { x: 0, y: -18 };
                                            return (
                                                <g key={node.id} data-testid={`qidahen-runtime-preview-node-${node.id}`}>
                                                    <circle
                                                        cx={point.x}
                                                        cy={point.y}
                                                        r={10}
                                                        fill="rgba(20,14,10,0.84)"
                                                        stroke="rgba(237,214,155,0.95)"
                                                        strokeWidth={2.5}
                                                    />
                                                    <text
                                                        x={point.x + labelOffset.x}
                                                        y={point.y + labelOffset.y}
                                                        fill="rgba(255,243,214,0.96)"
                                                        stroke="rgba(20,14,10,0.86)"
                                                        strokeWidth={3}
                                                        paintOrder="stroke fill"
                                                        textAnchor="middle"
                                                        fontSize={18}
                                                        fontWeight={900}
                                                    >
                                                        {node.name}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                    </g>
                                </svg>
                            </div>
                        </div>
                    </section>

                    <aside className="min-h-0 rounded-2xl border border-stone-800 bg-stone-950/75 p-4">
                        <div className="rounded-xl border border-stone-800 bg-stone-900/75 px-3 py-3 text-xs leading-6 text-stone-300">
                            <div className="font-black uppercase tracking-[0.16em] text-stone-400">{t('devtools.runtimePreview.reviewTitle', { defaultValue: '预览口径' })}</div>
                            <div className="mt-2">{t('devtools.runtimePreview.reviewIntro', { defaultValue: '这页只证明“临时工作区成果能被运行时方式消费”。' })}</div>
                            <div>{t('devtools.runtimePreview.reviewNote', { defaultValue: '它不把当前区域粗稿或 detour 工作区升级成正式边界真相源。' })}</div>
                            <button
                                type="button"
                                onClick={openWorkspaceEditor}
                                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-cyan-400/45 bg-cyan-500/10 px-3 py-2 text-sm font-black text-cyan-100 transition hover:border-cyan-200"
                            >
                                <Pencil size={15} />
                                {t('devtools.runtimePreview.editCurrentWorkspace', { defaultValue: '去当前工作区继续编辑' })}
                            </button>
                        </div>

                        <div
                            className="mt-4 rounded-xl border border-stone-800 bg-stone-900/75 px-3 py-3 text-xs leading-6 text-stone-300"
                            data-testid="qidahen-runtime-preview-formal-shared-printed-panel"
                        >
                            <div className="font-black uppercase tracking-[0.16em] text-stone-400">{t('devtools.runtimePreview.formalSharedPrinted.title', { defaultValue: '正式共图块审计' })}</div>
                            <div className="mt-2">
                                {t('devtools.runtimePreview.formalSharedPrinted.description', { defaultValue: '这里直接按正式运行时合同统计共享印刷区，不依赖当前工作区是否只载入局部区域。' })}
                            </div>
                            <div className="mt-1 text-stone-500">
                                {t('devtools.runtimePreview.formalSharedPrinted.note', { defaultValue: '当前最重要的是把“缺权威指引”的正式红灯直接暴露出来。' })}
                            </div>
                            <div
                                className="mt-2 rounded-lg border border-stone-800 bg-stone-950/50 px-3 py-2 text-stone-300"
                                data-testid="qidahen-runtime-preview-formal-shared-printed-summary"
                            >
                                {t('devtools.runtimePreview.formalSharedPrinted.summary', {
                                    defaultValue: '正式共享印刷区：{{count}}；缺权威指引：{{missing}}',
                                    count: formalSharedPrintedMappings.length,
                                    missing: formalSharedPrintedMissingGuideCount,
                                })}
                            </div>
                            <div className="mt-3 space-y-2">
                                {formalSharedPrintedMappings.map((mapping) => (
                                    <div
                                        key={mapping.printedRegionId}
                                        data-testid={`qidahen-runtime-preview-formal-shared-printed-${mapping.printedRegionId}`}
                                        className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 px-3 py-2"
                                    >
                                        <div className="font-bold text-cyan-100">
                                            {mapping.printedRegionName} · {mapping.printedRegionId}
                                        </div>
                                        <div className="mt-1 text-stone-300">
                                            {t('devtools.runtimePreview.formalSharedPrinted.runtime', {
                                                defaultValue: '运行时：{{names}}',
                                                names: mapping.runtimeRegionNames.join(' / '),
                                            })}
                                        </div>
                                        <div className="mt-1 font-mono text-stone-500">
                                            {mapping.runtimeRegionIds.join(' / ')}
                                        </div>
                                        {mapping.missingAuthoritativeRuntimeIds.length > 0 ? (
                                            <div
                                                className="mt-1 text-rose-300"
                                                data-testid={`qidahen-runtime-preview-formal-shared-printed-missing-guide-${mapping.printedRegionId}`}
                                            >
                                                {t('devtools.runtimePreview.formalSharedPrinted.missingGuide', {
                                                    defaultValue: '缺权威指引：{{names}}',
                                                    names: mapping.missingAuthoritativeRuntimeIds.map((runtimeRegionId) => (
                                                        QIDAHEN_RUNTIME_REGION_DEFINITIONS.find((region) => region.id === runtimeRegionId)?.name ?? runtimeRegionId
                                                    )).join(' / '),
                                                })}
                                            </div>
                                        ) : (
                                            <div
                                                className="mt-1 text-emerald-300"
                                                data-testid={`qidahen-runtime-preview-formal-shared-printed-guide-complete-${mapping.printedRegionId}`}
                                            >
                                                {t('devtools.runtimePreview.formalSharedPrinted.guideComplete', { defaultValue: '权威指引已覆盖当前运行时映射' })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div
                            className="mt-4 rounded-xl border border-stone-800 bg-stone-900/75 px-3 py-3 text-xs leading-6 text-stone-300"
                            data-testid="qidahen-runtime-preview-shared-printed-panel"
                        >
                            <div className="font-black uppercase tracking-[0.16em] text-stone-400">{t('devtools.runtimePreview.sharedPrinted.title', { defaultValue: '共享印刷区' })}</div>
                            <div className="mt-2">
                                {t('devtools.runtimePreview.sharedPrinted.description', { defaultValue: '当前工作区里，若一个印刷图块同时命中多个运行时区域，这里会直接列出来。' })}
                            </div>
                            <div className="mt-1 text-stone-500">
                                {t('devtools.runtimePreview.sharedPrinted.note', { defaultValue: '这是运行时/印刷区分层真相，不代表正式印刷数据已经拆开。' })}
                            </div>
                            <div
                                className="mt-2 rounded-lg border border-stone-800 bg-stone-950/50 px-3 py-2 text-stone-300"
                                data-testid="qidahen-runtime-preview-shared-printed-candidate-summary"
                            >
                                {t('devtools.runtimePreview.sharedPrinted.candidateSummary', {
                                    defaultValue: '当前工作区已记录运行时专属指引候选：{{count}} 条。',
                                    count: sharedPrintedGuideCandidateCount,
                                })}
                            </div>
                            {sharedPrintedMappings.length === 0 ? (
                                <div
                                    className="mt-3 rounded-lg border border-dashed border-stone-800 px-3 py-2 text-stone-500"
                                    data-testid="qidahen-runtime-preview-shared-printed-empty"
                                >
                                    {t('devtools.runtimePreview.sharedPrinted.empty', { defaultValue: '当前工作区没有载入共享印刷区的多运行时样本。' })}
                                </div>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {sharedPrintedMappings.map((mapping) => (
                                        <div
                                            key={mapping.printedRegionId}
                                            data-testid={`qidahen-runtime-preview-shared-printed-${mapping.printedRegionId}`}
                                            className="rounded-lg border border-amber-400/25 bg-amber-500/5 px-3 py-2"
                                        >
                                            <div className="font-bold text-amber-100">
                                                {mapping.printedRegionName} · {mapping.printedRegionId}
                                            </div>
                                            <div className="mt-1 text-stone-300">
                                                {t('devtools.runtimePreview.sharedPrinted.runtime', {
                                                    defaultValue: '运行时：{{names}}',
                                                    names: mapping.runtimeRegionNames.join(' / '),
                                                })}
                                            </div>
                                            <div className="mt-1 font-mono text-stone-500">
                                                {mapping.runtimeRegionIds.join(' / ')}
                                            </div>
                                            {mapping.missingAuthoritativeRuntimeIds.length > 0 ? (
                                                <div
                                                    className="mt-1 text-rose-300"
                                                    data-testid={`qidahen-runtime-preview-shared-printed-missing-guide-${mapping.printedRegionId}`}
                                                >
                                                    {t('devtools.runtimePreview.sharedPrinted.missingGuide', {
                                                        defaultValue: '缺权威指引：{{names}}',
                                                        names: mapping.missingAuthoritativeRuntimeIds.map((runtimeRegionId) => (
                                                            QIDAHEN_RUNTIME_REGION_DEFINITIONS.find((region) => region.id === runtimeRegionId)?.name
                                                            ?? nodeNameById.get(runtimeRegionId)
                                                            ?? runtimeRegionId
                                                        )).join(' / '),
                                                    })}
                                                </div>
                                            ) : (
                                                <div
                                                    className="mt-1 text-emerald-300"
                                                    data-testid={`qidahen-runtime-preview-shared-printed-guide-complete-${mapping.printedRegionId}`}
                                                >
                                                    {t('devtools.runtimePreview.sharedPrinted.guideComplete', { defaultValue: '权威指引已覆盖当前运行时映射' })}
                                                </div>
                                            )}
                                            {mapping.runtimeGuideCandidates.length > 0 ? (
                                                <div
                                                    className="mt-1 text-amber-200"
                                                    data-testid={`qidahen-runtime-preview-shared-printed-runtime-guide-candidates-${mapping.printedRegionId}`}
                                                >
                                                    {t('devtools.runtimePreview.sharedPrinted.pendingCandidates', {
                                                        defaultValue: '工作区待补候选：{{names}}',
                                                        names: mapping.runtimeGuideCandidates.map((candidate) => {
                                                            const runtimeRegionName = nodeNameById.get(candidate.runtimeRegionId) ?? candidate.label ?? candidate.runtimeRegionId;
                                                            return candidate.source
                                                                ? `${runtimeRegionName}（${candidate.source}）`
                                                                : runtimeRegionName;
                                                        }).join(' / '),
                                                    })}
                                                </div>
                                            ) : null}
                                            {sharedPrintedPreviewCards.find((card) => card.printedRegionId === mapping.printedRegionId) ? (
                                                (() => {
                                                    const card = sharedPrintedPreviewCards.find((item) => item.printedRegionId === mapping.printedRegionId)!;
                                                    return (
                                                        <div
                                                            className="mt-3 rounded-lg border border-stone-800 bg-stone-950/55 p-2"
                                                            data-testid={`qidahen-runtime-preview-shared-printed-preview-${mapping.printedRegionId}`}
                                                        >
                                                            <div className="mb-2 text-[11px] leading-5 text-stone-400">
                                                                {t('devtools.runtimePreview.sharedPrinted.previewHint', {
                                                                    defaultValue: '这张小图只展示运行时 ownership 如何把同一印刷区切成多个子区，不代表正式印刷数据已经拆开。',
                                                                })}
                                                            </div>
                                                            <img
                                                                src={card.imageUrl}
                                                                alt={`${mapping.printedRegionName} runtime split preview`}
                                                                className="block max-h-52 w-full rounded border border-stone-800 bg-black/70 object-contain"
                                                            />
                                                            <div className="mt-2 space-y-1 text-[11px] leading-5 text-stone-300">
                                                                {mapping.runtimeRegionIds.map((runtimeRegionId) => {
                                                                    const runtimeRegionName = nodeNameById.get(runtimeRegionId)
                                                                        ?? QIDAHEN_RUNTIME_REGION_DEFINITIONS.find((region) => region.id === runtimeRegionId)?.name
                                                                        ?? runtimeRegionId;
                                                                    const pixelCount = card.preview.pixelCountByRuntimeRegionId[runtimeRegionId] ?? 0;
                                                                    const anchor = card.preview.anchors.find((item) => item.runtimeRegionId === runtimeRegionId);
                                                                    return (
                                                                        <div
                                                                            key={runtimeRegionId}
                                                                            data-testid={`qidahen-runtime-preview-shared-printed-preview-row-${runtimeRegionId}`}
                                                                            className="flex items-center justify-between gap-3"
                                                                        >
                                                                            <span>{runtimeRegionName}</span>
                                                                            <span className="font-mono text-stone-500">
                                                                                {pixelCount.toLocaleString()} px
                                                                                {anchor ? ` · ${anchor.point.x},${anchor.point.y}` : ''}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })()
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-4">
                            <div className="text-xs font-black uppercase tracking-[0.16em] text-stone-400">{t('devtools.runtimePreview.currentPassagesTitle', { defaultValue: '当前通路' })}</div>
                            <div className="mt-2 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 360px)' }}>
                                {state.graph == null && !state.loading ? (
                                    <div className="rounded-xl border border-dashed border-stone-800 px-3 py-4 text-sm text-stone-500">
                                        {t('devtools.runtimePreview.currentPassagesEmpty', { defaultValue: '还没有读到可预览的区域图。' })}
                                    </div>
                                ) : null}
                                {(state.graph?.edges ?? []).map((edge) => {
                                    const meta = getQidahenBoundaryTypeMeta(edge.boundaryType);
                                    const fromName = nodeNameById.get(edge.from) ?? edge.from;
                                    const toName = nodeNameById.get(edge.to) ?? edge.to;
                                    return (
                                        <div
                                            key={edge.id}
                                            data-testid={`qidahen-runtime-preview-note-${edge.id}`}
                                            className="rounded-xl border border-stone-800 bg-stone-900/75 px-3 py-3 text-xs leading-5 text-stone-300"
                                        >
                                            <div className="font-bold text-stone-100">{edge.boundaryLabel} · {fromName} ↔ {toName}</div>
                                            <div className="mt-1">{meta.note}</div>
                                            <div className="mt-1 text-stone-500">
                                                {t('devtools.runtimePreview.currentPassages.travelCost', {
                                                    defaultValue: '移动代价 {{value}}',
                                                    value: edge.travelCost,
                                                })}
                                            </div>
                                            <div className="mt-1 text-stone-500">
                                                {t('devtools.runtimePreview.currentPassages.battleWidth', {
                                                    defaultValue: '战场宽度 {{value}}',
                                                    value: edge.battleWidth,
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default QidahenRuntimePreview;
