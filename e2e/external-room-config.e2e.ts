import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { zipSync } from 'fflate';
import { storeWebGameZip } from '../apps/api/src/modules/ugc/external-web-game-host';
import { test, expect, initHome, capture } from './helpers/homeAcceptance';

const examplePath = '/developers/examples/external-room-v1';

test('SDK 声明决定建房配置，双方进入使用同一配置的游戏', async ({ browser }) => {
    test.skip(!process.env.EXTERNAL_WEB_GAME_ROOT, '使用隔离托管目录验证 SDK 配置');
    test.setTimeout(150_000);
    const db = await mongoose.createConnection(process.env.MONGO_URI!).asPromise();
    const games = db.collection('externalgamerecords');
    const gameId = 'external-' + randomUUID();
    const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 1440, height: 940 } })));
    try {
        const [host, guest] = await Promise.all(contexts.map(context => context.newPage()));
        await host.goto('/developers/external-room-sdk');
        const files = await Promise.all(['index.html', 'boardgame-room.json'].map(async name => {
            const link = host.getByRole('link', { name, exact: true });
            await expect(link).toBeVisible();
            const href = await link.evaluate((element: HTMLAnchorElement) => element.href);
            expect(new URL(href).pathname).toBe(`${examplePath}/${name}`);
            const response = await host.request.get(href);
            expect(response.ok()).toBe(true);
            const contents = await response.body();
            expect(contents.equals(await readFile(`public${examplePath}/${name}`))).toBe(true);
            return [name, contents] as const;
        }));
        const url = await storeWebGameZip(randomUUID(), Buffer.from(zipSync(Object.fromEntries(files))));
        await games.insertOne({ gameId, name: '房间 SDK 示例', url, webZipName: 'sdk-example.zip', minPlayers: 2, maxPlayers: 3,
            category: 'abstract', published: true, embedStatus: 'allowed', createdAt: new Date(), updatedAt: new Date() });
        const card = `[data-game-id="${gameId}"] .platform-game-open`;
        await initHome(host);
        await host.locator(card).click();
        await expect(host.getByTestId('game-details-player-recommendation').locator('span')).toHaveText(['2', '4']);
        await host.getByTestId('external-game-create-room').click();
        const form = host.getByTestId('create-room-modal');
        await expect(form.getByRole('button', { name: /^\d+人$/ })).toHaveText(['2人', '4人']);
        await form.getByTestId('create-room-name-input').fill('棋盘配置验收');
        await form.getByRole('combobox', { name: '棋盘尺寸' }).selectOption('expanded');
        await capture(host, '配置01-开发者声明的棋盘尺寸');
        const headers = { 'X-External-Room-Guest': randomUUID().replaceAll('-', '').repeat(2) };
        const invalid = await host.request.post('/ugc/external-rooms', { headers,
            data: { gameId, expectedEntry: url, capacity: 2, settings: { board: 'forged' } } });
        expect(invalid.status()).toBe(400);
        await form.getByTestId('create-room-confirm-button').click();
        await expect(host).toHaveURL(new RegExp(`/external/${gameId}\\?room=[\\da-f-]+$`));
        const hostGame = host.frameLocator('.external-player iframe');
        await expect(hostGame.locator('#status')).toHaveText('等待开局 · 1/2');
        await expect(hostGame.locator('#board > span')).toHaveCount(25);
        const sdkRelease = await hostGame.locator('html').evaluate(() =>
            (window as Window & { BoardGameRoomSDK?: { release?: string } }).BoardGameRoomSDK?.release);
        expect(sdkRelease).toMatch(/^1\.\d+\.\d+$/);
        await expect(hostGame.locator('#sdk-release')).toHaveText(`SDK ${sdkRelease}`);
        const guide = await host.request.get('/developers/external-room-sdk.md');
        expect(guide.ok()).toBe(true);
        expect((await guide.text()).match(/^#### (\d+\.\d+\.\d+)$/m)?.[1]).toBe(sdkRelease);
        await expect(host.locator('.external-room-controls, .external-room-panel')).toHaveCount(0);
        await capture(host, '配置02-游戏应用配置并等待');
        const gameRoomUrl = host.url();

        await initHome(guest);
        await expect(guest.locator('iframe[data-entry-url]')).toHaveCount(0);
        await guest.locator(card).click();
        const rooms = guest.getByRole('region', { name: '房间', exact: true });
        await expect(rooms.getByText('棋盘配置验收', { exact: true })).toBeVisible();
        await expect(rooms.getByRole('button', { name: '加入', exact: true })).toBeVisible();
        await capture(guest, '配置03-访客在平台查看房间');
        await rooms.getByRole('button', { name: '加入', exact: true }).click();
        await expect(guest).toHaveURL(gameRoomUrl);
        const guestGame = guest.frameLocator('.external-player iframe');
        await expect(guestGame.locator('#board > span')).toHaveCount(25);
        await expect(guestGame.locator('#status')).toHaveText('等待开局 · 2/2');
        await expect(hostGame.locator('#status')).toHaveText('等待开局 · 2/2');
        await expect(guestGame.locator('#room-id')).toHaveText(await hostGame.locator('#room-id').innerText());
        await capture(guest, '配置04-访客点击加入后进入游戏');
        await host.getByRole('button', { name: '房间', exact: true }).click();
        const start = host.getByRole('button', { name: '开始对局', exact: true });
        await expect(start).toBeDisabled();
        await expect(host.getByRole('textbox', { name: '邀请链接' })).toHaveValue(gameRoomUrl);

        await hostGame.getByRole('button', { name: '准备', exact: true }).click();
        await expect(hostGame.getByRole('button', { name: '取消准备', exact: true })).toBeVisible();
        await expect(start).toBeDisabled();
        await guestGame.getByRole('button', { name: '准备', exact: true }).click();
        await expect(start).toBeEnabled();
        await start.click();
        await expect(hostGame.locator('#status')).toHaveText('对局已开始');
        await expect(guestGame.locator('#status')).toHaveText('对局已开始');
        await expect(host).toHaveURL(gameRoomUrl);
        await expect(start).toHaveCount(0);
        await capture(host, '配置05-房主开局');
        await capture(guest, '配置06-访客进入同一对局');
    } finally {
        await Promise.allSettled(contexts.map(context => context.close()));
        await games.deleteOne({ gameId });
        await db.close();
    }
});
