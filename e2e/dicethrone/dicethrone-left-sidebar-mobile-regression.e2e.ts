/**
 * DiceThrone 左侧 HUD 手机横屏回归证据。
 *
 * 本用例只验证阶段提示与 Token / 状态槽位的空间合同：
 * - 阶段列表保留完整 7 项，只高亮当前阶段。
 * - 手机横屏沿用 PC 左侧 HUD 的单列构图，不重排成移动端 grid。
 * - 同时覆盖无 Token 常态与 Token / 状态压力态，避免只用极端图或空态图冒充验收。
 */

import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Browser, BrowserContext, BrowserContextOptions, Page, TestInfo } from '@playwright/test';
import { test, expect, type WorkerPorts } from '../framework';
import { GameTestContext } from '../framework/GameTestContext';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { assertNoFatalFrontendErrors, attachPageDiagnostics, initContext } from '../helpers/common';
import { closeDebugPanelIfOpen, waitForDiceThroneHarness } from '../helpers/dicethrone';

const PLAYER_ID = '0';
const OPPONENT_ID = '1';
const OPEN_TIMEOUT_MS = 45000;
const TEST_TIMEOUT_MS = 120000;
const PC_BASELINE_WIDTH = 1920;
const DICETHRONE_MOBILE_SHELL_DESIGN_WIDTH = '2340px';
const DICETHRONE_MOBILE_SHELL_DESIGN_HEIGHT = '1080px';
const DICETHRONE_PC_REFERENCE_WIDTH = '1920px';
const DICETHRONE_PC_REFERENCE_HEIGHT = '1080px';
const TRUE_DEVICE_SCREENSHOT_WIDTH = 2340;
const TRUE_DEVICE_SCREENSHOT_HEIGHT = 1080;
const TRUE_DEVICE_DPR = 2.5;

const trueDeviceMobileViewportCase: ViewportCase = {
    label: '真实 DPR 手机横屏 2340x1080',
    width: 936,
    height: 432,
    screenshotPrefix: '真实DPR手机横屏2340x1080',
    mobile: true,
};

const TRUE_DEVICE_MOBILE_CONTEXT_OPTIONS: BrowserContextOptions = {
    viewport: {
        width: trueDeviceMobileViewportCase.width,
        height: trueDeviceMobileViewportCase.height,
    },
    screen: {
        width: trueDeviceMobileViewportCase.width,
        height: trueDeviceMobileViewportCase.height,
    },
    deviceScaleFactor: TRUE_DEVICE_DPR,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

type ViewportCase = {
    label: string;
    width: number;
    height: number;
    screenshotPrefix: string;
    mobile: boolean;
};

type HudStateCase = {
    id: 'normal-no-token' | 'token-pressure';
    label: string;
    screenshotLabel: string;
    expectedTokens: number;
    expectedStatuses: number;
    tokens: Record<string, number>;
    statusEffects: Record<string, number>;
};

type RectSnapshot = {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
};

type GameFixture = Parameters<Parameters<typeof test>[1]>[0]['game'];

type ImageDimensions = {
    width: number;
    height: number;
};

const JPEG_START_OF_FRAME_MARKERS = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const readJpegDimensions = async (path: string): Promise<ImageDimensions> => {
    const buffer = await readFile(path);
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
        throw new Error(`截图不是有效 JPEG 文件：${path}`);
    }

    let offset = 2;
    while (offset + 4 < buffer.length) {
        if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
        }

        while (buffer[offset] === 0xff) {
            offset += 1;
        }

        const marker = buffer[offset];
        offset += 1;
        if (marker === 0xd9 || marker === 0xda) {
            break;
        }
        if (offset + 2 > buffer.length) {
            break;
        }

        const segmentLength = buffer.readUInt16BE(offset);
        if (segmentLength < 2 || offset + segmentLength > buffer.length) {
            break;
        }

        if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
            return {
                height: buffer.readUInt16BE(offset + 3),
                width: buffer.readUInt16BE(offset + 5),
            };
        }

        offset += segmentLength;
    }

    throw new Error(`未能读取 JPEG 截图尺寸：${path}`);
};

const createTrueDeviceEvidenceContext = async (
    browser: Browser,
    baseURL: string | undefined,
    workerPorts: WorkerPorts,
): Promise<{ context: BrowserContext; page: Page; game: GameTestContext }> => {
    const context = await browser.newContext({
        baseURL,
        ...TRUE_DEVICE_MOBILE_CONTEXT_OPTIONS,
    });
    await initContext(context, {
        storageKey: '__dicethrone_left_sidebar_true_device_storage_reset',
        skipImageGate: true,
        gameServerBaseURL: `http://127.0.0.1:${workerPorts.gameServer}`,
        apiServerBaseURL: `http://127.0.0.1:${workerPorts.apiServer}`,
    });
    await context.addInitScript((ports) => {
        (window as Window & { __E2E_WORKER_PORTS__?: WorkerPorts }).__E2E_WORKER_PORTS__ = ports;
    }, workerPorts);

    const page = await context.newPage();
    return {
        context,
        page,
        game: new GameTestContext(page),
    };
};

