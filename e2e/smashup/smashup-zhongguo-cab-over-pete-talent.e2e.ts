import { test, expect } from '../framework';

type TalentState = {
    core: {
        bases: Array<{
            ongoingActions: Array<{ uid: string; talentUsed?: boolean }>;
            minions: Array<{ uid: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

type InteractionOption = {
    value?: {
        baseIndex?: number;
        actionUid?: string;
    };
};

test.describe('SmashUp - zhongguo 平头彼特天赋链路', () => {
    test('真实点击平头彼特后，应移动自身到另一基地并把同基地另一张己方战术一起移动过去', async ({ game, page }, testInfo) => {
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
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        {
                            uid: 'buddy-1',
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
                        { uid: 'pete-1', defId: 'truckers_cab_over_pete', ownerId: '0', talentUsed: false },
                        { uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0', talentUsed: false },
                    ],
                },
                {
                    defId: 'base_central_brain',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const peteCard = page.locator('[data-ongoing-uid="pete-1"]').first();
        await expect(peteCard).toBeVisible({ timeout: 15000 });
        await game.screenshot('zhongguo-cab-over-pete-ready', testInfo);

        await peteCard.click({ force: true });
        await game.waitForInteraction('truckers_cab_over_pete_base', 10000);
        await game.screenshot('zhongguo-cab-over-pete-choose-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '平头彼特目标基地',
        );

        await game.waitForInteraction('truckers_cab_over_pete_card', 10000);
        await game.screenshot('zhongguo-cab-over-pete-choose-card', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.actionUid === 'convoy-1',
            '平头彼特移动同基地己方战术',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as TalentState;
            return {
                sourceHasPete: state.core.bases[0].ongoingActions.some(action => action.uid === 'pete-1'),
                sourceHasConvoy: state.core.bases[0].ongoingActions.some(action => action.uid === 'convoy-1'),
                targetHasPete: state.core.bases[1].ongoingActions.some(action => action.uid === 'pete-1'),
                targetHasConvoy: state.core.bases[1].ongoingActions.some(action => action.uid === 'convoy-1'),
                peteTalentUsed: state.core.bases[1].ongoingActions.find(action => action.uid === 'pete-1')?.talentUsed ?? false,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceHasPete: false,
            sourceHasConvoy: false,
            targetHasPete: true,
            targetHasConvoy: true,
            peteTalentUsed: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-cab-over-pete-resolved', testInfo);
    });
});
