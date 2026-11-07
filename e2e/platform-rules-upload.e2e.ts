import { test, expect, chromium, type APIRequestContext } from '@playwright/test';
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
const out = path.resolve(`test-results/evidence-screenshots/_temporary/home/rules-upload/${runId || 'missing-run'}`);
const internal = path.resolve(`.tmp/home-rules-upload/${runId || 'missing-run'}`);
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['src/shared/externalGames.ts', 'src/components/home/PlatformHomeSurface.tsx', 'src/components/home/PlatformUploadWorkspace.tsx', 'src/components/home/RulesDocumentField.tsx', 'src/components/home/platform-upload.css',
    'src/components/home/ExternalGameDetails.tsx', 'src/components/external/GameRulesDocumentLink.tsx', 'src/components/external/game-rules-document.css', 'src/pages/ExternalGamePage.tsx', 'src/pages/admin/CreatorReview.tsx',
    'src/api/game-submissions.ts', 'src/api/external-games.ts', 'apps/api/src/modules/ugc/game-rules-file.ts', 'apps/api/src/modules/ugc/game-submissions.service.ts',
    'apps/api/src/modules/ugc/game-submissions.controller.ts', 'apps/api/src/modules/ugc/external-games.service.ts', 'apps/api/src/modules/ugc/external-games.controller.ts',
    'apps/api/src/modules/ugc/schemas/game-submission.schema.ts', 'apps/api/src/modules/ugc/schemas/external-game.schema.ts', 'public/locales/zh-CN/lobby.json', 'public/locales/en/lobby.json',
    'e2e/platform-rules-upload.e2e.ts', 'e2e/helpers/gameRulesFixture.mjs'];
const sources = Object.fromEntries(sourceFiles.map(file => [file, sha(readFileSync(file))]));
const media: Array<Record<string, unknown>> = [], internalMedia: Array<Record<string, unknown>> = [], steps: Array<Record<string, unknown>> = [];
const pdf = createRulesPdf(), replacement = createRulesPdf('Updated rules: alternate turns and read your hero skills.');
const password = 'Synthetic-rules-test-20261101';
const accounts: Array<{ email: string; username: string; role: string }> = [];
const tokens: string[] = [];
let fixture: Awaited<ReturnType<typeof createHomeVisualFixture>>;
let db: mongoose.Connection;
const check = (viewport: string, action: string, actual: unknown, expected: unknown) => {
    expect(actual, action).toEqual(expected); steps.push({ viewport, action, actual, expected, status: 'PASS' });
};
async function login(request: APIRequestContext, account: typeof accounts[number]) {
    const response = await request.post(base + '/auth/login', { data: { account: account.email, password } });
    expect(response.ok(), '真实登录接口').toBe(true);
    const result = await response.json(); return result.data;
}
test.beforeAll(async ({ request }, info) => {
    const isolation = process.env.PLATFORM_E2E_ISOLATION_ID;
    if (!isolation || !/^[a-z0-9-]+$/.test(isolation) || !runId
        || mongoUri !== `mongodb://127.0.0.1:37022/boardgame_home_acceptance_${isolation}`) {
        throw new Error('规则文件验收必须使用首页独立 runtime、37022 端口及本轮唯一数据库');
    }
    base = String(info.project.use.baseURL || '');
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('规则文件验收必须使用隔离本机前端');
    mkdirSync(out, { recursive: true }); mkdirSync(internal, { recursive: true });
    db = await mongoose.createConnection(mongoUri).asPromise();
    fixture = await createHomeVisualFixture({ roomCount: 0 });
    const nonce = Date.now().toString();
    for (const [index, role] of ['user', 'user', 'admin'].entries()) {
        const account = { email: `rules-${nonce}-${index}@example.invalid`, username: `${index === 2 ? '规则审核' : '林间晚风'}${nonce.slice(-4)}${index}`, role };
        await db.collection('users').insertOne({ _id: new Types.ObjectId(), ...account, password: await bcrypt.hash(password, 10), emailVerified: true, banned: false, developerGameIds: [], feedbackPoints: 0, createdAt: new Date(), updatedAt: new Date() });
        accounts.push(account); tokens.push((await login(request, account)).token);
    }
});
test.afterAll(async () => {
    if (!db) return;
    await fixture?.close(); await db?.close();
    writeFileSync(path.join(out, 'capture-record.json'), JSON.stringify({ sources, media, internalMedia, steps, capturedAt: new Date().toISOString(), environment: { frontend: base, mongo: mongoUri, storage: process.env.UGC_LOCAL_PATH, apiMocked: false, lobbySocketFixture: true } }, null, 2));
});

