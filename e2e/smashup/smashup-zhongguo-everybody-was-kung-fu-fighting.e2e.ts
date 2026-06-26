import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        baseIndex?: number;
        minionUid?: string;
    };
};

type EverybodyState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: { playerId?: string } | null } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 人人都是功夫高手链路', () => {
    test('打出人人都是功夫高手后，应先选基地，再让每位有随从的玩家各消灭另一位玩家的一个随从', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', { seat1: 'human' });
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['kung_fu_fighters', 'truckers'],
                hand: [
                    {
                        uid: 'everybody-card',
                        defId: 'kung_fu_fighters_everybody_was_kung_fu_fighting',
                        type: 'action',
                        owner: '0',
                    },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['vigilantes', 'disco_dancers'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [
                        {
                            uid: 'ally',
                            defId: 'kung_fu_fighters_cricket',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            powerCounters: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'enemy',
                            defId: 'vigilantes_jacky_bill',
                            owner: '1',
                            controller: '1',
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

        await game.playCard('kung_fu_fighters_everybody_was_kung_fu_fighting');
        await game.waitForInteraction('kung_fu_fighters_everybody_was_kung_fu_fighting_base', 10000);
        await game.screenshot('zhongguo-everybody-was-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 0,
            '人人都是功夫高手目标基地',
        );

        await game.waitForInteraction('kung_fu_fighters_everybody_was_kung_fu_fighting_target', 10000);
        await game.screenshot('zhongguo-everybody-was-player0-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'enemy',
            '玩家0消灭敌方随从',
        );

        await game.waitForInteraction('kung_fu_fighters_everybody_was_kung_fu_fighting_target', 10000);
        await game.screenshot('zhongguo-everybody-was-player1-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'ally',
            '玩家1消灭敌方随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as EverybodyState;
            const base = state.core.bases[0];
            return {
                hasAlly: base.minions.some(minion => minion.uid === 'ally'),
                hasEnemy: base.minions.some(minion => minion.uid === 'enemy'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            hasAlly: false,
            hasEnemy: false,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-everybody-was-resolved', testInfo);
    });
});
