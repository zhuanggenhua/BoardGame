import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../framework';
import DiceThroneTutorials from '../../src/games/dicethrone/tutorial';
import { setChineseLocale } from '../helpers/common';
import { disableFabMenu, waitForTutorialBoardReady } from '../helpers/dicethrone';
import { createEvidenceScreenshotRun, promoteEvidenceScreenshotRun } from '../framework/evidenceScreenshots';

const waitForCatalogAnimation = async (page: import('@playwright/test').Page) => {
    await expect.poll(() => page.locator('.tutorial-catalog-stage__entry').evaluateAll(entries => entries.every(entry => Number(getComputedStyle(entry).opacity) >= 0.99))).toBe(true);
    await page.waitForTimeout(250);
};

test.describe('双人交互教学目录的正式入口', () => {
    for (const mobile of [false, true]) {
        test(mobile ? '教程目录：手机横屏选课' : '教程目录：桌面选课', async ({ page }, testInfo) => {
            test.setTimeout(120000);
            await page.setViewportSize(mobile ? { width: 936, height: 432 } : { width: 1440, height: 900 });
            await setChineseLocale(page);
            await page.goto('/play/dicethrone/tutorial');
            await expect(page.getByTestId('tutorial-catalog-stage')).toBeVisible({ timeout: 60000 });
            await page.evaluate(() => document.fonts.ready);
            for (const id of Object.keys(DiceThroneTutorials.tutorials)) {
                const entry = page.getByTestId('tutorial-catalog-entry-' + id);
                await expect(entry).toHaveCount(1);
                await expect(entry).not.toHaveText(/tutorial\.chapters/);
            }
            await page.locator('.tutorial-catalog-stage__entry').evaluateAll(async entries => {
                const animations = entries.flatMap(entry => entry.getAnimations());
                await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
            });
            await waitForCatalogAnimation(page);
            const catalogWidth = await page.locator('.tutorial-catalog-stage__shell').evaluate(element => element.getBoundingClientRect().width);
            expect(catalogWidth).toBeGreaterThanOrEqual(page.viewportSize()!.width * 0.7);
            for (const entry of await page.locator('.tutorial-catalog-stage__entry').all()) {
                const bounds = await entry.boundingBox();
                expect(bounds!.height).toBeGreaterThanOrEqual(44);
                const titleHeight = await entry.locator('.tutorial-catalog-stage__entry-title span').evaluate(element => element.getBoundingClientRect().height);
                expect(titleHeight).toBeGreaterThanOrEqual(14);
            }
            const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
            const dir = run.stagingDir;
            expect(Object.keys(DiceThroneTutorials.tutorials)).toEqual(['dicethrone-basic', 'dicethrone-hand-limit']);
            const records = [];
            await page.screenshot({ path: join(dir, '01-教学目录.png'), fullPage: false });
            records.push({ step: 'catalog', action: '阅读两个正式教程入口', screenshot: '01-教学目录.png' });
            const target = page.getByTestId('tutorial-catalog-entry-dicethrone-hand-limit');
            await target.click();
            await waitForTutorialBoardReady(page, 60000);
            await disableFabMenu(page);
            await expect(page.locator('[data-tutorial-step="limit-start"]')).toBeVisible({ timeout: 60000 });
            await expect(page.locator('[data-card-id]')).toHaveCount(7);
            await expect(page.locator('[data-card-id][data-is-flipped="false"]')).toHaveCount(0);
            await page.waitForTimeout(1000);
            await page.screenshot({ path: join(dir, '02-进入手牌上限练习.png'), fullPage: false });
            records.push({ step: 'catalog-open', action: '手牌上限练习进入首个决策前', screenshot: '02-进入手牌上限练习.png' });
            await page.goBack();
            await expect(page.getByTestId('tutorial-catalog-stage')).toBeVisible();
            await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
            await expect(page.getByTestId('tutorial-highlight-ring')).toHaveCount(0);
            await waitForCatalogAnimation(page);
            await page.screenshot({ path: join(dir, '03-退出后回到目录.png'), fullPage: false });
            records.push({ step: 'catalog-return', action: '退出练习返回目录，教学提示和高亮已清除', screenshot: '03-退出后回到目录.png' });
            writeFileSync(join(dir, 'chain.json'), JSON.stringify({ gameId: 'dicethrone', evidenceCategory: 'tutorial', sourceRun: run.runId, records }, null, 2));
            await promoteEvidenceScreenshotRun(run, {
                gameId: 'dicethrone', evidenceCategory: 'tutorial',
                media: records.map((record, index) => ({
                    path: record.screenshot, chainId: `教程目录-${mobile ? '手机' : '桌面'}`,
                    chainStep: index + 1, stage: index === 0 ? '前态' : index === records.length - 1 ? '后态' : '中态', description: record.action,
                })),
            });
        });
    }

    test('退出独立教程后关闭提示并清空共享教程状态', async ({ page }) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 1440, height: 900 });
        await setChineseLocale(page);
        await page.goto('/play/dicethrone/tutorial');
        await expect(page.getByTestId('tutorial-catalog-stage')).toBeVisible({ timeout: 60000 });
        await page.getByTestId('tutorial-catalog-entry-dicethrone-hand-limit').click();
        await waitForTutorialBoardReady(page, 60000);
        await expect(page.locator('[data-tutorial-step="limit-start"]')).toBeVisible({ timeout: 60000 });

        await page.reload();
        await page.getByRole('button', { name: '重头开始', exact: true }).click();
        await waitForTutorialBoardReady(page, 60000);
        await expect(page.locator('[data-tutorial-step="limit-start"]')).toBeVisible({ timeout: 60000 });
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(1);

        await page.goBack();
        await expect(page).toHaveURL(/\/play\/dicethrone\/tutorial(?:\?.*)?$/);
        await expect(page.getByTestId('tutorial-catalog-stage')).toBeVisible();
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => (
            (window as unknown as { __BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?: { active?: boolean } })
                .__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?.active ?? null
        ))).toBe(false);
    });
});
