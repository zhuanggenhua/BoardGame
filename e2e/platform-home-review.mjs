import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createHomeVisualFixture, installHomeVisualData } from './helpers/homeVisualFixture.mjs';

// 用户指定的真实开发入口；夹具只替换数据，不替换任何界面组件。
const entry = process.env.HOME_REVIEW_URL ?? 'http://127.0.0.1:4273/';
const diagnostic = process.argv.includes('--diagnostic');
const privateAll = process.argv.includes('--all-diagnostic');
const out = path.resolve(diagnostic ? '.tmp/home-full-diagnostic' : privateAll ? '.tmp/home-full-all-diagnostic' : process.env.HOME_REVIEW_OUT ?? 'test-results/evidence-screenshots/platform/home-full-20261030');
mkdirSync(out, { recursive: true });
const images = [];
const checks = [];
let currentPage;
const fixture = await createHomeVisualFixture();
const browser = await chromium.launch({ headless: true });
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : /\.(tsx?|css|json)$/.test(item.name) ? [path.join(dir, item.name)] : []);
const sourcePaths = [...new Set(['src/pages/Home.tsx', 'src/config/games.config.tsx', 'src/games/manifest.client.generated.tsx', 'src/index.css', ...['home', 'lobby', 'review', 'auth', 'social', 'system', 'settings', 'external', 'common/overlays', 'common/i18n'].flatMap(dir => walk(`src/components/${dir}`)), ...walk('public/locales/zh-CN'), 'e2e/helpers/homeVisualFixture.mjs', 'e2e/platform-home-review.mjs'])];
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceIdentity = () => Object.fromEntries(sourcePaths.map(file => [file, sha(readFileSync(file))]));
const start = sourceIdentity();
writeFileSync(path.join(out, 'capture-start.json'), JSON.stringify({ entry, sources: start }, null, 2));
async function shot(page, label, state, description) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].filter(img => { const r = img.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; }).every(img => img.complete && img.naturalWidth > 0), null, { timeout: 15000 });
    await page.waitForTimeout(350);
    const file = path.join(out, `${label}-${String(images.filter(item => item.label === label).length + 1).padStart(2, '0')}-${state}.png`);
    await page.screenshot({ path: file, fullPage: false, scale: 'css' });
    images.push({ path: file, sha256: sha(readFileSync(file)), label, state, description, viewport: label === '桌面' ? 'desktop' : 'mobile', url: page.url() });
    writeFileSync(path.join(out, 'capture-progress.json'), JSON.stringify({ entry, images, checks }, null, 2));
    console.log(`截图 ${label} ${state}`);
}
async function openGame(page, mobile, fromLibrary = false) {
    const scope = fromLibrary ? '.platform-catalog--library' : '.platform-catalog--discover';
    const card = page.locator(`${scope} [data-game-id="dicethrone"] .platform-game-open`);
    if (mobile) await card.tap(); else await card.click();
    await page.getByTestId('game-details-modal-root').waitFor();
    await expect(page.getByTestId('room-list-item-d1ce0000')).toBeVisible();
}
async function reset(page) {
    await page.goto(entry, { waitUntil: 'domcontentloaded' });
    await page.locator('.platform-game-card').first().waitFor();
}
async function menuAction(page, id) {
    await page.getByTestId('user-menu-trigger').click();
    await page.getByTestId(id).click();
}
async function fullReview(page, context, label, mobile) {
    // 详情各页签、作者和建房使用同一份有内容的数据，避免只审空态。
    await page.getByRole('button', { name: '写评价', exact: true }).click();
    await page.locator('[data-platform-dialog="review"]').waitFor();
    await page.locator('[data-platform-dialog="review"] textarea').fill('英雄技能各有特色，和朋友对战很有趣。');
    await shot(page, label, '撰写评价', '评价弹层提供推荐选择、正文和提交入口，尚未发布');
    await page.locator('[data-platform-dialog="review"] .platform-dialog-close').click();
    for (const [tab, state, description] of [
        ['changelog', '收藏游戏更新', '更新页显示置顶版本、多条更新正文与日期'],
        ['leaderboard', '收藏游戏排行', '排行榜展示多位玩家的名次、积分和对战成绩'],
    ]) {
        await page.getByTestId(`game-details-tab-${tab}`).click();
        await page.waitForTimeout(300);
        await shot(page, label, state, description);
    }
    await page.getByTestId('game-details-author-button-mobile').click();
    await page.getByTestId('game-details-author-modal').waitFor();
    await shot(page, label, '作者信息', '作者弹层显示电子化作者署名和黄色认领入口，不列作品');
    await page.getByTestId('game-details-author-modal').locator('.platform-dialog-close').click();
    await page.getByTestId('game-details-tab-lobby').click();
    await page.getByTestId('room-list-join-d1ce0003').click();
    await page.getByTestId('room-password-modal').waitFor();
    await shot(page, label, '私密房间密码', '加入私密房间时弹出密码输入，未发送加入请求');
    await page.getByTestId('room-password-modal').getByRole('button', { name: '取消', exact: true }).click();
    await page.getByTestId('game-details-open-create-room').click();
    await page.getByTestId('create-room-name-input').fill('周末好友轻松对战');
    await shot(page, label, '创建房间配置', '建房弹层显示房名、人数和可用配置，尚未提交创建');
    await reset(page);
    await shot(page, label, '发现首页', '发现页展示完整游戏封面、分类导航和账户入口');
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    if (scrollHeight > page.viewportSize().height + 80) {
        if (mobile && scrollHeight > page.viewportSize().height * 2) {
            await page.evaluate(y => window.scrollTo(0, y), page.viewportSize().height - 90);
            await shot(page, label, '发现列表中段', '滚动后继续显示中段游戏封面，导航与浮球保持各自层级');
        }
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await shot(page, label, '发现列表末段', '列表底部游戏与外站目录正常显示，封面加载没有丢失');
        await page.evaluate(() => window.scrollTo(0, 0));
    }
    if (!mobile) {
        await page.locator('[data-game-id="dicethrone"] .platform-game-open').hover();
        await page.waitForTimeout(250);
        await shot(page, label, '游戏封面悬浮', '封面悬浮突出并显示桌面侧介，收藏入口属于当前封面');
        await page.mouse.move(0, 0);
    }
    await page.getByRole('searchbox', { name: '搜索游戏' }).first().fill('王权');
    await shot(page, label, '搜索结果', '搜索后只显示名称匹配的游戏，分类与搜索入口仍可见');
    await page.getByRole('searchbox', { name: '搜索游戏' }).first().fill('');
    if (!mobile) {
        await openGame(page, mobile);
        const completeRooms = await page.locator('[data-testid^="room-list-item-"]').evaluateAll(nodes => nodes.filter(node => {
            const r = node.getBoundingClientRect(); const parent = node.closest('.platform-details-content').getBoundingClientRect();
            return r.top >= parent.top && r.bottom <= parent.bottom;
        }).length);
        expect(completeRooms).toBeGreaterThanOrEqual(3);
        checks.push({ name: '桌面详情首屏至少三间完整房间，其余正常滚动', count: completeRooms, pass: true });
        await shot(page, label, '发现页详情弹层', '发现页点击游戏打开浮层详情，多个房间在列表中承载');
        await reset(page);
    }
    await page.getByRole('button', { name: '收藏库', exact: true }).click();
    if (mobile) await page.locator('.platform-library-news-toggle').click();
    await page.locator('.platform-library-news-card').first().waitFor();
    if (mobile) await shot(page, label, '收藏动态展开', '收藏动态在游戏封面列表上方展开，多个游戏更新横向排列');
    await page.locator('.platform-library-news-card').first().click();
    await page.locator('.platform-news-dialog').waitFor();
    await shot(page, label, '收藏动态正文', '动态详情显示完整更新正文，关闭入口清楚可见');
    await reset(page);
    await page.getByTestId('user-menu-trigger').click();
    await shot(page, label, '账户菜单', '账户菜单集中展示个人中心、社交、账户和反馈入口');
    await page.getByTestId('user-menu-profile').click();
    await page.getByTestId('profile-page').waitFor();
    await shot(page, label, '个人中心概览', '个人中心展示模拟的多条对局记录、外站游玩和账户统计');
    await page.getByRole('button', { name: '编辑个人资料', exact: true }).click();
    await shot(page, label, '个人资料编辑', '资料编辑显示昵称输入与保存取消操作，统计区域仍有归属');
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await page.locator('.platform-profile-avatar').click();
    const avatar = page.locator('[data-platform-dialog="avatar"]');
    await avatar.waitFor();
    await shot(page, label, '预设头像', '头像弹层提供当前默认、预设头像和上传入口');
    await avatar.locator('input[type="file"]').setInputFiles('public/logos/logo_1_grid.png');
    await page.getByTestId('avatar-crop-frame').waitFor();
    await shot(page, label, '头像裁剪', '选择本地图片后显示裁剪预览和确认入口，未保存账户头像');
    await avatar.locator('.platform-dialog-close').click();
    await avatar.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '我的投稿', exact: true }).click();
    await expect(page.getByText('林间探险', { exact: true })).toBeVisible();
    await shot(page, label, '个人中心投稿', '投稿列表展示草稿、待审核和被退回的不同状态');
    await page.getByRole('button', { name: '我的作品', exact: true }).click();
    await expect(page.getByRole('heading', { name: '我的作品', exact: true })).toBeVisible();
    await expect(page.locator('.creator-row').first()).toBeVisible();
    await shot(page, label, '个人中心作品', '作品在个人中心集中展示，显示发布状态与管理入口');
    await page.locator('.creator-row-actions button').first().click();
    await page.locator('.platform-upload-form').waitFor();
    await shot(page, label, '编辑已发布作品', '作品编辑复用投稿表单并显示发布状态，尚未保存');
    await page.locator('.platform-upload-actions').scrollIntoViewIfNeeded();
    await shot(page, label, '编辑作品发布操作', '作品编辑下半展示封面、规则、发布开关与保存操作');
    await reset(page);
    if (mobile) await page.getByRole('button', { name: '菜单', exact: true }).click();
    await page.getByRole('button', { name: '上传', exact: true }).filter({ visible: true }).click();
    await page.locator('.platform-upload-form').waitFor();
    await shot(page, label, '投稿新游戏', '投稿页展示名称、网址和作者等表单，已有投稿由列表入口承接');
    const uploadTop = await page.evaluate(() => scrollY);
    await page.locator('.platform-upload-actions').scrollIntoViewIfNeeded();
    if (mobile || Math.abs(await page.evaluate(() => scrollY) - uploadTop) > 8) await shot(page, label, '投稿表单后半', '投稿后半显示封面、规则正文与保存草稿和送审操作');
    if (mobile) {
        await page.locator('.platform-upload-list-toggle').click();
        await page.locator('.platform-upload-drawer').waitFor();
        await shot(page, label, '手机投稿列表', '手机通过二级列表切换投稿，草稿和审核状态可读');
    }
    await reset(page);
    await menuAction(page, 'user-menu-my-feedback');
    await page.getByTestId('my-feedback-modal').waitFor();
    await expect(page.getByTestId('my-feedback-item').first()).toBeVisible();
    await shot(page, label, '我的反馈', '我的反馈展示模拟的处理中与已解决记录及奖励状态');
    await reset(page);
    await menuAction(page, 'user-menu-account-settings');
    await page.getByTestId('account-settings-modal').waitFor();
    await shot(page, label, '账户设置', '账户设置弹层展示昵称、邮箱及密码操作，关闭入口贴边');
    await page.getByTestId('account-settings-edit-password').click();
    await shot(page, label, '修改密码', '账户设置内展开原密码、新密码和确认字段');
    await reset(page);
    await menuAction(page, 'user-menu-account-settings');
    await page.getByTestId('account-settings-open-email').click();
    await page.locator('[data-platform-dialog="email"]').waitFor();
    await shot(page, label, '邮箱设置', '邮箱设置显示当前邮箱、验证码与绑定操作，未发送真实邮件');
    await reset(page);
    await page.getByTestId('user-menu-trigger').click();
    await page.getByRole('button', { name: '光标设置', exact: true }).click();
    await page.locator('[data-platform-dialog="cursor"]').waitFor();
    await shot(page, label, '光标设置', '光标设置弹层显示可选主题及预览，选中状态清楚可见');
    await reset(page);
    await page.getByTestId('user-menu-notifications').filter({ visible: true }).first().click();
    await page.getByTestId('friends-chat-modal-content').waitFor();
    await shot(page, label, '通知与好友', '社交弹层集中显示通知和好友入口，空列表有明确承载');
    await reset(page);
    if (mobile) {
        await page.getByRole('button', { name: '菜单', exact: true }).click();
        await shot(page, label, '手机工具菜单', '手机工具菜单收纳上传、指南和支持作者等次级入口');
    }
    const support = page.getByRole('button', { name: '支持作者', exact: true }).filter({ visible: true });
    if (mobile) await support.click(); else await support.hover();
    await page.getByRole('region', { name: '支持作者' }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('img[alt*="二维码"]')].every(img => img.complete && img.naturalWidth));
    await shot(page, label, '支持作者', '支持作者展开说明和两种支付二维码，内容完整可读');
    await page.getByRole('button', { name: '关闭赞助说明', exact: true }).click();
    await page.getByTestId('home-operation-guide-entry').filter({ visible: true }).click();
    await page.getByTestId('operation-guide-modal').waitFor();
    await shot(page, label, '操作指南', '指南弹层集中说明平台操作与账户使用方式');
    await reset(page);
    await page.evaluate(() => {
        localStorage.setItem('owner_active_match', JSON.stringify({ matchID: 'd1ce0000', gameName: 'dicethrone', ownerType: 'user', updatedAt: Date.now() }));
        window.dispatchEvent(new Event('owner-active-match-changed'));
    });
    await page.getByTestId('home-active-match-banner').waitFor();
    await shot(page, label, '进行中房间悬浮', '首页显示进行中房间浮层与继续对局入口，主体不为浮层留槽');
    await page.evaluate(() => { localStorage.removeItem('owner_active_match'); window.dispatchEvent(new Event('owner-active-match-changed')); });
    for (const [id, selector, state, description] of [
        ['settings', '[data-testid="fab-panel-settings"]', '浮球设置', '设置沿用浮球原浮窗，现代选中态与音量控件可见'],
        ['about', '[data-platform-dialog="about"]', '关于平台', '关于弹层展示平台信息与赞助列表，没有新增支付入口'],
        ['feedback', '[data-platform-dialog="feedback"]', '反馈表单', '反馈表单显示类型、描述和截图入口，未向服务端提交'],
    ]) {
        await reset(page);
        await page.getByTestId('fab-menu').locator('button').first().click();
        if (id !== 'settings') await page.locator(`[data-fab-id="${id}"]`).click();
        await page.locator(selector).waitFor();
        await shot(page, label, state, description);
    }
    await reset(page);
    await page.getByRole('searchbox', { name: '搜索游戏' }).first().fill('山中小屋');
    await page.locator('[data-game-id="external-yuanyi-games"] .platform-game-open').click();
    await page.getByTestId('game-details-modal-root').waitFor();
    await shot(page, label, '外站游戏详情', '外站游戏沿用详情承载，原站游玩入口与限制说明可见');
    await page.getByTestId('game-details-author-button-mobile').click();
    await page.getByTestId('game-details-author-modal').waitFor();
    await shot(page, label, '外站作者', '作者弹层显示署名、可点击的网址和黄色认领入口');
    await page.getByRole('button', { name: '申请认领', exact: true }).click();
    await page.getByTestId('creator-claim-panel').waitFor();
    await shot(page, label, '作者认领表单', '认领表单包含主页、关系说明与认证截图上传入口，未提交');
}
async function guestReview(label, mobile) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN' });
    await installHomeVisualData(context, { socketUrl: fixture.url, authenticated: false, favorites: [] });
    const page = await context.newPage();
    currentPage = page;
    page.setDefaultTimeout(20000);
    await reset(page);
    await expect(page.getByTestId('user-menu-trigger')).toHaveCount(0);
    await shot(page, label, '访客首页', '访客发现页展示登录和注册入口，可直接浏览游戏');
    await page.getByRole('button', { name: '收藏库', exact: true }).click();
    await shot(page, label, '空收藏库', '没有收藏时显示空收藏库主页，不自动打开游戏详情');
    await reset(page);
    await page.getByRole('button', { name: '登录', exact: true }).first().click();
    await page.getByTestId('auth-login-account-input').waitFor();
    await shot(page, label, '登录', '登录弹层显示账户密码与找回入口');
    await page.getByTestId('auth-login-forgot-button').click();
    await page.getByTestId('auth-reset-email-input').waitFor();
    await expect(page.getByTestId('auth-submit-button')).toBeInViewport({ ratio: 1 });
    checks.push({ name: '找回密码按钮完整处于视口内', label, pass: true });
    await shot(page, label, '找回密码', '找回密码显示邮箱验证码与新密码字段，不发送真实邮件');
    await reset(page);
    if (mobile) {
        await page.getByRole('button', { name: '登录', exact: true }).first().click();
        await page.getByRole('navigation', { name: '账户入口' }).getByRole('button', { name: '注册', exact: true }).click();
    } else await page.getByRole('button', { name: '注册', exact: true }).first().click();
    await page.getByTestId('auth-register-email-input').waitFor();
    checks.push({ name: '通过真实可见入口进入注册', label, pass: true });
    await shot(page, label, '注册', '注册表单展示昵称、邮箱验证码和密码字段');
    if (mobile && await page.getByTestId('auth-submit-button').evaluate(el => el.getBoundingClientRect().bottom > innerHeight - 12)) {
        await page.getByTestId('auth-submit-button').scrollIntoViewIfNeeded();
        await shot(page, label, '注册表单末段', '注册表单内部滚动后可完整查看密码、确认与注册操作');
        await page.getByTestId('auth-register-email-input').scrollIntoViewIfNeeded();
    }
    await page.getByTestId('auth-register-email-input').fill('new-player@example.test');
    await page.getByTestId('auth-register-send-code').click();
    await expect(page.getByText('服务暂时不可用，请稍后重试。', { exact: false })).toBeVisible();
    await shot(page, label, '注册邮件错误反馈', '模拟邮件服务失败后显示明确错误，表单保留可继续操作');
    await reset(page);
    if (mobile) await page.getByRole('button', { name: '菜单', exact: true }).click();
    await page.getByRole('button', { name: '上传', exact: true }).filter({ visible: true }).click();
    await page.locator('.platform-upload-login').waitFor();
    await shot(page, label, '访客投稿入口', '访客进入投稿页时提供登录入口，不显示可提交表单');
    await context.close();
}
try {
    for (const mobile of [false, true]) {
        const label = mobile ? '手机' : '桌面';
        const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN' });
        const requests = await installHomeVisualData(context, { socketUrl: fixture.url, authenticated: true });
        const page = await context.newPage();
        currentPage = page;
        page.setDefaultTimeout(30000);
        page.on('pageerror', error => console.log(`页面错误 ${error.message}`));
        page.on('console', message => { if (message.type() === 'error') console.log(`控制台 ${message.text().slice(0, 500)}`); });
        await page.goto(new URL('?section=library&libraryGame=dicethrone', entry).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.getByTestId('game-details-modal-root').waitFor().catch(async error => {
            console.log(`现场文字 ${(await page.locator('body').innerText()).slice(0, 5000)}`);
            throw error;
        });
        if (mobile) {
            await page.getByTestId('game-details-close-button').tap();
            await page.getByTestId('game-details-modal-root').waitFor({ state: 'hidden' });
        }
        await page.getByRole('button', { name: '收藏库', exact: true }).click();
        await expect(page.locator('.platform-catalog--library')).toBeVisible();
        expect(new URL(page.url()).searchParams.has('libraryGame')).toBe(false);
        expect(new URL(page.url()).searchParams.has('game')).toBe(false);
        checks.push({ name: '顶部收藏库回到主页并清除详情选择', label, pass: true });
        await shot(page, label, '收藏库主页', '收藏库主页展示收藏封面与游戏动态，没有自动选中游戏详情');
        await openGame(page, mobile, true);
        await shot(page, label, '收藏游戏大厅', '点击收藏游戏后才进入详情，模拟的多个房间与更新内容可见');
        await page.getByTestId('game-details-tab-reviews').click();
        await expect(page.getByText('英雄各有特色', { exact: false })).toBeVisible();
        await shot(page, label, '收藏游戏评价', '评价页显示模拟的口碑统计与多条真实排版长度的评论');
        if (!diagnostic) await fullReview(page, context, label, mobile);
        writeFileSync(path.join(out, `${label}-requests.json`), JSON.stringify(requests, null, 2));
        await context.close();
        if (!diagnostic) await guestReview(label, mobile);
    }
    expect(sourceIdentity()).toEqual(start);
    writeFileSync(path.join(out, 'capture-record.json'), JSON.stringify({ entry, fixtureScope: '仅用于本轮视觉与导航检查的浏览器模拟数据，不代表生产内容或真实联机结果；不写开发数据库。', acceptanceMode: 'visual-only', images, checks, sources: start }, null, 2));
} catch (error) {
    if (currentPage && !currentPage.isClosed()) console.log(`失败现场 ${(await currentPage.locator('body').innerText().catch(() => '')).slice(0, 5500)}`);
    throw error;
} finally { await browser.close(); await fixture.close(); }
