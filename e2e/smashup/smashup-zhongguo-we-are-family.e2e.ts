import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type WeAreFamilyState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; tempPowerModifier?: number }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string }>;
            deck: Array<{ uid: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 我们是一家人复制链路', () => {
    test('打出今晚嗨起来影响宿主同基地其他己方随从后，我们是一家人应让宿主自动复制同样的普通战术影响', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['disco_dancers', 'truckers'],
                hand: [
                    { uid: 'getdown-card', defId: 'disco_dancers_get_down_tonight', type: 'action', owner: '0' },
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
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        {
                            uid: 'host',
                            defId: 'truckers_good_buddy',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [
                                {
                                    uid: 'family-1',
                                    defId: 'disco_dancers_we_are_family',
                                    ownerId: '0',
                                },
                            ],
                        },
                        {
                            uid: 'target',
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

        await game.playCard('disco_dancers_get_down_tonight');
        await game.waitForInteraction('disco_dancers_get_down_tonight', 10000);
        await game.screenshot('zhongguo-we-are-family-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target',
            '今晚嗨起来原目标',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as WeAreFamilyState;
            const base = state.core.bases[0];
            return {
                targetBuff: base.minions.find(minion => minion.uid === 'target')?.tempPowerModifier ?? 0,
                hostBuff: base.minions.find(minion => minion.uid === 'host')?.tempPowerModifier ?? 0,
                handHasDrawnCard: state.core.players['0'].hand.some(card => card.uid === 'draw-1'),
                deckLength: state.core.players['0'].deck.length,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetBuff: 2,
            hostBuff: 2,
            handHasDrawnCard: true,
            deckLength: 0,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-we-are-family-resolved', testInfo);
    });
});
