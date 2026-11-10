import { test, expect, chromium, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createHomeVisualFixture } from './helpers/homeVisualFixture.mjs';
import { createRulesPdf } from './helpers/gameRulesFixture.mjs';

test.describe.configure({ mode: 'serial' });
let base: string;
const mongoUri = process.env.MONGO_URI ?? '';
const runId = process.env.PLATFORM_E2E_RUN_ID;
const out = path.resolve(process.env.BG_REVIEW_EVIDENCE_DIR || `test-results/evidence-screenshots/_temporary/home/rules-review/${runId || 'missing-run'}`);
const internal = path.resolve(process.env.BG_REVIEW_INTERNAL_DIR || `.tmp/home-rules-review/${runId || 'missing-run'}`);
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const files = ['vite.config.ts', 'src/pages/admin/CreatorReview.tsx', 'src/pages/admin/creator-review.css', 'src/pages/admin/components/AdminLayout.tsx',
    'src/components/external/GameRulesDocumentLink.tsx', 'src/components/external/game-rules-document.css', 'src/components/home/PlatformUploadWorkspace.tsx',
    'src/components/home/PlatformHomeSurface.tsx', 'src/components/home/ExternalGameDetails.tsx', 'src/api/external-games.ts', 'src/api/game-submissions.ts',
    'apps/api/src/modules/ugc/game-submissions.service.ts', 'apps/api/src/modules/ugc/creator-review.controller.ts', 'apps/api/src/modules/ugc/external-games.service.ts',
    'public/locales/zh-CN/lobby.json', 'e2e/platform-rules-review.e2e.ts', 'playwright.platform-review.config.ts'];
const sources = Object.fromEntries(files.map(file => [file, sha(readFileSync(file))]));
const media: Array<Record<string, unknown>> = [], internalMedia: Array<Record<string, unknown>> = [], steps: Array<Record<string, unknown>> = [];
const password = 'Synthetic-review-only-20261101';
const pdf = createRulesPdf(), revisedPdf = createRulesPdf('Revised rules: read hero skills and alternate turns.');
const accounts: Array<{ email: string; username: string; role: string }> = [];
let db: mongoose.Connection;
let fixture: Awaited<ReturnType<typeof createHomeVisualFixture>>;
const recordCheck = (viewport: string, action: string, actual: unknown, expected: unknown) => {
    expect(actual, action).toEqual(expected); steps.push({ viewport, action, actual, expected, status: 'PASS' });
};
async function login(request: APIRequestContext, account: typeof accounts[number]) {
    const response = await request.post(base + '/auth/login', { data: { account: account.email, password } });
    expect(response.ok(), '真实登录').toBe(true); return (await response.json()).data;
}
async function installSession(context: BrowserContext, session: { token: string; user: unknown }) {
    await context.addInitScript(({ token, user, socketUrl }) => {
        localStorage.setItem('auth_token', token); localStorage.setItem('auth_user', JSON.stringify(user)); localStorage.setItem('i18nextLng', 'zh-CN');
        localStorage.setItem('bg_home_entry_style', 'modern'); localStorage.setItem('bg_home_entry_style_version', 'modern-default-v3');
        (window as unknown as { __FORCE_GAME_SERVER_URL__: string }).__FORCE_GAME_SERVER_URL__ = socketUrl;
    }, { ...session, socketUrl: fixture.url });
}
test.beforeAll(async ({ request }, info) => {
    const isolation = process.env.PLATFORM_E2E_ISOLATION_ID;
    if (!isolation || !/^[a-z0-9-]+$/.test(isolation) || !runId
        || mongoUri !== `mongodb://127.0.0.1:37022/boardgame_home_acceptance_${isolation}`) {
        throw new Error('后台审核验收必须使用首页独立 runtime、37022 端口及本轮唯一数据库');
    }
    base = String(info.project.use.baseURL || '');
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('后台审核验收必须使用隔离本机前端');
    mkdirSync(out, { recursive: true }); mkdirSync(internal, { recursive: true });
    db = await mongoose.createConnection(mongoUri).asPromise(); fixture = await createHomeVisualFixture({ roomCount: 0 });
    const nonce = Date.now();
    for (const [index, role] of ['user', 'admin'].entries()) {
        const account = { email: `review-${nonce}-${index}@example.invalid`, username: `${role === 'admin' ? '审核员' : '投稿者'}${String(nonce).slice(-4)}`, role };
        await db.collection('users').insertOne({ _id: new Types.ObjectId(), ...account, password: await bcrypt.hash(password, 10), emailVerified: true, banned: false, feedbackPoints: 0, developerGameIds: [], createdAt: new Date(), updatedAt: new Date() });
        accounts.push(account); await login(request, account);
    }
});
test.afterAll(async () => {
    if (!db) return;
    await fixture?.close(); await db?.close();
    writeFileSync(path.join(out, 'capture-record.json'), JSON.stringify({ sources, media, internalMedia, steps, capturedAt: new Date().toISOString(), environment: { base, mongo: mongoUri, storage: process.env.UGC_LOCAL_PATH, apiMocked: false, lobbySocketFixture: true } }, null, 2));
});

