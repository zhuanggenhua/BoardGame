import { test, expect, initHome, settings, capture, record } from './helpers/homeAcceptance';

for (const mobile of [false, true]) {
    test(`${mobile ? '手机触控' : '桌面鼠标'}浮球拖拽、刷新保留和设置仍可操作`, async ({ browser }, info) => {
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
        try {
            const page = await context.newPage(); await initHome(page);
            const fab = page.getByTestId('fab-menu');
            const key = (await fab.getAttribute('data-fab-storage-key'))!;
            const before = await page.evaluate(key => localStorage.getItem(key), key);
            const box = (await fab.locator('button').first().boundingBox())!;
            const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
            const end = { x: 68, y: 270 };
            if (mobile) {
                const session = await context.newCDPSession(page);
                await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
                for (let step = 1; step <= 12; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * step / 12, y: start.y + (end.y - start.y) * step / 12 }] });
                await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                await session.detach();
            } else {
                await page.mouse.move(start.x, start.y); await page.mouse.down();
                await page.mouse.move(end.x, end.y, { steps: 12 }); await page.mouse.up();
            }
            await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).not.toBe(before);
            const saved = await page.evaluate(key => localStorage.getItem(key), key);
            expect(saved).not.toBeNull();
            await capture(page, `${mobile ? '手机' : '桌面'}-浮球真实拖拽后`);
            await page.reload();
            await expect(fab).toBeVisible();
            expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(saved);
            await settings(page);
            await capture(page, `${mobile ? '手机' : '桌面'}-拖拽刷新后设置仍可用`);
            await page.keyboard.press('Escape');
            await expect(page.getByTestId('fab-panel-settings')).toHaveCount(0);
            await record(`${mobile ? '手机' : '桌面'}-浮球拖拽`, { input: mobile ? '浏览器真实触控事件' : '真实鼠标拖拽', key, before, saved, reloadPersisted: true, settingsOperable: true });
        } finally { await context.close(); }
    });
}

