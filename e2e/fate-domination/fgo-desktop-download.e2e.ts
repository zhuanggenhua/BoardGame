import { expect, test } from '@playwright/test';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { initContext } from '../helpers/common';
import { createFateLobbyMatch } from './onlineFateLobby';

test.use({ viewport: { width: 1366, height: 768 } });

test('PC 详情页下载战斗素材后重新进入对局使用本地缓存', async ({ page, context }, testInfo) => {
  test.setTimeout(300000);
  await initContext(context, { skipImageGate: false });
  await context.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
  await page.goto('/?game=fate-domination', { waitUntil: 'domcontentloaded' });
  const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
  const capture = (name: string) => page.screenshot({
    path: getEvidenceScreenshotPathInDirectory(run.stagingDir, name, { requireChineseName: true }),
  });
  const download = page.getByTestId('fate-desktop-assets-download');
  await expect(download).toBeVisible({ timeout: 45000 });
  await capture('01-战斗素材下载入口');
  await download.click();
  const confirmationCopy = page.getByText(/下载游戏的战斗动画素材，完整素材大小约 [\d.]+ MB。/);
  await expect(confirmationCopy).toBeVisible({ timeout: 45000 });
  await expect(confirmationCopy).not.toContainText('约 0.0 MB');
  await capture('02-下载确认与素材大小');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(download).toHaveText('下载');
  await download.click();
  await expect(confirmationCopy).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(download).toHaveText(/战斗素材已下载/, { timeout: 180000 });
  await capture('03-战斗素材下载完成');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(download).toHaveText(/战斗素材已下载/, { timeout: 45000 });
  const requested: string[] = [];
  page.on('request', request => { if (request.url().includes('/fate-domination/fgo/v2/')) requested.push(request.url()); });
  await createFateLobbyMatch(page);
  await expect.poll(() => page.evaluate(async () => {
    const url = '/src/games/fate-domination/fgo-runtime/fgoPreload.ts';
    const assets = await import(/* @vite-ignore */ url);
    return Boolean(assets.loadedFgoCharacter('servant-saber'));
  }), { timeout: 120000, intervals: [500] }).toBe(true);
  expect(requested).toEqual([]);
});
