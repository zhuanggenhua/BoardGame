import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = () => readFileSync(resolve(TEST_DIR, '..', 'QidahenRegionMaskTool.tsx'), 'utf8');

describe('QidahenRegionMaskTool compatibility source guards', () => {
    it('区域蒙版工具底图必须固定走本地 /assets，不能被远端资源基址带跑', () => {
        const source = readSource();

        expect(source).toContain("const DEFAULT_MAP_PATH = '/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png';");
        expect(source).not.toContain("getLocalAssetPath('i18n/zh-CN/qidahen/board/qidahen-main-map.png')");
    });

    it('会把 shared printed 缺 guide 与当前工具模型的 runtime-only blocker 直接暴露出来', () => {
        const source = readSource();

        expect(source).toContain('buildQidahenSharedPrintedRegionMappings');
        expect(source).toContain('const sharedPrintedGuideAuditRows = React.useMemo(() => {');
        expect(source).toContain('const visibleRuntimeRegionIds = [...new Set(');
        expect(source).toContain('getQidahenRuntimeRegionIdsForPrintedRegionId(printedRegionId)');
        expect(source).toContain('visibleRuntimeRegionIds,');
        expect(source).toContain('missingRuntimeOnlyGuideIds');
        expect(source).toContain('data-testid="qidahen-shared-printed-guide-audit-panel"');
        expect(source).toContain('data-testid="qidahen-shared-printed-guide-audit-summary"');
        expect(source).toContain('当前工具只能把 guide 写到当前 regions 里的 id');
        expect(source).toContain('formal shared printed 缺口');
    });

    it('选中 shared printed 区时会继续提示 runtime-only guide 缺口，而不是只显示普通显式 truth 按钮', () => {
        const source = readSource();

        expect(source).toContain('const selectedSharedPrintedGuideAudit = React.useMemo(() => (');
        expect(source).toContain('const selectedRuntimeGuideCandidateRows = React.useMemo(() => {');
        expect(source).toContain('runtimeGuideCandidates');
        expect(source).toContain('buildQidahenRuntimeGuideCandidateByKey');
        expect(source).toContain('data-testid={`qidahen-shared-printed-guide-audit-selected-${selectedRegion.id}`}');
        expect(source).toContain('这个 printed 区当前同时承接 runtime：');
        expect(source).toContain('当前工具保存的 guide 目标仍绑定 `regionIds`');
        expect(source).toContain("saveScope: 'authoritative-guides'");
        expect(source).toContain('const saveAuthoritativeGuidesOnly = async () => {');
        expect(source).toContain('记录待补条目');
        expect(source).toContain('data-testid={`qidahen-runtime-guide-candidate-add-${row.runtimeRegionId}`}');
        expect(source).toContain('data-testid={`qidahen-runtime-guide-candidate-source-${row.runtimeRegionId}`}');
        expect(source).toContain('data-testid={`qidahen-runtime-guide-candidate-note-${row.runtimeRegionId}`}');
        expect(source).toContain('data-testid="qidahen-save-authoritative-guides-only"');
        expect(source).toContain('仅保存 guide 候选');
        expect(source).toContain("t('devtools.regionMaskTool.boundaryRuleLabel'");
        expect(source).toContain("t('devtools.regionMaskTool.modeSummary'");
    });

    it('所有保存入口都会走共享 workspace payload builder，而不是继续各自手拼匿名 save request', () => {
        const source = readSource();

        expect(source).toContain('createQidahenRegionMaskSavePayload');
        expect(source).toContain('const postWorkspaceSavePayload = async (payload: QidahenRegionMaskSavePayload) => {');
        expect(source).toContain('const normalizedPayload = createQidahenRegionMaskSavePayload(payload);');
        expect(source).toContain('getQidahenRegionMaskSaveBlockedReason');
        expect(source).toContain('const blockSaveUntilWorkspaceLoaded = () => {');
        expect(source).toContain('workspaceLoadState');
    });

    it('按边界生成正式区时以自动填充后的闭合块为来源，再把闭合块匹配到已有正式区名称', () => {
        const source = readSource();

        expect(source).toContain('const generatedComponents: GeneratedBoundaryComponent[] = [];');
        expect(source).toContain('const nextGeneratedRegions: PainterRegion[] = [];');
        expect(source).toContain('generatedComponents.push({');
        expect(source).toContain('const fallbackId = `generated-region-${componentIndex + 1}`;');
        expect(source).toContain('name: existingRegion?.name ?? `区域 ${componentIndex + 1}`');
        expect(source).toContain('setRegions(nextGeneratedRegions);');
        expect(source).toContain('setLastBoundaryComponentDiagnostics({');
        expect(source).toContain('ignored:no-anchor');
    });
});
