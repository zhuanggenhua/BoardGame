import { test, expect } from './framework';

test.describe('SmashUp afterScoring 简化验证', () => {
    test('点击 FINISH 后应进入 afterScoring 响应窗口', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await game.openTestGame('smashup');

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'card-afterscoring-1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
                ],
                field: [
                    { uid: 'minion-p0-1', defId: 'alien_invader', baseIndex: 0, owner: '0', controller: '0', power: 13 },
                ],
                factions: ['giant_ants', 'aliens'],
            },
            player1: {
                field: [
                    { uid: 'minion-p1-1', defId: 'ninja_shinobi', baseIndex: 0, owner: '1', controller: '1', power: 8 },
                ],
                factions: ['ninjas', 'wizards'],
            },
            bases: [
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.factionSelection === undefined
                    && state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'card-afterscoring-1')
                    && state?.core?.bases?.[0]?.minions?.length === 2;
            },
            { timeout: 5000 }
        );

        const finishButton = page.getByRole('button', { name: /Finish Turn|结束回合/i });
        await expect(finishButton).toBeVisible();
        await finishButton.click();
        await page.waitForTimeout(1000);

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
                return state?.sys?.responseWindow?.current?.windowType === 'afterScoring';
            },
            { timeout: 15000 }
        );

        const responseWindow = await page.evaluate(() => {
            return (window as any).__BG_TEST_HARNESS__?.state?.get()?.sys?.responseWindow?.current;
        });

        expect(responseWindow?.windowType).toBe('afterScoring');
        expect(responseWindow?.responderQueue?.[responseWindow.currentResponderIndex]).toBe('0');

        await expect(page.getByTestId('me-first-overlay')).toBeVisible();
        await expect(page.getByTestId('me-first-status')).toBeVisible();
        await expect(page.getByTestId('me-first-pass-button')).toBeVisible();
        await expect(page.locator('[data-card-uid="card-afterscoring-1"]')).toBeVisible();

        await game.screenshot('smashup-afterscoring-simple-complete', testInfo);
    });
});
