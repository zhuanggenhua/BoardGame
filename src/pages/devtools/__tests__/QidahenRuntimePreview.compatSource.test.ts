import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = () => readFileSync(resolve(TEST_DIR, '..', 'QidahenRuntimePreview.tsx'), 'utf8');

describe('QidahenRuntimePreview compatibility source guards', () => {
    it('运行时预览底图必须固定走本地 /assets，不能被远端资源基址带跑', () => {
        const source = readSource();

        expect(source).toContain("const DEFAULT_MAP_PATH = '/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png';");
        expect(source).not.toContain("getLocalAssetPath('i18n/zh-CN/qidahen/board/qidahen-main-map.png')");
    });

    it('会显式暴露共享 printed 图块对应多个 runtime 的真相，而不是继续把它们当成单一区', () => {
        const source = readSource();

        expect(source).toContain('const sharedPrintedMappings = React.useMemo(() => (');
        expect(source).toContain('buildQidahenSharedPrintedRegionMappings({');
        expect(source).toContain('visiblePrintedRegionIds: (state.graph?.nodes ?? []).map((node) => node.id)');
        expect(source).toContain('visibleRuntimeRegionIds: (state.graph?.nodes ?? []).map((node) => node.id)');
        expect(source).toContain('data-testid="qidahen-runtime-preview-shared-printed-panel"');
        expect(source).toContain('data-testid="qidahen-runtime-preview-shared-printed-empty"');
        expect(source).toContain('data-testid={`qidahen-runtime-preview-shared-printed-${mapping.printedRegionId}`}');
    });

    it('runtime preview debug 快照会带出共享 printed 区计数，供 E2E 直接读真相', () => {
        const source = readSource();

        expect(source).toContain('sharedPrintedRegionCount: sharedPrintedMappings.length');
        expect(source).toContain('sharedPrintedRegionIds: sharedPrintedMappings.map((item) => item.printedRegionId)');
        expect(source).toContain('sharedPrintedRegionRuntimeIdsByPrintedId: Object.fromEntries(');
        expect(source).toContain('const sharedPrintedGuideCandidateCount = React.useMemo(() => (');
        expect(source).toContain('sharedPrintedRegionRuntimeGuideCandidateCount: sharedPrintedGuideCandidateCount');
        expect(source).toContain("t('devtools.runtimePreview.stats'");
        expect(source).toContain('sharedPrinted: sharedPrintedMappings.length');
        expect(source).toContain('candidates: sharedPrintedGuideCandidateCount');
    });

    it('会把共享 printed 区缺失的 authoritative guide 直接标出来，而不是继续默认视为已完成', () => {
        const source = readSource();

        expect(source).toContain('const formalSharedPrintedMappings = React.useMemo(() => (');
        expect(source).toContain('buildQidahenSharedPrintedRegionMappings()');
        expect(source).toContain('const sharedPrintedMissingGuideCount = React.useMemo(() => (');
        expect(source).toContain('sharedPrintedRegionMissingGuideCount: sharedPrintedMissingGuideCount');
        expect(source).toContain('sharedPrintedRegionMissingGuideRuntimeIdsByPrintedId: Object.fromEntries(');
        expect(source).toContain('data-testid={`qidahen-runtime-preview-shared-printed-missing-guide-${mapping.printedRegionId}`}');
        expect(source).toContain("t('devtools.runtimePreview.sharedPrinted.missingGuide'");
        expect(source).toContain("t('devtools.runtimePreview.sharedPrinted.guideComplete'");
        expect(source).toContain('data-testid="qidahen-runtime-preview-formal-shared-printed-panel"');
        expect(source).toContain('data-testid="qidahen-runtime-preview-formal-shared-printed-summary"');
        expect(source).toContain('data-testid={`qidahen-runtime-preview-formal-shared-printed-${mapping.printedRegionId}`}');
        expect(source).toContain('formalSharedPrintedRegionCount: formalSharedPrintedMappings.length');
        expect(source).toContain('formalSharedPrintedRegionMissingGuideCount: formalSharedPrintedMissingGuideCount');
    });

    it('会读取工作区 load route 里的 runtime guide candidates，并在 shared printed 面板直接暴露出来', () => {
        const source = readSource();

        expect(source).toContain("const LOAD_ENDPOINT = '/devtools/qidahen-region-mask/load';");
        expect(source).toContain('readQidahenRegionMaskLoadPayload');
        expect(source).toContain('normalizeLoadedRuntimeGuideCandidates');
        expect(source).toContain('runtimeGuideCandidates: RuntimeGuideCandidate[]');
        expect(source).toContain('data-testid="qidahen-runtime-preview-shared-printed-candidate-summary"');
        expect(source).toContain('data-testid={`qidahen-runtime-preview-shared-printed-runtime-guide-candidates-${mapping.printedRegionId}`}');
        expect(source).toContain("t('devtools.runtimePreview.sharedPrinted.pendingCandidates'");
    });

    it('maskUrl 必须先声明再进入共享 printed 预览 effect，避免初始化前访问', () => {
        const source = readSource();
        const maskUrlDeclarationIndex = source.indexOf('const maskUrl = React.useMemo(() => (');
        const previewEffectIndex = source.indexOf('const loadPreviewCards = async () => {');
        const imageSrcIndex = source.indexOf('image.src = maskUrl;');

        expect(maskUrlDeclarationIndex).toBeGreaterThanOrEqual(0);
        expect(previewEffectIndex).toBeGreaterThan(maskUrlDeclarationIndex);
        expect(imageSrcIndex).toBeGreaterThan(maskUrlDeclarationIndex);
    });
});
