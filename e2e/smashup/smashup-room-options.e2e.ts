import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
} from '../framework/evidenceScreenshots';
import {
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    setChineseLocale,
    waitForFrontendAssets,
    waitForHomeGameList,
} from '../helpers/common';

async function ensureLobbyReady(page: Page): Promise<void> {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForFrontendAssets(page, 45_000);
    await waitForHomeGameList(page, 45_000);
    await expect(page.getByRole('heading', { name: '大杀四方' })).toBeVisible({ timeout: 15_000 });
}

async function openSmashUpDetailsModal(page: Page): Promise<void> {
    await page.getByRole('heading', { name: '大杀四方' }).click();
    await expect(page).toHaveURL(/game=smashup/);
    await expect(page.locator('[data-testid="game-details-modal-root"]:visible').last()).toBeVisible({ timeout: 15_000 });
}

async function openSmashUpCreateRoomModal(page: Page): Promise<void> {
    await openSmashUpDetailsModal(page);
    await page.getByTestId('game-details-open-create-room').click();
    await expect(page.getByTestId('create-room-modal').last()).toBeVisible({ timeout: 10_000 });
}

test.describe('SmashUp 房间设置与大厅扩展摘要', () => {
    test('余牌查询默认关闭，开启后会写入房间设置并在大厅显示完整扩展 tag', async ({ page, browser, baseURL }, testInfo) => {
        test.setTimeout(120_000);

        await setChineseLocale(page);
        await ensureLobbyReady(page);
        test.skip(!(await ensureGameServerAvailable(page)), '游戏服务器不可用');

        await openSmashUpCreateRoomModal(page);

        const deckQuerySelect = page
            .locator('label', { hasText: '余牌查询' })
            .locator('xpath=..')
            .locator('select');
        await expect(deckQuerySelect).toHaveValue('off');

        await page.getByTestId('create-room-name-input').fill('余牌查询测试房');
        await deckQuerySelect.selectOption('on');
        await page.getByTestId('create-room-confirm-button').click();

        await expect(page).toHaveURL(/\/play\/smashup\/match\//, { timeout: 30_000 });
        const matchId = page.url().match(/\/play\/smashup\/match\/([^?]+)/)?.[1];
        expect(matchId).toBeTruthy();
        if (!matchId) {
            throw new Error('未能从 URL 提取大杀四方房间 ID');
        }

        const matchResponse = await page.request.get(`${getGameServerBaseURL()}/games/smashup/${matchId}`);
        expect(matchResponse.ok()).toBeTruthy();
        const matchPayload = await matchResponse.json() as {
            setupData?: {
                deckQuery?: string;
                expansions?: string[];
                setupSelections?: {
                    deckQuery?: string;
                    expansions?: string[];
                };
            };
        };
        expect(matchPayload.setupData?.deckQuery).toBe('on');
        expect(matchPayload.setupData?.setupSelections?.deckQuery).toBe('on');
        expect(matchPayload.setupData?.setupSelections?.expansions ?? []).toEqual(['titans', 'diy']);

        const viewerContext = await browser.newContext({ baseURL });
        try {
            await initContext(viewerContext, {
                storageKey: '__smashup_room_options_viewer',
                blockLobbySocket: false,
            });
            const viewerPage = await viewerContext.newPage();
            await setChineseLocale(viewerPage);
            await ensureLobbyReady(viewerPage);
            await openSmashUpDetailsModal(viewerPage);

            const roomCard = viewerPage.getByTestId(`room-list-item-${matchId}`);
            await expect(roomCard).toBeVisible({ timeout: 20_000 });
            await expect(viewerPage.getByTestId(`room-expansion-tag-${matchId}-titans`)).toHaveText('泰坦');
            await expect(viewerPage.getByTestId(`room-expansion-tag-${matchId}-diy`)).toHaveText('DIY');

            await clearEvidenceScreenshotsForTest(testInfo);
            const screenshotPath = getEvidenceScreenshotPath(testInfo, 'room-options-summary', {
                filename: 'smashup-room-options-summary.png',
            });
            mkdirSync(dirname(screenshotPath), { recursive: true });
            await viewerPage.screenshot({ path: screenshotPath, fullPage: true });
        } finally {
            await viewerContext.close();
        }
    });
});
