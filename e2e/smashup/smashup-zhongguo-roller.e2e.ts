import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type RollerState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; owner: string; powerCounters?: number }>;
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

test.describe('SmashUp - zhongguo 轮滑舞娘链路', () => {
    test('用迪斯科地狱影响轮滑舞娘时，若她原本没有力量指示物，应再给自己补 1 枚', async ({ game }, testInfo) => {
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
                    defId: 'base_boogie_wonderland',
                    minions: [
                        {
                            uid: 'roller-self',
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

        await game.playCard('disco_dancers_disco_inferno');
        await game.waitForInteraction('disco_dancers_disco_inferno', 10000);
        await game.screenshot('zhongguo-roller-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'roller-self',
            '轮滑舞娘作为迪斯科地狱目标',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as RollerState;
            const player = state.core.players['0'];
            return {
                rollerPowerCounters: state.core.bases[0].minions.find(minion => minion.uid === 'roller-self' && minion.owner === '0')?.powerCounters ?? 0,
                handHasDrawnCard: player.hand.some(card => card.uid === 'draw-1' && card.defId === 'truckers_convoy'),
                discoInfernoDiscarded: player.discard.some(card => card.uid === 'inferno-1' && card.defId === 'disco_dancers_disco_inferno'),
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            rollerPowerCounters: 2,
            handHasDrawnCard: true,
            discoInfernoDiscarded: true,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-roller-resolved', testInfo);
    });
});
