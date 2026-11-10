import { expect, test } from '@playwright/test';
import { initContext } from '../helpers/common';

test.use({ viewport: { width: 1366, height: 768 } });

test('PC 详情页下载战斗素材后重新进入对局使用本地缓存', async ({ page, context }, testInfo) => {
  test.setTimeout(300000);
  await initContext(context, { skipImageGate: false });
  await context.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
  await page.goto('/?game=fate-domination', { waitUntil: 'domcontentloaded' });
  const download = page.getByTestId('fate-desktop-assets-download');
  await expect(download).toBeVisible({ timeout: 45000 });
  await page.screenshot({ path: testInfo.outputPath('下载战斗素材入口.png') });
  await download.click();
  await expect(download).toHaveText(/战斗素材已下载/, { timeout: 180000 });
  await page.screenshot({ path: testInfo.outputPath('战斗素材下载完成.png') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(download).toHaveText(/战斗素材已下载/, { timeout: 45000 });
  const requested: string[] = [];
  page.on('request', request => { if (request.url().includes('/fate-domination/fgo/v2/')) requested.push(request.url()); });
  await page.goto('/play/fate-domination?players=3&playerID=0&seed=fgo-cache', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('fate-domination-board')).toBeVisible({ timeout: 45000 });
  await expect.poll(() => page.evaluate(async () => {
    const url = '/src/games/fate-domination/fgo-runtime/fgoPreload.ts';
    const assets = await import(/* @vite-ignore */ url);
    return Boolean(assets.loadedFgoCharacter('servant-saber'));
  }), { timeout: 120000, intervals: [500] }).toBe(true);
  expect(requested).toEqual([]);
});
