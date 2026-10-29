import { test, expect, initHome, login, openGame, openHomeUpload, switchStyle, evidenceDir, runId, sourceRevision, capture, record } from './helpers/homeAcceptance';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const stageDir = join(evidenceDir, 'motion');
const snapshot = (page: Page) => page.evaluate(() => ({
    url: location.pathname + location.search,
    style: document.documentElement.dataset.homeEntryStyle,
    details: Boolean(document.querySelector('[data-testid="game-details-modal-root"]')),
    menu: Boolean(document.querySelector('.platform-menu-dialog[open]')),
    headings: [...document.querySelectorAll('h1,h2')].map(node => node.textContent?.trim()).filter(Boolean),
}));

test('PC工具保持顶栏直达，中英文与登录前后不重复收纳', async ({ browser, accounts }, info) => {
    info.setTimeout(120_000);
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 1440, height: 900 } });
    try {
        const page = await context.newPage();
        await initHome(page);
        const setLanguage = async (language: string) => {
            await page.setViewportSize({ width: 1920, height: 900 });
            await page.locator('.platform-desktop-utility [data-language-style="platform"] > button').click();
            await page.getByRole('button', { name: language === 'en' ? /English/ : /中文/ }).click();
            await expect(page.locator('.platform-navigation button').first()).toHaveText(language === 'en' ? 'Discover' : '发现');
        };
        for (const authenticated of [false, true]) {
            if (authenticated) { await setLanguage('zh-CN'); await login(page, accounts.alice); }
            for (const language of ['zh-CN', 'en']) {
                await setLanguage(language);
                await expect(page.locator('.platform-home-header')).toBeVisible();
                await expect(page.locator('.platform-navigation button').first()).toHaveText(language === 'en' ? 'Discover' : '发现');
                await page.evaluate(() => document.fonts.ready);
                for (const width of [1024, 1280, 1366, 1440, 1920]) {
                    await page.setViewportSize({ width, height: 900 });
                    await page.mouse.move(0, 0);
                    await expect(page.locator('.platform-menu-trigger')).toHaveCount(0);
                    await expect(page.locator('.platform-menu-dialog[open]')).toHaveCount(0);
                    await expect(page.locator('.platform-desktop-utility [data-overflow]')).toHaveCount(0);
                    const tools = page.locator('.platform-desktop-utility');
                    await expect(tools.getByTestId('home-operation-guide-entry')).toBeVisible();
                    await expect(tools.locator('.author-support-trigger')).toBeVisible();
                    await expect(tools.locator('[data-language-style="platform"] > button')).toBeVisible();
                    await expect(page.locator('.platform-upload-desktop-entry')).toHaveCount(0);
                    const navigationGroup = page.locator('.platform-navigation');
                    await expect(navigationGroup.locator(':scope > button')).toHaveCount(3);
                    const navGeometry = await navigationGroup.evaluate(node => {
                        const buttons = [...node.querySelectorAll(':scope > button')];
                        const buttonRects = buttons.map(button => {
                            const rect = button.getBoundingClientRect();
                            return { label: button.textContent?.trim(), x: rect.x, y: rect.y, right: rect.right };
                        });
                        const rect = node.getBoundingClientRect();
                        return { left: rect.left, right: rect.right, center: rect.left + rect.width / 2,
                            viewportWidth: document.documentElement.clientWidth, buttons: buttonRects };
                    });
                    expect(navGeometry.buttons.map(button => button.label)).toEqual(language === 'en' ? ['Discover', 'Library', 'Upload'] : ['发现', '收藏库', '上传']);
                    expect(navGeometry.buttons[1].x).toBeGreaterThanOrEqual(navGeometry.buttons[0].right);
                    expect(Math.abs(navGeometry.buttons[1].y - navGeometry.buttons[0].y)).toBeLessThanOrEqual(0.5);
                    expect(Math.abs(navGeometry.center - navGeometry.viewportWidth / 2)).toBeLessThanOrEqual(2);
                    const metrics = await page.evaluate(() => {
                        const header = document.querySelector('.platform-home-header')!.getBoundingClientRect();
                        const actions = document.querySelector('.platform-header-actions')!.getBoundingClientRect();
                        const navigation = document.querySelector('.platform-navigation')!.getBoundingClientRect();
                        return { headerBottom: header.bottom, actionLeft: actions.left, actionRight: actions.right,
                            navRight: navigation.right, viewportWidth: document.documentElement.clientWidth };
                    });
                    expect(metrics.actionLeft).toBeGreaterThanOrEqual(0);
                    expect(metrics.actionRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
                    expect(metrics.navRight).toBeLessThanOrEqual(metrics.actionLeft + 1);
                    const navigationHitTargets = await page.locator('.platform-navigation button').evaluateAll(nodes => nodes.map(node => {
                        const r = node.getBoundingClientRect();
                        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                        const box = (selector: string) => {
                            const element = document.querySelector(selector);
                            if (!element) return null;
                            const rect = element.getBoundingClientRect();
                            return { x: rect.x, y: rect.y, right: rect.right, width: rect.width, height: rect.height };
                        };
                        const children = (selector: string) => [...(document.querySelector(selector)?.children ?? [])].map(element => {
                            const rect = element.getBoundingClientRect();
                            const style = getComputedStyle(element);
                            return { className: (element as HTMLElement).className, text: element.textContent?.trim(),
                                x: rect.x, right: rect.right, width: rect.width, position: style.position, transform: style.transform };
                        });
                        return { label: node.textContent?.trim(), inside: Boolean(hit && node.contains(hit)), width: document.documentElement.clientWidth,
                            rect: { x: r.x, y: r.y, width: r.width, height: r.height },
                            hit: hit ? { tag: hit.tagName, className: (hit as HTMLElement).className } : null,
                            navigation: box('.platform-navigation'), actions: box('.platform-header-actions'),
                            utility: box('.platform-desktop-utility'), brand: box('.platform-home-brand'),
                            actionChildren: children('.platform-header-actions'), utilityChildren: children('.platform-desktop-utility') };
                    }));
                    for (const hitTarget of navigationHitTargets) {
                        expect(hitTarget.inside, `PC导航中心被遮挡: ${JSON.stringify(hitTarget)}`).toBe(true);
                    }
                    await page.locator('.platform-navigation button').first().click();
                    await record(`顶栏工具-${authenticated}-${language}-${width}`, metrics);
                }
            }
        }
    } finally { await context.close(); }
});

