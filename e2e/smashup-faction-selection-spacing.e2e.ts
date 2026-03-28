import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gotoLocalSmashUp } from './smashup-debug-helpers';

test.describe('SmashUp 派系选择页移动端间距', () => {
  test('移动端压缩生效并输出移动端/桌面端参考截图', async ({ page }, testInfo) => {
    const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'smashup-faction-selection-spacing');
    mkdirSync(evidenceDir, { recursive: true });

    const title = page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i });
    const grid = page.locator('.grid').first();
    const cards = grid.locator('> div');

    await page.setViewportSize({ width: 800, height: 450 });
    await gotoLocalSmashUp(page);
    await expect(title).toBeVisible({ timeout: 30000 });
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const mobileMetrics = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.grid > div')) as HTMLElement[];
      const first = cards[0]?.getBoundingClientRect();
      const second = cards[1]?.getBoundingClientRect();
      const third = cards[2]?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        firstWidth: first?.width ?? 0,
        horizontalGap: first && second ? second.left - first.right : 0,
        firstTop: first?.top ?? 0,
        thirdTop: third?.top ?? 0,
      };
    });

    expect(mobileMetrics.docScrollWidth, '移动端不应横向溢出').toBeLessThanOrEqual(mobileMetrics.innerWidth + 1);
    expect(mobileMetrics.firstWidth, '移动端派系卡应成功渲染').toBeGreaterThan(0);
    expect(mobileMetrics.horizontalGap, '移动端派系卡之间应保留可见间距').toBeGreaterThanOrEqual(0);
    expect(mobileMetrics.thirdTop, '手机横屏下第三张卡应换到下一行，避免一排三张过挤').toBeGreaterThan(mobileMetrics.firstTop + 4);

    await page.screenshot({ path: join(evidenceDir, 'mobile-landscape.png'), fullPage: false });
    await page.screenshot({ path: testInfo.outputPath('mobile-landscape.png'), fullPage: false });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoLocalSmashUp(page);
    await expect(title).toBeVisible({ timeout: 30000 });
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: join(evidenceDir, 'desktop-reference.png'), fullPage: false });
    await page.screenshot({ path: testInfo.outputPath('desktop-reference.png'), fullPage: false });
  });
});
