import { test, expect, initHome, capture, record } from './helpers/homeAcceptance';

test('桌面封面悬浮突出并在卡片内展开原简介，不产生额外窗口', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await initHome(page);
    const cards = page.locator('.platform-game-card');
    const first = cards.first();
    const baseline = await cards.evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
    }));
    for (const index of [0, 5]) {
        const card = cards.nth(index);
        const button = card.locator('.platform-game-open');
        await button.hover();
        const description = card.locator('.platform-game-description');
        await expect(description).toHaveCSS('opacity', '1');
        await expect(description).not.toBeEmpty();
        await expect.poll(() => card.evaluate(node => node.querySelector('.platform-game-surface')!.getBoundingClientRect().width / node.getBoundingClientRect().width)).toBeGreaterThan(1.04);
        const bounds = await description.boundingBox();
        const host = await card.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(host!.x - host!.width * .03);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(host!.x + host!.width * 1.03);
        await expect(page.locator('.platform-game-hover-preview')).toHaveCount(0);
        await expect(card.locator('.platform-game-favorite')).toBeVisible();
        if (index === 0) await capture(page, '修复-桌面-卡片内悬浮');
        await expect.poll(() => cards.evaluateAll(nodes => nodes.map(node => {
            const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
        }))).toEqual(baseline);
        await page.mouse.move(1, 1);
        await expect(description).toHaveCSS('opacity', '0');
    }
    await page.getByRole('searchbox', { name: '搜索游戏' }).filter({ visible: true }).focus();
    await page.keyboard.press('Tab');
    await expect(first.locator('.platform-game-open')).toBeFocused();
    await expect(first.locator('.platform-game-description')).toHaveCSS('opacity', '1');
    await expect(page.locator('.platform-game-hover-preview')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await first.locator('.platform-game-open').hover();
    await expect(first.locator('.platform-game-surface')).toHaveCSS('transform', 'none');
    await record('桌面悬浮合同', { scaleOverFourPercent: true, descriptionWithinCard: true, noExtraWindow: true, gridUnchanged: true, reducedMotion: true });
});

test('手机直接触控详情，不出现桌面侧边悬浮层', async ({ browser }, info) => {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    try {
        const page = await context.newPage();
        await initHome(page);
        const card = page.locator('.platform-game-card').first();
        const button = card.locator('.platform-game-open');
        const bounds = await button.boundingBox();
        if (!bounds) throw new Error('手机卡片不可见');
        const touch = await context.newCDPSession(page);
        const press = () => touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
        const scale = () => card.evaluate(node => node.querySelector('.platform-game-surface')!.getBoundingClientRect().width / node.getBoundingClientRect().width);
        try {
            await press();
            await expect.poll(scale).toBeLessThan(.98);
            await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
            await expect.poll(scale).toBeGreaterThan(.999);
            await expect(page.getByTestId('game-details-modal-root')).toHaveCount(0);
            await press();
            await expect.poll(scale).toBeLessThan(.98);
            await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await touch.detach(); }
        await expect(page.getByTestId('game-details-modal-root')).toBeVisible();
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        await page.getByTestId('game-details-close-button').tap();
        await expect(page.getByTestId('game-details-modal-root')).toHaveCount(0);
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        await expect.poll(scale).toBeGreaterThan(.999);
        await record('手机触控合同', { directDetails: true, noHoverPreview: true, heldPressVisible: true, cancelRestoresWithoutOpening: true, releaseRestores: true });
    } finally { await context.close(); }
});
