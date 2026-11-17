import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect, initHome, capture, record } from './helpers/homeAcceptance';

async function lobbyMetrics(page: Page) {
    return page.getByTestId('game-details-modal-root').evaluate(root => {
        const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const content = root.querySelector('.platform-details-content')!;
        const rows = [...root.querySelectorAll('[data-testid^="room-list-item-"]')];
        const scroll = root.querySelector('.platform-details-scroll')!;
        const clip = scroll.getBoundingClientRect();
        return { drawer: rect(root), summary: rect(root.querySelector('.platform-details-summary')!), content: rect(content),
            roomWindow: rect(scroll), scrollTop: scroll.scrollTop, total: rows.length,
            fullRows: rows.filter(node => { const r = node.getBoundingClientRect(); return r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1; }).length };
    });
}

test('正式详情常态与多房间容量在手机和PC保持原承载', async ({ browser }, info) => {
    info.setTimeout(180_000);
    const host = await browser.newContext({ baseURL: info.project.use.baseURL });
    const views = [{ width: 375, height: 812, mobile: true }, { width: 360, height: 702, mobile: true },
        { width: 1920, height: 1080, mobile: false }, { width: 2560, height: 1304, mobile: false }];
    const before = new Map<number, Awaited<ReturnType<typeof lobbyMetrics>>>();
    try {
        const owner = await host.newPage(); await initHome(owner);
        await owner.locator('[data-game-id="tictactoe"] .platform-game-open').click();
        await owner.getByRole('button', { name: '创建房间', exact: true }).click();
        await owner.getByTestId('create-room-name-input').fill('容量常态房间');
        const creating = owner.waitForResponse(response => response.url().endsWith('/games/tictactoe/create') && response.request().method() === 'POST');
        await owner.getByTestId('create-room-confirm-button').click();
        const created = await creating; expect(created.ok()).toBe(true);
        const template = created.request().postDataJSON();
        await expect(owner.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 30_000 });

        const activeContext = await browser.newContext({ baseURL: info.project.use.baseURL,
            viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: await host.storageState() });
        try {
            const activePage = await activeContext.newPage();
            await activePage.goto('/');
            await expect(activePage.getByTestId('home-active-match-banner')).toBeVisible({ timeout: 30_000 });
            await activePage.locator('[data-game-id="tictactoe"] .platform-game-open').tap();
            const activeDetails = activePage.getByTestId('game-details-modal-root');
            await expect(activeDetails.getByTestId(/^room-list-item-/).first()).toBeVisible();
            const mine = activeDetails.locator('[data-room-ownership]').first();
            await expect(mine).toBeVisible();
            await expect(mine).toHaveCSS('white-space', 'nowrap');
            const badge = await mine.evaluate(element => {
                const range = document.createRange(); range.selectNodeContents(element);
                return { lines: range.getClientRects().length, width: element.getBoundingClientRect().width,
                    scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
            });
            expect(badge.lines).toBe(1);
            expect(badge.scrollWidth).toBeLessThanOrEqual(badge.clientWidth + 1);
            await capture(activePage, '手机-房主房间标签单行');
            await activeDetails.getByTestId('game-details-close-button').tap();
            await expect(activeDetails).toHaveCount(0);
            await activePage.locator('.platform-menu-trigger').tap();
            await expect(activePage.locator('.platform-menu-dialog')).toBeVisible();
            await activePage.locator('.platform-menu-close').tap();
            await expect(activePage.locator('.platform-menu-dialog')).toBeHidden();
        } finally { await activeContext.close(); }

        for (const pressure of [false, true]) {
            if (pressure) {
                // 通过真实建房API建立合法的独立访客房间，不注入DOM或伪造大厅响应。
                for (let index = 1; index <= 7; index++) {
                    const guestId = randomUUID();
                    const setup = template.setupData;
                    const response = await host.request.post(created.url(), { data: { ...template, playerName: `容量访客${index}`,
                        setupData: { ...setup, guestId, ownerKey: setup.ownerKey.replace(setup.guestId, guestId),
                            roomName: `容量压力房间${index}`, ttlSeconds: 86400 } } });
                    expect(response.ok()).toBe(true);
                }
            }
            for (const view of views) {
                const context = await browser.newContext({ baseURL: info.project.use.baseURL,
                    viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile });
                try {
                    const page = await context.newPage(); await initHome(page);
                    const open = page.locator('[data-game-id="tictactoe"] .platform-game-open');
                    if (view.mobile) await open.tap(); else await open.click();
                    const details = page.getByTestId('game-details-modal-root');
                    const rows = details.getByTestId(/^room-list-item-/);
                    await expect(rows).toHaveCount(pressure ? 8 : 1);
                    if (view.mobile) {
                        await details.getByTestId('game-details-close-button').tap();
                        await expect(details).toHaveCount(0);
                        await page.waitForTimeout(1200);
                        await expect(details).toHaveCount(0);
                        await open.tap();
                        await expect(rows).toHaveCount(pressure ? 8 : 1);
                    }
                    const metrics = await lobbyMetrics(page);
                    await record(`容量-${view.width}-${pressure ? '压力' : '常态'}`, metrics);
                    await capture(page, `容量-${view.width}-${pressure ? '压力' : '常态'}`);
                    if (!pressure) before.set(view.width, metrics);
                    if (view.mobile) {
                        // 来自上一正常压力图的抽屉尺寸；常态不能因只有一间房而缩成单行窗口。
                        expect.soft(metrics.drawer.height).toBeGreaterThanOrEqual(Math.min(640, view.height * .8) - 3);
                        if (pressure) expect.soft(metrics.fullRows).toBeGreaterThanOrEqual(view.width === 375 ? 3 : 2);
                    }
                    if (pressure) {
                        if (view.mobile) expect.soft(Math.abs(metrics.drawer.height - before.get(view.width)!.drawer.height)).toBeLessThanOrEqual(3);
                        else {
                            // PC 保持现有弹窗高度；1920 视口实际容纳四条完整房间，2560 可容纳五条。
                            expect.soft(metrics.drawer.height).toBeLessThanOrEqual(view.height - 48);
                            expect.soft(metrics.fullRows).toBeGreaterThanOrEqual(view.width === 1920 ? 4 : 5);
                        }
                        const last = rows.last();
                        if (view.mobile) {
                            const touch = await context.newCDPSession(page);
                            const box = metrics.roomWindow;
                            for (let swipe = 0; swipe < 12 && !(await last.evaluate(node => { const r = node.getBoundingClientRect(); const p = node.closest('.platform-details-scroll')!.getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom; })); swipe++) {
                                const x = box.x + box.width * .4;
                                const start = box.y + box.height * .85, end = box.y + box.height * .15;
                                const finger=(y:number)=>({id:1,x,y,radiusX:8,radiusY:8,force:1});
                                await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger(start)] });
                                for (let step = 1; step <= 18; step++) {
                                    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [finger(start + (end - start) * step / 18)] });
                                    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
                                }
                                for(let frame=0;frame<10;frame++){
                                    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(end)]});
                                    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
                                }
                                await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                            }
                        } else {
                            await page.mouse.move(metrics.roomWindow.x + metrics.roomWindow.width / 2, metrics.roomWindow.y + metrics.roomWindow.height / 2);
                            await page.mouse.wheel(0, 1500);
                        }
                        // 分数像素边框可能裁掉不足1%；操作本体仍须完整入镜并通过真实命中检查。
                        await expect(last).toBeInViewport({ ratio: .99 });
                        const join = last.getByRole('button', { name: '加入', exact: true });
                        await expect(join).toBeInViewport({ ratio: 1 });
                        expect(await join.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
                    }
                    if (view.mobile) await page.getByTestId('game-details-close-button').tap();
                    else await page.getByTestId('game-details-close-button').click();
                    await expect(details).toHaveCount(0);
                } finally { await context.close(); }
            }
        }
    } finally { await host.close(); }
});
