import { test, expect } from '../framework';

type LetsFinishThisState = {
    core: {
        currentPlayerIndex: number;
        bases: Array<{
            minions: Array<{ uid: string; controller: string }>;
            ongoingActions?: Array<{ uid: string; defId: string; ownerId: string }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
        }>;
        tempBreakpointModifiers?: Record<number, number>;
        scoringEligibleBaseIndices?: number[];
    };
    sys: {
        phase?: string;
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 做个了断吧链路', () => {
    test('控制者回合开始时，若基地上有双方随从，应把该基地临界点降为 0', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '1',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [],
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
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_the_mean_streets',
                    minions: [
                        {
                            uid: 'own-minion',
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
                        {
                            uid: 'enemy-minion',
                            defId: 'truckers_good_buddy',
                            owner: '1',
                            controller: '1',
                            basePower: 2,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [
                        { uid: 'finish-1', defId: 'vigilantes_lets_finish_this', ownerId: '0' },
                    ],
                },
                {
                    defId: 'base_boogie_wonderland',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.advancePhase();

        await expect.poll(async () => {
            const state = await game.getState() as LetsFinishThisState;
            return {
                currentPlayerIndex: state.core.currentPlayerIndex,
                phase: state.sys.phase,
                breakpointDelta: state.core.tempBreakpointModifiers?.[0] ?? 0,
                scoringEligibleBaseIndices: state.core.scoringEligibleBaseIndices ?? [],
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
            };
        }, { timeout: 10000 }).toEqual({
            currentPlayerIndex: 0,
            phase: 'playCards',
            breakpointDelta: -25,
            scoringEligibleBaseIndices: [0],
            interactionOpen: false,
            responseWindowOpen: false,
        });

        await game.screenshot('zhongguo-lets-finish-this-resolved', testInfo);
    });
});
