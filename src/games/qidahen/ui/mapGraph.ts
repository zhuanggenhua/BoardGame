import printedRegionGraphData from '../data/region-graph.json';
import authoritativeGuidesData from '../data/region-authoritative-guides.json';
import printedRegionMaskRegionsData from '../data/region-mask-regions.json';
import runtimeRegionGraphData from '../data/runtime-region-graph.json';
import runtimeRegionMaskRegionsData from '../data/runtime-region-mask-regions.json';
import { extractQidahenFormalAuthoritativeGuideRuntimeRegionIds } from '../regionAuthoritativeGuideFormats';

export type QidahenPassageBoundaryType =
    | 'plain'
    | 'mountain'
    | 'river'
    | 'coast'
    | 'wall-convex'
    | 'wall-flat'
    | 'city'
    | 'shanhaiguan';

export interface QidahenPassageBoundaryMeta {
    id: QidahenPassageBoundaryType;
    label: string;
    note: string;
    travelCost: number;
    battleWidth: number;
    unitCap: number | null;
}

export interface QidahenRegionGraphPoint {
    x: number;
    y: number;
}

export interface QidahenRegionGraphNode {
    id: string;
    name: string;
    seed: QidahenRegionGraphPoint | null;
    center: QidahenRegionGraphPoint | null;
    pixelCount: number;
}

export interface QidahenRegionGraphEdge {
    id: string;
    from: string;
    to: string;
    bidirectional: boolean;
    boundaryType: QidahenPassageBoundaryType;
    boundaryLabel: string;
    travelCost: number;
    battleWidth: number;
    ruleNote: string;
    unitCap: number | null;
    reverseBoundaryType: QidahenPassageBoundaryType | null;
    reverseBoundaryLabel: string | null;
    reverseTravelCost: number | null;
    reverseBattleWidth: number | null;
    reverseRuleNote: string | null;
    reverseUnitCap: number | null;
}

export interface QidahenRegionGraph {
    boundaryTypes: QidahenPassageBoundaryMeta[];
    nodes: QidahenRegionGraphNode[];
    edges: QidahenRegionGraphEdge[];
}

export interface QidahenDirectedPassage {
    edgeId: string;
    from: string;
    to: string;
    boundaryType: QidahenPassageBoundaryType;
    boundaryLabel: string;
    travelCost: number;
    battleWidth: number;
    ruleNote: string;
    unitCap: number | null;
}

export interface QidahenMaskRegionDefinition {
    id: string;
    name: string;
    color: string;
    seed: QidahenRegionGraphPoint | null;
    links: string[];
    printedRegionIds: string[];
}

export interface QidahenRuntimeRegionDefinition extends QidahenMaskRegionDefinition {
    center: QidahenRegionGraphPoint | null;
    pixelCount: number;
    adjacentRegionIds: string[];
    travelCostByRegionId: Record<string, number>;
    movementCostByRegionId: Record<string, number>;
    boundaryTypeByRegionId: Record<string, QidahenPassageBoundaryType>;
}

export interface QidahenSharedPrintedRegionAudit {
    printedRegionId: string;
    runtimeRegionIds: string[];
    missingAuthoritativeRuntimeIds: string[];
}

const DEFAULT_BOUNDARY_TYPES: QidahenPassageBoundaryMeta[] = [
    { id: 'plain', label: '平原', note: '战场宽度 3', travelCost: 1, battleWidth: 3, unitCap: null },
    { id: 'mountain', label: '山脉', note: '战场宽度 2', travelCost: 2, battleWidth: 2, unitCap: null },
    { id: 'river', label: '河流', note: '战场宽度 2', travelCost: 2, battleWidth: 2, unitCap: null },
    { id: 'coast', label: '海岸/水路', note: '船锚区相邻，最多 2 部队', travelCost: 2, battleWidth: 2, unitCap: 2 },
    { id: 'wall-convex', label: '攻入长城', note: '凸面战场宽度 1', travelCost: 1, battleWidth: 1, unitCap: null },
    { id: 'wall-flat', label: '出长城', note: '平面战场宽度 3', travelCost: 1, battleWidth: 3, unitCap: null },
    { id: 'city', label: '攻城', note: '战场宽度 1', travelCost: 1, battleWidth: 1, unitCap: null },
    { id: 'shanhaiguan', label: '山海关特殊', note: '破关时视为平原', travelCost: 1, battleWidth: 1, unitCap: null },
];

