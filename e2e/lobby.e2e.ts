import { test, expect } from './framework';

test.describe('Lobby E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('i18nextLng', 'en');
        });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: /Yi Board Game|易桌游/i, level: 1 })).toBeVisible({ timeout: 15000 });
    });

    test('Category filters show expected games', async ({ page }) => {
        await page.getByRole('button', { name: /Tools|工具/i }).click();
        await expect(page.getByRole('heading', { name: /Asset Slicer|素材切片机/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Dice Throne|王权骰铸/i })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: /Tic-Tac-Toe|井字棋/i })).toHaveCount(0);

        await page.getByRole('button', { name: /All Games|全部游戏/i }).click();
        await expect(page.getByRole('heading', { name: /Dice Throne|王权骰铸/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Tic-Tac-Toe|井字棋/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Asset Slicer|素材切片机/i })).toHaveCount(0);
    });

    test('Game details modal opens and shows actions', async ({ page }) => {
        await page.getByRole('heading', { name: /Tic-Tac-Toe|井字棋/i }).click();
        await expect(page).toHaveURL(/game=tictactoe/);

        await expect(page.getByRole('button', { name: /Create Room|创建房间/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Local|本地/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Tutorial|教程/i })).toBeVisible();

        await page.getByRole('button', { name: /Leaderboard|排行榜/i }).click();
        await expect(page.getByRole('heading', { name: /Top Wins|胜场排行/i, level: 4 })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/Loading|加载中/i)).toHaveCount(0, { timeout: 10000 });
    });

    test('移动端游戏详情隐藏描述和推荐人数，为大厅房间区留出空间', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });

        await page.getByRole('heading', { name: /Tic-Tac-Toe|井字棋/i }).click();
        await expect(page).toHaveURL(/game=tictactoe/);

        await expect(page.getByRole('button', { name: /Create Room|创建房间/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Local|本地/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Tutorial|教程/i })).toBeVisible();
        await expect(page.getByTestId('game-details-description')).toBeHidden();
        await expect(page.getByTestId('game-details-player-recommendation')).toBeHidden();
    });

    test('Dice Throne 更新日志 tab 会请求公开接口并结束 loading', async ({ page }) => {
        await page.getByRole('heading', { name: /Dice Throne|王权骰铸/i }).click();
        await expect(page).toHaveURL(/game=dicethrone/);

        const changelogResponsePromise = page.waitForResponse((response) => {
            return response.url().includes('/game-changelogs/dicethrone') && response.request().method() === 'GET';
        });

        await page.getByRole('button', { name: /Updates|更新/i }).click();

        const changelogResponse = await changelogResponsePromise;
        expect(changelogResponse.status()).toBe(200);

        const payload = await changelogResponse.json();
        expect(Array.isArray(payload.changelogs)).toBeTruthy();

        await expect(page.getByText(/Loading changelog|更新日志加载中/i)).toHaveCount(0, { timeout: 10000 });
        await expect(page.getByText(/No updates yet|暂无日志|Failed to load changelog|更新日志加载失败/i)).toBeVisible({ timeout: 10000 });
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

        await page.getByRole('heading', { name: /Dice Throne|王权骰铸/i }).click();
        await expect(page).toHaveURL(/game=dicethrone/);

        await page.getByRole('button', { name: /Updates|更新/i }).click();

        await expect(page.getByText('Balance Update')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('v0.1.3')).toBeVisible();
        await expect(page.getByText('Pinned')).toBeVisible();
        await expect(page.getByText('Pyromancer burn tooltip now matches the published rules.')).toBeVisible();

        await game.screenshot('lobby-dicethrone-changelog-renders-published-entry', testInfo);
    });
});
