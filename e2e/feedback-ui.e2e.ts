import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { setChineseLocale } from './helpers/common';

const SCREENSHOT_DIR = 'test-results/evidence-screenshots/feedback-ui';
const HTML_NAVIGATION_HEADERS = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
};
const E2E_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZWVkYmFja191aV91c2VyIiwidXNlcm5hbWUiOiLlj43ppojnjqkiLCJpYXQiOjE3MTY1MDAwMDAsImV4cCI6NDEwMjQ0NDgwMH0.sig';

type StoredUser = {
    id: string;
    username: string;
    email: string;
    emailVerified: boolean;
    role: 'user' | 'developer' | 'admin';
    banned: boolean;
    feedbackPoints: number;
    avatar?: string | null;
};

async function waitForFrontendRoute(page: Page, targetPath: string) {
    await expect.poll(async () => {
        try {
            const readyResponse = await page.request.get('/__ready', { failOnStatusCode: false });
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
        timeout: 60_000,
        intervals: [500, 1000, 2000],
        message: `等待前端路由可访问: ${targetPath}`,
    }).toBe('ready');
}

async function seedLoggedInUser(page: Page, user: StoredUser) {
    await page.addInitScript(({ token, storedUser }) => {
        localStorage.setItem('i18nextLng', 'zh-CN');
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(storedUser));
    }, {
        token: E2E_AUTH_TOKEN,
        storedUser: user,
    });
}

async function mockCommonAuthedApis(page: Page, user: StoredUser) {
    await page.route('**/auth/me', async (route) => {
        await route.fulfill({
            status: 200,
            json: {
                user,
            },
        });
    });

    await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/notifications') {
            await route.fulfill({ status: 200, json: { notifications: [] } });
            return;
        }
        if (url.pathname === '/notifications/read-state') {
            if (route.request().method() === 'POST') {
                await route.fulfill({ status: 200, json: { success: true } });
                return;
            }
            await route.fulfill({ status: 200, json: { lastSeenAt: null } });
            return;
        }
        if (url.pathname === '/auth/friends') {
            await route.fulfill({ status: 200, json: { items: [], friends: [], total: 0 } });
            return;
        }
        if (url.pathname === '/auth/friends/requests') {
            await route.fulfill({ status: 200, json: { items: [], requests: [], total: 0 } });
            return;
        }
        if (url.pathname === '/auth/messages/conversations') {
            await route.fulfill({ status: 200, json: { conversations: [] } });
            return;
        }
        await route.fallback();
    });
}

