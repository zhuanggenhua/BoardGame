import bcrypt from 'bcryptjs';
import { execFileSync } from 'node:child_process';
import mongoose, { Types, type Connection } from 'mongoose';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { E2E_SINGLE_WORKER_PORTS } from '../scripts/infra/e2e-port-config.js';

test.use({ trace: 'retain-on-failure', launchOptions: {
    chromiumSandbox: true,
    ...(process.env.PW_BROWSER_EXECUTABLE ? { executablePath: process.env.PW_BROWSER_EXECUTABLE } : {}),
} });
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'synthetic-pass-248';
const RUN_ID = process.env.PLATFORM_E2E_RUN_ID || `${Date.now()}-${process.pid}-${randomUUID()}`;
const ISOLATION_ID = process.env.PLATFORM_E2E_ISOLATION_ID || '';
const EVIDENCE_DIR = join(process.cwd(), 'test-results/evidence-screenshots/_temporary/home/platform账号收藏投稿', RUN_ID);
const BASE_REVISION = '6cf1a9178b00567e3d58c46ef17209b78016928c';
const CURRENT_HEAD_REVISION = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/i.test(CURRENT_HEAD_REVISION)) throw new Error(`无法读取有效 git HEAD: ${CURRENT_HEAD_REVISION}`);
const LIBRARY_BUNDLE_ID = 'source-candidate-20261022';
const BETRAYAL_COVER_PATH = '/assets/i18n/zh-CN/betrayal/thumbnails/compressed/cover.webp';
const BETRAYAL_COVER_SHA256 = 'e274bf22d3a7323a467515ad09e03321cc7912b48eaa1c35b99f5b1216dc3696';
const FATE_COVER_PATH = 'public/assets/i18n/zh-CN/fate-domination/thumbnails/compressed/cover.webp';
const BETRAYAL_COVER_FILE = 'public/assets/i18n/zh-CN/betrayal/thumbnails/compressed/cover.webp';
const SOURCE_FILES = [
    'package.json', 'package-lock.json', 'src/server/storage/UGCStorageService.ts',
    'src/App.tsx', 'src/pages/Home.tsx', 'src/pages/HomeEntry.tsx',
    'src/components/home/PlatformHomeSurface.tsx', 'src/components/home/PlatformGameCatalog.tsx',
    'src/components/home/PlatformFavoriteButton.tsx', 'src/components/home/PlatformUploadWorkspace.tsx',
    'src/components/home/useGameLibrary.ts', 'src/components/lobby/thumbnails.tsx',
    'src/components/common/media/OptimizedImage.tsx', 'src/config/games.config.tsx',
    'src/core/AssetLoader.ts', 'src/api/user-library.ts', 'src/api/game-submissions.ts',
    'src/contexts/AuthContext.tsx', 'src/components/auth/AuthModal.tsx', 'src/games/manifest.client.tsx',
    'apps/api/src/modules/auth/auth.controller.ts',
    'apps/api/src/main.ts',
    'apps/api/src/modules/user-settings/user-settings.controller.ts',
    'apps/api/src/modules/user-settings/user-settings.service.ts',
    'apps/api/src/modules/user-settings/dtos/library-settings.dto.ts',
    'apps/api/src/modules/user-settings/schemas/user-ui-settings.schema.ts',
    'apps/api/src/modules/ugc/game-submissions.controller.ts',
    'apps/api/src/modules/ugc/game-submissions.service.ts',
    'apps/api/src/modules/ugc/dtos/game-submission.dto.ts',
    'apps/api/src/modules/ugc/schemas/game-submission.schema.ts',
    'scripts/infra/single-worker-runtime.js',
    'src/games/betrayal/manifest.ts', 'src/games/betrayal/thumbnail.tsx',
    'src/games/betrayal/thumbnail.css', 'vite.config.ts',
    'public/assets/i18n/zh-CN/betrayal/assets-manifest.json', BETRAYAL_COVER_FILE,
    'public/assets/i18n/zh-CN/fate-domination/assets-manifest.json', FATE_COVER_PATH,
    'e2e/platform-account-library-submission.e2e.ts',
];
const sourceHash = createHash('sha256');
const sourceFileDigests = SOURCE_FILES.map(sourceFile => {
    const bytes = readFileSync(join(process.cwd(), sourceFile));
    sourceHash.update(`${sourceFile}\0`);
    sourceHash.update(bytes);
    return { path: sourceFile, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const SOURCE_REVISION = `${BASE_REVISION}+head:${CURRENT_HEAD_REVISION}+${LIBRARY_BUNDLE_ID}+sha256:${sourceHash.digest('hex')}`;
const isolationFolder = join(tmpdir(), `boardgame-home-acceptance-${ISOLATION_ID}`);
const expectedUgcRoot = join(isolationFolder, 'ugc');

type IsolationEvidence = { id: string; mongoHost: string; mongoDatabase: string; storageMode: 'local'; storageRoot: string };
type LocalImageObservation = { urlPath: string; status: number; contentType: string | null; bytes: number; sha256: string; width?: number; height?: number };

type Account = { email: string; username: string; id: string };
type Media = { id: string; path: string; sha256: string; behaviorStepId: string; uiChange: string; description: string };
type Step = { id: string; action: string; before: Record<string, unknown>; after: Record<string, unknown>; assertions: Array<{ name: string; actual: unknown; expected: unknown }> };
const media: Media[] = [];
type Chain = { chainId: string; sourceRun: string; sourceRevision: string; evidenceFile: string; status: 'IN_PROGRESS' | 'PASS' | 'FAILED'; outcome: string; failure?: { name: string; message: string; completedStepIds: string[] }; steps: Step[]; uiStates: Array<{ id: string; stepId: string; change: string; viewport: string; sha256: string }> };
const chains: Chain[] = [];
let fixtureConnection: Connection | null = null;
let accounts: Partial<Record<'alice' | 'bob', Account>> = {};
const seededUserIds: string[] = [];
const createdSubmissionIds: string[] = [];
let settingsCollectionName = '';
let submissionCollectionName = '';
let storageRootIsolated = false;
let isolationEvidence: IsolationEvidence | null = null;
const cleanupEvidence: Record<string, unknown> = {};
let databaseBeforeSeeds: Record<string, number> | null = null;
let storageRootPreparation = '';

async function prepareIsolatedStorageRoot(path: string): Promise<string> {
    let directoryCreatedByTest = false;
    try {
        const entry = await lstat(path);
        if (!entry.isDirectory()) throw new Error(`本轮 UGC 根目录必须是普通目录: ${path}`);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await mkdir(path, { recursive: false });
        directoryCreatedByTest = true;
    }
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) throw new Error(`本轮专属 UGC 根目录含有非目录资源，拒绝复用: ${join(path, entry.name)}`);
        await prepareIsolatedStorageRoot(join(path, entry.name));
    }
    return directoryCreatedByTest ? 'created-by-this-run' : 'empty-directories-created-by-isolated-runtime';
}

const accountFor = (key: 'alice' | 'bob') => {
    const account = accounts[key];
    if (!account) throw new Error(`测试账户 ${key} 未成功建立`);
    return account;
};

const errorDetails = (error: unknown) => ({
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : String(error),
});

const markFailed = async (chain: Chain, error: unknown) => {
    const details = errorDetails(error);
    chain.status = 'FAILED';
    chain.failure = { ...details, completedStepIds: chain.steps.map(step => step.id) };
    chain.outcome = `FAILED: ${details.message}; 已完成步骤: ${chain.steps.map(step => step.id).join(', ') || '无'}`;
    await saveRunLog();
};

test.beforeAll(async () => {
    if (!/^[a-z0-9-]{1,48}$/.test(ISOLATION_ID) || !/^[a-zA-Z0-9-]{1,80}$/.test(RUN_ID)) {
        throw new Error('本 E2E 需要显式且安全格式的 PLATFORM_E2E_ISOLATION_ID 与 PLATFORM_E2E_RUN_ID');
    }
    const mongoUri = process.env.MONGO_URI?.trim();
    const expectedDatabase = `boardgame_home_acceptance_${ISOLATION_ID}`;
    const mongoMatch = mongoUri?.match(/^mongodb:\/\/127\.0\.0\.1:(\d+)\/([^/?]+)(?:\?.*)?$/);
    if (!mongoMatch || mongoMatch[2] !== expectedDatabase) {
        throw new Error(`本 E2E 只接受 127.0.0.1 独立数据库 URI，目标库必须为 ${expectedDatabase}`);
    }
    if (process.env.UGC_STORAGE_MODE !== 'local' || resolve(process.env.UGC_LOCAL_PATH ?? '') !== resolve(expectedUgcRoot)) {
        throw new Error(`本 E2E 需要 UGC_STORAGE_MODE=local 和任务专属目录 ${expectedUgcRoot}`);
    }
    storageRootPreparation = await prepareIsolatedStorageRoot(isolationFolder);
    storageRootIsolated = true;
    isolationEvidence = { id: ISOLATION_ID, mongoHost: `127.0.0.1:${mongoMatch[1]}`, mongoDatabase: mongoMatch[2], storageMode: 'local', storageRoot: resolve(expectedUgcRoot) };
    await mkdir(EVIDENCE_DIR, { recursive: true });
    fixtureConnection = mongoose.createConnection(mongoUri);
    await fixtureConnection.asPromise();
    // Derive the default Mongoose collection names without importing Nest-decorated
    // API schemas into Playwright's test transpiler.
    settingsCollectionName = fixtureConnection.model('UserUISettings', new mongoose.Schema({})).collection.name;
    submissionCollectionName = fixtureConnection.model('GameSubmission', new mongoose.Schema({})).collection.name;
    databaseBeforeSeeds = {
        users: await fixtureConnection.collection('users').countDocuments({}),
        settings: await fixtureConnection.collection(settingsCollectionName).countDocuments({}),
        submissions: await fixtureConnection.collection(submissionCollectionName).countDocuments({}),
    };
    if (Object.values(databaseBeforeSeeds).some(count => count !== 0)) {
        throw new Error(`本轮专属数据库在 seed 前并非空库: ${JSON.stringify(databaseBeforeSeeds)}`);
    }
    const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
    const aliceEmail = `ui-alice-${suffix}@example.invalid`;
    const bobEmail = `ui-bob-${suffix}@example.invalid`;
    const aliceName = `ui-alice-${suffix.slice(0, 6)}`;
    const bobName = `ui-bob-${suffix.slice(0, 6)}`;
    const now = new Date();
    const seedUser = async (username: string, email: string) => {
        const _id = new Types.ObjectId();
        seededUserIds.push(String(_id));
        await fixtureConnection!.collection('users').insertOne({
            _id, username, email, password: await bcrypt.hash(PASSWORD, 10), emailVerified: true,
            role: 'user', developerGameIds: [], banned: false, bannedAt: null, bannedReason: null,
            feedbackPoints: 0, createdAt: now, updatedAt: now,
        });
        return _id;
    };
    const aliceId = await seedUser(aliceName, aliceEmail);
    accounts.alice = { email: aliceEmail, username: aliceName, id: String(aliceId) };
    const bobId = await seedUser(bobName, bobEmail);
    accounts.bob = { email: bobEmail, username: bobName, id: String(bobId) };
    await saveRunLog();
});

test.afterAll(async () => {
    const cleanupErrors: string[] = [];
    const recordCleanup = async (name: string, action: () => Promise<unknown>) => {
        try { cleanupEvidence[name] = await action(); }
        catch (error) { cleanupErrors.push(`${name}: ${errorDetails(error).message}`); }
    };
    const userObjectIds = seededUserIds.map(id => new Types.ObjectId(id));
    if (fixtureConnection) {
        if (settingsCollectionName) await recordCleanup('settings', async () => (await fixtureConnection!.collection(settingsCollectionName).deleteMany({ userId: { $in: userObjectIds } })).deletedCount);
        if (submissionCollectionName) await recordCleanup('submissions', async () => (await fixtureConnection!.collection(submissionCollectionName).deleteMany({
            $or: [{ ownerId: { $in: seededUserIds } }, { submissionId: { $in: createdSubmissionIds } }],
        })).deletedCount);
        await recordCleanup('users', async () => (await fixtureConnection!.collection('users').deleteMany({ _id: { $in: userObjectIds } })).deletedCount);
    }
    if (storageRootIsolated) await recordCleanup('isolatedStorageRootRemoved', async () => { await rm(isolationFolder, { recursive: true, force: true }); return true; });
    if (fixtureConnection) await recordCleanup('fixtureConnectionClosed', async () => { await fixtureConnection!.close(); return true; });
    if (cleanupErrors.length) cleanupEvidence.errors = cleanupErrors;
    await saveRunLog();
    if (cleanupErrors.length) throw new Error(`清理本轮测试资源失败: ${cleanupErrors.join('; ')}`);
});

async function saveRunLog() {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const actionLog = {
        version: 1,
        runId: RUN_ID,
        gameId: 'home',
        evidenceCategory: 'independent',
        sourceRevision: SOURCE_REVISION,
        runtime: 'project Playwright E2E + local API + loopback Mongo + local UGC storage',
        isolation: isolationEvidence,
        storageRootPreparation,
        databaseBeforeSeeds,
        accountProvisioning: '项目 E2E fixture 直接建立合成测试账户；本次未测试注册流程',
        sourceFiles: sourceFileDigests,
        assetContracts: { betrayalCover: { path: BETRAYAL_COVER_PATH, sha256: BETRAYAL_COVER_SHA256 }, fateCover: { path: `/${FATE_COVER_PATH.replace(/^public\//, '')}`, sha256: 'cdd4622798e0498832312424a4d67e8fb1361219b547bdcbcc524e9a0ddc7748' } },
        cleanup: cleanupEvidence,
        accounts: Object.fromEntries(Object.entries(accounts).filter((entry): entry is [string, Account] => Boolean(entry[1])).map(([key, account]) => [key, { username: account.username, id: account.id }])),
        chains,
        media,
    };
    await writeFile(join(EVIDENCE_DIR, '浏览器动作日志.json'), `${JSON.stringify(actionLog, null, 2)}\n`);
    for (const chain of chains) {
        const trace = {
            version: 1,
            gameId: 'home',
            evidenceCategory: 'independent',
            chainId: chain.chainId,
            sourceRun: chain.sourceRun,
            sourceRevision: chain.sourceRevision,
            status: chain.status,
            outcome: chain.outcome,
            ...(chain.failure ? { failure: chain.failure } : {}),
            steps: chain.steps,
            uiStates: chain.uiStates,
        };
        await writeFile(join(EVIDENCE_DIR, chain.evidenceFile), `${JSON.stringify(trace, null, 2)}\n`);
    }
}

async function login(page: Page, account: Account) {
    await page.getByRole('button', { name: '登录' }).first().click();
    await page.getByTestId('auth-login-account-input').fill(account.email);
    await page.getByTestId('auth-login-password-input').fill(PASSWORD);
    const loginResponsePromise = page.waitForResponse(response => response.url().includes('/auth/login') && response.request().method() === 'POST');
    await page.getByTestId('auth-submit-button').click();
    const response = await loginResponsePromise;
    expect(response.ok(), `账户登录 HTTP ${response.status()}`).toBe(true);
    const body = await response.json();
    expect(body.success).toBe(true);
    await expect(page.getByRole('button', { name: '收藏库' })).toBeVisible();
    const token = body.data?.token as string;
    expect(token, '登录响应包含合成账户访问令牌').toBeTruthy();
    return { status: response.status(), userId: body.data?.user?.id as string, token };
}

async function newPage(browser: Browser, baseURL?: string): Promise<{ context: BrowserContext; page: Page }> {
    if (!baseURL) throw new Error('本 E2E 缺少 Playwright 配置的测试 baseURL');
    const parsedBaseURL = new URL(baseURL);
    const assignedTestPort = process.env.PW_PORT?.trim();
    const expectedTestPort = assignedTestPort || String(E2E_SINGLE_WORKER_PORTS.frontend);
    if (
        parsedBaseURL.protocol !== 'http:'
        || !['127.0.0.1', 'localhost'].includes(parsedBaseURL.hostname)
        || parsedBaseURL.port !== expectedTestPort
        || parsedBaseURL.username
        || parsedBaseURL.password
        || parsedBaseURL.pathname !== '/'
        || parsedBaseURL.search
        || parsedBaseURL.hash
    ) {
        throw new Error(`本 E2E 仅接受项目分配的本地测试入口，收到 ${parsedBaseURL.origin}`);
    }
    const context = await browser.newContext({ baseURL: parsedBaseURL.origin, viewport: { width: 1920, height: 1080 } });
    try {
        await context.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
        const page = await context.newPage();
        await page.goto('/');
        await expect(page.getByRole('button', { name: '收藏：山屋惊魂' })).toBeVisible({ timeout: 15_000 });
        return { context, page };
    } catch (error) {
        await context.close().catch(() => undefined);
        throw error;
    }
}

async function readSubmissionList(page: Page, token: string) {
    const endpoint = new URL('/ugc/submissions', page.url()).toString();
    const response = await page.request.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status(), `投稿列表前态 HTTP ${response.status()}`).toBe(200);
    return { status: response.status(), body: await response.json() as { items: Array<Record<string, any>> } };
}

