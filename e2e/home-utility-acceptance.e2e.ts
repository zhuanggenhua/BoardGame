import { test, expect, initHome, login, switchStyle, openGame, capture, record } from './helpers/homeAcceptance';

for (const mobile of [false, true]) for (const style of ['modern', 'classic'] as const) {
    const label = `${mobile ? '手机' : '桌面'}-${style === 'modern' ? '现代' : '经典'}`;
    test(`${label}支持作者、操作指南、抽屉与悬浮工具可进入及收起`, async ({ browser }, info) => {
        info.setTimeout(60_000);
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, hasTouch: mobile, isMobile: mobile });
        try {
            const page = await context.newPage(); await initHome(page);
            if (style === 'classic') await switchStyle(page, style);
            if (!mobile && style === 'classic') {
                // 真实建房产生热门徽标，复现二维码与卡片徽标重叠的原始竞争态。
                await openGame(page, style, 'tictactoe', '井字棋');
                await page.getByRole('button', { name: '创建房间', exact: true }).click();
                await page.getByTestId('create-room-name-input').fill('赞助层级验收房间');
                await page.getByTestId('create-room-confirm-button').click();
                await expect(page.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 30_000 });
                await page.goto('/');
                await expect(page.locator('[data-game-id="tictactoe"] .animate-pulse')).toBeVisible();
            }
            if (mobile && style === 'modern') await page.getByRole('button', { name: '菜单', exact: true }).tap();
            const support = page.getByRole('button', { name: '支持作者', exact: true }).filter({ visible: true });
            if (mobile) await support.tap(); else { await support.hover(); await expect(page.getByRole('region', { name: '支持作者' })).toBeVisible(); }
            await expect(page.getByRole('img', { name: /二维码/ })).toHaveCount(2);
            await expect.poll(() => page.getByRole('img', { name: /二维码/ }).evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
            const qrOcclusions = await page.getByRole('img', { name: /二维码/ }).evaluateAll(images => images.flatMap(image => {
                const rect = image.getBoundingClientRect();
                return [0.2, 0.5, 0.8].flatMap(x => [0.2, 0.5, 0.8].map(y => document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y) !== image));
            }));
            expect(qrOcclusions).not.toContain(true);
            if (!mobile && style === 'classic') {
                const overlap = await page.locator('[data-game-id="tictactoe"] .animate-pulse').evaluate(badge => {
                    const b = badge.getBoundingClientRect();
                    return [...document.querySelectorAll('img[alt*="二维码"]')].flatMap(image => {
                        const r = image.getBoundingClientRect();
                        const left = Math.max(b.left, r.left), top = Math.max(b.top, r.top);
                        const right = Math.min(b.right, r.right), bottom = Math.min(b.bottom, r.bottom);
                        return right > left && bottom > top ? [{ badgeOverlapsCode: true, codeIsTopmost: document.elementFromPoint((left + right) / 2, (top + bottom) / 2) === image }] : [];
                    });
                });
                expect(overlap.length).toBeGreaterThan(0);
                expect(overlap.every(item => item.codeIsTopmost)).toBe(true);
                await record(`${label}-二维码层级`, { overlap });
            }
            if (style === 'modern') await capture(page, `${label}-支持作者展开`);
            await page.getByRole('button', { name: '关闭赞助说明', exact: true }).click();
            await expect(page.getByRole('region', { name: '支持作者' })).toHaveCount(0);
            if (!mobile) {
                await page.mouse.move(1, 1);
                await support.focus(); await page.keyboard.press('Enter');
                await expect(page.getByRole('region', { name: '支持作者' })).toBeVisible();
                await page.keyboard.press('Escape');
                await expect(page.getByRole('region', { name: '支持作者' })).toHaveCount(0);
            }
            await page.getByTestId('home-operation-guide-entry').filter({ visible: true }).click();
            await expect(page.getByTestId('operation-guide-modal')).toBeVisible();
            if (style === 'modern') await capture(page, `${label}-操作指南`);
            await page.getByTestId('operation-guide-close').click();
            await expect(page.getByTestId('operation-guide-modal')).toHaveCount(0);
            const menuClose = page.getByRole('button', { name: '关闭菜单', exact: true });
            if (await menuClose.isVisible()) await menuClose.click();
            const fab = page.getByTestId('fab-menu');
            await fab.locator('button').first().click();
            await expect.poll(() => fab.locator('button').filter({ visible: true }).count()).toBeGreaterThan(1);
            const settingsPanel = page.getByTestId('fab-panel-settings');
            if (await settingsPanel.count()) await expect(settingsPanel.getByRole('slider')).toHaveCount(2);
            if (style === 'modern') await capture(page, `${label}-悬浮工具展开`);
            await fab.locator('button').first().click();
            await expect.poll(() => fab.locator('button').filter({ visible: true }).count()).toBe(1);
            await record(label, { authorCodesDecoded: true, authorKeyboard: !mobile, guideOpenedAndClosed: true, floatingActionsVisible: true, floatingActionsClosed: true, boundary: '验证入口和收起，不执行支付、真实社交发送或外部链接' });
        } finally { await context.close(); }
    });
}
for (const mobile of [false, true]) {
    for (const style of ['modern', 'classic'] as const) test(`${mobile ? '手机' : '桌面'}-${style}通知和好友入口可打开关闭`, async ({ browser, accounts }, info) => {
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
        try {
            const page = await context.newPage(); await initHome(page); await login(page, accounts.alice);
            if (style === 'classic') await switchStyle(page, style);
            await page.getByTestId('user-menu-notifications').filter({ visible: true }).first().click();
            const modal = page.getByTestId('friends-chat-modal-content');
            await expect(modal).toBeVisible();
            if (style === 'modern') await capture(page, `${mobile ? '手机' : '桌面'}-通知入口`);
            await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0);
            await page.getByTestId('user-menu-trigger').click();
            await page.getByTestId('user-menu-friends-chat').click();
            await expect(modal).toBeVisible();
            if (style === 'modern') await capture(page, `${mobile ? '手机' : '桌面'}-好友入口`);
            await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0);
            await record(`${mobile ? '手机' : '桌面'}-${style}-通知好友`, { notificationsOpened: true, friendsOpened: true, escapeClosed: true, boundary: '仅验证入口与收起，不发送好友申请或消息' });
        } finally { await context.close(); }
    });
}


