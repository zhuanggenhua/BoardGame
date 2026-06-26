import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
        baseIndex?: number;
    };
};

type ChaseState = {
    core: {
        bases: Array<{
            ongoingActions: Array<{ uid: string; defId: string; talentUsed?: boolean }>;
            minions: Array<{ uid: string; tempPowerModifier?: number }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 高速追逐战天赋链路', () => {
    test('真实点击高速追逐战后，应移动自身和己方随从到另一基地并给该随从 +3 临时战力', async ({ game, page }, testInfo) => {
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
                            uid: 'runner-1',
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
                            uid: 'spectator-1',
                            defId: 'disco_dancers_diva',
                            owner: '1',
                            controller: '1',
                            basePower: 3,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [
                        { uid: 'chase-1', defId: 'truckers_high_speed_chase', ownerId: '0', controllerId: '0', talentUsed: false },
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

        const chaseCard = page.locator('[data-ongoing-uid="chase-1"]').first();
        await expect(chaseCard).toBeVisible({ timeout: 15000 });
        await game.screenshot('zhongguo-high-speed-chase-ready', testInfo);

        await chaseCard.click({ force: true });
        await page.waitForTimeout(200);
        await chaseCard.click({ force: true });
        await game.waitForInteraction('truckers_high_speed_chase_minion', 10000);
        await game.screenshot('zhongguo-high-speed-chase-minion', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'runner-1',
            '高速追逐战选择己方随从',
        );

        await game.waitForInteraction('truckers_high_speed_chase_base', 10000);
        await game.screenshot('zhongguo-high-speed-chase-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '高速追逐战目标基地',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as ChaseState;
            const sourceBase = state.core.bases[0];
            const targetBase = state.core.bases[1];
            const movedMinion = targetBase.minions.find(minion => minion.uid === 'runner-1');
            const movedAction = targetBase.ongoingActions.find(action => action.uid === 'chase-1');
            return {
                sourceHasRunner: sourceBase.minions.some(minion => minion.uid === 'runner-1'),
                sourceHasChase: sourceBase.ongoingActions.some(action => action.uid === 'chase-1'),
                targetHasRunner: Boolean(movedMinion),
                targetRunnerBuff: movedMinion?.tempPowerModifier ?? 0,
                targetHasChase: Boolean(movedAction),
                chaseTalentUsed: movedAction?.talentUsed ?? false,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceHasRunner: false,
            sourceHasChase: false,
            targetHasRunner: true,
            targetRunnerBuff: 3,
            targetHasChase: true,
            chaseTalentUsed: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-high-speed-chase-resolved', testInfo);
    });
});
