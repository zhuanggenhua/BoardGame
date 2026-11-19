import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { strToU8, zipSync } from 'fflate';
import { storeWebGameZip } from '../apps/api/src/modules/ugc/external-web-game-host';
import { test, expect, initHome, login, capture } from './helpers/homeAcceptance';

test('原游戏内建房，易桌游公开房间，游客点击加入并跟随原版开局', async ({ browser, accounts }) => {
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
        const entry = await storeWebGameZip(randomUUID(), await readFile(archive!));
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
        await guest.locator(`[data-game-id="${gameId}"] .platform-game-open`).click();
        const guestDetails = guest.getByRole('dialog', { name: '永恒之谷', exact: true });
        const roomList = guestDetails.getByRole('region', { name: '房间', exact: true });
        await expect(roomList.getByText('暂无可加入的房间')).toBeVisible();
        await create.click();
        const hostGame = host.frameLocator('.external-player iframe');
        await expect(hostGame.locator('#oh-name')).toBeVisible();
        await capture(host, '原游戏房间01-原版创建房间');
        await hostGame.locator('#oh-name').fill('测试房主');
        await hostGame.locator('#oh-total [data-n="2"]').click();
        await hostGame.locator('#oh-create').click();
        const start = hostGame.locator('#oh-start');
        await expect(start).toBeDisabled();

        await expect(roomList.getByText('测试房主的房间', { exact: false })).toBeVisible({ timeout: 20_000 });
        await capture(guest, '原游戏房间02-游客可以直接加入');
        await roomList.getByRole('link', { name: '加入房间', exact: true }).click();
        await expect(guest).toHaveURL(/\/external\/native-room\/[\da-f-]+/);
        await expect(guest.getByTestId('auth-login-account-input')).toHaveCount(0);
        await expect(start).toBeEnabled({ timeout: 45_000 });
        await expect(hostGame.locator('.net-slot.connected')).toContainText('游客');
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
        expect(namesByPage[0]).toEqual(['测试房主', expect.stringMatching(/^游客[\da-f]{4}$/)]);
        expect(namesByPage[1]).toEqual(namesByPage[0]);
        await capture(guest, '原游戏房间03-游客进入棋盘');
    } finally {
        await Promise.allSettled([guestContext.close(), hostContext.close()]);
        await records.deleteMany({ gameId: { $in: [gameId, plainId] } });
        await db.close();
    }
});
