import { test, expect } from '../framework';

type FixinState = {
    core: {
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
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

test.describe('SmashUp - zhongguo 修理链路', () => {
    test('打出修理后，应把弃牌堆中的战术回收到手牌', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['truckers', 'vigilantes'],
                hand: [
                    { uid: 'fix-1', defId: 'truckers_fixin_to_fix_it', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [
                    { uid: 'discard-action', defId: 'truckers_convoy', type: 'action', owner: '0' },
                    { uid: 'discard-minion', defId: 'truckers_good_buddy', type: 'minion', owner: '0' },
                ],
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
                    defId: 'base_truck_stop',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-fixin-to-fix-it-ready', testInfo);

        await game.playCard('truckers_fixin_to_fix_it');
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as FixinState;
            const player = state.core.players['0'];
            return {
                handHasRecoveredAction: player.hand.some(card => card.uid === 'discard-action' && card.defId === 'truckers_convoy'),
                handStillHasFix: player.hand.some(card => card.uid === 'fix-1'),
                discardStillHasRecoveredAction: player.discard.some(card => card.uid === 'discard-action'),
                discardStillHasMinion: player.discard.some(card => card.uid === 'discard-minion' && card.defId === 'truckers_good_buddy'),
                discardHasFix: player.discard.some(card => card.uid === 'fix-1' && card.defId === 'truckers_fixin_to_fix_it'),
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            handHasRecoveredAction: true,
            handStillHasFix: false,
            discardStillHasRecoveredAction: false,
            discardStillHasMinion: true,
            discardHasFix: true,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-fixin-to-fix-it-resolved', testInfo);
    });
});
