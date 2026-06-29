import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
        baseIndex?: number;
        defId?: string;
    };
};

type ScaredStraightState = {
    core: {
        bases: Array<{
            minions: Array<{ uid: string }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            discard: Array<{ defId: string }>;
            vp: number;
            actionLimit: number;
            actionsPlayed: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: {
            current?: {
                data?: { sourceId?: string };
            };
        } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 直面恐惧链路', () => {
    test('打出直面恐惧后，应移动对手随从并立刻获得一次可实际打出的额外战术', async ({ game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['vigilantes', 'disco_dancers'],
                hand: [
                    { uid: 'scared-card', defId: 'vigilantes_scared_straight', type: 'action', owner: '0' },
                    { uid: 'last-dance-card', defId: 'disco_dancers_last_dance', type: 'action', owner: '0' },
                ],
                deck: [],
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
                            uid: 'target-minion',
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
                {
                    defId: 'base_funky_town',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        await game.playCard('vigilantes_scared_straight');
        await game.waitForInteraction('vigilantes_scared_straight', 10000);
        await game.screenshot('zhongguo-scared-straight-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target-minion',
            '直面恐惧目标随从',
        );

        await game.waitForInteraction('vigilantes_scared_straight_destination', 10000);
        await game.screenshot('zhongguo-scared-straight-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '直面恐惧目标基地',
        );

        await expect.poll(async () => {
            const state = await game.getState() as ScaredStraightState;
            return {
                targetMovedToBase1: state.core.bases[1].minions.some(minion => minion.uid === 'target-minion'),
                targetStayedAtBase0: state.core.bases[0].minions.some(minion => minion.uid === 'target-minion'),
                actionLimit: state.core.players['0'].actionLimit,
                actionsPlayed: state.core.players['0'].actionsPlayed,
                handHasLastDance: state.core.players['0'].hand.some(card => card.uid === 'last-dance-card'),
                interactionOpen: Boolean(state.sys.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            targetMovedToBase1: true,
            targetStayedAtBase0: false,
            actionLimit: 2,
            actionsPlayed: 1,
            handHasLastDance: true,
            interactionOpen: false,
        });

        await game.screenshot('zhongguo-scared-straight-extra-action-ready', testInfo);

        await game.playCard('disco_dancers_last_dance');
        await game.waitForInteraction('disco_dancers_last_dance', 10000);

        await game.screenshot('zhongguo-scared-straight-extra-action-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'own-minion',
            '最后的舞曲目标随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as ScaredStraightState;
            return {
                targetMovedToBase1: state.core.bases[1].minions.some(minion => minion.uid === 'target-minion'),
                targetStayedAtBase0: state.core.bases[0].minions.some(minion => minion.uid === 'target-minion'),
                ownMinionDestroyed: state.core.bases[0].minions.some(minion => minion.uid === 'own-minion'),
                vp: state.core.players['0'].vp,
                actionLimit: state.core.players['0'].actionLimit,
                handHasLastDance: state.core.players['0'].hand.some(card => card.uid === 'last-dance-card'),
                scaredStraightDiscarded: state.core.players['0'].discard.some(card => card.defId === 'vigilantes_scared_straight'),
                lastDanceDiscarded: state.core.players['0'].discard.some(card => card.defId === 'disco_dancers_last_dance'),
                interactionSourceId: state.sys.interaction?.current?.data?.sourceId ?? null,
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetMovedToBase1: true,
            targetStayedAtBase0: false,
            ownMinionDestroyed: false,
            vp: 1,
            actionLimit: 2,
            handHasLastDance: false,
            scaredStraightDiscarded: true,
            lastDanceDiscarded: true,
            interactionSourceId: null,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-scared-straight-resolved', testInfo);
    });
});