async function readLoadedBetrayalImage(page: Page) {
    const image = page.locator('.platform-game-card[data-game-id="betrayal"] .platform-game-art img').first();
    await expect(image).toBeAttached();
    await image.scrollIntoViewIfNeeded();
    await expect.poll(async () => image.evaluate(node => ({
        complete: (node as HTMLImageElement).complete,
        naturalWidth: (node as HTMLImageElement).naturalWidth,
        naturalHeight: (node as HTMLImageElement).naturalHeight,
    })), { timeout: 20_000 }).toMatchObject({ complete: true });
    const dom = await image.evaluate(node => {
        const item = node as HTMLImageElement;
        return { complete: item.complete, naturalWidth: item.naturalWidth, naturalHeight: item.naturalHeight };
    });
    expect(dom.naturalWidth).toBeGreaterThan(0);
    expect(dom.naturalHeight).toBeGreaterThan(0);
    const sourcePath = await image.getAttribute('data-debug-current-src');
    expect(sourcePath, '页面应显示登记的山屋惊魂正式封面路径').toBe(BETRAYAL_COVER_PATH);
    const assetResponse = await page.request.get(new URL(sourcePath!, page.url()).toString());
    const body = await assetResponse.body();
    const metadata = await sharp(body).metadata();
    const officialAsset: LocalImageObservation = {
        urlPath: sourcePath!,
        status: assetResponse.status(),
        contentType: assetResponse.headers()['content-type'] ?? null,
        bytes: body.length,
        sha256: createHash('sha256').update(body).digest('hex'),
        width: metadata.width,
        height: metadata.height,
    };
    expect(officialAsset.status).toBe(200);
    expect(officialAsset.sha256).toBe(BETRAYAL_COVER_SHA256);
    expect(officialAsset?.contentType).toContain('image/webp');
    return { ...dom, sourcePath, response: officialAsset };
}

