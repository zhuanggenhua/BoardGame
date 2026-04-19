import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { TOKEN_IDS } from '../src/games/dicethrone/domain/ids';

async function waitForCheatDispatch(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            return state?.core?.players?.['0']
                && state?.core?.players?.['1']
                && typeof harness?.state?.patch === 'function'
                && typeof (window as any).__BG_DISPATCH__ === 'function';
        },
        { timeout: 10000, polling: 200 },
    );
}

async function setupPaladinBlessingScene(page: Page, game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 0, HP: 1 },
            tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '1',
        phase: 'main2',
        extra: {
            selectedCharacters: { '0': 'paladin', '1': 'barbarian' },
            hostStarted: true,
        },
    });

    await game.waitForPhase('main2', 5000);
    await waitForCheatDispatch(page);
}

async function readPaladinBlessingState(game: GameTestContext) {
    const player0 = await game.getPlayerState('0');
    return {
        hp: player0?.resources?.HP ?? 0,
        blessing: player0?.tokens?.[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0,
    };
}

async function dealDamage(page: Page, targetId: string, amount: number): Promise<void> {
    await page.evaluate(({ id, value }) => {
        const dispatch = (window as any).__BG_DISPATCH__;
        if (typeof dispatch !== 'function') {
            throw new Error('__BG_DISPATCH__ 不可用');
        }

        dispatch({
            type: 'CHEAT_DEAL_DAMAGE',
            payload: {
                targetId: id,
                amount: value,
            },
        });
    }, { id: targetId, value: amount });
}

test.describe('DiceThrone 圣骑士', () => {
    test('神圣祝福应阻止致死伤害并将生命值回到 6', async ({ page, game }) => {
        await setupPaladinBlessingScene(page, game);

        await expect.poll(async () => readPaladinBlessingState(game), { timeout: 5000 }).toMatchObject({
            hp: 1,
            blessing: 1,
        });

        await dealDamage(page, '0', 10);

        await expect.poll(async () => readPaladinBlessingState(game), { timeout: 5000 }).toMatchObject({
            hp: 6,
            blessing: 0,
        });
    });
});
