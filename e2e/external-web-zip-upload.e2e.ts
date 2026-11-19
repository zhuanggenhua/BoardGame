import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import mongoose from 'mongoose';
import { unzipSync } from 'fflate';
import type { Page } from '@playwright/test';
import { test, expect, initHome, login, openPlatformProfile, capture } from './helpers/homeAcceptance';

const archivePath = process.env.EXTERNAL_WEB_GAME_FIXTURE_ZIP;
const gameName = '永恒之谷';

async function approve(page: Page) {
    await page.goto('/admin/creator-review');
    const submission = page.locator('.review-card').filter({ has: page.getByRole('heading', { name: gameName, exact: true }) });
    await submission.getByLabel('审核意见').fill('本地验证通过。');
    const response = page.waitForResponse(result => result.url().includes('/creator-review/submissions/') && result.request().method() === 'POST');
    await submission.getByRole('button', { name: '批准收录' }).click();
    const reviewed = await response;
    expect(reviewed.status(), await reviewed.text()).toBe(201);
    return await reviewed.json() as { gameId: string; url: string };
}

async function submit(page: Page) {
    const response = page.waitForResponse(result => /\/ugc\/submissions\/[^/]+\/submit$/.test(result.url()) && result.request().method() === 'POST');
    await page.getByRole('button', { name: '提交审核', exact: true }).click();
    const submitted = await response;
    expect(submitted.status(), await submitted.text()).toBe(201);
    await expect(page.getByText('审核期间资料已锁定。需要修改时可撤回投稿。')).toBeVisible();
}

