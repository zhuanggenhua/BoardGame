import { test, expect, initHome, capture } from './helpers/homeAcceptance';

// 依据用户整屏截图和系统 175% 缩放估算网页内容区；另覆盖较矮的普通窗口。
for (const viewport of [{ width: 1462, height: 747 }, { width: 1280, height: 650 }]) {
    test(`桌面发现页 ${viewport.width}×${viewport.height}`, async ({ browser }, info) => {
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport });
        try {
            const page = await context.newPage();
            await initHome(page);
            const cards = page.locator('.platform-game-card');
            await expect(cards.first()).toBeVisible();
            await expect(page.getByRole('button', { name: '王权骰铸' }).first()).toBeVisible();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            const boxes = await cards.evaluateAll(nodes => nodes.slice(0, 7).map(node => {
                const rect = node.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            }));
            expect(boxes.length).toBeGreaterThanOrEqual(7);
            if (viewport.width === 1462) expect(boxes[6].y).toBe(boxes[0].y);
            expect(boxes[0].width).toBeLessThan(232);
            await capture(page, `桌面${viewport.width}x${viewport.height}-发现页`);
            await page.getByRole('button', { name: '王权骰铸' }).first().click();
            await expect(page.getByRole('button', { name: '创建房间', exact: true })).toBeVisible();
        } finally { await context.close(); }
    });
}
