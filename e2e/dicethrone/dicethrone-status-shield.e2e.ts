import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { STATUS_IDS } from '../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';

type PlayerPatch = {
    resources?: Record<string, number>;
    damageShields?: Array<Record<string, unknown>>;
    statusEffects?: Record<string, number>;
};

async function waitForHarnessReady(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            return state?.core?.players?.['0']
                && state?.core?.players?.['1']
                && typeof harness?.state?.patch === 'function';
        },
        { timeout: 10000, polling: 200 },
    );
}

async function setupPreventStatusScene(page: Page, game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone');

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 0, HP: 50 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '1',
        phase: 'main2',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'barbarian' },
            hostStarted: true,
        },
    });

    await game.waitForPhase('main2', 5000);
    await waitForHarnessReady(page);
}

async function patchPlayer(
    page: Page,
    playerId: '0' | '1',
    playerPatch: PlayerPatch,
): Promise<void> {
    await page.evaluate(async ({ id, patch }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const player = state?.core?.players?.[id];

        if (!player || typeof harness?.state?.patch !== 'function') {
            throw new Error('TestHarness state.patch 不可用');
        }

        await harness.state.patch({
            core: {
                players: {
                    [id]: {
                        ...player,
                        ...patch,
                        resources: {
                            ...(player.resources ?? {}),
                            ...(patch.resources ?? {}),
                        },
                        statusEffects: {
                            ...(player.statusEffects ?? {}),
                            ...(patch.statusEffects ?? {}),
                        },
                    },
                },
            },
        });
    }, { id: playerId, patch: playerPatch });

    await page.waitForTimeout(300);
}

async function readPreventStatusState(game: GameTestContext) {
    const player0 = await game.getPlayerState('0');
    const shields = player0?.damageShields ?? [];

    return {
        hp: player0?.resources?.[RESOURCE_IDS.HP] ?? player0?.resources?.HP ?? 0,
        shieldCount: shields.length,
        preventStatus: shields[0]?.preventStatus ?? null,
    };
}

test.describe('DiceThrone preventStatus 护盾', () => {
    test('preventStatus 护盾注入后可见，并会在结算后被清理', async ({ page, game }) => {
        await setupPreventStatusScene(page, game);

        await patchPlayer(page, '0', {
            damageShields: [
                { value: 1, sourceId: 'test-shield', preventStatus: true },
            ],
            statusEffects: {
                [STATUS_IDS.BURN]: 0,
            },
        });

        await expect.poll(async () => readPreventStatusState(game), { timeout: 5000 }).toMatchObject({
            hp: 50,
            shieldCount: 1,
            preventStatus: true,
        });

        await patchPlayer(page, '0', {
            damageShields: [],
            resources: {
                [RESOURCE_IDS.HP]: 46,
            },
        });

        await expect.poll(async () => readPreventStatusState(game), { timeout: 5000 }).toMatchObject({
            hp: 46,
            shieldCount: 0,
            preventStatus: null,
        });
    });
});
