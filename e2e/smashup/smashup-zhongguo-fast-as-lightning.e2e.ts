import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type FastAsLightningState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                tempPowerModifier?: number;
                powerCounters?: number;
                talentUsed?: boolean;
            }>;
        }>;
        players: Record<string, {
            hand: Array<{ uid: string; defId: string }>;
            discard: Array<{ uid: string; defId: string }>;
            actionsPlayed: number;
            actionLimit: number;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: { data?: { sourceId?: string } } | null } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 快如闪电链路', () => {
    test('打出快如闪电后，应给目标 +2 战力并在本回合被消灭时改回手牌', async ({ game, page }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['kung_fu_fighters', 'truckers'],
                hand: [
                    { uid: 'fast-1', defId: 'kung_fu_fighters_fast_as_lightning', type: 'action', owner: '0' },
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
                            uid: 'lady',
                            defId: 'kung_fu_fighters_lady_whirlwind',
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
                            uid: 'target',
                            defId: 'vigilantes_jacky_bill',
                            owner: '1',
                            controller: '1',
                            basePower: 1,
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

        await game.playCard('kung_fu_fighters_fast_as_lightning');
        await game.waitForInteraction('kung_fu_fighters_fast_as_lightning', 10000);
        await game.screenshot('zhongguo-fast-as-lightning-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'target',
            '快如闪电目标随从',
        );

        await expect.poll(async () => {
            const state = await game.getState() as FastAsLightningState;
            const base = state.core.bases[0];
            const target = base.minions.find(minion => minion.uid === 'target');
            return {
                targetBuff: target?.tempPowerModifier ?? 0,
                actionsPlayed: state.core.players['0'].actionsPlayed,
                actionLimit: state.core.players['0'].actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            targetBuff: 2,
            actionsPlayed: 1,
            actionLimit: 1,
            interactionOpen: false,
        });

        await game.screenshot('zhongguo-fast-as-lightning-buffed', testInfo);

        const lady = page.locator('[data-minion-uid="lady"]').first();
        await expect(lady).toBeVisible({ timeout: 10000 });
        await game.screenshot('zhongguo-fast-as-lightning-lady-ready', testInfo);
        await lady.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState() as FastAsLightningState;
            const interactionSourceId = state.sys.interaction?.current?.data?.sourceId ?? null;
            const resolved = state.core.bases[0].minions.every(minion => minion.uid !== 'target');
            return interactionSourceId === 'kung_fu_fighters_lady_whirlwind' || resolved;
        }, { timeout: 10000 }).toBe(true);

        const afterLadyClick = await game.getState() as FastAsLightningState;
        if (afterLadyClick.sys.interaction?.current?.data?.sourceId === 'kung_fu_fighters_lady_whirlwind') {
            await game.screenshot('zhongguo-fast-as-lightning-lady-target', testInfo);

            await game.selectInteractionOptionBy(
                (option: InteractionOption) => option?.value?.minionUid === 'target',
                '旋风女侠目标随从',
            );
        }

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as FastAsLightningState;
            const base = state.core.bases[0];
            const ladyMinion = base.minions.find(minion => minion.uid === 'lady');
            return {
                targetStillOnBase: base.minions.some(minion => minion.uid === 'target'),
                player1HandHasTarget: state.core.players['1'].hand.some(card => card.uid === 'target' && card.defId === 'vigilantes_jacky_bill'),
                player1DiscardHasTarget: state.core.players['1'].discard.some(card => card.uid === 'target'),
                ladyPowerCounters: ladyMinion?.powerCounters ?? 0,
                ladyTalentUsed: ladyMinion?.talentUsed ?? false,
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetStillOnBase: false,
            player1HandHasTarget: true,
            player1DiscardHasTarget: false,
            ladyPowerCounters: 1,
            ladyTalentUsed: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-fast-as-lightning-resolved', testInfo);
    });
});
