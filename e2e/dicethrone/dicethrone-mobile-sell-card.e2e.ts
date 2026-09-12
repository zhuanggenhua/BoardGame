import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Browser, BrowserContext, BrowserContextOptions, Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import type { WorkerPorts } from '../framework';
import { GameTestContext } from '../framework/GameTestContext';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath, withJpegEvidenceScreenshotOptions } from '../framework/evidenceScreenshots';
import { assertNoFatalFrontendErrors, attachPageDiagnostics, initContext } from '../helpers/common';
import { disableFabMenu, ensureDebugPanelClosed, waitForDiceThroneHarness } from '../helpers/dicethrone';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';

const PLAYER_ID = '0';
const OPEN_TIMEOUT_MS = 45000;
const TEST_TIMEOUT_MS = 120000;
const TRUE_DEVICE_DPR = 2.5;
const MOBILE_CONTEXT_OPTIONS: BrowserContextOptions = {
    viewport: { width: 936, height: 432 },
    screen: { width: 936, height: 432 },
    deviceScaleFactor: TRUE_DEVICE_DPR,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

const HAND_CARD_IDS = ['card-just-this', 'card-play-six', 'card-unexpected'];
const DECK_CARD_IDS = ['card-flick', 'card-get-that-outta-here'];

type PlayerSnapshot = {
    handIds: string[];
    discardIds: string[];
    cp: number | null;
};

type RectSnapshot = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.jpg`,
        requireChineseName: true,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({ path, fullPage: false, timeout: 20000 }));
    return path;
};

const createMobileDiceThroneContext = async (
    browser: Browser,
    baseURL: string | undefined,
    workerPorts: WorkerPorts,
): Promise<{ context: BrowserContext; page: Page; game: GameTestContext }> => {
    const context = await browser.newContext({
        baseURL,
        ...MOBILE_CONTEXT_OPTIONS,
    });
    await initContext(context, {
        storageKey: '__dicethrone_mobile_sell_card_storage_reset',
        skipImageGate: true,
        gameServerBaseURL: `http://127.0.0.1:${workerPorts.gameServer}`,
        apiServerBaseURL: `http://127.0.0.1:${workerPorts.apiServer}`,
    });
    await context.addInitScript((ports) => {
        (window as Window & { __E2E_WORKER_PORTS__?: WorkerPorts }).__E2E_WORKER_PORTS__ = ports;
    }, workerPorts);
    await context.addInitScript(() => {
        (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;
    });

    const page = await context.newPage();
    return {
        context,
        page,
        game: new GameTestContext(page),
    };
};

const setupMainPhaseHand = async (page: Page, game: GameTestContext) => {
    await game.openTestGame('dicethrone', { playerID: PLAYER_ID, disableLocalAiAutomation: true }, OPEN_TIMEOUT_MS);
    await waitForDiceThroneHarness(page, 40000);
    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: HAND_CARD_IDS,
            deck: DECK_CARD_IDS,
            resources: { CP: 3, HP: 50 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
        },
        currentPlayer: PLAYER_ID,
        phase: 'main1',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            hostStarted: true,
        },
    });

    await waitForHandCardsReady(page, HAND_CARD_IDS);
};

const waitForHandCardsReady = async (page: Page, cardIds: string[]) => {
    await page.waitForFunction((expectedCardIds) => {
        const handArea = document.querySelector('[data-testid="hand-area"]');
        if (!handArea) return false;
        return (expectedCardIds as string[]).every((cardId) => {
            const card = handArea.querySelector(`[data-card-id="${cardId}"]`);
            if (!card) return false;
            const rect = (card as HTMLElement).getBoundingClientRect();
            return rect.width > 0
                && rect.height > 0
                && card.getAttribute('data-is-flipped') === 'true';
        });
    }, cardIds, { timeout: 15000, polling: 100 });
    await page.waitForTimeout(500);
};

const readPlayerSnapshot = async (page: Page): Promise<PlayerSnapshot> => page.evaluate(({ playerId, cpResourceId }) => {
    const state = (window as Window).__BG_TEST_HARNESS__?.state?.get?.();
    const player = state?.core?.players?.[playerId];
    return {
        handIds: (player?.hand ?? []).map((card: { id?: string }) => card.id).filter(Boolean),
        discardIds: (player?.discard ?? []).map((card: { id?: string }) => card.id).filter(Boolean),
        cp: typeof player?.resources?.[cpResourceId] === 'number' ? player.resources[cpResourceId] : null,
    };
}, { playerId: PLAYER_ID, cpResourceId: RESOURCE_IDS.CP });

const waitForCardSold = async (page: Page, cardId: string, before: PlayerSnapshot) => {
    await expect.poll(async () => readPlayerSnapshot(page), {
        message: `卖出 ${cardId} 后，必须看到手牌移除、弃牌堆新增、CP +1`,
        timeout: 10000,
    }).toMatchObject({
        handIds: expect.not.arrayContaining([cardId]),
        discardIds: expect.arrayContaining([cardId]),
        cp: (before.cp ?? 0) + 1,
    });
};

