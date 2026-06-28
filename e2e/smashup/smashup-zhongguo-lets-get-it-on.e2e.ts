import { test, expect } from '../framework';

type InteractionOption = {
    id: string;
    value?: {
        minionUid?: string;
    };
};

type LetsGetItOnState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
            }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string }>;
            discard: Array<{ defId: string }>;
            actionsPlayed: number;
            actionLimit: number;
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

test.describe('SmashUp - zhongguo 让我们躁起来链路', () => {
    test('打出让我们躁起来后，应消灭所选己方随从所在基地中任意数量的不高于其战力的随从', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['kung_fu_fighters', 'truckers'],
                hand: [
                    { uid: 'lets-1', defId: 'kung_fu_fighters_lets_get_it_on', type: 'action', owner: '0' },
                ],
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
                            uid: 'source',
                            defId: 'truckers_cab_over_pete',
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
                            uid: 'enemy-a',
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
                        {
                            uid: 'enemy-b',
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
                        {
                            uid: 'enemy-c',
                            defId: 'vigilantes_stoneford',
                            owner: '1',
                            controller: '1',
                            basePower: 5,
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
        await game.waitForCurrentPlayer('0');

        await game.playCard('kung_fu_fighters_lets_get_it_on');
        await game.waitForInteraction('kung_fu_fighters_lets_get_it_on_source', 10000);
        await game.screenshot('zhongguo-lets-get-it-on-source', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'source',
            '让我们躁起来来源随从',
        );

        await game.waitForInteraction('kung_fu_fighters_lets_get_it_on_targets', 10000);
        await game.screenshot('zhongguo-lets-get-it-on-targets', testInfo);

        const options = await game.getInteractionOptions() as InteractionOption[];
        const selectedOptionIds = options
            .filter((option) => option.value?.minionUid === 'enemy-a' || option.value?.minionUid === 'enemy-b')
            .map((option) => option.id);
        expect(selectedOptionIds).toHaveLength(2);

        await respondCurrentInteraction(page, { optionIds: selectedOptionIds });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as LetsGetItOnState;
            const base = state.core.bases[0];
            const player = state.core.players['0'];
            return {
                enemyAStillOnBase: base.minions.some((minion) => minion.uid === 'enemy-a'),
                enemyBStillOnBase: base.minions.some((minion) => minion.uid === 'enemy-b'),
                enemyCStillOnBase: base.minions.some((minion) => minion.uid === 'enemy-c'),
                sourceStillOnBase: base.minions.some((minion) => minion.uid === 'source'),
                cardStillInHand: player.hand.some((card) => card.uid === 'lets-1'),
                discardHasAction: player.discard.some((card) => card.defId === 'kung_fu_fighters_lets_get_it_on'),
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            enemyAStillOnBase: false,
            enemyBStillOnBase: false,
            enemyCStillOnBase: true,
            sourceStillOnBase: true,
            cardStillInHand: false,
            discardHasAction: true,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-lets-get-it-on-resolved', testInfo);
    });
});
