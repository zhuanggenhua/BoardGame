import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        actionUid?: string;
    };
};

type ElBandidoState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
            ongoingActions: Array<{
                uid: string;
                defId: string;
                ownerId?: string;
                metadata?: { sourceControllerId?: string };
            }>;
        }>;
        players: Record<string, {
            discard: Array<{ defId: string }>;
            hand: Array<{ uid: string }>;
            minionsPlayed: number;
            minionLimit: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 埃尔班迪多控权链路', () => {
    test('打出埃尔班迪多后，应提示选择基地战术并获得其控制权', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['truckers', 'vigilantes'],
                hand: [
                    { uid: 'bandido-card', defId: 'truckers_el_bandido', type: 'minion', owner: '0' },
                ],
                deck: [],
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
                        { uid: 'enemy-convoy', defId: 'truckers_convoy', ownerId: '1', controllerId: '1', talentUsed: false },
                    ],
                },
                {
                    defId: 'base_truck_stop',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('truckers_el_bandido', { targetBaseIndex: 1 });
        await game.waitForInteraction('truckers_el_bandido_take_control', 10000);
        await game.screenshot('zhongguo-el-bandido-take-control-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.actionUid === 'enemy-convoy',
            '埃尔班迪多控权目标',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as ElBandidoState;
            const controlledAction = state.core.bases[0].ongoingActions.find(action => action.uid === 'enemy-convoy');
            return {
                bandidoOnTargetBase: state.core.bases[1].minions.some(minion => minion.uid === 'bandido-card'),
                targetController: controlledAction?.metadata?.sourceControllerId ?? null,
                handStillHasBandido: state.core.players['0'].hand.some(card => card.uid === 'bandido-card'),
                minionsPlayed: state.core.players['0'].minionsPlayed,
                minionLimit: state.core.players['0'].minionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            bandidoOnTargetBase: true,
            targetController: '0',
            handStillHasBandido: false,
            minionsPlayed: 1,
            minionLimit: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        const finalState = await game.getState() as ElBandidoState;
        expect(finalState.core.bases[0].ongoingActions.find(action => action.uid === 'enemy-convoy')?.defId).toBe('truckers_convoy');

        await game.screenshot('zhongguo-el-bandido-take-control-resolved', testInfo);
    });
});
