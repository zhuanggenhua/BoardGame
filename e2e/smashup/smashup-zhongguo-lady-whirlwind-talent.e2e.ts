import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

type LadyWhirlwindState = {
    core: {
        bases: Array<{
            minions: Array<{
                uid: string;
                powerCounters?: number;
                talentUsed?: boolean;
            }>;
        }>;
        players: Record<string, {
            discard: Array<{ uid: string; defId: string }>;
        }>;
        triggerQueue?: unknown[];
    };
    sys: {
        interaction?: { current?: { data?: { sourceId?: string } } | null } | null;
        responseWindow?: { current?: unknown } | null;
    };
};

test.describe('SmashUp - zhongguo 旋风女侠天赋链路', () => {
    test('真实点击旋风女侠后，应消灭更低战力随从并给自己放置 1 枚力量指示物', async ({ game, page }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['kung_fu_fighters', 'truckers'],
                hand: [],
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
                            uid: 'lady-1',
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
                            uid: 'enemy-low',
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
                        {
                            uid: 'enemy-low-2',
                            defId: 'disco_dancers_roller',
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

        const lady = page.locator('[data-minion-uid="lady-1"]').first();
        await expect(lady).toBeVisible({ timeout: 15000 });
        await game.screenshot('zhongguo-lady-whirlwind-ready', testInfo);

        await lady.click({ force: true });
        await game.waitForInteraction('kung_fu_fighters_lady_whirlwind', 10000);
        await game.screenshot('zhongguo-lady-whirlwind-target', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'enemy-low',
            '旋风女侠要消灭的更低战力随从',
        );

        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as LadyWhirlwindState;
            const base = state.core.bases[0];
            const self = base.minions.find(minion => minion.uid === 'lady-1');
            return {
                targetDestroyed: !base.minions.some(minion => minion.uid === 'enemy-low'),
                secondValidTargetStillThere: base.minions.some(minion => minion.uid === 'enemy-low-2'),
                selfCounters: self?.powerCounters ?? 0,
                selfTalentUsed: self?.talentUsed ?? false,
                targetInDiscard: state.core.players['1'].discard.some(card => card.uid === 'enemy-low'),
                interactionOpen: Boolean(state.sys.interaction?.current),
                responseWindowOpen: Boolean(state.sys.responseWindow?.current),
                triggerQueueLength: state.core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            targetDestroyed: true,
            secondValidTargetStillThere: true,
            selfCounters: 1,
            selfTalentUsed: true,
            targetInDiscard: true,
            interactionOpen: false,
            responseWindowOpen: false,
            triggerQueueLength: 0,
        });

        await game.screenshot('zhongguo-lady-whirlwind-resolved', testInfo);
    });
});
