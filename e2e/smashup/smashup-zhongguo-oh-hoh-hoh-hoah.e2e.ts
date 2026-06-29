import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type OhHohState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                powerCounters?: number;
            }>;
            ongoingActions: Array<{
                uid: string;
                talentUsed?: boolean;
            }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 哦吼吼吼吼啊触发链路', () => {
    test('对手在同基地打出随从后，哦吼吼吼吼啊应让你给己方目标随从放置 1 枚力量指示物并完成结算清理', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '1',
            phase: 'playCards',
            player0: {
                factions: ['kung_fu_fighters', 'truckers'],
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['vigilantes', 'disco_dancers'],
                hand: [
                    { uid: 'enemy-play', defId: 'pirate_first_mate', type: 'minion', owner: '1' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        {
                            uid: 'ally-a',
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
                            uid: 'ally-b',
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
                    ongoingActions: [
                        {
                            uid: 'hoah-1',
                            defId: 'kung_fu_fighters_oh_hoh_hoh_hoah',
                            ownerId: '0',
                            talentUsed: false,
                        },
                    ],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('1');
        await game.screenshot('zhongguo-oh-hoh-hoh-hoah-ready', testInfo);

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForInteraction('kung_fu_fighters_oh_hoh_hoh_hoah', 10000);
        await game.screenshot('zhongguo-oh-hoh-hoh-hoah-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'ally-b',
            '哦吼吼吼吼啊加标记目标',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as OhHohState;
            const base = state.core.bases[0];
            return {
                enemyPlayedMinionEnteredBase: base.minions.some(minion => minion.uid === 'enemy-play'),
                targetCounters: base.minions.find(minion => minion.uid === 'ally-b')?.powerCounters ?? 0,
                otherCounters: base.minions.find(minion => minion.uid === 'ally-a')?.powerCounters ?? 0,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            enemyPlayedMinionEnteredBase: true,
            targetCounters: 1,
            otherCounters: 0,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-oh-hoh-hoh-hoah-resolved', testInfo);
    });
});
