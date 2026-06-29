import { test, expect } from '../framework';

type WhoLovesYaBabyState = {
    core: {
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            deck: Array<{ uid: string; defId: string }>;
            discard: Array<{ uid: string; defId: string }>;
            actionsPlayed: number;
            actionLimit: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 谁爱你，小老弟？链路', () => {
    test('打出谁爱你，小老弟？后，应按己方战力 4 或更高随从数量抓牌', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'who-1', defId: 'vigilantes_who_loves_ya_baby', type: 'action', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-1', defId: 'truckers_convoy', type: 'action', owner: '0' },
                    { uid: 'draw-2', defId: 'truckers_good_buddy', type: 'minion', owner: '0' },
                    { uid: 'draw-3', defId: 'disco_dancers_roller', type: 'minion', owner: '0' },
                ],
                discard: [],
                minionsPlayed: 0,
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
                    defId: 'base_hideout',
                    minions: [
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
                        {
                            uid: 'ally-5',
                            defId: 'truckers_el_bandido',
                            owner: '0',
                            controller: '0',
                            basePower: 5,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'ally-low',
                            defId: 'truckers_good_buddy',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'enemy-4',
                            defId: 'disco_dancers_roller',
                            owner: '1',
                            controller: '1',
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
        await game.screenshot('zhongguo-who-loves-ya-baby-ready', testInfo);

        await game.playCard('vigilantes_who_loves_ya_baby');
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as WhoLovesYaBabyState;
            const player = state.core.players['0'];
            return {
                handHasFirstDraw: player.hand.some(card => card.uid === 'draw-1' && card.defId === 'truckers_convoy'),
                handHasSecondDraw: player.hand.some(card => card.uid === 'draw-2' && card.defId === 'truckers_good_buddy'),
                handHasThirdDraw: player.hand.some(card => card.uid === 'draw-3'),
                handStillHasAction: player.hand.some(card => card.uid === 'who-1'),
                deckTopUid: player.deck[0]?.uid ?? null,
                discardHasAction: player.discard.some(card => card.uid === 'who-1' && card.defId === 'vigilantes_who_loves_ya_baby'),
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            handHasFirstDraw: true,
            handHasSecondDraw: true,
            handHasThirdDraw: false,
            handStillHasAction: false,
            deckTopUid: 'draw-3',
            discardHasAction: true,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-who-loves-ya-baby-resolved', testInfo);
    });
});
