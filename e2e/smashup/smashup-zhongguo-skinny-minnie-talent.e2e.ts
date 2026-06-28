import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        actionUid?: string;
        baseIndex?: number;
    };
};

type SkinnyMinnieState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; defId: string; talentUsed?: boolean }>;
            ongoingActions: Array<{
                uid: string;
                defId: string;
                ownerId?: string;
                metadata?: { sourceControllerId?: string };
            }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 皮包骨米妮天赋链路', () => {
    test('真实点击皮包骨米妮后，应移动自己并转移同基地战术', async ({ game, page }, testInfo) => {
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
                            uid: 'minnie',
                            defId: 'truckers_skinny_minnie',
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
                    ongoingActions: [
                        { uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0', controllerId: '0', talentUsed: false },
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
        const minnieCard = page.locator('[data-minion-uid="minnie"]').first();
        await expect(minnieCard).toBeVisible({ timeout: 15000 });
        await game.screenshot('zhongguo-skinny-minnie-ready', testInfo);

        await minnieCard.click({ force: true });
        await game.waitForInteraction('truckers_skinny_minnie_base', 10000);
        await game.screenshot('zhongguo-skinny-minnie-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '皮包骨米妮目标基地',
        );

        await game.waitForInteraction('truckers_skinny_minnie_action', 10000);
        await game.screenshot('zhongguo-skinny-minnie-action', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.actionUid === 'convoy-1',
            '皮包骨米妮目标战术',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as SkinnyMinnieState;
            const sourceBase = state.core.bases[0];
            const targetBase = state.core.bases[1];
            const movedMinnie = targetBase.minions.find(minion => minion.uid === 'minnie');
            const movedAction = targetBase.ongoingActions.find(action => action.uid === 'convoy-1');
            return {
                sourceHasMinnie: sourceBase.minions.some(minion => minion.uid === 'minnie'),
                sourceHasAction: sourceBase.ongoingActions.some(action => action.uid === 'convoy-1'),
                targetHasMinnie: Boolean(movedMinnie),
                minnieTalentUsed: movedMinnie?.talentUsed ?? false,
                targetHasAction: Boolean(movedAction),
                actionController: movedAction?.metadata?.sourceControllerId ?? null,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceHasMinnie: false,
            sourceHasAction: false,
            targetHasMinnie: true,
            minnieTalentUsed: true,
            targetHasAction: true,
            actionController: null,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-skinny-minnie-resolved', testInfo);
    });
});
