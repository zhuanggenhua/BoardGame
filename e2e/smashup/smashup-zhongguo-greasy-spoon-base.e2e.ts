import { test, expect } from '../framework';

test.describe('SmashUp - zhongguo 廉价小饭馆基地 afterScoring 链路', () => {
    test('计分后廉价小饭馆应让在场双方各抓 1 张牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [{ uid: 'p0-draw', defId: 'truckers_fixin_to_fix_it', type: 'action', owner: '0' }],
                discard: [],
                factions: ['truckers', 'vigilantes'],
            },
            player1: {
                hand: [],
                deck: [{ uid: 'p1-draw', defId: 'disco_dancers_get_down_tonight', type: 'action', owner: '1' }],
                discard: [],
                factions: ['disco_dancers', 'kung_fu_fighters'],
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    baseDeck: ['base_central_brain', 'base_the_factory', 'base_the_homeworld'],
                    bases: [
                        {
                            defId: 'base_the_greasy_spoon',
                            minions: [
                                {
                                    uid: 'p0-minion',
                                    defId: 'truckers_good_buddy',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 18,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'p1-minion',
                                    defId: 'disco_dancers_diva',
                                    owner: '1',
                                    controller: '1',
                                    basePower: 8,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                    ],
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-greasy-spoon-before-scoring', testInfo);

        const finishButton = page.getByTestId('su-end-turn-action-button');
        await expect(finishButton).toBeVisible();
        await finishButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                p0Hand: state.core.players['0'].hand.some((card: any) => card.uid === 'p0-draw'),
                p1Hand: state.core.players['1'].hand.some((card: any) => card.uid === 'p1-draw'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 20000 }).toEqual({
            p0Hand: true,
            p1Hand: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        const finalState = await game.getState();
        const entries = finalState.sys.eventStream?.entries ?? [];
        const drawEvents = entries.filter((entry: any) => entry.event?.type === 'su:cards_drawn');

        expect(drawEvents.length).toBeGreaterThanOrEqual(2);
        expect(finalState.core.players['0'].deck.some((card: any) => card.uid === 'p0-draw')).toBe(false);
        expect(finalState.core.players['1'].deck.some((card: any) => card.uid === 'p1-draw')).toBe(false);

        await game.screenshot('zhongguo-greasy-spoon-final-state', testInfo);
    });
});
