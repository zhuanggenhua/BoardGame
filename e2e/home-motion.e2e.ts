import { test, expect, initHome, login, openGame, switchStyle, evidenceDir, runId, sourceRevision, capture, record } from './helpers/homeAcceptance';
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

test('PC工具按真实空间收纳，中英文与登录前后不拦截导航', async ({ browser, accounts }, info) => {
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
                    const measure = () => page.locator('.platform-header-actions').evaluate(group => {
                        const children = [...group.children] as HTMLElement[];
                        const gap = Number.parseFloat(getComputedStyle(group).columnGap) || 0;
                        const tools = group.querySelector('.platform-desktop-utility')!;
                        const items = [...tools.children] as HTMLElement[];
                        const others = children.filter(child => child !== tools);
                        const budget = group.clientWidth - others.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) - gap * others.length;
                        const toolGap = Number.parseFloat(getComputedStyle(tools).columnGap) || 0;
                        const visible = items.filter(item => getComputedStyle(item).visibility !== 'hidden');
                        const hidden = items.filter(item => getComputedStyle(item).visibility === 'hidden');
                        const used = visible.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0) + Math.max(0, visible.length - 1) * toolGap;
                        const hiddenCouldFit = hidden.some(item => item.getBoundingClientRect().width + (visible.length ? toolGap : 0) <= budget - used + 1);
                        const guide = tools.querySelector('[data-testid="home-operation-guide-entry"]')!.parentElement!;
                        const guideFits = guide.getBoundingClientRect().width <= budget + 1;
                        const guideVisible = getComputedStyle(guide).visibility !== 'hidden';
                        const collapsed = group.hasAttribute('data-utilities-collapsed');
                        return { correct: used <= Math.max(0, budget) + 1 && !hiddenCouldFit && (!guideFits || guideVisible), collapsed, visible: visible.length, total: items.length, guideFits, guideVisible, budget, used, available: group.clientWidth };
                    });
                    await expect.poll(async () => (await measure()).correct).toBe(true);
                    const metrics = await measure();
                    const tools = page.locator('.platform-desktop-utility');
                    if (metrics.guideFits) await expect(tools.getByTestId('home-operation-guide-entry')).toBeVisible();
                    else await expect(tools.getByTestId('home-operation-guide-entry')).toBeHidden();
                    const navigation = page.locator('.platform-navigation button').first();
                    expect(await navigation.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
                    await navigation.click();
                    await record(`工具宽度-${authenticated}-${language}-${width}`, metrics);
                }
            }
        }
    } finally { await context.close(); }
});

test('PC更多菜单只收纳未显示的工具，上传入口保持二级', async ({ browser, accounts }, info) => {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 1920, height: 900 } });
    try {
        const page = await context.newPage();
        await initHome(page);
        for (const authenticated of [false, true]) {
            if (authenticated) await login(page, accounts.alice);
            for (const width of [1920, 1280, 1024]) {
                await page.setViewportSize({ width, height: 900 });
                const trigger = page.getByRole('button', { name: '更多', exact: true });
                await expect(trigger).toBeVisible();
                await expect(page.getByRole('button', { name: '菜单', exact: true })).toHaveCount(0);
                await trigger.click();
                const menu = page.getByRole('dialog', { name: '更多' });
                await expect(menu).toBeVisible();
                await expect(menu.getByRole('button', { name: '上传', exact: true })).toBeVisible();
                for (const [id, selector] of [['support', '.author-support-trigger'], ['guide', '[data-testid="home-operation-guide-entry"]'], ['language', '[data-language-style="platform"] > button']]) {
                    const top = page.locator(`[data-platform-utility-id="${id}"]`);
                    const overflow = await top.evaluate(node => node.hasAttribute('data-overflow'));
                    await expect(menu.locator(selector)).toHaveCount(overflow ? 1 : 0);
                    if (!overflow) await expect(top).toBeVisible();
                }
                const bounds = await menu.boundingBox();
                expect(bounds!.height).toBeLessThan(500);
                if (!authenticated && width === 1920) await capture(page, '修复-桌面-更多菜单');
                if (authenticated && width === 1024) {
                    const support = menu.locator('.author-support-trigger');
                    await expect(support).toBeVisible();
                    await support.click();
                    const content = menu.getByRole('region', { name: '支持作者' });
                    await expect(content).toBeVisible();
                    await expect.poll(() => content.locator('img').evaluateAll(images => images.length === 2 && images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
                    const supportBounds = await content.boundingBox();
                    const menuBounds = await menu.boundingBox();
                    expect(supportBounds!.x).toBeGreaterThanOrEqual(menuBounds!.x);
                    expect(supportBounds!.x + supportBounds!.width).toBeLessThanOrEqual(menuBounds!.x + menuBounds!.width);
                    await capture(page, '修复-桌面-收纳后的支持作者');
                    await content.getByRole('button', { name: '关闭赞助说明' }).click();
                    const guide = menu.getByTestId('home-operation-guide-entry');
                    await guide.click();
                    await expect(page.getByTestId('operation-guide-modal')).toBeVisible();
                    await expect(menu).toBeHidden();
                    await page.getByTestId('operation-guide-close').click();
                    continue;
                }
                await page.keyboard.press('Escape');
                await expect(menu).toBeHidden();
                await expect(trigger).toBeFocused();
            }
        }
        await record('桌面更多入口', { guestAndUser: true, noDuplicatedTools: true, uploadSecondary: true, keyboardReturn: true });
    } finally { await context.close(); }
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
                await step('卡片悬浮', '逐张悬停封面，观察突出与卡片内简介，再移开恢复', async () => {
                    for (const index of [0, 5]) {
                        const card = page.locator('.platform-game-card').nth(index);
                        await card.locator('.platform-game-open').hover();
                        await expect(card.locator('.platform-game-description')).toHaveCSS('opacity', '1');
                        await expect(page.locator('.platform-game-hover-preview')).toHaveCount(0);
                        await expect.poll(() => card.evaluate(node => node.querySelector('.platform-game-surface')!.getBoundingClientRect().width / node.getBoundingClientRect().width)).toBeGreaterThan(1.04);
                        await pauseForViewing();
                        await page.mouse.move(1, 1);
                        await expect(card.locator('.platform-game-description')).toHaveCSS('opacity', '0');
                        await pauseForViewing();
                    }
                    return { desktopScaleAndDescription: true, descriptionClosed: true };
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
            await step('菜单进退', '打开和关闭菜单，观察同侧进退场', async () => {
                const trigger = page.getByRole('button', { name: mobile ? '菜单' : '更多', exact: true });
                if (mobile) await trigger.tap(); else await trigger.click();
                await expect(page.locator('.platform-menu-dialog')).toBeVisible();
                await pauseForViewing();
                if (mobile) await page.getByRole('button', { name: '关闭菜单' }).tap(); else await page.keyboard.press('Escape');
                await expect(page.locator('.platform-menu-dialog')).toBeHidden();
                return { menuOpened: true, menuClosed: true };
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
                status: 'PASS', outcome: '指南、菜单、详情、收藏和返回均从正式入口完成', steps, uiStates: [],
                rawSha256: createHash('sha256').update(readFileSync(rawVideo)).digest('hex') }, null, 2));
            await record(`${label}-录屏行为`, { steps: steps.length, viewport, clipStart, clipEnd, rawVideo });
        } finally { await context.close(); }
    });
}

test('减少动态效果、键盘快速开关与经典入口保留', async ({ page }) => {
    await initHome(page);
    const trigger = page.getByRole('button', { name: '更多', exact: true });
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
