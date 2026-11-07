import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { gunzipSync } from 'node:zlib';
import { setChineseLocale } from '../helpers/common';
import { cleanupDTMatch, readDiceThroneHarnessState, readyAndStartGame, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';
import { injectMatchState } from '../helpers/state-injection';

test('在线双人手动与首次自动反馈都保存触发瞬间权威现场', async ({ browser, baseURL }) => {
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
        const diagnosticPacket = (typeof stored.diagnosticPacket === 'string'
            ? JSON.parse(stored.diagnosticPacket)
            : stored.diagnosticPacket) as {
            snapshots?: { at?: Record<string, unknown> };
            randomCursor?: number;
        };
        expect(JSON.stringify(diagnosticPacket)).not.toContain('"hand"');
        expect(JSON.stringify(diagnosticPacket)).not.toContain('randomSeed');
        expect(String(stored.actionLog)).not.toContain('"hand"');
        expect(String(stored.actionLog)).not.toContain('randomSeed');
        expect(String(stored.stateSnapshot)).not.toContain('"hand"');
        expect(String(stored.stateSnapshot)).not.toContain('randomSeed');
        const archive = JSON.parse(gunzipSync(Buffer.from(stored.privateReplay, 'base64')).toString());
        expect(archive.matchId).toBe(match.matchId);
        expect(archive.gameId).toBe('dicethrone');
        expect(archive.state.sys.phase).toBe(before.sys.phase);
        expect(archive.state.core.players['0'].hand).toBeDefined();
        expect(archive.state.core.players['1'].hand).toBeDefined();
        expect(archive.randomSeed).toBeTruthy();
        expect(typeof archive.randomCursor).toBe('number');
        const publicDetail = await page.request.get(`/admin-api/feedback/${_id}`);
        expect(publicDetail.status()).toBe(404);
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
        const advancePhaseThroughPlayerUI = async () => {
            const control = page.locator('[data-tutorial-id="advance-phase-button"]').first();
            await expect(control).toBeVisible();
            await expect(control).toBeEnabled();
            await control.click();
        };
        await advancePhaseThroughPlayerUI();
        await expect.poll(async () => (await readDiceThroneHarnessState<{ sys: { phase: string } }>(page)).sys.phase)
            .toBe(advancedPhase);

        await page.unroute('**/feedback');
        const autoBefore = await readDiceThroneHarnessState<{ sys: { phase: string; stateId?: number; revision?: number } }>(page);
        let releaseAutoPost!: () => void;
        let autoPostReached!: () => void;
        const autoPostPaused = new Promise<void>(resolve => { autoPostReached = resolve; });
        const autoPostRelease = new Promise<void>(resolve => { releaseAutoPost = resolve; });
        let autoPostCount = 0;
        let autoRequestBody: Record<string, unknown> | undefined;
        await page.route('**/feedback', async route => {
            if (route.request().method() !== 'POST') return route.continue();
            autoPostCount += 1;
            autoRequestBody = route.request().postDataJSON() as Record<string, unknown>;
            autoPostReached();
            await autoPostRelease;
            await route.continue();
        });
        const autoResponsePromise = page.waitForResponse(r => new URL(r.url()).pathname === '/feedback' && r.request().method() === 'POST');
        await page.evaluate(() => {
            window.dispatchEvent(new ErrorEvent('error', {
                message: 'feedback-first-trigger-e2e',
                error: new Error('feedback-first-trigger-e2e'),
            }));
        });
        try {
            await autoPostPaused;
            await advancePhaseThroughPlayerUI();
            await expect.poll(async () => (await readDiceThroneHarnessState<{ sys: { phase: string } }>(page)).sys.phase,
                { timeout: 10_000 }).not.toBe(autoBefore.sys.phase);
        } finally {
            releaseAutoPost();
        }
        const autoResponse = await autoResponsePromise;
        expect(autoResponse.ok()).toBe(true);
        const autoFeedbackId = (await autoResponse.json() as { _id: string })._id;
        const autoDiagnostic = JSON.parse(String(autoRequestBody?.diagnosticPacket ?? '{}')) as {
            captureId?: string;
            correlation?: Record<string, unknown>;
            missingFields?: string[];
            commandTraceTail?: Array<{ commandId?: string; commandType?: string }>;
            lastCommand?: { commandId?: string; commandType?: string };
            randomCursor?: number;
            snapshots?: { at?: { sys?: { phase?: string } } };
        };
        expect(autoRequestBody).toMatchObject({ source: 'client-window-error', autoReportKind: 'window-error' });
        expect(autoDiagnostic.captureId).toEqual(expect.any(String));
        expect(autoDiagnostic.correlation).toMatchObject({ matchId: match.matchId });
        expect(autoDiagnostic.correlation?.stateId).toEqual(expect.any(Number));
        expect(autoDiagnostic.correlation?.stateRevision).toEqual(expect.any(Number));
        expect(autoDiagnostic.randomCursor).toEqual(expect.any(Number));
        expect(autoDiagnostic.lastCommand?.commandId).toEqual(expect.any(String));
        expect(autoDiagnostic.lastCommand?.commandType).toBe('ADVANCE_PHASE');
        expect(autoDiagnostic.commandTraceTail).toEqual(expect.arrayContaining([
            expect.objectContaining({
                commandId: autoDiagnostic.lastCommand?.commandId,
                commandType: 'ADVANCE_PHASE',
            }),
        ]));
        expect(autoDiagnostic.snapshots?.at?.sys?.phase).toBe(autoBefore.sys.phase);
        expect(autoDiagnostic.missingFields).toContain('correlation.roomId');
        let autoStored: any;
        await expect.poll(async () => {
            autoStored = await db.collection('feedbacks').findOne({ _id: new mongoose.Types.ObjectId(autoFeedbackId) });
            return typeof autoStored?.privateReplay === 'string';
        }, { timeout: 30_000 }).toBe(true);
        expect(autoStored.reporterType).toBe('system');
        expect(autoStored.errorContext?.message).toBe('feedback-first-trigger-e2e');
        const autoArchive = JSON.parse(gunzipSync(Buffer.from(autoStored.privateReplay, 'base64')).toString());
        expect(autoArchive.matchId).toBe(match.matchId);
        expect(autoArchive.state.sys.phase).toBe(autoBefore.sys.phase);
        expect(autoArchive.state.core.players['0'].hand).toBeDefined();
        expect(autoArchive.randomSeed).toBeTruthy();
        expect(typeof autoArchive.randomCursor).toBe('number');
        const autoPublicDetail = await page.request.get(`/admin-api/feedback/${autoFeedbackId}`);
        expect(autoPublicDetail.ok()).toBe(true);
        expect(await autoPublicDetail.text()).not.toContain(autoStored.privateReplay);

        await page.evaluate(() => {
            window.dispatchEvent(new ErrorEvent('error', {
                message: 'feedback-first-trigger-e2e',
                error: new Error('feedback-first-trigger-e2e'),
            }));
        });
        await page.waitForTimeout(500);
        expect(autoPostCount).toBe(1);
        expect(await db.collection('feedbacks').countDocuments({
            content: '[auto][window.error] feedback-first-trigger-e2e',
        })).toBe(1);
    } finally {
        await cleanupDTMatch(match);
        await db.close();
    }
});
