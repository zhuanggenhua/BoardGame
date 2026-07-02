import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setChineseLocale } from '../helpers/common';
import { selectCharacter, waitForCharacterSelection, waitForGameBoard, waitForPhase } from '../helpers/dicethrone';

const saveEvidenceScreenshot = async (
    page: Parameters<typeof test>[0]['page'],
    testInfo: Parameters<Parameters<typeof test>[1]>[1],
    name: string,
) => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
    return path;
};

test.describe('DiceThrone - 开局阶段与投掷按钮回归', () => {
    test('本地开局后应自动进入 main1，且主阶段投掷按钮置灰', async ({ page }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await setChineseLocale(page);
        await page.goto('/play/dicethrone', { waitUntil: 'domcontentloaded' });
        await waitForCharacterSelection(page, 30000);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(page, testInfo, '01-角色选择');

        await selectCharacter(page, 'barbarian');
        await selectCharacter(page, 'paladin');

        const readyButton = page.getByRole('button', { name: /准备|Ready/i }).first();
        await expect(readyButton).toBeVisible({ timeout: 10000 });
        await readyButton.click();

        const startButton = page.getByRole('button', { name: /开始游戏|Start Game/i }).first();
        await expect(startButton).toBeVisible({ timeout: 10000 });
        await expect(startButton).toBeEnabled({ timeout: 10000 });
        await startButton.click();

        await waitForPhase(page, 'main1', 30000);
        await waitForGameBoard(page, 30000);

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeDisabled();

        await saveEvidenceScreenshot(page, testInfo, '02-main1-投掷按钮禁用');
    });
});
