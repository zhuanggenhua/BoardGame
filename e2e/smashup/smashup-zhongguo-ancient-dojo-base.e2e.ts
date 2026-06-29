import { test, expect } from '../framework';

type AncientDojoState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                powerCounters?: number;
            }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string }>;
            minionsPlayed: number;
            minionLimit: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 古道场基地链路', () => {
    test('在古道场打出随从后，应给同基地更低战力的己方随从各放置 1 枚力量指示物', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['kung_fu_fighters', 'truckers'],
                hand: [
                    { uid: 'dragon-in-hand', defId: 'kung_fu_fighters_dragon_warrior', type: 'minion', owner: '0' },
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
                    defId: 'base_ancient_dojo',
                    minions: [
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
                            uid: 'ally-equal',
                            defId: 'vigilantes_jacky_bill',
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
                            uid: 'enemy-low',
                            defId: 'disco_dancers_roller',
                            owner: '1',
                            controller: '1',
                            basePower: 1,
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
        await game.screenshot('zhongguo-ancient-dojo-ready', testInfo);

        await game.playCard('kung_fu_fighters_dragon_warrior', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as AncientDojoState;
            const base = state.core.bases[0];
            const player = state.core.players['0'];
            return {
                dragonEnteredBase: base.minions.some((minion) => minion.uid === 'dragon-in-hand'),
                allyLowCounters: base.minions.find((minion) => minion.uid === 'ally-low')?.powerCounters ?? 0,
                allyEqualCounters: base.minions.find((minion) => minion.uid === 'ally-equal')?.powerCounters ?? 0,
                enemyLowCounters: base.minions.find((minion) => minion.uid === 'enemy-low')?.powerCounters ?? 0,
                cardStillInHand: player.hand.some((card) => card.uid === 'dragon-in-hand'),
                minionsPlayed: player.minionsPlayed,
                minionLimit: player.minionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            dragonEnteredBase: true,
            allyLowCounters: 1,
            allyEqualCounters: 0,
            enemyLowCounters: 0,
            cardStillInHand: false,
            minionsPlayed: 1,
            minionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-ancient-dojo-resolved', testInfo);
    });
});
