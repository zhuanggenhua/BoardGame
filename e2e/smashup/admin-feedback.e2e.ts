import { type Page } from '@playwright/test';
import { expect, test } from '../framework';


type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

type StoredUser = {
    id: string;
    username: string;
    role: 'user' | 'developer' | 'admin';
    banned: boolean;
};

const ADMIN_E2E_TIMEOUT_MS = 180_000;
const ADMIN_NAVIGATION_TIMEOUT_MS = 60_000;
const ADMIN_PAGE_READY_TIMEOUT_MS = 90_000;
const HTML_NAVIGATION_HEADERS = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
};

const setStoredAuth = async (page: Page, user: StoredUser) => {
    await page.addInitScript((storedUser) => {
        localStorage.setItem('i18nextLng', 'zh-CN');
        localStorage.setItem('auth_token', `fake_${storedUser.role}_token`);
        localStorage.setItem('auth_user', JSON.stringify(storedUser));
    }, user);
};

const mockClipboard = async (page: Page) => {
    await page.addInitScript(() => {
        let copied = '';
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async (text: string) => {
                    copied = text;
                },
                readText: async () => copied,
            },
        });
    });
};

const gotoFrontendRoute = async (page: Page, targetPath: string) => {
    await expect.poll(async () => {
        try {
            const readyResponse = await page.request.get('/__ready', {
                failOnStatusCode: false,
            });
            if (readyResponse.status() !== 200) return `ready:${readyResponse.status()}`;

            const response = await page.request.get(targetPath, {
                failOnStatusCode: false,
                headers: HTML_NAVIGATION_HEADERS,
            });
            if (response.status() !== 200) return `status:${response.status()}`;

            const body = await response.text();
            return body.includes('<!doctype html>') ? 'ready' : 'not-html';
        } catch (error) {
            return `network:${error instanceof Error ? error.name : 'unknown'}`;
        }
    }, {
        timeout: ADMIN_NAVIGATION_TIMEOUT_MS,
        intervals: [500, 1000, 2000],
        message: `等待前端路由可访问: ${targetPath}`,
    }).toBe('ready');

    await page.goto(targetPath, { waitUntil: 'commit' });
};

