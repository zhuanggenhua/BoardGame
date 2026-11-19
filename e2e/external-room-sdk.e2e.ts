import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { strToU8, zipSync } from 'fflate';
import { storeWebGameZip } from '../apps/api/src/modules/ugc/external-web-game-host';
import { test, expect, initHome, login, capture } from './helpers/homeAcceptance';

test('托管 ZIP 自动识别房间 SDK，房主从详情页开局且客席直接进入原游戏', async ({ browser, accounts }) => {
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
        await Promise.all([login(host, accounts.alice), login(guest, accounts.bob)]);

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
        await capture(host, '外部房间01-详情页创建房间');
        await create.click();
        const dialog = host.getByRole('dialog', { name: '创建房间', exact: true });
        await dialog.getByLabel('游戏人数').selectOption('2');
        await dialog.getByRole('button', { name: /创建/ }).click();
        await expect(host).toHaveURL(/\/external\/rooms\/[\da-f-]+/);
        const start = host.getByRole('button', { name: '开始对局', exact: true });
        await expect(start).toBeDisabled();

        await guest.goto(host.url());
        await guest.getByRole('button', { name: '加入房间', exact: true }).click();
        await expect(guest.getByText(accounts.alice.username, { exact: false })).toBeVisible();
        await expect(start).toBeEnabled({ timeout: 45_000 });
        await expect(guest.getByRole('button', { name: '开始对局', exact: true })).toHaveCount(0);
        await capture(host, '外部房间02-房间已连接');
        await start.click();
        for (const page of [guest, host]) {
            const frame = page.frameLocator('.external-player iframe');
            await expect(frame.locator('#screen-game.active')).toBeVisible({ timeout: 25_000 });
            const names = await frame.locator('html').evaluate(() => {
                const app = (window as unknown as { App: { game: { state: { players: { name: string }[] } } } }).App;
                return app.game.state.players.map(player => player.name);
            });
            expect(names).toEqual([accounts.alice.username, accounts.bob.username]);
        }
        await capture(guest, '外部房间03-客席自动进入对局');
    } finally {
        await Promise.allSettled([guestContext.close(), hostContext.close()]);
        await records.deleteMany({ gameId: { $in: [gameId, plainId] } });
        await db.close();
    }
});
