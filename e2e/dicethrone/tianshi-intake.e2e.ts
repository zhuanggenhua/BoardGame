/**
 * DiceThrone 炽天使真实入口证据。
 *
 * 范围：真实在线双玩家选角、初始化、进入牌桌，以及炽天使玩家板/手牌可见性。
 */

import type { Browser, Page, TestInfo } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import {
    cleanupDTMatch,
    closeDebugPanelIfOpen,
    readyAndStartGame,
    selectCharacter,
    setupOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';

type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupOnlineMatch>>>;

const TIANSHI_SLOT_ABILITIES = {
    fist: 'holy-blade',
    chi: 'holy-radiance',
    sky: 'divine-purification',
    lotus: 'divine-punishment',
    combo: 'triumphant-return',
    lightning: 'supreme-power',
    calm: 'archangel-resolve',
    meditate: 'angelic-cloak',
    ultimate: 'heavenly-severing',
} as const;

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name, { filename: `${name}.png` });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

const setupTianshiMatch = async (browser: Browser, baseURL: string | undefined): Promise<MatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 240000,
    });
    if (!match) {
        test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
        throw new Error('DiceThrone online setup failed');
    }

    await selectCharacter(match.hostPage, 'tianshi');
    await selectCharacter(match.guestPage, 'monk');
    return match;
};

test.describe('DiceThrone 炽天使真实入口', () => {
    test('真实在线双玩家应完成炽天使选角初始化并进入牌桌', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupTianshiMatch(browser, baseURL);

        try {
            await expect(match.hostPage.locator('[data-character-id="tianshi"]')).toContainText(/P1/i);
            await expect(match.guestPage.locator('[data-character-id="monk"]')).toContainText(/P2/i);
            await expect(match.hostPage.locator('img[alt="玩家面板"], img[alt="Player Board"]').first()).toBeVisible();
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-选角-炽天使与武僧');

            await readyAndStartGame(match.hostPage, match.guestPage);
            await waitForGameBoard(match.hostPage);
            await waitForGameBoard(match.guestPage);
            await waitForDiceThroneHarness(match.hostPage);
            await waitForDiceThroneHarness(match.guestPage);
            await closeDebugPanelIfOpen(match.hostPage);
            await closeDebugPanelIfOpen(match.guestPage);

            const hostBoard = match.hostPage.getByTestId('player-board-surface');
            await expect(hostBoard).toHaveAttribute('data-character-id', 'tianshi', { timeout: 10000 });
            for (const [slotId, abilityId] of Object.entries(TIANSHI_SLOT_ABILITIES)) {
                await expect(hostBoard.locator(`[data-ability-slot="${slotId}"]`).first())
                    .toHaveAttribute('data-base-ability-id', abilityId);
            }
            await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4, { timeout: 10000 });
            await expect(match.hostPage.getByText(/回合|Turn/i).first()).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-牌桌-炽天使玩家板与手牌');

            await expect(match.guestPage.getByTestId('player-board-surface'))
                .toHaveAttribute('data-character-id', 'monk', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '03-牌桌-对手视角已进入');
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
