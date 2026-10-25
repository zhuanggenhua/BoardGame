import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const password = 'synthetic-home-acceptance-248';
const generatedAvatarUrls = new Set<string>();
export function rememberAvatarUpload(url: string) {
    if (!/^\/assets\/avatars\/[a-f0-9]{24}-\d+\.webp$/.test(url)) throw new Error('只登记本地合成账户的头像文件');
    generatedAvatarUrls.add(url);
}
async function cleanGeneratedAvatars(db: mongoose.Connection, ids: Types.ObjectId[]) {
    const owned = new Set(ids.map(String));
    for (const url of generatedAvatarUrls) {
        const name = url.slice('/assets/avatars/'.length);
        if (!owned.has(name.slice(0, 24))) throw new Error('不能清理不属于本轮账户的头像');
        if (await db.collection('users').countDocuments({ avatar: url })) throw new Error('头像仍被账户引用，保留文件');
        // 默认/预设切换后旧上传已不在user.avatar中，仍按确切创建记录清理；不扫描目录。
        await unlink(join(process.cwd(), 'uploads/avatars', name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
    generatedAvatarUrls.clear();
}
export const runId = process.env.PLATFORM_E2E_RUN_ID!;
export const evidenceDir = join(process.cwd(), 'test-results/evidence-screenshots/_temporary/home/正式首页验收', runId || 'missing-run');
const sourcePaths = ['src/pages/Home.tsx', 'src/pages/HomeEntry.tsx', 'src/components/home/ClassicHomeSurface.tsx', 'src/components/home/HomeStyleSettings.tsx', 'src/components/home/home-style-settings.css', 'src/components/home/PlatformHomeSurface.tsx', 'src/lib/homeV2Routing.ts', 'src/engine/transport/useGameProviderRuntime.ts', 'e2e/helpers/homeAcceptance.ts', 'e2e/home-style-preference.e2e.ts', 'e2e/home-catalog-acceptance.e2e.ts', 'e2e/home-room-entry.e2e.ts', 'e2e/home-profile-routes.e2e.ts'];
sourcePaths.push('src/components/system/AuthorSupport.tsx', 'src/components/system/author-support.css', 'src/components/home/platform-catalog.css', 'e2e/home-user-corrections.e2e.ts', 'src/components/home/PlatformUploadWorkspace.tsx', 'src/components/home/PlatformGameCatalog.tsx', 'e2e/home-utility-acceptance.e2e.ts');
sourcePaths.push('src/components/system/GlobalHUD.tsx', 'src/components/system/PlatformAudioSettings.tsx', 'src/components/system/global-hud.css', 'src/components/common/media/OptimizedImage.tsx', 'src/components/lobby/GameDetailsModal.tsx', 'src/components/home/PlatformGameDetails.tsx', 'src/components/home/platform-details.css', 'src/components/home/PlatformNavigation.tsx', 'src/components/home/platform-navigation.css');
sourcePaths.push('src/components/home/platform-home.css', 'src/components/system/FabMenu.tsx', 'src/components/system/useHomeHudClearance.ts', 'e2e/home-cover-lifecycle.e2e.ts', 'scripts/infra/run-home-acceptance.mjs');
sourcePaths.push('e2e/home-mobile-entry.e2e.ts');
sourcePaths.push('e2e/home-floating-interactions.e2e.ts');
sourcePaths.push('src/components/home/platform-motion.css');
sourcePaths.push('public/manifest.webmanifest', 'android/app/src/main/AndroidManifest.xml');
sourcePaths.push('src/components/common/MobileOrientationGuard.tsx', 'src/index.css', 'public/locales/zh-CN/common.json', 'public/locales/en/common.json');
sourcePaths.push('public/locales/zh-CN/game.json', 'public/locales/en/game.json');
sourcePaths.push('e2e/home-detail-dialogs.e2e.ts', 'src/components/home/PlatformFavoriteButton.tsx', 'src/components/home/platform-secondary-dialogs.css');
sourcePaths.push('src/components/auth/AccountSettingsModal.tsx', 'src/components/auth/AvatarUpdateModal.tsx', 'src/components/auth/EmailBindModal.tsx', 'src/components/social/FriendsChatModal.tsx', 'src/components/social/MyFeedbackModal.tsx', 'src/components/system/FeedbackModal.tsx', 'src/components/system/AboutModal.tsx', 'src/components/settings/CursorSettingsModal.tsx', 'src/components/common/overlays/ConfirmModal.tsx', 'src/components/common/overlays/PasswordEntryModal.tsx');
sourcePaths.push('src/components/social/MatchHistoryModal.tsx');
sourcePaths.push('e2e/home-room-capacity.e2e.ts');
sourcePaths.push('e2e/home-avatar-selection.e2e.ts', 'src/lib/avatarPresets.ts', 'src/components/auth/avatar-update.css', 'src/components/home/PlatformProfile.tsx', 'src/components/home/platform-profile.css', 'public/locales/zh-CN/auth.json', 'public/locales/en/auth.json');
sourcePaths.push(...readdirSync('public/avatars').filter(name => name.endsWith('.svg')).map(name => `public/avatars/${name}`));
const sourceHash = createHash('sha256');
for (const path of sourcePaths) sourceHash.update(path).update(readFileSync(path));
const sourceRevision = `${execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()}:${sourceHash.digest('hex')}`;
type Snapshot = { url: string; style: string | null; headings: string[] };
type CapturedState = { id: string; path: string; sha256: string; viewport: string; snapshot: Snapshot };
const runs = new Map<string, { initial?: Snapshot; states: CapturedState[]; results: Record<string, unknown> }>();
const currentRun = () => {
    const id = base.info().title;
    if (!runs.has(id)) runs.set(id, { states: [], results: {} });
    return runs.get(id)!;
};
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => ({ url: location.pathname + location.search, style: document.documentElement.getAttribute('data-home-entry-style'), headings: [...document.querySelectorAll('h1,h2')].map(node => node.textContent?.trim() || '').filter(Boolean) }));
type Account = { id: string; email: string; username: string };
export const test = base.extend<{ homeEvidence: void }, { accounts: { alice: Account; bob: Account } }>({
    homeEvidence: [async ({ browserName: _browserName }, use, info) => {
        await use();
        await flushRun(info);
    }, { auto: true }],
    accounts: [async ({ browserName: _browserName }, provideAccounts) => {
        const isolation = process.env.PLATFORM_E2E_ISOLATION_ID;
        const uri = process.env.MONGO_URI;
        if (!isolation || !/^[a-z0-9-]+$/.test(isolation) || !runId
            || uri !== `mongodb://127.0.0.1:37022/boardgame_home_acceptance_${isolation}`) {
            throw new Error('首页验收必须使用 37022 端口及本轮唯一数据库');
        }
        const db = await mongoose.createConnection(uri).asPromise();
        const ids: Types.ObjectId[] = [];
        try {
            expect(await db.collection('users').countDocuments()).toBe(0);
            const seed = async (label: string): Promise<Account> => {
                const _id = new Types.ObjectId(); ids.push(_id);
                const username = `home-${label}-${String(_id).slice(-6)}`;
                const email = `${username}@example.invalid`;
                await db.collection('users').insertOne({ _id, username, email, password: await bcrypt.hash(password, 10), emailVerified: true,
                    role: 'user', developerGameIds: [], banned: false, feedbackPoints: 0, createdAt: new Date(), updatedAt: new Date() });
                return { id: String(_id), username, email };
            };
            await provideAccounts({ alice: await seed('alice'), bob: await seed('bob') });
        } finally {
            const avatars = await db.collection('users').find({ _id: { $in: ids } }, { projection: { avatar: 1 } }).toArray();
            await db.collection('users').deleteMany({ _id: { $in: ids } });
            await db.collection('useruisettings').deleteMany({ userId: { $in: ids } });
            for (const user of avatars) {
                if (typeof user.avatar === 'string' && user.avatar.startsWith(`/assets/avatars/${String(user._id)}-`)) rememberAvatarUpload(user.avatar);
            }
            try { await cleanGeneratedAvatars(db, ids); } finally { await db.close(); }
        }
    }, { scope: 'worker' }],
});
export { expect };

async function flushRun(info: TestInfo) {
    const run = runs.get(info.title);
    if (!run) return;
    await mkdir(evidenceDir, { recursive: true });
    const passed = info.status === 'passed';
    const chainId = createHash('sha256').update(info.title).digest('hex').slice(0, 16);
    const steps = run.states.map((state, index) => ({
        id: state.id, action: state.id,
        before: { visible: index ? run.states[index - 1].snapshot : run.initial, authoritative: { sourceRevision, runId } },
        after: { visible: state.snapshot, authoritative: { sourceRevision, runId } },
        assertions: [{ name: '同源用例的全部行为断言通过', actual: info.status, expected: 'passed' }],
    }));
    steps.push({ id: 'complete', action: info.title, before: { visible: run.initial!, authoritative: { sourceRevision, runId } },
        after: { visible: run.states.at(-1)?.snapshot ?? run.initial!, authoritative: { sourceRevision, runId, results: run.results } },
        assertions: [{ name: '真实浏览器用例完成', actual: info.status, expected: 'passed' }] });
    await writeFile(join(evidenceDir, `${chainId}-行为链.json`), JSON.stringify({
        chainId, gameId: 'home', evidenceCategory: 'independent', sourceRun: runId, sourceRevision,
        status: passed ? 'PASS' : 'FAILED', outcome: info.title, steps,
        uiStates: run.states.map(state => ({ id: state.id, path: state.path, stepId: state.id, change: 'panel', viewport: state.viewport, sha256: state.sha256 })),
        testFile: info.file, testStatus: info.status, retries: info.retry, errors: info.errors.map(error => error.message),
    }, null, 2));
}

export async function initHome(page: Page) {
    await page.context().addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-home-entry-style', 'modern', { timeout: 20_000 });
    await expect(page.getByRole('button', { name: '井字棋', exact: true })).toBeVisible({ timeout: 15_000 });
    currentRun().initial ??= await snapshot(page);
}

export async function login(page: Page, account: Account) {
    await page.getByRole('button', { name: '登录', exact: true }).first().click();
    await page.getByTestId('auth-login-account-input').fill(account.email);
    await page.getByTestId('auth-login-password-input').fill(password);
    const pending = page.waitForResponse(r => r.url().includes('/auth/login') && r.request().method() === 'POST');
    await page.getByTestId('auth-submit-button').click();
    const response = await pending;
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data.user.id).toBe(account.id);
    await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
}

export async function settings(page: Page) {
    if (!await page.getByRole('radiogroup').isVisible()) await page.locator('[data-fab-id="settings"]').click();
    await expect(page.getByRole('radiogroup')).toBeVisible();
    await expect(page.getByTestId('fab-panel-settings').getByRole('slider')).toHaveCount(2);
}

export async function switchStyle(page: Page, style: 'modern' | 'classic', keyboard = false) {
    await settings(page);
    const option = page.getByTestId(`home-style-${style}`).filter({ visible: true });
    if (keyboard) { await option.focus(); await page.keyboard.press('Enter'); }
    else await option.click();
    await expect(page.locator('html')).toHaveAttribute('data-home-entry-style', style);
}

export async function openGame(page: Page, style: 'modern' | 'classic', id: string, title: string, touch = false) {
    const control = style === 'classic' ? page.locator(`[data-game-id="${id}"]`).first()
        : page.getByRole('button', { name: title, exact: true }).last();
    const activate = () => touch ? control.tap() : control.click();
    await activate();
    await expect(page.getByRole('button', { name: '创建房间', exact: true })).toBeVisible();
}

export async function capture(page: Page, name: string) {
    await mkdir(evidenceDir, { recursive: true });
    await page.evaluate(async () => { await document.fonts.ready; });
    await expect.poll(() => page.locator('img').evaluateAll(images => images.filter(image => {
        const rect = image.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < innerHeight && rect.width > 0 && rect.height > 0;
    }).every(image => (image as HTMLImageElement).complete)), { timeout: 15_000 }).toBe(true);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const path = join(evidenceDir, `${name}.png`);
    const bytes = await page.screenshot({ path, fullPage: false, animations: 'disabled' });
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    // 同一跑次只登记真正变化的画面；重复操作的行为断言仍由用例完整执行。
    const ledgerPath = join(evidenceDir, '截图去重账本.json');
    const ledger: Record<string, string> = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};
    if (ledger[sha256]) {
        await record(`${name}-重复画面`, { source: path, samePixelsAs: ledger[sha256], sha256 });
        return;
    }
    ledger[sha256] = path;
    await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
    const width = page.viewportSize()?.width ?? await page.evaluate(() => innerWidth);
    currentRun().states.push({ id: name, path, sha256, viewport: width < 1024 ? 'mobile' : 'desktop', snapshot: await snapshot(page) });
}

export async function record(name: string, details: unknown) {
    currentRun().results[name] = details;
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(join(evidenceDir, `${name}.json`), JSON.stringify(details, null, 2));
}
