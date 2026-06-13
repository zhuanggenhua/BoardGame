import {
    normalizeQidahenRegionMaskStringArray,
    readQidahenRegionMaskAuthoritativeWorkspaceMetaCompat,
    type QidahenRegionMaskAuthoritativeWorkspaceMeta,
} from './regionAuthoritativeGuideFormats.ts';

export type QidahenRegionMaskBarrierHintsPayload = {
    addPngDataUrl: string | null;
    removePngDataUrl: string | null;
};

export type QidahenRegionMaskSaveScope =
    | 'all'
    | 'boundary'
    | 'regions'
    | 'graph'
    | 'authoritative-guides';

export type QidahenRegionMaskAuthoritativeGuidesPayload = QidahenRegionMaskAuthoritativeWorkspaceMeta & {
    maskPngDataUrl: string | null;
};

export type QidahenRegionMaskSavePayload = {
    saveScope?: QidahenRegionMaskSaveScope;
    maskPngDataUrl?: string | null;
    boundaryMaskPngDataUrl?: string | null;
    barrierHints?: QidahenRegionMaskBarrierHintsPayload;
    boundarySourceReferencePngDataUrl?: string | null;
    authoritativeGuides?: QidahenRegionMaskAuthoritativeGuidesPayload | null;
    regions?: unknown;
    graph?: unknown;
};

export type QidahenRegionMaskRegionsPayload = {
    boundaryRules?: unknown;
    boundaryExpansion?: unknown;
    regionColorTolerance?: unknown;
    paintedBoundaryOnly?: unknown;
    regions?: unknown;
};

export type QidahenRegionMaskGraphPayload = {
    nodes?: unknown;
    edges?: unknown;
};

export type QidahenRegionMaskLoadPayload = {
    ok: boolean;
    outputDir: string | null;
    maskPngDataUrl: string;
    boundaryMaskPngDataUrl: string | null;
    barrierHints: QidahenRegionMaskBarrierHintsPayload;
    boundarySourceReferencePngDataUrl: string | null;
    authoritativeGuides: QidahenRegionMaskAuthoritativeGuidesPayload | null;
    regions: QidahenRegionMaskRegionsPayload | null;
    graph: QidahenRegionMaskGraphPayload | null;
};

export type QidahenRegionMaskSaveResult = {
    ok: boolean;
    outputDir: string | null;
    files: string[];
    internalFiles: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const toNullableString = (value: unknown): string | null => (
    typeof value === 'string' && value.length > 0 ? value : null
);

export const normalizeQidahenRegionMaskSaveScope = (value: unknown): QidahenRegionMaskSaveScope => (
    value === 'boundary'
    || value === 'regions'
    || value === 'graph'
    || value === 'authoritative-guides'
        ? value
        : 'all'
);

export const createQidahenRegionMaskBarrierHintsPayload = (
    value?: Partial<QidahenRegionMaskBarrierHintsPayload> | null,
): QidahenRegionMaskBarrierHintsPayload => ({
    addPngDataUrl: value?.addPngDataUrl ?? null,
    removePngDataUrl: value?.removePngDataUrl ?? null,
});

export const createQidahenRegionMaskAuthoritativeGuidesPayload = (
    value?: Partial<QidahenRegionMaskAuthoritativeGuidesPayload> | null,
): QidahenRegionMaskAuthoritativeGuidesPayload => ({
    maskPngDataUrl: value?.maskPngDataUrl ?? null,
    regionIds: normalizeQidahenRegionMaskStringArray(value?.regionIds),
    runtimeGuideCandidates: readQidahenRegionMaskAuthoritativeWorkspaceMetaCompat({
        regionIds: value?.regionIds,
        runtimeGuideCandidates: value?.runtimeGuideCandidates,
    }).runtimeGuideCandidates,
});

export const createQidahenRegionMaskSavePayload = (
    value: QidahenRegionMaskSavePayload,
): QidahenRegionMaskSavePayload => {
    const payload: QidahenRegionMaskSavePayload = {
        saveScope: normalizeQidahenRegionMaskSaveScope(value.saveScope),
    };

    if (value.maskPngDataUrl != null) {
        payload.maskPngDataUrl = value.maskPngDataUrl;
    }
    if (value.boundaryMaskPngDataUrl != null) {
        payload.boundaryMaskPngDataUrl = value.boundaryMaskPngDataUrl;
    }
    if (value.barrierHints != null) {
        payload.barrierHints = createQidahenRegionMaskBarrierHintsPayload(value.barrierHints);
    }
    if (value.boundarySourceReferencePngDataUrl !== undefined) {
        payload.boundarySourceReferencePngDataUrl = value.boundarySourceReferencePngDataUrl ?? null;
    }
    if (value.authoritativeGuides != null) {
        payload.authoritativeGuides = createQidahenRegionMaskAuthoritativeGuidesPayload(value.authoritativeGuides);
    }
    if (value.regions !== undefined) {
        payload.regions = value.regions;
    }
    if (value.graph !== undefined) {
        payload.graph = value.graph;
    }
    return payload;
};

export const readQidahenRegionMaskLoadPayload = (value: unknown): QidahenRegionMaskLoadPayload => {
    if (!isRecord(value) || typeof value.maskPngDataUrl !== 'string') {
        throw new Error('缺少已保存的 mask PNG');
    }

    const authoritativeGuides = value.authoritativeGuides == null
        ? null
        : {
            ...readQidahenRegionMaskAuthoritativeWorkspaceMetaCompat(value.authoritativeGuides),
            maskPngDataUrl: isRecord(value.authoritativeGuides)
                ? toNullableString(value.authoritativeGuides.maskPngDataUrl)
                : null,
        };

    return {
        ok: value.ok !== false,
        outputDir: toNullableString(value.outputDir),
        maskPngDataUrl: value.maskPngDataUrl,
        boundaryMaskPngDataUrl: toNullableString(value.boundaryMaskPngDataUrl),
        barrierHints: {
            addPngDataUrl: isRecord(value.barrierHints) ? toNullableString(value.barrierHints.addPngDataUrl) : null,
            removePngDataUrl: isRecord(value.barrierHints) ? toNullableString(value.barrierHints.removePngDataUrl) : null,
        },
        boundarySourceReferencePngDataUrl: toNullableString(value.boundarySourceReferencePngDataUrl),
        authoritativeGuides,
        regions: isRecord(value.regions) ? value.regions : null,
        graph: isRecord(value.graph) ? value.graph : null,
    };
};

export const normalizeQidahenRegionMaskSaveResult = (value: unknown): QidahenRegionMaskSaveResult => {
    if (!isRecord(value)) {
        return {
            ok: false,
            outputDir: null,
            files: [],
            internalFiles: [],
        };
    }

    return {
        ok: value.ok !== false,
        outputDir: toNullableString(value.outputDir),
        files: normalizeQidahenRegionMaskStringArray(value.files),
        internalFiles: normalizeQidahenRegionMaskStringArray(value.internalFiles),
    };
};
