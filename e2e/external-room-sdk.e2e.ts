import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { strToU8, zipSync } from 'fflate';
import { storeWebGameZip } from '../apps/api/src/modules/ugc/external-web-game-host';
import { test, expect, initHome, login, capture, openPlatformProfile } from './helpers/homeAcceptance';

test('易桌游建密码房、游客验证密码、平台开局，SDK 将两人带入同局', async ({ browser, accounts }) => {
    const archive = process.env.EXTERNAL_WEB_ROOM_FIXTURE_ZIP;
    test.skip(!archive || !process.env.EXTERNAL_WEB_GAME_ROOT, '使用作者提供的新版 ZIP 和隔离托管目录');
    test.setTimeout(210_000);
    const db = await mongoose.createConnection(process.env.MONGO_URI!).asPromise();
    const records = db.collection('externalgamerecords');
    const submissions = db.collection('gamesubmissions');
    const submissionId = randomUUID();
    const gameId = 'external-' + randomUUID();
    const plainId = 'external-' + randomUUID();
    const hostContext = await browser.newContext({ viewport: { width: 1440, height: 940 } });
    const guestContext = await browser.newContext({ viewport: { width: 1440, height: 940 } });
    const inviteContext = await browser.newContext({ viewport: { width: 1440, height: 940 } });
    const roomPassword = 'vale-274';
    hostContext.setDefaultTimeout(15_000);
    guestContext.setDefaultTimeout(15_000);
    inviteContext.setDefaultTimeout(15_000);
    try {
        const entry = await storeWebGameZip(randomUUID(), await readFile(archive!));
        const plainEntry = await storeWebGameZip(randomUUID(), Buffer.from(zipSync({ 'index.html': strToU8('<title>单人网页</title>') })));
        const metadata = { webZipName: 'game.zip', minPlayers: 2, maxPlayers: 4, category: 'card', published: true,
            embedStatus: 'allowed', embedReason: '', author: '', description: '狩猎并驯服神话生灵。', rules: '', coverUrl: '',
            createdAt: new Date(), updatedAt: new Date() };
        await submissions.insertOne({ submissionId, ownerId: accounts.alice.id });
        await records.insertMany([{ ...metadata, gameId, submissionId, name: '永恒之谷', url: entry, coverUrl: new URL('assets/cards/0.jpg', entry).href },
            { ...metadata, gameId: plainId, name: '单人网页测试', url: plainEntry }]);
        const host = await hostContext.newPage();
        const guest = await guestContext.newPage();
        await initHome(host);
        await login(host, accounts.alice);

        await host.locator(`[data-game-id="${plainId}"] .platform-game-open`).click();
        const plain = host.getByRole('dialog', { name: '单人网页测试', exact: true });
        await expect(plain.getByTestId('external-game-play')).toBeVisible();
        await expect(plain.getByTestId('external-game-create-room')).toHaveCount(0);
        await plain.getByTestId('game-details-close-button').click();
        await host.locator(`[data-game-id="${gameId}"] .platform-game-open`).click();
        const details = host.getByRole('dialog', { name: '永恒之谷', exact: true });
        const actions = details.locator('.platform-details-actions button');
        await expect(actions.nth(0)).toHaveText('创建房间');
        await expect(actions.nth(1)).toHaveText('开始游戏');
        const create = details.getByTestId('external-game-create-room');
        await expect(create).toBeVisible();
        await expect(details.getByText('上传者', { exact: false })).toHaveCount(0);
        await capture(host, '房主01-平台游戏详情');
        await details.getByTestId('game-details-author-button-mobile').click();
        const author = host.getByTestId('game-details-author-modal');
        await expect(author).toContainText(`上传者：${accounts.alice.username}`);
        await capture(host, '作者信息-上传者只在作者弹窗');
        await author.getByRole('button', { name: '关闭', exact: true }).click();
        await create.click();
        const form = host.getByTestId('create-room-modal');
        await expect(form).toBeVisible();
        await form.getByTestId('create-room-name-input').fill('永恒之谷联机桌');
        await expect(form.getByText('游戏人数', { exact: true })).toHaveCount(0);
        await expect(form.getByRole('button', { name: /^\d+人$/ })).toHaveCount(0);
        await form.getByTestId('create-room-password-input').fill(roomPassword);
        await capture(host, '房主02-只有房间名称和平台密码');
        const createResponse = host.waitForResponse(response => response.url().endsWith('/ugc/external-rooms') && response.request().method() === 'POST');
        await form.getByTestId('create-room-confirm-button').click();
        const created = await createResponse;
        expect(created.ok()).toBeTruthy();
        expect(await created.text()).not.toContain(roomPassword);
        await expect(host).toHaveURL(new RegExp(`/external/${gameId}\\?room=[\\da-f-]+$`));
        await expect(host.frameLocator('.external-player iframe').locator('#screen-home.active')).toBeVisible();
        await capture(host, '房主03-在游戏里等待访客');

        await host.getByRole('button', { name: '房间', exact: true }).click();
        const start = host.getByRole('button', { name: '开始对局', exact: true });
        await expect(start).toBeDisabled();
        const roomStatus = host.getByTestId('fab-panel-external-room').getByRole('status');
        await expect(roomStatus).toContainText('1 / 2');
        const invite = await host.getByRole('textbox', { name: '邀请链接', exact: true }).inputValue();
        expect(invite).toBe(host.url());
        expect(invite).not.toContain(roomPassword);
        await inviteContext.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
        const invited = await inviteContext.newPage();
        await invited.goto(invite);
        const invitePassword = invited.getByTestId('room-password-modal');
        await expect(invitePassword).toBeVisible();
        await expect(invited.locator('.external-player iframe')).toHaveCount(0);
        const roomId = new URL(invite).searchParams.get('room');
        await invited.goto(`/external/rooms/${roomId}?join=1`);
        await expect(invited).toHaveURL(invite);
        await expect(invitePassword).toBeVisible();
        await capture(invited, '访客邀请链接也要求密码');
        await invitePassword.getByTestId('room-password-input').fill(roomPassword);
        await invitePassword.getByTestId('room-password-confirm').click();
        await expect(invited.frameLocator('.external-player iframe').locator('#screen-home.active')).toBeVisible();
        await invited.getByRole('button', { name: '房间', exact: true }).click();
        await invited.getByRole('button', { name: '离开', exact: true }).click();
        await invited.getByRole('button', { name: '返回大厅', exact: true }).click();
        await expect(invited).toHaveURL(/\?game=/);
        await expect(roomStatus).toContainText('1 / 2');

        await initHome(guest);
        await expect(guest.locator('.external-player iframe')).toHaveCount(0);
        await capture(guest, '访客00-来到易桌游发现页');
        await guest.locator(`[data-game-id="${gameId}"] .platform-game-open`).click();
        const guestDetails = guest.getByRole('dialog', { name: '永恒之谷', exact: true });
        const roomList = guestDetails.getByRole('region', { name: '房间', exact: true });
        await expect(roomList.getByText('永恒之谷联机桌', { exact: true })).toBeVisible();
        await expect(roomList.getByText(accounts.alice.username, { exact: false })).toBeVisible({ timeout: 20_000 });
        await capture(guest, '访客01-平台列表加入');
        await roomList.getByRole('button', { name: '加入', exact: true }).click();
        const passwordModal = guest.getByTestId('room-password-modal');
        await expect(passwordModal).toBeVisible();
        await expect(guestDetails).toBeVisible();
        await passwordModal.getByTestId('room-password-input').fill('wrong-pass');
        await passwordModal.getByTestId('room-password-confirm').click();
        await expect(passwordModal.getByRole('alert')).toHaveText('房间密码错误');
        await expect(guest.locator('.external-player iframe')).toHaveCount(0);
        await expect(roomStatus).toContainText('1 / 2');
        await capture(guest, '访客密码错误仍在平台列表');
        await passwordModal.getByTestId('room-password-input').fill(roomPassword);
        await passwordModal.getByTestId('room-password-confirm').click();
        await expect(guest).toHaveURL(invite);
        await expect(guest.getByTestId('auth-login-account-input')).toHaveCount(0);
        await expect(start).toBeEnabled({ timeout: 45_000 });
        await expect(guest.frameLocator('.external-player iframe').locator('#screen-home.active')).toBeVisible();
        await capture(guest, '访客02-在游戏里等待开局');
        await capture(host, '房主04-游戏画面中可开局');
        await start.click();
        const namesByPage: string[][] = [];
        for (const page of [guest, host]) {
            const frame = page.frameLocator('.external-player iframe');
            await expect(frame.locator('#screen-game.active')).toBeVisible({ timeout: 25_000 });
            const names = await frame.locator('html').evaluate(() => {
                const app = (window as unknown as { App: { game: { state: { players: { name: string }[] } } } }).App;
                return app.game.state.players.map(player => player.name);
            });
            namesByPage.push(names);
        }
        expect(namesByPage[0]).toEqual([accounts.alice.username, expect.stringMatching(/^游客[\da-f]{4}$/)]);
        expect(namesByPage[1]).toEqual(namesByPage[0]);
        await capture(guest, '访客03-从易桌游进入对局');
        await capture(host, '房主05-从易桌游进入同局');
    } finally {
        await Promise.allSettled([guestContext.close(), hostContext.close(), inviteContext.close()]);
        await records.deleteMany({ gameId: { $in: [gameId, plainId] } });
        await submissions.deleteOne({ submissionId });
        await db.close();
    }
});