async function capture(page: Page, id: string, filename: string, stepId: string, uiChange: string, description: string) {
    const path = join(EVIDENCE_DIR, filename);
    await page.screenshot({ path, fullPage: true });
    const bytes = await readFile(path);
    const entry: Media = { id, path: filename, sha256: createHash('sha256').update(bytes).digest('hex'), behaviorStepId: stepId, uiChange, description };
    media.push(entry);
    const chain = chains.find(item => item.steps.some(step => step.id === stepId));
    if (chain) chain.uiStates.push({ id, stepId, change: uiChange, viewport: 'desktop', sha256: entry.sha256 });
    await saveRunLog();
}

test('账户收藏写入服务端、刷新保留且账户互相隔离', async ({ browser }, testInfo) => {
    testInfo.setTimeout(60_000);
    const chain: Chain = { chainId: `library-${RUN_ID}`, sourceRun: RUN_ID, sourceRevision: SOURCE_REVISION, evidenceFile: '收藏链行为追踪.json', status: 'IN_PROGRESS', outcome: '', steps: [], uiStates: [] };
    chains.push(chain);
    let firstAccountGameIds: string[] = [];
    try {
        const alice = accountFor('alice');
        const first = await newPage(browser, testInfo.project.use.baseURL as string | undefined);
        try {
            const loginResult = await login(first.page, alice);
            const favorite = first.page.getByRole('button', { name: '收藏：山屋惊魂' });
            const favoritePressedBefore = await favorite.getAttribute('aria-pressed');
            expect(favoritePressedBefore).toBe('false');
            const saveResponsePromise = first.page.waitForResponse(response => response.url().includes('/auth/user-settings/library') && response.request().method() === 'PUT');
            await favorite.click();
            const saveResponse = await saveResponsePromise;
            expect(saveResponse.status()).toBe(200);
            const savedLibrary = await saveResponse.json();
            expect(savedLibrary.gameIds).toEqual(['betrayal']);
            firstAccountGameIds = savedLibrary.gameIds;
            await expect(first.page.getByRole('button', { name: '移出收藏：山屋惊魂' })).toHaveAttribute('aria-pressed', 'true');
            await first.page.getByTestId('user-menu-trigger').click();
            await first.page.getByTestId('user-menu-profile').click();
            await expect(first.page.getByTestId('profile-page')).toBeVisible();
            const favoriteCount = first.page.getByTestId('profile-rail').locator('dl div').filter({ hasText: '收藏' }).locator('dd');
            await expect(favoriteCount).toHaveText('1');
            chain.steps.push({ id: 'favorite-write', action: '登录账户甲后收藏山屋惊魂并查看个人中心计数', before: { visible: { favoritePressed: favoritePressedBefore === 'true' }, authoritative: { accountId: loginResult.userId } }, after: { visible: { favoritePressed: true, profileVisible: true, favoriteCount: '1' }, authoritative: { httpStatus: saveResponse.status(), gameIds: savedLibrary.gameIds } }, assertions: [{ name: '收藏接口写入账户集合', actual: savedLibrary.gameIds, expected: ['betrayal'] }, { name: '个人中心显示已收藏数量', actual: await favoriteCount.innerText(), expected: '1' }] });
            await capture(first.page, 'favorite-saved', '账户甲收藏计数为一.png', 'favorite-write', 'panel', '个人中心显示账户甲已收藏一款游戏');

            await first.page.getByRole('button', { name: '收藏库' }).click();
            await expect(first.page.getByRole('button', { name: '山屋惊魂', exact: true })).toBeVisible();
            const refreshReadPromise = first.page.waitForResponse(response => response.url().includes('/auth/user-settings/library') && response.request().method() === 'GET');
            await first.page.reload();
            const refreshRead = await refreshReadPromise;
            const refreshedBody = await refreshRead.json();
            expect(refreshedBody.gameIds).toEqual(['betrayal']);
            await expect(first.page.getByRole('button', { name: '山屋惊魂', exact: true })).toBeVisible();
            const betrayalImage = await readLoadedBetrayalImage(first.page);
            chain.steps.push({ id: 'favorite-refresh-read', action: '刷新后打开收藏库核对服务器读回并等待山屋惊魂封面真实加载', before: { visible: { selectedSection: 'library' }, authoritative: { favoritePutGameIds: savedLibrary.gameIds } }, after: { visible: { savedGameCardVisible: true, betrayalImageComplete: betrayalImage.complete, naturalWidth: betrayalImage.naturalWidth, naturalHeight: betrayalImage.naturalHeight }, authoritative: { httpStatus: refreshRead.status(), gameIds: refreshedBody.gameIds, image: betrayalImage.response } }, assertions: [{ name: '刷新后账户收藏不丢失', actual: refreshedBody.gameIds, expected: ['betrayal'] }, { name: '山屋惊魂封面完整加载且来源与正式资源一致', actual: betrayalImage.response, expected: { urlPath: BETRAYAL_COVER_PATH, status: 200, contentType: 'image/webp', bytes: 120262, sha256: BETRAYAL_COVER_SHA256, width: 1795, height: 350 } }, { name: '山屋惊魂封面具有有效 DOM 尺寸', actual: { complete: betrayalImage.complete, naturalWidthValid: betrayalImage.naturalWidth > 0, naturalHeightValid: betrayalImage.naturalHeight > 0 }, expected: { complete: true, naturalWidthValid: true, naturalHeightValid: true } }] });
            await capture(first.page, 'library-after-refresh', '刷新后账户甲收藏库.png', 'favorite-refresh-read', 'panel', '刷新后收藏库显示完整加载的山屋惊魂封面');
        } finally {
            await first.context.close();
        }

        const bob = accountFor('bob');
        const second = await newPage(browser, testInfo.project.use.baseURL as string | undefined);
        try {
            const isolatedReadPromise = second.page.waitForResponse(response => response.url().includes('/auth/user-settings/library') && response.request().method() === 'GET');
            const loginResult = await login(second.page, bob);
            const isolatedRead = await isolatedReadPromise;
            const isolatedBody = await isolatedRead.json();
            await second.page.getByRole('button', { name: '收藏库' }).click();
            expect(isolatedBody.gameIds).toEqual([]);
            await expect(second.page.getByText('还没有收藏游戏，去发现页点星标添加')).toBeVisible();
            await expect(second.page.getByRole('button', { name: '山屋惊魂', exact: true })).toHaveCount(0);
            chain.steps.push({ id: 'account-isolation', action: '账户乙打开收藏库检查隔离', before: { visible: { secondAccount: loginResult.userId }, authoritative: { firstAccountGameIds } }, after: { visible: { emptyLibraryMessageVisible: true }, authoritative: { httpStatus: isolatedRead.status(), gameIds: isolatedBody.gameIds } }, assertions: [{ name: '账户乙无法读取账户甲收藏', actual: isolatedBody.gameIds, expected: [] }] });
            await capture(second.page, 'second-account-empty', '账户乙独立空收藏库.png', 'account-isolation', 'empty', '账户乙的独立收藏库保持空白');
        } finally {
            await second.context.close();
        }
        chain.status = 'PASS';
        chain.outcome = '账户甲的收藏经过服务端保存、刷新后读回，真实山屋惊魂封面加载；账户乙收藏列表独立为空';
        await saveRunLog();
    } catch (error) {
        await markFailed(chain, error);
        throw error;
    }
});

