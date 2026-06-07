import { test, expect } from '../framework';

test.describe('SmashUp - Captain Ahab talent', () => {
    test('亚哈船长在存在合法目标时应高亮并可移动到目标基地', async ({ game, page }, testInfo) => {
        test.setTimeout(60000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['steampunks', 'pirates'],
                field: [
                    {
                        uid: 'ahab-1',
                        defId: 'steampunk_captain_ahab',
                        baseIndex: 0,
                    },
                ],
            },
            player1: {
                factions: ['ninjas', 'dinosaurs'],
            },
            bases: [
                { defId: 'base_inventors_salon' },
                {
                    defId: 'base_the_workshop',
                    ongoingActions: [
                        { uid: 'ongoing-1', defId: 'steampunk_escape_hatch', ownerId: '0', talentUsed: false },
                    ],
                },
                {
                    defId: 'base_pirate_cove',
                    ongoingActions: [
                        { uid: 'ongoing-2', defId: 'steampunk_difference_engine', ownerId: '0', talentUsed: false },
                    ],
                },
            ],
        });

        const ahab = page.locator('[data-minion-uid="ahab-1"]');
        await expect(ahab).toBeVisible({ timeout: 15000 });

        await expect.poll(async () => {
            const className = await ahab.locator(':scope > div').first().getAttribute('class');
            return className ?? '';
        }, { timeout: 5000 }).toContain('ring-amber-400');

        await game.screenshot('captain-ahab-talent-highlight', testInfo);

        await ahab.click();
        await game.waitForInteraction('steampunk_captain_ahab');

        const options = await game.getInteractionOptions();
        expect(options.map(option => option?.value?.baseIndex).sort()).toEqual([1, 2]);

        await game.selectBase(2);
        await game.waitForNoInteraction();

        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases.map((base: { minions: Array<{ uid: string }> }) =>
                base.minions.map((minion: { uid: string }) => minion.uid),
            );
        }, { timeout: 5000 }).toEqual([
            [],
            [],
            ['ahab-1'],
        ]);

        await game.screenshot('captain-ahab-talent-moved', testInfo);
    });
});
