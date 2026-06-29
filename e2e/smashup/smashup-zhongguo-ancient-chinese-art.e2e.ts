import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type AncientChineseArtState = {
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

test.describe('SmashUp - zhongguo 古老的中国艺术天赋链路', () => {
    test('真实点击古老的中国艺术后，应给本基地目标随从放置 1 枚力量指示物并完成结算清理', async ({ game, page }, testInfo) => {
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
                            uid: 'art-1',
                            defId: 'kung_fu_fighters_ancient_chinese_art',
                            ownerId: '0',
                            talentUsed: false,
                        },
                    ],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const artCard = page.locator('[data-ongoing-uid="art-1"]').first();
        await expect(artCard).toBeVisible({ timeout: 15000 });
        await game.screenshot('zhongguo-ancient-chinese-art-ready', testInfo);

        await artCard.click({ force: true });
        await game.waitForInteraction('kung_fu_fighters_ancient_chinese_art_add_counter', 10000);
        await game.screenshot('zhongguo-ancient-chinese-art-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'ally-b',
            '古老的中国艺术加标记目标',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as AncientChineseArtState;
            const base = state.core.bases[0];
            return {
                targetCounters: base.minions.find(minion => minion.uid === 'ally-b')?.powerCounters ?? 0,
                otherCounters: base.minions.find(minion => minion.uid === 'ally-a')?.powerCounters ?? 0,
                artTalentUsed: base.ongoingActions.find(action => action.uid === 'art-1')?.talentUsed ?? false,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetCounters: 1,
            otherCounters: 0,
            artTalentUsed: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-ancient-chinese-art-resolved', testInfo);
    });
});
