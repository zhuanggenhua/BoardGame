import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type MakeMyDayState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
        }>;
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

test.describe('SmashUp - zhongguo 一天的快乐链路', () => {
    test('打出一天的快乐后，应只允许选择有己方随从基地中战力 3 或更低的随从，并在消灭后抓 1 张牌', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'make-card', defId: 'vigilantes_make_my_day', type: 'action', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-1', defId: 'truckers_convoy', type: 'action', owner: '0' },
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
                    defId: 'base_the_mean_streets',
                    minions: [
                        {
                            uid: 'ally',
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
                            uid: 'target',
                            defId: 'disco_dancers_roller',
                            owner: '1',
                            controller: '1',
                            basePower: 3,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'too-big',
                            defId: 'kung_fu_fighters_lady_whirlwind',
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

        await game.playCard('vigilantes_make_my_day');
        await game.waitForInteraction('vigilantes_make_my_day', 10000);

        const options = await game.getInteractionOptions() as InteractionOption[];
        expect(options.some(option => option?.value?.minionUid === 'target')).toBe(true);
        expect(options.some(option => option?.value?.minionUid === 'ally')).toBe(true);
        expect(options.some(option => option?.value?.minionUid === 'too-big')).toBe(false);
        await game.screenshot('zhongguo-make-my-day-target-options', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target',
            '一天的快乐目标随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as MakeMyDayState;
            const player = state.core.players['0'];
            return {
                targetStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'target'),
                tooBigStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'too-big'),
                handHasDrawnCard: player.hand.some(card => card.uid === 'draw-1' && card.defId === 'truckers_convoy'),
                deckLength: player.deck.length,
                discardHasAction: player.discard.some(card => card.uid === 'make-card' && card.defId === 'vigilantes_make_my_day'),
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetStillOnBase: false,
            tooBigStillOnBase: true,
            handHasDrawnCard: true,
            deckLength: 0,
            discardHasAction: true,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-make-my-day-resolved', testInfo);
    });
});
