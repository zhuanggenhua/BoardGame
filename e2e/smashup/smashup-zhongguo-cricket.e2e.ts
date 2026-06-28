import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type CricketState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                powerCounters?: number;
            }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: { data?: { sourceId?: string } } | null } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 蟋蟀打出链路', () => {
    test('打出蟋蟀后，应依次选择标记来源与目标，并转移 1 枚力量指示物', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['kung_fu_fighters', 'truckers'],
                hand: [
                    { uid: 'cricket-1', defId: 'kung_fu_fighters_cricket', type: 'minion', owner: '0' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['vigilantes', 'disco_dancers'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        {
                            uid: 'src',
                            defId: 'truckers_good_buddy',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            powerCounters: 1,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'dst',
                            defId: 'vigilantes_jacky_bill',
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

        await game.playCard('kung_fu_fighters_cricket', { targetBaseIndex: 0 });
        await game.waitForInteraction('kung_fu_counter_transfer_source', 10000);
        await game.screenshot('zhongguo-cricket-source', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'src',
            '蟋蟀标记来源随从',
        );

        await game.waitForInteraction('kung_fu_counter_transfer_target', 10000);
        await game.screenshot('zhongguo-cricket-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'dst',
            '蟋蟀标记目标随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as CricketState;
            const base = state.core.bases[0];
            return {
                cricketEnteredBase: base.minions.some(minion => minion.uid === 'cricket-1'),
                sourceCounters: base.minions.find(minion => minion.uid === 'src')?.powerCounters ?? 0,
                targetCounters: base.minions.find(minion => minion.uid === 'dst')?.powerCounters ?? 0,
                cricketStillInHand: state.core.players['0'].hand.some(card => card.uid === 'cricket-1'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                interactionSourceId: state.sys.interaction?.current?.data?.sourceId ?? null,
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            cricketEnteredBase: true,
            sourceCounters: 0,
            targetCounters: 1,
            cricketStillInHand: false,
            interactionOpen: false,
            interactionSourceId: null,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-cricket-resolved', testInfo);
    });
});
