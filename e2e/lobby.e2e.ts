import type { Page } from '@playwright/test';
import { test, expect } from './framework';

function isRetryableNavigationError(error: unknown): boolean {
    return error instanceof Error
        && (
            error.message.includes('ERR_ABORTED')
            || error.message.includes('frame was detached')
            || error.message.includes('ERR_CONNECTION_REFUSED')
        );
}

async function gotoLobbyWithRetry(page: Page): Promise<void> {
    const maxAttempts = 15;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await page.goto('/', { waitUntil: 'commit', timeout: 10000 });
            return;
        } catch (error) {
            if (!isRetryableNavigationError(error) || attempt === maxAttempts) {
                throw error;
            }

            await page.waitForTimeout(2000);
        }
    }
}

async function ensureLobbyReady(page: Page): Promise<void> {
    const maxAttempts = 6;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        await gotoLobbyWithRetry(page);

        try {
            await expect(page.getByRole('heading', { name: /Tic-Tac-Toe/i })).toBeVisible({ timeout: 10000 });
            return;
        } catch (error) {
            if (attempt === maxAttempts) {
                throw error;
            }
            await page.waitForTimeout(1500);
        }
    }
}

const MOBILE_AUTHOR_ENTRY_TEST_NAME = '移动端游戏详情隐藏描述和推荐人数，作者入口位于右上角且无包围框';

