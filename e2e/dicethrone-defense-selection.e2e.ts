import { test, expect } from './framework';
import type { GameTestContext } from './framework';

async function setupDefenseEntryScene(
    game: GameTestContext,
    defenderCharacter: 'shadow_thief' | 'paladin',
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
            selectedCharacters: { '0': 'monk', '1': defenderCharacter },
            hostStarted: true,
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: true,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
                sourceAbilityId: 'smash',
            },
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            defenderId: state?.core?.pendingAttack?.defenderId ?? null,
            sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'offensiveRoll',
        defenderId: '1',
        sourceAbilityId: 'smash',
        rollConfirmed: true,
    });
}

test.describe('DiceThrone - 防御技能选择', () => {
    test('影贼双防御应先要求选择防御技能，再进入防御掷骰', async ({ page, game }) => {
        await setupDefenseEntryScene(game, 'shadow_thief');

        await game.advancePhase();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
                rollCount: state?.core?.rollCount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            phase: 'defensiveRoll',
            defenseAbilityId: null,
            rollCount: 0,
        });

        const highlightedSlots = page
            .locator('[data-ability-slot]')
            .filter({ has: page.locator('div.animate-pulse[class*="border-"]') });
        await expect(highlightedSlots.first()).toBeVisible({ timeout: 5000 });
        expect(await highlightedSlots.count()).toBeGreaterThanOrEqual(2);

        await highlightedSlots.first().click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            };
        }, { timeout: 5000 }).toSatisfy(({ phase, defenseAbilityId }) => {
            return phase === 'defensiveRoll'
                && (defenseAbilityId === 'shadow-defense' || defenseAbilityId === 'fearless-riposte');
        });

        await expect(page.locator('[data-tutorial-id="dice-roll-button"]')).toBeEnabled({ timeout: 5000 });
    });

    test('圣骑单防御应自动选择 holy-defense 并直接进入防御掷骰', async ({ page, game }) => {
        await setupDefenseEntryScene(game, 'paladin');

        await game.advancePhase();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            phase: 'defensiveRoll',
            defenseAbilityId: 'holy-defense',
        });

        const state = await game.getState();
        expect(state.core.pendingAttack?.defenseAbilityId).toBe('holy-defense');
        await expect(page.locator('[data-tutorial-id="dice-roll-button"]')).toBeEnabled({ timeout: 5000 });
    });
});
