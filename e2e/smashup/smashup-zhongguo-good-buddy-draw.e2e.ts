import { test, expect } from '../framework';

type GoodBuddyState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; defId: string }>;
            ongoingActions: Array<{ uid: string; defId: string; ownerId: string }>;
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

test.describe('SmashUp - zhongguo 好伙伴抓牌链路', () => {
    test('打出好伙伴到已有己方基地战术的基地后，应抓 1 张牌', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['truckers', 'vigilantes'],
                hand: [
                    { uid: 'buddy-1', defId: 'truckers_good_buddy', type: 'minion', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-1', defId: 'vigilantes_who_loves_ya_baby', type: 'action', owner: '0' },
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
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [],
                    ongoingActions: [
                        { uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0' },
                    ],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-good-buddy-ready', testInfo);

        await game.playCard('truckers_good_buddy', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as GoodBuddyState;
            const player = state.core.players['0'];
            return {
                buddyOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'buddy-1' && minion.defId === 'truckers_good_buddy'),
                ownActionStillOnBase: state.core.bases[0].ongoingActions.some(action => action.uid === 'convoy-1' && action.ownerId === '0'),
                handHasDrawnAction: player.hand.some(card => card.uid === 'draw-1' && card.defId === 'vigilantes_who_loves_ya_baby'),
                handStillHasBuddy: player.hand.some(card => card.uid === 'buddy-1'),
                deckLength: player.deck.length,
                minionsPlayed: player.minionsPlayed,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            buddyOnBase: true,
            ownActionStillOnBase: true,
            handHasDrawnAction: true,
            handStillHasBuddy: false,
            deckLength: 0,
            minionsPlayed: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-good-buddy-resolved', testInfo);
    });
});
