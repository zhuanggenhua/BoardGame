import { test, expect } from '../framework';

type StayinAliveState = {
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

test.describe('SmashUp - zhongguo 活着链路', () => {
    test('打出活着后，应把弃牌堆中与己方场上同名的随从回手', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['disco_dancers', 'truckers'],
                hand: [
                    { uid: 'stayin-card', defId: 'disco_dancers_stayin_alive', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [
                    { uid: 'discard-roller', defId: 'disco_dancers_roller', type: 'minion', owner: '0' },
                    { uid: 'discard-other', defId: 'truckers_good_buddy', type: 'minion', owner: '0' },
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
                    defId: 'base_funky_town',
                    minions: [
                        {
                            uid: 'roller-in-play',
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
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.screenshot('zhongguo-stayin-alive-ready', testInfo);

        await game.playCard('disco_dancers_stayin_alive');
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as StayinAliveState;
            const player = state.core.players['0'];
            return {
                handHasRecoveredRoller: player.hand.some(card => card.uid === 'discard-roller' && card.defId === 'disco_dancers_roller'),
                handStillHasAction: player.hand.some(card => card.uid === 'stayin-card'),
                discardStillHasRecoveredRoller: player.discard.some(card => card.uid === 'discard-roller'),
                discardStillHasOther: player.discard.some(card => card.uid === 'discard-other' && card.defId === 'truckers_good_buddy'),
                discardHasStayinAlive: player.discard.some(card => card.uid === 'stayin-card' && card.defId === 'disco_dancers_stayin_alive'),
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            handHasRecoveredRoller: true,
            handStillHasAction: false,
            discardStillHasRecoveredRoller: false,
            discardStillHasOther: true,
            discardHasStayinAlive: true,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-stayin-alive-resolved', testInfo);
    });
});
