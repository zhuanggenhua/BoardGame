import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { gunzipSync } from 'node:zlib';
import { setChineseLocale } from '../helpers/common';
import { cleanupDTMatch, dispatchDiceThroneCommand, readDiceThroneHarnessState, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';
import { injectMatchState } from '../helpers/state-injection';

test('在线双人反馈保存服务器权威现场且公开接口不泄漏', async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const uri = process.env.FEEDBACK_CAPTURE_E2E_MONGO_URI;
    if (!uri || uri !== process.env.MONGO_URI || !uri.includes('/feedback_capture_e2e')) throw new Error('必须使用本轮隔离测试数据库');
    const db = await mongoose.createConnection(uri).asPromise();
    const match = await setupOnlineMatch(browser, baseURL, { skipImageGate: true, characterSelectionTimeout: 180_000 });
    if (!match) throw new Error('在线双人房间创建失败');
    try {
        await setChineseLocale(match.hostContext);
        await selectCharacter(match.hostPage, 'zhanshujia');
        await selectCharacter(match.guestPage, 'cursed_pirate');
        await readyAndStartGame(match.hostPage, match.guestPage);
        await Promise.all([waitForGameBoard(match.hostPage), waitForGameBoard(match.guestPage)]);
        const page = match.hostPage;
        await page.getByTestId('fab-menu').locator('button').first().click();
        await page.locator('[data-fab-id="feedback"]').click();
        const modal = page.getByTestId('feedback-modal');
        await expect(modal).toBeVisible();
        await modal.getByPlaceholder(/请描述问题或建议/).fill('在线权威现场采集测试');
        const before = await readDiceThroneHarnessState<{ sys: { phase: string } }>(page);
        let releasePost!: () => void;
        let postReached!: () => void;
        const postPaused = new Promise<void>(resolve => { postReached = resolve; });
        const postRelease = new Promise<void>(resolve => { releasePost = resolve; });
        await page.route('**/feedback', async route => {
            if (route.request().method() !== 'POST') return route.continue();
            postReached();
            await postRelease;
            await route.continue();
        });
        const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname === '/feedback' && r.request().method() === 'POST');
        await modal.getByRole('button', { name: /提交反馈|Submit/i }).click();
        try {
            await postPaused;
            await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '0' });
            await expect.poll(async () => (await readDiceThroneHarnessState<{ sys: { phase: string } }>(page)).sys.phase,
                { timeout: 10_000 }).not.toBe(before.sys.phase);
        } finally {
            releasePost();
        }
        const response = await responsePromise;
        expect(response.ok()).toBe(true);
        const { _id } = await response.json() as { _id: string };
        await expect(modal).toHaveCount(0);
        let stored: any;
        await expect.poll(async () => {
            stored = await db.collection('feedbacks').findOne({ content: '在线权威现场采集测试' });
            return typeof stored?.privateReplay === 'string';
        }, { timeout: 30_000 }).toBe(true);
        expect(String(stored._id)).toBe(_id);
        const archive = JSON.parse(gunzipSync(Buffer.from(stored.privateReplay, 'base64')).toString());
        expect(archive.matchId).toBe(match.matchId);
        expect(archive.gameId).toBe('dicethrone');
        expect(archive.state.sys.phase).toBe(before.sys.phase);
        expect(archive.state.core.players['0'].hand).toBeDefined();
        expect(archive.state.core.players['1'].hand).toBeDefined();
        expect(archive.randomSeed).toBeTruthy();
        expect(typeof archive.randomCursor).toBe('number');
        const publicDetail = await page.request.get(`/admin-api/feedback/${_id}`);
        expect(publicDetail.ok()).toBe(true);
        expect(await publicDetail.text()).not.toContain(stored.privateReplay);
        expect((await page.request.get(`/admin-api/feedback/${_id}/private-replay`)).status()).toBe(401);

        // 在同一测试对局还存活且种子未改变时，倒回权威现场并再次执行玩家命令。
        const advancedPhase = (await readDiceThroneHarnessState<{ sys: { phase: string } }>(page)).sys.phase;
        // 现有测试注入接口仍要求旧式阶段和回合元数据。
        const restoreState = {
            ...archive.state,
            core: { ...archive.state.core, phase: archive.state.sys.phase },
            sys: { ...archive.state.sys, matchId: match.matchId,
                turnOrder: archive.state.sys.turnOrder ?? Object.keys(archive.state.core.players),
                currentPlayerIndex: archive.state.sys.currentPlayerIndex ?? 0 },
        };
        const receipt = await injectMatchState(match.matchId, restoreState, page, undefined, { randomCursor: archive.randomCursor });
        expect(receipt.randomCursor).toBe(archive.randomCursor);
        await expect.poll(async () => (await readDiceThroneHarnessState<{ sys: { phase: string } }>(match.guestPage)).sys.phase)
            .toBe(before.sys.phase);
        await dispatchDiceThroneCommand(page, { type: 'ADVANCE_PHASE', playerId: '0' });
        await expect.poll(async () => (await readDiceThroneHarnessState<{ sys: { phase: string } }>(page)).sys.phase)
            .toBe(advancedPhase);
    } finally {
        await cleanupDTMatch(match);
        await db.close();
    }
});