test('桌面上传在收藏库右侧，手机从菜单进入', async ({ browser, accounts }, info) => {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 1920, height: 900 } });
    try {
        const page = await context.newPage();
        await initHome(page);
        for (const authenticated of [false, true]) {
            if (authenticated) await login(page, accounts.alice);
            for (const width of [1920, 1280, 1024]) {
                await page.setViewportSize({ width, height: 900 });
                await expect(page.locator('.platform-menu-trigger')).toHaveCount(0);
                await expect(page.locator('.platform-menu-dialog[open]')).toHaveCount(0);
                await expect(page.locator('.platform-navigation > button')).toHaveCount(3);
                await expect(page.locator('.platform-navigation > button').nth(0)).toHaveText('发现');
                await expect(page.locator('.platform-navigation > button').nth(1)).toHaveText('收藏库');
                await expect(page.locator('.platform-navigation > button').nth(2)).toHaveText('上传');
                if (width === 1024) {
                    await openHomeUpload(page);
                    if (authenticated) await expect(page.locator('.platform-upload-workspace')).toBeVisible();
                    else await expect(page.locator('.platform-upload-login')).toBeVisible();
                    await page.getByRole('button', { name: '发现', exact: true }).click();
                    await expect(page.locator('.platform-menu-trigger')).toHaveCount(0);
                }
            }
        }
        await record('桌面上传入口', { guestAndUser: true, desktopNavUpload: true, noDesktopMenu: true, uploadLoads: true });
    } finally { await context.close(); }

    const mobileContext = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    try {
        const mobilePage = await mobileContext.newPage();
        await initHome(mobilePage);
        await expect(mobilePage.locator('.platform-upload-desktop-entry')).toHaveCount(0);
        await expect(mobilePage.getByRole('navigation', { name: '菜单' }).getByRole('button', { name: '上传', exact: true })).toHaveCount(0);
        const trigger = mobilePage.getByRole('button', { name: '菜单', exact: true });
        await expect(trigger).toBeVisible();
        await trigger.tap();
        const menu = mobilePage.getByRole('dialog', { name: '菜单' });
        const upload = menu.getByRole('button', { name: '上传', exact: true });
        await expect(upload).toBeVisible();
        await upload.tap();
        await capture(mobilePage, '修复-手机-上传从菜单进入');
        await expect(menu).toBeHidden();
        await expect(mobilePage.locator('.platform-upload-login')).toBeVisible();
        await record('手机上传入口', { hamburgerUpload: true, uploadLoads: true, drawerHasUpload: true });
    } finally { await mobileContext.close(); }
});

