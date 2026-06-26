import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type LastDanceState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
        }>;
        players: Record<string, { vp: number; discard: Array<{ defId: string }> }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 最后的舞曲链路', () => {
    test('打出最后的舞曲后，应消灭己方目标随从并获得 1 VP', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['disco_dancers', 'truckers'],
                hand: [
                    { uid: 'last-dance-card', defId: 'disco_dancers_last_dance', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                vp: 0,
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

        await game.playCard('disco_dancers_last_dance');
        await game.waitForInteraction('disco_dancers_last_dance', 10000);
        await game.screenshot('zhongguo-last-dance-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target',
            '最后的舞曲目标',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as LastDanceState;
            return {
                targetStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'target'),
                playerVp: state.core.players['0'].vp,
                discardHasTarget: state.core.players['0'].discard.some(card => card.defId === 'disco_dancers_roller'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetStillOnBase: false,
            playerVp: 1,
            discardHasTarget: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-last-dance-resolved', testInfo);
    });
});
