import { test, expect } from '../framework';

test.describe('SmashUp - zhongguo 卡车服务站基地 afterScoring 链路', () => {
    test('计分后卡车服务站应把这里的随从移动到另一个基地', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['truckers', 'vigilantes'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['disco_dancers', 'kung_fu_fighters'],
            },
            bases: [
                {
                    defId: 'base_truck_stop',
                    minions: [],
                },
                {
                    defId: 'base_central_brain',
                    minions: [],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    baseDeck: ['base_the_factory', 'base_the_homeworld', 'base_the_jungle'],
                    bases: [
                        {
                            defId: 'base_truck_stop',
                            minions: [
                                {
                                    uid: 'truck-stop-p0',
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
                                    uid: 'truck-stop-p1',
                                    defId: 'disco_dancers_roller',
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
                        {
                            defId: 'base_central_brain',
                            minions: [],
                            ongoingActions: [],
                        },
                    ],
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-truck-stop-before-scoring', testInfo);

        const finishButton = page.getByTestId('su-end-turn-action-button');
        await expect(finishButton).toBeVisible();
        await finishButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            const baseWithMovedMinions = state.core.bases.find((base: any) =>
                base.minions?.some((minion: any) => minion.uid === 'truck-stop-p0')
                    && base.minions?.some((minion: any) => minion.uid === 'truck-stop-p1'),
            );
            return {
                movedBaseDefId: baseWithMovedMinions?.defId ?? null,
                originalBaseHasP0: state.core.bases[0]?.minions?.some((minion: any) => minion.uid === 'truck-stop-p0') ?? false,
                originalBaseHasP1: state.core.bases[0]?.minions?.some((minion: any) => minion.uid === 'truck-stop-p1') ?? false,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 20000 }).toEqual({
            movedBaseDefId: 'base_central_brain',
            originalBaseHasP0: false,
            originalBaseHasP1: false,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        const finalState = await game.getState();
        const entries = finalState.sys.eventStream?.entries ?? [];
        const moveEvents = entries.filter((entry: any) => entry.event?.type === 'su:minion_moved');

        expect(moveEvents.length).toBeGreaterThanOrEqual(2);
        expect(finalState.core.players['0'].discard.some((card: any) => card.uid === 'truck-stop-p0')).toBe(false);
        expect(finalState.core.players['1'].discard.some((card: any) => card.uid === 'truck-stop-p1')).toBe(false);

        await game.screenshot('zhongguo-truck-stop-final-state', testInfo);
    });
});
