import { test, expect, initHome, login, capture, record, switchStyle } from './helpers/homeAcceptance';
import type { Locator, Page } from '@playwright/test';

const SCREEN_CASES = [
    { mobile: false, label: '桌面', viewport: { width: 1920, height: 1080 } },
    { mobile: true, label: '手机', viewport: { width: 375, height: 812 } },
    { mobile: false, label: '宽屏', viewport: { width: 2560, height: 1304 } },
] as const;

async function modernDialog(panel: Locator) {
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(panel).toHaveCSS('border-top-width', '3px');
    await expect(panel).toHaveCSS('border-top-left-radius', '0px');
    await expect.poll(() => panel.evaluate(node => {
        for (let current: Element | null = node; current; current = current.parentElement) {
            if (Number(getComputedStyle(current).opacity) < .999) return false;
        }
        return true;
    })).toBe(true);
    const box = await panel.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
}

for (const { mobile, label, viewport } of SCREEN_CASES) test(`${label}私密房间密码与销毁确认沿用现代二级弹窗`, async ({ browser }, info) => {
    info.setTimeout(90_000);
    const options = { baseURL: info.project.use.baseURL, viewport, hasTouch: mobile, isMobile: mobile };
    const activate = async (control: Locator) => mobile ? control.tap() : control.click();
    const host = await browser.newContext(options); const guest = await browser.newContext(options);
    try {
        const page = await host.newPage(); await initHome(page);
        await activate(page.locator('[data-game-id="tictactoe"] .platform-game-open'));
        await activate(page.getByRole('button', { name: '创建房间', exact: true }));
        await page.getByTestId('create-room-name-input').fill('私密房间布局验收');
        await page.getByTestId('create-room-password-input').fill('layout-pass');
        const createdResponse = page.waitForResponse(response => response.url().endsWith('/games/tictactoe/create') && response.request().method() === 'POST');
        await activate(page.getByTestId('create-room-confirm-button'));
        const response = await createdResponse; expect(response.ok()).toBe(true);
        const { matchID } = await response.json();
        await expect(page.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 30_000 });
        const second = await guest.newPage(); await initHome(second);
        await activate(second.locator('[data-game-id="tictactoe"] .platform-game-open'));
        await activate(second.getByTestId(`room-list-join-${matchID}`));
        const password = second.getByTestId('room-password-modal');
        await modernDialog(password);
        await second.getByTestId('room-password-input').fill('layout-pass');
        await activate(second.getByTestId('room-password-toggle'));
        await expect(second.getByTestId('room-password-input')).toHaveAttribute('type', 'text');
        await activate(second.getByTestId('room-password-toggle'));
        await capture(second, `${label}-私密房间密码`);
        await activate(password.getByRole('button', { name: '取消', exact: true }));
        await expect(password).toHaveCount(0);
        await page.goto('/'); await expect(page.getByTestId('home-active-match-leave')).toBeVisible();
        await activate(page.getByTestId('home-active-match-leave'));
        const confirm = page.locator('[data-platform-dialog="confirm"]');
        await modernDialog(confirm); await capture(page, `${label}-房间确认`);
        await activate(confirm.getByRole('button', { name: '取消', exact: true }));
        await expect(confirm).toHaveCount(0); await expect(page.getByTestId('home-active-match-banner')).toBeVisible();
        await record(`${label}-房间二级弹窗`, { realRoomCreated: true, secondContextPasswordOpened: true,
            revealPassword: true, cancelPreservedRoom: true, destroyConfirmCanceled: true });
    } finally { await host.close(); await guest.close(); }
});

async function openUserMenu(page: Page) {
    await page.getByTestId('user-menu-trigger').click();
}

