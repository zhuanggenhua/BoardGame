import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';
import type { Locator, Page } from '@playwright/test';

const REVIEW_MOBILE_SCREENSHOT_PATH = 'test-results/evidence-screenshots/tictactoe/review-form-mobile-input-visible.png';

const mockUser = {
    id: 'user-review-test',
    username: '评测者',
    email: 'reviewer@example.com',
    emailVerified: true,
    role: 'user',
    banned: false,
};

async function clickButtonViaDom(locator: Locator, errorMessage: string) {
    await expect(locator).toBeVisible({ timeout: 10000 });
    await locator.evaluate((element, message) => {
        if (!(element instanceof HTMLElement)) {
            throw new Error(typeof message === 'string' ? message : '目标节点不是 HTMLElement');
        }
        element.click();
    }, errorMessage);
}

async function openTicTacToeDetailsModal(page: Page): Promise<void> {
    const closeServiceUnavailableIfNeeded = async () => {
        const serviceUnavailable = page.getByRole('heading', { name: /Service Unavailable|服务不可用/i });
        if (await serviceUnavailable.isVisible().catch(() => false)) {
            await page.getByRole('button', { name: /Close|关闭/i }).first().click();
        }
    };

    await page.goto('/', { waitUntil: 'commit', timeout: 15000 });
    await closeServiceUnavailableIfNeeded();
    const gameEntry = page.locator('[data-game-id="tictactoe"]').first();
    await expect(gameEntry).toBeVisible({ timeout: 15000 });
    await gameEntry.click();
    await expect(page).toHaveURL(/game=tictactoe/);

    const detailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').last();
    await expect(detailsModal).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="game-details-sidebar"]:visible').last()).toBeVisible({ timeout: 10000 });
}

test.describe('游戏评价系统', () => {
    test.beforeEach(async ({ page }) => {
        await setChineseLocale(page);
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

    });

    test('已登录用户可以发布评价', async ({ page }) => {
        await openTicTacToeDetailsModal(page);
        // 1. Switch to Reviews tab and ensure stats visible
        const modalRoot = page.locator('#modal-root');
        const detailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').last();
        const reviewsTab = detailsModal.getByRole('button', { name: '评价' });
        await clickButtonViaDom(reviewsTab, '评价标签节点不是 button');
        await expect(modalRoot.getByText('评价较少')).toBeVisible();

        // 2. Mock create review response
        await page.route('**/auth/reviews/tictactoe', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    json: {
                        isPositive: true,
                        content: '游戏不错！',
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
        const writeButton = modalRoot.getByRole('button', { name: '写评价' });
        await expect(writeButton).toBeVisible();
        await writeButton.click();

        // 4. Fill and submit form
        await expect(modalRoot.getByText(/撰写评价|修改我的评价/)).toBeVisible();

        const positiveBtn = modalRoot.getByRole('button', { name: /^推荐$/ });
        await expect(positiveBtn).toBeVisible({ timeout: 10000 });
        await positiveBtn.click();

        const textarea = modalRoot.getByPlaceholder('写点什么...');
        await textarea.fill('游戏不错！');

        const submitBtn = modalRoot.getByRole('button', { name: '发布评论' });

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
                        content: '游戏不错！',
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
                    content: '游戏不错！',
                    user: { _id: mockUser.id }
                }
            });
        });

        await submitBtn.click();

        // 4. Verify toast or update
        await expect(page.getByText('评价已发布')).toBeVisible();
        await expect(page.getByText(/100%\s*好评/i)).toBeVisible();
        await expect(page.getByText('评测者', { exact: true })).toBeVisible();
    });

    test('移动端评价输入聚焦后仍应保持可见', async ({ page }) => {
        test.setTimeout(90000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openTicTacToeDetailsModal(page);

        const modalRoot = page.locator('#modal-root');
        const detailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').last();
        const reviewTab = detailsModal.getByRole('button', { name: '评价' });
        await clickButtonViaDom(reviewTab, '评价标签节点不是可点击元素');
        await expect(detailsModal).toBeVisible({ timeout: 10000 });
        await expect(detailsModal.getByText('评价较少')).toBeVisible({ timeout: 10000 });

        const writeButton = detailsModal.getByRole('button', { name: '写评价' });
        await clickButtonViaDom(writeButton, '写评价按钮节点不是可点击元素');
        await expect(modalRoot.getByText(/撰写评价|修改我的评价/)).toBeVisible({ timeout: 10000 });

        const positiveBtn = modalRoot.getByRole('button', { name: /^推荐$/ });
        await positiveBtn.click();

        await page.evaluate(() => {
            const root = document.documentElement;
            root.style.setProperty('--runtime-viewport-height', '564px');
            root.style.setProperty('--keyboard-inset-height', '280px');
            root.dataset.keyboardVisible = 'true';
        });

        const textarea = modalRoot.getByPlaceholder('写点什么...');
        await textarea.click();
        await textarea.fill('移动端评价输入可见性校验');
        await expect(textarea).toHaveValue('移动端评价输入可见性校验');

        const submitBtn = modalRoot.getByRole('button', { name: '发布评论' });
        const metrics = await textarea.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            const fontSize = Number.parseFloat(window.getComputedStyle(node).fontSize || '0');
            const runtimeViewportHeight = Number.parseFloat(
                window.getComputedStyle(document.documentElement).getPropertyValue('--runtime-viewport-height') || '0',
            );
            return {
                right: rect.right,
                bottom: rect.bottom,
                viewportWidth: window.innerWidth,
                runtimeViewportHeight,
                fontSize,
            };
        });
        const submitMetrics = await submitBtn.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            const runtimeViewportHeight = Number.parseFloat(
                window.getComputedStyle(document.documentElement).getPropertyValue('--runtime-viewport-height') || '0',
            );
            return {
                bottom: rect.bottom,
                runtimeViewportHeight,
            };
        });

        expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.bottom).toBeLessThanOrEqual(metrics.runtimeViewportHeight);
        expect(metrics.fontSize).toBeGreaterThanOrEqual(16);
        expect(submitMetrics.bottom).toBeLessThanOrEqual(submitMetrics.runtimeViewportHeight);

        await page.screenshot({
            path: REVIEW_MOBILE_SCREENSHOT_PATH,
            fullPage: false,
        });
    });
});
