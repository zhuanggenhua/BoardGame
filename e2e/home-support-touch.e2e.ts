import { test, expect, initHome, switchStyle } from './helpers/homeAcceptance';

test('手机经典支持作者入口触控展开', async ({ browser }, info) => {
    info.setTimeout(60_000);
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    try {
        const page = await context.newPage();
        await initHome(page);
        await switchStyle(page, 'classic');
        const button = page.getByRole('button', { name: '支持作者', exact: true }).filter({ visible: true });
        await page.evaluate(() => {
            const trace: unknown[] = [];
            Object.assign(window, { __supportTouchTrace: trace });
            for (const type of ['pointerover', 'pointerdown', 'pointerup', 'mouseover', 'mousedown', 'mouseup', 'focusin', 'click']) {
                document.addEventListener(type, event => {
                    const target = event.target instanceof Element ? event.target : null;
                    const trigger = document.querySelector<HTMLElement>('.author-support-trigger');
                    const box = trigger?.getBoundingClientRect();
                    trace.push({ type, target: target?.closest('button')?.textContent?.trim(), expanded: trigger?.getAttribute('aria-expanded'), x: box?.x, y: box?.y });
                }, true);
            }
        });
        await button.tap();
        await page.waitForTimeout(200);
        const trace = await page.evaluate(() => (window as unknown as { __supportTouchTrace: unknown[] }).__supportTouchTrace);
        console.log('SUPPORT_TOUCH_TRACE', JSON.stringify(trace));
        await expect(page.getByRole('img', { name: /二维码/ })).toHaveCount(2);
        await page.getByRole('button', { name: '关闭赞助说明', exact: true }).tap();
        await expect(page.getByRole('img', { name: /二维码/ })).toHaveCount(0);
    } finally { await context.close(); }
});
