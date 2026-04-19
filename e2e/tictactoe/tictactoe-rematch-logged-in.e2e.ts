/**
 * 已登录用户重赛 E2E 测试
 *
 * 覆盖场景：已登录用户（有 JWT token）发起重赛时，
 * playAgain 必须携带 Authorization header 调用 /create，
 * 否则服务端返回 400 "guestId is required"。
 *
 * 回归测试：修复 3f098ca 引入的 bug（只修了匿名用户路径，漏了 token 路径）。
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { getGameServerBaseURL, setChineseLocale } from '../helpers/common';

// ============================================================================
// 工具函数
// ============================================================================

/** 注入已登录用户状态到 localStorage */
const injectAuthState = async (
    context: BrowserContext | Page,
    token: string,
    userId: string,
    username: string,
) => {
    await context.addInitScript(
        ({ token, userId, username }) => {
            localStorage.setItem('auth_token', token);
            localStorage.setItem(
                'auth_user',
                JSON.stringify({ id: userId, username, email: `${username}@test.com`, role: 'user', banned: false }),
            );
        },
        { token, userId, username },
    );
};

const ensureHostPlayerId = async (page: Page): Promise<URL> => {
    const url = new URL(page.url());
    if (!url.searchParams.get('playerID')) {
        url.searchParams.set('playerID', '0');
        await page.goto(url.toString());
        await expect(page.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 15000 });
    }
    return new URL(page.url());
};

const clickCell = async (page: Page, id: number) => {
    await page.locator(`[data-tutorial-id="cell-${id}"]`).click();
};

const waitForCellFilled = async (page: Page, id: number) => {
    await expect(page.locator(`[data-tutorial-id="cell-${id}"] svg`)).toBeVisible({ timeout: 10000 });
};

const waitForNewMatch = async (page: Page, oldMatchId: string) => {
    await page.waitForURL(
        (url) => {
            const parsed = new URL(url);
            if (!parsed.pathname.includes('/play/tictactoe/match/')) return false;
            const matchId = parsed.pathname.split('/').pop();
            return !!matchId && matchId !== oldMatchId;
        },
        { timeout: 15000 },
    );
    return new URL(page.url()).pathname.split('/').pop()!;
};

// ============================================================================
// 测试
// ============================================================================

