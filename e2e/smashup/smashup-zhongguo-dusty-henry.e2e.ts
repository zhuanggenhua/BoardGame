import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type DustyHenryState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string; defId: string }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            deck: Array<{ uid: string; defId: string }>;
            discard: Array<{ uid: string; defId: string }>;
            minionsPlayed: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: unknown } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 瞌睡的亨利链路', () => {
    test('打出瞌睡的亨利后，应选择本基地一个随从洗回其拥有者牌库', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'truckers'],
                hand: [
                    { uid: 'henry-1', defId: 'vigilantes_dusty_henry', type: 'minion', owner: '0' },
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
                deck: [
                    { uid: 'enemy-deck-1', defId: 'kung_fu_fighters_cricket', type: 'minion', owner: '1' },
                ],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_the_mean_streets',
                    minions: [
                        {
                            uid: 'target',
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
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('vigilantes_dusty_henry', { targetBaseIndex: 0 });
        await game.waitForInteraction('vigilantes_dusty_henry', 10000);
        await game.screenshot('zhongguo-dusty-henry-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target',
            '瞌睡的亨利目标随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as DustyHenryState;
            return {
                henryOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'henry-1'),
                targetStillOnBase: state.core.bases[0].minions.some(minion => minion.uid === 'target'),
                targetInOwnerDeck: state.core.players['1'].deck.some(card => card.uid === 'target' && card.defId === 'truckers_good_buddy'),
                targetInCasterDeck: state.core.players['0'].deck.some(card => card.uid === 'target'),
                handStillHasHenry: state.core.players['0'].hand.some(card => card.uid === 'henry-1'),
                minionsPlayed: state.core.players['0'].minionsPlayed,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            henryOnBase: true,
            targetStillOnBase: false,
            targetInOwnerDeck: true,
            targetInCasterDeck: false,
            handStillHasHenry: false,
            minionsPlayed: 1,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-dusty-henry-resolved', testInfo);
    });
});
