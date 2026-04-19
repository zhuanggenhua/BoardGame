import { test, expect } from '@playwright/test';

async function createIPhoneXRContext(browser: Parameters<typeof test>[0]['browser'], baseURL?: string) {
  return browser.newContext({
    baseURL,
    viewport: { width: 414, height: 896 },
    isMobile: true,
    hasTouch: true,
  });
}

test.describe('移动端横屏适配', () => {
  test('主页在 iPhone XR 竖屏下不显示横屏提示', async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const context = await createIPhoneXRContext(browser, baseURL);
    const page = await context.newPage();

    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root > *', { timeout: 15000 });
      await expect(page.getByText('建议旋转至横屏')).toHaveCount(0);
      await expect(page.locator('#root')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('Cardia 在 iPhone XR 竖屏下显示横屏提示且可关闭', async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const context = await createIPhoneXRContext(browser, baseURL);
    const page = await context.newPage();

    try {
      await page.goto('/play/cardia/local', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-game-page]', { timeout: 20000 });

      const banner = page.getByText('建议旋转至横屏以获得更佳体验');
      await expect(banner).toBeVisible({ timeout: 15000 });

      const closeButton = page.getByRole('button', { name: '关闭提示' });
      await expect(closeButton).toBeVisible();
      await closeButton.click();
      await expect(banner).toHaveCount(0);

      await expect(page.locator('[data-game-page]')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