test('投稿人在上传页删除已收录投稿，公开目录同步下架', async ({ browser, accounts }) => {
    test.skip(!process.env.EXTERNAL_WEB_GAME_ROOT, '使用隔离托管目录验证下架');
    const db = await mongoose.createConnection(process.env.MONGO_URI!).asPromise();
    const submissions = db.collection('gamesubmissions');
    const games = db.collection('externalgamerecords');
    const submissionId = randomUUID();
    const gameId = 'external-' + randomUUID();
    const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });
    try {
        const url = await storeWebGameZip(submissionId, Buffer.from(zipSync({ 'index.html': strToU8('<title>下架测试</title>') })));
        const game = { gameId, submissionId, name: '测试投稿 · 已上线', url, webZipName: '测试投稿.zip',
            category: 'card', published: true, createdAt: new Date(), updatedAt: new Date() };
        await games.insertOne(game);
        await submissions.insertOne({ ...game, ownerId: accounts.alice.id, status: 'approved' });
        const page = await context.newPage();
        await initHome(page);
        await login(page, accounts.alice);
        await openPlatformProfile(page);
        await page.getByRole('button', { name: '我的投稿', exact: true }).click();
        const row = page.locator('.creator-row').filter({ hasText: game.name });
        await expect(row.getByRole('button', { name: '删除投稿' })).toBeVisible();
        await row.getByRole('button', { name: '编辑投稿' }).click();
        const editor = page.locator('.platform-upload-form');
        await expect(editor.getByRole('heading', { name: game.name })).toBeVisible();
        const guide = editor.getByRole('link', { name: '下载房间 SDK 接入指南' });
        const guideResponse = await page.request.get((await guide.getAttribute('href'))!);
        expect(guideResponse.ok()).toBeTruthy();
        expect(await guideResponse.text()).toContain('window.BoardGameRoomSDK');
        const remove = editor.getByRole('button', { name: '删除投稿' });
        await expect(remove).toBeVisible();
        await capture(page, '投稿01-上传页删除入口和SDK指南');
        await remove.click();
        const dialog = page.locator('[data-platform-dialog="confirm"]');
        await expect(dialog).toContainText('从平台目录下架');
        await capture(page, '投稿02-删除已发布投稿确认');
        const deleted = page.waitForResponse(response => response.url().endsWith('/submissions/' + submissionId) && response.request().method() === 'DELETE');
        await dialog.getByRole('button', { name: '删除投稿', exact: true }).click();
        expect((await deleted).ok()).toBeTruthy();
        await expect(page.locator('.platform-upload-list').getByRole('button', { name: /测试投稿/ })).toHaveCount(0);
        await expect(editor.getByRole('button', { name: '删除投稿' })).toHaveCount(0);
        const published = await page.request.get('/ugc/external-games/' + gameId);
        expect(published.status()).toBe(404);
        expect((await page.request.get(url)).ok()).toBe(true);
        await capture(page, '投稿03-删除后投稿已移除');
    } finally {
        await context.close();
        await submissions.deleteOne({ submissionId });
        await games.deleteOne({ gameId });
        await db.close();
    }
});
