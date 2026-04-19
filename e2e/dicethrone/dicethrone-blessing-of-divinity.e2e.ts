import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { TOKEN_IDS } from '../src/games/dicethrone/domain/ids';

async function waitForHarnessCommand(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            return state?.core?.players?.['0']
                && state?.core?.players?.['1']
                && typeof harness?.command?.dispatch === 'function';
        },
        { timeout: 10000, polling: 200 },
    );
}

async function setupBlessingScene(page: Page, game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 0, HP: 5 },
            tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '1',
        phase: 'main2',
        extra: {
            selectedCharacters: { '0': 'paladin', '1': 'shadow_thief' },
            hostStarted: true,
        },
    });

    await game.waitForPhase('main2', 5000);
    await waitForHarnessCommand(page);
}

async function readBlessingState(game: GameTestContext) {
    const player0 = await game.getPlayerState('0');
    return {
        hp: player0?.resources?.HP ?? 0,
        blessing: player0?.tokens?.[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0,
    };
}

async function expectBlessingState(
    game: GameTestContext,
    expected: { hp: number; blessing: number },
): Promise<void> {
    await expect.poll(async () => readBlessingState(game), { timeout: 5000 }).toMatchObject(expected);
}

async function dealDamage(page: Page, targetId: string, amount: number): Promise<void> {
    await page.evaluate(({ targetId: id, amount: value }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (typeof harness?.command?.dispatch !== 'function') {
            throw new Error('TestHarness command.dispatch is not available');
        }

        harness.command.dispatch({
            type: 'TEST_DAMAGE',
            playerId: '1',
            payload: {
                targetId: id,
                amount: value,
                sourceAbilityId: 'test-blessing-of-divinity',
            },
        });
    }, { targetId, amount });
}

test.describe('DiceThrone - 神圣祝福（精简）', () => {
    test('致死伤害应消耗神圣祝福并将生命值设为 6', async ({ page, game }, testInfo: TestInfo) => {
        await setupBlessingScene(page, game);

        await expectBlessingState(game, {
            hp: 5,
            blessing: 1,
        });

        await dealDamage(page, '0', 10);

        await expectBlessingState(game, {
            hp: 6,
            blessing: 0,
        });

        await game.screenshot('blessing-of-divinity-triggered', testInfo);
    });
});
