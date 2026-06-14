export type QidahenFormalAuthoritativeGuide = {
    runtimeRegionId: string;
    label: string;
    confidence: string;
    source: string;
    note?: string;
};

export type QidahenRegionMaskRuntimeGuideCandidate = {
    runtimeRegionId: string;
    printedRegionId: string;
    label: string;
    source: string;
    note: string;
};

export type QidahenRegionMaskAuthoritativeWorkspaceMeta = {
    regionIds: string[];
    runtimeGuideCandidates: QidahenRegionMaskRuntimeGuideCandidate[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeUniqueStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const unique = new Set<string>();
    for (const candidate of value) {
        if (typeof candidate === 'string') {
            unique.add(candidate);
        }
    }
    return [...unique];
};

export const buildQidahenRuntimeGuideCandidateKey = (printedRegionId: string, runtimeRegionId: string) => (
    `${printedRegionId}::${runtimeRegionId}`
);

export const normalizeQidahenRegionMaskStringArray = (value: unknown): string[] => (
    normalizeUniqueStringArray(value)
);

export const normalizeQidahenFormalAuthoritativeGuides = (value: unknown): QidahenFormalAuthoritativeGuide[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const guides = new Map<string, QidahenFormalAuthoritativeGuide>();
    for (const candidate of value) {
        if (!isRecord(candidate)) {
            continue;
        }
        const runtimeRegionId = typeof candidate.runtimeRegionId === 'string' ? candidate.runtimeRegionId : '';
        if (!runtimeRegionId) {
            continue;
        }
        guides.set(runtimeRegionId, {
            runtimeRegionId,
            label: typeof candidate.label === 'string' ? candidate.label : runtimeRegionId,
            confidence: typeof candidate.confidence === 'string' ? candidate.confidence : '',
            source: typeof candidate.source === 'string' ? candidate.source : '',
            ...(typeof candidate.note === 'string' ? { note: candidate.note } : {}),
        });
    }
    return [...guides.values()];
};

export const extractQidahenFormalAuthoritativeGuideRuntimeRegionIds = (value: unknown): string[] => (
    normalizeQidahenFormalAuthoritativeGuides(value).map((guide) => guide.runtimeRegionId)
);

export const normalizeQidahenRegionMaskRuntimeGuideCandidates = (
    value: unknown,
    resolveLabel: (runtimeRegionId: string) => string = (runtimeRegionId) => runtimeRegionId,
): QidahenRegionMaskRuntimeGuideCandidate[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const candidates = new Map<string, QidahenRegionMaskRuntimeGuideCandidate>();
    for (const candidate of value) {
        if (!isRecord(candidate)) {
            continue;
        }
        const runtimeRegionId = typeof candidate.runtimeRegionId === 'string' ? candidate.runtimeRegionId : '';
        const printedRegionId = typeof candidate.printedRegionId === 'string' ? candidate.printedRegionId : '';
        if (!runtimeRegionId || !printedRegionId) {
            continue;
        }
        candidates.set(buildQidahenRuntimeGuideCandidateKey(printedRegionId, runtimeRegionId), {
            runtimeRegionId,
            printedRegionId,
            label: typeof candidate.label === 'string' ? candidate.label : resolveLabel(runtimeRegionId),
            source: typeof candidate.source === 'string' ? candidate.source : '',
            note: typeof candidate.note === 'string' ? candidate.note : '',
        });
    }
    return [...candidates.values()].sort((left, right) => (
        buildQidahenRuntimeGuideCandidateKey(left.printedRegionId, left.runtimeRegionId)
            .localeCompare(buildQidahenRuntimeGuideCandidateKey(right.printedRegionId, right.runtimeRegionId))
    ));
};

export const normalizeQidahenRegionMaskAuthoritativeWorkspaceMeta = (
    value: unknown,
    resolveLabel?: (runtimeRegionId: string) => string,
): QidahenRegionMaskAuthoritativeWorkspaceMeta => {
    if (!isRecord(value)) {
        return {
            regionIds: [],
            runtimeGuideCandidates: [],
        };
    }

    return {
        regionIds: normalizeQidahenRegionMaskStringArray(value.regionIds),
        runtimeGuideCandidates: normalizeQidahenRegionMaskRuntimeGuideCandidates(value.runtimeGuideCandidates, resolveLabel),
    };
};

export const readQidahenRegionMaskAuthoritativeWorkspaceMetaCompat = (
    value: unknown,
    resolveLabel?: (runtimeRegionId: string) => string,
): QidahenRegionMaskAuthoritativeWorkspaceMeta => {
    if (Array.isArray(value)) {
        return {
            regionIds: extractQidahenFormalAuthoritativeGuideRuntimeRegionIds(value),
            runtimeGuideCandidates: [],
        };
    }
    return normalizeQidahenRegionMaskAuthoritativeWorkspaceMeta(value, resolveLabel);
};
