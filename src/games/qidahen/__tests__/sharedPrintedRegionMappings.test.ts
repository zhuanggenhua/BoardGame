import { describe, expect, it } from 'vitest';
import { buildQidahenSharedPrintedRegionMappings } from '../sharedPrintedRegionMappings';

describe('七大恨 shared printed 映射辅助层', () => {
    it('会把正式 shared printed 审计扩成统一行模型，并区分当前工作区缺的是 authoritative 还是 runtime-only', () => {
        const mappings = buildQidahenSharedPrintedRegionMappings({
            visiblePrintedRegionIds: ['city-region-15', 'city-region-19', 'city-region-28'],
            visibleRuntimeRegionIds: ['city-region-15', 'city-region-19', 'city-region-28'],
            runtimeGuideCandidates: [
                {
                    runtimeRegionId: 'city-region-15-liaodong',
                    printedRegionId: 'city-region-15',
                    label: '辽东',
                    source: 'workspace-candidate',
                    note: 'runtime only',
                },
            ],
        });

        expect(mappings).toHaveLength(3);
        const liaobeiMapping = mappings.find((mapping) => mapping.printedRegionId === 'city-region-15');
        expect(liaobeiMapping).toMatchObject({
            printedRegionId: 'city-region-15',
            printedRegionName: '辽北',
            runtimeRegionIds: ['city-region-15', 'city-region-15-liaodong'],
            runtimeRegionNames: ['辽北', '辽东'],
            missingAuthoritativeRuntimeIds: [],
            missingRuntimeOnlyGuideIds: [],
        });
        expect(liaobeiMapping?.runtimeGuideCandidates).toEqual([
            {
                runtimeRegionId: 'city-region-15-liaodong',
                printedRegionId: 'city-region-15',
                label: '辽东',
                source: 'workspace-candidate',
                note: 'runtime only',
            },
        ]);
    });

    it('formal 行模型在不传工作区可见集合时不会误报 runtime-only 缺口', () => {
        const mappings = buildQidahenSharedPrintedRegionMappings();

        expect(mappings.every((mapping) => mapping.missingRuntimeOnlyGuideIds.length === 0)).toBe(true);
        expect(mappings.every((mapping) => mapping.runtimeGuideCandidates.length === 0)).toBe(true);
    });
});