const KNOWN_BOUNDARY_TYPE_IDS = new Set(DEFAULT_BOUNDARY_TYPES.map((item) => item.id));
const DEFAULT_BOUNDARY_META_BY_ID = new Map(DEFAULT_BOUNDARY_TYPES.map((item) => [item.id, item]));

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const toStringOrEmpty = (value: unknown): string => (
    typeof value === 'string' ? value : ''
);

const toFiniteNumber = (value: unknown, fallback = 0): number => (
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const parseBoundaryType = (value: unknown): QidahenPassageBoundaryType => {
    if (typeof value === 'string' && KNOWN_BOUNDARY_TYPE_IDS.has(value as QidahenPassageBoundaryType)) {
        return value as QidahenPassageBoundaryType;
    }
    return 'plain';
};

const parseOptionalBoundaryType = (value: unknown): QidahenPassageBoundaryType | null => {
    if (typeof value === 'string' && KNOWN_BOUNDARY_TYPE_IDS.has(value as QidahenPassageBoundaryType)) {
        return value as QidahenPassageBoundaryType;
    }
    return null;
};

const parsePoint = (value: unknown): QidahenRegionGraphPoint | null => {
    if (!isRecord(value)) return null;
    const x = toFiniteNumber(value.x, Number.NaN);
    const y = toFiniteNumber(value.y, Number.NaN);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

const parseMaskRegionDefinition = (value: unknown): QidahenMaskRegionDefinition | null => {
    if (!isRecord(value)) return null;
    const id = toStringOrEmpty(value.id);
    if (!id) return null;
    const links = Array.isArray(value.links)
        ? value.links.map((item) => toStringOrEmpty(item)).filter(Boolean).sort()
        : [];
    return {
        id,
        name: toStringOrEmpty(value.name) || id,
        color: toStringOrEmpty(value.color),
        seed: parsePoint(value.seed),
        links,
        printedRegionIds: Array.isArray(value.printedRegionIds)
            ? value.printedRegionIds.map((item) => toStringOrEmpty(item)).filter(Boolean)
            : [id],
    };
};

export const qidahenRegionColorKey = (red: number, green: number, blue: number): number => (
    ((red & 0xff) << 16) | ((green & 0xff) << 8) | (blue & 0xff)
);

export const normalizeQidahenPassageId = (from: string, to: string): string => (
    [from, to].sort().join('::')
);

export const parseQidahenRegionGraph = (raw: unknown): QidahenRegionGraph => {
    const source = isRecord(raw) ? raw : {};
    const boundaryTypes = Array.isArray(source.boundaryTypes)
        ? source.boundaryTypes.map((item): QidahenPassageBoundaryMeta | null => {
            if (!isRecord(item)) return null;
            const id = parseBoundaryType(item.id);
            const fallback = DEFAULT_BOUNDARY_META_BY_ID.get(id) ?? DEFAULT_BOUNDARY_TYPES[0];
            return {
                id,
                label: toStringOrEmpty(item.label) || fallback.label,
                note: toStringOrEmpty(item.note) || fallback.note,
                travelCost: Math.max(1, Math.floor(toFiniteNumber(item.travelCost, fallback.travelCost))),
                battleWidth: Math.max(1, Math.floor(toFiniteNumber(item.battleWidth, fallback.battleWidth))),
                unitCap: item.unitCap == null ? fallback.unitCap : Math.max(1, Math.floor(toFiniteNumber(item.unitCap, fallback.unitCap ?? 1))),
            };
        }).filter((item): item is QidahenPassageBoundaryMeta => item !== null)
        : DEFAULT_BOUNDARY_TYPES;
    const boundaryMetaById = new Map(boundaryTypes.map((item) => [item.id, item]));

    const nodes = Array.isArray(source.nodes)
        ? source.nodes.map((item): QidahenRegionGraphNode | null => {
            if (!isRecord(item)) return null;
            const id = toStringOrEmpty(item.id);
            if (!id) return null;
            return {
                id,
                name: toStringOrEmpty(item.name) || id,
                seed: parsePoint(item.seed),
                center: parsePoint(item.center),
                pixelCount: Math.max(0, Math.floor(toFiniteNumber(item.pixelCount, 0))),
            };
        }).filter((item): item is QidahenRegionGraphNode => item !== null)
        : [];
    const nodeIds = new Set(nodes.map((item) => item.id));

    const edges = Array.isArray(source.edges)
        ? source.edges.map((item): QidahenRegionGraphEdge | null => {
            if (!isRecord(item)) return null;
            const from = toStringOrEmpty(item.from);
            const to = toStringOrEmpty(item.to);
            if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to) || from === to) return null;
            const bidirectional = item.bidirectional !== false;
            const boundaryType = parseBoundaryType(item.boundaryType);
            const meta = boundaryMetaById.get(boundaryType) ?? DEFAULT_BOUNDARY_META_BY_ID.get(boundaryType) ?? DEFAULT_BOUNDARY_TYPES[0];
            const reverseBoundaryType = bidirectional
                ? parseOptionalBoundaryType(item.reverseBoundaryType) ?? boundaryType
                : null;
            const reverseMeta = reverseBoundaryType
                ? boundaryMetaById.get(reverseBoundaryType)
                    ?? DEFAULT_BOUNDARY_META_BY_ID.get(reverseBoundaryType)
                    ?? DEFAULT_BOUNDARY_TYPES[0]
                : null;
            return {
                id: toStringOrEmpty(item.id) || normalizeQidahenPassageId(from, to),
                from,
                to,
                bidirectional,
                boundaryType,
                boundaryLabel: toStringOrEmpty(item.boundaryLabel) || meta.label,
                travelCost: Math.max(1, Math.floor(toFiniteNumber(item.travelCost, meta.travelCost))),
                battleWidth: Math.max(1, Math.floor(toFiniteNumber(item.battleWidth, meta.battleWidth))),
                ruleNote: toStringOrEmpty(item.ruleNote) || meta.note,
                unitCap: item.unitCap == null ? meta.unitCap : Math.max(1, Math.floor(toFiniteNumber(item.unitCap, meta.unitCap ?? 1))),
                reverseBoundaryType,
                reverseBoundaryLabel: reverseMeta
                    ? (toStringOrEmpty(item.reverseBoundaryLabel) || reverseMeta.label)
                    : null,
                reverseTravelCost: reverseMeta
                    ? Math.max(1, Math.floor(toFiniteNumber(item.reverseTravelCost, toFiniteNumber(item.travelCost, reverseMeta.travelCost))))
                    : null,
                reverseBattleWidth: reverseMeta
                    ? Math.max(1, Math.floor(toFiniteNumber(item.reverseBattleWidth, reverseMeta.battleWidth)))
                    : null,
                reverseRuleNote: reverseMeta
                    ? (toStringOrEmpty(item.reverseRuleNote) || reverseMeta.note)
                    : null,
                reverseUnitCap: reverseMeta
                    ? (item.reverseUnitCap == null
                        ? reverseMeta.unitCap
                        : Math.max(1, Math.floor(toFiniteNumber(item.reverseUnitCap, reverseMeta.unitCap ?? 1))))
                    : null,
            };
        }).filter((item): item is QidahenRegionGraphEdge => item !== null)
        : [];

    return { boundaryTypes, nodes, edges };
};

