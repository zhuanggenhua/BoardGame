/**
 * 角色选择系统 E2E 测试
 * 验证重构后的角色选择功能是否正常工作
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
    createGuestId,
    ensureGameServerAvailable,
    joinMatchViaAPI,
    resetMatchStorage,
    seedMatchCredentials,
    setChineseLocale,
    waitForHomeGameList,
} from '../helpers/common';

const selectionTitlePattern = /选择你的英雄|Choose your hero|Select Your Hero/i;
const readyButtonPattern = /准备|Ready/i;
const closePreviewPattern = /关闭预览|Close Preview/i;
const playerBoardAltPattern = /玩家面板|Player Board/i;
const turnPattern = /回合|Turn/i;
const diceThroneHeadingPattern = /Dice Throne|王权骰铸/i;
const createRoomPattern = /Create Room|创建房间/i;
const confirmPattern = /Confirm|确认/i;
const v2PlayerBoardAspectRatio = 2048 / 1248;

/** 通过 UI 打开 DiceThrone 房间（此文件特有的 UI 流程） */
const openDiceThroneRoom = async (page: Page) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHomeGameList(page);
    await expect(page.getByRole('heading', { name: diceThroneHeadingPattern })).toBeVisible();
    await page.getByRole('heading', { name: diceThroneHeadingPattern }).click();
    await page.getByTestId('game-details-open-create-room').first().click();
    await expect(page.getByRole('heading', { name: createRoomPattern })).toBeVisible();
    await page.getByRole('button', { name: confirmPattern }).click();
    try {
        await page.waitForURL(/\/play\/dicethrone\/match\//, { timeout: 8000 });
    } catch {
        test.skip(true, 'Room creation failed or backend unavailable.');
    }
};

const getMatchIdFromUrl = (page: Page) => {
    const url = new URL(page.url());
    const matchId = url.pathname.split('/').pop();
    if (!matchId) {
        throw new Error('Failed to parse match id from URL.');
    }
    return matchId;
};

const ensureHostPlayerId = async (page: Page) => {
    const url = new URL(page.url());
    if (!url.searchParams.get('playerID')) {
        url.searchParams.set('playerID', '0');
        await page.goto(url.toString());
    }
};

const waitForOverlayState = async (page: Page, overlayTestId: string, expected: 'open' | 'closed') => {
    await expect.poll(async () => page.evaluate(({ testId, target }) => {
        const overlays = Array.from(document.querySelectorAll(`[data-testid="${testId}"]`)) as HTMLElement[];
        const visibleCount = overlays.filter((overlay) => {
            const styles = window.getComputedStyle(overlay);
            return styles.display !== 'none'
                && styles.visibility !== 'hidden'
                && styles.pointerEvents !== 'none'
                && styles.opacity !== '0';
        }).length;
        return target === 'open' ? visibleCount > 0 : visibleCount === 0;
    }, { testId: overlayTestId, target: expected }), { timeout: 5000 }).toBe(true);
};

const waitForSelectionOverlay = async (page: Page) => {
    await expect(page.locator('[data-testid="character-selection-overlay"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(selectionTitlePattern)).toBeVisible({ timeout: 15000 });
};

const prepareHostSelection = async (page: Page) => {
    await setChineseLocale(page.context());
    await resetMatchStorage(page.context(), '__dicethrone_character_selection_host_storage_reset');
    if (!await ensureGameServerAvailable(page)) {
        test.skip(true, 'Game server unavailable for online tests.');
    }
    await openDiceThroneRoom(page);
    await ensureHostPlayerId(page);
    await waitForSelectionOverlay(page);
};

const withOnlineMatch = async (page: Page, run: (guestPage: Page) => Promise<void>) => {
    await prepareHostSelection(page);
    const { guestContext, guestPage } = await joinGuest(page);
    try {
        await run(guestPage);
    } finally {
        await guestContext.close();
    }
};

const joinGuest = async (page: Page): Promise<{ guestContext: BrowserContext; guestPage: Page }> => {
    const browser = page.context().browser();
    if (!browser) throw new Error('Browser instance not available.');
    const hostUrl = new URL(page.url());
    const matchId = hostUrl.pathname.split('/').pop();
    if (!matchId) throw new Error('Failed to parse match id from host URL.');

    const guestContext = await browser.newContext();
    await setChineseLocale(guestContext);
    await resetMatchStorage(guestContext, '__dicethrone_character_selection_guest_storage_reset');
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`${hostUrl.origin}/play/dicethrone/match/${matchId}?join=true`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
    });
    await guestPage.waitForURL(/playerID=\d/, { timeout: 20000 });
    await expect(guestPage.getByText(selectionTitlePattern)).toBeVisible({ timeout: 15000 });
    return { guestContext, guestPage };
};

