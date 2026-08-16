import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';

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
            resources: { [RESOURCE_IDS.CP]: 0, [RESOURCE_IDS.HP]: 5 },
            tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
        },
        player1: {
            resources: { [RESOURCE_IDS.HP]: 50 },
        },
        currentPlayer: '1',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'paladin', '1': 'moon_elf' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: true,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 1, isKept: false },
                { id: 2, value: 1, isKept: false },
                { id: 3, value: 1, isKept: false },
                { id: 4, value: 1, isKept: false },
            ],
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'longbow-5-1',
                isDefendable: false,
                damage: 7,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
                preDefenseResolved: true,
                offensiveRollEndTokenResolved: true,
            },
        },
    });

    await game.waitForPhase('offensiveRoll', 5000);
    await waitForHarnessCommand(page);
}

async function readBlessingState(game: GameTestContext) {
    const player0 = await game.getPlayerState('0');
    return {
        hp: player0?.resources?.[RESOURCE_IDS.HP] ?? 0,
        blessing: player0?.tokens?.[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0,
    };
}

async function expectBlessingState(
    game: GameTestContext,
    expected: { hp: number; blessing: number },
): Promise<void> {
    await expect.poll(async () => readBlessingState(game), { timeout: 5000 }).toMatchObject(expected);
}

async function resolvePreparedLethalAttack(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (typeof harness?.command?.dispatch !== 'function') {
            throw new Error('TestHarness command.dispatch is not available');
        }

        await harness.command.dispatch({
            type: 'ADVANCE_PHASE',
            playerId: '1',
            payload: {},
        });
    });
}

test.describe('DiceThrone - 神圣祝福（精简）', () => {
    test('致死伤害应消耗神圣祝福并将生命值设为 1', async ({ page, game }, testInfo: TestInfo) => {
        await setupBlessingScene(page, game);

        await expectBlessingState(game, {
            hp: 5,
            blessing: 1,
        });

        await resolvePreparedLethalAttack(page);

        await expectBlessingState(game, {
            hp: 1,
            blessing: 0,
        });
        await expect(page.getByTestId('dt-top-header-1-hp-value')).toHaveText('1', { timeout: 5000 });
        await page.waitForTimeout(4500);

        await game.screenshot('blessing-of-divinity-triggered', testInfo);
    });
});