const readSellLayout = async (page: Page, cardId: string) => page.evaluate((targetCardId) => {
    const rectOf = (element: Element | null): RectSnapshot | null => {
        if (!element) return null;
        const rect = (element as HTMLElement).getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
        };
    };
    const card = document.querySelector(`[data-testid="hand-area"] [data-card-id="${targetCardId}"]`);
    const sellButton = card?.querySelector('[data-testid="dt-hand-card-sell-button"]') ?? null;
    const pile = document.querySelector('[data-testid="discard-pile"]');
    const shell = document.querySelector('.mobile-board-shell');
    const buttonRect = rectOf(sellButton);
    const buttonCenter = buttonRect
        ? { x: buttonRect.left + buttonRect.width / 2, y: buttonRect.top + buttonRect.height / 2 }
        : null;
    const foregroundCardId = buttonCenter
        ? (document.elementFromPoint(buttonCenter.x, buttonCenter.y) as HTMLElement | null)
            ?.closest('[data-card-id]')
            ?.getAttribute('data-card-id') ?? null
        : null;
    return {
        viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        card: rectOf(card),
        sellButton: buttonRect,
        discardPile: rectOf(pile),
        shell: rectOf(shell),
        foregroundCardId,
    };
}, cardId);

const sellByButton = async (page: Page, cardId: string) => {
    const sellButton = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"] [data-testid="dt-hand-card-sell-button"]`).first();
    await expect(sellButton, '触控端手牌上必须显示可点的售卖按钮').toBeVisible({ timeout: 10000 });
    const buttonBox = await sellButton.boundingBox();
    if (!buttonBox || buttonBox.width < 44 || buttonBox.height < 44) {
        throw new Error(`售卖按钮触控热区不足 44px：${JSON.stringify(buttonBox)}`);
    }
    const center = {
        x: buttonBox.x + buttonBox.width / 2,
        y: buttonBox.y + buttonBox.height / 2,
    };
    const foregroundCardId = await page.evaluate(({ x, y }) => (
        (document.elementFromPoint(x, y) as HTMLElement | null)
            ?.closest('[data-card-id]')
            ?.getAttribute('data-card-id') ?? null
    ), center);
    expect(foregroundCardId, '点击售卖按钮中心时，前景必须仍归属于目标手牌').toBe(cardId);
    await page.touchscreen.tap(center.x, center.y);
};

test.describe('DiceThrone 手机端卖牌交互', () => {
    test('手机横屏触控端可以点手牌售卖按钮完成卖牌', async ({ browser, baseURL, workerPorts }, testInfo) => {
        test.setTimeout(TEST_TIMEOUT_MS);
        await clearEvidenceScreenshotsForTest(testInfo);
        const { context, page, game } = await createMobileDiceThroneContext(browser, baseURL, workerPorts);
        const diagnostics = attachPageDiagnostics(page);
        const cardId = 'card-unexpected';
        const screenshotPaths: string[] = [];

        try {
            await setupMainPhaseHand(page, game);
            const layout = await readSellLayout(page, cardId);
            expect(layout.viewport).toEqual({ width: 936, height: 432, dpr: TRUE_DEVICE_DPR });
            expect(layout.documentScrollWidth, '手机横屏不应产生页面横向溢出').toBeLessThanOrEqual(layout.viewport.width + 1);
            expect(layout.bodyScrollWidth, '手机横屏 body 不应产生横向溢出').toBeLessThanOrEqual(layout.viewport.width + 1);
            expect(layout.shell, 'mobile board shell 必须存在').not.toBeNull();
            expect(layout.shell!.left, 'mobile board shell 左边界不能出屏').toBeGreaterThanOrEqual(-1);
            expect(layout.shell!.right, 'mobile board shell 右边界不能出屏').toBeLessThanOrEqual(layout.viewport.width + 1);
            expect(layout.sellButton, '售卖按钮必须有可见矩形').not.toBeNull();
            expect(layout.sellButton!.width, '售卖按钮最终触控宽度必须不小于 44px').toBeGreaterThanOrEqual(44);
            expect(layout.sellButton!.height, '售卖按钮最终触控高度必须不小于 44px').toBeGreaterThanOrEqual(44);
            expect(layout.foregroundCardId, '售卖按钮中心不能被旁边手牌盖住').toBe(cardId);
            screenshotPaths.push(await saveEvidenceScreenshot(page, testInfo, '01-手机横屏-手牌售卖按钮可见'));

            const before = await readPlayerSnapshot(page);
            expect(before.handIds).toContain(cardId);
            expect(before.cp).toBe(3);

            await sellByButton(page, cardId);
            await waitForCardSold(page, cardId, before);
            screenshotPaths.push(await saveEvidenceScreenshot(page, testInfo, '02-手机横屏-点击售卖后CP增加且牌进弃牌堆'));

            console.info(JSON.stringify({
                evidence: 'dicethrone-mobile-sell-card-button',
                screenshots: screenshotPaths,
            }, null, 2));
        } finally {
            await assertNoFatalFrontendErrors([{ label: 'dicethrone-mobile-sell-button-page', diagnostics }]);
            await context.close();
        }
    });
});
