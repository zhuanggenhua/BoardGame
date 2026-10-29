import { test, expect, initHome, login, openGame, openHomeUpload, capture, record, beginHomeEvidence } from './helpers/homeAcceptance';

const views = [
    { name:'桌面', width:1920, height:1080, minColumns:7, maxCardWidth:260 },
    { name:'窄桌面', width:1024, height:768, minColumns:4, maxCardWidth:260 },
    { name:'平板', width:820, height:1180, columns:3 },
    { name:'手机', width:375, height:812, columns:2 },
    { name:'中桌面', width:1280, height:900, minColumns:5, maxCardWidth:260 },
];
for (const view of views) {
    test(`现代布局对比重构-${view.name}`, async ({ browser, accounts }, info) => {
        info.setTimeout(100_000);
        const mobile = view.width < 1024;
        const context = await browser.newContext({ baseURL:info.project.use.baseURL, viewport:{width:view.width,height:view.height}, hasTouch:mobile, isMobile:mobile });
        try {
            const page = await context.newPage();
            await initHome(page);
            const metrics = await page.locator('.platform-home').evaluate(root => {
                const grid = root.querySelector('.platform-game-grid')!;
                const card = root.querySelector('.platform-game-card')?.getBoundingClientRect();
                const nav = root.querySelector('.platform-navigation')!.getBoundingClientRect();
                const header = root.querySelector('.platform-home-header')!.getBoundingClientRect();
                return { columns:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length, cardWidth:card?.width ?? 0, overflow:document.documentElement.scrollWidth-innerWidth, navCenter:nav.x+nav.width/2, navWidth:nav.width, headerCenter:header.x+header.width/2, legacyUnderline:root.querySelectorAll('.platform-category-list .underline-center').length };
            });
            if (view.columns) expect(metrics.columns).toBe(view.columns);
            if (view.minColumns) expect(metrics.columns).toBeGreaterThanOrEqual(view.minColumns);
            if (view.maxCardWidth) expect(metrics.cardWidth).toBeLessThanOrEqual(view.maxCardWidth);
            expect(metrics.overflow).toBeLessThanOrEqual(1);
            expect(metrics.legacyUnderline).toBe(0);
            if (!mobile) expect(Math.abs(metrics.navCenter-metrics.headerCenter)).toBeLessThanOrEqual(1);
            else expect(metrics.navWidth).toBe(view.width);
            await expect(page.getByTestId('mobile-orientation-home-banner')).toHaveCount(0);
            if (view.width!==1280) await capture(page,`重构-${view.name}-发现`);
            if (view.width === 1920) {
                const card = page.locator('[data-game-id="tictactoe"]');
                await expect(card.locator('.platform-game-favorite')).toBeHidden();
                await card.locator('.platform-game-open').hover();
                await expect(card.locator('.platform-game-favorite')).toBeVisible();
                await capture(page,'重构-桌面-悬浮介绍');
            }
            await openGame(page,'modern','tictactoe','井字棋',mobile);
            if (view.width === 375) await capture(page,'重构-手机-详情');
            const details = page.getByTestId('game-details-modal-root');
            if (mobile) await page.getByTestId('game-details-close-button').tap(); else await page.getByTestId('game-details-close-button').click();
            await expect(details).toHaveCount(0);
            if (view.width===1280) {
                await login(page,accounts.bob);
                await page.getByRole('button',{name:'收藏库',exact:true}).click();
                await expect(page.getByRole('button',{name:'收藏库',exact:true})).toHaveAttribute('aria-current','page');
                await page.getByRole('button',{name:'发现',exact:true}).click();
                const covers = page.locator('.platform-game-card img');
                await expect(covers).toHaveCount(11);
                await record('中桌面返回发现-图片初态', await covers.evaluateAll(images => images.map(image => ({ gameId:image.closest('[data-game-id]')?.getAttribute('data-game-id'), complete:(image as HTMLImageElement).complete, width:(image as HTMLImageElement).naturalWidth, opacity:getComputedStyle(image).opacity }))));
                await expect.poll(() => covers.evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0 && getComputedStyle(image).opacity === '1')), {timeout:25_000}).toBe(true);
                await record('中桌面返回发现-图片显示', {decoded:11, allOpaque:true});
                await capture(page,'重构-中桌面-登录导航');
            }
            if (view.width === 375 || view.width === 1024) {
                await login(page,accounts.alice);
                await page.goto('/?section=profile');
                await expect(page.getByTestId('profile-page')).toBeVisible();
                if (!mobile) expect(await page.getByTestId('profile-page').evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(900);
                await capture(page,`重构-${view.name}-个人中心`);
                if (mobile) {
                    await openHomeUpload(page, true);
                    await expect(page.locator('.platform-upload-form')).toBeVisible();
                    await capture(page,'重构-手机-投稿表头');
                    const author = page.locator('.platform-upload-form input[name="author"]');
                    await author.scrollIntoViewIfNeeded();
                    await author.tap();
                    expect(await author.evaluate(node=>{const r=node.getBoundingClientRect();const nav=document.querySelector('.platform-navigation')!.getBoundingClientRect();return r.top>=0&&r.bottom<=nav.top;})).toBe(true);
                    await page.setViewportSize({width:320,height:740});
                    await page.getByRole('button',{name:'菜单',exact:true}).click();
                    await page.locator('.platform-menu-dialog [data-language-style="platform"] > button').click();
                    await page.getByRole('button',{name:/English/}).click();
                    await page.locator('.platform-menu-close').click();
                    await page.getByTestId('user-menu-trigger').click();
                    await page.getByTestId('user-menu-profile').click();
                    await expect(page.getByTestId('profile-plays').getByRole('heading',{name:'Match History',exact:true})).toBeVisible();
                    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
                    await capture(page,'重构-窄手机-英文个人中心');
                    await openHomeUpload(page, true);
                    await expect(page.getByRole('heading',{name:'Submit a new game',exact:true})).toBeVisible();
                    expect(await page.locator('.platform-upload-form-heading h2').evaluate(node=>node.getBoundingClientRect().height)).toBeLessThanOrEqual(72);
                    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
                    await capture(page,'重构-窄手机-英文投稿');
                }
            }
            await record(`重构-${view.name}`,{metrics, cardOpenAndClose:true, authorFieldScrollReachable:view.width===375, englishProfileAndUpload:view.width===375, userContract:{hoverFavorite:true, secondaryUpload:true, classicUnchanged:true}, viewport:view});
        } finally { await context.close(); }
    });
}

