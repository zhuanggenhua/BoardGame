import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type ToughItOutState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                attachedActions?: Array<{ uid: string; defId: string }>;
            }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            deck: Array<{ uid: string; defId: string }>;
            discard: Array<{ uid: string; defId: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 咬紧牙关保护链路', () => {
    test('咬紧牙关附着生效时，对手的一天的快乐目标列表里不应出现宿主随从', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'make-card', defId: 'vigilantes_make_my_day', type: 'action', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-1', defId: 'truckers_convoy', type: 'action', owner: '0' },
                ],
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
                            uid: 'host',
                            defId: 'truckers_good_buddy',
                            owner: '1',
                            controller: '1',
                            basePower: 1,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [
                                { uid: 'tough-1', defId: 'vigilantes_tough_it_out', ownerId: '1' },
                            ],
                        },
                        {
                            uid: 'other-target',
                            defId: 'disco_dancers_roller',
                            owner: '1',
                            controller: '1',
                            basePower: 3,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'other-target-b',
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
                            uid: 'player0-ally',
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
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-tough-it-out-protection-ready', testInfo);

        await game.playCard('vigilantes_make_my_day');
        await game.waitForInteraction('vigilantes_make_my_day', 10000);

        const options = await game.getInteractionOptions() as InteractionOption[];
        expect(options.some(option => option?.value?.minionUid === 'host')).toBe(false);
        expect(options.some(option => option?.value?.minionUid === 'other-target')).toBe(true);
        expect(options.some(option => option?.value?.minionUid === 'other-target-b')).toBe(true);
        await game.screenshot('zhongguo-tough-it-out-protection-target-options', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'other-target',
            '一天的快乐只能选择未受咬紧牙关保护目标',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as ToughItOutState;
            return {
                hostStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'host'),
                toughStillAttached: state.core.bases[0].minions.some(minion =>
                    minion.uid === 'host' && (minion.attachedActions ?? []).some(action => action.uid === 'tough-1'),
                ),
                otherTargetStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'other-target'),
                otherTargetBStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'other-target-b'),
                handHasDrawnCard: state.core.players['0'].hand.some(card => card.uid === 'draw-1' && card.defId === 'truckers_convoy'),
                discardHasMakeMyDay: state.core.players['0'].discard.some(card => card.uid === 'make-card' && card.defId === 'vigilantes_make_my_day'),
                otherTargetInDiscard: state.core.players['1'].discard.some(card => card.uid === 'other-target' && card.defId === 'disco_dancers_roller'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            hostStillOnBase: true,
            toughStillAttached: true,
            otherTargetStillOnBase: false,
            otherTargetBStillOnBase: true,
            handHasDrawnCard: true,
            discardHasMakeMyDay: true,
            otherTargetInDiscard: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-tough-it-out-protection-resolved', testInfo);
    });
});
