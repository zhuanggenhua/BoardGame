import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { test, expect, initHome, switchStyle, evidenceDir, sourceRevision } from './helpers/homeAcceptance';

for (const mobile of [false, true]) {
    test(`${mobile ? '手机应用界面仿真' : '桌面网页'}指南原始截图与入口坐标`, async ({ browser }, info) => {
        const context = await browser.newContext({
            baseURL: info.project.use.baseURL,
            viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
            isMobile: mobile, hasTouch: mobile,
        });
        try {
            if (mobile) await context.addInitScript(() => {
                const target = window as typeof window & {
                    __BG_E2E_NATIVE_ANDROID_RUNTIME__?: boolean;
                    Capacitor?: { getPlatform: () => string; isNativePlatform: () => boolean };
                };
                target.__BG_E2E_NATIVE_ANDROID_RUNTIME__ = true;
                target.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true };
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
            if (mobile) await expect(page.locator('[data-fab-id="check-update"]')).toBeVisible();
            const buttons = await page.locator('[data-fab-id], .about-entry > button').filter({ visible: true }).evaluateAll(nodes => nodes.map(node => {
                const rect = node.getBoundingClientRect();
                return {
                    id: node.getAttribute('data-fab-id') || 'about',
                    rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 },
                };
            }));
            await mkdir(evidenceDir, { recursive: true });
            const name = mobile ? 'mobile-app-emulated' : 'desktop-web';
            const bytes = await page.screenshot({ animations: 'disabled' });
            await writeFile(join(evidenceDir, `guide-source-${name}.png`), bytes);
            await writeFile(join(evidenceDir, `guide-source-${name}.json`), JSON.stringify({
                sourceRevision, entry: page.url(), nativeApp: false, nativeAppInterfaceEmulated: mobile, viewport: page.viewportSize(),
                sha256: createHash('sha256').update(bytes).digest('hex'), fabButtons: buttons,
                purpose: '操作指南素材原图，非产品图审通过声明',
            }, null, 2));
        } finally {
            await context.close();
        }
    });
}
