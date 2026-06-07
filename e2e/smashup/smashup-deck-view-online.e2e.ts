import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
} from '../framework/evidenceScreenshots';
import {
    cleanupTwoPlayerMatch,
    completeFactionSelection,
    setupTwoPlayerMatch,
    waitForHandArea,
} from './smashup-helpers';

test.describe('SmashUp 余牌查询真实开房链路', () => {
    test('真实双人房进入正式对局后可以点击牌堆查看余牌', async ({ browser }, testInfo) => {
        test.setTimeout(180000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupTwoPlayerMatch(browser, baseURL, {
            skipImageGate: true,
        });

        test.skip(!setup, '游戏服务器不可用或创建房间失败');
        if (!setup) return;

        try {
            await completeFactionSelection(setup.hostPage, setup.guestPage);

            await Promise.all([
                waitForHandArea(setup.hostPage, 45000),
                waitForHandArea(setup.guestPage, 45000),
            ]);

            const deckStack = setup.hostPage.getByTestId('su-deck-stack');
            const deckCountBadge = setup.hostPage.getByTestId('su-deck-count-badge');
            const deckPanel = setup.hostPage.locator('[data-card-view-panel]');

            await expect(deckStack).toBeVisible({ timeout: 15000 });
            await expect(deckCountBadge).toBeVisible({ timeout: 15000 });
            await expect(deckCountBadge).not.toHaveText('0');

            await deckStack.click();
            await expect(deckPanel).toBeVisible({ timeout: 15000 });
            await expect(deckPanel.getByText(/牌库 \(\d+\)/)).toBeVisible({ timeout: 15000 });

            await clearEvidenceScreenshotsForTest(testInfo);
            const screenshotPath = getEvidenceScreenshotPath(testInfo, 'online-deck-view-opened', {
                filename: 'smashup-online-deck-view-opened.png',
            });
            await mkdir(dirname(screenshotPath), { recursive: true });
            await setup.hostPage.screenshot({ path: screenshotPath, fullPage: false });
        } finally {
            await cleanupTwoPlayerMatch(setup);
        }
    });
});
