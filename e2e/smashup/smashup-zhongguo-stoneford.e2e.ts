import { test, expect } from '../framework';

type StonefordState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; defId: string }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            deck: Array<{ uid: string; defId: string }>;
            discard: Array<{ uid: string; defId: string }>;
            minionsPlayed: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 破萝飞龙链路', () => {
    test('打出破萝飞龙后，应找到牌库中的第一张战术并抽到手牌', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'stoneford-1', defId: 'vigilantes_stoneford', type: 'minion', owner: '0' },
                ],
                deck: [
                    { uid: 'deck-minion', defId: 'truckers_good_buddy', type: 'minion', owner: '0' },
                    { uid: 'deck-action', defId: 'vigilantes_who_loves_ya_baby', type: 'action', owner: '0' },
                    { uid: 'deck-minion-2', defId: 'disco_dancers_roller', type: 'minion', owner: '0' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['kung_fu_fighters', 'disco_dancers'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_hideout',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-stoneford-ready', testInfo);

        await game.playCard('vigilantes_stoneford', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as StonefordState;
            const player = state.core.players['0'];
            return {
                stonefordOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'stoneford-1'),
                handHasDrawnAction: player.hand.some(card => card.uid === 'deck-action' && card.defId === 'vigilantes_who_loves_ya_baby'),
                handStillHasStoneford: player.hand.some(card => card.uid === 'stoneford-1'),
                topDeckUid: player.deck[0]?.uid ?? null,
                deckStillHasAction: player.deck.some(card => card.uid === 'deck-action'),
                minionsPlayed: player.minionsPlayed,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            stonefordOnBase: true,
            handHasDrawnAction: true,
            handStillHasStoneford: false,
            topDeckUid: 'deck-minion',
            deckStillHasAction: false,
            minionsPlayed: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-stoneford-resolved', testInfo);
    });
});