test.describe('井字棋重赛 - 已登录用户', () => {
    /**
     * 核心回归测试：已登录用户重赛时 /create 必须携带 Authorization header。
     *
     * 测试策略：
     * - 真实走完一局井字棋（host 赢）
     * - host 注入 fake auth state，mock auth/me 让 AuthContext 认为已登录
     * - mock game server /create 端点：捕获请求头，验证 Authorization 存在，返回 fake nextMatchID
     * - mock /getMatch 和 /claim-seat 让后续流程能完成
     * - 断言 host 页面跳转到新 matchId
     */
    test('已登录用户重赛时 /create 请求携带 Authorization header', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const gameServerBaseURL = getGameServerBaseURL();

        const FAKE_TOKEN = 'e2e-fake-jwt-token-logged-in-user';
        const FAKE_USER_ID = 'e2e_user_001';
        const FAKE_USERNAME = 'E2EPlayer';
        const NEXT_MATCH_ID = 'e2e-next-match-id-001';

        // ── Host 上下文（已登录用户） ──────────────────────────────────────
        const hostContext = await browser.newContext({ baseURL });
        await setChineseLocale(hostContext);
        await injectAuthState(hostContext, FAKE_TOKEN, FAKE_USER_ID, FAKE_USERNAME);

        // mock auth/me，让 AuthContext 认为 token 有效
        await hostContext.route('**/auth/me', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    user: { id: FAKE_USER_ID, username: FAKE_USERNAME, email: `${FAKE_USERNAME}@test.com`, role: 'user', banned: false },
                }),
            });
        });

        // 捕获 /create 请求，验证 Authorization header，返回 fake nextMatchID
        let capturedCreateAuthHeader: string | null = null;
        await hostContext.route(`${gameServerBaseURL}/games/tictactoe/create`, async (route) => {
            capturedCreateAuthHeader = route.request().headers()['authorization'] ?? null;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ matchID: NEXT_MATCH_ID }),
            });
        });

        // mock getMatch（playAgain 内部调用，用于获取 numPlayers/setupData）
        // 这里 mock 的是当前对局的 GET，返回 2 人对局信息
        // 注意：matchId 在测试运行时才知道，用通配符匹配
        await hostContext.route(
            (url) => url.href.includes(`${gameServerBaseURL}/games/tictactoe/`) && !url.href.includes('/create') && !url.href.includes('/claim-seat'),
            async (route) => {
                const url = route.request().url();
                // 只 mock GET 请求（getMatch）
                if (route.request().method() === 'GET') {
                    await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            matchID: url.split('/').pop(),
                            gameName: 'tictactoe',
                            players: [{ id: 0 }, { id: 1 }],
                            setupData: { ownerKey: `user:${FAKE_USER_ID}`, ownerType: 'user' },
                        }),
                    });
                } else {
                    await route.continue();
                }
            },
        );

        // mock claim-seat（新对局的占座）
        await hostContext.route(`${gameServerBaseURL}/games/tictactoe/${NEXT_MATCH_ID}/claim-seat`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ playerCredentials: 'e2e-new-credentials' }),
            });
        });

        const hostPage = await hostContext.newPage();

        // ── Guest 上下文（匿名用户，正常流程） ────────────────────────────
        const guestContext = await browser.newContext({ baseURL });
        await setChineseLocale(guestContext);
        const guestPage = await guestContext.newPage();

        // ── 创建房间并开始游戏 ────────────────────────────────────────────
        await hostPage.goto('/');
        await hostPage.getByRole('heading', { name: '井字棋' }).click();
        await hostPage.getByRole('button', { name: '创建房间' }).click();
        await expect(hostPage.getByRole('heading', { name: '创建房间' })).toBeVisible();
        await hostPage.getByRole('button', { name: '确认' }).click();

        await hostPage.waitForURL(/\/play\/tictactoe\/match\//);
        await expect(hostPage.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 15000 });

        const hostUrl = await ensureHostPlayerId(hostPage);
        const matchId = hostUrl.pathname.split('/').pop();
        if (!matchId) throw new Error('Failed to parse match id from host URL.');

        await guestPage.goto(`/play/tictactoe/match/${matchId}?join=true`);
        await expect(guestPage).toHaveURL(/playerID=\d/, { timeout: 30000 });
        await expect(guestPage.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 15000 });

        // ── 走完一局（host 赢：0,4,8 对角线） ────────────────────────────
        await clickCell(hostPage, 0);
        await waitForCellFilled(hostPage, 0);
        await waitForCellFilled(guestPage, 0);

        await clickCell(guestPage, 1);
        await waitForCellFilled(guestPage, 1);
        await waitForCellFilled(hostPage, 1);

        await clickCell(hostPage, 4);
        await waitForCellFilled(hostPage, 4);
        await waitForCellFilled(guestPage, 4);

        await clickCell(guestPage, 2);
        await waitForCellFilled(guestPage, 2);
        await waitForCellFilled(hostPage, 2);

        await clickCell(hostPage, 8);
        await waitForCellFilled(hostPage, 8);
        await waitForCellFilled(guestPage, 8);

        await expect(hostPage.getByText(/胜利|平局/i)).toBeVisible({ timeout: 15000 });

        // ── 双方点击再来一局 ──────────────────────────────────────────────
        const playAgainHost = hostPage.getByRole('button', { name: '再来一局' });
        const playAgainGuest = guestPage.getByRole('button', { name: '再来一局' });
        await expect(playAgainHost).toBeVisible({ timeout: 15000 });
        await expect(playAgainGuest).toBeVisible({ timeout: 15000 });

        await playAgainHost.click();
        await playAgainGuest.click();

        // ── 断言：host 跳转到新 matchId ───────────────────────────────────
        const nextMatchIdHost = await waitForNewMatch(hostPage, matchId);
        expect(nextMatchIdHost).toBe(NEXT_MATCH_ID);

        // ── 核心断言：/create 请求携带了 Authorization header ─────────────
        expect(capturedCreateAuthHeader).not.toBeNull();
        expect(capturedCreateAuthHeader).toBe(`Bearer ${FAKE_TOKEN}`);

        await hostContext.close();
        await guestContext.close();
    });

    /**
     * 对照测试：匿名用户重赛时 /create 请求不携带 Authorization header，
     * 但 setupData.guestId 存在。
     * 确保修复已登录用户路径时没有破坏匿名用户路径。
     */
    test('匿名用户重赛时 /create 请求携带 guestId 而非 Authorization header', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const gameServerBaseURL = getGameServerBaseURL();

        const NEXT_MATCH_ID = 'e2e-next-match-id-002';

        const hostContext = await browser.newContext({ baseURL });
        await setChineseLocale(hostContext);
        // 不注入 auth state，模拟匿名用户

        let capturedCreateAuthHeader: string | null | undefined = undefined;
        let capturedCreateBody: Record<string, unknown> | null = null;

        await hostContext.route(`${gameServerBaseURL}/games/tictactoe/create`, async (route) => {
            capturedCreateAuthHeader = route.request().headers()['authorization'] ?? null;
            const postData = route.request().postData();
            capturedCreateBody = postData ? (JSON.parse(postData) as Record<string, unknown>) : null;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ matchID: NEXT_MATCH_ID }),
            });
        });

        await hostContext.route(
            (url) => url.href.includes(`${gameServerBaseURL}/games/tictactoe/`) && !url.href.includes('/create') && !url.href.includes('/claim-seat'),
            async (route) => {
                if (route.request().method() === 'GET') {
                    await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            matchID: route.request().url().split('/').pop(),
                            gameName: 'tictactoe',
                            players: [{ id: 0 }, { id: 1 }],
                            setupData: { ownerKey: 'guest:e2e_guest', ownerType: 'guest', guestId: 'e2e_guest' },
                        }),
                    });
                } else {
                    await route.continue();
                }
            },
        );

        await hostContext.route(`${gameServerBaseURL}/games/tictactoe/${NEXT_MATCH_ID}/claim-seat`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ playerCredentials: 'e2e-new-credentials-guest' }),
            });
        });

        const hostPage = await hostContext.newPage();

        const guestContext = await browser.newContext({ baseURL });
        await setChineseLocale(guestContext);
        const guestPage = await guestContext.newPage();

        await hostPage.goto('/');
        await hostPage.getByRole('heading', { name: '井字棋' }).click();
        await hostPage.getByRole('button', { name: '创建房间' }).click();
        await expect(hostPage.getByRole('heading', { name: '创建房间' })).toBeVisible();
        await hostPage.getByRole('button', { name: '确认' }).click();

        await hostPage.waitForURL(/\/play\/tictactoe\/match\//);
        await expect(hostPage.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 15000 });

        const hostUrl = await ensureHostPlayerId(hostPage);
        const matchId = hostUrl.pathname.split('/').pop();
        if (!matchId) throw new Error('Failed to parse match id from host URL.');

        await guestPage.goto(`/play/tictactoe/match/${matchId}?join=true`);
        await expect(guestPage).toHaveURL(/playerID=\d/, { timeout: 30000 });
        await expect(guestPage.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 15000 });

        await clickCell(hostPage, 0);
        await waitForCellFilled(hostPage, 0);
        await waitForCellFilled(guestPage, 0);

        await clickCell(guestPage, 1);
        await waitForCellFilled(guestPage, 1);
        await waitForCellFilled(hostPage, 1);

        await clickCell(hostPage, 4);
        await waitForCellFilled(hostPage, 4);
        await waitForCellFilled(guestPage, 4);

        await clickCell(guestPage, 2);
        await waitForCellFilled(guestPage, 2);
        await waitForCellFilled(hostPage, 2);

        await clickCell(hostPage, 8);
        await waitForCellFilled(hostPage, 8);
        await waitForCellFilled(guestPage, 8);

        await expect(hostPage.getByText(/胜利|平局/i)).toBeVisible({ timeout: 15000 });

        const playAgainHost = hostPage.getByRole('button', { name: '再来一局' });
        const playAgainGuest = guestPage.getByRole('button', { name: '再来一局' });
        await expect(playAgainHost).toBeVisible({ timeout: 15000 });
        await expect(playAgainGuest).toBeVisible({ timeout: 15000 });

        await playAgainHost.click();
        await playAgainGuest.click();

        const nextMatchIdHost = await waitForNewMatch(hostPage, matchId);
        expect(nextMatchIdHost).toBe(NEXT_MATCH_ID);

        // 匿名用户：无 Authorization header，但 setupData.guestId 存在
        expect(capturedCreateAuthHeader).toBeNull();
        const setupData = (capturedCreateBody as Record<string, unknown> | null)?.['setupData'] as Record<string, unknown> | undefined;
        expect(typeof setupData?.guestId).toBe('string');
        expect((setupData?.guestId as string).length).toBeGreaterThan(0);

        await hostContext.close();
        await guestContext.close();
    });
});