async function openUserMenu(page: Page) {
    const trigger = page.getByTestId('user-menu-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();
}

test.describe('反馈 UI E2E', () => {
    test.describe.configure({ timeout: 180_000 });

    test.beforeEach(async ({ context }) => {
        await setChineseLocale(context);
        mkdirSync(SCREENSHOT_DIR, { recursive: true });
    });

    test('普通用户右上角应显示积分并隐藏后台入口，且我的反馈弹窗展示关闭理由与积分', async ({ page }) => {
        const user: StoredUser = {
            id: 'feedback_user_1',
            username: '反馈玩家',
            email: 'feedback-user@example.com',
            emailVerified: true,
            role: 'user',
            banned: false,
            feedbackPoints: 7,
            avatar: null,
        };

        await seedLoggedInUser(page, user);
        await mockCommonAuthedApis(page, user);

        let myFeedbackDeleted = false;
        let myFeedbackRequestedSummaryOnly = false;
        let myFeedbackDetailRequested = false;
        await page.route('**/admin/feedback?*', async (route) => {
            const url = new URL(route.request().url());
            if (url.pathname !== '/admin/feedback') {
                await route.fallback();
                return;
            }
            if (url.searchParams.get('mineOnly') !== 'true') {
                await route.fallback();
                return;
            }
            myFeedbackRequestedSummaryOnly = url.searchParams.get('summaryOnly') === 'true';
            await route.fulfill({
                status: 200,
                json: {
                    items: myFeedbackDeleted ? [] : [{
                        _id: 'my_feedback_1',
                        contentPreview: '基地描述抽牌数量看起来不对。',
                        hasEmbeddedImage: false,
                        type: 'bug',
                        status: 'closed',
                        gameName: '大杀四方',
                        closedReason: '已核对为旧描述残留，现已按最新规则修正。',
                        rewardPoints: 1,
                        createdAt: '2026-06-06T10:00:00.000Z',
                    }],
                },
            });
        });
        await page.route('**/admin/feedback/my_feedback_1', async (route) => {
            if (route.request().method() === 'GET') {
                myFeedbackDetailRequested = true;
                await route.fulfill({
                    status: 200,
                    json: {
                        _id: 'my_feedback_1',
                        content: '基地描述抽牌数量看起来不对。完整详情里补充：回合结束后抽牌数量仍显示旧文本。',
                        contentPreview: '基地描述抽牌数量看起来不对。',
                        hasEmbeddedImage: false,
                        type: 'bug',
                        status: 'closed',
                        gameName: '大杀四方',
                        closedReason: '已核对为旧描述残留，现已按最新规则修正。',
                        rewardPoints: 1,
                        createdAt: '2026-06-06T10:00:00.000Z',
                    },
                });
                return;
            }
            if (route.request().method() !== 'DELETE') {
                await route.fallback();
                return;
            }
            myFeedbackDeleted = true;
            await route.fulfill({
                status: 200,
                json: { ok: true },
            });
        });

        await waitForFrontendRoute(page, '/');
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await expect(page.getByTestId('user-menu-trigger')).toBeVisible({ timeout: 30_000 });
        const triggerBadge = page.getByTestId('user-menu-trigger').getByTestId('reward-points-badge');
        await expect(triggerBadge).toHaveText('7');

        await openUserMenu(page);
        await expect(page.getByTestId('user-menu-my-feedback')).toBeVisible();
        await expect(page.getByText('后台入口')).toHaveCount(0);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/01-user-menu-reward-points-and-my-feedback-entry.png`,
            fullPage: true,
        });

        await page.getByTestId('user-menu-my-feedback').click();

        const myFeedbackModal = page.getByTestId('my-feedback-modal');
        await expect(myFeedbackModal).toBeVisible();
        await expect(myFeedbackModal).toContainText('我的反馈');
        expect(myFeedbackRequestedSummaryOnly).toBe(true);
        expect(myFeedbackDetailRequested).toBe(false);
        await expect(myFeedbackModal).toContainText('基地描述抽牌数量看起来不对。');
        await expect(myFeedbackModal).toContainText('已核对为旧描述残留，现已按最新规则修正。');
        await expect(myFeedbackModal.getByTestId('reward-points-badge')).toContainText('+1');
        await myFeedbackModal.getByTestId('my-feedback-expand').click();
        await expect(myFeedbackModal).toContainText('完整详情里补充');
        expect(myFeedbackDetailRequested).toBe(true);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/02-my-feedback-modal-with-close-reason-and-reward.png`,
            fullPage: true,
        });

        page.once('dialog', async (dialog) => {
            expect(dialog.message()).toContain('确定删除这条反馈');
            await dialog.accept();
        });
        await myFeedbackModal.getByTestId('my-feedback-delete').click();
        await expect(myFeedbackModal.locator('[data-testid="my-feedback-item"][data-feedback-id="my_feedback_1"]')).toHaveCount(0);
        await expect(myFeedbackModal).toContainText('你还没有提交过反馈');
    });

    test('反馈提交成功后应显示积分 +1 toast，并同步更新右上角积分', async ({ page }) => {
        const user: StoredUser = {
            id: 'feedback_user_2',
            username: 'Toast玩家',
            email: 'feedback-toast@example.com',
            emailVerified: true,
            role: 'user',
            banned: false,
            feedbackPoints: 3,
            avatar: null,
        };

        await seedLoggedInUser(page, user);
        await mockCommonAuthedApis(page, user);

        await page.route('**/feedback', async (route) => {
            if (route.request().method() !== 'POST') {
                await route.fallback();
                return;
            }
            await route.fulfill({
                status: 201,
                json: {
                    _id: 'feedback_reward_1',
                    content: '反馈成功积分样式验证',
                    reporterType: 'user',
                    source: 'feedback-modal',
                    status: 'open',
                    rewardPoints: 1,
                },
            });
        });

        await waitForFrontendRoute(page, '/');
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('user-menu-trigger').getByTestId('reward-points-badge')).toHaveText('3');

        await page.locator('[data-fab-id="settings"]').click();
        await expect(page.locator('[data-fab-id="feedback"]')).toBeVisible();
        await page.locator('[data-fab-id="feedback"]').click();

        const feedbackModal = page.getByTestId('feedback-modal');
        await expect(feedbackModal).toBeVisible();
        await feedbackModal.getByPlaceholder(/请描述问题或建议/).fill('反馈成功积分样式验证');
        await feedbackModal.getByRole('button', { name: '提交反馈' }).click();

        await expect(page.getByText('反馈成功')).toBeVisible();
        await expect(page.locator('[data-testid="reward-points-badge"]', { hasText: '+1' }).last()).toBeVisible();
        await expect(page.getByTestId('user-menu-trigger').getByTestId('reward-points-badge')).toHaveText('4');

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/03-feedback-success-toast-with-reward-plus-one.png`,
            fullPage: true,
        });
    });
});
