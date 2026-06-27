import { test, expect } from '../framework';

type RubberChickenState = {
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

test.describe('SmashUp - zhongguo 橡皮鸡持续战力链路', () => {
    test('橡皮鸡在真实页面应只按本基地己方基地战术数量获得持续战力', async ({ page, game }, testInfo) => {
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
                            uid: 'rubber',
                            defId: 'truckers_rubber_chicken',
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
                        { uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0' },
                        { uid: 'armor-1', defId: 'truckers_armored_truck', ownerId: '0' },
                        { uid: 'enemy-convoy', defId: 'truckers_convoy', ownerId: '1' },
                    ],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-rubber-chicken-power-ready', testInfo);

        await expect.poll(async () => {
            const state = await game.getState() as RubberChickenState;
            const powerBadgeText = (await page.getByTestId('su-minion-power-badge-rubber').textContent())?.trim() ?? '';
            const powerBadgeTitle = await page.getByTestId('su-minion-power-badge-rubber').getAttribute('title') ?? '';
            return {
                rubberOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'rubber'),
                ownActionCount: state.core.bases[0].ongoingActions.filter(action => action.ownerId === '0').length,
                enemyActionCount: state.core.bases[0].ongoingActions.filter(action => action.ownerId === '1').length,
                powerBadgeText,
                titleHasBasePower: powerBadgeTitle.includes('基础: 4'),
                titleHasFinalPower: powerBadgeTitle.includes('= 6'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            rubberOnBase: true,
            ownActionCount: 2,
            enemyActionCount: 1,
            powerBadgeText: '+2',
            titleHasBasePower: true,
            titleHasFinalPower: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-rubber-chicken-power-resolved', testInfo);
    });
});
