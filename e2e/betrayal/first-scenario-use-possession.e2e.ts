import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createMaskMoveReadyRuntimeCore,
    createMedicalKitUseReadyRuntimeCore,
    createSkeletonKeyMoveReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    resolveBetrayalEvidencePath,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-物品使用完整链路';
const USE_READY_SCREENSHOT = `${EVIDENCE_DIR}/01-使用前牌桌可操作.jpg`;
const ITEM_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-急救包本体已选中.jpg`;
const TARGET_AVAILABLE_SCREENSHOT = `${EVIDENCE_DIR}/03-同房间队友目标可选.jpg`;
const TARGET_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/04-同房间队友目标已选中.jpg`;
const USE_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/05-急救包结算结果可见.jpg`;
const USE_RETURNED_SCREENSHOT = `${EVIDENCE_DIR}/06-物品使用后回牌桌状态清空.jpg`;

const MASK_EVIDENCE_DIR = 'evidence/山屋惊魂-面具移动完整链路';
const MASK_READY_SCREENSHOT = `${MASK_EVIDENCE_DIR}/01-面具使用前牌桌可操作.jpg`;
const MASK_SELECTED_SCREENSHOT = `${MASK_EVIDENCE_DIR}/02-面具本体已选中.jpg`;
const MASK_TARGET_TOKEN_SCREENSHOT = `${MASK_EVIDENCE_DIR}/03-同房间队友目标已激活.jpg`;
const MASK_TARGET_ROOM_SCREENSHOT = `${MASK_EVIDENCE_DIR}/04-选择相邻房间并确认前.jpg`;
const MASK_SETTLED_SCREENSHOT = `${MASK_EVIDENCE_DIR}/05-面具移动结算结果可见.jpg`;
const MASK_RETURNED_SCREENSHOT = `${MASK_EVIDENCE_DIR}/06-面具使用后回牌桌状态清空.jpg`;

const SKELETON_KEY_EVIDENCE_DIR = 'evidence/山屋惊魂-骨制钥匙穿墙移动完整链路';
const SKELETON_KEY_READY_SCREENSHOT = `${SKELETON_KEY_EVIDENCE_DIR}/01-骨制钥匙移动前牌桌可操作.png`;
const SKELETON_KEY_CARD_SCREENSHOT = `${SKELETON_KEY_EVIDENCE_DIR}/02-骨制钥匙本体规则可见.png`;
const SKELETON_KEY_SETTLED_SCREENSHOT = `${SKELETON_KEY_EVIDENCE_DIR}/05-骨制钥匙移动结算结果可见.png`;
const SKELETON_KEY_FULL_RUN_VIDEO = `${SKELETON_KEY_EVIDENCE_DIR}/03-骨制钥匙穿墙移动同源录屏.webm`;
const SKELETON_KEY_BEHAVIOR_TRACE = `${SKELETON_KEY_EVIDENCE_DIR}/behavior-chain.json`;

const SKELETON_KEY_SOURCE_FILES = [
    'e2e/betrayal/first-scenario-use-possession.e2e.ts',
    'e2e/betrayal/betrayalTestHelpers.ts',
    'src/games/betrayal/Board.tsx',
    'src/games/betrayal/game.ts',
    'src/games/betrayal/movementReadModel.ts',
    'src/games/betrayal/movementResolutionModel.ts',
    'src/games/betrayal/sceneMovementModel.ts',
    'src/games/betrayal/testing/firstScenarioTestUtils.ts',
];

async function waitForMedicalKitAtlas(page: Page) {
    await expect.poll(async () => page.evaluate(() => {
        const image = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-medical-kit-front-atlas"]');
        return {
            asset: image?.getAttribute('data-asset-src') ?? '',
            loaded: Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
        };
    }), {
        message: '急救包必须使用正式物品牌面 atlas，不能退回纯文字物品',
        timeout: 15000,
    }).toEqual({
        asset: expect.stringContaining('item-front-atlas'),
        loaded: true,
    });
}

async function readUseChainState(page: Page) {
    return page.evaluate(() => {
        const rectOf = (testId: string) => {
            const element = document.querySelector(`[data-testid="${testId}"]`);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            };
        };
        const useButton = document.querySelector<HTMLButtonElement>('[data-testid="betrayal-action-use"]');
        const rawSelectedName = document.querySelector('[data-testid="betrayal-selected-inventory-card-name"]')?.textContent?.trim() ?? '';
        const selectedName = rawSelectedName === '未选卡牌' ? '' : rawSelectedName;
        const feedback = document.querySelector('[data-testid="betrayal-room-latest-feedback"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const useStatus = document.querySelector('[data-testid="betrayal-use-status"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const targetSelector = document.querySelector('[data-testid="betrayal-inventory-target-player-selector"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const targetOutline = document.querySelector('[data-testid="betrayal-room-occupant-target-outline-hallway-1"]');
        return {
            medicalKit: rectOf('betrayal-inventory-medical-kit'),
            useButton: rectOf('betrayal-action-use'),
            useButtonDisabled: Boolean(useButton?.disabled),
            selectedName,
            feedback,
            useStatus,
            targetSelector,
            targetOutlineSelected: targetOutline?.getAttribute('data-selected') ?? '',
            targetOutlineShape: targetOutline?.getAttribute('data-highlight-shape') ?? '',
            targetDirect: document.querySelector('[data-testid="betrayal-room-occupant-hallway-1"]')?.getAttribute('data-direct-target') ?? '',
        };
    });
}

async function assertMedicalKitUseReady(page: Page) {
    const metrics = await readUseChainState(page);
    expect(metrics.medicalKit, '使用前必须看得到急救包本体').not.toBeNull();
    expect(metrics.medicalKit!.width, '急救包必须保持真实牌面宽度，不能退成小文字选项').toBeGreaterThanOrEqual(58);
    expect(metrics.useButton, '使用按钮必须存在于真实动作区').not.toBeNull();
    expect(metrics.useButton!.width, '使用按钮必须保持可点击尺寸').toBeGreaterThanOrEqual(80);
    expect(metrics.selectedName, '使用前不能已有选中物品').toBe('');
    expect(metrics.useButtonDisabled, '未选物品和目标前，使用按钮应禁用').toBe(true);
}

async function assertMedicalKitSelectedNeedsTarget(page: Page) {
    const metrics = await readUseChainState(page);
    expect(metrics.selectedName, '点击急救包本体后必须选中急救包').toContain('急救包');
    expect(metrics.targetSelector, '急救包选中后必须显示治疗目标选择提示').toContain('急救包');
    expect(metrics.targetSelector, '急救包选中后必须列出同房间队友').toContain('AI 2 号位');
    expect(metrics.targetDirect, '治疗目标主路径必须点击地图上的队友 token 本体').toBe('true');
    expect(metrics.targetOutlineShape, '治疗目标高亮必须贴合玩家 token').toBe('pentagon');
    expect(metrics.useButtonDisabled, '未选择治疗目标前不能直接使用').toBe(true);
}

async function assertMedicalKitTargetSelected(page: Page) {
    const metrics = await readUseChainState(page);
    expect(metrics.selectedName, '选择目标后仍必须保留急救包为待使用对象').toContain('急救包');
    expect(metrics.targetOutlineSelected, '选中同房间队友后目标高亮应变为已选状态').toBe('true');
    expect(metrics.useButtonDisabled, '选中急救包和治疗目标后，使用按钮必须可点击').toBe(false);
}

async function assertMedicalKitSettled(page: Page) {
    await expect.poll(async () => page.evaluate(() => {
        const holder = window as unknown as {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentExplorer?: { inventory?: Array<{ id: string; name: string }> };
                            otherExplorers?: Array<{
                                playerId: string;
                                traits?: Record<string, number>;
                            }>;
                            usedCardIdsThisTurn?: string[];
                            activityLog?: Array<{ text: string }>;
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { error: string; commandType: string };
        };
        const state = holder.__BG_TEST_HARNESS__?.state?.get?.();
        const teammate = state?.core?.otherExplorers?.find((explorer) => explorer.playerId === '1');
        return {
            currentInventory: state?.core?.currentExplorer?.inventory?.map((item) => item.name) ?? [],
            teammateTraits: teammate?.traits ?? {},
            usedCards: state?.core?.usedCardIdsThisTurn ?? [],
            latestLog: state?.core?.activityLog?.[0]?.text ?? '',
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    }), {
        message: '急救包使用后必须消耗物品、治疗队友并写入活动日志',
        timeout: 10000,
    }).toMatchObject({
        currentInventory: expect.not.arrayContaining(['急救包']),
        teammateTraits: {
            might: expect.any(Number),
            speed: expect.any(Number),
            knowledge: expect.any(Number),
            sanity: expect.any(Number),
        },
        usedCards: expect.arrayContaining(['medical-kit']),
        latestLog: expect.stringMatching(/埋葬急救包|治疗丽贝卡·艾伦博士/),
        rejected: null,
    });
    await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/埋葬急救包|治疗丽贝卡·艾伦博士/);
    await expect(page.getByTestId('betrayal-inventory-medical-kit'), '急救包使用后必须从当前持有区消失').toHaveCount(0);
}

async function assertMedicalKitSelectionCleared(page: Page) {
    await expect(page.getByTestId('betrayal-selected-inventory-card-name'), '物品使用结算后不能残留已选物品').toHaveCount(0);
    await expect(page.getByTestId('betrayal-inventory-target-player-selector'), '物品使用结算后目标选择提示必须清空').toHaveCount(0);
    const targetState = await page.evaluate(() => {
        const outline = document.querySelector('[data-testid="betrayal-room-occupant-target-outline-hallway-1"]');
        const outlineStyle = outline ? window.getComputedStyle(outline) : null;
        return {
            outlineBorderColor: outlineStyle?.borderTopColor ?? '',
        };
    });
    expect(targetState.outlineBorderColor, '物品使用结算后队友不能继续保持治疗已选金色实线；同房间交易候选高亮可以继续存在').not.toBe('rgb(209, 176, 95)');
    await expect(page.getByTestId('betrayal-board'), '物品使用后必须回到可操作牌桌').toBeVisible();
    await expect(page.getByTestId('betrayal-action-use'), '物品使用后仍保留使用动作入口，但因无可用物品禁用').toBeDisabled();
}

async function waitForMaskAtlas(page: Page) {
    await expect.poll(async () => page.evaluate(() => {
        const image = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-mask-front-atlas"]');
        return {
            asset: image?.getAttribute('data-asset-src') ?? '',
            loaded: Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
        };
    }), {
        message: '面具必须使用正式预兆牌面 atlas，不能退回纯文字牌',
        timeout: 15000,
    }).toEqual({
        asset: expect.stringContaining('omen-front-atlas'),
        loaded: true,
    });
}

async function readMaskChainState(page: Page) {
    return page.evaluate(() => {
        const rectOf = (testId: string) => {
            const element = document.querySelector(`[data-testid="${testId}"]`);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            };
        };
        const useButton = document.querySelector<HTMLButtonElement>('[data-testid="betrayal-action-use"]');
        const rawSelectedName = document.querySelector('[data-testid="betrayal-selected-inventory-card-name"]')?.textContent?.trim() ?? '';
        const selectedName = rawSelectedName === '未选卡牌' ? '' : rawSelectedName;
        const maskSelector = document.querySelector('[data-testid="betrayal-mask-target-selector"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const activeTarget = document.querySelector('[data-testid="betrayal-mask-active-target-1"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const firstRoomHighlight = document.querySelector<HTMLElement>('[data-testid^="betrayal-room-mask-target-card-highlight-"]');
        const firstTargetRoomId = firstRoomHighlight?.dataset.testid?.replace('betrayal-room-mask-target-card-highlight-', '') ?? '';
        const targetOutline = document.querySelector('[data-testid="betrayal-room-occupant-target-outline-hallway-1"]');
        const targetToken = document.querySelector('[data-testid="betrayal-room-occupant-hallway-1"]');
        return {
            mask: rectOf('betrayal-inventory-mask'),
            useButton: rectOf('betrayal-action-use'),
            useButtonDisabled: Boolean(useButton?.disabled),
            selectedName,
            maskSelector,
            activeTarget,
            targetTokenDirect: targetToken?.getAttribute('data-direct-target') ?? '',
            targetTokenShape: targetToken?.getAttribute('data-highlight-shape') ?? '',
            targetOutlineVisible: Boolean(targetOutline),
            firstTargetRoomId,
        };
    });
}

async function assertMaskUseReady(page: Page) {
    const metrics = await readMaskChainState(page);
    expect(metrics.mask, '使用前必须看得到面具本体').not.toBeNull();
    expect(metrics.mask!.width, '面具必须保持真实牌面宽度，不能退成小文字选项').toBeGreaterThanOrEqual(58);
    expect(metrics.useButton, '使用按钮必须存在于真实动作区').not.toBeNull();
    expect(metrics.useButtonDisabled, '未选面具和目标房间前，使用按钮应禁用').toBe(true);
    expect(metrics.selectedName, '使用前不能已有选中物品').toBe('');
}

async function assertMaskSelectedNeedsTarget(page: Page) {
    const metrics = await readMaskChainState(page);
    expect(metrics.selectedName, '点击面具本体后必须选中面具').toContain('面具');
    expect(metrics.maskSelector, '面具选中后必须显示面具目标选择器').toContain('面具');
    expect(metrics.maskSelector, '面具选中后必须列出同房间队友').toContain('AI 2 号位');
    expect(metrics.targetTokenDirect, '面具目标主路径必须点击地图上的队友 token 本体').toBe('true');
    expect(metrics.targetTokenShape, '面具目标高亮必须贴合玩家 token').toBe('pentagon');
    expect(metrics.targetOutlineVisible, '同房间队友 token 必须有可移动目标高亮').toBe(true);
    expect(metrics.firstTargetRoomId, '面具必须提供至少一个相邻房间目标').not.toBe('');
    expect(metrics.useButtonDisabled, '未选择目标房间前不能直接使用面具').toBe(true);
}

async function selectFirstMaskTargetRoom(page: Page): Promise<string> {
    const targetRoomId = await page.evaluate(() => {
        const highlight = document.querySelector<HTMLElement>('[data-testid^="betrayal-room-mask-target-card-highlight-"]');
        return highlight?.dataset.testid?.replace('betrayal-room-mask-target-card-highlight-', '') ?? '';
    });
    expect(targetRoomId, '面具必须提供真实相邻房间高亮').not.toBe('');
    await page.getByTestId(`betrayal-room-${targetRoomId}`).click();
    return targetRoomId;
}

async function assertMaskTargetRoomSelected(page: Page, targetRoomId: string) {
    const metrics = await readMaskChainState(page);
    expect(metrics.selectedName, '选择目标房间后仍必须保留面具为待使用对象').toContain('面具');
    expect(metrics.activeTarget, '目标房间选好后，面具目标行不能继续显示待选择').not.toContain('待');
    await expect(page.getByTestId(`betrayal-room-mask-target-card-highlight-${targetRoomId}`), '相邻房间必须保持已选高亮').toBeVisible();
    await expect(page.getByTestId('betrayal-action-use'), '选中面具、队友和目标房间后，使用按钮必须可点击').toBeEnabled();
}

async function assertMaskSettled(page: Page, targetRoomId: string) {
    await expect.poll(async () => page.evaluate((roomId) => {
        const holder = window as unknown as {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentExplorer?: { inventory?: Array<{ id: string; name: string }>; roomId?: string };
                            otherExplorers?: Array<{ playerId: string; roomId?: string; inventory?: Array<{ id: string; name: string }> }>;
                            usedCardIdsThisTurn?: string[];
                            activityLog?: Array<{ text: string }>;
                        };
                    };
                };
            };
            __BG_LAST_COMMAND_REJECTED__?: { error: string; commandType: string };
        };
        const state = holder.__BG_TEST_HARNESS__?.state?.get?.();
        const teammate = state?.core?.otherExplorers?.find((explorer) => explorer.playerId === '1');
        return {
            currentRoomId: state?.core?.currentExplorer?.roomId ?? '',
            currentInventory: state?.core?.currentExplorer?.inventory?.map((item) => item.name) ?? [],
            teammateRoomId: teammate?.roomId ?? '',
            usedCards: state?.core?.usedCardIdsThisTurn ?? [],
            latestLog: state?.core?.activityLog?.[0]?.text ?? '',
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            expectedRoomId: roomId,
        };
    }, targetRoomId), {
        message: '面具使用后必须把同房间队友移动到相邻房间，并记录面具已使用',
        timeout: 10000,
    }).toMatchObject({
        currentRoomId: 'hallway',
        currentInventory: expect.arrayContaining(['面具']),
        teammateRoomId: targetRoomId,
        usedCards: expect.arrayContaining(['mask']),
        latestLog: expect.stringMatching(/使用面具|同板块其他角色/),
        rejected: null,
        expectedRoomId: targetRoomId,
    });
    await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/使用面具|同板块其他角色/);
    await expect(page.getByTestId(`betrayal-room-occupant-${targetRoomId}-1`), '面具结算后队友 token 必须出现在目标房间').toBeVisible();
}

async function assertMaskSelectionCleared(page: Page, targetRoomId: string) {
    await expect(page.getByTestId('betrayal-selected-inventory-card-name'), '面具使用结算后不能残留已选面具').toHaveCount(0);
    await expect(page.getByTestId('betrayal-mask-target-selector'), '面具使用结算后目标选择器必须清空').toHaveCount(0);
    await expect(page.getByTestId('betrayal-room-occupant-target-outline-hallway-1'), '面具使用结算后原房间队友目标高亮必须清空').toHaveCount(0);
    await expect(page.getByTestId(`betrayal-room-mask-target-card-highlight-${targetRoomId}`), '面具使用结算后目标房间高亮必须清空').toHaveCount(0);
    await expect(page.getByTestId('betrayal-board'), '面具使用后必须回到可操作牌桌').toBeVisible();
}

async function waitForSkeletonKeyAtlas(page: Page) {
    await expect.poll(async () => page.evaluate(() => {
        const image = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-lockpick-tool-front-atlas"]');
        return {
            asset: image?.getAttribute('data-asset-src') ?? '',
            loaded: Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
        };
    }), {
        message: '骨制钥匙必须使用正式物品牌面 atlas，不能退回纯文字物品',
        timeout: 15000,
    }).toEqual({
        asset: expect.stringContaining('item-front-atlas'),
        loaded: true,
    });
}

// Independent representative-state chain, not natural item acquisition or a golden run.
async function readSkeletonKeyMoveState(page: Page) {
    return page.evaluate(() => {
        const holder = window as unknown as {
            __BG_TEST_HARNESS__?: { state?: { get?: () => {
                core?: { scenarioId?: string; proposedScenarioCardId?: string; phase?: string; playerIds?: string[]; currentPlayer?: string; activeRoomId?: string;
                    currentExplorer?: { playerId?: string; explorerId?: string; roomId?: string; inventory?: Array<{ id: string; name: string }> };
                    movesRemaining?: number; activityLog?: Array<{ text: string }> };
                sys?: { eventStream?: { entries?: Array<{ id: number; event: { type: string; payload: Record<string, unknown> } }> } };
            } } };
            __BG_LAST_COMMAND_REJECTED__?: { error: string; commandType: string };
        };
        const state = holder.__BG_TEST_HARNESS__?.state?.get?.();
        return {
            scenarioId: state?.core?.scenarioId,
            proposedScenarioCardId: state?.core?.proposedScenarioCardId,
            phase: state?.core?.phase,
            playerIds: state?.core?.playerIds ?? [],
            currentPlayer: state?.core?.currentPlayer,
            explorerId: state?.core?.currentExplorer?.explorerId,
            playerId: state?.core?.currentExplorer?.playerId,
            currentRoomId: state?.core?.currentExplorer?.roomId,
            activeRoomId: state?.core?.activeRoomId,
            inventoryIds: state?.core?.currentExplorer?.inventory?.map(item => item.id) ?? [],
            movesRemaining: state?.core?.movesRemaining,
            latestLog: state?.core?.activityLog?.[0]?.text ?? '',
            moves: state?.sys?.eventStream?.entries?.filter(entry => entry.event.type === 'EXPLORER_MOVED') ?? [],
            rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
        };
    });
}

type SkeletonKeyObservation = {
    visible: Record<string, unknown>;
    authoritative: Awaited<ReturnType<typeof readSkeletonKeyMoveState>>;
};

type SkeletonKeyTraceAssertion = {
    name: string;
    actual: unknown;
    expected: unknown;
};

type SkeletonKeyTraceStep = {
    id: string;
    action: string;
    before: SkeletonKeyObservation;
    after: SkeletonKeyObservation;
    assertions: SkeletonKeyTraceAssertion[];
};

type SkeletonKeyBehaviorTrace = {
    version: 1;
    evidenceCategory: 'independent';
    gameId: 'betrayal';
    chainId: string;
    sourceRun: string;
    sourceRevision: string;
    sourceFingerprint: {
        gitHeadFull: string;
        files: Record<string, string>;
    };
    status: 'RUNNING' | 'PASS' | 'FAIL';
    outcome: string;
    requiredSteps: string[];
    startedAt: string;
    completedAt?: string;
    representativeState: {
        fixtureFactory: string;
        sourceFile: string;
        fixtureExplorerId: string;
        fixturePlayerId: string;
        fixtureRoomId: string;
        fixtureCardIds: string[];
        mode: 'representative-state';
        naturalAcquisition: false;
        injectedAfter: string;
        randomQueue: number[];
    };
    steps: SkeletonKeyTraceStep[];
    uiStates: Array<{
        id: string;
        stepId: string;
        change: 'layout' | 'panel' | 'interaction-mode' | 'target-highlight' | 'error' | 'empty' | 'animation-phase';
        viewport: 'desktop' | 'mobile';
        sha256: string;
    }>;
    media?: Array<{ path: string; sha256: string; kind: 'image' | 'video' | 'gif' }>;
    pendingAction?: { id: string; action: string; before: SkeletonKeyObservation; after?: SkeletonKeyObservation };
    failure?: string;
};

function hashSkeletonKeyBytes(bytes: Buffer) {
    return createHash('sha256').update(bytes).digest('hex');
}

function readSkeletonKeySourceFingerprint() {
    const gitHeadFull = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: process.cwd(),
        encoding: 'utf8',
    }).trim();
    const files = Object.fromEntries(SKELETON_KEY_SOURCE_FILES.map((file) => [
        file,
        hashSkeletonKeyBytes(readFileSync(resolve(process.cwd(), file))),
    ]));
    const sourceFingerprint = { gitHeadFull, files };
    const sourceRevision = hashSkeletonKeyBytes(Buffer.from(JSON.stringify(sourceFingerprint)));
    return { sourceRevision, sourceFingerprint };
}

function persistSkeletonKeyBehaviorTrace(trace: SkeletonKeyBehaviorTrace) {
    const filePath = resolveBetrayalEvidencePath(SKELETON_KEY_BEHAVIOR_TRACE);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(trace, null, 2)}\n`);
}

