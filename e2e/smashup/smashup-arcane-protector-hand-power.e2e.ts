import { test, expect } from '../framework';

test.describe('SmashUp - 奥术守护者手牌战力', () => {
    test('每 3 张手牌只提供 +1 战力', async ({ game, page }, testInfo) => {
        test.setTimeout(60000);

        await game.openTestGame('smashup', {
            p0: 'wizards,pirates',
            p1: 'ghosts,robots',
            skipFactionSelect: true,
            skipInitialization: false,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['wizards', 'pirates'],
                hand: [
                    'wizard_neophyte',
                    'wizard_enchantress',
                    'wizard_archmage',
                    'pirate_first_mate',
                    'pirate_buccaneer',
                    'pirate_king',
                ],
                field: [
                    { uid: 'arcane-host', defId: 'wizard_neophyte', baseIndex: 0, basePower: 2 },
                ],
            },
            player1: {
                factions: ['ghosts', 'robots'],
            },
            bases: [
                { defId: 'base_the_factory', minions: [], ongoingActions: [] },
                { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
            ],
            extra: {
                core: {
                    enabledExpansions: ['titans'],
                    titans: [{
                        uid: 'titan-arcane-protector',
                        defId: 'wizards_arcane_protector',
                        faction: 'wizards',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    }],
                },
            },
        });

        const host = page.locator('[data-minion-uid="arcane-host"]');
        await expect(host).toBeVisible({ timeout: 15000 });

        await expect.poll(
            async () => page.getByText('4', { exact: true }).count(),
            { timeout: 10000 },
        ).toBeGreaterThanOrEqual(2);

        await game.screenshot('arcane-protector-six-cards-final-four-power', testInfo);
    });
});
