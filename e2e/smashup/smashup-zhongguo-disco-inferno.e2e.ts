import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type DiscoInfernoState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; powerCounters?: number }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            deck: Array<{ uid: string; defId: string }>;
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

test.describe('SmashUp - zhongguo 迪斯科地狱链路', () => {
    test('打出迪斯科地狱后，应给目标随从放置 1 枚力量指示物并抓 1 张牌', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['disco_dancers', 'truckers'],
                hand: [
                    { uid: 'inferno-1', defId: 'disco_dancers_disco_inferno', type: 'action', owner: '0' },
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
                factions: ['vigilantes', 'kung_fu_fighters'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_funky_town',
                    minions: [
                        {
                            uid: 'target',
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
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('disco_dancers_disco_inferno');
        await game.waitForInteraction('disco_dancers_disco_inferno', 10000);
        await game.screenshot('zhongguo-disco-inferno-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target',
            '迪斯科地狱目标随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as DiscoInfernoState;
            const player = state.core.players['0'];
            return {
                targetPowerCounters: state.core.bases[0].minions.find(minion => minion.uid === 'target')?.powerCounters ?? 0,
                handHasDrawnCard: player.hand.some(card => card.uid === 'draw-1' && card.defId === 'truckers_convoy'),
                deckLength: player.deck.length,
                discoInfernoDiscarded: player.discard.some(card => card.uid === 'inferno-1' && card.defId === 'disco_dancers_disco_inferno'),
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetPowerCounters: 1,
            handHasDrawnCard: true,
            deckLength: 0,
            discoInfernoDiscarded: true,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-disco-inferno-resolved', testInfo);
    });
});
