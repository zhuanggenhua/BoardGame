import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, initHome, switchStyle, capture, evidenceDir, sourceRevision } from './helpers/homeAcceptance';

async function verifyOriginalSize(page: Page, context: BrowserContext, mobile: boolean) {
    const viewer = page.getByTestId('operation-guide-image-viewer');
    await viewer.getByTestId('operation-guide-image-viewer-size').click();
    await expect(viewer.getByTestId('operation-guide-image-viewer-size')).toHaveAttribute('aria-pressed', 'true');
    const scroll = viewer.locator('[tabindex="0"]');
    const overflow = await scroll.evaluate(node => node.scrollWidth - node.clientWidth);
    if (overflow <= 0) return;
    if (mobile) {
        const box = (await scroll.boundingBox())!;
        const client = await context.newCDPSession(page);
        const y = box.y + Math.min(box.height / 2, 160);
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width - 40, y }] });
        for (let step = 1; step <= 8; step++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width - 40 - step * 24, y }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach();
    } else {
        await scroll.focus();
        await page.keyboard.press('ArrowRight');
    }
    await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
}

for (const { mobile, native, label } of [
    { mobile: false, native: false, label: '桌面网页' },
    { mobile: true, native: false, label: '手机网页' },
    { mobile: true, native: true, label: '手机应用界面仿真' },
]) {
    test(`${label}指南原始截图与入口坐标`, async ({ browser }, info) => {
        const context = await browser.newContext({
            baseURL: info.project.use.baseURL,
            viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
            isMobile: mobile, hasTouch: mobile,
        });
        try {
            if (native) await context.addInitScript(() => {
                const target = window as typeof window & { androidBridge?: Record<string, never> };
                target.androidBridge = {};
            });
            const page = await context.newPage();
            await initHome(page);
            await switchStyle(page, 'classic');
            const fab = page.getByTestId('fab-menu');
            await fab.locator('button').first().click();
            await page.mouse.move(0, 0);
            await expect(page.locator('[data-fab-id="feedback"]')).toBeVisible();
            await expect.poll(() => page.locator('[data-game-id] img').evaluateAll(images => images.every(image => {
                const rect = image.getBoundingClientRect();
                return rect.top >= innerHeight || rect.bottom <= 0 || (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0;
            }))).toBe(true);
            await expect(page.locator(native ? '[data-fab-id="check-update"]' : '[data-fab-id="download-app"]')).toBeVisible();
            const releaseProfile = native && process.env.VITE_ANDROID_OTA_ENABLED === 'true';
            if (releaseProfile) await expect(page.locator('[data-fab-id="check-update"]')).toHaveAttribute('aria-label', '检查更新');
            const settingsPanel = page.getByTestId('fab-panel-settings');
            await expect(settingsPanel).toBeVisible();
            const settingsPanelRect = await settingsPanel.boundingBox();
            expect(settingsPanelRect).not.toBeNull();
            const buttons = await page.locator('[data-fab-id], .about-entry > button').filter({ visible: true }).evaluateAll(nodes => nodes.map(node => {
                const rect = node.getBoundingClientRect();
                return {
                    id: node.getAttribute('data-fab-id') || 'about',
                    rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 },
                };
            }));
            await mkdir(evidenceDir, { recursive: true });
            const name = native ? 'mobile-app-emulated' : mobile ? 'mobile-web' : 'desktop-web';
            const bytes = await page.screenshot({ animations: 'disabled' });
            await writeFile(join(evidenceDir, `guide-source-${name}.png`), bytes);
            await writeFile(join(evidenceDir, `guide-source-${name}.json`), JSON.stringify({
                sourceRevision, entry: page.url(), nativeApp: false, nativeAppInterfaceEmulated: native, releaseConfigEmulated: releaseProfile, viewport: page.viewportSize(),
                sha256: createHash('sha256').update(bytes).digest('hex'), fabButtons: buttons, settingsPanelRect,
                purpose: '操作指南素材原图，非产品图审通过声明',
            }, null, 2));
            await page.getByTestId('home-operation-guide-entry').filter({ visible: true }).click();
            const modal = page.getByTestId('operation-guide-modal');
            await expect(modal).toBeVisible();
            const figure = modal.getByTestId('operation-guide-real-screenshot-home-fab');
            await figure.scrollIntoViewIfNeeded();
            await figure.evaluate(async node => { await (node as HTMLImageElement).decode(); });
            await expect.poll(() => figure.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(native ? 540 : 2160);
            await modal.getByTestId('operation-guide-real-screenshot-home-fab-zoom-trigger').click();
            const viewer = page.getByTestId('operation-guide-image-viewer');
            await expect(viewer).toBeVisible();
            await capture(page, `${label}-指南首页图放大`);
            await verifyOriginalSize(page, context, mobile);
            if (mobile) await capture(page, `${label}-指南原图平移`);
            await page.getByTestId('operation-guide-image-viewer-close').click();
            await page.getByTestId('operation-guide-close').click();
            await expect(modal).toHaveCount(0);
        } finally {
            await context.close();
        }
    });
}

for (const mobile of [false, true]) {
    test(`${mobile ? '手机' : '桌面'}现代首页指南图片可完整解码和放大`, async ({ browser }, info) => {
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
        try {
            const page = await context.newPage(); await initHome(page);
            if (mobile) await page.getByRole('button', { name: '菜单', exact: true }).tap();
            await page.getByTestId('home-operation-guide-entry').filter({ visible: true }).click();
            const modal = page.getByTestId('operation-guide-modal');
            await expect(modal).toBeVisible();
            for (const image of await modal.locator('img[data-testid^="operation-guide-real-screenshot-"]').all()) {
                await image.scrollIntoViewIfNeeded();
                await image.evaluate(async node => { await (node as HTMLImageElement).decode(); });
                await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
            }
            await modal.getByTestId('operation-guide-real-screenshot-long-press-zoom-trigger').click();
            await expect(page.getByTestId('operation-guide-image-viewer')).toBeVisible();
            await capture(page, `${mobile ? '手机' : '桌面'}-现代指南图片放大`);
            await verifyOriginalSize(page, context, mobile);
            if (mobile) await capture(page, '手机-现代指南原图平移');
            await page.getByTestId('operation-guide-image-viewer-close').click();
            await page.getByTestId('operation-guide-close').click();
            await expect(modal).toHaveCount(0);
        } finally { await context.close(); }
    });
}
