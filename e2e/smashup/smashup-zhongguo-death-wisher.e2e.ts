import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type DeathWisherState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; defId: string }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            deck: Array<{ uid: string; defId: string }>;
            discard: Array<{ uid: string; defId: string }>;
            actionsPlayed: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: { data?: { sourceId?: string } } | null } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 猛龙怪客链路', () => {
    test('对手消灭你的随从后，应触发猛龙怪客反杀对手一个随从，且清理交互队列', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', { seat1: 'human' });
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '1',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 1,
                actionLimit: 1,
            },
            player1: {
                factions: ['vigilantes', 'disco_dancers'],
                hand: [
                    { uid: 'make-my-day-card', defId: 'vigilantes_make_my_day', type: 'action', owner: '1' },
                ],
                deck: [
                    { uid: 'enemy-draw', defId: 'disco_dancers_roller', type: 'minion', owner: '1' },
                ],
                discard: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_mean_streets',
                    minions: [
                        {
                            uid: 'death-wisher',
                            defId: 'vigilantes_death_wisher',
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
                            uid: 'victim',
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
                            uid: 'enemy-hitman',
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
                {
                    defId: 'base_funky_town',
                    minions: [
                        {
                            uid: 'enemy-wingman',
                            defId: 'disco_dancers_roller',
                            owner: '1',
                            controller: '1',
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
        await game.waitForCurrentPlayer('1');

        await game.playCard('vigilantes_make_my_day');
        await game.waitForInteraction('vigilantes_make_my_day', 10000);
        await game.screenshot('zhongguo-death-wisher-destroy-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'victim',
            '一天的快乐消灭目标',
        );

        await game.waitForInteraction('vigilantes_death_wisher', 10000);
        await game.screenshot('zhongguo-death-wisher-revenge-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'enemy-wingman',
            '猛龙怪客反杀目标',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as DeathWisherState;
            return {
                victimStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'victim'),
                enemyWingmanStillOnBase: state.core.bases[1].minions.some(minion => minion.uid === 'enemy-wingman'),
                player1DrewCard: state.core.players['1'].hand.some(card => card.uid === 'enemy-draw' && card.defId === 'disco_dancers_roller'),
                player1ActionDiscarded: state.core.players['1'].discard.some(card => card.uid === 'make-my-day-card' && card.defId === 'vigilantes_make_my_day'),
                player0DiscardHasVictim: state.core.players['0'].discard.some(card => card.uid === 'victim' && card.defId === 'truckers_good_buddy'),
                player1DiscardHasWingman: state.core.players['1'].discard.some(card => card.uid === 'enemy-wingman' && card.defId === 'disco_dancers_roller'),
                actionsPlayed: state.core.players['1'].actionsPlayed,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            victimStillOnBase: false,
            enemyWingmanStillOnBase: false,
            player1DrewCard: true,
            player1ActionDiscarded: true,
            player0DiscardHasVictim: true,
            player1DiscardHasWingman: true,
            actionsPlayed: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-death-wisher-resolved', testInfo);
    });
});
