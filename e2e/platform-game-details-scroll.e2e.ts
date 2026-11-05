import { test, expect, type Page } from '@playwright/test';
import { createHomeVisualFixture, installHomeVisualData } from './helpers/homeVisualFixture.mjs';

// 使用正式首页与详情入口；仅房间和接口数据隔离，不写开发数据库。
async function openDetails(page: Page, roomCount = 5, library = false) {
    const fixture = await createHomeVisualFixture({ roomCount });
    await installHomeVisualData(page.context(), { socketUrl: fixture.url, authenticated: true });
    if (library) await page.route('**/game-changelogs/dicethrone', route => route.fulfill({ json: {
        changelogs: Array.from({ length: 8 }, (_, index) => ({
            id: `scroll-update-${index}`, gameId: 'dicethrone', title: `英雄与联机体验更新 ${8 - index}`,
            content: '完善英雄技能说明，改进多人房间列表与新手教学体验。\n\n修复对战中的显示问题，并优化手机端阅读与操作。',
            publishedAt: '2026-10-30T00:00:00.000Z', createdAt: '2026-10-30T00:00:00.000Z',
        })),
    } }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    if (library) await page.getByRole('button', { name: '收藏库', exact: true }).click();
    await page.locator('[data-game-id="dicethrone"] .platform-game-open').click();
    await expect(page.getByTestId('room-list-item-d1ce0000')).toBeVisible();
    await page.waitForTimeout(300);
    return fixture;
}

test('桌面详情从头部滚动到末条房间，关闭保持可达并恢复背景滚动', async ({ page }) => {
    await page.setViewportSize({ width: 1463, height: 745 });
    const fixture = await openDetails(page);
    try {
        const root = page.getByTestId('game-details-modal-root');
        const scroller = page.locator('.platform-details-scroll');
        const header = await page.getByTestId('game-details-sidebar').boundingBox();
        await page.mouse.move(header!.x + 30, header!.y + 90);
        await page.mouse.wheel(0, 1000);
        await expect(page.getByTestId('room-list-item-d1ce0004')).toBeInViewport();
        await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        await expect(page.getByTestId('game-details-close-button')).toBeInViewport();
        expect(await page.evaluate(() => scrollY)).toBe(0);
        await scroller.focus();
        await page.keyboard.press('Home');
        await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(0);
        await page.keyboard.press('End');
        await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        for (const [tab, lastItem] of [
            ['changelog', '.game-changelog-item'], ['reviews', '.platform-review-item'],
            ['leaderboard', '.platform-details-content section > div:last-child > div'],
        ]) {
            await page.getByTestId(`game-details-tab-${tab}`).click();
            await expect(page.locator(lastItem).last()).toBeAttached();
            await scroller.focus();
            await page.keyboard.press('Home');
            await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(0);
            const summary = await page.getByTestId('game-details-sidebar').boundingBox();
            await page.mouse.move(summary!.x + 30, summary!.y + 90);
            await page.mouse.wheel(0, 1200);
            await expect(page.locator(lastItem).last()).toBeInViewport();
            await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        }
        await page.getByTestId('game-details-close-button').click();
        await expect(root).toHaveCount(0);
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
        await page.mouse.move(700, 450);
        await page.mouse.wheel(0, 700);
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    } finally { await fixture.close(); }
});

test('桌面详情首屏显示多个房间，超出容量的房间可以继续滚动', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const fixture = await openDetails(page, 12);
    try {
        await expect(page.locator('[data-testid^="room-list-item-"]')).toHaveCount(12);
        const visible = await page.locator('[data-testid^="room-list-item-"]').evaluateAll(items => {
            const area = document.querySelector('.platform-details-scroll')!.getBoundingClientRect();
            return items.filter(item => { const box = item.getBoundingClientRect(); return box.top >= area.top && box.bottom <= area.bottom; }).length;
        });
        expect(visible).toBeGreaterThanOrEqual(3);
        const area = await page.locator('.platform-details-scroll').boundingBox();
        await page.mouse.move(area!.x + 50, area!.y + 90);
        await page.mouse.wheel(0, 3000);
        await expect(page.getByTestId('room-list-item-d1ce000b')).toBeInViewport();
        await expect(page.getByTestId('game-details-close-button')).toBeInViewport();
    } finally { await fixture.close(); }
});

test('手机详情触控可滚到末条房间及更新底部，关闭回到收藏库', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const fixture = await openDetails(page, 5, true);
    try {
        const scroller = page.locator('.platform-details-scroll');
        await page.evaluate(() => document.fonts.ready);
        const heading = await page.locator('.platform-details-heading').evaluate(element => {
            const title = element.querySelector('h2')!, author = element.querySelector('button')!;
            const textCenter = (node: Element) => {
                const range = document.createRange(); range.selectNodeContents(node);
                const box = range.getBoundingClientRect(); return box.top + box.height / 2;
            };
            return { delta: Math.abs(textCenter(title) - textCenter(author)), authorHeight: author.getBoundingClientRect().height };
        });
        expect(heading.delta).toBeLessThanOrEqual(2);
        expect(heading.authorHeight).toBeGreaterThanOrEqual(44);
        const client = await context.newCDPSession(page);
        const swipe = async () => {
            await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 730 }] });
            for (let y = 710; y >= 330; y -= 38) {
                await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y }] });
                await page.waitForTimeout(18);
            }
            await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        };
        await swipe();
        await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        await expect(page.getByTestId('room-list-item-d1ce0004')).toBeInViewport();
        await page.getByTestId('game-details-tab-changelog').click();
        for (let count = 0; count < 5; count++) await swipe();
        await expect(page.locator('.game-changelog-item').last()).toBeInViewport();
        await expect(page.getByTestId('game-details-close-button')).toBeInViewport();
        await page.getByTestId('game-details-close-button').click();
        await expect(page.locator('.platform-catalog--library')).toBeVisible();
        expect(new URL(page.url()).searchParams.has('game')).toBe(false);
    } finally { await context.close(); await fixture.close(); }
});

test('桌面收藏库详情更新为主栏，页面滚动到底可达', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const fixture = await openDetails(page, 5, true);
    try {
        const updates = page.locator('.platform-library-detail-updates');
        const rooms = page.locator('.platform-details-content > .custom-scrollbar');
        const left = await updates.boundingBox(), right = await rooms.boundingBox();
        expect(left!.width / right!.width).toBeGreaterThan(1.8);
        await page.mouse.move(left!.x + 60, left!.y + 60);
        await page.mouse.wheel(0, 1200);
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
        await expect(updates.locator('.game-changelog-item').last()).toBeInViewport();
        await page.getByRole('button', { name: '收藏库', exact: true }).click();
        await expect(page.locator('.platform-catalog--library')).toBeVisible();
        expect(new URL(page.url()).searchParams.has('libraryGame')).toBe(false);
    } finally { await fixture.close(); }
});