test.describe('角色选择系统', () => {
    test('应该显示角色选择界面', async ({ page }) => {
        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'character-selection.e2e', '应该显示角色选择界面');
        mkdirSync(evidenceDir, { recursive: true });
        const evidencePath = join(evidenceDir, 'character-selection-mobile-portrait.png');

        await page.setViewportSize({ width: 375, height: 812 });
        await prepareHostSelection(page);
        await expect(page.getByText(selectionTitlePattern)).toBeVisible();
        await expect(page.locator('[data-character-id="monk"]')).toBeVisible();
        await expect(page.locator('[data-character-id="barbarian"]')).toBeVisible();
        await expect(page.locator('[data-character-id="pyromancer"]')).toBeVisible();
        await expect(page.locator('[data-character-id="gunslinger"]')).toBeVisible();
        await expect(page.locator('[data-character-id="samurai"]')).toBeVisible();
        await page.screenshot({ path: evidencePath, fullPage: false });
    });

    test('应该能够切换角色', async ({ page }) => {
        await prepareHostSelection(page);
        await page.click('[data-character-id="monk"]');
        await page.waitForTimeout(500);
        await expect(page.locator('[data-character-id="monk"]')).toHaveClass(/border-amber-400/);

        await page.click('[data-character-id="barbarian"]');
        await page.waitForTimeout(500);
        await expect(page.locator('[data-character-id="barbarian"]')).toHaveClass(/border-amber-400/);
        await expect(page.locator('[data-character-id="monk"]')).not.toHaveClass(/border-amber-400/);
        await expect(page.locator('[data-character-id="barbarian"]')).toContainText(/P1/i);
        await expect(page.locator('[data-character-id="monk"]')).not.toContainText(/P1/i);
    });

    test('应该能够放大预览第二版角色面板且不被裁剪', async ({ page }) => {
        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'character-selection.e2e', '应该能够放大预览第二版角色面板且不被裁剪');
        mkdirSync(evidenceDir, { recursive: true });
        const evidencePath = join(evidenceDir, 'samurai-v2-player-board-magnify-open.png');

        await prepareHostSelection(page);
        await page.click('[data-character-id="samurai"]');
        await page.waitForTimeout(1000);
        await page.getByAltText(playerBoardAltPattern).click();
        await page.waitForTimeout(500);

        const closeButton = page.getByRole('button', { name: closePreviewPattern }).first();
        const previewOverlay = page.getByTestId('character-selection-magnify-overlay');
        const previewContent = closeButton.locator('xpath=following-sibling::div[1]');
        const previewImage = page.locator('[data-interaction-allow] img[alt="Preview"]').last();
        await waitForOverlayState(page, 'character-selection-magnify-overlay', 'open');
        await expect(previewOverlay).toBeAttached();
        await expect(closeButton).toBeVisible();
        await expect(previewContent).toBeVisible();
        await page.screenshot({ path: evidencePath, fullPage: false });

        const previewBox = await previewContent.boundingBox();
        expect(previewBox, '预览内容应提供边界框').not.toBeNull();
        const viewportSize = page.viewportSize();
        expect(viewportSize).not.toBeNull();
        expect(previewBox!.x).toBeGreaterThanOrEqual(0);
        expect(previewBox!.y).toBeGreaterThanOrEqual(0);
        expect(previewBox!.x + previewBox!.width).toBeLessThanOrEqual((viewportSize?.width ?? 0) + 1);
        expect(previewBox!.y + previewBox!.height).toBeLessThanOrEqual((viewportSize?.height ?? 0) + 1);

        const previewImageCount = await previewImage.count();
        if (previewImageCount > 0) {
            const naturalWidth = await previewImage.evaluate((node) => (node as HTMLImageElement).naturalWidth);
            if (naturalWidth > 0) {
                const renderedRatio = previewBox!.width / previewBox!.height;
                expect(Math.abs(renderedRatio - v2PlayerBoardAspectRatio)).toBeLessThan(0.06);
            }
        } else {
            const renderedRatio = previewBox!.width / previewBox!.height;
            expect(Math.abs(renderedRatio - v2PlayerBoardAspectRatio)).toBeLessThan(0.06);
        }

        await closeButton.click();
        await waitForOverlayState(page, 'character-selection-magnify-overlay', 'closed');
    });

    test('手机横屏下选角界面不应出现顶层横向滚动', async ({ page }, testInfo) => {
        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'mobile-character-selection');
        mkdirSync(evidenceDir, { recursive: true });
        const evidencePath = join(evidenceDir, 'character-selection-mobile-landscape.png');

        await page.setViewportSize({ width: 800, height: 450 });
        await prepareHostSelection(page);

        const overlay = page.locator('[data-testid="character-selection-overlay"]');
        await expect(overlay).toBeVisible({ timeout: 15000 });

        const metrics = await page.evaluate(() => {
            const gamePage = document.querySelector<HTMLElement>('[data-game-page="true"]');
            const overlayEl = document.querySelector<HTMLElement>('[data-testid="character-selection-overlay"]');
            const gamePageRect = gamePage?.getBoundingClientRect() ?? null;
            const overlayRect = overlayEl?.getBoundingClientRect() ?? null;

            return {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                docScrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth,
                rootScrollWidth: document.getElementById('root')?.scrollWidth ?? null,
                gamePageRect: gamePageRect
                    ? {
                        left: gamePageRect.left,
                        right: gamePageRect.right,
                        top: gamePageRect.top,
                        bottom: gamePageRect.bottom,
                        width: gamePageRect.width,
                        height: gamePageRect.height,
                    }
                    : null,
                overlayRect: overlayRect
                    ? {
                        left: overlayRect.left,
                        right: overlayRect.right,
                        top: overlayRect.top,
                        bottom: overlayRect.bottom,
                        width: overlayRect.width,
                        height: overlayRect.height,
                    }
                    : null,
            };
        });

        const maxAllowedWidth = metrics.innerWidth + 1;
        const maxAllowedHeight = metrics.innerHeight + 1;

        expect(metrics.docScrollWidth, '手机横屏选角时 documentElement 不应横向溢出').toBeLessThanOrEqual(maxAllowedWidth);
        expect(metrics.bodyScrollWidth, '手机横屏选角时 body 不应横向溢出').toBeLessThanOrEqual(maxAllowedWidth);
        if (metrics.rootScrollWidth !== null) {
            expect(metrics.rootScrollWidth, '手机横屏选角时 #root 不应横向溢出').toBeLessThanOrEqual(maxAllowedWidth);
        }

        expect(metrics.gamePageRect, '应找到游戏页容器').not.toBeNull();
        expect(metrics.overlayRect, '应找到选角覆盖层').not.toBeNull();

        expect(metrics.gamePageRect!.left, '游戏页左边界不应出视口').toBeGreaterThanOrEqual(-1);
        expect(metrics.gamePageRect!.right, '游戏页右边界不应出视口').toBeLessThanOrEqual(maxAllowedWidth);
        expect(metrics.gamePageRect!.bottom, '游戏页底边界不应出视口').toBeLessThanOrEqual(maxAllowedHeight);

        expect(metrics.overlayRect!.left, '选角层左边界不应出视口').toBeGreaterThanOrEqual(-1);
        expect(metrics.overlayRect!.right, '选角层右边界不应出视口').toBeLessThanOrEqual(maxAllowedWidth);
        expect(metrics.overlayRect!.bottom, '选角层底边界不应出视口').toBeLessThanOrEqual(maxAllowedHeight);

        await page.screenshot({ path: evidencePath, fullPage: false });
        await page.screenshot({ path: testInfo.outputPath('character-selection-mobile-landscape.png'), fullPage: false });
    });

    test('加入中加载界面应居中显示（移动端横屏）', async ({ page }, testInfo) => {
        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'character-selection.e2e', '加入中加载界面应居中显示（移动端横屏）');
        mkdirSync(evidenceDir, { recursive: true });
        const evidencePath = join(evidenceDir, 'joining-loading-mobile-landscape.png');

        await prepareHostSelection(page);
        const hostUrl = new URL(page.url());
        const matchId = getMatchIdFromUrl(page);
        const browser = page.context().browser();
        if (!browser) {
            throw new Error('Browser instance not available.');
        }
        const guestContext = await browser.newContext();
        await setChineseLocale(guestContext);
        await resetMatchStorage(guestContext, '__dicethrone_join_loading_storage_reset');
        const guestPage = await guestContext.newPage();

        await guestPage.setViewportSize({ width: 812, height: 375 });

        let continueJoin: (() => void) | null = null;
        await guestPage.route(`**/games/dicethrone/${matchId}/join**`, async (route) => {
            await new Promise<void>((resolve) => {
                continueJoin = resolve;
            });
            await route.continue();
        });

        await guestPage.goto(`${hostUrl.origin}/play/dicethrone/match/${matchId}?join=true`, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
        });
        await expect(guestPage.getByTestId('loading-screen')).toBeVisible({ timeout: 15000 });
        await expect(guestPage.getByTestId('loading-screen-progress')).toHaveText(/校验房间席位/i, { timeout: 20000 });
        await expect(guestPage.getByTestId('loading-screen-progress')).toBeVisible({ timeout: 5000 });

        await guestPage.screenshot({ path: evidencePath, fullPage: false });
        await guestPage.screenshot({ path: testInfo.outputPath('joining-loading-mobile-landscape.png'), fullPage: false });

        if (continueJoin) {
            continueJoin();
        }
        await guestContext.close();
    });

    test('连接中加载界面应居中显示（移动端横屏）', async ({ page }, testInfo) => {
        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'character-selection.e2e', '连接中加载界面应居中显示（移动端横屏）');
        mkdirSync(evidenceDir, { recursive: true });
        const evidencePath = join(evidenceDir, 'connecting-loading-mobile-landscape.png');

        await prepareHostSelection(page);
        const matchId = getMatchIdFromUrl(page);
        const browser = page.context().browser();
        if (!browser) {
            throw new Error('Browser instance not available.');
        }

        const connectingGuestId = createGuestId('dicethrone-connect');
        const connectingCredentials = await joinMatchViaAPI(
            page,
            'dicethrone',
            matchId,
            '1',
            `游客${connectingGuestId}`,
            connectingGuestId,
        );
        if (!connectingCredentials) {
            test.skip(true, '连接中测试无法加入对局，跳过。');
        }

        const connectingContext = await browser.newContext();
        await setChineseLocale(connectingContext);
        await resetMatchStorage(connectingContext, '__dicethrone_connect_loading_storage_reset');
        await seedMatchCredentials(connectingContext, 'dicethrone', matchId, '1', connectingCredentials!);
        const connectingPage = await connectingContext.newPage();

        await connectingPage.setViewportSize({ width: 812, height: 375 });

        await connectingPage.goto('/', { waitUntil: 'domcontentloaded' });
        await waitForHomeGameList(connectingPage);
        await connectingPage.evaluate(async () => {
            const { loadGameImplementation } = await import('/src/games/registry');
            await loadGameImplementation('dicethrone');
        });

        let continueSocket: (() => void) | null = null;
        await connectingPage.route('**/socket.io/**', async (route) => {
            await new Promise<void>((resolve) => {
                continueSocket = resolve;
            });
            await route.continue();
        });

        await connectingPage.evaluate((targetUrl) => {
            window.history.pushState({}, '', targetUrl);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }, `/play/dicethrone/match/${matchId}?playerID=1`);
        await expect(connectingPage.getByTestId('loading-screen')).toBeVisible({ timeout: 15000 });
        const progressLocator = connectingPage.getByTestId('loading-screen-progress');
        await expect(progressLocator).toBeVisible({ timeout: 5000 });
        await expect(progressLocator).toHaveText(/连接服务器|加载游戏模块|加载素材/i, { timeout: 20000 });

        await connectingPage.screenshot({ path: evidencePath, fullPage: false });
        await connectingPage.screenshot({ path: testInfo.outputPath('connecting-loading-mobile-landscape.png'), fullPage: false });

        if (continueSocket) {
            continueSocket();
        }

        await connectingContext.close();
    });

    test('选角后应该能够开始游戏', async ({ page }, testInfo) => {
        const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'character-selection.e2e', '选角后应该能够开始游戏');
        mkdirSync(evidenceDir, { recursive: true });
        const evidencePath = join(evidenceDir, 'dicethrone-game-hud-mobile-landscape.png');

        await withOnlineMatch(page, async (guestPage) => {
            await page.click('[data-character-id="samurai"]');
            await page.waitForTimeout(500);

            await guestPage.click('[data-character-id="gunslinger"]');
            await guestPage.getByRole('button', { name: readyButtonPattern }).click();

            const startButton = page.getByRole('button', { name: /开始游戏|Press Start/i });
            await expect(startButton).toBeEnabled();
            await startButton.click();
            await page.waitForTimeout(2000);

            await expect(page.getByText(selectionTitlePattern)).not.toBeVisible();
            await expect(page.getByText(turnPattern)).toBeVisible();

            await page.setViewportSize({ width: 812, height: 375 });
            await page.screenshot({ path: evidencePath, fullPage: false });
            await page.screenshot({ path: testInfo.outputPath('dicethrone-game-hud-mobile-landscape.png'), fullPage: false });
        });
    });

});
