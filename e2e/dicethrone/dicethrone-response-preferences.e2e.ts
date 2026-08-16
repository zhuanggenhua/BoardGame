import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    cleanupDTMatch,
    closeDebugPanelIfOpen,
    readyAndStartGame,
    selectCharacter,
    setupOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';

const CHARACTER_SELECTION_TIMEOUT = 240000;

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
        requireChineseName: true,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

test.describe('DiceThrone 响应偏好开关', () => {
    test('响应偏好只保留总响应开关，不再显示奖励骰专属响应开关', async ({ browser, baseURL }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);

        const match = await setupOnlineMatch(browser, baseURL, {
            skipImageGate: true,
            characterSelectionTimeout: CHARACTER_SELECTION_TIMEOUT,
        });
        if (!match) {
            test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
            return;
        }

        const screenshots: string[] = [];
        try {
            const { hostPage, guestPage } = match;
            await selectCharacter(hostPage, 'barbarian');
            await selectCharacter(guestPage, 'monk');
            await readyAndStartGame(hostPage, guestPage);
            await waitForGameBoard(hostPage);
            await waitForDiceThroneHarness(hostPage);
            await closeDebugPanelIfOpen(hostPage);
            await hostPage.setViewportSize({ width: 1280, height: 720 });
            await hostPage.waitForTimeout(800);

            const autoResponseToggle = hostPage.getByTestId('auto-response-toggle');
            const bonusDiceResponseToggle = hostPage.getByTestId('bonus-dice-response-toggle');

            await expect(autoResponseToggle).toBeVisible({ timeout: 10000 });
            await expect(bonusDiceResponseToggle).toHaveCount(0);
            await expect(autoResponseToggle).toContainText('手动响应');
            await expect(autoResponseToggle).toHaveAttribute('aria-pressed', 'true');
            screenshots.push(await saveEvidenceScreenshot(hostPage, testInfo, '01-默认开启手动响应-无奖励骰专属响应开关'));

            await autoResponseToggle.click();
            await expect(autoResponseToggle).toHaveAttribute('aria-pressed', 'false');
            await expect(autoResponseToggle).toContainText('自动跳过');
            await expect(bonusDiceResponseToggle).toHaveCount(0);
            screenshots.push(await saveEvidenceScreenshot(hostPage, testInfo, '02-关闭手动响应后仍无奖励骰专属响应开关'));

            const storedPreferences = await hostPage.evaluate(() => ({
                autoResponse: window.localStorage.getItem('dicethrone:autoResponse'),
                bonusDiceResponse: window.localStorage.getItem('dicethrone:bonusDiceResponse'),
            }));
            expect(storedPreferences).toEqual({
                autoResponse: 'false',
                bonusDiceResponse: null,
            });

            testInfo.annotations.push({
                type: 'evidence',
                description: screenshots.join('\n'),
            });
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
