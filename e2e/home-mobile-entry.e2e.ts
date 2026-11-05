import { test, expect, initHome, switchStyle, openGame, capture, record } from './helpers/homeAcceptance';

for (const viewport of [{ width: 375, height: 812 }, { width: 360, height: 800 }]) {
    test(`现代首页 ${viewport.width}×${viewport.height} 首屏能看完整游戏、无方向提示`, async ({ browser }, info) => {
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport, isMobile: true, hasTouch: true });
        try {
            const page = await context.newPage();
            await initHome(page);
            await expect(page.getByTestId('mobile-orientation-home-banner')).toHaveCount(0);
            await expect(page.getByTestId('mobile-orientation-game-banner')).toHaveCount(0);
            await expect(page.getByTestId('fab-panel-settings')).toHaveCount(0);
            const cards = page.locator('.platform-game-card');
            for (let index = 0; index < 2; index++) {
                await expect(cards.nth(index)).toBeInViewport({ ratio: 1 });
                await expect(cards.nth(index).locator('.platform-game-copy strong')).toBeInViewport({ ratio: 1 });
            }
            await expect.poll(() => cards.locator('img').evaluateAll(images => images.slice(0, 2).every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
            const navigation = page.locator('.platform-navigation');
            const discover = navigation.getByRole('button', { name: '发现', exact: true });
            const library = navigation.getByRole('button', { name: '收藏库', exact: true });
            await expect(discover).toHaveAttribute('aria-current', 'page');
            expect(await discover.evaluate(node => getComputedStyle(node, '::after').top)).toBe('0px');
            await capture(page, `手机${viewport.width}-竖屏发现选中态`);
            await library.tap();
            await expect(library).toHaveAttribute('aria-current', 'page');
            await expect(discover).not.toHaveAttribute('aria-current', 'page');
            expect(await library.evaluate(node => getComputedStyle(node, '::after').top)).toBe('0px');
            expect(await discover.evaluate(node => getComputedStyle(node, '::after').content)).toBe('none');
            await capture(page, `手机${viewport.width}-竖屏收藏库选中态`);
            await record(`手机${viewport.width}-首屏可读`, { viewport, firstTwoCardsFullyVisible: true, titlesFullyVisible: true, settingsInitiallyClosed: true, homeOrientationHintAbsent: true });
        } finally { await context.close(); }
    });
}

test('经典首页竖屏无方向提示，保留原有内容', async ({ browser }, info) => {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    try {
        const page = await context.newPage(); await initHome(page); await switchStyle(page, 'classic');
        await expect(page.getByTestId('classic-home-surface')).toBeVisible();
        await expect(page.getByTestId('mobile-orientation-home-banner')).toHaveCount(0);
        await expect(page.getByTestId('mobile-orientation-game-banner')).toHaveCount(0);
        await record('经典首页方向入口', { viewport: '375×812', homeHintAbsent: true, originalSurface: true });
    } finally { await context.close(); }
});

test('首页请求竖屏且不提示，真实建房按游戏配置请求，失败才提示', async ({ browser }, info) => {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true });
    try {
        await context.addInitScript(() => {
            const state = window as Window & { orientationRequests: string[] };
            state.orientationRequests = [];
            Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async (direction: string) => {
                state.orientationRequests.push(direction);
                throw new DOMException('Fixture: browser denied orientation lock', 'NotAllowedError');
            } });
        });
        const page = await context.newPage(); await initHome(page);
        await expect.poll(() => page.evaluate(() => (window as Window & { orientationRequests: string[] }).orientationRequests.length)).toBeGreaterThan(0);
        expect(await page.evaluate(() => (window as Window & { orientationRequests: string[] }).orientationRequests.every(direction => direction === 'portrait'))).toBe(true);
        await expect(page.getByTestId('mobile-orientation-game-banner')).toHaveCount(0);
        await openGame(page, 'modern', 'tictactoe', '井字棋', true);
        const homeRequests = await page.evaluate(() => (window as Window & { orientationRequests: string[] }).orientationRequests.length);
        expect(homeRequests).toBeGreaterThan(0);
        await page.getByRole('button', { name: '创建房间', exact: true }).click();
        await page.getByTestId('create-room-name-input').fill('方向入口回归');
        await page.getByTestId('create-room-confirm-button').click();
        await expect(page.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 30_000 });
        await expect.poll(() => page.evaluate(() => (window as Window & { orientationRequests: string[] }).orientationRequests.length)).toBeGreaterThan(homeRequests);
        const hint = page.getByTestId('mobile-orientation-game-banner');
        await expect(hint.getByText('请关闭竖屏锁定', { exact: true })).toBeVisible();
        await capture(page, '手机横屏-进入竖屏游戏锁定失败提示');
        await hint.getByRole('button', { name: '关闭提示' }).tap();
        await expect(hint).toHaveCount(0);
        await page.goto('/');
        await expect(page.getByTestId('mobile-orientation-home-banner')).toHaveCount(0);
        await record('游戏入口方向尝试', { direction: 'portrait', homeRequestsPortrait: true, homeHintAbsent: true, platformFixture: '仅让 ScreenOrientation.lock 拒绝；未 mock 建房或认证 API', physicalDeviceRotation: 'not-claimed', failureText: '请关闭竖屏锁定' });
    } finally { await context.close(); }
});
