import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { QidahenCore } from '../src/games/qidahen/domain/types';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableAudio,
    disableTutorial,
    setChineseLocale,
} from './helpers/common';

const BOARD_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-棋盘桌面当前.png';
const PREGAME_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-局内剧本直入-棋盘当前.png';
const MOBILE_LANDSCAPE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-手机横屏棋盘当前.png';
const WIDE_DESKTOP_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-宽屏单地图Scene当前.png';
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
const POST_BATTLE_LAYERED_SCREENSHOT = `${COMMAND_BATTLE_FLOW_DIR}/05-战后处理-占领结果已暂选待确认.png`;
const INTERNAL_DISPATCH_DRAFT_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/05-王化贞调度-地图目标暂选待确认.png`;
const INTERNAL_DISPATCH_CONFIRMED_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/06-王化贞调度-确认后完成并恢复视口.png`;
const GAO_DI_DISPATCH_DIRECT_BEFORE_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/07-高第调度-选牌后地图目标可暂选.png`;
const GAO_DI_DISPATCH_DRAFT_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/07b-高第调度-地图目标已暂选待确认.png`;
const GAO_DI_DISPATCH_DIRECT_AFTER_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/08-高第调度-确认后完成并恢复视口.png`;
const ACTION_TOOLTIP_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/09-行动按钮-悬浮显示功能提示.png`;
const RAID_PAYMENT_TARGET_SCREENSHOT = `${ACTION_WINDOW_FLOW_DIR}/10-突袭支付-地图目标已改选待确认.png`;
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
    chahar: { x: 579 / 1265, y: 353 / 893 },
    keshiketeng: { x: 409 / 1265, y: 356 / 893 },
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

