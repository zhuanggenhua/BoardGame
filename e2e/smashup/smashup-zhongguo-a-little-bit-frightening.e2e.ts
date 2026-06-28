import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type FrighteningState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                owner: string;
                powerCounters?: number;
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
        interaction?: { current?: { data?: { sourceId?: string } } | null } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 有些胆寒链路', () => {
    test('打出有些胆寒后，应先选参照随从，再消灭同基地更低战力随从，最后给该基地己方目标放置两枚力量指示物', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['kung_fu_fighters', 'truckers'],
                hand: [
                    { uid: 'fright-card', defId: 'kung_fu_fighters_a_little_bit_frightening', type: 'action', owner: '0' },
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
                            uid: 'reference',
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
                        {
                            uid: 'enemy-low',
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
                            uid: 'enemy-high',
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
                            defId: 'truckers_cab_over_pete',
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
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('kung_fu_fighters_a_little_bit_frightening');
        await game.waitForInteraction('kung_fu_fighters_a_little_bit_frightening_reference', 10000);
        await game.screenshot('zhongguo-a-little-bit-frightening-reference', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'reference',
            '有些胆寒参照随从',
        );

        await game.waitForInteraction('kung_fu_fighters_a_little_bit_frightening_destroy', 10000);
        await game.screenshot('zhongguo-a-little-bit-frightening-destroy', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'enemy-low',
            '有些胆寒消灭目标',
        );

        await game.waitForInteraction('kung_fu_fighters_a_little_bit_frightening_reward', 10000);
        await game.screenshot('zhongguo-a-little-bit-frightening-reward', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'ally-b',
            '有些胆寒放置指示物目标',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as FrighteningState;
            const base = state.core.bases[0];
            const player = state.core.players['0'];
            return {
                enemyLowStillOnBase: base.minions.some(minion => minion.uid === 'enemy-low'),
                enemyHighStillOnBase: base.minions.some(minion => minion.uid === 'enemy-high'),
                allyBCounters: base.minions.find(minion => minion.uid === 'ally-b')?.powerCounters ?? 0,
                allyACounters: base.minions.find(minion => minion.uid === 'ally-a')?.powerCounters ?? 0,
                referenceStillOnBase: base.minions.some(minion => minion.uid === 'reference' && minion.owner === '0'),
                actionStillInHand: player.hand.some(card => card.uid === 'fright-card'),
                discardHasAction: player.discard.some(card => card.defId === 'kung_fu_fighters_a_little_bit_frightening'),
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                interactionSourceId: state.sys.interaction?.current?.data?.sourceId ?? null,
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            enemyLowStillOnBase: false,
            enemyHighStillOnBase: true,
            allyBCounters: 2,
            allyACounters: 0,
            referenceStillOnBase: true,
            actionStillInHand: false,
            discardHasAction: true,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            interactionSourceId: null,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-a-little-bit-frightening-resolved', testInfo);
    });
});
