/**
 * 月精灵（Moon Elf）E2E 测试
 *
 * batch 1 只保留高价值的 Targeted 伤害语义链路。
 * 低价值的“在线选角 + 基础攻击烟雾”已移出本文件，避免和通用在线/开局路径重复。
 */

import type { Page } from '@playwright/test';
import { test, expect, type GameTestContext } from '../framework';
import { STATUS_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';

async function openTargetedDamageScene(
    page: Page,
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
            selectedCharacters: { '0': 'barbarian', '1': 'moon_elf' },
            hostStarted: true,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 1, isKept: false },
                { id: 2, value: 6, isKept: false },
                { id: 3, value: 6, isKept: false },
                { id: 4, value: 4, isKept: false },
            ],
        },
    });

    await page.evaluate((statusId) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!state) {
            throw new Error('State not available');
        }

        harness.state.patch({
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '1': {
                        ...state.core.players['1'],
                        statusEffects: {
                            ...(state.core.players['1']?.statusEffects ?? {}),
                            [statusId]: 1,
                        },
                    },
                },
            },
        });
    }, STATUS_IDS.TARGETED);

    await game.waitForPhase('offensiveRoll', 10000);
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            activePlayerId: state?.core?.activePlayerId ?? null,
            diceValues: (state?.core?.dice ?? []).map((die: any) => die.value).slice(0, 5),
            targeted: state?.core?.players?.['1']?.statusEffects?.[STATUS_IDS.TARGETED] ?? 0,
        };
    }, { timeout: 10000 }).toMatchObject({
        activePlayerId: '0',
        diceValues: [1, 1, 6, 6, 4],
        targeted: 1,
    });
}

test.describe('DiceThrone Moon Elf E2E', () => {
    test('framework 场景下 Targeted 应额外增加 2 点伤害并在结算后移除，不夹带 Daze 或防御', async ({ page, game }) => {
        await openTargetedDamageScene(page, game);

        const hpBefore = (await game.getPlayerState('1'))?.resources?.[RESOURCE_IDS.HP] ?? 0;

        const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]');
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        const attackSlot = page
            .locator('[data-available-ability-id="all-out-strike"], [data-resolved-ability-id="all-out-strike"]')
            .first();
        await expect(attackSlot).toBeVisible({ timeout: 8000 });
        await attackSlot.click();
        await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.pendingAttack?.sourceAbilityId ?? null;
        }, { timeout: 10000 }).toBe('all-out-strike');

        const resolveAttackButton = page.getByRole('button', { name: /Resolve Attack|结算攻击/i });
        await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
        await resolveAttackButton.click();

        await expect.poll(async () => {
            const defender = await game.getPlayerState('1');
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenderHp: defender?.resources?.[RESOURCE_IDS.HP] ?? null,
                targeted: defender?.statusEffects?.[STATUS_IDS.TARGETED] ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main2',
            defenderHp: hpBefore - 6,
            targeted: 0,
        });
    });
});
