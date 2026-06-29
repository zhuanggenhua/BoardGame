import { test, expect } from '../framework';

type ConvoyState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
            ongoingActions: Array<{ uid: string; defId: string; ownerId: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 车队基地力量链路', () => {
    test('车队在真实页面应只按各自控制的同基地基地战术数量提供基地力量', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['truckers', 'vigilantes'],
                hand: [],
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
                            uid: 'buddy',
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
                    ],
                    ongoingActions: [
                        { uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0' },
                        { uid: 'armor-1', defId: 'truckers_armored_truck', ownerId: '0' },
                        { uid: 'enemy-convoy', defId: 'truckers_convoy', ownerId: '1' },
                    ],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-convoy-base-power-ready', testInfo);

        await expect.poll(async () => {
            const state = await game.getState() as ConvoyState;
            const ownScoreText = (await page.getByTestId('su-base-score-0-0').textContent())?.trim() ?? '';
            const enemyScoreText = (await page.getByTestId('su-base-score-0-1').textContent())?.trim() ?? '';
            return {
                buddyOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'buddy'),
                ownConvoyCount: state.core.bases[0].ongoingActions.filter(action => action.ownerId === '0').length,
                enemyConvoyCount: state.core.bases[0].ongoingActions.filter(action => action.ownerId === '1').length,
                ownScoreText,
                enemyScoreText,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            buddyOnBase: true,
            ownConvoyCount: 2,
            enemyConvoyCount: 1,
            ownScoreText: '4',
            enemyScoreText: '1',
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-convoy-base-power-resolved', testInfo);
    });
});