for (const mobile of [false, true]) {
    const label = mobile ? '手机' : 'PC';
    test(`${label}现代首页真实交互录屏`, async ({ browser, accounts }, info) => {
        info.setTimeout(150_000);
        await mkdir(stageDir, { recursive: true });
        const viewport = mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 };
        // 登录是录屏前置条件；避免登录退场与展示起点共用同一个录制管线。
        const preparation = await browser.newContext({ baseURL: info.project.use.baseURL, viewport, isMobile: mobile, hasTouch: mobile });
        let storageState: Awaited<ReturnType<BrowserContext['storageState']>>;
        try {
            const preparationPage = await preparation.newPage();
            await initHome(preparationPage);
            await login(preparationPage, accounts.alice);
            storageState = await preparation.storageState();
        } finally { await preparation.close(); }
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport, isMobile: mobile, hasTouch: mobile,
            storageState, recordVideo: { dir: join(stageDir, 'raw'), size: viewport } });
        const videoStarted = Date.now();
        const page = await context.newPage();
        const activate = async (target: Locator) => {
            if (!mobile) return target.click();
            await target.scrollIntoViewIfNeeded();
            await expect(target).toBeVisible();
            const bounds = await target.boundingBox();
            if (!bounds) throw new Error('触控目标没有实际画面位置');
            const touch = await context.newCDPSession(page);
            try {
                await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
                await page.waitForTimeout(140); // 正常按住再松开，让真实按压反馈进入录屏，不改变动画速度。
                await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            } finally { await touch.detach(); }
        };
        const video = page.video();
        if (!video) throw new Error('当前验收要求实际录屏，不能跳过');
        const steps: object[] = [];
        const checkpoints: { name: string; elapsed: number }[] = [];
        let clipStart = 0;
        const pauseForViewing = () => page.waitForTimeout(1100); // 状态已断言后留给录屏阅读，不作为通过条件。
        const step = async (id: string, action: string, perform: () => Promise<Record<string, boolean>>) => {
            const before = await snapshot(page);
            checkpoints.push({ name: id, elapsed: (Date.now() - videoStarted) / 1000 });
            const checks = await perform();
            steps.push({ id, action, before: { visible: before, authoritative: { userId: accounts.alice.id } },
                after: { visible: await snapshot(page), authoritative: { userId: accounts.alice.id, checks } },
                assertions: Object.entries(checks).map(([name, actual]) => ({ name, actual, expected: true })) });
            await pauseForViewing();
        };
        try {
            await initHome(page);
            await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
            await expect(page.getByTestId('auth-login-account-input')).toHaveCount(0);
            await page.evaluate(async () => { await document.fonts.ready; });
            await page.screenshot(); // 触发实际画面采集；最终仍须核对原视频包含稳定首页。
            await page.waitForTimeout(1200);
            clipStart = (Date.now() - videoStarted) / 1000;
            await page.evaluate(() => {
                const frames: object[] = [];
                Object.assign(window, { __homeMotionFrames: frames });
                const sample = () => {
                    for (const selector of ['.platform-menu-dialog', '.home-game-details-layer']) {
                        const node = document.querySelector(selector);
                        if (!node) continue;
                        const style = getComputedStyle(node);
                        if (style.display === 'none') continue;
                        frames.push({ selector, t: performance.now(), transform: style.transform, opacity: Number(style.opacity), exiting: Boolean(node.closest('[data-modal-exiting]')) });
                    }
                    requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
            });
            await pauseForViewing();
            if (!mobile) {
                await step('卡片悬浮', '逐张悬停封面，观察独立侧边介绍层，网格占位保持不变', async () => {
                    for (const index of [0, 5]) {
                        const card = page.locator('.platform-game-card').nth(index);
                        await card.locator('.platform-game-open').hover();
                        const preview = card.locator('.platform-game-hover-preview');
                        await expect(preview).toBeVisible();
                        await expect(card.locator('.platform-game-veil')).toHaveCount(0);
                        await expect(card.locator('.platform-game-description')).toHaveCount(0);
                        await expect.poll(() => card.evaluate(node => node.querySelector('.platform-game-surface')!.getBoundingClientRect().width / node.getBoundingClientRect().width)).toBeGreaterThan(1.04);
                        if (index === 0) {
                            const favorite = card.locator('.platform-game-favorite');
                            await expect(favorite).toContainText('收藏');
                            await favorite.hover();
                            await expect.poll(() => favorite.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(213, 255, 0)');
                            await expect.poll(() => favorite.evaluate(node => getComputedStyle(node).transform)).toBe('none');
                            expect(await favorite.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgb(255, 0, 138)');
                        }
                        await pauseForViewing();
                        await page.mouse.move(1, 1);
                        await expect(preview).toHaveCount(0);
                        await pauseForViewing();
                    }
                    return { desktopScale: true, sidePreview: true, favoriteHoverFeedback: true, previewClosed: true };
                });
                await step('按钮反馈', '悬停分类按钮后移开，观察抬起和硬阴影恢复', async () => {
                    const filter = page.getByRole('button', { name: '卡牌', exact: true });
                    await filter.hover();
                    await pauseForViewing();
                    const lifted = await filter.evaluate(node => getComputedStyle(node).transform !== 'none' && getComputedStyle(node).boxShadow !== 'none');
                    expect(lifted).toBe(true);
                    await page.mouse.move(1, 1);
                    return { feedbackSeenAtRealPointer: lifted };
                });
            }
            await step('支持作者', '展开支持作者说明后收起，桌面使用真实悬停', async () => {
                if (mobile) await page.getByRole('button', { name: '菜单', exact: true }).tap();
                const support = page.getByRole('button', { name: '支持作者', exact: true }).filter({ visible: true });
                if (mobile) await support.tap(); else await support.hover();
                const popover = page.getByRole('region', { name: '支持作者', exact: true });
                await expect(popover).toBeVisible();
                await expect.poll(() => popover.locator('img').evaluateAll(images => images.length === 2 && images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
                await pauseForViewing();
                if (mobile) await page.getByRole('button', { name: '关闭赞助说明', exact: true }).tap();
                else await page.mouse.move(1, 1);
                await expect(popover).toHaveCount(0);
                if (mobile) await page.getByRole('button', { name: '关闭菜单', exact: true }).tap();
                return { supportOpened: true, artworkLoaded: true, supportClosed: true };
            });
            await step('工具与指南', '打开操作指南并使用关闭叉返回首页', async () => {
                if (mobile) await page.getByRole('button', { name: '菜单', exact: true }).tap();
                const guide = page.getByTestId('home-operation-guide-entry').filter({ visible: true });
                await expect(guide).toBeVisible();
                if (mobile) await guide.tap(); else await guide.click();
                await expect(page.getByTestId('operation-guide-modal')).toBeVisible();
                await pauseForViewing();
                await activate(page.getByTestId('operation-guide-close'));
                await expect(page.getByTestId('operation-guide-modal')).toHaveCount(0);
                return { guideOpened: true, guideClosed: true, desktopToolsDirect: mobile || await page.locator('.platform-desktop-utility').isVisible() };
            });
            await step('上传入口', '桌面导航打开上传，手机从菜单进入上传', async () => {
                if (mobile) {
                    await expect(page.getByRole('navigation', { name: '菜单' }).getByRole('button', { name: '上传', exact: true })).toHaveCount(0);
                    await page.getByRole('button', { name: '菜单', exact: true }).tap();
                    const menu = page.getByRole('dialog', { name: '菜单' });
                    const upload = menu.getByRole('button', { name: '上传', exact: true });
                    await expect(upload).toBeVisible();
                    await upload.tap();
                    await expect(menu).toBeHidden();
                    const author = page.locator('.platform-upload-form input[name="author"]');
                    await expect(author).toBeVisible();
                    const tabBar = page.locator('.platform-navigation');
                    const beforeScroll = await author.boundingBox();
                    const tabBarBounds = await tabBar.boundingBox();
                    if (!beforeScroll || !tabBarBounds) throw new Error('手机投稿表单或固定导航没有实际画面位置');
                    if (beforeScroll.y + beforeScroll.height > tabBarBounds.y) {
                        const touch = await context.newCDPSession(page);
                        const x = Math.round(page.viewportSize()!.width / 2);
                        const startY = Math.min(tabBarBounds.y - 12, beforeScroll.y - 16);
                        const endY = Math.max(180, startY - 340);
                        try {
                            await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
                            for (const fraction of [0.25, 0.5, 0.75, 1]) {
                                await page.waitForTimeout(35);
                                await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + (endY - startY) * fraction }] });
                            }
                            await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                        } finally { await touch.detach(); }
                    }
                    await expect.poll(async () => {
                        const field = await author.boundingBox();
                        const nav = await tabBar.boundingBox();
                        return Boolean(field && nav && field.y + field.height <= nav.y);
                    }).toBe(true);
                    await author.tap();
                    await expect(author).toBeFocused();
                    await author.fill('');
                    await page.keyboard.type('验收作者');
                    await expect(author).toHaveValue('验收作者');
                    await pauseForViewing();
                } else {
                    await expect(page.locator('.platform-menu-trigger')).toHaveCount(0);
                    await expect(page.locator('.platform-menu-dialog[open]')).toHaveCount(0);
                    await openHomeUpload(page);
                }
                await expect(page.locator('.platform-upload-workspace')).toBeVisible();
                await pauseForViewing();
                await activate(page.getByRole('button', { name: '发现', exact: true }));
                await expect(page.locator('.platform-upload-workspace')).toHaveCount(0);
                return mobile
                    ? { uploadOpened: true, mobileUploadFromMenu: true, drawerClosed: true, authorFieldScrollsAboveTabBar: true, authorFieldAcceptsTyping: true, returnedToDiscover: true }
                    : { uploadOpened: true, desktopHasMenu: await page.locator('.platform-menu-trigger').count() === 0, navUpload: true, returnedToDiscover: true };
            });
            await step('卡片与详情', '从正式卡片打开井字棋详情', async () => {
                const card = page.locator('[data-game-id="tictactoe"] .platform-game-open');
                await card.scrollIntoViewIfNeeded();
                if (!mobile) { await card.hover(); await pauseForViewing(); }
                await activate(card);
                await expect(page.getByTestId('game-details-modal-root')).toBeVisible();
                return { detailsOpened: true, noCardPopover: await page.locator('.platform-game-card.is-expanded').count() === 0 };
            });
            await step('收藏反馈', '在详情中切换星标并验证服务器响应后的状态', async () => {
                const favorite = page.locator('.platform-details-favorite');
                const before = await favorite.getAttribute('aria-pressed');
                await activate(favorite);
                await expect(favorite).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
                await expect(favorite).toBeEnabled();
                return { favoriteChanged: true, saveCompleted: true };
            });
            await step('关闭详情', '通过关闭叉返回原卡片位置', async () => {
                await activate(page.getByTestId('game-details-close-button'));
                await expect(page.getByTestId('game-details-modal-root')).toHaveCount(0);
                const exitVisible = await page.evaluate(() => (window as unknown as { __homeMotionFrames: {selector:string;exiting:boolean;opacity:number}[] }).__homeMotionFrames.some(frame => frame.selector === '.home-game-details-layer' && frame.exiting && frame.opacity > 0 && frame.opacity < 1));
                expect(exitVisible).toBe(true);
                await expect(page.locator('[data-game-id="tictactoe"] .platform-game-open')).toBeInViewport();
                return { closed: true, exitVisible, originalCardVisible: true };
            });
            await step('切换导航', '切换收藏库再返回发现，保持既有选中表达', async () => {
                const library = page.getByRole('button', { name: '收藏库', exact: true });
                await activate(library);
                await expect(library).toHaveAttribute('aria-current', 'page');
                await pauseForViewing();
                await activate(page.getByRole('button', { name: '发现', exact: true }));
                await expect(page.getByRole('button', { name: '发现', exact: true })).toHaveAttribute('aria-current', 'page');
                return { librarySelected: true, discoverSelected: true };
            });
            const clipEnd = (Date.now() - videoStarted) / 1000;
            const motionFrames = await page.evaluate(() => (window as unknown as { __homeMotionFrames: object[] }).__homeMotionFrames);
            await writeFile(join(stageDir, `${label}-动效采样.json`), JSON.stringify(motionFrames));
            await context.close();
            const rawVideo = join(stageDir, `${label}-原始.webm`);
            await video.saveAs(rawVideo);
            await writeFile(join(stageDir, `${label}-录制元数据.json`), JSON.stringify({ label, viewport, rawVideo, clipStart, clipEnd, checkpoints,
                chainId: `home-motion-${mobile ? 'mobile' : 'desktop'}`, gameId: 'home', evidenceCategory: 'independent', sourceRun: runId, sourceRevision,
                status: 'PASS', outcome: '指南、收藏按钮悬浮反馈、详情和桌面导航或手机菜单上传均从正式入口完成', steps, uiStates: [],
                rawSha256: createHash('sha256').update(readFileSync(rawVideo)).digest('hex') }, null, 2));
            await record(`${label}-录屏行为`, { steps: steps.length, viewport, clipStart, clipEnd, rawVideo });
        } finally { await context.close(); }
    });
}