type HudLayoutSnapshot = {
    viewport: { width: number; height: number };
    documentScrollWidth: number;
    bodyScrollWidth: number;
    cssVars: {
        boardShellScale: string;
        boardShellDesignWidth: string;
        boardShellDesignHeight: string;
        boardShellReferenceWidth: string;
        boardShellReferenceHeight: string;
        boardShellLogicalHeight: string;
    };
    gamePageDataset: {
        mobileProfile: string | null;
        mobileLayoutPreset: string | null;
        gameId: string | null;
    };
    leftHudDensity: string | null;
    shell: RectSnapshot | null;
    sidebar: RectSnapshot | null;
    turnOrderPanel: RectSnapshot | null;
    selfPanelGroup: RectSnapshot | null;
    phase: RectSnapshot | null;
    statusTokens: RectSnapshot | null;
    stats: RectSnapshot | null;
    deck: RectSnapshot | null;
    deckCard: RectSnapshot | null;
    playerBoard: RectSnapshot | null;
    handToggle: RectSnapshot | null;
    handToggleHitArea: RectSnapshot | null;
    selfPanelGroupDisplay: string;
    selfPanelGroupFlexDirection: string;
    selfPanelGroupGridTemplateAreas: string;
    phaseItemCount: number;
    activePhaseItemCount: number;
    visibleTokenCount: number;
    visibleStatusCount: number;
    protectedIconRects: RectSnapshot[];
    protectedIconSizes: Array<string | null>;
    phaseTitleFontSize: number;
    phaseTitleRenderedFontSize: number;
    phaseItemFontSizes: number[];
    phaseItemRenderedFontSizes: number[];
    phaseItemHeights: number[];
    overlaps: {
        phaseStatusTokens: boolean;
        phaseStats: boolean;
        phaseDeck: boolean;
    };
    gaps: {
        phaseToStatusTokens: number | null;
        phaseToStats: number | null;
        phaseToDeck: number | null;
        statusTokensToStats: number | null;
        statsToDeck: number | null;
    };
};

const viewportCases: ViewportCase[] = [
    {
        label: 'PC 1920x1080',
        width: 1920,
        height: 1080,
        screenshotPrefix: 'PC-1920x1080',
        mobile: false,
    },
    {
        label: '手机横屏 936x432',
        width: 936,
        height: 432,
        screenshotPrefix: '手机横屏936x432',
        mobile: true,
    },
    {
        label: '手机横屏 812x375',
        width: 812,
        height: 375,
        screenshotPrefix: '手机横屏812x375',
        mobile: true,
    },
];

const hudStateCases: HudStateCase[] = [
    {
        id: 'normal-no-token',
        label: '无 Token 常态',
        screenshotLabel: '无Token常态',
        expectedTokens: 0,
        expectedStatuses: 0,
        tokens: {},
        statusEffects: {},
    },
    {
        id: 'token-pressure',
        label: 'Token / 状态压力态',
        screenshotLabel: '有Token压力态',
        expectedTokens: 6,
        expectedStatuses: 4,
        tokens: {
            [TOKEN_IDS.FLIGHT]: 1,
            [TOKEN_IDS.PURIFY]: 1,
            [TOKEN_IDS.TAIJI]: 1,
            [TOKEN_IDS.EVASIVE]: 1,
            [TOKEN_IDS.ACCURACY]: 1,
            [TOKEN_IDS.CRIT]: 1,
        },
        statusEffects: {
            [STATUS_IDS.BLEED]: 1,
            [STATUS_IDS.POISON]: 1,
            [STATUS_IDS.BURN]: 1,
            [STATUS_IDS.KNOCKDOWN]: 1,
        },
    },
];

