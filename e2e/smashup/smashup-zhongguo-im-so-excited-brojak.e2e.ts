import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
        baseIndex?: number;
        skip?: boolean;
    };
};

type ExcitedBrojakState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; tempPowerModifier?: number }>;
        }>;
        players: Record<string, { hand: Array<{ uid: string }>; deck: Array<{ uid: string }> }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 我很亢奋与神探布洛杰克联动链路', () => {
    test('打出我很亢奋后，应移动己方随从、抓牌，并让神探布洛杰克跟随到同一基地获得 +1 临时战力', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['disco_dancers', 'vigilantes'],
                hand: [
                    { uid: 'excited-card', defId: 'disco_dancers_im_so_excited', type: 'action', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-1', defId: 'vigilantes_make_my_day', type: 'action', owner: '0' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['truckers', 'kung_fu_fighters'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        {
                            uid: 'brojak',
                            defId: 'vigilantes_brojak',
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
                {
                    defId: 'base_central_brain',
                    minions: [
                        {
                            uid: 'mover',
                            defId: 'disco_dancers_roller',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
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
                    defId: 'base_funky_town',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('disco_dancers_im_so_excited');
        await game.waitForInteraction('disco_dancers_im_so_excited', 10000);
        await game.screenshot('zhongguo-im-so-excited-minion', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'mover',
            '我很亢奋选择移动随从',
        );

        await game.waitForInteraction('disco_dancers_im_so_excited_destination', 10000);
        await game.screenshot('zhongguo-im-so-excited-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 2,
            '我很亢奋目标基地',
        );

        await game.waitForInteraction('vigilantes_brojak', 10000);
        await game.screenshot('zhongguo-brojak-follow', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.skip === false,
            '神探布洛杰克跟随',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as ExcitedBrojakState;
            return {
                brojakAtSource: state.core.bases[0].minions.some(minion => minion.uid === 'brojak'),
                moverAtSource: state.core.bases[1].minions.some(minion => minion.uid === 'mover'),
                brojakAtTarget: state.core.bases[2].minions.some(minion => minion.uid === 'brojak'),
                brojakBuff: state.core.bases[2].minions.find(minion => minion.uid === 'brojak')?.tempPowerModifier ?? 0,
                moverAtTarget: state.core.bases[2].minions.some(minion => minion.uid === 'mover'),
                handHasDrawnCard: state.core.players['0'].hand.some(card => card.uid === 'draw-1'),
                deckLength: state.core.players['0'].deck.length,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            brojakAtSource: false,
            moverAtSource: false,
            brojakAtTarget: true,
            brojakBuff: 1,
            moverAtTarget: true,
            handHasDrawnCard: true,
            deckLength: 0,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-im-so-excited-brojak-resolved', testInfo);
    });
});
