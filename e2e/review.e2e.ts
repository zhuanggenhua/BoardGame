import { test, expect } from '@playwright/test';

const mockUser = {
    id: 'user-review-test',
    username: 'ReviewerBot',
    email: 'reviewer@example.com',
    emailVerified: true,
    role: 'user',
    banned: false,
};

test.describe('Game Review System', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('i18nextLng', 'en');
        });
        await page.addInitScript((user) => {
            localStorage.setItem('auth_token', 'e2e-token');
            localStorage.setItem('auth_user', JSON.stringify(user));
        }, mockUser);
        // Mock user login
        await page.route('**/auth/me', async route => {
            await route.fulfill({ json: { user: mockUser }, status: 200 });
        });

        // Mock initial stats (empty)
        await page.route('**/auth/reviews/*/stats', async route => {
            await route.fulfill({
                json: {
                    gameId: 'tictactoe',
                    positive: 0,
                    negative: 0,
                    total: 0,
                    rate: 0
                }
            });
        });

        // Mock my review (not reviewed yet)
        await page.route('**/auth/reviews/*/mine', async route => {
            await route.fulfill({ status: 404 });
        });

        // Mock reviews list (empty)
        await page.route('**/auth/reviews/*?*', async route => {
            await route.fulfill({
                json: {
                    items: [],
                    page: 1,
                    limit: 5,
                    total: 0,
                    hasMore: false
                }
            });
        });

        await page.route('**/auth/reviews/*', async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    json: {
                        items: [],
                        page: 1,
                        limit: 5,
                        total: 0,
                        hasMore: false
                    }
                });
            } else {
                await route.fallback();
            }
        });

        await page.goto('/?game=tictactoe');
    });

    test('should allow a logged-in user to post a review', async ({ page }) => {
        const serviceUnavailable = page.getByRole('heading', { name: /Service Unavailable|服务不可用/i });
        if (await serviceUnavailable.isVisible().catch(() => false)) {
            await page.getByRole('button', { name: /Close|关闭/i }).first().click();
        }
        // 1. Switch to Reviews tab and ensure stats visible
        const modalRoot = page.locator('#modal-root');
        const reviewsTab = modalRoot.getByRole('button', { name: /^(Reviews|评价)$/i });
        await reviewsTab.click();
        await expect(modalRoot.getByText(/Few Reviews|评价较少/i)).toBeVisible();

        // 2. Mock create review response
        await page.route('**/auth/reviews/tictactoe', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    json: {
                        isPositive: true,
                        content: 'Great game!',
                        createdAt: new Date().toISOString(),
                        user: { _id: mockUser.id, username: mockUser.username }
                    }
                });
                return;
            }
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    json: {
                        items: [],
                        page: 1,
                        limit: 5,
                        total: 0,
                        hasMore: false
                    }
                });
                return;
            }
            await route.fallback();
        });

        // 3. Open review modal
        const writeButton = modalRoot.getByRole('button', { name: /^(写评价|撰写评价|Write Review)$/i });
        await expect(writeButton).toBeVisible();
        await writeButton.click();

        // 4. Fill and submit form
        await expect(modalRoot.getByText(/撰写评价|修改我的评价|Write a Review|Edit My Review/i)).toBeVisible();

        const positiveBtn = modalRoot.getByRole('button', { name: /^(推荐|Recommend)$/i });
        await expect(positiveBtn).toBeVisible({ timeout: 10000 });
        await positiveBtn.click();

        const textarea = modalRoot.getByPlaceholder(/写点什么|Write something/i);
        await textarea.fill('Great game!');

        const submitBtn = modalRoot.getByRole('button', { name: /发布评论|Post Review/i });

        // Mock refresh stats after submit
        await page.route('**/auth/reviews/tictactoe/stats', async route => {
            await route.fulfill({
                json: {
                    gameId: 'tictactoe',
                    positive: 1,
                    negative: 0,
                    total: 1,
                    rate: 100
                }
            });
        });

        // Mock refresh list after submit
        await page.route('**/auth/reviews/tictactoe?*', async route => {
            await route.fulfill({
                json: {
                    items: [{
                        isPositive: true,
                        content: 'Great game!',
                        createdAt: new Date().toISOString(),
                        user: { _id: mockUser.id, username: mockUser.username }
                    }],
                    page: 1,
                    limit: 5,
                    total: 1,
                    hasMore: false
                }
            });
        });

        // Mock refresh my review
        await page.route('**/auth/reviews/tictactoe/mine', async route => {
            await route.fulfill({
                json: {
                    isPositive: true,
                    content: 'Great game!',
                    user: { _id: mockUser.id }
                }
            });
        });

        await submitBtn.click();

        // 4. Verify toast or update
        await expect(page.getByText(/评价已发布|Review saved|Review posted/i)).toBeVisible();
        await expect(page.getByText(/100%\s*(好评|Positive)/i)).toBeVisible(); // stats updated
        await expect(page.getByText('ReviewerBot', { exact: true })).toBeVisible(); // list updated
    });
});