test('360窄屏长介绍与完整动作区保持可用', async ({ browser }, info) => {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 360, height: 702 }, hasTouch: true, isMobile: true });
    try {
        const page = await context.newPage(); await initHome(page);
        await page.locator('[data-game-id="dicethrone"] .platform-game-open').tap();
        const details = page.getByTestId('game-details-modal-root');
        const intro = details.getByTestId('game-details-description');
        await expect(intro).toContainText('骰子');
        const cover = await details.locator('.platform-details-cover').boundingBox();
        const description = await intro.boundingBox();
        expect(description!.x).toBeGreaterThanOrEqual(cover!.x + cover!.width);
        expect(description!.y).toBeLessThan(cover!.y + cover!.height);
        expect(await intro.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
        const actions = details.locator('.platform-details-actions');
        expect(await actions.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
        await expect(details).toBeInViewport({ ratio: 1 });
        await details.getByTestId('game-details-author-button-mobile').tap();
        await expect(page.getByTestId('game-details-author-modal')).toBeVisible();
        await page.getByTestId('game-details-author-modal').locator('.platform-dialog-close').tap();
        await page.getByTestId('game-details-close-button').tap();
        await expect(details).toHaveCount(0);
        await record('窄屏介绍与动作区', { realLongDescription: true, descriptionBesideCover: true, scrollable: true,
            actionsFit: true, authorAndCloseHitTest: true, screenshotOmitted: '与375版同构，不重复交付相同UI' });
    } finally { await context.close(); }
});

