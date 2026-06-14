import { describe, expect, it } from 'vitest';
import {
    createQidahenRegionMaskSavePayload,
    normalizeQidahenRegionMaskSaveResult,
    readQidahenRegionMaskLoadPayload,
} from '../regionMaskWorkspaceBridge';

describe('七大恨 region-mask 工作区 bridge', () => {
    it('会把 load route 结果正规化，并兼容旧正式 guide 数组结构', () => {
        const payload = readQidahenRegionMaskLoadPayload({
            ok: true,
            outputDir: 'src/games/qidahen/data',
            maskPngDataUrl: 'data:image/png;base64,mask',
            boundaryMaskPngDataUrl: 'data:image/png;base64,boundary',
            barrierHints: {
                addPngDataUrl: 'data:image/png;base64,add',
                removePngDataUrl: null,
            },
            authoritativeGuides: [
                { runtimeRegionId: 'city-region-15', label: '辽北', confidence: 'medium', source: 'crop-a' },
                { runtimeRegionId: 'city-region-15-liaodong', label: '辽东', confidence: 'medium', source: 'crop-b' },
            ],
            boundarySourceReferencePngDataUrl: '',
            regions: { regions: [{ id: 'city-region-15' }] },
            graph: { nodes: [{ id: 'city-region-15' }], edges: [] },
        });

        expect(payload).toEqual({
            ok: true,
            outputDir: 'src/games/qidahen/data',
            maskPngDataUrl: 'data:image/png;base64,mask',
            boundaryMaskPngDataUrl: 'data:image/png;base64,boundary',
            barrierHints: {
                addPngDataUrl: 'data:image/png;base64,add',
                removePngDataUrl: null,
            },
            boundarySourceReferencePngDataUrl: null,
            authoritativeGuides: {
                maskPngDataUrl: null,
                regionIds: ['city-region-15', 'city-region-15-liaodong'],
                runtimeGuideCandidates: [],
            },
            regions: { regions: [{ id: 'city-region-15' }] },
            graph: { nodes: [{ id: 'city-region-15' }], edges: [] },
        });
    });

    it('会把 save result 正规化为稳定字符串数组', () => {
        expect(normalizeQidahenRegionMaskSaveResult({
            ok: true,
            outputDir: 'temp/devtools/qidahen',
            files: ['region-mask.png', 'region-mask.png', 1, null],
            internalFiles: ['region-boundary-mask.png', undefined, 'region-boundary-mask.png'],
        })).toEqual({
            ok: true,
            outputDir: 'temp/devtools/qidahen',
            files: ['region-mask.png'],
            internalFiles: ['region-boundary-mask.png'],
        });
    });

    it('会把 save request 正规化为统一 scope 与 authoritative guide 结构', () => {
        expect(createQidahenRegionMaskSavePayload({
            saveScope: 'unknown' as never,
            maskPngDataUrl: 'data:image/png;base64,mask',
            authoritativeGuides: {
                maskPngDataUrl: 'data:image/png;base64,guide',
                regionIds: ['city-region-15', 'city-region-15'],
                runtimeGuideCandidates: [
                    { runtimeRegionId: 'city-region-15-liaodong', printedRegionId: 'city-region-15', source: 'crop-a' },
                ],
            },
        })).toEqual({
            saveScope: 'all',
            maskPngDataUrl: 'data:image/png;base64,mask',
            authoritativeGuides: {
                maskPngDataUrl: 'data:image/png;base64,guide',
                regionIds: ['city-region-15'],
                runtimeGuideCandidates: [
                    {
                        runtimeRegionId: 'city-region-15-liaodong',
                        printedRegionId: 'city-region-15',
                        label: 'city-region-15-liaodong',
                        source: 'crop-a',
                        note: '',
                    },
                ],
            },
        });
    });

    it('缺少正式 mask PNG 时会直接报错，不允许页面各自脑补空 payload', () => {
        expect(() => readQidahenRegionMaskLoadPayload({ ok: true })).toThrow('缺少已保存的 mask PNG');
    });
});