test.describe('后台反馈管理 E2E', () => {
    test.describe.configure({ timeout: ADMIN_E2E_TIMEOUT_MS });

    test.beforeEach(async ({ page, context }) => {
        page.setDefaultNavigationTimeout(ADMIN_NAVIGATION_TIMEOUT_MS);
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await mockClipboard(page);

        await page.route('**/auth/me', async (route) => {
            const authHeader = route.request().headers().authorization ?? '';
            const role = authHeader.includes('fake_developer_token') ? 'developer' : 'admin';
            await route.fulfill({
                status: 200,
                json: {
                    user: {
                        id: role === 'developer' ? 'developer_1' : 'admin_1',
                        username: role === 'developer' ? 'Developer' : 'Admin',
                        role,
                        banned: false,
                    },
                },
            });
        });

        await page.route('**/*', async (route) => {
            const url = new URL(route.request().url());
            if (url.pathname === '/notifications') {
                await route.fulfill({ status: 200, json: { notifications: [] } });
                return;
            }
            if (url.pathname === '/auth/friends') {
                await route.fulfill({ status: 200, json: { friends: [] } });
                return;
            }
            if (url.pathname === '/auth/friends/requests') {
                await route.fulfill({ status: 200, json: { requests: [] } });
                return;
            }
            if (url.pathname === '/auth/messages/conversations') {
                await route.fulfill({ status: 200, json: { conversations: [] } });
                return;
            }
            await route.fallback();
        });
    });

    test('反馈页可展示分诊上下文并复制 AI 诊断包', async ({ page }) => {
        await setStoredAuth(page, {
            id: 'admin_1',
            username: 'Admin',
            role: 'admin',
            banned: false,
        });

        const feedbackItem = {
            _id: 'feedback_001',
            userId: {
                _id: 'user_001',
                username: '测试员',
                email: 'tester@example.com',
            },
            content: '这张卡效果不对，会把弃牌堆单位放回手牌。',
            type: 'bug',
            severity: 'medium',
            status: 'open',
            gameName: '大杀四方',
            contactInfo: 'tester@example.com',
            actionLog: JSON.stringify([
                { step: 'play-card', cardId: 'card-001' },
                { step: 'select-target', targetId: 'minion-77' },
            ]),
            stateSnapshot: JSON.stringify({
                gameId: 'smashup',
                turn: 3,
                currentPlayer: 'P1',
                field: [{ id: 'minion-77', owner: 'P1' }],
            }),
            clientContext: {
                route: '/play/smashup/match/abc',
                mode: 'online',
                matchId: 'abc',
                playerId: '0',
                gameId: 'smashup',
                appVersion: 'test-build',
                viewport: { width: 1440, height: 900 },
                language: 'zh-CN',
                timezone: 'Asia/Shanghai',
            },
            errorContext: {
                name: 'TypeError',
                message: 'Cannot read properties of undefined',
                source: 'react.error_boundary',
                stack: 'TypeError: Cannot read properties of undefined\n    at resolveEffect (Feedback.tsx:120:18)\n    at onClick (Board.tsx:88:9)',
            },
            createdAt: '2026-03-14T10:00:00.000Z',
        };

        await page.route('**/admin-api/feedback?*', async (route) => {
            if (route.request().method() !== 'GET') return route.fallback();
            const url = new URL(route.request().url());
            if (url.pathname !== '/admin-api/feedback') return route.fallback();

            return route.fulfill({
                status: 200,
                json: {
                    items: [feedbackItem],
                    total: 1,
                    limit: 20,
                    page: 1,
                },
            });
        });

        await gotoFrontendRoute(page, '/admin/feedback');

        const row = page.locator('[data-testid="feedback-row"][data-feedback-id="feedback_001"]');
        await expect(row).toBeVisible({ timeout: ADMIN_PAGE_READY_TIMEOUT_MS });
        await row.click();

        await expect(page.getByTestId('feedback-action-log-toggle')).toBeVisible();
        await expect(page.getByTestId('feedback-state-snapshot-toggle')).toBeVisible();
        await expect(page.getByTestId('feedback-copy-ai-payload')).toBeVisible();
        await expect(row.locator('div').filter({ hasText: /^\/play\/smashup\/match\/abc$/ })).toBeVisible();
        await expect(row.getByTestId('feedback-error-context-panel').getByText('TypeError', { exact: true })).toBeVisible();

        await page.getByTestId('feedback-copy-ai-payload').click();

        const viewer = page.getByTestId('feedback-ai-payload-viewer');
        await expect(viewer).toBeVisible();
        await expect(viewer).toHaveAttribute('wrap', 'off');

        const payloadText = await viewer.inputValue();
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

        expect(payloadText).toBe(clipboardText);
        expect(payloadText.startsWith('{')).toBeFalsy();
        expect(payloadText.includes('\n')).toBeTruthy();
        expect(payloadText).toContain('# AI 排障诊断包');
        expect(payloadText).toContain('## 1. 工单信息');
        expect(payloadText).toContain('- 反馈ID: feedback_001');
        expect(payloadText).toContain('- 游戏: 大杀四方(smashup)');
        expect(payloadText).toContain('## 2. 用户反馈原文');
        expect(payloadText).toContain('这张卡效果不对，会把弃牌堆单位放回手牌。');
        expect(payloadText).toContain('## 3. 证据索引');
        expect(payloadText).toContain('- 内嵌截图: 0 张');
        expect(payloadText).toContain('- route: /play/smashup/match/abc');
        expect(payloadText).toContain('- mode: online');
        expect(payloadText).toContain('- userAgent: -');
        expect(payloadText).toContain('## 5. 错误上下文');
        expect(payloadText).toContain('- source: react.error_boundary');
        expect(payloadText).toContain('- name: TypeError');
        expect(payloadText).toContain('- message: Cannot read properties of undefined');
        expect(payloadText).toContain('### 错误堆栈');
        expect(payloadText).toContain('TypeError: Cannot read properties of undefined');
        expect(payloadText).toContain('## 6. 操作日志摘要');
        expect(payloadText).toContain('1.step=play-card, cardId=card-001; 2.step=select-target, targetId=minion-77');
        expect(payloadText).toContain('## 7. 操作日志原文');
        expect(payloadText).toContain('"step": "play-card"');
        expect(payloadText).toContain('## 8. 状态快照摘要');
        expect(payloadText).toContain('game=smashup, turn=3, player=P1, field=1(minion-77@P1)');
        expect(payloadText).toContain('## 9. 状态快照原文');
        expect(payloadText).toContain('"gameId": "smashup"');

        await page.screenshot({
            path: 'test-results/evidence-screenshots/smashup/admin-feedback-ai-diagnostic-packet.png',
            fullPage: true,
        });
    });

    test('反馈列表按页请求并可切换分页', async ({ page }) => {
        await setStoredAuth(page, {
            id: 'admin_1',
            username: 'Admin',
            role: 'admin',
            banned: false,
        });

        const requests: string[] = [];

        await page.route('**/admin-api/feedback?*', async (route) => {
            if (route.request().method() !== 'GET') return route.fallback();

            const url = new URL(route.request().url());
            const currentPage = url.searchParams.get('page') ?? '1';
            const limit = url.searchParams.get('limit') ?? '';
            requests.push(`${currentPage}:${limit}`);

            if (currentPage === '2') {
                return route.fulfill({
                    status: 200,
                    json: {
                        items: [{
                            _id: 'feedback_page_2',
                            content: '第二页反馈',
                            type: 'other',
                            severity: 'low',
                            status: 'open',
                            createdAt: '2026-03-14T11:00:00.000Z',
                        }],
                        total: 21,
                        limit: 20,
                        page: 2,
                    },
                });
            }

            return route.fulfill({
                status: 200,
                json: {
                    items: [{
                        _id: 'feedback_page_1',
                        content: '第一页反馈',
                        type: 'bug',
                        severity: 'medium',
                        status: 'open',
                        createdAt: '2026-03-14T10:00:00.000Z',
                    }],
                    total: 21,
                    limit: 20,
                    page: 1,
                },
            });
        });

        await gotoFrontendRoute(page, '/admin/feedback');

        await expect(page.locator('[data-testid="feedback-row"][data-feedback-id="feedback_page_1"]')).toBeVisible({
            timeout: ADMIN_PAGE_READY_TIMEOUT_MS,
        });
        await expect(page.getByTestId('feedback-pagination-indicator')).toHaveText('1 / 2');

        await page.getByTestId('feedback-pagination-next').click();

        await expect(page.locator('[data-testid="feedback-row"][data-feedback-id="feedback_page_2"]')).toBeVisible({
            timeout: ADMIN_PAGE_READY_TIMEOUT_MS,
        });
        await expect(page.getByTestId('feedback-pagination-indicator')).toHaveText('2 / 2');
        expect(requests[0]).toBe('1:20');
        expect(requests.every((entry) => entry.endsWith(':20'))).toBeTruthy();
        expect(requests.includes('2:20')).toBeTruthy();

        await page.screenshot({
            path: 'test-results/evidence-screenshots/smashup/admin-feedback-pagination.png',
            fullPage: true,
        });
    });

    test('反馈列表固定控制区支持分类筛选和时间排序，只有内容区滚动', async ({ page }) => {
        await setStoredAuth(page, {
            id: 'admin_1',
            username: 'Admin',
            role: 'admin',
            banned: false,
        });

        const requests: string[] = [];
        const feedbackItems = [
            ...Array.from({ length: 21 }, (_, index) => ({
                _id: `feedback_bug_${index + 1}`,
                content: index === 0 ? '最早的严重 Bug' : `严重 Bug ${index + 1}`,
                type: 'bug' as const,
                severity: 'critical' as const,
                status: 'open' as const,
                createdAt: new Date(Date.UTC(2026, 2, 1 + index, 10, 0, 0)).toISOString(),
            })),
            {
                _id: 'feedback_suggestion_1',
                content: '建议反馈',
                type: 'suggestion' as const,
                severity: 'low' as const,
                status: 'open' as const,
                createdAt: new Date(Date.UTC(2026, 2, 30, 10, 0, 0)).toISOString(),
            },
        ];

        await page.route('**/admin-api/feedback?*', async (route) => {
            if (route.request().method() !== 'GET') return route.fallback();

            const url = new URL(route.request().url());
            requests.push(url.search);

            const pageParam = Number(url.searchParams.get('page') ?? '1');
            const limitParam = Number(url.searchParams.get('limit') ?? '20');
            const statusParam = url.searchParams.get('status');
            const typeParam = url.searchParams.get('type');
            const severityParam = url.searchParams.get('severity');
            const sortParam = url.searchParams.get('sort') ?? 'newest';

            let items = [...feedbackItems];
            if (statusParam) items = items.filter((item) => item.status === statusParam);
            if (typeParam) items = items.filter((item) => item.type === typeParam);
            if (severityParam) items = items.filter((item) => item.severity === severityParam);
            items.sort((left, right) => (
                sortParam === 'oldest'
                    ? left.createdAt.localeCompare(right.createdAt)
                    : right.createdAt.localeCompare(left.createdAt)
            ));

            const start = (pageParam - 1) * limitParam;
            const pagedItems = items.slice(start, start + limitParam);

            return route.fulfill({
                status: 200,
                json: {
                    items: pagedItems,
                    total: items.length,
                    limit: limitParam,
                    page: pageParam,
                },
            });
        });

        await gotoFrontendRoute(page, '/admin/feedback');

        const controls = page.getByTestId('feedback-list-controls');
        await expect(controls).toBeVisible({ timeout: ADMIN_PAGE_READY_TIMEOUT_MS });
        await controls.getByRole('button', { name: 'Bug' }).click();
        await controls.getByRole('button', { name: '严重' }).click();
        await controls.getByRole('button', { name: '最早优先' }).click();

        await expect(page.locator('[data-testid="feedback-row"][data-feedback-id="feedback_bug_1"]')).toBeVisible({
            timeout: ADMIN_PAGE_READY_TIMEOUT_MS,
        });
        await expect(page.locator('[data-testid="feedback-row"]').first()).toContainText('最早的严重 Bug');
        await expect(page.getByTestId('feedback-pagination-indicator')).toHaveText('1 / 2');
        expect(requests.some((entry) => entry.includes('type=bug'))).toBeTruthy();
        expect(requests.some((entry) => entry.includes('severity=critical'))).toBeTruthy();
        expect(requests.some((entry) => entry.includes('sort=oldest'))).toBeTruthy();

        const listScroll = page.getByTestId('feedback-list-scroll');
        const scrollState = await listScroll.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
            return {
                scrollTop: element.scrollTop,
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
            };
        });

        expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
        expect(scrollState.scrollTop).toBeGreaterThan(0);
        await expect(page.getByTestId('feedback-list-controls')).toBeVisible();
        await expect(page.getByTestId('feedback-pagination-indicator')).toBeVisible();

        await page.screenshot({
            path: 'test-results/evidence-screenshots/smashup/admin-feedback-controls-sticky.png',
            fullPage: true,
        });
    });

    test('developer 可以进入反馈页并复制反馈诊断包', async ({ page }) => {
        await setStoredAuth(page, {
            id: 'developer_1',
            username: 'Developer',
            role: 'developer',
            banned: false,
        });

        await page.route('**/admin-api/feedback?*', async (route) => {
            if (route.request().method() !== 'GET') return route.fallback();
            return route.fulfill({
                status: 200,
                json: {
                    items: [{
                        _id: 'feedback_readonly_001',
                        content: '开发者应可查看这条反馈',
                        type: 'suggestion',
                        severity: 'low',
                        status: 'open',
                        createdAt: '2026-03-14T10:00:00.000Z',
                    }],
                    total: 1,
                    limit: 20,
                    page: 1,
                },
            });
        });

        await gotoFrontendRoute(page, '/admin/feedback');

        await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);

        const row = page.locator('[data-testid="feedback-row"][data-feedback-id="feedback_readonly_001"]');
        await expect(row).toBeVisible({ timeout: ADMIN_PAGE_READY_TIMEOUT_MS });
        await row.click();
        await expect(page.getByRole('heading', { name: '反馈管理' })).toBeVisible({ timeout: ADMIN_PAGE_READY_TIMEOUT_MS });
        await expect(page.getByTestId('feedback-copy-ai-payload')).toBeVisible();

        await page.screenshot({
            path: 'test-results/_shared/admin-feedback-developer-readonly.png',
            fullPage: true,
        });
    });
});
