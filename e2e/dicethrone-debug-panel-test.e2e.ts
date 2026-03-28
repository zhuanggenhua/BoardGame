import { test, expect } from './framework';

test.describe('DiceThrone 调试面板', () => {
    test('状态页会反映注入后的生命值变更', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 0, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'barbarian', '1': 'paladin' },
                hostStarted: true,
            },
        });

        await page.getByTestId('debug-toggle').click();
        await expect(page.getByTestId('debug-panel')).toBeVisible({ timeout: 5000 });

        const stateTab = page.getByTestId('debug-tab-state');
        if (await stateTab.isVisible().catch(() => false)) {
            await stateTab.click();
        }

        await page.waitForFunction(
            () => {
                const raw = document.querySelector('[data-testid="debug-state-json"]')?.textContent;
                if (!raw) return false;
                try {
                    const parsed = JSON.parse(raw);
                    const core = parsed?.core ?? parsed?.G?.core ?? parsed;
                    const hp = core?.players?.['0']?.resources?.HP ?? core?.players?.['0']?.resources?.hp;
                    return hp === 50;
                } catch {
                    return false;
                }
            },
            { timeout: 5000, polling: 200 },
        );

        await page.evaluate(() => {
            (window as any).__BG_TEST_HARNESS__?.state?.patch?.({
                core: {
                    players: {
                        '0': {
                            resources: { HP: 10 },
                        },
                    },
                },
            });
        });

        await page.waitForFunction(
            () => {
                const raw = document.querySelector('[data-testid="debug-state-json"]')?.textContent;
                if (!raw) return false;
                try {
                    const parsed = JSON.parse(raw);
                    const core = parsed?.core ?? parsed?.G?.core ?? parsed;
                    const hp = core?.players?.['0']?.resources?.HP ?? core?.players?.['0']?.resources?.hp;
                    return hp === 10;
                } catch {
                    return false;
                }
            },
            { timeout: 5000, polling: 200 },
        );

        const rawState = await page.getByTestId('debug-state-json').innerText();
        const parsed = JSON.parse(rawState);
        const core = parsed?.core ?? parsed?.G?.core ?? parsed;
        const hp = core?.players?.['0']?.resources?.HP ?? core?.players?.['0']?.resources?.hp;

        expect(hp).toBe(10);
    });
});
