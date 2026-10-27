import mongoose from 'mongoose';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test, expect, initHome, login, capture, record, sourceRevision } from './helpers/homeAcceptance';

const sourceFiles = ['e2e/external-creator-center.e2e.ts', 'src/shared/externalGames.ts', 'src/api/external-games.ts',
    'src/api/game-submissions.ts', 'src/components/home/PlatformHomeSurface.tsx', 'src/components/home/PlatformGameCatalog.tsx',
    'src/components/home/PlatformProfile.tsx', 'src/components/home/PlatformUploadWorkspace.tsx', 'src/components/home/CreatorCenter.tsx',
    'src/components/home/platform-profile.css', 'src/components/home/creator-center.css', 'src/components/home/platform-upload.css',
    'src/components/home/platform-catalog.css', 'src/components/external/useExternalPlay.ts', 'src/components/external/ExternalGameText.tsx',
    'src/pages/ExternalGamePage.tsx', 'src/pages/external-game-page.css', 'src/pages/admin/CreatorReview.tsx', 'src/pages/admin/creator-review.css',
    'src/pages/admin/components/AdminLayout.tsx', 'src/App.tsx', 'apps/api/src/modules/ugc/external-games.service.ts',
    'apps/api/src/modules/ugc/creator-claims.service.ts', 'apps/api/src/modules/ugc/external-play.service.ts',
    'apps/api/src/modules/ugc/game-submissions.service.ts', 'apps/api/src/modules/ugc/external-game-seeds.ts',
    'apps/api/src/modules/ugc/schemas/external-game.schema.ts', 'apps/api/src/modules/ugc/schemas/creator-claim.schema.ts',
    'apps/api/src/modules/ugc/schemas/external-play.schema.ts', 'apps/api/src/modules/ugc/schemas/game-submission.schema.ts',
    'apps/api/src/modules/ugc/external-game-fields.ts', 'apps/api/src/modules/ugc/game-image.ts', 'apps/api/src/modules/ugc/ugc.module.ts',
    'apps/api/src/modules/ugc/external-games.controller.ts', 'apps/api/src/modules/ugc/creator-claims.controller.ts',
    'apps/api/src/modules/ugc/creator-review.controller.ts', 'apps/api/src/modules/ugc/game-submissions.controller.ts',
    'apps/api/src/modules/ugc/dtos/external-game.dto.ts', 'apps/api/src/modules/ugc/dtos/game-submission.dto.ts'];
