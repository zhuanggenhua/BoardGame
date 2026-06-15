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

async function clickMapRegion(
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
        element.dispatchEvent(new PointerEvent('pointerdown', init));
        element.dispatchEvent(new PointerEvent('pointerleave', init));
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

    const pregameScreen = page.getByTestId('qidahen-scenario-pregame-screen');
    if (await pregameScreen.isVisible().catch(() => false)) {
        await page.getByTestId('qidahen-pregame-confirm').click();
    }

    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
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

        await clickMapRegion(page, 'songjin');
        await expect(page.getByTestId('qidahen-map-region-tip')).toContainText('皮岛 · 大明', { timeout: 15000 });
        await wheelMoveTarget.click();
        await page.waitForTimeout(250);
        await wheelMoveTarget.click();
        await expect(page.getByTestId('qidahen-turn-banner')).toContainText('大明 · 势力行动', { timeout: 15000 });
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('轮盘征兵/训练', { timeout: 15000 });
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('皮岛', { timeout: 15000 });

        const actionButton = page.getByTestId('qidahen-action-upgrade-armament');
        await expect(actionButton).toBeVisible({ timeout: 15000 });
        await actionButton.click();
        await expect(page.getByTestId('qidahen-primary-action-current')).toContainText('升级军备', { timeout: 15000 });
        await actionButton.click();

        const handCards = page.locator('[data-testid^="qidahen-hand-card-"]');
        await expect(handCards.nth(0)).toBeVisible({ timeout: 15000 });
        await expect(handCards.nth(1)).toBeVisible({ timeout: 15000 });
        await handCards.nth(0).click();
        await handCards.nth(1).click();
        await captureEvidence(page, testInfo, '七大恨-首页进入并完成首回合-03-升级军备弃牌确认.png');

        const confirmPaymentButton = page.getByTestId('qidahen-action-payment-confirm');
        await expect(confirmPaymentButton).toBeEnabled({ timeout: 15000 });
        await confirmPaymentButton.click();

        await expect(page.getByTestId('qidahen-turn-banner')).toContainText('蒙古 · 行动窗口', { timeout: 15000 });
        await captureEvidence(page, testInfo, '七大恨-首页进入并完成首回合-04-首回合完成后.png');
    });
});