test.describe('Lobby E2E', () => {
    test.describe.configure({ timeout: 90000 });

    test.beforeEach(async ({ page }, testInfo) => {
        await page.addInitScript(() => {
            localStorage.setItem('i18nextLng', 'en');
        });
        if (testInfo.title === MOBILE_AUTHOR_ENTRY_TEST_NAME) {
            return;
        }
        await ensureLobbyReady(page);
    });

    test('Category filters show expected games', async ({ page }) => {
        await page.getByRole('button', { name: /Tools/i }).click();
        await expect(page.getByRole('heading', { name: /Asset Slicer/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Dice Throne/i })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: /Tic-Tac-Toe/i })).toHaveCount(0);

        await page.getByRole('button', { name: /All Games/i }).click();
        await expect(page.getByRole('heading', { name: /Dice Throne/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Tic-Tac-Toe/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Asset Slicer/i })).toHaveCount(0);
    });

    test('Game details modal opens and shows actions', async ({ page }) => {
        await page.getByRole('heading', { name: /Tic-Tac-Toe/i }).click();
        await expect(page).toHaveURL(/game=tictactoe/);

        await expect(page.getByRole('button', { name: /Create Room/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Single Device/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Play AI/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Tutorial/i })).toBeVisible();

        await page.getByRole('button', { name: /Leaderboard/i }).click();
        await expect(page.getByRole('heading', { name: /Top Wins/i, level: 4 })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/Loading/i)).toHaveCount(0, { timeout: 10000 });
    });

    test('Tic-Tac-Toe 对战AI入口会直接进入本地逻辑 AI 对局', async ({ page, game }, testInfo) => {
        await page.addInitScript(() => {
            (window as Window & { __BG_E2E_DEBUG__?: boolean }).__BG_E2E_DEBUG__ = true;
        });

        await page.getByRole('heading', { name: /Tic-Tac-Toe/i }).click();
        await expect(page).toHaveURL(/game=tictactoe/);

        await page.getByRole('button', { name: /Play AI/i }).click();

        await expect(page).toHaveURL(/\/play\/tictactoe\/local/);
        await expect(page.getByTestId('debug-toggle')).toBeVisible({ timeout: 15000 });

        await page.getByTestId('debug-toggle').click();
        await expect(page.getByTestId('debug-panel')).toBeVisible();

        await page.getByTestId('debug-tab-controls').click();
        await expect(page.getByTestId('debug-ai-support')).toBeVisible();
        await expect(page.getByTestId('debug-ai-seat-controller-1')).toContainText(/Local AI/i);

        await game.screenshot('lobby-tictactoe-local-ai-config-debug', testInfo);
    });

    test('Tic-Tac-Toe 单机模式入口不会把第二个座位交给 AI', async ({ page, game }, testInfo) => {
        await page.addInitScript(() => {
            (window as Window & { __BG_E2E_DEBUG__?: boolean }).__BG_E2E_DEBUG__ = true;
        });

        await page.getByRole('heading', { name: /Tic-Tac-Toe/i }).click();
        await expect(page).toHaveURL(/game=tictactoe/);

        await page.getByRole('button', { name: /Single Device/i }).click();

        await expect(page).toHaveURL(/\/play\/tictactoe\/local(\?seat1=human)?$/);
        await expect(page.getByTestId('debug-toggle')).toBeVisible({ timeout: 15000 });

        await page.getByTestId('debug-toggle').click();
        await expect(page.getByTestId('debug-panel')).toBeVisible();

        await page.getByTestId('debug-tab-controls').click();
        await expect(page.getByTestId('debug-ai-support')).toBeVisible();
        await expect(page.getByTestId('debug-ai-seat-controller-1')).toContainText(/Human/i);

        await game.screenshot('lobby-tictactoe-single-device-human-seat-debug', testInfo);
    });

    test(MOBILE_AUTHOR_ENTRY_TEST_NAME, async ({ page, game }, testInfo) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/?game=tictactoe', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/game=tictactoe/);

        const sidebar = page.getByTestId('game-details-sidebar');
        const mobileAuthorButton = page.getByTestId('game-details-author-button-mobile');

        await expect(sidebar).toBeVisible({ timeout: 15000 });
        await expect(mobileAuthorButton).toBeVisible();
        await expect(page.getByTestId('game-details-description')).toBeHidden();
        await expect(page.getByTestId('game-details-player-recommendation')).toBeHidden();

        const sidebarBox = await sidebar.boundingBox();
        const buttonBox = await mobileAuthorButton.boundingBox();
        expect(sidebarBox).not.toBeNull();
        expect(buttonBox).not.toBeNull();

        if (!sidebarBox || !buttonBox) {
            throw new Error('移动端作者入口或详情侧栏未正确渲染，无法校验位置');
        }

        const topOffset = buttonBox.y - sidebarBox.y;
        const rightOffset = sidebarBox.x + sidebarBox.width - (buttonBox.x + buttonBox.width);
        const buttonCenterX = buttonBox.x + buttonBox.width / 2;
        const sidebarCenterX = sidebarBox.x + sidebarBox.width / 2;

        expect(topOffset).toBeGreaterThanOrEqual(0);
        expect(topOffset).toBeLessThan(24);
        expect(rightOffset).toBeGreaterThanOrEqual(0);
        expect(rightOffset).toBeLessThan(24);
        expect(buttonCenterX).toBeGreaterThan(sidebarCenterX);

        const mobileAuthorButtonStyles = await mobileAuthorButton.evaluate((element) => {
            const styles = window.getComputedStyle(element);
            return {
                backgroundColor: styles.backgroundColor,
                borderTopWidth: styles.borderTopWidth,
                borderTopStyle: styles.borderTopStyle,
                boxShadow: styles.boxShadow,
            };
        });
        const normalizedBoxShadow = mobileAuthorButtonStyles.boxShadow.replace(/\s+/g, ' ').trim();

        expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(mobileAuthorButtonStyles.backgroundColor);
        expect(mobileAuthorButtonStyles.borderTopWidth).toBe('0px');
        expect(mobileAuthorButtonStyles.borderTopStyle).toBe('none');
        expect(
            normalizedBoxShadow === 'none'
            || /^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(, rgba\(0, 0, 0, 0\) 0px 0px 0px 0px)*$/.test(normalizedBoxShadow)
        ).toBeTruthy();

        await game.screenshot('lobby-mobile-author-entry-right-top', testInfo);

        await mobileAuthorButton.click();
        await expect(page.getByTestId('game-details-author-modal')).toBeVisible();

        await game.screenshot('lobby-mobile-author-modal-open', testInfo);
    });

    test('Dice Throne 更新日志 tab 会请求公开接口并结束 loading', async ({ page }) => {
        await page.getByRole('heading', { name: /Dice Throne/i }).click();
        await expect(page).toHaveURL(/game=dicethrone/);

        const changelogResponsePromise = page.waitForResponse((response) => {
            return response.url().includes('/game-changelogs/dicethrone') && response.request().method() === 'GET';
        });

        await page.getByRole('button', { name: /Updates/i }).click();

        const changelogResponse = await changelogResponsePromise;
        expect(changelogResponse.status()).toBe(200);

        const payload = await changelogResponse.json();
        expect(Array.isArray(payload.changelogs)).toBeTruthy();

        await expect(page.getByText(/Loading changelog/i)).toHaveCount(0, { timeout: 10000 });

        if (payload.changelogs.length > 0) {
            await expect(page.getByText(payload.changelogs[0].title)).toBeVisible({ timeout: 10000 });
            return;
        }

        await expect(page.getByText(/No updates yet|Failed to load changelog/i)).toBeVisible({ timeout: 10000 });
    });

    test('Dice Throne 更新日志 tab 会渲染接口返回的已发布内容', async ({ page, game }, testInfo) => {
        await page.route('**/game-changelogs/dicethrone', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    changelogs: [
                        {
                            id: 'cl-dicethrone-1',
                            gameId: 'dicethrone',
                            title: 'Balance Update',
                            versionLabel: 'v0.1.3',
                            content: 'Pyromancer burn tooltip now matches the published rules.',
                            pinned: true,
                            published: true,
                            publishedAt: '2026-03-12T00:00:00.000Z',
                            createdAt: '2026-03-12T00:00:00.000Z',
                            updatedAt: '2026-03-12T00:00:00.000Z',
                        },
                    ],
                }),
            });
        });

        await page.getByRole('heading', { name: /Dice Throne/i }).click();
        await expect(page).toHaveURL(/game=dicethrone/);

        await page.getByRole('button', { name: /Updates/i }).click();

        await expect(page.getByText('Balance Update')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('v0.1.3')).toBeVisible();
        await expect(page.getByText('Pinned')).toBeVisible();
        await expect(page.getByText('Pyromancer burn tooltip now matches the published rules.')).toBeVisible();

        await game.screenshot('lobby-dicethrone-changelog-renders-published-entry', testInfo);
    });
});
