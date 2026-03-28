import type { Page } from '@playwright/test';
import { test, expect } from './framework';
import type { GameTestContext } from './framework';
import { TOKEN_IDS } from '../src/games/dicethrone/domain/ids';

async function waitForCheatDispatch(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.players?.['0']
                && state?.core?.players?.['1']
                && (window as any).__BG_DISPATCH__;
        },
        { timeout: 10000, polling: 200 },
    );
}

async function setupSneakScene(page: Page, game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 0, HP: 50 },
            tokens: { [TOKEN_IDS.SNEAK]: 1 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '1',
        phase: 'main2',
        extra: {
            selectedCharacters: { '0': 'shadow_thief', '1': 'paladin' },
            hostStarted: true,
        },
    });

    await waitForCheatDispatch(page);
}

async function readSneakState(game: GameTestContext) {
    const player0 = await game.getPlayerState('0');
    return {
        hp: player0?.resources?.HP ?? 0,
        sneak: player0?.tokens?.[TOKEN_IDS.SNEAK] ?? 0,
    };
}

async function dealDamage(page: Page, targetId: string, amount: number): Promise<void> {
    await page.evaluate(({ targetId: id, amount: value }) => {
        const dispatch = (window as any).__BG_DISPATCH__;
        if (!dispatch) {
            throw new Error('BG dispatch is not available');
        }

        dispatch({
            type: 'CHEAT_DEAL_DAMAGE',
            payload: {
                targetId: id,
                amount: value,
            },
        });
    }, { targetId, amount });
}

test.describe('DiceThrone - 潜行 Token（精简）', () => {
    test('潜行应免除一次伤害并被消耗', async ({ page, game }) => {
        await setupSneakScene(page, game);

        await expect.poll(async () => readSneakState(game), { timeout: 5000 }).toMatchObject({
            hp: 50,
            sneak: 1,
        });

        await dealDamage(page, '0', 5);

        await expect.poll(async () => readSneakState(game), { timeout: 5000 }).toMatchObject({
            hp: 50,
            sneak: 0,
        });
    });
});