test('永恒之谷原包投稿、审核、内嵌对局及不中断更新', async ({ browser, accounts }) => {
    test.skip(!archivePath || !process.env.EXTERNAL_WEB_GAME_ROOT, '需要提供本地原包和隔离托管目录');
    test.setTimeout(210_000);
    const archive = await readFile(archivePath!);
    const rawZip = unzipSync(archive, { filter: file => file.name.endsWith('/assets/cards/4.jpg') || file.name.endsWith('/js/data.js') });
    const cover = Object.entries(rawZip).find(([name]) => name.endsWith('.jpg'))![1];
    const originalScript = Object.entries(rawZip).find(([name]) => name.endsWith('.js'))![1];
    // ZIP 注释只改变包的版本标识，包内文件字节保持与原包一致。
    expect(archive.readUInt32LE(archive.length - 22)).toBe(0x06054b50);
    const comment = Buffer.from('web-zip-e2e-update');
    const replacement = Buffer.concat([archive, comment]);
    replacement.writeUInt16LE(comment.length, archive.length - 2);

    const authorContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const adminContext = await browser.newContext();
    authorContext.setDefaultTimeout(15_000);
    adminContext.setDefaultTimeout(15_000);
    const db = await mongoose.createConnection(process.env.MONGO_URI!).asPromise();
    try {
        await db.collection('users').updateOne({ email: accounts.bob.email }, { $set: { role: 'admin' } });
        const author = await authorContext.newPage();
        await initHome(author);
        await login(author, accounts.alice);
        await openPlatformProfile(author);
        await author.getByRole('button', { name: '我的投稿', exact: true }).click();
        await author.getByRole('button', { name: '＋ 投稿游戏' }).click();
        const linkType = author.getByRole('radio', { name: '游戏链接', exact: true });
        const zipType = author.getByRole('radio', { name: '网页 ZIP', exact: true });
        const linkInput = author.getByRole('textbox', { name: '游戏链接', exact: true });
        const zipInput = author.getByLabel('网页 ZIP', { exact: true }).and(author.locator('input[type=file]'));
        await expect(linkType).toBeVisible();
        await expect(zipType).toBeVisible();
        await expect(linkType).not.toBeChecked();
        await expect(zipType).not.toBeChecked();
        await expect(linkInput).toHaveCount(0);
        await expect(zipInput).toHaveCount(0);
        await capture(author, '00-新投稿先选择类型');
        await linkType.check();
        await expect(linkInput).toBeVisible();
        await expect(zipInput).toHaveCount(0);
        await capture(author, '00b-选择游戏链接显示网址输入框');
        await zipType.check();
        await expect(linkInput).toHaveCount(0);
        await author.getByLabel('游戏名称', { exact: true }).fill(gameName);
        await zipInput.setInputFiles(archivePath!);
        await author.getByLabel('介绍', { exact: true }).fill('狩猎奇幻生灵、管理魔法石并培育卡牌。原包提供人机对战、联机对战和新手教程。');
        await author.locator('.platform-upload-cover-section input[type=file]').setInputFiles({ name: 'cover.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(cover) });
        await expect(zipInput).toHaveValue(new RegExp(basename(archivePath!).replace('.', '\\.')));
        await capture(author, '01-外部游戏投稿选择原始ZIP');
        await submit(author);
        const editUrl = author.url();

        const admin = await adminContext.newPage();
        await initHome(admin);
        await login(admin, accounts.bob);
        const first = await approve(admin);
        const player = await authorContext.newPage();
        await player.goto(`/?game=${first.gameId}`);
        await player.getByRole('button', { name: '开始游戏', exact: true }).and(player.getByTestId('external-game-play')).click();
        const iframe = player.locator('.external-player iframe');
        const game = player.frameLocator('.external-player iframe');
        const sandboxed = new URL(first.url).pathname.startsWith('/ugc/web-game-packages/');
        const entryAttribute = sandboxed ? 'data-entry-url' : 'src';
        await expect(iframe).toHaveAttribute(entryAttribute, first.url);
        await expect(game.locator('#screen-home.active')).toBeVisible({ timeout: 20_000 });
        if (sandboxed) {
            expect(await game.locator('html').evaluate(() => {
                try { void window.parent.document.body; return false; } catch { return true; }
            })).toBe(true);
            const raw = await authorContext.newPage();
            const rawResponse = await raw.goto(new URL(first.url).pathname);
            expect(rawResponse?.headers()['content-security-policy']).toContain('sandbox allow-scripts allow-forms');
            expect(await raw.evaluate(() => {
                try { void document.cookie; return false; } catch { return true; }
            })).toBe(true);
            await raw.close();
        }
        await game.locator('#btn-play').click();
        await game.getByRole('button', { name: '进入山谷', exact: true }).click();
        await expect(game.locator('#screen-game.active')).toBeVisible();
        await expect.poll(() => game.locator('html').evaluate(() => Boolean(localStorage.getItem('ve_save_v1')))).toBe(true);
        await capture(player, '02-永恒之谷网页内嵌对局');
        const initialFrame = await iframe.contentFrame().locator('html').evaluate(() => performance.timeOrigin);

        await author.goto(editUrl);
        await expect(zipType).toBeChecked();
        await expect(author.getByText(basename(archivePath!), { exact: true })).toBeVisible();
        await zipInput.setInputFiles({ name: '永恒之谷-更新测试.zip', mimeType: 'application/zip', buffer: replacement });
        await submit(author);
        const publicDetail = (url: string) => new URL(url).pathname.endsWith(`/ugc/external-games/${first.gameId}`);
        const before = player.waitForResponse(result => publicDetail(result.url()) && result.request().method() === 'GET');
        await player.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
        expect((await (await before).json()).url).toBe(first.url);

        const updated = await approve(admin);
        expect(updated.gameId).toBe(first.gameId);
        expect(updated.url).not.toBe(first.url);
        expect(new URL(updated.url).origin).toBe(new URL(first.url).origin);
        const refreshed = player.waitForResponse(result => publicDetail(result.url()) && result.request().method() === 'GET');
        await player.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
        expect((await (await refreshed).json()).url).toBe(updated.url);
        await expect(iframe).toHaveAttribute(entryAttribute, first.url);
        expect(await game.locator('html').evaluate(() => performance.timeOrigin)).toBe(initialFrame);
        await expect(game.locator('#screen-game.active')).toBeVisible();
        await game.locator('#btn-rules').click();
        await expect(game.locator('.modal-backdrop').last()).toBeVisible();
        await capture(player, '03-更新审核后旧对局仍可操作');
        const oldAsset = await game.locator('html').evaluate(async () => {
            const response = await fetch('js/data.js', { cache: 'reload' });
            return { status: response.status, bytes: Array.from(new Uint8Array(await response.arrayBuffer())) };
        });
        expect(oldAsset.status).toBe(200);
        expect(Buffer.from(oldAsset.bytes).equals(Buffer.from(originalScript))).toBe(true);

        const fresh = await authorContext.newPage();
        await fresh.goto(`/?game=${first.gameId}`);
        await fresh.getByRole('button', { name: '开始游戏', exact: true }).and(fresh.getByTestId('external-game-play')).click();
        await expect(fresh.locator('.external-player iframe')).toHaveAttribute(entryAttribute, updated.url);
        await expect(fresh.frameLocator('.external-player iframe').locator('#btn-resume')).toBeVisible({ timeout: 20_000 });
        await capture(fresh, '04-新进玩家使用新版并可继续存档');
    } finally {
        await db.close();
        await Promise.allSettled([authorContext.close(), adminContext.close()]);
    }
});
