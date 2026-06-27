import { test, expect } from '../framework';

type ShiftState = {
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

test.describe('SmashUp - zhongguo 铁杆神探链路', () => {
    test('打出铁杆神探后，应把弃牌堆至多两个随从放到牌库顶并移出弃牌堆', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'shift-1', defId: 'vigilantes_shift', type: 'minion', owner: '0' },
                ],
                deck: [
                    { uid: 'deck-1', defId: 'vigilantes_who_loves_ya_baby', type: 'action', owner: '0' },
                ],
                discard: [
                    { uid: 'discard-minion-a', defId: 'truckers_good_buddy', type: 'minion', owner: '0' },
                    { uid: 'discard-minion-b', defId: 'disco_dancers_roller', type: 'minion', owner: '0' },
                    { uid: 'discard-action', defId: 'truckers_rally', type: 'action', owner: '0' },
                ],
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
        await game.screenshot('zhongguo-shift-ready', testInfo);

        await game.playCard('vigilantes_shift', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as ShiftState;
            const player = state.core.players['0'];
            return {
                shiftOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'shift-1'),
                handStillHasShift: player.hand.some(card => card.uid === 'shift-1'),
                topTwoDeckUids: player.deck.slice(0, 2).map(card => card.uid).join(','),
                discardStillHasMinionA: player.discard.some(card => card.uid === 'discard-minion-a'),
                discardStillHasMinionB: player.discard.some(card => card.uid === 'discard-minion-b'),
                discardStillHasAction: player.discard.some(card => card.uid === 'discard-action' && card.defId === 'truckers_rally'),
                minionsPlayed: player.minionsPlayed,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            shiftOnBase: true,
            handStillHasShift: false,
            topTwoDeckUids: 'discard-minion-a,discard-minion-b',
            discardStillHasMinionA: false,
            discardStillHasMinionB: false,
            discardStillHasAction: true,
            minionsPlayed: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-shift-resolved', testInfo);
    });
});
