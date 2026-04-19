/**
 * 召唤师战争 - 自定义牌组 E2E 测试
 *
 * 覆盖：
 * - 自定义牌组入口可见
 * - DeckBuilderDrawer 打开/关闭
 * - 阵营浏览与召唤师选择
 * - 卡牌添加与验证状态
 * - 切换阵营浏览不同卡牌池
 * - 遮罩层关闭抽屉
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import { ensureGameServerAvailable, waitForMatchAvailable } from '../helpers/common';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    createSWRoomViaAPI,
    ensurePlayerIdInUrl,
    initSWContext,
    waitForOverlayState,
    waitForFactionSelection,
} from '../helpers/summonerwars';

// ============================================================================
// 牌组构建器专用工具（此文件特有）
// ============================================================================

/** 点击"自定义牌组"占位卡打开抽屉 */
const openDeckBuilder = async (page: Page) => {
    const customDeckCard = page.locator('.grid > div').filter({
        hasText: /New Deck|Custom Deck|自定义牌组|点击构建|Click to Build/i,
    });
    await expect(customDeckCard).toBeVisible({ timeout: 5000 });
    await customDeckCard.click();
};

const waitForDeckBuilderOpen = async (page: Page, timeout = 5000) => {
    await expect(
        page.locator('h1').filter({ hasText: /Custom Deck Builder|牌组构建/i }),
    ).toBeVisible({ timeout });
};

const waitForDeckBuilderClosed = async (page: Page, timeout = 5000) => {
    await expect(
        page.locator('h1').filter({ hasText: /Custom Deck Builder|牌组构建/i }),
    ).toBeHidden({ timeout });
};

const selectFactionInBuilder = async (page: Page, index: number) => {
    const drawerFactions = page.locator('.w-\\[18vw\\] button');
    const count = await drawerFactions.count();
    if (count > index) await drawerFactions.nth(index).click();
};

const selectFirstSummoner = async (page: Page) => {
    const summonerSection = page.locator('h3').filter({ hasText: /Summoners|召唤师/i });
    await expect(summonerSection).toBeVisible({ timeout: 5000 });
    const cardPool = page.locator('.flex-1.overflow-y-auto');
    const firstCard = cardPool.locator('.grid > div').first();
    await expect(firstCard).toBeVisible({ timeout: 3000 });
    await firstCard.click();
};

const addCardFromPool = async (page: Page, sectionName: string, cardIndex: number) => {
    const section = page.locator('h3').filter({ hasText: new RegExp(sectionName, 'i') });
    await expect(section).toBeVisible({ timeout: 3000 });
    const sectionContainer = section.locator('..');
    const cards = sectionContainer.locator('.grid > div');
    const count = await cards.count();
    if (count > cardIndex) await cards.nth(cardIndex).click();
};

const longPressTouch = async (locator: Locator, durationMs = 620, pointerId = 1) => {
    await locator.dispatchEvent('pointerdown', {
        pointerType: 'touch',
        pointerId,
        isPrimary: true,
        buttons: 1,
    });
    await locator.page().waitForTimeout(durationMs);
    await locator.dispatchEvent('pointerup', {
        pointerType: 'touch',
        pointerId,
        isPrimary: true,
        buttons: 0,
    });
};

