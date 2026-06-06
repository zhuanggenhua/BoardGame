import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync, zipSync } from 'fflate';
import { QIDAHEN_MAP_REGION_SHAPES } from '../src/games/qidahen/ui/mapRegions';

type MaskColorCounts = {
    red: number;
    yellow: number;
    redCenter: { x: number; y: number } | null;
    yellowCenter: { x: number; y: number } | null;
    redBounds: { left: number; top: number; right: number; bottom: number } | null;
};

type RgbaPixel = readonly [number, number, number, number];
type ElementRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

const MASK_WIDTH = 1265;
const MASK_HEIGHT = 893;
const REGION_TRACE_TEMPLATE_WIDTH = 560;
const REGION_TRACE_TEMPLATE_HEIGHT = 420;
const BOUNDARY_GENERATED_REGION_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-boundary-generated-current.png';
const PATH_AUTO_PASSAGE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-path-auto-passage-current.png';
const SPECIFIED_BOUNDARY_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-specified-boundary-current.png';
const HAND_DRAWN_SOURCE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-source-current.png';
const REAL_MAP_HAND_DRAWN_SOURCE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-hand-drawn-source-current.png';
const REAL_MAP_EMPTY_SOURCE_PRESERVES_BOUNDARY_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-empty-source-preserves-boundary-current.png';
const REAL_MAP_COMPLETE_SOURCE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-complete-source-current.png';
const REAL_MAP_COMPLETE_GENERATED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-complete-generated-current.png';
const REAL_MAP_COMPLETE_REJECTED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-complete-rejected-current.png';
const REAL_MAP_LOCAL_SUPPORT_REJECTED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-local-support-rejected-current.png';
const REAL_MAP_LOCAL_SUPPORT_REPAIR_PREVIEW_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-local-support-repair-preview-current.png';
const REAL_MAP_LOCAL_SUPPORT_REPAIR_PACKAGE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-local-support-repair-package-current.png';
const REAL_MAP_LOCAL_SUPPORT_REPAIR_IMPORT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-local-support-repair-import-current.png';
const REAL_MAP_LOCAL_SUPPORT_BOUNDARY_LAYER_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-local-support-boundary-layer-current.png';
const REAL_MAP_LOCAL_SUPPORT_WEAK_OVERLAY_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-local-support-weak-overlay-current.png';
const REAL_MAP_LOCAL_SUPPORT_REPAIR_MAIN_MAP_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-local-support-repair-main-map-current.png';
const HAND_DRAWN_GENERATED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-generated-current.png';
const HAND_DRAWN_MULTI_DIAGNOSTICS_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-diagnostics-current.png';
const HAND_DRAWN_MULTI_CLOSED_ONLY_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-closed-only-current.png';
const HAND_DRAWN_MULTI_GENERATED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-generated-current.png';
const COMPLETED_BOUNDARY_IMPORT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-completed-boundary-import-current.png';
const IMPORTED_BOUNDARY_AUTO_PRUNED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-imported-boundary-auto-pruned-current.png';
const BARRIER_HINT_UNDO_REDO_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-barrier-hint-undo-redo-current.png';
const HAND_DRAWN_WORKSPACE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-workspace-current.png';
const HAND_DRAWN_PERSISTED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-persisted-current.png';
const HAND_DRAWN_REFERENCE_PERSISTED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-reference-persisted-current.png';
const HAND_DRAWN_REFERENCE_CLEARED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-reference-cleared-current.png';
const FORMAL_EMPTY_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-formal-empty-current.png';
const TRACE_ASSIST_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-trace-assist-current.png';
const TRACE_KIT_COLOR_LINE_DRAFT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-trace-kit-color-line-draft-current.png';
const TRACE_KIT_REPAIRED_IMPORT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-trace-kit-repaired-import-current.png';
const TRACE_BATCH_EXPORT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-export-current.png';
const TRACE_BATCH_IMPORT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-import-current.png';
const TRACE_BATCH_AUTO_REPAIR_PREVIEW_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-auto-repair-preview-current.png';
const BEST_AVAILABLE_BOUNDARY_DETOUR_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-detour-current.png';
const BEST_AVAILABLE_BOUNDARY_MOVE_COST_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-move-cost-current.png';
const BEST_AVAILABLE_BOUNDARY_MOVE_COST_RELOAD_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-move-cost-reload-current.png';
const BEST_AVAILABLE_MOVE_COST_EDITED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-move-cost-ready-edited-current.png';
const BEST_AVAILABLE_RUNTIME_PREVIEW_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-runtime-preview-best-available-move-cost-current.png';
const FORMAL_EMPTY_WORKSPACE_BEST_AVAILABLE_ENTRY_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-formal-empty-workspace-best-available-entry-current.png';
const FORMAL_EMPTY_NORMAL_ROUTE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-formal-empty-normal-route-current.png';
const ISOLATED_BOUNDARY_WORKFLOW_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-isolated-boundary-workflow-current.png';
const COMPLETE_ACCEPTANCE_OVERVIEW_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-complete-acceptance-overview-current.png';
const COMPLETE_ACCEPTANCE_SHOU_CHENG_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-complete-acceptance-shou-cheng-current.png';
const PARTITION_PREVIEW_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-partition-preview-current.png';
const PARTITION_GENERATED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-partition-generated-current.png';
const REPAIR_PACKAGE_UNMATCHED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-repair-package-unmatched-current.png';
const REPAIR_PACKAGE_IMPORT_FOCUS_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-repair-package-import-focus-current.png';
const FORMAL_SAVE_GUARD_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-formal-save-guard-current.png';
const REAL_MAP_FIT_REJECTED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-fit-rejected-current.png';
const FORMAL_EMPTY_WAND_REJECTED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-formal-empty-wand-rejected-current.png';
const SEEDLESS_NO_FALLBACK_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-seedless-no-shape-fallback-current.png';
const UI_CONTAMINATED_MASK_REJECTED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-ui-contaminated-rejected-current.png';
const UI_CONTAMINATED_BOUNDARY_REJECTED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-boundary-ui-contaminated-rejected-current.png';
const IN_MAP_DECORATION_MASK_REJECTED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-in-map-decoration-rejected-current.png';
const BLANK_BOUNDARY_GENERATED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-generated-current.png';
const BLANK_BOUNDARY_FIVE_REGION_BRUSH_DRAWN_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-brush-drawn-current.png';
const BLANK_BOUNDARY_FIVE_REGION_BRUSH_GENERATED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-brush-generated-current.png';
const BLANK_BOUNDARY_FIVE_REGION_DRAWN_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-drawn-current.png';
const BLANK_BOUNDARY_FIVE_REGION_GENERATED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-generated-current.png';
const BLANK_BOUNDARY_FIVE_REGION_PATH_EDIT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-path-edit-current.png';
const REAL_MAP_AUTO_EXTRACT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-auto-extract-current.png';
const REAL_MAP_AUTO_CANDIDATE_DISABLED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-auto-candidate-disabled-current.png';
const REAL_MAP_CANDIDATE_EXPORT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-candidate-export-current.png';
const REAL_MAP_CANDIDATE_DRAFT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-candidate-draft-current.png';
const REAL_MAP_REGION_COLOR_DRAFT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-region-color-draft-current.png';
const REAL_MAP_REGION_COLOR_DRAFT_LAYER_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-region-color-draft-layer-current.png';
const REAL_MAP_REGION_PATH_QUICK_START_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-region-path-quick-start-current.png';
const REAL_MAP_REGION_TO_BOUNDARY_DRAFT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-region-to-boundary-draft-current.png';
const AUTO_EXTRACTION_VERDICT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-auto-extraction-verdict-current.png';
const BOUNDARY_REPAIR_PREVIEW_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-boundary-repair-preview-current.png';
const REAL_MAP_SUPPORT_SNAP_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-support-snap-current.png';
const REAL_MAP_BRIDGE_PATH_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-bridge-path-current.png';
const REAL_MAP_BRIDGE_PATH_DETAIL_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-bridge-path-detail-current.png';
const REAL_MAP_COLOR_MATCHED_BOUNDARY_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-color-matched-boundary-current.png';
const REAL_MAP_INITIALIZED_RED_BOUNDARY_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-initialized-red-boundary-current.png';
const REAL_MAP_RESET_CLEAN_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-reset-clean-current.png';
const MANUAL_RED_BOUNDARY_DRAW_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-manual-red-draw-current.png';
const MANUAL_EDGE_BOUNDARY_DRAW_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-manual-edge-red-draw-current.png';
const CLOSED_BOUNDARY_REGION_CITY_NAME_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-city-name-save-current.png';
const CLOSED_BOUNDARY_ALL_PASSAGES_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-all-passages-edit-current.png';
const EDGE_UI_BOUNDARY_REGION_GENERATED_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-region-mask-edge-ui-boundary-generated-current.png';
const EDITED_PASSAGE_ID = 'jinzhou::song-jin';
const WORKSPACE_ROOT = path.resolve(process.cwd(), 'temp/devtools/qidahen-region-mask-workspaces');
const REGION_MASK_COLORS = {
    jinzhou: [214, 76, 58] as const,
    'song-jin': [228, 169, 58] as const,
    'shan-hai-guan': [79, 136, 210] as const,
    'xian-xing': [111, 190, 115] as const,
    'shou-cheng': [143, 99, 216] as const,
};
const COMPLETE_REGION_IDS = ['jinzhou', 'song-jin', 'shan-hai-guan', 'xian-xing', 'shou-cheng'] as const;
const REAL_MAP_REGION_DRAFT_PIXEL_RANGES: Record<typeof COMPLETE_REGION_IDS[number], { min: number; max: number }> = {
    jinzhou: { min: 14000, max: 22000 },
    'song-jin': { min: 14000, max: 22000 },
    'shan-hai-guan': { min: 8500, max: 15000 },
    'xian-xing': { min: 12000, max: 19000 },
    'shou-cheng': { min: 15000, max: 22000 },
};
const REAL_MAP_FORBIDDEN_UI_POINTS = {
    wheelCenter: { x: 242, y: 202 },
    rightBoxCenter: { x: 1188, y: 330 },
    bottomRuleCenter: { x: 1082, y: 808 },
} as const;
const REAL_MAP_FORBIDDEN_UI_RECTS = [
    { left: 0, top: 0, right: MASK_WIDTH - 1, bottom: 50, label: 'top printed frame' },
    { left: 0, top: 0, right: 390, bottom: 365, label: 'left wheel and setup table' },
    { left: 0, top: 0, right: 110, bottom: MASK_HEIGHT - 1, label: 'left printed margin' },
    { left: 1120, top: 0, right: MASK_WIDTH - 1, bottom: MASK_HEIGHT - 1, label: 'right card boxes' },
    { left: 540, top: 720, right: 1140, bottom: MASK_HEIGHT - 1, label: 'bottom cards and action strip' },
    { left: 135, top: 820, right: 455, bottom: MASK_HEIGHT - 1, label: 'bottom year track' },
] as const;
const REAL_MAP_BOUNDARY_MATCH_COLORS = [
    [61, 69, 66],
    [126, 97, 56],
    [128, 104, 62],
    [43, 36, 34],
] as const;
const BG_CANVAS_TEST_ID = 'qidahen-bg-canvas';
const BARRIER_CANVAS_TEST_ID = 'qidahen-barrier-canvas';

const saveScreenshot = async (page: Page, targetPath: string) => {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    await page.screenshot({ path: targetPath, fullPage: true });
};

const saveTestIdScreenshot = async (page: Page, testId: string, targetPath: string) => {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    await page.getByTestId(testId).screenshot({ path: targetPath });
};

const switchToPureBoundaryView = async (page: Page) => {
    const maskToggle = page.getByRole('button', { name: '隐藏 Mask', exact: true });
    if (await maskToggle.count() > 0) {
        await maskToggle.click();
        await expect(page.getByRole('button', { name: '显示 Mask', exact: true })).toBeVisible();
    }

    const outlineToggle = page.getByTestId('qidahen-toggle-selected-outline');
    const outlineToggleText = await outlineToggle.textContent();
    if (outlineToggleText?.includes('隐藏选区描边')) {
        await outlineToggle.click();
        await expect(outlineToggle).toContainText('显示选区描边');
    }

    const seedOverlayToggle = page.getByTestId('qidahen-toggle-seed-status-overlay');
    const seedOverlayToggleText = await seedOverlayToggle.textContent();
    if (seedOverlayToggleText?.includes('隐藏 seed 状态')) {
        await seedOverlayToggle.click();
        await expect(seedOverlayToggle).toContainText('显示 seed 状态');
    }

    const partitionOverlayToggle = page.getByTestId('qidahen-toggle-partition-preview-overlay');
    const partitionOverlayToggleText = await partitionOverlayToggle.textContent();
    if (partitionOverlayToggleText?.includes('隐藏分区铺色')) {
        await partitionOverlayToggle.click();
        await expect(partitionOverlayToggle).toContainText('显示分区铺色');
    }

    await expect(page.getByTestId('qidahen-seed-status-overlay')).toHaveCount(0);
    await expect(page.getByTestId('qidahen-open-boundary-markers')).toHaveCount(0);
    await expect(page.getByTestId('qidahen-unmatched-seed-markers')).toHaveCount(0);
};

const saveCanvasMapClipScreenshot = async (
    page: Page,
    canvasBox: ElementRect,
    targetPath: string,
    points: Array<{ x: number; y: number }>,
    padding = 72,
) => {
    const left = Math.max(0, Math.min(...points.map((point) => point.x)) - padding);
    const right = Math.min(MASK_WIDTH, Math.max(...points.map((point) => point.x)) + padding);
    const top = Math.max(0, Math.min(...points.map((point) => point.y)) - padding);
    const bottom = Math.min(MASK_HEIGHT, Math.max(...points.map((point) => point.y)) + padding);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    await page.screenshot({
        path: targetPath,
        clip: {
            x: canvasBox.x + ((left / MASK_WIDTH) * canvasBox.width),
            y: canvasBox.y + ((top / MASK_HEIGHT) * canvasBox.height),
            width: ((right - left) / MASK_WIDTH) * canvasBox.width,
            height: ((bottom - top) / MASK_HEIGHT) * canvasBox.height,
        },
    });
};

const getSharp = async () => (await import('sharp')).default;

const sanitizeWorkspaceKey = (value: string) => (
    value
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80)
);

const getWorkspaceDir = (workspaceName: string) => path.join(WORKSPACE_ROOT, sanitizeWorkspaceKey(workspaceName));

const getWorkspaceRoute = (workspaceName: string) => `/dev/qidahen-region-mask?workspace=${encodeURIComponent(sanitizeWorkspaceKey(workspaceName))}`;
const getRuntimePreviewRoute = (workspaceName: string) => `/dev/qidahen-runtime-preview?workspace=${encodeURIComponent(sanitizeWorkspaceKey(workspaceName))}`;

const resetWorkspaceDir = (workspaceName: string) => {
    rmSync(getWorkspaceDir(workspaceName), { recursive: true, force: true });
};

const cloneWorkspaceDir = (sourceWorkspaceName: string, workspaceName: string) => {
    resetWorkspaceDir(workspaceName);
    mkdirSync(getWorkspaceDir(workspaceName), { recursive: true });
    for (const fileName of readdirSync(getWorkspaceDir(sourceWorkspaceName))) {
        copyFileSync(getWorkspaceFilePath(sourceWorkspaceName, fileName), getWorkspaceFilePath(workspaceName, fileName));
    }
};

const getWorkspaceFilePath = (workspaceName: string, fileName: string) => path.join(getWorkspaceDir(workspaceName), fileName);

const workspaceFileExists = (workspaceName: string, fileName: string) => existsSync(getWorkspaceFilePath(workspaceName, fileName));

const updateWorkspacePassageBoundaryType = (
    workspaceName: string,
    edgeId: string,
    boundaryType: string,
    boundaryLabel: string,
    battleWidth: number,
    travelCost?: number,
) => {
    const graphPath = getWorkspaceFilePath(workspaceName, 'region-graph.json');
    const graphPayload = JSON.parse(readFileSync(graphPath, 'utf8')) as {
        edges?: Array<{ id?: string; boundaryType?: string; boundaryLabel?: string; battleWidth?: number; travelCost?: number; ruleNote?: string }>;
    };
    graphPayload.edges = (graphPayload.edges ?? []).map((edge) => (
        edge.id === edgeId
            ? { ...edge, boundaryType, boundaryLabel, battleWidth, travelCost: travelCost ?? edge.travelCost, ruleNote: `战场宽度 ${battleWidth}` }
            : edge
    ));
    writeFileSync(graphPath, JSON.stringify(graphPayload, null, 2));
};

const createSeedlessWorkspace = (workspaceName: string, seedlessRegionIds: string[]) => {
    resetWorkspaceDir(workspaceName);
    mkdirSync(getWorkspaceDir(workspaceName), { recursive: true });
    const sourceDir = path.resolve(process.cwd(), 'src/games/qidahen/data');
    const seedlessSet = new Set(seedlessRegionIds);
    writeFileSync(getWorkspaceFilePath(workspaceName, 'region-mask.png'), readFileSync(path.join(sourceDir, 'region-mask.png')));

    const regionsPayload = JSON.parse(readFileSync(path.join(sourceDir, 'region-mask-regions.json'), 'utf8')) as {
        regions?: Array<{ id?: string; seed?: { x: number; y: number } | null }>;
    };
    regionsPayload.regions = (regionsPayload.regions ?? []).map((region) => (
        region.id && seedlessSet.has(region.id)
            ? { ...region, seed: null }
            : region
    ));
    writeFileSync(getWorkspaceFilePath(workspaceName, 'region-mask-regions.json'), JSON.stringify(regionsPayload, null, 2));

    const graphPayload = JSON.parse(readFileSync(path.join(sourceDir, 'region-graph.json'), 'utf8')) as {
        nodes?: Array<{ id?: string; seed?: { x: number; y: number } | null; center?: { x: number; y: number } | null; pixelCount?: number }>;
        edges?: unknown[];
    };
    graphPayload.nodes = (graphPayload.nodes ?? []).map((node) => (
        node.id && seedlessSet.has(node.id)
            ? { ...node, seed: null, center: null, pixelCount: 0 }
            : node
    ));
    writeFileSync(getWorkspaceFilePath(workspaceName, 'region-graph.json'), JSON.stringify(graphPayload, null, 2));
};

const createWorkspaceWithSeedOverrides = async (
    workspaceName: string,
    seedOverrides: Record<string, { x: number; y: number }>,
) => {
    resetWorkspaceDir(workspaceName);
    mkdirSync(getWorkspaceDir(workspaceName), { recursive: true });
    const sharp = await getSharp();
    await sharp({
        create: {
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    }).png().toFile(getWorkspaceFilePath(workspaceName, 'region-mask.png'));

    const sourceDir = path.resolve(process.cwd(), 'src/games/qidahen/data');
    const regionsPayload = JSON.parse(readFileSync(path.join(sourceDir, 'region-mask-regions.json'), 'utf8')) as {
        regions?: Array<{ id?: string; seed?: { x: number; y: number } | null }>;
    };
    regionsPayload.regions = (regionsPayload.regions ?? []).map((region) => (
        region.id && seedOverrides[region.id]
            ? { ...region, seed: seedOverrides[region.id] }
            : region
    ));
    writeFileSync(getWorkspaceFilePath(workspaceName, 'region-mask-regions.json'), JSON.stringify(regionsPayload, null, 2));

    const graphPayload = JSON.parse(readFileSync(path.join(sourceDir, 'region-graph.json'), 'utf8')) as {
        nodes?: Array<{ id?: string; seed?: { x: number; y: number } | null; center?: { x: number; y: number } | null; pixelCount?: number }>;
        edges?: unknown[];
    };
    graphPayload.nodes = (graphPayload.nodes ?? []).map((node) => (
        node.id && seedOverrides[node.id]
            ? { ...node, seed: seedOverrides[node.id], center: null, pixelCount: 0 }
            : node
    ));
    graphPayload.edges = [];
    writeFileSync(getWorkspaceFilePath(workspaceName, 'region-graph.json'), JSON.stringify(graphPayload, null, 2));
};

const getRegionShapeCenterPoint = (regionId: string) => {
    const shape = QIDAHEN_MAP_REGION_SHAPES.find((item) => item.id === regionId);
    if (!shape || shape.polygon.length === 0) {
        throw new Error(`missing qidahen region shape: ${regionId}`);
    }
    const sum = shape.polygon.reduce(
        (current, [x, y]) => ({ x: current.x + x, y: current.y + y }),
        { x: 0, y: 0 },
    );
    return {
        x: Math.round(sum.x / shape.polygon.length),
        y: Math.round(sum.y / shape.polygon.length),
    };
};

const getRegionTraceCrop = (regionId: string) => {
    const seed = getRegionShapeCenterPoint(regionId);
    const width = Math.min(REGION_TRACE_TEMPLATE_WIDTH, MASK_WIDTH);
    const height = Math.min(REGION_TRACE_TEMPLATE_HEIGHT, MASK_HEIGHT);
    return {
        seed,
        crop: {
            left: Math.max(0, Math.min(MASK_WIDTH - width, seed.x - Math.floor(width / 2))),
            top: Math.max(0, Math.min(MASK_HEIGHT - height, seed.y - Math.floor(height / 2))),
            width,
            height,
        },
    };
};

const HAND_DRAWN_TEST_BOUNDARY_POINTS: Record<string, ReadonlyArray<readonly [number, number]>> = {
    jinzhou: [
        [723, 372],
        [755, 350],
        [794, 341],
        [829, 363],
        [846, 400],
        [838, 442],
        [807, 478],
        [765, 489],
        [726, 468],
        [699, 430],
        [704, 392],
    ],
    'song-jin': [
        [681, 514],
        [719, 496],
        [762, 502],
        [798, 531],
        [806, 571],
        [785, 612],
        [747, 640],
        [704, 626],
        [667, 594],
        [653, 556],
    ],
    'shan-hai-guan': [
        [626, 482],
        [663, 493],
        [686, 525],
        [681, 566],
        [650, 604],
        [612, 608],
        [583, 576],
        [579, 535],
    ],
    'xian-xing': [
        [1061, 470],
        [1094, 455],
        [1115, 478],
        [1113, 525],
        [1084, 548],
        [1057, 530],
        [1048, 494],
    ],
    'shou-cheng': [
        [1070, 586],
        [1119.5, 586],
        [1119.5, 684],
        [1070, 684],
    ],
};

const LARGE_REVIEW_FIXTURE_BOUNDARY_POINTS: Record<string, ReadonlyArray<readonly [number, number]>> = {
    jinzhou: QIDAHEN_MAP_REGION_SHAPES.find((shape) => shape.id === 'jinzhou')?.polygon ?? [],
    'song-jin': QIDAHEN_MAP_REGION_SHAPES.find((shape) => shape.id === 'song-jin')?.polygon ?? [],
    'shan-hai-guan': QIDAHEN_MAP_REGION_SHAPES.find((shape) => shape.id === 'shan-hai-guan')?.polygon ?? [],
    'xian-xing': [
        [1010, 420],
        [1065, 392],
        [1110, 421],
        [1110, 528],
        [1072, 558],
        [1017, 517],
    ],
    'shou-cheng': [
        [990, 535],
        [1110, 535],
        [1110, 710],
        [1048, 710],
        [990, 632],
    ],
};

const createHandDrawnDragLoop = (regionId: string): Array<{ x: number; y: number }> => {
    const points = HAND_DRAWN_TEST_BOUNDARY_POINTS[regionId];
    if (!points || points.length < 3) {
        throw new Error(`missing hand drawn drag loop: ${regionId}`);
    }
    if (regionId === 'shou-cheng') {
        return [
            { x: 1119, y: 586 },
            { x: 1070, y: 586 },
            { x: 1070, y: 684 },
            { x: 1119, y: 684 },
        ];
    }
    const loop = points.map(([x, y]) => ({ x, y }));
    loop.push({ x: points[0][0], y: points[0][1] });
    return loop;
};

const buildSmoothClosedPath = (points: ReadonlyArray<readonly [number, number]>) => {
    if (points.length < 3) {
        throw new Error('hand drawn boundary needs at least 3 points');
    }
    const [startX, startY] = points[0];
    const segments = [`M ${startX} ${startY}`];
    for (let index = 1; index <= points.length; index += 1) {
        const [controlX, controlY] = points[index % points.length];
        const [nextX, nextY] = points[(index + 1) % points.length];
        const midX = Math.round((controlX + nextX) / 2);
        const midY = Math.round((controlY + nextY) / 2);
        segments.push(`Q ${controlX} ${controlY} ${midX} ${midY}`);
    }
    segments.push('Z');
    return segments.join(' ');
};

const buildStraightClosedPath = (points: ReadonlyArray<readonly [number, number]>) => {
    if (points.length < 3) {
        throw new Error('boundary needs at least 3 points');
    }
    const [startX, startY] = points[0];
    return [
        `M ${startX} ${startY}`,
        ...points.slice(1).map(([x, y]) => `L ${x} ${y}`),
        'Z',
    ].join(' ');
};

const buildWavyClosedPath = (
    points: ReadonlyArray<readonly [number, number]>,
    options: { amplitude?: number; step?: number; cycles?: number } = {},
) => {
    if (points.length < 3) {
        throw new Error('boundary needs at least 3 points');
    }
    const amplitude = options.amplitude ?? 7;
    const step = options.step ?? 8;
    const cycles = options.cycles ?? 2;
    const interpolated: Array<[number, number]> = [];
    for (let index = 0; index < points.length; index += 1) {
        const [startX, startY] = points[index];
        const [endX, endY] = points[(index + 1) % points.length];
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.max(1, Math.hypot(dx, dy));
        const normalX = -dy / length;
        const normalY = dx / length;
        const segmentCount = Math.max(2, Math.ceil(length / step));
        for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
            const t = segmentIndex / segmentCount;
            const wave = Math.sin((t * Math.PI * 2 * cycles) + (index * 1.7)) * amplitude;
            interpolated.push([
                Math.round(startX + (dx * t) + (normalX * wave)),
                Math.round(startY + (dy * t) + (normalY * wave)),
            ]);
        }
    }
    const [startX, startY] = interpolated[0];
    return [
        `M ${startX} ${startY}`,
        ...interpolated.slice(1).map(([x, y]) => `L ${x} ${y}`),
        'Z',
    ].join(' ');
};

const createSyntheticBoundarySourcePng = async (
    regionIds: string[] = ['jinzhou'],
    options: { includeOpenNoiseLine?: boolean; includeUiContamination?: boolean; strokeColor?: string } = {},
) => {
    const targetPath = path.resolve(
        process.cwd(),
        `temp/qidahen-hand-drawn-boundary-source-${regionIds.join('-')}${options.includeOpenNoiseLine ? '-with-open-noise' : ''}${options.strokeColor ? '-custom-color' : ''}.png`,
    );
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const boundaries = regionIds.map((regionId) => {
        const points = HAND_DRAWN_TEST_BOUNDARY_POINTS[regionId];
        if (!points) {
            throw new Error(`missing hand drawn test boundary: ${regionId}`);
        }
        return { regionId, points };
    });
    if (boundaries.length === 0) {
        throw new Error('missing synthetic boundary paths');
    }
    const background = {
        create: {
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            channels: 4,
            background: { r: 206, g: 177, b: 116, alpha: 1 },
        },
    } as const;
    const paths = boundaries.map(({ regionId, points }, index) => {
        return `
            <path
                data-region-id="${regionId}"
                d="${buildStraightClosedPath(points)}"
                fill="none"
                stroke="${options.strokeColor ?? (index % 2 === 0 ? 'rgb(61,69,66)' : 'rgb(126,97,56)')}"
                stroke-width="7"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        `;
    }).join('\n');
    const openNoisePath = options.includeOpenNoiseLine
        ? `
            <path
                data-region-id="open-noise"
                d="M 505 235 Q 548 276 602 242 Q 648 214 690 255"
                fill="none"
                stroke="rgb(128,104,62)"
                stroke-width="7"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        `
        : '';
    const uiContamination = options.includeUiContamination
        ? `
            <rect
                data-region-id="ui-contamination-wheel"
                x="168"
                y="132"
                width="142"
                height="112"
                fill="none"
                stroke="rgb(61,69,66)"
                stroke-width="10"
            />
            <path
                data-region-id="ui-contamination-right-box"
                d="M 1168 292 L 1242 292 L 1242 422 L 1168 422 Z"
                fill="none"
                stroke="rgb(126,97,56)"
                stroke-width="10"
            />
            <path
                data-region-id="ui-contamination-bottom-strip"
                d="M 720 835 L 1060 835"
                fill="none"
                stroke="rgb(43,36,34)"
                stroke-width="10"
                stroke-linecap="round"
            />
        `
        : '';
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            ${paths}
            ${openNoisePath}
            ${uiContamination}
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(background)
        .composite([{ input: Buffer.from(boundarySvg) }])
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createRealMapDrawnBoundarySourcePng = async () => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-real-map-hand-drawn-boundary-source.png');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const sourceMapPath = path.resolve(process.cwd(), 'public/assets/i18n/zh-CN/qidahen/board/main-board.png');
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <path
                data-region-id="jinzhou-user-drawn-boundary"
                d="${buildSmoothClosedPath(HAND_DRAWN_TEST_BOUNDARY_POINTS.jinzhou)}"
                fill="none"
                stroke="rgb(61,69,66)"
                stroke-width="7"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(sourceMapPath)
        .composite([{ input: Buffer.from(boundarySvg) }])
        .png()
        .toFile(targetPath);
    return targetPath;
};

const REAL_MAP_COMPLETE_BOUNDARY_POINTS: Record<string, ReadonlyArray<readonly [number, number]>> = {
    jinzhou: [
        [682, 340],
        [764, 320],
        [842, 350],
        [884, 420],
        [842, 504],
        [746, 528],
        [668, 475],
        [650, 392],
    ],
    'song-jin': [
        [634, 490],
        [728, 458],
        [830, 492],
        [874, 576],
        [822, 666],
        [708, 684],
        [612, 624],
        [584, 548],
    ],
    'shan-hai-guan': [
        [536, 448],
        [626, 432],
        [705, 480],
        [714, 576],
        [650, 664],
        [552, 650],
        [498, 572],
        [504, 492],
    ],
    'xian-xing': [
        [982, 402],
        [1060, 368],
        [1119, 402],
        [1119, 530],
        [1066, 574],
        [994, 548],
        [958, 480],
    ],
    'shou-cheng': [
        [974, 542],
        [1058, 526],
        [1119, 554],
        [1119, 716],
        [1048, 728],
        [974, 676],
        [944, 604],
    ],
};

