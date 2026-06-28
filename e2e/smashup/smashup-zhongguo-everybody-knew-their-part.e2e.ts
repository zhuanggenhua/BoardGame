import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type EverybodyKnewState = {
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
            minionsPlayed: number;
            minionLimit: number;
            actionsPlayed: number;
            actionLimit: number;
            baseLimitedMinionQuota?: number[] | Record<number, number>;
            baseLimitedMinionPowerCaps?: number[][] | Record<number, number[]>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: { data?: { sourceId?: string } } | null } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 各尽其责链路', () => {
    test('打出各尽其责并选择高战力己方随从后，应允许在同基地额外打出一个更低战力随从', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['kung_fu_fighters', 'truckers'],
                hand: [
                    { uid: 'ek-card', defId: 'kung_fu_fighters_everybody_knew_their_part', type: 'action', owner: '0' },
                    { uid: 'extra-minion', defId: 'truckers_good_buddy', type: 'minion', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-card', defId: 'truckers_fixin_to_fix_it', type: 'action', owner: '0' },
                ],
                discard: [],
                minionsPlayed: 1,
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
                            uid: 'strong',
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
                            uid: 'weak',
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
                    ongoingActions: [
                        {
                            uid: 'convoy-1',
                            defId: 'truckers_convoy',
                            ownerId: '0',
                        },
                    ],
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

        await game.playCard('kung_fu_fighters_everybody_knew_their_part');
        await game.waitForInteraction('kung_fu_fighters_everybody_knew_their_part', 10000);
        await game.screenshot('zhongguo-everybody-knew-their-part-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'strong',
            '各尽其责选择的高战力己方随从',
        );

        await expect.poll(async () => {
            const state = await game.getState() as EverybodyKnewState;
            const player = state.core.players['0'];
            const quota = player.baseLimitedMinionQuota?.[0] ?? 0;
            const caps = player.baseLimitedMinionPowerCaps?.[0] ?? [];
            return {
                quota,
                caps,
                minionsPlayed: player.minionsPlayed,
                minionLimit: player.minionLimit,
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            quota: 1,
            caps: [3],
            minionsPlayed: 1,
            minionLimit: 1,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.playCard('truckers_good_buddy', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as EverybodyKnewState;
            const player = state.core.players['0'];
            const quota = player.baseLimitedMinionQuota?.[0] ?? 0;
            const caps = player.baseLimitedMinionPowerCaps?.[0] ?? [];
            return {
                extraMinionOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'extra-minion' && minion.owner === '0'),
                extraMinionStillInHand: player.hand.some(card => card.uid === 'extra-minion'),
                drewRewardCard: player.hand.some(card => card.uid === 'draw-card'),
                discardHasAction: player.discard.some(card => card.defId === 'kung_fu_fighters_everybody_knew_their_part'),
                quota,
                caps,
                minionsPlayed: player.minionsPlayed,
                minionLimit: player.minionLimit,
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                interactionSourceId: state.sys.interaction?.current?.data?.sourceId ?? null,
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            extraMinionOnBase: true,
            extraMinionStillInHand: false,
            drewRewardCard: true,
            discardHasAction: true,
            quota: 0,
            caps: [],
            minionsPlayed: 1,
            minionLimit: 1,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            interactionSourceId: null,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-everybody-knew-their-part-resolved', testInfo);
    });
});