async function readSkeletonKeyObservation(page: Page): Promise<SkeletonKeyObservation> {
    const visible = await page.evaluate(() => {
        const element = (testId: string) => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
        const text = (testId: string) => element(testId)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const attribute = (testId: string, name: string) => element(testId)?.getAttribute(name) ?? null;
        const shown = (testId: string) => {
            const node = element(testId);
            if (!node) return false;
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const cardAtlas = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-preview-card-front-atlas"]');
        return {
            route: `${window.location.pathname}${window.location.search}`,
            characterGridVisible: shown('betrayal-character-selection-grid'),
            boardVisible: shown('betrayal-board'),
            boardVisualBusy: attribute('betrayal-board', 'data-betrayal-visual-busy'),
            openingVisible: shown('betrayal-start-scenario-opening-stage'),
            turnIntroCount: document.querySelectorAll('[data-testid="betrayal-turn-intro-skip"]').length,
            keyVisible: shown('betrayal-inventory-lockpick-tool'),
            magnifyVisible: shown('betrayal-inventory-lockpick-tool-magnify'),
            previewVisible: shown('betrayal-inventory-preview-overlay'),
            previewCardLoaded: Boolean(cardAtlas?.complete && cardAtlas.naturalWidth > 0 && cardAtlas.naturalHeight > 0),
            targetVisible: shown('betrayal-room-upper-west'),
            targetDirect: attribute('betrayal-room-upper-west', 'data-direct-target'),
            targetMoveKind: attribute('betrayal-room-upper-west', 'data-move-kind'),
            targetMoveCost: attribute('betrayal-room-upper-west', 'data-move-cost'),
            targetTitle: attribute('betrayal-room-upper-west', 'title'),
            targetCostText: text('betrayal-room-move-cost-upper-west'),
            movementRemainingAttribute: attribute('betrayal-movement-snapshot', 'data-moves-remaining'),
            movementSnapshotText: text('betrayal-movement-snapshot'),
            sourceOccupantVisible: shown('betrayal-room-occupant-upper-landing-0'),
            destinationOccupantVisible: shown('betrayal-room-occupant-upper-west-0'),
            latestFeedback: text('betrayal-room-latest-feedback'),
            followUpTargetVisible: shown('betrayal-room-upper-landing'),
            followUpTargetDirect: attribute('betrayal-room-upper-landing', 'data-direct-target'),
            followUpTargetMoveKind: attribute('betrayal-room-upper-landing', 'data-move-kind'),
            followUpTargetMoveCost: attribute('betrayal-room-upper-landing', 'data-move-cost'),
        };
    });
    return { visible, authoritative: await readSkeletonKeyMoveState(page) };
}

function skeletonKeyTraceAssertion(name: string, actual: unknown, expected: unknown): SkeletonKeyTraceAssertion {
    return { name, actual, expected };
}

function recordSkeletonKeyTraceStep(
    trace: SkeletonKeyBehaviorTrace,
    step: SkeletonKeyTraceStep,
) {
    if (!step.id.trim() || !step.action.trim()
        || Object.keys(step.before.visible).length === 0
        || Object.keys(step.before.authoritative).length === 0
        || Object.keys(step.after.visible).length === 0
        || Object.keys(step.after.authoritative).length === 0
        || step.assertions.length === 0
        || step.assertions.some((assertion) => !assertion.name.trim() || !isDeepStrictEqual(assertion.actual, assertion.expected))) {
        throw new Error(`行为追踪步骤不符合验证器 schema 或实际断言不相等：${step.id}`);
    }
    trace.steps.push(step);
    trace.pendingAction = undefined;
    persistSkeletonKeyBehaviorTrace(trace);
}

function validateCompletedSkeletonKeyTrace(trace: SkeletonKeyBehaviorTrace) {
    const stepIds = trace.steps.map((step) => step.id);
    const orderedRequiredSteps = trace.requiredSteps.map((id) => stepIds.indexOf(id));
    const mediaIds = trace.uiStates.map((state) => state.id);
    if (trace.status !== 'PASS'
        || trace.evidenceCategory !== 'independent'
        || trace.gameId !== 'betrayal'
        || !trace.outcome.trim()
        || trace.requiredSteps.length === 0
        || new Set(stepIds).size !== stepIds.length
        || trace.requiredSteps.some((id) => !stepIds.includes(id))
        || orderedRequiredSteps.some((position, index) => index > 0 && position <= orderedRequiredSteps[index - 1])
        || new Set(mediaIds).size !== mediaIds.length
        || trace.uiStates.some((state) => !stepIds.includes(state.stepId) || !/^[a-f0-9]{64}$/i.test(state.sha256))) {
        throw new Error('行为追踪完整链 preflight 未符合 evidence validator contract');
    }
}

function recordSkeletonKeyUiMedia(
    trace: SkeletonKeyBehaviorTrace,
    entry: { path: string; id: string; stepId: string; change: SkeletonKeyBehaviorTrace['uiStates'][number]['change']; viewport: 'desktop' | 'mobile'; bytes: Buffer; kind: 'image' | 'video' | 'gif' },
) {
    const sha256 = hashSkeletonKeyBytes(entry.bytes);
    trace.uiStates.push({
        id: entry.id,
        stepId: entry.stepId,
        change: entry.change,
        viewport: entry.viewport,
        sha256,
    });
    trace.media ??= [];
    trace.media.push({ path: entry.path, sha256, kind: entry.kind });
    persistSkeletonKeyBehaviorTrace(trace);
}

async function assertSkeletonKeyMoveReady(page: Page) {
    await expect.poll(() => readSkeletonKeyMoveState(page)).toMatchObject({
        phase: 'preHaunt', currentPlayer: '0', playerId: '0', currentRoomId: 'upper-landing',
        inventoryIds: ['lockpick-tool'], movesRemaining: 2, rejected: null,
    });
    await expect(page.getByTestId('betrayal-board')).toHaveAttribute('data-betrayal-visual-busy', 'false');
    await expect(page.getByTestId('betrayal-inventory-lockpick-tool')).toBeVisible();
    const target = page.getByTestId('betrayal-room-upper-west');
    await expect(target).toBeVisible();
    await expect(target).toHaveAttribute('data-direct-target', 'true');
    await expect(target).toHaveAttribute('data-move-kind', 'skeletonKey');
    await expect(target).toHaveAttribute('data-move-cost', '1');
    await expect(target).toHaveAttribute('title', /使用骨制钥匙.*1 点移动力/);
    await expect(page.getByTestId('betrayal-room-move-cost-upper-west')).toContainText('骨钥匙');
    await expect(page.getByTestId('betrayal-movement-snapshot')).toHaveAttribute('data-moves-remaining', '2');
    await expect(page.getByTestId('betrayal-movement-snapshot')).toContainText(/2\s*\/\s*2/);
    await expect(page.getByTestId('betrayal-room-occupant-upper-landing-0')).toBeVisible();
}

async function assertSkeletonKeySettled(page: Page, before: Awaited<ReturnType<typeof readSkeletonKeyMoveState>>) {
    await expect.poll(() => readSkeletonKeyMoveState(page), { timeout: 10000 }).toMatchObject({
        currentPlayer: before.currentPlayer, playerId: before.playerId, explorerId: before.explorerId,
        currentRoomId: 'upper-west', activeRoomId: 'upper-west', inventoryIds: ['lockpick-tool'],
        movesRemaining: 1, rejected: null,
    });
    const after = await readSkeletonKeyMoveState(page);
    expect(after.latestLog).toContain('使用骨制钥匙穿过墙壁');
    expect(after.latestLog).toContain('图书馆');
    const freshMoves = after.moves.filter(entry => !before.moves.some(previous => previous.id === entry.id));
    expect(freshMoves).toHaveLength(1);
    expect(freshMoves[0].event.payload).toMatchObject({
        playerId: '0', roomId: 'upper-west', skeletonKeyCardId: 'lockpick-tool',
        skeletonKeyRoll: 2, skeletonKeyBuried: false,
    });
    await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('使用骨制钥匙穿过墙壁');
    await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('图书馆');
    await expect(page.getByTestId('betrayal-movement-snapshot')).toHaveAttribute('data-moves-remaining', '1');
    await expect(page.getByTestId('betrayal-movement-snapshot')).toContainText(/1\s*\/\s*2/);
    await expect(page.getByTestId('betrayal-room-occupant-upper-west-0')).toBeVisible();
    await expect(page.getByTestId('betrayal-room-occupant-upper-landing-0')).toHaveCount(0);
    await expect(page.getByTestId('betrayal-board')).toHaveAttribute('data-betrayal-visual-busy', 'false');
    // One move remains: legal next targets must not be forcibly cleared as a fake "cleanup".
    const nextTarget = page.getByTestId('betrayal-room-upper-landing');
    await expect(nextTarget).toHaveAttribute('data-direct-target', 'true');
    await expect(nextTarget).toHaveAttribute('data-move-kind', 'skeletonKey');
    await expect(nextTarget).toHaveAttribute('data-move-cost', '1');
    await expect(page.getByTestId('betrayal-inventory-preview-overlay')).not.toBeVisible();
}

test.describe('山屋惊魂首剧本物品使用交互', () => {
    test('真实页面选择急救包、选队友目标并完成治疗收口', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-use-possession');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(page);
        await injectCore(page, createMedicalKitUseReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForMedicalKitAtlas(page);
        await assertMedicalKitUseReady(page);
        await saveScreenshot(page, USE_READY_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-medical-kit').click();
        await assertMedicalKitSelectedNeedsTarget(page);
        await saveScreenshot(page, ITEM_SELECTED_SCREENSHOT);
        await saveScreenshot(page, TARGET_AVAILABLE_SCREENSHOT);

        await page.getByTestId('betrayal-room-occupant-hallway-1').click();
        await assertMedicalKitTargetSelected(page);
        await saveScreenshot(page, TARGET_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        await assertMedicalKitSettled(page);
        await saveScreenshot(page, USE_SETTLED_SCREENSHOT);
        await assertMedicalKitSelectionCleared(page);
        await saveScreenshot(page, USE_RETURNED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-use-possession', diagnostics }]);
    });

    test('面具真实链路选择同房间队友、相邻房间并完成移动收口', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-mask-move-possession');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(page);
        await injectCore(page, createMaskMoveReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForMaskAtlas(page);
        await assertMaskUseReady(page);
        await saveScreenshot(page, MASK_READY_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-mask').click();
        await assertMaskSelectedNeedsTarget(page);
        await saveScreenshot(page, MASK_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-room-occupant-hallway-1').click();
        await assertMaskSelectedNeedsTarget(page);
        await saveScreenshot(page, MASK_TARGET_TOKEN_SCREENSHOT);

        const targetRoomId = await selectFirstMaskTargetRoom(page);
        await assertMaskTargetRoomSelected(page, targetRoomId);
        await saveScreenshot(page, MASK_TARGET_ROOM_SCREENSHOT);

        await page.getByTestId('betrayal-action-use').click();
        await assertMaskSettled(page, targetRoomId);
        await saveScreenshot(page, MASK_SETTLED_SCREENSHOT);
        await assertMaskSelectionCleared(page, targetRoomId);
        await saveScreenshot(page, MASK_RETURNED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-mask-move-possession', diagnostics }]);
    });

    test('骨制钥匙独立代表态：真实开局后直选穿墙房间并完成移动收口', async ({ page, context }) => {
        test.setTimeout(180000);
        const startedAt = new Date().toISOString();
        const sourceRun = `skeleton-key-behavior-${startedAt.replace(/[-:.]/g, '')}`;
        let sourceRevision = '';
        let sourceFingerprint: SkeletonKeyBehaviorTrace['sourceFingerprint'] = { gitHeadFull: '', files: {} };
        try {
            const fingerprint = readSkeletonKeySourceFingerprint();
            sourceRevision = fingerprint.sourceRevision;
            sourceFingerprint = fingerprint.sourceFingerprint;
        } catch (error) {
            const failedTrace: SkeletonKeyBehaviorTrace = {
                version: 1,
                evidenceCategory: 'independent',
                gameId: 'betrayal',
                chainId: sourceRun,
                sourceRun,
                sourceRevision,
                sourceFingerprint,
                status: 'FAIL',
                outcome: 'Source fingerprint could not be read before the browser run.',
                requiredSteps: [],
                startedAt,
                representativeState: {
                    fixtureFactory: 'createSkeletonKeyMoveReadyRuntimeCore',
                    sourceFile: 'src/games/betrayal/testing/firstScenarioTestUtils.ts',
                    fixtureExplorerId: '',
                    fixturePlayerId: '',
                    fixtureRoomId: '',
                    fixtureCardIds: [],
                    mode: 'representative-state',
                    naturalAcquisition: false,
                    injectedAfter: 'not reached',
                    randomQueue: [0.9],
                },
                steps: [],
                uiStates: [],
                failure: error instanceof Error ? error.message : String(error),
            };
            persistSkeletonKeyBehaviorTrace(failedTrace);
            throw error;
        }
        const fixture = createSkeletonKeyMoveReadyRuntimeCore();
        const trace: SkeletonKeyBehaviorTrace = {
            version: 1,
            evidenceCategory: 'independent',
            gameId: 'betrayal',
            chainId: sourceRun,
            sourceRun,
            sourceRevision,
            sourceFingerprint,
            status: 'RUNNING',
            outcome: 'Browser action chain is in progress.',
            requiredSteps: [
                'real-three-player-opening',
                'stage-legal-representative-state',
                'open-key-card-preview',
                'close-key-card-preview',
                'direct-target-click-and-settlement',
                'verify-follow-up-target',
            ],
            startedAt,
            representativeState: {
                fixtureFactory: 'createSkeletonKeyMoveReadyRuntimeCore',
                sourceFile: 'src/games/betrayal/testing/firstScenarioTestUtils.ts',
                fixtureExplorerId: fixture.currentExplorer.explorerId,
                fixturePlayerId: fixture.currentExplorer.playerId,
                fixtureRoomId: fixture.currentExplorer.roomId,
                fixtureCardIds: fixture.currentExplorer.inventory.map((item) => item.id),
                mode: 'representative-state',
                naturalAcquisition: false,
                injectedAfter: 'real three-player opening and natural turn-intro close',
                randomQueue: [0.9],
            },
            steps: [],
            uiStates: [],
            media: [],
        };
        persistSkeletonKeyBehaviorTrace(trace);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-skeleton-key-move');
        try {
            await page.setViewportSize({ width: 1600, height: 900 });
            await warmBetrayalFrontend(context);
            await page.goto('/play/betrayal?players=3&seat0=human&seat1=local-ai&seat2=local-ai&playerID=0');
            await waitForBetrayalPageReady(page);

            const openingBefore = await readSkeletonKeyObservation(page);
            const openingAction = '选择与代表态夹具相同的角色，真实确认三人剧本并继续；等待片头自然收口，不点击跳过。';
            trace.pendingAction = { id: 'real-three-player-opening', action: openingAction, before: openingBefore };
            persistSkeletonKeyBehaviorTrace(trace);
            await page.getByTestId('betrayal-character-selection-grid').getByTestId(`betrayal-character-card-${fixture.currentExplorer.explorerId}`).click();
            const confirm = page.getByTestId('betrayal-character-confirm');
            await confirm.click();
            await page.getByTestId('betrayal-character-scenario-button').click();
            await page.getByTestId('betrayal-scenario-option-mummy-rampage').click();
            await page.getByTestId('betrayal-scenario-select-current').click();
            const opening = page.getByTestId('betrayal-start-scenario-opening-stage');
            for (const label of [/确认此剧本卡/, /开始剧本/]) {
                await expect.poll(
                    async () => await opening.isVisible() || ((await confirm.isVisible()) && await confirm.isEnabled()),
                    { timeout: 30000 },
                ).toBe(true);
                if (await opening.isVisible()) break;
                if (label.test(await confirm.textContent() ?? '')) await confirm.click();
            }
            await expect(opening).toBeVisible({ timeout: 30000 });
            await page.getByTestId('betrayal-start-scenario-opening-continue').click();
            await expect(opening).toHaveCount(0);
            const intro = page.getByTestId('betrayal-turn-intro-skip');
            // The announcement auto-closes; `isVisible()` also matches its final fade frame,
            // when Playwright's stability wait can outlive the transient button itself.
            await expect(intro).toHaveCount(0, { timeout: 15000 });
            await expect(page.getByTestId('betrayal-board')).toHaveAttribute('data-betrayal-visual-busy', 'false');
            await expect.poll(() => readSkeletonKeyMoveState(page)).toMatchObject({
                scenarioId: 'first-scenario', proposedScenarioCardId: 'mummy-rampage',
                phase: 'preHaunt', playerIds: ['0', '1', '2'], currentPlayer: '0',
                playerId: fixture.currentExplorer.playerId, explorerId: fixture.currentExplorer.explorerId,
            });
            const openingAfter = await readSkeletonKeyObservation(page);
            recordSkeletonKeyTraceStep(trace, {
                id: 'real-three-player-opening',
                action: openingAction,
                before: openingBefore,
                after: openingAfter,
                assertions: [
                    skeletonKeyTraceAssertion('opening.playerIds', openingAfter.authoritative.playerIds, ['0', '1', '2']),
                    skeletonKeyTraceAssertion('opening.currentPlayer', openingAfter.authoritative.currentPlayer, '0'),
                    skeletonKeyTraceAssertion('opening.scenarioId', openingAfter.authoritative.scenarioId, 'first-scenario'),
                    skeletonKeyTraceAssertion('opening.proposedScenarioCardId', openingAfter.authoritative.proposedScenarioCardId, 'mummy-rampage'),
                    skeletonKeyTraceAssertion('opening.phase', openingAfter.authoritative.phase, 'preHaunt'),
                    skeletonKeyTraceAssertion('opening.fixtureExplorerSelected', openingAfter.authoritative.explorerId, fixture.currentExplorer.explorerId),
                    skeletonKeyTraceAssertion('opening.boardVisible', openingAfter.visible.boardVisible, true),
                    skeletonKeyTraceAssertion('opening.boardVisualBusy', openingAfter.visible.boardVisualBusy, 'false'),
                    skeletonKeyTraceAssertion('opening.cardOpeningClosed', openingAfter.visible.openingVisible, false),
                    skeletonKeyTraceAssertion('opening.turnIntroNaturallyClosed', openingAfter.visible.turnIntroCount, 0),
                ],
            });

            const fixtureBefore = await readSkeletonKeyObservation(page);
            const fixtureAction = '在真实开局与回合片头收口后，注入已有合法骨钥代表态夹具并设置正式随机队列为 0.9；此步骤不是自然取得物品。';
            trace.pendingAction = { id: 'stage-legal-representative-state', action: fixtureAction, before: fixtureBefore };
            persistSkeletonKeyBehaviorTrace(trace);
            await injectCore(page, fixture);
            await setHarnessRandomQueue(page, [0.9]);
            await waitForSkeletonKeyAtlas(page);
            await assertSkeletonKeyMoveReady(page);
            const fixtureAfter = await readSkeletonKeyObservation(page);
            recordSkeletonKeyTraceStep(trace, {
                id: 'stage-legal-representative-state',
                action: fixtureAction,
                before: fixtureBefore,
                after: fixtureAfter,
                assertions: [
                    skeletonKeyTraceAssertion('fixture.injectedAfterOpening', fixtureBefore.authoritative.phase, 'preHaunt'),
                    skeletonKeyTraceAssertion('fixture.currentPlayer', fixtureAfter.authoritative.currentPlayer, '0'),
                    skeletonKeyTraceAssertion('fixture.roomId', fixtureAfter.authoritative.currentRoomId, 'upper-landing'),
                    skeletonKeyTraceAssertion('fixture.inventoryIds', fixtureAfter.authoritative.inventoryIds, ['lockpick-tool']),
                    skeletonKeyTraceAssertion('fixture.movesRemaining', fixtureAfter.authoritative.movesRemaining, 2),
                    skeletonKeyTraceAssertion('fixture.targetDirect', fixtureAfter.visible.targetDirect, 'true'),
                    skeletonKeyTraceAssertion('fixture.targetMoveKind', fixtureAfter.visible.targetMoveKind, 'skeletonKey'),
                    skeletonKeyTraceAssertion('fixture.targetMoveCost', fixtureAfter.visible.targetMoveCost, '1'),
                ],
            });
            const readyPng = await saveScreenshot(page, SKELETON_KEY_READY_SCREENSHOT);
            recordSkeletonKeyUiMedia(trace, {
                path: SKELETON_KEY_READY_SCREENSHOT,
                id: 'skeleton-key-ready-board',
                stepId: 'stage-legal-representative-state',
                change: 'panel',
                viewport: 'desktop',
                bytes: readyPng,
                kind: 'image',
            });

            const previewBefore = await readSkeletonKeyObservation(page);
            const previewAction = '悬停骨制钥匙并点击放大按钮，打开完整卡面规则预览。';
            trace.pendingAction = { id: 'open-key-card-preview', action: previewAction, before: previewBefore };
            persistSkeletonKeyBehaviorTrace(trace);
            await page.getByTestId('betrayal-inventory-lockpick-tool').hover();
            await expect(page.getByTestId('betrayal-inventory-lockpick-tool-magnify')).toBeVisible();
            await page.getByTestId('betrayal-inventory-lockpick-tool-magnify').click();
            await expect(page.getByTestId('betrayal-inventory-preview-overlay')).toBeVisible();
            await expect.poll(() => page.getByTestId('betrayal-inventory-preview-card-front-atlas').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)).toBe(true);
            const previewAfter = await readSkeletonKeyObservation(page);
            recordSkeletonKeyTraceStep(trace, {
                id: 'open-key-card-preview',
                action: previewAction,
                before: previewBefore,
                after: previewAfter,
                assertions: [
                    skeletonKeyTraceAssertion('preview.open', previewAfter.visible.previewVisible, true),
                    skeletonKeyTraceAssertion('preview.cardAtlasLoaded', previewAfter.visible.previewCardLoaded, true),
                    skeletonKeyTraceAssertion('preview.currentRoomUnchanged', previewAfter.authoritative.currentRoomId, 'upper-landing'),
                    skeletonKeyTraceAssertion('preview.keyRetained', previewAfter.authoritative.inventoryIds, ['lockpick-tool']),
                ],
            });
            const cardPng = await saveScreenshot(page, SKELETON_KEY_CARD_SCREENSHOT);
            recordSkeletonKeyUiMedia(trace, {
                path: SKELETON_KEY_CARD_SCREENSHOT,
                id: 'skeleton-key-card-preview',
                stepId: 'open-key-card-preview',
                change: 'panel',
                viewport: 'desktop',
                bytes: cardPng,
                kind: 'image',
            });

            const closeBefore = await readSkeletonKeyObservation(page);
            const closeAction = '点击卡面预览关闭按钮并回到可操作牌桌，不执行额外游戏动作。';
            trace.pendingAction = { id: 'close-key-card-preview', action: closeAction, before: closeBefore };
            persistSkeletonKeyBehaviorTrace(trace);
            await page.getByTestId('betrayal-inventory-preview-overlay-close').click();
            await expect(page.getByTestId('betrayal-inventory-preview-overlay')).not.toBeVisible();
            await assertSkeletonKeyMoveReady(page);
            const closeAfter = await readSkeletonKeyObservation(page);
            recordSkeletonKeyTraceStep(trace, {
                id: 'close-key-card-preview',
                action: closeAction,
                before: closeBefore,
                after: closeAfter,
                assertions: [
                    skeletonKeyTraceAssertion('preview.closed', closeAfter.visible.previewVisible, false),
                    skeletonKeyTraceAssertion('preview.closeRoomUnchanged', closeAfter.authoritative.currentRoomId, 'upper-landing'),
                    skeletonKeyTraceAssertion('preview.closeKeyRetained', closeAfter.authoritative.inventoryIds, ['lockpick-tool']),
                    skeletonKeyTraceAssertion('preview.closeMovesUnchanged', closeAfter.authoritative.movesRemaining, 2),
                ],
            });

            const before = await readSkeletonKeyMoveState(page);
            const moveBefore = await readSkeletonKeyObservation(page);
            const moveAction = '直接点击地图上的图书馆房间 upper-west，使用骨制钥匙穿墙移动。';
            trace.pendingAction = { id: 'direct-target-click-and-settlement', action: moveAction, before: moveBefore };
            persistSkeletonKeyBehaviorTrace(trace);
            await page.getByTestId('betrayal-room-upper-west').click();
            await assertSkeletonKeySettled(page, before);
            const moveAfter = await readSkeletonKeyObservation(page);
            const freshMoves = moveAfter.authoritative.moves.filter((entry) => !before.moves.some((previous) => previous.id === entry.id));
            const movedPayload = freshMoves[0]?.event.payload ?? {};
            recordSkeletonKeyTraceStep(trace, {
                id: 'direct-target-click-and-settlement',
                action: moveAction,
                before: moveBefore,
                after: moveAfter,
                assertions: [
                    skeletonKeyTraceAssertion('move.sourceRoomBefore', before.currentRoomId, 'upper-landing'),
                    skeletonKeyTraceAssertion('move.sameCurrentPlayer', moveAfter.authoritative.currentPlayer, before.currentPlayer),
                    skeletonKeyTraceAssertion('move.samePlayerId', moveAfter.authoritative.playerId, before.playerId),
                    skeletonKeyTraceAssertion('move.sameExplorerId', moveAfter.authoritative.explorerId, before.explorerId),
                    skeletonKeyTraceAssertion('move.destinationRoom', moveAfter.authoritative.currentRoomId, 'upper-west'),
                    skeletonKeyTraceAssertion('move.activeRoom', moveAfter.authoritative.activeRoomId, 'upper-west'),
                    skeletonKeyTraceAssertion('move.remainingBefore', before.movesRemaining, 2),
                    skeletonKeyTraceAssertion('move.remainingAfter', moveAfter.authoritative.movesRemaining, 1),
                    skeletonKeyTraceAssertion('move.keyRetained', moveAfter.authoritative.inventoryIds, ['lockpick-tool']),
                    skeletonKeyTraceAssertion('move.eventCount', freshMoves.length, 1),
                    skeletonKeyTraceAssertion('move.eventType', freshMoves[0]?.event.type, 'EXPLORER_MOVED'),
                    skeletonKeyTraceAssertion('move.eventPlayerId', movedPayload.playerId, '0'),
                    skeletonKeyTraceAssertion('move.eventRoomId', movedPayload.roomId, 'upper-west'),
                    skeletonKeyTraceAssertion('move.eventCardId', movedPayload.skeletonKeyCardId, 'lockpick-tool'),
                    skeletonKeyTraceAssertion('move.eventRoll', movedPayload.skeletonKeyRoll, 2),
                    skeletonKeyTraceAssertion('move.eventNotBuried', movedPayload.skeletonKeyBuried, false),
                    skeletonKeyTraceAssertion('move.sourceRoomVacated', moveAfter.visible.sourceOccupantVisible, false),
                    skeletonKeyTraceAssertion('move.destinationPawnVisible', moveAfter.visible.destinationOccupantVisible, true),
                    skeletonKeyTraceAssertion('move.followUpTargetDirect', moveAfter.visible.followUpTargetDirect, 'true'),
                    skeletonKeyTraceAssertion('move.followUpTargetKind', moveAfter.visible.followUpTargetMoveKind, 'skeletonKey'),
                    skeletonKeyTraceAssertion('move.followUpTargetCost', moveAfter.visible.followUpTargetMoveCost, '1'),
                ],
            });
            const settledPng = await saveScreenshot(page, SKELETON_KEY_SETTLED_SCREENSHOT);
            recordSkeletonKeyUiMedia(trace, {
                path: SKELETON_KEY_SETTLED_SCREENSHOT,
                id: 'skeleton-key-settled-in-library',
                stepId: 'direct-target-click-and-settlement',
                change: 'layout',
                viewport: 'desktop',
                bytes: settledPng,
                kind: 'image',
            });

            const followUpBefore = await readSkeletonKeyObservation(page);
            const followUpAction = '核对剩余 1 点移动力下的后续合法目标，不点击目标、不改变状态。';
            trace.pendingAction = { id: 'verify-follow-up-target', action: followUpAction, before: followUpBefore };
            persistSkeletonKeyBehaviorTrace(trace);
            await expect(page.getByTestId('betrayal-room-upper-landing')).toHaveAttribute('data-direct-target', 'true');
            await expect(page.getByTestId('betrayal-room-upper-landing')).toHaveAttribute('data-move-kind', 'skeletonKey');
            await expect(page.getByTestId('betrayal-room-upper-landing')).toHaveAttribute('data-move-cost', '1');
            const followUpAfter = await readSkeletonKeyObservation(page);
            recordSkeletonKeyTraceStep(trace, {
                id: 'verify-follow-up-target',
                action: followUpAction,
                before: followUpBefore,
                after: followUpAfter,
                assertions: [
                    skeletonKeyTraceAssertion('followUp.movesRemaining', followUpAfter.authoritative.movesRemaining, 1),
                    skeletonKeyTraceAssertion('followUp.targetVisible', followUpAfter.visible.followUpTargetVisible, true),
                    skeletonKeyTraceAssertion('followUp.targetDirect', followUpAfter.visible.followUpTargetDirect, 'true'),
                    skeletonKeyTraceAssertion('followUp.targetKind', followUpAfter.visible.followUpTargetMoveKind, 'skeletonKey'),
                    skeletonKeyTraceAssertion('followUp.targetCost', followUpAfter.visible.followUpTargetMoveCost, '1'),
                    skeletonKeyTraceAssertion('followUp.previewClosed', followUpAfter.visible.previewVisible, false),
                ],
            });

            await assertNoFatalFrontendErrors([{ label: 'betrayal-skeleton-key-move', diagnostics }]);
            const recordedVideo = page.video();
            if (process.env.PW_RECORD_VIDEO === 'true' && !recordedVideo) {
                throw new Error('PW_RECORD_VIDEO=true 但 Playwright page 未提供本轮视频记录');
            }
            if (recordedVideo) {
                await context.close();
                const videoPath = await recordedVideo.path();
                const stagedVideoPath = resolveBetrayalEvidencePath(SKELETON_KEY_FULL_RUN_VIDEO);
                mkdirSync(dirname(stagedVideoPath), { recursive: true });
                copyFileSync(videoPath, stagedVideoPath);
                recordSkeletonKeyUiMedia(trace, {
                    path: SKELETON_KEY_FULL_RUN_VIDEO,
                    id: 'skeleton-key-continuous-wall-crossing-recording',
                    stepId: 'direct-target-click-and-settlement',
                    change: 'animation-phase',
                    viewport: 'desktop',
                    bytes: readFileSync(stagedVideoPath),
                    kind: 'video',
                });
            }
            trace.status = 'PASS';
            trace.outcome = 'The real three-player opening settled, the legal representative fixture was injected, the key preview was opened and closed, one direct wall-cross move rolled 2 and preserved the key, and a legal next target remained available.';
            trace.completedAt = new Date().toISOString();
            validateCompletedSkeletonKeyTrace(trace);
            persistSkeletonKeyBehaviorTrace(trace);
        } catch (error) {
            trace.status = 'FAIL';
            trace.outcome = 'The E2E behavior chain failed before all required steps completed.';
            trace.failure = error instanceof Error ? error.message : String(error);
            if (trace.pendingAction && !page.isClosed()) {
                try {
                    trace.pendingAction.after = await readSkeletonKeyObservation(page);
                } catch {
                    // Keep the recorded action and pre-state when the page can no longer be observed.
                }
            }
            trace.completedAt = new Date().toISOString();
            persistSkeletonKeyBehaviorTrace(trace);
            throw error;
        }
    });
});