const createRealMapCompleteBoundarySourcePng = async () => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-real-map-complete-boundary-source.png');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const sourceMapPath = path.resolve(process.cwd(), 'public/assets/i18n/zh-CN/qidahen/board/main-board.png');
    const paths = COMPLETE_REGION_IDS.map((regionId, index) => `
        <path
            data-region-id="${regionId}"
            d="${buildSmoothClosedPath(REAL_MAP_COMPLETE_BOUNDARY_POINTS[regionId])}"
            fill="none"
            stroke="${index % 2 === 0 ? 'rgb(61,69,66)' : 'rgb(126,97,56)'}"
            stroke-width="${regionId === 'shou-cheng' ? 2 : 7}"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    `).join('\n');
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            ${paths}
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(sourceMapPath)
        .composite([{ input: Buffer.from(boundarySvg) }])
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createExpandedCandidateOverlayPng = async (candidateMaskPath: string) => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-real-map-accepted-candidate-overlay.png');
    const sharp = await getSharp();
    const { data, info } = await sharp(candidateMaskPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    if (info.width !== MASK_WIDTH || info.height !== MASK_HEIGHT) {
        throw new Error(`unexpected candidate mask size: ${info.width}x${info.height}`);
    }
    const sourceMask = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
    for (let index = 0; index < MASK_WIDTH * MASK_HEIGHT; index += 1) {
        if (data[(index * 4) + 3] >= 16) {
            sourceMask[index] = 1;
        }
    }
    const expandedMask = new Uint8Array(sourceMask.length);
    const radius = 3;
    for (let y = 0; y < MASK_HEIGHT; y += 1) {
        for (let x = 0; x < MASK_WIDTH; x += 1) {
            if (sourceMask[(y * MASK_WIDTH) + x] === 0) {
                continue;
            }
            for (let dy = -radius; dy <= radius; dy += 1) {
                const nextY = y + dy;
                if (nextY < 0 || nextY >= MASK_HEIGHT) {
                    continue;
                }
                for (let dx = -radius; dx <= radius; dx += 1) {
                    if ((dx * dx) + (dy * dy) > radius * radius) {
                        continue;
                    }
                    const nextX = x + dx;
                    if (nextX < 0 || nextX >= MASK_WIDTH) {
                        continue;
                    }
                    expandedMask[(nextY * MASK_WIDTH) + nextX] = 1;
                }
            }
        }
    }
    const pixels = Buffer.alloc(MASK_WIDTH * MASK_HEIGHT * 4);
    for (let index = 0; index < expandedMask.length; index += 1) {
        if (expandedMask[index] === 0) {
            continue;
        }
        const offset = index * 4;
        pixels[offset] = 61;
        pixels[offset + 1] = 69;
        pixels[offset + 2] = 66;
        pixels[offset + 3] = 255;
    }
    await sharp(pixels, {
        raw: {
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            channels: 4,
        },
    }).png().toFile(targetPath);
    return targetPath;
};

const createRealMapAcceptedBoundarySourcePng = async (candidateMaskPath: string) => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-real-map-accepted-boundary-source.png');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const sourceMapPath = path.resolve(process.cwd(), 'public/assets/i18n/zh-CN/qidahen/board/main-board.png');
    const candidateOverlayPath = await createExpandedCandidateOverlayPng(candidateMaskPath);
    const paths = COMPLETE_REGION_IDS.map((regionId, index) => {
        const points = regionId === 'xian-xing'
            ? REAL_MAP_COMPLETE_BOUNDARY_POINTS['xian-xing']
            : regionId === 'shou-cheng'
                ? REAL_MAP_COMPLETE_BOUNDARY_POINTS['shou-cheng']
                : HAND_DRAWN_TEST_BOUNDARY_POINTS[regionId] ?? REAL_MAP_COMPLETE_BOUNDARY_POINTS[regionId];
        return `
            <path
                data-region-id="${regionId}"
                d="${buildWavyClosedPath(points, { amplitude: 7, step: 8, cycles: 2 })}"
                fill="none"
                stroke="${index % 2 === 0 ? 'rgb(61,69,66)' : 'rgb(126,97,56)'}"
                stroke-width="${regionId === 'shou-cheng' ? 2 : 7}"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        `;
    }).join('\n');
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            ${paths}
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(sourceMapPath)
        .composite([
            { input: candidateOverlayPath },
            { input: Buffer.from(boundarySvg) },
        ])
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createTransparentBoundaryMaskPng = async (
    regionIds: string[] = ['jinzhou'],
    options: { includeOpenNoiseLine?: boolean } = {},
) => {
    const targetPath = path.resolve(
        process.cwd(),
        `temp/qidahen-transparent-boundary-mask-${regionIds.join('-')}${options.includeOpenNoiseLine ? '-with-open-noise' : ''}.png`,
    );
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const paths = regionIds.map((regionId, index) => {
        const points = HAND_DRAWN_TEST_BOUNDARY_POINTS[regionId];
        if (!points) {
            throw new Error(`missing transparent boundary test region: ${regionId}`);
        }
        return `
            <path
                data-region-id="${regionId}"
                d="${buildSmoothClosedPath(points)}"
                fill="none"
                stroke="${index % 2 === 0 ? 'rgb(255,255,255)' : 'rgb(220,220,220)'}"
                stroke-width="${regionId === 'shou-cheng' ? 2 : 7}"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        `;
    }).join('\n');
    const openNoisePath = options.includeOpenNoiseLine
        ? `
            <path
                data-region-id="open-noise"
                d="M 505 235 Q 548 276 602 242 Q 648 214 690 255"
                fill="none"
                stroke="rgb(255,255,255)"
                stroke-width="7"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        `
        : '';
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0)" />
            ${paths}
            ${openNoisePath}
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(Buffer.from(boundarySvg))
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createRealMapColorMatchedBoundaryMaskPng = async () => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-real-map-color-matched-boundary-mask.png');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const sourceMapPath = path.resolve(process.cwd(), 'public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png');
    const sharp = await getSharp();
    const { data, info } = await sharp(sourceMapPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    if (info.width !== MASK_WIDTH || info.height !== MASK_HEIGHT) {
        throw new Error(`unexpected qidahen map size: ${info.width}x${info.height}`);
    }

    const sourceMask = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
    const tolerance = 18;
    const colorDistance = (r: number, g: number, b: number, color: readonly [number, number, number]) => (
        Math.max(Math.abs(r - color[0]), Math.abs(g - color[1]), Math.abs(b - color[2]))
    );
    const isForbiddenUiPixel = (x: number, y: number) => (
        REAL_MAP_FORBIDDEN_UI_RECTS.some((rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
    );
    for (let y = 0; y < MASK_HEIGHT; y += 1) {
        for (let x = 0; x < MASK_WIDTH; x += 1) {
            if (isForbiddenUiPixel(x, y)) {
                continue;
            }
            const offset = ((y * MASK_WIDTH) + x) * 4;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            if (REAL_MAP_BOUNDARY_MATCH_COLORS.some((color) => colorDistance(r, g, b, color) <= tolerance)) {
                sourceMask[(y * MASK_WIDTH) + x] = 1;
            }
        }
    }

    const seen = new Uint8Array(sourceMask.length);
    const keptMask = new Uint8Array(sourceMask.length);
    const queueX = new Int32Array(sourceMask.length);
    const queueY = new Int32Array(sourceMask.length);
    for (let y = 0; y < MASK_HEIGHT; y += 1) {
        for (let x = 0; x < MASK_WIDTH; x += 1) {
            const startIndex = (y * MASK_WIDTH) + x;
            if (sourceMask[startIndex] === 0 || seen[startIndex] !== 0) {
                continue;
            }
            let head = 0;
            let tail = 0;
            queueX[tail] = x;
            queueY[tail] = y;
            tail += 1;
            seen[startIndex] = 1;
            const pixels: number[] = [];
            let minX = x;
            let maxX = x;
            let minY = y;
            let maxY = y;
            while (head < tail) {
                const currentX = queueX[head];
                const currentY = queueY[head];
                head += 1;
                const currentIndex = (currentY * MASK_WIDTH) + currentX;
                pixels.push(currentIndex);
                minX = Math.min(minX, currentX);
                maxX = Math.max(maxX, currentX);
                minY = Math.min(minY, currentY);
                maxY = Math.max(maxY, currentY);
                for (let dy = -1; dy <= 1; dy += 1) {
                    for (let dx = -1; dx <= 1; dx += 1) {
                        if (dx === 0 && dy === 0) {
                            continue;
                        }
                        const nextX = currentX + dx;
                        const nextY = currentY + dy;
                        if (nextX < 0 || nextX >= MASK_WIDTH || nextY < 0 || nextY >= MASK_HEIGHT) {
                            continue;
                        }
                        const nextIndex = (nextY * MASK_WIDTH) + nextX;
                        if (sourceMask[nextIndex] === 0 || seen[nextIndex] !== 0) {
                            continue;
                        }
                        seen[nextIndex] = 1;
                        queueX[tail] = nextX;
                        queueY[tail] = nextY;
                        tail += 1;
                    }
                }
            }
            const width = maxX - minX + 1;
            const height = maxY - minY + 1;
            const span = Math.max(width, height);
            const density = pixels.length / Math.max(1, width * height);
            if (pixels.length >= 300 && span >= 80 && density <= 0.18) {
                for (const pixelIndex of pixels) {
                    keptMask[pixelIndex] = 1;
                }
            }
        }
    }

    const outputPixels = Buffer.alloc(MASK_WIDTH * MASK_HEIGHT * 4);
    for (let index = 0; index < keptMask.length; index += 1) {
        if (keptMask[index] === 0) {
            continue;
        }
        const offset = index * 4;
        outputPixels[offset] = 255;
        outputPixels[offset + 1] = 255;
        outputPixels[offset + 2] = 255;
        outputPixels[offset + 3] = 255;
    }
    await sharp(outputPixels, {
        raw: {
            width: MASK_WIDTH,
            height: MASK_HEIGHT,
            channels: 4,
        },
    }).png().toFile(targetPath);
    return targetPath;
};

const SMALL_SAVEABLE_BOUNDARY_POINTS: Record<string, ReadonlyArray<readonly [number, number]>> = {
    jinzhou: [
        [742, 390],
        [780, 380],
        [820, 410],
        [805, 450],
        [760, 455],
        [735, 425],
    ],
    'song-jin': [
        [700, 535],
        [740, 525],
        [778, 560],
        [765, 600],
        [725, 610],
        [695, 580],
    ],
};

const createSmallSaveableBoundaryMaskPng = async (regionIds: string[]) => {
    const targetPath = path.resolve(process.cwd(), `temp/qidahen-small-saveable-boundary-mask-${regionIds.join('-')}.png`);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const paths = regionIds.map((regionId, index) => {
        const points = SMALL_SAVEABLE_BOUNDARY_POINTS[regionId];
        if (!points) {
            throw new Error(`missing small saveable boundary test region: ${regionId}`);
        }
        return `
            <path
                data-region-id="${regionId}"
                d="${buildSmoothClosedPath(points)}"
                fill="none"
                stroke="${index % 2 === 0 ? 'rgb(255,255,255)' : 'rgb(220,220,220)'}"
                stroke-width="5"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        `;
    }).join('\n');
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0)" />
            ${paths}
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(Buffer.from(boundarySvg))
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createManyClosedBoundaryMaskPng = async (regionCount = 12) => {
    const targetPath = path.resolve(process.cwd(), `temp/qidahen-many-closed-boundary-mask-${regionCount}.png`);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const columns = 4;
    const paths = Array.from({ length: regionCount }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const centerX = 430 + (column * 135);
        const centerY = 210 + (row * 125);
        const radiusX = 42 + (index % 3) * 4;
        const radiusY = 34 + (index % 2) * 5;
        return `
            <ellipse
                data-region-id="closed-${index + 1}"
                cx="${centerX}"
                cy="${centerY}"
                rx="${radiusX}"
                ry="${radiusY}"
                fill="none"
                stroke="${index % 2 === 0 ? 'rgb(255,255,255)' : 'rgb(220,220,220)'}"
                stroke-width="6"
            />
        `;
    }).join('\n');
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0)" />
            ${paths}
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(Buffer.from(boundarySvg))
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createUiEdgeClosedBoundaryMaskPng = async () => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-ui-edge-closed-boundary-mask.png');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0)" />
            <path
                d="M 34 430
                   C 70 398, 116 416, 124 462
                   C 134 516, 78 548, 38 516
                   C 2 487, 5 455, 34 430 Z"
                fill="none"
                stroke="rgb(255,255,255)"
                stroke-width="7"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(Buffer.from(boundarySvg))
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createLargeReviewFixtureBoundaryMaskPng = async () => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-large-review-fixture-boundary-mask.png');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const paths = COMPLETE_REGION_IDS.map((regionId, index) => {
        const points = LARGE_REVIEW_FIXTURE_BOUNDARY_POINTS[regionId];
        if (!points || points.length < 3) {
            throw new Error(`missing large review fixture boundary: ${regionId}`);
        }
        return `
            <path
                data-region-id="${regionId}"
                d="${buildStraightClosedPath(points)}"
                fill="none"
                stroke="${index % 2 === 0 ? 'rgb(255,255,255)' : 'rgb(220,220,220)'}"
                stroke-width="5"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        `;
    }).join('\n');
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0)" />
            ${paths}
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(Buffer.from(boundarySvg))
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createEdgePartitionBoundaryMaskPng = async () => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-edge-partition-boundary-mask.png');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0)" />
            <path
                data-region-id="east-handdrawn-partition-wall"
                d="M 1003 419
                   C 985 462, 1024 499, 1001 544
                   C 976 596, 1017 650, 989 720"
                fill="none"
                stroke="rgb(255,255,255)"
                stroke-width="7"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <path
                data-region-id="xian-xing-top-handdrawn-partition"
                d="M 1003 419
                   C 1031 397, 1078 432, 1119 417"
                fill="none"
                stroke="rgb(255,255,255)"
                stroke-width="7"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <path
                data-region-id="xian-shou-cheng-handdrawn-partition"
                d="M 1001 544
                   C 1035 526, 1080 556, 1119 536"
                fill="none"
                stroke="rgb(255,255,255)"
                stroke-width="7"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <path
                data-region-id="open-curved-noise-tail"
                d="M 1138 470 C 1158 454, 1173 482, 1189 463"
                fill="none"
                stroke="rgb(255,255,255)"
                stroke-width="7"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(Buffer.from(boundarySvg))
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createTransparentLocalRegionBoundaryPng = async (regionId: string) => {
    const targetPath = path.resolve(process.cwd(), `temp/qidahen-local-region-boundary-${regionId}.png`);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const points = HAND_DRAWN_TEST_BOUNDARY_POINTS[regionId];
    if (!points) {
        throw new Error(`missing local hand drawn test boundary: ${regionId}`);
    }
    const { crop } = getRegionTraceCrop(regionId);
    const shiftedPoints = points.map(([x, y]) => [x - crop.left, y - crop.top] as const);
    const strokeWidth = regionId === 'shou-cheng' ? 2 : 7;
    const boundarySvg = `
        <svg width="${crop.width}" height="${crop.height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0)" />
            <path
                data-region-id="${regionId}"
                d="${buildSmoothClosedPath(shiftedPoints)}"
                fill="none"
                stroke="rgb(255,255,255)"
                stroke-width="${strokeWidth}"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(Buffer.from(boundarySvg))
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createTransparentLocalRegionBoundaryZip = async (regionIds: string[]) => {
    const entries: Record<string, Uint8Array> = {};
    for (const regionId of regionIds) {
        const pngPath = await createTransparentLocalRegionBoundaryPng(regionId);
        entries[`qidahen-local-region-boundary-${regionId}.png`] = new Uint8Array(readFileSync(pngPath));
    }
    const targetPath = path.resolve(process.cwd(), `temp/qidahen-local-region-boundaries-${regionIds.join('-')}.zip`);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, Buffer.from(zipSync(entries, { level: 9 })));
    return targetPath;
};

const createManifestMappedLocalRegionBoundaryZip = async (regionIds: string[]) => {
    const entries: Record<string, Uint8Array> = {};
    const regions = [];
    for (const [index, regionId] of regionIds.entries()) {
        const pngPath = await createTransparentLocalRegionBoundaryPng(regionId);
        const fileName = `painted/region-${String(index + 1).padStart(2, '0')}.png`;
        const { crop } = getRegionTraceCrop(regionId);
        entries[fileName] = new Uint8Array(readFileSync(pngPath));
        const regionShape = QIDAHEN_MAP_REGION_SHAPES.find((shape) => shape.id === regionId);
        regions.push({
            id: regionId,
            name: regionShape?.name ?? regionId,
            fileName,
            crop,
        });
    }
    entries['manifest.json'] = new TextEncoder().encode(JSON.stringify({
        generatedAt: new Date().toISOString(),
        regions,
    }, null, 2));
    const targetPath = path.resolve(process.cwd(), `temp/qidahen-manifest-mapped-local-region-boundaries-${regionIds.join('-')}.zip`);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, Buffer.from(zipSync(entries, { level: 9 })));
    return targetPath;
};

const createUiContaminatedRegionMaskPng = async () => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-ui-contaminated-region-mask.png');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const [r, g, b] = REGION_MASK_COLORS.jinzhou;
    const maskSvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0)" />
            <rect x="190" y="150" width="96" height="84" fill="rgb(${r},${g},${b})" />
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(Buffer.from(maskSvg))
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createInMapDecorationContaminatedRegionMaskPng = async () => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-in-map-decoration-contaminated-region-mask.png');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const [r, g, b] = REGION_MASK_COLORS['xian-xing'];
    const maskSvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0)" />
            <rect x="950" y="430" width="135" height="92" fill="rgb(${r},${g},${b})" />
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(Buffer.from(maskSvg))
        .png()
        .toFile(targetPath);
    return targetPath;
};

const createUiContaminatedBoundaryMaskPng = async () => {
    const targetPath = path.resolve(process.cwd(), 'temp/qidahen-ui-contaminated-boundary-mask.png');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const boundarySvg = `
        <svg width="${MASK_WIDTH}" height="${MASK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0)" />
            <path
                d="${buildSmoothClosedPath(HAND_DRAWN_TEST_BOUNDARY_POINTS.jinzhou)}"
                fill="none"
                stroke="rgb(255,255,255)"
                stroke-width="8"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <path
                d="M 145 96 H 336 V 246 H 145 Z"
                fill="none"
                stroke="rgb(255,255,255)"
                stroke-width="8"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
    const sharp = await getSharp();
    await sharp(Buffer.from(boundarySvg))
        .png()
        .toFile(targetPath);
    return targetPath;
};

const waitForBoundaryDraftPixels = async (page: Page, minimumPixels: number) => {
    await page.waitForFunction((minimum) => {
        const match = /(?:当前边界图|当前红线|初始红线)像素：([\d,]+)/u.exec(document.body.innerText);
        return match != null && Number(match[1].replace(/,/gu, '')) > minimum;
    }, minimumPixels, { timeout: 30000 });
};

const readBoundaryExtractionStats = async (page: Page) => {
    const text = await page.locator('aside').innerText();
    const readNumber = (label: string) => {
        const match = new RegExp(`${label}：([\\d,]+)`, 'u').exec(text);
        return match ? Number(match[1].replace(/,/gu, '')) : null;
    };
    return {
        matchedPixelCount: readNumber('抽色命中'),
        drawnChangedPixelCount: readNumber('底图差分'),
        keptPixelCount: readNumber('最终保留'),
    };
};

const waitForFinalBarrierPixels = async (page: Page, minimumPixels: number) => {
    await page.waitForFunction((minimum) => {
        const match = /(?:当前)?最终(?:红线\/)?障碍(?:像素)?：([\d,]+)/u.exec(document.body.innerText);
        return match != null && Number(match[1].replace(/,/gu, '')) > minimum;
    }, minimumPixels, { timeout: 30000 });
};

const readManualBarrierAddCount = async (page: Page) => {
    const text = await page.getByTestId('qidahen-manual-barrier-add-count').innerText();
    return Number(text.replace(/,/gu, ''));
};

const getRect = async (locator: ReturnType<Page['locator']>): Promise<ElementRect> => (
    locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        };
    })
);

const mapCanvasPointToClient = (canvasBox: ElementRect, x: number, y: number) => ({
    x: canvasBox.x + ((x / MASK_WIDTH) * canvasBox.width),
    y: canvasBox.y + ((y / MASK_HEIGHT) * canvasBox.height),
});
const clickCanvasMapPoint = async (page: Page, canvasBox: ElementRect, x: number, y: number) => {
    const point = mapCanvasPointToClient(canvasBox, x, y);
    await page.mouse.click(point.x, point.y);
};

