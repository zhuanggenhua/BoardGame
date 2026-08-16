import {
    buildQidahenRuntimeGuideCandidateKey,
    type QidahenRegionMaskRuntimeGuideCandidate,
} from './regionAuthoritativeGuideFormats';
import {
    QIDAHEN_FORMAL_SHARED_PRINTED_REGION_AUDITS,
    QIDAHEN_MASK_REGION_BY_ID,
    QIDAHEN_RUNTIME_REGION_BY_ID,
} from './ui/mapGraph';

export type QidahenSharedPrintedRegionMapping = {
    printedRegionId: string;
    printedRegionName: string;
    runtimeRegionIds: string[];
    runtimeRegionNames: string[];
    missingAuthoritativeRuntimeIds: string[];
    missingAuthoritativeRuntimeNames: string[];
    missingRuntimeOnlyGuideIds: string[];
    missingRuntimeOnlyGuideNames: string[];
    runtimeGuideCandidates: QidahenRegionMaskRuntimeGuideCandidate[];
};

type BuildQidahenSharedPrintedRegionMappingsOptions = {
    visiblePrintedRegionIds?: readonly string[];
    visibleRuntimeRegionIds?: readonly string[];
    runtimeGuideCandidates?: readonly QidahenRegionMaskRuntimeGuideCandidate[];
    printedRegionNameById?: ReadonlyMap<string, string>;
    runtimeRegionNameById?: ReadonlyMap<string, string>;
};

const resolvePrintedRegionName = (
    printedRegionId: string,
    printedRegionNameById?: ReadonlyMap<string, string>,
) => (
    printedRegionNameById?.get(printedRegionId)
    ?? (QIDAHEN_MASK_REGION_BY_ID.get(printedRegionId) as { name?: string } | undefined)?.name
    ?? printedRegionId
);

const resolveRuntimeRegionName = (
    runtimeRegionId: string,
    runtimeRegionNameById?: ReadonlyMap<string, string>,
) => (
    runtimeRegionNameById?.get(runtimeRegionId)
    ?? QIDAHEN_RUNTIME_REGION_BY_ID.get(runtimeRegionId)?.name
    ?? runtimeRegionId
);

export const buildQidahenRuntimeGuideCandidateByKey = (
    runtimeGuideCandidates: readonly QidahenRegionMaskRuntimeGuideCandidate[],
) => new Map(runtimeGuideCandidates.map((candidate) => [
    buildQidahenRuntimeGuideCandidateKey(candidate.printedRegionId, candidate.runtimeRegionId),
    candidate,
] as const));

export const buildQidahenSharedPrintedRegionMappings = ({
    visiblePrintedRegionIds,
    visibleRuntimeRegionIds,
    runtimeGuideCandidates = [],
    printedRegionNameById,
    runtimeRegionNameById,
}: BuildQidahenSharedPrintedRegionMappingsOptions = {}): QidahenSharedPrintedRegionMapping[] => {
    const visiblePrintedRegionIdSet = visiblePrintedRegionIds ? new Set(visiblePrintedRegionIds) : null;
    const visibleRuntimeRegionIdSet = visibleRuntimeRegionIds ? new Set(visibleRuntimeRegionIds) : null;
    const runtimeGuideCandidateByKey = buildQidahenRuntimeGuideCandidateByKey(runtimeGuideCandidates);

    return QIDAHEN_FORMAL_SHARED_PRINTED_REGION_AUDITS
        .filter((audit) => visiblePrintedRegionIdSet == null || visiblePrintedRegionIdSet.has(audit.printedRegionId))
        .map((audit) => {
            const runtimeRegionNames = audit.runtimeRegionIds.map((runtimeRegionId) => (
                resolveRuntimeRegionName(runtimeRegionId, runtimeRegionNameById)
            ));
            const missingAuthoritativeRuntimeNames = audit.missingAuthoritativeRuntimeIds.map((runtimeRegionId) => (
                resolveRuntimeRegionName(runtimeRegionId, runtimeRegionNameById)
            ));
            const missingRuntimeOnlyGuideIds = visibleRuntimeRegionIdSet == null
                ? []
                : audit.missingAuthoritativeRuntimeIds.filter((runtimeRegionId) => !visibleRuntimeRegionIdSet.has(runtimeRegionId));
            return {
                ...audit,
                printedRegionName: resolvePrintedRegionName(audit.printedRegionId, printedRegionNameById),
                runtimeRegionNames,
                missingAuthoritativeRuntimeNames,
                missingRuntimeOnlyGuideIds,
                missingRuntimeOnlyGuideNames: missingRuntimeOnlyGuideIds.map((runtimeRegionId) => (
                    resolveRuntimeRegionName(runtimeRegionId, runtimeRegionNameById)
                )),
                runtimeGuideCandidates: audit.runtimeRegionIds.flatMap((runtimeRegionId) => {
                    const candidate = runtimeGuideCandidateByKey.get(
                        buildQidahenRuntimeGuideCandidateKey(audit.printedRegionId, runtimeRegionId),
                    );
                    return candidate ? [candidate] : [];
                }),
            };
        })
        .sort((left, right) => left.printedRegionName.localeCompare(right.printedRegionName, 'zh-CN'));
};
