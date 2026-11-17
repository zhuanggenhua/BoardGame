import { randomUUID } from 'node:crypto';
import { test, expect, initHome, switchStyle, openGame, capture, record } from './helpers/homeAcceptance';

for (const mobile of [false, true]) for (const style of ['modern', 'classic'] as const) {
    const label = `${mobile ? '手机' : '桌面'}-${style === 'modern' ? '现代' : '经典'}`;
    test(`${label}正式首页建房、第二上下文加入、离线后刷新恢复同一座位`, async ({ browser }, info) => {
        info.setTimeout(90_000);
        const options = { baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, hasTouch: mobile, isMobile: mobile };
        const host = await browser.newContext(options);
        const guest = await browser.newContext(options);
        try {
            const page = await host.newPage();
            await initHome(page);
            if (style === 'classic') await switchStyle(page, style);
            const homeFab = page.getByTestId('fab-menu');
            await expect.poll(() => homeFab.evaluate(node => node.style.top)).not.toBe('0px');
            const homeFabAnchor = await homeFab.evaluate(node => ({left:node.style.left,top:node.style.top}));
            await openGame(page, style, 'tictactoe', '井字棋', mobile);
            await page.getByRole('button', { name: '创建房间', exact: true }).click();
            await page.getByTestId('create-room-name-input').fill(`首页验收-${style}`);
            await capture(page, `${label}-建房弹层`);
            const create = page.waitForResponse(r => r.url().endsWith('/games/tictactoe/create') && r.request().method() === 'POST');
            await page.getByTestId('create-room-confirm-button').click();
            const created = await create; expect(created.ok()).toBe(true);
            const { matchID } = await created.json(); expect(matchID).toBeTruthy();
            await expect(page.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 30_000 });
            const second = await guest.newPage(); await initHome(second);
            if (style === 'classic') await switchStyle(second, style);
            await openGame(second, style, 'tictactoe', '井字棋', mobile);
            await expect(second.getByTestId(`room-list-join-${matchID}`)).toBeVisible({ timeout: 15_000 });
            await second.getByTestId(`room-list-join-${matchID}`).click();
            await expect(second).toHaveURL(/playerID=1/);
            await expect(second.locator('[data-tutorial-id="cell-0"]')).toBeVisible();
            if (mobile) await page.locator('[data-tutorial-id="cell-0"]').tap();
            else await page.locator('[data-tutorial-id="cell-0"]').click();
            await expect(page.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible();
            await expect(second.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible();
            const guestUrl = second.url();
            await guest.setOffline(true);
            await expect.poll(() => second.evaluate(() => navigator.onLine)).toBe(false);
            // 离线时刷新真实页面，确保旧 socket 和内存状态都不参与恢复。
            await second.reload({ timeout: 5_000 }).catch(error => { expect(String(error)).toMatch(/ERR_INTERNET_DISCONNECTED|ERR_FAILED|Timeout/); });
            await guest.setOffline(false);
            await second.goto(guestUrl);
            await expect(second.locator('[data-tutorial-id="cell-0"] svg')).toBeVisible({ timeout: 30_000 });
            await expect(second).toHaveURL(/playerID=1/);
            if (mobile) await second.locator('[data-tutorial-id="cell-1"]').tap();
            else await second.locator('[data-tutorial-id="cell-1"]').click();
            await expect(page.locator('[data-tutorial-id="cell-1"] svg')).toBeVisible();
            // 回首页只能通过正式入口恢复已有房间，验证首页重连操作。
            await page.goto('/');
            await expect(page.getByTestId('home-active-match-banner')).toBeVisible();
            if (mobile && style === 'modern') {
                await page.locator('[data-game-id="tictactoe"] .platform-game-open').tap();
                const runningDetails = page.getByTestId('game-details-modal-root');
                await expect(runningDetails.getByTestId(`room-list-item-${matchID}`)).toBeVisible();
                const template = created.request().postDataJSON();
                const guestId = randomUUID();
                const refreshRoom = await host.request.post(created.url(), { data: { ...template,
                    playerName: '列表刷新访客', setupData: { ...template.setupData, guestId,
                        ownerKey: template.setupData.ownerKey.replace(template.setupData.guestId, guestId), roomName: '实时更新房间' } } });
                expect(refreshRoom.ok()).toBe(true);
                const refreshed = await refreshRoom.json();
                await expect(runningDetails.getByTestId(`room-list-item-${refreshed.matchID}`)).toBeVisible();
                await runningDetails.getByTestId('game-details-close-button').tap();
                await expect(runningDetails).toHaveCount(0);
                await page.waitForTimeout(1200);
                await expect(runningDetails).toHaveCount(0);
            }
            await expect(homeFab).toBeVisible();
            await expect.poll(() => homeFab.evaluate(node => ({left:node.style.left,top:node.style.top}))).toEqual(homeFabAnchor);
            if (mobile) {
                if (style === 'modern') {
                    const direction=await page.getByTestId('home-active-match-card').evaluate(node=>getComputedStyle(node).flexDirection);
                    expect(direction).toBe('row');
                }
                const sizes = await page.getByTestId('home-active-match-actions').getByRole('button').evaluateAll(buttons => buttons.map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
                expect(sizes.length).toBe(2);
                for (const size of sizes) { expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44); }
            }
            await capture(page, `${label}-首页已有房间`);
            // 用户允许跨层覆盖；球挡住目标时按真实玩家路径拖开球，不改变产品布局或强点。
            const reconnect=page.getByRole('button', { name: '重连进入', exact: true });
            const coveredByFab=await reconnect.evaluate(node=>{
                const r=node.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                return Boolean(top?.closest('[data-testid="fab-menu"]'));
            });
            if(mobile && coveredByFab){
                const ball=(await homeFab.locator('button').first().boundingBox())!;
                const start={x:ball.x+ball.width/2,y:ball.y+ball.height/2};
                const touch=await host.newCDPSession(page);
                await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1,radiusX:8,radiusY:8,force:1}]});
                for(let i=1;i<=12;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:start.x+(68-start.x)*i/12,y:start.y+(270-start.y)*i/12,radiusX:8,radiusY:8,force:1}]});
                await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            }
            await page.getByRole('button', { name: '重连进入', exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`/match/${matchID}`));
            await expect(page.locator('[data-tutorial-id="cell-1"] svg')).toBeVisible();
            await record(`${label}-房间`, { createStatus: created.status(), matchID, secondContextJoined: true, hostMoveSynced: true, offlineReloadRecoveredSeat: '1', recoveredMoveSynced: true, homeReconnect: true });
        } finally { await host.close(); await guest.close(); }
    });
}

