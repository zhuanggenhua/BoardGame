import { test, expect } from '../framework';

type JackyBillState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                tempPowerModifier?: number;
            }>;
            ongoingActions?: Array<{ uid: string; defId: string }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            discard: Array<{ uid: string; defId: string }>;
            minionsPlayed: number;
            minionLimit: number;
            actionsPlayed: number;
            actionLimit: number;
        }>;
        currentPlayerIndex?: number;
        triggerQueue?: unknown[];
    };
    sys: {
        phase?: string;
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 杰基比尔链路', () => {
    test('打出杰基比尔后，对手在同基地打出战术时应让其获得 +2 临时战力', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'jacky-card', defId: 'vigilantes_jacky_bill', type: 'minion', owner: '0' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 1,
                actionLimit: 1,
            },
            player1: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'enemy-action', defId: 'vigilantes_street_justice', type: 'action', owner: '1' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_mean_streets',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('vigilantes_jacky_bill', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await game.screenshot('zhongguo-jacky-bill-played', testInfo);

        await game.advancePhase();

        await expect.poll(async () => {
            const state = await game.getState() as JackyBillState;
            return {
                currentPlayerIndex: state.core.currentPlayerIndex ?? -1,
                phase: state.sys.phase,
                player1ActionsPlayed: state.core.players['1'].actionsPlayed,
                jackyOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'jacky-card'),
            };
        }, { timeout: 10000 }).toEqual({
            currentPlayerIndex: 1,
            phase: 'playCards',
            player1ActionsPlayed: 0,
            jackyOnBase: true,
        });

        await game.playCard('vigilantes_street_justice', { targetBaseIndex: 0 });

        await expect.poll(async () => {
            const state = await game.getState() as JackyBillState;
            const base = state.core.bases[0];
            const jacky = base.minions.find(minion => minion.uid === 'jacky-card');
            return {
                jackyBuff: jacky?.tempPowerModifier ?? 0,
                enemyActionOnBase: base.ongoingActions?.some(action => action.uid === 'enemy-action' && action.defId === 'vigilantes_street_justice') ?? false,
                player1ActionsPlayed: state.core.players['1'].actionsPlayed,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            jackyBuff: 2,
            enemyActionOnBase: true,
            player1ActionsPlayed: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-jacky-bill-resolved', testInfo);
    });
});