for (const { mobile, label, viewport } of SCREEN_CASES) {
    test(`${label}现代详情布局与作者入口`, async ({ browser }, info) => {
        info.setTimeout(120_000);
        const context = await browser.newContext({ baseURL: info.project.use.baseURL,
            viewport,
            hasTouch: mobile, isMobile: mobile });
        try {
            const page = await context.newPage(); await initHome(page);
            const activate = async (locator: Locator) => mobile ? locator.tap() : locator.click();
            const ttt = page.locator('[data-game-id="tictactoe"] .platform-game-open');
            await activate(ttt);
            const details = page.getByTestId('game-details-modal-root');
            const intro = details.getByTestId('game-details-description');
            const favorite = details.locator('.platform-details-favorite');
            await expect(intro).toContainText('经典的井字棋');
            await expect(favorite).toHaveText('', { useInnerText: true });
            await expect(favorite).toHaveAccessibleName('收藏：井字棋');
            await activate(favorite);
            await expect(favorite).toHaveAttribute('aria-pressed', 'true');
            await expect(favorite).toHaveAccessibleName('移出收藏：井字棋');
            if (mobile) {
                const cover = await details.locator('.platform-details-cover').boundingBox();
                const title = await details.getByTestId('game-details-title').boundingBox();
                const description = await intro.boundingBox();
                expect(description!.x).toBeGreaterThanOrEqual(cover!.x + cover!.width);
                expect(description!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
                expect(description!.y).toBeLessThan(cover!.y + cover!.height);
            }
            await capture(page, `${label}-详情新布局`);
            const authorButton = details.getByTestId('game-details-author-button-mobile');
            await expect(authorButton).toHaveCSS('text-decoration-line', 'underline');
            await activate(authorButton);
            const author = page.getByTestId('game-details-author-modal');
            await modernDialog(author);
            await capture(page, `${label}-作者说明`);
            await activate(author.locator('.platform-dialog-close'));
            await expect(author).toHaveCount(0); await expect(details).toBeVisible();
            await activate(details.getByRole('button', { name: '创建房间', exact: true }));
            const create = page.locator('.platform-room-dialog');
            await expect(create).toBeVisible();
            await page.getByTestId('create-room-name-input').fill('布局验收');
            await capture(page, `${label}-创建房间`);
            await activate(page.getByTestId('create-room-cancel-button'));
            await expect(create).not.toBeVisible(); await expect(details).toBeVisible();
            await activate(page.getByTestId('game-details-close-button'));
            await expect(details).toHaveCount(0);

            // 使用实际长介绍，不向页面注入虚构文案；首尾滚动不增加摘要布局高度。
            await activate(page.locator('[data-game-id="dicethrone"] .platform-game-open'));
            await expect(intro).toContainText('骰子');
            if (mobile) {
                expect(await intro.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
                const before = await details.locator('.platform-details-summary').boundingBox();
                await intro.focus(); await page.keyboard.press('End');
                await expect.poll(() => intro.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
                const after = await details.locator('.platform-details-summary').boundingBox();
                expect(after!.height).toBeCloseTo(before!.height, 0);
            }
            await capture(page, `${label}-长介绍滚动`);
            await activate(page.getByTestId('game-details-close-button'));
            await expect(details).toHaveCount(0);

            await record(`${label}-详情布局行为`, { favoriteIconToggle: true, descriptionPlacement: mobile,
                longDescriptionScroll: mobile, authorOpenedClosed: true, createCanceled: true });
        } finally { await context.close(); }
    });

    test(`${label}现代赞助与二级弹窗`, async ({ browser, accounts }, info) => {
        info.setTimeout(120_000);
        const context = await browser.newContext({ baseURL: info.project.use.baseURL,
            viewport,
            hasTouch: mobile, isMobile: mobile });
        try {
            const page = await context.newPage(); await initHome(page);
            const activate = async (locator: Locator) => mobile ? locator.tap() : locator.click();
            if (mobile) await activate(page.getByRole('button', { name: '菜单', exact: true }));
            const support = page.getByRole('button', { name: '支持作者', exact: true }).filter({ visible: true });
            if (mobile) await support.tap(); else await support.hover();
            const sponsor = page.getByRole('region', { name: '支持作者' });
            await expect(sponsor).toBeVisible();
            await expect(sponsor.locator('.author-support-note')).toBeHidden();
            await expect.poll(() => sponsor.locator('img').evaluateAll(nodes => nodes.length === 2 && nodes.every(node => (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
            await capture(page, `${label}-赞助紧凑展开`);
            await activate(page.getByRole('button', { name: '关闭赞助说明', exact: true }));
            if (mobile) await activate(page.getByRole('button', { name: '关闭菜单', exact: true }));
            await login(page, accounts.alice);

            await openUserMenu(page); await activate(page.getByTestId('user-menu-account-settings'));
            const account = page.getByTestId('account-settings-modal');
            await modernDialog(account);
            await capture(page, `${label}-账户设置`);
            await activate(account.getByRole('button', { name: '修改', exact: true }).first());
            const avatar = page.locator('[data-platform-dialog="avatar"]');
            await modernDialog(avatar);
            await activate(avatar.getByRole('button', { name: '取消', exact: true }));
            await expect(avatar).toHaveCount(0);
            await activate(page.getByTestId('account-settings-open-email'));
            const email = page.getByTestId('email-bind-modal');
            await modernDialog(email);
            await page.getByTestId('email-bind-address-input').fill('layout@example.invalid');
            await capture(page, `${label}-邮箱设置`);
            await activate(email.getByRole('button', { name: '取消', exact: true }));
            await expect(email).toHaveCount(0);
            await activate(account.getByRole('button', { name: '关闭', exact: true }));

            await page.getByTestId('user-menu-notifications').filter({ visible: true }).first().click();
            const social = page.getByTestId('friends-chat-modal-content');
            await modernDialog(social);
            await capture(page, `${label}-通知弹窗`);
            await activate(social.locator('.platform-dialog-close'));
            await expect(social).toHaveCount(0);
            await openUserMenu(page); await activate(page.getByTestId('user-menu-friends-chat'));
            await modernDialog(social);
            await capture(page, `${label}-好友弹窗`);
            await page.keyboard.press('Escape'); await expect(social).toHaveCount(0);

            await openUserMenu(page); await activate(page.getByTestId('user-menu-my-feedback'));
            const feedbackList = page.getByTestId('my-feedback-modal');
            await modernDialog(feedbackList);
            await expect(feedbackList.getByText('你还没有提交过反馈', { exact: true })).toBeVisible();
            await capture(page, `${label}-我的反馈`);
            await page.keyboard.press('Escape'); await expect(feedbackList).toHaveCount(0);
            await openUserMenu(page); await activate(page.getByRole('button', { name: '光标设置', exact: true }));
            const cursor = page.locator('[data-platform-dialog="cursor"]');
            await modernDialog(cursor);
            await expect(cursor.getByRole('button').filter({ has: page.getByRole('img', { name: '默认', exact: true }) })).toBeVisible();
            await capture(page, `${label}-光标设置`);
            await activate(cursor.getByRole('button').filter({ hasText: '王权骰铸' }).first());
            await activate(cursor.getByRole('button', { name: '更换', exact: true }));
            const variants = page.locator('[data-platform-dialog="cursor-variants"]');
            await modernDialog(variants);
            await capture(page, `${label}-光标变体`);
            const variantScroll = variants.locator('.platform-cursor-variant-scroll');
            // 手机直接展示全部六种预览；不再把横向滑动当作默认发现条件。
            expect(await variantScroll.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
            for (const heading of await variants.locator('.platform-cursor-variant-heading .platform-cursor-variant-cells > span').all()) {
                await expect(heading).toBeInViewport();
            }
            expect(await variants.locator('.platform-dialog-close').evaluate(node => {
                const rect = node.getBoundingClientRect();
                return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
            })).toBe(true);
            await activate(variants.locator('.platform-dialog-close'));
            await expect(variants).toHaveCount(0);
            await activate(cursor.getByRole('button', { name: '关闭', exact: true }));
            await expect(cursor).toHaveCount(0);

            const fab = page.getByTestId('fab-menu');
            await activate(fab.locator('button').first());
            await activate(fab.locator('[data-fab-id="about"]'));
            const about = page.locator('[data-platform-dialog="about"]');
            await modernDialog(about);
            await expect(about.locator('.platform-dialog-close')).toHaveCSS('color', 'rgb(255, 255, 255)');
            await expect(about.locator('.author-support-content, .author-support-codes')).toHaveCount(0);
            await capture(page, `${label}-关于`);
            await activate(about.locator('.platform-dialog-close'));
            await expect(about).toHaveCount(0);
            const coverRect = await page.locator('[data-game-id="dicethrone"] .platform-game-art img').boundingBox();
            expect(coverRect).not.toBeNull();
            await activate(fab.locator('[data-fab-id="feedback"]'));
            const feedback = page.locator('[data-platform-dialog="feedback"]');
            const feedbackCloseEvents: string[] = [];
            await page.exposeFunction('__homeFeedbackInput', (type: string) => { feedbackCloseEvents.push(type); });
            await expect(feedback.locator('textarea')).not.toHaveAttribute('placeholder', /Ctrl\+V/);
            // 自动截屏会暂时隐藏弹窗本身；等待真实预览，避免在中间态抢读布局或采图。
            await expect(page.getByTestId('feedback-image-preview')).toBeVisible({ timeout: 20_000 });
            // 已加载的王权封面在导出图中也必须存在；空白占位只有低色差，不能以预览节点存在冒充成功。
            await expect.poll(() => page.getByTestId('feedback-image-preview').locator('img').evaluate((node, args) => {
                const img = node as HTMLImageElement;
                if (!img.naturalWidth) return 0;
                const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
                let colorful = 0;
                for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) {
                    const px = Math.floor((args.rect.x + args.rect.width * (.2 + x * .06)) / args.width * canvas.width);
                    const py = Math.floor((args.rect.y + args.rect.height * (.2 + y * .06)) / args.height * canvas.height);
                    const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
                    if (Math.max(r, g, b) - Math.min(r, g, b) > 70) colorful++;
                }
                return colorful;
            }, { rect: coverRect!, width: viewport.width, height: viewport.height })).toBeGreaterThan(20);
            await modernDialog(feedback);
            await expect(feedback.locator('.platform-dialog-close')).toHaveCSS('color', 'rgb(255, 255, 255)');
            await capture(page, `${label}-反馈表单`);
            await feedback.locator('.platform-dialog-close').evaluate(button => {
                for (const type of ['touchstart','touchend','click']) button.addEventListener(type, () => {
                    void (window as unknown as { __homeFeedbackInput: (type:string) => Promise<void> }).__homeFeedbackInput(type);
                }, { capture:true });
            });
            if (mobile) {
                const preview = page.getByTestId('feedback-image-preview');
                await expect(preview.locator('button')).toHaveCSS('opacity', '1');
                const content = feedback.locator('div.overflow-y-auto').first();
                await expect.poll(()=>content.evaluate(node=>node.scrollHeight-node.clientHeight)).toBeGreaterThan(0);
                const box = await content.boundingBox();
                expect(box).not.toBeNull();
                const touch = await context.newCDPSession(page);
                const x = box!.x + 12;
                const start = box!.y + box!.height * .8, end = box!.y + box!.height * .25;
                const finger=(y:number)=>({id:1,x,y,radiusX:8,radiusY:8,force:1});
                await touch.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[finger(start)] });
                for (let step=1;step<=18;step++) {
                    await touch.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[finger(start+(end-start)*step/18)] });
                    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
                }
                for (let frame=0;frame<10;frame++) {
                    await touch.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[finger(end)] });
                    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
                }
                await touch.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
                await expect.poll(() => content.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
                // 等实际惯性滚动停止，再进行下一个手势，避免首个点按只用于终止滚动。
                await content.evaluate(async node => {
                    let previous = node.scrollTop, stable = 0;
                    while (stable < 12) {
                        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
                        const current = node.scrollTop;
                        stable = Math.abs(current - previous) < .1 ? stable + 1 : 0;
                        previous = current;
                    }
                });
                expect(await preview.evaluate(node => {
                    const r = node.getBoundingClientRect(), p = node.parentElement!.getBoundingClientRect();
                    return r.top >= p.top && r.bottom <= p.bottom + 1;
                })).toBe(true);
                await capture(page, `${label}-反馈附件滚动`);
                await record('手机反馈附件承载', { visibleDeleteWithoutHover: true, realTouchScrolled: true, completePreviewInsideScrollWindow: true });
                const closeButton = feedback.locator('.platform-dialog-close');
                expect(await closeButton.evaluate(node => {
                    const r=node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
                })).toBe(true);
            }
            if (!mobile) {
                const preview = page.getByTestId('feedback-image-preview');
                const remove = preview.locator('button');
                await preview.hover(); await expect(remove).toHaveCSS('opacity','1');
                await page.mouse.move(1,1);
                await feedback.locator('textarea').focus(); await page.keyboard.press('Tab');
                await expect(remove).toBeFocused(); await expect(remove).toHaveCSS('opacity','1');
                if(label==='桌面') await capture(page,'桌面-反馈附件键盘操作');
                await page.keyboard.press('Enter'); await expect(preview).toHaveCount(0);
                await record(`${label}-反馈附件删除`,{hoverRevealed:true,tabRevealed:true,enterDeleted:true});
            }
            await activate(feedback.locator('.platform-dialog-close'));
            try { await expect(feedback).toHaveCount(0); }
            finally { await record(`${label}-反馈关闭输入`, { events:feedbackCloseEvents, closed:await feedback.count()===0 }); }
            await activate(fab.locator('button').first());

            // 同一正式入口切经典，仅核对样式隔离，不拍重复旧图。
            await switchStyle(page, 'classic');
            await openUserMenu(page); await activate(page.getByTestId('user-menu-account-settings'));
            await expect(account).toBeVisible();
            await expect(account).not.toHaveCSS('border-top-width', '3px');
            await page.keyboard.press('Escape');
            await record(`${label}-二级弹窗行为`, { supportExpandedClosed: true,
                accountAvatarEmail: true, notificationFriendsFeedbackCursorAbout: true, cursorVariantsOpenedClosed: true,
                historyPresentationOnly: true, classicStyleIsolated: true,
                boundary: '只验证样式及入口/关闭，不发送支付、社交消息或邮箱验证码；截图只保留本轮不同UI变化' });
        } finally { await context.close(); }
    });
}
