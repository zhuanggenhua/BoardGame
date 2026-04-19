import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';

type ScenePlayers = Record<'0' | '1', string>;

type PlayerPatch = {
    resources?: Record<string, number>;
    damageShields?: Array<Record<string, unknown>>;
};

async function setupShieldScene(
    game: GameTestContext,
    players: ScenePlayers,
    currentPlayer: '0' | '1' = '0',
): Promise<void> {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 0, HP: 50 },
        },
        player1: {
            resources: { CP: 0, HP: 50 },
        },
        currentPlayer,
        phase: 'main2',
        extra: {
            selectedCharacters: players,
            hostStarted: true,
        },
    });

    await game.waitForPhase('main2', 5000);
}

async function patchPlayer(
    page: Page,
    playerId: '0' | '1',
    patch: PlayerPatch,
): Promise<void> {
    await page.evaluate(({ id, nextPatch }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const player = state?.core?.players?.[id];

        if (!player || typeof harness?.state?.patch !== 'function') {
            throw new Error('TestHarness state.patch 不可用');
        }

        harness.state.patch({
            core: {
                players: {
                    [id]: {
                        ...player,
                        ...nextPatch,
                        resources: {
                            ...(player.resources ?? {}),
                            ...(nextPatch.resources ?? {}),
                        },
                    },
                },
            },
        });
    }, { id: playerId, nextPatch: patch });

    await page.waitForTimeout(300);
}

async function readShieldState(game: GameTestContext, playerId: '0' | '1') {
    const player = await game.getPlayerState(playerId);
    const shields = player?.damageShields ?? [];

    return {
        hp: player?.resources?.[RESOURCE_IDS.HP] ?? player?.resources?.HP ?? 0,
        shieldCount: shields.length,
        shieldValue: shields[0]?.value ?? null,
    };
}

test.describe('DiceThrone - 护盾清理机制', () => {
    test('神圣防御护盾在攻击结束后清理', async ({ page, game }, testInfo: TestInfo) => {
        await setupShieldScene(game, { '0': 'paladin', '1': 'barbarian' });

        await patchPlayer(page, '1', {
            damageShields: [{ value: 3, sourceId: 'divine-defense', preventStatus: false }],
        });

        await expect.poll(() => readShieldState(game, '1'), { timeout: 5000 }).toMatchObject({
            hp: 50,
            shieldCount: 1,
            shieldValue: 3,
        });

        await patchPlayer(page, '1', {
            damageShields: [],
            resources: { [RESOURCE_IDS.HP]: 48 },
        });

        await expect.poll(() => readShieldState(game, '1'), { timeout: 5000 }).toMatchObject({
            hp: 48,
            shieldCount: 0,
            shieldValue: null,
        });

        await game.screenshot('divine-shield-cleanup', testInfo);
    });

    test('攻击取消时护盾也应该清理', async ({ page, game }) => {
        await setupShieldScene(game, { '0': 'paladin', '1': 'barbarian' });

        await patchPlayer(page, '1', {
            damageShields: [{ value: 2, sourceId: 'divine-defense', preventStatus: false }],
        });

        await expect.poll(() => readShieldState(game, '1'), { timeout: 5000 }).toMatchObject({
            hp: 50,
            shieldCount: 1,
            shieldValue: 2,
        });

        await patchPlayer(page, '1', {
            damageShields: [],
        });

        await expect.poll(() => readShieldState(game, '1'), { timeout: 5000 }).toMatchObject({
            hp: 50,
            shieldCount: 0,
            shieldValue: null,
        });
    });

    test('暗影防御护盾在攻击结束后清理', async ({ page, game }) => {
        await setupShieldScene(game, { '0': 'shadow_thief', '1': 'barbarian' });

        await patchPlayer(page, '1', {
            damageShields: [{ value: 2, sourceId: 'shadow-defense', preventStatus: false }],
        });

        await expect.poll(() => readShieldState(game, '1'), { timeout: 5000 }).toMatchObject({
            hp: 50,
            shieldCount: 1,
            shieldValue: 2,
        });

        await patchPlayer(page, '1', {
            damageShields: [],
            resources: { [RESOURCE_IDS.HP]: 48 },
        });

        await expect.poll(() => readShieldState(game, '1'), { timeout: 5000 }).toMatchObject({
            hp: 48,
            shieldCount: 0,
            shieldValue: null,
        });
    });

    test('多次攻击护盾不累积', async ({ page, game }) => {
        await setupShieldScene(game, { '0': 'paladin', '1': 'barbarian' });

        await patchPlayer(page, '1', {
            damageShields: [{ value: 3, sourceId: 'divine-defense-1', preventStatus: false }],
        });
        await expect.poll(() => readShieldState(game, '1'), { timeout: 5000 }).toMatchObject({
            shieldCount: 1,
            shieldValue: 3,
        });

        await patchPlayer(page, '1', {
            damageShields: [],
        });
        await expect.poll(() => readShieldState(game, '1'), { timeout: 5000 }).toMatchObject({
            shieldCount: 0,
            shieldValue: null,
        });

        await patchPlayer(page, '1', {
            damageShields: [{ value: 2, sourceId: 'divine-defense-2', preventStatus: false }],
        });

        await expect.poll(() => readShieldState(game, '1'), { timeout: 5000 }).toMatchObject({
            hp: 50,
            shieldCount: 1,
            shieldValue: 2,
        });
    });
});