for (const mobile of [false, true]) test(`${mobile ? '手机' : '桌面'}后台实际驳回、修订重送与批准发布`, async ({ request }, info) => {
    info.setTimeout(120_000);
    const viewport = mobile ? '手机' : '桌面';
    const owner = await login(request, accounts[0]), admin = await login(request, accounts[1]);
    const headers = { Authorization: `Bearer ${owner.token}` };
    const data = { name: '王权骰铸', url: `https://example.com/dice-${Date.now()}`, category: 'dice', minPlayers: 2, maxPlayers: 4,
        author: '林间晚风', authorProfileUrl: 'https://example.com/creator', description: '英雄投骰与卡牌配合的对战游戏。', rules: '完整规则见附件。' };
    const created = await request.post(base + '/ugc/submissions', { headers, data }); expect(created.status()).toBe(201);
    const draft = await created.json();
    const coverMeta = JSON.parse(readFileSync('.tmp/home-upload-cover-fixture.json', 'utf8'));
    expect((await request.post(base + `/ugc/submissions/${draft.submissionId}/cover`, { headers, multipart: { file: { name: '封面.webp', mimeType: coverMeta.mimeType, buffer: readFileSync('.tmp/home-upload-cover-fixture') } } })).status()).toBe(201);
    const uploaded = await request.post(base + `/ugc/submissions/${draft.submissionId}/rules`, { headers, multipart: { file: { name: '王权骰铸规则.pdf', mimeType: 'application/pdf', buffer: pdf } } }); expect(uploaded.status()).toBe(201);
    const originalDocument = (await uploaded.json()).rulesDocument;
    expect((await request.post(base + `/ugc/submissions/${draft.submissionId}/submit`, { headers })).status()).toBe(201);
    const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args: ['--disable-gpu'] });
    const contextOptions = { viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN' };
    const adminContext = await browser.newContext(contextOptions), ownerContext = await browser.newContext(contextOptions);
    await installSession(adminContext, admin); await installSession(ownerContext, owner);
    await adminContext.tracing.start({ screenshots: true, snapshots: true, sources: true }); await ownerContext.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const adminPage = await adminContext.newPage(), ownerPage = await ownerContext.newPage();
    const card = adminPage.locator('.review-card').filter({ has: adminPage.locator(`a[href="${data.url}"]`) });
    const clicks: Array<{ decision: string; comment: string }> = [];
    adminPage.on('request', req => { if (req.method() === 'POST' && new URL(req.url()).pathname === `/ugc/creator-review/submissions/${draft.submissionId}`) clicks.push(req.postDataJSON()); });
    const take = async (page: Page, state: string, core = false) => {
        await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
        const file = path.join(core ? out : internal, `${viewport}-${state}.png`); await page.screenshot({ path: file, fullPage: true, scale: 'css' });
        (core ? media : internalMedia).push({ path: file, sha256: sha(readFileSync(file)), viewport: mobile ? 'mobile' : 'desktop', state,
            description: core ? `${viewport}后台审核操作代表态：修订规则文件可打开，审核意见与批准收录、驳回投稿入口同屏` : `${viewport}${state}内部代表态` });
    };
    const openDocument = async (page: Page, context: BrowserContext, url: string, bytes: Buffer) => {
        const popupPromise = context.waitForEvent('page'); const link = page.locator(`a.external-rules-document[href="${url}"]`);
        if (mobile) await link.tap(); else await link.click();
        const popup = await popupPromise; await expect(popup).toHaveURL(base + url); await popup.close();
        const resource = await request.get(base + url); recordCheck(viewport, '后台实际打开规则文件', resource.status(), 200); recordCheck(viewport, '打开文件的字节正确', sha(await resource.body()), sha(bytes));
    };
    const readSubmission = async () => (await (await request.get(base + '/ugc/submissions', { headers })).json()).items.find((item: { submissionId: string }) => item.submissionId === draft.submissionId);
    const publicMatches = async () => (await (await request.get(base + '/ugc/external-games')).json()).items.filter((game: { url: string }) => game.url === data.url);
    try {
        await adminPage.goto(base + '/admin'); await adminPage.getByRole('link', { name: '创作者审核', exact: true }).click();
        await expect(adminPage).toHaveURL(base + '/admin/creator-review'); await expect(card).toBeVisible();
        await expect(card.getByAltText('王权骰铸投稿封面')).toBeVisible(); await card.getByAltText('王权骰铸投稿封面').evaluate(image => (image as HTMLImageElement).decode());
        await openDocument(adminPage, adminContext, originalDocument.url, pdf);
        recordCheck(viewport, '待审核尚未公开', (await publicMatches()).length, 0);
        await card.getByRole('button', { name: '批准收录', exact: true }).click();
        await expect(card.getByRole('alert')).toHaveText('请填写审核意见'); recordCheck(viewport, '空意见不能发出审核请求', clicks.length, 0); await take(adminPage, '空审核意见');
        const rejection = '请补充回合流程和技能阅读说明后重新提交。';
        await card.getByRole('textbox', { name: '审核意见', exact: true }).fill(rejection);
        const rejectedResponse = adminPage.waitForResponse(response => new URL(response.url()).pathname === `/ugc/creator-review/submissions/${draft.submissionId}` && response.request().method() === 'POST');
        if (mobile) await card.getByRole('button', { name: '驳回投稿', exact: true }).tap(); else await card.getByRole('button', { name: '驳回投稿', exact: true }).click();
        recordCheck(viewport, '后台驳回按钮请求成功', (await rejectedResponse).status(), 201);
        await adminPage.reload(); await expect(card).toHaveCount(0);
        const rejected = await readSubmission(); recordCheck(viewport, '驳回后持久状态', rejected.status, 'rejected'); recordCheck(viewport, '驳回意见持久化', rejected.reviewComment, rejection);
        recordCheck(viewport, '驳回后仍未公开', (await publicMatches()).length, 0);
        await ownerPage.goto(base + `/?section=upload&submission=${draft.submissionId}`);
        await expect(ownerPage.getByRole('status').filter({ hasText: rejection })).toBeVisible({ timeout: 30000 });
        await expect(ownerPage.getByRole('textbox', { name: '规则说明（选填）', exact: true })).toBeEnabled(); await take(ownerPage, '投稿者退回意见');
        await ownerPage.getByRole('textbox', { name: '规则说明（选填）', exact: true }).fill('已补充回合流程及英雄技能阅读顺序，完整内容见修订规则。');
        await ownerPage.getByLabel('规则文件', { exact: true }).setInputFiles({ name: '王权骰铸规则修订.pdf', mimeType: 'application/pdf', buffer: revisedPdf });
        const submit = ownerPage.getByRole('button', { name: '提交审核', exact: true });
        if (mobile) await submit.tap({ position: { x: 15, y: 15 } }); else await submit.click();
        await expect(ownerPage.getByRole('button', { name: '撤回投稿', exact: true })).toBeVisible();
        const pending = await readSubmission(); recordCheck(viewport, '投稿者页面修订后重新待审', pending.status, 'pending');
        recordCheck(viewport, '文件修订已保存', pending.rulesDocument.name, '王权骰铸规则修订.pdf');
        await adminPage.getByRole('button', { name: '刷新队列', exact: true }).click(); await expect(card).toBeVisible();
        await expect(card).toContainText('已补充回合流程'); await expect(card.getByRole('link', { name: /打开规则文件/ })).toContainText('王权骰铸规则修订.pdf');
        await openDocument(adminPage, adminContext, pending.rulesDocument.url, revisedPdf);
        await card.getByRole('textbox', { name: '审核意见', exact: true }).fill('已核对修订规则、封面和游戏链接，批准收录。');
        if (mobile) await card.getByRole('button', { name: '驳回投稿', exact: true }).scrollIntoViewIfNeeded(); else await card.scrollIntoViewIfNeeded();
        for (const control of [card.getByRole('link', { name: /打开规则文件/ }), card.getByRole('textbox', { name: '审核意见', exact: true }),
            card.getByRole('button', { name: '批准收录', exact: true }), card.getByRole('button', { name: '驳回投稿', exact: true })]) {
            const box = await control.boundingBox(); const size = adminPage.viewportSize();
            expect(box, '核心截图中的审核控件有真实尺寸').not.toBeNull();
            expect(box!.x >= 0 && box!.y >= 0 && box!.x + box!.width <= size!.width && box!.y + box!.height <= size!.height,
                '核心截图须完整展示规则文件、意见和两种审核动作').toBe(true);
        }
        await take(adminPage, '规则与审核操作', true);
        const approvedResponse = adminPage.waitForResponse(response => new URL(response.url()).pathname === `/ugc/creator-review/submissions/${draft.submissionId}` && response.request().method() === 'POST');
        if (mobile) await card.getByRole('button', { name: '批准收录', exact: true }).tap(); else await card.getByRole('button', { name: '批准收录', exact: true }).click();
        recordCheck(viewport, '后台批准按钮请求成功', (await approvedResponse).status(), 201);
        await adminPage.reload(); await expect(card).toHaveCount(0);
        const approved = await readSubmission(); recordCheck(viewport, '批准后持久状态', approved.status, 'approved');
        recordCheck(viewport, '批准后有公开游戏编号', Boolean(approved.gameId), true);
        const games = await publicMatches(); recordCheck(viewport, '公开目录只收录同一游戏一次', games.length, 1); recordCheck(viewport, '公开游戏关联一致', games[0].gameId, approved.gameId);
        recordCheck(viewport, '公开游戏为修订后的规则文件', games[0].rulesDocument.url, pending.rulesDocument.url);
        await ownerPage.goto(base); await ownerPage.getByPlaceholder('搜索游戏', { exact: true }).fill('王权骰铸');
        await ownerPage.locator(`[data-game-id="${approved.gameId}"] .platform-game-open`).click();
        await expect(ownerPage.getByRole('link', { name: /打开规则文件/ })).toBeVisible();
        recordCheck(viewport, '实际公开详情显示修订文件', await ownerPage.getByRole('link', { name: /打开规则文件/ }).getAttribute('href'), pending.rulesDocument.url);
        await openDocument(ownerPage, ownerContext, pending.rulesDocument.url, revisedPdf); await take(ownerPage, '公开结果');
        recordCheck(viewport, '审核请求确由浏览器按驳回再批准触发', clicks.map(item => item.decision), ['rejected', 'approved']);
        for (const [file, expected] of Object.entries(sources)) expect(sha(readFileSync(file)), file).toBe(expected);
    } finally {
        await adminContext.tracing.stop({ path: path.join(out, `${viewport}-后台-trace.zip`) }); await ownerContext.tracing.stop({ path: path.join(out, `${viewport}-投稿者-trace.zip`) }); await browser.close();
    }
});
