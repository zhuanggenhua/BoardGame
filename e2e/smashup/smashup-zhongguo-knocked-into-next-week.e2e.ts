import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type KnockedState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
        }>;
        players: Record<string, {
            deck: Array<{ uid: string; defId: string }>;
            discard: Array<{ defId: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 打到穿越链路', () => {
    test('打出打到穿越后，应把目标随从洗回其拥有者牌库', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'knock-card', defId: 'vigilantes_knocked_into_next_week', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['disco_dancers', 'kung_fu_fighters'],
                hand: [],
                deck: [
                    { uid: 'enemy-deck-1', defId: 'kung_fu_fighters_cricket', type: 'minion', owner: '1' },
                ],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_the_mean_streets',
                    minions: [
                        {
                            uid: 'target',
                            defId: 'truckers_good_buddy',
                            owner: '1',
                            controller: '1',
                            basePower: 2,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'other-minion',
                            defId: 'kung_fu_fighters_cricket',
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
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('vigilantes_knocked_into_next_week');
        await game.waitForInteraction('vigilantes_knocked_into_next_week', 10000);
        await game.screenshot('zhongguo-knocked-into-next-week-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target',
            '打到穿越目标随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as KnockedState;
            return {
                targetStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'target'),
                ownerDeckHasTarget: state.core.players['1'].deck.some(card => card.uid === 'target' && card.defId === 'truckers_good_buddy'),
                casterDeckHasTarget: state.core.players['0'].deck.some(card => card.uid === 'target'),
                casterDiscardHasAction: state.core.players['0'].discard.some(card => card.defId === 'vigilantes_knocked_into_next_week'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetStillOnBase: false,
            ownerDeckHasTarget: true,
            casterDeckHasTarget: false,
            casterDiscardHasAction: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-knocked-into-next-week-resolved', testInfo);
    });
});