export const QIDAHEN_PRINTED_REGION_GRAPH = parseQidahenRegionGraph(printedRegionGraphData);
export const QIDAHEN_PRINTED_REGION_BOUNDARY_TYPES = QIDAHEN_PRINTED_REGION_GRAPH.boundaryTypes;
export const QIDAHEN_PRINTED_REGION_GRAPH_NODES = QIDAHEN_PRINTED_REGION_GRAPH.nodes;
export const QIDAHEN_PRINTED_REGION_GRAPH_EDGES = QIDAHEN_PRINTED_REGION_GRAPH.edges;
export const QIDAHEN_PRINTED_REGION_GRAPH_NODE_BY_ID = new Map(QIDAHEN_PRINTED_REGION_GRAPH_NODES.map((node) => [node.id, node]));
const printedRegionMaskRegions = (printedRegionMaskRegionsData as { regions?: unknown }).regions;
export const QIDAHEN_PRINTED_REGION_DEFINITIONS = (
    Array.isArray(printedRegionMaskRegions)
        ? printedRegionMaskRegions
            .map((item: unknown) => parseMaskRegionDefinition(item))
            .filter((item): item is QidahenMaskRegionDefinition => item !== null)
        : []
);
export const QIDAHEN_PRINTED_REGION_BY_ID = new Map(QIDAHEN_PRINTED_REGION_DEFINITIONS.map((region) => [region.id, region]));