for (const view of [views[0],views[3]]) {
    test(`现代详情冷加载-${view.name}`, async ({browser},info) => {
        const context = await browser.newContext({baseURL:info.project.use.baseURL,viewport:{width:view.width,height:view.height},isMobile:view.width<1024,hasTouch:view.width<1024});
        let release = () => {};
        const gate = new Promise<void>(resolve => { release=resolve; });
        try {
            const page = await context.newPage();
            await page.route('**/src/components/lobby/GameDetailsModal.tsx*', async route => { await gate; await route.continue(); });
            await beginHomeEvidence(page);
            // 普通卡片点击会先预热模块再改URL；冷加载骨架的真实入口是直接打开详情链接。
            await context.addInitScript(() => localStorage.setItem('i18nextLng','zh-CN'));
            await page.goto('/?game=tictactoe',{waitUntil:'domcontentloaded'});
            const loading = page.getByTestId('home-game-details-loading-fallback-root');
            await expect(loading).toBeVisible();
            await expect(loading).toHaveClass(/platform-game-details/);
            const before = await loading.boundingBox();
            await capture(page,`重构-${view.name}-详情冷加载`);
            release();
            const details = page.getByTestId('game-details-modal-root');
            await expect(details).toBeVisible();
            const after = await details.boundingBox();
            expect(Math.abs(before!.height-after!.height)).toBeLessThanOrEqual(2);
            expect(Math.abs(before!.y-after!.y)).toBeLessThanOrEqual(2);
            await page.keyboard.press('Escape');
            await expect(details).toBeHidden();
            await record(`冷加载-${view.name}`,{before,after,sameStyle:true,escapeClose:true});
        } finally { release(); await context.close(); }
    });
}
