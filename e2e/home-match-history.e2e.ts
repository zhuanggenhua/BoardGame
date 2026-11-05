import { test, expect, initHome, login, openGame, capture, record } from './helpers/homeAcceptance';

for (const mobile of [false, true]) test(`${mobile?'手机':'桌面'}对局记录来自实际完成对局、账户隔离并可从加载失败重试`,async({browser,accounts},info)=>{
    info.setTimeout(100_000);
    const options={baseURL:info.project.use.baseURL,viewport:mobile?{width:375,height:812}:{width:1920,height:1080},hasTouch:mobile,isMobile:mobile};
    const host=await browser.newContext(options), guest=await browser.newContext(options), outsider=await browser.newContext(options);
    try {
        const page=await host.newPage();await initHome(page);await login(page,accounts.alice);
        await openGame(page,'modern','tictactoe','井字棋',mobile);
        await page.getByRole('button',{name:'创建房间',exact:true}).click();
        await page.getByTestId('create-room-name-input').fill('真实历史验收');
        const creating=page.waitForResponse(r=>r.url().endsWith('/games/tictactoe/create')&&r.request().method()==='POST');
        await page.getByTestId('create-room-confirm-button').click();
        const created=await creating;expect(created.ok()).toBe(true);const {matchID}=await created.json();
        const second=await guest.newPage();await initHome(second);await openGame(second,'modern','tictactoe','井字棋',mobile);
        await second.getByTestId(`room-list-join-${matchID}`).click();
        await expect(second).toHaveURL(/playerID=1/);
        for(const [target,index]of [[page,0],[second,3],[page,1],[second,4],[page,2]] as const){
            const cell=target.locator(`[data-tutorial-id="cell-${index}"]`);
            if(mobile)await cell.tap();else await cell.click();
            await expect(page.locator(`[data-tutorial-id="cell-${index}"] svg`)).toBeVisible();
            await expect(second.locator(`[data-tutorial-id="cell-${index}"] svg`)).toBeVisible();
        }
        await page.goto('/');
        // 正式销毁已结束房间，保留归档记录，也释放同账户的唯一房间约束。
        await page.getByTestId('home-active-match-leave').click();
        await page.locator('[data-platform-dialog="confirm"]').getByRole('button',{name:'确定',exact:true}).click();
        await expect(page.getByTestId('home-active-match-banner')).toHaveCount(0);
        await page.getByTestId('user-menu-trigger').click();
        const response=page.waitForResponse(r=>r.url().endsWith('/auth/profile/matches')&&r.request().method()==='GET');
        await page.getByTestId('user-menu-profile').click();
        await expect(page.getByTestId('profile-page')).toBeVisible();
        const loaded=await response;expect(loaded.ok()).toBe(true);
        const rows=page.locator(`[data-testid="match-history-row"][data-match-id="${matchID}"]`);
        await expect(rows).toHaveCount(1);await expect(rows).toContainText('井字棋');await expect(rows).toContainText('胜利');
        const data=await loaded.json();expect(data.find((entry:{id:string})=>entry.id===matchID)?.result).toBe('win');
        expect(JSON.stringify(data)).not.toMatch(/ownerKey|credentials|actionLog/);
        await capture(page,`${mobile?'手机':'桌面'}-真实对局记录`);
        await page.getByRole('navigation',{name:'菜单'}).getByRole('button',{name:'发现',exact:true}).click();
        await page.route('**/auth/profile/matches',route=>route.fulfill({status:503,body:'unavailable'}));
        await page.getByTestId('user-menu-trigger').click();
        const failed=page.waitForResponse(r=>r.url().endsWith('/auth/profile/matches')&&r.request().method()==='GET'&&r.status()===503);
        await page.getByTestId('user-menu-profile').click();
        expect((await failed).status()).toBe(503);
        await expect(page.getByTestId('profile-page')).toBeVisible();
        await expect(page.getByRole('alert')).toContainText('对局记录加载失败',{timeout:15_000});
        await capture(page,`${mobile?'手机':'桌面'}-对局记录加载错误`);
        await page.unroute('**/auth/profile/matches');
        const retried=page.waitForResponse(r=>r.url().endsWith('/auth/profile/matches')&&r.request().method()==='GET'&&r.ok());
        await page.getByRole('button',{name:'重试',exact:true}).click();
        expect((await retried).ok()).toBe(true);
        await expect(rows).toHaveCount(1);
        const anonymous=await guest.request.get(loaded.url());expect(anonymous.status()).toBe(401);
        // 游客对局可在登录时合法归属到账户，隔离断言使用没有参赛的独立浏览器身份。
        const third=await outsider.newPage();await initHome(third);await login(third,accounts.bob);await third.getByTestId('user-menu-trigger').click();
        await third.getByTestId('user-menu-profile').click();
        await expect(third.getByText('暂无对局记录',{exact:true})).toBeVisible();
        await expect(third.getByTestId('match-history-row')).toHaveCount(0);
        await record(`${mobile?'手机':'桌面'}-真实记录与隔离`,{matchID,realFiveMoves:true,winner:'0',ownerResult:'win',otherAccountRows:0,anonymousStatus:401,retryRecovered:true});
        const otherTab=await host.newPage();await otherTab.goto('/');
        await otherTab.getByTestId('user-menu-trigger').click();
        await otherTab.locator('[data-user-menu-panel] > button').last().click();
        await expect(page.getByTestId('profile-page')).toHaveCount(0);
        await expect(page.locator('.platform-profile-login')).toBeVisible();
        expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
        await login(page,accounts.alice);
        await page.getByTestId('user-menu-trigger').click();await page.getByTestId('user-menu-account-settings').click();
        await page.getByTestId('account-settings-open-email').click();
        await expect(page.getByTestId('email-bind-modal')).toBeVisible();
        await otherTab.getByTestId('user-menu-trigger').click();
        await otherTab.locator('[data-user-menu-panel] > button').last().click();
        await expect(page.getByTestId('email-bind-modal')).toHaveCount(0);
        await expect(page.getByTestId('account-settings-modal')).toHaveCount(0);
        expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
        await record(`${mobile?'手机':'桌面'}-跨标签退出清理`,{profileCleared:true,accountClosed:true,nestedEmailClosed:true,scrollLockReleased:true});
    }finally{await host.close();await guest.close();await outsider.close();}
});
