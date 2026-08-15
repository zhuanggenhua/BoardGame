import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { QidahenCore } from '../../src/games/qidahen/domain/types';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableAudio,
    disableTutorial,
    setChineseLocale,
} from '../helpers/common';

const BOARD_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-棋盘桌面当前.png';
const PREGAME_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-局内剧本直入-棋盘当前.png';
const MOBILE_LANDSCAPE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-手机横屏棋盘当前.png';
const MAP_VIEWPORT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-地图缩放拖拽/01-地图缩放拖拽后视口发生变化.png';
const BASIC_GUIDED_FLOW_DIR = 'test-results/evidence-screenshots/_shared/qidahen-剧本基础流程';
const ACTION_WINDOW_FLOW_DIR = 'test-results/evidence-screenshots/_shared/qidahen-行动窗口流程';
const WHEEL_FLOW_DIR = 'test-results/evidence-screenshots/_shared/qidahen-轮盘结算流程';
const COMMAND_BATTLE_FLOW_DIR = 'test-results/evidence-screenshots/_shared/qidahen-指挥进攻掷骰流程';
const YEAR_FLOW_DIR = 'test-results/evidence-screenshots/_shared/qidahen-年序结算流程';
const BASIC_GUIDED_FLOW_PREGAME_BEFORE = `${BASIC_GUIDED_FLOW_DIR}/01-教程直入-载入后进入棋盘.png`;
const BASIC_GUIDED_FLOW_BOARD_AFTER_CONFIRM = `${BASIC_GUIDED_FLOW_DIR}/02-教程直入-行动窗口初始状态.png`;
const BASIC_GUIDED_FLOW_BEFORE_ACTION_CLICK = `${BASIC_GUIDED_FLOW_DIR}/03-行动窗口-选择赐印招安目标后出现支付.png`;
const BASIC_GUIDED_FLOW_AFTER_ACTION_CONFIRM = `${BASIC_GUIDED_FLOW_DIR}/04-赐印招安-支付后进入轮盘推进.png`;
const BASIC_GUIDED_FLOW_BEFORE_DISPATCH_RESOLVE = `${BASIC_GUIDED_FLOW_DIR}/05-赐印招安-轮盘推进可选免费走1.png`;
const BASIC_GUIDED_FLOW_AFTER_DISPATCH_RESOLVED = `${BASIC_GUIDED_FLOW_DIR}/06-赐印招安-免费走1后切到蒙古行动窗口.png`;
const ACTION_PAYMENT_DISCARD_SELECTION_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-势力行动弃牌选择/01-征召军队-弃牌选择交互.png';
const ACTION_FLOW_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/01-行动窗口-赐印招安结算后地图与面板.png`;
const SEASON_FLOW_SCREENSHOT = `${YEAR_FLOW_DIR}/03-新年结算-跨年后摘要与防线状态.png`;
const MIDYEAR_DEFEAT_MARKERS_SCREENSHOT = `${YEAR_FLOW_DIR}/01-年中结算-战败标记与人物判定.png`;
const FORTIFICATION_MAINTENANCE_SCREENSHOT = `${YEAR_FLOW_DIR}/02-新年结算-防线维护与耗损选择.png`;
const MOVEMENT_PREVIEW_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/02-棋盘布局-地图点击后移动预览.png`;
const WHEEL_HIGHLIGHT_SCREENSHOT = `${COMMAND_BATTLE_FLOW_DIR}/00-轮盘高亮-选中所有对手抽2走3.png`;
const WHEEL_DISPATCH_SELECTION_SCREENSHOT = `${WHEEL_FLOW_DIR}/01-轮盘进攻调度-待结算目标选择.png`;
const WHEEL_DISPATCH_SCREENSHOT = `${WHEEL_FLOW_DIR}/02-轮盘进攻调度-调度路径预览.png`;
const WHEEL_DISPATCH_SIEGE_REINFORCE_SCREENSHOT = `${WHEEL_FLOW_DIR}/03-轮盘调度-围城区域增援完成.png`;
const POST_BATTLE_SCREENSHOT = `${WHEEL_FLOW_DIR}/04-轮盘进攻调度-战后占领选择.png`;
const POST_BATTLE_BESIEGE_SCREENSHOT = `${WHEEL_FLOW_DIR}/05-城战突破后-围城选择.png`;
const DEFEAT_MARKER_SCREENSHOT = `${WHEEL_FLOW_DIR}/06-野战战败后-战败标记显示.png`;
const POST_BATTLE_PLUNDER_SCREENSHOT = `${WHEEL_FLOW_DIR}/07-战后处理-劫掠人口并显示抽牌收益.png`;
const LOW_CASUALTY_SCREENSHOT = `${WHEEL_FLOW_DIR}/08-结构化战斗-低级承伤选择.png`;
const COMMITTED_TROOPS_SCREENSHOT = `${WHEEL_FLOW_DIR}/09-待结算面板-投入兵力数量选择.png`;
const CAVALRY_PLUNDER_SCREENSHOT = `${WHEEL_FLOW_DIR}/11-攻方骑兵-劫掠守方牌堆选择.png`;
const CAVALRY_EVASION_SCREENSHOT = `${WHEEL_FLOW_DIR}/12-守方骑兵-避战目标选择.png`;
const COMMAND_FLOW_SELECTION_SCREENSHOT = `${COMMAND_BATTLE_FLOW_DIR}/01-指挥部队-全部绿色目标与箭头高亮.png`;
const ATTACK_FLOW_PENDING_SCREENSHOT = `${COMMAND_BATTLE_FLOW_DIR}/02-进攻待结算-显示目标与投入兵力.png`;
const BATTLE_ROLL_DICE_SCREENSHOT = `${COMMAND_BATTLE_FLOW_DIR}/04-战斗掷骰-骰面与战后处理.png`;
const INTERNAL_DISPATCH_DIRECT_BEFORE_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/05-王化贞调度-绿色目标可直接点击.png`;
const INTERNAL_DISPATCH_DIRECT_AFTER_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/06-王化贞调度-地图直点后完成调度.png`;
const GAO_DI_DISPATCH_DIRECT_BEFORE_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/07-高第调度-选牌后绿色目标可直接点击.png`;
const GAO_DI_DISPATCH_DIRECT_AFTER_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/08-高第调度-地图直点后完成调度.png`;
const ACTION_TOOLTIP_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/09-行动按钮-悬浮显示功能提示.png`;
const FACTION_DECK_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/03-行动窗口-突袭结算后进入下一势力行动.png`;
const FACTION_HAND_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/04-行动窗口-赐印招安后大明手牌变化.png`;
const HAND_LIMIT_DISCARD_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-手牌超限弃牌/01-新势力行动窗口-手牌超限弃牌选择.png';
const WHEEL_RECRUIT_TRAIN_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-轮盘征兵训练/01-轮盘征兵训练-当前区域完成加兵.png';
const WHEEL_HIRE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-轮盘外交雇佣/01-轮盘外交雇佣-只结算雇佣后地图结果.png';
const DIPLOMACY_THREE_TARGET_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-外交雇佣连续目标/01-外交雇佣-连续处理三个目标后自动完成.png';
const RECRUIT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-征召军队/01-征召军队-选择常规建军后地图结果.png';
const RECRUIT_CHUANBING_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-征召军队/02-征召军队-选择川兵后地图提示.png';
const MA_SHI_TRADE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-马市贸易/01-马市贸易-建军选择后蒙古获得摸牌.png';
const DRIVE_TIGER_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-驱虎吞狼/01-驱虎吞狼-目标同意后进入指挥调度.png';
const KHAN_EDICT_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-大汗令箭/01-大汗令箭-选择征兵训练后进入轮盘推进.png';
const KHAN_EDICT_HIRE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-大汗令箭/02-大汗令箭-选择外交雇佣后进入轮盘推进.png';
const MARRIAGE_SUBJUGATION_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-联姻诱降/01-联姻诱降-失败后进入轮盘推进.png';
const MAP_REGION_POINTS = {
    jinzhou: { x: 0.4957, y: 0.5342 },
    dongjiang: { x: 0.6859, y: 0.7815 },
    liaoxi: { x: 0.5613, y: 0.4367 },
    ningyuan: { x: 0.3123, y: 0.6137 },
    songjin: { x: 0.6522, y: 0.5913 },
    shanhaiguan: { x: 0.4292, y: 0.6181 },
    region15: { x: 0.7051, y: 0.4278 },
} as const;
const PLAYER_ID_TO_FACTION = {
    '0': 'ming',
    '1': 'mongol',
    '2': 'jin',
} as const;
const FORMAL_REGION_COUNT = 34;
const FORMAL_PASSAGE_COUNT = 77;

type RegionMaskDebugSnapshot = {
    workspaceKey: string;
    isIsolatedWorkspace: boolean;
    dataOutputDir: string;
    persistedWorkspaceState: 'empty' | 'populated';
    selectedRegionId: string | null;
    selectedRegionName: string | null;
    statusMessage: string;
    graphNodeCount: number;
    graphNodeIds: string[];
    passageCount: number;
    effectiveGeneratedRegionCount: number;
    boundaryDraftPixelCount: number;
    barrierPixelCount: number;
    formalRegionSaveBlocked: boolean;
    boundaryQuality: {
        state: string;
        label: string;
        generatedCount: number;
        formalRegionCount: number;
        normalityState: string;
        normalityLabel: string;
        approvedCount: number;
        requiredApprovalCount: number;
    };
};

type QidahenHarnessState = {
    core: QidahenCore;
    sys?: {
        interaction?: {
            current?: unknown;
            queue?: unknown[];
            isBlocked?: boolean;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

type QidahenHarnessWindow = Window & {
    __E2E_TEST_MODE__?: boolean;
    __QIDAHEN_REGION_MASK_DEBUG__?: RegionMaskDebugSnapshot;
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => QidahenHarnessState;
            set?: (state: QidahenHarnessState) => Promise<void> | void;
            isRegistered?: () => boolean;
        };
        command?: {
            dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void> | void;
        };
    };
};

const saveScreenshot = async (page: import('@playwright/test').Page, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            await page.screenshot({ path, fullPage: false });
            return;
        } catch (error) {
            const isCaptureScreenshotProtocolError = error instanceof Error
                && error.message.includes('Page.captureScreenshot');
            if (!isCaptureScreenshotProtocolError || attempt === 1) {
                throw error;
            }
            await page.waitForTimeout(250);
        }
    }
};

const waitForAtlasFrames = async (page: import('@playwright/test').Page, selector: string) => {
    await page.waitForFunction((frameSelector) => {
        const frames = Array.from(document.querySelectorAll<HTMLElement>(frameSelector));
        return frames.length > 0 && frames.every((frame) => {
            const style = window.getComputedStyle(frame);
            const image = frame.querySelector('img');
            if (image) {
                return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
            }
            return style.backgroundImage !== 'none'
                && !frame.className.includes('atlas-shimmer');
        });
    }, selector, { timeout: 15000 });
};

const waitForImage = async (page: import('@playwright/test').Page, selector: string) => {
    await page.waitForFunction((imageSelector) => {
        const image = document.querySelector<HTMLImageElement>(imageSelector);
        return image != null && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    }, selector, { timeout: 15000 });
};

const readRegionMaskDebugSnapshot = async (page: import('@playwright/test').Page): Promise<RegionMaskDebugSnapshot> => (
    page.evaluate(() => {
        const snapshot = (window as QidahenHarnessWindow).__QIDAHEN_REGION_MASK_DEBUG__;
        if (!snapshot) {
            throw new Error('missing window.__QIDAHEN_REGION_MASK_DEBUG__');
        }
        return snapshot;
    })
);

const readRequiredQidahenHarnessState = async (page: Page): Promise<QidahenHarnessState> => (
    page.evaluate(() => {
        const state = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.() ?? null;
        if (!state) {
            throw new Error('qidahen test harness state reader unavailable');
        }
        return state;
    })
);

const expectMapArmyFace = async (
    page: Page,
    {
        faction,
        regionId,
        face,
        minimum = 1,
    }: {
        faction: 'ming' | 'mongol' | 'jin' | 'neutral';
        regionId: string;
        face: 'front' | 'hidden-back';
        minimum?: number;
    },
) => {
    const tokens = page.locator(
        `[data-testid^="qidahen-map-token-"][data-qidahen-map-token-type="army"][data-qidahen-map-token-faction="${faction}"][data-qidahen-map-token-region="${regionId}"]`,
    );
    await expect.poll(async () => tokens.count()).toBeGreaterThanOrEqual(minimum);
    const tokenCount = await tokens.count();
    for (let index = 0; index < tokenCount; index += 1) {
        await expect(tokens.nth(index)).toHaveAttribute('data-qidahen-army-face', face);
    }
};

const QIDAHEN_BASIC_OPENING_TEST_URL = '/play/qidahen?tutorialSetup=basic-opening&players=3&seat0=human&seat1=human&seat2=human&playerID=0';
const QIDAHEN_WATER_DISPATCH_TEST_URL = '/play/qidahen?tutorialSetup=water-dispatch&players=3&seat0=human&seat1=human&seat2=human&playerID=0';

const clickMapRegion = async (page: import('@playwright/test').Page, regionId: keyof typeof MAP_REGION_POINTS) => {
    const point = MAP_REGION_POINTS[regionId];
    const canvas = page.getByTestId('qidahen-map-hitmap-canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await canvas.evaluate((element, targetPoint) => {
        const rect = element.getBoundingClientRect();
        const init: PointerEventInit = {
            clientX: rect.left + rect.width * targetPoint.x,
            clientY: rect.top + rect.height * targetPoint.y,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
        };
        element.dispatchEvent(new PointerEvent('pointermove', init));
        element.dispatchEvent(new PointerEvent('pointerdown', init));
        element.dispatchEvent(new PointerEvent('pointerup', {
            ...init,
            buttons: 0,
        }));
    }, point);
};

const clickGuidedMapTarget = async (
    page: import('@playwright/test').Page,
    targetRegionId: string,
) => {
    const guideHitTarget = page.locator(`[data-testid="qidahen-map-guide-hit-target-${targetRegionId}"]`);
    if (await guideHitTarget.count()) {
        await guideHitTarget.click();
        return;
    }
    await page.evaluate((guidedTargetRegionId) => {
        const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="qidahen-map-hitmap-canvas"]');
        const routeGroup = document.querySelector<SVGGElement>(`[data-testid="qidahen-map-guide-route-${guidedTargetRegionId}"]`);
        const overlay = document.querySelector<SVGSVGElement>('[data-testid="qidahen-map-overlay"]');
        if (!canvas || !routeGroup || !overlay) {
            throw new Error(`missing guided map target for ${guidedTargetRegionId}`);
        }
        const targetX = Number(routeGroup.dataset.guideTargetX);
        const targetY = Number(routeGroup.dataset.guideTargetY);
        if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
            throw new Error(`invalid guided map target point for ${guidedTargetRegionId}`);
        }
        const svgPoint = overlay.createSVGPoint();
        svgPoint.x = targetX;
        svgPoint.y = targetY;
        const screenPoint = svgPoint.matrixTransform(overlay.getScreenCTM()!);
        const clientX = screenPoint.x;
        const clientY = screenPoint.y;
        const init: PointerEventInit = {
            clientX,
            clientY,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
        };
        canvas.dispatchEvent(new PointerEvent('pointermove', init));
        canvas.dispatchEvent(new PointerEvent('pointerdown', init));
        canvas.dispatchEvent(new PointerEvent('pointerleave', init));
    }, targetRegionId);
};

const clickQidahenHandCardVisibleZone = async (
    page: import('@playwright/test').Page,
    index: number,
) => {
    const locator = page.locator('[data-testid^="qidahen-hand-card-"]:not([data-testid^="qidahen-hand-card-kind-"])').nth(index);
    await locator.evaluate((element) => {
        if (!(element instanceof HTMLElement)) {
            throw new Error('qidahen hand card is not an HTMLElement');
        }
        element.click();
    });
};

const dispatchHarnessCommand = async (
    page: import('@playwright/test').Page,
    command: { type: string; playerId: string; payload: Record<string, unknown> },
) => {
    await page.evaluate((nextCommand) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                command?: {
                    dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void> | void;
                };
            };
        }).__BG_TEST_HARNESS__;
        return harness?.command?.dispatch(nextCommand);
    }, command);
};

const previewActionPayment = async (
    page: import('@playwright/test').Page,
    actionLabel: string | RegExp,
) => {
    const button = page.getByRole('button', { name: actionLabel });
    await button.click();
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeDisabled();
};

const selectActionPaymentCards = async (
    page: import('@playwright/test').Page,
    count: number,
) => {
    const harnessState = await readRequiredQidahenHarnessState(page);
    const currentPlayerId = harnessState.core.currentPlayer as keyof typeof PLAYER_ID_TO_FACTION;
    const currentFaction = PLAYER_ID_TO_FACTION[currentPlayerId];
    const handCards = page.locator('[data-testid^="qidahen-hand-card-"]:not([data-testid^="qidahen-hand-card-kind-"])');
    const visibleCardIds = await handCards.evaluateAll((elements) => (
        elements
            .map((element) => element.getAttribute('data-testid'))
            .filter((testId): testId is string => Boolean(testId))
            .map((testId) => testId.replace('qidahen-hand-card-', ''))
    ));
    const visibleCurrentPlayerCardIds = visibleCardIds.filter((cardId) => (
        harnessState.core.handCards.some((card) => card.id === cardId && card.faction === currentFaction)
    ));
    if (visibleCurrentPlayerCardIds.length >= count) {
        for (let selectedCount = 1; selectedCount <= count; selectedCount += 1) {
            await clickQidahenHandCardVisibleZone(page, selectedCount - 1);
            await expect(page.locator('[data-testid="qidahen-action-payment-status"]')).toContainText(`已选 ${selectedCount} 张`);
        }
        return;
    }

    const fallbackCardIds = harnessState.core.handCards
        .filter((card) => card.faction === currentFaction)
        .slice(-count)
        .map((card) => card.id)
        .reverse();
    for (let selectedCount = 1; selectedCount <= count; selectedCount += 1) {
        await dispatchHarnessCommand(page, {
            type: 'SELECT_PAYMENT_CARD',
            playerId: currentPlayerId,
            payload: { cardId: fallbackCardIds[selectedCount - 1] },
        });
        await expect(page.locator('[data-testid="qidahen-action-payment-status"]')).toContainText(`已选 ${selectedCount} 张`);
    }
};

const confirmActionPayment = async (
    page: import('@playwright/test').Page,
    count?: number,
) => {
    const requiredCount = count ?? await page.locator('[data-testid="qidahen-action-payment-status"]').evaluate((element) => {
        const text = element.textContent ?? '';
        const match = text.match(/需弃\s*(\d+)\s*张/);
        if (!match) {
            throw new Error(`无法从支付面板读取成本：${text}`);
        }
        return Number(match[1]);
    });
    await selectActionPaymentCards(page, requiredCount);
    await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
    await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();
    await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toHaveCount(0);
};

const previewAndConfirmActionPayment = async (
    page: import('@playwright/test').Page,
    actionLabel: string | RegExp,
    count = 1,
) => {
    await previewActionPayment(page, actionLabel);
    await confirmActionPayment(page, count);
};

const selectPendingCommittedTroopsIfPresent = async (
    page: import('@playwright/test').Page,
    committedTroops?: number,
) => {
    const committedPanel = page.locator('[data-testid="qidahen-pending-committed-troops"]');
    if (await committedPanel.count() === 0) {
        return;
    }

    const resolvedCommittedTroops = committedTroops ?? await page.evaluate(() => (
        (window as QidahenHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.()?.core?.pendingTargetAction?.committedTroops
            ?? null
    ));
    if (typeof resolvedCommittedTroops !== 'number') {
        return;
    }

    const mapToken = page.locator(`[data-pending-committed-selectable="true"][data-pending-committed-index="${resolvedCommittedTroops}"]`).first();
    if (await mapToken.count() === 0) {
        return;
    }
    await mapToken.click();
    await expect(mapToken).toHaveAttribute('data-pending-committed-selected', 'true');
};

const resolvePendingActionByCommand = async (
    page: import('@playwright/test').Page,
    payload: Record<string, unknown>,
) => {
    const playerId = await page.evaluate(() => (
        (window as QidahenHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.()?.core?.currentPlayer
            ?? '0'
    ));
    await dispatchHarnessCommand(page, {
        type: 'RESOLVE_PENDING_ACTION',
        playerId,
        payload,
    });
};

const seedRegionCavalry = async (
    page: import('@playwright/test').Page,
    regionId: string,
    faction: 'ming' | 'mongol' | 'jin',
    count: number,
    level = 1,
) => {
    await page.waitForFunction(() => (window as Window & {
        __BG_TEST_HARNESS__?: {
            state?: { isRegistered?: () => boolean };
        };
    }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
    await page.evaluate(({ regionId: targetRegionId, faction: targetFaction, count: troopCount, level: troopLevel }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get: () => { core: { regions: Array<Record<string, unknown>> } } | null;
                    set: (state: unknown) => Promise<void> | void;
                };
            };
        }).__BG_TEST_HARNESS__;
        const snapshot = harness?.state?.get();
        if (!snapshot || !harness?.state?.set) {
            throw new Error('qidahen test harness state injector unavailable');
        }
        const factionLabel = targetFaction === 'ming' ? '大明' : targetFaction === 'mongol' ? '蒙古' : '后金';
        const next = structuredClone(snapshot);
        next.core.regions = next.core.regions.map((region: Record<string, unknown>) => (
            region.id === targetRegionId
                ? {
                    ...region,
                    controller: targetFaction,
                    controlLabel: factionLabel,
                    troops: troopCount,
                    specialTroops: [
                        {
                            id: `${targetFaction}-${targetRegionId}-cavalry-lv${troopLevel}`,
                            label: `${factionLabel}骑兵`,
                            faction: targetFaction,
                            troopKind: 'cavalry',
                            count: troopCount,
                            level: troopLevel,
                        },
                    ],
                }
                : region
        ));
        return harness.state.set(next);
    }, { regionId, faction, count, level });
};

test.describe('七大恨 Board 地图交互与 HUD 布局', () => {
    test('教程直入时直接进入局内棋盘，不再弹单独前置页', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-scenario-pregame-screen"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-scenario-panel"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-action-wheel"]')).toBeVisible();
        await expectMapArmyFace(page, { faction: 'ming', regionId: 'city-region-25', face: 'front' });
        await expectMapArmyFace(page, { faction: 'jin', regionId: 'city-region-13', face: 'hidden-back' });
        await saveScreenshot(page, PREGAME_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-pregame-gate', diagnostics }]);
    });

    test('教程直入行动窗口，点赐印招安后先弃牌支付，再场景直选目标并进入轮盘推进提示', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-scenario-pregame-screen"]')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
        await saveScreenshot(page, BASIC_GUIDED_FLOW_PREGAME_BEFORE);

        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('行动窗口');
        await expect(page.locator('[data-testid="qidahen-top-action-banner"]')).toContainText('手牌行动');
        await expect(page.locator('[data-testid="qidahen-action-grant-pardon"]')).toBeEnabled();
        await saveScreenshot(page, BASIC_GUIDED_FLOW_BOARD_AFTER_CONFIRM);

        const grantPardonButton = page.locator('[data-testid="qidahen-action-grant-pardon"]');
        const grantPardonDetail = await grantPardonButton.getAttribute('title');
        expect(grantPardonDetail).toBeTruthy();
        await grantPardonButton.hover();
        await expect(page.locator('[data-testid="qidahen-action-tooltip-grant-pardon"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-tooltip-grant-pardon"]')).toContainText(grantPardonDetail ?? '');
        await saveScreenshot(page, ACTION_TOOLTIP_SCREENSHOT);

        await page.getByRole('button', { name: /赐印招安/ }).click();
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-payment-status"]')).toContainText('需弃 3 张');
        await saveScreenshot(page, BASIC_GUIDED_FLOW_BEFORE_ACTION_CLICK);

        await confirmActionPayment(page, 3);
        await expect(page.locator('[data-testid="qidahen-grant-pardon-selection"]')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-grant-pardon-choice-"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-25"][data-grant-pardon-map-choice="jinzhou->city-region-25"]')).toBeVisible();
        await clickGuidedMapTarget(page, 'city-region-25');
        await expect(page.locator('[data-testid="qidahen-internal-dispatch-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('轮盘行动');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('公共轮盘推进');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择推进几格');
        await saveScreenshot(page, BASIC_GUIDED_FLOW_AFTER_ACTION_CONFIRM);
        await saveScreenshot(page, BASIC_GUIDED_FLOW_BEFORE_DISPATCH_RESOLVE);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await saveScreenshot(page, BASIC_GUIDED_FLOW_AFTER_DISPATCH_RESOLVED);

        const finalState = await readRequiredQidahenHarnessState(page);
        expect(finalState.core.currentPlayer).toBe('1');
        assertNoFatalFrontendErrors([{ label: 'qidahen-basic-guided-flow', diagnostics }]);
    });

    test('桌面端显示真实地图并保持轮盘/手牌/牌堆布局', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-hitmap-canvas"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-region-mask-overlay"]')).toBeVisible();
        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-armaments-ming"]')).toContainText('火炮技术1');
        await expect(page.locator('[data-testid="qidahen-armaments-mongol"]')).toContainText('骑兵铁甲1');
        await expect(page.locator('[data-testid="qidahen-armaments-jin"]')).toContainText('步兵铁甲1');
        await expect(page.locator('[data-testid="qidahen-action-wheel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-layer"] [data-testid="qidahen-action-wheel"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-sector"]')).toHaveCount(8);
        await expect(page.locator('[data-testid="qidahen-chronology-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-year-card-slot-"]')).toHaveCount(2);
        await expect(page.locator('[data-testid="qidahen-chronology-deck"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-actions-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('大明抽牌');
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('20');
        await expect(page.locator('[data-testid="qidahen-hand-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-hand-card-"]:not([data-testid^="qidahen-hand-card-kind-"]):not([data-testid^="qidahen-hand-card-magnify-"])')).toHaveCount(4);
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('大明弃牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('7');
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        const initialState = await readRequiredQidahenHarnessState(page);
        const initialSongJin = initialState.core.regions.find((region) => region.id === 'song-jin');
        const initialMingHandCards = initialState.core.handCards.filter((card) => card.faction === 'ming');
        expect(initialState.core.currentPlayer).toBe('0');
        expect(initialState.core.turnPhase).toBe('action-window');
        expect(initialState.core.selectedRegionId).toBe('song-jin');
        expect(initialMingHandCards).toHaveLength(4);
        expect(initialSongJin?.troops).toBe(2);

        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"] svg')).toBeVisible();
        for (const wheelLabel of ['开垦', '军屯', '征兵', '训练', '外交', '雇佣', '进攻', '调度', '新年', '年中']) {
            await expect(page.locator('[data-testid="qidahen-action-wheel-asset"]')).toContainText(wheelLabel);
        }

        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);

        const drawBox = await page.locator('[data-testid="qidahen-draw-pile"]').boundingBox();
        const handBox = await page.locator('[data-testid="qidahen-hand-zone"]').boundingBox();
        const discardBox = await page.locator('[data-testid="qidahen-discard-pile"]').boundingBox();
        const stageBox = await page.locator('[data-testid="qidahen-desktop-stage"]').boundingBox();
        const mapLayerBox = await page.locator('[data-testid="qidahen-map-layer"]').boundingBox();
        const actionDockBox = await page.locator('[data-testid="qidahen-actions-zone"]').boundingBox();
        const actionSlotBox = await page.locator('[data-testid="qidahen-action-slot"]').boundingBox();
        const tipBox = await page.locator('[data-testid="qidahen-map-region-tip"]').boundingBox();
        const wheelTip = page.locator('[data-testid="qidahen-wheel-tip"]');
        const actionBox = await page.locator('[data-testid="qidahen-action-raid"]').boundingBox();
        expect(drawBox).not.toBeNull();
        expect(handBox).not.toBeNull();
        expect(discardBox).not.toBeNull();
        expect(stageBox).not.toBeNull();
        expect(mapLayerBox).not.toBeNull();
        expect(actionDockBox).not.toBeNull();
        expect(actionSlotBox).not.toBeNull();
        expect(tipBox).not.toBeNull();
        expect(actionBox).not.toBeNull();
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-layout', 'full-bleed-cover');
        expect(Math.abs((mapLayerBox?.width ?? 0) - (stageBox?.width ?? 0))).toBeLessThan(4);
        expect(Math.abs((mapLayerBox?.height ?? 0) - (stageBox?.height ?? 0))).toBeLessThan(4);
        expect(actionBox?.width ?? 9999).toBeLessThan(180);
        expect(drawBox?.x ?? 9999).toBeLessThan(220);
        expect(drawBox?.y ?? 0).toBeGreaterThan(840);
        expect(discardBox?.x ?? 0).toBeGreaterThan(1680);
        expect(discardBox?.y ?? 0).toBeGreaterThan(840);
        expect(handBox?.width ?? 0).toBeGreaterThan(900);
        expect(Math.abs(((handBox?.x ?? 0) + (handBox?.width ?? 0) / 2) - 960)).toBeLessThan(90);
        expect(actionDockBox?.width ?? 0).toBeGreaterThan(400);
        expect((tipBox?.x ?? 0) + (tipBox?.width ?? 0)).toBeLessThanOrEqual((actionDockBox?.x ?? 9999) - 12);
        await expect(page.locator('[data-testid="qidahen-wheel-step-controls"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toHaveCount(0);
        const actionRailBoxBefore = await page.locator('[data-testid="qidahen-action-rail"]').boundingBox();
        expect(actionRailBoxBefore).not.toBeNull();
        await previewActionPayment(page, /突袭作战/);
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-hand-interaction-tray"]')).toBeVisible();
        const actionRailBoxAfter = await page.locator('[data-testid="qidahen-action-rail"]').boundingBox();
        const paymentPanelBox = await page.locator('[data-testid="qidahen-action-payment-panel"]').boundingBox();
        const handInteractionTrayBox = await page.locator('[data-testid="qidahen-hand-interaction-tray"]').boundingBox();
        expect(actionRailBoxAfter).not.toBeNull();
        expect(paymentPanelBox).not.toBeNull();
        expect(handInteractionTrayBox).not.toBeNull();
        expect(Math.abs((actionRailBoxAfter?.x ?? 0) - (actionRailBoxBefore?.x ?? 0))).toBeLessThan(2);
        expect(Math.abs((actionRailBoxAfter?.y ?? 0) - (actionRailBoxBefore?.y ?? 0))).toBeLessThan(2);
        expect(Math.abs(((paymentPanelBox?.x ?? 0) + (paymentPanelBox?.width ?? 0) / 2) - ((handBox?.x ?? 0) + (handBox?.width ?? 0) / 2))).toBeLessThan(60);
        expect((paymentPanelBox?.y ?? 9999) + (paymentPanelBox?.height ?? 0)).toBeLessThanOrEqual((handBox?.y ?? 9999) - 8);
        await page.locator('[data-testid="qidahen-action-payment-cancel"]').click();
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toHaveCount(0);
        await clickMapRegion(page, 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('锦州 · 后金');
        await expect(wheelTip).toBeHidden();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').hover();
        await expect(wheelTip).toBeVisible();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').hover();
        await expect(wheelTip).toContainText('所有对手抽 2，走 3');

        await saveScreenshot(page, BOARD_SCREENSHOT);
        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-movement-preview"]')).toContainText('调度可达');
        await saveScreenshot(page, MOVEMENT_PREVIEW_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-map-hud-desktop', diagnostics }]);
    });

    test('地图缩放拖拽与复位控件会改变真实视口并可恢复默认值', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        const mapLayer = page.locator('[data-testid="qidahen-map-layer"]');
        const mapCanvas = page.locator('[data-testid="qidahen-map-hitmap-canvas"]');
        await expect(mapLayer).toBeVisible({ timeout: 30000 });
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        await expect(mapLayer).toHaveAttribute('data-map-zoom', '1');
        await expect(mapLayer).toHaveAttribute('data-map-pan-x', '0');
        await expect(mapLayer).toHaveAttribute('data-map-pan-y', '0');

        await page.getByTestId('qidahen-map-zoom-in').click();
        const zoomAfterIn = Number(await mapLayer.getAttribute('data-map-zoom'));
        expect(zoomAfterIn).toBeGreaterThan(1);

        const canvasBox = await mapCanvas.boundingBox();
        expect(canvasBox).not.toBeNull();
        if (!canvasBox) {
            throw new Error('qidahen map hit canvas bounding box missing');
        }
        await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(canvasBox.x + canvasBox.width * 0.5 + 120, canvasBox.y + canvasBox.height * 0.5 + 60, { steps: 8 });
        await page.mouse.up();

        const panXAfterDrag = Number(await mapLayer.getAttribute('data-map-pan-x'));
        const panYAfterDrag = Number(await mapLayer.getAttribute('data-map-pan-y'));
        expect(Math.abs(panXAfterDrag) + Math.abs(panYAfterDrag)).toBeGreaterThan(0);
        await saveScreenshot(page, MAP_VIEWPORT_SCREENSHOT);

        await page.getByTestId('qidahen-map-zoom-reset').click();
        await expect(mapLayer).toHaveAttribute('data-map-zoom', '1');
        await expect(mapLayer).toHaveAttribute('data-map-pan-x', '0');
        await expect(mapLayer).toHaveAttribute('data-map-pan-y', '0');
    });

    test('赐印招安结算后仍会回到真实 Board 场景并更新地图结果', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"] svg')).toBeVisible();
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').hover();
        await expect(page.locator('[data-testid="qidahen-wheel-tip"]')).toContainText('一名对手抽 2，走 2');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').hover();
        await expect(page.locator('[data-testid="qidahen-wheel-tip"]')).toContainText('所有对手抽 2，走 3');
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('6/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('10/10');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('8/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('12/10');

        await clickMapRegion(page, 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('锦州 · 后金');
        await dispatchHarnessCommand(page, {
            type: 'EXECUTE_ACTION',
            playerId: '0',
            payload: { actionId: 'grant-pardon' },
        });
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('0/15');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('大明抽牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('大明弃牌');
        await expect(page.locator('[data-testid="qidahen-hand-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-14');
        const finalState = await readRequiredQidahenHarnessState(page);
        const shanhaiguan = finalState.core.regions.find((region) => region.id === 'city-region-25');
        expect(finalState.core.currentPlayer).toBe('1');
        expect(finalState.core.turnPhase).toBe('action-window');
        expect(finalState.core.selectedRegionId).toBe('city-region-14');
        expect(shanhaiguan?.controller).toBe('ming');
        expect(shanhaiguan?.troops).toBe(3);
        await clickMapRegion(page, 'shanhaiguan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 3');

        await saveScreenshot(page, FACTION_HAND_SCREENSHOT);
        await saveScreenshot(page, ACTION_FLOW_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-map-action-flow', diagnostics }]);
    });

    test('进入新势力行动窗口时可手动选择超限弃牌', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
            const state = harness?.state;
            const snapshot = state?.get?.();
            if (!snapshot || !state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            const mongolCards = next.core.handCards.filter((card) => card.faction === 'mongol');
            const extraCards = Array.from({ length: 6 }, (_, index) => ({
                ...mongolCards[index % mongolCards.length],
                id: `mongol-over-limit-e2e-${index + 1}`,
                label: `蒙古超限手牌 ${index + 1}`,
                status: 'payable',
            }));
            next.core.factions.mongol.handCount = 12;
            next.core.factions.mongol.discardPileCount = 1;
            next.core.handCards = [...next.core.handCards, ...extraCards];
            return state.set(next);
        });

        await previewAndConfirmActionPayment(page, /征召军队/, 1);
        await expect(page.locator('[data-testid="qidahen-recruit-selection"]')).toContainText('征召军队');
        await expect(page.locator('[data-testid="qidahen-recruit-map-first-hint"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-recruit-choice-level-2-troops"]')).toBeHidden();
        await page.locator('[data-testid^="qidahen-map-guide-hit-target-"][data-action="select-region"]').first().click();
        await expect(page.locator('[data-testid="qidahen-recruit-map-first-hint"]')).toBeHidden();
        await page.locator('[data-testid="qidahen-recruit-choice-level-2-troops"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toContainText('检查手牌上限');
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toContainText('手牌 12/10');
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toContainText('需弃 2');
        await expect.poll(async () => page.locator('[data-testid^="qidahen-hand-card-"]').count()).toBeGreaterThanOrEqual(3);
        const currentState = await readRequiredQidahenHarnessState(page);
        const visibleHandCardIds = await page.locator('button[data-testid^="qidahen-hand-card-"]').evaluateAll((nodes) => (
            nodes
                .map((node) => node.getAttribute('data-testid') ?? '')
                .filter((testId) => testId.startsWith('qidahen-hand-card-') && !testId.startsWith('qidahen-hand-card-magnify-'))
                .map((testId) => testId.slice('qidahen-hand-card-'.length))
        ));
        const visibleHandCardIdSet = new Set(visibleHandCardIds);
        const reversedDiscardCandidateIds = [...(currentState.core.handLimitDiscardSelection?.candidateCardIds ?? [])]
            .filter((cardId) => visibleHandCardIdSet.has(cardId))
            .reverse();
        const selectedDiscardCardIds = [
            reversedDiscardCandidateIds[0],
            reversedDiscardCandidateIds.find((_, index) => index >= 3) ?? reversedDiscardCandidateIds[1],
        ].filter((cardId): cardId is string => typeof cardId === 'string');
        expect(selectedDiscardCardIds).toHaveLength(2);
        for (const cardId of selectedDiscardCardIds) {
            const cardTestId = `qidahen-hand-card-${cardId}`;
            const clickPoint = await page.locator(`[data-testid="${cardTestId}"]`).evaluate((node, testId) => {
                const button = node as HTMLElement;
                const rect = button.getBoundingClientRect();
                const xCandidates = [0.16, 0.28, 0.42, 0.58, 0.72, 0.86];
                const yCandidates = [0.18, 0.34, 0.5, 0.66, 0.82];
                const hits: string[] = [];
                for (const yRatio of yCandidates) {
                    for (const xRatio of xCandidates) {
                        const x = rect.left + rect.width * xRatio;
                        const y = rect.top + rect.height * yRatio;
                        const hit = document.elementFromPoint(x, y);
                        const hitElement = hit as HTMLElement | null;
                        hits.push(`${Math.round(x)},${Math.round(y)} -> ${hitElement?.tagName ?? 'null'}:${hitElement?.getAttribute('data-testid') ?? ''}:${hitElement?.className ?? ''}`);
                        if (hit?.closest(`[data-testid="${testId}"]`) === button) {
                            return { x, y };
                        }
                    }
                }
                throw new Error(`No visible clickable point for ${testId}; rect=${JSON.stringify({
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    bottom: rect.bottom,
                    right: rect.right,
                })}; hits=${hits.join(' | ')}`);
            }, cardTestId);
            await page.mouse.click(clickPoint.x, clickPoint.y);
            await expect(page.locator(`[data-testid="qidahen-hand-card-selected-frame-${cardId}"]`)).toBeVisible();
        }
        await saveScreenshot(page, HAND_LIMIT_DISCARD_SCREENSHOT);
        await page.evaluate((optionIds: string[]) => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    command?: {
                        dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.command?.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: '1',
                payload: { optionIds },
            });
        }, selectedDiscardCardIds);

        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('蒙古抽牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('蒙古弃牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('3');
        await expect.poll(async () => page.locator('[data-testid^="qidahen-hand-card-"]').count()).toBeGreaterThanOrEqual(3);
        const finalState = await readRequiredQidahenHarnessState(page);
        expect(finalState.core.currentPlayer).toBe('1');
        expect(finalState.core.turnPhase).toBe('action-window');
        expect(finalState.core.selectedRegionId).toBe('city-region-14');
        expect(finalState.core.handLimitDiscardSelection).toBeNull();
        expect(finalState.core.factions.mongol.handCount).toBe(10);
        expect(finalState.core.factions.mongol.discardPileCount).toBe(3);
    });

    test('有弃牌成本的势力行动在取消后不会执行，且重新打开时已选手牌会清空', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);

        const beforeCancelState = await readRequiredQidahenHarnessState(page);
        await previewActionPayment(page, /征召军队/);
        await page.locator('[data-testid^="qidahen-hand-card-"]').first().click();
        await expect(page.locator('[data-testid="qidahen-action-payment-status"]')).toContainText('已选 1 张');
        await saveScreenshot(page, ACTION_PAYMENT_DISCARD_SELECTION_SCREENSHOT);
        await page.locator('[data-testid="qidahen-action-payment-cancel"]').click();
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-recruit-selection"]')).toHaveCount(0);

        await previewActionPayment(page, /征召军队/);
        await expect(page.locator('[data-testid="qidahen-action-payment-status"]')).toContainText('已选 0 张');
        await page.locator('[data-testid="qidahen-action-payment-cancel"]').click();
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toHaveCount(0);

        const afterCancelState = await readRequiredQidahenHarnessState(page);
        expect(afterCancelState.core.factions.ming.handCount).toBe(beforeCancelState.core.factions.ming.handCount);
        expect(afterCancelState.core.factions.ming.discardPileCount).toBe(beforeCancelState.core.factions.ming.discardPileCount);
        expect(afterCancelState.core.selectedPaymentCardIds).toEqual([]);
    });

    test('突袭待结算可收口并推进到下一位势力', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
            const state = harness?.state;
            const snapshot = state?.get?.();
            if (!snapshot || !state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 待结算';
            next.core.turnPhase = 'resolve-pending';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = true;
            next.core.pendingTargetAction = {
                actionId: 'raid',
                title: '突袭作战待结算',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '克什克腾部',
                targetRegionId: 'city-region-14',
                targetRegionName: '察哈尔',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: 'neutral',
                defenderLabel: '中立',
                restriction: '测试',
                battleWidth: 3,
                boundaryUnitCap: null,
                sourceAvailableTroops: 3,
                committedTroops: 3,
                attackPressure: 3,
                attackBoundaryType: 'plain',
                resolutionHint: '测试：战后处理收口',
                defenderPayCost: null,
            };
            next.core.postBattleSelection = null;
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 3,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'neutral',
                        controlLabel: '中立',
                        troops: 0,
                        population: 0,
                        specialTroops: [],
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('战后处理收口');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-rout"]')).toContainText('溃败结算');

        await selectPendingCommittedTroopsIfPresent(page, 3);
        await resolvePendingActionByCommand(page, { retreatLossMode: 'rear-guard', committedTroops: 3 });
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy"]')).toContainText('占领该区');
        await page.click('[data-testid="qidahen-post-battle-choice-occupy"]');

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-action-khan-edict"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('大明抽牌');
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('20');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('大明弃牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('7');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-19');
        await saveScreenshot(page, FACTION_DECK_SCREENSHOT);
    });

    test('结构化战斗可选择低级承伤并按全损规则结束战斗', async ({ page }) => {
        test.slow();
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
            const state = harness?.state;
            const snapshot = state?.get?.();
            if (!snapshot || !state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnPhase = 'resolve-pending';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-14';
            next.core.factions.jin.characters = next.core.factions.jin.characters.map((character) => ({
                ...character,
                inPlay: false,
            }));
            next.core.pendingTargetAction = {
                actionId: 'raid',
                title: '突袭作战待结算',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '克什克腾部',
                targetRegionId: 'city-region-14',
                targetRegionName: '察哈尔部',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: 'jin',
                defenderLabel: '后金',
                restriction: '测试',
                battleWidth: 3,
                boundaryUnitCap: null,
                sourceAvailableTroops: 3,
                committedTroops: 3,
                attackPressure: 3,
                attackBoundaryType: 'plain',
                resolutionHint: '测试：低级承伤优先',
                defenderPayCost: null,
            };
            next.core.postBattleSelection = null;
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 3,
                        specialTroops: [
                            { id: 'ming-elite-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 4 },
                            { id: 'ming-militia-lv1', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                        ],
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 1,
                        population: 0,
                        specialTroops: [
                            { id: 'jin-infantry-lv3', label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 1, level: 3 },
                        ],
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('低级承伤优先');
        await expectMapArmyFace(page, { faction: 'ming', regionId: 'city-region-16', face: 'front', minimum: 3 });
        await expectMapArmyFace(page, { faction: 'jin', regionId: 'city-region-14', face: 'front' });
        await expect(page.locator('[data-testid="qidahen-pending-casualty-priority"]')).toContainText('攻方承伤');
        await expect(page.locator('[data-testid="qidahen-pending-casualty-priority"]')).toContainText('守方承伤');
        await expect(page.locator('[data-testid="qidahen-attacker-casualty-highest-level"]')).toContainText('高级先损');
        await expect(page.locator('[data-testid="qidahen-attacker-casualty-lowest-level"]')).toContainText('低级先损');
        await page.locator('[data-testid="qidahen-attacker-casualty-lowest-level"]').click();
        await saveScreenshot(page, LOW_CASUALTY_SCREENSHOT);

        await selectPendingCommittedTroopsIfPresent(page, 3);
        await resolvePendingActionByCommand(page, {
            retreatLossMode: 'rear-guard',
            committedTroops: 3,
            attackerCasualtyPriority: 'lowest-level',
        });
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('攻方损失 3');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('大明 获得 1 个战败标记');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).not.toContainText('占领');
        const allLossState = await readRequiredQidahenHarnessState(page);
        expect(allLossState.core.postBattleSelection).toBeNull();
        expect(allLossState.core.pendingTargetAction).toBeNull();
    });

    test('城战突破后可在真实 Board 上选择围城而不改控制权', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
            const state = harness?.state;
            const snapshot = state?.get?.();
            if (!snapshot || !state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnPhase = 'post-battle-decision';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'raid';
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = {
                actionId: 'raid',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-24',
                sourceRegionName: '辽西',
                targetRegionId: 'city-region-25',
                targetRegionName: '山海关',
                targetRuntimeRegionId: 'city-region-25',
                committedTroops: 3,
                survivingTroops: 2,
                attackerLosses: 1,
                movementProfileId: null,
                attackerCasualtyPriority: 'highest-level',
                originalController: 'jin',
                originalControlLabel: '后金',
                title: '战后处理',
                summary: '山海关 已被突破，攻方损失 1，幸存 2，决定是否占领、围城或回退。',
                choices: [
                    {
                        id: 'besiege',
                        mode: 'besiege',
                        regionId: 'city-region-25',
                        plunderPopulation: 0,
                        plunderSource: null,
                        label: '围城该区',
                        detail: '2 个幸存部队留在 山海关 外围围城，区域仍由守方控制。',
                    },
                    {
                        id: 'occupy',
                        mode: 'occupy',
                        regionId: 'city-region-25',
                        plunderPopulation: 0,
                        plunderSource: null,
                        label: '占领该区',
                        detail: '2 个幸存部队留在 山海关',
                    },
                ],
            };
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-24') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 3,
                        population: 6,
                        specialTroops: [],
                        siegeState: null,
                    };
                }
                if (region.id === 'city-region-25') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                        siegeState: null,
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-besiege"]')).toContainText('围城该区');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await saveScreenshot(page, POST_BATTLE_BESIEGE_SCREENSHOT);
        await page.click('[data-testid="qidahen-post-battle-choice-besiege"]');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('围城');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('仍由后金控制');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
    });

    test('战后处理会显示掷骰本体，且截图中的地图与手牌素材保持完整', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');

        await page.evaluate(() => {
            const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
            const state = harness?.state;
            const snapshot = state?.get?.();
            if (!snapshot || !state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 战后处理';
            next.core.turnPhase = 'post-battle-decision';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = true;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'raid';
            next.core.pendingTargetAction = null;
            next.core.wheelDispatchSelection = null;
            next.core.driveTigerConsentSelection = null;
            next.core.postBattleSelection = {
                actionId: 'raid',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-24',
                sourceRegionName: '辽西',
                targetRegionId: 'city-region-25',
                targetRegionName: '山海关',
                targetRuntimeRegionId: 'city-region-25',
                committedTroops: 3,
                survivingTroops: 2,
                attackerLosses: 1,
                movementProfileId: null,
                attackerCasualtyPriority: 'highest-level',
                originalController: 'jin',
                originalControlLabel: '后金',
                title: '战后处理',
                summary: '山海关已被突破，攻方损失 1，幸存 2，决定是否占领、围城或回退。',
                battleRollSummary: '骑兵冲击：攻方伤害 2，守方伤害 1',
                battleRolls: {
                    cityBattle: true,
                    attackerDamage: 2,
                    defenderDamage: 1,
                    summary: '骑兵冲击：攻方伤害 2，守方伤害 1',
                    stages: [
                        {
                            phase: 'cavalry',
                            attackerRolls: [
                                { troopKind: 'cavalry', level: 3, dieSides: 8, raw: 6, value: 6 },
                                { troopKind: 'cavalry', level: 2, dieSides: 8, raw: 4, value: 4 },
                            ],
                            defenderRolls: [
                                { troopKind: 'standard', level: 2, dieSides: 10, raw: 8, value: 8 },
                            ],
                            attackerTotal: 10,
                            defenderTotal: 8,
                            attackerDamage: 2,
                            defenderDamage: 1,
                        },
                    ],
                },
                choices: [
                    {
                        id: 'besiege',
                        mode: 'besiege',
                        regionId: 'city-region-25',
                        plunderPopulation: 0,
                        plunderSource: null,
                        label: '围城该区',
                        detail: '2 个幸存部队留在山海关外围围城，区域仍由守方控制。',
                    },
                    {
                        id: 'occupy',
                        mode: 'occupy',
                        regionId: 'city-region-25',
                        plunderPopulation: 0,
                        plunderSource: null,
                        label: '占领该区',
                        detail: '2 个幸存部队留在山海关。',
                    },
                    {
                        id: 'withdraw',
                        mode: 'withdraw',
                        regionId: 'city-region-24',
                        plunderPopulation: 0,
                        plunderSource: null,
                        label: '撤回辽西',
                        detail: '2 个幸存部队撤回辽西，山海关不改控制。',
                    },
                ],
            };
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-24') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 3,
                        population: 6,
                        specialTroops: [],
                        siegeState: null,
                    };
                }
                if (region.id === 'city-region-25') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                        siegeState: null,
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-dice-summary"]')).toContainText('本次掷骰');
        await expect(page.locator('[data-testid="qidahen-post-battle-dice-summary"]')).toContainText('骑兵冲击');
        await expect(page.locator('[data-testid="qidahen-post-battle-dice-summary"]')).toContainText('攻方');
        await expect(page.locator('[data-testid="qidahen-post-battle-dice-summary"]')).toContainText('守方');
        await expect(page.locator('[data-testid="qidahen-post-battle-dice-summary"]')).toContainText('6');
        await expect(page.locator('[data-testid="qidahen-post-battle-dice-summary"]')).toContainText('4');
        await expect(page.locator('[data-testid="qidahen-post-battle-dice-summary"]')).toContainText('8');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await saveScreenshot(page, BATTLE_ROLL_DICE_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-post-battle-dice', diagnostics }]);
    });

    test('待结算面板可选择实际出兵数量并按选择占领', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
            const state = harness?.state;
            const snapshot = state?.get?.();
            if (!snapshot || !state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 待结算';
            next.core.turnPhase = 'resolve-pending';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = true;
            next.core.postBattleSelection = null;
            next.core.pendingTargetAction = {
                actionId: 'raid',
                title: '突袭作战待结算',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '克什克腾部',
                targetRegionId: 'city-region-14',
                targetRegionName: '察哈尔部',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: 'jin',
                defenderLabel: '后金',
                restriction: '测试',
                battleWidth: 3,
                boundaryUnitCap: null,
                sourceAvailableTroops: 4,
                committedTroops: 4,
                attackPressure: 3,
                attackBoundaryType: 'plain',
                resolutionHint: '测试：选择实际出兵',
                defenderPayCost: null,
            };
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 4,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 0,
                        population: 0,
                        specialTroops: [],
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expectMapArmyFace(page, { faction: 'ming', regionId: 'city-region-16', face: 'front', minimum: 4 });
        const committedTroopTokens = page.locator('[data-testid^="qidahen-map-token-"][data-pending-committed-selectable="true"]');
        await expect(committedTroopTokens).toHaveCount(4);
        await expect(committedTroopTokens.nth(0)).toHaveAttribute('data-pending-committed-selected', 'true');
        await expect(committedTroopTokens.nth(3)).toHaveAttribute('data-pending-committed-selected', 'true');
        await committedTroopTokens.nth(1).click();
        await expect(committedTroopTokens.nth(0)).toHaveAttribute('data-pending-committed-selected', 'true');
        await expect(committedTroopTokens.nth(1)).toHaveAttribute('data-pending-committed-selected', 'true');
        await expect(committedTroopTokens.nth(2)).toHaveAttribute('data-pending-committed-selected', 'false');
        await expect(committedTroopTokens.nth(3)).toHaveAttribute('data-pending-committed-selected', 'false');
        await saveScreenshot(page, COMMITTED_TROOPS_SCREENSHOT);
        await resolvePendingActionByCommand(page, { retreatLossMode: 'rear-guard', committedTroops: 2 });

        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('幸存 2');
        await page.click('[data-testid="qidahen-post-battle-choice-occupy"]');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('占领');
        const finalState = await readRequiredQidahenHarnessState(page);
        const sourceRegion = finalState.core.regions.find((region) => region.id === 'city-region-16');
        const targetRegion = finalState.core.regions.find((region) => region.id === 'city-region-14');
        expect(sourceRegion.troops).toBe(2);
        expect(targetRegion.controller).toBe('ming');
        expect(targetRegion.troops).toBe(2);
        assertNoFatalFrontendErrors([{ label: 'qidahen-pending-committed-troops', diagnostics }]);
    });

    test('野战战败会给败方显示战败标记', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__;
            const state = harness?.state;
            const snapshot = state?.get?.();
            if (!snapshot || !state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-14';
            next.core.selectedActionId = 'raid';
            next.core.selectedPaymentCardIds = [];
            next.core.lastSeasonSummary = null;
            next.core.recruitSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.driveTigerConsentSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.factions.ming.defeatMarkers = 0;
            next.core.factions.jin.defeatMarkers = 0;
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) {
                    return region;
                }
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 6,
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 5,
                        population: 0,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-17') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 2,
                    };
                }
                if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                    return {
                        ...region,
                        controller: 'neutral',
                        controlLabel: '中立',
                        troops: 0,
                        population: 0,
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-player-jin"]')).not.toContainText('败×1');
        await previewAndConfirmActionPayment(page, /突袭作战/, 1);
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('突袭待结算');
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    command?: {
                        dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.command?.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: '0',
                payload: { optionId: 'rear-guard' },
            });
        });
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('败×1');
        await expect(page.locator('[data-testid="qidahen-character-markers-jin"]')).toContainText('努尔哈赤(1)败×1');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-14');

        await saveScreenshot(page, DEFEAT_MARKER_SCREENSHOT);
    });

test('只截图第一步选择参与部队高亮', async ({ page }) => {
    test.slow();
    await setChineseLocale(page);
    await disableAudio(page);
    await disableTutorial(page);
    await page.addInitScript(() => {
        (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(QIDAHEN_WATER_DISPATCH_TEST_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
    const initialState = await readRequiredQidahenHarnessState(page);
    const sourceRegion = initialState.core.regions.find((region) => region.id === 'song-jin');
    const targetRegion = initialState.core.regions.find((region) => region.id === 'city-region-22');
    expect(sourceRegion).toMatchObject({
        controller: 'ming',
        troops: 3,
    });
    expect(targetRegion).toMatchObject({
        controller: 'ming',
        troops: 1,
        siegeState: {
            attackerFactionId: 'jin',
            attackerTroops: 2,
            sourceRegionId: 'city-region-25',
        },
    });

    await clickMapRegion(page, 'songjin');
    await expect(page.locator('[data-testid="qidahen-map-selection-banner"]')).toContainText('选择参与部队');
    const troopPicker = page.locator('[data-pending-committed-selectable="true"][data-pending-committed-index="2"]').first();
    await expect(troopPicker).toBeVisible();
    await expect(page.locator('[data-testid^="qidahen-pending-committed-highlight-"]').first()).toBeVisible();
    await troopPicker.click();
    await expect(troopPicker).toHaveAttribute('data-pending-committed-selected', 'true');
    await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-22"][data-action="wheel-dispatch"]')).toBeVisible();
    await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-32"][data-action="wheel-dispatch"]')).toBeVisible();
    await expect(page.locator('[data-testid="qidahen-map-guide-route-overlay"] [data-testid^="qidahen-map-guide-arrow-head-"]').first()).toBeVisible();
    await saveScreenshot(page, 'test-results/evidence-screenshots/_shared/qidahen-指挥进攻掷骰流程/01-指挥部队-全部绿色目标与箭头高亮.png');
});
});
