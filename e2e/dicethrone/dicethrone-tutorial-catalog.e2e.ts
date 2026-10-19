import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../framework';
import DiceThroneTutorials from '../../src/games/dicethrone/tutorial';
import { setChineseLocale } from '../helpers/common';
import { disableFabMenu, waitForTutorialBoardReady } from '../helpers/dicethrone';

test.describe('双人交互教学目录的正式入口', () => {
    for (const mobile of [false, true]) {
        test(mobile ? '教程目录：手机横屏选课' : '教程目录：桌面选课', async ({ page }, testInfo) => {
            await page.setViewportSize(mobile ? { width: 936, height: 432 } : { width: 1440, height: 900 });
            await setChineseLocale(page);
            await page.goto('/play/dicethrone/tutorial');
            await expect(page.getByTestId('tutorial-catalog-stage')).toBeVisible();
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
            const catalogWidth = await page.locator('.tutorial-catalog-stage__shell').evaluate(element => element.getBoundingClientRect().width);
            expect(catalogWidth).toBeGreaterThanOrEqual(page.viewportSize()!.width * 0.7);
            for (const entry of await page.locator('.tutorial-catalog-stage__entry').all()) {
                const bounds = await entry.boundingBox();
                expect(bounds!.height).toBeGreaterThanOrEqual(44);
                const titleHeight = await entry.locator('.tutorial-catalog-stage__entry-title span').evaluate(element => element.getBoundingClientRect().height);
                expect(titleHeight).toBeGreaterThanOrEqual(14);
            }
            const dir = join(process.cwd(), 'test-results/evidence-screenshots/dicethrone/tutorial-rebuild-20261016-r19', testInfo.title);
            mkdirSync(dir, { recursive: true });
            const records = [];
            await page.screenshot({ path: join(dir, '01-catalog.png'), fullPage: true });
            records.push({ step: 'catalog', action: '阅读八个正式课程入口', screenshot: '01-catalog.png' });
            const target = page.getByTestId('tutorial-catalog-entry-dicethrone-damage');
            await page.getByTestId('tutorial-catalog-entry-dicethrone-knockdown').scrollIntoViewIfNeeded();
            await page.screenshot({ path: join(dir, '02-catalog-entry.png'), fullPage: false });
            records.push({ step: 'catalog-entry', action: '向下阅读其余机制课程', screenshot: '02-catalog-entry.png' });
            await target.scrollIntoViewIfNeeded();
            await target.click();
            await waitForTutorialBoardReady(page, 60000);
            await disableFabMenu(page);
            await expect(page.locator('[data-tutorial-step="damage-start"]')).toBeVisible({ timeout: 60000 });
            await page.screenshot({ path: join(dir, '03-catalog-open.png'), fullPage: false });
            records.push({ step: 'catalog-open', action: '正式课程进入首个决策前', screenshot: '03-catalog-open.png' });
            writeFileSync(join(dir, 'chain.json'), JSON.stringify({ gameId: 'dicethrone', evidenceCategory: 'tutorial', sourceRun: process.env.TUTORIAL_EVIDENCE_RUN ?? 'tutorial-rebuild-20261016-r25-catalog', records }, null, 2));
        });
    }

    test('退出独立教程后关闭提示并清空共享教程状态', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await setChineseLocale(page);
        await page.goto('/play/dicethrone/tutorial');
        await expect(page.getByTestId('tutorial-catalog-stage')).toBeVisible();
        await page.getByTestId('tutorial-catalog-entry-dicethrone-damage').click();
        await waitForTutorialBoardReady(page, 60000);
        await expect(page.locator('[data-tutorial-step="damage-start"]')).toBeVisible({ timeout: 60000 });

        await page.getByRole('button', { name: '聊天' }).click();
        await page.getByRole('button', { name: '离开' }).click();
        await page.getByRole('button', { name: /返回大厅/ }).click();
        await expect(page).toHaveURL(/\/(?:\?.*)?$/);
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => (
            (window as unknown as { __BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?: { active?: boolean } })
                .__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?.active ?? null
        ))).toBe(false);
    });
});
