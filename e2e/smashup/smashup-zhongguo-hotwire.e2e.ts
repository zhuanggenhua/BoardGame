import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        actionUid?: string;
        mode?: string;
        baseIndex?: number;
    };
};

type HotwireState = {
    core: {
        bases: Array<{
            ongoingActions: Array<{
                uid: string;
                defId: string;
                ownerId?: string;
                metadata?: { sourceControllerId?: string };
            }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 短路点火链路', () => {
    test('打出短路点火后，应转移对方基地战术到另一基地并获得控制权', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['truckers', 'vigilantes'],
                hand: [
                    { uid: 'hotwire-card', defId: 'truckers_hotwire', type: 'action', owner: '0' },
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
                    defId: 'base_central_brain',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('truckers_hotwire');
        await game.waitForInteraction('truckers_hotwire_action', 10000);
        await game.screenshot('zhongguo-hotwire-action', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.actionUid === 'enemy-convoy',
            '短路点火目标战术',
        );

        await game.waitForInteraction('truckers_hotwire_mode', 10000);
        await game.screenshot('zhongguo-hotwire-mode', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.mode === 'transfer_and_control',
            '短路点火选择转移并控权',
        );

        await game.waitForInteraction('truckers_hotwire_base', 10000);
        await game.screenshot('zhongguo-hotwire-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '短路点火目标基地',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as HotwireState;
            const sourceBase = state.core.bases[0];
            const targetBase = state.core.bases[1];
            const movedAction = targetBase.ongoingActions.find(action => action.uid === 'enemy-convoy');
            return {
                sourceHasAction: sourceBase.ongoingActions.some(action => action.uid === 'enemy-convoy'),
                targetHasAction: Boolean(movedAction),
                targetController: movedAction?.metadata?.sourceControllerId ?? null,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceHasAction: false,
            targetHasAction: true,
            targetController: '0',
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        const finalState = await game.getState() as HotwireState;
        expect(finalState.core.bases[1].ongoingActions.find(action => action.uid === 'enemy-convoy')?.defId).toBe('truckers_convoy');

        await game.screenshot('zhongguo-hotwire-resolved', testInfo);
    });
});