const resolveInitialHandLimitDiscardIfPresent = async (page: Page) => {
    const state = await readRequiredQidahenHarnessState(page);
    if (state.core.turnPhase !== 'hand-limit-discard' || !state.core.handLimitDiscardSelection) {
        return;
    }

    const selection = state.core.handLimitDiscardSelection;
    await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toBeVisible({ timeout: 10000 });
    const candidateCardIds = selection.candidateCardIds.slice(0, selection.requiredDiscardCount);
    expect(candidateCardIds).toHaveLength(selection.requiredDiscardCount);
    for (const cardId of candidateCardIds) {
        await page.locator(`[data-testid="qidahen-hand-card-${cardId}"]`).click();
        await expect(page.locator(`[data-testid="qidahen-hand-card-selected-frame-${cardId}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-testid="qidahen-resolve-hand-limit-discard"]')).toBeEnabled();
    await page.locator('[data-testid="qidahen-resolve-hand-limit-discard"]').click();
    await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toHaveCount(0);
    await expect.poll(async () => {
        const next = await readRequiredQidahenHarnessState(page);
        return next.core.turnPhase;
    }).toBe('action-window');
};

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

const selectPostBattleChoice = async (page: Page, choiceId: string) => {
    const mode = choiceId.startsWith('besiege')
        ? 'besiege'
        : choiceId.startsWith('withdraw')
            ? 'withdraw'
            : 'occupy';
    await page.getByTestId(`qidahen-post-battle-mode-${mode}`).click();
    await page.getByTestId(`qidahen-post-battle-choice-${choiceId}`).click();
    await page.getByTestId('qidahen-post-battle-confirm').click();
};

const clickMapRegionWithUserPointer = async (page: import('@playwright/test').Page, regionId: keyof typeof MAP_REGION_POINTS) => {
    const point = MAP_REGION_POINTS[regionId];
    const canvas = page.getByTestId('qidahen-map-hitmap-canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    const box = await canvas.boundingBox();
    if (!box) {
        throw new Error(`无法读取七大恨地图区域 ${regionId} 的点击范围`);
    }
    const x = box.x + box.width * point.x;
    const y = box.y + box.height * point.y;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
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

const expectMapContentToCoverLayer = async (page: Page) => {
    const mapLayerBox = await page.getByTestId('qidahen-map-layer').boundingBox();
    const mapContentBox = await page.getByTestId('qidahen-map-content').boundingBox();
    expect(mapLayerBox).not.toBeNull();
    expect(mapContentBox).not.toBeNull();
    if (!mapLayerBox || !mapContentBox) {
        throw new Error('qidahen map cover geometry unavailable');
    }
    expect(mapContentBox.x).toBeLessThanOrEqual(mapLayerBox.x + 1);
    expect(mapContentBox.y).toBeLessThanOrEqual(mapLayerBox.y + 1);
    expect(mapContentBox.x + mapContentBox.width).toBeGreaterThanOrEqual(mapLayerBox.x + mapLayerBox.width - 1);
    expect(mapContentBox.y + mapContentBox.height).toBeGreaterThanOrEqual(mapLayerBox.y + mapLayerBox.height - 1);
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
        await resolveInitialHandLimitDiscardIfPresent(page);
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-hitmap-canvas"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-region-mask-overlay"]')).toBeVisible();
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
        const boardReadyState = await readRequiredQidahenHarnessState(page);
        const boardReadyMingHandCards = boardReadyState.core.handCards.filter((card) => card.faction === 'ming');
        await expect(page.locator('[data-testid^="qidahen-hand-card-"]:not([data-testid^="qidahen-hand-card-kind-"]):not([data-testid^="qidahen-hand-card-magnify-"])')).toHaveCount(boardReadyMingHandCards.length);
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('大明弃牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText(`${boardReadyState.core.factions.ming.discardPileCount}`);
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        const initialSelectedRegion = boardReadyState.core.regions.find((region) => region.id === boardReadyState.core.selectedRegionId);
        expect(boardReadyState.core.currentPlayer).toBe('0');
        expect(boardReadyState.core.turnPhase).toBe('action-window');
        expect(boardReadyState.core.selectedRegionId).toBe('city-region-24');
        expect(boardReadyMingHandCards).toHaveLength(3);
        expect(initialSelectedRegion?.controller).toBe('ming');

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
        const wheelTip = page.locator('[data-testid="qidahen-wheel-tip"]');
        const actionBox = await page.locator('[data-testid="qidahen-action-raid"]').boundingBox();
        expect(drawBox).not.toBeNull();
        expect(handBox).not.toBeNull();
        expect(discardBox).not.toBeNull();
        expect(stageBox).not.toBeNull();
        expect(mapLayerBox).not.toBeNull();
        expect(actionDockBox).not.toBeNull();
        expect(actionSlotBox).not.toBeNull();
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
        expect(actionDockBox?.width ?? 0).toBeGreaterThan(300);
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
        await expect(wheelTip).toBeHidden();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').hover();
        await expect(wheelTip).toBeVisible();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').hover();
        await expect(wheelTip).toContainText('所有对手抽 2，走 3');

        await saveScreenshot(page, BOARD_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-map-hud-desktop', diagnostics }]);
    });

    test('宽屏视口由单一地图 Scene 铺满且 HUD 不参与裁切', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 2560, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-scene-stage"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-main-map-image"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-board-map-bleed"]')).toHaveCount(0);

        const metrics = await page.evaluate(() => {
            const board = document.querySelector('[data-testid="qidahen-board"]');
            const sceneStage = document.querySelector('[data-testid="qidahen-scene-stage"]');
            const hudStage = document.querySelector('[data-testid="qidahen-desktop-stage"]');
            const boardRect = board?.getBoundingClientRect();
            const sceneRect = sceneStage?.getBoundingClientRect();
            const hudRect = hudStage?.getBoundingClientRect();
            return {
                boardWidth: boardRect?.width ?? 0,
                boardHeight: boardRect?.height ?? 0,
                sceneLeft: sceneRect?.left ?? 0,
                sceneTop: sceneRect?.top ?? 0,
                sceneWidth: sceneRect?.width ?? 0,
                sceneHeight: sceneRect?.height ?? 0,
                hudLeft: hudRect?.left ?? 0,
                hudWidth: hudRect?.width ?? 0,
                hudRole: hudStage?.getAttribute('data-layer-role') ?? '',
            };
        });

        expect(metrics.sceneLeft).toBeLessThanOrEqual(0);
        expect(metrics.sceneTop).toBeLessThanOrEqual(0);
        expect(metrics.sceneWidth).toBeGreaterThanOrEqual(metrics.boardWidth);
        expect(metrics.sceneHeight).toBeGreaterThanOrEqual(metrics.boardHeight);
        expect(metrics.hudLeft).toBeGreaterThan(0);
        expect(metrics.hudWidth).toBeLessThan(metrics.boardWidth);
        expect(metrics.hudRole).toBe('hud-stage');
        await saveScreenshot(page, WIDE_DESKTOP_SCREENSHOT);
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

    test('突袭作战支付预览时仍可直接点地图改选目标区域', async ({ page }) => {
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
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-16';
            next.core.explicitRegionId = 'city-region-16';
            next.core.selectedActionId = 'raid';
            next.core.confirmedActionId = null;
            next.core.selectedPaymentCardIds = [];
            next.core.handLimitDiscardSelection = null;
            next.core.recruitSelection = null;
            next.core.grantPardonSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.sunYuanhuaTechSelection = null;
            next.core.gaoDiDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.payment = { required: 0, selected: 0, prompt: '无需弃牌' };
            next.core.actionChoices = [
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
            ];
            next.core.factions = Object.fromEntries(
                Object.entries(next.core.factions).map(([factionId, faction]) => [
                    factionId,
                    {
                        ...faction,
                        characters: faction.characters.map((character) => ({
                            ...character,
                            inPlay: false,
                        })),
                    },
                ]),
            ) as typeof next.core.factions;
            if (next.sys?.interaction) {
                next.sys.interaction = {
                    ...next.sys.interaction,
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                };
            }
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 4,
                        population: 0,
                        specialTroops: [],
                        cityState: null,
                        siegeState: null,
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'mongol',
                        controlLabel: '蒙古',
                        troops: 1,
                        population: 0,
                        specialTroops: [],
                        cityState: null,
                        siegeState: null,
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-16');
        await previewActionPayment(page, /突袭作战/);
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toBeVisible();
        await clickMapRegionWithUserPointer(page, 'chahar');

        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-14');
        const paymentState = await readRequiredQidahenHarnessState(page);
        const paymentCardId = paymentState.core.handCards.find((card) => (
            card.faction === 'ming'
            && card.status !== 'disabled'
        ))?.id;
        if (!paymentCardId) {
            throw new Error('突袭支付测试缺少可弃的大明手牌');
        }
        await dispatchHarnessCommand(page, {
            type: 'SELECT_PAYMENT_CARD',
            playerId: '0',
            payload: { cardId: paymentCardId },
        });
        await expect(page.locator('[data-testid="qidahen-action-payment-status"]')).toContainText('已选 1 张');
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await saveScreenshot(page, RAID_PAYMENT_TARGET_SCREENSHOT);
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('突袭待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('察哈尔');
        const finalState = await readRequiredQidahenHarnessState(page);
        expect(finalState.core.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            sourceRegionId: 'city-region-16',
            targetRuntimeRegionId: 'city-region-14',
        });
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
        await selectPostBattleChoice(page, 'occupy');

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
        await page.getByTestId('qidahen-post-battle-mode-besiege').click();
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-besiege"]')).toContainText('围城该区');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await saveScreenshot(page, POST_BATTLE_BESIEGE_SCREENSHOT);
        await page.getByTestId('qidahen-post-battle-choice-besiege').click();
        await page.getByTestId('qidahen-post-battle-confirm').click();
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
            if (next.sys?.interaction) {
                next.sys.interaction.current = undefined;
                next.sys.interaction.queue = [];
                next.sys.interaction.isBlocked = false;
            }
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
        await page.getByTestId('qidahen-post-battle-mode-occupy').click();
        await expect(page.getByTestId('qidahen-post-battle-mode-options-occupy')).toBeVisible();
        await expect(page.getByTestId('qidahen-post-battle-choice-occupy')).toContainText('2 个幸存部队留在山海关');
        await page.getByTestId('qidahen-post-battle-choice-occupy').click();
        await expect(page.getByTestId('qidahen-post-battle-confirm')).toBeEnabled();
        await expect(page.getByTestId('qidahen-post-battle-confirm')).toBeInViewport();
        await saveScreenshot(page, POST_BATTLE_LAYERED_SCREENSHOT);
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
        await selectPostBattleChoice(page, 'occupy');
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

    test('轮盘进攻调度会按地图连线生成待结算目标', async ({ page }) => {
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
        await seedRegionCavalry(page, 'song-jin', 'ming', 2);
        await page.evaluate(() => {
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
            const next = structuredClone(snapshot);
            next.core.regions = next.core.regions.map((region: Record<string, unknown>) => (
                region.id === 'city-region-22'
                    ? {
                        ...region,
                        siegeState: {
                            attackerFactionId: 'jin',
                            attackerTroops: 2,
                            attackerSpecialTroops: [],
                            sourceRegionId: 'city-region-19',
                        },
                    }
                    : region
            ));
            return harness.state.set(next);
        });

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-movement-preview"]')).toContainText('调度可达');

        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await saveScreenshot(page, WHEEL_HIGHLIGHT_SCREENSHOT);
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('轮盘进攻/调度 · 调骑 4');
        await expect(page.locator('[data-testid^="qidahen-wheel-dispatch-target-"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-selection-banner"]')).toContainText('选择参与部队');
        await expect(page.locator('[data-testid="qidahen-map-selection-banner"]')).toContainText('先点源地区兵牌确认本次出兵');
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-22"][data-action="wheel-dispatch"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-32"][data-action="wheel-dispatch"]')).toHaveCount(0);
        await expect(page.locator('[data-testid^="qidahen-map-guide-route-"]')).toHaveCount(0);
        const wheelDispatchTroopPicker = page.locator('[data-pending-committed-selectable="true"][data-pending-committed-index="2"]').first();
        await expect(wheelDispatchTroopPicker).toBeVisible();
        await expect(wheelDispatchTroopPicker).toHaveAttribute('data-pending-committed-selected', 'false');
        await wheelDispatchTroopPicker.click();
        await expect(wheelDispatchTroopPicker).toHaveAttribute('data-pending-committed-selected', 'true');
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-22"][data-action="wheel-dispatch"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-32"][data-action="wheel-dispatch"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-selection-banner"]')).toContainText('点一个进攻目标');
        await expect(page.locator('[data-testid="qidahen-map-selection-banner"]')).toContainText('皮岛 出发');
        const guideRouteCount = await page.locator('[data-testid^="qidahen-map-guide-route-"]').count();
        expect(guideRouteCount).toBeGreaterThanOrEqual(2);
        const firstGuideRoute = page.locator('[data-testid^="qidahen-map-guide-route-"]').first();
        await expect(firstGuideRoute.locator('polyline')).toBeVisible();
        await expect(firstGuideRoute.locator('[data-testid^="qidahen-map-guide-arrow-head-"]')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-map-guide-route-"] circle')).toHaveCount(0);
        await expect(page.locator('[data-testid^="qidahen-map-guide-route-"] text')).toHaveCount(0);

        await saveScreenshot(page, WHEEL_DISPATCH_SELECTION_SCREENSHOT);
        await saveScreenshot(page, COMMAND_FLOW_SELECTION_SCREENSHOT);

        await clickGuidedMapTarget(page, 'city-region-32');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('调度进攻待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('登莱');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('耗4');

        await saveScreenshot(page, WHEEL_DISPATCH_SCREENSHOT);
        await saveScreenshot(page, ATTACK_FLOW_PENDING_SCREENSHOT);

        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('本次出兵 2');
        await resolvePendingActionByCommand(page, { retreatLossMode: 'rear-guard', committedTroops: 4 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await page.getByTestId('qidahen-post-battle-mode-occupy').click();
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy"]')).toContainText('占领该区');

        await saveScreenshot(page, POST_BATTLE_SCREENSHOT);

        await page.getByTestId('qidahen-post-battle-choice-occupy').click();
        await page.getByTestId('qidahen-post-battle-confirm').click();
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('登莱');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('占领');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-32');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('大明');
    });

    test('王化贞免费调度点地图只暂选目标，取消后可重选，确认后才结算并恢复视口', async ({ page }) => {
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
            next.core.turnLabel = '第 1 轮 · 大明 · 王化贞调度';
            next.core.turnPhase = 'internal-dispatch-choice';
            next.core.selectedRegionId = 'city-region-24';
            next.core.explicitRegionId = null;
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.gaoDiDispatchSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) {
                    return region;
                }
                if (region.id === 'city-region-24') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 4,
                        specialTroops: [],
                        siegeState: null,
                    };
                }
                if (region.id === 'city-region-25') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 1,
                        specialTroops: [],
                        siegeState: null,
                    };
                }
                return region;
            });
            next.core.factions.ming.characters = next.core.factions.ming.characters.map((character) => ({
                ...character,
                inPlay: character.id === 'ming-wang-huazhen' || character.inPlay,
            }));
            const internalDispatchChoiceId = 'wang-huazhen:city-region-24:city-region-25';
            const internalDispatchSelection = {
                source: 'wang-huazhen' as const,
                title: '王化贞免费调度',
                summary: '行动前可免费调度 2 个部队。',
                sourceRegionId: 'city-region-24',
                sourceRegionName: '宁远',
                displayAnchorRegionId: 'ning-yuan',
                displayAnchorRegionName: '宁远',
                maxTroops: 2,
                candidates: [{
                    id: internalDispatchChoiceId,
                    targetRegionId: 'city-region-25',
                    targetRegionName: '山海关',
                    totalTravelCost: 1,
                    committedTroops: 2,
                    movedGenericTroops: 2,
                    movedSpecialTroops: [],
                    resolutionHint: '宁远 → 山海关 · 搬运 2 部队 · 2 个常规部队 · 耗1',
                    pathRegionIds: ['city-region-24', 'city-region-25'],
                    pathLabel: '宁远 → 山海关',
                }],
            };
            if (!next.sys?.interaction) {
                throw new Error('qidahen interaction state unavailable');
            }
            next.sys.interaction.current = {
                id: 'qidahen-internal-dispatch-city-region-24',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    title: internalDispatchSelection.title,
                    subtitle: '选择调度目标 · 最多调 2 个部队',
                    sourceId: 'qidahen:internal-dispatch',
                    targetType: 'button',
                    autoResolveIfSingle: false,
                    allowedCommands: ['SELECT_REGION'],
                    options: [{
                        id: internalDispatchChoiceId,
                        label: '山海关',
                        value: { choiceId: internalDispatchChoiceId },
                        displayMode: 'button',
                        description: '宁远 → 山海关 · 搬运 2 部队 · 2 个常规部队 · 耗1',
                    }],
                    qidahenInternalDispatchSelection: internalDispatchSelection,
                },
            };
            next.sys.interaction.queue = [];
            next.sys.interaction.isBlocked = false;
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-internal-dispatch-selection"]')).toContainText('王化贞');
        await expect(page.locator('[data-testid="qidahen-map-selection-banner"]')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-internal-dispatch-confirm')).toBeDisabled();
        const mapLayer = page.locator('[data-testid="qidahen-map-layer"]');
        await expect(mapLayer).toHaveAttribute('data-map-zoom', '1.82');
        await expectMapContentToCoverLayer(page);

        await clickGuidedMapTarget(page, 'city-region-25');
        await expect(page.locator('[data-testid="qidahen-internal-dispatch-selection"]')).toBeVisible();
        await expect(page.getByTestId('qidahen-internal-dispatch-target')).toContainText('山海关');
        await expect(page.getByTestId('qidahen-internal-dispatch-consequence')).toContainText('搬运 2 部队');
        let internalDispatchState = await readRequiredQidahenHarnessState(page);
        let internalTargetRegion = internalDispatchState.core.regions.find((region) => region.id === 'city-region-25');
        expect(internalTargetRegion?.troops).toBe(1);

        await page.getByTestId('qidahen-internal-dispatch-cancel').click();
        await expect(page.getByTestId('qidahen-internal-dispatch-target')).toContainText('在地图上选择目标地区');
        await expect(page.getByTestId('qidahen-internal-dispatch-confirm')).toBeDisabled();

        const internalDispatchMapTarget = page.getByTestId('qidahen-map-guide-hit-target-city-region-25');
        await expect(internalDispatchMapTarget).toHaveAttribute('aria-pressed', 'false');
        await internalDispatchMapTarget.focus();
        await page.keyboard.press('Enter');
        await expect(internalDispatchMapTarget).toHaveAttribute('aria-pressed', 'true');
        await saveScreenshot(page, INTERNAL_DISPATCH_DRAFT_SCREENSHOT);
        await page.getByTestId('qidahen-internal-dispatch-confirm').click();
        await expect(page.locator('[data-testid="qidahen-internal-dispatch-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('王化贞免费调度');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('山海关');
        await expect(mapLayer).toHaveAttribute('data-map-zoom', '1');
        await expect(mapLayer).toHaveAttribute('data-map-pan-x', '0');
        await expect(mapLayer).toHaveAttribute('data-map-pan-y', '0');
        await expectMapContentToCoverLayer(page);
        internalDispatchState = await readRequiredQidahenHarnessState(page);
        internalTargetRegion = internalDispatchState.core.regions.find((region) => region.id === 'city-region-25');
        expect(internalTargetRegion?.troops).toBe(3);
        await saveScreenshot(page, INTERNAL_DISPATCH_CONFIRMED_SCREENSHOT);
    });

    test('高第弃牌调度点地图只暂选目标，确认后才结算并恢复进入前视口', async ({ page }) => {
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
            const selectedCardId = 'ming-gao-di-direct-click-card';
            const baseMingCard = next.core.handCards.find((card) => card.faction === 'ming');
            if (!baseMingCard) {
                throw new Error('missing ming hand card seed for gao-di direct click test');
            }
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 高第调度';
            next.core.turnPhase = 'gao-di-dispatch-choice';
            next.core.selectedRegionId = 'city-region-24';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.handCards = [
                {
                    ...baseMingCard,
                    id: selectedCardId,
                    label: '高第弃牌测试',
                    status: 'selected',
                    cardDefId: 'qidahen-e2e-gao-di-direct-click',
                },
                ...next.core.handCards.filter((card) => card.faction !== 'ming').slice(0, 1),
            ];
            next.core.factions.ming.handCount = 1;
            next.core.gaoDiDispatchSelection = {
                source: 'gao-di',
                title: '高第弃牌调度',
                summary: '测试：地图目标选择执行。',
                sourceRegionId: 'city-region-24',
                sourceRegionName: '宁远',
                maxTroops: 2,
                maxPopulation: 0,
                candidateCardIds: [selectedCardId],
                selectedCardId,
                candidates: [
                    {
                        id: 'gao-di:troops:city-region-24:city-region-25:2',
                        mode: 'troops',
                        targetRegionId: 'city-region-25',
                        targetRegionName: '山海关',
                        totalTravelCost: 1,
                        committedTroops: 2,
                        committedPopulation: 0,
                        movedGenericTroops: 2,
                        movedSpecialTroops: [],
                        resolutionHint: '测试：选牌后应可直接点地图完成调度。',
                        pathRegionIds: ['city-region-24', 'city-region-25'],
                        pathLabel: '宁远 → 山海关',
                    },
                ],
            };
            if (next.sys?.interaction) {
                next.sys.interaction.current = undefined;
                next.sys.interaction.queue = [];
                next.sys.interaction.isBlocked = false;
            }
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) {
                    return region;
                }
                if (region.id === 'city-region-24') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 3,
                        population: 0,
                        specialTroops: [],
                        siegeState: null,
                    };
                }
                if (region.id === 'city-region-25') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 1,
                        population: 0,
                        specialTroops: [],
                        siegeState: null,
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-gao-di-dispatch-selection"]')).toContainText('高第');
        await expect(page.locator('[data-testid="qidahen-map-selection-banner"]')).toHaveCount(0);
        const mapLayer = page.locator('[data-testid="qidahen-map-layer"]');
        await expect(mapLayer).toHaveAttribute('data-map-zoom', '1.82');
        await expectMapContentToCoverLayer(page);
        await saveScreenshot(page, GAO_DI_DISPATCH_DIRECT_BEFORE_SCREENSHOT);

        await clickGuidedMapTarget(page, 'city-region-25');
        await expect(page.locator('[data-testid="qidahen-gao-di-dispatch-selection"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-gao-di-dispatch-target"]')).toContainText('当前目标：山海关');
        await expect(page.locator('[data-testid="qidahen-gao-di-dispatch-confirm"]')).toBeEnabled();
        await expect(page.locator('[data-testid="qidahen-gao-di-dispatch-skip"]')).toBeVisible();
        await saveScreenshot(page, GAO_DI_DISPATCH_DRAFT_SCREENSHOT);
        const draftState = await readRequiredQidahenHarnessState(page);
        expect(draftState.core.regions.find((region) => region.id === 'city-region-24')?.troops).toBe(3);
        expect(draftState.core.regions.find((region) => region.id === 'city-region-25')?.troops).toBe(1);
        expect(draftState.core.factions.ming.handCount).toBe(1);
        expect(draftState.core.gaoDiDispatchSelection).not.toBeNull();

        await page.locator('[data-testid="qidahen-gao-di-dispatch-confirm"]').click();
        await expect(page.locator('[data-testid="qidahen-gao-di-dispatch-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('高第');
        await expect(mapLayer).toHaveAttribute('data-map-zoom', '1');
        await expect(mapLayer).toHaveAttribute('data-map-pan-x', '0');
        await expect(mapLayer).toHaveAttribute('data-map-pan-y', '0');
        const gaoDiDispatchState = await readRequiredQidahenHarnessState(page);
        const gaoDiSourceRegion = gaoDiDispatchState.core.regions.find((region) => region.id === 'city-region-24');
        const gaoDiTargetRegion = gaoDiDispatchState.core.regions.find((region) => region.id === 'city-region-25');
        expect(gaoDiSourceRegion?.troops).toBe(1);
        expect(gaoDiTargetRegion?.troops).toBe(3);
        expect(gaoDiDispatchState.core.factions.ming.handCount).toBe(0);
        expect(gaoDiDispatchState.core.gaoDiDispatchSelection).toBeNull();
        await saveScreenshot(page, GAO_DI_DISPATCH_DIRECT_AFTER_SCREENSHOT);
    });

    test('轮盘调度可从真实 Board 增援己方围城区域且不进入战斗', async ({ page }) => {
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
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-24';
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-24') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 4,
                        population: 0,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-25') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                        siegeState: {
                            attackerFactionId: 'ming',
                            attackerTroops: 2,
                            attackerSpecialTroops: [],
                            sourceRegionId: 'city-region-20',
                        },
                        cityState: {
                            troops: 0,
                            population: 2,
                            specialTroops: [],
                        },
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('轮盘进攻/调度 · 调骑 4');
        await expect(page.locator('[data-testid^="qidahen-wheel-dispatch-target-"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-25"][data-action="wheel-dispatch"]')).toBeVisible();

        await clickGuidedMapTarget(page, 'city-region-25');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('调度进攻待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('山海关');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('增援围城');
        const pendingSnapshot = await page.evaluate(() => {
            const snapshot = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.() ?? null;
            if (!snapshot?.core?.pendingTargetAction) {
                return null;
            }
            const sourceRegionId = snapshot.core.pendingTargetAction.sourceRegionId;
            const sourceRegion = snapshot.core.regions.find((region) => region.id === sourceRegionId) ?? null;
            return {
                sourceRegionId,
                sourceRegionName: snapshot.core.pendingTargetAction.sourceRegionName,
                committedTroops: snapshot.core.pendingTargetAction.committedTroops,
                sourceTroopsBefore: sourceRegion?.troops ?? null,
            };
        });
        expect(pendingSnapshot).not.toBeNull();
        expect(pendingSnapshot?.committedTroops).not.toBeNull();

        await saveScreenshot(page, WHEEL_DISPATCH_SIEGE_REINFORCE_SCREENSHOT);

        await selectPendingCommittedTroopsIfPresent(page, pendingSnapshot?.committedTroops ?? undefined);
        await resolvePendingActionByCommand(page, {
            retreatLossMode: 'rear-guard',
            committedTroops: pendingSnapshot?.committedTroops ?? undefined,
        });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('增援');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('不进入战斗');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');

        const resolvedSnapshot = await readRequiredQidahenHarnessState(page);
        expect(resolvedSnapshot?.core?.turnPhase).toBe('action-window');
        const sourceRegion = resolvedSnapshot.core.regions.find((region) => region.id === pendingSnapshot?.sourceRegionId);
        const targetRegion = resolvedSnapshot.core.regions.find((region) => region.id === 'city-region-25');
        expect(sourceRegion?.troops).toBe((pendingSnapshot?.sourceTroopsBefore ?? 0) - (pendingSnapshot?.committedTroops ?? 0));
        expect(targetRegion?.siegeState?.attackerFactionId).toBe('ming');
        expect(targetRegion?.siegeState?.attackerTroops).toBe(2 + (pendingSnapshot?.committedTroops ?? 0));
        expect(targetRegion?.controller).toBe('jin');
    });

    test('战后处理可劫掠人口并显示抽牌收益', async ({ page }) => {
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
            next.core.actionWheelPosition = 'wheel-recruit-train';
            next.core.selectedRegionId = 'city-region-24';
            next.core.lastSeasonSummary = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.regions = next.core.regions.map((region) => {
                if (region.id === 'city-region-24') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 6,
                        population: 0,
                    };
                }
                if (region.id === 'city-region-20') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 1,
                        population: 2,
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await expect(page.locator('[data-testid^="qidahen-wheel-dispatch-target-"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-20"][data-action="wheel-dispatch"]')).toBeVisible();
        await clickGuidedMapTarget(page, 'city-region-20');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('调度进攻待结算');
        await selectPendingCommittedTroopsIfPresent(page);
        await resolvePendingActionByCommand(page, { retreatLossMode: 'rear-guard' });
        await page.getByTestId('qidahen-post-battle-mode-occupy').click();
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy-plunder-2"]')).toContainText('劫掠 2 人口并占领');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy-plunder-defender-2"]')).toContainText('抽后金牌堆');

        await page.getByTestId('qidahen-post-battle-choice-occupy-plunder-defender-2').click();
        await page.getByTestId('qidahen-post-battle-confirm').click();
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('劫掠');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('劫掠 土默特部 2 人口');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('抽后金牌堆获得 2 张手牌');
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('5/15');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('大明');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-20');

        await saveScreenshot(page, POST_BATTLE_PLUNDER_SCREENSHOT);
    });

    test('攻方骑兵可在真实 Board 待结算中选择劫掠守方牌堆', async ({ page }) => {
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
            next.core.selectedRegionId = 'city-region-14';
            next.core.lastSeasonSummary = null;
            next.core.recruitSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.driveTigerConsentSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.postBattleSelection = null;
            next.core.pendingTargetAction = {
                actionId: 'wheel-dispatch',
                title: '调度进攻待结算',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '克什克腾部',
                targetRegionId: 'city-region-14',
                targetRegionName: '察哈尔部',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: 'jin',
                defenderLabel: '后金',
                restriction: '调骑 4',
                battleWidth: 3,
                boundaryUnitCap: 3,
                sourceAvailableTroops: 2,
                committedTroops: 2,
                movementProfileId: 'dispatch-cavalry',
                attackPressure: 2,
                attackBoundaryType: 'plain',
                resolutionHint: '骑兵可选择劫掠后撤退。',
                defenderPayCost: null,
            };
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) {
                    return region;
                }
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 2,
                        population: 0,
                        specialTroops: [
                            {
                                id: 'ming-cavalry-lv2',
                                label: '大明骑兵',
                                faction: 'ming',
                                troopKind: 'cavalry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 1,
                        population: 2,
                        specialTroops: [],
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('调度进攻待结算');
        await selectPendingCommittedTroopsIfPresent(page, 2);
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-cavalry-plunder-defender"]')).toContainText('骑兵劫掠守方牌堆');
        await resolvePendingActionByCommand(page, {
            attackerCavalryPlunder: true,
            attackerCavalryPlunderSource: 'defender',
            committedTroops: 2,
        });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('骑兵劫掠');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('抽后金牌堆获得 2 张手牌');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('守军仍留在原地');
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('5/15');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-19');

        await saveScreenshot(page, CAVALRY_PLUNDER_SCREENSHOT);
    });

    test('守方骑兵可在真实 Board 待结算中选择避战目标', async ({ page }) => {
        test.setTimeout(45000);
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
            next.core.selectedRegionId = 'city-region-14';
            next.core.lastSeasonSummary = null;
            next.core.recruitSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.driveTigerConsentSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.postBattleSelection = null;
            next.core.factions.jin.defeatMarkers = 0;
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
                restriction: '突袭',
                battleWidth: 3,
                boundaryUnitCap: 3,
                sourceAvailableTroops: 4,
                committedTroops: 4,
                movementProfileId: null,
                attackPressure: 3,
                attackBoundaryType: 'plain',
                resolutionHint: '守方骑兵可先避战。',
                defenderPayCost: null,
            };
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) {
                    return region;
                }
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 4,
                        population: 0,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 2,
                        population: 0,
                        specialTroops: [
                            {
                                id: 'jin-cavalry-lv2',
                                label: '后金骑兵',
                                faction: 'jin',
                                troopKind: 'cavalry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    };
                }
                if (region.id === 'city-region-17') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 5,
                        population: 0,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-19') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 1,
                        population: 0,
                        specialTroops: [],
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('突袭作战待结算');
        await selectPendingCommittedTroopsIfPresent(page, 4);
        await expect(page.getByRole('button', { name: '骑兵避战至敖汉部' })).toBeVisible();
        await resolvePendingActionByCommand(page, {
            defenderCavalryEvasion: true,
            defenderCavalryEvasionRegionId: 'city-region-19',
            committedTroops: 4,
        });
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-14');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).not.toContainText('败×1');
        await clickMapRegion(page, 'liaoxi');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('敖汉部 · 后金');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 3');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('后金骑兵 x2（2级）');

        await saveScreenshot(page, CAVALRY_EVASION_SCREENSHOT);
    });

    test('轮盘征兵训练会直接给当前己方区域增加部队', async ({ page }) => {
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

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 2');

        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('轮盘征兵/训练');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 4');
        const finalState = await readRequiredQidahenHarnessState(page);
        const songJin = finalState.core.regions.find((region) => region.id === 'song-jin');
        expect(finalState.core.currentPlayer).toBe('0');
        expect(finalState.core.selectedRegionId).toBe('song-jin');
        expect(songJin?.troops).toBe(4);

        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_SCREENSHOT);
    });

    test('轮盘外交雇佣会进入外交目标选择，并可在当前候选区只结算雇佣', async ({ page }) => {
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
            next.core.actionWheelPosition = 'wheel-hire';
            next.core.selectedRegionId = 'song-jin';
            next.core.lastSeasonSummary = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('大明');
        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 2');

        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('从 皮岛 出发');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('先点地图选地区');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');
        await expect(page.locator('[data-testid="qidahen-diplomacy-choice-hire-only"]')).toContainText('只结算雇佣');
        await page.locator('[data-testid="qidahen-diplomacy-choice-hire-only"]').click();

        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('建立 2 个等级 2 雇佣军');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');
        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 4');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('雇佣军 x2（2级）');

        await saveScreenshot(page, WHEEL_HIRE_SCREENSHOT);
    });

    test('征召军队会先进入建军选择，再按选择补入 6 个部队并更新地图兵力', async ({ page }) => {
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

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 2');

        await previewAndConfirmActionPayment(page, /征召军队/, 1);
        await expect(page.locator('[data-testid="qidahen-recruit-selection"]')).toContainText('征召军队');
        await expect(page.locator('[data-testid="qidahen-recruit-map-first-hint"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-recruit-choice-level-2-troops"]')).toBeHidden();
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-song-jin"][data-action="select-region"]')).toBeVisible();
        await clickGuidedMapTarget(page, 'song-jin');
        await expect(page.locator('[data-testid="qidahen-recruit-map-first-hint"]')).toBeHidden();
        await expect(page.locator('[data-testid="qidahen-recruit-selection"]')).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');
        await expect(page.locator('[data-testid="qidahen-recruit-choice-level-2-troops"]')).toContainText('建立 6 个等级 2 部队');
        await expect(page.locator('[data-testid="qidahen-recruit-choice-level-4-chuanbing"]')).toContainText('建立 2 个等级 4 川兵');
        await page.locator('[data-testid="qidahen-recruit-choice-level-2-troops"]').click();

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 8');
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('2/15');
        const finalState = await readRequiredQidahenHarnessState(page);
        const songJin = finalState.core.regions.find((region) => region.id === 'song-jin');
        expect(finalState.core.currentPlayer).toBe('0');
        expect(finalState.core.selectedRegionId).toBe('song-jin');
        expect(songJin?.troops).toBe(8);
        expect(finalState.core.factions.ming.handCount).toBe(2);

        await saveScreenshot(page, RECRUIT_SCREENSHOT);
    });

    test('征召军队选择川兵后会在地图提示里显示特殊部队记录', async ({ page }) => {
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

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');

        await previewAndConfirmActionPayment(page, /征召军队/, 1);
        await expect(page.locator('[data-testid="qidahen-recruit-selection"]')).toContainText('征召军队');
        await expect(page.locator('[data-testid="qidahen-recruit-map-first-hint"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-recruit-choice-level-4-chuanbing"]')).toBeHidden();
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-song-jin"][data-action="select-region"]')).toBeVisible();
        await clickGuidedMapTarget(page, 'song-jin');
        await expect(page.locator('[data-testid="qidahen-recruit-map-first-hint"]')).toBeHidden();
        await page.locator('[data-testid="qidahen-recruit-choice-level-4-chuanbing"]').click();

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 4');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('川兵 x2（4级）');
        const finalState = await readRequiredQidahenHarnessState(page);
        const songJin = finalState.core.regions.find((region) => region.id === 'song-jin');
        expect(finalState.core.currentPlayer).toBe('0');
        expect(finalState.core.selectedRegionId).toBe('song-jin');
        expect(songJin?.troops).toBe(4);
        expect(songJin?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-chuanbing-lv4',
                label: '川兵',
                troopKind: 'infantry',
                count: 2,
                level: 4,
            }),
        ]));

        await saveScreenshot(page, RECRUIT_CHUANBING_SCREENSHOT);
    });

    test('马市贸易会先进入 1-3 建兵选择，再按选择给大明加兵并让蒙古摸牌', async ({ page }) => {
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
            next.core.currentPlayer = '1';
            next.core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = false;
            next.core.actionWheelPosition = 'wheel-hire';
            next.core.selectedActionId = 'ma-shi-trade';
            next.core.confirmedActionId = null;
            next.core.selectedRegionId = 'song-jin';
            next.core.selectedPaymentCardIds = [];
            next.core.recruitSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
            next.core.actionChoices = [
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
                { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
            ];
            if (next.sys?.interaction) {
                next.sys.interaction = {
                    ...next.sys.interaction,
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                };
            }
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'song-jin') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 10,
                        population: 0,
                        specialTroops: [],
                        cityState: null,
                        siegeState: null,
                        diplomacyMarkerFaction: null,
                        diplomacyMarkerSide: null,
                    };
                }
                return region;
            });
            return state.set(next);
        });
        await page.waitForFunction(() => {
            const core = (window as QidahenHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.()?.core;
            return core?.currentPlayer === '1'
                && core.turnPhase === 'action-window'
                && core.wheelActionUsed === true
                && core.factionActionUsed === false
                && core.selectedActionId === 'ma-shi-trade'
                && core.selectedRegionId === 'song-jin';
        });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');

        await previewAndConfirmActionPayment(page, /马市贸易/, 1);
        await expect(page.locator('[data-testid="qidahen-ma-shi-trade-selection"]')).toContainText('马市贸易');
        await expect(page.locator('[data-testid="qidahen-ma-shi-trade-map-first-hint"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-ma-shi-trade-choice-3"]')).toBeHidden();
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-song-jin"][data-action="select-region"]')).toBeVisible();
        await clickGuidedMapTarget(page, 'song-jin');
        await expect(page.locator('[data-testid="qidahen-ma-shi-trade-map-first-hint"]')).toBeHidden();
        await expect(page.locator('[data-testid="qidahen-ma-shi-trade-selection"]')).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');
        await expect(page.locator('[data-testid="qidahen-ma-shi-trade-choice-3"]')).toContainText('建立 3 个部队');
        await dispatchHarnessCommand(page, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: { optionId: '3' },
        });

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('后金');
        await expect(page.getByText('蒙古在 皮岛 发动马市贸易，大明选择建立 3 个部队。')).toBeVisible();
        await expect(page.getByText('蒙古因马市贸易获得 6 张手牌。')).toBeVisible();
        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 13');
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('11/10');
        const finalState = await readRequiredQidahenHarnessState(page);
        const songJin = finalState.core.regions.find((region) => region.id === 'song-jin');
        expect(finalState.core.currentPlayer).toBe('2');
        expect(songJin?.troops).toBe(13);
        expect(finalState.core.factions.mongol.handCount).toBe(11);

        await saveScreenshot(page, MA_SHI_TRADE_SCREENSHOT);
    });

    test('驱虎吞狼会先进入同意选择，目标同意后再抽牌并进入指挥调度目标选择', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await seedRegionCavalry(page, 'jinzhou', 'jin', 2, 2);

        await clickMapRegion(page, 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('锦州 · 后金');

        await previewAndConfirmActionPayment(page, /驱虎吞狼/, 3);

        await expect(page.locator('[data-testid="qidahen-drive-tiger-consent-selection"]')).toContainText('驱虎吞狼');
        await expect(page.locator('[data-testid="qidahen-drive-tiger-consent-selection"]')).toContainText('后金');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('10/10');
        await dispatchHarnessCommand(page, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '2',
            payload: { optionId: 'accept' },
        });

        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('16/10');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('驱虎吞狼');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('指挥后金调度进攻');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'jinzhou');
        await expect(page.locator('[data-testid^="qidahen-wheel-dispatch-target-"]')).toHaveCount(0);

        const dispatchTarget = page.locator('[data-testid^="qidahen-map-guide-hit-target-"][data-action="wheel-dispatch"]').first();
        await expect(dispatchTarget).toBeVisible();
        const dispatchTargetTestId = await dispatchTarget.getAttribute('data-testid');
        expect(dispatchTargetTestId).not.toBeNull();
        const dispatchTargetRegionId = dispatchTargetTestId!.replace('qidahen-map-guide-hit-target-', '');
        await dispatchTarget.click();
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('驱虎吞狼待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('本次出兵');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', dispatchTargetRegionId);
        const finalState = await readRequiredQidahenHarnessState(page);
        expect(finalState.core.currentPlayer).toBe('0');
        expect(finalState.core.turnPhase).toBe('resolve-pending');
        expect(finalState.core.selectedRegionId).toBe(dispatchTargetRegionId);
        expect(finalState.core.factions.jin.handCount).toBe(16);
        expect(finalState.core.pendingTargetAction).toMatchObject({
            actionId: 'drive-tiger',
            title: '驱虎吞狼待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
        });

        await saveScreenshot(page, DRIVE_TIGER_SCREENSHOT);
    });

    test('大汗令箭会先显示二选一，再可执行征兵训练', async ({ page }) => {
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
            next.core.currentPlayer = '1';
            next.core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'khan-edict';
            next.core.selectedPaymentCardIds = [];
            next.core.khanEdictSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
            next.core.actionChoices = [
                { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '弃 1 张手牌，选择一项已开发军备进行升级。' },
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
                { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
            ];
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-25') {
                    return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
                }
                if (region.id === 'city-region-24') {
                    return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
                }
                return region;
            });
            return state.set(next);
        });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');

        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    command?: {
                        dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.command?.dispatch({
                type: 'EXECUTE_ACTION',
                playerId: '1',
                payload: { actionId: 'khan-edict' },
            });
        });
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await expect(page.locator('[data-testid="qidahen-khan-edict-choice-recruit-train"]')).toContainText('征兵训练');
        await expect(page.locator('[data-testid="qidahen-khan-edict-choice-hire-dispatch"]')).toContainText('外交雇佣');

        await dispatchHarnessCommand(page, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: { optionId: 'recruit-train' },
        });
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('轮盘行动');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('点轮盘');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-choices"]')).toContainText('免费走 1');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');

        await saveScreenshot(page, KHAN_EDICT_SCREENSHOT);
    });

    test('大汗令箭选择外交雇佣后会进入外交目标选择，并可同时放友好标记与建立雇佣军', async ({ page }) => {
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
            next.core.currentPlayer = '1';
            next.core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'khan-edict';
            next.core.selectedPaymentCardIds = [];
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
            next.core.actionChoices = [
                { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '弃 1 张手牌，选择一项已开发军备进行升级。' },
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
                { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
            ];
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-25') {
                    return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2, siegeState: null };
                }
                if (region.id === 'city-region-24') {
                    return { ...region, controller: 'neutral', controlLabel: '中立', troops: 0, siegeState: null };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');

        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    command?: {
                        dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.command?.dispatch({
                type: 'EXECUTE_ACTION',
                playerId: '1',
                payload: { actionId: 'khan-edict' },
            });
        });
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await dispatchHarnessCommand(page, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: { optionId: 'hire-dispatch' },
        });
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('从 山海关 出发');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-24"][data-action="diplomacy"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-diplomacy-target-city-region-24"]')).not.toBeVisible();
        await clickGuidedMapTarget(page, 'city-region-24');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('正在查看 宁远');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-24');
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
                playerId: '1',
                payload: { optionId: 'place-friendly' },
            });
        });
        await expect(page.locator('[data-testid="qidahen-diplomacy-history"]')).toContainText('外交 1');
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
                playerId: '1',
                payload: { optionId: 'hire-only' },
            });
        });

        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('轮盘行动');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('点轮盘');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-choices"]')).toContainText('一名对手抽 2，走 2');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await clickMapRegion(page, 'ningyuan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('宣府 · 蒙古友好');
        await clickMapRegion(page, 'shanhaiguan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关 · 蒙古');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 4');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('雇佣军 x2（2级）');

        await saveScreenshot(page, KHAN_EDICT_HIRE_SCREENSHOT);
    });

    test('外交雇佣同一次行动最多可连续处理 3 个目标后自动完成', async ({ page }) => {
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
            next.core.currentPlayer = '1';
            next.core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'khan-edict';
            next.core.selectedPaymentCardIds = [];
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
            next.core.actionChoices = [
                { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '弃 1 张手牌，选择一项已开发军备进行升级。' },
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
                { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
            ];
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-25') {
                    return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2, siegeState: null };
                }
                if (region.id === 'city-region-24' || region.id === 'jinzhou') {
                    return {
                        ...region,
                        controller: 'neutral',
                        controlLabel: '中立',
                        troops: 0,
                        siegeState: null,
                        diplomacyMarkerFaction: null,
                        diplomacyMarkerSide: null,
                    };
                }
                if (region.id === 'city-region-28') {
                    return {
                        ...region,
                        controller: 'neutral',
                        controlLabel: '中立',
                        troops: 0,
                        siegeState: null,
                        diplomacyMarkerFaction: 'jin',
                        diplomacyMarkerSide: 'friendly',
                    };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');

        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    command?: {
                        dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.command?.dispatch({
                type: 'EXECUTE_ACTION',
                playerId: '1',
                payload: { actionId: 'khan-edict' },
            });
        });
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await dispatchHarnessCommand(page, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: { optionId: 'hire-dispatch' },
        });
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('从 山海关 出发');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-24"][data-action="diplomacy"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-diplomacy-target-city-region-24"]')).not.toBeVisible();
        await clickGuidedMapTarget(page, 'city-region-24');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('正在查看 宁远');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-24');
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
                playerId: '1',
                payload: { optionId: 'place-friendly' },
            });
        });
        await expect(page.locator('[data-testid="qidahen-diplomacy-history"]')).toContainText('外交 1');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('还可继续 2 次');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-24');

        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-24"][data-action="diplomacy"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-diplomacy-target-city-region-24"]')).not.toBeVisible();
        await clickGuidedMapTarget(page, 'city-region-24');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('正在查看 宁远');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-24');
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
                playerId: '1',
                payload: { optionId: 'flip-vassal' },
            });
        });
        await expect(page.locator('[data-testid="qidahen-diplomacy-history"]')).toContainText('外交 2');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('还可继续 1 次');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-24');

        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-28-jizhen"][data-action="diplomacy"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-diplomacy-target-city-region-28-jizhen"]')).not.toBeVisible();
        await clickGuidedMapTarget(page, 'city-region-28-jizhen');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-28-jizhen');
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
                playerId: '1',
                payload: { optionId: 'hire-only' },
            });
        });

        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-13');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('外交 1：');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('外交 2：');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('建立 2 个等级 2 雇佣军');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('蒙古附庸');

        await clickMapRegion(page, 'shanhaiguan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关 · 蒙古');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 4');
        await clickMapRegion(page, 'ningyuan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('蒙古附庸');

        await saveScreenshot(page, DIPLOMACY_THREE_TARGET_SCREENSHOT);
    });

    test('联姻诱降失败后会进入轮盘推进，并保留真实地名提示', async ({ page }) => {
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
            next.core.currentPlayer = '2';
            next.core.turnLabel = '第 1 轮 · 后金 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'marriage-subjugation';
            next.core.selectedPaymentCardIds = [];
            next.core.khanEdictSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.payment = { required: 2, selected: 0, prompt: '需弃 2 / 已选 0' };
            next.core.actionChoices = [
                { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '弃 1 张手牌，选择一项已开发军备进行升级。' },
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'marriage-subjugation', label: '联姻诱降', cost: 2, detail: '弃 2 张手牌，指定邻近控制区域，触发对手支付或转控判定。' },
            ];
            next.core.factions.ming.handCount = 0;
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-25') {
                    return { ...region, controller: 'ming', controlLabel: '大明', troops: 2, note: '当前守军无法支付联姻诱降代价。' };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('后金');
        await clickMapRegion(page, 'shanhaiguan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 2');

        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    command?: {
                        dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.command?.dispatch({
                type: 'EXECUTE_ACTION',
                playerId: '2',
                payload: { actionId: 'marriage-subjugation' },
            });
        });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('联姻待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('山海关');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('守方 大明');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('守方需付 4');

        await expect(page.locator('[data-testid="qidahen-resolve-pending-action"]')).toBeVisible();
        await resolvePendingActionByCommand(page, { retreatLossMode: 'rout' });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('轮盘');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('轮盘行动');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('点轮盘');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await clickMapRegion(page, 'shanhaiguan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关 · 后金');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 1');

        await saveScreenshot(page, MARRIAGE_SUBJUGATION_SCREENSHOT);
    });

    test('轮盘跨过年中与新年时会保留结算摘要，但不再把防线状态条塞回动作窗首屏', async ({ page }) => {
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
        await expect(page.locator('[data-testid="qidahen-fortification-strip"]')).toHaveCount(0);
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
            next.core.currentPlayer = '1';
            next.core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.actionWheelPosition = 'wheel-hire';
            next.core.selectedWheelMoveId = 'move-2-one-opponent';
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'khan-edict';
            next.core.selectedPaymentCardIds = [];
            next.core.recruitSelection = null;
            next.core.khanEdictSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.factions.ming.defeatMarkers = 1;
            next.core.factions.ming.characters = next.core.factions.ming.characters.map((character) => ({
                ...character,
                inPlay: character.id === 'ming-mao-wenlong',
            }));
            next.core.factions.mongol.defeatMarkers = 1;
            next.core.factions.jin.defeatMarkers = 1;
            next.core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
            next.core.actionChoices = [
                { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '弃 1 张手牌，选择一项已开发军备进行升级。' },
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
                { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
            ];
            next.core.regions = next.core.regions.map((region) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-25') {
                    return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
                }
                if (region.id === 'city-region-24') {
                    return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
                }
                return region;
            });
            return state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    command?: {
                        dispatch: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.command?.dispatch({
                type: 'EXECUTE_ACTION',
                playerId: '1',
                payload: { actionId: 'khan-edict' },
            });
        });
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await dispatchHarnessCommand(page, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: { optionId: 'recruit-train' },
        });
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').click();
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('年中结算');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('年中战败标记与人物判定');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('大明处理 1 个战败标记，掷骰 4');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('毛文龙(d10) 掷 9→8：下野');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('蒙古处理 1 个战败标记，掷骰 1');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('林丹·乎图克图(1) 掷 1 离场');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('后金处理 1 个战败标记，掷骰 4');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('努尔哈赤(1) 掷 4');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('额亦都(d10) 掷 10→9：无效果');
        await expect(page.locator('[data-testid="qidahen-character-markers-mongol"]')).toContainText('人物 0');
        await saveScreenshot(page, MIDYEAR_DEFEAT_MARKERS_SCREENSHOT);
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('后金');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-selection"]')).toContainText('新年防线维护');
        await expect(page.locator('[data-testid="qidahen-upkeep-attrition-priority"]')).toContainText('兵力耗损');
        await expect(page.locator('[data-testid="qidahen-upkeep-attrition-lowest-level"]')).toContainText('低级先损');
        await expect(page.locator('[data-testid="qidahen-upkeep-attrition-highest-level"]')).toContainText('高级先损');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');
        await page.locator('[data-testid="qidahen-upkeep-attrition-highest-level"]').click();
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-choice-auto-pay"]')).toContainText('尽量维护防线');
        await saveScreenshot(page, FORTIFICATION_MAINTENANCE_SCREENSHOT);
        await dispatchHarnessCommand(page, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '2',
            payload: {
                optionId: 'auto-pay',
                mergedValue: { attritionPriority: 'highest-level-first' },
            },
        });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('新年结算');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('天命五年 1620');
        await expect(page.locator('[data-testid="qidahen-fortification-strip"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');

        await saveScreenshot(page, SEASON_FLOW_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-season-flow', diagnostics }]);
    });

    test('手机横屏下地图与 HUD 布局不缩在左上角', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 936, height: 432 });
        await page.goto(QIDAHEN_BASIC_OPENING_TEST_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-actions-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-bottom-dock"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"] svg')).toBeVisible();
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

        const stageBox = await page.locator('[data-testid="qidahen-desktop-stage"]').boundingBox();
        const drawBox = await page.locator('[data-testid="qidahen-draw-pile"]').boundingBox();
        const handBox = await page.locator('[data-testid="qidahen-hand-zone"]').boundingBox();
        const discardBox = await page.locator('[data-testid="qidahen-discard-pile"]').boundingBox();
        expect(stageBox).not.toBeNull();
        expect(stageBox?.x ?? 0).toBeGreaterThanOrEqual(0);
        expect(stageBox?.y ?? 0).toBeGreaterThanOrEqual(0);
        expect(stageBox?.width ?? 0).toBeGreaterThan(760);
        expect(stageBox?.height ?? 0).toBeGreaterThan(390);
        expect(drawBox?.x ?? 9999).toBeLessThan(160);
        expect(drawBox?.y ?? 0).toBeGreaterThan(330);
        expect(handBox).not.toBeNull();
        expect(Math.abs(((handBox?.x ?? 0) + (handBox?.width ?? 0) / 2) - 468)).toBeLessThan(80);
        expect(discardBox).not.toBeNull();
        expect(((discardBox?.x ?? 9999) + (discardBox?.width ?? 0))).toBeLessThanOrEqual(936);
        expect(discardBox?.x ?? 0).toBeGreaterThan(680);
        expect(discardBox?.y ?? 0).toBeGreaterThan(330);

        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
        await saveScreenshot(page, MOBILE_LANDSCAPE_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-map-hud-mobile-landscape', diagnostics }]);
    });

    test('区域涂色工具可加载并显示导出入口', async ({ page }) => {
        test.info().setTimeout(120000);
        await page.setDefaultTimeout(120000);
        await page.setDefaultNavigationTimeout(120000);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.goto('/dev/qidahen-region-mask', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('aside')).toContainText('正式工作区');
        await expect(page.getByText('src/games/qidahen/data', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '生成区域' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: '保存边界' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: '保存区域' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: '保存连线' }).first()).toBeVisible();
        await expect(page.getByText(/已自动读取 src\/games\/qidahen\/data 中的区域\/通路结果/u)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('qidahen-passage-summary')).toContainText(`中心 ${FORMAL_REGION_COUNT} / 通路 ${FORMAL_PASSAGE_COUNT}`);
        await expect(page.locator('[data-testid^="qidahen-generated-region-row-"]')).toHaveCount(FORMAL_REGION_COUNT);
        await expect(page.locator('main')).toContainText('当前区域：大同city-region-1');
        await expect(page.getByTestId('qidahen-generated-region-name-city-region-1')).toHaveValue('大同');
        await expect(page.locator('button:has-text("保存区域")').first()).toBeDisabled();
        await expect(page.getByText(/正式工作区不能保存 needs-visual-review 的区域成果/u)).toBeVisible();
        const regionMaskSnapshot = await readRegionMaskDebugSnapshot(page);
        expect(regionMaskSnapshot.workspaceKey).toBe('');
        expect(regionMaskSnapshot.isIsolatedWorkspace).toBe(false);
        expect(regionMaskSnapshot.dataOutputDir).toBe('src/games/qidahen/data');
        expect(regionMaskSnapshot.persistedWorkspaceState).toBe('populated');
        expect(regionMaskSnapshot.selectedRegionId).toBe('city-region-1');
        expect(regionMaskSnapshot.selectedRegionName).toBe('大同');
        expect(regionMaskSnapshot.graphNodeCount).toBe(FORMAL_REGION_COUNT);
        expect(regionMaskSnapshot.passageCount).toBe(FORMAL_PASSAGE_COUNT);
        expect(regionMaskSnapshot.effectiveGeneratedRegionCount).toBe(FORMAL_REGION_COUNT);
        expect(regionMaskSnapshot.formalRegionSaveBlocked).toBe(true);
        expect(regionMaskSnapshot.boundaryQuality.generatedCount).toBe(FORMAL_REGION_COUNT);
        expect(regionMaskSnapshot.boundaryQuality.formalRegionCount).toBe(FORMAL_REGION_COUNT);
        expect(regionMaskSnapshot.boundaryQuality.normalityState).toBe('needs-visual-review');
        expect(regionMaskSnapshot.boundaryQuality.requiredApprovalCount).toBe(FORMAL_REGION_COUNT);
    });
});