const dragCanvasMapPolyline = async (
    page: Page,
    canvasBox: ElementRect,
    points: Array<{ x: number; y: number }>,
    steps = 12,
) => {
    if (points.length < 2) {
        throw new Error('polyline drag needs at least two points');
    }
    const start = mapCanvasPointToClient(canvasBox, points[0].x, points[0].y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (const point of points.slice(1)) {
        const clientPoint = mapCanvasPointToClient(canvasBox, point.x, point.y);
        await page.mouse.move(clientPoint.x, clientPoint.y, { steps });
    }
    await page.mouse.up();
};

const dispatchCanvasPointerPolyline = async (
    page: Page,
    canvasTestId: string,
    points: Array<{ x: number; y: number }>,
) => {
    if (points.length < 2) {
        throw new Error('pointer polyline needs at least two points');
    }
    await page.evaluate(
        ({ canvasTestId: targetCanvasTestId, points: targetPoints }) => {
            const canvas = document.querySelector(`[data-testid="${targetCanvasTestId}"]`) as HTMLCanvasElement | null;
            if (!canvas) {
                throw new Error(`canvas ${targetCanvasTestId} missing`);
            }
            const strokePoints: Array<{ x: number; y: number }> = [targetPoints[0]];
            for (let index = 1; index < targetPoints.length; index += 1) {
                const previous = targetPoints[index - 1];
                const current = targetPoints[index];
                const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
                const steps = Math.max(1, Math.ceil(distance / 3));
                for (let step = 1; step <= steps; step += 1) {
                    const ratio = step / steps;
                    strokePoints.push({
                        x: previous.x + ((current.x - previous.x) * ratio),
                        y: previous.y + ((current.y - previous.y) * ratio),
                    });
                }
            }
            const rect = canvas.getBoundingClientRect();
            const toClient = (point: { x: number; y: number }) => ({
                clientX: rect.left + ((point.x / canvas.width) * rect.width),
                clientY: rect.top + ((point.y / canvas.height) * rect.height),
            });
            const firePointer = (type: string, point: { x: number; y: number }, buttons: number, button: number) => {
                const client = toClient(point);
                canvas.dispatchEvent(new PointerEvent(type, {
                    ...client,
                    bubbles: true,
                    cancelable: true,
                    pointerId: 17,
                    pointerType: 'mouse',
                    buttons,
                    button,
                    isPrimary: true,
                }));
            };
            firePointer('pointerdown', strokePoints[0], 1, 0);
            for (const point of strokePoints.slice(1)) {
                firePointer('pointermove', point, 1, -1);
            }
            firePointer('pointerup', strokePoints[strokePoints.length - 1], 0, 0);
        },
        { canvasTestId, points },
    );
    await page.waitForTimeout(20);
};

const setBrushSize = async (page: Page, value: number) => {
    await page.getByTestId('qidahen-brush-size-input').evaluate((element, nextValue) => {
        const input = element as HTMLInputElement;
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(input, String(nextValue));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await expect(page.getByTestId('qidahen-brush-size-input')).toHaveValue(String(value));
    await expect(page.getByText(new RegExp(`修边半径 ${value}px`, 'u'))).toBeVisible();
};

const readSavedRegionGraph = (workspaceName: string) => {
    const graphPath = getWorkspaceFilePath(workspaceName, 'region-graph.json');
    return JSON.parse(readFileSync(graphPath, 'utf8')) as {
        nodes?: Array<{ id?: string; name?: string; center?: { x: number; y: number } | null; pixelCount?: number }>;
        edges?: Array<{ id?: string; from?: string; to?: string; boundaryType?: string; boundaryLabel?: string; battleWidth?: number }>;
    };
};

const readSavedOpaquePixelCount = async (targetPath: string) => {
    const sharp = await getSharp();
    const { data, info } = await sharp(targetPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let opaquePixels = 0;
    for (let index = 0; index < info.width * info.height; index += 1) {
        if (data[(index * 4) + 3] >= 16) {
            opaquePixels += 1;
        }
    }
    return opaquePixels;
};

const readSavedUniqueOpaqueColorCount = async (targetPath: string) => {
    const sharp = await getSharp();
    const { data, info } = await sharp(targetPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const colors = new Set<string>();
    for (let index = 0; index < info.width * info.height; index += 1) {
        const offset = index * 4;
        if (data[offset + 3] < 16) {
            continue;
        }
        colors.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`);
    }
    return colors.size;
};

const readPngDimensions = async (targetPath: string) => {
    const sharp = await getSharp();
    const metadata = await sharp(targetPath).metadata();
    return {
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
    };
};

const countPngOpaquePixelsInRect = async (
    targetPath: string,
    rect: { left: number; top: number; right: number; bottom: number },
) => {
    const sharp = await getSharp();
    const { data, info } = await sharp(targetPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const left = Math.max(0, Math.min(info.width - 1, rect.left));
    const right = Math.max(0, Math.min(info.width - 1, rect.right));
    const top = Math.max(0, Math.min(info.height - 1, rect.top));
    const bottom = Math.max(0, Math.min(info.height - 1, rect.bottom));
    let opaquePixels = 0;
    for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
            const offset = ((y * info.width) + x) * 4;
            if (data[offset + 3] >= 16) {
                opaquePixels += 1;
            }
        }
    }
    return opaquePixels;
};

const countPngOpaquePixelsOnSourceDecorations = async (targetPath: string) => {
    const sharp = await getSharp();
    const sourcePath = path.resolve(process.cwd(), 'public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png');
    const [{ data: targetData, info }, { data: sourceData, info: sourceInfo }] = await Promise.all([
        sharp(targetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
        sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    if (info.width !== sourceInfo.width || info.height !== sourceInfo.height) {
        throw new Error(`source decoration check requires matching dimensions: ${info.width}x${info.height} vs ${sourceInfo.width}x${sourceInfo.height}`);
    }
    let overlapPixels = 0;
    for (let index = 0; index < info.width * info.height; index += 1) {
        const offset = index * 4;
        const red = sourceData[offset];
        const green = sourceData[offset + 1];
        const blue = sourceData[offset + 2];
        const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
        const isRedArrowOrMarker = red > 145
            && green < 100
            && blue < 95
            && red - green > 80
            && red - blue > 75;
        const isLightCardOrNumberToken = red > 175
            && green > 175
            && blue > 175
            && chroma < 70;
        if ((isRedArrowOrMarker || isLightCardOrNumberToken) && targetData[offset + 3] >= 16) {
            overlapPixels += 1;
        }
    }
    return overlapPixels;
};

const readFileSnapshot = (targetPath: string) => readFileSync(targetPath);

const readCanonicalWorkspaceSnapshot = () => ({
    mask: readFileSnapshot(path.resolve(process.cwd(), 'src/games/qidahen/data/region-mask.png')),
    boundaryMask: readFileSnapshot(path.resolve(process.cwd(), 'src/games/qidahen/data/region-boundary-mask.png')),
    boundaryAdd: readFileSnapshot(path.resolve(process.cwd(), 'src/games/qidahen/data/region-boundary-add.png')),
    boundaryRemove: readFileSnapshot(path.resolve(process.cwd(), 'src/games/qidahen/data/region-boundary-remove.png')),
    authoritativeMask: readFileSnapshot(path.resolve(process.cwd(), 'src/games/qidahen/data/region-authoritative-guides.png')),
    authoritativeMeta: readFileSnapshot(path.resolve(process.cwd(), 'src/games/qidahen/data/region-authoritative-guides.json')),
    regions: readFileSnapshot(path.resolve(process.cwd(), 'src/games/qidahen/data/region-mask-regions.json')),
    graph: readFileSnapshot(path.resolve(process.cwd(), 'src/games/qidahen/data/region-graph.json')),
});

const getMaskColorCounts = async (page: Page): Promise<MaskColorCounts> => (
    page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="qidahen-mask-canvas"]') as HTMLCanvasElement | null;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('mask canvas context missing');
        }

        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;
        let redX = 0;
        let redY = 0;
        let redLeft = Number.POSITIVE_INFINITY;
        let redTop = Number.POSITIVE_INFINITY;
        let redRight = 0;
        let redBottom = 0;
        let yellow = 0;
        let yellowX = 0;
        let yellowY = 0;

        for (let index = 0; index < data.length; index += 4) {
            const pixelIndex = index / 4;
            const x = pixelIndex % canvas.width;
            const y = Math.floor(pixelIndex / canvas.width);
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];

            if (r === 214 && g === 76 && b === 58 && a === 255) {
                red += 1;
                redX += x;
                redY += y;
                redLeft = Math.min(redLeft, x);
                redTop = Math.min(redTop, y);
                redRight = Math.max(redRight, x);
                redBottom = Math.max(redBottom, y);
            }
            if (r === 228 && g === 169 && b === 58 && a === 255) {
                yellow += 1;
                yellowX += x;
                yellowY += y;
            }
        }

        return {
            red,
            yellow,
            redCenter: red > 0 ? { x: Math.round(redX / red), y: Math.round(redY / red) } : null,
            yellowCenter: yellow > 0 ? { x: Math.round(yellowX / yellow), y: Math.round(yellowY / yellow) } : null,
            redBounds: red > 0 ? { left: redLeft, top: redTop, right: redRight, bottom: redBottom } : null,
        };
    })
);

const getCanvasPixel = async (
    page: Page,
    canvasTestId: string,
    x: number,
    y: number,
): Promise<RgbaPixel> => (
    page.evaluate(
        ({ canvasTestId: targetCanvasTestId, x: targetX, y: targetY }) => {
            const canvas = document.querySelector(`[data-testid="${targetCanvasTestId}"]`) as HTMLCanvasElement | null;
            const context = canvas?.getContext('2d');
            if (!canvas || !context) {
                throw new Error(`canvas ${targetCanvasTestId} context missing`);
            }
            const data = context.getImageData(targetX, targetY, 1, 1).data;
            return [data[0], data[1], data[2], data[3]] as const;
        },
        { canvasTestId, x, y },
    )
);

const getCanvasOpaqueBounds = async (
    page: Page,
    canvasTestId: string,
): Promise<{ opaquePixels: number; bounds: { left: number; top: number; right: number; bottom: number } | null }> => (
    page.evaluate(
        ({ canvasTestId: targetCanvasTestId }) => {
            const canvas = document.querySelector(`[data-testid="${targetCanvasTestId}"]`) as HTMLCanvasElement | null;
            const context = canvas?.getContext('2d');
            if (!canvas || !context) {
                throw new Error(`canvas ${targetCanvasTestId} context missing`);
            }
            const { width, height } = canvas;
            const data = context.getImageData(0, 0, width, height).data;
            let opaquePixels = 0;
            let left = width;
            let top = height;
            let right = -1;
            let bottom = -1;
            for (let index = 0; index < data.length; index += 4) {
                if (data[index + 3] < 16) {
                    continue;
                }
                opaquePixels += 1;
                const pixelIndex = index / 4;
                const x = pixelIndex % width;
                const y = Math.floor(pixelIndex / width);
                left = Math.min(left, x);
                top = Math.min(top, y);
                right = Math.max(right, x);
                bottom = Math.max(bottom, y);
            }
            return {
                opaquePixels,
                bounds: right >= left && bottom >= top ? { left, top, right, bottom } : null,
            };
        },
        { canvasTestId },
    )
);

const getBarrierCanvasColorStats = async (page: Page): Promise<{ opaque: number; red: number; cyan: number; green: number }> => (
    page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="qidahen-barrier-canvas"]') as HTMLCanvasElement | null;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) {
            throw new Error('barrier canvas context missing');
        }
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let opaque = 0;
        let red = 0;
        let cyan = 0;
        let green = 0;
        for (let index = 0; index < data.length; index += 4) {
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];
            if (a < 16) {
                continue;
            }
            opaque += 1;
            if (r > 180 && g < 120 && b < 120) {
                red += 1;
            }
            if (b > 150 && g > 120 && r < 120) {
                cyan += 1;
            }
            if (g > 150 && r < 160 && b < 170) {
                green += 1;
            }
        }
        return { opaque, red, cyan, green };
    })
);

const countCanvasOpaquePixelsInRect = async (
    page: Page,
    canvasTestId: string,
    rect: { left: number; top: number; right: number; bottom: number },
): Promise<number> => (
    page.evaluate(
        ({ canvasTestId: targetCanvasTestId, rect: targetRect }) => {
            const canvas = document.querySelector(`[data-testid="${targetCanvasTestId}"]`) as HTMLCanvasElement | null;
            const context = canvas?.getContext('2d');
            if (!canvas || !context) {
                throw new Error(`canvas ${targetCanvasTestId} context missing`);
            }
            const left = Math.max(0, Math.min(canvas.width - 1, targetRect.left));
            const right = Math.max(0, Math.min(canvas.width - 1, targetRect.right));
            const top = Math.max(0, Math.min(canvas.height - 1, targetRect.top));
            const bottom = Math.max(0, Math.min(canvas.height - 1, targetRect.bottom));
            const width = right - left + 1;
            const height = bottom - top + 1;
            const data = context.getImageData(left, top, width, height).data;
            let opaquePixels = 0;
            for (let index = 0; index < data.length; index += 4) {
                if (data[index + 3] >= 16) {
                    opaquePixels += 1;
                }
            }
            return opaquePixels;
        },
        { canvasTestId, rect },
    )
);

const findCanvasSnapCandidateOutsideRects = async (
    page: Page,
    canvasTestId: string,
    excludedRects: readonly { left: number; top: number; right: number; bottom: number }[],
): Promise<{ supportPoint: { x: number; y: number }; drawPoint: { x: number; y: number } }> => (
    page.evaluate(
        ({ canvasTestId: targetCanvasTestId, excludedRects: targetExcludedRects }) => {
            const canvas = document.querySelector(`[data-testid="${targetCanvasTestId}"]`) as HTMLCanvasElement | null;
            const context = canvas?.getContext('2d');
            if (!canvas || !context) {
                throw new Error(`canvas ${targetCanvasTestId} context missing`);
            }
            const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const isExcluded = (x: number, y: number) => targetExcludedRects.some((rect) => (
                x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
            ));
            const isOpaque = (x: number, y: number) => data[((y * canvas.width) + x) * 4 + 3] >= 16;
            const offsets = [
                { x: 16, y: 0 },
                { x: -16, y: 0 },
                { x: 0, y: 16 },
                { x: 0, y: -16 },
            ];
            for (let index = 0; index < data.length; index += 4) {
                if (data[index + 3] < 16) {
                    continue;
                }
                const pixelIndex = index / 4;
                const x = pixelIndex % canvas.width;
                const y = Math.floor(pixelIndex / canvas.width);
                if (isExcluded(x, y)) {
                    continue;
                }
                for (const offset of offsets) {
                    const drawX = x + offset.x;
                    const drawY = y + offset.y;
                    if (drawX < 0 || drawX >= canvas.width || drawY < 0 || drawY >= canvas.height) {
                        continue;
                    }
                    if (!isExcluded(drawX, drawY) && !isOpaque(drawX, drawY)) {
                        return {
                            supportPoint: { x, y },
                            drawPoint: { x: drawX, y: drawY },
                        };
                    }
                }
            }
            throw new Error(`canvas ${targetCanvasTestId} has no snap candidate outside excluded rects`);
        },
        { canvasTestId, excludedRects },
    )
);

const findCurvedCanvasCandidatePairOutsideRects = async (
    page: Page,
    canvasTestId: string,
    excludedRects: readonly { left: number; top: number; right: number; bottom: number }[],
): Promise<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    pathMidpoint: { x: number; y: number };
    lineMidpoint: { x: number; y: number };
    directDistance: number;
    pathLength: number;
}> => (
    page.evaluate(
        ({ canvasTestId: targetCanvasTestId, excludedRects: targetExcludedRects }) => {
            const canvas = document.querySelector(`[data-testid="${targetCanvasTestId}"]`) as HTMLCanvasElement | null;
            const context = canvas?.getContext('2d');
            if (!canvas || !context) {
                throw new Error(`canvas ${targetCanvasTestId} context missing`);
            }
            const width = canvas.width;
            const height = canvas.height;
            const data = context.getImageData(0, 0, width, height).data;
            const isExcluded = (x: number, y: number) => targetExcludedRects.some((rect) => (
                x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
            ));
            const eligible = new Uint8Array(width * height);
            for (let index = 0; index < width * height; index += 1) {
                const x = index % width;
                const y = (index / width) | 0;
                if (data[(index * 4) + 3] >= 16 && !isExcluded(x, y)) {
                    eligible[index] = 1;
                }
            }
            const visited = new Uint8Array(width * height);
            const neighbors = [
                [-1, -1],
                [0, -1],
                [1, -1],
                [-1, 0],
                [1, 0],
                [-1, 1],
                [0, 1],
                [1, 1],
            ] as const;
            const distanceToLine = (
                point: { x: number; y: number },
                start: { x: number; y: number },
                end: { x: number; y: number },
            ) => {
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const length = Math.hypot(dx, dy);
                if (length === 0) {
                    return 0;
                }
                return Math.abs((dy * point.x) - (dx * point.y) + (end.x * start.y) - (end.y * start.x)) / length;
            };
            const reconstructPath = (parent: Int32Array, startIndex: number, endIndex: number) => {
                const path: Array<{ x: number; y: number }> = [];
                let current = endIndex;
                while (current >= 0) {
                    path.push({ x: current % width, y: (current / width) | 0 });
                    if (current === startIndex) {
                        break;
                    }
                    current = parent[current];
                }
                return path.reverse();
            };
            const queue = new Int32Array(width * height);
            for (let index = 0; index < eligible.length; index += 1) {
                if (eligible[index] === 0 || visited[index] !== 0) {
                    continue;
                }
                const component: number[] = [];
                let head = 0;
                let tail = 0;
                queue[tail] = index;
                tail += 1;
                visited[index] = 1;
                while (head < tail) {
                    const current = queue[head];
                    head += 1;
                    component.push(current);
                    const x = current % width;
                    const y = (current / width) | 0;
                    for (const [dx, dy] of neighbors) {
                        const nextX = x + dx;
                        const nextY = y + dy;
                        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
                            continue;
                        }
                        const nextIndex = (nextY * width) + nextX;
                        if (eligible[nextIndex] === 0 || visited[nextIndex] !== 0) {
                            continue;
                        }
                        visited[nextIndex] = 1;
                        queue[tail] = nextIndex;
                        tail += 1;
                    }
                }
                if (component.length < 80) {
                    continue;
                }
                const sampleStep = Math.max(1, Math.floor(component.length / 16));
                for (let sampleIndex = 0; sampleIndex < component.length; sampleIndex += sampleStep) {
                    const startIndex = component[sampleIndex];
                    const start = { x: startIndex % width, y: (startIndex / width) | 0 };
                    const parent = new Int32Array(width * height);
                    parent.fill(-2);
                    head = 0;
                    tail = 0;
                    queue[tail] = startIndex;
                    tail += 1;
                    parent[startIndex] = -1;
                    while (head < tail) {
                        const current = queue[head];
                        head += 1;
                        const currentPoint = { x: current % width, y: (current / width) | 0 };
                        const directDistance = Math.hypot(currentPoint.x - start.x, currentPoint.y - start.y);
                        if (directDistance >= 55 && directDistance <= 130) {
                            const lineMidpoint = {
                                x: Math.round((start.x + currentPoint.x) / 2),
                                y: Math.round((start.y + currentPoint.y) / 2),
                            };
                            if (!isExcluded(lineMidpoint.x, lineMidpoint.y) && eligible[(lineMidpoint.y * width) + lineMidpoint.x] === 0) {
                                const path = reconstructPath(parent, startIndex, current);
                                const pathMidpoint = path[Math.floor(path.length / 2)];
                                if (path.length > directDistance + 8 && distanceToLine(pathMidpoint, start, currentPoint) >= 8) {
                                    return {
                                        start,
                                        end: currentPoint,
                                        pathMidpoint,
                                        lineMidpoint,
                                        directDistance,
                                        pathLength: path.length,
                                    };
                                }
                            }
                        }
                        const x = current % width;
                        const y = (current / width) | 0;
                        for (const [dx, dy] of neighbors) {
                            const nextX = x + dx;
                            const nextY = y + dy;
                            if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
                                continue;
                            }
                            const nextIndex = (nextY * width) + nextX;
                            if (eligible[nextIndex] === 0 || parent[nextIndex] !== -2) {
                                continue;
                            }
                            parent[nextIndex] = current;
                            queue[tail] = nextIndex;
                            tail += 1;
                        }
                    }
                }
            }
            throw new Error(`canvas ${targetCanvasTestId} has no curved candidate pair outside excluded rects`);
        },
        { canvasTestId, excludedRects },
    )
);

test.describe('七大恨区域制图工具', () => {
    test('正式工作区为空时只给真实边界入口不展示假成果', async ({ page }) => {
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(300000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto('/dev/qidahen-region-mask', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('正式工作区', { exact: true })).toBeVisible();
        await expect(page.getByText('src/games/qidahen/data', { exact: true })).toBeVisible();
        await expect(page.getByTestId('qidahen-empty-workspace-guide')).toBeVisible();
        await expect(page.getByText('先准备手修边界稿')).toBeVisible();
        await expect(page.getByTestId('qidahen-empty-guide-normal-route')).toContainText('正常成果路线');
        await expect(page.getByTestId('qidahen-empty-guide-normal-route')).toContainText('要正式边界成果，先手修边界，再生区域');
        await expect(page.getByTestId('qidahen-empty-guide-normal-import-boundary')).toBeVisible();
        await expect(page.getByTestId('qidahen-empty-guide-normal-direct-draw')).toBeVisible();
        await expect(page.getByText('现成可用成果', { exact: true })).toBeVisible();
        await expect(page.getByTestId('qidahen-empty-guide-open-best-available-boundary-workspace')).toBeVisible();
        await expect(page.getByTestId('qidahen-empty-guide-open-best-available-move-cost-ready-workspace')).toBeVisible();
        await expect(page.getByTestId('qidahen-empty-guide-hand-edit-toolbox')).toContainText('边界手修工具与描边包');
        await expect(page.getByTestId('qidahen-empty-guide-prepare-hybrid-trace-kit')).toBeHidden();
        await expect(page.getByTestId('qidahen-empty-guide-load-hybrid-boundary-draft')).toBeHidden();
        await expect(page.getByTestId('qidahen-empty-guide-export-boundary-trace-kit')).toBeHidden();
        await expect(page.getByTestId('qidahen-empty-guide-import-boundary')).toBeHidden();
        await expect(page.getByTestId('qidahen-empty-guide-import-source')).toBeHidden();
        await expect(page.getByTestId('qidahen-empty-guide-direct-draw')).toBeHidden();
        await expect(page.getByTestId('qidahen-formal-empty-tool-panel-collapsed')).toBeVisible();
        await expect(page.getByTestId('qidahen-formal-empty-open-barrier-workflow')).toBeVisible();
        await expect(page.getByTestId('qidahen-formal-empty-expand-tool-panel')).toBeVisible();
        await expect(page.getByTestId('qidahen-toggle-advanced-workbench')).toHaveCount(0);
        await expect(page.getByText('高级诊断', { exact: true })).toHaveCount(0);
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBe(0);
        await expect.poll(async () => {
            const match = /当前最终障碍像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBe(0);
        await expect.poll(async () => countCanvasOpaquePixelsInRect(
            page,
            'qidahen-mask-canvas',
            { left: 0, top: 0, right: MASK_WIDTH - 1, bottom: MASK_HEIGHT - 1 },
        )).toBe(0);
        await expect.poll(async () => countCanvasOpaquePixelsInRect(
            page,
            BARRIER_CANVAS_TEST_ID,
            { left: 0, top: 0, right: MASK_WIDTH - 1, bottom: MASK_HEIGHT - 1 },
        )).toBe(0);
        await expect(page.getByTestId('qidahen-seed-status-overlay')).toHaveCount(0);

        await saveScreenshot(page, FORMAL_EMPTY_NORMAL_ROUTE_SCREENSHOT);

        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, 'qidahen-mask-canvas', rect),
                { message: `${rect.label} should not contain formal region pixels before boundary input` },
            ).toBe(0);
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should not contain formal boundary pixels before boundary input` },
            ).toBe(0);
        }

        await page.getByTestId('qidahen-empty-guide-open-best-available-move-cost-ready-workspace').scrollIntoViewIfNeeded();
        await saveScreenshot(page, FORMAL_EMPTY_WORKSPACE_BEST_AVAILABLE_ENTRY_SCREENSHOT);
        await saveScreenshot(page, FORMAL_EMPTY_SCREENSHOT);

        await page.getByTestId('qidahen-toggle-forbidden-ui-overlay').click();
        await expect(page.getByTestId('qidahen-forbidden-ui-overlay')).toBeVisible();
        await page.getByTestId('qidahen-focus-selected-seed-for-tracing').click();
        await expect(page.locator('main')).toContainText('模式：边界修正');
        await expect(page.getByTestId('qidahen-forbidden-ui-overlay')).toBeVisible();
        await expect(page.getByTestId('qidahen-seed-status-overlay')).toBeVisible();
        await expect(page.getByTestId('qidahen-seed-status-jinzhou')).toContainText('锦州 · 待描');
        await saveScreenshot(page, TRACE_ASSIST_SCREENSHOT);

        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('正式空白页可直接打开现成移动代价工作区', async ({ page }) => {
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto('/dev/qidahen-region-mask', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-empty-guide-open-best-available-move-cost-ready-workspace')).toBeVisible();
        await page.getByTestId('qidahen-empty-guide-open-best-available-move-cost-ready-workspace').click();
        await expect(page).toHaveURL(/workspace=best-available-move-cost-ready/u);
        await expect(page.getByTestId('qidahen-region-truth-workflow-banner')).toContainText('区域粗稿 + 通路编辑（次路线）', { timeout: 30000 });
        await expect(page.locator('main')).toContainText('模式：通路编辑', { timeout: 30000 });
        await expect(page.locator('main')).toContainText('路径：4', { timeout: 30000 });
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('空工作区可一键准备固定色边界稿并导出描边包', async ({ page }) => {
        const workspaceName = 'formal-empty-prepare-hybrid-trace-kit';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(300000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-prepare-hybrid-boundary-trace-kit')).toContainText('一键准备固定色边界稿 + 描边包');

        const downloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-prepare-hybrid-boundary-trace-kit').click();
        const download = await downloadPromise;
        const zipPath = await download.path();
        expect(zipPath).not.toBeNull();
        expect(download.suggestedFilename()).toBe('qidahen-boundary-trace-kit.zip');
        await expect(page.getByText(/已准备固定色连通边界稿并导出全图描边包 ZIP/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/现在直接去外部画笔删错线、补缺线/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBeGreaterThan(1000);
        const boundaryCanvasStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(boundaryCanvasStats.opaquePixels).toBeGreaterThan(1000);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should not contain hybrid boundary draft pixels` },
            ).toBe(0);
        }
        await expect.poll(async () => {
            const text = await page.getByTestId('qidahen-quality-boundary-ui-pixels').innerText();
            return Number(text.replace(/,/gu, ''));
        }).toBe(0);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('隔离工作区边界图工作流按主路与次路线分组显示', async ({ page }) => {
        const workspaceName = 'isolated-boundary-workflow-groups';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('临时隔离工作区', { exact: true })).toBeVisible();
        await expect(page.getByTestId('qidahen-boundary-workflow-panel')).toBeVisible();
        await expect(page.getByTestId('qidahen-prepare-hybrid-boundary-trace-kit')).toContainText('一键准备固定色边界稿 + 描边包');
        await expect(page.getByTestId('qidahen-load-real-map-color-line-draft-primary')).toContainText('载入固定色边界稿');
        await expect(page.getByTestId('qidahen-export-boundary-trace-kit')).toContainText('导出全图描边包 ZIP');
        await expect(page.getByTestId('qidahen-import-boundary-repair-package')).toContainText('导入补边包 ZIP');
        await expect(page.getByTestId('qidahen-start-blank-boundary-draft')).toContainText('从空白边界开始手绘');
        await expect(page.getByTestId('qidahen-boundary-trace-assets-details')).toContainText('外部手修素材');
        await expect(page.getByTestId('qidahen-boundary-secondary-region-workflow')).toContainText('次路线：区域粗稿与移动代价');
        await expect(page.getByTestId('qidahen-boundary-diagnostics-details')).toContainText('候选诊断与自动结果说明');
        await saveTestIdScreenshot(page, 'qidahen-boundary-workflow-panel', ISOLATED_BOUNDARY_WORKFLOW_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('空工作区魔棒不会回退到粗 shape 直线假区域', async ({ page }) => {
        const workspaceName = 'formal-empty-wand-rejected';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(300000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBe(0);
        const canvasBox = await getRect(page.getByTestId('qidahen-region-canvas'));
        await clickCanvasMapPoint(page, canvasBox, 777, 417);

        await expect(page.getByText(/魔棒已拒绝：当前没有用户导入\/手绘的真实边界图/u)).toBeVisible();
        await expect(page.getByText(/不会再用粗 shape 或底图自动候选生成直线假区域/u)).toBeVisible();
        await expect.poll(async () => countCanvasOpaquePixelsInRect(
            page,
            'qidahen-mask-canvas',
            { left: 0, top: 0, right: MASK_WIDTH - 1, bottom: MASK_HEIGHT - 1 },
        )).toBe(0);
        const counts = await getMaskColorCounts(page);
        expect(counts.red).toBe(0);
        expect(counts.yellow).toBe(0);
        await saveScreenshot(page, FORMAL_EMPTY_WAND_REJECTED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('没有显式 seed 的区域不会回退旧 shape 中心生成假成果', async ({ page }) => {
        const workspaceName = 'seedless-region-no-shape-fallback';
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        createSeedlessWorkspace(workspaceName, ['jinzhou']);
        test.info().setTimeout(300000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-region-card-jinzhou').click();
        await expect(page.locator('aside')).toContainText('seed：未设');

        await page.getByTestId('qidahen-boundary-trace-assets-details').locator('summary').click();
        await page.getByTestId('qidahen-export-selected-region-trace-template').click();
        await expect(page.getByText(/锦州 没有设置 seed，不能导出局部描边底稿/u)).toBeVisible({ timeout: 30000 });

        const boundarySourcePath = await createSyntheticBoundarySourcePng(['jinzhou']);
        await page.getByTestId('qidahen-import-boundary-draft').click();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(boundarySourcePath);
        await expect(page.getByText(/第一个缺 seed 区域：锦州/u)).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('未生成');
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('没有设置 seed');
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('不能生成正常成果');
        await expect(page.getByTestId('qidahen-boundary-quality-detail')).toContainText('缺 seed：锦州');
        await expect(page.getByTestId('qidahen-quality-missing-seed-count')).toHaveText('1');
        await expect(page.getByTestId('qidahen-quality-region-jinzhou')).toContainText('缺 seed');
        await page.getByTestId('qidahen-region-generation-result-jinzhou').scrollIntoViewIfNeeded();
        await saveScreenshot(page, SEEDLESS_NO_FALLBACK_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('正式保存会拒绝包含印刷 UI 禁区的 mask', async ({ page }) => {
        const workspaceName = 'ui-contaminated-mask-rejected';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const maskPath = await createUiContaminatedRegionMaskPng();
        await page.getByTestId('qidahen-import-mask').click();
        await page.getByTestId('qidahen-import-mask-input').setInputFiles(maskPath);
        await expect(page.getByText(/已导入 mask/u)).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/保存失败：正式 mask 包含 UI\/装饰禁区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/轮盘、说明框、牌框、底部条/u)).toBeVisible();
        await saveScreenshot(page, UI_CONTAMINATED_MASK_REJECTED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('正式保存会拒绝地图内部红箭头数字牌等装饰像素', async ({ page }) => {
        const workspaceName = 'in-map-decoration-mask-rejected';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const maskPath = await createInMapDecorationContaminatedRegionMaskPng();
        await page.getByTestId('qidahen-import-mask').click();
        await page.getByTestId('qidahen-import-mask-input').setInputFiles(maskPath);
        await expect(page.getByText(/已导入 mask/u)).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/保存失败：正式 mask 包含 UI\/装饰禁区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/红色箭头、数字牌、锚点/u)).toBeVisible();
        await saveScreenshot(page, IN_MAP_DECORATION_MASK_REJECTED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('导入完成边界图会直接剔除印刷 UI 禁区像素', async ({ page }) => {
        const workspaceName = 'ui-contaminated-boundary-rejected';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(120000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const boundaryPath = await createUiContaminatedBoundaryMaskPng();
        await page.getByTestId('qidahen-import-boundary-draft').click();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(boundaryPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/已拒绝 UI\/装饰禁区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-quality-boundary-ui-pixels')).toHaveText('0');
        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBeGreaterThan(0);
        await saveScreenshot(page, UI_CONTAMINATED_BOUNDARY_REJECTED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('指定边界颜色可以生成区域初始值', async ({ page }) => {
        const workspaceName = 'specified-boundary';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(300000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });

        await page.getByRole('button', { name: '清空', exact: true }).click();
        await page.getByRole('button', { name: '清空微调层' }).click();
        await page.getByLabel('指定边界颜色').fill('rgb(255, 0, 255)');
        await page.getByTestId('qidahen-add-boundary-color').click();
        await expect(page.getByText(/已加入指定边界颜色/u)).toBeVisible();
        await expect(page.getByTestId('qidahen-painted-boundary-only-toggle')).toContainText('只用边界颜色/手工补边');

        const sourcePath = await createSyntheticBoundarySourcePng(['jinzhou'], { strokeColor: 'rgb(255,0,255)' });
        await page.getByTestId('qidahen-import-boundary-source').click();
        await page.getByTestId('qidahen-boundary-source-input').setInputFiles(sourcePath);
        await expect(page.getByText(/已从带底图描线图抽取边界图/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 1000);

        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : 0;
        }).toBeGreaterThan(1000);

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/默认生成已拒绝/u)).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-debug-generate-regions-from-boundary').click({ force: true });
        await expect(page.getByText(/已调试生成当前独立分区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('已生成');
        const counts = await getMaskColorCounts(page);
        expect(counts.red).toBeGreaterThan(1000);
        expect(counts.redCenter).not.toBeNull();
        expect(counts.redCenter!.x).toBeGreaterThan(700);
        expect(counts.redCenter!.x).toBeLessThan(850);
        expect(counts.redCenter!.y).toBeGreaterThan(350);
        expect(counts.redCenter!.y).toBeLessThan(500);
        await saveScreenshot(page, SPECIFIED_BOUNDARY_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('导入带底图描线图后只抽边界色生成边界图且剔除印刷 UI 污染', async ({ page }) => {
        const workspaceName = 'hand-drawn-generated';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(600000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const sourcePath = await createSyntheticBoundarySourcePng(['jinzhou'], { includeUiContamination: true });
        await page.getByTestId('qidahen-import-boundary-source').click();
        await page.getByTestId('qidahen-boundary-source-input').setInputFiles(sourcePath);
        await expect(page.getByText(/已从带底图描线图抽取边界图/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/已载入参考层/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('参考层', { exact: true })).toBeVisible();
        await waitForBoundaryDraftPixels(page, 100);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should be excluded from hand-drawn boundary extraction` },
            ).toBe(0);
        }
        await saveScreenshot(page, HAND_DRAWN_SOURCE_SCREENSHOT);

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/默认生成已拒绝/u)).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-debug-generate-regions-from-boundary').click();
        await expect(page.getByText(/已调试生成当前独立分区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('已生成');
        await page.getByTestId('qidahen-region-generation-result-jinzhou').scrollIntoViewIfNeeded();
        await saveScreenshot(page, HAND_DRAWN_GENERATED_SCREENSHOT);
        const counts = await getMaskColorCounts(page);
        expect(counts.red).toBeGreaterThan(1000);
        expect(counts.redCenter).not.toBeNull();
        expect(counts.redCenter!.x).toBeGreaterThan(700);
        expect(counts.redCenter!.x).toBeLessThan(850);
        expect(counts.redCenter!.y).toBeGreaterThan(350);
        expect(counts.redCenter!.y).toBeLessThan(500);

        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到/u)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/仍有 4 个区域未生成/u)).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBeGreaterThan(100);

        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 100);
        await saveScreenshot(page, HAND_DRAWN_PERSISTED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('导入真实底图描线图时只保留用户新增描线，不抽原图同色元素', async ({ page }) => {
        const workspaceName = 'real-map-hand-drawn-source';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(360000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BG_CANVAS_TEST_ID)).opaquePixels).toBeGreaterThan(900000);
        const sourcePath = await createRealMapDrawnBoundarySourcePng();
        await page.getByTestId('qidahen-import-boundary-source').click();
        await page.getByTestId('qidahen-boundary-source-input').setInputFiles(sourcePath);
        await expect(page.getByText(/已从带底图描线图抽取边界图/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('aside')).toContainText('底图差分');
        await waitForBoundaryDraftPixels(page, 1000);

        await expect.poll(async () => (await readBoundaryExtractionStats(page)).keptPixelCount ?? 0).toBeGreaterThan(1000);
        const extractionStats = await readBoundaryExtractionStats(page);
        expect(extractionStats.matchedPixelCount).not.toBeNull();
        expect(extractionStats.drawnChangedPixelCount).not.toBeNull();
        expect(extractionStats.keptPixelCount).not.toBeNull();
        expect(extractionStats.matchedPixelCount!).toBeGreaterThan(50000);
        expect(extractionStats.drawnChangedPixelCount!).toBeLessThan(30000);
        expect(extractionStats.keptPixelCount!).toBeGreaterThan(1000);
        expect(extractionStats.keptPixelCount!).toBeLessThan(20000);
        expect(extractionStats.matchedPixelCount!).toBeGreaterThan(extractionStats.keptPixelCount! * 4);

        const barrierStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(barrierStats.opaquePixels).toBeGreaterThan(1000);
        expect(barrierStats.opaquePixels).toBeLessThan(20000);
        expect(barrierStats.bounds).not.toBeNull();
        expect(barrierStats.bounds!.left).toBeGreaterThan(650);
        expect(barrierStats.bounds!.right).toBeLessThan(900);
        expect(barrierStats.bounds!.top).toBeGreaterThan(320);
        expect(barrierStats.bounds!.bottom).toBeLessThan(520);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should remain untouched when importing real-map hand drawn source` },
            ).toBe(0);
        }

        await saveScreenshot(page, REAL_MAP_HAND_DRAWN_SOURCE_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('导入无新增描线的带底图文件不会清空已有边界图', async ({ page }) => {
        const workspaceName = 'real-map-empty-source-preserves-boundary';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BG_CANVAS_TEST_ID)).opaquePixels).toBeGreaterThan(900000);

        const boundaryPath = await createTransparentBoundaryMaskPng(['jinzhou']);
        await page.getByTestId('qidahen-import-boundary-draft').click();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(boundaryPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 1000);
        const beforeImportStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(beforeImportStats.opaquePixels).toBeGreaterThan(1000);

        const unchangedSourcePath = path.resolve(process.cwd(), 'public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png');
        await page.getByTestId('qidahen-import-boundary-source').click();
        await page.getByTestId('qidahen-boundary-source-input').setInputFiles(unchangedSourcePath);
        const failureMessage = page.getByText(/导入带底图描线图失败：没有抽出可用边界像素，已保留当前边界图/u);
        await expect(failureMessage).toBeVisible({ timeout: 30000 });
        await expect(page.locator('aside')).toContainText(`当前边界图像素：${beforeImportStats.opaquePixels.toLocaleString()}`);
        const afterImportStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(afterImportStats.opaquePixels).toBe(beforeImportStats.opaquePixels);
        expect(afterImportStats.bounds).toEqual(beforeImportStats.bounds);
        await failureMessage.scrollIntoViewIfNeeded();
        await saveScreenshot(page, REAL_MAP_EMPTY_SOURCE_PRESERVES_BOUNDARY_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('导入真实底图完整描线图后贴合不足仍不能验收成正常成果', async ({ page }) => {
        const workspaceName = 'real-map-complete-boundary-source';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(300000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BG_CANVAS_TEST_ID)).opaquePixels).toBeGreaterThan(900000);
        const sourcePath = await createRealMapCompleteBoundarySourcePng();
        await page.getByTestId('qidahen-import-boundary-source').click();
        await page.getByTestId('qidahen-boundary-source-input').setInputFiles(sourcePath);
        await expect(page.getByText(/已从带底图描线图抽取边界图/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('aside')).toContainText('底图差分');
        await waitForBoundaryDraftPixels(page, 5000);
        await expect(page.getByTestId('qidahen-closed-seed-hit-count')).toHaveText('5');
        for (const regionId of COMPLETE_REGION_IDS) {
            await expect(page.getByTestId(`qidahen-seed-status-${regionId}`)).toContainText('独立');
        }
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should remain untouched in complete real-map boundary source` },
            ).toBe(0);
        }
        await saveScreenshot(page, REAL_MAP_COMPLETE_SOURCE_SCREENSHOT);

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/默认生成已拒绝/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('aside')).toContainText('未解释开放线');
        await page.getByTestId('qidahen-keep-closed-boundary-only').click();
        await expect(page.getByText(/已只保留有效分区边界/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-closed-seed-hit-count')).toHaveText('5');
        await expect(page.getByTestId('qidahen-unexplained-open-boundary-count')).toHaveText('0');

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid^="qidahen-region-generation-result-"]').filter({ hasText: '已生成' })).toHaveCount(5);
        await expect(page.getByTestId('qidahen-boundary-normality-state')).toHaveText('suspicious');
        await expect(page.getByTestId('qidahen-boundary-normality-approval-count')).toContainText('0/5');
        await expect(page.getByTestId('qidahen-acceptance-package-signature-state')).toContainText('missing');
        await expect(page.getByTestId('qidahen-boundary-real-map-fit')).toContainText('blocked');
        await expect(page.getByTestId('qidahen-boundary-normality-blockers')).toContainText('贴近真实底图长线候选');
        for (const regionId of COMPLETE_REGION_IDS) {
            await expect(page.getByTestId(`qidahen-approve-normality-region-${regionId}`)).toBeDisabled();
        }
        await page.getByTestId('qidahen-region-generation-result-shou-cheng').scrollIntoViewIfNeeded();
        await saveScreenshot(page, REAL_MAP_COMPLETE_GENERATED_SCREENSHOT);

        const counts = await getMaskColorCounts(page);
        expect(counts.red).toBeGreaterThan(10000);
        expect(counts.yellow).toBeGreaterThan(10000);

        const acceptanceDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-region-acceptance-package').click();
        const acceptanceDownload = await acceptanceDownloadPromise;
        expect(acceptanceDownload.suggestedFilename()).toBe('qidahen-region-acceptance-package.zip');
        const acceptancePath = await acceptanceDownload.path();
        expect(acceptancePath).not.toBeNull();
        const acceptanceEntries = unzipSync(new Uint8Array(readFileSync(acceptancePath!)));
        const acceptanceReport = JSON.parse(new TextDecoder().decode(acceptanceEntries['report.json'])) as {
            acceptancePackage: { reviewSignature?: string; regions: Array<{ id: string; pixelCount: number }> };
            quality: { normality: { state: string } };
        };
        expect(acceptanceReport.acceptancePackage.reviewSignature).toBeTruthy();
        expect(acceptanceReport.acceptancePackage.regions).toHaveLength(5);
        expect(acceptanceReport.quality.normality.state).toBe('suspicious');
        await expect(page.getByTestId('qidahen-acceptance-package-signature-state')).toContainText('current');

        for (const regionId of COMPLETE_REGION_IDS) {
            await expect(page.getByTestId(`qidahen-normality-preview-state-${regionId}`)).toContainText('未看图');
            await expect(page.getByTestId(`qidahen-approve-normality-region-${regionId}`)).toBeDisabled();
            await expect(page.getByTestId(`qidahen-normality-acceptance-${regionId}`)).toContainText('待验收');
        }
        await page.getByTestId('qidahen-view-normality-region-shou-cheng').click();
        await expect(page.getByTestId('qidahen-region-acceptance-preview')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-acceptance-preview-title')).toContainText('验收裁图');
        await expect(page.getByTestId('qidahen-region-acceptance-preview-meta')).toContainText('crop');
        await expect(page.getByTestId('qidahen-region-acceptance-preview-image')).toBeVisible();
        const previewImageSrc = await page.getByTestId('qidahen-region-acceptance-preview-image').getAttribute('src');
        expect(previewImageSrc?.startsWith('data:image/png;base64,')).toBe(true);
        expect(previewImageSrc?.length ?? 0).toBeGreaterThan(1000);
        await expect(page.getByTestId('qidahen-normality-preview-state-shou-cheng')).toContainText('已看图');
        await expect(page.getByTestId('qidahen-approve-normality-region-shou-cheng')).toBeDisabled();

        await page.getByTestId('qidahen-boundary-normality-report').scrollIntoViewIfNeeded();
        await saveScreenshot(page, REAL_MAP_COMPLETE_REJECTED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('局部候选线支撑不能替整张边界图背书并进入人工验收', async ({ page }) => {
        const workspaceName = 'real-map-local-support-rejected';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(480000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-boundary-diagnostics-details').locator('summary').click();
        const candidateDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-real-map-boundary-candidate').click();
        const candidateDownload = await candidateDownloadPromise;
        const candidatePath = await candidateDownload.path();
        expect(candidatePath).not.toBeNull();
        const sourcePath = await createRealMapAcceptedBoundarySourcePng(candidatePath!);
        await page.getByTestId('qidahen-import-boundary-source').click();
        await page.getByTestId('qidahen-boundary-source-input').setInputFiles(sourcePath);
        await expect(page.getByText(/已从带底图描线图抽取边界图/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 5000);
        await expect(page.getByTestId('qidahen-closed-seed-hit-count')).toHaveText('5');
        await page.getByTestId('qidahen-keep-closed-boundary-only').click();
        await expect(page.getByText(/已只保留有效分区边界/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-closed-seed-hit-count')).toHaveText('5');
        await expect(page.getByTestId('qidahen-unexplained-open-boundary-count')).toHaveText('0');

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid^="qidahen-region-generation-result-"]').filter({ hasText: '已生成' })).toHaveCount(5);
        await expect(page.getByTestId('qidahen-boundary-normality-state')).toHaveText('suspicious');
        await expect(page.getByTestId('qidahen-boundary-real-map-fit')).toContainText('blocked');
        await expect(page.getByTestId('qidahen-boundary-real-map-fit-weak-regions')).toContainText('弱支撑');
        await expect(page.getByTestId('qidahen-boundary-real-map-fit-weak-regions')).toContainText('宋进');
        await expect(page.getByTestId('qidahen-boundary-normality-blockers')).toContainText('局部边界缺少真实底图支撑');
        await expect(page.getByTestId('qidahen-boundary-shape-report')).toContainText('passed');
        await expect(page.getByTestId('qidahen-boundary-normality-approval-count')).toContainText('0/5');
        await expect(page.getByTestId('qidahen-boundary-repair-queue-count')).toHaveText('3');
        await expect(page.getByTestId('qidahen-repair-queue-weak-support-song-jin')).toContainText('宋进');
        await page.getByTestId('qidahen-repair-queue-weak-support-song-jin').click();
        await expect(page.getByTestId('qidahen-boundary-repair-preview')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-repair-preview-title')).toContainText('宋进 底图弱支撑');
        await expect(page.getByTestId('qidahen-boundary-repair-preview-detail')).toContainText('局部边界支撑');
        await expect(page.getByTestId('qidahen-boundary-repair-preview-detail')).toContainText('未支撑');
        await expect(page.getByTestId('qidahen-boundary-repair-preview-detail')).toContainText('弱支撑范围');
        await expect(page.getByTestId('qidahen-forbidden-ui-overlay')).toHaveCount(0);
        await saveTestIdScreenshot(page, 'qidahen-boundary-repair-preview', REAL_MAP_LOCAL_SUPPORT_REPAIR_PREVIEW_SCREENSHOT);

        const repairDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-repair-package').click();
        const repairDownload = await repairDownloadPromise;
        const repairPath = await repairDownload.path();
        expect(repairPath).not.toBeNull();
        expect(repairDownload.suggestedFilename()).toBe('qidahen-boundary-repair-package.zip');
        const repairEntries = unzipSync(new Uint8Array(readFileSync(repairPath!)));
        expect(Object.keys(repairEntries).sort()).toEqual([
            'README.txt',
            'layers/current-boundary-transparent.png',
            'layers/weak-support-overlay-transparent.png',
            'manifest.json',
            'overview.png',
            'problem-sources/weak-support-shan-hai-guan.png',
            'problem-sources/weak-support-shou-cheng.png',
            'problem-sources/weak-support-song-jin.png',
            'problems/weak-support-shan-hai-guan.png',
            'problems/weak-support-shou-cheng.png',
            'problems/weak-support-song-jin.png',
            'qidahen-main-map.png',
            'repair-crops/weak-support-shan-hai-guan-boundary-transparent.png',
            'repair-crops/weak-support-shou-cheng-boundary-transparent.png',
            'repair-crops/weak-support-song-jin-boundary-transparent.png',
            'report.json',
        ]);
        const repairManifest = JSON.parse(new TextDecoder().decode(repairEntries['manifest.json'])) as {
            boundaryColors: Array<{ css: string }>;
            forbiddenUiRects: unknown[];
            layers: { repairedBoundaryTarget: string; currentBoundary: string | null; weakSupportOverlay: string | null };
            importTargets: { preferred: string; fallbackCurrentBoundary: string };
            rules: string[];
            problemFiles: Array<{
                type: string;
                fileName: string;
                sourceFileName: string;
                repairCropTarget: string;
                crop: { left: number; top: number; width: number; height: number };
            }>;
        };
        expect(repairManifest.boundaryColors.map((color) => color.css)).toEqual([
            'rgb(61, 69, 66)',
            'rgb(126, 97, 56)',
            'rgb(128, 104, 62)',
            'rgb(43, 36, 34)',
        ]);
        expect(repairManifest.forbiddenUiRects.length).toBeGreaterThan(0);
        expect(repairManifest.layers.currentBoundary).toBe('layers/current-boundary-transparent.png');
        expect(repairManifest.layers.weakSupportOverlay).toBe('layers/weak-support-overlay-transparent.png');
        expect(repairManifest.layers.repairedBoundaryTarget).toBe('layers/repaired-boundary-transparent.png');
        expect(repairManifest.importTargets.preferred).toBe('layers/repaired-boundary-transparent.png');
        expect(repairManifest.importTargets.fallbackCurrentBoundary).toBe('layers/current-boundary-transparent.png');
        expect(repairManifest.rules.join('\n')).toContain('无法连成线、无法封口的碎线直接舍弃');
        expect(repairManifest.rules.join('\n')).toContain('repair-crops/*.png');
        expect(repairManifest.problemFiles.filter((problem) => problem.type === 'weak-support')).toHaveLength(3);
        expect(repairManifest.problemFiles.map((problem) => problem.repairCropTarget).sort()).toEqual([
            'repair-crops/weak-support-shan-hai-guan-boundary-transparent.png',
            'repair-crops/weak-support-shou-cheng-boundary-transparent.png',
            'repair-crops/weak-support-song-jin-boundary-transparent.png',
        ]);
        expect(repairManifest.problemFiles.map((problem) => problem.sourceFileName).sort()).toEqual([
            'problem-sources/weak-support-shan-hai-guan.png',
            'problem-sources/weak-support-shou-cheng.png',
            'problem-sources/weak-support-song-jin.png',
        ]);
        const repairReadme = new TextDecoder().decode(repairEntries['README.txt']);
        expect(repairReadme).toContain('boundaryColors');
        expect(repairReadme).toContain('layers/repaired-boundary-transparent.png');
        expect(repairReadme).toContain('repair-crops/*.png');
        expect(repairReadme).toContain('problems/*.png');
        const repairReport = JSON.parse(new TextDecoder().decode(repairEntries['report.json'])) as {
            matchedSeedCount: number;
            requiredSeedCount: number;
            unmatchedCount: number;
            weakSupportCount: number;
            openComponentCount: number;
            unexplainedOpenComponentCount: number;
            layers: { mainMap: string; currentBoundary: string | null; weakSupportOverlay: string | null };
            problems: Array<{
                type: string;
                fileName: string;
                sourceFileName: string;
                repairCropTarget: string;
                crop: { left: number; top: number; width: number; height: number };
                supportRatio?: number;
                unsupportedBoundaryPixelCount?: number;
                weakBoundaryBounds?: { left: number; top: number; right: number; bottom: number } | null;
            }>;
        };
        expect(repairReport.matchedSeedCount).toBe(5);
        expect(repairReport.requiredSeedCount).toBe(5);
        expect(repairReport.unmatchedCount).toBe(0);
        expect(repairReport.weakSupportCount).toBe(3);
        expect(repairReport.openComponentCount).toBeGreaterThanOrEqual(0);
        expect(repairReport.unexplainedOpenComponentCount).toBe(0);
        expect(repairReport.layers.mainMap).toBe('qidahen-main-map.png');
        expect(repairReport.layers.currentBoundary).toBe('layers/current-boundary-transparent.png');
        expect(repairReport.layers.weakSupportOverlay).toBe('layers/weak-support-overlay-transparent.png');
        const weakProblems = repairReport.problems.filter((problem) => problem.type === 'weak-support');
        expect(weakProblems).toHaveLength(3);
        expect(repairReport.problems.filter((problem) => problem.type === 'open-boundary')).toHaveLength(0);
        const songJinWeakProblem = weakProblems.find((problem) => problem.fileName === 'problems/weak-support-song-jin.png');
        expect(songJinWeakProblem?.supportRatio).toBeLessThan(0.01);
        expect(songJinWeakProblem?.unsupportedBoundaryPixelCount).toBeGreaterThan(0);
        expect(songJinWeakProblem?.weakBoundaryBounds).toEqual(expect.objectContaining({
            left: expect.any(Number),
            top: expect.any(Number),
            right: expect.any(Number),
            bottom: expect.any(Number),
        }));
        const sharp = await getSharp();
        const mainMap = sharp(Buffer.from(repairEntries['qidahen-main-map.png']));
        expect(await mainMap.metadata()).toEqual(expect.objectContaining({ width: MASK_WIDTH, height: MASK_HEIGHT }));
        const mainMapRaw = await mainMap.ensureAlpha().raw().toBuffer();
        let mainMapOpaque = 0;
        for (let index = 3; index < mainMapRaw.length; index += 4) {
            if (mainMapRaw[index] >= 16) mainMapOpaque += 1;
        }
        expect(mainMapOpaque).toBeGreaterThan(900000);
        const currentBoundaryLayer = sharp(Buffer.from(repairEntries['layers/current-boundary-transparent.png']));
        expect(await currentBoundaryLayer.metadata()).toEqual(expect.objectContaining({ width: MASK_WIDTH, height: MASK_HEIGHT }));
        const currentBoundaryLayerRaw = await currentBoundaryLayer.ensureAlpha().raw().toBuffer();
        let currentBoundaryLayerOpaque = 0;
        for (let index = 3; index < currentBoundaryLayerRaw.length; index += 4) {
            if (currentBoundaryLayerRaw[index] >= 16) currentBoundaryLayerOpaque += 1;
        }
        expect(currentBoundaryLayerOpaque).toBeGreaterThan(1000);
        const weakSupportOverlay = sharp(Buffer.from(repairEntries['layers/weak-support-overlay-transparent.png']));
        expect(await weakSupportOverlay.metadata()).toEqual(expect.objectContaining({ width: MASK_WIDTH, height: MASK_HEIGHT }));
        const weakSupportOverlayRaw = await weakSupportOverlay.ensureAlpha().raw().toBuffer();
        let weakSupportOverlayOpaque = 0;
        for (let index = 3; index < weakSupportOverlayRaw.length; index += 4) {
            if (weakSupportOverlayRaw[index] >= 16) weakSupportOverlayOpaque += 1;
        }
        expect(weakSupportOverlayOpaque).toBeGreaterThan(100);
        const weakCropMetadata = await sharp(Buffer.from(repairEntries['problems/weak-support-song-jin.png'])).metadata();
        expect(weakCropMetadata.width).toBe(360);
        expect(weakCropMetadata.height).toBe(260);
        const weakSourceCropMetadata = await sharp(Buffer.from(repairEntries['problem-sources/weak-support-song-jin.png'])).metadata();
        expect(weakSourceCropMetadata.width).toBe(360);
        expect(weakSourceCropMetadata.height).toBe(260);
        const songJinManifestProblem = repairManifest.problemFiles.find((problem) => problem.fileName === 'problems/weak-support-song-jin.png');
        expect(songJinManifestProblem?.repairCropTarget).toBe('repair-crops/weak-support-song-jin-boundary-transparent.png');
        expect(songJinManifestProblem?.sourceFileName).toBe('problem-sources/weak-support-song-jin.png');
        const songJinRepairCrop = sharp(Buffer.from(repairEntries['repair-crops/weak-support-song-jin-boundary-transparent.png']));
        expect(await songJinRepairCrop.metadata()).toEqual(expect.objectContaining({ width: 360, height: 260 }));
        writeFileSync(REAL_MAP_LOCAL_SUPPORT_BOUNDARY_LAYER_SCREENSHOT, repairEntries['layers/current-boundary-transparent.png']);
        writeFileSync(REAL_MAP_LOCAL_SUPPORT_WEAK_OVERLAY_SCREENSHOT, repairEntries['layers/weak-support-overlay-transparent.png']);
        writeFileSync(REAL_MAP_LOCAL_SUPPORT_REPAIR_MAIN_MAP_SCREENSHOT, repairEntries['qidahen-main-map.png']);
        writeFileSync(REAL_MAP_LOCAL_SUPPORT_REPAIR_PACKAGE_SCREENSHOT, repairEntries['problems/weak-support-song-jin.png']);
        await expect(page.getByText(/底图弱支撑 3 个/u)).toBeVisible({ timeout: 30000 });

        expect(songJinManifestProblem).toBeTruthy();
        const songJinCrop = songJinManifestProblem!.crop;
        const songJinWeakBounds = songJinWeakProblem!.weakBoundaryBounds!;
        const strokeStart = {
            x: songJinWeakBounds.left + 6 - songJinCrop.left,
            y: Math.round((songJinWeakBounds.top + songJinWeakBounds.bottom) / 2) - songJinCrop.top,
        };
        const strokeEnd = {
            x: songJinWeakBounds.right - 6 - songJinCrop.left,
            y: Math.round((songJinWeakBounds.top + songJinWeakBounds.bottom) / 2) - songJinCrop.top,
        };
        const repairStrokeSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${songJinCrop.width}" height="${songJinCrop.height}" viewBox="0 0 ${songJinCrop.width} ${songJinCrop.height}">
                <path d="M ${strokeStart.x} ${strokeStart.y} C ${strokeStart.x + 34} ${strokeStart.y - 18} ${strokeEnd.x - 34} ${strokeEnd.y + 18} ${strokeEnd.x} ${strokeEnd.y}" fill="none" stroke="rgb(61,69,66)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        `;
        const editedSongJinProblemCrop = await sharp(Buffer.from(repairEntries[songJinManifestProblem!.fileName]))
            .composite([{ input: Buffer.from(repairStrokeSvg) }])
            .png()
            .toBuffer();
        const editedRepairEntries: Record<string, Uint8Array> = { ...repairEntries };
        editedRepairEntries[songJinManifestProblem!.fileName] = new Uint8Array(editedSongJinProblemCrop);
        const editedRepairZipPath = path.resolve(process.cwd(), 'temp/qidahen-edited-boundary-repair-package.zip');
        writeFileSync(editedRepairZipPath, zipSync(editedRepairEntries, { level: 9 }));

        await page.getByTestId('qidahen-import-boundary-repair-package').click();
        await page.getByTestId('qidahen-boundary-repair-package-input').setInputFiles(editedRepairZipPath);
        await expect(page.getByText(/已从补边包回导 layers\/current-boundary-transparent\.png \+ 局部修复层 0 个 \+ 可见裁图画线 1 个/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/跳过未修改局部层 3 个/u)).toBeVisible();
        await expect(page.getByText(/已从 problems 可见裁图回收边界色画线 1 张/u)).toBeVisible();
        await expect(page.getByText(/跳过未修改可见裁图 2 张/u)).toBeVisible();
        await waitForBoundaryDraftPixels(page, currentBoundaryLayerOpaque);
        await expect(page.getByTestId('qidahen-open-boundary-count')).not.toHaveText('0');
        await page.getByTestId('qidahen-keep-closed-boundary-only').click();
        await expect(page.getByText(/已只保留有效分区边界/u)).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-normality-state')).toHaveText('suspicious');
        await expect(page.getByTestId('qidahen-boundary-real-map-fit')).toContainText('blocked');
        await expect(page.getByTestId('qidahen-boundary-normality-blockers')).toContainText('局部边界缺少真实底图支撑');
        await page.getByTestId('qidahen-boundary-normality-report').scrollIntoViewIfNeeded();
        await saveScreenshot(page, REAL_MAP_LOCAL_SUPPORT_REPAIR_IMPORT_SCREENSHOT);

        for (const regionId of COMPLETE_REGION_IDS) {
            await expect(page.getByTestId(`qidahen-approve-normality-region-${regionId}`)).toBeDisabled();
        }

        await page.getByTestId('qidahen-boundary-normality-report').scrollIntoViewIfNeeded();
        await saveScreenshot(page, REAL_MAP_LOCAL_SUPPORT_REJECTED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('完整手绘边界图会批量生成多个独立分区并在导入时舍弃断线', async ({ page }) => {
        const workspaceName = 'hand-drawn-multi-generated';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(480000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const sourcePath = await createSyntheticBoundarySourcePng(['jinzhou', 'song-jin'], { includeOpenNoiseLine: true });
        await page.getByTestId('qidahen-import-boundary-source').click();
        await page.getByTestId('qidahen-boundary-source-input').setInputFiles(sourcePath);
        await expect(page.getByText(/已从带底图描线图抽取边界图/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 200);
        await expect(page.getByTestId('qidahen-boundary-closure-diagnostics')).toBeVisible();
        await expect.poll(async () => {
            const text = await page.getByTestId('qidahen-closed-face-count').textContent();
            return Number.parseInt(text ?? '0', 10);
        }).toBeGreaterThanOrEqual(2);
        await expect(page.getByTestId('qidahen-closed-seed-hit-count')).toHaveText('2');
        await expect(page.getByTestId('qidahen-open-boundary-count')).toHaveText('0');
        await expect(page.getByTestId('qidahen-focus-nearest-open-boundary')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-open-boundary-markers')).toHaveCount(0);
        await expect(page.locator('[data-testid^="qidahen-open-boundary-marker-"]')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-unmatched-seed-markers')).toBeVisible();
        await expect(page.getByTestId('qidahen-unmatched-seed-marker-shan-hai-guan')).toBeVisible();
        await expect(page.getByTestId('qidahen-unmatched-closed-seeds')).toContainText('山海关');
        await expect(page.getByTestId('qidahen-seed-status-jinzhou')).toContainText('锦州 · 独立');
        await expect(page.getByTestId('qidahen-seed-status-song-jin')).toContainText('宋进 · 独立');
        await expect(page.getByTestId('qidahen-seed-status-shan-hai-guan')).toContainText('山海关 · 未独立');
        await expect(page.getByTestId('qidahen-quality-region-jinzhou')).toContainText('可生成');
        await expect(page.getByTestId('qidahen-quality-region-shan-hai-guan')).toContainText('未分区');
        await expect(page.getByTestId('qidahen-boundary-repair-action-hint')).toContainText('山海关');
        await expect(page.getByTestId('qidahen-diagnostics-focus-next-unmatched-seed')).toBeEnabled();
        await expect(page.getByTestId('qidahen-diagnostics-focus-first-open-boundary')).toBeDisabled();
        await expect(page.getByTestId('qidahen-diagnostics-keep-valid-partitions')).toBeEnabled();
        await expect(page.getByTestId('qidahen-diagnostics-export-repair-package')).toBeEnabled();
        await expect(page.getByTestId('qidahen-boundary-repair-queue')).toBeVisible();
        await expect(page.getByTestId('qidahen-repair-queue-unmatched-shan-hai-guan')).toBeVisible();
        await page.getByTestId('qidahen-repair-queue-unmatched-shan-hai-guan').click();
        await expect(page.locator('main')).toContainText('当前区域：山海关');
        await expect(page.locator('aside')).toContainText(/已聚焦未独立区域 山海关 seed/u);
        await expect(page.getByTestId('qidahen-toggle-forbidden-ui-overlay')).toContainText('显示禁区');
        await expect(page.getByTestId('qidahen-forbidden-ui-overlay')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-boundary-repair-preview')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-repair-preview-title')).toContainText('未独立 seed');
        await expect(page.getByTestId('qidahen-boundary-repair-preview-detail')).toContainText('连不上的线直接舍弃');
        await expect(page.getByTestId('qidahen-boundary-repair-preview-image')).toHaveAttribute('src', /^data:image\/png/u);
        await saveTestIdScreenshot(page, 'qidahen-boundary-repair-preview', BOUNDARY_REPAIR_PREVIEW_SCREENSHOT);
        await page.getByTestId('qidahen-boundary-closure-diagnostics').scrollIntoViewIfNeeded();
        await saveScreenshot(page, HAND_DRAWN_MULTI_DIAGNOSTICS_SCREENSHOT);

        const boundaryPixelsBeforeCleanup = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        await page.getByTestId('qidahen-keep-closed-boundary-only').click();
        await expect(page.getByText(/已只保留有效分区边界/u)).toBeVisible();
        await expect(page.getByTestId('qidahen-open-boundary-count')).toHaveText('0');
        await expect(page.locator('[data-testid^="qidahen-open-boundary-marker-"]')).toHaveCount(0);
        const boundaryPixelsAfterCleanup = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(boundaryPixelsAfterCleanup.opaquePixels).toBeGreaterThan(200);
        expect(boundaryPixelsAfterCleanup.opaquePixels).toBeLessThanOrEqual(boundaryPixelsBeforeCleanup.opaquePixels);
        await page.getByTestId('qidahen-boundary-closure-diagnostics').scrollIntoViewIfNeeded();
        await saveScreenshot(page, HAND_DRAWN_MULTI_CLOSED_ONLY_SCREENSHOT);

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/默认生成已拒绝/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/独立 seed 2\/5/u)).toBeVisible();
        await page.getByTestId('qidahen-debug-generate-regions-from-boundary').click();
        await expect(page.getByText(/已调试生成当前独立分区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('已生成');
        await expect(page.getByTestId('qidahen-region-generation-result-song-jin')).toContainText('已生成');
        await expect(page.getByTestId('qidahen-region-generation-result-shan-hai-guan')).not.toContainText('已生成');
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('边界还没分区完');
        await expect(page.getByTestId('qidahen-boundary-quality-detail')).toContainText('未进入独立分区 seed');
        await expect(page.getByTestId('qidahen-quality-boundary-ui-pixels')).toHaveText('0');
        await expect(page.locator('aside')).toContainText(/本次按边界线分割全图；未被边界真正隔开的 seed 会直接跳过/u);

        const counts = await getMaskColorCounts(page);
        expect(counts.red).toBeGreaterThan(1000);
        expect(counts.yellow).toBeGreaterThan(1000);
        expect(counts.redCenter).not.toBeNull();
        expect(counts.yellowCenter).not.toBeNull();
        expect(counts.redCenter!.x).toBeGreaterThan(700);
        expect(counts.redCenter!.x).toBeLessThan(850);
        expect(counts.redCenter!.y).toBeGreaterThan(350);
        expect(counts.redCenter!.y).toBeLessThan(500);
        expect(counts.yellowCenter!.x).toBeGreaterThan(650);
        expect(counts.yellowCenter!.x).toBeLessThan(810);
        expect(counts.yellowCenter!.y).toBeGreaterThan(500);
        expect(counts.yellowCenter!.y).toBeLessThan(640);

        await page.getByTestId('qidahen-region-generation-result-song-jin').scrollIntoViewIfNeeded();
        await saveScreenshot(page, HAND_DRAWN_MULTI_GENERATED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('导入完成边界图后按独立分区生成区域并舍弃断线', async ({ page }) => {
        const workspaceName = 'completed-boundary-import';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(300000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const boundaryMaskPath = await createTransparentBoundaryMaskPng(['jinzhou', 'song-jin'], { includeOpenNoiseLine: true });
        await page.getByTestId('qidahen-import-boundary-draft').click();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(boundaryMaskPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 1000);
        await waitForFinalBarrierPixels(page, 1000);
        await expect.poll(async () => {
            const text = await page.getByTestId('qidahen-closed-face-count').textContent();
            return Number.parseInt(text ?? '0', 10);
        }).toBeGreaterThanOrEqual(2);
        await expect.poll(async () => {
            const text = await page.getByTestId('qidahen-closed-seed-hit-count').textContent();
            return Number.parseInt(text ?? '0', 10);
        }).toBeGreaterThanOrEqual(2);
        await expect(page.getByTestId('qidahen-open-boundary-count')).toHaveText('0');
        await expect(page.getByTestId('qidahen-unmatched-seed-marker-xian-xing')).toBeVisible();
        await expect(page.getByTestId('qidahen-unmatched-seed-marker-shou-cheng')).toBeVisible();

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/默认生成已拒绝/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('aside')).toContainText('默认生成已拒绝');
        await expect((await getCanvasOpaqueBounds(page, 'qidahen-mask-canvas')).opaquePixels).toBe(0);

        await page.getByTestId('qidahen-debug-generate-regions-from-boundary').click();
        await expect(page.getByText(/已调试生成当前独立分区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('已生成');
        await expect(page.getByTestId('qidahen-region-generation-result-song-jin')).toContainText('已生成');
        await expect(page.getByTestId('qidahen-region-generation-result-shan-hai-guan')).not.toContainText('已生成');
        await expect(page.locator('aside')).toContainText('已生成 2');
        await expect(page.locator('aside')).toContainText('未生成 3');
        await expect(page.getByTestId('qidahen-quality-open-count')).toHaveText('0');
        const counts = await getMaskColorCounts(page);
        expect(counts.red).toBeGreaterThan(1000);
        expect(counts.yellow).toBeGreaterThan(1000);
        await switchToPureBoundaryView(page);
        await saveScreenshot(page, COMPLETED_BOUNDARY_IMPORT_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('边界断点只定位不自动直线封口，手绘补边支持撤销与重做', async ({ page }) => {
        const workspaceName = 'barrier-hint-undo-redo';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(360000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const sourcePath = await createSyntheticBoundarySourcePng(['jinzhou', 'song-jin'], { includeOpenNoiseLine: true });
        await page.getByTestId('qidahen-import-boundary-source').click();
        await page.getByTestId('qidahen-boundary-source-input').setInputFiles(sourcePath);
        await expect(page.getByText(/已从带底图描线图抽取边界图/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByRole('button', { name: '短线辅助', exact: true })).toHaveCount(0);
        await expect(page.getByTestId('qidahen-open-boundary-count')).toHaveText('1');
        await expect(page.getByTestId('qidahen-undo-barrier-hints')).toBeDisabled();
        await expect(page.getByTestId('qidahen-redo-barrier-hints')).toBeDisabled();
        expect(await readManualBarrierAddCount(page)).toBe(0);

        await page.getByTestId('qidahen-focus-nearest-open-boundary').click();
        await expect(page.getByText(/工具不会自动直线封口/u)).toBeVisible();
        expect(await readManualBarrierAddCount(page)).toBe(0);

        const canvasBox = await getRect(page.getByTestId('qidahen-region-canvas'));
        await dragCanvasMapPolyline(page, canvasBox, [
            { x: 505, y: 235 },
            { x: 538, y: 266 },
            { x: 584, y: 263 },
            { x: 628, y: 230 },
            { x: 690, y: 255 },
        ], 3);
        await expect.poll(async () => readManualBarrierAddCount(page)).toBeGreaterThan(0);
        const handDrawnAddCount = await readManualBarrierAddCount(page);
        await expect(page.getByTestId('qidahen-undo-barrier-hints')).toBeEnabled();
        await expect(page.getByTestId('qidahen-redo-barrier-hints')).toBeDisabled();

        await page.getByTestId('qidahen-undo-barrier-hints').click();
        await expect(page.getByText(/已撤销上一步边界微调/u)).toBeVisible();
        await expect.poll(async () => readManualBarrierAddCount(page)).toBe(0);
        await expect(page.getByTestId('qidahen-undo-barrier-hints')).toBeDisabled();
        await expect(page.getByTestId('qidahen-redo-barrier-hints')).toBeEnabled();

        await page.getByTestId('qidahen-redo-barrier-hints').click();
        await expect(page.getByText(/已重做边界微调/u)).toBeVisible();
        await expect.poll(async () => readManualBarrierAddCount(page)).toBe(handDrawnAddCount);
        await expect(page.getByTestId('qidahen-undo-barrier-hints')).toBeEnabled();
        await expect(page.getByTestId('qidahen-redo-barrier-hints')).toBeDisabled();

        await page.getByTestId('qidahen-boundary-closure-diagnostics').scrollIntoViewIfNeeded();
        await saveScreenshot(page, BARRIER_HINT_UNDO_REDO_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('导入带底图描线图后可先保存工作区再刷新回读边界图', async ({ page }) => {
        const workspaceName = 'hand-drawn-workspace-only';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const sourcePath = await createSyntheticBoundarySourcePng();
        await page.getByRole('button', { name: '清空', exact: true }).click();
        await page.getByRole('button', { name: '清空边界图' }).click();
        await page.getByTestId('qidahen-import-boundary-source').click();
        await page.getByTestId('qidahen-boundary-source-input').setInputFiles(sourcePath);
        await expect(page.getByText(/已从带底图描线图抽取边界图/u)).toBeVisible();
        await waitForBoundaryDraftPixels(page, 100);

        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到/u)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/仅保存边界工作区，尚未生成正式区域/u)).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBeGreaterThan(100);
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-mask.png'))).toBe(0);

        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 100);
        await waitForFinalBarrierPixels(page, 100);
        await saveScreenshot(page, HAND_DRAWN_WORKSPACE_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('描线参考层可保存回读并支持清除后不再回读', async ({ page }) => {
        const workspaceName = 'hand-drawn-reference-persisted';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const sourcePath = await createSyntheticBoundarySourcePng();
        await page.getByTestId('qidahen-import-boundary-source').click();
        await page.getByTestId('qidahen-boundary-source-input').setInputFiles(sourcePath);
        await expect(page.getByText(/已从带底图描线图抽取边界图/u)).toBeVisible();
        await expect(page.getByText(/已载入参考层/u)).toBeVisible();
        await expect(page.getByTestId('qidahen-clear-boundary-source-reference')).toBeVisible();

        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到/u)).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => workspaceFileExists(workspaceName, 'region-boundary-source-reference.png')).toBe(true);
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-source-reference.png'))).toBeGreaterThan(100);

        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('参考层', { exact: true })).toBeVisible();
        await expect(page.getByText(/参考层：42%/u)).toBeVisible();
        await expect(page.getByTestId('qidahen-clear-boundary-source-reference')).toBeVisible();
        await saveScreenshot(page, HAND_DRAWN_REFERENCE_PERSISTED_SCREENSHOT);

        await page.getByTestId('qidahen-clear-boundary-source-reference').click();
        await expect(page.getByText(/已清除参考层/u)).toBeVisible();
        await expect(page.getByTestId('qidahen-clear-boundary-source-reference')).toHaveCount(0);
        await expect(page.locator('aside')).not.toContainText('参考层：');

        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到/u)).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => workspaceFileExists(workspaceName, 'region-boundary-source-reference.png')).toBe(false);

        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-clear-boundary-source-reference')).toHaveCount(0);
        await expect(page.locator('aside')).not.toContainText('参考层：');
        await saveScreenshot(page, HAND_DRAWN_REFERENCE_CLEARED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('best-available-boundary-v3 可直接改方向进入区域通路与移动代价工具', async ({ page }) => {
        const workspaceName = 'best-available-boundary-v3-detour';
        cloneWorkspaceDir('best-available-boundary-v3', workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 1000);
        await expect(page.locator('main')).toContainText('模式：边界修正');
        await expect(page.getByTestId('qidahen-closed-seed-hit-count')).toHaveText('0');
        await expect(page.getByTestId('qidahen-unexplained-open-boundary-count')).toHaveText('14');
        await expect(page.getByTestId('qidahen-boundary-move-cost-detour')).toContainText('如果你现在是测试通路和移动代价');
        await expect(page.getByTestId('qidahen-boundary-move-cost-detour')).toContainText('独立 seed 0/5');
        await expect(page.getByTestId('qidahen-boundary-move-cost-detour')).toContainText('未解释开放线 14 条');
        await page.getByTestId('qidahen-boundary-move-cost-detour').scrollIntoViewIfNeeded();
        await saveScreenshot(page, BEST_AVAILABLE_BOUNDARY_DETOUR_SCREENSHOT);

        await page.getByTestId('qidahen-boundary-detour-region-path-draft').click();
        await expect(page.getByText(/已按真实底图生成区域粗稿并切到路径模式/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-truth-workflow-banner')).toContainText('区域粗稿 + 通路编辑（次路线）');
        await expect(page.getByTestId('qidahen-region-truth-workflow-banner')).toContainText('当前已锁显式 truth：5 区');
        await expect(page.locator('[data-testid^="qidahen-region-graph-node-"]')).toHaveCount(5);
        const passageRows = page.locator('[data-testid^="qidahen-passage-row-"]');
        await expect(passageRows.first()).toBeVisible();
        await expect(page.getByTestId('qidahen-passage-summary')).toContainText('中心 5 / 通路');

        await page.getByTestId('qidahen-primary-save-graph-only').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已单独保存连线/u, { timeout: 30000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-mask.png'))).toBeGreaterThan(1000);
        const savedGraph = readSavedRegionGraph(workspaceName);
        expect(savedGraph.nodes).toHaveLength(5);
        expect(savedGraph.edges.length).toBeGreaterThan(0);
        await saveScreenshot(page, BEST_AVAILABLE_BOUNDARY_MOVE_COST_SCREENSHOT);

        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-truth-workflow-banner')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-truth-workflow-banner')).toContainText('区域粗稿 + 通路编辑（次路线）', { timeout: 30000 });
        await expect(page.locator('main')).toContainText('模式：通路编辑', { timeout: 30000 });
        await expect(page.locator('main')).toContainText('路径：4', { timeout: 30000 });
        await saveScreenshot(page, BEST_AVAILABLE_BOUNDARY_MOVE_COST_RELOAD_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('best-available-move-cost-ready 可直接编辑路径类型并保存回读', async ({ page }) => {
        const workspaceName = 'best-available-move-cost-ready-edit';
        cloneWorkspaceDir('best-available-move-cost-ready', workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        const editedPassageId = 'jinzhou::song-jin';
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-compact-passage-editor')).toContainText('通路与移动代价', { timeout: 30000 });
        await expect(page.locator('main')).toContainText('模式：通路编辑', { timeout: 30000 });
        await expect(page.locator('main')).toContainText('路径：4', { timeout: 30000 });
        await expect(page.getByTestId('qidahen-passage-summary')).toContainText('中心 5 / 通路 4');

        const passageRow = page.getByTestId(`qidahen-passage-row-${editedPassageId}`);
        await expect(passageRow).toBeVisible();
        await passageRow.click();
        await expect(page.getByTestId(`qidahen-passage-boundary-${editedPassageId}`)).toHaveValue('plain');
        await expect(page.getByTestId(`qidahen-passage-note-${editedPassageId}`)).toContainText('边界规则：平原 · 战场宽度 3');
        await page.getByTestId(`qidahen-passage-boundary-${editedPassageId}`).selectOption('mountain');
        await expect(page.getByTestId(`qidahen-passage-boundary-${editedPassageId}`)).toHaveValue('mountain');
        await expect(page.getByTestId(`qidahen-passage-note-${editedPassageId}`)).toContainText('边界规则：山脉 · 战场宽度 2');
        await page.getByTestId(`qidahen-compact-passage-travel-cost-${editedPassageId}`).fill('4');
        await expect(page.getByTestId(`qidahen-compact-passage-travel-cost-${editedPassageId}`)).toHaveValue('4');
        await expect(page.getByTestId(`qidahen-passage-note-${editedPassageId}`)).toContainText('移动代价 4 / 战场宽度 2');
        await expect(page.getByTestId(`qidahen-passage-edge-${editedPassageId}`).getByText('山脉')).toBeVisible();
        await passageRow.scrollIntoViewIfNeeded();
        await saveScreenshot(page, BEST_AVAILABLE_MOVE_COST_EDITED_SCREENSHOT);

        await page.getByTestId('qidahen-primary-save-graph-only').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已单独保存连线/u, { timeout: 30000 });

        const savedGraph = readSavedRegionGraph(workspaceName);
        const savedPassage = savedGraph.edges?.find((edge) => edge.id === editedPassageId);
        expect(savedPassage).toMatchObject({
            from: 'jinzhou',
            to: 'song-jin',
            boundaryType: 'mountain',
            boundaryLabel: '山脉',
            travelCost: 4,
            battleWidth: 2,
        });

        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-compact-passage-editor')).toContainText('通路与移动代价', { timeout: 30000 });
        await expect(page.locator('main')).toContainText('模式：通路编辑', { timeout: 30000 });
        const persistedPassageRow = page.getByTestId(`qidahen-passage-row-${editedPassageId}`);
        await expect(persistedPassageRow).toBeVisible();
        await persistedPassageRow.click();
        await expect(page.getByTestId(`qidahen-passage-boundary-${editedPassageId}`)).toHaveValue('mountain');
        await expect(page.getByTestId(`qidahen-passage-note-${editedPassageId}`)).toContainText('边界规则：山脉 · 战场宽度 2');
        await expect(page.getByTestId(`qidahen-compact-passage-travel-cost-${editedPassageId}`)).toHaveValue('4');
        await expect(page.getByTestId(`qidahen-passage-note-${editedPassageId}`)).toContainText('移动代价 4 / 战场宽度 2');
        await expect(page.getByTestId(`qidahen-passage-edge-${editedPassageId}`).getByText('山脉')).toBeVisible();
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('best-available-move-cost-ready 可直接打开运行时预览并读到当前通路规则', async ({ page }) => {
        const workspaceName = 'best-available-move-cost-ready-preview';
        cloneWorkspaceDir('best-available-move-cost-ready', workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        updateWorkspacePassageBoundaryType(workspaceName, EDITED_PASSAGE_ID, 'mountain', '山脉', 2, 4);
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.goto(getRuntimePreviewRoute(workspaceName), { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨运行时预览')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-runtime-preview-workspace')).toContainText(`workspace=${workspaceName}`);
        await expect(page.getByTestId('qidahen-runtime-preview-stats')).toContainText('中心 5 / 通路 4 / 缺中心 0');
        await expect(page.getByTestId(`qidahen-runtime-preview-edge-${EDITED_PASSAGE_ID}`)).toHaveAttribute('data-boundary-type', 'mountain');
        await expect(page.getByTestId(`qidahen-runtime-preview-edge-${EDITED_PASSAGE_ID}`)).toHaveAttribute('data-travel-cost', '4');
        await expect(page.getByTestId(`qidahen-runtime-preview-note-${EDITED_PASSAGE_ID}`)).toContainText('山脉 · 锦州 ↔ 宋进');
        await expect(page.getByTestId(`qidahen-runtime-preview-note-${EDITED_PASSAGE_ID}`)).toContainText('移动代价 4');
        await expect(page.getByTestId(`qidahen-runtime-preview-note-${EDITED_PASSAGE_ID}`)).toContainText('战场宽度 2');
        await expect(page.getByTestId('qidahen-runtime-preview-map')).toBeVisible();
        await saveScreenshot(page, BEST_AVAILABLE_RUNTIME_PREVIEW_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('从空白边界开始手绘后可保存回读并调试生成当前独立分区', async ({ page }) => {
        const workspaceName = 'blank-boundary-hand-drawn';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-start-blank-boundary-draft').click();
        await expect(page.getByText(/空白边界图手绘/u)).toBeVisible();
        await dispatchCanvasPointerPolyline(page, 'qidahen-region-canvas', createHandDrawnDragLoop('jinzhou'));

        await expect.poll(async () => {
            const match = /手工补边：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : 0;
        }).toBeGreaterThan(100);
        await expect.poll(async () => {
            const match = /当前最终障碍像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : 0;
        }).toBeGreaterThan(100);

        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/空白手绘边界已直接固化为边界图/u)).toBeVisible({ timeout: 10000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBeGreaterThan(100);
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-add.png'))).toBe(0);
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-remove.png'))).toBe(0);

        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 100);
        await expect.poll(async () => {
            const match = /手工补边：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBe(0);

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/默认生成已拒绝/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('aside').getByText(/默认生成已拒绝：独立 seed 1\/5/u)).toBeVisible();
        await page.getByTestId('qidahen-debug-generate-regions-from-boundary').click();
        await expect(page.getByText(/已调试生成当前独立分区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('已生成');
        const counts = await getMaskColorCounts(page);
        expect(counts.red).toBeGreaterThan(1000);
        expect(counts.redCenter).not.toBeNull();
        expect(counts.redCenter!.x).toBeGreaterThan(700);
        expect(counts.redCenter!.x).toBeLessThan(850);
        expect(counts.redCenter!.y).toBeGreaterThan(350);
        expect(counts.redCenter!.y).toBeLessThan(500);
        await saveScreenshot(page, BLANK_BOUNDARY_GENERATED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('从空白边界开始用画笔手绘五区后可生成 5/5 并保存回读', async ({ page }) => {
        const workspaceName = 'blank-boundary-five-region-brush-drawn';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(540000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-start-blank-boundary-draft').click();
        await expect(page.getByText(/空白边界图手绘/u)).toBeVisible();
        await page.getByTestId('qidahen-barrier-edit-mode-brush').click();
        await setBrushSize(page, 3);
        for (const regionId of COMPLETE_REGION_IDS) {
            await dispatchCanvasPointerPolyline(page, 'qidahen-region-canvas', createHandDrawnDragLoop(regionId));
        }

        await expect.poll(async () => {
            const match = /手工补边：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : 0;
        }).toBeGreaterThan(500);
        await waitForFinalBarrierPixels(page, 500);
        for (const regionId of COMPLETE_REGION_IDS) {
            await expect(page.getByTestId(`qidahen-region-card-seed-status-${regionId}`)).toHaveText('独立');
        }
        await expect(page.getByTestId('qidahen-closed-seed-hit-count')).toHaveText('5');
        await expect(page.getByTestId('qidahen-quality-unmatched-count')).toHaveText('0');
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('边界可用于生成');
        await saveScreenshot(page, BLANK_BOUNDARY_FIVE_REGION_BRUSH_DRAWN_SCREENSHOT);

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        for (const regionId of COMPLETE_REGION_IDS) {
            await expect(page.getByTestId(`qidahen-region-generation-result-${regionId}`)).toContainText('已生成');
            await expect(page.getByTestId(`qidahen-quality-region-${regionId}`)).toContainText('已生成');
        }
        await expect(page.getByTestId('qidahen-quality-mask-ui-pixels')).toHaveText('0');
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('生成链路已跑通');
        await page.getByRole('button', { name: '路径', exact: true }).click();
        await expect(page.getByTestId('qidahen-passage-summary')).toContainText('中心 5 / 通路 0');
        await saveScreenshot(page, BLANK_BOUNDARY_FIVE_REGION_BRUSH_GENERATED_SCREENSHOT);

        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-mask.png'))).toBeGreaterThan(1000);
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBeGreaterThan(500);
        const savedGraph = readSavedRegionGraph(workspaceName);
        expect(savedGraph.nodes ?? []).toHaveLength(COMPLETE_REGION_IDS.length);
        for (const regionId of COMPLETE_REGION_IDS) {
            const savedNode = savedGraph.nodes?.find((node) => node.id === regionId);
            expect(savedNode, `${regionId} node should be saved after brush generation`).toBeTruthy();
            expect(savedNode?.center, `${regionId} center should come from generated region`).toBeTruthy();
            expect(savedNode?.pixelCount ?? 0, `${regionId} generated area should not be empty`).toBeGreaterThan(1000);
        }

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/已自动读取 .*blank-boundary-five-region-brush-drawn/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('生成链路已跑通');
        await expect(page.getByTestId('qidahen-passage-summary')).toContainText('中心 5 / 通路 0');
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('从空白边界工作区导入手绘五区边界后可生成 5/5 并保存回读', async ({ page }) => {
        const workspaceName = 'blank-boundary-five-region-hand-drawn';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(540000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const boundaryMaskPath = await createTransparentBoundaryMaskPng([...COMPLETE_REGION_IDS]);
        await page.getByTestId('qidahen-import-boundary-draft').click();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(boundaryMaskPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 500);
        await waitForFinalBarrierPixels(page, 500);

        await expect.poll(async () => {
            const match = /手工补边：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : 0;
        }).toBe(0);
        for (const regionId of COMPLETE_REGION_IDS) {
            await expect(page.getByTestId(`qidahen-region-card-seed-status-${regionId}`)).toContainText('独立');
        }
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('边界可用于生成');
        await expect(page.getByTestId('qidahen-quality-unmatched-count')).toHaveText('0');
        await expect(page.getByTestId('qidahen-quality-open-count')).toHaveText('0');
        await saveScreenshot(page, BLANK_BOUNDARY_FIVE_REGION_DRAWN_SCREENSHOT);

        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到|空白手绘边界已直接固化为边界图/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBeGreaterThan(500);
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-add.png'))).toBe(0);
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-remove.png'))).toBe(0);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/已自动读取 .*blank-boundary-five-region-hand-drawn/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 500);
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('边界可用于生成');
        await expect(page.getByTestId('qidahen-quality-unmatched-count')).toHaveText('0');
        await expect(page.getByTestId('qidahen-quality-open-count')).toHaveText('0');

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        for (const regionId of COMPLETE_REGION_IDS) {
            await expect(page.getByTestId(`qidahen-region-generation-result-${regionId}`)).toContainText('已生成');
            await expect(page.getByTestId(`qidahen-quality-region-${regionId}`)).toContainText('已生成');
        }
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('生成链路已跑通');
        await expect(page.getByTestId('qidahen-boundary-normality-label')).toContainText('正常成果未证明');
        await expect(page.getByTestId('qidahen-boundary-normality-state')).toHaveText('suspicious');
        await expect(page.getByTestId('qidahen-boundary-normality-detail')).toContainText('generated-ready 只代表链路跑通');
        await expect(page.getByTestId('qidahen-boundary-normality-report')).toContainText('底图贴合');
        await expect(page.getByTestId('qidahen-boundary-normality-report')).toContainText('直线形态');
        await page.getByTestId('qidahen-boundary-normality-report').scrollIntoViewIfNeeded();
        await switchToPureBoundaryView(page);
        await saveScreenshot(page, BLANK_BOUNDARY_FIVE_REGION_GENERATED_SCREENSHOT);

        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-mask.png'))).toBeGreaterThan(1000);
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBeGreaterThan(500);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/已自动读取 .*blank-boundary-five-region-hand-drawn/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('生成链路已跑通');
        await expect(page.getByTestId('qidahen-boundary-normality-state')).toHaveText('suspicious');
        await expect(page.getByTestId('qidahen-quality-unmatched-count')).toHaveText('0');
        await expect(page.getByTestId('qidahen-quality-open-count')).toHaveText('0');

        const qualityDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-quality-report').click();
        const qualityDownload = await qualityDownloadPromise;
        const qualityPath = await qualityDownload.path();
        expect(qualityPath).not.toBeNull();
        const qualityReport = JSON.parse(readFileSync(qualityPath!, 'utf8')) as {
            quality: {
                state: string;
                generatedCount: number;
                formalRegionCount: number;
                normality: {
                    state: string;
                    blockers: string[];
                    regionCoverages: Array<{ id: string; label: string; coverageRatio: number | null }>;
                };
                regions: Array<{ id: string; label: string }>;
            };
            closure: { matchedSeedCount: number };
        };
        expect(qualityReport.quality.state).toBe('generated-ready');
        expect(qualityReport.quality.normality.state).toBe('suspicious');
        expect(qualityReport.quality.normality.blockers.length).toBeGreaterThan(0);
        expect(qualityReport.quality.normality.regionCoverages).toHaveLength(COMPLETE_REGION_IDS.length);
        expect(qualityReport.quality.generatedCount).toBe(5);
        expect(qualityReport.quality.formalRegionCount).toBe(5);
        expect(qualityReport.closure.matchedSeedCount).toBe(5);
        for (const regionId of COMPLETE_REGION_IDS) {
            expect(qualityReport.quality.regions.find((region) => region.id === regionId)?.label).toBe('已生成');
        }
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('真实地图固定色匹配可一次显示整图边界红线', async ({ page }) => {
        const workspaceName = 'real-map-color-matched-boundary';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const boundaryMaskPath = await createRealMapColorMatchedBoundaryMaskPng();
        await page.getByTestId('qidahen-import-boundary-draft').click();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(boundaryMaskPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 5000);
        await waitForFinalBarrierPixels(page, 5000);
        await switchToPureBoundaryView(page);
        await saveScreenshot(page, REAL_MAP_COLOR_MATCHED_BOUNDARY_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('初始化按钮直接生成整图红线边界且不显示 seed 圆圈', async ({ page }) => {
        const workspaceName = 'real-map-initialize-red-boundary-lines';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-initialize-red-boundary-lines')).toBeVisible();
        await expect(page.getByTestId('qidahen-boundary-trace-assets-details')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-boundary-secondary-region-workflow')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-boundary-diagnostics-details')).toHaveCount(0);
        await page.getByTestId('qidahen-initialize-red-boundary-lines').click();
        await expect(page.getByText(/已初始化整图红色边界/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 1800);
        await waitForFinalBarrierPixels(page, 1800);
        await expect(page.getByTestId('qidahen-primary-generate-regions-from-boundary')).toBeVisible();
        await expect(page.getByTestId('qidahen-primary-save-workspace')).toBeVisible();

        await expect(page.getByTestId('qidahen-seed-status-overlay')).toHaveCount(0);
        const bounds = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(bounds.opaquePixels).toBeGreaterThan(1800);
        expect(bounds.bounds).not.toBeNull();
        expect(bounds.bounds!.right - bounds.bounds!.left).toBeGreaterThan(850);
        expect(bounds.bounds!.bottom - bounds.bounds!.top).toBeGreaterThan(520);
        await page.getByTestId('qidahen-primary-save-workspace').click();
        await expect(page.getByText(/已保存工作区/u)).toBeVisible({ timeout: 30000 });
        await saveScreenshot(page, REAL_MAP_INITIALIZED_RED_BOUNDARY_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('重置当前工作区会清空旧红线并防止刷新回读', async ({ page }) => {
        const workspaceName = 'real-map-reset-red-boundary-lines';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-reset-boundary-workspace')).toBeVisible();
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID)).opaquePixels).toBe(0);

        await page.getByTestId('qidahen-initialize-red-boundary-lines').click();
        await expect(page.getByText(/已初始化整图红色边界/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 1200);
        await waitForFinalBarrierPixels(page, 1200);
        const initializedUiPixels = (await Promise.all(
            REAL_MAP_FORBIDDEN_UI_RECTS.map((rect) => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect)),
        )).reduce((sum, value) => sum + value, 0);
        expect(initializedUiPixels).toBeLessThanOrEqual(80);

        await page.getByTestId('qidahen-primary-save-workspace').click();
        await expect(page.getByText(/已保存工作区/u)).toBeVisible({ timeout: 30000 });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await waitForFinalBarrierPixels(page, 1200);

        await page.getByTestId('qidahen-reset-boundary-workspace').click();
        await expect(page.getByText(/已重置当前工作区/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID)).opaquePixels, { timeout: 30000 }).toBe(0);
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, 'qidahen-mask-canvas')).opaquePixels, { timeout: 30000 }).toBe(0);
        await expect(page.getByTestId('qidahen-seed-status-overlay')).toHaveCount(0);
        await saveScreenshot(page, REAL_MAP_RESET_CLEAN_SCREENSHOT);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID)).opaquePixels, { timeout: 30000 }).toBe(0);
        await expect(page.getByTestId('qidahen-seed-status-overlay')).toHaveCount(0);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('空白工作区手绘边界直接写入最终红线且不混入隐式扫描', async ({ page }) => {
        const workspaceName = 'manual-boundary-red-line-no-implicit-scan';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-reset-boundary-workspace').click();
        await expect(page.getByText(/已重置当前工作区/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID)).opaquePixels, { timeout: 30000 }).toBe(0);

        await page.getByTestId('qidahen-enter-boundary-brush').click();
        const canvasBox = await getRect(page.getByTestId('qidahen-mask-canvas'));
        await dragCanvasMapPolyline(page, canvasBox, [
            { x: 520, y: 455 },
            { x: 650, y: 500 },
        ]);
        await expect(page.getByText(/已绘制边界线/u)).toBeVisible({ timeout: 30000 });

        const colorStats = await getBarrierCanvasColorStats(page);
        expect(colorStats.opaque).toBeGreaterThan(400);
        expect(colorStats.opaque).toBeLessThan(3000);
        expect(colorStats.red).toBe(colorStats.opaque);
        expect(colorStats.cyan).toBe(0);
        expect(colorStats.green).toBe(0);
        await expect(page.getByTestId('qidahen-manual-barrier-add-count')).not.toContainText('0');
        await expect(page.locator('aside')).toContainText(/最终红线\/障碍/u);
        await saveScreenshot(page, MANUAL_RED_BOUNDARY_DRAW_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('手绘边界允许贴边绘制且不会被 UI 禁区过滤删掉', async ({ page }) => {
        const workspaceName = 'manual-boundary-edge-red-line';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-reset-boundary-workspace').click();
        await expect(page.getByText(/已重置当前工作区/u)).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-enter-boundary-brush').click();

        const canvasBox = await getRect(page.getByTestId('qidahen-mask-canvas'));
        const edgeStrokeRect = { left: 20, top: 430, right: 105, bottom: 500 };
        await dragCanvasMapPolyline(page, canvasBox, [
            { x: 36, y: 450 },
            { x: 96, y: 486 },
        ]);
        await expect(page.getByText(/已绘制边界线/u)).toBeVisible({ timeout: 30000 });

        const edgePixels = await countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, edgeStrokeRect);
        const colorStats = await getBarrierCanvasColorStats(page);
        expect(edgePixels).toBeGreaterThan(100);
        expect(colorStats.opaque).toBeGreaterThan(100);
        expect(colorStats.opaque).toBeLessThan(2500);
        expect(colorStats.red).toBe(colorStats.opaque);
        expect(colorStats.cyan).toBe(0);
        expect(colorStats.green).toBe(0);
        await saveScreenshot(page, MANUAL_EDGE_BOUNDARY_DRAW_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('闭合红线生成区域会填色并保留城市名到区域和连线数据', async ({ page }) => {
        const workspaceName = 'many-closed-boundary-city-name-save';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const boundaryMaskPath = await createManyClosedBoundaryMaskPng(12);
        await page.getByTestId('qidahen-import-boundary-draft').click();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(boundaryMaskPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await waitForFinalBarrierPixels(page, 1000);

        await page.getByTestId('qidahen-primary-generate-regions-from-boundary').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已按红线\/画布边缘生成/u, { timeout: 30000 });
        const generatedRegionCount = await page.locator('[data-testid^="qidahen-generated-region-row-"]').count();
        expect(generatedRegionCount).toBeGreaterThanOrEqual(10);
        await expect.poll(async () => page.locator('[data-testid^="qidahen-region-graph-node-"]').count()).toBe(generatedRegionCount);
        const maskCanvasStats = await getCanvasOpaqueBounds(page, 'qidahen-mask-canvas');
        expect(maskCanvasStats.opaquePixels).toBeGreaterThan(12000);
        const maskOpacity = await page.getByTestId('qidahen-mask-canvas').evaluate((canvas) => window.getComputedStyle(canvas).opacity);
        expect(Number(maskOpacity)).toBeGreaterThanOrEqual(0.5);
        await expect(page.getByTestId('qidahen-compact-passage-editor')).toContainText('通路与移动代价');
        await expect(page.getByTestId('qidahen-compact-passage-editor')).toContainText(/中心 \d+ \/ 自动连线 \d+/u);
        const autoPassageEdges = page.locator('[data-testid^="qidahen-passage-edge-"]');
        expect(await autoPassageEdges.count()).toBeGreaterThan(1);
        const compactPassageRows = page.locator('[data-testid^="qidahen-compact-passage-row-"]');
        await expect.poll(async () => compactPassageRows.count()).toBeGreaterThan(1);
        const firstBoundaryTypeSelect = page.locator('select[data-testid^="qidahen-passage-boundary-"]').first();
        await expect(firstBoundaryTypeSelect).toBeVisible();
        await firstBoundaryTypeSelect.selectOption('mountain');
        await expect(page.getByTestId('qidahen-compact-passage-editor')).toContainText('山脉 · 战场宽度 2');
        const secondBoundaryTypeSelect = page.locator('select[data-testid^="qidahen-passage-boundary-"]').nth(1);
        await expect(secondBoundaryTypeSelect).toBeVisible();
        await secondBoundaryTypeSelect.selectOption('river');
        await expect(page.getByTestId('qidahen-compact-passage-editor')).toContainText('河流 · 战场宽度 2');
        await saveScreenshot(page, CLOSED_BOUNDARY_ALL_PASSAGES_SCREENSHOT);

        const compactRegionNameInput = page.locator('input[data-testid^="qidahen-compact-region-name-"]').first();
        await expect(compactRegionNameInput).toBeVisible();
        await compactRegionNameInput.fill('测试城');
        await expect(compactRegionNameInput).toHaveValue('测试城');
        await expect(page.getByText('测试城').first()).toBeVisible();

        await page.getByTestId('qidahen-compact-toggle-region-fill').click();
        await expect(page.getByTestId('qidahen-compact-toggle-region-fill')).toContainText('显示涂色');
        await expect.poll(async () => page.getByTestId('qidahen-mask-canvas').evaluate((canvas) => window.getComputedStyle(canvas).opacity)).toBe('0');
        await page.getByTestId('qidahen-compact-toggle-region-fill').click();
        await expect(page.getByTestId('qidahen-compact-toggle-region-fill')).toContainText('隐藏涂色');
        await expect.poll(async () => page.getByTestId('qidahen-mask-canvas').evaluate((canvas) => Number(window.getComputedStyle(canvas).opacity))).toBeGreaterThan(0.5);

        await page.getByTestId('qidahen-primary-save-regions-only').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已单独保存区域/u, { timeout: 30000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-mask.png'))).toBeGreaterThan(12000);
        await expect.poll(async () => readSavedUniqueOpaqueColorCount(getWorkspaceFilePath(workspaceName, 'region-mask.png'))).toBe(generatedRegionCount);

        await page.getByTestId('qidahen-auto-detect-passages').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已按当前区域 mask 补全邻近通行路径/u, { timeout: 30000 });
        await page.getByTestId('qidahen-primary-save-graph-only').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已单独保存连线/u, { timeout: 30000 });
        const savedRegions = JSON.parse(readFileSync(getWorkspaceFilePath(workspaceName, 'region-mask-regions.json'), 'utf8')) as {
            regions?: Array<{ name?: string }>;
        };
        const savedGraph = readSavedRegionGraph(workspaceName);
        expect(savedRegions.regions).toHaveLength(generatedRegionCount);
        expect(savedRegions.regions?.some((region) => region.name === '测试城')).toBe(true);
        expect(savedGraph.nodes).toHaveLength(generatedRegionCount);
        expect(savedGraph.nodes?.some((node) => node.name === '测试城')).toBe(true);
        expect(savedGraph.edges?.length ?? 0).toBeGreaterThan(1);
        expect(savedGraph.edges?.some((edge) => edge.boundaryType === 'mountain' && edge.battleWidth === 2)).toBe(true);
        expect(savedGraph.edges?.some((edge) => edge.boundaryType === 'river' && edge.battleWidth === 2)).toBe(true);

        await saveScreenshot(page, CLOSED_BOUNDARY_REGION_CITY_NAME_SCREENSHOT);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => page.locator('[data-testid^="qidahen-generated-region-row-"]').count(), { timeout: 30000 }).toBe(generatedRegionCount);
        await expect.poll(async () => page.locator('[data-testid^="qidahen-region-graph-node-"]').count(), { timeout: 30000 }).toBe(generatedRegionCount);
        await expect(page.locator('[data-testid^="qidahen-generated-region-name-"]').first()).toHaveValue('测试城');
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('导入贴边红线生成区域不会被旧 UI 禁区裁掉', async ({ page }) => {
        const workspaceName = 'edge-ui-boundary-region-generation';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const boundaryMaskPath = await createUiEdgeClosedBoundaryMaskPng();
        await page.getByTestId('qidahen-import-boundary-draft').click();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(boundaryMaskPath);
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已导入边界图/u, { timeout: 30000 });
        await waitForFinalBarrierPixels(page, 100);

        const edgeRect = { left: 0, top: 392, right: 136, bottom: 555 };
        await expect.poll(async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, edgeRect), { timeout: 30000 }).toBeGreaterThan(100);
        await page.getByTestId('qidahen-primary-generate-regions-from-boundary').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已按红线\/画布边缘生成/u, { timeout: 30000 });
        expect(await page.locator('[data-testid^="qidahen-generated-region-row-"]').count()).toBeGreaterThanOrEqual(1);
        await expect.poll(async () => countCanvasOpaquePixelsInRect(page, 'qidahen-mask-canvas', edgeRect), { timeout: 30000 }).toBeGreaterThan(1000);

        await saveScreenshot(page, EDGE_UI_BOUNDARY_REGION_GENERATED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('从空白边界导入手绘五区后可继续补全通路并编辑移动代价', async ({ page }) => {
        const workspaceName = 'blank-boundary-five-region-path-edit';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(420000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const boundaryMaskPath = await createTransparentBoundaryMaskPng([...COMPLETE_REGION_IDS]);
        await page.getByTestId('qidahen-import-boundary-draft').click();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(boundaryMaskPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 500);
        await waitForFinalBarrierPixels(page, 500);
        await expect(page.getByText(/所有正式 seed 已进入独立分区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-primary-save-boundary-only')).toBeVisible();
        await expect(page.getByTestId('qidahen-primary-save-regions-only')).toBeVisible();
        await expect(page.getByTestId('qidahen-primary-save-graph-only')).toBeVisible();
        await page.getByTestId('qidahen-primary-save-boundary-only').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已单独保存边界/u, { timeout: 30000 });

        await page.getByTestId('qidahen-primary-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        const generatedColorCounts = await getMaskColorCounts(page);
        expect(generatedColorCounts.red).toBeGreaterThan(1000);
        expect(generatedColorCounts.yellow).toBeGreaterThan(1000);
        await page.getByTestId('qidahen-primary-save-regions-only').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已单独保存区域/u, { timeout: 30000 });

        await expect(page.getByTestId('qidahen-passage-summary')).toContainText('中心 5 / 通路 0');
        await page.getByTestId('qidahen-auto-detect-passages').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已按当前区域 mask 补全邻近通行路径/u, { timeout: 30000 });
        const passageRows = page.locator('[data-testid^="qidahen-passage-row-"]');
        await expect(page.getByTestId('qidahen-passage-summary')).toContainText('中心 5 / 通路');
        expect(await passageRows.count()).toBeGreaterThanOrEqual(4);
        const passageRow = page.getByTestId(`qidahen-passage-row-${EDITED_PASSAGE_ID}`);
        await expect(passageRow).toBeVisible();
        await passageRow.click();
        await expect(page.getByTestId(`qidahen-passage-boundary-${EDITED_PASSAGE_ID}`)).toHaveValue('plain');
        await page.getByTestId(`qidahen-passage-boundary-${EDITED_PASSAGE_ID}`).selectOption('mountain');
        await expect(page.getByTestId(`qidahen-passage-boundary-${EDITED_PASSAGE_ID}`)).toHaveValue('mountain');
        await expect(page.getByTestId(`qidahen-passage-note-${EDITED_PASSAGE_ID}`)).toContainText('当前边界/移动规则：山脉 · 战场宽度 2');
        await expect(page.getByTestId(`qidahen-passage-edge-${EDITED_PASSAGE_ID}`).getByText('山脉')).toBeVisible();
        await passageRow.scrollIntoViewIfNeeded();
        await saveScreenshot(page, BLANK_BOUNDARY_FIVE_REGION_PATH_EDIT_SCREENSHOT);

        await page.getByTestId('qidahen-primary-save-graph-only').click();
        await expect(page.getByTestId('qidahen-compact-status-message')).toContainText(/已单独保存连线/u, { timeout: 30000 });
        const savedGraph = readSavedRegionGraph(workspaceName);
        for (const regionId of COMPLETE_REGION_IDS) {
            const savedNode = savedGraph.nodes?.find((node) => node.id === regionId);
            expect(savedNode, `${regionId} node should be saved`).toBeTruthy();
            expect(savedNode?.pixelCount ?? 0, `${regionId} rough boundary draft should create an editable colored region`).toBeGreaterThanOrEqual(500);
            expect(savedNode?.pixelCount ?? 0, `${regionId} boundary-generated draft should avoid obvious overflow`).toBeLessThanOrEqual(32000);
        }
        const savedPassage = savedGraph.edges?.find((edge) => edge.id === EDITED_PASSAGE_ID);
        expect(savedPassage).toMatchObject({
            from: 'jinzhou',
            to: 'song-jin',
            boundaryType: 'mountain',
            boundaryLabel: '山脉',
            battleWidth: 2,
        });

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/已自动读取 .*blank-boundary-five-region-path-edit/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-workflow-panel')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('main')).toContainText('模式：通路编辑', { timeout: 30000 });
        await expect(page.getByTestId('qidahen-passage-summary')).toContainText('中心 5 / 通路');
        await page.getByTestId(`qidahen-passage-row-${EDITED_PASSAGE_ID}`).click();
        await expect(page.getByTestId(`qidahen-passage-boundary-${EDITED_PASSAGE_ID}`)).toHaveValue('mountain');
        await expect(page.getByTestId(`qidahen-passage-note-${EDITED_PASSAGE_ID}`)).toContainText('当前边界/移动规则：山脉 · 战场宽度 2');
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('全图描边包 ZIP 包含透明边界层、底图和边界颜色清单', async ({ page }) => {
        const workspaceName = 'boundary-trace-kit-export';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasPixel(page, BG_CANVAS_TEST_ID, 620, 420))[3]).toBeGreaterThan(0);
        await page.getByTestId('qidahen-boundary-diagnostics-details').locator('summary').click();
        await expect(page.getByTestId('qidahen-auto-extraction-verdict')).toContainText('最多 2/5 个独立 seed');
        await expect(page.getByTestId('qidahen-auto-extraction-verdict')).toContainText('不能自动生成正常成果');
        await saveTestIdScreenshot(page, 'qidahen-auto-extraction-verdict', AUTO_EXTRACTION_VERDICT_SCREENSHOT);

        const sharp = await getSharp();
        const traceKitDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-trace-kit').click();
        const traceKitDownload = await traceKitDownloadPromise;
        expect(traceKitDownload.suggestedFilename()).toBe('qidahen-boundary-trace-kit.zip');
        const traceKitPath = await traceKitDownload.path();
        expect(traceKitPath).not.toBeNull();
        const traceKitEntries = unzipSync(new Uint8Array(readFileSync(traceKitPath!)));
        expect(Object.keys(traceKitEntries).sort()).toEqual([
            'README.txt',
            'layers/current-boundary-transparent.png',
            'manifest.json',
            'qidahen-boundary-color-line-draft-transparent.png',
            'qidahen-boundary-empty-transparent.png',
            'qidahen-boundary-trace-template.png',
            'qidahen-main-map.png',
            'report.json',
        ]);
        const traceKitManifest = JSON.parse(new TextDecoder().decode(traceKitEntries['manifest.json'])) as {
            importTargets: { colorLineDraft?: string; repairPackageCurrentBoundary?: string };
            layers?: { currentBoundary?: string; mainMap?: string };
            colorLineDraft?: { path: string; repairPackagePath?: string; pixelCount: number; componentCount: number };
            autoExtractionVerdict?: { state: string; requiredSeedCount: number; bestObservedMatchedSeedCount: number };
            boundaryColors: Array<{ css: string; rgb: [number, number, number] }>;
            forbiddenUiRects: unknown[];
            regions: Array<{ id: string; seed: { x: number; y: number } | null }>;
        };
        const traceKitReadme = new TextDecoder().decode(traceKitEntries['README.txt']);
        expect(traceKitReadme).toContain('layers/repaired-boundary-transparent.png');
        expect(traceKitReadme).toContain('导入补边包 ZIP 的全图边界层');
        expect(traceKitReadme).toContain('固定边界色可以生成可手修的连续线起稿');
        expect(traceKitReadme).toContain('不能自动生成正常成果');
        expect(traceKitReadme).toContain('无法连成线、无法封口的碎线直接舍弃');
        expect(traceKitManifest.importTargets.colorLineDraft).toBe('qidahen-boundary-color-line-draft-transparent.png');
        expect(traceKitManifest.importTargets.repairPackageCurrentBoundary).toBe('layers/current-boundary-transparent.png');
        expect(traceKitManifest.layers?.currentBoundary).toBe('layers/current-boundary-transparent.png');
        expect(traceKitManifest.layers?.mainMap).toBe('qidahen-main-map.png');
        expect(traceKitManifest.colorLineDraft?.path).toBe('qidahen-boundary-color-line-draft-transparent.png');
        expect(traceKitManifest.colorLineDraft?.repairPackagePath).toBe('layers/current-boundary-transparent.png');
        expect(traceKitManifest.colorLineDraft?.pixelCount).toBeGreaterThan(100);
        expect(traceKitManifest.colorLineDraft?.componentCount).toBeGreaterThan(0);
        expect(traceKitManifest.autoExtractionVerdict?.state).toBe('not-fit-for-auto-completion');
        expect(traceKitManifest.autoExtractionVerdict?.requiredSeedCount).toBe(5);
        expect(traceKitManifest.autoExtractionVerdict?.bestObservedMatchedSeedCount).toBeLessThan(5);
        const traceKitReport = JSON.parse(new TextDecoder().decode(traceKitEntries['report.json'])) as {
            layers?: { mainMap?: string; currentBoundary?: string; repairedBoundary?: string | null };
            colorLineDraft?: { path?: string; repairPackagePath?: string; pixelCount?: number };
            autoExtractionVerdict?: { state: string; requiredSeedCount: number; bestObservedMatchedSeedCount: number };
        };
        expect(traceKitReport.layers?.mainMap).toBe('qidahen-main-map.png');
        expect(traceKitReport.layers?.currentBoundary).toBe('layers/current-boundary-transparent.png');
        expect(traceKitReport.layers?.repairedBoundary).toBeNull();
        expect(traceKitReport.colorLineDraft?.repairPackagePath).toBe('layers/current-boundary-transparent.png');
        expect(traceKitReport.autoExtractionVerdict?.state).toBe('not-fit-for-auto-completion');
        expect(traceKitReport.autoExtractionVerdict?.bestObservedMatchedSeedCount).toBeLessThan(traceKitReport.autoExtractionVerdict?.requiredSeedCount ?? 0);
        expect(traceKitManifest.boundaryColors.map((color) => color.css)).toEqual([
            'rgb(61, 69, 66)',
            'rgb(126, 97, 56)',
            'rgb(128, 104, 62)',
            'rgb(43, 36, 34)',
        ]);
        expect(traceKitManifest.forbiddenUiRects.length).toBeGreaterThan(0);
        expect(traceKitManifest.regions).toHaveLength(5);
        expect(traceKitManifest.regions.every((region) => region.seed != null)).toBe(true);
        const blankBoundaryBuffer = Buffer.from(traceKitEntries['qidahen-boundary-empty-transparent.png']);
        const blankBoundaryMetadata = await sharp(blankBoundaryBuffer).metadata();
        expect(blankBoundaryMetadata.width).toBe(MASK_WIDTH);
        expect(blankBoundaryMetadata.height).toBe(MASK_HEIGHT);
        const blankBoundaryRaw = await sharp(blankBoundaryBuffer).ensureAlpha().raw().toBuffer();
        let opaquePixels = 0;
        for (let index = 3; index < blankBoundaryRaw.length; index += 4) {
            if (blankBoundaryRaw[index] !== 0) {
                opaquePixels += 1;
            }
        }
        expect(opaquePixels).toBe(0);
        const colorLineDraftBuffer = Buffer.from(traceKitEntries['qidahen-boundary-color-line-draft-transparent.png']);
        const repairCurrentBoundaryBuffer = Buffer.from(traceKitEntries['layers/current-boundary-transparent.png']);
        expect(Buffer.compare(repairCurrentBoundaryBuffer, colorLineDraftBuffer)).toBe(0);
        writeFileSync(TRACE_KIT_COLOR_LINE_DRAFT_SCREENSHOT, colorLineDraftBuffer);
        const colorLineDraftMetadata = await sharp(colorLineDraftBuffer).metadata();
        expect(colorLineDraftMetadata.width).toBe(MASK_WIDTH);
        expect(colorLineDraftMetadata.height).toBe(MASK_HEIGHT);
        const colorLineDraftRaw = await sharp(colorLineDraftBuffer).ensureAlpha().raw().toBuffer();
        let colorLineDraftOpaquePixels = 0;
        for (let index = 3; index < colorLineDraftRaw.length; index += 4) {
            if (colorLineDraftRaw[index] !== 0) {
                colorLineDraftOpaquePixels += 1;
            }
        }
        expect(colorLineDraftOpaquePixels).toBeGreaterThan(100);
        expect(colorLineDraftOpaquePixels).toBe(traceKitManifest.colorLineDraft?.pixelCount);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            expect(await countPngOpaquePixelsInRect(TRACE_KIT_COLOR_LINE_DRAFT_SCREENSHOT, rect)).toBe(0);
        }
        await expect(page.getByText(/已导出全图描边包 ZIP/u)).toBeVisible({ timeout: 30000 });
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('描边包标准边界层经补边包入口回导后仍不能直接生成正常成果', async ({ page }) => {
        const workspaceName = 'boundary-trace-kit-repair-package-import';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const traceKitDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-trace-kit').click();
        const traceKitDownload = await traceKitDownloadPromise;
        const traceKitPath = await traceKitDownload.path();
        expect(traceKitPath).not.toBeNull();
        const traceKitEntries = unzipSync(new Uint8Array(readFileSync(traceKitPath!)));
        expect(traceKitEntries['layers/current-boundary-transparent.png']).toBeTruthy();

        await page.getByTestId('qidahen-import-boundary-repair-package').click();
        await page.getByTestId('qidahen-boundary-repair-package-input').setInputFiles(traceKitPath!);
        await expect(page.getByText(/已从补边包回导 layers\/current-boundary-transparent\.png/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/未包含 layers\/repaired-boundary-transparent\.png/u)).toBeVisible();
        await expect(page.getByText(/只是回导 currentBoundary 初始\/旧边界层/u)).toBeVisible();
        await waitForBoundaryDraftPixels(page, 100);
        await waitForFinalBarrierPixels(page, 100);
        await expect(page.getByTestId('qidahen-closed-seed-hit-count')).toHaveText('0');
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should not contain imported trace-kit color line draft pixels` },
            ).toBe(0);
        }

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/默认生成已拒绝/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid^="qidahen-region-generation-result-"]').filter({ hasText: '已生成' })).toHaveCount(0);
        await expect((await getCanvasOpaqueBounds(page, 'qidahen-mask-canvas')).opaquePixels).toBe(0);
        await expect(page.getByTestId('qidahen-boundary-normality-state')).not.toHaveText('accepted');
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('描边包加入修好边界层后可优先回导 repairedBoundary 并进入生成门禁', async ({ page }) => {
        const workspaceName = 'boundary-trace-kit-repaired-layer-import';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const traceKitDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-trace-kit').click();
        const traceKitDownload = await traceKitDownloadPromise;
        const traceKitPath = await traceKitDownload.path();
        expect(traceKitPath).not.toBeNull();
        const traceKitEntries = unzipSync(new Uint8Array(readFileSync(traceKitPath!)));
        const repairedBoundaryPath = await createTransparentBoundaryMaskPng([...COMPLETE_REGION_IDS]);
        traceKitEntries['layers/repaired-boundary-transparent.png'] = new Uint8Array(readFileSync(repairedBoundaryPath));
        const traceKitReport = JSON.parse(new TextDecoder().decode(traceKitEntries['report.json'])) as {
            layers?: { repairedBoundary?: string | null };
        };
        traceKitReport.layers = {
            ...(traceKitReport.layers ?? {}),
            repairedBoundary: 'layers/repaired-boundary-transparent.png',
        };
        traceKitEntries['report.json'] = new TextEncoder().encode(JSON.stringify(traceKitReport, null, 2));
        const editedTraceKitPath = path.resolve(process.cwd(), 'temp/qidahen-boundary-trace-kit-repaired-layer.zip');
        writeFileSync(editedTraceKitPath, zipSync(traceKitEntries, { level: 9 }));

        await page.getByTestId('qidahen-import-boundary-repair-package').click();
        await page.getByTestId('qidahen-boundary-repair-package-input').setInputFiles(editedTraceKitPath);
        await expect(page.getByText(/已从补边包回导 layers\/repaired-boundary-transparent\.png/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 100);
        await waitForFinalBarrierPixels(page, 100);
        await expect.poll(
            async () => Number((await page.getByTestId('qidahen-closed-seed-hit-count').innerText()).replace(/,/gu, '')),
            { timeout: 30000 },
        ).toBe(5);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should not contain repaired trace-kit boundary pixels` },
            ).toBe(0);
        }

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid^="qidahen-region-generation-result-"]').filter({ hasText: '已生成' })).toHaveCount(5);
        await expect((await getCanvasOpaqueBounds(page, 'qidahen-mask-canvas')).opaquePixels).toBeGreaterThan(1000);
        await expect(page.getByTestId('qidahen-boundary-normality-state')).not.toHaveText('accepted');
        await page.getByTestId('qidahen-boundary-quality-report').scrollIntoViewIfNeeded();
        await saveScreenshot(page, TRACE_KIT_REPAIRED_IMPORT_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('导入完成边界图时自动舍弃未参与分区的开放碎线', async ({ page }) => {
        const workspaceName = 'completed-boundary-auto-prunes-open-noise';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const noisyBoundaryPath = await createTransparentBoundaryMaskPng([...COMPLETE_REGION_IDS], { includeOpenNoiseLine: true });
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(noisyBoundaryPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/已自动只保留有效分区边界/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/舍弃未参与分区\/封口的线/u)).toBeVisible();
        await expect.poll(async () => Number((await page.getByTestId('qidahen-closed-seed-hit-count').innerText()).replace(/,/gu, ''))).toBe(5);
        await expect(page.getByTestId('qidahen-unexplained-open-boundary-count')).toHaveText('0');
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('不能生成正常成果');
        await expect(page.getByTestId('qidahen-boundary-normality-blockers')).toContainText('不能当正常成果');

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid^="qidahen-region-generation-result-"]').filter({ hasText: '已生成' })).toHaveCount(5);
        await expect((await getCanvasOpaqueBounds(page, 'qidahen-mask-canvas')).opaquePixels).toBeGreaterThan(1000);
        await expect(page.getByTestId('qidahen-quality-mask-ui-pixels')).toHaveText('0');
        await expect(page.getByTestId('qidahen-boundary-normality-state')).not.toHaveText('accepted');
        await page.getByTestId('qidahen-boundary-quality-report').scrollIntoViewIfNeeded();
        await saveTestIdScreenshot(page, 'qidahen-boundary-quality-report', IMPORTED_BOUNDARY_AUTO_PRUNED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('可导出外部描边参考图并导入局部底稿', async ({ page }) => {
        const workspaceName = 'boundary-template-export';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(420000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasPixel(page, BG_CANVAS_TEST_ID, 620, 420))[3]).toBeGreaterThan(0);

        const sharp = await getSharp();
        await page.getByTestId('qidahen-boundary-trace-assets-details').locator('summary').click();
        const traceDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-trace-template').click();
        const traceDownload = await traceDownloadPromise;
        expect(traceDownload.suggestedFilename()).toBe('qidahen-boundary-trace-template.png');
        const tracePath = await traceDownload.path();
        expect(tracePath).not.toBeNull();
        const traceMetadata = await sharp(tracePath!).metadata();
        expect(traceMetadata.width).toBe(MASK_WIDTH);
        expect(traceMetadata.height).toBe(MASK_HEIGHT);
        await expect(page.getByText(/已导出描边参考图/u)).toBeVisible({ timeout: 30000 });

        await expect(page.getByTestId('qidahen-region-card-seed-status-jinzhou')).toContainText('待描');
        const regionDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-selected-region-trace-template').click();
        const regionDownload = await regionDownloadPromise;
        expect(regionDownload.suggestedFilename()).toBe('qidahen-region-trace-jinzhou.png');
        const regionPath = await regionDownload.path();
        expect(regionPath).not.toBeNull();
        const regionMetadata = await sharp(regionPath!).metadata();
        expect(regionMetadata.width).toBe(560);
        expect(regionMetadata.height).toBe(420);
        await expect(page.getByText(/已导出 锦州 局部描边底稿/u)).toBeVisible({ timeout: 30000 });

        const batchDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-all-region-trace-templates').click();
        const batchDownload = await batchDownloadPromise;
        expect(batchDownload.suggestedFilename()).toBe('qidahen-region-trace-templates.zip');
        const batchPath = await batchDownload.path();
        expect(batchPath).not.toBeNull();
        const batchEntries = unzipSync(new Uint8Array(readFileSync(batchPath!)));
        const batchPngNames = Object.keys(batchEntries).filter((name) => name.endsWith('.png')).sort();
        expect(batchPngNames).toEqual([
            'qidahen-region-trace-jinzhou.png',
            'qidahen-region-trace-shan-hai-guan.png',
            'qidahen-region-trace-shou-cheng.png',
            'qidahen-region-trace-song-jin.png',
            'qidahen-region-trace-xian-xing.png',
        ]);
        const batchManifest = JSON.parse(new TextDecoder().decode(batchEntries['manifest.json'])) as {
            exportedCount: number;
            skippedMissingSeed: unknown[];
            boundaryColors: Array<{ css: string; tolerance: number }>;
            rules: string[];
            importFilePrefixes: string[];
            regions: Array<{ id: string; fileName: string; seed: { x: number; y: number } }>;
        };
        expect(batchManifest.exportedCount).toBe(5);
        expect(batchManifest.skippedMissingSeed).toHaveLength(0);
        expect(batchManifest.boundaryColors.map((color) => color.css)).toEqual([
            'rgb(61, 69, 66)',
            'rgb(126, 97, 56)',
            'rgb(128, 104, 62)',
            'rgb(43, 36, 34)',
        ]);
        expect(new Set(batchManifest.importFilePrefixes)).toEqual(new Set([
            'qidahen-region-trace-',
            'qidahen-local-region-boundary-',
        ]));
        expect(batchManifest.rules.join('\n')).toContain('不要直线硬封口');
        expect(batchManifest.rules.join('\n')).toContain('不能连成线或不能封口的线直接舍弃');
        expect(batchManifest.regions.map((region) => region.id).sort()).toEqual([
            'jinzhou',
            'shan-hai-guan',
            'shou-cheng',
            'song-jin',
            'xian-xing',
        ]);
        const batchReadme = new TextDecoder().decode(batchEntries['README.txt']);
        expect(batchReadme).toContain('只使用 manifest.boundaryColors');
        expect(batchReadme).toContain('不要用直线硬封口');
        expect(batchReadme).toContain('无法连成线或无法封口时直接留空/舍弃');
        const batchJinzhouMetadata = await sharp(Buffer.from(batchEntries['qidahen-region-trace-jinzhou.png'])).metadata();
        expect(batchJinzhouMetadata.width).toBe(560);
        expect(batchJinzhouMetadata.height).toBe(420);
        await expect(page.getByText(/已批量导出 5 个局部描边底稿 ZIP/u)).toBeVisible({ timeout: 30000 });
        await saveTestIdScreenshot(page, 'qidahen-boundary-quality-report', TRACE_BATCH_EXPORT_SCREENSHOT);

        const manifestMappedJinzhouZipPath = await createManifestMappedLocalRegionBoundaryZip(['jinzhou']);
        await page.getByTestId('qidahen-import-region-trace-zip').click();
        await page.getByTestId('qidahen-region-trace-zip-input').setInputFiles(manifestMappedJinzhouZipPath);
        await expect(page.getByText(/已导入局部描边 ZIP：1 个区域/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/并打开补边裁图/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-repair-preview')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-repair-preview-title')).toContainText('宋进 未独立 seed');
        await expect(page.getByTestId('qidahen-boundary-repair-preview-detail')).toContainText('连不上的线直接舍弃');
        await expect(page.getByTestId('qidahen-boundary-repair-preview-detail')).toContainText('当前仍与');
        await expect(page.getByTestId('qidahen-boundary-repair-preview-detail')).toContainText('橙色泄漏路径');
        await saveTestIdScreenshot(page, 'qidahen-boundary-repair-preview', TRACE_BATCH_AUTO_REPAIR_PREVIEW_SCREENSHOT);
        await waitForBoundaryDraftPixels(page, 100);
        await expect(page.getByTestId('qidahen-region-card-seed-status-jinzhou')).toContainText('独立');
        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/默认生成已拒绝/u)).toBeVisible({ timeout: 30000 });
        await expect(page.locator('aside')).toContainText('独立 seed 1/5');
        await page.getByTestId('qidahen-debug-generate-regions-from-boundary').click({ force: true });
        await expect(page.getByText(/已调试生成当前独立分区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('已生成');
        const localImportCounts = await getMaskColorCounts(page);
        expect(localImportCounts.red).toBeGreaterThan(1000);

        const batchImportZipPath = await createTransparentLocalRegionBoundaryZip(['song-jin', 'shan-hai-guan']);
        await page.getByTestId('qidahen-import-region-trace-zip').click();
        await page.getByTestId('qidahen-region-trace-zip-input').setInputFiles(batchImportZipPath);
        await expect(page.getByText(/已导入局部描边 ZIP：2 个区域/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => Number((await page.getByTestId('qidahen-closed-seed-hit-count').innerText()).replace(/,/gu, ''))).toBe(3);
        await page.getByTestId('qidahen-debug-generate-regions-from-boundary').click();
        await expect(page.getByText(/已调试生成当前独立分区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-generation-result-song-jin')).toContainText('已生成');
        await expect(page.getByTestId('qidahen-region-generation-result-shan-hai-guan')).toContainText('已生成');
        await saveTestIdScreenshot(page, 'qidahen-boundary-quality-report', TRACE_BATCH_IMPORT_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('完整五区局部描边 ZIP 导入后可生成 5/5 并导出真实底图验收包', async ({ page }) => {
        const workspaceName = 'boundary-complete-five-region-import';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(300000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasPixel(page, BG_CANVAS_TEST_ID, 620, 420))[3]).toBeGreaterThan(0);

        const sharp = await getSharp();
        const completeZipPath = await createTransparentLocalRegionBoundaryZip([
            'jinzhou',
            'song-jin',
            'shan-hai-guan',
            'xian-xing',
            'shou-cheng',
        ]);
        await page.getByTestId('qidahen-import-region-trace-zip').click();
        await page.getByTestId('qidahen-region-trace-zip-input').setInputFiles(completeZipPath);
        await expect(page.getByText(/已导入局部描边 ZIP：5 个区域/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-card-seed-status-jinzhou')).toContainText('独立');
        await expect(page.getByTestId('qidahen-region-card-seed-status-song-jin')).toContainText('独立');
        await expect(page.getByTestId('qidahen-region-card-seed-status-shan-hai-guan')).toContainText('独立');
        await expect(page.getByTestId('qidahen-region-card-seed-status-xian-xing')).toContainText('独立');
        await expect(page.getByTestId('qidahen-region-card-seed-status-shou-cheng')).toContainText('独立');
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('边界可用于生成');
        await expect(page.getByTestId('qidahen-quality-unmatched-count')).toHaveText('0');
        await expect(page.getByTestId('qidahen-quality-open-count')).toHaveText('0');

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        for (const regionId of ['jinzhou', 'song-jin', 'shan-hai-guan', 'xian-xing', 'shou-cheng']) {
            await expect(page.getByTestId(`qidahen-region-generation-result-${regionId}`)).toContainText('已生成');
            await expect(page.getByTestId(`qidahen-quality-region-${regionId}`)).toContainText('已生成');
        }
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('生成链路已跑通');
        await expect(page.getByTestId('qidahen-boundary-normality-label')).toContainText('正常成果未证明');
        await expect(page.getByTestId('qidahen-boundary-normality-state')).toHaveText('suspicious');
        await expect(page.getByTestId('qidahen-boundary-normality-detail')).toContainText('generated-ready 只代表链路跑通');

        const qualityDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-quality-report').click();
        const qualityDownload = await qualityDownloadPromise;
        expect(qualityDownload.suggestedFilename()).toBe('qidahen-region-boundary-quality-report.json');
        const qualityPath = await qualityDownload.path();
        expect(qualityPath).not.toBeNull();
        const qualityReport = JSON.parse(readFileSync(qualityPath!, 'utf8')) as {
            quality: {
                state: string;
                generatedCount: number;
                formalRegionCount: number;
                normality: {
                    state: string;
                    blockers: string[];
                    regionCoverages: Array<{ id: string; label: string; coverageRatio: number | null }>;
                };
                regions: Array<{ id: string; label: string }>;
            };
            closure: { matchedSeedCount: number };
            lastGenerationResults: Array<{ regionId: string; status: string }>;
        };
        expect(qualityReport.quality.state).toBe('generated-ready');
        expect(qualityReport.quality.normality.state).toBe('suspicious');
        expect(qualityReport.quality.normality.blockers.length).toBeGreaterThan(0);
        expect(qualityReport.quality.normality.regionCoverages.some((region) => region.label === '疑似小圈')).toBe(true);
        expect(qualityReport.quality.generatedCount).toBe(5);
        expect(qualityReport.quality.formalRegionCount).toBe(5);
        expect(qualityReport.closure.matchedSeedCount).toBe(5);
        expect(qualityReport.lastGenerationResults.filter((result) => result.status === 'generated')).toHaveLength(5);
        for (const regionId of ['jinzhou', 'song-jin', 'shan-hai-guan', 'xian-xing', 'shou-cheng']) {
            expect(qualityReport.quality.regions.find((region) => region.id === regionId)?.label).toBe('已生成');
        }

        const acceptanceDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-region-acceptance-package').click();
        const acceptanceDownload = await acceptanceDownloadPromise;
        expect(acceptanceDownload.suggestedFilename()).toBe('qidahen-region-acceptance-package.zip');
        const acceptancePath = await acceptanceDownload.path();
        expect(acceptancePath).not.toBeNull();
        const acceptanceEntries = unzipSync(new Uint8Array(readFileSync(acceptancePath!)));
        mkdirSync(path.dirname(COMPLETE_ACCEPTANCE_OVERVIEW_SCREENSHOT), { recursive: true });
        writeFileSync(COMPLETE_ACCEPTANCE_OVERVIEW_SCREENSHOT, acceptanceEntries['overview.png']);
        writeFileSync(COMPLETE_ACCEPTANCE_SHOU_CHENG_SCREENSHOT, acceptanceEntries['regions/shou-cheng.png']);
        const completeOverviewMetadata = await sharp(Buffer.from(acceptanceEntries['overview.png'])).metadata();
        expect(completeOverviewMetadata.width).toBe(MASK_WIDTH);
        expect(completeOverviewMetadata.height).toBe(MASK_HEIGHT);
        const completeShouChengMetadata = await sharp(Buffer.from(acceptanceEntries['regions/shou-cheng.png'])).metadata();
        expect(completeShouChengMetadata.width).toBeGreaterThan(40);
        expect(completeShouChengMetadata.height).toBeGreaterThan(40);
        const acceptanceReport = JSON.parse(new TextDecoder().decode(acceptanceEntries['report.json'])) as {
            acceptancePackage: { regions: Array<{ id: string; pixelCount: number }> };
            quality: { state: string; generatedCount: number; formalRegionCount: number; normality: { state: string } };
        };
        expect(acceptanceReport.quality.state).toBe('generated-ready');
        expect(acceptanceReport.quality.normality.state).toBe('suspicious');
        expect(acceptanceReport.quality.generatedCount).toBe(5);
        expect(acceptanceReport.quality.formalRegionCount).toBe(5);
        expect(acceptanceReport.acceptancePackage.regions).toHaveLength(5);
        for (const regionId of ['jinzhou', 'song-jin', 'shan-hai-guan', 'xian-xing', 'shou-cheng']) {
            expect(acceptanceReport.acceptancePackage.regions.find((region) => region.id === regionId)?.pixelCount).toBeGreaterThan(100);
        }
        await expect(page.getByText(/已导出区域验收包 ZIP/u)).toBeVisible({ timeout: 30000 });

        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-mask.png'))).toBeGreaterThan(1000);
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBeGreaterThan(1000);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/已自动读取 .*boundary-complete-five-region-import/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('生成链路已跑通');
        await expect(page.getByTestId('qidahen-boundary-normality-state')).toHaveText('suspicious');
        await expect(page.getByTestId('qidahen-quality-unmatched-count')).toHaveText('0');
        await expect(page.getByTestId('qidahen-quality-open-count')).toHaveText('0');
        for (const regionId of ['jinzhou', 'song-jin', 'shan-hai-guan', 'xian-xing', 'shou-cheng']) {
            await expect(page.getByTestId(`qidahen-quality-region-${regionId}`)).toContainText('已生成');
        }

        const reloadedQualityDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-quality-report').click();
        const reloadedQualityDownload = await reloadedQualityDownloadPromise;
        const reloadedQualityPath = await reloadedQualityDownload.path();
        expect(reloadedQualityPath).not.toBeNull();
        const reloadedQualityReport = JSON.parse(readFileSync(reloadedQualityPath!, 'utf8')) as {
            quality: {
                state: string;
                generatedCount: number;
                formalRegionCount: number;
                normality: { state: string };
                regions: Array<{ id: string; label: string }>;
            };
        };
        expect(reloadedQualityReport.quality.state).toBe('generated-ready');
        expect(reloadedQualityReport.quality.normality.state).toBe('suspicious');
        expect(reloadedQualityReport.quality.generatedCount).toBe(5);
        expect(reloadedQualityReport.quality.formalRegionCount).toBe(5);
        for (const regionId of ['jinzhou', 'song-jin', 'shan-hai-guan', 'xian-xing', 'shou-cheng']) {
            expect(reloadedQualityReport.quality.regions.find((region) => region.id === regionId)?.label).toBe('已生成');
        }
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('连接到地图边缘的边界线按全图分区生成而不是只取小圈', async ({ page }) => {
        const workspaceName = 'edge-partition-region-generation';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(480000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const partitionBoundaryPath = await createEdgePartitionBoundaryMaskPng();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(partitionBoundaryPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-toggle-forbidden-ui-overlay')).toContainText('显示禁区');
        await expect(page.getByTestId('qidahen-forbidden-ui-overlay')).toHaveCount(0);
        await page.getByTestId('qidahen-keep-closed-boundary-only').click();
        await expect(page.getByText(/已只保留有效分区边界/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-toggle-forbidden-ui-overlay')).toContainText('显示禁区');
        await expect(page.getByTestId('qidahen-forbidden-ui-overlay')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('边界还没分区完');
        await expect(page.getByTestId('qidahen-open-boundary-count')).toHaveText('1');
        await expect(page.getByTestId('qidahen-unexplained-open-boundary-count')).toHaveText('0');

        await expect.poll(async () => (await getCanvasOpaqueBounds(page, 'qidahen-partition-preview-canvas')).opaquePixels, {
            timeout: 30000,
        }).toBeGreaterThan(20000);
        const previewBounds = await getCanvasOpaqueBounds(page, 'qidahen-partition-preview-canvas');
        expect(previewBounds.bounds?.left).toBeLessThanOrEqual(1010);
        expect(previewBounds.bounds?.right).toBeGreaterThanOrEqual(1110);
        expect((previewBounds.bounds!.right - previewBounds.bounds!.left) + 1).toBeGreaterThan(100);
        expect(previewBounds.bounds?.bottom).toBeGreaterThanOrEqual(710);
        expect((await getCanvasOpaqueBounds(page, 'qidahen-mask-canvas')).opaquePixels).toBe(0);

        const previewDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-partition-preview').click();
        const previewDownload = await previewDownloadPromise;
        const previewPath = await previewDownload.path();
        expect(previewPath).not.toBeNull();
        expect(previewDownload.suggestedFilename()).toBe('qidahen-region-partition-preview.png');
        expect(await readPngDimensions(previewPath!)).toEqual({ width: MASK_WIDTH, height: MASK_HEIGHT });
        expect(await readSavedOpaquePixelCount(previewPath!)).toBeGreaterThan(900000);
        await expect(page.getByText(/已导出分区预览 PNG/u)).toBeVisible({ timeout: 30000 });

        const repairDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-repair-package').click();
        const repairDownload = await repairDownloadPromise;
        const repairPath = await repairDownload.path();
        expect(repairPath).not.toBeNull();
        expect(repairDownload.suggestedFilename()).toBe('qidahen-boundary-repair-package.zip');
        const repairEntries = unzipSync(new Uint8Array(readFileSync(repairPath!)));
        expect(Object.keys(repairEntries).sort()).toEqual([
            'README.txt',
            'layers/current-boundary-transparent.png',
            'manifest.json',
            'overview.png',
            'problem-sources/unmatched-jinzhou.png',
            'problem-sources/unmatched-shan-hai-guan.png',
            'problem-sources/unmatched-song-jin.png',
            'problems/unmatched-jinzhou.png',
            'problems/unmatched-shan-hai-guan.png',
            'problems/unmatched-song-jin.png',
            'qidahen-main-map.png',
            'repair-crops/unmatched-jinzhou-boundary-transparent.png',
            'repair-crops/unmatched-shan-hai-guan-boundary-transparent.png',
            'repair-crops/unmatched-song-jin-boundary-transparent.png',
            'report.json',
            'suggestions/unmatched-jinzhou-real-map-support-transparent.png',
        ]);
        const repairManifest = JSON.parse(new TextDecoder().decode(repairEntries['manifest.json'])) as {
            boundaryColors: Array<{ css: string }>;
            forbiddenUiRects: unknown[];
            layers: { repairedBoundaryTarget: string; currentBoundary: string | null };
            importTargets: { preferred: string; fallbackCurrentBoundary: string };
            rules: string[];
            problemFiles: Array<{
                type: string;
                fileName: string;
                sourceFileName: string;
                repairCropTarget: string;
                connectedRegionNames?: string[];
                leakTargetName?: string | null;
                leakTargetSeed?: { x: number; y: number } | null;
                leakDistancePixels?: number | null;
                leakPath?: Array<{ x: number; y: number }>;
                supportSuggestionFileName?: string | null;
                supportSuggestionPixelCount?: number | null;
                supportSuggestionCropPixelCount?: number | null;
                supportSuggestionComponentCount?: number | null;
            }>;
        };
        expect(repairManifest.boundaryColors.map((color) => color.css)).toEqual([
            'rgb(61, 69, 66)',
            'rgb(126, 97, 56)',
            'rgb(128, 104, 62)',
            'rgb(43, 36, 34)',
        ]);
        expect(repairManifest.forbiddenUiRects.length).toBeGreaterThan(0);
        expect(repairManifest.layers.currentBoundary).toBe('layers/current-boundary-transparent.png');
        expect(repairManifest.layers.repairedBoundaryTarget).toBe('layers/repaired-boundary-transparent.png');
        expect(repairManifest.importTargets.preferred).toBe('layers/repaired-boundary-transparent.png');
        expect(repairManifest.importTargets.fallbackCurrentBoundary).toBe('layers/current-boundary-transparent.png');
        expect(repairManifest.rules.join('\n')).toContain('无法连成线、无法封口的碎线直接舍弃');
        expect(repairManifest.rules.join('\n')).toContain('repair-crops/*.png');
        expect(repairManifest.rules.join('\n')).toContain('橙色虚线是当前未隔断的泄漏路径');
        expect(repairManifest.rules.join('\n')).toContain('真实底图支撑线建议');
        expect(repairManifest.problemFiles.filter((problem) => problem.type === 'unmatched-seed')).toHaveLength(3);
        expect(repairManifest.problemFiles.map((problem) => problem.repairCropTarget).sort()).toEqual([
            'repair-crops/unmatched-jinzhou-boundary-transparent.png',
            'repair-crops/unmatched-shan-hai-guan-boundary-transparent.png',
            'repair-crops/unmatched-song-jin-boundary-transparent.png',
        ]);
        expect(repairManifest.problemFiles.map((problem) => problem.sourceFileName).sort()).toEqual([
            'problem-sources/unmatched-jinzhou.png',
            'problem-sources/unmatched-shan-hai-guan.png',
            'problem-sources/unmatched-song-jin.png',
        ]);
        const manifestJinzhouProblem = repairManifest.problemFiles.find((problem) => problem.fileName === 'problems/unmatched-jinzhou.png');
        expect(manifestJinzhouProblem?.connectedRegionNames?.length).toBeGreaterThan(1);
        expect(manifestJinzhouProblem?.leakTargetName ?? null).not.toBeNull();
        expect(manifestJinzhouProblem?.leakTargetSeed).toEqual(expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
        }));
        expect(manifestJinzhouProblem?.leakDistancePixels ?? 0).toBeGreaterThan(0);
        expect(manifestJinzhouProblem?.leakPath?.length ?? 0).toBeGreaterThan(1);
        expect(manifestJinzhouProblem?.supportSuggestionFileName).toBe('suggestions/unmatched-jinzhou-real-map-support-transparent.png');
        expect(manifestJinzhouProblem?.supportSuggestionPixelCount ?? 0).toBeGreaterThan(0);
        expect(manifestJinzhouProblem?.supportSuggestionCropPixelCount ?? 0).toBeGreaterThan(0);
        expect(manifestJinzhouProblem?.supportSuggestionComponentCount ?? 0).toBeGreaterThan(0);
        const repairReadme = new TextDecoder().decode(repairEntries['README.txt']);
        expect(repairReadme).toContain('boundaryColors');
        expect(repairReadme).toContain('layers/repaired-boundary-transparent.png');
        expect(repairReadme).toContain('repair-crops/*.png');
        expect(repairReadme).toContain('problems/*.png');
        expect(repairReadme).toContain('橙色虚线是当前未隔断的泄漏路径');
        expect(repairReadme).toContain('真实底图支撑线建议');
        const repairReport = JSON.parse(new TextDecoder().decode(repairEntries['report.json'])) as {
            matchedSeedCount: number;
            requiredSeedCount: number;
            unmatchedCount: number;
            openComponentCount: number;
            unexplainedOpenComponentCount: number;
            problems: Array<{
                type: string;
                fileName: string;
                sourceFileName: string;
                repairCropTarget: string;
                connectedRegionNames?: string[];
                leakTargetName?: string | null;
                leakTargetSeed?: { x: number; y: number } | null;
                leakDistancePixels?: number | null;
                leakPath?: Array<{ x: number; y: number }>;
                supportSuggestionFileName?: string | null;
                supportSuggestionPixelCount?: number | null;
                supportSuggestionCropPixelCount?: number | null;
            }>;
        };
        expect(repairReport.matchedSeedCount).toBe(2);
        expect(repairReport.requiredSeedCount).toBe(5);
        expect(repairReport.unmatchedCount).toBe(3);
        expect(repairReport.openComponentCount).toBe(1);
        expect(repairReport.unexplainedOpenComponentCount).toBe(0);
        expect(repairReport.problems.filter((problem) => problem.type === 'unmatched-seed')).toHaveLength(3);
        expect(repairReport.problems.filter((problem) => problem.type === 'open-boundary')).toHaveLength(0);
        const reportJinzhouProblem = repairReport.problems.find((problem) => problem.fileName === 'problems/unmatched-jinzhou.png');
        expect(reportJinzhouProblem?.connectedRegionNames?.length).toBeGreaterThan(1);
        expect(reportJinzhouProblem?.leakTargetName ?? null).not.toBeNull();
        expect(reportJinzhouProblem?.leakDistancePixels ?? 0).toBeGreaterThan(0);
        expect(reportJinzhouProblem?.leakPath?.length ?? 0).toBeGreaterThan(1);
        expect(reportJinzhouProblem?.supportSuggestionFileName).toBe('suggestions/unmatched-jinzhou-real-map-support-transparent.png');
        expect(reportJinzhouProblem?.supportSuggestionPixelCount ?? 0).toBeGreaterThan(0);
        expect(reportJinzhouProblem?.supportSuggestionCropPixelCount ?? 0).toBeGreaterThan(0);
        const sharp = await getSharp();
        const repairBoundaryLayerMetadata = await sharp(Buffer.from(repairEntries['layers/current-boundary-transparent.png'])).metadata();
        expect(repairBoundaryLayerMetadata.width).toBe(MASK_WIDTH);
        expect(repairBoundaryLayerMetadata.height).toBe(MASK_HEIGHT);
        const repairOverviewMetadata = await sharp(Buffer.from(repairEntries['overview.png'])).metadata();
        expect(repairOverviewMetadata.width).toBe(MASK_WIDTH);
        expect(repairOverviewMetadata.height).toBe(MASK_HEIGHT);
        const unmatchedCropMetadata = await sharp(Buffer.from(repairEntries['problems/unmatched-jinzhou.png'])).metadata();
        expect(unmatchedCropMetadata.width).toBe(360);
        expect(unmatchedCropMetadata.height).toBe(260);
        const unmatchedSourceCropMetadata = await sharp(Buffer.from(repairEntries['problem-sources/unmatched-jinzhou.png'])).metadata();
        expect(unmatchedSourceCropMetadata.width).toBe(360);
        expect(unmatchedSourceCropMetadata.height).toBe(260);
        const unmatchedRepairCropMetadata = await sharp(Buffer.from(repairEntries['repair-crops/unmatched-jinzhou-boundary-transparent.png'])).metadata();
        expect(unmatchedRepairCropMetadata.width).toBe(360);
        expect(unmatchedRepairCropMetadata.height).toBe(260);
        const unmatchedSuggestionMetadata = await sharp(Buffer.from(repairEntries['suggestions/unmatched-jinzhou-real-map-support-transparent.png'])).metadata();
        expect(unmatchedSuggestionMetadata.width).toBe(360);
        expect(unmatchedSuggestionMetadata.height).toBe(260);
        writeFileSync(REPAIR_PACKAGE_UNMATCHED_SCREENSHOT, repairEntries['problems/unmatched-jinzhou.png']);
        await expect(page.getByText(/已导出补边问题包 ZIP/u)).toBeVisible({ timeout: 30000 });
        await saveScreenshot(page, PARTITION_PREVIEW_SCREENSHOT);

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/默认生成已拒绝/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/独立 seed 2\/5/u)).toBeVisible();
        expect((await getCanvasOpaqueBounds(page, 'qidahen-mask-canvas')).opaquePixels).toBe(0);

        await page.getByTestId('qidahen-debug-generate-regions-from-boundary').click();
        await expect(page.getByText(/已调试生成当前独立分区/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, 'qidahen-partition-preview-canvas')).opaquePixels, {
            timeout: 30000,
        }).toBe(0);
        await expect(page.getByTestId('qidahen-region-generation-result-xian-xing')).toContainText('已生成');
        await expect(page.getByTestId('qidahen-region-generation-result-shou-cheng')).toContainText('已生成');
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('没有把');
        await expect(page.getByTestId('qidahen-region-generation-result-song-jin')).toContainText('没有把');
        await expect(page.getByTestId('qidahen-region-generation-result-shan-hai-guan')).toContainText('没有把');

        const qualityDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-quality-report').click();
        const qualityDownload = await qualityDownloadPromise;
        const qualityPath = await qualityDownload.path();
        expect(qualityPath).not.toBeNull();
        const qualityReport = JSON.parse(readFileSync(qualityPath!, 'utf8')) as {
            quality: {
                generatedCount: number;
                normality: {
                    state: string;
                    regionCoverages: Array<{ id: string; pixelCount: number; label: string }>;
                };
            };
        };
        expect(qualityReport.quality.generatedCount).toBe(2);
        const xianXing = qualityReport.quality.normality.regionCoverages.find((region) => region.id === 'xian-xing');
        const shouCheng = qualityReport.quality.normality.regionCoverages.find((region) => region.id === 'shou-cheng');
        expect(xianXing?.pixelCount).toBeGreaterThan(8000);
        expect(shouCheng?.pixelCount).toBeGreaterThan(15000);
        expect(qualityReport.quality.normality.state).not.toBe('accepted');

        await saveScreenshot(page, PARTITION_GENERATED_SCREENSHOT);

        const beforeUiRepairCropImportStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        const uiRepairCropSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="360" height="260" viewBox="0 0 360 260">
                <path d="M 28 228 L 332 228" fill="none" stroke="white" stroke-width="14" stroke-linecap="round" />
            </svg>
        `;
        const blankUiRepairCrop = await sharp({
            create: {
                width: 360,
                height: 260,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        }).png().toBuffer();
        const uiRepairCrop = await sharp(Buffer.from(blankUiRepairCrop))
            .composite([{ input: Buffer.from(uiRepairCropSvg) }])
            .png()
            .toBuffer();
        const uiRepairCropZipPath = path.resolve(process.cwd(), 'temp/qidahen-ui-repair-crop-package.zip');
        writeFileSync(uiRepairCropZipPath, zipSync({
            'manifest.json': new TextEncoder().encode(JSON.stringify({
                problemFiles: [{
                    type: 'unmatched-seed',
                    id: 'song-jin',
                    name: '宋进 repair-crop UI 污染回归',
                    fileName: 'problems/unmatched-song-jin-ui-repair.png',
                    sourceFileName: 'problem-sources/unmatched-song-jin-ui-repair.png',
                    repairCropTarget: 'repair-crops/unmatched-song-jin-ui-repair-boundary-transparent.png',
                    crop: { left: 560, top: 633, width: 360, height: 260 },
                }],
            }, null, 2)),
            'layers/current-boundary-transparent.png': repairEntries['layers/current-boundary-transparent.png'],
            'repair-crops/unmatched-song-jin-ui-repair-boundary-transparent.png': new Uint8Array(uiRepairCrop),
        }, { level: 9 }));
        await page.getByTestId('qidahen-import-boundary-repair-package').click();
        await page.getByTestId('qidahen-boundary-repair-package-input').setInputFiles(uiRepairCropZipPath);
        await expect(page.getByText(/拒绝局部层 UI\/装饰新增像素 [\d,]+ px，未写入边界层/u)).toBeVisible({ timeout: 30000 });
        const afterUiRepairCropImportStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(afterUiRepairCropImportStats.opaquePixels).toBe(beforeUiRepairCropImportStats.opaquePixels);

        const songJinUnmatchedProblem = repairManifest.problemFiles.find((problem) => problem.fileName === 'problems/unmatched-song-jin.png');
        expect(songJinUnmatchedProblem).toBeTruthy();
        const songJinRepairStrokeSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="360" height="260" viewBox="0 0 360 260">
                <path d="M 94 142 C 122 118 162 116 192 138" fill="none" stroke="rgb(61,69,66)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        `;
        const editedSongJinProblemCrop = await sharp(Buffer.from(repairEntries[songJinUnmatchedProblem!.fileName]))
            .composite([{ input: Buffer.from(songJinRepairStrokeSvg) }])
            .png()
            .toBuffer();
        const editedUnmatchedRepairEntries: Record<string, Uint8Array> = { ...repairEntries };
        editedUnmatchedRepairEntries[songJinUnmatchedProblem!.fileName] = new Uint8Array(editedSongJinProblemCrop);
        const editedUnmatchedRepairZipPath = path.resolve(process.cwd(), 'temp/qidahen-edited-unmatched-boundary-repair-package.zip');
        writeFileSync(editedUnmatchedRepairZipPath, zipSync(editedUnmatchedRepairEntries, { level: 9 }));

        await page.getByTestId('qidahen-import-boundary-repair-package').click();
        await page.getByTestId('qidahen-boundary-repair-package-input').setInputFiles(editedUnmatchedRepairZipPath);
        await expect(page.getByText(/已从补边包回导 layers\/current-boundary-transparent\.png \+ 局部修复层 0 个 \+ 可见裁图画线 1 个/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/新增可见画线底图支撑 \d+\/\d+ px/u)).toBeVisible();
        await expect(page.getByText(/已自动定位第一个未独立 seed：宋进/u)).toBeVisible();
        await expect(page.getByTestId('qidahen-boundary-repair-preview-title')).toContainText('宋进 未独立 seed');
        await expect(page.getByTestId('qidahen-boundary-repair-preview-detail')).toContainText('当前仍与');
        await expect(page.getByTestId('qidahen-boundary-repair-preview-detail')).toContainText('橙色泄漏路径');
        await saveScreenshot(page, REPAIR_PACKAGE_IMPORT_FOCUS_SCREENSHOT);

        const beforeUiPaintImportStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        const uiProblemCropSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="360" height="260" viewBox="0 0 360 260">
                <path d="M 28 228 L 332 228" fill="none" stroke="rgb(61,69,66)" stroke-width="14" stroke-linecap="round" />
            </svg>
        `;
        const blankUiProblemSource = await sharp({
            create: {
                width: 360,
                height: 260,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        }).png().toBuffer();
        const uiProblemCrop = await sharp(Buffer.from(blankUiProblemSource))
            .composite([{ input: Buffer.from(uiProblemCropSvg) }])
            .png()
            .toBuffer();
        const uiPaintRepairZipPath = path.resolve(process.cwd(), 'temp/qidahen-ui-painted-problem-repair-package.zip');
        writeFileSync(uiPaintRepairZipPath, zipSync({
            'manifest.json': new TextEncoder().encode(JSON.stringify({
                problemFiles: [{
                    type: 'unmatched-seed',
                    id: 'song-jin',
                    name: '宋进 UI 污染回归',
                    fileName: 'problems/unmatched-song-jin-ui.png',
                    sourceFileName: 'problem-sources/unmatched-song-jin-ui.png',
                    repairCropTarget: 'repair-crops/unmatched-song-jin-ui-boundary-transparent.png',
                    crop: { left: 560, top: 633, width: 360, height: 260 },
                }],
            }, null, 2)),
            'problems/unmatched-song-jin-ui.png': new Uint8Array(uiProblemCrop),
            'problem-sources/unmatched-song-jin-ui.png': new Uint8Array(blankUiProblemSource),
        }, { level: 9 }));

        await page.getByTestId('qidahen-import-boundary-repair-package').click();
        await page.getByTestId('qidahen-boundary-repair-package-input').setInputFiles(uiPaintRepairZipPath);
        await expect(page.getByText(/新增可见画线 UI\/装饰禁区 [\d,]+ px 已拒绝，未写入边界层/u)).toBeVisible({ timeout: 30000 });
        const afterUiPaintImportStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(afterUiPaintImportStats.opaquePixels).toBe(beforeUiPaintImportStats.opaquePixels);

        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('正式工作区中疑似生成结果不能保存为正式成果', async ({ page }) => {
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto('/dev/qidahen-region-mask', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('aside')).toContainText('正式工作区');
        const completeZipPath = await createTransparentLocalRegionBoundaryZip([
            'jinzhou',
            'song-jin',
            'shan-hai-guan',
            'xian-xing',
            'shou-cheng',
        ]);
        await page.getByTestId('qidahen-import-region-trace-zip').click();
        await page.getByTestId('qidahen-region-trace-zip-input').setInputFiles(completeZipPath);
        await expect(page.getByText(/已导入局部描边 ZIP：5 个区域/u)).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('生成链路已跑通');
        await expect(page.getByTestId('qidahen-boundary-normality-state')).toHaveText('suspicious');
        await expect(page.getByTestId('qidahen-save-workspace')).toBeDisabled();
        await expect(page.getByTestId('qidahen-save-workspace')).toContainText('正式成果待验收');
        await expect(page.getByTestId('qidahen-formal-save-guard')).toContainText('不能保存 suspicious 的区域成果');
        await expect(page.getByTestId('qidahen-formal-save-guard')).toContainText('临时工作区仍可保存进度');
        await page.getByTestId('qidahen-formal-save-guard').scrollIntoViewIfNeeded();
        await saveScreenshot(page, FORMAL_SAVE_GUARD_SCREENSHOT);

        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('直线多边形面积粗检通过也不能人工验收成正常成果', async ({ page }) => {
        const workspaceName = 'large-review-fixture-rejected';
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        await createWorkspaceWithSeedOverrides(workspaceName, {
            'xian-xing': { x: 1076, y: 486 },
            'shou-cheng': { x: 1020, y: 632 },
        });
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const fixtureBoundaryPath = await createLargeReviewFixtureBoundaryMaskPng();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(fixtureBoundaryPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('边界可用于生成');

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByText(/已按当前边界生成初始区域/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-quality-label')).toContainText('生成链路已跑通');
        await expect(page.getByTestId('qidahen-boundary-normality-state')).toHaveText('suspicious');
        await expect(page.getByTestId('qidahen-boundary-real-map-fit')).toContainText('blocked');
        await expect(page.getByTestId('qidahen-boundary-shape-report')).toContainText('blocked');
        await expect(page.getByTestId('qidahen-boundary-normality-blockers')).toContainText('贴近真实底图长线候选');
        await expect(page.getByTestId('qidahen-boundary-normality-blockers')).toContainText('长直线段');
        await expect(page.getByTestId('qidahen-boundary-normality-approval-count')).toContainText('0/5');
        for (const regionId of COMPLETE_REGION_IDS) {
            await expect(page.getByTestId(`qidahen-normality-acceptance-${regionId}`)).toContainText('待验收');
            await expect(page.getByTestId(`qidahen-approve-normality-region-${regionId}`)).toBeDisabled();
        }
        await page.getByTestId('qidahen-boundary-normality-report').scrollIntoViewIfNeeded();
        await saveScreenshot(page, REAL_MAP_FIT_REJECTED_SCREENSHOT);

        const qualityDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-quality-report').click();
        const qualityDownload = await qualityDownloadPromise;
        const qualityPath = await qualityDownload.path();
        expect(qualityPath).not.toBeNull();
        const qualityReport = JSON.parse(readFileSync(qualityPath!, 'utf8')) as {
            quality: {
                state: string;
                normality: {
                    state: string;
                    approvedCount: number;
                    requiredApprovalCount: number;
                    realMapFit: { state: string; supportRatio: number; supportedBoundaryPixelCount: number };
                    shape: { state: string; straightSupportRatio: number; straightSupportedPixelCount: number };
                    regionCoverages: Array<{ id: string; acceptanceState: string; currentSignature: string }>;
                };
            };
        };
        expect(qualityReport.quality.state).toBe('generated-ready');
        expect(qualityReport.quality.normality.state).toBe('suspicious');
        expect(qualityReport.quality.normality.approvedCount).toBe(0);
        expect(qualityReport.quality.normality.requiredApprovalCount).toBe(5);
        expect(qualityReport.quality.normality.realMapFit.state).toBe('blocked');
        expect(qualityReport.quality.normality.realMapFit.supportRatio).toBeLessThan(0.18);
        expect(qualityReport.quality.normality.realMapFit.supportedBoundaryPixelCount).toBeGreaterThanOrEqual(0);
        expect(qualityReport.quality.normality.shape.state).toBe('blocked');
        expect(qualityReport.quality.normality.shape.straightSupportRatio).toBeGreaterThan(0.36);
        expect(qualityReport.quality.normality.shape.straightSupportedPixelCount).toBeGreaterThan(1000);
        expect(qualityReport.quality.normality.regionCoverages.every((region) => region.acceptanceState === 'pending')).toBe(true);
        expect(qualityReport.quality.normality.regionCoverages.every((region) => region.currentSignature.length > 0)).toBe(true);

        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到/u)).toBeVisible({ timeout: 30000 });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/已自动读取 .*large-review-fixture-rejected/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-boundary-normality-state')).toHaveText('suspicious');
        await expect(page.getByTestId('qidahen-boundary-real-map-fit')).toContainText('blocked');
        await expect(page.getByTestId('qidahen-boundary-shape-report')).toContainText('blocked');
        await expect(page.getByTestId('qidahen-boundary-normality-approval-count')).toContainText('0/5');

        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('真实地图颜色诊断只读显示且不会写入边界图', async ({ page }) => {
        const workspaceName = 'real-map-auto-extract';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-readonly-boundary-diagnostics-summary').click();
        await page.getByTestId('qidahen-generate-boundary-draft').click();
        await expect(page.getByText(/只读诊断完成/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/不会写入边界图/u)).toBeVisible();
        await expect.poll(async () => {
            const match = /抽色命中：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : 0;
        }).toBeGreaterThan(5000);
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBe(0);
        await expect(page.locator('aside')).toContainText('剔除后');
        await expect(page.locator('aside')).toContainText(/真实底图颜色撞色严重/u);

        const boundaryCanvasStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(boundaryCanvasStats.opaquePixels).toBe(0);
        expect(boundaryCanvasStats.bounds).toBeNull();

        await expect.poll(async () => (await getCanvasPixel(
            page,
            BARRIER_CANVAS_TEST_ID,
            REAL_MAP_FORBIDDEN_UI_POINTS.wheelCenter.x,
            REAL_MAP_FORBIDDEN_UI_POINTS.wheelCenter.y,
        ))[3]).toBe(0);
        await expect.poll(async () => (await getCanvasPixel(
            page,
            BARRIER_CANVAS_TEST_ID,
            REAL_MAP_FORBIDDEN_UI_POINTS.rightBoxCenter.x,
            REAL_MAP_FORBIDDEN_UI_POINTS.rightBoxCenter.y,
        ))[3]).toBe(0);
        await expect.poll(async () => (await getCanvasPixel(
            page,
            BARRIER_CANVAS_TEST_ID,
            REAL_MAP_FORBIDDEN_UI_POINTS.bottomRuleCenter.x,
            REAL_MAP_FORBIDDEN_UI_POINTS.bottomRuleCenter.y,
        ))[3]).toBe(0);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should not contain auto-extracted boundary pixels` },
            ).toBe(0);
        }

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.locator('[data-testid^="qidahen-region-generation-result-"]').filter({ hasText: '已生成' })).toHaveCount(0);
        await expect(page.locator('aside')).toContainText('已生成 0');
        await expect(page.locator('aside')).toContainText('未生成 5');
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('没有独立边界分区包含这个 seed');
        await expect(page.getByTestId('qidahen-region-generation-result-song-jin')).toContainText('没有独立边界分区包含这个 seed');

        await saveScreenshot(page, REAL_MAP_AUTO_EXTRACT_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('粗轮廓初稿可写入可编辑边界但不会保存正式成果', async ({ page }) => {
        const workspaceName = 'real-map-auto-candidate-disabled';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(120000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-readonly-boundary-diagnostics-summary').click();
        await expect(page.getByTestId('qidahen-load-rough-shape-outline-draft')).toContainText('生成粗轮廓初稿');
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBe(0);

        await page.getByTestId('qidahen-load-rough-shape-outline-draft').click();
        await expect(page.getByText(/已写入粗轮廓初稿/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/真实底图区域底色分区反推边界（5\/5 区）/u)).toBeVisible();
        await expect(page.getByTestId('qidahen-toggle-partition-preview-overlay')).toContainText('显示分区铺色');
        await expect(page.getByTestId('qidahen-toggle-seed-status-overlay')).toContainText('显示 seed 状态');
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBeGreaterThan(100);

        const barrierCanvasStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(barrierCanvasStats.opaquePixels).toBeGreaterThan(100);

        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should not contain rough-shape draft pixels` },
            ).toBe(0);
        }

        await page.getByTestId('qidahen-generate-regions-from-boundary').click();
        await expect(page.getByTestId('qidahen-boundary-normality-state')).not.toHaveText('accepted');
        await saveScreenshot(page, REAL_MAP_AUTO_CANDIDATE_DISABLED_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('底图候选诊断可导出为透明 PNG 但不写入正式边界', async ({ page }) => {
        const workspaceName = 'real-map-boundary-candidate-export';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(120000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => {
            const text = await page.getByTestId('qidahen-real-map-boundary-candidate-count').innerText();
            return Number(text.replace(/,/gu, ''));
        }, { timeout: 30000 }).toBeGreaterThan(100);
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBe(0);

        await page.getByTestId('qidahen-boundary-diagnostics-details').locator('summary').click();
        const downloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-real-map-boundary-candidate').click();
        const download = await downloadPromise;
        const candidatePath = await download.path();
        expect(candidatePath).not.toBeNull();
        expect(download.suggestedFilename()).toBe('qidahen-real-map-boundary-candidate-transparent.png');
        expect(await readSavedOpaquePixelCount(candidatePath!)).toBeGreaterThan(100);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            expect(await countPngOpaquePixelsInRect(candidatePath!, rect)).toBe(0);
        }
        await expect(page.getByText(/已导出底图候选诊断透明 PNG/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBe(0);
        await saveScreenshot(page, REAL_MAP_CANDIDATE_EXPORT_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('底图候选诊断导出不写入边界草稿，颜色线与可见闭合粗轮廓入口独立存在', async ({ page }) => {
        const workspaceName = 'real-map-boundary-candidate-diagnostic-only';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(300000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => {
            const text = await page.getByTestId('qidahen-real-map-boundary-candidate-count').innerText();
            return Number(text.replace(/,/gu, ''));
        }, { timeout: 30000 }).toBeGreaterThan(100);
        await expect.poll(async () => page.getByTestId('qidahen-real-map-boundary-candidate-readiness').innerText()).not.toContain('候选未生成');
        await expect(page.getByTestId('qidahen-real-map-boundary-candidate-readiness')).toContainText('候选不达标');
        await expect(page.getByTestId('qidahen-real-map-boundary-candidate-readiness')).toContainText('seed');
        await expect(page.getByTestId('qidahen-real-map-boundary-candidate-blockers')).toContainText(/候选只分出 \d\/5 个独立 seed/u);
        await expect(page.getByTestId('qidahen-prepare-hybrid-boundary-trace-kit')).toContainText('一键准备固定色边界稿 + 描边包');
        await expect(page.getByTestId('qidahen-load-real-map-color-line-draft')).toHaveCount(1);
        await expect(page.getByTestId('qidahen-load-real-map-color-line-draft')).toBeEnabled();
        await expect(page.getByTestId('qidahen-load-real-map-color-line-draft')).toContainText('载入固定色边界稿');

        await page.getByTestId('qidahen-boundary-diagnostics-details').locator('summary').click();
        const diagnosticDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-real-map-boundary-candidate').click();
        const diagnosticDownload = await diagnosticDownloadPromise;
        const diagnosticPath = await diagnosticDownload.path();
        expect(diagnosticPath).not.toBeNull();
        expect(diagnosticDownload.suggestedFilename()).toBe('qidahen-real-map-boundary-candidate-transparent.png');
        expect(await readSavedOpaquePixelCount(diagnosticPath!)).toBeGreaterThan(100);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            expect(await countPngOpaquePixelsInRect(diagnosticPath!, rect)).toBe(0);
        }
        await expect(page.getByText(/已导出底图候选诊断透明 PNG/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBe(0);
        expect((await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID)).opaquePixels).toBe(0);

        await page.getByTestId('qidahen-load-real-map-color-line-draft-primary').click();
        await expect(page.getByText(/已按 4 个固定边界色生成可编辑边界稿/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/可见闭合粗轮廓/u)).toBeVisible();
        await expect(page.getByText(/多余线删掉，缺线补上即可/u)).toBeVisible();
        await expect.poll(async () => {
            const match = /当前边界图像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBeGreaterThan(1000);
        await expect.poll(async () => {
            const match = /当前最终障碍像素：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBeGreaterThan(1000);
        const editableDraftCanvasStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(editableDraftCanvasStats.opaquePixels).toBeGreaterThan(1000);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should not contain color-line draft pixels` },
            ).toBe(0);
        }
        await expect.poll(async () => {
            const text = await page.getByTestId('qidahen-quality-boundary-ui-pixels').innerText();
            return Number(text.replace(/,/gu, ''));
        }).toBe(0);
        await expect.poll(async () => {
            const match = /UI mask：([\d,]+)/u.exec(await page.locator('aside').innerText());
            return match ? Number(match[1].replace(/,/gu, '')) : -1;
        }).toBe(0);
        await page.getByTestId('qidahen-real-map-boundary-candidate-readiness').scrollIntoViewIfNeeded();
        await saveScreenshot(page, REAL_MAP_CANDIDATE_DRAFT_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('改方向入口可载入人工整理粗轮廓初稿并生成五区可编辑区域', async ({ page }) => {
        const workspaceName = 'real-map-region-color-draft';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BG_CANVAS_TEST_ID)).opaquePixels).toBeGreaterThan(900000);
        await page.getByTestId('qidahen-boundary-secondary-region-workflow').locator('summary').click();
        await expect(page.getByTestId('qidahen-generate-real-map-region-color-draft').first()).toContainText('次路线：载入人工整理粗轮廓初稿');
        await page.getByTestId('qidahen-generate-real-map-region-color-draft').first().click();
        await expect(page.getByText(/已生成人工整理粗轮廓可编辑初稿/u)).toBeVisible({ timeout: 30000 });
        const generatedCount = await page.locator('[data-testid^="qidahen-region-generation-result-"]').filter({ hasText: '已生成' }).count();
        expect(generatedCount).toBe(5);
        const maskCanvasStats = await getCanvasOpaqueBounds(page, 'qidahen-mask-canvas');
        expect(maskCanvasStats.opaquePixels).toBeGreaterThan(30000);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, 'qidahen-mask-canvas', rect),
                { message: `${rect.label} should not contain region-color draft pixels` },
            ).toBe(0);
        }
        await expect(page.getByTestId('qidahen-boundary-normality-state')).not.toHaveText('accepted');
        await saveScreenshot(page, REAL_MAP_REGION_COLOR_DRAFT_SCREENSHOT);
        await saveTestIdScreenshot(page, 'qidahen-mask-canvas', REAL_MAP_REGION_COLOR_DRAFT_LAYER_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('快捷入口可直接生成区域粗稿并补全通路，进入移动代价编辑', async ({ page }) => {
        const workspaceName = 'real-map-region-path-quick-start';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BG_CANVAS_TEST_ID)).opaquePixels).toBeGreaterThan(900000);
        await page.getByTestId('qidahen-boundary-secondary-region-workflow').locator('summary').click();
        await expect(page.getByTestId('qidahen-quick-start-region-path-draft').first()).toContainText('次路线：区域粗稿 + 通路 + 移动代价');
        await page.getByTestId('qidahen-quick-start-region-path-draft').first().click();
        await expect(page.getByText(/已按真实底图生成区域粗稿并切到路径模式/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-truth-workflow-banner')).toContainText('区域粗稿 + 通路编辑（次路线）');
        await expect(page.getByTestId('qidahen-region-truth-workflow-banner')).toContainText('当前已锁显式 truth：5 区');
        await expect(page.getByTestId('qidahen-region-truth-workflow-banner')).toContainText('现在不用纠结');
        await expect(page.getByTestId('qidahen-region-truth-paint-shortcut')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-truth-path-shortcut')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-truth-save-shortcut')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-truth-focus-selected')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-truth-next-region')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-truth-export-selected-template')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-truth-boundary-tools')).toBeVisible();
        await expect(page.getByTestId('qidahen-import-boundary-draft')).toBeHidden();
        await expect(page.getByText('在地图上点通路边，或从一个区域中心拖到另一个中心建边。左侧只编辑当前选中的通路。')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-region-graph-node-"]')).toHaveCount(5);
        const passageRows = page.locator('[data-testid^="qidahen-passage-row-"]');
        await expect(passageRows.first()).toBeVisible();
        const passageRowCount = await passageRows.count();
        expect(passageRowCount).toBeGreaterThan(0);
        await expect(page.getByTestId('qidahen-passage-summary')).toContainText('中心 5 / 通路');
        const firstBoundarySelect = page.locator('select[data-testid^="qidahen-passage-boundary-"]').first();
        await firstBoundarySelect.selectOption('mountain');
        await expect(firstBoundarySelect).toHaveValue('mountain');
        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-mask.png'))).toBeGreaterThan(1000);
        await expect.poll(async () => readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBeGreaterThan(1000);
        expect(await readSavedOpaquePixelCount(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBeLessThan(6000);
        const savedGraph = readSavedRegionGraph(workspaceName);
        expect(savedGraph.nodes).toHaveLength(5);
        for (const regionId of COMPLETE_REGION_IDS) {
            const savedNode = savedGraph.nodes?.find((node) => node.id === regionId);
            expect(savedNode, `${regionId} node should be saved`).toBeTruthy();
            const range = REAL_MAP_REGION_DRAFT_PIXEL_RANGES[regionId];
            expect(savedNode?.pixelCount ?? 0, `${regionId} rough draft should stay within the editable map-region size band`).toBeGreaterThanOrEqual(range.min);
            expect(savedNode?.pixelCount ?? 0, `${regionId} rough draft should stay within the editable map-region size band`).toBeLessThanOrEqual(range.max);
        }
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            expect(await countPngOpaquePixelsInRect(getWorkspaceFilePath(workspaceName, 'region-mask.png'), rect)).toBe(0);
            expect(await countPngOpaquePixelsInRect(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'), rect)).toBe(0);
        }
        expect(await countPngOpaquePixelsOnSourceDecorations(getWorkspaceFilePath(workspaceName, 'region-mask.png'))).toBe(0);
        expect(await countPngOpaquePixelsOnSourceDecorations(getWorkspaceFilePath(workspaceName, 'region-boundary-mask.png'))).toBe(0);
        expect(savedGraph.edges.length).toBeGreaterThan(0);
        await saveScreenshot(page, REAL_MAP_REGION_PATH_QUICK_START_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('区域粗稿可反推成可编辑闭合边界稿，供手工删错线补缺线', async ({ page }) => {
        const workspaceName = 'real-map-region-to-boundary-draft';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BG_CANVAS_TEST_ID)).opaquePixels).toBeGreaterThan(900000);
        await page.getByTestId('qidahen-boundary-secondary-region-workflow').locator('summary').click();
        await page.getByTestId('qidahen-quick-start-region-path-draft').first().click();
        await expect(page.getByText(/已按真实底图生成区域粗稿并切到路径模式/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-truth-boundary-draft-shortcut')).toBeVisible();
        await page.getByTestId('qidahen-region-truth-boundary-draft-shortcut').click();
        await expect(page.getByText(/已按当前 5 区粗稿反推闭合边界稿/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/已自动隐藏区域填色与辅助层/u)).toBeVisible();
        await expect(page.getByText(/删错线、补缺线/u)).toBeVisible();
        await expect(page.getByTestId('qidahen-region-truth-workflow-banner')).toHaveCount(0);
        await expect.poll(async () => (await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID)).opaquePixels).toBeGreaterThan(1000);
        expect((await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID)).opaquePixels).toBeLessThan(6000);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should not contain boundary-draft pixels` },
            ).toBe(0);
        }
        await saveScreenshot(page, REAL_MAP_REGION_TO_BOUNDARY_DRAFT_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('真实底图细线候选只辅助画笔吸附，不自动生成正式成果', async ({ page }) => {
        const workspaceName = 'real-map-support-snap';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(180000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-start-blank-boundary-draft').click();
        await expect(page.getByText(/空白边界图手绘/u)).toBeVisible();
        await setBrushSize(page, 1);
        await expect(page.getByTestId('qidahen-real-map-boundary-snap-state')).toHaveText('off');
        await page.getByTestId('qidahen-toggle-real-map-boundary-support').click();
        await expect(page.getByTestId('qidahen-toggle-real-map-boundary-support')).toContainText('隐藏细线候选');
        await page.getByTestId('qidahen-toggle-real-map-boundary-snap').click();
        await expect(page.getByTestId('qidahen-real-map-boundary-snap-state')).toHaveText('on');
        await expect.poll(async () => {
            const text = await page.getByTestId('qidahen-real-map-boundary-support-count').innerText();
            return Number(text.replace(/,/gu, ''));
        }).toBeGreaterThan(1000);
        const candidatePixelCount = await page.getByTestId('qidahen-real-map-boundary-candidate-count').innerText()
            .then((text) => Number(text.replace(/,/gu, '')));
        expect(candidatePixelCount).toBeGreaterThan(100);

        const supportStats = await getCanvasOpaqueBounds(page, BARRIER_CANVAS_TEST_ID);
        expect(supportStats.opaquePixels).toBeGreaterThan(1000);
        expect(supportStats.opaquePixels).toBeLessThanOrEqual(candidatePixelCount + 100);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should not contain real-map candidate pixels` },
            ).toBe(0);
        }

        const canvasBox = await getRect(page.getByTestId('qidahen-region-canvas'));
        const { supportPoint, drawPoint } = await findCanvasSnapCandidateOutsideRects(
            page,
            BARRIER_CANVAS_TEST_ID,
            REAL_MAP_FORBIDDEN_UI_RECTS,
        );
        await clickCanvasMapPoint(page, canvasBox, drawPoint.x, drawPoint.y);
        await expect(page.getByText(/已吸附细线候选/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => readManualBarrierAddCount(page)).toBeGreaterThan(0);
        const snappedPixel = await getCanvasPixel(page, BARRIER_CANVAS_TEST_ID, supportPoint.x, supportPoint.y);
        expect(snappedPixel[3]).toBeGreaterThan(16);

        const qualityDownloadPromise = page.waitForEvent('download');
        await page.getByTestId('qidahen-export-boundary-quality-report').click();
        const qualityDownload = await qualityDownloadPromise;
        const qualityPath = await qualityDownload.path();
        expect(qualityPath).not.toBeNull();
        const qualityReport = JSON.parse(readFileSync(qualityPath!, 'utf8')) as {
            quality: {
                normality: {
                    state: string;
                    realMapFit: { state: string; supportedBoundaryPixelCount: number };
                };
            };
        };
        expect(qualityReport.quality.normality.state).not.toBe('accepted');
        expect(qualityReport.quality.normality.realMapFit.supportedBoundaryPixelCount).toBeGreaterThan(0);
        expect(qualityReport.quality.normality.realMapFit.state).not.toBe('passed');

        await page.getByTestId('qidahen-boundary-normality-report').scrollIntoViewIfNeeded();
        await saveScreenshot(page, REAL_MAP_SUPPORT_SNAP_SCREENSHOT);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('沿候选线补边沿真实细线寻路而不是直线封口', async ({ page }) => {
        const workspaceName = 'real-map-bridge-path';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(240000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-start-blank-boundary-draft').click();
        await expect(page.getByText(/空白边界图手绘/u)).toBeVisible();
        await setBrushSize(page, 1);
        await page.getByTestId('qidahen-toggle-real-map-boundary-support').click();
        await expect(page.getByTestId('qidahen-toggle-real-map-boundary-support')).toContainText('隐藏细线候选');
        await page.getByRole('button', { name: '边界修正', exact: true }).click();
        await page.getByTestId('qidahen-barrier-edit-mode-bridge').click();
        await expect(page.getByTestId('qidahen-barrier-edit-mode-bridge')).toContainText('沿候选线补边');

        const bridgePair = await findCurvedCanvasCandidatePairOutsideRects(
            page,
            BARRIER_CANVAS_TEST_ID,
            REAL_MAP_FORBIDDEN_UI_RECTS,
        );
        expect(bridgePair.pathLength).toBeGreaterThan(bridgePair.directDistance + 8);
        expect((await getCanvasPixel(page, BARRIER_CANVAS_TEST_ID, bridgePair.lineMidpoint.x, bridgePair.lineMidpoint.y))[3]).toBeLessThan(16);

        const canvasBox = await getRect(page.getByTestId('qidahen-region-canvas'));
        await dragCanvasMapPolyline(page, canvasBox, [bridgePair.start, bridgePair.end], 4);
        await expect(page.getByText(/沿细线候选补边/u)).toBeVisible({ timeout: 30000 });
        await expect.poll(async () => readManualBarrierAddCount(page)).toBeGreaterThan(0);

        await page.getByTestId('qidahen-toggle-real-map-boundary-support').click();
        await expect(page.getByTestId('qidahen-toggle-real-map-boundary-support')).toContainText('显示细线候选');
        const pathMidpointPixel = await getCanvasPixel(page, BARRIER_CANVAS_TEST_ID, bridgePair.pathMidpoint.x, bridgePair.pathMidpoint.y);
        const lineMidpointPixel = await getCanvasPixel(page, BARRIER_CANVAS_TEST_ID, bridgePair.lineMidpoint.x, bridgePair.lineMidpoint.y);
        expect(pathMidpointPixel[3]).toBeGreaterThan(16);
        expect(lineMidpointPixel[3]).toBeLessThan(16);
        for (const rect of REAL_MAP_FORBIDDEN_UI_RECTS) {
            await expect.poll(
                async () => countCanvasOpaquePixelsInRect(page, BARRIER_CANVAS_TEST_ID, rect),
                { message: `${rect.label} should not contain bridge path pixels` },
            ).toBe(0);
        }

        await page.getByTestId('qidahen-boundary-normality-report').scrollIntoViewIfNeeded();
        await saveScreenshot(page, REAL_MAP_BRIDGE_PATH_SCREENSHOT);
        await saveCanvasMapClipScreenshot(page, canvasBox, REAL_MAP_BRIDGE_PATH_DETAIL_SCREENSHOT, [
            bridgePair.start,
            bridgePair.end,
            bridgePair.pathMidpoint,
            bridgePair.lineMidpoint,
        ]);
        expect(readCanonicalWorkspaceSnapshot()).toEqual(canonicalBefore);
    });

    test('导入闭合边界后可按区域邻近补全路径并保存边界类型', async ({ page }) => {
        const workspaceName = 'path-graph';
        resetWorkspaceDir(workspaceName);
        const canonicalBefore = readCanonicalWorkspaceSnapshot();
        test.info().setTimeout(360000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        const boundaryMaskPath = await createSmallSaveableBoundaryMaskPng(['jinzhou', 'song-jin']);
        await page.getByTestId('qidahen-import-boundary-draft').click();
        await page.getByTestId('qidahen-boundary-draft-input').setInputFiles(boundaryMaskPath);
        await expect(page.getByText(/已导入边界图/u)).toBeVisible({ timeout: 30000 });
        await waitForBoundaryDraftPixels(page, 1000);
        await waitForFinalBarrierPixels(page, 1000);
        await expect.poll(async () => {
            const text = await page.getByTestId('qidahen-closed-face-count').textContent();
            return Number.parseInt(text ?? '0', 10);
        }).toBeGreaterThanOrEqual(2);
        await expect(page.getByTestId('qidahen-closed-seed-hit-count')).toContainText('2');

        await expect(page.getByText('rgb(61, 69, 66)')).toBeVisible();
        await expect(page.getByText('rgb(126, 97, 56)')).toBeVisible();
        await expect(page.getByText('rgb(128, 104, 62)')).toBeVisible();
        await expect(page.getByText('rgb(43, 36, 34)')).toBeVisible();
        await expect(page.getByTestId('qidahen-save-workspace')).toHaveCount(1);
        await expect(page.getByTestId('qidahen-export-boundary-draft')).toBeVisible();
        await expect(page.getByTestId(BG_CANVAS_TEST_ID)).toBeVisible();
        await expect(page.getByTestId(BARRIER_CANVAS_TEST_ID)).toBeVisible();
        await expect(page.getByTestId('qidahen-mask-canvas')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-graph')).toBeVisible();

        const barrierOpacity = await page.getByTestId(BARRIER_CANVAS_TEST_ID).evaluate((canvas) => window.getComputedStyle(canvas).opacity);
        expect(Number(barrierOpacity)).toBeGreaterThan(0.5);

        const beijingBackgroundPixel = await getCanvasPixel(page, BG_CANVAS_TEST_ID, 520, 610);
        expect(beijingBackgroundPixel[3]).toBe(255);
        expect(beijingBackgroundPixel.slice(0, 3).some((channel) => channel > 0)).toBe(true);

        await page.getByRole('button', { name: '清空', exact: true }).click();
        await page.getByTestId('qidahen-debug-generate-regions-from-boundary').click();
        await expect(page.getByText(/已调试生成当前独立分区/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-region-generation-result-jinzhou')).toContainText('已生成');
        await expect(page.getByTestId('qidahen-region-generation-result-song-jin')).toContainText('已生成');
        const twoRegionCounts = await getMaskColorCounts(page);
        expect(twoRegionCounts.red).toBeGreaterThan(1000);
        expect(twoRegionCounts.yellow).toBeGreaterThan(1000);
        expect(twoRegionCounts.redCenter).not.toBeNull();
        expect(twoRegionCounts.yellowCenter).not.toBeNull();
        await saveScreenshot(page, BOUNDARY_GENERATED_REGION_SCREENSHOT);

        await page.getByRole('button', { name: '路径', exact: true }).click();
        await expect(page.getByText('在地图上点通路边，或从一个区域中心拖到另一个中心建边。左侧只编辑当前选中的通路。')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-graph-node-jinzhou')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-graph-node-song-jin')).toBeVisible();
        await expect(page.getByTestId('qidahen-passage-summary')).toContainText('中心 2 / 通路 0');
        await page.getByTestId('qidahen-auto-detect-passages').click();
        await expect(page.getByText(/已按当前区域 mask 补全邻近通行路径/u)).toBeVisible({ timeout: 30000 });
        const passageRow = page.getByTestId(`qidahen-passage-row-${EDITED_PASSAGE_ID}`);
        await expect(passageRow).toBeVisible();
        await expect(page.getByTestId('qidahen-passage-summary')).toContainText('中心 2 / 通路 1');
        await page.getByTestId(`qidahen-passage-boundary-${EDITED_PASSAGE_ID}`).selectOption('mountain');
        await expect(page.getByTestId(`qidahen-passage-edge-${EDITED_PASSAGE_ID}`).getByText('山脉')).toBeVisible();
        await passageRow.scrollIntoViewIfNeeded();
        await saveScreenshot(page, PATH_AUTO_PASSAGE_SCREENSHOT);

        await page.getByRole('button', { name: '清空边界图', exact: true }).click();
        await expect(page.getByText(/已清空边界图和手工修正/u)).toBeVisible({ timeout: 30000 });
        await page.getByTestId('qidahen-save-workspace').click();
        await expect(page.getByText(/已保存工作区到/u)).toBeVisible({ timeout: 10000 });
        const savedGraph = readSavedRegionGraph(workspaceName);
        const savedPassage = savedGraph.edges?.find((edge) => edge.id === EDITED_PASSAGE_ID);
        expect(savedPassage).toMatchObject({
            from: 'jinzhou',
            to: 'song-jin',
            boundaryType: 'mountain',
            boundaryLabel: '山脉',
            battleWidth: 2,
        });
        expect(savedGraph.nodes?.find((node) => node.id === 'jinzhou')?.center).not.toBeNull();
        expect(savedGraph.nodes?.find((node) => node.id === 'song-jin')?.center).not.toBeNull();

        await page.goto(getWorkspaceRoute(workspaceName), { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await page.getByRole('button', { name: '路径', exact: true }).click();
        const persistedPassageRow = page.getByTestId(`qidahen-passage-row-${EDITED_PASSAGE_ID}`);
        await expect(persistedPassageRow).toBeVisible();
        await expect(page.getByTestId(`qidahen-passage-boundary-${EDITED_PASSAGE_ID}`)).toHaveValue('mountain');
        await expect(page.getByTestId(`qidahen-passage-edge-${EDITED_PASSAGE_ID}`).getByText('山脉')).toBeVisible();
        await persistedPassageRow.scrollIntoViewIfNeeded();
        const canonicalAfter = readCanonicalWorkspaceSnapshot();
        for (const key of Object.keys(canonicalBefore) as Array<keyof typeof canonicalBefore>) {
            expect(Buffer.compare(canonicalAfter[key], canonicalBefore[key]), `${String(key)} should not change`).toBe(0);
        }
    });
});
