import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    disableAudio,
    disableTutorial,
    injectSkipImageGate,
    resetMatchStorage,
    setChineseLocale,
    waitForFrontendAssets,
    waitForHomeGameList,
} from '../helpers/common';

const MAP_REGION_POINTS = {
    songjin: { x: 0.6522, y: 0.5913 },
} as const;

async function ensureLobbyReady(page: Page): Promise<void> {
    await page.goto('/', { waitUntil: 'commit', timeout: 15000 });
    await waitForFrontendAssets(page, 45000);
    await waitForHomeGameList(page, 45000);
    await expect(page.locator('[data-game-id="qidahen"]')).toBeVisible({ timeout: 15000 });
}

async function hoverMapRegion(
    page: Page,
    regionId: keyof typeof MAP_REGION_POINTS,
): Promise<void> {
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
    }, point);
}

async function captureEvidence(
    page: Page,
    testInfo: TestInfo,
    filename: string,
): Promise<string> {
    const screenshotPath = getEvidenceScreenshotPath(testInfo, filename, {
        subdir: 'qidahen/homepage-first-turn',
        filename,
    });
    mkdirSync(dirname(screenshotPath), { recursive: true });
    await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        animations: 'disabled',
    });
    return screenshotPath;
}

async function openQidahenCreateRoomModal(page: Page): Promise<void> {
    await page.locator('[data-game-id="qidahen"]').first().click();
    await expect(page).toHaveURL(/game=qidahen/);

    const detailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').last();
    await expect(detailsModal).toBeVisible({ timeout: 15000 });

    const openCreateRoomButton = detailsModal.getByTestId('game-details-open-create-room');
    await expect(openCreateRoomButton).toBeVisible({ timeout: 10000 });
    await openCreateRoomButton.click();

    await expect(page.getByTestId('create-room-modal').last()).toBeVisible({ timeout: 10000 });
}

async function enterQidahenBoard(page: Page): Promise<void> {
    await expect(page).toHaveURL(/\/play\/qidahen\/match\//, { timeout: 30000 });

    const url = new URL(page.url());
    if (!url.searchParams.get('playerID')) {
        url.searchParams.set('playerID', '0');
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    }

    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-scenario-pregame-screen')).toHaveCount(0);
    await expect(page.getByTestId('qidahen-scenario-vote-screen')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-action-wheel')).toHaveCount(0);
    await page.getByTestId('qidahen-scenario-vote-option-post-sarhu-1619').click();
    await page.getByTestId('qidahen-scenario-vote-confirm').click();
    await expect(page.getByTestId('qidahen-scenario-vote-screen')).toHaveCount(0, { timeout: 30000 });
    const factionScreen = page.getByTestId('qidahen-faction-selection-screen');
    if (await factionScreen.isVisible().catch(() => false)) {
        await page.getByTestId('qidahen-faction-option-ming').click();
        await page.getByTestId('qidahen-faction-selection-confirm').click();
    }
    await expect(page.getByTestId('qidahen-turn-banner')).toContainText('大明', { timeout: 15000 });
}

test.describe('七大恨主页首回合黄金链', () => {
    test.setTimeout(180000);

    test.beforeEach(async ({ context }) => {
        await setChineseLocale(context);
        await disableTutorial(context);
        await disableAudio(context);
        await injectSkipImageGate(context, true);
        await resetMatchStorage(context, '__qidahen_homepage_first_turn__');
    });

    test('从主页创建七大恨房间后可完成首个基础回合', async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await ensureLobbyReady(page);
        await openQidahenCreateRoomModal(page);

        const createRoomModal = page.getByTestId('create-room-modal').last();
        await expect(createRoomModal).toBeVisible();

        const enableAiButton = createRoomModal.getByRole('button', { name: /加入 AI/ });
        await enableAiButton.click();
        await expect(enableAiButton).toContainText('已开启');

        await captureEvidence(page, testInfo, '七大恨-首页进入并完成首回合-01-首页房间入口.png');

        const confirmCreateRoomButton = page.getByTestId('create-room-confirm-button');
        await expect(confirmCreateRoomButton).toBeVisible({ timeout: 10000 });
        await confirmCreateRoomButton.click();

        await enterQidahenBoard(page);

        const wheelMoveTarget = page.getByTestId('qidahen-wheel-move-target-move-1-free');
        await expect(wheelMoveTarget).toBeVisible({ timeout: 15000 });
        await captureEvidence(page, testInfo, '七大恨-首页进入并完成首回合-02-进入对局后可操作.png');

        await hoverMapRegion(page, 'songjin');
        await expect(page.getByTestId('qidahen-map-region-tip')).toContainText('皮岛 · 大明', { timeout: 15000 });
        await wheelMoveTarget.click();
        await expect(page.getByTestId('qidahen-turn-banner')).toContainText('大明 · 行动窗口', { timeout: 15000 });
        await expect(page.getByTestId('qidahen-turn-banner')).toContainText('轮盘 已用', { timeout: 15000 });
        await expect(page.getByTestId('qidahen-turn-banner')).toContainText('手牌行动 未用', { timeout: 15000 });
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('轮盘征兵/训练', { timeout: 15000 });
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('顺天', { timeout: 15000 });

        const artilleryTechCard = page.locator('[data-tutorial-id="qidahen-atlas05-1626-artillery-tech"]').first();
        await expect(artilleryTechCard).toBeVisible({ timeout: 15000 });
        await artilleryTechCard.click();

        const paymentPanel = page.getByTestId('qidahen-action-payment-panel');
        await expect(paymentPanel).toBeVisible({ timeout: 15000 });
        await expect(paymentPanel).toContainText('升级军备', { timeout: 15000 });
        await expect(page.getByTestId('qidahen-action-payment-status')).toContainText('已选 1 张', { timeout: 15000 });
        await expect(page.locator('[data-qidahen-hand-card-selected="true"]')).toBeVisible({ timeout: 15000 });

        const paymentCards = page.locator(
            'button[data-testid^="qidahen-hand-card-"]:not([data-testid^="qidahen-hand-card-magnify-"]):not([data-tutorial-id="qidahen-atlas05-1626-artillery-tech"])',
        );
        await expect(paymentCards.first()).toBeVisible({ timeout: 15000 });
        await paymentCards.first().click();
        await expect(page.getByTestId('qidahen-action-payment-status')).toContainText('已选 2 张', { timeout: 15000 });
        await captureEvidence(page, testInfo, '七大恨-首页进入并完成首回合-03-打出火炮技术并确认升级军备.png');

        const confirmPaymentButton = page.getByTestId('qidahen-action-payment-confirm');
        await expect(confirmPaymentButton).toBeEnabled({ timeout: 15000 });
        await confirmPaymentButton.click();

        await expect(page.getByTestId('qidahen-turn-banner')).toContainText('蒙古 · 行动窗口', { timeout: 15000 });
        await captureEvidence(page, testInfo, '七大恨-首页进入并完成首回合-04-首回合完成后.png');
    });
});