test('外部投稿创建、编辑、上传图片、送审和列表读回并显示失败反馈', async ({ browser }, testInfo) => {
    testInfo.setTimeout(60_000);
    const chain: Chain = { chainId: `submission-${RUN_ID}`, sourceRun: RUN_ID, sourceRevision: SOURCE_REVISION, evidenceFile: '投稿链行为追踪.json', status: 'IN_PROGRESS', outcome: '', steps: [], uiStates: [] };
    chains.push(chain);
    try {
        const alice = accountFor('alice');
        const { context, page } = await newPage(browser, testInfo.project.use.baseURL as string | undefined);
        try {
            const loginResult = await login(page, alice);
            const initialList = await readSubmissionList(page, loginResult.token);
            expect(initialList.body.items).toEqual([]);
            await page.getByRole('button', { name: '上传' }).click();
            await expect(page.getByRole('heading', { name: '上传新游戏' })).toBeVisible();
            const title = `合成桌游投稿-${RUN_ID.slice(-6)}`;
            const editedTitle = `${title}-已修改`;
            const fillDraft = async (name: string, description: string) => {
                await page.locator('input[name="name"]').fill(name);
                await page.locator('input[name="url"]').fill('https://example.com/synthetic-boardgame');
                await page.locator('select[name="minPlayers"]').selectOption('2');
                await page.locator('select[name="maxPlayers"]').selectOption('4');
                await page.locator('input[name="durationMinutes"]').fill('20');
                await page.locator('input[name="author"]').fill('合成测试作者');
                await page.locator('textarea[name="description"]').fill(description);
                await page.locator('textarea[name="rules"]').fill('合成测试规则，不含真实投稿内容。');
            };
            await fillDraft(title, '第一次保存的合成介绍');
            await page.locator('input[type="file"]').setInputFiles({ name: '损坏封面.png', mimeType: 'image/png', buffer: Buffer.from('synthetic invalid image bytes') });
            const createResponsePromise = page.waitForResponse(response => response.url().endsWith('/ugc/submissions') && response.request().method() === 'POST');
            const invalidUploadResponsePromise = page.waitForResponse(response => /\/ugc\/submissions\/[^/]+\/cover$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
            await page.getByRole('button', { name: '提交审核' }).click();
            const [createResponse, invalidUploadResponse] = await Promise.all([createResponsePromise, invalidUploadResponsePromise]);
            const createdDraft = await createResponse.json();
            const id = createdDraft.submissionId as string;
            if (id) createdSubmissionIds.push(id);
            expect(createResponse.status()).toBe(201);
            expect(invalidUploadResponse.status()).toBe(400);
            expect(createdDraft.status).toBe('draft');
            await expect(page.getByRole('alert')).toContainText('封面不是可读取的图片');
            chain.steps.push({ id: 'draft-and-image-error', action: '首次保存投稿草稿并上传损坏图片', before: { visible: { form: '填写初稿和损坏图片' }, authoritative: { listHttpStatus: initialList.status, submissionCount: initialList.body.items.length } }, after: { visible: { errorVisible: await page.getByRole('alert').innerText() }, authoritative: { draftHttpStatus: createResponse.status(), draftId: id, uploadHttpStatus: invalidUploadResponse.status(), status: createdDraft.status } }, assertions: [{ name: '上传错误反馈可见且草稿已创建', actual: { status: createdDraft.status, uploadStatus: invalidUploadResponse.status() }, expected: { status: 'draft', uploadStatus: 400 } }] });
            await capture(page, 'upload-error', '图片校验失败反馈.png', 'draft-and-image-error', 'error', '损坏图片被拒绝并显示错误反馈');

            await fillDraft(editedTitle, '修订后的介绍已保存到投稿');
            const cover = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#346789' } }).png().toBuffer();
            await page.locator('input[type="file"]').setInputFiles({ name: '合成封面.png', mimeType: 'image/png', buffer: cover });
            const beforeEditList = await readSubmissionList(page, loginResult.token);
            const draftBeforeEdit = beforeEditList.body.items.find(item => item.submissionId === id);
            expect(draftBeforeEdit).toMatchObject({ submissionId: id, name: title, status: 'draft' });
            const updateResponsePromise = page.waitForResponse(response => response.url().endsWith(`/ugc/submissions/${id}`) && response.request().method() === 'PUT');
            const validUploadResponsePromise = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/ugc/submissions/${id}/cover`) && response.request().method() === 'POST');
            const submitResponsePromise = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/ugc/submissions/${id}/submit`) && response.request().method() === 'POST');
            const listReadResponsePromise = page.waitForResponse(response => response.url().endsWith('/ugc/submissions') && response.request().method() === 'GET');
            await page.getByRole('button', { name: '提交审核' }).click();
            const [updateResponse, validUploadResponse, submitResponse, listReadResponse] = await Promise.all([updateResponsePromise, validUploadResponsePromise, submitResponsePromise, listReadResponsePromise]);
            expect(updateResponse.status()).toBe(200);
            expect(validUploadResponse.status()).toBe(201);
            expect(submitResponse.status()).toBe(201);
            expect(listReadResponse.status()).toBe(200);
            const updatedDraft = await updateResponse.json();
            const uploadedCover = await validUploadResponse.json();
            const submitted = await submitResponse.json();
            const list = await listReadResponse.json();
            expect(updatedDraft.name).toBe(editedTitle);
            expect(submitted).toMatchObject({ submissionId: id, name: editedTitle, description: '修订后的介绍已保存到投稿', status: 'pending', coverUrl: uploadedCover.coverUrl });
            const listed = list.items.find((item: { submissionId: string }) => item.submissionId === id);
            expect(listed).toMatchObject({ submissionId: id, name: editedTitle, description: '修订后的介绍已保存到投稿', status: 'pending', coverUrl: uploadedCover.coverUrl });
            const storedImagePath = join(process.env.UGC_LOCAL_PATH!, 'ugc', alice.id, `submission-${id}`, 'cover.webp');
            const storedBytes = await readFile(storedImagePath);
            expect((await sharp(storedBytes).metadata()).format).toBe('webp');
            await expect(page.getByRole('status').filter({ hasText: '待审核' }).first()).toBeVisible();
            await expect.poll(async () => page.getByAltText('投稿封面预览').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
            await expect(page.getByRole('button', { name: new RegExp(`${editedTitle}.*待审核`) })).toBeVisible();
            const coverPreviewLoaded = await page.getByAltText('投稿封面预览').evaluate(image => (image as HTMLImageElement).naturalWidth > 0);
            const coverFileNonEmpty = storedBytes.length > 0;
            chain.steps.push({ id: 'edit-upload-submit-readback', action: '编辑草稿、上传合成封面、送审并从列表读回', before: { visible: { editedName: editedTitle }, authoritative: { listHttpStatus: beforeEditList.status, draftId: id, name: draftBeforeEdit?.name, status: draftBeforeEdit?.status } }, after: { visible: { pendingListItemVisible: true, coverPreviewLoaded }, authoritative: { updateStatus: updateResponse.status(), uploadStatus: validUploadResponse.status(), submitStatus: submitResponse.status(), listReadStatus: listReadResponse.status(), listed, storedImagePath, storedImageBytes: storedBytes.length, imageFormat: 'webp' } }, assertions: [{ name: '服务端列表读回修订内容和待审核状态', actual: { name: listed.name, status: listed.status, coverUrl: listed.coverUrl }, expected: { name: editedTitle, status: 'pending', coverUrl: uploadedCover.coverUrl } }, { name: '送审前接口仍读回草稿状态', actual: { name: draftBeforeEdit?.name, status: draftBeforeEdit?.status }, expected: { name: title, status: 'draft' } }, { name: '浏览器封面预览已加载且本地隔离存储有 WebP', actual: { previewLoaded: coverPreviewLoaded, format: 'webp', fileNonEmpty: coverFileNonEmpty }, expected: { previewLoaded: true, format: 'webp', fileNonEmpty: true } }] });
            await capture(page, 'submission-pending-readback', '修订后待审核列表读回.png', 'edit-upload-submit-readback', 'panel', '修订投稿及真实封面进入待审核列表');
        } finally {
            await context.close();
        }
        chain.status = 'PASS';
        chain.outcome = '隔离合成账户建立投稿草稿、编辑与真实图片上传，服务端读回后成功送审；无效图片反馈已验证';
        await saveRunLog();
    } catch (error) {
        await markFailed(chain, error);
        throw error;
    }
});