export const QIDAHEN_MASK_REGION_DEFINITIONS = QIDAHEN_PRINTED_REGION_DEFINITIONS;
export const QIDAHEN_MASK_REGION_BY_ID = QIDAHEN_PRINTED_REGION_BY_ID;

const runtimeRegionMaskRegions = (runtimeRegionMaskRegionsData as { regions?: unknown }).regions;
export const QIDAHEN_RUNTIME_REGION_SOURCE_DEFINITIONS = (
    Array.isArray(runtimeRegionMaskRegions)
        ? runtimeRegionMaskRegions
            .map((item: unknown) => parseMaskRegionDefinition(item))
            .filter((item): item is QidahenMaskRegionDefinition => item !== null)
        : []
);
export const QIDAHEN_RUNTIME_REGION_SOURCE_BY_ID = new Map(QIDAHEN_RUNTIME_REGION_SOURCE_DEFINITIONS.map((region) => [region.id, region]));

export const QIDAHEN_RUNTIME_REGION_GRAPH = parseQidahenRegionGraph(runtimeRegionGraphData);
export const QIDAHEN_REGION_GRAPH = QIDAHEN_RUNTIME_REGION_GRAPH;
export const QIDAHEN_REGION_BOUNDARY_TYPES = QIDAHEN_RUNTIME_REGION_GRAPH.boundaryTypes;
export const QIDAHEN_REGION_GRAPH_NODES = QIDAHEN_RUNTIME_REGION_GRAPH.nodes;
export const QIDAHEN_REGION_GRAPH_EDGES = QIDAHEN_RUNTIME_REGION_GRAPH.edges;
export const QIDAHEN_REGION_GRAPH_NODE_BY_ID = new Map(QIDAHEN_REGION_GRAPH_NODES.map((node) => [node.id, node]));

export const getQidahenBoundaryTypeMeta = (boundaryType: QidahenPassageBoundaryType): QidahenPassageBoundaryMeta => (
    QIDAHEN_REGION_BOUNDARY_TYPES.find((item) => item.id === boundaryType)
        ?? DEFAULT_BOUNDARY_META_BY_ID.get(boundaryType)
        ?? DEFAULT_BOUNDARY_TYPES[0]
);

export const getQidahenDirectedPassage = (
    edge: QidahenRegionGraphEdge,
    from: string,
    to: string,
): QidahenDirectedPassage | null => {
    if (edge.from === from && edge.to === to) {
        return {
            edgeId: edge.id,
            from,
            to,
            boundaryType: edge.boundaryType,
            boundaryLabel: edge.boundaryLabel,
            travelCost: edge.travelCost,
            battleWidth: edge.battleWidth,
            ruleNote: edge.ruleNote,
            unitCap: edge.unitCap,
        };
    }
    if (
        edge.bidirectional
        && edge.to === from
        && edge.from === to
        && edge.reverseBoundaryType
        && edge.reverseBoundaryLabel
        && edge.reverseTravelCost
        && edge.reverseBattleWidth
        && edge.reverseRuleNote
    ) {
        return {
            edgeId: edge.id,
            from,
            to,
            boundaryType: edge.reverseBoundaryType,
            boundaryLabel: edge.reverseBoundaryLabel,
            travelCost: edge.reverseTravelCost,
            battleWidth: edge.reverseBattleWidth,
            ruleNote: edge.reverseRuleNote,
            unitCap: edge.reverseUnitCap,
        };
    }
    return null;
};