for (const mobile of [false, true]) test(`${mobile ? '手机' : '桌面'}真实投稿规则文件：草稿、锁定、发布与详情`, async ({ request }) => {
    const label = mobile ? '手机' : '桌面';
    const session = await login(request, accounts[0]);
    const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args: ['--disable-gpu'] });
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN' });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    await context.addInitScript(({ token, user, socketUrl }) => {
        localStorage.setItem('auth_token', token); localStorage.setItem('auth_user', JSON.stringify(user));
        localStorage.setItem('bg_home_entry_style', 'modern'); localStorage.setItem('bg_home_entry_style_version', 'modern-default-v3'); localStorage.setItem('i18nextLng', 'zh-CN');
        (window as unknown as { __FORCE_GAME_SERVER_URL__: string }).__FORCE_GAME_SERVER_URL__ = socketUrl;
    }, { ...session, socketUrl: fixture.url });
    const page = await context.newPage();
    const take = async (state: string, core: boolean) => {
        await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
        const file = path.join(core ? out : internal, `${label}-${state}.png`);
        await page.screenshot({ path: file, fullPage: true, scale: 'css' });
        (core ? media : internalMedia).push({ path: file, sha256: sha(readFileSync(file)), viewport: mobile ? 'mobile' : 'desktop', state,
            description: state === '草稿规则文件' ? `${label}投稿代表态：规则文件已保存可打开，介绍与规则说明分工，表单不再收集预估时长` : `${label}${state}代表态：已发布游戏详情提供规则文件打开入口` });
    };
    try {
        await page.goto(base);
        if (mobile) await page.locator('.platform-menu-trigger').tap();
        await expect(page.getByRole('button', { name: '上传', exact: true })).toBeVisible({ timeout: 60000 });
        await page.getByRole('button', { name: '上传', exact: true }).click();
        await expect(page.getByRole('heading', { name: '上传新游戏', exact: true })).toBeVisible();
        check(label, '预估时长字段已移出', await page.locator('[name=durationMinutes]').count(), 0);
        await page.getByRole('textbox', { name: '游戏名称', exact: true }).fill('王权骰铸');
        await page.getByRole('textbox', { name: '游戏链接', exact: true }).fill('https://example.com/dice-duel');
        await page.locator('[name=category]').selectOption('dice');
        await page.locator('[name=author]').fill('林间晚风');
        await page.locator('[name=authorProfileUrl]').fill('https://example.com/creator');
        await page.getByRole('textbox', { name: '介绍', exact: true }).fill('选择喜欢的英雄，通过投骰与卡牌配合展开对战。每位英雄都有独特的技能与战术。');
        await page.getByRole('textbox', { name: '规则说明（选填）', exact: true }).fill('完整规则见文件。首次游玩建议从英雄技能和回合流程开始阅读。');
        const coverMeta = JSON.parse(readFileSync('.tmp/home-upload-cover-fixture.json', 'utf8'));
        await page.getByLabel('封面', { exact: true }).setInputFiles({ name: '王权骰铸封面.webp', mimeType: coverMeta.mimeType, buffer: readFileSync('.tmp/home-upload-cover-fixture') });
        await page.getByLabel('规则文件', { exact: true }).setInputFiles({ name: '错误文件.txt', mimeType: 'text/plain', buffer: Buffer.from('text') });
        await expect(page.getByRole('alert')).toContainText('请选择 PDF'); await take('规则错误', false);
        if (!mobile) {
            await page.getByLabel('规则文件', { exact: true }).setInputFiles({ name: '损坏规则.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nbroken') });
            await page.getByRole('button', { name: '保存草稿', exact: true }).click();
            await expect(page.getByRole('alert')).toContainText('有效的 PDF');
            check(label, '文件失败后仍有稳定草稿网址', Boolean(new URL(page.url()).searchParams.get('submission')), true);
            check(label, '文件失败后输入未丢失', await page.getByRole('textbox', { name: '游戏名称', exact: true }).inputValue(), '王权骰铸');
            await page.reload();
            await expect(page.getByRole('heading', { name: '王权骰铸', exact: true })).toBeVisible();
            check(label, '上传失败后刷新仍恢复同份草稿', await page.getByRole('textbox', { name: '游戏名称', exact: true }).inputValue(), '王权骰铸');
        }
        await page.getByLabel('规则文件', { exact: true }).setInputFiles({ name: '王权骰铸规则.pdf', mimeType: 'application/pdf', buffer: pdf });
        await page.getByRole('button', { name: '保存草稿', exact: true }).click();
        await expect(page.getByRole('heading', { name: '王权骰铸', exact: true })).toBeVisible();
        const headers = { Authorization: `Bearer ${tokens[0]}` };
        const list = await (await request.get(base + '/ugc/submissions', { headers })).json();
        const record = list.items[0];
        check(label, '草稿持久化规则文件名', record.rulesDocument.name, '王权骰铸规则.pdf');
        check(label, '保存草稿没有送审', record.status, 'draft');
        const content = await request.get(base + record.rulesDocument.url);
        check(label, '真实存储文件读取', content.status(), 200); check(label, '存储文件与所选文件字节一致', sha(await content.body()), sha(pdf));
        const unauth = await request.post(base + `/ugc/submissions/${record.submissionId}/rules`, { multipart: { file: { name: 'rules.pdf', mimeType: 'application/pdf', buffer: pdf } } }); check(label, '未登录不能上传', unauth.status(), 401);
        const other = await request.delete(base + `/ugc/submissions/${record.submissionId}/rules`, { headers: { Authorization: `Bearer ${tokens[1]}` } }); check(label, '其他账户不能移除', other.status(), 404);
        if (!mobile) {
            const invalid = await request.post(base + `/ugc/submissions/${record.submissionId}/rules`, { headers, multipart: { file: { name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>not a PDF</html>') } } }); check(label, '服务端拒绝伪装成文档的文件', invalid.status(), 400);
            const oversized = await request.post(base + `/ugc/submissions/${record.submissionId}/rules`, { headers, multipart: { file: { name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) } } }); check(label, '真实上传接口拒绝超限文件', oversized.status(), 413);
        }
        await page.reload();
        await expect(page.getByRole('link', { name: '王权骰铸规则.pdf', exact: true })).toBeVisible();
        check(label, '刷新后已保存文件可查看', await page.getByRole('link', { name: '王权骰铸规则.pdf', exact: true }).getAttribute('href'), record.rulesDocument.url);
        await page.evaluate(() => window.scrollTo(0, 0)); await take('草稿规则文件', true);
        await page.getByRole('button', { name: '更换', exact: true }).click();
        await page.getByLabel('规则文件', { exact: true }).setInputFiles({ name: '王权骰铸规则修订.pdf', mimeType: 'application/pdf', buffer: replacement });
        await page.getByRole('button', { name: '提交审核', exact: true }).click();
        await expect(page.getByRole('button', { name: '撤回投稿', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '移除规则文件', exact: true })).toBeDisabled(); await take('待审核', false);
        const locked = await request.post(base + `/ugc/submissions/${record.submissionId}/rules`, { headers, multipart: { file: { name: 'rules.pdf', mimeType: 'application/pdf', buffer: pdf } } }); check(label, '待审服务端拒绝文件修改', locked.status(), 409);
        await page.getByRole('button', { name: '撤回投稿', exact: true }).click();
        await expect(page.getByRole('button', { name: '移除规则文件', exact: true })).toBeEnabled();
        await page.getByRole('button', { name: '移除规则文件', exact: true }).click();
        await page.getByRole('button', { name: '保存草稿', exact: true }).click();
        await expect(page.getByRole('button', { name: '上传规则文件', exact: true })).toBeVisible();
        const removed = (await (await request.get(base + '/ugc/submissions', { headers })).json()).items.find((item: { submissionId: string }) => item.submissionId === record.submissionId);
        check(label, '移除后草稿不保留旧文件引用', Boolean(removed.rulesDocument), false);
        await page.getByLabel('规则文件', { exact: true }).setInputFiles({ name: '王权骰铸规则修订.pdf', mimeType: 'application/pdf', buffer: replacement });
        await page.getByRole('button', { name: '提交审核', exact: true }).click();
        await expect(page.getByRole('button', { name: '撤回投稿', exact: true })).toBeVisible();
        const pending = (await (await request.get(base + '/ugc/submissions', { headers })).json()).items.find((item: { submissionId: string }) => item.submissionId === record.submissionId);
        const approved = await request.post(base + `/ugc/creator-review/submissions/${record.submissionId}`, { headers: { Authorization: `Bearer ${tokens[2]}` }, data: { decision: 'approved', comment: '规则资料完整，可以查看。', revision: pending.updatedAt } });
        check(label, '真实审核发布成功', approved.status(), 201);
        const publishedRecord = await approved.json();
        const published = await (await request.get(base + '/ugc/external-games/' + publishedRecord.gameId)).json();
        check(label, '公开游戏保留修订文件', published.rulesDocument.url, pending.rulesDocument.url);
        await page.goto(base); await page.getByPlaceholder('搜索游戏', { exact: true }).fill('王权骰铸');
        await page.locator(`[data-game-id="${published.gameId}"] .platform-game-open`).click();
        const open = page.getByRole('link', { name: /打开规则文件/ }); await expect(open).toBeVisible();
        check(label, '正式首页详情使用发布后的文件地址', await open.getAttribute('href'), published.rulesDocument.url);
        await take('发布详情规则入口', true);
        const popupPromise = context.waitForEvent('page'); await open.click(); const popup = await popupPromise;
        await expect(popup).toHaveURL(new RegExp(published.rulesDocument.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 15000 });
        check(label, '实际打开规则文件页面', new URL(popup.url()).pathname, published.rulesDocument.url); await popup.close();
        const publishedContent = await request.get(base + published.rulesDocument.url); check(label, '发布后文件内容正确', sha(await publishedContent.body()), sha(replacement));
        if (!mobile) {
            await db.collection('creatorclaimrecords').insertOne({ claimId: `rules-owner-${Date.now()}`, gameId: published.gameId, applicantId: session.user.id, status: 'approved' });
            const denied = await request.post(base + `/ugc/external-games/${published.gameId}/rules`, { headers: { Authorization: `Bearer ${tokens[1]}` }, multipart: { file: { name: 'rules.pdf', mimeType: 'application/pdf', buffer: pdf } } }); check(label, '未认证账户不能改作者作品规则', denied.status(), 403);
            const ownedUpload = await request.post(base + `/ugc/external-games/${published.gameId}/rules`, { headers, multipart: { file: { name: '规则.pdf', mimeType: 'application/pdf', buffer: replacement } } }); check(label, '预置认证作者可替换规则文件', ownedUpload.status(), 201);
            const ownedRemove = await request.delete(base + `/ugc/external-games/${published.gameId}/rules`, { headers }); check(label, '认证作者可移除规则文件', ownedRemove.status(), 200);
            const ownedGame = await (await request.get(base + '/ugc/external-games/' + published.gameId)).json(); check(label, '作者移除后公开详情不残留文件', Boolean(ownedGame.rulesDocument), false);
            const restored = await request.post(base + `/ugc/external-games/${published.gameId}/rules`, { headers, multipart: { file: { name: '王权骰铸规则修订.pdf', mimeType: 'application/pdf', buffer: replacement } } }); check(label, '作者重新上传后文件恢复可用', restored.status(), 201);
        }
        for (const [file, expected] of Object.entries(sources)) expect(sha(readFileSync(file)), file).toBe(expected);
    } finally { await context.tracing.stop({ path: path.join(out, `${label}-trace.zip`) }); await browser.close(); }
});
