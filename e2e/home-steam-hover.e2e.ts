import { test, expect, initHome, capture, record } from './helpers/homeAcceptance';

test('桌面封面悬浮显示标题和游戏信息，移开后恢复', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await initHome(page);
    await expect(page.locator('.platform-menu-trigger')).toHaveCount(0);
    await expect(page.locator('.platform-navigation > button')).toHaveText(['发现', '收藏库', '上传']);
    const cards = page.locator('.platform-game-card');
    const first = cards.first();
    const cardLayout = () => cards.evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height };
    }));
    const veilOpacity = (card: ReturnType<typeof cards.nth>) => card.locator('.platform-game-veil').evaluate(node => getComputedStyle(node).opacity);
    const baseline = await cardLayout();
    for (const index of [0, 3]) {
        const card = cards.nth(index);
        const button = card.locator('.platform-game-open');
        await button.hover();
        await expect(card.locator('.platform-game-hover-preview')).toHaveCount(0);
        await expect(card.locator('.platform-game-description')).toHaveCount(0);
        await expect.poll(() => veilOpacity(card)).toBe('1');
        await expect(card.locator('.platform-game-veil strong')).not.toBeEmpty();
        await expect(card.locator('.platform-game-veil p, .platform-game-veil small').first()).toBeVisible();
        await expect.poll(() => card.evaluate(node => node.querySelector('.platform-game-surface')!.getBoundingClientRect().width / node.getBoundingClientRect().width)).toBeGreaterThan(1.04);
        const favorite = card.locator('.platform-game-favorite');
        await expect(favorite).toBeVisible();
        await expect(favorite).toHaveText('');
        await expect(favorite.locator('.platform-game-favorite-label')).toHaveCount(0);
        if (index === 0) {
            await favorite.hover();
            await expect.poll(() => favorite.evaluate(node => getComputedStyle(node).borderRadius)).toBe('0px');
            await expect.poll(() => favorite.evaluate(node => getComputedStyle(node).backgroundColor.replace(/\s+/g, ''))).toMatch(/rgba?\(0,0,0,0\.(6|7|8)/);
            await expect.poll(() => favorite.evaluate(node => getComputedStyle(node).color)).toBe('rgb(213, 255, 0)');
            await expect.poll(() => favorite.evaluate(node => getComputedStyle(node).transform)).toBe('none');
            await expect.poll(() => favorite.evaluate(node => getComputedStyle(node).boxShadow)).toBe('none');
            expect(await favorite.evaluate(node => getComputedStyle(node).color)).not.toBe('rgb(255, 0, 138)');
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
            await favorite.hover();
            await capture(page, '修复-桌面-收藏按钮悬浮反馈');
            await page.mouse.move(1, 1);
        }
        await expect.poll(cardLayout).toEqual(baseline);
        await page.mouse.move(1, 1);
        await expect.poll(() => veilOpacity(card)).toBe('0');
    }
    await page.getByRole('searchbox', { name: '搜索游戏' }).filter({ visible: true }).focus();
    await page.keyboard.press('Tab');
    await expect(first.locator('.platform-game-open')).toBeFocused();
    await expect.poll(() => veilOpacity(first)).toBe('1');
    await expect(page.locator('.platform-game-description')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await first.locator('.platform-game-open').hover();
    await expect(first.locator('.platform-game-surface')).toHaveCSS('transform', 'none');
    await record('桌面悬浮合同', { coverScale: true, onCardVeil: true, sidePreview: false, gridUnchanged: true, reducedMotion: true, squareFavorite: true });
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
        await expect(card.locator('.platform-game-favorite')).toHaveCount(0);
        await expect(page.locator('.platform-game-hover-preview')).toHaveCount(0);
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        await expect(page.getByTestId('game-details-modal-root').getByRole('button', { name: /收藏：/ })).toBeVisible();
        await page.getByTestId('game-details-close-button').tap();
        await expect(page.getByTestId('game-details-modal-root')).toHaveCount(0);
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        await expect.poll(scale).toBeGreaterThan(.999);
        await record('手机触控合同', { directDetails: true, noHoverPreview: true, heldPressVisible: true, cancelRestoresWithoutOpening: true, releaseRestores: true, favoriteInDetails: true });
    } finally { await context.close(); }
});