test('手机菜单键盘与减少动态正常，经典入口保留', async ({ page }) => {
    await initHome(page);
    await page.setViewportSize({ width: 375, height: 812 });
    const trigger = page.getByRole('button', { name: '菜单', exact: true });
    await trigger.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.platform-menu-dialog')).toHaveAttribute('data-motion', 'instant');
    await page.keyboard.press('Escape');
    await expect(page.locator('.platform-menu-dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
    for (let i = 0; i < 3; i++) {
        await trigger.click();
        await page.keyboard.press('Escape');
    }
    await expect(page.locator('.platform-menu-dialog')).toBeHidden();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await trigger.click();
    expect(await page.locator('.platform-menu-dialog').evaluate(node => getComputedStyle(node).transform)).toBe('none');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('.platform-menu-trigger')).toHaveCount(0);
    await switchStyle(page, 'classic');
    await expect(page.getByTestId('classic-home-surface')).toBeVisible();
    await expect(page.locator('.platform-navigation')).toHaveCount(0);
    await openGame(page, 'classic', 'tictactoe', '井字棋');
    await expect(page.getByTestId('game-details-modal-root')).toBeVisible();
    await page.getByTestId('game-details-close-button').click();
    await expect(page.getByTestId('game-details-modal-root')).toHaveCount(0);
    await expect(page.locator('[data-modal-exiting]')).toHaveCount(0);
    await record('可访问与经典保留', { keyboardImmediate: true, focusRestored: true, rapidToggle: true, reducedMotion: true, classicEntryAndDetails: true });
});