test('收藏库山屋惊魂完整显示正式宽幅封面', async ({ browser }, testInfo) => {
    testInfo.setTimeout(45_000);
    const chain: Chain = {
        chainId: `betrayal-cover-${RUN_ID}`,
        sourceRun: RUN_ID,
        sourceRevision: SOURCE_REVISION,
        evidenceFile: '封面显示行为追踪.json',
        status: 'IN_PROGRESS',
        outcome: '',
        steps: [],
        uiStates: [],
    };
    chains.push(chain);
    try {
        const alice = accountFor('alice');
        const aliceUserId = new Types.ObjectId(alice.id);
        const favoriteSeedTime = new Date();
        await fixtureConnection!.collection(settingsCollectionName).updateOne(
            { userId: aliceUserId },
            { $set: { favoriteGameIds: ['betrayal'], updatedAt: favoriteSeedTime }, $setOnInsert: { createdAt: favoriteSeedTime } },
            { upsert: true },
        );
        const { context, page } = await newPage(browser, testInfo.project.use.baseURL as string | undefined);
        try {
            const loginResult = await login(page, alice);
            await page.getByRole('button', { name: '收藏库' }).click();
            const card = page.locator('.platform-game-card[data-game-id="betrayal"]');
            await expect(card).toBeVisible();
            const image = card.locator('.platform-game-art img').first();
            const asset = await readLoadedBetrayalImage(page);
            const thumbnails = page.locator('.betrayal-game-thumbnail img');
            await expect.poll(async () => thumbnails.evaluateAll(images => images.length >= 2 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
            const thumbnailFits = await thumbnails.evaluateAll(images => images.map(image => getComputedStyle(image).objectFit));
            const presentation = await image.evaluate(node => {
                const image = node as HTMLImageElement;
                const rect = image.closest('.platform-game-art')!.getBoundingClientRect();
                return {
                    objectFit: getComputedStyle(image).objectFit,
                    artWidth: Math.round(rect.width),
                    artHeight: Math.round(rect.height),
                    cardTitle: image.closest('.platform-game-card')?.querySelector('.platform-game-copy strong')?.textContent?.trim() ?? '',
                };
            });
            expect(thumbnailFits).toEqual(['contain', 'contain']);
            expect(presentation.objectFit).toBe('contain');
            expect(presentation.artWidth).toBeGreaterThan(0);
            expect(presentation.artHeight).toBeGreaterThan(presentation.artWidth);
            expect(presentation.cardTitle).toBe('山屋惊魂');
            chain.steps.push({
                id: 'official-cover-visible',
                action: '登录合成账户并打开已有收藏库，核对山屋惊魂宽幅封面完整显示',
                before: { visible: { selectedSection: 'discover' }, authoritative: { accountId: loginResult.userId, fixtureFavoriteGameIds: ['betrayal'] } },
                after: { visible: { cardTitle: presentation.cardTitle, imageLoaded: asset.complete, objectFit: presentation.objectFit, artWidth: presentation.artWidth, artHeight: presentation.artHeight }, authoritative: { image: asset.response } },
                assertions: [
                    { name: '正式封面来源字节与 manifest 登记一致', actual: asset.response, expected: { urlPath: BETRAYAL_COVER_PATH, status: 200, contentType: 'image/webp', bytes: 120262, sha256: BETRAYAL_COVER_SHA256, width: 1795, height: 350 } },
                    { name: '宽幅封面在卡片和侧栏均按完整比例显示且卡片尺寸不变', actual: { thumbnailFits, artWidthGreaterThanZero: presentation.artWidth > 0, artHeightGreaterThanWidth: presentation.artHeight > presentation.artWidth, cardTitle: presentation.cardTitle }, expected: { thumbnailFits: ['contain', 'contain'], artWidthGreaterThanZero: true, artHeightGreaterThanWidth: true, cardTitle: '山屋惊魂' } },
                ],
            });
            await capture(page, 'betrayal-cover-contained', '山屋惊魂封面完整可读.png', 'official-cover-visible', 'panel', '收藏卡片完整显示山屋惊魂宽幅封面');
        } finally {
            await context.close();
        }
        chain.status = 'PASS';
        chain.outcome = '真实收藏卡片以原比例完整显示山屋惊魂宽幅正式封面，封面字节与登记哈希一致';
        await saveRunLog();
    } catch (error) {
        await markFailed(chain, error);
        throw error;
    }
});