const saveEvidenceScreenshot = async (
    page: Page,
    testInfo: TestInfo,
    name: string,
): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.jpg`,
        requireChineseName: true,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false, type: 'jpeg', quality: 90 });
    return path;
};

const setupLeftHudState = async (game: GameFixture, stateCase: HudStateCase): Promise<void> => {
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { [RESOURCE_IDS.CP]: 3, [RESOURCE_IDS.HP]: 50 },
            tokens: stateCase.tokens,
            statusEffects: stateCase.statusEffects,
        },
        player1: {
            resources: { [RESOURCE_IDS.CP]: 3, [RESOURCE_IDS.HP]: 50 },
            tokens: {},
        },
        currentPlayer: PLAYER_ID,
        phase: 'main1',
        extra: {
            selectedCharacters: { [PLAYER_ID]: 'tianshi', [OPPONENT_ID]: 'barbarian' },
            hostStarted: true,
        },
        sys: {
            phase: 'main1',
            currentPlayerIndex: 0,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        },
    });
};

const waitForLeftHudState = async (page: Page, stateCase: HudStateCase): Promise<void> => {
    await expect(page.getByTestId('dicethrone-board-root')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('left-sidebar')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('dt-phase-indicator').locator('[data-dt-phase-item="true"]')).toHaveCount(7);
    await expect(page.getByTestId('dt-phase-indicator').locator('[data-dt-phase-active="true"]')).toHaveCount(1);
    await expect(page.locator('[data-tutorial-id="status-tokens"] [data-token-id]')).toHaveCount(stateCase.expectedTokens);
    await expect(page.locator('[data-tutorial-id="status-tokens"] [data-status-id]')).toHaveCount(stateCase.expectedStatuses);
    await expect(page.getByTestId('dt-player-stats-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-tutorial-id="draw-deck"]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
};

const readHudLayout = async (page: Page): Promise<HudLayoutSnapshot> => page.evaluate(() => {
    const toRect = (element: Element | null): RectSnapshot | null => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
        };
    };
    const visibleRect = (element: Element | null): RectSnapshot | null => {
        const rect = toRect(element);
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        return rect;
    };
    const overlaps = (first: RectSnapshot | null, second: RectSnapshot | null): boolean => (
        Boolean(first && second)
        && first!.left < second!.right
        && first!.right > second!.left
        && first!.top < second!.bottom
        && first!.bottom > second!.top
    );
    const gamePage = document.querySelector<HTMLElement>('[data-game-page="true"][data-game-id="dicethrone"]')
        ?? (document.body?.dataset.gameId === 'dicethrone' ? document.body : null)
        ?? (document.documentElement.dataset.gameId === 'dicethrone' ? document.documentElement : null);
    const phase = document.querySelector('[data-testid="dt-phase-indicator"]');
    const turnOrderPanel = document.querySelector('[data-testid="turn-order-panel"]');
    const selfPanelGroup = document.querySelector('[data-testid="self-player-panel-group"]');
    const statusTokens = document.querySelector('[data-tutorial-id="status-tokens"]');
    const stats = document.querySelector('[data-testid="dt-player-stats-panel"]');
    const deck = document.querySelector('[data-tutorial-id="draw-deck"]');
    const deckCard = document.querySelector('[data-testid="dt-draw-deck-card"]');
    const playerBoard = document.querySelector('[data-testid="player-board-surface"]');
    const handToggle = document.querySelector('[data-testid="dicethrone-hand-visibility-toggle"]');
    const handToggleHitArea = document.querySelector('[data-testid="dicethrone-hand-visibility-hit-area"]');
    const phaseItems = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="dt-phase-indicator"] [data-dt-phase-item="true"]'));
    const protectedIcons = Array.from(document.querySelectorAll('[data-tutorial-id="status-tokens"] [data-token-id], [data-tutorial-id="status-tokens"] [data-status-id]'));
    const rootStyle = window.getComputedStyle(document.documentElement);
    const selfPanelGroupStyle = window.getComputedStyle(selfPanelGroup ?? document.body);
    const phaseRect = visibleRect(phase);
    const statusTokensRect = visibleRect(statusTokens);
    const statsRect = visibleRect(stats);
    const deckRect = visibleRect(deck);
    const renderedFontSize = (item: HTMLElement): number => {
        const computedFontSize = Number.parseFloat(window.getComputedStyle(item).fontSize);
        const localHeight = Math.max(item.offsetHeight, 1);
        const renderedHeight = item.getBoundingClientRect().height;
        const scale = renderedHeight / localHeight;
        return computedFontSize * scale;
    };

    return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body?.scrollWidth ?? 0,
        cssVars: {
            boardShellScale: rootStyle.getPropertyValue('--mobile-board-shell-scale').trim(),
            boardShellDesignWidth: rootStyle.getPropertyValue('--mobile-board-shell-design-width').trim(),
            boardShellDesignHeight: rootStyle.getPropertyValue('--mobile-board-shell-design-height').trim(),
            boardShellReferenceWidth: rootStyle.getPropertyValue('--mobile-board-shell-reference-width').trim(),
            boardShellReferenceHeight: rootStyle.getPropertyValue('--mobile-board-shell-reference-height').trim(),
            boardShellLogicalHeight: rootStyle.getPropertyValue('--mobile-board-shell-logical-height').trim(),
        },
        gamePageDataset: {
            mobileProfile: gamePage?.dataset.mobileProfile ?? null,
            mobileLayoutPreset: gamePage?.dataset.mobileLayoutPreset ?? null,
            gameId: gamePage?.dataset.gameId ?? null,
        },
        leftHudDensity: (document.querySelector('[data-testid="left-sidebar"]') as HTMLElement | null)
            ?.dataset.dicethroneLeftHudDensity ?? null,
        shell: visibleRect(document.querySelector('.mobile-board-shell')),
        sidebar: visibleRect(document.querySelector('[data-testid="left-sidebar"]')),
        turnOrderPanel: visibleRect(turnOrderPanel),
        selfPanelGroup: visibleRect(selfPanelGroup),
        phase: phaseRect,
        statusTokens: statusTokensRect,
        stats: statsRect,
        deck: deckRect,
        deckCard: visibleRect(deckCard),
        playerBoard: visibleRect(playerBoard),
        handToggle: visibleRect(handToggle),
        handToggleHitArea: visibleRect(handToggleHitArea),
        selfPanelGroupDisplay: selfPanelGroupStyle.display,
        selfPanelGroupFlexDirection: selfPanelGroupStyle.flexDirection,
        selfPanelGroupGridTemplateAreas: selfPanelGroupStyle.gridTemplateAreas,
        phaseItemCount: phaseItems.length,
        activePhaseItemCount: phaseItems.filter((item) => item.dataset.dtPhaseActive === 'true').length,
        visibleTokenCount: Array.from(document.querySelectorAll('[data-tutorial-id="status-tokens"] [data-token-id]'))
            .filter((node) => Boolean(visibleRect(node))).length,
        visibleStatusCount: Array.from(document.querySelectorAll('[data-tutorial-id="status-tokens"] [data-status-id]'))
            .filter((node) => Boolean(visibleRect(node))).length,
        protectedIconRects: protectedIcons.map((node) => visibleRect(node)).filter(Boolean) as RectSnapshot[],
        protectedIconSizes: protectedIcons.map((node) => (
            (node as HTMLElement).dataset.dicethroneTokenSize
            ?? (node as HTMLElement).dataset.dicethroneStatusSize
            ?? null
        )),
        phaseTitleFontSize: Number.parseFloat(window.getComputedStyle(document.querySelector('.dt-phase-indicator__title') ?? document.body).fontSize),
        phaseTitleRenderedFontSize: renderedFontSize((document.querySelector('.dt-phase-indicator__title') ?? document.body) as HTMLElement),
        phaseItemFontSizes: phaseItems.map((item) => Number.parseFloat(window.getComputedStyle(item).fontSize)),
        phaseItemRenderedFontSizes: phaseItems.map(renderedFontSize),
        phaseItemHeights: phaseItems.map((item) => item.getBoundingClientRect().height),
        overlaps: {
            phaseStatusTokens: overlaps(phaseRect, statusTokensRect),
            phaseStats: overlaps(phaseRect, statsRect),
            phaseDeck: overlaps(phaseRect, deckRect),
        },
        gaps: {
            phaseToStatusTokens: phaseRect && statusTokensRect ? statusTokensRect.top - phaseRect.bottom : null,
            phaseToStats: phaseRect && statsRect ? statsRect.top - phaseRect.bottom : null,
            phaseToDeck: phaseRect && deckRect ? deckRect.top - phaseRect.bottom : null,
            statusTokensToStats: statusTokensRect && statsRect ? statsRect.top - statusTokensRect.bottom : null,
            statsToDeck: statsRect && deckRect ? deckRect.top - statsRect.bottom : null,
        },
    };
});

const summariseLayout = (layout: HudLayoutSnapshot) => ({
    viewport: layout.viewport,
    cssVars: layout.cssVars,
    sidebar: layout.sidebar,
    turnOrderPanel: layout.turnOrderPanel,
    selfPanelGroup: layout.selfPanelGroup,
    phase: layout.phase,
    statusTokens: layout.statusTokens,
    stats: layout.stats,
    deck: layout.deck,
    deckCard: layout.deckCard,
    playerBoard: layout.playerBoard,
    handToggle: layout.handToggle,
    handToggleHitArea: layout.handToggleHitArea,
    selfPanelGroupCss: {
        display: layout.selfPanelGroupDisplay,
        flexDirection: layout.selfPanelGroupFlexDirection,
        gridTemplateAreas: layout.selfPanelGroupGridTemplateAreas,
    },
    counts: {
        phaseItems: layout.phaseItemCount,
        activePhaseItems: layout.activePhaseItemCount,
        tokens: layout.visibleTokenCount,
        statuses: layout.visibleStatusCount,
    },
    protectedIconSizes: layout.protectedIconSizes,
    phaseTitleFontSize: layout.phaseTitleFontSize,
    phaseTitleRenderedFontSize: layout.phaseTitleRenderedFontSize,
    phaseFontSizes: layout.phaseItemFontSizes,
    phaseRenderedFontSizes: layout.phaseItemRenderedFontSizes,
    phaseItemHeights: layout.phaseItemHeights,
    gaps: layout.gaps,
    overlaps: layout.overlaps,
});

const expectRectInsideViewport = (
    rect: RectSnapshot,
    viewport: { width: number; height: number },
    label: string,
): void => {
    expect(rect.left, `${label} 左边界不能出屏`).toBeGreaterThanOrEqual(-1);
    expect(rect.top, `${label} 上边界不能出屏`).toBeGreaterThanOrEqual(-1);
    expect(rect.right, `${label} 右边界不能出屏`).toBeLessThanOrEqual(viewport.width + 1);
    expect(rect.bottom, `${label} 下边界不能出屏`).toBeLessThanOrEqual(viewport.height + 1);
};

const expectSameColumnLayout = (layout: HudLayoutSnapshot, label: string): void => {
    expect(layout.selfPanelGroupDisplay, `${label} 左侧底部组合必须沿用 PC 单列 flex，不得改成移动端 grid`).toBe('flex');
    expect(layout.selfPanelGroupFlexDirection, `${label} 左侧底部组合必须保持纵向排列`).toBe('column');
    expect(layout.selfPanelGroupGridTemplateAreas, `${label} 不得出现移动端 grid 分区`).toBe('none');
};

const expectPhaseKeepsViewportProportion = (
    layout: HudLayoutSnapshot,
    viewportCase: ViewportCase,
    pcLayout: HudLayoutSnapshot,
    stateCase: HudStateCase,
): void => {
    const expectedScale = Number.parseFloat(layout.cssVars.boardShellScale) || (viewportCase.width / PC_BASELINE_WIDTH);
    const actualFontScale = Math.min(...layout.phaseItemRenderedFontSizes) / Math.min(...pcLayout.phaseItemFontSizes);
    const actualTitleScale = layout.phaseTitleRenderedFontSize / pcLayout.phaseTitleFontSize;
    const renderedPhaseScale = layout.phase!.height / pcLayout.phase!.height;

    expect(actualFontScale, `${viewportCase.label} ${stateCase.label} 阶段字号必须按 board-shell 缩放等比，不得 clamp 成另一套移动字号`).toBeGreaterThanOrEqual(expectedScale * 0.96);
    expect(actualFontScale, `${viewportCase.label} ${stateCase.label} 阶段字号必须按 board-shell 缩放等比，不得 clamp 成另一套移动字号`).toBeLessThanOrEqual(expectedScale * 1.04);
    expect(actualTitleScale, `${viewportCase.label} ${stateCase.label} 阶段标题字号必须按 board-shell 缩放等比`).toBeGreaterThanOrEqual(expectedScale * 0.96);
    expect(actualTitleScale, `${viewportCase.label} ${stateCase.label} 阶段标题字号必须按 board-shell 缩放等比`).toBeLessThanOrEqual(expectedScale * 1.04);
    expect(renderedPhaseScale, `${viewportCase.label} ${stateCase.label} 阶段区最终屏幕高度不得膨胀成手机专用重排`).toBeLessThanOrEqual(expectedScale * 1.08);
};

const expectCenterBoardKeepsPcProportion = (
    layout: HudLayoutSnapshot,
    viewportCase: ViewportCase,
    pcLayout: HudLayoutSnapshot,
    stateCase: HudStateCase,
): void => {
    const expectedScale = Number.parseFloat(layout.cssVars.boardShellScale) || (viewportCase.width / PC_BASELINE_WIDTH);
    const renderedBoardScale = layout.playerBoard!.height / pcLayout.playerBoard!.height;

    expect(renderedBoardScale, `${viewportCase.label} ${stateCase.label} 玩家面板必须跟 PC 按 board-shell 等比缩放，不得被手机端另设小尺寸`).toBeGreaterThanOrEqual(expectedScale * 0.96);
    expect(renderedBoardScale, `${viewportCase.label} ${stateCase.label} 玩家面板必须跟 PC 按 board-shell 等比缩放，不得被手机端另设小尺寸`).toBeLessThanOrEqual(expectedScale * 1.04);
};

const expectLeftHudLayout = (
    layout: HudLayoutSnapshot,
    viewportCase: ViewportCase,
    stateCase: HudStateCase,
    pcLayout?: HudLayoutSnapshot,
): void => {
    expect(layout.gamePageDataset.gameId).toBe('dicethrone');
    expect(layout.phaseItemCount, `${viewportCase.label} ${stateCase.label} 阶段提示必须保留完整 7 项`).toBe(7);
    expect(layout.activePhaseItemCount, `${viewportCase.label} ${stateCase.label} 当前高亮必须为 1 个；总阶段项由上一条断言锁定为 7 个`).toBe(1);
    expect(layout.visibleTokenCount, `${viewportCase.label} ${stateCase.label} Token 数量必须和该状态一致`).toBe(stateCase.expectedTokens);
    expect(layout.visibleStatusCount, `${viewportCase.label} ${stateCase.label} 状态图标数量必须和该状态一致`).toBe(stateCase.expectedStatuses);
    expect(
        layout.protectedIconSizes.every((size) => size === 'normal'),
        `${viewportCase.label} ${stateCase.label} Token / 状态视觉尺寸必须保持 PC 同构 normal，不得切 mobile-pressure small`,
    ).toBe(true);
    expect(layout.shell, `${viewportCase.label} ${stateCase.label} mobile board shell 必须有可见矩形`).not.toBeNull();
    expect(layout.sidebar, `${viewportCase.label} ${stateCase.label} 左侧 HUD 必须有可见矩形`).not.toBeNull();
    expect(layout.selfPanelGroup, `${viewportCase.label} ${stateCase.label} Token / 生命 / 牌堆底部组合必须有可见矩形`).not.toBeNull();
    expect(layout.phase, `${viewportCase.label} ${stateCase.label} 阶段提示必须有可见矩形`).not.toBeNull();
    expect(layout.stats, `${viewportCase.label} ${stateCase.label} 生命和 CP 区必须有可见矩形`).not.toBeNull();
    expect(layout.deck, `${viewportCase.label} ${stateCase.label} 牌堆区必须有可见矩形`).not.toBeNull();
    expect(layout.deckCard, `${viewportCase.label} ${stateCase.label} 真实牌堆面必须有可见矩形`).not.toBeNull();
    expect(layout.playerBoard, `${viewportCase.label} ${stateCase.label} 玩家面板必须有可见矩形`).not.toBeNull();
    expect(layout.handToggle, `${viewportCase.label} ${stateCase.label} 手牌隐藏按钮必须有可见矩形`).not.toBeNull();
    expect(layout.handToggleHitArea, `${viewportCase.label} ${stateCase.label} 手牌隐藏按钮透明触控热区必须存在`).not.toBeNull();

    expectSameColumnLayout(layout, `${viewportCase.label} ${stateCase.label}`);

    expect(layout.overlaps.phaseStats, `${viewportCase.label} ${stateCase.label} 阶段提示不得压住生命 / CP 区`).toBe(false);
    expect(layout.overlaps.phaseDeck, `${viewportCase.label} ${stateCase.label} 阶段提示不得压住牌堆`).toBe(false);
    if (stateCase.expectedTokens > 0 || stateCase.expectedStatuses > 0) {
        expect(layout.statusTokens, `${viewportCase.label} ${stateCase.label} Token / 状态区必须有可见矩形`).not.toBeNull();
        expect(layout.overlaps.phaseStatusTokens, `${viewportCase.label} ${stateCase.label} 阶段提示不得压住 Token / 状态区`).toBe(false);
    }

    expectRectInsideViewport(layout.sidebar!, layout.viewport, `${viewportCase.label} ${stateCase.label} 左侧 HUD`);
    expectRectInsideViewport(layout.selfPanelGroup!, layout.viewport, `${viewportCase.label} ${stateCase.label} Token / 生命 / 牌堆底部组合`);
    expectRectInsideViewport(layout.phase!, layout.viewport, `${viewportCase.label} ${stateCase.label} 阶段提示`);
    expectRectInsideViewport(layout.stats!, layout.viewport, `${viewportCase.label} ${stateCase.label} 生命和 CP 区`);
    expectRectInsideViewport(layout.deck!, layout.viewport, `${viewportCase.label} ${stateCase.label} 牌堆区`);
    expectRectInsideViewport(layout.deckCard!, layout.viewport, `${viewportCase.label} ${stateCase.label} 真实牌堆面`);
    expectRectInsideViewport(layout.playerBoard!, layout.viewport, `${viewportCase.label} ${stateCase.label} 玩家面板`);
    expectRectInsideViewport(layout.handToggle!, layout.viewport, `${viewportCase.label} ${stateCase.label} 手牌隐藏按钮可见面`);
    expectRectInsideViewport(layout.handToggleHitArea!, layout.viewport, `${viewportCase.label} ${stateCase.label} 手牌隐藏按钮透明触控热区`);
    for (const [index, rect] of layout.protectedIconRects.entries()) {
        expectRectInsideViewport(rect, layout.viewport, `${viewportCase.label} ${stateCase.label} 第 ${index + 1} 个 Token / 状态图标`);
    }

    if (!viewportCase.mobile) {
        expect(Math.min(...layout.phaseItemFontSizes), 'PC 阶段项应保持旧版可读比例').toBeGreaterThanOrEqual(14);
        return;
    }

    expect(layout.gamePageDataset.mobileProfile).toBe('landscape-adapted');
    expect(layout.gamePageDataset.mobileLayoutPreset).toBe('board-shell');
    expect(layout.leftHudDensity, `${viewportCase.label} ${stateCase.label} 左侧 HUD 必须保持 PC 同构 normal 密度，不得按 Token 压力态改小`).toBe('normal');
    expect(layout.cssVars.boardShellDesignWidth, `${viewportCase.label} ${stateCase.label} DiceThrone 手机壳层必须使用 2340x1080 横屏设计宽度`).toBe(DICETHRONE_MOBILE_SHELL_DESIGN_WIDTH);
    expect(layout.cssVars.boardShellDesignHeight, `${viewportCase.label} ${stateCase.label} DiceThrone 手机壳层必须使用 2340x1080 横屏设计高度`).toBe(DICETHRONE_MOBILE_SHELL_DESIGN_HEIGHT);
    expect(layout.cssVars.boardShellReferenceWidth, `${viewportCase.label} ${stateCase.label} 壳内 UI 单位必须继续使用 1920x1080 PC 参考宽度`).toBe(DICETHRONE_PC_REFERENCE_WIDTH);
    expect(layout.cssVars.boardShellReferenceHeight, `${viewportCase.label} ${stateCase.label} 壳内 UI 单位必须继续使用 1920x1080 PC 参考高度`).toBe(DICETHRONE_PC_REFERENCE_HEIGHT);
    expect(layout.shell!.left, `${viewportCase.label} ${stateCase.label} mobile board shell 左边界必须在屏内`).toBeGreaterThanOrEqual(-1);
    expect(layout.shell!.right, `${viewportCase.label} ${stateCase.label} mobile board shell 右边界必须在屏内`).toBeLessThanOrEqual(layout.viewport.width + 1);
    expect(layout.documentScrollWidth, `${viewportCase.label} ${stateCase.label} html 不应横向溢出`).toBeLessThanOrEqual(layout.viewport.width + 1);
    expect(layout.bodyScrollWidth, `${viewportCase.label} ${stateCase.label} body 不应横向溢出`).toBeLessThanOrEqual(layout.viewport.width + 1);
    expect(layout.phase!.height / layout.sidebar!.height, `${viewportCase.label} ${stateCase.label} 阶段提示不能膨胀挤掉 Token / 底部槽位`).toBeLessThanOrEqual(0.48);
    expect(layout.gaps.phaseToStats, `${viewportCase.label} ${stateCase.label} 阶段提示下方必须保留底部 HUD 空间`).not.toBeNull();
    const minimumScaledGap = Math.max(4, viewportCase.width * 0.006);
    expect(layout.gaps.phaseToStats!, `${viewportCase.label} ${stateCase.label} 阶段提示下方必须保留按手机视口缩放后的可见分隔`).toBeGreaterThanOrEqual(minimumScaledGap);
    if (stateCase.expectedTokens > 0 || stateCase.expectedStatuses > 0) {
        expect(layout.gaps.phaseToStatusTokens, `${viewportCase.label} ${stateCase.label} 阶段提示下方必须留出 Token / 状态槽位`).not.toBeNull();
        expect(layout.gaps.phaseToStatusTokens!, `${viewportCase.label} ${stateCase.label} 阶段提示下方必须留出 Token / 状态槽位`).toBeGreaterThanOrEqual(minimumScaledGap);
    }
    expect(layout.deckCard!.width, `${viewportCase.label} ${stateCase.label} 真实牌堆面不能被压成移动端小牌堆`).toBeGreaterThanOrEqual(viewportCase.width * 0.08);
    expect(layout.handToggle!.width, `${viewportCase.label} ${stateCase.label} 手牌隐藏按钮可见面不能被 44px 触控下限放大`).toBeLessThanOrEqual(viewportCase.width * 0.03);
    expect(layout.handToggle!.height, `${viewportCase.label} ${stateCase.label} 手牌隐藏按钮可见面不能被 44px 触控下限放大`).toBeLessThanOrEqual(viewportCase.width * 0.03);
    expect(layout.handToggleHitArea!.width, `${viewportCase.label} ${stateCase.label} 手牌隐藏按钮透明热区需接近 44px`).toBeGreaterThanOrEqual(42);
    expect(layout.handToggleHitArea!.height, `${viewportCase.label} ${stateCase.label} 手牌隐藏按钮透明热区需接近 44px`).toBeGreaterThanOrEqual(42);

    if (pcLayout) {
        expectPhaseKeepsViewportProportion(layout, viewportCase, pcLayout, stateCase);
        expectCenterBoardKeepsPcProportion(layout, viewportCase, pcLayout, stateCase);
    }
};

test.describe('DiceThrone 左侧 HUD 手机横屏回归', () => {
    test('阶段提示沿用 PC 单列比例，并覆盖无 Token 常态与 Token 压力态', async ({ page, game }, testInfo) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await clearEvidenceScreenshotsForTest(testInfo);

        const screenshotPaths: string[] = [];
        const pcLayoutsByState = new Map<string, HudLayoutSnapshot>();

        await page.setViewportSize({ width: 1920, height: 1080 });
        await game.openTestGame('dicethrone', { playerID: PLAYER_ID, disableLocalAiAutomation: true }, OPEN_TIMEOUT_MS);

        for (const stateCase of hudStateCases) {
            await page.setViewportSize({ width: 1920, height: 1080 });
            await setupLeftHudState(game, stateCase);
            await waitForDiceThroneHarness(page);
            await closeDebugPanelIfOpen(page);

            for (const [viewportIndex, viewportCase] of viewportCases.entries()) {
                await page.setViewportSize({ width: viewportCase.width, height: viewportCase.height });
                await waitForLeftHudState(page, stateCase);
                const layout = await readHudLayout(page);
                const pcLayout = viewportCase.mobile ? pcLayoutsByState.get(stateCase.id) : undefined;

                console.info(JSON.stringify({
                    evidence: 'dicethrone-left-sidebar-mobile-regression-layout',
                    state: stateCase.label,
                    viewport: viewportCase.label,
                    layout: summariseLayout(layout),
                }, null, 2));

                expectLeftHudLayout(layout, viewportCase, stateCase, pcLayout);
                if (!viewportCase.mobile) {
                    pcLayoutsByState.set(stateCase.id, layout);
                }

                const screenshotOrder = (hudStateCases.indexOf(stateCase) * viewportCases.length) + viewportIndex + 1;
                const screenshotName = `${String(screenshotOrder).padStart(2, '0')}-${viewportCase.screenshotPrefix}-${stateCase.screenshotLabel}-左侧阶段与Token对照`;
                screenshotPaths.push(await saveEvidenceScreenshot(page, testInfo, screenshotName));
            }
        }

        console.info(JSON.stringify({
            evidence: 'dicethrone-left-sidebar-mobile-regression',
            screenshots: screenshotPaths,
        }, null, 2));
    });

    test('真实 2340x1080 手机横屏原图覆盖无 Token 常态与 Token 压力态', async ({ browser, baseURL, workerPorts }, testInfo) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await clearEvidenceScreenshotsForTest(testInfo);

        const screenshotPaths: string[] = [];
        const { context, page, game } = await createTrueDeviceEvidenceContext(browser, baseURL, workerPorts);
        const diagnostics = attachPageDiagnostics(page);

        try {
            await game.openTestGame('dicethrone', { playerID: PLAYER_ID, disableLocalAiAutomation: true }, OPEN_TIMEOUT_MS);

            for (const stateCase of hudStateCases) {
                await setupLeftHudState(game, stateCase);
                await waitForDiceThroneHarness(page);
                await closeDebugPanelIfOpen(page);
                await waitForLeftHudState(page, stateCase);

                const deviceViewport = await page.evaluate(() => ({
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight,
                    devicePixelRatio: window.devicePixelRatio,
                }));
                expect(deviceViewport.innerWidth, '真实设备取证 CSS 视口宽度应为 936，配合 DPR 2.5 输出 2340px 原图').toBe(trueDeviceMobileViewportCase.width);
                expect(deviceViewport.innerHeight, '真实设备取证 CSS 视口高度应为 432，配合 DPR 2.5 输出 1080px 原图').toBe(trueDeviceMobileViewportCase.height);
                expect(deviceViewport.devicePixelRatio, '真实设备取证必须使用 DPR 2.5，而不是只截 936x432 缩略图').toBe(TRUE_DEVICE_DPR);

                const layout = await readHudLayout(page);
                console.info(JSON.stringify({
                    evidence: 'dicethrone-left-sidebar-true-device-layout',
                    state: stateCase.label,
                    viewport: trueDeviceMobileViewportCase.label,
                    layout: summariseLayout(layout),
                    deviceViewport,
                }, null, 2));

                expectLeftHudLayout(layout, trueDeviceMobileViewportCase, stateCase);

                const screenshotName = `${String(screenshotPaths.length + 1).padStart(2, '0')}-${trueDeviceMobileViewportCase.screenshotPrefix}-${stateCase.screenshotLabel}-左侧阶段与Token对照`;
                const screenshotPath = await saveEvidenceScreenshot(page, testInfo, screenshotName);
                const dimensions = await readJpegDimensions(screenshotPath);
                expect(dimensions, 'DPR 2.5 手机横屏截图必须是 2340x1080 原图尺寸').toEqual({
                    width: TRUE_DEVICE_SCREENSHOT_WIDTH,
                    height: TRUE_DEVICE_SCREENSHOT_HEIGHT,
                });
                screenshotPaths.push(screenshotPath);
            }

            console.info(JSON.stringify({
                evidence: 'dicethrone-left-sidebar-true-device-screenshots',
                cssViewport: {
                    width: trueDeviceMobileViewportCase.width,
                    height: trueDeviceMobileViewportCase.height,
                },
                deviceScaleFactor: TRUE_DEVICE_DPR,
                screenshotPixels: {
                    width: TRUE_DEVICE_SCREENSHOT_WIDTH,
                    height: TRUE_DEVICE_SCREENSHOT_HEIGHT,
                },
                screenshots: screenshotPaths,
            }, null, 2));
        } finally {
            await assertNoFatalFrontendErrors([{ label: 'true-device-page', diagnostics }]);
            await context.close();
        }
    });
});