export const findQidahenRegionGraphEdge = (
    edges: readonly QidahenRegionGraphEdge[],
    from: string,
    to: string,
): QidahenRegionGraphEdge | null => {
    const id = normalizeQidahenPassageId(from, to);
    return edges.find((edge) => normalizeQidahenPassageId(edge.from, edge.to) === id) ?? null;
};

export const getQidahenPassageBetween = (from: string, to: string): QidahenRegionGraphEdge | null => (
    findQidahenRegionGraphEdge(QIDAHEN_REGION_GRAPH_EDGES, from, to)
);

export const getQidahenDirectedPassageBetween = (from: string, to: string): QidahenDirectedPassage | null => {
    const edge = getQidahenPassageBetween(from, to);
    return edge ? getQidahenDirectedPassage(edge, from, to) : null;
};

export const QIDAHEN_RUNTIME_REGION_DEFINITIONS: QidahenRuntimeRegionDefinition[] = QIDAHEN_RUNTIME_REGION_SOURCE_DEFINITIONS.map((region) => {
    const graphNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(region.id);
    const adjacentRegionIds = region.links.filter((linkId) => QIDAHEN_RUNTIME_REGION_SOURCE_BY_ID.has(linkId)).sort();
    const travelCostByRegionId: Record<string, number> = {};
    const movementCostByRegionId: Record<string, number> = {};
    const boundaryTypeByRegionId: Record<string, QidahenPassageBoundaryType> = {};
    for (const adjacentRegionId of adjacentRegionIds) {
        const passage = getQidahenDirectedPassageBetween(region.id, adjacentRegionId);
        const boundaryType = passage?.boundaryType ?? 'plain';
        const meta = getQidahenBoundaryTypeMeta(boundaryType);
        travelCostByRegionId[adjacentRegionId] = passage?.travelCost ?? meta.travelCost;
        movementCostByRegionId[adjacentRegionId] = passage?.battleWidth ?? meta.battleWidth;
        boundaryTypeByRegionId[adjacentRegionId] = boundaryType;
    }
    return {
        ...region,
        center: graphNode?.center ?? graphNode?.seed ?? region.seed,
        pixelCount: graphNode?.pixelCount ?? 0,
        adjacentRegionIds,
        travelCostByRegionId,
        movementCostByRegionId,
        boundaryTypeByRegionId,
    };
});
export const QIDAHEN_RUNTIME_REGION_BY_ID = new Map(QIDAHEN_RUNTIME_REGION_DEFINITIONS.map((region) => [region.id, region]));
export const QIDAHEN_RUNTIME_REGION_IDS_BY_PRINTED_REGION_ID = QIDAHEN_RUNTIME_REGION_DEFINITIONS.reduce<Map<string, string[]>>(
    (map, region) => {
        for (const printedRegionId of region.printedRegionIds) {
            const current = map.get(printedRegionId) ?? [];
            if (!current.includes(region.id)) {
                current.push(region.id);
            }
            map.set(printedRegionId, current);
        }
        return map;
    },
    new Map<string, string[]>(),
);
export const QIDAHEN_AUTHORITATIVE_GUIDE_RUNTIME_REGION_ID_SET = new Set(
    extractQidahenFormalAuthoritativeGuideRuntimeRegionIds(authoritativeGuidesData),
);

export const getQidahenRuntimeRegionIdsForPrintedRegionId = (printedRegionId: string): string[] => (
    [...(QIDAHEN_RUNTIME_REGION_IDS_BY_PRINTED_REGION_ID.get(printedRegionId) ?? [])]
);

