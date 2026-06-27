import { test, expect } from '../framework';

type UlDiscoLouState = {
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

test.describe('SmashUp - zhongguo 迪斯科·卢链路', () => {
    test('打出迪斯科·卢后，应把弃牌堆中的战术放到牌库顶', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['disco_dancers', 'truckers'],
                hand: [
                    { uid: 'lou-1', defId: 'disco_dancers_ul_disco_lou', type: 'minion', owner: '0' },
                ],
                deck: [
                    { uid: 'deck-minion', defId: 'truckers_good_buddy', type: 'minion', owner: '0' },
                    { uid: 'deck-action', defId: 'truckers_convoy', type: 'action', owner: '0' },
                ],
                discard: [
                    { uid: 'discard-action', defId: 'disco_dancers_celebration', type: 'action', owner: '0' },
                    { uid: 'discard-minion', defId: 'disco_dancers_roller', type: 'minion', owner: '0' },
                ],
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
                    defId: 'base_boogie_wonderland',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-ul-disco-lou-ready', testInfo);

        await game.playCard('disco_dancers_ul_disco_lou', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as UlDiscoLouState;
            const player = state.core.players['0'];
            return {
                louOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'lou-1'),
                handStillHasLou: player.hand.some(card => card.uid === 'lou-1'),
                topDeckUid: player.deck[0]?.uid ?? null,
                deckSecondUid: player.deck[1]?.uid ?? null,
                discardStillHasAction: player.discard.some(card => card.uid === 'discard-action'),
                discardStillHasMinion: player.discard.some(card => card.uid === 'discard-minion' && card.defId === 'disco_dancers_roller'),
                minionsPlayed: player.minionsPlayed,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            louOnBase: true,
            handStillHasLou: false,
            topDeckUid: 'discard-action',
            deckSecondUid: 'deck-minion',
            discardStillHasAction: false,
            discardStillHasMinion: true,
            minionsPlayed: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-ul-disco-lou-resolved', testInfo);
    });
});
