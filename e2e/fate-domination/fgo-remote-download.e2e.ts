import { expect, test } from '@playwright/test';
import { initContext } from '../helpers/common';

test('真实素材服务器下载后在浏览器中校验并复用', async ({ page, context }) => {
  test.skip(process.env.FGO_REMOTE_ASSET_CHECK !== 'true', '仅显式验证素材服务器时运行');
  test.setTimeout(1200000);
  await initContext(context, { skipImageGate: false });
  page.on('requestfailed', request => {
    if (request.url().includes('/fate-domination/fgo/v2/')) console.log('素材请求失败:', request.url(), request.failure()?.errorText);
  });
  page.on('response', response => {
    if (response.url().includes('/fate-domination/fgo/v2/') && response.status() >= 400) console.log('素材响应失败:', response.status(), response.url());
  });
  await context.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
  await page.goto('/?game=fate-domination', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const moduleUrl = '/src/core/AssetLoader.ts';
    const loader = await import(/* @vite-ignore */ moduleUrl);
    loader.setAssetsBaseUrl('https://assets.easyboardgame.top/official');
  });
  const download = page.getByTestId('fate-desktop-assets-download');
  await expect(download).toBeVisible({ timeout: 45000 });
  let finished = false;
  for (let attempt = 0; attempt < 5 && !finished; attempt += 1) {
    await download.click();
    let lastLabel = '';
    await expect.poll(async () => {
      const label = await download.textContent() ?? '';
      if (label !== lastLabel) { console.log('服务器下载:', label); lastLabel = label; }
      return label;
    }, { timeout: 1000000, intervals: [2000] }).toMatch(/战斗素材已下载|重试下载战斗素材/);
    finished = (await download.textContent())?.includes('战斗素材已下载') ?? false;
    if (!finished) console.log('继续下载，前次错误:', await page.getByRole('alert').innerText());
  }
  await expect(download).toHaveText(/战斗素材已下载/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const requested: string[] = [];
  page.on('request', request => { if (request.url().includes('/fate-domination/fgo/v2/')) requested.push(request.url()); });
  const result = await page.evaluate(async () => {
    const loaderUrl = '/src/core/AssetLoader.ts';
    const assetsUrl = '/src/games/fate-domination/fgo-runtime/fgoAssets.ts';
    const loader = await import(/* @vite-ignore */ loaderUrl);
    loader.setAssetsBaseUrl('https://assets.easyboardgame.top/official');
    const assets = await import(/* @vite-ignore */ assetsUrl);
    const installed = await assets.hasDownloadedFgoAssets();
    const model = await assets.readFgoJson('fgo-characters/100100/model.json');
    return { installed, hasAttack: model.skin.animations.some((animation: { name: string }) => animation.name === 'attack_b') };
  });
  expect(result).toEqual({ installed: true, hasAttack: true });
  expect(requested).toEqual([]);
});