/** 通用的测试前置：创建上下文 + 创建房间 + 进入阵营选择 */
const setupForDeckBuilder = async (
    browser: { newContext: (opts?: { baseURL?: string }) => Promise<import('@playwright/test').BrowserContext> },
    baseURL: string | undefined,
) => {
    const context = await browser.newContext({ baseURL });
    await initSWContext(context, '__sw_storage_reset');
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(page))) return null;

    const matchId = await createSWRoomViaAPI(page);
    if (!matchId) return null;
    if (!(await waitForMatchAvailable(page, 'summonerwars', matchId, 20000))) return null;

    await page.goto(`/play/summonerwars/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await ensurePlayerIdInUrl(page, '0');
    await waitForFactionSelection(page);
    return { context, page };
};

// ============================================================================
// 测试
// ============================================================================

test.describe('SummonerWars 自定义牌组', () => {
    test('阵营选择界面显示自定义牌组入口', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupForDeckBuilder(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { context, page } = setup;

        const customDeckCard = page.locator('.grid > div').filter({
            hasText: /New Deck|Custom Deck|自定义牌组|点击构建|Click to Build/i,
        });
        await expect(customDeckCard).toBeVisible({ timeout: 5000 });
        await expect(customDeckCard.getByText(/Click to Build|点击构建/i)).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('custom-deck-entry.png') });
        await context.close();
    });

    test('打开和关闭 DeckBuilderDrawer', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupForDeckBuilder(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { context, page } = setup;

        await openDeckBuilder(page);
        await waitForDeckBuilderOpen(page);

        await expect(page.locator('h2').filter({ hasText: /Factions|阵营/i })).toBeVisible();
        // CardPoolPanel 未选择阵营时显示提示文本
        const cardPoolArea = page.locator('.flex-1.flex.items-center.justify-center');
        await expect(cardPoolArea).toBeVisible({ timeout: 5000 });
        await expect(page.locator('h2').filter({ hasText: /My Deck|我的牌组/i })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('deck-builder-open.png') });

        const closeButton = page.locator('button').filter({ has: page.locator('svg path[fill-rule="evenodd"]') }).last();
        await closeButton.click();
        await waitForDeckBuilderClosed(page);
        await waitForFactionSelection(page);
        await page.screenshot({ path: testInfo.outputPath('deck-builder-closed.png') });
        await context.close();
    });

    test('阵营浏览和召唤师选择', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupForDeckBuilder(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { context, page } = setup;

        await openDeckBuilder(page);
        await waitForDeckBuilderOpen(page);

        await selectFactionInBuilder(page, 0);
        await page.waitForTimeout(500);
        // 选择阵营后，提示文本消失，显示卡牌池
        await expect(page.locator('h3').filter({ hasText: /Summoners|召唤师/i })).toBeVisible({ timeout: 5000 });

        const summonerSection = page.locator('h3').filter({ hasText: /Summoners|召唤师/i });
        await expect(summonerSection).toBeVisible({ timeout: 5000 });
        await page.screenshot({ path: testInfo.outputPath('deck-builder-faction-selected.png') });

        await selectFirstSummoner(page);
        await page.waitForTimeout(500);
        await expect(page.locator('.border-amber-400').first()).toBeVisible({ timeout: 3000 });
        await expect(page.getByText(/Starting Cards|起始卡牌/i)).toBeVisible({ timeout: 3000 });
        await page.screenshot({ path: testInfo.outputPath('deck-builder-summoner-selected.png') });
        await context.close();
    });

    test('卡牌添加和验证状态', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupForDeckBuilder(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { context, page } = setup;

        await openDeckBuilder(page);
        await waitForDeckBuilderOpen(page);
        await selectFactionInBuilder(page, 0);
        await page.waitForTimeout(500);
        await selectFirstSummoner(page);
        await page.waitForTimeout(500);

        await expect(page.getByText(/Invalid Deck|牌组不合法/i)).toBeVisible({ timeout: 3000 });

        const useDeckButton = page.locator('button').filter({ hasText: /Use This Deck|使用此牌组/i });
        if (await useDeckButton.isVisible().catch(() => false)) {
            await expect(useDeckButton).toBeDisabled();
        }

        await addCardFromPool(page, 'Champions|冠军', 0);
        await page.waitForTimeout(300);
        await expect(page.getByText(/Build Cards|构建卡牌/i)).toBeVisible({ timeout: 3000 });
        await page.screenshot({ path: testInfo.outputPath('deck-builder-cards-added.png') });

        const removeButtons = page.locator('button').filter({ hasText: '-' });
        expect(await removeButtons.count()).toBeGreaterThan(0);
        await removeButtons.first().click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: testInfo.outputPath('deck-builder-card-removed.png') });
        await context.close();
    });

    test('移动端长按卡池卡牌应可放大且不影响点击选择', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const context = await browser.newContext({
            baseURL,
            viewport: { width: 812, height: 375 },
            isMobile: true,
            hasTouch: true,
        });
        await initSWContext(context, '__sw_storage_reset');
        const page = await context.newPage();

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

        if (!(await ensureGameServerAvailable(page))) {
            test.skip(true, '服务器不可用或创建房间失败');
            return;
        }

        const matchId = await createSWRoomViaAPI(page);
        if (!matchId) {
            test.skip(true, '创建房间失败');
            return;
        }

        if (!(await waitForMatchAvailable(page, 'summonerwars', matchId, 20000))) {
            test.skip(true, '对局不可用');
            return;
        }

        await page.goto(`/play/summonerwars/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
        await ensurePlayerIdInUrl(page, '0');
        await waitForFactionSelection(page);

        await openDeckBuilder(page);
        await waitForDeckBuilderOpen(page);
        await selectFactionInBuilder(page, 0);
        await page.waitForTimeout(500);

        const firstPoolCard = page.locator('[data-card-pool-id]').first();
        await expect(firstPoolCard).toBeVisible({ timeout: 5000 });

        await longPressTouch(firstPoolCard, 650, 31);
        await waitForOverlayState(page, 'sw-deckbuilder-card-magnify-overlay', 'open');
        const magnifyOverlay = page.locator('[data-testid="sw-deckbuilder-card-magnify-overlay"]');
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'deck-builder-mobile-long-press-magnify', {
                filename: 'deck-builder-mobile-long-press-magnify.png',
            }),
        });
        await magnifyOverlay.locator('button', { hasText: /关闭|Close/i }).click();
        await waitForOverlayState(page, 'sw-deckbuilder-card-magnify-overlay', 'closed');

        await firstPoolCard.click();
        await page.waitForTimeout(500);
        await expect(page.locator('.border-amber-400').first()).toBeVisible({ timeout: 5000 });
        await page.screenshot({
            path: getEvidenceScreenshotPath(testInfo, 'deck-builder-mobile-click-select-still-works', {
                filename: 'deck-builder-mobile-click-select-still-works.png',
            }),
        });

        await context.close();
    });

    test('切换阵营浏览不同卡牌池', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupForDeckBuilder(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { context, page } = setup;

        await openDeckBuilder(page);
        await waitForDeckBuilderOpen(page);

        await selectFactionInBuilder(page, 0);
        await page.waitForTimeout(500);
        await expect(page.locator('h3').filter({ hasText: /Summoners|召唤师/i })).toBeVisible({ timeout: 5000 });
        const firstFactionCards = page.locator('.flex-1.overflow-y-auto .grid > div');
        expect(await firstFactionCards.count()).toBeGreaterThan(0);
        await page.screenshot({ path: testInfo.outputPath('deck-builder-faction1.png') });

        await selectFactionInBuilder(page, 3);
        await page.waitForTimeout(500);
        const secondFactionCards = page.locator('.flex-1.overflow-y-auto .grid > div');
        await expect(secondFactionCards.first()).toBeVisible({ timeout: 5000 });
        expect(await secondFactionCards.count()).toBeGreaterThan(0);
        await page.screenshot({ path: testInfo.outputPath('deck-builder-faction2.png') });
        await context.close();
    });

    test('点击遮罩层关闭抽屉', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupForDeckBuilder(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { context, page } = setup;

        await openDeckBuilder(page);
        await waitForDeckBuilderOpen(page);

        await page.mouse.click(10, 10);
        await waitForDeckBuilderClosed(page);
        await waitForFactionSelection(page);
        await page.screenshot({ path: testInfo.outputPath('deck-builder-mask-close.png') });
        await context.close();
    });
});
