import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../framework';
import { setChineseLocale } from '../helpers/common';

const evidenceRoot = join(
    process.cwd(),
    'test-results',
    'evidence-screenshots',
    '_shared',
    'system-routes-mobile.e2e',
);

const saveScreenshot = async (page: Page, testName: string, fileName: string) => {
    const dir = join(evidenceRoot, testName);
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, fileName);
    await page.screenshot({ path: filePath, fullPage: false });
};

const expectNoTopLevelOverflow = async (page: Page) => {
    const metrics = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
    }));

    expect(metrics.docScrollWidth, '系统页 documentElement 不应横向溢出视口').toBeLessThanOrEqual(metrics.innerWidth + 1);
    expect(metrics.bodyScrollWidth, '系统页 body 不应横向溢出视口').toBeLessThanOrEqual(metrics.innerWidth + 1);
};

const expectLocatorWithinViewport = async (locator: Locator, page: Page, label: string) => {
    await expect(locator, `[${label}] 元素不可见`).toBeVisible();
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error(`[${label}] 元素无尺寸`);
    }
    const viewport = page.viewportSize();
    if (!viewport) {
        throw new Error(`[${label}] 缺少视口尺寸`);
    }
    expect(box.x, `[${label}] 左边越界`).toBeGreaterThanOrEqual(-1);
    expect(box.y, `[${label}] 顶边越界`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `[${label}] 右边越界`).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height, `[${label}] 底边越界`).toBeLessThanOrEqual(viewport.height + 1);
};

test.describe('系统页移动端基本兼容', () => {
    test('maintenance 在手机竖屏下应保持主要信息与返回按钮可见', async ({ page }) => {
        await setChineseLocale(page.context());
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/maintenance', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('系统维护')).toBeVisible();
        await expect(page.getByText('工匠正在修缮大厅')).toBeVisible();
        await expectLocatorWithinViewport(page.getByRole('button', { name: '尝试返回大厅' }), page, 'maintenance-back-home');
        await expectNoTopLevelOverflow(page);
        await saveScreenshot(page, 'maintenance 在手机竖屏下应保持主要信息与返回按钮可见', 'maintenance-mobile.png');
    });

    test('404 页面在手机竖屏下应保持标题与返回入口可见', async ({ page }) => {
        await setChineseLocale(page.context());
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/this-route-should-not-exist', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('404')).toBeVisible();
        await expect(page.getByText('迷失在地图之外')).toBeVisible();
        await expectLocatorWithinViewport(page.getByRole('button', { name: '返回大厅' }), page, 'not-found-back-home');
        await expectNoTopLevelOverflow(page);
        await saveScreenshot(page, '404 页面在手机竖屏下应保持标题与返回入口可见', 'not-found-mobile.png');
    });

    test('兼容性拦截页在手机竖屏下应保持原因与操作按钮可见', async ({ browser }) => {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
        });
        await setChineseLocale(context);
        await context.addInitScript(() => {
            try {
                Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: undefined });
                Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: undefined });
            } catch {
                // ignore override failure
            }
        });

        const page = await context.newPage();
        await page.goto('/maintenance', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('当前浏览器兼容性不足')).toBeVisible();
        await expect(page.getByText('检测到的缺失能力')).toBeVisible();
        await expectLocatorWithinViewport(page.getByRole('button', { name: '继续访问（可能异常）' }), page, 'compat-continue');
        await expectLocatorWithinViewport(page.getByRole('button', { name: '重新检测' }), page, 'compat-retry');
        await expectLocatorWithinViewport(page.getByRole('button', { name: '返回首页' }), page, 'compat-back-home');
        await expectNoTopLevelOverflow(page);
        await saveScreenshot(page, '兼容性拦截页在手机竖屏下应保持原因与操作按钮可见', 'browser-compatibility-mobile.png');

        await context.close();
    });
});
