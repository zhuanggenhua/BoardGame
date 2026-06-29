import { test, expect } from '../framework';

type FeelingLuckyState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                attachedActions?: Array<{ uid: string; defId: string }>;
            }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            discard: Array<{ uid: string; defId: string }>;
            actionsPlayed: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 觉得运气不错？链路', () => {
    test('宿主控制者真实打出战术后，应让附着了觉得运气不错？的宿主随从被消灭', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'who-card', defId: 'vigilantes_who_loves_ya_baby', type: 'action', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-1', defId: 'truckers_convoy', type: 'action', owner: '0' },
                ],
                discard: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['disco_dancers', 'kung_fu_fighters'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_the_mean_streets',
                    minions: [
                        {
                            uid: 'host',
                            defId: 'truckers_good_buddy',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [
                                { uid: 'lucky-1', defId: 'vigilantes_feeling_lucky', ownerId: '1' },
                            ],
                        },
                        {
                            uid: 'ally-4',
                            defId: 'vigilantes_jacky_bill',
                            owner: '0',
                            controller: '0',
                            basePower: 4,
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
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-feeling-lucky-ready', testInfo);

        await game.playCard('vigilantes_who_loves_ya_baby');
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as FeelingLuckyState;
            return {
                hostStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'host'),
                allyStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'ally-4'),
                luckyStillAttached: state.core.bases[0].minions.some(minion =>
                    minion.uid === 'host' && (minion.attachedActions ?? []).some(action => action.uid === 'lucky-1'),
                ),
                whoDiscarded: state.core.players['0'].discard.some(card => card.uid === 'who-card' && card.defId === 'vigilantes_who_loves_ya_baby'),
                hostInDiscard: state.core.players['0'].discard.some(card => card.uid === 'host' && card.defId === 'truckers_good_buddy'),
                playerDrewCard: state.core.players['0'].hand.some(card => card.uid === 'draw-1' && card.defId === 'truckers_convoy'),
                actionsPlayed: state.core.players['0'].actionsPlayed,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            hostStillOnBase: false,
            allyStillOnBase: true,
            luckyStillAttached: false,
            whoDiscarded: true,
            hostInDiscard: true,
            playerDrewCard: true,
            actionsPlayed: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-feeling-lucky-resolved', testInfo);
    });
});
