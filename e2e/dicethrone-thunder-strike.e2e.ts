import { test, expect } from './framework';

test.describe('DiceThrone - 雷霆万钧', () => {
    test('重掷奖励骰会消耗太极并更新结算状态', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 0, HP: 50 },
                tokens: { taiji: 2 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main2',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                pendingBonusDiceSettlement: {
                    id: 'thunder-strike-reroll',
                    attackerId: '0',
                    targetId: '1',
                    dice: [
                        { index: 0, value: 2, face: 'palm' },
                        { index: 1, value: 4, face: 'taiji' },
                        { index: 2, value: 6, face: 'lotus' },
                    ],
                    rerollCostTokenId: 'taiji',
                    rerollCostAmount: 2,
                    rerollCount: 0,
                    maxRerollCount: 1,
                    readyToSettle: false,
                },
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                diceCount: settlement?.dice?.length ?? 0,
                rerollCount: settlement?.rerollCount ?? null,
                rerollCostTokenId: settlement?.rerollCostTokenId ?? null,
                rerollCostAmount: settlement?.rerollCostAmount ?? null,
                taiji: state?.core?.players?.['0']?.tokens?.taiji ?? 0,
            };
        }, { timeout: 5000 }).toMatchObject({
            diceCount: 3,
            rerollCount: 0,
            rerollCostTokenId: 'taiji',
            rerollCostAmount: 2,
            taiji: 2,
        });

        const overlay = page.locator('[data-testid="bonus-die-overlay"]').first();
        await expect(overlay).toBeVisible({ timeout: 5000 });
        await expect(
            page.getByRole('button', { name: /Confirm Damage|Continue|确认伤害|继续/i }),
        ).toBeVisible({ timeout: 5000 });

        const bonusDice = overlay.locator('.dice3d-perspective');
        await expect(bonusDice).toHaveCount(3, { timeout: 5000 });
        await bonusDice.first().click();

        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            const eventTypes = (state?.sys?.eventStream?.entries ?? [])
                .slice(-6)
                .map((entry: any) => entry.event?.type);
            return {
                rerollCount: settlement?.rerollCount ?? null,
                taiji: state?.core?.players?.['0']?.tokens?.taiji ?? 0,
                eventTypes,
            };
        }, { timeout: 5000 }).toMatchObject({
            rerollCount: 1,
            taiji: 0,
        });

        const finalState = await game.getState();
        const finalSettlement = finalState?.core?.pendingBonusDiceSettlement;
        const finalEventTypes = (finalState?.sys?.eventStream?.entries ?? [])
            .slice(-6)
            .map((entry: any) => entry.event?.type);

        expect(finalSettlement?.rerollCount ?? null).toBe(1);
        expect(finalState?.core?.players?.['0']?.tokens?.taiji ?? 0).toBe(0);
        expect(finalEventTypes).toContain('BONUS_DIE_REROLLED');
    });
});
