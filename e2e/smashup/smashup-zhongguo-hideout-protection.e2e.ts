import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type HideoutState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
        }>;
        players: Record<string, {
            deck: Array<{ uid: string; defId: string }>;
            discard: Array<{ defId: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 藏身处保护链路', () => {
    test('藏身处生效时，对手的打到穿越目标列表里不应出现该基地的己方随从', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'disco_dancers'],
                hand: [
                    { uid: 'knock-card', defId: 'vigilantes_knocked_into_next_week', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['vigilantes', 'truckers'],
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
                    defId: 'base_hideout',
                    minions: [
                        {
                            uid: 'protected-minion',
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
                            uid: 'enemy-anchor',
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
                    minions: [
                        {
                            uid: 'other-target',
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
                            uid: 'other-target-b',
                            defId: 'truckers_cab_over_pete',
                            owner: '1',
                            controller: '1',
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
        await game.screenshot('zhongguo-hideout-protection-ready', testInfo);

        await game.playCard('vigilantes_knocked_into_next_week');
        await game.waitForInteraction('vigilantes_knocked_into_next_week', 10000);

        const options = await game.getInteractionOptions() as InteractionOption[];
        expect(options.some(option => option?.value?.minionUid === 'protected-minion')).toBe(false);
        expect(options.some(option => option?.value?.minionUid === 'other-target')).toBe(true);
        expect(options.some(option => option?.value?.minionUid === 'other-target-b')).toBe(true);
        await game.screenshot('zhongguo-hideout-protection-target-options', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'other-target',
            '打到穿越只能选择未受藏身处保护目标',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as HideoutState;
            return {
                protectedStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'protected-minion'),
                selectedTargetStillOnBase: state.core.bases[1].minions.some(minion => minion.uid === 'other-target'),
                unselectedTargetStillOnBase: state.core.bases[1].minions.some(minion => minion.uid === 'other-target-b'),
                ownerDeckHasSelectedTarget: state.core.players['1'].deck.some(card => card.uid === 'other-target' && card.defId === 'truckers_good_buddy'),
                player0DiscardHasKnock: state.core.players['0'].discard.some(card => card.defId === 'vigilantes_knocked_into_next_week'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            protectedStillOnBase: true,
            selectedTargetStillOnBase: false,
            unselectedTargetStillOnBase: true,
            ownerDeckHasSelectedTarget: true,
            player0DiscardHasKnock: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-hideout-protection-resolved', testInfo);
    });
});
