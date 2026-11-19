import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { storeWebGameZip } from '../apps/api/src/modules/ugc/external-web-game-host';
import { test, expect, initHome, login, capture, openPlatformProfile } from './helpers/homeAcceptance';

test('易桌游建房、游客加入、平台开局，SDK 将两人带入同局', async ({ browser, accounts }) => {
    const archive = process.env.EXTERNAL_WEB_ROOM_FIXTURE_ZIP;
    test.skip(!archive || !process.env.EXTERNAL_WEB_GAME_ROOT, '使用作者提供的新版 ZIP 和隔离托管目录');
    test.setTimeout(210_000);
    const db = await mongoose.createConnection(process.env.MONGO_URI!).asPromise();
    const records = db.collection('externalgamerecords');
    const gameId = 'external-' + randomUUID();
    const plainId = 'external-' + randomUUID();
    const hostContext = await browser.newContext({ viewport: { width: 1440, height: 940 } });
    const guestContext = await browser.newContext({ viewport: { width: 1440, height: 940 } });
    hostContext.setDefaultTimeout(15_000);
    guestContext.setDefaultTimeout(15_000);
    try {
        const zip = await readFile(archive!);
        const files = unzipSync(zip);
        files['index.html'] = strToU8(strFromU8(files['index.html']).replace('</head>', '<meta name="boardgame-room-sdk" content="1"></head>'));
        files['js/platform-room.js'] = strToU8(strFromU8(files['js/platform-room.js'])
            .replace(/import \{ createBoardGameRoomClient \} from '[^']+';/, 'const createBoardGameRoomClient = window.BoardGameRoomSDK?.createClient;')
            .replace('if (window.parent === window) return;', 'if (window.parent === window || !createBoardGameRoomClient) return;'));
        const entry = await storeWebGameZip(randomUUID(), process.env.EXTERNAL_WEB_ROOM_TEST_BUNDLED_SDK === 'true' ? zip : Buffer.from(zipSync(files)));
        const plainEntry = await storeWebGameZip(randomUUID(), Buffer.from(zipSync({ 'index.html': strToU8('<title>单人网页</title>') })));
        const metadata = { webZipName: 'game.zip', minPlayers: 2, maxPlayers: 4, category: 'card', published: true,
            embedStatus: 'allowed', embedReason: '', author: '', description: '狩猎并驯服神话生灵。', rules: '', coverUrl: '',
            createdAt: new Date(), updatedAt: new Date() };
        await records.insertMany([{ ...metadata, gameId, name: '永恒之谷', url: entry, coverUrl: new URL('assets/cards/0.jpg', entry).href },
            { ...metadata, gameId: plainId, name: '单人网页测试', url: plainEntry }]);
        const host = await hostContext.newPage();
        const guest = await guestContext.newPage();
        await Promise.all([initHome(host), initHome(guest)]);
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
        await capture(host, '房主01-平台游戏详情');
        await guest.locator(`[data-game-id="${gameId}"] .platform-game-open`).click();
        const guestDetails = guest.getByRole('dialog', { name: '永恒之谷', exact: true });
        const roomList = guestDetails.getByRole('region', { name: '房间', exact: true });
        await expect(roomList.getByText('暂无可加入的房间')).toBeVisible();
        await create.click();
        const form = host.getByRole('dialog', { name: '创建房间', exact: true });
        await expect(form).toBeVisible();
        await form.getByRole('combobox').selectOption('2');
        await capture(host, '房主02-易桌游建房');
        await form.locator('button[type=submit]').click();
        await expect(host).toHaveURL(/\/external\/rooms\/[\da-f-]+/);
        const start = host.getByRole('button', { name: '开始对局', exact: true });
        await expect(start).toBeDisabled();
        await capture(host, '房主03-平台房间等待访客');

        await expect(roomList.getByText(accounts.alice.username, { exact: false })).toBeVisible({ timeout: 20_000 });
        await capture(guest, '访客01-平台列表加入');
        await roomList.getByRole('link', { name: '加入房间', exact: true }).click();
        await expect(guest).toHaveURL(/\/external\/rooms\/[\da-f-]+/);
        await expect(guest.getByTestId('auth-login-account-input')).toHaveCount(0);
        await expect(start).toBeEnabled({ timeout: 45_000 });
        await expect(guest.locator('.external-room-seats')).toContainText('游客');
        await capture(guest, '访客02-易桌游房间两人就绪');
        await capture(host, '房主04-易桌游房间可开局');
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
        await Promise.allSettled([guestContext.close(), hostContext.close()]);
        await records.deleteMany({ gameId: { $in: [gameId, plainId] } });
        await db.close();
    }
});

test('投稿人在易桌游删除已收录投稿，公开目录同步下架', async ({ browser, accounts }) => {
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
        const remove = row.getByRole('button', { name: '删除投稿' });
        await expect(remove).toBeVisible();
        await capture(page, '投稿01-我的投稿删除入口');
        await remove.click();
        const dialog = page.locator('[data-platform-dialog="confirm"]');
        await expect(dialog).toContainText('从平台目录下架');
        await capture(page, '投稿02-删除已发布投稿确认');
        const deleted = page.waitForResponse(response => response.url().endsWith('/submissions/' + submissionId) && response.request().method() === 'DELETE');
        await dialog.getByRole('button', { name: '删除投稿', exact: true }).click();
        expect((await deleted).ok()).toBeTruthy();
        await expect(row).toHaveCount(0);
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
