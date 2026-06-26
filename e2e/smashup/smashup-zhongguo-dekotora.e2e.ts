import { test, expect } from '../framework';

type InteractionOption = {
    id: string;
    value?: {
        baseIndex?: number;
        minionUid?: string;
    };
};

type DekotoraState = {
    core: {
        bases: Array<{
            ongoingActions: Array<{ uid: string; defId: string; talentUsed?: boolean }>;
            minions: Array<{ uid: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: { playerId?: string } | null } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

async function respondCurrentInteraction(page: any, payload: { optionId?: string; optionIds?: string[] }): Promise<void> {
    await page.evaluate((responsePayload: { optionId?: string; optionIds?: string[] }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const interaction = state?.sys?.interaction?.current;
        if (!interaction?.playerId) throw new Error('当前没有可响应的交互');
        harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId: interaction.playerId,
            payload: responsePayload,
        });
    }, payload);
    await page.waitForTimeout(300);
}

test.describe('SmashUp - zhongguo 暴走卡车天赋链路', () => {
    test('真实点击暴走卡车后，应移动自身到另一基地并把至多两个己方随从一起移动过去', async ({ game, page }, testInfo) => {
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
                            uid: 'm1',
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
                            uid: 'm2',
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
                        {
                            uid: 'm3',
                            defId: 'vigilantes_death_wisher',
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
                        { uid: 'deko-1', defId: 'truckers_dekotora', ownerId: '0', controllerId: '0', talentUsed: false },
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

        const dekotoraCard = page.locator('[data-ongoing-uid="deko-1"]').first();
        await expect(dekotoraCard).toBeVisible({ timeout: 15000 });
        await game.screenshot('zhongguo-dekotora-ready', testInfo);

        await dekotoraCard.click({ force: true });
        await page.waitForTimeout(200);
        await dekotoraCard.click({ force: true });
        await game.waitForInteraction('truckers_dekotora_base', 10000);
        await game.screenshot('zhongguo-dekotora-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '暴走卡车目标基地',
        );

        await game.waitForInteraction('truckers_dekotora_minions', 10000);
        await game.screenshot('zhongguo-dekotora-minions', testInfo);

        const options = await game.getInteractionOptions() as InteractionOption[];
        const selectedOptionIds = options
            .filter(option => option.value?.minionUid === 'm1' || option.value?.minionUid === 'm2')
            .map(option => option.id);
        expect(selectedOptionIds).toHaveLength(2);

        await respondCurrentInteraction(page, { optionIds: selectedOptionIds });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as DekotoraState;
            const sourceBase = state.core.bases[0];
            const targetBase = state.core.bases[1];
            const movedAction = targetBase.ongoingActions.find(action => action.uid === 'deko-1');
            return {
                sourceHasDeko: sourceBase.ongoingActions.some(action => action.uid === 'deko-1'),
                targetHasDeko: Boolean(movedAction),
                dekoTalentUsed: movedAction?.talentUsed ?? false,
                sourceHasM1: sourceBase.minions.some(minion => minion.uid === 'm1'),
                sourceHasM2: sourceBase.minions.some(minion => minion.uid === 'm2'),
                sourceHasM3: sourceBase.minions.some(minion => minion.uid === 'm3'),
                targetHasM1: targetBase.minions.some(minion => minion.uid === 'm1'),
                targetHasM2: targetBase.minions.some(minion => minion.uid === 'm2'),
                targetHasM3: targetBase.minions.some(minion => minion.uid === 'm3'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceHasDeko: false,
            targetHasDeko: true,
            dekoTalentUsed: true,
            sourceHasM1: false,
            sourceHasM2: false,
            sourceHasM3: true,
            targetHasM1: true,
            targetHasM2: true,
            targetHasM3: false,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-dekotora-resolved', testInfo);
    });
});
