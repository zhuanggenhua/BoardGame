import { test, expect } from '../framework';

type MinionState = {
    uid?: string;
};

type PlayerState = {
    minionsPlayed?: number;
    discard?: Array<{ uid?: string }>;
    baseLimitedMinionQuota?: number[] | Record<number, number>;
    usedDiscardPlayAbilities?: string[];
};

type SmashUpStateSnapshot = {
    core: {
        currentPlayerIndex: number;
        bases: Array<{ minions: MinionState[] }>;
        players: Record<string, PlayerState>;
    };
    sys: {
        phase?: string;
    };
};

async function getSmashUpState(game: { getState: () => Promise<unknown> }): Promise<SmashUpStateSnapshot> {
    return await game.getState() as SmashUpStateSnapshot;
}

test.describe('SmashUp 神秘花园 + 顽强丧尸', () => {
    test('神秘花园回合额度应允许从弃牌堆把顽强丧尸打到花园', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'normal-minion', defId: 'pirate_first_mate', type: 'minion' },
                ],
                discard: [
                    { uid: 'tenacious-z-discard', defId: 'zombie_tenacious_z', type: 'minion' },
                ],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['zombies', 'pirates'],
            },
            player1: {
                hand: [],
                discard: [],
                factions: ['pirates', 'aliens'],
            },
            bases: [
                { defId: 'base_secret_garden', minions: [] },
                { defId: 'base_the_factory', minions: [] },
                { defId: 'base_great_library', minions: [] },
            ],
            currentPlayer: '1',
            phase: 'playCards',
        });

        await game.advancePhase();

        await expect.poll(async () => {
            const state = await getSmashUpState(game);
            return {
                currentPlayerIndex: state.core.currentPlayerIndex,
                phase: state.sys.phase,
                gardenQuota: state.core.players['0'].baseLimitedMinionQuota?.[0] ?? 0,
            };
        }, { timeout: 8000 }).toEqual({
            currentPlayerIndex: 0,
            phase: 'playCards',
            gardenQuota: 1,
        });

        await game.screenshot('01-turn-start-garden-quota-visible', testInfo);

        await page.locator('[data-card-uid="normal-minion"]').click();
        await page.waitForTimeout(300);
        await page.locator('[data-base-index="1"]').click();

        await expect.poll(async () => {
            const state = await getSmashUpState(game);
            return {
                normalMinionOnFactory: state.core.bases[1].minions.some((minion) => minion.uid === 'normal-minion'),
                minionsPlayed: state.core.players['0'].minionsPlayed,
                gardenQuota: state.core.players['0'].baseLimitedMinionQuota?.[0] ?? 0,
            };
        }, { timeout: 8000 }).toEqual({
            normalMinionOnFactory: true,
            minionsPlayed: 1,
            gardenQuota: 1,
        });

        await game.screenshot('02-normal-minion-spent-garden-quota-remains', testInfo);

        await page.locator('[data-discard-toggle]').click();
        await expect(page.locator('[data-card-uid="tenacious-z-discard"]').first()).toBeVisible({ timeout: 5000 });
        await page.locator('[data-card-uid="tenacious-z-discard"]').first().click({ force: true });
        await expect(page.getByText(/点击基地|Click.*base/i)).toBeVisible({ timeout: 5000 });

        await game.screenshot('03-tenacious-z-selected-garden-highlight', testInfo);

        await page.locator('[data-base-index="0"]').click();

        await expect.poll(async () => {
            const state = await getSmashUpState(game);
            return {
                tenaciousOnGarden: state.core.bases[0].minions.some((minion) => minion.uid === 'tenacious-z-discard'),
                tenaciousStillDiscarded: state.core.players['0'].discard?.some((card) => card.uid === 'tenacious-z-discard') ?? false,
                usedDiscardAbility: state.core.players['0'].usedDiscardPlayAbilities?.includes('zombie_tenacious_z') ?? false,
            };
        }, { timeout: 8000 }).toEqual({
            tenaciousOnGarden: true,
            tenaciousStillDiscarded: false,
            usedDiscardAbility: true,
        });

        await game.screenshot('04-tenacious-z-on-secret-garden', testInfo);
    });
});
