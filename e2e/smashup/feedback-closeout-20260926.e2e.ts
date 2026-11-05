import { test, expect } from '../framework';

test.describe('线上反馈回归：Smash Up 名称与可选成本', () => {
    test.describe.configure({ timeout: 60000 });

    test('魔杖天才可以在真实手牌入口跳过', async ({ game, page }) => {
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['munchkin_mages', 'munchkin_thieves'],
                hand: [{ uid: 'wand-whiz-hand', defId: 'munchkin_mages_wand_whiz', type: 'minion' }],
            },
            player1: { factions: ['pirates', 'ninjas'] },
            bases: [
                { defId: 'base_the_mines', minions: [] },
                { defId: 'base_the_homeworld', minions: [] },
                { defId: 'base_tar_pits', minions: [] },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: { core: { treasureDeck: ['munchkin_treasure_wishing_ring'] } },
        });

        await game.playCard('munchkin_mages_wand_whiz', { targetBaseIndex: 0 });
        await game.waitForInteraction('munchkin_mages_wand_whiz_discard');
        const options = await game.getInteractionOptions();
        expect(options.some((option: any) => option.value?.skip === true)).toBe(true);

        await game.selectOption('skip');
        await game.waitForNoInteraction();
        const state = await game.getState();
        expect(state.sys?.interaction?.current).toBeUndefined();
        expect(state.core.players['0'].hand.some((card: any) => card.uid === 'wand-whiz-hand')).toBe(false);
        expect(page.locator('[data-testid="prompt-overlay"]')).not.toBeVisible();
    });

    test('翘课天才的临时同名可在真实出牌入口触发扒手', async ({ game, page }) => {
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['munchkin_mages', 'munchkin_thieves'],
                hand: [{ uid: 'pickpocket-hand', defId: 'munchkin_thieves_pickpocket', type: 'minion' }],
                field: [{ uid: 'abe-alias-host', defId: 'munchkin_mages_blaster_master', baseIndex: 0 }],
            },
            player1: { factions: ['pirates', 'ninjas'] },
            bases: [
                { defId: 'base_the_mines', minions: [] },
                { defId: 'base_the_homeworld', minions: [] },
                { defId: 'base_tar_pits', minions: [] },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: { core: { treasureDeck: ['munchkin_treasure_wishing_ring'] } },
        });

        await page.evaluate(async () => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness.state.get();
            const bases = state.core.bases.map((base: any, index: number) => index === 0
                ? {
                    ...base,
                    minions: base.minions.map((minion: any) => minion.uid === 'abe-alias-host'
                        ? {
                            ...minion,
                            metadata: {
                                teensAbeFrohmanNames: ['munchkin_thieves_pickpocket'],
                                teensAbeFrohmanTurn: state.core.turnNumber,
                            },
                        }
                        : minion),
                }
                : base);
            await harness.state.patch({ core: { bases } });
        });

        await game.playCard('munchkin_thieves_pickpocket', { targetBaseIndex: 0 });
        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.players['0'].hand.some((card: any) => card.defId === 'munchkin_treasure_wishing_ring');
        }, { timeout: 5000 }).toBe(true);
        expect(page.locator('[data-testid="prompt-overlay"]')).not.toBeVisible();
    });
});