const sourceDigest = createHash('sha256');
const sourceFileDigests = sourceFiles.map(path => {
    const bytes = readFileSync(path); sourceDigest.update(path).update(bytes);
    return { path, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const changeRevision = sourceDigest.digest('hex');

test.describe.configure({ mode: 'serial' });
test.use({ actionTimeout: 15_000 });

for (const mobile of [false, true]) {
    test(`${mobile ? '手机' : '桌面'}外部游戏、投稿、认证及管理完整入口`, async ({ browser, accounts }) => {
        test.setTimeout(240_000);
        const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
        const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
        const adminContext = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
        const page = await context.newPage();
        const adminPage = await adminContext.newPage();
        const db = await mongoose.createConnection(process.env.MONGO_URI!).asPromise();
        const tag = mobile ? '手机' : '桌面';
        const title = `${tag}试玩示例游戏`;
        const image = await sharp({ create: { width: 160, height: 200, channels: 3, background: '#adc746' } }).png().toBuffer();
        try {
            await db.collection('users').updateOne({ email: accounts.bob.email }, { $set: { role: 'admin' } });
            await page.route('https://game.example.com/**', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#17232f;color:white;font:clamp(16px,4vw,24px) sans-serif;display:grid;place-items:center;height:100vh"><main><h1>测试游戏可操作</h1><button>测试操作</button></main></body></html>' }));
            await initHome(page);
            await login(page, accounts.alice);

            await page.getByRole('searchbox', { name: '搜索游戏' }).first().fill('山中小屋');
            await expect(page.locator('[data-game-id="external-yuanyi-games"]')).toBeVisible();
            await capture(page, `${tag}-发现外部游戏`);
            await page.locator('[data-game-id="external-yuanyi-games"] .platform-game-open').click();
            await expect(page.getByRole('heading', { name: '山中小屋' })).toBeVisible();
            await expect(page.getByRole('link', { name: '前往原网站 ↗' })).toHaveAttribute('href', 'https://yuanyigames.top/');
            await expect(page.getByText(/不允许在本站嵌入/)).toBeVisible();
            await expect(page.getByRole('link', { name: /space.bilibili.com\/31976469/ })).toBeVisible();
            await expect(page.getByRole('button', { name: '开始游玩' })).toHaveCount(0);
            await capture(page, `${tag}-外站详情与嵌入受限`);
            await page.getByRole('button', { name: '我是作者，申请认领' }).click();
            await expect(page.getByRole('heading', { name: '作者认证' })).toBeVisible();
            await expect(page.getByLabel('选择游戏')).toHaveValue('external-yuanyi-games');
            await capture(page, `${tag}-从游戏申请作者认证`);
            await page.goBack();
            await page.getByRole('button', { name: '← 返回' }).click();
            await expect(page.getByRole('searchbox', { name: '搜索游戏' }).first()).toHaveValue('山中小屋');

            await page.getByTestId('user-menu-trigger').click(); await page.getByTestId('user-menu-profile').click();
            await expect(page.getByTestId('profile-page')).toBeVisible();
            await capture(page, `${tag}-个人中心概览`);
            await page.getByRole('button', { name: '我的投稿', exact: true }).click();
            await expect(page.getByRole('heading', { name: '我的投稿' })).toBeVisible();
            await capture(page, `${tag}-我的投稿`);
            await page.getByRole('button', { name: '我的作品', exact: true }).click();
            await expect(page.getByRole('heading', { name: '我的作品' })).toBeVisible();
            await capture(page, `${tag}-我的作品`);
            await page.getByRole('button', { name: '我的投稿', exact: true }).click();
            await page.getByRole('button', { name: '＋ 投稿游戏' }).click();
            await expect(page.getByRole('heading', { name: '上传新游戏' })).toBeVisible();
            await capture(page, `${tag}-投稿表单上部`);
            await page.getByLabel('游戏名称', { exact: true }).fill(title);
            await page.getByLabel('游戏链接', { exact: true }).fill('https://game.example.com/');
            await page.getByLabel('作者', { exact: true }).fill('测试作者');
            await page.getByLabel('作者主页', { exact: true }).fill('https://example.com/author');
            await page.getByLabel('介绍', { exact: true }).fill('真实投稿和审核流程使用的测试作品。');
            await page.getByLabel('规则文档', { exact: true }).fill('本游戏页面由隔离测试提供。');
            await page.locator('.platform-upload-form input[type=file]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: image });
            await page.getByRole('button', { name: '提交审核' }).scrollIntoViewIfNeeded();
            await capture(page, `${tag}-投稿表单下部`);
            const sent = page.waitForResponse(response => response.url().endsWith('/submit') && response.request().method() === 'POST');
            await page.getByRole('button', { name: '提交审核' }).click(); expect((await sent).status()).toBe(201);
            await expect(page.getByText('审核期间资料已锁定。需要修改时可撤回投稿。')).toBeVisible();
            await page.getByText('审核期间资料已锁定。需要修改时可撤回投稿。').scrollIntoViewIfNeeded();
            await capture(page, `${tag}-投稿待审核`);

            await initHome(adminPage); await login(adminPage, accounts.bob);
            await adminPage.goto('/admin/creator-review');
            await expect(adminPage.getByRole('heading', { name: title })).toBeVisible();
            const submission = adminPage.locator('.review-card').filter({ has: adminPage.getByRole('heading', { name: title }) });
            await capture(adminPage, `${tag}-管理员审核投稿`);
            await submission.getByLabel('审核意见').fill('检查游戏链接和介绍，审核通过。');
            const approved = adminPage.waitForResponse(response => response.url().includes('/creator-review/submissions/') && response.request().method() === 'POST');
            await submission.getByRole('button', { name: '批准收录' }).click(); expect((await approved).status()).toBe(201);
            const approvedBody = await (await approved).json();
            const gameId = approvedBody.gameId as string;
            expect(gameId).toMatch(/^external-/);

            await page.getByRole('button', { name: '← 返回我的投稿' }).click();
            await page.getByRole('button', { name: '作者认证', exact: true }).click();
            await expect(page.getByRole('heading', { name: '作者认证' })).toBeVisible();
            await expect(page.getByRole('option', { name: `${title} · 测试作者` })).toHaveCount(1);
            await page.getByLabel('选择游戏').selectOption(gameId);
            await page.getByLabel('作者主页', { exact: true }).fill('https://example.com/author');
            await page.getByLabel('你与游戏的关系').fill('我是这款测试游戏的作者和开发者。');
            await capture(page, `${tag}-作者认证申请`);
            const created = page.waitForResponse(response => response.url().endsWith('/ugc/creator-claims') && response.request().method() === 'POST');
            await page.getByRole('button', { name: '创建认证申请' }).click(); expect((await created).status()).toBe(201);
            const claimId = (await (await created).json()).claimId as string;
            const claim = page.locator('.creator-claim').filter({ has: page.getByText(title, { exact: true }) });
            await expect(claim.getByText(/验证短码/)).toBeVisible();
            const code = await claim.locator('b').innerText();
            const proof = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#f7f7f7"/><rect width="640" height="72" fill="#182532"/><text x="24" y="46" font-family="sans-serif" font-size="24" fill="white">TEST AUTHOR PROFILE - SAMPLE</text><text x="28" y="140" font-family="sans-serif" font-size="26" fill="#111">Profile control verification</text><text x="28" y="205" font-family="sans-serif" font-size="32" fill="#111">CODE: ${code}</text><text x="28" y="270" font-family="sans-serif" font-size="20" fill="#333">Synthetic evidence for browser testing only</text></svg>`)).png().toBuffer();
            await claim.locator('input[type=file]').setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: proof });
            await claim.getByRole('button', { name: '上传截图' }).click();
            await expect(claim.getByRole('button', { name: '提交审核' })).toBeEnabled();
            await claim.scrollIntoViewIfNeeded();
            await capture(page, `${tag}-作者认证材料`);
            await claim.getByRole('button', { name: '提交审核' }).click();
            await expect(claim.getByText('待审核', { exact: false })).toBeVisible();
            await capture(page, `${tag}-作者认证待审核`);

            await adminPage.getByRole('button', { name: '作者认领', exact: true }).click();
            const review = adminPage.locator('.review-card').filter({ has: adminPage.getByRole('heading', { name: title }) });
            await expect(review).toBeVisible();
            await review.getByRole('button', { name: '查看认证截图' }).click();
            await expect(review.getByAltText('认证材料截图')).toBeVisible();
            await capture(adminPage, `${tag}-管理员审核作者材料`);
            await review.getByRole('button', { name: '批准认领' }).scrollIntoViewIfNeeded();
            await capture(adminPage, `${tag}-管理员认领审核操作`);
            await review.getByLabel('已核对作者主页控制权').check();
            await review.getByLabel('已核对作者与该游戏的关系').check();
            await review.getByLabel('审核意见').fill('已核对主页及作品关系。');
            const claimApproval = adminPage.waitForResponse(response => response.url().endsWith(`/creator-review/claims/${claimId}`) && response.request().method() === 'POST');
            await review.getByRole('button', { name: '批准认领' }).click(); expect((await claimApproval).status()).toBe(201);
            await adminPage.getByRole('button', { name: '嵌入检查', exact: true }).click();
            await expect(adminPage.getByRole('heading', { name: '山中小屋' })).toBeVisible();
            await capture(adminPage, `${tag}-管理员嵌入检查`);

            await page.getByRole('button', { name: '我的作品', exact: true }).click();
            await expect(page.getByText(title, { exact: true })).toBeVisible();
            await capture(page, `${tag}-已认领作品`);
            const work = page.locator('.creator-row').filter({ hasText: title });
            await work.getByRole('button', { name: '编辑作品' }).click();
            await expect(page.getByRole('button', { name: '保存作品' })).toBeVisible();
            await capture(page, `${tag}-编辑作品`);
            await page.getByRole('button', { name: '保存作品' }).scrollIntoViewIfNeeded();
            await capture(page, `${tag}-编辑作品下部`);
            await page.getByLabel('介绍', { exact: true }).fill('作者可以直接修改并保存的测试介绍。');
            const saved = page.waitForResponse(response => response.url().endsWith(`/ugc/external-games/${gameId}`) && response.request().method() === 'PUT');
            await page.getByRole('button', { name: '保存作品' }).click(); expect((await saved).status()).toBe(200);
            await expect(page.getByText(title, { exact: true })).toBeVisible();
            await page.locator('.creator-row').filter({ hasText: title }).getByRole('button', { name: '预览作品' }).click();
            await expect(page.getByRole('heading', { name: title })).toBeVisible();
            await expect(page.getByText('作者可以直接修改并保存的测试介绍。')).toBeVisible();
            await expect(page.getByRole('button', { name: '管理我的作品' })).toBeVisible();
            await capture(page, `${tag}-作者作品预览`);
            await page.getByRole('button', { name: '开始游玩' }).click();
            await expect(page.frameLocator('iframe').getByRole('heading', { name: '测试游戏可操作' })).toBeVisible();
            await page.getByRole('button', { name: '打开游戏菜单' }).click();
            await expect(page.getByRole('button', { name: '结束并返回' })).toBeVisible();
            await capture(page, `${tag}-站内试玩菜单`);
            await page.getByRole('button', { name: '页面未显示？' }).click();
            await expect(page.getByText('部分网站限制内嵌或需要独立登录，可重新加载或前往原网站。')).toBeVisible();
            await capture(page, `${tag}-试玩加载帮助`);
            await page.getByRole('button', { name: '页面未显示？' }).click();
            await page.getByRole('button', { name: '全屏', exact: true }).click();
            await expect(page.getByRole('button', { name: '退出全屏' }).or(page.getByText('浏览器未能进入全屏，可继续在页面内游玩。'))).toBeVisible();
            await capture(page, `${tag}-试玩全屏状态`);
            await page.getByRole('button', { name: '结束并返回' }).click();
            await expect(page.getByRole('heading', { name: '我的作品' })).toBeVisible();
            await page.getByRole('button', { name: '作者认证', exact: true }).click();
            const approvedClaim = page.locator('.creator-claim').filter({ hasText: title }).getByText('已通过', { exact: false });
            await expect(approvedClaim).toBeVisible();
            await approvedClaim.scrollIntoViewIfNeeded();
            await capture(page, `${tag}-作者认证已通过`);
            await page.getByRole('button', { name: '我的投稿', exact: true }).click();
            await expect(page.locator('.creator-row').filter({ hasText: title })).toBeVisible();
            await page.getByLabel('状态').selectOption('approved');
            await capture(page, `${tag}-投稿已收录`);
            await page.locator('.creator-row').filter({ hasText: title }).getByRole('button', { name: '编辑投稿' }).click();
            await page.getByRole('button', { name: '← 返回我的投稿' }).click();
            await expect(page.getByLabel('状态')).toHaveValue('approved');
            const endDigest = createHash('sha256');
            for (const path of sourceFiles) endDigest.update(path).update(readFileSync(path));
            expect(endDigest.digest('hex')).toBe(changeRevision);
            await record(`${tag}-真实链路`, { sourceRevision, changeRevision, sourceFileDigests, gameId, claimId, submissionApproved: true, claimApproved: true, authorEdit: true, embeddedFixture: '隔离测试页面，不是鸢一桑站点', fullscreenOrExplicitError: true, returnToWorks: true });
        } finally {
            await db.close(); await context.close(); await adminContext.close();
        }
    });
}
