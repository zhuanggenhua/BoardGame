import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
        baseIndex?: number;
    };
};

type ArmoredTruckState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
        }>;
        players: Record<string, {
            discard: Array<{ defId: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 装甲卡车保护链路', () => {
    test('装甲卡车生效时，对手的直面恐惧目标列表里不应出现该基地的己方随从', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'disco_dancers'],
                hand: [
                    { uid: 'scared-card', defId: 'vigilantes_scared_straight', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['truckers', 'kung_fu_fighters'],
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 1,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_mean_streets',
                    minions: [
                        {
                            uid: 'protected-minion',
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
                            uid: 'player0-anchor-a',
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
                    ongoingActions: [{ uid: 'armor-live', defId: 'truckers_armored_truck', ownerId: '1' }],
                },
                {
                    defId: 'base_funky_town',
                    minions: [
                        {
                            uid: 'movable-target',
                            defId: 'kung_fu_fighters_cricket',
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
                            uid: 'player0-anchor-b',
                            defId: 'disco_dancers_roller',
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
                {
                    defId: 'base_boogie_wonderland',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-armored-truck-protection-ready', testInfo);

        await game.playCard('vigilantes_scared_straight');
        await game.waitForInteraction('vigilantes_scared_straight', 10000);

        const options = await game.getInteractionOptions() as InteractionOption[];
        expect(options.some(option => option?.value?.minionUid === 'protected-minion')).toBe(false);
        expect(options.some(option => option?.value?.minionUid === 'movable-target')).toBe(true);
        await game.screenshot('zhongguo-armored-truck-protection-target-options', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'movable-target',
            '直面恐惧只能选择未受装甲卡车保护目标',
        );

        await game.waitForInteraction('vigilantes_scared_straight_destination', 10000);
        await game.screenshot('zhongguo-armored-truck-protection-base-options', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 2,
            '直面恐惧目标基地',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as ArmoredTruckState;
            return {
                protectedStillOnBase0: state.core.bases[0].minions.some(minion => minion.uid === 'protected-minion'),
                movableStillOnBase1: state.core.bases[1].minions.some(minion => minion.uid === 'movable-target'),
                movableMovedToBase2: state.core.bases[2].minions.some(minion => minion.uid === 'movable-target'),
                scaredStraightDiscarded: state.core.players['0'].discard.some(card => card.defId === 'vigilantes_scared_straight'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            protectedStillOnBase0: true,
            movableStillOnBase1: false,
            movableMovedToBase2: true,
            scaredStraightDiscarded: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-armored-truck-protection-resolved', testInfo);
    });
});