export const getQidahenPrintedRegionIdsForRuntimeRegionId = (runtimeRegionId: string): string[] => (
    [...(QIDAHEN_RUNTIME_REGION_BY_ID.get(runtimeRegionId)?.printedRegionIds ?? [runtimeRegionId])]
);

export const getQidahenRuntimeRegionAnchorTargetPoint = (runtimeRegionId: string): QidahenRegionGraphPoint | null => (
    QIDAHEN_RUNTIME_REGION_BY_ID.get(runtimeRegionId)?.seed
    ?? QIDAHEN_RUNTIME_REGION_BY_ID.get(runtimeRegionId)?.center
    ?? null
);

export const resolveQidahenRuntimeRegionIdFromPrintedRegionId = (
    printedRegionId: string,
    preferredRuntimeRegionIds: readonly string[] = [],
): string => {
    const runtimeRegionIds = getQidahenRuntimeRegionIdsForPrintedRegionId(printedRegionId);
    if (runtimeRegionIds.length === 0) {
        return printedRegionId;
    }
    const preferredRuntimeRegionId = preferredRuntimeRegionIds.find((runtimeRegionId) => runtimeRegionIds.includes(runtimeRegionId));
    return preferredRuntimeRegionId ?? runtimeRegionIds[0];
};

export const getQidahenSharedPrintedRegionAudits = (
    visibleRuntimeRegionIds: readonly string[] = QIDAHEN_RUNTIME_REGION_DEFINITIONS.map((region) => region.id),
): QidahenSharedPrintedRegionAudit[] => {
    const visibleRuntimeRegionIdSet = new Set(visibleRuntimeRegionIds);
    const printedRegionIds = [...new Set(
        visibleRuntimeRegionIds.flatMap((runtimeRegionId) => getQidahenPrintedRegionIdsForRuntimeRegionId(runtimeRegionId)),
    )];

    return printedRegionIds
        .map((printedRegionId) => {
            const runtimeRegionIds = getQidahenRuntimeRegionIdsForPrintedRegionId(printedRegionId)
                .filter((runtimeRegionId) => visibleRuntimeRegionIdSet.has(runtimeRegionId));
            return {
                printedRegionId,
                runtimeRegionIds,
                missingAuthoritativeRuntimeIds: runtimeRegionIds.filter(
                    (runtimeRegionId) => !QIDAHEN_AUTHORITATIVE_GUIDE_RUNTIME_REGION_ID_SET.has(runtimeRegionId),
                ),
            };
        })
        .filter((audit) => audit.runtimeRegionIds.length > 1)
        .sort((left, right) => left.printedRegionId.localeCompare(right.printedRegionId, 'zh-CN'));
};

export const QIDAHEN_FORMAL_SHARED_PRINTED_REGION_AUDITS = getQidahenSharedPrintedRegionAudits();

export const hasQidahenFormalRegionGraph = (): boolean => (
    QIDAHEN_PRINTED_REGION_GRAPH_NODES.some((node) => node.center != null && node.pixelCount > 0)
        || QIDAHEN_PRINTED_REGION_GRAPH_EDGES.length > 0
);

const parseHexColor = (value: unknown): [number, number, number] | null => {
    if (typeof value !== 'string') return null;
    const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
    if (!match) return null;
    const hex = match[1];
    return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
    ];
};

export const buildQidahenRegionMaskColorMap = (raw: unknown): Record<number, string> => {
    const source = isRecord(raw) ? raw : {};
    const regions = Array.isArray(source.regions) ? source.regions : [];
    return regions.reduce<Record<number, string>>((colorMap, item) => {
        if (!isRecord(item)) return colorMap;
        const id = toStringOrEmpty(item.id);
        const color = parseHexColor(item.color);
        if (!id || !color) return colorMap;
        colorMap[qidahenRegionColorKey(color[0], color[1], color[2])] = id;
        return colorMap;
    }, {});
};

export const QIDAHEN_REGION_ID_BY_MASK_COLOR = buildQidahenRegionMaskColorMap(printedRegionMaskRegionsData);
