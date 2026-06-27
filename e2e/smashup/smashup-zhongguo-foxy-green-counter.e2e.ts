import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type FoxyGreenState = {
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

test.describe('SmashUp - zhongguo 狐狸翠反应链路', () => {
    test('其他玩家在同基地影响随从时，狐狸翠应获得 1 枚力量指示物', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'disco_dancers'],
                hand: [
                    { uid: 'inferno-1', defId: 'disco_dancers_disco_inferno', type: 'action', owner: '0' },
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
                factions: ['truckers', 'kung_fu_fighters'],
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        {
                            uid: 'foxy',
                            defId: 'vigilantes_foxy_green',
                            owner: '1',
                            controller: '1',
                            basePower: 4,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
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
        await game.screenshot('zhongguo-foxy-green-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target',
            '迪斯科地狱目标随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as FoxyGreenState;
            const player = state.core.players['0'];
            return {
                foxyPowerCounters: state.core.bases[0].minions.find(minion => minion.uid === 'foxy')?.powerCounters ?? 0,
                targetPowerCounters: state.core.bases[0].minions.find(minion => minion.uid === 'target')?.powerCounters ?? 0,
                deckLength: player.deck.length,
                discoInfernoDiscarded: player.discard.some(card => card.uid === 'inferno-1' && card.defId === 'disco_dancers_disco_inferno'),
                actionsPlayed: player.actionsPlayed,
                actionLimit: player.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            foxyPowerCounters: 1,
            targetPowerCounters: 1,
            deckLength: 0,
            discoInfernoDiscarded: true,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-foxy-green-resolved', testInfo);
    });
});
