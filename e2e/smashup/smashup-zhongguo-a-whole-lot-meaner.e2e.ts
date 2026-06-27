import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type WholeLotMeanerState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                tempPowerModifier?: number;
            }>;
        }>;
        players: Record<string, {
            discard: Array<{ uid: string; defId: string }>;
            actionsPlayed: number;
            actionLimit: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 凶恶百倍链路', () => {
    test('打出凶恶百倍后，应给目标随从 +3 临时战力并完成结算清理', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'meaner-card', defId: 'vigilantes_a_whole_lot_meaner', type: 'action', owner: '0' },
                ],
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
                    defId: 'base_the_mean_streets',
                    minions: [
                        {
                            uid: 'target',
                            defId: 'truckers_good_buddy',
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
                            uid: 'other-target',
                            defId: 'kung_fu_fighters_lady_whirlwind',
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
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('vigilantes_a_whole_lot_meaner');
        await game.waitForInteraction('vigilantes_a_whole_lot_meaner', 10000);
        await game.screenshot('zhongguo-a-whole-lot-meaner-target-options', testInfo);

        const options = await game.getInteractionOptions() as InteractionOption[];
        expect(options.some(option => option?.value?.minionUid === 'target')).toBe(true);
        expect(options.some(option => option?.value?.minionUid === 'other-target')).toBe(true);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target',
            '凶恶百倍目标随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as WholeLotMeanerState;
            const base = state.core.bases[0];
            return {
                targetBuff: base.minions.find(minion => minion.uid === 'target')?.tempPowerModifier ?? 0,
                otherTargetBuff: base.minions.find(minion => minion.uid === 'other-target')?.tempPowerModifier ?? 0,
                discardHasAction: state.core.players['0'].discard.some(card => card.uid === 'meaner-card' && card.defId === 'vigilantes_a_whole_lot_meaner'),
                actionsPlayed: state.core.players['0'].actionsPlayed,
                actionLimit: state.core.players['0'].actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetBuff: 3,
            otherTargetBuff: 0,
            discardHasAction: true,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-a-whole-lot-meaner-resolved', testInfo);
    });
});
