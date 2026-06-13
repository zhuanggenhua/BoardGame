import { describe, expect, it } from 'vitest';
import {
    buildQidahenRuntimeGuideCandidateKey,
    extractQidahenFormalAuthoritativeGuideRuntimeRegionIds,
    normalizeQidahenFormalAuthoritativeGuides,
    normalizeQidahenRegionMaskAuthoritativeWorkspaceMeta,
    normalizeQidahenRegionMaskRuntimeGuideCandidates,
    readQidahenRegionMaskAuthoritativeWorkspaceMetaCompat,
} from '../regionAuthoritativeGuideFormats';

describe('七大恨区域 guide 格式真相', () => {
    it('正式 authoritative guide 数组会去重并抽出 runtime 区 id', () => {
        const input = [
            { runtimeRegionId: 'city-region-15', label: '辽北', confidence: 'medium', source: 'crop-a' },
            { runtimeRegionId: 'city-region-15', label: '辽北重复', confidence: 'low', source: 'crop-b' },
            { runtimeRegionId: 'city-region-15-liaodong', label: '辽东', confidence: 'medium', source: 'crop-c', note: 'shared printed' },
            { label: '坏数据' },
        ];

        expect(normalizeQidahenFormalAuthoritativeGuides(input)).toEqual([
            { runtimeRegionId: 'city-region-15', label: '辽北重复', confidence: 'low', source: 'crop-b' },
            { runtimeRegionId: 'city-region-15-liaodong', label: '辽东', confidence: 'medium', source: 'crop-c', note: 'shared printed' },
        ]);
        expect(extractQidahenFormalAuthoritativeGuideRuntimeRegionIds(input)).toEqual([
            'city-region-15',
            'city-region-15-liaodong',
        ]);
    });

    it('工作区 runtime-only guide 候选按 printed/runtime 键去重并排序', () => {
        const input = [
            { runtimeRegionId: 'city-region-28', printedRegionId: 'city-region-28', label: '顺天', source: 'crop-b', note: 'later' },
            { runtimeRegionId: 'city-region-15-liaodong', printedRegionId: 'city-region-15', source: 'crop-a' },
            { runtimeRegionId: 'city-region-28', printedRegionId: 'city-region-28', label: '顺天更新', source: 'crop-c', note: 'override' },
            { runtimeRegionId: 'city-region-15', printedRegionId: 'city-region-15', label: '辽北', source: 'crop-d' },
        ];

        expect(normalizeQidahenRegionMaskRuntimeGuideCandidates(input, (runtimeRegionId) => `fallback:${runtimeRegionId}`)).toEqual([
            {
                runtimeRegionId: 'city-region-15',
                printedRegionId: 'city-region-15',
                label: '辽北',
                source: 'crop-d',
                note: '',
            },
            {
                runtimeRegionId: 'city-region-15-liaodong',
                printedRegionId: 'city-region-15',
                label: 'fallback:city-region-15-liaodong',
                source: 'crop-a',
                note: '',
            },
            {
                runtimeRegionId: 'city-region-28',
                printedRegionId: 'city-region-28',
                label: '顺天更新',
                source: 'crop-c',
                note: 'override',
            },
        ]);
        expect(buildQidahenRuntimeGuideCandidateKey('city-region-15', 'city-region-15-liaodong')).toBe('city-region-15::city-region-15-liaodong');
    });

    it('compat 读取会把旧正式数组当成旧工作区来源，但不会伪造 runtime-only guide 候选', () => {
        const legacyFormalArray = [
            { runtimeRegionId: 'city-region-19', label: '敖汉部', confidence: 'high', source: 'crop-a' },
            { runtimeRegionId: 'city-region-19-liaoxi', label: '辽西', confidence: 'medium', source: 'crop-b' },
        ];

        expect(readQidahenRegionMaskAuthoritativeWorkspaceMetaCompat(legacyFormalArray)).toEqual({
            regionIds: ['city-region-19', 'city-region-19-liaoxi'],
            runtimeGuideCandidates: [],
        });
    });

    it('正式工作区 metadata 只接受 object 结构，并保留显式 truth 与 runtime-only guide 候选', () => {
        const workspaceMeta = {
            regionIds: ['city-region-15', 'city-region-15', 'city-region-28'],
            runtimeGuideCandidates: [
                { runtimeRegionId: 'city-region-15-liaodong', printedRegionId: 'city-region-15', source: 'crop-a' },
            ],
        };

        expect(normalizeQidahenRegionMaskAuthoritativeWorkspaceMeta(
            workspaceMeta,
            (runtimeRegionId) => `label:${runtimeRegionId}`,
        )).toEqual({
            regionIds: ['city-region-15', 'city-region-28'],
            runtimeGuideCandidates: [
                {
                    runtimeRegionId: 'city-region-15-liaodong',
                    printedRegionId: 'city-region-15',
                    label: 'label:city-region-15-liaodong',
                    source: 'crop-a',
                    note: '',
                },
            ],
        });
    });
});
