import type { Page } from '@playwright/test';
import { test, expect } from './framework';
import type { GameTestContext } from './framework';

async function openResponseWindowScene(page: Page, game: GameTestContext): Promise<void> {
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
            selectedCharacters: { '0': 'barbarian', '1': 'moon_elf' },
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
            pendingAttack: {
                attackerId: '0',
                targetId: '1',
                sourceAbilityId: 'smash',
                baseDamage: 4,
                totalDamage: 4,
                bonusDamage: 0,
                unblockable: false,
            },
        },
        sys: {
            responseWindow: {
                current: {
                    id: 'toggle-lock-response-window',
                    windowType: 'afterRollConfirmed',
                    sourceId: 'smash',
                    responderQueue: ['0'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                    actionTakenThisRound: false,
                    consecutivePassRounds: 0,
                },
            },
        },
    });

    await page.waitForFunction(
        () => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'offensiveRoll'
                && state?.core?.activePlayerId === '0'
                && state?.sys?.responseWindow?.current?.id === 'toggle-lock-response-window'
                && (state?.core?.dice?.length ?? 0) === 5;
        },
        { timeout: 5000, polling: 200 },
    );
}

async function waitForDieLockState(page: Page, dieId: number, isKept: boolean): Promise<void> {
    await page.waitForFunction(
        ([expectedDieId, expectedKept]) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.dice?.some(
                (die: any) => die.id === expectedDieId && die.isKept === expectedKept,
            );
        },
        [dieId, isKept],
        { timeout: 5000, polling: 200 },
    );
}

test.describe('DiceThrone - 响应窗口期间锁定骰子', () => {
    test('响应窗口打开时仍可锁定骰子，但不能继续重掷', async ({ page, game }) => {
        await openResponseWindowScene(page, game);

        const dieButton = page.getByTestId('die-button-0');
        await expect(dieButton).toHaveAttribute('data-clickable', 'true');

        await dieButton.click();
        await waitForDieLockState(page, 0, true);

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
        if ((await rollButton.count()) > 0) {
            await expect(rollButton).toBeDisabled();
        } else {
            expect(await rollButton.count()).toBe(0);
        }
    });
});
