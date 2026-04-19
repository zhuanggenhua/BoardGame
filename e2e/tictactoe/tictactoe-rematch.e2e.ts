import { test, expect, type Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const ensureHostPlayerId = async (page: Page): Promise<URL> => {
    const url = new URL(page.url());
    if (!url.searchParams.get('playerID')) {
        url.searchParams.set('playerID', '0');
        await page.goto(url.toString());
        await expect(page.locator('[data-tutorial-id="cell-0"]')).toBeVisible();
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
    await page.waitForURL((url) => {
        const parsed = new URL(url);
        if (!parsed.pathname.includes('/play/tictactoe/match/')) return false;
        const matchId = parsed.pathname.split('/').pop();
        return !!matchId && matchId !== oldMatchId;
    }, { timeout: 15000 });
    const parsed = new URL(page.url());
    return parsed.pathname.split('/').pop();
};

test.describe('井字棋重赛 E2E', () => {
    test('在线重赛会跳转到新对局且刷新后仍停留在新对局', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const hostContext = await browser.newContext({ baseURL });
        await setChineseLocale(hostContext);
        const hostPage = await hostContext.newPage();

        await hostPage.goto('/');
        await hostPage.getByRole('heading', { name: '井字棋' }).click();
        await hostPage.getByRole('button', { name: '创建房间' }).click();
        await expect(hostPage.getByRole('heading', { name: '创建房间' })).toBeVisible();
        await hostPage.getByRole('button', { name: '确认' }).click();

        await hostPage.waitForURL(/\/play\/tictactoe\/match\//);
        await expect(hostPage.locator('[data-tutorial-id="cell-0"]')).toBeVisible({ timeout: 15000 });

        const hostUrl = await ensureHostPlayerId(hostPage);
        const matchId = hostUrl.pathname.split('/').pop();
        if (!matchId) {
            throw new Error('Failed to parse match id from host URL.');
        }

        const guestContext = await browser.newContext({ baseURL });
        await setChineseLocale(guestContext);
        const guestPage = await guestContext.newPage();

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
        await expect(guestPage.getByText(/胜利|平局/i)).toBeVisible({ timeout: 15000 });

        const playAgainHost = hostPage.getByRole('button', { name: '再来一局' });
        const playAgainGuest = guestPage.getByRole('button', { name: '再来一局' });
        await expect(playAgainHost).toBeVisible({ timeout: 15000 });
        await expect(playAgainGuest).toBeVisible({ timeout: 15000 });

        await playAgainHost.click();
        await playAgainGuest.click();

        const nextMatchIdHost = await waitForNewMatch(hostPage, matchId);
        const nextMatchIdGuest = await waitForNewMatch(guestPage, matchId);

        expect(nextMatchIdHost).toBeTruthy();
        expect(nextMatchIdHost).toEqual(nextMatchIdGuest);

        await hostPage.reload();
        await guestPage.reload();

        await expect(hostPage).toHaveURL(new RegExp(`/play/tictactoe/match/${nextMatchIdHost}`));
        await expect(guestPage).toHaveURL(new RegExp(`/play/tictactoe/match/${nextMatchIdHost}`));

        await expect(hostPage.getByText(/双方已确认，重开中/i)).toHaveCount(0);
        await expect(guestPage.getByText(/双方已确认，重开中/i)).toHaveCount(0);
        await expect(hostPage.getByRole('button', { name: '再来一局' })).toHaveCount(0);
        await expect(guestPage.getByRole('button', { name: '再来一局' })).toHaveCount(0);

        await hostContext.close();
        await guestContext.close();
    });
});
