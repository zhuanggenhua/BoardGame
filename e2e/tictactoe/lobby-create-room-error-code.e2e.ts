import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { resetMatchStorage, setChineseLocale } from '../helpers/common';

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
            await expect(page.getByRole('heading', { name: '井字棋' })).toBeVisible({ timeout: 10000 });
            return;
        } catch (error) {
            if (attempt === maxAttempts) {
                throw error;
            }
            await page.waitForTimeout(1500);
        }
    }
}

test.describe('Lobby create room error code E2E', () => {
    test.beforeEach(async ({ page }) => {
        await setChineseLocale(page);
        await resetMatchStorage(page, 'lobby-create-room-error-code-e2e');
        await ensureLobbyReady(page);
    });

    test('网页端创建房间失败时会显示错误码和状态码', async ({ page, game }, testInfo) => {
        let interceptedCreateRoom = false;

        await page.route(/\/games\/tictactoe\/create(?:\?.*)?$/, async (route) => {
            interceptedCreateRoom = true;
            await route.fulfill({
                status: 401,
                contentType: 'text/plain; charset=utf-8',
                body: 'Invalid token',
            });
        });

        await page.getByRole('heading', { name: '井字棋' }).click();
        await expect(page).toHaveURL(/game=tictactoe/);
        await expect(page.getByTestId('game-details-modal-root').last()).toBeVisible({ timeout: 15000 });

        const gameDetailsModal = page.getByTestId('game-details-modal-root').last();
        await gameDetailsModal.getByRole('button', { name: '创建房间' }).last().click({ force: true });
        await expect(page.getByRole('heading', { name: '创建房间' })).toBeVisible({ timeout: 10000 });

        await page.locator('.modal-base-container button').last().click({ force: true });

        await expect.poll(() => interceptedCreateRoom).toBeTruthy();
        await expect(page.getByText('创建房间失败').last()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('登录信息已过期或无效，请重新登录后再试。').last()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('错误码：INVALID_TOKEN').last()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('状态码：401').last()).toBeVisible({ timeout: 10000 });

        await game.screenshot('lobby-create-room-error-code-visible', testInfo);
    });

    test('建房成功但本地凭据写入失败时，只提示返回大厅重新进入，不再误报创建失败', async ({ page, game }, testInfo) => {
        let interceptedCreateRoom = false;

        await page.route(/\/games\/tictactoe\/create(?:\?.*)?$/, async (route) => {
            interceptedCreateRoom = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({
                    matchID: 'match-post-create-failed',
                    ownerPlayerID: '0',
                    ownerCredentials: 'owner-creds',
                }),
            });
        });

        await page.evaluate(() => {
            const rawSetItem = window.localStorage.setItem.bind(window.localStorage);
            window.localStorage.setItem = ((key: string, value: string) => {
                if (
                    key === 'owner_active_match'
                    || key.includes('match_creds_')
                    || key.includes('ai_seat_creds_')
                ) {
                    throw new DOMException('Quota exceeded', 'QuotaExceededError');
                }
                rawSetItem(key, value);
            }) as Storage['setItem'];
        });

        await page.getByRole('heading', { name: '井字棋' }).click();
        await expect(page).toHaveURL(/game=tictactoe/);
        await expect(page.getByTestId('game-details-modal-root').last()).toBeVisible({ timeout: 15000 });

        const gameDetailsModal = page.getByTestId('game-details-modal-root').last();
        await gameDetailsModal.getByRole('button', { name: '创建房间' }).last().click({ force: true });
        await expect(page.getByRole('heading', { name: '创建房间' })).toBeVisible({ timeout: 10000 });

        await page.locator('.modal-base-container button').last().click({ force: true });

        await expect.poll(() => interceptedCreateRoom).toBeTruthy();
        await expect(page.getByText('房间已创建，但自动进入失败，请返回大厅重新进入。').last()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('创建房间失败').last()).toHaveCount(0);
        await expect(page.getByRole('heading', { name: '创建房间' })).toHaveCount(0);
        expect(page.url()).not.toContain('/play/tictactoe/match/');

        await game.screenshot('lobby-create-room-post-success-warning-visible', testInfo);
    });
});