for (const entry of ['网页', '安卓地址恢复', '游戏内暂时离开'] as const) test(`手机命运支配已有本人房间时详情可以关闭-${entry}`, async ({ browser }, info) => {
    info.setTimeout(90_000);
    const nativeAndroid = entry === '安卓地址恢复';
    const context = await browser.newContext({ baseURL: info.project.use.baseURL,
        viewport: { width: 360, height: 796 }, hasTouch: true, isMobile: true });
    try {
        if (nativeAndroid) await context.addInitScript(() => {
            (window as typeof window & { __BG_E2E_NATIVE_ANDROID_RUNTIME__: boolean }).__BG_E2E_NATIVE_ANDROID_RUNTIME__ = true;
        });
        const page = await context.newPage();
        await initHome(page);
        await page.locator('[data-game-id="fate-domination"] .platform-game-open').tap();
        await page.getByTestId('game-details-open-create-room').tap();
        const createDialog = page.getByTestId('create-room-modal').last();
        await createDialog.getByRole('button', { name: '3人', exact: true }).tap();
        const response = page.waitForResponse(r => r.url().endsWith('/games/fate-domination/create') && r.request().method() === 'POST');
        await createDialog.getByTestId('create-room-confirm-button').tap();
        const created = await response;
        expect(created.ok()).toBe(true);
        const { matchID } = await created.json();
        await page.waitForURL(/\/play\/fate-domination\/match\//);
        if (entry === '游戏内暂时离开') {
            await expect(page.getByTestId('fab-menu')).toBeVisible({ timeout: 45_000 });
            await page.getByTestId('fab-menu').locator('button[data-fab-id]').first().tap();
            await page.getByRole('button', { name: '离开', exact: true }).tap();
            await page.getByTestId('fab-panel-exit').getByRole('button', { name: /暂时离开/ }).tap();
            await expect(page).toHaveURL(/\/$/);
        } else {
            await page.goto(nativeAndroid ? '/?game=fate-domination' : '/');
        }
        await expect(page.getByTestId('home-active-match-banner')).toBeVisible();
        if (entry !== '安卓地址恢复') await page.locator('[data-game-id="fate-domination"] .platform-game-open').tap();
        const details = page.getByTestId('game-details-modal-root');
        await expect(details.getByTestId(`room-list-item-${matchID}`)).toBeVisible();
        await expect(details.locator('[data-room-ownership]')).toBeVisible();
        const ownedRoom = details.getByTestId(`room-list-item-${matchID}`);
        await expect(ownedRoom.locator('[data-room-count]')).toHaveText(' (1/3)');
        const countFits = await ownedRoom.locator('[data-room-count]').evaluate(node => {
            const count = node.getBoundingClientRect();
            const title = node.parentElement!.getBoundingClientRect();
            return count.left >= title.left && count.right <= title.right + 1;
        });
        expect(countFits).toBe(true);
        if (entry === '游戏内暂时离开') await capture(page, '手机-对局返回后的房间列表');
        await details.getByTestId('game-details-close-button').tap();
        await expect(details).toHaveCount(0);
        await expect(page).not.toHaveURL(/[?&]game=/);
        await page.waitForTimeout(1500);
        await expect(details).toHaveCount(0);
        if (entry === '游戏内暂时离开') await capture(page, '手机-关闭房间列表后');
        await page.locator('[data-game-id="fate-domination"] .platform-game-open').tap();
        await expect(details.getByTestId(`room-list-item-${matchID}`)).toBeVisible();
        await details.getByTestId('game-details-close-button').tap();
        await expect(details).toHaveCount(0);
    } finally { await context.close(); }
});
