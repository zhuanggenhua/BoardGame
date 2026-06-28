import { test, expect } from '../framework';

type DrunkenMasterState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                powerCounters?: number;
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

test.describe('SmashUp - zhongguo 醉酒宗师天赋链路', () => {
    test('真实点击醉酒宗师后，应给自己放置 1 枚力量指示物并完成结算清理', async ({ game, page }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
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
                factions: ['disco_dancers', 'vigilantes'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_ancient_dojo',
                    minions: [
                        {
                            uid: 'drunken-1',
                            defId: 'kung_fu_fighters_drunken_master',
                            owner: '0',
                            controller: '0',
                            basePower: 3,
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
                    defId: 'base_the_greasy_spoon',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const drunkenMaster = page.locator('[data-minion-uid="drunken-1"]').first();
        await expect(drunkenMaster).toBeVisible({ timeout: 15000 });
        await game.screenshot('zhongguo-drunken-master-ready', testInfo);

        await drunkenMaster.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState() as DrunkenMasterState;
            const self = state.core.bases[0].minions.find(minion => minion.uid === 'drunken-1');
            return {
                selfCounters: self?.powerCounters ?? 0,
                selfTalentUsed: self?.talentUsed ?? false,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            selfCounters: 1,
            selfTalentUsed: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-drunken-master-resolved', testInfo);
    });
});
