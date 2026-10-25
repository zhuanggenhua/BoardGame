import { test, expect, initHome, capture, record, settings } from './helpers/homeAcceptance';

test.use({ trace: 'retain-on-failure' });

test('现代桌面收藏仅悬停或键盘显示，支持作者悬停反馈及收起', async ({ page }) => {
    await initHome(page);
    const card = page.locator('.platform-game-card[data-game-id="tictactoe"]');
    const favorite = card.locator('.platform-game-favorite');
    await page.mouse.move(1, 1);
    await expect(favorite).toBeHidden();
    await capture(page, '纠正-桌面默认收藏隐藏');
    await card.hover();
    await expect(favorite).toBeVisible();
    await capture(page, '纠正-桌面悬停收藏显示');
    await page.mouse.move(1, 1);
    await expect(favorite).toBeHidden();
    await page.getByRole('searchbox', { name: '搜索游戏' }).focus();
    const focusSequence: string[] = [];
    for (let index = 0; index < 30; index++) {
        await page.keyboard.press('Tab');
        focusSequence.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || '无焦点'));
        if (await card.locator('.platform-game-open').evaluate(node => node === document.activeElement)) break;
    }
    await record('纠正-键盘顺序', focusSequence);
    await expect(card.locator('.platform-game-open')).toBeFocused();
    await expect(favorite).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(favorite).toBeFocused();
    await expect(favorite).toBeVisible();
    await page.keyboard.press('Tab');
    const support = page.getByRole('button', { name: '支持作者', exact: true }).filter({ visible: true });
    await support.hover();
    await expect(page.getByRole('region', { name: '支持作者' })).toBeVisible();
    await expect.poll(() => page.getByRole('img', { name: /二维码/ }).evaluateAll(images => images.length === 2 && images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await capture(page, '纠正-桌面支持作者悬停');
    await page.mouse.move(1, 1);
    await expect(page.getByRole('region', { name: '支持作者' })).toHaveCount(0);
    await support.click();
    await page.mouse.move(1, 1);
    await expect(page.getByRole('region', { name: '支持作者' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: '支持作者' })).toHaveCount(0);
    await record('纠正-桌面行为', { favoriteDefaultHidden: true, hoverVisible: true, keyboardAccessible: true, supportHoverLeave: true, supportClickPinEscape: true });
});

for (const viewport of [{ width: 375, height: 812 }, { width: 360, height: 702 }, { width: 414, height: 896 }]) {
    test(`手机 ${viewport.width}×${viewport.height} 首次触控详情、返回及浮球设置`, async ({ browser }, info) => {
        info.setTimeout(60_000);
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport, isMobile: true, hasTouch: true });
        try {
            const page = await context.newPage();
            await initHome(page);
            const card = page.locator('.platform-game-card[data-game-id="tictactoe"]');
            await card.scrollIntoViewIfNeeded();
            await expect(card.locator('.platform-game-favorite')).toBeHidden();
            const returnScroll = await page.evaluate(() => scrollY);
            await capture(page, `纠正-${viewport.width}-手机默认卡片`);
            await card.locator('.platform-game-open').tap();
            const details = page.getByTestId('game-details-modal-root');
            await expect(details).toBeVisible();
            await expect(details.getByRole('button', { name: '创建房间', exact: true })).toBeVisible();
            await expect(page.locator('.platform-game-card.is-expanded')).toHaveCount(0);
            await details.getByRole('button', { name: '收藏：井字棋', exact: true }).tap();
            await expect(details.getByRole('button', { name: '移出收藏：井字棋', exact: true })).toBeEnabled();
            await capture(page, `纠正-${viewport.width}-手机首次点击详情`);
            // 整组验收前面的真实建房会留有房间；滚动入口应接受实际列表或合法空态。
            const rooms = details.getByTestId(/^room-list-item-/).last()
                .or(details.getByText('暂无活跃房间', { exact: true })).first();
            await expect(rooms).toBeVisible();
            await rooms.scrollIntoViewIfNeeded();
            await expect(rooms).toBeInViewport();
            await capture(page, `纠正-${viewport.width}-详情内容滚动`);
            await page.getByTestId('game-details-close-button').scrollIntoViewIfNeeded();
            await page.getByTestId('game-details-close-button').tap();
            await expect(details).toHaveCount(0);
            await expect.poll(() => page.evaluate(() => scrollY)).toBe(returnScroll);
            await expect(card.locator('.platform-game-favorite')).toBeHidden();
            await page.getByRole('button', { name: '收藏库', exact: true }).tap();
            await expect(card).toBeVisible();
            await card.locator('.platform-game-open').tap();
            await expect(details).toBeVisible();
            await capture(page, `纠正-${viewport.width}-库选中游戏详情`);
            await page.getByTestId('game-details-close-button').tap();
            await expect(card).toBeVisible();
            await page.getByRole('button', { name: '发现', exact: true }).tap();
            await expect(page.getByTestId('home-style-settings-trigger')).toHaveCount(0);
            await expect(page.getByRole('navigation', { name: '菜单' }).getByRole('button', { name: '上传', exact: true })).toHaveCount(0);
            await page.getByRole('button', { name: '菜单', exact: true }).tap();
            await page.getByRole('button', { name: '支持作者', exact: true }).filter({ visible: true }).tap();
            await expect(page.getByRole('region', { name: '支持作者' })).toBeVisible();
            await capture(page, `纠正-${viewport.width}-手机支持作者`);
            await page.getByRole('button', { name: '关闭赞助说明', exact: true }).tap();
            await page.getByRole('button', { name: '上传', exact: true }).tap();
            await expect(page.getByRole('heading', { name: '上传新游戏' })).toBeVisible();
            await expect(page.getByRole('heading', { name: '上传新游戏' })).toBeInViewport();
            await capture(page, `纠正-${viewport.width}-二级上传`);
            await page.getByRole('button', { name: '发现', exact: true }).tap();
            const filters = page.locator('.platform-catalog-filters > div > div');
            expect(await filters.evaluate(node => getComputedStyle(node).scrollbarWidth)).toBe('none');
            await settings(page);
            await expect(page.getByTestId('fab-panel-settings')).toBeVisible();
            await expect(page.getByTestId('fab-sheet-settings')).toHaveCount(0);
            await expect(page.getByRole('radiogroup', { name: '首页风格' })).toBeVisible();
            await capture(page, `纠正-${viewport.width}-浮球设置悬浮窗`);
            await page.locator('.platform-settings-close').scrollIntoViewIfNeeded();
            await expect(page.locator('.platform-settings-close')).toBeInViewport();
            await capture(page, `纠正-${viewport.width}-设置滚动至关闭`);
            await page.locator('.platform-settings-close').tap();
            await expect(page.getByTestId('fab-panel-settings')).toHaveCount(0);
            await settings(page);
            await page.keyboard.press('Escape');
            await expect(page.getByTestId('fab-panel-settings')).toHaveCount(0);
            await expect(page.locator('[data-fab-id="settings"]')).toBeFocused();
            await record(`纠正-${viewport.width}-手机行为`, { viewport, firstTapDetails: true, libraryFirstTapDetails: true, favoriteHidden: true, detailFavorite: true, returnScroll, uploadSecondary: true, settingsPopover: true, tagsScrollbarHidden: true, supportTouchOpenClose: true });
        } finally { await context.close(); }
    });
}
