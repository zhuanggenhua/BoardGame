import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';

async function openOffensiveRollScene(
    game: GameTestContext,
): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            hostStarted: true,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            activePlayerId: state?.core?.activePlayerId ?? null,
            rollCount: state?.core?.rollCount ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
            diceCount: state?.core?.dice?.length ?? 0,
        };
    }, { timeout: 5000 }).toMatchObject({
        phase: 'offensiveRoll',
        activePlayerId: '0',
        rollCount: 1,
        rollConfirmed: false,
        diceCount: 5,
    });
}

async function waitForDieLockState(
    game: GameTestContext,
    dieId: number,
    isKept: boolean,
): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return state?.core?.dice?.some(
            (die: any) => die.id === dieId && die.isKept === isKept,
        ) ?? false;
    }, { timeout: 5000 }).toBe(true);
}

test.describe('DiceThrone - 正常模式下锁定骰子', () => {
    test('应能在进攻掷骰阶段锁定和解锁骰子', async ({ page, game }) => {
        await openOffensiveRollScene(game);

        const firstDieButton = page.getByTestId('die-button-0');
        const firstDie = page.locator('[data-testid="die"]').first();
        const lockedLabel = firstDie.getByText(/locked|锁定/i);

        await expect(firstDieButton).toHaveAttribute('data-clickable', 'true');

        await firstDieButton.click();
        await waitForDieLockState(game, 0, true);
        await expect(lockedLabel).toBeVisible({ timeout: 3000 });

        await firstDieButton.click();
        await waitForDieLockState(game, 0, false);
        await expect(lockedLabel).not.toBeVisible({ timeout: 3000 });

        await firstDieButton.click();
        await waitForDieLockState(game, 0, true);
        await expect(lockedLabel).toBeVisible({ timeout: 3000 });
    });
});
